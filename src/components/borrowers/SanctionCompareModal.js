// src/components/borrowers/SanctionCompareModal.js
//
// Shown when a letter is attached to a sanction whose values were typed by
// hand. The document is parsed and every field compared against what is on
// record, so a mistyped amount surfaces against what the lender actually wrote.
//
// The user decides field by field. Nothing is overwritten silently — a typed
// value may well be the correct one (a letter can be superseded by a phone
// call, and the parser can misread), so the choice stays with the person who
// has both in front of them.

import React, { useMemo, useState } from 'react';
import { X, Check, AlertTriangle, FileText } from 'lucide-react';
import '../../pages-css/BorrowerRegistry.css';

// Compared in the order they appear on the letter, so the reviewer can read
// down the page and down the dialog together.
const FIELDS = [
  { key: 'refNo', label: 'Reference number' },
  { key: 'sanctionDate', label: 'Sanction date', kind: 'date' },
  { key: 'lenderName', label: 'Lender' },
  { key: 'projectName', label: 'Project' },
  { key: 'category', label: 'Category' },
  { key: 'location', label: 'Location' },
  { key: 'projectCost', label: 'Total project cost', kind: 'money' },
  { key: 'sanctionedAmount', label: 'Sanctioned amount', kind: 'money' },
  { key: 'debtEquityRatio', label: 'Debt : equity', kind: 'ratio' },
  { key: 'interestRateText', label: 'Rate of interest' },
  { key: 'tenorText', label: 'Tenor' },
  { key: 'scheduledCod', label: 'Scheduled COD', kind: 'date' },
];

/**
 * Compare two values for *meaning*, not for characters.
 *
 * "Rs. 201.60 Crore" and "₹201.60 Cr" are the same number written two ways,
 * and flagging that as a mismatch would bury the one difference that matters
 * in a list of twelve that don't. Each kind gets normalised to a canonical
 * form before comparison.
 */
const normalise = (raw, kind) => {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim().toLowerCase();
  if (!s) return '';

  if (kind === 'money') {
    // Reduce to plain rupees so units and currency symbols stop mattering.
    const m = s.match(/(\d[\d,]*(?:\.\d+)?)/);
    if (!m) return s;
    let n = parseFloat(m[1].replace(/,/g, ''));
    const tail = s.slice(m.index + m[1].length);
    if (/crore|\bcrs?\b/.test(tail)) n *= 10000000;
    else if (/lakh|lac/.test(tail)) n *= 100000;
    return String(Math.round(n));
  }

  if (kind === 'date') {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const clean = s.replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
    let m = clean.match(/^(\d{1,2})\s+([a-z]{3,12})\s+(\d{4})$/);
    if (m) {
      const idx = months.findIndex((mo) => m[2].startsWith(mo));
      if (idx >= 0) return `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    m = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return clean;
  }

  if (kind === 'ratio') return s.replace(/[^0-9:]/g, '').replace(/\/+/g, ':');

  // Collapse whitespace and drop trailing punctuation so wording differences
  // in spacing don't register as a change.
  return s.replace(/\s+/g, ' ').replace(/[.,;]+$/, '');
};

const SanctionCompareModal = ({ current, parsed, fileName, onCancel, onConfirm }) => {
  // Rows where the two genuinely disagree AND the letter actually supplied a
  // value. A field the parser couldn't find is not evidence of a mistake.
  const rows = useMemo(() => FIELDS.map((f) => {
    const mine = current?.[f.key] ?? '';
    const theirs = parsed?.[f.key] ?? '';
    const differs = String(theirs).trim() !== ''
      && normalise(mine, f.kind) !== normalise(theirs, f.kind);
    return { ...f, mine, theirs, differs };
  }), [current, parsed]);

  const diffs = rows.filter((r) => r.differs);

  // Default to keeping what the user typed. Adopting the letter wholesale
  // would undo deliberate corrections without anyone noticing.
  const [choices, setChoices] = useState(
    () => diffs.reduce((acc, r) => ({ ...acc, [r.key]: 'mine' }), {}),
  );

  const choose = (key, which) => setChoices((c) => ({ ...c, [key]: which }));
  const setAll = (which) => setChoices(
    diffs.reduce((acc, r) => ({ ...acc, [r.key]: which }), {}),
  );

  const handleConfirm = () => {
    const updates = {};
    diffs.forEach((r) => {
      if (choices[r.key] === 'theirs') updates[r.key] = r.theirs;
    });
    onConfirm(updates);
  };

  const adopting = Object.values(choices).filter((v) => v === 'theirs').length;

  return (
    <div className="br-modal-backdrop" onMouseDown={onCancel}>
      <div
        className="br-modal br-modal-wide"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Compare with the attached letter"
      >
        <div className="br-modal-head">
          <div className="br-viewer-title">
            <FileText size={18} className="br-viewer-icon" aria-hidden="true" />
            <div className="br-viewer-title-text">
              <h3 className="br-modal-title">
                {diffs.length === 0 ? 'The letter matches' : 'The letter says something different'}
              </h3>
              <p className="br-modal-sub br-modal-file">
                <span className="br-modal-filename">{fileName}</span>
              </p>
            </div>
          </div>
          <button type="button" className="br-icon-btn" onClick={onCancel} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {diffs.length === 0 ? (
          <div className="br-modal-body br-modal-body-single">
            <div className="br-empty">
              <p>Every field on record agrees with the attached letter.</p>
              <p className="br-muted">The document will be stored against this sanction.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="br-compare-bar">
              <span className="br-compare-count">
                <AlertTriangle size={14} aria-hidden="true" />
                {diffs.length} field{diffs.length === 1 ? '' : 's'} differ
                {diffs.length === 1 ? 's' : ''}
              </span>
              <span className="br-compare-actions">
                <button type="button" className="br-link" onClick={() => setAll('mine')}>
                  Keep all mine
                </button>
                <button type="button" className="br-link" onClick={() => setAll('theirs')}>
                  Use all from letter
                </button>
              </span>
            </div>

            <div className="br-modal-body br-modal-body-single">
              <table className="br-compare">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>On record</th>
                    <th>In the letter</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((r) => (
                    <tr key={r.key}>
                      <td className="br-compare-label">{r.label}</td>
                      <td>
                        <button
                          type="button"
                          className={`br-compare-opt ${
                            choices[r.key] === 'mine' ? 'br-compare-on' : ''}`}
                          onClick={() => choose(r.key, 'mine')}
                        >
                          {choices[r.key] === 'mine' && <Check size={13} aria-hidden="true" />}
                          <span>{r.mine || <em className="br-muted">empty</em>}</span>
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`br-compare-opt ${
                            choices[r.key] === 'theirs' ? 'br-compare-on' : ''}`}
                          onClick={() => choose(r.key, 'theirs')}
                        >
                          {choices[r.key] === 'theirs' && <Check size={13} aria-hidden="true" />}
                          <span>{r.theirs}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="br-compare-note">
                Both readings can be wrong: a letter may have been superseded, and the
                parser can misread a figure. Check the document itself before changing
                anything you entered deliberately.
              </p>
            </div>
          </>
        )}

        <div className="br-modal-foot">
          <button type="button" className="br-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="br-btn br-btn-primary" onClick={handleConfirm}>
            <Check size={15} aria-hidden="true" />
            {diffs.length === 0
              ? 'Attach letter'
              : adopting === 0
                ? 'Attach, keep my values'
                : `Attach and update ${adopting} field${adopting === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SanctionCompareModal;