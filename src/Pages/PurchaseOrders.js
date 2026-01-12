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

  const [createPOFormData, setCreatePOFormData] = useState({
    quotationId: '',
    quotation: null, // Store selected quotation object
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
   * Get auth headers
   */
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });
  /**
   * Fetch approved quotations for PO creation
   */
  const fetchApprovedQuotations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quotations/approved`, {
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
    if (!createPOFormData.quotationId) {
      showError('Please select a quotation');
      return;
    }

    if (createPOFormData.items.length === 0) {
      showError('No items available from quotation');
      return;
    }

    // Check if at least one item has quantity > 0
    const hasItems = createPOFormData.items.some(item => item.quantity > 0);
    if (!hasItems) {
      showError('Please set quantity for at least one item');
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
        .map(({ quotationItemId, itemName, itemDescription, quantity, unitPrice, gst, discount }) => ({
          itemName,
          itemDescription,
          quantity,
          unitPrice,
          gst,
          discount
        }));

      const poData = {
        quotationId: createPOFormData.quotationId,
        vendorId: createPOFormData.quotation.vendorId,
        rfqId: createPOFormData.quotation.rfqId,
        groupName: createPOFormData.quotation.groupName,
        subGroupName: createPOFormData.quotation.subGroupName,
        projectId: createPOFormData.quotation.projectId,
        orderDate: createPOFormData.orderDate,
        expectedDelivery: createPOFormData.expectedDelivery,
        paymentTerms: createPOFormData.paymentTerms,
        shippingAddress: createPOFormData.shippingAddress,
        notes: createPOFormData.notes,
        items: poItems,
        status: 'Draft',
        paymentStatus: 'Pending'
      };

      const response = await fetch(`${API_BASE_URL}/api/purchase-orders/from-quotation`, {
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
        orderDate: new Date().toISOString().split('T')[0],
        expectedDelivery: '',
        paymentTerms: '',
        shippingAddress: '',
        notes: '',
        items: []
      });

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
   * Handle open create PO modal
   */
  /**
 * Handle open create PO modal
 */
  const handleOpenCreatePO = () => {
    setCreatePOFormData({
      quotationId: '',
      quotation: null,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      paymentTerms: '',
      shippingAddress: '',
      notes: '',
      items: []
    });
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
      {/* Create PO Modal */}
      {showCreatePOModal && (
        <div className="purchase-orders-modal-overlay" onClick={() => setShowCreatePOModal(false)}>
          <div className="purchase-orders-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-modal-header">
              <h2>Create Purchase Order</h2>
              <button className="purchase-orders-modal-close" onClick={() => setShowCreatePOModal(false)}>
                ✕
              </button>
            </div>

            <div className="purchase-orders-modal-content">
              {/* Select Quotation Section */}
              <div className="po-form-section">
                <h3>Select Approved Quotation</h3>

                <div className="po-form-group">
                  <label>Quotation *</label>
                  <select
                    value={createPOFormData.quotationId}
                    onChange={(e) => handleQuotationSelect(e.target.value)}
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
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Quotation Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                      <div>
                        <strong>Vendor Contact:</strong> {createPOFormData.quotation.vendorContact || 'N/A'}
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
              </div>

              {/* PO Details Section */}
              {createPOFormData.quotationId && (
                <>
                  <div className="po-form-section">
                    <h3>Purchase Order Details</h3>

                    <div className="po-form-row">
                      <div className="po-form-group">
                        <label>Order Date *</label>
                        <input
                          type="date"
                          value={createPOFormData.orderDate}
                          onChange={(e) => setCreatePOFormData({ ...createPOFormData, orderDate: e.target.value })}
                        />
                      </div>

                      <div className="po-form-group">
                        <label>Expected Delivery *</label>
                        <input
                          type="date"
                          value={createPOFormData.expectedDelivery}
                          onChange={(e) => setCreatePOFormData({ ...createPOFormData, expectedDelivery: e.target.value })}
                          min={createPOFormData.orderDate}
                        />
                      </div>
                    </div>

                    <div className="po-form-group">
                      <label>Payment Terms</label>
                      <input
                        type="text"
                        value={createPOFormData.paymentTerms}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, paymentTerms: e.target.value })}
                        placeholder="e.g., Net 30, Advance Payment"
                      />
                    </div>

                    <div className="po-form-group">
                      <label>Shipping Address</label>
                      <textarea
                        rows={2}
                        value={createPOFormData.shippingAddress}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, shippingAddress: e.target.value })}
                        placeholder="Enter shipping address"
                      />
                    </div>

                    <div className="po-form-group">
                      <label>Notes</label>
                      <textarea
                        rows={2}
                        value={createPOFormData.notes}
                        onChange={(e) => setCreatePOFormData({ ...createPOFormData, notes: e.target.value })}
                        placeholder="Additional notes"
                      />
                    </div>
                  </div>

                  {/* Items from Quotation */}
                  <div className="po-form-section">
                    <h3>Quotation Items - Adjust Quantities</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                      Modify quantities as needed (cannot exceed quoted quantities)
                    </p>

                    <table className="po-items-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Description</th>
                          <th>Quoted Qty</th>
                          <th>PO Qty</th>
                          <th>Unit Price</th>
                          <th>GST</th>
                          <th>Discount</th>
                          <th>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createPOFormData.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.itemName}</td>
                            <td>{item.itemDescription || '—'}</td>
                            <td style={{ fontWeight: '600', textAlign: 'center' }}>{item.quotedQuantity}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={item.quotedQuantity}
                                value={item.quantity}
                                onChange={(e) => handleUpdatePOItemQuantity(index, e.target.value)}
                                style={{
                                  width: '80px',
                                  padding: '6px',
                                  textAlign: 'center',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px'
                                }}
                              />
                            </td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td>{item.gst}%</td>
                            <td>{item.discount}%</td>
                            <td className="po-value">{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                          <td className="po-value" style={{ fontWeight: 'bold' }}>
                            {formatCurrency(calculatePOTotal())}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="purchase-orders-modal-actions">
              <button
                className="purchase-orders-btn-primary"
                onClick={handleCreatePO}
                disabled={!createPOFormData.quotationId || createPOFormData.items.length === 0}
              >
                Create Purchase Order
              </button>
              <button
                className="purchase-orders-btn-secondary"
                onClick={() => setShowCreatePOModal(false)}
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