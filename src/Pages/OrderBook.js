import React, { useState, useEffect } from 'react';
import '../pages-css/OrderBook.css';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import { FaEye, FaEdit, FaTrash, FaUpload, FaFileDownload } from 'react-icons/fa';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function OrderBook() {
  const { user } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // State
  const [orderBooks, setOrderBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPOUploadModal, setShowPOUploadModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedOrderBook, setSelectedOrderBook] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    proposalId: '',
    groupName: '',
    subGroupName: '',
    orderTitle: '',
    orderDescription: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    poNumber: '',
    poDate: '',
    advanceAmount: 0,
    status: 'Draft',
    remarks: '',
    items: []
  });

  // PO Upload State
  const [poUploadData, setPoUploadData] = useState({
    file: null,
    poNumber: '',
    poDate: ''
  });

  useEffect(() => {
    fetchOrderBooks();
    fetchGroups();
  }, [currentPage, rowsPerPage, groupName, subGroupName]);

  useEffect(() => {
    if (searchTerm || statusFilter !== 'All' || fromDate || toDate) {
      const debounce = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      fetchOrderBooks();
    }
  }, [searchTerm, statusFilter, fromDate, toDate]);

  // Fetch customers when form group/subgroup changes
  useEffect(() => {
    if (formData.groupName) {
      fetchSubGroupsForForm(formData.groupName);
      fetchCustomersByGroup(formData.groupName, formData.subGroupName);
    } else {
      setSubGroups([]);
      setCustomers([]);
    }
  }, [formData.groupName, formData.subGroupName]);

  const fetchOrderBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage - 1,
        size: rowsPerPage
      });

      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);

      const response = await fetch(`${API_BASE_URL}/order-book/getAll?${params}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch order books');

      const data = await response.json();
      if (data.success) {
        setOrderBooks(data.data || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      showError(err.message || 'Error fetching order books');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage - 1,
        size: rowsPerPage
      });

      if (searchTerm) params.append('searchTerm', searchTerm);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const response = await fetch(`${API_BASE_URL}/order-book/search?${params}`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to search order books');

      const data = await response.json();
      if (data.success) {
        setOrderBooks(data.data || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      showError(err.message || 'Error searching order books');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) {
      setSubGroups([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subgroups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setSubGroups(data);
      }
    } catch (err) {
      console.error('Error fetching subgroups:', err);
      setSubGroups([]);
    }
  };

  const fetchCustomersByGroup = async (group, subGroup) => {
    if (!group) {
      setCustomers([]);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('groupName', group);
      if (subGroup) params.append('subGroupName', subGroup);

      const response = await fetch(`${API_BASE_URL}/customers/by-group?${params}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch customers');

      const data = await response.json();
      if (data.success) {
        const customerList = Array.isArray(data.data) ? data.data : data.data.content || [];
        setCustomers(customerList);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomers([]);
    }
  };

  const fetchProposalsByCustomer = async (customerId) => {
    if (!customerId) {
      setProposals([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/proposals/by-customer/${customerId}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch proposals');

      const data = await response.json();
      if (data.success) {
        const proposalList = Array.isArray(data.data) ? data.data : [];
        setProposals(proposalList);
      }
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setProposals([]);
    }
  };

  const loadProposalItems = async (proposalId) => {
    if (!proposalId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/proposal-items/${proposalId}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to load proposal items');

      const data = await response.json();
      if (data.success) {
        const items = (data.data || []).map((item, index) => ({
          lineNo: index + 1,
          itemName: item.itemName,
          specification: item.specification,
          description: item.description,
          proposalItemId: item.id,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          discountPercent: 0,
          itemRemarks: ''
        }));

        setFormData(prev => ({ ...prev, items }));
        showSuccess('Proposal items loaded successfully');
      }
    } catch (err) {
      showError(err.message || 'Error loading proposal items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleEdit = async (orderBook) => {
    setSelectedOrderBook(orderBook);

    // Fetch items
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/${orderBook.id}/items`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch items');

      const data = await response.json();
      if (data.success) {
        setFormData({
          customerId: orderBook.customerId || '',
          proposalId: orderBook.proposalId || '',
          groupName: orderBook.groupName || '',
          subGroupName: orderBook.subGroupName || '',
          orderTitle: orderBook.orderTitle || '',
          orderDescription: orderBook.orderDescription || '',
          orderDate: orderBook.orderDate || '',
          expectedDeliveryDate: orderBook.expectedDeliveryDate || '',
          poNumber: orderBook.poNumber || '',
          poDate: orderBook.poDate || '',
          advanceAmount: orderBook.advanceAmount || 0,
          status: orderBook.status || 'Draft',
          remarks: orderBook.remarks || '',
          items: data.data || []
        });

        setIsEditMode(true);
        setShowCreateModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error loading order book details');
    }
  };

  const handleView = async (orderBook) => {
    setSelectedOrderBook(orderBook);

    // Fetch items
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/${orderBook.id}/items`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch items');

      const data = await response.json();
      if (data.success) {
        setSelectedOrderBook({ ...orderBook, items: data.data || [] });
        setShowViewModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error loading order book details');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order book?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/delete/${id}`, {
        method: 'DELETE',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to delete order book');

      const data = await response.json();
      if (data.success) {
        showSuccess('Order book deleted successfully');
        fetchOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error deleting order book');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerId || !formData.orderTitle || formData.items.length === 0) {
      showWarning('Please fill in all required fields and add at least one item');
      return;
    }

    setLoading(true);
    try {
      const url = isEditMode
        ? `${API_BASE_URL}/order-book/update/${selectedOrderBook.id}`
        : `${API_BASE_URL}/order-book/create`;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save order book');
      }

      const data = await response.json();
      if (data.success) {
        showSuccess(isEditMode ? 'Order book updated successfully' : 'Order book created successfully');
        setShowCreateModal(false);
        resetForm();
        fetchOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error saving order book');
    } finally {
      setLoading(false);
    }
  };

  const handlePOUpload = async (e) => {
    e.preventDefault();

    if (!poUploadData.file || !poUploadData.poNumber) {
      showWarning('Please select a file and enter PO number');
      return;
    }

    setLoading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', poUploadData.file);
      formDataUpload.append('poNumber', poUploadData.poNumber);
      if (poUploadData.poDate) {
        formDataUpload.append('poDate', poUploadData.poDate);
      }

      const response = await fetch(`${API_BASE_URL}/order-book/${selectedOrderBook.id}/upload-po`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: formDataUpload
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload PO');
      }

      const data = await response.json();
      if (data.success) {
        showSuccess('PO uploaded successfully');
        setShowPOUploadModal(false);
        setPoUploadData({ file: null, poNumber: '', poDate: '' });
        fetchOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error uploading PO');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      proposalId: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      orderTitle: '',
      orderDescription: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      poNumber: '',
      poDate: '',
      advanceAmount: 0,
      status: 'Draft',
      remarks: '',
      items: []
    });
    setIsEditMode(false);
    setSelectedOrderBook(null);
    setCustomers([]);
    setProposals([]);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          lineNo: prev.items.length + 1,
          itemName: '',
          specification: '',
          description: '',
          proposalItemId: null,
          quantity: 1,
          unit: 'Nos',
          unitPrice: 0,
          taxPercent: 0,
          discountPercent: 0,
          itemRemarks: ''
        }
      ]
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index][field] = value;
      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateItemTotal = (item) => {
    const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
    const discount = subtotal * ((parseFloat(item.discountPercent) || 0) / 100);
    const taxable = subtotal - discount;
    const tax = taxable * ((parseFloat(item.taxPercent) || 0) / 100);
    return taxable + tax;
  };

  const calculateGrandTotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'Draft': 'status-draft',
      'Confirmed': 'status-confirmed',
      'In Production': 'status-production',
      'Ready for Dispatch': 'status-ready',
      'Dispatched': 'status-dispatched',
      'Completed': 'status-completed',
      'Cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-draft';
  };

  return (
    <div className="orderbook-page">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Breadcrumb */}
      <div className="orderbook-breadcrumb">
        <span>Dashboard</span>
        <span className="orderbook-breadcrumb-separator">&gt;</span>
        <span className="orderbook-breadcrumb-active">Order Book</span>
      </div>

      {/* Header */}
      <div className="orderbook-header page-header-with-filter">
        <h1>Order Book</h1>
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      {/* Action Bar */}
      <div className="orderbook-action-bar">
        <div className="orderbook-search-filters">
          <input
            type="text"
            className="orderbook-search"
            placeholder="Search by Order No, Title, PO Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="orderbook-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="In Production">In Production</option>
            <option value="Ready for Dispatch">Ready for Dispatch</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <input
            type="date"
            className="orderbook-filter"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From Date"
          />

          <input
            type="date"
            className="orderbook-filter"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To Date"
          />
        </div>

        <button className="orderbook-btn orderbook-btn-primary" onClick={handleCreateNew}>
          + Create Order Book
        </button>
      </div>

      {/* Table */}
      <div className="orderbook-table-card">
        <div className="orderbook-table-wrapper">
          <table className="orderbook-table">
            <thead>
              <tr>
                <th>Order No</th>
                <th>Customer</th>
                <th>Group</th>
                <th>Order Title</th>
                <th>Order Date</th>
                <th>PO Number</th>
                <th>Total Amount (₹)</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderBooks.length === 0 ? (
                <tr>
                  <td colSpan="10" className="orderbook-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No order books found</p>
                  </td>
                </tr>
              ) : (
                orderBooks.map((order) => (
                  <tr key={order.id}>
                    <td className="orderbook-id">{order.orderBookNo}</td>
                    <td>
                      <div className="orderbook-customer-info">
                        <strong>{order.customerName}</strong>
                        <span className="orderbook-customer-code">{order.customerCode}</span>
                      </div>
                    </td>
                    <td>{order.groupName || '-'}</td>
                    <td>{order.orderTitle}</td>
                    <td>{order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : '-'}</td>
                    <td>{order.poNumber || '-'}</td>
                    <td className="orderbook-amount">₹{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td>
                      <span className={`orderbook-status ${getStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.createdByName || '-'}</td>
                    <td>
                      <div className="orderbook-actions">
                        <button
                          className="orderbook-action-btn"
                          onClick={() => handleView(order)}
                          title="View"
                        >
                          <FaEye />
                        </button>
                        <button
                          className="orderbook-action-btn"
                          onClick={() => handleEdit(order)}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="orderbook-action-btn orderbook-action-upload"
                          onClick={() => {
                            setSelectedOrderBook(order);
                            setShowPOUploadModal(true);
                          }}
                          title="Upload PO"
                        >
                          <FaUpload />
                        </button>
                        <button
                          className="orderbook-action-btn orderbook-action-delete"
                          onClick={() => handleDelete(order.id)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="orderbook-pagination">
          <div className="orderbook-pagination-info">
            {totalItems > 0 ? (
              <>Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems} entries</>
            ) : (
              <>No entries to display</>
            )}
          </div>
          <div className="orderbook-pagination-controls">
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="orderbook-rows-select"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
            </select>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="orderbook-pagination-btn"
            >
              Previous
            </button>
            <span className="orderbook-pagination-current">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="orderbook-pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {showViewModal && selectedOrderBook && (
        <div className="orderbook-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="orderbook-modal orderbook-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Order Book Details</h2>
              <button className="orderbook-modal-close" onClick={() => setShowViewModal(false)}>×</button>
            </div>

            <div className="orderbook-modal-content">
              {/* Order Info */}
              <div className="orderbook-card">
                <div className="orderbook-card-header">
                  <div>
                    <h3>{selectedOrderBook.orderTitle}</h3>
                    <p className="orderbook-id">{selectedOrderBook.orderBookNo}</p>
                  </div>
                  <span className={`orderbook-status ${getStatusClass(selectedOrderBook.status)}`}>
                    {selectedOrderBook.status}
                  </span>
                </div>
                <div className="orderbook-info-grid">
                  <div><strong>Customer:</strong> {selectedOrderBook.customerName} ({selectedOrderBook.customerCode})</div>
                  <div><strong>Group:</strong> {selectedOrderBook.groupName || '-'}</div>
                  <div><strong>Sub Group:</strong> {selectedOrderBook.subGroupName || '-'}</div>
                  <div><strong>Order Date:</strong> {selectedOrderBook.orderDate ? new Date(selectedOrderBook.orderDate).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>Expected Delivery:</strong> {selectedOrderBook.expectedDeliveryDate ? new Date(selectedOrderBook.expectedDeliveryDate).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>PO Number:</strong> {selectedOrderBook.poNumber || '-'}</div>
                  <div><strong>PO Date:</strong> {selectedOrderBook.poDate ? new Date(selectedOrderBook.poDate).toLocaleDateString('en-IN') : '-'}</div>
                  <div><strong>Created By:</strong> {selectedOrderBook.createdByName || '-'}</div>
                </div>

                {selectedOrderBook.orderDescription && (
                  <div className="orderbook-description">
                    <strong>Description:</strong>
                    <p>{selectedOrderBook.orderDescription}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              {selectedOrderBook.items && selectedOrderBook.items.length > 0 && (
                <div className="orderbook-card">
                  <h3>Order Items</h3>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item Name</th>
                          <th>Specification</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Discount %</th>
                          <th>Tax %</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderBook.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.lineNo}</td>
                            <td>{item.itemName}</td>
                            <td>{item.specification || '-'}</td>
                            <td>{item.quantity}</td>
                            <td>{item.unit}</td>
                            <td>₹{parseFloat(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>{item.discountPercent}%</td>
                            <td>{item.taxPercent}%</td>
                            <td>₹{parseFloat(item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        <tr className="orderbook-total-row">
                          <td colSpan="8" style={{ textAlign: 'right' }}><strong>Total Amount:</strong></td>
                          <td><strong>₹{parseFloat(selectedOrderBook.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="orderbook-card">
                <h3>Financial Summary</h3>
                <div className="orderbook-financial-grid">
                  <div className="orderbook-financial-item">
                    <span>Subtotal:</span>
                    <strong>₹{parseFloat(selectedOrderBook.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Tax Amount:</span>
                    <strong>₹{parseFloat(selectedOrderBook.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Total Amount:</span>
                    <strong className="orderbook-total">₹{parseFloat(selectedOrderBook.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Advance Paid:</span>
                    <strong>₹{parseFloat(selectedOrderBook.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Balance Due:</span>
                    <strong className="orderbook-balance">₹{parseFloat(selectedOrderBook.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {selectedOrderBook.remarks && (
                <div className="orderbook-card">
                  <h3>Remarks</h3>
                  <p>{selectedOrderBook.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="orderbook-modal-overlay" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <div className="orderbook-modal orderbook-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>{isEditMode ? 'Edit Order Book' : 'Create Order Book'}</h2>
              <button className="orderbook-modal-close" onClick={() => { setShowCreateModal(false); resetForm(); }}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="orderbook-modal-content">
              {/* Basic Info */}
              <div className="orderbook-card">
                <h3>Basic Information</h3>
                <div className="orderbook-form-grid">
                  <div className="orderbook-form-group">
                    <label>Group *</label>
                    <select
                      value={formData.groupName}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          groupName: e.target.value,
                          subGroupName: '',
                          customerId: '',
                          proposalId: ''
                        });
                      }}
                      required
                    >
                      <option value="">Select Group</option>
                      {groups.map((group, index) => (
                        <option key={group.value || group.label || index} value={group.value || group.label}>
                          {group.label || group.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="orderbook-form-group">
                    <label>Sub Group</label>
                    <select
                      value={formData.subGroupName}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          subGroupName: e.target.value,
                          customerId: '',
                          proposalId: ''
                        });
                      }}
                      disabled={!formData.groupName}
                    >
                      <option value="">Select Sub Group</option>
                      {subGroups.map((sub, index) => (
                        <option key={sub.value || sub.label || index} value={sub.value || sub.label}>
                          {sub.label || sub.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="orderbook-form-group">
                    <label>Customer *</label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => {
                        setFormData({ ...formData, customerId: e.target.value, proposalId: '' });
                        fetchProposalsByCustomer(e.target.value);
                      }}
                      disabled={!formData.groupName}
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.customerCode}
                        </option>
                      ))}
                    </select>
                    {!formData.groupName && (
                      <small className="orderbook-help-text">
                        Please select a group first
                      </small>
                    )}
                  </div>

                  <div className="orderbook-form-group">
                    <label>Proposal (Optional)</label>
                    <select
                      value={formData.proposalId}
                      onChange={(e) => {
                        setFormData({ ...formData, proposalId: e.target.value });
                        if (e.target.value) {
                          loadProposalItems(e.target.value);
                        }
                      }}
                      disabled={!formData.customerId}
                    >
                      <option value="">Select Proposal</option>
                      {proposals.map(proposal => (
                        <option key={proposal.id} value={proposal.id}>
                          {proposal.proposalNo} - {proposal.title}
                        </option>
                      ))}
                    </select>
                    {formData.proposalId && (
                      <small className="orderbook-help-text">
                        Items will be loaded automatically from proposal
                      </small>
                    )}
                  </div>

                  <div className="orderbook-form-group">
                    <label>Order Title *</label>
                    <input
                      type="text"
                      value={formData.orderTitle}
                      onChange={(e) => setFormData({ ...formData, orderTitle: e.target.value })}
                      placeholder="Enter order title"
                      required
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Order Date *</label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Expected Delivery Date</label>
                    <input
                      type="date"
                      value={formData.expectedDeliveryDate}
                      onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="In Production">In Production</option>
                      <option value="Ready for Dispatch">Ready for Dispatch</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="orderbook-form-group">
                    <label>PO Number</label>
                    <input
                      type="text"
                      value={formData.poNumber}
                      onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                      placeholder="Enter PO number"
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>PO Date</label>
                    <input
                      type="date"
                      value={formData.poDate}
                      onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Advance Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.advanceAmount}
                      onChange={(e) => setFormData({ ...formData, advanceAmount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="orderbook-form-group orderbook-form-full">
                    <label>Description</label>
                    <textarea
                      value={formData.orderDescription}
                      onChange={(e) => setFormData({ ...formData, orderDescription: e.target.value })}
                      placeholder="Enter order description"
                      rows={3}
                    />
                  </div>

                  <div className="orderbook-form-group orderbook-form-full">
                    <label>Remarks</label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Enter any remarks"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="orderbook-card">
                <div className="orderbook-items-header">
                  <h3>Order Items</h3>
                  <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={addItem}>
                    + Add Item
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <div className="orderbook-empty-items">
                    <p>No items added. Click "Add Item" to start.</p>
                  </div>
                ) : (
                  <>
                    <div className="orderbook-table-wrapper">
                      <table className="orderbook-table orderbook-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ width: '200px' }}>Item Name *</th>
                            <th style={{ width: '150px' }}>Specification</th>
                            <th style={{ width: '100px' }}>Quantity *</th>
                            <th style={{ width: '80px' }}>Unit</th>
                            <th style={{ width: '120px' }}>Unit Price (₹)</th>
                            <th style={{ width: '100px' }}>Discount %</th>
                            <th style={{ width: '80px' }}>Tax %</th>
                            <th style={{ width: '120px' }}>Line Total</th>
                            {/* <th style={{ width: '200px' }}>Description</th> */}
                            <th style={{ width: '60px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, index) => (
                            <tr key={index}>
                              {/* Line Number */}
                              <td className="orderbook-table-cell-centered">
                                {item.lineNo}
                              </td>

                              {/* Item Name */}
                              <td>
                                <input
                                  type="text"
                                  className="orderbook-table-input"
                                  value={item.itemName}
                                  onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                                  placeholder="Item name"
                                  required
                                />
                              </td>

                              {/* Specification */}
                              <td>
                                <input
                                  type="text"
                                  className="orderbook-table-input"
                                  value={item.specification}
                                  onChange={(e) => updateItem(index, 'specification', e.target.value)}
                                  placeholder="Specification"
                                />
                              </td>

                              {/* Quantity */}
                              <td>
                                <input
                                  type="number"
                                  step="0.0001"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  required
                                />
                              </td>

                              {/* Unit */}
                              <td>
                                <input
                                  type="text"
                                  className="orderbook-table-input"
                                  value={item.unit}
                                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                  placeholder="Nos"
                                />
                              </td>

                              {/* Unit Price */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                />
                              </td>

                              {/* Discount % */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.discountPercent}
                                  onChange={(e) => updateItem(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                                />
                              </td>

                              {/* Tax % */}
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="orderbook-table-input orderbook-table-input-number"
                                  value={item.taxPercent}
                                  onChange={(e) => updateItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                                />
                              </td>

                              {/* Line Total (Read-only) */}
                              <td className="orderbook-table-cell-total">
                                ₹{calculateItemTotal(item).toFixed(2)}
                              </td>

                              {/* Description */}
                              {/* <td>
                                <input
                                  type="text"
                                  className="orderbook-table-input"
                                  value={item.description}
                                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                                  placeholder="Description"
                                />
                              </td> */}

                              {/* Remove Button */}
                              <td className="orderbook-table-cell-centered">
                                <button
                                  type="button"
                                  className="orderbook-table-delete-btn"
                                  onClick={() => removeItem(index)}
                                  title="Remove item"
                                >
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total */}
                    <div className="orderbook-grand-total">
                      <span>Grand Total:</span>
                      <strong>₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="orderbook-modal-actions">
                <button
                  type="button"
                  className="orderbook-btn orderbook-btn-secondary"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="orderbook-btn orderbook-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (isEditMode ? 'Update Order Book' : 'Create Order Book')}
                </button>
              </div>

              
            </form>
          </div>
        </div>
      )}

      {/* PO Upload Modal */}
      {showPOUploadModal && selectedOrderBook && (
        <div className="orderbook-modal-overlay" onClick={() => setShowPOUploadModal(false)}>
          <div className="orderbook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Upload PO for {selectedOrderBook.orderBookNo}</h2>
              <button className="orderbook-modal-close" onClick={() => setShowPOUploadModal(false)}>×</button>
            </div>

            <form onSubmit={handlePOUpload} className="orderbook-modal-content">
              <div className="orderbook-form-group">
                <label>PO Number *</label>
                <input
                  type="text"
                  value={poUploadData.poNumber}
                  onChange={(e) => setPoUploadData({ ...poUploadData, poNumber: e.target.value })}
                  placeholder="Enter PO number"
                  required
                />
              </div>

              <div className="orderbook-form-group">
                <label>PO Date</label>
                <input
                  type="date"
                  value={poUploadData.poDate}
                  onChange={(e) => setPoUploadData({ ...poUploadData, poDate: e.target.value })}
                />
              </div>

              <div className="orderbook-form-group">
                <label>PO File *</label>
                <input
                  type="file"
                  onChange={(e) => setPoUploadData({ ...poUploadData, file: e.target.files[0] })}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  required
                />
                <small className="orderbook-help-text">
                  Accepted formats: PDF, DOC, DOCX, JPG, PNG
                </small>
              </div>

              <div className="orderbook-modal-actions">
                <button
                  type="button"
                  className="orderbook-btn orderbook-btn-secondary"
                  onClick={() => setShowPOUploadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="orderbook-btn orderbook-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Uploading...' : 'Upload PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderBook;