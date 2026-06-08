import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Eye, Edit2, Trash2, RotateCcw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ConfirmationModal from '../components/ConfirmationModal';
import GroupSubgroupWarehouseFilter from '../components/Dropdowns/GroupSubgroupWarehouseFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import FilterSelect from '../components/Dropdowns/FilterSelect.js';
import filterApi from '../services/filterApi.js';
import ItemsTab from '../components/inventory_management/ItemsTab.js';
import TransactionsTab from '../components/inventory_management/TransactionsTab.js';
import PurchaseOrdersTab from '../components/inventory_management/PurchaseOrdersTab.js';
import BillsPaymentsTab from '../components/inventory_management/BillsPaymentsTab.js';
import '../pages-css/InventoryManagement.css';
import '../components_css/Dropdowns/GroupProjectFilter.css';

// ── Column Visibility Dropdown (shared across all tabs) ───────────────────────
// ── Constants ─────────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL;
const LS_TAB = 'inv_active_tab';

// ── Auth headers for backend calls (matches filterApi pattern) ────────────────
function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    const u = raw ? (JSON.parse(raw)?.user || {}) : {};
    const id = String(u.id || ''), role = String(u.role || '');
    return {
      'Content-Type': 'application/json',
      'User-Id': id, 'User-Role': role,
      'X-User-Id': id, 'X-User-Role': role,
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

// ── Warehouse API ─────────────────────────────────────────────────────────────
const warehouseApi = {
  list: async ({ groupName, subGroupName, projectId } = {}) => {
    const params = new URLSearchParams();
    if (groupName)    params.append('groupName',    groupName);
    if (subGroupName) params.append('subGroupName', subGroupName);
    if (projectId)    params.append('projectId',    projectId);
    const res = await fetch(`${API}/warehouses${params.toString() ? '?' + params.toString() : ''}`, {
      method: 'GET', headers: getAuthHeaders(), credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load warehouses');
    return res.json();
  },
};

// ── Inventory Item API ────────────────────────────────────────────────────────
const inventoryItemApi = {
  list: async ({ warehouseId, groupName, subGroupName, category, search, page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams();
    if (warehouseId)  params.append('warehouseId',  warehouseId);
    if (groupName)    params.append('groupName',    groupName);
    if (subGroupName) params.append('subGroupName', subGroupName);
    if (category)     params.append('category',     category);
    if (search)       params.append('search',       search);
    params.append('page', page);
    params.append('size', size);
    const res = await fetch(`${API}/inventory/items?${params.toString()}`, {
      method: 'GET', headers: getAuthHeaders(), credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load inventory items');
    return res.json(); // { content, totalElements, totalPages, size, number }
  },
  create: async (body) => {
    const res = await fetch(`${API}/inventory/items`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create item');
    }
    return res.json();
  },
  // Bulk create — posts a shared scope + a list of item rows in one request.
  // Returns { created:[...], failed:[{index,itemCode,name,message}], createdCount, failedCount }
  bulkCreate: async (body) => {
    const res = await fetch(`${API}/inventory/items/bulk`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create items');
    }
    return res.json();
  },
  update: async (id, body) => {
    const res = await fetch(`${API}/inventory/items/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update item');
    }
    return res.json();
  },
  remove: async (id) => {
    const res = await fetch(`${API}/inventory/items/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },
};

// ── Inventory Procurement APIs (separate inv_* tables) ────────────────────────
const invPoApi = {
  list: async (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') p.append(k, v); });
    const res = await fetch(`${API}/inventory/purchase-orders?${p}`, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load purchase orders');
    return res.json();
  },
  get: async (id) => {
    const res = await fetch(`${API}/inventory/purchase-orders/${id}`, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load purchase order');
    return res.json();
  },
  create: async (body) => {
    const res = await fetch(`${API}/inventory/purchase-orders`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to create PO'); }
    return res.json();
  },
  updateStatus: async (id, status) => {
    const res = await fetch(`${API}/inventory/purchase-orders/${id}/status`, {
      method: 'PATCH', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify({ status }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update status'); }
    return res.json();
  },
  receiveGoods: async (id, lines) => {
    const res = await fetch(`${API}/inventory/purchase-orders/${id}/receive`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify({ lines }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to receive goods'); }
    return res.json();
  },
  delete: async (id) => {
    const res = await fetch(`${API}/inventory/purchase-orders/${id}`, { method: 'DELETE', headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete PO');
    return res.json();
  },
};

const invBillApi = {
  list: async (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') p.append(k, v); });
    const res = await fetch(`${API}/inventory/bills?${p}`, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load bills');
    return res.json();
  },
  create: async (body) => {
    const res = await fetch(`${API}/inventory/bills`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to create bill'); }
    return res.json();
  },
  update: async (id, body) => {
    const res = await fetch(`${API}/inventory/bills/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update bill'); }
    return res.json();
  },
  delete: async (id) => {
    const res = await fetch(`${API}/inventory/bills/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete bill'); }
    return res.json();
  },
};

const invPaymentApi = {
  list: async (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') p.append(k, v); });
    const res = await fetch(`${API}/inventory/payments?${p}`, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load payments');
    return res.json();
  },
  create: async (body) => {
    const res = await fetch(`${API}/inventory/payments`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to record payment'); }
    return res.json();
  },
  update: async (id, body) => {
    const res = await fetch(`${API}/inventory/payments/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to update payment'); }
    return res.json();
  },
  allocate: async (id, allocations) => {
    const res = await fetch(`${API}/inventory/payments/${id}/allocate`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include',
      body: JSON.stringify({ allocations }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to allocate advance'); }
    return res.json();
  },
  delete: async (id) => {
    const res = await fetch(`${API}/inventory/payments/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete payment'); }
    return res.json();
  },
};

const invTransactionApi = {
  list: async (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') p.append(k, v); });
    const res = await fetch(`${API}/inventory/transactions?${p}`, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load transactions');
    return res.json();
  },
  create: async (body) => {
    const res = await fetch(`${API}/inventory/transactions`, {
      method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to record transaction'); }
    return res.json();
  },
};

// ── API → UI field normalisers ────────────────────────────────────────────────
// Tab components were built against mock data field names (poNumber, amount, paid…).
// The new backend returns slightly different names (poNo, totalAmount, paidAmount…).
// These adapters bridge the gap so tabs need no changes.
const normalizePO = po => ({
  ...po,
  poNumber:           po.poNo             || po.poNumber          || '',
  date:               po.orderDate        ? String(po.orderDate).slice(0, 10) : (po.date || ''),
  expected:           po.expectedDelivery ? String(po.expectedDelivery).slice(0, 10) : (po.expected || ''),
  terms:              po.paymentTerms     || po.terms              || '',
  totalItemsOrdered:  Number(po.totalItemsOrdered  ?? (po.items?.length ?? 0)),
  totalItemsReceived: Number(po.totalItemsReceived ?? 0),
  totalValue:         Number(po.totalValue         ?? 0),
  items: (po.items || []).map(it => ({
    ...it,
    orderedQty:  Number(it.orderedQty  ?? 0),
    receivedQty: Number(it.receivedQty ?? 0),
    rate:        Number(it.rate        ?? 0),
    taxPct:      Number(it.taxPct      ?? 0),
    lineTotal:   Number(it.lineTotal   ?? 0),
    itemName:    it.itemName || it.name || '',
  })),
});
const normalizeBill = b => ({
  ...b,
  billNumber:    b.billNo     || b.billNumber  || '',
  billDate:      b.billDate   ? String(b.billDate).slice(0, 10)  : '',
  dueDate:       b.dueDate    ? String(b.dueDate).slice(0, 10)   : '',
  amount:        Number(b.totalAmount   || b.amount || 0),
  paid:          Number(b.paidAmount    || b.paid   || 0),
  balance:       Number(b.balanceAmount ?? ((b.totalAmount || 0) - (b.paidAmount || 0))),
  poNumber:      b.poNo       || b.poNumber    || '—',
  poId:          b.poId       || null,
  vendorName:    b.vendorName || '',
  status:        b.status     || 'UNPAID',
  projectId:     b.projectId  || '',
  items: (b.items || []).map(it => ({
    ...it,
    qty:     Number(it.qty     ?? 0),
    rate:    Number(it.rate    ?? 0),
    taxPct:  Number(it.taxPct  ?? 0),
    itemName:it.itemName || it.name || '',
  })),
});
const normalizePayment = p => ({
  ...p,
  paymentNumber:   p.paymentNo        || p.paymentNumber  || '',
  date:            p.paymentDate      ? String(p.paymentDate).slice(0, 10) : (p.date || ''),
  mode:            p.paymentMode      || p.mode            || '',
  reference:       p.referenceNumber  || p.reference       || '',
  billNumber:      p.billNo           || p.billNumber      || '',
  vendorName:      p.vendorName       || '',
  amount:          Number(p.amount    ?? 0),
  appliedAmount:   Number(p.appliedAmount  ?? 0),
  unappliedAmount: Number(p.unappliedAmount != null ? p.unappliedAmount
                         : (p.amount ?? 0) - (p.appliedAmount ?? 0)),
  billId:   p.billId   || null,
  advanceId:p.advanceId|| null,
  poId:     p.poId     || null,
});
const normalizeTxn = t => ({
  ...t,
  ref:        t.refNo       || t.ref        || '',
  note:       t.notes       || t.note       || '',
  by:         t.createdByName || 'System',
  itemCode:   t.itemCode    || '',
  itemName:   t.itemName    || '',
  projectId:  t.projectId   || '',
  qty:        Number(t.qty  || 0),
  date:       t.transactionDate ? String(t.transactionDate).slice(0, 10) : t.date || '',
  vendorName: t.vendorName  || '',
  poNo:       t.poNo        || '',
  unitCost:   Number(t.unitCost || 0),
});

const CATEGORY_COLORS = {
  'Electrical':       { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  'Mechanical':       { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  'Civil':            { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'Consumable':       { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  'Tool':             { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
  'Structural':       { bg: '#f0f9ff', color: '#075985', border: '#bae6fd' },
  'Plumbing':         { bg: '#ecfeff', color: '#155e75', border: '#a5f3fc' },
  'Safety':           { bg: '#fff1f2', color: '#9f1239', border: '#fecdd3' },
  'IT & Electronics': { bg: '#f5f3ff', color: '#4c1d95', border: '#ddd6fe' },
  'Solar / PV':       { bg: '#fefce8', color: '#713f12', border: '#fef08a' },
  'Cable & Wiring':   { bg: '#fff7ed', color: '#7c2d12', border: '#fed7aa' },
  'Mounting':         { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
  'Fasteners':        { bg: '#f8fafc', color: '#1e293b', border: '#e2e8f0' },
  'Finishing':        { bg: '#fdf2f8', color: '#831843', border: '#fbcfe8' },
  'Other':            { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};

const STOCK_STATUS = {
  IN_STOCK:    { label: 'In Stock',    bg: '#dcfce7', color: '#166534' },
  LOW_STOCK:   { label: 'Low Stock',   bg: '#fef9c3', color: '#854d0e' },
  OUT_OF_STOCK:{ label: 'Out of Stock',bg: '#fee2e2', color: '#991b1b' },
  ON_ORDER:    { label: 'On Order',    bg: '#e0f2fe', color: '#0c4a6e' },
};

const TXN_TYPES = {
  INWARD:       { label: 'Inward',       bg: '#dcfce7', color: '#166534', icon: '↓' },
  OUTWARD:      { label: 'Outward',      bg: '#fee2e2', color: '#991b1b', icon: '↑' },
  TRANSFER:     { label: 'Transfer',     bg: '#e0f2fe', color: '#0c4a6e', icon: '⇄' },
  ADJUSTMENT:   { label: 'Adjustment',   bg: '#fef9c3', color: '#854d0e', icon: '~' },
  RETURN:       { label: 'Return',       bg: '#fdf4ff', color: '#7e22ce', icon: '↩' },
};

const UNITS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Roll', 'Sheet', 'Pair', 'Bag',
               'Sqm', 'Cum', 'Ton', 'Gram', 'Bundle', 'Lot', 'Reel', 'Coil', 'Pack'];

// ── Mock data for demo ────────────────────────────────────────────────────────
// MOCK_ITEMS removed in Phase 2 — items now come from GET /inventory/items.
// MOCK_TRANSACTIONS, MOCK_POS, MOCK_BILLS, MOCK_PAYMENTS still local until
// Phase 3 (transactions) and Phase 4 (POs/bills wiring).
const MOCK_TRANSACTIONS = [
  { id: 1, date: '2026-05-30', type: 'INWARD',     itemCode: 'ME-001', itemName: 'Module Mounting Clamp', qty: 100, unit: 'Set',  projectId: 'PROJ-2026-0024', ref: 'PO-2026-00041', note: 'PO delivery batch 2', by: 'Ravi Kumar' },
  { id: 2, date: '2026-05-29', type: 'OUTWARD',    itemCode: 'EL-001', itemName: 'Solar Panel 550W Mono', qty: 20,  unit: 'Nos',  projectId: 'PROJ-2026-0015', ref: 'ISS-002',       note: 'Site installation phase 1', by: 'Arun Sharma' },
  { id: 3, date: '2026-05-29', type: 'ADJUSTMENT', itemCode: 'EL-002', itemName: 'Inverter 10KW',          qty: -1,  unit: 'Nos',  projectId: 'PROJ-2026-0015', ref: 'ADJ-005',       note: 'Physical verification shortfall', by: 'Admin' },
  { id: 4, date: '2026-05-28', type: 'INWARD',     itemCode: 'EL-004', itemName: 'DC String Cable 4mm²',   qty: 200, unit: 'Mtr',  projectId: 'PROJ-2026-0021', ref: 'PO-2026-00038', note: 'Balance delivery',       by: 'Ravi Kumar' },
  { id: 5, date: '2026-05-27', type: 'OUTWARD',    itemCode: 'CI-001', itemName: 'GI Channel 40×40',       qty: 30,  unit: 'Mtr',  projectId: 'PROJ-2026-0033', ref: 'ISS-001',       note: 'Mounting structure erection', by: 'Site Team' },
  { id: 6, date: '2026-05-26', type: 'RETURN',     itemCode: 'CO-001', itemName: 'Lugs & Crimping Set',    qty: 2,   unit: 'Box',  projectId: 'PROJ-2026-0033', ref: 'RET-003',       note: 'Unused returned from site',   by: 'Arun Sharma' },
  { id: 7, date: '2026-05-25', type: 'TRANSFER',   itemCode: 'TL-001', itemName: 'Torque Wrench Set',      qty: 1,   unit: 'Set',  projectId: 'PROJ-2026-0021', ref: 'TRF-001',       note: 'Moved to PROJ-0033 site',     by: 'Admin' },
];

// ── PO / Bills / Payments domain constants ────────────────────────────────────
const PO_STATUS = {
  DRAFT:     { label: 'Draft',     bg: '#f1f5f9', color: '#475569' },
  SENT:      { label: 'Sent',      bg: '#e0f2fe', color: '#0c4a6e' },
  APPROVED:  { label: 'Approved',  bg: '#dcfce7', color: '#166534' },
  PARTIAL:   { label: 'Partially Received', bg: '#fef9c3', color: '#854d0e' },
  RECEIVED:  { label: 'Received',  bg: '#dcfce7', color: '#166534' },
  CANCELLED: { label: 'Cancelled', bg: '#fee2e2', color: '#991b1b' },
};

const BILL_STATUS = {
  UNPAID:   { label: 'Unpaid',        bg: '#fee2e2', color: '#991b1b' },
  PARTIAL:  { label: 'Partially Paid',bg: '#fef9c3', color: '#854d0e' },
  PAID:     { label: 'Paid',          bg: '#dcfce7', color: '#166534' },
  OVERDUE:  { label: 'Overdue',       bg: '#fee2e2', color: '#7f1d1d' },
};

const PAY_MODES = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Credit Card'];

// ── Mock vendors ──────────────────────────────────────────────────────────────
const MOCK_VENDORS = [
  { id: 1, name: 'Adani Solar Pvt Ltd',        gstin: '24AAACA1234B1Z5', email: 'sales@adanisolar.com',  phone: '+91 79 2555 5555' },
  { id: 2, name: 'Tata Power Solar Systems',   gstin: '27AAACT2345C1Z8', email: 'orders@tatapower.com',  phone: '+91 22 6665 8282' },
  { id: 3, name: 'Waaree Energies Ltd',        gstin: '24AAACW3456D1Z2', email: 'procurement@waaree.com',phone: '+91 22 6644 4444' },
  { id: 4, name: 'Polycab India Ltd',          gstin: '27AAACP4567E1Z9', email: 'b2b@polycab.com',       phone: '+91 22 2493 9000' },
  { id: 5, name: 'Havells India Ltd',          gstin: '07AAACH5678F1Z3', email: 'corp@havells.com',      phone: '+91 11 4727 4727' },
];

const MOCK_POS = [
  { id: 1, poNumber: 'PO-2026-00041', vendorId: 3, vendorName: 'Waaree Energies Ltd', date: '2026-05-20', expected: '2026-06-05', projectId: 'PROJ-2026-0024',
    items: [
      { itemCode: 'ME-001', name: 'Module Mounting Clamp', qty: 200, unit: 'Set', rate: 320, tax: 18 },
      { itemCode: 'EL-001', name: 'Solar Panel 550W Mono', qty: 50,  unit: 'Nos', rate: 18500, tax: 12 },
    ], status: 'PARTIAL', terms: '50% advance, balance on delivery', notes: 'Urgent — site phase 2', createdBy: 'Ravi Kumar' },
  { id: 2, poNumber: 'PO-2026-00040', vendorId: 1, vendorName: 'Adani Solar Pvt Ltd', date: '2026-05-18', expected: '2026-05-30', projectId: 'PROJ-2026-0015',
    items: [{ itemCode: 'EL-001', name: 'Solar Panel 550W Mono', qty: 100, unit: 'Nos', rate: 18450, tax: 12 }],
    status: 'RECEIVED', terms: 'Net 30', notes: '', createdBy: 'Ravi Kumar' },
  { id: 3, poNumber: 'PO-2026-00039', vendorId: 4, vendorName: 'Polycab India Ltd', date: '2026-05-15', expected: '2026-05-28', projectId: 'PROJ-2026-0021',
    items: [{ itemCode: 'EL-004', name: 'DC String Cable 4mm²', qty: 1000, unit: 'Mtr', rate: 62, tax: 18 }],
    status: 'APPROVED', terms: 'Net 15', notes: '', createdBy: 'Arun Sharma' },
  { id: 4, poNumber: 'PO-2026-00038', vendorId: 2, vendorName: 'Tata Power Solar Systems', date: '2026-05-10', expected: '2026-05-25', projectId: 'PROJ-2026-0033',
    items: [{ itemCode: 'EL-002', name: 'Inverter 10KW', qty: 8, unit: 'Nos', rate: 64800, tax: 18 }],
    status: 'SENT', terms: '100% advance', notes: 'Awaiting vendor acknowledgement', createdBy: 'Admin' },
  { id: 5, poNumber: 'PO-2026-00037', vendorId: 5, vendorName: 'Havells India Ltd', date: '2026-05-05', expected: '2026-05-20', projectId: 'PROJ-2026-0015',
    items: [{ itemCode: 'EL-003', name: 'AC Cable 6mm²', qty: 500, unit: 'Mtr', rate: 82, tax: 18 }],
    status: 'DRAFT', terms: 'Net 30', notes: '', createdBy: 'Arun Sharma' },
];

const MOCK_BILLS = [
  { id: 1, billNumber: 'BILL-2026-00112', poNumber: 'PO-2026-00040', vendorId: 1, vendorName: 'Adani Solar Pvt Ltd', billDate: '2026-05-25', dueDate: '2026-06-24',
    amount: 2067200, paid: 2067200, status: 'PAID', projectId: 'PROJ-2026-0015', notes: 'Full payment cleared' },
  { id: 2, billNumber: 'BILL-2026-00111', poNumber: 'PO-2026-00041', vendorId: 3, vendorName: 'Waaree Energies Ltd', billDate: '2026-05-28', dueDate: '2026-06-12',
    amount: 1107600, paid: 553800, status: 'PARTIAL', projectId: 'PROJ-2026-0024', notes: '50% advance paid' },
  { id: 3, billNumber: 'BILL-2026-00110', poNumber: 'PO-2026-00038', vendorId: 2, vendorName: 'Tata Power Solar Systems', billDate: '2026-05-22', dueDate: '2026-06-06',
    amount: 611712, paid: 0, status: 'UNPAID', projectId: 'PROJ-2026-0033', notes: '' },
  { id: 4, billNumber: 'BILL-2026-00109', poNumber: '—', vendorId: 4, vendorName: 'Polycab India Ltd', billDate: '2026-04-30', dueDate: '2026-05-15',
    amount: 73160, paid: 0, status: 'OVERDUE', projectId: 'PROJ-2026-0021', notes: 'Follow up required' },
];

const MOCK_PAYMENTS = [
  { id: 1, paymentNumber: 'PAY-2026-00058', billNumber: 'BILL-2026-00112', vendorName: 'Adani Solar Pvt Ltd', date: '2026-05-26', amount: 2067200, mode: 'Bank Transfer', reference: 'NEFT/SBIN/2026052612345', notes: 'Final payment' },
  { id: 2, paymentNumber: 'PAY-2026-00057', billNumber: 'BILL-2026-00111', vendorName: 'Waaree Energies Ltd', date: '2026-05-28', amount: 553800, mode: 'Bank Transfer', reference: 'RTGS/HDFC/2026052878901', notes: 'Advance against PO-41' },
  { id: 3, paymentNumber: 'PAY-2026-00056', billNumber: 'BILL-2026-00105', vendorName: 'Havells India Ltd', date: '2026-05-15', amount: 145200, mode: 'Cheque', reference: 'CHQ-000455', notes: '' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('en-IN'); }
function fmtCcy(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function poTotal(items) {
  return items.reduce((s, it) => {
    const sub = (Number(it.qty)||0) * (Number(it.rate)||0);
    return s + sub + (sub * (Number(it.tax)||0) / 100);
  }, 0);
}

// ── PO metrics derived from item receivedQty and linked bills/payments ────────
function getPoMetrics(po, bills, payments) {
  const total        = poTotal(po.items);
  const linkedBills  = bills.filter(b => b.poNumber === po.poNumber || (b.poId && po.id && String(b.poId) === String(po.id)));
  const billed       = linkedBills.reduce((s, b) => s + b.amount, 0);
  const paid         = linkedBills.reduce((s, b) => s + b.paid, 0);
  const billPct      = total > 0 ? Math.min(100, (billed / total) * 100) : 0;
  const payPct       = total > 0 ? Math.min(100, (paid   / total) * 100) : 0;

  // Delivery progress — prefer denormalized counts from entity (always populated,
  // even when items are not loaded). Fall back to summing item receivedQty if available.
  const totalOrdered  = Number(po.totalItemsOrdered)  || po.items.reduce((s, it) => s + (Number(it.orderedQty || it.qty) || 0), 0);
  const totalReceived = Number(po.totalItemsReceived) || po.items.reduce((s, it) => s + (Number(it.receivedQty) || 0), 0);
  const deliveryPct   = totalOrdered > 0 ? Math.min(100, (totalReceived / totalOrdered) * 100) : 0;

  const fraction     = total > 0 ? Math.min(1, billed / total) : 0;

  const derivedStatus =
      totalOrdered > 0 && totalReceived >= totalOrdered && totalOrdered > 0 ? 'RECEIVED'
    : totalReceived > 0                                                       ? 'PARTIAL'
    : billed > 0                                                              ? 'PARTIAL'
    :                                                                           po.status;

  const advancePayments = (payments || []).filter(pay =>
    !pay.billId && String(pay.vendorId) === String(po.vendorId) &&
    (pay.groupName || '') === (po.groupName || '')
  );
  const advancePaid = advancePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return { total, billed, paid, billPct, payPct, deliveryPct, totalOrdered, totalReceived,
           fraction, derivedStatus, linkedBills, advancePaid, advancePayments };
}

// ── Confirm Dialog (replaces window.confirm) ──────────────────────────────────
// Returns { confirmState, confirm } where:
//   confirm({ title, message, type, confirmText, cancelText, onConfirm, onCancel }) opens the modal
//   <ConfirmDialogHost confirmState={confirmState} /> renders the modal
function useConfirm() {
  const [state, setState] = useState({ show: false });
  const confirm = useCallback(({ title, message, type = 'alert', confirmText = 'Delete',
                                  cancelText, onConfirm, onCancel }) => {
    setState({ show: true, title, message, type, confirmText, cancelText, onConfirm, onCancel });
  }, []);
  const close = useCallback(() => setState({ show: false }), []);
  return { confirmState: { ...state, onClose: close }, confirm };
}
function ConfirmDialogHost({ confirmState }) {
  const { show, title, message, type, confirmText, cancelText, onConfirm, onCancel, onClose } = confirmState;
  return (
    <ConfirmationModal
      show={show}
      title={title}
      message={message}
      type={type || 'alert'}
      confirmText={confirmText || 'Confirm'}
      cancelText={cancelText || 'Cancel'}
      showCancel={true}
      onConfirm={() => { onClose(); if (onConfirm) onConfirm(); }}
      onCancel={() => { onClose(); if (onCancel) onCancel(); }}
    />
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, add };
}
function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="inv-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`inv-toast inv-toast--${t.type}`}>
          <span>{t.type === 'success' ? '✓' : '!'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── Add Item Modal ────────────────────────────────────────────────────────────
// Manages its own Group → Subgroup → Warehouse cascading selects.
// Pre-fills from the page-level filter so the user rarely has to re-pick.
function AddItemModal({ open, onClose, onSave, onBulkSave,
  defaultGroupName, defaultSubGroupName, defaultWarehouseId }) {

  // ── Mode: add one item or many at once ───────────────────────────────────
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'

  // ── Cascading dropdown data (shared by both modes) ────────────────────────
  const [groups,     setGroups]     = useState([]);
  const [subGroups,  setSubGroups]  = useState([]);
  const [warehouseList, setWhList]  = useState([]);
  const [loadingG,   setLoadingG]   = useState(false);
  const [loadingSG,  setLoadingSG]  = useState(false);
  const [loadingWH,  setLoadingWH]  = useState(false);
  const whReqRef = useRef(0);

  // ── Shared scope (Group → Sub-Group → Warehouse) ─────────────────────────
  const blankScope = () => ({ groupName: '', subGroupName: '', warehouseId: '' });
  const [scope, setScope] = useState(blankScope);

  // ── Single-item details ───────────────────────────────────────────────────
  const blankSingle = () => ({
    itemCode: '', name: '', category: 'Electrical', unit: 'Nos',
    currentQty: '', minQty: '', maxQty: '', unitCost: '', projectId: '', note: ''
  });
  const [single, setSingle] = useState(blankSingle);
  const setS = (k, v) => setSingle(s => ({ ...s, [k]: v }));

  // ── Bulk rows ─────────────────────────────────────────────────────────────
  const rowId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID() : `r_${Math.random().toString(36).slice(2)}`;
  const newRow = () => ({
    _id: rowId(),
    itemCode: '', name: '', category: 'Electrical', unit: 'Nos',
    currentQty: '', minQty: '', maxQty: '', unitCost: '', projectId: '', note: '',
    error: ''
  });
  const makeRows = (n) => Array.from({ length: n }, newRow);
  const [rows, setRows] = useState(() => makeRows(5));

  // ── Pre-fill scope from page-level selection on open; reset entry data ────
  useEffect(() => {
    if (!open) return;
    setScope({
      groupName:    defaultGroupName    || '',
      subGroupName: defaultSubGroupName || '',
      warehouseId:  defaultWarehouseId  ? String(defaultWarehouseId) : '',
    });
    setMode('single');
    setSingle(blankSingle());
    setRows(makeRows(5));
  }, [open, defaultGroupName, defaultSubGroupName, defaultWarehouseId]);

  // ── Fetch groups whenever modal opens ────────────────────────────────────
  // Using [] caused groups to be fetched at page-load time before auth was
  // ready, failing silently and leaving the dropdown empty. [open] ensures
  // a fresh fetch with valid auth headers each time the modal is opened.
  useEffect(() => {
    if (!open) return;
    setLoadingG(true);
    filterApi.getAllGroups()
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
      .finally(() => setLoadingG(false));
  }, [open]);

  // ── Cascade: group → sub-groups ───────────────────────────────────────────
  useEffect(() => {
    if (!scope.groupName) { setSubGroups([]); return; }
    setLoadingSG(true);
    filterApi.getSubGroups(scope.groupName)
      .then(d => setSubGroups(Array.isArray(d) ? d : []))
      .catch(() => setSubGroups([]))
      .finally(() => setLoadingSG(false));
  }, [scope.groupName]);

  // ── Cascade: group + sub-group → warehouses ───────────────────────────────
  useEffect(() => {
    if (!scope.groupName) { setWhList([]); return; }
    const id = ++whReqRef.current;
    setLoadingWH(true);
    const params = new URLSearchParams();
    params.append('groupName', scope.groupName);
    if (scope.subGroupName) params.append('subGroupName', scope.subGroupName);
    fetch(`${API}/warehouses?${params.toString()}`, {
      headers: getAuthHeaders(), credentials: 'include',
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (id === whReqRef.current) setWhList(Array.isArray(d) ? d : []); })
      .catch(() => { if (id === whReqRef.current) setWhList([]); })
      .finally(() => { if (id === whReqRef.current) setLoadingWH(false); });
  }, [scope.groupName, scope.subGroupName]);

  // ── Picking a warehouse auto-resolves its group + sub-group ───────────────
  const pickWarehouse = (warehouseId) => {
    const wh = warehouseList.find(w => String(w.id) === String(warehouseId));
    setScope(s => ({
      ...s,
      warehouseId,
      groupName:    wh?.groupName    || s.groupName,
      subGroupName: wh?.subGroupName || s.subGroupName,
    }));
  };

  if (!open) return null;

  const selectedWh = warehouseList.find(w => String(w.id) === String(scope.warehouseId));
  const scopeReady = !!scope.groupName && !!scope.warehouseId;

  // ── Bulk-row helpers ──────────────────────────────────────────────────────
  const setRow = (id, k, v) => setRows(rs => rs.map(r =>
    r._id === id ? { ...r, [k]: v, error: (k === 'itemCode' || k === 'name') ? '' : r.error } : r));
  const addRows   = (n) => setRows(rs => [...rs, ...makeRows(n)]);
  const removeRow = (id) => setRows(rs => rs.length > 1 ? rs.filter(r => r._id !== id) : rs);
  const clearEmpty = () => setRows(rs => {
    const kept = rs.filter(r => r.itemCode.trim() || r.name.trim());
    return kept.length ? kept : makeRows(1);
  });

  const validBulkRows = rows.filter(r => r.itemCode.trim() && r.name.trim());

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitSingle = () => {
    onSave({ ...scope, ...single });
    onClose();
  };
  const submitBulk = () => {
    onBulkSave({ scope, rows: validBulkRows });
    onClose();
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className={`inv-modal${mode === 'bulk' ? ' inv-modal--lg' : ''}`}
        onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Add New Item{mode === 'bulk' ? 's' : ''}</h3>
            <p className="inv-modal-sub">
              {selectedWh
                ? <>Adding to <strong>{selectedWh.name}</strong>{selectedWh.code ? ` (${selectedWh.code})` : ''}</>
                : 'Select a warehouse below to scope these items'}
            </p>
            <div className="inv-mode-toggle">
              <button type="button"
                className={`inv-mode-btn${mode === 'single' ? ' inv-mode-btn--active' : ''}`}
                onClick={() => setMode('single')}>Single</button>
              <button type="button"
                className={`inv-mode-btn${mode === 'bulk' ? ' inv-mode-btn--active' : ''}`}
                onClick={() => setMode('bulk')}>Bulk (multiple)</button>
            </div>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">

          {/* ── Scope: Group → Sub-Group → Warehouse (shared by both modes) ── */}
          <div className="inv-scope-section">
            <div className="inv-scope-title">Scope <span className="inv-muted-sm">— determines which items appear under which filter</span></div>
            <div className="inv-scope-grid">
              {/* Group */}
              <div className="inv-field">
                <label className="inv-label">
                  Group <span className="inv-req">*</span>
                </label>
                <div className="inv-scope-select-wrap">
                  <FilterSelect
                    value={scope.groupName}
                    onChange={v => setScope(s => ({ ...s, groupName: v, subGroupName: '', warehouseId: '' }))}
                    options={groups.map(g => ({ value: g.value, label: g.label || g.value }))}
                    placeholder={loadingG ? 'Loading…' : 'Select Group'}
                    disabled={loadingG}
                  />
                  {loadingG && <span className="inv-scope-spinner"/>}
                </div>
              </div>

              {/* Sub-Group */}
              <div className="inv-field">
                <label className="inv-label">Sub-Group (Category)</label>
                <div className="inv-scope-select-wrap">
                  <FilterSelect
                    value={scope.subGroupName}
                    onChange={v => setScope(s => ({ ...s, subGroupName: v, warehouseId: '' }))}
                    options={subGroups.map(sg => ({ value: sg.value, label: sg.label || sg.value }))}
                    placeholder={!scope.groupName ? 'Select Group First' : loadingSG ? 'Loading…' : subGroups.length === 0 ? 'No sub-groups' : 'All Sub-Groups'}
                    disabled={!scope.groupName || loadingSG}
                  />
                  {loadingSG && <span className="inv-scope-spinner"/>}
                </div>
              </div>

              {/* Warehouse */}
              <div className="inv-field">
                <label className="inv-label">
                  Warehouse <span className="inv-req">*</span>
                </label>
                <div className="inv-scope-select-wrap">
                  <FilterSelect
                    value={scope.warehouseId}
                    onChange={v => pickWarehouse(v)}
                    options={warehouseList.map(w => ({ value: w.id, label: w.name + (w.code ? ` (${w.code})` : '') }))}
                    placeholder={!scope.groupName ? 'Select Group First' : loadingWH ? 'Loading…' : warehouseList.length === 0 ? 'No warehouses' : 'Select Warehouse'}
                    disabled={!scope.groupName || loadingWH}
                  />
                  {loadingWH && <span className="inv-scope-spinner"/>}
                </div>
              </div>
            </div>

            {/* Show resolved group/subgroup read-only when warehouse is locked */}
            {scope.warehouseId && (
              <div className="inv-scope-resolved">
                <span className="inv-scope-chip">📁 {scope.groupName || '—'}</span>
                {scope.subGroupName && <><span className="inv-scope-arrow">›</span>
                  <span className="inv-scope-chip">{scope.subGroupName}</span></>}
                <span className="inv-scope-arrow">›</span>
                <span className="inv-scope-chip inv-scope-chip--active">🏬 {selectedWh?.name || '—'}</span>
              </div>
            )}
          </div>

          {/* ── SINGLE mode: one item's details ── */}
          {mode === 'single' && (
            <div className="inv-form-grid" style={{ marginTop: 16 }}>
              <div className="inv-field inv-field--full">
                <div className="inv-item-hint" style={{ marginBottom: 8, background:'#f0f9ff', borderRadius:6, padding:'6px 10px', border:'1px solid #bae6fd' }}>
                  🔑 Item Code is <strong>auto-generated</strong> as <code>WHCODE-NNNNNN</code> after saving
                </div>
              </div>
              <div className="inv-field inv-field--full">
                <label className="inv-label">Item Name <span className="inv-req">*</span></label>
                <input className="inv-input" placeholder="e.g. Solar Panel 550W Mono"
                  value={single.name} onChange={e => setS('name', e.target.value)} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Category</label>
                <FilterSelect
                value={single.category}
                onChange={v => setS('category', v)}
                options={Object.keys(CATEGORY_COLORS).map(c => ({ value: c, label: c }))}
                placeholder="Select Category"
              />
              </div>
              <div className="inv-field">
                <label className="inv-label">Unit</label>
                <FilterSelect
                value={single.unit}
                onChange={v => setS('unit', v)}
                options={UNITS.map(u => ({ value: u, label: u }))}
                placeholder="Select Unit"
              />
              </div>
              <div className="inv-field">
                <label className="inv-label">Opening Qty</label>
                <input className="inv-input" type="number" min="0" placeholder="0"
                  value={single.currentQty} onChange={e => setS('currentQty', e.target.value)} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Unit Cost (₹)</label>
                <input className="inv-input" type="number" min="0" placeholder="0.00"
                  value={single.unitCost} onChange={e => setS('unitCost', e.target.value)} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Min Qty (Reorder Level)</label>
                <input className="inv-input" type="number" min="0" placeholder="0"
                  value={single.minQty} onChange={e => setS('minQty', e.target.value)} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Max Qty</label>
                <input className="inv-input" type="number" min="0" placeholder="0"
                  value={single.maxQty} onChange={e => setS('maxQty', e.target.value)} />
              </div>
              {/* Project ID — hidden for now
              <div className="inv-field">
                <label className="inv-label">Project ID</label>
                <input className="inv-input" placeholder="PROJ-2026-XXXX"
                  value={single.projectId} onChange={e => setS('projectId', e.target.value)} />
              </div>
              */}
              <div className="inv-field inv-field--full">
                <label className="inv-label">Note</label>
                <textarea className="inv-textarea" rows={2} placeholder="Optional description..."
                  value={single.note} onChange={e => setS('note', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── BULK mode: editable grid of rows sharing the scope above ── */}
          {mode === 'bulk' && (
            <div className="inv-bulk-wrap">
              <div className="inv-bulk-toolbar">
                <button type="button" className="inv-btn inv-btn--secondary inv-btn--sm"
                  onClick={() => addRows(1)}>+ Add row</button>
                <button type="button" className="inv-btn inv-btn--secondary inv-btn--sm"
                  onClick={() => addRows(10)}>+ Add 10 rows</button>
                <button type="button" className="inv-btn inv-btn--ghost inv-btn--sm"
                  onClick={clearEmpty}>Clear empty</button>
                <span className="inv-bulk-count">
                  <strong>{validBulkRows.length}</strong> ready · {rows.length} row{rows.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="inv-bulk-scroll">
                <table className="inv-bulk-table">
                  <thead>
                    <tr>
                      <th className="inv-bulk-rownum">#</th>
                      <th className="inv-bulk-col-code">Code <span className="inv-req">*</span></th>
                      <th className="inv-bulk-col-name">Item Name <span className="inv-req">*</span></th>
                      <th className="inv-bulk-col-cat">Category</th>
                      <th className="inv-bulk-col-unit">Unit</th>
                      <th className="inv-bulk-col-num">Opening</th>
                      <th className="inv-bulk-col-num">Cost (₹)</th>
                      <th className="inv-bulk-col-num">Min</th>
                      <th className="inv-bulk-col-num">Max</th>
                      {/* <th className="inv-bulk-col-proj">Project ID</th> */}
                      <th className="inv-bulk-col-note">Note</th>
                      <th className="inv-bulk-col-x"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <React.Fragment key={r._id}>
                        <tr className={r.error ? 'inv-bulk-row--error' : ''}>
                          <td className="inv-bulk-rownum">{idx + 1}</td>
                          <td className="inv-bulk-cell-key">
                            <input className="inv-input" placeholder="EL-001"
                              value={r.itemCode} onChange={e => setRow(r._id, 'itemCode', e.target.value)} />
                          </td>
                          <td className="inv-bulk-cell-key">
                            <input className="inv-input" placeholder="Solar Panel 550W Mono"
                              value={r.name} onChange={e => setRow(r._id, 'name', e.target.value)} />
                          </td>
                          <td>
                            <FilterSelect
                              value={r.category}
                              onChange={v => setRow(r._id, 'category', v)}
                              options={Object.keys(CATEGORY_COLORS).map(c => ({ value: c, label: c }))}
                              placeholder="Category"
                            />
                          </td>
                          <td>
                            <FilterSelect
                              value={r.unit}
                              onChange={v => setRow(r._id, 'unit', v)}
                              options={UNITS.map(u => ({ value: u, label: u }))}
                              placeholder="Unit"
                            />
                          </td>
                          <td>
                            <input className="inv-input" type="number" min="0" placeholder="0"
                              value={r.currentQty} onChange={e => setRow(r._id, 'currentQty', e.target.value)} />
                          </td>
                          <td>
                            <input className="inv-input" type="number" min="0" placeholder="0.00"
                              value={r.unitCost} onChange={e => setRow(r._id, 'unitCost', e.target.value)} />
                          </td>
                          <td>
                            <input className="inv-input" type="number" min="0" placeholder="0"
                              value={r.minQty} onChange={e => setRow(r._id, 'minQty', e.target.value)} />
                          </td>
                          <td>
                            <input className="inv-input" type="number" min="0" placeholder="0"
                              value={r.maxQty} onChange={e => setRow(r._id, 'maxQty', e.target.value)} />
                          </td>
                          {/* Project ID cell — hidden for now
                          <td>
                            <input className="inv-input" placeholder="PROJ-2026-XXXX"
                              value={r.projectId} onChange={e => setRow(r._id, 'projectId', e.target.value)} />
                          </td>
                          */}
                          <td>
                            <input className="inv-input" placeholder="Optional"
                              value={r.note} onChange={e => setRow(r._id, 'note', e.target.value)} />
                          </td>
                          <td className="inv-bulk-col-x">
                            <button type="button" className="inv-bulk-remove" title="Remove row"
                              onClick={() => removeRow(r._id)}>✕</button>
                          </td>
                        </tr>
                        {r.error && (
                          <tr><td colSpan={12} className="inv-bulk-rowmsg">⚠ {r.error}</td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="inv-item-hint" style={{ marginTop: 8 }}>
                Each row needs a Code and Name. Empty rows are ignored. All rows are saved to the warehouse selected above.
              </p>
            </div>
          )}
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          {mode === 'single' ? (
            <button className="inv-btn inv-btn--primary"
              disabled={!scopeReady || !single.name}
              onClick={submitSingle}>
              Add Item
            </button>
          ) : (
            <button className="inv-btn inv-btn--primary"
              disabled={!scopeReady || validBulkRows.length === 0}
              onClick={submitBulk}>
              Add {validBulkRows.length || ''} Item{validBulkRows.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transaction Modal ─────────────────────────────────────────────────────────
function TransactionModal({ open, onClose, onSave, items, warehouses, defaultWarehouseId,
                            defaultGroupName, defaultSubGroupName }) {
  const blankLine    = () => ({ inventoryItemId: '', qty: '', unitCost: '' });
  const blankPoLine  = () => ({ poId: '', poNo: '', poItemId: '', inventoryItemId: '', itemCode: '', itemName: '', unit: '', orderedQty: 0, receivedQty: 0, qty: '', unitCost: '' });
  const blank = () => ({
    type: 'INWARD', itemId: '', qty: '', ref: '', note: '',
    warehouseId: '', groupName: '', subGroupName: '', projectId: '',
    date: new Date().toISOString().slice(0, 10),
    lines:    [blankLine()],    // multi-line for OUTWARD
    poLines:  [blankPoLine()],  // multi-line for INWARD (PO-linked)
  });
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Cascading scope state ────────────────────────────────────────────────
  const [groups,     setGroups]     = useState([]);
  const [subGroups,  setSubGroups]  = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [loadingG,   setLoadingG]   = useState(false);
  const [loadingSG,  setLoadingSG]  = useState(false);
  const [loadingPr,  setLoadingPr]  = useState(false);

  // ── INWARD PO items state ────────────────────────────────────────────────
  const [projectPos,   setProjectPos]   = useState([]);  // POs for selected project
  const [poItemsMap,   setPoItemsMap]   = useState({});  // { poId: [items] }
  const [loadingPos,   setLoadingPos]   = useState(false);
  const [loadingPoItems, setLoadingPoItems] = useState({});

  const isOutward = form.type === 'OUTWARD';
  const isInward  = form.type === 'INWARD';

  // Items available in the selected warehouse (for OUTWARD filtering)
  const warehouseItems = React.useMemo(() => {
    if (!isOutward || !form.warehouseId) return items;
    return items.filter(i => String(i.warehouseId) === String(form.warehouseId));
  }, [isOutward, form.warehouseId, items]);



  const selectedItem = items.find(i => String(i.id) === String(form.itemId));

  // Lock warehouse to item's warehouse when an item is selected (non-outward)
  React.useEffect(() => {
    if (!isOutward && selectedItem) set('warehouseId', String(selectedItem.warehouseId || ''));
  }, [selectedItem?.id, isOutward]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill scope + warehouse from page-level defaults on open
  React.useEffect(() => {
    if (!open) return;
    setForm(f => ({
      ...blank(),
      warehouseId:  defaultWarehouseId ? String(defaultWarehouseId) : '',
      groupName:    defaultGroupName    || '',
      subGroupName: defaultSubGroupName || '',
    }));
  }, [open, defaultWarehouseId, defaultGroupName, defaultSubGroupName]); // eslint-disable-line

  // Load groups whenever modal opens
  React.useEffect(() => {
    if (!open) return;
    setLoadingG(true);
    filterApi.getAllGroups()
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
      .finally(() => setLoadingG(false));
  }, [open]);

  // Cascade group → subgroups
  React.useEffect(() => {
    if (!form.groupName) { setSubGroups([]); setProjects([]); return; }
    setLoadingSG(true);
    filterApi.getSubGroups(form.groupName)
      .then(d => setSubGroups(Array.isArray(d) ? d : []))
      .catch(() => setSubGroups([]))
      .finally(() => setLoadingSG(false));
  }, [form.groupName]);

  // Cascade group + subgroup → projects
  React.useEffect(() => {
    if (!form.groupName) { setProjects([]); return; }
    setLoadingPr(true);
    filterApi.getProjects(form.groupName, form.subGroupName || '')
      .then(d => setProjects(Array.isArray(d) ? d : []))
      .catch(() => setProjects([]))
      .finally(() => setLoadingPr(false));
  }, [form.groupName, form.subGroupName]);

  // ── INWARD: when project selected, load ALL PO items flat for that project ─
  const [allPoItems,   setAllPoItems]   = useState([]);  // flat list of all PO items for project
  const [loadingPoItems2, setLoadingPoItems2] = useState(false);

  React.useEffect(() => {
    if (!isInward || !form.projectId) { setAllPoItems([]); return; }
    setLoadingPoItems2(true);
    fetch(`${API}/purchase-orders/project/${encodeURIComponent(form.projectId)}/all-items`, {
      headers: getAuthHeaders(), credentials: 'include'
    })
      .then(r => r.json())
      .then(d => setAllPoItems(Array.isArray(d) ? d : []))
      .catch(() => setAllPoItems([]))
      .finally(() => setLoadingPoItems2(false));
  }, [isInward, form.projectId]); // eslint-disable-line

  if (!open) return null;

  // ── Line-item helpers (OUTWARD) ──────────────────────────────────────────
  const setLine  = (idx, k, v) => setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, [k]: v } : l) }));
  const addLine  = () => setForm(f => ({ ...f, lines: [...f.lines, blankLine()] }));
  const delLine  = (idx) => setForm(f => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== idx) : f.lines }));

  const pickLineItem = (idx, itemId) => {
    const it = items.find(i => String(i.id) === String(itemId));
    if (it) setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? {
      ...l,
      inventoryItemId: it.id,
      unitCost: it.unitCost != null ? String(it.unitCost) : '',
    } : l) }));
    else setLine(idx, 'inventoryItemId', itemId);
  };

  // ── PO-Line helpers (INWARD) — flat single-step item picker ─────────────
  const setPoLine  = (idx, k, v) => setForm(f => ({ ...f, poLines: f.poLines.map((l, i) => i === idx ? { ...l, [k]: v } : l) }));
  const addPoLine  = () => setForm(f => ({ ...f, poLines: [...f.poLines, blankPoLine()] }));
  const delPoLine  = (idx) => setForm(f => ({ ...f, poLines: f.poLines.length > 1 ? f.poLines.filter((_, i) => i !== idx) : f.poLines }));

  const pickFlatPoItem = (idx, poItemId) => {
    const pi = allPoItems.find(p => String(p.id) === String(poItemId));
    if (!pi) return;
    const invItem = items.find(i => i.itemCode === pi.itemCode ||
      (pi.inventoryItemId && String(i.id) === String(pi.inventoryItemId)));
    setForm(f => ({
      ...f,
      poLines: f.poLines.map((l, i) => i === idx ? {
        ...l,
        poItemId:        String(poItemId),
        poId:            String(pi.poId || ''),
        poNo:            pi.poNo || '',
        inventoryItemId: invItem ? String(invItem.id) : null,
        itemCode:        pi.itemCode || '',
        itemName:        pi.itemName || '',
        unit:            pi.unit || '',
        orderedQty:      Number(pi.orderedQty || 0),
        receivedQty:     Number(pi.receivedQty || 0),
        unitCost:        String(pi.unitPrice || invItem?.unitCost || ''),
        qty:             String(pi.pendingQty && Number(pi.pendingQty) > 0 ? pi.pendingQty : ''),
      } : l)
    }));
  };

  const inwardTotal = (form.poLines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);

  const outwardTotal = (form.lines || []).reduce((s, l) => {
    return s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
  }, 0);

  const handleGroupChange = (val) => {
    setForm(f => ({ ...f, groupName: val, subGroupName: '', projectId: '' }));
    setSubGroups([]); setProjects([]);
  };
  const handleSubGroupChange = (val) => {
    setForm(f => ({ ...f, subGroupName: val, projectId: '' }));
    setProjects([]);
  };

  const canSave = isOutward
    ? (form.warehouseId && form.projectId && (form.lines || []).some(l => l.inventoryItemId && l.qty))
    : isInward
      ? (form.warehouseId && (form.poLines || []).some(l => l.poItemId && l.qty))
        || (form.itemId && form.qty)   // fallback: plain inward without PO
      : (form.itemId && form.qty);

  const modalSize = (isOutward || isInward) ? 'inv-modal--lg' : 'inv-modal--sm';

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className={`inv-modal ${modalSize}`} onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Record Transaction</h3>
            <p className="inv-modal-sub">Inward, outward, or adjustment</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          {/* Transaction type pills */}
          <div className="inv-field">
            <label className="inv-label">Transaction Type</label>
            <div className="inv-type-pills">
              {Object.entries(TXN_TYPES).map(([k, v]) => (
                <button key={k}
                  className={`inv-type-pill${form.type === k ? ' active' : ''}`}
                  style={form.type === k ? { background: v.bg, color: v.color, borderColor: v.color + '88' } : {}}
                  onClick={() => set('type', k)}>
                  <span className="inv-type-icon">{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="inv-form-grid">
            {/* ── Scope: Group → Sub-Group → Project ── */}
            <div className="inv-field">
              <label className="inv-label">Group</label>
              <FilterSelect
                value={form.groupName}
                onChange={v => handleGroupChange(v)}
                options={groups.map(g => ({ value: g.value, label: g.label }))}
                placeholder={loadingG ? 'Loading…' : 'All Groups'}
                disabled={loadingG}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Sub-Group</label>
              <FilterSelect
                value={form.subGroupName}
                onChange={v => handleSubGroupChange(v)}
                options={subGroups.map(s => ({ value: s.value, label: s.label }))}
                placeholder={!form.groupName ? 'Select Group First' : loadingSG ? 'Loading…' : 'All Sub-Groups'}
                disabled={!form.groupName || loadingSG}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Project {isOutward && <span className="inv-req">*</span>}</label>
              <FilterSelect
                searchable
                value={form.projectId}
                onChange={v => set('projectId', v)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder={!form.groupName ? 'Select Group First' : loadingPr ? 'Loading…' : 'No Project'}
                disabled={!form.groupName || loadingPr}
              />
            </div>

            {/* Warehouse (always shown; for OUTWARD it filters items) */}
            <div className="inv-field">
              <label className="inv-label">Warehouse <span className="inv-req">*</span></label>
              <FilterSelect
                value={form.warehouseId}
                onChange={v => {
                  set('warehouseId', v);
                  // Reset line items when warehouse changes so stale items are cleared
                  if (isOutward) setForm(f => ({ ...f, warehouseId: v, lines: [blankLine()] }));
                }}
                options={warehouses.map(w => ({ value: String(w.id), label: w.name + (w.code ? ` (${w.code})` : '') }))}
                placeholder="Select warehouse…"
                disabled={!isOutward && !!selectedItem}
              />
              {isOutward && form.warehouseId && (
                <div className="inv-item-hint" style={{ marginTop: 4 }}>
                  Items below are filtered to this warehouse ({warehouseItems.length} available)
                </div>
              )}
              {!isOutward && selectedItem && (
                <div className="inv-item-hint" style={{ marginTop: 4 }}>Auto-set from item's warehouse</div>
              )}
            </div>

            {/* Date, ref — always shown */}
            <div className="inv-field">
              <label className="inv-label">Date</label>
              <input className="inv-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Reference (PO / GRN / Issue No.)</label>
              <input className="inv-input" placeholder="e.g. INV-PO-2026-00041"
                value={form.ref} onChange={e => set('ref', e.target.value)} />
            </div>
          </div>

          {/* ── OUTWARD: multi-line items table ─────────────────────────── */}
          {isOutward && (
            <div className="inv-lineitems-wrap">
              <div className="inv-lineitems-head">
                <h4 className="inv-lineitems-title">Items to Issue</h4>
                <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={addLine}>+ Add Line</button>
              </div>
              <div className="inv-lineitems-table">
                <div className="inv-lineitems-row inv-lineitems-row--head">
                  <div>Item</div>
                  <div style={{ textAlign: 'right' }}>Available Stock</div>
                  <div style={{ textAlign: 'right' }}>Qty <span className="inv-req">*</span></div>
                  <div>Unit</div>
                  <div style={{ textAlign: 'right' }}>Unit Cost (₹)</div>
                  <div style={{ textAlign: 'right' }}>Subtotal</div>
                  <div></div>
                </div>
                {(form.lines || []).map((l, idx) => {
                  const selItem = items.find(i => String(i.id) === String(l.inventoryItemId));
                  const subtotal = (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
                  return (
                    <div key={idx} className="inv-lineitems-row">
                      <FilterSelect
                        searchable
                        value={l.inventoryItemId ? String(l.inventoryItemId) : ''}
                        onChange={v => pickLineItem(idx, v)}
                        options={warehouseItems.map(i => ({
                          value: String(i.id),
                          label: `${i.itemCode} — ${i.name}`,
                        }))}
                        placeholder={form.warehouseId ? 'Search item…' : 'Select warehouse first'}
                        disabled={!form.warehouseId}
                      />
                      <div className="inv-lineitems-subtotal" style={{ color: '#64748b', fontSize: 12 }}>
                        {selItem ? `${fmt(selItem.currentQty)} ${selItem.unit}` : '—'}
                      </div>
                      <input className="inv-input inv-input--sm" type="number" min="0.01" step="0.01"
                        style={{ textAlign: 'right' }} placeholder="0"
                        value={l.qty} onChange={e => setLine(idx, 'qty', e.target.value)} />
                      <div className="inv-lineitems-subtotal" style={{ color: '#64748b', fontSize: 12 }}>
                        {selItem?.unit || '—'}
                      </div>
                      <input className="inv-input inv-input--sm" type="number" min="0" step="0.01"
                        style={{ textAlign: 'right' }} placeholder="0"
                        value={l.unitCost} onChange={e => setLine(idx, 'unitCost', e.target.value)} />
                      <div className="inv-lineitems-subtotal">{subtotal > 0 ? fmtCcy(subtotal.toFixed(2)) : '—'}</div>
                      <button className="inv-lineitems-del" onClick={() => delLine(idx)} title="Remove line">✕</button>
                    </div>
                  );
                })}
              </div>
              <div className="inv-lineitems-total">
                <span>Total Issuance Value</span>
                <strong>{fmtCcy(outwardTotal.toFixed(2))}</strong>
              </div>
            </div>
          )}

          {/* ── INWARD: PO-linked multi-line ─────────────────────────── */}
          {isInward && (
            <>
              <div className="inv-lineitems-wrap">
                <div className="inv-lineitems-head">
                  <h4 className="inv-lineitems-title">Items Received from Site</h4>
                  <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={addPoLine}>+ Add Line</button>
                </div>
                {form.projectId ? (
                  <>
                    {loadingPoItems2 && (
                      <div style={{ padding:'12px 16px', color:'#6366f1', fontSize:13 }}>⏳ Loading PO items…</div>
                    )}
                    {!loadingPoItems2 && allPoItems.length === 0 && (
                      <div style={{ padding:'16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                        No PO items found for this project
                      </div>
                    )}
                    {!loadingPoItems2 && allPoItems.length > 0 && (
                      <>
                        <div className="inv-lineitems-table">
                          <div className="inv-lineitems-row inv-lineitems-row--head">
                            <div>PO Item (PO No — Item)</div>
                            <div style={{ textAlign:'right' }}>Ordered</div>
                            <div style={{ textAlign:'right' }}>Rcvd</div>
                            <div style={{ textAlign:'right' }}>Qty In <span className="inv-req">*</span></div>
                            <div>Unit</div>
                            <div style={{ textAlign:'right' }}>Unit Cost</div>
                            <div style={{ textAlign:'right' }}>Value</div>
                            <div></div>
                          </div>
                          {(form.poLines || []).map((l, idx) => {
                            const subtotal = (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
                            return (
                              <div key={idx} className="inv-lineitems-row">
                                <FilterSelect
                                  searchable
                                  value={l.poItemId || ''}
                                  onChange={v => pickFlatPoItem(idx, v)}
                                  options={allPoItems.map(pi => ({
                                    value: String(pi.id),
                                    label: `${pi.poNo || 'PO'} · ${pi.itemCode} — ${pi.itemName}`,
                                  }))}
                                  placeholder="Search item…"
                                />
                                <div className="inv-lineitems-subtotal" style={{ fontSize:11, color:'#64748b' }}>{l.orderedQty || '—'}</div>
                                <div className="inv-lineitems-subtotal" style={{ fontSize:11, color:'#64748b' }}>{l.receivedQty || '—'}</div>
                                <input className="inv-input inv-input--sm" type="number" min="0.01" step="0.01"
                                  style={{ textAlign:'right' }} placeholder="0"
                                  value={l.qty} onChange={e => setPoLine(idx, 'qty', e.target.value)} />
                                <div className="inv-lineitems-subtotal" style={{ fontSize:11, color:'#64748b' }}>{l.unit || '—'}</div>
                                <input className="inv-input inv-input--sm" type="number" min="0" step="0.01"
                                  style={{ textAlign:'right' }} placeholder="0"
                                  value={l.unitCost} onChange={e => setPoLine(idx, 'unitCost', e.target.value)} />
                                <div className="inv-lineitems-subtotal">{subtotal > 0 ? fmtCcy(subtotal.toFixed(2)) : '—'}</div>
                                <button className="inv-lineitems-del" onClick={() => delPoLine(idx)} title="Remove">✕</button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="inv-lineitems-total">
                          <span>Total Inward Value</span>
                          <strong>{fmtCcy(inwardTotal.toFixed(2))}</strong>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ padding:'16px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                    Select a project above to load procurement items
                  </div>
                )}
              </div>
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginTop:8, fontSize:12, color:'#166534' }}>
                💡 Items will be received into the selected warehouse. If an item is not yet in inventory, it will be created automatically.
              </div>
            </>
          )}

          {/* ── Non-OUTWARD, Non-INWARD: single item (Adjustment, Transfer, Return) */}
          {!isOutward && !isInward && (
            <div className="inv-form-grid">
              <div className="inv-field inv-field--full">
                <label className="inv-label">Item <span className="inv-req">*</span></label>
                <FilterSelect
                  searchable
                  value={form.itemId}
                  onChange={v => set('itemId', v)}
                  options={items.map(i => ({ value: String(i.id), label: `${i.itemCode} — ${i.name}` }))}
                  placeholder="Select item…"
                />
                {selectedItem && (
                  <div className="inv-item-hint">
                    Current stock: <strong>{fmt(selectedItem.currentQty)} {selectedItem.unit}</strong>
                    &nbsp;·&nbsp;Location: {selectedItem.location}
                  </div>
                )}
              </div>
              <div className="inv-field">
                <label className="inv-label">Quantity <span className="inv-req">*</span></label>
                <input className="inv-input" type="number" min="0.01" step="0.01" placeholder="0"
                  value={form.qty} onChange={e => set('qty', e.target.value)} />
              </div>
            </div>
          )}

          {/* Note — always shown */}
          <div className="inv-form-grid" style={{ marginTop: isOutward ? 8 : 0 }}>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Note</label>
              <textarea className="inv-textarea" rows={2} placeholder="Reason / details…"
                value={form.note} onChange={e => set('note', e.target.value)} />
            </div>
          </div>

          {/* OUTWARD info banner */}
          {isOutward && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginTop: 8, fontSize: 12, color: '#1e40af' }}>
              💡 An auto-generated bill will be recorded under this project for cost tracking. Payment is marked as <strong>Paid</strong> since items are issued from already-purchased warehouse stock.
            </div>
          )}
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            disabled={!canSave}
            onClick={() => { onSave(form); onClose(); }}>
            {isOutward ? 'Issue Items' : isInward ? 'Receive Items' : 'Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── View Transaction Modal ────────────────────────────────────────────────────
function ViewTransactionModal({ open, onClose, txn, warehouses, items }) {
  if (!open || !txn) return null;
  const TXN_META = TXN_TYPES[txn.type] || TXN_TYPES.INWARD;
  const wh = warehouses.find(w => String(w.id) === String(txn.warehouseId));
  const item = items.find(i => String(i.id) === String(txn.inventoryItemId));
  const isVoided = txn.note && txn.note.startsWith('VOIDED');
  const rows = [
    ['Transaction No', txn.txnNo || txn.id],
    ['Type', <span style={{ background: TXN_META.bg, color: TXN_META.color, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 12 }}>{TXN_META.icon} {TXN_META.label}</span>],
    ['Date', txn.date || txn.transactionDate || '—'],
    ['Item Code', txn.itemCode || '—'],
    ['Item Name', txn.itemName || '—'],
    ['Quantity', <span style={{ fontWeight: 700, color: ['OUTWARD','TRANSFER'].includes(txn.type) ? '#ef4444' : '#166534' }}>{txn.qty > 0 && !['OUTWARD','TRANSFER'].includes(txn.type) ? '+' : ''}{fmt(txn.qty)} {txn.unit}</span>],
    ['Warehouse', wh ? `${wh.name}${wh.code ? ` (${wh.code})` : ''}` : (txn.warehouseName || '—')],
    ['Project', txn.projectId || '—'],
    ['Group', txn.groupName || '—'],
    ['Sub-Group', txn.subGroupName || '—'],
    ['Reference', txn.ref || txn.refNo || '—'],
    ['Note', txn.note || txn.notes || '—'],
    ['Created By', txn.by || txn.createdByName || '—'],
  ];
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Transaction Detail</h3>
            <p className="inv-modal-sub">{txn.txnNo || `ID: ${txn.id}`}</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="inv-modal-body">
          {isVoided && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', marginBottom:12, color:'#dc2626', fontWeight:600, fontSize:12 }}>
              ⚠️ This transaction has been VOIDED
            </div>
          )}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <tbody>
              {rows.map(([label, val], i) => (
                <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'8px 12px 8px 0', color:'#64748b', fontWeight:600, whiteSpace:'nowrap', width:'40%' }}>{label}</td>
                  <td style={{ padding:'8px 0', color:'#1e293b' }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {item && (
            <div style={{ marginTop:14, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
              <div style={{ fontWeight:600, color:'#475569', marginBottom:6 }}>Current Stock Status</div>
              <div style={{ display:'flex', gap:16 }}>
                <span>Stock: <strong style={{ color:'#1e40af' }}>{fmt(item.currentQty)} {item.unit}</strong></span>
                <span>Unit Cost: <strong style={{ color:'#065f46' }}>{fmtCcy(item.unitCost)}</strong></span>
              </div>
            </div>
          )}
        </div>
        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Transaction Modal ────────────────────────────────────────────────────
// Only editable fields: date, ref, note, projectId, group, subgroup
// Qty / item / warehouse / type are IMMUTABLE after creation (would break stock ledger)
function EditTransactionModal({ open, onClose, onSave, txn, items, warehouses }) {
  const [form, setForm] = useState({});
  const [groups,    setGroups]    = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [lgG, setLgG] = useState(false);
  const [lgSG,setLgSG]= useState(false);
  const [lgPr,setLgPr]= useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (!open || !txn) return;
    setForm({
      id:           txn.id,
      txnNo:        txn.txnNo,
      date:         txn.date || txn.transactionDate || new Date().toISOString().slice(0,10),
      ref:          txn.ref || txn.refNo || '',
      note:         txn.note || txn.notes || '',
      projectId:    txn.projectId || '',
      groupName:    txn.groupName || '',
      subGroupName: txn.subGroupName || '',
    });
    setLgG(true);
    filterApi.getAllGroups().then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => setGroups([])).finally(() => setLgG(false));
  }, [open, txn]);

  React.useEffect(() => {
    if (!form.groupName) { setSubGroups([]); setProjects([]); return; }
    setLgSG(true);
    filterApi.getSubGroups(form.groupName).then(d => setSubGroups(Array.isArray(d) ? d : [])).catch(() => setSubGroups([])).finally(() => setLgSG(false));
  }, [form.groupName]);

  React.useEffect(() => {
    if (!form.groupName) { setProjects([]); return; }
    setLgPr(true);
    filterApi.getProjects(form.groupName, form.subGroupName || '').then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => setProjects([])).finally(() => setLgPr(false));
  }, [form.groupName, form.subGroupName]);

  if (!open || !txn) return null;
  const TXN_META = TXN_TYPES[txn.type] || TXN_TYPES.INWARD;
  const wh = warehouses.find(w => String(w.id) === String(txn.warehouseId));

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Edit Transaction</h3>
            <p className="inv-modal-sub">{txn.txnNo} · <span style={{ background: TXN_META.bg, color: TXN_META.color, padding:'1px 8px', borderRadius:8, fontSize:11 }}>{TXN_META.icon} {TXN_META.label}</span></p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="inv-modal-body">
          {/* Read-only info row */}
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <span><strong>Item:</strong> {txn.itemCode} — {txn.itemName}</span>
              <span><strong>Qty:</strong> {fmt(txn.qty)} {txn.unit}</span>
              <span><strong>Warehouse:</strong> {wh?.name || txn.warehouseName || '—'}</span>
            </div>
            <div style={{ marginTop:4, color:'#94a3b8', fontSize:11 }}>Qty, item and warehouse cannot be changed after creation</div>
          </div>

          <div className="inv-form-grid">
            <div className="inv-field">
              <label className="inv-label">Date</label>
              <input className="inv-input" type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Reference</label>
              <input className="inv-input" placeholder="PO / GRN / Issue No." value={form.ref || ''} onChange={e => set('ref', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Group</label>
              <FilterSelect value={form.groupName} onChange={v => setForm(f => ({ ...f, groupName: v, subGroupName:'', projectId:'' }))}
                options={groups.map(g => ({ value: g.value, label: g.label }))}
                placeholder={lgG ? 'Loading…' : 'All Groups'} disabled={lgG} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Sub-Group</label>
              <FilterSelect value={form.subGroupName} onChange={v => setForm(f => ({ ...f, subGroupName: v, projectId:'' }))}
                options={subGroups.map(s => ({ value: s.value, label: s.label }))}
                placeholder={!form.groupName ? 'Select Group First' : lgSG ? 'Loading…' : 'All Sub-Groups'}
                disabled={!form.groupName || lgSG} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Project</label>
              <FilterSelect searchable value={form.projectId} onChange={v => set('projectId', v)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder={!form.groupName ? 'Select Group First' : lgPr ? 'Loading…' : 'No Project'}
                disabled={!form.groupName || lgPr} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Note</label>
              <textarea className="inv-textarea" rows={2} placeholder="Reason / details…"
                value={form.note || ''} onChange={e => set('note', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            onClick={() => { onSave(form); onClose(); }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item Detail Drawer ────────────────────────────────────────────────────────
// ── Item Detail Page (full-page overlay, like Leads-Enquiry) ─────────────────
// ── Item Detail — Nav bar (renders inside inv-sticky-top) ───────────────────
function ItemDetailNav({ item, onBack, onEdit, canEdit, activeTab, onTabChange }) {
  if (!item) return null;
  const statMeta = STOCK_STATUS[item.status] || STOCK_STATUS.IN_STOCK;
  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px 8px', borderBottom:'1px solid #f1f5f9', background:'#fff' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'1.5px solid #e2e8f0', cursor:'pointer', color:'#475569', fontSize:13, padding:'5px 10px', borderRadius:7, fontFamily:'inherit', fontWeight:600 }}>
          ← Back to Inventory
        </button>
        <span style={{ color:'#e2e8f0', fontSize:16, margin:'0 2px' }}>|</span>
        <span style={{ fontFamily:'monospace', background:'#f1f5f9', padding:'2px 8px', borderRadius:5, fontSize:12, fontWeight:700, color:'#475569' }}>
          {item.itemCode}
        </span>
        <span style={{ fontWeight:700, color:'#0f172a', fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:300 }}>{item.name}</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span className="inv-status-badge" style={{ background:statMeta.bg, color:statMeta.color }}>{statMeta.label}</span>
          {canEdit && (
            <button className="inv-btn inv-btn--secondary inv-btn--sm"
              style={{ display:'inline-flex', alignItems:'center', gap:5 }}
              onClick={() => onEdit && onEdit(item)}>
              <Edit2 size={13}/> Edit Item
            </button>
          )}
        </div>
      </div>
      <div className="inv-tabs" style={{ marginBottom:0 }}>
        {[['overview','Overview'],['transactions','Transactions'],['stock','Stock Level']].map(([k,l]) => (
          <button key={k} className={`inv-tab ${activeTab===k?'active':''}`} onClick={() => onTabChange(k)}>{l}</button>
        ))}
      </div>
    </>
  );
}

// ── Item Detail — Content (renders inside inv-scroll-area) ────────────────────
function ItemDetailContent({ item, transactions, warehouses, activeTab }) {
  if (!item) return null;

  const catMeta  = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
  const statMeta = STOCK_STATUS[item.status]       || STOCK_STATUS.IN_STOCK;
  const itemTxns = transactions.filter(t => t.itemCode === item.itemCode);
  const totalValue = (item.currentQty || 0) * (item.unitCost || 0);
  const wh = warehouses.find(w => w.id === item.warehouseId || String(w.id) === String(item.warehouseId));
  const safeMax  = item.maxQty && item.maxQty > 0 ? item.maxQty : 1;
  const stockPct = Math.min(100, ((item.currentQty || 0) / safeMax) * 100);
  const minPct   = Math.min(100, ((item.minQty || 0) / safeMax) * 100);

  return (
    <div style={{ padding: '20px 24px' }}>

      {activeTab === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:16, marginBottom:24 }}>
            {[
              { label:'Current Stock', value:`${fmt(item.currentQty)} ${item.unit}`, color:'#1e40af', bg:'#eff6ff' },
              { label:'Unit Cost',     value:fmtCcy(item.unitCost),                  color:'#065f46', bg:'#ecfdf5' },
              { label:'Total Value',   value:fmtCcy(totalValue),                     color:'#7c3aed', bg:'#f5f3ff' },
              { label:'Reorder Level', value:`${fmt(item.minQty)} ${item.unit}`,      color:'#92400e', bg:'#fef3c7' },
              { label:'Max Level',     value:`${fmt(item.maxQty)} ${item.unit}`,      color:'#334155', bg:'#f1f5f9' },
            ].map(c => (
              <div key={c.label} style={{ background:'#fff', borderRadius:10, padding:'16px 18px', border:'1.5px solid #e2e8f0', borderLeft:`4px solid ${c.color}` }}>
                <div style={{ fontSize:20, fontWeight:800, color:'#0f172a' }}>{c.value}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4, fontWeight:600 }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ background:'#fff', borderRadius:10, border:'1.5px solid #e2e8f0', padding:20 }}>
              <div style={{ fontWeight:700, color:'#0f172a', marginBottom:16, fontSize:14, borderBottom:'1px solid #f1f5f9', paddingBottom:10 }}>Item Details</div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  {[
                    ['Item Code',   item.itemCode],
                    ['Item Name',   item.name],
                    ['Category',    <span key="cat" className="inv-cat-badge" style={{ background:catMeta.bg, color:catMeta.color, borderColor:catMeta.border }}>{item.category}</span>],
                    ['Unit',        item.unit],
                    ['Project',     item.projectId || '—'],
                    ['Group',       item.groupName || '—'],
                    ['Sub-Group',   item.subGroupName || '—'],
                    ['Warehouse',   wh ? `${wh.name}${wh.code ? ` (${wh.code})` : ''}` : (item.location||'—')],
                    ['Status',      <span key="st" className="inv-status-badge" style={{ background:statMeta.bg, color:statMeta.color }}>{statMeta.label}</span>],
                    ['Last Updated',item.lastUpdated ? String(item.lastUpdated).slice(0,10) : '—'],
                    ['Notes',       item.notes || '—'],
                  ].map(([k,v]) => (
                    <tr key={k} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'9px 0', color:'#64748b', fontSize:13, fontWeight:600, width:'40%', paddingRight:12 }}>{k}</td>
                      <td style={{ padding:'9px 0', fontSize:13, color:'#0f172a', fontWeight:500 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background:'#fff', borderRadius:10, border:'1.5px solid #e2e8f0', padding:20 }}>
              <div style={{ fontWeight:700, color:'#0f172a', marginBottom:16, fontSize:14, borderBottom:'1px solid #f1f5f9', paddingBottom:10 }}>
                Recent Transactions <span style={{ color:'#94a3b8', fontWeight:400 }}>({itemTxns.length})</span>
              </div>
              {itemTxns.length === 0 ? (
                <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>No transactions yet for this item.</div>
              ) : (
                <div style={{ maxHeight:340, overflowY:'auto' }}>
                  {itemTxns.slice(0,20).map(t => {
                    const tm = TXN_TYPES[t.type] || TXN_TYPES.INWARD;
                    return (
                      <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #f8fafc' }}>
                        <span className="inv-txn-type" style={{ background:tm.bg, color:tm.color, fontSize:11, flexShrink:0 }}>{tm.icon} {tm.label}</span>
                        <span style={{ fontWeight:700, color:Number(t.qty)<0?'#ef4444':'#166534', fontSize:13 }}>
                          {Number(t.qty)>0?'+':''}{fmt(t.qty)} {t.unit}
                        </span>
                        <span style={{ color:'#64748b', fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.ref||''}</span>
                        <span style={{ color:'#94a3b8', fontSize:12, flexShrink:0 }}>{t.date}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'transactions' && (
        <div style={{ background:'#fff', borderRadius:10, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:14 }}>
            Transaction History — {item.itemCode}
            <span style={{ fontWeight:400, color:'#64748b', marginLeft:8 }}>({itemTxns.length} records)</span>
          </div>
          {itemTxns.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No transactions for this item.</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['#','Date','Type','Qty','Unit','Reference','Project','Note','By'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:h==='Qty'?'right':'left', fontSize:12, fontWeight:700, color:'#475569', borderBottom:'1.5px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemTxns.map((t,i) => {
                  const tm = TXN_TYPES[t.type] || TXN_TYPES.INWARD;
                  return (
                    <tr key={t.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'9px 12px', color:'#94a3b8', fontSize:12 }}>{i+1}</td>
                      <td style={{ padding:'9px 12px', color:'#64748b', fontSize:13 }}>{t.date}</td>
                      <td style={{ padding:'9px 12px' }}><span className="inv-txn-type" style={{ background:tm.bg, color:tm.color, fontSize:11 }}>{tm.icon} {tm.label}</span></td>
                      <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, color:Number(t.qty)<0?'#ef4444':'#166534', fontSize:13 }}>
                        {Number(t.qty)>0&&!['OUTWARD','TRANSFER'].includes(t.type)?'+':''}{fmt(t.qty)}
                      </td>
                      <td style={{ padding:'9px 12px', color:'#64748b', fontSize:13 }}>{t.unit}</td>
                      <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:12, color:'#475569' }}>{t.ref||'—'}</td>
                      <td style={{ padding:'9px 12px', color:'#64748b', fontSize:13 }}>{t.projectId||'—'}</td>
                      <td style={{ padding:'9px 12px', color:'#64748b', fontSize:13, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.note}>{t.note||'—'}</td>
                      <td style={{ padding:'9px 12px', color:'#94a3b8', fontSize:12 }}>{t.by}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'stock' && (
        <div style={{ background:'#fff', borderRadius:10, border:'1.5px solid #e2e8f0', padding:28 }}>
          <div style={{ fontWeight:700, color:'#0f172a', marginBottom:24, fontSize:15 }}>Stock Level Analysis</div>
          <div style={{ marginBottom:32 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontWeight:600, color:'#0f172a' }}>Current Level</span>
              <span style={{ fontWeight:800, fontSize:16, color: item.status==='OUT_OF_STOCK'?'#ef4444':item.status==='LOW_STOCK'?'#f59e0b':'#10b981' }}>
                {fmt(item.currentQty)} / {fmt(item.maxQty)} {item.unit} ({stockPct.toFixed(1)}%)
              </span>
            </div>
            <div style={{ position:'relative', height:20, background:'#f1f5f9', borderRadius:10, overflow:'hidden' }}>
              <div style={{ position:'absolute', height:'100%', width:`${stockPct}%`, background: item.status==='OUT_OF_STOCK'?'#ef4444':item.status==='LOW_STOCK'?'#f59e0b':'#10b981', borderRadius:10, transition:'width .4s' }} />
              <div style={{ position:'absolute', left:`${minPct}%`, top:0, height:'100%', width:2, background:'#f97316' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:12, color:'#94a3b8' }}>
              <span>0</span>
              <span style={{ color:'#f97316' }}>Reorder: {fmt(item.minQty)} {item.unit}</span>
              <span>Max: {fmt(item.maxQty)} {item.unit}</span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { label:'On Hand',       value:`${fmt(item.currentQty)} ${item.unit}`, icon:'📦', color:'#1e40af' },
              { label:'Reorder Point', value:`${fmt(item.minQty)} ${item.unit}`,     icon:'🔔', color:'#f97316' },
              { label:'Max Capacity',  value:`${fmt(item.maxQty)} ${item.unit}`,     icon:'📊', color:'#7c3aed' },
            ].map(c => (
              <div key={c.label} style={{ padding:'20px', background:'#f8fafc', borderRadius:8, textAlign:'center', border:'1.5px solid #e2e8f0' }}>
                <div style={{ fontSize:28 }}>{c.icon}</div>
                <div style={{ fontSize:20, fontWeight:800, color:c.color, marginTop:8 }}>{c.value}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit Item Modal (pre-fills all fields, item code shown read-only) ─────────
function EditItemModal({ open, onClose, onSave, item, warehouses }) {
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cascading scope state
  const [groups,    setGroups]    = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [whList,    setWhList]    = useState([]);
  const [loadingG,  setLoadingG]  = useState(false);
  const [loadingSG, setLoadingSG] = useState(false);
  const [loadingPr, setLoadingPr] = useState(false);
  const [loadingWH, setLoadingWH] = useState(false);
  const whReqRef = useRef(0);

  // Pre-fill all fields when modal opens
  useEffect(() => {
    if (!open || !item) return;
    setForm({
      itemCode:    item.itemCode    || '',
      name:        item.name        || '',
      category:    item.category    || 'Electrical',
      unit:        item.unit        || 'Nos',
      currentQty:  item.currentQty  ?? 0,
      unitCost:    item.unitCost    ?? 0,
      minQty:      item.minQty      ?? 0,
      maxQty:      item.maxQty      ?? 0,
      groupName:   item.groupName   || '',
      subGroupName:item.subGroupName|| '',
      warehouseId: item.warehouseId ? String(item.warehouseId) : '',
      projectId:   item.projectId   || '',
      isActive:    item.isActive    !== false,
      notes:       item.notes       || '',
    });
  }, [open, item]);

  // Load groups on open
  useEffect(() => {
    if (!open) return;
    setLoadingG(true);
    filterApi.getAllGroups()
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
      .finally(() => setLoadingG(false));
  }, [open]);

  // Cascade group → subgroups
  useEffect(() => {
    if (!form.groupName) { setSubGroups([]); setProjects([]); return; }
    setLoadingSG(true);
    filterApi.getSubGroups(form.groupName)
      .then(d => setSubGroups(Array.isArray(d) ? d : []))
      .catch(() => setSubGroups([]))
      .finally(() => setLoadingSG(false));
  }, [form.groupName]);

  // Cascade group + subgroup → warehouses
  useEffect(() => {
    if (!form.groupName) { setWhList([]); return; }
    const id = ++whReqRef.current;
    setLoadingWH(true);
    const params = new URLSearchParams();
    params.append('groupName', form.groupName);
    if (form.subGroupName) params.append('subGroupName', form.subGroupName);
    fetch(`${API}/warehouses?${params}`, { headers: getAuthHeaders(), credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (id === whReqRef.current) setWhList(Array.isArray(d) ? d : []); })
      .catch(() => { if (id === whReqRef.current) setWhList([]); })
      .finally(() => { if (id === whReqRef.current) setLoadingWH(false); });
  }, [form.groupName, form.subGroupName]);

  // Cascade group + subgroup → projects
  useEffect(() => {
    if (!form.groupName) { setProjects([]); return; }
    setLoadingPr(true);
    filterApi.getProjects(form.groupName, form.subGroupName || '')
      .then(d => setProjects(Array.isArray(d) ? d : []))
      .catch(() => setProjects([]))
      .finally(() => setLoadingPr(false));
  }, [form.groupName, form.subGroupName]);

  if (!open || !item) return null;

  const selectedWh = whList.find(w => String(w.id) === String(form.warehouseId))
                  || warehouses.find(w => String(w.id) === String(form.warehouseId));

  const handleGroupChange = (val) => {
    setForm(f => ({ ...f, groupName: val, subGroupName: '', warehouseId: '', projectId: '' }));
  };
  const handleSubGroupChange = (val) => {
    setForm(f => ({ ...f, subGroupName: val, warehouseId: '', projectId: '' }));
  };
  const pickWarehouse = (val) => {
    const wh = whList.find(w => String(w.id) === String(val));
    setForm(f => ({
      ...f,
      warehouseId:  val,
      groupName:    wh?.groupName    || f.groupName,
      subGroupName: wh?.subGroupName || f.subGroupName,
    }));
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Edit Item</h3>
            <p className="inv-modal-sub">
              <span style={{ fontFamily:'monospace', background:'#f1f5f9', padding:'2px 7px', borderRadius:5, fontWeight:700 }}>
                {item.itemCode}
              </span>
              &nbsp;·&nbsp;{selectedWh?.name || warehouses.find(w => String(w.id) === String(item.warehouseId))?.name || 'Unknown warehouse'}
            </p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">

          {/* ── Section: Scope ─────────────────────────────────────────────── */}
          <div className="inv-scope-section" style={{ marginBottom: 16 }}>
            <div className="inv-scope-title">
              Scope &nbsp;<span className="inv-muted-sm">— determines where this item appears in filters</span>
            </div>
            <div className="inv-scope-grid">
              <div className="inv-field">
                <label className="inv-label">Group <span className="inv-req">*</span></label>
                <FilterSelect value={form.groupName} onChange={handleGroupChange}
                  options={groups.map(g => ({ value: g.value, label: g.label || g.value }))}
                  placeholder={loadingG ? 'Loading…' : 'Select Group'} disabled={loadingG} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Sub-Group</label>
                <FilterSelect value={form.subGroupName} onChange={handleSubGroupChange}
                  options={subGroups.map(s => ({ value: s.value, label: s.label || s.value }))}
                  placeholder={!form.groupName ? 'Select Group First' : loadingSG ? 'Loading…' : 'All Sub-Groups'}
                  disabled={!form.groupName || loadingSG} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Warehouse <span className="inv-req">*</span></label>
                <FilterSelect value={form.warehouseId} onChange={pickWarehouse}
                  options={whList.length ? whList.map(w => ({ value: String(w.id), label: w.name + (w.code ? ` (${w.code})` : '') }))
                                        : warehouses.map(w => ({ value: String(w.id), label: w.name + (w.code ? ` (${w.code})` : '') }))}
                  placeholder={loadingWH ? 'Loading…' : 'Select Warehouse'} disabled={loadingWH} />
              </div>
            </div>
            {form.warehouseId && (
              <div className="inv-scope-resolved">
                <span className="inv-scope-chip">📁 {form.groupName || '—'}</span>
                {form.subGroupName && (
                  <><span className="inv-scope-arrow">›</span>
                  <span className="inv-scope-chip">{form.subGroupName}</span></>
                )}
                <span className="inv-scope-arrow">›</span>
                <span className="inv-scope-chip inv-scope-chip--active">🏬 {selectedWh?.name || '—'}</span>
              </div>
            )}
          </div>

          {/* ── Section: Item Details ──────────────────────────────────────── */}
          <div className="inv-form-grid">
            <div className="inv-field">
              <label className="inv-label">Item Code <span className="inv-req">*</span></label>
              <input className="inv-input" value={form.itemCode}
                onChange={e => set('itemCode', e.target.value)} placeholder="e.g. ITEM-001" />
            </div>
            <div className="inv-field">
              <label className="inv-label">Item Name <span className="inv-req">*</span></label>
              <input className="inv-input" value={form.name}
                onChange={e => set('name', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Category</label>
              <FilterSelect value={form.category} onChange={v => set('category', v)}
                options={Object.keys(CATEGORY_COLORS).map(c => ({ value: c, label: c }))}
                placeholder="Select Category" />
            </div>
            <div className="inv-field">
              <label className="inv-label">Unit</label>
              <FilterSelect value={form.unit} onChange={v => set('unit', v)}
                options={UNITS.map(u => ({ value: u, label: u }))}
                placeholder="Select Unit" />
            </div>
            <div className="inv-field">
              <label className="inv-label">Current Qty</label>
              <input className="inv-input" type="number" min="0" value={form.currentQty}
                onChange={e => set('currentQty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Unit Cost (₹)</label>
              <input className="inv-input" type="number" min="0" step="0.01" value={form.unitCost}
                onChange={e => set('unitCost', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Min Qty (Reorder Alert)</label>
              <input className="inv-input" type="number" min="0" value={form.minQty}
                onChange={e => set('minQty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Max Qty</label>
              <input className="inv-input" type="number" min="0" value={form.maxQty}
                onChange={e => set('maxQty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Project</label>
              <FilterSelect searchable value={form.projectId} onChange={v => set('projectId', v)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder={!form.groupName ? 'Select Group First' : loadingPr ? 'Loading…' : 'No Project'}
                disabled={!form.groupName || loadingPr} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Status</label>
              <div style={{ display:'flex', gap:10, alignItems:'center', height:38, paddingTop:4 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" checked={form.isActive === true}
                    onChange={() => set('isActive', true)} />
                  Active
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" checked={form.isActive === false}
                    onChange={() => set('isActive', false)} />
                  Inactive
                </label>
              </div>
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Description, specifications, remarks…" />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            disabled={!form.name || !form.itemCode || !form.warehouseId}
            onClick={() => { onSave({ ...form, id: item.id }); onClose(); }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Procurement-style Create Bill Modal ──────────────────────────────────────
// Flow: Scope (group/subgroup) → Warehouse → Vendor (scoped to inv POs) →
//       Link PO → PO items (with deliveredQty inputs) → Bill date/notes
function InvCreateBillModal({ open, onClose, onSave, defaultGroupName, defaultSubGroupName, defaultWarehouseId }) {
  const blank = () => ({
    groupName:'', subGroupName:'', warehouseId:'', vendorId:'', vendorName:'',
    poId:'', billDate: new Date().toISOString().slice(0,10), dueDate:'',
    totalAmount:'', notes:'', items:[]
  });
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cascading data
  const [groups,     setGroups]     = useState([]);
  const [subGroups,  setSubGroups]  = useState([]);
  const [warehouseList, setWhList]  = useState([]);  // warehouses scoped to group+subgroup
  const [modVendors, setModVendors] = useState([]);
  const [modPOs,     setModPOs]     = useState([]);
  const [poItems,    setPoItems]    = useState([]);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...blank(),
      groupName:    defaultGroupName    || '',
      subGroupName: defaultSubGroupName || '',
      warehouseId:  defaultWarehouseId  ? String(defaultWarehouseId) : '',
    });
    setPoItems([]);
    filterApi.getAllGroups().then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => setGroups([]));
  }, [open, defaultGroupName, defaultSubGroupName, defaultWarehouseId]);

  useEffect(() => {
    if (!form.groupName) { setSubGroups([]); setWhList([]); return; }
    filterApi.getSubGroups(form.groupName).then(d => setSubGroups(Array.isArray(d) ? d : [])).catch(() => setSubGroups([]));
  }, [form.groupName]);

  // Load warehouses scoped to group + subgroup
  useEffect(() => {
    if (!form.groupName) { setWhList([]); return; }
    const p = new URLSearchParams();
    p.append('groupName', form.groupName);
    if (form.subGroupName) p.append('subGroupName', form.subGroupName);
    fetch(`${API}/warehouses?${p}`, { headers: getAuthHeaders(), credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setWhList(Array.isArray(d) ? d : []))
      .catch(() => setWhList([]));
  }, [form.groupName, form.subGroupName]);

  // When scope or warehouse changes, reload vendors from inv POs
  useEffect(() => {
    if (!form.groupName) { setModVendors([]); setModPOs([]); return; }
    const p = new URLSearchParams();
    if (form.groupName)    p.append('groupName',    form.groupName);
    if (form.subGroupName) p.append('subGroupName', form.subGroupName);
    if (form.warehouseId)  p.append('warehouseId',  form.warehouseId);
    fetch(`${API}/inventory/purchase-orders/modal/vendors?${p}`, { headers: getAuthHeaders(), credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setModVendors(Array.isArray(d) ? d : []))
      .catch(() => setModVendors([]));
  }, [form.groupName, form.subGroupName, form.warehouseId]);

  // When vendor changes, load their POs scoped to warehouse
  useEffect(() => {
    if (!form.vendorId || !form.groupName) { setModPOs([]); return; }
    const p = new URLSearchParams({ size: 100 });
    if (form.groupName)    p.append('groupName',    form.groupName);
    if (form.subGroupName) p.append('subGroupName', form.subGroupName);
    if (form.warehouseId)  p.append('warehouseId',  form.warehouseId);
    if (form.vendorId)     p.append('vendorId',     form.vendorId);
    fetch(`${API}/inventory/purchase-orders?${p}`, { headers: getAuthHeaders(), credentials:'include' })
      .then(r => r.ok ? r.json() : {})
      .then(d => setModPOs(Array.isArray(d?.content) ? d.content : []))
      .catch(() => setModPOs([]));
  }, [form.vendorId, form.groupName, form.subGroupName, form.warehouseId]);

  const loadPOItems = async (poId) => {
    if (!poId) { setPoItems([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/inventory/purchase-orders/${poId}/items-for-bill`, {
        headers: getAuthHeaders(), credentials:'include'
      });
      if (r.ok) {
        const d = await r.json();
        const rows = (d.items || []).map(it => ({
          ...it,
          deliveredQty: '',   // user fills this in
        }));
        setPoItems(rows);
        // Pre-fill vendor from PO if not already set
        if (d.vendorId && !form.vendorId) set('vendorId', String(d.vendorId));
      }
    } catch(e) {
      setPoItems([]);
    } finally { setLoading(false); }
  };

  // Compute auto-total from item lines
  const lineTotal = poItems.reduce((sum, it) => {
    const qty = Number(it.deliveredQty) || 0;
    const sub = qty * (Number(it.unitPrice) || 0);
    const tax = sub * (Number(it.taxPercent) || 0) / 100;
    return sum + sub + tax;
  }, 0);

  const setItemQty = (idx, val) => setPoItems(rows => rows.map((r, i) => i === idx ? {...r, deliveredQty: val} : r));

  if (!open) return null;
  const selVendor = modVendors.find(v => String(v.id) === String(form.vendorId));
  const selPO     = modPOs.find(p => String(p.id) === String(form.poId));

  const canSubmit = form.vendorId && form.billDate && (lineTotal > 0 || Number(form.totalAmount) > 0);

  const handleSubmit = () => {
    const finalTotal = poItems.length > 0 ? lineTotal : Number(form.totalAmount) || 0;
    onSave({
      ...form,
      totalAmount: finalTotal,
      poNumber: selPO?.poNo || selPO?.poNumber || '',
      vendorName: selVendor?.name || form.vendorName,
      items: poItems.filter(it => Number(it.deliveredQty) > 0).map(it => ({
        inventoryItemId: it.inventoryItemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        unit: it.unit,
        qty: Number(it.deliveredQty),
        rate: Number(it.unitPrice) || 0,
        taxPct: Number(it.taxPercent) || 0,
      })),
    });
    onClose();
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Add Bill</h3>
            <p className="inv-modal-sub">Link to a PO and record delivered quantities, or enter standalone</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          {/* ── Section 1: Scope ── */}
          <div className="inv-scope-section" style={{ marginBottom:16 }}>
            <div className="inv-scope-title">Scope</div>
            <div className="inv-scope-grid">
              <div className="inv-field">
                <label className="inv-label">Group</label>
                <FilterSelect value={form.groupName} onChange={v => setForm(f => ({...f, groupName:v, subGroupName:'', warehouseId:'', vendorId:'', poId:''}))}
                  options={groups.map(g => ({value:g.value,label:g.label}))} placeholder="All Groups" />
              </div>
              <div className="inv-field">
                <label className="inv-label">Sub-Group</label>
                <FilterSelect value={form.subGroupName} onChange={v => setForm(f => ({...f, subGroupName:v, warehouseId:'', vendorId:'', poId:''}))}
                  options={subGroups.map(s => ({value:s.value,label:s.label}))} placeholder={!form.groupName?'Select Group First':'All Sub-Groups'}
                  disabled={!form.groupName} />
              </div>
              <div className="inv-field">
                <label className="inv-label">Warehouse</label>
                <FilterSelect value={form.warehouseId} onChange={v => setForm(f => ({...f, warehouseId:v, vendorId:'', poId:''}))}
                  options={warehouseList.map(w => ({value:String(w.id), label:`${w.name}${w.code?` (${w.code})`:''}`}))}
                  placeholder={!form.groupName ? 'Select Group First' : warehouseList.length===0 ? 'No warehouses' : 'All Warehouses'}
                  disabled={!form.groupName} />
              </div>
            </div>
          </div>

          <div className="inv-form-grid">
            {/* Vendor */}
            <div className="inv-field inv-field--full">
              <label className="inv-label">Vendor <span className="inv-req">*</span></label>
              <FilterSelect searchable value={form.vendorId}
                onChange={v => { setForm(f => ({...f, vendorId:v, poId:''})); setPoItems([]); }}
                options={modVendors.map(v => ({value:String(v.id), label:`${v.name}${v.contact?' • '+v.contact:''}`}))}
                placeholder={!form.groupName ? 'Select scope first' : modVendors.length===0 ? 'No vendors found' : 'Search vendor…'}
                disabled={!form.groupName} />
            </div>

            {/* Link PO */}
            <div className="inv-field inv-field--full">
              <label className="inv-label">Link to PO (optional — pre-fills items)</label>
              <FilterSelect searchable value={form.poId}
                onChange={v => { set('poId', v); loadPOItems(v); }}
                options={modPOs.map(p => ({value:String(p.id), label:`${p.poNo||p.poNumber} — ${p.vendorName} (${PO_STATUS[p.status]?.label||p.status})`}))}
                placeholder={!form.vendorId ? 'Select vendor first' : modPOs.length===0 ? 'No POs found' : 'Select PO…'}
                disabled={!form.vendorId} />
            </div>

            {/* Bill date / due date */}
            <div className="inv-field">
              <label className="inv-label">Bill Date <span className="inv-req">*</span></label>
              <input className="inv-input" type="date" value={form.billDate} onChange={e => set('billDate', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Due Date</label>
              <input className="inv-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>

          {/* ── PO Items table (shows when a PO is linked) ── */}
          {loading && <div className="inv-filter-hint" style={{ margin:'12px 0' }}>Loading PO items…</div>}
          {!loading && poItems.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', marginBottom:8 }}>
                PO Items — enter delivered quantities for this bill
              </div>
              <div style={{ border:'1.5px solid #e2e8f0', borderRadius:10, overflow:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:680 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['Code','Item Name','Unit','Ordered','Received','Pending','Deliver Now','Rate (₹)','Tax%','Line Total'].map(h => (
                        <th key={h} style={{ padding:'9px 10px', textAlign: ['Ordered','Received','Pending','Deliver Now','Rate (₹)','Tax%','Line Total'].includes(h)?'right':'left', fontWeight:700, fontSize:11, color:'#475569', borderBottom:'1.5px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((it, idx) => {
                      const dQty = Number(it.deliveredQty) || 0;
                      const sub  = dQty * (Number(it.unitPrice) || 0);
                      const lineT = sub + sub * (Number(it.taxPercent) || 0) / 100;
                      const isComplete = it.deliveryStatus === 'COMPLETE';
                      return (
                        <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9', background: isComplete ? '#f8fafc' : '#fff' }}>
                          <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:12 }}>{it.itemCode}</td>
                          <td style={{ padding:'8px 10px', fontWeight:500 }}>{it.itemName}</td>
                          <td style={{ padding:'8px 10px', color:'#64748b' }}>{it.unit}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right' }}>{fmt(it.orderedQty)}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right', color:'#166534' }}>{fmt(it.receivedQty)}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right', color: Number(it.pendingQty)>0?'#991b1b':'#64748b', fontWeight: Number(it.pendingQty)>0?700:400 }}>{fmt(it.pendingQty)}</td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <input type="number" min="0" max={it.maxBillableQty || undefined} step="0.001"
                              value={it.deliveredQty}
                              onChange={e => setItemQty(idx, e.target.value)}
                              style={{ width:80, padding:'5px 8px', textAlign:'right', border:`1.5px solid ${dQty>Number(it.maxBillableQty)&&it.maxBillableQty>0?'#ef4444':'#e2e8f0'}`, borderRadius:6, fontSize:13, fontFamily:'inherit' }}
                              disabled={isComplete}
                              placeholder="0"
                            />
                            {isComplete && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Complete</div>}
                          </td>
                          <td style={{ padding:'8px 10px', textAlign:'right', color:'#64748b' }}>{fmtCcy(it.unitPrice)}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right', color:'#64748b' }}>{it.taxPercent}%</td>
                          <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:600, color:'#0f172a' }}>{fmtCcy(lineT)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8fafc', borderTop:'2px solid #e2e8f0' }}>
                      <td colSpan={9} style={{ padding:'10px', fontWeight:700, color:'#0f172a', fontSize:13 }}>Grand Total (incl. tax)</td>
                      <td style={{ padding:'10px', textAlign:'right', fontWeight:800, fontSize:14, color:'#1d4ed8' }}>{fmtCcy(lineTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Standalone amount (when no PO) */}
          {poItems.length === 0 && (
            <div className="inv-form-grid" style={{ marginTop:12 }}>
              <div className="inv-field">
                <label className="inv-label">Total Amount (₹) <span className="inv-req">*</span></label>
                <input className="inv-input" type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} />
              </div>
            </div>
          )}

          <div className="inv-form-grid" style={{ marginTop:12 }}>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          {poItems.length > 0 && (
            <span style={{ color:'#64748b', fontSize:13, margin:'0 8px' }}>
              Total: <strong>{fmtCcy(lineTotal)}</strong>
            </span>
          )}
          <button className="inv-btn inv-btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
            Save Bill
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Procurement-style Record Payment Modal ───────────────────────────────────
// ── Procurement-style Record / Edit Payment Modal ────────────────────────────
// Advance: Group → SubGroup → Warehouse → Vendor (scoped to inv POs in that scope)
// Bill Payment: direct bill selector
function InvRecordPaymentModal({ open, onClose, onSave, bills, warehouses, editPayment }) {
  const isEdit = !!editPayment;
  const [payType, setPayType] = useState('BILL_PAYMENT');
  const [form, setForm] = useState({
    billId: '', vendorId: '', vendorName: '',
    groupName: '', subGroupName: '', warehouseId: '',
    date: new Date().toISOString().slice(0,10),
    amount: '', mode: 'Bank Transfer', reference: '', notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cascading state for advance hierarchy
  const [groups,    setGroups]    = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [scopeVendors, setScopeVendors] = useState([]);
  const [loadingSV,    setLoadingSV]    = useState(false);

  React.useEffect(() => {
    if (!open) return;
    filterApi.getAllGroups().then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => setGroups([]));
    if (isEdit && editPayment) {
      const pt = editPayment.billId ? 'BILL_PAYMENT' : 'ADVANCE';
      setPayType(pt);
      setForm({
        billId:       editPayment.billId       ? String(editPayment.billId)       : '',
        vendorId:     editPayment.vendorId     ? String(editPayment.vendorId)     : '',
        vendorName:   editPayment.vendorName   || '',
        groupName:    editPayment.groupName    || '',
        subGroupName: editPayment.subGroupName || '',
        warehouseId:  editPayment.warehouseId  ? String(editPayment.warehouseId)  : '',
        date:         editPayment.date         || new Date().toISOString().slice(0,10),
        amount:       editPayment.amount       ? String(editPayment.amount) : '',
        mode:         editPayment.mode         || 'Bank Transfer',
        reference:    editPayment.reference    || '',
        notes:        editPayment.notes        || '',
      });
    } else {
      setPayType('BILL_PAYMENT');
      setForm({ billId:'', vendorId:'', vendorName:'', groupName:'', subGroupName:'', warehouseId:'',
        date: new Date().toISOString().slice(0,10), amount:'', mode:'Bank Transfer', reference:'', notes:'' });
    }
  }, [open, isEdit, editPayment]);

  React.useEffect(() => {
    if (!form.groupName) { setSubGroups([]); return; }
    filterApi.getSubGroups(form.groupName).then(d => setSubGroups(Array.isArray(d) ? d : [])).catch(() => setSubGroups([]));
  }, [form.groupName]);

  React.useEffect(() => {
    if (!form.groupName) { setScopeVendors([]); return; }
    setLoadingSV(true);
    const p = new URLSearchParams();
    p.append('groupName', form.groupName);
    if (form.subGroupName) p.append('subGroupName', form.subGroupName);
    if (form.warehouseId)  p.append('warehouseId',  form.warehouseId);
    fetch(`${API}/inventory/purchase-orders/modal/vendors?${p}`, { headers: getAuthHeaders(), credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setScopeVendors(Array.isArray(d) ? d : []))
      .catch(() => setScopeVendors([]))
      .finally(() => setLoadingSV(false));
  }, [form.groupName, form.subGroupName, form.warehouseId]);

  // Include all bills that still have an outstanding balance:
  // Pending, Partially Paid, Overdue — exclude only fully Paid bills
  const isFullyPaid = (b) => {
    const s = (b.status || '').toLowerCase();
    return s === 'paid';
  };
  const unpaidBills = bills.filter(b => !isFullyPaid(b));
  const billsToShow = isEdit && editPayment?.billId ? bills : unpaidBills;

  // For BILL_PAYMENT: filter unpaid bills by the selected scope/vendor
  const filteredBillsForPayment = (isEdit && editPayment?.billId ? bills : unpaidBills).filter(b => {
    if (form.groupName    && b.groupName    && b.groupName    !== form.groupName)    return false;
    if (form.subGroupName && b.subGroupName && b.subGroupName !== form.subGroupName) return false;
    if (form.warehouseId  && b.warehouseId  && String(b.warehouseId) !== String(form.warehouseId)) return false;
    if (form.vendorId     && b.vendorId     && String(b.vendorId)    !== String(form.vendorId))    return false;
    return true;
  });

  const selBill = filteredBillsForPayment.find(b => String(b.id) === String(form.billId))
               || billsToShow.find(b => String(b.id) === String(form.billId)); // fallback for edit mode
  const outstanding = selBill
    ? Math.max(0, (selBill.amount||0) - (selBill.paid||0) + (isEdit ? Number(editPayment?.amount||0) : 0))
    : 0;

  const scopedWarehouses = form.groupName
    ? warehouses.filter(w => (!w.groupName || w.groupName === form.groupName))
    : warehouses;

  if (!open) return null;

  const canSubmit = payType === 'BILL_PAYMENT'
    ? (form.billId && form.amount && Number(form.amount) > 0)
    : (form.vendorId && form.warehouseId && form.groupName && form.amount && Number(form.amount) > 0);

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">{isEdit ? 'Edit Payment' : 'Record Payment'}</h3>
            <p className="inv-modal-sub">
              {isEdit ? `Editing ${editPayment.paymentNumber}` : 'Record advance payment or payment against a specific bill'}
            </p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="inv-modal-body">
          <div style={{ display:'flex', gap:12, marginBottom:20 }}>
            {[
              { key:'BILL_PAYMENT', label:'Payment Against Bill',   desc:'Pay against a specific existing bill',              icon:'🧾' },
              { key:'ADVANCE',      label:'Record Advance Payment',  desc:'Pay vendor before receiving a bill (e.g. advance)', icon:'⬆️' },
            ].map(opt => (
              <label key={opt.key} style={{
                flex:1, display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
                border:`2px solid ${payType===opt.key?'#3b82f6':'#e2e8f0'}`,
                borderRadius:10, cursor: isEdit ? 'not-allowed' : 'pointer',
                background: payType===opt.key ? '#eff6ff' : '#fff',
                opacity: isEdit && payType !== opt.key ? 0.4 : 1,
                transition:'all .15s'
              }}>
                <input type="radio" name="payType" value={opt.key}
                  checked={payType===opt.key} disabled={isEdit}
                  onChange={() => { if (!isEdit) { setPayType(opt.key); set('billId',''); set('vendorId',''); set('vendorName',''); set('amount',''); }}}
                  style={{ marginTop:3 }} />
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{opt.icon} {opt.label}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="inv-form-grid">
            {payType === 'BILL_PAYMENT' && (<>
              {/* ── Scope: Group → SubGroup → Warehouse → Vendor → Bill ── */}
              <div className="inv-scope-section" style={{ marginBottom:0, gridColumn:'1/-1' }}>
                <div className="inv-scope-title">
                  Filter Bills &nbsp;<span className="inv-muted-sm">— narrow down to find the right bill</span>
                </div>
                <div className="inv-scope-grid">
                  <div className="inv-field">
                    <label className="inv-label">Group</label>
                    <FilterSelect value={form.groupName} disabled={isEdit}
                      onChange={v => setForm(f => ({ ...f, groupName:v, subGroupName:'', warehouseId:'', vendorId:'', vendorName:'', billId:'', amount:'' }))}
                      options={groups.map(g => ({ value:g.value, label:g.label }))}
                      placeholder="All Groups"
                    />
                  </div>
                  <div className="inv-field">
                    <label className="inv-label">Sub-Group</label>
                    <FilterSelect value={form.subGroupName} disabled={isEdit}
                      onChange={v => setForm(f => ({ ...f, subGroupName:v, warehouseId:'', vendorId:'', vendorName:'', billId:'', amount:'' }))}
                      options={subGroups.map(s => ({ value:s.value, label:s.label }))}
                      placeholder={!form.groupName ? 'Select Group First' : 'All Sub-Groups'}
                      disabled={isEdit || !form.groupName}
                    />
                  </div>
                  <div className="inv-field">
                    <label className="inv-label">Warehouse</label>
                    <FilterSelect value={form.warehouseId} disabled={isEdit}
                      onChange={v => setForm(f => ({ ...f, warehouseId:v, vendorId:'', vendorName:'', billId:'', amount:'' }))}
                      options={scopedWarehouses.map(w => ({ value:String(w.id), label:`${w.name}${w.code?` (${w.code})`:''}`}))}
                      placeholder={!form.groupName ? 'Select Group First' : 'All Warehouses'}
                      disabled={isEdit || !form.groupName}
                    />
                  </div>
                </div>
                <div style={{ marginTop:8 }}>
                  <div className="inv-field">
                    <label className="inv-label">Vendor</label>
                    <FilterSelect searchable value={String(form.vendorId||'')} disabled={isEdit}
                      onChange={v => {
                        const vend = scopeVendors.find(x => String(x.id)===String(v));
                        setForm(f => ({ ...f, vendorId:v, vendorName: vend?.name||'', billId:'', amount:'' }));
                      }}
                      options={[
                        { value:'', label:'All Vendors' },
                        ...scopeVendors.map(v => ({ value:String(v.id), label: v.name+(v.contact?` • ${v.contact}`:'') }))
                      ]}
                      placeholder={!form.groupName ? 'Select Group First' : loadingSV ? 'Loading vendors…' : 'All Vendors'}
                      disabled={isEdit || loadingSV}
                    />
                  </div>
                </div>
              </div>

              {/* ── Bill picker (filtered by scope above) ── */}
              <div className="inv-field inv-field--full">
                <label className="inv-label">Bill <span className="inv-req">*</span></label>
                <FilterSelect searchable value={form.billId} disabled={isEdit}
                  onChange={v => {
                    const b = filteredBillsForPayment.find(b => String(b.id)===String(v));
                    setForm(f => ({ ...f, billId:v,
                      vendorId:     b?.vendorId     ? String(b.vendorId)    : f.vendorId,
                      vendorName:   b?.vendorName   || f.vendorName,
                      warehouseId:  b?.warehouseId  ? String(b.warehouseId) : f.warehouseId,
                      groupName:    b?.groupName    || f.groupName,
                      subGroupName: b?.subGroupName || f.subGroupName,
                      amount: b ? Math.max(0,(b.amount||0)-(b.paid||0)).toFixed(2) : ''
                    }));
                  }}
                  options={filteredBillsForPayment.map(b => ({
                    value: String(b.id),
                    label: `${b.billNumber||b.billNo||''} — ${b.vendorName} (Due: ${fmtCcy(Math.max(0,(b.amount||0)-(b.paid||0)))})`
                  }))}
                  placeholder={filteredBillsForPayment.length===0 ? 'No unpaid bills match filter' : 'Select bill…'}
                />
                {filteredBillsForPayment.length === 0 && unpaidBills.length > 0 && !isEdit && (
                  <div style={{ fontSize:12, color:'#f59e0b', marginTop:4 }}>
                    ⚠ No pending/unpaid bills match the selected filters — try clearing Group/Warehouse/Vendor filters above
                  </div>
                )}
                {selBill && (
                  <div className="inv-item-hint" style={{ marginTop:6, display:'flex', gap:16 }}>
                    <span>Total: <strong>{fmtCcy(selBill.amount)}</strong></span>
                    <span>Paid: <strong style={{ color:'#166534' }}>{fmtCcy(selBill.paid)}</strong></span>
                    <span>Outstanding: <strong style={{ color:'#991b1b' }}>{fmtCcy(outstanding)}</strong></span>
                  </div>
                )}
              </div>
            </>)}

            {payType === 'ADVANCE' && (<>
              <div className="inv-scope-section" style={{ marginBottom:0, gridColumn:'1/-1' }}>
                <div className="inv-scope-title">Scope</div>
                <div className="inv-scope-grid">
                  <div className="inv-field">
                    <label className="inv-label">Group <span className="inv-req">*</span></label>
                    <FilterSelect value={form.groupName}
                      onChange={v => setForm(f => ({ ...f, groupName:v, subGroupName:'', warehouseId:'', vendorId:'', vendorName:'' }))}
                      options={groups.map(g => ({ value:g.value, label:g.label }))}
                      placeholder="Select Group"
                    />
                  </div>
                  <div className="inv-field">
                    <label className="inv-label">Sub-Group</label>
                    <FilterSelect value={form.subGroupName}
                      onChange={v => setForm(f => ({ ...f, subGroupName:v, warehouseId:'', vendorId:'', vendorName:'' }))}
                      options={subGroups.map(s => ({ value:s.value, label:s.label }))}
                      placeholder={!form.groupName ? 'Select Group First' : 'All Sub-Groups'}
                      disabled={!form.groupName}
                    />
                  </div>
                  <div className="inv-field">
                    <label className="inv-label">Warehouse <span className="inv-req">*</span></label>
                    <FilterSelect value={form.warehouseId}
                      onChange={v => setForm(f => ({ ...f, warehouseId:v, vendorId:'', vendorName:'' }))}
                      options={scopedWarehouses.map(w => ({ value:String(w.id), label:`${w.name}${w.code?` (${w.code})`:''}`}))}
                      placeholder={!form.groupName ? 'Select Group First' : 'Select Warehouse'}
                      disabled={!form.groupName}
                    />
                  </div>
                </div>
              </div>
              <div className="inv-field inv-field--full">
                <label className="inv-label">Vendor <span className="inv-req">*</span></label>
                <FilterSelect searchable value={String(form.vendorId||'')}
                  onChange={v => {
                    const vend = scopeVendors.find(x => String(x.id)===String(v));
                    setForm(f => ({ ...f, vendorId:v, vendorName: vend?.name || '' }));
                  }}
                  options={scopeVendors.map(v => ({ value:String(v.id), label: v.name+(v.contact?` • ${v.contact}`:'') }))}
                  placeholder={!form.groupName ? 'Select scope first' : loadingSV ? 'Loading…' : scopeVendors.length===0 ? 'No vendors found in scope' : 'Search vendor…'}
                  disabled={!form.groupName || loadingSV}
                />
              </div>
            </>)}

            <div className="inv-field">
              <label className="inv-label">Amount (₹) <span className="inv-req">*</span></label>
              <input className="inv-input" type="number" min="0" step="0.01"
                value={form.amount} onChange={e => set('amount', e.target.value)}
                max={payType==='BILL_PAYMENT' ? outstanding : undefined}
              />
              {payType==='BILL_PAYMENT' && selBill && Number(form.amount) > outstanding && (
                <div style={{ color:'#ef4444', fontSize:12, marginTop:4 }}>⚠ Exceeds outstanding balance</div>
              )}
            </div>
            <div className="inv-field">
              <label className="inv-label">Payment Date</label>
              <input className="inv-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Payment Mode</label>
              <FilterSelect value={form.mode} onChange={v => set('mode', v || 'Bank Transfer')}
                options={[
                  { value:'Bank Transfer', label:'Bank Transfer' }, { value:'NEFT', label:'NEFT' },
                  { value:'RTGS', label:'RTGS' }, { value:'UPI', label:'UPI' },
                  { value:'Cheque', label:'Cheque' }, { value:'Cash', label:'Cash' },
                ]}
                placeholder="Select mode…"
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Reference No.</label>
              <input className="inv-input" placeholder="NEFT/UTR/Cheque no." value={form.reference} onChange={e => set('reference', e.target.value)} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary" disabled={!canSubmit}
            onClick={() => { onSave({ ...form, payType, id: editPayment?.id }); onClose(); }}>
            {isEdit ? 'Save Changes' : payType === 'ADVANCE' ? 'Record Advance' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
// Items, Transactions tabs are in components/inventory_management/

// ═════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS — Modal + Tab
// ═════════════════════════════════════════════════════════════════════════════
function CreatePOModal({ open, onClose, onSave, items, vendors, warehouses, defaultWarehouseId,
                         defaultGroupName, defaultSubGroupName, editData }) {
  const isEdit = !!editData;
  const blankLine = () => ({ itemCode: '', name: '', qty: '', unit: 'Nos', rate: '', tax: 18 });
  const [form, setForm] = useState({
    vendorId: '', date: new Date().toISOString().slice(0, 10), expected: '',
    groupName: '', subGroupName: '', projectId: '', warehouseId: '', terms: 'Net 30', notes: '', status: 'DRAFT', lines: [blankLine()]
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cascading scope state
  const [groups,    setGroups]    = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [lgG, setLgG] = useState(false);
  const [lgSG,setLgSG]= useState(false);
  const [lgPr,setLgPr]= useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editData) {
      // Pre-fill from editData (PO being edited)
      setForm({
        id:          editData.id,
        vendorId:    String(editData.vendorId || ''),
        vendorName:  editData.vendorName || '',
        date:        editData.date || editData.orderDate || new Date().toISOString().slice(0,10),
        expected:    editData.expected || editData.expectedDelivery || '',
        groupName:   editData.groupName    || '',
        subGroupName:editData.subGroupName || '',
        projectId:   editData.projectId    || '',
        warehouseId: String(editData.warehouseId || ''),
        terms:       editData.terms || editData.paymentTerms || 'Net 30',
        notes:       editData.notes || '',
        status:      editData.status || 'DRAFT',
        lines: (editData.items || []).length > 0
          ? editData.items.map(it => ({
              id:             it.id,
              inventoryItemId:it.inventoryItemId || null,
              itemCode:       it.itemCode || '',
              name:           it.itemName || it.name || '',
              unit:           it.unit    || 'Nos',
              qty:            String(it.orderedQty || it.qty  || ''),
              rate:           String(it.rate        || it.unitPrice || ''),
              tax:            String(it.taxPct      || it.tax       || 0),
            }))
          : [blankLine()],
      });
    } else {
      setForm(f => ({
        ...f,
        id: undefined,
        warehouseId:  defaultWarehouseId ? String(defaultWarehouseId) : '',
        groupName:    defaultGroupName    || '',
        subGroupName: defaultSubGroupName || '',
        lines: [blankLine()],
      }));
    }
    setLgG(true);
    filterApi.getAllGroups().then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => setGroups([])).finally(() => setLgG(false));
  }, [open, editData, defaultWarehouseId, defaultGroupName, defaultSubGroupName]);

  React.useEffect(() => {
    if (!form.groupName) { setSubGroups([]); setProjects([]); return; }
    setLgSG(true);
    filterApi.getSubGroups(form.groupName).then(d => setSubGroups(Array.isArray(d) ? d : [])).catch(() => setSubGroups([])).finally(() => setLgSG(false));
  }, [form.groupName]);

  React.useEffect(() => {
    if (!form.groupName) { setProjects([]); return; }
    setLgPr(true);
    filterApi.getProjects(form.groupName, form.subGroupName || '').then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => setProjects([])).finally(() => setLgPr(false));
  }, [form.groupName, form.subGroupName]);

  const setLine = (idx, k, v) => setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, [k]: v } : l) }));
  const addLine    = () => setForm(f => ({ ...f, lines: [...f.lines, blankLine()] }));
  const removeLine = (idx) => setForm(f => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== idx) : f.lines }));

  const pickItem = (idx, itemCode) => {
    const it = items.find(i => i.itemCode === itemCode);
    if (it) setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? {
      ...l,
      inventoryItemId: it.id || null,
      itemCode: it.itemCode,
      name:     it.name,
      unit:     it.unit,
      rate:     it.unitCost,
    } : l) }));
    else setLine(idx, 'itemCode', itemCode);
  };

  const total = poTotal(form.lines);

  if (!open) return null;
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">{isEdit ? `Edit PO — ${editData?.poNumber || editData?.poNo || ''}` : 'Create Purchase Order'}</h3>
            <p className="inv-modal-sub">{isEdit ? 'Update purchase order details and line items' : 'Issue a PO to a vendor with line items'}</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-form-grid">
            <div className="inv-field">
              <label className="inv-label">Group <span className="inv-req">*</span></label>
              <FilterSelect
                value={form.groupName}
                onChange={v => setForm(f => ({ ...f, groupName: v, subGroupName: '', projectId: '' }))}
                options={groups.map(g => ({ value: g.value, label: g.label }))}
                placeholder={lgG ? 'Loading…' : 'Select Group'}
                disabled={lgG}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Sub-Group</label>
              <FilterSelect
                value={form.subGroupName}
                onChange={v => setForm(f => ({ ...f, subGroupName: v, projectId: '' }))}
                options={subGroups.map(s => ({ value: s.value, label: s.label }))}
                placeholder={!form.groupName ? 'Select Group First' : lgSG ? 'Loading…' : 'All Sub-Groups'}
                disabled={!form.groupName || lgSG}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Delivery Warehouse <span className="inv-req">*</span></label>
              <FilterSelect
                value={form.warehouseId}
                onChange={v => set('warehouseId', v)}
                options={warehouses.map(w => ({ value: String(w.id), label: w.name + (w.code ? ` (${w.code})` : '') }))}
                placeholder="Select warehouse…"
              />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Vendor <span className="inv-req">*</span></label>
              <FilterSelect
                searchable
                value={form.vendorId}
                onChange={v => set('vendorId', v)}
                options={vendors.map(v => ({ value: String(v.id), label: v.name + (v.contactNumber ? ' • ' + v.contactNumber : '') }))}
                placeholder="Search vendor…"
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">PO Date</label>
              <input className="inv-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Expected Delivery</label>
              <input className="inv-input" type="date" value={form.expected} onChange={e => set('expected', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Project</label>
              <FilterSelect
                searchable
                value={form.projectId}
                onChange={v => set('projectId', v)}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder={!form.groupName ? 'Select Group First' : lgPr ? 'Loading…' : 'No Project'}
                disabled={!form.groupName || lgPr}
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Payment Terms</label>
              <input className="inv-input" placeholder="e.g. Net 30 / 50% advance" value={form.terms} onChange={e => set('terms', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Status</label>
              <FilterSelect
                value={form.status}
                onChange={v => set('status', v)}
                options={Object.entries(PO_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
                placeholder="Select Status"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="inv-lineitems-wrap">
            <div className="inv-lineitems-head">
              <h4 className="inv-lineitems-title">Line Items</h4>
              <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={addLine}>+ Add Line</button>
            </div>
            <div className="inv-lineitems-table">
              <div className="inv-lineitems-row inv-lineitems-row--head">
                <div>Item (Code — Name)</div>
                <div>Description / Notes</div>
                <div style={{ textAlign:'right' }}>Qty</div>
                <div>Unit</div>
                <div style={{ textAlign:'right' }}>Rate (₹)</div>
                <div style={{ textAlign:'right' }}>Tax%</div>
                <div style={{ textAlign:'right' }}>Subtotal</div>
                <div></div>
              </div>
              {form.lines.map((l, idx) => {
                const sub = (Number(l.qty)||0) * (Number(l.rate)||0);
                const lineTotal = sub + (sub * (Number(l.tax)||0) / 100);
                return (
                  <div key={idx} className="inv-lineitems-row">
                    <FilterSelect
                      searchable
                      value={l.itemCode}
                      onChange={v => pickItem(idx, v)}
                      options={items.map(i => ({
                        value: i.itemCode,
                        label: `${i.itemCode} — ${i.name}`,
                      }))}
                      placeholder="Search item…"
                    />
                    <input className="inv-input inv-input--sm" placeholder="Item name" value={l.name} onChange={e => setLine(idx, 'name', e.target.value)} />
                    <input className="inv-input inv-input--sm" type="number" min="0" style={{ textAlign:'right' }} value={l.qty} onChange={e => setLine(idx, 'qty', e.target.value)} />
                    <select className="inv-input inv-input--sm" value={l.unit} onChange={e => setLine(idx, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input className="inv-input inv-input--sm" type="number" min="0" style={{ textAlign:'right' }} value={l.rate} onChange={e => setLine(idx, 'rate', e.target.value)} />
                    <input className="inv-input inv-input--sm" type="number" min="0" max="50" style={{ textAlign:'right' }} value={l.tax} onChange={e => setLine(idx, 'tax', e.target.value)} />
                    <div className="inv-lineitems-subtotal">{fmtCcy(lineTotal.toFixed(2))}</div>
                    <button className="inv-lineitems-del" onClick={() => removeLine(idx)} title="Remove line">✕</button>
                  </div>
                );
              })}
            </div>
            <div className="inv-lineitems-total">
              <span>Grand Total (incl. tax)</span>
              <strong>{fmtCcy(total.toFixed(2))}</strong>
            </div>
          </div>

          <div className="inv-form-grid">
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} placeholder="Optional notes for vendor…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          {isEdit ? (
            <button className="inv-btn inv-btn--primary"
              disabled={!form.vendorId || !form.lines.some(l => l.qty && l.rate)}
              onClick={async () => {
                const ok = await onSave(form);
                if (ok) onClose();
              }}>
              Save Changes
            </button>
          ) : (
            <button className="inv-btn inv-btn--primary"
              disabled={!form.vendorId || !form.warehouseId || !form.lines.some(l => l.qty && l.rate)}
              onClick={() => { onSave({ ...form }); onClose(); }}>
              {form.status === 'SENT' ? 'Send PO to Vendor' : form.status === 'DRAFT' ? 'Save as Draft' : `Save as ${PO_STATUS[form.status]?.label || form.status}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Purchase Orders tab is in components/inventory_management/PurchaseOrdersTab.js

// ═════════════════════════════════════════════════════════════════════════════
// BILLS / PAYMENTS — Modals + Tab (with nested sub-tabs)
// ═════════════════════════════════════════════════════════════════════════════
function CreateBillModal({ open, onClose, onSave, vendors, pos }) {
  const [form, setForm] = useState({
    vendorId: '', poNumber: '', billDate: new Date().toISOString().slice(0, 10),
    dueDate: '', amount: '', projectId: '', notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Accept both poNo (API) and poNumber (normalised)
  const pickPO = (poVal) => {
    const po = pos.find(p => (p.poNo || p.poNumber) === poVal);
    if (po) setForm(f => ({
      ...f,
      poNumber: poVal,
      vendorId: String(po.vendorId || ''),
      projectId: po.projectId || '',
      amount: poTotal(po.items || []).toFixed(2),
    }));
    else set('poNumber', poVal);
  };

  if (!open) return null;
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Add Bill</h3>
            <p className="inv-modal-sub">Record a vendor bill against a PO or standalone</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-form-grid">
            <div className="inv-field inv-field--full">
              <label className="inv-label">Link to PO (optional)</label>
              <FilterSelect
                searchable
                value={form.poNumber}
                onChange={v => pickPO(v)}
                options={pos.map(p => ({ value: p.poNo || p.poNumber, label: `${p.poNo || p.poNumber} — ${p.vendorName}` }))}
                placeholder="— No PO (standalone bill) —"
              />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Vendor <span className="inv-req">*</span></label>
              <FilterSelect
                searchable
                value={form.vendorId}
                onChange={v => set('vendorId', v)}
                options={vendors.map(v => ({ value: String(v.id), label: v.name + (v.contactNumber ? ' • ' + v.contactNumber : '') }))}
                placeholder="Search vendor…"
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Bill Date</label>
              <input className="inv-input" type="date" value={form.billDate} onChange={e => set('billDate', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Due Date</label>
              <input className="inv-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Amount (₹) <span className="inv-req">*</span></label>
              <input className="inv-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Project ID</label>
              <input className="inv-input" placeholder="Auto-filled from PO" value={form.projectId} onChange={e => set('projectId', e.target.value)} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            disabled={!form.vendorId || !form.amount}
            onClick={() => { onSave(form); onClose(); }}>
            Save Bill
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({ open, onClose, onSave, bills }) {
  const [form, setForm] = useState({
    billId: '', date: new Date().toISOString().slice(0, 10),
    amount: '', mode: 'Bank Transfer', reference: '', notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const bill = bills.find(b => String(b.id) === String(form.billId));
  const due  = bill ? bill.amount - bill.paid : 0;

  if (!open) return null;
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Record Payment</h3>
            <p className="inv-modal-sub">Pay against an outstanding bill</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-form-grid">
            <div className="inv-field inv-field--full">
              <label className="inv-label">Bill <span className="inv-req">*</span></label>
              <FilterSelect
                searchable
                value={form.billId}
                onChange={v => {
                  set('billId', v);
                  const b = bills.find(b => String(b.id) === String(v));
                  if (b) set('amount', Math.max(0, b.amount - b.paid).toFixed(2));
                }}
                options={bills.filter(b => (b.status||'').toLowerCase() !== 'paid').map(b => ({
                  value: String(b.id),
                  label: `${b.billNumber || b.billNo || ''} — ${b.vendorName} (Due: ${fmtCcy(b.amount - b.paid)})`
                }))}
                placeholder="Select bill…"
              />
              {bill && (
                <div className="inv-item-hint">
                  Total: <strong>{fmtCcy(bill.amount)}</strong> · Paid: <strong>{fmtCcy(bill.paid)}</strong> · Outstanding: <strong style={{ color:'#991b1b' }}>{fmtCcy(due)}</strong>
                </div>
              )}
            </div>
            <div className="inv-field">
              <label className="inv-label">Payment Date</label>
              <input className="inv-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Amount (₹) <span className="inv-req">*</span></label>
              <input className="inv-input" type="number" min="0" step="0.01" max={due || undefined} value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Payment Mode</label>
              <FilterSelect
                value={form.mode}
                onChange={v => set('mode', v)}
                options={PAY_MODES.map(m => ({ value: m, label: m }))}
                placeholder="Select Mode"
              />
            </div>
            <div className="inv-field">
              <label className="inv-label">Reference / Txn No.</label>
              <input className="inv-input" placeholder="UTR / Cheque No / UPI Ref" value={form.reference} onChange={e => set('reference', e.target.value)} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            disabled={!form.billId || !form.amount || Number(form.amount) <= 0}
            onClick={() => { onSave(form); onClose(); }}>
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Bill Modal ──────────────────────────────────────────────────────────
// ── Edit Bill Modal ──────────────────────────────────────────────────────────
// Shows everything: scope (locked), vendor (locked), linked PO (locked),
// bill items table with editable qty/rate/tax, dates, notes, payment summary.
function EditBillModal({ open, onClose, onSave, bill, warehouses }) {
  const [form, setForm] = useState({ billDate:'', dueDate:'', notes:'', totalAmount:'' });
  const [items, setItems] = useState([]);  // bill line items — editable
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (!open || !bill) return;
    setForm({
      billDate:    bill.billDate    || new Date().toISOString().slice(0,10),
      dueDate:     bill.dueDate     || '',
      notes:       bill.notes       || '',
      totalAmount: String(bill.amount || ''),
    });
    // Seed items from the bill's stored items
    const billItems = bill.items || [];
    setItems(billItems.map(it => ({
      id:              it.id,
      inventoryItemId: it.inventoryItemId || null,
      itemCode:        it.itemCode  || '',
      itemName:        it.itemName  || it.name || '',
      unit:            it.unit      || '',
      qty:             String(it.qty  ?? it.orderedQty ?? ''),
      rate:            String(it.rate ?? it.unitPrice  ?? ''),
      taxPct:          String(it.taxPct ?? it.taxPercent ?? 0),
    })));
  }, [open, bill]);

  if (!open || !bill) return null;

  const isPaid    = bill.status === 'PAID';
  const sm        = BILL_STATUS[bill.status] || BILL_STATUS.UNPAID;
  const wh        = warehouses?.find(w => String(w.id) === String(bill.warehouseId));

  // Live-compute total from items if any exist
  const lineTotal = items.reduce((sum, it) => {
    const qty = Number(it.qty)  || 0;
    const rate = Number(it.rate) || 0;
    const tax  = Number(it.taxPct) || 0;
    const sub  = qty * rate;
    return sum + sub + sub * tax / 100;
  }, 0);

  const finalTotal = items.length > 0 ? lineTotal : Number(form.totalAmount) || 0;
  const canSubmit  = form.billDate && finalTotal > 0;

  const setItem = (idx, k, v) => setItems(rows => rows.map((r, i) => i === idx ? { ...r, [k]: v } : r));

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Edit Bill — {bill.billNumber}</h3>
            <p className="inv-modal-sub" style={{ display:'flex', alignItems:'center', gap:8 }}>
              {bill.vendorName}
              <span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              {bill.poNumber && bill.poNumber !== '—' && (
                <span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>
                  📋 {bill.poNumber}
                </span>
              )}
            </p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          {isPaid && (
            <div style={{ background:'#fef9c3', border:'1.5px solid #fde047', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#854d0e' }}>
              ⚠ This bill is fully paid. Item quantities and amount cannot be changed — only dates and notes can be updated.
            </div>
          )}

          {/* ── Read-only scope strip ── */}
          <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Scope (locked)</div>
            <div style={{ display:'flex', gap:24, flexWrap:'wrap', fontSize:13, color:'#475569' }}>
              {bill.groupName    && <span>🏢 <strong>{bill.groupName}</strong></span>}
              {bill.subGroupName && <span>↳ <strong>{bill.subGroupName}</strong></span>}
              {wh                && <span>🏬 <strong>{wh.name}{wh.code ? ` (${wh.code})` : ''}</strong></span>}
              <span>👤 <strong>{bill.vendorName}</strong></span>
              {bill.poNumber && bill.poNumber !== '—' && <span>📋 PO: <strong>{bill.poNumber}</strong></span>}
            </div>
          </div>

          {/* ── Payment summary ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Total Amount',  val: fmtCcy(bill.amount),                   color:'#0f172a' },
              { label:'Amount Paid',   val: fmtCcy(bill.paid),                     color:'#166534' },
              { label:'Balance Due',   val: fmtCcy(bill.amount - bill.paid),        color: bill.paid < bill.amount ? '#991b1b' : '#166534' },
            ].map(k => (
              <div key={k.label} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* ── Dates ── */}
          <div className="inv-form-grid" style={{ marginBottom:16 }}>
            <div className="inv-field">
              <label className="inv-label">Bill Date <span className="inv-req">*</span></label>
              <input className="inv-input" type="date" value={form.billDate} onChange={e => set('billDate', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Due Date</label>
              <input className="inv-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>

          {/* ── Bill items table ── */}
          {items.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', marginBottom:8 }}>
                Bill Items {isPaid && <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>(read-only — bill is paid)</span>}
              </div>
              <div style={{ border:'1.5px solid #e2e8f0', borderRadius:10, overflow:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:680 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['Code','Item Name','Unit','Qty','Rate (₹)','Tax %','Line Total'].map(h => (
                        <th key={h} style={{
                          padding:'9px 10px',
                          textAlign: ['Qty','Rate (₹)','Tax %','Line Total'].includes(h) ? 'right' : 'left',
                          fontWeight:700, fontSize:11, color:'#475569',
                          borderBottom:'1.5px solid #e2e8f0'
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const qty   = Number(it.qty)    || 0;
                      const rate  = Number(it.rate)   || 0;
                      const tax   = Number(it.taxPct) || 0;
                      const sub   = qty * rate;
                      const lineT = sub + sub * tax / 100;
                      return (
                        <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:12, color:'#64748b' }}>{it.itemCode || '—'}</td>
                          <td style={{ padding:'8px 10px', fontWeight:500 }}>{it.itemName}</td>
                          <td style={{ padding:'8px 10px', color:'#64748b' }}>{it.unit}</td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <input type="number" min="0" step="0.001"
                              value={it.qty}
                              onChange={e => setItem(idx, 'qty', e.target.value)}
                              disabled={isPaid}
                              style={{ width:80, padding:'5px 8px', textAlign:'right',
                                border:'1.5px solid #e2e8f0', borderRadius:6, fontSize:13,
                                fontFamily:'inherit', background: isPaid ? '#f8fafc' : '#fff' }}
                            />
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <input type="number" min="0" step="0.01"
                              value={it.rate}
                              onChange={e => setItem(idx, 'rate', e.target.value)}
                              disabled={isPaid}
                              style={{ width:90, padding:'5px 8px', textAlign:'right',
                                border:'1.5px solid #e2e8f0', borderRadius:6, fontSize:13,
                                fontFamily:'inherit', background: isPaid ? '#f8fafc' : '#fff' }}
                            />
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <input type="number" min="0" max="50" step="0.1"
                              value={it.taxPct}
                              onChange={e => setItem(idx, 'taxPct', e.target.value)}
                              disabled={isPaid}
                              style={{ width:60, padding:'5px 8px', textAlign:'right',
                                border:'1.5px solid #e2e8f0', borderRadius:6, fontSize:13,
                                fontFamily:'inherit', background: isPaid ? '#f8fafc' : '#fff' }}
                            />
                          </td>
                          <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:600, color:'#0f172a' }}>
                            {fmtCcy(lineT.toFixed(0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8fafc', borderTop:'2px solid #e2e8f0' }}>
                      <td colSpan={6} style={{ padding:'10px 10px', fontWeight:700, color:'#0f172a', fontSize:13 }}>
                        Grand Total (incl. tax)
                      </td>
                      <td style={{ padding:'10px', textAlign:'right', fontWeight:800, fontSize:14, color:'#1d4ed8' }}>
                        {fmtCcy(lineTotal.toFixed(0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Standalone amount — only when no items */}
          {items.length === 0 && (
            <div className="inv-form-grid" style={{ marginBottom:16 }}>
              <div className="inv-field">
                <label className="inv-label">Total Amount (₹) <span className="inv-req">*</span></label>
                <input className="inv-input" type="number" min="0" step="0.01"
                  value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)}
                  disabled={isPaid}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="inv-form-grid">
            <div className="inv-field inv-field--full">
              <label className="inv-label">Notes</label>
              <textarea className="inv-textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          {items.length > 0 && !isPaid && (
            <span style={{ color:'#64748b', fontSize:13, margin:'0 8px' }}>
              Total: <strong style={{ color:'#1d4ed8' }}>{fmtCcy(lineTotal.toFixed(0))}</strong>
            </span>
          )}
          <button className="inv-btn inv-btn--primary" disabled={!canSubmit}
            onClick={() => {
              onSave({
                id:          bill.id,
                billDate:    form.billDate,
                dueDate:     form.dueDate || null,
                totalAmount: finalTotal,
                notes:       form.notes || null,
                vendorName:  bill.vendorName,
                items:       !isPaid ? items.filter(it => Number(it.qty) > 0).map(it => ({
                  id:              it.id,
                  inventoryItemId: it.inventoryItemId,
                  itemCode:        it.itemCode,
                  itemName:        it.itemName,
                  unit:            it.unit,
                  qty:             Number(it.qty)    || 0,
                  rate:            Number(it.rate)   || 0,
                  taxPct:          Number(it.taxPct) || 0,
                })) : [],
              });
              onClose();
            }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Allocate Advance Modal ────────────────────────────────────────────────────
// Shows unpaid bills for the same vendor+scope as the advance.
// User enters how much to allocate from the advance to each bill.
function AllocateAdvanceModal({ open, onClose, onAllocate, advance, bills }) {
  const [allocations, setAllocations] = useState({});  // { billId: amountStr }
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAllocations({});
  }, [open, advance?.id]);

  if (!open || !advance) return null;

  const unapplied = Number(advance.unappliedAmount ?? (advance.amount - (advance.amount || 0)));
  const available = Math.max(0, unapplied);

  // Show bills for this vendor — filter to same vendor, unpaid/pending
  const vendorBills = bills.filter(b =>
    String(b.vendorId) === String(advance.vendorId) &&
    (b.status||'').toLowerCase() !== 'paid' &&
    (b.amount - b.paid) > 0
  );

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = available - totalAllocated;

  const setAlloc = (billId, val) => setAllocations(a => ({ ...a, [billId]: val }));

  const handleAllocationChange = (billId, val, maxBill) => {
    const num = Number(val) || 0;
    const bill = vendorBills.find(b => String(b.id) === String(billId));
    if (!bill) return;
    const othersTotal = Object.entries(allocations)
      .filter(([k]) => k !== String(billId))
      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
    const max = Math.min(available - othersTotal, bill.amount - bill.paid);
    if (num > max + 0.001) return; // block if exceeds
    setAlloc(String(billId), val);
  };

  const toSave = Object.entries(allocations)
    .filter(([, v]) => Number(v) > 0)
    .map(([billId, amount]) => ({ billId: Number(billId), amount: Number(amount) }));

  const canSave = toSave.length > 0 && totalAllocated > 0 && totalAllocated <= available + 0.001;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onAllocate(advance.id, toSave);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Allocate Advance — {advance.paymentNumber}</h3>
            <p className="inv-modal-sub">{advance.vendorName} · {advance.date}</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="inv-modal-body">

          {/* Advance summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Total Advance',   val: fmtCcy(advance.amount),  color:'#0f172a' },
              { label:'Already Applied', val: fmtCcy(advance.appliedAmount || 0), color:'#d97706' },
              { label:'Available',       val: fmtCcy(available),        color: available > 0 ? '#166534' : '#991b1b' },
            ].map(k => (
              <div key={k.label} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Live allocation summary */}
          {totalAllocated > 0 && (
            <div style={{ background: remaining < 0 ? '#fef2f2' : '#f0fdf4', border:`1px solid ${remaining < 0 ? '#fecaca' : '#a7f3d0'}`, borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'#475569' }}>
                Allocating <strong>{fmtCcy(totalAllocated)}</strong> across {toSave.length} bill{toSave.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontWeight:700, color: remaining < 0 ? '#991b1b' : '#166534' }}>
                Remaining: {fmtCcy(Math.max(0, remaining))}
                {remaining < 0 && ' ⚠ EXCEEDS'}
              </span>
            </div>
          )}

          {/* Bills list */}
          {vendorBills.length === 0 ? (
            <div className="inv-empty" style={{ padding:'32px 0' }}>
              <span className="inv-empty-icon">🧾</span>
              <p>No unpaid bills found for <strong>{advance.vendorName}</strong>.</p>
              <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Bills must be in the same group/scope as the advance.</p>
            </div>
          ) : (
            <div style={{ border:'1.5px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Bill No.', 'Date', 'Due Date', 'Bill Total', 'Paid', 'Balance', 'Allocate (₹)'].map(h => (
                      <th key={h} style={{ padding:'9px 12px', textAlign: ['Bill Total','Paid','Balance','Allocate (₹)'].includes(h)?'right':'left', fontWeight:700, fontSize:11, color:'#475569', borderBottom:'1.5px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorBills.map(bill => {
                    const balance = bill.amount - bill.paid;
                    const othersTotal = Object.entries(allocations)
                      .filter(([k]) => k !== String(bill.id))
                      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
                    const max = Math.min(available - othersTotal, balance);
                    const alloc = allocations[String(bill.id)];
                    const allocNum = Number(alloc) || 0;
                    const over = allocNum > max + 0.001;
                    const bsm = BILL_STATUS[bill.status] || BILL_STATUS.UNPAID;
                    return (
                      <tr key={bill.id} style={{ borderBottom:'1px solid #f1f5f9', background: alloc > 0 ? '#f0fdf4' : '#fff' }}>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ fontFamily:'monospace', fontWeight:600, color:'#1e40af', fontSize:12 }}>{bill.billNumber}</div>
                          <span className="inv-status-badge" style={{ background: bsm.bg, color: bsm.color, fontSize:10, marginTop:2, display:'inline-block' }}>{bsm.label}</span>
                        </td>
                        <td style={{ padding:'10px 12px', color:'#64748b' }}>{bill.billDate}</td>
                        <td style={{ padding:'10px 12px', color: bill.status === 'OVERDUE' ? '#991b1b' : '#64748b', fontWeight: bill.status === 'OVERDUE' ? 600 : 400 }}>{bill.dueDate || '—'}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right' }}>{fmtCcy(bill.amount)}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:'#166534' }}>{fmtCcy(bill.paid)}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:'#991b1b', fontWeight:600 }}>{fmtCcy(balance)}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right' }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                            <input type="number" min="0" max={max} step="0.01" placeholder="0.00"
                              value={alloc || ''}
                              onChange={e => handleAllocationChange(bill.id, e.target.value, max)}
                              style={{ width:110, padding:'6px 8px', textAlign:'right',
                                border:`1.5px solid ${over ? '#ef4444' : alloc > 0 ? '#22c55e' : '#e2e8f0'}`,
                                borderRadius:6, fontSize:13 }}
                            />
                            {max > 0 && <button style={{ fontSize:11, color:'#3b82f6', background:'none', border:'none', cursor:'pointer', padding:0 }}
                              onClick={() => setAlloc(String(bill.id), max.toFixed(2))}>
                              Max: {fmtCcy(max)}
                            </button>}
                            {over && <span style={{ fontSize:11, color:'#ef4444' }}>Exceeds max</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary" disabled={!canSave || saving}
            onClick={handleSave}>
            {saving ? 'Saving…' : `Allocate ${fmtCcy(totalAllocated)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Bills & Payments tab is in components/inventory_management/BillsPaymentsTab.js

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryManagementPage() {
  const { user, pagePermissions } = useAuth();
  const toast = useToast();
  const { confirmState, confirm } = useConfirm();

  const invPerms  = pagePermissions?.INVENTORY || [];
  const isAccounts = user?.role && user.role.toUpperCase().startsWith('ACCOUNTS_');
  const isAdmin    = ['ADMIN', 'SUPERADMIN'].includes((user?.role || '').toUpperCase());
  const canView    = invPerms.includes('VIEW')   || isAdmin || isAccounts;
  const canCreate  = invPerms.includes('CREATE') || isAdmin;
  const canEdit    = invPerms.includes('EDIT')   || isAdmin;

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(LS_TAB);
    return saved && saved !== 'alerts' ? saved : 'items';
  });
  const switchTab = t => { setActiveTab(t); localStorage.setItem(LS_TAB, t); };

  // Page-level group / subgroup / project filter (synced across all pages)
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();

  // Selected warehouse — the cascading filter component owns the list;
  // we only track the active id here and fetch its details on demand for
  // the page subtitle ("Viewing Warehouse A · …").
  const [selectedWh, setSelectedWh] = useState(() => localStorage.getItem('inv_active_wh') || '');
  const selectWh = (id) => {
    setSelectedWh(id);
    localStorage.setItem('inv_active_wh', id || '');
  };

  const [activeWarehouse, setActiveWarehouse] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!selectedWh) { setActiveWarehouse(null); return; }
    fetch(`${API}/warehouses/${selectedWh}`, { headers: getAuthHeaders(), credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setActiveWarehouse(data); })
      .catch(() => { if (!cancelled) setActiveWarehouse(null); });
    return () => { cancelled = true; };
  }, [selectedWh]);

  // Warehouse list used by the Add Item / Transaction / Create PO modals so
  // their inline warehouse <select>s can show the available options. The
  // page-level filter component owns its own copy of the list; this is just
  // for the modal forms. Scoped by the active group + subgroup so the user
  // can only pick from warehouses that belong to the current scope.
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    let cancelled = false;
    warehouseApi.list({ groupName, subGroupName })
      .then(data => { if (!cancelled) setWarehouses(Array.isArray(data) ? data : []); })
      .catch(()  => { if (!cancelled) setWarehouses([]); });
    return () => { cancelled = true; };
  }, [groupName, subGroupName]);

  const [items,         setItems]         = useState([]);
  const [itemsLoading,  setItemsLoading]  = useState(false);
  const [itemsError,    setItemsError]    = useState(null);
  // Pagination state — lives here so the warehouse/group filter and the
  // tab's search/category changes can all reset page to 0 together.
  const [itemPage,      setItemPage]      = useState(0);
  const [itemPageSize,  setItemPageSize]  = useState(20);
  const [itemTotal,     setItemTotal]     = useState(0);
  const [itemTotalPages,setItemTotalPages]= useState(0);
  // Server-side filter values — lifted from ItemsTab so changing them
  // triggers a fresh backend fetch rather than just a client-side slice.
  const [itemSearch,    setItemSearch]    = useState('');
  const [itemCategory,  setItemCategory]  = useState('');

  const reloadItems = useCallback(async (page, size, search, category) => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const data = await inventoryItemApi.list({
        warehouseId: selectedWh || undefined,
        groupName, subGroupName,
        search:   search   !== undefined ? search   : itemSearch,
        category: category !== undefined ? category : itemCategory,
        page:     page     !== undefined ? page     : itemPage,
        size:     size     !== undefined ? size     : itemPageSize,
      });
      setItems(Array.isArray(data.content) ? data.content : []);
      setItemTotal(data.totalElements || 0);
      setItemTotalPages(data.totalPages || 0);
    } catch (err) {
      console.error(err);
      setItemsError(err.message);
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [selectedWh, groupName, subGroupName, itemSearch, itemCategory, itemPage, itemPageSize]);

  useEffect(() => { reloadItems(); }, [reloadItems]);

  // When warehouse/group changes reset page to 0 (reloadItems handles the fetch)
  useEffect(() => { setItemPage(0); }, [selectedWh, groupName, subGroupName]);
  // When search or category changes reset to page 0 and refetch
  useEffect(() => { setItemPage(0); reloadItems(0, itemPageSize, itemSearch, itemCategory); },
    [itemSearch, itemCategory]); // eslint-disable-line react-hooks/exhaustive-deps
  const [transactions,setTransactions]= useState(MOCK_TRANSACTIONS);
  const [pos,         setPos]         = useState([]);
  const [bills,       setBills]       = useState([]);
  const [payments,    setPayments]    = useState([]);
  const [vendors,     setVendors]     = useState([]);

  // Load vendors from API once on mount — same pattern as PurchaseOrders page
  useEffect(() => {
    fetch(`${API}/vendors?page=0&size=1000&sortBy=name&sortDirection=ASC`, {
      headers: getAuthHeaders(), credentials: 'include',
    })
      .then(r => r.ok ? r.json() : {})
      .then(d => setVendors(Array.isArray(d.vendors) ? d.vendors : []))
      .catch(() => setVendors([]));
  }, []);

  // Load procurement + transactions scoped to current group/subgroup/warehouse
  const reloadProcurement = useCallback(() => {
    const params = {};
    if (selectedWh)   params.warehouseId  = selectedWh;
    if (groupName)    params.groupName     = groupName;
    if (subGroupName) params.subGroupName  = subGroupName;

    invPoApi.list({ ...params, size: 100 })
      .then(d => setPos((d?.content || []).map(normalizePO)))
      .catch(() => {});
    invBillApi.list({ ...params, size: 100 })
      .then(d => setBills((d?.content || []).map(normalizeBill)))
      .catch(() => {});
    invPaymentApi.list({ groupName: params.groupName, subGroupName: params.subGroupName, size: 100 })
      .then(d => setPayments((d?.content || []).map(normalizePayment)))
      .catch(() => {});
    // Reload transactions from backend too
    invTransactionApi.list({ ...params, size: 200 })
      .then(d => setTransactions((d?.content || []).map(normalizeTxn)))
      .catch(() => {});
  }, [selectedWh, groupName, subGroupName]);

  useEffect(() => { reloadProcurement(); }, [reloadProcurement]);

  const handleCreatePO = async (form) => {
    try {
      const vendor = vendors.find(v => String(v.id) === String(form.vendorId));
      const body = {
        vendorId:        Number(form.vendorId) || null,
        vendorName:      vendor?.name || form.vendorName || '',
        vendorContact:   vendor?.phone || vendor?.contact || '',
        warehouseId:     Number(form.warehouseId) || null,
        groupName:       form.groupName    || null,
        subGroupName:    form.subGroupName || null,
        projectId:       form.projectId    || null,
        orderDate:       form.date,
        expectedDelivery:form.expected,
        paymentTerms:    form.terms,
        notes:           form.notes,
        status:          form.status || 'DRAFT',
        items: (form.lines || []).filter(l => l.qty && l.rate).map(l => ({
          inventoryItemId: l.inventoryItemId || null,
          itemCode: l.itemCode,
          itemName: l.name,
          unit:     l.unit,
          orderedQty: Number(l.qty)  || 0,
          rate:       Number(l.rate) || 0,
          taxPct:     Number(l.tax)  || 0,
        })),
      };
      const saved = await invPoApi.create(body);
      setPos(p => [saved, ...p]);
      toast.add(`Purchase Order ${saved.poNo} created`);
    } catch (err) {
      toast.add(`Failed to create PO: ${err.message}`);
    }
  };

  const handleUpdatePO = async (form) => {
    if (!form.id) return;
    try {
      const vendor = vendors.find(v => String(v.id) === String(form.vendorId));
      const body = {
        vendorId:        Number(form.vendorId) || null,
        vendorName:      vendor?.name || form.vendorName || '',
        vendorContact:   vendor?.phone || vendor?.contact || '',
        warehouseId:     Number(form.warehouseId) || null,
        groupName:       form.groupName    || null,
        subGroupName:    form.subGroupName || null,
        projectId:       form.projectId    || null,
        orderDate:       form.date,
        expectedDelivery:form.expected,
        paymentTerms:    form.terms,
        notes:           form.notes,
        status:          form.status || 'DRAFT',
        items: (form.lines || []).filter(l => l.qty && l.rate).map(l => ({
          id:              l.id    || null,
          inventoryItemId: l.inventoryItemId || null,
          itemCode: l.itemCode, itemName: l.name, unit: l.unit,
          orderedQty: Number(l.qty)  || 0,
          rate:       Number(l.rate) || 0,
          taxPct:     Number(l.tax)  || 0,
        })),
      };
      const res = await fetch(`${API}/inventory/purchase-orders/${form.id}`, {
        method: 'PUT', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'Failed'); }
      const saved = normalizePO(await res.json());
      setPos(prev => prev.map(p => p.id === form.id ? saved : p));
      toast.add(`PO ${saved.poNumber} updated`);
      return true;
    } catch (err) {
      toast.add(`Update failed: ${err.message}`);
      return false;
    }
  };

  const handleCreateBill = async (form) => {
    try {
      // form.poId is the numeric id sent directly by the modal
      const linkedPo = form.poId ? pos.find(p => String(p.id) === String(form.poId)) : null;
      // vendorName: prefer modal-supplied value, fall back to vendors list
      const vendor = vendors.find(v => String(v.id) === String(form.vendorId));
      const vendorName = form.vendorName || vendor?.name || '';
      const body = {
        vendorId:    Number(form.vendorId) || null,
        vendorName:  vendorName,
        poId:        form.poId ? Number(form.poId) : null,
        warehouseId: form.warehouseId ? Number(form.warehouseId) : (linkedPo?.warehouseId || Number(selectedWh) || null),
        groupName:   form.groupName    || linkedPo?.groupName    || groupName    || null,
        subGroupName:form.subGroupName || linkedPo?.subGroupName || subGroupName || null,
        projectId:   form.projectId    || linkedPo?.projectId    || null,
        billDate:    form.billDate,
        dueDate:     form.dueDate || null,
        totalAmount: Number(form.totalAmount) || 0,
        notes:       form.notes || null,
        items:       form.items || [],
      };
      const saved = await invBillApi.create(body);
      setBills(b => [saved, ...b]);
      // Refresh PO list to pick up any status change (PARTIAL/RECEIVED)
      if (body.poId) reloadProcurement();
      toast.add(`Bill ${saved.billNo} created`);
    } catch (err) {
      toast.add(`Failed to create bill: ${err.message}`);
    }
  };

  const handleRecordPayment = async (form) => {
    try {
      const isAdvance = form.payType === 'ADVANCE';
      const bill = !isAdvance ? bills.find(b => String(b.id) === String(form.billId)) : null;
      const body = {
        billId:          isAdvance ? null : (bill?.id || null),
        vendorId:        Number(form.vendorId) || bill?.vendorId || null,
        vendorName:      form.vendorName || bill?.vendorName || '',
        warehouseId:     form.warehouseId ? Number(form.warehouseId) : (bill?.warehouseId || null),
        groupName:       form.groupName   || bill?.groupName    || groupName    || null,
        subGroupName:    form.subGroupName|| bill?.subGroupName || subGroupName || null,
        projectId:       bill?.projectId  || null,
        paymentDate:     form.date,
        amount:          Number(form.amount) || 0,
        paymentMode:     form.mode,
        referenceNumber: form.reference,
        notes:           form.notes,
      };
      const saved = await invPaymentApi.create(body);
      setPayments(p => [normalizePayment(saved), ...p]);
      // Refresh bills to show updated paidAmount + status
      reloadProcurement();
      toast.add(`${isAdvance ? 'Advance' : 'Payment'} ${saved.paymentNo} recorded`);
    } catch (err) {
      toast.add(`Failed to record payment: ${err.message}`);
    }
  };

  const [addOpen,     setAddOpen]     = useState(false);
  const [txnOpen,     setTxnOpen]     = useState(false);
  const [txnViewOpen, setTxnViewOpen] = useState(false);  // view transaction detail
  const [txnEditOpen, setTxnEditOpen] = useState(false);  // edit transaction
  const [activeTxn,   setActiveTxn]   = useState(null);   // transaction being viewed/edited
  const [poOpen,      setPoOpen]      = useState(false);
  const [billOpen,    setBillOpen]    = useState(false);
  const [payOpen,     setPayOpen]     = useState(false);
  const [editPoOpen,  setEditPoOpen]  = useState(false);
  const [editingPO,   setEditingPO]   = useState(null);
  const [editingBill, setEditingBill] = useState(null);  // bill being edited
  const [editingPay,  setEditingPay]  = useState(null);  // payment being edited
  const [allocatingAdv, setAllocatingAdv] = useState(null); // advance being allocated
  // New states for edit/delete/detail
  const [viewItem,    setViewItem]    = useState(null);  // item being viewed in detail page
  const [detailTab,   setDetailTab]   = useState('overview'); // active tab inside item detail
  const [editItem,    setEditItem]    = useState(null);  // item being edited
  const [editItemOpen, setEditItemOpen] = useState(false);

  // Warehouse-scoped views — everything below the warehouse selector reads from these
  // Items are already warehouse-scoped by the backend (`reloadItems` passes
  // warehouseId). Transactions remain client-side for now (Phase 3), so we
  // still filter them locally by joining through the visible items' codes.
  const visibleItems = items;
  const visibleItemCodes = new Set(visibleItems.map(i => i.itemCode));
  const visibleTransactions = selectedWh
    ? transactions.filter(t => visibleItemCodes.has(t.itemCode))
    : transactions;

  const handleAddItem = async (form) => {
    try {
      const body = {
        warehouseId:  Number(form.warehouseId) || null,
        itemCode:     form.itemCode,
        name:         form.name,
        category:     form.category,
        unit:         form.unit,
        currentQty:   Number(form.currentQty) || 0,
        minQty:       Number(form.minQty)     || 0,
        maxQty:       Number(form.maxQty)     || 0,
        unitCost:     Number(form.unitCost)   || 0,
        projectId:    form.projectId || null,
        // groupName & subGroupName come from the form's scope selectors
        // (which auto-inherit from the picked warehouse). This guarantees the
        // item is visible under the correct filter without any extra mapping.
        groupName:    form.groupName    || null,
        subGroupName: form.subGroupName || null,
        notes:        form.note || null,
        isActive:     true,
      };
      const saved = await inventoryItemApi.create(body);
      setItems(prev => [saved, ...prev]);
      setItemTotal(t => t + 1);
      toast.add(`"${saved.name}" added to ${saved.location || 'inventory'}`);
    } catch (err) {
      console.error(err);
      toast.add(`Failed to add item: ${err.message}`);
    }
  };

  // Bulk add — one request, partial success supported. The shared scope
  // (warehouse/group/subgroup) applies to every row; each row carries its own
  // code/name/qtys. The backend returns created rows + per-row failures.
  const handleBulkAddItems = async ({ scope, rows }) => {
    try {
      const body = {
        warehouseId:  Number(scope.warehouseId) || null,
        groupName:    scope.groupName    || null,
        subGroupName: scope.subGroupName || null,
        items: rows.map(r => ({
          itemCode:   (r.itemCode || '').trim(),
          name:       (r.name || '').trim(),
          category:   r.category,
          unit:       r.unit,
          currentQty: Number(r.currentQty) || 0,
          minQty:     Number(r.minQty)     || 0,
          maxQty:     Number(r.maxQty)     || 0,
          unitCost:   Number(r.unitCost)   || 0,
          projectId:  r.projectId || null,
          notes:      r.note || null,
        })),
      };
      const res = await inventoryItemApi.bulkCreate(body);
      const created = Array.isArray(res.created) ? res.created : [];
      const failed  = Array.isArray(res.failed)  ? res.failed  : [];

      if (created.length) {
        setItems(prev => [...created, ...prev]);
        setItemTotal(t => t + created.length);
      }
      if (created.length && !failed.length) {
        toast.add(`${created.length} item${created.length === 1 ? '' : 's'} added`);
      } else if (created.length && failed.length) {
        toast.add(`${created.length} added · ${failed.length} skipped (${failed[0]?.message || 'duplicate / invalid'})`);
      } else {
        toast.add(`No items added — ${failed[0]?.message || 'check codes and required fields'}`);
      }
    } catch (err) {
      console.error(err);
      toast.add(`Bulk add failed: ${err.message}`);
    }
  };

  const handleTransaction = async (form) => {
    try {
      if (form.type === 'OUTWARD') {
        // ── Multi-item OUTWARD: batch endpoint ────────────────────────────
        const lines = (form.lines || [])
          .filter(l => l.inventoryItemId && l.qty)
          .map(l => ({
            inventoryItemId: Number(l.inventoryItemId),
            qty:             Number(l.qty),
            unitCost:        Number(l.unitCost) || 0,
          }));
        if (!lines.length) { toast.add('Add at least one item with quantity'); return; }
        if (!form.projectId) { toast.add('Project is required for outward transactions'); return; }

        const body = {
          type:            'OUTWARD',
          warehouseId:     form.warehouseId ? Number(form.warehouseId) : null,
          groupName:       form.groupName      || null,
          subGroupName:    form.subGroupName   || null,
          projectId:       form.projectId      || null,
          ref:             form.ref            || null,
          note:            form.note           || null,
          transactionDate: form.date           || null,
          lines,
        };

        const res = await fetch(`${API}/inventory/transactions/batch-outward`, {
          method: 'POST', headers: getAuthHeaders(), credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Batch outward failed'); }
        const result = await res.json();

        reloadItems(itemPage, itemPageSize, itemSearch, itemCategory);
        invTransactionApi.list({ size: 200 })
          .then(d => setTransactions((d.content || []).map(normalizeTxn)))
          .catch(() => {});

        const billMsg = result.autoBillNo ? ` · Bill ${result.autoBillNo} created` : '';
        toast.add(`${result.itemCount || lines.length} item${lines.length > 1 ? 's' : ''} issued${billMsg}`);

      } else if (form.type === 'INWARD' && (form.poLines || []).some(l => l.poItemId && l.qty)) {
        // ── Multi-item INWARD from site (PO-linked) ───────────────────────
        const poLines = (form.poLines || []).filter(l => l.poItemId && l.qty);
        if (!form.warehouseId) { toast.add('Warehouse is required'); return; }

        const buildBody = (lines) => ({
          type:            'INWARD',
          warehouseId:     Number(form.warehouseId),
          groupName:       form.groupName      || null,
          subGroupName:    form.subGroupName   || null,
          projectId:       form.projectId      || null,
          ref:             form.ref            || null,
          note:            form.note           || null,
          transactionDate: form.date           || null,
          poLines: lines,
        });

        const submitInward = async (resolvedLines) => {
          const res = await fetch(`${API}/inventory/transactions/batch-inward`, {
            method: 'POST', headers: getAuthHeaders(), credentials: 'include',
            body: JSON.stringify(buildBody(resolvedLines)),
          });
          if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Batch inward failed'); }
          return await res.json();
        };

        // Build initial lines (no conflict decisions yet)
        let mappedLines = poLines.map(l => ({
          poId:            Number(l.poId),
          poItemId:        Number(l.poItemId),
          inventoryItemId: l.inventoryItemId ? Number(l.inventoryItemId) : null,
          itemCode:        l.itemCode || '',
          itemName:        l.itemName || '',
          unit:            l.unit || '',
          qty:             Number(l.qty),
          unitCost:        Number(l.unitCost) || 0,
        }));

        // First call — backend detects conflicts
        let result = await submitInward(mappedLines);

        // If conflicts returned, show per-item confirmation dialogs
        if (result.requiresConfirmation && result.conflicts?.length) {
          // Resolve each conflict sequentially
          const decisions = {}; // lineIndex → 'ADD' | 'CREATE'
          for (const conflict of result.conflicts) {
            await new Promise((resolve) => {
              confirm({
                title: 'Item Already Exists in Stock',
                message: `"${conflict.itemName}" already exists in this warehouse.\n\nExisting item: ${conflict.existingItemCode} — current stock: ${conflict.existingCurrentQty}\nReceiving: ${conflict.qty}\n\nDo you want to add this quantity to the existing item, or create a new separate item?`,
                type: 'confirm',
                confirmText:  'Add to Existing',
                cancelText:   'Create New Item',
                onConfirm: () => { decisions[conflict.lineIndex] = 'ADD';    resolve(); },
                onCancel:  () => { decisions[conflict.lineIndex] = 'CREATE'; resolve(); },
              });
            });
          }

          // Rebuild lines with conflict decisions
          mappedLines = poLines.map((l, idx) => {
            const conflict = result.conflicts.find(c => c.lineIndex === idx);
            const decision = decisions[idx];
            return {
              poId:            Number(l.poId),
              poItemId:        Number(l.poItemId),
              inventoryItemId: l.inventoryItemId ? Number(l.inventoryItemId) : null,
              itemCode:        l.itemCode || '',
              itemName:        l.itemName || '',
              unit:            l.unit || '',
              qty:             Number(l.qty),
              unitCost:        Number(l.unitCost) || 0,
              conflictAction:  decision || null,
              existingItemId:  conflict ? conflict.existingItemId : null,
            };
          });

          // Second call — with conflict resolutions
          result = await submitInward(mappedLines);
        }

        reloadItems(itemPage, itemPageSize, itemSearch, itemCategory);
        invTransactionApi.list({ size: 200 })
          .then(d => setTransactions((d.content || []).map(normalizeTxn)))
          .catch(() => {});

        const newItemsMsg = result.newItemsCreated > 0 ? ` · ${result.newItemsCreated} new item(s) created` : '';
        toast.add(`${result.itemCount || poLines.length} item${poLines.length > 1 ? 's' : ''} received${newItemsMsg}`);

      } else {
        // ── Single-item INWARD / ADJUSTMENT / TRANSFER / RETURN ───────────
        const body = {
          type:            form.type,
          inventoryItemId: Number(form.itemId) || null,
          qty:             Number(form.qty)    || 0,
          groupName:       form.groupName      || null,
          subGroupName:    form.subGroupName   || null,
          projectId:       form.projectId      || null,
          refNo:           form.ref            || null,
          notes:           form.note           || null,
          transactionDate: form.date           || null,
        };
        const saved = await invTransactionApi.create(body);
        const txn   = normalizeTxn(saved);
        setTransactions(prev => [txn, ...prev]);
        reloadItems(itemPage, itemPageSize, itemSearch, itemCategory);
        toast.add(`Transaction ${saved.txnNo} recorded`);
      }
    } catch (err) {
      toast.add(`Transaction failed: ${err.message}`);
    }
  };

  // ── Edit transaction ───────────────────────────────────────────────────────
  const handleEditTransaction = async (form) => {
    try {
      const body = {
        refNo:           form.ref   || null,
        notes:           form.note  || null,
        transactionDate: form.date  || null,
        projectId:       form.projectId || null,
        groupName:       form.groupName || null,
        subGroupName:    form.subGroupName || null,
      };
      const res = await fetch(`${API}/inventory/transactions/${form.id}`, {
        method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Update failed'); }
      const saved = await res.json();
      const txn = normalizeTxn(saved);
      setTransactions(prev => prev.map(t => t.id === txn.id ? txn : t));
      toast.add(`Transaction ${txn.txnNo || txn.id} updated`);
    } catch (err) {
      toast.add(`Update failed: ${err.message}`);
    }
  };

  // ── Edit item ─────────────────────────────────────────────────────────────
  const handleEditItem = async (form) => {
    try {
      const body = {
        itemCode:    form.itemCode   || null,
        name:        form.name,
        category:    form.category   || null,
        unit:        form.unit       || null,
        currentQty:  Number(form.currentQty) || 0,
        unitCost:    Number(form.unitCost)   || 0,
        minQty:      Number(form.minQty)     || 0,
        maxQty:      Number(form.maxQty)     || 0,
        groupName:   form.groupName    || null,
        subGroupName:form.subGroupName || null,
        warehouseId: form.warehouseId  ? Number(form.warehouseId) : null,
        projectId:   form.projectId    || null,
        isActive:    form.isActive     !== false,
        notes:       form.notes        || null,
      };
      const saved = await inventoryItemApi.update(form.id, body);
      setItems(prev => prev.map(i => i.id === form.id ? { ...i, ...saved } : i));
      if (viewItem?.id === form.id) setViewItem(prev => ({ ...prev, ...saved }));
      toast.add(`"${saved.name}" updated`);
    } catch (err) {
      toast.add(`Update failed: ${err.message}`);
    }
  };

  // ── Delete item ───────────────────────────────────────────────────────────
  const handleDeleteItem = (item) => {
    confirm({
      title: 'Delete Item',
      message: `Delete "${item.name}" (${item.itemCode})?\n\nThis cannot be undone.`,
      type: 'alert',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await inventoryItemApi.remove(item.id);
          setItems(prev => prev.filter(i => i.id !== item.id));
          setItemTotal(t => t - 1);
          if (viewItem?.id === item.id) setViewItem(null);
          toast.add(`"${item.name}" deleted`);
        } catch (err) {
          toast.add(`Delete failed: ${err.message}`);
        }
      },
    });
  };

  // ── Delete transaction (hard delete — reverses stock, removes row) ────────
  const handleDeleteTxn = (txn) => {
    const isOutward = txn.type === 'OUTWARD';
    confirm({
      title: 'Delete Transaction',
      message: `Delete transaction ${txn.txnNo || txn.id}?\n\nThis will:\n• Reverse the stock change\n• Permanently remove this record${isOutward ? '\n• Delete the auto-generated warehouse bill' : ''}\n\nThis cannot be undone.`,
      type: 'alert',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API}/inventory/transactions/${txn.id}`, {
            method: 'DELETE', headers: getAuthHeaders(), credentials: 'include'
          });
          if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Failed');
          const result = await res.json();

          // Remove transaction from local state
          setTransactions(prev => prev.filter(t => t.id !== txn.id));

          // Remove cascade-deleted warehouse bills from bills state
          const deletedBillNos = result.deletedBillNos || [];
          if (deletedBillNos.length > 0) {
            setBills(prev => prev.filter(b => !deletedBillNos.includes(b.billNumber || b.billNo)));
          }

          // Reload items (stock updated) and full bill list to stay in sync
          reloadItems(itemPage, itemPageSize, itemSearch, itemCategory);
          if (isOutward) {
            // Reload bills to reflect deletion in bills tab
            invBillApi.list({ size: 200 })
              .then(d => setBills((d?.content || []).map(normalizeBill)))
              .catch(() => {});
          }

          const billMsg = deletedBillNos.length > 0 ? ` · Bill ${deletedBillNos.join(', ')} deleted` : '';
          toast.add(`Transaction ${txn.txnNo || txn.id} deleted${billMsg}`);
        } catch (err) {
          toast.add(`Delete failed: ${err.message}`);
        }
      },
    });
  };

  // ── Delete PO ─────────────────────────────────────────────────────────────
  const handleDeletePO = (po) => {
    confirm({
      title: 'Delete Purchase Order',
      message: `Delete PO ${po.poNumber}?\n\nVendor: ${po.vendorName}\nAmount: ${fmtCcy(po.totalValue || 0)}\n\nThis cannot be undone.`,
      type: 'alert',
      confirmText: 'Delete PO',
      onConfirm: async () => {
        try {
          await invPoApi.delete(po.id);
          setPos(prev => prev.filter(p => p.id !== po.id));
          toast.add(`PO ${po.poNumber} deleted`);
        } catch (err) {
          toast.add(`Delete failed: ${err.message}`);
        }
      },
    });
  };

  // ── Edit bill ────────────────────────────────────────────────────────────
  const handleEditBill = async (form) => {
    if (!form.id) return;
    try {
      const body = {
        billDate:    form.billDate,
        dueDate:     form.dueDate || null,
        totalAmount: Number(form.totalAmount) || 0,
        notes:       form.notes || null,
        vendorName:  form.vendorName || null,
        items:       form.items || [],
      };
      const saved = normalizeBill(await invBillApi.update(form.id, body));
      setBills(prev => prev.map(b => b.id === form.id ? saved : b));
      reloadProcurement();
      toast.add(`Bill ${saved.billNumber} updated`);
    } catch (err) {
      toast.add(`Update failed: ${err.message}`);
    }
  };

  // ── Edit payment ──────────────────────────────────────────────────────────
  const handleEditPayment = async (form) => {
    if (!form.id) return;
    try {
      const body = {
        paymentDate:     form.date,
        amount:          Number(form.amount) || 0,
        paymentMode:     form.mode,
        referenceNumber: form.reference,
        notes:           form.notes,
        vendorName:      form.vendorName || null,
        groupName:       form.groupName  || null,
        subGroupName:    form.subGroupName || null,
        warehouseId:     form.warehouseId ? Number(form.warehouseId) : null,
      };
      const saved = normalizePayment(await invPaymentApi.update(form.id, body));
      setPayments(prev => prev.map(p => p.id === form.id ? saved : p));
      reloadProcurement();
      toast.add(`Payment ${saved.paymentNumber} updated`);
    } catch (err) {
      toast.add(`Update failed: ${err.message}`);
    }
  };

  // ── Delete bill ───────────────────────────────────────────────────────────
  const handleDeleteBill = (bill) => {
    const hasPaid = bill.paid > 0;
    confirm({
      title: 'Delete Bill',
      message: hasPaid
        ? `Delete bill ${bill.billNumber}?\n\nVendor: ${bill.vendorName}\nAmount: ${fmtCcy(bill.amount)}\nPaid: ${fmtCcy(bill.paid)}\n\n⚠ This bill has payments recorded. Deleting will reverse the PO item quantities and restore bill balance.\n\nNote: This cannot be undone.`
        : `Delete bill ${bill.billNumber}?\n\nVendor: ${bill.vendorName}\nAmount: ${fmtCcy(bill.amount)}\n\n⚠ This will reverse the delivered quantities on the linked PO items.\n\nNote: This cannot be undone.`,
      type: 'alert',
      confirmText: 'Delete Bill',
      onConfirm: async () => {
        try {
          await invBillApi.delete(bill.id);
          setBills(prev => prev.filter(b => b.id !== bill.id));
          reloadProcurement();
          toast.add(`Bill ${bill.billNumber} deleted — PO quantities reversed`);
        } catch (err) {
          toast.add(`Delete failed: ${err.message}`);
        }
      },
    });
  };

  // ── Delete payment ────────────────────────────────────────────────────────
  const handleDeletePayment = (pay) => {
    const isAdv = !pay.billId;
    confirm({
      title: isAdv ? 'Delete Advance Payment' : 'Delete Payment',
      message: isAdv
        ? `Delete advance payment ${pay.paymentNumber}?\n\nVendor: ${pay.vendorName}\nAmount: ${fmtCcy(pay.amount)}\nMode: ${pay.mode || '—'}\n\nNote: This cannot be undone.`
        : `Delete payment ${pay.paymentNumber}?\n\nVendor: ${pay.vendorName}\nAmount: ${fmtCcy(pay.amount)}\nBill Ref: ${pay.billNumber || '—'}\n\n⚠ This will reverse the bill's paid amount and reopen the bill balance.\n\nNote: This cannot be undone.`,
      type: 'alert',
      confirmText: 'Delete Payment',
      onConfirm: async () => {
        try {
          await invPaymentApi.delete(pay.id);
          reloadProcurement();
          toast.add(`Payment ${pay.paymentNumber} deleted${isAdv ? '' : ' — bill balance restored'}`);
        } catch (err) {
          toast.add(`Delete failed: ${err.message}`);
        }
      },
    });
  };

  // ── Allocate advance ──────────────────────────────────────────────────────
  const handleAllocateAdvance = async (advanceId, allocations) => {
    try {
      const result = await invPaymentApi.allocate(advanceId, allocations);
      if (result.advance) {
        setPayments(prev => prev.map(p =>
          p.id === advanceId ? { ...p, ...normalizePayment(result.advance) } : p
        ));
      }
      if (result.allocations && result.allocations.length > 0) {
        setPayments(prev => [...result.allocations.map(normalizePayment), ...prev]);
      }
      reloadProcurement();
      toast.add(`Advance allocated to ${allocations.length} bill${allocations.length > 1 ? 's' : ''} successfully`);
    } catch (err) {
      toast.add(`Allocation failed: ${err.message}`);
      throw err;
    }
  };

  return (
    <div className="inv-page">
      <ToastStack toasts={toast.toasts} />
      <ConfirmDialogHost confirmState={confirmState} />

      {/* ── Sticky top — switches to breadcrumb when viewing item detail ── */}
      <div className="inv-sticky-top">
        {viewItem ? (
          <ItemDetailNav
            item={viewItem}
            onBack={() => { setViewItem(null); setDetailTab('overview'); }}
            onEdit={item => { setEditItem(item); setEditItemOpen(true); }}
            canEdit={canEdit}
            activeTab={detailTab}
            onTabChange={setDetailTab}
          />
        ) : (
          <>
            <div className="inv-page-header">
              <div className="inv-header-left">
                <div className="inv-header-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="2"/>
                    <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <h1 className="inv-title">Inventory Management</h1>
                  <p className="inv-subtitle">
                    {activeWarehouse
                      ? <>Viewing <strong>{activeWarehouse.name}</strong>{activeWarehouse.city ? ` · ${activeWarehouse.city}` : ''}{activeWarehouse.inCharge ? ` · In-charge: ${activeWarehouse.inCharge}` : ''}</>
                      : 'Track stock levels, movements, and purchase orders across all warehouses.'}
                  </p>
                </div>
              </div>
              <div className="inv-header-right">
                <GroupSubgroupWarehouseFilter
                  groupValue={groupName}
                  subGroupValue={subGroupName}
                  warehouseValue={selectedWh}
                  onChange={(next) => {
                    updateFilters({
                      groupName:    next.groupName,
                      subGroupName: next.subGroupName,
                      projectId:    '',
                    });
                    selectWh(next.warehouseId || '');
                  }}
                />
                {itemsLoading && <span className="inv-filter-hint">Loading…</span>}
                {itemsError && <span className="inv-filter-hint inv-filter-hint--error">⚠ {itemsError}</span>}
              </div>
            </div>

            {/* Tabs */}
            <div className="inv-tabs">
              {[
                { k: 'items',        label: 'Stock',           count: itemTotal },
                { k: 'transactions', label: 'Transactions',    count: visibleTransactions.length },
                { k: 'po',           label: 'Purchase Orders', count: pos.length },
                { k: 'bills',        label: 'Bills & Payments',count: bills.length + payments.length },
              ].map(t => (
                <button key={t.k}
                  className={`inv-tab ${activeTab === t.k ? 'active' : ''}`}
                  onClick={() => switchTab(t.k)}>
                  {t.label}
                  <span className={`inv-tab-count${t.warn ? ' inv-tab-count--warn' : ''}`}>{t.count}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Scroll area — shows detail content or normal tabs ── */}
      <div className="inv-scroll-area">
        {viewItem ? (
          <ItemDetailContent
            item={viewItem}
            transactions={visibleTransactions}
            warehouses={warehouses}
            activeTab={detailTab}
          />
        ) : (
          <>
            {activeTab === 'items' && (
              <ItemsTab items={visibleItems} transactions={visibleTransactions}
                onAddItem={() => setAddOpen(true)} onTransaction={() => setTxnOpen(true)}
                onViewItem={item => { setViewItem(item); setDetailTab('overview'); }}
                onEditItem={item => { setEditItem(item); setEditItemOpen(true); }}
                onDeleteItem={handleDeleteItem}
                canCreate={canCreate} canEdit={canEdit}
                loading={itemsLoading} error={itemsError}
                search={itemSearch}    onSearchChange={v => { setItemSearch(v); }}
                category={itemCategory} onCategoryChange={v => { setItemCategory(v); }}
                page={itemPage}        pageSize={itemPageSize}
                total={itemTotal}      totalPages={itemTotalPages}
                onPageChange={p => { setItemPage(p); reloadItems(p); }}
                onPageSizeChange={s => { setItemPageSize(s); setItemPage(0); reloadItems(0, s); }} />
            )}
            {activeTab === 'transactions' && (
              <TransactionsTab transactions={visibleTransactions}
                onTransaction={() => setTxnOpen(true)}
                onDeleteTxn={handleDeleteTxn}
                onViewTxn={t => { setActiveTxn(t); setTxnViewOpen(true); }}
                onEditTxn={t => { setActiveTxn(t); setTxnEditOpen(true); }}
                canCreate={canCreate} />
            )}
            {activeTab === 'po' && (
              <PurchaseOrdersTab pos={pos} vendors={vendors} items={items}
                bills={bills} payments={payments} warehouses={warehouses}
                onCreate={() => setPoOpen(true)}
                onEdit={po => { setEditingPO(po); setEditPoOpen(true); }}
                onDelete={handleDeletePO}
                canCreate={canCreate} />
            )}
            {activeTab === 'bills' && (
              <BillsPaymentsTab bills={bills} payments={payments} vendors={vendors} pos={pos}
                onCreateBill={() => setBillOpen(true)} onRecordPayment={() => setPayOpen(true)}
                onEditBill={b => { setEditingBill(b); setBillOpen(true); }}
                onEditPayment={p => { setEditingPay(p); setPayOpen(true); }}
                onAllocateAdvance={p => setAllocatingAdv(p)}
                onDeleteBill={handleDeleteBill} onDeletePayment={handleDeletePayment}
                canCreate={canCreate} />
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAddItem}
        onBulkSave={handleBulkAddItems}
        defaultGroupName={groupName} defaultSubGroupName={subGroupName}
        defaultWarehouseId={selectedWh} />
      <EditItemModal open={editItemOpen} onClose={() => setEditItemOpen(false)}
        onSave={handleEditItem} item={editItem} warehouses={warehouses} />
      <TransactionModal open={txnOpen} onClose={() => setTxnOpen(false)} onSave={handleTransaction}
        items={items} warehouses={warehouses} defaultWarehouseId={selectedWh}
        defaultGroupName={groupName} defaultSubGroupName={subGroupName} />
      <ViewTransactionModal open={txnViewOpen} onClose={() => { setTxnViewOpen(false); setActiveTxn(null); }}
        txn={activeTxn} warehouses={warehouses} items={items} />
      <EditTransactionModal open={txnEditOpen} onClose={() => { setTxnEditOpen(false); setActiveTxn(null); }}
        txn={activeTxn} onSave={handleEditTransaction}
        items={items} warehouses={warehouses} />
      <CreatePOModal open={poOpen} onClose={() => setPoOpen(false)} onSave={handleCreatePO}
        items={items} vendors={vendors} warehouses={warehouses} defaultWarehouseId={selectedWh}
        defaultGroupName={groupName} defaultSubGroupName={subGroupName} />
      <CreatePOModal open={editPoOpen} onClose={() => { setEditPoOpen(false); setEditingPO(null); }}
        onSave={handleUpdatePO}
        items={items} vendors={vendors} warehouses={warehouses}
        editData={editingPO} />
      <InvCreateBillModal
        open={billOpen && !editingBill}
        onClose={() => { setBillOpen(false); setEditingBill(null); }}
        onSave={handleCreateBill}
        defaultGroupName={groupName} defaultSubGroupName={subGroupName}
        defaultWarehouseId={selectedWh} />
      {/* Edit bill — lightweight modal reusing same form but pre-filled */}
      {editingBill && billOpen && (
        <EditBillModal
          open={true}
          onClose={() => { setBillOpen(false); setEditingBill(null); }}
          onSave={form => { handleEditBill(form); }}
          bill={editingBill}
          warehouses={warehouses}
        />
      )}
      <InvRecordPaymentModal
        open={payOpen && !editingPay}
        onClose={() => { setPayOpen(false); setEditingPay(null); }}
        onSave={handleRecordPayment} bills={bills} warehouses={warehouses} />
      <InvRecordPaymentModal
        open={payOpen && !!editingPay}
        onClose={() => { setPayOpen(false); setEditingPay(null); }}
        onSave={handleEditPayment} bills={bills} warehouses={warehouses}
        editPayment={editingPay} />
      <AllocateAdvanceModal
        open={!!allocatingAdv}
        onClose={() => setAllocatingAdv(null)}
        onAllocate={handleAllocateAdvance}
        advance={allocatingAdv}
        bills={bills}
      />
    </div>
  );
}