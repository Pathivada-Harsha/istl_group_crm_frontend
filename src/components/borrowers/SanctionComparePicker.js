// src/components/borrowers/SanctionComparePicker.js
//
// The entry point into the standalone Borrower Comparison module — a
// checkbox picker over every sanction letter the logged-in user is allowed
// to see (server-scoped, same rule as the rest of the Borrower Registry;
// see borrowerApi.compareSummary / BorrowerService.getSanctionsCompareSummary).
// Modeled on BomItemPicker.js's search + select-all + checkbox pattern.
// Read-only: it only ever collects ids and hands them to onCompare — no
// create/edit/delete action lives here.

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Search, AlertTriangle,
} from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import FilterSelect from '../Dropdowns/FilterSelect';
import '../../pages-css/BorrowerComparison.css';

const MIN_TO_COMPARE = 2;
const MAX_TO_COMPARE = 20;

const uniqueOptions = (rows, key) => {
  const seen = new Set();
  const opts = [];
  rows.forEach((r) => {
    const v = r[key];
    if (!v || seen.has(v)) return;
    seen.add(v);
    opts.push({ value: v, label: v });
  });
  return opts.sort((a, b) => a.label.localeCompare(b.label));
};

const SanctionComparePicker = ({ onClose, onCompare, initialSelectedIds = [] }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [lenderFilter, setLenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const [selected, setSelected] = useState(() => new Set(initialSelectedIds));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await borrowerApi.compareSummary();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load sanction letters.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const groupOptions = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => {
      if (r.parentGroupId && !seen.has(r.parentGroupId)) seen.set(r.parentGroupId, r.parentGroupName);
      if (r.subGroupId && !seen.has(r.subGroupId)) seen.set(r.subGroupId, r.subGroupName);
    });
    return [...seen.entries()]
      .map(([value, label]) => ({ value: String(value), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);
  const statusOptions = useMemo(() => uniqueOptions(rows, 'status'), [rows]);
  const lenderOptions = useMemo(() => uniqueOptions(rows, 'lenderName'), [rows]);
  const projectOptions = useMemo(() => uniqueOptions(rows, 'projectName'), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (groupFilter && String(r.parentGroupId) !== groupFilter && String(r.subGroupId) !== groupFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (lenderFilter && r.lenderName !== lenderFilter) return false;
      if (projectFilter && r.projectName !== projectFilter) return false;
      if (!q) return true;
      return [r.associatedWithName, r.cin, r.projectName, r.refNo]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [rows, search, groupFilter, statusFilter, lenderFilter, projectFilter]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_TO_COMPARE) next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (next.size >= MAX_TO_COMPARE) break;
        next.add(r.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleCompare = () => {
    if (selected.size < MIN_TO_COMPARE) return;
    onCompare([...selected]);
  };

  return (
    <div className="scp-overlay" onClick={onClose}>
      <div className="scp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scp-header">
          <div>
            <div className="scp-title">Select Sanctions to Compare</div>
            <p className="scp-subtitle">Choose multiple sanction letters (based on your access permissions)</p>
          </div>
          <button type="button" className="scp-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="scp-toolbar">
          <div className="scp-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by borrower name, project, CIN, sanction ref no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="scp-filter-row">
          <FilterSelect value={groupFilter} onChange={setGroupFilter} options={groupOptions} placeholder="All Groups" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="All Status" />
          <FilterSelect value={lenderFilter} onChange={setLenderFilter} options={lenderOptions} placeholder="All Lenders" />
          <FilterSelect value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All Projects" />
          <div className="scp-toolbar-actions">
            <button type="button" className="scp-link-btn" onClick={selectAllVisible}>Select all</button>
            <button type="button" className="scp-link-btn" onClick={clearSelection}>Clear</button>
          </div>
        </div>

        <div className="scp-body">
          {loading && <div className="scp-state">Loading sanction letters…</div>}

          {!loading && error && (
            <div className="scp-state scp-state-error">
              <AlertTriangle size={16} aria-hidden="true" /> {error}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="scp-state">No sanction letters are available to compare yet.</div>
          )}

          {!loading && !error && rows.length > 0 && visible.length === 0 && (
            <div className="scp-state">No sanction letters match the current search/filters.</div>
          )}

          {!loading && !error && visible.length > 0 && (
            <table className="scp-table">
              <thead>
                <tr>
                  <th className="scp-check-col">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
                      onChange={(e) => (e.target.checked ? selectAllVisible() : clearSelection())}
                      aria-label="Select all visible"
                    />
                  </th>
                  <th className="scp-num-col">#</th>
                  <th>Borrower / Group</th>
                  <th>Sanction Reference</th>
                  <th>Sanction Date</th>
                  <th className="scp-num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const isChecked = selected.has(r.id);
                  return (
                    <tr key={r.id} className={isChecked ? 'scp-row-selected' : ''} onClick={() => toggle(r.id)}>
                      <td className="scp-check-col">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(r.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="scp-num-col">{i + 1}</td>
                      <td>{r.associatedWithName || '—'}</td>
                      <td>{r.refNo || '—'}</td>
                      <td>{r.sanctionDate || '—'}</td>
                      <td className="scp-num">{r.sanctionedAmount || '—'}</td>
                      <td><span className="scp-status-chip">{r.status || '—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="scp-footer">
          <div className="scp-footer-note">
            {selected.size > 0
              ? `${selected.size} sanction${selected.size === 1 ? '' : 's'} selected`
              : `Select at least ${MIN_TO_COMPARE} sanction letters to compare.`}
          </div>
          <div className="scp-footer-actions">
            <button type="button" className="scp-btn scp-btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="scp-btn scp-btn-primary"
              disabled={selected.size < MIN_TO_COMPARE}
              onClick={handleCompare}
            >
              Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SanctionComparePicker;
