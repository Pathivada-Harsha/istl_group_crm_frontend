// ─────────────────────────────────────────────────────────────────────────────
//  TenderImportReviewModal — review, correct, and choose what the PDF parser
//  read before any of it reaches the form.
//
//  The import used to write straight into the tender and report "Filled 14
//  fields". That number was the problem: it counted values, not correct values,
//  and a wrong one looked exactly like a right one until somebody re-read a
//  105-page NIT to find it.
//
//  So nothing is written until Apply, and every row is EDITABLE. A reviewer who
//  can see the source line but cannot fix the value in front of them has to
//  apply something wrong and then hunt for the field on the form — which is the
//  same amount of work as not having a parser. Each value gets the control its
//  field deserves: dates as dates, fixed vocabularies as dropdowns, the work
//  description as a textarea, money as a plain figure with a formatted hint.
//
//  Rows the parser is confident about arrive ticked; the rest arrive unticked
//  and stay out unless the user says otherwise. Editing a value ticks its row —
//  nobody types into a field they meant to skip.
//
//  "Re-read with AI" is always available: a plausible-looking wrong value needs
//  escalating just as much as a missing one does.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import {
  SECTORS, TENDER_TYPES, SOURCES, CLIENT_TYPES, FINANCIAL_YEARS,
} from '../../services/tenderData';

// Field-name → the label the Basic Info tab uses, so a row reads the same as the
// input it will land in. Anything not listed falls back to a de-camelised name.
const FIELD_LABELS = {
  tenderNumber: 'Tender Number / NIT No.',
  tenderName: 'Tender Name / Title',
  issuingAuthority: 'Issuing Authority',
  clientCompany: 'Client / Organisation',
  clientType: 'Client Type',
  clientContactEmail: 'Contact Email',
  clientContactPhone: 'Contact Phone',
  clientAddress: 'Client Address',
  clientCity: 'City',
  clientGstin: 'Client GSTIN',
  clientPan: 'Client PAN',
  clientCin: 'Client CIN',
  sector: 'Sector',
  tenderType: 'Tender Type',
  source: 'Source',
  portalLink: 'Portal Link',
  location: 'Location of Work',
  district: 'District',
  state: 'State',
  financialYear: 'Financial Year',
  estimatedValue: 'Estimated Value (₹)',
  emdAmount: 'EMD Amount (₹)',
  performanceSecurityPct: 'Performance Security %',
  submissionDeadline: 'Submission Deadline',
  technicalOpeningDate: 'Technical Opening Date',
  financialOpeningDate: 'Financial Opening Date',
  boqItems: 'BOQ / Schedule rows',
  eligibilityCriteria: 'Eligibility criteria',
};

// The control each field gets. A parser can put a value outside a fixed
// vocabulary, so every dropdown keeps whatever was read as an extra option
// rather than silently dropping it.
const SELECTS = {
  sector: SECTORS,
  tenderType: TENDER_TYPES,
  source: SOURCES,
  clientType: CLIENT_TYPES,
  financialYear: FINANCIAL_YEARS,
};
const DATE_FIELDS = new Set([
  'submissionDeadline', 'technicalOpeningDate', 'financialOpeningDate',
]);
const MONEY_FIELDS = new Set(['estimatedValue', 'emdAmount']);
const LONG_FIELDS = new Set(['tenderName', 'clientAddress']);

const prettyField = (k) =>
  FIELD_LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// Money is stored as plain rupees. The input keeps the raw figure — it is what
// gets saved — and a formatted hint sits beside it, because nine unbroken
// digits are exactly the thing a reviewer cannot check at a glance.
const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : null;
};

const summarise = (field, value) => {
  if (isBlank(value)) return '—';
  if (MONEY_FIELDS.has(field)) return money(value) || String(value);
  return String(value);
};

/**
 * Build one row per proposed change. The child arrays (BOQ, eligibility) become
 * a single row each — they are all-or-nothing on import, and only offered when
 * the tender has none yet, so importing can never destroy manual work.
 */
function buildRows(parse, tender) {
  const rows = (parse.fields || []).map((f) => ({
    key: f.field,
    kind: 'scalar',
    label: prettyField(f.field),
    parsed: f.value,
    current: tender[f.field],
    page: f.page,
    sourceText: f.sourceText,
    origin: f.origin,
    labelInDoc: f.label,
    confident: !!f.confident,
  }));

  const arrayRow = (key, items) => ({
    key,
    kind: 'array',
    label: prettyField(key),
    parsed: items,
    current: tender[key],
    page: items[0] && items[0].page ? items[0].page : null,
    sourceText: items.slice(0, 3)
      .map((r) => r.description || r.criterionName).filter(Boolean).join(' · '),
    origin: parse.origin,
    labelInDoc: 'best-effort scan',
    // Schedules have no standard layout, so these are never ticked by default.
    confident: false,
  });

  if ((parse.boqItems || []).length && !(tender.boqItems || []).length) {
    rows.push(arrayRow('boqItems', parse.boqItems));
  }
  if ((parse.eligibilityCriteria || []).length && !(tender.eligibilityCriteria || []).length) {
    rows.push(arrayRow('eligibilityCriteria', parse.eligibilityCriteria));
  }
  return rows;
}

const seedState = (rows) => {
  const checked = {};
  const values = {};
  rows.forEach((r) => {
    checked[r.key] = r.confident;
    values[r.key] = r.kind === 'array' ? r.parsed : (r.parsed ?? '');
  });
  return { checked, values };
};

export default function TenderImportReviewModal({
  parse, tender, fileName, busy, onApply, onReread, onCancel,
}) {
  const rows = useMemo(() => buildRows(parse, tender), [parse, tender]);

  const [state, setState] = useState(() => seedState(buildRows(parse, tender)));
  // An AI re-read replaces the answer, so it re-seeds rather than keeping ticks
  // and edits that belonged to the answer it replaced.
  const [seenParse, setSeenParse] = useState(parse);
  if (seenParse !== parse) {
    setState(seedState(rows));
    setSeenParse(parse);
  }

  const { checked, values } = state;

  const toggle = (key) =>
    setState((s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));

  // Editing a value ticks its row: nobody types into a field they meant to skip.
  // Clearing one is the opposite intent, so that unticks instead.
  const edit = (key, value) =>
    setState((s) => ({
      ...s,
      values: { ...s.values, [key]: value },
      checked: { ...s.checked, [key]: !isBlank(value) },
    }));

  const reset = (row) =>
    setState((s) => ({ ...s, values: { ...s.values, [row.key]: row.parsed ?? '' } }));

  const setAll = (value) =>
    setState((s) => {
      const next = {};
      rows.forEach((r) => { next[r.key] = value; });
      return { ...s, checked: next };
    });

  const selected = rows.filter((r) => checked[r.key] && !isBlank(values[r.key]));
  const overwrites = selected.filter((r) => r.kind === 'scalar' && !isBlank(r.current)).length;

  const apply = () => {
    const patch = {};
    selected.forEach((r) => {
      patch[r.key] = r.kind === 'array' ? r.parsed : String(values[r.key]).trim();
    });
    onApply(patch);
  };

  // ── one editable cell, typed to its field ──
  const control = (row) => {
    const value = values[row.key];
    const common = {
      value: value ?? '',
      onChange: (e) => edit(row.key, e.target.value),
      disabled: busy,
      'aria-label': row.label,
    };

    if (row.kind === 'array') {
      return (
        <span className="tnd-import-static">
          {row.parsed.length} row{row.parsed.length === 1 ? '' : 's'} read from the document
        </span>
      );
    }
    if (SELECTS[row.key]) {
      const options = SELECTS[row.key].includes(value) || isBlank(value)
        ? SELECTS[row.key]
        : [value, ...SELECTS[row.key]];        // keep what was read, even if unlisted
      return (
        <select className="tnd-import-input" {...common}>
          <option value="">— leave blank —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (DATE_FIELDS.has(row.key)) {
      return <input type="date" className="tnd-import-input" {...common} />;
    }
    if (LONG_FIELDS.has(row.key)) {
      // A work description runs to ~300 characters; three rows hides half of it
      // behind a scroll, which is the one field a reviewer most needs to read.
      return <textarea className="tnd-import-input" rows={row.key === 'tenderName' ? 5 : 2} {...common} />;
    }
    return <input type="text" className="tnd-import-input" {...common} />;
  };

  const hint = (row) => {
    if (MONEY_FIELDS.has(row.key)) return money(values[row.key]);
    if (row.key === 'performanceSecurityPct' && !isBlank(values[row.key])) {
      return `${values[row.key]}% of contract value`;
    }
    return null;
  };

  return (
    <div className="tnd-modal-overlay" role="dialog" aria-modal="true" aria-label="Review imported fields">
      <div className="tnd-modal tnd-import-modal">
        <div className="tnd-modal-head">
          <div className="tnd-import-heading">
            <div className="tnd-modal-title">Review what was read from the PDF</div>
            <div className="tnd-import-sub">
              {fileName ? `${fileName} · ` : ''}
              {parse.pageCount} page{parse.pageCount === 1 ? '' : 's'}
              {parse.summaryFromPage
                ? ` · summary on page ${parse.summaryFromPage}${
                    parse.summaryToPage && parse.summaryToPage !== parse.summaryFromPage
                      ? `–${parse.summaryToPage}` : ''}`
                : ''}
              {parse.origin === 'regex+ai' ? ' · re-read with AI' : ''}
            </div>
          </div>
          <button
            className="tnd-btn tnd-btn-ghost tnd-btn-sm"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* State of the parse, in plain words, plus the escalation. Offered
            whether the parse succeeded or not — see the file header. */}
        <div className={`tnd-import-banner ${parse.complete ? 'ok' : 'warn'}`}>
          <span>{parse.message}</span>
          <button className="tnd-btn tnd-btn-sm" onClick={onReread} disabled={busy}>
            {busy ? 'Reading…' : '✨ Re-read with AI'}
          </button>
        </div>

        {rows.length > 0 && (
          <div className="tnd-import-toolbar">
            <span className="tnd-muted">
              {selected.length} of {rows.length} selected
              {overwrites > 0 && ` · ${overwrites} will replace a value already in the form`}
            </span>
            <span className="tnd-import-toolbar-actions">
              <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={() => setAll(true)} disabled={busy}>
                Select all
              </button>
              <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={() => setAll(false)} disabled={busy}>
                Select none
              </button>
            </span>
          </div>
        )}

        <div className="tnd-import-body">
          {rows.length === 0 ? (
            <div className="tnd-import-empty">
              Nothing could be read from this PDF that passed checking. Try the AI re-read,
              or enter the fields by hand — the file is still attached on Save.
            </div>
          ) : (
            <div className="tnd-import-table">
              <div className="tnd-import-head-row">
                <span />
                <span>Field</span>
                <span>Value read from the PDF — edit to correct it</span>
                <span>Currently in the form</span>
              </div>

              {rows.map((r) => {
                const edited = r.kind === 'scalar' && String(values[r.key] ?? '') !== String(r.parsed ?? '');
                const h = hint(r);
                return (
                  <div
                    key={r.key}
                    className={`tnd-import-row${checked[r.key] ? ' is-checked' : ''}`}
                  >
                    <span className="tnd-import-check">
                      <input
                        type="checkbox"
                        checked={!!checked[r.key]}
                        onChange={() => toggle(r.key)}
                        disabled={busy}
                        aria-label={`Apply ${r.label}`}
                      />
                    </span>

                    <span className="tnd-import-fieldcell">
                      <button
                        type="button"
                        className="tnd-import-field"
                        onClick={() => toggle(r.key)}
                        disabled={busy}
                      >
                        {r.label}
                      </button>
                      <span className="tnd-import-tags">
                        {!r.confident && <span className="tnd-import-flag">needs a look</span>}
                        {r.origin === 'ai' && <span className="tnd-import-flag ai">AI</span>}
                        {edited && <span className="tnd-import-flag edited">edited</span>}
                      </span>
                    </span>

                    <span className="tnd-import-valuecell">
                      {control(r)}
                      {h && <span className="tnd-import-hint">{h}</span>}
                    </span>

                    <span className="tnd-import-currentcell" title={summarise(r.key, r.current)}>
                      {r.kind === 'array'
                        ? ((r.current || []).length
                            ? `${r.current.length} row${r.current.length === 1 ? '' : 's'} entered`
                            : '—')
                        : summarise(r.key, r.current)}
                    </span>

                    {/* Provenance: without this a user has to re-read the PDF to
                        check a single field. */}
                    <span className="tnd-import-source">
                      <span className="tnd-import-page">{r.page ? `p.${r.page}` : 'derived'}</span>
                      {r.labelInDoc ? ` · ${r.labelInDoc}` : ''}
                      {r.sourceText ? ` — “${r.sourceText}”` : ''}
                      {edited && (
                        <button type="button" className="tnd-import-reset" onClick={() => reset(r)}>
                          undo edit
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Values that were read and thrown away. Shown so "why is this
              blank?" has an answer that is not "the parser is broken". */}
          {(parse.discarded || []).length > 0 && (
            <details className="tnd-import-discarded">
              <summary>
                {parse.discarded.length} value{parse.discarded.length === 1 ? '' : 's'} read
                and left out as unreliable
              </summary>
              <ul>
                {parse.discarded.map((d, i) => (
                  <li key={`${d.field}-${i}`}>
                    <b>{prettyField(d.field)}</b>: “{d.value}” — {d.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="tnd-modal-foot">
          <span className="tnd-muted tnd-import-foot-note">
            Nothing is written to the tender until you apply.
          </span>
          <button className="tnd-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="tnd-btn tnd-btn-primary"
            onClick={apply}
            disabled={busy || selected.length === 0}
          >
            Apply {selected.length} field{selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
