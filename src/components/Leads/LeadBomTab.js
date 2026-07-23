// ─────────────────────────────────────────────────────────────────────────────
//  LeadBomTab — Bill of Materials for a lead, organised UNDER the scope.
//
//  Step 2 of the estimation flow:  Scope → BOM → Budget Estimation.
//
//  The BOM is grouped into sections, one per technical-scope activity (all shown,
//  even empty, so the estimator sees the full checklist), plus a "General /
//  Unassigned" section. Each material line is free-text entry — Component |
//  Specifications | Make | Qty | Units | Unit Price | Amount | Notes — and adding
//  a material under a section links it to that scope activity (lead_bom.scope_item_id).
//
//  Two ways to start:
//   • "Suggest BOM" — from this project type + capacity (a similar past job scaled
//     to the target, or the standard template). Pre-fills, fully editable.
//   • "Generate from scope" — one blank line per scope activity.
//
//  Rates live here; the amounts roll up into Budget Estimation.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Wand2, Plus, Save, Trash2, Download, Upload } from "lucide-react";
import api from "../../services/leadsapi.js";
import ConfirmationModal from "../ConfirmationModal.js";
import useConfirmationModal from "../HandleConfirmationModal.js";
import UnitSelectCell from "../Dropdowns/UnitSelectCell.js";
import ItemNameAutocomplete from "../OrderBook/ItemNameAutocomplete.js";
import { downloadStyledTemplate, readSheetRows, cell } from "./bomExcel.js";
import { SUGGESTION_WARNING_LABELS } from "../../constants/scopeActivities.js";
import "./LeadBomTab.css";

// Leads BOM Excel template columns (header + width). Import is per-scope-section,
// so no "Scope Activity" column is needed — the section you import into decides it.
const BOM_TEMPLATE_COLUMNS = [
  { header: "Component", width: 28 }, { header: "Specifications", width: 24 },
  { header: "Make", width: 16 }, { header: "Qty", width: 10 }, { header: "Units", width: 10 },
  { header: "Unit Price", width: 13 }, { header: "Notes", width: 24 },
];
const BOM_TEMPLATE_SAMPLE = ["Solar Module 550Wp", "Mono PERC Bifacial", "Adani", 60, "Nos", 10000, ""];

const fmtINR = n => Number(Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const lineAmount = l => (Number(l.quantity) || 0) * (Number(l.unitRate) || 0);

// Display label for a variant option: "make model" (either part may be blank).
const variantLabel = v => [v?.make, v?.model].filter(Boolean).join(" ").trim();

const GENERAL = "__general__"; // section key for lines with no scope link

const blankLine = (scopeItemId = "") => ({
  _key: `n${Math.random().toString(36).slice(2)}`, // stable local key for new rows
  id: null, scopeItemId, category: "", itemName: "", make: "",
  specification: "", unit: "kW", quantity: "", unitRate: "", notes: "",
  // Pick-a-make: catalog link, chosen make, and the allowed makes (constrained dropdown).
  bomItemId: null, variantId: null, variants: [],
  _flags: [], _review: false,
});

export default function LeadBomTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [lines, setLines] = useState([]);
  const [scopeItems, setScopeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [sourceNote, setSourceNote] = useState(null);

  const { confirmModal, showConfirmation } = useConfirmationModal();
  const fileInputRef = useRef(null);

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bomRes, scopeRes] = await Promise.all([
        api.get(`/leads/${lead.id}/bom`),
        api.get(`/leads/${lead.id}/scope`),
      ]);
      if (bomRes?.success) {
        setLines((bomRes.data?.lines || []).map(l => ({
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
        })));
      }
      if (scopeRes?.success) setScopeItems(scopeRes.data?.items || []);
      setWarnings([]); setSourceNote(null);
    } catch (e) {
      fail("Failed to load BOM", e);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  useEffect(() => { load(); }, [load]);

  // ── Line editing (flat state, grouped at render) ──
  const updLine = (key, field, val) =>
    setLines(prev => prev.map(l => (l._key === key ? { ...l, [field]: val } : l)));
  const removeLine = (key) => setLines(prev => prev.filter(l => l._key !== key));
  const addLineTo = (scopeItemId) => setLines(prev => [...prev, blankLine(scopeItemId)]);

  // Choosing a make from the constrained dropdown snapshots make + spec onto the line.
  const pickVariant = (key, variantId) => setLines(prev => prev.map(l => {
    if (l._key !== key) return l;
    const v = (l.variants || []).find(x => String(x.variantId) === String(variantId));
    if (!v) return { ...l, variantId: null };
    const label = variantLabel(v);
    return { ...l, variantId: v.variantId, make: label || l.make, specification: v.description || l.specification };
  }));

  // Resolve a scope activity NAME → its scope item id (for suggestion grouping).
  const scopeIdByActivity = (name) => {
    if (!name) return "";
    const hit = scopeItems.find(s => (s.activity || "").trim().toLowerCase() === name.trim().toLowerCase());
    return hit ? hit.id : "";
  };

  // ── Generate from scope: one blank line per activity ──
  const generateFromScope = async () => {
    if (!scopeItems.length) {
      showError?.("No scope lines to generate from. Add them in the Technical Scope tab first.");
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
      quantity: it.quantity ?? "",
      unit: it.unit || "",
    })));
    setWarnings([]); setSourceNote(null);
    showSuccess?.("Seeded one line per scope activity. Add materials and rates, then Save.");
  };

  // ── Excel template download + per-section import ──
  const downloadTemplate = () =>
    downloadStyledTemplate(BOM_TEMPLATE_COLUMNS, BOM_TEMPLATE_SAMPLE, "BOM", "lead_bom_template.xlsx");

  // The section an Import click targets — imported rows all land under it.
  const importTargetRef = useRef("");
  const startImport = (scopeItemId) => { importTargetRef.current = scopeItemId; fileInputRef.current?.click(); };

  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-importing the same file
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

  // ── Suggest BOM: mined past job or template, grouped by scope activity ──
  // Fetch a BOM suggestion (mined past job or template). Returns the raw payload
  // or null on failure; both the whole-BOM and per-scope actions share it.
  const fetchBomSuggestion = async () => {
    const res = await api.get(`/leads/${lead.id}/scope/suggest`, { params: { target: "bom" } });
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
    _flags: Array.isArray(b.flags) ? b.flags : [],
    _review: !!b.review,
  });

  // Whole-BOM suggest — replaces everything, grouped by scope.
  const suggestBom = async () => {
    if (lines.length > 0) {
      const ok = await showConfirmation({
        title: "Replace BOM", type: "alert",
        message: "This replaces the current BOM with a suggestion from this project type and capacity. Continue?",
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
        showError?.("No template or similar past job for this project type yet.");
        return;
      }
      setLines(suggested.map(b => toLine(b, scopeIdByActivity(b.scopeActivity))));
      setWarnings(d.warnings || []);
      setSourceNote({ source: d.source, sourceCapacity: d.sourceCapacity });
      showSuccess?.(
        d.source === "MINED"
          ? `Suggested from a similar ${d.sourceCapacity || ""} job. Review and save.`
          : "Suggested from the standard template. Review and save."
      );
    } catch (e) {
      fail("Failed to suggest BOM", e);
    } finally { setSuggesting(false); }
  };

  // Per-scope suggest — fills just ONE section's materials, leaving the rest.
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
      // Lines the engine tagged to this activity (case-insensitive by name).
      const mine = all.filter(b => (b.scopeActivity || "").trim().toLowerCase() === title.trim().toLowerCase());
      if (!mine.length) {
        showError?.(`No suggested materials for "${title}".`);
        return;
      }
      // Replace only this section's lines; keep every other line untouched.
      const keySet = new Set(secLines.map(l => l._key));
      setLines(prev => [
        ...prev.filter(l => !keySet.has(l._key)),
        ...mine.map(b => toLine(b, scopeItem.id)),
      ]);
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
      const res = await api.put(`/leads/${lead.id}/bom`, {
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
        })),
      });
      if (res?.success) {
        showSuccess?.("BOM saved");
        await load();
        onRefreshLead?.();
      } else {
        showError?.(res?.message || "Failed to save BOM");
      }
    } catch (e) {
      fail("Failed to save BOM", e);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="lbm-loading"><span className="lbm-spinner" /> Loading…</div>;

  // Build the sections: every scope item, then General. A line belongs to a
  // section by its scopeItemId (numeric match); anything else falls to General.
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

  return (
    <div className="lbm">
      <ConfirmationModal {...confirmModal} />

      <div className="lbm-card">
        <div className="lbm-card-head">
          <h4 className="lbm-card-title">Bill of Materials</h4>
          {canEdit && (
            <div className="lbm-head-actions">
              <button className="lbm-btn-ghost" onClick={suggestBom} disabled={suggesting}
                title="Suggest a BOM from this project type and capacity (past job or template)">
                <Wand2 size={13} /> {suggesting ? "Suggesting…" : "Suggest BOM"}
              </button>
              <button className="lbm-btn-ghost" onClick={generateFromScope}
                title="One blank line per scope activity">
                <Plus size={13} /> Generate from scope
              </button>
              <button className="lbm-btn-ghost" onClick={downloadTemplate}
                title="Download a blank Excel template to fill in, then import it under a scope">
                <Download size={13} /> Template
              </button>
              {/* One hidden input; each section's Import button targets it. */}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onFilePicked} />
            </div>
          )}
        </div>

        <div className="lbm-stat-row">
          <div className="lbm-stat"><label>Line Items</label><span>{lines.length}</span></div>
          <div className="lbm-stat"><label>Total Value</label><span>₹{fmtINR(grandTotal)}</span></div>
        </div>

        {sourceNote && sourceNote.source && sourceNote.source !== "NONE" && (
          <div className="lbm-source-note">
            {sourceNote.source === "MINED"
              ? `Suggested from a similar ${sourceNote.sourceCapacity || ""} job — review quantities before saving.`
              : "Suggested from the standard template — review quantities before saving."}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="lbm-warn">
            {warnings.map((w, i) => <div key={i}>⚠ {SUGGESTION_WARNING_LABELS[w.code] || w.message}</div>)}
          </div>
        )}

        {scopeItems.length === 0 && lines.length === 0 && (
          <div className="lbm-empty">
            No scope activities yet. Add them in the Technical Scope tab, then "Suggest BOM" or
            "Generate from scope" — materials are organised under each activity.
          </div>
        )}

        {/* One section per scope activity, plus General */}
        {sections.map(section => {
          const secLines = linesFor(section);
          if (section.key === GENERAL && secLines.length === 0) return null; // hide empty General
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
                  <button className="lbm-section-suggest"
                    onClick={() => startImport(section.scopeItemId)}
                    title={`Import materials from Excel under "${section.title}"`}>
                    <Upload size={12} /> Import
                  </button>
                )}
                <span className="lbm-section-total">₹{fmtINR(secTotal)}</span>
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
                        <th className="lbm-c-rate">Unit Price</th>
                        <th className="lbm-c-amt">Amount</th>
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
                                  // Fill the rate from the catalogue price when this line has none yet.
                                  unitRate: (row.unitRate === "" || row.unitRate == null) && item.unitPrice != null
                                    ? item.unitPrice : row.unitRate,
                                  specification: row.specification || item.specification || "",
                                } : row)))}
                              />
                            ) : (
                              <input className="lbm-inp" value={l.itemName} disabled
                                onChange={() => {}} placeholder="Component name" />
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
                              disabled={!canEdit} onChange={e => updLine(l._key, "quantity", e.target.value)} />
                          </td>
                          <td className="lbm-c-unit">
                            <UnitSelectCell className="lbm-inp" value={l.unit} disabled={!canEdit}
                              onChange={v => updLine(l._key, "unit", v)} />
                          </td>
                          <td className="lbm-c-rate">
                            <input className="lbm-inp" type="number" min="0" step="any" value={l.unitRate}
                              disabled={!canEdit} onChange={e => updLine(l._key, "unitRate", e.target.value)} />
                          </td>
                          <td className="lbm-c-amt lbm-amt">₹{fmtINR(lineAmount(l))}</td>
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
            <div className="lbm-grand">Total <b>₹{fmtINR(grandTotal)}</b></div>
            <button className="lbm-btn-primary" onClick={save} disabled={saving}>
              <Save size={13} /> {saving ? "Saving…" : "Save BOM"}
            </button>
          </div>
        )}

        <p className="lbm-hint">
          Materials organised under each scope activity. These amounts are the base of the budget —
          extra allocations are added in Budget Estimation.
        </p>
      </div>
    </div>
  );
}
