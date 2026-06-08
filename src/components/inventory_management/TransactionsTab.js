import React, { useState, useRef } from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import FilterSelect from '../Dropdowns/FilterSelect.js';
import {
  TXN_TYPES, fmt,
  ColumnVisibilityDropdown, DraggableHeaderCell, getSortIcon, PaginationBar,
} from './inventoryConstants.js';

const TXN_ALL_COLUMNS = [
  { key: 'idx',        label: 'S.No',      sortable: false, required: true,  align: 'center' },
  { key: 'date',       label: 'Date',      sortable: true,  required: false, align: 'left'   },
  { key: 'type',       label: 'Type',      sortable: true,  required: false, align: 'center' },
  { key: 'itemCode',   label: 'Item Code', sortable: true,  required: false, align: 'left'   },
  { key: 'itemName',   label: 'Item Name', sortable: true,  required: true,  align: 'left'   },
  { key: 'qty',        label: 'Qty',       sortable: true,  required: false, align: 'center' },
  { key: 'unit',       label: 'Unit',      sortable: false, required: false, align: 'center' },
  { key: 'vendorName', label: 'Vendor',    sortable: true,  required: false, align: 'left'   },
  { key: 'poNo',       label: 'PO No.',    sortable: true,  required: false, align: 'left'   },
  { key: 'ref',        label: 'Reference', sortable: true,  required: false, align: 'left'   },
  { key: 'projectId',  label: 'Project',   sortable: true,  required: false, align: 'left'   },
  { key: 'note',       label: 'Note',      sortable: false, required: false, align: 'left'   },
  { key: 'by',         label: 'By',        sortable: true,  required: false, align: 'left'   },
  { key: 'actions',    label: 'Actions',   sortable: false, required: true,  align: 'center' },
];
const TXN_DEFAULT_ORDER   = TXN_ALL_COLUMNS.map(c => c.key);
const TXN_DEFAULT_VISIBLE = TXN_ALL_COLUMNS.map(c => c.key);

export default function TransactionsTab({ transactions, onTransaction, onDeleteTxn, onViewTxn, onEditTxn, canCreate }) {
  const [search, setSearch]               = useState('');
  const [typeFilter, setType]             = useState('');
  const [projFilter, setProj]             = useState('');

  // Pagination state
  const [page, setPage]                   = useState(0);
  const [pageSize, setPageSize]           = useState(20);

  // Column state
  const [columnOrder, setColumnOrder]     = useState(TXN_DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(TXN_DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn]       = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const dragIndexRef                      = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const projects = [...new Set(transactions.map(t => t.projectId).filter(Boolean))].sort();

  // Filter
  let filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    return (
      (!q || t.itemName.toLowerCase().includes(q) || t.itemCode.toLowerCase().includes(q) || (t.ref || '').toLowerCase().includes(q)) &&
      (!typeFilter || t.type === typeFilter) &&
      (!projFilter || t.projectId === projFilter)
    );
  });

  // Sort
  if (sortColumn) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortColumn] ?? '', bv = b[sortColumn] ?? '';
      return sortDirection === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }

  // Pagination
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated  = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Reset to page 0 when filters change
  const handleSearch   = v  => { setSearch(v);   setPage(0); };
  const handleType     = v  => { setType(v);     setPage(0); };
  const handleProj     = v  => { setProj(v);     setPage(0); };
  const handleClear    = () => { setSearch(''); setType(''); setProj(''); setPage(0); };

  // Column handlers
  const orderedVisibleTxnCols = columnOrder
    .map(k => TXN_ALL_COLUMNS.find(c => c.key === k))
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
    const visKeys = orderedVisibleTxnCols.map(c => c.key);
    const o = [...columnOrder];
    const a = o.indexOf(visKeys[fromIdx]), b = o.indexOf(visKeys[dropIdx]);
    o.splice(a, 1); o.splice(b, 0, visKeys[fromIdx]);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd   = e  => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };
  const handleToggleColumn = k  => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns = () => { setColumnOrder(TXN_DEFAULT_ORDER); setVisibleColumns(TXN_DEFAULT_VISIBLE); };

  const colCount   = orderedVisibleTxnCols.length;
  const firstEntry = total === 0 ? 0 : page * pageSize + 1;
  const lastEntry  = Math.min((page + 1) * pageSize, total);

  return (
    <>
      {/* Action bar */}
      <div className="inv-action-bar">
        <div className="inv-search-filters">
          <div className="inv-search-wrap">
            <span className="inv-search-icon">🔍</span>
            <input className="inv-search" placeholder="Search by item, code or reference…"
              value={search} onChange={e => handleSearch(e.target.value)} />
            {search && <button className="inv-search-clear" onClick={() => handleSearch('')}>✕</button>}
          </div>
          <FilterSelect value={typeFilter} onChange={handleType}
            options={Object.entries(TXN_TYPES).map(([k, v]) => ({ value: k, label: v.label }))}
            placeholder="All Types" />
          <FilterSelect value={projFilter} onChange={handleProj}
            options={projects.map(p => ({ value: p, label: p }))}
            placeholder="All Projects" />
          {(search || typeFilter || projFilter) && (
            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={handleClear}>✕ Clear</button>
          )}
        </div>
        <div className="inv-action-right">
          <ColumnVisibilityDropdown columns={TXN_ALL_COLUMNS} visibleColumns={visibleColumns}
            onToggle={handleToggleColumn} onReset={handleResetColumns} />
          {canCreate && (
            <button className="inv-btn inv-btn--primary inv-btn--icon" onClick={onTransaction}>
              ⇄ Transaction
            </button>
          )}
        </div>
      </div>

      {/* Top pagination info */}
      <div className="inv-result-count">
        {total === 0
          ? 'No transactions'
          : <>Showing <strong>{firstEntry}</strong>–<strong>{lastEntry}</strong> of <strong>{total}</strong> transactions</>}
        {total !== transactions.length && (
          <span style={{ color: '#94a3b8', marginLeft: 6 }}>({transactions.length} total)</span>
        )}
      </div>

      {/* Table */}
      <div className="inv-table-container">
        <table className="inv-table">
          <thead>
            <tr>
              {orderedVisibleTxnCols.map((col, i) => (
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
            {paginated.length === 0 ? (
              <tr><td colSpan={colCount} className="inv-empty-cell">
                <div className="inv-empty"><span className="inv-empty-icon">📋</span><p>No transactions found.</p></div>
              </td></tr>
            ) : paginated.map((t, i) => {
              const tm       = TXN_TYPES[t.type] || TXN_TYPES.INWARD;
              const isVoided = t.note && t.note.startsWith('VOIDED');
              return (
                <tr key={t.id} className="inv-table-row" style={isVoided ? { opacity: 0.5 } : {}}>
                  {orderedVisibleTxnCols.map(col => {
                    if (col.key === 'idx')      return <td key="idx"       data-col="idx"       style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{page * pageSize + i + 1}</td>;
                    if (col.key === 'date')     return <td key="date"      data-col="date"      className="inv-muted">{t.date}</td>;
                    if (col.key === 'type')     return <td key="type"      data-col="type"     ><span className="inv-txn-type" style={{ background: tm.bg, color: tm.color }}>{tm.icon} {tm.label}</span></td>;
                    if (col.key === 'itemCode')   return <td key="itemCode"   data-col="itemCode"   className="inv-code-cell">{t.itemCode}</td>;
                    if (col.key === 'itemName')   return <td key="itemName"   data-col="itemName"   className="inv-name-cell">{t.itemName}</td>;
                    if (col.key === 'qty')        return <td key="qty"        data-col="qty"        style={{ fontWeight: 600, color: ['OUTWARD','TRANSFER'].includes(t.type) ? '#ef4444' : t.qty < 0 ? '#ef4444' : '#166534' }}>{t.qty > 0 && !['OUTWARD','TRANSFER'].includes(t.type) ? '+' : ''}{fmt(t.qty)}</td>;
                    if (col.key === 'unit')       return <td key="unit"       data-col="unit"       className="inv-muted">{t.unit}</td>;
                    if (col.key === 'vendorName') return <td key="vendorName" data-col="vendorName" className="inv-name-cell">
                      {t.vendorName
                        ? <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:11, color:'#64748b' }}>🏭</span>
                            {t.vendorName}
                          </span>
                        : <span className="inv-muted">—</span>}
                    </td>;
                    if (col.key === 'poNo')       return <td key="poNo"       data-col="poNo"       className="inv-code-cell">
                      {t.poNo
                        ? <span style={{ fontFamily:'monospace', fontSize:11.5, color:'#1e40af', background:'#eff6ff', padding:'2px 6px', borderRadius:4 }}>{t.poNo}</span>
                        : <span className="inv-muted">—</span>}
                    </td>;
                    if (col.key === 'ref')        return <td key="ref"        data-col="ref"        className="inv-code-cell">{t.ref || '—'}</td>;
                    if (col.key === 'projectId')  return <td key="projectId"  data-col="projectId"  className="inv-muted">{t.projectId || '—'}</td>;
                    if (col.key === 'note')       return <td key="note"       data-col="note"       className="inv-note-cell" title={t.note}>{t.note}</td>;
                    if (col.key === 'by')         return <td key="by"         data-col="by"         className="inv-muted">{t.by}</td>;
                    if (col.key === 'actions')  return (
                      <td key="actions" data-col="actions" onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button className="inv-icon-action" title="View transaction"
                            onClick={() => onViewTxn && onViewTxn(t)}><Eye size={14}/></button>
                          {canCreate && (
                            <button className="inv-icon-action" title="Edit transaction"
                              onClick={() => onEditTxn && onEditTxn(t)}><Edit2 size={14}/></button>
                          )}
                          {canCreate && (
                            <button className="inv-icon-action inv-icon-action--void" title="Delete transaction"
                              onClick={() => onDeleteTxn && onDeleteTxn(t)}><Trash2 size={14}/></button>
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

      {/* Bottom pagination */}
      <PaginationBar
        page={page} pageSize={pageSize} total={total} totalPages={totalPages}
        onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(0); }}
        label="transactions"
      />
    </>
  );
}