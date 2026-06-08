import React, { useState, useRef } from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import FilterSelect from '../Dropdowns/FilterSelect.js';
import {
  CATEGORY_COLORS, STOCK_STATUS,
  fmt, fmtCcy,
  ColumnVisibilityDropdown, DraggableHeaderCell, getSortIcon, PaginationBar,
} from './inventoryConstants.js';

const ITEMS_ALL_COLUMNS = [
  { key: 'idx',        label: 'S.No',        sortable: false, required: true,  align: 'center' },
  { key: 'itemCode',   label: 'Code',        sortable: true,  required: false, align: 'left'   },
  { key: 'name',       label: 'Item Name',   sortable: true,  required: true,  align: 'left'   },
  { key: 'category',   label: 'Category',    sortable: true,  required: false, align: 'center' },
  { key: 'currentQty', label: 'Qty',         sortable: true,  required: false, align: 'center' },
  { key: 'unit',       label: 'Unit',        sortable: false, required: false, align: 'center' },
  { key: 'unitCost',   label: 'Unit Cost',   sortable: true,  required: false, align: 'right'  },
  { key: 'totalValue', label: 'Total Value', sortable: true,  required: false, align: 'right'  },
  { key: 'location',   label: 'Location',    sortable: true,  required: false, align: 'left'   },
  { key: 'status',     label: 'Status',      sortable: true,  required: false, align: 'center' },
  { key: 'lastUpdated',label: 'Updated',     sortable: true,  required: false, align: 'left'   },
  { key: 'actions',    label: 'Actions',     sortable: false, required: true,  align: 'center' },
];
const ITEMS_DEFAULT_ORDER   = ITEMS_ALL_COLUMNS.map(c => c.key);
const ITEMS_DEFAULT_VISIBLE = ITEMS_ALL_COLUMNS.filter(c => c.key !== 'project').map(c => c.key);

function KpiCards({ items }) {
  const totalItems = items.length;
  const totalValue = items.reduce((s, i) => s + i.currentQty * i.unitCost, 0);
  const lowStock   = items.filter(i => i.status === 'LOW_STOCK').length;
  const outOfStock = items.filter(i => i.status === 'OUT_OF_STOCK').length;
  const cards = [
    { icon: '📦', label: 'Total Items',  value: totalItems,         sub: 'registered',       color: '#1e40af', bg: '#eff6ff' },
    { icon: '💰', label: 'Total Value',  value: fmtCcy(totalValue), sub: 'at current cost',  color: '#065f46', bg: '#ecfdf5' },
    { icon: '⚠️', label: 'Low Stock',    value: lowStock,           sub: 'need reorder',     color: '#92400e', bg: '#fffbeb', alert: lowStock > 0 },
    { icon: '🔴', label: 'Out of Stock', value: outOfStock,         sub: 'items unavailable',color: '#991b1b', bg: '#fef2f2', alert: outOfStock > 0 },
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

export default function ItemsTab({
  items, transactions,
  onAddItem, onTransaction, onEditItem, onDeleteItem, onViewItem,
  canCreate, canEdit,
  loading, error,
  search, onSearchChange,
  category, onCategoryChange,
  page, pageSize, total, totalPages,
  onPageChange, onPageSizeChange,
}) {
  const [statusFilter, setStatus]           = useState('');
  const [columnOrder, setColumnOrder]       = useState(ITEMS_DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(ITEMS_DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn]         = useState('');
  const [sortDirection, setSortDirection]   = useState('asc');
  const dragIndexRef                        = useRef(null);
  const [dragOverIndex, setDragOverIndex]   = useState(null);

  let filtered = statusFilter ? items.filter(i => i.status === statusFilter) : items;
  if (sortColumn) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortColumn] ?? '', bv = b[sortColumn] ?? '';
      return sortDirection === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }

  const orderedVisibleColumns = columnOrder
    .map(k => ITEMS_ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && (c.required || visibleColumns.includes(c.key)));

  const handleSort = col => {
    const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col); setSortDirection(dir);
  };
  const handleColDragStart = (e, i) => { dragIndexRef.current = i; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver  = (e, i) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(i); };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisibleColumns.map(c => c.key);
    const o = [...columnOrder];
    const a = o.indexOf(visKeys[fromIdx]), b = o.indexOf(visKeys[dropIdx]);
    o.splice(a, 1); o.splice(b, 0, visKeys[fromIdx]);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd    = e => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };
  const handleToggleColumn  = k => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns  = () => { setColumnOrder(ITEMS_DEFAULT_ORDER); setVisibleColumns(ITEMS_DEFAULT_VISIBLE); };

  const colCount = orderedVisibleColumns.length;

  return (
    <>
      {loading && <div className="inv-filter-hint" style={{ margin: '8px 0', display: 'inline-block' }}>Loading items…</div>}
      {error && !loading && <div className="inv-filter-hint inv-filter-hint--error" style={{ margin: '8px 0', display: 'inline-block' }}>⚠ Failed to load items: {error}</div>}

      <KpiCards items={items} />

      {/* Action bar */}
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by item name or code…"
              value={search} onChange={e => { onSearchChange(e.target.value); onPageChange(0); }} />
            {search && <button className="inv-search-clear" onClick={() => { onSearchChange(''); onPageChange(0); }}>✕</button>}
          </div>
          <FilterSelect value={category} onChange={v => { onCategoryChange(v); onPageChange(0); }}
            options={Object.keys(CATEGORY_COLORS).map(c => ({ value: c, label: c }))} placeholder="All Categories" />
          <FilterSelect value={statusFilter} onChange={v => setStatus(v)}
            options={Object.entries(STOCK_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} placeholder="All Status" />
          {(search || category || statusFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm"
              onClick={() => { onSearchChange(''); onCategoryChange(''); setStatus(''); onPageChange(0); }}>✕ Clear</button>
          )}
        </div>
        <div className="inv-action-right">
          <ColumnVisibilityDropdown columns={ITEMS_ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
          {canCreate && <button className="inv-btn inv-btn--secondary inv-btn--icon" onClick={onTransaction}>⇄ Transaction</button>}
          {canCreate && <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onAddItem}>+ Add Item</button>}
        </div>
      </div>

      {/* Table */}
      <div className="inv-table-container" style={{ marginBottom: 0 }}>
        <table className="inv-table">
          <thead>
            <tr>
              {orderedVisibleColumns.map((col, i) => (
                <DraggableHeaderCell key={col.key} col={col} index={i}
                  sortColumn={sortColumn} sortDirection={sortDirection}
                  getSortIcon={getSortIcon} handleSort={handleSort}
                  onDragStart={handleColDragStart} onDragOver={handleColDragOver}
                  onDrop={handleColDrop} onDragEnd={handleColDragEnd}
                  isDragOver={dragOverIndex === i} />
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="inv-empty-cell"><div className="inv-empty"><span className="inv-empty-icon" style={{ fontSize: 20 }}>⏳</span><p>Loading items…</p></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={colCount} className="inv-empty-cell"><div className="inv-empty"><span className="inv-empty-icon">📋</span>
                <p>{search || category || statusFilter ? 'No items match your filters.' : 'No items yet. Click \"+ Add Item\" to begin.'}</p>
              </div></td></tr>
            ) : filtered.map((item, i) => {
              const cm = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
              const sm = STOCK_STATUS[item.status]      || STOCK_STATUS.IN_STOCK;
              return (
                <tr key={item.id} className="inv-table-row" onClick={() => onViewItem && onViewItem(item)}>
                  {orderedVisibleColumns.map(col => {
                    if (col.key === 'idx')         return <td key="idx"         data-col="idx"         style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{page * pageSize + i + 1}</td>;
                    if (col.key === 'itemCode')     return <td key="itemCode"    data-col="itemCode"    className="inv-code-cell">{item.itemCode}</td>;
                    if (col.key === 'name')         return <td key="name"        data-col="name"        className="inv-name-cell">{item.name}</td>;
                    if (col.key === 'category')     return <td key="category"    data-col="category"   ><span className="inv-cat-badge" style={{ background: cm.bg, color: cm.color, borderColor: cm.border }}>{item.category}</span></td>;
                    if (col.key === 'currentQty')   return <td key="currentQty"  data-col="currentQty"  style={{ fontWeight: 600, color: item.status === 'OUT_OF_STOCK' ? '#ef4444' : item.status === 'LOW_STOCK' ? '#f59e0b' : '#0f172a' }}>{fmt(item.currentQty)}</td>;
                    if (col.key === 'unit')         return <td key="unit"        data-col="unit"        className="inv-muted">{item.unit}</td>;
                    if (col.key === 'unitCost')     return <td key="unitCost"    data-col="unitCost"   >{fmtCcy(item.unitCost)}</td>;
                    if (col.key === 'totalValue')   return <td key="totalValue"  data-col="totalValue"  style={{ fontWeight: 600 }}>{fmtCcy(item.totalValue ?? item.currentQty * item.unitCost)}</td>;
                    if (col.key === 'location')     return <td key="location"    data-col="location"    className="inv-muted">{item.location}</td>;
                    if (col.key === 'status')       return <td key="status"      data-col="status"     ><span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span></td>;
                    if (col.key === 'lastUpdated')  return <td key="lastUpdated" data-col="lastUpdated" className="inv-muted">{item.lastUpdated ? String(item.lastUpdated).slice(0, 10) : '—'}</td>;
                    if (col.key === 'actions')      return (
                      <td key="actions" data-col="actions" onClick={e => e.stopPropagation()}>
                        <div className="inv-row-actions">
                          <button className="inv-icon-action inv-icon-action--view" title="View Details" onClick={() => onViewItem && onViewItem(item)}><Eye size={15}/></button>
                          {canEdit && <button className="inv-icon-action inv-icon-action--edit" title="Edit" onClick={() => onEditItem && onEditItem(item)}><Edit2 size={14}/></button>}
                          {canEdit && <button className="inv-icon-action inv-icon-action--delete" title="Delete" onClick={() => onDeleteItem && onDeleteItem(item)}><Trash2 size={14}/></button>}
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

      {/* Bottom pagination */}
      <PaginationBar page={page} pageSize={pageSize} total={total} totalPages={totalPages}
        onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} label="items" />
    </>
  );
}