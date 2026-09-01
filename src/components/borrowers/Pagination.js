// src/components/borrowers/Pagination.js
//
// Compact "Showing X–Y of Z" footer with First/Prev/numbered-pages/Next/Last
// controls and an optional Rows-per-page dropdown — extracted from
// RepaymentScheduleTab.js's own SchedulePagination (still used there,
// unchanged in behaviour) so the Borrower Registry hierarchy table and
// Group Detail's Direct Companies / Sub Groups tables can reuse the exact
// same control instead of three near-duplicates. `showSizeSelector: false`
// drops the Rows dropdown for the two 5-per-page Group Detail tables, which
// have a fixed page size and nothing to choose.

import React from 'react';
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
} from 'lucide-react';
import FilterSelect from '../Dropdowns/FilterSelect';

// Windows the numbered page buttons down to a handful around the current
// page (plus first/last), the same "1 2 3 … 7" shape as the reference
// pagination design, rather than ever rendering one button per page.
const visiblePages = (current, total) => {
  const keep = new Set([1, total, current, current - 1, current + 1]);
  return [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
};

const Pagination = ({
  page, pageCount, pageSize, totalRows, onPageChange, onPageSizeChange,
  showSizeSelector = true, pageSizeOptions = [10, 25, 50, 100],
}) => {
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);
  const pages = visiblePages(page, pageCount);

  return (
    <div className="br-pagination">
      <div className="br-pagination-info">
        <span>Showing {from}–{to} of {totalRows}</span>
        {showSizeSelector && (
          <div className="br-pagination-size">
            <FilterSelect
              value={String(pageSize)}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} Rows` }))}
              placeholder="Rows"
              searchable={false}
              onChange={(v) => { if (v) onPageSizeChange(Number(v)); }}
            />
          </div>
        )}
      </div>
      <div className="br-pagination-pages">
        <button type="button" className="br-icon-btn" disabled={page <= 1} aria-label="First page" onClick={() => onPageChange(1)}>
          <ChevronsLeft size={15} aria-hidden="true" />
        </button>
        <button type="button" className="br-icon-btn" disabled={page <= 1} aria-label="Previous page" onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        {pages.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && p - pages[i - 1] > 1 && <span className="br-pagination-ellipsis">…</span>}
            <button
              type="button"
              className={`br-pagination-page ${p === page ? 'br-pagination-page-active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </React.Fragment>
        ))}
        <button type="button" className="br-icon-btn" disabled={page >= pageCount} aria-label="Next page" onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
        <button type="button" className="br-icon-btn" disabled={page >= pageCount} aria-label="Last page" onClick={() => onPageChange(pageCount)}>
          <ChevronsRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
