import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, X, Edit2, Eye, Check, XCircle, FileText, Upload, Calendar, DollarSign, TrendingUp, Clock, Package, CheckCircle, Star, AlertCircle, ShoppingCart, Trash2 } from 'lucide-react';
import '../pages-css/Procurement-Quatation-Recieved.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import filterApi from '../services/filterApi';
const API_BASE_URL = process.env.REACT_APP_API_URL;

const QuotationsReceived = () => {
  const [quotations, setQuotations] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCreatePOFromQuotationModal, setShowCreatePOFromQuotationModal] = useState(false);
  const [poFormData, setPOFormData] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all'
  });
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Detail drawer and modals
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [showUploadQuotationModal, setShowUploadQuotationModal] = useState(false);
  const [quotationFormData, setQuotationFormData] = useState(null);
  const [stats, setStats] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false); // NEW: Track edit mode

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Modal dropdown state for project assignment
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

  // Vendor state
  const [vendors, setVendors] = useState([]);
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null);

  // Extract permissions
  const canView = 'VIEW';
  const canCreate = 'CREATE';
  const canEdit = 'EDIT';
  const canApprove = 'APPROVE';
  const canDelete = 'DELETE'; // NEW: Delete permission

  // Fetch quotations on mount and filter change
  useEffect(() => {
  if (canView) {
    fetchQuotations();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search]);
  // Fetch stats on mount
  useEffect(() => {
  if (canView) {
    fetchStats();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [groupName, subGroupName, projectId]); // Add filter dependencies


  /**
   * Get auth headers
   */
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole')
  });

  /**
   * Fetch quotations from backend
   */
  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        sortBy: 'uploadedAt',
        sortDirection: 'DESC'
      });

      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('searchTerm', filters.search);

      const response = await fetch(`${API_BASE_URL}/api/quotations/procurement?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotations');

      const data = await response.json();
      setQuotations(data.quotations || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);

    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      showError('Failed to load quotations');
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch statistics
   */
  const fetchStats = async () => {
  try {
    // Build query params based on current filters
    const params = new URLSearchParams();
    
    if (groupName) params.append('groupName', groupName);
    if (subGroupName) params.append('subGroupName', subGroupName);
    if (projectId) params.append('projectId', projectId);
    
    console.log('📊 Fetching stats with filters:', { groupName, subGroupName, projectId });
    
    const response = await fetch(`${API_BASE_URL}/api/quotations/stats?${params}`, {
      credentials: "include",
      headers: getAuthHeaders()
    });

    if (response.ok) {
      const data = await response.json();
      setStats(data);
      console.log('✅ Stats loaded:', data);
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
};

  /**
   * Fetch vendors filtered by group/subgroup
   */
  const fetchVendors = async (groupName = null, subGroupName = null) => {
    try {
      let url = `${API_BASE_URL}/api/vendors/by-group-subgroup?`;
      if (groupName) url += `groupName=${encodeURIComponent(groupName)}&`;
      if (subGroupName) url += `subGroupName=${encodeURIComponent(subGroupName)}`;

      console.log('📡 Fetching vendors:', url);

      const response = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVendors(data.data || []);
          console.log('✅ Loaded vendors:', data.data.length);
        }
      } else {
        throw new Error('Failed to fetch vendors');
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      showError('Failed to load vendors');
      setVendors([]);
    }
  };

  /**
   * Fetch order book items by project
   */
  const fetchOrderBookItems = async (projectId) => {
    if (!projectId) {
      setOrderBookItems([]);
      return;
    }

    setLoadingOrderItems(true);
    try {
      const url = `${API_BASE_URL}/api/quotations/orderbook-items/${projectId}`;
      console.log('📡 Fetching order book items for project:', projectId);

      const response = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch order book items');

      const data = await response.json();
      if (data.success) {
        setOrderBookItems(data.data || []);
        console.log('✅ Loaded order book items:', data.data.length);

        // Auto-populate items in quotation form if in create mode (not edit mode)
        if (quotationFormData && !isEditMode && data.data && data.data.length > 0) {
          const formattedItems = data.data.map(item => ({
            itemName: item.itemName,
            description: item.specification || item.description || '',
            quantity: item.quantity || 1,
            unitPrice: '', // Empty instead of 0
            taxPercent: item.taxPercent || 18,
            orderBookItemId: item.id,
            included: true
          }));

          setQuotationFormData(prev => ({ ...prev, items: formattedItems }));
          console.log('✅ Pre-populated items from order book');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching order book items:', error);
      showError('Failed to load order book items');
      setOrderBookItems([]);
    } finally {
      setLoadingOrderItems(false);
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
   * Handle modal group change
   */
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setOrderBookItems([]);

    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        groupName: newGroupName,
        subGroupName: '',
        projectId: '',
        items: isEditMode ? quotationFormData.items : [] // Preserve items in edit mode
      });
    }

    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
      fetchVendors(newGroupName, null);
    } else {
      setVendors([]);
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
    setOrderBookItems([]);

    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        subGroupName: newSubGroupName,
        projectId: '',
        items: isEditMode ? quotationFormData.items : [] // Preserve items in edit mode
      });
    }

    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
      fetchVendors(modalGroupName, newSubGroupName);
    }
  };

  /**
   * Handle modal project change
   */
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);

    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        projectId: newProjectId
      });
    }

    // Only fetch order items in create mode
    if (newProjectId && !isEditMode) {
      fetchOrderBookItems(newProjectId);
    }
  };

  /**
   * Toggle vendor type (existing vs new)
   */
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new');

    if (type === 'new') {
      setQuotationFormData({
        ...quotationFormData,
        vendorId: null,
        vendorName: '',
        vendorContact: ''
      });
      setSelectedVendorDetails(null);
    } else {
      setQuotationFormData({
        ...quotationFormData,
        vendorName: '',
        vendorContact: ''
      });
    }
  };

  /**
   * Handle new vendor contact change (restrict to 10 digits)
   */
  const handleNewVendorContactChange = (value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setQuotationFormData({
      ...quotationFormData,
      vendorContact: cleaned
    });
  };

  /**
   * Toggle item inclusion in quotation
   */
  const toggleItemInclusion = (index) => {
    if (quotationFormData) {
      const newItems = [...quotationFormData.items];
      newItems[index].included = !newItems[index].included;
      setQuotationFormData({ ...quotationFormData, items: newItems });
    }
  };

  /**
   * Handle vendor selection from dropdown
   */
  const handleVendorSelection = (e) => {
    const vendorId = e.target.value ? parseInt(e.target.value) : null;

    if (vendorId) {
      const selectedVendor = vendors.find(v => v.id === vendorId);

      if (selectedVendor) {
        setSelectedVendorDetails({
          id: selectedVendor.id,
          name: selectedVendor.name,
          phone: selectedVendor.phone
        });

        setQuotationFormData({
          ...quotationFormData,
          vendorId: vendorId,
          vendorContact: selectedVendor.phone || ''
        });
      }
    } else {
      setSelectedVendorDetails(null);
      setQuotationFormData({
        ...quotationFormData,
        vendorId: null,
        vendorContact: ''
      });
    }
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = (e) => {
    const file = e.target.files[0];

    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('File size exceeds 5MB limit');
      e.target.value = '';
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showError('Only PDF and image files (JPG, PNG) are allowed');
      e.target.value = '';
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  /**
   * Open PO creation modal with quotation data
   */
  const handleOpenCreatePOModal = async (quotation) => {
    if (!canCreate) {
      showError('You do not have permission to create purchase orders');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotation.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const quotationData = await response.json();

      setPOFormData({
        quotationId: quotationData.id,
        quoteNo: quotationData.quoteNo,
        vendorId: quotationData.vendorId,
        vendorContact: quotationData.vendorContact,
        rfqId: quotationData.rfqId,
        groupName: quotationData.groupName,
        subGroupName: quotationData.subGroupName,
        projectId: quotationData.projectId,
        orderDate: new Date().toISOString().split('T')[0],
        expectedDelivery: '',
        paymentTerms: quotationData.paymentTerms || '',
        shippingAddress: '',
        notes: quotationData.notes || '',
        items: quotationData.items.map(item => ({
          quotationItemId: item.id,
          itemName: item.itemName,
          description: item.description,
          quotedQuantity: item.quantity,
          selectedQuantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          lineTotal: 0
        }))
      });

      setShowCreatePOFromQuotationModal(true);
    } catch (error) {
      console.error('Failed to load quotation:', error);
      showError('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update PO item quantity
   */
  const handleUpdatePOItemQuantity = (index, quantity) => {
    if (!poFormData) return;

    const newItems = [...poFormData.items];
    const item = newItems[index];
    const qty = parseFloat(quantity) || 0;

    if (qty > item.quotedQuantity) {
      showError(`Quantity cannot exceed quoted quantity of ${item.quotedQuantity}`);
      return;
    }

    item.selectedQuantity = qty;

    const subtotal = qty * item.unitPrice;
    const taxAmount = subtotal * (item.taxPercent / 100);
    item.lineTotal = subtotal + taxAmount;

    setPOFormData({ ...poFormData, items: newItems });
  };

  /**
   * Calculate PO total
   */
  const calculatePOTotal = () => {
    if (!poFormData) return { subtotal: 0, taxAmount: 0, total: 0 };

    const subtotal = poFormData.items.reduce((sum, item) => {
      return sum + (item.selectedQuantity * item.unitPrice);
    }, 0);

    const taxAmount = poFormData.items.reduce((sum, item) => {
      const itemSubtotal = item.selectedQuantity * item.unitPrice;
      return sum + (itemSubtotal * item.taxPercent / 100);
    }, 0);

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount
    };
  };

  /**
   * Create PO from quotation
   */
  const handleCreatePOFromQuotation = async () => {
    if (!poFormData.expectedDelivery) {
      showError('Expected delivery date is required');
      return;
    }

    const hasItems = poFormData.items.some(item => item.selectedQuantity > 0);
    if (!hasItems) {
      showError('Please select quantity for at least one item');
      return;
    }

    if (!window.confirm('Create Purchase Order from this quotation?')) {
      return;
    }

    setLoading(true);
    try {
      const poItems = poFormData.items
        .filter(item => item.selectedQuantity > 0)
        .map(item => ({
          itemName: item.itemName,
          itemDescription: item.description || '',
          quantity: item.selectedQuantity,
          unitPrice: item.unitPrice,
          gst: item.taxPercent,
          discount: 0
        }));

      const poData = {
        quotationId: poFormData.quotationId,
        vendorId: poFormData.vendorId,
        rfqId: poFormData.rfqId,
        groupName: poFormData.groupName,
        subGroupName: poFormData.subGroupName,
        projectId: poFormData.projectId,
        orderDate: poFormData.orderDate,
        expectedDelivery: poFormData.expectedDelivery,
        paymentTerms: poFormData.paymentTerms,
        shippingAddress: poFormData.shippingAddress,
        notes: poFormData.notes,
        items: poItems,
        status: 'Draft',
        paymentStatus: 'Pending'
      };

      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/from-quotation`, {
        credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(poData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create PO');
      }

      const createdPO = await response.json();
      showSuccess(`Purchase Order ${createdPO.poNo} created successfully!`);
      setShowCreatePOFromQuotationModal(false);
      setPOFormData(null);

      await handleUpdateStatus(poFormData.quotationId, 'PO Created');

      fetchQuotations();
      fetchStats();

    } catch (error) {
      console.error('Failed to create PO:', error);
      showError(error.message || 'Failed to create Purchase Order');
    } finally {
      setLoading(false);
    }
  };

  /**
   * View quotation details
   */
  const handleViewQuotation = async (quotation) => {
    if (!canView) {
      showError('You do not have permission to view quotations');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotation.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const data = await response.json();
      setSelectedQuotation(data);
      setShowDetailDrawer(true);
    } catch (error) {
      console.error('Failed to fetch quotation details:', error);
      showError('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * NEW: Edit quotation - Load data into modal
   */
  const handleEditQuotation = async (quotation) => {
    if (!canEdit) {
      showError('You do not have permission to edit quotations');
      return;
    }

    setLoading(true);
    try {
      // Fetch full quotation details
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotation.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const data = await response.json();

      // Set edit mode
      setIsEditMode(true);

      // Populate form with existing data
      setQuotationFormData({
        id: data.id, // Important: Store ID for update
        rfqId: data.rfqId || '',
        validTill: data.validTill || '',
        groupName: data.groupName || '',
        subGroupName: data.subGroupName || '',
        projectId: data.projectId || '',
        category: data.category || 'IT Equipment',
        vendorId: data.vendorId || null,
        vendorName: data.vendorName || '',
        vendorContact: data.vendorContact || '',
        vendorRating: data.vendorRating || 0,
        deliveryTime: data.deliveryTime || '',
        paymentTerms: data.paymentTerms || '',
        warranty: data.warranty || '',
        notes: data.notes || '',
        status: data.status || 'New', // NEW: Include current status
        items: data.items ? data.items.map(item => ({
          id: item.id, // Store item ID for update
          itemName: item.itemName || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || '',
          taxPercent: item.taxPercent || 18,
          included: true
        })) : []
      });

      // Set vendor selection state
      if (data.vendorId) {
        setShowNewVendorForm(false);
        setSelectedVendorDetails({
          id: data.vendorId,
          name: data.vendorName,
          phone: data.vendorContact
        });
      } else if (data.vendorName) {
        setShowNewVendorForm(true);
      }

      // Set modal dropdown values
      setModalGroupName(data.groupName || '');
      setModalSubGroupName(data.subGroupName || '');
      setModalProjectId(data.projectId || '');

      // Clear file (can't edit existing file)
      setSelectedFile(null);
      setFilePreview(null);

      // Fetch dropdown data
      fetchModalGroups();

      if (data.groupName) {
        fetchModalSubGroups(data.groupName);
        fetchVendors(data.groupName, null);

        if (data.subGroupName) {
          fetchModalProjects(data.groupName, data.subGroupName);
          fetchVendors(data.groupName, data.subGroupName);
        }
      }

      // Open modal
      setShowUploadQuotationModal(true);

    } catch (error) {
      console.error('Failed to load quotation for editing:', error);
      showError('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update quotation status
   */
  const handleUpdateStatus = async (quotationId, newStatus) => {
    if (!canEdit && !canApprove) {
      showError('You do not have permission to update quotation status');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}/status`, {
        credentials: "include",
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');

      showSuccess(`Quotation ${newStatus.toLowerCase()} successfully`);
      fetchQuotations();
      fetchStats();
      setShowDetailDrawer(false);

    } catch (error) {
      console.error('Failed to update status:', error);
      showError('Failed to update quotation status');
    } finally {
      setLoading(false);
    }
  };

  /**
   * NEW: Delete quotation (soft delete)
   */
  const handleDeleteQuotation = async (quotationId) => {
    if (!canDelete) {
      showError('You do not have permission to delete quotations');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        credentials: "include",
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to delete quotation');

      showSuccess('Quotation deleted successfully');
      fetchQuotations();
      fetchStats();
      setShowDetailDrawer(false);

    } catch (error) {
      console.error('Failed to delete quotation:', error);
      showError('Failed to delete quotation');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Upload new quotation
   */
  const handleUploadQuotation = () => {
    if (!canCreate) {
      showError('You do not have permission to create quotations');
      return;
    }

    setIsEditMode(false); // Set to create mode

    setQuotationFormData({
      rfqId: '',
      validTill: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      projectId: projectId || '',
      category: 'IT Equipment',
      vendorId: null,
      vendorName: '',
      vendorContact: '',
      vendorRating: 0,
      deliveryTime: '',
      paymentTerms: '',
      warranty: '',
      notes: '',
      status: 'New', // NEW: Default status for new quotations
      items: []
    });

    setSelectedVendorDetails(null);
    setShowNewVendorForm(false);
    setVendors([]);
    setOrderBookItems([]);

    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalProjectId(projectId || '');

    setSelectedFile(null);
    setFilePreview(null);

    fetchModalGroups();

    if (groupName) {
      fetchModalSubGroups(groupName);
      fetchVendors(groupName, null);

      if (subGroupName) {
        fetchModalProjects(groupName, subGroupName);
        fetchVendors(groupName, subGroupName);
      }
    }

    if (projectId) {
      fetchOrderBookItems(projectId);
    }

    setShowUploadQuotationModal(true);
  };

  /**
   * Save quotation (create or update)
   */
  const handleSaveQuotation = async () => {
    // Validation
    if (!quotationFormData.groupName) {
      showError('Group is required');
      return;
    }

    if (!quotationFormData.vendorId) {
      if (!quotationFormData.vendorName || !quotationFormData.vendorName.trim()) {
        showError('Vendor name is required when creating a new vendor');
        return;
      }
      if (!quotationFormData.vendorContact || quotationFormData.vendorContact.length !== 10) {
        showError('Please enter a valid 10-digit contact number for the new vendor');
        return;
      }
    }

    if (!quotationFormData.validTill) {
      showError('Valid until date is required');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validTillDate = new Date(quotationFormData.validTill);
    validTillDate.setHours(0, 0, 0, 0);

    if (validTillDate < today) {
      showError('Valid until date cannot be in the past');
      return;
    }

    if (quotationFormData.items.length === 0 || !quotationFormData.items[0].itemName) {
      showError('Please add at least one item with a name');
      return;
    }

    const includedItems = quotationFormData.items.filter(item => item.included !== false);
    if (includedItems.length === 0) {
      showError('Please include at least one item in the quotation');
      return;
    }

    for (let i = 0; i < includedItems.length; i++) {
      const item = includedItems[i];
      if (!item.itemName || !item.itemName.trim()) {
        showError(`Item ${i + 1}: Item name is required`);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        showError(`Item ${i + 1}: Quantity must be greater than 0`);
        return;
      }
      if (item.unitPrice === null || item.unitPrice === undefined || item.unitPrice === '' || item.unitPrice < 0) {
        showError(`Item ${i + 1}: Unit price is required and must be 0 or greater`);
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();

      const cleanedItems = includedItems.map(item => ({
        id: item.id || null, // Include ID for updates
        itemName: item.itemName.trim(),
        description: item.description ? item.description.trim() : '',
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        taxPercent: item.taxPercent
      }));

      const quotationData = {
        vendorId: quotationFormData.vendorId || null,
        vendorName: quotationFormData.vendorName ? quotationFormData.vendorName.trim() : null,
        vendorContact: quotationFormData.vendorContact ? quotationFormData.vendorContact.trim() : null,
        rfqId: quotationFormData.rfqId ? quotationFormData.rfqId.trim() : null,
        validTill: quotationFormData.validTill,
        groupName: quotationFormData.groupName,
        subGroupName: quotationFormData.subGroupName || null,
        projectId: quotationFormData.projectId || null,
        category: quotationFormData.category,
        deliveryTime: quotationFormData.deliveryTime ? quotationFormData.deliveryTime.trim() : null,
        paymentTerms: quotationFormData.paymentTerms ? quotationFormData.paymentTerms.trim() : null,
        warranty: quotationFormData.warranty ? quotationFormData.warranty.trim() : null,
        notes: quotationFormData.notes ? quotationFormData.notes.trim() : null,
        status: quotationFormData.status, // NEW: Include status
        items: cleanedItems,
        type: 'Procurement'
      };

      formData.append('quotation', new Blob([JSON.stringify(quotationData)], {
        type: 'application/json'
      }));

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const url = isEditMode
        ? `${API_BASE_URL}/api/quotations/${quotationFormData.id}`
        : `${API_BASE_URL}/api/quotations/procurement`;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        credentials: "include",
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-User-Id': user?.id || localStorage.getItem('userId'),
          'X-User-Role': user?.role || localStorage.getItem('userRole')
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save quotation');
      }

      const data = await response.json();
      showSuccess(isEditMode ? 'Quotation updated successfully!' : 'Quotation uploaded successfully!');
      setShowUploadQuotationModal(false);
      setSelectedFile(null);
      setFilePreview(null);
      setSelectedVendorDetails(null);
      setVendors([]);
      setOrderBookItems([]);
      setShowNewVendorForm(false);
      setIsEditMode(false);
      fetchQuotations();
      fetchStats();

    } catch (error) {
      console.error('Failed to save quotation:', error);
      showError(error.message || 'Failed to save quotation');
    } finally {
      setLoading(false);
    }
  };

  // Add/Remove/Update item handlers
  const handleAddQuotationItem = () => {
    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        items: [...quotationFormData.items, {
          itemName: '',
          description: '',
          quantity: 1,
          unitPrice: '', // Empty instead of 0
          taxPercent: 18
        }]
      });
    }
  };

  const handleRemoveQuotationItem = (index) => {
    if (quotationFormData && quotationFormData.items.length > 1) {
      const newItems = quotationFormData.items.filter((_, i) => i !== index);
      setQuotationFormData({ ...quotationFormData, items: newItems });
    }
  };

  const handleUpdateQuotationItem = (index, field, value) => {
    if (quotationFormData) {
      const newItems = [...quotationFormData.items];
      newItems[index] = { ...newItems[index], [field]: value };
      setQuotationFormData({ ...quotationFormData, items: newItems });
    }
  };

  // Calculate totals
  const calculateQuotationTotal = () => {
    if (!quotationFormData) return { subtotal: 0, taxAmount: 0, total: 0 };

    const subtotal = quotationFormData.items
      .filter(item => item.included !== false)
      .reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        return sum + (qty * price);
      }, 0);

    const taxAmount = quotationFormData.items
      .filter(item => item.included !== false)
      .reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        const tax = parseFloat(item.taxPercent) || 0;
        const lineSubtotal = qty * price;
        return sum + (lineSubtotal * tax / 100);
      }, 0);

    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'New': 'procurement-quotation-received-badge-new',
      'Under Review': 'procurement-quotation-received-badge-review',
      'Shortlisted': 'procurement-quotation-received-badge-shortlisted',
      'Approved': 'procurement-quotation-received-badge-approved',
      'PO Created': 'procurement-quotation-received-badge-po-created',
      'Rejected': 'procurement-quotation-received-badge-rejected',
      'Expired': 'procurement-quotation-received-badge-expired'
    };
    return statusClasses[status] || '';
  };

  // Check if expiring soon
  const isExpiringSoon = (validTill) => {
    if (!validTill) return false;
    const today = new Date();
    const valid = new Date(validTill);
    const diffDays = Math.ceil((valid - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  };

  // KPI data from stats
  const kpiData = stats ? [
    { title: 'Total Quotations', value: stats.totalQuotations?.toString() || '0', icon: <FileText size={32} />, color: '#2563eb' },
    { title: 'New', value: stats.newQuotations?.toString() || '0', icon: <Clock size={32} />, color: '#f59e0b' },
    { title: 'Approved', value: stats.approved?.toString() || '0', icon: <CheckCircle size={32} />, color: '#22c55e' },
    { title: 'Rejected', value: stats.rejected?.toString() || '0', icon: <XCircle size={32} />, color: '#ef4444' }
  ] : [];

  return (
    <div className="procurement-quotation-received-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="procurement-quotation-received-header">
        <div className="procurement-quotation-received-breadcrumb">
          Dashboard &gt; Procurement &gt; Quotations Received
        </div>

        <div className="page-header-with-filter">
          <h1 className="procurement-quotation-received-title">
            Quotations Received <span className="procurement-quotation-received-count">({totalElements})</span>
          </h1>
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="procurement-quotation-received-action-bar">
        <div className="procurement-quotation-received-search-filters">
          <input
            type="text"
            placeholder="Search by Quotation No, Vendor ID, RFQ ID..."
            className="procurement-quotation-received-search"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(0);
            }}
            disabled={!canView}
          />

          <select
            className="procurement-quotation-received-filter"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setCurrentPage(0);
            }}
            disabled={!canView}
          >
            <option value="all">All Status</option>
            <option value="New">New</option>
            <option value="Under Review">Under Review</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Approved">Approved</option>
            <option value="PO Created">PO Created</option>
            <option value="Rejected">Rejected</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <div className="procurement-quotation-received-actions">
          <button
            className="procurement-quotation-received-btn-primary"
            onClick={handleUploadQuotation}
            disabled={!canCreate}
            style={{ opacity: canCreate ? 1 : 0.5, cursor: canCreate ? 'pointer' : 'not-allowed' }}
          >
            <Upload size={18} /> Upload Quotation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="procurement-quotation-received-kpi-grid">
          {kpiData.map((kpi, index) => (
            <div key={index} className="procurement-quotation-received-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="procurement-quotation-received-kpi-icon">{kpi.icon}</div>
              <div className="procurement-quotation-received-kpi-content">
                <div className="procurement-quotation-received-kpi-value">{kpi.value}</div>
                <div className="procurement-quotation-received-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quotations Table */}
      <div className="procurement-quotation-received-table-container">
        <table className="procurement-quotation-received-table">
          <thead>
            <tr>
              <th>Quotation No</th>
              <th>Vendor ID</th>
              <th>RFQ ID</th>
              <th>Category</th>
              <th>Quotation Value</th>
              <th>Valid Until</th>
              <th>File</th>
              <th>Status</th>
              <th>Uploaded On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan="10" className="empty-state">
                  {canView ? 'No quotations found' : 'You do not have permission to view quotations'}
                </td>
              </tr>
            ) : (
              quotations.map((quotation) => (
                <tr key={quotation.id} className="procurement-quotation-received-table-row">
                  <td className="procurement-quotation-received-table-id">{quotation.quoteNo}</td>
                  <td>{quotation.vendorId || '—'}</td>
                  <td>{quotation.rfqId || '—'}</td>
                  <td>{quotation.category || 'N/A'}</td>
                  <td className="procurement-quotation-received-table-value">{formatCurrency(quotation.totalValue)}</td>
                  <td className={isExpiringSoon(quotation.validTill) ? 'procurement-quotation-received-expiring' : ''}>
                    {formatDate(quotation.validTill)}
                    {isExpiringSoon(quotation.validTill) && (
                      <span className="procurement-quotation-received-warning-icon">
                        <AlertCircle size={16} />
                      </span>
                    )}
                  </td>
                  <td>
                    {quotation.fileName ? (
                      <a href={`${API_BASE_URL}/api/quotations/${quotation.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-link"
                        title={`${quotation.fileName} (${formatFileSize(quotation.fileSize)})`}
                      >
                        📄 {quotation.fileName.substring(0, 15)}...
                      </a>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`procurement-quotation-received-badge ${getStatusBadgeClass(quotation.status)}`}>
                      {quotation.status}
                    </span>
                  </td>
                  <td>{formatDate(quotation.uploadedAt)}</td>
                  <td>
                    <div className="procurement-quotation-received-actions-cell">
                      <button
                        className="procurement-quotation-received-action-btn"
                        onClick={() => handleViewQuotation(quotation)}
                        title="View Details"
                        disabled={!canView}
                        style={{ opacity: canView ? 1 : 0.4, cursor: canView ? 'pointer' : 'not-allowed' }}
                      >
                        <Eye size={16} />
                      </button>

                      {/* NEW: Edit Button */}
                      <button
                        className="procurement-quotation-received-action-btn"
                        onClick={() => handleEditQuotation(quotation)}
                        title="Edit Quotation"
                        disabled={!canEdit || quotation.status === 'PO Created'}
                        style={{
                          opacity: (canEdit && quotation.status !== 'PO Created') ? 1 : 0.4,
                          cursor: (canEdit && quotation.status !== 'PO Created') ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <Edit2 size={16} />
                      </button>

                      {quotation.status === 'New' && (
                        <button
                          className="procurement-quotation-received-action-btn"
                          onClick={() => handleUpdateStatus(quotation.id, 'Shortlisted')}
                          title="Shortlist"
                          disabled={!canEdit}
                          style={{ opacity: canEdit ? 1 : 0.4, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                        >
                          <Star size={16} />
                        </button>
                      )}
                      {(quotation.status === 'Shortlisted' || quotation.status === 'New') && (
                        <button
                          className="procurement-quotation-received-action-btn"
                          onClick={() => handleUpdateStatus(quotation.id, 'Approved')}
                          title="Approve"
                          disabled={!canApprove}
                          style={{ opacity: canApprove ? 1 : 0.4, cursor: canApprove ? 'pointer' : 'not-allowed' }}
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {quotation.status === 'Approved' && (
                        <button
                          className="procurement-quotation-received-action-btn procurement-quotation-received-create-po-btn"
                          onClick={() => handleOpenCreatePOModal(quotation)}
                          title="Create PO"
                          disabled={!canCreate}
                          style={{ opacity: canCreate ? 1 : 0.4, cursor: canCreate ? 'pointer' : 'not-allowed' }}
                        >
                          <ShoppingCart size={16} />
                        </button>
                      )}

                      {/* NEW: Delete Button */}
                      <button
                        className="procurement-quotation-received-action-btn"
                        onClick={() => handleDeleteQuotation(quotation.id)}
                        title="Delete Quotation"
                        disabled={!canDelete || quotation.status === 'PO Created'}
                        style={{
                          opacity: (canDelete && quotation.status !== 'PO Created') ? 1 : 0.4,
                          cursor: (canDelete && quotation.status !== 'PO Created') ? 'pointer' : 'not-allowed',
                          color: '#ef4444'
                        }}
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
        <div className="table-footer">
          <div className="table-footer-left">
            <span>
              Showing {currentPage * pageSize + 1}-
              {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} quotations
            </span>
            <div className="records-per-page">
              <label htmlFor="pageSize">Records per page:</label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(0);
                }}
                className="page-size-select"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </button>

            {[...Array(Math.min(5, totalPages))].map((_, index) => {
              const pageNum = currentPage < 3 ? index : currentPage + index - 2;
              if (pageNum >= 0 && pageNum < totalPages) {
                return (
                  <button
                    key={pageNum}
                    className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum + 1}
                  </button>
                );
              }
              return null;
            })}

            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer - UPDATED WITH DELETE BUTTON */}
      {showDetailDrawer && selectedQuotation && (
        <div className="procurement-quotation-received-drawer-overlay" onClick={() => setShowDetailDrawer(false)}>
          <div className="procurement-quotation-received-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-quotation-received-drawer-header">
              <div>
                <h2>{selectedQuotation.quoteNo}</h2>
                <p className="procurement-quotation-received-drawer-subtitle">
                  Vendor ID: {selectedQuotation.vendorId || 'N/A'} |
                  Category: {selectedQuotation.category || 'N/A'}
                </p>
              </div>
              <button className="procurement-quotation-received-drawer-close" onClick={() => setShowDetailDrawer(false)}>
                ✕
              </button>
            </div>

            <div className="procurement-quotation-received-drawer-content">
              {/* Basic Information */}
              <div className="procurement-quotation-received-drawer-section">
                <h3>Quotation Details</h3>
                <div className="quotation-details-grid">
                  <div className="quotation-detail-item">
                    <span className="quotation-detail-label">Status:</span>
                    <span className={`procurement-quotation-received-badge ${getStatusBadgeClass(selectedQuotation.status)}`}>
                      {selectedQuotation.status}
                    </span>
                  </div>
                  <div className="quotation-detail-item">
                    <span className="quotation-detail-label">RFQ ID:</span>
                    <span>{selectedQuotation.rfqId || '—'}</span>
                  </div>
                  <div className="quotation-detail-item">
                    <span className="quotation-detail-label">Valid Until:</span>
                    <span>{formatDate(selectedQuotation.validTill)}</span>
                  </div>
                  <div className="quotation-detail-item">
                    <span className="quotation-detail-label">Uploaded On:</span>
                    <span>{formatDate(selectedQuotation.uploadedAt)}</span>
                  </div>
                  <div className="quotation-detail-item">
                    <span className="quotation-detail-label">Total Value:</span>
                    <span className="quotation-value">{formatCurrency(selectedQuotation.totalValue)}</span>
                  </div>
                  <div className="quotation-detail-item">
                    <span className="quotation-detail-label">Vendor Contact:</span>
                    <span>{selectedQuotation.vendorContact || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Project Assignment */}
              {(selectedQuotation.groupName || selectedQuotation.subGroupName || selectedQuotation.projectId) && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Project Assignment</h3>
                  <div className="quotation-details-grid">
                    {selectedQuotation.groupName && (
                      <div className="quotation-detail-item">
                        <span className="quotation-detail-label">Group:</span>
                        <span>{selectedQuotation.groupName}</span>
                      </div>
                    )}
                    {selectedQuotation.subGroupName && (
                      <div className="quotation-detail-item">
                        <span className="quotation-detail-label">Sub Group:</span>
                        <span>{selectedQuotation.subGroupName}</span>
                      </div>
                    )}
                    {selectedQuotation.projectId && (
                      <div className="quotation-detail-item">
                        <span className="quotation-detail-label">Project ID:</span>
                        <span>{selectedQuotation.projectId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Terms & Conditions */}
              {(selectedQuotation.deliveryTime || selectedQuotation.paymentTerms || selectedQuotation.warranty) && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Terms & Conditions</h3>
                  <div className="quotation-details-grid">
                    {selectedQuotation.deliveryTime && (
                      <div className="quotation-detail-item">
                        <span className="quotation-detail-label">Delivery Time:</span>
                        <span>{selectedQuotation.deliveryTime}</span>
                      </div>
                    )}
                    {selectedQuotation.paymentTerms && (
                      <div className="quotation-detail-item">
                        <span className="quotation-detail-label">Payment Terms:</span>
                        <span>{selectedQuotation.paymentTerms}</span>
                      </div>
                    )}
                    {selectedQuotation.warranty && (
                      <div className="quotation-detail-item">
                        <span className="quotation-detail-label">Warranty:</span>
                        <span>{selectedQuotation.warranty}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Section */}
              {selectedQuotation.items && selectedQuotation.items.length > 0 && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Quotation Items ({selectedQuotation.items.length})</h3>
                  <div className="quotation-items-table-wrapper">
                    <table className="quotation-items-table">
                      <thead>
                        <tr>
                          <th>Line</th>
                          <th>Item Name</th>
                          <th>Description</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Tax %</th>
                          <th>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedQuotation.items.map((item, index) => {
                          const qty = parseFloat(item.quantity) || 0;
                          const price = parseFloat(item.unitPrice) || 0;
                          const tax = parseFloat(item.taxPercent) || 0;
                          const subtotal = qty * price;
                          const taxAmount = subtotal * (tax / 100);
                          const total = subtotal + taxAmount;

                          return (
                            <tr key={item.id || index}>
                              <td>{item.lineNo || index + 1}</td>
                              <td>{item.itemName}</td>
                              <td>{item.description || '—'}</td>
                              <td className="text-right">{qty}</td>
                              <td className="text-right">{formatCurrency(price)}</td>
                              <td className="text-center">{tax}%</td>
                              <td className="text-right" style={{ fontWeight: '600' }}>{formatCurrency(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedQuotation.notes && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Notes</h3>
                  <p style={{ color: '#475569', lineHeight: '1.6' }}>{selectedQuotation.notes}</p>
                </div>
              )}

              {/* Attached Files */}
              <div className="procurement-quotation-received-drawer-section">
                <h3>Attached Files</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedQuotation.fileName ? (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={24} color="#64748b" />
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>
                            {selectedQuotation.fileName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {formatFileSize(selectedQuotation.fileSize)} • Uploaded Quotation
                          </div>
                        </div>
                      </div>

                      <a href={`${API_BASE_URL}/api/quotations/${selectedQuotation.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="procurement-quotation-received-btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '14px' }}
                      >
                        <Download size={16} /> View
                      </a>
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No quotation file attached</p>
                  )}

                  {selectedQuotation.poId && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <Package size={24} color="#22c55e" />
                      <div>
                        <div style={{ fontWeight: '500', color: '#166534' }}>
                          Purchase Order Created
                        </div>
                        <div style={{ fontSize: '12px', color: '#16a34a' }}>
                          PO ID: {selectedQuotation.poId}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="procurement-quotation-received-drawer-actions">
                {selectedQuotation.status === 'Approved' && !selectedQuotation.poId && canCreate && (
                  <button
                    className="procurement-quotation-received-btn-primary"
                    onClick={() => {
                      setShowDetailDrawer(false);
                      handleOpenCreatePOModal(selectedQuotation);
                    }}
                  >
                    <ShoppingCart size={18} /> Create Purchase Order
                  </button>
                )}

                {/* Edit Button in Drawer */}
                {selectedQuotation.status !== 'PO Created' && canEdit && (
                  <button
                    className="procurement-quotation-received-btn-secondary"
                    onClick={() => {
                      setShowDetailDrawer(false);
                      handleEditQuotation(selectedQuotation);
                    }}
                  >
                    <Edit2 size={18} /> Edit Quotation
                  </button>
                )}

                {selectedQuotation.status !== 'Approved' && selectedQuotation.status !== 'Rejected' && selectedQuotation.status !== 'PO Created' && (
                  <>
                    {selectedQuotation.status === 'New' && canEdit && (
                      <button
                        className="procurement-quotation-received-btn-secondary"
                        onClick={() => handleUpdateStatus(selectedQuotation.id, 'Shortlisted')}
                      >
                        <Star size={18} /> Shortlist
                      </button>
                    )}
                    {(selectedQuotation.status === 'Shortlisted' || selectedQuotation.status === 'New') && canApprove && (
                      <button
                        className="procurement-quotation-received-btn-secondary"
                        onClick={() => handleUpdateStatus(selectedQuotation.id, 'Approved')}
                      >
                        <Check size={18} /> Approve
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className="procurement-quotation-received-btn-secondary"
                        style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => handleUpdateStatus(selectedQuotation.id, 'Rejected')}
                      >
                        <XCircle size={18} /> Reject
                      </button>
                    )}
                  </>
                )}

                {/* NEW: Delete Button in Drawer */}
                {selectedQuotation.status !== 'PO Created' && canDelete && (
                  <button
                    className="procurement-quotation-received-btn-secondary"
                    style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}
                    onClick={() => handleDeleteQuotation(selectedQuotation.id)}
                  >
                    <Trash2 size={18} /> Delete Quotation
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload/Edit Modal - CONTINUED IN NEXT FILE DUE TO LENGTH */}
      {/* I'll create a separate continuation file for the modal */}
      {showUploadQuotationModal && quotationFormData && (
        <div className="procurement-quotation-received-modal-overlay" onClick={() => setShowUploadQuotationModal(false)}>
          <div className="procurement-quotation-received-upload-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px' }}>
            <div className="procurement-quotation-received-modal-header">
              <h2>{isEditMode ? 'Edit Quotation' : 'Upload New Quotation'}</h2>
              {isEditMode && quotationFormData.quoteNo && (
                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                  Quotation: {quotationFormData.quoteNo}
                </p>
              )}
              <button className="procurement-quotation-received-modal-close" onClick={() => setShowUploadQuotationModal(false)}>
                ✕
              </button>
            </div>

            <div className="procurement-quotation-received-upload-form">

              {/* PROJECT SELECTION AT TOP */}
              <div className="procurement-quotation-received-form-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px' }}>
                <h3>📂 Project Assignment</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
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

                  <div className="procurement-quotation-received-form-group">
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

                  <div className="procurement-quotation-received-form-group">
                    <label>Project (Optional)</label>
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

                {loadingOrderItems && (
                  <div style={{ marginTop: '10px', color: '#3b82f6', fontSize: '13px' }}>
                    🔄 Loading order book items...
                  </div>
                )}

                {!isEditMode && orderBookItems.length > 0 && (
                  <div style={{ marginTop: '10px', color: '#059669', fontSize: '13px' }}>
                    ✅ Loaded {orderBookItems.length} items from order book
                  </div>
                )}
              </div>

              {/* VENDOR SELECTION */}
              <div className="procurement-quotation-received-form-section">
                <h3>🏢 Vendor Information</h3>

                {/* Vendor Type Radio Buttons */}
                <div style={{ marginBottom: '15px', display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="vendorType"
                      checked={!showNewVendorForm}
                      onChange={() => handleVendorTypeChange('existing')}
                      style={{ marginRight: '8px' }}
                    />
                    <span>Select Existing Vendor</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="vendorType"
                      checked={showNewVendorForm}
                      onChange={() => handleVendorTypeChange('new')}
                      style={{ marginRight: '8px' }}
                    />
                    <span>Add New Vendor</span>
                  </label>
                </div>

                {/* EXISTING VENDOR SELECTION */}
                {!showNewVendorForm && (
                  <div className="procurement-quotation-received-form-row">
                    <div className="procurement-quotation-received-form-group">
                      <label>Select Vendor *</label>
                      <select
                        value={quotationFormData.vendorId || ''}
                        onChange={handleVendorSelection}
                        disabled={vendors.length === 0}
                      >
                        <option value="">
                          {vendors.length === 0 ? 'No vendors available for selected group/subgroup' : 'Select Vendor'}
                        </option>
                        {vendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name}
                            {vendor.phone ? ` - ${vendor.phone}` : ''}
                          </option>
                        ))}
                      </select>
                      {vendors.length === 0 && modalGroupName && (
                        <small style={{ color: '#ef4444', marginTop: '4px', display: 'block' }}>
                          ⚠️ No vendors found for selected Group/Sub-Group. Please add a new vendor or select a different group.
                        </small>
                      )}
                    </div>

                    {quotationFormData.vendorId && selectedVendorDetails && (
                      <div className="procurement-quotation-received-form-group">
                        <label>Selected Vendor Details</label>
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#0c4a6e'
                        }}>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>📋 Name:</strong> {selectedVendorDetails.name}
                          </div>
                          {selectedVendorDetails.phone && (
                            <div>
                              <strong>📞 Contact:</strong> {selectedVendorDetails.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* NEW VENDOR FORM */}
                {showNewVendorForm && (
                  <div style={{
                    padding: '20px',
                    background: '#f0fdf4',
                    border: '2px solid #86efac',
                    borderRadius: '8px'
                  }}>
                    <div className="procurement-quotation-received-form-row">
                      <div className="procurement-quotation-received-form-group">
                        <label>Vendor Name *</label>
                        <input
                          type="text"
                          value={quotationFormData.vendorName || ''}
                          onChange={(e) => setQuotationFormData({
                            ...quotationFormData,
                            vendorName: e.target.value
                          })}
                          placeholder="Enter vendor name"
                        />
                      </div>

                      <div className="procurement-quotation-received-form-group">
                        <label>Contact Number * (10 digits)</label>
                        <input
                          type="tel"
                          value={quotationFormData.vendorContact || ''}
                          onChange={(e) => handleNewVendorContactChange(e.target.value)}
                          placeholder="Enter 10-digit mobile"
                          maxLength={10}
                        />
                        {quotationFormData.vendorContact && quotationFormData.vendorContact.length < 10 && (
                          <small style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Contact must be exactly 10 digits
                          </small>
                        )}
                      </div>
                    </div>

                    <div style={{
                      marginTop: '12px',
                      padding: '10px',
                      background: '#dbeafe',
                      border: '1px solid #93c5fd',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#1e40af'
                    }}>
                      💡 <strong>Note:</strong> This vendor will be automatically created in the system after quotation is saved.
                    </div>
                  </div>
                )}
              </div>

              {/* BASIC INFORMATION */}
              <div className="procurement-quotation-received-form-section">
                <h3>Basic Information</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>RFQ ID</label>
                    <input
                      type="text"
                      value={quotationFormData.rfqId}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, rfqId: e.target.value })}
                      placeholder="e.g., RFQ-2024-001"
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Category *</label>
                    <select
                      value={quotationFormData.category}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, category: e.target.value })}
                    >
                      <option value="IT Equipment">IT Equipment</option>
                      <option value="Office Furniture">Office Furniture</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Office Supplies">Office Supplies</option>
                    </select>
                  </div>

                  {/* NEW: Status Selection */}
                  <div className="procurement-quotation-received-form-group">
                    <label>Status *</label>
                    <select
                      value={quotationFormData.status}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, status: e.target.value })}
                    >
                      <option value="New">New</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Shortlisted">Shortlisted</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      {isEditMode && quotationFormData.status === 'PO Created' && (
                        <option value="PO Created">PO Created</option>
                      )}
                    </select>
                    <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Set the current status of this quotation
                    </small>
                  </div>
                </div>

                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Valid Till *</label>
                    <input
                      type="date"
                      value={quotationFormData.validTill}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, validTill: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Payment Terms</label>
                    <input
                      type="text"
                      value={quotationFormData.paymentTerms}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, paymentTerms: e.target.value })}
                      placeholder="e.g., Net 30"
                    />
                  </div>
                </div>

                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Delivery Time</label>
                    <input
                      type="text"
                      value={quotationFormData.deliveryTime}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, deliveryTime: e.target.value })}
                      placeholder="e.g., 2 weeks"
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Warranty</label>
                    <input
                      type="text"
                      value={quotationFormData.warranty}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, warranty: e.target.value })}
                      placeholder="e.g., 1 year"
                    />
                  </div>
                </div>

                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group" style={{ flex: '1 1 100%' }}>
                    <label>Notes</label>
                    <input
                      type="text"
                      value={quotationFormData.notes}
                      onChange={(e) => setQuotationFormData({ ...quotationFormData, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
              </div>

              {/* FILE UPLOAD */}
              <div className="procurement-quotation-received-form-section">
                <h3>Attach Quotation File (Optional)</h3>
                <div className="procurement-quotation-received-form-group">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    style={{ marginBottom: '10px' }}
                  />
                  {selectedFile && (
                    <div className="file-info-box">
                      📄 {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </div>
                  )}
                  {filePreview && (
                    <img src={filePreview} alt="Preview" style={{ maxWidth: '200px', marginTop: '10px' }} />
                  )}
                  <small style={{ color: '#64748b' }}>Max size: 5MB | Formats: PDF, JPG, PNG</small>
                  {isEditMode && (
                    <div style={{ marginTop: '8px', color: '#f59e0b', fontSize: '13px' }}>
                      ℹ️ Uploading a new file will replace the existing file (if any)
                    </div>
                  )}
                </div>
              </div>

              {/* ITEMS SECTION - WITH IMPROVED INPUTS */}
              <div className="procurement-quotation-received-form-section">
                <div className="procurement-quotation-received-section-header">
                  <h3>
                    Quotation Items *
                    {quotationFormData.items.length > 0 && (
                      <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal', marginLeft: '8px' }}>
                        ({quotationFormData.items.filter(i => i.included !== false).length} of {quotationFormData.items.length} included)
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    className="procurement-quotation-received-btn-add-item"
                    onClick={handleAddQuotationItem}
                  >
                    + Add Item
                  </button>
                </div>

                {quotationFormData.items.length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    border: '2px dashed #cbd5e0',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                    <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '5px', color: '#64748b' }}>
                      No Items Added
                    </div>
                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                      {isEditMode
                        ? 'Click "Add Item" to add items to this quotation'
                        : 'Select a project above to load items from order book, or click "Add Item" to add manually'}
                    </div>
                  </div>
                ) : (
                  <>
                    {!isEditMode && orderBookItems.length > 0 && (
                      <div style={{
                        marginBottom: '15px',
                        padding: '12px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#1e40af'
                      }}>
                        💡 <strong>Tip:</strong> Items loaded from order book. Uncheck items you don't want in this quotation,
                        and enter vendor prices for included items.
                      </div>
                    )}

                    <div className="procurement-quotation-received-items-table-wrapper">
                      <table className="procurement-quotation-received-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>Include</th>
                            <th style={{ minWidth: '200px' }}>Item Name *</th>
                            <th style={{ minWidth: '200px' }}>Description</th>
                            <th style={{ width: '100px' }}>Quantity *</th>
                            <th style={{ width: '130px' }}>Unit Price (₹) *</th>
                            <th style={{ width: '100px' }}>GST %</th>
                            <th style={{ width: '130px' }}>Line Total</th>
                            <th style={{ width: '60px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotationFormData.items.map((item, index) => {
                            const included = item.included !== false;
                            const qty = parseFloat(item.quantity) || 0;
                            const price = parseFloat(item.unitPrice) || 0;
                            const tax = parseFloat(item.taxPercent) || 0;
                            const lineTotal = qty * price;
                            const taxAmount = lineTotal * (tax / 100);
                            const totalWithTax = lineTotal + taxAmount;

                            return (
                              <tr
                                key={index}
                                style={{
                                  background: included ? 'white' : '#f8fafc',
                                  opacity: included ? 1 : 0.5
                                }}
                              >
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={included}
                                    onChange={() => toggleItemInclusion(index)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    placeholder="Enter item name"
                                    value={item.itemName}
                                    onChange={(e) => handleUpdateQuotationItem(index, 'itemName', e.target.value)}
                                    className="table-input"
                                    disabled={!included}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    placeholder="Enter description"
                                    value={item.description}
                                    onChange={(e) => handleUpdateQuotationItem(index, 'description', e.target.value)}
                                    className="table-input"
                                    disabled={!included}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateQuotationItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                                    className="table-input text-center"
                                    disabled={!included}
                                  />
                                </td>
                                <td>
                                  {/* IMPROVED: Empty placeholder, better UX */}
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Price"
                                    value={item.unitPrice}
                                    onChange={(e) => handleUpdateQuotationItem(index, 'unitPrice', e.target.value)}
                                    className="table-input text-right"
                                    disabled={!included}
                                  />
                                </td>
                                <td>
                                  <select
                                    value={item.taxPercent}
                                    onChange={(e) => handleUpdateQuotationItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                                    className="table-input"
                                    disabled={!included}
                                  >
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18">18%</option>
                                    <option value="28">28%</option>
                                  </select>
                                </td>
                                <td className="text-right" style={{
                                  fontWeight: '600',
                                  color: included ? '#1e293b' : '#94a3b8'
                                }}>
                                  {included && item.unitPrice ? formatCurrency(totalWithTax) : '-'}
                                </td>
                                <td className="text-center">
                                  {quotationFormData.items.length > 1 && (
                                    <button
                                      type="button"
                                      className="procurement-quotation-received-btn-remove-item"
                                      onClick={() => handleRemoveQuotationItem(index)}
                                      title="Remove item"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Quotation Summary */}
                    <div className="procurement-quotation-received-quote-summary">
                      <div className="procurement-quotation-received-summary-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(calculateQuotationTotal().subtotal)}</span>
                      </div>
                      <div className="procurement-quotation-received-summary-row">
                        <span>Tax Amount:</span>
                        <span>{formatCurrency(calculateQuotationTotal().taxAmount)}</span>
                      </div>
                      <div className="procurement-quotation-received-summary-row procurement-quotation-received-summary-total">
                        <span><strong>Total Value:</strong></span>
                        <span><strong>{formatCurrency(calculateQuotationTotal().total)}</strong></span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="procurement-quotation-received-modal-actions">
              <button
                className="procurement-quotation-received-btn-primary"
                onClick={handleSaveQuotation}
                disabled={quotationFormData.items.filter(i => i.included !== false).length === 0}
              >
                {isEditMode ? 'Update Quotation' : 'Upload Quotation'}
              </button>
              <button
                className="procurement-quotation-received-btn-secondary"
                onClick={() => {
                  setShowUploadQuotationModal(false);
                  setIsEditMode(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PO Modal - KEEP AS IS FROM ORIGINAL */}
      {showCreatePOFromQuotationModal && poFormData && (
        <div className="procurement-quotation-received-modal-overlay" onClick={() => setShowCreatePOFromQuotationModal(false)}>
          <div className="procurement-quotation-received-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-quotation-received-modal-header">
              <h2>Create Purchase Order</h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                From Quotation: {poFormData.quoteNo}
              </p>
              <button className="procurement-quotation-received-modal-close" onClick={() => setShowCreatePOFromQuotationModal(false)}>
                ✕
              </button>
            </div>

            <div className="procurement-quotation-received-upload-form">
              {/* PO Details */}
              <div className="procurement-quotation-received-form-section">
                <h3>Purchase Order Details</h3>

                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Vendor Contact</label>
                    <input
                      type="text"
                      value={poFormData.vendorContact || 'N/A'}
                      disabled
                      style={{ backgroundColor: '#f1f5f9' }}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>RFQ ID</label>
                    <input
                      type="text"
                      value={poFormData.rfqId || 'N/A'}
                      disabled
                      style={{ backgroundColor: '#f1f5f9' }}
                    />
                  </div>
                </div>

                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Order Date</label>
                    <input
                      type="date"
                      value={poFormData.orderDate}
                      onChange={(e) => setPOFormData({ ...poFormData, orderDate: e.target.value })}
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Expected Delivery *</label>
                    <input
                      type="date"
                      value={poFormData.expectedDelivery}
                      onChange={(e) => setPOFormData({ ...poFormData, expectedDelivery: e.target.value })}
                      min={poFormData.orderDate}
                    />
                  </div>
                </div>

                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Payment Terms</label>
                    <input
                      type="text"
                      value={poFormData.paymentTerms}
                      onChange={(e) => setPOFormData({ ...poFormData, paymentTerms: e.target.value })}
                      placeholder="e.g., Net 30"
                    />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Shipping Address</label>
                    <input
                      type="text"
                      value={poFormData.shippingAddress}
                      onChange={(e) => setPOFormData({ ...poFormData, shippingAddress: e.target.value })}
                      placeholder="Enter shipping address"
                    />
                  </div>
                </div>

                <div className="procurement-quotation-received-form-group">
                  <label>Notes</label>
                  <textarea
                    rows={2}
                    value={poFormData.notes}
                    onChange={(e) => setPOFormData({ ...poFormData, notes: e.target.value })}
                    placeholder="Additional notes"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="procurement-quotation-received-form-section">
                <h3>Select Items & Quantities</h3>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                  Adjust quantities as needed (cannot exceed quoted quantities)
                </p>

                <div className="procurement-quotation-received-items-table-wrapper">
                  <table className="procurement-quotation-received-items-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '200px' }}>Item Name</th>
                        <th style={{ minWidth: '200px' }}>Description</th>
                        <th style={{ width: '120px' }}>Quoted Qty</th>
                        <th style={{ width: '120px' }}>PO Qty *</th>
                        <th style={{ width: '130px' }}>Unit Price (₹)</th>
                        <th style={{ width: '100px' }}>GST %</th>
                        <th style={{ width: '130px' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poFormData.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.itemName}</td>
                          <td>{item.description || '—'}</td>
                          <td className="text-center" style={{ fontWeight: '600' }}>
                            {item.quotedQuantity}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={item.quotedQuantity}
                              placeholder="Qty"
                              value={item.selectedQuantity}
                              onChange={(e) => handleUpdatePOItemQuantity(index, e.target.value)}
                              className="table-input text-center"
                              style={{ fontWeight: '600' }}
                            />
                          </td>
                          <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-center">{item.taxPercent}%</td>
                          <td className="text-right" style={{ fontWeight: '600', color: '#1e293b' }}>
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PO Summary */}
                <div className="procurement-quotation-received-quote-summary">
                  <div className="procurement-quotation-received-summary-row">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculatePOTotal().subtotal)}</span>
                  </div>
                  <div className="procurement-quotation-received-summary-row">
                    <span>Tax Amount:</span>
                    <span>{formatCurrency(calculatePOTotal().taxAmount)}</span>
                  </div>
                  <div className="procurement-quotation-received-summary-row procurement-quotation-received-summary-total">
                    <span><strong>Total PO Value:</strong></span>
                    <span><strong>{formatCurrency(calculatePOTotal().total)}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="procurement-quotation-received-modal-actions">
              <button
                className="procurement-quotation-received-btn-primary"
                onClick={handleCreatePOFromQuotation}
                disabled={!poFormData.expectedDelivery || !poFormData.items.some(i => i.selectedQuantity > 0)}
              >
                Create Purchase Order
              </button>
              <button
                className="procurement-quotation-received-btn-secondary"
                onClick={() => setShowCreatePOFromQuotationModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};


export default QuotationsReceived;