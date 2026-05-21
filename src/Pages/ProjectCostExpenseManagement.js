import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Plus, X, Edit2, Eye, Trash2,
  IndianRupee, CreditCard, FileText,
  CheckCircle, Clock, XCircle, Briefcase,
  MapPin, Utensils, Plane, Hotel, Users,
  ArrowUpDown, ArrowUp, ArrowDown, GripVertical,
  Receipt, RefreshCw,
} from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter.js';
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
  { key: 'actions',       label: 'Actions',          sortable: false, visible: true  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = v => v == null ? '₹0' : `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
          ? <span style={{flex:1, fontSize:13, fontWeight:500, color:'#0f172a'}}>{fmt(value)}</span>
          : <span className="pce-dp-ph">{placeholder}</span>}
        {value
          ? <span className="pce-dp-x" onClick={e=>{e.stopPropagation(); onChange('');}}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{marginLeft:'auto', color:'#94a3b8', transform:show?'rotate(180deg)':'none', transition:'transform .2s', flexShrink:0}}>
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
          style={{marginLeft:'auto',color:'#94a3b8',flexShrink:0,transform:show?'rotate(180deg)':'none',transition:'transform .2s'}}>
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

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectCostExpenseManagement = () => {

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, isAccountsExecutive } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // ── Role-based access ──────────────────────────────────────────────────────
  const userRole      = (user?.role || localStorage.getItem('userRole') || '').toLowerCase();
  const isAccountsRole = user?.role && user.role.toUpperCase().startsWith('ACCOUNTS_');
  const isSuperAdmin   = user?.role === 'SUPERADMIN' || userRole.includes('super_admin');
  const isAdmin        = user?.role === 'ADMIN';
  // Full access: superadmin, admin, any ACCOUNTS_* role, or isAccountsExecutive from auth context
  const isFullAccess   = isSuperAdmin || isAdmin || isAccountsRole || isAccountsExecutive;
  const canApprove     = isFullAccess;

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
      // Super admin / admin / accounts team see ALL data
      if (!isFullAccess && user?.id) params.append('createdBy', user.id);

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
      // Non-full-access users: scope stats to own records only
      if (!isFullAccess && user?.id) params.append('createdBy', user.id);
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
    const initItem = { id: Date.now(), category: 'Travel', projectId: '', amount: '', paymentMode: 'UPI', description: '' };
    setExpenseFormData({
      groupName: groupName || '', subGroupName: subGroupName || '',
      tripDate: new Date().toISOString().split('T')[0],
      tripReason: '',
      status: 'Approved',
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
    if (!expenseItems?.length) { showWarning('Add at least one expense item'); return; }

    // Validate every item has a project and amount
    const missingProject = expenseItems.find(i => !i.projectId);
    if (missingProject) { showWarning('Every item must have a project assigned'); return; }
    const missingAmount = expenseItems.find(i => !i.amount || parseFloat(i.amount) <= 0);
    if (missingAmount) { showWarning('Every item must have a valid amount'); return; }

    // ── Group items by projectId — one expense record per project ────────────
    const byProject = {};
    expenseItems.forEach(i => {
      if (!byProject[i.projectId]) byProject[i.projectId] = [];
      byProject[i.projectId].push(i);
    });
    const projectGroups = Object.entries(byProject); // [[projectId, [items]], ...]

    setLoading(true);
    try {
      const results = [];
      for (const [pid, items] of projectGroups) {
        const body = {
          groupName: grp, subGroupName: sub,
          projectId: pid,                          // one valid projectId per call
          tripDate, tripReason: tripReason || null,
          status: expenseFormData.status || 'Approved',
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

      // Upload bill to the first created expense if file selected
      if (billFile && results[0]?.id) await handleBillUpload(results[0].id);

      const projectCount = projectGroups.length;
      const itemCount = expenseItems.length;
      showSuccess(
        projectCount === 1
          ? `Expense created with ${itemCount} item(s) for 1 project`
          : `${itemCount} item(s) split across ${projectCount} project expense records`
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
          projectId: i.projectId ? String(i.projectId) : parentProjectId,
          amount: i.amount?.toString() || '',
          paymentMode: i.paymentMode || 'UPI',
          description: i.description || '',
        }))
      : [{ id: Date.now(), category: expense.category || 'Travel',
           projectId: expense.projectId ? String(expense.projectId) : '',
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
    if (!expenseItems?.length) { showWarning('Add at least one expense item'); return; }

    const missingProject = expenseItems.find(i => !i.projectId);
    if (missingProject) { showWarning('Every item must have a project assigned'); return; }
    const missingAmount = expenseItems.find(i => !i.amount || parseFloat(i.amount) <= 0);
    if (missingAmount) { showWarning('Every item must have a valid amount'); return; }

    // Check if all items belong to the SAME project as the original expense
    const allSameProject = expenseItems.every(i => i.projectId === expenseItems[0].projectId);

    setLoading(true);
    try {
      if (allSameProject) {
        // Simple update — single project, use PUT on the existing expense
        const res = await fetch(`${API_BASE_URL}/project-expenses/${id}`, {
          method: 'PUT', headers: getAuthHeaders(), credentials: 'include',
          body: JSON.stringify({
            groupName: grp, subGroupName: sub,
            projectId: expenseItems[0].projectId,
            tripDate, tripReason: tripReason || null,
            paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
            paidByName: paidByName || '',
            expenseItems: expenseItems.map(i => ({
              category: i.category, amount: parseFloat(i.amount) || 0,
              paymentMode: i.paymentMode, description: i.description || '',
            })),
          }),
        });
        if (!res.ok) throw new Error('Failed to update expense');
        if (billFile) await handleBillUpload(id);
        showSuccess('Expense updated successfully!');
      } else {
        // Multi-project: DELETE original, create new split records
        await fetch(`${API_BASE_URL}/project-expenses/${id}`, {
          method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
        });

        const byProject = {};
        expenseItems.forEach(i => {
          if (!byProject[i.projectId]) byProject[i.projectId] = [];
          byProject[i.projectId].push(i);
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
        if (billFile && results[0]?.id) await handleBillUpload(results[0].id);
        showSuccess(`Updated: split into ${Object.keys(byProject).length} project expense records`);
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
            ? <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{exp.groupName}</span>
            : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
          }
          {exp.subGroupName && (
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{exp.subGroupName}</span>
          )}
        </div>
      );
      case 'project': return (
        <div style={{ minWidth: 160 }}>
          {exp.projectId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', wordBreak: 'break-word', lineHeight: 1.4 }}>
                {exp.projectName || exp.projectId}
              </span>
              {exp.projectName && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                  {exp.projectId}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
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
          Cash:          { bg: '#dcfce7', color: '#15803d' },
          UPI:           { bg: '#ede9fe', color: '#6d28d9' },
          Card:          { bg: '#dbeafe', color: '#1d4ed8' },
          Bank_Transfer: { bg: '#e0f2fe', color: '#0369a1' },
          Cheque:        { bg: '#fef9c3', color: '#92400e' },
        };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            {/* Payment mode badges */}
            {modes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {modes.map(m => {
                  const c = modeColors[m] || { bg: '#f1f5f9', color: '#475569' };
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
              ? <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.paidByName}</span>
              : modes.length === 0 && <span style={{ color: '#9ca3af' }}>—</span>
            }
          </div>
        );
      }
      case 'actions': return (
        <div className="exp-actions-cell">
          <StatusBadge s={exp.status} />
          <button className="exp-act-btn view-btn" title="View" onClick={() => handleViewExpense(exp)}><Eye size={14} /></button>
          <button className="exp-act-btn edit-btn" title="Edit" onClick={() => handleEditExpense(exp)}><Edit2 size={14} /></button>
          {canApprove && exp.status === 'Pending' && (
            <>
              <button className="exp-act-btn approve-btn" title="Approve" onClick={() => handleStatusChange(exp.id, 'Approved')}><CheckCircle size={14} /></button>
              <button className="exp-act-btn reject-btn" title="Reject" onClick={() => handleStatusChange(exp.id, 'Rejected')}><XCircle size={14} /></button>
            </>
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
    { id: 'total',      title: 'Total Expenses',     value: fmt(stats.totalExpenses),    icon: <IndianRupee size={32} />, color: '#ef4444', filterPatch: null },
    { id: 'approved',   title: 'Approved',            value: fmt(stats.approvedExpenses), icon: <CheckCircle size={32} />, color: '#22c55e', filterPatch: { status: 'Approved', category: 'all' } },
    { id: 'pending',    title: 'Pending Approval',    value: fmt(stats.pendingExpenses),  icon: <Clock size={32} />,       color: '#f59e0b', filterPatch: { status: 'Pending',  category: 'all' } },
    { id: 'travel',     title: 'Travel & Site Visit', value: fmt(stats.travelAndSiteVisit), icon: <Plane size={32} />,    color: '#3b82f6', filterPatch: { category: 'Travel', status: 'all' } },
    { id: 'commission', title: 'Total Commission',    value: fmt(stats.totalCommission),  icon: <Users size={32} />,       color: '#8b5cf6', filterPatch: { category: 'Commission', status: 'all' } },
    { id: 'advances',   title: 'Total Advances',      value: fmt(stats.totalAdvances),    icon: <Receipt size={32} />,     color: '#06b6d4', filterPatch: { expenseType: 'advance', status: 'all', category: 'all' } },
  ] : [];

  const handleKpiClick = (kpi) => {
    if (activeKpi === kpi.id || !kpi.filterPatch) {
      // clicking same card or "Total" → clear all KPI filters
      setActiveKpi(null);
      setFilters(prev => ({ ...prev, status: 'all', category: 'all', expenseType: 'all' }));
    } else {
      setActiveKpi(kpi.id);
      setFilters(prev => ({ ...prev, ...kpi.filterPatch }));
    }
    setCurrentPage(0);
  };

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
          <select className="exp-mgmt-filter" value={filters.category}
            onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setCurrentPage(0); setActiveKpi(null); }}>
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="exp-mgmt-filter" value={filters.status}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(0); setActiveKpi(null); }}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="exp-mgmt-filter" value={filters.paymentMode}
            onChange={(e) => { setFilters({ ...filters, paymentMode: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Modes</option>
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{formatPaymentMode(m)}</option>)}
          </select>
          <PCEDateRangeFilter
            appliedFrom={filters.dateFrom}
            appliedTo={filters.dateTo}
            onApply={(f,t)=>{ setFilters({...filters, dateFrom:f, dateTo:t}); setCurrentPage(0); }}
            onClear={()=>{ setFilters({...filters, dateFrom:'', dateTo:''}); setCurrentPage(0); }}
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
                  onChange={() => setColumns(prev => prev.map((c, i) =>
                    i === idx ? { ...c, visible: !c.visible } : c))} />
                <span>{col.label}</span>
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
              const isActive = activeKpi === kpi.id;
              return (
                <div
                  key={kpi.id}
                  className={`exp-mgmt-kpi-card${isActive ? ' exp-mgmt-kpi-card--active' : ''}${kpi.filterPatch ? ' exp-mgmt-kpi-card--clickable' : ''}`}
                  style={{ borderTopColor: kpi.color, boxShadow: isActive ? `0 0 0 2px ${kpi.color}` : undefined, cursor: kpi.filterPatch ? 'pointer' : 'default' }}
                  onClick={() => handleKpiClick(kpi)}
                  title={kpi.filterPatch ? `Click to filter: ${kpi.title}` : undefined}
                >
                  <div className="exp-mgmt-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                  <div className="exp-mgmt-kpi-content">
                    <div className="exp-mgmt-kpi-value">{kpi.value}</div>
                    <div className="exp-mgmt-kpi-label">{kpi.title}</div>
                    {isActive && (
                      <div style={{ fontSize: 10, marginTop: 3, color: kpi.color, fontWeight: 700 }}>● Filtering</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Active KPI filter indicator with clear button */}
          {activeKpi && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, color: '#1d4ed8', marginBottom: 4 }}>
              <CheckCircle size={13} />
              <span>Filtering by: <strong>{kpiData.find(k => k.id === activeKpi)?.title}</strong></span>
              <button
                onClick={() => { setActiveKpi(null); setFilters(prev => ({ ...prev, status: 'all', category: 'all', expenseType: 'all' })); setCurrentPage(0); }}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 5, cursor: 'pointer' }}>
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
              <select
                className="page-size-selector"
                value={pageSize}
                onChange={handlePageSizeChange}
              >
                <option value={10}>10 Rows</option>
                <option value={20}>20 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
              </select>
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
              id: newId, category: 'Travel', projectId: prev.projectId || '', amount: '', paymentMode: 'UPI', description: '',
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
                      <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}</option>
                        {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="exp-field">
                      <label>Sub-Group *</label>
                      <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                        <option value="">{!modalGroupName ? 'Select group first' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Sub-Group'}</option>
                        {modalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
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
                          border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px',
                          cursor: 'pointer', background: '#fff', fontSize: 13,
                          color: expenseFormData.paidByUserId ? '#111827' : '#9ca3af', minHeight: 38,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {expenseFormData.paidByUserId ? (() => {
                            const u = availableUsers.find(u => String(u.id) === String(expenseFormData.paidByUserId));
                            return u ? (
                              <>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              </>
                            ) : <span>Select user</span>;
                          })() : <span>Select user</span>}
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                      {paidByOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
                        }}>
                          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                            <input autoFocus type="text" placeholder="Search users..."
                              value={paidBySearch} onChange={e => setPaidBySearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            <div onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: '', paidByName: '' })); setPaidByOpen(false); }}
                              style={{ padding: '9px 12px', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >— None —</div>
                            {availableUsers.filter(u => !paidBySearch || (u.name || '').toLowerCase().includes(paidBySearch.toLowerCase())).map(u => (
                              <div key={u.id}
                                onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: String(u.id), paidByName: u.name || '' })); setPaidByOpen(false); }}
                                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: String(expenseFormData.paidByUserId) === String(u.id) ? '#eff6ff' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                onMouseLeave={e => e.currentTarget.style.background = String(expenseFormData.paidByUserId) === String(u.id) ? '#eff6ff' : 'transparent'}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, color: '#111827' }}>{u.name}</div>
                                  {u.role && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{u.role}</div>}
                                </div>
                              </div>
                            ))}
                            {availableUsers.filter(u => !paidBySearch || (u.name || '').toLowerCase().includes(paidBySearch.toLowerCase())).length === 0 && (
                              <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>No users found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="exp-field">
                      <label>Purpose / Description</label>
                      <input type="text" value={expenseFormData.tripReason} placeholder="e.g. Site visit, material transport…"
                        onChange={e => setExpenseFormData(p => ({ ...p, tripReason: e.target.value }))} />
                    </div>
                  </div>
                  <div className="exp-form-row2" style={{marginTop:10}}>
                    <div className="exp-field">
                      <label>Status</label>
                      <select value={expenseFormData.status || 'Approved'}
                        onChange={e => setExpenseFormData(p => ({ ...p, status: e.target.value }))}
                        style={{borderColor: expenseFormData.status === 'Approved' ? '#16a34a' : expenseFormData.status === 'Rejected' ? '#dc2626' : '#f59e0b'}}>
                        <option value="Approved">✅ Approved</option>
                        <option value="Pending">⏳ Pending</option>
                        <option value="Rejected">❌ Rejected</option>
                      </select>
                    </div>
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
                                <select
                                  value={EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Other'}
                                  onChange={e => updateItem(item.id, 'category', e.target.value === 'Other' ? '' : e.target.value)}>
                                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
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
                                <input type="number" step="0.01" min="0" placeholder="0.00" value={item.amount}
                                  onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Payment Mode</label>
                                <select value={item.paymentMode} onChange={e => updateItem(item.id, 'paymentMode', e.target.value)}>
                                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{formatPaymentMode(m)}</option>)}
                                </select>
                              </div>
                              <div className="exp-field exp-field-proj">
                                <label>Project * <span className="exp-field-hint">(required)</span></label>
                                <select value={item.projectId}
                                  onChange={e => updateItem(item.id, 'projectId', e.target.value)}
                                  disabled={!modalSubGroupName || isLoading}
                                  style={!item.projectId ? {borderColor:'#ef4444',boxShadow:'0 0 0 2px rgba(239,68,68,.15)'} : {}}>
                                  <option value="">{isLoading ? 'Loading…' : !modalSubGroupName ? 'Select sub-group first' : '— Select Project *'}</option>
                                  {projList.map(p => (
                                    <option key={p.id} value={String(p.id)}>{p.name}{p.location ? ` – ${p.location}` : ''}</option>
                                  ))}
                                </select>
                              </div>
                              {expenseFormData.expenseItems.length > 1 && (
                                <button className="exp-item-del-btn" onClick={() => removeItem(item.id)} title="Remove item">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            <div className="exp-field" style={{marginTop:4}}>
                              <input type="text" placeholder="Notes / description for this item…" value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="exp-items-total-bar">
                    <span>
                      Total — {(() => {
                        const projSet = new Set((expenseFormData.expenseItems||[]).filter(i=>i.projectId).map(i=>i.projectId));
                        return projSet.size > 1
                          ? <span style={{color:'#1d4ed8',fontWeight:600}}>splits into {projSet.size} separate project expenses on save</span>
                          : <span style={{color:'#64748b'}}>1 expense record</span>;
                      })()}
                    </span>
                    <strong className="exp-total-amt">{fmt(total)}</strong>
                  </div>
                </div>

                {/* ── Section 4: Bill Upload ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">4</span> Bill / Receipt Upload <span className="exp-field-hint">(max 10 MB)</span></div>
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
                        <select value={expenseFormData.adjustedAdvanceId || ''}
                          onChange={e => setExpenseFormData(p => ({ ...p, adjustedAdvanceId: e.target.value }))}>
                          <option value="">— No advance adjustment —</option>
                          {pendingAdvances.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.advanceCode} — {fmt(a.totalAmount)} ({a.projectId || a.groupName}) — {a.status}
                            </option>
                          ))}
                        </select>
                      </div>
                      {expenseFormData.adjustedAdvanceId && (
                        <div className="exp-field">
                          <label>Amount to Adjust (₹)</label>
                          <input type="number" min="0" step="0.01" placeholder="0.00"
                            value={expenseFormData.advanceAdjustedAmount || ''}
                            onChange={e => setExpenseFormData(p => ({ ...p, advanceAdjustedAmount: e.target.value }))} />
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
                    const projSet = new Set(items.filter(i => i.projectId).map(i => i.projectId));
                    const unassigned = items.filter(i => !i.projectId).length;
                    return (
                      <span className="exp-footer-total">
                        {items.length} item(s) · {fmt(total)}
                        {projSet.size > 1 && <span style={{color:'#1d4ed8',marginLeft:8}}>→ {projSet.size} project records</span>}
                        {unassigned > 0 && <span style={{color:'#ef4444',marginLeft:8}}>⚠ {unassigned} item(s) need a project</span>}
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
              id: newId, category: 'Travel', projectId: prev.projectId || '', amount: '', paymentMode: 'UPI', description: '',
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
                  {canApprove && expenseFormData.status === 'Pending' && (
                    <>
                      <button className="exp-btn-approve" onClick={() => { performStatusChange(expenseFormData.id, 'Approved'); setShowEditModal(false); }}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button className="exp-btn-reject" onClick={() => { performStatusChange(expenseFormData.id, 'Rejected'); setShowEditModal(false); }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
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
                      <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}</option>
                        {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="exp-field">
                      <label>Sub-Group *</label>
                      <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                        <option value="">{!modalGroupName ? 'Select group first' : 'Select Sub-Group'}</option>
                        {modalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
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
                          border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px',
                          cursor: 'pointer', background: '#fff', fontSize: 13,
                          color: expenseFormData.paidByUserId ? '#111827' : '#9ca3af', minHeight: 38,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {expenseFormData.paidByUserId ? (() => {
                            const u = availableUsers.find(u => String(u.id) === String(expenseFormData.paidByUserId));
                            return u ? (
                              <>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                              </>
                            ) : <span>Select user</span>;
                          })() : <span>Select user</span>}
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                      {editPaidByOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
                        }}>
                          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                            <input autoFocus type="text" placeholder="Search users..."
                              value={editPaidBySearch} onChange={e => setEditPaidBySearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            <div onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: '', paidByName: '' })); setEditPaidByOpen(false); }}
                              style={{ padding: '9px 12px', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >— None —</div>
                            {availableUsers.filter(u => !editPaidBySearch || (u.name || '').toLowerCase().includes(editPaidBySearch.toLowerCase())).map(u => (
                              <div key={u.id}
                                onClick={() => { setExpenseFormData(p => ({ ...p, paidByUserId: String(u.id), paidByName: u.name || '' })); setEditPaidByOpen(false); }}
                                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: String(expenseFormData.paidByUserId) === String(u.id) ? '#eff6ff' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                onMouseLeave={e => e.currentTarget.style.background = String(expenseFormData.paidByUserId) === String(u.id) ? '#eff6ff' : 'transparent'}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, color: '#111827' }}>{u.name}</div>
                                  {u.role && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{u.role}</div>}
                                </div>
                              </div>
                            ))}
                            {availableUsers.filter(u => !editPaidBySearch || (u.name || '').toLowerCase().includes(editPaidBySearch.toLowerCase())).length === 0 && (
                              <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>No users found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="exp-field">
                      <label>Status</label>
                      <select value={expenseFormData.status}
                        onChange={e => setExpenseFormData(p => ({ ...p, status: e.target.value }))}
                        disabled={!canApprove && expenseFormData.status !== 'Pending'}>
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="exp-field" style={{marginTop:8}}>
                    <label>Purpose / Description</label>
                    <input type="text" value={expenseFormData.tripReason} placeholder="e.g. Site visit, material transport…"
                      onChange={e => setExpenseFormData(p => ({ ...p, tripReason: e.target.value }))} />
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
                                <select
                                  value={EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Other'}
                                  onChange={e => updateItem(item.id, 'category', e.target.value === 'Other' ? '' : e.target.value)}>
                                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
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
                                <input type="number" step="0.01" min="0" value={item.amount}
                                  onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Payment Mode</label>
                                <select value={item.paymentMode} onChange={e => updateItem(item.id, 'paymentMode', e.target.value)}>
                                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{formatPaymentMode(m)}</option>)}
                                </select>
                              </div>
                              <div className="exp-field exp-field-proj">
                                <label>Project * <span className="exp-field-hint">(required)</span></label>
                                <select value={item.projectId}
                                  onChange={e => updateItem(item.id, 'projectId', e.target.value)}
                                  disabled={isLoading}
                                  style={!item.projectId ? {borderColor:'#ef4444',boxShadow:'0 0 0 2px rgba(239,68,68,.15)'} : {}}>
                                  <option value="">{isLoading ? 'Loading…' : '— Select Project *'}</option>
                                  {projList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                                  {/* Show current project if not yet in list */}
                                  {item.projectId && !projList.find(p => String(p.id) === String(item.projectId)) && !isLoading && (
                                    <option key={item.projectId} value={item.projectId}>Project #{item.projectId} (current)</option>
                                  )}
                                </select>
                              </div>
                              {expenseFormData.expenseItems.length > 1 && (
                                <button className="exp-item-del-btn" onClick={() => removeItem(item.id)}><Trash2 size={13} /></button>
                              )}
                            </div>
                            <div className="exp-field" style={{marginTop:4}}>
                              <input type="text" placeholder="Notes…" value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="exp-items-total-bar">
                    <span>
                      Total — {(() => {
                        const projSet = new Set((expenseFormData.expenseItems||[]).filter(i=>i.projectId).map(i=>i.projectId));
                        return projSet.size > 1
                          ? <span style={{color:'#1d4ed8',fontWeight:600}}>splits into {projSet.size} separate project expenses on save</span>
                          : <span style={{color:'#64748b'}}>1 expense record</span>;
                      })()}
                    </span>
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

                {/* ── Approval section for managers ── */}
                {canApprove && (
                  <div className="exp-modal-section exp-approval-section">
                    <div className="exp-section-label"><span className="exp-section-num">5</span> Approval</div>
                    <div className="exp-approval-info">
                      <span>Status: <strong><StatusBadge s={expenseFormData.status} /></strong></span>
                      <span className="exp-approval-hint">You can approve or reject using the buttons in the header above.</span>
                    </div>
                  </div>
                )}
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
                    <span className="exp-view-val" style={{fontWeight:700,color:'#15803d',fontSize:15}}>{fmt(viewModalExpense.totalAmount)}</span>
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
                        <td style={{color:'#94a3b8',fontSize:12}}>{i+1}</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <CategoryIcon cat={item.category} />
                            <span style={{fontWeight:500}}>{item.category}</span>
                          </div>
                        </td>
                        <td style={{color:'#64748b'}}>{item.description || '—'}</td>
                        <td style={{color:'#64748b'}}>
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
                      <td colSpan={4} style={{fontWeight:600,color:'#374151',padding:'10px 12px'}}>Total</td>
                      <td style={{textAlign:'right',fontWeight:800,fontSize:15,color:'#111827',padding:'10px 12px'}}>
                        {fmt((viewModalExpense.expenseItems||[]).reduce((s,i)=>s+(parseFloat(i.amount)||0),0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Receipt */}
              {viewModalExpense.receiptUrl && (
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">3</span> Bill / Receipt</div>
                  <a href={viewModalExpense.receiptUrl} target="_blank" rel="noreferrer" className="exp-receipt-link">
                    <FileText size={14} /> View Receipt
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="exp-modal-footer">
              <div className="exp-modal-footer-left">
                <span className="exp-footer-total">{(viewModalExpense.expenseItems||[]).length} item(s) · {fmt(viewModalExpense.totalAmount)}</span>
              </div>
              <div className="exp-modal-footer-right">
                {canApprove && viewModalExpense.status === 'Pending' && (
                  <>
                    <button className="exp-btn-approve" onClick={() => { handleStatusChange(viewModalExpense.id,'Approved'); setShowViewModal(false); }}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button className="exp-btn-reject" onClick={() => { handleStatusChange(viewModalExpense.id,'Rejected'); setShowViewModal(false); }}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>
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
                <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
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
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Mode</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(itemsModalExpense.expenseItems || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', color: '#94a3b8', fontSize: 13 }}>{i + 1}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <CategoryIcon cat={item.category} />
                          <span style={{ fontWeight: 500 }}>{item.category}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{item.description || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                          <CreditCard size={13} />{formatPaymentMode(item.paymentMode)}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <td colSpan={4} style={{ padding: '12px', fontWeight: 600, color: '#374151' }}>Total</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#111827', fontSize: 15 }}>
                      {fmt((itemsModalExpense.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectCostExpenseManagement;