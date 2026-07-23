// ─────────────────────────────────────────────────────────────────────────────
//  LeadTemplatesAdmin — manage the standard Scope + BOM templates that drive the
//  lead "Suggest scope / BOM" feature. One template per project type (sub-group).
//
//  Master-detail: a list of templates on the left; the selected template's header,
//  scope lines and BOM lines (with basis rules) editable on the right. Everything
//  is add / edit / delete. Reached at /officeuse/lead-admin (OFFICE_USE gated).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Save, Trash2, RefreshCw, Download, Upload } from "lucide-react";
import api from "../services/leadsapi.js";
import { downloadStyledTemplate, readSheetRows, cell } from "../components/Leads/bomExcel.js";
import useToast from "../hooks/useToast";
import ToastContainer from "../components/Notification_Toast/ToastContainer.js";
import ConfirmationModal from "../components/ConfirmationModal.js";
import useConfirmationModal from "../components/HandleConfirmationModal.js";
import UnitSelectCell from "../components/Dropdowns/UnitSelectCell.js";
import BomItemAutocomplete from "../components/Leads/BomItemAutocomplete.js";
import TemplateLineVariantsModal from "../components/Leads/TemplateLineVariantsModal.js";
import { BASIS_OPTIONS, SITE_VISIT_FIELDS } from "../constants/scopeActivities.js";
import "../pages-css/LeadTemplatesAdmin.css";

const GENERAL = "__general__"; // section key for BOM lines with no scope activity

// Template BOM Excel columns — includes Basis (how the qty scales per lead).
// Import is per-scope-section, so no "Scope Activity" column is needed.
const TPL_COLUMNS = [
  { header: "Component", width: 28 }, { header: "Specifications", width: 24 }, { header: "Make", width: 16 },
  { header: "Basis", width: 16 }, { header: "Qty (per basis)", width: 15 }, { header: "Step (per-step only)", width: 18 },
  { header: "Units", width: 10 }, { header: "Unit Price", width: 13 }, { header: "Notes", width: 24 },
];
// Normalise a free-text basis cell to a valid code (default PER_KW).
const normBasis = (v) => {
  const s = String(v || "").trim().toLowerCase();
  if (s.includes("fix")) return "FIXED";
  if (s.includes("step")) return "PER_STEP";
  if (s.includes("site")) return "FROM_SITE_VISIT";
  return "PER_KW";
};

const fmtINR = n => "₹" + Number(Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A template line has no fixed quantity, so "Amount" is only meaningful for the
// two capacity-independent-per-unit bases: FIXED (qty × price) and PER_KW (the
// per-kW cost). PER_STEP / FROM_SITE_VISIT depend on the lead → shown as "—".
const templateAmount = (r) => {
  const price = Number(r.defaultUnitRate) || 0;
  const val = Number(r.basisValue) || 0;
  if (r.basis === "FIXED") return { text: fmtINR(val * price), suffix: "" };
  if (r.basis === "PER_KW") return { text: fmtINR(val * price), suffix: "/kW" };
  return { text: "—", suffix: "" };
};

const blankScope = () => ({ id: null, activity: "", category: "", specification: "", unit: "kW", notes: "" });
const blankBom = (scopeActivity = "") => ({
  _key: `n${Math.random().toString(36).slice(2)}`, // stable local key for grouping
  id: null, scopeActivity, category: "", itemName: "", make: "", specification: "",
  unit: "kW", basis: "PER_KW", basisValue: "", stepValue: "", siteVisitField: "", defaultUnitRate: "", notes: "",
  // Pick-a-make: catalog link + curated allowed makes + default (null when free-text).
  bomItemId: null, allowedVariantIds: [], defaultVariantId: null,
});

export default function LeadTemplatesAdmin() {
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { confirmModal, showConfirmation } = useConfirmationModal();

  const [templates, setTemplates] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null); // {id, projectType, name, description, isActive}
  const [detailTab, setDetailTab] = useState("scope"); // template | scope | bom
  const [scopeLines, setScopeLines] = useState([]);
  const [bomLines, setBomLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingScope, setSavingScope] = useState(false);
  const [savingBom, setSavingBom] = useState(false);
  const [variantLineKey, setVariantLineKey] = useState(null); // _key of the line whose Makes modal is open

  // New-template form
  const [newType, setNewType] = useState("");
  const [newName, setNewName] = useState("");

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get("/admin/lead-templates");
      setTemplates(Array.isArray(res) ? res : []);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to load templates");
    }
  }, [showError]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTemplates();
      try {
        const res = await api.get("/admin/dropdowns/subgroups");
        const list = Array.isArray(res) ? res : (Array.isArray(res?.content) ? res.content : []);
        setSubGroups(list.map(s => s.subGroupName).filter(Boolean));
      } catch { /* non-fatal */ }
      setLoading(false);
    })();
  }, [loadTemplates]);

  const openTemplate = async (id) => {
    setSelectedId(id);
    try {
      const t = await api.get(`/admin/lead-templates/${id}`);
      setDetail({ id: t.id, projectType: t.projectType, name: t.name || "", description: t.description || "", isActive: t.isActive });
      setScopeLines((t.scopeItems || []).map(s => ({
        id: s.id, activity: s.activity || "", category: s.category || "",
        specification: s.specification || "", unit: s.unit || "", notes: s.notes || "",
      })));
      setBomLines((t.bomItems || []).map(b => ({
        ...blankBom(b.scopeActivity || ""),
        id: b.id, category: b.category || "", itemName: b.itemName || "",
        make: b.make || "", specification: b.specification || "", unit: b.unit || "",
        basis: b.basis || "PER_KW", basisValue: b.basisValue ?? "", stepValue: b.stepValue ?? "",
        siteVisitField: b.siteVisitField || "", defaultUnitRate: b.defaultUnitRate ?? "", notes: b.notes || "",
        bomItemId: b.bomItemId ?? null, allowedVariantIds: b.allowedVariantIds || [], defaultVariantId: b.defaultVariantId ?? null,
      })));
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to open template");
    }
  };

  const createTemplate = async () => {
    if (!newType) { showError("Pick a project type"); return; }
    if (templates.some(t => t.projectType === newType && t.isActive)) {
      showError("An active template already exists for that project type"); return;
    }
    try {
      const t = await api.post("/admin/lead-templates", { projectType: newType, name: newName.trim() || null, isActive: true });
      setNewType(""); setNewName("");
      await loadTemplates();
      showSuccess("Template created");
      openTemplate(t.id);
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError("Failed to create template"); }
  };

  const saveHeader = async () => {
    if (!detail) return;
    try {
      await api.put(`/admin/lead-templates/${detail.id}`, {
        projectType: detail.projectType, name: detail.name.trim() || null,
        description: detail.description.trim() || null, isActive: detail.isActive,
      });
      await loadTemplates();
      showSuccess("Template saved");
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError("Failed to save template"); }
  };

  const deleteTemplate = async (t) => {
    const ok = await showConfirmation({
      title: t.isActive ? "Deactivate template" : "Delete template permanently",
      type: "alert",
      message: t.isActive
        ? `Deactivate the ${t.projectType} template? It stops being suggested but is kept.`
        : `Permanently delete the ${t.projectType} template and all its lines? This cannot be undone.`,
      confirmText: t.isActive ? "Deactivate" : "Delete", cancelText: "Cancel",
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/lead-templates/${t.id}`);
      if (selectedId === t.id) { setSelectedId(null); setDetail(null); setScopeLines([]); setBomLines([]); }
      await loadTemplates();
      showSuccess(t.isActive ? "Template deactivated" : "Template deleted");
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError("Failed to delete template"); }
  };

  // ── Scope lines ──
  const updScope = (i, k, v) => setScopeLines(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const saveScope = async () => {
    for (const r of scopeLines) if (!r.activity.trim()) { showError("Every scope line needs an activity"); return; }
    setSavingScope(true);
    try {
      await api.put(`/admin/lead-templates/${detail.id}/scope-items`, {
        items: scopeLines.map((r, i) => ({
          id: r.id ?? null, seqNo: i + 1, activity: r.activity.trim(),
          category: r.category || null, specification: r.specification || null,
          unit: r.unit || null, notes: r.notes || null,
        })),
      });
      await openTemplate(detail.id);
      showSuccess("Scope lines saved");
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError("Failed to save scope lines"); }
    finally { setSavingScope(false); }
  };

  // ── BOM lines (key-based, grouped by scope activity) ──
  const updBom = (key, k, v) => setBomLines(p => p.map(r => (r._key === key ? { ...r, [k]: v } : r)));
  const rmBom = (key) => setBomLines(p => p.filter(r => r._key !== key));
  const addBomTo = (activity) => setBomLines(p => [...p, blankBom(activity)]);

  // ── Excel template download + per-section import (template BOM lines) ──
  const bomFileRef = useRef(null);
  const importTargetRef = useRef("");    // the scope activity name to import under
  const downloadBomTemplate = () =>
    downloadStyledTemplate(TPL_COLUMNS, null, "BOM Template", "lead_bom_template_lines.xlsx");
  const startImport = (activity) => { importTargetRef.current = activity || ""; bomFileRef.current?.click(); };
  const onBomFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const activity = importTargetRef.current;
    try {
      const rows = await readSheetRows(file);
      if (!rows.length) { showError("The file has no data rows."); return; }
      const mapped = rows.map(r => ({
        ...blankBom(activity),
        itemName: String(cell(r, "Component", "Item")).trim(),
        specification: String(cell(r, "Specifications", "Specification")).trim(),
        make: String(cell(r, "Make")).trim(),
        basis: normBasis(cell(r, "Basis")),
        basisValue: cell(r, "Qty (per basis)", "Qty", "Value"),
        stepValue: cell(r, "Step (per-step only)", "Step"),
        unit: String(cell(r, "Units", "Unit")).trim() || "kW",
        defaultUnitRate: cell(r, "Unit Price", "Rate"),
        notes: String(cell(r, "Notes")).trim(),
      })).filter(l => l.itemName);
      if (!mapped.length) { showError("No valid rows found. Each row needs a Component."); return; }
      setBomLines(p => [...p, ...mapped]);
      showSuccess(`Imported ${mapped.length} material(s)${activity ? "" : " (General)"}. Review, then Save BOM lines.`);
    } catch {
      showError("Could not read the file. Use the template format (.xlsx, .xls or .csv).");
    }
  };
  const saveBom = async () => {
    for (const r of bomLines) if (!r.itemName.trim()) { showError("Every BOM line needs an item name"); return; }
    setSavingBom(true);
    try {
      await api.put(`/admin/lead-templates/${detail.id}/bom-items`, {
        lines: bomLines.map((r, i) => ({
          id: r.id ?? null, seqNo: i + 1, scopeActivity: r.scopeActivity || null,
          category: r.category || null, itemName: r.itemName.trim(), make: r.make || null,
          specification: r.specification || null, unit: r.unit || null, basis: r.basis || "PER_KW",
          basisValue: r.basisValue === "" ? null : Number(r.basisValue),
          stepValue: r.stepValue === "" ? null : Number(r.stepValue),
          siteVisitField: r.siteVisitField || null,
          defaultUnitRate: r.defaultUnitRate === "" ? null : Number(r.defaultUnitRate),
          notes: r.notes || null,
          bomItemId: r.bomItemId ?? null,
          allowedVariantIds: r.allowedVariantIds || [],
          defaultVariantId: r.defaultVariantId ?? null,
        })),
      });
      await openTemplate(detail.id);
      showSuccess("BOM lines saved");
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError("Failed to save BOM lines"); }
    finally { setSavingBom(false); }
  };

  // Which extra input a basis needs (value / step / site-visit field).
  const basisInput = (r) => {
    if (r.basis === "PER_STEP") {
      return <input className="lta-inp" type="number" min="0" step="any" value={r.stepValue}
        placeholder="kW / unit" onChange={e => updBom(r._key, "stepValue", e.target.value)} />;
    }
    if (r.basis === "FROM_SITE_VISIT") {
      return (
        <select className="lta-inp" value={r.siteVisitField} onChange={e => updBom(r._key, "siteVisitField", e.target.value)}>
          <option value="">— field —</option>
          {SITE_VISIT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      );
    }
    // FIXED or PER_KW → a numeric value
    return <input className="lta-inp" type="number" min="0" step="any" value={r.basisValue}
      placeholder={r.basis === "PER_KW" ? "per kW" : "qty"} onChange={e => updBom(r._key, "basisValue", e.target.value)} />;
  };

  if (loading) return <div className="lta-page"><div className="lta-loading">Loading templates…</div></div>;

  // Distinct scope activities → sections, in scope-line order, plus General.
  const scopeActivityOptions = [...new Set(scopeLines.map(s => (s.activity || "").trim()).filter(Boolean))];
  const bomSections = [
    ...scopeActivityOptions.map(a => ({ key: a, activity: a, title: a })),
    { key: GENERAL, activity: "", title: "General / Unassigned" },
  ];
  const knownActivities = new Set(scopeActivityOptions.map(a => a.toLowerCase()));
  const bomLinesFor = (section) => bomLines.filter(r => {
    const act = (r.scopeActivity || "").trim();
    if (section.key === GENERAL) return !act || !knownActivities.has(act.toLowerCase());
    return act.toLowerCase() === section.activity.toLowerCase();
  });

  return (
    <div className="lta-page">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal {...confirmModal} />

      {variantLineKey && (() => {
        const vLine = bomLines.find(r => r._key === variantLineKey);
        if (!vLine) return null;
        return (
          <TemplateLineVariantsModal
            line={vLine}
            onClose={() => setVariantLineKey(null)}
            onApply={patch => setBomLines(prev => prev.map(row => row._key === variantLineKey ? { ...row, ...patch } : row))}
            showError={showError}
            showSuccess={showSuccess}
          />
        );
      })()}

      <div className="lta-head">
        <h1 className="lta-title">Lead Scope / BOM Templates</h1>
        <p className="lta-sub">Standard scope and materials per project type — used to suggest a starting estimate for a lead.</p>
      </div>

      <div className="lta-layout">
        {/* ── Left: template list + create ── */}
        <div className="lta-list-card">
          <div className="lta-list-head">
            <span>Templates</span>
            <button className="lta-icon" title="Refresh" onClick={loadTemplates}><RefreshCw size={14} /></button>
          </div>

          <div className="lta-create">
            <select className="lta-inp" value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="">Project type…</option>
              {subGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
            </select>
            <input className="lta-inp" placeholder="Name (optional)" value={newName} onChange={e => setNewName(e.target.value)} />
            <button className="lta-btn-primary" onClick={createTemplate}><Plus size={13} /> Add</button>
          </div>

          <div className="lta-list">
            {templates.length === 0 && <div className="lta-empty">No templates yet.</div>}
            {templates.map(t => (
              <div key={t.id} className={`lta-list-item${selectedId === t.id ? " active" : ""}`} onClick={() => openTemplate(t.id)}>
                <div className="lta-list-main">
                  <b>{t.projectType}</b>
                  {t.name && <span className="lta-list-name">{t.name}</span>}
                </div>
                {!t.isActive && <span className="lta-badge-off">inactive</span>}
                <button className="lta-icon-del" title={t.isActive ? "Deactivate" : "Delete"}
                  onClick={e => { e.stopPropagation(); deleteTemplate(t); }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: selected template detail (tabbed) ── */}
        <div className="lta-detail">
          {!detail ? (
            <div className="lta-detail-empty">Select a template on the left, or create one.</div>
          ) : (
            <div className="lta-card lta-card--flush">
              {/* Tab bar */}
              <div className="lta-tabs">
                <button className={`lta-tab${detailTab === "template" ? " active" : ""}`} onClick={() => setDetailTab("template")}>Template</button>
                <button className={`lta-tab${detailTab === "scope" ? " active" : ""}`} onClick={() => setDetailTab("scope")}>Scope Lines <span className="lta-tab-count">{scopeLines.length}</span></button>
                <button className={`lta-tab${detailTab === "bom" ? " active" : ""}`} onClick={() => setDetailTab("bom")}>BOM Lines <span className="lta-tab-count">{bomLines.length}</span></button>
                <span className="lta-tabs-type">{detail.projectType}{!detail.isActive && <span className="lta-badge-off">inactive</span>}</span>
              </div>

              {/* Template tab */}
              {detailTab === "template" && (
                <div className="lta-tab-body">
                  <div className="lta-form-grid">
                    <label className="lta-field"><span>Project Type</span><input className="lta-inp" value={detail.projectType} disabled /></label>
                    <label className="lta-field"><span>Name</span>
                      <input className="lta-inp" value={detail.name} onChange={e => setDetail(d => ({ ...d, name: e.target.value }))} /></label>
                    <label className="lta-field"><span>Active</span>
                      <select className="lta-inp" value={detail.isActive ? "1" : "0"}
                        onChange={e => setDetail(d => ({ ...d, isActive: e.target.value === "1" }))}>
                        <option value="1">Active</option><option value="0">Inactive</option>
                      </select></label>
                    <label className="lta-field lta-field--full"><span>Description</span>
                      <input className="lta-inp" value={detail.description} onChange={e => setDetail(d => ({ ...d, description: e.target.value }))} /></label>
                  </div>
                  <div className="lta-card-foot"><button className="lta-btn-primary" onClick={saveHeader}><Save size={13} /> Save template</button></div>
                </div>
              )}

              {/* Scope Lines tab */}
              {detailTab === "scope" && (
                <div className="lta-tab-body">
                  <div className="lta-tab-actions">
                    <span className="lta-hint">The standard activities suggested for this project type.</span>
                    <button className="lta-btn-ghost" onClick={() => setScopeLines(p => [...p, blankScope()])}><Plus size={13} /> Add line</button>
                  </div>
                  <div className="lta-table-wrap">
                    <table className="lta-table">
                      <thead><tr><th className="lta-c-no">#</th><th>Activity</th><th>Category</th><th>Specification</th><th className="lta-c-unit">Unit</th><th>Notes</th><th className="lta-c-act" /></tr></thead>
                      <tbody>
                        {scopeLines.length === 0 && <tr><td colSpan={7} className="lta-empty">No scope lines. "Add line" to define the standard scope.</td></tr>}
                        {scopeLines.map((r, i) => (
                          <tr key={r.id ?? `n${i}`}>
                            <td className="lta-c-no">{i + 1}</td>
                            <td><input className="lta-inp" value={r.activity} onChange={e => updScope(i, "activity", e.target.value)} placeholder="Activity" /></td>
                            <td><input className="lta-inp" value={r.category} onChange={e => updScope(i, "category", e.target.value)} placeholder="Optional" /></td>
                            <td><input className="lta-inp" value={r.specification} onChange={e => updScope(i, "specification", e.target.value)} placeholder="Optional" /></td>
                            <td className="lta-c-unit"><UnitSelectCell className="lta-inp" value={r.unit} onChange={v => updScope(i, "unit", v)} /></td>
                            <td><input className="lta-inp" value={r.notes} onChange={e => updScope(i, "notes", e.target.value)} /></td>
                            <td className="lta-c-act"><button className="lta-icon-del" onClick={() => setScopeLines(p => p.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="lta-card-foot"><button className="lta-btn-primary" onClick={saveScope} disabled={savingScope}><Save size={13} /> {savingScope ? "Saving…" : "Save scope lines"}</button></div>
                </div>
              )}

              {/* BOM Lines tab — grouped under each scope activity, like the leads BOM tab */}
              {detailTab === "bom" && (
                <div className="lta-tab-body">
                  <div className="lta-tab-actions">
                    <span className="lta-hint">Same columns as the lead BOM. <b>Qty</b> is read via the <b>Basis</b>; use each activity's <b>Import</b> to load materials under it.</span>
                    <button className="lta-btn-ghost" onClick={downloadBomTemplate} title="Download a blank Excel template to fill in, then import it under a scope"><Download size={13} /> Template</button>
                    <input ref={bomFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onBomFilePicked} />
                  </div>

                  {scopeActivityOptions.length === 0 && bomLines.length === 0 && (
                    <div className="lta-empty-block">
                      Add scope activities in the <b>Scope Lines</b> tab first — materials are organised under each activity.
                      You can still add general (unassigned) materials below.
                    </div>
                  )}

                  {bomSections.map(section => {
                    const secLines = bomLinesFor(section);
                    if (section.key === GENERAL && secLines.length === 0) return null; // hide empty General
                    return (
                      <div key={section.key} className="lta-section">
                        <div className="lta-section-head">
                          <span className="lta-section-title">{section.title}</span>
                          <button className="lta-section-import"
                            onClick={() => startImport(section.activity)}
                            title={`Import materials from Excel under "${section.title}"`}>
                            <Upload size={12} /> Import
                          </button>
                          <span className="lta-section-count">{secLines.length}</span>
                        </div>

                        {secLines.length === 0 ? (
                          <div className="lta-section-empty">No materials for this activity yet.</div>
                        ) : (
                          <div className="lta-table-wrap">
                            <table className="lta-table lta-table--bom">
                              <thead><tr>
                                <th className="lta-c-no">#</th><th className="lta-c-item">Component</th><th>Specifications</th><th>Make</th>
                                <th className="lta-c-qty">Qty</th><th className="lta-c-unit">Units</th><th>Unit Price</th>
                                <th className="lta-c-amt">Amount</th><th className="lta-c-basis">Basis</th><th>Notes</th>
                                <th className="lta-c-move">Move to</th><th className="lta-c-act" />
                              </tr></thead>
                              <tbody>
                                {secLines.map((r, i) => {
                                  const amt = templateAmount(r);
                                  return (
                                  <tr key={r._key}>
                                    <td className="lta-c-no">{i + 1}</td>
                                    <td className="lta-c-item">
                                      <BomItemAutocomplete
                                        value={r.itemName}
                                        placeholder="Component name"
                                        onChange={v => updBom(r._key, "itemName", v)}
                                        onSelect={item => setBomLines(prev => prev.map(row => (row._key === r._key ? {
                                          ...row,
                                          itemName: item.itemName || row.itemName,
                                          bomItemId: item.id ?? null,
                                          // New catalog item → re-curate makes from scratch.
                                          allowedVariantIds: [], defaultVariantId: null,
                                          make: item.makeBrand || row.make,
                                          unit: row.unit || item.defaultUnit || "",
                                          specification: row.specification || item.specification || "",
                                        } : row)))}
                                      />
                                    </td>
                                    <td><input className="lta-inp" value={r.specification} onChange={e => updBom(r._key, "specification", e.target.value)} placeholder="Specifications" /></td>
                                    <td>
                                      {r.bomItemId ? (
                                        <div className="lta-make-cell" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.make ? "inherit" : "#9CA3AF" }}>
                                            {r.make || "— set make —"}
                                          </span>
                                          <button type="button" className="lta-btn-ghost" style={{ whiteSpace: "nowrap", padding: "2px 8px" }}
                                            onClick={() => setVariantLineKey(r._key)}
                                            title="Manage the allowed makes for this line">
                                            Makes{(r.allowedVariantIds?.length || 0) > 0 ? ` (${r.allowedVariantIds.length})` : ""}
                                          </button>
                                        </div>
                                      ) : (
                                        <input className="lta-inp" value={r.make} onChange={e => updBom(r._key, "make", e.target.value)} placeholder="Make / brand" />
                                      )}
                                    </td>
                                    <td className="lta-c-qty">{basisInput(r)}</td>
                                    <td className="lta-c-unit"><UnitSelectCell className="lta-inp" value={r.unit} onChange={v => updBom(r._key, "unit", v)} /></td>
                                    <td><input className="lta-inp" type="number" min="0" step="any" value={r.defaultUnitRate} onChange={e => updBom(r._key, "defaultUnitRate", e.target.value)} placeholder="0" /></td>
                                    <td className="lta-c-amt lta-amt">{amt.text}<span className="lta-amt-suffix">{amt.suffix}</span></td>
                                    <td className="lta-c-basis">
                                      <select className="lta-inp" value={r.basis} onChange={e => updBom(r._key, "basis", e.target.value)}
                                        title={(BASIS_OPTIONS.find(b => b.value === r.basis) || {}).help}>
                                        {BASIS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                      </select>
                                    </td>
                                    <td><input className="lta-inp" value={r.notes} onChange={e => updBom(r._key, "notes", e.target.value)} /></td>
                                    <td className="lta-c-move">
                                      <select className="lta-inp" value={knownActivities.has((r.scopeActivity || "").toLowerCase()) ? r.scopeActivity : ""}
                                        onChange={e => updBom(r._key, "scopeActivity", e.target.value)}>
                                        <option value="">General</option>
                                        {scopeActivityOptions.map(a => <option key={a} value={a}>{a}</option>)}
                                      </select>
                                    </td>
                                    <td className="lta-c-act"><button className="lta-icon-del" onClick={() => rmBom(r._key)}><Trash2 size={14} /></button></td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <button className="lta-add-material" onClick={() => addBomTo(section.activity)}>
                          ＋ Add material{section.key !== GENERAL ? ` to ${section.title}` : ""}
                        </button>
                      </div>
                    );
                  })}

                  <div className="lta-card-foot"><button className="lta-btn-primary" onClick={saveBom} disabled={savingBom}><Save size={13} /> {savingBom ? "Saving…" : "Save BOM lines"}</button></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
