import React, { useState, useRef } from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import FilterSelect from '../Dropdowns/FilterSelect.js';
import {
  PO_STATUS, BILL_STATUS, fmtCcy, fmt,
  ColumnVisibilityDropdown, DraggableHeaderCell, getSortIcon, PaginationBar,
} from './inventoryConstants.js';

// ── Auth headers ──────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL;
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

// ── PO API ────────────────────────────────────────────────────────────────────
const invPoApi = {
  get: async (id) => {
    const res = await fetch(`${API}/inventory/purchase-orders/${id}`, { headers: getAuthHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load purchase order');
    return res.json();
  },
};

// ── Normalizer ────────────────────────────────────────────────────────────────
const normalizePO = po => ({
  ...po,
  // canonical display fields
  poNumber:         po.poNo          || po.poNumber         || '',
  date:             po.orderDate     ? String(po.orderDate).slice(0, 10) : (po.date || ''),
  expected:         po.expectedDelivery ? String(po.expectedDelivery).slice(0, 10) : (po.expected || ''),
  terms:            po.paymentTerms  || po.terms             || '',
  // backend supplies these as COUNT OF LINE ITEMS (not sum of qty)
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

// ── PO line total helper ──────────────────────────────────────────────────────
function poTotal(items) {
  return items.reduce((s, it) => {
    const sub = (Number(it.qty)||0) * (Number(it.rate)||0);
    return s + sub + (sub * (Number(it.tax)||0) / 100);
  }, 0);
}


function getPoMetrics(po, bills, payments) {
  const total       = Number(po.totalValue) || poTotal(po.items);
  const linkedBills = bills.filter(b =>
    (po.id && b.poId && String(b.poId) === String(po.id)) ||
    (po.poNumber && b.poNumber && b.poNumber === po.poNumber)
  );
  const billed  = linkedBills.reduce((s, b) => s + Number(b.amount  ?? b.totalAmount  ?? 0), 0);
  const paid    = linkedBills.reduce((s, b) => s + Number(b.paid    ?? b.paidAmount   ?? 0), 0);
  const billPct = total > 0 ? Math.min(100, (billed / total) * 100) : 0;
  const payPct  = total > 0 ? Math.min(100, (paid   / total) * 100) : 0;

  // Use backend-computed counts directly (totalItemsOrdered = number of line items,
  // totalItemsReceived = number of fully received line items)
  const totalLineItems    = Number(po.totalItemsOrdered  ?? po.items?.length ?? 0);
  const receivedLineItems = Number(po.totalItemsReceived ?? 0);
  const deliveryPct       = totalLineItems > 0 ? Math.min(100, (receivedLineItems / totalLineItems) * 100) : 0;

  // Qty sums for the detail modal progress bar
  const items         = po.items || [];
  const totalOrdered  = items.reduce((s, it) => s + Number(it.orderedQty  ?? 0), 0);
  const totalReceived = items.reduce((s, it) => s + Number(it.receivedQty ?? 0), 0);
  const detailDeliveryPct = totalOrdered > 0 ? Math.min(100, (totalReceived / totalOrdered) * 100) : 0;

  const fraction      = total > 0 ? Math.min(1, billed / total) : 0;

  // Status: prefer backend status, override if we can compute better
  const derivedStatus =
      po.status === 'CANCELLED'                                        ? 'CANCELLED'
    : totalOrdered > 0 && totalReceived >= totalOrdered               ? 'RECEIVED'
    : totalReceived > 0                                                ? 'PARTIAL'
    : billed > 0                                                       ? 'PARTIAL'
    :                                                                    (po.status || 'DRAFT');

  const advancePayments = (payments || []).filter(pay =>
    !pay.billId && String(pay.vendorId ?? '') === String(po.vendorId ?? '') &&
    (pay.groupName || '') === (po.groupName || '')
  );
  const advancePaid = advancePayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return {
    total, billed, paid, billPct, payPct,
    deliveryPct, totalLineItems, receivedLineItems,
    detailDeliveryPct, totalOrdered, totalReceived,
    fraction, derivedStatus, linkedBills, advancePaid, advancePayments,
  };
}


const PO_ALL_COLUMNS = [
  { key: 'idx',      label: 'S.No',            sortable: false, required: true,  align: 'center' },
  { key: 'poNumber', label: 'PO Number',       sortable: true,  required: true,  align: 'left'   },
  { key: 'vendor',   label: 'Vendor',          sortable: true,  required: false, align: 'left'   },
  { key: 'date',     label: 'Date',            sortable: true,  required: false, align: 'left'   },
  { key: 'total',    label: 'Total',           sortable: true,  required: false, align: 'right'  },
  { key: 'progress', label: 'Delivery',        sortable: false, required: false, align: 'left'   },
  { key: 'status',   label: 'Status',          sortable: true,  required: false, align: 'center' },
  { key: 'actions',  label: 'Actions',         sortable: false, required: true,  align: 'center' },
];
const PO_DEFAULT_ORDER   = PO_ALL_COLUMNS.map(c => c.key);
const PO_DEFAULT_VISIBLE = PO_ALL_COLUMNS.map(c => c.key);

export default function PurchaseOrdersTab({
  pos, vendors, items, bills, payments, warehouses,
  onCreate, onEdit, onDelete, canCreate,
}) {
  const [selectedPo, setSelectedPo] = useState(null);

  // ── Internal pagination, search, filters ─────────────────────────────────
  const [page,      setPage]     = useState(0);
  const [pageSize,  setPageSize] = useState(10);
  const [search,    setSearch]   = useState('');
  const [status,    setStatus]   = useState('');
  const [vendor,    setVendor]   = useState('');

  const [columnOrder, setColumnOrder]       = useState(PO_DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(PO_DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn]         = useState('');
  const [sortDirection, setSortDirection]   = useState('asc');
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex]   = useState(null);

  // KPI aggregates from ALL pos (not filtered) so KPI cards are always accurate
  const agg = pos.reduce((acc, p) => {
    const m = getPoMetrics(p, bills, payments);
    acc.totalValue  += m.total;
    acc.totalBilled += m.billed;
    acc.totalPaid   += m.paid;
    if (m.derivedStatus === 'RECEIVED') acc.receivedCount++;
    else if (['DRAFT','SENT','APPROVED','PARTIAL'].includes(m.derivedStatus)) acc.openCount++;
    return acc;
  }, { totalValue: 0, totalBilled: 0, totalPaid: 0, openCount: 0, receivedCount: 0 });

  // Client-side filter
  const filteredPos = pos.filter(p => {
    if (status) {
      const m = getPoMetrics(p, bills, payments);
      if (m.derivedStatus !== status) return false;
    }
    if (vendor && String(p.vendorId) !== vendor) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(p.poNumber?.toLowerCase().includes(q) || p.vendorName?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Client-side sort
  const sortedPos = sortColumn
    ? [...filteredPos].sort((a, b) => {
        let av, bv;
        if (sortColumn === 'total') { const ma = getPoMetrics(a, bills, payments); const mb = getPoMetrics(b, bills, payments); av = ma.total; bv = mb.total; }
        else if (sortColumn === 'status') { const ma = getPoMetrics(a, bills, payments); const mb = getPoMetrics(b, bills, payments); av = ma.derivedStatus; bv = mb.derivedStatus; }
        else { av = a[sortColumn] ?? ''; bv = b[sortColumn] ?? ''; }
        return sortDirection === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      })
    : filteredPos;

  // Pagination derived values
  const total      = sortedPos.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage   = Math.min(page, totalPages - 1);

  // Slice for current page
  const paginatedPos = sortedPos.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const orderedVisiblePoCols = columnOrder
    .map(k => PO_ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && (c.required || visibleColumns.includes(c.key)));

  const handleSort = col => {
    const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col); setSortDirection(dir);
  };
  const handleColDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(idx); };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisiblePoCols.map(c => c.key);
    const fromKey = visKeys[fromIdx], toKey = visKeys[dropIdx];
    const o = [...columnOrder];
    const a = o.indexOf(fromKey), b = o.indexOf(toKey);
    o.splice(a, 1); o.splice(b, 0, fromKey);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd = e => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };
  const handleToggleColumn = k => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns  = () => { setColumnOrder(PO_DEFAULT_ORDER); setVisibleColumns(PO_DEFAULT_VISIBLE); };

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
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            {search && <button className="inv-search-clear" onClick={() => { setSearch(''); setPage(0); }}>✕</button>}
          </div>
          <FilterSelect
            value={status}
            onChange={v => { setStatus(v); setPage(0); }}
            options={Object.entries(PO_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
            placeholder="All Status"
          />
          <FilterSelect
            value={vendor}
            onChange={v => { setVendor(v); setPage(0); }}
            options={vendors.map(v => ({ value: String(v.id), label: v.name }))}
            placeholder="All Vendors"
          />
          {(search || status || vendor) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm"
              onClick={() => { setSearch(''); setStatus(''); setVendor(''); setPage(0); }}>
              ✕ Clear
            </button>
          )}
        </div>
        <div className="inv-action-right">
          <ColumnVisibilityDropdown columns={PO_ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
          {canCreate && (
            <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onCreate}>
              + Create PO
            </button>
          )}
        </div>
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              {orderedVisiblePoCols.map((col, idx) => (
                <DraggableHeaderCell key={col.key} col={col} index={idx}
                  sortColumn={sortColumn} sortDirection={sortDirection}
                  getSortIcon={getSortIcon} handleSort={handleSort}
                  onDragStart={handleColDragStart} onDragOver={handleColDragOver}
                  onDrop={handleColDrop} onDragEnd={handleColDragEnd}
                  isDragOver={dragOverIndex === idx} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPos.length === 0 ? (
              <tr><td colSpan={orderedVisiblePoCols.length} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">📋</span>
                  <p>{search || status || vendor ? 'No POs match your filters.' : 'No purchase orders yet. Click "+ Create PO" to begin.'}</p>
                </div>
              </td></tr>
            ) : paginatedPos.map((p, idx) => {
              const m  = getPoMetrics(p, bills, payments);
              const sm = PO_STATUS[m.derivedStatus] || PO_STATUS.DRAFT;
              return (
                <tr key={p.id} className="inv-table-row" onClick={() => setSelectedPo(p)}>
                  {orderedVisiblePoCols.map(col => {
                    if (col.key === 'idx') return <td key="idx" data-col="idx" style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{safePage * pageSize + idx + 1}</td>;
                    if (col.key === 'poNumber') return <td key="poNumber" data-col="poNumber" className="inv-code-cell">{p.poNo || p.poNumber || '—'}</td>;
                    if (col.key === 'vendor') return <td key="vendor" data-col="vendor" className="inv-name-cell">{p.vendorName}</td>;
                    if (col.key === 'date') return <td key="date" data-col="date" className="inv-muted">{p.date}</td>;
                    if (col.key === 'total') return <td key="total" data-col="total" style={{ fontWeight: 600 }}>{fmtCcy(m.total.toFixed(0))}</td>;
                    if (col.key === 'progress') return (
                      <td key="progress" data-col="progress">
                        <div className="inv-po-progress">
                          <div className="inv-po-progress-bar">
                            <div className="inv-po-progress-fill inv-po-progress-fill--delivery" style={{ width: `${m.detailDeliveryPct}%` }} />
                          </div>
                          <div className="inv-po-progress-text">
                            <span>{fmt(m.totalReceived)} / {fmt(m.totalOrdered)} items</span>
                            <strong>{m.detailDeliveryPct.toFixed(0)}%</strong>
                          </div>
                        </div>
                      </td>
                    );
                    if (col.key === 'status') return <td key="status" data-col="status"><span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>;
                    if (col.key === 'actions') return (
                      <td key="actions" data-col="actions" onClick={e => e.stopPropagation()}>
                        <div className="inv-row-actions">
                          <button className="inv-icon-action inv-icon-action--view" title="View" onClick={() => setSelectedPo(p)}><Eye size={15}/></button>
                          {canCreate && (
                            <button className="inv-icon-action inv-icon-action--edit" title="Edit PO"
                              onClick={() => onEdit && onEdit(p)}><Edit2 size={14}/></button>
                          )}
                          {canCreate && (
                            <button className="inv-icon-action inv-icon-action--delete" title="Delete PO"
                              onClick={() => onDelete && onDelete(p)}><Trash2 size={14}/></button>
                          )}
                        </div>
                      </td>
                    );
                    return null;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={safePage} pageSize={pageSize} total={total} totalPages={totalPages}
        onPageChange={p => setPage(p)}
        onPageSizeChange={s => { setPageSize(Number(s)); setPage(0); }}
        label="purchase orders"
      />

      {selectedPo && (
        <POModal po={selectedPo} bills={bills} payments={payments} warehouses={warehouses}
          onClose={() => setSelectedPo(null)} />
      )}
    </>
  );
}

// ── PO Detail Drawer ──────────────────────────────────────────────────────────
function POModal({ po, bills, payments, warehouses, onClose }) {
  const [fullPo, setFullPo] = useState(po);
  const [loadingItems, setLoadingItems] = useState(false);

  React.useEffect(() => {
    setFullPo(po);
    if (!po?.id) return;
    setLoadingItems(true);
    invPoApi.get(po.id)
      .then(d => setFullPo(prev => ({ ...prev, ...normalizePO(d) })))
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, [po]); // eslint-disable-line react-hooks/exhaustive-deps

  const m  = getPoMetrics(fullPo, bills, payments);
  const sm = PO_STATUS[m.derivedStatus] || PO_STATUS.DRAFT;
  const wh = warehouses.find(w => String(w.id) === String(fullPo.warehouseId));
  const linkedPayments = payments.filter(pay =>
    m.linkedBills.some(b => b.billNumber === pay.billNumber || String(b.id) === String(pay.billId)) ||
    m.advancePayments.some(a => a.id === pay.id)
  );

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--po" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="inv-modal-header">
          <div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
              {fullPo.poNo || fullPo.poNumber}
            </div>
            <h3 className="inv-modal-title">{fullPo.vendorName}</h3>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              {wh && <span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>🏬 {wh.name}</span>}
              {fullPo.projectId && <span className="inv-cat-badge" style={{ background:'#f8fafc', color:'#475569', borderColor:'#e2e8f0' }}>{fullPo.projectId}</span>}
            </div>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">

          {/* ── KPI Strip ── */}
          <div className="inv-po-modal-kpis">
            {[
              { val: fmtCcy(m.total.toFixed(0)),              lbl: 'PO Total'                          },
              { val: `${m.receivedLineItems} / ${m.totalLineItems}`, lbl: `Line Items Delivered (${m.deliveryPct.toFixed(0)}%)` },
              { val: fmtCcy(m.billed.toFixed(0)),             lbl: `Billed (${m.billPct.toFixed(0)}%)` },
              { val: fmtCcy(m.paid.toFixed(0)),               lbl: 'Paid'                              },
              { val: fmtCcy((m.total - m.paid).toFixed(0)),   lbl: 'Outstanding'                       },
            ].map((k, i) => (
              <div key={i} className="inv-po-modal-kpi">
                <div className="inv-po-modal-kpi-val">{k.val}</div>
                <div className="inv-po-modal-kpi-lbl">{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* ── Delivery progress bar ── */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Delivery Progress (from received quantities)</div>
            <div className="inv-po-progress" style={{ marginBottom: 0 }}>
              <div className="inv-po-progress-bar inv-po-progress-bar--lg">
                <div className="inv-po-progress-fill inv-po-progress-fill--delivery" style={{ width: `${m.detailDeliveryPct}%` }} />
              </div>
              <div className="inv-po-progress-text">
                <span>{m.totalReceived} of {m.totalOrdered} qty received</span>
                <strong>{m.detailDeliveryPct.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          {/* ── Two-column details + meta ── */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Details</div>
            <div className="inv-po-modal-details-grid">
              <div className="inv-po-modal-detail-item"><span className="inv-po-modal-detail-lbl">PO Date</span><span className="inv-po-modal-detail-val">{fullPo.date || '—'}</span></div>
              <div className="inv-po-modal-detail-item"><span className="inv-po-modal-detail-lbl">Expected Delivery</span><span className="inv-po-modal-detail-val">{fullPo.expected || fullPo.expectedDelivery || '—'}</span></div>
              <div className="inv-po-modal-detail-item"><span className="inv-po-modal-detail-lbl">Payment Terms</span><span className="inv-po-modal-detail-val">{fullPo.terms || fullPo.paymentTerms || '—'}</span></div>
              <div className="inv-po-modal-detail-item"><span className="inv-po-modal-detail-lbl">Delivery Warehouse</span><span className="inv-po-modal-detail-val">{wh ? `${wh.name}${wh.city ? ' · ' + wh.city : ''}` : '—'}</span></div>
              <div className="inv-po-modal-detail-item"><span className="inv-po-modal-detail-lbl">Created By</span><span className="inv-po-modal-detail-val">{fullPo.createdBy || '—'}</span></div>
              {fullPo.notes && <div className="inv-po-modal-detail-item inv-po-modal-detail-item--full"><span className="inv-po-modal-detail-lbl">Notes</span><span className="inv-po-modal-detail-val">{fullPo.notes}</span></div>}
            </div>
          </div>

          {/* ── Line Items ── */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">
              Line Items {loadingItems ? <span style={{ color:'#94a3b8', fontWeight:400 }}>(loading…)</span> : `(${fullPo.items.length})`}
            </div>
            <div className="inv-table-container" style={{ marginBottom: 0 }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Item</th>
                    <th style={{ textAlign:'center' }}>Unit</th>
                    <th style={{ textAlign:'right'  }}>Ordered</th>
                    <th style={{ textAlign:'right'  }}>Received</th>
                    <th style={{ textAlign:'right'  }}>Pending</th>
                    <th style={{ textAlign:'right'  }}>Rate (₹)</th>
                    <th style={{ textAlign:'right'  }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fullPo.items.length === 0 ? (
                    <tr><td colSpan={8} className="inv-empty-cell">
                      <div className="inv-empty"><span className="inv-empty-icon">📦</span><p>No line items loaded yet.</p></div>
                    </td></tr>
                  ) : fullPo.items.map((li, idx) => {
                    const ordered   = Number(li.orderedQty || li.qty) || 0;
                    const received  = Number(li.receivedQty) || 0;
                    const pending   = Math.max(0, ordered - received);
                    const sub       = ordered * (Number(li.rate) || 0);
                    const lineTotal = sub + (sub * (Number(li.tax || li.taxPct) || 0) / 100);
                    const delivPct  = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;
                    return (
                      <tr key={idx}>
                        <td className="inv-code-cell">{li.itemCode || '—'}</td>
                        <td className="inv-name-cell">{li.itemName || li.name}</td>
                        <td style={{ textAlign:'center' }} className="inv-muted">{li.unit}</td>
                        <td style={{ textAlign:'right' }}>{fmt(ordered)}</td>
                        <td style={{ textAlign:'right' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                            <div style={{ width:40, height:4, background:'#e2e8f0', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
                              <div style={{ width:`${delivPct}%`, height:'100%', background: received >= ordered ? '#16a34a' : '#3b82f6', borderRadius:3 }} />
                            </div>
                            <span style={{ color: received >= ordered ? '#166534' : '#1e40af', fontWeight:600, minWidth:28, textAlign:'right' }}>{fmt(received)}</span>
                          </div>
                        </td>
                        <td style={{ textAlign:'right', color: pending > 0 ? '#b91c1c' : '#64748b', fontWeight: pending > 0 ? 600 : 400 }}>{fmt(pending)}</td>
                        <td style={{ textAlign:'right' }}>{fmtCcy(li.rate)}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{fmtCcy(lineTotal.toFixed(0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Linked Bills ── */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Linked Bills ({m.linkedBills.length})</div>
            {m.linkedBills.length === 0 ? (
              <p className="inv-empty-hint">No bills recorded against this PO yet.</p>
            ) : (
              <div className="inv-table-container" style={{ marginBottom: 0 }}>
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Bill No.</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th style={{ textAlign:'right' }}>Amount</th>
                      <th style={{ textAlign:'right' }}>Paid</th>
                      <th style={{ textAlign:'center' }}>Status</th>
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
                          <td style={{ textAlign:'right', fontWeight:600 }}>{fmtCcy(b.amount)}</td>
                          <td style={{ textAlign:'right', color:'#166534' }}>{fmtCcy(b.paid)}</td>
                          <td style={{ textAlign:'center' }}><span className="inv-status-badge" style={{ background: bsm.bg, color: bsm.color }}>{bsm.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Linked Payments ── */}
          {linkedPayments.length > 0 && (
            <div className="inv-po-modal-section">
              <div className="inv-po-modal-section-title">Linked Payments ({linkedPayments.length})</div>
              <div className="inv-txn-list">
                {linkedPayments.map(p => (
                  <div key={p.id} className="inv-txn-row">
                    <span className="inv-txn-type" style={{ background: p.billId ? '#dcfce7' : '#eff6ff', color: p.billId ? '#166534' : '#1e40af' }}>
                      {p.billId ? '✓ Bill Payment' : '⬆ Advance'}
                    </span>
                    <div className="inv-txn-info">
                      <span className="inv-txn-qty" style={{ color:'#166534' }}>{fmtCcy(p.amount)}</span>
                      <span className="inv-txn-ref">{p.paymentNumber} · {p.mode} · {p.reference || '—'}</span>
                    </div>
                    <span className="inv-txn-date">{p.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>{/* end modal-body */}
      </div>
    </div>
  );
}