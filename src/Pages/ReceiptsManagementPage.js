import React, { useState, useEffect, useRef } from 'react';
import { Eye, Edit2, Trash2, Download, DollarSign, Settings, GripVertical, RefreshCw, Upload, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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
import { FaIndianRupeeSign } from "react-icons/fa6";

const API_BASE_URL = process.env.REACT_APP_API_URL;

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
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

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

  // Excel import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [bulkImportProgress, setBulkImportProgress] = useState(null); // { current, total, results }
  const [bulkImportDone, setBulkImportDone] = useState(false);
  const fileInputRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [editReceiptFormData, setEditReceiptFormData] = useState({ receiptDate: '', amount: 0, paymentMethod: 'Bank Transfer', transactionReference: '', notes: '', company: 'ISTL' });

  // Modal states
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [stats, setStats] = useState(null);

  // Dropdown states
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  const [customerData, setCustomerData] = useState(null);
  const [invoicesForCustomer, setInvoicesForCustomer] = useState([]);
  const [availableAdvances, setAvailableAdvances] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  const [receiptFormData, setReceiptFormData] = useState({
    customerId: null, projectId: '', groupId: '', subGroupId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    receiptType: 'advance', amount: 0, paymentMethod: 'Bank Transfer',
    transactionReference: '', notes: '', invoiceId: null, company: 'ISTL'
  });

  const [adjustmentData, setAdjustmentData] = useState({ receiptId: null, customerId: null, availableAmount: 0, invoiceAllocations: [] });

  useEffect(() => { localStorage.setItem('receiptColumns', JSON.stringify(columns)); }, [columns]);
  useEffect(() => { fetchReceipts(); }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.receiptType, filters.search]);
  useEffect(() => { fetchStats(); }, [groupName, subGroupName, projectId]);

  // ---------- Sorting ----------
  const sortedReceipts = React.useMemo(() => {
    if (!sortConfig.key) return receipts;
    return [...receipts].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'receiptNo': aVal = a.receiptNo || ''; bVal = b.receiptNo || ''; break;
        case 'receiptDate': aVal = new Date(a.receiptDate || 0); bVal = new Date(b.receiptDate || 0); break;
        case 'customer': aVal = a.customerName || ''; bVal = b.customerName || ''; break;
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const headerRowIdx = data.findIndex(row =>
          row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('receipt date') || cell.toLowerCase().includes('amount')))
        );
        if (headerRowIdx === -1) { showError('Invalid template format. Please use the provided template.'); return; }
        const rows = data.slice(headerRowIdx + 1).filter(row => row[0] && String(row[0]).trim());
        const errors = [];
        const parsed = rows.map((row, i) => {
          const rowNum = headerRowIdx + 2 + i;
          const receiptDate = String(row[0] || '').trim();
          const amount = parseFloat(row[1]);
          const receiptType = String(row[2] || 'ADVANCE').trim().toUpperCase().replace(' ', '_');
          const paymentMethod = String(row[3] || 'Bank Transfer').trim();
          const transactionReference = String(row[4] || '').trim();
          const invoiceNo = String(row[5] || '').trim();
          const company = String(row[6] || 'ISTL').trim();
          const notes = String(row[7] || '').trim();
          if (!receiptDate) errors.push(`Row ${rowNum}: Receipt date is required`);
          if (isNaN(amount) || amount <= 0) errors.push(`Row ${rowNum}: Invalid amount "${row[1]}"`);
          if (!VALID_RECEIPT_TYPES.has(receiptType)) errors.push(`Row ${rowNum}: Invalid type "${row[2]}" (use ADVANCE or INVOICE_PAYMENT)`);
          if (!VALID_PAYMENT_METHODS.has(paymentMethod)) errors.push(`Row ${rowNum}: Invalid payment method "${row[3]}"`);
          return { receiptDate, amount: isNaN(amount) ? 0 : amount, receiptType: VALID_RECEIPT_TYPES.has(receiptType) ? receiptType : 'ADVANCE', paymentMethod: VALID_PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : 'Bank Transfer', transactionReference, invoiceNo, company: company || 'ISTL', notes };
        });
        setImportErrors(errors);
        setImportPreview(parsed);
      } catch (err) { showError('Failed to read file. Please use a valid Excel file.'); }
    };
    reader.readAsBinaryString(file);
  };

  // Bulk import: submits all rows to the API sequentially with progress tracking
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
          receiptType: row.receiptType, // already 'ADVANCE' or 'INVOICE_PAYMENT'
          amount: parseFloat(row.amount),
          paymentMethod: row.paymentMethod,
          transactionReference: row.transactionReference || '',
          notes: row.notes || '',
          invoiceId: null,
          company: row.company || receiptFormData.company || 'ISTL'
        };
        const response = await fetch(`${API_BASE_URL}/api/invoices/receipts`, {
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
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

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
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${receiptId}/allocations`, { credentials: "include", headers: getAuthHeaders() });
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
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${editingAllocation.id}/allocations/edit`, {
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

  const handleRemoveAllocation = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to remove this allocation?')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${editingAllocation.id}/allocations/${invoiceId}`, { credentials: "include", method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to remove allocation'); }
      showSuccess('Allocation removed successfully!');
      const updatedAllocations = await fetchAllocationDetails(editingAllocation.id);
      setAllocationDetails(updatedAllocations); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to remove allocation'); }
    finally { setLoading(false); }
  };

  const handleEditReceiptClick = async (receipt) => {
    setEditingReceipt(receipt);
    setEditReceiptFormData({ receiptDate: receipt.receiptDate, amount: receipt.amount, paymentMethod: receipt.paymentMethod || 'Bank Transfer', transactionReference: receipt.transactionReference || '', notes: receipt.notes || '', company: receipt.company || 'ISTL' });
    if (receipt.receiptType === 'INVOICE_PAYMENT' && receipt.invoiceId) await fetchInvoicesForCustomer(receipt.customerId, receipt.projectId);
    setShowEditReceiptModal(true);
  };

  const handleSaveEditedReceipt = async () => {
    if (editReceiptFormData.amount <= 0) { showError('Amount must be greater than zero'); return; }
    setLoading(true);
    try {
      const receiptData = { ...editReceiptFormData, receiptType: editingReceipt.receiptType, invoiceId: editingReceipt.invoiceId, customerId: editingReceipt.customerId, projectId: editingReceipt.projectId, groupId: editingReceipt.groupId, subGroupId: editingReceipt.subGroupId };
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${editingReceipt.id}`, { credentials: "include", method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(receiptData) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to update receipt'); }
      showSuccess('Receipt updated successfully!'); setShowEditReceiptModal(false); setEditingReceipt(null); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to update receipt'); }
    finally { setLoading(false); }
  };

  const handleDeleteReceiptClick = (receipt) => { setReceiptToDelete(receipt); setShowDeleteConfirmModal(true); };
  const handleConfirmDelete = async () => {
    if (!receiptToDelete) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${receiptToDelete.id}`, { credentials: "include", method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to delete receipt'); }
      showSuccess('Receipt deleted successfully!'); setShowDeleteConfirmModal(false); setReceiptToDelete(null); fetchReceipts(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to delete receipt'); }
    finally { setLoading(false); }
  };

  const fetchDeletedReceipts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/deleted`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch deleted receipts');
      setDeletedReceipts(await response.json());
    } catch (error) { showError('Failed to load deleted receipts'); setDeletedReceipts([]); }
    finally { setLoading(false); }
  };

  const handleRestoreReceipt = async (receiptId) => {
    if (!window.confirm('Are you sure you want to restore this receipt?')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${receiptId}/restore`, { credentials: "include", method: 'POST', headers: getAuthHeaders() });
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
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts?${params}`, { credentials: "include", headers: getAuthHeaders() });
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
      if (user?.id) params.append("createdBy", user.id);
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/summary?${params.toString()}`, { method: "GET", credentials: "include", headers: getAuthHeaders() });
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
      const response = await fetch(`${API_BASE_URL}/api/invoices/customer-by-project/${pid}`, { credentials: "include", headers: getAuthHeaders() });
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
      const endpoint = customerId ? `${API_BASE_URL}/api/invoices/customer/${customerId}/unpaid-invoices` : `${API_BASE_URL}/api/invoices/project/${projectId}/unpaid-invoices`;
      const response = await fetch(endpoint, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json(); setInvoicesForCustomer(data);
      if (data.length === 0) showError('No unpaid invoices found for this customer/project');
    } catch { showError('Failed to load invoices for this customer'); setInvoicesForCustomer([]); }
    finally { setLoadingInvoices(false); }
  };

  const fetchAvailableAdvances = async (customerId) => {
    if (!customerId) { setAvailableAdvances([]); return; }
    setLoadingAdvances(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/customer/${customerId}/unapplied-advances-details`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch advances');
      setAvailableAdvances(await response.json());
    } catch { setAvailableAdvances([]); }
    finally { setLoadingAdvances(false); }
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
    setReceiptFormData({ customerId: null, projectId: '', groupId: '', subGroupId: '', receiptDate: new Date().toISOString().split('T')[0], receiptType: 'advance', amount: 0, paymentMethod: 'Bank Transfer', transactionReference: '', notes: '', invoiceId: null, company: 'ISTL' });
    setCustomerData(null); setModalGroupName(''); setModalSubGroupName(''); setModalProjectId(''); setEditMode(false); setInvoicesForCustomer([]);
    fetchModalGroups(); setShowCreateModal(true);
  };

  const handleViewReceipt = (receipt) => { setSelectedReceipt(receipt); setShowReceiptModal(true); };

  const handleEditReceipt = async (receipt) => {
    setSelectedReceipt(receipt); setLoading(true);
    try {
      const ep = receipt.customerId ? `${API_BASE_URL}/api/invoices/customer/${receipt.customerId}/unpaid-invoices` : `${API_BASE_URL}/api/invoices/project/${receipt.projectId}/unpaid-invoices`;
      const res = await fetch(ep, { credentials: "include", headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); setInvoicesForCustomer(d); if (d.length === 0) showError('No unpaid invoices found for this customer'); }
      else { setInvoicesForCustomer([]); showError('Failed to load invoices for this customer'); }
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
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts`, { credentials: "include", method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(receiptData) });
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
      const response = await fetch(`${API_BASE_URL}/api/invoices/receipts/${adjustmentData.receiptId}/allocate-advance`, { credentials: "include", method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ allocations }) });
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
  const getReceiptTypeBadgeClass = (type) => ({ 'Advance': 'receipt-type-advance', 'Invoice': 'receipt-type-invoice', 'Other': 'receipt-type-other' }[type] || '');

  const renderColumnValue = (column, receipt) => {
    switch (column.id) {
      case 'receiptNo': return <td className="receipt-no">{receipt.receiptNo}</td>;
      case 'receiptDate': return <td>{formatDate(receipt.receiptDate)}</td>;
      case 'customer': return <td>{receipt.customerName}</td>;
      case 'receiptType': return <td><span className={`receipt-badge ${getReceiptTypeBadgeClass(receipt.receiptType)}`}>{receipt.receiptType}</span></td>;
      case 'amount': return <td className="receipt-amount">{formatCurrency(receipt.amount)}</td>;
      case 'appliedAmount': return <td className="text-success">{formatCurrency(receipt.appliedAmount)}</td>;
      case 'unappliedAmount': return <td className="text-warning">{formatCurrency(receipt.unappliedAmount)}</td>;
      case 'paymentMethod': return <td>{receipt.paymentMethod}</td>;
      case 'reference': return <td>{receipt.transactionReference || '—'}</td>;
      case 'actions': return (
        <td>
          <div className="receipt-action-buttons">
            <button className="receipt-action-btn btn-view" onClick={() => handleViewReceipt(receipt)} title="View"><Eye size={16} /></button>
            <button className="receipt-action-btn btn-edit" onClick={() => handleEditReceiptClick(receipt)} title="Edit Receipt"><Edit2 size={16} /></button>
            {receipt.receiptType === 'ADVANCE' && receipt.appliedAmount > 0 && (
              <button className="receipt-action-btn btn-edit-allocation" onClick={() => handleEditAllocationClick(receipt)} title="Edit Allocation"><RefreshCw size={16} /></button>
            )}
            {receipt.unappliedAmount > 0 && receipt.receiptType === 'ADVANCE' && (
              <button className="receipt-action-btn btn-adjust" onClick={() => handleEditReceipt(receipt)} title="Adjust Advance"><DollarSign size={16} /></button>
            )}
            <button className="receipt-action-btn btn-download" onClick={() => console.log('Download receipt', receipt.id)} title="Download"><Download size={16} /></button>
            <button className="receipt-action-btn btn-delete" onClick={() => handleDeleteReceiptClick(receipt)} title="Delete"><Trash2 size={16} /></button>
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
          <button className="receipts-page-btn-primary" onClick={handleCreateNew}>+ Record New Receipt</button>
        </div>
      </div>

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
                  style={{
                    cursor: SORTABLE_RECEIPT_COLUMNS.has(column.id) ? 'pointer' : (column.fixed ? 'default' : 'grab'),
                    userSelect: 'none',
                    background: dragOverColIndex === index ? '#d1fae5' : undefined,
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap'
                  }}
                  title={SORTABLE_RECEIPT_COLUMNS.has(column.id) ? `Sort by ${column.label}` : (column.fixed ? '' : 'Drag to reorder')}
                >
                  {!column.fixed && (
                    <GripVertical size={12} style={{ opacity: 0.3, marginRight: 4, verticalAlign: 'middle', display: 'inline-block' }} />
                  )}
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
                  {visibleColumns.map(column => <React.Fragment key={column.id}>{renderColumnValue(column, receipt)}</React.Fragment>)}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="receipts-page-pagination">
          <div className="receipts-page-pagination-info">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} receipts
          </div>
          <div className="receipts-page-pagination-controls-wrapper">
            <div className="receipts-page-pagination-size">
              <label>Rows per page:</label>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="receipts-page-pagination-size-select">
                <option value="5">5</option><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option>
              </select>
            </div>
            <div className="receipts-page-pagination-controls">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))} disabled={currentPage === 0} className="receipts-page-pagination-btn">Previous</button>
              <span className="receipts-page-pagination-current">Page {currentPage + 1} of {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))} disabled={currentPage >= totalPages - 1} className="receipts-page-pagination-btn">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* View Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-large">
            <div className="receipts-page-modal-header">
              <h2>Receipt Details - {selectedReceipt.receiptNo}</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowReceiptModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipt-view">
                <div className="receipt-meta">
                  <div className="receipt-meta-item"><strong>Receipt Date:</strong> {formatDate(selectedReceipt.receiptDate)}</div>
                  <div className="receipt-meta-item"><strong>Customer:</strong> {selectedReceipt.customerName}</div>
                  <div className="receipt-meta-item"><strong>Type:</strong><span className={`receipt-badge ${getReceiptTypeBadgeClass(selectedReceipt.receiptType)}`}>{selectedReceipt.receiptType}</span></div>
                </div>
                <div className="receipt-details">
                  <div className="receipt-detail-row"><span>Payment Method:</span><strong>{selectedReceipt.paymentMethod}</strong></div>
                  <div className="receipt-detail-row"><span>Transaction Reference:</span><strong>{selectedReceipt.transactionReference || '—'}</strong></div>
                  {selectedReceipt.notes && <div className="receipt-detail-row"><span>Notes:</span><strong>{selectedReceipt.notes}</strong></div>}
                </div>
                <div className="receipt-amounts">
                  <div className="receipt-amount-row"><span>Total Amount:</span><span className="amount-value">{formatCurrency(selectedReceipt.amount)}</span></div>
                  <div className="receipt-amount-row"><span>Applied Amount:</span><span className="amount-value text-success">{formatCurrency(selectedReceipt.appliedAmount)}</span></div>
                  <div className="receipt-amount-row"><span>Unapplied Amount:</span><span className="amount-value text-warning">{formatCurrency(selectedReceipt.unappliedAmount)}</span></div>
                </div>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => console.log('Download receipt')}><Download size={16} style={{ marginRight: '8px' }} />Download Receipt</button>
              {selectedReceipt.unappliedAmount > 0 && <button className="receipts-page-btn-primary" onClick={() => { setShowReceiptModal(false); handleEditReceipt(selectedReceipt); }}>Adjust Advance</button>}
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
                      <td>{receipt.customerId}</td>
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
                    <div className="receipts-page-form-group">
                      <label>Company *</label>
                      <select value={receiptFormData.company || 'ISTL'} onChange={(e) => setReceiptFormData({ ...receiptFormData, company: e.target.value })}>
                        <option value="ISTL">ISTL</option>
                        <option value="SESOLA">SESOLA</option>
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

              {/* Step 1: Template */}
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

                  {/* Step 2: Customer selection warning */}
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

                  {/* Step 3: Upload */}
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
                    {importFileName && (
                      <p style={{ marginTop: '10px', color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>📎 {importFileName}</p>
                    )}
                  </div>

                  {/* Validation errors */}
                  {importErrors.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                      <strong style={{ color: '#dc2626', display: 'block', marginBottom: '6px' }}>⚠ Fix these errors in the Excel file before importing:</strong>
                      <ul style={{ margin: 0, paddingLeft: '18px', color: '#b91c1c', fontSize: '12px', lineHeight: '1.7' }}>
                        {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Preview table */}
                  {importPreview.length > 0 && importErrors.length === 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <strong style={{ color: '#166534', fontSize: '14px' }}>
                          ✓ {importPreview.length} receipt{importPreview.length !== 1 ? 's' : ''} ready to import
                        </strong>
                        <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '12px' }}>
                          Total: {formatCurrency(importPreview.reduce((s, r) => s + (r.amount || 0), 0))}
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ background: '#065f46' }}>
                              {['#', 'Date', 'Amount', 'Type', 'Method', 'Reference', 'Company', 'Notes'].map(h => (
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
                                <td style={{ padding: '7px 11px' }}>
                                  <span style={{ background: row.receiptType === 'ADVANCE' ? '#dcfce7' : '#dbeafe', color: row.receiptType === 'ADVANCE' ? '#166534' : '#1e40af', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                                    {row.receiptType === 'ADVANCE' ? 'Advance' : 'Invoice'}
                                  </span>
                                </td>
                                <td style={{ padding: '7px 11px', whiteSpace: 'nowrap' }}>{row.paymentMethod}</td>
                                <td style={{ padding: '7px 11px', color: '#64748b' }}>{row.transactionReference || '—'}</td>
                                <td style={{ padding: '7px 11px' }}>{row.company || 'ISTL'}</td>
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
                  {/* Progress bar */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14px', color: bulkImportDone ? '#166534' : '#0f172a' }}>
                        {bulkImportDone
                          ? `Import complete — ${bulkImportProgress.results.filter(r => r.status === 'success').length} of ${bulkImportProgress.total} saved`
                          : `Importing... ${bulkImportProgress.current} of ${bulkImportProgress.total}`}
                      </strong>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        {Math.round((bulkImportProgress.current / bulkImportProgress.total) * 100)}%
                      </span>
                    </div>
                    <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(bulkImportProgress.current / bulkImportProgress.total) * 100}%`,
                        background: bulkImportDone
                          ? (bulkImportProgress.results.every(r => r.status === 'success') ? '#16a34a' : '#f59e0b')
                          : '#059669',
                        borderRadius: '99px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Summary badges when done */}
                  {bulkImportDone && (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>
                          {bulkImportProgress.results.filter(r => r.status === 'success').length}
                        </div>
                        <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Successful</div>
                      </div>
                      <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                          {bulkImportProgress.results.filter(r => r.status === 'error').length}
                        </div>
                        <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>Failed</div>
                      </div>
                      <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                          {formatCurrency(bulkImportProgress.results.filter(r => r.status === 'success').reduce((s, r) => s + (r.amount || 0), 0))}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Saved</div>
                      </div>
                    </div>
                  )}

                  {/* Per-row results table */}
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
                        {/* Completed rows */}
                        {bulkImportProgress.results.map((result, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: result.status === 'success' ? '#f0fdf4' : '#fef2f2' }}>
                            <td style={{ padding: '7px 12px', color: '#64748b', fontWeight: 600 }}>#{result.row}</td>
                            <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{result.date}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600 }}>{formatCurrency(result.amount)}</td>
                            <td style={{ padding: '7px 12px' }}>
                              <span style={{
                                background: result.status === 'success' ? '#dcfce7' : '#fee2e2',
                                color: result.status === 'success' ? '#166534' : '#dc2626',
                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700
                              }}>
                                {result.status === 'success' ? '✓ Saved' : '✗ Failed'}
                              </span>
                            </td>
                            <td style={{ padding: '7px 12px', color: result.status === 'error' ? '#b91c1c' : '#64748b' }}>{result.message}</td>
                          </tr>
                        ))}
                        {/* Pending rows (not yet processed) */}
                        {!bulkImportDone && importPreview.slice(bulkImportProgress.results.length).map((row, i) => (
                          <tr key={`pending-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', opacity: 0.45 }}>
                            <td style={{ padding: '7px 12px', color: '#94a3b8', fontWeight: 600 }}>#{bulkImportProgress.results.length + i + 1}</td>
                            <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{row.receiptDate}</td>
                            <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{formatCurrency(row.amount)}</td>
                            <td style={{ padding: '7px 12px' }}>
                              <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>Pending</span>
                            </td>
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
                  <button
                    className="receipts-page-btn-primary"
                    onClick={handleConfirmImport}
                    disabled={importPreview.length === 0 || importErrors.length > 0 || !receiptFormData.customerId}
                    style={{ opacity: (importPreview.length === 0 || importErrors.length > 0 || !receiptFormData.customerId) ? 0.5 : 1 }}
                  >
                    Import All {importPreview.length > 0 ? `${importPreview.length} Receipt${importPreview.length !== 1 ? 's' : ''}` : ''}
                  </button>
                </>
              ) : (
                <button
                  className="receipts-page-btn-primary"
                  onClick={handleCloseImportModal}
                  disabled={!bulkImportDone}
                  style={{ opacity: bulkImportDone ? 1 : 0.5 }}
                >
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
                  <p className="adjustment-hint">Select invoices and enter amounts to allocate this advance payment</p>
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
                  ) : <div className="empty-state-small">No outstanding invoices found for this customer</div>}
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
              <button className="receipts-page-modal-close" onClick={() => setShowEditReceiptModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="receipts-page-form">
                <div className="receipts-page-form-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>Receipt Type:</h3>
                    <span className={`receipt-badge ${editingReceipt.receiptType === 'ADVANCE' ? 'receipt-type-advance' : 'receipt-type-invoice'}`}>{editingReceipt.receiptType === 'ADVANCE' ? 'Advance Payment' : 'Invoice Payment'}</span>
                  </div>
                  {editingReceipt.receiptType === 'INVOICE_PAYMENT' && editingReceipt.invoiceNo && (
                    <div style={{ padding: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '14px' }}>
                      <strong>Applied to Invoice:</strong> {editingReceipt.invoiceNo}
                    </div>
                  )}
                  {editingReceipt.receiptType === 'ADVANCE' && editingReceipt.appliedAmount > 0 && (
                    <div style={{ padding: '12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '13px' }}>
                      <strong>Warning:</strong> This advance has {formatCurrency(editingReceipt.appliedAmount)} already allocated. Reducing the amount below this will fail.
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
                      <label>Company *</label>
                      <select value={editReceiptFormData.company} onChange={(e) => setEditReceiptFormData({ ...editReceiptFormData, company: e.target.value })}>
                        <option value="ISTL">ISTL</option><option value="SESOLA">SESOLA</option>
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
              <button className="receipts-page-btn-secondary" onClick={() => setShowEditReceiptModal(false)}>Cancel</button>
              <button className="receipts-page-btn-primary" onClick={handleSaveEditedReceipt}>Update Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && receiptToDelete && (
        <div className="receipts-page-modal-overlay">
          <div className="receipts-page-modal receipts-page-modal-small">
            <div className="receipts-page-modal-header">
              <h2>Delete Receipt</h2>
              <button className="receipts-page-modal-close" onClick={() => setShowDeleteConfirmModal(false)}>×</button>
            </div>
            <div className="receipts-page-modal-body">
              <div className="delete-confirmation-content">
                <div className="warning-icon"><Trash2 size={48} color="#dc2626" /></div>
                <h3>Are you sure you want to delete this receipt?</h3>
                <div className="receipt-delete-info">
                  <div className="info-row"><strong>Receipt No:</strong><span>{receiptToDelete.receiptNo}</span></div>
                  <div className="info-row"><strong>Date:</strong><span>{formatDate(receiptToDelete.receiptDate)}</span></div>
                  <div className="info-row"><strong>Amount:</strong><span className="amount-highlight">{formatCurrency(receiptToDelete.amount)}</span></div>
                  <div className="info-row"><strong>Type:</strong><span className={`receipt-badge ${receiptToDelete.receiptType === 'ADVANCE' ? 'receipt-type-advance' : 'receipt-type-invoice'}`}>{receiptToDelete.receiptType === 'ADVANCE' ? 'Advance' : 'Invoice Payment'}</span></div>
                </div>
                {receiptToDelete.receiptType === 'ADVANCE' && receiptToDelete.appliedAmount > 0 && (
                  <div className="delete-warning"><strong>⚠️ Warning:</strong><p>This advance has {formatCurrency(receiptToDelete.appliedAmount)} allocated to invoices. Deleting will reverse all allocations.</p></div>
                )}
                <p className="delete-note"><em>Note: This is a soft delete. The receipt can be restored later if needed.</em></p>
              </div>
            </div>
            <div className="receipts-page-modal-actions">
              <button className="receipts-page-btn-secondary" onClick={() => setShowDeleteConfirmModal(false)}>Cancel</button>
              <button className="receipts-page-btn-danger" onClick={handleConfirmDelete}><Trash2 size={16} style={{ marginRight: '8px' }} />Delete Receipt</button>
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