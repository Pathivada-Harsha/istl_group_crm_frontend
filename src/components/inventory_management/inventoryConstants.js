import React, { useState, useRef, useEffect } from 'react';

// ── Shared constants and utilities for Inventory Management tabs ──────────────

export const CATEGORY_COLORS = {
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

export const STOCK_STATUS = {
  IN_STOCK:    { label: 'In Stock',     bg: '#dcfce7', color: '#166534' },
  LOW_STOCK:   { label: 'Low Stock',    bg: '#fef9c3', color: '#854d0e' },
  OUT_OF_STOCK:{ label: 'Out of Stock', bg: '#fee2e2', color: '#991b1b' },
  ON_ORDER:    { label: 'On Order',     bg: '#e0f2fe', color: '#0c4a6e' },
};

export const TXN_TYPES = {
  INWARD:     { label: 'Inward',     bg: '#dcfce7', color: '#166534', icon: '↓' },
  OUTWARD:    { label: 'Outward',    bg: '#fee2e2', color: '#991b1b', icon: '↑' },
  TRANSFER:   { label: 'Transfer',   bg: '#e0f2fe', color: '#0c4a6e', icon: '⇄' },
  ADJUSTMENT: { label: 'Adjustment', bg: '#fef9c3', color: '#854d0e', icon: '~' },
  RETURN:     { label: 'Return',     bg: '#fdf4ff', color: '#7e22ce', icon: '↩' },
};

export const PO_STATUS = {
  DRAFT:     { label: 'Draft',               bg: '#f1f5f9', color: '#475569' },
  SENT:      { label: 'Sent',                bg: '#e0f2fe', color: '#0c4a6e' },
  APPROVED:  { label: 'Approved',            bg: '#dcfce7', color: '#166534' },
  PARTIAL:   { label: 'Partially Received',  bg: '#fef9c3', color: '#854d0e' },
  RECEIVED:  { label: 'Received',            bg: '#dcfce7', color: '#166534' },
  DELIVERED: { label: 'Delivered',           bg: '#dbeafe', color: '#1e40af' },
  CANCELLED: { label: 'Cancelled',           bg: '#fee2e2', color: '#991b1b' },
};

export const BILL_STATUS = {
  UNPAID:  { label: 'Unpaid',          bg: '#fee2e2', color: '#991b1b' },
  PARTIAL: { label: 'Partially Paid',  bg: '#fef9c3', color: '#854d0e' },
  PAID:    { label: 'Paid',            bg: '#dcfce7', color: '#166534' },
  OVERDUE: { label: 'Overdue',         bg: '#fee2e2', color: '#7f1d1d' },
};

export const PAY_MODES = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Credit Card'];

export const UNITS = [
  'Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Roll', 'Sheet', 'Pair', 'Bag',
  'Sqm', 'Cum', 'Ton', 'Gram', 'Bundle', 'Lot', 'Reel', 'Coil', 'Pack',
];

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmt(n) { return Number(n).toLocaleString('en-IN'); }
export function fmtCcy(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

// ── Shared UI: Column Visibility Dropdown ────────────────────────────────────

export function ColumnVisibilityDropdown({ columns, visibleColumns, onToggle, onReset }) {
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
      <button className={`col-visibility-btn${hiddenCount > 0 ? ' has-hidden' : ''}`} onClick={() => setOpen(o => !o)}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Columns
        {hiddenCount > 0 && <span className="col-visibility-badge">{hiddenCount}</span>}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
              <label key={col.key} className={`col-visibility-item${col.required ? ' col-required' : ''}`}>
                <input type="checkbox" checked={visibleColumns.includes(col.key)}
                  onChange={() => !col.required && onToggle(col.key)} disabled={col.required} />
                <span className="col-visibility-label">{col.label}</span>
                {col.required && <span className="col-required-tag">required</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI: Draggable Header Cell ─────────────────────────────────────────
const ALIGN_TO_JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };

export function DraggableHeaderCell({
  col, index, sortColumn, sortDirection, getSortIcon,
  handleSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver,
}) {
  const justify = ALIGN_TO_JUSTIFY[col.align || 'left'];
  return (
    <th
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      onDragEnd={onDragEnd}
      data-col={col.key}
      className={`col-draggable${isDragOver ? ' col-drag-over' : ''}${col.key === 'actions' ? ' actions-column-header' : ''}`}
      onClick={() => col.sortable && handleSort(col.key)}
      style={{ cursor: col.sortable ? 'pointer' : 'grab', textAlign: col.align || 'left' }}
    >
      <div className="th-content" style={{ justifyContent: justify }}>
        <span className="col-drag-handle" title="Drag to reorder">
          <svg fill="currentColor" viewBox="0 0 24 24" width="10" height="10">
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </span>
        {col.label}
        {col.sortable && getSortIcon(col.key, sortColumn, sortDirection)}
      </div>
    </th>
  );
}

// ── Shared UI: Sort Icon ──────────────────────────────────────────────────────
export function getSortIcon(col, sortColumn, sortDirection) {
  if (sortColumn !== col) return (
    <svg className="sort-icon sort-icon-default" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
  return sortDirection === 'asc'
    ? <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
    : <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
}

// ── Shared UI: Pagination Bar ─────────────────────────────────────────────────
export function PaginationBar({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange, label = 'records' }) {
  const firstEntry = total === 0 ? 0 : page * pageSize + 1;
  const lastEntry  = Math.min((page + 1) * pageSize, total);
  return (
    <div className="inv-tbl-footer">
      <div className="inv-pagination-info">
        {total === 0
          ? `No ${label}`
          : <>Showing <strong>{firstEntry}</strong>–<strong>{lastEntry}</strong> of <strong>{total}</strong> {label}</>}
        <select className="inv-page-size-select" value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(0); }}>
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>
      <div className="inv-pagination">
        <button className="inv-page-btn" onClick={() => onPageChange(0)} disabled={page === 0} title="First">«</button>
        <button className="inv-page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 0} title="Previous">‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(0, Math.min(page - 2, totalPages - 5));
          const p = start + i;
          return (
            <button key={p} className={`inv-page-btn${p === page ? ' active' : ''}`}
              onClick={() => onPageChange(p)}>{p + 1}</button>
          );
        })}
        <button className="inv-page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} title="Next">›</button>
        <button className="inv-page-btn" onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} title="Last">»</button>
      </div>
    </div>
  );
}