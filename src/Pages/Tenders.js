// ─────────────────────────────────────────────────────────────────────────────
//  Tenders.js — Tendering module.
//
//  Container that renders either the tender REGISTER (stat tiles + filters +
//  table/grid, mirroring the Leads list) or the full-page 7-tab TENDER DETAIL.
//  Data comes from the Spring Boot API (/tender via tenderApi); the list is held
//  in React state and refreshed after edits.
//
//  UI parity with Leads-Enquire: same table shell, draggable + sortable column
//  headers, Columns chooser, table/grid view toggle, card styling and pagination
//  — all reusing Leads-Enquire.css so colours stay consistent. Leads pages on the
//  server; tenders load in full, so the identical controls are driven CLIENT-side.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../pages-css/Leads-Enquire.css';   // reuse list/table/badge/card/pagination shell
import '../pages-css/Tenders.css';          // tender-only widgets
import FilterSelect from '../components/Dropdowns/FilterSelect';
import TenderDetail from '../components/tenders/TenderDetail';
import tenderApi from '../services/tenderApi';
import { useAuth } from '../hooks/useAuth';
import {
  newTender, hydrateTender, TENDER_STATUSES, FINANCIAL_YEARS,
  boqBidTotal, fmtINR, fmtINRShort, fmtDate, isOverdue, statusBadgeClass,
} from '../services/tenderData';

// ─── Columns ────────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'tender',           label: 'Tender',           sortable: true,  required: true  },
  { key: 'issuingAuthority', label: 'Issuing Authority', sortable: true,  required: false },
  { key: 'clientCompany',    label: 'Client',            sortable: true,  required: false },
  { key: 'sector',           label: 'Sector',            sortable: true,  required: false },
  { key: 'source',           label: 'Source',            sortable: true,  required: false },
  { key: 'location',         label: 'Location',          sortable: true,  required: false },
  { key: 'financialYear',    label: 'FY',                sortable: true,  required: false },
  { key: 'bidValue',         label: 'Bid Value',         sortable: true,  required: false },
  { key: 'contractValue',    label: 'Contract Value',    sortable: true,  required: false },
  { key: 'deadline',         label: 'Deadline',          sortable: true,  required: false },
  { key: 'status',           label: 'Status',            sortable: true,  required: true  },
  { key: 'project',          label: 'Project',           sortable: false, required: false },
];
const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);
// Keep the default table close to what it showed before — the rest are one
// click away in the Columns chooser.
const DEFAULT_VISIBLE = ALL_COLUMNS
  .filter((c) => !['clientCompany', 'location', 'financialYear'].includes(c.key))
  .map((c) => c.key);

// Comparable value per column for client-side sorting (numbers stay numeric so
// money/dates sort properly rather than lexically).
const sortValue = (t, key) => {
  switch (key) {
    case 'tender':        return String(t.tenderName || '').toLowerCase();
    case 'bidValue':      return boqBidTotal(t) || 0;
    case 'contractValue': return Number(t.contractValue) || 0;
    case 'deadline':      return t.submissionDeadline || '';
    case 'project':       return String(t.projectId || '').toLowerCase();
    default:              return String(t[key] ?? '').toLowerCase();
  }
};
const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number'
  ? a - b
  : String(a).localeCompare(String(b)));

// ─── Column Visibility Dropdown (mirrors Leads) ─────────────────────────────
const ColumnVisibilityDropdown = ({ columns, visibleColumns, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const hiddenCount = columns.filter((c) => !c.required && !visibleColumns.includes(c.key)).length;
  return (
    <div className="col-visibility-wrapper" ref={ref}>
      <button className={`col-visibility-btn ${hiddenCount > 0 ? 'has-hidden' : ''}`} onClick={() => setOpen((o) => !o)}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Columns
        {hiddenCount > 0 && <span className="col-visibility-badge">{hiddenCount}</span>}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="col-visibility-dropdown">
          <div className="col-visibility-header">
            <span>Toggle Columns</span>
            <button className="col-visibility-reset" onClick={onReset}>Reset</button>
          </div>
          <div className="col-visibility-list">
            {columns.map((col) => (
              <label key={col.key} className={`col-visibility-item ${col.required ? 'col-required' : ''}`}>
                <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => !col.required && onToggle(col.key)} disabled={col.required} />
                <span className="col-visibility-label">{col.label}</span>
                {col.required && <span className="col-required-tag">required</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Draggable + sortable header cell (mirrors Leads) ───────────────────────
const DraggableHeaderCell = ({ col, index, getSortIcon, handleSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) => (
  <th
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    onDragEnd={onDragEnd}
    data-col={col.key}
    className={`col-draggable${isDragOver ? ' col-drag-over' : ''}`}
    onClick={() => col.sortable && handleSort(col.key)}
    style={{ cursor: col.sortable ? 'pointer' : 'grab' }}
  >
    <div className="th-content">
      <span className="col-drag-handle" title="Drag to reorder">
        <svg fill="currentColor" viewBox="0 0 24 24" width="10" height="10">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>
      {col.label}
      {col.sortable && getSortIcon(col.key)}
    </div>
  </th>
);

// ─── Pagination (same markup as Leads' ServerPagination, client-side driven) ──
const Pagination = ({ startRecord, endRecord, totalRecords, currentPage, totalPages, rowsPerPage, onPageChange, onRowsPerPageChange }) => {
  const tp = totalPages || 1;
  const pages = [];
  const left = Math.max(1, currentPage - 2);
  const right = Math.min(tp, currentPage + 2);
  for (let i = left; i <= right; i++) pages.push(i);
  return (
    <div className="leads-enquiries-pagination">
      <div className="leads-enquiries-pagination-info">
        <span style={{ whiteSpace: 'nowrap' }}>Rows per page:</span>
        <FilterSelect
          value={String(rowsPerPage)}
          onChange={(v) => onRowsPerPageChange(Number(v))}
          options={[{ value: '10', label: '10 rows' }, { value: '20', label: '20 rows' }, { value: '50', label: '50 rows' }, { value: '100', label: '100 rows' }]}
          placeholder="Rows"
        />
        <span style={{ whiteSpace: 'nowrap' }}>
          {totalRecords === 0 ? 'No records' : `${startRecord}–${endRecord} of ${totalRecords} tenders`}
        </span>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          Page <strong>{currentPage}</strong> of <strong>{tp}</strong>
        </span>
      </div>
      <div className="leads-enquiries-pagination-buttons">
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</button>
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</button>
        {pages.map((p) => (
          <button key={p} className={`leads-enquiries-pagination-btn${p === currentPage ? ' leads-enquiries-pagination-btn-active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === tp}>›</button>
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(tp)} disabled={currentPage === tp}>»</button>
      </div>
    </div>
  );
};

export default function Tenders() {
  const { pagePermissions } = useAuth();
  const perms = pagePermissions?.TENDERS || [];
  const canView = perms.includes('VIEW');
  const canCreate = perms.includes('CREATE');
  const canEdit = perms.includes('EDIT');

  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // detail view — a stable key keeps the detail mounted across saves (so a new
  // tender getting its server id doesn't remount and reset the active tab)
  const [view, setView] = useState('list');
  const detailInitialRef = useRef(null);
  const [detailKey, setDetailKey] = useState(0);
  const [detailIsNew, setDetailIsNew] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fyFilter, setFyFilter] = useState('All');

  // ── list UI state (table/grid, columns, sort, paging) ─────────────────
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('tenders_view_mode') || 'table');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ── data ──────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const data = await tenderApi.getAll();
      setTenders(data.map(hydrateTender));
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load tenders');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openTender = (t) => { detailInitialRef.current = t; setDetailIsNew(false); setDetailKey((k) => k + 1); setView('detail'); };
  const openNew = () => { detailInitialRef.current = newTender(); setDetailIsNew(true); setDetailKey((k) => k + 1); setView('detail'); };
  const backToList = () => { setView('list'); load(); };

  const createTender = async (working) => {
    const saved = hydrateTender(await tenderApi.create(working));
    setTenders((prev) => [saved, ...prev]);
    return saved;
  };
  const updateTender = async (id, working) => {
    const saved = hydrateTender(await tenderApi.update(id, working));
    setTenders((prev) => prev.map((t) => (t.id === id ? saved : t)));
    return saved;
  };

  // ── stat tiles ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const won = tenders.filter((t) => t.status === 'Won');
    const lost = tenders.filter((t) => t.status === 'Lost');
    const submitted = tenders.filter((t) => t.status === 'Submitted');
    const preparing = tenders.filter((t) => t.status === 'Preparing');
    const decided = won.length + lost.length;
    return {
      total: tenders.length,
      won: won.length,
      submitted: submitted.length,
      preparing: preparing.length,
      winRate: decided ? Math.round((won.length / decided) * 100) : 0,
      wonValue: won.reduce((s, t) => s + (Number(t.contractValue) || 0), 0),
    };
  }, [tenders]);

  // ── filtered + sorted rows ────────────────────────────────────────────
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenders.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (fyFilter !== 'All' && t.financialYear !== fyFilter) return false;
      if (!q) return true;
      return [t.tenderName, t.tenderNumber, t.issuingAuthority, t.clientCompany, t.location]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [tenders, search, statusFilter, fyFilter]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((x, y) => dir * cmp(sortValue(x, sortColumn), sortValue(y, sortColumn)));
  }, [rows, sortColumn, sortDirection]);

  // ── paging (client-side) ──────────────────────────────────────────────
  const totalRecords = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = sortedRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const startRecord = totalRecords === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const endRecord = Math.min(safePage * rowsPerPage, totalRecords);

  // A changed filter/search/page-size always restarts at page 1.
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, fyFilter, rowsPerPage]);

  // ── column + sort handlers ────────────────────────────────────────────
  const orderedVisibleColumns = columnOrder
    .map((k) => ALL_COLUMNS.find((c) => c.key === k))
    .filter((c) => c && (c.required || visibleColumns.includes(c.key)));

  const handleSort = (col) => {
    const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col); setSortDirection(dir); setCurrentPage(1);
  };
  const getSortIcon = (col) => {
    if (sortColumn !== col) return <svg className="sort-icon sort-icon-default" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortDirection === 'asc'
      ? <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  const handleColDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(idx); };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisibleColumns.map((c) => c.key);
    const fromKey = visKeys[fromIdx], toKey = visKeys[dropIdx];
    const o = [...columnOrder];
    const a = o.indexOf(fromKey), b = o.indexOf(toKey);
    o.splice(a, 1); o.splice(b, 0, fromKey);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd = (e) => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };

  const handleToggleColumn = (k) => setVisibleColumns((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const handleResetColumns = () => { setColumnOrder(DEFAULT_ORDER); setVisibleColumns(DEFAULT_VISIBLE); };

  const switchView = (mode) => { setViewMode(mode); localStorage.setItem('tenders_view_mode', mode); };

  // ── cell renderer ─────────────────────────────────────────────────────
  const renderCell = (t, key) => {
    switch (key) {
      case 'tender': return (
        <>
          <div className="tnd-cell-title" title={t.tenderName || ''}>{t.tenderName || '—'}</div>
          <div className="tnd-muted tnd-cell-sub" title={t.tenderNumber || ''}>{t.tenderNumber}</div>
        </>
      );
      case 'bidValue': return <span className="tnd-money">{boqBidTotal(t) > 0 ? fmtINR(boqBidTotal(t)) : '—'}</span>;
      case 'contractValue': return <span className="tnd-money">{t.contractValue ? fmtINR(t.contractValue) : '—'}</span>;
      case 'deadline': return (
        <div className="tnd-cell-stack">
          <span className="tnd-deadline-date">{fmtDate(t.submissionDeadline)}</span>
          {isOverdue(t) && <span className="tnd-overdue-pill">⚠ OVERDUE</span>}
        </div>
      );
      case 'status': return <span className={`leads-enquiries-badge ${statusBadgeClass(t.status)}`}>{t.status}</span>;
      case 'project': return t.projectId
        ? <span className="tnd-link-chip" title="Linked project">🔗 {t.projectId}</span>
        : <span className="tnd-muted">—</span>;
      default: return t[key] || '—';
    }
  };

  // ── permission gate ───────────────────────────────────────────────────
  if (!canView) {
    return (
      <div className="leads-enquiries-container">
        <div className="leads-enquiries-breadcrumb">
          <span>Sales</span>
          <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
          <span className="leads-enquiries-breadcrumb-active">Tenders</span>
        </div>
        <div className="tnd-empty" style={{ marginTop: 20 }}>
          You don't have permission to view Tenders. Ask an admin to grant the <code>tenders.view</code> permission
          (then re-login).
        </div>
      </div>
    );
  }

  // ── DETAIL view ───────────────────────────────────────────────────────
  if (view === 'detail' && detailInitialRef.current) {
    return (
      <TenderDetail
        key={detailKey}
        initial={detailInitialRef.current}
        isNew={detailIsNew}
        canCreate={canCreate}
        canEdit={canEdit}
        onCreate={createTender}
        onUpdate={updateTender}
        onBack={backToList}
      />
    );
  }

  // ── LIST view ─────────────────────────────────────────────────────────
  const tiles = [
    { label: 'Total Tenders', value: stats.total, color: '#64748b' },
    { label: 'Won', value: stats.won, color: '#16a34a' },
    { label: 'Submitted', value: stats.submitted, color: '#7c3aed' },
    { label: 'Preparing', value: stats.preparing, color: '#2563eb' },
    { label: 'Win Rate', value: `${stats.winRate}%`, color: '#0d9488' },
    { label: 'Won Contract Value', value: fmtINRShort(stats.wonValue), color: '#16a34a' },
  ];

  const pager = (
    <Pagination
      startRecord={startRecord}
      endRecord={endRecord}
      totalRecords={totalRecords}
      currentPage={safePage}
      totalPages={totalPages}
      rowsPerPage={rowsPerPage}
      onPageChange={setCurrentPage}
      onRowsPerPageChange={setRowsPerPage}
    />
  );

  return (
    <div className="leads-enquiries-container">
      {/* Breadcrumb */}
      <div className="leads-enquiries-breadcrumb">
        <span>Sales</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Tenders</span>
      </div>

      {/* Header */}
      <div className="leads-enquiries-header">
        <div className="leads-enquiries-title-with-icon"><h1>Tenders</h1></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stat tiles */}
      <div className="tnd-stats">
        {tiles.map((s) => (
          <div key={s.label} className="tnd-stat-card">
            <span className="tnd-stat-label">{s.label}</span>
            <span className="tnd-stat-value">{s.value}</span>
            <span className="tnd-stat-accent" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="leads-enquiries-action-bar">
        <div className="leads-enquiries-search-wrapper">
          <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by tender, number, authority, client…"
            className="leads-enquiries-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="leads-enquiries-filters">
          <FilterSelect
            value={statusFilter}
            options={[{ value: 'All', label: 'All Status' }, ...TENDER_STATUSES.map((s) => ({ value: s, label: s }))]}
            placeholder="All Status"
            onChange={setStatusFilter}
          />
          <FilterSelect
            value={fyFilter}
            options={[{ value: 'All', label: 'All Financial Years' }, ...FINANCIAL_YEARS.map((s) => ({ value: s, label: `FY ${s}` }))]}
            placeholder="All Financial Years"
            onChange={setFyFilter}
          />
        </div>
        <div className="leads-enquiries-action-buttons">
          <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {canCreate && (
            <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={openNew}>
              <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Tender
            </button>
          )}
        </div>
      </div>

      {/* View toggle + column controls */}
      <div className="leads-enquiries-view-toggle-container">
        {viewMode === 'table' && (
          <ColumnVisibilityDropdown columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
        )}
        <div className="leads-enquiries-view-toggle">
          <button className={`leads-enquiries-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => switchView('table')} title="Table View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Table
          </button>
          <button className={`leads-enquiries-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => switchView('grid')} title="Grid View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Grid
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="leads-enquiries-table-card tnd-table-card">
          <div className="leads-enquiries-table-wrapper">
            <table className="leads-enquiries-table">
              <thead>
                <tr>
                  <th className="ld-sno-th">S.No</th>
                  {orderedVisibleColumns.map((col, idx) => (
                    <DraggableHeaderCell
                      key={col.key} col={col} index={idx}
                      getSortIcon={getSortIcon} handleSort={handleSort}
                      onDragStart={handleColDragStart} onDragOver={handleColDragOver}
                      onDrop={handleColDrop} onDragEnd={handleColDragEnd}
                      isDragOver={dragOverIndex === idx}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={orderedVisibleColumns.length + 1} className="text-center py-4">Loading tenders…</td></tr>
                ) : pagedRows.length === 0 ? (
                  <tr><td colSpan={orderedVisibleColumns.length + 1} className="text-center py-4">No tenders found</td></tr>
                ) : pagedRows.map((t, rowIndex) => (
                  <tr key={t.id} className="leads-enquiries-clickable-row" style={{ cursor: 'pointer' }} onClick={() => openTender(t)}>
                    <td className="ld-sno-td">{(safePage - 1) * rowsPerPage + rowIndex + 1}</td>
                    {orderedVisibleColumns.map((col) => (
                      <td key={col.key} data-col={col.key}>{renderCell(t, col.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pager}
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="leads-enquiries-grid-container tnd-grid-container">
          <div className="leads-enquiries-grid tnd-grid">
            {loading ? (
              <div className="tnd-empty">Loading tenders…</div>
            ) : pagedRows.length === 0 ? (
              <div className="tnd-empty">No tenders found</div>
            ) : pagedRows.map((t) => (
              <div key={t.id} className="leads-enquiries-card tnd-card">
                <div className="leads-enquiries-card-clickable" onClick={() => openTender(t)} style={{ cursor: 'pointer' }}>
                  <div className="leads-enquiries-card-header">
                    <div className="leads-enquiries-card-id">{t.tenderNumber || '—'}</div>
                    <div className="leads-enquiries-card-badges">
                      {isOverdue(t) && <span className="tnd-overdue-pill">⚠ OVERDUE</span>}
                      <span className={`leads-enquiries-badge ${statusBadgeClass(t.status)}`}>{t.status}</span>
                    </div>
                  </div>
                  <div className="leads-enquiries-card-body">
                    <h3 className="leads-enquiries-card-title">{t.tenderName || 'Untitled tender'}</h3>
                    <div className="leads-enquiries-card-info">
                      {t.issuingAuthority && (
                        <div className="leads-enquiries-card-info-item">
                          <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span>{t.issuingAuthority}</span>
                        </div>
                      )}
                      {t.location && (
                        <div className="leads-enquiries-card-info-item">
                          <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>{t.location}</span>
                        </div>
                      )}
                      <div className="leads-enquiries-card-info-item">
                        <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span>Due {fmtDate(t.submissionDeadline)}</span>
                      </div>
                      {boqBidTotal(t) > 0 && (
                        <div className="leads-enquiries-card-info-item">
                          <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span>Bid {fmtINR(boqBidTotal(t))}</span>
                        </div>
                      )}
                      {t.contractValue ? (
                        <div className="leads-enquiries-card-info-item">
                          <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span>Contract {fmtINR(t.contractValue)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="leads-enquiries-card-footer" onClick={(e) => e.stopPropagation()}>
                  <div className="leads-enquiries-card-source">
                    <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    {t.source || '—'}
                  </div>
                  {t.projectId && (
                    <div className="leads-enquiries-card-owner">
                      <span className="tnd-link-chip" title="Linked project">🔗 {t.projectId}</span>
                    </div>
                  )}
                  <div className="leads-enquiries-card-actions">
                    <button className="leads-enquiries-card-action-btn leads-enquiries-action-view" onClick={() => openTender(t)} title="Open tender">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pager}
        </div>
      )}
    </div>
  );
}
