import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, X, Edit2, Eye, Check, XCircle, FileText, Upload, Calendar, DollarSign, TrendingUp, Clock, Package, CheckCircle, Star, AlertCircle, ShoppingCart } from 'lucide-react';
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
  const { user } = useAuth(); // Removed pagePermissions since it's not used
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCreatePOFromQuotationModal, setShowCreatePOFromQuotationModal] = useState(false);
  const [poFormData, setPOFormData] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all'
  });

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
  // Removed canDelete since it's not used

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
  }, []);

  // Rest of your code...
  /**
   * Get auth headers
   */
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

  /**
   * Fetch quotations from backend - ALREADY CORRECT (uses pageSize state)
   */
  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize, // Uses the state value
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

  // ... rest of your functions ...

  /**
   * Fetch statistics
   */
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/stats`, {
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
   * Fetch vendors for dropdown
   */
  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/dropdown`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data);
        console.log('Fetched vendors:', data);
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

    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        groupName: newGroupName,
        subGroupName: '',
        projectId: ''
      });
    }

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

    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        subGroupName: newSubGroupName,
        projectId: ''
      });
    }

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

    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        projectId: newProjectId
      });
    }
  };

  /**
   * Handle vendor selection from dropdown
   */
  const handleVendorSelection = (e) => {
    const vendorId = e.target.value ? parseInt(e.target.value) : null;

    if (vendorId) {
      // Find the selected vendor from the vendors list
      const selectedVendor = vendors.find(v => v.id === vendorId);

      if (selectedVendor) {
        // Set vendor details from dropdown data (includes phone)
        setSelectedVendorDetails({
          id: selectedVendor.id,
          name: selectedVendor.name,
          phone: selectedVendor.phone
        });

        // Update form data with vendor ID and phone
        setQuotationFormData({
          ...quotationFormData,
          vendorId: vendorId,
          vendorContact: selectedVendor.phone || '' // Auto-populate from dropdown
        });
      }
    } else {
      // Clear selection
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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('File size exceeds 5MB limit');
      e.target.value = '';
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showError('Only PDF and image files (JPG, PNG) are allowed');
      e.target.value = '';
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

    // Create preview for images
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
      // Fetch full quotation details with items
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotation.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const quotationData = await response.json();

      // Initialize PO form with quotation data
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
        // Map quotation items with quantity selection
        items: quotationData.items.map(item => ({
          quotationItemId: item.id,
          itemName: item.itemName,
          description: item.description,
          quotedQuantity: item.quantity,
          selectedQuantity: item.quantity, // Default to full quantity
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          lineTotal: 0 // Will be calculated
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

    // Validate quantity doesn't exceed quoted quantity
    if (qty > item.quotedQuantity) {
      showError(`Quantity cannot exceed quoted quantity of ${item.quotedQuantity}`);
      return;
    }

    item.selectedQuantity = qty;

    // Calculate line total
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
    // Validation
    if (!poFormData.expectedDelivery) {
      showError('Expected delivery date is required');
      return;
    }

    // Check if at least one item has quantity > 0
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
      // Filter out items with 0 quantity and prepare data
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

      // Update quotation status to "PO Created"
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
   * View quotation details - UPDATED TO SHOW FULL DETAILS
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
   * Create PO from quotation
   */
  const handleCreatePO = async (quotationId) => {
    if (!canCreate) {
      showError('You do not have permission to create purchase orders');
      return;
    }

    if (!window.confirm('Create Purchase Order from this quotation? This will also create/update the vendor.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}/create-po`, {
        credentials: "include",
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to create PO');

      const data = await response.json();
      showSuccess(`Purchase Order created successfully!`);
      setShowDetailDrawer(false);
      fetchQuotations();
      fetchStats();

    } catch (error) {
      console.error('Failed to create PO:', error);
      showError('Failed to create Purchase Order');
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

    setQuotationFormData({
      rfqId: '',
      validTill: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      projectId: projectId || '',
      category: 'IT Equipment',
      vendorId: null,
      vendorContact: '',
      vendorRating: 0,
      deliveryTime: '',
      paymentTerms: '',
      warranty: '',
      notes: '',
      items: [{ itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }]
    });

    // Reset vendor selection
    setSelectedVendorDetails(null);
    setVendors([]);

    // Set modal dropdown values
    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalProjectId(projectId || '');

    // Reset file
    setSelectedFile(null);
    setFilePreview(null);

    // Fetch data
    fetchModalGroups();
    fetchVendors(); // Fetch vendors for dropdown

    if (groupName) {
      fetchModalSubGroups(groupName);
      if (subGroupName) {
        fetchModalProjects(groupName, subGroupName);
      }
    }

    setShowUploadQuotationModal(true);
  };

  /**
   * Save new quotation with file upload
   */
  const handleSaveQuotation = async () => {
    // Validation
    if (!quotationFormData.groupName) {
      showError('Group is required');
      return;
    }

    // Check vendor contact requirement for new vendors
    if (!quotationFormData.vendorId &&
      (!quotationFormData.vendorContact || !quotationFormData.vendorContact.trim())) {
      showError('Vendor contact is required when creating a new vendor');
      return;
    }

    if (!quotationFormData.validTill) {
      showError('Valid until date is required');
      return;
    }

    // Check if valid till is in the past
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

    // Validate all items have required fields
    for (let i = 0; i < quotationFormData.items.length; i++) {
      const item = quotationFormData.items[i];
      if (!item.itemName || !item.itemName.trim()) {
        showError(`Item ${i + 1}: Item name is required`);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        showError(`Item ${i + 1}: Quantity must be greater than 0`);
        return;
      }
      if (item.unitPrice === null || item.unitPrice === undefined || item.unitPrice < 0) {
        showError(`Item ${i + 1}: Unit price must be 0 or greater`);
        return;
      }
    }

    setLoading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();

      // Clean items - remove calculated fields that DB generates
      const cleanedItems = quotationFormData.items.map(item => ({
        itemName: item.itemName.trim(),
        description: item.description ? item.description.trim() : '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPercent: item.taxPercent
      }));

      // Add quotation data as JSON
      const quotationData = {
        vendorId: quotationFormData.vendorId || null,
        rfqId: quotationFormData.rfqId ? quotationFormData.rfqId.trim() : null,
        validTill: quotationFormData.validTill,
        groupName: quotationFormData.groupName,
        subGroupName: quotationFormData.subGroupName || null,
        projectId: quotationFormData.projectId || null,
        category: quotationFormData.category,
        vendorContact: quotationFormData.vendorContact ? quotationFormData.vendorContact.trim() : null,
        deliveryTime: quotationFormData.deliveryTime ? quotationFormData.deliveryTime.trim() : null,
        paymentTerms: quotationFormData.paymentTerms ? quotationFormData.paymentTerms.trim() : null,
        warranty: quotationFormData.warranty ? quotationFormData.warranty.trim() : null,
        notes: quotationFormData.notes ? quotationFormData.notes.trim() : null,
        items: cleanedItems,
        type: 'Procurement',
        status: 'New'
      };

      formData.append('quotation', new Blob([JSON.stringify(quotationData)], {
        type: 'application/json'
      }));

      // Add file if selected
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/quotations/procurement`, {
        credentials: "include",
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-User-Id': user?.id || localStorage.getItem('userId'),
          'X-User-Role': user?.role || localStorage.getItem('userRole')
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create quotation');
      }

      const data = await response.json();
      showSuccess(`Quotation uploaded successfully!`);
      setShowUploadQuotationModal(false);
      setSelectedFile(null);
      setFilePreview(null);
      setSelectedVendorDetails(null);
      setVendors([]);
      fetchQuotations();
      fetchStats();

    } catch (error) {
      console.error('Failed to save quotation:', error);
      showError(error.message || 'Failed to upload quotation');
    } finally {
      setLoading(false);
    }
  };

  // Add/Remove/Update item handlers
  const handleAddQuotationItem = () => {
    if (quotationFormData) {
      setQuotationFormData({
        ...quotationFormData,
        items: [...quotationFormData.items, { itemName: '', description: '', quantity: 1, unitPrice: 0, taxPercent: 18 }]
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

    const subtotal = quotationFormData.items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);

    const taxAmount = quotationFormData.items.reduce((sum, item) => {
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>


        {/* Pagination */}
        {/* Pagination - UPDATED */}
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
                  setCurrentPage(0); // Reset to first page when changing page size
                  // fetchQuotations will be called automatically by useEffect
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
      {/* Detail Drawer - UPDATED WITH FULL DETAILS */}
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - COMPLETE CODE WITH PROPER ALIGNMENT */}
      {showUploadQuotationModal && quotationFormData && (
        <div className="procurement-quotation-received-modal-overlay" onClick={() => setShowUploadQuotationModal(false)}>
          <div className="procurement-quotation-received-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-quotation-received-modal-header">
              <h2>Upload New Quotation</h2>
              <button className="procurement-quotation-received-modal-close" onClick={() => setShowUploadQuotationModal(false)}>
                ✕
              </button>
            </div>

            <div className="procurement-quotation-received-upload-form">

              {/* Vendor Selection Section */}
              <div className="procurement-quotation-received-form-section">
                <h3>Vendor Information</h3>

                <div className="procurement-quotation-received-form-row">
                  {/* Vendor Dropdown */}
                  <div className="procurement-quotation-received-form-group">
                    <label>Select Existing Vendor (Optional)</label>
                    <select
                      value={quotationFormData.vendorId || ''}
                      onChange={handleVendorSelection}
                    >
                      <option value="">-- Create New Vendor or Select Existing --</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                          {vendor.phone ? ` - ${vendor.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                      {quotationFormData.vendorId
                        ? 'Existing vendor selected - contact info loaded automatically'
                        : 'Leave blank to create a new vendor entry'}
                    </small>
                  </div>

                  {/* Vendor Contact - Show only when NO existing vendor is selected */}
                  {!quotationFormData.vendorId && (
                    <div className="procurement-quotation-received-form-group">
                      <label>Vendor Contact *</label>
                      <input
                        type="text"
                        value={quotationFormData.vendorContact}
                        onChange={(e) => setQuotationFormData({
                          ...quotationFormData,
                          vendorContact: e.target.value
                        })}
                        placeholder="Enter phone/email for new vendor"
                      />
                      <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Required for new vendor creation
                      </small>
                    </div>
                  )}

                  {/* Display Vendor Details - Show only when existing vendor is selected */}
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
                          <div style={{ marginBottom: '6px' }}>
                            <strong>📞 Contact:</strong> {selectedVendorDetails.phone}
                          </div>
                        )}
                        <div style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid #bae6fd',
                          fontSize: '12px',
                          color: '#0369a1'
                        }}>
                          ✓ Vendor information will be auto-populated in the quotation
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Project Assignment Section */}
              <div className="procurement-quotation-received-form-section">
                <h3>Project Assignment</h3>
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
                    {modalGroups.length === 0 && !modalDropdownLoading.groups && (
                      <small style={{ color: '#ef4444' }}>No groups available</small>
                    )}
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
              </div>

              {/* Basic Information */}
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

              {/* File Upload Section */}
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
                </div>
              </div>

              {/* Items Section */}
              <div className="procurement-quotation-received-form-section">
                <div className="procurement-quotation-received-section-header">
                  <h3>Quotation Items *</h3>
                  <button
                    type="button"
                    className="procurement-quotation-received-btn-add-item"
                    onClick={handleAddQuotationItem}
                  >
                    + Add Item
                  </button>
                </div>

                {/* Items Table with Headers */}
                <div className="procurement-quotation-received-items-table-wrapper">
                  <table className="procurement-quotation-received-items-table">
                    <thead>
                      <tr>
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
                        const qty = parseFloat(item.quantity) || 0;
                        const price = parseFloat(item.unitPrice) || 0;
                        const tax = parseFloat(item.taxPercent) || 0;
                        const lineTotal = qty * price;
                        const taxAmount = lineTotal * (tax / 100);
                        const totalWithTax = lineTotal + taxAmount;

                        return (
                          <tr key={index}>
                            <td>
                              <input
                                type="text"
                                placeholder="Enter item name"
                                value={item.itemName}
                                onChange={(e) => handleUpdateQuotationItem(index, 'itemName', e.target.value)}
                                className="table-input"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="Enter description"
                                value={item.description}
                                onChange={(e) => handleUpdateQuotationItem(index, 'description', e.target.value)}
                                className="table-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuotationItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                                className="table-input text-center"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateQuotationItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="table-input text-right"
                              />
                            </td>
                            <td>
                              <select
                                value={item.taxPercent}
                                onChange={(e) => handleUpdateQuotationItem(index, 'taxPercent', parseFloat(e.target.value) || 0)}
                                className="table-input"
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td className="text-right" style={{ fontWeight: '600', color: '#1e293b' }}>
                              {formatCurrency(totalWithTax)}
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
              </div>
            </div>

            <div className="procurement-quotation-received-modal-actions">
              <button className="procurement-quotation-received-btn-primary" onClick={handleSaveQuotation}>
                Upload Quotation
              </button>
              <button className="procurement-quotation-received-btn-secondary" onClick={() => setShowUploadQuotationModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PO Modal */}
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