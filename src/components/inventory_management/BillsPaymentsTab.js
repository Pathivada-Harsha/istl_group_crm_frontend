import React, { useState, useRef } from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import FilterSelect from '../Dropdowns/FilterSelect.js';
import {
  BILL_STATUS, PAY_MODES, fmtCcy,
  ColumnVisibilityDropdown, DraggableHeaderCell, getSortIcon, PaginationBar,
} from './inventoryConstants.js';

export default function BillsPaymentsTab({
  bills, payments, vendors, pos,
  onCreateBill, onRecordPayment, onEditBill, onEditPayment, onAllocateAdvance, onDeleteBill, onDeletePayment, canCreate,
  billPage, billPageSize, billTotal, billTotalPages, billSearch, billStatus,
  onBillPageChange, onBillPageSizeChange, onBillSearchChange, onBillStatusChange,
  onGetBillPayments,
  payPage, payPageSize, payTotal, payTotalPages, paySearch, payMode, payType,
  onPayPageChange, onPayPageSizeChange, onPaySearchChange, onPayModeChange, onPayTypeChange,
  onGetAdvanceAllocations,
}) {
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
        ? <BillsList bills={bills} onCreate={onCreateBill} onEdit={onEditBill} onDelete={onDeleteBill} canCreate={canCreate}
            search={billSearch} onSearchChange={onBillSearchChange}
            status={billStatus} onStatusChange={onBillStatusChange}
            page={billPage} pageSize={billPageSize} total={billTotal} totalPages={billTotalPages}
            onPageChange={onBillPageChange} onPageSizeChange={onBillPageSizeChange}
            onGetPayments={onGetBillPayments} />
        : <PaymentsList payments={payments} onRecord={onRecordPayment} onEdit={onEditPayment} onAllocate={onAllocateAdvance} onDelete={onDeletePayment} canCreate={canCreate}
            search={paySearch} onSearchChange={onPaySearchChange}
            mode={payMode} onModeChange={onPayModeChange}
            type={payType} onTypeChange={onPayTypeChange}
            page={payPage} pageSize={payPageSize} total={payTotal} totalPages={payTotalPages}
            onPageChange={onPayPageChange} onPageSizeChange={onPayPageSizeChange}
            onGetAllocations={onGetAdvanceAllocations} />}
    </>
  );
}

const BILLS_ALL_COLUMNS = [
  { key: 'idx',        label: 'S.No',      sortable: false, required: true,  align: 'center' },
  { key: 'billNumber', label: 'Bill No.',  sortable: true,  required: true,  align: 'left'   },
  { key: 'vendorName', label: 'Vendor',    sortable: true,  required: false, align: 'left'   },
  { key: 'poNumber',   label: 'PO Ref',    sortable: true,  required: false, align: 'left'   },
  { key: 'billDate',   label: 'Bill Date', sortable: true,  required: false, align: 'left'   },
  { key: 'dueDate',    label: 'Due Date',  sortable: true,  required: false, align: 'left'   },
  { key: 'amount',     label: 'Amount',    sortable: true,  required: false, align: 'right'  },
  { key: 'paid',       label: 'Paid',      sortable: true,  required: false, align: 'right'  },
  { key: 'balance',    label: 'Balance',   sortable: true,  required: false, align: 'right'  },
  { key: 'status',     label: 'Status',    sortable: true,  required: false, align: 'center' },
  { key: 'projectId',  label: 'Project',   sortable: true,  required: false, align: 'left'   },
  { key: 'actions',    label: 'Actions',   sortable: false, required: true,  align: 'center' },
];
const BILLS_DEFAULT_ORDER   = BILLS_ALL_COLUMNS.map(c => c.key);
const BILLS_DEFAULT_VISIBLE = BILLS_ALL_COLUMNS.map(c => c.key);

function BillsList({
  bills, onCreate, onEdit, onDelete, canCreate,
  search, onSearchChange, status, onStatusChange,
  page, pageSize, total, totalPages,
  onPageChange, onPageSizeChange,
  onGetPayments,
}) {
  const [selectedBill, setSelectedBill] = useState(null);

  const [columnOrder, setColumnOrder]       = useState(BILLS_DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(BILLS_DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn]         = useState('');
  const [sortDirection, setSortDirection]   = useState('asc');
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex]   = useState(null);

  // Sorting is client-side on the current page (server returns page slice)
  let displayed = [...bills];
  if (sortColumn) {
    displayed.sort((a, b) => {
      const av = sortColumn === 'balance' ? (a.amount - a.paid) : (a[sortColumn] ?? '');
      const bv = sortColumn === 'balance' ? (b.amount - b.paid) : (b[sortColumn] ?? '');
      return sortDirection === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }

  const orderedVisibleBillsCols = columnOrder
    .map(k => BILLS_ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && (c.required || visibleColumns.includes(c.key)));

  const handleSort = col => { const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc'; setSortColumn(col); setSortDirection(dir); };
  const handleColDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(idx); };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisibleBillsCols.map(c => c.key);
    const fromKey = visKeys[fromIdx], toKey = visKeys[dropIdx];
    const o = [...columnOrder]; const a = o.indexOf(fromKey), b = o.indexOf(toKey);
    o.splice(a, 1); o.splice(b, 0, fromKey);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd = e => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };
  const handleToggleColumn = k => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns  = () => { setColumnOrder(BILLS_DEFAULT_ORDER); setVisibleColumns(BILLS_DEFAULT_VISIBLE); };

  return (
    <>
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by bill no, vendor or PO…"
              value={search} onChange={e => onSearchChange(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => onSearchChange('')}>✕</button>}
          </div>
          <FilterSelect
            value={status}
            onChange={v => onStatusChange(v)}
            options={Object.entries(BILL_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
            placeholder="All Status"
          />
          {(search || status) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => { onSearchChange(''); onStatusChange(''); }}>✕ Clear</button>
          )}
        </div>
        <div className="inv-action-right">
          <ColumnVisibilityDropdown columns={BILLS_ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
          {canCreate && (
            <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onCreate}>+ Add Bill</button>
          )}
        </div>
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              {orderedVisibleBillsCols.map((col, idx) => (
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
            {bills.length === 0 ? (
              <tr><td colSpan={orderedVisibleBillsCols.length} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">🧾</span>
                  <p>{search || status ? 'No bills match your filters.' : 'No bills yet. Click "+ Add Bill" to begin.'}</p>
                </div>
              </td></tr>
            ) : displayed.map((b, idx) => {
              const sm = BILL_STATUS[b.status] || BILL_STATUS.UNPAID;
              const balance = Number(b.balance ?? b.balanceAmount ?? (b.amount - b.paid));
              return (
                <tr key={b.id} className="inv-table-row" onClick={() => setSelectedBill(b)}>
                  {orderedVisibleBillsCols.map(col => {
                    if (col.key === 'idx') return <td key="idx" data-col="idx" style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{page * pageSize + idx + 1}</td>;
                    if (col.key === 'billNumber') return <td key="billNumber" data-col="billNumber" className="inv-code-cell">{b.billNumber}</td>;
                    if (col.key === 'vendorName') return <td key="vendorName" data-col="vendorName" className="inv-name-cell">{b.vendorName}</td>;
                    if (col.key === 'poNumber') return <td key="poNumber" data-col="poNumber" className="inv-code-cell">{b.poNumber || '—'}</td>;
                    if (col.key === 'billDate') return <td key="billDate" data-col="billDate" className="inv-muted">{b.billDate ? String(b.billDate).slice(0,10) : '—'}</td>;
                    if (col.key === 'dueDate') return <td key="dueDate" data-col="dueDate" className="inv-muted" style={{ color: b.status === 'OVERDUE' ? '#991b1b' : undefined, fontWeight: b.status === 'OVERDUE' ? 600 : undefined }}>{b.dueDate ? String(b.dueDate).slice(0,10) : '—'}</td>;
                    if (col.key === 'amount') return <td key="amount" data-col="amount" style={{ fontWeight: 600 }}>{fmtCcy(b.amount)}</td>;
                    if (col.key === 'paid') return <td key="paid" data-col="paid" style={{ color:'#166534' }}>{fmtCcy(b.paid)}</td>;
                    if (col.key === 'balance') return <td key="balance" data-col="balance" style={{ fontWeight: 600, color: balance > 0 ? '#991b1b' : '#166534' }}>{fmtCcy(balance)}</td>;
                    if (col.key === 'status') return <td key="status" data-col="status"><span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>;
                    if (col.key === 'projectId') return <td key="projectId" data-col="projectId" className="inv-muted">{b.projectId || '—'}</td>;
                    if (col.key === 'actions') return (
                      <td key="actions" data-col="actions" onClick={e => e.stopPropagation()}>
                        <div className="inv-row-actions">
                          <button className="inv-icon-action inv-icon-action--view" title="View bill" onClick={() => setSelectedBill(b)}><Eye size={15}/></button>
                          {canCreate && <button className="inv-icon-action inv-icon-action--edit" title="Edit bill" onClick={() => onEdit && onEdit(b)}><Edit2 size={14}/></button>}
                          {canCreate && <button className="inv-icon-action inv-icon-action--delete" title="Delete bill" onClick={() => onDelete && onDelete(b)}><Trash2 size={14}/></button>}
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

      <PaginationBar page={page} pageSize={pageSize} total={total} totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        label="bills" />

      {selectedBill && (
        <BillModal bill={selectedBill} onClose={() => setSelectedBill(null)} onGetPayments={onGetPayments} />
      )}
    </>
  );
}

const PAYMENTS_ALL_COLUMNS = [
  { key: 'idx',           label: 'S.No',        sortable: false, required: true,  align: 'center' },
  { key: 'paymentNumber', label: 'Payment No.', sortable: true,  required: true,  align: 'left'   },
  { key: 'type',          label: 'Type',        sortable: false, required: false, align: 'center' },
  { key: 'date',          label: 'Date',        sortable: true,  required: false, align: 'left'   },
  { key: 'billNumber',    label: 'Bill Ref',    sortable: true,  required: false, align: 'left'   },
  { key: 'vendorName',    label: 'Vendor',      sortable: true,  required: false, align: 'left'   },
  { key: 'mode',          label: 'Mode',        sortable: true,  required: false, align: 'center' },
  { key: 'reference',     label: 'Reference',   sortable: true,  required: false, align: 'left'   },
  { key: 'amount',        label: 'Amount',      sortable: true,  required: false, align: 'right'  },
  { key: 'actions',       label: 'Actions',     sortable: false, required: true,  align: 'center' },
];
const PAYMENTS_DEFAULT_ORDER   = PAYMENTS_ALL_COLUMNS.map(c => c.key);
const PAYMENTS_DEFAULT_VISIBLE = PAYMENTS_ALL_COLUMNS.map(c => c.key);

function PaymentsList({
  payments, onRecord, onEdit, onAllocate, onDelete, canCreate,
  search, onSearchChange, mode, onModeChange, type, onTypeChange,
  page, pageSize, total, totalPages,
  onPageChange, onPageSizeChange,
  onGetAllocations,
}) {
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [columnOrder, setColumnOrder]       = useState(PAYMENTS_DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(PAYMENTS_DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn]         = useState('');
  const [sortDirection, setSortDirection]   = useState('asc');
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex]   = useState(null);

  // Client-side sort on current page only.
  // Hide allocation-child rows (advanceId != null) - they are internal accounting
  // entries. The parent advance row already shows appliedAmount.
  // Per-bill breakdown is visible inside the PaymentModal view.
  let displayed = [...payments].filter(p => !p.advanceId);
  if (sortColumn) {
    displayed.sort((a, b) => {
      const av = a[sortColumn] ?? '', bv = b[sortColumn] ?? '';
      return sortDirection === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }

  const orderedVisiblePayCols = columnOrder
    .map(k => PAYMENTS_ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && (c.required || visibleColumns.includes(c.key)));

  const handleSort = col => { const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc'; setSortColumn(col); setSortDirection(dir); };
  const handleColDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(idx); };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisiblePayCols.map(c => c.key);
    const fromKey = visKeys[fromIdx], toKey = visKeys[dropIdx];
    const o = [...columnOrder]; const a = o.indexOf(fromKey), b = o.indexOf(toKey);
    o.splice(a, 1); o.splice(b, 0, fromKey);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd = e => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };
  const handleToggleColumn = k => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns  = () => { setColumnOrder(PAYMENTS_DEFAULT_ORDER); setVisibleColumns(PAYMENTS_DEFAULT_VISIBLE); };

  return (
    <>
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by payment no, vendor, bill or reference…"
              value={search} onChange={e => onSearchChange(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => onSearchChange('')}>✕</button>}
          </div>
          <FilterSelect
            value={type}
            onChange={v => onTypeChange(v)}
            options={[{ value: 'BILL_PAYMENT', label: 'Bill Payment' }, { value: 'ADVANCE', label: 'Advance' }]}
            placeholder="All Types"
          />
          <FilterSelect
            value={mode}
            onChange={v => onModeChange(v)}
            options={PAY_MODES.map(m => ({ value: m, label: m }))}
            placeholder="All Modes"
          />
          {(search || mode || type) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => { onSearchChange(''); onModeChange(''); onTypeChange(''); }}>✕ Clear</button>
          )}
        </div>
        <div className="inv-action-right">
          <ColumnVisibilityDropdown columns={PAYMENTS_ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
          {canCreate && (
            <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onRecord}>+ Record Payment</button>
          )}
        </div>
      </div>

      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              {orderedVisiblePayCols.map((col, idx) => (
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
            {payments.length === 0 ? (
              <tr><td colSpan={orderedVisiblePayCols.length} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">💸</span>
                  <p>{search || mode || type ? 'No payments match your filters.' : 'No payments recorded yet.'}</p>
                </div>
              </td></tr>
            ) : displayed.map((p, idx) => (
              <tr key={p.id} className="inv-table-row" onClick={() => setSelectedPayment(p)}>
                {orderedVisiblePayCols.map(col => {
                  if (col.key === 'idx') return <td key="idx" data-col="idx" style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{page * pageSize + idx + 1}</td>;
                  if (col.key === 'paymentNumber') return <td key="paymentNumber" data-col="paymentNumber" className="inv-code-cell">{p.paymentNumber}</td>;
                  if (col.key === 'type') return <td key="type" data-col="type">{p.billId ? <span className="inv-status-badge" style={{ background:'#dcfce7', color:'#166534' }}>Bill Payment</span> : <span className="inv-status-badge" style={{ background:'#eff6ff', color:'#1e40af' }}>Advance</span>}</td>;
                  if (col.key === 'date') return <td key="date" data-col="date" className="inv-muted">{p.date}</td>;
                  if (col.key === 'billNumber') return <td key="billNumber" data-col="billNumber" className="inv-code-cell">{p.billNumber || '—'}</td>;
                  if (col.key === 'vendorName') return <td key="vendorName" data-col="vendorName" className="inv-name-cell">{p.vendorName}</td>;
                  if (col.key === 'mode') return <td key="mode" data-col="mode"><span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>{p.mode}</span></td>;
                  if (col.key === 'reference') return <td key="reference" data-col="reference" className="inv-code-cell">{p.reference || '—'}</td>;
                  if (col.key === 'amount') return (
                    <td key="amount" data-col="amount" style={{ fontWeight: 600, color:'#166534' }}>
                      <div>{fmtCcy(p.amount)}</div>
                      {!p.billId && p.amount > 0 && (
                        <div style={{ fontSize:11, color: p.unappliedAmount > 0 ? '#d97706' : '#166534', fontWeight:400, marginTop:1 }}>
                          {p.unappliedAmount > 0 ? `${fmtCcy(p.unappliedAmount)} unallocated` : '✓ Fully allocated'}
                        </div>
                      )}
                    </td>
                  );
                  if (col.key === 'actions') return (
                    <td key="actions" data-col="actions" onClick={e => e.stopPropagation()}>
                      <div className="inv-row-actions">
                        <button className="inv-icon-action inv-icon-action--view" title="View payment" onClick={() => setSelectedPayment(p)}><Eye size={15}/></button>
                        {canCreate && !p.billId && p.unappliedAmount > 0 && (
                          <button className="inv-icon-action" title="Allocate to bills"
                            style={{ color:'#166534', background:'#dcfce7' }}
                            onClick={() => onAllocate && onAllocate(p)}>₹</button>
                        )}
                        {canCreate && <button className="inv-icon-action inv-icon-action--edit" title="Edit payment" onClick={() => onEdit && onEdit(p)}><Edit2 size={14}/></button>}
                        {canCreate && <button className="inv-icon-action inv-icon-action--delete" title="Delete payment" onClick={() => onDelete && onDelete(p)}><Trash2 size={14}/></button>}
                      </div>
                    </td>
                  );
                  return null;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} pageSize={pageSize} total={total} totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        label="payments" />

      {selectedPayment && (
        <PaymentModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} onGetAllocations={onGetAllocations} />
      )}
    </>
  );
}

// ── Bill View Modal ───────────────────────────────────────────────────────────
function BillModal({ bill, onClose, onGetPayments }) {
  const sm      = BILL_STATUS[bill.status] || BILL_STATUS.UNPAID;
  const balance = Number(bill.balance ?? bill.balanceAmount ?? (bill.amount - bill.paid));
  const paidPct = bill.amount > 0 ? Math.min(100, (bill.paid / bill.amount) * 100) : 0;
  const [payHistory, setPayHistory]     = useState([]);
  const [payHistLoading, setPayHistLoad] = useState(false);
  React.useEffect(() => {
    if (!bill?.id || !onGetPayments) return;
    setPayHistLoad(true);
    onGetPayments(bill.id)
      .then(rows => setPayHistory(Array.isArray(rows) ? rows : []))
      .catch(() => setPayHistory([]))
      .finally(() => setPayHistLoad(false));
  }, [bill?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--bill-view" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="inv-modal-header">
          <div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
              {bill.billNumber || bill.billNo}
            </div>
            <h3 className="inv-modal-title">{bill.vendorName}</h3>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              {bill.poNumber && bill.poNumber !== '—' && (
                <span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>
                  PO: {bill.poNumber}
                </span>
              )}
              {bill.projectId && (
                <span className="inv-cat-badge" style={{ background:'#f8fafc', color:'#475569', borderColor:'#e2e8f0' }}>
                  {bill.projectId}
                </span>
              )}
            </div>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">

          {/* KPI strip */}
          <div className="inv-po-modal-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { val: fmtCcy(bill.amount), lbl: 'Bill Amount' },
              { val: fmtCcy(bill.paid),   lbl: 'Paid' },
              { val: fmtCcy(balance),     lbl: 'Balance', color: balance > 0 ? '#991b1b' : '#166534' },
            ].map((k, i) => (
              <div key={i} className="inv-po-modal-kpi">
                <div className="inv-po-modal-kpi-val" style={{ color: k.color }}>{k.val}</div>
                <div className="inv-po-modal-kpi-lbl">{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Payment progress bar */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Payment Progress</div>
            <div className="inv-po-progress">
              <div className="inv-po-progress-bar">
                <div className="inv-po-progress-fill" style={{ width: `${paidPct}%`, background: paidPct >= 100 ? '#16a34a' : '#3b82f6' }} />
              </div>
              <div className="inv-po-progress-text">
                <span>{fmtCcy(bill.paid)} of {fmtCcy(bill.amount)} paid</span>
                <strong>{paidPct.toFixed(0)}%</strong>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Details</div>
            <div className="inv-po-modal-details-grid">
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">Bill Date</span>
                <span className="inv-po-modal-detail-val">{bill.billDate ? String(bill.billDate).slice(0,10) : '—'}</span>
              </div>
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">Due Date</span>
                <span className="inv-po-modal-detail-val" style={{ color: bill.status === 'OVERDUE' ? '#991b1b' : undefined, fontWeight: bill.status === 'OVERDUE' ? 600 : undefined }}>
                  {bill.dueDate ? String(bill.dueDate).slice(0,10) : '—'}
                </span>
              </div>
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">PO Reference</span>
                <span className="inv-po-modal-detail-val">{bill.poNumber || '—'}</span>
              </div>
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">Project</span>
                <span className="inv-po-modal-detail-val">{bill.projectId || '—'}</span>
              </div>
              {bill.notes && (
                <div className="inv-po-modal-detail-item inv-po-modal-detail-item--full">
                  <span className="inv-po-modal-detail-lbl">Notes</span>
                  <span className="inv-po-modal-detail-val">{bill.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          {bill.items && bill.items.length > 0 && (
            <div className="inv-po-modal-section">
              <div className="inv-po-modal-section-title">Line Items ({bill.items.length})</div>
              <div className="inv-table-container" style={{ marginBottom: 0 }}>
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th style={{ textAlign:'center' }}>Unit</th>
                      <th style={{ textAlign:'right' }}>Qty</th>
                      <th style={{ textAlign:'right' }}>Rate (₹)</th>
                      <th style={{ textAlign:'right' }}>Tax %</th>
                      <th style={{ textAlign:'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((li, i) => {
                      const qty  = Number(li.qty  ?? 0);
                      const rate = Number(li.rate ?? 0);
                      const tax  = Number(li.taxPct ?? 0);
                      const sub  = qty * rate;
                      const lineTotal = sub + (sub * tax / 100);
                      return (
                        <tr key={i}>
                          <td className="inv-code-cell">{li.itemCode || '—'}</td>
                          <td className="inv-name-cell">{li.itemName || li.name || '—'}</td>
                          <td style={{ textAlign:'center' }} className="inv-muted">{li.unit}</td>
                          <td style={{ textAlign:'right' }}>{qty}</td>
                          <td style={{ textAlign:'right' }}>{fmtCcy(rate)}</td>
                          <td style={{ textAlign:'right' }} className="inv-muted">{tax}%</td>
                          <td style={{ textAlign:'right', fontWeight: 600 }}>{fmtCcy(lineTotal.toFixed(0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Payment History</div>
            {payHistLoading ? (
              <div style={{ padding:'12px 0', color:'#94a3b8', fontSize:13 }}>Loading...</div>
            ) : payHistory.length === 0 ? (
              <div style={{ padding:'12px 0', color:'#94a3b8', fontSize:13 }}>No payments recorded yet.</div>
            ) : (
              <div className="inv-table-container" style={{ marginBottom: 0 }}>
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Payment No.</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Mode</th>
                      <th>Reference</th>
                      <th style={{ textAlign:'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payHistory.map((p, i) => {
                      const isAlloc = !!p.advanceId;
                      return (
                        <tr key={p.id || i}>
                          <td className="inv-code-cell">{p.paymentNo}</td>
                          <td className="inv-muted">{p.paymentDate ? String(p.paymentDate).slice(0,10) : '—'}</td>
                          <td>
                            {isAlloc
                              ? <span className="inv-status-badge" style={{ background:'#eff6ff', color:'#1e40af', fontSize:11 }}>
                                  Advance Alloc{p.advancePaymentNo ? ` ← ${p.advancePaymentNo}` : ''}
                                </span>
                              : <span className="inv-status-badge" style={{ background:'#dcfce7', color:'#166534', fontSize:11 }}>Direct</span>}
                          </td>
                          <td className="inv-muted">{p.paymentMode || '—'}</td>
                          <td className="inv-code-cell">{p.referenceNumber || '—'}</td>
                          <td style={{ textAlign:'right', fontWeight:600, color:'#166534' }}>{fmtCcy(p.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Payment View Modal ────────────────────────────────────────────────────────
function PaymentModal({ payment, onClose, onGetAllocations }) {
  const isAdvance = !payment.billId;
  const [allocations, setAllocations]   = useState([]);
  const [allocLoading, setAllocLoading] = useState(false);
  React.useEffect(() => {
    if (!isAdvance || !payment?.id || !onGetAllocations) return;
    setAllocLoading(true);
    onGetAllocations(payment.id)
      .then(rows => setAllocations(Array.isArray(rows) ? rows : []))
      .catch(() => setAllocations([]))
      .finally(() => setAllocLoading(false));
  }, [payment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal inv-modal--bill-view" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="inv-modal-header">
          <div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
              {payment.paymentNumber || payment.paymentNo}
            </div>
            <h3 className="inv-modal-title">{payment.vendorName}</h3>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {isAdvance
                ? <span className="inv-status-badge" style={{ background:'#eff6ff', color:'#1e40af' }}>Advance</span>
                : <span className="inv-status-badge" style={{ background:'#dcfce7', color:'#166534' }}>Bill Payment</span>}
              {payment.billNumber && !isAdvance && (
                <span className="inv-cat-badge" style={{ background:'#eff6ff', color:'#1e40af', borderColor:'#bfdbfe' }}>
                  Bill: {payment.billNumber}
                </span>
              )}
            </div>
          </div>
          <button className="inv-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="inv-modal-body">

          {/* KPI strip */}
          <div className="inv-po-modal-kpis" style={{ gridTemplateColumns: isAdvance ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)' }}>
            <div className="inv-po-modal-kpi">
              <div className="inv-po-modal-kpi-val" style={{ color:'#166534' }}>{fmtCcy(payment.amount)}</div>
              <div className="inv-po-modal-kpi-lbl">Amount Paid</div>
            </div>
            {isAdvance && (
              <div className="inv-po-modal-kpi">
                <div className="inv-po-modal-kpi-val" style={{ color: payment.unappliedAmount > 0 ? '#d97706' : '#166534' }}>
                  {fmtCcy(payment.unappliedAmount ?? 0)}
                </div>
                <div className="inv-po-modal-kpi-lbl">
                  {payment.unappliedAmount > 0 ? 'Unallocated' : 'Fully Allocated'}
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="inv-po-modal-section">
            <div className="inv-po-modal-section-title">Details</div>
            <div className="inv-po-modal-details-grid">
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">Payment Date</span>
                <span className="inv-po-modal-detail-val">{payment.date ? String(payment.date).slice(0,10) : '—'}</span>
              </div>
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">Payment Mode</span>
                <span className="inv-po-modal-detail-val">{payment.mode || '—'}</span>
              </div>
              <div className="inv-po-modal-detail-item">
                <span className="inv-po-modal-detail-lbl">Reference No.</span>
                <span className="inv-po-modal-detail-val" style={{ fontFamily: 'monospace', fontSize: 12 }}>{payment.reference || '—'}</span>
              </div>
              {!isAdvance && (
                <div className="inv-po-modal-detail-item">
                  <span className="inv-po-modal-detail-lbl">Bill Reference</span>
                  <span className="inv-po-modal-detail-val">{payment.billNumber || '—'}</span>
                </div>
              )}
              {payment.projectId && (
                <div className="inv-po-modal-detail-item">
                  <span className="inv-po-modal-detail-lbl">Project</span>
                  <span className="inv-po-modal-detail-val">{payment.projectId}</span>
                </div>
              )}
              {payment.notes && (
                <div className="inv-po-modal-detail-item inv-po-modal-detail-item--full">
                  <span className="inv-po-modal-detail-lbl">Notes</span>
                  <span className="inv-po-modal-detail-val">{payment.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Advance Adjusted Against Bills */}
          {isAdvance && (
            <div className="inv-po-modal-section">
              <div className="inv-po-modal-section-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>\ud83d\udd17</span>
                Advance Adjusted Against Bills
                {!allocLoading && (
                  <span style={{ background:'#ede9fe', color:'#6d28d9', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>
                    {allocations.length} bill{allocations.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {allocLoading ? (
                <div style={{ padding:'12px 0', color:'#94a3b8', fontSize:13 }}>Loading...</div>
              ) : allocations.length === 0 ? (
                <div style={{ background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:10, padding:16, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                  This advance has not been allocated to any bill yet.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {allocations.map((alloc, i) => (
                    <div key={alloc.allocationId || i} style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderLeft:'4px solid #7c3aed', borderRadius:10, padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 16px' }}>
                      <div>
                        <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, marginBottom:3 }}>BILL</div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>{alloc.billNo || '—'}</div>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'#ede9fe', color:'#6d28d9', marginTop:4, display:'inline-block' }}>{alloc.billStatus || '—'}</span>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, marginBottom:3 }}>ALLOCATED</div>
                        <div style={{ fontSize:16, fontWeight:700, color:'#7c3aed' }}>{fmtCcy(alloc.allocatedAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, marginBottom:3 }}>BILL TOTAL</div>
                        <div style={{ fontSize:13, color:'#374151' }}>{fmtCcy(alloc.billTotalAmount)}</div>
                        <div style={{ fontSize:11, color:'#dc2626', marginTop:2 }}>Balance: {fmtCcy(alloc.billBalance)}</div>
                      </div>
                      <div style={{ gridColumn:'1/-1', borderTop:'1px solid #ddd6fe', paddingTop:8, fontSize:12, color:'#6b7280' }}>
                        Allocated on: <strong style={{ color:'#374151' }}>{alloc.allocationDate ? String(alloc.allocationDate).slice(0,10) : '—'}</strong>
                      </div>
                    </div>
                  ))}
                  <div style={{ background:'#ede9fe', border:'1px solid #c4b5fd', borderRadius:8, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, color:'#4c1d95', fontWeight:600 }}>Total allocated across {allocations.length} bill{allocations.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize:15, fontWeight:700, color:'#7c3aed' }}>{fmtCcy(allocations.reduce((s,a) => s + Number(a.allocatedAmount || 0), 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}