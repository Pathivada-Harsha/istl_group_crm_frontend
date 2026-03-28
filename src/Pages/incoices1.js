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
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
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
  const fetchOrderBookItems = async (projectId) => {
    if (!projectId) {
      setOrderBookItems([]);
      return;
    }

    setLoadingOrderItems(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/order-book-items/${projectId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch order book items');

      const data = await response.json();
      setOrderBookItems(data.data || []);
      console.log('Loaded order book items:', data.data);

    } catch (error) {
      console.error('Failed to fetch order book items:', error);
      setOrderBookItems([]);
    } finally {
      setLoadingOrderItems(false);
    }
  };
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
    items: [{ description: '', quantity: 1, unitPrice: 0, taxPercent: 18, unitType: 'Nos' }],
    status: 'DRAFT'
  });

  // Update payment form data
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'Bank Transfer',
    transactionReference: '',
    notes: ''
  });
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showItemDropdown && !event.target.closest('.Invoices-page-form-group')) {
        setShowItemDropdown(false);
        setActiveItemIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showItemDropdown]);
  // Fetch invoices on mount and filter change
  useEffect(() => {
    fetchInvoices();
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);
  const handleDownloadPdf = async (invoice) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoice.id}/download-pdf`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Invoice-${invoice.invoiceNo}.pdf`;
      if (contentDisposition) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches && matches[1]) filename = matches[1];
      }

      // Download the file
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

  /**
   * Fetch statistics
   */
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/stats`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  /**
   * Fetch modal groups
   */
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups || []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      showError('Failed to load groups');
      setModalGroups([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, groups: false }));
    }
  };

  /**
   * Fetch modal subgroups
   */
  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) {
      setModalSubGroups([]);
      setModalProjects([]);
      return;
    }

    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(groupName);
      setModalSubGroups(subGroups || []);
    } catch (error) {
      console.error('Failed to fetch subgroups:', error);
      showError('Failed to load categories');
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
      } else {
        setCustomerData(null);
        showError('Customer not found for this project');
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      setCustomerData(null);
    }
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
  // 4. Add function to filter order book items based on search
  const filterOrderBookItems = (searchTerm) => {
    if (!searchTerm) return orderBookItems;

    const lowerSearch = searchTerm.toLowerCase();
    return orderBookItems.filter(item =>
      item.itemName.toLowerCase().includes(lowerSearch) ||
      (item.specification && item.specification.toLowerCase().includes(lowerSearch)) ||
      (item.description && item.description.toLowerCase().includes(lowerSearch))
    );
  };
  const selectOrderBookItem = (index, item) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      description: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercent: item.taxPercent || 18,
      unitType: item.unit || 'Nos',
      orderBookItemId: item.id // Store reference
    };

    setFormData({ ...formData, items: newItems });
    setShowItemDropdown(false);
    setActiveItemIndex(null);
    setItemSearchTerm('');
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
      fetchOrderBookItems(newProjectId); // ADD THIS LINE
    } else {
      setCustomerData(null);
      setOrderBookItems([]); // ADD THIS LINE
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

      // Fetch payment history
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
      items: [{ description: '', quantity: 1, unitPrice: 0, taxPercent: 18, unitType: 'Nos' }],
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
  const handleEditInvoice = (invoice) => {
    setFormData({
      customerId: invoice.customerId,
      projectId: invoice.projectId,
      groupId: invoice.groupId,
      subGroupId: invoice.subGroupId,
      invoiceDate: invoice.invoiceDate.split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
      items: invoice.items || [{ description: '', quantity: 1, unitPrice: 0, taxPercent: 18, unitType: 'Nos' }],
      status: invoice.status
    });
    setSelectedInvoice(invoice);
    setEditMode(true);
    setShowCreateModal(true);
  };

  /**
   * Add item
   */
  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unitPrice: 0, taxPercent: 18, unitType: 'Nos' }]
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
    // Validation
    if (!formData.customerId) {
      showError('Please select a project to auto-fill customer details');
      return;
    }

    if (!formData.dueDate) {
      showError('Due date is required');
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
            <div className="Invoices-page-stat-label">Total Invoices</div>
            <div className="Invoices-page-stat-value">{stats.totalInvoices}</div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">Paid</div>
            <div className="Invoices-page-stat-value Invoices-page-stat-success">
              {stats.paidInvoices}
            </div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">Pending</div>
            <div className="Invoices-page-stat-value Invoices-page-stat-warning">
              {stats.sentInvoices + stats.partiallyPaidInvoices}
            </div>
          </div>
          <div className="Invoices-page-stat-card">
            <div className="Invoices-page-stat-label">Total Amount</div>
            <div className="Invoices-page-stat-value">
              {formatCurrency(stats.totalPaidAmount)}
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="Invoices-page-table-container">
        <table className="Invoices-page-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Customer</th>
              <th>Project</th>
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
                  <td className="Invoices-page-invoice-id">{invoice.invoiceNo}</td>
                  <td>{invoice.customerId}</td>
                  <td>{invoice.projectId || '—'}</td>
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
                        <DollarSign size={16} />
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
            {/* Rows per page selector */}
            <div className="Invoices-page-pagination-size">
              <label>Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(0); // Reset to first page when changing page size
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

            {/* Page navigation */}
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
        <div className="Invoices-page-modal-overlay" onClick={() => setShowInvoiceModal(false)}>
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

                {/* Invoice Items */}
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
                {/* Payment History */}
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
                {/* Totals */}
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
        <div className="Invoices-page-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="Invoices-page-modal Invoices-page-modal-xlarge" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>{editMode ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-form">
                {/* Project Assignment */}
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
                <div className="Invoices-page-form-group">
                  <label>Company *</label>
                  <select
                    value={formData.company || 'ISTL'}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  >
                    <option value="ISTL">ISTL</option>
                    <option value="SESOLA">SESOLA</option>
                  </select>
                </div>
                {/* Customer Information (Auto-populated) */}
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

                {/* Invoice Details */}
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
                      <label>Due Date *</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        min={formData.invoiceDate}
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="Invoices-page-form-section">
                  <div className="Invoices-page-section-header">
                    <h3>Invoice Items *</h3>
                    <button className="Invoices-page-btn-add" onClick={addItem}>+ Add Item</button>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="Invoices-page-item-row">
                      <div className="Invoices-page-item-fields">
                        <div className="Invoices-page-form-group" style={{ flex: '2', position: 'relative' }}>
                          <label>Description / Item Name *</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              updateItem(index, 'description', e.target.value);
                              setItemSearchTerm(e.target.value);
                              setActiveItemIndex(index);
                              setShowItemDropdown(true);
                            }}
                            onFocus={() => {
                              setActiveItemIndex(index);
                              setShowItemDropdown(true);
                            }}
                            placeholder="Type to search order book items or enter manually"
                          />
                          {showItemDropdown && activeItemIndex === index && orderBookItems.length > 0 && (
                            <div className="Invoices-page-item-dropdown">
                              {filterOrderBookItems(itemSearchTerm).slice(0, 10).map((obItem) => (
                                <div
                                  key={obItem.id}
                                  className="Invoices-page-item-dropdown-option"
                                  onClick={() => selectOrderBookItem(index, obItem)}
                                >
                                  <div className="Invoices-page-item-option-name">{obItem.itemName}</div>
                                  {obItem.specification && (
                                    <div className="Invoices-page-item-option-spec">{obItem.specification}</div>
                                  )}
                                  <div className="Invoices-page-item-option-details">
                                    Order: {obItem.orderBookNo} | Qty: {obItem.quantity} {obItem.unit} |
                                    Rate: ₹{parseFloat(obItem.unitPrice).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                              {filterOrderBookItems(itemSearchTerm).length === 0 && (
                                <div className="Invoices-page-item-dropdown-empty">
                                  No matching order book items found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Unit Type</label>
                          <select
                            value={item.unitType}
                            onChange={(e) => updateItem(index, 'unitType', e.target.value)}
                          >
                            <option value="Nos">Nos</option>
                            <option value="Kgs">Kgs</option>
                            <option value="Boxes">Boxes</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Meters">Meters</option>
                            <option value="Liters">Liters</option>
                          </select>
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Qty *</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                            min="1"
                          />
                        </div>
                        <div className="Invoices-page-form-group">
                          <label>Unit Price *</label>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
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
        <div className="Invoices-page-modal-overlay" onClick={() => setShowPaymentModal(false)}>
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
                    onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
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