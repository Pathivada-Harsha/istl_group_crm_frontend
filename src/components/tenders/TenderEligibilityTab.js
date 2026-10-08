// ─────────────────────────────────────────────────────────────────────────────
//  Eligibility tab — Technical / Financial / Legal criteria, each auto pass/fail/pending
//  via evaluateCriterion. A failed criterion can be overridden with a reason
//  (OVERRIDDEN badge + Undo). Overall roll-up: GO / NO-GO / PENDING.
//
//  Owns tender.eligibilityCriteria. The GO/No-Go value is computed live here and
//  cached to tender.eligibilityDecision on Save (used by the Workflow pre-fill).
//
//  Rows sharing an altGroup are OR-alternatives of one clause ("1 no. 66kV
//  sub-station OR 5 nos. 33kV …"): they render boxed under "Any one of" and the
//  box passes as soon as one alternative does. Imported rows carry the tender's
//  own wording and page, one click away under "Source".
//
//  Tiered tenders (empanelment / EOI: Category A / B / C, each with its own
//  turnover and experience bar) put a Tier on their rows. Then the page shows
//  the rows every bidder must meet first, then one section per tier with its
//  status, and the banner says which tier(s) the company qualifies for —
//  meeting every row of ANY one tier is enough. A tender with no tiers looks
//  and evaluates exactly as before.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  blankCriterion, evaluateCriterion, evaluateUnit, computeEligibility, groupCriteria,
  OPERATORS, suggestOperator, currentUserLabel, ELIGIBILITY_CATEGORIES, tierResults, qualifyingTiers,
} from '../../services/tenderData';

const tierOf = (c) => String(c.tier || '').trim();
const TIER_STATUS = { pass: 'Qualifies', fail: 'Not met', pending: 'Pending' };

// Sections always offered, even when empty, so there is somewhere to add a
// criterion of each kind. The list is shared with the Excel template's
// Category dropdown.
const BASE_CATEGORIES = ELIGIBILITY_CATEGORIES;
const OTHER = '__other__';

export default function TenderEligibilityTab({ tender, setTender }) {
  const [overrideKey, setOverrideKey] = useState(null);
  const [reason, setReason] = useState('');
  const [openSources, setOpenSources] = useState(() => new Set());
  const toggleSource = (key) => setOpenSources((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const criteria = tender.eligibilityCriteria || [];
  const decision = computeEligibility(criteria);
  const tiers = tierResults(criteria);
  const qualifies = qualifyingTiers(criteria);
  // The rows every bidder must meet: all of them on an ordinary tender.
  const common = criteria.filter((c) => !tierOf(c));

  // computeEligibility counts EVERY criterion, so each one must be reachable in
  // the UI — a row in a section we don't render would sit pending forever and
  // silently lock Documents/Rate Analysis/Workflow with no way to clear it.
  // Render the base sections plus any other category present, and sweep rows
  // with a blank/unknown category into a final "Other" bucket. Tiered rows are
  // rendered in their tier's section instead.
  const categoryOf = (c) => (c.category || '').trim();
  const extraCategories = [...new Set(common.map(categoryOf))]
    .filter((c) => c && !BASE_CATEGORIES.includes(c));
  const hasUncategorised = common.some((c) => !categoryOf(c));
  const sections = [
    ...BASE_CATEGORIES,
    ...extraCategories,
    ...(hasUncategorised ? [OTHER] : []),
  ];

  const upd = (key, changes) => setTender((prev) => ({
    ...prev,
    eligibilityCriteria: prev.eligibilityCriteria.map((c) => (c._key === key ? { ...c, ...changes } : c)),
  }));
  const add = (category, tier = '') => setTender((prev) => ({
    ...prev, eligibilityCriteria: [...(prev.eligibilityCriteria || []), { ...blankCriterion(category), tier }],
  }));
  // Removing an alternative can leave a group of one, which is no longer a
  // choice — that last row goes back to being an ordinary criterion.
  const remove = (key) => setTender((prev) => {
    const gone = prev.eligibilityCriteria.find((c) => c._key === key);
    let rest = prev.eligibilityCriteria.filter((c) => c._key !== key);
    if (gone && gone.altGroup) {
      const sameGroup = (c) => c.altGroup === gone.altGroup && c.category === gone.category
        && tierOf(c) === tierOf(gone);
      if (rest.filter(sameGroup).length === 1) {
        rest = rest.map((c) => (sameGroup(c) ? { ...c, altGroup: '' } : c));
      }
    }
    return { ...prev, eligibilityCriteria: rest };
  });
  // A new alternative goes straight after the group's last member.
  const addAlternative = (unit) => setTender((prev) => {
    const list = [...prev.eligibilityCriteria];
    const last = unit.rows[unit.rows.length - 1];
    const at = list.findIndex((c) => c._key === last._key);
    list.splice(at + 1, 0, { ...blankCriterion(last.category), altGroup: unit.altGroup, tier: last.tier || '' });
    return { ...prev, eligibilityCriteria: list };
  });

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

  // Say how many are outstanding: "some criteria are not yet evaluated" gives no
  // clue what to go and fix when the rows are further down the page. An OR
  // group counts once — it is one requirement however many ways it can be met.
  // On a tiered tender only the common rows are counted here; the tiers speak
  // for themselves in the strip under the banner.
  const units = groupCriteria(common);
  const countBy = (r) => units.filter((u) => evaluateUnit(u.rows) === r).length;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const banner = tiers.length ? {
    GO: {
      cls: 'tnd-elig-go', verdict: 'GO',
      note: `Qualifies for ${qualifies.join(', ')}${common.length ? ', and every common criterion is met' : ''}.`,
    },
    NO_GO: {
      cls: 'tnd-elig-nogo', verdict: 'NO-GO',
      note: countBy('fail')
        ? `${plural(countBy('fail'), 'common criterion fails', 'common criteria fail')} and are not overridden.`
        : 'Every tier has a criterion that fails — the company qualifies for no tier.',
    },
    PENDING: {
      cls: 'tnd-elig-pending', verdict: 'PENDING',
      note: qualifies.length
        ? `Qualifies for ${qualifies.join(', ')}, but ${plural(countBy('pending'), 'common criterion still needs', 'common criteria still need')} a value.`
        : 'No tier is fully met yet — meeting every criterion of any one tier is enough.',
    },
  }[decision] : {
    GO: { cls: 'tnd-elig-go', verdict: 'GO', note: 'All criteria are satisfied (passed or overridden).' },
    NO_GO: {
      cls: 'tnd-elig-nogo', verdict: 'NO-GO',
      note: `${plural(countBy('fail'), 'criterion fails', 'criteria fail')} and are not overridden.`,
    },
    PENDING: {
      cls: 'tnd-elig-pending', verdict: 'PENDING',
      note: `${plural(countBy('pending'), 'criterion', 'criteria')} still need a value — check every section below.`,
    },
  }[decision];

  const resultBadge = (c) => {
    if (c.override) return <span className="tnd-badge tnd-badge-override">Overridden</span>;
    const r = evaluateCriterion(c);
    return <span className={`tnd-badge tnd-badge-${r}`}>{r}</span>;
  };

  const renderSection = (category) => {
    const isOther = category === OTHER;
    const label = isOther ? 'Other' : category;
    const rows = isOther
      ? common.filter((c) => !categoryOf(c))
      : common.filter((c) => categoryOf(c) === category);
    return (
      <div key={category}>
        <div className="tnd-elig-section-title">
          <span>{label} Criteria</span>
          {!isOther && (
            <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={() => add(category)}>＋ Add criterion</button>
          )}
        </div>
        {renderTable(rows, `No ${label.toLowerCase()} criteria yet.`)}
      </div>
    );
  };

  // One tier: every row of it in one table, whatever its category.
  const renderTier = (t) => (
    <div key={`tier::${t.tier}`} className={`tnd-elig-tier is-${t.status}`}>
      <div className="tnd-elig-section-title">
        <span>
          Tier: {t.tier}{' '}
          <span className={`tnd-badge tnd-badge-${t.status}`}>{TIER_STATUS[t.status]}</span>
        </span>
        <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={() => add('Technical', t.tier)}>＋ Add criterion</button>
      </div>
      {renderTable(t.rows, 'No criteria in this tier.')}
    </div>
  );

  const renderTable = (rows, emptyText) => (
    rows.length === 0 ? (
      <div className="tnd-empty">{emptyText}</div>
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
                {groupCriteria(rows).map((u) => (u.altGroup ? (
                  <React.Fragment key={u.key}>
                    <tr className="tnd-elig-group-head">
                      <td colSpan={6}>
                        <span className="tnd-elig-group-label">Any one of</span>
                        <span className="tnd-elig-group-ref">{u.altGroup}</span>
                        {unitBadge(u)}
                        <button className="tnd-link-txt" onClick={() => addAlternative(u)}>＋ Add alternative</button>
                      </td>
                    </tr>
                    {u.rows.map((c, i) => (
                      <React.Fragment key={c._key}>
                        {i > 0 && (
                          <tr className="tnd-elig-or-row"><td colSpan={6}><span>or</span></td></tr>
                        )}
                        {renderRow(c, true)}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ) : renderRow(u.rows[0], false)))}
              </tbody>
            </table>
          </div>
    )
  );

  const unitBadge = (u) => {
    const r = evaluateUnit(u.rows);
    return <span className={`tnd-badge tnd-badge-${r}`}>{r}</span>;
  };

  const renderRow = (c, inGroup) => {
    const failed = !c.override && evaluateCriterion(c) === 'fail';
    const sourceOpen = openSources.has(c._key);
    return (
      <tr key={c._key} className={inGroup ? 'tnd-elig-alt' : undefined}>
        <td>
          <input className="tnd-inp" value={c.criterionName}
            placeholder="e.g. Average annual turnover"
            onChange={(e) => upd(c._key, { criterionName: e.target.value })} />
          {/* Blank = every bidder must meet it; a name puts it in that tier. */}
          <input className="tnd-inp tnd-elig-tier-inp" value={c.tier || ''}
            placeholder="Tier (optional, e.g. Category A)"
            aria-label="Tier"
            onChange={(e) => upd(c._key, { tier: e.target.value })} />
          {c.override && (
            <div className="tnd-override-reason">
              Overridden: {c.overrideReason || '—'} · {c.overrideBy}{c.overrideAt ? ` · ${c.overrideAt}` : ''}
            </div>
          )}
          {/* The tender's own wording: the name above is a summary, and the
              clause is what a bidder is actually judged against. */}
          {c.clauseText && (
            <button type="button" className="tnd-elig-source-btn" aria-expanded={sourceOpen}
              onClick={() => toggleSource(c._key)}>
              {sourceOpen ? '▾' : '▸'} Source{c.sourcePage ? ` · p.${c.sourcePage}` : ''}
            </button>
          )}
          {sourceOpen && <blockquote className="tnd-elig-clause">{c.clauseText}</blockquote>}
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
  };

  return (
    <div>
      {/* Overall banner */}
      <div className={`tnd-elig-banner ${banner.cls}`}>
        <span className="tnd-elig-verdict">{banner.verdict}</span>
        <span className="tnd-elig-note">{banner.note}</span>
      </div>

      {tiers.length > 0 && (
        <div className="tnd-elig-tier-strip" aria-label="Tiers">
          {tiers.map((t) => (
            <span key={t.tier} className={`tnd-elig-tier-chip is-${t.status}`}>
              {t.tier}: {TIER_STATUS[t.status]}
            </span>
          ))}
        </div>
      )}

      <p className="tnd-hint">
        Enter each eligibility requirement and our corresponding value. The result is evaluated automatically
        from the operator. A failed criterion may be individually overridden with a documented reason.
        {tiers.length > 0 && ' This tender classifies bidders into tiers: meeting every criterion of any one tier — plus every common criterion — qualifies.'}
      </p>

      {tiers.length > 0 && <div className="tnd-elig-group-title">Every bidder must meet</div>}
      {sections.map(renderSection)}
      {tiers.length > 0 && <div className="tnd-elig-group-title">Tiers — meet every criterion of any one</div>}
      {tiers.map(renderTier)}

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
