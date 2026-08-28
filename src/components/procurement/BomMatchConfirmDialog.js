import React, { useEffect, useMemo, useState } from 'react';
import { Link2, AlertTriangle, X, Check } from 'lucide-react';
import '../../components_css/procurement/BomMatchConfirmDialog.css';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Values arrive as strings to preserve DECIMAL scale — trim trailing zeros for display. */
const qty = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = num(v);
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};

const dash = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : v);

/**
 * BomMatchConfirmDialog — confirm the BOM lines the backend could only INFER.
 *
 * A line picked from the BOM carries its line id and needs no confirmation. A line
 * typed by hand carries nothing, so the guard falls back to matching on item name,
 * make and unit. That fallback is a good guess, not a fact: a project may hold the
 * same item under two scope phases with a separate quantity for each, and consuming
 * the wrong one silently over-spends one budget while the other still looks
 * untouched. So every inferred match is shown here with the line it matched, and
 * can be corrected, before anything is written.
 *
 * Shown only when there is something to confirm — a PO whose every line came from
 * the picker never sees this dialog.
 *
 * @param {boolean}  open
 * @param {Array}    matches   fallbackMatches from the precheck:
 *                             [{lineNo, itemName, make, unit, quantity, bomLineId,
 *                               bomItemName, bomMake, bomUnit, bomScopeItemId,
 *                               bomQty, alreadyOrdered, remaining, candidateCount}]
 * @param {Array}    bomLines  every live BOM line (the picker's own feed), so the
 *                             correction dropdown can offer all of them with remaining qty
 * @param {Array}    scopes    [{id, name}] so a BOM line reads under its scope phase
 * @param {function} onConfirm called with { [lineNo]: bomLineId } — the confirmed mapping
 * @param {function} onCancel
 */
const BomMatchConfirmDialog = ({
  open,
  matches = [],
  bomLines = [],
  scopes = [],
  onConfirm,
  onCancel,
}) => {
  // lineNo -> chosen bomLineId (seeded with what the backend inferred)
  const [chosen, setChosen] = useState({});

  useEffect(() => {
    if (!open) return;
    const seed = {};
    matches.forEach(m => { seed[m.lineNo] = m.bomLineId; });
    setChosen(seed);
    // matches is rebuilt on every precheck, so re-seed whenever the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matches]);

  const scopeName = useMemo(() => {
    const m = new Map();
    (scopes || []).forEach(s => m.set(String(s.id), s.name || '(unnamed activity)'));
    return (id) => (id == null ? 'Unassigned' : m.get(String(id)) || 'Unassigned');
  }, [scopes]);

  /** BOM lines grouped by scope, for the correction dropdown. */
  const grouped = useMemo(() => {
    const byScope = new Map();
    (bomLines || []).forEach(l => {
      const key = l.scopeItemId == null ? '__none__' : String(l.scopeItemId);
      if (!byScope.has(key)) byScope.set(key, { name: scopeName(l.scopeItemId), lines: [] });
      byScope.get(key).lines.push(l);
    });
    return [...byScope.values()];
  }, [bomLines, scopeName]);

  if (!open || !matches.length) return null;

  const label = (l) =>
    `${l.itemName}${l.make ? ` · ${l.make}` : ''} — ${qty(l.remaining)} of ${qty(l.bomQty)} ${l.unit || ''} left`;

  const changed = matches.filter(m => String(chosen[m.lineNo]) !== String(m.bomLineId)).length;

  return (
    <div className="bmc-overlay" onClick={onCancel}>
      <div className="bmc-modal" onClick={e => e.stopPropagation()}>
        <div className="bmc-header">
          <div className="bmc-title">
            <Link2 size={18} />
            <span>
              Confirm {matches.length} BOM {matches.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          <button type="button" className="bmc-close" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="bmc-body">
          <p className="bmc-lede">
            {matches.length === 1 ? 'This line was' : 'These lines were'} matched to the project BOM by
            name, make and unit rather than picked from it. Confirm the line{matches.length === 1 ? '' : 's'} each
            one will consume — the quantity comes off that BOM line's budget.
          </p>

          <ul className="bmc-list">
            {matches.map((m) => {
              const isChanged = String(chosen[m.lineNo]) !== String(m.bomLineId);
              return (
                <li key={m.lineNo} className={`bmc-item${isChanged ? ' bmc-item-changed' : ''}`}>
                  <div className="bmc-item-head">
                    <span className="bmc-line-no">Line {m.lineNo}</span>
                    <span className="bmc-item-name">{m.itemName || '(unnamed item)'}</span>
                    <span className="bmc-item-qty">{qty(m.quantity)} {m.unit || ''}</span>
                  </div>

                  <div className="bmc-typed">
                    <span><label>Make</label>{dash(m.make)}</span>
                    <span><label>Unit</label>{dash(m.unit)}</span>
                  </div>

                  {m.candidateCount > 1 && (
                    <div className="bmc-ambiguous">
                      <AlertTriangle size={13} />
                      {m.candidateCount} BOM lines fit this item. The one below was chosen by BOM
                      order — check it is the right scope.
                    </div>
                  )}

                  <label className="bmc-field">
                    <span className="bmc-field-label">Consumes this BOM line</span>
                    <select
                      className="bmc-select"
                      value={chosen[m.lineNo] ?? ''}
                      onChange={e => setChosen(p => ({ ...p, [m.lineNo]: Number(e.target.value) }))}
                    >
                      {grouped.map((g, gi) => (
                        <optgroup key={gi} label={g.name}>
                          {g.lines.map(l => (
                            <option key={l.bomLineId} value={l.bomLineId}>{label(l)}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <div className="bmc-matched-note">
                    Matched to <b>{m.bomItemName}</b>
                    {m.bomMake ? <> · {m.bomMake}</> : null} under <b>{scopeName(m.bomScopeItemId)}</b> —
                    {' '}{qty(m.alreadyOrdered)} of {qty(m.bomQty)} already ordered.
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bmc-footer">
          {changed > 0 && (
            <span className="bmc-changed-note">{changed} corrected</span>
          )}
          <button type="button" className="bmc-btn" onClick={onCancel}>Back to the order</button>
          <button type="button" className="bmc-btn bmc-btn-primary" onClick={() => onConfirm(chosen)}>
            <Check size={15} />
            Confirm &amp; save
          </button>
        </div>
      </div>
    </div>
  );
};

export default BomMatchConfirmDialog;
