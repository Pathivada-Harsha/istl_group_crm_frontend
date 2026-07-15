// ─────────────────────────────────────────────────────────────────────────────
//  LeadTechnicalScopeTab — "Technical Scope" for a lead.
//
//  • Section A: scope header (project type, capacity, site location, scope of work,
//    technical notes/exclusions). Group / Sub-group shown read-only from the lead.
//    These fields flow into the proposal scope later.
//  • Section B: editable scope-item lines (activity, category, qty, unit).
//    NO prices, NO dates anywhere on this tab.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/leadsapi.js";
import "./LeadTechnicalScopeTab.css";

const CATEGORIES = ["CCMS", "ITMS", "MCMS", "EPC", "COMMON"];
const UNIT_SUGGESTIONS = ["Nos", "kW", "sqm", "Lot"];

const emptyHeader = {
  projectType: "",
  systemCapacity: "",
  siteLocation: "",
  scopeOfWork: "",
  technicalNotes: "",
};

export default function LeadTechnicalScopeTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [header, setHeader] = useState(emptyHeader);
  const [items, setItems] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingHeader, setSavingHeader] = useState(false);

  // Draft new line
  const [draft, setDraft] = useState(null);
  const [savingRow, setSavingRow] = useState(false);

  const groupName = lead?.groupName ?? lead?.group ?? "—";
  const subGroupName = lead?.subGroupName ?? lead?.subGroup ?? "—";

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${lead.id}/scope`);
      if (res?.success) {
        const h = res.data?.header || {};
        setHeader({
          projectType: h.projectType ?? "",
          systemCapacity: h.systemCapacity ?? "",
          siteLocation: h.siteLocation ?? "",
          scopeOfWork: h.scopeOfWork ?? "",
          technicalNotes: h.technicalNotes ?? "",
        });
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      }
    } catch (e) {
      fail("Failed to load technical scope", e);
    } finally { setLoading(false); }
  }, [lead.id]);

  useEffect(() => {
    load();
    api.get("/order-book/scope-activities")
      .then(res => {
        const arr = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        setActivities(arr.map(a => (typeof a === "string" ? a : (a?.name ?? ""))).filter(Boolean));
      })
      .catch(() => {});
  }, [load]);

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

  // ── Item helpers ───────────────────────────────────────────────────────────
  const saveItem = async (row) => {
    if (!canEdit) return;
    if (!(row.activity || "").trim()) { showError?.("Enter an activity"); return; }
    setSavingRow(true);
    try {
      const res = await api.post(`/leads/${lead.id}/scope/items`, {
        id: row.id ?? undefined,
        seqNo: row.seqNo ?? undefined,
        activity: (row.activity || "").trim(),
        category: row.category || null,
        specification: (row.specification || "").trim() || null,
        quantity: row.quantity === "" || row.quantity == null ? null : Number(row.quantity),
        unit: (row.unit || "").trim() || null,
        notes: (row.notes || "").trim() || null,
      });
      if (res?.success) {
        setDraft(null);
        await load();
        onRefreshLead?.();
      } else {
        showError?.(res?.message || "Failed to save line");
      }
    } catch (e) {
      fail("Failed to save line", e);
    } finally { setSavingRow(false); }
  };

  const deleteItem = async (itemId) => {
    if (!canEdit) return;
    if (!window.confirm("Delete this scope line?")) return;
    try {
      const res = await api.delete(`/leads/${lead.id}/scope/items/${itemId}`);
      if (res?.success) { await load(); onRefreshLead?.(); }
      else showError?.(res?.message || "Failed to delete line");
    } catch (e) {
      fail("Failed to delete line", e);
    }
  };

  const updateExisting = (id, k, v) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, [k]: v, _dirty: true } : it)));

  const addDraft = () => setDraft({
    activity: "", category: "", specification: "", quantity: "", unit: "", notes: "",
    seqNo: (items.length ? Math.max(...items.map(i => i.seqNo || 0)) : 0) + 1,
  });

  if (loading) return <div className="lts-loading"><span className="lts-spinner" /> Loading…</div>;

  return (
    <div className="lts">
      {/* ── Section A: Scope header ─────────────────────────────────────────── */}
      <div className="lts-card">
        <div className="lts-card-head">
          <h4 className="lts-card-title">Scope Overview</h4>
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
              placeholder="e.g. 100 kWp" />
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

      {/* ── Section B: Scope-item lines ─────────────────────────────────────── */}
      <div className="lts-card">
        <div className="lts-card-head">
          <h4 className="lts-card-title">Scope Lines</h4>
          <span className="lts-count-pill">{items.length}</span>
        </div>

        <datalist id="lts-activities">
          {activities.map((a, i) => <option key={i} value={a} />)}
        </datalist>

        <div className="lts-table-wrap">
          <table className="lts-table">
            <thead>
              <tr>
                <th className="lts-col-num">#</th>
                <th>Activity</th>
                <th className="lts-col-cat">Category</th>
                <th className="lts-col-qty">Qty</th>
                <th className="lts-col-unit">Unit</th>
                {canEdit && <th className="lts-col-act" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !draft && (
                <tr><td colSpan={canEdit ? 6 : 5} className="lts-empty">No scope lines yet.</td></tr>
              )}

              {items.map((row, i) => (
                <tr key={row.id}>
                  <td className="lts-col-num">{i + 1}</td>
                  <td>
                    <input className="lts-inp" list="lts-activities" value={row.activity || ""}
                      onChange={e => updateExisting(row.id, "activity", e.target.value)}
                      disabled={!canEdit} placeholder="Activity" />
                  </td>
                  <td className="lts-col-cat">
                    <select className="lts-inp" value={row.category || ""}
                      onChange={e => updateExisting(row.id, "category", e.target.value)} disabled={!canEdit}>
                      <option value="">—</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="lts-col-qty">
                    <input className="lts-inp" type="number" min="0" value={row.quantity ?? ""}
                      onChange={e => updateExisting(row.id, "quantity", e.target.value)} disabled={!canEdit} />
                  </td>
                  <td className="lts-col-unit">
                    <input className="lts-inp" list="lts-units" value={row.unit || ""}
                      onChange={e => updateExisting(row.id, "unit", e.target.value)}
                      disabled={!canEdit} placeholder="Unit" />
                  </td>
                  {canEdit && (
                    <td className="lts-col-act">
                      {row._dirty && (
                        <button className="lts-icon-save" title="Save line" disabled={savingRow}
                          onClick={() => saveItem(row)}>✓</button>
                      )}
                      <button className="lts-icon-del" title="Delete line" onClick={() => deleteItem(row.id)}>✕</button>
                    </td>
                  )}
                </tr>
              ))}

              {draft && (
                <tr className="lts-draft-row">
                  <td className="lts-col-num">+</td>
                  <td>
                    <input className="lts-inp" list="lts-activities" value={draft.activity}
                      onChange={e => setDraft(p => ({ ...p, activity: e.target.value }))}
                      placeholder="Activity" autoFocus />
                  </td>
                  <td className="lts-col-cat">
                    <select className="lts-inp" value={draft.category}
                      onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}>
                      <option value="">—</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="lts-col-qty">
                    <input className="lts-inp" type="number" min="0" value={draft.quantity}
                      onChange={e => setDraft(p => ({ ...p, quantity: e.target.value }))} />
                  </td>
                  <td className="lts-col-unit">
                    <input className="lts-inp" list="lts-units" value={draft.unit}
                      onChange={e => setDraft(p => ({ ...p, unit: e.target.value }))} placeholder="Unit" />
                  </td>
                  <td className="lts-col-act">
                    <button className="lts-icon-save" title="Add line" disabled={savingRow}
                      onClick={() => saveItem(draft)}>✓</button>
                    <button className="lts-icon-del" title="Discard" onClick={() => setDraft(null)}>✕</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <datalist id="lts-units">
          {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
        </datalist>

        {canEdit && !draft && (
          <button className="lts-add-line" onClick={addDraft}>＋ Add scope line</button>
        )}

        <p className="lts-hint">
          These lines (activity, qty, unit — never prices) seed the proposal scope later.
        </p>
      </div>
    </div>
  );
}
