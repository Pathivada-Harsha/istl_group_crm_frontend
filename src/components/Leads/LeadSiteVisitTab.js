// ─────────────────────────────────────────────────────────────────────────────
//  LeadSiteVisitTab — structured "Solar Site Visit Report" for a lead.
//
//  • Lists all site-visit reports recorded for the lead (multiple visits allowed).
//  • "Add Report" opens the SiteVisitForm for a user with lead access.
//  • "Assign Site Visit" creates a `Visit` follow-up for another user — that user
//    then fills the report from their My Follow-ups page (see Follow-ups.js),
//    WITHOUT gaining full access to the lead.
//  • Overlapping fields (bill, loads, capacity, property type) live on the lead
//    and are pre-filled from it / written back on save.
//
//  SiteVisitForm is exported so the visitor entry point (Follow-ups.js) can reuse
//  the exact same form inside a modal.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/leadsapi.js";
import FilterSelect from "../Dropdowns/FilterSelect.js";
import LocationPicker from "../LocationPicker.js";
import { COMMON_UNITS } from "../Dropdowns/Unittypedropdown.js";
import "./LeadSiteVisitTab.css";

// Property/project types for the solar rooftop flow
const PROPERTY_TYPES = ["Residential", "Commercial", "Industrial", "Institutional", "Agricultural", "Government"];
// Curated pick-lists for the site-visit selects (replace free-text inputs)
const PHASE_OPTIONS         = ["Single Phase", "Three Phase"];
const ROOF_TYPES            = ["RCC", "Metal Sheet", "Tiled", "Asbestos Sheet", "Concrete", "Shed", "Ground Mount"];
const ACCESSIBILITY_OPTIONS = ["Easy", "Moderate", "Difficult"];
const INVERTER_LOCATIONS    = ["Indoor", "Outdoor", "Wall Mounted", "Near Meter Room", "Rooftop", "Basement"];
const EARTHING_LOCATIONS    = ["Near Inverter", "Rooftop", "Ground Level", "Near Meter Room"];
const STRUCTURE_TYPES       = ["Standard (GI)", "Elevated", "Ground Mount", "Ballasted", "Tin Shed", "RCC Anchored"];
const MODULE_ORIENTATIONS   = ["Portrait", "Landscape"];

// Curated unit subsets, so each measurement offers only sensible units.
const POWER_UNITS  = ["kW", "kWp", "kWh", "MW", "MWp", "kVA", "MVA"];
const AREA_UNITS   = ["Sqft", "Sq.ft", "Sqm", "Sq.m", "Acres", "Hectares"];
const LENGTH_UNITS = ["Meter", "Feet", "Km", "Inch", "cm", "mm"];

// Build FilterSelect options (+ a Custom escape hatch) from a plain unit array.
const toUnitOptions = (units) => [...units.map(u => ({ value: u, label: u })), { value: "Custom", label: "✏️ Custom" }];

// Split a stored "5 kW" style string into { num, unit }. Robust to "10kW", "5", "".
const parseValueUnit = (s) => {
  if (s == null || s === "") return { num: "", unit: "" };
  const m = String(s).trim().match(/^([\d.,\s]*)\s*(.*)$/);
  return m ? { num: (m[1] || "").trim(), unit: (m[2] || "").trim() } : { num: String(s), unit: "" };
};
const joinValueUnit = (num, unit) => [num, unit].filter(x => x !== "" && x != null).join(" ").trim();

// App-standard unit dropdown (FilterSelect) with a Custom text fallback.
// `units` restricts the list to the units that make sense for the field; the
// search box only appears for long lists so short curated lists stay compact.
function UnitSelect({ value, onChange, units = COMMON_UNITS }) {
  const [customMode, setCustomMode] = useState(!!value && !units.includes(value));
  const options = React.useMemo(() => toUnitOptions(units), [units]);
  if (customMode) {
    return (
      <div className="lsv-unit-custom">
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="Unit" />
        <button type="button" className="lsv-unit-back" title="Back to list"
          onClick={() => { setCustomMode(false); onChange(""); }}>↩</button>
      </div>
    );
  }
  return (
    <div className="lsv-unit-select">
      <FilterSelect
        value={value}
        onChange={v => { if (v === "Custom") { setCustomMode(true); onChange(""); } else onChange(v); }}
        options={options}
        placeholder="Unit"
        searchable={units.length > 10}
        searchPlaceholder="Search units…"
      />
    </div>
  );
}

// A number/value input + unit dropdown that reads & writes a single combined
// string. `units` scopes the unit list; `defaultUnit` pre-selects a unit when
// the stored value has none (so a fresh field already shows e.g. "kW").
function ValueUnit({ label, value, onChange, placeholder, units, defaultUnit }) {
  const init = parseValueUnit(value);
  const [num, setNum] = useState(init.num);
  const [unit, setUnit] = useState(init.unit || defaultUnit || "");
  const push = (n, u) => onChange(joinValueUnit(n, u));
  return (
    <label className="lsv-field">
      <span>{label}</span>
      <div className="lsv-capacity">
        <input value={num} onChange={e => { setNum(e.target.value); push(e.target.value, unit); }} placeholder={placeholder || ""} />
        <UnitSelect value={unit} units={units} onChange={u => { setUnit(u); push(num, u); }} />
      </div>
    </label>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = s => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const SHADOW_OPTS = [
  { v: "NONE", l: "No Shadow" },
  { v: "PARTIAL", l: "Partial Shadow" },
  { v: "HEAVY", l: "Heavy Shadow" },
];

// Module-scoped so it keeps a stable identity across parent re-renders — a
// component defined inside SiteVisitForm would remount on every keystroke and
// steal focus from the input.
const LsvField = ({ label, value, onChange, placeholder, type = "text" }) => (
  <label className="lsv-field">
    <span>{label}</span>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder || ""} />
  </label>
);

// Labelled FilterSelect built from a plain string array (or {value,label} list).
// Module-scoped for the same stable-identity reason as LsvField.
const LsvSelect = ({ label, value, onChange, options, placeholder = "Select" }) => (
  <label className="lsv-field">
    <span>{label}</span>
    <FilterSelect
      value={value}
      onChange={onChange}
      options={options.map(o => (typeof o === "string" ? { value: o, label: o } : o))}
      placeholder={placeholder}
      searchable={options.length > 10}
    />
  </label>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SITE VISIT FORM  (reused by the visitor entry point in Follow-ups.js)
// ═══════════════════════════════════════════════════════════════════════════════
export function SiteVisitForm({ lead, leadId, leadInfo, followupId, visit, currentUser, onSaved, onCancel, hideCancel }) {
  const effectiveLeadId = lead?.id ?? leadId ?? visit?.leadId;
  const isEdit = !!visit;

  // Customer (read-only) display fields, from whatever source we have.
  const cust = {
    name:  lead?.name  ?? leadInfo?.name  ?? "—",
    phone: lead?.phone ?? leadInfo?.phone ?? "—",
    email: lead?.email ?? leadInfo?.email ?? "—",
    city:  lead?.city  ?? leadInfo?.city  ?? "—",
  };

  const [form, setForm] = useState(() => ({
    visitDate: visit?.visitDate || todayISO(),
    // Overlapping fields — pre-filled from the lead (single source of truth).
    // Editable here; any change is written back to the lead on save.
    monthlyBill:          visit?.monthlyBill          ?? lead?.tcMonthlyBill          ?? "",
    existingContractLoad: visit?.existingContractLoad ?? lead?.tcExistingContractLoad ?? "",
    requiredContractLoad: visit?.requiredContractLoad ?? lead?.tcRequiredContractLoad ?? "",
    capacity:             visit?.capacity             ?? lead?.capacity               ?? "",
    capacityUnit:         visit?.capacityUnit         ?? lead?.capacityUnit           ?? "kWp",
    propertyType:         visit?.propertyType         ?? lead?.tcPropertyType         ?? "",
    // Location
    siteAddress: visit?.siteAddress ?? lead?.tcLocation ?? "",
    siteLat:     visit?.siteLat != null ? String(visit.siteLat) : "",
    siteLng:     visit?.siteLng != null ? String(visit.siteLng) : "",
    // Project (site-visit specific)
    sanctionedLoad:          visit?.sanctionedLoad          ?? "",
    electricityTariff:       visit?.electricityTariff       ?? "",
    consumerNumber:          visit?.consumerNumber          ?? "",
    discom:                  visit?.discom                  ?? "",
    phase:                   visit?.phase                   ?? "",
    monthlyConsumptionUnits: visit?.monthlyConsumptionUnits ?? "",
    // Roof
    roofType:      visit?.roofType      ?? "",
    shadowFreeArea:visit?.shadowFreeArea?? "",
    roofCondition: visit?.roofCondition ?? "",
    roofDirection: visit?.roofDirection ?? "",
    roofTilt:      visit?.roofTilt      ?? "",
    accessibility: visit?.accessibility ?? "",
    // Shadow
    shadowAnalysis: visit?.shadowAnalysis ?? "",
    shadowRemarks:  visit?.shadowRemarks  ?? "",
    // Installation
    inverterLocation:  visit?.inverterLocation  ?? "",
    acCableLength:     visit?.acCableLength     ?? "",
    dcCableLength:     visit?.dcCableLength     ?? "",
    earthingLocation:  visit?.earthingLocation  ?? "",
    structureType:     visit?.structureType     ?? "",
    moduleOrientation: visit?.moduleOrientation ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!effectiveLeadId) { setErr("Missing lead reference"); return; }
    setSaving(true);
    setErr("");
    const payload = {
      ...form,
      leadId: effectiveLeadId,
      followupId: followupId ?? visit?.followupId ?? null,
      siteLat: form.siteLat === "" ? null : Number(form.siteLat),
      siteLng: form.siteLng === "" ? null : Number(form.siteLng),
    };
    try {
      const res = isEdit
        ? await api.put(`/site-visits/${visit.id}`, payload)
        : await api.post(`/site-visits`, payload);
      if (res?.success) onSaved?.(res.data);
      else setErr(res?.message || "Failed to save site visit");
    } catch (e2) {
      if (e2.message !== "SESSION_EXPIRED") setErr(e2.message || "Failed to save site visit");
    } finally { setSaving(false); }
  };

  const F = (label, k, placeholder, type = "text") => (
    <LsvField label={label} value={form[k]} onChange={set(k)} placeholder={placeholder} type={type} />
  );

  const S = (label, k, options, placeholder) => (
    <LsvSelect label={label} value={form[k]} onChange={v => setForm(p => ({ ...p, [k]: v }))}
      options={options} placeholder={placeholder} />
  );

  return (
    <form className="lsv-form" onSubmit={submit}>
      {/* 1. Customer Details */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">1. Customer Details</h5>
        <div className="lsv-grid">
          <div className="lsv-ro"><span>Customer Name</span><b>{cust.name}</b></div>
          <div className="lsv-ro"><span>Mobile Number</span><b>{cust.phone}</b></div>
          <div className="lsv-ro"><span>Email ID</span><b>{cust.email}</b></div>
          <div className="lsv-ro"><span>City</span><b>{cust.city}</b></div>
          <label className="lsv-field">
            <span>Date of Visit</span>
            <input type="date" value={form.visitDate} onChange={set("visitDate")} />
          </label>
          <div className="lsv-ro"><span>Visited By</span><b>{currentUser?.name || "—"}</b></div>
        </div>
      </section>

      {/* 2. Project Details — overlapping fields pre-filled from the lead; edits sync back */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">2. Project Details <span className="lsv-section-hint">— pre-filled from lead; changes update the lead too</span></h5>
        <div className="lsv-grid">
          <label className="lsv-field">
            <span>Project / Property Type</span>
            <FilterSelect
              value={form.propertyType}
              onChange={v => setForm(p => ({ ...p, propertyType: v }))}
              options={PROPERTY_TYPES.map(t => ({ value: t, label: t }))}
              placeholder="Select type"
            />
          </label>
          <label className="lsv-field">
            <span>Proposed Capacity</span>
            <div className="lsv-capacity">
              <input value={form.capacity} onChange={set("capacity")} placeholder="e.g. 10" />
              <UnitSelect value={form.capacityUnit} units={POWER_UNITS} onChange={u => setForm(p => ({ ...p, capacityUnit: u }))} />
            </div>
          </label>
          <ValueUnit label="Existing Connected Load" value={form.existingContractLoad}
            onChange={v => setForm(p => ({ ...p, existingContractLoad: v }))} placeholder="e.g. 5" units={POWER_UNITS} defaultUnit="kW" />
          <ValueUnit label="Required Contract Load" value={form.requiredContractLoad}
            onChange={v => setForm(p => ({ ...p, requiredContractLoad: v }))} placeholder="e.g. 10" units={POWER_UNITS} defaultUnit="kW" />
          <ValueUnit label="Sanctioned Load" value={form.sanctionedLoad}
            onChange={v => setForm(p => ({ ...p, sanctionedLoad: v }))} placeholder="e.g. 8" units={POWER_UNITS} defaultUnit="kW" />
          {F("Electricity Tariff", "electricityTariff", "e.g. LT-II / ₹8.5 per unit")}
          {F("Consumer Number", "consumerNumber")}
          {F("DISCOM", "discom", "e.g. TSSPDCL")}
          {S("Phase", "phase", PHASE_OPTIONS, "Select phase")}
        </div>
      </section>

      {/* 3. Electricity Consumption */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">3. Electricity Consumption</h5>
        <div className="lsv-grid">
          {F("Average Monthly Bill (₹)", "monthlyBill", "e.g. 4500")}
          <ValueUnit label="Average Monthly Consumption" value={form.monthlyConsumptionUnits}
            onChange={v => setForm(p => ({ ...p, monthlyConsumptionUnits: v }))} placeholder="e.g. 600" />
        </div>
      </section>

      {/* 4. Site Location */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">4. Site Location</h5>
        <LocationPicker
          address={form.siteAddress}
          lat={form.siteLat}
          lng={form.siteLng}
          onChange={({ address, lat, lng }) => setForm(p => ({
            ...p,
            ...(address !== undefined ? { siteAddress: address } : {}),
            ...(lat !== undefined ? { siteLat: lat == null ? "" : String(lat) } : {}),
            ...(lng !== undefined ? { siteLng: lng == null ? "" : String(lng) } : {}),
          }))}
          showError={(m) => setErr(m)}
        />
      </section>

      {/* 5. Roof Details */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">5. Roof Details</h5>
        <div className="lsv-grid">
          {S("Roof Type", "roofType", ROOF_TYPES, "Select roof type")}
          <ValueUnit label="Shadow Free Area" value={form.shadowFreeArea}
            onChange={v => setForm(p => ({ ...p, shadowFreeArea: v }))} placeholder="e.g. 500" units={AREA_UNITS} defaultUnit="Sqft" />
          {F("Roof Condition", "roofCondition")}
          {F("Roof Direction", "roofDirection", "e.g. South")}
          {F("Roof Tilt", "roofTilt", "e.g. 10°")}
          {S("Accessibility", "accessibility", ACCESSIBILITY_OPTIONS, "Select accessibility")}
        </div>
      </section>

      {/* 6. Shadow Analysis */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">6. Shadow Analysis</h5>
        <div className="lsv-radios">
          {SHADOW_OPTS.map(o => (
            <label key={o.v} className={`lsv-radio ${form.shadowAnalysis === o.v ? "active" : ""}`}>
              <input type="radio" name="shadowAnalysis" value={o.v}
                checked={form.shadowAnalysis === o.v}
                onChange={() => setForm(p => ({ ...p, shadowAnalysis: o.v }))} />
              {o.l}
            </label>
          ))}
        </div>
        <label className="lsv-field lsv-field--full">
          <span>Remarks</span>
          <textarea rows={2} value={form.shadowRemarks} onChange={set("shadowRemarks")} />
        </label>
      </section>

      {/* 7. Installation Details */}
      <section className="lsv-section">
        <h5 className="lsv-section-title">7. Installation Details</h5>
        <div className="lsv-grid">
          {S("Inverter Location", "inverterLocation", INVERTER_LOCATIONS, "Select location")}
          <ValueUnit label="AC Cable Length" value={form.acCableLength}
            onChange={v => setForm(p => ({ ...p, acCableLength: v }))} placeholder="e.g. 10" units={LENGTH_UNITS} defaultUnit="Meter" />
          <ValueUnit label="DC Cable Length" value={form.dcCableLength}
            onChange={v => setForm(p => ({ ...p, dcCableLength: v }))} placeholder="e.g. 20" units={LENGTH_UNITS} defaultUnit="Meter" />
          {S("Earthing Location", "earthingLocation", EARTHING_LOCATIONS, "Select location")}
          {S("Structure Type", "structureType", STRUCTURE_TYPES, "Select structure")}
          {S("Module Orientation", "moduleOrientation", MODULE_ORIENTATIONS, "Select orientation")}
        </div>
      </section>

      {err && <div className="lsv-error">{err}</div>}

      <div className="lsv-form-footer">
        {!hideCancel && <button type="button" className="lsv-btn-sec" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="lsv-btn-primary" disabled={saving}>
          {saving ? "Saving…" : (isEdit ? "Update Report" : "Save Site Visit Report")}
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ASSIGN SITE VISIT MODAL  →  creates a `Visit` follow-up
// ═══════════════════════════════════════════════════════════════════════════════
function AssignModal({ lead, currentUser, users: usersProp, onAssigned, onCancel }) {
  const now = new Date(Date.now() + 60 * 60000);
  const defaultDT = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [assignedTo, setAssignedTo] = useState(String(currentUser?.id || ""));
  const [scheduledAt, setScheduledAt] = useState(defaultDT);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Fetch the assignable users the same way the follow-ups tab does
  // (GET /filters/followup-assignees). Seeded from the prop so there's no flash,
  // then refreshed on open so the list is always complete.
  const [users, setUsers] = useState(Array.isArray(usersProp) ? usersProp : []);
  useEffect(() => {
    api.get("/filters/followup-assignees")
      .then(data => { if (Array.isArray(data) && data.length) setUsers(data); })
      .catch(() => {});
  }, []);

  const submit = async e => {
    e.preventDefault();
    if (!assignedTo) { setErr("Please choose who will visit"); return; }
    if (!scheduledAt) { setErr("Please choose the visit date & time"); return; }
    setSaving(true); setErr("");
    try {
      const dt = scheduledAt.replace("T", " ") + ":00";
      const res = await api.post("/followups/create", {
        relatedType:  "LEAD",
        relatedId:    lead.id,
        leadId:       lead.id,
        groupName:    lead.groupName || null,
        subGroupName: lead.subGroupName || null,
        followupType: "Visit",
        scheduledAt:  dt,
        priority:     "Medium",
        status:       "Pending",
        notes:        notes.trim() || "Site visit — fill the Site Visit Report after visiting.",
        assignedTo:   parseInt(assignedTo),
      });
      if (res?.success) onAssigned?.();
      else setErr(res?.message || "Failed to assign");
    } catch (e2) {
      if (e2.message !== "SESSION_EXPIRED") setErr(e2.message || "Failed to assign");
    } finally { setSaving(false); }
  };

  return (
    <div className="lsv-modal-overlay">
      <div className="lsv-modal">
        <div className="lsv-modal-head">
          <h5>Assign Site Visit</h5>
          <button className="lsv-icon-close" onClick={onCancel}>✕</button>
        </div>
        <form className="lsv-modal-body" onSubmit={submit}>
          <p className="lsv-modal-hint">
            This creates a <b>Visit</b> follow-up for the selected user. They will be notified and can
            fill the Site Visit Report from their <b>My Follow-ups</b> page — no full access to this lead is granted.
          </p>
          <label className="lsv-field">
            <span>Assign To *</span>
            <FilterSelect
              value={assignedTo}
              onChange={v => setAssignedTo(v)}
              options={users.map(u => ({ value: String(u.id), label: u.name + (u.id === currentUser?.id ? " (Me)" : "") }))}
              placeholder="Select User"
            />
          </label>
          <label className="lsv-field">
            <span>Visit Date &amp; Time *</span>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </label>
          <label className="lsv-field lsv-field--full">
            <span>Notes</span>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="E.g. Check roof area, south-facing, confirm system size…" />
          </label>
          {err && <div className="lsv-error">{err}</div>}
          <div className="lsv-form-footer">
            <button type="button" className="lsv-btn-sec" onClick={onCancel}>Cancel</button>
            <button type="submit" className="lsv-btn-primary" disabled={saving}>
              {saving ? "Assigning…" : "🏠 Assign Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN TAB
// ═══════════════════════════════════════════════════════════════════════════════
export default function LeadSiteVisitTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const [report, setReport] = useState(null);   // the single report for this lead (or null)
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/site-visits/lead/${lead.id}`);
      if (res?.success) setReport((res.data && res.data[0]) || null);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError?.("Failed to load site visit");
    } finally { setLoading(false); }
  }, [lead.id, showError]);

  useEffect(() => {
    load();
    api.get("/filters/followup-assignees")
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [load]);

  // NOTE: no window-focus reload here — the form is remounted only when the
  // report identity changes (key below), so switching tabs/windows never wipes
  // unsaved edits. A report saved elsewhere is picked up when the tab remounts.

  return (
    <div className="lsv">
      {/* Header */}
      <div className="lsv-head">
        <div className="lsv-head-left">
          <h4 className="lsv-heading">Site Visit Report</h4>
          {report && (
            <span className="lsv-recorded">
              Last updated by {report.visitedByName || "—"}
              {report.visitDate ? ` · ${fmtDate(report.visitDate)}` : ""}
            </span>
          )}
        </div>
        <div className="lsv-head-actions">
          <button className="lsv-btn-sec" onClick={() => setShowAssign(true)}>👤 Assign Site Visit</button>
        </div>
      </div>

      {/* The single report — open by default, editable inline */}
      {loading ? (
        <div className="lsv-empty">Loading…</div>
      ) : (
        <SiteVisitForm
          key={report?.id ?? 'new'}
          lead={lead}
          visit={report}
          currentUser={currentUser}
          hideCancel
          onSaved={() => { const wasEdit = !!report; load(); onRefreshLead?.(); showSuccess?.(wasEdit ? "Site visit report updated" : "Site visit report saved"); }}
        />
      )}

      {/* Assign modal */}
      {showAssign && (
        <AssignModal
          lead={lead}
          currentUser={currentUser}
          users={users}
          onAssigned={() => { setShowAssign(false); showSuccess?.("Site visit assigned"); onRefreshLead?.(); }}
          onCancel={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}