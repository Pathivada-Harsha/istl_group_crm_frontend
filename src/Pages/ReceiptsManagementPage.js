import React, { useState, useEffect, useRef } from 'react';
import { Eye, Edit2, Trash2, Download, DollarSign, Settings, GripVertical, RefreshCw, Upload, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown, Link2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import * as XLSX from 'xlsx';
import '../pages-css/ReceiptsManagementPage.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import filterApi from '../services/filterApi';
import ConfirmationModal from '../components/ConfirmationModal';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ✅ Inline hook — no separate file needed
const useConfirmationModal = () => {
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', type: 'confirm',
    onConfirm: null, onCancel: null,
    confirmText: 'Confirm', cancelText: 'Cancel', showCancel: true
  });

  const showConfirmation = (config) => {
    return new Promise((resolve) => {
      const showCancel = config.showCancel !== undefined
        ? config.showCancel
        : (config.type === 'confirm' || config.type === 'alert');
      setConfirmModal({
        show: true,
        title: config.title || 'Confirm Action',
        message: config.message || 'Are you sure you want to proceed?',
        type: config.type || 'confirm',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        showCancel,
        onConfirm: () => { setConfirmModal(prev => ({ ...prev, show: false })); resolve(true); },
        onCancel: () => { setConfirmModal(prev => ({ ...prev, show: false })); resolve(false); }
      });
    });
  };

  const hideConfirmation = () => setConfirmModal(prev => ({ ...prev, show: false }));

  return { confirmModal, showConfirmation, hideConfirmation };
};

const ALL_RECEIPT_COLUMNS = [
  { id: 'receiptNo', label: 'Receipt No', visible: true },
  { id: 'receiptDate', label: 'Receipt Date', visible: true },
  { id: 'customer', label: 'Customer', visible: true },
  { id: 'receiptType', label: 'Type', visible: true },
  { id: 'amount', label: 'Amount', visible: true },
  { id: 'appliedAmount', label: 'Applied', visible: true },
  { id: 'unappliedAmount', label: 'Unapplied', visible: true },
  { id: 'paymentMethod', label: 'Payment Method', visible: true },
  { id: 'reference', label: 'Reference', visible: true },
  { id: 'actions', label: 'Actions', visible: true, fixed: true }
];

const SORTABLE_RECEIPT_COLUMNS = new Set(['receiptNo', 'receiptDate', 'customer', 'receiptType', 'amount', 'appliedAmount', 'unappliedAmount', 'paymentMethod', 'reference']);

const SortIcon = ({ columnId, sortConfig }) => {
  if (sortConfig.key !== columnId) return <ChevronsUpDown size={13} style={{ opacity: 0.4, marginLeft: 4, verticalAlign: 'middle' }} />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp size={13} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#059669' }} />
    : <ChevronDown size={13} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#059669' }} />;
};

const ReceiptsManagementPage = () => {
  const [receipts, setReceipts] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions, isAccountsExecutive } = useAuth();
  const receiptPerms = pagePermissions?.INVOICES || pagePermissions?.RECEIPTS || [];
  const canView    = receiptPerms.includes('VIEW')   || isAccountsExecutive;
  const canCreate  = receiptPerms.includes('CREATE') || isAccountsExecutive;
  const canEdit    = receiptPerms.includes('EDIT')   || isAccountsExecutive;
  const canDelete  = receiptPerms.includes('DELETE') && !isAccountsExecutive;
  const isViewOnly = canView && !canCreate && !canEdit && !canDelete;
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

  // ✅ Confirmation modal hook
  const { confirmModal, showConfirmation } = useConfirmationModal();

  // Column management
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('receiptColumns');
    return saved ? JSON.parse(saved) : ALL_RECEIPT_COLUMNS;
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Table column drag
  const [draggedColIndex, setDraggedColIndex] = useState(null);
  const [dragOverColIndex, setDragOverColIndex] = useState(null);

  // Filters
  const [filters, setFilters] = useState({ search: '', receiptType: 'all', paymentMethod: 'all' });

  const [showEditReceiptModal, setShowEditReceiptModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [showDeletedReceipts, setShowDeletedReceipts] = useState(false);
  const [deletedReceipts, setDeletedReceipts] = useState([]);
  const [showEditAllocationModal, setShowEditAllocationModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [allocationDetails, setAllocationDetails] = useState([]);
  const [selectedAllocationToEdit, setSelectedAllocationToEdit] = useState(null);

  // ✅ NEW: Allocation details for View modal
  const [viewAllocationDetails, setViewAllocationDetails] = useState([]);
  const [loadingViewAllocations, setLoadingViewAllocations] = useState(false);

  // ✅ NEW: Invoice details for INVOICE_PAYMENT view modal
  const [viewInvoiceDetails, setViewInvoiceDetails] = useState(null);

  // Excel import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [bulkImportProgress, setBulkImportProgress] = useState(null);
  const [bulkImportDone, setBulkImportDone] = useState(false);
  const fileInputRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [editReceiptFormData, setEditReceiptFormData] = useState({ receiptDate: '', amount: 0, paymentMethod: 'Bank Transfer', transactionReference: '', notes: '' });

  // ── Edit-receipt project change state ──
  const [editReceiptProjectGroups, setEditReceiptProjectGroups]   = useState([]);
  const [editReceiptProjectSubs, setEditReceiptProjectSubs]       = useState([]);
  const [editReceiptProjectList, setEditReceiptProjectList]       = useState([]);
  const [editReceiptGroupName, setEditReceiptGroupName]           = useState('');
  const [editReceiptSubGroupName, setEditReceiptSubGroupName]     = useState('');
  const [editReceiptProjectId, setEditReceiptProjectId]           = useState('');
  const [editReceiptProjectLoading, setEditReceiptProjectLoading] = useState({ groups: false, subs: false, projects: false });
  const [showChangeProjectPanel, setShowChangeProjectPanel]       = useState(false);

  // Modal states
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [stats, setStats] = useState(null);

  // Dropdown states
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  // eslint-disable-next-line no-unused-vars
  const [editMode, setEditMode] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [availableAdvances, setAvailableAdvances] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  const [customerData, setCustomerData] = useState(null);
  const [invoicesForCustomer, setInvoicesForCustomer] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [receiptFormData, setReceiptFormData] = useState({
    customerId: null, projectId: '', groupId: '', subGroupId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    receiptType: 'advance', amount: 0, paymentMethod: 'Bank Transfer',
    transactionReference: '', notes: '', invoiceId: null
  });

  const [adjustmentData, setAdjustmentData] = useState({ receiptId: null, customerId: null, availableAmount: 0, invoiceAllocations: [] });

  useEffect(() => { localStorage.setItem('receiptColumns', JSON.stringify(columns)); }, [columns]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReceipts(); }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.receiptType, filters.search]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStats(); }, [groupName, subGroupName, projectId]);

  // ---------- Sorting ----------
  const sortedReceipts = React.useMemo(() => {
    if (!sortConfig.key) return receipts;
    return [...receipts].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'receiptNo': aVal = a.receiptNo || ''; bVal = b.receiptNo || ''; break;
        case 'receiptDate': aVal = new Date(a.receiptDate || 0); bVal = new Date(b.receiptDate || 0); break;
        case 'customer': aVal = a.customerCompanyName || a.customerName || ''; bVal = b.customerCompanyName || b.customerName || ''; break;
        case 'receiptType': aVal = a.receiptType || ''; bVal = b.receiptType || ''; break;
        case 'amount': aVal = parseFloat(a.amount) || 0; bVal = parseFloat(b.amount) || 0; break;
        case 'appliedAmount': aVal = parseFloat(a.appliedAmount) || 0; bVal = parseFloat(b.appliedAmount) || 0; break;
        case 'unappliedAmount': aVal = parseFloat(a.unappliedAmount) || 0; bVal = parseFloat(b.unappliedAmount) || 0; break;
        case 'paymentMethod': aVal = a.paymentMethod || ''; bVal = b.paymentMethod || ''; break;
        case 'reference': aVal = a.transactionReference || ''; bVal = b.transactionReference || ''; break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [receipts, sortConfig]);

  const handleSort = (columnId) => {
    if (!SORTABLE_RECEIPT_COLUMNS.has(columnId)) return;
    setSortConfig(prev => ({ key: columnId, direction: prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // ---------- Table column drag ----------
  const handleColDragStart = (e, index) => { setDraggedColIndex(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleColDragOver = (e, index) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverColIndex(index); };
  const handleColDrop = (e, index) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === index) { setDraggedColIndex(null); setDragOverColIndex(null); return; }
    const visibleCols = columns.filter(c => c.visible);
    const newVisible = [...visibleCols];
    const [moved] = newVisible.splice(draggedColIndex, 1);
    newVisible.splice(index, 0, moved);
    const hiddenCols = columns.filter(c => !c.visible);
    setColumns([...newVisible, ...hiddenCols]);
    setDraggedColIndex(null); setDragOverColIndex(null);
  };
  const handleColDragEnd = () => { setDraggedColIndex(null); setDragOverColIndex(null); };

  // ---------- Excel Import ----------
  const VALID_RECEIPT_TYPES = new Set(['ADVANCE', 'INVOICE_PAYMENT']);
  const VALID_PAYMENT_METHODS = new Set(['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Credit Card']);

  /**
   * Parse any date value from Excel into YYYY-MM-DD for the API.
   * Handles:
   *   - Excel serial numbers (e.g. 46380)
   *   - DD/MM/YYYY  or  DD-MM-YYYY  (preferred user format: day month year)
   *   - DD/MM/YY   or  DD-MM-YY
   *   - MM/DD/YYYY (US format fallback)
   *   - YYYY-MM-DD (already correct)
   *   - JS Date objects
   */
  const parseExcelDate = (raw) => {
    if (!raw && raw !== 0) return null;

    // Excel serial number (number type from XLSX lib when cell is a real date cell)
    if (typeof raw === 'number') {
      // XLSX serial: days since 1900-01-01 (with Lotus 1-2-3 leap year bug at 60)
      const serial = raw > 60 ? raw - 1 : raw; // skip the phantom Feb 29 1900
      const epoch = new Date(Date.UTC(1900, 0, 1));
      epoch.setUTCDate(epoch.getUTCDate() + serial - 1);
      return epoch.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // JS Date object
    if (raw instanceof Date) {
      const y = raw.getFullYear();
      const m = String(raw.getMonth() + 1).padStart(2, '0');
      const d = String(raw.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const str = String(raw).trim();
    if (!str) return null;

    // Already ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, '-');

    // DD/MM/YYYY or DD-MM-YYYY (day first — user's preferred format)
    const dmySlash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmySlash) {
      const [, d, m, y] = dmySlash;
      // Treat as DD/MM/YYYY when day ≤ 12 we still prefer DD/MM; when day > 12 it must be DD/MM
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }

    // DD/MM/YY or DD-MM-YY (2-digit year)
    const dmyShort = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyShort) {
      const [, d, m, y] = dmyShort;
      const fullYear = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
      return `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }

    // Try native Date.parse as last resort
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return null; // unparseable
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        // Use raw:true so date cells come as Excel serial numbers (not pre-formatted strings)
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        const headerRowIdx = data.findIndex(row =>
          row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('receipt date') || cell.toLowerCase().includes('amount')))
        );
        if (headerRowIdx === -1) { showError('Invalid template format. Please use the provided template.'); return; }
        const rows = data.slice(headerRowIdx + 1).filter(row => row[0] !== '' && row[0] != null);
        const errors = [];
        const parsed = rows.map((row, i) => {
          const rowNum = headerRowIdx + 2 + i;

          // Parse date — accepts serial numbers, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
          const rawDate = row[0];
          const receiptDate = parseExcelDate(rawDate);
          if (!receiptDate) {
            errors.push(`Row ${rowNum}: Invalid date "${rawDate}" — use DD/MM/YYYY format (e.g. 06/04/2026)`);
          }

          const amount = parseFloat(row[1]);
          const receiptType = String(row[2] || 'ADVANCE').trim().toUpperCase().replace(' ', '_');
          const paymentMethod = String(row[3] || 'Bank Transfer').trim();
          const transactionReference = String(row[4] || '').trim();
          const invoiceNo = String(row[5] || '').trim();
          const notes = String(row[6] || '').trim();

          if (isNaN(amount) || amount <= 0) errors.push(`Row ${rowNum}: Invalid amount "${row[1]}"`);
          if (!VALID_RECEIPT_TYPES.has(receiptType)) errors.push(`Row ${rowNum}: Invalid type "${row[2]}" (use ADVANCE or INVOICE_PAYMENT)`);
          if (!VALID_PAYMENT_METHODS.has(paymentMethod)) errors.push(`Row ${rowNum}: Invalid payment method "${row[3]}"`);

          return {
            receiptDate: receiptDate || '',
            amount: isNaN(amount) ? 0 : amount,
            receiptType: VALID_RECEIPT_TYPES.has(receiptType) ? receiptType : 'ADVANCE',
            paymentMethod: VALID_PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : 'Bank Transfer',
            transactionReference, invoiceNo, notes
          };
        });
        setImportErrors(errors);
        setImportPreview(parsed);
      } catch (err) { showError('Failed to read file. Please use a valid Excel file.'); }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (importErrors.length > 0) { showError('Please fix errors before importing'); return; }
    if (importPreview.length === 0) { showError('No valid rows to import'); return; }
    if (!receiptFormData.customerId) { showError('Please select a Project/Customer before importing — the import needs a customer to link each receipt to.'); return; }

    setBulkImportProgress({ current: 0, total: importPreview.length, results: [] });
    setBulkImportDone(false);

    let successCount = 0;
    const results = [];

    for (let i = 0; i < importPreview.length; i++) {
      const row = importPreview[i];
      setBulkImportProgress({ current: i + 1, total: importPreview.length, results: [...results] });
      try {
        const receiptData = {
          customerId: receiptFormData.customerId,
          projectId: receiptFormData.projectId,
          groupId: receiptFormData.groupId,
          subGroupId: receiptFormData.subGroupId,
          receiptDate: row.receiptDate,
          receiptType: row.receiptType,
          amount: parseFloat(row.amount),
          paymentMethod: row.paymentMethod,
          transactionReference: row.transactionReference || '',
          notes: row.notes || '',
          invoiceId: null
        };
        const response = await fetch(`${API_BASE_URL}/invoices/receipts`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(receiptData)
        });
        if (!response.ok) {
          const err = await response.json();
          results.push({ row: i + 1, date: row.receiptDate, amount: row.amount, status: 'error', message: err.message || 'Failed' });
        } else {
          successCount++;
          results.push({ row: i + 1, date: row.receiptDate, amount: row.amount, status: 'success', message: 'Saved' });
        }
      } catch (err) {
        results.push({ row: i + 1, date: row.receiptDate, amount: row.amount, status: 'error', message: err.message || 'Network error' });
      }
    }

    setBulkImportProgress({ current: importPreview.length, total: importPreview.length, results });
    setBulkImportDone(true);
    fetchReceipts();
    fetchStats();
    if (successCount === importPreview.length) {
      showSuccess(`All ${successCount} receipts imported successfully!`);
    } else {
      showError(`${successCount} of ${importPreview.length} receipts imported. ${importPreview.length - successCount} failed — see results below.`);
    }
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    setImportFileName('');
    setBulkImportProgress(null);
    setBulkImportDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/receipt_template.xlsx';
    link.download = 'receipt_template.xlsx';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // ---------- Existing logic ----------
  const getAuthHeaders = () => {
    try {
      const raw = localStorage.getItem('bd_portal_user');
      const u = raw ? (JSON.parse(raw)?.user || {}) : {};
      return {
        'Content-Type': 'application/json',
        'x-user-id':   String(u.id   || user?.id   || ''),
        'x-user-role': String(u.role || user?.role || ''),
        'User-Id':     String(u.id   || user?.id   || ''),
        'User-Role':   String(u.role || user?.role || ''),
      };
    } catch { return { 'Content-Type': 'application/json' }; }
  };

  const getStatusClass = (status) => {
    const map = { 'DRAFT': 'Invoices-page-status-draft', 'Draft': 'Invoices-page-status-draft', 'SENT': 'Invoices-page-status-sent', 'Sent': 'Invoices-page-status-sent', 'PAID': 'Invoices-page-status-paid', 'Paid': 'Invoices-page-status-paid', 'PARTIALLY_PAID': 'Invoices-page-payment-partial', 'Partially Paid': 'Invoices-page-payment-partial', 'CANCELLED': 'Invoices-page-status-cancelled', 'Cancelled': 'Invoices-page-status-cancelled' };
    return map[status] || '';
  };
  const getStatusDisplayName = (status) => {
    const map = { 'DRAFT': 'Draft', 'Draft': 'Draft', 'SENT': 'Sent', 'Sent': 'Sent', 'PAID': 'Paid', 'Paid': 'Paid', 'PARTIALLY_PAID': 'Partially Paid', 'Partially Paid': 'Partially Paid', 'CANCELLED': 'Cancelled', 'Cancelled': 'Cancelled' };
    return map[status] || status;
  };

  const fetchAllocationDetails = async (receiptId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${receiptId}/allocations`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch allocation details');
      return await response.json();
    } catch (error) { console.error('Failed to fetch allocation details:', error); showError('Failed to load allocation details'); return []; }
  };

  const handleEditAllocationClick = async (receipt) => {
    setEditingAllocation(receipt); setLoading(true);
    try {
      const allocations = await fetchAllocationDetails(receipt.id);
      setAllocationDetails(allocations);
      await fetchInvoicesForCustomer(receipt.customerId, receipt.projectId);
      setShowEditAllocationModal(true);
    } catch (error) { showError('Failed to load allocation information'); }
    finally { setLoading(false); }
  };

  const handleSaveEditedAllocation = async () => {
    if (!selectedAllocationToEdit?.newInvoiceId) { showError('Please select a new invoice'); return; }
    if (!selectedAllocationToEdit?.newAmount || selectedAllocationToEdit.newAmount <= 0) { showError('Please enter a valid amount'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${editingAllocation.id}/allocations/edit`, {
        credentials: "include", method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ oldInvoiceId: selectedAllocationToEdit.oldInvoiceId, newInvoiceId: selectedAllocationToEdit.newInvoiceId, newAmount: parseFloat(selectedAllocationToEdit.newAmount) })
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to update allocation'); }
      showSuccess('Allocation updated successfully!');
      setShowEditAllocationModal(false); setSelectedAllocationToEdit(null); setAllocationDetails([]);
      fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to update allocation'); }
    finally { setLoading(false); }
  };

  // ✅ Updated: uses ConfirmationModal instead of window.confirm
  const handleRemoveAllocation = async (invoiceId) => {
    const confirmed = await showConfirmation({
      title: 'Remove Allocation',
      message: 'Are you sure you want to remove this allocation? This will reverse the applied amount on the invoice.',
      type: 'alert',
      confirmText: 'Remove',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${editingAllocation.id}/allocations/${invoiceId}`, { credentials: "include", method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to remove allocation'); }
      showSuccess('Allocation removed successfully!');
      const updatedAllocations = await fetchAllocationDetails(editingAllocation.id);
      setAllocationDetails(updatedAllocations); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to remove allocation'); }
    finally { setLoading(false); }
  };

  const handleEditReceiptClick = async (receipt) => {
    setEditingReceipt(receipt);
    setEditReceiptFormData({ receiptDate: receipt.receiptDate, amount: receipt.amount, paymentMethod: receipt.paymentMethod || 'Bank Transfer', transactionReference: receipt.transactionReference || '', notes: receipt.notes || '' });
    setEditReceiptGroupName(receipt.groupId || '');
    setEditReceiptSubGroupName(receipt.subGroupId || '');
    setEditReceiptProjectId(receipt.projectId || '');
    setEditReceiptProjectGroups([]); setEditReceiptProjectSubs([]); setEditReceiptProjectList([]);
    setShowEditReceiptModal(true);
    // Only load project dropdowns for ADVANCE — INVOICE_PAYMENT project is locked
    if (receipt.receiptType === 'ADVANCE') {
      const groups = await filterApi.getAllGroups();
      setEditReceiptProjectGroups(groups || []);
      if (receipt.groupId) {
        const subs = await filterApi.getSubGroups(receipt.groupId);
        setEditReceiptProjectSubs(subs || []);
        if (receipt.subGroupId) {
          const projects = await filterApi.getProjects(receipt.groupId, receipt.subGroupId);
          setEditReceiptProjectList(projects || []);
        }
      }
    }
    if (receipt.receiptType === 'INVOICE_PAYMENT' && receipt.invoiceId) await fetchInvoicesForCustomer(receipt.customerId, receipt.projectId);
  };

  const handleSaveEditedReceipt = async () => {
    if (editReceiptFormData.amount <= 0) { showError('Amount must be greater than zero'); return; }

    const isInvoicePayment = editingReceipt.receiptType === 'INVOICE_PAYMENT';

    if (!isInvoicePayment) {
      if (!editReceiptGroupName) { showError('Please select a group'); return; }
      if (!editReceiptProjectId) { showError('Please select a project'); return; }
    }

    const projectChanged = !isInvoicePayment && (
      editReceiptGroupName !== (editingReceipt.groupId || '')
      || editReceiptSubGroupName !== (editingReceipt.subGroupId || '')
      || editReceiptProjectId !== (editingReceipt.projectId || '')
    );

    let confirmMsg = `Save changes to receipt ${editingReceipt.receiptNo}?\n\nAmount: ${formatCurrency(editReceiptFormData.amount)}\nDate: ${editReceiptFormData.receiptDate}\nMethod: ${editReceiptFormData.paymentMethod}`;
    if (projectChanged) {
      const hasAllocs = parseFloat(editingReceipt.appliedAmount) > 0;
      confirmMsg = `This advance will be reassigned to a different project.\n\n`
        + `From: ${editingReceipt.groupId || '—'} › ${editingReceipt.subGroupId || '—'} › ${editingReceipt.projectId || '—'}\n`
        + `To:   ${editReceiptGroupName} › ${editReceiptSubGroupName || '—'} › ${editReceiptProjectId}\n\n`
        + (hasAllocs
            ? `⚠ This advance has ${formatCurrency(editingReceipt.appliedAmount)} already allocated to invoices.\n`
            + `Those allocations will be automatically REVERSED so the advance starts fresh under the new project.\n\n`
            : '')
        + `Confirm project change and save?`;
    }

    const confirmed = await showConfirmation({
      title: projectChanged ? 'Confirm Project Change & Save' : 'Update Receipt',
      message: confirmMsg,
      type: 'confirm',
      confirmText: projectChanged ? 'Yes, Reverse & Reassign' : 'Save Changes',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      const receiptData = {
        ...editReceiptFormData,
        receiptType: editingReceipt.receiptType,
        invoiceId: editingReceipt.invoiceId,
        customerId: editingReceipt.customerId,
        projectId:  isInvoicePayment ? editingReceipt.projectId  : editReceiptProjectId,
        groupId:    isInvoicePayment ? editingReceipt.groupId    : editReceiptGroupName,
        subGroupId: isInvoicePayment ? editingReceipt.subGroupId : editReceiptSubGroupName,
      };
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${editingReceipt.id}`, { credentials: "include", method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(receiptData) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to update receipt'); }
      showSuccess(projectChanged ? 'Advance reassigned. Existing invoice allocations have been reversed.' : 'Receipt updated successfully!');
      setShowEditReceiptModal(false); setEditingReceipt(null); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to update receipt'); }
    finally { setLoading(false); }
  };

  const handleDeleteReceiptClick = async (receipt) => {
    const hasAlloc = receipt.receiptType === 'ADVANCE' && receipt.appliedAmount > 0;
    const receiptType = receipt.receiptType === 'ADVANCE' ? 'Advance' : 'Invoice Payment';
    const warningLine = hasAlloc ? ('\n\n⚠ Warning: ' + formatCurrency(receipt.appliedAmount) + ' is already allocated to invoices. Deleting will reverse all allocations.') : '';
    const msg = 'Are you sure you want to delete receipt ' + receipt.receiptNo + '?\n\nDate: ' + formatDate(receipt.receiptDate) + '\nAmount: ' + formatCurrency(receipt.amount) + '\nType: ' + receiptType + warningLine + '\n\nNote: This is a soft delete and can be restored later.';
    const confirmed = await showConfirmation({
      title: 'Delete Receipt',
      message: msg,
      type: 'alert',
      confirmText: 'Delete Receipt',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${receipt.id}`, { credentials: "include", method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to delete receipt'); }
      showSuccess('Receipt deleted successfully!'); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to delete receipt'); }
    finally { setLoading(false); }
  };

  const fetchDeletedReceipts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/deleted`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch deleted receipts');
      setDeletedReceipts(await response.json());
    } catch (error) { showError('Failed to load deleted receipts'); setDeletedReceipts([]); }
    finally { setLoading(false); }
  };

  // ✅ Updated: uses ConfirmationModal instead of window.confirm
  const handleRestoreReceipt = async (receiptId) => {
    const confirmed = await showConfirmation({
      title: 'Restore Receipt',
      message: 'Are you sure you want to restore this receipt? It will be moved back to the active receipts list.',
      type: 'confirm',
      confirmText: 'Restore',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${receiptId}/restore`, { credentials: "include", method: 'POST', headers: getAuthHeaders() });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to restore receipt'); }
      showSuccess('Receipt restored successfully!'); fetchDeletedReceipts(); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to restore receipt'); }
    finally { setLoading(false); }
  };

  const handleToggleDeletedReceipts = () => { if (!showDeletedReceipts) fetchDeletedReceipts(); setShowDeletedReceipts(!showDeletedReceipts); };

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'receiptDate', sortDirection: 'DESC' });
      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.receiptType !== 'all') params.append('receiptType', filters.receiptType);
      if (filters.search) params.append('searchTerm', filters.search);
      const response = await fetch(`${API_BASE_URL}/invoices/receipts?${params}`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setReceipts(data.receipts || []); setTotalPages(data.totalPages || 0); setTotalElements(data.totalElements || 0);
    } catch (error) { console.error('Failed to fetch receipts:', error); showError('Failed to load receipts'); setReceipts([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append("groupId", groupName);
      if (subGroupName) params.append("subGroupId", subGroupName);
      if (projectId) params.append("projectId", projectId);
      // KPI cards always match the table — no createdBy restriction.
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/summary?${params.toString()}`, { method: "GET", credentials: "include", headers: getAuthHeaders() });
      if (response.ok) setStats(await response.json());
      else setStats({ totalReceipts: 0, totalAmount: 0, appliedAmount: 0, unappliedAmount: 0, advanceReceipts: 0, invoiceReceipts: 0 });
    } catch (error) { setStats({ totalReceipts: 0, totalAmount: 0, appliedAmount: 0, unappliedAmount: 0, advanceReceipts: 0, invoiceReceipts: 0 }); }
  };

  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try { setModalGroups(await filterApi.getAllGroups() || []); }
    catch { showError('Failed to load groups'); setModalGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };
  const fetchModalSubGroups = async (gn) => {
    if (!gn) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try { setModalSubGroups(await filterApi.getSubGroups(gn) || []); }
    catch { showError('Failed to load categories'); setModalSubGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };
  const fetchModalProjects = async (gn, sg) => {
    if (!gn || !sg) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try { setModalProjects(await filterApi.getProjects(gn, sg) || []); }
    catch { showError('Failed to load projects'); setModalProjects([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const fetchCustomerByProject = async (pid) => {
    if (!pid) { setCustomerData(null); setInvoicesForCustomer([]); setAvailableAdvances([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/customer-by-project/${pid}`, { credentials: "include", headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json(); setCustomerData(data);
        setReceiptFormData(prev => ({ ...prev, customerId: data.customerId }));
        await fetchInvoicesForCustomer(data.customerId, pid);
        if (showAdjustmentModal) await fetchAvailableAdvances(data.customerId);
      } else { setCustomerData(null); setInvoicesForCustomer([]); setAvailableAdvances([]); showError('Customer not found for this project'); }
    } catch { setCustomerData(null); setInvoicesForCustomer([]); setAvailableAdvances([]); }
  };

  const fetchInvoicesForCustomer = async (customerId, projectId) => {
    if (!customerId && !projectId) { setInvoicesForCustomer([]); return; }
    setLoadingInvoices(true);
    try {
      // Always prefer project-scoped endpoint so only invoices for THIS project are shown.
      // Fall back to customer endpoint only when no projectId is available.
      const endpoint = projectId
        ? `${API_BASE_URL}/invoices/project/${encodeURIComponent(projectId)}/unpaid-invoices`
        : `${API_BASE_URL}/invoices/customer/${customerId}/unpaid-invoices`;
      const response = await fetch(endpoint, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json(); setInvoicesForCustomer(data);
      if (data.length === 0) showError('No unpaid invoices found for this project');
    } catch { showError('Failed to load invoices for this project'); setInvoicesForCustomer([]); }
    finally { setLoadingInvoices(false); }
  };

  const fetchAvailableAdvances = async (customerId) => {
    if (!customerId) { setAvailableAdvances([]); return; }
    setLoadingAdvances(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/customer/${customerId}/unapplied-advances-details`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch advances');
      setAvailableAdvances(await response.json());
    } catch { setAvailableAdvances([]); }
    finally { setLoadingAdvances(false); }
  };

  // ── Edit-receipt project helpers ──
  const fetchEditReceiptGroups = async () => {
    setEditReceiptProjectLoading(p => ({ ...p, groups: true }));
    try { setEditReceiptProjectGroups(await filterApi.getAllGroups() || []); }
    catch { showError('Failed to load groups'); }
    finally { setEditReceiptProjectLoading(p => ({ ...p, groups: false })); }
  };
  const fetchEditReceiptSubs = async (g) => {
    if (!g) { setEditReceiptProjectSubs([]); setEditReceiptProjectList([]); return; }
    setEditReceiptProjectLoading(p => ({ ...p, subs: true }));
    try { setEditReceiptProjectSubs(await filterApi.getSubGroups(g) || []); }
    catch { showError('Failed to load sub-groups'); }
    finally { setEditReceiptProjectLoading(p => ({ ...p, subs: false })); }
  };
  const fetchEditReceiptProjects = async (g, sg) => {
    if (!g || !sg) { setEditReceiptProjectList([]); return; }
    setEditReceiptProjectLoading(p => ({ ...p, projects: true }));
    try { setEditReceiptProjectList(await filterApi.getProjects(g, sg) || []); }
    catch { showError('Failed to load projects'); }
    finally { setEditReceiptProjectLoading(p => ({ ...p, projects: false })); }
  };
  const handleEditReceiptGroupChange = (e) => {
    const v = e.target.value;
    setEditReceiptGroupName(v); setEditReceiptSubGroupName(''); setEditReceiptProjectId('');
    setEditReceiptProjectSubs([]); setEditReceiptProjectList([]);
    if (v) fetchEditReceiptSubs(v);
  };
  const handleEditReceiptSubGroupChange = (e) => {
    const v = e.target.value;
    setEditReceiptSubGroupName(v); setEditReceiptProjectId(''); setEditReceiptProjectList([]);
    if (editReceiptGroupName && v) fetchEditReceiptProjects(editReceiptGroupName, v);
  };
  const handleEditReceiptProjectChange = (e) => {
    setEditReceiptProjectId(e.target.value);
  };
  const handleApplyEditReceiptProject = () => {
    if (!editReceiptGroupName) { showError('Please select a group'); return; }
    if (!editReceiptProjectId) { showError('Please select a project'); return; }
    // Apply new project to the receipt being edited (will be sent on save)
    setEditingReceipt(prev => ({
      ...prev,
      groupId: editReceiptGroupName,
      subGroupId: editReceiptSubGroupName,
      projectId: editReceiptProjectId,
    }));
    setShowChangeProjectPanel(false);
    showSuccess('Project updated. Save the receipt to confirm.');
  };

  const handleModalGroupChange = (e) => {
    const v = e.target.value; setModalGroupName(v); setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]); setCustomerData(null);
    setReceiptFormData({ ...receiptFormData, groupId: v, subGroupId: '', projectId: '', customerId: null });
    if (v) fetchModalSubGroups(v);
  };
  const handleModalSubGroupChange = (e) => {
    const v = e.target.value; setModalSubGroupName(v); setModalProjectId(''); setModalProjects([]); setCustomerData(null);
    setReceiptFormData({ ...receiptFormData, subGroupId: v, projectId: '', customerId: null });
    if (modalGroupName && v) fetchModalProjects(modalGroupName, v);
  };
  const handleModalProjectChange = (e) => {
    const v = e.target.value; setModalProjectId(v);
    setReceiptFormData({ ...receiptFormData, projectId: v });
    if (v) fetchCustomerByProject(v);
  };

  const handleCreateNew = () => {
    setReceiptFormData({ customerId: null, projectId: '', groupId: '', subGroupId: '', receiptDate: new Date().toISOString().split('T')[0], receiptType: 'advance', amount: 0, paymentMethod: 'Bank Transfer', transactionReference: '', notes: '', invoiceId: null });
    setCustomerData(null); setModalGroupName(''); setModalSubGroupName(''); setModalProjectId(''); setEditMode(false); setInvoicesForCustomer([]);
    fetchModalGroups(); setShowCreateModal(true);
  };

  // ✅ UPDATED: handleViewReceipt fetches allocations for ADVANCE and invoice details for INVOICE_PAYMENT
  const handleViewReceipt = async (receipt) => {
    setSelectedReceipt(receipt);
    setViewAllocationDetails([]);
    setViewInvoiceDetails(null);
    setShowReceiptModal(true);

    // For ADVANCE type with applied amount > 0, fetch allocation details
    if (receipt.receiptType === 'ADVANCE' && parseFloat(receipt.appliedAmount) > 0) {
      setLoadingViewAllocations(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/invoices/receipts/${receipt.id}/allocations`,
          { credentials: "include", headers: getAuthHeaders() }
        );
        if (response.ok) {
          const data = await response.json();
          setViewAllocationDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch view allocation details:', error);
      } finally {
        setLoadingViewAllocations(false);
      }
    }

    // For INVOICE_PAYMENT type, fetch the linked invoice's details
    if (receipt.receiptType === 'INVOICE_PAYMENT' && receipt.invoiceId) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/invoices/${receipt.invoiceId}`,
          { credentials: "include", headers: getAuthHeaders() }
        );
        if (response.ok) {
          const data = await response.json();
          setViewInvoiceDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch invoice details for receipt view:', error);
      }
    }
  };

  const handleEditReceipt = async (receipt) => {
    setSelectedReceipt(receipt); setLoading(true);
    try {
      // Scope invoices to the same project as this receipt so only
      // invoices under this project are available for allocation.
      const ep = receipt.projectId
        ? `${API_BASE_URL}/invoices/project/${encodeURIComponent(receipt.projectId)}/unpaid-invoices`
        : `${API_BASE_URL}/invoices/customer/${receipt.customerId}/unpaid-invoices`;
      const res = await fetch(ep, { credentials: "include", headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setInvoicesForCustomer(d); if (d.length === 0) showError('No unpaid invoices found for this project'); }
      else { setInvoicesForCustomer([]); showError('Failed to load invoices for this project'); }
      setAdjustmentData({ receiptId: receipt.id, customerId: receipt.customerId, availableAmount: receipt.unappliedAmount || receipt.amount, invoiceAllocations: [] });
      setShowAdjustmentModal(true);
    } catch { showError('Failed to load invoices'); setInvoicesForCustomer([]); }
    finally { setLoading(false); }
  };

  const handleSaveReceipt = async () => {
    if (!receiptFormData.customerId) { showError('Please select a project to identify the customer'); return; }
    if (receiptFormData.receiptType === 'invoice' && !receiptFormData.invoiceId) { showError('Please select an invoice'); return; }
    if (receiptFormData.amount <= 0) { showError('Amount must be greater than zero'); return; }
    setLoading(true);
    try {
      const receiptData = { ...receiptFormData, receiptType: receiptFormData.receiptType === 'advance' ? 'ADVANCE' : 'INVOICE_PAYMENT', amount: parseFloat(receiptFormData.amount), invoiceId: receiptFormData.receiptType === 'invoice' ? receiptFormData.invoiceId : null };
      const response = await fetch(`${API_BASE_URL}/invoices/receipts`, { credentials: "include", method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(receiptData) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to create receipt'); }
      showSuccess('Receipt recorded successfully!'); setShowCreateModal(false); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to create receipt'); }
    finally { setLoading(false); }
  };

  const handleSaveAdjustment = async () => {
    const allocations = adjustmentData.invoiceAllocations.filter(a => a.amount > 0).map(a => ({ invoiceId: a.invoiceId, amount: parseFloat(a.amount) }));
    if (allocations.length === 0) { showError('Please allocate at least one invoice'); return; }
    const totalAllocation = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocation > (adjustmentData.availableAmount || selectedReceipt.unappliedAmount)) { showError('Total allocation exceeds available advance amount'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/receipts/${adjustmentData.receiptId}/allocate-advance`, { credentials: "include", method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ allocations }) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to allocate advance'); }
      showSuccess('Advance allocated successfully!'); setShowAdjustmentModal(false);
      setAdjustmentData({ receiptId: null, customerId: null, availableAmount: 0, invoiceAllocations: [] }); setInvoicesForCustomer([]); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to allocate advance'); }
    finally { setLoading(false); }
  };

  const handleInvoiceAllocationChange = (invoiceId, value) => {
    const amount = value === '' ? 0 : parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    const invoice = invoicesForCustomer.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    if (amount > invoice.balanceAmount) { showError(`Amount cannot exceed invoice balance of ${formatCurrency(invoice.balanceAmount)}`); return; }
    const currentAllocations = adjustmentData.invoiceAllocations || [];
    const otherTotal = currentAllocations.filter(a => a.invoiceId !== invoiceId).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    if (otherTotal + amount > (adjustmentData.availableAmount || selectedReceipt.unappliedAmount)) { showError('Total allocation exceeds available advance amount'); return; }
    let newAllocations = [...currentAllocations];
    const existingIndex = newAllocations.findIndex(a => a.invoiceId === invoiceId);
    if (amount === 0 || value === '') { if (existingIndex >= 0) newAllocations.splice(existingIndex, 1); }
    else { if (existingIndex >= 0) newAllocations[existingIndex] = { invoiceId, amount }; else newAllocations.push({ invoiceId, amount }); }
    setAdjustmentData({ ...adjustmentData, invoiceAllocations: newAllocations });
  };

  const handleColumnToggle = (columnId) => setColumns(columns.map(col => col.id === columnId ? { ...col, visible: !col.visible } : col));
  const handleColumnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(columns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColumns(items);
  };
  const resetColumns = () => { setColumns(ALL_RECEIPT_COLUMNS); localStorage.removeItem('receiptColumns'); };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const formatDate = (dateStr) => { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const formatDateTime = (dateStr) => { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const getReceiptTypeBadgeClass = (type) => ({ 'Advance': 'receipt-type-advance', 'Invoice': 'receipt-type-invoice', 'Other': 'receipt-type-other' }[type] || '');

  const renderColumnValue = (column, receipt) => {
    switch (column.id) {
      case 'receiptNo': return <td className="receipt-no">{receipt.receiptNo}</td>;
      case 'receiptDate': return <td>{formatDate(receipt.receiptDate)}</td>;
      case 'customer': return <td>{receipt.customerCompanyName || receipt.customerName || `#${receipt.customerId}`}</td>;
      case 'receiptType': return <td><span className={`receipt-badge ${getReceiptTypeBadgeClass(receipt.receiptType)}`}>{receipt.receiptType}</span></td>;
      case 'amount': return <td className="receipt-amount">{formatCurrency(receipt.amount)}</td>;
      case 'appliedAmount': return <td className="text-success">{formatCurrency(receipt.appliedAmount)}</td>;
      case 'unappliedAmount': return <td className="text-warning">{formatCurrency(receipt.unappliedAmount)}</td>;
      case 'paymentMethod': return <td>{receipt.paymentMethod}</td>;
      case 'reference': return <td>{receipt.transactionReference || '—'}</td>;
      case 'actions': return (
        <td>
          <div className="receipt-action-buttons">
            {/* View */}
            <button
              className={`receipt-action-btn btn-view${!canView ? ' action-btn-disabled' : ''}`}
              onClick={() => canView && handleViewReceipt(receipt)}
              title={canView ? 'View' : '🔒 No view permission'}
              disabled={!canView}
            ><Eye size={16} /></button>

            {/* Edit */}
            <button
              className={`receipt-action-btn btn-edit${!canEdit ? ' action-btn-disabled' : ''}`}
              onClick={() => canEdit && handleEditReceiptClick(receipt)}
              title={canEdit ? 'Edit Receipt' : '🔒 No edit permission'}
              disabled={!canEdit}
            ><Edit2 size={16} /></button>

            {/* Edit Allocation — ADVANCE type only */}
            {receipt.receiptType === 'ADVANCE' && receipt.appliedAmount > 0 && (
              <button
                className={`receipt-action-btn btn-edit-allocation${!canEdit ? ' action-btn-disabled' : ''}`}
                onClick={() => canEdit && handleEditAllocationClick(receipt)}
                title={canEdit ? 'Edit Allocation' : '🔒 No edit permission'}
                disabled={!canEdit}
              ><RefreshCw size={16} /></button>
            )}

            {/* Adjust Advance */}
            {receipt.unappliedAmount > 0 && receipt.receiptType === 'ADVANCE' && (
              <button
                className={`receipt-action-btn btn-adjust${!canEdit ? ' action-btn-disabled' : ''}`}
                onClick={() => canEdit && handleEditReceipt(receipt)}
                title={canEdit ? 'Adjust Advance' : '🔒 No edit permission'}
                disabled={!canEdit}
              ><DollarSign size={16} /></button>
            )}

            {/* Download — requires view */}
            <button
              className={`receipt-action-btn btn-download${!canView ? ' action-btn-disabled' : ''}`}
              onClick={() => canView && console.log('Download receipt', receipt.id)}
              title={canView ? 'Download' : '🔒 No view permission'}
              disabled={!canView}
            ><Download size={16} /></button>

            {/* Delete — always shown, disabled if no permission */}
            <button
              className={`receipt-action-btn btn-delete${!canDelete ? ' action-btn-disabled' : ''}`}
              onClick={() => canDelete && handleDeleteReceiptClick(receipt)}
              title={canDelete ? 'Delete' : '🔒 No delete permission'}
              disabled={!canDelete}
            ><Trash2 size={16} /></button>
          </div>
        </td>
      );
      default: return <td>—</td>;
    }
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="receipts-page-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ✅ Confirmation Modal — rendered at root level so it's always on top */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        showCancel={confirmModal.showCancel}
      />

      <div className="receipts-page-breadcrumb">
        <span>Pages</span>
        <span className="receipts-page-separator">{'>'}</span>
        <span className="receipts-page-current">Receipts</span>
      </div>

      <div className="page-header-with-filter">
        <h1 className="receipts-page-title">Payment Receipts ({totalElements})</h1>
        <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
      </div>

      <div className="receipts-page-action-bar">
        <div className="receipts-page-search-filters">
          <input type="text" className="receipts-page-search" placeholder="Search receipts by number..." value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(0); }} />
          <select className="receipts-page-filter" value={filters.receiptType} onChange={(e) => { setFilters({ ...filters, receiptType: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Types</option>
            <option value="ADVANCE">Advance</option>
            <option value="INVOICE_PAYMENT">Invoice Payment</option>
          </select>
          <select className="receipts-page-filter" value={filters.paymentMethod} onChange={(e) => { setFilters({ ...filters, paymentMethod: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Payment Methods</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="Credit Card">Credit Card</option>
          </select>
        </div>
        <div className="receipts-page-actions">
          <button className="receipts-page-btn-secondary" onClick={handleToggleDeletedReceipts} title="View Deleted Receipts"><Trash2 size={16} style={{ marginRight: '8px' }} />{showDeletedReceipts ? 'Hide Deleted' : 'View Deleted'}</button>
          <button className="receipts-page-btn-secondary" onClick={() => setShowColumnManager(!showColumnManager)} title="Manage Columns"><Settings size={16} style={{ marginRight: '8px' }} />Columns</button>
          <button
            className={`receipts-page-btn-primary${!canCreate ? ' action-btn-disabled' : ''}`}
            onClick={() => canCreate && handleCreateNew()}
            disabled={!canCreate}
            title={!canCreate ? '🔒 No create permission' : 'Record New Receipt'}
          >+ Record New Receipt</button>
        </div>
      </div>

      {/* Permission notice for view-only users */}
      {isViewOnly && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, color:'#92400e', fontWeight:500, marginBottom:12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          You have view-only access. Contact your administrator to request Create, Edit, or Delete permissions.
        </div>
      )}

      {/* Column Manager */}
      {showColumnManager && (
        <div className="column-manager-modal">
          <div className="column-manager-content">
            <div className="column-manager-header"><h3>Manage Columns</h3><button onClick={() => setShowColumnManager(false)}>×</button></div>
            <div className="column-manager-body">
              <DragDropContext onDragEnd={handleColumnDragEnd}>
                <Droppable droppableId="columns">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {columns.map((column, index) => (
                        <Draggable key={column.id} draggableId={column.id} index={index} isDragDisabled={column.fixed}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className="column-item">
                              <div className="column-item-left">
                                {!column.fixed && <div {...provided.dragHandleProps} className="drag-handle"><GripVertical size={16} /></div>}
                                <input type="checkbox" checked={column.visible} onChange={() => handleColumnToggle(column.id)} disabled={column.fixed} />
                                <span>{column.label}</span>
                              </div>
                              {column.fixed && <span className="fixed-badge">Fixed</span>}
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
              <button onClick={resetColumns} className="receipts-page-btn-secondary">Reset to Default</button>
              <button onClick={() => setShowColumnManager(false)} className="receipts-page-btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="receipts-page-stats">
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">TOTAL RECEIPTS</div><div className="receipts-page-stat-value">{stats.totalReceipts || 0}</div></div>
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">TOTAL AMOUNT</div><div className="receipts-page-stat-value">{formatCurrency(stats.totalAmount)}</div></div>
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">APPLIED AMOUNT</div><div className="receipts-page-stat-value receipts-page-stat-success">{formatCurrency(stats.appliedAmount)}</div></div>
          <div className="receipts-page-stat-card"><div className="receipts-page-stat-label">UNAPPLIED AMOUNT</div><div className="receipts-page-stat-value receipts-page-stat-warning">{formatCurrency(stats.unappliedAmount)}</div></div>
        </div>
      )}

      {/* Main Table with draggable headers */}
      <div className="receipts-page-table-container">
        <div className="receipts-page-table-scroll">
          <table className="receipts-page-table">
            <thead>
              <tr>
                {visibleColumns.map((column, index) => (
                  <th
                    key={column.id}
                    draggable={!column.fixed}
                    onDragStart={(e) => handleColDragStart(e, index)}
                    onDragOver={(e) => handleColDragOver(e, index)}
                    onDrop={(e) => handleColDrop(e, index)}
                    onDragEnd={handleColDragEnd}
                    onClick={() => handleSort(column.id)}
                  >
                    {!column.fixed && <GripVertical size={12} style={{ opacity: 0.3, marginRight: 4 }} />}
                    {column.label}
                    {SORTABLE_RECEIPT_COLUMNS.has(column.id) && <SortIcon columnId={column.id} sortConfig={sortConfig} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReceipts.length === 0 ? (
                <tr><td colSpan={visibleColumns.length} className="empty-state">No receipts found</td></tr>
              ) : (
                sortedReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    {visibleColumns.map(column => (
                      <React.Fragment key={column.id}>{renderColumnValue(column, receipt)}</React.Fragment>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="receipts-page-pagination">
          <div className="receipts-page-pagination-info">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements}
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="receipts-page-pagination-size-select">
              <option value="10">10 Rows</option><option value="20">20 Rows</option><option value="50">50 Rows</option><option value="100">100 Rows</option>
            </select>
          </div>
          <div className="receipts-page-pagination-controls-wrapper">
            <div className="receipts-page-pagination-controls">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))} disabled={currentPage === 0} className="receipts-page-pagination-btn">Previous</button>
              <span className="receipts-page-pagination-current">Page {currentPage + 1} of {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))} disabled={currentPage >= totalPages - 1} className="receipts-page-pagination-btn">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ UPDATED: View Receipt Modal — now includes Advance Allocation Details */}
      {showReceiptModal && selectedReceipt && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Receipt Details - {selectedReceipt.receiptNo}</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowReceiptModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipt-view">

                {/* Basic Meta */}
                <div className="receipt-meta">
                  <div className="receipt-meta-item"><strong>Receipt Date:</strong> {formatDate(selectedReceipt.receiptDate)}</div>
                  <div className="receipt-meta-item"><strong>Customer:</strong> {selectedReceipt.customerCompanyName || selectedReceipt.customerName || `#${selectedReceipt.customerId}`}</div>
                  <div className="receipt-meta-item">
                    <strong>Type:</strong>
                    <span className={`receipt-badge ${getReceiptTypeBadgeClass(selectedReceipt.receiptType)}`}>{selectedReceipt.receiptType}</span>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="receipt-details">
                  <div className="receipt-detail-row"><span>Payment Method:</span><strong>{selectedReceipt.paymentMethod}</strong></div>
                  <div className="receipt-detail-row"><span>Transaction Reference:</span><strong>{selectedReceipt.transactionReference || '—'}</strong></div>
                  {selectedReceipt.notes && <div className="receipt-detail-row"><span>Notes:</span><strong>{selectedReceipt.notes}</strong></div>}
                </div>

                {/* Amount Summary */}
                <div className="receipt-amounts">
                  <div className="receipt-amount-row"><span>Total Amount:</span><span className="amount-value">{formatCurrency(selectedReceipt.amount)}</span></div>
                  <div className="receipt-amount-row"><span>Applied Amount:</span><span className="amount-value text-success">{formatCurrency(selectedReceipt.appliedAmount)}</span></div>
                  <div className="receipt-amount-row"><span>Unapplied Amount:</span><span className="amount-value text-warning">{formatCurrency(selectedReceipt.unappliedAmount)}</span></div>
                </div>

                {/* ✅ NEW: Advance Allocation Details Block */}
                {selectedReceipt.receiptType === 'ADVANCE' && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Link2 size={16} color="#059669" />
                      <strong style={{ fontSize: '14px', color: '#064e3b' }}>
                        Advance Adjusted Against Invoices
                      </strong>
                      {parseFloat(selectedReceipt.appliedAmount) > 0 && (
                        <span style={{
                          background: '#d1fae5', color: '#065f46',
                          fontSize: '11px', fontWeight: 700,
                          padding: '2px 8px', borderRadius: '99px'
                        }}>
                          {loadingViewAllocations ? '...' : `${viewAllocationDetails.length} invoice${viewAllocationDetails.length !== 1 ? 's' : ''}`}
                        </span>
                      )}
                    </div>

                    {/* Loading state */}
                    {loadingViewAllocations && (
                      <div style={{
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        borderRadius: '10px', padding: '20px', textAlign: 'center',
                        color: '#059669', fontSize: '13px'
                      }}>
                        Loading allocation details...
                      </div>
                    )}

                    {/* No allocations yet */}
                    {!loadingViewAllocations && parseFloat(selectedReceipt.appliedAmount) === 0 && (
                      <div style={{
                        background: '#f8fafc', border: '1px dashed #cbd5e1',
                        borderRadius: '10px', padding: '18px', textAlign: 'center',
                        color: '#94a3b8', fontSize: '13px'
                      }}>
                        This advance has not been allocated to any invoice yet.
                      </div>
                    )}

                    {/* Allocation blocks */}
                    {!loadingViewAllocations && viewAllocationDetails.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {viewAllocationDetails.map((alloc, idx) => (
                          <div key={alloc.allocationId || idx} style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderLeft: '4px solid #059669',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '10px 16px',
                            alignItems: 'start'
                          }}>
                            {/* Invoice Number */}
                            <div>
                              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{alloc.invoiceNo}</div>
                              <div style={{ marginTop: '4px' }}>
                                <span style={{
                                  fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                                  borderRadius: '99px', background: '#dcfce7', color: '#166534'
                                }}>
                                  {getStatusDisplayName(alloc.invoiceStatus)}
                                </span>
                              </div>
                            </div>

                            {/* Allocated Amount */}
                            <div>
                              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Allocated</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>{formatCurrency(alloc.allocatedAmount)}</div>
                            </div>

                            {/* Invoice Totals */}
                            <div>
                              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice Total</div>
                              <div style={{ fontSize: '13px', color: '#374151' }}>{formatCurrency(alloc.invoiceTotal)}</div>
                              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                                Balance: {formatCurrency(alloc.invoiceBalance)}
                              </div>
                            </div>

                            {/* Allocation Date — full width */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #d1fae5', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280' }}>Allocated on:</span>
                              <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{formatDateTime(alloc.allocationDate)}</span>
                            </div>
                          </div>
                        ))}

                        {/* Total summary row */}
                        <div style={{
                          background: '#ecfdf5', border: '1px solid #6ee7b7',
                          borderRadius: '8px', padding: '10px 16px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 600 }}>
                            Total Allocated across {viewAllocationDetails.length} invoice{viewAllocationDetails.length !== 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#059669' }}>
                            {formatCurrency(viewAllocationDetails.reduce((sum, a) => sum + parseFloat(a.allocatedAmount || 0), 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* For INVOICE_PAYMENT type — show the linked invoice as a rich card */}
                {selectedReceipt.receiptType === 'INVOICE_PAYMENT' && selectedReceipt.invoiceId && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Link2 size={16} color="#3b82f6" />
                      <strong style={{ fontSize: '14px', color: '#1e3a8a' }}>Applied to Invoice</strong>
                      <span style={{
                        background: '#dbeafe', color: '#1e40af',
                        fontSize: '11px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '99px'
                      }}>1 invoice</span>
                    </div>

                    {/* Rich invoice card — same layout as advance allocation blocks */}
                    <div style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderLeft: '4px solid #3b82f6',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '10px 16px',
                      alignItems: 'start'
                    }}>
                      {/* Invoice Number */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                          {viewInvoiceDetails?.invoiceNo || selectedReceipt.invoiceNo || `INV-${selectedReceipt.invoiceId}`}
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                            borderRadius: '99px', background: '#dbeafe', color: '#1e40af'
                          }}>
                            {getStatusDisplayName(viewInvoiceDetails?.status || 'PAID')}
                          </span>
                        </div>
                      </div>

                      {/* Applied Amount */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Applied</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#3b82f6' }}>{formatCurrency(selectedReceipt.amount)}</div>
                      </div>

                      {/* Invoice Totals */}
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice Total</div>
                        <div style={{ fontSize: '13px', color: '#374151' }}>
                          {viewInvoiceDetails ? formatCurrency(viewInvoiceDetails.totalAmount) : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                          Balance: {viewInvoiceDetails ? formatCurrency(viewInvoiceDetails.balanceAmount) : '—'}
                        </div>
                      </div>

                      {/* Payment date — full width */}
                      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #bfdbfe', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Payment recorded on:</span>
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{formatDateTime(selectedReceipt.receiptDate)}</span>
                      </div>
                    </div>

                    {/* Total summary row */}
                    <div style={{
                      background: '#eff6ff', border: '1px solid #93c5fd',
                      borderRadius: '8px', padding: '10px 16px', marginTop: '10px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '13px', color: '#1e3a8a', fontWeight: 600 }}>
                        Total Applied to 1 invoice
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#3b82f6' }}>
                        {formatCurrency(selectedReceipt.amount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => console.log('Download receipt')}><Download size={16} style={{ marginRight: '8px' }} />Download Receipt</button>
              {selectedReceipt.unappliedAmount > 0 && selectedReceipt.receiptType === 'ADVANCE' && (
                <button className="receipts-page-btn-primary" onClick={() => { setShowReceiptModal(false); handleEditReceipt(selectedReceipt); }}>
                  Adjust Advance
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deleted Receipts Section */}
      {showDeletedReceipts && (
        <div className="deleted-receipts-section">
          <div className="deleted-receipts-header"><h3>Deleted Receipts</h3><button className="receipts-page-btn-secondary" onClick={() => setShowDeletedReceipts(false)}>Close</button></div>
          <div className="receipts-page-table-container">
            <table className="receipts-page-table deleted-table">
              <thead><tr><th>Receipt No</th><th>Date</th><th>Customer</th><th>Type</th><th>Amount</th><th>Deleted At</th><th>Actions</th></tr></thead>
              <tbody>
                {deletedReceipts.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No deleted receipts found</td></tr>
                ) : (
                  deletedReceipts.map((receipt) => (
                    <tr key={receipt.id} className="deleted-row">
                      <td className="receipt-no">{receipt.receiptNo}</td>
                      <td>{formatDate(receipt.receiptDate)}</td>
                      <td>{receipt.customerCompanyName || receipt.customerName || `#${receipt.customerId}`}</td>
                      <td><span className={`receipt-badge ${receipt.receiptType === 'ADVANCE' ? 'receipt-type-advance' : 'receipt-type-invoice'}`}>{receipt.receiptType === 'ADVANCE' ? 'Advance' : 'Invoice Payment'}</span></td>
                      <td className="receipt-amount">{formatCurrency(receipt.amount)}</td>
                      <td>{formatDate(receipt.deletedAt)}</td>
                      <td><button className="receipt-action-btn btn-restore" onClick={() => handleRestoreReceipt(receipt.id)} title="Restore Receipt">Restore</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Receipt Modal */}
      {showCreateModal && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-xlarge">
            <div className="receipts-page-modal-header">
              <h2>Record New Receipt</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipts-page-form">
                {/* Excel Import Strip */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileSpreadsheet size={18} color="#16a34a" />
                    <span style={{ fontSize: '14px', color: '#166534', fontWeight: 500 }}>Import receipt data from Excel template</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#16a34a', border: '1px solid #16a34a', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                      <Download size={14} /> Download Template
                    </button>
                    <button onClick={() => { setBulkImportProgress(null); setBulkImportDone(false); setImportPreview([]); setImportErrors([]); setImportFileName(''); setShowImportModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                      <Upload size={14} /> Import Excel
                    </button>
                  </div>
                </div>

                <div className="receipts-page-form-section">
                  <h3>Receipt Type</h3>
                  <div className="receipt-type-selection">
                    <label className="receipt-type-option">
                      <input type="radio" name="receiptType" value="advance" checked={receiptFormData.receiptType === 'advance'} onChange={(e) => { setReceiptFormData({ ...receiptFormData, receiptType: e.target.value }); setInvoicesForCustomer([]); }} />
                      <div className="receipt-type-content"><strong>Record Advance Payment</strong><span>Record advance payment from customer for future invoices</span></div>
                    </label>
                    <label className="receipt-type-option">
                      <input type="radio" name="receiptType" value="invoice" checked={receiptFormData.receiptType === 'invoice'} onChange={(e) => setReceiptFormData({ ...receiptFormData, receiptType: e.target.value })} />
                      <div className="receipt-type-content"><strong>Payment Against Invoice</strong><span>Record payment for a specific invoice</span></div>
                    </label>
                  </div>
                </div>

                <div className="receipts-page-form-section">
                  <h3>Customer Selection</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Group *</label>
                      <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}</option>
                        {modalGroups.map((group, index) => <option key={group.value || index} value={group.value}>{group.label}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Sub Group</label>
                      <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                        <option value="">{modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub Group'}</option>
                        {modalSubGroups.map((sg, index) => <option key={sg.value || index} value={sg.value}>{sg.label}</option>)}
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Project *</label>
                      <select value={modalProjectId} onChange={handleModalProjectChange} disabled={!modalSubGroupName || modalDropdownLoading.projects}>
                        <option value="">{modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}</option>
                        {modalProjects.map((project, index) => <option key={project.id || index} value={project.id}>{project.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {customerData && (
                  <div className="receipts-page-form-section">
                    <h3>Customer Information</h3>
                    <div style={{ padding: '16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '14px' }}>
                      <p><strong>Company:</strong> {customerData.companyName}</p>
                      <p><strong>Contact Person:</strong> {customerData.contactPerson}</p>
                      <p><strong>Email:</strong> {customerData.email}</p>
                      <p><strong>Phone:</strong> {customerData.phone}</p>
                      {customerData.gstNumber && <p><strong>GST:</strong> {customerData.gstNumber}</p>}
                    </div>
                  </div>
                )}

                {receiptFormData.receiptType === 'invoice' && customerData && (
                  <div className="receipts-page-form-section">
                    <h3>Select Invoice</h3>
                    {loadingInvoices ? <div className="loading-state">Loading invoices...</div> : invoicesForCustomer.length > 0 ? (
                      <div className="invoice-selection-list">
                        {invoicesForCustomer.map(invoice => (
                          <label key={invoice.id} className="invoice-selection-item">
                            <input type="radio" name="selectedInvoice" value={invoice.id} checked={receiptFormData.invoiceId === invoice.id} onChange={(e) => setReceiptFormData({ ...receiptFormData, invoiceId: parseInt(e.target.value), amount: invoice.balanceAmount })} />
                            <div className="invoice-selection-content">
                              <div className="invoice-selection-header"><strong>{invoice.invoiceNo}</strong><span className={`Invoices-page-badge ${getStatusClass(invoice.status)}`}>{getStatusDisplayName(invoice.status)}</span></div>
                              <div className="invoice-selection-details">
                                <span>Date: {formatDate(invoice.invoiceDate)}</span>
                                <span>Due: {formatDate(invoice.dueDate)}</span>
                                <span>Total: {formatCurrency(invoice.totalAmount)}</span>
                                <span className="text-danger">Balance: {formatCurrency(invoice.balanceAmount)}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : <div className="empty-state-small">No unpaid invoices found for this customer</div>}
                  </div>
                )}

                <div className="receipts-page-form-section">
                  <h3>Payment Details</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Receipt Date *</label>
                      <input type="date" value={receiptFormData.receiptDate} onChange={(e) => setReceiptFormData({ ...receiptFormData, receiptDate: e.target.value })} />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Amount *</label>
                      <input type="number" value={receiptFormData.amount} onChange={(e) => setReceiptFormData({ ...receiptFormData, amount: parseFloat(e.target.value) })} placeholder="0.00" step="0.01" />
                      {receiptFormData.receiptType === 'invoice' && receiptFormData.invoiceId && (
                        <small style={{ color: '#64748b', marginTop: '4px' }}>Maximum: {formatCurrency(invoicesForCustomer.find(inv => inv.id === receiptFormData.invoiceId)?.balanceAmount || 0)}</small>
                      )}
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Payment Method *</label>
                      <select value={receiptFormData.paymentMethod} onChange={(e) => setReceiptFormData({ ...receiptFormData, paymentMethod: e.target.value })}>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Credit Card">Credit Card</option>
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Transaction Reference</label>
                      <input type="text" value={receiptFormData.transactionReference} onChange={(e) => setReceiptFormData({ ...receiptFormData, transactionReference: e.target.value })} placeholder="Transaction ID, Cheque No, etc." />
                    </div>
                    <div className="receipts-page-form-group receipts-page-form-group-full">
                      <label>Notes</label>
                      <textarea value={receiptFormData.notes} onChange={(e) => setReceiptFormData({ ...receiptFormData, notes: e.target.value })} placeholder="Additional notes..." rows="3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveReceipt}>Record Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Bulk Import Modal for Receipts */}
      {showImportModal && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-xlarge">
            <div className="receipts-page-modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={22} color="#16a34a" />
                Bulk Import Receipts from Excel
              </h2>
              <button className="receipts-page-modal-close" onClick={handleCloseImportModal} disabled={bulkImportProgress && !bulkImportDone}>×</button>
            </div>

            <div className="receipts-page-modal-body">
              {!bulkImportProgress && (
                <>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#16a34a', color: 'white', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>1</div>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#166534', display: 'block' }}>Download Receipt Template</strong>
                          <span style={{ fontSize: '12px', color: '#4b7a5e' }}>Row 4 = headers, data from Row 5 onwards. Do not modify headers.</span>
                        </div>
                      </div>
                      <button onClick={handleDownloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}>
                        <Download size={14} /> Download Template
                      </button>
                    </div>
                  </div>

                  {!receiptFormData.customerId && (
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                      <strong>⚠ Required before importing:</strong> Please close this modal, select a Group → Sub Group → Project first so receipts are linked to the correct customer.
                    </div>
                  )}
                  {receiptFormData.customerId && customerData && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>✓</span>
                      <span>Receipts will be linked to: <strong>{customerData.companyName}</strong></span>
                    </div>
                  )}

                  <div style={{ border: '2px dashed #6ee7b7', borderRadius: '10px', padding: '22px', marginBottom: '16px', textAlign: 'center', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', justifyContent: 'center' }}>
                      <div style={{ background: '#059669', color: 'white', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>2</div>
                      <strong style={{ fontSize: '14px', color: '#065f46' }}>Upload Filled Excel File</strong>
                    </div>
                    <Upload size={32} color="#6ee7b7" style={{ marginBottom: '10px' }} />
                    <p style={{ color: '#64748b', margin: '0 0 14px 0', fontSize: '13px' }}>All rows with valid data will be saved as individual receipts</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
                    <button onClick={() => fileInputRef.current?.click()} style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '6px', padding: '9px 22px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Upload size={15} /> Browse File
                    </button>
                    {importFileName && <p style={{ marginTop: '10px', color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>📎 {importFileName}</p>}
                  </div>

                  {importErrors.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                      <strong style={{ color: '#dc2626', display: 'block', marginBottom: '6px' }}>⚠ Fix these errors in the Excel file before importing:</strong>
                      <ul style={{ margin: 0, paddingLeft: '18px', color: '#b91c1c', fontSize: '12px', lineHeight: '1.7' }}>
                        {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    </div>
                  )}

                  {importPreview.length > 0 && importErrors.length === 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <strong style={{ color: '#166534', fontSize: '14px' }}>✓ {importPreview.length} receipt{importPreview.length !== 1 ? 's' : ''} ready to import</strong>
                        <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '12px' }}>Total: {formatCurrency(importPreview.reduce((s, r) => s + (r.amount || 0), 0))}</span>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ background: '#065f46' }}>
                              {['#', 'Date', 'Amount', 'Type', 'Method', 'Reference', 'Notes'].map(h => (
                                <th key={h} style={{ padding: '9px 11px', textAlign: 'left', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                <td style={{ padding: '7px 11px', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                                <td style={{ padding: '7px 11px', whiteSpace: 'nowrap' }}>{row.receiptDate}</td>
                                <td style={{ padding: '7px 11px', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(row.amount)}</td>
                                <td style={{ padding: '7px 11px' }}><span style={{ background: row.receiptType === 'ADVANCE' ? '#dcfce7' : '#dbeafe', color: row.receiptType === 'ADVANCE' ? '#166534' : '#1e40af', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{row.receiptType === 'ADVANCE' ? 'Advance' : 'Invoice'}</span></td>
                                <td style={{ padding: '7px 11px', whiteSpace: 'nowrap' }}>{row.paymentMethod}</td>
                                <td style={{ padding: '7px 11px', color: '#64748b' }}>{row.transactionReference || '—'}</td>
                                <td style={{ padding: '7px 11px', color: '#64748b', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Progress state */}
              {bulkImportProgress && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14px', color: bulkImportDone ? '#166534' : '#0f172a' }}>
                        {bulkImportDone ? `Import complete — ${bulkImportProgress.results.filter(r => r.status === 'success').length} of ${bulkImportProgress.total} saved` : `Importing... ${bulkImportProgress.current} of ${bulkImportProgress.total}`}
                      </strong>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>{Math.round((bulkImportProgress.current / bulkImportProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(bulkImportProgress.current / bulkImportProgress.total) * 100}%`, background: bulkImportDone ? (bulkImportProgress.results.every(r => r.status === 'success') ? '#16a34a' : '#f59e0b') : '#059669', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>

                  {bulkImportDone && (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{bulkImportProgress.results.filter(r => r.status === 'success').length}</div>
                        <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Successful</div>
                      </div>
                      <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{bulkImportProgress.results.filter(r => r.status === 'error').length}</div>
                        <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>Failed</div>
                      </div>
                      <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(bulkImportProgress.results.filter(r => r.status === 'success').reduce((s, r) => s + (r.amount || 0), 0))}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Saved</div>
                      </div>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#1e293b' }}>
                          {['Row', 'Date', 'Amount', 'Status', 'Message'].map(h => (
                            <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkImportProgress.results.map((result, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: result.status === 'success' ? '#f0fdf4' : '#fef2f2' }}>
                            <td style={{ padding: '7px 12px', color: '#64748b', fontWeight: 600 }}>#{result.row}</td>
                            <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{result.date}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600 }}>{formatCurrency(result.amount)}</td>
                            <td style={{ padding: '7px 12px' }}><span style={{ background: result.status === 'success' ? '#dcfce7' : '#fee2e2', color: result.status === 'success' ? '#166534' : '#dc2626', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>{result.status === 'success' ? '✓ Saved' : '✗ Failed'}</span></td>
                            <td style={{ padding: '7px 12px', color: result.status === 'error' ? '#b91c1c' : '#64748b' }}>{result.message}</td>
                          </tr>
                        ))}
                        {!bulkImportDone && importPreview.slice(bulkImportProgress.results.length).map((row, i) => (
                          <tr key={`pending-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', opacity: 0.45 }}>
                            <td style={{ padding: '7px 12px', color: '#94a3b8', fontWeight: 600 }}>#{bulkImportProgress.results.length + i + 1}</td>
                            <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{row.receiptDate}</td>
                            <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{formatCurrency(row.amount)}</td>
                            <td style={{ padding: '7px 12px' }}><span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>Pending</span></td>
                            <td style={{ padding: '7px 12px', color: '#94a3b8' }}>—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="receipts-page-modal-actions">
              {!bulkImportProgress ? (
                <>
                  <button className="receipts-page-btn-secondary" onClick={handleCloseImportModal}>Cancel</button>
                  <button className="receipts-page-btn-primary" onClick={handleConfirmImport} disabled={importPreview.length === 0 || importErrors.length > 0 || !receiptFormData.customerId} style={{ opacity: (importPreview.length === 0 || importErrors.length > 0 || !receiptFormData.customerId) ? 0.5 : 1 }}>
                    Import All {importPreview.length > 0 ? `${importPreview.length} Receipt${importPreview.length !== 1 ? 's' : ''}` : ''}
                  </button>
                </>
              ) : (
                <button className="receipts-page-btn-primary" onClick={handleCloseImportModal} disabled={!bulkImportDone} style={{ opacity: bulkImportDone ? 1 : 0.5 }}>
                  {bulkImportDone ? 'Close' : 'Please wait...'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Advance Modal */}
      {showAdjustmentModal && selectedReceipt && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Adjust Advance - {selectedReceipt.receiptNo}</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowAdjustmentModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="adjustment-form">
                <div className="adjustment-info">
                  <div className="adjustment-info-card"><div className="adjustment-info-label">Available Advance</div><div className="adjustment-info-value">{formatCurrency(adjustmentData.availableAmount || selectedReceipt.unappliedAmount)}</div></div>
                  <div className="adjustment-info-card"><div className="adjustment-info-label">Total Allocated</div><div className="adjustment-info-value">{formatCurrency(adjustmentData.invoiceAllocations?.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0)}</div></div>
                  <div className="adjustment-info-card"><div className="adjustment-info-label">Remaining</div><div className="adjustment-info-value">{formatCurrency((adjustmentData.availableAmount || selectedReceipt.unappliedAmount) - (adjustmentData.invoiceAllocations?.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0))}</div></div>
                </div>
                <div className="adjustment-section">
                  <h3>Apply to Invoices</h3>
                  <p className="adjustment-hint">
                    Showing unpaid invoices for project <strong>{selectedReceipt.projectId || '—'}</strong>
                    {selectedReceipt.customerCompanyName || selectedReceipt.customerName ? <> · customer <strong>{selectedReceipt.customerCompanyName || selectedReceipt.customerName}</strong></> : null}
                  </p>
                  {loading ? <div className="loading-state">Loading invoices...</div> : invoicesForCustomer.length > 0 ? (
                    <div className="invoice-adjustment-list">
                      {invoicesForCustomer.map(invoice => {
                        const allocation = adjustmentData.invoiceAllocations?.find(a => a.invoiceId === invoice.id);
                        const maxAllocation = Math.min(
                          (adjustmentData.availableAmount || selectedReceipt.unappliedAmount) - (adjustmentData.invoiceAllocations?.filter(a => a.invoiceId !== invoice.id).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0),
                          invoice.balanceAmount
                        );
                        return (
                          <div key={invoice.id} className="invoice-adjustment-item">
                            <div className="invoice-adjustment-info">
                              <div className="invoice-adjustment-header"><strong>{invoice.invoiceNo}</strong><span className={`receipt-badge ${getStatusClass(invoice.status)}`}>{getStatusDisplayName(invoice.status)}</span></div>
                              <div className="invoice-adjustment-details">
                                <span>Date: {formatDate(invoice.invoiceDate)}</span><span>Due: {formatDate(invoice.dueDate)}</span>
                                <span>Total: {formatCurrency(invoice.totalAmount)}</span>
                                <span style={{ color: '#dc2626', fontWeight: 600 }}>Balance: {formatCurrency(invoice.balanceAmount)}</span>
                              </div>
                            </div>
                            <div className="invoice-adjustment-input">
                              <label>Allocate Amount:</label>
                              <input type="number" placeholder="0.00" step="0.01" min="0" value={allocation?.amount || ''} max={maxAllocation} onChange={(e) => handleInvoiceAllocationChange(invoice.id, e.target.value)} />
                              <small>Max: {formatCurrency(maxAllocation)}</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="empty-state-small">No outstanding invoices found for project {selectedReceipt.projectId || '—'}</div>}
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => setShowAdjustmentModal(false)}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveAdjustment} disabled={!adjustmentData.invoiceAllocations || adjustmentData.invoiceAllocations.length === 0}>Save Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {showEditReceiptModal && editingReceipt && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Edit Receipt - {editingReceipt.receiptNo}</h2>
              <button className="receipts-page-modal-close" onClick={() => { setShowEditReceiptModal(false); setShowChangeProjectPanel(false); }}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipts-page-form">

                {/* ── Project Assignment — ADVANCE only, locked for INVOICE_PAYMENT ── */}
                {editingReceipt.receiptType === 'ADVANCE' ? (
                <div className="receipts-page-form-section" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    Project Assignment
                    {(editReceiptGroupName !== (editingReceipt.groupId || '') || editReceiptSubGroupName !== (editingReceipt.subGroupId || '') || editReceiptProjectId !== (editingReceipt.projectId || '')) && (
                      <span style={{ marginLeft: '10px', background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: 700 }}>⚠ Changed — will save on Update</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Group *</label>
                      <select value={editReceiptGroupName}
                        onChange={handleEditReceiptGroupChange}
                        disabled={editReceiptProjectLoading.groups}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white' }}>
                        <option value="">{editReceiptProjectLoading.groups ? 'Loading groups...' : 'Select Group'}</option>
                        {editReceiptProjectGroups.map((g, i) => <option key={g.value || i} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Sub Group</label>
                      <select value={editReceiptSubGroupName}
                        onChange={handleEditReceiptSubGroupChange}
                        disabled={!editReceiptGroupName || editReceiptProjectLoading.subs}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px', background: !editReceiptGroupName ? '#f9fafb' : 'white' }}>
                        <option value="">{editReceiptProjectLoading.subs ? 'Loading...' : !editReceiptGroupName ? 'Select Group first' : 'Select Sub Group'}</option>
                        {editReceiptProjectSubs.map((s, i) => <option key={s.value || i} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Project *</label>
                      <select value={editReceiptProjectId}
                        onChange={handleEditReceiptProjectChange}
                        disabled={!editReceiptSubGroupName || editReceiptProjectLoading.projects}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px', background: !editReceiptSubGroupName ? '#f9fafb' : 'white' }}>
                        <option value="">{editReceiptProjectLoading.projects ? 'Loading...' : !editReceiptSubGroupName ? 'Select Sub Group first' : 'Select Project'}</option>
                        {editReceiptProjectList.map((p, i) => <option key={p.id || i} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {editReceiptProjectId && editReceiptProjectId !== (editingReceipt.projectId || '') && (
                    <div style={{ marginTop: '10px' }}>
                      <button className="receipts-page-btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={handleApplyEditReceiptProject}>
                        Apply Project Change
                      </button>
                    </div>
                  )}
                  {(editReceiptGroupName !== (editingReceipt.groupId || '') || editReceiptSubGroupName !== (editingReceipt.subGroupId || '') || editReceiptProjectId !== (editingReceipt.projectId || '')) && parseFloat(editingReceipt.appliedAmount) > 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                      ⚠ This advance has <strong>{formatCurrency(editingReceipt.appliedAmount)}</strong> already allocated to invoices.
                      Changing the project will <strong>automatically reverse those allocations</strong> so the advance starts fresh under the new project.
                    </div>
                  )}
                  {editReceiptGroupName === (editingReceipt.groupId || '') && editReceiptProjectId === (editingReceipt.projectId || '') && parseFloat(editingReceipt.appliedAmount) > 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                      ⚠ {formatCurrency(editingReceipt.appliedAmount)} already allocated. Cannot reduce amount below this.
                    </div>
                  )}
                </div>
                ) : (
                <div className="receipts-page-form-section" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Project Assignment</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                    {editingReceipt.groupId || '—'}
                    {editingReceipt.subGroupId ? ` › ${editingReceipt.subGroupId}` : ''}
                    {editingReceipt.projectId ? ` › ${editingReceipt.projectId}` : ''}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>Project cannot be changed for Invoice Payments.</div>
                </div>
                )}

                <div className="receipts-page-form-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Receipt Type:</h3>
                    <span className={`receipt-badge ${editingReceipt.receiptType === 'ADVANCE' ? 'receipt-type-advance' : 'receipt-type-invoice'}`}>{editingReceipt.receiptType === 'ADVANCE' ? 'Advance Payment' : 'Invoice Payment'}</span>
                  </div>
                  {editingReceipt.receiptType === 'INVOICE_PAYMENT' && editingReceipt.invoiceNo && (
                    <div style={{ padding: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '14px' }}>
                      <strong>Applied to Invoice:</strong> {editingReceipt.invoiceNo}
                    </div>
                  )}

                </div>

                <div className="receipts-page-form-section">
                  <h3>Payment Details</h3>
                  <div className="receipts-page-form-grid">
                    <div className="receipts-page-form-group">
                      <label>Receipt Date *</label>
                      <input type="date" value={editReceiptFormData.receiptDate} onChange={(e) => setEditReceiptFormData({ ...editReceiptFormData, receiptDate: e.target.value })} />
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Amount *</label>
                      <input type="number" value={editReceiptFormData.amount} onChange={(e) => setEditReceiptFormData({ ...editReceiptFormData, amount: parseFloat(e.target.value) })} placeholder="0.00" step="0.01" min={editingReceipt.appliedAmount || 0} />
                      {editingReceipt.appliedAmount > 0 && <small style={{ color: '#92400e' }}>Minimum: {formatCurrency(editingReceipt.appliedAmount)} (already allocated)</small>}
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Payment Method *</label>
                      <select value={editReceiptFormData.paymentMethod} onChange={(e) => setEditReceiptFormData({ ...editReceiptFormData, paymentMethod: e.target.value })}>
                        <option value="Bank Transfer">Bank Transfer</option><option value="UPI">UPI</option><option value="Cash">Cash</option><option value="Cheque">Cheque</option><option value="Credit Card">Credit Card</option>
                      </select>
                    </div>
                    <div className="receipts-page-form-group">
                      <label>Transaction Reference</label>
                      <input type="text" value={editReceiptFormData.transactionReference} onChange={(e) => setEditReceiptFormData({ ...editReceiptFormData, transactionReference: e.target.value })} placeholder="Transaction ID, Cheque No, etc." />
                    </div>
                    <div className="receipts-page-form-group receipts-page-form-group-full">
                      <label>Notes</label>
                      <textarea value={editReceiptFormData.notes} onChange={(e) => setEditReceiptFormData({ ...editReceiptFormData, notes: e.target.value })} placeholder="Additional notes..." rows="3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => { setShowEditReceiptModal(false); setShowChangeProjectPanel(false); }}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveEditedReceipt}>Update Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Allocation Modal */}
      {showEditAllocationModal && editingAllocation && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-xlarge">
            <div className="receipts-page-modal-header">
              <h2>Edit Allocations - {editingAllocation.receiptNo}</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowEditAllocationModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="edit-allocation-container">
                <div className="allocation-summary-card">
                  <h3>Receipt Summary</h3>
                  <div className="summary-grid">
                    <div className="summary-item"><label>Total Amount:</label><span className="amount-highlight">{formatCurrency(editingAllocation.amount)}</span></div>
                    <div className="summary-item"><label>Applied Amount:</label><span>{formatCurrency(editingAllocation.appliedAmount)}</span></div>
                    <div className="summary-item"><label>Unapplied Amount:</label><span className="text-success">{formatCurrency(editingAllocation.unappliedAmount)}</span></div>
                  </div>
                </div>
                <div className="current-allocations-section">
                  <h3>Current Allocations</h3>
                  {allocationDetails.length === 0 ? <div className="empty-state-small">No allocations found</div> : (
                    <div className="allocations-list">
                      {allocationDetails.map((allocation, index) => (
                        <div key={index} className="allocation-card">
                          <div className="allocation-header">
                            <div><strong>{allocation.invoiceNo}</strong><span className={`receipt-badge ${getStatusClass(allocation.invoiceStatus)}`}>{getStatusDisplayName(allocation.invoiceStatus)}</span></div>
                            <div className="allocation-actions">
                              <button className="btn-edit-small" onClick={() => setSelectedAllocationToEdit({ oldInvoiceId: allocation.invoiceId, oldInvoiceNo: allocation.invoiceNo, oldAmount: allocation.allocatedAmount, newInvoiceId: null, newAmount: allocation.allocatedAmount })} title="Edit this allocation"><Edit2 size={14} />Edit</button>
                              <button className="btn-remove-small" onClick={() => handleRemoveAllocation(allocation.invoiceId)} title="Remove this allocation"><Trash2 size={14} />Remove</button>
                            </div>
                          </div>
                          <div className="allocation-details-grid">
                            <div><label>Allocated Amount:</label><span className="amount-value">{formatCurrency(allocation.allocatedAmount)}</span></div>
                            <div><label>Invoice Total:</label><span>{formatCurrency(allocation.invoiceTotal)}</span></div>
                            <div><label>Invoice Balance:</label><span className="text-danger">{formatCurrency(allocation.invoiceBalance)}</span></div>
                            <div><label>Allocated On:</label><span>{formatDate(allocation.allocationDate)}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedAllocationToEdit && (
                  <div className="edit-allocation-form">
                    <h3>Move Allocation</h3>
                    <div className="allocation-move-info">
                      <div className="move-from"><label>From Invoice:</label><div className="invoice-display"><strong>{selectedAllocationToEdit.oldInvoiceNo}</strong><span>{formatCurrency(selectedAllocationToEdit.oldAmount)}</span></div></div>
                      <div className="move-arrow">→</div>
                      <div className="move-to">
                        <label>To Invoice:</label>
                        <select value={selectedAllocationToEdit.newInvoiceId || ''} onChange={(e) => setSelectedAllocationToEdit({ ...selectedAllocationToEdit, newInvoiceId: e.target.value ? parseInt(e.target.value) : null })} className="invoice-select">
                          <option value="">Select Invoice</option>
                          {invoicesForCustomer.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo} - Balance: {formatCurrency(invoice.balanceAmount)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="amount-input-section">
                      <label>New Allocation Amount:</label>
                      <input type="number" value={selectedAllocationToEdit.newAmount || ''} onChange={(e) => setSelectedAllocationToEdit({ ...selectedAllocationToEdit, newAmount: parseFloat(e.target.value) })} placeholder="0.00" step="0.01" min="0" />
                    </div>
                    <div className="edit-allocation-actions">
                      <button className="receipts-page-btn-secondary" onClick={() => setSelectedAllocationToEdit(null)}>Cancel</button>
                      <button className="receipts-page-btn-primary" onClick={handleSaveEditedAllocation}>Save Changes</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => { setShowEditAllocationModal(false); setSelectedAllocationToEdit(null); setAllocationDetails([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptsManagementPage;