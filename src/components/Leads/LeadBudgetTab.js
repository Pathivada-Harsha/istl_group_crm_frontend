// ─────────────────────────────────────────────────────────────────────────────
//  LeadBudgetTab — internal-only budget estimation for a lead.
//
//  Step 3 of the estimation flow:  Scope → BOM → Budget Estimation.
//
//  ⚠ INTERNAL ONLY — never shown to the client.
//  • Section A: 3 metric cards — Total Cost (fixed), Profit Markup % (the lever),
//    and the derived Proposal Price. Editing the markup drives the price; editing
//    the price back-computes the markup. The cost never moves with either.
//        proposalPrice = cost × (1 + markup/100)
//  • Section B: budget allocation — a read-only rollup of the BOM grouped by the
//    SCOPE activity each material sits under. Rates are edited in the BOM tab.
//  • Section C: extra allocations — costs that aren't a BOM material (freight,
//    contingency, overheads). Each is either a flat amount or a % of the BOM.
//  • All amounts are en-IN formatted and rounded.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import './LeadCardHead.css';
import { Plus, Save, Trash2, Wallet, PlusCircle } from "lucide-react";
import api from "../../services/leadsapi.js";
import { EXTRA_ALLOCATION_TYPES, OTHER_OPTION } from "../../constants/scopeActivities.js";
import "./LeadBudgetTab.css";

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmtINR = n => Number(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

const blankExtra = () => ({ id: null, name: "", basis: "FIXED", rateValue: "", notes: "", customName: false });

export default function LeadBudgetTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [summary, setSummary] = useState({ totalCost: 0, bomTotal: 0, extrasTotal: 0, proposalPrice: 0, profitValue: 0, marginPercent: 0 });
  const [bomLines, setBomLines] = useState([]);
  const [scopeItems, setScopeItems] = useState([]);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  // Markup % / price inline edits (each drives the other through the backend)
  const [editMargin, setEditMargin] = useState(false);
  const [marginInput, setMarginInput] = useState("");
  const [editPrice, setEditPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingMargin, setSavingMargin] = useState(false);
  const [savingExtras, setSavingExtras] = useState(false);

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get(`/leads/${lead.id}/estimation-summary`);
      if (res?.success && res.data) {
        setSummary({
          totalCost: Number(res.data.totalCost ?? res.data.totalBudget) || 0,
          bomTotal: Number(res.data.bomTotal) || 0,
          extrasTotal: Number(res.data.extrasTotal) || 0,
          proposalPrice: Number(res.data.proposalPrice ?? res.data.sellingPrice) || 0,
          profitValue: Number(res.data.profitValue ?? res.data.marginValue) || 0,
          marginPercent: Number(res.data.marginPercent) || 0,
        });
      }
    } catch (e) { fail("Failed to load estimation summary", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const loadBom = useCallback(async () => {
    try {
      const [bomRes, scopeRes] = await Promise.all([
        api.get(`/leads/${lead.id}/bom`),
        api.get(`/leads/${lead.id}/scope`),
      ]);
      if (bomRes?.success) setBomLines(bomRes.data?.lines || []);
      if (scopeRes?.success) setScopeItems(scopeRes.data?.items || []);
    } catch (e) { fail("Failed to load BOM costing", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const loadExtras = useCallback(async () => {
    try {
      const res = await api.get(`/leads/${lead.id}/budget/extras`);
      if (res?.success) {
        setExtras((res.data?.lines || []).map(l => ({
          id: l.id,
          name: l.name || "",
          basis: l.basis || "FIXED",
          rateValue: l.rateValue ?? "",
          notes: l.notes || "",
          customName: !EXTRA_ALLOCATION_TYPES.includes(l.name),
        })));
      }
    } catch (e) { fail("Failed to load extra allocations", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadBom(), loadExtras(), loadSummary()]);
    onRefreshLead?.();
  }, [loadBom, loadExtras, loadSummary, onRefreshLead]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadBom(), loadExtras(), loadSummary()]);
      setLoading(false);
    })();
  }, [loadBom, loadExtras, loadSummary]);

  // ── Profit markup % (drives the price) ───────────────────────────────────────
  const startEditMargin = () => { setMarginInput(String(summary.marginPercent || "")); setEditMargin(true); };
  const saveMargin = async () => {
    setSavingMargin(true);
    try {
      const res = await api.put(`/leads/${lead.id}/margin`, { marginPercent: Number(marginInput) || 0 });
      if (res?.success) {
        setEditMargin(false);
        await loadSummary();
        onRefreshLead?.();
        showSuccess?.("Profit markup updated");
      } else showError?.(res?.message || "Failed to save markup");
    } catch (e) { fail("Failed to save markup", e); }
    finally { setSavingMargin(false); }
  };

  // ── Proposal price (back-computes the markup) ────────────────────────────────
  const startEditPrice = () => { setPriceInput(String(summary.proposalPrice || "")); setEditPrice(true); };
  const saveSellingPrice = async () => {
    setSavingPrice(true);
    try {
      const res = await api.put(`/leads/${lead.id}/selling-price`, { sellingPrice: Number(priceInput) || 0 });
      if (res?.success) {
        setEditPrice(false);
        await loadSummary();
        onRefreshLead?.();
        showSuccess?.("Proposal price updated");
      } else showError?.(res?.message || "Failed to save proposal price");
    } catch (e) { fail("Failed to save proposal price", e); }
    finally { setSavingPrice(false); }
  };

  // ── Extra allocations ──────────────────────────────────────────────────────
  const updExtra = (i, field, val, extra) =>
    setExtras(prev => prev.map((l, idx) => (idx === i ? { ...l, [field]: val, ...(extra || {}) } : l)));
  const addExtra = () => setExtras(prev => [...prev, blankExtra()]);
  const rmExtra = (i) => setExtras(prev => prev.filter((_, idx) => idx !== i));

  // Mirrors the server: FIXED is its own rate, PERCENT is that share of the BOM.
  // Recomputed live so the row updates as the user types, before any save.
  const extraAmount = (l) => {
    const rate = Number(l.rateValue) || 0;
    return l.basis === "PERCENT" ? round2((summary.bomTotal * rate) / 100) : round2(rate);
  };
  const extrasLiveTotal = extras.reduce((s, l) => s + extraAmount(l), 0);
  const totalLive = round2(summary.bomTotal + extrasLiveTotal);

  const saveExtras = async () => {
    if (!canEdit) return;
    for (const l of extras) {
      if (!(l.name || "").trim()) { showError?.("Every extra allocation needs a name"); return; }
    }
    setSavingExtras(true);
    try {
      const res = await api.put(`/leads/${lead.id}/budget/extras`, {
        lines: extras.map((l, i) => ({
          id: l.id ?? null,
          seqNo: i + 1,
          name: l.name.trim(),
          basis: l.basis === "PERCENT" ? "PERCENT" : "FIXED",
          rateValue: l.rateValue === "" || l.rateValue == null ? 0 : Number(l.rateValue),
          notes: (l.notes || "").trim() || null,
        })),
      });
      if (res?.success) {
        showSuccess?.("Extra allocations saved");
        await reloadAll();
      } else showError?.(res?.message || "Failed to save extra allocations");
    } catch (e) { fail("Failed to save extra allocations", e); }
    finally { setSavingExtras(false); }
  };

  // ── BOM rollup grouped by SCOPE activity ───────────────────────────────────
  // Mirrors the BOM tab's structure: materials sit under the scope activity they
  // belong to (via scope_item_id), with a "General / Unassigned" catch-all.
  const bomGroups = React.useMemo(() => {
    const byId = new Map(scopeItems.map(s => [String(s.id), s.activity || "(unnamed activity)"]));
    const order = [...scopeItems.map(s => String(s.id)), "__general__"];
    const map = new Map();
    const ensure = (key, title) => {
      if (!map.has(key)) map.set(key, { key, title, lines: [], amount: 0 });
      return map.get(key);
    };
    bomLines.forEach(l => {
      const sid = l.scopeItemId == null || l.scopeItemId === "" ? "" : String(l.scopeItemId);
      const key = sid && byId.has(sid) ? sid : "__general__";
      const title = key === "__general__" ? "General / Unassigned" : byId.get(sid);
      const g = ensure(key, title);
      g.lines.push(l);
      g.amount += Number(l.amount) || 0;
    });
    // Keep scope order, then General; drop empty groups.
    return order.map(k => map.get(k)).filter(Boolean);
  }, [bomLines, scopeItems]);

  const marginCls = summary.profitValue >= 0 ? "lbe-pos" : "lbe-neg";

  if (loading) return <div className="lbe-loading"><span className="lbe-spinner" /> Loading…</div>;

  return (
    <div className="lbe">
      {/* Internal-only banner */}
      <div className="lbe-warn-banner">
        <span className="lbe-lock" aria-hidden="true">🔒</span>
        Internal only — never shown to client
      </div>

      {/* ── Section A: metric cards ───────────────────────────────────────────── */}
      <div className="lbe-metrics">
        <div className="lbe-metric">
          <div className="lbe-metric-label">Total Project Cost</div>
          <div className="lbe-metric-value">₹{fmtINR(summary.totalCost)}</div>
          <div className="lbe-metric-sub">BOM + extra allocations — stays fixed</div>
        </div>

        <div className="lbe-metric lbe-metric--accent">
          <div className="lbe-metric-label">Profit Markup</div>
          {editMargin ? (
            <div className="lbe-price-edit">
              <input type="number" min="0" step="any" className="lbe-inp" value={marginInput} autoFocus
                onChange={e => setMarginInput(e.target.value)} />
              <span className="lbe-pct-sign">%</span>
              <button className="lbe-icon-save" onClick={saveMargin} disabled={savingMargin}>✓</button>
              <button className="lbe-icon-del" onClick={() => setEditMargin(false)}>✕</button>
            </div>
          ) : (
            <div className="lbe-metric-value lbe-metric-value--editable">
              {round2(summary.marginPercent).toFixed(2)}%
              {canEdit && (
                <button className="lbe-edit-btn" title="Edit profit markup" onClick={startEditMargin}>✎</button>
              )}
            </div>
          )}
          <div className={`lbe-metric-sub ${marginCls}`}>Profit ₹{fmtINR(summary.profitValue)}</div>
        </div>

        <div className="lbe-metric">
          <div className="lbe-metric-label">Proposal Price</div>
          {editPrice ? (
            <div className="lbe-price-edit">
              <input type="number" min="0" className="lbe-inp" value={priceInput} autoFocus
                onChange={e => setPriceInput(e.target.value)} />
              <button className="lbe-icon-save" onClick={saveSellingPrice} disabled={savingPrice}>✓</button>
              <button className="lbe-icon-del" onClick={() => setEditPrice(false)}>✕</button>
            </div>
          ) : (
            <div className="lbe-metric-value lbe-metric-value--editable">
              ₹{fmtINR(summary.proposalPrice)}
              {canEdit && (
                <button className="lbe-edit-btn" title="Set a target price (back-computes the markup)" onClick={startEditPrice}>✎</button>
              )}
            </div>
          )}
          <div className="lbe-metric-sub">Cost + markup — what the client is quoted</div>
        </div>
      </div>

      {/* ── Section B: budget allocation, grouped by scope activity ───────────── */}
      <div className="lbe-card">
        <div className="lbe-card-head">
          <span className="lead-card-ico"><Wallet size={17} strokeWidth={2} /></span><h4 className="lbe-card-title">Budget Allocation (by Scope)</h4>
          <span className="lbe-card-sub">Materials per scope activity — rates are edited in the BOM tab</span>
          <div className="lbe-card-total">₹{fmtINR(summary.bomTotal)}</div>
        </div>

        {bomGroups.length === 0 ? (
          <div className="lbe-empty">
            No BOM lines yet. Build the Bill of Materials in the BOM tab and its costing appears here, grouped by scope.
          </div>
        ) : (
          <div className="lbe-cat-list">
            {bomGroups.map(g => {
              const open = !!expanded[g.key];
              return (
                <div key={g.key} className="lbe-cat">
                  <div className="lbe-cat-row" onClick={() => setExpanded(p => ({ ...p, [g.key]: !open }))}>
                    <span className={`lbe-caret ${open ? "open" : ""}`}>▶</span>
                    <div className="lbe-cat-name">
                      <b>{g.title}</b>
                      <span className="lbe-cat-desc">{g.lines.length} item{g.lines.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="lbe-cat-amount">₹{fmtINR(g.amount)}</div>
                  </div>

                  {open && (
                    <div className="lbe-item-wrap">
                      <table className="lbe-item-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th className="lbe-c-make">Make</th>
                            <th className="lbe-c-num">Qty</th>
                            <th className="lbe-c-unit">Unit</th>
                            <th className="lbe-c-num">Rate</th>
                            <th className="lbe-c-num">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.lines.map(it => (
                            <tr key={it.id}>
                              <td>{it.itemName}</td>
                              <td className="lbe-c-make">{it.make || "—"}</td>
                              <td className="lbe-c-num">{it.quantity ?? "—"}</td>
                              <td className="lbe-c-unit">{it.unit || "—"}</td>
                              <td className="lbe-c-num">₹{fmtINR(it.unitRate)}</td>
                              <td className="lbe-c-num lbe-amt">₹{fmtINR(it.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section C: extra allocations ──────────────────────────────────────── */}
      <div className="lbe-card">
        <div className="lbe-card-head">
          <span className="lead-card-ico"><PlusCircle size={17} strokeWidth={2} /></span><h4 className="lbe-card-title">Extra Allocations</h4>
          <span className="lbe-card-sub">Costs not tied to a BOM material</span>
          {canEdit && (
            <button className="lbe-add-cat" onClick={addExtra}><Plus size={13} /> Add allocation</button>
          )}
        </div>

        {extras.length === 0 ? (
          <div className="lbe-empty">
            No extra allocations. Add freight, contingency, overheads and the like — each as a flat
            amount or a percentage of the BOM.
          </div>
        ) : (
          <div className="lbe-table-wrap">
            <table className="lbe-item-table">
              <thead>
                <tr>
                  <th className="lbe-c-num2">#</th>
                  <th>Allocation</th>
                  <th className="lbe-c-basis">Basis</th>
                  <th className="lbe-c-num">Value</th>
                  <th className="lbe-c-num">Amount</th>
                  <th>Notes</th>
                  {canEdit && <th className="lbe-c-act" />}
                </tr>
              </thead>
              <tbody>
                {extras.map((l, i) => (
                  <tr key={l.id ?? `new-${i}`}>
                    <td className="lbe-c-num2">{i + 1}</td>
                    <td>
                      {l.customName ? (
                        <div className="lbe-custom">
                          <input className="lbe-inp" value={l.name} disabled={!canEdit}
                            placeholder="Allocation name"
                            onChange={e => updExtra(i, "name", e.target.value)} />
                          <button type="button" className="lbe-custom-back" title="Back to list"
                            disabled={!canEdit}
                            onClick={() => updExtra(i, "customName", false, { name: "" })}>↩</button>
                        </div>
                      ) : (
                        <select className="lbe-inp" value={l.name} disabled={!canEdit}
                          onChange={e => {
                            if (e.target.value === OTHER_OPTION) updExtra(i, "customName", true, { name: "" });
                            else updExtra(i, "name", e.target.value);
                          }}>
                          <option value="">Select allocation…</option>
                          {EXTRA_ALLOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          <option value={OTHER_OPTION}>Other (type your own)…</option>
                        </select>
                      )}
                    </td>
                    <td className="lbe-c-basis">
                      <select className="lbe-inp" value={l.basis} disabled={!canEdit}
                        onChange={e => updExtra(i, "basis", e.target.value)}>
                        <option value="FIXED">Fixed ₹</option>
                        <option value="PERCENT">% of BOM</option>
                      </select>
                    </td>
                    <td className="lbe-c-num">
                      <input className="lbe-inp" type="number" min="0" step="any" value={l.rateValue}
                        disabled={!canEdit}
                        onChange={e => updExtra(i, "rateValue", e.target.value)}
                        placeholder={l.basis === "PERCENT" ? "%" : "₹"} />
                    </td>
                    <td className="lbe-c-num lbe-amt">₹{fmtINR(extraAmount(l))}</td>
                    <td>
                      <input className="lbe-inp" value={l.notes} disabled={!canEdit}
                        onChange={e => updExtra(i, "notes", e.target.value)} placeholder="Optional" />
                    </td>
                    {canEdit && (
                      <td className="lbe-c-act">
                        <button className="lbe-icon-del" title="Remove allocation" onClick={() => rmExtra(i)}>
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

        {canEdit && extras.length > 0 && (
          <div className="lbe-card-foot">
            <button className="lbe-btn-primary" onClick={saveExtras} disabled={savingExtras}>
              <Save size={13} /> {savingExtras ? "Saving…" : "Save Allocations"}
            </button>
          </div>
        )}
      </div>

      {/* ── Reconciliation footer: Cost → + markup → Proposal price ───────────── */}
      <div className="lbe-recon">
        <span>BOM <b>₹{fmtINR(summary.bomTotal)}</b></span>
        <span className="lbe-recon-op">+</span>
        <span>Extras <b>₹{fmtINR(extrasLiveTotal)}</b></span>
        <span className="lbe-recon-op">=</span>
        <span>Cost <b>₹{fmtINR(totalLive)}</b></span>
        <span className="lbe-recon-op">+{round2(summary.marginPercent).toFixed(2)}%</span>
        <span className="lbe-recon-total">Proposal <b>₹{fmtINR(summary.proposalPrice)}</b></span>
        {round2(totalLive) !== round2(summary.totalCost) && (
          <span className="lbe-recon-dirty">save allocations to refresh</span>
        )}
      </div>
    </div>
  );
}
