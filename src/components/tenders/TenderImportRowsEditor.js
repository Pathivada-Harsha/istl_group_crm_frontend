// ─────────────────────────────────────────────────────────────────────────────
//  TenderImportRowsEditor — the Eligibility / Documents / BOQ rows of an Excel
//  import, viewable and editable inside the review before anything is saved.
//
//  Each row carries the status the backend gave it (OK / WARNING / ERROR) and
//  the reasons, plus how it fared against the tender PDF (Verified /
//  Unverified / Mismatch) with the passage it was found in. The parent
//  re-checks the rows after every edit, so a fixed row turns OK — and a
//  corrected Source Text can turn a row Verified — without leaving the review.
//
//  An Unverified row needs a tick ("I checked this") before it can be saved,
//  unless the whole table was confirmed with the parent's bulk tick.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ELIGIBILITY_CATEGORIES, OPERATORS } from '../../services/tenderData';

const SOURCE = { key: 'sourceText', label: 'Source Text (from PDF)', wide: true, source: true };

// Columns per collection, in template order. `options` makes a cell a dropdown.
export const ROW_COLUMNS = {
  eligibilityCriteria: [
    { key: 'category', label: 'Category', options: ELIGIBILITY_CATEGORIES.map((c) => ({ value: c, label: c })) },
    { key: 'criterionName', label: 'Criterion', wide: true },
    { key: 'requiredValue', label: 'Required Value' },
    { key: 'operator', label: 'Operator', options: OPERATORS },
    { key: 'tier', label: 'Tier', narrow: true },
    { key: 'altGroup', label: 'Alt. Group', narrow: true },
    SOURCE,
  ],
  documents: [
    { key: 'documentName', label: 'Document Name', wide: true },
    SOURCE,
  ],
  boqItems: [
    { key: 'itemNo', label: 'Item No', narrow: true },
    { key: 'scope', label: 'Scope/Section' },
    { key: 'description', label: 'Description', wide: true },
    { key: 'unit', label: 'Unit', narrow: true },
    { key: 'quantity', label: 'Quantity', narrow: true },
    SOURCE,
  ],
};

export const blankImportRow = (collection) => {
  const r = {};
  ROW_COLUMNS[collection].forEach((c) => { r[c.key] = ''; });
  return r;
};

export const StatusPill = ({ status, title }) => {
  const s = status || 'OK';
  const label = s === 'ERROR' ? 'Error' : s === 'WARNING' ? 'Warning' : 'OK';
  return <span className={`tnd-import-status is-${s.toLowerCase()}`} title={title || ''}>{label}</span>;
};

// How a value fared against the tender PDF. Nothing to show for a blank value.
export const VerifyPill = ({ verification, title }) => {
  if (!verification) return null;
  const label = verification === 'VERIFIED' ? '✓ Verified'
    : verification === 'MISMATCH' ? '✕ Mismatch' : '? Unverified';
  return (
    <span className={`tnd-verify-pill is-${verification.toLowerCase()}`} title={title || ''}>{label}</span>
  );
};

// One line saying where in the PDF a value was found — or why it was not.
export const VerifyNote = ({ st }) => {
  if (!st || !st.verification) return null;
  if (st.verification === 'VERIFIED' && st.verifyText) {
    return (
      <span className="tnd-verify-note is-verified">
        PDF{st.verifyPage ? ` p.${st.verifyPage}` : ''}: “{st.verifyText}”
      </span>
    );
  }
  return st.verifyReason
    ? <span className={`tnd-verify-note is-${st.verification.toLowerCase()}`}>{st.verifyReason}</span>
    : null;
};

export default function TenderImportRowsEditor({
  collection, rows, statuses, onChange, disabled,
  acks = [], onAck, bulkAcked = false, onlyFlagged = false,
}) {
  const columns = ROW_COLUMNS[collection];

  const setCell = (i, key, value) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)), i);
  const remove = (i) => onChange(rows.filter((_, j) => j !== i), -1);
  const add = () => onChange([...rows, blankImportRow(collection)], -1);

  const visible = rows
    .map((r, i) => ({ r, i, st: statuses[i] || {} }))
    .filter(({ st }) => !onlyFlagged || (st.verification && st.verification !== 'VERIFIED'));

  return (
    <div className="tnd-import-rows">
      <table className="tnd-import-rows-table">
        <thead>
          <tr>
            <th className="tnd-import-rows-num">#</th>
            {columns.map((c) => (
              <th key={c.key} className={`${c.wide ? 'is-wide' : c.narrow ? 'is-narrow' : ''}${c.source ? ' is-source' : ''}`}>{c.label}</th>
            ))}
            <th className="tnd-import-rows-status">Status</th>
            <th className="tnd-import-rows-status">PDF check</th>
            <th aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr className="tnd-import-rows-issues">
              <td />
              <td colSpan={columns.length + 3}>Every row here was verified against the PDF.</td>
            </tr>
          )}
          {visible.map(({ r, i, st }) => {
            const issues = st.issues || [];
            const unverified = st.verification === 'UNVERIFIED';
            return (
              <React.Fragment key={i}>
                <tr className={st.status === 'ERROR' ? 'is-error' : st.status === 'WARNING' ? 'is-warning' : ''}>
                  <td className="tnd-import-rows-num">{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={c.source ? 'is-source' : ''}>
                      {c.options ? (
                        <select
                          className="tnd-import-input"
                          value={r[c.key] || ''}
                          onChange={(e) => setCell(i, c.key, e.target.value)}
                          disabled={disabled}
                          aria-label={`${c.label}, row ${i + 1}`}
                        >
                          <option value="">—</option>
                          {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="tnd-import-input"
                          value={r[c.key] ?? ''}
                          onChange={(e) => setCell(i, c.key, e.target.value)}
                          disabled={disabled}
                          placeholder={c.source ? 'Exact words from the PDF' : undefined}
                          aria-label={`${c.label}, row ${i + 1}`}
                        />
                      )}
                    </td>
                  ))}
                  <td className="tnd-import-rows-status">
                    <StatusPill status={st.status} title={issues.join(' · ')} />
                  </td>
                  <td className="tnd-import-rows-status">
                    <VerifyPill verification={st.verification} title={st.verifyReason} />
                    {unverified && (
                      <label className="tnd-verify-ack" title="Confirm you checked this row against the PDF yourself">
                        <input
                          type="checkbox"
                          checked={bulkAcked || !!acks[i]}
                          disabled={disabled || bulkAcked || !onAck}
                          onChange={(e) => onAck && onAck(i, e.target.checked)}
                        />
                        checked
                      </label>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="tnd-icon-x"
                      onClick={() => remove(i)}
                      disabled={disabled}
                      title="Remove this row"
                      aria-label={`Remove row ${i + 1}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
                {(issues.length > 0 || st.verification) && (
                  <tr className="tnd-import-rows-issues">
                    <td />
                    <td colSpan={columns.length + 3}>
                      {issues.length > 0 && <span>{issues.join(' · ')}</span>}
                      {issues.length > 0 && st.verification === 'VERIFIED' && ' · '}
                      {st.verification !== 'MISMATCH' && <VerifyNote st={st} />}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={add} disabled={disabled}>
        + Add row
      </button>
    </div>
  );
}
