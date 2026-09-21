// src/components/borrowers/SanctionOverviewPanel.js
//
// One sanction's full read-only picture, as independently reusable pieces —
// the Sanction Details card, the Derived Values card, and the Repayment
// Schedule section (plus a document strip card, DocumentCard, kept here as a
// self-contained document-actions component even though Entity Detail
// currently renders those actions per-row in its Sanction Letters table
// instead) — extracted out of BorrowerDetail.js so Entity Detail's Overview
// tab (which lays the identity card alongside these in one grid) never
// drifts from how a sanction's own figures are calculated or displayed.
// Nothing here owns data: every action (open/download/replace/attach the
// document) is a callback prop, and every piece of state that needs to
// survive a click (the attach-and-compare flow, the edit modal, the delete
// confirm) stays with whichever page renders these. Only presentational
// "show all"/"expand" toggles live in here, since those never need to be
// seen outside one card instance.

import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Eye, Download, Paperclip, ChevronDown, ChevronUp,
  FileSpreadsheet, FileType2, Landmark, Wallet, Layers, Clock, Percent,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { BsInfoCircle } from 'react-icons/bs';
import borrowerApi from '../../services/borrowerApi';
import { useAuth } from '../../hooks/useAuth';
import RepaymentScheduleTab from './RepaymentScheduleTab';
import { SANCTION_FIELDS, getSanctionLimitLabel } from './sanctionFields';
import { REPAYMENT_FREQUENCIES, formatDate, parseDate } from './sanctionDerive';
import { exportSchedulePDF, exportScheduleWord, exportScheduleExcel } from './scheduleExport';
import { displayName } from './displayName';

// Field/row keys that carry DSRA or ISRA detail — hidden from the read-only
// Sanction Details / Derived Values cards for a user without the matching
// VIEW_DSRA_DETAILS / VIEW_ISRA_DETAILS permission. The underlying sanction
// record and its calculations are untouched; only these cards' row lists
// are filtered before rendering.
export const DSRA_DETAIL_KEYS = new Set(['dsra', 'dsraAmount', 'derivedDsraAmount']);
export const ISRA_DETAIL_KEYS = new Set(['isra', 'israAmount', 'derivedIsraAmount']);

// Free-text covenant fields read as sentences, not numbers — left-aligning
// just these keeps every other field's right-aligned number/date look intact.
export const LEFT_ALIGN_KEYS = new Set(['cashSweep', 'dsra', 'isra']);

// Compact-card default: how many already-filled fields a Sanction Details /
// Derived Values card shows before "show all" is needed.
const CARD_ROW_CAP = 7;

// ROI (detailHidden) doesn't get its own row here — it's stitched onto the
// front of "Rate of interest" instead (see the interestRateText special case
// below), since SanctionFormModal strips the percentage out of that field on
// import specifically so it isn't typed twice across the two form fields.
const DETAIL_FIELDS = SANCTION_FIELDS.filter((f) => !f.detailHidden);

export const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

/** Same friendly labelling the sanction form's dropdown uses, for the read-only view. */
export const repaymentFrequencyLabel = (active) => {
  const found = REPAYMENT_FREQUENCIES.find((f) => f.value === active.repaymentFrequency);
  if (!found) return active.repaymentFrequency;
  if (found.value === 'OTHER') {
    const n = parseInt(active.repaymentFrequencyOtherMonths, 10);
    return n > 0 ? `Other (every ${n} month${n === 1 ? '' : 's'})` : found.label;
  }
  return found.label;
};

/** The derived panel, as data — so it can be filtered like the card beside it. */
export const DERIVED_ROWS = [
  { key: 'derivedEquityContribution', label: 'Equity contribution' },
  { key: 'derivedMoratoriumEnd', label: 'Moratorium ends' },
  { key: 'derivedRepaymentStart', label: 'Repayment starts (modelled)' },
  { key: 'derivedRepaymentEnd', label: 'Repayment ends (modelled)' },
  { key: 'derivedTotalTenorMonths', label: 'Total tenor' },
  { key: 'derivedFirstYearInterest', label: 'First-year interest' },
  { key: 'derivedDsraAmount', label: 'DSRA (calculated)', tone: (v) => (v === 'Not Calculated' ? 'warn' : '') },
  { key: 'derivedIsraAmount', label: 'ISRA (calculated)', tone: (v) => (v === 'Not Calculated' ? 'warn' : '') },
  { key: 'derivedSanctionValidTill', label: 'Sanction valid till' },
  { key: 'derivedCodStatus', label: 'COD status' },
];

export const statusLabel = (s) => ({
  DRAFT: 'Draft',
  IMPORTED: 'Imported',
  REVIEW: 'Review',
  ONBOARDED: 'Onboarded',
}[s] || s || '—');

export const sourceLabel = (s) => ({
  MANUAL: 'Entered manually',
  IMPORTED: 'Imported',
  IMPORTED_EDITED: 'Imported, edited',
}[s] || s);

/**
 * The (i) icon a field label carries when it has explanatory hint text —
 * click to reveal, same pattern already used in the edit form (SanctionFormModal.js)
 * for "Why review this" and the Sanction Limits rules popover, just once per
 * field instead of once per section. Keeps every field's caption out of the
 * layout by default; a reader who wants it clicks for it instead of it
 * always taking a line — shared here (rather than staying local to the edit
 * form) so the read-only Row below can use the exact same pattern.
 */
export const FieldInfoHint = ({ text, tone = '' }) => {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [show]);
  if (!text) return null;
  return (
    <span className="br-info-wrap" ref={ref}>
      <button
        type="button"
        className={`br-info-btn${tone ? ` br-tone-${tone}` : ''}`}
        onClick={() => setShow((v) => !v)}
        aria-label="More about this field"
        aria-expanded={show}
      >
        <BsInfoCircle size={12} aria-hidden="true" />
      </button>
      {show && <div className="br-info-popover" role="tooltip">{text}</div>}
    </span>
  );
};

export const Row = ({
  label, value, strong = false, tone = '', empty = '—',
  mono = false, icon = null, align = '', caption = null,
}) => (
  <div className="br-dl-row">
    <dt className="br-dl-label">
      {icon && <span className="br-dl-icon">{icon}</span>}
      {label}
      <FieldInfoHint text={caption} />
    </dt>
    <dd className={[
      'br-dl-value',
      strong ? 'br-strong' : '',
      mono && value ? 'br-mono' : '',
      value ? (tone ? `br-tone-${tone}` : '') : 'br-muted',
      align === 'left' ? 'brx-dl-value-left' : '',
    ].filter(Boolean).join(' ')}>
      {value || empty}
    </dd>
  </div>
);

/** The "N of M fields available — show all" / "Hide empty fields" link under a compact card's row list. */
export const ExpandToggle = ({ expanded, onToggle, filledCount, totalCount }) => (
  <button type="button" className="br-link br-link-block" onClick={onToggle}>
    {expanded ? (
      <>Hide empty fields <ChevronUp size={13} aria-hidden="true" /></>
    ) : (
      <>{filledCount} of {totalCount} fields available — show all <ChevronDown size={13} aria-hidden="true" /></>
    )}
  </button>
);

// Export button for the Repayment Schedule card — picks PDF / Word / Excel,
// closing on an outside click same as any other small popover menu here.
export const ScheduleExportMenu = ({ view, form, meta }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pagePermissions } = useAuth();
  const perm = {
    showDsra: !!pagePermissions?.BARROWER?.includes('VIEW_DSRA_DETAILS'),
    showIsra: !!pagePermissions?.BARROWER?.includes('VIEW_ISRA_DETAILS'),
    showDetailedInterest: !!pagePermissions?.BARROWER?.includes('VIEW_DETAILED_INTEREST_BREAKDOWN'),
  };

  useEffect(() => {
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const pick = (fn) => { setOpen(false); fn(view, form, meta, perm); };

  return (
    <div className="br-export-menu" ref={ref}>
      <button
        type="button"
        className="br-btn br-btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} aria-hidden="true" />
        Export
      </button>
      {open && (
        <div className="br-export-menu-panel" role="menu">
          <button type="button" role="menuitem" onClick={() => pick(exportSchedulePDF)}>
            <FileType2 size={14} aria-hidden="true" />
            PDF (A4)
          </button>
          <button type="button" role="menuitem" onClick={() => pick(exportScheduleWord)}>
            <FileText size={14} aria-hidden="true" />
            Word (A4)
          </button>
          <button type="button" role="menuitem" onClick={() => pick(exportScheduleExcel)}>
            <FileSpreadsheet size={14} aria-hidden="true" />
            Excel
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Every SANCTION_FIELDS row, shaped to its display value exactly as the
 * "Sanction details" card always has (borrowerName's borrower fallback, the
 * combined ROI + interest-terms sentence, the planned-COD-until-actual
 * fallback, the moratorium/repayment-frequency labels), DSRA/ISRA-permission
 * filtered — but WITHOUT the card's own cap/expand/section-flattening, so a
 * caller that wants these grouped into their own SANCTION_FIELDS `group`
 * bands (SanctionDetailView's per-section rendering) can do so without
 * re-deriving any of these values itself.
 */
export const buildDetailRows = (borrower, sanction, { hasDsraPermission = false, hasIsraPermission = false } = {}) => {
  if (!sanction) return [];
  return DETAIL_FIELDS.map((f) => ({
    ...f,
    value: f.key === 'borrowerName'
      ? displayName(sanction[f.key] || borrower?.borrowerName)
      : f.key === 'interestRateText'
        ? [sanction.roiPct, sanction.interestRateText].filter((v) => !isBlank(v)).join(' ')
        // Until a real Actual COD Date is entered, the planned date stands
        // in for it (see SanctionDerivedCalculator).
        : f.key === 'actualCod'
          ? sanction.derivedActualCod
          : f.key === 'interestDuringMoratorium'
            ? (sanction[f.key] === 'CAPITALIZED' ? 'Interest Capitalized'
              : sanction[f.key] === 'SERVICED' ? 'Interest Served' : sanction[f.key])
            : f.key === 'repaymentFrequency'
              ? repaymentFrequencyLabel(sanction)
              : sanction[f.key],
  })).filter((f) => (
    (hasDsraPermission || !DSRA_DETAIL_KEYS.has(f.key))
    && (hasIsraPermission || !ISRA_DETAIL_KEYS.has(f.key))
  ));
};

/** The "Sanction details" card — every field on the letter, in sheet order. */
export const SanctionDetailsCard = ({ borrower, sanction }) => {
  const [expanded, setExpanded] = useState(false);
  const { pagePermissions } = useAuth();
  const hasDsraPermission = !!pagePermissions?.BARROWER?.includes('VIEW_DSRA_DETAILS');
  const hasIsraPermission = !!pagePermissions?.BARROWER?.includes('VIEW_ISRA_DETAILS');
  if (!sanction) {
    return (
      <section className="br-card">
        <header className="br-card-head">
          <span className="br-dot br-dot-read" aria-hidden="true" />
          <h2 className="br-card-title">Sanction details</h2>
        </header>
        <p className="br-muted">These fill in once a sanction is recorded.</p>
      </section>
    );
  }
  const allRows = buildDetailRows(borrower, sanction, { hasDsraPermission, hasIsraPermission });
  const filledRows = allRows.filter((f) => !isBlank(f.value));
  const visibleRows = expanded ? allRows : filledRows.slice(0, CARD_ROW_CAP);
  const canToggle = expanded || filledRows.length > CARD_ROW_CAP || filledRows.length < allRows.length;
  return (
    <section className="br-card">
      <header className="br-card-head">
        <span className="br-dot br-dot-read" aria-hidden="true" />
        <h2 className="br-card-title">Sanction details</h2>
        {sanction.source && <span className="br-chip">{sourceLabel(sanction.source)}</span>}
      </header>
      <dl className="br-dl br-scroll-body">
        {visibleRows.map((f) => (
          <Row
            key={f.key}
            label={f.label}
            value={f.value}
            strong={f.key === 'sanctionedAmount'}
            mono={f.mono}
            align={LEFT_ALIGN_KEYS.has(f.key) ? 'left' : ''}
            caption={f.hint}
          />
        ))}
      </dl>
      {canToggle && (
        <ExpandToggle
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          filledCount={filledRows.length}
          totalCount={allRows.length}
        />
      )}
    </section>
  );
};

/** The "Derived values" card — every figure the app works out on its own. */
export const DerivedValuesCard = ({ sanction }) => {
  const [expanded, setExpanded] = useState(false);
  const { pagePermissions } = useAuth();
  const hasDsraPermission = !!pagePermissions?.BARROWER?.includes('VIEW_DSRA_DETAILS');
  const hasIsraPermission = !!pagePermissions?.BARROWER?.includes('VIEW_ISRA_DETAILS');
  const derivedRows = DERIVED_ROWS.filter((d) => (
    (hasDsraPermission || !DSRA_DETAIL_KEYS.has(d.key))
    && (hasIsraPermission || !ISRA_DETAIL_KEYS.has(d.key))
  ));
  if (!sanction) {
    return (
      <section className="br-card">
        <header className="br-card-head">
          <span className="br-dot br-dot-calc" aria-hidden="true" />
          <h2 className="br-card-title">Derived values</h2>
        </header>
        <p className="br-muted">These fill in once a sanction is recorded.</p>
      </section>
    );
  }
  const filledRows = derivedRows.filter((d) => !isBlank(sanction[d.key]));
  const visibleRows = expanded ? derivedRows : filledRows.slice(0, CARD_ROW_CAP);
  const canToggle = expanded || filledRows.length > CARD_ROW_CAP || filledRows.length < derivedRows.length;
  return (
    <section className="br-card">
      <header className="br-card-head">
        <span className="br-dot br-dot-calc" aria-hidden="true" />
        <h2 className="br-card-title">Derived values</h2>
      </header>
      <dl className="br-dl br-scroll-body">
        {visibleRows.map((d) => (
          <Row key={d.key} label={d.label} value={sanction[d.key]} tone={d.tone ? d.tone(sanction[d.key]) : ''} />
        ))}
        {filledRows.length === 0 && (
          <p className="br-muted br-dl-note">
            Nothing to work these out from yet. They fill in as the
            amounts, rate and dates are recorded.
          </p>
        )}
      </dl>
      {canToggle && (
        <ExpandToggle
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          filledCount={filledRows.length}
          totalCount={derivedRows.length}
        />
      )}
    </section>
  );
};

/** The document strip — view / download / replace / attach the stored letter. */
export const DocumentCard = ({ sanction, onOpenDocument, onStartAttach, attaching }) => {
  if (!sanction) {
    return (
      <section className="br-card">
        <header className="br-card-head"><h2 className="br-card-title">Sanction letter</h2></header>
        <p className="br-muted">Nothing to show until a sanction is recorded.</p>
      </section>
    );
  }
  return (
    <section className="br-card">
      <header className="br-card-head">
        <h2 className="br-card-title">Sanction letter</h2>
      </header>
      <div className="br-docstrip br-docstrip-inset">
        <FileText size={20} className="br-docstrip-icon" aria-hidden="true" />
        <div className="br-docstrip-text">
          <strong>{sanction.hasDocument ? 'Sanction letter' : 'No letter attached'}</strong>
          <span>
            {sanction.hasDocument ? (
              <>
                {sanction.sanctionDocName}
                {sanction.sanctionDocSize ? ` · ${Math.round(sanction.sanctionDocSize / 1024)} KB` : ''}
              </>
            ) : (
              'Attach the letter and its values will be checked against this record.'
            )}
          </span>
        </div>
        <div className="br-docstrip-actions">
          {sanction.hasDocument ? (
            <>
              <button type="button" className="br-btn br-btn-sm" onClick={onOpenDocument}>
                <Eye size={14} aria-hidden="true" />
                View
              </button>
              <button
                type="button"
                className="br-btn br-btn-sm"
                onClick={() => borrowerApi.downloadDocFile(sanction.id, sanction.sanctionDocName)}
              >
                <Download size={14} aria-hidden="true" />
                Download
              </button>
            </>
          ) : (
            <button type="button" className="br-btn br-btn-sm br-btn-primary" onClick={onStartAttach} disabled={attaching}>
              <Paperclip size={14} aria-hidden="true" />
              {attaching ? 'Reading…' : 'Attach letter'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

const numFromDisb = (v) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
// A Limit or Tranche counts as disbursed the moment its own Actual Disb.
// Date is filled in — same "Actual = it happened" convention every other
// Actual Disb. Date field on this page already carries, no extra check
// against today's date.
const disbStatus = (actualDate) => (actualDate ? 'Disbursed' : 'Pending');

// Static explanatory copy, verified line-for-line against the actual
// calculation engine (sanctionDerive.js's resolveRepaymentWindow /
// buildQuarterEndSchedule) rather than invented — if the engine ever
// changes, this text needs to change with it, not the other way around.
const CALCULATION_STEPS = [
  'All tranches belong to the same sanctioned Limit and share one combined repayment schedule — there is no separate schedule per tranche.',
  "Each tranche's own Actual Disbursement Date is shown in its own column under Disbursement. A tranche with no Actual Disbursement Date yet is Pending: it adds nothing to the outstanding balance, the interest or Total Disb. until it is actually disbursed. Disbursed to Date is the running total of Total Disb. up to that period.",
  "The schedule starts (moratorium start) on the earliest tranche's Actual Disbursement Date. Loan Opening is ₹0 in that first period.",
  "Each tranche is added to the outstanding balance from its own Actual Disbursement Date. Closing Balance = Loan Opening + Total Disb. − Principal Repayment.",
  'Interest in a moratorium period is the sum, over each stretch between tranche dates, of Outstanding Balance × ROI × Days ÷ 365. In a repayment period it is the average of Loan Opening and Loan Closing × ROI × Days ÷ 365.',
  'Principal Repayment follows the Limit\'s Repayment % profile (or an automatic equal split), applied to the amount disbursed by the Moratorium End Date (plus capitalized moratorium interest, if applicable). A tranche cannot be dated after the Moratorium End Date.',
  'Total Debt Service = Principal Repayment + Interest for that period.',
  'DSRA and ISRA use the existing rolling-window calculation over these same combined schedule rows.',
];

/** "How the Calculation Works" — a click-to-reveal panel, same pattern as
 * the section's own "About this section" info popover, just a longer
 * numbered explanation rather than one sentence. Purely static text; no
 * props needed since it describes the (unchanging) engine, not any one
 * sanction's own figures. */
export const RepaymentCalculationInfo = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="br-calc-info">
      <button
        type="button"
        className="br-link br-calc-info-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <BsInfoCircle size={13} aria-hidden="true" />
        {open ? 'Hide calculation details' : 'View Calculation Details'}
      </button>
      {open && (
        <div className="br-calc-info-panel">
          <strong className="br-calc-info-heading">How the calculation works</strong>
          <ol>
            {CALCULATION_STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
};

/**
 * The Repayment Schedule section — info popover, export menu, the full
 * instalment table. `scheduleView` is `deriveRepaymentSchedule(sanction)`,
 * computed by the caller so this component never needs to know about
 * sanctionDerive.js itself. `limitScheduleViews` (also caller-computed, via
 * sanctionDerive's buildLimitScheduleViews) is one such view per Sanction
 * Limit — when the sanction has any, a Limit dropdown picks which one this
 * section shows, same as SanctionFormModal's own Repayment Schedule tab;
 * `scheduleView` alone still covers a sanction saved before Sanction Limits
 * existed, so no sanction ever renders with nothing here.
 */
export const RepaymentScheduleSection = ({
  borrower, sanction, scheduleView, limitScheduleViews = [],
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedLimitIndex, setSelectedLimitIndex] = useState(0);
  if (!sanction || !scheduleView) {
    return (
      <div className="sr-detail-empty">
        <p className="br-muted">Nothing to show until a sanction is recorded.</p>
      </div>
    );
  }
  const limits = sanction.limits || [];
  const hasLimits = limits.length > 0;
  const i = hasLimits ? Math.min(selectedLimitIndex, limits.length - 1) : -1;
  const activeLimit = hasLimits ? limits[i] : null;
  const activeView = hasLimits ? limitScheduleViews[i] : scheduleView;
  const activeForm = hasLimits
    ? {
      ...sanction,
      disbursementDate: activeLimit.actualDisbursementDate,
      debtAmount: activeLimit.facilityLimitAmount,
      tranches: activeLimit.tranches || [],
    }
    : sanction;
  const activeHasTranches = hasLimits && (activeLimit.tranches || []).length > 0;
  return (
    <section className="br-card br-schedule-section">
      <header className="br-card-head br-schedule-section-head">
        <span className="br-dot br-dot-schedule" aria-hidden="true" />
        <h2 className="br-card-title">
          {activeHasTranches ? 'Repayment Schedule (Combined for Entire Limit)' : 'Repayment schedule'}
        </h2>
        {expanded && limits.length > 1 && (
          <div className="br-limit-schedule-heading br-schedule-limit-picker">
            <select
              className="br-input br-limit-schedule-select"
              value={i}
              onChange={(e) => setSelectedLimitIndex(Number(e.target.value))}
            >
              {limits.map((l, idx) => (
                <option key={idx} value={idx}>
                  {l.limitLabel || getSanctionLimitLabel(idx)}
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="br-schedule-header-spacer" aria-hidden="true" />
        <span className="br-info-wrap">
          <button
            type="button"
            className="br-info-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="About this section"
            aria-expanded={showInfo}
          >
            <BsInfoCircle size={14} aria-hidden="true" />
          </button>
          {showInfo && (
            <div className="br-info-popover br-info-popover-wide" role="tooltip">
              {activeHasTranches
                ? 'This is one combined repayment schedule for the entire limit. Individual tranche '
                  + 'disbursements are shown separately in the disbursement columns, while interest, '
                  + 'principal repayment, debt service and closing balance are calculated/displayed at '
                  + 'the combined limit level.'
                : 'Computed from the sanction details, ROI, repayment frequency, moratorium '
                  + 'and DSRA/ISRA requirement recorded above — not a separate source of truth.'}
            </div>
          )}
        </span>
        <div className="br-schedule-section-actions">
          <ScheduleExportMenu
            view={activeView}
            form={activeForm}
            meta={{ borrowerName: borrower?.borrowerName, refNo: sanction.refNo }}
          />
          <button
            type="button"
            className="br-icon-btn"
            aria-label={expanded ? 'Collapse repayment schedule' : 'Expand repayment schedule'}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>
      </header>
      {expanded && (
        <>
          <RepaymentScheduleTab view={activeView} form={activeForm} readOnly paginated tableHeading={null} />
          {activeHasTranches && <RepaymentCalculationInfo />}
        </>
      )}
    </section>
  );
};

const fmtCr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
const fmtPct = (n) => `${Number(n || 0).toFixed(2)}%`;
// DD-MMM-YYYY, the date style the rest of the sanction views quote.
const dashDate = (raw) => {
  const d = parseDate(raw);
  return d ? formatDate(d).replace(/ /g, '-') : null;
};

/**
 * One limit's disbursement picture, in the exact shape the Disbursement
 * Schedule tab draws it from — the same rules DisbursementScheduleSection has
 * always used (a tranche is Disbursed once its Actual Disb. Date is filled in;
 * a tranched limit counts only its disbursed tranches; Pending is what is
 * left of the limit amount), just scoped to one limit. A limit with no
 * tranches is one "Lump sum" row carrying its own amount and dates.
 */
const buildLimitDisbursement = (limit) => {
  const limitAmt = numFromDisb(limit.facilityLimitAmount);
  const tranches = limit.tranches || [];
  const rows = tranches.length
    ? tranches.map((tr, i) => ({
      key: tr.id || i,
      name: `Tranche ${i + 1}`,
      amount: numFromDisb(tr.trancheAmount),
      tentative: tr.tentativeDisbursementDate,
      actual: tr.actualDisbursementDate,
    }))
    : [{
      key: 'lump',
      name: 'Lump sum',
      amount: limitAmt,
      tentative: limit.tentativeDisbursementDate,
      actual: limit.actualDisbursementDate,
    }];
  rows.forEach((r) => {
    r.status = disbStatus(r.actual);
    r.pct = limitAmt > 0 ? (r.amount / limitAmt) * 100 : 0;
  });
  const disbursed = rows.reduce((t, r) => t + (r.actual ? r.amount : 0), 0);
  const pending = Math.max(limitAmt - disbursed, 0);
  const pctDisbursed = limitAmt > 0 ? (disbursed / limitAmt) * 100 : 0;
  // Actual dates in date order first; Pending ones keep their own order after
  // them, since they have no actual date to sort by.
  const done = rows.filter((r) => r.actual)
    .sort((a, b) => (parseDate(a.actual)?.getTime() || 0) - (parseDate(b.actual)?.getTime() || 0));
  const timeline = [...done, ...rows.filter((r) => !r.actual)];
  return {
    limitAmt, rows, disbursed, pending, pctDisbursed, timeline,
    totalAmount: rows.reduce((t, r) => t + r.amount, 0),
    totalPct: rows.reduce((t, r) => t + r.pct, 0),
    hasTranches: tranches.length > 0,
  };
};

const DISB_GREEN = '#16a34a';
const DISB_AMBER = '#f59e0b';

/** The reference layout for one limit: summary cards, tranche table, donut, timeline. Display-only. */
const LimitDisbursementView = ({ limit, index }) => {
  const d = buildLimitDisbursement(limit);
  const limitName = limit.limitLabel || getSanctionLimitLabel(index);
  const isNonFund = /^non\s*fund/i.test(limitName);
  const chartData = d.limitAmt > 0 && (d.disbursed > 0 || d.pending > 0)
    ? [{ name: 'Disbursed', value: d.disbursed, fill: DISB_GREEN }, { name: 'Pending', value: d.pending, fill: DISB_AMBER }]
    : [{ name: 'None', value: 1, fill: '#e5e7eb' }];
  return (
    <div className="br-disbx">
      <div className="br-disbx-cards">
        <div className="br-disbx-card">
          <span className="br-disbx-icon br-disbx-icon-blue"><Landmark size={20} aria-hidden="true" /></span>
          <div className="br-disbx-card-body">
            <span className="br-disbx-card-label">Limit Name</span>
            <span className="br-disbx-card-value br-disbx-limit-name" title={limit.facilityType || limitName}>
              {limit.facilityType || limitName}
            </span>
            <span className="br-disbx-facility-badge">{isNonFund ? 'Non Fund Based' : 'Fund Based'}</span>
          </div>
        </div>
        <div className="br-disbx-card">
          <span className="br-disbx-icon br-disbx-icon-indigo"><Wallet size={20} aria-hidden="true" /></span>
          <div className="br-disbx-card-body">
            <span className="br-disbx-card-label">Sanctioned Amount</span>
            <span className="br-disbx-card-value">{fmtCr(d.limitAmt)}</span>
          </div>
        </div>
        <div className="br-disbx-card">
          <span className="br-disbx-icon br-disbx-icon-green"><Layers size={20} aria-hidden="true" /></span>
          <div className="br-disbx-card-body">
            <span className="br-disbx-card-label">Total Disbursed</span>
            <span className="br-disbx-card-value">{fmtCr(d.disbursed)}</span>
          </div>
        </div>
        <div className="br-disbx-card">
          <span className="br-disbx-icon br-disbx-icon-amber"><Clock size={20} aria-hidden="true" /></span>
          <div className="br-disbx-card-body">
            <span className="br-disbx-card-label">Total Pending</span>
            <span className="br-disbx-card-value">{fmtCr(d.pending)}</span>
          </div>
        </div>
        <div className="br-disbx-card">
          <span className="br-disbx-icon br-disbx-icon-teal"><Percent size={20} aria-hidden="true" /></span>
          <div className="br-disbx-card-body">
            <span className="br-disbx-card-label">Disbursed %</span>
            <span className="br-disbx-card-value">{fmtPct(d.pctDisbursed)}</span>
          </div>
        </div>
      </div>

      <div className="br-disbx-main">
        <section className="br-disbx-panel">
          <h3 className="br-disbx-panel-title">
            1. Disbursement / Tranche Details
            <span className="br-disbx-panel-sub">
              {d.hasTranches ? ` (${d.rows.length} Tranche${d.rows.length === 1 ? '' : 's'})` : ' (no tranches — disbursed as a single amount)'}
            </span>
          </h3>
          <div className="br-disbx-table-wrap">
            <table className="br-disbx-table">
              <thead>
                <tr>
                  <th>Tranche</th>
                  <th className="br-right">Amount (₹ Cr)</th>
                  <th className="br-center">Tentative Disb. Date</th>
                  <th className="br-center">Actual Disb. Date</th>
                  <th className="br-center">Status</th>
                  <th className="br-right">% of Limit</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td className="br-right">{fmtCr(r.amount)}</td>
                    <td className="br-center">{dashDate(r.tentative) || '—'}</td>
                    <td className="br-center">{dashDate(r.actual) || '—'}</td>
                    <td className="br-center">
                      <span className={`brx-type-badge ${r.status === 'Disbursed' ? 'brx-badge-green' : 'brx-badge-orange'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="br-right">{fmtPct(r.pct)}</td>
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="br-right">{fmtCr(d.totalAmount)}</td>
                  <td />
                  <td />
                  <td />
                  <td className="br-right">{fmtPct(d.totalPct)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="br-disbx-panel br-disbx-side">
          <div className="br-disbx-donut-block">
            <div className="br-disbx-donut-row">
              <div className="br-disbx-donut">
                <PieChart width={112} height={112}>
                  <Pie
                    data={chartData} dataKey="value" innerRadius={38} outerRadius={53}
                    startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}
                  >
                    {chartData.map((c) => <Cell key={c.name} fill={c.fill} />)}
                  </Pie>
                </PieChart>
                <div className="br-disbx-donut-center">
                  <strong>{fmtPct(d.pctDisbursed)}</strong>
                  <span>Disbursed</span>
                </div>
              </div>
              <ul className="br-disbx-legend">
                <li>
                  <span className="br-disbx-dot" style={{ background: DISB_GREEN }} aria-hidden="true" />
                  <span className="br-disbx-legend-label">Disbursed</span>
                  <span className="br-disbx-legend-value">{fmtCr(d.disbursed)}</span>
                </li>
                <li>
                  <span className="br-disbx-dot" style={{ background: DISB_AMBER }} aria-hidden="true" />
                  <span className="br-disbx-legend-label">Pending</span>
                  <span className="br-disbx-legend-value">{fmtCr(d.pending)}</span>
                </li>
                <li className="br-disbx-legend-total">
                  <span className="br-disbx-legend-label">Total</span>
                  <span className="br-disbx-legend-value">{fmtCr(d.limitAmt)}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="br-disbx-tl-block">
            <h3 className="br-disbx-panel-title">Disbursement Timeline</h3>
            <ol className="br-disbx-timeline">
              {d.timeline.map((r) => {
                const pendingRow = !r.actual;
                const when = dashDate(r.actual) || dashDate(r.tentative);
                return (
                  <li key={r.key} className={`br-disbx-tl-item${pendingRow ? ' is-pending' : ''}`}>
                    <span className="br-disbx-tl-dot" aria-hidden="true" />
                    <span className="br-disbx-tl-date">{when || '—'}</span>
                    <strong className="br-disbx-tl-name">{r.name}</strong>
                    <span className="br-disbx-tl-amount">{fmtCr(r.amount)}</span>
                    {pendingRow && <span className="br-disbx-tl-pending">(Pending)</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * Disbursement Schedule tab — separate from RepaymentScheduleSection above
 * (that one tracks loan repayment/amortization; this one tracks how much of
 * the sanction has actually gone out the door, and when). Purely a read-only
 * reshuffle of `sanction.limits[]`/each limit's own `tranches[]` — the exact
 * same data SanctionLimitsCard (edit) and LimitsCard (Overview tab) already
 * show, just aggregated across the whole sanction in one place instead of
 * needing to open each Limit row individually. No new data source.
 */
export const DisbursementScheduleSection = ({ sanction }) => {
  const [showInfo, setShowInfo] = useState(false);

  if (!sanction) {
    return (
      <div className="sr-detail-empty">
        <p className="br-muted">Nothing to show until a sanction is recorded.</p>
      </div>
    );
  }

  const limits = sanction.limits || [];

  return (
    <section className="br-card br-disb-section">
      <header className="br-card-head">
        <span className="br-dot br-dot-schedule" aria-hidden="true" />
        <h2 className="br-card-title">Disbursement overview</h2>
        <span className="br-schedule-header-spacer" aria-hidden="true" />
        <span className="br-info-wrap">
          <button
            type="button"
            className="br-info-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="About this section"
            aria-expanded={showInfo}
          >
            <BsInfoCircle size={14} aria-hidden="true" />
          </button>
          {showInfo && (
            <div className="br-info-popover" role="tooltip">
              Tracks each Limit's own disbursement — and, where a Limit is split
              into Tranches, each Tranche's own amount and date — separately
              from the repayment schedule. A Limit or Tranche counts as
              Disbursed once its Actual Disb. Date is filled in.
            </div>
          )}
        </span>
      </header>

      {limits.length === 0 ? (
        <p className="br-muted br-pad">No Limits recorded for this sanction yet.</p>
      ) : (
        <>
          <div className={limits.length > 1 ? 'br-disbx-limits-scroll' : undefined}>
            {limits.map((l, i) => (
              <div key={l.id || i} className="br-disbx-limit">
                {limits.length > 1 && (
                  <h4 className="br-disbx-limit-heading">{l.limitLabel || getSanctionLimitLabel(i)}</h4>
                )}
                <LimitDisbursementView limit={l} index={i} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
