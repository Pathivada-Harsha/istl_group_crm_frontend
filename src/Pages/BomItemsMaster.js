// ─────────────────────────────────────────────────────────────────────────────
//  BomItemsMaster — master-data admin for the BOM catalog (bom_items_master).
//  This is the FIRST step: define catalog items, their variant-attribute schema,
//  and each item's makes. Attaching a BOM to a lead happens later on the Lead
//  Scope / BOM Templates page — this page deliberately does not browse or adopt
//  from past project BOMs.
//
//  Styled to the Leads-Enquire design system (self-contained bim-* classes).
//  The catalog table has sortable + draggable columns and paging; the item modal's
//  variant-attribute builder supports drag-to-reorder fields.
//
//  Excel: Template / Export / Import move a whole catalog (items + attribute
//  schema + makes) between servers instead of re-typing it. See BomCatalogExcel.js.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Save, X, Layers, GripVertical, Download, Upload } from "lucide-react";
import api from "../services/leadsapi.js";
import filterApi from "../services/filterApi.js";
import useToast from "../hooks/useToast";
import ToastContainer from "../components/Notification_Toast/ToastContainer.js";
import ConfirmationModal from "../components/ConfirmationModal.js";
import useConfirmationModal from "../components/HandleConfirmationModal.js";
import ItemMakesModal from "../components/ItemMakesModal.js";
import { downloadStyledWorkbook, readWorkbookSheets } from "../components/Leads/bomExcel.js";
import { buildSheets, buildTemplateSheets, parseWorkbook, parseSchemaStr, valuesFromRow } from "../components/BomCatalogExcel.js";
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

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  // Category is chosen via Group → Subgroup inside the add/edit form.
  const [groups, setGroups] = useState([]);
  const [sgByGroup, setSgByGroup] = useState({}); // groupValue -> [{value,label}]
  const [sgIndex, setSgIndex] = useState({});     // subGroupValue -> groupValue
  const [formGroup, setFormGroup] = useState("");
  // Toolbar taxonomy FILTER (narrows the catalog only — it never pulls template/
  // past-project BOM lines). The Subgroup select writes into `category`, which is
  // already the server-side filter param, so the two stay in sync automatically.
  const [filterGroup, setFilterGroup] = useState("");

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [attrErrors, setAttrErrors] = useState({});
  const [makesItem, setMakesItem] = useState(null);

  // Excel
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [imp, setImp] = useState(null); // { stage:"preview"|"running"|"done", … }

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

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

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

  // Toolbar filter: switching group clears the chosen subgroup (= category).
  const onFilterGroupChange = (val) => { setFilterGroup(val); setCategory(""); setPage(1); };

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
        await loadCatalog();
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
      if (res?.success) { showSuccess("Item deactivated"); await loadCatalog(); }
      else showError(res?.message || "Failed to deactivate");
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to deactivate");
    }
  };

  // ── Excel: template / export / import ───────────────────────────────────────
  const downloadTemplate = () => downloadStyledWorkbook(buildTemplateSheets(), "bom_catalog_template.xlsx");

  const exportCatalog = async () => {
    setExporting(true);
    try {
      const res = await api.get("/bom-items-master/admin");
      const list = res?.success ? (res.data || []) : [];
      const makesByItemId = {};
      for (const it of list) {
        try {
          const vr = await api.get(`/bom-items-master/${it.id}/variants`);
          makesByItemId[it.id] = Array.isArray(vr?.data) ? vr.data : [];
        } catch { makesByItemId[it.id] = []; }
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadStyledWorkbook(buildSheets(list, makesByItemId), `bom_catalog_${stamp}.xlsx`);
      showSuccess(`Exported ${list.length} item(s)`);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError("Failed to export catalog");
    } finally { setExporting(false); }
  };

  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // let the same file be picked again
    if (!file) return;
    try {
      const sheets = await readWorkbookSheets(file);
      const { items: parsed, errors } = parseWorkbook(sheets);
      if (!parsed.length) { setImp({ stage: "preview", parsed: [], errors, counts: null }); return; }
      const res = await api.get("/bom-items-master/admin");
      const existing = res?.success ? (res.data || []) : [];
      const existingByName = new Map(existing.map((it) => [String(it.itemName || "").trim().toLowerCase(), it]));
      let toCreate = 0, toUpdate = 0, makes = 0;
      parsed.forEach((p) => {
        if (existingByName.has(p.name.toLowerCase())) toUpdate++; else toCreate++;
        makes += p.makes.length;
      });
      setImp({ stage: "preview", parsed, errors, existingByName, counts: { toCreate, toUpdate, makes } });
    } catch {
      showError("Could not read the file. Use the Template format (.xlsx, .xls or .csv).");
    }
  };

  const runImport = async () => {
    const { parsed, existingByName } = imp;
    const total = parsed.reduce((n, p) => n + 1 + p.makes.length, 0);
    let done = 0;
    const bump = () => { done += 1; setImp((s) => (s ? { ...s, progress: { done, total } } : s)); };
    setImp((s) => ({ ...s, stage: "running", progress: { done: 0, total } }));

    const failures = [];
    let created = 0, updated = 0, makesAdded = 0, makesUpdated = 0;

    for (const entry of parsed) {
      const ex = existingByName.get(entry.name.toLowerCase());
      // Never wipe an existing schema: applyItem always overwrites variant_attributes,
      // so when the sheet defines none, re-send what the server already has.
      const schemaJson = entry.schema ? JSON.stringify(entry.schema) : (ex ? (ex.variantAttributes || null) : null);
      const body = {
        category: entry.category || ex?.category || "COMMON",
        itemName: entry.name,
        specification: entry.specification || null,
        description: entry.description || null,
        defaultUnit: entry.defaultUnit || null,
        defaultTaxPercent: entry.defaultTaxPercent,
        hsnCode: entry.hsnCode || null,
        isActive: entry.isActive,
        variantAttributes: schemaJson,
      };
      let itemId = ex?.id ?? null;
      try {
        if (ex) { await api.put(`/bom-items-master/${ex.id}`, body); updated++; }
        else { const r = await api.post(`/bom-items-master`, body); itemId = r?.data?.id ?? null; created++; }
      } catch (err) {
        failures.push(`Items row ${entry.rowNo} (${entry.name}): ${err.message}`);
        bump(); continue;
      }
      bump();
      if (!itemId) { failures.push(`${entry.name}: server returned no id — makes skipped.`); continue; }

      const effSchema = entry.schema || parseSchemaStr(schemaJson);
      let existingVars = [];
      try {
        const vr = await api.get(`/bom-items-master/${itemId}/variants`);
        existingVars = Array.isArray(vr?.data) ? vr.data : [];
      } catch { /* treat as none */ }
      const vkey = (mk, md) => `${String(mk || "").trim().toLowerCase()}|${String(md || "").trim().toLowerCase()}`;
      const vByKey = new Map(existingVars.map((v) => [vkey(v.make, v.model), v]));

      for (const m of entry.makes) {
        const vbody = { make: m.make, model: m.model, description: m.description || "", isActive: m.isActive };
        if (effSchema.length) vbody.attributeValues = JSON.stringify(valuesFromRow(m.raw, effSchema));
        const hit = vByKey.get(vkey(m.make, m.model));
        try {
          if (hit) { await api.put(`/bom-item-variants/${hit.id}`, vbody); makesUpdated++; }
          else { await api.post(`/bom-items-master/${itemId}/variants`, vbody); makesAdded++; }
        } catch (err) {
          failures.push(`Makes row ${m.rowNo} (${entry.name} · ${[m.make, m.model].filter(Boolean).join(" ")}): ${err.message}`);
        }
        bump();
      }
    }

    setImp((s) => ({ ...s, stage: "done", result: { created, updated, makesAdded, makesUpdated, failures } }));
    await loadCatalog();
  };

  // ── Sort / paginate (client-side) ───────────────────────────────────────────
  const onSort = (key) => {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(key); setSortDir("asc"); }
    setPage(1);
  };
  // A group with no subgroup picked → narrow to every subgroup of that group.
  // (The server's `category` param only matches one exact value.)
  const visibleItems = useMemo(() => {
    if (!filterGroup || category) return items;
    const subs = new Set((sgByGroup[filterGroup] || []).map((s) => s.value));
    return items.filter((it) => subs.has(it.category));
  }, [items, filterGroup, category, sgByGroup]);

  const sortedItems = useMemo(() => {
    const col = CATALOG_COLS.find((c) => c.key === sortCol);
    const arr = [...visibleItems];
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
  }, [visibleItems, sortCol, sortDir]);
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = sortedItems.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);
  const orderedCols = colOrder.map((k) => CATALOG_COLS.find((c) => c.key === k)).filter(Boolean);

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
        <div className="bim-search">
          <Search size={14} />
          <input className="bim-inp" placeholder="Search name / spec / make"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="bim-inp" value={filterGroup} onChange={(e) => onFilterGroupChange(e.target.value)} title="Filter the catalog by group">
          <option value="">— Group —</option>
          {groups.map((g) => <option key={g.value} value={g.value}>{g.label || g.value}</option>)}
        </select>
        <select className="bim-inp" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          disabled={!filterGroup} title="Filter the catalog by subgroup">
          <option value="">{filterGroup ? "— All subgroups —" : "pick a group"}</option>
          {(sgByGroup[filterGroup] || []).map((sg) => <option key={sg.value} value={sg.value}>{sg.label || sg.value}</option>)}
        </select>
        <select className="bim-inp" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} title="Or filter by any category value">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="bim-spacer" />
        <button className="bim-btn bim-btn-secondary" onClick={downloadTemplate} title="Blank Excel workbook with an example">
          <Download size={14} /> Template
        </button>
        <button className="bim-btn bim-btn-secondary" onClick={exportCatalog} disabled={exporting} title="Download the whole catalog as Excel">
          {exporting ? "Exporting…" : <><Download size={14} /> Export</>}
        </button>
        <button className="bim-btn bim-btn-secondary" onClick={() => fileRef.current?.click()} title="Import items + makes from Excel">
          <Upload size={14} /> Import
        </button>
        <button className="bim-btn bim-btn-primary" onClick={openCreate}><Plus size={15} /> Add item</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onFilePicked} />
      </div>

      {loading ? (
        <div className="bim-muted" style={{ padding: 16 }}>Loading…</div>
      ) : (
        <div className="bim-table-wrap">
          <div className="bim-table-scroll">
            <table className="bim-table">
              <thead>
                <tr>
                  {orderedCols.map((col) => (
                    <th key={col.key} className={`bim-th ${dragOverCol === col.key ? "bim-col-drag-over" : ""}`}
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
                  <tr><td colSpan={orderedCols.length + 1} className="bim-muted" style={{ padding: 16 }}>No items. Click “Add item”, or Import from Excel.</td></tr>
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

      {/* ── Import preview / progress / result ── */}
      {imp && (
        <div className="bim-overlay" onMouseDown={() => imp.stage !== "running" && setImp(null)}>
          <div className="bim-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="bim-modal-head">
              <div className="bim-modal-title">
                {imp.stage === "done" ? "Import finished" : imp.stage === "running" ? "Importing…" : "Import preview"}
              </div>
              {imp.stage !== "running" && <button className="bim-iconbtn" onClick={() => setImp(null)}><X size={18} /></button>}
            </div>

            <div className="bim-modal-body">
              {imp.stage === "preview" && (
                <>
                  {imp.counts ? (
                    <div style={{ fontSize: 13, marginBottom: 10 }}>
                      <b>{imp.counts.toCreate}</b> item(s) to create · <b>{imp.counts.toUpdate}</b> to update · <b>{imp.counts.makes}</b> make row(s).
                    </div>
                  ) : (
                    <div className="bim-muted" style={{ fontSize: 13, marginBottom: 10 }}>Nothing importable was found in this file.</div>
                  )}
                  {imp.errors.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ct-dc2626,#dc2626)", marginBottom: 4 }}>
                        {imp.errors.length} problem row(s) — these will be skipped:
                      </div>
                      <div className="bim-muted" style={{ maxHeight: 200, overflowY: "auto", fontSize: 12, lineHeight: 1.6 }}>
                        {imp.errors.map((er, i) => <div key={i}>{er}</div>)}
                      </div>
                    </>
                  )}
                  {imp.counts && (
                    <div className="bim-muted" style={{ fontSize: 11, marginTop: 10 }}>
                      Items are matched by name and updated; makes are matched on Make + Model — so re-running the same file is safe and won't duplicate anything.
                    </div>
                  )}
                </>
              )}

              {imp.stage === "running" && (
                <>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>{imp.progress.done} / {imp.progress.total} saved…</div>
                  <div style={{ height: 8, background: "var(--c-e5e7eb,#e5e7eb)", borderRadius: 999 }}>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--c-2563eb,#2563eb)", width: `${imp.progress.total ? (imp.progress.done / imp.progress.total) * 100 : 0}%` }} />
                  </div>
                </>
              )}

              {imp.stage === "done" && (
                <div style={{ fontSize: 13 }}>
                  <div><b>{imp.result.created}</b> item(s) created · <b>{imp.result.updated}</b> updated</div>
                  <div style={{ marginTop: 2 }}><b>{imp.result.makesAdded}</b> make(s) added · <b>{imp.result.makesUpdated}</b> updated</div>
                  {imp.result.failures.length > 0 && (
                    <>
                      <div style={{ fontWeight: 600, color: "var(--ct-dc2626,#dc2626)", margin: "10px 0 4px" }}>
                        {imp.result.failures.length} failed:
                      </div>
                      <div className="bim-muted" style={{ maxHeight: 200, overflowY: "auto", fontSize: 12, lineHeight: 1.6 }}>
                        {imp.result.failures.map((f, i) => <div key={i}>{f}</div>)}
                      </div>
                      <div className="bim-muted" style={{ fontSize: 11, marginTop: 8 }}>
                        Fix those rows and re-import the same file — everything is upserted, so nothing duplicates.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="bim-modal-foot">
              {imp.stage === "preview" && (
                <>
                  <button className="bim-btn bim-btn-secondary" onClick={() => setImp(null)}>Cancel</button>
                  <button className="bim-btn bim-btn-primary" disabled={!imp.counts} onClick={runImport}>
                    <Upload size={14} /> Import
                  </button>
                </>
              )}
              {imp.stage === "done" && <button className="bim-btn bim-btn-primary" onClick={() => setImp(null)}>Close</button>}
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
        <ItemMakesModal item={makesItem} onClose={() => setMakesItem(null)}
          showError={showError} showSuccess={showSuccess} />
      )}
    </div>
  );
}
