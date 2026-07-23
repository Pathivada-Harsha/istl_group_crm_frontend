// ─────────────────────────────────────────────────────────────────────────────
//  ItemMakesModal — catalog-level make management for a bom_items_master item.
//  Restyled to the Leads-Enquire design system (uses the shared bim-* classes in
//  pages-css/BomItemsMaster.css). Existing makes render in a sortable, paginated
//  table with inline edit; new makes are added several-at-once via an editable
//  grid ("Save all"). If the parent item defines a variant-attribute schema, each
//  make fills it (text / number+unit / dropdown); items with no schema use the
//  plain make / model / description columns.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X, Plus, Pencil, Trash2, Save, Check } from "lucide-react";
import api from "../services/leadsapi.js";
import "../pages-css/BomItemsMaster.css";

const dash = <span className="bim-muted">—</span>;

const parseSchema = (raw) => {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => ({
    key: f.key || "", label: f.label || f.key || "", type: f.type || "text",
    options: Array.isArray(f.options) ? f.options : [], unit: f.unit || "", required: !!f.required,
  }));
};
const parseValues = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { const o = JSON.parse(raw); return o && typeof o === "object" ? o : {}; } catch { return {}; }
};
const blankRow = () => ({ make: "", model: "", description: "", values: {} });
const pageNumbers = (current, totalP) => {
  const out = []; const start = Math.max(1, current - 2), end = Math.min(totalP, current + 2);
  for (let p = start; p <= end; p++) out.push(p);
  return out;
};

const SortIcon = ({ dir }) => {
  if (dir === "asc") return <svg className="bim-sort-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>;
  if (dir === "desc") return <svg className="bim-sort-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l-7 7-7-7" /></svg>;
  return <svg className="bim-sort-icon bim-sort-icon-default" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9l4-4 4 4" /><path d="M8 15l4 4 4-4" /></svg>;
};

// Module-scope so React keeps input identity stable (no focus loss on keystroke).
const AttrCell = ({ field, value, onChange }) => {
  if (field.type === "dropdown")
    return (
      <select className="bim-inp" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  if (field.type === "number")
    return (
      <span className="bim-cellwrap">
        <input className="bim-inp" type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
        {field.unit && <span className="bim-unit">{field.unit}</span>}
      </span>
    );
  return <input className="bim-inp" value={value} onChange={(e) => onChange(e.target.value)} />;
};

export default function ItemMakesModal({ item, onClose, showError, showSuccess }) {
  const itemId = item?.id;
  const [variants, setVariants] = useState([]);
  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Inline edit + batch add
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [newRows, setNewRows] = useState([blankRow()]);

  // Sort + paging
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const res = await api.get(`/bom-items-master/${itemId}/variants`);
      setVariants(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError?.("Failed to load makes");
    } finally { setLoading(false); }
  }, [itemId, showError]);

  const loadSchema = useCallback(async () => {
    if (!itemId) return;
    if (item?.variantAttributes !== undefined) { setSchema(parseSchema(item.variantAttributes)); return; }
    try {
      const res = await api.get(`/bom-items-master/${itemId}`);
      setSchema(parseSchema(res?.data?.variantAttributes));
    } catch { /* non-fatal */ }
  }, [itemId, item]);

  useEffect(() => { load(); loadSchema(); }, [load, loadSchema]);

  // Display columns (Make · Model · one per attribute · [Description if no schema] · Status)
  const cols = useMemo(() => {
    const c = [
      { key: "make", label: "Make", get: (v) => (v.make || "").toLowerCase(), render: (v) => v.make || dash },
      { key: "model", label: "Model", get: (v) => (v.model || "").toLowerCase(), render: (v) => v.model || dash },
      ...schema.map((f) => ({
        key: `a:${f.key}`, label: f.label,
        get: (v) => (parseValues(v.attributeValues)[f.key] || "").toString().toLowerCase(),
        render: (v) => { const x = parseValues(v.attributeValues)[f.key]; return x ? `${x}${f.unit ? ` ${f.unit}` : ""}` : dash; },
      })),
    ];
    if (schema.length === 0) c.push({ key: "description", label: "Spec / description", get: (v) => (v.description || "").toLowerCase(), render: (v) => v.description || dash });
    c.push({ key: "isActive", label: "Status", get: (v) => (v.isActive === false ? 0 : 1), render: (v) => <span className={`bim-badge ${v.isActive === false ? "bim-badge-off" : "bim-badge-on"}`}>{v.isActive === false ? "Inactive" : "Active"}</span> });
    return c;
  }, [schema]);

  const onSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(key); setSortDir("asc"); }
    setPage(1);
  };
  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sortCol);
    const arr = [...variants];
    if (col) arr.sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      let c;
      if (typeof av === "number" && typeof bv === "number") c = av - bv;
      else c = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? c : -c;
    });
    return arr;
  }, [variants, cols, sortCol, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = sorted.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  // ── Validation + body shared by inline-edit and batch-add ──
  const validateMake = (d) => {
    if (!(d.make || "").trim() && !(d.model || "").trim()) return "Enter a make or model";
    for (const f of schema) {
      const v = (d.values?.[f.key] ?? "").toString().trim();
      if (!v) { if (f.required) return `${f.label} is required`; continue; }
      if (f.type === "number" && isNaN(Number(v))) return `${f.label} must be a number`;
      if (f.type === "dropdown" && !f.options.includes(v)) return `${f.label} must be one of its options`;
    }
    return null;
  };
  const makeBody = (d) => {
    const body = { make: (d.make || "").trim(), model: (d.model || "").trim(), description: (d.description || "").trim() };
    if (schema.length) {
      const clean = {};
      for (const f of schema) { const v = (d.values?.[f.key] ?? "").toString().trim(); if (v) clean[f.key] = v; }
      body.attributeValues = JSON.stringify(clean);
    }
    return body;
  };

  // ── Inline edit ──
  const startEdit = (v) => { setEditingId(v.id); setEditDraft({ make: v.make || "", model: v.model || "", description: v.description || "", values: parseValues(v.attributeValues) }); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const saveEdit = async () => {
    const err = validateMake(editDraft);
    if (err) { showError?.(err); return; }
    setBusy(true);
    try {
      await api.put(`/bom-item-variants/${editingId}`, makeBody(editDraft));
      cancelEdit();
      await load();
      showSuccess?.("Make updated");
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError?.(e.message || "Failed to save make"); }
    finally { setBusy(false); }
  };
  const editCell = (col, v) => {
    if (col.key === "isActive") return col.render(v);
    if (col.key === "make") return <input className="bim-inp" value={editDraft.make} onChange={(e) => setEditDraft((d) => ({ ...d, make: e.target.value }))} />;
    if (col.key === "model") return <input className="bim-inp" value={editDraft.model} onChange={(e) => setEditDraft((d) => ({ ...d, model: e.target.value }))} />;
    if (col.key === "description") return <input className="bim-inp" value={editDraft.description} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} />;
    if (col.key.startsWith("a:")) {
      const fk = col.key.slice(2); const f = schema.find((s) => s.key === fk);
      return <AttrCell field={f} value={editDraft.values?.[fk] ?? ""} onChange={(val) => setEditDraft((d) => ({ ...d, values: { ...d.values, [fk]: val } }))} />;
    }
    return null;
  };

  const deactivate = async (v) => {
    setBusy(true);
    try { await api.delete(`/bom-item-variants/${v.id}`); await load(); showSuccess?.("Make deactivated"); }
    catch (e) { if (e.message !== "SESSION_EXPIRED") showError?.("Failed to deactivate make"); }
    finally { setBusy(false); }
  };

  // ── Batch add ──
  const patchNew = (idx, patch) => setNewRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const patchNewVal = (idx, key, val) => setNewRows((rows) => rows.map((r, i) => (i === idx ? { ...r, values: { ...r.values, [key]: val } } : r)));
  const addNewRow = () => setNewRows((rows) => [...rows, blankRow()]);
  const removeNewRow = (idx) => setNewRows((rows) => (rows.length === 1 ? [blankRow()] : rows.filter((_, i) => i !== idx)));
  const rowHasContent = (r) => (r.make || "").trim() || (r.model || "").trim() || Object.values(r.values || {}).some((x) => `${x}`.trim());
  const saveNewRows = async () => {
    const rows = newRows.filter(rowHasContent);
    if (!rows.length) { showError?.("Add at least one make first"); return; }
    for (const r of rows) { const err = validateMake(r); if (err) { showError?.(err); return; } }
    setBusy(true);
    try {
      for (const r of rows) { await api.post(`/bom-items-master/${itemId}/variants`, makeBody(r)); }
      setNewRows([blankRow()]);
      await load();
      showSuccess?.(`${rows.length} make${rows.length > 1 ? "s" : ""} added`);
    } catch (e) { if (e.message !== "SESSION_EXPIRED") showError?.(e.message || "Failed to add makes"); }
    finally { setBusy(false); }
  };

  if (!item) return null;

  return (
    <div className="bim-overlay" onMouseDown={onClose}>
      <div className="bim-modal bim-modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bim-modal-head">
          <div className="bim-modal-title">Makes for “{item.itemName}”</div>
          <button className="bim-iconbtn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        <div className="bim-modal-body">
          <div className="bim-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            The makes available for this item. Curate which ones a template line allows (and the default) in the template’s BOM tab.
          </div>

          {/* ── Existing makes table ── */}
          {loading ? (
            <div className="bim-muted" style={{ padding: 12 }}>Loading…</div>
          ) : (
            <div className="bim-table-wrap">
              <div className="bim-table-scroll">
                <table className="bim-table">
                  <thead>
                    <tr>
                      {cols.map((col) => (
                        <th key={col.key} className="bim-th" onClick={() => onSort(col.key)} title="Click to sort">
                          <span className="bim-th-content">{col.label}<SortIcon dir={sortCol === col.key ? sortDir : null} /></span>
                        </th>
                      ))}
                      <th style={{ width: 1 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 && (
                      <tr><td colSpan={cols.length + 1} className="bim-muted" style={{ padding: 14 }}>No makes yet. Add some below.</td></tr>
                    )}
                    {pageRows.map((v) => {
                      const editing = editingId === v.id;
                      return (
                        <tr key={v.id} style={{ opacity: v.isActive === false && !editing ? 0.6 : 1 }}>
                          {cols.map((col) => (
                            <td key={col.key}>{editing && col.key !== "isActive" ? editCell(col, v) : col.render(v)}</td>
                          ))}
                          <td>
                            <div className="bim-actions">
                              {editing ? (
                                <>
                                  <button className="bim-btn bim-btn-primary bim-btn-sm" disabled={busy} onClick={saveEdit}><Check size={13} /> Save</button>
                                  <button className="bim-btn bim-btn-secondary bim-btn-sm" onClick={cancelEdit}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button className="bim-iconbtn" title="Edit" onClick={() => startEdit(v)}><Pencil size={15} /></button>
                                  {v.isActive !== false && (
                                    <button className="bim-iconbtn bim-iconbtn-danger" title="Deactivate" onClick={() => deactivate(v)}><Trash2 size={15} /></button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sorted.length > pageSize && (
                <div className="bim-pager">
                  <div className="bim-pager-info">{sorted.length} make{sorted.length !== 1 ? "s" : ""}</div>
                  <div className="bim-pager-size">
                    Rows
                    <select className="bim-inp" style={{ padding: "4px 6px" }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                      {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="bim-pager-btns">
                    <button className="bim-pager-btn" disabled={pageClamped === 1} onClick={() => setPage(pageClamped - 1)}>‹</button>
                    {pageNumbers(pageClamped, totalPages).map((p) => (
                      <button key={p} className={`bim-pager-btn ${p === pageClamped ? "bim-pager-btn-active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                    ))}
                    <button className="bim-pager-btn" disabled={pageClamped === totalPages} onClick={() => setPage(pageClamped + 1)}>›</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Batch add: editable grid ── */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ct-111827,#111827)" }}>Add makes</div>
            <div className="bim-muted" style={{ fontSize: 11, margin: "2px 0 6px" }}>
              One row per make{schema.length ? " — dropdown / number cells match the item's attributes" : ""}. Add rows, then Save all.
            </div>
            <div className="bim-grid-wrap">
              <table className="bim-grid">
                <thead>
                  <tr>
                    <th>Make</th>
                    <th>Model</th>
                    {schema.length === 0 && <th>Spec / description</th>}
                    {schema.map((f) => (
                      <th key={f.key}>{f.label}{f.required ? <span className="bim-req-star"> *</span> : null}{f.unit ? ` (${f.unit})` : ""}</th>
                    ))}
                    <th style={{ width: 1 }} />
                  </tr>
                </thead>
                <tbody>
                  {newRows.map((r, idx) => (
                    <tr key={idx}>
                      <td><input className="bim-inp" value={r.make} placeholder="brand" onChange={(e) => patchNew(idx, { make: e.target.value })} /></td>
                      <td><input className="bim-inp" value={r.model} placeholder="model" onChange={(e) => patchNew(idx, { model: e.target.value })} /></td>
                      {schema.length === 0 && <td><input className="bim-inp" value={r.description} placeholder="spec" onChange={(e) => patchNew(idx, { description: e.target.value })} /></td>}
                      {schema.map((f) => (
                        <td key={f.key}><AttrCell field={f} value={r.values?.[f.key] ?? ""} onChange={(val) => patchNewVal(idx, f.key, val)} /></td>
                      ))}
                      <td><button type="button" className="bim-attr-x" title="Remove row" onClick={() => removeNewRow(idx)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="bim-btn bim-btn-secondary bim-btn-sm" onClick={addNewRow}><Plus size={13} /> Add row</button>
              <button className="bim-btn bim-btn-primary bim-btn-sm" onClick={saveNewRows} disabled={busy}>
                {busy ? "Saving…" : <><Save size={13} /> Save makes</>}
              </button>
            </div>
          </div>
        </div>

        <div className="bim-modal-foot">
          <button className="bim-btn bim-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
