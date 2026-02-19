import React, { useState, useEffect, useRef } from 'react';
import { FaEye, FaEdit, FaTrash, FaFilePdf, FaCalendarAlt, FaFileAlt, FaRegTrashAlt } from 'react-icons/fa';
import '../pages-css/Proposals.css';
import { useAuth } from "../hooks/useAuth.js";
import GroupCategoryFilter from "./../components/Dropdowns/groupCategoryFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import UnitTypeDropdown from '../components/Dropdowns/Unittypedropdown.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const DEFAULT_TEMPLATE = {
  companyName: "SESOLA POWER PROJECTS PROPOSAL PVT LTD",
  aboutUs: `We are a leading provider of renewable energy solutions with expertise in solar power systems. Our team of experienced professionals is committed to delivering high-quality, sustainable energy solutions that meet the unique needs of our clients.\n\nWith years of experience in the industry, we have successfully completed numerous projects across various sectors, establishing ourselves as a trusted partner in the transition to clean energy.`,
  aboutSystem: `The proposed solar power system is designed to provide reliable, efficient, and sustainable energy generation. The system includes high-efficiency solar panels, advanced inverters, robust mounting structures, and comprehensive monitoring systems.\n\nKey features:\n- High-efficiency solar panels with excellent performance\n- Grid-tied inverter system for optimal power conversion\n- Durable mounting structures with wind load certification\n- Remote monitoring and management capabilities\n- Comprehensive safety features and protection systems`,
  paymentTerms: `1. 30% advance payment upon signing of agreement\n2. 40% payment on delivery of materials at site\n3. 30% payment on successful commissioning and handover\n\nPayment can be made via bank transfer, cheque, or demand draft in favor of SESOLA POWER PROJECTS PROPOSAL PVT LTD.`,
  defectLiabilityPeriod: `Standard 12 months warranty period from date of commissioning and handover.\n\nDuring this period, any defects in workmanship, materials, or performance will be rectified free of cost.`,
  systemPricing: [],
  bomItems: []
};

// ── All columns definition ─────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'leadName',    label: 'Lead Name',   sortable: true,  required: false },
  { key: 'groupName',   label: 'Group',       sortable: true,  required: false },
  { key: 'subGroupName',label: 'Category',    sortable: true,  required: false },
  { key: 'proposalNo',  label: 'Proposal No', sortable: true,  required: false },
  { key: 'title',       label: 'Title',       sortable: true,  required: false },
  { key: 'totalValue',  label: 'Value (₹)',   sortable: true,  required: false },
  { key: 'version',     label: 'Version',     sortable: true,  required: false },
  { key: 'status',      label: 'Status',      sortable: true,  required: false },
  { key: 'preparedByName', label: 'Prepared By', sortable: true, required: false },
  { key: 'updatedAt',   label: 'Updated',     sortable: true,  required: false },
  { key: 'actions',     label: 'Actions',     sortable: false, required: true  },
];

const DEFAULT_VISIBLE = ['leadName', 'groupName', 'totalValue', 'status', 'updatedAt', 'actions'];
const DEFAULT_ORDER   = ALL_COLUMNS.map(c => c.key);

// ── Column Visibility Dropdown ────────────────────────────────
const ColumnVisibilityDropdown = ({ columns, visibleColumns, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hiddenCount = columns.filter(c => !c.required && !visibleColumns.includes(c.key)).length;

  return (
    <div className="p-col-vis-wrap" ref={ref}>
      <button className={`p-col-vis-btn ${hiddenCount > 0 ? 'has-hidden' : ''}`} onClick={() => setOpen(o => !o)} title="Show/hide columns">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Columns
        {hiddenCount > 0 && <span className="p-col-vis-badge">{hiddenCount}</span>}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="11" height="11" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-col-vis-dropdown">
          <div className="p-col-vis-hdr">
            <span>Toggle Columns</span>
            <button className="p-col-vis-reset" onClick={onReset}>Reset</button>
          </div>
          <div className="p-col-vis-list">
            {columns.map(col => (
              <label key={col.key} className={`p-col-vis-item ${col.required ? 'p-col-required' : ''}`}>
                <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => !col.required && onToggle(col.key)} disabled={col.required} />
                <span className="p-col-vis-label">{col.label}</span>
                {col.required && <span className="p-col-req-tag">required</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Draggable Header Cell ─────────────────────────────────────
const DraggableHeaderCell = ({ col, index, sortCol, sortDir, onSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) => (
  <th
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    onDragEnd={onDragEnd}
    className={`p-th-draggable${isDragOver ? ' p-th-drag-over' : ''}${col.key === 'actions' ? ' p-th-actions' : ''}`}
    onClick={() => col.sortable && onSort(col.key)}
    style={{ cursor: col.sortable ? 'pointer' : 'grab' }}
  >
    <div className="p-th-inner">
      <span className="p-drag-dots" title="Drag to reorder">
        <svg fill="currentColor" viewBox="0 0 24 24" width="9" height="9">
          <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
        </svg>
      </span>
      <span>{col.label}</span>
      {col.sortable && (
        <span className={`p-sort-icon ${sortCol === col.key ? 'active' : ''}`}>
          {sortCol === col.key
            ? (sortDir === 'asc'
                ? <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/></svg>
                : <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>)
            : <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12" style={{opacity:.3}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
          }
        </span>
      )}
    </div>
  </th>
);

// ── Main Component ────────────────────────────────────────────
const ProposalsWithTemplate = () => {
  const { user, pagePermissions } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();

  const permissions = {
    VIEW:     pagePermissions?.PROPOSALS?.includes('VIEW'),
    CREATE:   pagePermissions?.PROPOSALS?.includes('CREATE'),
    EDIT:     pagePermissions?.PROPOSALS?.includes('EDIT'),
    DELETE:   pagePermissions?.PROPOSALS?.includes('DELETE'),
    APPROVE:  pagePermissions?.PROPOSALS?.includes('APPROVE'),
    DOWNLOAD: pagePermissions?.PROPOSALS?.includes('DOWNLOAD')
  };

  const currentUser = { id: user.id, role: user.role, name: user.name };

  // ── Column state ─────────────────────────────────────────────
  const [columnOrder,    setColumnOrder]    = useState(DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [sortCol,        setSortCol]        = useState('');
  const [sortDir,        setSortDir]        = useState('asc');
  const dragIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // ── Data state ───────────────────────────────────────────────
  const [bomItemsMaster, setBomItemsMaster] = useState([]);
  const [filteredBomItems, setFilteredBomItems] = useState({});
  const [showBomDropdown,  setShowBomDropdown]  = useState({});
  const [proposals, setProposals] = useState([]);
  const [sortedProposals, setSortedProposals] = useState([]);
  const [leads,    setLeads]    = useState([]);
  const [users,    setUsers]    = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [subGroups,setSubGroups]= useState([]);
  const [loading,  setLoading]  = useState(false);

  // ── Pagination ───────────────────────────────────────────────
  const [currentPage,    setCurrentPage]    = useState(1);
  const [rowsPerPage,    setRowsPerPage]    = useState(10);
  const [totalProposals, setTotalProposals] = useState(0);
  const [totalPages,     setTotalPages]     = useState(0);

  // ── Filters ──────────────────────────────────────────────────
  const [searchTerm,       setSearchTerm]       = useState('');
  const [filterStatus,     setFilterStatus]     = useState('All');
  const [filterPreparedBy, setFilterPreparedBy] = useState('All');

  // ── Modals ───────────────────────────────────────────────────
  const [showViewModal,     setShowViewModal]     = useState(false);
  const [showCreateModal,   setShowCreateModal]   = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [deleteProposalId,  setDeleteProposalId]  = useState(null);
  const [deleteProposalTitle, setDeleteProposalTitle] = useState('');
  const [isEditMode,        setIsEditMode]        = useState(false);
  const [selectedProposal,  setSelectedProposal]  = useState(null);
  const [activeTab,         setActiveTab]         = useState('company');

  const [customUnitInputs, setCustomUnitInputs] = useState({});

  const [formData, setFormData] = useState({
    leadId: '', title: '', description: '', totalValue: '',
    groupName: '', subGroupName: '', status: 'Draft'
  });

  const [templateData, setTemplateData] = useState({
    companyName: DEFAULT_TEMPLATE.companyName,
    aboutUs: DEFAULT_TEMPLATE.aboutUs,
    aboutSystem: DEFAULT_TEMPLATE.aboutSystem,
    paymentTerms: DEFAULT_TEMPLATE.paymentTerms,
    defectLiabilityPeriod: DEFAULT_TEMPLATE.defectLiabilityPeriod,
    systemPricing: [],
    bomItems: []
  });

  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // ── Derived: ordered visible columns ────────────────────────
  const orderedVisibleCols = columnOrder
    .map(k => ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && visibleColumns.includes(c.key));

  // ── Column drag handlers ─────────────────────────────────────
  const handleColDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('p-th-dragging');
  };
  const handleColDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisibleCols.map(c => c.key);
    const fromKey = visKeys[fromIdx];
    const toKey   = visKeys[dropIdx];
    const newOrder = [...columnOrder];
    const a = newOrder.indexOf(fromKey);
    const b = newOrder.indexOf(toKey);
    newOrder.splice(a, 1);
    newOrder.splice(b, 0, fromKey);
    setColumnOrder(newOrder);
    setDragOverIdx(null);
    dragIdx.current = null;
  };
  const handleColDragEnd = (e) => {
    e.currentTarget.classList.remove('p-th-dragging');
    setDragOverIdx(null);
    dragIdx.current = null;
  };

  // ── Column visibility handlers ───────────────────────────────
  const handleToggleCol = (key) => setVisibleColumns(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  const handleResetCols = () => { setColumnOrder(DEFAULT_ORDER); setVisibleColumns(DEFAULT_VISIBLE); };

  // ── Sort handler ─────────────────────────────────────────────
  const handleSort = (key) => {
    const dir = sortCol === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(key); setSortDir(dir);
    const sorted = [...sortedProposals].sort((a, b) => {
      const av = a[key] ?? ''; const bv = b[key] ?? '';
      return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    setSortedProposals(sorted);
  };

  // Keep sortedProposals in sync when proposals change
  useEffect(() => { setSortedProposals(proposals); }, [proposals]);

  // ── Helpers ──────────────────────────────────────────────────
  const formatDateTime = (ds) => {
    if (!ds) return '-';
    const d = new Date(ds);
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const parseJSON = (s) => {
    if (!s) return null;
    try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
  };

  const getStatusClass = (status) => ({
    'Draft':'status-draft','Sent':'status-sent','Approved':'status-approved',
    'Rejected':'status-rejected','On Hold':'status-hold'
  }[status] || 'status-draft');

  const fetchWithHeaders = async (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json', 'User-Id': currentUser.id.toString(), 'User-Role': currentUser.role, ...options.headers };
    const res = await fetch(url, { ...options, headers, credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  };

  // ── Fetch functions ──────────────────────────────────────────
  const fetchProposals = async () => {
    setLoading(true);
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/getAll?page=${currentPage-1}&size=${rowsPerPage}&groupName=${groupName||''}&subGroupName=${subGroupName||''}`);
      if (data.success) { setProposals(data.data.content||[]); setTotalProposals(data.data.totalElements||0); setTotalPages(data.data.totalPages||0); }
    } catch(e) { showError('Failed to fetch proposals'); }
    finally { setLoading(false); }
  };

  const fetchLeads = async (g=null, sg=null) => {
    try {
      let url = `${API_BASE_URL}/leads/by-group-subgroup?`;
      if (g) url += `groupName=${encodeURIComponent(g)}&`;
      if (sg) url += `subGroupName=${encodeURIComponent(sg)}`;
      const data = await fetchWithHeaders(url);
      if (data.success) setLeads(Array.isArray(data.data) ? data.data : data.data.content || []);
    } catch { setLeads([]); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-users`, { credentials:'include', headers:{'User-Id':currentUser.id,'User-Role':currentUser.role} });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch { setUsers([]); }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, { credentials:'include', headers:{'User-Id':currentUser.id,'User-Role':currentUser.role} });
      const data = await res.json();
      if (Array.isArray(data)) setGroups(data);
    } catch { setGroups([]); }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) { setSubGroups([]); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, { credentials:'include', headers:{'User-Id':currentUser.id,'User-Role':currentUser.role} });
      const data = await res.json();
      if (Array.isArray(data)) setSubGroups(data);
    } catch { setSubGroups([]); }
  };

  const fetchBomItemsMaster = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/bom-items-master/all`, { credentials:'include', headers:{'User-Id':currentUser.id,'User-Role':currentUser.role} });
      const data = await res.json();
      if (data.success) setBomItemsMaster(data.data || []);
    } catch { setBomItemsMaster([]); }
  };

  const handleBomItemSearch = async (index, term) => {
    if (!term || term.length < 2) { setFilteredBomItems(p=>({...p,[index]:[]})); setShowBomDropdown(p=>({...p,[index]:false})); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/bom-items-master/search?searchTerm=${encodeURIComponent(term)}`, { credentials:'include', headers:{'User-Id':currentUser.id,'User-Role':currentUser.role} });
      const data = await res.json();
      setFilteredBomItems(p=>({...p,[index]:data.data||[]}));
      setShowBomDropdown(p=>({...p,[index]:(data.data||[]).length>0}));
    } catch { setFilteredBomItems(p=>({...p,[index]:[]})); setShowBomDropdown(p=>({...p,[index]:false})); }
  };

  const selectBomItem = (index, bomItem) => {
    const updated = [...templateData.bomItems];
    updated[index] = { ...updated[index], item: bomItem.itemName, specification: bomItem.specification||'', unit: bomItem.defaultUnit||'Nos', tax: bomItem.defaultTaxPercent||'18' };
    setTemplateData({ ...templateData, bomItems: updated });
    setShowBomDropdown(p=>({...p,[index]:false}));
    setFilteredBomItems(p=>({...p,[index]:[]}));
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/filter`, {
        method:'POST',
        body: JSON.stringify({ searchTerm:searchTerm||null, filterStatus:filterStatus!=='All'?filterStatus:null, filterGroup:groupName||null, filterSubGroup:subGroupName||null, filterPreparedBy:filterPreparedBy!=='All'?parseInt(filterPreparedBy):null, page:currentPage-1, size:rowsPerPage })
      });
      if (data.success) { setProposals(data.data.content||[]); setTotalProposals(data.data.totalElements||0); setTotalPages(data.data.totalPages||0); }
    } catch { showError('Failed to filter proposals'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.leadId) { showWarning('Please fill in Title and Lead'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/create`, { method:'POST', body: JSON.stringify({ ...formData, ...templateData, systemPricing: JSON.stringify(templateData.systemPricing), bomItems: JSON.stringify(templateData.bomItems) }) });
      if (data.success) { showSuccess('Proposal created successfully!'); setShowCreateModal(false); setShowTemplateModal(false); resetForm(); fetchProposals(); }
    } catch { showError('Failed to create proposal'); }
  };

  const handleUpdate = async () => {
    if (!formData.title) { showError('Please fill in Title'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/update/${selectedProposal.id}`, { method:'PUT', body: JSON.stringify({ ...formData, ...templateData, systemPricing: JSON.stringify(templateData.systemPricing), bomItems: JSON.stringify(templateData.bomItems) }) });
      if (data.success) { showSuccess(data.message||'Saved successfully!'); setShowCreateModal(false); setShowTemplateModal(false); resetForm(); fetchProposals(); }
      else showError(data.message||'Failed to save');
    } catch { showError('Failed to update proposal'); }
  };

  const handleDeleteClick = (id, title) => { setDeleteProposalId(id); setDeleteProposalTitle(title); setShowDeleteModal(true); };

  const handleDelete = async () => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/delete/${deleteProposalId}`, { method:'DELETE' });
      if (data.success) { showSuccess('Proposal deleted!'); setShowDeleteModal(false); fetchProposals(); }
    } catch { showError('Failed to delete'); setShowDeleteModal(false); }
  };

  const handleDownloadPDF = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/download-pdf/${id}`, { credentials:'include', headers:{'User-Id':currentUser.id.toString(),'User-Role':currentUser.role} });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=`proposal-${id}.pdf`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { showError('Failed to download PDF'); }
  };

  const handleView = async (id) => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/${id}`);
      if (data.success) { setSelectedProposal(data.data); setShowViewModal(true); }
    } catch { showError('Failed to fetch proposal details'); }
  };

  const handleEdit = (proposal) => {
    setSelectedProposal(proposal);
    setFormData({ leadId: proposal.leadId||'', title: proposal.title||'', description: proposal.description||'', totalValue: proposal.totalValue||'', groupName: proposal.groupName||'', subGroupName: proposal.subGroupName||'', status: proposal.status||'Draft' });
    setTemplateData({ companyName: proposal.companyName||DEFAULT_TEMPLATE.companyName, aboutUs: proposal.aboutUs||DEFAULT_TEMPLATE.aboutUs, aboutSystem: proposal.aboutSystem||DEFAULT_TEMPLATE.aboutSystem, paymentTerms: proposal.paymentTerms||DEFAULT_TEMPLATE.paymentTerms, defectLiabilityPeriod: proposal.defectLiabilityPeriod||DEFAULT_TEMPLATE.defectLiabilityPeriod, systemPricing: parseJSON(proposal.systemPricing)||[], bomItems: parseJSON(proposal.bomItems)||[] });
    setIsEditMode(true); setShowCreateModal(true); setShowViewModal(false);
  };

  const resetForm = () => {
    setFormData({ leadId:'', title:'', description:'', totalValue:'', groupName:groupName||'', subGroupName:subGroupName||'', status:'Draft' });
    setTemplateData({ companyName: DEFAULT_TEMPLATE.companyName, aboutUs: DEFAULT_TEMPLATE.aboutUs, aboutSystem: DEFAULT_TEMPLATE.aboutSystem, paymentTerms: DEFAULT_TEMPLATE.paymentTerms, defectLiabilityPeriod: DEFAULT_TEMPLATE.defectLiabilityPeriod, systemPricing:[], bomItems:[] });
    setIsEditMode(false); setSelectedProposal(null); setActiveTab('company'); setCustomUnitInputs({});
  };

  const addSystemPricingRow = () => setTemplateData({...templateData, systemPricing:[...templateData.systemPricing,{item:'',description:'',amount:''}]});
  const updateSystemPricingRow = (i,f,v) => { const u=[...templateData.systemPricing]; u[i][f]=v; setTemplateData({...templateData,systemPricing:u}); };
  const removeSystemPricingRow = (i) => setTemplateData({...templateData, systemPricing:templateData.systemPricing.filter((_,idx)=>idx!==i)});

  const addBOMRow = () => setTemplateData({...templateData, bomItems:[...templateData.bomItems,{item:'',specification:'',quantity:'',unit:'Nos',rate:'',tax:'18',amount:''}]});
  const updateBOMRow = (i,f,v) => {
    const u=[...templateData.bomItems]; u[i][f]=v;
    if (['quantity','rate','tax'].includes(f)) {
      const q=parseFloat(u[i].quantity)||0, r=parseFloat(u[i].rate)||0, t=parseFloat(u[i].tax)||0;
      u[i].amount = ((q*r)+(q*r*t/100)).toFixed(2);
    }
    setTemplateData({...templateData,bomItems:u});
  };
  const removeBOMRow = (i) => { setTemplateData({...templateData,bomItems:templateData.bomItems.filter((_,idx)=>idx!==i)}); const nc={...customUnitInputs}; delete nc[i]; setCustomUnitInputs(nc); };
  const calculateBOMTotals = () => {
    const sub = templateData.bomItems.reduce((s,it)=>s+(parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0),0);
    const tax = templateData.bomItems.reduce((s,it)=>{ const st=(parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0); return s+(st*(parseFloat(it.tax)||0)/100); },0);
    const grand = templateData.bomItems.reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
    return { subtotal:sub.toFixed(2), totalTax:tax.toFixed(2), grandTotal:grand.toFixed(2) };
  };
  const calculateSystemPricingTotal = () => templateData.systemPricing.reduce((s,it)=>s+(parseFloat(it.amount)||0),0).toFixed(2);
  const handleBomUnitChange = (i,v) => {
    if (v==='Custom') { setCustomUnitInputs(p=>({...p,[i]:''})); updateBOMRow(i,'unit',''); }
    else { const n={...customUnitInputs}; delete n[i]; setCustomUnitInputs(n); updateBOMRow(i,'unit',v); }
  };
  const handleCustomUnitInput = (i,v) => { setCustomUnitInputs(p=>({...p,[i]:v})); updateBOMRow(i,'unit',v); };

  // ── Cell renderer ────────────────────────────────────────────
  const renderCell = (p, key) => {
    switch(key) {
      case 'leadName':     return p.leadName || '-';
      case 'groupName':    return p.groupName || '-';
      case 'subGroupName': return p.subGroupName || '-';
      case 'proposalNo':   return <span className="p-cell-code">{p.proposalNo}</span>;
      case 'title':        return <span className="p-cell-title">{p.title}</span>;
      case 'totalValue':   return `₹${p.totalValue ? parseFloat(p.totalValue).toLocaleString('en-IN') : '0'}`;
      case 'version':      return <span className="p-cell-version">v{p.version}</span>;
      case 'status':       return <span className={`p-status-badge ${getStatusClass(p.status)}`}>{p.status}</span>;
      case 'preparedByName': return p.preparedByName || '-';
      case 'updatedAt':    return formatDateTime(p.updatedAt);
      case 'actions':      return (
        <div className="p-actions-cell">
          <button className="p-action-btn p-act-view"   onClick={() => handleView(p.id)}           title="View"><FaEye /></button>
          {permissions.EDIT && <button className="p-action-btn p-act-edit" onClick={() => handleEdit(p)} title="Edit"><FaEdit /></button>}
          <button className="p-action-btn p-act-pdf"    onClick={() => handleDownloadPDF(p.id)}    title="Download PDF"><FaFilePdf /></button>
          {permissions.DELETE && <button className="p-action-btn p-act-delete" onClick={() => handleDeleteClick(p.id, p.title)} title="Delete"><FaRegTrashAlt /></button>}
        </div>
      );
      default: return '-';
    }
  };

  // ── Pagination slice ─────────────────────────────────────────
  const startIdx = (currentPage - 1) * rowsPerPage;
  const pageData = sortedProposals; // server already pages

  // ── Effects ──────────────────────────────────────────────────
  useEffect(() => { if (permissions.VIEW) fetchProposals(); }, [currentPage, rowsPerPage, groupName, subGroupName]);
  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.bom-item-input-container')) setShowBomDropdown({}); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  useEffect(() => { fetchLeads(); fetchUsers(); fetchGroups(); fetchBomItemsMaster(); }, []);
  useEffect(() => { if (formData.groupName||formData.subGroupName) fetchLeads(formData.groupName,formData.subGroupName); }, [formData.groupName,formData.subGroupName]);
  useEffect(() => { if (formData.groupName) fetchSubGroupsForForm(formData.groupName); else setSubGroups([]); }, [formData.groupName]);
  useEffect(() => {
    if (searchTerm||filterStatus!=='All'||filterPreparedBy!=='All') {
      const t = setTimeout(handleFilter, 500);
      return () => clearTimeout(t);
    } else fetchProposals();
  }, [searchTerm, filterStatus, filterPreparedBy]);

  if (!permissions.VIEW) return (
    <div className="p-container"><div className="p-no-permission">You don't have permission to view proposals.</div></div>
  );

  return (
    <div className="p-container">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="p-breadcrumb">Dashboard &gt; Proposals</div>
      <div className="page-header-with-filter p-page-hdr">
        <h1 className="p-page-title">Proposals</h1>
        <GroupCategoryFilter groupValue={groupName} subGroupValue={subGroupName} onChange={updateFilters} />
      </div>

      {/* Action bar */}
      <div className="p-action-bar">
        <div className="p-search-filters">
          <div className="p-search-wrap">
            <svg className="p-search-ico" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" className="p-search-input" placeholder="Search proposals..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          </div>
          <select className="p-filter-sel" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="On Hold">On Hold</option>
          </select>
          <select className="p-filter-sel" value={filterPreparedBy} onChange={e=>setFilterPreparedBy(e.target.value)}>
            <option value="All">All Members</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="p-action-btns">
          {permissions.CREATE && (
            <button className="p-btn p-btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New Proposal
            </button>
          )}
        </div>
      </div>

      {/* Table toolbar */}
      <div className="p-table-toolbar">
        <span className="p-toolbar-info">{totalProposals} proposal{totalProposals !== 1 ? 's' : ''}</span>
        <ColumnVisibilityDropdown columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleCol} onReset={handleResetCols} />
      </div>

      {/* Table */}
      <div className="p-table-card">
        <div className="p-table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                {orderedVisibleCols.map((col, idx) => (
                  <DraggableHeaderCell key={col.key} col={col} index={idx} sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
                    onDragStart={handleColDragStart} onDragOver={handleColDragOver} onDrop={handleColDrop} onDragEnd={handleColDragEnd}
                    isDragOver={dragOverIdx === idx} />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={orderedVisibleCols.length} className="p-td-center p-td-loading">
                  <div className="p-loading-spinner"></div> Loading...
                </td></tr>
              ) : pageData.length === 0 ? (
                <tr><td colSpan={orderedVisibleCols.length} className="p-td-center p-td-empty">
                  No proposals found. {permissions.CREATE && 'Create one to get started.'}
                </td></tr>
              ) : pageData.map(p => (
                <tr key={p.id} className="p-tr">
                  {orderedVisibleCols.map(col => (
                    <td key={col.key} className={col.key === 'actions' ? 'p-td-actions' : ''}>{renderCell(p, col.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-pagination">
          <div className="p-pagination-info">
            {totalProposals > 0
              ? `Showing ${((currentPage-1)*rowsPerPage)+1} – ${Math.min(currentPage*rowsPerPage, totalProposals)} of ${totalProposals}`
              : 'No entries'}
          </div>
          <div className="p-pagination-ctrl">
            <select className="p-rows-sel" value={rowsPerPage} onChange={e=>{setRowsPerPage(Number(e.target.value));setCurrentPage(1);}}>
              <option value={10}>10 rows</option><option value={25}>25 rows</option>
              <option value={50}>50 rows</option><option value={100}>100 rows</option>
            </select>
            <button className="p-page-btn" onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}>Prev</button>
            <span className="p-page-cur">Page {currentPage} of {totalPages||1}</span>
            <button className="p-page-btn" onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages||totalPages===0}>Next</button>
          </div>
        </div>
      </div>

      {/* ── Delete Modal ── */}
      {showDeleteModal && (
        <div className="p-modal-overlay" onClick={()=>setShowDeleteModal(false)}>
          <div className="p-delete-modal" onClick={e=>e.stopPropagation()}>
            <div className="p-delete-icon-wrap"><div className="p-delete-icon-circle">!</div></div>
            <h2 className="p-delete-title">Delete Proposal</h2>
            <p className="p-delete-text">Are you sure you want to delete "<strong>{deleteProposalTitle}</strong>"? This action cannot be undone.</p>
            <div className="p-delete-actions">
              <button className="p-btn p-btn-secondary" onClick={()=>setShowDeleteModal(false)}>Cancel</button>
              <button className="p-btn p-btn-danger" onClick={handleDelete}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {showViewModal && selectedProposal && (
        <div className="p-modal-overlay" onClick={()=>setShowViewModal(false)}>
          <div className="p-modal p-modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="p-modal-hdr">
              <div>
                <h2>Proposal Details</h2>
                <span className="p-modal-subtitle">{selectedProposal.proposalNo} · v{selectedProposal.version}</span>
              </div>
              <button className="p-modal-close" onClick={()=>setShowViewModal(false)}>×</button>
            </div>
            <div className="p-modal-body">
              <div className="p-view-card">
                <div className="p-view-card-hdr">
                  <div>
                    <p className="p-view-company">{selectedProposal.companyName||'SESOLA POWER PROJECTS PROPOSAL PVT LTD'}</p>
                    <h3 className="p-view-title">{selectedProposal.title}</h3>
                  </div>
                  <span className={`p-status-badge ${getStatusClass(selectedProposal.status)}`}>{selectedProposal.status}</span>
                </div>
                <div className="p-info-grid">
                  {[['Created', formatDateTime(selectedProposal.createdAt)],['Updated', formatDateTime(selectedProposal.updatedAt)],['Prepared By', selectedProposal.preparedByName],['Value', `₹${selectedProposal.totalValue?parseFloat(selectedProposal.totalValue).toLocaleString('en-IN'):'0'}`],['Group', selectedProposal.groupName||'-'],['Sub-Group', selectedProposal.subGroupName||'-']].map(([l,v])=>(
                    <div key={l} className="p-info-item"><span className="p-info-label">{l}</span><span className="p-info-val">{v}</span></div>
                  ))}
                </div>
              </div>

              {selectedProposal.description && <div className="p-view-section"><h4>Description</h4><p>{selectedProposal.description}</p></div>}
              {selectedProposal.aboutUs && <div className="p-view-section"><h4>About Us</h4><p style={{whiteSpace:'pre-wrap'}}>{selectedProposal.aboutUs}</p></div>}
              {selectedProposal.aboutSystem && <div className="p-view-section"><h4>About System</h4><p style={{whiteSpace:'pre-wrap'}}>{selectedProposal.aboutSystem}</p></div>}

              {selectedProposal.systemPricing && parseJSON(selectedProposal.systemPricing)?.length > 0 && (
                <div className="p-view-section">
                  <h4>System Pricing</h4>
                  <table className="p-inner-table">
                    <thead><tr><th>Item</th><th>Description</th><th>Amount (₹)</th></tr></thead>
                    <tbody>
                      {parseJSON(selectedProposal.systemPricing).map((it,i)=><tr key={i}><td>{it.item}</td><td>{it.description}</td><td>₹{parseFloat(it.amount||0).toLocaleString('en-IN')}</td></tr>)}
                      <tr className="p-total-row"><td colSpan="2" style={{textAlign:'right'}}>Total:</td><td>₹{parseJSON(selectedProposal.systemPricing).reduce((s,it)=>s+(parseFloat(it.amount)||0),0).toLocaleString('en-IN')}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {selectedProposal.paymentTerms && <div className="p-view-section"><h4>Payment Terms</h4><p style={{whiteSpace:'pre-wrap'}}>{selectedProposal.paymentTerms}</p></div>}
              {selectedProposal.defectLiabilityPeriod && <div className="p-view-section"><h4>Defect Liability Period</h4><p style={{whiteSpace:'pre-wrap'}}>{selectedProposal.defectLiabilityPeriod}</p></div>}

              {selectedProposal.bomItems && parseJSON(selectedProposal.bomItems)?.length > 0 && (
                <div className="p-view-section">
                  <h4>Bill of Materials</h4>
                  <div style={{overflowX:'auto'}}>
                    <table className="p-inner-table">
                      <thead><tr><th>Item</th><th>Spec</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Tax%</th><th>Amount</th></tr></thead>
                      <tbody>
                        {parseJSON(selectedProposal.bomItems).map((it,i)=><tr key={i}><td>{it.item}</td><td>{it.specification}</td><td>{it.quantity}</td><td>{it.unit}</td><td>₹{parseFloat(it.rate||0).toLocaleString('en-IN')}</td><td>{it.tax||0}%</td><td>₹{parseFloat(it.amount||0).toLocaleString('en-IN')}</td></tr>)}
                        <tr className="p-subtotal-row"><td colSpan="6" style={{textAlign:'right',fontWeight:600}}>Subtotal:</td><td style={{fontWeight:600}}>₹{parseJSON(selectedProposal.bomItems).reduce((s,it)=>(parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0)+s,0).toLocaleString('en-IN')}</td></tr>
                        <tr className="p-subtotal-row"><td colSpan="6" style={{textAlign:'right',fontWeight:600}}>Tax:</td><td style={{fontWeight:600,color:'#d69e2e'}}>₹{parseJSON(selectedProposal.bomItems).reduce((s,it)=>{const st=(parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0);return s+st*(parseFloat(it.tax)||0)/100;},0).toLocaleString('en-IN')}</td></tr>
                        <tr className="p-total-row"><td colSpan="6" style={{textAlign:'right'}}>Grand Total:</td><td style={{color:'#047857'}}>₹{parseJSON(selectedProposal.bomItems).reduce((s,it)=>s+(parseFloat(it.amount)||0),0).toLocaleString('en-IN')}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-modal-footer">
                {permissions.EDIT && <button className="p-btn p-btn-secondary" onClick={()=>handleEdit(selectedProposal)}>Edit</button>}
                <button className="p-btn p-btn-secondary" onClick={()=>handleDownloadPDF(selectedProposal.id)}>Download PDF</button>
                {permissions.APPROVE && (
                  <select className="p-status-sel" value={selectedProposal.status} onChange={async e=>{
                    try { const data=await fetchWithHeaders(`${API_BASE_URL}/proposals/update/${selectedProposal.id}`,{method:'PUT',body:JSON.stringify({status:e.target.value})}); if(data.success){showSuccess('Status updated!');setSelectedProposal({...selectedProposal,status:e.target.value});fetchProposals();} } catch { showError('Failed'); }
                  }}>
                    <option value="Draft">Draft</option><option value="Sent">Sent</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option><option value="On Hold">On Hold</option>
                  </select>
                )}
                <button className="p-btn p-btn-secondary" onClick={()=>setShowViewModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showCreateModal && (
        <div className="p-modal-overlay" onClick={()=>{setShowCreateModal(false);resetForm();}}>
          <div className="p-modal p-modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="p-modal-hdr">
              <h2>{isEditMode ? 'Edit Proposal' : 'New Proposal'}</h2>
              <button className="p-modal-close" onClick={()=>{setShowCreateModal(false);resetForm();}}>×</button>
            </div>
            <div className="p-modal-body">
              <div className="p-form-grid">
                <div className="p-form-group">
                  <label>Group *</label>
                  {isEditMode ? <div className="p-form-static">{formData.groupName||'Not specified'}</div> : (
                    <select value={formData.groupName} onChange={e=>{setFormData({...formData,groupName:e.target.value,subGroupName:''});fetchLeads(e.target.value,null);}}>
                      <option value="">Select Group</option>
                      {groups.map((g,i)=><option key={g.value||i} value={g.value||g.label}>{g.label||g.value}</option>)}
                    </select>
                  )}
                </div>
                <div className="p-form-group">
                  <label>Category</label>
                  {isEditMode ? <div className="p-form-static">{formData.subGroupName||'Not specified'}</div> : (
                    <select value={formData.subGroupName} onChange={e=>{setFormData({...formData,subGroupName:e.target.value});fetchLeads(formData.groupName,e.target.value);}} disabled={!formData.groupName}>
                      <option value="">Select Category</option>
                      {subGroups.map((s,i)=><option key={s.value||i} value={s.value||s.label}>{s.label||s.value}</option>)}
                    </select>
                  )}
                </div>
                <div className="p-form-group p-form-full">
                  <label>Lead *</label>
                  {isEditMode ? <div className="p-form-static">{selectedProposal?.leadCode} – {selectedProposal?.leadName}</div> : (
                    <select value={formData.leadId} onChange={e=>setFormData({...formData,leadId:e.target.value})}>
                      <option value="">Select Lead</option>
                      {leads.map(l=><option key={l.id} value={l.id}>{l.leadCode} – {l.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="p-form-group">
                  <label>Title *</label>
                  <input type="text" value={formData.title} onChange={e=>setFormData({...formData,title:e.target.value})} placeholder="Proposal title" />
                </div>
                <div className="p-form-group">
                  <label>Total Value (₹)</label>
                  <input type="number" value={formData.totalValue} onChange={e=>setFormData({...formData,totalValue:e.target.value})} placeholder="0.00" />
                </div>
                <div className="p-form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={e=>setFormData({...formData,status:e.target.value})}>
                    <option value="Draft">Draft</option><option value="Sent">Sent</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option><option value="On Hold">On Hold</option>
                  </select>
                </div>
                <div className="p-form-group p-form-full">
                  <label>Description</label>
                  <textarea value={formData.description} onChange={e=>setFormData({...formData,description:e.target.value})} placeholder="Proposal description" rows={3} />
                </div>
              </div>
              <div className="p-modal-footer">
                <button className="p-btn p-btn-secondary" onClick={()=>{setShowCreateModal(false);resetForm();}}>Cancel</button>
                <button className="p-btn p-btn-outline" onClick={()=>setShowTemplateModal(true)}>📝 Edit Template</button>
                <button className="p-btn p-btn-primary" onClick={isEditMode?handleUpdate:handleCreate}>{isEditMode?'Update':'Create'} Proposal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Editor Modal ── */}
      {showTemplateModal && (
        <div className="p-modal-overlay" onClick={()=>setShowTemplateModal(false)}>
          <div className="p-modal p-modal-xl" onClick={e=>e.stopPropagation()}>
            <div className="p-modal-hdr">
              <h2>📝 Edit Template Content</h2>
              <button className="p-modal-close" onClick={()=>setShowTemplateModal(false)}>×</button>
            </div>
            <div className="p-modal-body">
              {/* Tabs */}
              <div className="p-tabs">
                {[{k:'company',l:'Company'},{k:'aboutUs',l:'About Us'},{k:'aboutSystem',l:'System'},{k:'pricing',l:'Pricing'},{k:'payment',l:'Payment'},{k:'dlp',l:'DLP'},{k:'bom',l:'BOM'}].map(t=>(
                  <button key={t.k} className={`p-tab${activeTab===t.k?' active':''}`} onClick={()=>setActiveTab(t.k)}>{t.l}</button>
                ))}
              </div>

              <div className="p-tab-content">
                {activeTab==='company' && (
                  <div className="p-form-group">
                    <label>Company Name</label>
                    <input type="text" value={templateData.companyName} onChange={e=>setTemplateData({...templateData,companyName:e.target.value})} />
                  </div>
                )}
                {activeTab==='aboutUs' && (
                  <div className="p-form-group">
                    <label>About Us</label>
                    <textarea value={templateData.aboutUs} onChange={e=>setTemplateData({...templateData,aboutUs:e.target.value})} rows={14} />
                  </div>
                )}
                {activeTab==='aboutSystem' && (
                  <div className="p-form-group">
                    <label>About System</label>
                    <textarea value={templateData.aboutSystem} onChange={e=>setTemplateData({...templateData,aboutSystem:e.target.value})} rows={14} />
                  </div>
                )}
                {activeTab==='pricing' && (
                  <div>
                    <div className="p-section-hdr">
                      <h4>System Pricing</h4>
                      <button className="p-btn p-btn-sm p-btn-secondary" onClick={addSystemPricingRow}>+ Add Row</button>
                    </div>
                    <table className="p-inner-table p-edit-table">
                      <thead><tr><th>Item</th><th>Description</th><th>Amount (₹)</th><th style={{width:50}}>–</th></tr></thead>
                      <tbody>
                        {templateData.systemPricing.length===0 ? (
                          <tr><td colSpan="4" className="p-td-empty">No items. Click "+ Add Row".</td></tr>
                        ) : <>
                          {templateData.systemPricing.map((row,i)=>(
                            <tr key={i}>
                              <td><input value={row.item} onChange={e=>updateSystemPricingRow(i,'item',e.target.value)} placeholder="Item name" /></td>
                              <td><input value={row.description} onChange={e=>updateSystemPricingRow(i,'description',e.target.value)} placeholder="Description" /></td>
                              <td><input type="number" value={row.amount} onChange={e=>updateSystemPricingRow(i,'amount',e.target.value)} placeholder="0.00" /></td>
                              <td><button className="p-del-row-btn" onClick={()=>removeSystemPricingRow(i)}>🗑️</button></td>
                            </tr>
                          ))}
                          <tr className="p-total-row"><td colSpan="2" style={{textAlign:'right'}}>Total:</td><td>₹{calculateSystemPricingTotal()}</td><td></td></tr>
                        </>}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeTab==='payment' && (
                  <div className="p-form-group">
                    <label>Payment Terms</label>
                    <textarea value={templateData.paymentTerms} onChange={e=>setTemplateData({...templateData,paymentTerms:e.target.value})} rows={12} />
                  </div>
                )}
                {activeTab==='dlp' && (
                  <div className="p-form-group">
                    <label>Defect Liability Period</label>
                    <textarea value={templateData.defectLiabilityPeriod} onChange={e=>setTemplateData({...templateData,defectLiabilityPeriod:e.target.value})} rows={12} />
                  </div>
                )}
                {activeTab==='bom' && (
                  <div>
                    <div className="p-section-hdr">
                      <h4>Bill of Materials</h4>
                      <div style={{display:'flex',gap:8}}>
                        <button className="p-btn p-btn-sm p-btn-secondary" onClick={fetchBomItemsMaster}>🔄 Refresh</button>
                        <button className="p-btn p-btn-sm p-btn-secondary" onClick={addBOMRow}>+ Add Row</button>
                      </div>
                    </div>
                    <div style={{overflowX:'auto'}}>
                      <table className="p-inner-table p-edit-table p-bom-table">
                        <thead><tr><th>Item Name*</th><th>Spec</th><th>Qty</th><th>Unit</th><th>Rate(₹)</th><th>Tax%</th><th>Amount</th><th style={{width:40}}>–</th></tr></thead>
                        <tbody>
                          {templateData.bomItems.length===0 ? (
                            <tr><td colSpan="8" className="p-td-empty">No BOM items. Click "+ Add Row".</td></tr>
                          ) : <>
                            {templateData.bomItems.map((row,i)=>(
                              <tr key={i}>
                                <td>
                                  <div className="bom-item-input-container" style={{position:'relative'}}>
                                    <input value={row.item} onChange={e=>{updateBOMRow(i,'item',e.target.value);handleBomItemSearch(i,e.target.value);}} onFocus={()=>{if(row.item?.length>=2)handleBomItemSearch(i,row.item);}} placeholder="Type to search..." />
                                    {showBomDropdown[i] && filteredBomItems[i]?.length > 0 && (
                                      <div className="p-bom-dropdown">
                                        <div className="p-bom-dropdown-hdr">📋 {filteredBomItems[i].length} items</div>
                                        {filteredBomItems[i].map(bom=>(
                                          <div key={bom.id} className="p-bom-dropdown-item" onClick={()=>selectBomItem(i,bom)}>
                                            <strong>{bom.itemName}</strong>
                                            {bom.specification && <span>{bom.specification}</span>}
                                            <div className="p-bom-tags"><span>{bom.category}</span><span>{bom.defaultUnit}</span>{bom.makeBrand&&<span>{bom.makeBrand}</span>}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td><textarea value={row.specification} onChange={e=>updateBOMRow(i,'specification',e.target.value)} rows={2} placeholder="Specs" /></td>
                                <td><input type="number" value={row.quantity} onChange={e=>updateBOMRow(i,'quantity',e.target.value)} placeholder="0" /></td>
                                <td>
                                  {customUnitInputs[i]!==undefined
                                    ? <input type="text" value={customUnitInputs[i]} onChange={e=>handleCustomUnitInput(i,e.target.value)} placeholder="Unit" />
                                    : <UnitTypeDropdown value={row.unit||''} onChange={e=>handleBomUnitChange(i,e.target.value)} className="proposal-unit-dropdown" placeholder="Unit" />
                                  }
                                </td>
                                <td><input type="number" value={row.rate} onChange={e=>updateBOMRow(i,'rate',e.target.value)} placeholder="0.00" /></td>
                                <td>
                                  <select value={row.tax||'18'} onChange={e=>updateBOMRow(i,'tax',e.target.value)}>
                                    <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                                  </select>
                                </td>
                                <td><input type="number" value={row.amount} readOnly className="p-amount-field" /></td>
                                <td><button className="p-del-row-btn" onClick={()=>removeBOMRow(i)}>🗑️</button></td>
                              </tr>
                            ))}
                            <tr className="p-subtotal-row"><td colSpan="6" style={{textAlign:'right',fontWeight:600}}>Subtotal:</td><td style={{fontWeight:600}}>₹{calculateBOMTotals().subtotal}</td><td></td></tr>
                            <tr className="p-subtotal-row"><td colSpan="6" style={{textAlign:'right',fontWeight:600}}>Tax:</td><td style={{fontWeight:600,color:'#d69e2e'}}>₹{calculateBOMTotals().totalTax}</td><td></td></tr>
                            <tr className="p-total-row"><td colSpan="6" style={{textAlign:'right',fontWeight:'bold'}}>Grand Total:</td><td style={{fontWeight:'bold',color:'#047857'}}>₹{calculateBOMTotals().grandTotal}</td><td></td></tr>
                          </>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-modal-footer">
                <button className="p-btn p-btn-secondary" onClick={()=>setShowTemplateModal(false)}>Close</button>
                <button className="p-btn p-btn-primary" onClick={()=>{setShowTemplateModal(false);showWarning('Template saved! Submit the proposal form to apply.');}}>✓ Save Template</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalsWithTemplate;