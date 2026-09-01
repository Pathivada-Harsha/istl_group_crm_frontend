// src/components/borrowers/CompanyMatchModal.js
//
// Inserted between "letter parsed" and the sanction review form. Ranks
// candidate existing companies for the parsed identity (CIN > normalized name
// > alias > fuzzy — see BorrowerService.matchBorrower) and makes the lender
// confirm which company the letter belongs to, or create a new one with its
// place in the hierarchy, before anything is written. A weak fuzzy match is
// never auto-attached — it's shown exactly like "no match" except the
// candidate is there to pick if it really is the same company.
//
// The matching cascade only ever answers "which existing companies should
// we show as candidates" — never "this is definitely the same company".
// CIN/NAME/ALIAS candidates are trusted enough to call "found" outright;
// FUZZY candidates (text-similarity only, never a claim about legal
// identity) are always framed as "possible", with no similarity percentage
// in the decision UI, since a lender reading "82%" reads it as a
// probability the matcher was never built to provide. Either way, nothing
// is ever attached without the explicit "Confirm and continue" click below.

import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Building2, AlertTriangle } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import { BORROWER_IMPORT_KEYS } from './borrowerFields';
import HierarchyPicker, { EMPTY_HIERARCHY, resolveHierarchyGroupId } from './HierarchyPicker';
import '../../pages-css/BorrowerRegistry.css';

const HIGH_CONFIDENCE = new Set(['CIN', 'NAME', 'ALIAS']);

// One overall status for the whole candidate list, not a per-candidate
// label — CIN/NAME/ALIAS candidates are grouped as EXACT (the letter's own
// stated identity matched something on file), a candidate list that's
// FUZZY-only is POSSIBLE (similar text, not a claimed identity match), and
// an empty list is NONE. A mixed list can't happen in practice —
// BorrowerService.matchBorrower stops at the first tier that finds
// anything — but the check is written to hold regardless.
const matchStatus = (candidates) => (
  candidates.length === 0 ? 'NONE'
    : candidates.some((c) => HIGH_CONFIDENCE.has(c.confidence)) ? 'EXACT'
      : 'POSSIBLE'
);

const STATUS_COPY = {
  EXACT: {
    title: 'Company already exists in CRM',
    body: 'The company details from this sanction letter match an existing company in your CRM.',
  },
  POSSIBLE: {
    title: 'Possible existing companies found',
    body: 'We found companies with similar details. Please confirm whether this sanction belongs to one of them.',
  },
  NONE: {
    title: 'No existing company found',
    body: 'We could not find an existing company in the CRM matching this sanction letter.',
  },
};

const sanctionsLabel = (n) => (n === 1 ? '1 existing sanction' : `${n ?? 0} existing sanctions`);

const hierarchyLine = (m) => {
  if (m.subGroupName) return `${m.parentGroupName} > ${m.subGroupName}`;
  if (m.parentGroupName) return m.parentGroupName;
  return 'Standalone';
};

const CompanyMatchModal = ({ parsed, onClose, onResolved }) => {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // matched borrowerId, or 'NEW'
  const [name, setName] = useState(parsed?.borrowerName || '');
  const [hierarchy, setHierarchy] = useState({ ...EMPTY_HIERARCHY });
  const [dupes, setDupes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const identity = useMemo(() => {
    const id = { borrowerName: parsed?.borrowerName || '' };
    BORROWER_IMPORT_KEYS.forEach((k) => {
      const v = parsed?.[k];
      if (v != null && String(v).trim()) id[k] = String(v);
    });
    return id;
  }, [parsed]);

  const status = useMemo(() => matchStatus(candidates), [candidates]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    borrowerApi.matchBorrower(identity)
      .then((list) => {
        if (cancelled) return;
        setCandidates(list);
        // A high-confidence single match pre-selects itself; anything softer
        // (fuzzy, several candidates, or none) leaves the choice to the user.
        if (list.length === 1 && HIGH_CONFIDENCE.has(list[0].confidence)) {
          setSelectedId(list[0].borrowerId);
        } else {
          setSelectedId(list.length ? null : 'NEW');
        }
      })
      .catch(() => setCandidates([]))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDuplicateCheck = async (borrowerId) => {
    if (!parsed?.lenderName || !parsed?.sanctionDate) return;
    try {
      const hits = await borrowerApi.checkDuplicateSanction(
        borrowerId, parsed.lenderName, parsed.sanctionDate,
      );
      setDupes(hits);
    } catch { /* advisory only — never blocks confirm */ }
  };

  const handleConfirm = async () => {
    setError('');
    setSaving(true);
    try {
      let borrowerId;
      if (selectedId && selectedId !== 'NEW') {
        const match = candidates.find((c) => c.borrowerId === selectedId);
        // Resolve by the matched company's own name so the lookup hits an
        // exact match even when the letter spelled it differently (fuzzy) —
        // resolve() only fills blanks, it never overwrites the saved name.
        const resolved = await borrowerApi.resolve({ ...identity, borrowerName: match.borrowerName });
        borrowerId = resolved.id;
      } else {
        if (!name.trim()) { setError('Company name is required'); setSaving(false); return; }
        const groupId = await resolveHierarchyGroupId(hierarchy);
        const resolved = await borrowerApi.resolve({ ...identity, borrowerName: name.trim() });
        borrowerId = resolved.id;
        if (groupId || hierarchy.isSubsidiary || hierarchy.isSpv) {
          await borrowerApi.updateHierarchy(borrowerId, {
            groupId, isSubsidiary: hierarchy.isSubsidiary, isSpv: hierarchy.isSpv,
          });
        }
      }
      await runDuplicateCheck(borrowerId);
      onResolved(borrowerId);
    } catch (e) {
      setError(e.message || 'Could not resolve the company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="br-modal-backdrop" onMouseDown={onClose}>
      <div className="br-modal" onMouseDown={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Confirm company">
        <div className="br-modal-head">
          <div className="br-viewer-title">
            <Building2 size={18} aria-hidden="true" />
            <div className="br-viewer-title-text">
              <h3 className="br-modal-title">
                {loading ? 'Which company is this letter for?' : STATUS_COPY[status].title}
              </h3>
              <p className="br-modal-sub">
                {parsed?.borrowerName && <>The letter names <strong>{parsed.borrowerName}</strong>. </>}
                {!loading && STATUS_COPY[status].body}
              </p>
            </div>
          </div>
          <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="br-modal-body br-modal-body-single br-match-body">
          {loading && <p className="br-muted">Looking for a matching company…</p>}

          {!loading && candidates.length > 0 && (
            <div className="br-match-list">
              {candidates.map((c) => (
                <label
                  key={c.borrowerId}
                  className={`br-match-card ${selectedId === c.borrowerId ? 'br-match-card-selected' : ''}`}
                >
                  <div className="br-match-head">
                    <span className="br-match-name">
                      <input
                        type="radio"
                        name="match"
                        checked={selectedId === c.borrowerId}
                        onChange={() => setSelectedId(c.borrowerId)}
                        style={{ marginRight: 8 }}
                      />
                      {c.borrowerName}
                    </span>
                  </div>
                  <div className="br-match-sub">
                    {c.companyType && c.companyType !== 'Standalone' ? `${c.companyType} · ` : ''}
                    {hierarchyLine(c)}
                    {c.cin ? ` · CIN ${c.cin}` : ''}
                    {' · '}{sanctionsLabel(c.sanctionsCount)}
                  </div>
                </label>
              ))}
              <label className={`br-match-card ${selectedId === 'NEW' ? 'br-match-card-selected' : ''}`}>
                <span className="br-match-name">
                  <input
                    type="radio" name="match"
                    checked={selectedId === 'NEW'}
                    onChange={() => setSelectedId('NEW')}
                    style={{ marginRight: 8 }}
                  />
                  None of these — this is a new company
                </span>
              </label>
            </div>
          )}

          {!loading && selectedId === 'NEW' && (
            <fieldset className="br-fieldset">
              <legend className="br-fieldset-legend">New company</legend>
              <div className="br-form-grid">
                <label className="br-field">
                  <span className="br-field-label">Company name<span className="br-req"> *</span></span>
                  <input className="br-input" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              </div>
              <HierarchyPicker value={hierarchy} onChange={setHierarchy} />
            </fieldset>
          )}

          {dupes.length > 0 && (
            <div className="br-banner br-banner-warn">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                This company already has a sanction from the same lender dated the same day
                ({dupes.map((d) => d.refNo).join(', ')}). Continuing will save this as a separate letter —
                check it isn't the same one re-imported under a different reference number.
              </span>
            </div>
          )}
        </div>

        {error && <div className="br-banner br-banner-danger">{error}</div>}

        <div className="br-modal-foot">
          <button type="button" className="br-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button" className="br-btn br-btn-primary"
            onClick={handleConfirm}
            disabled={saving || loading || !selectedId}
          >
            <Check size={15} aria-hidden="true" />
            {saving ? 'Confirming…' : 'Confirm and continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyMatchModal;
