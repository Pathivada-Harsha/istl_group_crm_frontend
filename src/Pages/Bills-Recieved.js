import React, { useState, useEffect } from 'react';
import {
  Search, Plus, X, Edit2, Eye, Check, FileText, Upload,
  Calendar, DollarSign, IndianRupee,CheckCircle, CreditCard,
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
import ConfirmationModal from '../components/ConfirmationModal';

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

  // MODAL-SPECIFIC dropdown data (completely independent from main filters)
  const [modalVendors, setModalVendors] = useState([]);
  const [modalPurchaseOrders, setModalPurchaseOrders] = useState([]);
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const [filters, setFilters] = useState({
    search: '',
    paymentStatus: 'all'
  });

  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalItems: 0,
    pageSize: 10
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

  // Modal dropdown states (completely independent)
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null
  });

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

  // Fetch bills and KPIs
  useEffect(() => {
    fetchBills();
  }, [projectId, groupName, subGroupName, filters.paymentStatus, filters.search, pagination.currentPage, pagination.pageSize]);

  useEffect(() => {
    fetchKPIs();
  }, [projectId, groupName, subGroupName]);

  // Fetch MODAL dropdown data when modal opens
  useEffect(() => {
    if (showCreateEditModal) {
      fetchModalGroups();
    }
  }, [showCreateEditModal]);

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

  // ========== MODAL DROPDOWN FUNCTIONS (COMPLETELY INDEPENDENT) ==========
  
  const fetchModalVendors = async () => {
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
        setModalVendors(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch modal vendors:', error);
      setModalVendors([]);
    }
  };

  const fetchModalPurchaseOrders = async (vendorIdOrName = null) => {
    try {
      const params = new URLSearchParams();
      if (modalGroupName) params.append('groupName', modalGroupName);
      if (modalSubGroupName) params.append('subGroupName', modalSubGroupName);
      if (modalProjectId) params.append('projectId', modalProjectId);

      if (vendorIdOrName) {
        if (typeof vendorIdOrName === 'number') {
          params.append('vendorId', vendorIdOrName);
        } else if (typeof vendorIdOrName === 'string' && vendorIdOrName.startsWith('PO_')) {
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
        setModalPurchaseOrders(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch modal purchase orders:', error);
      setModalPurchaseOrders([]);
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
            maxBillableQty: item.pendingQty,
            quantity: item.pendingQty,
            unitPrice: item.unitPrice || 0,
            taxPercent: item.taxPercent || 18,
            deliveryStatus: item.deliveryStatus
          }));

          setFormData(prev => ({
            ...prev,
            items: billItems
          }));

          showSuccess(`✅ Loaded ${billItems.length} items. Enter delivered quantities.`);
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

  const fetchModalGroups = async () => {
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups || []);
    } catch (error) {
      console.error('Failed to fetch modal groups:', error);
      setModalGroups([]);
    }
  };

  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) {
      setModalSubGroups([]);
      return;
    }

    try {
      const subGroups = await filterApi.getSubGroups(groupName);
      setModalSubGroups(subGroups || []);
    } catch (error) {
      console.error('Failed to fetch modal subgroups:', error);
      setModalSubGroups([]);
    }
  };

  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) {
      setModalProjects([]);
      return;
    }

    try {
      const projects = await filterApi.getProjects(groupName, subGroupName);
      setModalProjects(projects || []);
    } catch (error) {
      console.error('Failed to fetch modal projects:', error);
      setModalProjects([]);
    }
  };

  // ========== MODAL DROPDOWN HANDLERS (COMPLETELY INDEPENDENT) ==========

  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setModalPurchaseOrders([]);
    setModalVendors([]);

    setFormData(prev => ({
      ...prev,
      groupId: newGroupName,
      subGroupId: '',
      projectId: '',
      vendorId: '',
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));

    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
    }
  };

  const handleModalSubGroupChange = async (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setModalProjects([]);
    setModalPurchaseOrders([]);
    setModalVendors([]);

    setFormData(prev => ({
      ...prev,
      subGroupId: newSubGroupName,
      projectId: '',
      vendorId: '',
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));

    if (modalGroupName && newSubGroupName) {
      await fetchModalProjects(modalGroupName, newSubGroupName);
    }
  };

  const handleModalProjectChange = async (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setModalPurchaseOrders([]);
    setModalVendors([]);

    setFormData(prev => ({
      ...prev,
      projectId: newProjectId,
      vendorId: '',
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));

    if (newProjectId) {
      await fetchModalVendors();
    }
  };

  const handleModalVendorChange = (e) => {
    const vendorIdOrName = e.target.value;

    setFormData(prev => ({
      ...prev,
      vendorId: vendorIdOrName,
      poId: '',
      items: prev.items.filter(item => !item.poItemId)
    }));

    setModalPurchaseOrders([]);

    if (vendorIdOrName) {
      const vendorId = typeof vendorIdOrName === 'string' && !vendorIdOrName.startsWith('PO_')
        ? parseInt(vendorIdOrName)
        : vendorIdOrName;
      fetchModalPurchaseOrders(vendorId);
    }
  };

  const handleModalPOChange = (e) => {
    const poId = e.target.value;

    setFormData(prev => ({
      ...prev,
      poId: poId ? parseInt(poId) : null,
      items: prev.items.filter(item => !item.poItemId)
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
      currentPage: 0
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

  // ========== VIEW BILL ==========
  const handleViewBill = async (billId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/${billId}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        const bill = await response.json();
        if (!bill.items) bill.items = [];
        if (!bill.paymentHistory) bill.paymentHistory = [];
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

  // ========== CREATE BILL ==========
  const handleCreateBill = () => {
    setEditMode(false);
    
    setFormData({
      vendorId: '',
      poId: '',
      billNo: '',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      projectId: '',
      groupId: '',
      subGroupId: '',
      items: [{
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercent: 18
      }],
      notes: ''
    });

    setModalGroupName('');
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setModalVendors([]);
    setModalPurchaseOrders([]);

    setSelectedFile(null);
    setShowCreateEditModal(true);
    fetchModalGroups();
  };

  // ========== EDIT BILL ==========
  const handleEditBill = async (bill) => {
    setEditMode(true);
    setLoading(true);
    
    try {
      setModalGroupName(bill.groupId || '');
      setModalSubGroupName(bill.subGroupId || '');
      setModalProjectId(bill.projectId || '');
      
      setModalSubGroups([]);
      setModalProjects([]);
      setModalVendors([]);
      setModalPurchaseOrders([]);
      
      await fetchModalGroups();
      
      if (bill.groupId) {
        await fetchModalSubGroups(bill.groupId);
        if (bill.subGroupId) {
          await fetchModalProjects(bill.groupId, bill.subGroupId);
        }
      }
      
      if (bill.projectId || bill.subGroupId) {
        await fetchModalVendors();
      }
      
      if (bill.vendorId) {
        await fetchModalPurchaseOrders(bill.vendorId);
      }
      
      let enrichedItems = bill.items && bill.items.length > 0 ? [...bill.items] : [{
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercent: 18
      }];
      
      if (bill.poId && bill.items && bill.items.length > 0) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/purchase-orders/${bill.poId}/items-for-bill`,
            {
              credentials: "include",
              headers: getAuthHeaders()
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.items) {
              enrichedItems = bill.items.map(billItem => {
                if (billItem.poItemId) {
                  const poItem = data.items.find(pi => pi.id === billItem.poItemId);
                  if (poItem) {
                    return {
                      ...billItem,
                      orderedQty: poItem.orderedQty,
                      deliveredQty: poItem.deliveredQty,
                      pendingQty: poItem.pendingQty,
                      maxBillableQty: (billItem.quantity || 0) + (poItem.pendingQty || 0),
                      originalBillQty: billItem.quantity,
                      deliveryStatus: poItem.deliveryStatus
                    };
                  }
                }
                return billItem;
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch PO items for edit:', error);
        }
      }
      
      setFormData({
        ...bill,
        billDate: bill.billDate ? bill.billDate.split('T')[0] : '',
        dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : '',
        items: enrichedItems
      });

      setShowDetailDrawer(false);
      setShowCreateEditModal(true);
      
    } catch (error) {
      console.error('Error in handleEditBill:', error);
      showError('Failed to load bill for editing');
    } finally {
      setLoading(false);
    }
  };

  // ========== DELETE BILL ==========
  const handleDeleteBill = (billId) => {
    setConfirmModal({
      show: true,
      title: 'Delete Bill',
      message: 'Are you sure you want to delete this bill? This action cannot be undone.',
      type: 'error',
      onConfirm: () => performDeleteBill(billId)
    });
  };

  const performDeleteBill = async (billId) => {
    setConfirmModal({ show: false });
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

  // ========== SAVE BILL ==========
  const handleSaveBill = async () => {
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

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      
      if (!item.quantity || item.quantity <= 0) {
        showError(`Item ${i + 1}: Please enter valid quantity`);
        return;
      }
      
      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
        showError(`Item ${i + 1}: Please enter valid price`);
        return;
      }
      
      if (editMode && item.poItemId && item.maxBillableQty) {
        if (item.quantity > item.maxBillableQty) {
          showError(
            `Item ${i + 1}: Quantity (${item.quantity}) exceeds maximum allowed (${item.maxBillableQty}). ` +
            `You can bill up to: Original bill qty (${item.originalBillQty || 0}) + Pending (${item.pendingQty || 0})`
          );
          return;
        }
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

  // ========== MARK AS PAID ==========
  const handleMarkPaid = (billId) => {
    setConfirmModal({
      show: true,
      title: 'Mark Bill as Paid',
      message: 'Mark this bill as fully paid?',
      type: 'confirm',
      onConfirm: () => performMarkPaid(billId)
    });
  };

  const performMarkPaid = async (billId) => {
    setConfirmModal({ show: false });
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

  // ========== INDIAN NUMBER FORMAT (SHORT) ==========
  // Converts: 1000 → 1K, 100000 → 1L, 10000000 → 1Cr
  const formatIndianShort = (amount) => {
    const num = parseFloat(amount) || 0;
    if (num >= 10000000) {
      // Crore: 1,00,00,000+
      const val = num / 10000000;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)} Cr`;
    } else if (num >= 100000) {
      // Lakh: 1,00,000+
      const val = num / 100000;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)} L`;
    } else if (num >= 1000) {
      // Thousand: 1,000+
      const val = num / 1000;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} K`;
    } else {
      return num.toLocaleString('en-IN');
    }
  };

  // Full Indian format (for tables and details): 1,14,59,385.6
  const formatCurrency = (amount) => {
    return `${(parseFloat(amount) || 0).toLocaleString('en-IN')}`;
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
      
      {/* CONFIRMATION MODAL */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ show: false })}
      />

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
            <FileText size={28} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.totalBills}</div>
            <div className="procurement-bills-received-kpi-label">Total Bills</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <IndianRupee size={28} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            {/* ✅ INDIAN SHORT FORMAT for KPI: shows 1L, 1Cr etc. */}
            <div
              className="procurement-bills-received-kpi-value"
              title={`₹${formatCurrency(kpis.outstandingAmount)}`}
            >
              {formatIndianShort(kpis.outstandingAmount)}
            </div>
            <div className="procurement-bills-received-kpi-label">Outstanding Amount</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <Calendar size={28} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.billsThisMonth}</div>
            <div className="procurement-bills-received-kpi-label">Bills This Month</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <CheckCircle size={28} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.paidBills}</div>
            <div className="procurement-bills-received-kpi-label">Fully Paid Bills</div>
          </div>
        </div>

        <div className="procurement-bills-received-kpi-card">
          <div className="procurement-bills-received-kpi-icon">
            <LinkIcon size={28} />
          </div>
          <div className="procurement-bills-received-kpi-content">
            <div className="procurement-bills-received-kpi-value">{kpis.linkedToPOPercentage}%</div>
            <div className="procurement-bills-received-kpi-label">Bills Linked to POs</div>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="procurement-bills-received-table-container">
        {/* ✅ Fixed-height scrollable wrapper */}
        <div className="procurement-bills-received-table-scroll-wrapper">
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
                  <td colSpan="12" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FileText size={48} style={{ color: '#cbd5e1', marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
                      No bills found. Click "Add New Bill" to create one.
                    </p>
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

        {/* Pagination - outside scroll wrapper so it's always visible */}
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
                <option value="10">10 Rows</option>
                <option value="20">20 Rows</option>
                <option value="50">50 Rows</option>
                <option value="100">100 Rows</option>
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
                Previous
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
                Next
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

      {/* CREATE/EDIT MODAL */}
      {showCreateEditModal && formData && (
        <div className="bill-form-modal-overlay" onClick={() => setShowCreateEditModal(false)}>
          <div className="bill-form-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="bill-form-modal-header">
              <h2>{editMode ? 'Edit Bill' : 'Create New Bill'}</h2>
              <button className="bill-form-modal-close-btn" onClick={() => setShowCreateEditModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="bill-form-modal-content">
              {/* Project Assignment Section */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Project Assignment</h3>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Group</label>
                    <select 
                      className="bill-form-select"
                      value={modalGroupName} 
                      onChange={handleModalGroupChange}
                    >
                      <option value="">Select Group</option>
                      {modalGroups.map(group => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bill-form-field">
                    <label className="bill-form-label">Sub Group</label>
                    <select
                      className="bill-form-select"
                      value={modalSubGroupName}
                      onChange={handleModalSubGroupChange}
                      disabled={!modalGroupName}
                    >
                      <option value="">{!modalGroupName ? 'Select Group First' : 'Select Sub Group'}</option>
                      {modalSubGroups.map(subGroup => (
                        <option key={subGroup.value} value={subGroup.value}>
                          {subGroup.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bill-form-field">
                  <label className="bill-form-label">Project (Optional)</label>
                  <select
                    className="bill-form-select"
                    value={modalProjectId}
                    onChange={handleModalProjectChange}
                    disabled={!modalSubGroupName}
                  >
                    <option value="">{!modalSubGroupName ? 'Select Sub Group First' : 'Select Project (Optional)'}</option>
                    {modalProjects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name} - {project.location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vendor and PO Selection */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Vendor & Purchase Order</h3>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Vendor *</label>
                    <select
                      className="bill-form-select"
                      value={formData.vendorId || ''}
                      onChange={handleModalVendorChange}
                      required
                    >
                      <option value="">Select Vendor</option>
                      {modalVendors.map((vendor, index) => (
                        <option key={vendor.id || index} value={vendor.id}>
                          {vendor.name}
                          {vendor.contact && ` - ${vendor.contact}`}
                          {vendor.source === 'po_vendor' && ' (From PO)'}
                        </option>
                      ))}
                    </select>
                    {modalVendors.length === 0 && modalProjectId && (
                      <small className="bill-form-hint-error">
                        No vendors available for selected project. Select project or create a PO first.
                      </small>
                    )}
                  </div>

                  <div className="bill-form-field">
                    <label className="bill-form-label">Linked PO (Optional)</label>
                    <select
                      className="bill-form-select"
                      value={formData.poId || ''}
                      onChange={handleModalPOChange}
                    >
                      <option value="">No PO Link</option>
                      {modalPurchaseOrders.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.poNo} - {po.vendorName} - {formatCurrency(po.totalValue)}
                        </option>
                      ))}
                    </select>
                    {formData.vendorId && modalPurchaseOrders.length === 0 && (
                      <small className="bill-form-hint">No POs found for selected vendor</small>
                    )}
                    {formData.poId && (
                      <small className="bill-form-hint-success">✓ PO items loaded below</small>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Bill Dates</h3>
                <div className="bill-form-row">
                  <div className="bill-form-field">
                    <label className="bill-form-label">Bill Date *</label>
                    <input
                      className="bill-form-input"
                      type="date"
                      value={formData.billDate}
                      onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="bill-form-field">
                    <label className="bill-form-label">Due Date *</label>
                    <input
                      className="bill-form-input"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="bill-form-section">
                <div className="bill-form-section-header">
                  <h3 className="bill-form-section-title">Bill Line Items</h3>
                  {!editMode && (
                    <button
                      className="bill-form-add-item-btn"
                      onClick={handleAddItem}
                      type="button"
                    >
                      + Add Item
                    </button>
                  )}
                </div>

                <div className="bill-form-items-table-container">
                  <table className="bill-form-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Item Name</th>
                        <th style={{ width: '20%' }}>Description</th>
                        {editMode && <th style={{ width: '8%' }}>Ordered</th>}
                        {editMode && <th style={{ width: '8%' }}>Delivered</th>}
                        {editMode && <th style={{ width: '8%' }}>Pending</th>}
                        <th style={{ width: editMode ? '10%' : '12%' }}>Bill Qty *</th>
                        <th style={{ width: editMode ? '10%' : '12%' }}>Price *</th>
                        <th style={{ width: '8%' }}>Tax %</th>
                        <th style={{ width: '13%' }}>Line Total</th>
                        {!editMode && <th style={{ width: '10%' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items && formData.items.map((item, index) => (
                        <tr key={index} className="bill-form-item-row">
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="text"
                              placeholder="Item name"
                              value={item.itemName || ''}
                              onChange={(e) => handleUpdateItem(index, 'itemName', e.target.value)}
                              readOnly={!!item.poItemId}
                              style={{
                                backgroundColor: item.poItemId ? '#f8fafc' : 'white',
                                cursor: item.poItemId ? 'not-allowed' : 'text'
                              }}
                            />
                          </td>
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="text"
                              placeholder={item.poItemId ? "From PO" : "Description"}
                              value={item.description || ''}
                              onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                              readOnly={!!item.poItemId}
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
                          {editMode && (
                            <>
                              <td style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                                {item.orderedQty || '-'}
                              </td>
                              <td style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                                {item.deliveredQty || '-'}
                              </td>
                              <td style={{ color: '#22c55e', fontSize: '13px', textAlign: 'center', fontWeight: '600' }}>
                                {item.pendingQty || '-'}
                              </td>
                            </>
                          )}
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="number"
                              placeholder="Qty"
                              value={item.quantity || ''}
                              onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              max={item.maxBillableQty || undefined}
                              step="0.01"
                              readOnly={editMode && !item.poItemId}
                            />
                            {editMode && item.maxBillableQty && (
                              <small style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginTop: '2px' }}>
                                Max: {item.maxBillableQty}
                              </small>
                            )}
                          </td>
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="number"
                              placeholder="Price"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              readOnly={!!item.poItemId}
                              style={{ backgroundColor: item.poItemId ? '#f8fafc' : 'white' }}
                            />
                          </td>
                          <td>
                            <input
                              className="bill-form-table-input"
                              type="number"
                              placeholder="Tax %"
                              value={item.taxPercent || ''}
                              onChange={(e) => handleUpdateItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <span className="bill-form-line-total">
                              {formatCurrency(calculateLineTotal(item))}
                            </span>
                          </td>
                          {!editMode && (
                            <td>
                              {formData.items.length > 1 && (
                                <button
                                  className="bill-form-remove-item-btn"
                                  onClick={() => handleRemoveItem(index)}
                                  type="button"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bill Total */}
                <div className="bill-form-total-row">
                  <strong>Total Bill Amount:</strong>
                  <span className="bill-form-total-amount">{formatCurrency(calculateBillTotal())}</span>
                </div>
                
                {editMode && formData.poId && (
                  <div className="bill-form-edit-warning">
                    <strong>⚠️ Edit Mode:</strong> You can adjust quantities within the available limits shown above. Price and tax are locked for PO items.
                  </div>
                )}
              </div>

              {/* File Upload */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Attach Bill Document</h3>
                <div className="bill-form-field">
                  <label className="bill-form-label">Upload Bill (PDF, PNG, JPG - Max 5MB)</label>
                  <input
                    className="bill-form-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                  {selectedFile && (
                    <p className="bill-form-file-selected">✓ {selectedFile.name} selected</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="bill-form-section">
                <h3 className="bill-form-section-title">Additional Notes</h3>
                <div className="bill-form-field">
                  <label className="bill-form-label">Notes (Optional)</label>
                  <textarea
                    className="bill-form-textarea"
                    rows="3"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="bill-form-modal-actions">
              <button className="bill-form-save-btn" onClick={handleSaveBill}>
                {editMode ? 'Update Bill' : 'Create Bill'}
              </button>
              <button className="bill-form-cancel-btn" onClick={() => setShowCreateEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
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
                      ₹{formatCurrency(selectedBill.totalAmount)}
                    </span>
                  </div>
                  <div className="procurement-bills-received-info-item">
                    <label>Balance Due:</label>
                    <span className="procurement-bills-received-balance-highlight">
                      ₹{formatCurrency(selectedBill.balanceAmount)}
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
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Tax %</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.items.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <strong>{item.itemName || 'N/A'}</strong>
                            {item.poItemId && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                PO Item #{item.poItemId}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '13px', color: '#64748b' }}>
                            {item.description || '-'}
                          </td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{item.taxPercent}%</td>
                          <td>{formatCurrency(item.lineTotal || calculateLineTotal(item))}</td>
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
                      ₹{formatCurrency(selectedBill.paidAmount)}
                    </span>
                  </div>
                  <div className="procurement-bills-received-payment-stat">
                    <label>Remaining Balance:</label>
                    <span className="procurement-bills-received-balance-amount">
                      ₹{formatCurrency(selectedBill.balanceAmount)}
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
                            <td>₹{formatCurrency(payment.amount)}</td>
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} /> {selectedBill.billFileName}
                      </span>
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
                      onClick={() => handleMarkPaid(selectedBill.id)}
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
                    ₹{formatCurrency(selectedBill.balanceAmount)}
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
            <div style={{ width: '100%', height: 'calc(100% - 73px)', overflow: 'auto' }}>
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