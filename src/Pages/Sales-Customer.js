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
import { FaEye, FaEdit, FaTrash, FaUpload, FaCloudUploadAlt, FaColumns } from 'react-icons/fa';
import { RiDeleteBin6Line } from "react-icons/ri";
import * as XLSX from 'xlsx';
import api from '../services/leadsapi.js';

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
// eslint-disable-next-line no-unused-vars
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
        <div className="orderbook-modal-overlay">
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

// ── Follow-up helpers ─────────────────────────────────────────────────────────
const _pad = n => String(n).padStart(2, '0');
const _fmt = s => {
  if (!s) return '—';
  const d = new Date(s);
  return `${_pad(d.getDate())}-${_pad(d.getMonth()+1)}-${d.getFullYear()} ${_pad(d.getHours())}:${_pad(d.getMinutes())}`;
};
const _fmtDate = s => {
  if (!s) return '—';
  const d = new Date(s);
  return `${_pad(d.getDate())} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;
};
const _fmtTime = s => {
  if (!s) return '';
  const d = new Date(s);
  return `${_pad(d.getHours())}:${_pad(d.getMinutes())}`;
};
const _isOverdue = f => f.status === 'Pending' && f.scheduledAt && new Date(f.scheduledAt) < new Date();

const FU_TYPE_META = {
  Call:    { icon: '📞', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Email:   { icon: '✉️',  color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  Meeting: { icon: '🤝', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  Visit:   { icon: '🏠', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  Demo:    { icon: '💻', color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3' },
};
const FU_STATUS_META = {
  Pending:     { bg: '#FEF9C3', color: '#92400E', dot: '#F59E0B' },
  Completed:   { bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  Cancelled:   { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
  Rescheduled: { bg: '#E0E7FF', color: '#3730A3', dot: '#6366F1' },
};
const FU_PRIORITY_COLOR = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981' };

// ── CustomerFollowupCard ──────────────────────────────────────────────────────
function CustomerFollowupCard({ followup: f, index, onComplete, onCancelled, onDeleted, onView, onEdit, showToast, permissions }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tm = FU_TYPE_META[f.followupType] || FU_TYPE_META.Call;
  const sm = FU_STATUS_META[f.status]    || FU_STATUS_META.Pending;
  const overdue = _isOverdue(f);
  const isPending = f.status === 'Pending';
  const isCancelled = f.status === 'Cancelled';

  const cancelFollowup = async () => {
    if (!window.confirm('Cancel this follow-up?')) return;
    setBusy(true);
    try {
      await api.put(`/followups/update/${f.id}`, { status: 'Cancelled', outcome: 'Cancelled by user' });
      onCancelled();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const deleteFollowup = async () => {
    if (!window.confirm('Permanently delete this follow-up? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.delete(`/followups/delete/${f.id}`);
      onDeleted();
    } catch (e) { showToast(e.message || 'Failed to delete', 'error'); }
    finally { setBusy(false); }
  };

  const cardBorderColor = overdue ? '#EF4444' : isCancelled ? '#d1d5db' : f.status === 'Completed' ? '#10B981' : tm.color;
  const cardOpacity = (isCancelled || f.status === 'Completed') ? 0.75 : 1;

  return (
    <div style={{
      borderLeft: `4px solid ${cardBorderColor}`,
      background: '#fff',
      borderRadius: 10,
      marginBottom: 8,
      padding: '10px 12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      opacity: cardOpacity,
      transition: 'opacity 0.2s',
    }}>
      {/* Row 1: chips + date + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {tm.icon} {f.followupType}
        </span>
        <span style={{ background: sm.bg, color: sm.color, borderRadius: 20, padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot, display: 'inline-block' }}/>{f.status}
        </span>
        {overdue && <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>⚠ Overdue</span>}
        <span style={{ fontSize: 11, fontWeight: 600, color: FU_PRIORITY_COLOR[f.priority] || '#F59E0B' }}>● {f.priority}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>{_fmtDate(f.scheduledAt)} {_fmtTime(f.scheduledAt)}</span>

        {/* Action buttons — always visible, small */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          {/* View */}
          <button onClick={() => onView(f)} title="View details"
            style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #0891b2', background: '#f0f9ff', color: '#0891b2', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
            👁
          </button>
          {/* Edit — only for non-completed/non-cancelled */}
          {!isCancelled && f.status !== 'Completed' && (
            <button onClick={() => onEdit(f)} title="Edit"
              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #6366f1', background: '#f5f3ff', color: '#6366f1', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
              ✏
            </button>
          )}
          {/* Cancel — pending only */}
          {isPending && (
            <button onClick={cancelFollowup} disabled={busy} title="Cancel"
              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
              {busy ? '…' : '✕'}
            </button>
          )}
          {/* Delete — always available */}
          <button onClick={deleteFollowup} disabled={busy} title="Delete permanently"
            style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid #ef4444', background: '#fff1f2', color: '#dc2626', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
            {busy ? '…' : '🗑'}
          </button>
        </div>
      </div>

      {/* Row 2: people + created */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: '#6b7280', marginTop: 5 }}>
        {f.assignedToName && <span>👤 {f.assignedToName}</span>}
        <span>By {f.createdByName || '—'} · {_fmtDate(f.createdAt)}</span>
        {f.completedAt && <span style={{ color: '#059669' }}>✓ {_fmt(f.completedAt)}</span>}
      </div>

      {/* Notes */}
      {f.notes && (
        <div style={{ background: '#f0f9ff', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 12 }}>
          <span style={{ fontSize: 10, color: '#0369a1', fontWeight: 700, marginRight: 4 }}>📋 Notes:</span>
          <span style={{ color: '#374151' }}>{f.notes}</span>
        </div>
      )}

      {/* Outcome */}
      {f.outcome && (
        <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 12 }}>
          <span style={{ fontSize: 10, color: '#15803d', fontWeight: 700, marginRight: 4 }}>📊 Outcome:</span>
          <span style={{ color: '#374151' }}>
            {expanded || f.outcome.length < 150 ? f.outcome : <>{f.outcome.slice(0, 150)}…</>}
          </span>
          {f.outcome.length > 150 && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: '#059669', fontSize: 11, cursor: 'pointer', padding: '0 4px' }}>
              {expanded ? '▲ less' : '▼ more'}
            </button>
          )}
        </div>
      )}

      {/* Record Outcome button for pending */}
      {isPending && (
        <div style={{ marginTop: 8 }}>
          <button onClick={onComplete}
            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            ✓ Record Outcome
          </button>
        </div>
      )}
    </div>
  );
}

// ── CustomerAddFollowupForm ───────────────────────────────────────────────────
function CustomerAddFollowupForm({ customer, currentUser, users, onCreated, onCancel }) {
  const [saving, setSaving] = useState(false);
  const nowPlus30 = new Date(Date.now() + 30 * 60000);
  const defaultDT = new Date(nowPlus30.getTime() - nowPlus30.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [form, setForm] = useState({ followupType: 'Call', scheduledAt: defaultDT, priority: 'Medium', notes: '', assignedTo: currentUser?.id || '' });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const dt = form.scheduledAt.replace('T', ' ') + ':00';
      await api.post('/followups/create', {
        relatedType: 'CUSTOMER',
        relatedId:   customer.id,
        customerId:  customer.id,
        followupType: form.followupType,
        scheduledAt:  dt,
        priority:     form.priority,
        notes:        form.notes.trim() || null,
        status:       'Pending',
        assignedTo:   form.assignedTo ? parseInt(form.assignedTo) : null,
      });
      onCreated();
    } catch (e) { if (e.message !== 'SESSION_EXPIRED') alert(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#065F46' }}>📅 Schedule New Follow-up</h5>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>✕</button>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(FU_TYPE_META).map(([type, meta]) => (
              <button key={type} type="button"
                onClick={() => setForm(p => ({ ...p, followupType: type }))}
                style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${form.followupType === type ? meta.color : '#d1d5db'}`,
                  background: form.followupType === type ? meta.bg : '#fff', color: form.followupType === type ? meta.color : '#374151',
                  fontSize: 12, cursor: 'pointer', fontWeight: form.followupType === type ? 700 : 400 }}>
                {meta.icon} {type}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Date & Time *</label>
            <input type="datetime-local" required value={form.scheduledAt} onChange={set('scheduledAt')}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
          </div>
          <div style={{ width: 130 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Priority</label>
            <select value={form.priority} onChange={set('priority')}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Assign To *</label>
          <select value={form.assignedTo} onChange={set('assignedTo')} required
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === currentUser?.id ? ' (Me)' : ''}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</label>
          <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="What to cover in this follow-up…"
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel}
            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving}
            style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Scheduling…' : '📅 Schedule Follow-up'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── CustomerCompleteModal ─────────────────────────────────────────────────────
function CustomerCompleteModal({ followup: f, onSaved, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [newStatus, setNewStatus] = useState('Completed');
  const tm = FU_TYPE_META[f.followupType] || FU_TYPE_META.Call;

  const submit = async e => {
    e.preventDefault();
    if (!outcome.trim()) { alert('Please describe what happened'); return; }
    setSaving(true);
    try {
      await api.put(`/followups/update/${f.id}`, { status: newStatus, outcome: outcome.trim() });
      onSaved();
    } catch (e) { if (e.message !== 'SESSION_EXPIRED') alert(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '90%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <span style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>{tm.icon} {f.followupType}</span>
            <h4 style={{ margin: '8px 0 2px', fontSize: 16, fontWeight: 700 }}>Record Outcome</h4>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Scheduled: {_fmt(f.scheduledAt)}</p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>
        {f.notes && (
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>📋 Original notes</div>
            <p style={{ margin: 0 }}>{f.notes}</p>
          </div>
        )}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>📊 Outcome *</label>
            <textarea rows={5} required value={outcome} onChange={e => setOutcome(e.target.value)}
              placeholder="Describe what happened, what was discussed, next steps…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}/>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{outcome.length} chars</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Mark as</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ v: 'Completed', icon: '✓', label: 'Completed' }, { v: 'Rescheduled', icon: '↻', label: 'Rescheduled' }, { v: 'Cancelled', icon: '✕', label: 'Cancelled' }].map(opt => {
                const sm = FU_STATUS_META[opt.v];
                const active = newStatus === opt.v;
                return (
                  <label key={opt.v} onClick={() => setNewStatus(opt.v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${active ? sm.color : '#d1d5db'}`, background: active ? sm.bg : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400, color: active ? sm.color : '#374151' }}>
                    <input type="radio" name="ns" value={opt.v} checked={active} onChange={() => setNewStatus(opt.v)} style={{ display: 'none' }}/>{opt.icon} {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onCancel} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '7px 18px', border: 'none', borderRadius: 6, background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save Outcome'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CustomerViewModal ─────────────────────────────────────────────────────────
function CustomerViewModal({ followup: f, onClose, onEdit, onComplete }) {
  const tm = FU_TYPE_META[f.followupType] || FU_TYPE_META.Call;
  const sm = FU_STATUS_META[f.status]    || FU_STATUS_META.Pending;
  const overdue = _isOverdue(f);
  const P = { High: { bg:'#FEE2E2',color:'#991B1B' }, Medium: { bg:'#FEF3C7',color:'#92400E' }, Low: { bg:'#D1FAE5',color:'#065F46' } };
  const pm = P[f.priority] || P.Medium;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, width:'min(540px,95vw)', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ background: tm.bg, padding:'16px 20px', borderRadius:'14px 14px 0 0', borderBottom:`2px solid ${tm.color}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, border:`1.5px solid ${tm.color}30` }}>{tm.icon}</div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>{f.followupType} Follow-up</span>
                <span style={{ background:sm.bg, color:sm.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:sm.dot, display:'inline-block' }}/>{f.status}
                </span>
                {overdue && <span style={{ background:'#FEE2E2', color:'#991B1B', borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>⚠ OVERDUE</span>}
              </div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>#{f.id}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6b7280', lineHeight:1 }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Priority</div>
              <span style={{ background:pm.bg, color:pm.color, borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>{f.priority}</span>
            </div>
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>📅 Scheduled</div>
              <div style={{ fontWeight:700, fontSize:13, color: overdue ? '#DC2626' : '#0f172a' }}>{_fmtDate(f.scheduledAt)} {_fmtTime(f.scheduledAt)}</div>
              {f.completedAt && <div style={{ fontSize:11, color:'#059669', marginTop:2 }}>✓ {_fmt(f.completedAt)}</div>}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Assigned To</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{f.assignedToName || 'Unassigned'}</div>
            </div>
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Created By</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{f.createdByName || '—'}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{_fmtDate(f.createdAt)}</div>
            </div>
          </div>
          {f.notes && (
            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0369a1', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>📋 Pre-call Notes</div>
              <p style={{ margin:0, fontSize:13, color:'#0f172a', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{f.notes}</p>
            </div>
          )}
          {f.outcome && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#15803d', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>📊 Outcome / Result</div>
              <p style={{ margin:0, fontSize:13, color:'#0f172a', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{f.outcome}</p>
            </div>
          )}
          {!f.notes && !f.outcome && <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, padding:'8px 0' }}>No notes or outcome recorded yet.</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:6, borderTop:'1px solid #f1f5f9' }}>
            <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #e2e8f0', borderRadius:7, background:'#fff', fontSize:13, cursor:'pointer' }}>Close</button>
            {f.status === 'Pending' && <button onClick={() => onComplete(f)} style={{ padding:'6px 14px', border:'none', borderRadius:7, background:'#059669', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>✓ Record Outcome</button>}
            {f.status !== 'Cancelled' && f.status !== 'Completed' && <button onClick={() => onEdit(f)} style={{ padding:'6px 14px', border:'none', borderRadius:7, background:'#6366f1', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>✏ Edit</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CustomerEditModal ─────────────────────────────────────────────────────────
function CustomerEditModal({ followup: f, users, currentUser, onSaved, onCancel }) {
  const [saving, setSaving] = useState(false);
  const parseScheduled = s => {
    if (!s) return '';
    const m = String(s).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    return m ? `${m[1]}T${m[2]}` : '';
  };
  const [form, setForm] = useState({
    followupType: f.followupType || 'Call',
    scheduledAt: parseScheduled(f.scheduledAt),
    priority: f.priority || 'Medium',
    assignedTo: f.assignedTo || currentUser?.id || '',
    notes: f.notes || '',
    status: f.status || 'Pending',
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const dt = form.scheduledAt.replace('T', ' ') + ':00';
      await api.put(`/followups/update/${f.id}`, {
        followupType: form.followupType,
        scheduledAt: dt,
        priority: form.priority,
        assignedTo: form.assignedTo ? parseInt(form.assignedTo) : null,
        notes: form.notes.trim() || null,
        status: form.status,
      });
      onSaved();
    } catch (e) { if (e.message !== 'SESSION_EXPIRED') alert(e.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onCancel} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:14, width:'min(500px,95vw)', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h4 style={{ margin:0, fontSize:16, fontWeight:700 }}>✏ Edit Follow-up</h4>
          <button onClick={onCancel} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6b7280' }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {Object.entries(FU_TYPE_META).map(([type, meta]) => (
              <button key={type} type="button" onClick={() => setForm(p => ({ ...p, followupType: type }))}
                style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${form.followupType===type ? meta.color : '#d1d5db'}`, background: form.followupType===type ? meta.bg : '#fff', color: form.followupType===type ? meta.color : '#374151', fontSize:12, cursor:'pointer', fontWeight: form.followupType===type ? 700 : 400 }}>
                {meta.icon} {type}
              </button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Date & Time *</label>
              <input type="datetime-local" required value={form.scheduledAt} onChange={set('scheduledAt')} style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Priority</label>
              <select value={form.priority} onChange={set('priority')} style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Status</label>
              <select value={form.status} onChange={set('status')} style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}>
                <option>Pending</option><option>Completed</option><option>Cancelled</option><option>Rescheduled</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Assign To</label>
              <select value={form.assignedTo} onChange={set('assignedTo')} style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.id===currentUser?.id?' (Me)':''}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={set('notes')} style={{ width:'100%', padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, resize:'vertical', boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button type="button" onClick={onCancel} style={{ padding:'7px 16px', border:'1px solid #e2e8f0', borderRadius:7, background:'#fff', fontSize:13, cursor:'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding:'7px 18px', border:'none', borderRadius:7, background:'#6366f1', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customer Detail Page ──────────────────────────────────────────────────────
const CustomerDetailPage = ({ customer, currentUser, onBack, onEdit, permissions, showSuccess, showError }) => {
  const [activeTab, setActiveTab]       = useState('overview');
  const [orderBooks, setOrderBooks]     = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [followups, setFollowups]       = useState([]);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [showAddFollowup, setShowAddFollowup]   = useState(false);
  const [completingFollowup, setCompletingFollowup] = useState(null);
  const [viewingFollowup, setViewingFollowup]   = useState(null);
  const [editingFollowup, setEditingFollowup]   = useState(null);
  const [followupUsers, setFollowupUsers]     = useState([]);
  const [followupFilter, setFollowupFilter]   = useState('All');
  const [followupToast, setFollowupToast]     = useState(null);
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

  // ── Financial Overview State ───────────────────────────────────────────────
  const [overviewData, setOverviewData]       = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${customer.id}/overview`, {
        credentials: 'include',
        headers
      });
      const json = await res.json();
      if (!json.success) return;
      const { orders = [], invoices = [], receipts = [] } = json.data || {};

      const totalOrderValue    = orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
      const totalBalanceDue    = orders.reduce((s, o) => s + (parseFloat(o.balanceAmount) || 0), 0);
      const totalAdvancePaid   = orders.reduce((s, o) => s + (parseFloat(o.advanceAmount) || 0), 0);
      const totalInvoiced      = invoices.reduce((s, i) => s + (parseFloat(i.totalAmount || i.grandTotal) || 0), 0);
      const totalReceived      = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const paidInvoices       = invoices.filter(i => i.status === 'Paid' || i.paymentStatus === 'Paid').length;
      const pendingInvoices    = invoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled' && i.paymentStatus !== 'Paid').length;
      const completedOrders    = orders.filter(o => o.status === 'Completed').length;
      const activeOrders       = orders.filter(o => o.status !== 'Cancelled' && o.status !== 'Completed').length;

      setOverviewData({
        orders, invoices, receipts,
        stats: {
          totalOrderValue, totalBalanceDue, totalAdvancePaid,
          totalInvoiced, totalReceived,
          paidInvoices, pendingInvoices,
          completedOrders, activeOrders,
          totalOrders: orders.length,
          totalInvoicesCount: invoices.length,
          totalReceiptsCount: receipts.length,
        }
      });
    } catch (e) { console.error('Overview fetch failed', e); }
    finally { setLoadingOverview(false); }
  }, [customer.id]);

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

  const fuToast$ = (msg, type = 'success') => {
    setFollowupToast({ msg, type });
    setTimeout(() => setFollowupToast(null), 3500);
  };

  const fetchFollowups = useCallback(async () => {
    setLoadingFollowups(true);
    try {
      const res = await fetch(`${API_BASE_URL}/followups/entity/Customer/${customer.id}`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) setFollowups(data.data || []);
    } catch { }
    finally { setLoadingFollowups(false); }
  }, [customer.id]);

  const fetchFollowupUsers = useCallback(async () => {
    try {
      const data = await api.get('/filters/leads-users');
      setFollowupUsers(Array.isArray(data) ? data : []);
    } catch { }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview')  fetchOverview();
    if (activeTab === 'orderbooks') fetchOrderBooks();
    if (activeTab === 'followups')  { fetchFollowups(); fetchFollowupUsers(); }
  }, [activeTab]);

  const handleViewOrder = async (order) => {
    try {
      let items = orderItemsCache[order.id];
      if (!items) {
        const res = await fetch(`${API_BASE_URL}/order-book/${order.id}/items`, { credentials: 'include', headers });
        const data = await res.json();
        items = data.success ? (data.data || []) : [];
        setOrderItemsCache(prev => ({ ...prev, [order.id]: items }));
      }
      setSelectedOrder({ ...order, items });
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
          {/* Contact + Business info cards - always visible */}
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

          {/* ── Financial Overview Dashboard ── */}
          {loadingOverview ? (
            <div style={{textAlign:'center',padding:'2rem',color:'#6b7280'}}>Loading financial summary…</div>
          ) : overviewData ? (
            <div style={{marginTop:'1.25rem'}}>

              {/* KPI Row */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.75rem',marginBottom:'1.25rem'}}>
                {[
                  { label:'Total Order Value',  val:`₹${(overviewData.stats.totalOrderValue||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`, icon:'📦', color:'#eff6ff', accent:'#3b82f6' },
                  { label:'Total Invoiced',      val:`₹${(overviewData.stats.totalInvoiced||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`,   icon:'🧾', color:'#f0fdf4', accent:'#16a34a' },
                  { label:'Total Received',      val:`₹${(overviewData.stats.totalReceived||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`,    icon:'💰', color:'#fef3c7', accent:'#d97706' },
                  { label:'Balance Due',         val:`₹${(overviewData.stats.totalBalanceDue||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`,  icon:'⚠️', color:'#fef2f2', accent:'#dc2626' },
                  { label:'Active Orders',       val:overviewData.stats.activeOrders,    icon:'🔄', color:'#f5f3ff', accent:'#7c3aed' },
                  { label:'Pending Invoices',    val:overviewData.stats.pendingInvoices, icon:'📋', color:'#fff7ed', accent:'#ea580c' },
                ].map(({label,val,icon,color,accent}) => (
                  <div key={label} style={{background:'#fff',border:`1px solid ${accent}22`,borderLeft:`3px solid ${accent}`,borderRadius:'8px',padding:'0.875rem',display:'flex',flexDirection:'column',gap:'4px'}}>
                    <div style={{fontSize:'18px'}}>{icon}</div>
                    <div style={{fontSize:'1.15rem',fontWeight:'700',color:'#111827',lineHeight:1.2}}>{val}</div>
                    <div style={{fontSize:'11px',color:'#6b7280',fontWeight:'500'}}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Orders Summary */}
              {overviewData.orders.length > 0 && (
                <div className="orderbook-card" style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <h4 className="ld-card-title" style={{margin:0}}>📦 Order Books ({overviewData.orders.length})</h4>
                    <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={() => setActiveTab('orderbooks')}>View All →</button>
                  </div>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table" style={{fontSize:'12px'}}>
                      <thead>
                        <tr><th>#</th><th>Order</th><th>PO No</th><th>Date</th><th>Total</th><th>Advance</th><th>Balance</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {overviewData.orders.slice(0,5).map((o,i) => (
                          <tr key={o.id}>
                            <td>{i+1}</td>
                            <td><span style={{color:'#3b82f6',fontWeight:500}}>{o.orderBookNo}</span><br/><span style={{color:'#6b7280',fontSize:'11px'}}>{o.orderTitle}</span></td>
                            <td>{o.poNumber||'-'}</td>
                            <td>{o.orderDate ? new Date(o.orderDate).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{fontWeight:600}}>₹{parseFloat(o.totalAmount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td>₹{parseFloat(o.advanceAmount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td style={{color:'#dc2626',fontWeight:600}}>₹{parseFloat(o.balanceAmount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td><span className={`orderbook-status ${getStatusClass(o.status)}`} style={{fontSize:'10px'}}>{o.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {overviewData.orders.length > 5 && <div style={{textAlign:'center',fontSize:'12px',color:'#6b7280',marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid #f3f4f6'}}>+{overviewData.orders.length - 5} more orders</div>}
                </div>
              )}

              {/* Invoices Summary */}
              {overviewData.invoices.length > 0 && (
                <div className="orderbook-card" style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <h4 className="ld-card-title" style={{margin:0}}>🧾 Invoices ({overviewData.invoices.length})</h4>
                    <div style={{display:'flex',gap:'8px',fontSize:'12px'}}>
                      <span style={{background:'#d1fae5',color:'#065f46',padding:'2px 8px',borderRadius:'9999px'}}>{overviewData.stats.paidInvoices} Paid</span>
                      <span style={{background:'#fee2e2',color:'#991b1b',padding:'2px 8px',borderRadius:'9999px'}}>{overviewData.stats.pendingInvoices} Pending</span>
                    </div>
                  </div>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table" style={{fontSize:'12px'}}>
                      <thead>
                        <tr><th>#</th><th>Invoice No</th><th>Date</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {overviewData.invoices.slice(0,5).map((inv,i) => {
                          const total = parseFloat(inv.totalAmount||inv.grandTotal||0);
                          const paid  = parseFloat(inv.paidAmount||0);
                          const due   = total - paid;
                          const statusColor = inv.paymentStatus === 'Paid' || inv.status === 'Paid' ? '#065f46' : due > 0 ? '#991b1b' : '#374151';
                          const statusBg    = inv.paymentStatus === 'Paid' || inv.status === 'Paid' ? '#d1fae5' : due > 0 ? '#fee2e2' : '#f3f4f6';
                          const displayStatus = inv.paymentStatus || inv.status || '-';
                          return (
                            <tr key={inv.id}>
                              <td>{i+1}</td>
                              <td><span style={{color:'#3b82f6',fontWeight:500}}>{inv.invoiceNo||inv.id}</span></td>
                              <td>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-'}</td>
                              <td style={{fontWeight:600}}>₹{total.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                              <td style={{color:'#16a34a'}}>₹{paid.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                              <td style={{color: due > 0 ? '#dc2626' : '#16a34a',fontWeight:600}}>₹{due.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                              <td><span style={{background:statusBg,color:statusColor,padding:'2px 8px',borderRadius:'9999px',fontSize:'10px',fontWeight:600}}>{displayStatus}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {overviewData.invoices.length > 5 && <div style={{textAlign:'center',fontSize:'12px',color:'#6b7280',marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid #f3f4f6'}}>+{overviewData.invoices.length - 5} more invoices</div>}
                </div>
              )}

              {/* Receipts Summary */}
              {overviewData.receipts.length > 0 && (
                <div className="orderbook-card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <h4 className="ld-card-title" style={{margin:0}}>💰 Receipts / Payments Received ({overviewData.receipts.length})</h4>
                    <span style={{fontSize:'14px',fontWeight:'700',color:'#16a34a'}}>Total: ₹{(overviewData.stats.totalReceived||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                  </div>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table" style={{fontSize:'12px'}}>
                      <thead>
                        <tr><th>#</th><th>Receipt No</th><th>Date</th><th>Amount</th><th>Mode</th><th>Type</th><th>Reference</th></tr>
                      </thead>
                      <tbody>
                        {overviewData.receipts.slice(0,5).map((r,i) => (
                          <tr key={r.id}>
                            <td>{i+1}</td>
                            <td><span style={{color:'#3b82f6',fontWeight:500}}>{r.receiptNo||r.id}</span></td>
                            <td>{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{color:'#16a34a',fontWeight:700}}>₹{parseFloat(r.amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td>{r.paymentMode||r.method||'-'}</td>
                            <td>{r.receiptType||'-'}</td>
                            <td style={{color:'#6b7280'}}>{r.transactionReference||r.referenceNo||'-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {overviewData.receipts.length > 5 && <div style={{textAlign:'center',fontSize:'12px',color:'#6b7280',marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:'1px solid #f3f4f6'}}>+{overviewData.receipts.length - 5} more receipts</div>}
                </div>
              )}

              {/* Empty state */}
              {overviewData.orders.length === 0 && overviewData.invoices.length === 0 && overviewData.receipts.length === 0 && (
                <div className="ld-empty-state">
                  <div className="ld-empty-icon">📊</div>
                  <p>No financial activity recorded yet for this customer.</p>
                  <button className="ld-btn ld-btn-pri" onClick={() => { setActiveTab('orderbooks'); setShowOrderForm(true); }}>Create First Order Book</button>
                </div>
              )}
            </div>
          ) : null}
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
                <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
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
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FOLLOW-UPS ── */}
      {activeTab === 'followups' && (() => {
        const fuCounts = {
          All:       followups.length,
          Upcoming:  followups.filter(f => f.status === 'Pending' && !_isOverdue(f)).length,
          Overdue:   followups.filter(_isOverdue).length,
          Completed: followups.filter(f => f.status === 'Completed').length,
          Cancelled: followups.filter(f => f.status === 'Cancelled').length,
        };
        const fuFiltered = followups.filter(f => {
          if (followupFilter === 'Upcoming')  return f.status === 'Pending' && !_isOverdue(f);
          if (followupFilter === 'Overdue')   return _isOverdue(f);
          if (followupFilter === 'Completed') return f.status === 'Completed';
          if (followupFilter === 'Cancelled') return f.status === 'Cancelled';
          return true;
        });
        const fuSorted = [...fuFiltered].sort((a, b) => {
          const ao = _isOverdue(a), bo = _isOverdue(b);
          if (ao !== bo) return ao ? -1 : 1;
          return new Date(b.scheduledAt) - new Date(a.scheduledAt);
        });

        return (
          <div className="ld-tab-content">
            {/* Toast */}
            {followupToast && (
              <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, fontSize: 13, fontWeight: 600,
                background: followupToast.type === 'error' ? '#FEE2E2' : '#D1FAE5',
                color: followupToast.type === 'error' ? '#991B1B' : '#065F46' }}>
                {followupToast.msg}
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h4 className="ld-card-title" style={{ margin: 0 }}>Follow-up Log</h4>
                <span style={{ background: '#e5e7eb', color: '#374151', borderRadius: 20, padding: '1px 10px', fontSize: 12, fontWeight: 700 }}>{followups.length}</span>
                {fuCounts.Overdue > 0 && (
                  <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>⚠ {fuCounts.Overdue} overdue</span>
                )}
              </div>
              {permissions?.CREATE !== false && (
                <button onClick={() => { setShowAddFollowup(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                  </svg>
                  Schedule Follow-up
                </button>
              )}
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {['All','Upcoming','Overdue','Completed','Cancelled'].map(f => (
                <button key={f} onClick={() => setFollowupFilter(f)}
                  style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${followupFilter === f ? '#059669' : '#d1d5db'}`,
                    background: followupFilter === f ? '#ecfdf5' : '#fff', color: followupFilter === f ? '#065F46' : '#374151',
                    fontSize: 12, fontWeight: followupFilter === f ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f}
                  {fuCounts[f] > 0 && <span style={{ background: followupFilter === f ? '#059669' : '#e5e7eb', color: followupFilter === f ? '#fff' : '#374151', borderRadius: 20, padding: '0 6px', fontSize: 11 }}>{fuCounts[f]}</span>}
                </button>
              ))}
            </div>

            {/* Add form */}
            {showAddFollowup && (
              <CustomerAddFollowupForm
                customer={customer}
                currentUser={currentUser}
                users={followupUsers}
                onCreated={() => { setShowAddFollowup(false); fetchFollowups(); fuToast$('Follow-up scheduled!'); }}
                onCancel={() => setShowAddFollowup(false)}
              />
            )}

            {/* Complete modal */}
            {completingFollowup && (
              <CustomerCompleteModal
                followup={completingFollowup}
                onSaved={() => { setCompletingFollowup(null); fetchFollowups(); fuToast$('Outcome saved!'); }}
                onCancel={() => setCompletingFollowup(null)}
              />
            )}

            {/* View modal */}
            {viewingFollowup && (
              <CustomerViewModal
                followup={viewingFollowup}
                onClose={() => setViewingFollowup(null)}
                onEdit={fu => { setViewingFollowup(null); setEditingFollowup(fu); }}
                onComplete={fu => { setViewingFollowup(null); setCompletingFollowup(fu); }}
              />
            )}

            {/* Edit modal */}
            {editingFollowup && (
              <CustomerEditModal
                followup={editingFollowup}
                users={followupUsers}
                currentUser={currentUser}
                onSaved={() => { setEditingFollowup(null); fetchFollowups(); fuToast$('Updated!'); }}
                onCancel={() => setEditingFollowup(null)}
              />
            )}

            {/* List */}
            {loadingFollowups ? (
              <div className="ld-loading-row">Loading…</div>
            ) : fuSorted.length === 0 ? (
              <div className="ld-empty-state">
                <div className="ld-empty-icon">{followupFilter === 'Overdue' ? '✅' : '📞'}</div>
                <p>{followupFilter === 'Overdue' ? 'No overdue follow-ups — you\'re on track!' :
                    followupFilter === 'Completed' ? 'No completed follow-ups yet.' :
                    followupFilter === 'Cancelled' ? 'No cancelled follow-ups.' :
                    followupFilter === 'Upcoming'  ? 'No upcoming follow-ups scheduled.' :
                    'No follow-ups recorded yet.'}</p>
                {followupFilter === 'All' && permissions?.CREATE !== false && (
                  <button onClick={() => setShowAddFollowup(true)}
                    style={{ marginTop: 10, padding: '7px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Schedule First Follow-up
                  </button>
                )}
              </div>
            ) : (
              <div>
                {fuSorted.map((f, i) => (
                  <CustomerFollowupCard key={f.id} followup={f} index={i}
                    onComplete={() => setCompletingFollowup(f)}
                    onCancelled={() => { fetchFollowups(); fuToast$('Cancelled'); }}
                    onDeleted={() => { fetchFollowups(); fuToast$('Deleted'); }}
                    onView={fu => setViewingFollowup(fu)}
                    onEdit={fu => setEditingFollowup(fu)}
                    showToast={fuToast$}
                    permissions={permissions}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Delete Order Confirm */}
      {showDeleteOrderConfirm && (
        <div className="orderbook-modal-overlay">
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
        <div className="orderbook-modal-overlay">
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
  // const isFirstRender = useRef(true);
  const { user, pagePermissions, isAccountsExecutive } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // ── Permissions ──────────────────────────────────────────────────
  const customersPermissions = pagePermissions?.CUSTOMERS || [];
  // ACCOUNTS_EXECUTIVE gets VIEW + CREATE + EDIT but NOT DELETE
  const canView   = customersPermissions.includes('VIEW')   || isAccountsExecutive;
  const canCreate = customersPermissions.includes('CREATE') || isAccountsExecutive;
  const canEdit   = customersPermissions.includes('EDIT')   || isAccountsExecutive;
  const canDelete = customersPermissions.includes('DELETE') && !isAccountsExecutive;
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
      const page = (overridePage !== undefined ? overridePage : currentPage) - 1;
      const filterBody = {
        searchTerm:   searchTerm.trim() || null,
        groupName:    groupName         || (selectedGroup  !== 'All' ? selectedGroup  : null),
        subGroupName: subGroupName      || null,
        status:       selectedStatus !== 'All' ? selectedStatus : null,
        page,
        size: rowsPerPage,
      };
      const data = await fetchWithHeaders(
        `${API_BASE_URL}/customers/filter?page=${page}&size=${rowsPerPage}`,
        { method: 'POST', body: JSON.stringify(filterBody) }
      );
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
      const id   = String(currentUser.id   || '');
      const role = String(currentUser.role || '');
      const res = await fetch(`${API_BASE_URL}/filters/leads-users`, {
        credentials: 'include',
        headers: { 'User-Id': id, 'User-Role': role, 'X-User-Id': id, 'X-User-Role': role }
      });
      const data = await res.json(); if (Array.isArray(data)) setUsers(data);
    } catch { setUsers([]); }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/filters/leads-groups`, { credentials:'include', headers:{ 'User-Id': currentUser.id, 'User-Role': currentUser.role } });
      const data = await res.json(); if (Array.isArray(data)) setGroups(data);
    } catch { setGroups([]); }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) { setSubGroups([]); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, { credentials:'include', headers:{ 'User-Id': currentUser.id, 'User-Role': currentUser.role } });
      const data = await res.json(); if (Array.isArray(data)) setSubGroups(data);
    } catch { setSubGroups([]); }
  };

  // ── Effects ──────────────────────────────────────────────────────

// Debounce timer ref (same pattern as UsersPage)
const filterDebounceTimer = useRef(null);

// Effect 1 — search/filter changes → debounced fetch (fires on mount too, which is correct)
useEffect(() => {
  if (!canView) return;

  // Clear any existing timer
  if (filterDebounceTimer.current) clearTimeout(filterDebounceTimer.current);

  const hasFilters = searchTerm.trim() !== ''
    || selectedGroup !== 'All'
    || selectedStatus !== 'All'
    || groupName !== ''
    || subGroupName !== '';

  if (hasFilters) {
    // Debounce filter changes by 300ms (same as UsersPage uses 1000ms)
    filterDebounceTimer.current = setTimeout(() => {
      setCurrentPage(1);
      fetchCustomers(1);
    }, 300);
  } else {
    // No filters — fetch immediately (covers initial mount)
    fetchCustomers(1);
    fetchGroups();
  }

  return () => {
    if (filterDebounceTimer.current) clearTimeout(filterDebounceTimer.current);
  };
}, [canView, searchTerm, selectedGroup, selectedStatus, groupName, subGroupName]);
// eslint-disable-line react-hooks/exhaustive-deps

// Effect 2 — pagination changes → immediate fetch (skip is handled by Effect 1 covering page 1)
useEffect(() => {
  if (!canView) return;
  fetchCustomers();
}, [currentPage, rowsPerPage]);
// eslint-disable-line react-hooks/exhaustive-deps

// Effect 3 — subgroups for form dropdown
useEffect(() => {
  if (formData.groupName) fetchSubGroupsForForm(formData.groupName);
  else setSubGroups([]);
}, [formData.groupName]);
// eslint-disable-line react-hooks/exhaustive-deps

// Effect 4 — fetch groups once on mount for the Add/Edit form dropdown.
// Previously groups were only fetched when hasFilters===false in Effect 1,
// meaning any active page-level filter (group/subgroup from URL or context)
// would skip the fetch and leave the "Group" select empty in the modal.
useEffect(() => {
  if (!canView) return;
  fetchGroups();
}, [canView]);
// eslint-disable-line react-hooks/exhaustive-deps

// Effect 5 — fetch users for Assign To dropdown.
// Runs when user.id becomes available (auth resolves asynchronously).
// Re-runs on user.id change so we always have the correct scoped user list.
useEffect(() => {
  if (!canView || !user?.id) return;
  fetchUsers();
}, [canView, user?.id]);
// eslint-disable-line react-hooks/exhaustive-deps
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
    setPhoneError('');
    fetchUsers();   // always refresh users list when opening edit modal
    setIsAddFormOpen(true);
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
        <span>Sales</span>
        <span className="cust-breadcrumb-separator">&gt;</span>
        <span className="cust-breadcrumb-active">Clients</span>
      </div>

      <div className="cust-header page-header-with-filter">
        <h1 class="clients-title">Clients</h1>
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
            onClick={() => { if(canCreate){ resetForm(); fetchUsers(); setIsAddFormOpen(true); } else showError('No create permission'); }}
            disabled={!canCreate}
          >
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add New Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'0.5rem' }}>
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
        <div className="cust-modal-overlay">
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
        <div className="cust-modal-overlay">
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

          <select className="leads-enquiries-rows-select" value={rowsPerPage} onChange={e => onRowsPerPageChange(Number(e.target.value))}>
          <option value={10}>10 Rows</option>
          <option value={20}>20 Rows</option>
          <option value={50}>50 Rows</option>
          <option value={100}>100 Rows</option>
        </select>
      </div>
      <div className="leads-enquiries-pagination-controls">
        
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