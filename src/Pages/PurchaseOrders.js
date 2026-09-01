import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, Plus, X, Edit2, Eye, Truck,
  FileOutput, FileCog,
  CheckCircle, IndianRupee, Columns, FileText,
  Trash2, Upload, ExternalLink, File,
  ChevronUp, ChevronDown, ChevronsUpDown, GripVertical, Check
} from 'lucide-react';
import '../pages-css/PurchaseOrders.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import FilterSelect from "./../components/Dropdowns/FilterSelect.js";
import { COMMON_UNITS } from "./../components/Dropdowns/Unittypedropdown.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal';
import GeneratePoModal from './GeneratePoModal.js';
import ItemNameAutocomplete from '../components/OrderBook/ItemNameAutocomplete.js';
import BomItemPicker from '../components/procurement/BomItemPicker.js';
import BomViolationDialog from '../components/procurement/BomViolationDialog.js';
import BomMatchConfirmDialog from '../components/procurement/BomMatchConfirmDialog.js';

/* ── Inline-style theme mappers (added for dark mode) ── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#f8fafb':'#0f1420','#fcfcfd':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f1f1':'#232b3b','#f0f0f0':'#232b3b','#e9eef5':'#2b3445','#eef2f7':'#18202e',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#f0f9ff':'#15243d','#f0f4ff':'#1a2440','#eef2ff':'#1e1f45','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a','#bae6fd':'#16344d','#e0f2fe':'#16344d','#e0e7ff':'#1e2547','#93c5fd':'#2f5d92',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40','#bbf7d0':'#2a5a40','#86efac':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#fecdd3':'#3a1f26','#fff5f5':'#2b1d20','#fff1f2':'#2b1d20','#fff7ed':'#2c2113','#fffbeb':'#2a2710','#fffdf0':'#2a2710','#fef9c3':'#3a3016','#fef3c7':'#3a3016','#fde68a':'#5a4714','#fef08a':'#5a4714',
  '#f5f3ff':'#241b3d','#faf5ff':'#241b3d','#ede9fe':'#2a2147','#ddd6fe':'#2e2147','#e9d5ff':'#2e2147','#ecfeff':'#103038','#fce7f3':'#3a1f30',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a', '#cbd5e0':'#3a4456',};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6','#0b1220':'#e7ecf3',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258','#f59e0b':'#f5b945',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0891b2':'#22d3ee','#1e3a8a':'#7fb0f0',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3', '#0369a1':'#38bdf8', '#0c4a6e':'#7cc3f0',};
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

// ─── Calendar Constants ───────────────────────────────────────────────────────
const _PO_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _PO_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── PODateRangeFilter — for the filter bar (range calendar, like Leads page) ─
const PODateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  useThemeVersion();
  const [show,  setShow]  = useState(false);
  const [from,  setFrom]  = useState(null);
  const [to,    setTo]    = useState(null);
  const [hover, setHover] = useState(null);
  const [calMo, setCalMo] = useState(new Date().getMonth());
  const [calYr, setCalYr] = useState(new Date().getFullYear());
  const [showYr,setShowYr]= useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
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
      <button
        type="button"
        className={`po-cal-trigger${show?' po-cal--open':''}${appliedFrom?' po-cal--applied':''}`}
        onClick={() => setShow(p => !p)}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>{appliedFrom ? fmt(appliedFrom) : 'dd-mm-yyyy'}</span>
        <span className="po-cal-sep">—</span>
        <span className={appliedTo && appliedTo !== appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>
          {appliedTo && appliedTo !== appliedFrom ? fmt(appliedTo) : 'dd-mm-yyyy'}
        </span>
        {appliedFrom && (
          <span className="po-cal-x" onClick={e => { e.stopPropagation(); handleClear(); }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </span>
        )}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ marginLeft:'auto', color:__stc('#94a3b8'), flexShrink:0, transform:show?'rotate(180deg)':'none', transition:'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {show && (
        <div className="po-cal-dropdown" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, width:264 }}>
          <div className="po-cal-head">
            <button type="button" className="po-cal-nav"
              onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="po-cal-month-btn" onClick={() => setShowYr(p => !p)}>
              {_PO_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="po-cal-nav"
              onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {showYr ? (
            <div className="po-yr-grid">
              {Array.from({length:16},(_,i) => {
                const yr = new Date().getFullYear()-4+i;
                return (
                  <div key={yr} className={`po-yr-cell${yr===calYr?' po-yr-sel':''}`}
                    onClick={() => { setCalYr(yr); setShowYr(false); }}>
                    {yr}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="po-cal-grid">
              {_PO_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy  = i+1;
                const ds  = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const dow = (FD+i)%7;
                let cls   = 'po-cal-cell';
                if (ds===from)      cls += ' po-cal-from';
                else if (ds===to)   cls += ' po-cal-to';
                else if (inR(ds)) {
                  cls += ' po-cal-in-range';
                  if (dow===0) cls += ' po-cal-rr-s';
                  if (dow===6) cls += ' po-cal-rr-e';
                }
                if (ds===tod && ds!==from && ds!==to) cls += ' po-cal-today';
                return (
                  <div key={ds} className={cls}
                    onClick={() => clickDay(ds)}
                    onMouseEnter={() => from && !to && setHover(ds)}
                    onMouseLeave={() => setHover(null)}>
                    {dy}
                  </div>
                );
              })}
            </div>
          )}

          <div className="po-cal-footer">
            <div className="po-cal-chips">
              <span className={`po-cal-chip${from?' po-cal-chip--set':''}`}>{from ? fmt(from) : 'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/>
              </svg>
              <span className={`po-cal-chip${to?' po-cal-chip--set':''}`}>{to ? fmt(to) : 'To —'}</span>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%' }}>
              {(from || appliedFrom) && (
                <button type="button" className="po-cal-clear" onClick={handleClear}>Clear</button>
              )}
              <button type="button" className="po-cal-clear" onClick={() => setShow(false)}>Cancel</button>
              <button type="button" className="po-cal-apply" onClick={handleApply} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PODatePicker — single date calendar for modal forms (like TaskManagement) ─
const PODatePicker = ({ value, onChange, placeholder='Select date', minDate }) => {
  useThemeVersion();
  const [show,    setShow]    = useState(false);
  const [calMo,   setCalMo]   = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth());
  const [calYr,   setCalYr]   = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear());
  const [showYrP, setShowYrP] = useState(false);
  const wrapRef = React.useRef(null);

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
  const fmtD = d => { if (!d) return null; const[y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%' }}>
      <button type="button"
        className={`po-dtp-trigger${show?' po-dtp--open':''}${value?' po-dtp--set':''}`}
        onClick={show ? () => setShow(false) : open}
        style={{ width:'100%' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink:0, color: value?__stc('#4f46e5'):__stc('#94a3b8') }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        {value
          ? <span style={{ flex:1, fontSize:13, fontWeight:600, color:__stc('#0f172a') }}>{fmtD(value)}</span>
          : <span className="po-dtp-ph">{placeholder}</span>
        }
        {value
          ? <span className="po-dtp-x" onClick={e => { e.stopPropagation(); onChange(''); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ marginLeft:'auto', color:__stc('#94a3b8'), transform:show?'rotate(180deg)':'none', transition:'transform .2s', flexShrink:0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
        }
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
              {_PO_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
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
              {_PO_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy = i+1;
                const ds = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const isMin = minDate && ds < minDate;
                let cls = 'po-cal-cell';
                if (ds===value) cls += ' po-dtp-sel';
                else if (ds===tod) cls += ' po-cal-today';
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

// ─── Vendor category / type options (shared across pages) ─────────────────────
const VENDOR_CATEGORIES = ['Manufacturing', 'Supplier', 'Services', 'Electrical', 'Civil & Structural', 'Instrumentation', 'IoT Hardware', 'Logistics & Transport'];

/**
 * Item sources, in the order of prominence the spec asks for: quotation first when
 * approved quotations exist, then the project BOM, then the order book — kept last
 * because it describes what was SOLD, not what needs buying.
 */
const ITEM_SOURCES = [
  { key: 'quotation', icon: '📋', label: 'From Quotation',
    hint: (n) => `Select from ${n} approved quotation${n === 1 ? '' : 's'}` },
  { key: 'bom',       icon: '🧾', label: 'From Project BOM',
    hint: () => 'Pick what the project still needs to buy' },
  { key: 'orderbook', icon: '📦', label: 'From Order Book',
    hint: () => 'What was sold to the customer' },
];
const VENDOR_TYPES      = ['Manufacturer', 'Distributor', 'Service Provider', 'Contractor', 'System Integrator', 'Trader'];

// ─── Column Definitions ───────────────────────────────────────────────────────
const DEFAULT_COLUMNS = [
  { id: 'sNo',              label: 'S.No',               sortable: false, visible: true,  fixed: true  },
  { id: 'documentType',     label: 'Type',               sortable: false, visible: true  },
  { id: 'poNumber',         label: 'PO Number',          sortable: true,  visible: true  },
  { id: 'poRefId',          label: 'Vendor RFQ Id',      sortable: false, visible: false },
  { id: 'vendor',           label: 'Vendor',             sortable: true,  visible: true },
  { id: 'orderDate',        label: 'Order Date',         sortable: true,  visible: true },
  { id: 'totalValue',       label: 'Total Value',        sortable: true,  visible: true },
  { id: 'deliveryProgress', label: 'Delivery Progress',  sortable: false, visible: true },
  { id: 'paymentStatus',    label: 'Payment Status',     sortable: true,  visible: false },
  { id: 'status',           label: 'Status',             sortable: true,  visible: true },
  { id: 'group',            label: 'Group',              sortable: false, visible: false },
  { id: 'category',         label: 'Category',           sortable: false, visible: false },
  { id: 'project',          label: 'Project',            sortable: false, visible: true  },
  { id: 'actions',          label: 'Actions',            sortable: false, visible: true },
];

// ─── Sort Icon ────────────────────────────────────────────────────────────────
const SortIcon = ({ columnId, sortConfig }) => {
  if (!sortConfig || sortConfig.key !== columnId)
    return <ChevronsUpDown size={13} className="po-sort-icon po-sort-icon--idle" />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp   size={13} className="po-sort-icon po-sort-icon--active" />
    : <ChevronDown size={13} className="po-sort-icon po-sort-icon--active" />;
};

// ─── Columns Picker ───────────────────────────────────────────────────────────
const ColumnsPicker = ({ columns, onToggle, onClose }) => {
  useThemeVersion();
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div className="po-columns-picker" ref={ref}>
      <div className="po-columns-picker__header">
        <span>Show / Hide Columns</span>
        <button className="po-columns-picker__close" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="po-columns-picker__list">
        {columns.map((col) => (
          <button
            key={col.id}
            className={`po-columns-picker__item ${col.visible ? 'po-columns-picker__item--checked' : ''}`}
            onClick={() => !col.fixed && onToggle(col.id)}
            disabled={!!col.fixed}
            title={col.fixed ? `${col.label} column is always visible` : ''}
          >
            <span className="po-columns-picker__checkbox">
              {col.visible && <Check size={11} />}
            </span>
            {col.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Draggable TH ─────────────────────────────────────────────────────────────
const PO_COL_WIDTHS = {
  poNumber:      140,
  poRefId:       140,
  project:       200,
  vendor:        160,
  status:        110,
  paymentStatus: 130,
  totalValue:    130,
  orderDate:     120,
  actions:        90,
};

const DraggableTH = ({ col, index, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, sortConfig, onSort }) => {
  const isFixed = col.fixed || col.id === 'actions';
  return (
    <th
      draggable={!isFixed}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      style={PO_COL_WIDTHS[col.id] ? { minWidth: PO_COL_WIDTHS[col.id] } : undefined}
      className={[
        'po-th',
        isDragOver ? 'po-th--drag-over' : '',
        col.sortable ? 'po-th--sortable' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => col.sortable && onSort(col.id)}
    >
      <span className="po-th__inner">
        {!isFixed && (
          <span className="po-drag-handle" title="Drag to reorder">
            <GripVertical size={13} />
          </span>
        )}
        <span className="po-th__label">{col.label}</span>
        {col.sortable && <SortIcon columnId={col.id} sortConfig={sortConfig} />}
      </span>
    </th>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PurchaseOrders = () => {
  useThemeVersion();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions } = useAuth();
  const poPerms    = pagePermissions?.PURCHASE_ORDERS || [];
  // Pure DB-driven permissions — no role overrides
  const canView    = poPerms.includes('VIEW');
  const canCreate  = poPerms.includes('CREATE');
  const canEdit    = poPerms.includes('EDIT');
  const canDelete  = poPerms.includes('DELETE');
  const canApprove = poPerms.includes('APPROVE');
  const isViewOnly = canView && !canCreate && !canEdit && !canDelete && !canApprove;
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPOId, setEditingPOId] = useState(null);

  // ── Column state ──
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColumnsPicker, setShowColumnsPicker] = useState(false);

  // ── Sort state ──
  const [sortConfig, setSortConfig] = useState({ key: 'orderDate', direction: 'desc' });

  // ── Drag state ──
  const dragSrcIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const [filters, setFilters] = useState({ search: '', status: 'all', paymentStatus: 'all', documentType: 'all' });
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo,   setOrderDateTo]   = useState('');
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', type: 'confirm',
    onConfirm: null, onCancel: null, confirmText: 'Confirm', cancelText: 'Cancel'
  });
  const GST_OPTIONS = [0, 5, 12, 18, 28];

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryFormData, setDeliveryFormData] = useState(null);
  const [stats, setStats] = useState(null);

  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  // PO soft-copy file upload state
  const [poFileUpload, setPoFileUpload] = useState(null);
  const [poFileUploading, setPoFileUploading] = useState(false);
  const [showPOFileModal, setShowPOFileModal] = useState(false);
  const [poFileModalUrl, setPoFileModalUrl] = useState('');
  const poFileInputRef = useRef(null);
  const [vendors, setVendors] = useState([]);
  const [genPo, setGenPo] = useState(null);        // PO whose document modal is open
  const [genVendor, setGenVendor] = useState(null); // its vendor (for prefill)
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [quotations, setQuotations] = useState([]);

  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  const [orderBooks, setOrderBooks] = useState([]);          // list of order books for selected project
  const [selectedOrderBookId, setSelectedOrderBookId] = useState(''); // which orderbook is selected
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  // Once items are loaded (from order book OR manually), keep the form sections
  // visible even if the user removes all items — prevents collapsing back to step 1.
  const [itemsStepUnlocked, setItemsStepUnlocked] = useState(false);

  // ── Project BOM sourcing ──────────────────────────────────────────────────
  // Items no longer load the moment a project is picked; the user chooses a source
  // first. Without that, BOM items and order book items accumulate in the same table
  // and duplicate.
  const [itemSource, setItemSource]       = useState(null);   // 'quotation' | 'bom' | 'orderbook'
  const [showBomPicker, setShowBomPicker] = useState(false);
  // Populated from a 409 BOM_LIMIT_EXCEEDED; the PO modal stays open behind the dialog.
  const [bomViolations, setBomViolations] = useState(null);
  // Lines the BOM guard could only INFER a match for, held while the buyer confirms or
  // corrects them. { matches, bomLines, scopes, items } — items is the payload waiting
  // to be posted once the matches are confirmed.
  const [bomMatchReview, setBomMatchReview] = useState(null);
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [customVendorCategory, setCustomVendorCategory] = useState('');
  const [customVendorType,     setCustomVendorType]     = useState('');
  const [createPOFormData, setCreatePOFormData] = useState({
    quotationId: '', quotation: null, vendorId: null, vendorName: '', vendorContact: '',
    groupName: '', subGroupName: '', projectId: '',
    orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '',
    paymentTerms: '', shippingAddress: '', notes: '', poRefId: '', items: [], status: 'Draft',
    documentType: 'PURCHASE_ORDER'
  });
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: '', itemDescription: '', hsnCode: '', unit: 'Nos', quantity: '', unitPrice: '', gst: 18 });
  const [focusedPriceIndex, setFocusedPriceIndex] = useState(null);

  // ── Edit-mode project change state ──
  const [_pendingProjectChange, setPendingProjectChange] = useState(null); // { groupName, subGroupName, projectId }
  const [showProjectChangeWarning, setShowProjectChangeWarning] = useState(false);

  // ─── Column helpers ────────────────────────────────────────────────────────
  const visibleColumns = columns.filter((c) => c.visible);

  const toggleColumnVisibility = useCallback((colId) => {
    setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, visible: !c.visible } : c));
  }, []);

  // ─── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((colId) => {
    setSortConfig((prev) => ({
      key: colId,
      direction: prev.key === colId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(0);
  }, []);

  // ─── Drag-and-drop columns ─────────────────────────────────────────────────
  const handleDragStart = (e, index) => {
    dragSrcIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const srcIndex = dragSrcIndex.current;
    if (srcIndex === null || srcIndex === dropIndex) return;
    const visibleIds = visibleColumns.map((c) => c.id);
    const srcId = visibleIds[srcIndex];
    const dropId = visibleIds[dropIndex];
    setColumns((prev) => {
      const next = [...prev];
      const fromFull = next.findIndex((c) => c.id === srcId);
      const toFull   = next.findIndex((c) => c.id === dropId);
      const [moved] = next.splice(fromFull, 1);
      next.splice(toFull, 0, moved);
      return next;
    });
    setDragOverIndex(null);
    dragSrcIndex.current = null;
  };
  const handleDragEnd = () => { setDragOverIndex(null); dragSrcIndex.current = null; };

  // ─── Effects ───────────────────────────────────────────────────────────────
  // AbortController + Promise.all: fetches PO list and KPI stats simultaneously
  // with identical filter params. Cleanup aborts both in-flight requests when
  // any filter/page/sort dep changes, eliminating race conditions on rapid typing.
  // Clear stale data immediately when logged-in user changes
  useEffect(() => {
    setPurchaseOrders([]);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadAll = async () => {
      setLoading(true);
      try {
        const sortKeyMap = { poNumber: 'poNo', vendorName: 'vendorName', orderDate: 'orderDate', totalValue: 'totalValue', paymentStatus: 'paymentStatus', status: 'status' };

        // When date filter is active → force sort by orderDate ASC (requirement)
        const isDateFiltered = !!(orderDateFrom || orderDateTo);
        const activeSortKey = isDateFiltered ? 'orderDate' : (sortKeyMap[sortConfig.key] || 'orderDate');
        const activeSortDir = isDateFiltered ? 'ASC' : sortConfig.direction.toUpperCase();

        // PO list params
        const poParams = new URLSearchParams({
          page: currentPage, size: pageSize,
          sortBy: activeSortKey,
          sortDirection: activeSortDir
        });
        if (groupName)    poParams.append('groupName',    groupName);
        if (subGroupName) poParams.append('subGroupName', subGroupName);
        if (projectId)    poParams.append('projectId',    projectId);
        if (filters.status        !== 'all') poParams.append('status',        filters.status);
        if (filters.paymentStatus !== 'all') poParams.append('paymentStatus', filters.paymentStatus);
        if (filters.documentType  !== 'all') poParams.append('documentType',  filters.documentType);
        if (filters.search)                  poParams.append('searchTerm',    filters.search.trim());
        if (orderDateFrom)                   poParams.append('orderDateFrom', orderDateFrom);
        if (orderDateTo)                     poParams.append('orderDateTo',   orderDateTo);

        // Stats params — identical filters so KPI cards always match the table
        const statsParams = new URLSearchParams();
        if (groupName)    statsParams.append('groupName',    groupName);
        if (subGroupName) statsParams.append('subGroupName', subGroupName);
        if (projectId)    statsParams.append('projectId',    projectId);
        if (filters.status        !== 'all') statsParams.append('status',        filters.status);
        if (filters.paymentStatus !== 'all') statsParams.append('paymentStatus', filters.paymentStatus);
        if (filters.documentType  !== 'all') statsParams.append('documentType',  filters.documentType);
        if (filters.search)                  statsParams.append('searchTerm',    filters.search.trim());
        if (orderDateFrom)                   statsParams.append('orderDateFrom', orderDateFrom);
        if (orderDateTo)                     statsParams.append('orderDateTo',   orderDateTo);

        const [poRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/purchase-orders?${poParams}`,       { credentials: 'include', headers: getAuthHeaders(), signal }),
          fetch(`${API_BASE_URL}/purchase-orders/stats?${statsParams}`, { credentials: 'include', headers: getAuthHeaders(), signal })
        ]);

        if (!signal.aborted) {
          if (poRes.ok) {
            const data = await poRes.json();
            setPurchaseOrders(data.purchaseOrders || []);
            setProjectNames(data.projectNames || {});
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
          } else {
            showError('Failed to load purchase orders');
            setPurchaseOrders([]);
          }
          if (statsRes.ok) setStats(await statsRes.json());
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // cancelled by dep change — ignore
        showError('Failed to load purchase orders');
        setPurchaseOrders([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    loadAll();
    return () => controller.abort(); // cancel in-flight requests on re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.paymentStatus, filters.documentType, filters.search, sortConfig, orderDateFrom, orderDateTo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVendors(); }, []);

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole')
  });

  // ─── Confirmation Modal ────────────────────────────────────────────────────
  const showConfirmation = (config) => new Promise((resolve) => {
    setConfirmModal({
      show: true,
      title: config.title || 'Confirm Action',
      message: config.message,
      type: config.type || 'confirm',
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      onConfirm: () => { setConfirmModal(prev => ({ ...prev, show: false })); resolve(true); },
      onCancel:  () => { setConfirmModal(prev => ({ ...prev, show: false })); resolve(false); }
    });
  });

  const handlePageSizeChange = (e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); };

  // ─── Modal dropdown helpers ────────────────────────────────────────────────
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const r = await fetch(`${API_BASE_URL}/filters/groups`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setModalGroups(await r.json() || []);
    } catch { setModalGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchModalSubGroups = async (gName) => {
    if (!gName) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const r = await fetch(`${API_BASE_URL}/filters/subgroups?groupName=${encodeURIComponent(gName)}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setModalSubGroups(await r.json() || []);
    } catch { setModalSubGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchModalProjects = async (gName, sgName) => {
    if (!gName || !sgName) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const r = await fetch(`${API_BASE_URL}/filters/projects?groupName=${encodeURIComponent(gName)}&subGroupName=${encodeURIComponent(sgName)}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setModalProjects(await r.json() || []);
    } catch { setModalProjects([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const fetchFilteredQuotations = async (gName, sgName, pId) => {
    try {
      let url = `${API_BASE_URL}/quotations/approved?`;
      if (gName) url += `groupName=${encodeURIComponent(gName)}&`;
      if (sgName) url += `subGroupName=${encodeURIComponent(sgName)}&`;
      if (pId) url += `projectId=${encodeURIComponent(pId)}`;
      const r = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setQuotations(await r.json() || []);
    } catch { setQuotations([]); }
  };

  // Fetch all order books for a project (for the orderbook dropdown)
  // Accepts fresh groupN/subGroupN params directly to avoid React async-state lag.
  const fetchOrderBooks = async (pId, groupN, subGroupN) => {
    if (!pId) { setOrderBooks([]); return; }
    // Use passed-in values if available, otherwise fall back to current state
    const g  = groupN    !== undefined ? groupN    : modalGroupName;
    const sg = subGroupN !== undefined ? subGroupN : modalSubGroupName;
    try {
      const gName  = encodeURIComponent(g  || '');
      const sgName = encodeURIComponent(sg || '');
      const r = await fetch(
        `${API_BASE_URL}/order-book/getAll?page=0&size=200&groupName=${gName}&subGroupName=${sgName}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (!r.ok) throw new Error();
      const data = await r.json();
      const all = (data.data || data.content || []).filter(ob => !ob.deletedAt && (!ob.projectId || ob.projectId === pId));
      setOrderBooks(all);
    } catch (e) { console.error('fetchOrderBooks error', e); setOrderBooks([]); }
  };

  const fetchOrderBookItems = async (orderBookId) => {
    if (!orderBookId) { setOrderBookItems([]); return; }
    setLoadingOrderItems(true);
    try {
      const r = await fetch(`${API_BASE_URL}/order-book/${orderBookId}/items-with-tracking`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      // items-with-tracking returns { success, data: [...] } with allocatedQty per item
      setOrderBookItems(data.success ? (data.data || []) : (Array.isArray(data) ? data : []));
    } catch { showError('Failed to load order book items'); setOrderBookItems([]); }
    finally { setLoadingOrderItems(false); }
  };

  // ─── Modal change handlers ────────────────────────────────────────────────
  const handleModalGroupChange = (val) => {
    const v = val || '';
    if (isEditMode && createPOFormData.items.length > 0) {
      setModalGroupName(v);
      setModalSubGroupName('');
      setModalProjectId('');
      setModalSubGroups([]);
      setModalProjects([]);
      setQuotations([]);
      setOrderBooks([]);
      setSelectedOrderBookId('');
      setPendingProjectChange({ groupName: v, subGroupName: '', projectId: '' });
      setShowProjectChangeWarning(true);
      if (v) { fetchModalSubGroups(v); fetchFilteredQuotations(v, null, null); }
      return;
    }
    setModalGroupName(v); setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]); setQuotations([]); setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setCreatePOFormData(prev => ({ ...prev, groupName: v, subGroupName: '', projectId: '', items: [] }));
    if (v) { fetchModalSubGroups(v); fetchFilteredQuotations(v, null, null); }
    fetchVendors();
  };
  const handleModalSubGroupChange = (val) => {
    const v = val || '';
    if (isEditMode && createPOFormData.items.length > 0) {
      setModalSubGroupName(v);
      setModalProjectId('');
      setModalProjects([]);
      setQuotations([]);
      setOrderBooks([]);
      setSelectedOrderBookId('');
      setPendingProjectChange(prev => ({ ...(prev || { groupName: modalGroupName }), subGroupName: v, projectId: '' }));
      setShowProjectChangeWarning(true);
      if (modalGroupName && v) { fetchModalProjects(modalGroupName, v); }
      return;
    }
    setModalSubGroupName(v); setModalProjectId(''); setModalProjects([]); setQuotations([]); setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setCreatePOFormData(prev => ({ ...prev, subGroupName: v, projectId: '', items: [] }));
    if (modalGroupName && v) { fetchModalProjects(modalGroupName, v); fetchFilteredQuotations(modalGroupName, v, null); }
  };
  const handleModalProjectChange = async (val) => {
    const v = val || '';
    if (isEditMode && createPOFormData.items.length > 0) {
      setModalProjectId(v);
      setQuotations([]);
      setOrderBookItems([]);
      setOrderBooks([]);
      setSelectedOrderBookId('');
      setPendingProjectChange(prev => ({ ...(prev || { groupName: modalGroupName, subGroupName: modalSubGroupName }), projectId: v }));
      setShowProjectChangeWarning(true);
      if (v) {
        // Pass fresh values directly — state updates are async
        await fetchFilteredQuotations(modalGroupName, modalSubGroupName, v);
        await fetchOrderBooks(v, modalGroupName, modalSubGroupName);
      }
      return;
    }
    setModalProjectId(v); setQuotations([]); setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setCreatePOFormData(prev => ({ ...prev, projectId: v, quotationId: '', quotation: null, items: [] }));
    if (v) {
      // Pass fresh values directly — state updates are async
      await fetchFilteredQuotations(modalGroupName, modalSubGroupName, v);
      await fetchOrderBooks(v, modalGroupName, modalSubGroupName);
      fetchVendors(modalGroupName, modalSubGroupName, v);
    }
  };

  // ── Confirm project change in edit mode: keep items, just update project fields ──
  const handleConfirmProjectChange = async () => {
    // The modal dropdowns (modalGroupName, modalSubGroupName, modalProjectId) are already
    // updated live — we just need to sync them into createPOFormData WITHOUT clearing items.
    setCreatePOFormData(prev => ({
      ...prev,
      groupName: modalGroupName,
      subGroupName: modalSubGroupName,
      projectId: modalProjectId,
      // items intentionally preserved
    }));
    if (modalProjectId) {
      fetchVendors(modalGroupName, modalSubGroupName, modalProjectId);
    }
    setPendingProjectChange(null);
    setShowProjectChangeWarning(false);
    showSuccess('Project updated. All existing items have been kept.');
  };

  const handleCancelProjectChange = () => {
    // Revert the live dropdowns back to the values stored in createPOFormData (the original PO project)
    setModalGroupName(createPOFormData.groupName || '');
    setModalSubGroupName(createPOFormData.subGroupName || '');
    setModalProjectId(createPOFormData.projectId || '');
    // Re-load the subgroup/project lists for the original selection so dropdowns are correct
    if (createPOFormData.groupName) fetchModalSubGroups(createPOFormData.groupName);
    if (createPOFormData.groupName && createPOFormData.subGroupName) fetchModalProjects(createPOFormData.groupName, createPOFormData.subGroupName);
    setPendingProjectChange(null);
    setShowProjectChangeWarning(false);
  };

  const handleOrderBookSelect = async (e) => {
    const obId = e.target.value;
    setSelectedOrderBookId(obId);
    setOrderBookItems([]);
    setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: [] }));
    setItemsStepUnlocked(false);
    if (!obId) return;
    await fetchOrderBookItems(obId);
    // Auto-load items immediately — no button needed (mirrors quotation select behaviour)
    // We read fresh items from the fetch inside a setState callback to avoid stale closure
    setOrderBookItems(freshItems => {
      if (freshItems.length === 0) return freshItems;
      const mapped = freshItems.map((item, index) => {
        const totalQty     = parseFloat(item.quantity) || 0;
        const allocatedQty = parseFloat(item.allocatedQty) || 0;
        const remainingQty = Math.max(0, totalQty - allocatedQty);
        return {
          id: `orderbook-${index}`,
          orderBookItemId: item.id,
          itemName: item.itemName,
          itemDescription: item.specification || item.description || '',
          quotedQuantity: totalQty,
          allocatedQty,
          remainingQty,
          quantity: remainingQty,
          unitPrice: 0, gst: item.taxPercent || 18, lineTotal: 0,
          selected: remainingQty > 0,
        };
      });
      setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: mapped }));
      setItemsStepUnlocked(true);
      return freshItems;
    });
  };
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new'); setVendorDropdownOpen(false); setVendorSearch('');
    setCreatePOFormData(prev => ({ ...prev, vendorId: null, vendorName: '', vendorContact: '' }));
  };
  const handleNewVendorContactChange = (value) => {
    setCreatePOFormData(prev => ({ ...prev, vendorContact: value.replace(/\D/g, '').slice(0, 10) }));
  };
  const handleVendorSelection = (e) => {
    const vendorId = e.target.value ? parseInt(e.target.value) : null;
    const sel = vendors.find(v => v.id === vendorId);
    setCreatePOFormData(prev => ({ ...prev, vendorId, vendorName: sel?.name || '', vendorContact: sel?.contactNumber || sel?.phone || '' }));
  };

  const poItems = orderBookItems.map((item, index) => {
    const totalQty   = parseFloat(item.quantity) || 0;
    const allocatedQty = parseFloat(item.allocatedQty) || 0;
    const remainingQty = Math.max(0, totalQty - allocatedQty);
    return {
      id: `orderbook-${index}`,
      orderBookItemId: item.id,           // link back to order_book_items.id
      itemName: item.itemName,
      itemDescription: item.specification || item.description || '',
      quotedQuantity: totalQty,           // total from order book
      allocatedQty,                       // already assigned to other POs
      remainingQty,                       // available to assign
      quantity: remainingQty,             // default to remaining
      unit: item.unit || 'Nos',
      unitPrice: 0, gst: item.taxPercent || 18, lineTotal: 0, selected: remainingQty > 0
    };
  });

  const handleSkipQuotationLoadOrderBook = () => {
    if (orderBookItems.length === 0) { showWarning('No order book items available'); return; }
    setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: poItems }));
    setItemsStepUnlocked(true);
    showSuccess(`Loaded ${poItems.length} items from order book`);
  };
  const handleLoadOrderBookItems = () => {
    if (orderBookItems.length === 0) { showWarning('No order book items available'); return; }
    setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: poItems }));
    setItemsStepUnlocked(true);
    showSuccess(`Loaded ${poItems.length} items from order book for new vendor`);
  };

  const handleQuotationSelect = async (quotationId) => {
    if (!quotationId) {
      setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: [], vendorId: null, vendorName: '', vendorContact: '' }));
      setShowNewVendorForm(false); return;
    }
    setLoading(true);
    try {
      const [r, remRes] = await Promise.all([
        fetch(`${API_BASE_URL}/quotations/${quotationId}`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/purchase-orders/quotation/${quotationId}/remaining`, { credentials: 'include', headers: getAuthHeaders() }),
      ]);
      if (!r.ok) throw new Error();
      const qData = await r.json();
      // Remaining qty per line = quoted − already ordered across prior POs (by item name).
      const remByName = {};
      if (remRes.ok) { (await remRes.json()).forEach(x => { remByName[x.itemName] = Number(x.remainingQty); }); }
      const items = qData.items.map((item, i) => {
        const remaining = remByName[item.itemName] != null ? remByName[item.itemName] : Number(item.quantity);
        return {
          id: `quotation-${item.id}`, quotationItemId: item.id,
          itemName: item.itemName, itemDescription: item.description || '',
          unit: item.unit || 'Nos',
          quotedQuantity: Number(item.quantity), remainingQty: remaining, quantity: remaining,
          unitPrice: item.unitPrice, gst: item.taxPercent, lineTotal: 0, selected: remaining > 0
        };
      });
      items.forEach(item => {
        const base = item.quantity * item.unitPrice;
        item.lineTotal = base * (1 + item.gst / 100);
      });
      setCreatePOFormData(prev => ({
        ...prev, quotationId: qData.id, quotation: qData,
        poRefId: qData.rfqId || prev.poRefId || '',
        paymentTerms: qData.paymentTerms || '', notes: qData.notes || '', items,
        vendorId: qData.vendorId || null, vendorName: qData.vendorName || qData.vendorContact || '', vendorContact: qData.vendorContact || ''
      }));
      setItemsStepUnlocked(true);
      setShowNewVendorForm(false);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleToggleItemSelection = (index) => {
    const newItems = [...createPOFormData.items];
    newItems[index].selected = !newItems[index].selected;
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleRemoveItem = async (index) => {
    const confirmed = await showConfirmation({ title: 'Remove Item', message: 'Remove this item?', type: 'alert', confirmText: 'Yes, Remove', cancelText: 'Cancel' });
    if (!confirmed) return;
    setCreatePOFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    showSuccess('Item removed');
  };
  /** How many rows currently carry a project BOM link. */
  const bomLoadedCount = (createPOFormData.items || []).filter(i => i.bomLineId).length;

  /**
   * Switch item source. Mixing sources in one table is what produced duplicate rows,
   * so changing source once items exist asks first, then clears.
   */
  const handleSelectItemSource = async (key) => {
    if (key === itemSource) {
      if (key === 'bom') setShowBomPicker(true);
      return;
    }
    const hasItems = (createPOFormData.items || []).length > 0;
    if (hasItems) {
      const ok = await showConfirmation({
        title: 'Change item source?',
        message: 'The items already added will be cleared so the two sources cannot duplicate each other.',
        confirmText: 'Clear and switch',
        type: 'confirm',
      });
      if (!ok) return;
    }
    setCreatePOFormData(prev => ({ ...prev, items: [], quotationId: '', quotation: null }));
    setSelectedOrderBookId('');
    setOrderBookItems([]);
    setItemsStepUnlocked(false);
    setItemSource(key);
    if (key === 'bom') setShowBomPicker(true);
  };

  /**
   * Add picked BOM lines to the item table. Additive by design — the picker can be
   * reopened to add more without disturbing what is already there.
   */
  const handleAddBomItems = (rows) => {
    setCreatePOFormData(prev => {
      const existing = new Set((prev.items || []).map(i => String(i.bomLineId)));
      const fresh = rows
        .filter(r => !existing.has(String(r.bomLineId)))
        .map((r, idx) => ({
          id: `bom-${r.bomLineId}-${idx}`,
          bomLineId: r.bomLineId,
          bomItemId: r.bomItemId,
          variantId: r.variantId,
          itemName: r.itemName,
          itemDescription: r.specification || '',
          make: r.make || '',
          unit: r.unit || 'Nos',
          quantity: r.quantity,
          // The BOM rate is a budget figure, not a vendor price — the buyer still
          // enters what the vendor is charging.
          unitPrice: 0,
          gst: 18,
          lineTotal: 0,
          selected: true,
          bomQty: r.bomQty,
          remainingQty: r.remaining,
        }));
      return { ...prev, items: [...(prev.items || []), ...fresh] };
    });
    setItemsStepUnlocked(true);
  };

  const handleAddManualItem = () => {
    if (!newItem.itemName?.trim()) { showWarning('Item name is required'); return; }
    if (newItem.quantity <= 0) { showWarning('Quantity must be > 0'); return; }
    if (newItem.unitPrice <= 0) { showWarning('Unit price must be > 0'); return; }
    const base = newItem.quantity * newItem.unitPrice;
    const item = {
      id: `manual-${Date.now()}`, itemName: newItem.itemName,
      itemDescription: newItem.itemDescription, hsnCode: newItem.hsnCode, unit: newItem.unit || 'Nos', quantity: newItem.quantity,
      unitPrice: newItem.unitPrice, gst: newItem.gst,
      lineTotal: base * (1 + newItem.gst / 100), selected: true, isManual: true
    };
    setCreatePOFormData(prev => ({ ...prev, items: [...prev.items, item] }));
    setItemsStepUnlocked(true);
    setNewItem({ itemName: '', itemDescription: '', hsnCode: '', unit: 'Nos', quantity: '', unitPrice: '', gst: 18 });
    setShowManualItemForm(false);
    showSuccess('Manual item added');
  };
  const handleUpdatePOItemQuantity = (index, quantity) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    const qty = parseFloat(quantity) || 0;
    // Enforce max: for quotation items cap at the remaining qty (quoted − already ordered
    // across prior POs); for order-book items keep the existing quoted/remaining cap.
    const maxQty = item.quotationItemId != null
      ? item.remainingQty
      : (item.quotedQuantity || item.remainingQty);
    if (maxQty != null && qty > maxQty) {
      const reason = item.quotationItemId != null ? 'remaining under this quotation'
        : (item.remainingQty != null ? 'remaining from order book' : 'quoted quantity');
      showWarning(`Quantity cannot exceed ${maxQty} (${reason})`);
      return;
    }
    // Store raw string to preserve mid-typing decimal (e.g. "10.")
    item.quantity = quantity;
    const base = qty * (parseFloat(item.unitPrice) || 0);
    item.lineTotal = base * (1 + item.gst / 100);
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleUpdatePOItemPrice = (index, price) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    // Store raw string so mid-typing decimals (e.g. "11000.") are preserved in display
    item.unitPrice = price;
    const numericPrice = parseFloat(price) || 0;
    if (price !== '') {
      const qty = parseFloat(item.quantity) || 0;
      const base = qty * numericPrice;
      item.lineTotal = base * (1 + item.gst / 100);
    } else { item.lineTotal = 0; }
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleUpdatePOItemUnit = (index, unit) => {
    const newItems = [...createPOFormData.items];
    newItems[index] = { ...newItems[index], unit };
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleUpdatePOItemGST = (index, gst) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    item.gst = parseFloat(gst);
    if (item.quantity && item.unitPrice) {
      const base = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      item.lineTotal = base * (1 + parseFloat(gst) / 100);
    }
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const calculatePOTotal = () => createPOFormData.items.filter(i => i.selected).reduce((sum, i) => {
    const qty      = parseFloat(i.quantity)  || 0;
    const price    = parseFloat(i.unitPrice) || 0;
    const gst      = parseFloat(i.gst)       || 0;
    const base     = qty * price;
    return sum + base * (1 + gst / 100);
  }, 0);

  // ─── API calls ─────────────────────────────────────────────────────────────
  const fetchPurchaseOrders = async () => {
    setLoading(true);
    const sortKeyMap = { poNumber: 'poNo', vendorName: 'vendorName', orderDate: 'orderDate', totalValue: 'totalValue', paymentStatus: 'paymentStatus', status: 'status' };
    const isDateFiltered = !!(orderDateFrom || orderDateTo);
    const activeSortKey = isDateFiltered ? 'orderDate' : (sortKeyMap[sortConfig.key] || 'orderDate');
    const activeSortDir = isDateFiltered ? 'ASC' : sortConfig.direction.toUpperCase();
    try {
      const params = new URLSearchParams({
        page: currentPage, size: pageSize,
        sortBy: activeSortKey,
        sortDirection: activeSortDir
      });
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.paymentStatus !== 'all') params.append('paymentStatus', filters.paymentStatus);
      if (filters.documentType !== 'all') params.append('documentType', filters.documentType);
      if (filters.search) params.append('searchTerm', filters.search);
      if (orderDateFrom) params.append('orderDateFrom', orderDateFrom);
      if (orderDateTo)   params.append('orderDateTo',   orderDateTo);
      const r = await fetch(`${API_BASE_URL}/purchase-orders?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setPurchaseOrders(data.purchaseOrders || []);
      setProjectNames(data.projectNames || {});
      setTotalPages(data.totalPages || 0); setTotalElements(data.totalElements || 0);
    } catch { showError('Failed to load purchase orders'); setPurchaseOrders([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      const r = await fetch(`${API_BASE_URL}/purchase-orders/stats?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setStats(await r.json());
    } catch { console.error('Failed to fetch stats'); }
  };

  const fetchVendors = async () => {
    try {
      // Backend now returns vendors from accessible project POs UNION vendors
      // created/assigned to this user — so newly created vendors always appear.
      const url = `${API_BASE_URL}/vendors?page=0&size=1000&sortBy=name&sortDirection=ASC`;
      const r = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) { const data = await r.json(); setVendors(data.vendors || []); }
    } catch { setVendors([]); }
  };

  // Open the Generate-PO-document modal for a PO: fetch its full record (with items)
  // and its vendor (for prefill), then show the modal.
  const openGenerateDoc = async (poLike) => {
    try {
      let po = poLike;
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poLike.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) { const d = await r.json(); po = d.purchaseOrder || d.data || d || poLike; }
      let vendor = null;
      const vid = po.vendorId || poLike.vendorId;
      if (vid) {
        const vr = await fetch(`${API_BASE_URL}/vendors/${vid}`, { credentials: 'include', headers: getAuthHeaders() });
        if (vr.ok) { const vd = await vr.json(); vendor = vd.vendor || vd.data || vd || null; }
      }
      if (!vendor && vendors.length) vendor = vendors.find(v => v.id === vid) || vendors.find(v => v.name === po.vendorName) || null;
      setGenVendor(vendor);
      setGenPo(po);
    } catch {
      setGenVendor(null);
      setGenPo(poLike);
    }
  };

  const handleViewPO = async (po) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      setSelectedPO(await r.json()); setShowDetailDrawer(true);
    } catch { showError('Failed to load PO details'); }
    finally { setLoading(false); }
  };

  const handleEditPO = async (poId) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const poData = await r.json();
      setIsEditMode(true); setEditingPOId(poId);
      // Kick off the linked-quotation fetch NOW (concurrently) — PO items don't store the
      // quoted quantity, so we read it from the quotation. Running it alongside the other
      // prefetches keeps it off the critical path so the modal isn't slower to open.
      const quotationPromise = poData.quotationId
        ? fetch(`${API_BASE_URL}/quotations/${poData.quotationId}`, { credentials: 'include', headers: getAuthHeaders() })
            .then(res => (res.ok ? res.json() : null)).catch(() => null)
        : Promise.resolve(null);
      setModalGroupName(poData.groupName || ''); setModalSubGroupName(poData.subGroupName || ''); setModalProjectId(poData.projectId || '');
      await fetchModalGroups();
      if (poData.groupName) await fetchModalSubGroups(poData.groupName);
      if (poData.groupName && poData.subGroupName) await fetchModalProjects(poData.groupName, poData.subGroupName);
      // Pre-fetch quotations and order books for the existing project so Step 2 is
      // populated immediately when the edit modal opens — no need to re-select.
      if (poData.projectId) {
        await fetchFilteredQuotations(poData.groupName || '', poData.subGroupName || '', poData.projectId);
        await fetchOrderBooks(poData.projectId, poData.groupName || '', poData.subGroupName || '');
      }
      await fetchVendors();
      // Await the quotation started earlier (it ran concurrently with the prefetches above,
      // so this usually resolves instantly). Used only to fill the "Quoted Qty" column.
      const qd = await quotationPromise;
      const quotedByName = {};
      (qd?.items || []).forEach(qi => { const key = (qi.itemName || '').trim().toLowerCase(); if (key) quotedByName[key] = qi.quantity; });
      const items = (poData.items || []).map((item, i) => {
        const qty      = parseFloat(item.quantity)   || 0;
        const price    = parseFloat(item.unitPrice)  || 0;
        const gst      = parseFloat(item.taxPercent) || 0;
        const base     = qty * price;
        const lineTotal = base * (1 + gst / 100);
        return {
          id: item.id || `item-${i}`, itemName: item.itemName, itemDescription: item.description || '',
          hsnCode: item.hsnCode || '', unit: item.unit || 'Nos',
          quantity: qty, unitPrice: price || '', gst,
          lineTotal, selected: true,
          quotedQuantity: item.quotedQuantity || quotedByName[(item.itemName || '').trim().toLowerCase()] || null,
          // Carry the stored BOM link back out on save. A row whose link is dropped here
          // would be re-matched by name — or, if it predates BOM linking, would lose the
          // NULL bom_match that keeps it editable.
          bomLineId: item.bomLineId || null,
          bomItemId: item.bomItemId || null,
          variantId: item.variantId || null,
          make: item.make || ''
        };
      });
      setCreatePOFormData({
        quotationId: poData.quotationId || '', quotation: null,
        vendorId: poData.vendorId || null, vendorName: poData.vendorName || '', vendorContact: poData.vendorContact || '',
        groupName: poData.groupName || '', subGroupName: poData.subGroupName || '', projectId: poData.projectId || '',
        orderDate: poData.orderDate ? String(poData.orderDate).slice(0, 10) : new Date().toISOString().split('T')[0],
        expectedDelivery: poData.expectedDelivery ? String(poData.expectedDelivery).slice(0, 10) : '',
        paymentTerms: poData.paymentTerms || '', shippingAddress: poData.deliveryAddress || '',
        notes: poData.notes || '', poRefId: poData.poRefId || '', status: poData.status || 'Draft',
        documentType: poData.documentType || 'PURCHASE_ORDER', items
      });
      // Reflect where this PO's items came from so the selector isn't blank on edit.
      setItemSource(poData.quotationId ? 'quotation' : (items.some(i => i.bomLineId) ? 'bom' : 'orderbook'));
      setShowNewVendorForm(false); setShowCreatePOModal(true);
    } catch { showError('Failed to load purchase order details'); }
    finally { setLoading(false); }
  };

  const handleDeletePO = async (poId) => {
    const confirmed = await showConfirmation({ title: 'Delete Purchase Order', message: 'Delete this PO? This cannot be undone.', type: 'alert', confirmText: 'Yes, Delete', cancelText: 'Cancel' });
    if (!confirmed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, { method: 'DELETE', credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      showSuccess('Purchase order deleted successfully'); fetchPurchaseOrders(); fetchStats();
    } catch { showError('Failed to delete purchase order'); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (poId, newStatus) => {
    const confirmed = await showConfirmation({ title: 'Update Status', message: `Change status to "${newStatus}"?`, type: 'confirm', confirmText: 'Yes, Update', cancelText: 'Cancel' });
    if (!confirmed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}/status`, {
        credentials: 'include', method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus })
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Failed to update status'); }
      showSuccess(`PO status updated to ${newStatus}`); fetchPurchaseOrders(); fetchStats(); setShowDetailDrawer(false);
    } catch (err) { showError(err.message || 'Failed to update PO status'); }
    finally { setLoading(false); }
  };

  const handleOpenDeliveryModal = (po, item) => {
    setDeliveryFormData({ poId: po.id, itemId: item.id, itemName: item.itemName, orderedQty: item.quantity, deliveredQty: item.deliveredQty, pendingQty: item.pendingQty, newDeliveryQty: 0 });
    setShowDeliveryModal(true);
  };

  const handleMarkDelivered = async () => {
    if (!deliveryFormData || deliveryFormData.newDeliveryQty <= 0) { showWarning('Please enter a valid delivery quantity'); return; }
    if (deliveryFormData.newDeliveryQty > deliveryFormData.pendingQty) { showWarning('Delivery quantity cannot exceed pending quantity'); return; }
    const confirmed = await showConfirmation({ title: 'Confirm Delivery', message: `Record delivery of ${deliveryFormData.newDeliveryQty} units for ${deliveryFormData.itemName}?`, type: 'confirm', confirmText: 'Confirm Delivery', cancelText: 'Cancel' });
    if (!confirmed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${deliveryFormData.poId}/items/${deliveryFormData.itemId}/deliver`, {
        credentials: 'include', method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ deliveredQty: deliveryFormData.newDeliveryQty })
      });
      if (!r.ok) throw new Error();
      showSuccess('Delivery recorded successfully!'); setShowDeliveryModal(false);
      if (selectedPO) handleViewPO(selectedPO);
      fetchPurchaseOrders(); fetchStats();
    } catch { showError('Failed to record delivery'); }
    finally { setLoading(false); }
  };

  const handleOpenCreatePO = async () => {
    setIsEditMode(false); setEditingPOId(null);
    // Pre-seed project assignment from page-level header filters
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    const seedProject  = projectId   || '';
    setModalGroupName(seedGroup); setModalSubGroupName(seedSubGroup); setModalProjectId(seedProject);
    setCreatePOFormData({ quotationId: '', quotation: null, vendorId: null, vendorName: '', vendorContact: '', groupName: seedGroup, subGroupName: seedSubGroup, projectId: seedProject, orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '', paymentTerms: '', shippingAddress: '', notes: '', poRefId: '', items: [], status: 'Draft', documentType: 'PURCHASE_ORDER' });
    setOrderBooks([]); setSelectedOrderBookId(''); setOrderBookItems([]);
    setShowNewVendorForm(false); setShowManualItemForm(false); setQuotations([]);
    setCustomVendorCategory(''); setCustomVendorType('');
    setItemsStepUnlocked(false);
    setItemSource(null); setShowBomPicker(false); setBomViolations(null);
    // Fetch groups + vendors (always needed)
    await fetchModalGroups();
    fetchVendors();
    // Pre-fetch cascaded data using fresh seeded values directly — no async state lag.
    // Open the modal AFTER data is ready so dropdowns are populated immediately.
    if (seedGroup) {
      await fetchModalSubGroups(seedGroup);
      if (seedSubGroup) {
        await fetchModalProjects(seedGroup, seedSubGroup);
        if (seedProject) {
          // Pass fresh values directly so fetches don't read stale state
          await fetchFilteredQuotations(seedGroup, seedSubGroup, seedProject);
          await fetchOrderBooks(seedProject, seedGroup, seedSubGroup);
          fetchVendors(seedGroup, seedSubGroup, seedProject);
        }
      }
    }
    setShowCreatePOModal(true);
  };

  const handleCloseCreatePOModal = () => {
    setShowCreatePOModal(false); setIsEditMode(false); setEditingPOId(null);
    setModalGroupName(''); setModalSubGroupName(''); setModalProjectId('');
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);
    setQuotations([]); setOrderBookItems([]); setShowNewVendorForm(false); setShowManualItemForm(false);
    setCustomVendorCategory(''); setCustomVendorType('');
    setCreatePOFormData({ quotationId: '', quotation: null, vendorId: null, vendorName: '', vendorContact: '', groupName: '', subGroupName: '', projectId: '', orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '', paymentTerms: '', shippingAddress: '', notes: '', items: [], status: 'Draft', documentType: 'PURCHASE_ORDER' });
    setOrderBooks([]); setSelectedOrderBookId(''); setOrderBookItems([]);
    setItemsStepUnlocked(false);
    setPoFileUpload(null);
    if (poFileInputRef.current) poFileInputRef.current.value = '';
    setPendingProjectChange(null);
    setShowProjectChangeWarning(false);
    setItemSource(null); setShowBomPicker(false); setBomViolations(null);
  };

  // ─── PO File Upload Helpers ────────────────────────────────────────────────
  const handlePOFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const MAX = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX) { showWarning('File size must not exceed 10 MB'); e.target.value = ''; return; }
    const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
    if (!allowed.includes(file.type)) { showWarning('Only PDF, PNG, JPG files are allowed'); e.target.value = ''; return; }
    setPoFileUpload(file);
  };

  const handleUploadPOFile = async (poId) => {
    if (!poFileUpload) return;
    setPoFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', poFileUpload);
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}/upload-file`, {
        method: 'POST', credentials: 'include',
        headers: getAuthHeaders(),
        body: fd
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
      showSuccess('PO document uploaded successfully!');
      setPoFileUpload(null);
      if (poFileInputRef.current) poFileInputRef.current.value = '';
    } catch (err) { showError(err.message || 'Failed to upload PO file'); }
    finally { setPoFileUploading(false); }
  };

  const handleViewPOFile = async (po) => {
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/view-file`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found or could not be loaded'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setPoFileModalUrl(blobUrl);
      setShowPOFileModal(true);
    } catch { showError('Failed to load PO document'); }
  };

  const handleOpenPOFileInTab = async (po) => {
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/view-file`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch { showError('Failed to open PO document'); }
  };

  const handleDownloadPOFile = async (po) => {
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/download-file`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = po.poFileName || 'po-document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch { showError('Failed to download PO document'); }
  };

  const handleCreatePO = async () => {
    if (!modalGroupName) { showWarning('Please select a group'); return; }
    if (!createPOFormData.vendorId && !showNewVendorForm) { showWarning('Please select a vendor or add a new vendor'); return; }
    if (showNewVendorForm) {
      if (!createPOFormData.vendorName?.trim()) { showWarning('Vendor name is required'); return; }
      const resolvedCategory = createPOFormData.vendorCategory === 'Other' ? customVendorCategory?.trim() : createPOFormData.vendorCategory;
      const resolvedType     = createPOFormData.vendorType     === 'Other' ? customVendorType?.trim()     : createPOFormData.vendorType;
      if (!resolvedCategory) { showWarning('Vendor category is required'); return; }
      if (!resolvedType)     { showWarning('Vendor type is required'); return; }
    }
    const selectedItems = createPOFormData.items.filter(i => i.selected);
    if (selectedItems.length === 0) { showWarning('Please select at least one item'); return; }
    if (!selectedItems.every(i => i.quantity && parseFloat(i.quantity) > 0)) { showWarning('All selected items must have quantity > 0'); return; }
    if (selectedItems.some(i => !i.unitPrice || parseFloat(i.unitPrice) === 0)) { showWarning('Please enter unit price for all selected items'); return; }
    if (!createPOFormData.expectedDelivery) { showWarning('Expected delivery date is required'); return; }
    setLoading(true);
    try {
      // NOTE: bomLineId / bomItemId / variantId / make MUST be forwarded. This map is
      // an explicit allow-list, so a field omitted here is silently dropped — and
      // without the link every line would fall back to name matching, turning a
      // renamed item into a hard block on a PO that used to save.
      const poItems = selectedItems.map(({ itemName, itemDescription, hsnCode, unit, quantity, unitPrice, gst,
                                           bomLineId, bomItemId, variantId, make }) => ({
        itemName, itemDescription, hsnCode: hsnCode || null, unit: unit || 'Nos',
        quantity: parseFloat(quantity), unitPrice: parseFloat(unitPrice) || 0,
        gst: parseFloat(gst), discount: 0,
        bomLineId: bomLineId || null, bomItemId: bomItemId || null,
        variantId: variantId || null, make: make || null
      }));

      // ── Pre-save BOM check ────────────────────────────────────────────────
      // Runs before the write path so two things can be settled while the modal is
      // still open: violations that would be refused anyway, and lines the guard could
      // only tie to the BOM by INFERENCE. An inferred match that is wrong consumes the
      // wrong BOM line's budget — worse than no match at all — so it is confirmed here
      // rather than discovered later on the planned-vs-actual screen.
      const gate = await precheckBom(poItems);
      if (gate === 'STOP') { setLoading(false); return; }

      await postPO(poItems);
    } catch (error) { showError(error.message || `Failed to ${isEditMode ? 'update' : 'create'} purchase order`); }
    finally { setLoading(false); }
  };

  /**
   * Ask the backend what the project BOM makes of these lines, without writing.
   *
   * @returns 'STOP'     the save must not proceed (violations shown, or the buyer is
   *                     being asked to confirm inferred matches)
   *          'PROCEED'  nothing to settle
   */
  const precheckBom = async (poItems) => {
    if (!modalProjectId) return 'PROCEED';   // no project ⇒ nothing to enforce against
    try {
      const res = await fetch(
        `${API_BASE_URL}/projects/${encodeURIComponent(modalProjectId)}/bom/po-precheck`,
        {
          credentials: 'include', method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ items: poItems, excludePoId: isEditMode ? editingPOId : null })
        }
      );
      if (!res.ok) return 'PROCEED';          // never block a save on the advisory check
      const body = await res.json();
      const d = body?.data || {};
      if ((d.violations || []).length > 0) {
        setBomViolations({ violations: d.violations, projectId: modalProjectId });
        return 'STOP';
      }
      if ((d.fallbackMatches || []).length > 0) {
        setBomMatchReview({
          matches: d.fallbackMatches,
          bomLines: d.bomLines || [],
          scopes: d.scopes || [],
          items: poItems,
        });
        return 'STOP';
      }
      return 'PROCEED';
    } catch {
      // The check is advisory: the guard still runs inside the write path, so a network
      // hiccup here must not stop a legitimate purchase order.
      return 'PROCEED';
    }
  };

  /** The buyer confirmed (or corrected) the inferred matches — apply them and post. */
  const confirmBomMatches = async (chosen) => {
    const review = bomMatchReview;
    setBomMatchReview(null);
    if (!review) return;
    const byId = new Map((review.bomLines || []).map(l => [String(l.bomLineId), l]));
    // lineNo is 1-based and equals the item's position in the payload — the same
    // numbering the guard assigns, which is what makes the correction land on the
    // right line.
    const items = review.items.map((it, i) => {
      const picked = chosen[i + 1];
      if (!picked) return it;
      const l = byId.get(String(picked));
      return {
        ...it,
        bomLineId: picked,
        // Carry the catalogue snapshot of the line actually chosen, so the stored
        // link and the stored snapshot agree.
        bomItemId: l?.bomItemId ?? it.bomItemId ?? null,
        variantId: l?.variantId ?? it.variantId ?? null,
      };
    });
    setLoading(true);
    try {
      await postPO(items);
    } catch (error) { showError(error.message || `Failed to ${isEditMode ? 'update' : 'create'} purchase order`); }
    finally { setLoading(false); }
  };

  /**
   * Write the purchase order. Extracted so the BOM match confirmation can resume the
   * save with corrected links. Throws on failure — every caller already reports it.
   */
  const postPO = async (poItems) => {
      const poData = {
        quotationId: createPOFormData.quotationId || null,
        vendorId: createPOFormData.vendorId || null,
        vendorName: showNewVendorForm ? createPOFormData.vendorName : null,
        vendorContact: createPOFormData.vendorContact || null,
        vendorCategory: showNewVendorForm ? (createPOFormData.vendorCategory === 'Other' ? (customVendorCategory?.trim() || 'Other') : createPOFormData.vendorCategory) : null,
        vendorType: showNewVendorForm ? (createPOFormData.vendorType === 'Other' ? (customVendorType?.trim() || 'Other') : createPOFormData.vendorType) : null,
        rfqId: createPOFormData.quotation?.rfqId || null,
        groupName: modalGroupName, subGroupName: modalSubGroupName || null, projectId: modalProjectId || null,
        orderDate: createPOFormData.orderDate, expectedDelivery: createPOFormData.expectedDelivery,
        paymentTerms: createPOFormData.paymentTerms, shippingAddress: createPOFormData.shippingAddress,
        notes: createPOFormData.notes, poRefId: createPOFormData.poRefId || null, items: poItems, status: createPOFormData.status || 'Draft', paymentStatus: 'Pending',
        documentType: createPOFormData.documentType || 'PURCHASE_ORDER'
      };
      let response;
      if (isEditMode && editingPOId) {
        response = await fetch(`${API_BASE_URL}/purchase-orders/${editingPOId}`, {
          credentials: 'include', method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(poData)
        });
      } else {
        const endpoint = createPOFormData.quotationId ? `${API_BASE_URL}/purchase-orders/from-quotation` : `${API_BASE_URL}/purchase-orders`;
        response = await fetch(endpoint, {
          credentials: 'include', method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(poData)
        });
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // The project BOM refused this PO. Show every offending line with its numbers
        // and a route to amend the BOM; the modal stays open behind the dialog so
        // nothing the user entered is lost.
        if (response.status === 409 && err.error === 'BOM_LIMIT_EXCEEDED') {
          setBomViolations({ violations: err.violations || [], projectId: err.projectId || modalProjectId });
          setLoading(false);
          return;
        }
        throw new Error(err.message || 'Failed');
      }
      const result = await response.json();
      const savedId = result.id || result.data?.id;
      // Upload soft-copy file if one was selected
      if (poFileUpload && savedId) {
        await handleUploadPOFile(savedId);
      }
      showSuccess(`PO ${result.poRefId || result.data?.poRefId || result.poNo || result.data?.poNo} ${isEditMode ? 'updated' : 'created'} successfully!`);
      if (result.statusWarning) showWarning(result.statusWarning);
      handleCloseCreatePOModal(); fetchPurchaseOrders(); fetchStats();
      // Offer document generation right after creating a new PO.
      if (!isEditMode && savedId) {
        const v = vendors.find(x => x.id === createPOFormData.vendorId) || null;
        openGenerateDoc({ id: savedId, poNo: result.poNo || result.data?.poNo, vendorId: createPOFormData.vendorId, vendorName: createPOFormData.vendorName, vendorContact: createPOFormData.vendorContact, documentType: createPOFormData.documentType || 'PURCHASE_ORDER' });
        if (v) setGenVendor(v);
      }
  };

  const handleViewVendorPOs = async (vendorId) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/vendor/${vendorId}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      showSuccess(`Found ${data.length} purchase orders for this vendor`);
    } catch { showError('Failed to load vendor purchase orders'); }
    finally { setLoading(false); }
  };

  // ─── Formatters ────────────────────────────────────────────────────────────
  const formatCurrency = (amount) => !amount ? '₹0' : `₹${amount.toLocaleString('en-IN')}`;
  const formatQty = (val) => { const n = typeof val === 'number' ? val : parseFloat(val); if (isNaN(n)) return val ?? ''; return n % 1 === 0 ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 3 }); };
  const formatIndianInput = (val) => {
    const raw = String(val === '' || val == null ? '' : val).replace(/,/g, '');
    if (raw === '') return '';
    const hasDot = raw.includes('.');
    const afterDot = hasDot ? raw.split('.')[1] : '';
    const intPart = hasDot ? raw.split('.')[0] : raw;
    // Format only the integer part with Indian commas
    const intNum = parseInt(intPart, 10);
    const formattedInt = isNaN(intNum) ? intPart : (intNum === 0 ? (intPart === '' ? '' : '0') : intNum.toLocaleString('en-IN'));
    if (!hasDot) return formattedInt === '' ? '' : formattedInt;
    // Always preserve decimal portion exactly as typed (up to 2 digits)
    return formattedInt + '.' + afterDot.slice(0, 3);
  };
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const s = String(dateStr);
    if (s.length >= 10 && s[4] === '-') {
      const [y, m, d] = s.slice(0, 10).split('-');
      return `${d}-${m}-${y}`;
    }
    const dt = new Date(dateStr);
    const d  = String(dt.getDate()).padStart(2, '0');
    const m  = String(dt.getMonth() + 1).padStart(2, '0');
    return `${d}-${m}-${dt.getFullYear()}`;
  };
  const getStatusBadgeClass = (status) => ({ Draft: 'po-badge-draft', Approved: 'po-badge-approved', Ordered: 'po-badge-ordered', 'In-Transit': 'po-badge-transit', Delivered: 'po-badge-delivered', Cancelled: 'po-badge-cancelled' }[status] || '');
  const getPaymentBadgeClass = (status) => ({ Pending: 'po-payment-pending', 'Partially Paid': 'po-payment-partial', Paid: 'po-payment-paid' }[status] || '');
  const calculateDeliveryProgress = (po) => {
    if (!po.totalItemsOrdered || po.totalItemsOrdered === 0) return 0;
    return Math.round((po.totalItemsDelivered / po.totalItemsOrdered) * 100);
  };

  // ─── Render cell by column id ──────────────────────────────────────────────
  const renderCell = (col, po, rowIndex = 0) => {
    const progress = calculateDeliveryProgress(po);
    switch (col.id) {
      case 'sNo':
        return <td key={col.id} style={{ textAlign:'center', color:__stc('#64748b'), fontSize:13, fontWeight:500, width:50 }}>{currentPage * pageSize + rowIndex + 1}</td>;
      case 'poNumber':
        return <td key={col.id} className="purchase-orders-table-id">{po.poNo || '—'}</td>;
      case 'poRefId':
        return <td key={col.id}>{po.poRefId || '—'}</td>;
      case 'documentType': {
        const isWO = po.documentType === 'WORK_ORDER';
        return (
          <td key={col.id}>
            <span
              className="purchase-orders-badge"
              style={{
                background: isWO ? __stc('#fef3c7') : __stc('#e0f2fe'),
                color:      isWO ? __stc('#92400e') : __stc('#075985'),
              }}
            >
              {isWO ? 'Work Order' : 'Purchase Order'}
            </span>
          </td>
        );
      }
      case 'vendor':
        return (
          <td key={col.id}>
            <div style={{ fontWeight: 600, fontSize: 13, color: __stc('#1e293b') }}>{po.vendorName || '—'}</div>
            {po.vendorCode && <div style={{ fontSize: 11, color: __stc('#94a3b8'), marginTop: 1 }}>{po.vendorCode}</div>}
          </td>
        );
      case 'orderDate':
        return <td key={col.id}>{formatDate(po.orderDate)}</td>;
      case 'totalValue':
        return <td key={col.id} className="purchase-orders-table-value">{formatCurrency(po.totalValue)}</td>;
      case 'deliveryProgress':
        return (
          <td key={col.id}>
            <div className="delivery-progress">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              <span className="progress-text">{po.totalItemsDelivered}/{po.totalItemsOrdered} items ({progress}%)</span>
            </div>
          </td>
        );
      case 'paymentStatus':
        return <td key={col.id}><span className={`purchase-orders-badge ${getPaymentBadgeClass(po.paymentStatus)}`}>{po.paymentStatus}</span></td>;
      case 'status':
        return <td key={col.id}><span className={`purchase-orders-badge ${getStatusBadgeClass(po.status)}`}>{po.status}</span></td>;
      case 'actions':
        return (
          <td key={col.id}>
            <div className="purchase-orders-actions-cell">
              {/* View */}
              <button
                className={`purchase-orders-action-btn${!canView ? ' action-btn-disabled' : ''}`}
                onClick={() => canView && handleViewPO(po)}
                title={canView ? 'View Details' : '🔒 No view permission'}
                disabled={!canView}
              >
                <Eye size={14} />
              </button>

              {/* Generate / Re-generate PO document */}
              {(() => {
                const hasDoc = !!(po.poFileName || po.hasPoFile || po.poDocPayload);
                return (
                  <button
                    className={`purchase-orders-action-btn${!canEdit ? ' action-btn-disabled' : ''}`}
                    onClick={() => canEdit && openGenerateDoc(po)}
                    title={canEdit ? (hasDoc ? 'Re-generate PO PDF' : 'Generate PO PDF') : '🔒 No edit permission'}
                    style={{ color: canEdit ? __stc('#0F8A8A') : undefined }}
                    disabled={!canEdit}
                  >
                    {hasDoc ? <FileCog size={14} /> : <FileOutput size={14} />}
                  </button>
                );
              })()}

              {/* Download generated/uploaded PO document — only when one exists */}
              {(po.poFileName || po.hasPoFile) && (
                <button
                  className="purchase-orders-action-btn"
                  onClick={() => handleDownloadPOFile(po)}
                  title="Download PO document"
                  style={{ color: __stc('#2563eb') }}
                >
                  <Download size={14} />
                </button>
              )}

              {/* Edit */}
              <button
                className={`purchase-orders-action-btn${!canEdit ? ' action-btn-disabled' : ''}`}
                onClick={() => canEdit && handleEditPO(po.id)}
                title={canEdit ? 'Edit PO' : '🔒 No edit permission'}
                style={{ color: canEdit ? __stc('#3b82f6') : undefined }}
                disabled={!canEdit}
              >
                <Edit2 size={14} />
              </button>

              {/* Mark Delivered — only for active POs */}
              {po.status !== 'Delivered' && po.status !== 'Cancelled' && (
                <button
                  className={`purchase-orders-action-btn${!canEdit ? ' action-btn-disabled' : ''}`}
                  onClick={() => canEdit && handleUpdateStatus(po.id, 'Delivered')}
                  title={canEdit ? 'Mark Delivered' : '🔒 No edit permission'}
                  style={{ color: canEdit ? __stc('#10b981') : undefined }}
                  disabled={!canEdit}
                >
                  <CheckCircle size={14} />
                </button>
              )}

              {/* Delete — always shown, disabled if no permission */}
              <button
                className={`purchase-orders-action-btn${!canDelete ? ' action-btn-disabled' : ''}`}
                onClick={() => canDelete && handleDeletePO(po.id)}
                title={canDelete ? 'Delete PO' : '🔒 No delete permission'}
                style={{ color: canDelete ? __stc('#ef4444') : undefined }}
                disabled={!canDelete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        );
      case 'group':
        return <td key={col.id}>{po.groupName || '—'}</td>;
      case 'category':
        return <td key={col.id}>{po.vendorCategory || po.category || '—'}</td>;
      case 'project': {
        const pName = projectNames[po.projectId];
        return (
          <td key={col.id} style={{ minWidth: 200 }}>
            {po.projectId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: __stc('#1e293b'), wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>
                  {pName || po.projectId}
                </span>
                {pName && (
                  <span style={{ fontSize: 11, color: __stc('#64748b'), fontWeight: 400 }}>
                    {po.projectId}
                  </span>
                )}
              </div>
            ) : <span style={{ color: __stc('#94a3b8') }}>—</span>}
          </td>
        );
      }
      default:
        return <td key={col.id}>—</td>;
    }
  };

  // ─── Export all purchase orders to Excel ────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const exportParams = new URLSearchParams({ page: 0, size: 99999, sortBy: 'orderDate', sortDirection: 'DESC' });
      const activeGroup    = filters.groupName    || groupName    || null;
      const activeSubGroup = filters.subGroupName || subGroupName || null;
      const activeProject  = projectId || null;
      if (activeGroup)    exportParams.append('groupName',    activeGroup);
      if (activeSubGroup) exportParams.append('subGroupName', activeSubGroup);
      if (activeProject)  exportParams.append('projectId',    activeProject);
      if (filters.status        !== 'all') exportParams.append('status',        filters.status);
      if (filters.paymentStatus !== 'all') exportParams.append('paymentStatus', filters.paymentStatus);
      if (filters.search)                  exportParams.append('searchTerm',    filters.search.trim());
      if (orderDateFrom)                   exportParams.append('orderDateFrom', orderDateFrom);
      if (orderDateTo)                     exportParams.append('orderDateTo',   orderDateTo);

      const res = await fetch(`${API_BASE_URL}/purchase-orders?${exportParams}`, {
        headers: getAuthHeaders(), credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch PO data for export');
      const data = await res.json();
      const allPOs = data.purchaseOrders || [];
      const pNames = data.projectNames || {};
      if (allPOs.length === 0) { showWarning('No purchase orders found to export.'); return; }

      const EXPORT_COLS = [
        { key: 'poNo',            label: 'PO Number'              },
        { key: 'vendorName',      label: 'Vendor Name'            },
        { key: 'orderDate',       label: 'Order Date'             },
        { key: 'totalValue',      label: 'Total Value (₹)'        },
        { key: 'status',          label: 'Status'                 },
        { key: 'paymentStatus',   label: 'Payment Status'         },
        { key: 'groupName',       label: 'Group'                  },
        { key: 'subGroupName',    label: 'Sub Group'              },
        { key: 'projectName',     label: 'Project Name'           },
        { key: 'projectId',       label: 'Project ID'             },
        { key: 'rfqId',           label: 'RFQ ID'                 },
        { key: 'category',        label: 'Category'               },
        { key: 'deliveryDate',    label: 'Delivery Date'          },
        { key: 'paymentTerms',    label: 'Payment Terms'          },
        { key: 'notes',           label: 'Notes'                  },
      ];

      const totalCols = EXPORT_COLS.length;
      const now       = new Date();
      const dateStr   = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      const esc       = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

      const headerCells = EXPORT_COLS.map(({ label }) =>
        `<th style="background:#1e3a5f;color:#ffffff;font-weight:bold;font-size:11pt;padding:7px 10px;border:1px solid #334155;white-space:nowrap;text-align:left">${esc(label)}</th>`
      ).join('');

      const dataRowsHtml = allPOs.map((po, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const cells = EXPORT_COLS.map(({ key }) => {
          let val = po[key] ?? '';
          if (key === 'projectName') val = pNames[po.projectId] || '';
          if (key === 'projectId')   val = po.projectId || '';
          if ((key === 'orderDate' || key === 'deliveryDate') && val) {
            const s = String(val);
            if (s.length >= 10 && s[4] === '-') {
              const [y, m, d] = s.slice(0, 10).split('-').map(Number);
              val = new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            } else {
              val = new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            }
          }
          return `<td style="padding:5px 10px;border:1px solid #e2e8f0;background:${bg};font-size:10pt">${esc(val)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>Purchase Orders</x:Name>
  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif">
  <tr>
    <td style="font-weight:bold;font-size:14pt;padding:10px 12px;border:none;background:#ffffff;white-space:nowrap;vertical-align:middle">
      Purchase Orders
    </td>
    <td style="font-weight:bold;font-size:11pt;padding:10px 12px;border:none;background:#ffffff;white-space:nowrap;vertical-align:middle;color:#475569">
      Downloaded on: ${dateStr}
    </td>
    <td colspan="${totalCols - 2}" style="border:none;background:#ffffff"></td>
  </tr>
  <tr>${headerCells}</tr>
  ${dataRowsHtml}
</table>
</body></html>`;

      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=UTF-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `PurchaseOrders_${now.toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`${allPOs.length} purchase order${allPOs.length !== 1 ? 's' : ''} exported successfully`);
    } catch (err) {
      console.error('Export error:', err);
      showError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ─── KPI ───────────────────────────────────────────────────────────────────
  const kpiData = stats ? [
    { title: 'Total POs',   value: stats.totalPOs.toString(),        icon: <FileText size={32} />,    color: __stc('#2563eb') },
    { title: 'In Transit',  value: stats.inTransit.toString(),       icon: <Truck size={32} />,       color: __stc('#f59e0b') },
    { title: 'Delivered',   value: stats.delivered.toString(),       icon: <CheckCircle size={32} />, color: __stc('#22c55e') },
    { title: 'Total Value', value: formatCurrency(stats.totalValue), icon: <IndianRupee size={32} />, color: __stc('#8b5cf6') },
  ] : [];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="purchase-orders-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal
        show={confirmModal.show} title={confirmModal.title} message={confirmModal.message}
        type={confirmModal.type} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText}
        onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel}
      />

      {/* Header */}
      <div className="purchase-orders-header">
        <div className="purchase-orders-breadcrumb">Dashboard &gt; Procurement &gt; Purchase Orders</div>
        <div className="page-header-with-filter">
          <h1 className="purchase-orders-title">
            Purchase Orders <span className="purchase-orders-count">({totalElements})</span>
          </h1>
          <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="purchase-orders-action-bar">
        <div className="purchase-orders-search-filters">
          <input type="text" placeholder="Search by PO No, PO Ref ID, RFQ ID, Vendor Name..." className="purchase-orders-search" value={filters.search}
            onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value })); setCurrentPage(0); }} />
          <div className="po-filter-select-wrap">
            <FilterSelect
              value={filters.status === 'all' ? '' : filters.status}
              options={[
                { value: 'Draft',      label: 'Draft'      },
                { value: 'Approved',   label: 'Approved'   },
                { value: 'Ordered',    label: 'Ordered'    },
                { value: 'In-Transit', label: 'In Transit' },
                { value: 'Delivered',  label: 'Delivered'  },
                { value: 'Cancelled',  label: 'Cancelled'  },
              ]}
              placeholder="All Status"
              onChange={(v) => { setFilters(prev => ({ ...prev, status: v || 'all' })); setCurrentPage(0); }}
            />
          </div>
          <div className="po-filter-select-wrap">
            <FilterSelect
              value={filters.paymentStatus === 'all' ? '' : filters.paymentStatus}
              options={[
                { value: 'Pending',        label: 'Pending'        },
                { value: 'Partially Paid', label: 'Partially Paid' },
                { value: 'Paid',           label: 'Paid'           },
              ]}
              placeholder="All Payment Status"
              onChange={(v) => { setFilters(prev => ({ ...prev, paymentStatus: v || 'all' })); setCurrentPage(0); }}
            />
          </div>
          <div className="po-filter-select-wrap">
            <FilterSelect
              value={filters.documentType === 'all' ? '' : filters.documentType}
              options={[
                { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
                { value: 'WORK_ORDER',     label: 'Work Order'     },
              ]}
              placeholder="All Types"
              onChange={(v) => { setFilters(prev => ({ ...prev, documentType: v || 'all' })); setCurrentPage(0); }}
            />
          </div>
          {/* Order Date range filter — like Leads page */}
          <div className="po-order-date-filter">
            <span className="po-order-date-label">Order Date:</span>
            <PODateRangeFilter
              appliedFrom={orderDateFrom}
              appliedTo={orderDateTo}
              onApply={(f, t) => { setOrderDateFrom(f); setOrderDateTo(t); setCurrentPage(0); }}
              onClear={() => { setOrderDateFrom(''); setOrderDateTo(''); setCurrentPage(0); }}
            />
          </div>
        </div>

        <div className="purchase-orders-actions">
          {/* Columns Picker */}
          <div className="po-columns-picker-wrapper">
            <button
              className="purchase-orders-btn-secondary po-btn--columns"
              onClick={() => setShowColumnsPicker(v => !v)}
              title="Manage Columns"
            >
              <Columns size={16} />
              <span>Columns</span>
              <span className="po-columns-count-badge">{visibleColumns.length}/{columns.length}</span>
            </button>
            {showColumnsPicker && (
              <ColumnsPicker columns={columns} onToggle={toggleColumnVisibility} onClose={() => setShowColumnsPicker(false)} />
            )}
          </div>

          <button className={`purchase-orders-btn-primary${!canCreate ? ' action-btn-disabled' : ''}`} onClick={() => canCreate && handleOpenCreatePO()} disabled={!canCreate} title={!canCreate ? "🔒 No create permission" : "Create PO"}>
            <Plus size={16} /> Create PO
          </button>
          <button className="purchase-orders-btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {/* Permission notice for view-only users */}
      {isViewOnly && (
        <div className="po-permission-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          You have view-only access. Contact your administrator to request Create, Edit, Approve or Delete permissions.
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="purchase-orders-kpi-grid">
          {kpiData.map((kpi, i) => (
            <div key={i} className="purchase-orders-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="purchase-orders-kpi-icon">{kpi.icon}</div>
              <div className="purchase-orders-kpi-content">
                <div className="purchase-orders-kpi-value">{kpi.value}</div>
                <div className="purchase-orders-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="purchase-orders-table-container">
        <div className="purchase-orders-table-scroll">
          <table className="purchase-orders-table">
            <thead>
              <tr>
                {visibleColumns.map((col, visIdx) => (
                  <DraggableTH
                    key={col.id} col={col} index={visIdx}
                    onDragStart={handleDragStart} onDragOver={handleDragOver}
                    onDrop={handleDrop} onDragEnd={handleDragEnd}
                    isDragOver={dragOverIndex === visIdx}
                    sortConfig={sortConfig} onSort={handleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr><td colSpan={visibleColumns.length} className="empty-state">No purchase orders found</td></tr>
              ) : (
                purchaseOrders.map((po, rowIndex) => (
                  <tr key={po.id} className="purchase-orders-table-row">
                    {visibleColumns.map((col) => renderCell(col, po, rowIndex))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="table-footer">
          <div className="pagination-info">
            <span>Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} purchase orders</span>
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
                  onChange={(v) => { if (v) { setPageSize(Number(v)); setCurrentPage(0); } }}
                />
              </div>
          </div>
          <div className="pagination">
            <button className="page-btn" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>«</button>
            <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>Previous</button>
            {[...Array(Math.min(5, totalPages))].map((_, index) => {
              const pageNum = currentPage < 3 ? index : currentPage + index - 2;
              if (pageNum < 0 || pageNum >= totalPages) return null;
              return <button key={pageNum} className={`page-btn ${pageNum === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(pageNum)}>{pageNum + 1}</button>;
            })}
            <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>Next</button>
            <button className="page-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>»</button>
          </div>
        </div>
      </div>

      {/* ─── Detail Drawer ────────────────────────────────────────────────────── */}
      {showDetailDrawer && selectedPO && (
        <div className="purchase-orders-drawer-overlay">
          <div className="purchase-orders-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-drawer-header">
              <div>
                <h2>{selectedPO.poNo || selectedPO.poRefId}</h2>
                <p className="purchase-orders-drawer-subtitle">
                  {selectedPO.vendorName || (selectedPO.vendorId ? `Vendor #${selectedPO.vendorId}` : 'No vendor')}
                  {selectedPO.vendorContact ? ` · ${selectedPO.vendorContact}` : ''}
                </p>
              </div>
              <button className="purchase-orders-drawer-close" onClick={() => setShowDetailDrawer(false)}>✕</button>
            </div>
            <div className="purchase-orders-drawer-content">

              {/* ── Vendor Details ── */}
              <div className="purchase-orders-drawer-section">
                <h3>Vendor Details</h3>
                <div className="po-details-grid">
                  <div className="po-detail-item">
                    <span className="po-detail-label">Vendor Name:</span>
                    <span style={{fontWeight:600}}>
                      {selectedPO.vendorName || (selectedPO.vendorId ? `Vendor #${selectedPO.vendorId}` : '—')}
                    </span>
                  </div>
                  <div className="po-detail-item">
                    <span className="po-detail-label">Contact:</span>
                    <span>{selectedPO.vendorContact || '—'}</span>
                  </div>
                  {selectedPO.vendorId && (
                    <div className="po-detail-item">
                      <span className="po-detail-label">Vendor ID:</span>
                      <span>
                        <button className="vendor-link" style={{fontSize:12}} onClick={() => handleViewVendorPOs(selectedPO.vendorId)}>
                          #{selectedPO.vendorId} — View all POs
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── PO Details ── */}
              <div className="purchase-orders-drawer-section">
                <h3>Purchase Order Details</h3>
                <div className="po-details-grid">
                  <div className="po-detail-item"><span className="po-detail-label">PO Number:</span><span style={{fontWeight:600}}>{selectedPO.poNo || '—'}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Vendor RFQ Id:</span><span>{selectedPO.poRefId || '—'}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Status:</span><span className={`purchase-orders-badge ${getStatusBadgeClass(selectedPO.status)}`}>{selectedPO.status}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Payment Status:</span><span className={`purchase-orders-badge ${getPaymentBadgeClass(selectedPO.paymentStatus)}`}>{selectedPO.paymentStatus}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Order Date:</span><span>{formatDate(selectedPO.orderDate)}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Expected Delivery:</span><span>{formatDate(selectedPO.expectedDelivery) || '—'}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Total Value:</span><span className="po-value">{formatCurrency(selectedPO.totalValue)}</span></div>
                  {selectedPO.groupName && (
                    <div className="po-detail-item"><span className="po-detail-label">Group:</span><span>{selectedPO.groupName}{selectedPO.subGroupName ? ` / ${selectedPO.subGroupName}` : ''}</span></div>
                  )}
                  {selectedPO.projectId && (
                    <div className="po-detail-item"><span className="po-detail-label">Project:</span><span>{projectNames[selectedPO.projectId] ? `${projectNames[selectedPO.projectId]} (${selectedPO.projectId})` : selectedPO.projectId}</span></div>
                  )}
                  {selectedPO.quotationId && (
                    <div className="po-detail-item"><span className="po-detail-label">Quotation Ref:</span><span>#{selectedPO.quotationId}</span></div>
                  )}
                  {selectedPO.paymentTerms && (
                    <div className="po-detail-item"><span className="po-detail-label">Payment Terms:</span><span>{selectedPO.paymentTerms}</span></div>
                  )}
                  {selectedPO.deliveryAddress && (
                    <div className="po-detail-item" style={{gridColumn:'1/-1'}}>
                      <span className="po-detail-label">Delivery Address:</span>
                      <span>{selectedPO.deliveryAddress}</span>
                    </div>
                  )}
                  {selectedPO.notes && (
                    <div className="po-detail-item" style={{gridColumn:'1/-1'}}>
                      <span className="po-detail-label">Notes:</span>
                      <span style={{color:__stc('#6b7280')}}>{selectedPO.notes}</span>
                    </div>
                  )}
                </div>

                {/* PO Soft Copy Document */}
                {selectedPO.poFileName ? (
                  <div className="po-doc-section">
                    <div className="po-doc-header">
                      <File size={16} />
                      <span className="po-doc-title">PO Document</span>
                    </div>
                    <div className="po-doc-filename">
                      {selectedPO.poFileName}
                      {selectedPO.poFileSize && (
                        <span className="po-doc-size"> ({(selectedPO.poFileSize / 1024).toFixed(1)} KB)</span>
                      )}
                    </div>
                    <div className="po-doc-actions">
                      <button className="po-doc-btn po-doc-btn-view" onClick={() => handleViewPOFile(selectedPO)}>
                        <Eye size={14} /> View
                      </button>
                      <button className="po-doc-btn po-doc-btn-open" onClick={() => handleOpenPOFileInTab(selectedPO)}>
                        <ExternalLink size={14} /> Open in Tab
                      </button>
                      <button className="po-doc-btn po-doc-btn-download" onClick={() => handleDownloadPOFile(selectedPO)}>
                        <Download size={14} /> Download
                      </button>
                      {canEdit && (
                        <button className="po-doc-btn po-doc-btn-view" onClick={() => { setShowDetailDrawer(false); openGenerateDoc(selectedPO); }} title="Re-generate the PO PDF">
                          <FileCog size={14} /> Re-generate
                        </button>
                      )}
                    </div>
                    {/* Allow replacing the file directly from the drawer for any PO status */}
                    {canEdit && (
                      <div className="po-file-upload-row" style={{ marginTop: 10 }}>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          id="drawer-po-file-input"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) { showWarning('File size must not exceed 10 MB'); e.target.value = ''; return; }
                            const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
                            if (!allowed.includes(file.type)) { showWarning('Only PDF, PNG, JPG files are allowed'); e.target.value = ''; return; }
                            setPoFileUploading(true);
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const r = await fetch(`${API_BASE_URL}/purchase-orders/${selectedPO.id}/upload-file`, {
                                method: 'POST', credentials: 'include', headers: getAuthHeaders(), body: fd
                              });
                              if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
                              showSuccess('PO document replaced successfully!');
                              handleViewPO(selectedPO); // refresh drawer
                            } catch (err) { showError(err.message || 'Failed to upload PO file'); }
                            finally { setPoFileUploading(false); e.target.value = ''; }
                          }}
                        />
                        <label htmlFor="drawer-po-file-input" className="po-file-choose-btn" style={{ cursor: poFileUploading ? 'not-allowed' : 'pointer', opacity: poFileUploading ? 0.6 : 1 }}>
                          <Upload size={13} /> {poFileUploading ? 'Uploading…' : 'Replace File'}
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="po-doc-section po-doc-empty">
                    <File size={15} style={{ color: __stc('#9ca3af') }} />
                    <span style={{ color: __stc('#9ca3af'), fontSize: 13 }}>No PO document attached</span>
                    {/* Allow uploading directly from the drawer for any PO status */}
                    {canEdit && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          id="drawer-po-file-input-new"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) { showWarning('File size must not exceed 10 MB'); e.target.value = ''; return; }
                            const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
                            if (!allowed.includes(file.type)) { showWarning('Only PDF, PNG, JPG files are allowed'); e.target.value = ''; return; }
                            setPoFileUploading(true);
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const r = await fetch(`${API_BASE_URL}/purchase-orders/${selectedPO.id}/upload-file`, {
                                method: 'POST', credentials: 'include', headers: getAuthHeaders(), body: fd
                              });
                              if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
                              showSuccess('PO document uploaded successfully!');
                              handleViewPO(selectedPO); // refresh drawer
                            } catch (err) { showError(err.message || 'Failed to upload PO file'); }
                            finally { setPoFileUploading(false); e.target.value = ''; }
                          }}
                        />
                        <label htmlFor="drawer-po-file-input-new" className="po-file-choose-btn" style={{ cursor: poFileUploading ? 'not-allowed' : 'pointer', opacity: poFileUploading ? 0.6 : 1 }}>
                          <Upload size={13} /> {poFileUploading ? 'Uploading…' : 'Upload PO Document'}
                        </label>
                        <button className="po-doc-btn po-doc-btn-view" style={{ marginLeft: 8 }} onClick={() => { setShowDetailDrawer(false); openGenerateDoc(selectedPO); }} title="Generate the SESOLA PO PDF">
                          <FileOutput size={14} /> Generate PO PDF
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Delivery Summary ── */}
              {(selectedPO.totalItemsOrdered != null) && (
                <div className="purchase-orders-drawer-section">
                  <h3>Delivery Summary</h3>
                  <div className="po-details-grid">
                    <div className="po-detail-item"><span className="po-detail-label">Items Ordered:</span><span>{selectedPO.totalItemsOrdered ?? '—'}</span></div>
                    <div className="po-detail-item"><span className="po-detail-label">Items Delivered:</span><span style={{color:__stc('#059669'),fontWeight:600}}>{selectedPO.totalItemsDelivered ?? 0}</span></div>
                    <div className="po-detail-item"><span className="po-detail-label">Items Pending:</span><span style={{color: (selectedPO.totalItemsPending ?? 0) > 0 ? __stc('#dc2626') : __stc('#059669'), fontWeight:600}}>{selectedPO.totalItemsPending ?? 0}</span></div>
                  </div>
                </div>
              )}

              {/* ── Order Items ── */}
              <div className="purchase-orders-drawer-section">
                <h3>Order Items</h3>
                <table className="po-items-table">
                  <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '23%' }} />
                  </colgroup>
                  <thead>
                    <tr><th>Item Name</th><th>Qty Ordered</th><th>Delivered</th><th>Pending</th><th>Unit Price</th><th>GST%</th><th>Line Total</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {selectedPO.items && selectedPO.items.length > 0 ? selectedPO.items.map((item) => {
                      const qty      = parseFloat(item.quantity)   || 0;
                      const price    = parseFloat(item.unitPrice)  || 0;
                      const gst      = parseFloat(item.taxPercent) || 0;
                      const base     = qty * price;
                      const computedLineTotal = base * (1 + gst / 100);
                      return (
                      <tr key={item.id}>
                        <td>
                          <div style={{fontWeight:500}}>{item.itemName}</div>
                          {item.description && <div style={{fontSize:11,color:__stc('#6b7280'),marginTop:2}}>{item.description}</div>}
                        </td>
                        <td>{formatQty(item.quantity)}</td>
                        <td className="delivered-qty">{formatQty(item.deliveredQty ?? 0)}</td>
                        <td className="pending-qty" style={{color: (item.pendingQty ?? 0) > 0 ? __stc('#dc2626') : __stc('#374151')}}>
                          {formatQty(item.pendingQty ?? 0)}
                        </td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{item.taxPercent != null ? `${item.taxPercent}%` : '—'}</td>
                        <td>{formatCurrency(computedLineTotal)}</td>
                        <td>{(item.pendingQty ?? 0) > 0 && selectedPO.status !== 'Cancelled' && (
                          <button className="purchase-orders-btn-small" onClick={() => handleOpenDeliveryModal(selectedPO, item)}>Mark Delivered</button>
                        )}</td>
                      </tr>
                      );
                    }) : (
                      <tr><td colSpan={8} style={{textAlign:'center',padding:'1rem',color:__stc('#9ca3af')}}>No items found</td></tr>
                    )}
                  </tbody>
                  {selectedPO.items && selectedPO.items.length > 0 && (
                    <tfoot>
                      <tr style={{borderTop:`2px solid ${__sbg('#e5e7eb')}`,fontWeight:600}}>
                        <td colSpan={6} style={{textAlign:'right',padding:'8px 10px'}}>Grand Total:</td>
                        <td style={{padding:'8px 10px', whiteSpace:'nowrap', overflow:'visible', fontWeight:'700', color:__stc('#059669')}}>
                          {formatCurrency(
                            (selectedPO.items || []).reduce((sum, item) => {
                              const qty      = parseFloat(item.quantity)   || 0;
                              const price    = parseFloat(item.unitPrice)  || 0;
                              const gst      = parseFloat(item.taxPercent) || 0;
                              const base     = qty * price;
                              return sum + base * (1 + gst / 100);
                            }, 0)
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="purchase-orders-drawer-actions">
                {selectedPO.status !== 'Delivered' && selectedPO.status !== 'Cancelled' && (
                  <>
                    <button className="purchase-orders-btn-primary" onClick={() => handleUpdateStatus(selectedPO.id, 'In-Transit')}>Mark In Transit</button>
                    <button className="purchase-orders-btn-primary" onClick={() => handleUpdateStatus(selectedPO.id, 'Delivered')}>Mark All Delivered</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PO File Preview Modal ─────────────────────────────────────────────── */}
      {showPOFileModal && (
        <div className="po-file-preview-overlay">
          <div className="po-file-preview-container" onClick={(e) => e.stopPropagation()}>
            <div className="po-file-preview-header">
              <span className="po-file-preview-title"><File size={16} /> PO Document Preview</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="po-doc-btn po-doc-btn-open" onClick={() => window.open(poFileModalUrl, '_blank')}>
                  <ExternalLink size={13} /> Open in Tab
                </button>
                <button className="po-doc-btn po-doc-btn-download" onClick={() => {
                  const a = document.createElement('a');
                  a.href = poFileModalUrl;
                  a.download = selectedPO?.poFileName || 'po-document';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}>
                  <Download size={13} /> Download
                </button>
                <button className="purchase-orders-modal-close" style={{ marginLeft: 4 }} onClick={() => {
                  window.URL.revokeObjectURL(poFileModalUrl);
                  setPoFileModalUrl('');
                  setShowPOFileModal(false);
                }}>✕</button>
              </div>
            </div>
            <iframe
              src={poFileModalUrl}
              title="PO Document"
              className="po-file-preview-iframe"
              style={{ width: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* ─── Delivery Modal ───────────────────────────────────────────────────── */}
      {showDeliveryModal && deliveryFormData && (
        <div className="purchase-orders-modal-overlay">
          <div className="purchase-orders-delivery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-modal-header">
              <h2>Mark Item Delivered</h2>
              <button className="purchase-orders-modal-close" onClick={() => setShowDeliveryModal(false)}>✕</button>
            </div>
            <div className="purchase-orders-modal-content">
              <div className="delivery-item-info">
                <h3>{deliveryFormData.itemName}</h3>
                <div className="delivery-stats">
                  <div className="delivery-stat"><span className="delivery-stat-label">Ordered:</span><span className="delivery-stat-value">{deliveryFormData.orderedQty}</span></div>
                  <div className="delivery-stat"><span className="delivery-stat-label">Already Delivered:</span><span className="delivery-stat-value">{deliveryFormData.deliveredQty}</span></div>
                  <div className="delivery-stat"><span className="delivery-stat-label">Pending:</span><span className="delivery-stat-value pending">{deliveryFormData.pendingQty}</span></div>
                </div>
              </div>
              <div className="delivery-form-group">
                <label>Quantity Delivered Now *</label>
                <input type="number" min="0" max={deliveryFormData.pendingQty} value={deliveryFormData.newDeliveryQty}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, newDeliveryQty: parseFloat(e.target.value) || 0 }))}
                  placeholder="Enter quantity delivered" />
                <small>Maximum: {deliveryFormData.pendingQty} units</small>
              </div>
            </div>
            <div className="purchase-orders-modal-actions">
              <button className="purchase-orders-btn-primary" onClick={handleMarkDelivered} disabled={deliveryFormData.newDeliveryQty <= 0}>Confirm Delivery</button>
              <button className="purchase-orders-btn-secondary" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create / Edit PO Modal (unchanged logic) ─────────────────────────── */}
      {showCreatePOModal && (
        <div className="purchase-orders-modal-overlay">
          <div className="purchase-orders-create-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="purchase-orders-modal-header" style={{ flexShrink: 0 }}>
              <h2>{(() => {
                const label = createPOFormData.documentType === 'WORK_ORDER' ? 'Work Order' : 'Purchase Order';
                return isEditMode ? `Edit ${label}` : `Create ${label}`;
              })()}</h2>
              <button className="purchase-orders-modal-close" onClick={handleCloseCreatePOModal}><X size={24} /></button>
            </div>

            <div className="purchase-orders-modal-content" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Document Type: Purchase Order vs Work Order — same form & template, only the title differs */}
              <div className="po-form-section" style={{ background: __sbg('#f8fafc'), padding: '16px 20px', borderRadius: '8px', border: `2px solid ${__sbg('#e2e8f0')}`, marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600 }}>Document Type *</label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {[
                    { value: 'PURCHASE_ORDER', label: 'Purchase Order', hint: 'Goods / materials' },
                    { value: 'WORK_ORDER',     label: 'Work Order',     hint: 'Services, maintenance, I&C' },
                  ].map(opt => {
                    const active = (createPOFormData.documentType || 'PURCHASE_ORDER') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isEditMode}
                        onClick={() => setCreatePOFormData(prev => ({ ...prev, documentType: opt.value }))}
                        style={{
                          flex: '1 1 200px', textAlign: 'left', cursor: isEditMode ? 'not-allowed' : 'pointer',
                          padding: '12px 16px', borderRadius: '8px',
                          border: `2px solid ${active ? __stc('#0F8A8A') : __sbg('#e2e8f0')}`,
                          background: active ? __stc('#e6f7f7') : __sbg('#ffffff'),
                          opacity: isEditMode && !active ? 0.5 : 1,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14, color: active ? __stc('#0F8A8A') : __stc('#1e293b') }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: __stc('#64748b'), marginTop: 2 }}>{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
                {isEditMode && (
                  <p style={{ fontSize: 12, color: __stc('#94a3b8'), marginTop: 8 }}>Document type can't be changed after creation.</p>
                )}
              </div>

              {/* Step 1: Project Selection */}
              <div className="po-form-section" style={{ background: __sbg('#f8fafc'), padding: '20px', borderRadius: '8px', border: `2px solid ${__sbg('#e2e8f0')}` }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>📂</span> Step 1: Select Project</h3>
                <p style={{ fontSize: '13px', color: __stc('#64748b'), marginBottom: '16px' }}>
                  {isEditMode
                    ? 'Change the project assignment for this PO. Existing items will be preserved.'
                    : 'Choose a project to load approved quotations or order book items'}
                </p>
                <div className="po-form-row">
                  <div className="po-form-group">
                    <label>Group *</label>
                    <FilterSelect
                      value={modalGroupName}
                      options={modalGroups}
                      placeholder={modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}
                      disabled={modalDropdownLoading.groups}
                      onChange={handleModalGroupChange}
                    />
                  </div>
                  <div className="po-form-group">
                    <label>Sub Group</label>
                    <FilterSelect
                      value={modalSubGroupName}
                      options={modalSubGroups}
                      placeholder={!modalGroupName ? 'Select Group First' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Sub Group'}
                      disabled={!modalGroupName || modalDropdownLoading.subGroups}
                      onChange={handleModalSubGroupChange}
                    />
                  </div>
                  <div className="po-form-group">
                    <label>Project *</label>
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
                {loadingOrderItems && <div style={{ marginTop: '12px', padding: '10px', background: __sbg('#dbeafe'), borderRadius: '6px', fontSize: '13px', color: __stc('#1e40af') }}>🔄 Loading quotations and order books...</div>}
              </div>

              {/* ─── Edit-mode Project Change Warning Banner ──────────────────── */}
              {showProjectChangeWarning && isEditMode && (
                <div style={{ padding: '18px 20px', background: __sbg('#fffbeb'), border: `2px solid ${__sbg('#f59e0b')}`, borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: __stc('#92400e'), marginBottom: '6px' }}>
                      Change Project for This Purchase Order?
                    </div>
                    <div style={{ fontSize: '13px', color: __stc('#78350f'), marginBottom: '14px' }}>
                      You are changing the project while there are <strong>{createPOFormData.items.length} item(s)</strong> in this PO.
                      Click <em>"Keep Items &amp; Change Project"</em> to update only the project assignment without touching the items.
                      Or click <em>"Cancel"</em> to revert.
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleConfirmProjectChange}
                        style={{ padding: '9px 18px', background: __sbg('#d97706'), color: __stc('white'), border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                      >
                        ✅ Keep Items &amp; Change Project
                      </button>
                      <button
                        onClick={handleCancelProjectChange}
                        style={{ padding: '9px 18px', background: __sbg('white'), color: __stc('#92400e'), border: `1.5px solid ${__sbg('#f59e0b')}`, borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Quotation / Order Book */}
              {modalProjectId && (
                <div className="po-form-section">
                  {/* ── Item source ────────────────────────────────────────────
                      All three sources are always offered, in order of prominence:
                      Quotation first when approved quotations exist, then the project
                      BOM, then the order book for older projects. A source with
                      nothing to offer is disabled and says why, rather than the panel
                      disappearing — the layout no longer changes shape underneath the
                      user depending on what happens to exist. */}
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span>📥</span> Where should the items come from?
                  </h3>
                  <div className="po-source-grid">
                    {ITEM_SOURCES.map(src => {
                      const disabledReason =
                        src.key === 'quotation' && quotations.length === 0
                          ? 'No approved quotations for this project'
                          : src.key === 'orderbook' && orderBooks.length === 0
                            ? 'No order books for this project'
                            : null;
                      const active = itemSource === src.key;
                      return (
                        <button
                          type="button"
                          key={src.key}
                          className={`po-source-card${active ? ' po-source-card--active' : ''}`}
                          disabled={!!disabledReason}
                          onClick={() => handleSelectItemSource(src.key)}
                        >
                          <span className="po-source-card__title">{src.icon} {src.label}</span>
                          <span className="po-source-card__hint">
                            {disabledReason || src.hint(quotations.length)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Quotation ─────────────────────────────────────────── */}
                  {itemSource === 'quotation' && (
                    <div className="po-source-panel">
                      {!createPOFormData.quotationId ? (
                        <div className="po-form-group po-form-group--dropdown-up">
                          <FilterSelect
                            value={createPOFormData.quotationId}
                            options={quotations.map(q => ({ value: q.id, label: `${q.quoteNo} — ${q.vendorName || q.vendorContact || 'Unknown Vendor'}${q.totalValue ? ` — ${formatCurrency(q.totalValue)}` : ''} [${q.status}]` }))}
                            placeholder="Select Quotation"
                            onChange={(v) => handleQuotationSelect(v)}
                          />
                        </div>
                      ) : (
                        <div className="po-source-loaded">
                          <span>✓ {createPOFormData.quotation?.quoteNo}</span>
                          <button type="button" className="po-source-clear" onClick={() => handleQuotationSelect('')}>Clear</button>
                        </div>
                      )}
                      {createPOFormData.quotation && (
                        <div style={{ padding: '16px', backgroundColor: __sbg('#f0fdf4'), borderRadius: '8px', border: `2px solid ${__sbg('#86efac')}`, marginTop: '16px' }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600', color: __stc('#166534') }}>Selected Quotation Details</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                            <div><strong>Vendor:</strong> {createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || 'N/A'}</div>
                            <div><strong>Category:</strong> {createPOFormData.quotation.category}</div>
                            <div><strong>Valid Until:</strong> {formatDate(createPOFormData.quotation.validTill)}</div>
                            <div><strong>Total:</strong> {formatCurrency(createPOFormData.quotation.totalValue)}</div>
                          </div>
                          <div style={{ marginTop: '12px', fontSize: '12.5px', color: __stc('#92400e') }}>
                            💡 Quantities are still checked against the project BOM when the PO is saved — a vendor
                            rounding up to a supply lot will be flagged.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Project BOM ───────────────────────────────────────── */}
                  {itemSource === 'bom' && (
                    <div className="po-source-panel">
                      <div className="po-source-loaded">
                        <span>
                          {bomLoadedCount > 0
                            ? `✓ ${bomLoadedCount} line${bomLoadedCount === 1 ? '' : 's'} loaded from the project BOM`
                            : 'Pick the BOM lines you need. Quantities default to what is still un-ordered.'}
                        </span>
                        <button type="button" className="po-source-pick" onClick={() => setShowBomPicker(true)}>
                          {bomLoadedCount > 0 ? 'Add more lines' : 'Choose BOM items'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Order Book ────────────────────────────────────────── */}
                  {itemSource === 'orderbook' && (
                    <div className="po-source-panel">
                      {createPOFormData.items.length > 0 && !createPOFormData.quotationId ? (
                        <div className="po-source-loaded">
                          <span>✓ {createPOFormData.items.length} items loaded from order book</span>
                          <button type="button" className="po-source-clear" onClick={() => { setCreatePOFormData(prev => ({ ...prev, items: [] })); setSelectedOrderBookId(''); setOrderBookItems([]); setItemsStepUnlocked(false); }}>Clear</button>
                        </div>
                      ) : (
                        <div className="po-ob-dropdown-wrap">
                          <div className="po-ob-filterselect-wrap">
                            <FilterSelect
                              value={selectedOrderBookId}
                              options={orderBooks.map(ob => ({ value: ob.id, label: `${ob.poNumber || ob.orderBookNo} — ${ob.orderTitle || 'No Title'}` }))}
                              placeholder="— Select an Order Book —"
                              onChange={async (v) => { await handleOrderBookSelect({ target: { value: v } }); }}
                            />
                            {selectedOrderBookId && (
                              <button type="button" className="po-ob-clear-btn po-ob-clear-btn--fs" onClick={() => { setSelectedOrderBookId(''); setOrderBookItems([]); }} title="Clear selection">✕</button>
                            )}
                          </div>
                          {loadingOrderItems && (
                            <div style={{ fontSize: '12px', color: __stc('#1e40af'), marginTop: '6px', display: 'flex', alignItems: 'center', gap: 4 }}><span>🔄</span> Loading items…</div>
                          )}
                          {selectedOrderBookId && !loadingOrderItems && orderBookItems.length === 0 && (
                            <div style={{ fontSize: '12px', color: __stc('#64748b'), marginTop: '6px' }}>No items found in this order book.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Vendor */}
              {(isEditMode || createPOFormData.quotationId || itemsStepUnlocked || itemSource === 'bom') && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><span>🏢</span> Vendor Information</h3>
                  {createPOFormData.quotation ? (
                    <>
                      <div style={{ padding: '16px', background: __sbg('#f0f9ff'), border: `2px solid ${__sbg('#bae6fd')}`, borderRadius: '8px', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: __stc('#0c4a6e'), marginBottom: '8px' }}>📋 Vendor from Quotation</h4>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: __stc('#0c4a6e') }}>{createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || `Vendor #${createPOFormData.quotation.vendorId}`}</div>
                        {createPOFormData.quotation.vendorContact && <div style={{ fontSize: '13px', color: __stc('#0369a1'), marginTop: '4px' }}>Contact: {createPOFormData.quotation.vendorContact}</div>}
                      </div>
                      <div style={{ padding: '12px', background: __sbg('#fef3c7'), border: `1px solid ${__sbg('#fbbf24')}`, borderRadius: '6px', fontSize: '13px', color: __stc('#92400e') }}>💡 To use a different vendor, clear the quotation and load order book items instead.</div>
                    </>
                  ) : (
                    <>
                      {!isEditMode && (
                        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px', background: __sbg('#f8fafc'), borderRadius: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input type="radio" name="vendorType" checked={!showNewVendorForm} onChange={() => handleVendorTypeChange('existing')} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
                            <span>Existing Vendor</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input type="radio" name="vendorType" checked={showNewVendorForm} onChange={() => handleVendorTypeChange('new')} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
                            <span>New Vendor</span>
                          </label>
                        </div>
                      )}
                      {!showNewVendorForm && (
                        <div className="po-form-group" style={{ position: 'relative' }}>
                          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>Select Vendor *</label>
                          {/* Custom searchable vendor dropdown */}
                          <div style={{ position: 'relative' }}>
                            <div
                              onClick={() => { setVendorDropdownOpen(o => !o); setVendorSearch(''); }}
                              style={{ width: '100%', padding: '10px 36px 10px 12px', fontSize: '14px', border: `1px solid ${vendorDropdownOpen ? __sbg('#3b82f6') : __sbg('#d1d5db')}`, borderRadius: '6px', background: __sbg('white'), cursor: 'pointer', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', minHeight: '42px' }}
                            >
                              <span style={{ color: createPOFormData.vendorId ? __stc('#111827') : __stc('#9ca3af'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {createPOFormData.vendorId
                                  ? (() => { const sel = vendors.find(v => v.id === parseInt(createPOFormData.vendorId)); return sel ? `${sel.name}${sel.contactNumber ? ' • ' + sel.contactNumber : ''}` : 'Select Vendor'; })()
                                  : '-- Select Vendor --'}
                              </span>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0, color: __stc('#6b7280'), transform: vendorDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            {vendorDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: __sbg('white'), border: `1.5px solid ${__sbg('#3b82f6')}`, borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 9999, marginTop: '4px', overflow: 'hidden' }}>
                                {/* Search box */}
                                <div style={{ padding: '8px', borderBottom: `1px solid ${__sbg('#f1f5f9')}` }}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={vendorSearch}
                                    onChange={e => setVendorSearch(e.target.value)}
                                    placeholder="Search vendor..."
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '5px', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                </div>
                                {/* Options list */}
                                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                  <div
                                    onClick={() => { handleVendorSelection({ target: { value: '' } }); setVendorDropdownOpen(false); }}
                                    style={{ padding: '9px 12px', fontSize: '14px', color: __stc('#9ca3af'), cursor: 'pointer', borderBottom: `1px solid ${__sbg('#f8fafc')}` }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                  >
                                    -- Select Vendor --
                                  </div>
                                  {vendors
                                    .filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.contactNumber?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase()))
                                    .map(v => (
                                      <div
                                        key={v.id}
                                        onClick={() => { handleVendorSelection({ target: { value: String(v.id) } }); setVendorDropdownOpen(false); setVendorSearch(''); }}
                                        style={{ padding: '9px 12px', fontSize: '14px', cursor: 'pointer', background: createPOFormData.vendorId === v.id ? __sbg('#eff6ff') : __sbg('white'), borderLeft: createPOFormData.vendorId === v.id ? '3px solid #3b82f6' : '3px solid transparent' }}
                                        onMouseEnter={e => { if (createPOFormData.vendorId !== v.id) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={e => { if (createPOFormData.vendorId !== v.id) e.currentTarget.style.background = 'white'; }}
                                      >
                                        <div style={{ fontWeight: 500, color: __stc('#111827') }}>{v.name}</div>
                                        {(v.contactNumber || v.category) && (
                                          <div style={{ fontSize: '12px', color: __stc('#6b7280'), marginTop: '2px' }}>
                                            {v.contactNumber && <span>{v.contactNumber}</span>}
                                            {v.contactNumber && v.category && <span> · </span>}
                                            {v.category && <span>{v.category}</span>}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  }
                                  {vendors.filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.contactNumber?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                                    <div style={{ padding: '12px', fontSize: '13px', color: __stc('#9ca3af'), textAlign: 'center' }}>No vendors found</div>
                                  )}
                                </div>
                                <div style={{ padding: '6px 12px', borderTop: `1px solid ${__sbg('#f1f5f9')}`, fontSize: '11px', color: __stc('#9ca3af') }}>{vendors.length} vendor(s) total</div>
                              </div>
                            )}
                            {/* Click-outside overlay */}
                            {vendorDropdownOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setVendorDropdownOpen(false)} />}
                          </div>
                          {vendors.length === 0 && <small style={{ color: __stc('#ef4444'), fontSize: '12px', marginTop: '6px', display: 'block' }}>No vendors available. Add a new vendor.</small>}
                        </div>
                      )}
                      {showNewVendorForm && (
                        <div style={{ padding: '20px', background: __sbg('#f0fdf4'), border: `2px solid ${__sbg('#86efac')}`, borderRadius: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                            <div className="po-form-group">
                              <label>Vendor Name *</label>
                              <input type="text" value={createPOFormData.vendorName || ''} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, vendorName: e.target.value }))} placeholder="Enter vendor company name" style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                            </div>
                            <div className="po-form-group">
                              <label>Contact Number <span style={{ fontSize: 11, color: __stc('#94a3b8'), fontWeight: 400 }}>(optional)</span></label>
                              <input type="tel" value={createPOFormData.vendorContact || ''} onChange={(e) => handleNewVendorContactChange(e.target.value)} placeholder="Enter 10-digit mobile" maxLength={10} style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                              {createPOFormData.vendorContact && createPOFormData.vendorContact.length > 0 && createPOFormData.vendorContact.length < 10 && <small style={{ color: __stc('#dc2626'), fontSize: '12px', marginTop: '4px', display: 'block' }}>⚠️ Must be 10 digits ({createPOFormData.vendorContact.length}/10)</small>}
                            </div>
                            <div className="po-form-group">
                              <label>Category *</label>
                              <FilterSelect
                                value={createPOFormData.vendorCategory || ''}
                                options={[
                                  ...VENDOR_CATEGORIES.map(c => ({ value: c, label: c })),
                                  ...(createPOFormData.vendorCategory && createPOFormData.vendorCategory !== 'Other' && !VENDOR_CATEGORIES.includes(createPOFormData.vendorCategory) ? [{ value: createPOFormData.vendorCategory, label: createPOFormData.vendorCategory }] : []),
                                  { value: 'Other', label: 'Other (enter manually)' },
                                ]}
                                placeholder="Select category"
                                onChange={v => { setCreatePOFormData(prev => ({ ...prev, vendorCategory: v })); if (v !== 'Other') setCustomVendorCategory(''); }}
                              />
                              {createPOFormData.vendorCategory === 'Other' && (
                                <input type="text" value={customVendorCategory} onChange={e => setCustomVendorCategory(e.target.value)} placeholder="Enter custom category" style={{ marginTop: 6, width: '100%', padding: '8px 10px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13 }} />
                              )}
                            </div>
                            <div className="po-form-group">
                              <label>Vendor Type *</label>
                              <FilterSelect
                                value={createPOFormData.vendorType || ''}
                                options={[
                                  ...VENDOR_TYPES.map(t => ({ value: t, label: t })),
                                  ...(createPOFormData.vendorType && createPOFormData.vendorType !== 'Other' && !VENDOR_TYPES.includes(createPOFormData.vendorType) ? [{ value: createPOFormData.vendorType, label: createPOFormData.vendorType }] : []),
                                  { value: 'Other', label: 'Other (enter manually)' },
                                ]}
                                placeholder="Select type"
                                onChange={v => { setCreatePOFormData(prev => ({ ...prev, vendorType: v })); if (v !== 'Other') setCustomVendorType(''); }}
                              />
                              {createPOFormData.vendorType === 'Other' && (
                                <input type="text" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)} placeholder="Enter custom vendor type" style={{ marginTop: 6, width: '100%', padding: '8px 10px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13 }} />
                              )}
                            </div>
                          </div>
                          <div style={{ marginTop: '12px', padding: '12px', background: __sbg('#dbeafe'), border: `1px solid ${__sbg('#93c5fd')}`, borderRadius: '6px', fontSize: '13px', color: __stc('#1e40af') }}>💡 This vendor will be created immediately when you submit the PO.</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 4: PO Details */}
              {(isEditMode || createPOFormData.quotationId || itemsStepUnlocked || itemSource === 'bom') && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><span>📝</span> Purchase Order Details</h3>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Order Date *</label>
                      <PODatePicker
                        value={createPOFormData.orderDate}
                        onChange={v => setCreatePOFormData(prev => ({ ...prev, orderDate: v }))}
                        placeholder="Select order date"
                      />
                    </div>
                    <div className="po-form-group">
                      <label>Expected Delivery *</label>
                      <PODatePicker
                        value={createPOFormData.expectedDelivery}
                        onChange={v => setCreatePOFormData(prev => ({ ...prev, expectedDelivery: v }))}
                        placeholder="Select delivery date"
                        minDate={createPOFormData.orderDate}
                      />
                    </div>
                  </div>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Status</label>
                      <FilterSelect
                        value={createPOFormData.status || 'Draft'}
                        options={isEditMode ? [
                          { value: 'Draft',      label: 'Draft' },
                          { value: 'Approved',   label: 'Approved' },
                          { value: 'Ordered',    label: 'Ordered' },
                          { value: 'Cancelled',  label: 'Cancelled' },
                        ] : [
                          { value: 'Draft',    label: 'Draft' },
                          { value: 'Approved', label: 'Approved' },
                        ]}
                        placeholder="Select Status"
                        onChange={(v) => setCreatePOFormData(prev => ({ ...prev, status: v }))}
                      />
                    </div>
                    <div className="po-form-group">
                      <label>Shipping Address</label>
                      <input type="text" value={createPOFormData.shippingAddress} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, shippingAddress: e.target.value }))} placeholder="Enter delivery address" style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Vendor RFQ Id <span style={{ fontSize: 11, color: __stc('#94a3b8'), fontWeight: 400 }}>(optional)</span></label>
                      <input
                        type="text"
                        value={createPOFormData.poRefId || ''}
                        onChange={(e) => setCreatePOFormData(prev => ({ ...prev, poRefId: e.target.value }))}
                        placeholder="e.g. RFQ-2026-001 (auto-filled from quotation)"
                        style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Payment Terms</label>
                      <textarea rows={3} value={createPOFormData.paymentTerms} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, paymentTerms: e.target.value }))} placeholder="e.g., Net 30, Advance Payment, 50% advance + 50% on delivery..." style={{ width: '100%', padding: '10px', fontSize: '14px', resize: 'vertical' }} />
                    </div>
                  </div>
                  <div className="po-form-group">
                    <label>Notes / Special Instructions</label>
                    <textarea rows={3} value={createPOFormData.notes} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes, special requirements, etc." style={{ width: '100%', padding: '10px', fontSize: '14px', resize: 'vertical' }} />
                  </div>

                  {/* PO Soft-Copy Upload */}
                  <div className="po-file-upload-section">
                    <label className="po-file-upload-label">
                      <File size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      PO Soft Copy (PDF / PNG / JPG — max 10 MB)
                    </label>
                    <div className="po-file-upload-row">
                      <input
                        ref={poFileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handlePOFileSelect}
                        className="po-file-input"
                        id="po-file-input"
                      />
                      <label htmlFor="po-file-input" className="po-file-choose-btn">
                        <Upload size={14} /> Choose File
                      </label>
                      {poFileUpload && (
                        <span className="po-file-chosen-name">
                          {poFileUpload.name} ({(poFileUpload.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                      {!poFileUpload && isEditMode && editingPOId && (
                        <span className="po-file-existing-hint">
                          A file may already be attached. Selecting a new one will replace it.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Items */}
              {(isEditMode || createPOFormData.quotationId || itemsStepUnlocked || itemSource === 'bom') && (
                <div className="po-form-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><span>📋</span> Purchase Order Items</h3>
                      <p style={{ fontSize: '13px', color: __stc('#64748b') }}>{createPOFormData.quotationId ? 'Select items and adjust quantities' : 'Enter vendor prices for selected items'}</p>
                    </div>
                    <button className="purchase-orders-btn-secondary" onClick={() => setShowManualItemForm(!showManualItemForm)} style={{ padding: '8px 16px', fontSize: '14px' }}>
                      <Plus size={16} /> {showManualItemForm ? 'Cancel' : 'Add Manual Item'}
                    </button>
                  </div>

                  {showManualItemForm && (
                    <div style={{ padding: '16px', background: __sbg('#f0fdf4'), border: `2px solid ${__sbg('#86efac')}`, borderRadius: '8px', marginBottom: '16px' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: __stc('#166534') }}>Add Manual Item</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Item Name *</label><ItemNameAutocomplete value={newItem.itemName} onChange={(val) => setNewItem(prev => ({ ...prev, itemName: val }))} onSelect={(catalogueItem) => setNewItem(prev => ({ ...prev, itemName: catalogueItem.itemName, itemDescription: catalogueItem.description || prev.itemDescription, unitPrice: catalogueItem.unitPrice > 0 ? catalogueItem.unitPrice : prev.unitPrice, gst: catalogueItem.taxPercent > 0 ? catalogueItem.taxPercent : prev.gst }))} user={user} placeholder="Enter item name" /></div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Quantity *</label><input type="text" inputMode="decimal" value={(() => { const raw = String(newItem.quantity ?? '').replace(/,/g, ''); if (raw === '' || raw === '0') return raw; const n = parseFloat(raw); return isNaN(n) ? raw : n.toLocaleString('en-IN'); })()} onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d{0,3}$/.test(raw)) setNewItem(prev => ({ ...prev, quantity: raw })); }} placeholder="0" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Unit</label>
                          <div className="po-unit-select-wrap po-manual-unit-wrap" style={{ display: 'block' }}>
                            <FilterSelect
                              value={newItem.unit === '' || newItem.unit == null || COMMON_UNITS.includes(newItem.unit) ? (newItem.unit || 'Nos') : 'Custom'}
                              options={[...COMMON_UNITS.map(u => ({ value: u, label: u })), { value: 'Custom', label: '✏️ Custom' }]}
                              placeholder="Unit"
                              onChange={(val) => setNewItem(prev => ({ ...prev, unit: val === 'Custom' ? '' : (val || 'Nos') }))}
                            />
                          </div>
                          {(newItem.unit !== '' && newItem.unit != null && !COMMON_UNITS.includes(newItem.unit)) && (
                            <input type="text" placeholder="Enter custom unit" value={newItem.unit} onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))} style={{ marginTop: 4, width: '100%', padding: '8px', fontSize: '13px' }} />
                          )}
                        </div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Unit Price (₹) *</label><input type="text" inputMode="decimal" value={formatIndianInput(newItem.unitPrice)} onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d{0,3}$/.test(raw)) setNewItem(prev => ({ ...prev, unitPrice: raw === '' ? '' : raw })); }} placeholder="0.00" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>GST %</label><input type="number" value={newItem.gst} onChange={(e) => setNewItem(prev => ({ ...prev, gst: parseFloat(e.target.value) || 0 }))} min="0" max="100" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="purchase-orders-btn-primary" onClick={handleAddManualItem} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>✅ Add Item</button></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Description</label><input type="text" value={newItem.itemDescription} onChange={(e) => setNewItem(prev => ({ ...prev, itemDescription: e.target.value }))} placeholder="Enter item description (optional)" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>HSN Code</label><input type="text" value={newItem.hsnCode} onChange={(e) => setNewItem(prev => ({ ...prev, hsnCode: e.target.value }))} placeholder="Optional" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                      </div>
                    </div>
                  )}

                  {createPOFormData.items.length > 0 ? (
                    <>
                      <div style={{ overflowX: 'auto', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '8px' }}>
                        <table className="po-items-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                          <colgroup>
                            <col style={{ width: '46px' }} />
                            <col style={{ width: 'auto' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '96px' }} />
                            {createPOFormData.quotationId && <col style={{ width: '90px' }} />}
                            <col style={{ width: '76px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '56px' }} />
                          </colgroup>
                          <thead style={{ background: __sbg('#f8fafc') }}>
                            <tr>
                              <th className="po-th" style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={createPOFormData.items.every(i => i.selected)}
                                  onChange={(e) => setCreatePOFormData(prev => ({ ...prev, items: prev.items.map(item => ({ ...item, selected: e.target.checked })) }))}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }} title="Select/Deselect All" />
                              </th>
                              <th className="po-th" style={{ textAlign: 'left' }}>Item Name</th>
                              <th className="po-th" style={{ textAlign: 'left' }}>Description</th>
                              <th className="po-th" style={{ textAlign: 'center' }}>Unit</th>
                              {createPOFormData.quotationId && <th className="po-th" style={{ textAlign: 'center' }}>Quoted Qty</th>}
                              <th className="po-th" style={{ textAlign: 'center' }}>PO Qty *</th>
                              <th className="po-th" style={{ textAlign: 'right' }}>Unit Price (₹) *</th>
                              <th className="po-th" style={{ textAlign: 'center' }}>GST %</th>
                              <th className="po-th" style={{ textAlign: 'right' }}>Line Total</th>
                              <th className="po-th" style={{ textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {createPOFormData.items.map((item, index) => {
                              const qty      = parseFloat(item.quantity)  || 0;
                              const price    = parseFloat(item.unitPrice) || 0;
                              const gst      = parseFloat(item.gst)       || 0;
                              const base     = qty * price;
                              const computedLineTotal = base * (1 + gst / 100);
                              return (
                              <tr key={index} style={{ borderTop: `1px solid ${__sbg('#e2e8f0')}`, opacity: item.selected ? 1 : 0.5, background: item.selected ? __sbg('white') : __sbg('#f9fafb'), verticalAlign: 'middle' }}>
                                <td className="po-td" style={{ textAlign: 'center' }}>
                                  <input type="checkbox" checked={item.selected} onChange={() => handleToggleItemSelection(index)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                </td>
                                <td className="po-td" style={{ fontWeight: '500' }}>
                                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.itemName}
                                    {item.isManual && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px', background: __sbg('#dbeafe'), color: __stc('#1e40af'), borderRadius: '4px', fontWeight: '600' }}>MANUAL</span>}
                                    {item.hsnCode && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 5px', background: __sbg('#f1f5f9'), color: __stc('#475569'), borderRadius: '4px', fontWeight: '600' }}>HSN {item.hsnCode}</span>}
                                  </div>
                                  {item.remainingQty != null && (
                                    <div style={{ fontSize: '11px', color: item.remainingQty <= 0 ? __stc('#ef4444') : __stc('#22c55e'), marginTop: '2px', whiteSpace: 'nowrap' }}>
                                      OB: {item.quotedQuantity} total · {item.allocatedQty || 0} assigned · <strong>{item.remainingQty} remaining</strong>
                                    </div>
                                  )}
                                </td>
                                <td className="po-td po-td-clip" style={{ fontSize: '13px', color: __stc('#64748b') }}>{item.itemDescription || '—'}</td>
                                <td className="po-td" style={{ textAlign: 'center' }}>
                                  <div className="po-unit-select-wrap">
                                    <FilterSelect
                                      value={item.unit === '' || item.unit == null || COMMON_UNITS.includes(item.unit) ? (item.unit || '') : 'Custom'}
                                      options={[
                                        ...COMMON_UNITS.map(u => ({ value: u, label: u })),
                                        { value: 'Custom', label: '✏️ Custom' },
                                      ]}
                                      placeholder="Unit"
                                      disabled={!item.selected}
                                      onChange={(val) => {
                                        if (val === 'Custom') handleUpdatePOItemUnit(index, '');
                                        else handleUpdatePOItemUnit(index, val || '');
                                      }}
                                    />
                                  </div>
                                  {(item.unit !== '' && item.unit != null && !COMMON_UNITS.includes(item.unit)) && (
                                    <input
                                      type="text"
                                      placeholder="Enter custom unit"
                                      value={item.unit}
                                      onChange={(e) => handleUpdatePOItemUnit(index, e.target.value)}
                                      disabled={!item.selected}
                                      style={{ marginTop: 3, fontSize: 11, width: '100%', padding: '4px 6px', textAlign: 'center', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                  )}
                                </td>
                                {createPOFormData.quotationId && <td className="po-td" style={{ textAlign: 'center', fontWeight: '600', color: __stc('#0284c7') }}>{item.quotedQuantity}{item.remainingQty != null && <div style={{ fontSize: 11, fontWeight: 500, color: item.remainingQty <= 0 ? __stc('#dc2626') : __stc('#059669') }}>{item.remainingQty <= 0 ? 'fully ordered' : `${item.remainingQty} left`}</div>}</td>}
                                <td className="po-td" style={{ textAlign: 'center' }}>
                                  <input type="text" inputMode="decimal"
                                    value={formatIndianInput(item.quantity)}
                                    onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d{0,3}$/.test(raw)) handleUpdatePOItemQuantity(index, raw); }}
                                    disabled={!item.selected}
                                    style={{ width: '100%', padding: '6px 8px', textAlign: 'center', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', background: item.selected ? __sbg('white') : __sbg('#f1f5f9') }} />
                                </td>
                                <td className="po-td" style={{ textAlign: 'right' }}>
                                  <input type="text" inputMode="decimal"
                                    value={formatIndianInput(item.unitPrice)}
                                    onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d{0,3}$/.test(raw)) handleUpdatePOItemPrice(index, raw); }}
                                    disabled={createPOFormData.quotationId || !item.selected}
                                    placeholder="0.00"
                                    style={{ width: '100%', padding: '6px 8px', textAlign: 'right', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: (createPOFormData.quotationId || !item.selected) ? __sbg('#f1f5f9') : __sbg('white') }} />
                                </td>
                                <td className="po-td" style={{ textAlign: 'center' }}>
                                  <select value={item.gst} onChange={(e) => handleUpdatePOItemGST(index, e.target.value)} disabled={!item.selected}
                                    style={{ width: '100%', padding: '6px 4px', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', cursor: item.selected ? 'pointer' : 'not-allowed', backgroundColor: item.selected ? __sbg('white') : __sbg('#f1f5f9') }}>
                                    {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                                  </select>
                                </td>
                                <td className="po-td po-td-clip" style={{ textAlign: 'right', fontWeight: '600', color: item.selected ? __stc('#059669') : __stc('#94a3b8'), fontSize: '14px' }}>{formatCurrency(computedLineTotal)}</td>
                                <td className="po-td" style={{ textAlign: 'center' }}><button className="remove-item-btn" onClick={() => handleRemoveItem(index)} title="Remove item"><Trash2 size={16} /></button></td>
                              </tr>
                              );
                            })}
                          </tbody>
                          <tfoot style={{ background: __sbg('#f8fafc'), borderTop: `2px solid ${__sbg('#e2e8f0')}` }}>
                            <tr>
                              <td colSpan={createPOFormData.quotationId ? 8 : 7} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: __stc('#475569') }}>
                                Grand Total ({createPOFormData.items.filter(i => i.selected).length} items selected):
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: __stc('#059669'), whiteSpace: 'nowrap', overflow: 'visible' }}>{formatCurrency(calculatePOTotal())}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: __stc('#64748b') }}>{createPOFormData.items.filter(i => i.selected).length} of {createPOFormData.items.length} items selected</span>
                        {!createPOFormData.quotationId && createPOFormData.items.some(i => i.selected && (!i.unitPrice || i.unitPrice === 0)) && (
                          <div style={{ padding: '7px 12px', background: __sbg('#fef3c7'), border: `1px solid ${__sbg('#fbbf24')}`, borderRadius: '6px', fontSize: '13px', color: __stc('#92400e') }}>⚠️ Please enter unit prices for all selected items</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '48px', textAlign: 'center', background: __sbg('#f8fafc'), border: `2px dashed ${__sbg('#cbd5e0')}`, borderRadius: '8px', color: __stc('#94a3b8') }}>
                      <div style={{ fontSize: '44px', marginBottom: '10px' }}>📦</div>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: __stc('#64748b'), marginBottom: '4px' }}>No items to display</div>
                      <div style={{ fontSize: '13px' }}>Select a quotation, load order book items, or add manual items</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="purchase-orders-modal-actions">
              <button
                className="purchase-orders-btn-primary po-btn-submit" onClick={handleCreatePO}
                disabled={!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0}
              >
                {(() => {
                  const label = createPOFormData.documentType === 'WORK_ORDER' ? 'Work Order' : 'Purchase Order';
                  return isEditMode ? `💾 Update ${label}` : `✅ Create ${label}`;
                })()}
              </button>
              <button className="purchase-orders-btn-secondary po-btn-cancel" onClick={handleCloseCreatePOModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <GeneratePoModal
        open={!!genPo}
        po={genPo}
        vendor={genVendor}
        authHeaders={getAuthHeaders()}
        onClose={() => { setGenPo(null); setGenVendor(null); }}
        onGenerated={() => { fetchPurchaseOrders(); }}
        showSuccess={showSuccess}
        showError={showError}
      />

      <BomItemPicker
        open={showBomPicker}
        projectUniqueId={modalProjectId}
        // Editing a PO: its own quantities must not count as "already ordered"
        // against itself, or every line would look like it breached the BOM.
        excludePoId={isEditMode ? editingPOId : null}
        alreadyLoadedIds={(createPOFormData.items || []).map(i => i.bomLineId).filter(Boolean)}
        onAdd={handleAddBomItems}
        onClose={() => setShowBomPicker(false)}
        showError={showError}
      />

      {/* Inferred BOM matches, confirmed before anything is written. */}
      <BomMatchConfirmDialog
        open={!!bomMatchReview}
        matches={bomMatchReview?.matches || []}
        bomLines={bomMatchReview?.bomLines || []}
        scopes={bomMatchReview?.scopes || []}
        onConfirm={confirmBomMatches}
        onCancel={() => setBomMatchReview(null)}
      />

      <BomViolationDialog
        open={!!bomViolations}
        violations={bomViolations?.violations || []}
        blocking
        projectUniqueId={bomViolations?.projectId}
        onClose={() => setBomViolations(null)}
      />
    </div>
  );
};

export default PurchaseOrders;