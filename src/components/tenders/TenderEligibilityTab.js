// ─────────────────────────────────────────────────────────────────────────────
//  Eligibility tab — Technical + Financial criteria, each auto pass/fail/pending
//  via evaluateCriterion. A failed criterion can be overridden with a reason
//  (OVERRIDDEN badge + Undo). Overall roll-up: GO / NO-GO / PENDING.
//
//  Owns tender.eligibilityCriteria. The GO/No-Go value is computed live here and
//  cached to tender.eligibilityDecision on Save (used by the Workflow pre-fill).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  blankCriterion, evaluateCriterion, computeEligibility, OPERATORS, suggestOperator, currentUserLabel,
} from '../../services/tenderData';

const CATEGORIES = ['Technical', 'Financial'];

export default function TenderEligibilityTab({ tender, setTender }) {
  const [overrideKey, setOverrideKey] = useState(null);
  const [reason, setReason] = useState('');

  const criteria = tender.eligibilityCriteria || [];
  const decision = computeEligibility(criteria);

  const upd = (key, changes) => setTender((prev) => ({
    ...prev,
    eligibilityCriteria: prev.eligibilityCriteria.map((c) => (c._key === key ? { ...c, ...changes } : c)),
  }));
  const add = (category) => setTender((prev) => ({
    ...prev, eligibilityCriteria: [...(prev.eligibilityCriteria || []), blankCriterion(category)],
  }));
  const remove = (key) => setTender((prev) => ({
    ...prev, eligibilityCriteria: prev.eligibilityCriteria.filter((c) => c._key !== key),
  }));

  // Update a value cell and, while the operator is still the default '≥',
  // auto-pick the operator from the value's shape (yes/no → boolean, number → ≥,
  // text → contains). Once the operator has been set to anything else, it's left
  // alone — a deliberate choice is never overridden.
  const applyValue = (c, field, val) => {
    const changes = { [field]: val };
    if (c.operator === 'gte') {
      const op = suggestOperator(val);
      if (op && op !== 'gte') {
        changes.operator = op;
        if (op === 'boolean') {
          const low = String(val).trim().toLowerCase();
          changes[field] = (low.startsWith('y') || low === 'true') ? 'yes' : 'no';
        }
      }
    }
    upd(c._key, changes);
  };

  const openOverride = (c) => { setOverrideKey(c._key); setReason(c.overrideReason || ''); };
  const applyOverride = () => {
    upd(overrideKey, {
      override: true, overrideReason: reason.trim(),
      overrideBy: currentUserLabel(), overrideAt: new Date().toISOString().slice(0, 10),
    });
    setOverrideKey(null); setReason('');
  };
  const undoOverride = (key) => upd(key, { override: false, overrideReason: '', overrideBy: '', overrideAt: '' });

  const banner = {
    GO: { cls: 'tnd-elig-go', verdict: 'GO', note: 'All criteria are satisfied (passed or overridden).' },
    NO_GO: { cls: 'tnd-elig-nogo', verdict: 'NO-GO', note: 'At least one criterion fails and is not overridden.' },
    PENDING: { cls: 'tnd-elig-pending', verdict: 'PENDING', note: 'Some criteria are not yet evaluated.' },
  }[decision];

  const resultBadge = (c) => {
    if (c.override) return <span className="tnd-badge tnd-badge-override">Overridden</span>;
    const r = evaluateCriterion(c);
    return <span className={`tnd-badge tnd-badge-${r}`}>{r}</span>;
  };

  const renderSection = (category) => {
    const rows = criteria.filter((c) => c.category === category);
    return (
      <div key={category}>
        <div className="tnd-elig-section-title">
          <span>{category} Criteria</span>
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={() => add(category)}>＋ Add criterion</button>
        </div>
        {rows.length === 0 ? (
          <div className="tnd-empty">No {category.toLowerCase()} criteria yet.</div>
        ) : (
          <div className="tnd-table-wrap">
            <table className="tnd-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Criterion</th>
                  <th style={{ width: 140 }}>Required</th>
                  <th style={{ width: 140 }}>Our Value</th>
                  <th style={{ width: 150 }}>Operator</th>
                  <th style={{ width: 110 }}>Result</th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const failed = !c.override && evaluateCriterion(c) === 'fail';
                  return (
                    <tr key={c._key}>
                      <td>
                        <input className="tnd-inp" value={c.criterionName}
                          placeholder="e.g. Average annual turnover"
                          onChange={(e) => upd(c._key, { criterionName: e.target.value })} />
                        {c.override && (
                          <div className="tnd-override-reason">
                            Overridden: {c.overrideReason || '—'} · {c.overrideBy}{c.overrideAt ? ` · ${c.overrideAt}` : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <input className="tnd-inp" value={c.requiredValue}
                          disabled={c.operator === 'boolean'}
                          onChange={(e) => applyValue(c, 'requiredValue', e.target.value)} />
                      </td>
                      <td>
                        {c.operator === 'boolean' ? (
                          <select className="tnd-inp" value={c.ourValue || ''}
                            onChange={(e) => upd(c._key, { ourValue: e.target.value })}>
                            <option value="">—</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <input className="tnd-inp" value={c.ourValue}
                            onChange={(e) => applyValue(c, 'ourValue', e.target.value)} />
                        )}
                      </td>
                      <td>
                        <select className="tnd-inp" value={c.operator}
                          onChange={(e) => upd(c._key, { operator: e.target.value })}>
                          {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td>{resultBadge(c)}</td>
                      <td>
                        <div className="tnd-row-actions">
                          {failed && <button className="tnd-link-txt" onClick={() => openOverride(c)}>Override</button>}
                          {c.override && <button className="tnd-link-txt" onClick={() => undoOverride(c._key)}>Undo</button>}
                          <button className="tnd-icon-x" title="Remove" onClick={() => remove(c._key)}>×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Overall banner */}
      <div className={`tnd-elig-banner ${banner.cls}`}>
        <span className="tnd-elig-verdict">{banner.verdict}</span>
        <span className="tnd-elig-note">{banner.note}</span>
      </div>

      <p className="tnd-hint">
        Enter each eligibility requirement and our corresponding value. The result is evaluated automatically
        from the operator. A failed criterion may be individually overridden with a documented reason.
      </p>

      {CATEGORIES.map(renderSection)}

      {/* Override reason modal */}
      {overrideKey && (
        <div className="tnd-modal-overlay" onClick={() => setOverrideKey(null)}>
          <div className="tnd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tnd-modal-head">
              <span className="tnd-modal-title">Override failed criterion</span>
              <button className="tnd-icon-x" onClick={() => setOverrideKey(null)}>×</button>
            </div>
            <div className="tnd-modal-body">
              <div className="tnd-field">
                <label>Reason for override <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this failed criterion acceptable? (e.g. relaxation clause, consortium partner covers it)" />
              </div>
              <div className="tnd-hint">Recorded as {currentUserLabel()} · {new Date().toISOString().slice(0, 10)}</div>
            </div>
            <div className="tnd-modal-foot">
              <button className="tnd-btn tnd-btn-secondary" onClick={() => setOverrideKey(null)}>Cancel</button>
              <button className="tnd-btn tnd-btn-primary" disabled={!reason.trim()} onClick={applyOverride}>Confirm override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
