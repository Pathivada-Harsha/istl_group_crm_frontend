import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Filter, Download, X, Edit2, Eye, Check, XCircle, FileText, Upload,
  Clock, CheckCircle, Star, AlertCircle,
  ShoppingCart, Trash2, Columns, GripVertical, ChevronUp, ChevronDown, ChevronsUpDown,
  FileSpreadsheet
} from 'lucide-react';
import '../pages-css/Procurement-Quatation-Recieved.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import FilterSelect from "./../components/Dropdowns/FilterSelect.js";
import GeneratePoModal from "./GeneratePoModal.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal';
import filterApi from '../services/filterApi';
import * as XLSX from 'xlsx';
import ItemNameAutocomplete from '../components/OrderBook/ItemNameAutocomplete.js';
import UnitTypeDropdown, { COMMON_UNITS } from '../components/Dropdowns/Unittypedropdown.js';
import BomItemPicker from '../components/procurement/BomItemPicker.js';
import BomViolationDialog from '../components/procurement/BomViolationDialog.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ── Column definitions ───────────────────────────────────────────────────────
const ALL_QUOTATION_COLUMNS = [
  { id: 'sNo',           label: 'S.No',           visible: true,  fixed: true  },
  { id: 'rfqId',         label: 'RFQ ID',         visible: true },
  { id: 'quotationNo',   label: 'Quotation No',   visible: false },
  { id: 'vendorId',      label: 'Vendor Name',    visible: true },
  { id: 'quotationValue',label: 'Quotation Value',visible: true },
  { id: 'uploadedOn',    label: 'Uploaded On',    visible: true },
  { id: 'category',      label: 'Category',       visible: false },
  { id: 'validUntil',    label: 'Valid Until',     visible: true },
  { id: 'file',          label: 'File',            visible: false },
  { id: 'status',        label: 'Status',          visible: true },
  { id: 'group',         label: 'Group',           visible: false },
  { id: 'project',       label: 'Project',         visible: true },
  { id: 'actions',       label: 'Actions',         visible: true, fixed: true },
];

const SORTABLE_COLUMNS = new Set([
  'quotationNo', 'vendorId', 'rfqId', 'category',
  'quotationValue', 'validUntil', 'status', 'uploadedOn',
]);

// ── Sort icon component ──────────────────────────────────────────────────────
const SortIcon = ({ columnId, sortConfig }) => {
  if (sortConfig.key !== columnId)
    return <ChevronsUpDown size={12} style={{ opacity: 0.35, marginLeft: 4, verticalAlign: 'middle' }} />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#2563eb' }} />
    : <ChevronDown size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#2563eb' }} />;
};

// ── Validation sets for import ───────────────────────────────────────────────
const VALID_GST = new Set([0, 5, 12, 18, 28]);
const GST_OPTIONS = [0, 5, 12, 18, 28];

/**
 * Item sources. The project BOM leads because it is what actually needs buying;
 * the order book describes what was sold to the customer.
 */
const QR_ITEM_SOURCES = [
  { key: 'bom',       icon: '🧾', label: 'From Project BOM', hint: 'What the project still needs to buy' },
  { key: 'orderbook', icon: '📦', label: 'From Order Book',  hint: 'What was sold to the customer' },
  { key: 'manual',    icon: '✏️', label: 'Add manually',     hint: 'Type the lines, or import from Excel' },
];
const CATEGORIES = [
  'Manufacturer',
  'Supplier',
  'Distributor',
  'Trader',
  'Dealer',
  'Sub-Contractor',
  'Service Provider',
  'Consultant',
  'Other',
];

// ── Shared with Vendor Management page ──────────────────────────────────────
const VENDOR_CATEGORIES = ['Manufacturing', 'Supplier', 'Services', 'Electrical', 'Civil & Structural', 'Instrumentation', 'IoT Hardware', 'Logistics & Transport'];
const VENDOR_TYPES      = ['Manufacturer', 'Distributor', 'Service Provider', 'Contractor', 'System Integrator', 'Trader'];


// ── Date picker constants ────────────────────────────────────────────────────
const _QR_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _QR_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── QRDatePicker — single date picker, compact (same as PO Create Modal) ─────
const QRDatePicker = ({ value, onChange, placeholder = 'Select date', minDate }) => {
  const [show,    setShow]    = useState(false);
  const [calMo,   setCalMo]   = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth());
  const [calYr,   setCalYr]   = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear());
  const [showYrP, setShowYrP] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const open = () => {
    if (value) { setCalMo(parseInt(value.slice(5,7))-1); setCalYr(parseInt(value.slice(0,4))); }
    setShowYrP(false);
    setShow(true);
  };

  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);
  const fmtD = d => { if (!d) return null; const [y,m,dy] = d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%' }}>
      <button type="button"
        className={`po-dtp-trigger${show?' po-dtp--open':''}${value?' po-dtp--set':''}`}
        onClick={show ? () => setShow(false) : open}
        style={{ width:'100%' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink:0, color: value ? '#4f46e5' : '#94a3b8' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        {value
          ? <span style={{ flex:1, fontSize:13, fontWeight:600, color:'#0f172a' }}>{fmtD(value)}</span>
          : <span className="po-dtp-ph">{placeholder}</span>}
        {value
          ? <span className="po-dtp-x" onClick={e => { e.stopPropagation(); onChange(''); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ marginLeft:'auto', color:'#94a3b8', transform:show?'rotate(180deg)':'none', transition:'transform .2s', flexShrink:0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>}
      </button>
      {show && (
        <div className="po-dtp-dropdown"
          style={{ position:'absolute', top:'calc(100% + 4px)', left:0, width:280, zIndex:1050 }}>
          <div className="po-dtp-cal-head">
            <button type="button" className="po-cal-nav"
              onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="po-dtp-month" onClick={() => setShowYrP(p => !p)}>
              {_QR_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="po-cal-nav"
              onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
          {showYrP ? (
            <div className="po-yr-grid">
              {Array.from({length:16},(_,i) => {
                const yr = new Date().getFullYear()-4+i;
                return <div key={yr} className={`po-yr-cell${yr===calYr?' po-yr-sel':''}`}
                  onClick={() => { setCalYr(yr); setShowYrP(false); }}>{yr}</div>;
              })}
            </div>
          ) : (
            <div className="po-dtp-grid">
              {_QR_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy = i+1;
                const ds = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const isMin = minDate && ds < minDate;
                let cls = 'po-cal-cell';
                if (ds === value) cls += ' po-dtp-sel';
                else if (ds === tod) cls += ' po-cal-today';
                if (isMin) cls += ' po-cal-empty';
                return (
                  <div key={ds} className={cls}
                    onClick={() => { if (!isMin) { onChange(ds); setShow(false); } }}>
                    {dy}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── QRDateRangeFilter — uploaded date range picker (mirrors PO page) ──────────
const QRDateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  const [show,  setShow]  = React.useState(false);
  const [from,  setFrom]  = React.useState(null);
  const [to,    setTo]    = React.useState(null);
  const [hover, setHover] = React.useState(null);
  const [calMo, setCalMo] = React.useState(new Date().getMonth());
  const [calYr, setCalYr] = React.useState(new Date().getFullYear());
  const [showYr,setShowYr]= React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);
  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);
  const inR = d => {
    const hi = to || (from && hover ? hover : null);
    if (!from || !hi) return false;
    const [a,b] = from<=hi ? [from,hi] : [hi,from];
    return d > a && d < b;
  };
  const clickDay = d => {
    if (!from || (from && to)) { setFrom(d); setTo(null); }
    else if (d < from) { setFrom(d); setTo(null); }
    else if (d === from) { setFrom(null); setTo(null); }
    else setTo(d);
  };
  const fmt = d => { if (!d) return ''; const [y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };
  const handleApply = () => { if (!from) return; onApply(from, to || from); setShow(false); };
  const handleClear = () => { setFrom(null); setTo(null); setHover(null); onClear(); setShow(false); };
  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex' }}>
      <button type="button"
        className={`po-cal-trigger${show?' po-cal--open':''}${appliedFrom?' po-cal--applied':''}`}
        onClick={() => setShow(p => !p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>{appliedFrom ? fmt(appliedFrom) : 'dd-mm-yyyy'}</span>
        <span className="po-cal-sep">—</span>
        <span className={appliedTo && appliedTo !== appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>
          {appliedTo && appliedTo !== appliedFrom ? fmt(appliedTo) : 'dd-mm-yyyy'}
        </span>
        {appliedFrom && <span className="po-cal-x" onClick={e => { e.stopPropagation(); handleClear(); }}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
        </span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft:'auto', color:'#94a3b8', flexShrink:0, transform:show?'rotate(180deg)':'none', transition:'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {show && (
        <div className="po-cal-dropdown" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, width:264 }}>
          <div className="po-cal-head">
            <button type="button" className="po-cal-nav" onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button type="button" className="po-cal-month-btn" onClick={() => setShowYr(p => !p)}>
              {_QR_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="po-cal-nav" onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          {showYr ? (
            <div className="po-yr-grid">
              {Array.from({length:16},(_,i) => { const yr=new Date().getFullYear()-4+i; return (
                <div key={yr} className={`po-yr-cell${yr===calYr?' po-yr-sel':''}`} onClick={() => { setCalYr(yr); setShowYr(false); }}>{yr}</div>
              );})}
            </div>
          ) : (
            <div className="po-cal-grid">
              {_QR_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy=i+1, ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`, dow=(FD+i)%7;
                let cls='po-cal-cell';
                if(ds===from) cls+=' po-cal-from'; else if(ds===to) cls+=' po-cal-to';
                else if(inR(ds)){ cls+=' po-cal-in-range'; if(dow===0) cls+=' po-cal-rr-s'; if(dow===6) cls+=' po-cal-rr-e'; }
                if(ds===tod && ds!==from && ds!==to) cls+=' po-cal-today';
                return <div key={ds} className={cls} onClick={() => clickDay(ds)} onMouseEnter={() => from && !to && setHover(ds)} onMouseLeave={() => setHover(null)}>{dy}</div>;
              })}
            </div>
          )}
          <div className="po-cal-footer">
            <div className="po-cal-chips">
              <span className={`po-cal-chip${from?' po-cal-chip--set':''}`}>{from ? fmt(from) : 'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
              <span className={`po-cal-chip${to?' po-cal-chip--set':''}`}>{to ? fmt(to) : 'To —'}</span>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%' }}>
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

// ── Main Component ────────────────────────────────────────────────────────────
const QuotationsReceived = () => {
  const [quotations, setQuotations] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCreatePOFromQuotationModal, setShowCreatePOFromQuotationModal] = useState(false);
  const [poFormData, setPOFormData] = useState(null);
  // Generate PO-PDF modal (opened right after a PO is created, like the Purchase Orders page)
  const [genPo, setGenPo] = useState(null);
  const [genVendor, setGenVendor] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all' });

  // ── Uploaded date range filter ────────────────────────────────────────────
  const [uploadedFrom, setUploadedFrom] = useState('');
  const [uploadedTo,   setUploadedTo]   = useState('');

  // ── Custom vendor category/type (when "Other" is selected) ───────────────
  const [customVendorCategory, setCustomVendorCategory] = useState('');
  const [customVendorType,     setCustomVendorType]     = useState('');
  const [orderBookItems, setOrderBookItems] = useState([]);

  // ── Project BOM sourcing ──────────────────────────────────────────────────
  // Items no longer auto-load when a project is picked; the user chooses a source.
  const [itemSource, setItemSource]       = useState(null);   // 'bom' | 'orderbook' | 'manual'
  const [showBomPicker, setShowBomPicker] = useState(false);
  // Warnings returned by the backend after saving. A quotation only records what a
  // vendor sent, so off-BOM lines and over-quantities are reported, never blocked.
  const [bomWarnings, setBomWarnings]     = useState(null);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [focusedField, setFocusedField] = useState(null); // tracks 'qty-N' or 'rate-N'

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ── Column state (drag + visibility) ────────────────────────────────────
  const COLUMN_VERSION = 'v6'; // bumped: RFQ ID moved to 2nd column after S.No
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('quotationColumns');
      const version = localStorage.getItem('quotationColumnsVersion');
      if (saved && version === COLUMN_VERSION) {
        const parsed = JSON.parse(saved);
        // Merge: ensure any new columns that don't exist in cache are added
        const savedIds = new Set(parsed.map(c => c.id));
        const merged = [...parsed];
        ALL_QUOTATION_COLUMNS.forEach(col => {
          if (!savedIds.has(col.id)) merged.push(col);
        });
        return merged;
      }
      return ALL_QUOTATION_COLUMNS;
    } catch { return ALL_QUOTATION_COLUMNS; }
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // ── Drag-and-drop table column state ────────────────────────────────────
  const [draggedColIndex, setDraggedColIndex] = useState(null);
  const [dragOverColIndex, setDragOverColIndex] = useState(null);

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // ── Excel import state ───────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const xlsxFileRef = useRef(null);

  // Detail drawer and modals
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [showUploadQuotationModal, setShowUploadQuotationModal] = useState(false);
  const [quotationFormData, setQuotationFormData] = useState(null);
  const [stats, setStats] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Modal dropdown state
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  // Vendor state
  const [vendors, setVendors] = useState([]);
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  // Real permission checks from pagePermissions
  const quotPerms  = pagePermissions?.PROCUREMENT_QUOTATIONS || [];
  // Pure DB-driven permissions — no role overrides
  const canView    = quotPerms.includes('VIEW');
  const canCreate  = quotPerms.includes('CREATE');
  const canEdit    = quotPerms.includes('EDIT');
  const canApprove = quotPerms.includes('APPROVE');
  const canDelete  = quotPerms.includes('DELETE');

  // ── Confirm modal state ──────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', type: 'error', onConfirm: null });

  // ── Persist column config ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('quotationColumns', JSON.stringify(columns));
    localStorage.setItem('quotationColumnsVersion', COLUMN_VERSION);
  }, [columns]);

  // ── Data fetching effects ────────────────────────────────────────────────
  // AbortController + Promise.all: fetches the quotation list and KPI stats
  // simultaneously with identical filter params. When any filter/page dep
  // changes, the cleanup aborts both in-flight requests before starting new
  // ones — eliminating race conditions where a slower earlier response
  // (e.g. search='A') could arrive after a faster later response and
  // overwrite correct KPI values with stale data.
  // Clear stale data immediately when logged-in user changes
  useEffect(() => {
    setQuotations([]);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadAll = async () => {
      setLoading(true);
      try {
        // Quotation list params — force uploadedAt ASC when date filter active
        const isDateFiltered = !!(uploadedFrom || uploadedTo);
        const quotParams = new URLSearchParams({
          page: currentPage, size: pageSize,
          sortBy: isDateFiltered ? 'uploadedAt' : 'uploadedAt',
          sortDirection: isDateFiltered ? 'ASC' : 'DESC'
        });
        if (groupName)    quotParams.append('groupName',    groupName);
        if (subGroupName) quotParams.append('subGroupName', subGroupName);
        if (projectId)    quotParams.append('projectId',    projectId);
        if (filters.status !== 'all') quotParams.append('status',     filters.status);
        if (filters.search)           quotParams.append('searchTerm', filters.search.trim());
        if (uploadedFrom)             quotParams.append('uploadedFrom', uploadedFrom);
        if (uploadedTo)               quotParams.append('uploadedTo',   uploadedTo);

        // Stats params — same filters so KPI cards always match the table
        const statsParams = new URLSearchParams();
        if (groupName)    statsParams.append('groupName',    groupName);
        if (subGroupName) statsParams.append('subGroupName', subGroupName);
        if (projectId)    statsParams.append('projectId',    projectId);
        if (filters.status !== 'all') statsParams.append('status',     filters.status);
        if (filters.search)           statsParams.append('searchTerm', filters.search.trim());
        if (uploadedFrom)             statsParams.append('uploadedFrom', uploadedFrom);
        if (uploadedTo)               statsParams.append('uploadedTo',   uploadedTo);

        const [quotRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/quotations/procurement?${quotParams}`, { credentials: 'include', headers: getAuthHeaders(), signal }),
          fetch(`${API_BASE_URL}/quotations/stats?${statsParams}`,      { credentials: 'include', headers: getAuthHeaders(), signal })
        ]);

        if (!signal.aborted) {
          if (quotRes.ok) {
            const data = await quotRes.json();
            setQuotations(data.quotations || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
          } else {
            showError('Failed to load quotations');
            setQuotations([]);
          }
          if (statsRes.ok) setStats(await statsRes.json());
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // cancelled by dep change — ignore
        showError('Failed to load quotations');
        setQuotations([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    loadAll();
    return () => controller.abort(); // cancel in-flight requests on re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search, uploadedFrom, uploadedTo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sorting logic ────────────────────────────────────────────────────────
  const sortedQuotations = useMemo(() => {
    // ── Step 1: client-side filter (catches API gaps) ──────────────────────
    let list = quotations;
    if (filters.status !== 'all') {
      list = list.filter(q => q.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(q =>
        q.quoteNo?.toLowerCase().includes(s) ||
        q.vendorName?.toLowerCase().includes(s) ||
        q.rfqId?.toLowerCase().includes(s) ||
        q.category?.toLowerCase().includes(s)
      );
    }
    // ── Step 2: sort ────────────────────────────────────────────────────────
    if (!sortConfig.key) return list;
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'quotationNo': aVal = a.quoteNo || ''; bVal = b.quoteNo || ''; break;
        case 'vendorId': aVal = a.vendorName || a.vendorId?.toString() || ''; bVal = b.vendorName || b.vendorId?.toString() || ''; break;
        case 'rfqId': aVal = a.rfqId || ''; bVal = b.rfqId || ''; break;
        case 'category': aVal = a.category || ''; bVal = b.category || ''; break;
        case 'quotationValue': aVal = parseFloat(a.totalValue) || 0; bVal = parseFloat(b.totalValue) || 0; break;
        case 'validUntil': aVal = new Date(a.validTill || 0); bVal = new Date(b.validTill || 0); break;
        case 'status': aVal = a.status || ''; bVal = b.status || ''; break;
        case 'uploadedOn': aVal = new Date(a.uploadedAt || 0); bVal = new Date(b.uploadedAt || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [quotations, sortConfig, filters.status, filters.search]);

  const handleSort = (colId) => {
    if (!SORTABLE_COLUMNS.has(colId)) return;
    setSortConfig(prev => ({
      key: colId,
      direction: prev.key === colId && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // ── Table-header drag-and-drop ───────────────────────────────────────────
  const handleColDragStart = (e, index) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleColDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColIndex(index);
  };
  const handleColDrop = (e, index) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === index) {
      setDraggedColIndex(null); setDragOverColIndex(null); return;
    }
    const visibleCols = columns.filter(c => c.visible);
    const newVisible = [...visibleCols];
    const [moved] = newVisible.splice(draggedColIndex, 1);
    newVisible.splice(index, 0, moved);
    const hiddenCols = columns.filter(c => !c.visible);
    setColumns([...newVisible, ...hiddenCols]);
    setDraggedColIndex(null); setDragOverColIndex(null);
  };
  const handleColDragEnd = () => { setDraggedColIndex(null); setDragOverColIndex(null); };

  // ── Column visibility toggle ─────────────────────────────────────────────
  const toggleColumnVisibility = (colId) =>
    setColumns(cols => cols.map(c => c.id === colId ? { ...c, visible: !c.visible } : c));

  const resetColumns = () => {
    setColumns(ALL_QUOTATION_COLUMNS);
    localStorage.removeItem('quotationColumns');
    localStorage.removeItem('quotationColumnsVersion');
  };

  // ── Excel import handlers ────────────────────────────────────────────────
  const handleXlsxFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Always clear previous results first before parsing new file
    setImportErrors([]);
    setImportPreview([]);
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find header row by looking for a cell that contains "description" or "item name"
        const headerRowIdx = data.findIndex(row =>
          row.some(cell => typeof cell === 'string' &&
            (cell.toLowerCase().includes('description') || cell.toLowerCase().includes('item name')))
        );
        if (headerRowIdx === -1) {
          showWarning('Invalid template. Please use the provided BOQ quotation template.');
          return;
        }

        // Helper: returns true if a cell value looks like a column header label rather than real data
        const isHeaderLike = (val) => {
          const s = String(val || '').trim().toLowerCase();
          return (
            s === '' ||
            s.includes('item name') ||
            s.includes('description') ||
            s.includes('unit price') ||
            s.includes('rate') ||
            s.includes('quantity') ||
            s.includes('qty') ||
            s.includes('make') ||
            s.includes('unit') ||
            s.includes('s.no') ||
            s.includes('sr no') ||
            s.includes('amount') ||
            s.includes('delivery') ||
            s.includes('warranty') ||
            s.includes('notes') ||
            s.includes('order book')
          );
        };

        // Slice everything after the header row, skip blanks and header-like rows
        const rows = data
          .slice(headerRowIdx + 1)
          .filter(row => {
            // first non-empty cell after skipping S.No column
            const firstCell = String(row[1] || row[0] || '').trim();
            return firstCell !== '' && !isHeaderLike(firstCell);
          });

        const errors = [];
        const parsed = rows.map((row, i) => {
          const rowNum = headerRowIdx + 2 + i;
          // New BOQ format: S.No | Description | Unit | Qty | Make | Rate | GST% | Amount
          // Also support old format: Item Name | Description | Qty | Unit Price | GST
          let itemName, description, unit, quantity, make, unitPrice, gst;
          const firstCell = String(row[0] || '').trim();
          const isNewFormat = !isNaN(parseFloat(firstCell)) && parseFloat(firstCell) > 0;

          if (isNewFormat) {
            // New BOQ: S.No, Description, Unit, Qty, Make, Rate, Amount
            itemName = String(row[1] || '').trim();
            description = String(row[1] || '').trim();
            unit = String(row[2] || '').trim();
            quantity = parseFloat(row[3]);
            make = String(row[4] || '').trim();
            unitPrice = parseFloat(row[5]);
            gst = 0; // no per-item GST in new format
          } else {
            // Legacy: Item Name, Description, Qty, Unit Price, GST
            itemName = String(row[0] || '').trim();
            description = String(row[1] || '').trim();
            unit = '';
            quantity = parseFloat(row[2]);
            make = '';
            unitPrice = parseFloat(row[3]);
            gst = parseFloat(row[4]);
          }

          if (!itemName) errors.push(`Row ${rowNum}: Description is required`);
          if (isNaN(quantity) || quantity <= 0) errors.push(`Row ${rowNum}: Invalid quantity "${isNewFormat ? row[3] : row[2]}"`);
          if (isNaN(unitPrice) || unitPrice < 0) errors.push(`Row ${rowNum}: Invalid rate "${isNewFormat ? row[5] : row[3]}"`);

          return {
            itemName,
            description,
            unit,
            quantity: isNaN(quantity) ? 1 : quantity,
            make,
            unitPrice: isNaN(unitPrice) ? '' : unitPrice,
            taxPercent: VALID_GST.has(gst) ? gst : 18,
            included: true,
          };
        });

        setImportErrors(errors);
        setImportPreview(parsed);
        setShowImportModal(true); // auto-open preview modal after file is parsed
      } catch (err) {
        showError('Failed to read file. Please use a valid Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    if (importErrors.length > 0) { showWarning('Fix errors before importing'); return; }
    if (importPreview.length === 0) { showWarning('No valid rows to import'); return; }

    // Merge imported items into existing form data
    setQuotationFormData(prev => ({
      ...prev,
      items: importPreview.map(row => ({
        itemName: row.itemName,
        description: row.description,
        unit: row.unit || '',
        quantity: row.quantity,
        make: row.make || '',
        unitPrice: row.unitPrice,
        taxPercent: row.taxPercent,
        included: true,
      })),
      deliveryTime: prev.deliveryTime || importPreview[0]?.deliveryTime || '',
      warranty: prev.warranty || importPreview[0]?.warranty || '',
    }));

    handleCloseImportModal();
    showSuccess(`Imported ${importPreview.length} item${importPreview.length !== 1 ? 's' : ''} into the quotation form`);
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    setImportFileName('');
    if (xlsxFileRef.current) xlsxFileRef.current.value = '';
  };



  // ── Auth helper ──────────────────────────────────────────────────────────
  const getAuthHeaders = () => {
    try {
      const raw = localStorage.getItem('bd_portal_user');
      const u = raw ? (JSON.parse(raw)?.user || {}) : {};
      const id   = String(u.id   || user?.id   || '');
      const role = String(u.role || user?.role || '');
      return {
        'Content-Type': 'application/json',
        'User-Id':   id,
        'User-Role': role,
        'X-User-Id':   id,
        'X-User-Role': role,
      };
    } catch { return { 'Content-Type': 'application/json' }; }
  };

  // ── API calls ────────────────────────────────────────────────────────────
  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'uploadedAt', sortDirection: 'DESC' });
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('searchTerm', filters.search);

      const res = await fetch(`${API_BASE_URL}/quotations/procurement?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotations(data.quotations || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch { showError('Failed to load quotations'); setQuotations([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      const res = await fetch(`${API_BASE_URL}/quotations/stats?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) setStats(await res.json());
    } catch { }
  };

  const fetchVendors = async (gn, sg) => {
    try {
      let url = `${API_BASE_URL}/vendors/by-group-subgroup?`;
      if (gn) url += `groupName=${encodeURIComponent(gn)}&`;
      if (sg) url += `subGroupName=${encodeURIComponent(sg)}`;
      const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setVendors(data.data || []);
    } catch { setVendors([]); }
  };

  const fetchAllVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors/by-group-subgroup`, {
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        }
      });
      const data = await res.json();
      if (data.success) setVendors(data.data || []);
    } catch { setVendors([]); }
  };

  const fetchOrderBookItems = async (pid) => {
    if (!pid) { setOrderBookItems([]); return; }
    setLoadingOrderItems(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/orderbook-items/${pid}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.success) {
        setOrderBookItems(data.data || []);
        if (quotationFormData && !isEditMode && data.data?.length > 0) {
          setQuotationFormData(prev => {
            // If user already imported items, do NOT overwrite them with order book items
            const hasImportedItems = prev.items && prev.items.length > 0;
            if (hasImportedItems) return prev;
            return {
              ...prev,
              items: data.data.map(item => ({
                itemName: item.itemName, description: item.specification || item.description || '',
                quantity: item.quantity || '', unitPrice: '', taxPercent: item.taxPercent || 18,
                orderBookItemId: item.id, included: true,
              })),
            };
          });
        }
      }
    } catch { showError('Failed to load order book items'); setOrderBookItems([]); }
    finally { setLoadingOrderItems(false); }
  };

  const fetchModalGroups = async () => { setModalDropdownLoading(p => ({ ...p, groups: true })); try { setModalGroups(await filterApi.getAllGroups() || []); } catch { } finally { setModalDropdownLoading(p => ({ ...p, groups: false })); } };
  const fetchModalSubGroups = async (gn) => { if (!gn) { setModalSubGroups([]); setModalProjects([]); return; } setModalDropdownLoading(p => ({ ...p, subGroups: true })); try { setModalSubGroups(await filterApi.getSubGroups(gn) || []); } catch { } finally { setModalDropdownLoading(p => ({ ...p, subGroups: false })); } };
  const fetchModalProjects = async (gn, sg) => { if (!gn || !sg) { setModalProjects([]); return; } setModalDropdownLoading(p => ({ ...p, projects: true })); try { setModalProjects(await filterApi.getProjects(gn, sg) || []); } catch { } finally { setModalDropdownLoading(p => ({ ...p, projects: false })); } };

  // ── Modal dropdown change handlers ───────────────────────────────────────
  const handleModalGroupChange = (val) => {
    const g = val || '';
    setModalGroupName(g); setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]); setOrderBookItems([]);
    if (quotationFormData) setQuotationFormData({ ...quotationFormData, groupName: g, subGroupName: '', projectId: '', items: quotationFormData.items });
    if (g) { fetchModalSubGroups(g); fetchVendors(g, null); } else setVendors([]);
  };

  const handleModalSubGroupChange = (val) => {
    const sg = val || '';
    setModalSubGroupName(sg); setModalProjectId(''); setModalProjects([]); setOrderBookItems([]);
    if (quotationFormData) setQuotationFormData({ ...quotationFormData, subGroupName: sg, projectId: '', items: quotationFormData.items });
    if (modalGroupName && sg) { fetchModalProjects(modalGroupName, sg); fetchVendors(modalGroupName, sg); }
  };

  /** How many rows currently carry a project BOM link. */
  const bomLoadedCount = (quotationFormData?.items || []).filter(i => i.bomLineId).length;

  const handleModalProjectChange = (val) => {
    const pid = val || '';
    setModalProjectId(pid);
    if (quotationFormData) setQuotationFormData({ ...quotationFormData, projectId: pid });
    // Items deliberately DO NOT auto-load here any more. The user picks a source
    // first — otherwise BOM items and order book items accumulate in the same table
    // and duplicate each other.
    setItemSource(null);
    setOrderBookItems([]);
  };

  /**
   * Choose where the quotation's items come from. Switching source once rows exist
   * asks first, then clears, so the two sources can never mix in one table.
   */
  const handleSelectItemSource = (key) => {
    if (key === itemSource) {
      if (key === 'bom') setShowBomPicker(true);
      return;
    }
    const applySource = () => {
      setQuotationFormData(prev => (prev ? { ...prev, items: [] } : prev));
      setOrderBookItems([]);
      setItemSource(key);
      if (key === 'bom') setShowBomPicker(true);
      if (key === 'orderbook' && modalProjectId) fetchOrderBookItems(modalProjectId);
    };

    if ((quotationFormData?.items || []).length > 0) {
      setConfirmModal({
        show: true,
        title: 'Change item source?',
        message: 'The items already added will be cleared so the two sources cannot duplicate each other.',
        type: 'confirm',
        onConfirm: () => { setConfirmModal({ show: false }); applySource(); },
      });
      return;
    }
    applySource();
  };

  /** Add picked BOM lines. Additive — the picker reopens to add more. */
  const handleAddBomItems = (rows) => {
    setQuotationFormData(prev => {
      if (!prev) return prev;
      const existing = new Set((prev.items || []).map(i => String(i.bomLineId)));
      const fresh = rows
        .filter(r => !existing.has(String(r.bomLineId)))
        .map(r => ({
          bomLineId: r.bomLineId,
          bomItemId: r.bomItemId,
          variantId: r.variantId,
          itemName: r.itemName,
          description: r.specification || '',
          unit: r.unit || '',
          quantity: r.quantity,
          make: r.make || '',
          // The vendor's price is what this document records — the BOM rate is a
          // budget figure and must not be presented as a quote.
          unitPrice: '',
          taxPercent: 18,
          included: true,
          bomQty: r.bomQty,
          remainingQty: r.remaining,
        }));
      return { ...prev, items: [...(prev.items || []), ...fresh] };
    });
  };

  // ── Vendor handlers ──────────────────────────────────────────────────────
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new');
    setVendorDropdownOpen(false);
    setVendorSearch('');
    if (type === 'new') { setQuotationFormData({ ...quotationFormData, vendorId: null, vendorName: '', vendorContact: '' }); setSelectedVendorDetails(null); }
    else setQuotationFormData({ ...quotationFormData, vendorName: '', vendorContact: '' });
  };

  const handleNewVendorContactChange = (val) => {
    setQuotationFormData({ ...quotationFormData, vendorContact: val.replace(/\D/g, '').slice(0, 10) });
  };

  const handleVendorSelection = (e) => {
    const vid = e.target.value ? parseInt(e.target.value) : null;
    if (vid) {
      const v = vendors.find(x => x.id === vid);
      if (v) { setSelectedVendorDetails({ id: v.id, name: v.name, phone: v.phone || v.contact }); setQuotationFormData({ ...quotationFormData, vendorId: vid, vendorName: v.name || '', vendorContact: v.phone || v.contact || '' }); }
    } else { setSelectedVendorDetails(null); setQuotationFormData({ ...quotationFormData, vendorId: null, vendorName: '', vendorContact: '' }); }
  };

  const toggleItemInclusion = (idx) => {
    if (!quotationFormData) return;
    const items = [...quotationFormData.items];
    items[idx].included = !items[idx].included;
    setQuotationFormData({ ...quotationFormData, items });
  };

  // ── File select for quotation attachment ─────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) { setSelectedFile(null); setFilePreview(null); return; }
    if (file.size > 5 * 1024 * 1024) { showWarning('File size exceeds 5MB'); e.target.value = ''; setSelectedFile(null); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) { showWarning('Only PDF and image files are allowed'); e.target.value = ''; setSelectedFile(null); return; }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) { const r = new FileReader(); r.onloadend = () => setFilePreview(r.result); r.readAsDataURL(file); }
    else setFilePreview(null);
  };

  // ── PO handlers ──────────────────────────────────────────────────────────
  const handleOpenCreatePOModal = async (quotation) => {
    setLoading(true);
    try {
      const [res, remRes] = await Promise.all([
        fetch(`${API_BASE_URL}/quotations/${quotation.id}`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/purchase-orders/quotation/${quotation.id}/remaining`, { credentials: 'include', headers: getAuthHeaders() }),
      ]);
      if (!res.ok) throw new Error();
      const qd = await res.json();
      // Remaining qty per line = quoted − already ordered across all prior POs (by item name).
      const remByName = {};
      if (remRes.ok) { (await remRes.json()).forEach(r => { remByName[r.itemName] = Number(r.remainingQty); }); }
      const items = qd.items.map(item => {
        const remaining = remByName[item.itemName] != null ? remByName[item.itemName] : Number(item.quantity);
        return {
          quotationItemId: item.id, itemName: item.itemName, description: item.description,
          unit: item.unit || 'Nos', hsnCode: item.hsnCode || null,
          quotedQuantity: Number(item.quantity), remainingQty: remaining,
          selectedQuantity: remaining, unitPrice: item.unitPrice, taxPercent: item.taxPercent,
          lineTotal: remaining * item.unitPrice * (1 + (item.taxPercent || 0) / 100),
        };
      });
      if (items.every(i => i.remainingQty <= 0)) {
        showWarning('All items in this quotation have already been fully ordered.');
        return;
      }
      setPOFormData({
        quotationId: qd.id, quoteNo: qd.quoteNo, vendorId: qd.vendorId, vendorContact: qd.vendorContact,
        rfqId: qd.rfqId, poRefId: qd.rfqId || '', documentType: 'PURCHASE_ORDER', status: 'Draft',
        groupName: qd.groupName, subGroupName: qd.subGroupName, projectId: qd.projectId,
        orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '',
        paymentTerms: qd.paymentTerms || '', shippingAddress: '', notes: qd.notes || '',
        items,
      });
      setShowCreatePOFromQuotationModal(true);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleUpdatePOItemQuantity = (index, quantity) => {
    if (!poFormData) return;
    const items = [...poFormData.items];
    const item = items[index];
    const qty = parseFloat(quantity) || 0;
    const cap = item.remainingQty != null ? item.remainingQty : item.quotedQuantity;
    if (qty > cap) { showWarning(`Only ${cap} remaining for "${item.itemName}" under this quotation`); return; }
    item.selectedQuantity = qty;
    item.lineTotal = qty * item.unitPrice * (1 + item.taxPercent / 100);
    setPOFormData({ ...poFormData, items });
  };

  const calculatePOTotal = () => {
    if (!poFormData) return { subtotal: 0, taxAmount: 0, total: 0 };
    const subtotal = poFormData.items.reduce((s, i) => s + i.selectedQuantity * i.unitPrice, 0);
    const taxAmount = poFormData.items.reduce((s, i) => s + i.selectedQuantity * i.unitPrice * i.taxPercent / 100, 0);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleCreatePOFromQuotation = async () => {
    if (!poFormData.expectedDelivery) { showWarning('Expected delivery date is required'); return; }
    if (!poFormData.items.some(i => i.selectedQuantity > 0)) { showWarning('Select quantity for at least one item'); return; }
    // Permission check handled by canCreate guard on the button
    setLoading(true);
    try {
      const poData = {
        quotationId: poFormData.quotationId, vendorId: poFormData.vendorId, rfqId: poFormData.rfqId,
        poRefId: poFormData.poRefId || poFormData.rfqId || null,
        documentType: poFormData.documentType || 'PURCHASE_ORDER',
        groupName: poFormData.groupName, subGroupName: poFormData.subGroupName, projectId: poFormData.projectId,
        orderDate: poFormData.orderDate, expectedDelivery: poFormData.expectedDelivery,
        paymentTerms: poFormData.paymentTerms, shippingAddress: poFormData.shippingAddress, notes: poFormData.notes,
        items: poFormData.items.filter(i => i.selectedQuantity > 0).map(i => ({
          itemName: i.itemName, itemDescription: i.description || '', unit: i.unit || 'Nos', hsnCode: i.hsnCode || null,
          quantity: i.selectedQuantity, unitPrice: i.unitPrice, gst: i.taxPercent, discount: 0,
        })),
        status: poFormData.status || 'Draft', paymentStatus: 'Pending',
      };
      const vId = poFormData.vendorId;
      const res = await fetch(`${API_BASE_URL}/purchase-orders/from-quotation`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(poData) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed'); }
      const created = await res.json();
      showSuccess(`Purchase Order ${created.poNo} created!`);
      setShowCreatePOFromQuotationModal(false); setPOFormData(null);
      // Backend sets the quotation status (Partially Ordered / PO Created) from remaining qtys.
      fetchQuotations(); fetchStats();
      // Parity with the Purchase Orders page: open the PO-document (PDF) step after create.
      openGeneratePODoc(created.id, vId);
    } catch (err) { showError(err.message || 'Failed to create Purchase Order'); }
    finally { setLoading(false); }
  };

  // Open the Generate PO-PDF modal for a freshly created PO (mirrors PurchaseOrders.js openGenerateDoc).
  const openGeneratePODoc = async (poId, vendorId) => {
    try {
      const pRes = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, { credentials: 'include', headers: getAuthHeaders() });
      const po = pRes.ok ? await pRes.json() : { id: poId };
      let vendor = null;
      if (vendorId) {
        const vRes = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, { credentials: 'include', headers: getAuthHeaders() });
        if (vRes.ok) vendor = await vRes.json();
      }
      setGenVendor(vendor); setGenPo(po);
    } catch { /* PDF step is best-effort */ }
  };

  // ── Quotation CRUD ───────────────────────────────────────────────────────
  const handleViewQuotation = async (quotation) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotation.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      setSelectedQuotation(await res.json()); setShowDetailDrawer(true);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleEditQuotation = async (quotation) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotation.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIsEditMode(true);
      setQuotationFormData({
        id: data.id, rfqId: data.rfqId || '', validTill: data.validTill || '',
        groupName: data.groupName || '', subGroupName: data.subGroupName || '', projectId: data.projectId || '',
        category: data.category || 'Manufacturer', vendorId: data.vendorId || null,
        vendorName: data.vendorName || '', vendorContact: data.vendorContact || '',
        vendorRating: data.vendorRating || 0, deliveryTime: data.deliveryTime || '',
        paymentTerms: data.paymentTerms || '', warranty: data.warranty || '',
        notes: data.notes || '', status: data.status || 'New',
        items: (data.items || []).map(item => ({ id: item.id, itemName: item.itemName || '', description: item.description || '', unit: item.unit || '', quantity: item.quantity || 1, make: item.make || '', unitPrice: item.unitPrice || '', taxPercent: item.taxPercent || 18, included: true })),
      });
      if (data.vendorId) { setShowNewVendorForm(false); setSelectedVendorDetails({ id: data.vendorId, name: data.vendorName, phone: data.vendorContact }); }
      else if (data.vendorName) setShowNewVendorForm(true);
      setVendorSearch(''); setVendorDropdownOpen(false);
      setModalGroupName(data.groupName || ''); setModalSubGroupName(data.subGroupName || ''); setModalProjectId(data.projectId || '');
      setSelectedFile(null); setFilePreview(null);
      // Fetch groups + all vendors (always needed)
      await fetchModalGroups();
      fetchAllVendors();
      // Pre-fetch cascaded data using fresh local values from data — no async state lag.
      // Open modal AFTER data is ready so dropdowns are populated immediately.
      if (data.groupName) {
        await fetchModalSubGroups(data.groupName);
        fetchVendors(data.groupName, null);
        if (data.subGroupName) {
          await fetchModalProjects(data.groupName, data.subGroupName);
          fetchVendors(data.groupName, data.subGroupName);
        }
      }
      setShowUploadQuotationModal(true);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (quotationId, newStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotationId}/status`, { credentials: 'include', method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error();
      showSuccess(`Quotation ${newStatus.toLowerCase()} successfully`);
      fetchQuotations(); fetchStats(); setShowDetailDrawer(false);
    } catch { showError('Failed to update status'); }
    finally { setLoading(false); }
  };

  const handleDeleteQuotation = (quotationId) => {
    if (!canDelete) { showWarning('No permission to delete quotations'); return; }
    setConfirmModal({
      show: true, title: 'Delete Quotation',
      message: 'Are you sure you want to delete this quotation? This action cannot be undone.',
      type: 'error',
      onConfirm: () => performDeleteQuotation(quotationId)
    });
  };
  const performDeleteQuotation = async (quotationId) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotationId}`, { credentials: 'include', method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      showSuccess('Quotation deleted'); fetchQuotations(); fetchStats(); setShowDetailDrawer(false);
    } catch { showError('Failed to delete quotation'); }
    finally { setLoading(false); }
  };

  const handleUploadQuotation = async () => {
    setIsEditMode(false);
    // Seed from page-level header filters
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    const seedProject  = projectId   || '';
    setQuotationFormData({ rfqId: '', validTill: '', groupName: seedGroup, subGroupName: seedSubGroup, projectId: seedProject, category: 'Manufacturer', vendorId: null, vendorName: '', vendorContact: '', vendorCategory: '', vendorType: '', vendorRating: 0, deliveryTime: '', paymentTerms: '', warranty: '', notes: '', status: 'New', items: [] });
    setSelectedVendorDetails(null); setShowNewVendorForm(false); setVendors([]); setOrderBookItems([]);
    setVendorSearch(''); setVendorDropdownOpen(false);
    setCustomVendorCategory(''); setCustomVendorType('');
    setModalGroupName(seedGroup); setModalSubGroupName(seedSubGroup); setModalProjectId(seedProject);
    setSelectedFile(null); setFilePreview(null);
    // Fetch groups and all vendors (always needed)
    await fetchModalGroups();
    fetchAllVendors();
    // Pre-fetch cascaded data with fresh seeded values — no async state lag.
    // Open the modal AFTER all data is ready so dropdowns populate immediately.
    if (seedGroup) {
      await fetchModalSubGroups(seedGroup);
      fetchVendors(seedGroup, null);
      if (seedSubGroup) {
        await fetchModalProjects(seedGroup, seedSubGroup);
        fetchVendors(seedGroup, seedSubGroup);
        if (seedProject) {
          fetchOrderBookItems(seedProject);
        }
      }
    }
    setShowUploadQuotationModal(true);
  };

  const handleSaveQuotation = async () => {
    if (!quotationFormData.groupName) { showWarning('Group is required'); return; }
    if (!quotationFormData.vendorId) {
      if (!quotationFormData.vendorName?.trim()) { showWarning('Vendor name is required'); return; }
      const finalCategory = quotationFormData.vendorCategory === 'Other' ? customVendorCategory?.trim() : quotationFormData.vendorCategory;
      const finalType     = quotationFormData.vendorType     === 'Other' ? customVendorType?.trim()     : quotationFormData.vendorType;
      if (!finalCategory) { showWarning('Vendor category is required'); return; }
      if (!finalType)     { showWarning('Vendor type is required'); return; }
    }
    if (!quotationFormData.validTill) { showWarning('Valid until date is required'); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const vtd = new Date(quotationFormData.validTill); vtd.setHours(0, 0, 0, 0);
    if (vtd < today) { showWarning('Valid until date cannot be in the past'); return; }
    const included = quotationFormData.items.filter(i => i.included !== false);
    if (included.length === 0) { showWarning('Please include at least one item'); return; }
    for (let i = 0; i < included.length; i++) {
      const item = included[i];
      if (!item.itemName?.trim()) { showWarning(`Item ${i + 1}: Name is required`); return; }
      if (item.quantity === '' || item.quantity === null || item.quantity === undefined) { showWarning(`Item ${i + 1}: Quantity is required`); return; }
      if (item.unitPrice === '' || item.unitPrice === null || item.unitPrice === undefined || item.unitPrice < 0) { showWarning(`Item ${i + 1}: Unit price is required`); return; }
    }
    setLoading(true);
    try {
      const fd = new FormData();
      const resolvedVendorCategory = quotationFormData.vendorCategory === 'Other' ? (customVendorCategory?.trim() || 'Other') : quotationFormData.vendorCategory;
      const resolvedVendorType     = quotationFormData.vendorType     === 'Other' ? (customVendorType?.trim()     || 'Other') : quotationFormData.vendorType;
      const qd = {
        vendorId: quotationFormData.vendorId || null, vendorName: quotationFormData.vendorName?.trim() || null,
        vendorContact: quotationFormData.vendorContact?.trim() || null,
        vendorCategory: resolvedVendorCategory || null,
        vendorType: resolvedVendorType || null,
        rfqId: quotationFormData.rfqId?.trim() || null,
        validTill: quotationFormData.validTill, groupName: quotationFormData.groupName,
        subGroupName: quotationFormData.subGroupName || null, projectId: quotationFormData.projectId || null,
        category: quotationFormData.category, deliveryTime: quotationFormData.deliveryTime?.trim() || null,
        paymentTerms: quotationFormData.paymentTerms?.trim() || null, warranty: quotationFormData.warranty?.trim() || null,
        notes: quotationFormData.notes?.trim() || null, status: quotationFormData.status, type: 'Procurement',
        // bomLineId / bomItemId / variantId must be forwarded — a PO later raised from
        // this quotation is matched against the BOM at creation, and the stored link
        // saves it falling back to name matching.
        items: included.map(item => ({ id: item.id || null, itemName: item.itemName.trim(), description: item.description?.trim() || '', unit: item.unit?.trim() || '', quantity: item.quantity, unitPrice: parseFloat(item.unitPrice), taxPercent: item.taxPercent, make: item.make?.trim() || '', bomLineId: item.bomLineId || null, bomItemId: item.bomItemId || null, variantId: item.variantId || null })),
      };
      fd.append('quotation', new Blob([JSON.stringify(qd)], { type: 'application/json' }));
      if (selectedFile) fd.append('file', selectedFile);
      const url = isEditMode ? `${API_BASE_URL}/quotations/${quotationFormData.id}` : `${API_BASE_URL}/quotations/procurement`;
      const method = isEditMode ? 'PUT' : 'POST';
      const { 'Content-Type': _ct, ...multipartHeaders } = getAuthHeaders();
      const res = await fetch(url, { credentials: 'include', method, headers: multipartHeaders, body: fd });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed'); }
      const body = await res.json().catch(() => ({}));
      showSuccess(isEditMode ? 'Quotation updated!' : 'Quotation uploaded!');
      setShowUploadQuotationModal(false); setSelectedFile(null); setFilePreview(null);
      setSelectedVendorDetails(null); setVendors([]); setOrderBookItems([]); setShowNewVendorForm(false); setIsEditMode(false);
      setItemSource(null);
      // The quotation SAVED — these are warnings, not a rejection. A PO for the same
      // lines will be blocked until the BOM covers them, so surface them now.
      if (Array.isArray(body.bomWarnings) && body.bomWarnings.length > 0) {
        setBomWarnings({ violations: body.bomWarnings, projectId: modalProjectId });
      }
      fetchQuotations(); fetchStats();
    } catch (err) { showError(err.message || 'Failed to save quotation'); }
    finally { setLoading(false); }
  };

  const handleAddQuotationItem = () => { if (quotationFormData) setQuotationFormData({ ...quotationFormData, items: [...quotationFormData.items, { itemName: '', description: '', unit: '', quantity: '', make: '', unitPrice: '', taxPercent: 18, included: true }] }); };
  const handleRemoveQuotationItem = (idx) => { if (quotationFormData?.items.length > 1) setQuotationFormData({ ...quotationFormData, items: quotationFormData.items.filter((_, i) => i !== idx) }); };
  const handleUpdateQuotationItem = (idx, field, val) => { if (quotationFormData) { const items = [...quotationFormData.items]; items[idx] = { ...items[idx], [field]: val }; setQuotationFormData({ ...quotationFormData, items }); } };

  const calculateQuotationTotal = () => {
    if (!quotationFormData) return { subtotal: 0, gstAmount: 0, total: 0 };
    const inc = quotationFormData.items.filter(i => i.included !== false);
    let subtotal = 0, gstAmount = 0;
    inc.forEach(i => {
      const base = (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0);
      subtotal  += base;
      gstAmount += base * (parseFloat(i.taxPercent) || 0) / 100;
    });
    return { subtotal, gstAmount, total: subtotal + gstAmount };
  };

  // ── Utility formatters ───────────────────────────────────────────────────
  const formatCurrency = (amt) => { if (!amt && amt !== 0) return '₹0.00'; const n = typeof amt === 'number' ? amt : parseFloat(amt) || 0; return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  const formatQty = (val) => { const n = typeof val === 'number' ? val : parseFloat(val); if (isNaN(n)) return val; return n % 1 === 0 ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 3 }); };
  const formatIndianInput = (val) => {
    const raw = String(val === '' || val == null ? '' : val).replace(/,/g, '');
    if (raw === '') return '';
    const hasDot = raw.includes('.');
    const afterDot = hasDot ? raw.split('.')[1] : '';
    const intPart = hasDot ? raw.split('.')[0] : raw;
    const intNum = parseInt(intPart, 10);
    const formattedInt = isNaN(intNum) ? intPart : (intNum === 0 ? '0' : intNum.toLocaleString('en-IN'));
    if (!hasDot) return formattedInt;
    return formattedInt + '.' + afterDot.slice(0, 3);
  };
  const formatDate = (d) => {
    if (!d) return '';
    const s = String(d);
    if (s.length >= 10 && s[4] === '-') {
      const [y, m, dy] = s.slice(0, 10).split('-');
      return `${dy}-${m}-${y}`;
    }
    const dt = new Date(d);
    const dy = String(dt.getDate()).padStart(2, '0');
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dy}-${mo}-${dt.getFullYear()}`;
  };
  const formatFileSize = (b) => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(2) + ' KB'; return (b / 1048576).toFixed(2) + ' MB'; };

  const getStatusBadgeClass = (s) => ({ 'New': 'procurement-quotation-received-badge-new', 'Under Review': 'procurement-quotation-received-badge-review', 'Shortlisted': 'procurement-quotation-received-badge-shortlisted', 'Approved': 'procurement-quotation-received-badge-approved', 'Partially Ordered': 'procurement-quotation-received-badge-shortlisted', 'PO Created': 'procurement-quotation-received-badge-po-created', 'Rejected': 'procurement-quotation-received-badge-rejected', 'Expired': 'procurement-quotation-received-badge-expired' })[s] || '';

  const isExpiringSoon = (validTill) => {
    if (!validTill) return false;
    const diff = Math.ceil((new Date(validTill) - new Date()) / 86400000);
    return diff <= 7 && diff > 0;
  };

  const kpiData = stats ? [
    { title: 'Total Quotations', value: stats.totalQuotations?.toString() || '0', icon: <FileText size={28} />, color: '#2563eb' },
    { title: 'New', value: stats.newQuotations?.toString() || '0', icon: <Clock size={28} />, color: '#f59e0b' },
    { title: 'Approved', value: stats.approved?.toString() || '0', icon: <CheckCircle size={28} />, color: '#22c55e' },
    { title: 'Rejected', value: stats.rejected?.toString() || '0', icon: <XCircle size={28} />, color: '#ef4444' },
  ] : [];

  const visibleColumns = columns.filter(c => c.visible);

  // ── Render column cell ───────────────────────────────────────────────────
  const renderCell = (col, q, rowIndex = 0) => {
    switch (col.id) {
      case 'sNo': return <td style={{ textAlign:'center', color:'#64748b', fontSize:13, fontWeight:500, width:50 }}>{currentPage * pageSize + rowIndex + 1}</td>;
      case 'quotationNo': return <td className="procurement-quotation-received-table-id">{q.quoteNo}</td>;
      case 'vendorId': return <td>{q.vendorName || q.vendorId || '—'}</td>;
      case 'rfqId': return <td>{q.rfqId || '—'}</td>;
      case 'category': return <td>{q.category || 'N/A'}</td>;
      case 'quotationValue': return <td className="procurement-quotation-received-table-value">{formatCurrency(q.totalValue)}</td>;
      case 'validUntil': return (
        <td className={isExpiringSoon(q.validTill) ? 'procurement-quotation-received-expiring' : ''}>
          {formatDate(q.validTill)}
          {isExpiringSoon(q.validTill) && <span className="procurement-quotation-received-warning-icon"><AlertCircle size={14} /></span>}
        </td>
      );
      case 'file': return (
        <td>{q.fileName ? <a href={`${API_BASE_URL}/quotations/${q.id}/file`} target="_blank" rel="noopener noreferrer" className="file-link" title={`${q.fileName} (${formatFileSize(q.fileSize)})`}>📄 {q.fileName.substring(0, 15)}…</a> : '—'}</td>
      );
      case 'status': return (
        <td><span className={`procurement-quotation-received-badge ${getStatusBadgeClass(q.status)}`}>{q.status}</span></td>
      );
      case 'uploadedOn': return <td>{formatDate(q.uploadedAt)}</td>;
      case 'actions': return (
        <td>
          <div className="procurement-quotation-received-actions-cell">
            <button className="procurement-quotation-received-action-btn action-view" onClick={() => handleViewQuotation(q)} title="View"><Eye size={14} /></button>
            <button className="procurement-quotation-received-action-btn action-edit" onClick={() => handleEditQuotation(q)} title="Edit"><Edit2 size={14} /></button>
            {q.status === 'New' && <button className="procurement-quotation-received-action-btn action-shortlist" onClick={() => handleUpdateStatus(q.id, 'Shortlisted')} title="Shortlist"><Star size={14} /></button>}
            {(q.status === 'Shortlisted' || q.status === 'New') && <button className="procurement-quotation-received-action-btn action-approve" onClick={() => handleUpdateStatus(q.id, 'Approved')} title="Approve"><Check size={14} /></button>}
            {(q.status === 'Approved' || q.status === 'Partially Ordered') && <button className="procurement-quotation-received-action-btn procurement-quotation-received-create-po-btn" onClick={() => handleOpenCreatePOModal(q)} title="Create PO"><ShoppingCart size={14} /></button>}
{canDelete && <button className="procurement-quotation-received-action-btn action-delete" onClick={() => handleDeleteQuotation(q.id)} title="Delete" disabled={q.status === 'PO Created'} style={{ opacity: q.status !== 'PO Created' ? 1 : 0.4 }}><Trash2 size={14} /></button>}
          </div>
        </td>
      );
      case 'group': return <td>{q.groupName || '—'}</td>;
      case 'project': return (
        <td style={{ minWidth: 200 }}>
          {q.projectId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>
                {q.projectName || q.projectId}
              </span>
              {q.projectName && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                  {q.projectId}
                </span>
              )}
            </div>
          ) : <span style={{ color: '#94a3b8' }}>—</span>}
        </td>
      );
      default: return <td>—</td>;
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="procurement-quotation-received-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ show: false })}
      />

      <BomItemPicker
        open={showBomPicker}
        projectUniqueId={modalProjectId}
        alreadyLoadedIds={(quotationFormData?.items || []).map(i => i.bomLineId).filter(Boolean)}
        onAdd={handleAddBomItems}
        onClose={() => setShowBomPicker(false)}
        showError={showError}
      />

      <BomViolationDialog
        open={!!bomWarnings}
        violations={bomWarnings?.violations || []}
        blocking={false}
        projectUniqueId={bomWarnings?.projectId}
        onClose={() => setBomWarnings(null)}
      />

      {/* Header */}
      <div className="procurement-quotation-received-header">
        <div className="procurement-quotation-received-breadcrumb">Dashboard &gt; Procurement &gt; Quotations Received</div>
        <div className="page-header-with-filter">
          <h1 className="procurement-quotation-received-title">Quotations Received <span className="procurement-quotation-received-count">({totalElements})</span></h1>
          <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="procurement-quotation-received-action-bar">
        <div className="procurement-quotation-received-search-filters">
          <input type="text" placeholder="Search by Quotation No, RFQ ID, Vendor Name…" className="procurement-quotation-received-search" value={filters.search}
            onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value })); setCurrentPage(0); }} />
          <div className="qr-filter-select-wrap">
            <FilterSelect
              value={filters.status === 'all' ? '' : filters.status}
              options={[
                { value: 'New',          label: 'New'          },
                { value: 'Under Review', label: 'Under Review' },
                { value: 'Shortlisted',  label: 'Shortlisted'  },
                { value: 'Approved',     label: 'Approved'     },
                { value: 'Partially Ordered', label: 'Partially Ordered' },
                { value: 'PO Created',   label: 'PO Created'   },
                { value: 'Rejected',     label: 'Rejected'     },
                { value: 'Expired',      label: 'Expired'      },
              ]}
              placeholder="All Status"
              onChange={(v) => { setFilters(prev => ({ ...prev, status: v || 'all' })); setCurrentPage(0); }}
            /></div>
          {/* Uploaded date range filter */}
          <div className="po-order-date-filter">
            <span className="po-order-date-label">Uploaded:</span>
            <QRDateRangeFilter
              appliedFrom={uploadedFrom}
              appliedTo={uploadedTo}
              onApply={(f, t) => { setUploadedFrom(f); setUploadedTo(t); setCurrentPage(0); }}
              onClear={() => { setUploadedFrom(''); setUploadedTo(''); setCurrentPage(0); }}
            />
          </div>
        </div>

        <div className="procurement-quotation-received-actions">
          {/* Column manager */}
          <div style={{ position: 'relative' }}>
            <button className="procurement-quotation-received-btn-secondary procurement-btn-icon" onClick={() => setShowColumnManager(!showColumnManager)} title="Manage Columns">
              <Columns size={15} style={{ marginRight: 6 }} /> Columns
            </button>
            {showColumnManager && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', minWidth: 220, padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Manage Columns</span>
                  <button onClick={() => setShowColumnManager(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                {columns.map(col => (
                  <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: col.fixed ? 'default' : 'pointer', fontSize: 13, color: '#334155', background: 'none' }}
                    onMouseEnter={e => { if (!col.fixed) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                    <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.id)} disabled={col.fixed} style={{ width: 15, height: 15, cursor: col.fixed ? 'default' : 'pointer' }} />
                    <span>{col.label}</span>
                    {col.fixed && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>fixed</span>}
                  </label>
                ))}
                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 6, padding: '8px 16px 0' }}>
                  <button onClick={resetColumns} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset to default</button>
                </div>
              </div>
            )}
          </div>

          <button className="procurement-quotation-received-btn-primary" onClick={handleUploadQuotation}>
            <Upload size={15} style={{ marginRight: 6 }} /> Upload Quotation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="procurement-quotation-received-kpi-grid">
          {kpiData.map((kpi, i) => (
            <div key={i} className="procurement-quotation-received-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="procurement-quotation-received-kpi-icon">{kpi.icon}</div>
              <div className="procurement-quotation-received-kpi-content">
                <div className="procurement-quotation-received-kpi-value">{kpi.value}</div>
                <div className="procurement-quotation-received-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Table with draggable + sortable headers ── */}
      <div className="procurement-quotation-received-table-container">

        {/* Scrollable table */}
        <div className="procurement-table-scroll">
          <div className="procurement-table-wrapper">
            <table className="procurement-quotation-received-table">
              <thead>
                <tr>
                  {visibleColumns.map((col, index) => (
                    <th
                      key={col.id}
                      draggable={!col.fixed}
                      onDragStart={(e) => handleColDragStart(e, index)}
                      onDragOver={(e) => handleColDragOver(e, index)}
                      onDrop={(e) => handleColDrop(e, index)}
                      onDragEnd={handleColDragEnd}
                      onClick={() => handleSort(col.id)}
                      style={{
                        cursor: SORTABLE_COLUMNS.has(col.id)
                          ? "pointer"
                          : col.fixed
                            ? "default"
                            : "grab",
                        userSelect: "none",
                        background: dragOverColIndex === index ? "#dbeafe" : undefined,
                        transition: "background 0.15s",
                        whiteSpace: "nowrap",
                        minWidth: col.id === 'project' ? 200 : col.id === 'vendor' ? 160 : col.id === 'rfqId' ? 130 : undefined,
                      }}
                    >
                      {!col.fixed && (
                        <GripVertical
                          size={11}
                          style={{
                            opacity: 0.28,
                            marginRight: 3,
                            verticalAlign: "middle",
                            display: "inline-block",
                          }}
                        />
                      )}

                      {col.label}

                      {SORTABLE_COLUMNS.has(col.id) && (
                        <SortIcon columnId={col.id} sortConfig={sortConfig} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="empty-state">
                      No quotations found
                    </td>
                  </tr>
                ) : (
                  sortedQuotations.map((q, rowIndex) => (
                    <tr key={q.id} className="procurement-quotation-received-table-row">
                      {visibleColumns.map((col) => (
                        <React.Fragment key={col.id}>
                          {renderCell(col, q, rowIndex)}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="table-footer">
          <div className="table-footer-left">
            <span>
              Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–
              {Math.min((currentPage + 1) * pageSize, totalElements)} of{" "}
              {totalElements} quotations
            </span>

            <div className="pce-rows-dropdown">
              <FilterSelect
                value={String(pageSize)}
                options={[
                  { value: '10',  label: '10 Rows' },
                  { value: '20',  label: '20 Rows' },
                  { value: '50',  label: '50 Rows' },
                  { value: '100', label: '100 Rows' },
                ]}
                placeholder="Rows"
                onChange={(v) => { if (v) { setPageSize(parseInt(v)); setCurrentPage(0); } }}
              />
            </div>
          </div>

          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </button>

            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pn = currentPage < 3 ? i : currentPage + i - 2;

              if (pn >= 0 && pn < totalPages) {
                return (
                  <button
                    key={pn}
                    className={`page-btn ${pn === currentPage ? "active" : ""}`}
                    onClick={() => setCurrentPage(pn)}
                  >
                    {pn + 1}
                  </button>
                );
              }

              return null;
            })}

            <button
              className="page-btn"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      {showDetailDrawer && selectedQuotation && (
        <div className="procurement-quotation-received-drawer-overlay">
          <div className="procurement-quotation-received-drawer">
            <div className="procurement-quotation-received-drawer-header">
              <div>
                <h2>{selectedQuotation.quoteNo}</h2>
                <p className="procurement-quotation-received-drawer-subtitle">Vendor: {selectedQuotation.vendorName || selectedQuotation.vendorId || 'N/A'} | Category: {selectedQuotation.category || 'N/A'}</p>
              </div>
              <button className="procurement-quotation-received-drawer-close" onClick={() => setShowDetailDrawer(false)}>✕</button>
            </div>
            <div className="procurement-quotation-received-drawer-content">
              <div className="procurement-quotation-received-drawer-section">
                <h3>Quotation Details</h3>
                <div className="quotation-details-grid">
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Status:</span><span className={`procurement-quotation-received-badge ${getStatusBadgeClass(selectedQuotation.status)}`}>{selectedQuotation.status}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">RFQ ID:</span><span>{selectedQuotation.rfqId || '—'}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Valid Until:</span><span>{formatDate(selectedQuotation.validTill)}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Uploaded On:</span><span>{formatDate(selectedQuotation.uploadedAt)}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Total Value:</span><span className="quotation-value">{formatCurrency(selectedQuotation.totalValue)}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Vendor Contact:</span><span>{selectedQuotation.vendorContact || '—'}</span></div>
                </div>
              </div>
              {(selectedQuotation.groupName || selectedQuotation.subGroupName || selectedQuotation.projectId) && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Project Assignment</h3>
                  <div className="quotation-details-grid">
                    {selectedQuotation.groupName && <div className="quotation-detail-item"><span className="quotation-detail-label">Group:</span><span>{selectedQuotation.groupName}</span></div>}
                    {selectedQuotation.subGroupName && <div className="quotation-detail-item"><span className="quotation-detail-label">Sub Group:</span><span>{selectedQuotation.subGroupName}</span></div>}
                    {selectedQuotation.projectId && <div className="quotation-detail-item"><span className="quotation-detail-label">Project ID:</span><span>{selectedQuotation.projectId}</span></div>}
                  </div>
                </div>
              )}
              {(selectedQuotation.deliveryTime || selectedQuotation.paymentTerms || selectedQuotation.warranty) && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Terms & Conditions</h3>
                  <div className="quotation-details-grid">
                    {selectedQuotation.deliveryTime && <div className="quotation-detail-item"><span className="quotation-detail-label">Delivery Time:</span><span>{selectedQuotation.deliveryTime}</span></div>}
                    {selectedQuotation.paymentTerms && <div className="quotation-detail-item"><span className="quotation-detail-label">Payment Terms:</span><span>{selectedQuotation.paymentTerms}</span></div>}
                    {selectedQuotation.warranty && <div className="quotation-detail-item"><span className="quotation-detail-label">Warranty:</span><span>{selectedQuotation.warranty}</span></div>}
                  </div>
                </div>
              )}
              {selectedQuotation.items?.length > 0 && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Quotation Items ({selectedQuotation.items.length})</h3>
                  <div className="quotation-items-table-wrapper">
                    <table className="quotation-items-table">
                      <thead><tr><th>Line</th><th>Item Name</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Line Total</th></tr></thead>
                      <tbody>
                        {selectedQuotation.items.map((item, idx) => {
                          const qty = parseFloat(item.quantity) || 0, price = parseFloat(item.unitPrice) || 0, tax = parseFloat(item.taxPercent) || 0;
                          const sub = qty * price, total = sub + sub * tax / 100;
                          return (
                            <tr key={item.id || idx}>
                              <td>{item.lineNo || idx + 1}</td><td>{item.itemName}</td><td>{item.description || '—'}</td>
                              <td className="text-right">{formatQty(qty)}</td><td className="text-right">{formatCurrency(price)}</td>
                              <td className="text-center">{tax}%</td><td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedQuotation.notes && <div className="procurement-quotation-received-drawer-section"><h3>Notes</h3><p style={{ color: '#475569', lineHeight: 1.6 }}>{selectedQuotation.notes}</p></div>}
              <div className="procurement-quotation-received-drawer-section">
                <h3>Attached Files</h3>
                {selectedQuotation.fileName ? (
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={24} color="#64748b" />
                      <div><div style={{ fontWeight: 500, color: '#1e293b' }}>{selectedQuotation.fileName}</div><div style={{ fontSize: 12, color: '#64748b' }}>{formatFileSize(selectedQuotation.fileSize)}</div></div>
                    </div>
                    <a href={`${API_BASE_URL}/quotations/${selectedQuotation.id}/file`} target="_blank" rel="noopener noreferrer" className="procurement-quotation-received-btn-secondary" style={{ padding: '6px 12px', fontSize: 14 }}><Download size={16} /> View</a>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No file attached</p>}
              </div>
              <div className="procurement-quotation-received-drawer-actions">
                {(selectedQuotation.status === 'Approved' || selectedQuotation.status === 'Partially Ordered') && canCreate && (
                  <button className="procurement-quotation-received-btn-primary" onClick={() => { setShowDetailDrawer(false); handleOpenCreatePOModal(selectedQuotation); }}><ShoppingCart size={18} /> Create Purchase Order</button>
                )}
                {selectedQuotation.status !== 'PO Created' && canEdit && (
                  <button className="procurement-quotation-received-btn-secondary" onClick={() => { setShowDetailDrawer(false); handleEditQuotation(selectedQuotation); }}><Edit2 size={18} /> Edit Quotation</button>
                )}
                {selectedQuotation.status !== 'Approved' && selectedQuotation.status !== 'Rejected' && selectedQuotation.status !== 'PO Created' && (
                  <>
                    {selectedQuotation.status === 'New' && canEdit && <button className="procurement-quotation-received-btn-secondary" onClick={() => handleUpdateStatus(selectedQuotation.id, 'Shortlisted')}><Star size={18} /> Shortlist</button>}
                    {(selectedQuotation.status === 'Shortlisted' || selectedQuotation.status === 'New') && canApprove && <button className="procurement-quotation-received-btn-secondary" onClick={() => handleUpdateStatus(selectedQuotation.id, 'Approved')}><Check size={18} /> Approve</button>}
                    {canEdit && <button className="procurement-quotation-received-btn-secondary" style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleUpdateStatus(selectedQuotation.id, 'Rejected')}><XCircle size={18} /> Reject</button>}
                  </>
                )}
                {selectedQuotation.status !== 'PO Created' && canDelete && (
                  <button className="procurement-quotation-received-btn-secondary" style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleDeleteQuotation(selectedQuotation.id)}><Trash2 size={18} /> Delete Quotation</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload / Edit Quotation Modal ── */}
      {showUploadQuotationModal && quotationFormData && (
        <div className="procurement-quotation-received-modal-overlay">
          <div className="procurement-quotation-received-upload-modal" style={{ maxWidth: 1400, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="procurement-quotation-received-modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h2>{isEditMode ? 'Edit Quotation' : 'Upload New Quotation'}</h2>
                {isEditMode && quotationFormData.quoteNo && <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Quotation: {quotationFormData.quoteNo}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Download Template + Excel Import — only show when creating */}
                {!isEditMode && (
                  <>
                    <a
                      href="/templates/BOQ_Quotation_Template.xlsx"
                      download="BOQ_Quotation_Template.xlsx"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #86efac', borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      title="Download Excel template to fill and import"
                    >
                      <Download size={14} /> Download Template
                    </a>
                    <button
                      onClick={() => { setImportPreview([]); setImportErrors([]); setImportFileName(''); xlsxFileRef.current?.click(); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 15px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                      title="Select an Excel file to import items directly"
                    >
                      <FileSpreadsheet size={15} /> Import Items from Excel
                    </button>
                  </>
                )}
                <button className="procurement-quotation-received-modal-close" onClick={() => { setShowUploadQuotationModal(false); setIsEditMode(false); setVendorDropdownOpen(false); setVendorSearch(''); }}>✕</button>
              </div>
            </div>

            <div className="procurement-quotation-received-upload-form" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Project Assignment */}
              <div className="procurement-quotation-received-form-section" style={{ background: '#f8fafc', padding: 20, borderRadius: 8 }}>
                <h3>📂 Project Assignment</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Group *</label>
                    <FilterSelect
                      value={modalGroupName}
                      options={modalGroups}
                      placeholder={modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}
                      disabled={modalDropdownLoading.groups}
                      onChange={handleModalGroupChange}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Sub Group</label>
                    <FilterSelect
                      value={modalSubGroupName}
                      options={modalSubGroups}
                      placeholder={!modalGroupName ? 'Select Group First' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Sub Group'}
                      disabled={!modalGroupName || modalDropdownLoading.subGroups}
                      onChange={handleModalSubGroupChange}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Project (Optional)</label>
                    <FilterSelect
                      value={modalProjectId}
                      options={modalProjects.map(p => ({ value: p.id, label: p.name }))}
                      placeholder={!modalSubGroupName ? 'Select Sub Group First' : modalDropdownLoading.projects ? 'Loading…' : 'Select Project'}
                      disabled={!modalSubGroupName || modalDropdownLoading.projects}
                      onChange={handleModalProjectChange}
                      searchable={true}
                    />
                  </div>
                </div>
                {loadingOrderItems && <div style={{ marginTop: 10, color: '#3b82f6', fontSize: 13 }}>🔄 Loading order book items…</div>}
                {!isEditMode && itemSource === 'orderbook' && orderBookItems.length > 0 && <div style={{ marginTop: 10, color: '#059669', fontSize: 13 }}>✅ Loaded {orderBookItems.length} items from order book</div>}

                {/* ── Item source ──────────────────────────────────────────
                    Nothing loads until a source is picked. Mixing the project BOM
                    with the order book in one table is what produced duplicates. */}
                {modalProjectId && !isEditMode && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                      Where should the items come from?
                    </label>
                    <div className="qr-source-grid">
                      {QR_ITEM_SOURCES.map(src => (
                        <button
                          type="button"
                          key={src.key}
                          className={`qr-source-card${itemSource === src.key ? ' qr-source-card--active' : ''}`}
                          onClick={() => handleSelectItemSource(src.key)}
                        >
                          <span className="qr-source-card__title">{src.icon} {src.label}</span>
                          <span className="qr-source-card__hint">{src.hint}</span>
                        </button>
                      ))}
                    </div>
                    {itemSource === 'bom' && (
                      <div className="qr-source-panel">
                        <span>
                          {bomLoadedCount > 0
                            ? `✓ ${bomLoadedCount} line${bomLoadedCount === 1 ? '' : 's'} loaded from the project BOM`
                            : 'Pick the BOM lines this vendor quoted for.'}
                        </span>
                        <button type="button" className="qr-source-pick" onClick={() => setShowBomPicker(true)}>
                          {bomLoadedCount > 0 ? 'Add more lines' : 'Choose BOM items'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vendor */}
              <div className="procurement-quotation-received-form-section">
                <h3>🏢 Vendor Information</h3>
                <div style={{ marginBottom: 15, display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="radio" name="vendorType" checked={!showNewVendorForm} onChange={() => handleVendorTypeChange('existing')} style={{ marginRight: 8 }} /><span>Select Existing Vendor</span></label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="radio" name="vendorType" checked={showNewVendorForm} onChange={() => handleVendorTypeChange('new')} style={{ marginRight: 8 }} /><span>Add New Vendor</span></label>
                </div>
                {!showNewVendorForm && (
                  <div className="procurement-quotation-received-form-row">
                    <div className="procurement-quotation-received-form-group" style={{ position: 'relative' }}>
                      <label>Select Vendor *</label>
                      {/* Searchable vendor dropdown — matches Create PO modal */}
                      <div style={{ position: 'relative' }}>
                        <div
                          onClick={() => { setVendorDropdownOpen(o => !o); setVendorSearch(''); }}
                          style={{
                            width: '100%', padding: '10px 36px 10px 12px', fontSize: '14px',
                            border: `1px solid ${vendorDropdownOpen ? '#3b82f6' : '#d1d5db'}`,
                            borderRadius: '6px', background: 'white', cursor: 'pointer',
                            boxSizing: 'border-box', position: 'relative', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between',
                            userSelect: 'none', minHeight: '42px'
                          }}
                        >
                          <span style={{ color: quotationFormData.vendorId ? '#111827' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {quotationFormData.vendorId
                              ? (() => { const sel = vendors.find(v => v.id === quotationFormData.vendorId); return sel ? `${sel.name}${(sel.phone || sel.contact) ? ' • ' + (sel.phone || sel.contact) : ''}` : 'Select Vendor'; })()
                              : '-- Select Vendor --'}
                          </span>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0, color: '#6b7280', transform: vendorDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {vendorDropdownOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #3b82f6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 9999, marginTop: '4px', overflow: 'hidden' }}>
                            {/* Search box */}
                            <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                              <input
                                autoFocus
                                type="text"
                                value={vendorSearch}
                                onChange={e => setVendorSearch(e.target.value)}
                                placeholder="Search vendor by name, phone..."
                                onClick={e => e.stopPropagation()}
                                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '5px', outline: 'none', boxSizing: 'border-box' }}
                              />
                            </div>
                            {/* Options list */}
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                              <div
                                onClick={() => { handleVendorSelection({ target: { value: '' } }); setVendorDropdownOpen(false); }}
                                style={{ padding: '9px 12px', fontSize: '14px', color: '#9ca3af', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                              >
                                -- Select Vendor --
                              </div>
                              {vendors
                                .filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || (v.phone || v.contact)?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase()))
                                .map(v => (
                                  <div
                                    key={v.id}
                                    onClick={() => { handleVendorSelection({ target: { value: String(v.id) } }); setVendorDropdownOpen(false); setVendorSearch(''); }}
                                    style={{
                                      padding: '9px 12px', fontSize: '14px', cursor: 'pointer',
                                      background: quotationFormData.vendorId === v.id ? '#eff6ff' : 'white',
                                      borderLeft: quotationFormData.vendorId === v.id ? '3px solid #3b82f6' : '3px solid transparent'
                                    }}
                                    onMouseEnter={e => { if (quotationFormData.vendorId !== v.id) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={e => { if (quotationFormData.vendorId !== v.id) e.currentTarget.style.background = 'white'; }}
                                  >
                                    <div style={{ fontWeight: 500, color: '#111827' }}>{v.name}</div>
                                    {((v.phone || v.contact) || v.category) && (
                                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                        {(v.phone || v.contact) && <span>{v.phone || v.contact}</span>}
                                        {(v.phone || v.contact) && v.category && <span> · </span>}
                                        {v.category && <span>{v.category}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))
                              }
                              {vendors.filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || (v.phone || v.contact)?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                                <div style={{ padding: '12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>No vendors found</div>
                              )}
                            </div>
                            <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#9ca3af' }}>{vendors.length} vendor(s) total</div>
                          </div>
                        )}
                        {/* Click-outside overlay */}
                        {vendorDropdownOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setVendorDropdownOpen(false)} />}
                      </div>
                      {vendors.length === 0 && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>No vendors available. Select a group or add a new vendor.</small>}
                    </div>
                    {quotationFormData.vendorId && selectedVendorDetails && (
                      <div className="procurement-quotation-received-form-group">
                        <label>Selected Vendor Details</label>
                        <div style={{ padding: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, fontSize: 14, color: '#0c4a6e' }}>
                          <div style={{ marginBottom: 6 }}><strong>📋 Name:</strong> {selectedVendorDetails.name}</div>
                          {selectedVendorDetails.phone && <div><strong>📞 Contact:</strong> {selectedVendorDetails.phone}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {showNewVendorForm && (
                  <div style={{ padding: 20, background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                      <div className="procurement-quotation-received-form-group">
                        <label>Vendor Name *</label>
                        <input type="text" value={quotationFormData.vendorName || ''} onChange={(e) => setQuotationFormData({ ...quotationFormData, vendorName: e.target.value })} placeholder="Enter vendor name" />
                      </div>
                      <div className="procurement-quotation-received-form-group">
                        <label>Contact Number <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                        <input type="tel" value={quotationFormData.vendorContact || ''} onChange={(e) => handleNewVendorContactChange(e.target.value)} placeholder="10-digit mobile" maxLength={10} />
                        {quotationFormData.vendorContact && quotationFormData.vendorContact.length > 0 && quotationFormData.vendorContact.length < 10 &&
                          <small style={{ color: '#dc2626', fontSize: 12, marginTop: 4, display: 'block' }}>Must be exactly 10 digits</small>}
                      </div>
                      <div className="procurement-quotation-received-form-group">
                        <label>Category *</label>
                        <FilterSelect
                          value={quotationFormData.vendorCategory || ''}
                          options={[
                            ...VENDOR_CATEGORIES.map(c => ({ value: c, label: c })),
                            ...(quotationFormData.vendorCategory && quotationFormData.vendorCategory !== 'Other' && !VENDOR_CATEGORIES.includes(quotationFormData.vendorCategory) ? [{ value: quotationFormData.vendorCategory, label: quotationFormData.vendorCategory }] : []),
                            { value: 'Other', label: 'Other (enter manually)' },
                          ]}
                          placeholder="Select category"
                          onChange={v => { setQuotationFormData({ ...quotationFormData, vendorCategory: v }); if (v !== 'Other') setCustomVendorCategory(''); }}
                        />
                        {quotationFormData.vendorCategory === 'Other' && (
                          <input type="text" value={customVendorCategory} onChange={e => setCustomVendorCategory(e.target.value)} placeholder="Enter custom category" style={{ marginTop: 6, width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
                        )}
                      </div>
                      <div className="procurement-quotation-received-form-group">
                        <label>Vendor Type *</label>
                        <FilterSelect
                          value={quotationFormData.vendorType || ''}
                          options={[
                            ...VENDOR_TYPES.map(t => ({ value: t, label: t })),
                            ...(quotationFormData.vendorType && quotationFormData.vendorType !== 'Other' && !VENDOR_TYPES.includes(quotationFormData.vendorType) ? [{ value: quotationFormData.vendorType, label: quotationFormData.vendorType }] : []),
                            { value: 'Other', label: 'Other (enter manually)' },
                          ]}
                          placeholder="Select type"
                          onChange={v => { setQuotationFormData({ ...quotationFormData, vendorType: v }); if (v !== 'Other') setCustomVendorType(''); }}
                        />
                        {quotationFormData.vendorType === 'Other' && (
                          <input type="text" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)} placeholder="Enter custom vendor type" style={{ marginTop: 6, width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', padding: '12px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>💡 This vendor will be created when you save the quotation.</div>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="procurement-quotation-received-form-section">
                <h3>Basic Information</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Vendor RFQ ID</label>
                    <input type="text" value={quotationFormData.rfqId} onChange={(e) => setQuotationFormData({ ...quotationFormData, rfqId: e.target.value })} placeholder="e.g., RFQ-2024-001" />
                  </div>
                  {/* Category removed — not needed in this context
                  <div className="procurement-quotation-received-form-group">
                    <label>Category</label>
                    <FilterSelect
                      value={quotationFormData.category}
                      options={CATEGORIES.map(c => ({ value: c, label: c }))}
                      placeholder="Select category"
                      onChange={v => setQuotationFormData({ ...quotationFormData, category: v })}
                    />
                  </div>
                  */}
                  <div className="procurement-quotation-received-form-group">
                    <label>Status *</label>
                    <FilterSelect
                      value={quotationFormData.status}
                      options={[
                        { value: 'New',          label: 'New'          },
                        { value: 'Under Review', label: 'Under Review' },
                        { value: 'Shortlisted',  label: 'Shortlisted'  },
                        { value: 'Approved',     label: 'Approved'     },
                        { value: 'Rejected',     label: 'Rejected'     },
                        ...(isEditMode && quotationFormData.status === 'PO Created' ? [{ value: 'PO Created', label: 'PO Created' }] : []),
                      ]}
                      placeholder="Select status"
                      onChange={v => setQuotationFormData({ ...quotationFormData, status: v })}
                    />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Valid Till *</label>
                    <QRDatePicker
                      value={quotationFormData.validTill}
                      onChange={v => setQuotationFormData({ ...quotationFormData, validTill: v })}
                      placeholder="Select valid till date"
                      minDate={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Payment Terms</label>
                    <input type="text" value={quotationFormData.paymentTerms} onChange={(e) => setQuotationFormData({ ...quotationFormData, paymentTerms: e.target.value })} placeholder="e.g., Net 30" />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Delivery Time</label>
                    <input type="text" value={quotationFormData.deliveryTime} onChange={(e) => setQuotationFormData({ ...quotationFormData, deliveryTime: e.target.value })} placeholder="e.g., 2 weeks" />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Warranty</label>
                    <input type="text" value={quotationFormData.warranty} onChange={(e) => setQuotationFormData({ ...quotationFormData, warranty: e.target.value })} placeholder="e.g., 1 year" />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group" style={{ flex: '1 1 100%' }}>
                    <label>Notes</label>
                    <input type="text" value={quotationFormData.notes} onChange={(e) => setQuotationFormData({ ...quotationFormData, notes: e.target.value })} placeholder="Additional notes" />
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div className="procurement-quotation-received-form-section">
                <h3>Attach Quotation File (Optional)</h3>
                <div className="procurement-quotation-received-form-group">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} style={{ marginBottom: 10 }} />
                  {selectedFile && <div className="file-info-box">📄 {selectedFile.name} ({formatFileSize(selectedFile.size)})</div>}
                  {filePreview && <img src={filePreview} alt="Preview" style={{ maxWidth: 200, marginTop: 10 }} />}
                  <small style={{ color: '#64748b' }}>Max 5MB | PDF, JPG, PNG</small>
                  {isEditMode && <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 13 }}>ℹ️ Uploading a new file will replace the existing one</div>}
                </div>
              </div>

              {/* Items */}
              <div className="procurement-quotation-received-form-section">
                <div className="procurement-quotation-received-section-header">
                  <h3>
                    Quotation Items *
                    {quotationFormData.items.length > 0 && (
                      <span style={{ fontSize: 14, color: '#64748b', fontWeight: 'normal', marginLeft: 8 }}>
                        ({quotationFormData.items.filter(i => i.included !== false).length} of {quotationFormData.items.length} included)
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isEditMode && (
                      <button type="button" onClick={() => { setImportPreview([]); setImportErrors([]); setImportFileName(''); xlsxFileRef.current?.click(); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        <FileSpreadsheet size={13} /> Import from Excel
                      </button>
                    )}
                    <button type="button" className="procurement-quotation-received-btn-add-item" onClick={handleAddQuotationItem}>+ Add Item</button>
                  </div>
                </div>

                {quotationFormData.items.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', border: '2px dashed #cbd5e0', borderRadius: 8 }}>
                    <div style={{ fontSize: 48, marginBottom: 10 }}>📦</div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 5, color: '#64748b' }}>No Items Added</div>
                    <div style={{ fontSize: 14, color: '#94a3b8' }}>
                      {isEditMode ? 'Click "+ Add Item" to add items' : 'Click "Import from Excel" to bulk-add items, or "+ Add Item" to add manually'}
                    </div>
                  </div>
                ) : (
                  <>
                    {!isEditMode && orderBookItems.length > 0 && (
                      <div style={{ marginBottom: 15, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, color: '#1e40af' }}>
                        💡 <strong>Tip:</strong> Items loaded from order book. Uncheck items you don't want and enter vendor prices.
                      </div>
                    )}
                    <div className="procurement-quotation-received-items-table-wrapper">
                      <table className="procurement-quotation-received-items-table">
                        <colgroup>
                          <col style={{ width: '40px' }} />
                          <col style={{ width: '44px' }} />
                          <col style={{ width: 'auto' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '48px' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Inc</th>
                            <th>S.No</th>
                            <th>Description *</th>
                            <th>Unit</th>
                            <th>Qty *</th>
                            <th>Make</th>
                            <th>Rate (₹) *</th>
                            <th>GST %</th>
                            <th>Amount</th>
                            <th>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotationFormData.items.map((item, idx) => {
                            const inc = item.included !== false;
                            const qty = parseFloat(item.quantity) || 0;
                            const price = parseFloat(item.unitPrice) || 0;
                            const taxPct = parseFloat(item.taxPercent) || 0;
                            const base = qty * price;
                            const amount = base + base * taxPct / 100; // GST-inclusive line total
                            return (
                              <tr key={idx} style={{ background: inc ? 'white' : '#f8fafc', opacity: inc ? 1 : 0.5 }}>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={inc} onChange={() => toggleItemInclusion(idx)} style={{ width: 18, height: 18, cursor: 'pointer' }} /></td>
                                <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{idx + 1}</td>
                                <td>
                                  {inc ? (
                                    <ItemNameAutocomplete
                                      value={item.itemName}
                                      onChange={(val) => handleUpdateQuotationItem(idx, 'itemName', val)}
                                      onSelect={(cat) => {
                                        const items = [...quotationFormData.items];
                                        items[idx] = {
                                          ...items[idx],
                                          itemName:    cat.itemName,
                                          description: cat.specification || cat.description || items[idx].description,
                                          unit:        cat.unit           || items[idx].unit,
                                          unitPrice:   cat.unitPrice  > 0 ? cat.unitPrice  : items[idx].unitPrice,
                                        };
                                        setQuotationFormData({ ...quotationFormData, items });
                                      }}
                                      user={user}
                                      placeholder="Item name / description"
                                      className="table-input"
                                    />
                                  ) : (
                                    <input type="text" placeholder="Item name / description" value={item.itemName} className="table-input" disabled />
                                  )}
                                  <input type="text" placeholder="Specification (optional)" value={item.description} onChange={(e) => handleUpdateQuotationItem(idx, 'description', e.target.value)} className="table-input" disabled={!inc} style={{ marginTop: 3, fontSize: 11, color: '#64748b' }} />
                                  {/* §4.3 — flagged, never blocking. A quotation records what
                                      the vendor sent; the PO is where this becomes a hard stop. */}
                                  {item.bomLineId && parseFloat(item.quantity || 0) > parseFloat(item.remainingQty ?? Infinity) && (
                                    <div className="qr-bom-warn">
                                      ⚠ {item.quantity} requested, BOM allows {item.remainingQty} more
                                      (over by {(parseFloat(item.quantity || 0) - parseFloat(item.remainingQty || 0)).toFixed(2).replace(/\.00$/, '')})
                                    </div>
                                  )}
                                  {!item.bomLineId && modalProjectId && item.itemName?.trim() && (
                                    <div className="qr-bom-warn qr-bom-warn--muted">
                                      Not on the project BOM.{' '}
                                      <a href={`/projects/${encodeURIComponent(modalProjectId)}?tab=bom`} target="_blank" rel="noreferrer">
                                        Open BOM
                                      </a>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div className="qr-unit-select-wrap">
                                    <FilterSelect
                                      value={item.unit === '' || item.unit == null || COMMON_UNITS.includes(item.unit) ? (item.unit || '') : 'Custom'}
                                      options={[
                                        ...COMMON_UNITS.map(u => ({ value: u, label: u })),
                                        { value: 'Custom', label: '✏️ Custom' },
                                      ]}
                                      placeholder="Unit"
                                      disabled={!inc}
                                      onChange={(val) => {
                                        if (val === 'Custom') handleUpdateQuotationItem(idx, 'unit', '');
                                        else handleUpdateQuotationItem(idx, 'unit', val || '');
                                      }}
                                    />
                                  </div>
                                  {(item.unit !== '' && item.unit != null && !COMMON_UNITS.includes(item.unit)) && (
                                    <input
                                      type="text"
                                      placeholder="Enter custom unit"
                                      value={item.unit}
                                      onChange={(e) => handleUpdateQuotationItem(idx, 'unit', e.target.value)}
                                      className="table-input text-center"
                                      disabled={!inc}
                                      style={{ marginTop: 3, fontSize: 11 }}
                                    />
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Qty"
                                    value={formatIndianInput(item.quantity)}
                                    onChange={e => {
                                      const raw = e.target.value.replace(/,/g, '');
                                      if (/^\d*\.?\d{0,3}$/.test(raw)) handleUpdateQuotationItem(idx, 'quantity', raw);
                                    }}
                                    className="table-input text-center"
                                    disabled={!inc}
                                  />
                                </td>
                                <td><input type="text" placeholder="Brand / Make" value={item.make || ''} onChange={(e) => handleUpdateQuotationItem(idx, 'make', e.target.value)} className="table-input" disabled={!inc} /></td>
                                <td>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Rate"
                                    value={formatIndianInput(item.unitPrice)}
                                    onChange={e => {
                                      const raw = e.target.value.replace(/,/g, '');
                                      if (/^\d*\.?\d{0,3}$/.test(raw)) handleUpdateQuotationItem(idx, 'unitPrice', raw);
                                    }}
                                    className="table-input text-right"
                                    disabled={!inc}
                                  />
                                </td>
                                <td>
                                  <select
                                    value={parseFloat(item.taxPercent) || 0}
                                    onChange={(e) => handleUpdateQuotationItem(idx, 'taxPercent', Number(e.target.value))}
                                    className="table-input text-center"
                                    disabled={!inc}
                                  >
                                    {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                                  </select>
                                </td>
                                <td className="text-right" style={{ fontWeight: 600, color: inc ? '#1e293b' : '#94a3b8' }}>{inc && item.unitPrice ? formatCurrency(amount) : '-'}</td>
                                <td className="text-center"><button type="button" className="procurement-quotation-received-btn-remove-item" onClick={() => handleRemoveQuotationItem(idx)} title="Remove">✕</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(() => {
                      const totals = calculateQuotationTotal();
                      return (
                        <div className="procurement-quotation-received-quote-summary" style={{ marginTop: 14 }}>
                          <div className="procurement-quotation-received-summary-row"><span>Subtotal:</span><span>{formatCurrency(totals.subtotal)}</span></div>
                          {totals.gstAmount > 0 && <div className="procurement-quotation-received-summary-row"><span>GST:</span><span>{formatCurrency(totals.gstAmount)}</span></div>}
                          <div className="procurement-quotation-received-summary-row procurement-quotation-received-summary-total"><span><strong>Total Value:</strong></span><span><strong>{formatCurrency(totals.total)}</strong></span></div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            <div className="procurement-quotation-received-modal-actions" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <button className="procurement-quotation-received-btn-primary" onClick={handleSaveQuotation} disabled={quotationFormData.items.filter(i => i.included !== false).length === 0}>
                {isEditMode ? 'Update Quotation' : 'Upload Quotation'}
              </button>
              <button className="procurement-quotation-received-btn-secondary" onClick={() => { setShowUploadQuotationModal(false); setIsEditMode(false); setVendorDropdownOpen(false); setVendorSearch(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for Excel import — rendered unconditionally so
          xlsxFileRef.current is always valid when the user clicks Import Items from Excel */}
      <input ref={xlsxFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleXlsxFileSelect} style={{ display: 'none' }} />

      {/* ── Excel Import Modal ── */}
      {showImportModal && (
        <div className="procurement-quotation-received-modal-overlay">
          <div className="procurement-quotation-received-upload-modal" style={{ maxWidth: 900 }}>
            <div className="procurement-quotation-received-modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={22} color="#2563eb" /> Import Quotation Items from Excel
              </h2>
              <button className="procurement-quotation-received-modal-close" onClick={handleCloseImportModal}>✕</button>
            </div>

            <div className="procurement-quotation-received-upload-form" style={{ padding: '20px 24px' }}>

              {/* File selected info + option to change */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileSpreadsheet size={20} color="#2563eb" />
                  <div>
                    <strong style={{ fontSize: 13, color: '#1e40af', display: 'block' }}>{importFileName || 'Excel file selected'}</strong>
                    <span style={{ fontSize: 12, color: '#3b82f6' }}>Review the items below before importing into the form</span>
                  </div>
                </div>
                <button
                  onClick={() => { setImportPreview([]); setImportErrors([]); setImportFileName(''); xlsxFileRef.current?.click(); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#2563eb', border: '1.5px solid #93c5fd', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  <Upload size={13} /> Choose Different File
                </button>
              </div>

              {/* Errors */}
              {importErrors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                  <strong style={{ color: '#dc2626', display: 'block', marginBottom: 6 }}>⚠ Fix these errors before importing:</strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#b91c1c', fontSize: 12, lineHeight: 1.7 }}>
                    {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Preview */}
              {importPreview.length > 0 && importErrors.length === 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong style={{ color: '#1e40af', fontSize: 14 }}>✓ {importPreview.length} item{importPreview.length !== 1 ? 's' : ''} ready to import</strong>
                    <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 12 }}>
                      Est. total: {formatCurrency(importPreview.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0), 0))}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 280, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#1e3a5f' }}>
                          {['#', 'Description', 'Unit', 'Qty', 'Make', 'Rate (₹)', 'Amount'].map(h => (
                            <th key={h} style={{ padding: '9px 11px', textAlign: 'left', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => {
                          const lt = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                              <td style={{ padding: '7px 11px', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                              <td style={{ padding: '7px 11px', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.itemName}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'center', color: '#64748b' }}>{row.unit || '—'}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'center' }}>{formatQty(row.quantity)}</td>
                              <td style={{ padding: '7px 11px', color: '#64748b', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.make || '—'}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.unitPrice)}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(lt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="procurement-quotation-received-modal-actions">
              <button className="procurement-quotation-received-btn-secondary" onClick={handleCloseImportModal}>Cancel</button>
              <button
                className="procurement-quotation-received-btn-primary"
                onClick={handleConfirmImport}
                disabled={importPreview.length === 0 || importErrors.length > 0}
                style={{ opacity: (importPreview.length === 0 || importErrors.length > 0) ? 0.5 : 1 }}
              >
                Import {importPreview.length > 0 ? `${importPreview.length} Item${importPreview.length !== 1 ? 's' : ''}` : 'Items'} into Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create PO Modal ── */}
      {showCreatePOFromQuotationModal && poFormData && (
        <div className="procurement-quotation-received-modal-overlay">
          <div className="procurement-quotation-received-upload-modal" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="procurement-quotation-received-modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h2>Create Purchase Order</h2>
                <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>From Quotation: {poFormData.quoteNo}</p>
              </div>
              <button className="procurement-quotation-received-modal-close" onClick={() => setShowCreatePOFromQuotationModal(false)}>✕</button>
            </div>
            <div className="procurement-quotation-received-upload-form" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="procurement-quotation-received-form-section">
                <h3>Purchase Order Details</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group"><label>Vendor Contact</label><input type="text" value={poFormData.vendorContact || 'N/A'} disabled style={{ backgroundColor: '#f1f5f9' }} /></div>
                  <div className="procurement-quotation-received-form-group"><label>Vendor RFQ Id</label><input type="text" value={poFormData.rfqId || 'N/A'} disabled style={{ backgroundColor: '#f1f5f9' }} /></div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Document Type</label>
                    <FilterSelect
                      value={poFormData.documentType || 'PURCHASE_ORDER'}
                      options={[{ value: 'PURCHASE_ORDER', label: 'Purchase Order' }, { value: 'WORK_ORDER', label: 'Work Order' }]}
                      placeholder="Select type"
                      onChange={v => setPOFormData({ ...poFormData, documentType: v })}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Status</label>
                    <FilterSelect
                      value={poFormData.status || 'Draft'}
                      options={[{ value: 'Draft', label: 'Draft' }, { value: 'Approved', label: 'Approved' }]}
                      placeholder="Select status"
                      onChange={v => setPOFormData({ ...poFormData, status: v })}
                    />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Order Date</label>
                    <QRDatePicker
                      value={poFormData.orderDate}
                      onChange={v => setPOFormData({ ...poFormData, orderDate: v })}
                      placeholder="Select order date"
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Expected Delivery *</label>
                    <QRDatePicker
                      value={poFormData.expectedDelivery}
                      onChange={v => setPOFormData({ ...poFormData, expectedDelivery: v })}
                      placeholder="Select delivery date"
                      minDate={poFormData.orderDate}
                    />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group"><label>Payment Terms</label><input type="text" value={poFormData.paymentTerms} onChange={(e) => setPOFormData({ ...poFormData, paymentTerms: e.target.value })} placeholder="e.g., Net 30" /></div>
                  <div className="procurement-quotation-received-form-group"><label>Shipping Address</label><input type="text" value={poFormData.shippingAddress} onChange={(e) => setPOFormData({ ...poFormData, shippingAddress: e.target.value })} placeholder="Enter shipping address" /></div>
                </div>
                <div className="procurement-quotation-received-form-group"><label>Notes</label><textarea rows={2} value={poFormData.notes} onChange={(e) => setPOFormData({ ...poFormData, notes: e.target.value })} placeholder="Additional notes" style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #e2e8f0' }} /></div>
              </div>
              <div className="procurement-quotation-received-form-section">
                <h3>Select Items & Quantities</h3>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>Adjust quantities as needed — capped at the remaining qty (quoted minus already ordered on prior POs)</p>
                <div className="procurement-quotation-received-items-table-wrapper">
                  <table className="procurement-quotation-received-items-table">
                    <thead><tr><th>Item Name</th><th>Description</th><th>Quoted Qty</th><th>Remaining</th><th>PO Qty *</th><th>Unit Price (₹)</th><th>GST %</th><th>Line Total</th></tr></thead>
                    <tbody>
                      {poFormData.items.map((item, idx) => {
                        const fullyOrdered = item.remainingQty <= 0;
                        return (
                        <tr key={idx} style={{ opacity: fullyOrdered ? 0.5 : 1 }}>
                          <td>{item.itemName}</td><td>{item.description || '—'}</td>
                          <td className="text-center" style={{ fontWeight: 600 }}>{formatQty(item.quotedQuantity)}</td>
                          <td className="text-center" style={{ fontWeight: 600, color: fullyOrdered ? '#dc2626' : '#059669' }}>{fullyOrdered ? 'Fully ordered' : formatQty(item.remainingQty)}</td>
                          <td><input type="number" min="0" max={item.remainingQty} value={item.selectedQuantity} onChange={(e) => handleUpdatePOItemQuantity(idx, e.target.value)} className="table-input text-center" style={{ fontWeight: 600 }} disabled={fullyOrdered} title={fullyOrdered ? 'This item is already fully ordered under this quotation' : ''} /></td>
                          <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-center">{item.taxPercent}%</td>
                          <td className="text-right" style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(item.lineTotal)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="procurement-quotation-received-quote-summary">
                  <div className="procurement-quotation-received-summary-row"><span>Subtotal:</span><span>{formatCurrency(calculatePOTotal().subtotal)}</span></div>
                  <div className="procurement-quotation-received-summary-row"><span>Tax Amount:</span><span>{formatCurrency(calculatePOTotal().taxAmount)}</span></div>
                  <div className="procurement-quotation-received-summary-row procurement-quotation-received-summary-total"><span><strong>Total PO Value:</strong></span><span><strong>{formatCurrency(calculatePOTotal().total)}</strong></span></div>
                </div>
              </div>
            </div>
            <div className="procurement-quotation-received-modal-actions" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <button className="procurement-quotation-received-btn-primary" onClick={handleCreatePOFromQuotation} disabled={!poFormData.expectedDelivery || !poFormData.items.some(i => i.selectedQuantity > 0)}>Create Purchase Order</button>
              <button className="procurement-quotation-received-btn-secondary" onClick={() => setShowCreatePOFromQuotationModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate PO-PDF modal — opened right after a PO is created (parity with Purchase Orders page) */}
      <GeneratePoModal
        open={!!genPo}
        po={genPo}
        vendor={genVendor}
        authHeaders={getAuthHeaders()}
        onClose={() => { setGenPo(null); setGenVendor(null); }}
        onGenerated={() => { fetchQuotations(); }}
        showSuccess={showSuccess}
        showError={showError}
      />
    </div>
  );
};

export default QuotationsReceived;