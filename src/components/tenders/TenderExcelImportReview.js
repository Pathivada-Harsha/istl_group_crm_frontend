// ─────────────────────────────────────────────────────────────────────────────
//  TenderExcelImportReview — the import review screen for a filled Excel
//  template (rendered by TenderImportReviewModal when parse.kind === 'excel').
//
//  The PDF review asks "is this what the document says?"; this one asks "do I
//  want what the spreadsheet says?" — and, since any assistant may have filled
//  the spreadsheet, "does the tender PDF back it up?". So every field shows:
//    • the imported value, editable, with OK / Warning / Error and the reason
//      (and what the cell originally held, when the import corrected it),
//    • the Source Text the sheet quoted, editable, and how it fared against
//      the PDF: Verified (with the PDF's own words and page), Unverified, or
//      Mismatch (an error: the PDF says something else),
//    • the value the tender holds now,
//    • a tick that decides which of the two is kept.
//  A field the tender already holds starts on "keep current" — an import never
//  overwrites a filled field unless the user ticks it (or "Accept all imported").
//  A new tender has nothing to protect, so everything imported starts ticked.
//
//  Saving an Unverified value takes the reviewer's word for it, so it needs an
//  explicit "I checked this" tick: one per field (fields are few and carry the
//  amounts, dates and bank details), one per row or one per table for the
//  tables. A bulk tick never covers a Mismatch, and it is written to the
//  tender's history with the table and row count.
//
//  Edits are re-checked by the backend (POST /tender/excel/validate), using the
//  very rules the import used and the same PDF, so the reviewer can fix an
//  error in place. "Apply & Save" stays disabled while anything blocks it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import tenderApi from '../../services/tenderApi';
import { suggestOperator } from '../../services/tenderData';
import { SELECTS, DATE_FIELDS, MONEY_FIELDS, LONG_FIELDS, isBlank, money } from './tenderImportFields';
import TenderImportRowsEditor, { ROW_COLUMNS, StatusPill, VerifyPill, VerifyNote } from './TenderImportRowsEditor';

const COLLECTIONS = [
  { key: 'eligibilityCriteria', label: 'Eligibility', one: 'criterion', many: 'criteria', tab: 'Eligibility' },
  { key: 'documents', label: 'Documents', one: 'document', many: 'documents', tab: 'Documents' },
  { key: 'boqItems', label: 'BOQ', one: 'row', many: 'rows', tab: 'Rate Analysis' },
];
const plural = (n, c) => `${n} ${n === 1 ? c.one : c.many}`;
const UNVERIFIED = 'UNVERIFIED';

// Only the template's columns — the review's own keys (status, issues,
// excelRow, verification…) never reach the tender.
const plainRow = (collection, r) => {
  const o = {};
  ROW_COLUMNS[collection].forEach((c) => { o[c.key] = r && r[c.key] != null ? String(r[c.key]) : ''; });
  return o;
};

// The seeded default checklist is not "documents the tender already has" —
// only a row somebody has worked on counts as current.
const currentRowCount = (collection, tender) => {
  const cur = tender[collection] || [];
  if (collection !== 'documents') return cur.length;
  return cur.filter((d) => (d.status && d.status !== 'pending') || (d.link || '').trim() || (d.notes || '').trim()).length;
};

// Validation result → lookups the screen reads from.
const toCheck = (result) => {
  const fields = {};
  (result.fields || []).forEach((f) => { fields[f.field] = f; });
  const rows = {};
  COLLECTIONS.forEach((c) => { rows[c.key] = result[c.key] || []; });
  return {
    fields, rows, pdfStatus: result.pdfStatus, pdfNote: result.pdfNote,
    counts: [result.verifiedCount || 0, result.unverifiedCount || 0, result.mismatchCount || 0],
  };
};

function seed(parse, tender, isNew) {
  const values = {};
  const sources = {};
  const checked = {};
  (parse.fields || []).forEach((f) => {
    // An unreadable value stays visible as typed, so it can be corrected here.
    values[f.field] = f.value != null ? String(f.value) : (f.status === 'ERROR' ? (f.raw || '') : '');
    sources[f.field] = f.source || '';
    checked[f.field] = !isBlank(values[f.field]) && (isNew || isBlank(tender[f.field]));
  });
  const rows = {};
  COLLECTIONS.forEach((c) => {
    rows[c.key] = (parse[c.key] || []).map((r) => plainRow(c.key, r));
    checked[c.key] = rows[c.key].length > 0 && (isNew || currentRowCount(c.key, tender) === 0);
  });
  return { values, sources, checked, rows };
}

// The PDF banner: what the values were checked against, or why they could not be.
function PdfBanner({ parse, check }) {
  const status = check.pdfStatus || parse.pdfStatus;
  const note = check.pdfNote || parse.pdfNote;
  if (status === 'ok') {
    const [ver, unver, mism] = check.counts;
    return (
      <div className={`tnd-import-banner tnd-verify-banner ${mism ? 'warn' : 'ok'}`}>
        <span>
          Checked against <strong>{parse.pdfName || 'the tender PDF'}</strong>:{' '}
          {ver} verified · {unver} unverified · {mism} mismatch
        </span>
      </div>
    );
  }
  const title = status === 'scanned' ? 'The PDF is a scan — nothing could be checked'
    : status === 'v1' ? 'Older template — nothing could be checked'
      : status === 'expired' ? 'The PDF is no longer held for this review'
        : 'No PDF to check against';
  return (
    <div className="tnd-import-banner tnd-verify-banner warn">
      <span><strong>{title}.</strong> {note} Every value is Unverified: check each one against the document yourself.</span>
    </div>
  );
}

export default function TenderExcelImportReview({ parse, tender, isNew, fileName, busy, onApply, onCancel }) {
  const [initial] = useState(() => seed(parse, tender, isNew));
  const [values, setValues] = useState(initial.values);
  const [sources, setSources] = useState(initial.sources);
  const [checked, setChecked] = useState(initial.checked);
  const [rows, setRows] = useState(initial.rows);
  const [openRows, setOpenRows] = useState({});
  const [check, setCheck] = useState(() => toCheck(parse));
  const [validating, setValidating] = useState(false);
  const [validateErr, setValidateErr] = useState('');
  // "I checked this" ticks: per field, per row (by index), and per table.
  const [acked, setAcked] = useState({});
  const [rowAcks, setRowAcks] = useState({});
  const [bulkAck, setBulkAck] = useState({});
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const edits = useRef(0);                               // bumps on every edit; stale checks are dropped

  const fieldList = parse.fields || [];

  // Re-check after edits (debounced). The first render shows the import's own result.
  const [editTick, setEditTick] = useState(0);
  useEffect(() => {
    if (editTick === 0) return undefined;
    const mine = edits.current;
    setValidating(true);
    const timer = setTimeout(async () => {
      try {
        const fields = {};
        const fieldSources = {};
        Object.entries(values).forEach(([k, v]) => {
          if (isBlank(v)) return;
          fields[k] = String(v);
          if (!isBlank(sources[k])) fieldSources[k] = String(sources[k]);
        });
        const result = await tenderApi.validateExcel({
          fields,
          fieldSources,
          eligibilityCriteria: rows.eligibilityCriteria,
          documents: rows.documents,
          boqItems: rows.boqItems,
          version: parse.version,
          importId: parse.importId,
        });
        if (mine !== edits.current) return;
        setCheck(toCheck(result || {}));
        setValidateErr('');
      } catch (e) {
        if (mine !== edits.current) return;
        setValidateErr(e.message || 'Could not re-check the values');
      } finally {
        if (mine === edits.current) setValidating(false);
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTick]);

  const touched = () => { edits.current += 1; setEditTick((n) => n + 1); };

  // Editing a value ticks its row; clearing it unticks (same as the PDF review).
  // A confirmation was for the old value, so an edit takes it back.
  const editField = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setChecked((c) => ({ ...c, [key]: !isBlank(value) }));
    setAcked((a) => ({ ...a, [key]: false }));
    touched();
  };
  const editSource = (key, value) => {
    setSources((s) => ({ ...s, [key]: value }));
    setAcked((a) => ({ ...a, [key]: false }));
    touched();
  };
  // `changed` is the edited row's index, or -1 when rows were added/removed
  // (indexes shift, so every row confirmation in the table is taken back).
  const editRows = (collection, next, changed) => {
    setRows((r) => ({ ...r, [collection]: next }));
    setChecked((c) => ({ ...c, [collection]: next.length > 0 }));
    setRowAcks((a) => {
      if (changed < 0) return { ...a, [collection]: [] };
      const list = [...(a[collection] || [])];
      list[changed] = false;
      return { ...a, [collection]: list };
    });
    touched();
  };
  const ackRow = (collection, i, on) => setRowAcks((a) => {
    const list = [...(a[collection] || [])];
    list[i] = on;
    return { ...a, [collection]: list };
  });
  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const acceptAll = () => setChecked((c) => {
    const next = { ...c };
    fieldList.forEach((f) => { next[f.field] = !isBlank(values[f.field]); });
    COLLECTIONS.forEach((col) => { next[col.key] = rows[col.key].length > 0; });
    return next;
  });
  const keepCurrent = () => setChecked((c) => {
    const next = { ...c };
    fieldList.forEach((f) => { next[f.field] = !isBlank(values[f.field]) && isBlank(tender[f.field]); });
    COLLECTIONS.forEach((col) => { next[col.key] = rows[col.key].length > 0 && currentRowCount(col.key, tender) === 0; });
    return next;
  });

  // ── what Apply would write, and what blocks it ──
  // A blank value can still carry a warning ("Hydro is not a Sector option, so
  // it was left blank"); a value the user cleared drops out of the re-check.
  const fieldStatus = (key) => check.fields[key] || { status: 'OK' };
  const rowStatuses = (collection) => check.rows[collection] || [];
  const unverifiedRows = (collection) => rowStatuses(collection)
    .map((r, i) => (r && r.verification === UNVERIFIED ? i : -1)).filter((i) => i >= 0);
  const unconfirmedRows = (collection) => (bulkAck[collection] ? []
    : unverifiedRows(collection).filter((i) => !(rowAcks[collection] || [])[i]));

  const selectedFields = fieldList.map((f) => f.field).filter((k) => checked[k] && !isBlank(values[k]));
  const selectedCollections = COLLECTIONS.filter((c) => checked[c.key] && rows[c.key].length > 0);
  const unconfirmedFields = selectedFields.filter((k) => fieldStatus(k).verification === UNVERIFIED && !acked[k]);
  const blocking = [
    ...selectedFields.filter((k) => fieldStatus(k).status === 'ERROR').map((k) => fieldStatus(k).label || k),
    ...selectedCollections
      .filter((c) => rowStatuses(c.key).some((r) => r.status === 'ERROR'))
      .map((c) => c.label),
  ];
  const unconfirmed = [
    ...unconfirmedFields.map((k) => fieldStatus(k).label || k),
    ...selectedCollections.filter((c) => unconfirmedRows(c.key).length > 0)
      .map((c) => `${c.label} (${unconfirmedRows(c.key).length})`),
  ];
  const overwrites = selectedFields.filter((k) => !isBlank(tender[k])).length
    + selectedCollections.filter((c) => currentRowCount(c.key, tender) > 0).length;
  const total = selectedFields.length + selectedCollections.length;
  const canApply = !busy && !validating && !validateErr && blocking.length === 0
    && unconfirmed.length === 0 && total > 0;

  const apply = () => {
    const selection = {};
    selectedFields.forEach((k) => {
      const f = check.fields[k];
      selection[k] = f && f.value != null ? String(f.value) : String(values[k]).trim();
    });
    selectedCollections.forEach((c) => {
      // The checked (normalised) rows: "1,200 Nos" saves as 1200, "₹26.90 Crore" as 269000000.
      const checkedRows = rowStatuses(c.key);
      selection[c.key] = rows[c.key].map((r, i) => {
        const checkedRow = checkedRows[i] || r;
        const row = plainRow(c.key, checkedRow);
        if (c.key === 'eligibilityCriteria') {
          row.category = row.category || 'Technical';
          row.operator = row.operator || suggestOperator(row.requiredValue) || 'gte';
          // A verified row keeps the PDF's own clause and page, which the
          // Eligibility tab shows under "Source".
          if (checkedRow.verification === 'VERIFIED' && checkedRow.verifyText) {
            row.clauseText = checkedRow.verifyText;
            row.sourcePage = checkedRow.verifyPage != null ? String(checkedRow.verifyPage) : '';
          }
        }
        return row;
      });
    });

    let verified = 0;
    let confirmedByHand = 0;
    selectedFields.forEach((k) => {
      if (fieldStatus(k).verification === 'VERIFIED') verified += 1;
      else if (fieldStatus(k).verification === UNVERIFIED) confirmedByHand += 1;
    });
    const bulkAcks = [];
    selectedCollections.forEach((c) => {
      rowStatuses(c.key).forEach((r) => {
        if (r.verification === 'VERIFIED') verified += 1;
        else if (r.verification === UNVERIFIED) confirmedByHand += 1;
      });
      if (bulkAck[c.key] && unverifiedRows(c.key).length) {
        bulkAcks.push({ table: c.label, rows: unverifiedRows(c.key).length });
      }
    });
    const parts = [`${selectedFields.length} field${selectedFields.length === 1 ? '' : 's'}`];
    selectedCollections.forEach((c) => parts.push(plural(rows[c.key].length, c)));
    parts.push(`${verified} verified against the PDF, ${confirmedByHand} unverified (confirmed by the reviewer)`);
    onApply(selection, parts.join(' · '), bulkAcks);
  };

  // ── one editable value, typed to its field ──
  const control = (key, label) => {
    const value = values[key] ?? '';
    const common = {
      value,
      onChange: (e) => editField(key, e.target.value),
      disabled: busy,
      'aria-label': label,
    };
    if (SELECTS[key]) {
      const options = SELECTS[key].includes(value) || isBlank(value) ? SELECTS[key] : [value, ...SELECTS[key]];
      return (
        <select className="tnd-import-input" {...common}>
          <option value="">— leave blank —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    // An unreadable date stays a text box so the bad value can be seen and fixed.
    if (DATE_FIELDS.has(key) && (isBlank(value) || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
      return <input type="date" className="tnd-import-input" {...common} />;
    }
    if (LONG_FIELDS.has(key)) {
      return <textarea className="tnd-import-input" rows={key === 'tenderName' ? 4 : 2} {...common} />;
    }
    return <input type="text" className="tnd-import-input" {...common} />;
  };

  const currentText = (key) => {
    const v = tender[key];
    if (isBlank(v)) return '—';
    return MONEY_FIELDS.has(key) ? (money(v) || String(v)) : String(v);
  };

  const errorCount = fieldList.filter((f) => fieldStatus(f.field).status === 'ERROR').length
    + COLLECTIONS.reduce((n, c) => n + rowStatuses(c.key).filter((r) => r.status === 'ERROR').length, 0);
  const flagged = (key) => {
    const v = fieldStatus(key).verification;
    return !!v && v !== 'VERIFIED';
  };
  const shownFields = onlyFlagged ? fieldList.filter((f) => flagged(f.field)) : fieldList;

  return (
    <div className="tnd-modal-overlay" role="dialog" aria-modal="true" aria-label="Review Excel import">
      <div className="tnd-modal tnd-import-modal">
        <div className="tnd-modal-head">
          <div className="tnd-import-heading">
            <div className="tnd-modal-title">Review the Excel import</div>
            <div className="tnd-import-sub">
              {fileName ? `${fileName} · ` : ''}template {parse.version}
              {isNew ? ' · new tender' : ' · updating this tender'}
            </div>
          </div>
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={onCancel} disabled={busy} aria-label="Close">✕</button>
        </div>

        <PdfBanner parse={parse} check={check} />
        <div className={`tnd-import-banner ${errorCount ? 'warn' : 'ok'}`}>
          <span>
            {errorCount
              ? `${errorCount} value${errorCount === 1 ? '' : 's'} in error — fix ${errorCount === 1 ? 'it' : 'them'} here, or untick to leave ${errorCount === 1 ? 'it' : 'them'} out.`
              : parse.message}
          </span>
        </div>
        {(parse.warnings || []).length > 0 && (
          <ul className="tnd-import-notes">
            {parse.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}

        <div className="tnd-import-toolbar">
          <span className="tnd-muted">
            {total} selected
            {overwrites > 0 && ` · ${overwrites} will replace what the tender holds now`}
            {validating && ' · checking…'}
          </span>
          <span className="tnd-import-toolbar-actions">
            <label className="tnd-verify-filter">
              <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
              Show only Unverified / Mismatch
            </label>
            <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={acceptAll} disabled={busy}>
              Accept all imported
            </button>
            {!isNew && (
              <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={keepCurrent} disabled={busy}>
                Keep current values
              </button>
            )}
          </span>
        </div>

        <div className="tnd-import-body">
          <div className="tnd-import-table">
            <div className="tnd-import-head-row">
              <span />
              <span>Field</span>
              <span>Imported value &amp; its source — edit to correct</span>
              <span>Currently in the tender</span>
            </div>

            {fieldList.length === 0 && COLLECTIONS.every((c) => rows[c.key].length === 0) && (
              <div className="tnd-import-empty">The workbook had no values to import.</div>
            )}
            {onlyFlagged && shownFields.length === 0 && fieldList.length > 0 && (
              <div className="tnd-import-empty">Every field was verified against the PDF.</div>
            )}

            {shownFields.map((f) => {
              const st = fieldStatus(f.field);
              const hint = MONEY_FIELDS.has(f.field) ? money(st.value ?? values[f.field])
                : f.field === 'performanceSecurityPct' && !isBlank(values[f.field]) ? `${st.value ?? values[f.field]}% of contract value`
                  : null;
              // What the cell held, when the import read it as something else ("₹26.90 Crore" → 269000000).
              const corrected = !isBlank(f.raw) && st.value != null && String(f.raw).trim() !== String(st.value)
                && String(values[f.field]) === String(st.value);
              const needsAck = checked[f.field] && st.verification === UNVERIFIED;
              return (
                <div key={f.field} className={`tnd-import-row${checked[f.field] ? ' is-checked' : ''}${st.status === 'ERROR' ? ' is-error' : ''}`}>
                  <span className="tnd-import-check">
                    <input type="checkbox" checked={!!checked[f.field]} onChange={() => toggle(f.field)}
                      disabled={busy || isBlank(values[f.field])} aria-label={`Use imported ${f.label}`} />
                  </span>
                  <span className="tnd-import-fieldcell">
                    <button type="button" className="tnd-import-field" onClick={() => toggle(f.field)}
                      disabled={busy || isBlank(values[f.field])}>{f.label}</button>
                    <span className="tnd-import-tags">
                      <StatusPill status={st.status} title={st.reason} />
                      <VerifyPill verification={st.verification} title={st.verifyReason} />
                    </span>
                  </span>
                  <span className="tnd-import-valuecell">
                    {control(f.field, f.label)}
                    {hint && <span className="tnd-import-hint">{hint}</span>}
                    {corrected && <span className="tnd-import-hint">read from “{f.raw}”</span>}
                    {parse.pdfStatus !== 'v1' && (
                      <input
                        type="text"
                        className="tnd-import-input tnd-verify-source"
                        value={sources[f.field] ?? ''}
                        onChange={(e) => editSource(f.field, e.target.value)}
                        disabled={busy}
                        placeholder="Source Text — the exact words of the PDF"
                        aria-label={`Source Text for ${f.label}`}
                      />
                    )}
                    {st.verification !== 'MISMATCH' && <VerifyNote st={st} />}
                    {needsAck && (
                      <label className="tnd-verify-ack">
                        <input type="checkbox" checked={!!acked[f.field]} disabled={busy}
                          onChange={(e) => setAcked((a) => ({ ...a, [f.field]: e.target.checked }))} />
                        I checked this value against the PDF myself
                      </label>
                    )}
                  </span>
                  <span className="tnd-import-currentcell" title={currentText(f.field)}>
                    {currentText(f.field)}
                    {!isBlank(tender[f.field]) && (
                      <span className="tnd-import-keep">{checked[f.field] ? 'will be replaced' : 'kept'}</span>
                    )}
                  </span>
                  <span className="tnd-import-source">
                    <span className="tnd-import-page">{f.sheet}</span>
                    {st.reason ? <span className={`tnd-import-reason is-${(st.status || 'OK').toLowerCase()}`}> — {st.reason}</span> : null}
                  </span>
                </div>
              );
            })}

            {COLLECTIONS.map((c) => {
              const list = rows[c.key];
              if (!list.length && !(parse[c.key] || []).length) return null;
              const statuses = rowStatuses(c.key);
              const errs = statuses.filter((r) => r.status === 'ERROR').length;
              const warns = statuses.filter((r) => r.status === 'WARNING').length;
              const ver = statuses.filter((r) => r.verification === 'VERIFIED').length;
              const unver = unverifiedRows(c.key).length;
              const mism = statuses.filter((r) => r.verification === 'MISMATCH').length;
              const waiting = unconfirmedRows(c.key).length;
              if (onlyFlagged && unver + mism === 0) return null;
              const current = currentRowCount(c.key, tender);
              const open = !!openRows[c.key] || onlyFlagged;
              return (
                <div key={c.key} className={`tnd-import-row${checked[c.key] ? ' is-checked' : ''}${errs ? ' is-error' : ''}`}>
                  <span className="tnd-import-check">
                    <input type="checkbox" checked={!!checked[c.key]} onChange={() => toggle(c.key)}
                      disabled={busy || !list.length} aria-label={`Use imported ${c.label}`} />
                  </span>
                  <span className="tnd-import-fieldcell">
                    <button type="button" className="tnd-import-field" onClick={() => toggle(c.key)}
                      disabled={busy || !list.length}>{c.label}</button>
                    <span className="tnd-import-tags">
                      <StatusPill status={errs ? 'ERROR' : warns ? 'WARNING' : 'OK'}
                        title={errs ? `${errs} row(s) in error` : warns ? `${warns} row(s) with warnings` : ''} />
                    </span>
                  </span>
                  <span className="tnd-import-valuecell">
                    <span className="tnd-import-static">
                      {plural(list.length, c)}
                      {errs > 0 && ` · ${errs} in error`}
                      {warns > 0 && ` · ${warns} with warnings`}
                    </span>
                    <span className="tnd-verify-counts">
                      {ver} verified · {unver} unverified · {mism} mismatch
                    </span>
                    <button type="button" className="tnd-import-reset tnd-import-toggle-rows"
                      onClick={() => setOpenRows((o) => ({ ...o, [c.key]: !o[c.key] }))}>
                      {open ? 'Hide rows' : 'View / edit rows'}
                    </button>
                    {checked[c.key] && unver > 0 && (
                      <label className="tnd-verify-ack tnd-verify-bulk">
                        <input type="checkbox" checked={!!bulkAck[c.key]} disabled={busy}
                          onChange={(e) => setBulkAck((b) => ({ ...b, [c.key]: e.target.checked }))} />
                        I have checked all {unver} unverified row{unver === 1 ? '' : 's'} against the PDF
                        {mism > 0 && ` (the ${mism} mismatch${mism === 1 ? '' : 'es'} must still be fixed)`}
                        <span className="tnd-muted"> — recorded in the tender history</span>
                      </label>
                    )}
                    {checked[c.key] && waiting > 0 && !bulkAck[c.key] && (
                      <span className="tnd-import-elig-warn">{waiting} unverified row{waiting === 1 ? '' : 's'} still to confirm.</span>
                    )}
                    {checked[c.key] && current > 0 && (
                      <span className="tnd-import-elig-warn">
                        {c.key === 'documents'
                          ? 'Replaces the checklist; documents you have already marked or linked are kept.'
                          : `Replaces the ${plural(current, c)} on the ${c.tab} tab.`}
                      </span>
                    )}
                  </span>
                  <span className="tnd-import-currentcell">
                    {current ? `${plural(current, c)} entered` : '—'}
                  </span>
                  {open && (
                    <div className="tnd-import-rows-wrap">
                      <TenderImportRowsEditor
                        collection={c.key}
                        rows={list}
                        statuses={statuses}
                        onChange={(next, changed) => editRows(c.key, next, changed)}
                        disabled={busy}
                        acks={rowAcks[c.key] || []}
                        onAck={(i, on) => ackRow(c.key, i, on)}
                        bulkAcked={!!bulkAck[c.key]}
                        onlyFlagged={onlyFlagged}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="tnd-modal-foot">
          <span className="tnd-muted tnd-import-foot-note">
            {validateErr ? `⚠ ${validateErr}`
              : blocking.length ? `Fix or untick before saving: ${blocking.join(', ')}`
                : unconfirmed.length ? `Confirm the unverified values, or untick them: ${unconfirmed.join(', ')}`
                  : 'Nothing is saved until you choose Apply & Save.'}
          </span>
          <button className="tnd-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="tnd-btn tnd-btn-primary" onClick={apply} disabled={!canApply}
            title={blocking.length ? 'Values in error are ticked' : unconfirmed.length ? 'Unverified values are not confirmed' : undefined}>
            {busy ? 'Saving…' : `Apply & Save (${total})`}
          </button>
        </div>
      </div>
    </div>
  );
}
