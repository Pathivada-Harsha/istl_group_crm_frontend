// ─────────────────────────────────────────────────────────────────────────────
//  ProjectPlannedBomTab — the BOM exactly AS PLANNED, and the editor for it.
//
//  This is the "Planned BOM" sub-tab of the project BOM tab: the BOM as entered,
//  with NO actual figures anywhere. What was procured against each line lives on
//  the Comparison and Procured sub-tabs (see ProjectBomTab.js, which owns the tab
//  bar) — mixing them here would mean a buyer editing a quantity while looking at
//  a number that came from a purchase order.
//
//  Materials are grouped into sections — one per technical-scope line
//  (project_phases parent phase), plus a "General / Unassigned" section — and a
//  material added under a section links to that scope line
//  (project_bom.scope_item_id → project_phases.id).
//
//  Reuses the Leads BOM styling (lbm-*), the shared catalog autocomplete, and the
//  same capacity/basis auto-sizing (mirrors backend LeadSuggestionEngine). Rates
//  are gated: when the API returns canSeeRates=false (field-staff access), the
//  Unit Price / Amount columns and totals are hidden — quantities/specs stay.
//
//  Scope is decided first (Scope / SOW tab); this tab hangs BOM off those lines.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Wand2, Plus, Save, Trash2, Download, Upload } from "lucide-react";
import projectsApi from "../../services/projectsApi.js";
import ConfirmationModal from "../ConfirmationModal.js";
import useConfirmationModal from "../HandleConfirmationModal.js";
import UnitSelectCell from "../Dropdowns/UnitSelectCell.js";
import ItemNameAutocomplete from "../OrderBook/ItemNameAutocomplete.js";
import { downloadStyledTemplate, readSheetRows, cell } from "../Leads/bomExcel.js";
import { SUGGESTION_WARNING_LABELS } from "../../constants/scopeActivities.js";
import "../Leads/LeadBomTab.css";

const BOM_TEMPLATE_COLUMNS = [
  { header: "Component", width: 28 }, { header: "Specifications", width: 24 },
  { header: "Make", width: 16 }, { header: "Qty", width: 10 }, { header: "Units", width: 10 },
  { header: "Unit Price", width: 13 }, { header: "Notes", width: 24 },
];
const BOM_TEMPLATE_SAMPLE = ["Solar Module 550Wp", "Mono PERC Bifacial", "Adani", 60, "Nos", 10000, ""];

const fmtINR = n => Number(Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const lineAmount = l => (Number(l.quantity) || 0) * (Number(l.unitRate) || 0);
const variantLabel = v => [v?.make, v?.model].filter(Boolean).join(" ").trim();

const GENERAL = "__general__";

// ── Make-driven auto-sizing (mirrors backend LeadSuggestionEngine) ───────────
const RECALC_BASES = new Set([
  "FIXED", "PER_KW", "PER_STEP", "PER_WATT_PEAK", "PER_INVERTER_KW", "PER_MODULE", "PER_INVERTER",
]);
const round3n = n => Math.round((Number(n) || 0) * 1000) / 1000;
const driverKeyForBasis = b =>
  b === "PER_WATT_PEAK" ? "wattage" : b === "PER_INVERTER_KW" ? "capacity" : null;

const driverValueOf = (l) => {
  const key = driverKeyForBasis(l.basis);
  if (!key) return null;
  const v = (l.variants || []).find(x => String(x.variantId) === String(l.variantId));
  const raw = v?.attributeValues?.[key];
  let n = raw != null && raw !== ""
    ? Number(raw)
    : (l.driverAttr != null && l.driverAttr !== "" ? Number(l.driverAttr) : NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const autoBasisHint = (l) => ({
  PER_WATT_PEAK: "Auto: module count = ceil(kW×1000 ÷ make wattage)",
  PER_INVERTER_KW: "Auto: inverter count = ceil(kW ÷ make kW)",
  PER_MODULE: "Auto: scales with the module count",
  PER_INVERTER: "Auto: scales with the inverter count",
  PER_KW: "Auto: quantity = factor × capacity (kW)",
  PER_STEP: "Auto: one unit per N kW",
  FIXED: "Auto: fixed quantity",
}[l.basis] || "Auto-calculated");

// Re-derive every auto line's quantity from capacity (kW) and the chosen makes.
const recompute = (rows, kw) => {
  const K = Number(kw);
  const hasKw = Number.isFinite(K) && K > 0;
  const draft = rows.map(l => ({ ...l }));

  let moduleCount = null, inverterCount = null;
  for (const l of draft) {
    if (l.basis !== "PER_WATT_PEAK" && l.basis !== "PER_INVERTER_KW") continue;
    if (l.autoQty !== false) {
      l._flags = [];
      const d = driverValueOf(l);
      if (!hasKw) { l._flags.push("NEEDS_CAPACITY"); l.quantity = ""; }
      else if (d == null) { l._flags.push(l.basis === "PER_WATT_PEAK" ? "NEEDS_MODULE_WATT" : "NEEDS_INVERTER_KW"); l.quantity = ""; }
      else l.quantity = l.basis === "PER_WATT_PEAK" ? Math.ceil((K * 1000) / d) : Math.ceil(K / d);
    }
    const n = Number(l.quantity);
    if (Number.isFinite(n) && n > 0) {
      if (l.basis === "PER_WATT_PEAK") moduleCount = (moduleCount || 0) + n;
      else inverterCount = (inverterCount || 0) + n;
    }
  }
  for (const l of draft) {
    if (l.basis === "PER_WATT_PEAK" || l.basis === "PER_INVERTER_KW") continue;
    if (l.autoQty === false || !RECALC_BASES.has(l.basis)) continue;
    l._flags = [];
    const bv = Number(l.basisValue) || 0, sv = Number(l.stepValue) || 0;
    switch (l.basis) {
      case "FIXED": l.quantity = round3n(bv); break;
      case "PER_KW": if (hasKw) l.quantity = round3n(bv * K); else { l._flags.push("NEEDS_CAPACITY"); l.quantity = ""; } break;
      case "PER_STEP": if (hasKw && sv > 0) l.quantity = Math.ceil(K / sv); else { l._flags.push("NEEDS_CAPACITY"); l.quantity = ""; } break;
      case "PER_MODULE": if (moduleCount != null) l.quantity = Math.ceil(bv * moduleCount); else { l._flags.push("NEEDS_MODULE_DRIVER"); l.quantity = ""; } break;
      case "PER_INVERTER": if (inverterCount != null) l.quantity = Math.ceil(bv * inverterCount); else { l._flags.push("NEEDS_INVERTER_DRIVER"); l.quantity = ""; } break;
      default: break;
    }
  }
  draft.forEach(l => { l._review = Array.isArray(l._flags) && l._flags.length > 0; });
  return draft;
};

const blankLine = (scopeItemId = "") => ({
  _key: `n${Math.random().toString(36).slice(2)}`,
  id: null, scopeItemId, category: "", itemName: "", make: "",
  specification: "", unit: "kW", quantity: "", unitRate: "", notes: "",
  bomItemId: null, variantId: null, variants: [],
  basis: null, basisValue: null, stepValue: null, siteVisitField: null,
  driverAttr: null, autoQty: true,
  _flags: [], _review: false,
});

export default function ProjectPlannedBomTab({ projectUniqueId, project, currentUser, permissions, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [lines, setLines] = useState([]);
  const [scopeItems, setScopeItems] = useState([]); // parent phases: { id, activity }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [sourceNote, setSourceNote] = useState(null);
  const [capacityKw, setCapacityKw] = useState(null);
  const [canSeeRates, setCanSeeRates] = useState(true); // gated by backend access level

  const { confirmModal, showConfirmation } = useConfirmationModal();
  const fileInputRef = useRef(null);

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bomRes, scopeRes] = await Promise.all([
        projectsApi.getBom(projectUniqueId),
        projectsApi.getScope(projectUniqueId),
      ]);
      if (bomRes?.success) {
        setCapacityKw(bomRes.data?.capacityKw ?? null);
        setCanSeeRates(bomRes.data?.canSeeRates !== false);
        const mapped = (bomRes.data?.lines || []).map(l => ({
          ...blankLine(l.scopeItemId ?? ""),
          id: l.id,
          category: l.category || "",
          itemName: l.itemName || "",
          make: l.make || "",
          specification: l.specification || "",
          unit: l.unit || "",
          quantity: l.quantity ?? "",
          unitRate: l.unitRate ?? "",
          notes: l.notes || "",
          bomItemId: l.bomItemId ?? null,
          variantId: l.variantId ?? null,
          variants: Array.isArray(l.variants) ? l.variants : [],
          basis: l.basis ?? null,
          basisValue: l.basisValue ?? null,
          stepValue: l.stepValue ?? null,
          siteVisitField: l.siteVisitField ?? null,
          driverAttr: l.driverAttr ?? null,
          autoQty: l.autoQty !== false,
        }));
        setLines(mapped); // no recompute on load — saved quantities stay as-saved
      }
      // Scope items for a project are the parent phases (project_phases).
      if (scopeRes?.success) {
        const phases = scopeRes.data?.phases || [];
        setScopeItems(phases.map(p => ({
          id: p.id, activity: p.phaseName || "(unnamed activity)", specification: p.phaseDescription || "",
        })));
      }
      setWarnings([]); setSourceNote(null);
    } catch (e) {
      fail("Failed to load BOM", e);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUniqueId]);

  useEffect(() => { load(); }, [load]);

  const changeCapacity = (raw) => {
    const kw = raw === "" || raw == null ? null : Number(raw);
    setCapacityKw(kw);
    setLines(prev => recompute(prev, kw));
  };

  const updLine = (key, field, val) =>
    setLines(prev => prev.map(l => (l._key === key ? { ...l, [field]: val } : l)));
  const removeLine = (key) => setLines(prev => prev.filter(l => l._key !== key));
  const addLineTo = (scopeItemId) => setLines(prev => [...prev, blankLine(scopeItemId)]);

  const pickVariant = (key, variantId) => setLines(prev => recompute(prev.map(l => {
    if (l._key !== key) return l;
    const v = (l.variants || []).find(x => String(x.variantId) === String(variantId));
    if (!v) return { ...l, variantId: null };
    const label = variantLabel(v);
    const dk = driverKeyForBasis(l.basis);
    const nextDriver = dk && v.attributeValues && v.attributeValues[dk] != null && v.attributeValues[dk] !== ""
      ? Number(v.attributeValues[dk]) : l.driverAttr;
    const nextSpec = v.spec || v.description || l.specification;
    return { ...l, variantId: v.variantId, make: label || l.make, specification: nextSpec, driverAttr: nextDriver };
  }), capacityKw));

  const editQty = (key, val) =>
    setLines(prev => prev.map(l => (l._key === key ? { ...l, quantity: val, autoQty: false } : l)));
  const reAuto = (key) =>
    setLines(prev => recompute(prev.map(l => (l._key === key ? { ...l, autoQty: true } : l)), capacityKw));

  const scopeIdByActivity = (name) => {
    if (!name) return "";
    const hit = scopeItems.find(s => (s.activity || "").trim().toLowerCase() === name.trim().toLowerCase());
    return hit ? hit.id : "";
  };

  const generateFromScope = async () => {
    if (!scopeItems.length) {
      showError?.("No scope lines to generate from. Add them in the Scope / SOW tab first.");
      return;
    }
    if (lines.length > 0) {
      const ok = await showConfirmation({
        title: "Replace BOM", type: "alert",
        message: `This replaces the current ${lines.length} line(s) with one blank line per scope activity. Continue?`,
        confirmText: "Yes, Replace", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setLines(scopeItems.map(it => ({
      ...blankLine(it.id),
      itemName: it.activity || "",
      specification: it.specification || "",
    })));
    setWarnings([]); setSourceNote(null);
    showSuccess?.("Seeded one line per scope activity. Add materials and rates, then Save.");
  };

  const downloadTemplate = () =>
    downloadStyledTemplate(BOM_TEMPLATE_COLUMNS, BOM_TEMPLATE_SAMPLE, "BOM", "project_bom_template.xlsx");

  const importTargetRef = useRef("");
  const startImport = (scopeItemId) => { importTargetRef.current = scopeItemId; fileInputRef.current?.click(); };

  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const scopeItemId = importTargetRef.current;
    try {
      const rows = await readSheetRows(file);
      if (!rows.length) { showError?.("The file has no data rows."); return; }
      const mapped = rows.map(r => ({
        ...blankLine(scopeItemId),
        itemName: String(cell(r, "Component", "Item", "Item Name")).trim(),
        specification: String(cell(r, "Specifications", "Specification")).trim(),
        make: String(cell(r, "Make")).trim(),
        quantity: cell(r, "Qty", "Quantity"),
        unit: String(cell(r, "Units", "Unit")).trim() || "kW",
        unitRate: cell(r, "Unit Price", "Unit Rate", "Rate"),
        notes: String(cell(r, "Notes", "Remarks")).trim(),
      })).filter(l => l.itemName);
      if (!mapped.length) { showError?.("No valid rows found. Each row needs a Component."); return; }
      setLines(prev => [...prev, ...mapped]);
      const where = scopeItemId ? "" : " (General)";
      showSuccess?.(`Imported ${mapped.length} material(s)${where}. Review, then Save.`);
    } catch {
      showError?.("Could not read the file. Use the template format (.xlsx, .xls or .csv).");
    }
  };

  // ── Suggest BOM: template lines grouped by scope activity ──
  const fetchBomSuggestion = async () => {
    const res = await projectsApi.suggestScope(projectUniqueId, "bom");
    if (!res?.success) { showError?.(res?.message || "Failed to build suggestion"); return null; }
    return res.data || {};
  };

  const toLine = (b, scopeItemId) => ({
    ...blankLine(scopeItemId),
    category: b.category || "",
    itemName: b.itemName || "",
    make: b.make || "",
    specification: b.specification || "",
    unit: b.unit || "",
    quantity: b.quantity ?? "",
    unitRate: b.unitRate ?? "",
    bomItemId: b.bomItemId ?? null,
    variantId: b.variantId ?? b.defaultVariantId ?? null,
    variants: Array.isArray(b.variants) ? b.variants : [],
    basis: b.basis ?? null,
    basisValue: b.basisValue ?? null,
    stepValue: b.stepValue ?? null,
    siteVisitField: b.siteVisitField ?? null,
    driverAttr: b.driverAttr ?? null,
    autoQty: true,
    _flags: Array.isArray(b.flags) ? b.flags : [],
    _review: !!b.review,
  });

  const suggestBom = async () => {
    if (lines.length > 0) {
      const ok = await showConfirmation({
        title: "Replace BOM", type: "alert",
        message: "This replaces the current BOM with a suggestion from this project's sub-group template. Continue?",
        confirmText: "Yes, Suggest", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setSuggesting(true);
    try {
      const d = await fetchBomSuggestion();
      if (!d) return;
      const suggested = Array.isArray(d.bomLines) ? d.bomLines : [];
      if (!suggested.length && d.source === "NONE") {
        setSourceNote({ source: "NONE" });
        setWarnings(d.warnings || []);
        showError?.("No standard template for this project's sub-group yet.");
        return;
      }
      const kw = d.capacityKw ?? null;
      setCapacityKw(kw);
      setLines(recompute(suggested.map(b => toLine(b, scopeIdByActivity(b.scopeActivity))), kw));
      setWarnings(d.warnings || []);
      setSourceNote({ source: d.source });
      showSuccess?.("Suggested from the standard template. Review and save.");
    } catch (e) {
      fail("Failed to suggest BOM", e);
    } finally { setSuggesting(false); }
  };

  const [suggestingSection, setSuggestingSection] = useState(null);
  const suggestForSection = async (scopeItem) => {
    const title = scopeItem.activity || "(unnamed activity)";
    const sid = String(scopeItem.id);
    const secLines = lines.filter(l => String(l.scopeItemId) === sid);
    if (secLines.length > 0) {
      const ok = await showConfirmation({
        title: `Replace materials under "${title}"`, type: "alert",
        message: `This replaces the ${secLines.length} material(s) under "${title}" with a suggestion. Continue?`,
        confirmText: "Yes, Suggest", cancelText: "Cancel",
      });
      if (!ok) return;
    }
    setSuggestingSection(sid);
    try {
      const d = await fetchBomSuggestion();
      if (!d) return;
      const all = Array.isArray(d.bomLines) ? d.bomLines : [];
      const mine = all.filter(b => (b.scopeActivity || "").trim().toLowerCase() === title.trim().toLowerCase());
      if (!mine.length) { showError?.(`No suggested materials for "${title}".`); return; }
      const kw = d.capacityKw ?? capacityKw;
      if (d.capacityKw != null) setCapacityKw(d.capacityKw);
      const keySet = new Set(secLines.map(l => l._key));
      setLines(prev => recompute([
        ...prev.filter(l => !keySet.has(l._key)),
        ...mine.map(b => toLine(b, scopeItem.id)),
      ], kw));
      const codes = new Set(mine.flatMap(m => m.flags || []));
      const secWarn = (d.warnings || []).filter(w => codes.has(w.code));
      if (secWarn.length) {
        setWarnings(prev => {
          const seen = new Set(prev.map(w => w.code));
          return [...prev, ...secWarn.filter(w => !seen.has(w.code))];
        });
      }
      showSuccess?.(`Suggested ${mine.length} material(s) under "${title}". Review and save.`);
    } catch (e) {
      fail("Failed to suggest materials", e);
    } finally { setSuggestingSection(null); }
  };

  const save = async () => {
    if (!canEdit) return;
    for (const l of lines) {
      if (!(l.itemName || "").trim()) { showError?.("Every BOM line needs an item name"); return; }
    }
    setSaving(true);
    try {
      const res = await projectsApi.saveBom(projectUniqueId, {
        lines: lines.map((l, i) => ({
          id: l.id ?? null,
          seqNo: i + 1,
          scopeItemId: l.scopeItemId === "" || l.scopeItemId == null ? null : Number(l.scopeItemId),
          category: (l.category || "").trim() || null,
          itemName: l.itemName.trim(),
          make: (l.make || "").trim() || null,
          specification: (l.specification || "").trim() || null,
          unit: (l.unit || "").trim() || null,
          quantity: l.quantity === "" || l.quantity == null ? 0 : Number(l.quantity),
          unitRate: l.unitRate === "" || l.unitRate == null ? 0 : Number(l.unitRate),
          notes: (l.notes || "").trim() || null,
          bomItemId: l.bomItemId ?? null,
          variantId: l.variantId ?? null,
          basis: l.basis || null,
          basisValue: l.basisValue === "" || l.basisValue == null ? null : Number(l.basisValue),
          stepValue: l.stepValue === "" || l.stepValue == null ? null : Number(l.stepValue),
          siteVisitField: l.siteVisitField || null,
          driverAttr: l.driverAttr === "" || l.driverAttr == null ? null : Number(l.driverAttr),
          autoQty: l.autoQty !== false,
        })),
      });
      if (res?.success) {
        showSuccess?.("BOM saved");
        await load();
      } else {
        showError?.(res?.message || "Failed to save BOM");
      }
    } catch (e) {
      fail("Failed to save BOM", e);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="lbm-loading"><span className="lbm-spinner" /> Loading…</div>;

  const scopeIds = new Set(scopeItems.map(s => String(s.id)));
  const sections = [
    ...scopeItems.map(s => ({ key: String(s.id), scopeItemId: s.id, title: s.activity || "(unnamed activity)" })),
    { key: GENERAL, scopeItemId: "", title: "General / Unassigned" },
  ];
  const linesFor = (section) => lines.filter(l => {
    const sid = l.scopeItemId === "" || l.scopeItemId == null ? "" : String(l.scopeItemId);
    if (section.key === GENERAL) return sid === "" || !scopeIds.has(sid);
    return sid === section.key;
  });

  const grandTotal = lines.reduce((s, l) => s + lineAmount(l), 0);
  const moveOptions = scopeItems.map(s => ({ id: String(s.id), label: s.activity || "(unnamed)" }));

  const flagCodes = new Set();
  lines.forEach(l => (l._flags || []).forEach(c => flagCodes.add(c)));
  const bannerWarnings = [
    ...warnings,
    ...[...flagCodes].filter(c => !warnings.some(w => w.code === c)).map(c => ({ code: c })),
  ];

  const noScope = scopeItems.length === 0;

  return (
    <div className="lbm">
      <ConfirmationModal {...confirmModal} />

      <div className="lbm-card">
        <div className="lbm-card-head">
          <h4 className="lbm-card-title">Bill of Materials</h4>
          {canEdit && !noScope && (
            <div className="lbm-head-actions">
              <button className="lbm-btn-ghost" onClick={suggestBom} disabled={suggesting}
                title="Suggest a BOM from this project's sub-group template">
                <Wand2 size={13} /> {suggesting ? "Suggesting…" : "Suggest BOM"}
              </button>
              <button className="lbm-btn-ghost" onClick={generateFromScope} title="One blank line per scope activity">
                <Plus size={13} /> Generate from scope
              </button>
              <button className="lbm-btn-ghost" onClick={downloadTemplate}
                title="Download a blank Excel template to fill in, then import it under a scope">
                <Download size={13} /> Template
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onFilePicked} />
            </div>
          )}
        </div>

        {/* Gate the tab on scope existing — point at the Scope tab, not an empty grid. */}
        {noScope ? (
          <div className="lbm-empty">
            No technical scope yet. Go to the <b>Scope / SOW</b> tab and click <b>Suggest plan</b> (or add rows) to
            define the scope lines first — then materials are organised under each one here.
          </div>
        ) : (
          <>
            <div className="lbm-stat-row">
              <div className="lbm-stat"><label>Line Items</label><span>{lines.length}</span></div>
              {canSeeRates && (
                <div className="lbm-stat"><label>Total Value</label><span>₹{fmtINR(grandTotal)}</span></div>
              )}
              <div className="lbm-stat">
                <label>System Capacity (kW)</label>
                <input className="lbm-inp" type="number" min="0" step="any" style={{ maxWidth: 120 }}
                  value={capacityKw ?? ""} disabled={!canEdit}
                  title="Drives module / inverter / per-kW quantities. Edit to see quantities update live (set the real value on the Scope tab)."
                  onChange={e => changeCapacity(e.target.value)} />
              </div>
            </div>

            {sourceNote && sourceNote.source && sourceNote.source !== "NONE" && (
              <div className="lbm-source-note">Suggested from the standard template — review quantities before saving.</div>
            )}
            {bannerWarnings.length > 0 && (
              <div className="lbm-warn">
                {bannerWarnings.map((w, i) => <div key={i}>⚠ {SUGGESTION_WARNING_LABELS[w.code] || w.message}</div>)}
              </div>
            )}

            {sections.map(section => {
              const secLines = linesFor(section);
              if (section.key === GENERAL && secLines.length === 0) return null;
              const secTotal = secLines.reduce((s, l) => s + lineAmount(l), 0);
              return (
                <div key={section.key} className="lbm-section">
                  <div className="lbm-section-head">
                    <span className="lbm-section-title">{section.title}</span>
                    {canEdit && section.key !== GENERAL && (
                      <button className="lbm-section-suggest"
                        onClick={() => suggestForSection({ id: section.scopeItemId, activity: section.title })}
                        disabled={suggestingSection === String(section.scopeItemId)}
                        title={`Suggest materials for "${section.title}"`}>
                        <Wand2 size={12} /> {suggestingSection === String(section.scopeItemId) ? "…" : "Suggest"}
                      </button>
                    )}
                    {canEdit && (
                      <button className="lbm-section-suggest" onClick={() => startImport(section.scopeItemId)}
                        title={`Import materials from Excel under "${section.title}"`}>
                        <Upload size={12} /> Import
                      </button>
                    )}
                    {canSeeRates && <span className="lbm-section-total">₹{fmtINR(secTotal)}</span>}
                  </div>

                  {secLines.length === 0 ? (
                    <div className="lbm-section-empty">No materials for this activity yet.</div>
                  ) : (
                    <div className="lbm-table-wrap">
                      <table className="lbm-table">
                        <thead>
                          <tr>
                            <th className="lbm-c-num">#</th>
                            <th className="lbm-c-item">Component</th>
                            <th className="lbm-c-spec">Specifications</th>
                            <th className="lbm-c-make">Make</th>
                            <th className="lbm-c-qty">Qty</th>
                            <th className="lbm-c-unit">Units</th>
                            {canSeeRates && <th className="lbm-c-rate">Unit Price</th>}
                            {canSeeRates && <th className="lbm-c-amt">Amount</th>}
                            <th className="lbm-c-notes">Notes</th>
                            {canEdit && <th className="lbm-c-move">Move to</th>}
                            {canEdit && <th className="lbm-c-act" />}
                          </tr>
                        </thead>
                        <tbody>
                          {secLines.map((l, i) => (
                            <tr key={l._key} className={l._review ? "lbm-row-review" : undefined}>
                              <td className="lbm-c-num">
                                {i + 1}
                                {l._review && <span className="lbm-review-dot" title={(l._flags || []).map(f => SUGGESTION_WARNING_LABELS[f] || f).join("\n")}>●</span>}
                              </td>
                              <td className="lbm-c-item">
                                {canEdit ? (
                                  <ItemNameAutocomplete
                                    className="lbm-inp"
                                    value={l.itemName}
                                    user={currentUser}
                                    placeholder="Component name"
                                    onChange={v => updLine(l._key, "itemName", v)}
                                    onSelect={item => setLines(prev => prev.map(row => (row._key === l._key ? {
                                      ...row,
                                      itemName: item.itemName || row.itemName,
                                      unit: item.unit || row.unit,
                                      unitRate: (row.unitRate === "" || row.unitRate == null) && item.unitPrice != null
                                        ? item.unitPrice : row.unitRate,
                                      specification: row.specification || item.specification || "",
                                    } : row)))}
                                  />
                                ) : (
                                  <input className="lbm-inp" value={l.itemName} disabled onChange={() => {}} placeholder="Component name" />
                                )}
                              </td>
                              <td className="lbm-c-spec">
                                <input className="lbm-inp" value={l.specification} disabled={!canEdit}
                                  onChange={e => updLine(l._key, "specification", e.target.value)} placeholder="Specifications" />
                              </td>
                              <td className="lbm-c-make">
                                {(l.variants && l.variants.length > 0) ? (
                                  <select className="lbm-inp" value={l.variantId ?? ""} disabled={!canEdit}
                                    title="Choose an approved make for this item"
                                    onChange={e => pickVariant(l._key, e.target.value)}>
                                    {l.variantId == null && <option value="">— make —</option>}
                                    {l.variants.map(v => (
                                      <option key={v.variantId} value={v.variantId}>{variantLabel(v) || "(make)"}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input className="lbm-inp" value={l.make} disabled={!canEdit}
                                    onChange={e => updLine(l._key, "make", e.target.value)} placeholder="Make / brand" />
                                )}
                              </td>
                              <td className="lbm-c-qty">
                                <input className="lbm-inp" type="number" min="0" step="any" value={l.quantity}
                                  disabled={!canEdit} onChange={e => editQty(l._key, e.target.value)} />
                                {canEdit && RECALC_BASES.has(l.basis) && (
                                  l.autoQty === false ? (
                                    <button type="button" onClick={() => reAuto(l._key)}
                                      title="Quantity was edited manually. Click to auto-calculate it again."
                                      style={{ marginTop: 2, fontSize: 10, lineHeight: 1.2, color: "#b45309", background: "none",
                                               border: "none", cursor: "pointer", padding: 0 }}>
                                      ✎ manual · reset ↺
                                    </button>
                                  ) : (
                                    <span title={autoBasisHint(l)}
                                      style={{ marginTop: 2, display: "block", fontSize: 10, color: "#2563eb" }}>auto</span>
                                  )
                                )}
                              </td>
                              <td className="lbm-c-unit">
                                <UnitSelectCell className="lbm-inp" value={l.unit} disabled={!canEdit}
                                  onChange={v => updLine(l._key, "unit", v)} />
                              </td>
                              {canSeeRates && (
                                <td className="lbm-c-rate">
                                  <input className="lbm-inp" type="number" min="0" step="any" value={l.unitRate}
                                    disabled={!canEdit} onChange={e => updLine(l._key, "unitRate", e.target.value)} />
                                </td>
                              )}
                              {canSeeRates && <td className="lbm-c-amt lbm-amt">₹{fmtINR(lineAmount(l))}</td>}
                              <td className="lbm-c-notes">
                                <input className="lbm-inp" value={l.notes} disabled={!canEdit}
                                  onChange={e => updLine(l._key, "notes", e.target.value)} />
                              </td>
                              {canEdit && (
                                <td className="lbm-c-move">
                                  <select className="lbm-inp" value={scopeIds.has(String(l.scopeItemId)) ? String(l.scopeItemId) : ""}
                                    onChange={e => updLine(l._key, "scopeItemId", e.target.value)}>
                                    <option value="">General</option>
                                    {moveOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                  </select>
                                </td>
                              )}
                              {canEdit && (
                                <td className="lbm-c-act">
                                  <button className="lbm-icon-del" title="Remove line" onClick={() => removeLine(l._key)}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {canEdit && (
                    <button className="lbm-add-material" onClick={() => addLineTo(section.scopeItemId)}>
                      ＋ Add material{section.key !== GENERAL ? ` to ${section.title}` : ""}
                    </button>
                  )}
                </div>
              );
            })}

            {canEdit && (
              <div className="lbm-card-foot">
                {canSeeRates && <div className="lbm-grand">Total <b>₹{fmtINR(grandTotal)}</b></div>}
                <button className="lbm-btn-primary" onClick={save} disabled={saving}>
                  <Save size={13} /> {saving ? "Saving…" : "Save BOM"}
                </button>
              </div>
            )}

            <p className="lbm-hint">
              Materials are organised under each scope line. Set the real System Capacity on the Scope / SOW tab to
              auto-size quantities.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
