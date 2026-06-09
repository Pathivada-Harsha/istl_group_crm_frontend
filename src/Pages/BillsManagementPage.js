import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, X, Edit2, Eye, Check, FileText, Upload,
  Calendar, DollarSign, IndianRupee, CheckCircle, AlertCircle, CreditCard,
  Link as LinkIcon, Trash2, Download, ChevronUp, ChevronDown, Columns, GripVertical,
  ExternalLink
} from 'lucide-react';
import '../pages-css/Bills-Recieved.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import FilterSelect from "./../components/Dropdowns/FilterSelect.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import filterApi from '../services/filterApi';
import ConfirmationModal from '../components/ConfirmationModal';

/* ── Inline-style theme mappers (added for dark mode) ── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff': '#1b2130', '#ffffff': '#1b2130', 'white': '#1b2130', 'transparent': 'transparent',
  '#f9fafb': '#0f1420', '#f8fafc': '#0f1420', '#f8f9fa': '#0f1420', '#fafafa': '#0f1420', '#f8fafb': '#0f1420', '#fcfcfd': '#0f1420',
  '#f3f4f6': '#232b3b', '#f1f5f9': '#232b3b', '#f1f1f1': '#232b3b', '#f0f0f0': '#232b3b', '#e9eef5': '#2b3445', '#eef2f7': '#18202e',
  '#eff6ff': '#15243d', '#f0f7ff': '#15243d', '#f0f9ff': '#15243d', '#f0f4ff': '#1a2440', '#eef2ff': '#1e1f45', '#dbeafe': '#1d3a5f', '#bfdbfe': '#244b7a', '#bae6fd': '#16344d', '#e0f2fe': '#16344d', '#e0e7ff': '#1e2547', '#93c5fd': '#2f5d92',
  '#ecfdf5': '#102a22', '#f0fdf4': '#14301f', '#dcfce7': '#14302a', '#d1fae5': '#14302a', '#a7f3d0': '#2a5a40', '#6ee7b7': '#2a5a40', '#bbf7d0': '#2a5a40', '#86efac': '#2a5a40',
  '#fef2f2': '#2a1719', '#fee2e2': '#3a1f22', '#fecaca': '#3a1f22', '#fecdd3': '#3a1f26', '#fff5f5': '#2b1d20', '#fff1f2': '#2b1d20', '#fff7ed': '#2c2113', '#fffbeb': '#2a2710', '#fffdf0': '#2a2710', '#fef9c3': '#3a3016', '#fef3c7': '#3a3016', '#fde68a': '#5a4714', '#fef08a': '#5a4714',
  '#f5f3ff': '#241b3d', '#faf5ff': '#241b3d', '#ede9fe': '#2a2147', '#ddd6fe': '#2e2147', '#e9d5ff': '#2e2147', '#ecfeff': '#103038', '#fce7f3': '#3a1f30',
  '#e5e7eb': '#2b3445', '#e2e8f0': '#2b3445', '#d1d5db': '#3a4456', '#cbd5e1': '#3a4456', '#a5b4fc': '#3a3d6a', '#c4b5fd': '#3a3d6a', '#fca5a5': '#5a2a2e',
};
const __TM = {
  '#0f172a': '#e7ecf3', '#111827': '#e7ecf3', '#1e293b': '#d4dbe6', '#1f2937': '#d4dbe6', '#0b1220': '#e7ecf3',
  '#374151': '#c2cbd8', '#475569': '#aab4c2', '#4b5563': '#aab4c2', '#334155': '#aab4c2',
  '#64748b': '#94a1b3', '#6b7280': '#94a1b3', '#9ca3af': '#9aa7b8', '#94a3b8': '#9aa7b8', '#718096': '#9aa7b8',
  '#15803d': '#46c46f', '#166534': '#6ee7b7', '#065f46': '#6ee7b7', '#1c4532': '#6ee7b7', '#059669': '#18c08a', '#16a34a': '#2bc55e', '#10b981': '#34d39e',
  '#b45309': '#f0c07a', '#c2410c': '#fb923c', '#92400e': '#f0c07a', '#78350f': '#f0b080', '#d97706': '#f0b454', '#ca8a04': '#e3c258', '#f59e0b': '#f5b945',
  '#b91c1c': '#f08a8a', '#991b1b': '#f08a8a', '#dc2626': '#f05252', '#ef4444': '#f06a6a',
  '#1d4ed8': '#5b9bf0', '#2563eb': '#5b9bf0', '#1e40af': '#5b9bf0', '#3b82f6': '#5b9bf0', '#0284c7': '#38bdf8', '#0891b2': '#22d3ee', '#1e3a8a': '#7fb0f0',
  '#7c3aed': '#a78bfa', '#8b5cf6': '#b39bf7', '#6d28d9': '#c4b5fd', '#5b21b6': '#c4b5fd', '#3730a3': '#a5b4fc', '#4338ca': '#a5b4fc', '#4f46e5': '#8589f3', '#6366f1': '#8589f3', '#0369a1': '#38bdf8',
};
const __sbg = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __SM[k]) ? __SM[k] : v; };
const __stc = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __TM[k]) ? __TM[k] : v; };
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};


const API_BASE_URL = process.env.REACT_APP_API_URL;

// ── Date constants ────────────────────────────────────────────────────────────
const _BR_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const _BR_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── BRDatePicker — compact single date (same style as PO Create Modal) ────────
const BRDatePicker = ({ value, onChange, placeholder = 'Select date', minDate }) => {
  useThemeVersion();
  const [show, setShow] = React.useState(false);
  const [calMo, setCalMo] = React.useState(() => value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth());
  const [calYr, setCalYr] = React.useState(() => value ? parseInt(value.slice(0, 4)) : new Date().getFullYear());
  const [showYrP, setShowYrP] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);
  const open = () => {
    if (value) { setCalMo(parseInt(value.slice(5, 7)) - 1); setCalYr(parseInt(value.slice(0, 4))); }
    setShowYrP(false); setShow(true);
  };
  const DIM = new Date(calYr, calMo + 1, 0).getDate();
  const FD = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0, 10);
  const fmtD = d => { if (!d) return null; const [y, m, dy] = d.split('-'); return `${dy}-${m}-${y}`; };
  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button type="button"
        className={`po-dtp-trigger${show ? ' po-dtp--open' : ''}${value ? ' po-dtp--set' : ''}`}
        onClick={show ? () => setShow(false) : open} style={{ width: '100%' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: value ? __stc('#4f46e5') : __stc('#94a3b8') }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {value ? <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: __stc('#0f172a') }}>{fmtD(value)}</span>
          : <span className="po-dtp-ph">{placeholder}</span>}
        {value
          ? <span className="po-dtp-x" onClick={e => { e.stopPropagation(); onChange(''); }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 'auto', color: __stc('#94a3b8'), transform: show ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>}
      </button>
      {show && (
        <div className="po-dtp-dropdown" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 280, zIndex: 1050 }}>
          <div className="po-dtp-cal-head">
            <button type="button" className="po-cal-nav" onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr(y => y - 1); } else setCalMo(m => m - 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" className="po-dtp-month" onClick={() => setShowYrP(p => !p)}>
              {_BR_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="po-cal-nav" onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr(y => y + 1); } else setCalMo(m => m + 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {showYrP ? (
            <div className="po-yr-grid">
              {Array.from({ length: 16 }, (_, i) => {
                const yr = new Date().getFullYear() - 4 + i; return (
                  <div key={yr} className={`po-yr-cell${yr === calYr ? ' po-yr-sel' : ''}`} onClick={() => { setCalYr(yr); setShowYrP(false); }}>{yr}</div>
                );
              })}</div>
          ) : (
            <div className="po-dtp-grid">
              {_BR_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({ length: FD }).map((_, i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty" />)}
              {Array.from({ length: DIM }).map((_, i) => {
                const dy = i + 1, ds = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
                const isMin = minDate && ds < minDate;
                let cls = 'po-cal-cell';
                if (ds === value) cls += ' po-dtp-sel'; else if (ds === tod) cls += ' po-cal-today';
                if (isMin) cls += ' po-cal-empty';
                return <div key={ds} className={cls} onClick={() => { if (!isMin) { onChange(ds); setShow(false); } }}>{dy}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── BRDateRangeFilter — date range picker (same style as PO page filter bar) ──
const BRDateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  useThemeVersion();
  const [show, setShow] = React.useState(false);
  const [from, setFrom] = React.useState(null);
  const [to, setTo] = React.useState(null);
  const [hover, setHover] = React.useState(null);
  const [calMo, setCalMo] = React.useState(new Date().getMonth());
  const [calYr, setCalYr] = React.useState(new Date().getFullYear());
  const [showYr, setShowYr] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);
  const DIM = new Date(calYr, calMo + 1, 0).getDate(), FD = new Date(calYr, calMo, 1).getDay(), tod = new Date().toISOString().slice(0, 10);
  const inR = d => { const hi = to || (from && hover ? hover : null); if (!from || !hi) return false; const [a, b] = from <= hi ? [from, hi] : [hi, from]; return d > a && d < b; };
  const clickDay = d => { if (!from || (from && to)) { setFrom(d); setTo(null); } else if (d < from) { setFrom(d); setTo(null); } else if (d === from) { setFrom(null); setTo(null); } else setTo(d); };
  const fmt = d => { if (!d) return ''; const [y, m, dy] = d.split('-'); return `${dy}-${m}-${y}`; };
  const handleApply = () => { if (!from) return; onApply(from, to || from); setShow(false); };
  const handleClear = () => { setFrom(null); setTo(null); setHover(null); onClear(); setShow(false); };
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={`po-cal-trigger${show ? ' po-cal--open' : ''}${appliedFrom ? ' po-cal--applied' : ''}`} onClick={() => setShow(p => !p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span className={appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>{appliedFrom ? fmt(appliedFrom) : 'dd-mm-yyyy'}</span>
        <span className="po-cal-sep">—</span>
        <span className={appliedTo && appliedTo !== appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>{appliedTo && appliedTo !== appliedFrom ? fmt(appliedTo) : 'dd-mm-yyyy'}</span>
        {appliedFrom && <span className="po-cal-x" onClick={e => { e.stopPropagation(); handleClear(); }}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 'auto', color: __stc('#94a3b8'), flexShrink: 0, transform: show ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {show && (
        <div className="po-cal-dropdown" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999, width: 264 }}>
          <div className="po-cal-head">
            <button type="button" className="po-cal-nav" onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr(y => y - 1); } else setCalMo(m => m - 1); }}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <button type="button" className="po-cal-month-btn" onClick={() => setShowYr(p => !p)}>{_BR_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span></button>
            <button type="button" className="po-cal-nav" onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr(y => y + 1); } else setCalMo(m => m + 1); }}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
          </div>
          {showYr ? (
            <div className="po-yr-grid">{Array.from({ length: 16 }, (_, i) => { const yr = new Date().getFullYear() - 4 + i; return <div key={yr} className={`po-yr-cell${yr === calYr ? ' po-yr-sel' : ''}`} onClick={() => { setCalYr(yr); setShowYr(false); }}>{yr}</div>; })}</div>
          ) : (
            <div className="po-cal-grid">
              {_BR_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({ length: FD }).map((_, i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty" />)}
              {Array.from({ length: DIM }).map((_, i) => {
                const dy = i + 1, ds = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`, dow = (FD + i) % 7;
                let cls = 'po-cal-cell';
                if (ds === from) cls += ' po-cal-from'; else if (ds === to) cls += ' po-cal-to';
                else if (inR(ds)) { cls += ' po-cal-in-range'; if (dow === 0) cls += ' po-cal-rr-s'; if (dow === 6) cls += ' po-cal-rr-e'; }
                if (ds === tod && ds !== from && ds !== to) cls += ' po-cal-today';
                return <div key={ds} className={cls} onClick={() => clickDay(ds)} onMouseEnter={() => from && !to && setHover(ds)} onMouseLeave={() => setHover(null)}>{dy}</div>;
              })}
            </div>
          )}
          <div className="po-cal-footer">
            <div className="po-cal-chips">
              <span className={`po-cal-chip${from ? ' po-cal-chip--set' : ''}`}>{from ? fmt(from) : 'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /></svg>
              <span className={`po-cal-chip${to ? ' po-cal-chip--set' : ''}`}>{to ? fmt(to) : 'To —'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', width: '100%' }}>
              {(from || appliedFrom) && <button type="button" className="po-cal-clear" onClick={handleClear}>Clear</button>}
              <button type="button" className="po-cal-clear" onClick={() => setShow(false)}>Cancel</button>
              <button type="button" className="po-cal-apply" onClick={handleApply} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const BillsManagementPage = () => {
  useThemeVersion();
  const [bills, setBills] = useState([]);
  const [selectedBills, setSelectedBills] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({
    totalBills: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  });

  // MODAL-SPECIFIC dropdown data (completely independent from main filters)
  const [modalVendors, setModalVendors] = useState([]);
  const [modalPurchaseOrders, setModalPurchaseOrders] = useState([]);
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const [filters, setFilters] = useState({
    search: '',
    paymentStatus: 'all'
  });

  // ── Bill date range filter ────────────────────────────────────────────────
  const [billDateFrom, setBillDateFrom] = useState('');
  const [billDateTo, setBillDateTo] = useState('');

  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalItems: 0,
    pageSize: 10
  });

  // Column sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Column visibility & order (checkbox column and actions are always shown separately)
  const BILLS_COLUMNS = [
    { key: 'billRefId', label: 'Bill Ref ID' },
    { key: 'vendorName', label: 'Vendor Name' },
    { key: 'poNumber', label: 'Linked PO' },
    { key: 'billDate', label: 'Bill Date' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'totalAmount', label: 'Amount' },
    { key: 'paidAmount', label: 'Paid Amount' },
    { key: 'balanceAmount', label: 'Balance' },
    { key: 'status', label: 'Payment Status' },
    { key: 'uploadedByName', label: 'Uploaded By' },
    { key: 'groupName', label: 'Group' },
    { key: 'category', label: 'Category' },
    { key: 'projectId', label: 'Project' },
  ];
  // Default visible: only the original columns — group/category/project start hidden
  const DEFAULT_VISIBLE = ['billRefId', 'vendorName', 'dueDate', 'totalAmount', 'paidAmount', 'balanceAmount', 'status', 'uploadedByName'];
  const [columnOrder, setColumnOrder] = useState(BILLS_COLUMNS.map(c => c.key));
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const columnsPanelRef = useRef(null);
  const dragColRef = useRef(null);
  const dragOverColRef = useRef(null);

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFileViewModal, setShowFileViewModal] = useState(false);
  const [fileViewUrl, setFileViewUrl] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Modal dropdown states (completely independent)
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null
  });

  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const { user, pagePermissions } = useAuth();
  const billsPerms = pagePermissions?.BILLS || [];
  // Pure DB-driven permissions — no role overrides
  const canView = billsPerms.includes('VIEW');
  const canCreate = billsPerms.includes('CREATE');
  const canEdit = billsPerms.includes('EDIT');
  const canDelete = billsPerms.includes('DELETE');
  const canApprove = billsPerms.includes('APPROVE');
  const isViewOnly = canView && !canCreate && !canEdit && !canDelete && !canApprove;

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json'
  });

  // Fetch bills and KPIs
  // Clear stale data immediately when logged-in user changes
  useEffect(() => {
    setBills([]); setPagination(prev => ({ ...prev, currentPage: 0 }));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const isDateFiltered = !!(billDateFrom || billDateTo);
        const params = new URLSearchParams({
          page: pagination.currentPage.toString(),
          size: pagination.pageSize.toString(),
          sortBy: 'billDate',
          sortDirection: isDateFiltered ? 'ASC' : 'DESC'
        });
        if (projectId) params.append('projectId', projectId);
        if (groupName) params.append('groupId', groupName);
        if (subGroupName) params.append('subGroupId', subGroupName);
        if (filters.paymentStatus !== 'all') params.append('status', filters.paymentStatus);
        if (filters.search) params.append('search', filters.search);
        if (billDateFrom) params.append('billDateFrom', billDateFrom);
        if (billDateTo) params.append('billDateTo', billDateTo);
        const response = await fetch(`${API_BASE_URL}/bills?${params}`, {
          headers: getAuthHeaders(), credentials: 'include', signal: controller.signal
        });
        if (response.ok) {
          const data = await response.json();
          setBills(data.bills || []);
          setProjectNames(data.projectNames || {});
          // Do NOT sync currentPage from API — page is managed locally to ensure filter resets work
          setPagination(prev => ({
            ...prev,
            totalPages: data.totalPages || 0,
            totalItems: data.totalItems || 0
          }));
        } else { showError('Failed to fetch bills'); }
      } catch (error) {
        if (error.name === 'AbortError') return; // cancelled by new request — ignore
        console.error('Error fetching bills:', error);
        showError('Error fetching bills');
      } finally { setLoading(false); }
    };
    load();
    return () => controller.abort(); // cancel previous in-flight request when deps change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, groupName, subGroupName, filters.paymentStatus, filters.search, pagination.currentPage, pagination.pageSize, billDateFrom, billDateTo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchKPIs();
  }, [projectId, groupName, subGroupName, filters.paymentStatus, filters.search, billDateFrom, billDateTo]);

  // Reset to page 1 whenever any external filter (group/project) changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, groupName, subGroupName]);

  // Fetch MODAL dropdown data when modal opens
  useEffect(() => {
    if (showCreateEditModal) {
      fetchModalGroups();
    }
  }, [showCreateEditModal]);

  const fetchBills = async () => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        size: pagination.pageSize.toString(),
        sortBy: 'billDate',
        sortDirection: 'DESC'
      });
      if (projectId) params.append('projectId', projectId);
      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      if (filters.paymentStatus !== 'all') params.append('status', filters.paymentStatus);
      if (filters.search) params.append('search', filters.search);
      const response = await fetch(`${API_BASE_URL}/bills?${params}`, {
        headers: getAuthHeaders(), credentials: 'include', signal: controller.signal
      });
      if (response.ok) {
        const data = await response.json();
        setBills(data.bills || []);
        setPagination(prev => ({ ...prev, totalPages: data.totalPages || 0, totalItems: data.totalItems || 0 }));
      } else { showError('Failed to fetch bills'); }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching bills:', error);
      showError('Error fetching bills');
    } finally { setLoading(false); }
  };

  const fetchKPIs = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      // Active filters — so KPIs reflect exactly what's visible in the table
      if (filters.paymentStatus && filters.paymentStatus !== 'all') params.append('status', filters.paymentStatus);
      if (filters.search && filters.search.trim()) params.append('search', filters.search.trim());
      if (billDateFrom) params.append('billDateFrom', billDateFrom);
      if (billDateTo) params.append('billDateTo', billDateTo);

      const response = await fetch(`${API_BASE_URL}/bills/stats?${params}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        const stats = await response.json();
        setKpis({
          totalBills: stats.totalBills || 0,
          totalAmount: stats.totalAmount || 0,
          paidAmount: stats.paidAmount || 0,
          pendingAmount: stats.pendingAmount || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  // ========== MODAL DROPDOWN FUNCTIONS (COMPLETELY INDEPENDENT) ==========

  // Dedicated vendor fetch for the bill modal — uses fresh params passed directly
  // so React state async-update lag never causes stale-value fetches.
  // Calls GET /bills/modal/vendors (isolated endpoint, won't break any other page).
  const fetchModalVendors = async (groupN, subGroupN, projectN) => {
    const g = groupN !== undefined ? groupN : modalGroupName;
    const sg = subGroupN !== undefined ? subGroupN : modalSubGroupName;
    const p = projectN !== undefined ? projectN : modalProjectId;
    try {
      const params = new URLSearchParams();
      if (g) params.append('groupName', g);
      if (sg) params.append('subGroupName', sg);
      if (p) params.append('projectId', p);
      const response = await fetch(`${API_BASE_URL}/bills/modal/vendors?${params}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setModalVendors(data || []);
      } else {
        setModalVendors([]);
      }
    } catch (error) {
      console.error('Failed to fetch modal vendors:', error);
      setModalVendors([]);
    }
  };

  // Dedicated PO fetch for the bill modal — isolated from the PO listing page.
  // Calls GET /bills/modal/purchase-orders so changes here never affect other pages.
  // Accepts all scope params directly to avoid stale React state.
  const fetchModalPurchaseOrders = async (vendorIdOrName = null, groupN, subGroupN, projectN) => {
    const g = groupN !== undefined ? groupN : modalGroupName;
    const sg = subGroupN !== undefined ? subGroupN : modalSubGroupName;
    const p = projectN !== undefined ? projectN : modalProjectId;
    try {
      const params = new URLSearchParams();
      if (g) params.append('groupName', g);
      if (sg) params.append('subGroupName', sg);
      if (p) params.append('projectId', p);
      if (vendorIdOrName) {
        if (typeof vendorIdOrName === 'number' || (typeof vendorIdOrName === 'string' && !vendorIdOrName.startsWith('PO_'))) {
          params.append('vendorId', vendorIdOrName);
        } else if (typeof vendorIdOrName === 'string' && vendorIdOrName.startsWith('PO_')) {
          params.append('vendorName', vendorIdOrName.replace('PO_', ''));
        }
      }
      const response = await fetch(`${API_BASE_URL}/bills/modal/purchase-orders?${params}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setModalPurchaseOrders(data || []);
      } else {
        setModalPurchaseOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch modal purchase orders:', error);
      setModalPurchaseOrders([]);
    }
  };

  const fetchPOItems = async (poId) => {
    if (!poId) return;

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/purchase-orders/${poId}/items-for-bill`,
        {
          credentials: "include",
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.items && data.items.length > 0) {
          const billItems = data.items.map(item => ({
            poItemId: item.id,
            itemName: item.itemName || '',
            itemSku: item.itemSku || '',
            description: item.description || '',
            orderedQty: item.orderedQty,
            deliveredQty: item.deliveredQty,
            pendingQty: item.pendingQty,
            maxBillableQty: item.pendingQty,
            quantity: '',  // blank — user must enter bill qty explicitly
            unitPrice: item.unitPrice || 0,
            taxPercent: item.taxPercent || 18,
            deliveryStatus: item.deliveryStatus
          }));

          setFormData(prev => ({
            ...prev,
            items: billItems
          }));

          const pendingCount = billItems.filter(i => (i.pendingQty || 0) > 0).length;
          if (pendingCount === 0) {
            showSuccess(`Loaded ${billItems.length} items (all fully delivered — enter quantities to bill again if needed).`);
          } else {
            showSuccess(`✅ Loaded ${billItems.length} items. Enter delivered quantities.`);
          }
        } else {
          // No items on this PO at all
          showWarning('No items found for this PO.');
        }
      }
    } catch (error) {
      console.error('Failed to fetch PO items:', error);
      showError('Failed to load PO items');
    } finally {
      setLoading(false);
    }
  };

  const fetchModalGroups = async () => {
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups || []);
    } catch (error) {
      console.error('Failed to fetch modal groups:', error);
      setModalGroups([]);
    }
  };

  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) {
      setModalSubGroups([]);
      return;
    }

    try {
      const subGroups = await filterApi.getSubGroups(groupName);
      setModalSubGroups(subGroups || []);
    } catch (error) {
      console.error('Failed to fetch modal subgroups:', error);
      setModalSubGroups([]);
    }
  };

  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) {
      setModalProjects([]);
      return;
    }

    try {
      const projects = await filterApi.getProjects(groupName, subGroupName);
      setModalProjects(projects || []);
    } catch (error) {
      console.error('Failed to fetch modal projects:', error);
      setModalProjects([]);
    }
  };

  // ========== MODAL DROPDOWN HANDLERS (COMPLETELY INDEPENDENT) ==========

  const handleModalGroupChange = (val) => {
    const newGroupName = val || '';
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setModalPurchaseOrders([]);
    setModalVendors([]);
    setFormData(prev => ({
      ...prev,
      groupId: newGroupName,
      subGroupId: '',
      projectId: '',
      vendorId: '',
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));
    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
    }
  };

  const handleModalSubGroupChange = async (val) => {
    const newSubGroupName = val || '';
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setModalProjects([]);
    setModalPurchaseOrders([]);
    setModalVendors([]);
    setFormData(prev => ({
      ...prev,
      subGroupId: newSubGroupName,
      projectId: '',
      vendorId: '',
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));
    if (modalGroupName && newSubGroupName) {
      await fetchModalProjects(modalGroupName, newSubGroupName);
    }
  };

  const handleModalProjectChange = async (val) => {
    const newProjectId = val || '';
    setModalProjectId(newProjectId);
    setModalPurchaseOrders([]);
    setModalVendors([]);
    setFormData(prev => ({
      ...prev,
      projectId: newProjectId,
      vendorId: '',
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));
    if (newProjectId) {
      // Pass fresh value directly — don't rely on modalProjectId state (async update lag)
      await fetchModalVendors(modalGroupName, modalSubGroupName, newProjectId);
    }
  };

  const handleModalVendorChange = (val) => {
    const vendorIdOrName = val || '';
    setFormData(prev => ({
      ...prev,
      vendorId: vendorIdOrName,
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));
    setModalPurchaseOrders([]);
    if (vendorIdOrName) {
      const vendorId = typeof vendorIdOrName === 'string' && !vendorIdOrName.startsWith('PO_')
        ? parseInt(vendorIdOrName)
        : vendorIdOrName;
      // Pass scope directly — fresh values, no async-state lag
      fetchModalPurchaseOrders(vendorId, modalGroupName, modalSubGroupName, modalProjectId);
    }
  };

  const handleModalPOChange = (val) => {
    const poId = val || '';
    setFormData(prev => ({
      ...prev,
      poId: poId ? parseInt(poId) : null,
      items: prev.items.filter(item => !item.poItemId)
    }));
    if (poId) {
      fetchPOItems(parseInt(poId));
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
  };

  const handlePageSizeChange = (e) => {
    setPagination(prev => ({
      ...prev,
      pageSize: parseInt(e.target.value),
      currentPage: 0
    }));
  };

  // Checkbox selection
  const handleSelectBill = (billId) => {
    setSelectedBills(prev =>
      prev.includes(billId)
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedBills(bills.map(bill => bill.id));
    } else {
      setSelectedBills([]);
    }
  };

  // ========== VIEW BILL ==========
  const handleViewBill = async (billId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/bills/${billId}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        const bill = await response.json();
        if (!bill.items) bill.items = [];
        if (!bill.paymentHistory) bill.paymentHistory = [];
        setSelectedBill(bill);
        setShowDetailDrawer(true);
      } else {
        showError('Failed to fetch bill details');
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
      showError('Error fetching bill');
    } finally {
      setLoading(false);
    }
  };

  // ========== CREATE BILL ==========
  const handleCreateBill = async () => {
    setEditMode(false);

    // Seed from the page-level header filter values
    const seedGroup = groupName || '';
    const seedSubGroup = subGroupName || '';
    const seedProject = projectId || '';

    setFormData({
      vendorId: '',
      poId: '',
      billNo: '',
      billRefId: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      projectId: seedProject,
      groupId: seedGroup,
      subGroupId: seedSubGroup,
      items: [{
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercent: 18
      }],
      notes: ''
    });

    setModalGroupName(seedGroup);
    setModalSubGroupName(seedSubGroup);
    setModalProjectId(seedProject);
    setModalSubGroups([]);
    setModalProjects([]);
    setModalVendors([]);
    setModalPurchaseOrders([]);
    setSelectedFile(null);

    // Fetch groups (always needed)
    await fetchModalGroups();

    // Pre-fetch cascaded data using seeded values directly — no async state lag
    if (seedGroup) {
      await fetchModalSubGroups(seedGroup);
      if (seedSubGroup) {
        await fetchModalProjects(seedGroup, seedSubGroup);
        if (seedProject) {
          // Pass fresh values directly so the fetch doesn't use stale state
          await fetchModalVendors(seedGroup, seedSubGroup, seedProject);
        }
      }
    }

    setShowCreateEditModal(true);
  };

  // ========== EDIT BILL ==========
  const handleEditBill = async (bill) => {
    setEditMode(true);
    setLoading(true);

    try {
      // Always fetch the full bill detail so we get items[], paymentHistory, etc.
      // The list API returns summary rows without line items.
      let fullBill = bill;
      try {
        const detailRes = await fetch(`${API_BASE_URL}/bills/${bill.id}`, {
          headers: getAuthHeaders(),
          credentials: 'include'
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          if (detailData && detailData.id) {
            fullBill = detailData;
          }
        }
      } catch (detailErr) {
        console.warn('Could not fetch full bill detail for edit, falling back to list data:', detailErr);
      }
      // Use the enriched bill object from here on
      bill = fullBill;
      if (!bill.items) bill.items = [];

      setModalGroupName(bill.groupId || '');
      setModalSubGroupName(bill.subGroupId || '');
      setModalProjectId(bill.projectId || '');

      setModalSubGroups([]);
      setModalProjects([]);
      setModalVendors([]);
      setModalPurchaseOrders([]);

      await fetchModalGroups();

      if (bill.groupId) {
        await fetchModalSubGroups(bill.groupId);
        if (bill.subGroupId) {
          await fetchModalProjects(bill.groupId, bill.subGroupId);
        }
      }

      if (bill.projectId || bill.subGroupId) {
        // Pass fresh values directly — setState above is async, locals are reliable
        await fetchModalVendors(bill.groupId || '', bill.subGroupId || '', bill.projectId || '');
      }

      if (bill.vendorId) {
        await fetchModalPurchaseOrders(bill.vendorId, bill.groupId || '', bill.subGroupId || '', bill.projectId || '');
      }

      let enrichedItems = bill.items && bill.items.length > 0
        ? bill.items.map(it => ({
          ...it,
          // For rows saved before the item_name migration, fall back to description
          itemName: it.itemName || (it.poItemId ? '' : it.description) || '',
        }))
        : [{
          itemName: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxPercent: 18
        }];

      if (bill.poId && bill.items && bill.items.length > 0) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/purchase-orders/${bill.poId}/items-for-bill`,
            {
              credentials: "include",
              headers: getAuthHeaders()
            }
          );

          if (response.ok) {
            const data = await response.json();

            if (data.success && data.items && data.items.length > 0) {
              enrichedItems = bill.items.map(billItem => {
                if (billItem.poItemId) {
                  const poItem = data.items.find(pi => pi.id === billItem.poItemId);
                  if (poItem) {
                    return {
                      ...billItem,
                      // Always pull name/description from the live PO item — the stored
                      // bill_items.item_name may be blank for rows created before the migration.
                      itemName: poItem.itemName || billItem.itemName || '',
                      description: poItem.description || billItem.description || '',
                      orderedQty: poItem.orderedQty,
                      deliveredQty: poItem.deliveredQty,
                      pendingQty: poItem.pendingQty,
                      maxBillableQty: (billItem.quantity || 0) + (poItem.pendingQty || 0),
                      originalBillQty: billItem.quantity,
                      deliveryStatus: poItem.deliveryStatus
                    };
                  }
                }
                return billItem;
              });
            }
            // If data.items is empty (shouldn't happen with includeAll=true, but just in case),
            // enrichedItems stays as-is from the bill detail fetch — items are still shown.
          }
        } catch (error) {
          console.error('Failed to fetch PO items for edit:', error);
        }
      }

      setFormData({
        ...bill,
        billDate: bill.billDate ? bill.billDate.split('T')[0] : '',
        dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : '',
        items: enrichedItems
      });

      setShowDetailDrawer(false);
      setSelectedFile(null);   // ← clear any previously selected file from another bill
      setShowCreateEditModal(true);

    } catch (error) {
      console.error('Error in handleEditBill:', error);
      showError('Failed to load bill for editing');
    } finally {
      setLoading(false);
    }
  };

  // ========== DELETE BILL ==========
  const handleDeleteBill = (billId) => {
    setConfirmModal({
      show: true,
      title: 'Delete Bill',
      message: 'Are you sure you want to delete this bill? This action cannot be undone.',
      type: 'error',
      onConfirm: () => performDeleteBill(billId)
    });
  };

  const performDeleteBill = async (billId) => {
    setConfirmModal({ show: false });
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/bills/${billId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        showSuccess('Bill deleted successfully');
        fetchBills();
        fetchKPIs();
        setShowDetailDrawer(false);
      } else {
        showError('Failed to delete bill');
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      showError('Error deleting bill');
    } finally {
      setLoading(false);
    }
  };

  // ========== SAVE BILL ==========
  const handleSaveBill = async () => {
    if (!formData.vendorId || formData.vendorId === '') {
      showWarning('Please select a vendor');
      return;
    }
    if (!formData.billDate) {
      showWarning('Please select bill date');
      return;
    }
    if (formData.items.length === 0) {
      showWarning('Please add at least one item');
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];

      // Manual items (no PO linked) require an item name
      if (!item.poItemId && (!item.itemName || item.itemName.trim() === '')) {
        showWarning(`Item ${i + 1}: Please enter an item name`);
        return;
      }

      if (!item.quantity || item.quantity <= 0) {
        showWarning(`Item ${i + 1}: Please enter valid quantity`);
        return;
      }

      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
        showWarning(`Item ${i + 1}: Please enter valid price`);
        return;
      }

      if (editMode && item.poItemId && item.maxBillableQty) {
        if (item.quantity > item.maxBillableQty) {
          showWarning(
            `Item ${i + 1}: Quantity (${item.quantity}) exceeds maximum allowed (${item.maxBillableQty}). ` +
            `Max = previous qty (${item.originalBillQty || 0}) + pending (${item.pendingQty || 0})`
          );
          return;
        }
      }
    }

    setLoading(true);
    try {
      const method = editMode ? 'PUT' : 'POST';
      const url = editMode
        ? `${API_BASE_URL}/bills/${formData.id}`
        : `${API_BASE_URL}/bills`;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const savedBill = await response.json();

        if (selectedFile && savedBill.id) {
          await uploadBillFile(savedBill.id, selectedFile);
        }

        showSuccess(editMode ? 'Bill updated successfully' : 'Bill created successfully');
        setShowCreateEditModal(false);
        fetchBills();
        fetchKPIs();
      } else {
        const errorData = await response.json();
        showError(errorData.error || errorData.message || 'Failed to save bill');
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      showError('Error saving bill: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Upload bill file
  const uploadBillFile = async (billId, file) => {
    const formDataFile = new FormData();
    formDataFile.append('file', file);

    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'X-User-Id': user?.id || localStorage.getItem('userId'),
      'X-User-Role': user?.role || localStorage.getItem('userRole')
    };

    try {
      const response = await fetch(`${API_BASE_URL}/bills/${billId}/upload`, {
        method: 'POST',
        headers,
        credentials: "include",
        body: formDataFile
      });

      if (response.ok) {
        showSuccess('File uploaded successfully');
      } else {
        showError('File upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Error uploading file');
    }
  };

  // View bill file in modal — blob approach (bypasses X-Frame-Options)
  const handleViewFile = async (billId) => {
    try {
      const r = await fetch(`${API_BASE_URL}/bills/${billId}/view`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found or could not be loaded'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setFileViewUrl(blobUrl);
      setShowFileViewModal(true);
    } catch { showError('Failed to load bill document'); }
  };

  // Open bill file in a new browser tab — blob approach
  const handleOpenFileInTab = async (billId) => {
    try {
      const r = await fetch(`${API_BASE_URL}/bills/${billId}/view`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch { showError('Failed to open bill document'); }
  };

  // Download bill file — blob approach
  const handleDownloadFile = async (billId, fileName) => {
    try {
      const r = await fetch(`${API_BASE_URL}/bills/${billId}/download`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'bill-document';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    } catch { showError('Failed to download bill document'); }
  };

  // Add payment
  const handleAddPayment = (bill) => {
    setSelectedBill(bill);
    setPaymentData({
      amount: '',
      paymentMode: 'Bank Transfer',
      referenceNumber: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  // Save payment — creates a VendorAdvance (BILL_PAYMENT type), same as Vendor Payments tab
  const handleSavePayment = async () => {
    if (!paymentData.amount) {
      showWarning('Please enter a payment amount');
      return;
    }
    const paymentAmount = parseFloat(paymentData.amount);
    if (paymentAmount <= 0 || paymentAmount > parseFloat(selectedBill.balanceAmount || 0)) {
      showWarning(`Invalid payment amount. Max: ₹${formatCurrency(selectedBill.balanceAmount)}`);
      return;
    }

    setLoading(true);
    try {
      // Create a proper VendorAdvance record (BILL_PAYMENT type) — same as recording via Vendor Payments tab.
      // This ensures the payment appears in Vendor Payments, is linked to the correct project/vendor,
      // and updates the bill balance through the same VendorAdvanceService code path.
      const vendorPaymentData = {
        paymentType: 'BILL_PAYMENT',
        billId: selectedBill.id,
        vendorId: selectedBill.vendorId,
        projectId: selectedBill.projectId,
        groupId: selectedBill.groupId,
        subGroupId: selectedBill.subGroupId,
        advanceDate: paymentData.paymentDate,
        amount: paymentAmount,
        paymentMode: paymentData.paymentMode,
        transactionReference: paymentData.referenceNumber || '',
        notes: paymentData.notes || '',
      };

      const response = await fetch(`${API_BASE_URL}/vendor-advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(vendorPaymentData),
      });

      if (response.ok) {
        showSuccess('Payment recorded successfully! It appears in the Vendor Payments tab.');
        setShowPaymentModal(false);
        setShowDetailDrawer(false);
        fetchBills();
        fetchKPIs();
      } else {
        const errorData = await response.json();
        showError(errorData.message || errorData.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      showError('Error recording payment');
    } finally {
      setLoading(false);
    }
  };

  // ========== MARK AS PAID ==========
  const handleMarkPaid = (billId) => {
    // Find the bill object to check its balance
    const bill = bills.find(b => b.id === billId) || selectedBill;
    const balance = parseFloat(bill?.balanceAmount || 0);

    if (balance > 0) {
      // Bill still has a pending balance — cannot mark as paid without recording receipt
      setConfirmModal({
        show: true,
        title: 'Pending Balance Exists',
        message: `This bill still has a pending balance of ₹${formatCurrency(balance)}. Please record the payment via "Add Payment" with receipt details before marking as fully paid.`,
        type: 'warning',
        confirmText: 'Add Payment Instead',
        onConfirm: () => {
          setConfirmModal({ show: false });
          handleAddPayment(bill);
        }
      });
      return;
    }

    // Balance is already 0 — safe to mark as paid
    setConfirmModal({
      show: true,
      title: 'Mark Bill as Paid',
      message: 'All payments have been recorded. Mark this bill as fully paid?',
      type: 'confirm',
      onConfirm: () => performMarkPaid(billId)
    });
  };

  const performMarkPaid = async (billId) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/bills/${billId}/mark-paid`,
        { method: 'POST', headers: getAuthHeaders(), credentials: 'include' }
      );
      if (response.ok) {
        showSuccess('Bill marked as paid');
        fetchBills();
        fetchKPIs();
        setShowDetailDrawer(false);
      } else {
        const errorData = await response.json();
        const msg = errorData.error || errorData.message || 'Failed to mark bill as paid';
        // If backend says balance still pending, prompt user to add payment
        if (msg.toLowerCase().includes('pending balance') || msg.toLowerCase().includes('add payment')) {
          showError(msg);
        } else {
          showError(msg);
        }
      }
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      showError('Error marking bill as paid');
    } finally {
      setLoading(false);
    }
  };

  // Get payment status badge class
  const getPaymentBadgeClass = (status) => {
    const statusClasses = {
      'Pending': 'procurement-bills-received-badge-pending',
      'Partially Paid': 'procurement-bills-received-badge-partial',
      'Paid': 'procurement-bills-received-badge-paid'
    };
    return statusClasses[status] || '';
  };

  // ========== INDIAN NUMBER FORMAT (SHORT) ==========
  // Converts: 1000 → 1K, 100000 → 1L, 10000000 → 1Cr
  const formatIndianShort = (amount) => {
    const num = parseFloat(amount) || 0;
    if (num >= 10000000) {
      // Crore: 1,00,00,000+
      const val = num / 10000000;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)} Cr`;
    } else if (num >= 100000) {
      // Lakh: 1,00,000+
      const val = num / 100000;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)} L`;
    } else if (num >= 1000) {
      // Thousand: 1,000+
      const val = num / 1000;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} K`;
    } else {
      return num.toLocaleString('en-IN');
    }
  };

  // Full Indian format (for tables and details): 1,14,59,385.6
  const formatCurrency = (amount) => {
    return `${(parseFloat(amount) || 0).toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const s = String(dateStr);
    if (s.length >= 10 && s[4] === '-') {
      const [y, m, d] = s.slice(0, 10).split('-');
      return `${d}-${m}-${y}`;
    }
    const dt = new Date(dateStr);
    const d = String(dt.getDate()).padStart(2, '0');
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    return `${d}-${mo}-${dt.getFullYear()}`;
  };

  // Add item row
  const handleAddItem = () => {
    if (formData) {
      setFormData({
        ...formData,
        items: [...formData.items, {
          itemName: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxPercent: 18
        }]
      });
    }
  };

  // Remove item row — works for all items including PO-linked
  const handleRemoveItem = (index) => {
    if (!formData) return;
    if (formData.items.length <= 1) {
      setFormData({ ...formData, items: [{ itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }] });
      return;
    }
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  // Update item
  const handleUpdateItem = (index, field, value) => {
    if (formData) {
      const newItems = [...formData.items];
      newItems[index] = { ...newItems[index], [field]: value };
      setFormData({ ...formData, items: newItems });
    }
  };

  // File input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showWarning('File size exceeds 10MB limit');
        e.target.value = null;
        return;
      }

      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        showWarning('Invalid file type. Only PDF, PNG, JPG allowed');
        e.target.value = null;
        return;
      }

      setSelectedFile(file);
    }
  };

  // Calculate line total for an item
  const calculateLineTotal = (item) => {
    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
    const tax = subtotal * ((item.taxPercent || 0) / 100);
    return subtotal + tax;
  };

  // Calculate bill total
  const calculateBillTotal = () => {
    if (!formData || !formData.items) return 0;
    return formData.items.reduce((total, item) => total + calculateLineTotal(item), 0);
  };

  // Close columns panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (columnsPanelRef.current && !columnsPanelRef.current.contains(e.target)) {
        setShowColumnsPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const getSortedBills = () => {
    if (!sortConfig.key) return bills;
    return [...bills].sort((a, b) => {
      let aVal = a[sortConfig.key] ?? '';
      let bVal = b[sortConfig.key] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ChevronUp size={13} style={{ opacity: 0.3, marginLeft: 3 }} />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={13} style={{ marginLeft: 3, color: __stc('#6366f1') }} />
      : <ChevronDown size={13} style={{ marginLeft: 3, color: __stc('#6366f1') }} />;
  };

  // Drag-and-drop column reorder
  const handleColDragStart = (key) => { dragColRef.current = key; };
  const handleColDragOver = (e, key) => { e.preventDefault(); dragOverColRef.current = key; };
  const handleColDrop = () => {
    const from = dragColRef.current;
    const to = dragOverColRef.current;
    if (!from || !to || from === to) return;
    setColumnOrder(prev => {
      const arr = [...prev];
      const fi = arr.indexOf(from);
      const ti = arr.indexOf(to);
      arr.splice(fi, 1);
      arr.splice(ti, 0, from);
      return arr;
    });
    dragColRef.current = null;
    dragOverColRef.current = null;
  };

  // Toggle column visibility
  const toggleColumn = (key) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Ordered, visible columns
  const orderedVisibleCols = columnOrder.filter(k => visibleColumns.includes(k));
  const colMeta = Object.fromEntries(BILLS_COLUMNS.map(c => [c.key, c]));

  return (
    <div className="procurement-bills-received-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* CONFIRMATION MODAL */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ show: false })}
      />

      {/* Header */}
      <div className="procurement-bills-received-header">
        <div className="procurement-bills-received-breadcrumb">
          Dashboard &gt; Procurement &gt; Bills Received
        </div>
        <div className="page-header-with-filter">
          <h1 className="procurement-bills-received-title">Bills Received</h1>
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="procurement-bills-received-action-bar">
        <div className="procurement-bills-received-search-filters">
          <div style={{ position: 'relative', flex: 1, minWidth: 200, display: 'flex' }}>
            <input
              type="text"
              placeholder="Search by Bill Ref ID, Bill ID, Vendor Name..."
              className="procurement-bills-received-search"
              style={{ flex: 1, paddingRight: filters.search ? 34 : 16 }}
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPagination(prev => ({ ...prev, currentPage: 0 }));
              }}
              onKeyPress={(e) => e.key === 'Enter' && fetchBills()}
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => { setFilters({ ...filters, search: '' }); setPagination(prev => ({ ...prev, currentPage: 0 })); }}
                className="search-clear-btn"
                title="Clear search"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="bills-filter-select-wrap">
            <FilterSelect
              value={filters.paymentStatus === 'all' ? '' : filters.paymentStatus}
              options={[
                { value: 'Pending', label: 'Pending' },
                { value: 'Partially Paid', label: 'Partially Paid' },
                { value: 'Paid', label: 'Paid' },
              ]}
              placeholder="All Payment Status"
              onChange={(v) => {
                setFilters(prev => ({ ...prev, paymentStatus: v || 'all' }));
                setPagination(prev => ({ ...prev, currentPage: 0 }));
              }}
            />
          </div>
          {/* Bill date range filter */}
          <div className="po-order-date-filter">
            <span className="po-order-date-label">Bill Date:</span>
            <BRDateRangeFilter
              appliedFrom={billDateFrom}
              appliedTo={billDateTo}
              onApply={(f, t) => { setBillDateFrom(f); setBillDateTo(t); setPagination(prev => ({ ...prev, currentPage: 0 })); }}
              onClear={() => { setBillDateFrom(''); setBillDateTo(''); setPagination(prev => ({ ...prev, currentPage: 0 })); }}
            />
          </div>
        </div>

        <div className="procurement-bills-received-actions">
          <div className="col-toggle-wrapper" ref={columnsPanelRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowColumnsPanel(p => !p)}
              title="Toggle Columns"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '8px',
                background: __sbg('#fff'), cursor: 'pointer', fontSize: '14px', color: __stc('#374151'),
                fontWeight: 500
              }}
            >
              <Columns size={16} />
              Columns
            </button>
            {showColumnsPanel && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 999,
                background: __sbg('#fff'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '10px 0', minWidth: '200px'
              }}>
                <div style={{ padding: '6px 14px 10px', fontSize: '12px', fontWeight: 600, color: __stc('#6b7280'), textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${__sbg('#f1f5f9')}` }}>
                  Show / Hide Columns
                </div>
                {BILLS_COLUMNS.map(col => (
                  <div
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 14px', cursor: 'pointer', fontSize: '14px', color: __stc('#374151'),
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 17, height: 17, borderRadius: 4, border: '1.5px solid',
                      borderColor: visibleColumns.includes(col.key) ? __sbg('#6366f1') : __sbg('#d1d5db'),
                      background: visibleColumns.includes(col.key) ? __sbg('#6366f1') : __sbg('#fff'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {visibleColumns.includes(col.key) && <Check size={11} color="#fff" strokeWidth={3} />}
                    </div>
                    {col.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className={`procurement-bills-received-btn-primary${!canCreate ? ' action-btn-disabled' : ''}`} onClick={() => canCreate && handleCreateBill()} disabled={!canCreate} title={!canCreate ? "No create permission" : "Add New Bill"}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            Add New Bill
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {/* Permission notice */}
      {isViewOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: __sbg('#fffbeb'), border: `1px solid ${__sbg('#fde68a')}`, borderRadius: 8, fontSize: 12, color: __stc('#92400e'), fontWeight: 500, marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          You have view-only access. Contact your administrator to request Create, Edit, Approve or Delete permissions.
        </div>
      )}

      <div className="unified-kpi-grid">
        <div className="unified-kpi-card">
          <div className="unified-kpi-icon unified-kpi-icon--blue">
            <FileText size={26} />
          </div>
          <div className="unified-kpi-content">
            <div className="unified-kpi-value">{kpis.totalBills}</div>
            <div className="unified-kpi-label">Total Bills</div>
          </div>
        </div>

        <div className="unified-kpi-card">
          <div className="unified-kpi-icon unified-kpi-icon--purple">
            <IndianRupee size={26} />
          </div>
          <div className="unified-kpi-content">
            <div className="unified-kpi-value">{formatCurrency(kpis.totalAmount)}</div>
            <div className="unified-kpi-label">Total Billed Amount</div>
          </div>
        </div>

        <div className="unified-kpi-card">
          <div className="unified-kpi-icon unified-kpi-icon--green">
            <CheckCircle size={26} />
          </div>
          <div className="unified-kpi-content">
            <div className="unified-kpi-value">{formatCurrency(kpis.paidAmount)}</div>
            <div className="unified-kpi-label">Paid Amount</div>
          </div>
        </div>

        <div className="unified-kpi-card">
          <div className="unified-kpi-icon unified-kpi-icon--amber">
            <AlertCircle size={26} />
          </div>
          <div className="unified-kpi-content">
            <div className="unified-kpi-value">{formatCurrency(kpis.pendingAmount)}</div>
            <div className="unified-kpi-label">Pending Amount</div>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="procurement-bills-received-table-container">
        {/* ✅ Fixed-height scrollable wrapper */}
        <div className="procurement-bills-received-table-scroll-wrapper">
          <table className="procurement-bills-received-table">
            <thead>
              <tr>
                {orderedVisibleCols.map(key => (
                  <th
                    key={key}
                    draggable
                    onDragStart={() => handleColDragStart(key)}
                    onDragOver={(e) => handleColDragOver(e, key)}
                    onDrop={handleColDrop}
                    onClick={() => handleSort(key)}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <GripVertical size={13} style={{ opacity: 0.35, cursor: 'grab', flexShrink: 0 }} />
                      {colMeta[key].label}
                      <SortIcon colKey={key} />
                    </span>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={orderedVisibleCols.length + 1} style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FileText size={48} style={{ color: __stc('#cbd5e1'), marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                    <p style={{ color: __stc('#64748b'), fontSize: '15px', margin: 0 }}>
                      No bills found. Click "Add New Bill" to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                getSortedBills().map(bill => (
                  <tr key={bill.id} className="procurement-bills-received-table-row">
                    {orderedVisibleCols.map(key => {

                      if (key === 'billRefId')
                        return (
                          <td key={key} className="procurement-bills-received-table-id">
                            {bill.billRefId || (
                              <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>
                                —
                              </span>
                            )}
                          </td>
                        );

                      if (key === 'vendorName')
                        return (
                          <td key={key} className="procurement-bills-received-table-vendor">
                            {
                              bill.sourceType === 'WAREHOUSE'
                                ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#7c3aed', fontWeight: 500 }}>
                                    <span>🏭</span>
                                    {bill.warehouseName || 'Warehouse'}
                                  </span>
                                )
                                : (
                                  bill.vendorName || (
                                    <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>
                                      —
                                    </span>
                                  )
                                )
                            }
                          </td>
                        );

                      if (key === 'poNumber') return (
                        <td key={key}>
                          {bill.poRefId || bill.poNumber
                            ? <span>{bill.poRefId || bill.poNumber}</span>
                            : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}
                        </td>
                      );
                      if (key === 'billDate') return <td key={key}>{bill.billDate ? formatDate(bill.billDate) : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'dueDate') return <td key={key}>{bill.dueDate ? formatDate(bill.dueDate) : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'totalAmount') return <td key={key} className="procurement-bills-received-table-amount">{bill.totalAmount != null ? formatCurrency(bill.totalAmount) : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'paidAmount') return <td key={key} className="procurement-bills-received-table-paid">{bill.paidAmount != null ? formatCurrency(bill.paidAmount) : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'balanceAmount') return <td key={key} className="procurement-bills-received-table-balance">{bill.balanceAmount != null ? formatCurrency(bill.balanceAmount) : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'status') return (
                        <td key={key}>
                          {bill.status
                            ? <span className={`procurement-bills-received-badge ${getPaymentBadgeClass(bill.status)}`}>{bill.status}</span>
                            : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}
                        </td>
                      );
                      if (key === 'uploadedByName') return <td key={key}>{bill.uploadedByName || <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'groupName') return <td key={key}>{bill.groupName || <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'category') return <td key={key}>{bill.category || <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}</td>;
                      if (key === 'projectId') {
                        const pName = projectNames[bill.projectId];
                        return (
                          <td key={key} style={{ minWidth: 180 }}>
                            {bill.projectId ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontWeight: 600, fontSize: 12, color: __stc('#1e293b'), whiteSpace: 'nowrap' }}>
                                  {pName || bill.projectId}
                                </span>
                                {pName && (
                                  <span style={{ fontSize: 11, color: __stc('#64748b'), fontWeight: 400, whiteSpace: 'nowrap' }}>
                                    {bill.projectId}
                                  </span>
                                )}
                              </div>
                            ) : <span style={{ color: __stc('#94a3b8'), display: 'block', textAlign: 'center' }}>—</span>}
                          </td>
                        );
                      }
                      return <td key={key} style={{ textAlign: 'center', color: __stc('#94a3b8') }}>—</td>;
                    })}
                    <td>
                      <div className="receipt-action-buttons">
                        {/* View */}
                        <button
                          className={`receipt-action-btn btn-view${!canView ? ' action-btn-disabled' : ''}`}
                          onClick={() => canView && handleViewBill(bill.id)}
                          title={canView ? 'View Details' : '🔒 No view permission'}
                          disabled={!canView}
                        ><Eye size={15} /></button>

                        {/* Edit */}
                        <button
                          className={`receipt-action-btn btn-edit${!canEdit ? ' action-btn-disabled' : ''}`}
                          onClick={() => canEdit && handleEditBill(bill)}
                          title={canEdit ? 'Edit' : '🔒 No edit permission'}
                          disabled={!canEdit}
                        ><Edit2 size={15} /></button>

                        {/* Payment & Mark Paid — unpaid bills only */}
                        {bill.status !== 'Paid' && (
                          <>
                            <button
                              className={`receipt-action-btn btn-adjust${!canEdit ? ' action-btn-disabled' : ''}`}
                              onClick={() => canEdit && handleAddPayment(bill)}
                              title={canEdit ? 'Add Payment' : '🔒 No edit permission'}
                              disabled={!canEdit}
                            ><CreditCard size={15} /></button>
                            <button
                              className={`receipt-action-btn btn-approve${!canApprove ? ' action-btn-disabled' : ''}`}
                              onClick={() => canApprove && handleMarkPaid(bill.id)}
                              title={canApprove ? 'Mark Paid' : '🔒 No approve permission'}
                              disabled={!canApprove}
                            ><Check size={15} /></button>
                          </>
                        )}

                        {/* Delete */}
                        <button
                          className={`receipt-action-btn btn-delete${!canDelete ? ' action-btn-disabled' : ''}`}
                          onClick={() => canDelete && handleDeleteBill(bill.id)}
                          title={canDelete ? 'Delete' : '🔒 No delete permission'}
                          disabled={!canDelete}
                        ><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - outside scroll wrapper so it's always visible */}
        {pagination.totalPages > 0 && (
          <div className="procurement-bills-received-pagination">
            <div className="pagination-info">
              <span>
                Showing {pagination.totalItems === 0 ? 0 : pagination.currentPage * pagination.pageSize + 1} to{' '}
                {Math.min((pagination.currentPage + 1) * pagination.pageSize, pagination.totalItems)} of{' '}
                {pagination.totalItems} bills
              </span>
              <div className="pce-rows-dropdown">
                <FilterSelect
                  value={String(pagination.pageSize)}
                  options={[
                    { value: '10', label: '10 Rows' },
                    { value: '20', label: '20 Rows' },
                    { value: '50', label: '50 Rows' },
                    { value: '100', label: '100 Rows' },
                  ]}
                  placeholder="Rows"
                  onChange={(v) => { if (v) { setPagination(prev => ({ ...prev, pageSize: parseInt(v), currentPage: 0 })); } }}
                />
              </div>
            </div>

            <div className="pagination-controls">
              <button
                onClick={() => handlePageChange(0)}
                disabled={pagination.currentPage === 0}
                className="procurement-bills-received-btn-secondary"
                title="First Page"
              >
                «
              </button>
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 0}
                className="procurement-bills-received-btn-secondary"
              >
                Previous
              </button>

              <span className="page-numbers">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i;
                  } else if (pagination.currentPage < 3) {
                    pageNum = i;
                  } else if (pagination.currentPage > pagination.totalPages - 3) {
                    pageNum = pagination.totalPages - 5 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`page-number ${pagination.currentPage === pageNum ? 'active' : ''}`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </span>

              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages - 1}
                className="procurement-bills-received-btn-secondary"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages - 1)}
                disabled={pagination.currentPage >= pagination.totalPages - 1}
                className="procurement-bills-received-btn-secondary"
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {showCreateEditModal && formData && (
        <div className="bill-form-modal-overlay">
          <div className="bill-form-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="bill-form-modal-header">
              <h2>{editMode ? 'Edit Bill' : 'Create New Bill'}</h2>
              <button className="bill-form-modal-close-btn" onClick={() => setShowCreateEditModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="bill-form-modal-content">
              {/* Project Assignment Section */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Project Assignment</h3>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Group</label>
                    <FilterSelect
                      value={modalGroupName}
                      options={modalGroups}
                      placeholder="Select Group"
                      onChange={handleModalGroupChange}
                    />
                  </div>

                  <div className="bill-form-field">
                    <label className="bill-form-label">Sub Group</label>
                    <FilterSelect
                      value={modalSubGroupName}
                      options={modalSubGroups}
                      placeholder={!modalGroupName ? 'Select Group First' : 'Select Sub Group'}
                      disabled={!modalGroupName}
                      onChange={handleModalSubGroupChange}
                    />
                  </div>
                </div>

                <div className="bill-form-field">
                  <label className="bill-form-label">Project (Optional)</label>
                  <FilterSelect
                    value={modalProjectId}
                    options={modalProjects.map(p => ({ value: p.id, label: p.name + (p.location ? ` - ${p.location}` : '') }))}
                    placeholder={!modalSubGroupName ? 'Select Sub Group First' : 'Select Project (Optional)'}
                    disabled={!modalSubGroupName}
                    onChange={handleModalProjectChange}
                    searchable={true}
                  />
                </div>
              </div>

              {/* Vendor and PO Selection */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Vendor & Purchase Order</h3>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Vendor *</label>
                    <FilterSelect
                      value={formData.vendorId ? String(formData.vendorId) : ''}
                      options={modalVendors.map((v, i) => ({
                        value: String(v.id || i),
                        label: `${v.name}${v.contact ? ' - ' + v.contact : ''}${v.source === 'po_vendor' ? ' (From PO)' : ''}`
                      }))}
                      placeholder="Select Vendor"
                      onChange={handleModalVendorChange}
                    />
                    {modalVendors.length === 0 && modalProjectId && (
                      <small className="bill-form-hint-error">
                        No vendors available for selected project. Select project or create a PO first.
                      </small>
                    )}
                  </div>

                  <div className="bill-form-field">
                    <label className="bill-form-label">Linked PO (Optional)</label>
                    <FilterSelect
                      value={formData.poId ? String(formData.poId) : ''}
                      options={[
                        { value: '', label: 'No PO Link' },
                        ...modalPurchaseOrders.map(po => ({
                          value: String(po.id),
                          label: `${po.poNo} - ${po.vendorName} - ${formatCurrency(po.totalValue)}`
                        }))
                      ]}
                      placeholder="No PO Link"
                      onChange={handleModalPOChange}
                    />
                    {formData.vendorId && modalPurchaseOrders.length === 0 && (
                      <small className="bill-form-hint">No POs found for selected vendor</small>
                    )}
                    {formData.poId && (
                      <small className="bill-form-hint-success">✓ PO items loaded below</small>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Bill Dates</h3>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Bill Date *</label>
                    <BRDatePicker
                      value={formData.billDate}
                      onChange={v => setFormData({ ...formData, billDate: v })}
                      placeholder="Select bill date"
                    />
                  </div>
                  <div className="bill-form-field">
                    <label className="bill-form-label">Due Date</label>
                    <BRDatePicker
                      value={formData.dueDate}
                      onChange={v => setFormData({ ...formData, dueDate: v })}
                      placeholder="Select due date"
                      minDate={formData.billDate}
                    />
                  </div>
                </div>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Bill Ref ID <span style={{ fontSize: '12px', color: __stc('#64748b'), fontWeight: 400 }}>(Vendor's Bill Reference Number)</span></label>
                    <input
                      className="bill-form-input"
                      type="text"
                      value={formData.billRefId || ''}
                      onChange={(e) => setFormData({ ...formData, billRefId: e.target.value })}
                      placeholder="Enter vendor's bill / invoice reference number"
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="bill-form-section">
                <div className="bill-form-section-header">
                  <h3 className="bill-form-section-title">Bill Line Items</h3>
                  <button
                    className="bill-form-add-item-btn"
                    onClick={handleAddItem}
                    type="button"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="bill-form-items-table-container">
                  <table className="bill-form-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Item Name</th>
                        <th style={{ width: '18%' }}>Description</th>
                        {formData.items && formData.items.some(i => i.poItemId) && <th style={{ width: '7%' }}>Ordered</th>}
                        {formData.items && formData.items.some(i => i.poItemId) && <th style={{ width: '7%' }}>Billed</th>}
                        {formData.items && formData.items.some(i => i.poItemId) && <th style={{ width: '7%' }}>Pending</th>}
                        <th style={{ width: formData.items && formData.items.some(i => i.poItemId) ? '10%' : '12%' }}>Bill Qty *</th>
                        <th style={{ width: formData.items && formData.items.some(i => i.poItemId) ? '10%' : '12%' }}>Price *</th>
                        <th style={{ width: '7%' }}>Tax %</th>
                        <th style={{ width: '12%' }}>Line Total</th>
                        <th style={{ width: '7%' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items && formData.items.map((item, index) => (
                        <tr key={index} className="bill-form-item-row">
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="text"
                              placeholder="Item name"
                              value={item.itemName || ''}
                              onChange={(e) => handleUpdateItem(index, 'itemName', e.target.value)}
                              readOnly={!!item.poItemId}
                              style={{
                                backgroundColor: item.poItemId ? __sbg('#f8fafc') : __sbg('white'),
                                cursor: item.poItemId ? 'not-allowed' : 'text'
                              }}
                            />
                          </td>
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="text"
                              placeholder={item.poItemId ? "From PO" : "Description"}
                              value={item.description || ''}
                              onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                              readOnly={!!item.poItemId}
                              style={{
                                backgroundColor: item.poItemId ? __sbg('#f8fafc') : __sbg('white'),
                                cursor: item.poItemId ? 'not-allowed' : 'text'
                              }}
                            />
                            {item.poItemId && (
                              <small style={{ fontSize: '11px', color: __stc('#64748b'), display: 'block', marginTop: '2px' }}>
                                PO Item #{item.poItemId}
                              </small>
                            )}
                          </td>
                          {item.poItemId && (
                            <>
                              <td style={{ color: __stc('#64748b'), fontSize: '13px', textAlign: 'center' }}>
                                {item.orderedQty ?? '-'}
                              </td>
                              <td style={{ color: __stc('#f59e0b'), fontSize: '13px', textAlign: 'center', fontWeight: 600 }}>
                                {item.deliveredQty ?? '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {item.pendingQty != null ? (
                                  <span style={{
                                    display: 'inline-block',
                                    background: item.pendingQty > 0 ? __sbg('#dcfce7') : __sbg('#fee2e2'),
                                    color: item.pendingQty > 0 ? __stc('#15803d') : __stc('#dc2626'),
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    borderRadius: '5px',
                                    padding: '2px 8px',
                                    minWidth: 28,
                                    textAlign: 'center'
                                  }}>
                                    {item.pendingQty}
                                  </span>
                                ) : '-'}
                              </td>
                            </>
                          )}
                          {!item.poItemId && formData.items && formData.items.some(i => i.poItemId) && (
                            <><td /><td /><td /></>
                          )}
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="number"
                              placeholder="Qty"
                              value={item.quantity || ''}
                              onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              max={item.maxBillableQty || undefined}
                              step="0.01"
                              style={{
                                borderColor: item.maxBillableQty && item.quantity > item.maxBillableQty ? __sbg('#ef4444') : undefined
                              }}
                            />
                            {item.poItemId && item.maxBillableQty != null && (() => {
                              const entered = parseFloat(item.quantity) || 0;
                              const original = item.originalBillQty || 0;
                              const pending = item.pendingQty || 0;
                              const max = original + pending;
                              const over = entered > max;
                              const pct = max > 0 ? Math.min(100, (entered / max) * 100) : 0;
                              // Remaining pending on PO after this bill saves
                              // = current pending - (new qty - original qty)
                              const pendingAfter = pending - (entered - original);
                              return (
                                <div style={{ marginTop: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: 2 }}>
                                    <span style={{ color: __stc('#64748b') }}>
                                      {entered} / {max}
                                    </span>
                                    <span style={{ fontWeight: 600, color: over ? __stc('#dc2626') : pendingAfter <= 0 ? __stc('#15803d') : __stc('#0369a1') }}>
                                      {over
                                        ? `⚠ over by ${entered - max}`
                                        : pendingAfter <= 0
                                          ? '✓ fully billed'
                                          : `${pendingAfter} pending after save`}
                                    </span>
                                  </div>
                                  <div style={{ height: 4, background: __sbg('#e2e8f0'), borderRadius: 999, overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${pct}%`,
                                      background: over ? __sbg('#ef4444') : pct >= 80 ? __sbg('#f59e0b') : __sbg('#22c55e'),
                                      borderRadius: 999,
                                      transition: 'width 0.2s'
                                    }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="number"
                              placeholder="Price"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              readOnly={false}
                              style={{ backgroundColor: __sbg('white') }}
                            />
                            {item.poItemId && (
                              <small style={{ fontSize: '11px', color: __stc('#64748b'), display: 'block', marginTop: '2px' }}>
                                From PO
                              </small>
                            )}
                          </td>
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="number"
                              placeholder="Tax %"
                              value={item.taxPercent || ''}
                              onChange={(e) => handleUpdateItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <span className="bill-form-line-total">
                              {formatCurrency(calculateLineTotal(item))}
                            </span>
                          </td>
                          <td>
                            {true && (
                              <button
                                className="bill-form-remove-item-btn"
                                onClick={() => handleRemoveItem(index)}
                                type="button"
                                title="Remove item"
                                style={{ background: __sbg('#fee2e2'), border: `1px solid ${__sbg('#fca5a5')}`, borderRadius: '4px', padding: '3px 8px', color: __stc('#dc2626'), cursor: 'pointer', fontWeight: 600 }}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bill Total */}
                <div className="bill-form-total-row">
                  <strong>Total Bill Amount:</strong>
                  <span className="bill-form-total-amount">{formatCurrency(calculateBillTotal())}</span>
                </div>

                {editMode && formData.poId && (
                  <div className="bill-form-edit-warning">
                    <strong>⚠️ Edit Mode:</strong> You can adjust quantities within the available limits shown above. Price and tax are locked for PO items.
                  </div>
                )}
              </div>

              {/* File Upload */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Bill Document</h3>
                {editMode && formData.billFilePath && (
                  <div className="bill-edit-existing-file">
                    <div className="bill-edit-existing-file-info">
                      <FileText size={16} />
                      <span>{formData.billFileName || 'Uploaded document'}</span>
                      {formData.billFileSize && (
                        <span className="bill-edit-file-size">({(formData.billFileSize / 1024).toFixed(1)} KB)</span>
                      )}
                    </div>
                    <div className="bill-edit-existing-file-actions">
                      <button
                        type="button"
                        className="bill-edit-file-btn bill-edit-file-btn-view"
                        onClick={() => handleViewFile(formData.id)}
                      >
                        <Eye size={13} /> View File
                      </button>
                    </div>
                  </div>
                )}
                <div className="bill-form-field" style={{ marginTop: editMode && formData.billFilePath ? 10 : 0 }}>
                  <label className="bill-form-label">
                    {editMode && formData.billFilePath ? 'Replace Document (PDF, PNG, JPG - Max 10MB)' : 'Upload Bill (PDF, PNG, JPG - Max 10MB)'}
                  </label>
                  <input
                    className="bill-form-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                  {selectedFile && (
                    <p className="bill-form-file-selected">✓ {selectedFile.name} selected</p>
                  )}
                  {editMode && !formData.billFilePath && !selectedFile && (
                    <p className="bill-form-file-hint">No document uploaded yet.</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Additional Notes</h3>
                <div className="bill-form-field">
                  <label className="bill-form-label">Notes (Optional)</label>
                  <textarea
                    className="bill-form-textarea"
                    rows="3"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="bill-form-modal-actions">
              <button className="bill-form-save-btn" onClick={handleSaveBill}>
                {editMode ? 'Update Bill' : 'Create Bill'}
              </button>
              <button className="bill-form-cancel-btn" onClick={() => setShowCreateEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {showDetailDrawer && selectedBill && (
        <div className="procurement-bills-received-drawer-overlay">
          <div className="procurement-bills-received-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-bills-received-drawer-header">
              <div>
                <h2>{selectedBill.billNo}</h2>
                <p className="procurement-bills-received-drawer-vendor">
                  {selectedBill.sourceType === 'WAREHOUSE'
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#7c3aed', fontWeight: 600 }}>
                      🏭 {selectedBill.warehouseName || 'Warehouse'} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>(Warehouse Issuance)</span>
                    </span>
                    : selectedBill.vendorName}
                </p>
              </div>
              <button className="procurement-bills-received-drawer-close" onClick={() => setShowDetailDrawer(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="procurement-bills-received-drawer-content">
              {/* Status and Dates */}
              <div className="procurement-bills-received-drawer-section">
                <div className="procurement-bills-received-drawer-badges">
                  <span className={`procurement-bills-received-badge ${getPaymentBadgeClass(selectedBill.status)}`}>
                    {selectedBill.status}
                  </span>
                  <span className="procurement-bills-received-drawer-date">
                    Due: {formatDate(selectedBill.dueDate)}
                  </span>
                </div>
              </div>

              {/* Bill Overview */}
              <div className="procurement-bills-received-drawer-section">
                <h3>Bill Overview</h3>
                <div className="procurement-bills-received-info-grid">
                  <div className="procurement-bills-received-info-item">
                    <label>Bill Date:</label>
                    <span>{formatDate(selectedBill.billDate)}</span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Due Date:</label>
                    <span>{formatDate(selectedBill.dueDate)}</span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Bill Ref ID:</label>
                    <span>{selectedBill.billRefId || '—'}</span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Total Amount:</label>
                    <span className="procurement-bills-received-amount-highlight">
                      ₹{formatCurrency(selectedBill.totalAmount)}
                    </span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Balance Due:</label>
                    <span className="procurement-bills-received-balance-highlight">
                      ₹{formatCurrency(selectedBill.balanceAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Traceability */}
              {(selectedBill.quotationId || selectedBill.poNumber) && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Traceability</h3>
                  <div className="procurement-bills-received-traceability">
                    {selectedBill.quotationId && (
                      <div className="procurement-bills-received-trace-item">
                        <span className="procurement-bills-received-trace-label">Quotation:</span>
                        <span className="procurement-bills-received-link">{selectedBill.quotationId}</span>
                      </div>
                    )}
                    {selectedBill.poNumber && (
                      <div className="procurement-bills-received-trace-item">
                        <span className="procurement-bills-received-trace-label">Purchase Order:</span>
                        <span className="procurement-bills-received-link">{selectedBill.poNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Line Items */}
              {selectedBill.items && selectedBill.items.length > 0 && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Bill Line Items</h3>
                  <table className="procurement-bills-received-items-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Tax %</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.items.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <strong>{item.itemName || 'N/A'}</strong>
                            {item.poItemId && (
                              <div style={{ fontSize: '11px', color: __stc('#64748b'), marginTop: '2px' }}>
                                PO Item #{item.poItemId}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '13px', color: __stc('#64748b') }}>
                            {item.description || '-'}
                          </td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{item.taxPercent}%</td>
                          <td>{formatCurrency(item.lineTotal || calculateLineTotal(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment Section */}
              <div className="procurement-bills-received-drawer-section">
                <h3>Payment Information</h3>
                <div className="procurement-bills-received-payment-summary">
                  <div className="procurement-bills-received-payment-stat">
                    <label>Total Paid:</label>
                    <span className="procurement-bills-received-paid-amount">
                      ₹{formatCurrency(selectedBill.paidAmount)}
                    </span>
                  </div>
                  <div className="procurement-bills-received-payment-stat">
                    <label>Remaining Balance:</label>
                    <span className="procurement-bills-received-balance-amount">
                      ₹{formatCurrency(selectedBill.balanceAmount)}
                    </span>
                  </div>
                </div>

                {selectedBill.paymentHistory && selectedBill.paymentHistory.length > 0 && (
                  <>
                    <h4>Payment History</h4>
                    <table className="procurement-bills-received-payment-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Mode</th>
                          <th>Reference No.</th>
                          <th>Amount</th>
                          <th>Paid By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBill.paymentHistory.map((payment, idx) => (
                          <tr key={idx}>
                            <td>{formatDate(payment.paymentDate)}</td>
                            <td>{payment.paymentMode}</td>
                            <td>{payment.referenceNumber}</td>
                            <td>₹{formatCurrency(payment.amount)}</td>
                            <td>{payment.paidByName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Warehouse issuance — info note only (payment recorded in Payment History above) */}
                {selectedBill.sourceType === 'WAREHOUSE' && (
                  <div style={{ marginTop: 12, padding: '8px 10px', background: '#ede9fe', borderRadius: 6, fontSize: 12, color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                    ℹ️ This bill was auto-generated when items were issued from <strong>{selectedBill.warehouseName || 'warehouse'}</strong>. Since the stock was already purchased via a vendor PO, the balance is <strong>₹0.00</strong> — no further payment is needed.
                  </div>
                )}
              </div>

              {/* Bill Document */}
              {selectedBill.billFilePath && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Bill Document</h3>
                  <div className="procurement-bills-received-attachments">
                    <div className="procurement-bills-received-attachment-item">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} /> {selectedBill.billFileName}
                        {selectedBill.billFileSize && (
                          <span style={{ fontSize: 11, color: __stc('#94a3b8') }}>
                            ({(selectedBill.billFileSize / 1024).toFixed(1)} KB)
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          className="procurement-bills-received-btn-link"
                          onClick={() => handleViewFile(selectedBill.id)}
                        >
                          <Eye size={14} /> View File
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedBill.notes && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Notes</h3>
                  <div className="procurement-bills-received-notes">
                    <div className="procurement-bills-received-note-item">
                      {selectedBill.notes}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="procurement-bills-received-drawer-actions">
                {selectedBill.sourceType !== 'WAREHOUSE' && (
                  <button
                    className="procurement-bills-received-btn-secondary"
                    onClick={() => handleEditBill(selectedBill)}
                  >
                    <Edit2 size={18} style={{ marginRight: '8px' }} />
                    Edit Bill
                  </button>
                )}
                {selectedBill.status !== 'Paid' && selectedBill.sourceType !== 'WAREHOUSE' && (
                  <>
                    <button
                      className="procurement-bills-received-btn-primary"
                      onClick={() => {
                        handleAddPayment(selectedBill);
                        setShowDetailDrawer(false);
                      }}
                    >
                      <CreditCard size={18} style={{ marginRight: '8px' }} />
                      Add Payment
                    </button>
                    <button
                      className="procurement-bills-received-btn-secondary"
                      onClick={() => handleMarkPaid(selectedBill.id)}
                    >
                      <Check size={18} style={{ marginRight: '8px' }} />
                      Mark Fully Paid
                    </button>
                  </>
                )}
                {selectedBill.sourceType === 'WAREHOUSE' && (
                  <div style={{ padding: '8px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} /> Auto-paid from warehouse stock — no payment action needed
                  </div>
                )}
                {selectedBill.billFilePath && (
                  <button
                    className="procurement-bills-received-btn-secondary"
                    onClick={() => handleDownloadFile(selectedBill.id, selectedBill.billFileName)}
                  >
                    <Download size={18} style={{ marginRight: '8px' }} />
                    Download Bill
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentData && selectedBill && (
        <div className="procurement-bills-received-modal-overlay">
          <div className="procurement-bills-received-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-bills-received-modal-header">
              <h2>Record Payment</h2>
              <button className="procurement-bills-received-modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="procurement-bills-received-form">
              {/* Bill summary */}
              <div className="procurement-bills-received-payment-info">
                <div className="procurement-bills-received-info-item">
                  <label>Bill:</label>
                  <span><strong>{selectedBill.billNo}</strong></span>
                </div>
                {selectedBill.sourceType === 'WAREHOUSE' ? (
                  <div className="procurement-bills-received-info-item">
                    <label>Warehouse:</label>
                    <span style={{ color: '#7c3aed', fontWeight: 600 }}>🏭 {selectedBill.warehouseName || 'Warehouse'}</span>
                  </div>
                ) : selectedBill.vendorName && (
                  <div className="procurement-bills-received-info-item">
                    <label>Vendor:</label>
                    <span>{selectedBill.vendorName}</span>
                  </div>
                )}
                {selectedBill.projectId && (
                  <div className="procurement-bills-received-info-item">
                    <label>Project:</label>
                    <span>{selectedBill.projectId}</span>
                  </div>
                )}
                <div className="procurement-bills-received-info-item">
                  <label>Total Amount:</label>
                  <span>₹{formatCurrency(selectedBill.totalAmount)}</span>
                </div>
                <div className="procurement-bills-received-info-item">
                  <label>Already Paid:</label>
                  <span style={{ color: __stc('#059669'), fontWeight: 600 }}>₹{formatCurrency(selectedBill.paidAmount)}</span>
                </div>
                <div className="procurement-bills-received-info-item">
                  <label>Balance Due:</label>
                  <span className="procurement-bills-received-balance-highlight">₹{formatCurrency(selectedBill.balanceAmount)}</span>
                </div>
              </div>

              {/* Info banner */}
              <div style={{ padding: '10px 14px', background: __sbg('#f5f3ff'), border: `1px solid ${__sbg('#ddd6fe')}`, borderRadius: '6px', fontSize: '13px', color: __stc('#6d28d9'), marginBottom: '16px' }}>
                💡 This payment will be recorded as a Vendor Payment (Bill Payment) and will appear in the Vendor Payments tab.
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Payment Amount *</label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder={`Max: ₹${formatCurrency(selectedBill.balanceAmount)}`}
                  max={selectedBill.balanceAmount}
                  step="0.01"
                  min="0"
                />
                <small style={{ color: __stc('#64748b') }}>Max: ₹{formatCurrency(selectedBill.balanceAmount)}</small>
              </div>

              <div className="procurement-bills-received-form-row">
                <div className="procurement-bills-received-form-group">
                  <label>Payment Mode *</label>
                  <FilterSelect
                    value={paymentData.paymentMode}
                    options={[
                      { value: 'Bank Transfer', label: 'Bank Transfer' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'Cheque', label: 'Cheque' },
                      { value: 'NEFT', label: 'NEFT' },
                      { value: 'RTGS', label: 'RTGS' },
                      { value: 'Cash', label: 'Cash' },
                    ]}
                    placeholder="Select Payment Mode"
                    onChange={(v) => setPaymentData({ ...paymentData, paymentMode: v || 'Bank Transfer' })}
                  />
                </div>
                <div className="procurement-bills-received-form-group">
                  <label>Payment Date *</label>
                  <BRDatePicker
                    value={paymentData.paymentDate}
                    onChange={v => setPaymentData({ ...paymentData, paymentDate: v })}
                    placeholder="Select payment date"
                  />
                </div>
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Transaction Reference</label>
                <input
                  type="text"
                  value={paymentData.referenceNumber}
                  onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
                  placeholder="UTR / Cheque No / Reference Number"
                />
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Notes</label>
                <textarea
                  rows="2"
                  value={paymentData.notes || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Add any notes..."
                ></textarea>
              </div>
            </div>

            <div className="procurement-bills-received-modal-actions">
              <button className="procurement-bills-received-btn-primary" onClick={handleSavePayment}>
                Record Payment
              </button>
              <button className="procurement-bills-received-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File View Modal — uses bill-file-view-overlay so it sits above the edit modal */}
      {showFileViewModal && fileViewUrl && (
        <div
          className="bill-file-view-overlay"
        >
          <div
            className="procurement-bills-received-file-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bill-file-preview-header">
              <span className="bill-file-preview-title">
                <FileText size={16} /> Bill Document Preview
              </span>
              <div className="bill-file-preview-actions">
                <button
                  className="bill-file-preview-btn bill-file-preview-btn-open"
                  onClick={() => window.open(fileViewUrl, '_blank')}
                >
                  <ExternalLink size={13} /> Open in Tab
                </button>
                <button
                  className="bill-file-preview-btn bill-file-preview-btn-download"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = fileViewUrl;
                    a.download = selectedBill?.billFileName || 'bill-document';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  <Download size={13} /> Download
                </button>
                <button
                  className="procurement-bills-received-modal-close"
                  onClick={() => {
                    window.URL.revokeObjectURL(fileViewUrl);
                    setFileViewUrl(null);
                    setShowFileViewModal(false);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Iframe */}
            <iframe
              src={fileViewUrl}
              className="bill-file-preview-iframe"
              title="Bill Document"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsManagementPage;