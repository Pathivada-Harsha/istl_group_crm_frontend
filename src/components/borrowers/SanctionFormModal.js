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
import { X, Check, AlertTriangle, FileText, Paperclip, Calendar } from 'lucide-react';
import { BsInfoCircle } from 'react-icons/bs';
import borrowerApi from '../../services/borrowerApi';
import { useAuth } from '../../hooks/useAuth';
import CrmPreloader from '../preLoader';
import {
  deriveSanction, deriveRepaymentSchedule, parseDate, parsePct, parseMoneyCrore, formatCrore,
  parseMoratoriumMonths,
} from './sanctionDerive';
import SanctionCompareModal from './SanctionCompareModal';
import RepaymentScheduleTab from './RepaymentScheduleTab';
import { SANCTION_FIELDS as FIELDS, sanctionFieldGroups } from './sanctionFields';
import { BORROWER_IMPORT_KEYS } from './borrowerFields';
import '../../pages-css/BorrowerRegistry.css';

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: f.defaultValue ?? '' }), {});
const GROUPS = sanctionFieldGroups();
const FIELD_KIND = Object.fromEntries(FIELDS.map((f) => [f.key, f.kind]));

// A letter often states the moratorium only inline in the Tenor sentence
// ("18 years including moratorium of 9 months") rather than as its own row —
// the repayment schedule already reads that count via parseMoratoriumMonths
// (see resolveRepaymentWindow in sanctionDerive.js), but leaving the
// Moratorium (Months) field blank hid the number the schedule was actually
// using. Surface it into the field itself once, still fully editable —
// this doesn't change what gets calculated, since the derivation already
// fell back to the same parse when the field was empty.
const withDerivedMoratorium = (next) => {
  if (String(next.moratoriumMonths || '').trim()) return next;
  const derived = parseMoratoriumMonths(next.tenorText);
  return derived != null ? { ...next, moratoriumMonths: String(derived) } : next;
};

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
const SanctionDatePicker = ({ value, onChange, placeholder = 'Select date', warn = false, minDate = '', maxDate = '' }) => {
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
    // This whole widget sits inside a bare `<label>` (no htmlFor) in the form
    // grid. With no explicit target, a browser forwards any click inside the
    // label to the first focusable control it contains — the trigger button
    // below — as a second, synthetic click right after the real one. Picking
    // a day already closes the calendar via its own onClick, but that forwarded
    // click lands on the trigger a moment later and, since `show` just flipped
    // to false, reopens it. preventDefault() on the real click is what the
    // label checks before forwarding, so stopping it here (once, for every
    // click this widget receives) is enough — no need to repeat it on each
    // button/cell inside.
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }} onClick={(e) => e.preventDefault()}>
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
                const disabled = (minDate && iso < minDate) || (maxDate && iso > maxDate);
                return (
                  <div key={day}
                    className={`po-cal-cell${value === iso ? ' po-dtp-sel' : ''}${disabled ? ' po-cal-cell-disabled' : ''}`}
                    onClick={disabled ? undefined : () => { setShow(false); onChange(iso); }}>
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

// Project Cost & Means of Finance: a letter states these in crore or in
// rupees depending on the document, sometimes inconsistently between rows of
// the same table. Whichever way it came in, show it the same way the saved
// record eventually will — a single "X.XX Cr" figure — rather than leaving a
// full rupee count sitting next to a properly-scaled crore figure in the
// same review screen.
const MEANS_OF_FINANCE_KEYS = new Set(['projectCost', 'debtAmount', 'equityAmount', 'sanctionedAmount']);
// Only a bare figure (with an optional unit/₹-sign/trailing "/-") is safe to
// rescale — a cell that also carries free text ("(approx. Rs. 5.09 Crore/MW)")
// is left exactly as extracted, so that context isn't silently dropped from
// the review screen.
const CLEAN_AMOUNT_RE = /^-?[\d,]+(?:\.\d+)?\s*(?:crs?\.?|crores?|lakhs?|lacs?|l|lk)?\s*\/?-?$/i;
// A trailing "(Rupees ... only)" is just the same figure spelled out in
// words — a standard Indian banking convention, not new information — so
// it's safe to drop once the leading figure itself parses cleanly. A
// genuinely informative note like Project Cost's "(approx. Rs. 5.09
// Crore/MW)" doesn't start with "Rupees" and so is left alone, same as ever.
const TRAILING_SPELLED_OUT_RE = /^(.*?)\s*\(\s*rupees\b[^)]*\)\s*$/i;
const normalizeMoneyValue = (key, v) => {
  const stripped = stripRs(v);
  if (!MEANS_OF_FINANCE_KEYS.has(key)) return stripped;
  let trimmed = stripped.trim();
  if (!trimmed) return stripped;
  const spelledOut = trimmed.match(TRAILING_SPELLED_OUT_RE);
  if (spelledOut) trimmed = spelledOut[1].trim();
  if (!trimmed || !CLEAN_AMOUNT_RE.test(trimmed)) return stripped;
  const rupees = parseMoneyCrore(trimmed);
  if (rupees === null) return stripped;
  return stripRs(formatCrore(rupees));
};

// "Interest Terms" is the descriptive text sitting next to the (now
// separate, computed) Rate of Interest field — the percentage no longer
// needs to also live in this sentence, so the first one found is dropped,
// wherever in the sentence it falls. Only the first: a letter occasionally
// mentions a rate more than once ("not exceeding 12.00% p.a., presently
// 10.75%") and only the leading figure is the one Rate of Interest already
// shows.
const RATE_IN_TEXT = /\s*\(?-?\d+(?:\.\d+)?\s*%\)?\s*/;
const stripRoiFromText = (v) => String(v ?? '').replace(RATE_IN_TEXT, ' ').replace(/\s+/g, ' ').trim();

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
  const { pagePermissions } = useAuth();
  const showDsra = !!pagePermissions?.BARROWER?.includes('VIEW_DSRA_DETAILS');
  const showIsra = !!pagePermissions?.BARROWER?.includes('VIEW_ISRA_DETAILS');
  const [form, setForm] = useState({ ...EMPTY });
  // The letter's own stated ROI (if any), captured once when the form is
  // (re)populated from an outside source — never the live form.roiPct, which
  // the sync effect below keeps overwriting with the resolved figure. Reading
  // the live value back into deriveSanction would create a loop where a real
  // letter-vs-buildup mismatch gets silently erased the render after it's
  // first detected, because by then form.roiPct already agrees with itself.
  const [statedRoiPct, setStatedRoiPct] = useState('');
  // The last value the sync effect below itself wrote into dsraAmount/
  // israAmount/actualCod — not what the reviewer typed. Distinguishes "still
  // showing what we auto-filled, safe to refresh as ROI/other inputs
  // change" from "the reviewer typed/picked their own value over it, leave
  // it alone" — the same distinction a plain "only fill while empty" check
  // can't make once the box already has *something* in it, auto-filled or
  // not.
  const autoDsraRef = useRef(null);
  const autoIsraRef = useRef(null);
  const autoActualCodRef = useRef(null);
  const [saving, setSaving] = useState(false);
  // A validation error (e.g. "Still needed: Disb. Date") stays visible until
  // the reviewer fixes it and saves again — handleSave clears it at the top
  // of every attempt. It used to auto-dismiss after 3 seconds, which on a
  // field a letter simply doesn't state (Disbursement Date is the common
  // case) made Save look like it silently did nothing: the banner had
  // already vanished by the time anyone read it, leaving the same blank
  // form with no visible reason Save wasn't going through.
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [attached, setAttached] = useState(null);   // File chosen in this form
  const [reading, setReading] = useState(false);
  const [compare, setCompare] = useState(null);     // { parsed, file }
  const attachRef = useRef(null);
  // The import-mode reminder ("Check every value...") used to sit as a
  // permanent line under the header; it's now click-to-reveal off the info
  // icon next to the title instead, so it stops competing with the title
  // for attention on every review.
  const [showReviewHint, setShowReviewHint] = useState(false);
  const reviewHintRef = useRef(null);
  // Which tab the modal shows, and the id of the sanction this session has
  // actually saved (if any) — a saved sanction (edit mode, or the first Save
  // in create/import mode) gets the tab strip; before that there's nothing
  // to show a Repayment Schedule for yet.
  const [activeTab, setActiveTab] = useState('details');
  const [savedSanctionId, setSavedSanctionId] = useState(initial?.id || null);

  useEffect(() => {
    const onOutside = (e) => {
      if (reviewHintRef.current && !reviewHintRef.current.contains(e.target)) setShowReviewHint(false);
    };
    if (showReviewHint) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showReviewHint]);

  // The letter to store on save: the one passed in (import) or picked here.
  const documentFile = file || attached;

  const lowConfidence = useMemo(
    () => new Set(initial?._lowConfidenceFields || []),
    [initial],
  );
  const duplicateRef = Boolean(initial?._duplicateRefNo);
  const engine = initial?._extractionEngine;
  const interestMoratoriumDefaulted = Boolean(initial?._interestMoratoriumDefaulted);

  useEffect(() => {
    if (!initial) return;
    const next = { ...EMPTY };
    FIELDS.forEach(({ key, kind }) => {
      if (initial[key] !== undefined && initial[key] !== null) {
        const v = String(initial[key]);
        next[key] = kind === 'money' ? normalizeMoneyValue(key, v)
          : key === 'interestRateText' ? stripRoiFromText(v) : v;
      }
    });
    setStatedRoiPct(initial.roiPct != null ? String(initial.roiPct) : '');
    // A freshly (re)loaded record's dsraAmount/israAmount/actualCod are the
    // letter's own printed figures (or a previous session's override) — not
    // something this effect just wrote — so the resync above must treat
    // them as a reviewer-owned value until it writes one itself again.
    autoDsraRef.current = null;
    autoIsraRef.current = null;
    autoActualCodRef.current = null;
    setForm(withDerivedMoratorium(next));
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
            next[key] = kind === 'money' ? normalizeMoneyValue(key, v)
              : key === 'interestRateText' ? stripRoiFromText(v) : v;
          }
        });
        setStatedRoiPct(parsed.roiPct != null ? String(parsed.roiPct) : '');
        setForm(withDerivedMoratorium(next));
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
      clean[key] = FIELD_KIND[key] === 'money' ? normalizeMoneyValue(key, v)
        : key === 'interestRateText' ? stripRoiFromText(v) : v;
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

  const derived = useMemo(
    () => deriveSanction({ ...form, roiPct: statedRoiPct }),
    [form, statedRoiPct],
  );

  // Same live-recalculation contract as `derived` above — the Repayment
  // Schedule tab reflects every edit immediately, whether or not it's the
  // tab currently showing, via this same useMemo dependency array.
  const scheduleView = useMemo(
    () => deriveRepaymentSchedule({ ...form, roiPct: statedRoiPct }),
    [form, statedRoiPct],
  );

  // Two distinct ways the schedule's percentages can be wrong — checked
  // live off the same scheduleView the tab renders (not only at Save), for
  // both new (create/import) and existing (edit) sanctions, so either is
  // visible and Save is blocked the moment it's true rather than only
  // after a failed Save click:
  //
  // 1. The final amortizing term (RepaymentScheduleTab computes it as
  //    100 - sum of every other term) has gone negative — the terms
  //    before it were over-allocated past 100%. This is what an edit
  //    produces the instant it becomes invalid.
  // 2. The whole schedule simply doesn't sum to exactly 100%, with the
  //    final term still positive — this can't happen from an edit made
  //    this session (the residual math guarantees exactly 100 whenever
  //    it runs), but a sanction can carry a *stored* percentage profile
  //    from an earlier save whose length still matches the current
  //    schedule yet whose values were never actually valid.
  //
  // Neither ever changes how many terms exist — buildQuarterEndSchedule
  // sizes the schedule purely from the repayment dates/frequency, never
  // from the percentage profile — this only ever flags an invalid split
  // among the terms that already exist.
  const amortSchedule = scheduleView.schedule.filter((p) => p.repaymentPct !== undefined);
  const finalAmortPeriod = amortSchedule.length ? amortSchedule[amortSchedule.length - 1] : null;
  const totalAmortPct = amortSchedule.reduce((t, p) => t + (p.repaymentPct || 0), 0);
  const repaymentPctError = finalAmortPeriod && finalAmortPeriod.repaymentPct < 0
    ? 'Total repayment percentage cannot exceed 100%. Please adjust the repayment percentage in one or more existing terms so that the total is exactly 100%.'
    : amortSchedule.length && Math.abs(100 - totalAmortPct) >= 0.01
      ? `Total repayment percentage must equal exactly 100%. Current total: ${Math.round(totalAmortPct * 100) / 100}%. Please adjust the repayment percentage in one or more existing terms so that the total is exactly 100%.`
      : '';

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
    // Repayment Start/End Date and Planned COD Date: same one-time gap-fill
    // as Debt/Equity above, not the "keep syncing" treatment ROI/DSRA/ISRA
    // get below — resolveRepaymentWindow (sanctionDerive.js) treats a
    // non-blank repaymentStartDate/repaymentEndDate as the contractual date
    // itself and never recomputes past it, so writing into the field here
    // would otherwise permanently pin derived.repaymentStart/repaymentEnd to
    // this one snapshot even if Disb. Date changes again later. Filling only
    // while blank keeps that "printed/typed always wins" contract intact:
    // a reviewer who wants it recalculated just clears the field, same as
    // clearing Debt/Equity Amount today.
    if (derived.repaymentStart && !form.repaymentStartDate) {
      updates.repaymentStartDate = derived.repaymentStart;
    }
    if (derived.repaymentEnd && !form.repaymentEndDate) {
      updates.repaymentEndDate = derived.repaymentEnd;
    }
    // Planned COD Date has no calculation of its own — defaulted to
    // Moratorium End (construction/ramp-up ends, repayment capacity
    // begins) only when the letter didn't state one.
    if (derived.moratoriumEnd && !form.scheduledCod) {
      updates.scheduledCod = derived.moratoriumEnd;
    }
    // Actual COD Date defaults to Planned COD Date until the reviewer picks
    // a real one — same "sync outright, but only while it still holds
    // exactly what this effect itself last wrote" contract as DSRA/ISRA
    // below (autoActualCodRef), so a Planned COD Date edit keeps updating it
    // right up until the reviewer picks their own Actual COD Date, at which
    // point that pick is never overwritten again.
    if (form.scheduledCod) {
      const target = form.scheduledCod;
      if (!form.actualCod || form.actualCod === autoActualCodRef.current) {
        if (form.actualCod !== target) updates.actualCod = target;
      }
      autoActualCodRef.current = target;
    }
    // Rate of Interest is never typed (see sanctionFields.js `readOnly`), so
    // unlike the gap-fills above this keeps the field in sync outright
    // rather than only filling it once — Base Rate + Spread is meant to win
    // over whatever roiPct already holds (a figure the letter stated
    // separately) once both are known, not just top up a blank box.
    if (derived.roi) {
      const current = parsePct(form.roiPct);
      const target = parsePct(derived.roi);
      if (current === null || Math.abs(current - target) > 0.001) {
        updates.roiPct = derived.roi;
      }
    }
    // DSRA/ISRA Amount are editable, not purely derived (see sanctionFields.js)
    // — but still start from the calculated figure and keep tracking it as
    // ROI/other inputs change, same "sync outright" contract as roiPct
    // above. Unlike roiPct, this box can genuinely hold a reviewer's own
    // typed override though, so it only refreshes while it still holds
    // exactly what this effect last wrote itself (autoDsraRef/autoIsraRef)
    // — otherwise a Base Rate/Spread edit after import would leave DSRA/ISRA
    // (and whatever gets saved) silently pinned to the letter's original ROI.
    if (derived.dsraAmount) {
      const computed = stripRs(derived.dsraAmount);
      if (!form.dsraAmount || form.dsraAmount === autoDsraRef.current) {
        if (form.dsraAmount !== computed) updates.dsraAmount = computed;
      }
      autoDsraRef.current = computed;
    }
    if (derived.israAmount) {
      const computed = stripRs(derived.israAmount);
      if (!form.israAmount || form.israAmount === autoIsraRef.current) {
        if (form.israAmount !== computed) updates.israAmount = computed;
      }
      autoIsraRef.current = computed;
    }
    if (Object.keys(updates).length) setForm((f) => ({ ...f, ...updates }));
  }, [derived, form.debtAmount, form.equityAmount, form.debtPct, form.equityPct, form.roiPct,
    form.dsraAmount, form.israAmount, form.repaymentStartDate, form.repaymentEndDate,
    form.scheduledCod, form.actualCod]);

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
    // "Other" with nothing entered has no interval to schedule against —
    // reject it explicitly here rather than letting it silently fall back
    // to some other frequency.
    if (form.repaymentFrequency === 'OTHER'
      && !(parseInt(form.repaymentFrequencyOtherMonths, 10) > 0)) {
      setError('Enter a custom interval (in months) for the Other repayment frequency, or pick a listed one.');
      return;
    }
    // The per-period repayment percentages (Repayment Schedule tab) must
    // total exactly 100 — for a brand-new sanction and an existing one
    // being edited alike — a partially-edited profile is fine to look at
    // live, but never to save, since it would silently under- or
    // over-repay the loan. repaymentPctError (computed live off the same
    // scheduleView, see above — covers both a negative final term and a
    // stored profile that simply doesn't sum to 100) already has its own
    // persistent banner and disabled Save button, so this is purely a
    // defensive backstop, not the normal way a reviewer encounters it.
    if (repaymentPctError) return;
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
        // Prefer this session's own saved id over the prop it opened with —
        // a second Save after the first (create/import mode) must update
        // that same row, not post id: null again and create a duplicate.
        id: savedSanctionId || initial?.id || null,
        borrowerId: bId,
        ...FIELDS.filter((f) => f.persisted !== false).reduce((p, f) => ({
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

      // Store the letter against the row we just created. Matched by id, not
      // refNo — the backend cleans/normalizes refNo on the way in
      // (SanctionValueParser.clean, e.g. collapsing double spaces), so a
      // string comparison against what was typed here isn't guaranteed to
      // line up, and silently falling back to sanctions[0] on a mismatch
      // could pick the wrong row for a borrower with more than one sanction.
      // The id we already know (this session's own previous save, or an
      // edit's starting id) is unambiguous; only a session's first-ever save
      // of a brand-new sanction has no id yet, and that new row is
      // guaranteed to have the highest id among this borrower's sanctions.
      const knownId = savedSanctionId || initial?.id;
      let target = null;
      if (saved?.sanctions?.length) {
        target = knownId
          ? saved.sanctions.find((s) => String(s.id) === String(knownId))
          : saved.sanctions.reduce((max, s) => (Number(s.id) > Number(max.id) ? s : max));
      }
      if (documentFile && target?.id) {
        try {
          await borrowerApi.uploadDoc(target.id, documentFile);
        } catch (e) {
          // The record is saved; a failed attachment shouldn't lose it.
          console.warn('Sanction saved but the document could not be stored:', e);
        }
      }

      // Every successful save closes the modal, create/import included —
      // this used to stay open on the Repayment Schedule tab to show what
      // was just computed, but whenever that schedule wasn't actually
      // computable yet (most often a blank Disbursement Date), the modal
      // sat on the unchanged Sanction Details tab instead, which reads as
      // "the save didn't work, it's asking me again" even though it saved
      // fine. Closing unconditionally, the same way an edit already does,
      // removes that ambiguity entirely: the modal going away IS the
      // confirmation. The saved sanction (and its schedule, once it has
      // enough to compute one) is one click away on the Sanction Letters /
      // Repayment Schedule tabs of the page underneath — import mode's tab
      // strip is already available before Save too, for anyone who wants to
      // preview the schedule first.
      if (target?.id) setSavedSanctionId(target.id);
      onSaved?.(saved);
      onClose?.();
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
      {reading && <CrmPreloader text="Reading sanction letter…" />}
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
              <span className="br-modal-title-row">
                <h3 className="br-modal-title">{title}</h3>
                {mode === 'import' && (
                  <span className="br-info-wrap" ref={reviewHintRef}>
                    <button
                      type="button"
                      className="br-info-btn"
                      onClick={() => setShowReviewHint((v) => !v)}
                      aria-label="Why review this"
                      aria-expanded={showReviewHint}
                    >
                      <BsInfoCircle size={14} aria-hidden="true" />
                    </button>
                    {showReviewHint && (
                      <div className="br-info-popover" role="tooltip">
                        Check every value against the letter before saving. Nothing is stored yet.
                      </div>
                    )}
                  </span>
                )}
              </span>
              {/* The file being reviewed, named at the top — the reviewer needs
                  to know which letter these values came from before trusting
                  them, especially when importing several in a row. */}
              {documentFile && (
                <p className="br-modal-sub br-modal-file">
                  <span className="br-modal-filename">{documentFile.name}</span>
                  <span className="br-modal-filesize">
                    {Math.round(documentFile.size / 1024)} KB
                  </span>
                </p>
              )}
            </div>
          </div>
          <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

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

        {/* scheduleView is computed live off the form (see the useMemo above),
            not off a saved record, so import mode has a real schedule to show
            the moment a letter's been read — same as edit mode, which starts
            with one already. create mode starts from a blank form, though,
            so it still waits for a first save before there's anything worth
            a second tab for. Reuses .br-tabstrip/.br-tab/.br-tab-on, already
            defined in BorrowerRegistry.css but unused until now. */}
        {(mode !== 'create' || savedSanctionId) && (
          <div className="br-tabstrip">
            <button
              type="button"
              className={`br-tab ${activeTab === 'details' ? 'br-tab-on' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              <FileText size={15} aria-hidden="true" />
              Sanction Details
            </button>
            <button
              type="button"
              className={`br-tab ${activeTab === 'schedule' ? 'br-tab-on' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <Calendar size={15} aria-hidden="true" />
              Repayment Schedule
            </button>
          </div>
        )}

        {activeTab === 'schedule' && (mode !== 'create' || savedSanctionId) ? (
          <RepaymentScheduleTab
            view={scheduleView}
            form={form}
            onProfileChange={(json) => setForm((f) => ({ ...f, repaymentProfileJson: json }))}
            tableHeading={null}
          />
        ) : (
        <div className="br-modal-body">
          <div className="br-form-col">
            {GROUPS.map(({ group, fields }) => (
              <fieldset key={group} className="br-fieldset">
                <legend className="br-fieldset-legend">{group}</legend>
                <div className="br-form-grid">
                  {fields
                    .filter((f) => !f.formHidden)
                    // Only meaningful once Repayment Frequency is actually
                    // Other — showing it unconditionally would invite a
                    // custom interval nobody asked for.
                    .filter((f) => f.key !== 'repaymentFrequencyOtherMonths' || form.repaymentFrequency === 'OTHER')
                    .map((f) => (
                    <label
                      key={f.key}
                      className={`br-field ${f.wide ? 'br-field-wide' : ''}`}
                    >
                      <span className="br-field-label">
                        {f.formLabel || f.label}
                        {f.required && <span className="br-req" aria-hidden="true"> *</span>}
                        {/* The unit the column is quoted in. Without it a user
                            typing 205 into "Project Cost" has no way to know
                            whether that means rupees or crore. */}
                        {f.suffix && <span className="br-field-suffix">{f.suffix}</span>}
                        {lowConfidence.has(f.key) && (
                          <span className="br-chip br-chip-warn">check</span>
                        )}
                      </span>
                      {f.readOnly ? (
                        <>
                          <input
                            type="text"
                            value={derived[f.derivedKey] || ''}
                            readOnly
                            placeholder="—"
                            className={[
                              'br-input',
                              'br-input-readonly',
                              derived[f.derivedKey] === 'Not Calculated' ? 'br-input-warn' : '',
                            ].filter(Boolean).join(' ')}
                          />
                          <span className="br-field-hint">{f.hint}</span>
                        </>
                      ) : f.kind === 'select' ? (
                        <select value={form[f.key] || f.options[0].value} onChange={set(f.key)} className="br-input">
                          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : f.kind === 'money' ? (
                        <div className="br-input-group">
                          <span className="br-input-prefix" aria-hidden="true">Rs.</span>
                          <input
                            type="text"
                            value={form[f.key]}
                            onChange={set(f.key)}
                            placeholder={f.placeholder}
                            className={[
                              'br-input',
                              (lowConfidence.has(f.key) || form[f.key] === 'Not Calculated') ? 'br-input-warn' : '',
                            ].filter(Boolean).join(' ')}
                          />
                        </div>
                      ) : f.kind === 'date' ? (
                        <SanctionDatePicker
                          value={toIsoDate(form[f.key])}
                          onChange={setDate(f.key)}
                          placeholder={f.placeholder}
                          warn={lowConfidence.has(f.key)}
                          minDate={f.key === 'disbursementDate' ? toIsoDate(form.sanctionDate) : ''}
                          maxDate={f.key === 'disbursementDate' ? (derived.sanctionValidTillIso || '') : ''}
                        />
                      ) : f.textarea ? (
                        <textarea
                          rows={3}
                          value={form[f.key]}
                          onChange={set(f.key)}
                          placeholder={f.placeholder}
                          className={[
                            'br-input',
                            'br-textarea',
                            lowConfidence.has(f.key) ? 'br-input-warn' : '',
                          ].filter(Boolean).join(' ')}
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
                      {!f.readOnly && f.hint && (
                        <span className="br-field-hint">
                          {f.key === 'israAmount' && derived.israIsContractual === false
                            ? 'This is the interest component of the DSRA calculation. It does not indicate '
                              + 'a separate contractual ISRA requirement unless ISRA is explicitly stated in '
                              + 'the sanction letter.'
                            : f.hint}
                        </span>
                      )}
                      {f.key === 'interestDuringMoratorium' && mode === 'import' && interestMoratoriumDefaulted && (
                        <span className="br-field-hint br-tone-warn">
                          Not specified in sanction letter — defaulted to Interest Served.
                        </span>
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
              {/* Debt / Equity / Debt % / Equity % / Rate of Interest aren't
                  shown here — they're written straight into their own fields
                  on the left the moment they're worked out (see the effects
                  above), so a second, delayed copy of the same number in
                  this panel would just be a place for the two to fall out
                  of sync. */}
              <Row
                label="Rate of Interest check"
                value={derived.roiCheck}
                tone={derived.roiOk === false ? 'warn' : derived.roiOk ? 'ok' : ''}
              />
              <Row label="Moratorium ends" value={derived.moratoriumEnd} />
              <Row label="Repayment starts" value={derived.repaymentStart} />
              <Row label="Repayment ends" value={derived.repaymentEnd} />
              <Row label="Total tenor" value={derived.totalTenorMonths} />
              <Row label="First-year interest" value={derived.firstYearInterest} />
              {showDsra && <Row label="DSRA (calculated)" value={derived.dsraAmount} />}
              {showIsra && <Row label="ISRA (calculated)" value={derived.israAmount} />}
              <Row label="Sanction valid till" value={derived.sanctionValidTill} />
              <Row
                label="Disb. Date check"
                value={derived.disbDateCheck}
                tone={derived.disbDateOk === false ? 'warn' : derived.disbDateOk ? 'ok' : ''}
              />
              <Row label="COD status" value={derived.codStatus} />
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
        )}

        {compare && (
          <SanctionCompareModal
            current={form}
            parsed={compare.parsed}
            fileName={compare.file?.name}
            onCancel={() => setCompare(null)}
            onConfirm={applyCompare}
          />
        )}

        {/* Persistent, not the 3s auto-dismissing `error` banner below — this
            reflects the live state of the schedule (see repaymentPctError
            above), so it stays up for as long as the allocation actually is
            invalid and disappears the moment the reviewer fixes it,
            regardless of whether they've attempted Save yet. */}
        {repaymentPctError && <div className="br-banner br-banner-danger">{repaymentPctError}</div>}
        {error && <div className="br-banner br-banner-danger">{error}</div>}

        <div className="br-modal-foot">
          <button type="button" className="br-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="br-btn br-btn-primary"
            onClick={handleSave}
            disabled={saving || duplicateRef || !!repaymentPctError}
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