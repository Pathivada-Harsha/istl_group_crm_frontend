// ─────────────────────────────────────────────────────────────────────────────
//  BomItemsMaster — master-data admin for the BOM catalog (bom_items_master).
//  Restyled to the Leads-Enquire design system (self-contained: no coupling to
//  that page's CSS). Catalog table has sortable + draggable columns and paging;
//  the item modal's variant-attribute builder supports drag-to-reorder fields.
//
//  Two modes:
//   • Catalog  — the flat item list (search + category), create/edit/deactivate
//                items and manage each item's makes.
//   • Subgroup — pick Group → Subgroup (DB taxonomy) to see the items already
//                used in that subgroup's TEMPLATE BOM (e.g. Rooftop). "Adopt"
//                brings a free-text BOM line into the catalog and links it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Save, X, Layers, Download, GripVertical } from "lucide-react";
import api from "../services/leadsapi.js";
import filterApi from "../services/filterApi.js";
import useToast from "../hooks/useToast";
import ToastContainer from "../components/Notification_Toast/ToastContainer.js";
import ConfirmationModal from "../components/ConfirmationModal.js";
import useConfirmationModal from "../components/HandleConfirmationModal.js";
import ItemMakesModal from "../components/ItemMakesModal.js";
import "../pages-css/BomItemsMaster.css";

const emptyForm = () => ({
  id: null, category: "", itemName: "", specification: "", description: "",
  defaultUnit: "Nos", defaultTaxPercent: 18, hsnCode: "", isActive: true,
  variantAttributes: [], // [{ key, label, type:"text"|"dropdown"|"number", optionsText, unit, required, keyLocked }]
});

// label → stable machine key, e.g. "Max DC Voltage" → "max_dc_voltage"
const slugify = (s) =>
  (s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// The item stores its schema as a JSON string; parse it to the array the builder edits.
const parseAttrs = (raw) => {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => ({
    key: f.key || "", label: f.label || "", type: f.type || "text",
    optionsText: Array.isArray(f.options) ? f.options.join(", ") : "",
    unit: f.unit || "", required: !!f.required,
    keyLocked: !!(f.key && f.key.trim()), // loaded keys stay frozen so a rename can't orphan values
  }));
};

// ── Sort / drag icons (inline SVG, matches Leads-Enquire) ──────────────────────
const SortIcon = ({ dir }) => {
  if (dir === "asc") return <svg className="bim-sort-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>;
  if (dir === "desc") return <svg className="bim-sort-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l-7 7-7-7" /></svg>;
  return <svg className="bim-sort-icon bim-sort-icon-default" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9l4-4 4 4" /><path d="M8 15l4 4 4-4" /></svg>;
};
const ColHandle = () => (
  <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
    <circle cx="1.5" cy="2" r="1.1" /><circle cx="6.5" cy="2" r="1.1" />
    <circle cx="1.5" cy="7" r="1.1" /><circle cx="6.5" cy="7" r="1.1" />
    <circle cx="1.5" cy="12" r="1.1" /><circle cx="6.5" cy="12" r="1.1" />
  </svg>
);

// Catalog columns — order is user-draggable, each is click-to-sort.
const CATALOG_COLS = [
  { key: "category", label: "Category", get: (it) => (it.category || "").toLowerCase(), render: (it) => it.category },
  { key: "itemName", label: "Item name", get: (it) => (it.itemName || "").toLowerCase(), render: (it) => <span style={{ fontWeight: 600, color: "var(--ct-111827,#111827)" }}>{it.itemName}</span> },
  { key: "specification", label: "Specification", get: (it) => (it.specification || "").toLowerCase(), render: (it) => <span className="bim-muted" style={{ display: "inline-block", maxWidth: 300, whiteSpace: "pre-wrap" }}>{it.specification || "—"}</span> },
  { key: "defaultUnit", label: "Unit", get: (it) => (it.defaultUnit || "").toLowerCase(), render: (it) => it.defaultUnit || "—" },
  { key: "defaultTaxPercent", label: "Tax %", get: (it) => (it.defaultTaxPercent == null ? -1 : Number(it.defaultTaxPercent)), render: (it) => (it.defaultTaxPercent != null ? `${it.defaultTaxPercent}%` : "—") },
  { key: "hsnCode", label: "HSN", get: (it) => (it.hsnCode || "").toLowerCase(), render: (it) => it.hsnCode || <span className="bim-muted">—</span> },
  { key: "isActive", label: "Status", get: (it) => (it.isActive === false ? 0 : 1), render: (it) => <span className={`bim-badge ${it.isActive === false ? "bim-badge-off" : "bim-badge-on"}`}>{it.isActive === false ? "Inactive" : "Active"}</span> },
];

const pageNumbers = (current, totalP) => {
  const out = [];
  const start = Math.max(1, current - 2), end = Math.min(totalP, current + 2);
  for (let p = start; p <= end; p++) out.push(p);
  return out;
};

export default function BomItemsMaster() {
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { confirmModal, showConfirmation } = useConfirmationModal();

  // Catalog (flat) mode
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  // Taxonomy (subgroup) mode
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [group, setGroup] = useState("");
  const [subGroup, setSubGroup] = useState("");
  const [subItems, setSubItems] = useState([]);
  // Category is chosen via Group → Subgroup in the add/edit form.
  const [sgByGroup, setSgByGroup] = useState({}); // groupValue -> [{value,label}]
  const [sgIndex, setSgIndex] = useState({});     // subGroupValue -> groupValue
  const [formGroup, setFormGroup] = useState("");

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [attrErrors, setAttrErrors] = useState({});
  const [makesItem, setMakesItem] = useState(null);
  const [adopting, setAdopting] = useState(null);

  // Table sort / paging / column order
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [colOrder, setColOrder] = useState(CATALOG_COLS.map((c) => c.key));
  const dragCol = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  // Builder field drag
  const dragAttr = useRef(null);
  const [dragOverAttr, setDragOverAttr] = useState(null);

  const inSubgroupMode = !!subGroup;

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      const res = await api.get("/bom-items-master/admin", { params });
      setItems(res?.success ? (res.data || []) : []);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to load items");
    } finally { setLoading(false); }
  }, [search, category, showError]);

  const loadSubItems = useCallback(async () => {
    if (!subGroup) return;
    setLoading(true);
    try {
      const res = await api.get("/bom-items-master/by-subgroup", { params: { subGroup } });
      setSubItems(res?.success ? (res.data || []) : []);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to load subgroup BOM items");
    } finally { setLoading(false); }
  }, [subGroup, showError]);

  const reload = useCallback(() => (subGroup ? loadSubItems() : loadCatalog()), [subGroup, loadSubItems, loadCatalog]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/bom-items-master/categories");
        setCategories(res?.success ? (res.data || []) : []);
      } catch { /* non-fatal */ }
      try {
        const g = await filterApi.getAllGroups();
        const groupsArr = Array.isArray(g) ? g : [];
        setGroups(groupsArr);
        const entries = await Promise.all(groupsArr.map(async (grp) => {
          try {
            const sg = await filterApi.getSubGroups(grp.value);
            return [grp.value, Array.isArray(sg) ? sg : []];
          } catch { return [grp.value, []]; }
        }));
        const byGroup = {}; const index = {};
        for (const [gv, sgs] of entries) {
          byGroup[gv] = sgs;
          for (const sg of sgs) index[sg.value] = gv;
        }
        setSgByGroup(byGroup);
        setSgIndex(index);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const onFormGroupChange = (val) => {
    setFormGroup(val);
    setForm((f) => ({ ...f, category: "" }));
  };

  const onGroupChange = async (val) => {
    setGroup(val); setSubGroup(""); setSubGroups([]);
    if (!val) return;
    try {
      const sg = await filterApi.getSubGroups(val);
      setSubGroups(Array.isArray(sg) ? sg : []);
    } catch { showError("Failed to load subgroups"); }
  };

  const openCreate = () => { setFormGroup(""); setAttrErrors({}); setForm(emptyForm()); };
  const openEdit = (it) => {
    const cat = it.category || "";
    setFormGroup(sgIndex[cat] || "");
    setAttrErrors({});
    setForm({
      id: it.id, category: cat, itemName: it.itemName || "",
      specification: it.specification || "", description: it.description || "",
      defaultUnit: it.defaultUnit || "Nos", defaultTaxPercent: it.defaultTaxPercent ?? 18,
      hsnCode: it.hsnCode || "", isActive: it.isActive !== false,
      variantAttributes: parseAttrs(it.variantAttributes),
    });
  };
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── Variant-attribute schema builder ────────────────────────────────────────
  const addAttr = () => { setAttrErrors({}); setForm((f) => ({
    ...f, variantAttributes: [...f.variantAttributes, { key: "", label: "", type: "text", optionsText: "", unit: "", required: false, keyLocked: false }],
  })); };
  const removeAttr = (i) => { setAttrErrors({}); setForm((f) => ({
    ...f, variantAttributes: f.variantAttributes.filter((_, idx) => idx !== i),
  })); };
  const updateAttr = (i, patch) => { setAttrErrors({}); setForm((f) => ({
    ...f, variantAttributes: f.variantAttributes.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
  })); };
  const onAttrLabel = (i, label) => { setAttrErrors({}); setForm((f) => ({
    ...f,
    variantAttributes: f.variantAttributes.map((a, idx) =>
      idx === i ? { ...a, label, key: a.keyLocked ? a.key : slugify(label) } : a),
  })); };
  const onAttrKey = (i, key) => updateAttr(i, { key, keyLocked: true });
  const onAttrType = (i, type) => updateAttr(i, { type, optionsText: "", unit: "" });

  // Drag-to-reorder attribute fields (native HTML5 DnD; grip is the handle).
  const onAttrDragStart = (e, i) => { dragAttr.current = i; e.dataTransfer.effectAllowed = "move"; };
  const onAttrDragOver = (e, i) => { e.preventDefault(); if (dragOverAttr !== i) setDragOverAttr(i); };
  const onAttrDrop = (e, i) => {
    e.preventDefault();
    const from = dragAttr.current;
    setDragOverAttr(null); dragAttr.current = null;
    if (from == null || from === i) return;
    setAttrErrors({});
    setForm((f) => {
      const a = [...f.variantAttributes];
      const [moved] = a.splice(from, 1);
      a.splice(i, 0, moved);
      return { ...f, variantAttributes: a };
    });
  };
  const onAttrDragEnd = () => { setDragOverAttr(null); dragAttr.current = null; };

  const saveForm = async () => {
    if (!form.itemName.trim()) { showError("Item name is required"); return; }

    const attrs = form.variantAttributes || [];
    const optsOf = (a) => (a.optionsText || "").split(",").map((o) => o.trim()).filter(Boolean);
    const keyOf = (a) => slugify(a.key) || slugify(a.label);
    const errs = {};
    const seen = new Map();
    attrs.forEach((a, i) => {
      if (!a.label.trim()) { errs[i] = "Label is required."; return; }
      const key = keyOf(a);
      if (!key) { errs[i] = "Key can’t be empty — use letters or digits."; return; }
      if (seen.has(key)) { errs[i] = `Duplicate key “${key}”.`; return; }
      seen.set(key, i);
      if (a.type === "dropdown" && optsOf(a).length === 0) { errs[i] = "Add at least one option."; return; }
    });
    if (Object.keys(errs).length) { setAttrErrors(errs); return; }
    setAttrErrors({});

    setSaving(true);
    const cleanAttrs = attrs.map((a) => {
      const out = { key: keyOf(a), label: a.label.trim(), type: a.type, required: !!a.required };
      if (a.type === "dropdown") out.options = optsOf(a);
      if (a.type === "number" && a.unit && a.unit.trim()) out.unit = a.unit.trim();
      return out;
    });
    const body = {
      category: form.category.trim() || "COMMON", itemName: form.itemName.trim(),
      specification: form.specification || null, description: form.description || null,
      defaultUnit: form.defaultUnit || null,
      defaultTaxPercent: form.defaultTaxPercent === "" || form.defaultTaxPercent == null ? null : Number(form.defaultTaxPercent),
      hsnCode: form.hsnCode || null, isActive: form.isActive,
      variantAttributes: cleanAttrs.length ? JSON.stringify(cleanAttrs) : null,
    };
    try {
      const res = form.id
        ? await api.put(`/bom-items-master/${form.id}`, body)
        : await api.post(`/bom-items-master`, body);
      if (res?.success) {
        showSuccess(form.id ? "Item updated" : "Item created");
        setForm(null);
        await reload();
      } else {
        showError(res?.message || "Failed to save item");
      }
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to save item");
    } finally { setSaving(false); }
  };

  const deactivate = async (it) => {
    const ok = await showConfirmation({
      title: "Deactivate item", type: "alert",
      message: `Deactivate "${it.itemName}"? It stops appearing in pickers but is kept.`,
      confirmText: "Deactivate", cancelText: "Cancel",
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/bom-items-master/${it.id}`);
      if (res?.success) { showSuccess("Item deactivated"); await reload(); }
      else showError(res?.message || "Failed to deactivate");
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to deactivate");
    }
  };

  const adopt = async (row) => {
    setAdopting(row.templateItemId);
    try {
      const res = await api.post(`/bom-items-master/adopt`, null, { params: { templateItemId: row.templateItemId } });
      if (res?.success) { showSuccess(`“${row.itemName}” is now in the catalog`); await loadSubItems(); }
      else showError(res?.message || "Failed to adopt item");
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to adopt item");
    } finally { setAdopting(null); }
  };

  // ── Sort / paginate (client-side) ───────────────────────────────────────────
  const onSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(key); setSortDir("asc"); }
    setPage(1);
  };
  const sortedItems = useMemo(() => {
    const col = CATALOG_COLS.find((c) => c.key === sortCol);
    const arr = [...items];
    if (col) {
      arr.sort((a, b) => {
        const av = col.get(a), bv = col.get(b);
        let c;
        if (typeof av === "number" && typeof bv === "number") c = av - bv;
        else c = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? c : -c;
      });
    }
    return arr;
  }, [items, sortCol, sortDir]);
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = sortedItems.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);
  const orderedCols = colOrder.map((k) => CATALOG_COLS.find((c) => c.key === k)).filter(Boolean);

  // Column drag (reorder)
  const onColDragStart = (e, key) => { dragCol.current = key; e.dataTransfer.effectAllowed = "move"; };
  const onColDragOver = (e, key) => { e.preventDefault(); if (dragOverCol !== key) setDragOverCol(key); };
  const onColDrop = (e, key) => {
    e.preventDefault();
    const from = dragCol.current;
    setDragOverCol(null); dragCol.current = null;
    if (!from || from === key) return;
    setColOrder((o) => {
      const a = [...o];
      a.splice(a.indexOf(from), 1);
      a.splice(a.indexOf(key), 0, from);
      return a;
    });
  };
  const onColDragEnd = () => { setDragOverCol(null); dragCol.current = null; };

  return (
    <div className="bim-page">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal {...confirmModal} />

      <div className="bim-head">
        <div>
          <div className="bim-title">Master Items (BOM catalog)</div>
          <div className="bim-sub">Catalog items, their variant attributes, and makes.</div>
        </div>
      </div>

      <div className="bim-actionbar">
        <select className="bim-inp" value={group} onChange={(e) => onGroupChange(e.target.value)}>
          <option value="">— Group —</option>
          {groups.map((g) => <option key={g.value} value={g.value}>{g.label || g.value}</option>)}
        </select>
        <select className="bim-inp" value={subGroup} onChange={(e) => setSubGroup(e.target.value)} disabled={!group}>
          <option value="">{group ? "— Subgroup —" : "pick a group"}</option>
          {subGroups.map((sg) => <option key={sg.value} value={sg.value}>{sg.label || sg.value}</option>)}
        </select>

        {!inSubgroupMode && (
          <>
            <div className="bim-search">
              <Search size={14} />
              <input className="bim-inp" placeholder="Search name / spec / make"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="bim-inp" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="bim-spacer" />
            <button className="bim-btn bim-btn-primary" onClick={openCreate}><Plus size={15} /> Add item</button>
          </>
        )}
      </div>

      {inSubgroupMode && (
        <div className="bim-muted" style={{ marginBottom: 10, fontSize: 12.5 }}>
          Items in the <b>{subGroups.find((s) => s.value === subGroup)?.label || subGroup}</b> template BOM.
          “Adopt” brings a line into the catalog so you can edit its spec + makes.
        </div>
      )}

      {loading ? (
        <div className="bim-muted" style={{ padding: 16 }}>Loading…</div>
      ) : inSubgroupMode ? (
        /* ── Subgroup BOM view ── */
        <div className="bim-table-wrap">
          <div className="bim-table-scroll">
            <table className="bim-table">
              <thead>
                <tr><th>Scope activity</th><th>Item</th><th>Make</th><th>Specification</th><th>In catalog</th><th /></tr>
              </thead>
              <tbody>
                {subItems.length === 0 && (
                  <tr><td colSpan={6} className="bim-muted" style={{ padding: 16 }}>
                    No template BOM for this subgroup yet. Build one in Lead Scope / BOM Templates.
                  </td></tr>
                )}
                {subItems.map((r) => (
                  <tr key={r.templateItemId}>
                    <td className="bim-muted">{r.scopeActivity || "General"}</td>
                    <td style={{ fontWeight: 600 }}>{r.itemName}</td>
                    <td>{r.make || <span className="bim-muted">—</span>}</td>
                    <td className="bim-muted" style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>{r.specification || "—"}</td>
                    <td>{r.bomItemId ? <span className="bim-badge bim-badge-on">In catalog</span> : <span className="bim-badge bim-badge-off">Not linked</span>}</td>
                    <td>
                      <div className="bim-actions">
                        {r.bomItemId ? (
                          <>
                            <button className="bim-btn bim-btn-secondary bim-btn-sm" onClick={() => setMakesItem({ id: r.bomItemId, itemName: r.catalogItem?.itemName || r.itemName })}><Layers size={13} /> Makes</button>
                            {r.catalogItem && (
                              <button className="bim-btn bim-btn-secondary bim-btn-sm" onClick={() => openEdit(r.catalogItem)}><Pencil size={13} /> Spec</button>
                            )}
                          </>
                        ) : (
                          <button className="bim-btn bim-btn-primary bim-btn-sm" disabled={adopting === r.templateItemId} onClick={() => adopt(r)}>
                            {adopting === r.templateItemId ? "Adopting…" : <><Download size={13} /> Adopt</>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Flat catalog view (sortable + draggable columns, paged) ── */
        <div className="bim-table-wrap">
          <div className="bim-table-scroll">
            <table className="bim-table">
              <thead>
                <tr>
                  {orderedCols.map((col) => (
                    <th key={col.key} className={`bim-th ${dragOverCol === col.key ? "bim-col-drag-over" : ""} ${dragCol.current === col.key ? "bim-col-dragging" : ""}`}
                      draggable onDragStart={(e) => onColDragStart(e, col.key)} onDragOver={(e) => onColDragOver(e, col.key)}
                      onDrop={(e) => onColDrop(e, col.key)} onDragEnd={onColDragEnd}
                      onClick={() => onSort(col.key)} title="Click to sort · drag to reorder">
                      <span className="bim-th-content">
                        <span className="bim-th-handle"><ColHandle /></span>
                        {col.label}
                        <SortIcon dir={sortCol === col.key ? sortDir : null} />
                      </span>
                    </th>
                  ))}
                  <th style={{ width: 1 }} />
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr><td colSpan={orderedCols.length + 1} className="bim-muted" style={{ padding: 16 }}>No items. Click “Add item”.</td></tr>
                )}
                {pageItems.map((it) => (
                  <tr key={it.id} style={{ opacity: it.isActive === false ? 0.55 : 1 }}>
                    {orderedCols.map((col) => <td key={col.key}>{col.render(it)}</td>)}
                    <td>
                      <div className="bim-actions">
                        <button className="bim-iconbtn" title="Manage makes" onClick={() => setMakesItem(it)}><Layers size={15} /></button>
                        <button className="bim-iconbtn" title="Edit" onClick={() => openEdit(it)}><Pencil size={15} /></button>
                        {it.isActive !== false && (
                          <button className="bim-iconbtn bim-iconbtn-danger" title="Deactivate" onClick={() => deactivate(it)}><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bim-pager">
            <div className="bim-pager-info">{totalItems} item{totalItems !== 1 ? "s" : ""}</div>
            <div className="bim-pager-size">
              Rows
              <select className="bim-inp" style={{ padding: "4px 6px" }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="bim-pager-btns">
              <button className="bim-pager-btn" disabled={pageClamped === 1} onClick={() => setPage(1)}>«</button>
              <button className="bim-pager-btn" disabled={pageClamped === 1} onClick={() => setPage(pageClamped - 1)}>‹</button>
              {pageNumbers(pageClamped, totalPages).map((p) => (
                <button key={p} className={`bim-pager-btn ${p === pageClamped ? "bim-pager-btn-active" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="bim-pager-btn" disabled={pageClamped === totalPages} onClick={() => setPage(pageClamped + 1)}>›</button>
              <button className="bim-pager-btn" disabled={pageClamped === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="bim-overlay" onMouseDown={() => !saving && setForm(null)}>
          <div className="bim-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="bim-modal-head">
              <div className="bim-modal-title">{form.id ? "Edit item" : "Add item"}</div>
              <button className="bim-iconbtn" onClick={() => setForm(null)}><X size={18} /></button>
            </div>

            <div className="bim-modal-body">
              <div className="bim-field">
                <label>Category — Group → Subgroup</label>
                <div className="bim-grid2">
                  <select className="bim-inp" value={formGroup} onChange={(e) => onFormGroupChange(e.target.value)}>
                    <option value="">— Group —</option>
                    {groups.map((g) => <option key={g.value} value={g.value}>{g.label || g.value}</option>)}
                  </select>
                  <select className="bim-inp" value={form.category} onChange={(e) => setF("category", e.target.value)} disabled={!formGroup}>
                    <option value="">{formGroup ? "— Subgroup (optional) —" : "pick a group"}</option>
                    {(sgByGroup[formGroup] || []).map((sg) => <option key={sg.value} value={sg.value}>{sg.label || sg.value}</option>)}
                  </select>
                </div>
                {form.category && !formGroup ? (
                  <div className="bim-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Current category: <b>{form.category}</b> — legacy value, kept unless you pick a subgroup above.
                  </div>
                ) : (
                  <div className="bim-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Subgroup is optional — leave it empty for a cross-subgroup catalog item (filed under <b>COMMON</b>).
                  </div>
                )}
              </div>

              <div className="bim-field">
                <label>Item name *</label>
                <input className="bim-inp" value={form.itemName}
                  onChange={(e) => setF("itemName", e.target.value)} placeholder="e.g. Solar Module" />
              </div>

              <div className="bim-field">
                <label>Specification</label>
                <textarea className="bim-inp" rows={3} value={form.specification}
                  onChange={(e) => setF("specification", e.target.value)} placeholder="Base spec text for this item" />
              </div>
              <div className="bim-field">
                <label>Description</label>
                <textarea className="bim-inp" rows={2} value={form.description}
                  onChange={(e) => setF("description", e.target.value)} />
              </div>

              <div className="bim-grid2">
                <div className="bim-field">
                  <label>Default unit</label>
                  <input className="bim-inp" value={form.defaultUnit} onChange={(e) => setF("defaultUnit", e.target.value)} />
                </div>
                <div className="bim-field">
                  <label>Default tax %</label>
                  <input className="bim-inp" type="number" min="0" step="any" value={form.defaultTaxPercent}
                    onChange={(e) => setF("defaultTaxPercent", e.target.value)} />
                </div>
              </div>
              <div className="bim-field">
                <label>HSN code</label>
                <input className="bim-inp" value={form.hsnCode} onChange={(e) => setF("hsnCode", e.target.value)} />
              </div>

              {/* ── Variant-attribute builder (drag to reorder) ── */}
              <div className="bim-field">
                <label>Variant attributes</label>
                <div className="bim-muted" style={{ fontSize: 11, marginBottom: 6 }}>
                  Fields each variant (make) of this item fills — e.g. wattage, cell type, face. Drag <GripVertical size={11} style={{ verticalAlign: "-2px" }} /> to reorder.
                </div>

                {(form.variantAttributes || []).length === 0 ? (
                  <div className="bim-muted" style={{ fontSize: 12, padding: "4px 0" }}>
                    No attributes; variants use make/model only.
                  </div>
                ) : (
                  <div className="bim-attrs">
                    {form.variantAttributes.map((a, i) => (
                      <div key={i}
                        className={`bim-attr ${dragOverAttr === i ? "bim-attr-dragover" : ""}`}
                        onDragOver={(e) => onAttrDragOver(e, i)} onDrop={(e) => onAttrDrop(e, i)}>
                        <div className="bim-attr-top">
                          <span className="bim-attr-grip" draggable onDragStart={(e) => onAttrDragStart(e, i)} onDragEnd={onAttrDragEnd} title="Drag to reorder">
                            <GripVertical size={15} />
                          </span>
                          <input className="bim-inp" style={{ flex: "2 1 130px" }} placeholder="Label e.g. Cell Type"
                            value={a.label} onChange={(e) => onAttrLabel(i, e.target.value)} />
                          <select className="bim-inp" style={{ flex: "0 0 108px" }} value={a.type} onChange={(e) => onAttrType(i, e.target.value)}>
                            <option value="text">Text</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="number">Number</option>
                          </select>
                          <label className="bim-attr-req" title="A variant must fill this field">
                            <input type="checkbox" checked={a.required} onChange={(e) => updateAttr(i, { required: e.target.checked })} /> Req
                          </label>
                          <button type="button" className="bim-attr-x" title="Remove field" onClick={() => removeAttr(i)}>×</button>
                        </div>
                        <div className="bim-attr-top" style={{ marginTop: 6 }}>
                          <input className="bim-inp bim-attr-keyinp" style={{ flex: "0 0 150px" }} placeholder="key"
                            title="Machine key — auto from label, editable"
                            value={a.key} onChange={(e) => onAttrKey(i, e.target.value)} />
                          {a.type === "dropdown" && (
                            <input className="bim-inp" style={{ flex: 1, minWidth: 160 }} value={a.optionsText}
                              placeholder="Options, comma-separated e.g. Monofacial, Bifacial"
                              onChange={(e) => updateAttr(i, { optionsText: e.target.value })} />
                          )}
                          {a.type === "number" && (
                            <input className="bim-inp" style={{ flex: "0 0 150px" }} value={a.unit}
                              placeholder="Unit e.g. Wp, kW" onChange={(e) => updateAttr(i, { unit: e.target.value })} />
                          )}
                        </div>
                        {attrErrors[i] && <div className="bim-attr-err">{attrErrors[i]}</div>}
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" className="bim-btn bim-btn-secondary bim-btn-sm" style={{ marginTop: 8 }} onClick={addAttr}>
                  <Plus size={13} /> Add field
                </button>
              </div>

              {form.id && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 4 }}>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setF("isActive", e.target.checked)} /> Active
                </label>
              )}
            </div>

            <div className="bim-modal-foot">
              <button className="bim-btn bim-btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="bim-btn bim-btn-primary" onClick={saveForm} disabled={saving}>
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {makesItem && (
        <ItemMakesModal item={makesItem} onClose={() => { setMakesItem(null); if (subGroup) loadSubItems(); }}
          showError={showError} showSuccess={showSuccess} />
      )}
    </div>
  );
}
