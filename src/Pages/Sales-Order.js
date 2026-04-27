import React, { useState, useMemo, useEffect } from 'react';
import '../pages-css/Sales-Order.css';
import { FiEye, FiEdit, FiFileText, FiPlus } from 'react-icons/fi';

import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
/* --------------------- mockOrders (copied from your data) --------------------- */
const mockOrders = [
  {
    id: 'SO-2024-001',
    customerId: 'CUST-001',
    customerName: 'Acme Corporation',
    proposalId: 'PROP-2024-045',
    orderDate: '2024-12-01',
    deliveryDate: '2024-12-15',
    orderValue: 245000,
    itemsCount: 5,
    orderStatus: 'Confirmed',
    paymentStatus: 'Pending',
    assignedTo: 'Rajesh Kumar',
    customer: {
      contact: '+91 98765 43210',
      address: '123 MG Road, Bangalore',
      gst: '29ABCDE1234F1Z5'
    },
    items: [
      { id: 1, item: 'Product A', sku: 'SKU-001', description: 'Premium variant', qty: 10, unitPrice: 20000, tax: 18, lineTotal: 236000 },
      { id: 2, item: 'Product B', sku: 'SKU-002', description: 'Standard', qty: 5, unitPrice: 1800, tax: 18, lineTotal: 10620 }
    ],
    subtotal: 208000,
    taxTotal: 37440,
    discount: 0,
    shipping: 0,
    grandTotal: 245440,
    notes: 'Customer requested early delivery',
    activities: [
      { date: '2024-12-01 10:30 AM', user: 'Rajesh Kumar', action: 'Order created' },
      { date: '2024-12-01 02:15 PM', user: 'Manager', action: 'Order confirmed' }
    ]
  },
  {
    id: 'SO-2024-002',
    customerId: 'CUST-002',
    customerName: 'TechVision Solutions',
    proposalId: null,
    orderDate: '2024-12-03',
    deliveryDate: '2024-12-20',
    orderValue: 180000,
    itemsCount: 3,
    orderStatus: 'Shipped',
    paymentStatus: 'Partially Paid',
    assignedTo: 'Priya Sharma',
    customer: {
      contact: '+91 98765 43211',
      address: '456 Park Street, Mumbai',
      gst: '27FGHIJ5678K2L6'
    },
    items: [
      { id: 1, item: 'Product C', sku: 'SKU-003', description: 'Enterprise edition', qty: 3, unitPrice: 60000, tax: 18, lineTotal: 212400 }
    ],
    subtotal: 180000,
    taxTotal: 32400,
    discount: 0,
    shipping: 0,
    grandTotal: 212400,
    shippingDetails: {
      courier: 'Blue Dart',
      awb: 'BD123456789',
      status: 'In Transit'
    },
    notes: '',
    activities: [
      { date: '2024-12-03 09:00 AM', user: 'Priya Sharma', action: 'Order created' },
      { date: '2024-12-03 11:30 AM', user: 'Priya Sharma', action: 'Order confirmed' },
      { date: '2024-12-05 03:45 PM', user: 'Warehouse', action: 'Order shipped' }
    ]
  },
  {
    id: 'SO-2024-003',
    customerId: 'CUST-003',
    customerName: 'Global Enterprises',
    proposalId: 'PROP-2024-052',
    orderDate: '2024-11-28',
    deliveryDate: '2024-12-08',
    orderValue: 95000,
    itemsCount: 2,
    orderStatus: 'Delivered',
    paymentStatus: 'Paid',
    assignedTo: 'Amit Patel',
    customer: {
      contact: '+91 98765 43212',
      address: '789 Ring Road, Delhi',
      gst: '07KLMNO9012P3Q7'
    },
    items: [
      { id: 1, item: 'Product D', sku: 'SKU-004', description: 'Basic package', qty: 5, unitPrice: 19000, tax: 18, lineTotal: 112100 }
    ],
    subtotal: 95000,
    taxTotal: 17100,
    discount: 0,
    shipping: 0,
    grandTotal: 112100,
    shippingDetails: {
      courier: 'DTDC',
      awb: 'DT987654321',
      status: 'Delivered'
    },
    notes: '',
    activities: [
      { date: '2024-11-28 02:00 PM', user: 'Amit Patel', action: 'Order created' },
      { date: '2024-11-28 04:30 PM', user: 'Manager', action: 'Order confirmed' },
      { date: '2024-12-02 10:00 AM', user: 'Warehouse', action: 'Order shipped' },
      { date: '2024-12-08 09:15 AM', user: 'System', action: 'Order delivered' }
    ]
  },
  {
    id: 'SO-2024-004',
    customerId: 'CUST-004',
    customerName: 'StartUp Inc',
    proposalId: 'PROP-2024-060',
    orderDate: '2024-12-05',
    deliveryDate: '2024-12-18',
    orderValue: 320000,
    itemsCount: 8,
    orderStatus: 'Confirmed',
    paymentStatus: 'Pending',
    assignedTo: 'Neha Singh',
    customer: {
      contact: '+91 98765 43213',
      address: '321 Tech Park, Hyderabad',
      gst: '36PQRST3456U4V8'
    },
    items: [
      { id: 1, item: 'Product E', sku: 'SKU-005', description: 'Pro version', qty: 8, unitPrice: 40000, tax: 18, lineTotal: 377600 }
    ],
    subtotal: 320000,
    taxTotal: 57600,
    discount: 0,
    shipping: 0,
    grandTotal: 377600,
    notes: 'Urgent order - customer needs by Dec 18',
    activities: [
      { date: '2024-12-05 11:45 AM', user: 'Neha Singh', action: 'Order created' },
      { date: '2024-12-05 03:20 PM', user: 'Manager', action: 'Order confirmed' }
    ]
  },
  {
    id: 'SO-2024-005',
    customerId: 'CUST-005',
    customerName: 'Retail Chain Ltd',
    proposalId: null,
    orderDate: '2024-12-07',
    deliveryDate: '2024-12-22',
    orderValue: 450000,
    itemsCount: 12,
    orderStatus: 'Draft',
    paymentStatus: 'Pending',
    assignedTo: 'Vikram Reddy',
    customer: {
      contact: '+91 98765 43214',
      address: '555 Mall Road, Pune',
      gst: '27WXYZ6789A5B9'
    },
    items: [
      { id: 1, item: 'Product F', sku: 'SKU-006', description: 'Bulk order', qty: 12, unitPrice: 37500, tax: 18, lineTotal: 531000 }
    ],
    subtotal: 450000,
    taxTotal: 81000,
    discount: 0,
    shipping: 0,
    grandTotal: 531000,
    notes: 'Waiting for customer PO',
    activities: [
      { date: '2024-12-07 10:00 AM', user: 'Vikram Reddy', action: 'Order created as draft' }
    ]
  }
];
/* ------------------------------------------------------------------------------ */

/* ---------- StatusBadge ---------- */
const StatusBadge = ({ status, type = 'order' }) => {
  const getStatusClass = () => {
    if (type === 'order') {
      switch (status) {
        case 'Draft': return 'sales-salesorder-badge-draft';
        case 'Confirmed': return 'sales-salesorder-badge-confirmed';
        case 'Shipped': return 'sales-salesorder-badge-shipped';
        case 'Delivered': return 'sales-salesorder-badge-delivered';
        case 'Cancelled': return 'sales-salesorder-badge-cancelled';
        default: return 'sales-salesorder-badge-draft';
      }
    } else {
      switch (status) {
        case 'Pending': return 'sales-salesorder-badge-payment-pending';
        case 'Partially Paid': return 'sales-salesorder-badge-payment-partial';
        case 'Paid': return 'sales-salesorder-badge-payment-paid';
        default: return 'sales-salesorder-badge-payment-pending';
      }
    }
  };

  return (
    <span className={`sales-salesorder-badge ${getStatusClass()}`}>
      {status}
    </span>
  );
};

/* ---------- AddOrderModal ---------- */
const AddOrderModal = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({
    customerName: '',
    orderDate: '',
    deliveryDate: '',
    orderValue: '',
    itemsCount: 1,
    orderStatus: 'Draft',
    paymentStatus: 'Pending',
    assignedTo: ''
  });

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit(e) {
    e.preventDefault();
    if (!form.customerName || !form.orderDate || !form.orderValue) {
      alert('Please provide at least Customer name, Order date and Order value.');
      return;
    }
    const newOrder = {
      id: 'SO-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 900 + 100),
      customerId: 'CUST-' + Math.floor(Math.random() * 900 + 100),
      customerName: form.customerName,
      proposalId: null,
      orderDate: form.orderDate,
      deliveryDate: form.deliveryDate || form.orderDate,
      orderValue: Number(form.orderValue),
      itemsCount: Number(form.itemsCount),
      orderStatus: form.orderStatus,
      paymentStatus: form.paymentStatus,
      assignedTo: form.assignedTo || 'Unassigned',
      customer: { contact: '', address: '', gst: '' },
      items: [],
      subtotal: Number(form.orderValue),
      taxTotal: 0,
      discount: 0,
      shipping: 0,
      grandTotal: Number(form.orderValue),
      notes: '',
      activities: [{ date: new Date().toLocaleString(), user: form.assignedTo || 'System', action: 'Order created' }]
    };
    onCreate(newOrder);
    onClose();
  }

  return (
    <div className="sales-salesorder-modal-overlay">
      <div className="sales-salesorder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-salesorder-modal-header">
          <h3>Create New Sales Order</h3>
          <div>
            <button className="sales-salesorder-close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="sales-salesorder-modal-body" style={{ padding: 18 }}>
          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              Customer Name
              <input type="text" value={form.customerName} onChange={e => update('customerName', e.target.value)} />
            </label>

            <label>
              Assigned To
              <input type="text" value={form.assignedTo} onChange={e => update('assignedTo', e.target.value)} />
            </label>

            <label>
              Order Date
              <input type="date" value={form.orderDate} onChange={e => update('orderDate', e.target.value)} />
            </label>

            <label>
              Delivery Date
              <input type="date" value={form.deliveryDate} onChange={e => update('deliveryDate', e.target.value)} />
            </label>

            <label>
              Order Value (₹)
              <input type="number" value={form.orderValue} onChange={e => update('orderValue', e.target.value)} />
            </label>

            <label>
              Items Count
              <input type="number" value={form.itemsCount} onChange={e => update('itemsCount', e.target.value)} min="1" />
            </label>

            <label>
              Order Status
              <select value={form.orderStatus} onChange={e => update('orderStatus', e.target.value)}>
                <option>Draft</option>
                <option>Confirmed</option>
                <option>Shipped</option>
                <option>Delivered</option>
                <option>Cancelled</option>
              </select>
            </label>

            <label>
              Payment Status
              <select value={form.paymentStatus} onChange={e => update('paymentStatus', e.target.value)}>
                <option>Pending</option>
                <option>Partially Paid</option>
                <option>Paid</option>
              </select>
            </label>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button type="button" className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="sales-salesorder-btn sales-salesorder-btn-primary">Create Order</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ---------- OrderDetailDrawer (editable) ---------- */
const OrderDetailDrawer = ({ order, onClose, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(order);

  useEffect(() => {
    setDraft(order);
    setEditing(false);
  }, [order]);

  if (!order) return null;

  function updateField(k, v) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  function saveChanges() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div className="sales-salesorder-drawer-overlay">
      <div className="sales-salesorder-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="sales-salesorder-drawer-header">
          <div>
            <h2>{order.id}</h2>
            <div className="sales-salesorder-drawer-badges">
              <StatusBadge status={draft.orderStatus} />
              <StatusBadge status={draft.paymentStatus} type="payment" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {!editing && <button className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={() => setEditing(true)}><FiEdit /> Edit</button>}
            {editing && <button className="sales-salesorder-btn sales-salesorder-btn-primary" onClick={saveChanges}>Save</button>}
            <button className="sales-salesorder-close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="sales-salesorder-drawer-content">
          {/* Customer Info */}
          <div className="sales-salesorder-detail-section">
            <h3>Customer Information</h3>
            <div className="sales-salesorder-detail-card">
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">Customer:</span>
                <span className="sales-salesorder-detail-value">
                  {editing ? <input value={draft.customerName} onChange={e => updateField('customerName', e.target.value)} /> : draft.customerName}
                </span>
              </div>
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">Contact:</span>
                <span className="sales-salesorder-detail-value">{editing ? <input value={draft.customer?.contact || ''} onChange={e => setDraft(d => ({ ...d, customer: { ...d.customer, contact: e.target.value } }))} /> : (draft.customer?.contact || '—')}</span>
              </div>
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">Address:</span>
                <span className="sales-salesorder-detail-value">{editing ? <input value={draft.customer?.address || ''} onChange={e => setDraft(d => ({ ...d, customer: { ...d.customer, address: e.target.value } }))} /> : (draft.customer?.address || '—')}</span>
              </div>
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">GST:</span>
                <span className="sales-salesorder-detail-value">{editing ? <input value={draft.customer?.gst || ''} onChange={e => setDraft(d => ({ ...d, customer: { ...d.customer, gst: e.target.value } }))} /> : (draft.customer?.gst || '—')}</span>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="sales-salesorder-detail-section">
            <h3>Order Details</h3>
            <div className="sales-salesorder-detail-card">
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">Order Date:</span>
                <span className="sales-salesorder-detail-value">{editing ? <input type="date" value={draft.orderDate} onChange={e => updateField('orderDate', e.target.value)} /> : draft.orderDate}</span>
              </div>
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">Delivery Date:</span>
                <span className="sales-salesorder-detail-value">{editing ? <input type="date" value={draft.deliveryDate} onChange={e => updateField('deliveryDate', e.target.value)} /> : draft.deliveryDate}</span>
              </div>
              <div className="sales-salesorder-detail-row">
                <span className="sales-salesorder-detail-label">Assigned To:</span>
                <span className="sales-salesorder-detail-value">{editing ? <input value={draft.assignedTo} onChange={e => updateField('assignedTo', e.target.value)} /> : draft.assignedTo}</span>
              </div>
              {draft.proposalId && (
                <div className="sales-salesorder-detail-row">
                  <span className="sales-salesorder-detail-label">Linked Proposal:</span>
                  <span className="sales-salesorder-detail-value">{editing ? <input value={draft.proposalId} onChange={e => updateField('proposalId', e.target.value)} /> : draft.proposalId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="sales-salesorder-detail-section">
            <h3>Order Items</h3>
            <div className="sales-salesorder-items-table">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Tax %</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(draft.items || []).map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="sales-salesorder-item-name">{item.item}</div>
                        <div className="sales-salesorder-item-desc">{item.description}</div>
                      </td>
                      <td>{item.sku}</td>
                      <td>{item.qty}</td>
                      <td>₹{item.unitPrice.toLocaleString()}</td>
                      <td>{item.tax}%</td>
                      <td>₹{item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sales-salesorder-totals">
              <div className="sales-salesorder-total-row"><span>Subtotal:</span><span>₹{(draft.subtotal || 0).toLocaleString()}</span></div>
              <div className="sales-salesorder-total-row"><span>Tax:</span><span>₹{(draft.taxTotal || 0).toLocaleString()}</span></div>
              <div className="sales-salesorder-total-row"><span>Discount:</span><span>₹{(draft.discount || 0).toLocaleString()}</span></div>
              <div className="sales-salesorder-total-row"><span>Shipping:</span><span>₹{(draft.shipping || 0).toLocaleString()}</span></div>
              <div className="sales-salesorder-total-row sales-salesorder-grand-total"><span>Grand Total:</span><span>₹{(draft.grandTotal || 0).toLocaleString()}</span></div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="sales-salesorder-detail-section">
            <h3>Activity Timeline</h3>
            <div className="sales-salesorder-timeline">
              {(draft.activities || []).map((activity, idx) => (
                <div key={idx} className="sales-salesorder-timeline-item">
                  <div className="sales-salesorder-timeline-dot"></div>
                  <div className="sales-salesorder-timeline-content">
                    <div className="sales-salesorder-timeline-action">{activity.action}</div>
                    <div className="sales-salesorder-timeline-meta">{activity.user} • {activity.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {draft.notes && (
            <div className="sales-salesorder-detail-section">
              <h3>Internal Notes</h3>
              <div className="sales-salesorder-detail-card">
                {editing ? <textarea value={draft.notes} onChange={e => updateField('notes', e.target.value)} /> : <p>{draft.notes}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="sales-salesorder-drawer-footer">
          <button className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={onClose}>Close</button>
          {editing ? (
            <button className="sales-salesorder-btn sales-salesorder-btn-primary" onClick={saveChanges}>Save Changes</button>
          ) : (
            <button className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={() => setEditing(true)}><FiEdit /> Edit</button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Main Page Component ---------- */
const SalesOrdersPage = () => {
    const { groupName, projectId, updateFilters } = useGroupProjectFilters();

  const [orders, setOrders] = useState(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', assignedTo: '', dateFrom: '', dateTo: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'orderDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);

  // computed KPI
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const thisMonth = orders.filter(o => o.orderDate.startsWith('2024-12')).length;
    const totalValue = orders.reduce((sum, o) => sum + (o.orderValue || 0), 0);
    const pendingShipment = orders.filter(o => o.orderStatus === 'Confirmed').length;
    const overdue = orders.filter(o => {
      const deliveryDate = new Date(o.deliveryDate);
      const today = new Date();
      return deliveryDate < today && !['Delivered', 'Cancelled'].includes(o.orderStatus);
    }).length;
    return { totalOrders, thisMonth, totalValue, pendingShipment, overdue };
  }, [orders]);

  // Filter & Search
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = searchQuery === '' ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.proposalId && order.proposalId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = !filters.status || order.orderStatus === filters.status;
      const matchesPayment = !filters.paymentStatus || order.paymentStatus === filters.paymentStatus;
      const matchesAssigned = !filters.assignedTo || order.assignedTo === filters.assignedTo;
      if (filters.dateFrom && new Date(order.orderDate) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(order.orderDate) > new Date(filters.dateTo)) return false;

      return matchesSearch && matchesStatus && matchesPayment && matchesAssigned;
    });
  }, [orders, searchQuery, filters]);

  // Sort
  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        if (sortConfig.key === 'orderValue') {
          aVal = Number(aVal || 0);
          bVal = Number(bVal || 0);
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredOrders, sortConfig]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / itemsPerPage));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedOrders, currentPage, itemsPerPage]);

  // Handlers
  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const handleSelectOrder = (orderId) => setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  const handleSelectAll = () => setSelectedOrders(prev => (prev.length === paginatedOrders.length ? [] : paginatedOrders.map(o => o.id)));

  const handleCreateOrder = (newOrder) => setOrders(prev => [newOrder, ...prev]);
  const handleUpdateOrder = (updated) => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));

  return (
    <div className="sales-salesorder-container">
      <div className="sales-salesorder-breadcrumb">Dashboard &gt; Sales &gt; Sales Orders</div>

      {/* <div className="sales-salesorder-header"> */}

        <div className="page-header-with-filter">
          <h1 className="sales-salesorder-title">Sales Orders</h1>

          <GroupProjectFilter
            groupValue={groupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      {/* </div> */}

      <div className="sales-salesorder-kpi-grid">
        <div className="sales-salesorder-kpi-card">
          <div className="sales-salesorder-kpi-title">Total Orders</div>
          <div className="sales-salesorder-kpi-value">{kpis.totalOrders}</div>
        </div>
        <div className="sales-salesorder-kpi-card">
          <div className="sales-salesorder-kpi-title">Orders This Month</div>
          <div className="sales-salesorder-kpi-value">{kpis.thisMonth}</div>
        </div>
        <div className="sales-salesorder-kpi-card">
          <div className="sales-salesorder-kpi-title">Total Order Value</div>
          <div className="sales-salesorder-kpi-value">₹{(kpis.totalValue / 1000).toFixed(0)}K</div>
        </div>
        <div className="sales-salesorder-kpi-card">
          <div className="sales-salesorder-kpi-title">Pending Shipment</div>
          <div className="sales-salesorder-kpi-value">{kpis.pendingShipment}</div>
        </div>
        <div className="sales-salesorder-kpi-card">
          <div className="sales-salesorder-kpi-title">Overdue Deliveries</div>
          <div className="sales-salesorder-kpi-value">{kpis.overdue}</div>
        </div>
      </div>

      <div className="sales-salesorder-action-bar">
        <div className="sales-salesorder-search-filter">
          <input className="sales-salesorder-search" placeholder="Search by Order ID, Customer, Proposal..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <button className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            Filters {showFilters ? '▲' : '▼'}
          </button>
        </div>

        <div className="sales-salesorder-actions">
          <button className="sales-salesorder-btn sales-salesorder-btn-secondary">Export CSV</button>
          <button className="sales-salesorder-btn sales-salesorder-btn-primary" onClick={() => setShowAddModal(true)}>
            <FiPlus /> Create New Order
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="sales-salesorder-filters-panel">
          <select className="sales-salesorder-filter-select" value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select className="sales-salesorder-filter-select" value={filters.paymentStatus} onChange={e => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}>
            <option value="">All Payment Status</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>

          <select className="sales-salesorder-filter-select" value={filters.assignedTo} onChange={e => setFilters(prev => ({ ...prev, assignedTo: e.target.value }))}>
            <option value="">All Salespersons</option>
            {[...new Set(orders.map(o => o.assignedTo))].map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          <button className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={() => setFilters({ status: '', paymentStatus: '', assignedTo: '', dateFrom: '', dateTo: '' })}>Clear Filters</button>
        </div>
      )}

      {selectedOrders.length > 0 && (
        <div className="sales-salesorder-bulk-actions">
          <span>{selectedOrders.length} order(s) selected</span>
          <button className="sales-salesorder-btn sales-salesorder-btn-secondary">Change Status</button>
          <button className="sales-salesorder-btn sales-salesorder-btn-secondary">Export Selected</button>
          <button className="sales-salesorder-btn sales-salesorder-btn-secondary" onClick={() => setSelectedOrders([])}>Clear Selection</button>
        </div>
      )}

      <div className="sales-salesorder-table-container">
        <table className="sales-salesorder-table">
          <thead>
            <tr>
              <th className="sales-salesorder-checkbox-col">
                <input type="checkbox" checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0} onChange={handleSelectAll} />
              </th>
              <th onClick={() => handleSort('id')} className="sales-salesorder-sortable">Order ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th>Customer</th>
              <th>Proposal ID</th>
              <th onClick={() => handleSort('orderDate')} className="sales-salesorder-sortable">Order Date {sortConfig.key === 'orderDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th>Delivery Date</th>
              <th onClick={() => handleSort('orderValue')} className="sales-salesorder-sortable">Order Value {sortConfig.key === 'orderValue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th>Items</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Assigned To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map(order => (
              <tr key={order.id} className="sales-salesorder-table-row">
                <td><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => handleSelectOrder(order.id)} /></td>
                <td><span className="sales-salesorder-link" onClick={() => setSelectedOrder(order)}>{order.id}</span></td>
                <td><span className="sales-salesorder-link">{order.customerName}</span></td>
                <td>{order.proposalId ? <span className="sales-salesorder-link">{order.proposalId}</span> : <span className="sales-salesorder-text-muted">—</span>}</td>
                <td>{order.orderDate}</td>
                <td>{order.deliveryDate}</td>
                <td>₹{order.orderValue.toLocaleString()}</td>
                <td>{order.itemsCount}</td>
                <td><StatusBadge status={order.orderStatus} /></td>
                <td><StatusBadge status={order.paymentStatus} type="payment" /></td>
                <td>{order.assignedTo}</td>
                <td>
                  <div className="sales-salesorder-action-buttons">
                    <button title="View" className="sales-salesorder-icon-btn" onClick={() => setSelectedOrder(order)}><FiEye /></button>
                    <button title="Edit" className="sales-salesorder-icon-btn" onClick={() => setSelectedOrder(order)}><FiEdit /></button>
                    <button title="Invoice" className="sales-salesorder-icon-btn"><FiFileText /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sales-salesorder-pagination">
        <div className="sales-salesorder-pagination-info">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedOrders.length)} of {sortedOrders.length} orders
        </div>
        <div className="sales-salesorder-pagination-controls">
          <select className="sales-salesorder-pagination-select" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
          </select>
          <button className="sales-salesorder-pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
          <span className="sales-salesorder-pagination-current">Page {currentPage} of {totalPages}</span>
          <button className="sales-salesorder-pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
        </div>
      </div>

      {showAddModal && <AddOrderModal onClose={() => setShowAddModal(false)} onCreate={handleCreateOrder} />}

      {selectedOrder && <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} onSave={handleUpdateOrder} />}
    </div>
  );
};

export default SalesOrdersPage;