// ─────────────────────────────────────────────────────────────────────────────
//  TemplateLineVariantsModal — manage the allowed makes (variants) of a BOM
//  template line, and mark the default the Suggest engine seeds.
//
//  Catalog-level actions (add / edit / deactivate a make) hit the server
//  immediately against /bom-items-master/{itemId}/variants. The allowed subset +
//  default are edited locally and applied back onto the line via onApply — they
//  persist when the admin clicks "Save BOM lines" on the template.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Star, Pencil, Trash2, Check } from "lucide-react";
import api from "../../services/leadsapi.js";

export const variantLabel = (v) =>
  [v?.make, v?.model].filter(Boolean).join(" ").trim() || "(no make)";

// Parse the parent item's variant-attribute schema + a variant's stored values,
// so we can show each make's full structured spec (e.g. "540 Wp · Mono PERC").
const parseSchema = (raw) => {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => ({
    key: f.key || "", label: f.label || "", type: f.type || "text",
    options: Array.isArray(f.options) ? f.options : [], unit: f.unit || "", required: !!f.required,
  }));
};
const parseValues = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { const o = JSON.parse(raw); return o && typeof o === "object" ? o : {}; } catch { return {}; }
};
const specSummary = (v, schema) => {
  const vals = parseValues(v?.attributeValues);
  return schema
    .filter((f) => vals[f.key] != null && `${vals[f.key]}` !== "")
    .map((f) => `${vals[f.key]}${f.unit ? ` ${f.unit}` : ""}`)
    .join(" · ");
};

// Module-scope so React keeps input identity stable (no focus loss per keystroke).
const AttrCell = ({ field, value, onChange }) => {
  if (field.type === "dropdown")
    return (
      <select className="lta-inp" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  if (field.type === "number")
    return <input className="lta-inp" type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />;
  return <input className="lta-inp" value={value} onChange={(e) => onChange(e.target.value)} />;
};

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(15,39,72,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000,
};
const modalStyle = {
  background: "#fff", borderRadius: 10, padding: 18, width: "min(560px, 94vw)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
};
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const rowStyle = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
  borderBottom: "1px solid #F1F3F7",
};
const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: 2, color: "#6B7280" };

export default function TemplateLineVariantsModal({ line, onClose, onApply, showError, showSuccess }) {
  const bomItemId = line?.bomItemId;
  const [variants, setVariants] = useState([]);
  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState(() => new Set(line?.allowedVariantIds || []));
  const [defaultId, setDefaultId] = useState(line?.defaultVariantId ?? null);
  const [form, setForm] = useState({ id: null, make: "", model: "", description: "", values: {} });

  const load = useCallback(async () => {
    if (!bomItemId) return;
    setLoading(true);
    try {
      const res = await api.get(`/bom-items-master/${bomItemId}/variants`);
      setVariants(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError?.("Failed to load makes");
    } finally {
      setLoading(false);
    }
  }, [bomItemId, showError]);

  // The item's schema (field labels + units) so each make can show its full spec.
  const loadSchema = useCallback(async () => {
    if (!bomItemId) return;
    try {
      const res = await api.get(`/bom-items-master/${bomItemId}`);
      setSchema(parseSchema(res?.data?.variantAttributes));
    } catch { /* non-fatal: falls back to make/model + description */ }
  }, [bomItemId]);

  useEffect(() => { load(); loadSchema(); }, [load, loadSchema]);

  const toggleAllowed = (id) => {
    setAllowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (defaultId === id) setDefaultId(null); // dropping the default clears it
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const chooseDefault = (id) => {
    setAllowed((prev) => new Set(prev).add(id)); // default implies allowed
    setDefaultId(id);
  };

  const resetForm = () => setForm({ id: null, make: "", model: "", description: "", values: {} });
  const setVal = (key, value) => setForm((f) => ({ ...f, values: { ...f.values, [key]: value } }));

  const saveVariant = async () => {
    if (!form.make.trim() && !form.model.trim()) { showError?.("Enter a make or model"); return; }
    // Validate structured attribute values against the item's schema.
    for (const f of schema) {
      const val = (form.values?.[f.key] ?? "").toString().trim();
      if (!val) { if (f.required) { showError?.(`${f.label} is required`); return; } continue; }
      if (f.type === "number" && isNaN(Number(val))) { showError?.(`${f.label} must be a number`); return; }
      if (f.type === "dropdown" && !f.options.includes(val)) { showError?.(`${f.label} must be one of its options`); return; }
    }
    const body = { make: form.make.trim(), model: form.model.trim() };
    if (schema.length) {
      const clean = {};
      for (const f of schema) { const v = (form.values?.[f.key] ?? "").toString().trim(); if (v) clean[f.key] = v; }
      body.attributeValues = JSON.stringify(clean);
    } else {
      body.description = form.description.trim();
    }
    try {
      if (form.id) await api.put(`/bom-item-variants/${form.id}`, body);
      else await api.post(`/bom-items-master/${bomItemId}/variants`, body);
      resetForm();
      await load();
      showSuccess?.(form.id ? "Make updated" : "Make added");
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError?.(e.message || "Failed to save make");
    }
  };

  const editVariant = (v) =>
    setForm({ id: v.id, make: v.make || "", model: v.model || "", description: v.description || "", values: parseValues(v.attributeValues) });

  const deactivateVariant = async (v) => {
    try {
      await api.delete(`/bom-item-variants/${v.id}`);
      setAllowed((prev) => { const n = new Set(prev); n.delete(v.id); return n; });
      if (defaultId === v.id) setDefaultId(null);
      await load();
      showSuccess?.("Make deactivated");
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") showError?.("Failed to deactivate make");
    }
  };

  const apply = () => {
    const allowedVariantIds = [...allowed];
    let def = defaultId;
    if (allowedVariantIds.length && (def == null || !allowed.has(def))) def = allowedVariantIds[0];
    const dv = variants.find((v) => v.id === def);
    // Snapshot the default make's FULL structured spec (e.g. "540 Wp · Mono PERC")
    // into the line's Specification; fall back to its free-text description, then
    // to whatever the line already had.
    const dvSpec = dv ? (specSummary(dv, schema) || dv.description || "") : "";
    onApply?.({
      allowedVariantIds,
      defaultVariantId: allowedVariantIds.length ? def : null,
      make: dv ? variantLabel(dv) : line.make,
      specification: dv ? (dvSpec || line.specification) : line.specification,
    });
    onClose?.();
  };

  if (!line) return null;

  return (
    <div style={overlayStyle} onMouseDown={onClose}>
      <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <strong>Makes for “{line.itemName || "item"}”</strong>
          <button style={iconBtn} onClick={onClose} title="Close"><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 10px" }}>
          Tick the makes allowed on this line, and star the default the Suggest engine seeds.
        </p>

        {loading ? (
          <div style={{ color: "#6B7280" }}>Loading…</div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {variants.length === 0 && (
              <div style={{ color: "#6B7280" }}>No makes yet. Add one below.</div>
            )}
            {variants.map((v) => {
              const inactive = v.isActive === false;
              const summary = specSummary(v, schema);
              return (
                <div key={v.id} style={rowStyle}>
                  <input type="checkbox" disabled={inactive}
                    checked={allowed.has(v.id)} onChange={() => toggleAllowed(v.id)} />
                  <button style={{ ...iconBtn, color: defaultId === v.id ? "#F59E0B" : "#9CA3AF" }}
                    title="Set as default" disabled={inactive} onClick={() => chooseDefault(v.id)}>
                    <Star size={15} fill={defaultId === v.id ? "#F59E0B" : "none"} />
                  </button>
                  <div style={{ flex: 1, opacity: inactive ? 0.5 : 1 }}>
                    <div style={{ fontWeight: 600 }}>{variantLabel(v)}{inactive ? " (inactive)" : ""}</div>
                    {summary && <div style={{ fontSize: 12, color: "#42506B" }}>{summary}</div>}
                    {v.description && <div style={{ fontSize: 12, color: "#6B7280" }}>{v.description}</div>}
                  </div>
                  <button style={iconBtn} title="Edit" onClick={() => editVariant(v)}><Pencil size={14} /></button>
                  {!inactive && (
                    <button style={{ ...iconBtn, color: "#DC2626" }} title="Deactivate"
                      onClick={() => deactivateVariant(v)}><Trash2 size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            {form.id ? "Edit make" : "Add a make"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input className="lta-inp" style={{ flex: "1 1 100px" }} placeholder="Make / brand"
              value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} />
            <input className="lta-inp" style={{ flex: "1 1 90px" }} placeholder="Model"
              value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
            {schema.length === 0 && (
              <input className="lta-inp" style={{ flex: "2 1 160px" }} placeholder="Spec / description"
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            )}
          </div>

          {/* Structured spec fields — these ARE the specification when the item has a schema. */}
          {schema.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {schema.map((f) => (
                <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#42506B" }}>
                    {f.label}{f.required ? <span style={{ color: "#DC2626" }}> *</span> : null}{f.unit ? <span style={{ fontWeight: 400, color: "#6B7280" }}> ({f.unit})</span> : null}
                  </label>
                  <AttrCell field={f} value={form.values?.[f.key] ?? ""} onChange={(val) => setVal(f.key, val)} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="lta-btn-primary" onClick={saveVariant}>
              {form.id ? <><Check size={13} /> Update</> : <><Plus size={13} /> Add</>}
            </button>
            {form.id && <button className="lta-btn-ghost" onClick={resetForm}>Cancel</button>}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button className="lta-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="lta-btn-primary" onClick={apply}>Done</button>
        </div>
      </div>
    </div>
  );
}
