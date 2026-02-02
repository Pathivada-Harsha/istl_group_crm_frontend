import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, X, Edit2, Eye, Package, Truck, CheckCircle, IndianRupee,Clock, FileText, TrendingUp, DollarSign, AlertCircle, Trash2 } from 'lucide-react';
import '../pages-css/PurchaseOrders.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal';
const API_BASE_URL = process.env.REACT_APP_API_URL;

const PurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPOId, setEditingPOId] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    paymentStatus: 'all'
  });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null,
    onCancel: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });
  const GST_OPTIONS = [0, 5, 12, 18, 28];
  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const pageSize = 10;

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryFormData, setDeliveryFormData] = useState(null);
  const [stats, setStats] = useState(null);

  // CREATE PO MODAL STATE
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [quotations, setQuotations] = useState([]);

  // ✅ INDEPENDENT MODAL DROPDOWNS (not linked to main filter)
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalDropdownLoading, setModalDropdownLoading] = useState({
    groups: false,
    subGroups: false,
    projects: false
  });

  // Order book items (fallback when no quotations)
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);

  // New vendor support
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [createPOFormData, setCreatePOFormData] = useState({
    quotationId: '',
    quotation: null,
    vendorId: null,
    vendorName: '',
    vendorContact: '',
    groupName: '',
    subGroupName: '',
    projectId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    paymentTerms: '',
    shippingAddress: '',
    notes: '',
    items: []
  });
  const showConfirmation = (config) => {
    return new Promise((resolve) => {
      setConfirmModal({
        show: true,
        title: config.title || 'Confirm Action',
        message: config.message,
        type: config.type || 'confirm',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        onConfirm: () => {
          setConfirmModal({ ...confirmModal, show: false });
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal({ ...confirmModal, show: false });
          resolve(false);
        }
      });
    });
  };
  // ✅ NEW: Manual item addition support
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    itemName: '',
    itemDescription: '',
    quantity: '',      // Changed from 0
    unitPrice: '',     // Changed from 0
    gst: 18,
    discount: ''       // Changed from 0
  });

  // Fetch POs on mount and filter change
  useEffect(() => {
    fetchPurchaseOrders();
  }, [groupName, subGroupName, projectId, currentPage, filters.status, filters.paymentStatus, filters.search]);


  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [groupName, subGroupName, projectId]);

  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors();
  }, []);

  /**
   * Get auth headers
   */
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole')
  });

  /**
   * ✅ Fetch modal groups (independent)
   */
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/groups`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setModalGroups(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setModalGroups([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, groups: false }));
    }
  };

  /**
   * ✅ Fetch modal subgroups (independent)
   */
  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) {
      setModalSubGroups([]);
      setModalProjects([]);
      return;
    }

    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filters/subgroups?groupName=${encodeURIComponent(groupName)}`,
        {
          credentials: "include",
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setModalSubGroups(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch subgroups:', error);
      setModalSubGroups([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, subGroups: false }));
    }
  };

  /**
   * ✅ Fetch modal projects (independent)
   */
  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) {
      setModalProjects([]);
      return;
    }

    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filters/projects?groupName=${encodeURIComponent(groupName)}&subGroupName=${encodeURIComponent(subGroupName)}`,
        {
          credentials: "include",
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setModalProjects(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setModalProjects([]);
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, projects: false }));
    }
  };

  /**
   * ✅ Fetch quotations filtered by group/subgroup/project
   */
  const fetchFilteredQuotations = async (groupName, subGroupName, projectId) => {
    try {
      let url = `${API_BASE_URL}/api/quotations/approved?`;

      if (groupName) url += `groupName=${encodeURIComponent(groupName)}&`;
      if (subGroupName) url += `subGroupName=${encodeURIComponent(subGroupName)}&`;
      if (projectId) url += `projectId=${encodeURIComponent(projectId)}`;

      console.log('📡 Fetching approved quotations:', url);

      const response = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setQuotations(data || []);
        console.log('✅ Loaded quotations:', data.length);
      }
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      setQuotations([]);
    }
  };
  const handleEditPO = async (poId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/${poId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');

      const poData = await response.json();
      console.log('📝 Editing PO:', poData);

      // Set edit mode
      setIsEditMode(true);
      setEditingPOId(poId);

      // Set modal dropdowns
      setModalGroupName(poData.groupName || '');
      setModalSubGroupName(poData.subGroupName || '');
      setModalProjectId(poData.projectId || '');

      // Fetch dropdown data
      await fetchModalGroups();
      if (poData.groupName) {
        await fetchModalSubGroups(poData.groupName);
      }
      if (poData.groupName && poData.subGroupName) {
        await fetchModalProjects(poData.groupName, poData.subGroupName);
      }

      // Fetch vendors
      await fetchVendors(poData.groupName, poData.subGroupName);

      // Convert items to editable format
      const items = (poData.items || []).map((item, index) => ({
        id: item.id || `item-${index}`,
        itemName: item.itemName,
        itemDescription: item.description || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice || '',  // Empty string if no price
        gst: item.taxPercent || 18,
        discount: item.discount || '',
        lineTotal: item.lineTotal || 0,
        selected: true,
        quotedQuantity: item.quotedQuantity || null
      }));

      // Set form data
      setCreatePOFormData({
        quotationId: poData.quotationId || '',
        quotation: null,
        vendorId: poData.vendorId || null,
        vendorName: poData.vendorName || '',
        vendorContact: poData.vendorContact || '',
        groupName: poData.groupName || '',
        subGroupName: poData.subGroupName || '',
        projectId: poData.projectId || '',
        orderDate: poData.orderDate ? new Date(poData.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDelivery: poData.expectedDelivery ? new Date(poData.expectedDelivery).toISOString().split('T')[0] : '',
        paymentTerms: poData.paymentTerms || '',
        shippingAddress: poData.deliveryAddress || '',
        notes: poData.notes || '',
        items: items
      });

      setShowNewVendorForm(false);
      setShowCreatePOModal(true);

    } catch (error) {
      console.error('Failed to load PO for editing:', error);
      showError('Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  };
  const handleDeletePO = async (poId) => {
    const confirmed = await showConfirmation({
      title: 'Delete Purchase Order',
      message: 'Are you sure you want to delete this purchase order? This action cannot be undone.',
      type: 'alert',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/${poId}`, {
        credentials: "include",
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to delete PO');

      showSuccess('Purchase order deleted successfully');
      fetchPurchaseOrders();
      fetchStats();

    } catch (error) {
      console.error('Failed to delete PO:', error);
      showError('Failed to delete purchase order');
    } finally {
      setLoading(false);
    }
  };
  const handleUpdatePOItemGST = (index, gst) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    item.gst = parseFloat(gst);

    // Recalculate line total if quantity and price exist
    if (item.quantity && item.unitPrice) {
      const baseAmount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      const discountAmount = baseAmount * ((parseFloat(item.discount) || 0) / 100);
      const taxableAmount = baseAmount - discountAmount;
      const gstAmount = taxableAmount * (parseFloat(gst) / 100);
      item.lineTotal = taxableAmount + gstAmount;
    }

    setCreatePOFormData({ ...createPOFormData, items: newItems });
  };
  /**
   * ✅ Fetch order book items by project (fallback when no quotations)
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
   * ✅ Handle modal group change
   */
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setQuotations([]);
    setOrderBookItems([]);

    setCreatePOFormData(prev => ({
      ...prev,
      groupName: newGroupName,
      subGroupName: '',
      projectId: '',
      items: []
    }));

    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
      fetchFilteredQuotations(newGroupName, null, null);
      // ✅ Fetch vendors filtered by group
      fetchVendors(newGroupName, null);
    } else {
      // ✅ Fetch all vendors if no group
      fetchVendors();
    }
  };

  /**
   * ✅ Handle modal subgroup change
   */
  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setModalProjects([]);
    setQuotations([]);
    setOrderBookItems([]);

    setCreatePOFormData(prev => ({
      ...prev,
      subGroupName: newSubGroupName,
      projectId: '',
      items: []
    }));

    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
      fetchFilteredQuotations(modalGroupName, newSubGroupName, null);
      // ✅ Fetch vendors filtered by group and subgroup
      fetchVendors(modalGroupName, newSubGroupName);
    }
  };

  /**
   * ✅ Handle modal project change
   */
  const handleModalProjectChange = async (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setQuotations([]);
    setOrderBookItems([]);

    setCreatePOFormData(prev => ({
      ...prev,
      projectId: newProjectId,
      quotationId: '',
      quotation: null,
      items: []
    }));

    if (newProjectId) {
      // Fetch quotations
      await fetchFilteredQuotations(modalGroupName, modalSubGroupName, newProjectId);
      // ✅ ALWAYS fetch order book items
      await fetchOrderBookItems(newProjectId);
    }
  };

  /**
   * ✅ Handle vendor type toggle (existing vs new)
   */
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new');

    if (type === 'new') {
      // ✅ Switching to new vendor - clear everything
      setCreatePOFormData({
        ...createPOFormData,
        vendorId: null,
        vendorName: '',
        vendorContact: ''
      });
    } else {
      // ✅ Switching to existing vendor - clear new vendor fields
      setCreatePOFormData({
        ...createPOFormData,
        vendorId: null, // ✅ Reset to force selection
        vendorName: '',
        vendorContact: ''
      });
    }
  };

  /**
   * ✅ Handle new vendor contact change (restrict to 10 digits)
   */
  const handleNewVendorContactChange = (value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setCreatePOFormData({
      ...createPOFormData,
      vendorContact: cleaned
    });
  };
  /**
   * ✅ NEW: Handle "Skip Quotation" - Load order book items directly
   */
  const handleSkipQuotationLoadOrderBook = () => {
    if (orderBookItems.length === 0) {
      showError('No order book items available');
      return;
    }

    // Clear quotation selection
    setCreatePOFormData(prev => ({
      ...prev,
      quotationId: '',
      quotation: null,
      items: []
    }));
    /**
     * ✅ Load order book items into PO form
     */


    setCreatePOFormData({
      ...createPOFormData,
      items: poItems
    });

    showSuccess(`Loaded ${poItems.length} items from order book`);
  };
  const handleLoadOrderBookItems = () => {
    if (orderBookItems.length === 0) {
      showError('No order book items available');
      return;
    }



    setCreatePOFormData(prev => ({
      ...prev,
      quotationId: '', // ✅ No quotation
      quotation: null,
      items: poItems
    }));

    showSuccess(`Loaded ${poItems.length} items from order book for new vendor`);
  };
  const poItems = orderBookItems.map((item, index) => ({
    id: `orderbook-${index}`,
    itemName: item.itemName,
    itemDescription: item.specification || item.description || '',
    quotedQuantity: item.quantity || 1,
    quantity: item.quantity || 1,
    unitPrice: 0, // User must enter vendor price
    gst: item.taxPercent || 18,
    discount: 0,
    lineTotal: 0,
    selected: true
  }));
  /**
   * ✅ Handle quotation selection
   */
  const handleQuotationSelect = async (quotationId) => {
    if (!quotationId) {
      setCreatePOFormData({
        ...createPOFormData,
        quotationId: '',
        quotation: null,
        items: [],
        vendorId: null,
        vendorName: '',
        vendorContact: ''
      });
      setShowNewVendorForm(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const quotationData = await response.json();

      // Map quotation items
      const poItems = quotationData.items.map((item, index) => ({
        id: `quotation-${item.id}`,
        quotationItemId: item.id,
        itemName: item.itemName,
        itemDescription: item.description || '',
        quotedQuantity: item.quantity,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gst: item.taxPercent,
        discount: 0,
        lineTotal: 0,
        selected: true
      }));

      // Calculate line totals
      poItems.forEach(item => {
        const baseAmount = item.quantity * item.unitPrice;
        const discountAmount = baseAmount * (item.discount / 100);
        const taxableAmount = baseAmount - discountAmount;
        const gstAmount = taxableAmount * (item.gst / 100);
        item.lineTotal = taxableAmount + gstAmount;
      });

      // ✅ Store vendor info from quotation
      setCreatePOFormData({
        ...createPOFormData,
        quotationId: quotationData.id,
        quotation: quotationData,
        paymentTerms: quotationData.paymentTerms || '',
        notes: quotationData.notes || '',
        items: poItems,
        // ✅ Store vendor info from quotation
        vendorId: quotationData.vendorId || null,
        vendorName: quotationData.vendorName || quotationData.vendorContact || '',
        vendorContact: quotationData.vendorContact || ''
      });

      setShowNewVendorForm(false);

    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      showError('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ NEW: Toggle item selection
   */
  const handleToggleItemSelection = (index) => {
    const newItems = [...createPOFormData.items];
    newItems[index].selected = !newItems[index].selected;
    setCreatePOFormData({ ...createPOFormData, items: newItems });
  };

  /**
   * ✅ NEW: Remove item from list
   */
  const handleRemoveItem = async (index) => {
    const confirmed = await showConfirmation({
      title: 'Remove Item',
      message: 'Are you sure you want to remove this item from the purchase order?',
      type: 'alert',
      confirmText: 'Yes, Remove',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    const newItems = createPOFormData.items.filter((_, i) => i !== index);
    setCreatePOFormData({ ...createPOFormData, items: newItems });
    showSuccess('Item removed');
  };

  /**
   * ✅ NEW: Add manual item to PO
   */
  const handleAddManualItem = () => {
    // Validation
    if (!newItem.itemName || !newItem.itemName.trim()) {
      showError('Item name is required');
      return;
    }

    if (newItem.quantity <= 0) {
      showError('Quantity must be greater than 0');
      return;
    }

    if (newItem.unitPrice <= 0) {
      showError('Unit price must be greater than 0');
      return;
    }

    // Calculate line total
    const baseAmount = newItem.quantity * newItem.unitPrice;
    const discountAmount = baseAmount * (newItem.discount / 100);
    const taxableAmount = baseAmount - discountAmount;
    const gstAmount = taxableAmount * (newItem.gst / 100);
    const lineTotal = taxableAmount + gstAmount;

    const item = {
      id: `manual-${Date.now()}`,
      itemName: newItem.itemName,
      itemDescription: newItem.itemDescription,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      gst: newItem.gst,
      discount: newItem.discount,
      lineTotal,
      selected: true,
      isManual: true // Flag to identify manual items
    };

    setCreatePOFormData(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    // Reset form
    setNewItem({
      itemName: '',
      itemDescription: '',
      quantity: 0,
      unitPrice: 0,
      gst: 18,
      discount: 0
    });

    setShowManualItemForm(false);
    showSuccess('Manual item added');
  };

  /**
   * ✅ Update PO item quantity
   */
  const handleUpdatePOItemQuantity = (index, quantity) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    const qty = parseFloat(quantity) || 0;

    // Validate quantity doesn't exceed quoted quantity (if from quotation)
    if (item.quotedQuantity && qty > item.quotedQuantity) {
      showError(`Quantity cannot exceed quoted quantity of ${item.quotedQuantity}`);
      return;
    }

    item.quantity = qty;

    // Recalculate line total
    const baseAmount = qty * item.unitPrice;
    const discountAmount = baseAmount * (item.discount / 100);
    const taxableAmount = baseAmount - discountAmount;
    const gstAmount = taxableAmount * (item.gst / 100);
    item.lineTotal = taxableAmount + gstAmount;

    setCreatePOFormData({ ...createPOFormData, items: newItems });
  };

  /**
   * ✅ Update PO item unit price
   */
  const handleUpdatePOItemPrice = (index, price) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];

    // Handle empty string - keep it empty, don't convert to 0
    item.unitPrice = price === '' ? '' : parseFloat(price) || 0;

    // Recalculate line total only if we have a valid price
    if (item.unitPrice !== '') {
      const baseAmount = item.quantity * item.unitPrice;
      const discountAmount = baseAmount * (item.discount / 100);
      const taxableAmount = baseAmount - discountAmount;
      const gstAmount = taxableAmount * (item.gst / 100);
      item.lineTotal = taxableAmount + gstAmount;
    } else {
      item.lineTotal = 0;
    }

    setCreatePOFormData({ ...createPOFormData, items: newItems });
  };

  /**
   * ✅ Calculate total value of PO (only selected items)
   */
  const calculatePOTotal = () => {
    return createPOFormData.items
      .filter(item => item.selected)
      .reduce((sum, item) => sum + item.lineTotal, 0);
  };

  /**
   * ✅ Handle create PO
   */
  const handleCreatePO = async () => {
    // Validation
    if (!modalGroupName) {
      showError('Please select a group');
      return;
    }

    if (!createPOFormData.vendorId && !showNewVendorForm) {
      showError('Please select a vendor or add a new vendor');
      return;
    }

    if (showNewVendorForm) {
      if (!createPOFormData.vendorName || !createPOFormData.vendorName.trim()) {
        showError('Vendor name is required');
        return;
      }
      if (!createPOFormData.vendorContact || createPOFormData.vendorContact.length !== 10) {
        showError('Please enter a valid 10-digit contact number');
        return;
      }
    }

    const selectedItems = createPOFormData.items.filter(item => item.selected);

    if (selectedItems.length === 0) {
      showError('Please select at least one item for the purchase order');
      return;
    }

    const hasValidQuantities = selectedItems.every(item => item.quantity && parseFloat(item.quantity) > 0);
    if (!hasValidQuantities) {
      showError('All selected items must have quantity greater than 0');
      return;
    }

    const missingPrices = selectedItems.some(item => !item.unitPrice || parseFloat(item.unitPrice) === 0);
    if (missingPrices) {
      showError('Please enter unit price for all selected items');
      return;
    }

    if (!createPOFormData.expectedDelivery) {
      showError('Expected delivery date is required');
      return;
    }

    setLoading(true);
  try {
    // ✅ Use the ACTUAL items from form state, not recreated items
    const selectedItems = createPOFormData.items.filter(item => item.selected);
    
    // Map to API format
    const poItems = selectedItems.map(({ itemName, itemDescription, quantity, unitPrice, gst, discount }) => ({
      itemName,
      itemDescription,
      quantity: parseFloat(quantity),
      unitPrice: parseFloat(unitPrice) || 0, // ✅ Convert to number, default 0
      gst: parseFloat(gst),
      discount: parseFloat(discount) || 0
    }));

    const poData = {
      quotationId: createPOFormData.quotationId || null,
      vendorId: createPOFormData.vendorId || null,
      vendorName: showNewVendorForm ? createPOFormData.vendorName : null,
      vendorContact: createPOFormData.vendorContact || null,
      rfqId: createPOFormData.quotation?.rfqId || null,
      groupName: modalGroupName,
      subGroupName: modalSubGroupName || null,
      projectId: modalProjectId || null,
      orderDate: createPOFormData.orderDate,
      expectedDelivery: createPOFormData.expectedDelivery,
      paymentTerms: createPOFormData.paymentTerms,
      shippingAddress: createPOFormData.shippingAddress,
      notes: createPOFormData.notes,
      items: poItems, // ✅ Now using correct items
      status: 'Draft',
      paymentStatus: 'Pending'
    };

    let response;
    if (isEditMode && editingPOId) {
      // UPDATE existing PO
      response = await fetch(`${API_BASE_URL}/api/purchase-orders/${editingPOId}`, {
        credentials: "include",
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(poData)
      });
    } else {
      // CREATE new PO
      const endpoint = createPOFormData.quotationId
        ? `${API_BASE_URL}/api/purchase-orders/from-quotation`
        : `${API_BASE_URL}/api/purchase-orders`;

      response = await fetch(endpoint, {
        credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(poData)
      });
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} PO`);
    }

    const result = await response.json();
    const poNo = result.poNo || result.data?.poNo;

    showSuccess(
      isEditMode 
        ? `Purchase Order ${poNo} updated successfully!`
        : `Purchase Order ${poNo} created successfully!`
    );

    handleCloseCreatePOModal();
    fetchPurchaseOrders();
    fetchStats();

  } catch (error) {
    console.error(`Failed to ${isEditMode ? 'update' : 'create'} PO:`, error);
    showError(error.message || `Failed to ${isEditMode ? 'update' : 'create'} purchase order`);
  } finally {
    setLoading(false);
  }

  };

  /**
   * ✅ Handle open create PO modal
   */
  const handleOpenCreatePO = () => {
    setIsEditMode(false);
    setEditingPOId(null);
    setModalGroupName('');
    setModalSubGroupName('');
    setModalProjectId('');

    setCreatePOFormData({
      quotationId: '',
      quotation: null,
      vendorId: null,
      vendorName: '',
      vendorContact: '',
      groupName: '',
      subGroupName: '',
      projectId: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      paymentTerms: '',
      shippingAddress: '',
      notes: '',
      items: []
    });

    setShowNewVendorForm(false);
    setShowManualItemForm(false);
    setQuotations([]);
    setOrderBookItems([]);

    fetchModalGroups();
    fetchVendors();

    setShowCreatePOModal(true);
  };

  /**
   * ✅ Handle close create PO modal
   */
  const handleCloseCreatePOModal = () => {
    setShowCreatePOModal(false);
    setIsEditMode(false);        // Reset edit mode
    setEditingPOId(null);         // Clear editing ID
    setModalGroupName('');
    setModalSubGroupName('');
    setModalProjectId('');
    setModalGroups([]);
    setModalSubGroups([]);
    setModalProjects([]);
    setQuotations([]);
    setOrderBookItems([]);
    setShowNewVendorForm(false);
    setShowManualItemForm(false);

    setCreatePOFormData({
      quotationId: '',
      quotation: null,
      vendorId: null,
      vendorName: '',
      vendorContact: '',
      groupName: '',
      subGroupName: '',
      projectId: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      paymentTerms: '',
      shippingAddress: '',
      notes: '',
      items: []
    });
  };

  /**
   * Fetch purchase orders from backend
   */
  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        sortBy: 'orderDate',
        sortDirection: 'DESC'
      });

      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);

      // ✅ ADDED: Send paymentStatus to backend
      if (filters.paymentStatus !== 'all') params.append('paymentStatus', filters.paymentStatus);

      if (filters.search) params.append('searchTerm', filters.search);

      const response = await fetch(`${API_BASE_URL}/api/purchase-orders?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch purchase orders');

      const data = await response.json();
      setPurchaseOrders(data.purchaseOrders || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);

    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      showError('Failed to load purchase orders');
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch statistics
   */
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/stats?${params}`, {
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
   * Fetch vendors
   */
  const fetchVendors = async (groupName = null, subGroupName = null) => {
    try {
      let url = `${API_BASE_URL}/api/vendors?page=0&size=1000`;

      // ✅ Add filters
      if (groupName) url += `&groupName=${encodeURIComponent(groupName)}`;
      if (subGroupName) url += `&subGroupName=${encodeURIComponent(subGroupName)}`;

      const response = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
        console.log(`✅ Loaded ${data.vendors?.length || 0} vendors for group: ${groupName}, subgroup: ${subGroupName}`);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    }
  };

  /**
   * View PO details with items
   */
  const handleViewPO = async (po) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/${po.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');

      const data = await response.json();
      setSelectedPO(data);
      setShowDetailDrawer(true);
    } catch (error) {
      console.error('Failed to fetch PO details:', error);
      showError('Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update PO status
   */
  const handleUpdateStatus = async (poId, newStatus) => {
    const confirmed = await showConfirmation({
      title: 'Update Status',
      message: `Are you sure you want to change the status to "${newStatus}"?`,
      type: 'confirm',
      confirmText: 'Yes, Update',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/${poId}/status`, {
        credentials: "include",
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');

      showSuccess(`PO status updated to ${newStatus}`);
      fetchPurchaseOrders();
      fetchStats();
      setShowDetailDrawer(false);

    } catch (error) {
      console.error('Failed to update status:', error);
      showError('Failed to update PO status');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open delivery modal
   */
  const handleOpenDeliveryModal = (po, item) => {
    setDeliveryFormData({
      poId: po.id,
      itemId: item.id,
      itemName: item.itemName,
      orderedQty: item.quantity,
      deliveredQty: item.deliveredQty,
      pendingQty: item.pendingQty,
      newDeliveryQty: 0
    });
    setShowDeliveryModal(true);
  };

  /**
   * Mark item as delivered
   */
  const handleMarkDelivered = async () => {
    if (!deliveryFormData || deliveryFormData.newDeliveryQty <= 0) {
      showError('Please enter a valid delivery quantity');
      return;
    }

    if (deliveryFormData.newDeliveryQty > deliveryFormData.pendingQty) {
      showError('Delivery quantity cannot exceed pending quantity');
      return;
    }

    const confirmed = await showConfirmation({
      title: 'Confirm Delivery',
      message: `Record delivery of ${deliveryFormData.newDeliveryQty} units for ${deliveryFormData.itemName}?`,
      type: 'confirm',
      confirmText: 'Confirm Delivery',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/purchase-orders/${deliveryFormData.poId}/items/${deliveryFormData.itemId}/deliver`,
        {
          credentials: "include",
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ deliveredQty: deliveryFormData.newDeliveryQty })
        }
      );

      if (!response.ok) throw new Error('Failed to mark delivery');

      showSuccess('Delivery recorded successfully! Vendor stats updated.');
      setShowDeliveryModal(false);

      if (selectedPO) {
        handleViewPO(selectedPO);
      }

      fetchPurchaseOrders();
      fetchStats();

    } catch (error) {
      console.error('Failed to mark delivery:', error);
      showError('Failed to record delivery');
    } finally {
      setLoading(false);
    }
  };
  const handleVendorSelection = (e) => {
    const vendorId = e.target.value ? parseInt(e.target.value) : null;

    // ✅ Find vendor and store name and contact
    const selectedVendor = vendors.find(v => v.id === vendorId);

    setCreatePOFormData({
      ...createPOFormData,
      vendorId: vendorId,
      // ✅ Store vendor name and contact from selected vendor
      vendorName: selectedVendor?.name || '',
      vendorContact: selectedVendor?.contactNumber || selectedVendor?.phone || ''
    });
  };
  /**
   * View vendor's purchase orders
   */
  const handleViewVendorPOs = async (vendorId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/vendor/${vendorId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch vendor POs');

      const data = await response.json();
      console.log('Vendor POs:', data);
      showSuccess(`Found ${data.length} purchase orders for this vendor`);

    } catch (error) {
      console.error('Failed to fetch vendor POs:', error);
      showError('Failed to load vendor purchase orders');
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'Draft': 'po-badge-draft',
      'Approved': 'po-badge-approved',
      'Ordered': 'po-badge-ordered',
      'In-Transit': 'po-badge-transit',
      'Delivered': 'po-badge-delivered',
      'Cancelled': 'po-badge-cancelled'
    };
    return statusClasses[status] || '';
  };

  // Get payment status badge class
  const getPaymentBadgeClass = (status) => {
    const paymentClasses = {
      'Pending': 'po-payment-pending',
      'Partially Paid': 'po-payment-partial',
      'Paid': 'po-payment-paid'
    };
    return paymentClasses[status] || '';
  };

  // Calculate delivery progress
  const calculateDeliveryProgress = (po) => {
    if (!po.totalItemsOrdered || po.totalItemsOrdered === 0) return 0;
    return Math.round((po.totalItemsDelivered / po.totalItemsOrdered) * 100);
  };

  // KPI data from stats
  const kpiData = stats ? [
    { title: 'Total POs', value: stats.totalPOs.toString(), icon: <FileText size={32} />, color: '#2563eb' },
    { title: 'In Transit', value: stats.inTransit.toString(), icon: <Truck size={32} />, color: '#f59e0b' },
    { title: 'Delivered', value: stats.delivered.toString(), icon: <CheckCircle size={32} />, color: '#22c55e' },
    { title: 'Total Value', value: formatCurrency(stats.totalValue), icon: <IndianRupee size={32} />, color: '#8b5cf6' }
  ] : [];

  return (
    <div className="purchase-orders-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />
      {/* Header */}
      <div className="purchase-orders-header">
        <div className="purchase-orders-breadcrumb">
          Dashboard &gt; Procurement &gt; Purchase Orders
        </div>

        <div className="page-header-with-filter">
          <h1 className="purchase-orders-title">
            Purchase Orders <span className="purchase-orders-count">({totalElements})</span>
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
      <div className="purchase-orders-action-bar">
        <div className="purchase-orders-search-filters">
          <input
            type="text"
            placeholder="Search by PO Number, Vendor ID, RFQ ID..."
            className="purchase-orders-search"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(0);
            }}
          />

          <select
            className="purchase-orders-filter"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Ordered">Ordered</option>
            <option value="In-Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            className="purchase-orders-filter"
            value={filters.paymentStatus}
            onChange={(e) => {
              setFilters({ ...filters, paymentStatus: e.target.value });
              setCurrentPage(0); // ✅ Reset to first page when filter changes
            }}
          >
            <option value="all">All Payment Status</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="purchase-orders-actions">
          <button
            className="purchase-orders-btn-primary"
            onClick={handleOpenCreatePO}
          >
            <Plus size={18} /> Create PO
          </button>
          <button className="purchase-orders-btn-secondary">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="purchase-orders-kpi-grid">
          {kpiData.map((kpi, index) => (
            <div key={index} className="purchase-orders-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="purchase-orders-kpi-icon">{kpi.icon}</div>
              <div className="purchase-orders-kpi-content">
                <div className="purchase-orders-kpi-value">{kpi.value}</div>
                <div className="purchase-orders-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Purchase Orders Table */}
      <div className="purchase-orders-table-container">
        <table className="purchase-orders-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Vendor ID</th>
              <th>Vendor Name</th>
              <th>Order Date</th>
              <th>Total Value</th>
              <th>Delivery Progress</th>
              <th>Payment Status</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  No purchase orders found
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => {
                const progress = calculateDeliveryProgress(po);
                return (
                  <tr key={po.id} className="purchase-orders-table-row">
                    <td className="purchase-orders-table-id">{po.poNo}</td>
                    <td>
                      <button
                        className="vendor-link"
                        onClick={() => handleViewVendorPOs(po.vendorId)}
                      >
                        Vendor #{po.vendorId}
                      </button>
                    </td>
                    <td>{po.vendorName}</td>
                    <td>{formatDate(po.orderDate)}</td>
                    <td className="purchase-orders-table-value">{formatCurrency(po.totalValue)}</td>
                    <td>
                      <div className="delivery-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {po.totalItemsDelivered}/{po.totalItemsOrdered} items ({progress}%)
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`purchase-orders-badge ${getPaymentBadgeClass(po.paymentStatus)}`}>
                        {po.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`purchase-orders-badge ${getStatusBadgeClass(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td>
                      <div className="purchase-orders-actions-cell">
                        <button
                          className="purchase-orders-action-btn"
                          onClick={() => handleViewPO(po)}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="purchase-orders-action-btn"
                          onClick={() => handleEditPO(po.id)}
                          title="Edit PO"
                          style={{ color: '#3b82f6' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        {po.status !== 'Delivered' && po.status !== 'Cancelled' && (
                          <>
                            <button
                              className="purchase-orders-action-btn"
                              onClick={() => handleUpdateStatus(po.id, 'Delivered')}
                              title="Mark Delivered"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              className="purchase-orders-action-btn"
                              onClick={() => handleDeletePO(po.id)}
                              title="Delete PO"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="table-footer">
          <span>
            Showing {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} purchase orders
          </span>
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

      {/* Detail Drawer */}
      {showDetailDrawer && selectedPO && (
        <div className="purchase-orders-drawer-overlay" onClick={() => setShowDetailDrawer(false)}>
          <div className="purchase-orders-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-drawer-header">
              <div>
                <h2>{selectedPO.poNo}</h2>
                <p className="purchase-orders-drawer-subtitle">Vendor ID: {selectedPO.vendorId}</p>
              </div>
              <button className="purchase-orders-drawer-close" onClick={() => setShowDetailDrawer(false)}>
                ✕
              </button>
            </div>

            <div className="purchase-orders-drawer-content">
              {/* PO Details */}
              <div className="purchase-orders-drawer-section">
                <h3>Purchase Order Details</h3>
                <div className="po-details-grid">
                  <div className="po-detail-item">
                    <span className="po-detail-label">Status:</span>
                    <span className={`purchase-orders-badge ${getStatusBadgeClass(selectedPO.status)}`}>
                      {selectedPO.status}
                    </span>
                  </div>
                  <div className="po-detail-item">
                    <span className="po-detail-label">Payment:</span>
                    <span className={`purchase-orders-badge ${getPaymentBadgeClass(selectedPO.paymentStatus)}`}>
                      {selectedPO.paymentStatus}
                    </span>
                  </div>
                  <div className="po-detail-item">
                    <span className="po-detail-label">Order Date:</span>
                    <span>{formatDate(selectedPO.orderDate)}</span>
                  </div>
                  <div className="po-detail-item">
                    <span className="po-detail-label">Expected Delivery:</span>
                    <span>{formatDate(selectedPO.expectedDelivery)}</span>
                  </div>
                  <div className="po-detail-item">
                    <span className="po-detail-label">Total Value:</span>
                    <span className="po-value">{formatCurrency(selectedPO.totalValue)}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="purchase-orders-drawer-section">
                <h3>Order Items</h3>
                <table className="po-items-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Ordered</th>
                      <th>Delivered</th>
                      <th>Pending</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items && selectedPO.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.itemName}</td>
                        <td>{item.quantity}</td>
                        <td className="delivered-qty">{item.deliveredQty}</td>
                        <td className="pending-qty">{item.pendingQty}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{formatCurrency(item.lineTotal)}</td>
                        <td>
                          {item.pendingQty > 0 && selectedPO.status !== 'Cancelled' && (
                            <button
                              className="purchase-orders-btn-small"
                              onClick={() => handleOpenDeliveryModal(selectedPO, item)}
                            >
                              Mark Delivered
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="purchase-orders-drawer-actions">
                {selectedPO.status !== 'Delivered' && selectedPO.status !== 'Cancelled' && (
                  <>
                    <button
                      className="purchase-orders-btn-primary"
                      onClick={() => handleUpdateStatus(selectedPO.id, 'In-Transit')}
                    >
                      Mark In Transit
                    </button>
                    <button
                      className="purchase-orders-btn-primary"
                      onClick={() => handleUpdateStatus(selectedPO.id, 'Delivered')}
                    >
                      Mark All Delivered
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && deliveryFormData && (
        <div className="purchase-orders-modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="purchase-orders-delivery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-modal-header">
              <h2>Mark Item Delivered</h2>
              <button className="purchase-orders-modal-close" onClick={() => setShowDeliveryModal(false)}>
                ✕
              </button>
            </div>

            <div className="purchase-orders-modal-content">
              <div className="delivery-item-info">
                <h3>{deliveryFormData.itemName}</h3>
                <div className="delivery-stats">
                  <div className="delivery-stat">
                    <span className="delivery-stat-label">Ordered:</span>
                    <span className="delivery-stat-value">{deliveryFormData.orderedQty}</span>
                  </div>
                  <div className="delivery-stat">
                    <span className="delivery-stat-label">Already Delivered:</span>
                    <span className="delivery-stat-value">{deliveryFormData.deliveredQty}</span>
                  </div>
                  <div className="delivery-stat">
                    <span className="delivery-stat-label">Pending:</span>
                    <span className="delivery-stat-value pending">{deliveryFormData.pendingQty}</span>
                  </div>
                </div>
              </div>

              <div className="delivery-form-group">
                <label>Quantity Delivered Now *</label>
                <input
                  type="number"
                  min="0"
                  max={deliveryFormData.pendingQty}
                  value={deliveryFormData.newDeliveryQty}
                  onChange={(e) => setDeliveryFormData({
                    ...deliveryFormData,
                    newDeliveryQty: parseFloat(e.target.value) || 0
                  })}
                  placeholder="Enter quantity delivered"
                />
                <small>Maximum: {deliveryFormData.pendingQty} units</small>
              </div>
            </div>

            <div className="purchase-orders-modal-actions">
              <button
                className="purchase-orders-btn-primary"
                onClick={handleMarkDelivered}
                disabled={deliveryFormData.newDeliveryQty <= 0}
              >
                Confirm Delivery
              </button>
              <button
                className="purchase-orders-btn-secondary"
                onClick={() => setShowDeliveryModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PO Modal - COMPLETE UPDATED VERSION */}


      {showCreatePOModal && (
        <div className="purchase-orders-modal-overlay" onClick={handleCloseCreatePOModal}>
          <div className="purchase-orders-create-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="purchase-orders-modal-header">
              <h2>{isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <button className="purchase-orders-modal-close" onClick={handleCloseCreatePOModal}>
                <X size={24} />
              </button>
            </div>

            <div className="purchase-orders-modal-content">

              {/* ========== STEP 1: PROJECT SELECTION ========== */}
              <div className="po-form-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '2px solid #e2e8f0' }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📂</span> Step 1: Select Project
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Choose a project to load approved quotations or order book items
                </p>

                <div className="po-form-row">
                  <div className="po-form-group">
                    <label>Group *</label>
                    <select
                      value={modalGroupName}
                      onChange={handleModalGroupChange}
                      disabled={modalDropdownLoading.groups || isEditMode}  // Add isEditMode
                      style={{ width: '100%', padding: '10px', fontSize: '14px' }}
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

                  <div className="po-form-group">
                    <label>Sub Group</label>
                    <select
                      value={modalSubGroupName}
                      onChange={handleModalSubGroupChange}
                      disabled={!modalGroupName || modalDropdownLoading.subGroups || isEditMode}  // Add isEditMode
                      style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                    >
                      <option value="">
                        {modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub Group'}
                      </option>
                      {modalSubGroups.map((sub, index) => (
                        <option key={sub.value || index} value={sub.value}>
                          {sub.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="po-form-group">
                    <label>Project *</label>
                    <select
                      value={modalProjectId}
                      onChange={handleModalProjectChange}
                      disabled={!modalSubGroupName || modalDropdownLoading.projects || isEditMode}  // Add isEditMode
                      style={{ width: '100%', padding: '10px', fontSize: '14px' }}
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

                {/* Loading indicator */}
                {loadingOrderItems && (
                  <div style={{ marginTop: '12px', padding: '10px', background: '#dbeafe', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>
                    🔄 Loading quotations and order book items...
                  </div>
                )}
              </div>



              {/* ========== STEP 2: QUOTATION OR ORDER BOOK SELECTION (CORRECTED) ========== */}
              {modalProjectId && !isEditMode && (
                <div className="po-form-section">
                  {/* ✅ SCENARIO A: Both Quotations AND Order Books Available */}
                  {quotations.length > 0 && orderBookItems.length > 0 && (
                    <>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span>✅</span> Choose Your Option
                      </h3>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', // ✅ Responsive grid
                        gap: '16px',
                        marginBottom: '16px'
                      }}>
                        {/* Option 1: Use Quotation */}
                        <div style={{
                          padding: '20px',
                          background: '#f0fdf4',
                          border: '2px solid #86efac',
                          borderRadius: '8px',
                          transition: 'all 0.2s'
                        }}>
                          <h4 style={{
                            marginBottom: '8px',
                            color: '#166534',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>📋</span> Option 1: Use Approved Quotation
                          </h4>
                          <p style={{ fontSize: '13px', color: '#059669', marginBottom: '12px' }}>
                            Select from {quotations.length} approved quotation(s)
                          </p>

                          {!createPOFormData.quotationId && (
                            <div className="po-form-group" style={{ marginTop: '12px' }}>
                              <select
                                value={createPOFormData.quotationId}
                                onChange={(e) => handleQuotationSelect(e.target.value)}
                                style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                              >
                                <option value="">Select Quotation</option>
                                {quotations.map(quot => (
                                  <option key={quot.id} value={quot.id}>
                                    {quot.quoteNo} - {formatCurrency(quot.totalValue)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {createPOFormData.quotationId && (
                            <div style={{
                              marginTop: '12px',
                              padding: '12px',
                              background: 'white',
                              borderRadius: '6px',
                              border: '1px solid #86efac'
                            }}>
                              <div style={{ fontSize: '13px', color: '#166534', marginBottom: '4px' }}>
                                ✓ {createPOFormData.quotation?.quoteNo}
                              </div>
                              <button
                                onClick={() => handleQuotationSelect('')}
                                style={{
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  background: '#fee2e2',
                                  border: '1px solid #fecaca',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  color: '#dc2626'
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Option 2: Use Order Book */}
                        <div style={{
                          padding: '20px',
                          background: '#eff6ff',
                          border: '2px solid #93c5fd',
                          borderRadius: '8px',
                          transition: 'all 0.2s'
                        }}>
                          <h4 style={{
                            marginBottom: '8px',
                            color: '#1e40af',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>🆕</span> Option 2: New Vendor
                          </h4>
                          <p style={{ fontSize: '13px', color: '#1e40af', marginBottom: '12px' }}>
                            Use {orderBookItems.length} order book items
                          </p>

                          {createPOFormData.items.length === 0 || createPOFormData.quotationId ? (
                            <button
                              className="purchase-orders-btn-primary"
                              onClick={handleSkipQuotationLoadOrderBook}
                              style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '14px',
                                background: '#3b82f6'
                              }}
                            >
                              📦 Load Items
                            </button>
                          ) : (
                            <div style={{
                              padding: '12px',
                              background: 'white',
                              borderRadius: '6px',
                              border: '1px solid #93c5fd'
                            }}>
                              <div style={{ fontSize: '13px', color: '#1e40af' }}>
                                ✓ {createPOFormData.items.length} items loaded
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Show selected quotation details */}
                      {createPOFormData.quotation && (
                        <div style={{
                          padding: '16px',
                          backgroundColor: '#f0fdf4',
                          borderRadius: '8px',
                          border: '2px solid #86efac',
                          marginTop: '16px'
                        }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600', color: '#166534' }}>
                            Selected Quotation Details
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                            <div>
                              <strong>Vendor:</strong> {createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || 'N/A'}
                            </div>
                            <div>
                              <strong>Category:</strong> {createPOFormData.quotation.category}
                            </div>
                            <div>
                              <strong>Valid Until:</strong> {formatDate(createPOFormData.quotation.validTill)}
                            </div>
                            <div>
                              <strong>Total:</strong> {formatCurrency(createPOFormData.quotation.totalValue)}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ✅ SCENARIO B: Only Quotations Available */}
                  {quotations.length > 0 && orderBookItems.length === 0 && (
                    <>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span>✅</span> Approved Quotations Available ({quotations.length})
                      </h3>

                      <div className="po-form-group">
                        <select
                          value={createPOFormData.quotationId}
                          onChange={(e) => handleQuotationSelect(e.target.value)}
                          style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                        >
                          <option value="">Select Quotation</option>
                          {quotations.map(quot => (
                            <option key={quot.id} value={quot.id}>
                              {quot.quoteNo} - {quot.category} - {formatCurrency(quot.totalValue)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {createPOFormData.quotation && (
                        <div style={{
                          marginTop: '16px',
                          padding: '16px',
                          backgroundColor: '#f0fdf4',
                          borderRadius: '8px',
                          border: '2px solid #86efac'
                        }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600', color: '#166534' }}>
                            Quotation Details
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                            <div><strong>Vendor:</strong> {createPOFormData.quotation.vendorContact || 'N/A'}</div>
                            <div><strong>Category:</strong> {createPOFormData.quotation.category}</div>
                            <div><strong>Valid:</strong> {formatDate(createPOFormData.quotation.validTill)}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ✅ SCENARIO C: Only Order Books Available - SINGLE WARNING */}
                  {!loadingOrderItems && quotations.length === 0 && orderBookItems.length > 0 && (
                    <>
                      <div style={{
                        padding: '20px',
                        background: '#fef3c7',
                        border: '2px solid #fbbf24',
                        borderRadius: '8px'
                      }}>
                        <h4 style={{
                          marginBottom: '10px',
                          color: '#92400e',
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>⚠️</span> No Approved Quotations
                        </h4>
                        <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '12px' }}>
                          Found {orderBookItems.length} items from order books. You can create a PO by entering vendor details manually.
                        </p>

                        <button
                          className="purchase-orders-btn-primary"
                          onClick={handleLoadOrderBookItems}
                          style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                        >
                          📋 Load {orderBookItems.length} Order Book Items
                        </button>
                      </div>
                    </>
                  )}

                  {/* ✅ SCENARIO D: Nothing Available */}
                  {!loadingOrderItems && quotations.length === 0 && orderBookItems.length === 0 && (
                    <div style={{
                      padding: '20px',
                      background: '#fee2e2',
                      border: '2px solid #fecaca',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <h4 style={{ marginBottom: '10px', color: '#991b1b', fontSize: '16px' }}>
                        ❌ No Data Available
                      </h4>
                      <p style={{ fontSize: '14px', color: '#991b1b' }}>
                        No quotations or order book items found. Please select a different project.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ========== STEP 3: VENDOR SELECTION (CORRECTED & RESPONSIVE) ========== */}
              {(createPOFormData.quotationId || createPOFormData.items.length > 0) && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span>🏢</span> Vendor Information
                  </h3>

                  {/* If quotation selected, show vendor info */}
                  {createPOFormData.quotation ? (
                    <>
                      <div style={{
                        padding: '16px',
                        background: '#f0f9ff',
                        border: '2px solid #bae6fd',
                        borderRadius: '8px',
                        marginBottom: '16px'
                      }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0c4a6e', marginBottom: '8px' }}>
                          📋 Vendor from Quotation
                        </h4>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#0c4a6e' }}>
                          {createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || `Vendor #${createPOFormData.quotation.vendorId}`}
                        </div>
                        {createPOFormData.quotation.vendorContact && (
                          <div style={{ fontSize: '13px', color: '#0369a1', marginTop: '4px' }}>
                            Contact: {createPOFormData.quotation.vendorContact}
                          </div>
                        )}
                      </div>

                      <div style={{
                        padding: '12px',
                        background: '#fef3c7',
                        border: '1px solid #fbbf24',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#92400e'
                      }}>
                        💡 To use a different vendor, clear the quotation and load order book items instead.
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Vendor type selection */}
                      {!isEditMode && (
                        <div style={{
                          marginBottom: '16px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '16px',
                          padding: '12px',
                          background: '#f8fafc',
                          borderRadius: '6px'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input
                              type="radio"
                              name="vendorType"
                              checked={!showNewVendorForm}
                              onChange={() => handleVendorTypeChange('existing')}
                              style={{ marginRight: '8px', width: '18px', height: '18px' }}
                            />
                            <span>Existing Vendor</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input
                              type="radio"
                              name="vendorType"
                              checked={showNewVendorForm}
                              onChange={() => handleVendorTypeChange('new')}
                              style={{ marginRight: '8px', width: '18px', height: '18px' }}
                            />
                            <span>New Vendor</span>
                          </label>
                        </div>
                      )}

                      {/* ✅ CORRECTED: Existing Vendor Dropdown - Compact & Responsive */}
                      {!showNewVendorForm && (
                        <div className="po-form-group">
                          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                            Select Vendor *
                          </label>
                          <select
                            value={createPOFormData.vendorId || ''}
                            onChange={handleVendorSelection} // ✅ Use new handler
                            style={{
                              width: '100%',
                              padding: '10px 12px', // ✅ Compact padding
                              fontSize: '14px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              background: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-- Select Vendor --</option>
                            {vendors.map(vendor => (
                              <option
                                key={vendor.id}
                                value={vendor.id}
                                style={{
                                  padding: '8px', // ✅ Compact option padding
                                  fontSize: '14px'
                                }}
                              >
                                {vendor.name}
                                {vendor.contactNumber && ` • ${vendor.contactNumber}`}
                                {vendor.category && ` • ${vendor.category}`}
                              </option>
                            ))}
                          </select>

                          {vendors.length === 0 && (
                            <small style={{
                              color: '#ef4444',
                              fontSize: '12px',
                              marginTop: '6px',
                              display: 'block'
                            }}>
                              No vendors available for selected group/subgroup. Add a new vendor.
                            </small>
                          )}

                          {vendors.length > 0 && (
                            <small style={{
                              color: '#64748b',
                              fontSize: '12px',
                              marginTop: '6px',
                              display: 'block'
                            }}>
                              Showing {vendors.length} vendor(s) for {modalSubGroupName || modalGroupName || 'all groups'}
                            </small>
                          )}
                        </div>
                      )}

                      {/* New Vendor Form */}
                      {showNewVendorForm && (
                        <div style={{
                          padding: '20px',
                          background: '#f0fdf4',
                          border: '2px solid #86efac',
                          borderRadius: '8px'
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', // ✅ Responsive grid
                            gap: '16px'
                          }}>
                            <div className="po-form-group">
                              <label>Vendor Name *</label>
                              <input
                                type="text"
                                value={createPOFormData.vendorName || ''}
                                onChange={(e) => setCreatePOFormData({
                                  ...createPOFormData,
                                  vendorName: e.target.value
                                })}
                                placeholder="Enter vendor company name"
                                style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                              />
                            </div>

                            <div className="po-form-group">
                              <label>Contact Number * (10 digits)</label>
                              <input
                                type="tel"
                                value={createPOFormData.vendorContact || ''}
                                onChange={(e) => handleNewVendorContactChange(e.target.value)}
                                placeholder="Enter 10-digit mobile"
                                maxLength={10}
                                style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                              />
                              {createPOFormData.vendorContact && createPOFormData.vendorContact.length < 10 && (
                                <small style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                  ⚠️ Must be 10 digits ({createPOFormData.vendorContact.length}/10)
                                </small>
                              )}
                            </div>
                          </div>

                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            background: '#dbeafe',
                            border: '1px solid #93c5fd',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#1e40af'
                          }}>
                            💡 This vendor will be created immediately when you submit the PO.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ========== STEP 4: PO DETAILS ========== */}
              {(createPOFormData.quotationId || createPOFormData.items.length > 0) && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span>📝</span> Purchase Order Details
                  </h3>

                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Order Date *</label>
                      <input
                        type="date"
                        value={createPOFormData.orderDate}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, orderDate: e.target.value })}
                        style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                      />
                    </div>

                    <div className="po-form-group">
                      <label>Expected Delivery *</label>
                      <input
                        type="date"
                        value={createPOFormData.expectedDelivery}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, expectedDelivery: e.target.value })}
                        min={createPOFormData.orderDate}
                        style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Payment Terms</label>
                      <input
                        type="text"
                        value={createPOFormData.paymentTerms}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, paymentTerms: e.target.value })}
                        placeholder="e.g., Net 30, Advance Payment, 50% advance"
                        style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                      />
                    </div>

                    <div className="po-form-group">
                      <label>Shipping Address</label>
                      <input
                        type="text"
                        value={createPOFormData.shippingAddress}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, shippingAddress: e.target.value })}
                        placeholder="Enter delivery address"
                        style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div className="po-form-group">
                    <label>Notes / Special Instructions</label>
                    <textarea
                      rows={3}
                      value={createPOFormData.notes}
                      onChange={(e) => setCreatePOFormData({ ...createPOFormData, notes: e.target.value })}
                      placeholder="Additional notes, special requirements, etc."
                      style={{ width: '100%', padding: '10px', fontSize: '14px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* ========== STEP 5: ITEMS TABLE WITH SELECTION ========== */}
              {(createPOFormData.quotationId || createPOFormData.items.length > 0) && (
                <div className="po-form-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span>📋</span> Purchase Order Items
                      </h3>
                      <p style={{ fontSize: '13px', color: '#64748b' }}>
                        {createPOFormData.quotationId
                          ? 'Select items to include and adjust quantities as needed'
                          : 'Enter vendor prices for selected items'}
                      </p>
                    </div>

                    {/* ✅ ADD MANUAL ITEM BUTTON */}
                    {!isEditMode && (
                      <button
                        className="purchase-orders-btn-secondary"
                        onClick={() => setShowManualItemForm(!showManualItemForm)}
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        <Plus size={16} /> {showManualItemForm ? 'Cancel' : 'Add Manual Item'}
                      </button>
                    )}
                  </div>

                  {/* ✅ MANUAL ITEM FORM */}
                  {showManualItemForm && (
                    <div style={{
                      padding: '16px',
                      background: '#f0fdf4',
                      border: '2px solid #86efac',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#166534' }}>
                        Add Manual Item
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Item Name *</label>
                          <input
                            type="text"
                            value={newItem.itemName}
                            onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                            placeholder="Enter item name"
                            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Quantity *</label>
                          <input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Unit Price (₹) *</label>
                          <input
                            type="number"
                            value={newItem.unitPrice}
                            onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || '' })}
                            placeholder=" "
                            min="0"
                            step="0.01"
                            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>GST %</label>
                          <input
                            type="number"
                            value={newItem.gst}
                            onChange={(e) => setNewItem({ ...newItem, gst: parseFloat(e.target.value) || 0 })}
                            placeholder="18"
                            min="0"
                            max="100"
                            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Discount %</label>
                          <input
                            type="number"
                            value={newItem.discount}
                            onChange={(e) => setNewItem({ ...newItem, discount: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            min="0"
                            max="100"
                            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button
                            className="purchase-orders-btn-primary"
                            onClick={handleAddManualItem}
                            style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                          >
                            ✅ Add Item
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Description</label>
                        <input
                          type="text"
                          value={newItem.itemDescription}
                          onChange={(e) => setNewItem({ ...newItem, itemDescription: e.target.value })}
                          placeholder="Enter item description (optional)"
                          style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  )}

                  {createPOFormData.items.length > 0 ? (
                    <>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table className="po-items-table" style={{ width: '100%', minWidth: '1100px' }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '60px' }}>
                                {/* ✅ SELECT ALL CHECKBOX */}
                                <input
                                  type="checkbox"
                                  checked={createPOFormData.items.every(item => item.selected)}
                                  onChange={(e) => {
                                    const allSelected = e.target.checked;
                                    const newItems = createPOFormData.items.map(item => ({
                                      ...item,
                                      selected: allSelected
                                    }));
                                    setCreatePOFormData({ ...createPOFormData, items: newItems });
                                  }}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  title="Select/Deselect All"
                                />
                              </th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Item Name</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                              {createPOFormData.quotationId && (
                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '100px' }}>Quoted Qty</th>
                              )}
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '100px' }}>PO Qty *</th>
                              <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', width: '130px' }}>Unit Price (₹) *</th>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>GST %</th>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>Discount %</th>
                              <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', width: '130px' }}>Line Total</th>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {createPOFormData.items.map((item, index) => (
                              <tr
                                key={index}
                                style={{
                                  borderTop: '1px solid #e2e8f0',
                                  opacity: item.selected ? 1 : 0.5,
                                  background: item.selected ? 'white' : '#f9fafb'
                                }}
                              >
                                {/* ✅ SELECTION CHECKBOX */}
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={item.selected}
                                    onChange={() => handleToggleItemSelection(index)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '12px', fontWeight: '500' }}>
                                  {item.itemName}
                                  {item.isManual && (
                                    <span style={{
                                      marginLeft: '8px',
                                      fontSize: '11px',
                                      padding: '2px 6px',
                                      background: '#dbeafe',
                                      color: '#1e40af',
                                      borderRadius: '4px',
                                      fontWeight: '600'
                                    }}>
                                      MANUAL
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>{item.itemDescription || '—'}</td>
                                {createPOFormData.quotationId && (
                                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#0284c7' }}>
                                    {item.quotedQuantity}
                                  </td>
                                )}
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max={createPOFormData.quotationId ? item.quotedQuantity : undefined}
                                    value={item.quantity}
                                    onChange={(e) => handleUpdatePOItemQuantity(index, e.target.value)}
                                    disabled={!item.selected}
                                    style={{
                                      width: '70px',
                                      padding: '8px',
                                      textAlign: 'center',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '4px',
                                      fontSize: '14px'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice || ''}
                                    onChange={(e) => handleUpdatePOItemPrice(index, e.target.value)}
                                    disabled={createPOFormData.quotationId || !item.selected}
                                    placeholder="0.00"
                                    style={{
                                      width: '110px',
                                      padding: '8px',
                                      textAlign: 'right',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '4px',
                                      fontSize: '14px',
                                      backgroundColor: (createPOFormData.quotationId || !item.selected) ? '#f1f5f9' : 'white'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <select
                                    value={item.gst}
                                    onChange={(e) => handleUpdatePOItemGST(index, e.target.value)}
                                    disabled={!item.selected}
                                    style={{
                                      width: '90px',
                                      padding: '8px',
                                      textAlign: 'center',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '4px',
                                      fontSize: '14px',
                                      cursor: item.selected ? 'pointer' : 'not-allowed',
                                      backgroundColor: item.selected ? 'white' : '#f1f5f9'
                                    }}
                                  >
                                    {GST_OPTIONS.map(gst => (
                                      <option key={gst} value={gst}>{gst}%</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>{item.discount}%</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: item.selected ? '#059669' : '#94a3b8', fontSize: '14px' }}>
                                  {formatCurrency(item.lineTotal)}
                                </td>
                                {/* ✅ REMOVE BUTTON */}
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <button
                                    className="remove-item-btn"
                                    onClick={() => handleRemoveItem(index)}
                                    title="Remove item"
                                    style={{
                                      padding: '6px',
                                      background: '#fee2e2',
                                      border: '1px solid #fecaca',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      color: '#dc2626'
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                            <tr>
                              <td colSpan={createPOFormData.quotationId ? 9 : 8} style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '16px' }}>
                                Grand Total ({createPOFormData.items.filter(i => i.selected).length} items selected):
                              </td>
                              <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '18px', color: '#059669' }}>
                                {formatCurrency(calculatePOTotal())}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* ✅ SELECTION INFO */}
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                          {createPOFormData.items.filter(i => i.selected).length} of {createPOFormData.items.length} items selected
                        </div>
                        {!createPOFormData.quotationId && createPOFormData.items.some(i => i.selected && (!i.unitPrice || i.unitPrice === 0)) && (
                          <div style={{
                            padding: '8px 12px',
                            background: '#fef3c7',
                            border: '1px solid #fbbf24',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#92400e'
                          }}>
                            ⚠️ Please enter unit prices for all selected items
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{
                      padding: '60px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      border: '2px dashed #cbd5e0',
                      borderRadius: '8px',
                      color: '#94a3b8'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                      <div style={{ fontSize: '16px', fontWeight: '500' }}>No items to display</div>
                      <div style={{ fontSize: '14px', marginTop: '4px' }}>Select a quotation, load order book items, or add manual items</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========== MODAL FOOTER / ACTIONS ========== */}
            <div className="purchase-orders-modal-actions" style={{ borderTop: '2px solid #e2e8f0', paddingTop: '20px' }}>
              <button
                className="purchase-orders-btn-primary"
                onClick={handleCreatePO}
                disabled={!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0}
                style={{
                  padding: '12px 32px',
                  fontSize: '15px',
                  opacity: (!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0) ? 0.5 : 1,
                  cursor: (!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {isEditMode ? '💾 Update Purchase Order' : '✅ Create Purchase Order'}
              </button>
              <button
                className="purchase-orders-btn-secondary"
                onClick={handleCloseCreatePOModal}
                style={{ padding: '12px 32px', fontSize: '15px' }}
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

export default PurchaseOrders;