// ─────────────────────────────────────────────────────────────────────────────
//  LeadTechnicalScopeTab — "Technical Scope" for a lead.
//
//  Step 1 of the estimation flow:  Scope → BOM → Budget Estimation.
//
//  • Section A: scope header (project type, capacity, site location, scope of
//    work, technical notes). Group / Sub-group shown read-only from the lead.
//    "Pull from site visit" fills location/capacity from the site visit report.
//  • Section B: the scope of work — WHICH activities we will do, chosen from a
//    dropdown. Deliberately NO dates, NO sub-items, NO weights, NO prices:
//    scheduling belongs to the project once the lead is won, materials belong
//    to the BOM tab, and money belongs to Budget Estimation.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import './LeadCardHead.css';
import { Wand2, Plus, Save, Trash2, Download, ClipboardList, ListChecks } from "lucide-react";
import api from "../../services/leadsapi.js";
import ConfirmationModal from "../ConfirmationModal.js";
import useConfirmationModal from "../HandleConfirmationModal.js";
import {
  ACTIVITY_SUGGESTIONS, DEFAULT_EPC_SCOPE, UNIT_SUGGESTIONS, OTHER_OPTION,
  SUGGESTION_WARNING_LABELS,
} from "../../constants/scopeActivities.js";
import "./LeadTechnicalScopeTab.css";

const emptyHeader = {
  projectType: "",
  systemCapacity: "",
  siteLocation: "",
  scopeOfWork: "",
  technicalNotes: "",
};

const blankRow = () => ({
  id: null, activity: "", specification: "", quantity: "", unit: "kW", customName: false,
});

export default function LeadTechnicalScopeTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [header, setHeader] = useState(emptyHeader);
  const [rows, setRows] = useState([]);
  const [extraSuggestions, setExtraSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingRows, setSavingRows] = useState(false);
  const [pullingVisit, setPullingVisit] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState(null); // {source, sourceCapacity, warnings}
  const [hasTemplate, setHasTemplate] = useState(false); // a template exists for this project type
  // Only a row the user just switched to "type your own" should autofocus —
  // focusing rows loaded from the backend scrolls the tab past its own top.
  const [focusRow, setFocusRow] = useState(null);

  const { confirmModal, showConfirmation } = useConfirmationModal();

  const groupName = lead?.groupName ?? lead?.group ?? "—";
  const subGroupName = lead?.subGroupName ?? lead?.subGroup ?? "—";

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  // Built-in activities + names other users have typed before (shared, backend).
  const activityOptions = React.useMemo(() => {
    const merged = [...ACTIVITY_SUGGESTIONS];
    extraSuggestions.forEach(n => {
      if (n && !merged.some(m => m.toLowerCase() === n.toLowerCase())) merged.push(n);
    });
    return merged;
  }, [extraSuggestions]);

  // Read the lead's latest site visit report (the endpoint returns a list; a lead
  // has at most one). Used to pre-fill Site Location and System Capacity.
  const fetchSiteVisit = useCallback(async () => {
    try {
      const res = await api.get(`/site-visits/lead/${lead.id}`);
      return Array.isArray(res?.data) ? res.data[0] : null;
    } catch { return null; }
  }, [lead.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${lead.id}/scope`);
      if (res?.success) {
        const h = res.data?.header || {};
        let siteLocation = h.siteLocation ?? "";
        let systemCapacity = h.systemCapacity ?? "";

        // Auto-fill Site Location and System Capacity from the site visit report
        // when they haven't been set yet — a saved value always wins. Capacity is
        // taken from the site visit's sanctioned load.
        if (!siteLocation || !systemCapacity) {
          const v = await fetchSiteVisit();
          if (v) {
            if (!siteLocation) siteLocation = v.siteAddress || "";
            if (!systemCapacity) systemCapacity = v.sanctionedLoad || "";
          }
        }

        setHeader({
          // The sub-group IS the project type in this system (e.g. Solar_Rooftop),
          // so it's a sensible default — but a saved value always wins.
          projectType: h.projectType || lead?.subGroupName || "",
          systemCapacity,
          siteLocation,
          scopeOfWork: h.scopeOfWork ?? "",
          technicalNotes: h.technicalNotes ?? "",
        });
        setRows((res.data?.items || []).map(it => ({
          id: it.id,
          activity: it.activity || "",
          specification: it.specification || "",
          quantity: it.quantity ?? "",
          unit: it.unit || "",
          customName: false, // resolved against the dropdown at render time
        })));
      }
    } catch (e) {
      fail("Failed to load technical scope", e);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead?.subGroupName, fetchSiteVisit]);

  useEffect(() => { load(); }, [load]);

  // Shared, user-contributed activity names. The endpoint returns
  // {success, data:{names:[...]}} — not a bare array.
  useEffect(() => {
    api.get("/order-book/scope-activities")
      .then(res => {
        if (Array.isArray(res?.data?.names)) setExtraSuggestions(res.data.names);
      })
      .catch(() => {});
  }, []);

  // Does a template exist for this lead's project type? Drives the Load button.
  useEffect(() => {
    api.get(`/leads/${lead.id}/scope/template-info`)
      .then(res => setHasTemplate(!!res?.data?.hasTemplate))
      .catch(() => {});
  }, [lead.id]);

  // Persist a user-typed name so it shows in the dropdown next time, for everyone.
  const registerActivity = (name) => {
    const n = (name || "").trim();
    if (!n || activityOptions.some(m => m.toLowerCase() === n.toLowerCase())) return;
    setExtraSuggestions(prev => (prev.includes(n) ? prev : [...prev, n]));
    api.post("/order-book/scope-activities", { name: n }).catch(() => {});
  };

  // ── Header ─────────────────────────────────────────────────────────────────
  const setH = k => e => setHeader(p => ({ ...p, [k]: e.target.value }));

  const saveHeader = async () => {
    if (!canEdit) return;
    setSavingHeader(true);
    try {
      const res = await api.post(`/leads/${lead.id}/scope`, {
        projectType: header.projectType.trim() || null,
        systemCapacity: header.systemCapacity.trim() || null,
        siteLocation: header.siteLocation.trim() || null,
        scopeOfWork: header.scopeOfWork.trim() || null,
        technicalNotes: header.technicalNotes.trim() || null,
      });
      if (res?.success) {
        showSuccess?.("Technical scope saved");
        onRefreshLead?.();
      } else {
        showError?.(res?.message || "Failed to save scope");
      }
    } catch (e) {
      fail("Failed to save scope", e);
    } finally { setSavingHeader(false); }
  };

  // Overwrite Site Location and System Capacity from the site visit report —
  // location from the site address, capacity from the sanctioned load. Unlike the
  // auto-fill on load (blanks only), this button refreshes even saved values.
  const pullFromSiteVisit = async () => {
    setPullingVisit(true);
    try {
      const v = await fetchSiteVisit();
      if (!v) { showError?.("No site visit report found for this lead."); return; }
      setHeader(p => ({
        ...p,
        siteLocation: v.siteAddress || p.siteLocation,
        systemCapacity: v.sanctionedLoad || p.systemCapacity,
        projectType: p.projectType || v.propertyType || "",
      }));
      showSuccess?.("Pulled Site Location and System Capacity from the site visit. Review, then Save Scope.");
    } catch (e) {
      fail("Failed to read the site visit report", e);
    } finally { setPullingVisit(false); }
  };

  // ── Scope rows ─────────────────────────────────────────────────────────────
  const updateRow = (i, field, val, extra) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, [field]: val, ...(extra || {}) } : r)));

  const addRow = () => setRows(prev => [...prev, blankRow()]);

  const removeRow = (i) => { setFocusRow(null); setRows(prev => prev.filter((_, idx) => idx !== i)); };

  const suggestEpcScope = async () => {
    if (rows.length) {
      const ok = await showConfirmation({
        title: "Replace scope", type: "alert",
        message: "This replaces the current scope lines with the standard EPC scope. Continue?",
        confirmText: "Yes, Replace", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setRows(DEFAULT_EPC_SCOPE.map(name => ({ ...blankRow(), activity: name })));
  };

  // Suggest a scope from the project type + capacity. A curated template wins;
  // else a similar past job. Pre-fills the editable rows — user reviews and saves.
  const suggestScope = async () => {
    if (rows.length) {
      const ok = await showConfirmation({
        title: "Replace scope", type: "alert",
        message: "This replaces the current scope lines with a suggestion from this project type and capacity. Continue?",
        confirmText: "Yes, Suggest", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setSuggesting(true);
    try {
      const res = await api.get(`/leads/${lead.id}/scope/suggest`, { params: { target: "scope" } });
      if (!res?.success) { showError?.(res?.message || "Failed to suggest scope"); return; }
      const d = res.data || {};
      const items = Array.isArray(d.scopeItems) ? d.scopeItems : [];
      if (!items.length && d.source === "NONE") {
        setSuggestNote({ source: "NONE", warnings: d.warnings || [] });
        showError?.("No template or similar past job for this project type yet.");
        return;
      }
      setRows(items.map(it => ({
        ...blankRow(),
        activity: it.activity || "",
        specification: it.specification || "",
        quantity: it.quantity ?? "",
        unit: it.unit || "",
      })));
      setSuggestNote({ source: d.source, sourceCapacity: d.sourceCapacity, warnings: d.warnings || [] });
      showSuccess?.(
        d.source === "MINED"
          ? `Suggested from a similar ${d.sourceCapacity || ""} job. Review and save.`
          : "Suggested from the standard template. Review and save."
      );
    } catch (e) {
      fail("Failed to suggest scope", e);
    } finally { setSuggesting(false); }
  };

  const saveRows = async () => {
    if (!canEdit) return;
    for (const r of rows) {
      if (!(r.activity || "").trim()) { showError?.("Every scope line needs an activity"); return; }
    }
    setSavingRows(true);
    try {
      const res = await api.put(`/leads/${lead.id}/scope/items`, {
        items: rows.map((r, i) => ({
          id: r.id ?? null,
          seqNo: i + 1,
          activity: r.activity.trim(),
          specification: (r.specification || "").trim() || null,
          quantity: r.quantity === "" || r.quantity == null ? null : Number(r.quantity),
          unit: (r.unit || "").trim() || null,
        })),
      });
      if (res?.success) {
        showSuccess?.("Scope of work saved");
        await load();
        onRefreshLead?.();
      } else {
        showError?.(res?.message || "Failed to save scope of work");
      }
    } catch (e) {
      fail("Failed to save scope of work", e);
    } finally { setSavingRows(false); }
  };

  if (loading) return <div className="lts-loading"><span className="lts-spinner" /> Loading…</div>;

  return (
    <div className="lts">
      <ConfirmationModal {...confirmModal} />

      {/* ── Section A: Scope header ─────────────────────────────────────────── */}
      <div className="lts-card">
        <div className="lts-card-head">
          <span className="lead-card-ico"><ClipboardList size={17} strokeWidth={2} /></span><h4 className="lts-card-title">Scope Overview</h4>
          {canEdit && (
            <button className="lts-btn-ghost" onClick={pullFromSiteVisit} disabled={pullingVisit}
              title="Fill location and capacity from this lead's site visit report">
              <Download size={13} /> {pullingVisit ? "Pulling…" : "Pull from site visit"}
            </button>
          )}
          <span className="lts-flow-badge">↳ Flows to proposal</span>
        </div>

        <div className="lts-grid">
          <label className="lts-field">
            <span>Project Type</span>
            <input value={header.projectType} onChange={setH("projectType")} disabled={!canEdit}
              placeholder="e.g. Rooftop Solar / Ground Mount" />
          </label>
          <label className="lts-field">
            <span>System Capacity</span>
            <input value={header.systemCapacity} onChange={setH("systemCapacity")} disabled={!canEdit}
              placeholder="e.g. 100 kW (from sanctioned load)" />
          </label>
          <label className="lts-field">
            <span>Site Location</span>
            <input value={header.siteLocation} onChange={setH("siteLocation")} disabled={!canEdit}
              placeholder="e.g. Plant-2, Hyderabad" />
          </label>
          <div className="lts-ro"><span>Group</span><b>{groupName}</b></div>
          <div className="lts-ro"><span>Sub-group</span><b>{subGroupName}</b></div>
        </div>

        <label className="lts-field lts-field--full">
          <span>Scope of Work</span>
          <textarea rows={4} value={header.scopeOfWork} onChange={setH("scopeOfWork")} disabled={!canEdit}
            placeholder="Describe the overall scope of work for this project…" />
        </label>

        <label className="lts-field lts-field--full">
          <span>Technical Notes / Exclusions</span>
          <textarea rows={3} value={header.technicalNotes} onChange={setH("technicalNotes")} disabled={!canEdit}
            placeholder="Assumptions, exclusions, special technical notes…" />
        </label>

        {canEdit && (
          <div className="lts-card-foot">
            <button className="lts-btn-primary" onClick={saveHeader} disabled={savingHeader}>
              {savingHeader ? "Saving…" : "Save Scope"}
            </button>
          </div>
        )}
      </div>

      {/* ── Section B: Scope of work ────────────────────────────────────────── */}
      <div className="lts-card">
        <div className="lts-card-head">
          <span className="lead-card-ico"><ListChecks size={17} strokeWidth={2} /></span><h4 className="lts-card-title">Scope of Work</h4>
          <span className="lts-count-pill">{rows.length}</span>
          {canEdit && (
            <div className="lts-head-actions">
              {hasTemplate ? (
                // A template exists for this project type → load it (the standard).
                <button className="lts-btn-ghost lts-btn-accent" onClick={suggestScope} disabled={suggesting}
                  title="Load the standard scope template for this project type">
                  <Wand2 size={13} /> {suggesting ? "Loading…" : "Load template"}
                </button>
              ) : (
                <>
                  <button className="lts-btn-ghost" onClick={suggestScope} disabled={suggesting}
                    title="Suggest a scope from a similar past job of this project type">
                    <Wand2 size={13} /> {suggesting ? "Suggesting…" : "Suggest scope"}
                  </button>
                  <button className="lts-btn-ghost" onClick={suggestEpcScope}
                    title="Fill with the standard EPC activity list">
                    <Wand2 size={13} /> Standard EPC
                  </button>
                </>
              )}
              <button className="lts-btn-ghost" onClick={addRow}><Plus size={13} /> Add row</button>
            </div>
          )}
        </div>

        {suggestNote && suggestNote.source && suggestNote.source !== "NONE" && (
          <div className="lts-suggest-note">
            {suggestNote.source === "MINED"
              ? `Suggested from a similar ${suggestNote.sourceCapacity || ""} job — review before saving.`
              : "Suggested from the standard template — review before saving."}
          </div>
        )}
        {suggestNote?.warnings?.length > 0 && (
          <div className="lts-suggest-warn">
            {suggestNote.warnings.map((w, i) => (
              <div key={i}>⚠ {SUGGESTION_WARNING_LABELS[w.code] || w.message}</div>
            ))}
          </div>
        )}

        <div className="lts-table-wrap">
          <table className="lts-table">
            <thead>
              <tr>
                <th className="lts-col-num">#</th>
                <th>Activity / Item</th>
                <th>Description</th>
                <th className="lts-col-qty">Qty</th>
                <th className="lts-col-unit">Unit</th>
                {canEdit && <th className="lts-col-act" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="lts-empty">
                    No scope lines yet. Use "Suggest EPC scope" or "Add row" to begin.
                  </td>
                </tr>
              )}

              {rows.map((row, i) => {
                // A stored name that isn't in the dropdown still selects cleanly —
                // it's offered as its own option rather than dumped into free text.
                const known = activityOptions.includes(row.activity);
                return (
                  <tr key={row.id ?? `new-${i}`}>
                    <td className="lts-col-num">{i + 1}</td>
                    <td>
                      {row.customName ? (
                        <div className="lts-custom">
                          <input className="lts-inp" value={row.activity} autoFocus={focusRow === i}
                            placeholder="Enter activity name" disabled={!canEdit}
                            onChange={e => updateRow(i, "activity", e.target.value)}
                            onBlur={e => registerActivity(e.target.value)} />
                          <button type="button" className="lts-custom-back" title="Back to list"
                            disabled={!canEdit}
                            onClick={() => { setFocusRow(null); updateRow(i, "customName", false, { activity: "" }); }}>↩</button>
                        </div>
                      ) : (
                        <select className="lts-inp" value={row.activity} disabled={!canEdit}
                          onChange={e => {
                            if (e.target.value === OTHER_OPTION) {
                              setFocusRow(i);
                              updateRow(i, "customName", true, { activity: "" });
                            } else updateRow(i, "activity", e.target.value);
                          }}>
                          <option value="">Select activity / item…</option>
                          {!known && row.activity && <option value={row.activity}>{row.activity}</option>}
                          {activityOptions.map(a => <option key={a} value={a}>{a}</option>)}
                          <option value={OTHER_OPTION}>Other (type your own)…</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <input className="lts-inp" value={row.specification} disabled={!canEdit}
                        onChange={e => updateRow(i, "specification", e.target.value)} placeholder="Optional" />
                    </td>
                    <td className="lts-col-qty">
                      <input className="lts-inp" type="number" min="0" step="any" value={row.quantity}
                        disabled={!canEdit}
                        onChange={e => updateRow(i, "quantity", e.target.value)} placeholder="—" />
                    </td>
                    <td className="lts-col-unit">
                      <select className="lts-inp" value={row.unit} disabled={!canEdit}
                        onChange={e => updateRow(i, "unit", e.target.value)}>
                        <option value="">—</option>
                        {!UNIT_SUGGESTIONS.includes(row.unit) && row.unit && (
                          <option value={row.unit}>{row.unit}</option>
                        )}
                        {UNIT_SUGGESTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    {canEdit && (
                      <td className="lts-col-act">
                        <button className="lts-icon-del" title="Remove row" onClick={() => removeRow(i)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className="lts-card-foot">
            <button className="lts-btn-primary" onClick={saveRows} disabled={savingRows}>
              <Save size={13} /> {savingRows ? "Saving…" : "Save Scope of Work"}
            </button>
          </div>
        )}

        <p className="lts-hint">
          What we will do — no dates or costs here. Materials for this scope are prepared in the BOM tab,
          and priced in Budget Estimation.
        </p>
      </div>
    </div>
  );
}
