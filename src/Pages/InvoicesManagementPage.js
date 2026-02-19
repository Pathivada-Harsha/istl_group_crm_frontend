import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Edit2, Trash2, Download, Send, Settings, GripVertical, Upload, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import * as XLSX from 'xlsx';
import '../pages-css/Invoices.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import filterApi from '../services/filterApi';
import UnitTypeDropdown from './../components/Dropdowns/Unittypedropdown.js';
import { normalizeUnit } from './../components/Dropdowns/unitUtils';
import { FaIndianRupeeSign } from "react-icons/fa6";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const ALL_COLUMNS = [
  { id: 'invoiceNo', label: 'Invoice ID', visible: true },
  { id: 'customer', label: 'Customer', visible: true },
  { id: 'totalAmount', label: 'Total Amount', visible: true },
  { id: 'paidAmount', label: 'Paid Amount', visible: true },
  { id: 'balance', label: 'Balance', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'invoiceDate', label: 'Invoice Date', visible: true },
  { id: 'dueDate', label: 'Due Date', visible: true },
  { id: 'actions', label: 'Actions', visible: true, fixed: true }
];

// ---------- Sortable column header ----------
const SortIcon = ({ columnId, sortConfig }) => {
  if (sortConfig.key !== columnId) return <ChevronsUpDown size={13} style={{ opacity: 0.4, marginLeft: 4, verticalAlign: 'middle' }} />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp size={13} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#3b82f6' }} />
    : <ChevronDown size={13} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#3b82f6' }} />;
};

// Columns that are sortable
const SORTABLE_COLUMNS = new Set(['invoiceNo', 'customer', 'totalAmount', 'paidAmount', 'balance', 'status', 'invoiceDate', 'dueDate']);

const InvoicesManagementPage = () => {
  const [invoices, setInvoices] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: 'all', paymentStatus: 'all' });

  // Column management
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('invoiceColumns');
    return saved ? JSON.parse(saved) : ALL_COLUMNS;
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Table column drag
  const [draggedColIndex, setDraggedColIndex] = useState(null);
  const [dragOverColIndex, setDragOverColIndex] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [stats, setStats] = useState(null);

  // Excel import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef(null);

  // Dropdown states
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState({});
  const [showDropdown, setShowDropdown] = useState({});

  const [customerData, setCustomerData] = useState(null);

  const [formData, setFormData] = useState({
    customerId: null, projectId: '', groupId: '', subGroupId: '',
    invoiceDate: new Date().toISOString().split('T')[0], dueDate: '',
    items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }],
    status: 'DRAFT', company: 'ISTL'
  });

  useEffect(() => { localStorage.setItem('invoiceColumns', JSON.stringify(columns)); }, [columns]);

  // ---------- Sorting logic (client-side on current page) ----------
  const sortedInvoices = React.useMemo(() => {
    if (!sortConfig.key) return invoices;
    const sorted = [...invoices].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'invoiceNo': aVal = a.invoiceNo || ''; bVal = b.invoiceNo || ''; break;
        case 'customer': aVal = a.customerName || ''; bVal = b.customerName || ''; break;
        case 'totalAmount': aVal = parseFloat(a.totalAmount) || 0; bVal = parseFloat(b.totalAmount) || 0; break;
        case 'paidAmount': aVal = parseFloat(a.paidAmount) || 0; bVal = parseFloat(b.paidAmount) || 0; break;
        case 'balance': aVal = parseFloat(a.balanceAmount) || 0; bVal = parseFloat(b.balanceAmount) || 0; break;
        case 'status': aVal = a.status || ''; bVal = b.status || ''; break;
        case 'invoiceDate': aVal = new Date(a.invoiceDate || 0); bVal = new Date(b.invoiceDate || 0); break;
        case 'dueDate': aVal = new Date(a.dueDate || 0); bVal = new Date(b.dueDate || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [invoices, sortConfig]);

  const handleSort = (columnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return;
    setSortConfig(prev => ({
      key: columnId,
      direction: prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ---------- Table column drag & drop ----------
  const handleColDragStart = (e, index) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleColDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColIndex(index);
  };
  const handleColDrop = (e, index) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === index) {
      setDraggedColIndex(null); setDragOverColIndex(null); return;
    }
    const visibleCols = columns.filter(c => c.visible);
    const newVisible = [...visibleCols];
    const [moved] = newVisible.splice(draggedColIndex, 1);
    newVisible.splice(index, 0, moved);
    // Rebuild full columns preserving hidden ones
    const hiddenCols = columns.filter(c => !c.visible);
    const newColumns = [...newVisible, ...hiddenCols];
    setColumns(newColumns);
    setDraggedColIndex(null);
    setDragOverColIndex(null);
  };
  const handleColDragEnd = () => { setDraggedColIndex(null); setDragOverColIndex(null); };

  // ---------- Excel Import ----------
  const VALID_TAX = new Set([0, 5, 12, 18, 28]);
  const VALID_UNITS = new Set(['nos', 'kg', 'mt', 'lt', 'sqft', 'sqmt', 'rmt', 'set', 'lot', 'lumpsum', '']);

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

        // Find header row (row index 3 = 4th row, 0-indexed)
        const headerRowIdx = data.findIndex(row =>
          row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('description'))
        );
        if (headerRowIdx === -1) { showError('Invalid template. Please use the provided template.'); return; }

        const rows = data.slice(headerRowIdx + 1).filter(row => row[0] && String(row[0]).trim());
        const errors = [];
        const parsed = rows.map((row, i) => {
          const rowNum = headerRowIdx + 2 + i;
          const desc = String(row[0] || '').trim();
          const qty = parseFloat(row[1]);
          const unitPrice = parseFloat(row[2]);
          const taxPct = row[3] === '' || row[3] === undefined ? 18 : parseFloat(row[3]);
          const unitType = normalizeUnit(String(row[4] || '').trim().toLowerCase());

          if (!desc) errors.push(`Row ${rowNum}: Description is required`);
          if (isNaN(qty) || qty <= 0) errors.push(`Row ${rowNum}: Invalid quantity "${row[1]}"`);
          if (isNaN(unitPrice) || unitPrice < 0) errors.push(`Row ${rowNum}: Invalid unit price "${row[2]}"`);
          if (!VALID_TAX.has(taxPct)) errors.push(`Row ${rowNum}: Invalid tax % "${row[3]}" (use 0,5,12,18,28)`);

          return { description: desc, quantity: isNaN(qty) ? '' : qty, unitPrice: isNaN(unitPrice) ? '' : unitPrice, taxPercent: VALID_TAX.has(taxPct) ? taxPct : 18, unitType: unitType || '', orderBookItemId: row[5] || undefined };
        });

        setImportErrors(errors);
        setImportPreview(parsed);
      } catch (err) {
        showError('Failed to read file. Please use a valid Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    if (importErrors.length > 0) { showError('Please fix errors before importing'); return; }
    if (importPreview.length === 0) { showError('No valid rows to import'); return; }
    setFormData(prev => ({ ...prev, items: importPreview }));
    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    setImportFileName('');
    showSuccess(`Imported ${importPreview.length} items successfully`);
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/invoice_items_template.xlsx';
    link.download = 'invoice_items_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------- Existing logic (unchanged) ----------
  const fetchOrderBookItemsForCustomer = async (customerId) => {
    if (!customerId) { setOrderBookItems([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/order-book-items-by-customer/${customerId}`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch order book items');
      const data = await response.json();
      setOrderBookItems(data.data || []);
    } catch (error) { console.error('Failed to fetch order book items:', error); setOrderBookItems([]); }
  };

  useEffect(() => { fetchInvoices(); }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search]);
  useEffect(() => { fetchStats(); }, [groupName, subGroupName, projectId]);

  const handleDownloadPdf = async (invoice) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}/download-pdf`, { credentials: "include", headers: getAuthHeaders() });
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
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
      showSuccess('Invoice PDF downloaded successfully!');
    } catch (error) { console.error('Failed to download PDF:', error); showError('Failed to download PDF'); }
    finally { setLoading(false); }
  };

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'invoiceDate', sortDirection: 'DESC' });
      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('searchTerm', filters.search);
      const response = await fetch(`${API_BASE_URL}/api/invoices?${params}`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      setInvoices(data.invoices || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (error) { console.error('Failed to fetch invoices:', error); showError('Failed to load invoices'); setInvoices([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const handleClickOutside = (event) => { if (!event.target.closest('.Invoices-page-form-group')) setShowDropdown({}); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append("groupId", groupName);
      if (subGroupName) params.append("subGroupId", subGroupName);
      if (projectId) params.append("projectId", projectId);
      if (user?.id) params.append("createdBy", user.id);
      const response = await fetch(`${API_BASE_URL}/api/invoices/summary?${params.toString()}`, { method: "GET", credentials: "include", headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setStats(data); }
      else setStats({ totalCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0 });
    } catch (error) { console.error("Failed to fetch stats:", error); setStats({ totalCount: 0, paidCount: 0, pendingCount: 0, totalAmount: 0 }); }
  };

  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try { const groups = await filterApi.getAllGroups(); setModalGroups(groups || []); }
    catch (error) { showError('Failed to load groups'); setModalGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try { const subGroups = await filterApi.getSubGroups(groupName); setModalSubGroups(subGroups || []); }
    catch (error) { showError('Failed to load categories'); setModalSubGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try { const projects = await filterApi.getProjects(groupName, subGroupName); setModalProjects(projects || []); }
    catch (error) { showError('Failed to load projects'); setModalProjects([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const fetchCustomerByProject = async (projectId) => {
    if (!projectId) { setCustomerData(null); setOrderBookItems([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/customer-by-project/${projectId}`, { credentials: "include", headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
        setFormData(prev => ({ ...prev, customerId: data.customerId }));
        fetchOrderBookItemsForCustomer(data.customerId);
      } else { setCustomerData(null); setOrderBookItems([]); showError('Customer not found for this project'); }
    } catch (error) { console.error('Failed to fetch customer:', error); setCustomerData(null); setOrderBookItems([]); }
  };

  const handleDescriptionChange = (index, value) => {
    updateItem(index, 'description', value);
    if (!value || value.length < 2) { setFilteredItems(prev => ({ ...prev, [index]: [] })); setShowDropdown(prev => ({ ...prev, [index]: false })); return; }
    const searchLower = value.toLowerCase();
    const filtered = orderBookItems.filter(item => item.itemName?.toLowerCase().includes(searchLower) || item.specification?.toLowerCase().includes(searchLower)).slice(0, 10);
    setFilteredItems(prev => ({ ...prev, [index]: filtered }));
    setShowDropdown(prev => ({ ...prev, [index]: filtered.length > 0 }));
  };

  const selectOrderBookItem = (index, item) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], description: item.itemName, quantity: item.quantity || 1, unitPrice: item.unitPrice || 0, taxPercent: item.taxPercent || 18, unitType: normalizeUnit(item.unit), orderBookItemId: item.id };
    setFormData({ ...formData, items: newItems });
    setShowDropdown(prev => ({ ...prev, [index]: false }));
    setFilteredItems(prev => ({ ...prev, [index]: [] }));
  };

  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName); setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]); setCustomerData(null);
    setFormData({ ...formData, groupId: newGroupName, subGroupId: '', projectId: '', customerId: null });
    if (newGroupName) fetchModalSubGroups(newGroupName);
  };

  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName); setModalProjectId(''); setModalProjects([]); setCustomerData(null);
    setFormData({ ...formData, subGroupId: newSubGroupName, projectId: '', customerId: null });
    if (modalGroupName && newSubGroupName) fetchModalProjects(modalGroupName, newSubGroupName);
  };

  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setFormData({ ...formData, projectId: newProjectId });
    if (newProjectId) fetchCustomerByProject(newProjectId);
  };

  const handleViewInvoice = async (invoice) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}`, { credentials: "include", headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch invoice details');
      const data = await response.json();
      setSelectedInvoice(data);
      const historyResponse = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}/payment-history`, { credentials: "include", headers: getAuthHeaders() });
      if (historyResponse.ok) { const historyData = await historyResponse.json(); setPaymentHistory(historyData); }
      setShowInvoiceModal(true);
    } catch (error) { console.error('Failed to fetch invoice details:', error); showError('Failed to load invoice details'); }
    finally { setLoading(false); }
  };

  const handleCreateNew = () => {
    setFormData({ customerId: null, projectId: '', groupId: '', subGroupId: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }], status: 'DRAFT', company: 'ISTL' });
    setCustomerData(null); setModalGroupName(''); setModalSubGroupName(''); setModalProjectId(''); setEditMode(false);
    fetchModalGroups(); setShowCreateModal(true);
  };

  const handleEditInvoice = (invoice) => {
    setFormData({ customerId: invoice.customerId, projectId: invoice.projectId, groupId: invoice.groupId, subGroupId: invoice.subGroupId, invoiceDate: invoice.invoiceDate.split('T')[0], dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '', items: invoice.items || [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }], status: invoice.status, company: invoice.company || 'ISTL' });
    setSelectedInvoice(invoice); setEditMode(true); setShowCreateModal(true);
  };

  const addItem = () => setFormData({ ...formData, items: [...formData.items, { description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }] });
  const updateItem = (index, field, value) => { const newItems = [...formData.items]; newItems[index][field] = value; setFormData({ ...formData, items: newItems }); };
  const removeItem = (index) => { if (formData.items.length > 1) setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) }); };

  const calculateInvoice = () => {
    let subtotal = 0, taxTotal = 0;
    formData.items.forEach(item => { const lineTotal = item.quantity * item.unitPrice; const lineTax = (lineTotal * item.taxPercent) / 100; subtotal += lineTotal; taxTotal += lineTax; });
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  };

  const handleSaveInvoice = async (status) => {
    if (!formData.customerId) { showError('Please select a project to auto-fill customer details'); return; }
    if (!formData.dueDate) { showError('Due date is required'); return; }
    if (formData.items.length === 0 || !formData.items[0].description) { showError('Please add at least one item'); return; }
    setLoading(true);
    try {
      const invoiceData = { ...formData, status, items: formData.items.map(item => ({ description: item.description, quantity: parseFloat(item.quantity), unitPrice: parseFloat(item.unitPrice), taxPercent: parseFloat(item.taxPercent), unitType: item.unitType })) };
      const url = editMode ? `${API_BASE_URL}/api/invoices/${selectedInvoice.id}` : `${API_BASE_URL}/api/invoices`;
      const response = await fetch(url, { credentials: "include", method: editMode ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(invoiceData) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to save invoice'); }
      showSuccess(`Invoice ${editMode ? 'updated' : 'created'} successfully!`);
      setShowCreateModal(false); fetchInvoices(); fetchStats();
    } catch (error) { console.error('Failed to save invoice:', error); showError(error.message || 'Failed to save invoice'); }
    finally { setLoading(false); }
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/${id}`, { credentials: "include", method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to delete invoice');
      showSuccess('Invoice deleted successfully!'); fetchInvoices(); fetchStats();
    } catch (error) { console.error('Failed to delete invoice:', error); showError('Failed to delete invoice'); }
    finally { setLoading(false); }
  };

  const handleColumnToggle = (columnId) => setColumns(columns.map(col => col.id === columnId ? { ...col, visible: !col.visible } : col));
  const handleColumnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(columns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColumns(items);
  };
  const resetColumns = () => { setColumns(ALL_COLUMNS); localStorage.removeItem('invoiceColumns'); };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const formatDate = (dateStr) => { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const getStatusClass = (status) => ({ 'DRAFT': 'Invoices-page-status-draft', 'SENT': 'Invoices-page-status-sent', 'PAID': 'Invoices-page-status-paid', 'PARTIALLY_PAID': 'Invoices-page-payment-partial', 'CANCELLED': 'Invoices-page-status-cancelled' }[status] || '');
  const getStatusDisplayName = (status) => ({ 'DRAFT': 'Draft', 'SENT': 'Sent', 'PAID': 'Paid', 'PARTIALLY_PAID': 'Partially Paid', 'CANCELLED': 'Cancelled' }[status] || status);

  const renderColumnValue = (column, invoice) => {
    switch (column.id) {
      case 'invoiceNo': return <td className="Invoices-page-invoice-id">{invoice.invoiceNo}</td>;
      case 'customer': return <td>{invoice.customerName}</td>;
      case 'totalAmount': return <td className="Invoices-page-total">{formatCurrency(invoice.totalAmount)}</td>;
      case 'paidAmount': return <td>{formatCurrency(invoice.paidAmount)}</td>;
      case 'balance': return <td className="Invoices-page-total">{formatCurrency(invoice.balanceAmount)}</td>;
      case 'status': return <td><span className={`Invoices-page-badge ${getStatusClass(invoice.status)}`}>{getStatusDisplayName(invoice.status)}</span></td>;
      case 'invoiceDate': return <td>{formatDate(invoice.invoiceDate)}</td>;
      case 'dueDate': return <td>{formatDate(invoice.dueDate)}</td>;
      case 'actions': return (
        <td>
          <div className="Invoices-page-action-buttons">
            <button className="Invoices-page-action-btn Invoices-page-btn-view" onClick={() => handleViewInvoice(invoice)} title="View"><Eye size={16} /></button>
            <button className="Invoices-page-action-btn Invoices-page-btn-edit" onClick={() => handleEditInvoice(invoice)} title="Edit"><Edit2 size={16} /></button>
            <button className="Invoices-page-action-btn Invoices-page-btn-download" onClick={() => handleDownloadPdf(invoice)} title="Download PDF"><Download size={16} /></button>
            <button className="Invoices-page-action-btn Invoices-page-btn-delete" onClick={() => handleDeleteInvoice(invoice.id)} title="Delete"><Trash2 size={16} /></button>
          </div>
        </td>
      );
      default: return <td>—</td>;
    }
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="Invoices-page-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="Invoices-page-breadcrumb">
        <span>Pages</span>
        <span className="Invoices-page-separator">{'>'}</span>
        <span className="Invoices-page-current">Invoices</span>
      </div>

      <div className="page-header-with-filter">
        <h1 className="Invoices-page-title">Invoices ({totalElements})</h1>
        <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
      </div>

      <div className="Invoices-page-action-bar">
        <div className="Invoices-page-search-filters">
          <input type="text" className="Invoices-page-search" placeholder="Search invoices by ID..." value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(0); }} />
          <select className="Invoices-page-filter" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="Invoices-page-actions">
          <button className="Invoices-page-btn-secondary" onClick={() => setShowColumnManager(!showColumnManager)} title="Manage Columns"><Settings size={16} style={{ marginRight: '8px' }} />Columns</button>
          <button className="Invoices-page-btn-primary" onClick={handleCreateNew}>+ Create New Invoice</button>
        </div>
      </div>

      {/* Column Manager Modal */}
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
              <button onClick={resetColumns} className="Invoices-page-btn-secondary">Reset to Default</button>
              <button onClick={() => setShowColumnManager(false)} className="Invoices-page-btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="Invoices-page-stats">
          <div className="Invoices-page-stat-card"><div className="Invoices-page-stat-label">TOTAL INVOICES</div><div className="Invoices-page-stat-value">{stats.totalCount || 0}</div></div>
          <div className="Invoices-page-stat-card"><div className="Invoices-page-stat-label">PAID</div><div className="Invoices-page-stat-value Invoices-page-stat-success">{stats.paidCount || 0}</div></div>
          <div className="Invoices-page-stat-card"><div className="Invoices-page-stat-label">PENDING</div><div className="Invoices-page-stat-value Invoices-page-stat-warning">{stats.pendingCount || 0}</div></div>
          <div className="Invoices-page-stat-card"><div className="Invoices-page-stat-label">TOTAL AMOUNT</div><div className="Invoices-page-stat-value">{formatCurrency(stats.totalAmount)}</div></div>
        </div>
      )}

      {/* Main Table with draggable column headers */}
      <div className="Invoices-page-table-container">
        <table className="Invoices-page-table">
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
                    cursor: SORTABLE_COLUMNS.has(column.id) ? 'pointer' : (column.fixed ? 'default' : 'grab'),
                    userSelect: 'none',
                    background: dragOverColIndex === index ? '#dbeafe' : undefined,
                    transition: 'background 0.15s',
                    whiteSpace: 'nowrap'
                  }}
                  title={SORTABLE_COLUMNS.has(column.id) ? `Sort by ${column.label}` : (column.fixed ? '' : 'Drag to reorder')}
                >
                  {!column.fixed && (
                    <GripVertical size={12} style={{ opacity: 0.3, marginRight: 4, verticalAlign: 'middle', display: 'inline-block' }} />
                  )}
                  {column.label}
                  {SORTABLE_COLUMNS.has(column.id) && <SortIcon columnId={column.id} sortConfig={sortConfig} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} className="empty-state">No invoices found</td></tr>
            ) : (
              sortedInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  {visibleColumns.map(column => (
                    <React.Fragment key={column.id}>{renderColumnValue(column, invoice)}</React.Fragment>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="Invoices-page-pagination">
          <div className="Invoices-page-pagination-info">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} invoices
          </div>
          <div className="Invoices-page-pagination-controls-wrapper">
            <div className="Invoices-page-pagination-size">
              <label>Rows per page:</label>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="Invoices-page-pagination-size-select">
                <option value="5">5</option><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option>
              </select>
            </div>
            <div className="Invoices-page-pagination-controls">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))} disabled={currentPage === 0} className="Invoices-page-pagination-btn">Previous</button>
              <span className="Invoices-page-pagination-current">Page {currentPage + 1} of {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))} disabled={currentPage >= totalPages - 1} className="Invoices-page-pagination-btn">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* View Invoice Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="Invoices-page-modal Invoices-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>Invoice Details - {selectedInvoice.invoiceNo}</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowInvoiceModal(false)}>×</button>
            </div>
            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-invoice-view">
                <div className="Invoices-page-invoice-meta">
                  <div className="Invoices-page-invoice-meta-item"><strong>Invoice Date:</strong> {formatDate(selectedInvoice.invoiceDate)}</div>
                  <div className="Invoices-page-invoice-meta-item"><strong>Due Date:</strong> {formatDate(selectedInvoice.dueDate)}</div>
                  <div className="Invoices-page-invoice-meta-item"><strong>Status:</strong><span className={`Invoices-page-badge ${getStatusClass(selectedInvoice.status)}`}>{getStatusDisplayName(selectedInvoice.status)}</span></div>
                </div>
                <div className="Invoices-page-invoice-section">
                  <h3>Invoice Items</h3>
                  <table className="Invoices-page-invoice-items-table">
                    <thead><tr><th>Description</th><th>Unit Type</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Total</th></tr></thead>
                    <tbody>
                      {selectedInvoice.items && selectedInvoice.items.map((item, index) => {
                        const lineTotal = item.quantity * item.unitPrice;
                        const lineTax = (lineTotal * item.taxPercent) / 100;
                        return <tr key={index}><td>{item.description}</td><td>{item.unitType}</td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice)}</td><td>{item.taxPercent}%</td><td>{formatCurrency(lineTotal + lineTax)}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                {paymentHistory && paymentHistory.length > 0 && (
                  <div className="Invoices-page-invoice-section">
                    <h3>Payment History</h3>
                    <table className="Invoices-page-invoice-items-table">
                      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Notes</th></tr></thead>
                      <tbody>{paymentHistory.map((payment, index) => <tr key={index}><td>{formatDate(payment.paymentDate)}</td><td className="Invoices-page-text-success">{formatCurrency(payment.amount)}</td><td>{payment.paymentMethod}</td><td>{payment.transactionReference || '—'}</td><td>{payment.notes || '—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                <div className="Invoices-page-invoice-totals">
                  <div className="Invoices-page-total-row"><span>Total Amount:</span><span>{formatCurrency(selectedInvoice.totalAmount)}</span></div>
                  <div className="Invoices-page-total-row"><span>Paid Amount:</span><span className="Invoices-page-text-success">{formatCurrency(selectedInvoice.paidAmount)}</span></div>
                  <div className="Invoices-page-total-row Invoices-page-grand-total"><span>Balance Due:</span><span className="Invoices-page-text-danger">{formatCurrency(selectedInvoice.balanceAmount)}</span></div>
                </div>
              </div>
            </div>
            <div className="Invoices-page-modal-actions">
              <button className="Invoices-page-btn-secondary" onClick={() => handleDownloadPdf(selectedInvoice)}><Download size={16} style={{ marginRight: '8px' }} />Download PDF</button>
              <button className="Invoices-page-btn-secondary" onClick={() => handleEditInvoice(selectedInvoice)}>Edit Invoice</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Invoice Modal */}
      {showCreateModal && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowCreateModal(false)}>
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
                      <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}</option>
                        {modalGroups.map((group, index) => <option key={group.value || index} value={group.value}>{group.label}</option>)}
                      </select>
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Sub Group</label>
                      <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                        <option value="">{modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub Group'}</option>
                        {modalSubGroups.map((subGroup, index) => <option key={subGroup.value || index} value={subGroup.value}>{subGroup.label}</option>)}
                      </select>
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Project *</label>
                      <select value={modalProjectId} onChange={handleModalProjectChange} disabled={!modalSubGroupName || modalDropdownLoading.projects}>
                        <option value="">{modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}</option>
                        {modalProjects.map((project, index) => <option key={project.id || index} value={project.id}>{project.name}</option>)}
                      </select>
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Company *</label>
                      <select value={formData.company || 'ISTL'} onChange={(e) => setFormData({ ...formData, company: e.target.value })}>
                        <option value="ISTL">ISTL</option>
                        <option value="SESOLA">SESOLA</option>
                      </select>
                    </div>
                  </div>
                </div>

                {customerData && (
                  <div className="Invoices-page-form-section">
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

                <div className="Invoices-page-form-section">
                  <h3>Invoice Details</h3>
                  <div className="Invoices-page-form-grid">
                    <div className="Invoices-page-form-group">
                      <label>Invoice Date *</label>
                      <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })} />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Due Date *</label>
                      <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} min={formData.invoiceDate} />
                    </div>
                  </div>
                </div>

                <div className="Invoices-page-form-section">
                  <div className="Invoices-page-section-header">
                    <h3>Invoice Items *</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Excel Import Button */}
                      <button
                        type="button"
                        className="Invoices-page-btn-secondary"
                        onClick={handleDownloadTemplate}
                        title="Download Excel Template"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
                      >
                        <FileSpreadsheet size={15} />
                        Download Template
                      </button>
                      <button
                        type="button"
                        className="Invoices-page-btn-secondary"
                        onClick={() => { setShowImportModal(true); setImportPreview([]); setImportErrors([]); setImportFileName(''); }}
                        title="Import from Excel"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
                      >
                        <Upload size={15} />
                        Import Excel
                      </button>
                      <button className="Invoices-page-btn-add" onClick={addItem}>+ Add Item</button>
                    </div>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="Invoices-page-item-row">
                      <div className="Invoices-page-item-fields">
                        <div className="Invoices-page-form-group" style={{ flex: '2', position: 'relative' }}>
                          <label>Description *</label>
                          <input type="text" value={item.description} onChange={(e) => handleDescriptionChange(index, e.target.value)} onFocus={() => { if (item.description && item.description.length >= 2) handleDescriptionChange(index, item.description); }} placeholder="Start typing item name..." />
                          {showDropdown[index] && filteredItems[index]?.length > 0 && (
                            <div className="invoice-item-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto', zIndex: 1000, marginTop: '2px' }}>
                              {filteredItems[index].map((obItem) => (
                                <div key={obItem.id} onClick={() => selectOrderBookItem(index, obItem)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>{obItem.itemName}</div>
                                  {obItem.specification && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>{obItem.specification}</div>}
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Order: {obItem.orderBookNo} | Qty: {obItem.quantity} {obItem.unit} | Price: ₹{parseFloat(obItem.unitPrice).toFixed(2)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Unit Type</label>
                          <UnitTypeDropdown value={item.unitType} onChange={(e) => updateItem(index, 'unitType', e.target.value)} />
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Qty *</label>
                          <input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))} />
                        </div>
                        <div className="Invoices-page-form-group">
                          <label>Unit Price *</label>
                          <input type="number" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))} />
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Tax %</label>
                          <select value={item.taxPercent} onChange={(e) => updateItem(index, 'taxPercent', parseFloat(e.target.value))}>
                            <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                          </select>
                        </div>
                        <div className="Invoices-page-form-group">
                          <label>Line Total</label>
                          <div className="Invoices-page-item-total">{formatCurrency(item.quantity * item.unitPrice * (1 + item.taxPercent / 100))}</div>
                        </div>
                      </div>
                      {formData.items.length > 1 && <button className="Invoices-page-btn-remove" onClick={() => removeItem(index)} title="Remove item">×</button>}
                    </div>
                  ))}

                  <div className="Invoices-page-calculation-summary">
                    <div className="Invoices-page-calc-row"><span>Subtotal:</span><span>{formatCurrency(calculateInvoice().subtotal)}</span></div>
                    <div className="Invoices-page-calc-row"><span>Tax Total:</span><span>{formatCurrency(calculateInvoice().taxTotal)}</span></div>
                    <div className="Invoices-page-calc-row Invoices-page-calc-grand"><span>Grand Total:</span><span>{formatCurrency(calculateInvoice().grandTotal)}</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="Invoices-page-modal-actions">
              <button className="Invoices-page-btn-secondary" onClick={() => handleSaveInvoice('DRAFT')}>Save as Draft</button>
              <button className="Invoices-page-btn-primary" onClick={() => handleSaveInvoice('SENT')}>{editMode ? 'Update Invoice' : 'Create & Send Invoice'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="Invoices-page-modal Invoices-page-modal-xlarge" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={22} color="#16a34a" />
                Import Invoice Items from Excel
              </h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="Invoices-page-modal-body">
              {/* Step 1: Download Template */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ background: '#16a34a', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>1</div>
                  <strong style={{ fontSize: '15px', color: '#166534' }}>Download the Excel Template</strong>
                </div>
                <p style={{ margin: '0 0 12px 40px', color: '#374151', fontSize: '14px' }}>Use the template to enter your invoice items. Fill from Row 5 onwards. Row 4 is the header — do not modify it.</p>
                <button onClick={handleDownloadTemplate} style={{ marginLeft: '40px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                  <Download size={16} /> Download Template
                </button>
              </div>

              {/* Step 2: Upload */}
              <div style={{ border: '2px dashed #93c5fd', borderRadius: '10px', padding: '24px', marginBottom: '20px', textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', justifyContent: 'center' }}>
                  <div style={{ background: '#1e40af', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>2</div>
                  <strong style={{ fontSize: '15px', color: '#1e3a8a' }}>Upload Filled Excel File</strong>
                </div>
                <Upload size={36} color="#93c5fd" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#64748b', margin: '0 0 16px 0', fontSize: '14px' }}>Click to browse or drag & drop your filled Excel file (.xlsx)</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1e40af', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={16} /> Browse File
                </button>
                {importFileName && <p style={{ marginTop: '10px', color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>📎 {importFileName}</p>}
              </div>

              {/* Errors */}
              {importErrors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                  <strong style={{ color: '#dc2626', display: 'block', marginBottom: '8px' }}>⚠ Please fix these errors before importing:</strong>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#b91c1c', fontSize: '13px' }}>
                    {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Preview */}
              {importPreview.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <strong style={{ color: '#166534', fontSize: '15px' }}>✓ Preview — {importPreview.length} items ready to import</strong>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          {['#', 'Description', 'Qty', 'Unit Price', 'Tax %', 'Unit Type'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{i + 1}</td>
                            <td style={{ padding: '8px 12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</td>
                            <td style={{ padding: '8px 12px' }}>{row.quantity}</td>
                            <td style={{ padding: '8px 12px' }}>{formatCurrency(row.unitPrice)}</td>
                            <td style={{ padding: '8px 12px' }}>{row.taxPercent}%</td>
                            <td style={{ padding: '8px 12px' }}>{row.unitType || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="Invoices-page-modal-actions">
              <button className="Invoices-page-btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button
                className="Invoices-page-btn-primary"
                onClick={handleConfirmImport}
                disabled={importPreview.length === 0 || importErrors.length > 0}
                style={{ opacity: (importPreview.length === 0 || importErrors.length > 0) ? 0.5 : 1 }}
              >
                Import {importPreview.length > 0 ? `${importPreview.length} Items` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesManagementPage;