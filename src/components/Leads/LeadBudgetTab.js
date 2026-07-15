// ─────────────────────────────────────────────────────────────────────────────
//  LeadBudgetTab — internal-only budget estimation for a lead.
//
//  ⚠ INTERNAL ONLY — never shown to the client.
//  • Section A: 3 metric cards (total budget, editable selling price, margin).
//  • Section B: expandable budget-by-category table with nested item rows.
//    Item name field auto-fills make / unit from the BOM master.
//  • All amounts are en-IN formatted and rounded.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import api from "../../services/leadsapi.js";
import "./LeadBudgetTab.css";

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmtINR = n => Number(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// ═══════════════════════════════════════════════════════════════════════════════
//  BOM item autocomplete (portal dropdown, debounced 250ms, min 2 chars)
//  Clones the ItemNameAutocomplete pattern; queries /bom-items-master/search.
// ═══════════════════════════════════════════════════════════════════════════════
function BomItemAutocomplete({ value, onChange, onSelect, disabled, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const updatePos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(260, suggestions.length * 52 + 8);
    const showAbove = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight + 8;
    setDropdownStyle({
      position: "fixed", left: rect.left, width: rect.width, zIndex: 99999,
      ...(showAbove ? { bottom: window.innerHeight - rect.top + 3 } : { top: rect.bottom + 3 }),
    });
  }, [suggestions.length]);

  useEffect(() => {
    const onDocDown = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [showDropdown, updatePos]);

  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    setLoading(true);
    try {
      const res = await api.get("/bom-items-master/search", { params: { searchTerm: q.trim() } });
      const data = Array.isArray(res?.data) ? res.data : [];
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]); setShowDropdown(false);
    } finally { setLoading(false); }
  }, []);

  const handleInput = e => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const pick = item => {
    onChange(item.itemName || "");
    onSelect?.(item);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const dropdown = showDropdown && suggestions.length > 0
    ? ReactDOM.createPortal(
        <ul className="lbe-ac-dropdown" role="listbox" style={dropdownStyle}>
          {suggestions.map(item => (
            <li key={item.id} className="lbe-ac-option" role="option"
              onMouseDown={() => pick(item)}>
              <div className="lbe-ac-name">{item.itemName}</div>
              <div className="lbe-ac-meta">
                {item.makeBrand && <span>{item.makeBrand}</span>}
                {item.defaultUnit && <span className="lbe-ac-badge">{item.defaultUnit}</span>}
                {item.category && <span className="lbe-ac-cat">{item.category}</span>}
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  return (
    <div className="lbe-ac-wrap" ref={wrapperRef}>
      <input ref={inputRef} type="text" className="lbe-inp lbe-ac-input"
        value={value || ""} onChange={handleInput} disabled={disabled}
        onFocus={() => (value?.length >= 2 && suggestions.length > 0) && setShowDropdown(true)}
        placeholder={placeholder || "Item name"} autoComplete="off" />
      {loading && <span className="lbe-ac-spinner" />}
      {dropdown}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN TAB
// ═══════════════════════════════════════════════════════════════════════════════
export default function LeadBudgetTab({ lead, currentUser, permissions, onRefreshLead, showSuccess, showError }) {
  const canEdit = permissions?.EDIT !== false;

  const [summary, setSummary] = useState({ totalBudget: 0, sellingPrice: 0, marginValue: 0, marginPercent: 0 });
  const [budget, setBudget] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  // Selling price inline edit
  const [editPrice, setEditPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Draft category / item state
  const [showCatDraft, setShowCatDraft] = useState(false);
  const [catDraft, setCatDraft] = useState({ category: "", description: "", notes: "" });
  const [itemDrafts, setItemDrafts] = useState({}); // { [budgetId]: {...} }
  const [busy, setBusy] = useState(false);

  const fail = (msg, e) => { if (!e || e.message !== "SESSION_EXPIRED") showError?.(msg); };

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get(`/leads/${lead.id}/estimation-summary`);
      if (res?.success && res.data) {
        setSummary({
          totalBudget: Number(res.data.totalBudget) || 0,
          sellingPrice: Number(res.data.sellingPrice) || 0,
          marginValue: Number(res.data.marginValue) || 0,
          marginPercent: Number(res.data.marginPercent) || 0,
        });
      }
    } catch (e) { fail("Failed to load estimation summary", e); }
  }, [lead.id]);

  const loadBudget = useCallback(async () => {
    try {
      const res = await api.get(`/leads/${lead.id}/budget`);
      if (res?.success) setBudget(Array.isArray(res.data) ? res.data : []);
    } catch (e) { fail("Failed to load budget", e); }
  }, [lead.id]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadBudget(), loadSummary()]);
    onRefreshLead?.();
  }, [loadBudget, loadSummary, onRefreshLead]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadBudget(), loadSummary()]);
      setLoading(false);
    })();
  }, [loadBudget, loadSummary]);

  // ── Selling price ──────────────────────────────────────────────────────────
  const startEditPrice = () => { setPriceInput(String(summary.sellingPrice || "")); setEditPrice(true); };
  const saveSellingPrice = async () => {
    setSavingPrice(true);
    try {
      const res = await api.put(`/leads/${lead.id}/selling-price`, { sellingPrice: Number(priceInput) || 0 });
      if (res?.success) {
        setEditPrice(false);
        await loadSummary();
        onRefreshLead?.();
        showSuccess?.("Selling price updated");
      } else showError?.(res?.message || "Failed to save selling price");
    } catch (e) { fail("Failed to save selling price", e); }
    finally { setSavingPrice(false); }
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const saveCategory = async () => {
    if (!(catDraft.category || "").trim()) { showError?.("Enter a category name"); return; }
    setBusy(true);
    try {
      const res = await api.post(`/leads/${lead.id}/budget/category`, {
        seqNo: (budget.length ? Math.max(...budget.map(b => b.seqNo || 0)) : 0) + 1,
        category: catDraft.category.trim(),
        description: (catDraft.description || "").trim() || null,
        notes: (catDraft.notes || "").trim() || null,
      });
      if (res?.success) {
        setShowCatDraft(false);
        setCatDraft({ category: "", description: "", notes: "" });
        await reloadAll();
      } else showError?.(res?.message || "Failed to add category");
    } catch (e) { fail("Failed to add category", e); }
    finally { setBusy(false); }
  };

  const deleteCategory = async (catId) => {
    if (!window.confirm("Delete this category and all its items?")) return;
    try {
      const res = await api.delete(`/leads/${lead.id}/budget/category/${catId}`);
      if (res?.success) await reloadAll();
      else showError?.(res?.message || "Failed to delete category");
    } catch (e) { fail("Failed to delete category", e); }
  };

  // ── Item CRUD ──────────────────────────────────────────────────────────────
  const startItemDraft = (cat) => {
    setExpanded(p => ({ ...p, [cat.id]: true }));
    setItemDrafts(p => ({
      ...p,
      [cat.id]: {
        itemName: "", make: "", quantity: "", unit: "", unitRate: "", notes: "",
        seqNo: (cat.items?.length ? Math.max(...cat.items.map(i => i.seqNo || 0)) : 0) + 1,
      },
    }));
  };
  const setItemDraft = (catId, k, v) => setItemDrafts(p => ({ ...p, [catId]: { ...p[catId], [k]: v } }));
  const cancelItemDraft = (catId) => setItemDrafts(p => { const n = { ...p }; delete n[catId]; return n; });

  const saveItem = async (catId) => {
    const d = itemDrafts[catId];
    if (!d || !(d.itemName || "").trim()) { showError?.("Enter an item name"); return; }
    setBusy(true);
    try {
      const res = await api.post(`/leads/${lead.id}/budget/item`, {
        budgetId: catId,
        seqNo: d.seqNo,
        itemName: d.itemName.trim(),
        make: (d.make || "").trim() || null,
        quantity: d.quantity === "" || d.quantity == null ? null : Number(d.quantity),
        unit: (d.unit || "").trim() || null,
        unitRate: d.unitRate === "" || d.unitRate == null ? null : Number(d.unitRate),
        notes: (d.notes || "").trim() || null,
      });
      if (res?.success) {
        cancelItemDraft(catId);
        await reloadAll();
      } else showError?.(res?.message || "Failed to add item");
    } catch (e) { fail("Failed to add item", e); }
    finally { setBusy(false); }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      const res = await api.delete(`/leads/${lead.id}/budget/item/${itemId}`);
      if (res?.success) await reloadAll();
      else showError?.(res?.message || "Failed to delete item");
    } catch (e) { fail("Failed to delete item", e); }
  };

  const marginCls = summary.marginPercent >= 0 ? "lbe-pos" : "lbe-neg";

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
          <div className="lbe-metric-label">Total Estimated Budget</div>
          <div className="lbe-metric-value">₹{fmtINR(summary.totalBudget)}</div>
        </div>

        <div className="lbe-metric">
          <div className="lbe-metric-label">Proposed Selling Price</div>
          {editPrice ? (
            <div className="lbe-price-edit">
              <input type="number" min="0" className="lbe-inp" value={priceInput} autoFocus
                onChange={e => setPriceInput(e.target.value)} />
              <button className="lbe-icon-save" onClick={saveSellingPrice} disabled={savingPrice}>✓</button>
              <button className="lbe-icon-del" onClick={() => setEditPrice(false)}>✕</button>
            </div>
          ) : (
            <div className="lbe-metric-value lbe-metric-value--editable">
              ₹{fmtINR(summary.sellingPrice)}
              {canEdit && (
                <button className="lbe-edit-btn" title="Edit selling price" onClick={startEditPrice}>✎</button>
              )}
            </div>
          )}
        </div>

        <div className="lbe-metric">
          <div className="lbe-metric-label">Margin</div>
          <div className="lbe-metric-value">₹{fmtINR(summary.marginValue)}</div>
          <div className={`lbe-margin-pct ${marginCls}`}>
            {summary.marginPercent >= 0 ? "▲" : "▼"} {round2(summary.marginPercent).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ── Section B: budget by category ─────────────────────────────────────── */}
      <div className="lbe-card">
        <div className="lbe-card-head">
          <h4 className="lbe-card-title">Budget by Category</h4>
          {canEdit && !showCatDraft && (
            <button className="lbe-add-cat" onClick={() => setShowCatDraft(true)}>＋ Add category</button>
          )}
        </div>

        {showCatDraft && (
          <div className="lbe-cat-draft">
            <input className="lbe-inp" placeholder="Category name *" value={catDraft.category}
              onChange={e => setCatDraft(p => ({ ...p, category: e.target.value }))} autoFocus />
            <input className="lbe-inp" placeholder="Description" value={catDraft.description}
              onChange={e => setCatDraft(p => ({ ...p, description: e.target.value }))} />
            <input className="lbe-inp" placeholder="Notes" value={catDraft.notes}
              onChange={e => setCatDraft(p => ({ ...p, notes: e.target.value }))} />
            <button className="lbe-btn-primary" onClick={saveCategory} disabled={busy}>Save</button>
            <button className="lbe-btn-sec" onClick={() => { setShowCatDraft(false); setCatDraft({ category: "", description: "", notes: "" }); }}>Cancel</button>
          </div>
        )}

        {budget.length === 0 && !showCatDraft ? (
          <div className="lbe-empty">No budget categories yet.</div>
        ) : (
          <div className="lbe-cat-list">
            {budget.map(cat => {
              const open = !!expanded[cat.id];
              const draft = itemDrafts[cat.id];
              return (
                <div key={cat.id} className="lbe-cat">
                  <div className="lbe-cat-row" onClick={() => setExpanded(p => ({ ...p, [cat.id]: !open }))}>
                    <span className={`lbe-caret ${open ? "open" : ""}`}>▶</span>
                    <div className="lbe-cat-name">
                      <b>{cat.category}</b>
                      {cat.description && <span className="lbe-cat-desc">{cat.description}</span>}
                    </div>
                    <div className="lbe-cat-amount">₹{fmtINR(cat.allocatedAmount)}</div>
                    {canEdit && (
                      <button className="lbe-icon-del" title="Delete category"
                        onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}>✕</button>
                    )}
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
                            {canEdit && <th className="lbe-c-act" />}
                          </tr>
                        </thead>
                        <tbody>
                          {(cat.items || []).length === 0 && !draft && (
                            <tr><td colSpan={canEdit ? 7 : 6} className="lbe-empty-row">No items.</td></tr>
                          )}
                          {(cat.items || []).map(it => (
                            <tr key={it.id}>
                              <td>{it.itemName}</td>
                              <td className="lbe-c-make">{it.make || "—"}</td>
                              <td className="lbe-c-num">{it.quantity ?? "—"}</td>
                              <td className="lbe-c-unit">{it.unit || "—"}</td>
                              <td className="lbe-c-num">₹{fmtINR(it.unitRate)}</td>
                              <td className="lbe-c-num lbe-amt">₹{fmtINR(it.amount != null ? it.amount : round2((it.quantity || 0) * (it.unitRate || 0)))}</td>
                              {canEdit && (
                                <td className="lbe-c-act">
                                  <button className="lbe-icon-del" title="Delete item" onClick={() => deleteItem(it.id)}>✕</button>
                                </td>
                              )}
                            </tr>
                          ))}

                          {draft && (
                            <tr className="lbe-draft-row">
                              <td>
                                <BomItemAutocomplete value={draft.itemName}
                                  onChange={v => setItemDraft(cat.id, "itemName", v)}
                                  onSelect={item => {
                                    setItemDrafts(p => ({
                                      ...p,
                                      [cat.id]: {
                                        ...p[cat.id],
                                        itemName: item.itemName || p[cat.id].itemName,
                                        make: item.makeBrand || p[cat.id].make,
                                        unit: item.defaultUnit || p[cat.id].unit,
                                      },
                                    }));
                                  }}
                                  placeholder="Item name" />
                              </td>
                              <td className="lbe-c-make">
                                <input className="lbe-inp" value={draft.make}
                                  onChange={e => setItemDraft(cat.id, "make", e.target.value)} placeholder="Make" />
                              </td>
                              <td className="lbe-c-num">
                                <input className="lbe-inp" type="number" min="0" value={draft.quantity}
                                  onChange={e => setItemDraft(cat.id, "quantity", e.target.value)} />
                              </td>
                              <td className="lbe-c-unit">
                                <input className="lbe-inp" value={draft.unit}
                                  onChange={e => setItemDraft(cat.id, "unit", e.target.value)} placeholder="Unit" />
                              </td>
                              <td className="lbe-c-num">
                                <input className="lbe-inp" type="number" min="0" value={draft.unitRate}
                                  onChange={e => setItemDraft(cat.id, "unitRate", e.target.value)} />
                              </td>
                              <td className="lbe-c-num lbe-amt">
                                ₹{fmtINR(round2((Number(draft.quantity) || 0) * (Number(draft.unitRate) || 0)))}
                              </td>
                              <td className="lbe-c-act">
                                <button className="lbe-icon-save" title="Add item" disabled={busy}
                                  onClick={() => saveItem(cat.id)}>✓</button>
                                <button className="lbe-icon-del" title="Discard" onClick={() => cancelItemDraft(cat.id)}>✕</button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {canEdit && !draft && (
                        <button className="lbe-add-item" onClick={() => startItemDraft(cat)}>＋ Add item</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
