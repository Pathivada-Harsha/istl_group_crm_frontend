import React, { useState, useEffect } from 'react';
import {
  Search, Plus, X, Edit2, Eye, Check, FileText, Upload,
  Calendar, DollarSign, CheckCircle, CreditCard,
  Link as LinkIcon, Trash2, Download
} from 'lucide-react';
import '../pages-css/Bills-Recieved.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import filterApi from '../services/filterApi';

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

  // Dropdown data
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [projects, setProjects] = useState([]);

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const [filters, setFilters] = useState({
    search: '',
    paymentStatus: 'all'
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

  // Modal dropdown states
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');

  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { user } = useAuth();

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json'
  });

  // Fetch bills and KPIs - API call each time pagination changes
  useEffect(() => {
    fetchBills();
  }, [projectId, groupName, subGroupName, filters.paymentStatus, filters.search, pagination.currentPage, pagination.pageSize]);

  useEffect(() => {
    fetchKPIs();
  }, [projectId, groupName, subGroupName]);

  // Fetch dropdown data when modal opens
  useEffect(() => {
    if (showCreateEditModal) {
      fetchAllDropdownData();
    }
  }, [showCreateEditModal]);

  // Refresh POs when group/subgroup/project changes in modal
  useEffect(() => {
    if (showCreateEditModal && (modalGroupName || modalSubGroupName || modalProjectId)) {
      fetchPurchaseOrders();
    }
  }, [modalGroupName, modalSubGroupName, modalProjectId]);

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
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        setBills(data.bills || []);
        setPagination(prev => ({
          ...prev,
          currentPage: data.currentPage || 0,
          totalPages: data.totalPages || 0,
          totalItems: data.totalItems || 0
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
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        const stats = await response.json();
        setKpis({
          totalBills: stats.totalBills || 0,
          outstandingAmount: stats.outstandingAmount || 0,
          billsThisMonth: stats.billsThisMonth || 0,
          paidBills: stats.paidBills || 0,
          linkedToPOPercentage: stats.linkedToPOPercentage || 0
        });
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  // Fetch all dropdown data
  const fetchAllDropdownData = async () => {
    try {
      await Promise.all([
        fetchVendors(),
        fetchPurchaseOrders(),
        fetchGroups()
      ]);
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const params = new URLSearchParams();
      if (modalGroupName) params.append('groupName', modalGroupName);
      if (modalSubGroupName) params.append('subGroupName', modalSubGroupName);
      if (modalProjectId) params.append('projectId', modalProjectId);

      const response = await fetch(`${API_BASE_URL}/api/vendors/for-bills?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data || []);
        console.log('✅ Loaded vendors (including PO vendors):', data.length);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    }
  };

  const fetchPurchaseOrders = async (vendorIdOrName = null) => {
    try {
      const params = new URLSearchParams();
      if (modalGroupName) params.append('groupName', modalGroupName);
      if (modalSubGroupName) params.append('subGroupName', modalSubGroupName);
      if (modalProjectId) params.append('projectId', modalProjectId);

      // Handle both vendorId (number) and vendorName (string from POs)
      if (vendorIdOrName) {
        if (typeof vendorIdOrName === 'number') {
          params.append('vendorId', vendorIdOrName);
        } else if (typeof vendorIdOrName === 'string' && vendorIdOrName.startsWith('PO_')) {
          // This is a vendor from PO, extract vendor name
          const vendorName = vendorIdOrName.replace('PO_', '');
          params.append('vendorName', vendorName);
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/by-vendor?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data || []);
        console.log('✅ Loaded POs for vendor:', data.length);
      }
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      setPurchaseOrders([]);
    }
  };
  const fetchPOItems = async (poId) => {
    if (!poId) return;

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/purchase-orders/${poId}/items-for-bill`,
        {
          credentials: "include",
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.items && data.items.length > 0) {
          const billItems = data.items.map(item => ({
            poItemId: item.id,
            itemName: item.itemName || '',
            itemSku: item.itemSku || '',
            description: item.description || '',
            orderedQty: item.orderedQty,
            deliveredQty: item.deliveredQty,
            pendingQty: item.pendingQty,
            maxBillableQty: item.pendingQty, // Max = pending delivery
            quantity: item.pendingQty, // Default to full pending
            unitPrice: item.unitPrice || 0,
            taxPercent: item.taxPercent || 18,
            deliveryStatus: item.deliveryStatus
          }));

          setFormData(prev => ({
            ...prev,
            items: billItems
          }));

          showSuccess(
            `✅ Loaded ${billItems.length} items. Enter delivered quantities.`
          );
        } else {
          showError('All items fully delivered');
          setFormData(prev => ({ ...prev, items: [] }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch PO items:', error);
      showError('Failed to load PO items');
    } finally {
      setLoading(false);
    }
  };
  const fetchGroups = async () => {
    try {
      const groups = await filterApi.getAllGroups();
      setGroups(groups || []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setGroups([]);
    }
  };

  const fetchSubGroups = async (groupName) => {
    if (!groupName) {
      setSubGroups([]);
      return;
    }

    try {
      const subGroups = await filterApi.getSubGroups(groupName);
      setSubGroups(subGroups || []);
    } catch (error) {
      console.error('Failed to fetch subgroups:', error);
      setSubGroups([]);
    }
  };

  const fetchProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) {
      setProjects([]);
      return;
    }

    try {
      const projects = await filterApi.getProjects(groupName, subGroupName);
      setProjects(projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  // Handle modal dropdown changes
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setSubGroups([]);
    setProjects([]);
    setPurchaseOrders([]); // Clear POs

    setFormData(prev => ({
      ...prev,
      groupId: newGroupName,
      subGroupId: '',
      projectId: '',
      poId: '', // Clear PO selection
      items: [] // Clear items
    }));

    if (newGroupName) {
      fetchSubGroups(newGroupName);
      fetchVendors(); // Refresh vendors for new group
    }
  };

  const handleModalSubGroupChange = async (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setProjects([]);
    setPurchaseOrders([]);

    setFormData(prev => ({
      ...prev,
      subGroupId: newSubGroupName,
      projectId: '',
      vendorId: '', // ✅ Clear vendor
      poId: '',
      items: []
    }));

    if (modalGroupName && newSubGroupName) {
      await fetchProjects(modalGroupName, newSubGroupName);
      await fetchVendors(); // ✅ Re-fetch vendors!
    }
  };

  const handleModalProjectChange = async (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setPurchaseOrders([]);

    setFormData(prev => ({
      ...prev,
      projectId: newProjectId,
      vendorId: '', // ✅ Clear vendor
      poId: '',
      items: []
    }));

    if (newProjectId) {
      await fetchVendors(); // ✅ Re-fetch vendors for project!
    }
  };
  const handleVendorChange = (e) => {
    const vendorIdOrName = e.target.value;

    setFormData(prev => ({
      ...prev,
      vendorId: vendorIdOrName,
      poId: '', // Clear PO selection
      items: [] // Clear items
    }));

    setPurchaseOrders([]); // Clear POs

    if (vendorIdOrName) {
      // Fetch POs for this vendor
      const vendorId = typeof vendorIdOrName === 'string' && !vendorIdOrName.startsWith('PO_')
        ? parseInt(vendorIdOrName)
        : vendorIdOrName;
      fetchPurchaseOrders(vendorId);
    }
  };
  const handlePOChange = (e) => {
    const poId = e.target.value;

    setFormData(prev => ({
      ...prev,
      poId: poId ? parseInt(poId) : null,
      items: [] // Clear existing items
    }));

    if (poId) {
      fetchPOItems(parseInt(poId));
    }
  };
  // Pagination handlers
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
  };

  const handlePageSizeChange = (e) => {
    setPagination(prev => ({
      ...prev,
      pageSize: parseInt(e.target.value),
      currentPage: 0 // Reset to first page
    }));
  };

  // Checkbox selection
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
        headers: getAuthHeaders(),
        credentials: "include"
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
      vendorId: '',
      poId: '',
      billNo: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      projectId: projectId || '',
      groupId: groupName || '',
      subGroupId: subGroupName || '',
      items: [{
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercent: 18
      }],
      notes: ''
    });

    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalProjectId(projectId || '');

    setSelectedFile(null);
    setShowCreateEditModal(true);
      fetchAllDropdownData();
  };

  // Edit bill
  const handleEditBill = (bill) => {
    setEditMode(true);
    setFormData({
      ...bill,
      billDate: bill.billDate ? bill.billDate.split('T')[0] : '',
      dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : ''
    });

    setModalGroupName(bill.groupId || '');
    setModalSubGroupName(bill.subGroupId || '');
    setModalProjectId(bill.projectId || '');

    // Fetch dropdowns for edit mode
    if (bill.groupId) {
      fetchSubGroups(bill.groupId);
      if (bill.subGroupId) {
        fetchProjects(bill.groupId, bill.subGroupId);
      }
    }

    setShowDetailDrawer(false);
    setShowCreateEditModal(true);
  };

  // Delete bill
  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/${billId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        showSuccess('Bill deleted successfully');
        fetchBills();
        fetchKPIs();
        setShowDetailDrawer(false);
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
    // Validation
    if (!formData.vendorId || formData.vendorId === '') {
      showError('Please select a vendor');
      return;
    }

    if (!formData.billDate) {
      showError('Please select bill date');
      return;
    }

    if (!formData.dueDate) {
      showError('Please select due date');
      return;
    }

    if (formData.items.length === 0) {
      showError('Please add at least one item');
      return;
    }

    // Validate items
    for (let item of formData.items) {
      // if (!item.description || item.description.trim() === '') {
      //   showError('Please enter description for all items');
      //   return;
      // }
      if (!item.quantity || item.quantity <= 0) {
        showError('Please enter valid quantity for all items');
        return;
      }
      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
        showError('Please enter valid price for all items');
        return;
      }
    }

    setLoading(true);
    try {
      const method = editMode ? 'PUT' : 'POST';
      const url = editMode
        ? `${API_BASE_URL}/api/bills/${formData.id}`
        : `${API_BASE_URL}/api/bills`;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        credentials: "include",
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
        showError(errorData.error || errorData.message || 'Failed to save bill');
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      showError('Error saving bill: ' + error.message);
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
        method: 'POST',
        headers,
        credentials: "include",
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
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: "include",
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
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: "include"
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
        items: [...formData.items, {
          itemName: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxPercent: 18
        }]
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

  // Calculate line total for an item
  const calculateLineTotal = (item) => {
    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
    const tax = subtotal * ((item.taxPercent || 0) / 100);
    return subtotal + tax;
  };

  // Calculate bill total
  const calculateBillTotal = () => {
    if (!formData || !formData.items) return 0;
    return formData.items.reduce((total, item) => total + calculateLineTotal(item), 0);
  };

  return (
    <div className="procurement-bills-received-container">
      {loading && <CrmPreloader text="Loading..." />}
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
            placeholder="Search by Bill ID, Vendor..."
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

        {/* PAGINATION - NEW UI */}
        {pagination.totalPages > 0 && (
          <div className="procurement-bills-received-pagination">
            <div className="pagination-info">
              <span>
                Showing {pagination.currentPage * pagination.pageSize + 1} to{' '}
                {Math.min((pagination.currentPage + 1) * pagination.pageSize, pagination.totalItems)} of{' '}
                {pagination.totalItems} bills
              </span>
              <select
                className="page-size-selector"
                value={pagination.pageSize}
                onChange={handlePageSizeChange}
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>

            <div className="pagination-controls">
              <button
                onClick={() => handlePageChange(0)}
                disabled={pagination.currentPage === 0}
                className="procurement-bills-received-btn-secondary"
                title="First Page"
              >
                «
              </button>
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 0}
                className="procurement-bills-received-btn-secondary"
              >
                ‹ Previous
              </button>

              <span className="page-numbers">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i;
                  } else if (pagination.currentPage < 3) {
                    pageNum = i;
                  } else if (pagination.currentPage > pagination.totalPages - 3) {
                    pageNum = pagination.totalPages - 5 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`page-number ${pagination.currentPage === pageNum ? 'active' : ''}`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </span>

              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages - 1}
                className="procurement-bills-received-btn-secondary"
              >
                Next ›
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages - 1)}
                disabled={pagination.currentPage >= pagination.totalPages - 1}
                className="procurement-bills-received-btn-secondary"
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>


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
              {/* Project Assignment Section */}
              <div className="procurement-bills-received-form-section">
                <h3>Project Assignment</h3>
                <div className="procurement-bills-received-form-row">
                  <div className="procurement-bills-received-form-group">
                    <label>Group</label>
                    <select value={modalGroupName} onChange={handleModalGroupChange}>
                      <option value="">Select Group</option>
                      {groups.map(group => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="procurement-bills-received-form-group">
                    <label>Sub Group</label>
                    <select
                      value={modalSubGroupName}
                      onChange={handleModalSubGroupChange}
                      disabled={!modalGroupName}
                    >
                      <option value="">{!modalGroupName ? 'Select Group First' : 'Select Sub Group'}</option>
                      {subGroups.map(subGroup => (
                        <option key={subGroup.value} value={subGroup.value}>
                          {subGroup.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="procurement-bills-received-form-group">
                  <label>Project (Optional)</label>
                  <select
                    value={modalProjectId}
                    onChange={handleModalProjectChange}
                    disabled={!modalSubGroupName}
                  >
                    <option value="">{!modalSubGroupName ? 'Select Sub Group First' : 'Select Project (Optional)'}</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name} - {project.location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vendor and PO Selection */}
              <div className="procurement-bills-received-form-section">
                <h3>Vendor & Purchase Order</h3>
                <div className="procurement-bills-received-form-row">
                  <div className="procurement-bills-received-form-group">
                    <label>Vendor *</label>
                    <select
                      value={formData.vendorId || ''}
                      onChange={handleVendorChange} // UPDATED: Use new handler
                      required
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor, index) => (
                        <option key={vendor.id || index} value={vendor.id}>
                          {vendor.name}
                          {vendor.contact && ` - ${vendor.contact}`}
                          {vendor.source === 'po_vendor' && ' (From PO)'}
                        </option>
                      ))}
                    </select>
                    {vendors.length === 0 && (
                      <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                        No vendors available for selected project. Create a PO with new vendor first.
                      </small>
                    )}
                  </div>

                  <div className="procurement-bills-received-form-group">
                    <label>Linked PO (Optional)</label>
                    <select
                      value={formData.poId || ''}
                      onChange={handlePOChange} // UPDATED: Use new handler
                    >
                      <option value="">No PO Link</option>
                      {purchaseOrders.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.poNo} - {po.vendorName} - {formatCurrency(po.totalValue)}
                        </option>
                      ))}
                    </select>
                    {formData.vendorId && purchaseOrders.length === 0 && (
                      <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                        No POs found for selected vendor
                      </small>
                    )}
                    {formData.poId && (
                      <small style={{ color: '#22c55e', fontSize: '12px', marginTop: '4px' }}>
                        ✓ PO items loaded below
                      </small>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="procurement-bills-received-form-section">
                <h3>Bill Dates</h3>
                <div className="procurement-bills-received-form-row">
                  <div className="procurement-bills-received-form-group">
                    <label>Bill Date *</label>
                    <input
                      type="date"
                      value={formData.billDate}
                      onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="procurement-bills-received-form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Items Section - FIXED TABLE ALIGNMENT */}
              <div className="procurement-bills-received-form-section">
                <div className="procurement-bills-received-section-header">
                  <h3>Bill Line Items</h3>
                  <button
                    className="procurement-bills-received-btn-add-item"
                    onClick={handleAddItem}
                    type="button"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="procurement-bills-received-items-form">
                  {/* FIXED: Table with proper alignment */}
                  <table className="bills-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Item Name</th>
                        <th style={{ width: '25%' }}>Description * {formData.poId && '(From PO)'}</th>
                        <th style={{ width: '10%' }}>Qty *</th>
                        <th style={{ width: '15%' }}>Price *</th>
                        <th style={{ width: '10%' }}>Tax %</th>
                        <th style={{ width: '15%' }}>Line Total</th>
                        <th style={{ width: '10%' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index} className="bills-item-row">
                          <td>
                            <input
                              type="text"
                              placeholder="Item name"
                              value={item.itemName || ''}
                              onChange={(e) => handleUpdateItem(index, 'itemName', e.target.value)}
                              className="item-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder={item.poItemId ? "From PO" : "Description"}
                              value={item.description || ''}
                              onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                              className="item-input"
                              readOnly={!!item.poItemId} // Make read-only if from PO
                              style={{
                                backgroundColor: item.poItemId ? '#f8fafc' : 'white',
                                cursor: item.poItemId ? 'not-allowed' : 'text'
                              }}
                            />
                            {item.poItemId && (
                              <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                PO Item #{item.poItemId}
                              </small>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity || ''}
                              onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="item-input"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              placeholder="Price"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="item-input"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              placeholder="Tax %"
                              value={item.taxPercent || ''}
                              onChange={(e) => handleUpdateItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                              className="item-input"
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <span className="line-total-display">
                              {formatCurrency(calculateLineTotal(item))}
                            </span>
                          </td>
                          <td>
                            {formData.items.length > 1 && (
                              <button
                                className="procurement-bills-received-btn-remove-item"
                                onClick={() => handleRemoveItem(index)}
                                type="button"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bill Total */}
                <div className="procurement-bills-received-bill-total">
                  <strong>Total Bill Amount:</strong>
                  <span className="total-amount">{formatCurrency(calculateBillTotal())}</span>
                </div>
              </div>

              {/* File Upload */}
              <div className="procurement-bills-received-form-section">
                <h3>Attach Bill Document</h3>
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
              </div>

              {/* Notes */}
              <div className="procurement-bills-received-form-section">
                <h3>Additional Notes</h3>
                <div className="procurement-bills-received-form-group">
                  <label>Notes (Optional)</label>
                  <textarea
                    rows="3"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="procurement-bills-received-modal-actions">
              <button className="procurement-bills-received-btn-primary" onClick={handleSaveBill}>
                {editMode ? 'Update Bill' : 'Create Bill'}
              </button>
              <button className="procurement-bills-received-btn-secondary" onClick={() => setShowCreateEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                        <th>Item Name</th>
                        <th>Description</th>
                        <th>Ordered</th>
                        <th>Delivered</th>
                        <th>Pending</th>
                        <th>Deliver Qty *</th>
                        <th>Price</th>
                        <th>Tax %</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td>
                            {item.itemName}
                            {item.deliveryStatus && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {item.deliveryStatus}
                              </div>
                            )}
                          </td>
                          <td>{item.description}</td>
                          <td>{item.orderedQty}</td>
                          <td style={{ color: '#64748b' }}>{item.deliveredQty}</td>
                          <td style={{ color: '#22c55e', fontWeight: '600' }}>
                            {item.pendingQty}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                              max={item.maxBillableQty}
                              min="0"
                              step="0.01"
                            />
                            <small>Max: {item.pendingQty}</small>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.unitPrice}
                              readOnly
                              style={{ backgroundColor: '#f8fafc' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.taxPercent}
                              readOnly
                              style={{ backgroundColor: '#f8fafc' }}
                            />
                          </td>
                          <td>{formatCurrency(calculateLineTotal(item))}</td>
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