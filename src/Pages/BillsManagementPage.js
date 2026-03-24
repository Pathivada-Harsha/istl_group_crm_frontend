import React, { useState, useEffect } from 'react';
import {
  Eye, Edit2, Trash2, Download, Settings, GripVertical,
  ChevronUp, ChevronDown, ChevronsUpDown, Link2, DollarSign
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import GroupProjectFilter from './../components/Dropdowns/GroupProjectFilter.js';
import useGroupProjectFilters from './../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import ConfirmationModal from '../components/ConfirmationModal';
import filterApi from '../services/filterApi';
import '../pages-css/BillsVendorPayments.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ── inline confirmation hook ────────────────────────────────────────────────
const useConfirmationModal = () => {
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', type: 'confirm',
    onConfirm: null, onCancel: null, confirmText: 'Confirm', cancelText: 'Cancel', showCancel: true
  });
  const showConfirmation = (cfg) => new Promise((resolve) => {
    const showCancel = cfg.showCancel !== undefined ? cfg.showCancel : true;
    setConfirmModal({
      show: true, title: cfg.title || 'Confirm', message: cfg.message || '',
      type: cfg.type || 'confirm', confirmText: cfg.confirmText || 'Confirm',
      cancelText: cfg.cancelText || 'Cancel', showCancel,
      onConfirm: () => { setConfirmModal(p => ({ ...p, show: false })); resolve(true); },
      onCancel:  () => { setConfirmModal(p => ({ ...p, show: false })); resolve(false); }
    });
  });
  return { confirmModal, showConfirmation };
};

// ── column definitions ───────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { id: 'billNo',       label: 'Bill No',      visible: true },
  { id: 'vendor',       label: 'Vendor',        visible: true },
  { id: 'billDate',     label: 'Bill Date',     visible: true },
  { id: 'dueDate',      label: 'Due Date',      visible: true },
  { id: 'totalAmount',  label: 'Total Amount',  visible: true },
  { id: 'paidAmount',   label: 'Paid Amount',   visible: true },
  { id: 'balance',      label: 'Balance',       visible: true },
  { id: 'status',       label: 'Status',        visible: true },
  { id: 'actions',      label: 'Actions',       visible: true, fixed: true }
];

const SORTABLE = new Set(['billNo','vendor','billDate','dueDate','totalAmount','paidAmount','balance','status']);

const SortIcon = ({ columnId, sortConfig }) => {
  if (sortConfig.key !== columnId) return <ChevronsUpDown size={13} style={{ opacity: 0.4, marginLeft: 4, verticalAlign: 'middle' }} />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp   size={13} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#3b82f6' }} />
    : <ChevronDown size={13} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#3b82f6' }} />;
};

// ── status helpers ────────────────────────────────────────────────────────────
const STATUS_CLASS = {
  'Pending': 'bill-status-pending', 'Partially Paid': 'bill-status-partial',
  'Paid': 'bill-status-paid', 'Overdue': 'bill-status-overdue'
};

export default function BillsManagementPage() {
  const [bills, setBills] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const { confirmModal, showConfirmation } = useConfirmationModal();

  // columns
  const [columns, setColumns] = useState(() => {
    const s = localStorage.getItem('billsColumns');
    return s ? JSON.parse(s) : ALL_COLUMNS;
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // sort
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // table drag
  const [draggedColIndex, setDraggedColIndex] = useState(null);

  // filters
  const [filters, setFilters] = useState({ search: '', status: 'all' });

  // pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // stats
  const [stats, setStats] = useState(null);

  // view modal
  const [selectedBill, setSelectedBill] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPaymentHistory, setViewPaymentHistory] = useState([]);  // merged: advance allocs + direct payments
  const [loadingViewAlloc, setLoadingViewAlloc] = useState(false);
  const [viewLinkedAdvance, setViewLinkedAdvance] = useState(null);

  // create/edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [vendors, setVendors] = useState([]);

  // form
  const [formData, setFormData] = useState({
    vendorId: '', billDate: new Date().toISOString().split('T')[0],
    dueDate: '', notes: '', groupId: '', subGroupId: '', projectId: '',
    status: 'Pending', company: 'ISTL'
  });

  // modal dropdowns
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  useEffect(() => { localStorage.setItem('billsColumns', JSON.stringify(columns)); }, [columns]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBills(); }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStats(); }, [groupName, subGroupName, projectId]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

  // ── sort ──────────────────────────────────────────────────────────────────
  const sortedBills = React.useMemo(() => {
    if (!sortConfig.key) return bills;
    return [...bills].sort((a, b) => {
      let av, bv;
      switch (sortConfig.key) {
        case 'billNo':      av = a.billNo || '';            bv = b.billNo || '';            break;
        case 'vendor':      av = a.vendorName || '';        bv = b.vendorName || '';        break;
        case 'billDate':    av = new Date(a.billDate || 0); bv = new Date(b.billDate || 0); break;
        case 'dueDate':     av = new Date(a.dueDate  || 0); bv = new Date(b.dueDate  || 0); break;
        case 'totalAmount': av = parseFloat(a.totalAmount)||0; bv = parseFloat(b.totalAmount)||0; break;
        case 'paidAmount':  av = parseFloat(a.paidAmount) ||0; bv = parseFloat(b.paidAmount) ||0; break;
        case 'balance':     av = parseFloat(a.balanceAmount)||0; bv = parseFloat(b.balanceAmount)||0; break;
        case 'status':      av = a.status || '';            bv = b.status || '';            break;
        default: return 0;
      }
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.direction === 'asc' ?  1 : -1;
      return 0;
    });
  }, [bills, sortConfig]);

  const handleSort = (col) => {
    if (!SORTABLE.has(col)) return;
    setSortConfig(p => ({ key: col, direction: p.key === col && p.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // ── column drag ──────────────────────────────────────────────────────────
  const handleColDragStart = (e, i) => { setDraggedColIndex(i); e.dataTransfer.effectAllowed = 'move'; };
  const handleColDragOver  = (e) => { e.preventDefault(); };
  const handleColDrop = (e, i) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === i) { setDraggedColIndex(null); return; }
    const vis = columns.filter(c => c.visible);
    const hid = columns.filter(c => !c.visible);
    const arr = [...vis];
    const [moved] = arr.splice(draggedColIndex, 1);
    arr.splice(i, 0, moved);
    setColumns([...arr, ...hid]);
    setDraggedColIndex(null);
  };

  // ── api calls ────────────────────────────────────────────────────────────
  const fetchBills = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'billDate', sortDirection: 'DESC' });
      if (groupName)    p.append('groupId',    groupName);
      if (subGroupName) p.append('subGroupId', subGroupName);
      if (projectId)    p.append('projectId',  projectId);
      if (filters.status !== 'all') p.append('status', filters.status);
      if (filters.search)           p.append('search', filters.search);
      const res = await fetch(`${API_BASE_URL}/api/bills?${p}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch bills');
      const data = await res.json();
      setBills(data.bills || []); setTotalPages(data.totalPages || 0); setTotalElements(data.totalItems || 0);
    } catch (err) { showError('Failed to load bills'); setBills([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const p = new URLSearchParams();
      if (groupName)    p.append('groupId',    groupName);
      if (subGroupName) p.append('subGroupId', subGroupName);
      if (projectId)    p.append('projectId',  projectId);
      const res = await fetch(`${API_BASE_URL}/api/bills/stats?${p}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors?size=200`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setVendors(d.vendors || d.content || []); }
    } catch {}
  };

  const fetchModalGroups = async () => {
    setModalDropdownLoading(p => ({ ...p, groups: true }));
    try { setModalGroups(await filterApi.getAllGroups() || []); }
    catch { setModalGroups([]); }
    finally { setModalDropdownLoading(p => ({ ...p, groups: false })); }
  };
  const fetchModalSubGroups = async (gn) => {
    if (!gn) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(p => ({ ...p, subGroups: true }));
    try { setModalSubGroups(await filterApi.getSubGroups(gn) || []); }
    catch { setModalSubGroups([]); }
    finally { setModalDropdownLoading(p => ({ ...p, subGroups: false })); }
  };
  const fetchModalProjects = async (gn, sg) => {
    if (!gn || !sg) { setModalProjects([]); return; }
    setModalDropdownLoading(p => ({ ...p, projects: true }));
    try { setModalProjects(await filterApi.getProjects(gn, sg) || []); }
    catch { setModalProjects([]); }
    finally { setModalDropdownLoading(p => ({ ...p, projects: false })); }
  };

  // ── view bill ─────────────────────────────────────────────────────────────
  const handleViewBill = async (bill) => {
    setSelectedBill(bill);
    setViewPaymentHistory([]);
    setViewLinkedAdvance(null);
    setShowViewModal(true);

    if (parseFloat(bill.paidAmount) > 0) {
      setLoadingViewAlloc(true);
      try {
        // Single fetch — paymentHistory now contains all entries (advance allocs + direct payments)
        // because VendorAdvanceService.applyAmountToBill() writes a BillPaymentEntity for every payment
        const res = await fetch(`${API_BASE_URL}/api/bills/${bill.id}`,
          { credentials: 'include', headers: getAuthHeaders() });
        const billDetail = res.ok ? await res.json() : null;

        const entries = ((billDetail?.paymentHistory) || []).map(p => {
          // Detection uses both notes AND referenceNumber (advance no stored there from our service)
          //   Advance allocation  → notes: "Advance allocation from VADV-YYYY-NNNN"
          //                         ref:   "VADV-YYYY-NNNN"
          //   Direct bill payment → notes: "Payment via advance VPAY-YYYY-NNNN"
          //                         ref:   "VPAY-YYYY-NNNN"
          //   Legacy direct       → no VADV/VPAY anywhere
          const notesUp = (p.notes        || '').toUpperCase();
          const refUp   = (p.referenceNumber || '').toUpperCase();
          const combined = notesUp + ' ' + refUp;

          const isAdvanceAlloc = combined.includes('ADVANCE ALLOCATION') ||
                                 combined.includes('VADV-');
          const isBillPayment  = combined.includes('VPAY-') ||
                                 combined.includes('PAYMENT VIA ADVANCE');

          // Best label: referenceNumber first (VADV-xxxx / VPAY-xxxx), then extract from notes
          const refMatch = (refUp + ' ' + notesUp).match(/\b(VADV|VPAY)-\d{4}-\d{4}\b/i);
          const paymentRef = refMatch ? refMatch[0].toUpperCase() : null;

          let source, label, badgeText, badgeColor, badgeBg, borderColor, bgColor, borderBg, amtColor;

          if (isAdvanceAlloc) {
            source = 'advance';   label = paymentRef || 'Advance';
            badgeText = 'Advance'; badgeColor = '#6d28d9'; badgeBg = '#ede9fe';
            borderColor = '#7c3aed'; bgColor = '#f5f3ff'; borderBg = '#ddd6fe'; amtColor = '#7c3aed';
          } else {
            source = 'direct';    label = paymentRef || 'Direct Payment';
            badgeText = 'Payment'; badgeColor = '#166534'; badgeBg = '#dcfce7';
            borderColor = '#059669'; bgColor = '#f0fdf4'; borderBg = '#bbf7d0'; amtColor = '#059669';
          }

          return {
            source, label, badgeText, badgeColor, badgeBg,
            borderColor, bgColor, borderBg, amtColor,
            amount:      parseFloat(p.amount || 0),
            paymentMode: p.paymentMode || '—',
            // For advance entries referenceNumber IS the advance no — show bank ref from notes if any
            // For direct payments referenceNumber is the actual bank/cheque ref
            reference:   isAdvanceAlloc || isBillPayment
                           ? (p.referenceNumber || paymentRef || '—')   // advance no
                           : (p.referenceNumber || '—'),                // bank ref
            date:        new Date(p.paymentDate || 0),
            dateLabel:   fmtDT(p.paymentDate)
          };
        });

        // Sort newest first
        setViewPaymentHistory(entries.sort((a, b) => b.date - a.date));
      } catch {}
      finally { setLoadingViewAlloc(false); }
    }
  };

  // ── create / edit ─────────────────────────────────────────────────────────
  const handleCreateNew = () => {
    setFormData({ vendorId: '', billDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', groupId: '', subGroupId: '', projectId: '', status: 'Pending', company: 'ISTL' });
    setModalGroupName(''); setModalSubGroupName(''); setModalProjectId('');
    setEditMode(false);
    fetchVendors(); fetchModalGroups();
    setShowFormModal(true);
  };

  const handleEditBill = (bill) => {
    setFormData({
      vendorId: bill.vendorId, billDate: bill.billDate, dueDate: bill.dueDate || '',
      notes: bill.notes || '', groupId: bill.groupId || '', subGroupId: bill.subGroupId || '',
      projectId: bill.projectId || '', status: bill.status, company: bill.company || 'ISTL'
    });
    setModalGroupName(bill.groupId || ''); setModalSubGroupName(bill.subGroupId || ''); setModalProjectId(bill.projectId || '');
    setSelectedBill(bill); setEditMode(true);
    fetchVendors(); fetchModalGroups();
    setShowFormModal(true);
  };

  const handleSaveBill = async () => {
    if (!formData.vendorId) { showError('Please select a vendor'); return; }
    if (!formData.dueDate)  { showError('Due date is required');   return; }
    setLoading(true);
    try {
      const url    = editMode ? `${API_BASE_URL}/api/bills/${selectedBill.id}` : `${API_BASE_URL}/api/bills`;
      const method = editMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        credentials: 'include', method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...formData, items: [] })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to save'); }
      showSuccess(`Bill ${editMode ? 'updated' : 'created'} successfully!`);
      setShowFormModal(false); fetchBills(); fetchStats();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteBill = async (bill) => {
    const confirmed = await showConfirmation({
      title: 'Delete Bill', type: 'alert', confirmText: 'Delete',
      message: `Delete bill ${bill.billNo}? This cannot be undone.`
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bills/${bill.id}`,
        { credentials: 'include', method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      showSuccess('Bill deleted successfully!'); fetchBills(); fetchStats();
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  };

  // ── column manager ────────────────────────────────────────────────────────
  const handleColumnToggle = (id) => setColumns(columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  const handleColumnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(columns);
    const [r] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, r);
    setColumns(items);
  };
  const resetColumns = () => { setColumns(ALL_COLUMNS); localStorage.removeItem('billsColumns'); };

  // ── formatters ────────────────────────────────────────────────────────────
  const fmt  = (n) => { const v = parseFloat(n)||0; return `₹${v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`; };
  const fmtD = (d) => { if (!d) return ''; return new Date(d).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'}); };
  const fmtDT= (d) => { if (!d) return ''; return new Date(d).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); };

  // ── render column cell ────────────────────────────────────────────────────
  const renderCell = (col, bill) => {
    switch (col.id) {
      case 'billNo':      return <td className="bill-no">{bill.billNo}</td>;
      case 'vendor':      return <td>{bill.vendorName}</td>;
      case 'billDate':    return <td>{fmtD(bill.billDate)}</td>;
      case 'dueDate':     return <td>{fmtD(bill.dueDate)}</td>;
      case 'totalAmount': return <td className="bill-amount">{fmt(bill.totalAmount)}</td>;
      case 'paidAmount':  return <td className="text-success">{fmt(bill.paidAmount)}</td>;
      case 'balance':     return <td className="bill-amount">{fmt(bill.balanceAmount)}</td>;
      case 'status':      return <td><span className={`bill-badge ${STATUS_CLASS[bill.status]||''}`}>{bill.status}</span></td>;
      case 'actions':     return (
        <td>
          <div className="bill-action-buttons">
            <button className="receipt-action-btn btn-view"   onClick={() => handleViewBill(bill)}   title="View"><Eye size={16}/></button>
            <button className="receipt-action-btn btn-edit"   onClick={() => handleEditBill(bill)}   title="Edit"><Edit2 size={16}/></button>
            <button className="receipt-action-btn btn-delete" onClick={() => handleDeleteBill(bill)} title="Delete"><Trash2 size={16}/></button>
          </div>
        </td>
      );
      default: return <td>—</td>;
    }
  };

  const visibleColumns = columns.filter(c => c.visible);

  return (
    <div className="receipts-page-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal {...confirmModal} />

      <div className="receipts-page-breadcrumb">
        <span>Pages</span><span className="receipts-page-separator">{'>'}</span>
        <span className="receipts-page-current">Bills</span>
      </div>

      <div className="page-header-with-filter">
        <h1 className="receipts-page-title">Bills Received ({totalElements})</h1>
        <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
      </div>

      {/* Action bar */}
      <div className="receipts-page-action-bar">
        <div className="receipts-page-search-filters">
          <input type="text" className="receipts-page-search" placeholder="Search bills..."
            value={filters.search} onChange={e => { setFilters(f=>({...f,search:e.target.value})); setCurrentPage(0); }} />
          <select className="receipts-page-filter" value={filters.status}
            onChange={e => { setFilters(f=>({...f,status:e.target.value})); setCurrentPage(0); }}>
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
        <div className="receipts-page-actions">
          <button className="receipts-page-btn-secondary" onClick={() => setShowColumnManager(!showColumnManager)}>
            <Settings size={16} style={{marginRight:8}}/>Columns
          </button>
          <button className="receipts-page-btn-primary" onClick={handleCreateNew}>+ Create New Bill</button>
        </div>
      </div>

      {/* Column manager */}
      {showColumnManager && (
        <div className="column-manager-modal">
          <div className="column-manager-content">
            <div className="column-manager-header"><h3>Manage Columns</h3><button onClick={() => setShowColumnManager(false)}>×</button></div>
            <div className="column-manager-body">
              <DragDropContext onDragEnd={handleColumnDragEnd}>
                <Droppable droppableId="billCols">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {columns.map((col, idx) => (
                        <Draggable key={col.id} draggableId={col.id} index={idx} isDragDisabled={col.fixed}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} className="column-item">
                              <div className="column-item-left">
                                {!col.fixed && <div {...p.dragHandleProps} className="drag-handle"><GripVertical size={16}/></div>}
                                <input type="checkbox" checked={col.visible} onChange={() => handleColumnToggle(col.id)} disabled={col.fixed}/>
                                <span>{col.label}</span>
                              </div>
                              {col.fixed && <span className="fixed-badge">Fixed</span>}
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
              <button onClick={() => setShowColumnManager(false)} className="receipts-page-btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="receipts-page-stats">
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">TOTAL BILLS</div><div className="receipts-page-stat-value">{stats.totalBills||0}</div></div>
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">OUTSTANDING</div><div className="receipts-page-stat-value receipts-page-stat-warning">{fmt(stats.outstandingAmount)}</div></div>
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">PAID BILLS</div><div className="receipts-page-stat-value receipts-page-stat-success">{stats.paidBills||0}</div></div>
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">THIS MONTH</div><div className="receipts-page-stat-value">{stats.billsThisMonth||0}</div></div>
        </div>
      )}

      {/* Table */}
      <div className="receipts-page-table-container">
        <div className="receipts-page-table-scroll">
          <table className="receipts-page-table">
            <thead>
              <tr>
                {visibleColumns.map((col, idx) => (
                  <th key={col.id} draggable={!col.fixed}
                    onDragStart={e => handleColDragStart(e, idx)}
                    onDragOver={handleColDragOver}
                    onDrop={e => handleColDrop(e, idx)}
                    onClick={() => handleSort(col.id)}>
                    {!col.fixed && <GripVertical size={12} style={{opacity:0.3,marginRight:4}}/>}
                    {col.label}
                    {SORTABLE.has(col.id) && <SortIcon columnId={col.id} sortConfig={sortConfig}/>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBills.length === 0 ? (
                <tr><td colSpan={visibleColumns.length} className="empty-state">No bills found</td></tr>
              ) : sortedBills.map(bill => (
                <tr key={bill.id}>
                  {visibleColumns.map(col => <React.Fragment key={col.id}>{renderCell(col, bill)}</React.Fragment>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="receipts-page-pagination">
          <div className="receipts-page-pagination-info">
            Showing {currentPage*pageSize+1} to {Math.min((currentPage+1)*pageSize, totalElements)} of {totalElements}
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCurrentPage(0);}} className="receipts-page-pagination-size-select">
              <option value="10">10 Rows</option><option value="20">20 Rows</option>
              <option value="50">50 Rows</option><option value="100">100 Rows</option>
            </select>
          </div>
          <div className="receipts-page-pagination-controls">
            <button onClick={()=>setCurrentPage(p=>Math.max(p-1,0))} disabled={currentPage===0} className="receipts-page-pagination-btn">Previous</button>
            <span className="receipts-page-pagination-current">Page {currentPage+1} of {totalPages}</span>
            <button onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages-1))} disabled={currentPage>=totalPages-1} className="receipts-page-pagination-btn">Next</button>
          </div>
        </div>
      </div>

      {/* ── VIEW BILL MODAL ───────────────────────────────────────────────── */}
      {showViewModal && selectedBill && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Bill Details — {selectedBill.billNo}</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowViewModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              {/* Meta */}
              <div className="receipt-meta">
                <div className="receipt-meta-item"><strong>Vendor:</strong> {selectedBill.vendorName}</div>
                <div className="receipt-meta-item"><strong>Bill Date:</strong> {fmtD(selectedBill.billDate)}</div>
                <div className="receipt-meta-item"><strong>Due Date:</strong> {fmtD(selectedBill.dueDate)}</div>
                <div className="receipt-meta-item">
                  <strong>Status:</strong>
                  <span className={`bill-badge ${STATUS_CLASS[selectedBill.status]||''}`} style={{marginLeft:6}}>{selectedBill.status}</span>
                </div>
              </div>

              {selectedBill.notes && (
                <div className="receipt-details">
                  <div className="receipt-detail-row"><span>Notes:</span><strong>{selectedBill.notes}</strong></div>
                </div>
              )}

              {/* Amounts */}
              <div className="receipt-amounts">
                <div className="receipt-amount-row"><span>Total Amount:</span><span className="amount-value">{fmt(selectedBill.totalAmount)}</span></div>
                <div className="receipt-amount-row"><span>Paid Amount:</span><span className="amount-value text-success">{fmt(selectedBill.paidAmount)}</span></div>
                <div className="receipt-amount-row"><span>Balance Due:</span><span className="amount-value text-danger">{fmt(selectedBill.balanceAmount)}</span></div>
              </div>

              {/* Bill line items */}
              {selectedBill.items && selectedBill.items.length > 0 && (
                <div style={{marginTop:20}}>
                  <strong style={{fontSize:14,color:'#1e293b'}}>Bill Items</strong>
                  <table className="receipts-page-table" style={{marginTop:10}}>
                    <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Total</th></tr></thead>
                    <tbody>
                      {selectedBill.items.map((item,i)=>(
                        <tr key={i}>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>{fmt(item.unitPrice)}</td>
                          <td>{item.taxPercent}%</td>
                          <td>{fmt(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}


              {/* ── Unified Payment History ── */}
              <div style={{marginTop:20}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <Link2 size={15} color="#7c3aed"/>
                  <strong style={{fontSize:13,color:'#4c1d95'}}>Payment History</strong>
                  {!loadingViewAlloc && viewPaymentHistory.length > 0 && (
                    <span style={{background:'#ede9fe',color:'#6d28d9',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99}}>
                      {viewPaymentHistory.length}
                    </span>
                  )}
                </div>

                {loadingViewAlloc && (
                  <div style={{color:'#7c3aed',fontSize:12,padding:'8px 0'}}>Loading...</div>
                )}

                {!loadingViewAlloc && viewPaymentHistory.length === 0 && (
                  <div style={{fontSize:12,color:'#94a3b8',padding:'8px 0'}}>No payments recorded yet.</div>
                )}

                {!loadingViewAlloc && viewPaymentHistory.length > 0 && (
                  <div style={{border:'1px solid #e2e8f0',borderRadius:8,overflow:'hidden'}}>
                    {/* Header */}
                    <div style={{display:'grid',gridTemplateColumns:'110px 1fr auto auto auto',gap:'0 12px',padding:'6px 12px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                      {['Type','Date','Mode','Amount','Ref'].map(h=>(
                        <div key={h} style={{fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</div>
                      ))}
                    </div>
                    {/* Rows */}
                    {viewPaymentHistory.map((entry,idx)=>(
                      <div key={idx} style={{
                        display:'grid',gridTemplateColumns:'110px 1fr auto auto auto',
                        gap:'0 12px',padding:'8px 12px',alignItems:'center',
                        borderBottom: idx < viewPaymentHistory.length-1 ? '1px solid #f1f5f9' : 'none',
                        background: idx%2===0 ? '#fff' : '#fafafa'
                      }}>
                        {/* Type badge + ref */}
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:99,
                            background:entry.badgeBg,color:entry.badgeColor,whiteSpace:'nowrap'}}>
                            {entry.badgeText}
                          </span>
                          <span style={{fontSize:11,fontWeight:600,color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                            title={entry.label}>
                            {entry.label}
                          </span>
                        </div>
                        {/* Date */}
                        <div style={{fontSize:11,color:'#6b7280',whiteSpace:'nowrap'}}>{entry.dateLabel}</div>
                        {/* Mode */}
                        <div style={{fontSize:11,color:'#374151',whiteSpace:'nowrap'}}>{entry.paymentMode}</div>
                        {/* Amount */}
                        <div style={{fontSize:12,fontWeight:700,color:entry.amtColor,whiteSpace:'nowrap',textAlign:'right'}}>
                          {fmt(entry.amount)}
                        </div>
                        {/* Reference */}
                        <div style={{fontSize:11,color:'#6b7280',whiteSpace:'nowrap',textAlign:'right'}}>
                          {entry.reference || '—'}
                        </div>
                      </div>
                    ))}
                    {/* Footer total */}
                    <div style={{display:'grid',gridTemplateColumns:'110px 1fr auto auto auto',gap:'0 12px',
                      padding:'7px 12px',background:'#f0fdf4',borderTop:'2px solid #bbf7d0',alignItems:'center'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#065f46',gridColumn:'1/4'}}>
                        Total — {viewPaymentHistory.length} payment{viewPaymentHistory.length!==1?'s':''}
                        <span style={{fontWeight:400,color:'#6b7280',marginLeft:6}}>
                          ({viewPaymentHistory.filter(e=>e.source==='advance').length} adv /&nbsp;
                           {viewPaymentHistory.filter(e=>e.source==='direct').length} direct)
                        </span>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:'#059669',textAlign:'right',whiteSpace:'nowrap'}}>
                        {fmt(viewPaymentHistory.reduce((s,e)=>s+e.amount,0))}
                      </div>
                      <div/>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              <button className="receipts-page-btn-primary" onClick={() => { setShowViewModal(false); handleEditBill(selectedBill); }}>Edit Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT BILL MODAL ──────────────────────────────────────── */}
      {showFormModal && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>{editMode ? 'Edit Bill' : 'Create New Bill'}</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowFormModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipts-page-form">

                {/* Project hierarchy */}
                <div className="receipts-page-form-section">
                  <h3>Project Assignment</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Group</label>
                      <select value={modalGroupName} onChange={e => { setModalGroupName(e.target.value); setFormData(f=>({...f,groupId:e.target.value,subGroupId:'',projectId:''})); fetchModalSubGroups(e.target.value); }} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups?'Loading...':'Select Group'}</option>
                        {modalGroups.map((g,i)=><option key={g.value||i} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Sub Group</label>
                      <select value={modalSubGroupName} onChange={e => { setModalSubGroupName(e.target.value); setFormData(f=>({...f,subGroupId:e.target.value,projectId:''})); fetchModalProjects(modalGroupName, e.target.value); }} disabled={!modalGroupName||modalDropdownLoading.subGroups}>
                        <option value="">{modalDropdownLoading.subGroups?'Loading...':'Select Sub Group'}</option>
                        {modalSubGroups.map((sg,i)=><option key={sg.value||i} value={sg.value}>{sg.label}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Project</label>
                      <select value={modalProjectId} onChange={e => { setModalProjectId(e.target.value); setFormData(f=>({...f,projectId:e.target.value})); }} disabled={!modalSubGroupName||modalDropdownLoading.projects}>
                        <option value="">{modalDropdownLoading.projects?'Loading...':'Select Project'}</option>
                        {modalProjects.map((p,i)=><option key={p.id||i} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Company *</label>
                      <select value={formData.company} onChange={e=>setFormData(f=>({...f,company:e.target.value}))}>
                        <option value="ISTL">ISTL</option><option value="SESOLA">SESOLA</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Vendor & dates */}
                <div className="receipts-page-form-section">
                  <h3>Bill Details</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Vendor *</label>
                      <select value={formData.vendorId} onChange={e=>setFormData(f=>({...f,vendorId:e.target.value}))}>
                        <option value="">Select Vendor</option>
                        {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Bill Date *</label>
                      <input type="date" value={formData.billDate} onChange={e=>setFormData(f=>({...f,billDate:e.target.value}))}/>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Due Date *</label>
                      <input type="date" value={formData.dueDate} min={formData.billDate} onChange={e=>setFormData(f=>({...f,dueDate:e.target.value}))}/>
                    </div>
                    <div className="receipts-page-form-group receipts-page-form-group-full">
                      <label>Notes</label>
                      <textarea value={formData.notes} onChange={e=>setFormData(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Additional notes..."/>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => setShowFormModal(false)}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveBill}>{editMode ? 'Update Bill' : 'Create Bill'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}