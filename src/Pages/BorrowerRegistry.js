// src/Pages/BorrowerRegistry.js
//
// Landing page for the Lender module. Lists every borrower with its latest
// sanction and how much of the identity block is filled, and carries the two
// ways a record starts: importing a sanction letter, or typing one in.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search, FileText } from 'lucide-react';
import borrowerApi from '../services/borrowerApi';
import BorrowerFormModal from '../components/borrowers/BorrowerFormModal';
import SanctionFormModal from '../components/borrowers/SanctionFormModal';
import { parseMoney, formatCrore } from '../components/borrowers/sanctionDerive';
import '../pages-css/BorrowerRegistry.css';

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
  const [newBorrower, setNewBorrower] = useState(null); // awaiting its first sanction
  const [review, setReview] = useState(null); // { initial, file }

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

  return (
    <div className="br-page">
      <div className="br-head">
        <div className="br-head-text">
          <p className="br-crumb-static">Lender</p>
          <h1 className="br-title">Borrower registry</h1>
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
            placeholder="Search by borrower, ref no., or CIN"
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
      </div>

      <div className="br-stats">
        <Stat label="Borrowers" value={stats.count} />
        <Stat label="Sanctioned" value={stats.sanctioned} />
        <Stat label="Details pending" value={stats.pending} />
        <Stat label="COD overdue" value={stats.overdue} />
      </div>

      <div className="br-card br-card-flush">
        <div className="br-table-wrap">
        <table className="br-table br-table-list">
          <thead>
            <tr>
              <th>Borrower</th>
              <th>Ref no.</th>
              <th>Sanctioned</th>
              <th>COD</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="br-muted br-pad">Loading…</td></tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={5} className="br-pad">
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

            {!loading && visible.map((r) => {
              const filled = r.identityFilled ?? 0;
              const total = r.identityTotal ?? 7;
              const complete = filled >= total;
              const overdue = /Overdue/i.test(r.latestCodStatus || '');
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
                  <td>
                    <span className="br-row-name">{r.borrowerName}</span>
                    <span className="br-row-sub">
                      {[r.latestCategory, r.city].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </td>
                  <td className={r.latestRefNo ? 'br-mono' : 'br-muted'}>
                    {r.latestRefNo || 'Not sanctioned'}
                  </td>
                  <td className={r.latestSanctionedAmount ? '' : 'br-muted'}>
                    {r.latestSanctionedAmount || '—'}
                  </td>
                  <td className={overdue ? 'br-tone-warn' : 'br-muted'}>
                    {overdue ? 'Overdue' : (r.latestScheduledCod || '—')}
                  </td>
                  <td>
                    <span className={`br-chip ${complete ? 'br-chip-ok' : 'br-chip-warn'}`}>
                      {complete ? 'Complete' : `${filled} of ${total}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

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