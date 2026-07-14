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
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

const ROWS_PER_PAGE = 10;

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
  const setView = (mode) => { setViewMode(mode); localStorage.setItem('projects_view_mode', mode); };

  // ── Table mechanics (mirror OrderBook): sort + column order + visibility ────
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnOrder, setColumnOrder] = useState(COLUMN_DEFS.map(c => c.key));
  const [visibleColumns, setVisibleColumns] = useState({
    sno: true, projId: true, name: true, customer: false, group: true,
    subGroup: false, status: true, budget: true, progress: true, timeline: true,
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
    const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
    return { total, inProgress, completed, totalBudget };
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
      progress: Number(o.progressPercentage) || 0,
      timeline: o.startDate || '',
    }[key] ?? '');
    return [...projects].sort((a, b) => {
      const aVal = getVal(a, sortConfig.key), bVal = getVal(b, sortConfig.key);
      if (typeof aVal === 'number') return (aVal - bVal) * dir;
      if (sortConfig.key === 'timeline') return String(aVal).localeCompare(String(bVal)) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [projects, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / ROWS_PER_PAGE));
  const pageItems = useMemo(
    () => sortedProjects.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE),
    [sortedProjects, currentPage]
  );

  const openProject = (p) => navigate(`/projects/${encodeURIComponent(p.projectUniqueId)}`);

  // ── Column render map + sort keys ───────────────────────────────────────────
  const columnMeta = {
    sno:    { label: 'S.No', sortKey: null, render: (p, idx) => <td key="sno" style={{ textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</td> },
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
    progress: { label: 'Progress', sortKey: 'progress', render: (p) => {
      const pct = Math.min(100, Math.max(0, Number(p.progressPercentage || 0)));
      return (
        <td key="progress"><div className="pl-progress-wrap">
          <div className="pl-progress"><div className="pl-progress-fill" style={{ width: `${pct}%`, background: progressColor(p.status) }} /></div>
          <span className="pl-progress-pct">{pct}%</span>
        </div></td>
      );
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
          <span className="pl-stat-value">{fmtMoney(stats.totalBudget)}</span>
          <span className="pl-stat-accent" style={{ background: '#8b5cf6' }} />
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
          <Pagination currentPage={currentPage} totalPages={totalPages} total={sortedProjects.length} setCurrentPage={setCurrentPage} />
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
          <Pagination currentPage={currentPage} totalPages={totalPages} total={sortedProjects.length} setCurrentPage={setCurrentPage} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
const Pagination = ({ currentPage, totalPages, total, setCurrentPage }) => (
  <div className="pl-pagination">
    <span className="pl-page-info">
      Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, total)} of {total}
    </span>
    <div className="pl-page-btns">
      <button className="pl-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
        .map((p, idx, arr) => (
          <React.Fragment key={p}>
            {idx > 0 && p - arr[idx - 1] > 1 && <span className="pl-page-info">…</span>}
            <button className={`pl-page-btn${p === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
          </React.Fragment>
        ))}
      <button className="pl-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>›</button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  GRID VIEW
// ─────────────────────────────────────────────────────────────────────────────
const ProjectsGrid = ({ rows, onOpen }) => (
  <div className="pl-grid">
    {rows.map((p) => {
      const pct = Math.min(100, Math.max(0, Number(p.progressPercentage || 0)));
      return (
        <div key={p.projectUniqueId} className="pl-card" onClick={() => onOpen(p)}>
          <div className="pl-card-head">
            <span className={groupPillClass(p.groupName)}>{p.groupName || '—'}</span>
            <span className="pl-status-badge" style={{ background: getStatusColor(p.status) + '22', color: getStatusColor(p.status) }}>
              {statusLabel(p.status)}
            </span>
          </div>

          <div>
            <div className="pl-card-name">{p.projectName || '—'}</div>
            <div className="pl-card-customer">{p.customerName || '—'}</div>
          </div>

          <div className="pl-card-divider" />

          <div className="pl-card-row">
            <label>Budget</label>
            <span className="pl-card-value">{fmtMoney(p.budget)}</span>
          </div>

          <div className="pl-progress-wrap">
            <div className="pl-progress">
              <div className="pl-progress-fill" style={{ width: `${pct}%`, background: progressColor(p.status) }} />
            </div>
            <span className="pl-progress-pct">{pct}%</span>
          </div>

          <div className="pl-card-foot">
            <span className="pl-muted-sm">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</span>
            <span className="pl-card-id">{p.projectUniqueId}</span>
          </div>
        </div>
      );
    })}
  </div>
);

export default ProjectsList;
