// src/Pages/BorrowerRegistry.js
//
// Landing page for the Lender module. Lays out every borrower the way the
// lender's own registry sheet does — grouped header bands over ~32 columns —
// and carries the two ways a record starts: importing a sanction letter, or
// typing one in.
//
// The table is driven entirely by COLUMN_GROUPS below. The two header rows, the
// colSpan on the loading and empty rows, and the body cells all derive from it,
// so adding a column is one line rather than four edits that fall out of step.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Upload, Search, FileText, Pencil, Trash2, AlertTriangle, Columns3,
} from 'lucide-react';
import borrowerApi from '../services/borrowerApi';
import BorrowerFormModal from '../components/borrowers/BorrowerFormModal';
import SanctionFormModal from '../components/borrowers/SanctionFormModal';
import { parseMoney, formatCrore } from '../components/borrowers/sanctionDerive';
import { SANCTION_FIELDS, latestSanction } from '../components/borrowers/sanctionFields';
import '../pages-css/BorrowerRegistry.css';

const SF = SANCTION_FIELDS.reduce((a, f) => ({ ...a, [f.key]: f }), {});

/** A column reading off the latest sanction, labelled from the field module. */
const sanctionCol = (key, extra = {}) => ({
  key,
  label: SF[key].label,
  width: SF[key].width,
  align: SF[key].align,
  get: (row, sanction) => sanction[key],
  ...extra,
});

/** A column reading off the borrower row itself. */
const borrowerCol = (key, label, extra = {}) => ({
  key,
  label,
  get: (row) => row[key],
  ...extra,
});

// The lender's sheet, band for band. `sticky` pins a column to the left edge;
// its `left` offset is accumulated in JS from the widths, so changing a width
// here keeps the header and the body aligned without touching the CSS.
//
// `compact: true` marks a column for the default view. Real letters fill maybe
// a third of the sheet, so showing all thirty-two at once is a screen of
// dashes; the rest arrive with the "Full sheet" toggle.
const COLUMN_GROUPS = [
  { id: 'number', label: 'Number', columns: [
    // A row counter, not stored data — "SL" is the serial number, and it's
    // generated here rather than kept on the record, so it always runs 1..n
    // over whatever the current search and filter left behind.
    {
      key: 'slNo',
      label: 'SL No',
      width: 62,
      align: 'right',
      sticky: true,
      compact: true,
      serial: true,
      get: (row, sanction, index) => index + 1,
    },
  ] },
  { id: 'borrower', label: 'Borrower Details', columns: [
    borrowerCol('borrowerName', 'Borrower Name', { width: 240, sticky: true, strong: true, compact: true }),
    sanctionCol('refNo', { label: 'Ref. No', width: 160, mono: true, compact: true }),
    borrowerCol('promoterName', 'Promoter Name', { width: 170 }),
    borrowerCol('sponsorName', 'Sponsor Name', { width: 170 }),
    borrowerCol('guarantorName', 'Guarantor Name', { width: 170 }),
    borrowerCol('groupName', 'Group Name', { width: 150 }),
  ] },
  { id: 'mof', label: 'Project Cost & Means of Finance', columns: [
    sanctionCol('projectCost', { compact: true }),
    sanctionCol('debtAmount', { compact: true }),
    sanctionCol('equityAmount'),
    sanctionCol('debtPct'),
    sanctionCol('equityPct'),
  ] },
  { id: 'roi', label: 'Rate of Interest', columns: [
    sanctionCol('baseRatePct'),
    sanctionCol('spreadPct'),
    sanctionCol('roiPct', { compact: true }),
  ] },
  { id: 'project', label: 'Project Details', columns: [
    sanctionCol('technology'),
    sanctionCol('village'),
    sanctionCol('district'),
    // State is the borrower's registered state, not a sanction column — the
    // sheet has one State and duplicating it per letter would only let the two
    // disagree.
    borrowerCol('state', 'State', { width: 130 }),
  ] },
  { id: 'product', label: 'Product', columns: [
    sanctionCol('instrument'),
  ] },
  { id: 'security', label: 'Security', columns: [
    sanctionCol('coObligators'),
    sanctionCol('pledgeOfSharesPct'),
  ] },
  { id: 'covenants', label: 'Financial Covenants', columns: [
    sanctionCol('minDscr'),
    sanctionCol('dsra'),
    sanctionCol('isra'),
    // A cash sweep is a covenant mechanic, not a date, so it sits here rather
    // than under Time Lines.
    sanctionCol('cashSweep'),
  ] },
  { id: 'timelines', label: 'Time Lines', columns: [
    sanctionCol('sanctionDate', { compact: true }),
    sanctionCol('disbursementDate'),
    sanctionCol('tenorText', { compact: true }),
    sanctionCol('repaymentStartDate'),
    sanctionCol('repaymentEndDate'),
    sanctionCol('scheduledCod', { label: 'Scheduled COD', compact: true }),
  ] },
  { id: 'assumptions', label: 'Base Case Assumptions', columns: [
    sanctionCol('plfPct'),
    sanctionCol('tariffPerUnit'),
  ] },
];

const FLAT_COLUMNS = COLUMN_GROUPS.flatMap((g) => g.columns);
const COMPACT_COLUMNS = FLAT_COLUMNS.filter((c) => c.compact);

// Left offsets for the pinned columns, accumulated from the widths so that
// changing a width in the config keeps header and body aligned on its own.
const stickyLeft = (columns) => {
  const out = {};
  let x = 0;
  columns.forEach((c) => {
    if (!c.sticky) return;
    out[c.key] = x;
    x += c.width || 0;
  });
  return out;
};
const LEFTS = { full: stickyLeft(FLAT_COLUMNS), compact: stickyLeft(COMPACT_COLUMNS) };

const cellProps = (c, columns, lefts, fill) => {
  const lastSticky = [...columns].reverse().find((x) => x.sticky)?.key;
  const className = [
    c.align === 'right' ? 'br-num' : '',
    c.mono ? 'br-mono' : '',
    c.serial ? 'br-serial' : '',
    c.sticky ? 'br-sticky-col' : '',
    c.key === lastSticky ? 'br-sticky-edge' : '',
  ].filter(Boolean).join(' ');
  // Nine columns fit a normal screen, so only a minimum is set and the table
  // shares the leftover width between them. Pinning an exact width there would
  // leave the columns bunched at the left with dead space beside them — an
  // inline width beats any stylesheet rule that tries to undo it.
  const style = fill ? { minWidth: c.width } : { minWidth: c.width, width: c.width };
  if (c.sticky) style.left = lefts[c.key];
  return { className, style };
};

/**
 * Blank means the document didn't say. `0` and `"0%"` are values, not blanks —
 * a 0.00% spread on a concessional facility is real, and showing it as a dash
 * would be a data error rather than a cosmetic one.
 */
const renderCell = (v) => (
  v === null || v === undefined || v === ''
    ? <span className="br-muted">—</span>
    : v
);

const BorrowerRegistry = () => {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);

  const [addBorrower, setAddBorrower] = useState(false);
  const [editBorrower, setEditBorrower] = useState(null);   // row being edited
  const [deleteTarget, setDeleteTarget] = useState(null);   // row awaiting confirmation
  const [deleting, setDeleting] = useState(false);
  const [newBorrower, setNewBorrower] = useState(null); // awaiting its first sanction
  const [review, setReview] = useState(null); // { initial, file }
  // Nine columns by default; the whole registry sheet on request.
  const [fullSheet, setFullSheet] = useState(false);

  const columns = fullSheet ? FLAT_COLUMNS : COMPACT_COLUMNS;
  const lefts = fullSheet ? LEFTS.full : LEFTS.compact;
  const totalCols = columns.length + 1;   // + the pinned Actions column

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Both filters go to the server. Filtering client-side only ever saw the
      // rows already fetched, so it silently disagreed with the counts above it.
      setRows(await borrowerApi.getAll(search, category));
    } catch (e) {
      setError(e.message || 'Could not load borrowers');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  // Category changes apply at once — a dropdown has no keystrokes to wait for.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Categories come from the whole table, not the current page of results —
  // otherwise choosing one would shrink the list it was chosen from.
  useEffect(() => {
    borrowerApi.getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const visible = rows;

  const stats = useMemo(() => {
    const total = visible.reduce(
      (sum, r) => sum + (parseMoney(r.latestSanctionedAmount) || 0), 0,
    );
    return {
      count: visible.length,
      sanctioned: formatCrore(total) || '₹0.00 Cr',
      pending: visible.filter((r) => (r.identityFilled ?? 0) < (r.identityTotal ?? 7)).length,
      overdue: visible.filter((r) => /Overdue/i.test(r.latestCodStatus || '')).length,
    };
  }, [visible]);

  /**
   * Track whether the table is scrolled away from either edge, so the pinned
   * columns only draw a divider when something is genuinely passing under them.
   * Re-run when the column set or the rows change — switching to the full sheet
   * makes the table overflow where it did not before.
   */
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      left: el.scrollLeft > 1,
      right: max > 1 && el.scrollLeft < max - 1,
    });
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener('resize', syncEdges);
    return () => window.removeEventListener('resize', syncEdges);
  }, [syncEdges, fullSheet, visible.length, loading]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again after a cancel
    if (!file) return;

    setParsing(true);
    setError('');
    try {
      const parsed = await borrowerApi.parseSanction(file);
      setReview({ initial: parsed, file });
    } catch (err) {
      setError(err.message || 'Could not read the document');
    } finally {
      setParsing(false);
    }
  };

  /**
   * Soft-deletes the borrower and, on the server, its sanctions with it — so a
   * ref no. from a deleted record doesn't block a later re-import.
   */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await borrowerApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete this borrower');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="br-page">
      <div className="br-head">
        <div className="br-head-text">
          <p className="br-crumb-static">Lender</p>
          <h1 className="br-title">Borrower Registry</h1>
        </div>
        <div className="br-head-actions">
          <button type="button" className="br-btn" onClick={() => setAddBorrower(true)}>
            <Plus size={15} aria-hidden="true" />
            Add manually
          </button>
          <button
            type="button"
            className="br-btn br-btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
          >
            <Upload size={15} aria-hidden="true" />
            {parsing ? 'Reading…' : 'Import sanction letter'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFile}
            hidden
          />
        </div>
      </div>

      {error && <div className="br-banner br-banner-danger">{error}</div>}

      <div className="br-filters">
        <div className="br-search">
          <Search size={15} className="br-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="br-input br-input-icon"
            placeholder="Search by borrower, SL ref., ref no., group, or CIN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="br-input br-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          title="Filter by the project category on a borrower's sanction letters"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* A letter states maybe a third of the registry sheet, so the other
            two-thirds default to hidden rather than filling the table with
            dashes. */}
        <button
          type="button"
          className={`br-btn ${fullSheet ? 'br-btn-active' : ''}`}
          onClick={() => setFullSheet((v) => !v)}
          title={fullSheet
            ? 'Show only the columns that usually carry a value'
            : `Show all ${FLAT_COLUMNS.length} columns of the registry sheet`}
        >
          <Columns3 size={15} aria-hidden="true" />
          {fullSheet ? 'Key columns' : 'Full sheet'}
        </button>
      </div>

      <div className="br-stats">
        <Stat label="Borrowers" value={stats.count} />
        <Stat label="Sanctioned" value={stats.sanctioned} />
        <Stat label="Details pending" value={stats.pending} />
        <Stat label="COD overdue" value={stats.overdue} />
      </div>

      <div className="br-card br-card-flush">
        <div
          className={[
            'br-table-wrap',
            edges.left ? 'br-scroll-left' : '',
            edges.right ? 'br-scroll-right' : '',
          ].filter(Boolean).join(' ')}
          ref={scrollRef}
          onScroll={syncEdges}
        >
        <table className={`br-table br-table-matrix ${fullSheet ? '' : 'br-table-compact'}`}>
          <thead>
            {/* The band row only earns its place on the full sheet. With nine
                columns drawn from six different bands it was label noise. */}
            {fullSheet && (
              <tr>
                {COLUMN_GROUPS.map((g) => (
                  <th
                    key={g.id}
                    className="br-th-group"
                    colSpan={g.columns.length}
                    scope="colgroup"
                  >
                    {g.label}
                  </th>
                ))}
                {/* An empty cell above Actions rather than a rowSpan on the
                    label. A rowSpan'd sticky cell sits between the two header
                    rows in Chrome — it painted over the band beside it and the
                    word "Actions" floated in the gap. */}
                <th className="br-sticky-right" aria-hidden="true" />
              </tr>
            )}
            <tr>
              {columns.map((c) => {
                const { className, style } = cellProps(c, columns, lefts, !fullSheet);
                return (
                  <th key={c.key} className={className} style={style} scope="col">
                    {c.label}
                  </th>
                );
              })}
              {/* Pinned right: on the full sheet, Edit and Delete would
                  otherwise need a horizontal scroll on every row. */}
              <th className="br-sticky-right br-right" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={totalCols} className="br-muted br-pad">Loading…</td></tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={totalCols} className="br-pad">
                  <div className="br-empty">
                    {search || category ? (
                      <>
                        <p><strong>No borrowers match</strong></p>
                        <p className="br-muted">
                          {search && `Nothing found for "${search}"`}
                          {search && category && ' in '}
                          {category && `category "${category}"`}
                          {category && '. Borrowers with no sanction letter have no category, '
                            + 'so they are excluded while a category is selected.'}
                        </p>
                        <button
                          type="button"
                          className="br-btn"
                          onClick={() => { setSearch(''); setCategory(''); }}
                        >
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p><strong>No borrowers yet</strong></p>
                        <p className="br-muted">
                          Import a sanction letter to create the first record, or add one manually.
                        </p>
                        <button
                          type="button"
                          className="br-btn"
                          onClick={() => fileRef.current?.click()}
                        >
                          <FileText size={15} aria-hidden="true" />
                          Import sanction letter
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && visible.map((r, i) => {
              const s = latestSanction(r);
              return (
                <tr
                  key={r.id}
                  className="br-row-click"
                  onClick={() => navigate(`/lender/borrowers/${r.id}`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/lender/borrowers/${r.id}`);
                  }}
                >
                  {columns.map((c) => {
                    const { className, style } = cellProps(c, columns, lefts, !fullSheet);
                    const v = c.get(r, s, i);
                    return (
                      <td
                        key={c.key}
                        className={`${className} ${c.strong ? 'br-cell-strong' : ''}`.trim()}
                        style={style}
                        title={c.strong || c.serial ? undefined : String(v ?? '')}
                      >
                        {c.serial ? v : renderCell(v)}
                      </td>
                    );
                  })}

                  {/* stopPropagation on the cell, not each button: the row is
                      clickable, and without it Edit would also navigate. */}
                  <td
                    className="br-sticky-right br-right"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="br-row-actions">
                      <button
                        type="button"
                        className="br-icon-btn"
                        title={`Edit ${r.borrowerName}`}
                        aria-label={`Edit ${r.borrowerName}`}
                        onClick={() => setEditBorrower(r)}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="br-icon-btn br-icon-danger"
                        title={`Delete ${r.borrowerName}`}
                        aria-label={`Delete ${r.borrowerName}`}
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {editBorrower && (
        <BorrowerFormModal
          borrower={editBorrower}
          onClose={() => setEditBorrower(null)}
          onSaved={() => { setEditBorrower(null); load(); }}
        />
      )}

      {deleteTarget && (
        <div className="br-modal-backdrop" onMouseDown={() => setDeleteTarget(null)}>
          <div
            className="br-modal br-modal-confirm"
            onMouseDown={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
          >
            <div className="br-modal-head">
              <div className="br-viewer-title">
                <AlertTriangle size={18} className="br-tone-warn" aria-hidden="true" />
                <div className="br-viewer-title-text">
                  <h3 className="br-modal-title">Delete this borrower?</h3>
                  <p className="br-modal-sub">{deleteTarget.borrowerName}</p>
                </div>
              </div>
            </div>
            <div className="br-modal-body br-modal-body-single">
              <p className="br-confirm-text">
                {deleteTarget.latestRefNo
                  ? <>Its sanction letters, including <strong>{deleteTarget.latestRefNo}</strong>,
                      and the stored documents will be removed with it.</>
                  : 'This borrower has no sanction letters recorded.'}
              </p>
              <p className="br-muted br-confirm-note">
                The record is archived rather than erased, so the reference number
                becomes free for a future import.
              </p>
            </div>
            <div className="br-modal-foot">
              <button
                type="button"
                className="br-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="br-btn br-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={15} aria-hidden="true" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {addBorrower && (
        <BorrowerFormModal
          onClose={() => setAddBorrower(false)}
          onSaved={(saved) => {
            setAddBorrower(false);
            // Identity is only half the record. Go straight on to the sanction
            // form for the borrower just created, rather than making the user
            // find it and click Add sanction — but leave it skippable, since a
            // borrower can legitimately exist before any facility does.
            if (saved?.id) setNewBorrower(saved);
            else load();
          }}
        />
      )}

      {newBorrower && (
        <SanctionFormModal
          mode="create"
          borrowerId={newBorrower.id}
          borrowerName={newBorrower.borrowerName}
          allowAttach
          onClose={() => {
            // Skipping is fine — the borrower is already saved.
            const id = newBorrower.id;
            setNewBorrower(null);
            navigate(`/lender/borrowers/${id}`);
          }}
          onSaved={(saved) => {
            const id = saved?.id || newBorrower.id;
            setNewBorrower(null);
            navigate(`/lender/borrowers/${id}`);
          }}
        />
      )}

      {review && (
        <SanctionFormModal
          mode="import"
          initial={review.initial}
          file={review.file}
          onClose={() => setReview(null)}
          onSaved={(saved) => {
            setReview(null);
            // Land on the record just created — that is where the derived
            // panel shows what the import worked out.
            if (saved?.id) navigate(`/lender/borrowers/${saved.id}`);
            else load();
          }}
        />
      )}
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="br-stat">
    <span className="br-stat-label">{label}</span>
    <span className="br-stat-value">{value}</span>
  </div>
);

export default BorrowerRegistry;