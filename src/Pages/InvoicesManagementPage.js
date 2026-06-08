// Old Invoices page
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Edit2, Trash2, DollarSign, Download, Send, ChevronUp, ChevronDown, Columns, GripVertical, Check, CheckCircle, Clock } from 'lucide-react';
import '../pages-css/Invoices.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import FilterSelect from "./../components/Dropdowns/FilterSelect.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import ConfirmationModal from '../components/ConfirmationModal';
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import filterApi from '../services/filterApi';
import UnitTypeDropdown from './../components/Dropdowns/Unittypedropdown.js';
import { normalizeUnit } from './../components/Dropdowns/unitUtils';
import { FaIndianRupeeSign } from "react-icons/fa6";
import * as XLSX from 'xlsx';

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
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a',
  '#c7d2fe':'#2e3566','#fcd34d':'#5a4714','#fef9f9':'#2b1d20','#fed7aa':'#4a2f1a',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6','#0b1220':'#e7ecf3',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#064e3b':'#6ee7b7','#4b7a5e':'#7fbf9b','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258','#f59e0b':'#f5b945',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0891b2':'#22d3ee','#1e3a8a':'#7fb0f0',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3',
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


/* ─── Shared calendar helpers ───────────────────────────────────────────────── */
const _INV_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _INV_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/* Simple date-only picker (replaces <input type="date">) */
const InvDatePicker = ({ value, onChange, placeholder = 'Select date', minDate }) => {
  useThemeVersion();
  const [show, setShow]     = useState(false);
  const [calMo, setCalMo]   = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth());
  const [calYr, setCalYr]   = useState(() => value ? parseInt(value.slice(0,4))   : new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const [pos, setPos]       = useState({ top:0, left:0 });
  const trigRef = useRef(null), dpRef = useRef(null);

  useEffect(() => {
    const h = e => { if (trigRef.current && !trigRef.current.contains(e.target) && dpRef.current && !dpRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const open = () => {
    if (value) { setCalMo(parseInt(value.slice(5,7))-1); setCalYr(parseInt(value.slice(0,4))); }
    if (trigRef.current) {
      const r = trigRef.current.getBoundingClientRect();
      const dH = 310; const up = window.innerHeight - r.bottom < dH && r.top > dH;
      setPos({ top: up ? r.top - dH - 4 : r.bottom + 4, left: r.left });
    }
    setShow(true);
  };

  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);
  const fmtD = d => { if (!d) return null; const [y,m,dy] = d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <>
      <button ref={trigRef} type="button"
        onClick={show ? () => setShow(false) : open}
        style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'9px 10px', border:`1px solid ${show?__sbg('#4f46e5'):__sbg('#d1d5db')}`, borderRadius:6, background: value?__sbg('#f5f3ff'):__sbg('#fff'), cursor:'pointer', fontSize:13, textAlign:'left' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0,color:value?__stc('#4f46e5'):__stc('#9ca3af')}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        {value ? <span style={{flex:1,fontWeight:600,color:__stc('#0f172a')}}>{fmtD(value)}</span> : <span style={{flex:1,color:__stc('#9ca3af')}}>{placeholder}</span>}
        {value && <span onClick={e=>{e.stopPropagation();onChange('');}} style={{color:__stc('#9ca3af'),cursor:'pointer',lineHeight:1}}>×</span>}
      </button>
      {show && (
        <div ref={dpRef} style={{position:'fixed',top:pos.top,left:pos.left,zIndex:9999,background:__sbg('#fff'),border:`1px solid ${__sbg('#e2e8f0')}`,borderRadius:10,boxShadow:'0 8px 30px rgba(0,0,0,.12)',padding:14,minWidth:260}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <button type="button" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>‹</button>
            <button type="button" onClick={()=>setShowYr(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:__stc('#1e293b')}}>{_INV_MONTHS[calMo]} {calYr}</button>
            <button type="button" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>›</button>
          </div>
          {showYr ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
              {Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return(<div key={yr} onClick={()=>{setCalYr(yr);setShowYr(false);}} style={{textAlign:'center',padding:'4px 0',borderRadius:4,cursor:'pointer',fontWeight:yr===calYr?700:400,background:yr===calYr?__sbg('#4f46e5'):__sbg('transparent'),color:yr===calYr?__stc('#fff'):__stc('#1e293b'),fontSize:12}}>{yr}</div>);})}
            </div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
              {_INV_DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:__stc('#94a3b8'),padding:'2px 0'}}>{d}</div>)}
              {Array.from({length:FD}).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:DIM}).map((_,i)=>{
                const dy=i+1, ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const isSel=ds===value, isToday=ds===tod, isMin=minDate&&ds<minDate;
                return(<div key={ds} onClick={()=>{if(!isMin){onChange(ds);setShow(false);}}} style={{textAlign:'center',padding:'6px 0',cursor:isMin?'not-allowed':'pointer',borderRadius:4,background:isSel?__sbg('#4f46e5'):__sbg('transparent'),color:isSel?__stc('#fff'):isToday?__stc('#4f46e5'):isMin?__stc('#d1d5db'):__stc('#1e293b'),fontWeight:isSel||isToday?700:400,fontSize:12,opacity:isMin?.4:1}}>{dy}</div>);
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};

/* Date range picker (same style as Clients page) */
const InvDateRangePicker = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  useThemeVersion();
  const [show,  setShow]  = useState(false);
  const [from,  setFrom]  = useState(null);
  const [to,    setTo]    = useState(null);
  const [hover, setHover] = useState(null);
  const [calMo, setCalMo] = useState(new Date().getMonth());
  const [calYr, setCalYr] = useState(new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};
    if(show)document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[show]);
  const DIM=new Date(calYr,calMo+1,0).getDate(),FD=new Date(calYr,calMo,1).getDay(),tod=new Date().toISOString().slice(0,10);
  const inR=d=>{const hi=to||(from&&hover?hover:null);if(!from||!hi)return false;const[a,b]=from<=hi?[from,hi]:[hi,from];return d>a&&d<b;};
  const clickDay=d=>{if(!from||(from&&to)){setFrom(d);setTo(null);}else if(d<from){setFrom(d);setTo(null);}else if(d===from){setFrom(null);setTo(null);}else setTo(d);};
  const fmt=d=>{if(!d)return'dd-mm-yyyy';const[y,m,dy]=d.split('-');return`${dy}-${m}-${y}`;};
  return(
    <div ref={ref} style={{position:'relative',display:'inline-flex'}}>
      <button type="button" onClick={()=>setShow(p=>!p)}
        style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',border:`1px solid ${appliedFrom?__sbg('#c7d2fe'):__sbg('#e2e8f0')}`,borderRadius:6,background:appliedFrom?__sbg('#f5f3ff'):__sbg('#fff'),cursor:'pointer',fontSize:12,whiteSpace:'nowrap',height:38,boxSizing:'border-box'}}
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span style={{fontSize:11,color:__stc('#94a3b8')}}>FROM</span>
        <span style={{fontWeight:appliedFrom?600:400,color:appliedFrom?__stc('#1e293b'):__stc('#94a3b8')}}>{fmt(appliedFrom)}</span>
        <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
        <span style={{fontSize:11,color:__stc('#94a3b8')}}>TO</span>
        <span style={{fontWeight:appliedTo?600:400,color:appliedTo?__stc('#1e293b'):__stc('#94a3b8')}}>{fmt(appliedTo)}</span>
        {appliedFrom&&<span onClick={e=>{e.stopPropagation();setFrom(null);setTo(null);onClear();}} style={{marginLeft:2,color:__stc('#94a3b8'),cursor:'pointer',lineHeight:1}}>×</span>}
      </button>
      {show&&(
        <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:9999,background:__sbg('#fff'),border:`1px solid ${__sbg('#e2e8f0')}`,borderRadius:10,boxShadow:'0 8px 30px rgba(0,0,0,.12)',padding:16,minWidth:280}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <button type="button" onClick={()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>‹</button>
            <button type="button" onClick={()=>setShowYr(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:__stc('#1e293b')}}>{_INV_MONTHS[calMo]} {calYr}</button>
            <button type="button" onClick={()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>›</button>
          </div>
          {showYr?(
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:10}}>
              {Array.from({length:16},(_,i)=>{const yr=new Date().getFullYear()-4+i;return(<div key={yr} onClick={()=>{setCalYr(yr);setShowYr(false);}} style={{textAlign:'center',padding:'4px 0',borderRadius:4,cursor:'pointer',fontWeight:yr===calYr?700:400,background:yr===calYr?__sbg('#4f46e5'):__sbg('transparent'),color:yr===calYr?__stc('#fff'):__stc('#1e293b'),fontSize:12}}>{yr}</div>);})}
            </div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:8}}>
              {_INV_DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:__stc('#94a3b8'),padding:'2px 0'}}>{d}</div>)}
              {Array.from({length:FD}).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:DIM}).map((_,i)=>{
                const dy=i+1,ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`,dow=(FD+i)%7;
                let bg = __sbg('transparent'),color = __stc('#1e293b'),br=4;
                if(ds===from||ds===to){bg = __sbg('#4f46e5');color = __stc('#fff');}
                else if(inR(ds)){bg = __sbg('#e0e7ff');color = __stc('#3730a3');if(dow===0)br='4px 0 0 4px';if(dow===6)br='0 4px 4px 0';}
                else if(ds===tod)color = __stc('#4f46e5');
                return(<div key={ds} onClick={()=>clickDay(ds)} onMouseEnter={()=>from&&!to&&setHover(ds)} onMouseLeave={()=>setHover(null)} style={{textAlign:'center',padding:'5px 0',cursor:'pointer',borderRadius:br,background:bg,color,fontSize:12,fontWeight:ds===from||ds===to?700:400}}>{dy}</div>);
              })}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,flexWrap:'wrap'}}>
            <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:from?__sbg('#e0e7ff'):__sbg('#f1f5f9'),color:from?__stc('#3730a3'):__stc('#94a3b8'),fontWeight:from?600:400}}>{from?fmt(from):'From —'}</span>
            <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
            <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:to?__sbg('#e0e7ff'):__sbg('#f1f5f9'),color:to?__stc('#3730a3'):__stc('#94a3b8'),fontWeight:to?600:400}}>{to?fmt(to):'To —'}</span>
          </div>
          <div style={{display:'flex',gap:6,justifyContent:'center'}}>
            {(from||appliedFrom)&&<button type="button" onClick={()=>{setFrom(null);setTo(null);onClear();setShow(false);}} style={{flex:1,padding:'6px 0',border:`1px solid ${__sbg('#e2e8f0')}`,borderRadius:6,background:__sbg('#fff'),cursor:'pointer',fontSize:12,color:__stc('#64748b')}}>Clear</button>}
            <button type="button" onClick={()=>setShow(false)} style={{flex:1,padding:'6px 0',border:`1px solid ${__sbg('#e2e8f0')}`,borderRadius:6,background:__sbg('#fff'),cursor:'pointer',fontSize:12,color:__stc('#64748b')}}>Cancel</button>
            <button type="button" onClick={()=>{if(!from)return;onApply(from,to||from);setShow(false);}} disabled={!from} style={{flex:1,padding:'6px 0',border:'none',borderRadius:6,background:from?__sbg('#4f46e5'):__sbg('#e2e8f0'),color:from?__stc('#fff'):__stc('#94a3b8'),cursor:from?'pointer':'default',fontSize:12,fontWeight:600}}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};

const API_BASE_URL = process.env.REACT_APP_API_URL;

const InvoicesManagementPage = () => {
  useThemeVersion();
  const [invoices, setInvoices] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions } = useAuth();

  // ── Role helpers ───────────────────────────────────────────────────────────
  // isAccountsRole: used for WORKFLOW logic only (save as SENT vs PENDING_APPROVAL)
  // NOT used for page permission gates — those are purely DB-driven below.
  const isAccountsRole = !!(user?.role && user.role.trim().toUpperCase().startsWith('ACCOUNTS_'));
  // Privileged roles bypass the approval workflow (can create directly as DRAFT/SENT)
  const isPrivileged = isAccountsRole
    || user?.role === 'ADMIN'
    || user?.role === 'SUPERADMIN'
    || (user?.hierarchyLevel != null && Number(user.hierarchyLevel) <= 2);
  const invoicesPerms = pagePermissions?.INVOICES || [];
  // Pure DB-driven page permissions — no role overrides
  const canView   = invoicesPerms.includes('VIEW');
  const canCreate = invoicesPerms.includes('CREATE');
  const canEdit   = invoicesPerms.includes('EDIT');
  const canDelete = invoicesPerms.includes('DELETE');
  const canSend   = invoicesPerms.includes('SEND');
  const isViewOnly = canView && !canCreate && !canEdit && !canDelete;
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', type: 'error', onConfirm: null });
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    paymentStatus: 'all',
    dateFrom: '',
    dateTo: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Column sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Column visibility & order
  const INVOICE_COLUMNS = [
    { key: 'invoiceNumber',  label: 'Tally Inv. No' },
    { key: 'customerId',     label: 'Customer Name' },
    { key: 'totalAmount',    label: 'Total Amount' },
    { key: 'paidAmount',     label: 'Paid Amount' },
    { key: 'balanceAmount',  label: 'Balance' },
    { key: 'status',         label: 'Status' },
    { key: 'invoiceDate',    label: 'Invoice Date' },
    { key: 'dueDate',        label: 'Due Date' },
    { key: 'ageing',         label: 'Ageing (Days)' },
  ];
  const [columnOrder, setColumnOrder] = useState(INVOICE_COLUMNS.map(c => c.key));
  const [visibleColumns, setVisibleColumns] = useState(INVOICE_COLUMNS.map(c => c.key));
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const columnsPanelRef = useRef(null);
  const dragColRef = useRef(null);
  const dragOverColRef = useRef(null);

  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // ── Approve modal (accounts team only) ────────────────────────────────────
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveInvoice, setApproveInvoice] = useState(null);
  const [approveFile, setApproveFile] = useState(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [approveTallyNumber, setApproveTallyNumber] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);
  // ── Edit-mode invoice project change state ──
  const [invoicePendingProject, setInvoicePendingProject] = useState(null);
  const [showInvoiceProjectWarning, setShowInvoiceProjectWarning] = useState(false);
  const [stats, setStats] = useState(null);

  // Dropdown states
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({
    groups: false,
    subGroups: false,
    projects: false
  });
  const [orderBooks, setOrderBooks] = useState([]);
  const [selectedOrderBookId, setSelectedOrderBookId] = useState('');
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState({});
  const [showDropdown, setShowDropdown] = useState({});
  const [loadingOrderBookItems, setLoadingOrderBookItems] = useState(false);
  
  // Customer data
  const [customerData, setCustomerData] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    customerId: null,
    projectId: '',
    groupId: '',
    subGroupId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }],
    status: 'DRAFT'
  });

  const fetchOrderBookItemsForCustomer = async (customerId) => {
    if (!customerId) {
      setOrderBookItems([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/invoices/order-book-items-by-customer/${customerId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch order book items');

      const data = await response.json();
      setOrderBookItems(data.data || []);
      console.log('Loaded order book items:', data);

    } catch (error) {
      console.error('Failed to fetch order book items:', error);
      setOrderBookItems([]);
    }
  };

  // Step 1: Fetch all order books for this project and populate the dropdown
  const fetchProjectOrderBookItems = async (pId, gName, sgName) => {
    if (!pId) { setOrderBooks([]); setOrderBookItems([]); setSelectedOrderBookId(''); return; }
    setLoadingOrderBookItems(true);
    try {
      // Send groupName + subGroupName + projectId so it works whether or not
      // the backend supports the projectId param (old or new backend).
      // Client-side filter by projectId guarantees correctness either way.
      const group = encodeURIComponent(gName || modalGroupName || '');
      const subGroup = encodeURIComponent(sgName || modalSubGroupName || '');
      const obRes = await fetch(
        `${API_BASE_URL}/order-book/getAll?page=0&size=200&groupName=${group}&subGroupName=${subGroup}&projectId=${encodeURIComponent(pId)}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (!obRes.ok) throw new Error();
      const obData = await obRes.json();
      // Filter client-side by projectId to handle old backend that ignores the param
      const all = (obData.data || obData.content || []).filter(ob => ob.projectId === pId);
      setOrderBooks(all);
      setSelectedOrderBookId('');
      setOrderBookItems([]);
      // If exactly one order book, auto-select and load items
      if (all.length === 1) {
        setSelectedOrderBookId(String(all[0].id));
        await fetchOrderBookItemsById(all[0].id);
      }
    } catch { setOrderBooks([]); setOrderBookItems([]); }
    finally { setLoadingOrderBookItems(false); }
  };

  // Step 2: Fetch items for a specific order book (called when user selects from dropdown)
  const fetchOrderBookItemsById = async (orderBookId) => {
    if (!orderBookId) { setOrderBookItems([]); return; }
    setLoadingOrderBookItems(true);
    try {
      const itemsRes = await fetch(
        `${API_BASE_URL}/order-book/${orderBookId}/items-with-tracking`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (!itemsRes.ok) throw new Error();
      const itemsData = await itemsRes.json();
      setOrderBookItems(itemsData.success ? (itemsData.data || []) : (Array.isArray(itemsData) ? itemsData : []));
    } catch { setOrderBookItems([]); }
    finally { setLoadingOrderBookItems(false); }
  };

  // Handle order book selection from dropdown
  const handleOrderBookSelect = async (e) => {
    const obId = e.target.value;
    setSelectedOrderBookId(obId);
    setOrderBookItems([]);
    if (obId) await fetchOrderBookItemsById(obId);
  };

  const handleLoadOrderBookItems = () => {
    if (orderBookItems.length === 0) { showWarning('No order book items available'); return; }
    const loaded = orderBookItems.map(item => {
      const totalQty = parseFloat(item.quantity) || 0;
      const allocatedQty = parseFloat(item.invoicedQty) || 0;  // qty already invoiced
      const remainingQty = Math.max(0, totalQty - allocatedQty);
      return {
        description: item.itemName || '',
        quantity: remainingQty,
        unitPrice: parseFloat(item.unitPrice) || 0,
        taxPercent: parseFloat(item.taxPercent) || 18,
        unitType: normalizeUnit(item.unit),
        orderBookItemId: item.id,
        maxQty: remainingQty,
        totalQty,
        allocatedQty
      };
    }).filter(it => it.maxQty > 0);
    if (loaded.length === 0) { showWarning('All order book items are fully invoiced already'); return; }
    setFormData(prev => ({ ...prev, items: loaded }));
    showSuccess(`Loaded ${loaded.length} item${loaded.length !== 1 ? 's' : ''} from order book`);
  };

  // Update payment form data
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'Bank Transfer',
    transactionReference: '',
    notes: ''
  });

  const selectOrderBookItem = (index, item) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      description: item.itemName,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      taxPercent: item.taxPercent || 18,
      unitType: normalizeUnit(item.unit),
      orderBookItemId: item.id
    };

    setFormData({ ...formData, items: newItems });
    setShowDropdown(prev => ({ ...prev, [index]: false }));
    setFilteredItems(prev => ({ ...prev, [index]: [] }));
  };

  // Fetch invoices on mount and filter change
  // Clear stale data immediately when the logged-in user changes,
  // then reset page to 0 which will trigger a fresh fetchInvoices.
  const prevUserIdRef = React.useRef(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current !== user?.id) {
      setInvoices([]);
      setStats(null);
      setCurrentPage(0);
      prevUserIdRef.current = user?.id;
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchInvoices();
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search, filters.dateFrom, filters.dateTo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch stats when filters change
  useEffect(() => {
    fetchStats();
  }, [groupName, subGroupName, projectId, filters.status, filters.search, filters.dateFrom, filters.dateTo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleDownloadPdf = async (invoice) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoice.id}/download-pdf`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Invoice-${invoice.invoiceNo}.pdf`;
      if (contentDisposition) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches && matches[1]) filename = matches[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess('Invoice PDF downloaded successfully!');

    } catch (error) {
      console.error('Failed to download PDF:', error);
      showError('Failed to download PDF');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get auth headers
   */
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole')
  });

  /**
   * Fetch invoices from backend
   */
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        sortBy: 'invoiceDate',
        sortDirection: (filters.dateFrom || filters.dateTo) ? 'ASC' : 'DESC'
      });

      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('searchTerm', filters.search);
      if (filters.dateFrom) params.append('fromDate', filters.dateFrom);
      if (filters.dateTo)   params.append('toDate',   filters.dateTo);

      const response = await fetch(`${API_BASE_URL}/invoices?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();
      
      setInvoices(data.invoices || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);

    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      showError('Failed to load invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.Invoices-page-form-group')) {
        setShowDropdown({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Fetch statistics with filters
   */
const fetchStats = async () => {
  try {
    const params = new URLSearchParams();

    // Scope filters
    if (groupName) params.append("groupId", groupName);
    if (subGroupName) params.append("subGroupId", subGroupName);
    if (projectId) params.append("projectId", projectId);

    // Active filters - KPI cards must match exactly what the table shows
    if (filters.search && filters.search.trim()) params.append("searchTerm", filters.search.trim());
    if (filters.status && filters.status !== 'all') params.append("status", filters.status);
    if (filters.dateFrom) params.append("fromDate", filters.dateFrom);
    if (filters.dateTo)   params.append("toDate",   filters.dateTo);

    const response = await fetch(
      `${API_BASE_URL}/invoices/summary?${params.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      }
    );

    if (response.ok) {
      const data = await response.json();
      setStats(data);
    } else {
      console.error("Failed to fetch stats");
      setStats({ totalCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 });
    }
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    setStats({ totalCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 });
  }
};


  /**
   * Fetch modal groups — uses direct fetch with session credentials
   * (filterApi uses localStorage Bearer token which is empty in session-based auth)
   */
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/filters/groups`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      const groups = await response.json();
      setModalGroups(Array.isArray(groups) ? groups : []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setModalGroups([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, groups: false }));
    }
  };

  /**
   * Fetch modal subgroups — uses direct fetch with session credentials
   */
  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) {
      setModalSubGroups([]);
      return;
    }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const response = await fetch(
        `${API_BASE_URL}/filters/subgroups?groupName=${encodeURIComponent(groupName)}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch subgroups');
      const subGroups = await response.json();
      setModalSubGroups(Array.isArray(subGroups) ? subGroups : []);
    } catch (error) {
      console.error('Failed to fetch subgroups:', error);
      setModalSubGroups([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, subGroups: false }));
    }
  };

  /**
   * Fetch modal projects
   */
  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) {
      setModalProjects([]);
      return;
    }

    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(groupName, subGroupName);
      setModalProjects(projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      showError('Failed to load projects');
      setModalProjects([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, projects: false }));
    }
  };

  /**
   * Fetch customer by project ID
   */
  const fetchCustomerByProject = async (projectId) => {
    if (!projectId) {
      setCustomerData(null);
      setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/invoices/customer-by-project/${projectId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
        setFormData(prev => ({ ...prev, customerId: data.customerId }));
        // Order book items are fetched by project scope via fetchProjectOrderBookItems — not by customer
      } else {
        setCustomerData(null);
        setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
        showWarning('Customer not found for this project');
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      setCustomerData(null);
      setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    }
  };

  const handleDescriptionChange = (index, value) => {
    updateItem(index, 'description', value);

    if (!value || value.length < 2) {
      setFilteredItems(prev => ({ ...prev, [index]: [] }));
      setShowDropdown(prev => ({ ...prev, [index]: false }));
      return;
    }

    const searchLower = value.toLowerCase();
    const filtered = orderBookItems.filter(item =>
      item.itemName?.toLowerCase().includes(searchLower) ||
      item.specification?.toLowerCase().includes(searchLower)
    ).slice(0, 10);

    setFilteredItems(prev => ({ ...prev, [index]: filtered }));
    setShowDropdown(prev => ({ ...prev, [index]: filtered.length > 0 }));
  };

  /**
   * Handle modal group change
   */
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    if (editMode && formData.items && formData.items.some(i => i.description)) {
      setModalGroupName(newGroupName); setModalSubGroupName(''); setModalProjectId('');
      setModalSubGroups([]); setModalProjects([]);
      setInvoicePendingProject({ groupId: newGroupName, subGroupId: '', projectId: '' });
      setShowInvoiceProjectWarning(true);
      if (newGroupName) fetchModalSubGroups(newGroupName);
      return;
    }
    setModalGroupName(newGroupName);
    setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]);
    setCustomerData(null);
    setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setFormData({ ...formData, groupId: newGroupName, subGroupId: '', projectId: '', customerId: null, items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }] });
    if (newGroupName) { fetchModalSubGroups(newGroupName); }
  };

  /**
   * Handle modal subgroup change
   */
  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    if (editMode && formData.items && formData.items.some(i => i.description)) {
      setModalSubGroupName(newSubGroupName); setModalProjectId(''); setModalProjects([]);
      setInvoicePendingProject(prev => ({ ...(prev || { groupId: modalGroupName }), subGroupId: newSubGroupName, projectId: '' }));
      setShowInvoiceProjectWarning(true);
      if (modalGroupName && newSubGroupName) fetchModalProjects(modalGroupName, newSubGroupName);
      return;
    }
    setModalSubGroupName(newSubGroupName);
    setModalProjectId(''); setModalProjects([]);
    setCustomerData(null);
    setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setFormData({ ...formData, subGroupId: newSubGroupName, projectId: '', customerId: null, items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }] });
    if (modalGroupName && newSubGroupName) { fetchModalProjects(modalGroupName, newSubGroupName); }
  };

  /**
   * Handle modal project change
   */
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    if (editMode && formData.items && formData.items.some(i => i.description)) {
      setModalProjectId(newProjectId);
      setInvoicePendingProject(prev => ({ ...(prev || { groupId: modalGroupName, subGroupId: modalSubGroupName }), projectId: newProjectId }));
      setShowInvoiceProjectWarning(true);
      return;
    }
    setModalProjectId(newProjectId);
    setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setFormData({ ...formData, projectId: newProjectId, items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }] });
    if (newProjectId) {
      fetchCustomerByProject(newProjectId);
      fetchProjectOrderBookItems(newProjectId, modalGroupName, modalSubGroupName);
    }
  };

  const handleConfirmInvoiceProjectChange = () => {
    const g   = invoicePendingProject?.groupId   ?? modalGroupName;
    const sg  = invoicePendingProject?.subGroupId ?? modalSubGroupName;
    const pid = invoicePendingProject?.projectId  ?? modalProjectId;
    setFormData(prev => ({ ...prev, groupId: g, subGroupId: sg, projectId: pid }));
    if (pid) { fetchCustomerByProject(pid); fetchProjectOrderBookItems(pid, g, sg); }
    setInvoicePendingProject(null);
    setShowInvoiceProjectWarning(false);
  };

  const handleCancelInvoiceProjectChange = () => {
    setModalGroupName(formData.groupId || '');
    setModalSubGroupName(formData.subGroupId || '');
    setModalProjectId(formData.projectId || '');
    if (formData.groupId) fetchModalSubGroups(formData.groupId);
    if (formData.groupId && formData.subGroupId) fetchModalProjects(formData.groupId, formData.subGroupId);
    setInvoicePendingProject(null);
    setShowInvoiceProjectWarning(false);
  };

  /**
   * View invoice
   */
  const handleViewInvoice = async (invoice) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoice.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch invoice details');

      const data = await response.json();
      setSelectedInvoice(data);

      const historyResponse = await fetch(`${API_BASE_URL}/invoices/${invoice.id}/payment-history`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setPaymentHistory(historyData);
      }

      setShowInvoiceModal(true);
    } catch (error) {
      console.error('Failed to fetch invoice details:', error);
      showError('Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create new invoice
   */
  const handleCreateNew = () => {
    // Pre-seed from page-level header filters
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    const seedProject  = projectId   || '';
    setFormData({
      customerId: null,
      projectId: seedProject,
      groupId:   seedGroup,
      subGroupId: seedSubGroup,
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }],
      status: 'DRAFT'
    });
    setCustomerData(null);
    setModalGroupName(seedGroup); setModalSubGroupName(seedSubGroup); setModalProjectId(seedProject);
    setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setEditMode(false);
    fetchModalGroups();
    if (seedGroup) {
      fetchModalSubGroups(seedGroup);
      if (seedSubGroup) {
        fetchModalProjects(seedGroup, seedSubGroup);
        if (seedProject) fetchCustomerByProject(seedProject);
      }
    }
    setShowCreateModal(true);
  };

  /**
   * Edit invoice
   */
  const handleEditInvoice = async (invoice) => {
    setFormData({
      customerId: invoice.customerId,
      projectId: invoice.projectId,
      groupId: invoice.groupId,
      subGroupId: invoice.subGroupId,
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceDate: invoice.invoiceDate.split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
      items: invoice.items || [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }],
      status: invoice.status
    });
    setSelectedInvoice(invoice);
    setEditMode(true);
    setInvoicePendingProject(null);
    setShowInvoiceProjectWarning(false);

    // Pre-load all three dropdown levels for instant pre-population
    await fetchModalGroups();
    if (invoice.groupId) {
      setModalGroupName(invoice.groupId);
      await fetchModalSubGroups(invoice.groupId);
      if (invoice.subGroupId) {
        setModalSubGroupName(invoice.subGroupId);
        await fetchModalProjects(invoice.groupId, invoice.subGroupId);
        setModalProjectId(invoice.projectId || '');
      }
    }

    setShowCreateModal(true);
  };

  /**
   * Add item
   */
  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }]
    });
  };

  /**
   * Update item
   */
  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  /**
   * Remove item
   */
  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  /**
   * Calculate invoice totals
   */
  const calculateInvoice = () => {
    let subtotal = 0;
    let taxTotal = 0;

    formData.items.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = (lineTotal * item.taxPercent) / 100;
      subtotal += lineTotal;
      taxTotal += lineTax;
    });

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal
    };
  };

  // ─── Export to Excel ────────────────────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      // Build same params as fetchInvoices but with size=9999 to get ALL records
      const params = new URLSearchParams({
        page: 0,
        size: 9999,
        sortBy: 'invoiceDate',
        sortDirection: (filters.dateFrom || filters.dateTo) ? 'ASC' : 'DESC'
      });
      if (groupName)                params.append('groupId',    groupName);
      if (subGroupName)             params.append('subGroupId', subGroupName);
      if (projectId)                params.append('projectId',  projectId);
      if (filters.status !== 'all') params.append('status',     filters.status);
      if (filters.search)           params.append('searchTerm', filters.search);

      const response = await fetch(`${API_BASE_URL}/invoices?${params}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch invoices for export');
      const data = await response.json();
      const allInvoices = data.invoices || [];

      if (allInvoices.length === 0) {
        showWarning('No invoices found for the selected filters.');
        return;
      }

      // ── Helper formatters ──────────────────────────────────────────────────
      const fmtCurrency = (v) => v != null ? parseFloat(v).toFixed(2) : '0.00';
      const fmtDate     = (v) => {
        if (!v) return '';
        const d = new Date(v);
        return isNaN(d) ? v : `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
      };
      const fmtStatus   = (s) => {
        if (!s) return '';
        const m = { DRAFT:'Draft', SENT:'Sent', 'PARTIALLY PAID':'Partially Paid', PAID:'Paid', CANCELLED:'Cancelled' };
        return m[s.toUpperCase()] || s;
      };

      // ── KPI calculations ───────────────────────────────────────────────────
      const total       = allInvoices.length;
      const totalAmt    = allInvoices.reduce((s, i) => s + (parseFloat(i.totalAmount)   || 0), 0);
      const paidAmt     = allInvoices.reduce((s, i) => s + (parseFloat(i.paidAmount)    || 0), 0);
      const balanceAmt  = allInvoices.reduce((s, i) => s + (parseFloat(i.balanceAmount) || parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0) || 0), 0);
      const countByStatus = allInvoices.reduce((acc, i) => {
        const s = fmtStatus(i.status);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

      // ── Build filter description for the summary sheet ────────────────────
      const filterDesc = [
        groupName    ? `Group: ${groupName}`         : null,
        subGroupName ? `Sub-Group: ${subGroupName}`  : null,
        projectId    ? `Project: ${projectId}`       : null,
        filters.status !== 'all' ? `Status: ${fmtStatus(filters.status)}` : null,
        filters.search           ? `Search: "${filters.search}"`          : null,
      ].filter(Boolean).join('  |  ') || 'All Invoices';

      // ── Sheet 1: Summary ───────────────────────────────────────────────────
      const exportedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const summaryRows = [
        ['INVOICE EXPORT REPORT'],
        [''],
        ['Filter Applied', filterDesc],
        ['Exported At',    exportedAt],
        [''],
        ['── SUMMARY ─────────────────────────────────'],
        ['Total Invoices',      total],
        ['Total Amount (₹)',    fmtCurrency(totalAmt)],
        ['Paid Amount (₹)',     fmtCurrency(paidAmt)],
        ['Balance Amount (₹)', fmtCurrency(balanceAmt)],
        [''],
        ['── STATUS BREAKDOWN ────────────────────────'],
        ['Status', 'Count'],
        ...Object.entries(countByStatus).map(([s, c]) => [s, c]),
        [''],
        ['── AMOUNT BY STATUS ─────────────────────────'],
        ['Status', 'Total Amount (₹)', 'Paid Amount (₹)', 'Balance (₹)'],
        ...Object.entries(
          allInvoices.reduce((acc, inv) => {
            const s = fmtStatus(inv.status);
            if (!acc[s]) acc[s] = { total: 0, paid: 0, balance: 0 };
            acc[s].total   += parseFloat(inv.totalAmount)   || 0;
            acc[s].paid    += parseFloat(inv.paidAmount)    || 0;
            acc[s].balance += parseFloat(inv.balanceAmount) || (parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount || 0)) || 0;
            return acc;
          }, {})
        ).map(([s, a]) => [s, fmtCurrency(a.total), fmtCurrency(a.paid), fmtCurrency(a.balance)]),
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 55 }, { wch: 22 }, { wch: 22 }];

      // ── Sheet 2: All Invoices ──────────────────────────────────────────────
      const headers = [
        'System Invoice No',
        'Tally Invoice No',
        'Customer Name',
        'Company',
        'Group',
        'Sub-Group',
        'Project ID',
        'Invoice Date',
        'Due Date',
        'Status',
        'Total Amount (₹)',
        'Paid Amount (₹)',
        'Balance Amount (₹)',
        'Payment Progress (%)',
        'Overdue',
      ];

      const rows = allInvoices.map(inv => {
        const total   = parseFloat(inv.totalAmount)   || 0;
        const paid    = parseFloat(inv.paidAmount)    || 0;
        const balance = parseFloat(inv.balanceAmount) ?? (total - paid);
        const progress = total > 0 ? ((paid / total) * 100).toFixed(1) + '%' : '0%';

        const dueDate  = inv.dueDate ? new Date(inv.dueDate) : null;
        const isOverdue = dueDate && dueDate < new Date() && fmtStatus(inv.status) !== 'Paid' && fmtStatus(inv.status) !== 'Cancelled';

        return [
          inv.invoiceNo         || '',
          inv.invoiceNumber     || '',
          inv.customerCompanyName || inv.customerName || '',
          inv.company           || '',
          inv.groupId           || '',
          inv.subGroupId        || '',
          inv.projectId         || '',
          fmtDate(inv.invoiceDate),
          fmtDate(inv.dueDate),
          fmtStatus(inv.status),
          fmtCurrency(total),
          fmtCurrency(paid),
          fmtCurrency(balance),
          progress,
          isOverdue ? 'YES' : 'No',
        ];
      });

      const wsInvoices = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Smart column widths — max of header length and longest data value, capped at 50
      const colWidths = headers.map((h, colIdx) => {
        const maxDataLen = rows.reduce((max, row) => {
          const val = row[colIdx] != null ? String(row[colIdx]) : '';
          return Math.max(max, val.length);
        }, 0);
        return { wch: Math.min(50, Math.max(h.length + 3, maxDataLen + 2)) };
      });
      wsInvoices['!cols'] = colWidths;

      // ── Sheet 3: Pending / Overdue Detail ─────────────────────────────────
      const pendingInvoices = allInvoices.filter(inv => {
        const s = fmtStatus(inv.status);
        return s !== 'Paid' && s !== 'Cancelled';
      });

      const pendingHeaders = [
        'System Invoice No', 'Tally Invoice No', 'Customer Name',
        'Group', 'Sub-Group', 'Project ID',
        'Invoice Date', 'Due Date', 'Days Overdue',
        'Status', 'Total (₹)', 'Paid (₹)', 'Balance (₹)'
      ];

      const today = new Date();
      const pendingRows = pendingInvoices.map(inv => {
        const dueDate   = inv.dueDate ? new Date(inv.dueDate) : null;
        const daysOver  = dueDate ? Math.max(0, Math.floor((today - dueDate) / 86400000)) : '';
        const total     = parseFloat(inv.totalAmount)   || 0;
        const paid      = parseFloat(inv.paidAmount)    || 0;
        const balance   = parseFloat(inv.balanceAmount) ?? (total - paid);
        return [
          inv.invoiceNo || '', inv.invoiceNumber || '',
          inv.customerCompanyName || inv.customerName || '',
          inv.groupId || '', inv.subGroupId || '', inv.projectId || '',
          fmtDate(inv.invoiceDate), fmtDate(inv.dueDate),
          daysOver,
          fmtStatus(inv.status),
          fmtCurrency(total), fmtCurrency(paid), fmtCurrency(balance)
        ];
      });

      const wsPending = XLSX.utils.aoa_to_sheet([pendingHeaders, ...pendingRows]);
      const pendingColWidths = pendingHeaders.map((h, ci) => {
        const maxLen = pendingRows.reduce((mx, r) => Math.max(mx, String(r[ci] ?? '').length), 0);
        return { wch: Math.min(50, Math.max(h.length + 3, maxLen + 2)) };
      });
      wsPending['!cols'] = pendingColWidths;

      // ── Build workbook & download ──────────────────────────────────────────
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary,  'Summary');
      XLSX.utils.book_append_sheet(wb, wsInvoices, 'All Invoices');
      if (pendingRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, wsPending, 'Pending & Overdue');
      }

      const filterSlug = [groupName, subGroupName, projectId]
        .filter(Boolean).join('_').replace(/[^a-zA-Z0-9_]/g, '') || 'all';
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `invoices_${filterSlug}_${dateStr}.xlsx`);
      showSuccess(`Exported ${allInvoices.length} invoice(s) successfully!`);
    } catch (err) {
      console.error('Export failed:', err);
      showError('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExportLoading(false);
    }
  };

  /**
   * Save invoice
   */
  const handleSaveInvoice = async (status) => {
    if (!formData.customerId) {
      showWarning('Please select a project to auto-fill customer details');
      return;
    }

    if (!formData.dueDate) {
      showError('Due date is required');
      return;
    }

    if (formData.items.length === 0 || !formData.items[0].description) {
      showWarning('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const invoiceData = {
        ...formData,
        status: status,
        items: formData.items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          taxPercent: parseFloat(item.taxPercent),
          unitType: item.unitType,
          orderBookItemId: item.orderBookItemId || null
        }))
      };

      const url = editMode
        ? `${API_BASE_URL}/invoices/${selectedInvoice.id}`
        : `${API_BASE_URL}/invoices`;

      const response = await fetch(url, {
        credentials: "include",
        method: editMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save invoice');
      }

      const savedInvoice = await response.json();

      // Instantly update the table with the returned data (no waiting for re-fetch)
      if (editMode && savedInvoice) {
        setInvoices(prev =>
          prev.map(inv => inv.id === savedInvoice.id ? savedInvoice : inv)
        );
      }

      showSuccess(`Invoice ${editMode ? 'updated' : 'created'} successfully!`);
      setShowCreateModal(false);
      setInvoicePendingProject(null);
      setShowInvoiceProjectWarning(false);
      await fetchInvoices();
      fetchStats();

    } catch (error) {
      console.error('Failed to save invoice:', error);
      showError(error.message || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  // ── Accounts team: open approve modal ────────────────────────────────────
  const handleOpenApproveModal = (invoice) => {
    setApproveInvoice(invoice);
    setApproveFile(null);
    setApproveNotes('');
    setApproveTallyNumber(invoice.invoiceNumber || '');
    setShowApproveModal(true);
  };

  // ── Accounts team: submit approval with file ──────────────────────────────
  const handleApproveSubmit = async () => {
    if (!approveFile) { showWarning('Please select the invoice file to upload'); return; }
    setApproveLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', approveFile);
      formData.append('notes', approveNotes);
      if (approveTallyNumber.trim()) {
        formData.append('tallyNumber', approveTallyNumber.trim());
      }
      const authHeaders = getAuthHeaders();
      delete authHeaders['Content-Type'];
      const response = await fetch(`${API_BASE_URL}/invoices/${approveInvoice.id}/approve`, {
        credentials: 'include',
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Failed to approve invoice' }));
        throw new Error(err.message || 'Failed to approve invoice');
      }
      showSuccess(`Invoice ${approveInvoice.invoiceNo} approved successfully!`);
      setShowApproveModal(false);
      setApproveInvoice(null);
      await fetchInvoices();
      fetchStats();
    } catch (error) {
      showError(error.message || 'Failed to approve invoice');
    } finally {
      setApproveLoading(false);
    }
  };

  // ── Download attachment uploaded by accounts team ─────────────────────────
  const handleDownloadAttachment = async (invoice) => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoice.id}/download-attachment`, {
        credentials: 'include',
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error('Attachment not found');
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename[^;=\n]*=([^;\n]*)/);
      const fileName = match ? match[1].replace(/['"]/g, '') : `Invoice-${invoice.invoiceNo}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError('Could not download attachment: ' + error.message);
    }
  };

  /**
   * Record payment
   */
  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: parseFloat(invoice.balanceAmount || invoice.totalAmount),
      method: 'Bank Transfer',
      transactionReference: '',
      notes: '',
      receiptDate: new Date().toISOString().split('T')[0],
    });
    setShowPaymentModal(true);
  };

  /**
   * Save payment
   */
  const handleSavePayment = async () => {
    if (!paymentData.amount || paymentData.amount <= 0) {
      showWarning('Payment amount must be greater than zero');
      return;
    }
    if (paymentData.amount > parseFloat(selectedInvoice.balanceAmount || 0)) {
      showWarning(`Payment cannot exceed balance due of ${formatCurrency(selectedInvoice.balanceAmount)}`);
      return;
    }

    setLoading(true);
    try {
      // Create a proper Receipt record (INVOICE_PAYMENT type) — same as recording via Receipts tab.
      // This ensures the payment appears in Receipts, is linked to the correct project/customer,
      // and updates the invoice balance through the same code path.
      const receiptData = {
        receiptType: 'INVOICE_PAYMENT',
        invoiceId:   selectedInvoice.id,
        customerId:  selectedInvoice.customerId,
        projectId:   selectedInvoice.projectId,
        groupId:     selectedInvoice.groupId,
        subGroupId:  selectedInvoice.subGroupId,
        receiptDate: paymentData.receiptDate,
        amount:      parseFloat(paymentData.amount),
        paymentMethod:        paymentData.method,
        transactionReference: paymentData.transactionReference || '',
        notes:        paymentData.notes || '',
      };

      const response = await fetch(`${API_BASE_URL}/invoices/receipts`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(receiptData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to record payment');
      }

      showSuccess('Payment recorded successfully! Receipt created in the Receipts tab.');
      setShowPaymentModal(false);
      fetchInvoices();
      fetchStats();

    } catch (error) {
      console.error('Failed to record payment:', error);
      showError(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete invoice
   */
  const handleDeleteInvoice = (id) => {
    if (!canDelete) { showWarning('No permission to delete invoices'); return; }
    setConfirmModal({
      show: true, title: 'Delete Invoice',
      message: 'Are you sure you want to delete this invoice? This action cannot be undone.',
      type: 'error',
      onConfirm: () => performDeleteInvoice(id)
    });
  };
  const performDeleteInvoice = async (id) => {
    setConfirmModal({ show: false });

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
        credentials: "include",
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to delete invoice');

      showSuccess('Invoice deleted successfully!');
      fetchInvoices();
      fetchStats();

    } catch (error) {
      console.error('Failed to delete invoice:', error);
      showError('Failed to delete invoice');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'DRAFT': 'Invoices-page-status-draft',
      'SENT': 'Invoices-page-status-sent',
      'PAID': 'Invoices-page-status-paid',
      'PARTIALLY_PAID': 'Invoices-page-payment-partial',
      'CANCELLED': 'Invoices-page-status-cancelled',
      'PENDING APPROVAL': 'Invoices-page-status-pending-approval',
      'PENDING_APPROVAL': 'Invoices-page-status-pending-approval',
      'APPROVED': 'Invoices-page-status-approved',
    };
    return statusMap[status?.toUpperCase?.() || status] || statusMap[status] || '';
  };

  const getStatusDisplayName = (status) => {
    const statusMap = {
      'DRAFT': 'Draft',
      'SENT': 'Sent',
      'PAID': 'Paid',
      'PARTIALLY_PAID': 'Partially Paid',
      'PARTIALLY PAID': 'Partially Paid',
      'CANCELLED': 'Cancelled',
      'PENDING APPROVAL': 'Pending Approval',
      'PENDING_APPROVAL': 'Pending Approval',
      'APPROVED': 'Approved',
    };
    return statusMap[status] || status;
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

  const getSortedInvoices = () => {
    if (!sortConfig.key) return invoices;
    return [...invoices].sort((a, b) => {
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
    const to   = dragOverColRef.current;
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
  const colMeta = Object.fromEntries(INVOICE_COLUMNS.map(c => [c.key, c]));

  return (
    <div className="Invoices-page-container">
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

      {/* Breadcrumb */}
      <div className="Invoices-page-breadcrumb">
        <span>Pages</span>
        <span className="Invoices-page-separator">{'>'}</span>
        <span className="Invoices-page-current">Invoices</span>
      </div>

      <div className="page-header-with-filter">
        <h1 className="Invoices-page-title">Invoices ({totalElements})</h1>
        <GroupProjectFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          projectValue={projectId}
          onChange={updateFilters}
        />
      </div>

      {/* Action Bar */}
      <div className="Invoices-page-action-bar">
        <div className="Invoices-page-search-filters">
          <input
            type="text"
            className="Invoices-page-search"
            placeholder="Search invoices by ID..."
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(0);
            }}
          />

          <div className="inv-filter-select-wrap">
            <FilterSelect
              value={filters.status === 'all' ? '' : filters.status}
              options={[
                { value: 'DRAFT',            label: 'Draft'            },
                { value: 'SENT',             label: 'Sent'             },
                { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
                { value: 'APPROVED',         label: 'Approved'         },
                { value: 'PAID',             label: 'Paid'             },
                { value: 'PARTIALLY_PAID',   label: 'Partially Paid'   },
                { value: 'CANCELLED',        label: 'Cancelled'        },
              ]}
              placeholder="All Status"
              onChange={(v) => { setFilters({ ...filters, status: v || 'all' }); setCurrentPage(0); }}
            />
          </div>

          <InvDateRangePicker
            appliedFrom={filters.dateFrom}
            appliedTo={filters.dateTo}
            onApply={(f, t) => { setFilters({ ...filters, dateFrom: f, dateTo: t }); setCurrentPage(0); }}
            onClear={() => { setFilters({ ...filters, dateFrom: '', dateTo: '' }); setCurrentPage(0); }}
          />
        </div>

        <div className="Invoices-page-actions">
          <div className="col-toggle-wrapper" ref={columnsPanelRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="Invoices-page-btn-columns"
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
                {INVOICE_COLUMNS.map(col => (
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handleExportExcel}
              disabled={exportLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${__sbg('#059669')}`,
                background: exportLoading ? __sbg('#f0fdf4') : __sbg('#fff'), color: __stc('#059669'),
                fontSize: 13, fontWeight: 600, cursor: exportLoading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (!exportLoading) { e.currentTarget.style.background = '#059669'; e.currentTarget.style.color = '#fff'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#059669'; }}
              title="Export all invoices matching current filters to Excel"
            >
              {exportLoading
                ? <><span style={{ fontSize: 14 }}>⏳</span> Exporting…</>
                : <><span style={{ fontSize: 14 }}>📊</span> Export Excel</>
              }
            </button>
            <button className={`Invoices-page-btn-primary${!canCreate ? ' action-btn-disabled' : ''}`} onClick={() => canCreate && handleCreateNew()} disabled={!canCreate} title={!canCreate ? "🔒 No create permission" : "Create New Invoice"}>
              + Create New Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Permission notice for view-only users */}
      {isViewOnly && (
        <div className="Invoices-page-permission-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          You have view-only access. Contact your administrator to request Create, Edit, or Delete permissions.
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="Invoices-page-stats">
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">TOTAL INVOICES</div>
            <div className="Invoices-page-stat-value">{stats.totalCount || 0}</div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">TOTAL AMOUNT</div>
            <div className="Invoices-page-stat-value">
              {formatCurrency(stats.totalAmount)}
            </div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">PAID AMOUNT</div>
            <div className="Invoices-page-stat-value Invoices-page-stat-success">
              {formatCurrency(stats.paidAmount)}
            </div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">PENDING AMOUNT</div>
            <div className="Invoices-page-stat-value Invoices-page-stat-warning">
              {formatCurrency(stats.pendingAmount)}
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="Invoices-page-table-container">
        <div className="Invoices-page-table-scroll">
        <table className="Invoices-page-table">
          <thead>
            <tr>
              <th style={{ whiteSpace:'nowrap' }}>S.No</th>
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
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={orderedVisibleCols.length + 2} className="empty-state">
                  No invoices found
                </td>
              </tr>
            ) : (
              getSortedInvoices().map((invoice, rowIndex) => (
                <tr key={invoice.id}>
                  <td style={{ textAlign:'center', fontWeight:600, color:__stc('#6b7280'), fontSize:13 }}>{currentPage * pageSize + rowIndex + 1}</td>
                  {orderedVisibleCols.map(key => {
                    if (key === 'invoiceNumber')  return (
                      <td key={key}>
                        {invoice.invoiceNumber
                          ? <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: __stc('#374151') }}>{invoice.invoiceNumber}</span>
                          : <span style={{ color: __stc('#9ca3af'), fontSize: 12 }}>—</span>}
                      </td>
                    );
                    if (key === 'customerId')    return <td key={key}>{invoice.customerCompanyName || invoice.customerName || `#${invoice.customerId}`}</td>;
                    if (key === 'totalAmount')   return <td key={key} className="Invoices-page-total">{formatCurrency(invoice.totalAmount)}</td>;
                    if (key === 'paidAmount')    return <td key={key}>{formatCurrency(invoice.paidAmount)}</td>;
                    if (key === 'balanceAmount') return <td key={key} className="Invoices-page-total">{formatCurrency(invoice.balanceAmount)}</td>;
                    if (key === 'status')        return (
                      <td key={key}>
                        <span className={`Invoices-page-badge ${getStatusClass(invoice.status)}`}>
                          {getStatusDisplayName(invoice.status)}
                        </span>
                      </td>
                    );
                    if (key === 'invoiceDate')   return <td key={key}>{formatDate(invoice.invoiceDate)}</td>;
                    if (key === 'dueDate')       return <td key={key}>{formatDate(invoice.dueDate)}</td>;
                    if (key === 'ageing') {
                      const invDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : null;
                      const dueDate = invoice.dueDate     ? new Date(invoice.dueDate)     : null;
                      const compareDate = dueDate || new Date();
                      if (!invDate) return <td key={key} style={{ textAlign: 'center', color: '#94a3b8' }}>—</td>;
                      const days = Math.floor((compareDate - invDate) / 86400000);
                      const isPaid      = ['Paid','PAID'].includes(invoice.status);
                      const isCancelled = ['Cancelled','CANCELLED'].includes(invoice.status);
                      const isOverdue   = !isPaid && !isCancelled && compareDate < new Date();
                      return (
                        <td key={key} style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            background: isPaid || isCancelled ? '#f1f5f9' : isOverdue ? '#fee2e2' : '#dbeafe',
                            color:      isPaid || isCancelled ? '#64748b'  : isOverdue ? '#991b1b' : '#1e40af',
                          }}>
                            {days} day{days !== 1 ? 's' : ''}
                          </span>
                        </td>
                      );
                    }
                    return <td key={key}>—</td>;
                  })}
                  <td>
                    <div className="Invoices-page-action-buttons">
                      {/* View — only if VIEW permission */}
                      <button
                        className={`Invoices-page-action-btn Invoices-page-btn-view${!canView ? ' action-btn-disabled' : ''}`}
                        onClick={() => canView && handleViewInvoice(invoice)}
                        title={canView ? 'View invoice details' : '🔒 No view permission'}
                        disabled={!canView}
                      >
                        <Eye size={16} />
                      </button>

                      {/* Edit */}
                      <button
                        className={`Invoices-page-action-btn Invoices-page-btn-edit${!canEdit ? ' action-btn-disabled' : ''}`}
                        onClick={() => canEdit && handleEditInvoice(invoice)}
                        title={canEdit ? 'Edit invoice' : '🔒 No edit permission'}
                        disabled={!canEdit}
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* ── Accounts team: Approve button (only on PENDING APPROVAL) ── */}
                      {isAccountsRole && (invoice.status === 'Pending Approval' || invoice.status === 'PENDING_APPROVAL') && (
                        <button
                          className="Invoices-page-action-btn"
                          style={{ background: __sbg('#fef3c7'), color: __stc('#92400e'), border: `1px solid ${__sbg('#fcd34d')}` }}
                          onClick={() => handleOpenApproveModal(invoice)}
                          title="Approve invoice & upload file"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}

                      {/* ── Download attachment — only when accounts team has uploaded a file ── */}
                      {invoice.hasAttachment === true && (
                        <button
                          className="Invoices-page-action-btn"
                          style={{ background: __sbg('#d1fae5'), color: __stc('#065f46'), border: `1px solid ${__sbg('#6ee7b7')}` }}
                          onClick={() => handleDownloadAttachment(invoice)}
                          title={`Download approved invoice: ${invoice.attachmentFileName || ''}`}
                        >
                          <Download size={16} />
                        </button>
                      )}

                      {/* Record Payment */}
                      <button
                        className={`Invoices-page-action-btn Invoices-page-btn-payment${!canEdit ? ' action-btn-disabled' : ''}`}
                        onClick={() => canEdit && handleRecordPayment(invoice)}
                        title={canEdit ? 'Record payment' : '🔒 No payment permission'}
                        disabled={!canEdit}
                      >
                        <FaIndianRupeeSign size={16} />
                      </button>

                      {/* Delete — always shown, disabled if no permission */}
                      <button
                        className={`Invoices-page-action-btn Invoices-page-btn-delete${!canDelete ? ' action-btn-disabled' : ''}`}
                        onClick={() => canDelete && handleDeleteInvoice(invoice.id)}
                        title={canDelete ? 'Delete invoice' : '🔒 No delete permission'}
                        disabled={!canDelete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>{/* end Invoices-page-table-scroll */}

        {/* Pagination */}
        <div className="Invoices-page-pagination">
          <div className="Invoices-page-pagination-info">
            <span style={{whiteSpace:'nowrap'}}>Rows per page:</span>
            <FilterSelect
              value={String(pageSize)}
              onChange={v => { setPageSize(Number(v)); setCurrentPage(0); }}
              options={[{value:'5',label:'5 rows'},{value:'10',label:'10 rows'},{value:'25',label:'25 rows'},{value:'50',label:'50 rows'},{value:'100',label:'100 rows'}]}
              placeholder="Rows"
            />
            <span style={{whiteSpace:'nowrap',color:__stc('#64748b')}}>
              {totalElements === 0 ? 'No records' : `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, totalElements)} of ${totalElements} invoices`}
            </span>
            <span style={{fontSize:12,color:__stc('#94a3b8'),whiteSpace:'nowrap'}}>
              Page <strong style={{color:__stc('#0f172a')}}>{currentPage + 1}</strong> of <strong style={{color:__stc('#0f172a')}}>{totalPages}</strong>
            </span>
          </div>
          <div className="Invoices-page-pagination-buttons">
            <button className="Invoices-page-pagination-btn" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>«</button>
            <button className="Invoices-page-pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))} disabled={currentPage === 0}>‹</button>
            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
              return start + i;
            }).map(p => (
              <button key={p} className={`Invoices-page-pagination-btn${p === currentPage ? ' Invoices-page-pagination-btn-active' : ''}`} onClick={() => setCurrentPage(p)}>{p + 1}</button>
            ))}
            <button className="Invoices-page-pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))} disabled={currentPage >= totalPages - 1}>›</button>
            <button className="Invoices-page-pagination-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>»</button>
          </div>
        </div>
      </div>

      {/* View Invoice Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="Invoices-page-modal-overlay">
          <div className="Invoices-page-modal Invoices-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>Invoice Details - {selectedInvoice.invoiceNo}</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowInvoiceModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-invoice-view">
                <div className="Invoices-page-invoice-meta">
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>System No:</strong> {selectedInvoice.invoiceNo}
                  </div>
                  {selectedInvoice.invoiceNumber && (
                    <div className="Invoices-page-invoice-meta-item">
                      <strong>Tally No:</strong>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedInvoice.invoiceNumber}</span>
                    </div>
                  )}
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>Invoice Date:</strong> {formatDate(selectedInvoice.invoiceDate)}
                  </div>
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>Due Date:</strong> {formatDate(selectedInvoice.dueDate)}
                  </div>
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>Status:</strong>
                    <span className={`Invoices-page-badge ${getStatusClass(selectedInvoice.status)}`}>
                      {getStatusDisplayName(selectedInvoice.status)}
                    </span>
                  </div>
                </div>

                <div className="Invoices-page-invoice-section">
                  <h3>Invoice Items</h3>
                  <table className="Invoices-page-invoice-items-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Unit Type</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Tax %</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items && selectedInvoice.items.map((item, index) => {
                        const lineTotal = item.quantity * item.unitPrice;
                        const lineTax = (lineTotal * item.taxPercent) / 100;
                        return (
                          <tr key={index}>
                            <td>{item.description}</td>
                            <td>{item.unitType}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td>{item.taxPercent}%</td>
                            <td>{formatCurrency(lineTotal + lineTax)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {paymentHistory && paymentHistory.length > 0 && (
                  <div className="Invoices-page-invoice-section">
                    <h3>Payment History</h3>
                    <table className="Invoices-page-invoice-items-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentHistory.map((payment, index) => (
                          <tr key={index}>
                            <td>{formatDate(payment.paymentDate)}</td>
                            <td className="Invoices-page-text-success">{formatCurrency(payment.amount)}</td>
                            <td>{payment.paymentMethod}</td>
                            <td>{payment.transactionReference || '—'}</td>
                            <td>{payment.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="Invoices-page-invoice-totals">
                  <div className="Invoices-page-total-row">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div className="Invoices-page-total-row">
                    <span>Paid Amount:</span>
                    <span className="Invoices-page-text-success">{formatCurrency(selectedInvoice.paidAmount)}</span>
                  </div>
                  <div className="Invoices-page-total-row Invoices-page-grand-total">
                    <span>Balance Due:</span>
                    <span className="Invoices-page-text-danger">{formatCurrency(selectedInvoice.balanceAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="Invoices-page-modal-actions">
              {/* Download PDF button hidden — functionality coming soon */}
              <button className="Invoices-page-btn-secondary" onClick={() => handleEditInvoice(selectedInvoice)}>
                Edit Invoice
              </button>
              <button className="Invoices-page-btn-primary" onClick={() => {
                setShowInvoiceModal(false);
                handleRecordPayment(selectedInvoice);
              }}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Invoice Modal */}
      {showCreateModal && (
        <div className="Invoices-page-modal-overlay">
          <div className="Invoices-page-modal Invoices-page-modal-xlarge" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>{editMode ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-form">
                <div className="Invoices-page-form-section">
                  <h3>Project Assignment</h3>
                  <div className="Invoices-page-form-grid">
                    <div className="Invoices-page-form-group">
                      <label>Group *</label>
                      <FilterSelect
                        value={modalGroupName}
                        options={modalGroups}
                        placeholder={modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}
                        disabled={modalDropdownLoading.groups}
                        onChange={v => handleModalGroupChange({ target: { value: v || '' } })}
                      />
                    </div>

                    <div className="Invoices-page-form-group">
                      <label>Sub Group</label>
                      <FilterSelect
                        value={modalSubGroupName}
                        options={modalSubGroups}
                        placeholder={!modalGroupName ? 'Select Group First' : modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub Group'}
                        disabled={!modalGroupName || modalDropdownLoading.subGroups}
                        onChange={v => handleModalSubGroupChange({ target: { value: v || '' } })}
                      />
                    </div>

                    <div className="Invoices-page-form-group">
                      <label>Project *</label>
                      <FilterSelect
                        value={modalProjectId}
                        options={modalProjects.map(p => ({ value: p.id, label: p.name }))}
                        placeholder={!modalSubGroupName ? 'Select Sub Group First' : modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}
                        disabled={!modalSubGroupName || modalDropdownLoading.projects}
                        onChange={v => handleModalProjectChange({ target: { value: v || '' } })}
                        searchable={true}
                      />
                    </div>


                  </div>

                  {/* ── Edit-mode: show pending change badge + action buttons ── */}
                  {showInvoiceProjectWarning && editMode && (
                    <div style={{ marginTop: '12px', padding: '12px 14px', background: __sbg('#fffbeb'), border: `1.5px solid ${__sbg('#f59e0b')}`, borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontSize: '13px', color: __stc('#92400e'), fontWeight: 500 }}>
                          ⚠️ Project changed — items will be preserved. Confirm to apply.
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={handleConfirmInvoiceProjectChange}
                            style={{ padding: '7px 14px', background: __sbg('#d97706'), color: __stc('white'), border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                            ✅ Apply
                          </button>
                          <button onClick={handleCancelInvoiceProjectChange}
                            style={{ padding: '7px 14px', background: __sbg('white'), color: __stc('#92400e'), border: `1.5px solid ${__sbg('#f59e0b')}`, borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                            ✕ Revert
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Book Section — shown once a project is selected */}
                  {modalProjectId && (
                    <div style={{ marginTop: '14px' }}>
                      {loadingOrderBookItems ? (
                        <div style={{ padding: '12px 16px', background: __sbg('#dbeafe'), borderRadius: '8px', fontSize: '13px', color: __stc('#1e40af') }}>
                          🔄 Loading order books…
                        </div>
                      ) : orderBooks.length === 0 ? (
                        /* No order books at all for this project */
                        <div style={{ padding: '16px', background: __sbg('#fffbeb'), border: `1px solid ${__sbg('#fde68a')}`, borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: __stc('#92400e'), marginBottom: 4 }}>⚠️ No Order Book Found</div>
                          <div style={{ fontSize: '13px', color: __stc('#b45309') }}>No Order Book Is Linked To This Project Yet.</div>
                        </div>
                      ) : (
                        /* One or more order books — show dropdown + items */
                        <div style={{ padding: '16px', background: __sbg('#fef3c7'), border: `2px solid ${__sbg('#fbbf24')}`, borderRadius: '8px' }}>
                          <h4 style={{ marginBottom: '10px', color: __stc('#92400e'), fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📦 Select Order Book
                          </h4>

                          {/* Order book dropdown */}
                          <div style={{ marginBottom: '12px' }}>
                            <select
                              value={selectedOrderBookId}
                              onChange={handleOrderBookSelect}
                              style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: `1px solid ${__sbg('#fbbf24')}`, background: __sbg('white') }}
                            >
                              <option value="">-- Select an Order Book --</option>
                              {orderBooks.map(ob => (
                                <option key={ob.id} value={ob.id}>
                                  {ob.poNumber || ob.orderBookNo} — {ob.orderTitle ? (ob.orderTitle.length > 40 ? ob.orderTitle.substring(0, 40) + '...' : ob.orderTitle) : 'No Title'}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Items preview + load button */}
                          {selectedOrderBookId && (
                            loadingOrderBookItems ? (
                              <div style={{ fontSize: '13px', color: __stc('#92400e') }}>🔄 Loading items…</div>
                            ) : orderBookItems.length === 0 ? (
                              <div style={{ fontSize: '13px', color: __stc('#92400e') }}>No items found in this order book.</div>
                            ) : (
                              <>
                                {/* Summary + Load button */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: 8 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: __stc('#92400e') }}>
                                    📋 {orderBookItems.length} item{orderBookItems.length !== 1 ? 's' : ''} in order book
                                    <span style={{ fontWeight: 400, color: __stc('#6b7280'), marginLeft: 8 }}>
                                      ({orderBookItems.filter(it => Math.max(0, (parseFloat(it.quantity)||0) - (parseFloat(it.invoicedQty)||0)) > 0).length} with remaining qty)
                                    </span>
                                  </div>
                                  <button
                                    className="Invoices-page-btn-primary"
                                    onClick={handleLoadOrderBookItems}
                                    style={{ fontSize: '13px', padding: '6px 14px' }}
                                  >
                                    📥 Load Items into Invoice
                                  </button>
                                </div>

                                {/* Items table */}
                                <div style={{ maxHeight: '180px', overflowY: 'auto', border: `1px solid ${__sbg('#fde68a')}`, borderRadius: '6px', background: __sbg('white') }}>
                                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: __sbg('#fef3c7'), position: 'sticky', top: 0 }}>
                                        <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: __stc('#92400e'), borderBottom: `1px solid ${__sbg('#fde68a')}` }}>Item</th>
                                        <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: __stc('#92400e'), borderBottom: `1px solid ${__sbg('#fde68a')}` }}>Total Qty</th>
                                        <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: __stc('#92400e'), borderBottom: `1px solid ${__sbg('#fde68a')}` }}>Invoiced</th>
                                        <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: __stc('#92400e'), borderBottom: `1px solid ${__sbg('#fde68a')}` }}>Remaining</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {orderBookItems.map((item, idx) => {
                                        const total = parseFloat(item.quantity) || 0;
                                        const done  = parseFloat(item.invoicedQty) || 0;
                                        const remaining = Math.max(0, total - done);
                                        return (
                                          <tr key={idx} style={{ borderBottom: `1px solid ${__sbg('#fef9c3')}`, background: remaining === 0 ? __sbg('#fef9f9') : __sbg('white') }}>
                                            <td style={{ padding: '7px 10px', color: remaining === 0 ? __stc('#9ca3af') : __stc('#111827') }}>
                                              {item.itemName}
                                              {remaining === 0 && <span style={{ marginLeft: 6, fontSize: '10px', color: __stc('#ef4444'), fontWeight: 600 }}>FULLY INVOICED</span>}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', color: __stc('#374151') }}>{total} {item.unit || ''}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', color: __stc('#f59e0b') }}>{done}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: remaining > 0 ? __stc('#059669') : __stc('#ef4444') }}>{remaining}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {customerData && (
                  <div className="Invoices-page-form-section">
                    <h3>Customer Information</h3>
                    <div style={{
                      padding: '16px',
                      backgroundColor: __sbg('#f0f9ff'),
                      border: `1px solid ${__sbg('#bae6fd')}`,
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}>
                      <p><strong>Company:</strong> {customerData.companyName}</p>
                      <p><strong>Contact Person:</strong> {customerData.contactPerson}</p>
                      <p><strong>Email:</strong> {customerData.email}</p>
                      <p><strong>Phone:</strong> {customerData.phone}</p>
                      {customerData.gstNumber && <p><strong>GST:</strong> {customerData.gstNumber}</p>}
                    </div>
                  </div>
                )}

                <div className="Invoices-page-form-section">
                  <h3>Invoice Details</h3>
                  <div className="Invoices-page-form-grid">
                    <div className="Invoices-page-form-group">
                      <label>Invoice Date *</label>
                      <InvDatePicker
                        value={formData.invoiceDate}
                        onChange={v => setFormData({ ...formData, invoiceDate: v })}
                        placeholder="Select invoice date"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Due Date <span style={{ color: '#ef4444' }}>*</span></label>
                      <InvDatePicker
                        value={formData.dueDate}
                        onChange={v => setFormData({ ...formData, dueDate: v })}
                        placeholder="Select due date"
                        minDate={formData.invoiceDate}
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>
                        Tally Invoice Number
                        <span style={{ fontSize: 11, color: __stc('#9ca3af'), fontWeight: 400, marginLeft: 6 }}>(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TAL/2024-25/001"
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="Invoices-page-form-section">
                  <div className="Invoices-page-section-header">
                    <h3>Invoice Items *</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {formData.items.some(it => it.orderBookItemId) && (
                        <span style={{ fontSize: '12px', color: __stc('#059669'), fontWeight: 500 }}>📦 Loaded from order book</span>
                      )}
                      <button className="Invoices-page-btn-add" onClick={addItem}>+ Add Item</button>
                    </div>
                  </div>

                  {/* ── Column header row ─────────────────────────── */}
                  <div className="Invoices-page-item-header-row">
                    <span>Description *</span>
                    <span>Unit Type</span>
                    <span>Qty</span>
                    <span>Unit Price *</span>
                    <span>Tax %</span>
                    <span>Line Total</span>
                    <span></span>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="Invoices-page-item-row">

                      {/* Col 1 — Description with autocomplete dropdown */}
                      <div className="Invoices-page-ifield" style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleDescriptionChange(index, e.target.value)}
                          onFocus={() => { if (item.description && item.description.length >= 2) handleDescriptionChange(index, item.description); }}
                          placeholder="Item description…"
                          className="Invoices-page-iinput"
                        />
                        {showDropdown[index] && filteredItems[index]?.length > 0 && (
                          <div className="invoice-item-dropdown">
                            {filteredItems[index].map((obItem) => (
                              <div key={obItem.id} onClick={() => selectOrderBookItem(index, obItem)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                <div style={{ fontWeight: 600, color: __stc('#1e293b'), marginBottom: 2 }}>{obItem.itemName}</div>
                                {obItem.specification && <div style={{ fontSize: 12, color: __stc('#64748b'), marginBottom: 2 }}>{obItem.specification}</div>}
                                <div style={{ fontSize: 11, color: __stc('#94a3b8') }}>Order: {obItem.orderBookNo} | Qty: {obItem.quantity} {obItem.unit} | ₹{parseFloat(obItem.unitPrice).toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Col 2 — Unit Type */}
                      <div className="Invoices-page-ifield">
                        <UnitTypeDropdown
                          value={item.unitType}
                          onChange={(e) => updateItem(index, 'unitType', e.target.value)}
                          className="Invoices-page-iinput"
                        />
                      </div>

                      {/* Col 3 — Qty with max cap */}
                      <div className="Invoices-page-ifield">
                        <input
                          type="number"
                          value={item.quantity}
                          min={0}
                          max={item.maxQty != null ? item.maxQty : undefined}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const clamped = item.maxQty != null ? Math.min(val, item.maxQty) : val;
                            updateItem(index, 'quantity', clamped);
                          }}
                          className={`Invoices-page-iinput${item.maxQty != null && item.quantity > item.maxQty ? ' Invoices-page-iinput-error' : ''}`}
                          title={item.maxQty != null ? `Max: ${item.maxQty}` : ''}
                        />
                        {item.maxQty != null && (
                          <span className="Invoices-page-qty-cap">max {item.maxQty}</span>
                        )}
                      </div>

                      {/* Col 4 — Unit Price */}
                      <div className="Invoices-page-ifield">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                          className="Invoices-page-iinput"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Col 5 — Tax % */}
                      <div className="Invoices-page-ifield">
                        <select
                          value={item.taxPercent}
                          onChange={(e) => updateItem(index, 'taxPercent', parseFloat(e.target.value))}
                          className="Invoices-page-iinput"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>

                      {/* Col 6 — Line Total (read-only) */}
                      <div className="Invoices-page-ifield Invoices-page-ifield-total">
                        {formatCurrency(item.quantity * item.unitPrice * (1 + item.taxPercent / 100))}
                      </div>

                      {/* Col 7 — Remove */}
                      <button
                        className="Invoices-page-btn-remove"
                        onClick={() => removeItem(index)}
                        title="Remove item"
                        style={{ visibility: formData.items.length > 1 ? 'visible' : 'hidden' }}
                      >×</button>

                    </div>
                  ))}

                  <div className="Invoices-page-calculation-summary">
                    <div className="Invoices-page-calc-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(calculateInvoice().subtotal)}</span>
                    </div>
                    <div className="Invoices-page-calc-row">
                      <span>Tax Total:</span>
                      <span>{formatCurrency(calculateInvoice().taxTotal)}</span>
                    </div>
                    <div className="Invoices-page-calc-row Invoices-page-calc-grand">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(calculateInvoice().grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="Invoices-page-modal-actions">
              {isPrivileged && (
                <button className="Invoices-page-btn-secondary" onClick={() => handleSaveInvoice('DRAFT')}>
                  Save as Draft
                </button>
              )}
              <button className="Invoices-page-btn-primary" onClick={() =>
                handleSaveInvoice(isPrivileged ? 'SENT' : 'PENDING_APPROVAL')
              }>
                {editMode
                  ? 'Update Invoice'
                  : isPrivileged
                    ? 'Create & Send Invoice'
                    : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal — creates a Receipt (INVOICE_PAYMENT) same as Receipts tab */}
      {showPaymentModal && selectedInvoice && (
        <div className="Invoices-page-modal-overlay">
          <div className="Invoices-page-modal" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>Record Payment</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              {/* Invoice summary */}
              <div style={{ padding: '14px 16px', backgroundColor: __sbg('#f8fafc'), borderRadius: '8px', marginBottom: '20px', border: `1px solid ${__sbg('#e2e8f0')}` }}>
                <div className="Invoices-page-payment-row">
                  <span>System Invoice No:</span>
                  <strong>{selectedInvoice.invoiceNo}</strong>
                </div>
                {selectedInvoice.invoiceNumber && (
                  <div className="Invoices-page-payment-row">
                    <span>Tally Invoice No:</span>
                    <strong style={{ fontFamily: 'monospace', color: __stc('#374151') }}>{selectedInvoice.invoiceNumber}</strong>
                  </div>
                )}
                <div className="Invoices-page-payment-row">
                  <span>Customer:</span>
                  <strong>{selectedInvoice.customerCompanyName || selectedInvoice.customerName || `#${selectedInvoice.customerId}`}</strong>
                </div>
                {selectedInvoice.projectId && (
                  <div className="Invoices-page-payment-row">
                    <span>Project:</span>
                    <strong>{selectedInvoice.projectId}</strong>
                  </div>
                )}
                <div className="Invoices-page-payment-row">
                  <span>Total Amount:</span>
                  <strong>{formatCurrency(selectedInvoice.totalAmount)}</strong>
                </div>
                <div className="Invoices-page-payment-row">
                  <span>Already Paid:</span>
                  <strong className="Invoices-page-text-success">{formatCurrency(selectedInvoice.paidAmount)}</strong>
                </div>
                <div className="Invoices-page-payment-row">
                  <span>Balance Due:</span>
                  <strong className="Invoices-page-text-danger">{formatCurrency(selectedInvoice.balanceAmount)}</strong>
                </div>
              </div>

              {/* Info banner */}
              <div style={{ padding: '10px 14px', background: __sbg('#eff6ff'), border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: '6px', fontSize: '13px', color: __stc('#1e40af'), marginBottom: '16px' }}>
                💡 This payment will be recorded as a Receipt (Invoice Payment) and will appear in the Receipts tab.
              </div>

              <div className="Invoices-page-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="Invoices-page-form-group">
                    <label>Receipt Date *</label>
                    <InvDatePicker
                      value={paymentData.receiptDate || ''}
                      onChange={v => setPaymentData({ ...paymentData, receiptDate: v })}
                      placeholder="Select receipt date"
                    />
                  </div>
                  <div className="Invoices-page-form-group">
                    <label>Amount Paid *</label>
                    <input
                      type="number"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                      max={selectedInvoice.balanceAmount}
                      step="0.01"
                      min="0"
                    />
                    <small style={{ color: __stc('#64748b') }}>Max: {formatCurrency(selectedInvoice.balanceAmount)}</small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="Invoices-page-form-group">
                    <label>Payment Method *</label>
                    <FilterSelect
                      value={paymentData.method || 'Bank Transfer'}
                      options={[
                        { value: 'Bank Transfer', label: 'Bank Transfer' },
                        { value: 'UPI',           label: 'UPI'           },
                        { value: 'Cash',          label: 'Cash'          },
                        { value: 'Cheque',        label: 'Cheque'        },
                        { value: 'Credit Card',   label: 'Credit Card'   },
                      ]}
                      placeholder="Select Method"
                      onChange={v => setPaymentData({ ...paymentData, method: v || 'Bank Transfer' })}
                    />
                  </div>
                  <div className="Invoices-page-form-group">
                    <label>Transaction Reference</label>
                    <input
                      type="text"
                      value={paymentData.transactionReference || ''}
                      onChange={(e) => setPaymentData({ ...paymentData, transactionReference: e.target.value })}
                      placeholder="UTR / Cheque No / etc."
                    />
                  </div>
                </div>

                <div className="Invoices-page-form-group">
                  <label>Notes</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows="2"
                  />
                </div>
              </div>
            </div>

            <div className="Invoices-page-modal-actions">
              <button className="Invoices-page-btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button className="Invoices-page-btn-primary" onClick={handleSavePayment}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Invoice Modal (Accounts team only) ───────────────────── */}
      {showApproveModal && approveInvoice && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="Invoices-page-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="Invoices-page-modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={20} color="#10b981" /> Approve Invoice
              </h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowApproveModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              {/* Invoice summary */}
              <div style={{ padding: '12px 16px', background: __sbg('#f0fdf4'), borderRadius: 8, marginBottom: 20, border: `1px solid ${__sbg('#bbf7d0')}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: __stc('#374151'), fontWeight: 600 }}>Invoice No:</span>
                  <span style={{ fontFamily: 'monospace', color: __stc('#065f46'), fontWeight: 700 }}>{approveInvoice.invoiceNo}</span>
                </div>
                {approveInvoice.invoiceNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: __stc('#374151'), fontWeight: 600 }}>Tally Ref:</span>
                    <span style={{ fontFamily: 'monospace' }}>{approveInvoice.invoiceNumber}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: __stc('#374151'), fontWeight: 600 }}>Customer:</span>
                  <span>{approveInvoice.customerName || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: __stc('#374151'), fontWeight: 600 }}>Total Amount:</span>
                  <span style={{ fontWeight: 700, color: __stc('#065f46') }}>
                    ₹{parseFloat(approveInvoice.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* File upload */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: __stc('#374151') }}>
                  Upload Invoice File <span style={{ color: __stc('#ef4444') }}>*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx"
                  onChange={e => setApproveFile(e.target.files[0] || null)}
                  style={{ width: '100%', padding: '8px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13 }}
                />
                {approveFile && (
                  <div style={{ marginTop: 6, fontSize: 12, color: __stc('#059669'), display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={13} /> {approveFile.name} ({(approveFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                <p style={{ margin: '6px 0 0', fontSize: 11, color: __stc('#9ca3af') }}>
                  Accepted: PDF, JPG, PNG, DOC, DOCX, XLSX
                </p>
              </div>

              {/* Tally Invoice Number */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: __stc('#374151') }}>
                  Tally Invoice Number <span style={{ color: __stc('#9ca3af'), fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={approveTallyNumber}
                  onChange={e => setApproveTallyNumber(e.target.value)}
                  placeholder="e.g. TAL/2026/001"
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: __stc('#9ca3af') }}>
                  This will be saved as the Tally reference number on the invoice.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: __stc('#374151') }}>
                  Approval Notes <span style={{ color: __stc('#9ca3af'), fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={approveNotes}
                  onChange={e => setApproveNotes(e.target.value)}
                  placeholder="Add any notes for the approval..."
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div className="Invoices-page-modal-actions">
              <button className="Invoices-page-btn-secondary" onClick={() => setShowApproveModal(false)}>
                Cancel
              </button>
              <button
                className="Invoices-page-btn-primary"
                onClick={handleApproveSubmit}
                disabled={approveLoading || !approveFile}
                style={{ background: __sbg('#10b981'), borderColor: __sbg('#10b981'), display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {approveLoading
                  ? 'Approving...'
                  : <><CheckCircle size={15} /> Approve & Upload</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesManagementPage;