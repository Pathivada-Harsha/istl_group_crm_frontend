// src/Pages/ProjectsList.js
//
// Projects module — LIST page (route: /projects).
// Mirrors Pages/OrderBook.js: shared Group/Category filter top-right, 4 summary
// stat cards, a Search + Status filter bar, a table/grid view toggle persisted
// to localStorage, and — in table view — the SAME table mechanics as Order Book:
// a Columns show/hide picker, drag-and-drop column reordering, and click-to-sort
// on each column. Row/card click opens /projects/:projectUniqueId.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaColumns } from 'react-icons/fa';
import projectsApi from '../services/projectsApi.js';
import FilterSelect from '../components/Dropdowns/FilterSelect.js';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import { techProgressPct, NO_TECH_PROGRESS } from '../utils/projectProgress.js';
import '../pages-css/OrderBook.css';
import '../pages-css/Projects.css';

// Status colour map — copied from Pages/ProjectDashboard.js getStatusColor.
const getStatusColor = (s) => ({
  NOT_STARTED: '#64748b', PLANNING: '#f59e0b', IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444',
}[s] || '#94a3b8');

const STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'PLANNING',    label: 'Planning' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED',   label: 'Completed' },
  { value: 'ON_HOLD',     label: 'On Hold' },
  { value: 'CANCELLED',   label: 'Cancelled' },
];

const statusLabel = (s) =>
  STATUS_OPTIONS.find(o => o.value === s)?.label || (s ? String(s).replace(/_/g, ' ') : '-');

// Progress-fill colour by status: green COMPLETED, amber ON_HOLD, else accent blue.
const progressColor = (s) => (s === 'COMPLETED' ? '#22c55e' : s === 'ON_HOLD' ? '#f59e0b' : '#3b82f6');

// Group pill flavour from the group name (EPC blue / IoT green / CBG amber).
// Still used by the table's Group column (the grid card no longer shows a pill).
const groupPillClass = (groupName) => {
  const g = String(groupName || '').toUpperCase();
  if (g.includes('EPC')) return 'pl-group-pill pl-group-pill--epc';
  if (g.includes('IOT')) return 'pl-group-pill pl-group-pill--iot';
  if (g.includes('CBG')) return 'pl-group-pill pl-group-pill--cbg';
  return 'pl-group-pill';
};

const fmtMoney = (n) => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
// Compact money for dense cells/cards — ₹1.2 Cr / ₹4.5 L / ₹32,000.
const fmtMoneyShort = (n) => {
  const v = Number(n || 0);
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  return sign + '₹' + a.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

// ── Financial helpers ───────────────────────────────────────────────────────
// Semantics match the project dashboard: received = paid_invoice_value (cash in
// from the customer), spent = paid_bill_value (cash out to vendors), billed =
// total_invoice_value, payable = total_bill_value. Balance = received − spent.
const moneyIn      = (p) => Number(p.paidInvoiceValue  || 0);
const moneyOut     = (p) => Number(p.paidBillValue     || 0);
const billedAmt    = (p) => Number(p.totalInvoiceValue || 0);
const payableAmt   = (p) => Number(p.totalBillValue    || 0);
const balanceAmt   = (p) => (p.balance !== undefined && p.balance !== null)
  ? Number(p.balance) : moneyIn(p) - moneyOut(p);
// % of budget collected from the customer — capped at 100 for the meter.
const collectedPct = (p) => {
  const b = Number(p.budget || 0);
  if (b <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((moneyIn(p) / b) * 100)));
};

const MONEY_IN_COLOR  = '#16a34a';   // received — green
const MONEY_OUT_COLOR = '#dc2626';   // spent    — red
const balanceColor = (v) => (v < 0 ? MONEY_OUT_COLOR : v > 0 ? MONEY_IN_COLOR : '#64748b');
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// A project is overdue when its end date has passed and it is neither
// finished nor cancelled. Cancelled projects are not "late", they are closed.
const isOverdue = (p) => {
  if (!p.endDate) return false;
  if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
  const end = new Date(p.endDate);
  if (isNaN(end)) return false;
  return end.getTime() < Date.now();
};

const daysOverdue = (p) => {
  const end = new Date(p.endDate);
  return Math.max(0, Math.floor((Date.now() - end.getTime()) / 86400000));
};

// Rows-per-page options (mirrors the Leads / Enquiries page selector).
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const FIN_COLOR = '#8b5cf6'; // financial progress = purple (distinct from technical/status)

// Two stacked mini-bars — Technical (status colour) + Financial (purple) — shown
// together. `tech` is null for a project with no scope: empty bar, "—", no number.
const DualProgress = ({ tech, fin, techColor }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
    {[['Tech', tech, techColor], ['Fin', fin, FIN_COLOR]].map(([label, val, color]) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        title={val == null ? 'No technical scope defined for this project' : undefined}>
        <span style={{ fontSize: 10, color: '#94a3b8', width: 24, flexShrink: 0 }}>{label}</span>
        <div className="pl-progress" style={{ flex: 1 }}><div className="pl-progress-fill" style={{ width: `${val ?? 0}%`, background: color }} /></div>
        <span className="pl-progress-pct" style={{ minWidth: 34, textAlign: 'right' }}>
          {val == null ? NO_TECH_PROGRESS : `${val}%`}
        </span>
      </div>
    ))}
  </div>
);

// Column catalogue (order + labels) for the picker and default ordering.
const COLUMN_DEFS = [
  { key: 'sno',      label: 'S.No' },
  { key: 'projId',   label: 'Project ID' },
  { key: 'name',     label: 'Project Name' },
  { key: 'customer', label: 'Customer' },
  { key: 'group',    label: 'Group' },
  { key: 'subGroup', label: 'Sub Group' },
  { key: 'status',   label: 'Status' },
  { key: 'budget',   label: 'Budget' },
  { key: 'billed',   label: 'Billed' },
  { key: 'received', label: 'Received' },
  { key: 'payable',  label: 'Payable' },
  { key: 'spent',    label: 'Spent' },
  { key: 'balance',  label: 'Balance' },
  { key: 'progress', label: 'Progress' },
  { key: 'timeline', label: 'Timeline' },
];

function ProjectsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, removeToast, showError } = useToast();

  // Shared group/category filter (same contract used by OrderBook, dashboards…)
  const { groupName, subGroupName, updateFilters, resetFilters } = useGroupProjectFilters();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  // Local filters (apply-on-change)
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('projects_view_mode') || 'table');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const changeRowsPerPage = (n) => { setRowsPerPage(n); setCurrentPage(1); };
  const setView = (mode) => { setViewMode(mode); localStorage.setItem('projects_view_mode', mode); };

  // ── Table mechanics (mirror OrderBook): sort + column order + visibility ────
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnOrder, setColumnOrder] = useState(COLUMN_DEFS.map(c => c.key));
  // Financial columns: Received / Spent / Balance are on by default (the
  // money-in-vs-money-out story); Billed / Payable are opt-in via the picker.
  const [visibleColumns, setVisibleColumns] = useState({
    sno: true, projId: true, name: true, customer: false, group: true,
    subGroup: false, status: true, budget: true, billed: false, received: true,
    payable: false, spent: true, balance: true, progress: true, timeline: true,
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const dragCol = useRef(null);
  const dragOverCol = useRef(null);

  const toggleColumnVisibility = (key) =>
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleDragStart = (key) => { dragCol.current = key; };
  const handleDragEnter = (key) => { dragOverCol.current = key; };
  const handleDragEnd = () => {
    const from = dragCol.current, to = dragOverCol.current;
    if (!from || !to || from === to) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(from), ti = next.indexOf(to);
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragCol.current = null;
    dragOverCol.current = null;
  };

  // ── Load projects whenever filters change (debounced on search) ─────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.listProjects({
        search: search.trim() || undefined,
        groupId: groupName || undefined,       // group NAME; backend matches name or id
        subGroupName: subGroupName || undefined,
        status: status || undefined,
      });
      setProjects(Array.isArray(data) ? data : (data?.data || []));
      setCurrentPage(1);
    } catch (err) {
      showError(err.message || 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, groupName, subGroupName, status, user?.id]);

  useEffect(() => {
    const t = setTimeout(fetchProjects, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchProjects, search]);

  const clearFilters = () => {
    setSearch(''); setStatus('');
    resetFilters();   // clears the shared group/sub-group filter
  };
  const hasFilters = search || groupName || subGroupName || status;

  // ── Summary stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter(p => p.status === 'IN_PROGRESS').length;
    const completed = projects.filter(p => p.status === 'COMPLETED').length;
    const totalBudget   = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
    const totalBilled   = projects.reduce((s, p) => s + billedAmt(p), 0);
    const totalReceived = projects.reduce((s, p) => s + moneyIn(p), 0);
    const totalSpent    = projects.reduce((s, p) => s + moneyOut(p), 0);
    return {
      total, inProgress, completed, totalBudget,
      totalBilled, totalReceived, totalSpent,
      totalBalance: totalReceived - totalSpent,
      pendingReceipts: Math.max(0, totalBilled - totalReceived),
    };
  }, [projects]);

  // ── Sort → paginate ─────────────────────────────────────────────────────────
  const sortedProjects = useMemo(() => {
    if (!sortConfig.key) return projects;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const getVal = (o, key) => ({
      projId:   o.projectUniqueId || '',
      name:     o.projectName || '',
      customer: o.customerName || '',
      group:    o.groupName || '',
      subGroup: o.subGroupName || '',
      status:   o.status || '',
      budget:   parseFloat(o.budget) || 0,
      billed:   billedAmt(o),
      received: moneyIn(o),
      payable:  payableAmt(o),
      spent:    moneyOut(o),
      balance:  balanceAmt(o),
      progress: techProgressPct(o) ?? -1,   // untracked sorts below a genuine 0%
      timeline: o.startDate || '',
    }[key] ?? '');
    return [...projects].sort((a, b) => {
      const aVal = getVal(a, sortConfig.key), bVal = getVal(b, sortConfig.key);
      if (typeof aVal === 'number') return (aVal - bVal) * dir;
      if (sortConfig.key === 'timeline') return String(aVal).localeCompare(String(bVal)) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [projects, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / rowsPerPage));
  const pageItems = useMemo(
    () => sortedProjects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [sortedProjects, currentPage, rowsPerPage]
  );

  const openProject = (p) => navigate(`/projects/${encodeURIComponent(p.projectUniqueId)}`);

  // ── Column render map + sort keys ───────────────────────────────────────────
  const columnMeta = {
    sno:    { label: 'S.No', sortKey: null, render: (p, idx) => <td key="sno" style={{ textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>{(currentPage - 1) * rowsPerPage + idx + 1}</td> },
    projId: { label: 'Project ID', sortKey: 'projId', render: (p) => (
      <td key="projId"><div className="pl-id-main">{p.projectUniqueId}</div><div className="pl-muted-sm">{p.customerName || '—'}</div></td>
    ) },
    name:     { label: 'Project Name', sortKey: 'name', render: (p) => <td key="name">{p.projectName || '—'}</td> },
    customer: { label: 'Customer', sortKey: 'customer', render: (p) => <td key="customer">{p.customerName || '—'}</td> },
    group:    { label: 'Group', sortKey: 'group', render: (p) => <td key="group"><span className={groupPillClass(p.groupName)}>{p.groupName || '—'}</span></td> },
    subGroup: { label: 'Sub Group', sortKey: 'subGroup', render: (p) => <td key="subGroup">{p.subGroupName || '—'}</td> },
    status:   { label: 'Status', sortKey: 'status', render: (p) => (
      <td key="status"><span className="pl-status-badge" style={{ background: getStatusColor(p.status) + '22', color: getStatusColor(p.status) }}>{statusLabel(p.status)}</span></td>
    ) },
    budget:   { label: 'Budget', sortKey: 'budget', render: (p) => <td key="budget">{fmtMoney(p.budget)}</td> },

    // ── Financials ───────────────────────────────────────────────────────────
    billed:   { label: 'Billed', sortKey: 'billed', render: (p) => (
      <td key="billed" title={fmtMoney(billedAmt(p))}>{fmtMoneyShort(billedAmt(p))}</td>
    ) },
    received: { label: 'Received', sortKey: 'received', render: (p) => {
      const pct = collectedPct(p);
      return (
        <td key="received" title={`${fmtMoney(moneyIn(p))} received of ${fmtMoney(p.budget)} budget`}>
          <div className="pl-money" style={{ color: MONEY_IN_COLOR }}>{fmtMoneyShort(moneyIn(p))}</div>
          {Number(p.budget || 0) > 0 && <div className="pl-muted-sm">{pct}% of budget</div>}
        </td>
      );
    } },
    payable:  { label: 'Payable', sortKey: 'payable', render: (p) => (
      <td key="payable" title={fmtMoney(payableAmt(p))}>{fmtMoneyShort(payableAmt(p))}</td>
    ) },
    spent:    { label: 'Spent', sortKey: 'spent', render: (p) => {
      const pending = Math.max(0, payableAmt(p) - moneyOut(p));
      return (
        <td key="spent" title={`${fmtMoney(moneyOut(p))} paid of ${fmtMoney(payableAmt(p))} billed by vendors`}>
          <div className="pl-money" style={{ color: MONEY_OUT_COLOR }}>{fmtMoneyShort(moneyOut(p))}</div>
          {pending > 0 && <div className="pl-muted-sm">{fmtMoneyShort(pending)} due</div>}
        </td>
      );
    } },
    balance:  { label: 'Balance', sortKey: 'balance', render: (p) => {
      const bal = balanceAmt(p);
      return (
        <td key="balance" title={`Received ${fmtMoney(moneyIn(p))} − Spent ${fmtMoney(moneyOut(p))}`}>
          <span className="pl-money" style={{ color: balanceColor(bal) }}>{fmtMoneyShort(bal)}</span>
        </td>
      );
    } },
    progress: { label: 'Progress', sortKey: 'progress', render: (p) => {
      const tech = techProgressPct(p);   // null = no scope defined
      const fin  = Math.min(100, Math.max(0, Number(p.financialProgressPct || 0)));
      return <td key="progress"><DualProgress tech={tech} fin={fin} techColor={progressColor(p.status)} /></td>;
    } },
    timeline: { label: 'Timeline', sortKey: 'timeline', render: (p) => <td key="timeline" className="pl-muted-sm">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</td> },
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <span className="ob-sort-icon ob-sort-none">⇅</span>;
    return <span className="ob-sort-icon ob-sort-active">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const visibleKeys = columnOrder.filter(k => visibleColumns[k]);

  return (
    <div className="orderbook-page">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Breadcrumb */}
      <div className="orderbook-breadcrumb">
        <span>Dashboard</span>
        <span className="orderbook-breadcrumb-separator">&gt;</span>
        <span className="orderbook-breadcrumb-active">Projects</span>
      </div>

      {/* Header — title left, shared Group/Category filter top-right */}
      <div className="orderbook-header page-header-with-filter">
        <h1>Projects</h1>
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      {/* Summary stat cards */}
      <div className="pl-stats">
        <div className="pl-stat-card">
          <span className="pl-stat-label">Total Projects</span>
          <span className="pl-stat-value">{stats.total}</span>
          <span className="pl-stat-accent" style={{ background: '#3b82f6' }} />
        </div>
        <div className="pl-stat-card">
          <span className="pl-stat-label">In Progress</span>
          <span className="pl-stat-value">{stats.inProgress}</span>
          <span className="pl-stat-accent" style={{ background: getStatusColor('IN_PROGRESS') }} />
        </div>
        <div className="pl-stat-card">
          <span className="pl-stat-label">Completed</span>
          <span className="pl-stat-value">{stats.completed}</span>
          <span className="pl-stat-accent" style={{ background: getStatusColor('COMPLETED') }} />
        </div>
        <div className="pl-stat-card">
          <span className="pl-stat-label">Total Budget</span>
          <span className="pl-stat-value" title={fmtMoney(stats.totalBudget)}>{fmtMoneyShort(stats.totalBudget)}</span>
          <span className="pl-stat-accent" style={{ background: '#8b5cf6' }} />
        </div>
        <div className="pl-stat-card">
          <span className="pl-stat-label">Received</span>
          <span className="pl-stat-value" style={{ color: MONEY_IN_COLOR }} title={fmtMoney(stats.totalReceived)}>
            {fmtMoneyShort(stats.totalReceived)}
          </span>
          <span className="pl-stat-sub">{fmtMoneyShort(stats.pendingReceipts)} yet to collect</span>
          <span className="pl-stat-accent" style={{ background: MONEY_IN_COLOR }} />
        </div>
        <div className="pl-stat-card">
          <span className="pl-stat-label">Spent</span>
          <span className="pl-stat-value" style={{ color: MONEY_OUT_COLOR }} title={fmtMoney(stats.totalSpent)}>
            {fmtMoneyShort(stats.totalSpent)}
          </span>
          <span className="pl-stat-sub">Balance {fmtMoneyShort(stats.totalBalance)}</span>
          <span className="pl-stat-accent" style={{ background: MONEY_OUT_COLOR }} />
        </div>
      </div>

      {/* Action / filter bar */}
      <div className="orderbook-action-bar" style={{ alignItems: 'center' }}>
        <div className="orderbook-search-filters" style={{ alignItems: 'center' }}>
          <input
            type="text"
            className="orderbook-search"
            placeholder="Search project or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="pl-filter-cell">
            <FilterSelect
              value={status}
              options={STATUS_OPTIONS}
              placeholder="All Statuses"
              onChange={setStatus}
            />
          </div>
          {hasFilters && (
            <button className="pl-clear-btn" onClick={clearFilters}>Clear Filters</button>
          )}
        </div>

        <div className="orderbook-action-buttons" style={{ alignItems: 'center' }}>
          {/* Columns picker — table view only */}
          {viewMode === 'table' && (
            <div className="orderbook-column-picker-container">
              <button
                className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon"
                onClick={() => setShowColumnPicker(v => !v)}
                title="Manage Columns"
              >
                <FaColumns /> Columns
              </button>
              {showColumnPicker && (
                <div className="orderbook-column-picker-dropdown">
                  <div className="orderbook-column-picker-header">
                    <span>Show/Hide Columns</span>
                    <button className="orderbook-column-picker-close" onClick={() => setShowColumnPicker(false)}>×</button>
                  </div>
                  <div className="orderbook-column-picker-list">
                    {COLUMN_DEFS.map(col => (
                      <label key={col.key} className="orderbook-column-picker-item">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.key]}
                          onChange={() => toggleColumnVisibility(col.key)}
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View toggle */}
          <div className="pl-view-toggle">
            <button className={`pl-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setView('table')} title="Table view" aria-label="Table view">▤</button>
            <button className={`pl-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view" aria-label="Grid view">⊞</button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? null : projects.length === 0 ? (
        <div className="pl-empty">No projects found{hasFilters ? ' for the selected filters.' : '.'}</div>
      ) : viewMode === 'grid' ? (
        <>
          <ProjectsGrid rows={pageItems} onOpen={openProject} />
          <Pagination currentPage={currentPage} totalPages={totalPages} total={sortedProjects.length} setCurrentPage={setCurrentPage} rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} />
        </>
      ) : (
        <>
          <div className="orderbook-table-card">
            <div className="orderbook-table-wrapper">
              <table className="orderbook-table">
                <thead>
                  <tr>
                    {visibleKeys.map(key => {
                      const col = columnMeta[key];
                      const isActive = sortConfig.key === col.sortKey;
                      return (
                        <th
                          key={key}
                          draggable
                          onDragStart={() => handleDragStart(key)}
                          onDragEnter={() => handleDragEnter(key)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className={`ob-draggable-th ${col.sortKey ? 'ob-sortable' : ''} ${isActive ? 'ob-th-sorted' : ''}`}
                          onClick={() => col.sortKey && handleSort(col.sortKey)}
                          title={col.sortKey ? 'Drag to reorder · Click to sort' : 'Drag to reorder'}
                        >
                          <span className="ob-th-grip">⠿</span>
                          {col.label}
                          {col.sortKey && <SortIcon colKey={col.sortKey} />}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p, idx) => (
                    <tr key={p.projectUniqueId} onClick={() => openProject(p)} style={{ cursor: 'pointer' }}>
                      {visibleKeys.map(key => columnMeta[key].render(p, idx))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} total={sortedProjects.length} setCurrentPage={setCurrentPage} rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors the Leads page pagination (ServerPagination): « first · ‹ prev ·
// page numbers · next › · last », plus a "Page X of Y" indicator.
const Pagination = ({ currentPage, totalPages, total, setCurrentPage, rowsPerPage, onRowsPerPageChange }) => {
  const tp = totalPages || 1;
  return (
    <div className="pl-pagination">
      {/* Left: rows-per-page selector + record/page info (mirrors Leads/Enquiries) */}
      <div className="pl-pagination-left">
        <span className="pl-rows-label">Rows per page:</span>
        <FilterSelect
          value={String(rowsPerPage)}
          onChange={v => onRowsPerPageChange(Number(v))}
          options={ROWS_PER_PAGE_OPTIONS.map(n => ({ value: String(n), label: `${n} rows` }))}
          placeholder="Rows"
        />
        <span className="pl-page-info">
          {total === 0
            ? 'No projects'
            : `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(currentPage * rowsPerPage, total)} of ${total} projects`}
        </span>
        {total > 0 && (
          <span className="pl-page-info">Page <strong>{currentPage}</strong> of <strong>{tp}</strong></span>
        )}
      </div>
      <div className="pl-page-btns">
        <button className="pl-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} title="First page">«</button>
        <button className="pl-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} title="Previous page">‹</button>
        {Array.from({ length: tp }, (_, i) => i + 1)
          .filter(p => Math.abs(p - currentPage) <= 2 || p === 1 || p === tp)
          .map((p, idx, arr) => (
            <React.Fragment key={p}>
              {idx > 0 && p - arr[idx - 1] > 1 && <span className="pl-page-info">…</span>}
              <button className={`pl-page-btn${p === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
            </React.Fragment>
          ))}
        <button className="pl-page-btn" disabled={currentPage === tp} onClick={() => setCurrentPage(p => Math.min(tp, p + 1))} title="Next page">›</button>
        <button className="pl-page-btn" disabled={currentPage === tp} onClick={() => setCurrentPage(tp)} title="Last page">»</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  GRID VIEW
// ─────────────────────────────────────────────────────────────────────────────
const ProjectsGrid = ({ rows, onOpen }) => (
  <div className="pl-grid">
    {rows.map((p) => {
      const pct      = techProgressPct(p);   // null = no scope defined
      const finPct   = Math.min(100, Math.max(0, Number(p.financialProgressPct || 0)));
      const statusHx = getStatusColor(p.status);
      const bal      = balanceAmt(p);
      const late     = isOverdue(p);

      return (
        <div
          key={p.projectUniqueId}
          className="pl-card"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(p)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p); } }}
        >
          {/* Row 1 — identifier and status */}
          <div className="pl-card-head">
            <span className="pl-card-id">{p.projectUniqueId}</span>
            <span className="pl-card-status">
              <span className="pl-status-dot" style={{ background: statusHx }} />
              {statusLabel(p.status)}
            </span>
          </div>

          {/* Row 2 — the headline */}
          <div>
            <div className="pl-card-name">{p.projectName || '—'}</div>
            <div className="pl-card-customer">
              {p.customerName || '—'}
              {p.groupName ? <span className="pl-card-sep">·</span> : null}
              {p.groupName || ''}
            </div>
          </div>

          {/* Row 3 — progress: Technical + Financial */}
          <div className="pl-card-progress">
            <div className="pl-card-progress-head"
              title={pct == null ? 'No technical scope defined for this project' : undefined}>
              <span>Technical</span>
              <span className="pl-card-progress-pct">{pct == null ? NO_TECH_PROGRESS : `${pct}%`}</span>
            </div>
            <div className="pl-progress">
              <div className="pl-progress-fill" style={{ width: `${pct ?? 0}%`, background: statusHx }} />
            </div>
            <div className="pl-card-progress-head" style={{ marginTop: 6 }}>
              <span style={{ color: '#64748b' }}>Financial</span>
              <span className="pl-card-progress-pct" style={{ color: FIN_COLOR }}>{finPct}%</span>
            </div>
            <div className="pl-progress">
              <div className="pl-progress-fill" style={{ width: `${finPct}%`, background: FIN_COLOR }} />
            </div>
          </div>

          {/* Row 4 — three numbers, hairline-separated, no nested box */}
          <div className="pl-card-money">
            <div className="pl-money-cell" title={`Budget: ${fmtMoney(p.budget)}`}>
              <label>Budget</label>
              <span>{fmtMoneyShort(p.budget)}</span>
            </div>
            <div className="pl-money-cell" title={`Received from customer: ${fmtMoney(moneyIn(p))}`}>
              <label>Received</label>
              <span>{fmtMoneyShort(moneyIn(p))}</span>
            </div>
            <div className="pl-money-cell" title={`Received ${fmtMoney(moneyIn(p))} − Spent ${fmtMoney(moneyOut(p))}`}>
              <label>Balance</label>
              <span style={{ color: balanceColor(bal) }}>{fmtMoneyShort(bal)}</span>
            </div>
          </div>

          {/* Row 5 — schedule signal */}
          <div className="pl-card-foot">
            {late ? (
              <span className="pl-card-late">⚠ {daysOverdue(p)} days overdue</span>
            ) : (
              <span className="pl-muted-sm">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</span>
            )}
            <span className="pl-muted-sm">{p.subGroupName || ''}</span>
          </div>
        </div>
      );
    })}
  </div>
);

export default ProjectsList;
