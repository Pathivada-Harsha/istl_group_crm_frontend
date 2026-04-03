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
  const [selectedFile, setSelectedFile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [vendors, setVendors] = useState([]);

  // form
  const [formData, setFormData] = useState({
    vendorId: '', billDate: new Date().toISOString().split('T')[0],
    dueDate: '', notes: '', groupId: '', subGroupId: '', projectId: '',
    status: 'Pending'
  });

  // modal dropdowns
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  // PO & vendor (modal-scoped)
  const [modalVendors, setModalVendors] = useState([]);
  const [modalPurchaseOrders, setModalPurchaseOrders] = useState([]);
  const [loadingPOItems, setLoadingPOItems] = useState(false);

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
      const res = await fetch(`${API_BASE_URL}/bills?${p}`, { credentials: 'include', headers: getAuthHeaders() });
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
      const res = await fetch(`${API_BASE_URL}/bills/stats?${p}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  // fetchVendors kept for fallback (edit mode without project)
  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors?size=200`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setVendors(d.vendors || d.content || []); }
    } catch {}
  };

  // Fetch vendors scoped to the selected project/group (uses for-bills endpoint like Bills-Recieved)
  const fetchModalVendors = async (gn, sg, pid) => {
    try {
      const p = new URLSearchParams();
      if (gn)  p.append('groupName',    gn);
      if (sg)  p.append('subGroupName', sg);
      if (pid) p.append('projectId',    pid);
      const res = await fetch(`${API_BASE_URL}/vendors/for-bills?${p}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setModalVendors(d || []); }
      else setModalVendors([]);
    } catch { setModalVendors([]); }
  };

  // Fetch POs for selected vendor
  const fetchModalPOs = async (vendorIdOrName) => {
    if (!vendorIdOrName) { setModalPurchaseOrders([]); return; }
    try {
      const p = new URLSearchParams();
      if (modalGroupName)    p.append('groupName',    modalGroupName);
      if (modalSubGroupName) p.append('subGroupName', modalSubGroupName);
      if (modalProjectId)    p.append('projectId',    modalProjectId);
      if (typeof vendorIdOrName === 'number') p.append('vendorId', vendorIdOrName);
      else if (typeof vendorIdOrName === 'string' && vendorIdOrName.startsWith('PO_'))
        p.append('vendorName', vendorIdOrName.replace('PO_', ''));
      const res = await fetch(`${API_BASE_URL}/purchase-orders/by-vendor?${p}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setModalPurchaseOrders(d || []); }
      else setModalPurchaseOrders([]);
    } catch { setModalPurchaseOrders([]); }
  };

  // Fetch PO items and load into bill items
  const fetchPOItems = async (poId) => {
    if (!poId) return;
    setLoadingPOItems(true);
    try {
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${poId}/items-for-bill`,
        { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.items && data.items.length > 0) {
          const billItems = data.items.map(item => ({
            poItemId:      item.id,
            itemName:      item.itemName || '',
            description:   item.description || '',
            orderedQty:    item.orderedQty,
            deliveredQty:  item.deliveredQty,
            pendingQty:    item.pendingQty,
            maxBillableQty: item.pendingQty,
            quantity:      '',  // blank — user must enter bill qty explicitly
            unitPrice:     item.unitPrice || 0,
            taxPercent:    item.taxPercent || 18,
          }));
          setFormData(f => ({ ...f, items: billItems }));
          showSuccess(`✅ Loaded ${billItems.length} items from PO`);
        } else {
          showError('All PO items already delivered. You can still add manual items.');
          setFormData(f => ({ ...f, items: [{ itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }] }));
        }
      }
    } catch (err) { showError('Failed to load PO items'); }
    finally { setLoadingPOItems(false); }
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
        const res = await fetch(`${API_BASE_URL}/bills/${bill.id}`,
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

  // ── file upload handlers ──────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showError('File size exceeds 5MB limit');
        e.target.value = null;
        return;
      }
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        showError('Invalid file type. Only PDF, PNG, JPG allowed');
        e.target.value = null;
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadBillFile = async (billId, file) => {
    const formDataFile = new FormData();
    formDataFile.append('file', file);
    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'X-User-Id': user?.id || localStorage.getItem('userId'),
      'X-User-Role': user?.role || localStorage.getItem('userRole')
    };
    try {
      const res = await fetch(`${API_BASE_URL}/bills/${billId}/upload`, {
        method: 'POST', headers, credentials: 'include', body: formDataFile
      });
      if (res.ok) showSuccess('File uploaded successfully');
      else showError('File upload failed');
    } catch (err) {
      console.error('Error uploading file:', err);
      showError('Error uploading file');
    }
  };

  // ── item handlers ────────────────────────────────────────────────────────────
  const handleAddItem = () => setFormData(f => ({
    ...f,
    items: [...(f.items || []), { itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }]
  }));

  const handleRemoveItem = (idx) => setFormData(f => ({
    ...f,
    items: (f.items || []).filter((_, i) => i !== idx)
  }));

  const handleUpdateItem = (idx, field, value) => setFormData(f => {
    const items = [...(f.items || [])];
    items[idx] = { ...items[idx], [field]: value };
    return { ...f, items };
  });

  const calcLineTotal = (item) => {
    const sub = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
    return sub + (sub * (parseFloat(item.taxPercent) || 0) / 100);
  };

  const calcBillTotal = () => (formData.items || []).reduce((t, i) => t + calcLineTotal(i), 0);

  const fmtCurrency = (v) => '₹' + (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // ── create / edit ─────────────────────────────────────────────────────────
  const handleCreateNew = () => {
    setFormData({ vendorId: '', billDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', groupId: '', subGroupId: '', projectId: '', status: 'Pending', items: [{ itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }] });
    setModalGroupName(''); setModalSubGroupName(''); setModalProjectId('');
    setModalVendors([]); setModalPurchaseOrders([]);
    setEditMode(false);
    setSelectedFile(null);
    fetchVendors(); fetchModalGroups();
    setShowFormModal(true);
  };

  const handleEditBill = (bill) => {
    setFormData({
      vendorId: bill.vendorId, poId: bill.poId || null, billDate: bill.billDate, dueDate: bill.dueDate || '',
      notes: bill.notes || '', groupId: bill.groupId || '', subGroupId: bill.subGroupId || '',
      projectId: bill.projectId || '', status: bill.status,
      items: (bill.items && bill.items.length > 0) ? bill.items.map(i => ({ itemName: i.itemName || '', description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unitPrice || 0, taxPercent: i.taxPercent || 18 })) : [{ itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }]
    });
    setModalGroupName(bill.groupId || ''); setModalSubGroupName(bill.subGroupId || ''); setModalProjectId(bill.projectId || '');
    setModalVendors([]); setModalPurchaseOrders([]);
    setSelectedBill(bill); setEditMode(true);
    setSelectedFile(null);
    fetchVendors(); fetchModalGroups();
    // Restore vendor/PO dropdowns for edit
    if (bill.groupId) {
      fetchModalSubGroups(bill.groupId);
      if (bill.subGroupId) {
        fetchModalProjects(bill.groupId, bill.subGroupId);
        fetchModalVendors(bill.groupId, bill.subGroupId, bill.projectId || '');
      }
    }
    if (bill.vendorId) fetchModalPOs(parseInt(bill.vendorId));
    setShowFormModal(true);
  };

  const handleSaveBill = async () => {
    if (!formData.vendorId) { showError('Please select a vendor'); return; }
    // Validate items with a name have a valid quantity
    const namedItems = (formData.items || []).filter(i => i.itemName?.trim());
    for (let i = 0; i < namedItems.length; i++) {
      const item = namedItems[i];
      const qty = parseFloat(item.quantity);
      if (!qty || qty <= 0) {
        showError(`Item ${i+1} (${item.itemName}): please enter a valid quantity`);
        return;
      }
    }
    // Validate PO item quantities don't exceed max billable
    for (let i = 0; i < (formData.items || []).length; i++) {
      const item = formData.items[i];
      if (item.maxBillableQty && parseFloat(item.quantity) > item.maxBillableQty) {
        showError(`Item ${i+1} (${item.itemName}): quantity ${item.quantity} exceeds max billable ${item.maxBillableQty}`);
        return;
      }
    }
    setLoading(true);
    try {
      const url    = editMode ? `${API_BASE_URL}/bills/${selectedBill.id}` : `${API_BASE_URL}/bills`;
      const method = editMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        credentials: 'include', method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...formData, items: (formData.items || []).filter(i => i.itemName?.trim()) })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to save'); }
      const savedBill = await res.json();
      if (selectedFile && savedBill.id) {
        await uploadBillFile(savedBill.id, selectedFile);
      }
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
      const res = await fetch(`${API_BASE_URL}/bills/${bill.id}`,
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
                      <select value={modalGroupName} onChange={e => { const v=e.target.value; setModalGroupName(v); setModalSubGroupName(''); setModalProjectId(''); setModalVendors([]); setModalPurchaseOrders([]); setFormData(f=>({...f,groupId:v,subGroupId:'',projectId:'',vendorId:'',poId:null,items:f.items.filter(i=>!i.poItemId)})); fetchModalSubGroups(v); }} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups?'Loading...':'Select Group'}</option>
                        {modalGroups.map((g,i)=><option key={g.value||i} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Sub Group</label>
                      <select value={modalSubGroupName} onChange={e => { const v=e.target.value; setModalSubGroupName(v); setModalProjectId(''); setModalVendors([]); setModalPurchaseOrders([]); setFormData(f=>({...f,subGroupId:v,projectId:'',vendorId:'',poId:null,items:f.items.filter(i=>!i.poItemId)})); fetchModalProjects(modalGroupName, v); fetchModalVendors(modalGroupName, v, ''); }} disabled={!modalGroupName||modalDropdownLoading.subGroups}>
                        <option value="">{modalDropdownLoading.subGroups?'Loading...':'Select Sub Group'}</option>
                        {modalSubGroups.map((sg,i)=><option key={sg.value||i} value={sg.value}>{sg.label}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Project</label>
                      <select value={modalProjectId} onChange={e => { const v=e.target.value; setModalProjectId(v); setModalVendors([]); setModalPurchaseOrders([]); setFormData(f=>({...f,projectId:v,vendorId:'',poId:null,items:f.items.filter(i=>!i.poItemId)})); fetchModalVendors(modalGroupName, modalSubGroupName, v); }} disabled={!modalSubGroupName||modalDropdownLoading.projects}>
                        <option value="">{modalDropdownLoading.projects?'Loading...':'Select Project'}</option>
                        {modalProjects.map((p,i)=><option key={p.id||i} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Vendor, PO & dates */}
                <div className="receipts-page-form-section">
                  <h3>Bill Details</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Vendor *</label>
                      <select value={formData.vendorId || ''} onChange={e => {
                        const v = e.target.value;
                        setModalPurchaseOrders([]);
                        setFormData(f => ({ ...f, vendorId: v, poId: null, items: f.items.filter(i => !i.poItemId) }));
                        if (v) fetchModalPOs(typeof v === 'string' && !v.startsWith('PO_') ? parseInt(v) : v);
                      }}>
                        <option value="">Select Vendor</option>
                        {(modalVendors.length > 0 ? modalVendors : vendors).map((v, i) => (
                          <option key={v.id || i} value={v.id}>
                            {v.name}{v.contact ? ` - ${v.contact}` : ''}{v.source === 'po_vendor' ? ' (From PO)' : ''}
                          </option>
                        ))}
                      </select>
                      {modalVendors.length === 0 && modalProjectId && (
                        <small style={{ color:'#ef4444', fontSize:11, marginTop:4, display:'block' }}>
                          No vendors for this project — select project or create a PO first.
                        </small>
                      )}
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Linked PO (Optional)</label>
                      <select value={formData.poId || ''} onChange={e => {
                        const v = e.target.value;
                        setFormData(f => ({ ...f, poId: v ? parseInt(v) : null, items: f.items.filter(i => !i.poItemId) }));
                        if (v) fetchPOItems(parseInt(v));
                      }}>
                        <option value="">No PO Link</option>
                        {modalPurchaseOrders.map(po => (
                          <option key={po.id} value={po.id}>{po.poNo} — {po.vendorName} — ₹{(parseFloat(po.totalValue)||0).toLocaleString('en-IN')}</option>
                        ))}
                      </select>
                      {formData.vendorId && modalPurchaseOrders.length === 0 && (
                        <small style={{ color:'#94a3b8', fontSize:11, marginTop:4, display:'block' }}>No POs found for selected vendor</small>
                      )}
                      {formData.poId && (
                        <small style={{ color:'#16a34a', fontSize:11, marginTop:4, display:'block' }}>✓ PO items loaded below</small>
                      )}
                      {loadingPOItems && (
                        <small style={{ color:'#3b82f6', fontSize:11, marginTop:4, display:'block' }}>🔄 Loading PO items...</small>
                      )}
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Bill Date *</label>
                      <input type="date" value={formData.billDate} onChange={e=>setFormData(f=>({...f,billDate:e.target.value}))}/>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Due Date</label>
                      <input type="date" value={formData.dueDate} min={formData.billDate} onChange={e=>setFormData(f=>({...f,dueDate:e.target.value}))}/>
                    </div>
                    <div className="receipts-page-form-group receipts-page-form-group-full">
                      <label>Notes</label>
                      <textarea value={formData.notes} onChange={e=>setFormData(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Additional notes..."/>
                    </div>
                  </div>
                </div>

                {/* Bill Line Items */}
                <div className="receipts-page-form-section">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <h3 style={{ margin:0 }}>Bill Line Items</h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      style={{ padding:'6px 14px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:500 }}
                    >+ Add Item</button>
                  </div>
                  <div style={{ overflowX:'auto', border:'1px solid #e2e8f0', borderRadius:8 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          <th style={{ padding:'10px 8px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'18%' }}>Item Name</th>
                          <th style={{ padding:'10px 8px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'20%' }}>Description</th>
                          {formData.poId && <th style={{ padding:'10px 8px', textAlign:'center', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'7%' }}>Ordered</th>}
                          {formData.poId && <th style={{ padding:'10px 8px', textAlign:'center', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'7%' }}>Delivered</th>}
                          {formData.poId && <th style={{ padding:'10px 8px', textAlign:'center', fontWeight:600, color:'#22c55e', borderBottom:'2px solid #e2e8f0', width:'7%' }}>Pending</th>}
                          <th style={{ padding:'10px 8px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'10%' }}>Bill Qty *</th>
                          <th style={{ padding:'10px 8px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'12%' }}>Unit Price</th>
                          <th style={{ padding:'10px 8px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'8%' }}>Tax %</th>
                          <th style={{ padding:'10px 8px', textAlign:'left', fontWeight:600, color:'#475569', borderBottom:'2px solid #e2e8f0', width:'10%' }}>Line Total</th>
                          <th style={{ padding:'10px 8px', width:'5%', borderBottom:'2px solid #e2e8f0' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(formData.items || []).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ padding:8 }}>
                              <input type="text" placeholder="Item name"
                                value={item.itemName || ''}
                                readOnly={!!item.poItemId}
                                onChange={e => handleUpdateItem(idx, 'itemName', e.target.value)}
                                style={{ width:'100%', padding:'6px 8px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:13, boxSizing:'border-box', backgroundColor: item.poItemId ? '#f8fafc' : 'white', cursor: item.poItemId ? 'not-allowed' : 'text' }}
                              />
                            </td>
                            <td style={{ padding:8 }}>
                              <input type="text" placeholder="Description"
                                value={item.description || ''}
                                readOnly={!!item.poItemId}
                                onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                                style={{ width:'100%', padding:'6px 8px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:13, boxSizing:'border-box', backgroundColor: item.poItemId ? '#f8fafc' : 'white', cursor: item.poItemId ? 'not-allowed' : 'text' }}
                              />
                              {item.poItemId && <small style={{ fontSize:11, color:'#94a3b8', display:'block', marginTop:2 }}>PO Item #{item.poItemId}</small>}
                            </td>
                            {formData.poId && <td style={{ padding:8, textAlign:'center', fontSize:13, color:'#64748b' }}>{item.orderedQty || '-'}</td>}
                            {formData.poId && <td style={{ padding:8, textAlign:'center', fontSize:13, color:'#64748b' }}>{item.deliveredQty || '-'}</td>}
                            {formData.poId && <td style={{ padding:8, textAlign:'center', fontSize:13, fontWeight:600, color:'#22c55e' }}>{item.pendingQty || '-'}</td>}
                            <td style={{ padding:8 }}>
                              <input type="number" placeholder="Qty" min="0" step="0.01"
                                value={item.quantity || ''}
                                max={item.maxBillableQty || undefined}
                                onChange={e => {
                                  const v = parseFloat(e.target.value) || 0;
                                  if (item.maxBillableQty && v > item.maxBillableQty) {
                                    showError(`Max billable qty is ${item.maxBillableQty}`); return;
                                  }
                                  handleUpdateItem(idx, 'quantity', v);
                                }}
                                style={{ width:'100%', padding:'6px 8px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:13, boxSizing:'border-box' }}
                              />
                              {item.maxBillableQty && <small style={{ fontSize:11, color:'#f59e0b', display:'block', marginTop:2 }}>Max: {item.maxBillableQty}</small>}
                            </td>
                            <td style={{ padding:8 }}>
                              <input type="number" placeholder="Price" min="0" step="0.01"
                                value={item.unitPrice || ''}
                                onChange={e => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                style={{ width:'100%', padding:'6px 8px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:13, boxSizing:'border-box' }}
                              />
                            </td>
                            <td style={{ padding:8 }}>
                              <input type="number" placeholder="18" min="0" max="100" step="0.01"
                                value={item.taxPercent || ''}
                                onChange={e => handleUpdateItem(idx, 'taxPercent', parseFloat(e.target.value) || 0)}
                                style={{ width:'100%', padding:'6px 8px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:13, boxSizing:'border-box' }}
                              />
                            </td>
                            <td style={{ padding:8, fontWeight:600, color:'#1e293b', whiteSpace:'nowrap' }}>{fmtCurrency(calcLineTotal(item))}</td>
                            <td style={{ padding:8, textAlign:'center' }}>
                              {(formData.items || []).length > 1 && !item.poItemId && (
                                <button type="button" onClick={() => handleRemoveItem(idx)}
                                  style={{ background:'#fee2e2', border:'none', borderRadius:4, padding:'4px 8px', cursor:'pointer', color:'#dc2626', fontSize:14 }}>✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12, fontWeight:600, fontSize:14, color:'#1e293b' }}>
                    Total: {fmtCurrency(calcBillTotal())}
                  </div>
                </div>
              </div>

                {/* File Upload */}
                <div className="receipts-page-form-section">
                  <h3>Attach Bill Document</h3>
                  <div className="receipts-page-form-group">
                    <label>Upload Bill (PDF, PNG, JPG — Max 5MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      style={{ marginTop: 6 }}
                    />
                    {selectedFile && (
                      <p style={{ marginTop: 6, fontSize: 13, color: '#16a34a' }}>
                        ✓ {selectedFile.name} selected
                      </p>
                    )}
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