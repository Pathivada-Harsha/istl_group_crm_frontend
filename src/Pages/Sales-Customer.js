// Customers.js — Merged with OrderBook (like Leads + Proposals)
// Features:
// • Customer detail "page" (replaces view modal — full in-page panel with back button)
// • Integrated OrderBook per customer (create / list / view) in detail tabs
// • Grid / Table toggle with card view
// • Drag & drop column reorder + column visibility
// • Sorting on all columns
// • KPI cards preserved
// • OrderBook items management inline

import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../pages-css/Sales-Customer.css';
import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import UnitTypeDropdown from '../components/Dropdowns/Unittypedropdown.js';
import { FaEye, FaEdit, FaTrash, FaUpload, FaFileDownload, FaCloudUploadAlt, FaColumns } from 'react-icons/fa';
import { RiDeleteBin6Line } from "react-icons/ri";
import * as XLSX from 'xlsx';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
].sort();

// ── All Columns Definition ────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'group',    label: 'Group',    sortable: true,  required: false },
  { key: 'company',  label: 'Company',  sortable: true,  required: false },
  { key: 'name',     label: 'Name',     sortable: true,  required: true  },
  { key: 'phone',    label: 'Phone',    sortable: true,  required: false },
  { key: 'email',    label: 'Email',    sortable: true,  required: false },
  { key: 'status',   label: 'Status',   sortable: true,  required: false },
  { key: 'city',     label: 'City',     sortable: true,  required: false },
  { key: 'actions',  label: 'Actions',  sortable: false, required: true  },
];

const DEFAULT_ORDER   = ALL_COLUMNS.map(c => c.key);
const DEFAULT_VISIBLE = ALL_COLUMNS.filter(c => !['city'].includes(c.key)).map(c => c.key);

// ── Column Visibility Dropdown ────────────────────────────────────────────────
const ColumnVisibilityDropdown = ({ columns, visibleColumns, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const hiddenCount = columns.filter(c => !c.required && !visibleColumns.includes(c.key)).length;
  return (
    <div className="col-visibility-wrapper" ref={ref}>
      <button className={`col-visibility-btn ${hiddenCount > 0 ? 'has-hidden' : ''}`} onClick={() => setOpen(o => !o)}>
        <FaColumns size={13} />
        Columns
        {hiddenCount > 0 && <span className="col-visibility-badge">{hiddenCount}</span>}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="col-visibility-dropdown">
          <div className="col-visibility-header">
            <span>Toggle Columns</span>
            <button className="col-visibility-reset" onClick={onReset}>Reset</button>
          </div>
          <div className="col-visibility-list">
            {columns.map(col => (
              <label key={col.key} className={`col-visibility-item ${col.required ? 'col-required' : ''}`}>
                <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => !col.required && onToggle(col.key)} disabled={col.required}/>
                <span className="col-visibility-label">{col.label}</span>
                {col.required && <span className="col-required-tag">required</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Draggable Header Cell ─────────────────────────────────────────────────────
const DraggableHeaderCell = ({ col, index, sortColumn, sortDirection, getSortIcon, handleSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) => (
  <th
    draggable
    onDragStart={e => onDragStart(e, index)}
    onDragOver={e => onDragOver(e, index)}
    onDrop={e => onDrop(e, index)}
    onDragEnd={onDragEnd}
    className={`col-draggable${isDragOver ? ' col-drag-over' : ''}`}
    onClick={() => col.sortable && handleSort(col.key)}
    style={{ cursor: col.sortable ? 'pointer' : 'grab', textAlign: 'center' }}
  >
    <div className="th-content">
      <span className="col-drag-handle" title="Drag to reorder">
        <svg fill="currentColor" viewBox="0 0 24 24" width="10" height="10">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </span>
      {col.label}
      {col.sortable && getSortIcon(col.key)}
    </div>
  </th>
);

// ── OrderBook Overview Summary (shown in overview tab of Customer detail) ──────
const OrderBookSummary = ({ customer, currentUser, onGoToOrderBooks }) => {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };
    fetch(`${API_BASE_URL}/order-book/getAll?page=0&size=100`, { credentials: 'include', headers })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const all = data.data || [];
          setOrders(all.filter(o => o.customerId === customer.id || o.customerId === String(customer.id)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customer.id]);

  const totalAmount  = orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
  const totalBalance = orders.reduce((s, o) => s + (parseFloat(o.balanceAmount) || 0), 0);
  const completed    = orders.filter(o => o.status === 'Completed').length;
  const latestOrder  = orders.length > 0 ? [...orders].sort((a,b) => new Date(b.orderDate) - new Date(a.orderDate))[0] : null;

  const getStatusClass = s => ({
    'Draft':'ob-s-draft','Confirmed':'ob-s-confirmed','In Production':'ob-s-production',
    'Ready for Dispatch':'ob-s-ready','Dispatched':'ob-s-dispatched','Completed':'ob-s-completed','Cancelled':'ob-s-cancelled'
  }[s] || 'ob-s-draft');

  if (loading) return null;

  if (orders.length === 0) return (
    <div className="ld-overview-proposals ld-overview-proposals-empty">
      <div className="ld-ovp-icon">📦</div>
      <div className="ld-ovp-text">
        <span className="ld-ovp-label">Order Books</span>
        <span className="ld-ovp-sub">No orders created yet for this customer</span>
      </div>
      <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToOrderBooks}>Create Order Book</button>
    </div>
  );

  return (
    <div className="ld-overview-proposals">
      <div className="ld-ovp-header">
        <h4 className="ld-card-title" style={{margin:0}}>Order Books Summary</h4>
        <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToOrderBooks}>View All →</button>
      </div>
      <div className="ld-ovp-stats">
        <div className="ld-ovp-stat">
          <span className="ld-ovp-stat-val">{orders.length}</span>
          <span className="ld-ovp-stat-label">Total Orders</span>
        </div>
        <div className="ld-ovp-stat ld-ovp-stat-money">
          <span className="ld-ovp-stat-val">₹{totalAmount.toLocaleString('en-IN')}</span>
          <span className="ld-ovp-stat-label">Total Value</span>
        </div>
        <div className="ld-ovp-stat">
          <span className="ld-ovp-stat-val">{completed}</span>
          <span className="ld-ovp-stat-label">Completed</span>
        </div>
        <div className="ld-ovp-stat" style={{color: totalBalance > 0 ? '#dc2626' : '#059669'}}>
          <span className="ld-ovp-stat-val">₹{totalBalance.toLocaleString('en-IN')}</span>
          <span className="ld-ovp-stat-label">Balance Due</span>
        </div>
      </div>
      {latestOrder && (
        <div className="ld-ovp-latest">
          <span className="ld-ovp-latest-label">Latest:</span>
          <span className="ld-proposal-no" style={{fontSize:10}}>{latestOrder.orderBookNo}</span>
          <span className="ld-ovp-latest-title">{latestOrder.orderTitle}</span>
          <span className={`ld-proposal-status ${getStatusClass(latestOrder.status)}`} style={{fontSize:10, marginLeft:'auto'}}>{latestOrder.status}</span>
        </div>
      )}
    </div>
  );
};

// ── OrderBook Form (inline in customer detail) ────────────────────────────────
const OrderBookForm = ({ customer, currentUser, onSaved, onCancel, existingOrder, groups, apiBase }) => {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);

  const [formData, setFormData] = useState({
    customerId: customer.id,
    proposalId: existingOrder?.proposalId || '',
    groupName: existingOrder?.groupName || customer.groupName || '',
    subGroupName: existingOrder?.subGroupName || customer.subGroupName || '',
    orderTitle: existingOrder?.orderTitle || '',
    orderDescription: existingOrder?.orderDescription || '',
    orderDate: existingOrder?.orderDate || new Date().toISOString().split('T')[0],
    expectedDeliveryDate: existingOrder?.expectedDeliveryDate || '',
    poNumber: existingOrder?.poNumber || '',
    poDate: existingOrder?.poDate || '',
    advanceAmount: existingOrder?.advanceAmount || '',
    status: existingOrder?.status || 'Draft',
    remarks: existingOrder?.remarks || '',
    items: []
  });

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

  useEffect(() => {
    fetch(`${apiBase}/proposals/by-customer/${customer.id}`, { credentials: 'include', headers })
      .then(r => r.json())
      .then(data => { if (data.success) setProposals(Array.isArray(data.data) ? data.data : []); })
      .catch(() => {});

    if (existingOrder) {
      fetch(`${apiBase}/order-book/${existingOrder.id}/items`, { credentials: 'include', headers })
        .then(r => r.json())
        .then(data => {
          if (data.success) setFormData(prev => ({ ...prev, items: (data.data || []).map(item => ({ ...item, isCustomUnit: false, customUnit: '' })) }));
        })
        .catch(() => {});
    }
  }, [existingOrder, customer.id]);

  const loadProposalItems = async (proposalId) => {
    if (!proposalId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/order-book/proposal-items/${proposalId}`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) {
        const items = (data.data || []).map((item, index) => ({
          lineNo: index + 1, itemName: item.itemName, specification: item.specification,
          description: item.description, proposalItemId: item.id,
          quantity: item.quantity || '', unit: item.unit || 'Nos',
          unitPrice: item.unitPrice || '', taxPercent: item.taxPercent || '',
          discountPercent: '', itemRemarks: '', isCustomUnit: false, customUnit: ''
        }));
        setFormData(prev => ({ ...prev, items }));
      }
    } catch {}
    finally { setLoading(false); }
  };

  const addItem = () => setFormData(prev => ({
    ...prev,
    items: [...prev.items, {
      lineNo: prev.items.length + 1, itemName: '', specification: '', description: '',
      proposalItemId: null, quantity: '', unit: 'Nos', unitPrice: '',
      taxPercent: '', discountPercent: '', itemRemarks: '', isCustomUnit: false, customUnit: ''
    }]
  }));

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      if (field === 'unit') {
        if (value === 'Custom') { items[index].isCustomUnit = true; items[index].unit = 'Custom'; items[index].customUnit = ''; }
        else { items[index].isCustomUnit = false; items[index].unit = value; items[index].customUnit = ''; }
      } else { items[index][field] = value; }
      return { ...prev, items };
    });
  };

  const removeItem = (index) => setFormData(prev => ({
    ...prev,
    items: prev.items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, lineNo: idx + 1 }))
  }));

  const calculateItemTotal = (item) => {
    const q = parseFloat(item.quantity) || 0, u = parseFloat(item.unitPrice) || 0;
    const d = parseFloat(item.discountPercent) || 0, t = parseFloat(item.taxPercent) || 0;
    const sub = q * u, disc = sub * (d / 100), taxable = sub - disc;
    return taxable + taxable * (t / 100);
  };

  const calculateGrandTotal = () => formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  const handleExcelUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) return;
    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const mappedItems = jsonData.map((row, index) => ({
        lineNo: index + 1, itemName: row['Item Name'] || row['itemName'] || '',
        specification: row['Specification'] || '', description: row['Description'] || '',
        quantity: row['Quantity'] || '', unit: row['Unit'] || 'Nos',
        unitPrice: row['Unit Price'] || '', taxPercent: row['Tax %'] || '',
        discountPercent: row['Discount %'] || '', itemRemarks: row['Remarks'] || '',
        proposalItemId: null, isCustomUnit: false, customUnit: ''
      })).filter(item => item.itemName?.trim());
      setFormData(prev => ({ ...prev, items: mappedItems }));
      setShowExcelModal(false); setExcelFile(null);
    } catch {}
  };

  const handleSave = async () => {
    if (!formData.orderTitle || formData.items.length === 0) { alert('Please fill in order title and add at least one item'); return; }
    setLoading(true);
    try {
      const preparedItems = formData.items.map(item => ({
        ...item, unit: item.isCustomUnit ? item.customUnit : item.unit,
        quantity: item.quantity || 0, unitPrice: item.unitPrice || 0,
        taxPercent: item.taxPercent || 0, discountPercent: item.discountPercent || 0
      }));
      const submitData = { ...formData, advanceAmount: formData.advanceAmount || 0, items: preparedItems };
      const url = existingOrder ? `${apiBase}/order-book/update/${existingOrder.id}` : `${apiBase}/order-book/create`;
      const method = existingOrder ? 'PUT' : 'POST';
      const res = await fetch(url, { method, credentials: 'include', headers, body: JSON.stringify(submitData) });
      const data = await res.json();
      if (data.success) onSaved(data.data);
    } catch { alert('Failed to save order book'); }
    finally { setLoading(false); }
  };

  return (
    <div className="ob-form-wrapper">
      {/* Basic Info */}
      <div className="orderbook-card">
        <h3>Basic Information</h3>
        <div className="orderbook-form-grid">
          <div className="orderbook-form-group">
            <label>Order Title *</label>
            <input type="text" value={formData.orderTitle} onChange={e => setFormData({...formData, orderTitle: e.target.value})} placeholder="Enter order title"/>
          </div>
          <div className="orderbook-form-group">
            <label>Order Date *</label>
            <input type="date" value={formData.orderDate} onChange={e => setFormData({...formData, orderDate: e.target.value})}/>
          </div>
          <div className="orderbook-form-group">
            <label>Expected Delivery Date</label>
            <input type="date" value={formData.expectedDeliveryDate} onChange={e => setFormData({...formData, expectedDeliveryDate: e.target.value})}/>
          </div>
          <div className="orderbook-form-group">
            <label>Status</label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option>Draft</option><option>Confirmed</option><option>In Production</option>
              <option>Ready for Dispatch</option><option>Dispatched</option><option>Completed</option><option>Cancelled</option>
            </select>
          </div>
          <div className="orderbook-form-group">
            <label>PO Number</label>
            <input type="text" value={formData.poNumber} onChange={e => setFormData({...formData, poNumber: e.target.value})} placeholder="Enter PO number"/>
          </div>
          <div className="orderbook-form-group">
            <label>PO Date</label>
            <input type="date" value={formData.poDate} onChange={e => setFormData({...formData, poDate: e.target.value})}/>
          </div>
          <div className="orderbook-form-group">
            <label>Advance Amount (₹)</label>
            <input type="number" step="0.01" value={formData.advanceAmount} onChange={e => setFormData({...formData, advanceAmount: e.target.value})} placeholder="0.00"/>
          </div>
          <div className="orderbook-form-group">
            <label>Proposal (Optional)</label>
            <select value={formData.proposalId} onChange={e => { setFormData({...formData, proposalId: e.target.value}); if (e.target.value) loadProposalItems(e.target.value); }}>
              <option value="">Select Proposal</option>
              {proposals.map(p => <option key={p.id} value={p.id}>{p.proposalNo} - {p.title}</option>)}
            </select>
          </div>
          <div className="orderbook-form-group orderbook-form-full">
            <label>Description</label>
            <textarea value={formData.orderDescription} onChange={e => setFormData({...formData, orderDescription: e.target.value})} placeholder="Enter order description" rows={2}/>
          </div>
          <div className="orderbook-form-group orderbook-form-full">
            <label>Remarks</label>
            <textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="Enter any remarks" rows={2}/>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="orderbook-card">
        <div className="orderbook-items-header">
          <h3>Order Items</h3>
          <div style={{display:'flex', gap:'8px'}}>
            <button type="button" className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon" onClick={() => setShowExcelModal(true)}>
              <FaUpload size={11}/> Import Excel
            </button>
            <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={addItem}>+ Add Item</button>
          </div>
        </div>

        {formData.items.length === 0 ? (
          <div className="orderbook-empty-items"><p>No items added. Click "Add Item" to start or import from Excel.</p></div>
        ) : (
          <>
            <div className="orderbook-table-wrapper">
              <table className="orderbook-table orderbook-items-table">
                <thead>
                  <tr>
                    <th style={{width:36}}>#</th>
                    <th style={{width:180}}>Item Name *</th>
                    <th style={{width:140}}>Specification</th>
                    <th style={{width:80}}>Qty *</th>
                    <th style={{width:110}}>Unit *</th>
                    <th style={{width:110}}>Unit Price (₹)</th>
                    <th style={{width:90}}>Discount %</th>
                    <th style={{width:70}}>Tax %</th>
                    <th style={{width:100}}>Line Total</th>
                    <th style={{width:50}}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="orderbook-table-cell-centered">{item.lineNo}</td>
                      <td><input type="text" className="orderbook-table-input" value={item.itemName} onChange={e => updateItem(index,'itemName',e.target.value)} placeholder="Item name" required/></td>
                      <td><input type="text" className="orderbook-table-input" value={item.specification} onChange={e => updateItem(index,'specification',e.target.value)} placeholder="Spec"/></td>
                      <td><input type="number" step="0.0001" className="orderbook-table-input orderbook-table-input-number" value={item.quantity} onChange={e => updateItem(index,'quantity',e.target.value)} placeholder="0" required/></td>
                      <td>
                        {item.isCustomUnit
                          ? <input type="text" className="orderbook-table-input" value={item.customUnit} onChange={e => updateItem(index,'customUnit',e.target.value)} placeholder="Custom unit"/>
                          : <UnitTypeDropdown value={item.unit} onChange={e => updateItem(index,'unit',e.target.value)} className="orderbook-table-input" placeholder="Unit"/>
                        }
                      </td>
                      <td><input type="number" step="0.01" className="orderbook-table-input orderbook-table-input-number" value={item.unitPrice} onChange={e => updateItem(index,'unitPrice',e.target.value)} placeholder="0.00"/></td>
                      <td><input type="number" step="0.01" className="orderbook-table-input orderbook-table-input-number" value={item.discountPercent} onChange={e => updateItem(index,'discountPercent',e.target.value)} placeholder="0"/></td>
                      <td><input type="number" step="0.01" className="orderbook-table-input orderbook-table-input-number" value={item.taxPercent} onChange={e => updateItem(index,'taxPercent',e.target.value)} placeholder="0"/></td>
                      <td className="orderbook-table-cell-total">₹{calculateItemTotal(item).toFixed(2)}</td>
                      <td className="orderbook-table-cell-centered">
                        <button type="button" className="orderbook-table-delete-btn" onClick={() => removeItem(index)}><FaTrash size={11}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="orderbook-grand-total">
              <span>Grand Total:</span>
              <strong>₹{calculateGrandTotal().toLocaleString('en-IN', {minimumFractionDigits:2})}</strong>
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="ld-pform-footer">
        <button className="ld-btn ld-btn-sec" onClick={onCancel}>Cancel</button>
        <button className="ld-btn ld-btn-pri" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : existingOrder ? 'Update Order Book' : 'Create Order Book'}</button>
      </div>

      {/* Excel Upload Modal */}
      {showExcelModal && (
        <div className="orderbook-modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="orderbook-modal" onClick={e => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Import Items from Excel</h2>
              <button className="orderbook-modal-close" onClick={() => { setShowExcelModal(false); setExcelFile(null); }}>×</button>
            </div>
            <form onSubmit={handleExcelUpload} className="orderbook-modal-content">
              <div className="orderbook-form-group">
                <label>Excel File *</label>
                <input type="file" onChange={e => setExcelFile(e.target.files[0])} accept=".xlsx,.xls" required/>
                <small className="orderbook-help-text">Required columns: Item Name, Quantity, Unit</small>
              </div>
              <div className="orderbook-modal-actions">
                <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={() => { setShowExcelModal(false); setExcelFile(null); }}>Cancel</button>
                <button type="submit" className="orderbook-btn orderbook-btn-primary" disabled={!excelFile}>Import Items</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Customer Detail Page ──────────────────────────────────────────────────────
const CustomerDetailPage = ({ customer, currentUser, onBack, onEdit, permissions, showSuccess, showError }) => {
  const [activeTab, setActiveTab]       = useState('overview');
  const [orderBooks, setOrderBooks]     = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [followups, setFollowups]       = useState([]);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [showOrderForm, setShowOrderForm]   = useState(false);
  const [editingOrder, setEditingOrder]     = useState(null);
  const [selectedOrder, setSelectedOrder]   = useState(null);
  const [showOrderView, setShowOrderView]   = useState(false);
  const [showDeleteOrderConfirm, setShowDeleteOrderConfirm] = useState(false);
  const [deleteOrderId, setDeleteOrderId]   = useState(null);
  const [showPOUploadModal, setShowPOUploadModal] = useState(false);
  const [poUploadOrder, setPoUploadOrder]   = useState(null);
  const [poUploadData, setPoUploadData]     = useState({ file: null, poNumber: '', poDate: new Date().toISOString().split('T')[0] });
  const [orderItemsCache, setOrderItemsCache] = useState({});

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

  const fetchOrderBooks = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_BASE_URL}/order-book/getAll?page=0&size=100`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) {
        const all = data.data || [];
        setOrderBooks(all.filter(o => o.customerId === customer.id || o.customerId === String(customer.id)));
      }
    } catch { showError('Failed to load order books'); }
    finally { setLoadingOrders(false); }
  }, [customer.id]);

  const fetchFollowups = useCallback(async () => {
    setLoadingFollowups(true);
    try {
      const res = await fetch(`${API_BASE_URL}/followups/entity/Customer/${customer.id}`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) setFollowups(data.data || []);
    } catch { }
    finally { setLoadingFollowups(false); }
  }, [customer.id]);

  useEffect(() => {
    if (activeTab === 'orderbooks') fetchOrderBooks();
    if (activeTab === 'followups')  fetchFollowups();
  }, [activeTab]);

  const handleViewOrder = async (order) => {
    try {
      if (!orderItemsCache[order.id]) {
        const res = await fetch(`${API_BASE_URL}/order-book/${order.id}/items`, { credentials: 'include', headers });
        const data = await res.json();
        if (data.success) { setOrderItemsCache(prev => ({ ...prev, [order.id]: data.data || [] })); }
      }
      setSelectedOrder({ ...order, items: orderItemsCache[order.id] || [] });
      setShowOrderView(true);
    } catch { showError('Failed to load order details'); }
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/order-book/delete/${deleteOrderId}`, { method: 'DELETE', credentials: 'include', headers });
      const data = await res.json();
      if (data.success) { showSuccess('Order book deleted'); setShowDeleteOrderConfirm(false); setDeleteOrderId(null); fetchOrderBooks(); }
    } catch { showError('Failed to delete order book'); }
  };

  const handlePOUpload = async (e) => {
    e.preventDefault();
    if (!poUploadData.file || !poUploadData.poNumber) { showError('Please select a file and enter PO number'); return; }
    const formDataUpload = new FormData();
    formDataUpload.append('file', poUploadData.file);
    formDataUpload.append('poNumber', poUploadData.poNumber);
    if (poUploadData.poDate) formDataUpload.append('poDate', poUploadData.poDate);
    try {
      const res = await fetch(`${API_BASE_URL}/order-book/${poUploadOrder.id}/upload-po`, { method: 'POST', credentials: 'include', headers: { 'User-Id': currentUser.id, 'User-Role': currentUser.role }, body: formDataUpload });
      const data = await res.json();
      if (data.success) { showSuccess('PO uploaded successfully'); setShowPOUploadModal(false); fetchOrderBooks(); }
    } catch { showError('Failed to upload PO'); }
  };

  const getStatusClass = s => ({ Draft:'ob-s-draft', Confirmed:'ob-s-confirmed', 'In Production':'ob-s-production', 'Ready for Dispatch':'ob-s-ready', Dispatched:'ob-s-dispatched', Completed:'ob-s-completed', Cancelled:'ob-s-cancelled' }[s] || 'ob-s-draft');

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '-';

  const calculateItemTotal = (item) => {
    const q = parseFloat(item.quantity)||0, u = parseFloat(item.unitPrice)||0;
    const d = parseFloat(item.discountPercent)||0, t = parseFloat(item.taxPercent)||0;
    const sub = q*u, disc = sub*(d/100), taxable = sub-disc;
    return taxable + taxable*(t/100);
  };

  return (
    <div className="ld-detail-page">
      {/* Top bar */}
      <div className="ld-detail-topbar">
        <button className="ld-back-btn" onClick={onBack}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Customers
        </button>
        <div className="ld-detail-breadcrumb">
          <span style={{cursor:'pointer',color:'#6b7280'}} onClick={onBack}>Customers</span>
          <span style={{margin:'0 6px',color:'#d1d5db'}}>/</span>
          <span style={{color:'#111827',fontWeight:500}}>{customer.customerCode}</span>
        </div>
        {permissions.canEdit && (
          <button className="cust-btn cust-btn-primary" style={{marginLeft:'auto'}} onClick={() => onEdit(customer)}>
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit Customer
          </button>
        )}
      </div>

      {/* Hero card */}
      <div className="ld-hero">
        <div className="ld-hero-left">
          <div className="ld-hero-avatar">{customer.name?.[0]?.toUpperCase() || '?'}</div>
          <div>
            <h2 className="ld-hero-name">{customer.name}</h2>
            {customer.companyName && <div style={{fontSize:13,color:'#6b7280'}}>{customer.companyName}</div>}
            <div className="ld-hero-code">{customer.customerCode}</div>
          </div>
        </div>
        <div className="ld-hero-badges">
          {customer.groupName && <span className={`cust-badge badge-${getGroupColor(customer.groupName)}`}>{customer.groupName}</span>}
          <span className={`cust-badge badge-${getStatusColor(customer.status)}`}>{customer.status}</span>
        </div>
        <div className="ld-hero-actions">
          <button className="cust-btn cust-btn-secondary" onClick={() => { setActiveTab('orderbooks'); setShowOrderForm(true); setEditingOrder(null); }}>
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Order Book
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ld-tabs">
        {[{k:'overview',l:'Overview'},{k:'orderbooks',l:'Order Books'},{k:'followups',l:'Follow-ups'}].map(t => (
          <button key={t.k} className={`ld-tab${activeTab===t.k?' active':''}`} onClick={() => { setActiveTab(t.k); setShowOrderForm(false); setShowOrderView(false); }}>{t.l}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="ld-tab-content">
          <div className="ld-info-grid">
            <div className="ld-info-card">
              <h4 className="ld-card-title">Contact Information</h4>
              <div className="ld-field-list">
                {[
                  ['Email',   customer.email || '-'],
                  ['Phone',   customer.phone || '-'],
                  ['Alt Phone', customer.altPhone || '-'],
                  ['Website', customer.website ? <a href={customer.website} target="_blank" rel="noopener noreferrer" style={{color:'#3b82f6'}}>{customer.website}</a> : '-'],
                  ['Contact Person', customer.contactPerson || '-'],
                  ['Designation', customer.designation || '-'],
                ].map(([l,v]) => (
                  <div className="ld-field-row" key={l}>
                    <span className="ld-field-label">{l}</span>
                    <span className="ld-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ld-info-card">
              <h4 className="ld-card-title">Business Details</h4>
              <div className="ld-field-list">
                {[
                  ['GST Number', customer.gstNumber || '-'],
                  ['PAN', customer.pan || '-'],
                  ['Group', customer.groupName || '-'],
                  ['Category', customer.subGroupName || '-'],
                  ['Assigned To', customer.assignedToName || '-'],
                  ['Address', customer.address ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''} ${customer.pincode ? '- '+customer.pincode : ''}` : '-'],
                ].map(([l,v]) => (
                  <div className="ld-field-row" key={l}>
                    <span className="ld-field-label">{l}</span>
                    <span className="ld-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <OrderBookSummary
            customer={customer}
            currentUser={currentUser}
            onGoToOrderBooks={() => { setActiveTab('orderbooks'); setShowOrderForm(false); }}
          />
        </div>
      )}

      {/* ── ORDER BOOKS ── */}
      {activeTab === 'orderbooks' && (
        <div className="ld-tab-content">
          {showOrderView && selectedOrder ? (
            <div>
              <div className="ld-section-hdr" style={{marginBottom:12}}>
                <button className="ld-back-btn" onClick={() => setShowOrderView(false)}>← Back to Orders</button>
              </div>
              <div className="orderbook-card">
                <div className="orderbook-card-header">
                  <div><h3>{selectedOrder.orderTitle}</h3><p className="orderbook-id">{selectedOrder.orderBookNo}</p></div>
                  <span className={`orderbook-status ${getStatusClass(selectedOrder.status)}`}>{selectedOrder.status}</span>
                </div>
                <div className="orderbook-info-grid">
                  <div><strong>Order Date:</strong> {fmtDate(selectedOrder.orderDate)}</div>
                  <div><strong>Expected Delivery:</strong> {fmtDate(selectedOrder.expectedDeliveryDate)}</div>
                  <div><strong>PO Number:</strong> {selectedOrder.poNumber || '-'}</div>
                  <div><strong>PO Date:</strong> {fmtDate(selectedOrder.poDate)}</div>
                  <div><strong>Advance Amount:</strong> ₹{parseFloat(selectedOrder.advanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
                  <div><strong>Total Amount:</strong> ₹{parseFloat(selectedOrder.totalAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
                  <div><strong>Balance:</strong> <span style={{color:'#dc2626'}}>₹{parseFloat(selectedOrder.balanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
                </div>
                {selectedOrder.orderDescription && <div className="orderbook-description"><strong>Description:</strong><p>{selectedOrder.orderDescription}</p></div>}
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="orderbook-card">
                  <h3>Order Items</h3>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table">
                      <thead><tr><th>#</th><th>Item Name</th><th>Specification</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Discount%</th><th>Tax%</th><th>Total</th></tr></thead>
                      <tbody>
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.lineNo}</td><td>{item.itemName}</td><td>{item.specification||'-'}</td>
                            <td>{item.quantity}</td><td>{item.unit}</td>
                            <td>₹{parseFloat(item.unitPrice||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                            <td>{item.discountPercent||0}%</td><td>{item.taxPercent||0}%</td>
                            <td>₹{calculateItemTotal(item).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="orderbook-total-row">
                          <td colSpan="8" style={{textAlign:'right'}}><strong>Total:</strong></td>
                          <td><strong>₹{parseFloat(selectedOrder.totalAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedOrder.remarks && <div className="orderbook-card"><h3>Remarks</h3><p>{selectedOrder.remarks}</p></div>}
            </div>
          ) : showOrderForm ? (
            <div>
              <div className="ld-section-hdr" style={{marginBottom:12}}>
                <h4 className="ld-card-title" style={{margin:0}}>{editingOrder ? 'Edit Order Book' : 'New Order Book'} — {customer.name}</h4>
                <button className="ld-btn ld-btn-sec" onClick={() => { setShowOrderForm(false); setEditingOrder(null); }}>Cancel</button>
              </div>
              <OrderBookForm
                customer={customer}
                currentUser={currentUser}
                apiBase={API_BASE_URL}
                existingOrder={editingOrder}
                onSaved={() => { setShowOrderForm(false); setEditingOrder(null); showSuccess(editingOrder ? 'Order updated!' : 'Order created!'); fetchOrderBooks(); }}
                onCancel={() => { setShowOrderForm(false); setEditingOrder(null); }}
              />
            </div>
          ) : (
            <div>
              <div className="ld-section-hdr">
                <h4 className="ld-card-title" style={{margin:0}}>{orderBooks.length} Order Book{orderBooks.length !== 1 ? 's' : ''}</h4>
                <button className="ld-btn ld-btn-pri" onClick={() => { setShowOrderForm(true); setEditingOrder(null); }}>+ New Order Book</button>
              </div>
              {loadingOrders ? (
                <div className="ld-loading-row">Loading orders…</div>
              ) : orderBooks.length === 0 ? (
                <div className="ld-empty-state">
                  <div className="ld-empty-icon">📦</div>
                  <p>No order books yet for this customer.</p>
                  <button className="ld-btn ld-btn-pri" onClick={() => setShowOrderForm(true)}>Create First Order Book</button>
                </div>
              ) : (
                <div className="ld-proposals-list">
                  {orderBooks.map(order => (
                    <div key={order.id} className="ld-proposal-card">
                      <div className="ld-proposal-card-left">
                        <div className="ld-proposal-no">{order.orderBookNo}</div>
                        <div className="ld-proposal-title">{order.orderTitle}</div>
                        <div className="ld-proposal-meta">
                          <span>₹{parseFloat(order.totalAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                          <span>·</span>
                          <span>Advance: ₹{parseFloat(order.advanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                          <span>·</span>
                          <span style={{color:'#dc2626'}}>Balance: ₹{parseFloat(order.balanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                          <span>·</span>
                          <span>{fmtDate(order.orderDate)}</span>
                        </div>
                      </div>
                      <div className="ld-proposal-card-right">
                        <span className={`orderbook-status ${getStatusClass(order.status)}`}>{order.status}</span>
                        <div className="ld-proposal-actions">
                          <button className="ld-pact-btn" onClick={() => handleViewOrder(order)} title="View Details">
                            <FaEye size={13}/> View
                          </button>
                          <button className="ld-pact-btn" onClick={() => { setPoUploadOrder(order); setPoUploadData({file:null, poNumber:order.poNumber||'', poDate:new Date().toISOString().split('T')[0]}); setShowPOUploadModal(true); }} title="Upload PO">
                            <FaCloudUploadAlt size={13}/> PO
                          </button>
                          <button className="ld-pact-btn ld-pact-edit" onClick={() => { setEditingOrder(order); setShowOrderForm(true); }} title="Edit">
                            <FaEdit size={13}/> Edit
                          </button>
                          <button className="ld-pact-btn" style={{color:'#dc2626'}} onClick={() => { setDeleteOrderId(order.id); setShowDeleteOrderConfirm(true); }} title="Delete">
                            <RiDeleteBin6Line size={13}/> Del
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FOLLOW-UPS ── */}
      {activeTab === 'followups' && (
        <div className="ld-tab-content">
          <h4 className="ld-card-title">Follow-up History</h4>
          {loadingFollowups ? <div className="ld-loading-row">Loading...</div> :
           followups.length === 0 ? <div className="ld-empty-state"><div className="ld-empty-icon">📞</div><p>No follow-ups recorded.</p></div> :
           <div className="ld-history-list">
             {followups.map(f => (
               <div key={f.id} className="ld-history-item">
                 <div className="ld-history-icon">{f.followupType === 'Call' ? '📞' : f.followupType === 'Email' ? '📧' : f.followupType === 'Meeting' ? '🤝' : '📋'}</div>
                 <div className="ld-history-body">
                   <div className="ld-history-hdr">
                     <span className="ld-history-type">{f.followupType}</span>
                     <span className={`cust-badge ${f.priority === 'High' ? 'cust-badge-high' : f.priority === 'Low' ? 'cust-badge-low' : 'cust-badge-medium'}`}>{f.priority}</span>
                     <span className="ld-history-date">{f.scheduledAt ? new Date(f.scheduledAt).toLocaleString() : '-'}</span>
                   </div>
                   {f.notes && <div className="ld-history-desc">{f.notes}</div>}
                   <div style={{fontSize:11,color:'#9ca3af',marginTop:4}}>Status: {f.status} {f.assignedToName ? `· Assigned: ${f.assignedToName}` : ''}</div>
                 </div>
               </div>
             ))}
           </div>
          }
        </div>
      )}

      {/* Delete Order Confirm */}
      {showDeleteOrderConfirm && (
        <div className="orderbook-modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="orderbook-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="orderbook-delete-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <h3>Delete Order Book</h3>
            <p>Are you sure you want to delete this order book?</p>
            <p className="orderbook-delete-warning">This action cannot be undone.</p>
            <div className="orderbook-delete-actions">
              <button className="orderbook-btn orderbook-btn-secondary" onClick={() => setShowDeleteOrderConfirm(false)}>Cancel</button>
              <button className="orderbook-btn orderbook-btn-danger" onClick={handleDeleteOrder}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* PO Upload Modal */}
      {showPOUploadModal && poUploadOrder && (
        <div className="orderbook-modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="orderbook-modal" onClick={e => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Upload PO for {poUploadOrder.orderBookNo}</h2>
              <button className="orderbook-modal-close" onClick={() => setShowPOUploadModal(false)}>×</button>
            </div>
            <form onSubmit={handlePOUpload} className="orderbook-modal-content">
              <div className="orderbook-form-group"><label>PO Number *</label><input type="text" value={poUploadData.poNumber} onChange={e => setPoUploadData({...poUploadData, poNumber: e.target.value})} required/></div>
              <div className="orderbook-form-group"><label>PO Date</label><input type="date" value={poUploadData.poDate} onChange={e => setPoUploadData({...poUploadData, poDate: e.target.value})}/></div>
              <div className="orderbook-form-group"><label>PO File *</label><input type="file" onChange={e => setPoUploadData({...poUploadData, file: e.target.files[0]})} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required/></div>
              <div className="orderbook-modal-actions">
                <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={() => setShowPOUploadModal(false)}>Cancel</button>
                <button type="submit" className="orderbook-btn orderbook-btn-primary">Upload PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Color helpers (module-level) ──────────────────────────────────────────────
const getGroupColor = (group) => {
  const colors = { CCMS:'blue', Solar:'yellow', EPC:'green', IoT:'purple', Hybrid:'orange', Others:'grey' };
  return colors[group] || 'grey';
};
const getStatusColor = (status) => {
  const colors = { Active:'green', Inactive:'grey', Prospect:'orange', Lead:'blue' };
  return colors[status] || 'grey';
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const CustomerDatabase = () => {
  const isFirstRender = useRef(true);
  const { user, pagePermissions } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // ── Permissions ──────────────────────────────────────────────────
  const customersPermissions = pagePermissions?.CUSTOMERS || [];
  const canView   = customersPermissions.includes('VIEW');
  const canCreate = customersPermissions.includes('CREATE');
  const canEdit   = customersPermissions.includes('EDIT');
  const canDelete = customersPermissions.includes('DELETE');
  const permissions = { canView, canCreate, canEdit, canDelete };

  const currentUser = { id: user.id || 1, role: user.role || 'USER', name: user.name || 'Current User' };

  // ── UI State ──────────────────────────────────────────────────────
  const [viewMode,       setViewMode]       = useState('table');
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  // ── Data ──────────────────────────────────────────────────────────
  const [customers,    setCustomers]    = useState([]);
  const [users,        setUsers]        = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [subGroups,    setSubGroups]    = useState([]);

  // ── Filters ───────────────────────────────────────────────────────
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedStatus,setSelectedStatus]= useState('All');
  const [rowsPerPage,   setRowsPerPage]   = useState(10);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [totalCustomers,setTotalCustomers]= useState(0);
  const [sortColumn,    setSortColumn]    = useState('');
  const [sortDirection, setSortDirection] = useState('asc');

  // ── Column state ──────────────────────────────────────────────────
  const [columnOrder,    setColumnOrder]    = useState(DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const dragIndexRef   = useRef(null);
  const [dragOverIndex,setDragOverIndex]   = useState(null);

  // ── Modals ────────────────────────────────────────────────────────
  const [isAddFormOpen,   setIsAddFormOpen]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCustomerId,setDeleteCustomerId]= useState(null);
  const [deleteCustomerName,setDeleteCustomerName] = useState('');
  const [phoneError,      setPhoneError]      = useState('');

  // ── Quick Order Book Modal ────────────────────────────────────────
  const [quickObCustomer, setQuickObCustomer] = useState(null); // customer object
  const [quickObForm, setQuickObForm] = useState({ title: '', poNumber: '', poDate: '', deliveryDate: '', totalValue: '', notes: '', status: 'Draft' });
  const [quickObLoading, setQuickObLoading] = useState(false);

  const openQuickOb = (e, customer) => {
    e.stopPropagation();
    setQuickObCustomer(customer);
    setQuickObForm({ title: '', poNumber: '', poDate: '', deliveryDate: '', totalValue: '', notes: '', status: 'Draft' });
  };

  const closeQuickOb = () => { setQuickObCustomer(null); };

  const submitQuickOb = async () => {
    if (!quickObForm.title.trim()) { showError('Order title is required'); return; }
    setQuickObLoading(true);
    try {
      await fetchWithHeaders(`${API_BASE_URL}/order-book/create`, {
        method: 'POST',
        body: JSON.stringify({ ...quickObForm, customerId: quickObCustomer.id, customerName: quickObCustomer.name })
      });
      showSuccess(`Order Book created for ${quickObCustomer.name}`);
      closeQuickOb();
    } catch(err) {
      showError('Failed to create order book: ' + err.message);
    } finally {
      setQuickObLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '', companyName: '', groupName: '', subGroupName: '',
    contactPerson: '', designation: '', email: '', phone: '', altPhone: '',
    website: '', gstNumber: '', pan: '', address: '', city: '', state: '',
    pincode: '', status: 'Active', assignedTo: null
  });

  // ── Derived columns ───────────────────────────────────────────────
  const orderedVisibleColumns = columnOrder
    .map(k => ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && visibleColumns.includes(c.key));

  // ── Fetch helpers ─────────────────────────────────────────────────
  const fetchWithHeaders = async (url, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', 'User-Id': currentUser.id, 'User-Role': currentUser.role, ...opts.headers };
    const res = await fetch(url, { ...opts, credentials: 'include', headers });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `HTTP ${res.status}`); }
    return res.json();
  };

  const fetchCustomers = async (overridePage) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (groupName)                         params.append('groupName',    groupName);
      if (subGroupName)                      params.append('subGroupName', subGroupName);
      if (searchTerm.trim())                 params.append('search',       searchTerm.trim());
      if (selectedGroup  !== 'All')          params.append('group',        selectedGroup);
      if (selectedStatus !== 'All')          params.append('status',       selectedStatus);
      params.append('page', (overridePage !== undefined ? overridePage : currentPage) - 1);
      params.append('size', rowsPerPage);
      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/getAll?${params}`);
      if (data.success) {
        const list = data.data.content || data.data;
        setCustomers(list);
        setTotalCustomers(data.data.totalElements || list.length || 0);
      }
    } catch (err) { setError(err.message || 'Error fetching customers'); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-users`, { credentials:'include', headers:{ 'User-Id': currentUser.id, 'User-Role': currentUser.role } });
      const data = await res.json(); if (Array.isArray(data)) setUsers(data);
    } catch { setUsers([]); }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, { credentials:'include', headers:{ 'User-Id': currentUser.id, 'User-Role': currentUser.role } });
      const data = await res.json(); if (Array.isArray(data)) setGroups(data);
    } catch { setGroups([]); }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) { setSubGroups([]); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, { credentials:'include', headers:{ 'User-Id': currentUser.id, 'User-Role': currentUser.role } });
      const data = await res.json(); if (Array.isArray(data)) setSubGroups(data);
    } catch { setSubGroups([]); }
  };

  // ── Effects ──────────────────────────────────────────────────────
  // Initial load only
  useEffect(() => {
    if (canView) { fetchCustomers(); fetchUsers(); fetchGroups(); }
  }, []);

  // Re-fetch when page or pageSize changes — these never need a page reset
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (canView) fetchCustomers();
  }, [currentPage, rowsPerPage]);

  // Any filter change → reset to page 1 and fetch with page=1 explicitly
  // groupName/subGroupName come from GroupCategoryFilter (URL/context state)
  // searchTerm, selectedGroup, selectedStatus are local state
  useEffect(() => {
    if (!canView) return;
    // Always reset to page 1 when any filter changes, pass page=1 explicitly
    // to avoid stale currentPage closure
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchCustomers(1);
    }, 300);
    return () => clearTimeout(t);
  }, [groupName, subGroupName, searchTerm, selectedGroup, selectedStatus]);

  useEffect(() => { if (formData.groupName) fetchSubGroupsForForm(formData.groupName); else setSubGroups([]); }, [formData.groupName]);

  // ── Sort ──────────────────────────────────────────────────────────
  const handleSort = (colKey) => {
    const dir = sortColumn === colKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(colKey); setSortDirection(dir);
    const keyMap = { group:'groupName', company:'companyName', name:'name', phone:'phone', email:'email', status:'status', city:'city' };
    const field = keyMap[colKey] || colKey;
    setCustomers(prev => [...prev].sort((a,b) => {
      const av=a[field]||'', bv=b[field]||'';
      return dir==='asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }));
  };

  // ── Drag column ───────────────────────────────────────────────────
  const handleColDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed='move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOverIndex(idx); };
  const handleColDrop      = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisibleColumns.map(c => c.key);
    const fromKey = visKeys[fromIdx], toKey = visKeys[dropIdx];
    const o = [...columnOrder];
    const a = o.indexOf(fromKey), b = o.indexOf(toKey);
    o.splice(a,1); o.splice(b,0,fromKey);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd = e => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };

  const handleToggleColumn = k => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns = () => { setColumnOrder(DEFAULT_ORDER); setVisibleColumns(DEFAULT_VISIBLE); };

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleViewCustomer = async (customer) => {
    if (!canView) { showError('No view permission'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/${customer.id}`);
      if (data.success) setDetailCustomer(data.data);
    } catch (err) { showError(err.message || 'Error fetching customer details'); }
  };

  const handleEdit = (customer) => {
    if (!canEdit) { showError('No edit permission'); return; }
    setDetailCustomer(null);
    setFormData({
      id: customer.id, name: customer.name, companyName: customer.companyName||'',
      groupName: customer.groupName||'', subGroupName: customer.subGroupName||'',
      contactPerson: customer.contactPerson||'', designation: customer.designation||'',
      email: customer.email, phone: customer.phone, altPhone: customer.altPhone||'',
      website: customer.website||'', gstNumber: customer.gstNumber||'', pan: customer.pan||'',
      address: customer.address||'', city: customer.city||'', state: customer.state||'',
      pincode: customer.pincode||'', status: customer.status||'Active', assignedTo: customer.assignedTo
    });
    setPhoneError(''); setIsAddFormOpen(true);
  };

  const handleDeleteClick = (customerId, customerName) => {
    if (!canDelete) { showError('No delete permission'); return; }
    setDeleteCustomerId(customerId); setDeleteCustomerName(customerName); setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/delete/${deleteCustomerId}`, { method:'DELETE' });
      if (data.success) { showSuccess('Customer deleted'); setShowDeleteModal(false); fetchCustomers(); }
    } catch (err) { showError(err.message || 'Error deleting customer'); setShowDeleteModal(false); }
  };

  const handlePhoneChange = (value, field) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) { setFormData({...formData, [field]: cleaned}); }
    if (field === 'phone') setPhoneError(cleaned.length > 0 && cleaned.length !== 10 ? 'Must be exactly 10 digits' : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.phone.length !== 10) { setPhoneError('Phone must be exactly 10 digits'); return; }
    if (formData.pan && formData.pan.length !== 10) { showError('PAN must be exactly 10 characters'); return; }
    setLoading(true);
    try {
      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/customers/update/${formData.id}`, { method:'PUT', body: JSON.stringify(formData) });
        if (data.success) { showSuccess('Customer updated'); setIsAddFormOpen(false); resetForm(); fetchCustomers(); }
      } else {
        const data = await fetchWithHeaders(`${API_BASE_URL}/customers/create`, { method:'POST', body: JSON.stringify(formData) });
        if (data.success) { showSuccess('Customer created'); setIsAddFormOpen(false); resetForm(); fetchCustomers(); }
      }
    } catch (err) { showError(err.message || 'Error saving customer'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({ name:'', companyName:'', groupName:'', subGroupName:'', contactPerson:'', designation:'', email:'', phone:'', altPhone:'', website:'', gstNumber:'', pan:'', address:'', city:'', state:'', pincode:'', status:'Active', assignedTo: null });
    setPhoneError('');
  };

  const exportToCSV = () => {
    if (!canView) return;
    const headers = ['Customer Code','Name','Company','Email','Phone','Group','Status','City','State'];
    const csv = [headers.join(','), ...customers.map(c => [c.customerCode,c.name,c.companyName||'',c.email,c.phone,c.groupName||'',c.status,c.city||'',c.state||''].join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`customers_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  // ── Sort icon ─────────────────────────────────────────────────────
  const getSortIcon = (col) => {
    if (sortColumn !== col) return <svg className="sort-icon sort-icon-default" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>;
    return sortDirection === 'asc'
      ? <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
      : <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>;
  };

  // ── Render cell ───────────────────────────────────────────────────
  const renderCell = (customer, colKey) => {
    switch(colKey) {
      case 'group':   return <span className={`cust-badge badge-${getGroupColor(customer.groupName)}`}>{customer.groupName || 'Others'}</span>;
      case 'company': return customer.companyName || 'N/A';
      case 'name':    return <span className="cust-font-medium">{customer.name || 'N/A'}</span>;
      case 'phone':   return customer.phone || 'N/A';
      case 'email':   return customer.email || 'N/A';
      case 'city':    return customer.city || '-';
      case 'status':  return <span className={`cust-badge badge-${getStatusColor(customer.status)}`}>{customer.status}</span>;
      case 'actions': return (
        <div className="cust-action-buttons-cell-center" style={{textAlign:'center'}}>
          {canView && (
            <button className="cust-action-btn cust-action-view" onClick={e => { e.stopPropagation(); handleViewCustomer(customer); }} title="View Customer">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
          )}
          <button className={`cust-action-btn cust-action-edit ${!canEdit?'cust-action-disabled':''}`} onClick={e => { e.stopPropagation(); handleEdit(customer); }} disabled={!canEdit} title="Edit Customer">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          {/* canCreate && (
            <button className="cust-action-btn" onClick={e => openQuickOb(e, customer)} title="Create Order Book" style={{color:'#8b5cf6'}}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </button>
          ) */}
          <button className={`cust-action-btn cust-action-delete ${!canDelete?'cust-action-disabled':''}`} onClick={e => { e.stopPropagation(); handleDeleteClick(customer.id, customer.name); }} disabled={!canDelete} title="Delete Customer">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      );
      default: return '-';
    }
  };

  // ── KPI ───────────────────────────────────────────────────────────
  const kpiData = {
    totalCustomers,
    newThisMonth: customers.filter(c => { const d = new Date(c.createdAt), n = new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length,
    activeCustomers: customers.filter(c => c.status === 'Active').length,
    pendingFollowups: customers.reduce((sum,c) => sum+(c.pendingFollowupsCount||0),0)
  };

  // ── Pagination ────────────────────────────────────────────────────
  const totalPages  = Math.ceil(totalCustomers / rowsPerPage);
  const startRecord = totalCustomers === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecord   = Math.min(currentPage * rowsPerPage, totalCustomers);
  const currentItems = customers; // server already returns current page

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchCustomers(newPage);
  };

  const handleRowsPerPageChange = (newSize) => {
    setRowsPerPage(newSize);
    setCurrentPage(1);
    fetchCustomers(1);
  };

  if (!canView) return (
    <div className="cust-container">
      <div className="alert alert-warning">You do not have permission to view customers.</div>
    </div>
  );

  // ── Detail page takes over ────────────────────────────────────────
  if (detailCustomer) {
    return (
      <div className="cust-container">
        {loading && <CrmPreloader text="Loading..."/>}
        <ToastContainer toasts={toasts} removeToast={removeToast}/>
        <CustomerDetailPage
          customer={detailCustomer}
          currentUser={currentUser}
          permissions={permissions}
          onBack={() => setDetailCustomer(null)}
          onEdit={c => { setDetailCustomer(null); handleEdit(c); }}
          showSuccess={showSuccess}
          showError={showError}
        />
        {isAddFormOpen && (
          <div className="cust-modal-overlay">
            <div className="cust-modal cust-modal-xlarge" onClick={e => e.stopPropagation()}>
              <div className="cust-modal-header">
                <h2>Edit Customer</h2>
                <button className="cust-modal-close" onClick={() => { setIsAddFormOpen(false); resetForm(); }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <CustomerFormBody formData={formData} setFormData={setFormData} phoneError={phoneError} handlePhoneChange={handlePhoneChange} groups={groups} subGroups={subGroups} users={users} loading={loading} onCancel={() => { setIsAddFormOpen(false); resetForm(); }} onSubmit={handleSubmit} INDIAN_STATES={INDIAN_STATES}/>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main list view ────────────────────────────────────────────────
  return (
    <div className="cust-container">
      {loading && <CrmPreloader text="Loading Customers..."/>}
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      <div className="cust-breadcrumb">
        <span>Dashboard</span>
        <span className="cust-breadcrumb-separator">&gt;</span>
        <span className="cust-breadcrumb-active">Customers</span>
      </div>

      <div className="cust-header page-header-with-filter">
        <GroupCategoryFilter groupValue={groupName} subGroupValue={subGroupName} onChange={updateFilters}/>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Action Bar */}
      <div className="cust-action-bar">
        <div className="cust-search-wrapper">
          <svg className="cust-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" placeholder="Search by name, company, phone, email, GST..." className="cust-search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
        </div>
        <div className="cust-filters">
          <select className="cust-filter-select" value={selectedGroup} onChange={e => { setSelectedGroup(e.target.value); setCurrentPage(1); }}>
            <option value="All">All Groups</option>
            <option value="CCMS">CCMS</option><option value="Solar">Solar</option>
            <option value="EPC">EPC</option><option value="IoT">IoT</option>
            <option value="Hybrid">Hybrid</option><option value="Others">Others</option>
          </select>
          <select className="cust-filter-select" value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option><option value="Inactive">Inactive</option>
            <option value="Prospect">Prospect</option><option value="Lead">Lead</option>
          </select>
        </div>
        <div className="cust-action-buttons">
          <button className="cust-btn cust-btn-secondary" onClick={exportToCSV}>
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export
          </button>
          <button className={`cust-btn cust-btn-primary ${!canCreate?'cust-btn-disabled':''}`}
            onClick={() => { if(canCreate){ resetForm(); setIsAddFormOpen(true); } else showError('No create permission'); }}
            disabled={!canCreate}
          >
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add New Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          {icon:'👥', bg:'#eff6ff', val:kpiData.totalCustomers,    label:'Total Customers'},
          {icon:'✨', bg:'#fef3c7', val:kpiData.newThisMonth,      label:'New This Month'},
          {icon:'📊', bg:'#dbeafe', val:kpiData.activeCustomers,   label:'Active Customers'},
          {icon:'📞', bg:'#fce7f3', val:kpiData.pendingFollowups,  label:'Follow-Ups Pending'},
        ].map(({icon,bg,val,label}) => (
          <div key={label} style={{ background:'#fff', padding:'1rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ width:'40px', height:'40px', background:bg, borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem' }}>{icon}</div>
            <div>
              <div style={{ fontSize:'1.5rem', fontWeight:'bold', lineHeight:'1.2' }}>{val}</div>
              <div style={{ color:'#666', fontSize:'0.75rem', marginTop:'0.125rem' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* View Toggle + Column Controls — all right-aligned */}
      <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'8px', marginBottom:'0.75rem' }}>
        {/* Columns button — only visible in table mode, sits left of Table/Grid */}
        {viewMode === 'table' && (
          <ColumnVisibilityDropdown columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns}/>
        )}
        {/* Table / Grid pill toggle */}
        <div style={{ display:'flex', gap:'2px', background:'#f3f4f6', borderRadius:'8px', padding:'3px' }}>
          <button
            onClick={() => setViewMode('table')}
            title="Table View"
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:500,
              background: viewMode==='table' ? '#fff' : 'transparent',
              color:       viewMode==='table' ? '#111827' : '#6b7280',
              boxShadow:   viewMode==='table' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
            }}
          >
            <svg style={{width:15,height:15,flexShrink:0}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Table
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid View"
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:500,
              background: viewMode==='grid' ? '#fff' : 'transparent',
              color:       viewMode==='grid' ? '#111827' : '#6b7280',
              boxShadow:   viewMode==='grid' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
            }}
          >
            <svg style={{width:15,height:15,flexShrink:0}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            Grid
          </button>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="cust-table-card">
          <div className="cust-table-wrapper">
            <table className="cust-table">
              <thead>
                <tr>
                  {orderedVisibleColumns.map((col, idx) => (
                    <DraggableHeaderCell key={col.key} col={col} index={idx} sortColumn={sortColumn} sortDirection={sortDirection} getSortIcon={getSortIcon} handleSort={handleSort}
                      onDragStart={handleColDragStart} onDragOver={handleColDragOver} onDrop={handleColDrop} onDragEnd={handleColDragEnd} isDragOver={dragOverIndex===idx}/>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr><td colSpan={orderedVisibleColumns.length} style={{textAlign:'center',padding:'30px',color:'#718096'}}>{loading ? 'Loading...' : 'No customers found'}</td></tr>
                ) : currentItems.map(customer => (
                  <tr key={customer.id} onClick={() => canView && handleViewCustomer(customer)} style={{cursor: canView ? 'pointer' : 'default'}} className="cust-clickable-row">
                    {orderedVisibleColumns.map(col => (
                      <td key={col.key} style={{textAlign:'center'}} onClick={col.key==='actions' ? e => e.stopPropagation() : undefined}>
                        {renderCell(customer, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CustPagination
            startRecord={startRecord} endRecord={endRecord} totalRecords={totalCustomers}
            currentPage={currentPage} totalPages={totalPages} rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange} onRowsPerPageChange={handleRowsPerPageChange}
          />
        </div>
      ) : (
        /* GRID VIEW */
        <div className="cust-grid-container">
          <div className="cust-grid">
            {currentItems.map(customer => (
              <div key={customer.id} className="cust-card">
                <div className="cust-card-clickable" onClick={() => canView && handleViewCustomer(customer)} style={{cursor: canView ? 'pointer' : 'default'}}>
                  <div className="cust-card-header">
                    <div className="cust-card-id">{customer.customerCode}</div>
                    <div className="cust-card-badges">
                      {customer.groupName && <span className={`cust-badge badge-${getGroupColor(customer.groupName)}`}>{customer.groupName}</span>}
                      <span className={`cust-badge badge-${getStatusColor(customer.status)}`}>{customer.status}</span>
                    </div>
                  </div>
                  <div className="cust-card-body">
                    <h3 className="cust-card-title">{customer.name}</h3>
                    {customer.companyName && <div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>{customer.companyName}</div>}
                    <div className="cust-card-info">
                      {customer.email && <div className="cust-card-info-item">
                        <svg className="cust-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        <span>{customer.email}</span>
                      </div>}
                      {customer.phone && <div className="cust-card-info-item">
                        <svg className="cust-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        <span>{customer.phone}</span>
                      </div>}
                      {customer.city && <div className="cust-card-info-item">
                        <svg className="cust-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <span>{customer.city}{customer.state ? `, ${customer.state}` : ''}</span>
                      </div>}
                    </div>
                  </div>
                </div>
                <div className="cust-card-footer" onClick={e => e.stopPropagation()}>
                  <div className="cust-card-source" style={{fontSize:12,color:'#9ca3af'}}>
                    {customer.gstNumber ? `GST: ${customer.gstNumber}` : 'No GST'}
                  </div>
                  <div className="cust-card-actions">
                    {canView && <button className="cust-card-action-btn cust-action-view" onClick={() => handleViewCustomer(customer)} title="View Customer"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>}
                    {canEdit && <button className="cust-card-action-btn cust-action-edit" onClick={() => handleEdit(customer)} title="Edit Customer"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>}
                    {/* canCreate && <button className="cust-card-action-btn" onClick={e => openQuickOb(e, customer)} title="Create Order Book" style={{color:'#8b5cf6'}}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button> */}
                    {canDelete && <button className="cust-card-action-btn cust-action-delete" onClick={() => handleDeleteClick(customer.id, customer.name)} title="Delete Customer"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <CustPagination
            startRecord={startRecord} endRecord={endRecord} totalRecords={totalCustomers}
            currentPage={currentPage} totalPages={totalPages} rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange} onRowsPerPageChange={handleRowsPerPageChange}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="cust-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="customer-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="customer-delete-modal-icon">
              <div className="customer-delete-icon-circle"><span>!</span></div>
            </div>
            <h2 className="customer-delete-modal-title">Delete Customer</h2>
            <p className="customer-delete-modal-text">Are you sure you want to delete "{deleteCustomerName}"?<br/>This action cannot be undone.</p>
            <div className="customer-delete-modal-actions">
              <button className="cust-btn cust-btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="cust-btn customer-delete-btn" onClick={handleDelete}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Create Order Book Modal ──────────────────────────── */}
      {quickObCustomer && (
        <div className="cust-modal-overlay" onClick={closeQuickOb}>
          <div className="cust-modal" style={{maxWidth:520}} onClick={e => e.stopPropagation()}>
            <div className="cust-modal-header">
              <div>
                <h2 style={{margin:0}}>New Order Book</h2>
                <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>for {quickObCustomer.name}</div>
              </div>
              <button className="cust-modal-close" onClick={closeQuickOb}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="cust-modal-body" style={{padding:'1.25rem 1.5rem',display:'grid',gap:'0.875rem'}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Order Title <span style={{color:'red'}}>*</span></label>
                <input className="cust-form-input" placeholder="e.g. Solar Panel Supply — Phase 1" value={quickObForm.title} onChange={e => setQuickObForm(f=>({...f,title:e.target.value}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>PO Number</label>
                  <input className="cust-form-input" placeholder="PO-2024-001" value={quickObForm.poNumber} onChange={e => setQuickObForm(f=>({...f,poNumber:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Status</label>
                  <select className="cust-form-input" value={quickObForm.status} onChange={e => setQuickObForm(f=>({...f,status:e.target.value}))}>
                    <option>Draft</option><option>Confirmed</option><option>In Production</option>
                    <option>Ready for Dispatch</option><option>Dispatched</option><option>Completed</option><option>Cancelled</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>PO Date</label>
                  <input type="date" className="cust-form-input" value={quickObForm.poDate} onChange={e => setQuickObForm(f=>({...f,poDate:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Delivery Date</label>
                  <input type="date" className="cust-form-input" value={quickObForm.deliveryDate} onChange={e => setQuickObForm(f=>({...f,deliveryDate:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Total Value (₹)</label>
                <input type="number" className="cust-form-input" placeholder="0.00" value={quickObForm.totalValue} onChange={e => setQuickObForm(f=>({...f,totalValue:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>Notes</label>
                <textarea className="cust-form-input" rows={2} placeholder="Any additional notes..." value={quickObForm.notes} onChange={e => setQuickObForm(f=>({...f,notes:e.target.value}))} style={{resize:'vertical'}}/>
              </div>
            </div>
            <div style={{padding:'1rem 1.5rem',borderTop:'1px solid #e5e7eb',display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
              <button className="cust-btn cust-btn-secondary" onClick={closeQuickOb}>Cancel</button>
              <button className="cust-btn cust-btn-primary" onClick={submitQuickOb} disabled={quickObLoading}>
                {quickObLoading ? 'Creating...' : (
                  <><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:14,height:14,marginRight:4,verticalAlign:'middle'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>Create Order Book</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {isAddFormOpen && (
        <div className="cust-modal-overlay">
          <div className="cust-modal cust-modal-xlarge" onClick={e => e.stopPropagation()}>
            <div className="cust-modal-header">
              <h2>{formData.id ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="cust-modal-close" onClick={() => { setIsAddFormOpen(false); resetForm(); }}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <CustomerFormBody formData={formData} setFormData={setFormData} phoneError={phoneError} handlePhoneChange={handlePhoneChange} groups={groups} subGroups={subGroups} users={users} loading={loading} onCancel={() => { setIsAddFormOpen(false); resetForm(); }} onSubmit={handleSubmit} INDIAN_STATES={INDIAN_STATES}/>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Customer Form Body (reusable) ─────────────────────────────────────────────
const CustomerFormBody = ({ formData, setFormData, phoneError, handlePhoneChange, groups, subGroups, users, loading, onCancel, onSubmit, INDIAN_STATES }) => (
  <form onSubmit={onSubmit} className="cust-form">
    <div className="cust-form-section">
      <h3 className="cust-form-section-title">Customer Information</h3>
      <div className="cust-form-grid">
        <div className="cust-form-group">
          <label>Customer Name *</label>
          <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/>
        </div>
        <div className="cust-form-group">
          <label>Company Name</label>
          <input type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})}/>
        </div>
        <div className="cust-form-group">
          <label>Email *</label>
          <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} placeholder="email@example.com"/>
        </div>
        <div className="cust-form-group">
          <label>Phone *</label>
          <input type="tel" required value={formData.phone} onChange={e => handlePhoneChange(e.target.value, 'phone')} placeholder="10 digit mobile number" maxLength="10"/>
          {phoneError && <small style={{color:'#dc2626'}}>{phoneError}</small>}
        </div>
        <div className="cust-form-group">
          <label>Group</label>
          <select value={formData.groupName} onChange={e => setFormData({...formData, groupName: e.target.value, subGroupName:''})}>
            <option value="">Select Group</option>
            {groups.map((g,i) => <option key={g.value||i} value={g.value||g.label}>{g.label||g.value}</option>)}
          </select>
        </div>
        <div className="cust-form-group">
          <label>Category / Sub-Group</label>
          <select value={formData.subGroupName} onChange={e => setFormData({...formData, subGroupName: e.target.value})} disabled={!formData.groupName}>
            <option value="">Select Category</option>
            {subGroups.map((s,i) => <option key={s.value||i} value={s.value||s.label}>{s.label||s.value}</option>)}
          </select>
        </div>
        <div className="cust-form-group">
          <label>Status</label>
          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
            <option>Active</option><option>Inactive</option><option>Prospect</option><option>Lead</option>
          </select>
        </div>
        <div className="cust-form-group">
          <label>Contact Person</label>
          <input type="text" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})}/>
        </div>
        <div className="cust-form-group">
          <label>Designation</label>
          <input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})}/>
        </div>
        <div className="cust-form-group">
          <label>Alternate Phone</label>
          <input type="tel" value={formData.altPhone} onChange={e => handlePhoneChange(e.target.value, 'altPhone')} placeholder="10 digit" maxLength="10"/>
        </div>
        <div className="cust-form-group">
          <label>Website</label>
          <input type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://example.com"/>
        </div>
        <div className="cust-form-group">
          <label>GST Number</label>
          <input type="text" value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value.toUpperCase()})} placeholder="22AAAAA0000A1Z5"/>
        </div>
        <div className="cust-form-group">
          <label>PAN Number</label>
          <input type="text" value={formData.pan} onChange={e => { const c=e.target.value.replace(/[^A-Za-z0-9]/g,''); if(c.length<=10) setFormData({...formData, pan:c.toUpperCase()}); }} placeholder="ABCDE1234F" maxLength="10"/>
        </div>
        <div className="cust-form-group">
          <label>City</label>
          <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}/>
        </div>
        <div className="cust-form-group">
          <label>State</label>
          <select value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})}>
            <option value="">Select State</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="cust-form-group">
          <label>Pincode</label>
          <input type="text" value={formData.pincode} onChange={e => { const c=e.target.value.replace(/\D/g,''); if(c.length<=6) setFormData({...formData, pincode:c}); }} maxLength="6" placeholder="6 digit pincode"/>
        </div>
        <div className="cust-form-group">
          <label>Assign To</label>
          <select value={formData.assignedTo||''} onChange={e => setFormData({...formData, assignedTo: e.target.value ? Number(e.target.value) : null})}>
            <option value="">Select Member</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="cust-form-group">
        <label>Address</label>
        <textarea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Enter full address..."/>
      </div>
    </div>
    <div className="cust-form-actions">
      <button type="button" className="cust-btn cust-btn-secondary" onClick={onCancel}>Cancel</button>
      <button type="submit" className="cust-btn cust-btn-primary" disabled={loading}>
        {loading ? 'Saving...' : (formData.id ? 'Update Customer' : 'Save Customer')}
      </button>
    </div>
  </form>
);

// ─── Customer Pagination Widget ──────────────────────────────────────────────
const CustPagination = ({ startRecord, endRecord, totalRecords, currentPage, totalPages, rowsPerPage, onPageChange, onRowsPerPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left  = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="leads-enquiries-pagination">
      <div className="leads-enquiries-pagination-info">
        {totalRecords === 0
          ? 'No records found'
          : `Showing ${startRecord}–${endRecord} of ${totalRecords} customers`}
      </div>
      <div className="leads-enquiries-pagination-controls">
        <select className="leads-enquiries-rows-select" value={rowsPerPage} onChange={e => onRowsPerPageChange(Number(e.target.value))}>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <div className="leads-enquiries-pagination-buttons">
          <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1} title="First page">«</button>
          <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
          {currentPage > 3 && totalPages > 5 && <span className="leads-enquiries-pagination-ellipsis">…</span>}
          {getPageNumbers().map(p => (
            <button key={p} className={`leads-enquiries-pagination-btn${p === currentPage ? ' leads-enquiries-pagination-btn-active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
          ))}
          {currentPage < totalPages - 2 && totalPages > 5 && <span className="leads-enquiries-pagination-ellipsis">…</span>}
          <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}>Next</button>
          <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0} title="Last page">»</button>
        </div>
        <span className="leads-enquiries-pagination-current">Page {currentPage} of {totalPages || 1}</span>
      </div>
    </div>
  );
};

export default CustomerDatabase;