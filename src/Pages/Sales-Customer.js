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
import { COMMON_UNITS } from '../components/Dropdowns/Unittypedropdown.js';
import { FaEye, FaEdit, FaTrash, FaUpload, FaCloudUploadAlt, FaColumns } from 'react-icons/fa';
import { RiDeleteBin6Line } from "react-icons/ri";
import * as XLSX from 'xlsx';
import api from '../services/leadsapi.js';
import FilterSelect from '../components/Dropdowns/FilterSelect.js';
import { LayoutDashboard, ClipboardList, Wallet, CalendarClock } from 'lucide-react';
import ClientFinancialsTab, { ClientFinancialsStrip } from '../components/customers/ClientFinancialsTab.js';

/* Detail-view tabs. Order matters — the chevron strip reads left to right, and
   Financials sits next to Order Books because that is where the money the tab
   totals up was agreed. Keep this list short: see the caveat on .custd-tabs. */
const CUSTOMER_DETAIL_TABS = [
  { k: 'overview',   l: 'Overview',    i: LayoutDashboard },
  { k: 'orderbooks', l: 'Order Books', i: ClipboardList },
  { k: 'financials', l: 'Financials',  i: Wallet },
  { k: 'followups',  l: 'Follow-ups',  i: CalendarClock },
];

/* ── Inline-style theme mappers (added for dark mode) ── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#f8fafb':'#0f1420','#f9fffe':'#161b27','#fffafa':'#2b1d20','#fafffe':'#161b27',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f1f1':'#232b3b','#f0f0f0':'#232b3b','#e9eef5':'#2b3445','#eef2f7':'#18202e',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#f0f9ff':'#15243d','#f0f4ff':'#1a2440','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a','#bae6fd':'#16344d','#e0f2fe':'#16344d','#e0e7ff':'#1e2547',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40','#bbf7d0':'#2a5a40','#86efac':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#fecdd3':'#3a1f26','#fff9f9':'#2b1d20','#fff5f5':'#2b1d20','#fff0f0':'#2b1d20','#fff1f2':'#2b1d20','#fff7ed':'#2c2113','#fff7e6':'#2c2113','#fffbeb':'#2a2710','#fffdf0':'#2a2710','#fffdf5':'#2a2710','#fef9c3':'#3a3016','#fef3c7':'#3a3016','#fde68a':'#5a4714','#fef08a':'#5a4714',
  '#f5f3ff':'#241b3d','#faf5ff':'#241b3d','#eef2ff':'#1e1f45','#ede9fe':'#2a2147','#ddd6fe':'#2e2147','#e9d5ff':'#2e2147','#ecfeff':'#103038','#fce7f3':'#3a1f30','#fdf2f8':'#3a1f30',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#0891b2':'#22d3ee',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258','#f59e0b':'#f5b945',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#0e7490':'#22d3ee','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0369a1':'#38bdf8',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3',
  '#9d174d':'#f0a0c0','#db2777':'#f06fad','#be185d':'#f06fad','#1b3a6b':'#7fb0f0','#1e3a5f':'#7fb0f0','#4d7ce0':'#9bbcf5',
};
const __sbg = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __SM[k]) ? __SM[k] : v; };
const __stc = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __TM[k]) ? __TM[k] : v; };
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};


const API_BASE_URL = process.env.REACT_APP_API_URL;

// Indian Rupee formatter for amount fields
const toINR = v => { const n = String(v).replace(/[^0-9]/g,''); if (!n) return ''; return parseInt(n,10).toLocaleString('en-IN'); };

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
  { key: 'sno',      label: 'S.No',     sortable: false, required: true  },
  { key: 'group',    label: 'Group',    sortable: true,  required: false },
  { key: 'company',  label: 'Company',  sortable: true,  required: false },
  { key: 'name',     label: 'Name',     sortable: true,  required: true  },
  { key: 'contact',  label: 'Contact',  sortable: false, required: false },
  { key: 'createdAt',label: 'Date',     sortable: true,  required: false },
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
    <div className="custd-overview-proposals custd-overview-proposals-empty">
      <div className="custd-ovp-icon">📦</div>
      <div className="custd-ovp-text">
        <span className="custd-ovp-label">Order Books</span>
        <span className="custd-ovp-sub">No orders created yet for this customer</span>
      </div>
      <button className="custd-btn custd-btn-sec custd-btn-sm" onClick={onGoToOrderBooks}>Create Order Book</button>
    </div>
  );

  return (
    <div className="custd-overview-proposals">
      <div className="custd-ovp-header">
        <h4 className="custd-card-title" style={{margin:0}}>Order Books Summary</h4>
        <button className="custd-btn custd-btn-sec custd-btn-sm" onClick={onGoToOrderBooks}>View All →</button>
      </div>
      <div className="custd-ovp-stats">
        <div className="custd-ovp-stat">
          <span className="custd-ovp-stat-val">{orders.length}</span>
          <span className="custd-ovp-stat-label">Total Orders</span>
        </div>
        <div className="custd-ovp-stat custd-ovp-stat-money">
          <span className="custd-ovp-stat-val">₹{totalAmount.toLocaleString('en-IN')}</span>
          <span className="custd-ovp-stat-label">Total Value</span>
        </div>
        <div className="custd-ovp-stat">
          <span className="custd-ovp-stat-val">{completed}</span>
          <span className="custd-ovp-stat-label">Completed</span>
        </div>
        <div className="custd-ovp-stat" style={{color: totalBalance > 0 ? __stc('#dc2626') : __stc('#059669')}}>
          <span className="custd-ovp-stat-val">₹{totalBalance.toLocaleString('en-IN')}</span>
          <span className="custd-ovp-stat-label">Balance Due</span>
        </div>
      </div>
      {latestOrder && (
        <div className="custd-ovp-latest">
          <span className="custd-ovp-latest-label">Latest:</span>
          <span className="custd-proposal-no" style={{fontSize:10}}>{latestOrder.orderBookNo}</span>
          <span className="custd-ovp-latest-title">{latestOrder.orderTitle}</span>
          <span className={`custd-proposal-status ${getStatusClass(latestOrder.status)}`} style={{fontSize:10, marginLeft:'auto'}}>{latestOrder.status}</span>
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
    // Approved + CRM-generated proposals only (backend rule). includeId pins the
    // one already on this order book so editing can't silently drop the link.
    const keep = existingOrder?.proposalId;
    const qs = keep ? `?includeId=${encodeURIComponent(keep)}` : '';
    fetch(`${apiBase}/proposals/by-customer/${customer.id}${qs}`, { credentials: 'include', headers })
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
            <FilterSelect value={formData.status} options={['Draft','Confirmed','In Production','Ready for Dispatch','Dispatched','Completed','Cancelled'].map(s=>({value:s,label:s}))} placeholder="Select Status" onChange={v=>setFormData({...formData,status:v})} />
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
            <input type="text" value={toINR(formData.advanceAmount)} onChange={e => setFormData({...formData, advanceAmount: e.target.value.replace(/[^0-9]/g,'')})} placeholder="e.g. 50,000"/>
          </div>
          <div className="orderbook-form-group">
            <label>Proposal (Optional)</label>
            <FilterSelect
              value={formData.proposalId}
              options={proposals.map(p => ({ value: p.id, label: `${p.proposalNo} - ${p.title}` }))}
              placeholder="Select Proposal"
              onChange={v => { setFormData({...formData, proposalId: v}); if (v) loadProposalItems(v); }}
            />
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
                          : <FilterSelect
                              value={item.unit}
                              onChange={v => updateItem(index, 'unit', v)}
                              options={[...COMMON_UNITS.map(u => ({ value: u, label: u })), { value: 'Custom', label: '✏️ Custom' }]}
                              placeholder="Unit"
                            />
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
      <div className="custd-pform-footer">
        <button className="custd-btn custd-btn-sec" onClick={onCancel}>Cancel</button>
        <button className="custd-btn custd-btn-pri" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : existingOrder ? 'Update Order Book' : 'Create Order Book'}</button>
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
      background: __sbg('#fff'),
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
        {overdue && <span style={{ background: __sbg('#FEE2E2'), color: __stc('#991B1B'), borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>⚠ Overdue</span>}
        <span style={{ fontSize: 11, fontWeight: 600, color: FU_PRIORITY_COLOR[f.priority] || __stc('#F59E0B') }}>● {f.priority}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: __stc('#6b7280') }}>{_fmtDate(f.scheduledAt)} {_fmtTime(f.scheduledAt)}</span>

        {/* Action buttons — always visible, small */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          {/* View */}
          <button onClick={() => onView(f)} title="View details"
            style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${__sbg('#0891b2')}`, background: __sbg('#f0f9ff'), color: __stc('#0891b2'), fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
            👁
          </button>
          {/* Edit — only for non-completed/non-cancelled */}
          {!isCancelled && f.status !== 'Completed' && (
            <button onClick={() => onEdit(f)} title="Edit"
              style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${__sbg('#6366f1')}`, background: __sbg('#f5f3ff'), color: __stc('#6366f1'), fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
              ✏
            </button>
          )}
          {/* Cancel — pending only */}
          {isPending && (
            <button onClick={cancelFollowup} disabled={busy} title="Cancel"
              style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${__sbg('#f59e0b')}`, background: __sbg('#fffbeb'), color: __stc('#92400e'), fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
              {busy ? '…' : '✕'}
            </button>
          )}
          {/* Delete — always available */}
          <button onClick={deleteFollowup} disabled={busy} title="Delete permanently"
            style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${__sbg('#ef4444')}`, background: __sbg('#fff1f2'), color: __stc('#dc2626'), fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>
            {busy ? '…' : '🗑'}
          </button>
        </div>
      </div>

      {/* Row 2: people + created */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: __stc('#6b7280'), marginTop: 5 }}>
        {f.assignedToName && <span>👤 {f.assignedToName}</span>}
        <span>By {f.createdByName || '—'} · {_fmtDate(f.createdAt)}</span>
        {f.completedAt && <span style={{ color: __stc('#059669') }}>✓ {_fmt(f.completedAt)}</span>}
      </div>

      {/* Notes */}
      {f.notes && (
        <div style={{ background: __sbg('#f0f9ff'), borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 12 }}>
          <span style={{ fontSize: 10, color: __stc('#0369a1'), fontWeight: 700, marginRight: 4 }}>📋 Notes:</span>
          <span style={{ color: __stc('#374151') }}>{f.notes}</span>
        </div>
      )}

      {/* Outcome */}
      {f.outcome && (
        <div style={{ background: __sbg('#f0fdf4'), borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 12 }}>
          <span style={{ fontSize: 10, color: __stc('#15803d'), fontWeight: 700, marginRight: 4 }}>📊 Outcome:</span>
          <span style={{ color: __stc('#374151') }}>
            {expanded || f.outcome.length < 150 ? f.outcome : <>{f.outcome.slice(0, 150)}…</>}
          </span>
          {f.outcome.length > 150 && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: __stc('#059669'), fontSize: 11, cursor: 'pointer', padding: '0 4px' }}>
              {expanded ? '▲ less' : '▼ more'}
            </button>
          )}
        </div>
      )}

      {/* Record Outcome button for pending */}
      {isPending && (
        <div style={{ marginTop: 8 }}>
          <button onClick={onComplete}
            style={{ background: __sbg('#059669'), color: __stc('#fff'), border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            ✓ Record Outcome
          </button>
        </div>
      )}
    </div>
  );
}

// ── CustomerAddFollowupForm ───────────────────────────────────────────────────
function CustomerAddFollowupForm({ customer, currentUser, users, onCreated, onCancel }) {
  useThemeVersion();
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
    <div style={{ background: __sbg('#f0fdf4'), border: `1px solid ${__sbg('#bbf7d0')}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: __stc('#065F46') }}>📅 Schedule New Follow-up</h5>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: __stc('#6b7280'), lineHeight: 1 }}>✕</button>
      </div>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#374151'), marginBottom: 6 }}>Type</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(FU_TYPE_META).map(([type, meta]) => (
              <button key={type} type="button"
                onClick={() => setForm(p => ({ ...p, followupType: type }))}
                style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${form.followupType === type ? meta.color : __sbg('#d1d5db')}`,
                  background: form.followupType === type ? meta.bg : __sbg('#fff'), color: form.followupType === type ? meta.color : __stc('#374151'),
                  fontSize: 12, cursor: 'pointer', fontWeight: form.followupType === type ? 700 : 400 }}>
                {meta.icon} {type}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#374151'), marginBottom: 4 }}>Date & Time *</label>
            <input type="datetime-local" required value={form.scheduledAt} onChange={set('scheduledAt')}
              style={{ width: '100%', padding: '6px 8px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}/>
          </div>
          <div style={{ width: 130 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#374151'), marginBottom: 4 }}>Priority</label>
            <FilterSelect value={form.priority} options={['High','Medium','Low'].map(s=>({value:s,label:s}))} placeholder="Priority" onChange={set('priority')} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#374151'), marginBottom: 4 }}>Assign To *</label>
          <FilterSelect value={String(form.assignedTo||'')} options={users.map(u=>({value:String(u.id),label:u.name+(u.id===currentUser?.id?' (Me)':'')}))} placeholder="Assign To" onChange={set('assignedTo')} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#374151'), marginBottom: 4 }}>Notes</label>
          <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="What to cover in this follow-up…"
            style={{ width: '100%', padding: '6px 8px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel}
            style={{ padding: '6px 14px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, background: __sbg('#fff'), fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving}
            style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: __sbg('#059669'), color: __stc('#fff'), fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
      <div onClick={e => e.stopPropagation()} style={{ background: __sbg('#fff'), borderRadius: 12, padding: 24, width: '90%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <span style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>{tm.icon} {f.followupType}</span>
            <h4 style={{ margin: '8px 0 2px', fontSize: 16, fontWeight: 700 }}>Record Outcome</h4>
            <p style={{ margin: 0, fontSize: 12, color: __stc('#6b7280') }}>Scheduled: {_fmt(f.scheduledAt)}</p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: __stc('#6b7280') }}>✕</button>
        </div>
        {f.notes && (
          <div style={{ background: __sbg('#f9fafb'), borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: __stc('#6b7280'), marginBottom: 4 }}>📋 Original notes</div>
            <p style={{ margin: 0 }}>{f.notes}</p>
          </div>
        )}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: __stc('#374151') }}>📊 Outcome *</label>
            <textarea rows={5} required value={outcome} onChange={e => setOutcome(e.target.value)}
              placeholder="Describe what happened, what was discussed, next steps…"
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}/>
            <span style={{ fontSize: 11, color: __stc('#9ca3af') }}>{outcome.length} chars</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: __stc('#374151') }}>Mark as</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ v: 'Completed', icon: '✓', label: 'Completed' }, { v: 'Rescheduled', icon: '↻', label: 'Rescheduled' }, { v: 'Cancelled', icon: '✕', label: 'Cancelled' }].map(opt => {
                const sm = FU_STATUS_META[opt.v];
                const active = newStatus === opt.v;
                return (
                  <label key={opt.v} onClick={() => setNewStatus(opt.v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${active ? sm.color : __sbg('#d1d5db')}`, background: active ? sm.bg : __sbg('#fff'), cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400, color: active ? sm.color : __stc('#374151') }}>
                    <input type="radio" name="ns" value={opt.v} checked={active} onChange={() => setNewStatus(opt.v)} style={{ display: 'none' }}/>{opt.icon} {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onCancel} style={{ padding: '7px 16px', border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 6, background: __sbg('#fff'), fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '7px 18px', border: 'none', borderRadius: 6, background: __sbg('#059669'), color: __stc('#fff'), fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
  const P = { High: { bg:__sbg('#FEE2E2'),color:__stc('#991B1B') }, Medium: { bg:__sbg('#FEF3C7'),color:__stc('#92400E') }, Low: { bg:__sbg('#D1FAE5'),color:__stc('#065F46') } };
  const pm = P[f.priority] || P.Medium;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:__sbg('#fff'), borderRadius:14, width:'min(540px,95vw)', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ background: tm.bg, padding:'16px 20px', borderRadius:'14px 14px 0 0', borderBottom:`2px solid ${tm.color}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:__sbg('#fff'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, border:`1.5px solid ${tm.color}30` }}>{tm.icon}</div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontWeight:700, fontSize:16, color:__stc('#0f172a') }}>{f.followupType} Follow-up</span>
                <span style={{ background:sm.bg, color:sm.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:sm.dot, display:'inline-block' }}/>{f.status}
                </span>
                {overdue && <span style={{ background:__sbg('#FEE2E2'), color:__stc('#991B1B'), borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>⚠ OVERDUE</span>}
              </div>
              <div style={{ fontSize:11, color:__stc('#64748b'), marginTop:2 }}>#{f.id}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:__stc('#6b7280'), lineHeight:1 }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:__sbg('#f8fafc'), borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:__stc('#64748b'), textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Priority</div>
              <span style={{ background:pm.bg, color:pm.color, borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>{f.priority}</span>
            </div>
            <div style={{ background:__sbg('#f8fafc'), borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:__stc('#64748b'), textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>📅 Scheduled</div>
              <div style={{ fontWeight:700, fontSize:13, color: overdue ? __stc('#DC2626') : __stc('#0f172a') }}>{_fmtDate(f.scheduledAt)} {_fmtTime(f.scheduledAt)}</div>
              {f.completedAt && <div style={{ fontSize:11, color:__stc('#059669'), marginTop:2 }}>✓ {_fmt(f.completedAt)}</div>}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:__sbg('#f8fafc'), borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:__stc('#64748b'), textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Assigned To</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{f.assignedToName || 'Unassigned'}</div>
            </div>
            <div style={{ background:__sbg('#f8fafc'), borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:__stc('#64748b'), textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Created By</div>
              <div style={{ fontWeight:600, fontSize:13 }}>{f.createdByName || '—'}</div>
              <div style={{ fontSize:11, color:__stc('#64748b') }}>{_fmtDate(f.createdAt)}</div>
            </div>
          </div>
          {f.notes && (
            <div style={{ background:__sbg('#f0f9ff'), border:`1px solid ${__sbg('#bae6fd')}`, borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:__stc('#0369a1'), textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>📋 Pre-call Notes</div>
              <p style={{ margin:0, fontSize:13, color:__stc('#0f172a'), lineHeight:1.6, whiteSpace:'pre-wrap' }}>{f.notes}</p>
            </div>
          )}
          {f.outcome && (
            <div style={{ background:__sbg('#f0fdf4'), border:`1px solid ${__sbg('#bbf7d0')}`, borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:__stc('#15803d'), textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>📊 Outcome / Result</div>
              <p style={{ margin:0, fontSize:13, color:__stc('#0f172a'), lineHeight:1.6, whiteSpace:'pre-wrap' }}>{f.outcome}</p>
            </div>
          )}
          {!f.notes && !f.outcome && <div style={{ textAlign:'center', color:__stc('#94a3b8'), fontSize:13, padding:'8px 0' }}>No notes or outcome recorded yet.</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:6, borderTop:`1px solid ${__sbg('#f1f5f9')}` }}>
            <button onClick={onClose} style={{ padding:'6px 14px', border:`1px solid ${__sbg('#e2e8f0')}`, borderRadius:7, background:__sbg('#fff'), fontSize:13, cursor:'pointer' }}>Close</button>
            {f.status === 'Pending' && <button onClick={() => onComplete(f)} style={{ padding:'6px 14px', border:'none', borderRadius:7, background:__sbg('#059669'), color:__stc('#fff'), fontSize:13, fontWeight:600, cursor:'pointer' }}>✓ Record Outcome</button>}
            {f.status !== 'Cancelled' && f.status !== 'Completed' && <button onClick={() => onEdit(f)} style={{ padding:'6px 14px', border:'none', borderRadius:7, background:__sbg('#6366f1'), color:__stc('#fff'), fontSize:13, fontWeight:600, cursor:'pointer' }}>✏ Edit</button>}
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
      <div onClick={e=>e.stopPropagation()} style={{ background:__sbg('#fff'), borderRadius:14, width:'min(500px,95vw)', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${__sbg('#f1f5f9')}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h4 style={{ margin:0, fontSize:16, fontWeight:700 }}>✏ Edit Follow-up</h4>
          <button onClick={onCancel} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:__stc('#6b7280') }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {Object.entries(FU_TYPE_META).map(([type, meta]) => (
              <button key={type} type="button" onClick={() => setForm(p => ({ ...p, followupType: type }))}
                style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${form.followupType===type ? meta.color : __sbg('#d1d5db')}`, background: form.followupType===type ? meta.bg : __sbg('#fff'), color: form.followupType===type ? meta.color : __stc('#374151'), fontSize:12, cursor:'pointer', fontWeight: form.followupType===type ? 700 : 400 }}>
                {meta.icon} {type}
              </button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:__stc('#374151'), marginBottom:4 }}>Date & Time *</label>
              <input type="datetime-local" required value={form.scheduledAt} onChange={set('scheduledAt')} style={{ width:'100%', padding:'7px 10px', border:`1px solid ${__sbg('#d1d5db')}`, borderRadius:6, fontSize:13, boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:__stc('#374151'), marginBottom:4 }}>Priority</label>
              <FilterSelect value={form.priority} options={['High','Medium','Low'].map(s=>({value:s,label:s}))} placeholder="Priority" onChange={set('priority')} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:__stc('#374151'), marginBottom:4 }}>Status</label>
              <FilterSelect value={form.status} options={['Pending','Completed','Cancelled','Rescheduled'].map(s=>({value:s,label:s}))} placeholder="Status" onChange={set('status')} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:__stc('#374151'), marginBottom:4 }}>Assign To</label>
              <FilterSelect value={String(form.assignedTo||'')} options={users.map(u=>({value:String(u.id),label:u.name+(u.id===currentUser?.id?' (Me)':'')}))} placeholder="Assign To" onChange={set('assignedTo')} />
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:__stc('#374151'), marginBottom:4 }}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={set('notes')} style={{ width:'100%', padding:'7px 10px', border:`1px solid ${__sbg('#d1d5db')}`, borderRadius:6, fontSize:13, resize:'vertical', boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button type="button" onClick={onCancel} style={{ padding:'7px 16px', border:`1px solid ${__sbg('#e2e8f0')}`, borderRadius:7, background:__sbg('#fff'), fontSize:13, cursor:'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding:'7px 18px', border:'none', borderRadius:7, background:__sbg('#6366f1'), color:__stc('#fff'), fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customer Detail Page ──────────────────────────────────────────────────────
const CustomerDetailPage = ({ customer, currentUser, onBack, onEdit, permissions, showSuccess, showError, showWarning }) => {
  useThemeVersion();
  const [activeTab, setActiveTab]       = useState(() => localStorage.getItem('cust_detail_tab') || 'overview');
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
      const totalAdvancePaid   = orders.reduce((s, o) => s + (parseFloat(o.advanceAmount) || 0), 0);
      const totalInvoiced      = invoices.reduce((s, i) => s + (parseFloat(i.totalAmount || i.grandTotal) || 0), 0);
      const totalReceived      = receipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      // Balance Due = Invoiced - Received (if invoices raised), else OrderValue - Received (advance-only)
      const basis              = totalInvoiced > 0 ? totalInvoiced : totalOrderValue;
      const totalBalanceDue    = Math.max(0, basis - totalReceived);
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
    <div className="custd-detail-page">
      {/* Top bar */}
      <div className="custd-detail-topbar">
        <button className="custd-back-btn" onClick={onBack}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Customers
        </button>
        <div className="custd-detail-breadcrumb">
          <span style={{cursor:'pointer',color:__stc('#6b7280')}} onClick={onBack}>Customers</span>
          <span style={{margin:'0 6px',color:__stc('#d1d5db')}}>/</span>
          <span style={{color:__stc('#111827'),fontWeight:500}}>{customer.customerCode}</span>
        </div>
        {permissions.canEdit && (
          <button className="cust-btn cust-btn-primary" style={{marginLeft:'auto'}} onClick={() => onEdit(customer)}>
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit Customer
          </button>
        )}
      </div>

      {/* Hero card */}
      <div className="custd-hero">
        <div className="custd-hero-left">
          <div className="custd-hero-avatar">{customer.name?.[0]?.toUpperCase() || '?'}</div>
          <div>
            <h2 className="custd-hero-name">{customer.name}</h2>
            {customer.companyName && <div style={{fontSize:13,color:__stc('#6b7280')}}>{customer.companyName}</div>}
            <div className="custd-hero-code">{customer.customerCode}</div>
          </div>
        </div>
        <div className="custd-hero-badges">
          {customer.groupName && <span className={`cust-badge badge-${getGroupColor(customer.groupName)}`}>{customer.groupName}</span>}
          <span className={`cust-badge badge-${getStatusColor(customer.status)}`}>{customer.status}</span>
        </div>
        <div className="custd-hero-actions">
          <button className="cust-btn cust-btn-secondary" onClick={() => { setActiveTab('orderbooks'); setShowOrderForm(true); setEditingOrder(null); localStorage.setItem('cust_detail_tab','orderbooks'); }}>
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Order Book
          </button>
        </div>
      </div>

      {/* Tabs */}
      {/* Tab bar — one row of chevrons that nest into each other, so the selected
          tab reads as an arrow. Same treatment as the lead and project detail
          views; the styling lives under .custd-tab in Sales-Customer.css.
          Behaviour is unchanged: same state, same localStorage persistence.
          Sized for a small fixed set of tabs — if this ever grows past ~6,
          revisit the chevrons rather than letting them cramp. */}
      <div className="custd-tabs">
        {CUSTOMER_DETAIL_TABS.map(t => {
          const Ico = t.i;
          return (
            <button
              key={t.k}
              type="button"
              className={`custd-tab${activeTab===t.k?' active':''}`}
              aria-current={activeTab===t.k ? 'true' : undefined}
              title={t.l}
              onClick={() => { setActiveTab(t.k); setShowOrderForm(false); setShowOrderView(false); localStorage.setItem('cust_detail_tab', t.k); }}
            >
              <Ico className="custd-tab-ico" size={14} strokeWidth={2} aria-hidden="true" />
              <span className="custd-tab-label">{t.l}</span>
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="custd-tab-content">
          {/* Contact + Business info cards - always visible */}
          <div className="custd-info-grid">
            <div className="custd-info-card">
              <h4 className="custd-card-title">Contact Information</h4>
              <div className="custd-field-list">
                {[
                  ['Email',   customer.email || '-'],
                  ['Phone',   customer.phone || '-'],
                  ['Alt Phone', customer.altPhone || '-'],
                  ['Website', customer.website ? <a href={customer.website} target="_blank" rel="noopener noreferrer" style={{color:__stc('#3b82f6')}}>{customer.website}</a> : '-'],
                  ['Contact Person', customer.contactPerson || '-'],
                  ['Designation', customer.designation || '-'],
                ].map(([l,v]) => (
                  <div className="custd-field-row" key={l}>
                    <span className="custd-field-label">{l}</span>
                    <span className="custd-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="custd-info-card">
              <h4 className="custd-card-title">Business Details</h4>
              <div className="custd-field-list">
                {[
                  ['GST Number', customer.gstNumber || '-'],
                  ['PAN', customer.pan || '-'],
                  ['Group', customer.groupName || '-'],
                  ['Category', customer.subGroupName || '-'],
                  ['Assigned To', customer.assignedToName || '-'],
                  ['Address', customer.address ? `${customer.address}, ${customer.city || ''}, ${customer.state || ''} ${customer.pincode ? '- '+customer.pincode : ''}` : '-'],
                ].map(([l,v]) => (
                  <div className="custd-field-row" key={l}>
                    <span className="custd-field-label">{l}</span>
                    <span className="custd-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Client roll-up, three numbers ──
              The headline of the Financials tab, surfaced here: outstanding
              receivable, net cash, % collected. Rolled up from the client's
              PROJECTS (invoices/receipts/bills/payments), which is a different
              question from the order-and-invoice summary below it — click
              through for the full picture and the per-project proof. */}
          <ClientFinancialsStrip
            customerId={customer.id}
            onOpenFinancials={() => { setActiveTab('financials'); localStorage.setItem('cust_detail_tab','financials'); }}
          />

          {/* ── Financial Overview Dashboard ── */}
          {loadingOverview ? (
            <div style={{textAlign:'center',padding:'2rem',color:__stc('#6b7280')}}>Loading financial summary…</div>
          ) : overviewData ? (
            <div style={{marginTop:'1.25rem'}}>

              {/* KPI Row */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.75rem',marginBottom:'1.25rem'}}>
                {[
                  { label:'Total Order Value',  val:`₹${(overviewData.stats.totalOrderValue||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`, icon:'📦', color:__stc('#eff6ff'), accent:'#3b82f6' },
                  { label:'Total Invoiced',      val:`₹${(overviewData.stats.totalInvoiced||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`,   icon:'🧾', color:__stc('#f0fdf4'), accent:'#16a34a' },
                  { label:'Total Received',      val:`₹${(overviewData.stats.totalReceived||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`,    icon:'💰', color:__stc('#fef3c7'), accent:'#d97706' },
                  { label:'Balance Due',         val:`₹${(overviewData.stats.totalBalanceDue||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`,  icon:'⚠️', color:__stc('#fef2f2'), accent:'#dc2626' },
                  { label:'Active Orders',       val:overviewData.stats.activeOrders,    icon:'🔄', color:__stc('#f5f3ff'), accent:'#7c3aed' },
                  { label:'Pending Invoices',    val:overviewData.stats.pendingInvoices, icon:'📋', color:__stc('#fff7ed'), accent:'#ea580c' },
                ].map(({label,val,icon,color,accent}) => (
                  <div key={label} style={{background:__sbg('#fff'),border:`1px solid ${accent}22`,borderLeft:`3px solid ${accent}`,borderRadius:'8px',padding:'0.875rem',display:'flex',flexDirection:'column',gap:'4px'}}>
                    <div style={{fontSize:'18px'}}>{icon}</div>
                    <div style={{fontSize:'1.15rem',fontWeight:'700',color:__stc('#111827'),lineHeight:1.2}}>{val}</div>
                    <div style={{fontSize:'11px',color:__stc('#6b7280'),fontWeight:'500'}}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Orders Summary */}
              {overviewData.orders.length > 0 && (
                <div className="orderbook-card" style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <h4 className="custd-card-title" style={{margin:0}}>📦 Order Books ({overviewData.orders.length})</h4>
                    <button className="custd-btn custd-btn-sec custd-btn-sm" onClick={() => { setActiveTab('orderbooks'); localStorage.setItem('cust_detail_tab','orderbooks'); }}>View All →</button>
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
                            <td><span style={{color:__stc('#3b82f6'),fontWeight:500}}>{o.orderBookNo}</span><br/><span style={{color:__stc('#6b7280'),fontSize:'11px'}}>{o.orderTitle}</span></td>
                            <td>{o.poNumber||'-'}</td>
                            <td>{o.orderDate ? new Date(o.orderDate).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{fontWeight:600}}>₹{parseFloat(o.totalAmount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td>₹{parseFloat(o.advanceAmount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td style={{color:__stc('#dc2626'),fontWeight:600}}>₹{parseFloat(o.balanceAmount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td><span className={`orderbook-status ${getStatusClass(o.status)}`} style={{fontSize:'10px'}}>{o.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {overviewData.orders.length > 5 && <div style={{textAlign:'center',fontSize:'12px',color:__stc('#6b7280'),marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:`1px solid ${__sbg('#f3f4f6')}`}}>+{overviewData.orders.length - 5} more orders</div>}
                </div>
              )}

              {/* Invoices Summary */}
              {overviewData.invoices.length > 0 && (
                <div className="orderbook-card" style={{marginBottom:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <h4 className="custd-card-title" style={{margin:0}}>🧾 Invoices ({overviewData.invoices.length})</h4>
                    <div style={{display:'flex',gap:'8px',fontSize:'12px'}}>
                      <span style={{background:__sbg('#d1fae5'),color:__stc('#065f46'),padding:'2px 8px',borderRadius:'9999px'}}>{overviewData.stats.paidInvoices} Paid</span>
                      <span style={{background:__sbg('#fee2e2'),color:__stc('#991b1b'),padding:'2px 8px',borderRadius:'9999px'}}>{overviewData.stats.pendingInvoices} Pending</span>
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
                              <td><span style={{color:__stc('#3b82f6'),fontWeight:500}}>{inv.invoiceNo||inv.id}</span></td>
                              <td>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '-'}</td>
                              <td style={{fontWeight:600}}>₹{total.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                              <td style={{color:__stc('#16a34a')}}>₹{paid.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                              <td style={{color: due > 0 ? __stc('#dc2626') : __stc('#16a34a'),fontWeight:600}}>₹{due.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                              <td><span style={{background:statusBg,color:statusColor,padding:'2px 8px',borderRadius:'9999px',fontSize:'10px',fontWeight:600}}>{displayStatus}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {overviewData.invoices.length > 5 && <div style={{textAlign:'center',fontSize:'12px',color:__stc('#6b7280'),marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:`1px solid ${__sbg('#f3f4f6')}`}}>+{overviewData.invoices.length - 5} more invoices</div>}
                </div>
              )}

              {/* Receipts Summary */}
              {overviewData.receipts.length > 0 && (
                <div className="orderbook-card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                    <h4 className="custd-card-title" style={{margin:0}}>💰 Receipts / Payments Received ({overviewData.receipts.length})</h4>
                    <span style={{fontSize:'14px',fontWeight:'700',color:__stc('#16a34a')}}>Total: ₹{(overviewData.stats.totalReceived||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
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
                            <td><span style={{color:__stc('#3b82f6'),fontWeight:500}}>{r.receiptNo||r.id}</span></td>
                            <td>{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-IN') : '-'}</td>
                            <td style={{color:__stc('#16a34a'),fontWeight:700}}>₹{parseFloat(r.amount||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                            <td>{r.paymentMode||r.method||'-'}</td>
                            <td>{r.receiptType||'-'}</td>
                            <td style={{color:__stc('#6b7280')}}>{r.transactionReference||r.referenceNo||'-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {overviewData.receipts.length > 5 && <div style={{textAlign:'center',fontSize:'12px',color:__stc('#6b7280'),marginTop:'0.5rem',paddingTop:'0.5rem',borderTop:`1px solid ${__sbg('#f3f4f6')}`}}>+{overviewData.receipts.length - 5} more receipts</div>}
                </div>
              )}

              {/* Empty state */}
              {overviewData.orders.length === 0 && overviewData.invoices.length === 0 && overviewData.receipts.length === 0 && (
                <div className="custd-empty-state">
                  <div className="custd-empty-icon">📊</div>
                  <p>No financial activity recorded yet for this customer.</p>
                  <button className="custd-btn custd-btn-pri" onClick={() => { setActiveTab('orderbooks'); setShowOrderForm(true); localStorage.setItem('cust_detail_tab','orderbooks'); }}>Create First Order Book</button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── ORDER BOOKS ── */}
      {activeTab === 'orderbooks' && (
        <div className="custd-tab-content">
          {showOrderView && selectedOrder ? (
            <div>
              <div className="custd-section-hdr" style={{marginBottom:12}}>
                <button className="custd-back-btn" onClick={() => setShowOrderView(false)}>← Back to Orders</button>
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
                  <div><strong>Balance:</strong> <span style={{color:__stc('#dc2626')}}>₹{parseFloat(selectedOrder.balanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
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
              <div className="custd-section-hdr" style={{marginBottom:12}}>
                <h4 className="custd-card-title" style={{margin:0}}>{editingOrder ? 'Edit Order Book' : 'New Order Book'} — {customer.name}</h4>
                <button className="custd-btn custd-btn-sec" onClick={() => { setShowOrderForm(false); setEditingOrder(null); }}>Cancel</button>
              </div>
              <OrderBookForm
                customer={customer}
                currentUser={currentUser}
                apiBase={API_BASE_URL}
                existingOrder={editingOrder}
                onSaved={(saved) => {
                  setShowOrderForm(false); setEditingOrder(null);
                  showSuccess(editingOrder ? 'Order updated!' : 'Order created!');
                  // Non-blocking notices from a save that already committed (e.g. the
                  // order book total diverging from the linked proposal's value).
                  (saved?.warnings || []).forEach(w => showWarning && showWarning(w));
                  fetchOrderBooks();
                }}
                onCancel={() => { setShowOrderForm(false); setEditingOrder(null); }}
              />
            </div>
          ) : (
            <div>
              <div className="custd-section-hdr">
                <h4 className="custd-card-title" style={{margin:0}}>{orderBooks.length} Order Book{orderBooks.length !== 1 ? 's' : ''}</h4>
                <button className="custd-btn custd-btn-pri" onClick={() => { setShowOrderForm(true); setEditingOrder(null); }}>+ New Order Book</button>
              </div>
              {loadingOrders ? (
                <div className="custd-loading-row">Loading orders…</div>
              ) : orderBooks.length === 0 ? (
                <div className="custd-empty-state">
                  <div className="custd-empty-icon">📦</div>
                  <p>No order books yet for this customer.</p>
                  <button className="custd-btn custd-btn-pri" onClick={() => setShowOrderForm(true)}>Create First Order Book</button>
                </div>
              ) : (
                <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
                  <div className="custd-proposals-list">
                  {orderBooks.map(order => (
                    <div key={order.id} className="custd-proposal-card">
                      <div className="custd-proposal-card-left">
                        <div className="custd-proposal-no">{order.orderBookNo}</div>
                        <div className="custd-proposal-title">{order.orderTitle}</div>
                        <div className="custd-proposal-meta">
                          <span>₹{parseFloat(order.totalAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                          <span>·</span>
                          <span>Advance: ₹{parseFloat(order.advanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                          <span>·</span>
                          <span style={{color:__stc('#dc2626')}}>Balance: ₹{parseFloat(order.balanceAmount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                          <span>·</span>
                          <span>{fmtDate(order.orderDate)}</span>
                        </div>
                      </div>
                      <div className="custd-proposal-card-right">
                        <span className={`orderbook-status ${getStatusClass(order.status)}`}>{order.status}</span>
                        <div className="custd-proposal-actions">
                          <button className="custd-pact-btn" onClick={() => handleViewOrder(order)} title="View Details">
                            <FaEye size={13}/> View
                          </button>
                          <button className="custd-pact-btn" onClick={() => { setPoUploadOrder(order); setPoUploadData({file:null, poNumber:order.poNumber||'', poDate:new Date().toISOString().split('T')[0]}); setShowPOUploadModal(true); }} title="Upload PO">
                            <FaCloudUploadAlt size={13}/> PO
                          </button>
                          <button className="custd-pact-btn custd-pact-edit" onClick={() => { setEditingOrder(order); setShowOrderForm(true); }} title="Edit">
                            <FaEdit size={13}/> Edit
                          </button>
                          <button className="custd-pact-btn" style={{color:__stc('#dc2626')}} onClick={() => { setDeleteOrderId(order.id); setShowDeleteOrderConfirm(true); }} title="Delete">
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

      {/* ── FINANCIALS ──
          Money in / money out for this client across all their projects.
          The component owns its own fetch and loading/empty states; it reads
          GET /customers/{id}/financials, which aggregates the projects' OWN
          live figures, so nothing here is a second way of computing them. */}
      {activeTab === 'financials' && (
        <div className="custd-tab-content">
          <ClientFinancialsTab customer={customer} />
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
          <div className="custd-tab-content">
            {/* Toast */}
            {followupToast && (
              <div style={{ padding: '8px 14px', borderRadius: 6, marginBottom: 10, fontSize: 13, fontWeight: 600,
                background: followupToast.type === 'error' ? __sbg('#FEE2E2') : __sbg('#D1FAE5'),
                color: followupToast.type === 'error' ? __stc('#991B1B') : __stc('#065F46') }}>
                {followupToast.msg}
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h4 className="custd-card-title" style={{ margin: 0 }}>Follow-up Log</h4>
                <span style={{ background: __sbg('#e5e7eb'), color: __stc('#374151'), borderRadius: 20, padding: '1px 10px', fontSize: 12, fontWeight: 700 }}>{followups.length}</span>
                {fuCounts.Overdue > 0 && (
                  <span style={{ background: __sbg('#FEE2E2'), color: __stc('#991B1B'), borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>⚠ {fuCounts.Overdue} overdue</span>
                )}
              </div>
              {permissions?.CREATE !== false && (
                <button onClick={() => { setShowAddFollowup(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: __sbg('#059669'), color: __stc('#fff'), border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
                  style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${followupFilter === f ? __sbg('#059669') : __sbg('#d1d5db')}`,
                    background: followupFilter === f ? __sbg('#ecfdf5') : __sbg('#fff'), color: followupFilter === f ? __stc('#065F46') : __stc('#374151'),
                    fontSize: 12, fontWeight: followupFilter === f ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f}
                  {fuCounts[f] > 0 && <span style={{ background: followupFilter === f ? __sbg('#059669') : __sbg('#e5e7eb'), color: followupFilter === f ? __stc('#fff') : __stc('#374151'), borderRadius: 20, padding: '0 6px', fontSize: 11 }}>{fuCounts[f]}</span>}
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
              <div className="custd-loading-row">Loading…</div>
            ) : fuSorted.length === 0 ? (
              <div className="custd-empty-state">
                <div className="custd-empty-icon">{followupFilter === 'Overdue' ? '✅' : '📞'}</div>
                <p>{followupFilter === 'Overdue' ? 'No overdue follow-ups — you\'re on track!' :
                    followupFilter === 'Completed' ? 'No completed follow-ups yet.' :
                    followupFilter === 'Cancelled' ? 'No cancelled follow-ups.' :
                    followupFilter === 'Upcoming'  ? 'No upcoming follow-ups scheduled.' :
                    'No follow-ups recorded yet.'}</p>
                {followupFilter === 'All' && permissions?.CREATE !== false && (
                  <button onClick={() => setShowAddFollowup(true)}
                    style={{ marginTop: 10, padding: '7px 16px', background: __sbg('#059669'), color: __stc('#fff'), border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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

// ── Clients Date Range Filter ────────────────────────────────────────────────
const _CL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _CL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const ClientsDateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  const [show,   setShow]   = useState(false);
  const [from,   setFrom]   = useState(null);
  const [to,     setTo]     = useState(null);
  const [hover,  setHover]  = useState(null);
  const [calMo,  setCalMo]  = useState(new Date().getMonth());
  const [calYr,  setCalYr]  = useState(new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);

  const inR = d => {
    const hi = to || (from && hover ? hover : null);
    if (!from || !hi) return false;
    const [a,b] = from<=hi ? [from,hi] : [hi,from];
    return d > a && d < b;
  };
  const clickDay = d => {
    if (!from || (from && to)) { setFrom(d); setTo(null); }
    else if (d < from) { setFrom(d); setTo(null); }
    else if (d === from) { setFrom(null); setTo(null); }
    else setTo(d);
  };
  const fmt = d => { if (!d) return ''; const [y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex' }}>
      <button type="button"
        className={`cl-cal-trigger${show?' cl-cal--open':''}${appliedFrom?' cl-cal--applied':''}`}
        onClick={() => setShow(p => !p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom?'cl-cal-val':'cl-cal-ph'}>{appliedFrom?fmt(appliedFrom):'dd-mm-yyyy'}</span>
        <span className="cl-cal-sep">—</span>
        <span className={appliedTo&&appliedTo!==appliedFrom?'cl-cal-val':'cl-cal-ph'}>
          {appliedTo&&appliedTo!==appliedFrom?fmt(appliedTo):'dd-mm-yyyy'}
        </span>
        {appliedFrom && (
          <span className="cl-cal-x" onClick={e => { e.stopPropagation(); setFrom(null); setTo(null); onClear(); }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </span>
        )}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ marginLeft:'auto', color:__stc('#94a3b8'), flexShrink:0, transform:show?'rotate(180deg)':'none', transition:'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {show && (
        <div className="cl-cal-dropdown" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, width:264 }}>
          <div className="cl-cal-head">
            <button type="button" className="cl-cal-nav"
              onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="cl-cal-month-btn" onClick={() => setShowYr(p => !p)}>
              {_CL_MONTHS[calMo]} <span className="cl-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="cl-cal-nav"
              onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {showYr ? (
            <div className="cl-yr-grid">
              {Array.from({length:16},(_,i) => {
                const yr = new Date().getFullYear()-4+i;
                return <div key={yr} className={`cl-yr-cell${yr===calYr?' cl-yr-sel':''}`}
                  onClick={() => { setCalYr(yr); setShowYr(false); }}>{yr}</div>;
              })}
            </div>
          ) : (
            <div className="cl-cal-grid">
              {_CL_DAYS.map(d => <div key={d} className="cl-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="cl-cal-cell cl-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy  = i+1;
                const ds  = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const dow = (FD+i)%7;
                let cls   = 'cl-cal-cell';
                if (ds===from)      cls += ' cl-cal-from';
                else if (ds===to)   cls += ' cl-cal-to';
                else if (inR(ds)) {
                  cls += ' cl-cal-in-range';
                  if (dow===0) cls += ' cl-cal-rr-s';
                  if (dow===6) cls += ' cl-cal-rr-e';
                }
                if (ds===tod && ds!==from && ds!==to) cls += ' cl-cal-today';
                return <div key={ds} className={cls}
                  onClick={() => clickDay(ds)}
                  onMouseEnter={() => from && !to && setHover(ds)}
                  onMouseLeave={() => setHover(null)}>{dy}</div>;
              })}
            </div>
          )}

          <div className="cl-cal-footer">
            <div className="cl-cal-chips">
              <span className={`cl-cal-chip${from?' cl-cal-chip--set':''}`}>{from?fmt(from):'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/>
              </svg>
              <span className={`cl-cal-chip${to?' cl-cal-chip--set':''}`}>{to?fmt(to):'To —'}</span>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%' }}>
              {(from||appliedFrom) && (
                <button type="button" className="cl-cal-clear"
                  onClick={() => { setFrom(null); setTo(null); onClear(); setShow(false); }}>Clear</button>
              )}
              <button type="button" className="cl-cal-clear" onClick={() => setShow(false)}>Cancel</button>
              <button type="button" className="cl-cal-apply"
                onClick={() => { if(!from)return; onApply(from, to||from); setShow(false); }}
                disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const CustomerDatabase = () => {
  useThemeVersion();
  // const isFirstRender = useRef(true);
  const { user, pagePermissions } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // ── Permissions — pure DB-driven, no role overrides ──────────────
  const customersPermissions = pagePermissions?.CUSTOMERS || [];
  const canView   = customersPermissions.includes('VIEW');
  const canCreate = customersPermissions.includes('CREATE');
  const canEdit   = customersPermissions.includes('EDIT');
  const canDelete = customersPermissions.includes('DELETE');
  const permissions = { canView, canCreate, canEdit, canDelete };

  const currentUser = { id: user.id || 1, role: user.role || 'USER', name: user.name || 'Current User' };

  // ── UI State ──────────────────────────────────────────────────────
  const [viewMode,       setViewMode]       = useState('table');
  const [detailCustomer, setDetailCustomer] = useState(() => {
    try {
      const s = localStorage.getItem('cust_detail_customer');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  // ── Data ──────────────────────────────────────────────────────────
  const [customers,    setCustomers]    = useState([]);
  const [users,        setUsers]        = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [subGroups,    setSubGroups]    = useState([]);

  // ── Filters ───────────────────────────────────────────────────────
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedGroup, _setSelectedGroup] = useState('All'); // eslint-disable-line no-unused-vars
  const [selectedStatus,setSelectedStatus]= useState('All');
  const [dateFrom,      setDateFrom]       = useState('');
  const [dateTo,        setDateTo]         = useState('');
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

  // eslint-disable-next-line no-unused-vars
  const openQuickOb = (e, customer) => {
    e.stopPropagation();
    setQuickObCustomer(customer);
    setQuickObForm({ title: '', poNumber: '', poDate: '', deliveryDate: '', totalValue: '', notes: '', status: 'Draft' });
  };

  const closeQuickOb = () => { setQuickObCustomer(null); };

  const submitQuickOb = async () => {
    if (!quickObForm.title.trim()) { showWarning('Order title is required'); return; }
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
        fromDate:     dateFrom || null,
        toDate:       dateTo   || null,
        sortBy:        (dateFrom || dateTo) ? 'createdAt' : null,
        sortDirection: (dateFrom || dateTo) ? 'asc'       : null,
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

const hasFilters =
  searchTerm.trim() !== '' ||
  selectedGroup !== 'All' ||
  selectedStatus !== 'All' ||
  groupName !== '' ||
  subGroupName !== '' ||
  dateFrom !== '' ||
  dateTo !== '';

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
}, [canView, searchTerm, selectedGroup, selectedStatus, groupName, subGroupName, dateFrom, dateTo]);
// eslint-disable-line react-hooks/exhaustive-deps

// Effect 2 — pagination changes → immediate fetch
useEffect(() => {
  if (!canView) return;
  fetchCustomers(currentPage);
}, [currentPage, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!canView) { showWarning('No view permission'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/${customer.id}`);
      if (data.success) {
        setDetailCustomer(data.data);
        localStorage.setItem('cust_detail_customer', JSON.stringify(data.data));
        localStorage.removeItem('cust_detail_tab');
      }
    } catch (err) { showError(err.message || 'Error fetching customer details'); }
  };

  const handleEdit = (customer) => {
    if (!canEdit) { showWarning('No edit permission'); return; }
    setDetailCustomer(null);
    localStorage.removeItem('cust_detail_customer');
    localStorage.removeItem('cust_detail_tab');
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
    if (!canDelete) { showWarning('No delete permission'); return; }
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
    if (formData.pan && formData.pan.length !== 10) { showWarning('PAN must be exactly 10 characters'); return; }
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
    // Pre-seed group/subgroup from page-level header filters
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    setFormData({ name:'', companyName:'', groupName:seedGroup, subGroupName:seedSubGroup, contactPerson:'', designation:'', email:'', phone:'', altPhone:'', website:'', gstNumber:'', pan:'', address:'', city:'', state:'', pincode:'', status:'Active', assignedTo: null });
    // Load subgroups for seeded group
    if (seedGroup) fetchSubGroupsForForm(seedGroup);
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
      case 'contact': return (
        <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>
          {customer.email
            ? <span style={{ fontSize:12, color:__stc('#1e293b'), display:'flex', alignItems:'center', gap:4 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink:0, color:__stc('#6366f1') }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{customer.email}</span>
              </span>
            : null}
          {customer.phone
            ? <span style={{ fontSize:12, color:__stc('#374151'), display:'flex', alignItems:'center', gap:4 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink:0, color:__stc('#10b981') }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                {customer.phone}
              </span>
            : null}
          {!customer.email && !customer.phone ? <span style={{ color:__stc('#9ca3af') }}>N/A</span> : null}
        </div>
      );
      case 'createdAt': return customer.createdAt
        ? (() => { const d = new Date(customer.createdAt); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })()
        : <span style={{ color:__stc('#9ca3af') }}>—</span>;
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
            <button className="cust-action-btn" onClick={e => openQuickOb(e, customer)} title="Create Order Book" style={{color:__stc('#8b5cf6')}}>
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
          onBack={() => {
            setDetailCustomer(null);
            localStorage.removeItem('cust_detail_customer');
            localStorage.removeItem('cust_detail_tab');
          }}
          onEdit={c => { setDetailCustomer(null); handleEdit(c); }}
          showSuccess={showSuccess}
          showError={showError}
          showWarning={showWarning}
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
          <FilterSelect value={selectedStatus} options={[{value:'All',label:'All Status'},...['Active','Inactive','Prospect','Lead'].map(s=>({value:s,label:s}))]} placeholder="All Status" onChange={v=>{setSelectedStatus(v);setCurrentPage(1);}} />
          <ClientsDateRangeFilter
            appliedFrom={dateFrom}
            appliedTo={dateTo}
            onApply={(f,t) => { setDateFrom(f); setDateTo(t); setCurrentPage(1); }}
            onClear={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
          />
        </div>
        <div className="cust-action-buttons">
          <button className="cust-btn cust-btn-secondary" onClick={exportToCSV}>
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export
          </button>
          <button className={`cust-btn cust-btn-primary ${!canCreate?'cust-btn-disabled':''}`}
            onClick={() => { if(canCreate){ resetForm(); fetchUsers(); setIsAddFormOpen(true); } else showWarning('No create permission'); }}
            disabled={!canCreate}
          >
            <svg className="cust-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add New Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {/* <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'0.5rem' }}>
        {[
          {icon:'👥', bg:__sbg('#eff6ff'), val:kpiData.totalCustomers,    label:'Total Customers'},
          {icon:'✨', bg:__sbg('#fef3c7'), val:kpiData.newThisMonth,      label:'New This Month'},
          {icon:'📊', bg:__sbg('#dbeafe'), val:kpiData.activeCustomers,   label:'Active Customers'},
          {icon:'📞', bg:__sbg('#fce7f3'), val:kpiData.pendingFollowups,  label:'Follow-Ups Pending'},
        ].map(({icon,bg,val,label}) => (
          <div key={label} style={{ background:__sbg('#fff'), padding:'1rem', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ width:'40px', height:'40px', background:bg, borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem' }}>{icon}</div>
            <div>
              <div style={{ fontSize:'1.5rem', fontWeight:'bold', lineHeight:'1.2' }}>{val}</div>
              <div style={{ color:__stc('#666'), fontSize:'0.75rem', marginTop:'0.125rem' }}>{label}</div>
            </div>
          </div>
        ))}
      </div> */}

      {/* View Toggle + Column Controls — all right-aligned */}
      <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'8px', marginBottom:'0.75rem' }}>
        {/* Columns button — only visible in table mode, sits left of Table/Grid */}
        {viewMode === 'table' && (
          <ColumnVisibilityDropdown columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns}/>
        )}
        {/* Table / Grid pill toggle */}
        <div style={{ display:'flex', gap:'2px', background:__sbg('#f3f4f6'), borderRadius:'8px', padding:'3px' }}>
          <button
            onClick={() => setViewMode('table')}
            title="Table View"
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:500,
              background: viewMode==='table' ? __sbg('#fff') : __sbg('transparent'),
              color:       viewMode==='table' ? __stc('#111827') : __stc('#6b7280'),
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
              background: viewMode==='grid' ? __sbg('#fff') : __sbg('transparent'),
              color:       viewMode==='grid' ? __stc('#111827') : __stc('#6b7280'),
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
                  <tr><td colSpan={orderedVisibleColumns.length} style={{textAlign:'center',padding:'30px',color:__stc('#718096')}}>{loading ? 'Loading...' : 'No customers found'}</td></tr>
                ) : currentItems.map((customer, rowIndex) => (
                  <tr key={customer.id} onClick={() => canView && handleViewCustomer(customer)} style={{cursor: canView ? 'pointer' : 'default'}} className="cust-clickable-row">
                    {orderedVisibleColumns.map(col => (
                      <td key={col.key} style={{textAlign:'center'}} onClick={col.key==='actions' ? e => e.stopPropagation() : undefined}>
                        {col.key === 'sno' ? <span style={{fontWeight:600,color:__stc('#6b7280'),fontSize:13}}>{(currentPage - 1) * rowsPerPage + rowIndex + 1}</span> : renderCell(customer, col.key)}
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
                    {customer.companyName && <div style={{fontSize:12,color:__stc('#6b7280'),marginBottom:6}}>{customer.companyName}</div>}
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
                  <div className="cust-card-source" style={{fontSize:12,color:__stc('#9ca3af')}}>
                    {customer.gstNumber ? `GST: ${customer.gstNumber}` : 'No GST'}
                  </div>
                  <div className="cust-card-actions">
                    {canView && <button className="cust-card-action-btn cust-action-view" onClick={() => handleViewCustomer(customer)} title="View Customer"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>}
                    {canEdit && <button className="cust-card-action-btn cust-action-edit" onClick={() => handleEdit(customer)} title="Edit Customer"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>}
                    {/* canCreate && <button className="cust-card-action-btn" onClick={e => openQuickOb(e, customer)} title="Create Order Book" style={{color:__stc('#8b5cf6')}}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button> */}
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
                <div style={{fontSize:12,color:__stc('#6b7280'),marginTop:2}}>for {quickObCustomer.name}</div>
              </div>
              <button className="cust-modal-close" onClick={closeQuickOb}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="cust-modal-body" style={{padding:'1.25rem 1.5rem',display:'grid',gap:'0.875rem'}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Order Title <span style={{color:'red'}}>*</span></label>
                <input className="cust-form-input" placeholder="e.g. Solar Panel Supply — Phase 1" value={quickObForm.title} onChange={e => setQuickObForm(f=>({...f,title:e.target.value}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>PO Number</label>
                  <input className="cust-form-input" placeholder="PO-2024-001" value={quickObForm.poNumber} onChange={e => setQuickObForm(f=>({...f,poNumber:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Status</label>
                  <FilterSelect value={quickObForm.status} options={['Draft','Confirmed','In Production','Ready for Dispatch','Dispatched','Completed','Cancelled'].map(s=>({value:s,label:s}))} placeholder="Status" onChange={v=>setQuickObForm(f=>({...f,status:v}))} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>PO Date</label>
                  <input type="date" className="cust-form-input" value={quickObForm.poDate} onChange={e => setQuickObForm(f=>({...f,poDate:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Delivery Date</label>
                  <input type="date" className="cust-form-input" value={quickObForm.deliveryDate} onChange={e => setQuickObForm(f=>({...f,deliveryDate:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Total Value (₹)</label>
                <input type="text" className="cust-form-input" placeholder="e.g. 5,00,000" value={toINR(quickObForm.totalValue)} onChange={e => setQuickObForm(f=>({...f,totalValue:e.target.value.replace(/[^0-9]/g,'')}))}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Notes</label>
                <textarea className="cust-form-input" rows={2} placeholder="Any additional notes..." value={quickObForm.notes} onChange={e => setQuickObForm(f=>({...f,notes:e.target.value}))} style={{resize:'vertical'}}/>
              </div>
            </div>
            <div style={{padding:'1rem 1.5rem',borderTop:`1px solid ${__sbg('#e5e7eb')}`,display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
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
const CustomerFormBody = ({ formData, setFormData, phoneError, handlePhoneChange, groups, subGroups, users, loading, onCancel, onSubmit, INDIAN_STATES }) => {
  const [pincodeError, setPincodeError] = React.useState('');
  const pincodeDebounceRef              = React.useRef(null);
  const pincodeAbortRef                 = React.useRef(null);

  const handlePincodeChange = (value) => {
    const v = value.replace(/\D/g, '');
    if (v.length > 6) return;

    // Cancel any pending debounce timer and abort any in-flight request
    if (pincodeDebounceRef.current) clearTimeout(pincodeDebounceRef.current);
    if (pincodeAbortRef.current)    pincodeAbortRef.current.abort();

    // Clear error and stale auto-filled values when pin changes
    setPincodeError('');
    setFormData(p => ({ ...p, pincode: v, state: '', district: '' }));

    if (v.length !== 6) return;

    // Debounce: wait 600ms after the user stops typing before calling the API
    pincodeDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      pincodeAbortRef.current = controller;
      try {
        const res  = await fetch(`${API_BASE_URL}/pincode/${v}`, { credentials: 'include', signal: controller.signal });
        if (!res.ok) throw new Error('api_error');
        const data = await res.json();
        if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setFormData(p => ({ ...p, pincode: v, state: po.State, district: po.District }));
          setPincodeError('');
        } else {
          setPincodeError('Invalid PIN code');
        }
      } catch (err) {
        if (err.name !== 'AbortError') setPincodeError('Could not fetch PIN details');
      }
    }, 600);
  };

  return (
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
          {phoneError && <small style={{color:__stc('#dc2626')}}>{phoneError}</small>}
        </div>
        <div className="cust-form-group">
          <label>Group</label>
          <FilterSelect value={formData.groupName} options={groups.map(g=>({value:g.value||g.label,label:g.label||g.value}))} placeholder="Select Group" onChange={v=>setFormData({...formData,groupName:v,subGroupName:''})} />
        </div>
        <div className="cust-form-group">
          <label>Category / Sub-Group</label>
          <FilterSelect value={formData.subGroupName} options={subGroups.map(s=>({value:s.value||s.label,label:s.label||s.value}))} placeholder={!formData.groupName?'Select Group First':'Select Category'} disabled={!formData.groupName} onChange={v=>setFormData({...formData,subGroupName:v})} />
        </div>
        <div className="cust-form-group">
          <label>Status</label>
          <FilterSelect value={formData.status} options={['Active','Inactive','Prospect','Lead'].map(s=>({value:s,label:s}))} placeholder="Select Status" onChange={v=>setFormData({...formData,status:v})} />
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
          <input type="text" value={formData.gstNumber} onChange={e => { const v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""); if(v.length<=15) setFormData({...formData, gstNumber:v}); }} placeholder="22AAAAA0000A1Z5" maxLength="15"/>
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
          <label>Pincode</label>
          <input type="text" value={formData.pincode}
            onChange={e => handlePincodeChange(e.target.value)}
            maxLength="6" placeholder="6-digit PINCODE — auto fills State & District"/>
          {pincodeError && <span style={{fontSize:11, color:__stc('#ef4444'), marginTop:2, display:'block'}}>{pincodeError}</span>}
        </div>
        <div className="cust-form-group">
          <label>State</label>
          <input type="text" value={formData.state||''} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="Auto-filled by PINCODE or type manually"/>
        </div>
        <div className="cust-form-group">
          <label>District</label>
          <input type="text" value={formData.district||''} onChange={e => setFormData({...formData, district: e.target.value})} placeholder="Auto-filled by PINCODE or type manually"/>
        </div>
        <div className="cust-form-group">
          <label>Assign To</label>
          <FilterSelect value={formData.assignedTo?String(formData.assignedTo):''} options={users.map(u=>({value:String(u.id),label:u.name}))} placeholder="Select Member" onChange={v=>setFormData({...formData,assignedTo:v?Number(v):null})} />
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
};

// ─── Customer Pagination Widget ──────────────────────────────────────────────
const CustPagination = ({ startRecord, endRecord, totalRecords, currentPage, totalPages, rowsPerPage, onPageChange, onRowsPerPageChange }) => {
  useThemeVersion();
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left  = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pages.push(i);
    return pages;
  };

  const tp = totalPages || 1;
  return (
    <div className="leads-enquiries-pagination">
      <div className="leads-enquiries-pagination-info">
        {/* <span style={{whiteSpace:'nowrap'}}>Rows per page:</span> */}
        <span style={{whiteSpace:'nowrap',fontSize:12,color:__stc('#64748b')}}>Rows per page:</span>
        <FilterSelect value={String(rowsPerPage)} onChange={v => onRowsPerPageChange(Number(v))} options={[{value:'10',label:'10 rows'},{value:'20',label:'20 rows'},{value:'50',label:'50 rows'},{value:'100',label:'100 rows'}]} placeholder="Rows" />
        <span style={{whiteSpace:'nowrap',color:__stc('#64748b')}}>
          {totalRecords === 0 ? 'No records' : `${startRecord}–${endRecord} of ${totalRecords} customers`}
        </span>
        <span style={{fontSize:12,color:__stc('#94a3b8'),whiteSpace:'nowrap'}}>
          Page <strong style={{color:__stc('#0f172a')}}>{currentPage}</strong> of <strong style={{color:__stc('#0f172a')}}>{tp}</strong>
        </span>
      </div>
      <div className="leads-enquiries-pagination-buttons">
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</button>
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</button>
        {getPageNumbers().map(p => (
          <button key={p} className={`leads-enquiries-pagination-btn${p === currentPage ? ' leads-enquiries-pagination-btn-active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === tp || tp === 0}>›</button>
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(tp)} disabled={currentPage === tp || tp === 0}>»</button>
      </div>
    </div>
  );
};

export default CustomerDatabase;