import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, X, Edit2, Eye, Package, Truck, CheckCircle, Clock, FileText, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import '../pages-css/PurchaseOrders.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const PurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    paymentStatus: 'all'
  });

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


  // ADD THESE NEW STATE VARIABLES:
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [vendors, setVendors] = useState([]); // List of vendors
  const [quotations, setQuotations] = useState([]); // List of approved quotations
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
    vendorName: '', // NEW
    vendorContact: '', // NEW
    groupName: '', // NEW
    subGroupName: '', // NEW
    projectId: '', // NEW
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    paymentTerms: '',
    shippingAddress: '',
    notes: '',
    items: []
  });
  const [newItem, setNewItem] = useState({
    itemName: '',
    itemDescription: '',
    quantity: 0,
    unitPrice: 0,
    gst: 18,
    discount: 0
  });
  // Fetch POs on mount and filter change
  useEffect(() => {
    fetchPurchaseOrders();
  }, [groupName, subGroupName, projectId, currentPage, filters.status, filters.search]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);
  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors();
  }, []);
  /**
 * Fetch modal groups
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
   * Fetch modal projects
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
   * Fetch quotations filtered by group/subgroup/project
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

        // If no quotations found and we have a project, fetch order book items
        if ((!data || data.length === 0) && projectId) {
          fetchOrderBookItems(projectId);
        } else {
          setOrderBookItems([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      setQuotations([]);
    }
  };

  /**
 * Fetch order book items by project (fallback when no quotations)
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
   * Handle modal group change
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

    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
      fetchFilteredQuotations(newGroupName, null, null);
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
    setQuotations([]);
    setOrderBookItems([]);

    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
      fetchFilteredQuotations(modalGroupName, newSubGroupName, null);
    }
  };

  /**
   * Handle modal project change
   */
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setQuotations([]);
    setOrderBookItems([]);

    if (newProjectId) {
      fetchFilteredQuotations(modalGroupName, modalSubGroupName, newProjectId);
    }
  };
  /**
 * Handle vendor type toggle (existing vs new)
 */
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new');

    if (type === 'new') {
      setCreatePOFormData({
        ...createPOFormData,
        vendorId: null,
        vendorName: '',
        vendorContact: ''
      });
    } else {
      setCreatePOFormData({
        ...createPOFormData,
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
    setCreatePOFormData({
      ...createPOFormData,
      vendorContact: cleaned
    });
  };

  /**
 * Load order book items into PO form
 */
  const handleLoadOrderBookItems = () => {
    if (orderBookItems.length === 0) {
      showError('No order book items available');
      return;
    }

    const poItems = orderBookItems.map(item => ({
      itemName: item.itemName,
      itemDescription: item.specification || item.description || '',
      quotedQuantity: item.quantity || 1,
      quantity: item.quantity || 1,
      unitPrice: 0, // User must enter vendor price
      gst: item.taxPercent || 18,
      discount: 0,
      lineTotal: 0
    }));

    setCreatePOFormData({
      ...createPOFormData,
      items: poItems
    });

    showSuccess(`Loaded ${poItems.length} items from order book`);
  };
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
   * Fetch approved quotations for PO creation
   */
  const fetchApprovedQuotations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/approved`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setQuotations(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
    }
  };

  // 4. Replace the useEffect that calls fetchVendors (around line 48):
  useEffect(() => {
    fetchApprovedQuotations();
  }, []);
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
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/stats`, {
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
    if (!window.confirm(`Change status to ${newStatus}?`)) return;

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
   * Fetch vendors for dropdown
   */
  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors?page=0&size=1000`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  /**
   * Handle add item to PO
   */
  const handleAddItemToPO = () => {
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
      ...newItem,
      lineTotal,
      id: Date.now() // Temporary ID
    };

    setCreatePOFormData(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    // Reset new item form
    setNewItem({
      itemName: '',
      itemDescription: '',
      quantity: 0,
      unitPrice: 0,
      gst: 18,
      discount: 0
    });
  };

  /**
   * Handle remove item from PO
   */
  const handleRemoveItemFromPO = (itemId) => {
    setCreatePOFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  /**
   * Calculate total value of PO
   */
  const calculatePOTotal = () => {
    return createPOFormData.items.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  /**
   * Handle create PO
   */
  const handleCreatePO = async () => {
    // Validation
    if (!modalGroupName) {
      showError('Please select a group');
      return;
    }

    // Vendor validation
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

    if (createPOFormData.items.length === 0) {
      showError('No items available. Please select a quotation or load order book items.');
      return;
    }

    // Check if at least one item has quantity > 0
    const hasItems = createPOFormData.items.some(item => item.quantity > 0);
    if (!hasItems) {
      showError('Please set quantity for at least one item');
      return;
    }

    // Check if all items with quantity > 0 have unit price
    const missingPrices = createPOFormData.items.some(
      item => item.quantity > 0 && (!item.unitPrice || item.unitPrice === 0)
    );
    if (missingPrices) {
      showError('Please enter unit price for all items');
      return;
    }

    if (!createPOFormData.expectedDelivery) {
      showError('Expected delivery date is required');
      return;
    }

    setLoading(true);
    try {
      // Filter items with quantity > 0
      const poItems = createPOFormData.items
        .filter(item => item.quantity > 0)
        .map(({ itemName, itemDescription, quantity, unitPrice, gst, discount }) => ({
          itemName,
          itemDescription,
          quantity,
          unitPrice,
          gst,
          discount
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
        items: poItems,
        status: 'Draft',
        paymentStatus: 'Pending'
      };

      const endpoint = createPOFormData.quotationId
        ? `${API_BASE_URL}/api/purchase-orders/from-quotation`
        : `${API_BASE_URL}/api/purchase-orders`;

      const response = await fetch(endpoint, {
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

      // Reset form
      setShowCreatePOModal(false);
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
      setQuotations([]);
      setOrderBookItems([]);

      // Refresh list
      fetchPurchaseOrders();
      fetchStats();

    } catch (error) {
      console.error('Failed to create PO:', error);
      showError(error.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  /**
  * Handle open create PO modal - UPDATED
  */
  const handleOpenCreatePO = () => {
    // Initialize with current filter values
    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalProjectId(projectId || '');

    setCreatePOFormData({
      quotationId: '',
      quotation: null,
      vendorId: null,
      vendorName: '',
      vendorContact: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      projectId: projectId || '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      paymentTerms: '',
      shippingAddress: '',
      notes: '',
      items: []
    });

    setShowNewVendorForm(false);
    setQuotations([]);
    setOrderBookItems([]);

    // Fetch dropdowns
    fetchModalGroups();
    fetchVendors();

    if (groupName) {
      fetchModalSubGroups(groupName);
      fetchFilteredQuotations(groupName, subGroupName, projectId);
    }

    if (groupName && subGroupName) {
      fetchModalProjects(groupName, subGroupName);
    }

    setShowCreatePOModal(true);
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
   * Handle quotation selection
   */
  const handleQuotationSelect = async (quotationId) => {
    if (!quotationId) {
      setCreatePOFormData({
        ...createPOFormData,
        quotationId: '',
        quotation: null,
        items: []
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch full quotation details with items
      const response = await fetch(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const quotationData = await response.json();

      // Map quotation items to PO items
      const poItems = quotationData.items.map(item => ({
        quotationItemId: item.id,
        itemName: item.itemName,
        itemDescription: item.description || '',
        quotedQuantity: item.quantity,
        quantity: item.quantity, // Default to full quantity
        unitPrice: item.unitPrice,
        gst: item.taxPercent,
        discount: 0,
        lineTotal: 0
      }));

      // Calculate line totals
      poItems.forEach(item => {
        const baseAmount = item.quantity * item.unitPrice;
        const discountAmount = baseAmount * (item.discount / 100);
        const taxableAmount = baseAmount - discountAmount;
        const gstAmount = taxableAmount * (item.gst / 100);
        item.lineTotal = taxableAmount + gstAmount;
      });

      setCreatePOFormData({
        ...createPOFormData,
        quotationId: quotationData.id,
        quotation: quotationData,
        paymentTerms: quotationData.paymentTerms || '',
        notes: quotationData.notes || '',
        items: poItems
      });

    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      showError('Failed to load quotation details');
    } finally {
      setLoading(false);
    }
  };
  /**
   * Update PO item quantity
   */
  const handleUpdatePOItemQuantity = (index, quantity) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    const qty = parseFloat(quantity) || 0;

    // Validate quantity doesn't exceed quoted quantity
    if (qty > item.quotedQuantity) {
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

      // Refresh PO details
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
      // You can display this in a modal or navigate to vendor page
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
    { title: 'Total Value', value: formatCurrency(stats.totalValue), icon: <DollarSign size={32} />, color: '#8b5cf6' }
  ] : [];

  return (
    <div className="purchase-orders-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

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
            onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
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
                        {po.status !== 'Delivered' && po.status !== 'Cancelled' && (
                          <button
                            className="purchase-orders-action-btn"
                            onClick={() => handleUpdateStatus(po.id, 'Delivered')}
                            title="Mark Delivered"
                          >
                            <CheckCircle size={16} />
                          </button>
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
        <div className="purchase-orders-modal-overlay" onClick={() => setShowCreatePOModal(false)}>
          <div className="purchase-orders-create-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="purchase-orders-modal-header">
              <h2>Create Purchase Order</h2>
              <button className="purchase-orders-modal-close" onClick={() => setShowCreatePOModal(false)}>
                ✕
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
                      disabled={modalDropdownLoading.groups}
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
                      disabled={!modalGroupName || modalDropdownLoading.subGroups}
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
                      disabled={!modalSubGroupName || modalDropdownLoading.projects}
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

              {/* ========== STEP 2: QUOTATION OR ORDER BOOK SELECTION ========== */}
              {modalProjectId && (
                <div className="po-form-section">
                  {/* SCENARIO A: Quotations Available */}
                  {quotations.length > 0 && (
                    <>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span>✅</span> Approved Quotations Available ({quotations.length})
                      </h3>
                      <p style={{ fontSize: '13px', color: '#059669', marginBottom: '16px' }}>
                        Select a quotation to create purchase order
                      </p>

                      <div className="po-form-group">
                        <label>Select Quotation *</label>
                        <select
                          value={createPOFormData.quotationId}
                          onChange={(e) => handleQuotationSelect(e.target.value)}
                          style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                        >
                          <option value="">Select Quotation</option>
                          {quotations.map(quot => (
                            <option key={quot.id} value={quot.id}>
                              {quot.quoteNo} - {quot.category} - {formatCurrency(quot.totalValue)} - Valid: {formatDate(quot.validTill)}
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
                            Selected Quotation Details
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '14px' }}>
                            <div>
                              <strong>Vendor Contact:</strong> {createPOFormData.quotation.vendorContact || createPOFormData.quotation.vendorName || 'Vendor #' + createPOFormData.quotation.vendorId}
                            </div>
                            <div>
                              <strong>RFQ ID:</strong> {createPOFormData.quotation.rfqId || 'N/A'}
                            </div>
                            <div>
                              <strong>Category:</strong> {createPOFormData.quotation.category}
                            </div>
                            <div>
                              <strong>Valid Until:</strong> {formatDate(createPOFormData.quotation.validTill)}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* SCENARIO B: No Quotations - Show Order Book Option */}
                  {!loadingOrderItems && quotations.length === 0 && (
                    <>
                      <div style={{
                        padding: '20px',
                        background: '#fef3c7',
                        border: '2px solid #fbbf24',
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        <h4 style={{ marginBottom: '10px', color: '#92400e', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>⚠️</span> No Approved Quotations Found
                        </h4>
                        <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '12px' }}>
                          No approved quotations are available for the selected project.
                        </p>

                        {orderBookItems.length > 0 ? (
                          <>
                            <div style={{
                              padding: '12px',
                              background: '#dbeafe',
                              border: '1px solid #93c5fd',
                              borderRadius: '6px',
                              marginBottom: '12px'
                            }}>
                              <p style={{ fontSize: '13px', color: '#1e40af', marginBottom: '8px' }}>
                                ✅ <strong>Good News!</strong> We found {orderBookItems.length} items from order books for this project.
                              </p>
                              <p style={{ fontSize: '13px', color: '#1e40af' }}>
                                You can create a PO using these items. You'll need to enter vendor information and prices manually.
                              </p>
                            </div>

                            <button
                              className="purchase-orders-btn-primary"
                              onClick={handleLoadOrderBookItems}
                              style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                            >
                              📋 Load {orderBookItems.length} Items from Order Book
                            </button>
                          </>
                        ) : (
                          <div style={{
                            padding: '12px',
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px'
                          }}>
                            <p style={{ fontSize: '13px', color: '#991b1b', marginBottom: '4px' }}>
                              ❌ <strong>No order book items found</strong> for this project.
                            </p>
                            <p style={{ fontSize: '12px', color: '#991b1b' }}>
                              Please select a different project or create an order book/quotation first.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ========== STEP 3: VENDOR SELECTION ========== */}
              {(createPOFormData.quotationId || createPOFormData.items.length > 0) && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span>🏢</span> Vendor Information
                  </h3>

                  {/* Show vendor from quotation OR allow selection */}
                  {createPOFormData.quotation ? (
                    <div style={{
                      padding: '16px',
                      background: '#f0f9ff',
                      border: '2px solid #bae6fd',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '14px', color: '#0c4a6e' }}>
                        <strong>Vendor from Quotation:</strong>
                        <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: '600' }}>
                          {createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || `Vendor #${createPOFormData.quotation.vendorId}`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Vendor Type Radio Buttons */}
                      <div style={{ marginBottom: '16px', display: 'flex', gap: '24px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                          <input
                            type="radio"
                            name="vendorType"
                            checked={!showNewVendorForm}
                            onChange={() => handleVendorTypeChange('existing')}
                            style={{ marginRight: '8px', width: '18px', height: '18px' }}
                          />
                          <span>Select Existing Vendor</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                          <input
                            type="radio"
                            name="vendorType"
                            checked={showNewVendorForm}
                            onChange={() => handleVendorTypeChange('new')}
                            style={{ marginRight: '8px', width: '18px', height: '18px' }}
                          />
                          <span>Add New Vendor</span>
                        </label>
                      </div>

                      {/* Existing Vendor Dropdown */}
                      {!showNewVendorForm && (
                        <div className="po-form-group">
                          <label>Select Vendor *</label>
                          <select
                            value={createPOFormData.vendorId || ''}
                            onChange={(e) => setCreatePOFormData({
                              ...createPOFormData,
                              vendorId: e.target.value ? parseInt(e.target.value) : null
                            })}
                            style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                          >
                            <option value="">Select Vendor</option>
                            {vendors.map(vendor => (
                              <option key={vendor.id} value={vendor.id}>
                                {vendor.name} {vendor.contactNumber ? `- ${vendor.contactNumber}` : ''}
                              </option>
                            ))}
                          </select>
                          {vendors.length === 0 && (
                            <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                              No vendors available. Please add a new vendor.
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
                          <div className="po-form-row">
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
                                  ⚠️ Contact must be exactly 10 digits ({createPOFormData.vendorContact.length}/10)
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
                            💡 <strong>Note:</strong> This vendor will be created automatically when you submit the purchase order.
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

              {/* ========== STEP 5: ITEMS TABLE ========== */}
              {(createPOFormData.quotationId || createPOFormData.items.length > 0) && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span>📋</span> Purchase Order Items
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                    {createPOFormData.quotationId
                      ? 'Adjust quantities as needed (cannot exceed quoted quantities)'
                      : 'Enter vendor prices for all items. Quantities are from order books.'}
                  </p>

                  {createPOFormData.items.length > 0 ? (
                    <>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table className="po-items-table" style={{ width: '100%', minWidth: '900px' }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
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
                            </tr>
                          </thead>
                          <tbody>
                            {createPOFormData.items.map((item, index) => (
                              <tr key={index} style={{ borderTop: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px', fontWeight: '500' }}>{item.itemName}</td>
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
                                    value={item.unitPrice}
                                    onChange={(e) => {
                                      const newItems = [...createPOFormData.items];
                                      newItems[index].unitPrice = parseFloat(e.target.value) || 0;

                                      // Recalculate line total
                                      const baseAmount = newItems[index].quantity * newItems[index].unitPrice;
                                      const discountAmount = baseAmount * (newItems[index].discount / 100);
                                      const taxableAmount = baseAmount - discountAmount;
                                      const gstAmount = taxableAmount * (newItems[index].gst / 100);
                                      newItems[index].lineTotal = taxableAmount + gstAmount;

                                      setCreatePOFormData({ ...createPOFormData, items: newItems });
                                    }}
                                    disabled={createPOFormData.quotationId}
                                    placeholder="0.00"
                                    style={{
                                      width: '110px',
                                      padding: '8px',
                                      textAlign: 'right',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '4px',
                                      fontSize: '14px',
                                      backgroundColor: createPOFormData.quotationId ? '#f1f5f9' : 'white'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>{item.gst}%</td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>{item.discount}%</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#059669', fontSize: '14px' }}>
                                  {formatCurrency(item.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                            <tr>
                              <td colSpan={createPOFormData.quotationId ? 7 : 6} style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '16px' }}>
                                Grand Total:
                              </td>
                              <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '18px', color: '#059669' }}>
                                {formatCurrency(calculatePOTotal())}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Warning for missing prices */}
                      {!createPOFormData.quotationId && createPOFormData.items.some(i => i.quantity > 0 && (!i.unitPrice || i.unitPrice === 0)) && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: '#fef3c7',
                          border: '1px solid #fbbf24',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: '#92400e'
                        }}>
                          ⚠️ Please enter unit prices for all items with quantity greater than 0
                        </div>
                      )}
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
                      <div style={{ fontSize: '14px', marginTop: '4px' }}>Select a quotation or load order book items</div>
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
                disabled={!modalGroupName || createPOFormData.items.length === 0}
                style={{
                  padding: '12px 32px',
                  fontSize: '15px',
                  opacity: (!modalGroupName || createPOFormData.items.length === 0) ? 0.5 : 1,
                  cursor: (!modalGroupName || createPOFormData.items.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                ✅ Create Purchase Order
              </button>
              <button
                className="purchase-orders-btn-secondary"
                onClick={() => setShowCreatePOModal(false)}
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