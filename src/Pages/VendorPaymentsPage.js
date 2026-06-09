import React, { useState, useEffect, useRef } from 'react';
import {
  Eye, Edit2, Trash2, Download, DollarSign, IndianRupee, Settings, GripVertical,
  ChevronUp, ChevronDown, ChevronsUpDown, Link2, RefreshCw,
  CreditCard, CheckCircle, AlertCircle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import GroupProjectFilter from './../components/Dropdowns/GroupProjectFilter.js';
import FilterSelect from './../components/Dropdowns/FilterSelect.js';
import useGroupProjectFilters from './../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import ConfirmationModal from '../components/ConfirmationModal';
import filterApi from '../services/filterApi';
import '../pages-css/BillsVendorPayments.css';

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
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a', '#fcd34d':'#5a4714',};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6','#0b1220':'#e7ecf3',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258','#f59e0b':'#f5b945',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0891b2':'#22d3ee','#1e3a8a':'#7fb0f0',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3', '#0369a1':'#38bdf8', '#4c1d95':'#a78bfa',};
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
const _VP_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _VP_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── VPDatePicker — compact single date (same style as PO Create Modal) ────────
const VPDatePicker = ({ value, onChange, placeholder = 'Select date' }) => {
  useThemeVersion();
  const [show,    setShow]    = React.useState(false);
  const [calMo,   setCalMo]   = React.useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth());
  const [calYr,   setCalYr]   = React.useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear());
  const [showYrP, setShowYrP] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);
  const open = () => { if(value){setCalMo(parseInt(value.slice(5,7))-1);setCalYr(parseInt(value.slice(0,4)));} setShowYrP(false); setShow(true); };
  const DIM=new Date(calYr,calMo+1,0).getDate(), FD=new Date(calYr,calMo,1).getDay(), tod=new Date().toISOString().slice(0,10);
  const fmtD=d=>{ if(!d) return null; const[y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };
  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%'}}>
      <button type="button" className={`po-dtp-trigger${show?' po-dtp--open':''}${value?' po-dtp--set':''}`} onClick={show?()=>setShow(false):open} style={{width:'100%'}}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0,color:value?__stc('#4f46e5'):__stc('#94a3b8')}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        {value?<span style={{flex:1,fontSize:13,fontWeight:600,color:__stc('#0f172a')}}>{fmtD(value)}</span>:<span className="po-dtp-ph">{placeholder}</span>}
        {value?<span className="po-dtp-x" onClick={e=>{e.stopPropagation();onChange('');}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>
        :<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginLeft:'auto',color:__stc('#94a3b8'),transform:show?'rotate(180deg)':'none',transition:'transform .2s',flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>}
      </button>
      {show&&(
        <div className="po-dtp-dropdown" style={{position:'absolute',top:'calc(100% + 4px)',left:0,width:280,zIndex:1050}}>
          <div className="po-dtp-cal-head">
            <button type="button" className="po-cal-nav" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
            <button type="button" className="po-dtp-month" onClick={()=>setShowYrP(p=>!p)}>{_VP_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span></button>
            <button type="button" className="po-cal-nav" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
          </div>
          {showYrP?(<div className="po-yr-grid">{Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return<div key={yr} className={`po-yr-cell${yr===calYr?' po-yr-sel':''}`} onClick={()=>{setCalYr(yr);setShowYrP(false);}}>{yr}</div>;})}</div>):(
          <div className="po-dtp-grid">
            {_VP_DAYS.map(d=><div key={d} className="po-cal-dl">{d}</div>)}
            {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
            {Array.from({length:DIM}).map((_,i)=>{const dy=i+1,ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;let cls='po-cal-cell';if(ds===value)cls+=' po-dtp-sel';else if(ds===tod)cls+=' po-cal-today';return<div key={ds} className={cls} onClick={()=>{onChange(ds);setShow(false);}}>{dy}</div>;})}
          </div>)}
        </div>
      )}
    </div>
  );
};

// ── VPDateRangeFilter — date range picker (same style as PO page filter bar) ──
const VPDateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  useThemeVersion();
  const [show,setShow]=React.useState(false),[from,setFrom]=React.useState(null),[to,setTo]=React.useState(null),[hover,setHover]=React.useState(null);
  const [calMo,setCalMo]=React.useState(new Date().getMonth()),[calYr,setCalYr]=React.useState(new Date().getFullYear()),[showYr,setShowYr]=React.useState(false);
  const ref=React.useRef(null);
  React.useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);}; if(show)document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h);},[show]);
  const DIM=new Date(calYr,calMo+1,0).getDate(),FD=new Date(calYr,calMo,1).getDay(),tod=new Date().toISOString().slice(0,10);
  const inR=d=>{const hi=to||(from&&hover?hover:null);if(!from||!hi)return false;const[a,b]=from<=hi?[from,hi]:[hi,from];return d>a&&d<b;};
  const clickDay=d=>{if(!from||(from&&to)){setFrom(d);setTo(null);}else if(d<from){setFrom(d);setTo(null);}else if(d===from){setFrom(null);setTo(null);}else setTo(d);};
  const fmt=d=>{if(!d)return'';const[y,m,dy]=d.split('-');return`${dy}-${m}-${y}`;};
  const handleApply=()=>{if(!from)return;onApply(from,to||from);setShow(false);};
  const handleClear=()=>{setFrom(null);setTo(null);setHover(null);onClear();setShow(false);};
  return(
    <div ref={ref} style={{position:'relative',display:'inline-flex'}}>
      <button type="button" className={`po-cal-trigger${show?' po-cal--open':''}${appliedFrom?' po-cal--applied':''}`} onClick={()=>setShow(p=>!p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span className={appliedFrom?'po-cal-val':'po-cal-ph'}>{appliedFrom?fmt(appliedFrom):'dd-mm-yyyy'}</span>
        <span className="po-cal-sep">—</span>
        <span className={appliedTo&&appliedTo!==appliedFrom?'po-cal-val':'po-cal-ph'}>{appliedTo&&appliedTo!==appliedFrom?fmt(appliedTo):'dd-mm-yyyy'}</span>
        {appliedFrom&&<span className="po-cal-x" onClick={e=>{e.stopPropagation();handleClear();}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginLeft:'auto',color:__stc('#94a3b8'),flexShrink:0,transform:show?'rotate(180deg)':'none',transition:'transform .2s'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {show&&(
        <div className="po-cal-dropdown" style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:9999,width:264}}>
          <div className="po-cal-head">
            <button type="button" className="po-cal-nav" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg></button>
            <button type="button" className="po-cal-month-btn" onClick={()=>setShowYr(p=>!p)}>{_VP_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span></button>
            <button type="button" className="po-cal-nav" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg></button>
          </div>
          {showYr?(<div className="po-yr-grid">{Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return<div key={yr} className={`po-yr-cell${yr===calYr?' po-yr-sel':''}`} onClick={()=>{setCalYr(yr);setShowYr(false);}}>{yr}</div>;})}</div>):(
          <div className="po-cal-grid">
            {_VP_DAYS.map(d=><div key={d} className="po-cal-dl">{d}</div>)}
            {Array.from({length:FD}).map((_,i)=><div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
            {Array.from({length:DIM}).map((_,i)=>{const dy=i+1,ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`,dow=(FD+i)%7;let cls='po-cal-cell';if(ds===from)cls+=' po-cal-from';else if(ds===to)cls+=' po-cal-to';else if(inR(ds)){cls+=' po-cal-in-range';if(dow===0)cls+=' po-cal-rr-s';if(dow===6)cls+=' po-cal-rr-e';}if(ds===tod&&ds!==from&&ds!==to)cls+=' po-cal-today';return<div key={ds} className={cls} onClick={()=>clickDay(ds)} onMouseEnter={()=>from&&!to&&setHover(ds)} onMouseLeave={()=>setHover(null)}>{dy}</div>;})}
          </div>)}
          <div className="po-cal-footer">
            <div className="po-cal-chips">
              <span className={`po-cal-chip${from?' po-cal-chip--set':''}`}>{from?fmt(from):'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
              <span className={`po-cal-chip${to?' po-cal-chip--set':''}`}>{to?fmt(to):'To —'}</span>
            </div>
            <div style={{display:'flex',gap:6,justifyContent:'center',width:'100%'}}>
              {(from||appliedFrom)&&<button type="button" className="po-cal-clear" onClick={handleClear}>Clear</button>}
              <button type="button" className="po-cal-clear" onClick={()=>setShow(false)}>Cancel</button>
              <button type="button" className="po-cal-apply" onClick={handleApply} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── inline confirmation hook ──────────────────────────────────────────────────
const useConfirmationModal = () => {
  const [confirmModal, setConfirmModal] = useState({
    show:false, title:'', message:'', type:'confirm',
    onConfirm:null, onCancel:null, confirmText:'Confirm', cancelText:'Cancel', showCancel:true
  });
  const showConfirmation = (cfg) => new Promise((resolve) => {
    setConfirmModal({
      show:true, title:cfg.title||'Confirm', message:cfg.message||'',
      type:cfg.type||'confirm', confirmText:cfg.confirmText||'Confirm',
      cancelText:cfg.cancelText||'Cancel', showCancel:cfg.showCancel!==undefined?cfg.showCancel:true,
      onConfirm:()=>{setConfirmModal(p=>({...p,show:false}));resolve(true);},
      onCancel: ()=>{setConfirmModal(p=>({...p,show:false}));resolve(false);}
    });
  });
  return { confirmModal, showConfirmation };
};

// ── columns ───────────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { id:'advanceNo',   label:'Payment No',    visible:true  },
  { id:'advanceDate', label:'Payment Date',  visible:true  },
  { id:'vendor',      label:'Vendor',        visible:true  },
  { id:'paymentType', label:'Type',          visible:true  },
  { id:'amount',      label:'Amount',        visible:true  },
  { id:'applied',     label:'Applied',       visible:true  },
  { id:'unapplied',   label:'Unapplied',     visible:true  },
  { id:'paymentMode', label:'Payment Mode',  visible:true  },
  { id:'reference',   label:'Reference',     visible:true  },
  { id:'group',       label:'Group',         visible:false },
  { id:'category',    label:'Category',      visible:false },
  { id:'project',     label:'Project',       visible:false },
  { id:'actions',     label:'Actions',       visible:true, fixed:true }
];
const SORTABLE = new Set(['advanceNo','advanceDate','vendor','paymentType','amount','applied','unapplied','paymentMode','reference']);

const SortIcon = ({ columnId, sortConfig }) => {
  if (sortConfig.key !== columnId) return <ChevronsUpDown size={13} style={{opacity:0.4,marginLeft:4,verticalAlign:'middle'}}/>;
  return sortConfig.direction === 'asc'
    ? <ChevronUp   size={13} style={{marginLeft:4,verticalAlign:'middle',color:__stc('#7c3aed')}}/>
    : <ChevronDown size={13} style={{marginLeft:4,verticalAlign:'middle',color:__stc('#7c3aed')}}/>;
};

export default function VendorPaymentsPage() {
  useThemeVersion();
  const [advances, setAdvances] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const { confirmModal, showConfirmation } = useConfirmationModal();

  // columns
  const VP_COL_VERSION = 'v2';
  const [columns, setColumns] = useState(() => {
    try {
      const s = localStorage.getItem('vendorPaymentsColumns');
      const v = localStorage.getItem('vendorPaymentsColumnsVersion');
      if (s && v === VP_COL_VERSION) {
        const parsed = JSON.parse(s);
        const savedIds = new Set(parsed.map(c => c.id));
        const merged = [...parsed];
        ALL_COLUMNS.forEach(col => { if (!savedIds.has(col.id)) merged.push(col); });
        return merged;
      }
      return ALL_COLUMNS;
    } catch { return ALL_COLUMNS; }
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // sort
  const [sortConfig, setSortConfig] = useState({ key:null, direction:'asc' });

  // table drag
  const [draggedColIndex, setDraggedColIndex] = useState(null);

  // filters
  const [filters, setFilters] = useState({ search:'', paymentType:'all' });

  // ── Payment date range filter ─────────────────────────────────────────────
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo,   setPaymentDateTo]   = useState('');

  // pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages]   = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  // stats
  const [stats, setStats] = useState(null);

  // view modal
  const [selectedAdvance, setSelectedAdvance]           = useState(null);
  const [showViewModal, setShowViewModal]               = useState(false);
  const [viewAllocationDetails, setViewAllocationDetails] = useState([]);
  const [loadingViewAllocations, setLoadingViewAllocations] = useState(false);
  const [viewBillDetails, setViewBillDetails]           = useState(null);
  const [editBillInfo, setEditBillInfo]                  = useState(null);

  // create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [formData, setFormData] = useState({
    vendorId:'', billId:null, paymentType:'ADVANCE',
    advanceDate: new Date().toISOString().split('T')[0],
    amount:0, paymentMode:'Bank Transfer', transactionReference:'', notes:'',
    projectId:'', groupId:'', subGroupId:''
  });

  // adjust advance (allocate to bills)
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData]           = useState({ advanceId:null, vendorId:null, availableAmount:0, billAllocations:[] });

  // edit modal
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [editFormData, setEditFormData]     = useState({});
  // vendor change in edit modal (ADVANCE only)
  const [editVendorId, setEditVendorId]     = useState('');
  const [editVendors, setEditVendors]       = useState([]);

  // edit project change
  const [showEditProjectPanel, setShowEditProjectPanel]       = useState(false);
  const [editProjectGroups, setEditProjectGroups]             = useState([]);
  const [editProjectSubs, setEditProjectSubs]                 = useState([]);
  const [editProjectList, setEditProjectList]                 = useState([]);
  const [editProjectGroupName, setEditProjectGroupName]       = useState('');
  const [editProjectSubGroupName, setEditProjectSubGroupName] = useState('');
  const [editProjectId, setEditProjectId]                     = useState('');
  const [editProjectLoading, setEditProjectLoading]           = useState({ groups:false, subs:false, projects:false });

  // deleted view
  const [showDeleted, setShowDeleted]   = useState(false);
  const [deletedList, setDeletedList]   = useState([]);

  // modal dropdowns
  const [modalGroups, setModalGroups]         = useState([]);
  const [modalSubGroups, setModalSubGroups]   = useState([]);
  const [modalProjects, setModalProjects]     = useState([]);
  const [modalGroupName, setModalGroupName]   = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId]   = useState('');
  const [mdlLoading, setMdlLoading]           = useState({ groups:false, subGroups:false, projects:false });

  useEffect(()=>{ 
    localStorage.setItem('vendorPaymentsColumns', JSON.stringify(columns)); 
    localStorage.setItem('vendorPaymentsColumnsVersion', VP_COL_VERSION);
  },[columns]);

  // ── Fetch advances — AbortController cancels stale in-flight requests ───
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const isDateFiltered = !!(paymentDateFrom || paymentDateTo);
        const p = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'advanceDate', sortDirection: isDateFiltered ? 'ASC' : 'DESC' });
        if (groupName)    p.append('groupId',    groupName);
        if (subGroupName) p.append('subGroupId', subGroupName);
        if (projectId)    p.append('projectId',  projectId);
        if (filters.paymentType !== 'all') p.append('paymentType', filters.paymentType);
        if (filters.search) p.append('searchTerm', filters.search);
        if (paymentDateFrom) p.append('paymentDateFrom', paymentDateFrom);
        if (paymentDateTo)   p.append('paymentDateTo',   paymentDateTo);
        const res = await fetch(`${API_BASE_URL}/vendor-advances?${p}`, {
          credentials: 'include', headers: getAuthHeaders(), signal: controller.signal
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        setAdvances(d.advances || []); setProjectNames(d.projectNames || {}); setTotalPages(d.totalPages || 0); setTotalElements(d.totalElements || 0);
      } catch (error) {
        if (error.name === 'AbortError') return;
        showError('Failed to load payments');
        setAdvances([]);
      } finally { setLoading(false); }
    };
    load();
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.paymentType, filters.search, refreshKey, paymentDateFrom, paymentDateTo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ fetchStats(); },[groupName,subGroupName,projectId,filters.paymentType,filters.search,paymentDateFrom,paymentDateTo]);

  // Reset to page 1 whenever group/project filters change
  useEffect(() => {
    setCurrentPage(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, subGroupName, projectId]);

  const fetchAdvances = () => { setRefreshKey(prev => prev + 1); };

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id':   user?.id   || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

  // ── sort ───────────────────────────────────────────────────────────────────
  const sortedAdvances = React.useMemo(() => {
    if (!sortConfig.key) return advances;
    return [...advances].sort((a,b) => {
      let av, bv;
      switch(sortConfig.key){
        case 'advanceNo':   av=a.advanceNo||'';           bv=b.advanceNo||'';           break;
        case 'advanceDate': av=new Date(a.advanceDate||0); bv=new Date(b.advanceDate||0); break;
        case 'vendor':      av=a.vendorName||'';          bv=b.vendorName||'';          break;
        case 'paymentType': av=a.paymentType||'';         bv=b.paymentType||'';         break;
        case 'amount':      av=parseFloat(a.amount)||0;   bv=parseFloat(b.amount)||0;   break;
        case 'applied':     av=parseFloat(a.appliedAmount)||0;   bv=parseFloat(b.appliedAmount)||0;   break;
        case 'unapplied':   av=parseFloat(a.unappliedAmount)||0; bv=parseFloat(b.unappliedAmount)||0; break;
        case 'paymentMode': av=a.paymentMode||'';         bv=b.paymentMode||'';         break;
        case 'reference':   av=a.transactionReference||''; bv=b.transactionReference||''; break;
        default: return 0;
      }
      if(av<bv) return sortConfig.direction==='asc'?-1:1;
      if(av>bv) return sortConfig.direction==='asc'? 1:-1;
      return 0;
    });
  },[advances,sortConfig]);

  const handleSort = (col) => {
    if(!SORTABLE.has(col)) return;
    setSortConfig(p=>({key:col,direction:p.key===col&&p.direction==='asc'?'desc':'asc'}));
  };

  // ── table drag ────────────────────────────────────────────────────────────
  const handleColDragStart = (e,i) => { setDraggedColIndex(i); e.dataTransfer.effectAllowed='move'; };
  const handleColDragOver  = (e)   => { e.preventDefault(); };
  const handleColDrop = (e,i) => {
    e.preventDefault();
    if(draggedColIndex===null||draggedColIndex===i){setDraggedColIndex(null);return;}
    const vis=[...columns.filter(c=>c.visible)], hid=columns.filter(c=>!c.visible);
    const [m]=vis.splice(draggedColIndex,1); vis.splice(i,0,m);
    setColumns([...vis,...hid]); setDraggedColIndex(null);
  };

  const fetchStats = async () => {
    try {
      const p=new URLSearchParams();
      if(groupName)   p.append('groupId',   groupName);
      if(subGroupName)p.append('subGroupId',subGroupName);
      if(projectId)   p.append('projectId', projectId);
      // Active filters — so KPIs reflect exactly what's visible in the table
      if(filters.paymentType && filters.paymentType!=='all') p.append('paymentType', filters.paymentType);
      if(filters.search && filters.search.trim()) p.append('searchTerm', filters.search.trim());
      if(paymentDateFrom) p.append('paymentDateFrom', paymentDateFrom);
      if(paymentDateTo)   p.append('paymentDateTo',   paymentDateTo);
      const res=await fetch(`${API_BASE_URL}/vendor-advances/summary?${p}`,{credentials:'include',headers:getAuthHeaders()});
      if(res.ok) setStats(await res.json());
    } catch {}
  };

  const fetchVendorsForProject = async (projId, grpId, subGrpId) => {
    try {
      const p = new URLSearchParams();
      if (projId)   p.append('projectId',  projId);
      if (grpId)    p.append('groupName',   grpId);
      if (subGrpId) p.append('subGroupName',subGrpId);
      const res = await fetch(`${API_BASE_URL}/vendors/for-bills?${p}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setVendors(d || []); }
      else setVendors([]);
    } catch { setVendors([]); }
  };

  const fetchUnpaidBillsForVendor = async (vendorId, projectId) => {
    if(!vendorId){setUnpaidBills([]);return;}
    setLoadingBills(true);
    try{
      // ── Uses the dedicated /vendor-advances/payable-bills endpoint ──────────
      // This endpoint is isolated from the Bills Received page — changes to the
      // bills listing page will NEVER affect this modal's bill picker.
      // It returns Pending + Partially Paid bills for this vendor + project.
      const projectFilter = projectId ? `&projectId=${encodeURIComponent(projectId)}` : '';
      const res=await fetch(`${API_BASE_URL}/vendor-advances/payable-bills?vendorId=${vendorId}${projectFilter}`,{credentials:'include',headers:getAuthHeaders()});
      if(!res.ok) throw new Error();
      const bills=await res.json();
      setUnpaidBills(bills||[]);
    } catch { setUnpaidBills([]); }
    finally { setLoadingBills(false); }
  };

  // DEAD CODE REMOVED — the old two-fetch approach that called /bills twice
  // (once for Pending, once for Partially Paid) was replaced by the single
  // dedicated endpoint above. Keeping a stub here for reference only.
  const _fetchUnpaidBills_OLD_REMOVED = async (vendorId, projectId) => {
    // Old approach used GET /bills?vendorId=X&status=Pending which shared the
    // Bills Received page endpoint. Replaced with /vendor-advances/payable-bills.
    const d2=null;
    if(false){
      const res2=null;
      const d=null;
      void res2; void d; void d2;
      setUnpaidBills([...(d||[]),(d2||[])]);
    }
  };


  const fetchModalGroups = async () => {
    setMdlLoading(p=>({...p,groups:true}));
    try{setModalGroups(await filterApi.getAllGroups()||[]);}catch{setModalGroups([]);}
    finally{setMdlLoading(p=>({...p,groups:false}));}
  };
  const fetchModalSubGroups = async (gn) => {
    if(!gn){setModalSubGroups([]);setModalProjects([]);return;}
    setMdlLoading(p=>({...p,subGroups:true}));
    try{setModalSubGroups(await filterApi.getSubGroups(gn)||[]);}catch{setModalSubGroups([]);}
    finally{setMdlLoading(p=>({...p,subGroups:false}));}
  };
  const fetchModalProjects = async (gn,sg) => {
    if(!gn||!sg){setModalProjects([]);return;}
    setMdlLoading(p=>({...p,projects:true}));
    try{setModalProjects(await filterApi.getProjects(gn,sg)||[]);}catch{setModalProjects([]);}
    finally{setMdlLoading(p=>({...p,projects:false}));}
  };

  // ── edit project helpers ──────────────────────────────────────────────────
  const fetchEditProjectGroups = async () => {
    setEditProjectLoading(p=>({...p,groups:true}));
    try { setEditProjectGroups(await filterApi.getAllGroups()||[]); } catch { setEditProjectGroups([]); }
    finally { setEditProjectLoading(p=>({...p,groups:false})); }
  };
  const fetchEditProjectSubs = async (g) => {
    if(!g){setEditProjectSubs([]);setEditProjectList([]);return;}
    setEditProjectLoading(p=>({...p,subs:true}));
    try { setEditProjectSubs(await filterApi.getSubGroups(g)||[]); } catch { setEditProjectSubs([]); }
    finally { setEditProjectLoading(p=>({...p,subs:false})); }
  };
  const fetchEditProjectList = async (g,sg) => {
    if(!g||!sg){setEditProjectList([]);return;}
    setEditProjectLoading(p=>({...p,projects:true}));
    try { setEditProjectList(await filterApi.getProjects(g,sg)||[]); } catch { setEditProjectList([]); }
    finally { setEditProjectLoading(p=>({...p,projects:false})); }
  };

  // ── view ─────────────────────────────────────────────────────────────────
  const handleViewAdvance = async (adv) => {
    setSelectedAdvance(adv);
    setViewAllocationDetails([]);
    setViewBillDetails(null);
    setShowViewModal(true);

    if(adv.paymentType==='ADVANCE' && parseFloat(adv.appliedAmount)>0){
      setLoadingViewAllocations(true);
      try{
        const res=await fetch(`${API_BASE_URL}/vendor-advances/${adv.id}/allocations`,{credentials:'include',headers:getAuthHeaders()});
        if(res.ok) setViewAllocationDetails(await res.json());
      } catch {}
      finally{setLoadingViewAllocations(false);}
    }
    if(adv.paymentType==='BILL_PAYMENT' && adv.billId){
      try{
        const res=await fetch(`${API_BASE_URL}/bills/${adv.billId}`,{credentials:'include',headers:getAuthHeaders()});
        if(res.ok) setViewBillDetails(await res.json());
      } catch {}
    }
  };

  // ── create ────────────────────────────────────────────────────────────────
  const handleCreateNew = () => {
    // Pre-seed from page-level header filters
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    const seedProject  = projectId   || '';
    setFormData({vendorId:'',billId:null,paymentType:'ADVANCE',advanceDate:new Date().toISOString().split('T')[0],amount:0,paymentMode:'Bank Transfer',transactionReference:'',notes:'',projectId:seedProject,groupId:seedGroup,subGroupId:seedSubGroup});
    setModalGroupName(seedGroup); setModalSubGroupName(seedSubGroup); setModalProjectId(seedProject);
    if (seedGroup) {
      fetchModalSubGroups(seedGroup).then ? fetchModalSubGroups(seedGroup) : Promise.resolve();
      if (seedSubGroup) fetchModalProjects(seedGroup, seedSubGroup);
      if (seedProject) { setVendors([]); fetchVendorsForProject(seedProject, seedGroup, seedSubGroup); }
    }
    setVendors([]); setUnpaidBills([]);
    fetchModalGroups();
    setShowCreateModal(true);
  };

  const handleVendorChange = (vendorId) => {
    setFormData(f=>({...f,vendorId,billId:null}));
    // Always pass projectId so bills are scoped to this vendor + project
    if(formData.paymentType==='BILL_PAYMENT') fetchUnpaidBillsForVendor(vendorId, formData.projectId);
  };

  const handlePaymentTypeChange = (type) => {
    setFormData(f=>({...f,paymentType:type,billId:null}));
    if(type==='BILL_PAYMENT'&&formData.vendorId) fetchUnpaidBillsForVendor(formData.vendorId, formData.projectId);
  };

  const handleSaveAdvance = async () => {
    if(!formData.vendorId){showWarning('Please select a vendor');return;}
    const parsedAdvAmount = parseFloat(formData.amount);
    if(!parsedAdvAmount||parsedAdvAmount<=0){showWarning('Amount must be greater than zero');return;}
    if(formData.paymentType==='BILL_PAYMENT'&&!formData.billId){showWarning('Please select a bill');return;}
    // Validate against bill balance for BILL_PAYMENT
    if(formData.paymentType==='BILL_PAYMENT'&&formData.billId){
      const selectedBill = unpaidBills.find(b=>b.id===formData.billId);
      if(selectedBill){
        const billBalance = parseFloat(selectedBill.balanceAmount||0);
        if(parsedAdvAmount > billBalance + 0.005){
          showWarning(`Amount cannot exceed ${fmtFull(billBalance)}`);
          return;
        }
      }
    }
    setLoading(true);
    try{
      const res=await fetch(`${API_BASE_URL}/vendor-advances`,{
        credentials:'include',method:'POST',
        headers:{'Content-Type':'application/json',...getAuthHeaders()},
        body:JSON.stringify({...formData,amount:parsedAdvAmount,billId:formData.paymentType==='BILL_PAYMENT'?formData.billId:null})
      });
      if(!res.ok){const e=await res.json();throw new Error(e.message||'Failed');}
      showSuccess('Payment recorded successfully!');
      setShowCreateModal(false); fetchAdvances(); fetchStats();
    } catch(err){showError(err.message);}
    finally{setLoading(false);}
  };

  // ── adjust / allocate advance to bills ────────────────────────────────────
  const handleAdjustAdvance = async (adv) => {
    setSelectedAdvance(adv);
    setAdjustData({advanceId:adv.id,vendorId:adv.vendorId,availableAmount:parseFloat(adv.unappliedAmount||0),billAllocations:[]});
    // Scope bills to the same vendor AND same project as the advance
    await fetchUnpaidBillsForVendor(adv.vendorId, adv.projectId);
    setShowAdjustModal(true);
  };

  const handleAllocationChange = (billId, value) => {
    const amount = value===''?0:parseFloat(value);
    if(isNaN(amount)||amount<0) return;
    const bill = unpaidBills.find(b=>b.id===billId);
    if(!bill) return;
    if(amount>parseFloat(bill.balanceAmount)){showWarning(`Cannot exceed bill balance of ${fmt(bill.balanceAmount)}`);return;}
    const others = adjustData.billAllocations.filter(a=>a.billId!==billId).reduce((s,a)=>s+parseFloat(a.amount||0),0);
    if(others+amount>adjustData.availableAmount){showWarning('Exceeds available advance amount');return;}
    let arr=[...adjustData.billAllocations];
    const idx=arr.findIndex(a=>a.billId===billId);
    if(amount===0){if(idx>=0) arr.splice(idx,1);}
    else{if(idx>=0) arr[idx]={billId,amount};else arr.push({billId,amount});}
    setAdjustData(d=>({...d,billAllocations:arr}));
  };

  const handleSaveAdjustment = async () => {
    const allocations=adjustData.billAllocations.filter(a=>a.amount>0);
    if(!allocations.length){showWarning('Please allocate to at least one bill');return;}
    setLoading(true);
    try{
      const res=await fetch(`${API_BASE_URL}/vendor-advances/${adjustData.advanceId}/allocate`,{
        credentials:'include',method:'POST',
        headers:{'Content-Type':'application/json',...getAuthHeaders()},
        body:JSON.stringify({allocations:allocations.map(a=>({billId:a.billId,amount:parseFloat(a.amount)}))})
      });
      if(!res.ok){const e=await res.json();throw new Error(e.message||'Failed');}
      showSuccess('Advance allocated successfully!');
      setShowAdjustModal(false); fetchAdvances(); fetchStats();
    } catch(err){showError(err.message);}
    finally{setLoading(false);}
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (adv) => {
    const hasAlloc = adv.paymentType==='ADVANCE' && parseFloat(adv.appliedAmount)>0;
    const confirmed = await showConfirmation({
      title:'Delete Payment',type:'alert',confirmText:'Delete',
      message:`Delete payment ${adv.advanceNo}?\nAmount: ${fmt(adv.amount)}\nType: ${adv.paymentType}${hasAlloc?`\n\n⚠ Warning: ${fmt(adv.appliedAmount)} already applied to bills — will be reversed.`:''}\n\nNote: Soft delete, can be restored.`
    });
    if(!confirmed) return;
    setLoading(true);
    try{
      const res=await fetch(`${API_BASE_URL}/vendor-advances/${adv.id}`,{credentials:'include',method:'DELETE',headers:getAuthHeaders()});
      if(!res.ok){const e=await res.json();throw new Error(e.message);}
      showSuccess('Payment deleted!'); fetchAdvances(); fetchStats();
    } catch(err){showError(err.message);}
    finally{setLoading(false);}
  };

  // ── edit ──────────────────────────────────────────────────────────────────
  const handleEditClick = async (adv) => {
    setEditingAdvance(adv);
    setEditBillInfo(null);
    setEditFormData({advanceDate:adv.advanceDate,amount:adv.amount,paymentMode:adv.paymentMode||'Bank Transfer',transactionReference:adv.transactionReference||'',notes:adv.notes||'',});
    setEditProjectGroupName(adv.groupId||'');
    setEditProjectSubGroupName(adv.subGroupId||'');
    setEditProjectId(adv.projectId||'');
    setEditVendorId(String(adv.vendorId||''));
    setEditVendors([]);
    setEditProjectGroups([]); setEditProjectSubs([]); setEditProjectList([]);
    setShowEditModal(true);
    // For BILL_PAYMENT: fetch the linked bill so we can show bill info and max amount in the edit form
    if(adv.paymentType==='BILL_PAYMENT' && adv.billId){
      try {
        const res = await fetch(`${API_BASE_URL}/bills/${adv.billId}`,{credentials:'include',headers:getAuthHeaders()});
        if(res.ok) setEditBillInfo(await res.json());
      } catch{}
    }
    // Only load project dropdowns for ADVANCE type — BILL_PAYMENT project is locked
    if(adv.paymentType==='ADVANCE'){
      const groups = await filterApi.getAllGroups();
      setEditProjectGroups(groups||[]);
      if(adv.groupId){
        const subs = await filterApi.getSubGroups(adv.groupId);
        setEditProjectSubs(subs||[]);
        if(adv.subGroupId){
          const projects = await filterApi.getProjects(adv.groupId, adv.subGroupId);
          setEditProjectList(projects||[]);
        }
      }
      // Load vendor list so user can change the vendor on an ADVANCE
      if(adv.projectId){
        try{
          const p=new URLSearchParams();
          p.append('projectId',adv.projectId);
          if(adv.groupId)    p.append('groupName',   adv.groupId);
          if(adv.subGroupId) p.append('subGroupName',adv.subGroupId);
          const res=await fetch(`${API_BASE_URL}/vendors/for-bills?${p}`,{credentials:'include',headers:getAuthHeaders()});
          if(res.ok){const d=await res.json();setEditVendors(d||[]);}
        } catch{setEditVendors([]);}
      }
    }
  };

  const handleSaveEdit = async () => {
    const parsedAmount = parseFloat(editFormData.amount);
    if(!parsedAmount || parsedAmount<=0){showWarning('Amount must be greater than zero');return;}

    const originalAdv = editingAdvance;
    const isBillPayment = originalAdv.paymentType === 'BILL_PAYMENT';

    if(isBillPayment && editBillInfo){
      const restoredBalance = parseFloat(editBillInfo.balanceAmount||0) + parseFloat(originalAdv.amount||0);
      if(parsedAmount > restoredBalance + 0.005){
        showWarning(`Amount cannot exceed ${fmtFull(restoredBalance)} (bill balance + your existing payment)`);
        return;
      }
    }

    if(!isBillPayment){
      if(!editProjectGroupName){showWarning('Please select a group');return;}
      if(!editProjectId){showWarning('Please select a project');return;}
    }

    const projectChanged = !isBillPayment && (
      editProjectGroupName !== (originalAdv.groupId||'')
      || editProjectSubGroupName !== (originalAdv.subGroupId||'')
      || editProjectId !== (originalAdv.projectId||'')
    );

    const vendorChanged = !isBillPayment && editVendorId && editVendorId !== String(originalAdv.vendorId||'');

    // Build confirmation message with vendor/project change warnings
    let confirmMsg = `Save changes to ${originalAdv.advanceNo}?`;
    const hasAllocs = parseFloat(originalAdv.appliedAmount) > 0;
    if(vendorChanged || projectChanged){
      const parts = [];
      if(vendorChanged) parts.push(`Vendor reassignment to a different vendor`);
      if(projectChanged) parts.push(`Project reassignment:\nFrom: ${originalAdv.projectId||'—'}\nTo:   ${editProjectId}`);
      confirmMsg = parts.join('\n') + '\n\n'
        + (hasAllocs ? `⚠ ${fmt(originalAdv.appliedAmount)} allocated to bills will be REVERSED.\n\n` : '')
        + 'Confirm and save?';
    }

    const confirmed = await showConfirmation({
      title: (vendorChanged||projectChanged) ? 'Confirm Changes & Save' : 'Update Payment',
      type: 'confirm',
      confirmText: (vendorChanged||projectChanged) ? 'Yes, Reverse & Save' : 'Save Changes',
      message: confirmMsg
    });
    if(!confirmed) return;

    setLoading(true);
    try{
      const res=await fetch(`${API_BASE_URL}/vendor-advances/${originalAdv.id}`,{
        credentials:'include',method:'PUT',
        headers:{'Content-Type':'application/json',...getAuthHeaders()},
        body:JSON.stringify({
          ...editFormData,
          // Pass new vendorId for ADVANCE so backend can reverse allocations if changed
          vendorId: isBillPayment ? originalAdv.vendorId : (editVendorId || originalAdv.vendorId),
          paymentType:originalAdv.paymentType,
          billId:originalAdv.billId,
          projectId: isBillPayment ? originalAdv.projectId : editProjectId,
          groupId:   isBillPayment ? originalAdv.groupId   : editProjectGroupName,
          subGroupId:isBillPayment ? originalAdv.subGroupId: editProjectSubGroupName,
          amount:parsedAmount
        })
      });
      if(!res.ok){const e=await res.json();throw new Error(e.message);}
      showSuccess(vendorChanged
        ? 'Vendor reassigned. Bill allocations have been reversed.'
        : projectChanged
        ? 'Advance reassigned. Bill allocations have been reversed.'
        : 'Payment updated!');
      setShowEditModal(false); setShowEditProjectPanel(false);
      fetchAdvances(); fetchStats();
    } catch(err){showError(err.message);}
    finally{setLoading(false);}
  };

  // ── restore deleted ───────────────────────────────────────────────────────
  const fetchDeletedList = async () => {
    setLoading(true);
    try{
      const res=await fetch(`${API_BASE_URL}/vendor-advances/deleted`,{credentials:'include',headers:getAuthHeaders()});
      if(res.ok) setDeletedList(await res.json());
    } catch{}
    finally{setLoading(false);}
  };

  const handleRestore = async (id) => {
    const confirmed=await showConfirmation({title:'Restore Payment',type:'confirm',confirmText:'Restore',message:'Restore this payment?'});
    if(!confirmed) return;
    setLoading(true);
    try{
      const res=await fetch(`${API_BASE_URL}/vendor-advances/${id}/restore`,{credentials:'include',method:'POST',headers:getAuthHeaders()});
      if(!res.ok) throw new Error('Failed');
      showSuccess('Restored!'); fetchDeletedList(); fetchAdvances(); fetchStats();
    } catch{showError('Failed to restore');}
    finally{setLoading(false);}
  };

  // ── column manager ────────────────────────────────────────────────────────
  const handleColumnToggle=(id)=>setColumns(columns.map(c=>c.id===id?{...c,visible:!c.visible}:c));
  const handleColumnDragEnd=(result)=>{
    if(!result.destination) return;
    const items=Array.from(columns);
    const [r]=items.splice(result.source.index,1);
    items.splice(result.destination.index,0,r);
    setColumns(items);
  };
  const resetColumns=()=>{setColumns(ALL_COLUMNS);localStorage.removeItem('vendorPaymentsColumns');localStorage.removeItem('vendorPaymentsColumnsVersion');};

  // ── formatters ────────────────────────────────────────────────────────────
  const fmt  =(n)=>{const v=parseFloat(n)||0;return `₹${v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;};
  // fmtFull: shows up to 10 significant decimal places, stripping trailing zeros
  // Used wherever we display a max/limit so the user knows the exact cap.
  const fmtFull=(n)=>{
    const v=parseFloat(n)||0;
    // Format with enough decimals then strip trailing zeros after decimal point
    const s=v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:10});
    return `₹${s}`;
  };
  const fmtD =(d)=>{if(!d)return'';const s=String(d);if(s.length>=10&&s[4]==='-'){const[y,m,dy]=s.slice(0,10).split('-');return`${dy}-${m}-${y}`;}const dt=new Date(d);return`${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;};
  const fmtDT=(d)=>{if(!d)return'';const s=String(d);let dd,mm,yy;if(s.length>=10&&s[4]==='-'){const[y,m,dy]=s.slice(0,10).split('-');dd=dy;mm=m;yy=y;}else{const dt=new Date(d);dd=String(dt.getDate()).padStart(2,'0');mm=String(dt.getMonth()+1).padStart(2,'0');yy=dt.getFullYear();}const t=new Date(d);return`${dd}-${mm}-${yy} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;};

  const TYPE_BADGE = { 'ADVANCE':'vp-type-advance', 'BILL_PAYMENT':'vp-type-bill' };

  // ── render column ─────────────────────────────────────────────────────────
  const renderCell = (col, adv) => {
    const dash = <span style={{color:__stc('#94a3b8'),display:'block',textAlign:'center'}}>—</span>;
    switch(col.id){
      case 'advanceNo':   return <td className="vp-advance-no">{adv.advanceNo || dash}</td>;
      case 'advanceDate': return <td>{adv.advanceDate ? fmtD(adv.advanceDate) : dash}</td>;
      case 'vendor':      return <td>{adv.vendorName || dash}</td>;
      case 'paymentType': return <td><span className={`vp-badge ${TYPE_BADGE[adv.paymentType]||''}`}>{adv.paymentType==='ADVANCE'?'Advance':'Bill Payment'}</span></td>;
      case 'amount':      return <td className="vp-amount">{adv.amount != null ? fmt(adv.amount) : dash}</td>;
      case 'applied':     return <td className="text-success">{adv.appliedAmount != null ? fmt(adv.appliedAmount) : dash}</td>;
      case 'unapplied':   return <td className="text-warning">{adv.unappliedAmount != null ? fmt(adv.unappliedAmount) : dash}</td>;
      case 'paymentMode': return <td>{adv.paymentMode || dash}</td>;
      case 'reference':   return <td>{adv.transactionReference || dash}</td>;
      case 'group':       return <td>{adv.groupName || dash}</td>;
      case 'category':    return <td>{adv.category || dash}</td>;
      case 'project': {
        const pName = projectNames[adv.projectId];
        return (
          <td style={{ minWidth: 180 }}>
            {adv.projectId ? (
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontWeight:600, fontSize:12, color:__stc('#1e293b'), whiteSpace:'nowrap' }}>
                  {pName || adv.projectId}
                </span>
                {pName && (
                  <span style={{ fontSize:11, color:__stc('#64748b'), fontWeight:400, whiteSpace:'nowrap' }}>
                    {adv.projectId}
                  </span>
                )}
              </div>
            ) : dash}
          </td>
        );
      }
      case 'actions':     return (
        <td>
          <div className="receipt-action-buttons">
            <button className="receipt-action-btn btn-view"   onClick={()=>handleViewAdvance(adv)} title="View"><Eye size={16}/></button>
            <button className="receipt-action-btn btn-edit"   onClick={()=>handleEditClick(adv)}   title="Edit"><Edit2 size={16}/></button>
            {adv.paymentType==='ADVANCE'&&parseFloat(adv.unappliedAmount)>0&&(
              <button className="receipt-action-btn btn-adjust" onClick={()=>handleAdjustAdvance(adv)} title="Allocate to Bill"><IndianRupee size={16}/></button>
            )}
            <button className="receipt-action-btn btn-delete" onClick={()=>handleDelete(adv)} title="Delete"><Trash2 size={16}/></button>
          </div>
        </td>
      );
      default: return <td>—</td>;
    }
  };

  const visibleColumns = columns.filter(c=>c.visible);

  return (
    <div className="receipts-page-container">
      {loading && <CrmPreloader text="Loading..."/>}
      <ToastContainer toasts={toasts} removeToast={removeToast}/>
      <ConfirmationModal {...confirmModal}/>

      <div className="receipts-page-breadcrumb">
        <span>Pages</span><span className="receipts-page-separator">{'>'}</span>
        <span className="receipts-page-current">Vendor Payments</span>
      </div>

      <div className="page-header-with-filter">
        <h1 className="receipts-page-title">Vendor Payments ({totalElements})</h1>
        <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters}/>
      </div>

      {/* Action bar */}
      <div className="receipts-page-action-bar">
        <div className="receipts-page-search-filters">
          <div style={{ position: 'relative', flex: 1, minWidth: 200, display: 'flex' }}>
            <input type="text" className="receipts-page-search" placeholder="Search by Advance No, Vendor Name..."
              style={{ flex: 1, paddingRight: filters.search ? 30 : 12 }}
              value={filters.search} onChange={e=>{setFilters(f=>({...f,search:e.target.value}));setCurrentPage(0);}}/>
            {filters.search && (
              <button type="button"
                onClick={()=>{setFilters(f=>({...f,search:''}));setCurrentPage(0);}}
                className="search-clear-btn"
                title="Clear search">
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          <div className="bills-filter-select-wrap">
            <FilterSelect
              value={filters.paymentType === 'all' ? '' : filters.paymentType}
              options={[
                { value: 'ADVANCE',      label: 'Advance'      },
                { value: 'BILL_PAYMENT', label: 'Bill Payment' },
              ]}
              placeholder="All Types"
              onChange={v => { setFilters(f => ({...f, paymentType: v || 'all'})); setCurrentPage(0); }}
            />
          </div>
          {/* Payment date range filter */}
          <div className="po-order-date-filter">
            <span className="po-order-date-label">Payment Date:</span>
            <VPDateRangeFilter
              appliedFrom={paymentDateFrom}
              appliedTo={paymentDateTo}
              onApply={(f,t)=>{ setPaymentDateFrom(f); setPaymentDateTo(t); setCurrentPage(0); }}
              onClear={()=>{ setPaymentDateFrom(''); setPaymentDateTo(''); setCurrentPage(0); }}
            />
          </div>
        </div>
        <div className="receipts-page-actions">
          <button className="receipts-page-btn-secondary" onClick={()=>{if(!showDeleted)fetchDeletedList();setShowDeleted(!showDeleted);}}>
            <Trash2 size={16} style={{marginRight:8}}/>{showDeleted?'Hide Deleted':'View Deleted'}
          </button>
          <button className="receipts-page-btn-secondary" onClick={()=>setShowColumnManager(!showColumnManager)}>
            <Settings size={16} style={{marginRight:8}}/>Columns
          </button>
          <button className="receipts-page-btn-primary" onClick={handleCreateNew}>+ Record Payment</button>
        </div>
      </div>

      {/* Column manager */}
      {showColumnManager&&(
        <div className="column-manager-modal">
          <div className="column-manager-content">
            <div className="column-manager-header"><h3>Manage Columns</h3><button onClick={()=>setShowColumnManager(false)}>×</button></div>
            <div className="column-manager-body">
              <DragDropContext onDragEnd={handleColumnDragEnd}>
                <Droppable droppableId="vpCols">
                  {(provided)=>(
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {columns.map((col,idx)=>(
                        <Draggable key={col.id} draggableId={col.id} index={idx} isDragDisabled={col.fixed}>
                          {(p)=>(
                            <div ref={p.innerRef} {...p.draggableProps} className="column-item">
                              <div className="column-item-left">
                                {!col.fixed&&<div {...p.dragHandleProps} className="drag-handle"><GripVertical size={16}/></div>}
                                <input type="checkbox" checked={col.visible} onChange={()=>handleColumnToggle(col.id)} disabled={col.fixed}/>
                                <span>{col.label}</span>
                              </div>
                              {col.fixed&&<span className="fixed-badge">Fixed</span>}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
            <div className="column-manager-footer">
              <button onClick={resetColumns} className="receipts-page-btn-secondary">Reset</button>
              <button onClick={()=>setShowColumnManager(false)} className="receipts-page-btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats — same card structure as Bills tab for consistent dimensions */}
      {stats&&(
        <div className="unified-kpi-grid">
          <div className="unified-kpi-card">
            <div className="unified-kpi-icon unified-kpi-icon--blue"><CreditCard size={26}/></div>
            <div className="unified-kpi-content">
              <div className="unified-kpi-value">{stats.totalAdvances||0}</div>
              <div className="unified-kpi-label">Total Payments</div>
            </div>
          </div>
          <div className="unified-kpi-card">
            <div className="unified-kpi-icon unified-kpi-icon--purple"><IndianRupee size={26}/></div>
            <div className="unified-kpi-content">
              <div className="unified-kpi-value">{fmt(stats.totalAmount)}</div>
              <div className="unified-kpi-label">Total Amount</div>
            </div>
          </div>
          <div className="unified-kpi-card">
            <div className="unified-kpi-icon unified-kpi-icon--green"><CheckCircle size={26}/></div>
            <div className="unified-kpi-content">
              <div className="unified-kpi-value text-success">{fmt(stats.appliedAmount)}</div>
              <div className="unified-kpi-label">Applied</div>
            </div>
          </div>
          <div className="unified-kpi-card">
            <div className="unified-kpi-icon unified-kpi-icon--amber"><AlertCircle size={26}/></div>
            <div className="unified-kpi-content">
              <div className="unified-kpi-value text-warning">{fmt(stats.unappliedAmount)}</div>
              <div className="unified-kpi-label">Unapplied</div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="receipts-page-table-container">
        <div className="receipts-page-table-scroll">
          <table className="receipts-page-table">
            <thead>
              <tr>
                {visibleColumns.map((col,idx)=>(
                  <th key={col.id} draggable={!col.fixed}
                    onDragStart={e=>handleColDragStart(e,idx)} onDragOver={handleColDragOver} onDrop={e=>handleColDrop(e,idx)}
                    onClick={()=>handleSort(col.id)}>
                    {!col.fixed&&<GripVertical size={12} style={{opacity:0.3,marginRight:4}}/>}
                    {col.label}
                    {SORTABLE.has(col.id)&&<SortIcon columnId={col.id} sortConfig={sortConfig}/>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAdvances.length===0?(
                <tr><td colSpan={visibleColumns.length} className="empty-state">No payments found</td></tr>
              ):sortedAdvances.map(adv=>(
                <tr key={adv.id}>
                  {visibleColumns.map(col=><React.Fragment key={col.id}>{renderCell(col,adv)}</React.Fragment>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="receipts-page-pagination">
          <div className="receipts-page-pagination-info">
            Showing {totalElements === 0 ? 0 : currentPage*pageSize+1} to {Math.min((currentPage+1)*pageSize,totalElements)} of {totalElements}
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
          <div className="pagination-controls">
            <button onClick={()=>setCurrentPage(0)} disabled={currentPage===0} className="procurement-bills-received-btn-secondary" title="First Page">«</button>
            <button onClick={()=>setCurrentPage(p=>Math.max(p-1,0))} disabled={currentPage===0} className="procurement-bills-received-btn-secondary">Previous</button>
            <span className="page-numbers">
              {[...Array(Math.min(5,totalPages))].map((_,i)=>{
                const pn = currentPage<3 ? i : currentPage+i-2;
                if(pn>=0&&pn<totalPages){
                  return (
                    <button key={pn} onClick={()=>setCurrentPage(pn)}
                      className={`page-number${pn===currentPage?' active':''}`}
                    >{pn+1}</button>
                  );
                }
                return null;
              })}
            </span>
            <button onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages-1))} disabled={currentPage>=totalPages-1} className="procurement-bills-received-btn-secondary">Next</button>
            <button onClick={()=>setCurrentPage(totalPages-1)} disabled={currentPage>=totalPages-1} className="procurement-bills-received-btn-secondary" title="Last Page">»</button>
          </div>
        </div>
      </div>

      {/* Deleted section */}
      {showDeleted&&(
        <div className="deleted-receipts-section">
          <div className="deleted-receipts-header"><h3>Deleted Payments</h3><button className="receipts-page-btn-secondary" onClick={()=>setShowDeleted(false)}>Close</button></div>
          <table className="receipts-page-table">
            <thead><tr><th>No</th><th>Date</th><th>Vendor</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {deletedList.length===0?<tr><td colSpan={6} className="empty-state">No deleted payments</td></tr>
               :deletedList.map(a=>(
                <tr key={a.id} className="deleted-row">
                  <td>{a.advanceNo}</td><td>{fmtD(a.advanceDate)}</td><td>{a.vendorId}</td>
                  <td><span className={`vp-badge ${TYPE_BADGE[a.paymentType]||''}`}>{a.paymentType==='ADVANCE'?'Advance':'Bill Payment'}</span></td>
                  <td>{fmt(a.amount)}</td>
                  <td><button className="receipt-action-btn btn-restore" onClick={()=>handleRestore(a.id)}>Restore</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VIEW MODAL ─────────────────────────────────────────────────────── */}
      {showViewModal&&selectedAdvance&&(
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Payment Details — {selectedAdvance.advanceNo}</h2>
              <button className="receipts-page-modal-close" onClick={()=>setShowViewModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipt-view">
                <div className="receipt-meta">
                  <div className="receipt-meta-item"><strong>Date:</strong> {fmtD(selectedAdvance.advanceDate)}</div>
                  <div className="receipt-meta-item"><strong>Vendor:</strong> {selectedAdvance.vendorName}</div>
                  <div className="receipt-meta-item"><strong>Type:</strong>
                    <span className={`vp-badge ${TYPE_BADGE[selectedAdvance.paymentType]||''}`} style={{marginLeft:6}}>
                      {selectedAdvance.paymentType==='ADVANCE'?'Advance':'Bill Payment'}
                    </span>
                  </div>
                </div>
                <div className="receipt-details">
                  <div className="receipt-detail-row"><span>Payment Mode:</span><strong>{selectedAdvance.paymentMode||'—'}</strong></div>
                  <div className="receipt-detail-row"><span>Transaction Ref:</span><strong>{selectedAdvance.transactionReference||'—'}</strong></div>

                  {selectedAdvance.notes&&<div className="receipt-detail-row"><span>Notes:</span><strong>{selectedAdvance.notes}</strong></div>}
                </div>
                <div className="receipt-amounts">
                  <div className="receipt-amount-row"><span>Total Amount:</span><span className="amount-value">{fmt(selectedAdvance.amount)}</span></div>
                  <div className="receipt-amount-row"><span>Applied Amount:</span><span className="amount-value text-success">{fmt(selectedAdvance.appliedAmount)}</span></div>
                  <div className="receipt-amount-row"><span>Unapplied Amount:</span><span className="amount-value text-warning">{fmt(selectedAdvance.unappliedAmount)}</span></div>
                </div>

                {/* ADVANCE → show bills it was allocated to */}
                {selectedAdvance.paymentType==='ADVANCE'&&(
                  <div style={{marginTop:20}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                      <Link2 size={16} color="#7c3aed"/>
                      <strong style={{fontSize:14,color:__stc('#4c1d95')}}>Advance Adjusted Against Bills</strong>
                      {!loadingViewAllocations&&(
                        <span style={{background:__sbg('#ede9fe'),color:__stc('#6d28d9'),fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99}}>
                          {viewAllocationDetails.length} bill{viewAllocationDetails.length!==1?'s':''}
                        </span>
                      )}
                    </div>
                    {loadingViewAllocations&&(
                      <div style={{background:__sbg('#f5f3ff'),border:`1px solid ${__sbg('#ddd6fe')}`,borderRadius:10,padding:20,textAlign:'center',color:__stc('#7c3aed'),fontSize:13}}>Loading...</div>
                    )}
                    {!loadingViewAllocations&&viewAllocationDetails.length===0&&(
                      <div style={{background:__sbg('#f8fafc'),border:`1px dashed ${__sbg('#cbd5e1')}`,borderRadius:10,padding:18,textAlign:'center',color:__stc('#94a3b8'),fontSize:13}}>
                        This advance has not been allocated to any bill yet.
                      </div>
                    )}
                    {!loadingViewAllocations&&viewAllocationDetails.length>0&&(
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        {viewAllocationDetails.map((alloc,idx)=>(
                          <div key={alloc.allocationId||idx} style={{background:__sbg('#f5f3ff'),border:`1px solid ${__sbg('#ddd6fe')}`,borderLeft:`4px solid ${__sbg('#7c3aed')}`,borderRadius:10,padding:'14px 16px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px 16px'}}>
                            <div>
                              <div style={{fontSize:11,color:__stc('#6b7280'),fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Bill</div>
                              <div style={{fontSize:14,fontWeight:700,color:__stc('#1e293b')}}>{alloc.billNo}</div>
                              <div style={{marginTop:4}}>
                                <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:99,background:__sbg('#ede9fe'),color:__stc('#6d28d9')}}>{alloc.billStatus}</span>
                              </div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:__stc('#6b7280'),fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Allocated</div>
                              <div style={{fontSize:16,fontWeight:700,color:__stc('#7c3aed')}}>{fmt(alloc.allocatedAmount)}</div>
                            </div>
                            <div>
                              <div style={{fontSize:11,color:__stc('#6b7280'),fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Bill Total</div>
                              <div style={{fontSize:13,color:__stc('#374151')}}>{fmt(alloc.billTotalAmount)}</div>
                              <div style={{fontSize:11,color:__stc('#dc2626'),marginTop:2}}>Balance: {fmt(alloc.billBalance)}</div>
                            </div>
                            <div style={{gridColumn:'1/-1',borderTop:`1px solid ${__sbg('#ddd6fe')}`,paddingTop:8,display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:11,color:__stc('#6b7280')}}>Allocated on:</span>
                              <span style={{fontSize:12,color:__stc('#374151'),fontWeight:500}}>{fmtDT(alloc.allocationDate)}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{background:__sbg('#ede9fe'),border:`1px solid ${__sbg('#c4b5fd')}`,borderRadius:8,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontSize:13,color:__stc('#4c1d95'),fontWeight:600}}>Total Allocated across {viewAllocationDetails.length} bill{viewAllocationDetails.length!==1?'s':''}</span>
                          <span style={{fontSize:15,fontWeight:700,color:__stc('#7c3aed')}}>{fmt(viewAllocationDetails.reduce((s,a)=>s+parseFloat(a.allocatedAmount||0),0))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BILL_PAYMENT → show linked bill details */}
                {selectedAdvance.paymentType==='BILL_PAYMENT'&&selectedAdvance.billId&&(
                  <div style={{marginTop:20}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                      <Link2 size={16} color="#3b82f6"/>
                      <strong style={{fontSize:14,color:__stc('#1e3a8a')}}>Applied to Bill</strong>
                      <span style={{background:__sbg('#dbeafe'),color:__stc('#1e40af'),fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99}}>1 bill</span>
                    </div>
                    <div style={{background:__sbg('#eff6ff'),border:`1px solid ${__sbg('#bfdbfe')}`,borderLeft:`4px solid ${__sbg('#3b82f6')}`,borderRadius:10,padding:'14px 16px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px 16px'}}>
                      <div>
                        <div style={{fontSize:11,color:__stc('#6b7280'),fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Bill</div>
                        <div style={{fontSize:14,fontWeight:700,color:__stc('#1e293b')}}>{viewBillDetails?.billNo||`Bill #${selectedAdvance.billId}`}</div>
                        {viewBillDetails&&<div style={{marginTop:4}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:99,background:__sbg('#dbeafe'),color:__stc('#1e40af')}}>{viewBillDetails.status}</span></div>}
                      </div>
                      <div>
                        <div style={{fontSize:11,color:__stc('#6b7280'),fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Applied</div>
                        <div style={{fontSize:16,fontWeight:700,color:__stc('#3b82f6')}}>{fmt(selectedAdvance.amount)}</div>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:__stc('#6b7280'),fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Bill Total</div>
                        <div style={{fontSize:13,color:__stc('#374151')}}>{viewBillDetails?fmt(viewBillDetails.totalAmount):'—'}</div>
                        <div style={{fontSize:11,color:__stc('#dc2626'),marginTop:2}}>Balance: {viewBillDetails?fmt(viewBillDetails.balanceAmount):'—'}</div>
                      </div>
                      <div style={{gridColumn:'1/-1',borderTop:`1px solid ${__sbg('#bfdbfe')}`,paddingTop:8,display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:11,color:__stc('#6b7280')}}>Payment on:</span>
                        <span style={{fontSize:12,color:__stc('#374151'),fontWeight:500}}>{fmtD(selectedAdvance.advanceDate)}</span>
                      </div>
                    </div>
                    <div style={{background:__sbg('#eff6ff'),border:`1px solid ${__sbg('#93c5fd')}`,borderRadius:8,padding:'10px 16px',marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:13,color:__stc('#1e3a8a'),fontWeight:600}}>Total Applied to 1 bill</span>
                      <span style={{fontSize:15,fontWeight:700,color:__stc('#3b82f6')}}>{fmt(selectedAdvance.amount)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={()=>setShowViewModal(false)}>Close</button>
              {selectedAdvance.paymentType==='ADVANCE'&&parseFloat(selectedAdvance.unappliedAmount)>0&&(
                <button className="receipts-page-btn-primary" onClick={()=>{setShowViewModal(false);handleAdjustAdvance(selectedAdvance);}}>Allocate to Bill</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE MODAL ───────────────────────────────────────────────────── */}
      {showCreateModal&&(
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-xlarge">
            <div className="receipts-page-modal-header">
              <h2>Record Vendor Payment</h2>
              <button className="receipts-page-modal-close" onClick={()=>setShowCreateModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipts-page-form">

                {/* Payment type selection */}
                <div className="receipts-page-form-section">
                  <h3>Payment Type</h3>
                  <div className="receipt-type-selection">
                    <label className="receipt-type-option">
                      <input type="radio" name="paymentType" value="ADVANCE" checked={formData.paymentType==='ADVANCE'} onChange={e=>handlePaymentTypeChange(e.target.value)}/>
                      <div className="receipt-type-content"><strong>Record Advance Payment</strong><span>Pay vendor in advance before receiving a bill (e.g. mobilisation advance)</span></div>
                    </label>
                    <label className="receipt-type-option">
                      <input type="radio" name="paymentType" value="BILL_PAYMENT" checked={formData.paymentType==='BILL_PAYMENT'} onChange={e=>handlePaymentTypeChange(e.target.value)}/>
                      <div className="receipt-type-content"><strong>Payment Against Bill</strong><span>Pay against a specific existing bill</span></div>
                    </label>
                  </div>
                </div>

                {/* Project hierarchy */}
                <div className="receipts-page-form-section">
                  <h3>Project & Vendor</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Group</label>
                      <FilterSelect
                        value={modalGroupName}
                        options={modalGroups}
                        placeholder={mdlLoading.groups ? 'Loading...' : 'Select Group'}
                        disabled={mdlLoading.groups}
                        onChange={v => { const g=v||''; setModalGroupName(g); setFormData(f=>({...f,groupId:g,subGroupId:'',projectId:''})); if(g) fetchModalSubGroups(g); }}
                      />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Sub Group</label>
                      <FilterSelect
                        value={modalSubGroupName}
                        options={modalSubGroups}
                        placeholder={!modalGroupName ? 'Select Group First' : mdlLoading.subGroups ? 'Loading...' : 'Select Sub Group'}
                        disabled={!modalGroupName || mdlLoading.subGroups}
                        onChange={v => { const sg=v||''; setModalSubGroupName(sg); setFormData(f=>({...f,subGroupId:sg,projectId:''})); if(modalGroupName&&sg) fetchModalProjects(modalGroupName,sg); }}
                      />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Project</label>
                      <FilterSelect
                        value={modalProjectId}
                        options={modalProjects.map(p => ({ value: p.id, label: p.name }))}
                        placeholder={!modalSubGroupName ? 'Select Sub Group First' : mdlLoading.projects ? 'Loading...' : 'Select Project'}
                        disabled={!modalSubGroupName || mdlLoading.projects}
                        onChange={v => {
                          const pid = v || '';
                          setModalProjectId(pid);
                          setFormData(f=>({...f, projectId:pid, vendorId:'', billId:null}));
                          setVendors([]); setUnpaidBills([]);
                          if (pid) fetchVendorsForProject(pid, modalGroupName, modalSubGroupName);
                        }}
                        searchable={true}
                      />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Vendor *</label>
                      <FilterSelect
                        value={String(formData.vendorId||'')}
                        options={vendors
                          .filter(v => { const id=String(v.id||v.vendorId||''); return id && !id.startsWith('PO_'); })
                          .map(v => ({ value: String(v.id||v.vendorId), label: (v.name||v.vendorName)+(v.contact?` — ${v.contact}`:'') }))
                        }
                        placeholder={!modalProjectId ? 'Select a project first' : vendors.length===0 ? 'No vendors found' : 'Select Vendor'}
                        disabled={!modalProjectId}
                        onChange={v => handleVendorChange(v||'')}
                      />
                    </div>
                  </div>
                </div>

                {/* Bill selection for BILL_PAYMENT */}
                {formData.paymentType==='BILL_PAYMENT'&&formData.vendorId&&(
                  <div className="receipts-page-form-section">
                    <h3>Select Bill</h3>
                    {loadingBills?<div className="loading-state">Loading bills...</div>:unpaidBills.length>0?(
                      <div className="invoice-selection-list">
                        {unpaidBills.map(bill=>(
                          <label key={bill.id} className="invoice-selection-item">
                            <input type="radio" name="selectedBill" value={bill.id}
                              checked={formData.billId===bill.id}
                              onChange={()=>setFormData(f=>({...f,billId:bill.id,amount:String(parseFloat(bill.balanceAmount)||0)}))}/>
                            <div className="invoice-selection-content">
                              <div className="invoice-selection-header">
                                <strong>{bill.billNo}</strong>
                                <span className={`bill-badge ${bill.status==='Pending'?'bill-status-pending':'bill-status-partial'}`}>{bill.status}</span>
                              </div>
                              <div className="invoice-selection-details">
                                <span>Date: {fmtD(bill.billDate)}</span>
                                <span>Due: {fmtD(bill.dueDate)}</span>
                                <span>Total: {fmt(bill.totalAmount)}</span>
                                <span className="text-danger">Balance: {fmt(bill.balanceAmount)}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ):<div className="empty-state-small">No unpaid bills found for this vendor</div>}
                  </div>
                )}

                {/* Payment details */}
                <div className="receipts-page-form-section">
                  <h3>Payment Details</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Payment Date *</label>
                      <VPDatePicker value={formData.advanceDate} onChange={v=>setFormData(f=>({...f,advanceDate:v}))} placeholder="Select payment date"/>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Amount *</label>
                      <input type="number" value={formData.amount} step="0.01" placeholder="0.00"
                        onChange={e=>setFormData(f=>({...f,amount:parseFloat(e.target.value)}))}/>
                      {formData.paymentType==='BILL_PAYMENT'&&formData.billId&&(
                        <small style={{color:__stc('#64748b')}}>Max: {fmtFull(unpaidBills.find(b=>b.id===formData.billId)?.balanceAmount||0)}</small>
                      )}
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Payment Mode *</label>
                      <FilterSelect
                        value={formData.paymentMode || 'Bank Transfer'}
                        options={[
                          { value: 'Bank Transfer', label: 'Bank Transfer' },
                          { value: 'NEFT',          label: 'NEFT'          },
                          { value: 'RTGS',          label: 'RTGS'          },
                          { value: 'UPI',           label: 'UPI'           },
                          { value: 'Cheque',        label: 'Cheque'        },
                          { value: 'Cash',          label: 'Cash'          },
                        ]}
                        placeholder="Select Payment Mode"
                        onChange={v => setFormData(f => ({...f, paymentMode: v || 'Bank Transfer'}))}
                      />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Transaction Reference</label>
                      <input type="text" value={formData.transactionReference} placeholder="UTR / Cheque No / etc."
                        onChange={e=>setFormData(f=>({...f,transactionReference:e.target.value}))}/>
                    </div>
                    <div className="receipts-page-form-group receipts-page-form-group-full">
                      <label>Notes</label>
                      <textarea value={formData.notes} rows={3} placeholder="Additional notes..."
                        onChange={e=>setFormData(f=>({...f,notes:e.target.value}))}/>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={()=>setShowCreateModal(false)}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveAdvance}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALLOCATE ADVANCE MODAL ─────────────────────────────────────────── */}
      {showAdjustModal&&selectedAdvance&&(
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Allocate Advance — {selectedAdvance.advanceNo}</h2>
              <button className="receipts-page-modal-close" onClick={()=>setShowAdjustModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="adjustment-form">
                <div className="adjustment-info">
                  <div className="adjustment-info-card"><div className="adjustment-info-label">Available Advance</div><div className="adjustment-info-value">{fmt(adjustData.availableAmount)}</div></div>
                  <div className="adjustment-info-card"><div className="adjustment-info-label">Total Allocated</div><div className="adjustment-info-value">{fmt(adjustData.billAllocations.reduce((s,a)=>s+parseFloat(a.amount||0),0))}</div></div>
                  <div className="adjustment-info-card"><div className="adjustment-info-label">Remaining</div><div className="adjustment-info-value">{fmt(adjustData.availableAmount-adjustData.billAllocations.reduce((s,a)=>s+parseFloat(a.amount||0),0))}</div></div>
                </div>
                <div className="adjustment-section">
                  <h3>Apply to Bills</h3>
                  <p className="adjustment-hint">
                    Showing unpaid bills for <strong>{selectedAdvance.vendorName}</strong>
                    {selectedAdvance.projectId && <> under project <strong>{selectedAdvance.projectId}</strong></>}
                  </p>
                  {unpaidBills.length>0?(
                    <div className="invoice-adjustment-list">
                      {unpaidBills.map(bill=>{
                        const alloc=adjustData.billAllocations.find(a=>a.billId===bill.id);
                        const othersTotal=adjustData.billAllocations.filter(a=>a.billId!==bill.id).reduce((s,a)=>s+parseFloat(a.amount||0),0);
                        const max=Math.min(adjustData.availableAmount-othersTotal,parseFloat(bill.balanceAmount)||0);
                        return(
                          <div key={bill.id} className="invoice-adjustment-item">
                            <div className="invoice-adjustment-info">
                              <div className="invoice-adjustment-header">
                                <strong>{bill.billNo}</strong>
                                <span className={`bill-badge ${bill.status==='Pending'?'bill-status-pending':'bill-status-partial'}`}>{bill.status}</span>
                              </div>
                              <div className="invoice-adjustment-details">
                                <span>Date: {fmtD(bill.billDate)}</span>
                                <span>Total: {fmt(bill.totalAmount)}</span>
                                <span style={{color:__stc('#dc2626'),fontWeight:600}}>Balance: {fmt(bill.balanceAmount)}</span>
                              </div>
                            </div>
                            <div className="invoice-adjustment-input">
                              <label>Allocate Amount:</label>
                              <input type="number" step="0.01" min="0" max={max} placeholder="0.00"
                                value={alloc?.amount||''}
                                onChange={e=>handleAllocationChange(bill.id, e.target.value)}/>
                              <small>Max: {fmt(max)}</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ):<div className="empty-state-small">No outstanding bills found for this vendor{selectedAdvance.projectId ? ` under project ${selectedAdvance.projectId}` : ''}</div>}
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={()=>setShowAdjustModal(false)}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveAdjustment} disabled={!adjustData.billAllocations.length}>Save Allocation</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ─────────────────────────────────────────────────────── */}
      {showEditModal&&editingAdvance&&(
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Edit Payment — {editingAdvance.advanceNo}</h2>
              <button className="receipts-page-modal-close" onClick={()=>{setShowEditModal(false);setShowEditProjectPanel(false);}}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipts-page-form">

                {/* ── Project Assignment — ADVANCE only, locked for BILL_PAYMENT ── */}
                {editingAdvance.paymentType==='ADVANCE' ? (
                <div className="receipts-page-form-section" style={{background:__sbg('#f8fafc'),border:`1px solid ${__sbg('#e2e8f0')}`,borderRadius:8,padding:'16px'}}>
                  <div style={{fontSize:12,color:__stc('#6b7280'),fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12}}>
                    Project Assignment
                    {(editProjectGroupName!==(editingAdvance.groupId||'')||editProjectSubGroupName!==(editingAdvance.subGroupId||'')||editProjectId!==(editingAdvance.projectId||''))&&(
                      <span style={{marginLeft:10,background:__sbg('#fef3c7'),color:__stc('#92400e'),fontSize:11,padding:'2px 8px',borderRadius:99,fontWeight:700}}>⚠ Changed — will save on Update</span>
                    )}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Group *</label>
                      <FilterSelect
                        value={editProjectGroupName}
                        options={editProjectGroups}
                        placeholder={editProjectLoading.groups ? 'Loading groups…' : 'Select Group'}
                        disabled={editProjectLoading.groups}
                        onChange={v => {
                          const val = v || '';
                          setEditProjectGroupName(val);
                          setEditProjectSubGroupName('');
                          setEditProjectId('');
                          setEditProjectSubs([]);
                          setEditProjectList([]);
                          if(val) fetchEditProjectSubs(val);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Sub Group</label>
                      <FilterSelect
                        value={editProjectSubGroupName}
                        options={editProjectSubs}
                        placeholder={editProjectLoading.subs ? 'Loading…' : !editProjectGroupName ? 'Select Group first' : 'Select Sub Group'}
                        disabled={!editProjectGroupName || editProjectLoading.subs}
                        onChange={v => {
                          const val = v || '';
                          setEditProjectSubGroupName(val);
                          setEditProjectId('');
                          setEditProjectList([]);
                          if(editProjectGroupName && val) fetchEditProjectList(editProjectGroupName, val);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Project *</label>
                      <FilterSelect
                        value={editProjectId}
                        options={editProjectList.map(p => ({ value: p.id, label: p.name }))}
                        placeholder={editProjectLoading.projects ? 'Loading...' : !editProjectSubGroupName ? 'Select Sub Group first' : 'Select Project'}
                        disabled={!editProjectSubGroupName || editProjectLoading.projects}
                        onChange={v => {
                          const pid = v || '';
                          setEditProjectId(pid);
                          setEditVendorId(String(editingAdvance.vendorId||''));
                          setEditVendors([]);
                          if(pid){
                            // Reload vendors for the newly selected project
                            const p=new URLSearchParams();
                            p.append('projectId',pid);
                            if(editProjectGroupName)    p.append('groupName',   editProjectGroupName);
                            if(editProjectSubGroupName) p.append('subGroupName',editProjectSubGroupName);
                            fetch(`${API_BASE_URL}/vendors/for-bills?${p}`,{credentials:'include',headers:getAuthHeaders()})
                              .then(r=>r.ok?r.json():[]).then(d=>setEditVendors(d||[])).catch(()=>setEditVendors([]));
                          }
                        }}
                        searchable={true}
                      />
                    </div>
                  </div>
                  {(editProjectGroupName!==(editingAdvance.groupId||'')||editProjectSubGroupName!==(editingAdvance.subGroupId||'')||editProjectId!==(editingAdvance.projectId||''))&&parseFloat(editingAdvance.appliedAmount)>0&&(
                    <div style={{marginTop:10,padding:'8px 12px',background:__sbg('#fef9c3'),border:`1px solid ${__sbg('#fcd34d')}`,borderRadius:6,fontSize:12,color:__stc('#92400e')}}>
                      ⚠ This advance has <strong>{fmt(editingAdvance.appliedAmount)}</strong> already allocated to bills.
                      Changing the project will <strong>automatically reverse those allocations</strong> (subtract from bills) so the advance starts fresh under the new project.
                    </div>
                  )}
                  {editingAdvance.paymentType==='ADVANCE'&&parseFloat(editingAdvance.appliedAmount)>0&&
                   editProjectGroupName===(editingAdvance.groupId||'')&&editProjectId===(editingAdvance.projectId||'')&&(
                    <div style={{marginTop:10,padding:'8px 12px',background:__sbg('#fef3c7'),border:`1px solid ${__sbg('#fcd34d')}`,borderRadius:6,fontSize:12,color:__stc('#92400e')}}>
                      ⚠ {fmt(editingAdvance.appliedAmount)} already allocated to bills. Cannot reduce amount below this.
                    </div>
                  )}
                </div>
                ) : (
                <div className="receipts-page-form-section" style={{background:__sbg('#f8fafc'),border:`1px solid ${__sbg('#e2e8f0')}`,borderRadius:8,padding:'14px 16px'}}>
                  <div style={{fontSize:12,color:__stc('#6b7280'),fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Project Assignment</div>
                  <div style={{fontSize:14,fontWeight:600,color:__stc('#1e293b')}}>
                    {editingAdvance.groupId||'—'}
                    {editingAdvance.subGroupId?` › ${editingAdvance.subGroupId}`:''}
                    {editingAdvance.projectId?` › ${editingAdvance.projectId}`:''}
                  </div>
                  <div style={{marginTop:8,fontSize:12,color:__stc('#6b7280')}}>Project cannot be changed for Bill Payments.</div>
                </div>
                )}

                <div className="receipts-page-form-section">
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                    <h3 style={{margin:0}}>Payment Type:</h3>
                    <span className={`vp-badge ${TYPE_BADGE[editingAdvance.paymentType]||''}`}>{editingAdvance.paymentType==='ADVANCE'?'Advance Payment':'Bill Payment'}</span>
                  </div>

                  {/* Vendor change — ADVANCE only; locked for BILL_PAYMENT */}
                  {editingAdvance.paymentType==='ADVANCE'&&(
                    <div style={{marginTop:8}}>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Vendor *</label>
                      <FilterSelect
                        value={editVendorId}
                        options={[
                          // Current vendor always at the top, marked "(current)"
                          { value: String(editingAdvance.vendorId||''), label: (editingAdvance.vendorName||`Vendor #${editingAdvance.vendorId}`) + ' (current)' },
                          // Other vendors in the same project
                          ...editVendors
                            .filter(v => String(v.id||v.vendorId||'') !== String(editingAdvance.vendorId||''))
                            .map(v => ({ value: String(v.id||v.vendorId), label: (v.name||v.vendorName)+(v.contact?` — ${v.contact}`:'') }))
                        ]}
                        placeholder="Select Vendor"
                        onChange={v => setEditVendorId(v || String(editingAdvance.vendorId||''))}
                      />
                      {editVendorId && editVendorId !== String(editingAdvance.vendorId||'') && (
                        <div style={{marginTop:6,padding:'6px 10px',background:__sbg('#fef3c7'),border:`1px solid ${__sbg('#fcd34d')}`,borderRadius:6,fontSize:12,color:__stc('#92400e')}}>
                          ⚠ Vendor will change.
                          {parseFloat(editingAdvance.appliedAmount)>0 && ` ${fmt(editingAdvance.appliedAmount)} in bill allocations will be REVERSED.`}
                        </div>
                      )}
                    </div>
                  )}
                  {editingAdvance.paymentType==='BILL_PAYMENT'&&(
                    <div style={{marginTop:8,fontSize:13,color:__stc('#374151')}}>
                      <strong>Vendor:</strong> {editingAdvance.vendorName||`Vendor #${editingAdvance.vendorId}`}
                      <span style={{marginLeft:8,fontSize:11,color:__stc('#6b7280')}}>(locked for Bill Payments)</span>
                    </div>
                  )}
                </div>

                <div className="receipts-page-form-section">
                  <h3>Payment Details</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Payment Date *</label>
                      <VPDatePicker value={editFormData.advanceDate||''} onChange={v=>setEditFormData(f=>({...f,advanceDate:v}))} placeholder="Select payment date"/>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Amount *</label>
                      <input type="number" value={editFormData.amount||''} step="0.01"
                        min={editingAdvance.paymentType==='BILL_PAYMENT' ? 0.01 : (editingAdvance.appliedAmount||0)}
                        max={editingAdvance.paymentType==='BILL_PAYMENT' && editBillInfo
                          ? parseFloat(editBillInfo.totalAmount||0)
                          : undefined}
                        onChange={e=>setEditFormData(f=>({...f,amount:e.target.value===''?'':e.target.value}))}/>
                      {editingAdvance.paymentType==='BILL_PAYMENT' && editBillInfo && (
                        <div style={{marginTop:6,padding:'8px 10px',background:__sbg('#f0f9ff'),border:`1px solid ${__sbg('#bae6fd')}`,borderRadius:6,fontSize:12}}>
                          <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
                            <span style={{color:__stc('#0369a1')}}>Bill: <strong>{editBillInfo.billNo}</strong></span>
                            <span style={{color:__stc('#0369a1')}}>Total: <strong>{fmt(editBillInfo.totalAmount)}</strong></span>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:3}}>
                            <span style={{color:__stc('#15803d')}}>Paid: <strong>{fmt(editBillInfo.paidAmount)}</strong></span>
                            <span style={{color:parseFloat(editBillInfo.balanceAmount)>0?__stc('#dc2626'):__stc('#15803d'),fontWeight:600}}>
                              Balance: {fmt(editBillInfo.balanceAmount)}
                            </span>
                          </div>
                          <div style={{marginTop:4,color:__stc('#64748b'),fontSize:11}}>
                            Max you can enter: <strong>{fmtFull(parseFloat(editBillInfo.balanceAmount||0) + parseFloat(editingAdvance.amount||0))}</strong>
                            <span style={{marginLeft:4}}>(current balance + your existing payment)</span>
                          </div>
                        </div>
                      )}
                      {editingAdvance.paymentType==='ADVANCE' && parseFloat(editingAdvance.appliedAmount)>0 && (
                        <small style={{color:__stc('#92400e')}}>Min: {fmt(editingAdvance.appliedAmount)} (already allocated)</small>
                      )}
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Payment Mode *</label>
                      <FilterSelect
                        value={editFormData.paymentMode || 'Bank Transfer'}
                        options={[
                          { value: 'Bank Transfer', label: 'Bank Transfer' },
                          { value: 'NEFT',          label: 'NEFT'          },
                          { value: 'RTGS',          label: 'RTGS'          },
                          { value: 'UPI',           label: 'UPI'           },
                          { value: 'Cheque',        label: 'Cheque'        },
                          { value: 'Cash',          label: 'Cash'          },
                        ]}
                        placeholder="Select Payment Mode"
                        onChange={v => setEditFormData(f => ({...f, paymentMode: v || 'Bank Transfer'}))}
                      />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Transaction Reference</label>
                      <input type="text" value={editFormData.transactionReference||''} placeholder="UTR / Cheque No"
                        onChange={e=>setEditFormData(f=>({...f,transactionReference:e.target.value}))}/>
                    </div>
                    <div className="receipts-page-form-group receipts-page-form-group-full">
                      <label>Notes</label>
                      <textarea value={editFormData.notes||''} rows={3} onChange={e=>setEditFormData(f=>({...f,notes:e.target.value}))}/>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={()=>{setShowEditModal(false);setShowEditProjectPanel(false);}}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveEdit}>Update Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}