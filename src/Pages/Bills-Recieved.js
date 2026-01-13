import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Plus, X, Edit2, Eye, Check, XCircle, FileText, 
  Upload, Calendar, DollarSign, TrendingUp, Clock, Package, CheckCircle, 
  CreditCard, Link as LinkIcon, Trash2, AlertCircle 
} from 'lucide-react';
import '../pages-css/Bills-Recieved.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const BillsReceived = () => {
  const [bills, setBills] = useState([]);
  const [selectedBills, setSelectedBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({
    totalBills: 0,
    outstandingAmount: 0,
    billsThisMonth: 0,
    paidBills: 0,
    linkedToPOPercentage: 0
  });

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const [filters, setFilters] = useState({
    search: '',
    paymentStatus: 'all',
    vendor: 'all',
    poId: 'all'
  });
  
  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalItems: 0,
    pageSize: 20
  });
  
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFileViewModal, setShowFileViewModal] = useState(false);
  const [fileViewUrl, setFileViewUrl] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { user } = useAuth();

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json'
  });

  // Fetch bills from backend
  useEffect(() => {
    fetchBills();
    fetchKPIs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, groupName, subGroupName, filters.paymentStatus, pagination.currentPage]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        size: pagination.pageSize.toString(),
        sortBy: 'billDate',
        sortDirection: 'DESC'
      });

      if (projectId) params.append('projectId', projectId);
      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);
      if (filters.paymentStatus !== 'all') params.append('status', filters.paymentStatus);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE_URL}/api/bills?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setBills(data.bills || []);
        setPagination(prev => ({
          ...prev,
          currentPage: data.currentPage,
          totalPages: data.totalPages,
          totalItems: data.totalItems
        }));
      } else {
        showError('Failed to fetch bills');
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      showError('Error fetching bills');
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIs = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (groupName) params.append('groupId', groupName);
      if (subGroupName) params.append('subGroupId', subGroupName);

      const response = await fetch(`${API_BASE_URL}/api/bills/stats?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const stats = await response.json();
        setKpis({
          totalBills: stats.totalBills,
          outstandingAmount: stats.outstandingAmount,
          billsThisMonth: stats.billsThisMonth,
          paidBills: stats.paidBills,
          linkedToPOPercentage: stats.linkedToPOPercentage
        });
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  // Handle checkbox selection
  const handleSelectBill = (billId) => {
    setSelectedBills(prev =>
      prev.includes(billId)
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedBills(bills.map(bill => bill.id));
    } else {
      setSelectedBills([]);
    }
  };

  // View bill details
  const handleViewBill = async (billId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/${billId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const bill = await response.json();
        setSelectedBill(bill);
        setShowDetailDrawer(true);
      } else {
        showError('Failed to fetch bill details');
      }
    } catch (error) {
      console.error('Error fetching bill:', error);
      showError('Error fetching bill');
    } finally {
      setLoading(false);
    }
  };

  // Create new bill
  const handleCreateBill = () => {
    setEditMode(false);
    setFormData({
      vendorId: null,
      poId: null,
      billNo: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      projectId: projectId || '',
      groupId: groupName || '',
      subGroupId: subGroupName || '',
      items: [{ description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }],
      notes: ''
    });
    setSelectedFile(null);
    setShowCreateEditModal(true);
  };

  // Edit bill
  const handleEditBill = (bill) => {
    setEditMode(true);
    setFormData({
      ...bill,
      billDate: bill.billDate.split('T')[0],
      dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : ''
    });
    setShowDetailDrawer(false);
    setShowCreateEditModal(true);
  };

  // Delete bill
  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/${billId}`, {
        credentials: "include",
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        showSuccess('Bill deleted successfully');
        fetchBills();
        fetchKPIs();
      } else {
        showError('Failed to delete bill');
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      showError('Error deleting bill');
    } finally {
      setLoading(false);
    }
  };

  // Save bill (create or update)
  const handleSaveBill = async () => {
    if (!formData.vendorId || !formData.billDate || formData.items.length === 0) {
      showError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const method = editMode ? 'PUT' : 'POST';
      const url = editMode 
        ? `${API_BASE_URL}/api/bills/${formData.id}` 
        : `${API_BASE_URL}/api/bills`;

      const response = await fetch(url, {
        credentials: "include",
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const savedBill = await response.json();
        
        // Upload file if selected
        if (selectedFile && savedBill.id) {
          await uploadBillFile(savedBill.id, selectedFile);
        }

        showSuccess(editMode ? 'Bill updated successfully' : 'Bill created successfully');
        setShowCreateEditModal(false);
        fetchBills();
        fetchKPIs();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to save bill');
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      showError('Error saving bill');
    } finally {
      setLoading(false);
    }
  };

  // Upload bill file
  const uploadBillFile = async (billId, file) => {
    const formDataFile = new FormData();
    formDataFile.append('file', file);

    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'X-User-Id': user?.id || localStorage.getItem('userId'),
      'X-User-Role': user?.role || localStorage.getItem('userRole')
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/${billId}/upload`, {
        credentials: "include",
        method: 'POST',
        headers,
        body: formDataFile
      });

      if (response.ok) {
        showSuccess('File uploaded successfully');
      } else {
        showError('File upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Error uploading file');
    }
  };

  // View bill file in modal
  const handleViewFile = (billId) => {
    const url = `${API_BASE_URL}/api/bills/${billId}/view`;
    setFileViewUrl(url);
    setShowFileViewModal(true);
  };

  // Download bill file
  const handleDownloadFile = (billId, fileName) => {
    const url = `${API_BASE_URL}/api/bills/${billId}/download`;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add payment
  const handleAddPayment = (bill) => {
    setSelectedBill(bill);
    setPaymentData({
      amount: '',
      paymentMode: 'Bank Transfer',
      referenceNumber: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  // Save payment
  const handleSavePayment = async () => {
    if (!paymentData.amount || !paymentData.referenceNumber) {
      showError('Please fill in all payment details');
      return;
    }

    const paymentAmount = parseFloat(paymentData.amount);
    if (paymentAmount <= 0 || paymentAmount > selectedBill.balanceAmount) {
      showError('Invalid payment amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bills/${selectedBill.id}/payments`,
        {
          credentials: "include",
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...paymentData,
            paymentDate: new Date(paymentData.paymentDate).toISOString()
          })
        }
      );

      if (response.ok) {
        showSuccess('Payment added successfully');
        setShowPaymentModal(false);
        setShowDetailDrawer(false);
        fetchBills();
        fetchKPIs();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to add payment');
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      showError('Error adding payment');
    } finally {
      setLoading(false);
    }
  };

  // Mark as paid
  const handleMarkPaid = async (billId) => {
    if (!window.confirm('Mark this bill as fully paid?')) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bills/${billId}/mark-paid`,
        {
          credentials: "include",
          method: 'POST',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        showSuccess('Bill marked as paid');
        fetchBills();
        fetchKPIs();
        setShowDetailDrawer(false);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to mark bill as paid');
      }
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      showError('Error marking bill as paid');
    } finally {
      setLoading(false);
    }
  };

  // Get payment status badge class
  const getPaymentBadgeClass = (status) => {
    const statusClasses = {
      'Pending': 'procurement-bills-received-badge-pending',
      'Partially Paid': 'procurement-bills-received-badge-partial',
      'Paid': 'procurement-bills-received-badge-paid'
    };
    return statusClasses[status] || '';
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Add item row
  const handleAddItem = () => {
    if (formData) {
      setFormData({
        ...formData,
        items: [...formData.items, { description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }]
      });
    }
  };

  // Remove item row
  const handleRemoveItem = (index) => {
    if (formData && formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  // Update item
  const handleUpdateItem = (index, field, value) => {
    if (formData) {
      const newItems = [...formData.items];
      newItems[index] = { ...newItems[index], [field]: value };
      setFormData({ ...formData, items: newItems });
    }
  };

  // File input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError('File size exceeds 5MB limit');
        e.target.value = null;
        return;
      }
      
      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        showError('Invalid file type. Only PDF, PNG, JPG allowed');
        e.target.value = null;
        return;
      }
      
      setSelectedFile(file);
    }
  };

  return (
    <div className="procurement-bills-received-container">
      {loading && <CrmPreloader text="Loading bills..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="procurement-bills-received-header">
        <div className="procurement-bills-received-breadcrumb">
          Dashboard &gt; Procurement &gt; Bills Received
        </div>
        <div className="page-header-with-filter">
          <h1 className="procurement-bills-received-title">Bills Received</h1>
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="procurement-bills-received-action-bar">
        <div className="procurement-bills-received-search-filters">
          <input
            type="text"
            placeholder="Search by Bill ID, Vendor, PO ID..."
            className="procurement-bills-received-search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && fetchBills()}
          />

          <select
            className="procurement-bills-received-filter"
            value={filters.paymentStatus}
            onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
          >
            <option value="all">All Payment Status</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="procurement-bills-received-actions">
          <button className="procurement-bills-received-btn-primary" onClick={handleCreateBill}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            Add New Bill
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="procurement-bills-received-kpi-grid">
        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <FileText size={32} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.totalBills}</div>
            <div className="procurement-bills-received-kpi-label">Total Bills</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <DollarSign size={32} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{formatCurrency(kpis.outstandingAmount)}</div>
            <div className="procurement-bills-received-kpi-label">Outstanding Amount</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <Calendar size={32} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.billsThisMonth}</div>
            <div className="procurement-bills-received-kpi-label">Bills This Month</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <CheckCircle size={32} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.paidBills}</div>
            <div className="procurement-bills-received-kpi-label">Fully Paid Bills</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <LinkIcon size={32} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.linkedToPOPercentage}%</div>
            <div className="procurement-bills-received-kpi-label">Bills Linked to POs</div>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="procurement-bills-received-table-container">
        <table className="procurement-bills-received-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedBills.length === bills.length && bills.length > 0}
                />
              </th>
              <th>Bill ID</th>
              <th>Vendor Name</th>
              <th>Linked PO</th>
              <th>Bill Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Paid Amount</th>
              <th>Balance</th>
              <th>Payment Status</th>
              <th>Uploaded By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '40px' }}>
                  <FileText size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                  <p style={{ color: '#64748b', fontSize: '16px' }}>No bills found. Click "Add New Bill" to create one.</p>
                </td>
              </tr>
            ) : (
              bills.map(bill => (
                <tr key={bill.id} className="procurement-bills-received-table-row">
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedBills.includes(bill.id)}
                      onChange={() => handleSelectBill(bill.id)}
                    />
                  </td>
                  <td className="procurement-bills-received-table-id">{bill.billNo}</td>
                  <td className="procurement-bills-received-table-vendor">{bill.vendorName}</td>
                  <td>
                    {bill.poNumber ? (
                      <span className="procurement-bills-received-link">{bill.poNumber}</span>
                    ) : (
                      <span className="procurement-bills-received-no-link">—</span>
                    )}
                  </td>
                  <td>{formatDate(bill.billDate)}</td>
                  <td>{formatDate(bill.dueDate)}</td>
                  <td className="procurement-bills-received-table-amount">{formatCurrency(bill.totalAmount)}</td>
                  <td className="procurement-bills-received-table-paid">{formatCurrency(bill.paidAmount)}</td>
                  <td className="procurement-bills-received-table-balance">
                    {formatCurrency(bill.balanceAmount)}
                  </td>
                  <td>
                    <span className={`procurement-bills-received-badge ${getPaymentBadgeClass(bill.status)}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td>{bill.uploadedByName}</td>
                  <td>
                    <div className="procurement-bills-received-actions-cell">
                      <button
                        className="procurement-bills-received-action-btn"
                        onClick={() => handleViewBill(bill.id)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {bill.status !== 'Paid' && (
                        <>
                          <button
                            className="procurement-bills-received-action-btn"
                            onClick={() => handleEditBill(bill)}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="procurement-bills-received-action-btn"
                            onClick={() => handleAddPayment(bill)}
                            title="Add Payment"
                          >
                            <CreditCard size={16} />
                          </button>
                          <button
                            className="procurement-bills-received-action-btn"
                            onClick={() => handleMarkPaid(bill.id)}
                            title="Mark Paid"
                          >
                            <Check size={16} />
                          </button>
                        </>
                      )}
                      {bill.billFilePath && (
                        <>
                          <button
                            className="procurement-bills-received-action-btn"
                            onClick={() => handleViewFile(bill.id)}
                            title="View File"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="procurement-bills-received-action-btn"
                            onClick={() => handleDownloadFile(bill.id, bill.billFileName)}
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                        </>
                      )}
                      <button
                        className="procurement-bills-received-action-btn"
                        onClick={() => handleDeleteBill(bill.id)}
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
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="procurement-bills-received-pagination">
          <button
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
            disabled={pagination.currentPage === 0}
            className="procurement-bills-received-btn-secondary"
          >
            Previous
          </button>
          <span style={{ padding: '0 16px', color: '#64748b' }}>
            Page {pagination.currentPage + 1} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
            disabled={pagination.currentPage >= pagination.totalPages - 1}
            className="procurement-bills-received-btn-secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Continue in next part with modals... */}
    

      {/* Detail Drawer */}
      {showDetailDrawer && selectedBill && (
        <div className="procurement-bills-received-drawer-overlay" onClick={() => setShowDetailDrawer(false)}>
          <div className="procurement-bills-received-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-bills-received-drawer-header">
              <div>
                <h2>{selectedBill.billNo}</h2>
                <p className="procurement-bills-received-drawer-vendor">{selectedBill.vendorName}</p>
              </div>
              <button className="procurement-bills-received-drawer-close" onClick={() => setShowDetailDrawer(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="procurement-bills-received-drawer-content">
              {/* Status and Dates */}
              <div className="procurement-bills-received-drawer-section">
                <div className="procurement-bills-received-drawer-badges">
                  <span className={`procurement-bills-received-badge ${getPaymentBadgeClass(selectedBill.status)}`}>
                    {selectedBill.status}
                  </span>
                  <span className="procurement-bills-received-drawer-date">
                    Due: {formatDate(selectedBill.dueDate)}
                  </span>
                </div>
              </div>

              {/* Bill Overview */}
              <div className="procurement-bills-received-drawer-section">
                <h3>Bill Overview</h3>
                <div className="procurement-bills-received-info-grid">
                  <div className="procurement-bills-received-info-item">
                    <label>Bill Date:</label>
                    <span>{formatDate(selectedBill.billDate)}</span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Due Date:</label>
                    <span>{formatDate(selectedBill.dueDate)}</span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Total Amount:</label>
                    <span className="procurement-bills-received-amount-highlight">
                      {formatCurrency(selectedBill.totalAmount)}
                    </span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Balance Due:</label>
                    <span className="procurement-bills-received-balance-highlight">
                      {formatCurrency(selectedBill.balanceAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Traceability */}
              {(selectedBill.quotationId || selectedBill.poNumber) && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Traceability</h3>
                  <div className="procurement-bills-received-traceability">
                    {selectedBill.quotationId && (
                      <div className="procurement-bills-received-trace-item">
                        <span className="procurement-bills-received-trace-label">Quotation:</span>
                        <span className="procurement-bills-received-link">{selectedBill.quotationId}</span>
                      </div>
                    )}
                    {selectedBill.poNumber && (
                      <div className="procurement-bills-received-trace-item">
                        <span className="procurement-bills-received-trace-label">Purchase Order:</span>
                        <span className="procurement-bills-received-link">{selectedBill.poNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Line Items */}
              {selectedBill.items && selectedBill.items.length > 0 && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Bill Line Items</h3>
                  <table className="procurement-bills-received-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Tax %</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{item.taxPercent}%</td>
                          <td>{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment Section */}
              <div className="procurement-bills-received-drawer-section">
                <h3>Payment Information</h3>
                <div className="procurement-bills-received-payment-summary">
                  <div className="procurement-bills-received-payment-stat">
                    <label>Total Paid:</label>
                    <span className="procurement-bills-received-paid-amount">
                      {formatCurrency(selectedBill.paidAmount)}
                    </span>
                  </div>
                  <div className="procurement-bills-received-payment-stat">
                    <label>Remaining Balance:</label>
                    <span className="procurement-bills-received-balance-amount">
                      {formatCurrency(selectedBill.balanceAmount)}
                    </span>
                  </div>
                </div>

                {selectedBill.paymentHistory && selectedBill.paymentHistory.length > 0 && (
                  <>
                    <h4>Payment History</h4>
                    <table className="procurement-bills-received-payment-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Mode</th>
                          <th>Reference No.</th>
                          <th>Amount</th>
                          <th>Paid By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBill.paymentHistory.map((payment, idx) => (
                          <tr key={idx}>
                            <td>{formatDate(payment.paymentDate)}</td>
                            <td>{payment.paymentMode}</td>
                            <td>{payment.referenceNumber}</td>
                            <td>{formatCurrency(payment.amount)}</td>
                            <td>{payment.paidByName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* Bill File */}
              {selectedBill.billFilePath && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Bill Document</h3>
                  <div className="procurement-bills-received-attachments">
                    <div className="procurement-bills-received-attachment-item">
                      <FileText size={16} /> {selectedBill.billFileName}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="procurement-bills-received-btn-link"
                          onClick={() => handleViewFile(selectedBill.id)}
                        >
                          <Eye size={14} /> View
                        </button>
                        <button 
                          className="procurement-bills-received-btn-link"
                          onClick={() => handleDownloadFile(selectedBill.id, selectedBill.billFileName)}
                        >
                          <Download size={14} /> Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedBill.notes && (
                <div className="procurement-bills-received-drawer-section">
                  <h3>Notes</h3>
                  <div className="procurement-bills-received-notes">
                    <div className="procurement-bills-received-note-item">
                      {selectedBill.notes}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="procurement-bills-received-drawer-actions">
                {selectedBill.status !== 'Paid' && (
                  <>
                    <button
                      className="procurement-bills-received-btn-primary"
                      onClick={() => {
                        handleAddPayment(selectedBill);
                        setShowDetailDrawer(false);
                      }}
                    >
                      <CreditCard size={18} style={{ marginRight: '8px' }} />
                      Add Payment
                    </button>
                    <button
                      className="procurement-bills-received-btn-secondary"
                      onClick={() => handleEditBill(selectedBill)}
                    >
                      <Edit2 size={18} style={{ marginRight: '8px' }} />
                      Edit Bill
                    </button>
                    <button
                      className="procurement-bills-received-btn-secondary"
                      onClick={() => {
                        handleMarkPaid(selectedBill.id);
                      }}
                    >
                      <Check size={18} style={{ marginRight: '8px' }} />
                      Mark Fully Paid
                    </button>
                  </>
                )}
                {selectedBill.billFilePath && (
                  <button 
                    className="procurement-bills-received-btn-secondary"
                    onClick={() => handleDownloadFile(selectedBill.id, selectedBill.billFileName)}
                  >
                    <Download size={18} style={{ marginRight: '8px' }} />
                    Download PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Bill Modal */}
      {showCreateEditModal && formData && (
        <div className="procurement-bills-received-modal-overlay" onClick={() => setShowCreateEditModal(false)}>
          <div className="procurement-bills-received-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-bills-received-modal-header">
              <h2>{editMode ? 'Edit Bill' : 'Add New Bill'}</h2>
              <button className="procurement-bills-received-modal-close" onClick={() => setShowCreateEditModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="procurement-bills-received-form">
              <div className="procurement-bills-received-form-row">
                <div className="procurement-bills-received-form-group">
                  <label>Vendor ID *</label>
                  <input
                    type="number"
                    value={formData.vendorId || ''}
                    onChange={(e) => setFormData({ ...formData, vendorId: parseInt(e.target.value) })}
                    placeholder="Enter vendor ID"
                  />
                </div>
                <div className="procurement-bills-received-form-group">
                  <label>Linked PO ID</label>
                  <input
                    type="number"
                    value={formData.poId || ''}
                    onChange={(e) => setFormData({ ...formData, poId: parseInt(e.target.value) || null })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="procurement-bills-received-form-row">
                <div className="procurement-bills-received-form-group">
                  <label>Bill Date *</label>
                  <input
                    type="date"
                    value={formData.billDate}
                    onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                  />
                </div>
                <div className="procurement-bills-received-form-group">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Project Hierarchy */}
              <div className="procurement-bills-received-form-row">
                <div className="procurement-bills-received-form-group">
                  <label>Group Name</label>
                  <input
                    type="text"
                    value={formData.groupId || ''}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    placeholder="Group name"
                  />
                </div>
                <div className="procurement-bills-received-form-group">
                  <label>Sub Group Name</label>
                  <input
                    type="text"
                    value={formData.subGroupId || ''}
                    onChange={(e) => setFormData({ ...formData, subGroupId: e.target.value })}
                    placeholder="Sub group name"
                  />
                </div>
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Project ID</label>
                <input
                  type="text"
                  value={formData.projectId || ''}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  placeholder="Project ID"
                />
              </div>

              {/* Items Section */}
              <div className="procurement-bills-received-form-section">
                <div className="procurement-bills-received-section-header">
                  <h3>Line Items</h3>
                  <button className="procurement-bills-received-btn-add-item" onClick={handleAddItem} type="button">
                    + Add Item
                  </button>
                </div>
                <div className="procurement-bills-received-items-form">
                  {formData.items.map((item, index) => (
                    <div key={index} className="procurement-bills-received-item-row">
                      <input
                        type="text"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                        style={{ width: '80px' }}
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        style={{ width: '120px' }}
                      />
                      <input
                        type="number"
                        placeholder="Tax %"
                        value={item.taxPercent}
                        onChange={(e) => handleUpdateItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                        style={{ width: '80px' }}
                      />
                      {formData.items.length > 1 && (
                        <button
                          className="procurement-bills-received-btn-remove-item"
                          onClick={() => handleRemoveItem(index)}
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* File Upload */}
              <div className="procurement-bills-received-form-group">
                <label>Upload Bill (PDF, PNG, JPG - Max 5MB)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p style={{ fontSize: '13px', color: '#22c55e', marginTop: '4px' }}>
                    ✓ {selectedFile.name} selected
                  </p>
                )}
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Notes</label>
                <textarea
                  rows="3"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes..."
                ></textarea>
              </div>
            </div>

            <div className="procurement-bills-received-modal-actions">
              <button className="procurement-bills-received-btn-primary" onClick={handleSaveBill}>
                {editMode ? 'Update Bill' : 'Save Bill'}
              </button>
              <button className="procurement-bills-received-btn-secondary" onClick={() => setShowCreateEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentData && selectedBill && (
        <div className="procurement-bills-received-modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="procurement-bills-received-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-bills-received-modal-header">
              <h2>Add Payment</h2>
              <button className="procurement-bills-received-modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="procurement-bills-received-form">
              <div className="procurement-bills-received-payment-info">
                <div className="procurement-bills-received-info-item">
                  <label>Bill ID:</label>
                  <span>{selectedBill.billNo}</span>
                </div>
                <div className="procurement-bills-received-info-item">
                  <label>Total Balance Due:</label>
                  <span className="procurement-bills-received-balance-highlight">
                    {formatCurrency(selectedBill.balanceAmount)}
                  </span>
                </div>
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Payment Amount *</label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder={`Max: ${selectedBill.balanceAmount}`}
                  max={selectedBill.balanceAmount}
                />
              </div>

              <div className="procurement-bills-received-form-row">
                <div className="procurement-bills-received-form-group">
                  <label>Payment Mode *</label>
                  <select
                    value={paymentData.paymentMode}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div className="procurement-bills-received-form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Reference Number *</label>
                <input
                  type="text"
                  value={paymentData.referenceNumber}
                  onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
                  placeholder="Transaction/Cheque/Reference Number"
                />
              </div>

              <div className="procurement-bills-received-form-group">
                <label>Notes</label>
                <textarea
                  rows="2"
                  value={paymentData.notes || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Add any notes..."
                ></textarea>
              </div>
            </div>

            <div className="procurement-bills-received-modal-actions">
              <button className="procurement-bills-received-btn-primary" onClick={handleSavePayment}>
                Record Payment
              </button>
              <button className="procurement-bills-received-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File View Modal */}
      {showFileViewModal && fileViewUrl && (
        <div className="procurement-bills-received-modal-overlay" onClick={() => setShowFileViewModal(false)}>
          <div className="procurement-bills-received-file-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-bills-received-modal-header">
              <h2>Bill Document</h2>
              <button className="procurement-bills-received-modal-close" onClick={() => setShowFileViewModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div style={{ width: '100%', height: 'calc(100vh - 120px)', overflow: 'auto' }}>
              <iframe
                src={fileViewUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Bill Document"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsReceived;