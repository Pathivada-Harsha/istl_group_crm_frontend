import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import '../pages-css/InventoryManagement.css';

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

const CATEGORY_COLORS = {
  'Electrical':  { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  'Mechanical':  { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  'Civil':       { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'Consumable':  { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  'Tool':        { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
  'Other':       { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
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

const UNITS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Roll', 'Sheet', 'Pair', 'Bag'];

// ── Mock data for demo ────────────────────────────────────────────────────────
const MOCK_ITEMS = [
  { id: 1, itemCode: 'EL-001', name: 'Solar Panel 550W Mono', category: 'Electrical', unit: 'Nos', currentQty: 42, minQty: 10, maxQty: 100, unitCost: 18500, projectId: 'PROJ-2026-0015', warehouseId: 1, location: 'Warehouse A', status: 'IN_STOCK', lastUpdated: '2026-05-28' },
  { id: 2, itemCode: 'EL-002', name: 'Inverter 10KW',          category: 'Electrical', unit: 'Nos', currentQty: 6,  minQty: 5,  maxQty: 20,  unitCost: 65000, projectId: 'PROJ-2026-0015', warehouseId: 1, location: 'Warehouse A', status: 'LOW_STOCK',  lastUpdated: '2026-05-29' },
  { id: 3, itemCode: 'EL-003', name: 'AC Cable 6mm²',          category: 'Electrical', unit: 'Mtr', currentQty: 0,  minQty: 50, maxQty: 500, unitCost: 85,    projectId: 'PROJ-2026-0024', warehouseId: 2, location: 'Store B',    status: 'OUT_OF_STOCK',lastUpdated: '2026-05-25' },
  { id: 4, itemCode: 'ME-001', name: 'Module Mounting Clamp',  category: 'Mechanical', unit: 'Set', currentQty: 180,minQty: 50, maxQty: 500, unitCost: 320,   projectId: 'PROJ-2026-0024', warehouseId: 1, location: 'Warehouse A', status: 'IN_STOCK',  lastUpdated: '2026-05-30' },
  { id: 5, itemCode: 'CI-001', name: 'GI Channel 40×40',       category: 'Civil',      unit: 'Mtr', currentQty: 55, minQty: 20, maxQty: 200, unitCost: 410,   projectId: 'PROJ-2026-0033', warehouseId: 3, location: 'Site Store', status: 'IN_STOCK',  lastUpdated: '2026-05-27' },
  { id: 6, itemCode: 'CO-001', name: 'Lugs & Crimping Set',    category: 'Consumable', unit: 'Box', currentQty: 3,  minQty: 5,  maxQty: 30,  unitCost: 750,   projectId: 'PROJ-2026-0033', warehouseId: 2, location: 'Store B',    status: 'LOW_STOCK', lastUpdated: '2026-05-26' },
  { id: 7, itemCode: 'TL-001', name: 'Torque Wrench Set',      category: 'Tool',       unit: 'Set', currentQty: 2,  minQty: 1,  maxQty: 5,   unitCost: 4500,  projectId: 'PROJ-2026-0021', warehouseId: 4, location: 'Tool Room',  status: 'IN_STOCK',  lastUpdated: '2026-05-20' },
  { id: 8, itemCode: 'EL-004', name: 'DC String Cable 4mm²',   category: 'Electrical', unit: 'Mtr', currentQty: 320,minQty: 100,maxQty: 1000,unitCost: 62,    projectId: 'PROJ-2026-0021', warehouseId: 1, location: 'Warehouse A', status: 'IN_STOCK', lastUpdated: '2026-05-28' },
];

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

// ── PO metrics derived from linked bills/payments ─────────────────────────────
// Mirrors procurement: billed → delivery, paid → payment progress.
function getPoMetrics(po, bills) {
  const total       = poTotal(po.items);
  const linkedBills = bills.filter(b => b.poNumber === po.poNumber);
  const billed      = linkedBills.reduce((s, b) => s + b.amount, 0);
  const paid        = linkedBills.reduce((s, b) => s + b.paid, 0);
  const billPct     = total > 0 ? Math.min(100, (billed / total) * 100) : 0;
  const payPct      = total > 0 ? Math.min(100, (paid   / total) * 100) : 0;
  const fraction    = total > 0 ? Math.min(1,   billed / total)        : 0;
  // Auto-override status based on billing progress (manual DRAFT/SENT/APPROVED still wins until first bill)
  const derivedStatus =
      total > 0 && billed >= total ? 'RECEIVED'
    : billed > 0                   ? 'PARTIAL'
    :                                po.status;
  return { total, billed, paid, billPct, payPct, fraction, derivedStatus, linkedBills };
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
function AddItemModal({ open, onClose, onSave, warehouses, defaultWarehouseId }) {
  const [form, setForm] = useState({
    itemCode: '', name: '', category: 'Electrical', unit: 'Nos',
    currentQty: '', minQty: '', maxQty: '', unitCost: '',
    projectId: '', warehouseId: '', note: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Pre-select the active warehouse when modal opens, if one is selected
  React.useEffect(() => {
    if (open) setForm(f => ({ ...f, warehouseId: defaultWarehouseId ? String(defaultWarehouseId) : '' }));
  }, [open, defaultWarehouseId]);

  if (!open) return null;
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Add New Item</h3>
            <p className="inv-modal-sub">Register a new inventory item</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-form-grid">
            <div className="inv-field">
              <label className="inv-label">Item Code <span className="inv-req">*</span></label>
              <input className="inv-input" placeholder="EL-001" value={form.itemCode} onChange={e => set('itemCode', e.target.value)} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Item Name <span className="inv-req">*</span></label>
              <input className="inv-input" placeholder="e.g. Solar Panel 550W Mono" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Category</label>
              <select className="inv-select" value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="inv-field">
              <label className="inv-label">Unit</label>
              <select className="inv-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="inv-field">
              <label className="inv-label">Opening Qty</label>
              <input className="inv-input" type="number" min="0" placeholder="0" value={form.currentQty} onChange={e => set('currentQty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Unit Cost (₹)</label>
              <input className="inv-input" type="number" min="0" placeholder="0.00" value={form.unitCost} onChange={e => set('unitCost', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Min Qty (Reorder Level)</label>
              <input className="inv-input" type="number" min="0" placeholder="0" value={form.minQty} onChange={e => set('minQty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Max Qty</label>
              <input className="inv-input" type="number" min="0" placeholder="0" value={form.maxQty} onChange={e => set('maxQty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Project ID</label>
              <input className="inv-input" placeholder="PROJ-2026-XXXX" value={form.projectId} onChange={e => set('projectId', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Warehouse <span className="inv-req">*</span></label>
              <select className="inv-select" value={form.warehouseId} onChange={e => set('warehouseId', e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Note</label>
              <textarea className="inv-textarea" rows={2} placeholder="Optional description..." value={form.note} onChange={e => set('note', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            disabled={!form.itemCode || !form.name || !form.warehouseId}
            onClick={() => { onSave(form); onClose(); }}>
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transaction Modal ─────────────────────────────────────────────────────────
function TransactionModal({ open, onClose, onSave, items, warehouses, defaultWarehouseId }) {
  const [form, setForm] = useState({
    type: 'INWARD', itemId: '', qty: '', ref: '', note: '', projectId: '', warehouseId: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedItem = items.find(i => String(i.id) === String(form.itemId));

  // When an item is picked, lock the warehouse to that item's warehouse.
  // When no item, default to the page-level warehouse if any.
  React.useEffect(() => {
    if (selectedItem) {
      setForm(f => ({ ...f, warehouseId: String(selectedItem.warehouseId || '') }));
    }
  }, [selectedItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (open && !form.itemId) {
      setForm(f => ({ ...f, warehouseId: defaultWarehouseId ? String(defaultWarehouseId) : '' }));
    }
  }, [open, defaultWarehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--sm" onClick={e => e.stopPropagation()}>
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
            <div className="inv-field inv-field--full">
              <label className="inv-label">Item <span className="inv-req">*</span></label>
              <select className="inv-select" value={form.itemId} onChange={e => set('itemId', e.target.value)}>
                <option value="">Select item…</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.itemCode} — {i.name}</option>)}
              </select>
              {selectedItem && (
                <div className="inv-item-hint">
                  Current stock: <strong>{fmt(selectedItem.currentQty)} {selectedItem.unit}</strong>
                  &nbsp;·&nbsp;Location: {selectedItem.location}
                </div>
              )}
            </div>
            <div className="inv-field">
              <label className="inv-label">Quantity <span className="inv-req">*</span></label>
              <input className="inv-input" type="number" min="0.01" step="0.01" placeholder="0" value={form.qty} onChange={e => set('qty', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Date</label>
              <input className="inv-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Reference (PO / GRN / Issue No.)</label>
              <input className="inv-input" placeholder="e.g. PO-2026-00041" value={form.ref} onChange={e => set('ref', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Warehouse {!selectedItem && <span className="inv-req">*</span>}</label>
              <select className="inv-select" value={form.warehouseId} onChange={e => set('warehouseId', e.target.value)} disabled={!!selectedItem}>
                <option value="">Select warehouse…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {selectedItem && <div className="inv-item-hint" style={{ marginTop: 4 }}>Auto-set from item's warehouse</div>}
            </div>
            <div className="inv-field">
              <label className="inv-label">Project ID</label>
              <input className="inv-input" placeholder="PROJ-2026-XXXX" value={form.projectId} onChange={e => set('projectId', e.target.value)} />
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Note</label>
              <textarea className="inv-textarea" rows={2} placeholder="Reason / details…" value={form.note} onChange={e => set('note', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="inv-modal-actions">
          <button className="inv-btn inv-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn--primary"
            disabled={!form.itemId || !form.qty}
            onClick={() => { onSave(form); onClose(); }}>
            Save Transaction
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item Detail Drawer ────────────────────────────────────────────────────────
function ItemDrawer({ item, transactions, onClose }) {
  if (!item) return null;
  const catMeta  = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
  const statMeta = STOCK_STATUS[item.status] || STOCK_STATUS.IN_STOCK;
  const itemTxns = transactions.filter(t => t.itemCode === item.itemCode);
  const totalValue = item.currentQty * item.unitCost;

  return (
    <div className="inv-drawer-backdrop" onClick={onClose}>
      <div className="inv-drawer" onClick={e => e.stopPropagation()}>
        <div className="inv-drawer-header">
          <div>
            <div className="inv-drawer-code">{item.itemCode}</div>
            <h2 className="inv-drawer-name">{item.name}</h2>
            <div className="inv-drawer-badges">
              <span className="inv-cat-badge" style={{ background: catMeta.bg, color: catMeta.color, borderColor: catMeta.border }}>{item.category}</span>
              <span className="inv-status-badge" style={{ background: statMeta.bg, color: statMeta.color }}>{statMeta.label}</span>
            </div>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* KPI strip */}
        <div className="inv-drawer-kpis">
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmt(item.currentQty)} <span className="inv-drawer-kpi-unit">{item.unit}</span></div>
            <div className="inv-drawer-kpi-lbl">Current Stock</div>
          </div>
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmtCcy(item.unitCost)}</div>
            <div className="inv-drawer-kpi-lbl">Unit Cost</div>
          </div>
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmtCcy(totalValue)}</div>
            <div className="inv-drawer-kpi-lbl">Total Value</div>
          </div>
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmt(item.minQty)} – {fmt(item.maxQty)}</div>
            <div className="inv-drawer-kpi-lbl">Min – Max Qty</div>
          </div>
        </div>

        {/* Stock progress bar */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Stock Level</div>
          <div className="inv-stock-bar-wrap">
            <div className="inv-stock-bar-track">
              <div className="inv-stock-bar-min" style={{ left: `${(item.minQty / item.maxQty) * 100}%` }} title={`Min: ${item.minQty}`} />
              <div className="inv-stock-bar-fill"
                style={{
                  width: `${Math.min(100, (item.currentQty / item.maxQty) * 100)}%`,
                  background: item.status === 'OUT_OF_STOCK' ? '#ef4444' : item.status === 'LOW_STOCK' ? '#f59e0b' : '#10b981'
                }}
              />
            </div>
            <div className="inv-stock-bar-labels">
              <span>0</span><span>Reorder: {item.minQty}</span><span>Max: {item.maxQty}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Details</div>
          <table className="inv-detail-table">
            <tbody>
              <tr><td>Project</td><td>{item.projectId}</td></tr>
              <tr><td>Location</td><td>{item.location}</td></tr>
              <tr><td>Last Updated</td><td>{item.lastUpdated}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Transaction history */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Recent Transactions ({itemTxns.length})</div>
          {itemTxns.length === 0 ? (
            <p className="inv-empty-hint">No transactions yet.</p>
          ) : (
            <div className="inv-txn-list">
              {itemTxns.map(t => {
                const tm = TXN_TYPES[t.type];
                return (
                  <div key={t.id} className="inv-txn-row">
                    <span className="inv-txn-type" style={{ background: tm.bg, color: tm.color }}>{tm.icon} {tm.label}</span>
                    <div className="inv-txn-info">
                      <span className="inv-txn-qty">{t.qty > 0 ? '+' : ''}{fmt(t.qty)} {t.unit}</span>
                      <span className="inv-txn-ref">{t.ref}</span>
                    </div>
                    <span className="inv-txn-date">{t.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiCards({ items }) {
  const totalItems   = items.length;
  const totalValue   = items.reduce((s, i) => s + i.currentQty * i.unitCost, 0);
  const lowStock     = items.filter(i => i.status === 'LOW_STOCK').length;
  const outOfStock   = items.filter(i => i.status === 'OUT_OF_STOCK').length;

  const cards = [
    { icon: '📦', label: 'Total Items',    value: totalItems,       sub: 'registered',                       color: '#1e40af', bg: '#eff6ff' },
    { icon: '💰', label: 'Total Value',    value: fmtCcy(totalValue), sub: 'at current cost',                color: '#065f46', bg: '#ecfdf5' },
    { icon: '⚠️', label: 'Low Stock',      value: lowStock,          sub: 'need reorder',                   color: '#92400e', bg: '#fffbeb', alert: lowStock > 0 },
    { icon: '🔴', label: 'Out of Stock',   value: outOfStock,        sub: 'items unavailable',              color: '#991b1b', bg: '#fef2f2', alert: outOfStock > 0 },
  ];

  return (
    <div className="inv-kpi-grid">
      {cards.map((c, i) => (
        <div key={i} className={`inv-kpi-card${c.alert ? ' inv-kpi-card--alert' : ''}`}
          style={{ borderLeftColor: c.color }}>
          <div className="inv-kpi-icon" style={{ background: c.bg, fontSize: 22 }}>{c.icon}</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{c.value}</div>
            <div className="inv-kpi-label">{c.label}</div>
            <div className="inv-kpi-sub">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Items Tab ─────────────────────────────────────────────────────────────────
function ItemsTab({ items, transactions, onAddItem, onTransaction, canCreate, canEdit }) {
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatus] = useState('');
  const [projFilter, setProj]     = useState('');
  const [selectedItem, setItem]   = useState(null);

  const projects = [...new Set(items.map(i => i.projectId).filter(Boolean))].sort();

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return (
      (!q || i.name.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q)) &&
      (!catFilter || i.category === catFilter) &&
      (!statusFilter || i.status === statusFilter) &&
      (!projFilter || i.projectId === projFilter)
    );
  });

  return (
    <>
      {/* KPIs */}
      <KpiCards items={items} />

      {/* Action bar */}
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by item name or code…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <select className="inv-filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All Categories</option>
            {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="inv-filter-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(STOCK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="inv-filter-select" value={projFilter} onChange={e => setProj(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p}>{p}</option>)}
          </select>
          {(search || catFilter || statusFilter || projFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm"
              onClick={() => { setSearch(''); setCatFilter(''); setStatus(''); setProj(''); }}>
              ✕ Clear
            </button>
          )}
        </div>
        <div className="inv-action-right">
          {canCreate && (
            <button className="inv-btn inv-btn--secondary inv-btn--icon" onClick={onTransaction}>
              ⇄ Record Transaction
            </button>
          )}
          {canCreate && (
            <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onAddItem}>
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="inv-result-count">
        Showing <strong>{filtered.length}</strong> of {items.length} items
      </div>

      {/* Table */}
      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Item Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Unit Cost</th>
              <th style={{ textAlign: 'right' }}>Total Value</th>
              <th>Project</th>
              <th>Location</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="inv-empty-cell">
                  <div className="inv-empty">
                    <span className="inv-empty-icon">📋</span>
                    <p>{search || catFilter || statusFilter ? 'No items match your filters.' : 'No items added yet. Click "+ Add Item" to begin.'}</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(item => {
              const cm = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
              const sm = STOCK_STATUS[item.status] || STOCK_STATUS.IN_STOCK;
              return (
                <tr key={item.id} className="inv-table-row" onClick={() => setItem(item)}>
                  <td className="inv-code-cell">{item.itemCode}</td>
                  <td className="inv-name-cell">{item.name}</td>
                  <td>
                    <span className="inv-cat-badge" style={{ background: cm.bg, color: cm.color, borderColor: cm.border }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: item.status === 'OUT_OF_STOCK' ? '#ef4444' : item.status === 'LOW_STOCK' ? '#f59e0b' : '#0f172a' }}>
                    {fmt(item.currentQty)}
                  </td>
                  <td className="inv-muted">{item.unit}</td>
                  <td style={{ textAlign: 'right' }}>{fmtCcy(item.unitCost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCcy(item.currentQty * item.unitCost)}</td>
                  <td className="inv-muted">{item.projectId || '—'}</td>
                  <td className="inv-muted">{item.location}</td>
                  <td>
                    <span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>
                      {sm.label}
                    </span>
                  </td>
                  <td className="inv-muted">{item.lastUpdated}</td>
                  <td>
                    <button className="inv-view-btn" onClick={e => { e.stopPropagation(); setItem(item); }}>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selectedItem && (
        <ItemDrawer item={selectedItem} transactions={transactions} onClose={() => setItem(null)} />
      )}
    </>
  );
}

// ── Transactions Tab ──────────────────────────────────────────────────────────
function TransactionsTab({ transactions, onTransaction, canCreate }) {
  const [search, setSearch]   = useState('');
  const [typeFilter, setType] = useState('');
  const [projFilter, setProj] = useState('');

  const projects = [...new Set(transactions.map(t => t.projectId).filter(Boolean))].sort();

  const filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    return (
      (!q || t.itemName.toLowerCase().includes(q) || t.itemCode.toLowerCase().includes(q) || (t.ref || '').toLowerCase().includes(q)) &&
      (!typeFilter || t.type === typeFilter) &&
      (!projFilter || t.projectId === projFilter)
    );
  });

  return (
    <>
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by item, code or reference…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <select className="inv-filter-select" value={typeFilter} onChange={e => setType(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(TXN_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="inv-filter-select" value={projFilter} onChange={e => setProj(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p}>{p}</option>)}
          </select>
          {(search || typeFilter || projFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm"
              onClick={() => { setSearch(''); setType(''); setProj(''); }}>
              ✕ Clear
            </button>
          )}
        </div>
        {canCreate && (
          <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onTransaction}>
            ⇄ Record Transaction
          </button>
        )}
      </div>

      <div className="inv-result-count">
        Showing <strong>{filtered.length}</strong> of {transactions.length} transactions
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Item Code</th>
              <th>Item Name</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th>Unit</th>
              <th>Reference</th>
              <th>Project</th>
              <th>Note</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">📋</span><p>No transactions found.</p></div>
              </td></tr>
            ) : filtered.map(t => {
              const tm = TXN_TYPES[t.type];
              return (
                <tr key={t.id} className="inv-table-row">
                  <td className="inv-muted">{t.date}</td>
                  <td>
                    <span className="inv-txn-type" style={{ background: tm.bg, color: tm.color }}>
                      {tm.icon} {tm.label}
                    </span>
                  </td>
                  <td className="inv-code-cell">{t.itemCode}</td>
                  <td className="inv-name-cell">{t.itemName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600,
                    color: ['OUTWARD','TRANSFER'].includes(t.type) ? '#ef4444' : t.qty < 0 ? '#ef4444' : '#166534' }}>
                    {t.qty > 0 && !['OUTWARD','TRANSFER'].includes(t.type) ? '+' : ''}{fmt(t.qty)}
                  </td>
                  <td className="inv-muted">{t.unit}</td>
                  <td className="inv-code-cell">{t.ref || '—'}</td>
                  <td className="inv-muted">{t.projectId || '—'}</td>
                  <td className="inv-note-cell" title={t.note}>{t.note}</td>
                  <td className="inv-muted">{t.by}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS — Modal + Tab
// ═════════════════════════════════════════════════════════════════════════════
function CreatePOModal({ open, onClose, onSave, items, vendors, warehouses, defaultWarehouseId }) {
  const blankLine = () => ({ itemCode: '', name: '', qty: '', unit: 'Nos', rate: '', tax: 18 });
  const [form, setForm] = useState({
    vendorId: '', date: new Date().toISOString().slice(0, 10), expected: '',
    projectId: '', warehouseId: '', terms: 'Net 30', notes: '', lines: [blankLine()]
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (open) setForm(f => ({ ...f, warehouseId: defaultWarehouseId ? String(defaultWarehouseId) : '' }));
  }, [open, defaultWarehouseId]);
  const setLine = (idx, k, v) => setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, [k]: v } : l) }));
  const addLine    = () => setForm(f => ({ ...f, lines: [...f.lines, blankLine()] }));
  const removeLine = (idx) => setForm(f => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== idx) : f.lines }));

  const pickItem = (idx, itemCode) => {
    const it = items.find(i => i.itemCode === itemCode);
    if (it) setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, itemCode: it.itemCode, name: it.name, unit: it.unit, rate: it.unitCost } : l) }));
    else setLine(idx, 'itemCode', itemCode);
  };

  const total = poTotal(form.lines);

  if (!open) return null;
  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="inv-modal-header">
          <div>
            <h3 className="inv-modal-title">Create Purchase Order</h3>
            <p className="inv-modal-sub">Issue a PO to a vendor with line items</p>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-form-grid">
            <div className="inv-field inv-field--full">
              <label className="inv-label">Vendor <span className="inv-req">*</span></label>
              <select className="inv-select" value={form.vendorId} onChange={e => set('vendorId', e.target.value)}>
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name} — {v.gstin}</option>)}
              </select>
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
              <label className="inv-label">Project ID</label>
              <input className="inv-input" placeholder="PROJ-2026-XXXX" value={form.projectId} onChange={e => set('projectId', e.target.value)} />
            </div>
            <div className="inv-field">
              <label className="inv-label">Delivery Warehouse <span className="inv-req">*</span></label>
              <select className="inv-select" value={form.warehouseId} onChange={e => set('warehouseId', e.target.value)}>
                <option value="">Select warehouse…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
            <div className="inv-field">
              <label className="inv-label">Payment Terms</label>
              <input className="inv-input" placeholder="e.g. Net 30 / 50% advance" value={form.terms} onChange={e => set('terms', e.target.value)} />
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
                <div>Item</div>
                <div>Description</div>
                <div style={{ textAlign:'right' }}>Qty</div>
                <div>Unit</div>
                <div style={{ textAlign:'right' }}>Rate (₹)</div>
                <div style={{ textAlign:'right' }}>Tax %</div>
                <div style={{ textAlign:'right' }}>Subtotal</div>
                <div></div>
              </div>
              {form.lines.map((l, idx) => {
                const sub = (Number(l.qty)||0) * (Number(l.rate)||0);
                const lineTotal = sub + (sub * (Number(l.tax)||0) / 100);
                return (
                  <div key={idx} className="inv-lineitems-row">
                    <select className="inv-input inv-input--sm" value={l.itemCode} onChange={e => pickItem(idx, e.target.value)}>
                      <option value="">— pick —</option>
                      {items.map(i => <option key={i.id} value={i.itemCode}>{i.itemCode}</option>)}
                    </select>
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
          <button className="inv-btn inv-btn--secondary"
            disabled={!form.vendorId}
            onClick={() => { onSave({ ...form, status: 'DRAFT' }); onClose(); }}>
            Save as Draft
          </button>
          <button className="inv-btn inv-btn--primary"
            disabled={!form.vendorId || !form.warehouseId || !form.lines.some(l => l.qty && l.rate)}
            onClick={() => { onSave({ ...form, status: 'SENT' }); onClose(); }}>
            Send PO to Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseOrdersTab({ pos, vendors, items, bills, payments, warehouses, onCreate, canCreate }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');
  const [vendorFilter, setVendor] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);

  const filtered = pos.filter(p => {
    const q = search.toLowerCase();
    const m = getPoMetrics(p, bills);
    return (!q || p.poNumber.toLowerCase().includes(q) || p.vendorName.toLowerCase().includes(q))
        && (!statusFilter || m.derivedStatus === statusFilter)
        && (!vendorFilter || String(p.vendorId) === vendorFilter);
  });

  // Aggregate KPIs from derived metrics
  const agg = pos.reduce((acc, p) => {
    const m = getPoMetrics(p, bills);
    acc.totalValue += m.total;
    acc.totalBilled += m.billed;
    acc.totalPaid += m.paid;
    if (m.derivedStatus === 'RECEIVED') acc.receivedCount++;
    else if (['DRAFT','SENT','APPROVED','PARTIAL'].includes(m.derivedStatus)) acc.openCount++;
    return acc;
  }, { totalValue: 0, totalBilled: 0, totalPaid: 0, openCount: 0, receivedCount: 0 });

  return (
    <>
      <div className="inv-kpi-grid">
        <div className="inv-kpi-card" style={{ borderLeftColor: '#1e40af' }}>
          <div className="inv-kpi-icon" style={{ background: '#eff6ff', fontSize: 22 }}>📄</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{pos.length}</div>
            <div className="inv-kpi-label">Total POs</div>
            <div className="inv-kpi-sub">{agg.openCount} open · {agg.receivedCount} received</div>
          </div>
        </div>
        <div className="inv-kpi-card" style={{ borderLeftColor: '#065f46' }}>
          <div className="inv-kpi-icon" style={{ background: '#ecfdf5', fontSize: 22 }}>💰</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{fmtCcy(agg.totalValue.toFixed(0))}</div>
            <div className="inv-kpi-label">PO Value</div>
            <div className="inv-kpi-sub">incl. taxes</div>
          </div>
        </div>
        <div className="inv-kpi-card" style={{ borderLeftColor: '#854d0e' }}>
          <div className="inv-kpi-icon" style={{ background: '#fffbeb', fontSize: 22 }}>🧾</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{fmtCcy(agg.totalBilled.toFixed(0))}</div>
            <div className="inv-kpi-label">Billed</div>
            <div className="inv-kpi-sub">{agg.totalValue > 0 ? ((agg.totalBilled/agg.totalValue)*100).toFixed(0) : 0}% of PO value</div>
          </div>
        </div>
        <div className="inv-kpi-card" style={{ borderLeftColor: '#166534' }}>
          <div className="inv-kpi-icon" style={{ background: '#f0fdf4', fontSize: 22 }}>✅</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{fmtCcy(agg.totalPaid.toFixed(0))}</div>
            <div className="inv-kpi-label">Paid</div>
            <div className="inv-kpi-sub">{agg.totalValue > 0 ? ((agg.totalPaid/agg.totalValue)*100).toFixed(0) : 0}% of PO value</div>
          </div>
        </div>
      </div>

      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by PO number or vendor…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <select className="inv-filter-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(PO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="inv-filter-select" value={vendorFilter} onChange={e => setVendor(e.target.value)}>
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {(search || statusFilter || vendorFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm"
              onClick={() => { setSearch(''); setStatus(''); setVendor(''); }}>
              ✕ Clear
            </button>
          )}
        </div>
        {canCreate && (
          <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onCreate}>
            + Create PO
          </button>
        )}
      </div>

      <div className="inv-result-count">
        Showing <strong>{filtered.length}</strong> of {pos.length} purchase orders
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Vendor</th>
              <th>Date</th>
              <th style={{ textAlign:'right' }}>Total</th>
              <th style={{ minWidth: 180 }}>Delivery Progress</th>
              <th style={{ minWidth: 180 }}>Payment Progress</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">📋</span>
                  <p>{search || statusFilter || vendorFilter ? 'No POs match your filters.' : 'No purchase orders yet. Click "+ Create PO" to begin.'}</p>
                </div>
              </td></tr>
            ) : filtered.map(p => {
              const m  = getPoMetrics(p, bills);
              const sm = PO_STATUS[m.derivedStatus] || PO_STATUS.DRAFT;
              return (
                <tr key={p.id} className="inv-table-row" onClick={() => setSelectedPo(p)}>
                  <td className="inv-code-cell">{p.poNumber}</td>
                  <td className="inv-name-cell">{p.vendorName}</td>
                  <td className="inv-muted">{p.date}</td>
                  <td style={{ textAlign:'right', fontWeight: 600 }}>{fmtCcy(m.total.toFixed(0))}</td>
                  <td>
                    <div className="inv-po-progress">
                      <div className="inv-po-progress-bar">
                        <div className="inv-po-progress-fill inv-po-progress-fill--delivery" style={{ width: `${m.billPct}%` }} />
                      </div>
                      <div className="inv-po-progress-text">
                        <span>{fmtCcy(m.billed.toFixed(0))} / {fmtCcy(m.total.toFixed(0))}</span>
                        <strong>{m.billPct.toFixed(0)}%</strong>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="inv-po-progress">
                      <div className="inv-po-progress-bar">
                        <div className="inv-po-progress-fill inv-po-progress-fill--payment" style={{ width: `${m.payPct}%` }} />
                      </div>
                      <div className="inv-po-progress-text">
                        <span>{fmtCcy(m.paid.toFixed(0))} paid</span>
                        <strong>{m.payPct.toFixed(0)}%</strong>
                      </div>
                    </div>
                  </td>
                  <td><span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>
                  <td>
                    <button className="inv-view-btn" onClick={e => { e.stopPropagation(); setSelectedPo(p); }}>View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPo && (
        <PODrawer po={selectedPo} bills={bills} payments={payments} warehouses={warehouses}
          onClose={() => setSelectedPo(null)} />
      )}
    </>
  );
}

// ── PO Detail Drawer ──────────────────────────────────────────────────────────
function PODrawer({ po, bills, payments, warehouses, onClose }) {
  const m  = getPoMetrics(po, bills);
  const sm = PO_STATUS[m.derivedStatus] || PO_STATUS.DRAFT;
  const wh = warehouses.find(w => w.id === po.warehouseId);
  // Payments linked through bills of this PO
  const linkedPayments = payments.filter(pay =>
    m.linkedBills.some(b => b.billNumber === pay.billNumber));

  return (
    <div className="inv-drawer-backdrop" onClick={onClose}>
      <div className="inv-drawer inv-drawer--wide" onClick={e => e.stopPropagation()}>
        <div className="inv-drawer-header">
          <div>
            <div className="inv-drawer-code">{po.poNumber}</div>
            <h2 className="inv-drawer-name">{po.vendorName}</h2>
            <div className="inv-drawer-badges">
              <span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              {wh && <span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>🏬 {wh.name}</span>}
              {po.projectId && <span className="inv-cat-badge" style={{ background:'#f8fafc', color:'#475569', borderColor:'#e2e8f0' }}>{po.projectId}</span>}
            </div>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* KPI strip */}
        <div className="inv-drawer-kpis">
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmtCcy(m.total.toFixed(0))}</div>
            <div className="inv-drawer-kpi-lbl">PO Total</div>
          </div>
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmtCcy(m.billed.toFixed(0))}</div>
            <div className="inv-drawer-kpi-lbl">Billed ({m.billPct.toFixed(0)}%)</div>
          </div>
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmtCcy(m.paid.toFixed(0))}</div>
            <div className="inv-drawer-kpi-lbl">Paid ({m.payPct.toFixed(0)}%)</div>
          </div>
          <div className="inv-drawer-kpi">
            <div className="inv-drawer-kpi-val">{fmtCcy((m.total - m.paid).toFixed(0))}</div>
            <div className="inv-drawer-kpi-lbl">Outstanding</div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Delivery (auto-calculated from bills)</div>
          <div className="inv-po-progress">
            <div className="inv-po-progress-bar inv-po-progress-bar--lg">
              <div className="inv-po-progress-fill inv-po-progress-fill--delivery" style={{ width: `${m.billPct}%` }} />
            </div>
            <div className="inv-po-progress-text">
              <span>{fmtCcy(m.billed.toFixed(0))} of {fmtCcy(m.total.toFixed(0))}</span>
              <strong>{m.billPct.toFixed(1)}%</strong>
            </div>
          </div>
          <div className="inv-drawer-section-title" style={{ marginTop: 16 }}>Payment</div>
          <div className="inv-po-progress">
            <div className="inv-po-progress-bar inv-po-progress-bar--lg">
              <div className="inv-po-progress-fill inv-po-progress-fill--payment" style={{ width: `${m.payPct}%` }} />
            </div>
            <div className="inv-po-progress-text">
              <span>{fmtCcy(m.paid.toFixed(0))} of {fmtCcy(m.total.toFixed(0))}</span>
              <strong>{m.payPct.toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        {/* Header details */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Details</div>
          <table className="inv-detail-table">
            <tbody>
              <tr><td>PO Date</td><td>{po.date}</td></tr>
              <tr><td>Expected Delivery</td><td>{po.expected || '—'}</td></tr>
              <tr><td>Payment Terms</td><td>{po.terms || '—'}</td></tr>
              <tr><td>Delivery Warehouse</td><td>{wh ? `${wh.name} (${wh.code}) · ${wh.city}` : '—'}</td></tr>
              <tr><td>Created By</td><td>{po.createdBy}</td></tr>
              {po.notes && <tr><td>Notes</td><td>{po.notes}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Line items with derived delivered qty */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Line Items ({po.items.length})</div>
          <div className="inv-table-container" style={{ marginBottom: 0 }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th style={{ textAlign:'right' }}>Ordered</th>
                  <th style={{ textAlign:'right' }}>Delivered</th>
                  <th style={{ textAlign:'right' }}>Pending</th>
                  <th style={{ textAlign:'right' }}>Rate</th>
                  <th style={{ textAlign:'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((li, idx) => {
                  const ordered   = Number(li.qty) || 0;
                  const delivered = ordered * m.fraction;
                  const pending   = Math.max(0, ordered - delivered);
                  const sub       = ordered * (Number(li.rate)||0);
                  const lineTotal = sub + (sub * (Number(li.tax)||0) / 100);
                  return (
                    <tr key={idx}>
                      <td className="inv-code-cell">{li.itemCode || '—'}</td>
                      <td className="inv-name-cell">{li.name}</td>
                      <td style={{ textAlign:'right' }}>{fmt(ordered)} {li.unit}</td>
                      <td style={{ textAlign:'right', color:'#166534', fontWeight: 600 }}>{fmt(delivered.toFixed(2))} {li.unit}</td>
                      <td style={{ textAlign:'right', color: pending > 0 ? '#b91c1c' : '#64748b', fontWeight: pending > 0 ? 600 : 400 }}>
                        {fmt(pending.toFixed(2))} {li.unit}
                      </td>
                      <td style={{ textAlign:'right' }}>{fmtCcy(li.rate)}</td>
                      <td style={{ textAlign:'right', fontWeight: 600 }}>{fmtCcy(lineTotal.toFixed(0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked bills */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Linked Bills ({m.linkedBills.length})</div>
          {m.linkedBills.length === 0 ? (
            <p className="inv-empty-hint">No bills recorded against this PO yet. Recording a bill will auto-update the delivery progress and add items to {wh?.name || 'the warehouse'}.</p>
          ) : (
            <div className="inv-table-container" style={{ marginBottom: 0 }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Date</th>
                    <th>Due</th>
                    <th style={{ textAlign:'right' }}>Amount</th>
                    <th style={{ textAlign:'right' }}>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.linkedBills.map(b => {
                    const bsm = BILL_STATUS[b.status] || BILL_STATUS.UNPAID;
                    return (
                      <tr key={b.id}>
                        <td className="inv-code-cell">{b.billNumber}</td>
                        <td className="inv-muted">{b.billDate}</td>
                        <td className="inv-muted">{b.dueDate}</td>
                        <td style={{ textAlign:'right', fontWeight: 600 }}>{fmtCcy(b.amount)}</td>
                        <td style={{ textAlign:'right', color:'#166534' }}>{fmtCcy(b.paid)}</td>
                        <td><span className="inv-status-badge" style={{ background: bsm.bg, color: bsm.color }}>{bsm.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Linked payments */}
        <div className="inv-drawer-section">
          <div className="inv-drawer-section-title">Linked Payments ({linkedPayments.length})</div>
          {linkedPayments.length === 0 ? (
            <p className="inv-empty-hint">No payments recorded yet.</p>
          ) : (
            <div className="inv-txn-list">
              {linkedPayments.map(p => (
                <div key={p.id} className="inv-txn-row">
                  <span className="inv-txn-type" style={{ background:'#dcfce7', color:'#166534' }}>✓ {p.mode}</span>
                  <div className="inv-txn-info">
                    <span className="inv-txn-qty" style={{ color:'#166534' }}>{fmtCcy(p.amount)}</span>
                    <span className="inv-txn-ref">{p.paymentNumber} · {p.reference || '—'}</span>
                  </div>
                  <span className="inv-txn-date">{p.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BILLS / PAYMENTS — Modals + Tab (with nested sub-tabs)
// ═════════════════════════════════════════════════════════════════════════════
function CreateBillModal({ open, onClose, onSave, vendors, pos }) {
  const [form, setForm] = useState({
    vendorId: '', poNumber: '', billDate: new Date().toISOString().slice(0, 10),
    dueDate: '', amount: '', projectId: '', notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickPO = (poNumber) => {
    const po = pos.find(p => p.poNumber === poNumber);
    if (po) setForm(f => ({ ...f, poNumber, vendorId: String(po.vendorId), projectId: po.projectId, amount: poTotal(po.items).toFixed(2) }));
    else set('poNumber', poNumber);
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
              <select className="inv-select" value={form.poNumber} onChange={e => pickPO(e.target.value)}>
                <option value="">— No PO (standalone bill) —</option>
                {pos.map(p => <option key={p.id} value={p.poNumber}>{p.poNumber} — {p.vendorName}</option>)}
              </select>
            </div>
            <div className="inv-field inv-field--full">
              <label className="inv-label">Vendor <span className="inv-req">*</span></label>
              <select className="inv-select" value={form.vendorId} onChange={e => set('vendorId', e.target.value)}>
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
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
              <input className="inv-input" placeholder="PROJ-2026-XXXX" value={form.projectId} onChange={e => set('projectId', e.target.value)} />
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
              <select className="inv-select" value={form.billId} onChange={e => set('billId', e.target.value)}>
                <option value="">Select bill…</option>
                {bills.filter(b => b.status !== 'PAID').map(b => (
                  <option key={b.id} value={b.id}>
                    {b.billNumber} — {b.vendorName} (Due: {fmtCcy(b.amount - b.paid)})
                  </option>
                ))}
              </select>
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
              <select className="inv-select" value={form.mode} onChange={e => set('mode', e.target.value)}>
                {PAY_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
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

function BillsPaymentsTab({ bills, payments, vendors, pos, onCreateBill, onRecordPayment, canCreate }) {
  const [subTab, setSubTab] = useState(() => localStorage.getItem('inv_bp_subtab') || 'bills');
  const switchSub = (t) => { setSubTab(t); localStorage.setItem('inv_bp_subtab', t); };

  const totalBilled    = bills.reduce((s, b) => s + b.amount, 0);
  const totalPaid      = bills.reduce((s, b) => s + b.paid, 0);
  const outstanding    = totalBilled - totalPaid;
  const overdueCount   = bills.filter(b => b.status === 'OVERDUE').length;

  return (
    <>
      <div className="inv-kpi-grid">
        <div className="inv-kpi-card" style={{ borderLeftColor: '#1e40af' }}>
          <div className="inv-kpi-icon" style={{ background:'#eff6ff', fontSize:22 }}>🧾</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{fmtCcy(totalBilled.toFixed(0))}</div>
            <div className="inv-kpi-label">Total Billed</div>
            <div className="inv-kpi-sub">{bills.length} bills</div>
          </div>
        </div>
        <div className="inv-kpi-card" style={{ borderLeftColor: '#065f46' }}>
          <div className="inv-kpi-icon" style={{ background:'#ecfdf5', fontSize:22 }}>✅</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{fmtCcy(totalPaid.toFixed(0))}</div>
            <div className="inv-kpi-label">Total Paid</div>
            <div className="inv-kpi-sub">{payments.length} payments</div>
          </div>
        </div>
        <div className="inv-kpi-card" style={{ borderLeftColor: '#92400e' }}>
          <div className="inv-kpi-icon" style={{ background:'#fffbeb', fontSize:22 }}>⏳</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{fmtCcy(outstanding.toFixed(0))}</div>
            <div className="inv-kpi-label">Outstanding</div>
            <div className="inv-kpi-sub">due to vendors</div>
          </div>
        </div>
        <div className="inv-kpi-card" style={{ borderLeftColor: '#991b1b' }}>
          <div className="inv-kpi-icon" style={{ background:'#fef2f2', fontSize:22 }}>🚨</div>
          <div className="inv-kpi-content">
            <div className="inv-kpi-value">{overdueCount}</div>
            <div className="inv-kpi-label">Overdue</div>
            <div className="inv-kpi-sub">need attention</div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="inv-subtabs">
        <button className={`inv-subtab ${subTab === 'bills' ? 'active' : ''}`} onClick={() => switchSub('bills')}>
          Bills <span className="inv-tab-count">{bills.length}</span>
        </button>
        <button className={`inv-subtab ${subTab === 'payments' ? 'active' : ''}`} onClick={() => switchSub('payments')}>
          Payments <span className="inv-tab-count">{payments.length}</span>
        </button>
      </div>

      {subTab === 'bills'
        ? <BillsList bills={bills} onCreate={onCreateBill} canCreate={canCreate} />
        : <PaymentsList payments={payments} onRecord={onRecordPayment} canCreate={canCreate} />}
    </>
  );
}

function BillsList({ bills, onCreate, canCreate }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');

  const filtered = bills.filter(b => {
    const q = search.toLowerCase();
    return (!q || b.billNumber.toLowerCase().includes(q) || b.vendorName.toLowerCase().includes(q) || (b.poNumber || '').toLowerCase().includes(q))
        && (!statusFilter || b.status === statusFilter);
  });

  return (
    <>
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by bill no, vendor or PO…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <select className="inv-filter-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(BILL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(search || statusFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => { setSearch(''); setStatus(''); }}>✕ Clear</button>
          )}
        </div>
        {canCreate && (
          <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onCreate}>+ Add Bill</button>
        )}
      </div>

      <div className="inv-result-count">
        Showing <strong>{filtered.length}</strong> of {bills.length} bills
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Bill No.</th>
              <th>Vendor</th>
              <th>PO Ref</th>
              <th>Bill Date</th>
              <th>Due Date</th>
              <th style={{ textAlign:'right' }}>Amount</th>
              <th style={{ textAlign:'right' }}>Paid</th>
              <th style={{ textAlign:'right' }}>Balance</th>
              <th>Status</th>
              <th>Project</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">🧾</span>
                  <p>{search || statusFilter ? 'No bills match your filters.' : 'No bills yet. Click "+ Add Bill" to begin.'}</p>
                </div>
              </td></tr>
            ) : filtered.map(b => {
              const sm = BILL_STATUS[b.status] || BILL_STATUS.UNPAID;
              const balance = b.amount - b.paid;
              return (
                <tr key={b.id} className="inv-table-row">
                  <td className="inv-code-cell">{b.billNumber}</td>
                  <td className="inv-name-cell">{b.vendorName}</td>
                  <td className="inv-code-cell">{b.poNumber || '—'}</td>
                  <td className="inv-muted">{b.billDate}</td>
                  <td className="inv-muted" style={{ color: b.status === 'OVERDUE' ? '#991b1b' : undefined, fontWeight: b.status === 'OVERDUE' ? 600 : undefined }}>{b.dueDate}</td>
                  <td style={{ textAlign:'right', fontWeight: 600 }}>{fmtCcy(b.amount)}</td>
                  <td style={{ textAlign:'right', color:'#166534' }}>{fmtCcy(b.paid)}</td>
                  <td style={{ textAlign:'right', fontWeight: 600, color: balance > 0 ? '#991b1b' : '#166534' }}>{fmtCcy(balance)}</td>
                  <td><span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>
                  <td className="inv-muted">{b.projectId || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PaymentsList({ payments, onRecord, canCreate }) {
  const [search, setSearch] = useState('');
  const [modeFilter, setMode] = useState('');

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.paymentNumber.toLowerCase().includes(q) || p.vendorName.toLowerCase().includes(q) || (p.billNumber || '').toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q))
        && (!modeFilter || p.mode === modeFilter);
  });

  return (
    <>
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by payment no, vendor, bill or reference…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <select className="inv-filter-select" value={modeFilter} onChange={e => setMode(e.target.value)}>
            <option value="">All Modes</option>
            {PAY_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
          {(search || modeFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => { setSearch(''); setMode(''); }}>✕ Clear</button>
          )}
        </div>
        {canCreate && (
          <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onRecord}>+ Record Payment</button>
        )}
      </div>

      <div className="inv-result-count">
        Showing <strong>{filtered.length}</strong> of {payments.length} payments
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Payment No.</th>
              <th>Date</th>
              <th>Bill Ref</th>
              <th>Vendor</th>
              <th>Mode</th>
              <th>Reference</th>
              <th style={{ textAlign:'right' }}>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">💸</span>
                  <p>{search || modeFilter ? 'No payments match your filters.' : 'No payments recorded yet.'}</p>
                </div>
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="inv-table-row">
                <td className="inv-code-cell">{p.paymentNumber}</td>
                <td className="inv-muted">{p.date}</td>
                <td className="inv-code-cell">{p.billNumber || '—'}</td>
                <td className="inv-name-cell">{p.vendorName}</td>
                <td>
                  <span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>{p.mode}</span>
                </td>
                <td className="inv-code-cell">{p.reference || '—'}</td>
                <td style={{ textAlign:'right', fontWeight: 600, color:'#166534' }}>{fmtCcy(p.amount)}</td>
                <td className="inv-note-cell" title={p.notes}>{p.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryManagementPage() {
  const { user, pagePermissions } = useAuth();
  const toast = useToast();

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
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();

  // Warehouses come from the backend, filtered by the active group/subgroup/project.
  // Backend endpoint: GET /warehouses?groupName=&subGroupName=&projectId=
  // Until backend tables are populated, the array stays empty; the UI will
  // show "No warehouses available" instead of crashing.
  const [warehouses, setWarehouses] = useState([]);
  const [whLoading, setWhLoading]   = useState(false);
  const [whError, setWhError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    setWhLoading(true);
    setWhError(null);
    warehouseApi.list({ groupName, subGroupName, projectId })
      .then(data => { if (!cancelled) setWarehouses(Array.isArray(data) ? data : []); })
      .catch(err => { if (!cancelled) { console.error(err); setWhError(err.message); setWarehouses([]); } })
      .finally(() => { if (!cancelled) setWhLoading(false); });
    return () => { cancelled = true; };
  }, [groupName, subGroupName, projectId]);

  const [selectedWh, setSelectedWh] = useState(() => localStorage.getItem('inv_active_wh') || '');
  const selectWh = (id) => { setSelectedWh(id); localStorage.setItem('inv_active_wh', id); };

  // If the active warehouse is no longer in the filtered list, clear it
  useEffect(() => {
    if (selectedWh && warehouses.length > 0
        && !warehouses.some(w => String(w.id) === String(selectedWh))) {
      selectWh('');
    }
  }, [warehouses]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeWarehouse = warehouses.find(w => String(w.id) === String(selectedWh));

  const [items,       setItems]       = useState(MOCK_ITEMS);
  const [transactions,setTransactions]= useState(MOCK_TRANSACTIONS);
  const [pos,         setPos]         = useState(MOCK_POS);
  const [bills,       setBills]       = useState(MOCK_BILLS);
  const [payments,    setPayments]    = useState(MOCK_PAYMENTS);
  const vendors = MOCK_VENDORS;

  const [addOpen,     setAddOpen]     = useState(false);
  const [txnOpen,     setTxnOpen]     = useState(false);
  const [poOpen,      setPoOpen]      = useState(false);
  const [billOpen,    setBillOpen]    = useState(false);
  const [payOpen,     setPayOpen]     = useState(false);

  // Warehouse-scoped views — everything below the warehouse selector reads from these
  const visibleItems = selectedWh
    ? items.filter(i => String(i.warehouseId) === String(selectedWh))
    : items;
  const visibleItemCodes = new Set(visibleItems.map(i => i.itemCode));
  const visibleTransactions = selectedWh
    ? transactions.filter(t => visibleItemCodes.has(t.itemCode))
    : transactions;

  const handleCreatePO = (form) => {
    const vendor = vendors.find(v => String(v.id) === String(form.vendorId));
    const nextNum = 'PO-2026-' + String(41 + pos.length + 1).padStart(5, '0');
    const newPO = {
      id: pos.length + 1,
      poNumber: nextNum,
      vendorId: Number(form.vendorId),
      vendorName: vendor?.name || '',
      date: form.date,
      expected: form.expected,
      projectId: form.projectId,
      items: form.lines.filter(l => l.qty && l.rate).map(l => ({ ...l, qty: Number(l.qty), rate: Number(l.rate), tax: Number(l.tax) })),
      status: form.status || 'DRAFT',
      terms: form.terms,
      notes: form.notes,
      createdBy: user?.name || 'Admin',
    };
    setPos(p => [newPO, ...p]);
    toast.add(`Purchase Order ${nextNum} created`);
  };

  const handleCreateBill = (form) => {
    const vendor = vendors.find(v => String(v.id) === String(form.vendorId));
    const nextNum = 'BILL-2026-' + String(112 + bills.length + 1).padStart(5, '0');
    const amount = Number(form.amount);
    const newBill = {
      id: bills.length + 1,
      billNumber: nextNum,
      poNumber: form.poNumber || '—',
      vendorId: Number(form.vendorId),
      vendorName: vendor?.name || '',
      billDate: form.billDate,
      dueDate: form.dueDate,
      amount, paid: 0,
      status: form.dueDate && form.dueDate < new Date().toISOString().slice(0, 10) ? 'OVERDUE' : 'UNPAID',
      projectId: form.projectId,
      notes: form.notes,
    };
    setBills(b => [newBill, ...b]);

    // ── Auto-update flow ────────────────────────────────────────────────────
    // If this bill is linked to a PO, treat it as a goods receipt against the PO:
    //   1. Increase the PO's billed amount (derived via getPoMetrics)
    //   2. For each PO line item, increment the matching warehouse stock
    //      proportionally to how much of the PO this bill covers.
    //   3. Log an INWARD transaction per line item, referencing the PO + bill.
    //   4. Auto-bump the PO status: PARTIAL when partly billed, RECEIVED at 100%.
    const linkedPO = pos.find(p => p.poNumber === form.poNumber);
    if (linkedPO) {
      const poTot = poTotal(linkedPO.items);
      const fraction = poTot > 0 ? Math.min(1, amount / poTot) : 0;
      const prevBilled = bills
        .filter(b => b.poNumber === linkedPO.poNumber)
        .reduce((s, b) => s + b.amount, 0);
      const cumulativeBilled = prevBilled + amount;
      const newPoStatus = cumulativeBilled >= poTot && poTot > 0 ? 'RECEIVED' : 'PARTIAL';

      // Stock receipt — increment or create each item under the PO's warehouse
      linkedPO.items.forEach(line => {
        const deliveredNow = Number((Number(line.qty) * fraction).toFixed(2));
        if (deliveredNow <= 0) return;

        setItems(prev => {
          const idx = prev.findIndex(i =>
            i.itemCode === line.itemCode && Number(i.warehouseId) === Number(linkedPO.warehouseId));
          if (idx >= 0) {
            return prev.map((i, k) => {
              if (k !== idx) return i;
              const newQty = i.currentQty + deliveredNow;
              return {
                ...i,
                currentQty: newQty,
                unitCost: line.rate || i.unitCost,
                status: newQty === 0 ? 'OUT_OF_STOCK' : newQty <= i.minQty ? 'LOW_STOCK' : 'IN_STOCK',
                lastUpdated: form.billDate,
              };
            });
          }
          // Item doesn't exist in this warehouse yet — create it
          const wh = warehouses.find(w => w.id === linkedPO.warehouseId);
          return [{
            id: (prev[0]?.id || 0) + 1,
            itemCode: line.itemCode || '—',
            name: line.name,
            category: 'Other',
            unit: line.unit,
            currentQty: deliveredNow,
            minQty: 0,
            maxQty: Number(line.qty) || deliveredNow,
            unitCost: Number(line.rate) || 0,
            projectId: linkedPO.projectId || '',
            warehouseId: linkedPO.warehouseId,
            location: wh?.name || '',
            status: 'IN_STOCK',
            lastUpdated: form.billDate,
          }, ...prev];
        });

        setTransactions(prev => [{
          id: (prev[0]?.id || 0) + 1,
          date: form.billDate,
          type: 'INWARD',
          itemCode: line.itemCode || '—',
          itemName: line.name,
          qty: deliveredNow,
          unit: line.unit,
          projectId: linkedPO.projectId || '',
          ref: `${linkedPO.poNumber} · ${nextNum}`,
          note: `Auto-received via Bill ${nextNum} (${(fraction*100).toFixed(1)}% of PO)`,
          by: user?.name || 'System',
        }, ...prev]);
      });

      // Bump PO status
      setPos(prev => prev.map(p => p.poNumber === linkedPO.poNumber ? { ...p, status: newPoStatus } : p));
      toast.add(`Bill ${nextNum} added · ${linkedPO.poNumber} → ${PO_STATUS[newPoStatus].label}`);
    } else {
      toast.add(`Bill ${nextNum} added`);
    }
  };

  const handleRecordPayment = (form) => {
    const bill = bills.find(b => String(b.id) === String(form.billId));
    if (!bill) return;
    const amount = Number(form.amount);
    const nextNum = 'PAY-2026-' + String(58 + payments.length + 1).padStart(5, '0');

    setBills(prev => prev.map(b => {
      if (b.id !== bill.id) return b;
      const newPaid = b.paid + amount;
      const newStatus = newPaid >= b.amount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : b.status;
      return { ...b, paid: newPaid, status: newStatus };
    }));

    setPayments(p => [{
      id: payments.length + 1,
      paymentNumber: nextNum,
      billNumber: bill.billNumber,
      vendorName: bill.vendorName,
      date: form.date,
      amount,
      mode: form.mode,
      reference: form.reference,
      notes: form.notes,
    }, ...p]);

    // Payment flowing to PO is reflected automatically via getPoMetrics
    // (PO tab reads sum of bills.paid for its progress bar). No PO state change
    // needed unless we want to mark the PO as fully closed once paid in full.
    toast.add(`Payment ${nextNum} recorded`);
  };

  const handleAddItem = (form) => {
    const newItem = {
      id: items.length + 1,
      itemCode:   form.itemCode,
      name:       form.name,
      category:   form.category,
      unit:       form.unit,
      currentQty: Number(form.currentQty) || 0,
      minQty:     Number(form.minQty) || 0,
      maxQty:     Number(form.maxQty) || 0,
      unitCost:   Number(form.unitCost) || 0,
      projectId:  form.projectId,
      location:   warehouses.find(w => String(w.id) === String(form.warehouseId))?.name || '',
      warehouseId: Number(form.warehouseId) || null,
      status:     Number(form.currentQty) === 0 ? 'OUT_OF_STOCK'
                : Number(form.currentQty) <= Number(form.minQty) ? 'LOW_STOCK'
                : 'IN_STOCK',
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    setItems(p => [newItem, ...p]);
    toast.add(`"${form.name}" added to inventory`);
  };

  const handleTransaction = (form) => {
    const item = items.find(i => String(i.id) === String(form.itemId));
    if (!item) return;
    const qty = Number(form.qty);
    const delta = ['OUTWARD', 'TRANSFER'].includes(form.type) ? -qty : form.type === 'ADJUSTMENT' && qty < 0 ? qty : qty;
    const newQty = Math.max(0, item.currentQty + delta);
    const newStatus = newQty === 0 ? 'OUT_OF_STOCK' : newQty <= item.minQty ? 'LOW_STOCK' : 'IN_STOCK';

    setItems(p => p.map(i => i.id === item.id ? { ...i, currentQty: newQty, status: newStatus, lastUpdated: form.date } : i));
    setTransactions(p => [{
      id: p.length + 1, date: form.date, type: form.type,
      itemCode: item.itemCode, itemName: item.name,
      qty: delta, unit: item.unit,
      projectId: form.projectId, ref: form.ref, note: form.note, by: user?.name || 'Admin'
    }, ...p]);
    toast.add(`Transaction recorded for "${item.name}"`);
  };

  return (
    <div className="inv-page">
      <ToastStack toasts={toast.toasts} />

      {/* ── Sticky top ──────────────────────────────────────────────────────── */}
      <div className="inv-sticky-top">
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
            {/* Main page-level dropdown — Warehouses */}
            <div className="inv-wh-selector">
              <span className="inv-wh-selector-icon">🏬</span>
              <select className="inv-wh-selector-input" value={selectedWh}
                onChange={e => selectWh(e.target.value)}
                disabled={whLoading || warehouses.length === 0}>
                <option value="">
                  {whLoading ? 'Loading warehouses…'
                    : warehouses.length === 0 ? 'No warehouses'
                    : 'All Warehouses'}
                </option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.code ? ` (${w.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {canCreate && (
              <button className="inv-btn inv-btn--secondary" onClick={() => setTxnOpen(true)}>
                ⇄ Transaction
              </button>
            )}
            {canCreate && (
              <button className="inv-btn inv-btn--primary" onClick={() => setAddOpen(true)}>
                + Add Item
              </button>
            )}
          </div>
        </div>

        {/* Group / Subgroup / Project filter — same as procurement pages */}
        <div className="inv-filter-row">
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
          {whLoading && <span className="inv-filter-hint">Loading warehouses…</span>}
          {whError && <span className="inv-filter-hint inv-filter-hint--error">⚠ {whError}</span>}
          {!whLoading && !whError && projectId && warehouses.length === 0 && (
            <span className="inv-filter-hint">No warehouses for this project — add them from Dropdown Management.</span>
          )}
        </div>

        {/* Tabs */}
        <div className="inv-tabs">
          {[
            { k: 'items',        label: 'Items',           count: visibleItems.length },
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
      </div>

      {/* ── Scroll area ─────────────────────────────────────────────────────── */}
      <div className="inv-scroll-area">
        {activeTab === 'items' && (
          <ItemsTab items={visibleItems} transactions={visibleTransactions}
            onAddItem={() => setAddOpen(true)} onTransaction={() => setTxnOpen(true)}
            canCreate={canCreate} canEdit={canEdit} />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab transactions={visibleTransactions}
            onTransaction={() => setTxnOpen(true)} canCreate={canCreate} />
        )}
        {activeTab === 'po' && (
          <PurchaseOrdersTab pos={pos} vendors={vendors} items={items}
            bills={bills} payments={payments} warehouses={warehouses}
            onCreate={() => setPoOpen(true)} canCreate={canCreate} />
        )}
        {activeTab === 'bills' && (
          <BillsPaymentsTab bills={bills} payments={payments} vendors={vendors} pos={pos}
            onCreateBill={() => setBillOpen(true)} onRecordPayment={() => setPayOpen(true)}
            canCreate={canCreate} />
        )}
      </div>

      {/* Modals */}
      <AddItemModal     open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAddItem}
        warehouses={warehouses} defaultWarehouseId={selectedWh} />
      <TransactionModal open={txnOpen} onClose={() => setTxnOpen(false)} onSave={handleTransaction}
        items={items} warehouses={warehouses} defaultWarehouseId={selectedWh} />
      <CreatePOModal     open={poOpen}   onClose={() => setPoOpen(false)}   onSave={handleCreatePO}
        items={items} vendors={vendors} warehouses={warehouses} defaultWarehouseId={selectedWh} />
      <CreateBillModal   open={billOpen} onClose={() => setBillOpen(false)} onSave={handleCreateBill}    vendors={vendors} pos={pos} />
      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)}  onSave={handleRecordPayment} bills={bills} />
    </div>
  );
}