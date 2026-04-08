// Old Invoices page
import React, { useState, useEffect } from 'react';
import { Eye, Edit2, Trash2, DollarSign, Download, Send } from 'lucide-react';
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

const InvoicesManagementPage = () => {
  const [invoices, setInvoices] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    paymentStatus: 'all'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState({});
  const [showDropdown, setShowDropdown] = useState({});
  
  // Customer data
  const [customerData, setCustomerData] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    customerId: null,
    projectId: '',
    groupId: '',
    subGroupId: '',
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
  useEffect(() => {
    fetchInvoices();
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search]);

  // Fetch stats when filters change
  useEffect(() => {
    fetchStats();
  }, [groupName, subGroupName, projectId]);

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
    'X-User-Role': user?.role || localStorage.getItem('userRole')
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
        sortDirection: 'DESC'
      });

      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('searchTerm', filters.search);

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

    // Only apply createdBy filter for non-admin users.
    // Admins should see company-wide KPI numbers, not just their own invoices.
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
    if (user?.id && !isAdmin) params.append("createdBy", user.id);

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
      setStats({
        totalCount: 0,
        paidCount: 0,
        pendingCount: 0,
        totalAmount: 0,
      });
    }
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    setStats({
      totalCount: 0,
      paidCount: 0,
      pendingCount: 0,
      totalAmount: 0,
    });
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
      setOrderBookItems([]);
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
        fetchOrderBookItemsForCustomer(data.customerId);
      } else {
        setCustomerData(null);
        setOrderBookItems([]);
        showError('Customer not found for this project');
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      setCustomerData(null);
      setOrderBookItems([]);
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
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setCustomerData(null);

    setFormData({
      ...formData,
      groupId: newGroupName,
      subGroupId: '',
      projectId: '',
      customerId: null
    });

    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
    }
  };

  /**
   * Handle modal subgroup change
   */
  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setModalProjects([]);
    setCustomerData(null);

    setFormData({
      ...formData,
      subGroupId: newSubGroupName,
      projectId: '',
      customerId: null
    });

    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
    }
  };

  /**
   * Handle modal project change
   */
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);

    setFormData({
      ...formData,
      projectId: newProjectId
    });

    if (newProjectId) {
      fetchCustomerByProject(newProjectId);
    }
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
    setFormData({
      customerId: null,
      projectId: '',
      groupId: '',
      subGroupId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }],
      status: 'DRAFT'
    });
    setCustomerData(null);
    setModalGroupName('');
    setModalSubGroupName('');
    setModalProjectId('');
    setEditMode(false);

    fetchModalGroups();
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
      invoiceDate: invoice.invoiceDate.split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
      items: invoice.items || [{ description: '', quantity: '', unitPrice: '', taxPercent: '', unitType: '' }],
      status: invoice.status
    });
    setSelectedInvoice(invoice);
    setEditMode(true);

    // Await groups BEFORE opening the modal so the select is never empty
    await fetchModalGroups();

    // Set the selected group after groups are confirmed loaded
    if (invoice.groupId) {
      setModalGroupName(invoice.groupId);
      // Also pre-load subgroups for the saved group
      await fetchModalSubGroups(invoice.groupId);
      if (invoice.subGroupId) {
        setModalSubGroupName(invoice.subGroupId);
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

  /**
   * Save invoice
   */
  const handleSaveInvoice = async (status) => {
    if (!formData.customerId) {
      showError('Please select a project to auto-fill customer details');
      return;
    }

    if (formData.items.length === 0 || !formData.items[0].description) {
      showError('Please add at least one item');
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
          unitType: item.unitType
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

      showSuccess(`Invoice ${editMode ? 'updated' : 'created'} successfully!`);
      setShowCreateModal(false);
      fetchInvoices();
      fetchStats();

    } catch (error) {
      console.error('Failed to save invoice:', error);
      showError(error.message || 'Failed to save invoice');
    } finally {
      setLoading(false);
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
      notes: ''
    });
    setShowPaymentModal(true);
  };

  /**
   * Save payment
   */
  const handleSavePayment = async () => {
    if (paymentData.amount <= 0) {
      showError('Payment amount must be greater than zero');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${selectedInvoice.id}/payment`, {
        credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ amount: paymentData.amount })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to record payment');
      }

      showSuccess('Payment recorded successfully!');
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
  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

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
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'DRAFT': 'Invoices-page-status-draft',
      'SENT': 'Invoices-page-status-sent',
      'PAID': 'Invoices-page-status-paid',
      'PARTIALLY_PAID': 'Invoices-page-payment-partial',
      'CANCELLED': 'Invoices-page-status-cancelled'
    };
    return statusMap[status] || '';
  };

  const getStatusDisplayName = (status) => {
    const statusMap = {
      'DRAFT': 'Draft',
      'SENT': 'Sent',
      'PAID': 'Paid',
      'PARTIALLY_PAID': 'Partially Paid',
      'CANCELLED': 'Cancelled'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="Invoices-page-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

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

          <select
            className="Invoices-page-filter"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="Invoices-page-actions">
          <button className="Invoices-page-btn-primary" onClick={handleCreateNew}>
            + Create New Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="Invoices-page-stats">
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">TOTAL INVOICES</div>
            <div className="Invoices-page-stat-value">{stats.totalCount || 0}</div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">PAID</div>
            <div className="Invoices-page-stat-value Invoices-page-stat-success">
              {stats.paidCount || 0}
            </div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">PENDING</div>
            <div className="Invoices-page-stat-value Invoices-page-stat-warning">
              {stats.pendingCount || 0}
            </div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">TOTAL AMOUNT</div>
            <div className="Invoices-page-stat-value">
              {formatCurrency(stats.totalAmount)}
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="Invoices-page-table-container">
        <table className="Invoices-page-table">
          <thead>
            <tr>
              {/* <th>Invoice ID</th> */}
              <th>Customer</th>
              {/* <th>Project</th> */}
              <th>Total Amount</th>
              <th>Paid Amount</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan="10" className="empty-state">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  {/* <td className="Invoices-page-invoice-id">{invoice.invoiceNo}</td> */}
                  <td>{invoice.customerId}</td>
                  {/* <td>{invoice.projectId || '—'}</td> */}
                  <td className="Invoices-page-total">{formatCurrency(invoice.totalAmount)}</td>
                  <td>{formatCurrency(invoice.paidAmount)}</td>
                  <td className="Invoices-page-total">{formatCurrency(invoice.balanceAmount)}</td>
                  <td>
                    <span className={`Invoices-page-badge ${getStatusClass(invoice.status)}`}>
                      {getStatusDisplayName(invoice.status)}
                    </span>
                  </td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td>
                    <div className="Invoices-page-action-buttons">
                      <button
                        className="Invoices-page-action-btn Invoices-page-btn-view"
                        onClick={() => handleViewInvoice(invoice)}
                        title="View"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="Invoices-page-action-btn Invoices-page-btn-edit"
                        onClick={() => handleEditInvoice(invoice)}
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="Invoices-page-action-btn Invoices-page-btn-download"
                        onClick={() => handleDownloadPdf(invoice)}
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="Invoices-page-action-btn Invoices-page-btn-payment"
                        onClick={() => handleRecordPayment(invoice)}
                        title="Record Payment"
                      >
                        <FaIndianRupeeSign size={16} />
                      </button>
                      <button
                        className="Invoices-page-action-btn Invoices-page-btn-delete"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        title="Delete"
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

        {/* Pagination */}
        <div className="Invoices-page-pagination">
          <div className="Invoices-page-pagination-info">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} invoices
          </div>

          <div className="Invoices-page-pagination-controls-wrapper">
            <div className="Invoices-page-pagination-size">
              <label>Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(0);
                }}
                className="Invoices-page-pagination-size-select"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div className="Invoices-page-pagination-controls">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                disabled={currentPage === 0}
                className="Invoices-page-pagination-btn"
              >
                Previous
              </button>
              <span className="Invoices-page-pagination-current">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                disabled={currentPage >= totalPages - 1}
                className="Invoices-page-pagination-btn"
              >
                Next
              </button>
            </div>
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
              <button
                className="Invoices-page-btn-secondary"
                onClick={() => handleDownloadPdf(selectedInvoice)}
              >
                <Download size={16} style={{ marginRight: '8px' }} />
                Download PDF
              </button>
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
                      <select
                        value={modalGroupName}
                        onChange={handleModalGroupChange}
                        disabled={modalDropdownLoading.groups}
                      >
                        <option value="">
                          {modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}
                        </option>
                        {modalGroups.map((group, index) => (
                          <option key={group.value || index} value={group.value}>
                            {group.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="Invoices-page-form-group">
                      <label>Sub Group</label>
                      <select
                        value={modalSubGroupName}
                        onChange={handleModalSubGroupChange}
                        disabled={!modalGroupName || modalDropdownLoading.subGroups}
                      >
                        <option value="">
                          {modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub Group'}
                        </option>
                        {modalSubGroups.map((subGroup, index) => (
                          <option key={subGroup.value || index} value={subGroup.value}>
                            {subGroup.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="Invoices-page-form-group">
                      <label>Project *</label>
                      <select
                        value={modalProjectId}
                        onChange={handleModalProjectChange}
                        disabled={!modalSubGroupName || modalDropdownLoading.projects}
                      >
                        <option value="">
                          {modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}
                        </option>
                        {modalProjects.map((project, index) => (
                          <option key={project.id || index} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>

                {customerData && (
                  <div className="Invoices-page-form-section">
                    <h3>Customer Information</h3>
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
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
                      <input
                        type="date"
                        value={formData.invoiceDate}
                        onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        min={formData.invoiceDate}
                      />
                    </div>
                  </div>
                </div>

                <div className="Invoices-page-form-section">
                  <div className="Invoices-page-section-header">
                    <h3>Invoice Items *</h3>
                    <button className="Invoices-page-btn-add" onClick={addItem}>+ Add Item</button>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="Invoices-page-item-row">
                      <div className="Invoices-page-item-fields">
                        <div className="Invoices-page-form-group" style={{ flex: '2', position: 'relative' }}>
                          <label>Description *</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleDescriptionChange(index, e.target.value)}
                            onFocus={() => {
                              if (item.description && item.description.length >= 2) {
                                handleDescriptionChange(index, item.description);
                              }
                            }}
                            placeholder="Start typing item name..."
                          />

                          {showDropdown[index] && filteredItems[index]?.length > 0 && (
                            <div
                              className="invoice-item-dropdown"
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '250px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                marginTop: '2px'
                              }}
                            >
                              {filteredItems[index].map((obItem) => (
                                <div
                                  key={obItem.id}
                                  onClick={() => selectOrderBookItem(index, obItem)}
                                  style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>
                                    {obItem.itemName}
                                  </div>
                                  {obItem.specification && (
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>
                                      {obItem.specification}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    Order: {obItem.orderBookNo} | Qty: {obItem.quantity} {obItem.unit} |
                                    Price: ₹{parseFloat(obItem.unitPrice).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Unit Type</label>
                          <UnitTypeDropdown
                            value={item.unitType}
                            onChange={(e) => updateItem(index, 'unitType', e.target.value)}
                          />
                        </div>

                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Qty *</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                       
                          />
                        </div>

                        <div className="Invoices-page-form-group">
                          <label>Unit Price *</label>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                           
                          />
                        </div>

                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Tax %</label>
                          <select
                            value={item.taxPercent}
                            onChange={(e) => updateItem(index, 'taxPercent', parseFloat(e.target.value))}
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>

                        <div className="Invoices-page-form-group">
                          <label>Line Total</label>
                          <div className="Invoices-page-item-total">
                            {formatCurrency(item.quantity * item.unitPrice * (1 + item.taxPercent / 100))}
                          </div>
                        </div>
                      </div>

                      {formData.items.length > 1 && (
                        <button
                          className="Invoices-page-btn-remove"
                          onClick={() => removeItem(index)}
                          title="Remove item"
                        >
                          ×
                        </button>
                      )}
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
              <button className="Invoices-page-btn-secondary" onClick={() => handleSaveInvoice('DRAFT')}>
                Save as Draft
              </button>
              <button className="Invoices-page-btn-primary" onClick={() => handleSaveInvoice('SENT')}>
                {editMode ? 'Update Invoice' : 'Create & Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="Invoices-page-modal-overlay">
          <div className="Invoices-page-modal" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>Record Payment</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div className="Invoices-page-payment-row">
                  <span>Invoice ID:</span>
                  <strong>{selectedInvoice.invoiceNo}</strong>
                </div>
                <div className="Invoices-page-payment-row">
                  <span>Total Amount:</span>
                  <strong>{formatCurrency(selectedInvoice.totalAmount)}</strong>
                </div>
                <div className="Invoices-page-payment-row">
                  <span>Already Paid:</span>
                  <strong className="Invoices-page-text-success">
                    {formatCurrency(selectedInvoice.paidAmount)}
                  </strong>
                </div>
                <div className="Invoices-page-payment-row">
                  <span>Balance Due:</span>
                  <strong className="Invoices-page-text-danger">
                    {formatCurrency(selectedInvoice.balanceAmount)}
                  </strong>
                </div>
              </div>

              <div className="Invoices-page-form">
                <div className="Invoices-page-form-group">
                  <label>Amount Paid *</label>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}                  
                    max={selectedInvoice.balanceAmount}
                  />
                </div>

                <div className="Invoices-page-form-group">
                  <label>Payment Method *</label>
                  <select
                    value={paymentData.method}
                    onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>

                <div className="Invoices-page-form-group">
                  <label>Notes</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    placeholder="Transaction reference, notes, etc."
                    rows="3"
                  />
                </div>

                <div className="Invoices-page-form-group">
                  <label>Transaction Reference</label>
                  <input
                    type="text"
                    value={paymentData.transactionReference}
                    onChange={(e) => setPaymentData({ ...paymentData, transactionReference: e.target.value })}
                    placeholder="Transaction ID, cheque number, etc."
                  />
                </div>
              </div>
            </div>

            <div className="Invoices-page-modal-actions">
              <button className="Invoices-page-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
              <button className="Invoices-page-btn-primary" onClick={handleSavePayment}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesManagementPage;