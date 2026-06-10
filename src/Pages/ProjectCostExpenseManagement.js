import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Plus, X, Edit2, Eye, Trash2,
  IndianRupee, CreditCard, FileText,
  CheckCircle, Clock, XCircle, Briefcase,
  MapPin, Utensils, Plane, Hotel, Users,
  ArrowUpDown, ArrowUp, ArrowDown, GripVertical,
  Receipt, RefreshCw, ExternalLink,
} from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter.js';
import FilterSelect from '../components/Dropdowns/FilterSelect.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import filterApi from '../services/filterApi';
import ConfirmationModal from '../components/ConfirmationModal';
import '../pages-css/ProjectCostExpenseManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Travel', 'Site Visit', 'Accommodation', 'Food', 'Transportation', 'Labour Charges', 'Commission', 'Miscellaneous', 'Other'];
const PAYMENT_MODES = ['Cash', 'Bank_Transfer', 'UPI', 'Card', 'Cheque'];
const formatPaymentMode = (mode) => mode === 'Bank_Transfer' ? 'Bank Transfer' : (mode || '');
const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];

const DEFAULT_COLUMNS = [
  { key: 'expenseCode',   label: 'Code',             sortable: false,  visible: true },
  { key: 'tripDate',      label: 'Date',             sortable: true,  visible: true  },
  { key: 'groupCategory', label: 'Group & Category', sortable: false, visible: true  },
  { key: 'project',       label: 'Project',          sortable: false, visible: true  },
  { key: 'expenseItems',  label: 'Expense Items',    sortable: false, visible: true  },
  { key: 'amount',        label: 'Total',            sortable: true,  visible: true  },
  { key: 'paidByName',    label: 'Paid By',          sortable: true,  visible: true  },
  { key: 'status',        label: 'Status',           sortable: false, visible: true, mandatory: 1 },
  { key: 'approval',      label: 'Approval Flow',    sortable: false, visible: true  },
  { key: 'payment',       label: 'Payment',          sortable: false, visible: true  },
  { key: 'actions',       label: 'Actions',          sortable: false, visible: true  },
];

// ─── Approval workflow constants & helpers ──────────────────────────────────

/* ── Inline-style theme mappers (added for dark mode) ──────────────────────────
   bg()  -> backgrounds / borders (white & light tints become dark)
   tc()  -> text / icons (dark colours become light; white stays white)
   Identity in light mode, so light rendering is unchanged. ────────────────────*/
const __isDarkTheme = () =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f3f5':'#232b3b',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#dbeafe':'#1d3a5f','#e0f2fe':'#16344d','#e7f5ff':'#16344d','#f0f9ff':'#15243d',
  '#fef3c7':'#3a3016','#fffbeb':'#2a2710','#fff3cd':'#3a3016',
  '#dcfce7':'#14302a','#d1e7dd':'#14302a','#f0fdf4':'#14301f',
  '#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#f8d7da':'#3a1d1d',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#dee2e6':'#2b3445','#e9ecef':'#2b3445',
  '#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#adb5bd':'#3a4456',
  '#86efac':'#2a5a40','#bbf7d0':'#2a5a40','#a7f3d0':'#2a5a40',
  '#fcd34d':'#5a4714','#fde68a':'#4a3a14','#fca5a5':'#5a2a2a','#c4b5fd':'#4a3d7a',
  '#ede9fe':'#241b3d','#f3e8ff':'#2a1b3d','#faf5ff':'#221530','#f0f4ff':'#1a1f3d','#f8faff':'#161b27',
};
const __TM = {
  '#111827':'#e7ecf3','#0f172a':'#e7ecf3','#1a202c':'#e7ecf3',
  '#1e293b':'#d4dbe6','#1f2937':'#d4dbe6',
  '#374151':'#c2cbd8','#495057':'#aab4c2','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#6c757d':'#94a1b3',
  '#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#adb5bd':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#7fe0bc','#0f5132':'#7fe0bc',
  '#b45309':'#f0c07a','#856404':'#f0c07a',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#842029':'#f08a8a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#0284c7':'#38bdf8',
  '#7c3aed':'#a78bfa','#6d28d9':'#a78bfa','#6b21a8':'#c084fc','#5b21b6':'#a78bfa','#8b5cf6':'#b39bf7','#ea580c':'#fb923c','#06b6d4':'#22d3ee',
};
const bg = (v) => (__isDarkTheme() && __SM[v]) ? __SM[v] : v;
const tc = (v) => (__isDarkTheme() && __TM[v]) ? __TM[v] : v;
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};

const APPROVAL_STAGES = [
  { key: 'stage1', code: 'MANAGER', short: 'M', label: 'Reporting Manager' },
  { key: 'stage2', code: 'CFO',     short: 'C', label: 'Chief Financial Officer' },
  { key: 'stage3', code: 'FINAL',   short: 'F', label: 'Final Authorization' },
];
// Normalize a role/designation for lenient matching (SUPERADMIN, SUPER_ADMIN → SUPERADMIN)
const normRole = (s) => (s || '').toUpperCase().replace(/[^A-Z]/g, '');
const stageColor = (st) => {
  switch ((st || 'WAITING').toUpperCase()) {
    case 'APPROVED': return { bg: bg('#dcfce7'), color: tc('#15803d'), br: bg('#86efac') };
    case 'REJECTED': return { bg: bg('#fee2e2'), color: tc('#b91c1c'), br: bg('#fca5a5') };
    case 'PENDING':  return { bg: bg('#fef3c7'), color: tc('#b45309'), br: bg('#fcd34d') };
    default:         return { bg: bg('#f1f5f9'), color: tc('#94a3b8'), br: bg('#e2e8f0') }; // WAITING
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = v => v == null ? '₹0' : `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ── Indian rupee live-format helpers (for amount inputs) ──────────────────────
// Formats a raw numeric string to Indian comma format while preserving decimals-in-progress
const toIndianDisplay = (val) => {
  if (val === '' || val == null) return '';
  const str = String(val).replace(/,/g, '');
  const dotIdx = str.indexOf('.');
  const hasDecimal = dotIdx !== -1;
  const intPart = hasDecimal ? str.slice(0, dotIdx) : str;
  const decPart = hasDecimal ? str.slice(dotIdx + 1) : undefined;
  let formattedInt = '';
  if (intPart !== '') {
    const n = parseInt(intPart, 10);
    formattedInt = isNaN(n) ? intPart : n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  return decPart !== undefined ? formattedInt + '.' + decPart : formattedInt;
};
// Strips commas and non-numeric chars (except one decimal) for storing raw value
const fromIndianDisplay = (str) => {
  const clean = str.replace(/,/g, '').replace(/[^\d.]/g, '');
  // Ensure at most one decimal point
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
};
const fmtDate = d => { if (!d) return 'N/A'; const dt = new Date(d); const dd = String(dt.getDate()).padStart(2,'0'); const mm = String(dt.getMonth()+1).padStart(2,'0'); const yyyy = dt.getFullYear(); return `${dd}-${mm}-${yyyy}`; };

const CategoryIcon = ({ cat }) => ({
  'Travel': <Plane size={14} />,
  'Site Visit': <MapPin size={14} />,
  'Accommodation': <Hotel size={14} />,
  'Food': <Utensils size={14} />,
  'Transportation': <Briefcase size={14} />,
  'Labour Charges': <Users size={14} />,
  'Commission': <Users size={14} />,
  'Miscellaneous': <FileText size={14} />,
}[cat] || <FileText size={14} />);

const StatusBadge = ({ s }) => (
  <span className={`exp-badge badge-${(s || 'pending').toLowerCase()}`}>{s || '—'}</span>
);


// ─── Shared Calendar Constants ─────────────────────────────────────────────
const _PCE_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _PCE_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── DatePicker — same calendar style as Task Management ───────────────────
const PCEDatePicker = ({ value, onChange, placeholder = 'Select date' }) => {
  const [show,   setShow]   = useState(false);
  const [calMo,  setCalMo]  = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth());
  const [calYr,  setCalYr]  = useState(() => value ? parseInt(value.slice(0,4))   : new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const [pos,    setPos]    = useState({ top:0, left:0, width:260 });
  const trRef = useRef(null);
  const dpRef = useRef(null);

  useEffect(() => {
    const h = e => {
      if (trRef.current && !trRef.current.contains(e.target) &&
          dpRef.current && !dpRef.current.contains(e.target)) setShow(false);
    };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const openPicker = () => {
    if (value) { setCalMo(parseInt(value.slice(5,7))-1); setCalYr(parseInt(value.slice(0,4))); }
    if (trRef.current) {
      const r = trRef.current.getBoundingClientRect();
      const dH = 310; const up = window.innerHeight - r.bottom < dH && r.top > dH;
      setPos({ top: up ? r.top-dH-4 : r.bottom+4, left: r.left, width: Math.max(r.width, 260) });
    }
    setShow(true);
  };

  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);
  const fmt = d => { if (!d) return null; const [y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <>
      <button ref={trRef} type="button"
        className={`pce-dp-trigger${show?' pce-dp--open':''}${value?' pce-dp--set':''}`}
        onClick={show ? () => setShow(false) : openPicker}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{flexShrink:0, color: value?'#2563eb':'#94a3b8'}}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        {value
          ? <span style={{flex:1, fontSize:13, fontWeight:500, color:tc('#0f172a')}}>{fmt(value)}</span>
          : <span className="pce-dp-ph">{placeholder}</span>}
        {value
          ? <span className="pce-dp-x" onClick={e=>{e.stopPropagation(); onChange('');}}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{marginLeft:'auto', color:tc('#94a3b8'), transform:show?'rotate(180deg)':'none', transition:'transform .2s', flexShrink:0}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
        }
      </button>
      {show && (
        <div ref={dpRef} className="pce-dp-dropdown"
          style={{position:'fixed', top:pos.top, left:pos.left, width:pos.width, zIndex:9999}}>
          <div className="pce-dp-head">
            <button type="button" className="pce-dp-nav"
              onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="pce-dp-month-btn" onClick={()=>setShowYr(p=>!p)}>
              {_PCE_MONTHS[calMo]} <span className="pce-dp-yr">{calYr}</span>
            </button>
            <button type="button" className="pce-dp-nav"
              onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
          {showYr ? (
            <div className="pce-yr-grid">
              {Array.from({length:16},(_,i)=>{
                const yr=new Date().getFullYear()-4+i;
                return <div key={yr} className={`pce-yr-cell${yr===calYr?' pce-yr-sel':''}`}
                  onClick={()=>{setCalYr(yr);setShowYr(false);}}>{yr}</div>;
              })}
            </div>
          ) : (
            <div className="pce-dp-grid">
              {_PCE_DAYS.map(d=><div key={d} className="pce-dp-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="pce-dp-cell pce-dp-empty"/>)}
              {Array.from({length:DIM}).map((_,i)=>{
                const dy=i+1;
                const ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                let cls='pce-dp-cell';
                if(ds===value) cls+=' pce-dp-sel';
                else if(ds===tod) cls+=' pce-dp-today';
                return <div key={ds} className={cls}
                  onClick={()=>{onChange(ds);setShow(false);}}>{dy}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};

// ─── DateRangeFilter — same as Task Management filter bar ──────────────────
const PCEDateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  const [show,   setShow]   = useState(false);
  const [from,   setFrom]   = useState(null);
  const [to,     setTo]     = useState(null);
  const [hover,  setHover]  = useState(null);
  const [calMo,  setCalMo]  = useState(new Date().getMonth());
  const [calYr,  setCalYr]  = useState(new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};
    if(show)document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[show]);

  const DIM=new Date(calYr,calMo+1,0).getDate(), FD=new Date(calYr,calMo,1).getDay();
  const tod=new Date().toISOString().slice(0,10);
  const inR=d=>{const hi=to||(from&&hover?hover:null);if(!from||!hi)return false;const[a,b]=from<=hi?[from,hi]:[hi,from];return d>a&&d<b;};
  const clickDay=d=>{if(!from||(from&&to)){setFrom(d);setTo(null);}else if(d<from){setFrom(d);setTo(null);}else if(d===from){setFrom(null);setTo(null);}else setTo(d);};
  const fmt=d=>{if(!d)return'';const[y,m,dy]=d.split('-');return`${dy}-${m}-${y}`;};

  return (
    <div ref={ref} style={{position:'relative',display:'inline-flex'}}>
      <button type="button"
        className={`pce-cal-trigger${show?' pce-cal--open':''}${appliedFrom?' pce-cal--applied':''}`}
        onClick={()=>setShow(p=>!p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom?'pce-cal-val':'pce-cal-ph'}>{appliedFrom?fmt(appliedFrom):'dd-mm-yyyy'}</span>
        <span className="pce-cal-sep">—</span>
        <span className={appliedTo&&appliedTo!==appliedFrom?'pce-cal-val':'pce-cal-ph'}>
          {appliedTo&&appliedTo!==appliedFrom?fmt(appliedTo):'dd-mm-yyyy'}
        </span>
        {appliedFrom&&<span className="pce-cal-x" onClick={e=>{e.stopPropagation();setFrom(null);setTo(null);onClear();}}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{marginLeft:'auto',color:tc('#94a3b8'),flexShrink:0,transform:show?'rotate(180deg)':'none',transition:'transform .2s'}}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {show && (
        <div className="pce-cal-dropdown" style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:9999,width:264}}>
          <div className="pce-dp-head">
            <button type="button" className="pce-dp-nav"
              onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="pce-dp-month-btn" onClick={()=>setShowYr(p=>!p)}>
              {_PCE_MONTHS[calMo]} <span className="pce-dp-yr">{calYr}</span>
            </button>
            <button type="button" className="pce-dp-nav"
              onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
          {showYr ? (
            <div className="pce-yr-grid">
              {Array.from({length:16},(_,i)=>{
                const yr=new Date().getFullYear()-4+i;
                return <div key={yr} className={`pce-yr-cell${yr===calYr?' pce-yr-sel':''}`}
                  onClick={()=>{setCalYr(yr);setShowYr(false);}}>{yr}</div>;
              })}
            </div>
          ) : (
            <div className="pce-dp-grid">
              {_PCE_DAYS.map(d=><div key={d} className="pce-dp-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="pce-dp-cell pce-dp-empty"/>)}
              {Array.from({length:DIM}).map((_,i)=>{
                const dy=i+1;
                const ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const dow=(FD+i)%7;
                let cls='pce-dp-cell';
                if(ds===from) cls+=' pce-cal-from';
                else if(ds===to) cls+=' pce-cal-to';
                else if(inR(ds)){cls+=' pce-cal-in-range';if(dow===0)cls+=' pce-cal-rr-s';if(dow===6)cls+=' pce-cal-rr-e';}
                if(ds===tod&&ds!==from&&ds!==to) cls+=' pce-dp-today';
                return <div key={ds} className={cls}
                  onClick={()=>clickDay(ds)}
                  onMouseEnter={()=>from&&!to&&setHover(ds)}
                  onMouseLeave={()=>setHover(null)}>{dy}</div>;
              })}
            </div>
          )}
          <div className="pce-cal-footer">
            <div className="pce-cal-chips">
              <span className={`pce-cal-chip${from?' pce-cal-chip--set':''}`}>{from?fmt(from):'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/>
              </svg>
              <span className={`pce-cal-chip${to?' pce-cal-chip--set':''}`}>{to?fmt(to):'To —'}</span>
            </div>
            <div style={{display:'flex',gap:6,justifyContent:'center',width:'100%'}}>
              {(from||appliedFrom)&&<button type="button" className="pce-cal-clear"
                onClick={()=>{setFrom(null);setTo(null);onClear();setShow(false);}}>Clear</button>}
              <button type="button" className="pce-cal-clear" onClick={()=>setShow(false)}>Cancel</button>
              <button type="button" className="pce-cal-apply"
                onClick={()=>{if(!from)return;onApply(from,to||from);setShow(false);}}
                disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Single-project selector (radio dropdown) for an expense item ────────────
const ProjectMultiSelect = ({ projList, selected, onChange, disabled, loading, placeholder }) => {
  useThemeVersion();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Normalise: always work with a single string ID (or '')
  const sel = selected || [];
  const selectedId = sel.length > 0 ? String(sel[0]) : '';

  const selectOne = (id) => {
    onChange([String(id)]);
    setOpen(false);
  };

  const labelFor = (id) => {
    const p = (projList || []).find(p => String(p.id) === String(id));
    return p ? (p.name + (p.location ? ' – ' + p.location : '')) : '#' + id;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          border: '1px solid ' + (!selectedId ? '#ef4444' : open ? bg('#2563eb') : bg('#d1d5db')),
          borderRadius: 8, padding: '7px 10px', minHeight: 36,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? bg('#f9fafb') : bg('#fff'),
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,.1)' : (!selectedId ? '0 0 0 2px rgba(239,68,68,.1)' : 'none'),
          transition: 'border-color .15s, box-shadow .15s',
        }}>
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 12.5, color: selectedId ? tc('#111827') : tc('#9ca3af'),
        }}>
          {loading ? 'Loading…' : selectedId ? labelFor(selectedId) : (placeholder || '— Select Project *')}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tc("#6b7280")} strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          width: 'max-content', minWidth: '100%', maxWidth: 460,
          zIndex: 9999, background: bg('#fff'), border: `1px solid ${bg('#e5e7eb')}`, borderRadius: 10,
          boxShadow: '0 10px 28px rgba(0,0,0,.14)', maxHeight: 260, overflowY: 'auto',
        }}>
          {/* Clear / placeholder row */}
          <div onClick={() => { onChange([]); setOpen(false); }}
            style={{
              padding: '8px 12px', fontSize: 11.5, cursor: 'pointer',
              color: tc('#9ca3af'), borderBottom: `1px solid ${bg('#f3f4f6')}`, fontStyle: 'italic',
            }}
            onMouseEnter={e => e.currentTarget.style.background = bg('#f9fafb')}
            onMouseLeave={e => e.currentTarget.style.background = bg('transparent')}>
            — Select Project *
          </div>
          {(projList || []).length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: tc('#9ca3af'), textAlign: 'center' }}>
              {loading ? 'Loading…' : 'No projects available'}
            </div>
          )}
          {(projList || []).map(p => {
            const isSelected = String(p.id) === selectedId;
            return (
              <div key={p.id} onClick={() => selectOne(p.id)}
                style={{
                  padding: '8px 14px', fontSize: 11.5, cursor: 'pointer', display: 'flex',
                  alignItems: 'flex-start', gap: 10,
                  background: isSelected ? bg('#eff6ff') : bg('transparent'),
                  borderBottom: `1px solid ${bg('#f8fafc')}`,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = bg('#f9fafb'); }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? bg('#eff6ff') : bg('transparent'); }}>
                {/* Radio indicator */}
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  border: '2px solid ' + (isSelected ? bg('#2563eb') : bg('#d1d5db')),
                  background: isSelected ? bg('#2563eb') : bg('#fff'),
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s',
                }}>
                  {isSelected && <span style={{ width: 5, height: 5, borderRadius: '50%', background: tc('#fff') }} />}
                </span>
                <span style={{
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? tc('#1d4ed8') : tc('#111827'),
                  fontSize: 11.5, lineHeight: 1.4,
                  wordBreak: 'break-word', whiteSpace: 'normal',
                }}>
                  {p.name}{p.location ? ` – ${p.location}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectCostExpenseManagement = () => {
  useThemeVersion();

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // ── Role-based data scope (not permission gates) ───────────────────────────
  // isFullAccess controls whether the user sees all records or only their own.
  // This is intentional data scoping, not a button-level permission override.
  const userRole      = (user?.role || localStorage.getItem('userRole') || '').toLowerCase();
  const isSuperAdmin   = user?.role === 'SUPERADMIN' || userRole.includes('super_admin');
  const isAdmin        = user?.role === 'ADMIN';
  const isAccountsRole = user?.role && user.role.toUpperCase().startsWith('ACCOUNTS_');
  const isFullAccess   = isSuperAdmin || isAdmin || isAccountsRole;
  // Approval is gated by the multi-stage workflow (canActOnStage), not a blanket role flag
  const canApprove     = isFullAccess;

  // ── Approval-workflow permissions for the logged-in user ───────────────────
  const myRoleNorm  = normRole(user?.role);
  const myDesigNorm = normRole(user?.designation);
  const isAdminOverride = myRoleNorm === 'SUPERADMIN' || myRoleNorm === 'ADMIN';
  const isCFOUser   = isAdminOverride || myRoleNorm === 'ACCOUNTSCFO'
    || myDesigNorm.includes('CHIEFFINANCIALOFFICER') || myDesigNorm === 'CFO';
  const isFinalUser = isAdminOverride || myRoleNorm === 'ACCOUNTSMANAGER'
    || myRoleNorm === 'SUPERADMIN' || myDesigNorm.includes('ACCOUNTSMANAGER');
  const isPayUser   = isAdminOverride || myRoleNorm === 'ACCOUNTSEXECUTIVE'
    || myDesigNorm.includes('ACCOUNTSEXECUTIVE');

  // Can the current user act on the CURRENT stage of this expense?
  const canActOnStage = (exp) => {
    if (!exp) return false;
    const stage = exp.approvalStage;
    if (stage === 'MANAGER') {
      return isAdminOverride
        || (exp.reportingManagerId != null && String(exp.reportingManagerId) === String(user?.id));
    }
    if (stage === 'CFO')   return isCFOUser;
    if (stage === 'FINAL') return isFinalUser;
    return false; // COMPLETED / REJECTED — nothing to act on
  };
  // Can the current user mark this expense as paid?
  // ALL three approval stages must be complete (approvalStage === 'COMPLETED')
  // before the Pay button is shown — status='Approved' alone is not enough
  // because legacy rows may have status set without a completed workflow.
  const canMarkPaid = (exp) =>
    exp &&
    exp.approvalStage === 'COMPLETED' &&
    exp.status === 'Approved' &&
    exp.paymentStatus !== 'PAID' &&
    (isPayUser || isFinalUser);

  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [filters, setFilters] = useState({
    search: '', category: 'all', status: 'all', paymentMode: 'all', dateFrom: '', dateTo: '', expenseType: 'all',
  });
  const [activeKpi, setActiveKpi] = useState(null); // tracks which KPI card is active
  const [sortBy, setSortBy] = useState('tripDate');
  const [sortDir, setSortDir] = useState('desc');

  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColPanel, setShowColPanel] = useState(false);
  const dragCol = useRef(null);
  const dragOver = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', type: 'alert', onConfirm: null });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemsModalExpense, setItemsModalExpense] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalExpense, setViewModalExpense] = useState(null);
  const [expenseFormData, setExpenseFormData] = useState(null);

  // ── Bill upload state ──────────────────────────────────────────────────────
  const [billFile, setBillFile] = useState(null);           // File object
  const [billUploading, setBillUploading] = useState(false);
  const billInputRef = useRef(null);

  // ── Bill preview modal state ───────────────────────────────────────────────
  const [showBillPreviewModal, setShowBillPreviewModal] = useState(false);
  const [billPreviewUrl, setBillPreviewUrl]             = useState(null);
  const [billPreviewName, setBillPreviewName]           = useState('');

  // ── Per-item project dropdowns cache (key = item.id) ──────────────────────
  const [itemProjects, setItemProjects] = useState({});     // { [itemId]: [{id,name}] }
  const [itemProjectsLoading, setItemProjectsLoading] = useState({});

  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({
    groups: false, subGroups: false, projects: false,
  });


  const [availableUsers, setAvailableUsers] = useState([]);
  // ── Paid By searchable dropdown state ────────────────────────────────────────
  const [paidByOpen,     setPaidByOpen]     = useState(false);   // create modal
  const [paidBySearch,   setPaidBySearch]   = useState('');
  const [editPaidByOpen, setEditPaidByOpen] = useState(false);   // edit modal
  const [editPaidBySearch, setEditPaidBySearch] = useState('');
  const paidByRef     = React.useRef(null);
  const editPaidByRef = React.useRef(null);

  // ── Auth Headers ─────────────────────────────────────────────────────────────
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Name': user?.name || localStorage.getItem('userName') || 'User',
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json',
  });

  // ── Modal dropdown handlers — EXPENSE ────────────────────────────────────────
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups);
    } catch (error) { showError('Failed to load groups'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchModalSubGroups = async (grp) => {
    if (!grp) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(grp);
      setModalSubGroups(subGroups);
    } catch (error) { showError('Failed to load sub-groups'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchModalProjects = async (grp, sub) => {
    if (!grp || !sub) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(grp, sub);
      setModalProjects(projects);
    } catch (error) { showError('Failed to load projects'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(0); // reset to first page on size change
  };
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('')
    setModalSubGroups([]); setModalProjects([]);
    setItemProjects({}); // clear all item project caches
    setExpenseFormData(prev => ({ ...prev, groupName: newGroupName, subGroupName: '', projectId: '' }));
    if (newGroupName) fetchModalSubGroups(newGroupName);
  };

  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName); setModalProjects([]);
    setItemProjects({}); // clear item project caches
    setExpenseFormData(prev => ({ ...prev, subGroupName: newSubGroupName, projectId: '' }));
    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
      // Load projects for all existing items
      setTimeout(() => refreshAllItemProjects(modalGroupName, newSubGroupName), 100);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setExpenseFormData(prev => ({ ...prev, projectId: newProjectId }));
  };

  // ── Per-item project loader ────────────────────────────────────────────────
  // When group/subgroup is set, load projects for every item dropdown
  const loadItemProjects = async (itemId, grp, sub) => {
    if (!grp || !sub) { setItemProjects(prev => ({ ...prev, [itemId]: [] })); return; }
    setItemProjectsLoading(prev => ({ ...prev, [itemId]: true }));
    try {
      const projects = await filterApi.getProjects(grp, sub);
      setItemProjects(prev => ({ ...prev, [itemId]: projects }));
    } catch { /* silent */ }
    finally { setItemProjectsLoading(prev => ({ ...prev, [itemId]: false })); }
  };

  // When group/subgroup changes in create modal, refresh all item project lists
  const refreshAllItemProjects = (grp, sub) => {
    if (!expenseFormData?.expenseItems) return;
    expenseFormData.expenseItems.forEach(item => loadItemProjects(item.id, grp, sub));
  };

  // ── Bill upload handler ────────────────────────────────────────────────────
  const handleBillUpload = async (expenseId) => {
    if (!billFile) return null;
    if (billFile.size > 10 * 1024 * 1024) {
      showError('File size must not exceed 10 MB'); return null;
    }
    setBillUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', billFile);
      const headers = { ...getAuthHeaders() };
      delete headers['Content-Type']; // let browser set multipart boundary
      const res = await fetch(`${API_BASE_URL}/project-expenses/${expenseId}/receipt`, {
        method: 'POST', headers, credentials: 'include', body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setBillFile(null);
      return data.receiptUrl;
    } catch (err) { showError('Bill upload failed: ' + err.message); return null; }
    finally { setBillUploading(false); }
  };

  // ── Bill preview modal handler ────────────────────────────────────────────
  const handleViewBill = async (exp) => {
    try {
      const url = exp.receiptUrl
        ? `${API_BASE_URL}${exp.receiptUrl}`
        : `${API_BASE_URL}/project-expenses/${exp.id}/bill`;
      const r = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) { showError('Bill not found or could not be loaded'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setBillPreviewUrl(blobUrl);
      setBillPreviewName(exp.expenseCode || `Expense-${exp.id}`);
      setShowBillPreviewModal(true);
    } catch { showError('Failed to load bill document'); }
  };

  const handleCloseBillPreview = () => {
    if (billPreviewUrl) window.URL.revokeObjectURL(billPreviewUrl);
    setBillPreviewUrl(null);
    setBillPreviewName('');
    setShowBillPreviewModal(false);
  };


  // ── Modal dropdown handlers — ADVANCE ────────────────────────────────────────
  // ── Fetch users for Paid By ───────────────────────────────────────────────────
  // The backend /filters/leads-users reads User-Role from the request header.
  // SUPERADMIN/ADMIN → returns all users.
  // ACCOUNTS_* roles → normally scoped, so we override User-Role header to SUPERADMIN
  //                    so the backend returns all users for the Paid By dropdown.
  useEffect(() => {
    if (!user?.id) return;

    const isAccountsRole = user?.role && user.role.toUpperCase().startsWith('ACCOUNTS_');
    const isPrivileged   = isAccountsRole
      || user?.role === 'ADMIN'
      || user?.role === 'SUPERADMIN';

    const fetchPaidByUsers = async () => {
      try {
        // For privileged / accounts roles: call leads-users with SUPERADMIN role header
        // so backend returns the full user list (not scoped to team/createdBy).
        const headers = {
          'Content-Type': 'application/json',
          'User-Id':     String(user.id),
          'X-User-Id':   String(user.id),
          'User-Role':   isPrivileged ? 'SUPERADMIN' : (user.role || ''),
          'X-User-Role': isPrivileged ? 'SUPERADMIN' : (user.role || ''),
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        };

        const res = await fetch(`${API_BASE_URL}/filters/leads-users`, {
          credentials: 'include',
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data)
            ? data.map(u => ({ id: u.id, name: u.name || u.full_name || '', role: u.role || '' }))
            : [];
          setAvailableUsers(list);
        } else {
          setAvailableUsers([]);
        }
      } catch {
        setAvailableUsers([]);
      }
    };

    fetchPaidByUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  // ── Data fetchers ─────────────────────────────────────────────────────────────
// eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, [groupName, subGroupName, projectId, currentPage, filters.search, filters.status, pageSize,
    filters.category, filters.paymentMode, filters.dateFrom, filters.dateTo, filters.expenseType, sortBy, sortDir]);

  // Close paid-by dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (paidByRef.current && !paidByRef.current.contains(e.target)) setPaidByOpen(false);
      if (editPaidByRef.current && !editPaidByRef.current.contains(e.target)) setEditPaidByOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy, sortDir });
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.search) params.append('search', filters.search);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.paymentMode  !== 'all') params.append('paymentMode',  filters.paymentMode);
      if (filters.expenseType  !== 'all') params.append('expenseType',  filters.expenseType);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      // Access scoping is handled server-side via X-User-Role/X-User-Id headers (project_access table).
      // Do NOT send createdBy — that would override the project-grant scoping in the backend.

      const response = await fetch(`${API_BASE_URL}/project-expenses?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch expenses');
      const data = await response.json();
      setExpenses(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (error) {
      showError('Failed to load expenses');
      setExpenses([]);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      // Scope by group/project selection
      if (projectId)    params.append('projectId',    projectId);
      if (groupName)    params.append('groupName',    groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      // Apply same filters as the table so KPI cards match exactly what is shown
      if (filters.status      !== 'all') params.append('status',      filters.status);
      if (filters.category    !== 'all') params.append('category',    filters.category);
      if (filters.paymentMode !== 'all') params.append('paymentMode', filters.paymentMode);
      if (filters.expenseType !== 'all') params.append('expenseType', filters.expenseType);
      if (filters.dateFrom)              params.append('dateFrom',    filters.dateFrom);
      if (filters.dateTo)                params.append('dateTo',      filters.dateTo);
      if (filters.search)                params.append('search',      filters.search);
      // Non-full-access scoping is now handled server-side via X-User-Role/X-User-Id headers.
      // No need to send createdBy — the backend applies the same visibility rules as getExpenses.
      const response = await fetch(`${API_BASE_URL}/project-expenses/stats?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (response.ok) setStats(await response.json());
    } catch { /* silent */ }
  };



  // ── Add / Create Expense ──────────────────────────────────────────────────────
  const handleAddNewExpense = () => {
    setBillFile(null);
    setItemProjects({});
    const initItem = { id: Date.now(), category: 'Travel', projectIds: [], amount: '', paymentMode: 'UPI', description: '' };
    setExpenseFormData({
      groupName: groupName || '', subGroupName: subGroupName || '',
      tripDate: new Date().toISOString().split('T')[0],
      tripReason: '',
      paidByUserId: String(user?.id || ''), paidByName: user?.name || '',
      adjustedAdvanceId: '', advanceAdjustedAmount: '',
      expenseItems: [initItem],
    });
    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);
    fetchModalGroups();
    if (groupName) {
      fetchModalSubGroups(groupName);
      if (subGroupName) {
        fetchModalProjects(groupName, subGroupName);
        loadItemProjects(initItem.id, groupName, subGroupName);
      }
    }
    setShowCreateModal(true);
  };

  const handleCreateExpense = async () => {
    const { groupName: grp, subGroupName: sub, tripDate, tripReason, paidByUserId, paidByName, expenseItems } = expenseFormData || {};
    if (!grp || !sub) { showWarning('Group and Sub-Group are required'); return; }
    if (!tripDate) { showWarning('Date is required'); return; }
    if (!tripReason || !tripReason.trim()) { showWarning('Purpose / Description is required'); return; }
    if (!expenseItems?.length) { showWarning('Add at least one expense item'); return; }

    // Validate every item: at least one project, valid amount, commission notes
    const missingProject = expenseItems.find(i => !i.projectIds || i.projectIds.length === 0);
    if (missingProject) { showWarning('Every item must have a project selected'); return; }
    const missingAmount = expenseItems.find(i => !i.amount || parseFloat(i.amount) <= 0);
    if (missingAmount) { showWarning('Every item must have a valid amount'); return; }
    const missingCommissionNote = expenseItems.find(
      i => i.category === 'Commission' && (!i.description || !i.description.trim()));
    if (missingCommissionNote) { showWarning('Commission items require notes specifying who the commission is paid to'); return; }

    // Bill upload is mandatory
    if (!billFile) { showWarning('Bill / receipt upload is mandatory'); return; }

    // ── Expand each item across its selected projects, dividing equally ───────
    // An item of ₹900 across 3 projects → ₹300 to each (remainder added to first).
    const byProject = {};
    expenseItems.forEach(i => {
      const pids = i.projectIds || [];
      const n = pids.length;
      const total = parseFloat(i.amount) || 0;
      const base = Math.floor((total / n) * 100) / 100;          // 2-dp share
      const remainder = Math.round((total - base * n) * 100) / 100;
      pids.forEach((pid, idx) => {
        const share = idx === 0 ? Math.round((base + remainder) * 100) / 100 : base;
        if (!byProject[pid]) byProject[pid] = [];
        byProject[pid].push({
          category: i.category,
          amount: share,
          paymentMode: i.paymentMode,
          description: n > 1
            ? `${i.description || ''}${i.description ? ' ' : ''}[split: ${fmt(share)} of ${fmt(total)} across ${n} projects]`.trim()
            : (i.description || ''),
        });
      });
    });
    const projectGroups = Object.entries(byProject); // [[projectId, [items]], ...]

    setLoading(true);
    try {
      const results = [];
      for (const [pid, items] of projectGroups) {
        const body = {
          groupName: grp, subGroupName: sub,
          projectId: pid,
          tripDate, tripReason: tripReason || null,
          paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
          paidByName: paidByName || '',
          expenseItems: items.map(i => ({
            category: i.category,
            amount: parseFloat(i.amount) || 0,
            paymentMode: i.paymentMode,
            description: i.description || '',
          })),
        };
        const res = await fetch(`${API_BASE_URL}/project-expenses`, {
          method: 'POST', headers: getAuthHeaders(), credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed for project ${pid}: ${errText}`);
        }
        const created = await res.json();
        results.push(Array.isArray(created) ? created[0] : created);
      }

      // Bill is mandatory — upload to every created expense record
      if (billFile) {
        for (const r of results) { if (r?.id) await handleBillUpload(r.id); }
      }

      const projectCount = projectGroups.length;
      const itemCount = expenseItems.length;
      showSuccess(
        projectCount === 1
          ? `Expense submitted for approval with ${itemCount} item(s)`
          : `${itemCount} item(s) split equally across ${projectCount} projects — submitted for approval`
      );
      setShowCreateModal(false); setBillFile(null);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to create expense'); }
    finally { setLoading(false); }
  }

  
  // ── Fetch Payments ───────────────────────────────────────────────────────────


  // ── Record single payment (from expense row button) ────────────────────────


  // ── Bulk Payment (multiple expenses at once) ───────────────────────────────


  // ── Bulk Advance (multi-project at once) ────────────────────────────────────


  // ── View / Edit / Update / Delete Expense ─────────────────────────────────────
  const handleViewExpense = async (expense) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-expenses/${expense.id}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch expense details');
      const data = await response.json();
      setViewModalExpense(data);
      setShowViewModal(true);
    } catch (error) {
      // fallback: open with existing data
      setViewModalExpense(expense);
      setShowViewModal(true);
    }
    finally { setLoading(false); }
  };

  const handleEditExpense = (expense) => {
    setBillFile(null);
    setItemProjects({});
    // Build items from expenseItems array; fall back to legacy single-item format
    // ExpenseItemResponse from backend does NOT include projectId on each item —
    // all items under one expense share the parent expense's projectId.
    const parentProjectId = expense.projectId ? String(expense.projectId) : '';
    const items = (expense.expenseItems && expense.expenseItems.length > 0)
      ? expense.expenseItems.map(i => ({
          id: i.id || Date.now() + Math.random(),
          category: i.category || 'Travel',
          projectIds: [i.projectId ? String(i.projectId) : parentProjectId].filter(Boolean),
          amount: i.amount?.toString() || '',
          paymentMode: i.paymentMode || 'UPI',
          description: i.description || '',
        }))
      : [{ id: Date.now(), category: expense.category || 'Travel',
           projectIds: [expense.projectId ? String(expense.projectId) : ''].filter(Boolean),
           amount: expense.amount?.toString() || '',
           paymentMode: expense.paymentMode || 'UPI',
           description: expense.description || '' }];

    setExpenseFormData({
      id: expense.id, groupName: expense.groupName || '', subGroupName: expense.subGroupName || '',
      projectId: expense.projectId || '', tripDate: expense.tripDate || '',
      visitType: expense.visitType || 'Site Visit', tripReason: expense.tripReason || '',
      tripOutcome: expense.tripOutcome || '', paidByUserId: expense.paidByUserId?.toString() || '',
      paidByName: expense.paidByName || '', approvedByUserId: expense.approvedByUserId || '',
      approvedByName: expense.approvedByName || '', status: expense.status || 'Pending',
      receiptUrl: expense.receiptUrl || '',
      commissionType: expense.commissionType || '', commissionGivenTo: expense.commissionGivenTo || '',
      commissionPercentage: expense.commissionPercentage || '', commissionFixedAmount: expense.commissionFixedAmount || '',
      salesOrderRef: expense.salesOrderRef || '',
      expenseItems: items,
    });
    setModalGroupName(expense.groupName || '');
    setModalSubGroupName(expense.subGroupName || '');
    // No default project — each item carries its own projectId
    fetchModalGroups();
    if (expense.groupName) {
      fetchModalSubGroups(expense.groupName);
      if (expense.subGroupName) {
        fetchModalProjects(expense.groupName, expense.subGroupName);
        // Pre-load per-item project dropdowns
        items.forEach(item => loadItemProjects(item.id, expense.groupName, expense.subGroupName));
      }
    }
    setShowEditModal(true);
  }

  const handleUpdateExpense = async () => {
    const { id, groupName: grp, subGroupName: sub, tripDate, tripReason,
            paidByUserId, paidByName, expenseItems } = expenseFormData || {};
    if (!grp || !sub) { showWarning('Group and Sub-Group are required'); return; }
    if (!tripReason || !tripReason.trim()) { showWarning('Purpose / Description is required'); return; }
    if (!expenseItems?.length) { showWarning('Add at least one expense item'); return; }

    const missingProject = expenseItems.find(i => !i.projectIds || i.projectIds.length === 0);
    if (missingProject) { showWarning('Every item must have a project selected'); return; }
    const missingAmount = expenseItems.find(i => !i.amount || parseFloat(i.amount) <= 0);
    if (missingAmount) { showWarning('Every item must have a valid amount'); return; }
    const missingCommissionNote = expenseItems.find(
      i => i.category === 'Commission' && (!i.description || !i.description.trim()));
    if (missingCommissionNote) { showWarning('Commission items require notes specifying who the commission is paid to'); return; }

    // Expand items across selected projects, dividing equally
    const byProject = {};
    expenseItems.forEach(i => {
      const pids = i.projectIds || [];
      const n = pids.length;
      const total = parseFloat(i.amount) || 0;
      const base = Math.floor((total / n) * 100) / 100;
      const remainder = Math.round((total - base * n) * 100) / 100;
      pids.forEach((pid, idx) => {
        const share = idx === 0 ? Math.round((base + remainder) * 100) / 100 : base;
        if (!byProject[pid]) byProject[pid] = [];
        byProject[pid].push({
          category: i.category,
          amount: share,
          paymentMode: i.paymentMode,
          description: n > 1
            ? `${i.description || ''}${i.description ? ' ' : ''}[split: ${fmt(share)} of ${fmt(total)} across ${n} projects]`.trim()
            : (i.description || ''),
        });
      });
    });

    const projectIds = Object.keys(byProject);
    const singleProject = projectIds.length === 1;

    setLoading(true);
    try {
      if (singleProject) {
        const res = await fetch(`${API_BASE_URL}/project-expenses/${id}`, {
          method: 'PUT', headers: getAuthHeaders(), credentials: 'include',
          body: JSON.stringify({
            groupName: grp, subGroupName: sub,
            projectId: projectIds[0],
            tripDate, tripReason: tripReason || null,
            paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
            paidByName: paidByName || '',
            expenseItems: byProject[projectIds[0]].map(i => ({
              category: i.category, amount: parseFloat(i.amount) || 0,
              paymentMode: i.paymentMode, description: i.description || '',
            })),
          }),
        });
        if (!res.ok) throw new Error('Failed to update expense');
        if (billFile) await handleBillUpload(id);
        showSuccess('Expense updated successfully!');
      } else {
        // Multi-project: delete original, create new split records (re-enters approval)
        await fetch(`${API_BASE_URL}/project-expenses/${id}`, {
          method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
        });
        const results = [];
        for (const [pid, items] of Object.entries(byProject)) {
          const res = await fetch(`${API_BASE_URL}/project-expenses`, {
            method: 'POST', headers: getAuthHeaders(), credentials: 'include',
            body: JSON.stringify({
              groupName: grp, subGroupName: sub, projectId: pid,
              tripDate, tripReason: tripReason || null,
              paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
              paidByName: paidByName || '',
              expenseItems: items.map(i => ({
                category: i.category, amount: parseFloat(i.amount) || 0,
                paymentMode: i.paymentMode, description: i.description || '',
              })),
            }),
          });
          if (!res.ok) throw new Error('Failed to create split expense');
          const created = await res.json();
          results.push(Array.isArray(created) ? created[0] : created);
        }
        if (billFile) { for (const r of results) { if (r?.id) await handleBillUpload(r.id); } }
        showSuccess(`Updated: split equally into ${projectIds.length} project expense records`);
      }

      setShowEditModal(false); setBillFile(null);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to update expense'); }
    finally { setLoading(false); }
  }

    const handleStatusChange = (id, newStatus) => {
    const isReject = newStatus === 'Rejected';
    setConfirmModal({
      show: true,
      title: isReject ? 'Reject Expense' : `${newStatus} Expense`,
      message: isReject
        ? 'Are you sure you want to reject this expense?'
        : `Are you sure you want to mark this expense as ${newStatus}?`,
      type: isReject ? 'alert' : 'confirm',
      onConfirm: () => performStatusChange(id, newStatus),
    });
  };

  const performStatusChange = async (id, newStatus) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-expenses/${id}/status`, {
        method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      showSuccess(`Expense ${newStatus}`);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message); }
    finally { setLoading(false); }
  };

  // ── Multi-stage approval actions ───────────────────────────────────────────
  const stageLabelOf = (exp) => {
    const s = APPROVAL_STAGES.find(x => x.code === exp?.approvalStage);
    return s ? s.label : 'approval';
  };

  // Returns a friendly "your role" label used in confirmation messages
  const myRoleLabel = () => {
    if (isCFOUser && !isAdminOverride)   return 'CFO';
    if (isFinalUser && !isAdminOverride) return 'Accounts Manager';
    if (isAdminOverride)                 return 'Admin';
    return 'Reporting Manager';
  };

  // Returns what happens next after this user approves
  const nextStepMessage = (exp) => {
    const stage = exp?.approvalStage;
    if (stage === 'MANAGER') return 'It will then move to the CFO for the next review.';
    if (stage === 'CFO')     return 'It will then move to the Accounts Manager for final authorisation.';
    if (stage === 'FINAL')   return 'This is the final approval step — the expense will be marked as Approved and sent for payment.';
    return 'It will move to the next step in the approval chain.';
  };

  const performApprovalAction = async (id, action, remarks) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/project-expenses/${id}/${action}`, {
        method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify({ remarks: remarks || '' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to ${action}`);
      }
      showSuccess(action === 'approve' ? `Expense approved successfully as ${myRoleLabel()}.` : 'Expense rejected. The submitter has been notified.');
      setShowViewModal(false);
      fetchExpenses(); fetchStats();
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  };

  const handleApproveStage = (exp) => {
    setConfirmModal({
      show: true,
      title: 'Confirm Approval',
      message: `By confirming, this expense (${exp.expenseCode || 'this expense'}) will be approved from your side as ${myRoleLabel()}. ${nextStepMessage(exp)}`,
      type: 'confirm',
      onConfirm: () => performApprovalAction(exp.id, 'approve', ''),
    });
  };

  const handleRejectStage = (exp) => {
    setConfirmModal({
      show: true,
      title: 'Confirm Rejection',
      message: `By confirming, this expense (${exp.expenseCode || 'this expense'}) will be rejected from your side as ${myRoleLabel()}. The submitter will be notified and the approval chain will stop here.`,
      type: 'alert',
      onConfirm: () => performApprovalAction(exp.id, 'reject', ''),
    });
  };

  const handleMarkPaid = (exp) => {
    setConfirmModal({
      show: true,
      title: 'Confirm Payment',
      message: `By confirming, you are recording that ${exp.paidByName || 'the employee'} has been reimbursed ${fmt(exp.totalAmount)} for expense ${exp.expenseCode || ''}. This action cannot be undone.`,
      type: 'confirm',
      onConfirm: () => performMarkPaid(exp.id),
    });
  };

  const performMarkPaid = async (id) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/project-expenses/${id}/pay`, {
        method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to mark paid');
      }
      showSuccess('Expense marked as paid');
      setShowViewModal(false);
      fetchExpenses(); fetchStats();
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  };

  const handleDeleteExpense = (expenseId) => {
    setConfirmModal({
      show: true,
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense? This action cannot be undone.',
      type: 'alert',
      onConfirm: () => performDeleteExpense(expenseId),
    });
  };

  const performDeleteExpense = async (expenseId) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-expenses/${expenseId}`, {
        method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete expense');
      showSuccess('Expense deleted successfully');
      // detail drawer removed
      fetchExpenses(); fetchStats();
    } catch (error) { showError('Failed to delete expense'); }
    finally { setLoading(false); }
  };

  // ── Column drag-and-drop ──────────────────────────────────────────────────────
  const onDragStart = (e, i) => { dragCol.current = i; e.dataTransfer.effectAllowed = 'move'; };
  const onDragEnter = (i) => { dragOver.current = i; };
  const onDragEnd = () => {
    const [from, to] = [dragCol.current, dragOver.current];
    if (from === null || to === null || from === to) return;
    setColumns(prev => { const a = [...prev]; a.splice(to, 0, ...a.splice(from, 1)); return a; });
    dragCol.current = null; dragOver.current = null;
  };

  // ── Sorting ───────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (!columns.find(c => c.key === key)?.sortable) return;
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (!columns.find(c => c.key === col)?.sortable) return null;
    if (sortBy !== col) return <ArrowUpDown size={12} className="sort-neutral" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="sort-active" />
      : <ArrowDown size={12} className="sort-active" />;
  };

  // ── Cell renderer ─────────────────────────────────────────────────────────────
  const renderCell = (col, exp) => {
    switch (col.key) {
      case 'expenseCode': return <span className="exp-code">{exp.expenseCode}</span>;
      case 'tripDate': return fmtDate(exp.tripDate);
      case 'groupCategory': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          {exp.groupName
            ? <span style={{ fontSize: 12, fontWeight: 700, color: tc('#1e293b'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{exp.groupName}</span>
            : <span style={{ color: tc('#94a3b8'), fontSize: 12 }}>—</span>
          }
          {exp.subGroupName && (
            <span style={{ fontSize: 11, color: tc('#64748b'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{exp.subGroupName}</span>
          )}
        </div>
      );
      case 'project': return (
        <div style={{ minWidth: 160 }}>
          {exp.projectId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: tc('#1e293b'), wordBreak: 'break-word', lineHeight: 1.4 }}>
                {exp.projectName || exp.projectId}
              </span>
              {exp.projectName && (
                <span style={{ fontSize: 11, color: tc('#64748b'), fontWeight: 400 }}>
                  {exp.projectId}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: tc('#94a3b8'), fontSize: 12 }}>—</span>
          )}
        </div>
      );
      case 'expenseItems': return (
        <div className="exp-items-chips-cell" style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); setItemsModalExpense(exp); setShowItemsModal(true); }}>
          {(exp.expenseItems || []).slice(0, 1).map((item, i) => (
            <span key={i} className="exp-item-chip">
              <CategoryIcon cat={item.category} />
              <span className="chip-cat">{item.category}</span>
              <span className="chip-amt">{fmt(item.amount)}</span>
            </span>
          ))}
          {(exp.expenseItems || []).length > 1 && (
            <span className="exp-item-chip chip-more">+{(exp.expenseItems || []).length - 1} more</span>
          )}
          {(exp.expenseItems || []).length === 0 && <span className="text-muted">—</span>}
        </div>
      );
      case 'amount': return <strong className="exp-amount">{fmt(exp.totalAmount)}</strong>;
      case 'paidByName': {
        // Collect unique payment modes from all expense items
        const modes = [...new Set((exp.expenseItems || []).map(i => i.paymentMode).filter(Boolean))];
        const modeColors = {
          Cash:          { bg: '#dcfce7', color: tc('#15803d') },
          UPI:           { bg: '#ede9fe', color: tc('#6d28d9') },
          Card:          { bg: '#dbeafe', color: tc('#1d4ed8') },
          Bank_Transfer: { bg: '#e0f2fe', color: tc('#0369a1') },
          Cheque:        { bg: '#fef9c3', color: tc('#92400e') },
        };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            {/* Payment mode badges */}
            {modes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {modes.map(m => {
                  const c = modeColors[m] || { bg: '#f1f5f9', color: tc('#475569') };
                  return (
                    <span key={m} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: c.bg, color: c.color, whiteSpace: 'nowrap',
                    }}>
                      <CreditCard size={9} />
                      {formatPaymentMode(m)}
                    </span>
                  );
                })}
              </div>
            )}
            {/* Person name */}
            {exp.paidByName
              ? <span style={{ fontSize: 12, color: tc('#374151'), fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.paidByName}</span>
              : modes.length === 0 && <span style={{ color: tc('#9ca3af') }}>—</span>
            }
          </div>
        );
      }
      case 'status': return <StatusBadge s={exp.status} />;
      case 'approval': {
        const stage = exp.approvalStage;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {APPROVAL_STAGES.map((s, idx) => {
              const st = (exp[s.key] && exp[s.key].status) || 'WAITING';
              const c = stageColor(st);
              const isCurrent = stage === s.code;
              const who = exp[s.key] && exp[s.key].byName ? `\n${exp[s.key].byName}` : '';
              return (
                <React.Fragment key={s.key}>
                  <span
                    title={`${s.label}: ${st}${who}`}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                      background: c.bg, color: c.color, border: `1.5px solid ${c.br}`,
                      boxShadow: isCurrent ? `0 0 0 2px ${c.br}` : 'none',
                    }}>
                    {st === 'APPROVED' ? '✓' : st === 'REJECTED' ? '✕' : s.short}
                  </span>
                  {idx < APPROVAL_STAGES.length - 1 && (
                    <span style={{ width: 8, height: 2, background: bg('#e2e8f0'), borderRadius: 2 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        );
      }
      case 'payment': {
        const paid = exp.paymentStatus === 'PAID';
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
            background: paid ? bg('#dcfce7') : bg('#f1f5f9'),
            color: paid ? tc('#15803d') : tc('#94a3b8'),
          }}>
            <IndianRupee size={11} /> {paid ? 'Paid' : 'Unpaid'}
          </span>
        );
      }
      case 'actions': return (
        <div className="exp-actions-cell">
          <button className="exp-act-btn view-btn" title="View" onClick={() => handleViewExpense(exp)}><Eye size={14} /></button>
          <button className="exp-act-btn edit-btn" title="Edit" onClick={() => handleEditExpense(exp)}><Edit2 size={14} /></button>
          {canActOnStage(exp) && (
            <>
              <button className="exp-act-btn approve-btn" title="Approve this expense" onClick={() => handleApproveStage(exp)}><CheckCircle size={14} /></button>
              <button className="exp-act-btn reject-btn" title="Reject this expense" onClick={() => handleRejectStage(exp)}><XCircle size={14} /></button>
            </>
          )}
          {canMarkPaid(exp) && (
            <button className="exp-act-btn approve-btn" title="Mark as Paid" onClick={() => handleMarkPaid(exp)}><IndianRupee size={14} /></button>
          )}
          {(exp.hasBill || exp.receiptUrl) && (
            <button className="exp-act-btn bill-btn" title="View Bill" onClick={() => handleViewBill(exp)}><Receipt size={14} /></button>
          )}
          <button className="exp-act-btn del-btn" title="Delete" onClick={() => handleDeleteExpense(exp.id)}><Trash2 size={14} /></button>
        </div>
      );
      default: return exp[col.key] || '—';
    }
  };

  // ── KPI cards ─────────────────────────────────────────────────────────────────
  // Each card carries a `filterPatch` — the exact filter values to apply when clicked.
  // Clicking again (same card) clears the filter back to 'all'.
  const kpiData = stats ? [
    { id: 'total',      title: 'Total Expenses',     value: fmt(stats.totalExpenses),    icon: <IndianRupee size={32} />, color: tc('#ef4444'), filterPatch: null },
    { id: 'approved',   title: 'Approved',            value: fmt(stats.approvedExpenses), icon: <CheckCircle size={32} />, color: tc('#22c55e'), filterPatch: { status: 'Approved', category: 'all' } },
    { id: 'pending',    title: 'Pending Approval',    value: fmt(stats.pendingExpenses),  icon: <Clock size={32} />,       color: tc('#f59e0b'), filterPatch: { status: 'Pending',  category: 'all' } },
    { id: 'travel',     title: 'Travel & Site Visit', value: fmt(stats.travelAndSiteVisit), icon: <Plane size={32} />,    color: tc('#3b82f6'), filterPatch: { category: 'Travel', status: 'all' } },
    { id: 'commission', title: 'Total Commission',    value: fmt(stats.totalCommission),  icon: <Users size={32} />,       color: tc('#8b5cf6'), filterPatch: { category: 'Commission', status: 'all' } },
    { id: 'advances',   title: 'Total Advances',      value: fmt(stats.totalAdvances),    icon: <IndianRupee size={32} />, color: tc('#06b6d4'), filterPatch: { expenseType: 'advance', status: 'all', category: 'all' } },
  ] : [];

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="exp-mgmt-container">
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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="exp-mgmt-header">
        <div className="exp-mgmt-breadcrumb">
          Dashboard &gt; Finance &gt; Project Cost &amp; Expense Management
        </div>
        <div className="page-header-with-filter">
          <h1 className="exp-mgmt-title">
            Project Cost &amp; Expense Management{' '}
            <span className="exp-mgmt-count">({totalElements})</span>
          </h1>
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      </div>

      {/* ── Action Bar ──────────────────────────────────────────────────────── */}
      <div className="exp-mgmt-action-bar">
        <div className="exp-mgmt-search-filters">
          <input
            type="text"
            placeholder="Search by code, description, paid by..."
            className="exp-mgmt-search"
            value={filters.search}
            onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(0); }}
          />
          <FilterSelect
            value={filters.category === 'all' ? '' : filters.category}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
            placeholder="All Categories"
            onChange={(val) => { setFilters({ ...filters, category: val || 'all' }); setCurrentPage(0); setActiveKpi(null); }}
          />
          <FilterSelect
            value={filters.status === 'all' ? '' : filters.status}
            options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
            placeholder="All Status"
            onChange={(val) => { setFilters({ ...filters, status: val || 'all' }); setCurrentPage(0); setActiveKpi(null); }}
          />
          <FilterSelect
            value={filters.paymentMode === 'all' ? '' : filters.paymentMode}
            options={PAYMENT_MODES.map(m => ({ value: m, label: formatPaymentMode(m) }))}
            placeholder="All Modes"
            onChange={(val) => { setFilters({ ...filters, paymentMode: val || 'all' }); setCurrentPage(0); }}
          />
          <PCEDateRangeFilter
            appliedFrom={filters.dateFrom}
            appliedTo={filters.dateTo}
            onApply={(f,t)=>{ setFilters({...filters, dateFrom:f, dateTo:t}); setCurrentPage(0); setSortDir('asc'); }}
            onClear={()=>{ setFilters({...filters, dateFrom:'', dateTo:''}); setCurrentPage(0); setSortDir('desc'); }}
          />
        </div>
        <div className="exp-mgmt-actions">
          <button className="exp-mgmt-btn-primary" onClick={handleAddNewExpense}>
            <Plus size={18} /> Add Expense
          </button>

          <button className="exp-mgmt-btn-secondary">
            <Download size={18} /> Export
          </button>
          <button className="exp-mgmt-btn-icon" title="Refresh"
            onClick={() => { fetchExpenses(); fetchStats(); }}>
            <RefreshCw size={16} />
          </button>
          <button className="exp-mgmt-btn-columns" onClick={() => setShowColPanel(v => !v)}>
            <GripVertical size={14} /> Columns
          </button>
        </div>
      </div>

      {/* ── Column Panel ────────────────────────────────────────────────────── */}
      {showColPanel && (
        <div className="exp-col-panel">
          <div className="exp-col-panel-title">Drag to reorder · toggle visibility</div>
          <div className="exp-col-list">
            {columns.filter(c => c.key !== 'actions').map((col, idx) => (
              <div key={col.key} className="exp-col-item" draggable
                onDragStart={e => onDragStart(e, idx)} onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}>
                <GripVertical size={13} className="grip-icon" />
                <input type="checkbox" checked={col.visible}
                  disabled={!!col.mandatory}
                  onChange={() => !col.mandatory && setColumns(prev => prev.map((c, i) =>
                    i === idx ? { ...c, visible: !c.visible } : c))} />
                <span>{col.label}{col.mandatory ? <span style={{fontSize:9,marginLeft:4,color:tc('#94a3b8'),fontWeight:600}}>FIXED</span> : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      {stats && (
        <>
          <div className="exp-mgmt-kpi-grid">
            {kpiData.map((kpi) => {
              return (
                <div
                  key={kpi.id}
                  className="exp-mgmt-kpi-card"
                  style={{ borderTopColor: kpi.color }}
                >
                  <div className="exp-mgmt-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                  <div className="exp-mgmt-kpi-content">
                    <div className="exp-mgmt-kpi-value">{kpi.value}</div>
                    <div className="exp-mgmt-kpi-label">{kpi.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Active KPI filter indicator with clear button */}
          {activeKpi && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: bg('#eff6ff'), border: `1px solid ${bg('#bfdbfe')}`, borderRadius: 7, fontSize: 12, color: tc('#1d4ed8'), marginBottom: 4 }}>
              <CheckCircle size={13} />
              <span>Filtering by: <strong>{kpiData.find(k => k.id === activeKpi)?.title}</strong></span>
              <button
                onClick={() => { setActiveKpi(null); setFilters(prev => ({ ...prev, status: 'all', category: 'all', expenseType: 'all' })); setCurrentPage(0); }}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: tc('#1d4ed8'), background: bg('#dbeafe'), border: `1px solid ${bg('#93c5fd')}`, borderRadius: 5, cursor: 'pointer' }}>
                <X size={11} /> Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Employee Breakdown ───────────────────────────────────────────────── */}
      {stats?.userBreakdown?.length > 0 && (
        <div className="exp-user-breakdown">
          <h3 className="exp-section-title"><Users size={15} /> Employee Cost Breakdown</h3>
          <div className="exp-user-grid">
            {stats.userBreakdown.map((u, i) => (
              <div key={i} className="exp-user-card">
                <div className="exp-user-avatar">{(u.userName || 'U')[0].toUpperCase()}</div>
                <div className="exp-user-info">
                  <div className="exp-user-name">{u.userName}</div>
                  <div className="exp-user-meta">{u.expenseCount} expenses</div>
                </div>
                <div className="exp-user-amounts">
                  <div className="exp-user-total">{fmt(u.totalAmount)}</div>
                  <div className="exp-user-sub">
                    <span className="green">{fmt(u.approvedAmount)}</span>
                    {u.pendingAmount > 0 && <span className="amber">{fmt(u.pendingAmount)} pending</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="exp-tabs">
        {[
          ['expenses', `Expenses (${totalElements})`, <FileText size={14} />],
        ].map(([tab, lbl, icon]) => (
          <button key={tab} className={`exp-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {icon} {lbl}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EXPENSES TABLE — with responsive scroll wrapper + data-label attrs
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="exp-mgmt-table-container">
          {/* scroll wrapper enables horizontal scroll on medium screens */}
          <div className="exp-table-scroll-wrapper">
            <table className="exp-mgmt-table">
              <thead>
                <tr>
                  <th className="exp-sno-th">S.No</th>
                  {columns.filter(c => c.visible).map((col, idx) => (
                    <th key={col.key} draggable
                      className={`${col.sortable ? 'sortable' : ''} ${sortBy === col.key ? 'sorted' : ''}`}
                      onDragStart={e => onDragStart(e, idx)} onDragEnter={() => onDragEnter(idx)}
                      onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}
                      onClick={() => handleSort(col.key)}>
                      <div className="th-inner">
                        <GripVertical size={11} className="th-grip" />
                        {col.label}<SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={columns.filter(c => c.visible).length + 1} className="exp-empty-state">
                    No expenses found. Adjust your filters or add a new expense.
                  </td></tr>
                ) : expenses.map((exp, rowIndex) => (
                  <tr key={exp.id} className="exp-mgmt-table-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleViewExpense(exp)}>
                    <td className="exp-sno-td">{currentPage * pageSize + rowIndex + 1}</td>
                    {columns.filter(c => c.visible).map(col => (
                      <td
                        key={col.key}
                        data-label={col.label}
                        className={col.key === 'actions' ? 'actions-td' : ''}
                        onClick={col.key === 'actions' ? (e) => e.stopPropagation() : undefined}
                      >
                        {renderCell(col, exp)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{/* end exp-table-scroll-wrapper */}

          {/* Pagination */}
          {/* Pagination */}
          <div className="table-footer">
            <div className="pagination-info">
              <span>
                Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} expenses
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
                return (
                  <button key={pageNum} className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}>{pageNum + 1}</button>
                );
              })}
              <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>Next</button>
              <button className="page-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>»</button>
            </div>
          </div>
        </div>
      )}


      {showCreateModal && expenseFormData && (() => {
        const grp  = modalGroupName;
        const sub  = modalSubGroupName;
        const total = (expenseFormData.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const pendingAdvances = []; // advance feature removed

        const addItem = () => {
          const newId = Date.now();
          setExpenseFormData(prev => ({
            ...prev,
            expenseItems: [...prev.expenseItems, {
              id: newId, category: 'Travel', projectIds: [], amount: '', paymentMode: 'UPI', description: '',
            }],
          }));
          if (grp && sub) loadItemProjects(newId, grp, sub);
        };

        const removeItem = (id) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.filter(i => i.id !== id),
        }));

        const updateItem = (id, field, val) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.map(i => i.id === id ? { ...i, [field]: val } : i),
        }));

        return (
          <div className="exp-mgmt-modal-overlay">
            <div className="exp-modal-redesigned" onClick={e => e.stopPropagation()}>
              {/* ── Header ── */}
              <div className="exp-modal-hdr">
                <div className="exp-modal-hdr-left">
                  <Receipt size={20} />
                  <div>
                    <h2>Add Expense Entry</h2>
                    <p>Each item can be assigned to a different project</p>
                  </div>
                </div>
                <button className="exp-modal-close-x" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
              </div>

              <div className="exp-modal-body">
                {/* ── Section 1: Group / SubGroup ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">1</span> Scope</div>
                  <div className="exp-form-row2">
                    <div className="exp-field">
                      <label>Group *</label>
                      <FilterSelect
                        value={modalGroupName}
                        options={modalGroups}
                        placeholder={modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}
                        disabled={modalDropdownLoading.groups}
                        onChange={(val) => handleModalGroupChange({ target: { value: val } })}
                      />
                    </div>
                    <div className="exp-field">
                      <label>Sub-Group *</label>
                      <FilterSelect
                        value={modalSubGroupName}
                        options={modalSubGroups}
                        placeholder={!modalGroupName ? 'Select group first' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Sub-Group'}
                        disabled={!modalGroupName || modalDropdownLoading.subGroups}
                        onChange={(val) => handleModalSubGroupChange({ target: { value: val } })}
                      />
                    </div>
                  </div>
                  {modalSubGroupName && (
                    <div className="exp-scope-hint">
                      <span>✓ Projects loaded — assign each expense item to a project below</span>
                    </div>
                  )}
                </div>

                {/* ── Section 2: Expense Info ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">2</span> Expense Info</div>
                  <div className="exp-form-row3">
                    <div className="exp-field">
                      <label>Date *</label>
                      <PCEDatePicker
                        value={expenseFormData.tripDate}
                        onChange={v => setExpenseFormData(p => ({ ...p, tripDate: v }))}
                        placeholder="Select date"
                      />
                    </div>
                    <div className="exp-field" style={{ position: 'relative' }} ref={paidByRef}>
                      <label>Paid By</label>
                      <div
                        onClick={() => { setPaidByOpen(o => !o); setPaidBySearch(''); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          border: `1px solid ${bg('#d1d5db')}`, borderRadius: 8, padding: '8px 12px',
                          cursor: 'pointer', background: bg('#fff'), fontSize: 13,
                          color: expenseFormData.paidByUserId ? tc('#111827') : tc('#9ca3af'), minHeight: 38,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {expenseFormData.paidByUserId ? (() => {
                            const u = availableUsers.find(u => String(u.id) === String(expenseFormData.paidByUserId));
                            return u ? (
                              <>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: tc('#fff'), fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              </>
                            ) : <span>Select user</span>;
                          })() : <span>Select user</span>}
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tc("#6b7280")} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                      {paidByOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                          background: bg('#fff'), border: `1px solid ${bg('#e5e7eb')}`, borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
                        }}>
                          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${bg('#f3f4f6')}` }}>
                            <input autoFocus type="text" placeholder="Search users..."
                              value={paidBySearch} onChange={e => setPaidBySearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', border: `1px solid ${bg('#e5e7eb')}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            <div onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: '', paidByName: '' })); setPaidByOpen(false); }}
                              style={{ padding: '9px 12px', fontSize: 13, color: tc('#6b7280'), cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = bg('#f9fafb')}
                              onMouseLeave={e => e.currentTarget.style.background = bg('transparent')}
                            >— None —</div>
                            {availableUsers.filter(u => !paidBySearch || (u.name || '').toLowerCase().includes(paidBySearch.toLowerCase())).map(u => (
                              <div key={u.id}
                                onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: String(u.id), paidByName: u.name || '' })); setPaidByOpen(false); }}
                                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: String(expenseFormData.paidByUserId) === String(u.id) ? bg('#eff6ff') : bg('transparent') }}
                                onMouseEnter={e => e.currentTarget.style.background = bg('#f9fafb')}
                                onMouseLeave={e => e.currentTarget.style.background = String(expenseFormData.paidByUserId) === String(u.id) ? bg('#eff6ff') : bg('transparent')}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: tc('#fff'), fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, color: tc('#111827') }}>{u.name}</div>
                                  {u.role && <div style={{ fontSize: 11, color: tc('#6b7280'), marginTop: 1 }}>{u.role}</div>}
                                </div>
                              </div>
                            ))}
                            {availableUsers.filter(u => !paidBySearch || (u.name || '').toLowerCase().includes(paidBySearch.toLowerCase())).length === 0 && (
                              <div style={{ padding: '10px 12px', fontSize: 13, color: tc('#9ca3af'), textAlign: 'center' }}>No users found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="exp-field">
                      <label>Purpose / Description *</label>
                      <input type="text" value={expenseFormData.tripReason} placeholder="e.g. Site visit, material transport…"
                        className={!expenseFormData.tripReason?.trim() ? 'exp-field-error-wrap' : ''}
                        onChange={e => setExpenseFormData(p => ({ ...p, tripReason: e.target.value }))} />
                    </div>
                  </div>
                  <div className="exp-approval-info" style={{marginTop:10}}>
                    <span className="exp-approval-hint">
                      On submit this expense enters the approval chain: Reporting Manager → Chief Financial Officer → Final Authorization → Paid.
                    </span>
                  </div>
                </div>

                {/* ── Section 3: Expense Items ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label-row">
                    <div className="exp-section-label"><span className="exp-section-num">3</span> Expense Items</div>
                    <button className="exp-add-item-btn" onClick={addItem} disabled={!modalSubGroupName}>
                      <Plus size={13} /> Add Item
                    </button>
                  </div>

                  {!modalSubGroupName && (
                    <div className="exp-items-hint">Select Group + Sub-Group first to assign projects per item</div>
                  )}

                  <div className="exp-items-list">
                    {(expenseFormData.expenseItems || []).map((item, idx) => {
                      const projList = itemProjects[item.id] || modalProjects;
                      const isLoading = itemProjectsLoading[item.id];
                      return (
                        <div key={item.id} className="exp-item-row">
                          <div className="exp-item-row-num">#{idx + 1}</div>
                          <div className="exp-item-fields">
                            <div className="exp-item-top-row">
                              <div className="exp-field exp-field-sm">
                                <label>Category *</label>
                                <FilterSelect
                                  value={EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Other'}
                                  options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
                                  onChange={(val) => updateItem(item.id, 'category', (!val || val === 'Other') ? '' : val)}
                                />
                                {(!EXPENSE_CATEGORIES.slice(0,-1).includes(item.category)) && (
                                  <input
                                    type="text"
                                    className="exp-other-input"
                                    placeholder="Specify category…"
                                    value={EXPENSE_CATEGORIES.includes(item.category) ? '' : item.category}
                                    onChange={e => updateItem(item.id, 'category', e.target.value)}
                                    autoFocus
                                  />
                                )}
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Amount (₹) *</label>
                                <input type="text" inputMode="decimal" placeholder="0.00"
                                  value={toIndianDisplay(item.amount)}
                                  onChange={e => updateItem(item.id, 'amount', fromIndianDisplay(e.target.value))} />
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Payment Mode</label>
                                <FilterSelect
                                  value={item.paymentMode}
                                  options={PAYMENT_MODES.map(m => ({ value: m, label: formatPaymentMode(m) }))}
                                  onChange={(val) => updateItem(item.id, 'paymentMode', val || 'UPI')}
                                />
                              </div>
                              <div className="exp-field exp-field-proj">
                                <label>Project * <span className="exp-field-hint">(required)</span></label>
                                <ProjectMultiSelect
                                  projList={projList}
                                  selected={item.projectIds}
                                  loading={isLoading}
                                  disabled={!modalSubGroupName || isLoading}
                                  placeholder={!modalSubGroupName ? 'Select sub-group first' : '— Select project(s) *'}
                                  onChange={(vals) => updateItem(item.id, 'projectIds', vals)}
                                />

                              </div>
                              {expenseFormData.expenseItems.length > 1 && (
                                <button className="exp-item-del-btn" onClick={() => removeItem(item.id)} title="Remove item">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            <div className="exp-field" style={{marginTop:4}}>
                              <input type="text"
                                placeholder={item.category === 'Commission' ? 'Required: specify who the commission is paid to…' : 'Notes / description for this item…'}
                                value={item.description}
                                className={item.category === 'Commission' && !item.description?.trim() ? 'exp-field-error-wrap' : ''}
                                onChange={e => updateItem(item.id, 'description', e.target.value)} />
                              {item.category === 'Commission' && (
                                <span className="exp-field-hint" style={{ color: tc('#b45309') }}>Notes are mandatory for Commission</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="exp-items-total-bar">
                    <span><span style={{color:tc('#64748b')}}>{(expenseFormData.expenseItems||[]).length} item(s)</span></span>
                    <strong className="exp-total-amt">{fmt(total)}</strong>
                  </div>
                </div>

                {/* ── Section 4: Bill Upload ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">4</span> Bill / Receipt Upload * <span className="exp-field-hint">(mandatory · single file · max 10 MB · stored in DB)</span></div>
                  <div className="exp-bill-upload-area"
                    onClick={() => billInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setBillFile(f); }}>
                    <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
                      onChange={e => setBillFile(e.target.files[0] || null)} />
                    {billFile ? (
                      <div className="exp-bill-selected">
                        <FileText size={18} />
                        <span>{billFile.name}</span>
                        <span className="exp-bill-size">({(billFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button onClick={e => { e.stopPropagation(); setBillFile(null); }}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="exp-bill-empty">
                        <Receipt size={22} />
                        <span>Click or drag to upload bill / receipt</span>
                        <small>PDF, JPG, PNG — max 10 MB</small>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Section 5: Advance Adjustment ── */}
                {pendingAdvances.length > 0 && (
                  <div className="exp-modal-section">
                    <div className="exp-section-label"><span className="exp-section-num">5</span> Adjust Advance <span className="exp-field-hint">(optional)</span></div>
                    <div className="exp-form-row2">
                      <div className="exp-field">
                        <label>Select Advance to Adjust</label>
                        <FilterSelect
                          value={expenseFormData.adjustedAdvanceId || ''}
                          options={pendingAdvances.map(a => ({ value: a.id, label: `${a.advanceCode} — ${fmt(a.totalAmount)} (${a.projectId || a.groupName}) — ${a.status}` }))}
                          placeholder="— No advance adjustment —"
                          onChange={(val) => setExpenseFormData(p => ({ ...p, adjustedAdvanceId: val }))}
                        />
                      </div>
                      {expenseFormData.adjustedAdvanceId && (
                        <div className="exp-field">
                          <label>Amount to Adjust (₹)</label>
                          <input type="text" inputMode="decimal" placeholder="0.00"
                            value={toIndianDisplay(expenseFormData.advanceAdjustedAmount || '')}
                            onChange={e => setExpenseFormData(p => ({ ...p, advanceAdjustedAmount: fromIndianDisplay(e.target.value) }))} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="exp-modal-footer">
                <div className="exp-modal-footer-left">
                  {(() => {
                    const items = expenseFormData.expenseItems || [];
                    const projSet = new Set(items.flatMap(i => i.projectIds || []));
                    const unassigned = items.filter(i => !i.projectIds || i.projectIds.length === 0).length;
                    return (
                      <span className="exp-footer-total">
                        {items.length} item(s) · {fmt(total)}

                        {unassigned > 0 && <span style={{color:tc('#ef4444'),marginLeft:8}}>⚠ {unassigned} item(s) need a project</span>}
                      </span>
                    );
                  })()}
                  {billFile && <span className="exp-footer-bill"><Receipt size={12} /> {billFile.name}</span>}
                </div>
                <div className="exp-modal-footer-right">
                  <button className="exp-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button className="exp-btn-primary" onClick={handleCreateExpense} disabled={loading || billUploading}>
                    {loading || billUploading ? 'Saving…' : `Save ${expenseFormData.expenseItems.length} Expense(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT EXPENSE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showEditModal && expenseFormData && (() => {
        const grp  = modalGroupName;
        const sub  = modalSubGroupName;
        const total = (expenseFormData.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        const addItem = () => {
          const newId = Date.now();
          setExpenseFormData(prev => ({
            ...prev,
            expenseItems: [...prev.expenseItems, {
              id: newId, category: 'Travel', projectIds: [], amount: '', paymentMode: 'UPI', description: '',
            }],
          }));
          if (grp && sub) loadItemProjects(newId, grp, sub);
        };

        const removeItem = (id) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.filter(i => i.id !== id),
        }));

        const updateItem = (id, field, val) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.map(i => i.id === id ? { ...i, [field]: val } : i),
        }));

        return (
          <div className="exp-mgmt-modal-overlay">
            <div className="exp-modal-redesigned" onClick={e => e.stopPropagation()}>
              {/* ── Header ── */}
              <div className="exp-modal-hdr">
                <div className="exp-modal-hdr-left">
                  <Edit2 size={20} />
                  <div>
                    <h2>Edit Expense — {expenseFormData.expenseCode || `#${expenseFormData.id}`}</h2>
                    <p>Update expense details, items, or upload a new bill</p>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <button className="exp-modal-close-x" onClick={() => setShowEditModal(false)}><X size={18} /></button>
                </div>
              </div>

              <div className="exp-modal-body">
                {/* ── Section 1: Scope ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">1</span> Scope</div>
                  <div className="exp-form-row2">
                    <div className="exp-field">
                      <label>Group *</label>
                      <FilterSelect
                        value={modalGroupName}
                        options={modalGroups}
                        placeholder={modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}
                        disabled={modalDropdownLoading.groups}
                        onChange={(val) => handleModalGroupChange({ target: { value: val } })}
                      />
                    </div>
                    <div className="exp-field">
                      <label>Sub-Group *</label>
                      <FilterSelect
                        value={modalSubGroupName}
                        options={modalSubGroups}
                        placeholder={!modalGroupName ? 'Select group first' : 'Select Sub-Group'}
                        disabled={!modalGroupName || modalDropdownLoading.subGroups}
                        onChange={(val) => handleModalSubGroupChange({ target: { value: val } })}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Expense Info ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">2</span> Expense Info</div>
                  <div className="exp-form-row3">
                    <div className="exp-field">
                      <label>Date *</label>
                      <PCEDatePicker
                        value={expenseFormData.tripDate}
                        onChange={v => setExpenseFormData(p => ({ ...p, tripDate: v }))}
                        placeholder="Select date"
                      />
                    </div>
                    <div className="exp-field" style={{ position: 'relative' }} ref={editPaidByRef}>
                      <label>Paid By</label>
                      <div
                        onClick={() => { setEditPaidByOpen(o => !o); setEditPaidBySearch(''); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          border: `1px solid ${bg('#d1d5db')}`, borderRadius: 8, padding: '8px 12px',
                          cursor: 'pointer', background: bg('#fff'), fontSize: 13,
                          color: expenseFormData.paidByUserId ? tc('#111827') : tc('#9ca3af'), minHeight: 38,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {expenseFormData.paidByUserId ? (() => {
                            const u = availableUsers.find(u => String(u.id) === String(expenseFormData.paidByUserId));
                            return u ? (
                              <>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: tc('#fff'), fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              </>
                            ) : <span>Select user</span>;
                          })() : <span>Select user</span>}
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tc("#6b7280")} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                      {editPaidByOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                          background: bg('#fff'), border: `1px solid ${bg('#e5e7eb')}`, borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
                        }}>
                          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${bg('#f3f4f6')}` }}>
                            <input autoFocus type="text" placeholder="Search users..."
                              value={editPaidBySearch} onChange={e => setEditPaidBySearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', border: `1px solid ${bg('#e5e7eb')}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            <div onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: '', paidByName: '' })); setEditPaidByOpen(false); }}
                              style={{ padding: '9px 12px', fontSize: 13, color: tc('#6b7280'), cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = bg('#f9fafb')}
                              onMouseLeave={e => e.currentTarget.style.background = bg('transparent')}
                            >— None —</div>
                            {availableUsers.filter(u => !editPaidBySearch || (u.name || '').toLowerCase().includes(editPaidBySearch.toLowerCase())).map(u => (
                              <div key={u.id}
                                onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: String(u.id), paidByName: u.name || '' })); setEditPaidByOpen(false); }}
                                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: String(expenseFormData.paidByUserId) === String(u.id) ? bg('#eff6ff') : bg('transparent') }}
                                onMouseEnter={e => e.currentTarget.style.background = bg('#f9fafb')}
                                onMouseLeave={e => e.currentTarget.style.background = String(expenseFormData.paidByUserId) === String(u.id) ? bg('#eff6ff') : bg('transparent')}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: tc('#fff'), fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, color: tc('#111827') }}>{u.name}</div>
                                  {u.role && <div style={{ fontSize: 11, color: tc('#6b7280'), marginTop: 1 }}>{u.role}</div>}
                                </div>
                              </div>
                            ))}
                            {availableUsers.filter(u => !editPaidBySearch || (u.name || '').toLowerCase().includes(editPaidBySearch.toLowerCase())).length === 0 && (
                              <div style={{ padding: '10px 12px', fontSize: 13, color: tc('#9ca3af'), textAlign: 'center' }}>No users found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="exp-field">
                      <label>Purpose / Description *</label>
                      <input type="text" value={expenseFormData.tripReason} placeholder="e.g. Site visit, material transport…"
                        className={!expenseFormData.tripReason?.trim() ? 'exp-field-error-wrap' : ''}
                        onChange={e => setExpenseFormData(p => ({ ...p, tripReason: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Expense Items ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label-row">
                    <div className="exp-section-label"><span className="exp-section-num">3</span> Expense Items</div>
                    <button className="exp-add-item-btn" onClick={addItem}><Plus size={13} /> Add Item</button>
                  </div>
                  <div className="exp-items-list">
                    {(expenseFormData.expenseItems || []).map((item, idx) => {
                      const projList = itemProjects[item.id] || modalProjects;
                      const isLoading = itemProjectsLoading[item.id];
                      return (
                        <div key={item.id} className="exp-item-row">
                          <div className="exp-item-row-num">#{idx + 1}</div>
                          <div className="exp-item-fields">
                            <div className="exp-item-top-row">
                              <div className="exp-field exp-field-sm">
                                <label>Category *</label>
                                <FilterSelect
                                  value={EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Other'}
                                  options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
                                  onChange={(val) => updateItem(item.id, 'category', (!val || val === 'Other') ? '' : val)}
                                />
                                {(!EXPENSE_CATEGORIES.slice(0,-1).includes(item.category)) && (
                                  <input
                                    type="text"
                                    className="exp-other-input"
                                    placeholder="Specify category…"
                                    value={EXPENSE_CATEGORIES.includes(item.category) ? '' : item.category}
                                    onChange={e => updateItem(item.id, 'category', e.target.value)}
                                    autoFocus
                                  />
                                )}
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Amount (₹) *</label>
                                <input type="text" inputMode="decimal"
                                  value={toIndianDisplay(item.amount)}
                                  onChange={e => updateItem(item.id, 'amount', fromIndianDisplay(e.target.value))} />
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Payment Mode</label>
                                <FilterSelect
                                  value={item.paymentMode}
                                  options={PAYMENT_MODES.map(m => ({ value: m, label: formatPaymentMode(m) }))}
                                  onChange={(val) => updateItem(item.id, 'paymentMode', val || 'UPI')}
                                />
                              </div>
                              <div className="exp-field exp-field-proj">
                                <label>Project * <span className="exp-field-hint">(required)</span></label>
                                <ProjectMultiSelect
                                  projList={projList}
                                  selected={item.projectIds}
                                  loading={isLoading}
                                  disabled={isLoading}
                                  placeholder="— Select project(s) *"
                                  onChange={(vals) => updateItem(item.id, 'projectIds', vals)}
                                />

                              </div>
                              {expenseFormData.expenseItems.length > 1 && (
                                <button className="exp-item-del-btn" onClick={() => removeItem(item.id)}><Trash2 size={13} /></button>
                              )}
                            </div>
                            <div className="exp-field" style={{marginTop:4}}>
                              <input type="text"
                                placeholder={item.category === 'Commission' ? 'Required: specify who the commission is paid to…' : 'Notes…'}
                                value={item.description}
                                className={item.category === 'Commission' && !item.description?.trim() ? 'exp-field-error-wrap' : ''}
                                onChange={e => updateItem(item.id, 'description', e.target.value)} />
                              {item.category === 'Commission' && (
                                <span className="exp-field-hint" style={{ color: tc('#b45309') }}>Notes are mandatory for Commission</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="exp-items-total-bar">
                    <span><span style={{color:tc('#64748b')}}>{(expenseFormData.expenseItems||[]).length} item(s)</span></span>
                    <strong className="exp-total-amt">{fmt(total)}</strong>
                  </div>
                </div>

                {/* ── Section 4: Bill Upload ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">4</span> Bill / Receipt</div>
                  {expenseFormData.receiptUrl && (
                    <div className="exp-existing-bill">
                      <FileText size={14} /> Current bill on file &nbsp;
                      <a href={expenseFormData.receiptUrl} target="_blank" rel="noreferrer">View</a>
                    </div>
                  )}
                  <div className="exp-bill-upload-area"
                    onClick={() => billInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setBillFile(f); }}>
                    <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
                      onChange={e => setBillFile(e.target.files[0] || null)} />
                    {billFile ? (
                      <div className="exp-bill-selected">
                        <FileText size={18} /><span>{billFile.name}</span>
                        <span className="exp-bill-size">({(billFile.size/1024/1024).toFixed(2)} MB)</span>
                        <button onClick={e => { e.stopPropagation(); setBillFile(null); }}><X size={14}/></button>
                      </div>
                    ) : (
                      <div className="exp-bill-empty">
                        <Receipt size={22}/><span>{expenseFormData.receiptUrl ? 'Upload replacement bill' : 'Upload bill / receipt'}</span>
                        <small>PDF, JPG, PNG — max 10 MB</small>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Approval status (read-only) ── */}
                <div className="exp-modal-section exp-approval-section">
                  <div className="exp-section-label"><span className="exp-section-num">5</span> Approval</div>
                  <div className="exp-approval-info">
                    <span>Current status: <strong><StatusBadge s={expenseFormData.status} /></strong></span>
                    <span className="exp-approval-hint">Approvals are handled from the expense list / view screen by each stage approver. Editing a multi-project expense re-submits it for approval.</span>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="exp-modal-footer">
                <div className="exp-modal-footer-left">
                  <span className="exp-footer-total">{(expenseFormData.expenseItems || []).length} item(s) · {fmt(total)}</span>
                </div>
                <div className="exp-modal-footer-right">
                  <button className="exp-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button className="exp-btn-primary" onClick={handleUpdateExpense} disabled={loading || billUploading}>
                    {loading || billUploading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          ADVANCE MODAL
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ══ SINGLE PAYMENT MODAL ═══════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW EXPENSE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showViewModal && viewModalExpense && (
        <div className="exp-mgmt-modal-overlay">
          <div className="exp-view-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="exp-modal-hdr">
              <div className="exp-modal-hdr-left">
                <Eye size={20} />
                <div>
                  <h2>Expense — {viewModalExpense.expenseCode || `#${viewModalExpense.id}`}</h2>
                  <p>{fmtDate(viewModalExpense.tripDate)}{viewModalExpense.paidByName ? ` · Paid by ${viewModalExpense.paidByName}` : ''}</p>
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button className="exp-btn-approve" onClick={() => { setShowViewModal(false); handleEditExpense(viewModalExpense); }}>
                  <Edit2 size={13} /> Edit
                </button>
                <button className="exp-modal-close-x" onClick={() => setShowViewModal(false)}><X size={18} /></button>
              </div>
            </div>

            {/* Body */}
            <div className="exp-modal-body">
              {/* Status + Group Info */}
              <div className="exp-modal-section">
                <div className="exp-section-label"><span className="exp-section-num">1</span> Overview</div>
                <div className="exp-view-grid">
                  <div className="exp-view-item">
                    <span className="exp-view-label">Status</span>
                    <span><StatusBadge s={viewModalExpense.status} /></span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Date</span>
                    <span className="exp-view-val">{fmtDate(viewModalExpense.tripDate)}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Group</span>
                    <span className="exp-view-val">{viewModalExpense.groupName || '—'}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Sub-Group</span>
                    <span className="exp-view-val">{viewModalExpense.subGroupName || '—'}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Paid By</span>
                    <span className="exp-view-val">{viewModalExpense.paidByName || '—'}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Total</span>
                    <span className="exp-view-val" style={{fontWeight:700,color:tc('#15803d'),fontSize:15}}>{fmt(viewModalExpense.totalAmount)}</span>
                  </div>
                  {viewModalExpense.tripReason && (
                    <div className="exp-view-item exp-view-full">
                      <span className="exp-view-label">Purpose</span>
                      <span className="exp-view-val">{viewModalExpense.tripReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Items */}
              <div className="exp-modal-section">
                <div className="exp-section-label"><span className="exp-section-num">2</span> Expense Items</div>
                <table className="exp-view-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Mode</th>
                      <th style={{textAlign:'right'}}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewModalExpense.expenseItems || []).map((item, i) => (
                      <tr key={i}>
                        <td style={{color:tc('#94a3b8'),fontSize:12}}>{i+1}</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <CategoryIcon cat={item.category} />
                            <span style={{fontWeight:500}}>{item.category}</span>
                          </div>
                        </td>
                        <td style={{color:tc('#64748b')}}>{item.description || '—'}</td>
                        <td style={{color:tc('#64748b')}}>
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <CreditCard size={12} />{formatPaymentMode(item.paymentMode)}
                          </div>
                        </td>
                        <td style={{textAlign:'right',fontWeight:700}}>{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{fontWeight:600,color:tc('#374151'),padding:'10px 12px'}}>Total</td>
                      <td style={{textAlign:'right',fontWeight:800,fontSize:15,color:tc('#111827'),padding:'10px 12px'}}>
                        {fmt((viewModalExpense.expenseItems||[]).reduce((s,i)=>s+(parseFloat(i.amount)||0),0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Approval Workflow Timeline */}
              <div className="exp-modal-section">
                <div className="exp-section-label"><span className="exp-section-num">3</span> Approval Workflow</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {APPROVAL_STAGES.map((s, idx) => {
                    const stg = viewModalExpense[s.key] || {};
                    const st = (stg.status || 'WAITING').toUpperCase();
                    const c = stageColor(st);
                    const isCurrent = viewModalExpense.approvalStage === s.code;
                    const expectedWho = s.code === 'MANAGER'
                      ? (viewModalExpense.reportingManagerName || 'Reporting Manager')
                      : (s.code === 'CFO' ? 'Chief Financial Officer (ACCOUNTS_CFO)' : 'Accounts Manager / Super Admin');
                    return (
                      <div key={s.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, background: c.bg, color: c.color,
                          border: `2px solid ${c.br}`,
                        }}>{st === 'APPROVED' ? '✓' : st === 'REJECTED' ? '✕' : (idx + 1)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: tc('#1e293b') }}>
                            {s.label}
                            {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: tc('#b45309'), background: bg('#fef3c7'), padding: '1px 7px', borderRadius: 10 }}>CURRENT</span>}
                          </div>
                          <div style={{ fontSize: 12, color: tc('#64748b'), marginTop: 1 }}>
                            <span style={{ fontWeight: 600, color: c.color }}>{st}</span>
                            {stg.byName ? ` · by ${stg.byName}` : ` · ${expectedWho}`}
                            {stg.at ? ` · ${fmtDate(stg.at)}` : ''}
                          </div>
                          {stg.remarks && <div style={{ fontSize: 11, color: tc('#94a3b8'), marginTop: 2 }}>“{stg.remarks}”</div>}
                        </div>
                      </div>
                    );
                  })}
                  {/* Payment row */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderTop: `1px dashed ${bg('#e2e8f0')}`, paddingTop: 10 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800,
                      background: viewModalExpense.paymentStatus === 'PAID' ? bg('#dcfce7') : bg('#f1f5f9'),
                      color: viewModalExpense.paymentStatus === 'PAID' ? tc('#15803d') : tc('#94a3b8'),
                      border: `2px solid ${viewModalExpense.paymentStatus === 'PAID' ? bg('#86efac') : bg('#e2e8f0')}`,
                    }}><IndianRupee size={12} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: tc('#1e293b') }}>Payment (Accounts Executive)</div>
                      <div style={{ fontSize: 12, color: tc('#64748b'), marginTop: 1 }}>
                        <span style={{ fontWeight: 600, color: viewModalExpense.paymentStatus === 'PAID' ? tc('#15803d') : tc('#94a3b8') }}>
                          {viewModalExpense.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'}
                        </span>
                        {viewModalExpense.paidByExecName ? ` · by ${viewModalExpense.paidByExecName}` : ''}
                        {viewModalExpense.paidAt ? ` · ${fmtDate(viewModalExpense.paidAt)}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Receipt */}
              {(viewModalExpense.receiptUrl || viewModalExpense.hasBill) && (
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">4</span> Bill / Receipt</div>
                  <button className="exp-receipt-link" onClick={() => handleViewBill(viewModalExpense)}>
                    <FileText size={14} /> View Bill
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="exp-modal-footer">
              <div className="exp-modal-footer-left">
                <span className="exp-footer-total">{(viewModalExpense.expenseItems||[]).length} item(s) · {fmt(viewModalExpense.totalAmount)}</span>
              </div>
              <div className="exp-modal-footer-right">
                {canActOnStage(viewModalExpense) && (
                  <>
                    <button className="exp-btn-approve" onClick={() => handleApproveStage(viewModalExpense)}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button className="exp-btn-reject" onClick={() => handleRejectStage(viewModalExpense)}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                {canMarkPaid(viewModalExpense) && (
                  <button className="exp-btn-approve" onClick={() => handleMarkPaid(viewModalExpense)}>
                    <IndianRupee size={13} /> Mark Paid
                  </button>
                )}
                <button className="exp-btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

{showItemsModal && itemsModalExpense && (
        <div className="exp-mgmt-modal-overlay">
          <div className="exp-items-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exp-mgmt-modal-header">
              <div>
                <h2>Expense Items — {itemsModalExpense.expenseCode}</h2>
                <p style={{ fontSize: 13, color: tc('#64748b'), margin: '2px 0 0' }}>
                  {fmtDate(itemsModalExpense.tripDate)}
                  {itemsModalExpense.paidByName ? ` · Paid by ${itemsModalExpense.paidByName}` : ''}
                  {itemsModalExpense.tripReason ? ` · ${itemsModalExpense.tripReason}` : ''}
                </p>
              </div>
              <button className="exp-mgmt-modal-close" onClick={() => setShowItemsModal(false)}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${bg('#e2e8f0')}` }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: tc('#64748b'), fontWeight: 600 }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: tc('#64748b'), fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: tc('#64748b'), fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: tc('#64748b'), fontWeight: 600 }}>Mode</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: tc('#64748b'), fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(itemsModalExpense.expenseItems || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${bg('#f1f5f9')}` }}>
                      <td style={{ padding: '12px', color: tc('#94a3b8'), fontSize: 13 }}>{i + 1}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <CategoryIcon cat={item.category} />
                          <span style={{ fontWeight: 500 }}>{item.category}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: tc('#64748b') }}>{item.description || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: tc('#64748b') }}>
                          <CreditCard size={13} />{formatPaymentMode(item.paymentMode)}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: tc('#111827') }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${bg('#e2e8f0')}`, background: bg('#f8fafc') }}>
                    <td colSpan={4} style={{ padding: '12px', fontWeight: 600, color: tc('#374151') }}>Total</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: tc('#111827'), fontSize: 15 }}>
                      {fmt((itemsModalExpense.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Bill Preview Modal ─────────────────────────────────────────────── */}
      {showBillPreviewModal && billPreviewUrl && (
        <div className="exp-bill-preview-overlay" onClick={handleCloseBillPreview}>
          <div className="exp-bill-preview-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="exp-bill-preview-header">
              <span className="exp-bill-preview-title">
                <FileText size={16} /> Bill — {billPreviewName}
              </span>
              <div className="exp-bill-preview-actions">
                <button
                  className="exp-bill-preview-btn exp-bill-preview-btn-open"
                  onClick={() => window.open(billPreviewUrl, '_blank')}
                >
                  <ExternalLink size={13} /> Open in Tab
                </button>
                <button
                  className="exp-bill-preview-btn exp-bill-preview-btn-download"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = billPreviewUrl;
                    a.download = billPreviewName || 'expense-bill';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  <Download size={13} /> Download
                </button>
                <button className="exp-modal-close-x" onClick={handleCloseBillPreview}>
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Preview */}
            <iframe
              src={billPreviewUrl}
              className="exp-bill-preview-iframe"
              title="Expense Bill"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectCostExpenseManagement;