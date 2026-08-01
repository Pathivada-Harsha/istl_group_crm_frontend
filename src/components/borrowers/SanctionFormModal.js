// src/components/borrowers/SanctionFormModal.js
//
// One form, three ways in:
//   mode="import" — pre-filled from a parsed letter, low-confidence fields
//                   flagged, document preview beside it
//   mode="create" — opened blank for a borrower with no letter yet
//   mode="edit"   — opened on a saved sanction
//
// Keeping them in one component is deliberate: an imported record must stay as
// editable as a typed one, and two forms would drift apart the first time a
// field is added.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, AlertTriangle, FileText, Paperclip } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import { deriveSanction, parseDate } from './sanctionDerive';
import SanctionCompareModal from './SanctionCompareModal';
import { SANCTION_FIELDS as FIELDS, sanctionFieldGroups } from './sanctionFields';
import { BORROWER_IMPORT_KEYS } from './borrowerFields';
import '../../pages-css/BorrowerRegistry.css';

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});
const GROUPS = sanctionFieldGroups();
const FIELD_KIND = Object.fromEntries(FIELDS.map((f) => [f.key, f.kind]));

// A letter's date arrives as "14 Mar 2025" (or "14/03/2025", or already ISO);
// the picker below only understands ISO "yyyy-MM-dd". `parseDate` already
// reads all of those, so this just re-renders whichever one comes in as ISO.
// The reverse trip doesn't need a matching `fromIso` — the picker hands back
// ISO directly, and SanctionValueParser.parseDate on the backend accepts ISO
// as one of its recognised formats already.
const toIsoDate = (raw) => {
  const d = parseDate(raw);
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Calendar-only date picker — the same one already used on the Purchase
 * Order pages (there as `PODatePicker`), copied rather than imported since
 * every page that uses it keeps its own copy (see GeneratePoModal.js,
 * VendorPaymentsPage.js, etc.). value/onChange are ISO "yyyy-MM-dd" strings;
 * the trigger displays dd-mm-yyyy.
 */
const SanctionDatePicker = ({ value, onChange, placeholder = 'Select date', warn = false }) => {
  const [show, setShow] = useState(false);
  const [calMo, setCalMo] = useState(() => (value ? parseInt(value.slice(5, 7), 10) - 1 : new Date().getMonth()));
  const [calYr, setCalYr] = useState(() => (value ? parseInt(value.slice(0, 4), 10) : new Date().getFullYear()));
  const [showYrPicker, setShowYrPicker] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [show]);

  const open = () => {
    if (value) { setCalMo(parseInt(value.slice(5, 7), 10) - 1); setCalYr(parseInt(value.slice(0, 4), 10)); }
    setShowYrPicker(false);
    setShow(true);
  };

  const daysInMonth = new Date(calYr, calMo + 1, 0).getDate();
  const firstWeekday = new Date(calYr, calMo, 1).getDay();
  const displayFmt = (iso) => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        className={`po-dtp-trigger${show ? ' po-dtp--open' : ''}${value ? ' po-dtp--set' : ''}`}
        onClick={show ? () => setShow(false) : open}
        style={warn ? { borderColor: 'var(--c-f59e0b, #f59e0b)' } : undefined}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {value
          ? <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{displayFmt(value)}</span>
          : <span className="po-dtp-ph">{placeholder}</span>}
        {value ? (
          <span className="po-dtp-x" onClick={(e) => { e.stopPropagation(); onChange(''); }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        ) : (
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            style={{ marginLeft: 'auto', transform: show ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {show && (
        <div className="po-dtp-dropdown" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 280, zIndex: 1000 }}>
          <div className="po-dtp-cal-head">
            <button type="button" className="po-cal-nav"
              onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr((y) => y - 1); } else setCalMo((m) => m - 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button type="button" className="po-dtp-month" onClick={() => setShowYrPicker((p) => !p)}>
              {CAL_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="po-cal-nav"
              onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr((y) => y + 1); } else setCalMo((m) => m + 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {showYrPicker ? (
            <div className="po-yr-grid">
              {Array.from({ length: 16 }, (_, i) => {
                const yr = new Date().getFullYear() - 4 + i;
                return (
                  <div key={yr} className={`po-yr-cell${yr === calYr ? ' po-yr-sel' : ''}`}
                    onClick={() => { setCalYr(yr); setShowYrPicker(false); }}>
                    {yr}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="po-dtp-grid">
              {CAL_WEEKDAYS.map((d) => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const iso = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                return (
                  <div key={day} className={`po-cal-cell${value === iso ? ' po-dtp-sel' : ''}`}
                    onClick={() => { setShow(false); onChange(iso); }}>
                    {day}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Money fields get a fixed "Rs." shown beside the input rather than typed
// into it — a letter parsed as "Rs. 372.00 Crore" and a user typing "372.00"
// should look the same, not one with the unit baked in and one without.
//
// "Crore" also gets shortened to "Cr" here — once a sanction is saved, every
// page shows it that way regardless (the amount is stored as a plain number
// and always re-rendered via formatCrore/SanctionValueParser.formatCrore,
// which only ever prints "Cr"); a letter parsed as "...Crore" shouldn't look
// different from that on this screen, before it's even been saved once.
const RS_PREFIX = /^\s*(rs\.?|inr|₹)\s*/i;
const CRORE_WORD = /\bcrores?\b/i;
const stripRs = (v) => String(v ?? '').replace(RS_PREFIX, '').replace(CRORE_WORD, 'Cr');
const withRs = (v) => {
  const t = String(v ?? '').trim();
  return t ? `Rs. ${stripRs(t)}` : t;
};

const SanctionFormModal = ({
  mode = 'create',
  initial = null,        // parsed field map (import) or saved wrapper (edit)
  borrowerId = null,     // set when adding a sanction to a known borrower
  borrowerName = null,   // pre-fills the borrower field for a known borrower
  file = null,           // the uploaded File, for preview and post-save storage
  allowAttach = false,   // offer to attach a letter while entering by hand
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [attached, setAttached] = useState(null);   // File chosen in this form
  const [reading, setReading] = useState(false);
  const [compare, setCompare] = useState(null);     // { parsed, file }
  const attachRef = useRef(null);

  // The letter to store on save: the one passed in (import) or picked here.
  const documentFile = file || attached;

  const lowConfidence = useMemo(
    () => new Set(initial?._lowConfidenceFields || []),
    [initial],
  );
  const duplicateRef = Boolean(initial?._duplicateRefNo);
  const engine = initial?._extractionEngine;

  useEffect(() => {
    if (!initial) return;
    const next = { ...EMPTY };
    FIELDS.forEach(({ key, kind }) => {
      if (initial[key] !== undefined && initial[key] !== null) {
        const v = String(initial[key]);
        next[key] = kind === 'money' ? stripRs(v) : v;
      }
    });
    setForm(next);
  }, [initial]);

  // Adding a sanction to a borrower we already know — no reason to make the
  // user retype the company name.
  useEffect(() => {
    if (borrowerName) setForm((f) => (f.borrowerName ? f : { ...f, borrowerName }));
  }, [borrowerName]);

  /**
   * A letter attached while entering values by hand. Read it and, if anything
   * has already been typed, compare rather than overwrite — the typed value
   * may be the deliberate one. On an empty form there is nothing to disagree
   * with, so the parsed values simply fill it.
   */
  const handleAttach = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;

    setAttached(picked);
    setError('');
    setReading(true);
    try {
      const parsed = await borrowerApi.parseSanction(picked);
      const hasTypedValues = FIELDS.some(({ key }) => String(form[key] || '').trim());
      if (!hasTypedValues) {
        const next = { ...EMPTY };
        FIELDS.forEach(({ key, kind }) => {
          if (parsed[key] != null) {
            const v = String(parsed[key]);
            next[key] = kind === 'money' ? stripRs(v) : v;
          }
        });
        setForm(next);
      } else {
        setCompare({ parsed, file: picked });
      }
    } catch (err) {
      // Unreadable documents are still worth storing against the record.
      setError(`${err.message} The file will still be attached when you save.`);
    } finally {
      setReading(false);
    }
  };

  const applyCompare = (updates) => {
    const clean = {};
    Object.entries(updates).forEach(([key, v]) => {
      clean[key] = FIELD_KIND[key] === 'money' ? stripRs(v) : v;
    });
    setForm((f) => ({ ...f, ...clean }));
    setCompare(null);
  };

  // Preview only makes sense for PDFs — no browser renders .docx.
  useEffect(() => {
    if (!documentFile || !/pdf$/i.test(documentFile.name)) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(documentFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [documentFile]);

  const derived = useMemo(() => deriveSanction(form), [form]);

  // Project Cost = Debt (the sanctioned amount) + Equity, so any one of
  // Debt / Equity / Debt % / Equity % that the letter left blank follows
  // arithmetically from what it did print — deriveSanction already works
  // these out for the read-only preview panel; this writes the same numbers
  // into the actual fields so what gets saved isn't blank, matching the
  // backend's own SanctionDerivedCalculator.fillGaps (which would compute
  // and store the identical values on the next read regardless — this just
  // means the reviewer sees them here rather than after a round trip).
  // Printed still wins: a field the letter (or the reviewer) already gave a
  // value for is never touched.
  useEffect(() => {
    const updates = {};
    if (derived.computed.has('debtAmount') && !form.debtAmount) {
      updates.debtAmount = stripRs(derived.debtAmount);
    }
    if (derived.computed.has('equityAmount') && !form.equityAmount) {
      updates.equityAmount = stripRs(derived.equityAmount);
    }
    if (derived.computed.has('debtPct') && !form.debtPct) {
      updates.debtPct = derived.debtPct;
    }
    if (derived.computed.has('equityPct') && !form.equityPct) {
      updates.equityPct = derived.equityPct;
    }
    if (Object.keys(updates).length) setForm((f) => ({ ...f, ...updates }));
  }, [derived, form.debtAmount, form.equityAmount, form.debtPct, form.equityPct]);

  const set = (key) => (e) => {
    const raw = e.target.value;
    const value = FIELD_KIND[key] === 'money' ? stripRs(raw) : raw;
    setForm((f) => ({ ...f, [key]: value }));
  };

  // The picker hands back an ISO string (or '' when cleared) directly, not an
  // input change event — stored as-is, since the backend's date parser reads
  // ISO natively.
  const setDate = (key) => (iso) => setForm((f) => ({ ...f, [key]: iso }));

  const missingRequired = FIELDS
    .filter((f) => f.required && !String(form[f.key] || '').trim())
    .map((f) => f.label);

  const handleSave = async () => {
    setError('');
    if (missingRequired.length) {
      setError(`Still needed: ${missingRequired.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      // Resolve the borrower first — find by name or create — so the sanction
      // always has a parent, whether or not the company was already on file.
      // The borrower-level values the letter carried (promoter, guarantor,
      // group, Cat / Sub Cat, SL ref.) ride along; the server fills only blank
      // fields with them, so an import never overwrites something typed.
      let bId = borrowerId;
      if (!bId) {
        const identity = { borrowerName: form.borrowerName.trim() };
        BORROWER_IMPORT_KEYS.forEach((k) => {
          const v = initial?.[k];
          if (v != null && String(v).trim()) identity[k] = String(v);
        });
        const b = await borrowerApi.resolve(identity);
        bId = b.id;
      }

      // Built from FIELDS rather than a hand-written literal, so a field added
      // to the array is posted without a second edit here. Money fields are
      // typed without "Rs." (it's shown as a fixed prefix beside the input),
      // so it's put back on here — the stored value stays the same shape it
      // always was, whether typed by hand or read off a letter.
      const payload = {
        id: initial?.id || null,
        borrowerId: bId,
        ...FIELDS.reduce((p, f) => ({
          ...p,
          [f.key]: f.kind === 'money' ? withRs(form[f.key]) : form[f.key],
        }), {}),
        status: mode === 'import' ? 'IMPORTED' : (initial?.status || 'DRAFT'),
        source: mode === 'import' ? 'IMPORTED' : (initial?.source || 'MANUAL'),
        extractionEngine: engine || initial?.extractionEngine || null,
      };

      const saved = await borrowerApi.saveSanction(
        payload,
        mode === 'import' ? initial : null,
      );

      // Store the letter against the row we just created.
      if (documentFile && saved?.sanctions?.length) {
        const target = saved.sanctions.find((s) => s.refNo === form.refNo.trim())
          || saved.sanctions[0];
        if (target?.id) {
          try {
            await borrowerApi.uploadDoc(target.id, documentFile);
          } catch (e) {
            // The record is saved; a failed attachment shouldn't lose it.
            console.warn('Sanction saved but the document could not be stored:', e);
          }
        }
      }

      onSaved?.(saved);
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'import'
    ? 'Review what was read'
    : mode === 'edit' ? 'Edit sanction' : 'Add sanction';

  return (
    <div className="br-modal-backdrop" onMouseDown={onClose}>
      {/* Wide in every mode now: thirty-odd fields in a single narrow column
          is unusable, whether they arrived from a letter or by hand. */}
      <div
        className="br-modal br-modal-wide"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="br-modal-head">
          <div className="br-viewer-title">
            {documentFile && <FileText size={18} className="br-viewer-icon" aria-hidden="true" />}
            <div className="br-viewer-title-text">
              <h3 className="br-modal-title">{title}</h3>
              {/* The file being reviewed, named at the top — the reviewer needs
                  to know which letter these values came from before trusting
                  them, especially when importing several in a row. */}
              {documentFile ? (
                <p className="br-modal-sub br-modal-file">
                  <span className="br-modal-filename">{documentFile.name}</span>
                  <span className="br-modal-filesize">
                    {Math.round(documentFile.size / 1024)} KB
                  </span>
                </p>
              ) : mode === 'import' ? (
                <p className="br-modal-sub">
                  Check every value against the letter before saving. Nothing is stored yet.
                </p>
              ) : null}
            </div>
          </div>
          <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {mode === 'import' && documentFile && (
          <p className="br-modal-hint">
            Check every value against the letter before saving. Nothing is stored yet.
          </p>
        )}

        {mode === 'import' && duplicateRef && (
          <div className="br-banner br-banner-danger">
            A sanction with this reference number has already been imported. Saving will
            be blocked until the reference is corrected.
          </div>
        )}

        {mode === 'import' && lowConfidence.size > 0 && (
          <div className="br-banner br-banner-warn">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              {lowConfidence.size} field{lowConfidence.size === 1 ? ' was' : 's were'} read by
              the AI rather than matched from the document's tables. Those are marked below —
              check them first.
            </span>
          </div>
        )}

        <div className="br-modal-body">
          <div className="br-form-col">
            {GROUPS.map(({ group, fields }) => (
              <fieldset key={group} className="br-fieldset">
                <legend className="br-fieldset-legend">{group}</legend>
                <div className="br-form-grid">
                  {fields.filter((f) => !f.formHidden).map((f) => (
                    <label key={f.key} className="br-field">
                      <span className="br-field-label">
                        {f.label}
                        {f.required && <span className="br-req" aria-hidden="true"> *</span>}
                        {/* The unit the column is quoted in. Without it a user
                            typing 205 into "Project Cost" has no way to know
                            whether that means rupees or crore. */}
                        {f.suffix && <span className="br-field-suffix">{f.suffix}</span>}
                        {lowConfidence.has(f.key) && (
                          <span className="br-chip br-chip-warn">check</span>
                        )}
                      </span>
                      {f.kind === 'money' ? (
                        <div className="br-input-group">
                          <span className="br-input-prefix" aria-hidden="true">Rs.</span>
                          <input
                            type="text"
                            value={form[f.key]}
                            onChange={set(f.key)}
                            placeholder={f.placeholder}
                            className={[
                              'br-input',
                              lowConfidence.has(f.key) ? 'br-input-warn' : '',
                            ].filter(Boolean).join(' ')}
                          />
                        </div>
                      ) : f.kind === 'date' ? (
                        <SanctionDatePicker
                          value={toIsoDate(form[f.key])}
                          onChange={setDate(f.key)}
                          placeholder={f.placeholder}
                          warn={lowConfidence.has(f.key)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={form[f.key]}
                          onChange={set(f.key)}
                          placeholder={f.placeholder}
                          className={[
                            'br-input',
                            lowConfidence.has(f.key) ? 'br-input-warn' : '',
                            f.mono ? 'br-input-mono' : '',
                          ].filter(Boolean).join(' ')}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="br-side-col">
            <div className="br-derived-card">
              <p className="br-derived-title">Updates as you type</p>
              <Row label="Equity contribution" value={derived.equityContribution} />
              <Row
                label="Ratio check"
                value={derived.ratioCheck}
                tone={derived.ratioOk === false ? 'warn' : derived.ratioOk ? 'ok' : ''}
              />
              {/* Debt / Equity / Debt % / Equity % aren't shown here — they're
                  written straight into their own fields on the left the
                  moment they're worked out (see the effect above), so a
                  second, delayed copy of the same number in this panel would
                  just be a place for the two to fall out of sync. */}
              <Row label="ROI (base + spread)" value={derived.roi} />
              <Row
                label="ROI check"
                value={derived.roiCheck}
                tone={derived.roiOk === false ? 'warn' : derived.roiOk ? 'ok' : ''}
              />
              <Row label="Moratorium ends" value={derived.moratoriumEnd} />
              <Row label="Repayment starts" value={derived.repaymentStart} />
              <Row label="Repayment ends" value={derived.repaymentEnd} />
              <Row label="Total tenor" value={derived.totalTenorMonths} />
              <Row label="First-year interest" value={derived.firstYearInterest} />
              <Row label="Sanction valid till" value={derived.sanctionValidTill} />
              <Row
                label="COD status"
                value={derived.codStatus}
                tone={derived.codOverdue ? 'warn' : ''}
              />
            </div>

            {previewUrl ? (
              <iframe className="br-preview" src={previewUrl} title="Sanction letter" />
            ) : documentFile ? (
              <div className="br-preview-note">
                <FileText size={18} aria-hidden="true" />
                <div>
                  <strong>{documentFile.name}</strong>
                  <span>
                    Word files can't be previewed before saving. Once saved, the letter
                    opens in the page from the borrower record.
                  </span>
                </div>
              </div>
            ) : null}

            {allowAttach && (
              <div className="br-attach-box">
                <p className="br-attach-title">Sanction letter</p>
                <p className="br-attach-help">
                  {documentFile
                    ? 'Attached. It will be stored when you save.'
                    : 'Optional. If you attach one, its values are checked against '
                      + 'what you have entered and any differences are shown.'}
                </p>
                <button
                  type="button"
                  className="br-btn br-btn-sm"
                  onClick={() => attachRef.current?.click()}
                  disabled={reading}
                >
                  <Paperclip size={14} aria-hidden="true" />
                  {reading ? 'Reading…' : documentFile ? 'Choose a different file' : 'Attach letter'}
                </button>
                <input
                  ref={attachRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleAttach}
                  hidden
                />
              </div>
            )}
          </div>
        </div>

        {compare && (
          <SanctionCompareModal
            current={form}
            parsed={compare.parsed}
            fileName={compare.file?.name}
            onCancel={() => setCompare(null)}
            onConfirm={applyCompare}
          />
        )}

        {error && <div className="br-banner br-banner-danger">{error}</div>}

        <div className="br-modal-foot">
          <button type="button" className="br-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="br-btn br-btn-primary"
            onClick={handleSave}
            disabled={saving || duplicateRef}
          >
            <Check size={15} aria-hidden="true" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, tone = '' }) => (
  <div className="br-derived-row">
    <span className="br-derived-label">{label}</span>
    <span className={`br-derived-value ${tone ? `br-tone-${tone}` : ''}`}>
      {value || '—'}
    </span>
  </div>
);

export default SanctionFormModal;