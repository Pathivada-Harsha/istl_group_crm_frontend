// src/components/borrowers/HierarchyTree.js
//
// Level 1 of the registry drill-down: a flat list of top-level Parent Groups
// and standalone companies — no nested rows. A Sub Group is never shown here;
// it's reached only by drilling into its Parent Group's own detail page
// (GroupDetail.js), which keeps every entity at exactly one place in the
// navigation instead of also appearing as a sibling at this top level.
//
// `data` is already the current page's rows and already search-filtered —
// both now happen server-side (see BorrowerRegistry.js's loadHierarchy) so
// a search can match rows outside whatever page happens to be loaded. This
// component just renders what it's given, plus the pagination footer for it.

import React from 'react';
import { Building2, Users, Eye, Trash2 } from 'lucide-react';
import Pagination from './Pagination';
import SanctionStatusBadge from './SanctionStatusBadge';

const TYPE_BADGE_CLASS = {
  'Parent Group': 'brx-badge-purple',
  Standalone: 'brx-badge-green',
  Subsidiary: 'brx-badge-blue',
  SPV: 'brx-badge-orange',
  'Subsidiary + SPV': 'brx-badge-orange',
};

const TypeBadge = ({ label }) => (
  <span className={`brx-type-badge ${TYPE_BADGE_CLASS[label] || 'brx-badge-slate'}`}>{label}</span>
);

const HierarchyTree = ({
  data, loading, search, onSelectCompany, onSelectGroup, onViewGroup, onDeleteCompany, onDeleteGroup,
  page, pageCount, pageSize, totalRows, onPageChange, onPageSizeChange, onStatusChanged,
}) => {
  const groups = data?.groups || [];
  const standalone = data?.standalone || [];

  if (loading) {
    return <div className="brx-tree-card"><p className="brx-muted brx-pad">Loading…</p></div>;
  }
  if (groups.length === 0 && standalone.length === 0) {
    return (
      <div className="brx-tree-card">
        <p className="brx-muted brx-pad">
          {search ? `Nothing in the registry matches "${search}"` : 'No borrowers yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="brx-tree-card">
      <div className="brx-tree-scroll brx-tree-scroll-10">
        <table className="brx-tree-table">
          <thead>
            <tr>
              <th>Group / Company / Borrower</th>
              <th>Type</th>
              <th>CIN</th>
              <th className="brx-num">Sanctions</th>
              <th className="brx-num">Total Sanctioned Amount</th>
              <th>Status</th>
              <th className="brx-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={`g${g.id}`} className="brx-tree-tr brx-tree-tr-group">
                <td>
                  <span className="brx-tree-name-cell">
                    <Users size={15} aria-hidden="true" />
                    <button
                      type="button" className="brx-ref-link" title={g.groupName}
                      onClick={() => onSelectGroup(g.id)}
                    >
                      <strong>{g.groupName}</strong>
                    </button>
                  </span>
                </td>
                <td><TypeBadge label="Parent Group" /></td>
                <td className="brx-mono">{g.cin || <span className="brx-dash">—</span>}</td>
                <td className="brx-num">{g.sanctionsCount}</td>
                <td className="brx-num">{g.totalSanctionedAmount || '₹0.00 Cr'}</td>
                <td>
                  <span className={`brx-status-pill ${g.status === 'Active' ? 'brx-status-active' : 'brx-status-muted'}`}>
                    {g.status}
                  </span>
                </td>
                <td className="brx-right">
                  <div className="brx-row-actions">
                    <button
                      type="button" className="brx-icon-btn"
                      title={`View ${g.groupName}`} aria-label={`View ${g.groupName}`}
                      onClick={() => onViewGroup(g.id)}
                    >
                      <Eye size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button" className="brx-icon-btn brx-icon-danger"
                      title={`Delete ${g.groupName}`} aria-label={`Delete ${g.groupName}`}
                      onClick={() => onDeleteGroup(g)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {standalone.map((c) => (
              <tr key={`c${c.id}`} className="brx-tree-tr">
                <td>
                  <span className="brx-tree-name-cell">
                    <Building2 size={15} aria-hidden="true" />
                    <button
                      type="button" className="brx-ref-link" title={c.borrowerName}
                      onClick={() => onSelectCompany(c.id)}
                    >
                      {c.borrowerName}
                    </button>
                  </span>
                </td>
                <td><TypeBadge label={c.companyType} /></td>
                <td className="brx-mono">{c.cin || <span className="brx-dash">—</span>}</td>
                <td className="brx-num">{c.sanctionsCount}</td>
                <td className="brx-num">{c.totalSanctionedAmount || '₹0.00 Cr'}</td>
                <td>
                  <SanctionStatusBadge
                    sanctionId={c.latestSanctionId}
                    refNo={c.latestSanctionRefNo}
                    cin={c.cin}
                    status={c.status}
                    disabled={!c.latestSanctionId}
                    onChanged={onStatusChanged}
                  />
                </td>
                <td className="brx-right">
                  <div className="brx-row-actions">
                    <button
                      type="button" className="brx-icon-btn"
                      title={`View ${c.borrowerName}`} aria-label={`View ${c.borrowerName}`}
                      onClick={() => onSelectCompany(c.id)}
                    >
                      <Eye size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button" className="brx-icon-btn brx-icon-danger"
                      title={`Delete ${c.borrowerName}`} aria-label={`Delete ${c.borrowerName}`}
                      onClick={() => onDeleteCompany(c)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalRows > 0 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalRows={totalRows}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}
    </div>
  );
};

export default HierarchyTree;
