// src/components/borrowers/GroupDetail.js
//
// Level 2 of the registry drill-down: everything sitting directly under one
// Parent Group or Sub Group — its companies and (for a Parent Group) its own
// Sub Groups, one click deeper than the flat Level-1 list on BorrowerRegistry.js.
// A Sub Group is just another row in `company_groups`, so this same route and
// component serve either kind of group.
//
// Three independently paginated pieces make up this page, each backed by its
// own database-driven fetch rather than one whole-tree load:
//   - This group's own summary (breadcrumb + stat-card figures) — GET /borrower/groups/{id}
//   - Direct Companies, 5 per page — GET /borrower/groups/{id}/companies
//   - The Sub Groups list, 5 per page — GET /borrower/groups/{id}/subgroups
// Expanding a Sub Group panel lazily fetches its own companies (same
// /companies endpoint, called with that Sub Group's id) 5 at a time too, and
// keeps its own page state independent of every other panel.
//
// Every action here (View, Delete, Change organization) calls the exact same
// borrowerApi methods and reuses the exact same confirm-dialog/org-picker
// pattern already built for the Level-1 hierarchy table in BorrowerRegistry.js
// — nothing new in how a delete or a re-org actually happens, only in how the
// rows behind them are fetched.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Users, Building2, Eye, Trash2, AlertTriangle, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import HierarchyPicker, {
  EMPTY_HIERARCHY, hierarchyFromBorrower, resolveHierarchyGroupId,
} from './HierarchyPicker';
import Pagination from './Pagination';
import '../../pages-css/BorrowerRegistry.css';
import '../../pages-css/BorrowerRegistryPremium.css';

const DIRECT_PAGE_SIZE = 5;
const SUBGROUPS_PAGE_SIZE = 5;
const SUBGROUP_COMPANIES_PAGE_SIZE = 5;

const TYPE_BADGE_CLASS = {
  'Parent Group': 'brx-badge-purple',
  'Sub Group': 'brx-badge-blue',
  Standalone: 'brx-badge-green',
  Subsidiary: 'brx-badge-blue',
  SPV: 'brx-badge-orange',
  'Subsidiary + SPV': 'brx-badge-orange',
};

const TypeBadge = ({ label }) => (
  <span className={`brx-type-badge ${TYPE_BADGE_CLASS[label] || 'brx-badge-slate'}`}>{label}</span>
);

/** One company row — used for both the Direct Companies table and each Sub Group's own table. */
const CompanyRow = ({ c, navigate, onDelete }) => (
  <tr className="brx-tree-tr">
    <td>
      <span className="brx-tree-name-cell">
        <Building2 size={15} aria-hidden="true" />
        <button
          type="button" className="brx-ref-link" title={c.borrowerName}
          onClick={() => navigate(`/lender/borrowers/${c.id}`)}
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
      <span className={`brx-status-pill ${c.sanctionsCount > 0 ? 'brx-status-active' : 'brx-status-muted'}`}>
        {c.status}
      </span>
    </td>
    <td className="brx-right">
      <div className="brx-row-actions">
        <button
          type="button" className="brx-icon-btn"
          title={`View ${c.borrowerName}`} aria-label={`View ${c.borrowerName}`}
          onClick={() => navigate(`/lender/borrowers/${c.id}`)}
        >
          <Eye size={15} aria-hidden="true" />
        </button>
        <button
          type="button" className="brx-icon-btn brx-icon-danger"
          title={`Delete ${c.borrowerName}`} aria-label={`Delete ${c.borrowerName}`}
          onClick={onDelete}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </td>
  </tr>
);

/**
 * The shared 7-column table shell — Direct Companies, and each Sub Group's
 * own inline table — with its pagination footer inside the same card
 * (rather than floating below it), so every companies table on this page
 * looks the same regardless of which one it is.
 */
const CompaniesTable = ({
  companies, loading, emptyMessage, navigate, onDeleteCompany,
  page, pageCount, pageSize, totalRows, onPageChange,
}) => (
  <div className="brx-tree-card">
    <div className="brx-tree-scroll brx-tree-scroll-5">
      <table className="brx-tree-table">
        <thead>
          <tr>
            <th>Entity Name</th>
            <th>Type</th>
            <th>CIN</th>
            <th className="brx-num">Sanction Letters</th>
            <th className="brx-num">Total Sanctioned Amount</th>
            <th>Status</th>
            <th className="brx-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="brx-muted brx-pad">Loading…</td></tr>
          ) : companies.length === 0 ? (
            <tr><td colSpan={7} className="brx-muted brx-pad">{emptyMessage}</td></tr>
          ) : (
            companies.map((c) => (
              <CompanyRow key={c.id} c={c} navigate={navigate} onDelete={() => onDeleteCompany(c)} />
            ))
          )}
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
        showSizeSelector={false}
      />
    )}
  </div>
);

const Stat = ({ icon: Icon, label, value, tone = 'blue' }) => (
  <div className={`brx-stat brx-stat-${tone}`}>
    <span className="brx-stat-icon"><Icon size={19} aria-hidden="true" /></span>
    <span className="brx-stat-body">
      <span className="brx-stat-value">{value}</span>
      <span className="brx-stat-label">{label}</span>
    </span>
  </div>
);

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  // ?openSubGroup=<id> — how a company inside a Sub Group sends the user back
  // here with that Sub Group open, from its own Entity Detail breadcrumb/Back
  // (see resolveBackTarget in BorrowerDetail.js) or from a Sub Group's own
  // breadcrumb segment there. Fetched and pinned directly by id, expanded and
  // scrolled into view, independent of whichever page of the (now paginated)
  // Sub Groups list it would otherwise fall on.
  const [searchParams] = useSearchParams();
  const openSubGroupId = searchParams.get('openSubGroup');

  const [group, setGroup] = useState(null); // this group's own summary
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [directCompanies, setDirectCompanies] = useState([]);
  const [directPage, setDirectPage] = useState(1);
  const [directTotalElements, setDirectTotalElements] = useState(0);
  const [directTotalPages, setDirectTotalPages] = useState(1);
  const [directLoading, setDirectLoading] = useState(true);

  const [subGroups, setSubGroups] = useState([]);
  const [subGroupsPage, setSubGroupsPage] = useState(1);
  const [subGroupsTotalElements, setSubGroupsTotalElements] = useState(0);
  const [subGroupsTotalPages, setSubGroupsTotalPages] = useState(1);
  const [subGroupsLoading, setSubGroupsLoading] = useState(true);

  // Each open Sub Group's own companies, keyed by Sub Group id — independent
  // page state per panel, so paging one never touches another's.
  const [subCompanies, setSubCompanies] = useState({});
  const [pinnedSubGroup, setPinnedSubGroup] = useState(null);

  // A Sub Group's companies show inline on this same page (see the header
  // note above) — presence in this set means collapsed, so a Sub Group not
  // yet toggled reads as open by default (which already covers ?openSubGroup
  // on first mount; the effect below only matters when this same page is
  // still mounted and the target was manually collapsed).
  const [collapsedSubs, setCollapsedSubs] = useState(() => new Set());
  const subGroupRefs = useRef({});

  const [deleteTarget, setDeleteTarget] = useState(null);       // company row awaiting confirmation
  const [deleting, setDeleting] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null); // Sub Group row awaiting confirmation
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [movingGroup, setMovingGroup] = useState(false);
  const [movingGroupParentId, setMovingGroupParentId] = useState('');
  const [parentGroupOptions, setParentGroupOptions] = useState([]);

  const [orgTarget, setOrgTarget] = useState(null); // full BorrowerWrapper
  const [orgValue, setOrgValue] = useState(EMPTY_HIERARCHY);
  const [orgLoading, setOrgLoading] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgError, setOrgError] = useState('');

  const loadGroup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGroup(await borrowerApi.getGroupDetail(groupId));
    } catch (e) {
      setError(e.message || 'Could not load the group');
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadGroup(); }, [loadGroup]);

  const loadDirectCompanies = useCallback(async (page) => {
    setDirectLoading(true);
    try {
      const res = await borrowerApi.getGroupCompanies(groupId, page - 1, DIRECT_PAGE_SIZE);
      setDirectCompanies(res.content || []);
      setDirectTotalElements(res.totalElements || 0);
      setDirectTotalPages(res.totalPages || 1);
    } catch (e) {
      setError(e.message || 'Could not load companies');
    } finally {
      setDirectLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadDirectCompanies(directPage); }, [loadDirectCompanies, directPage]);

  // A delete can leave the current page past the new last one — step back
  // rather than showing an empty page with working Previous/page-number
  // controls that look broken.
  useEffect(() => {
    if (directPage > directTotalPages) setDirectPage(directTotalPages);
  }, [directPage, directTotalPages]);

  const loadSubGroupsList = useCallback(async (page) => {
    setSubGroupsLoading(true);
    try {
      const res = await borrowerApi.getSubGroups(groupId, page - 1, SUBGROUPS_PAGE_SIZE);
      setSubGroups(res.content || []);
      setSubGroupsTotalElements(res.totalElements || 0);
      setSubGroupsTotalPages(res.totalPages || 1);
    } catch (e) {
      setError(e.message || 'Could not load Sub Groups');
    } finally {
      setSubGroupsLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadSubGroupsList(subGroupsPage); }, [loadSubGroupsList, subGroupsPage]);

  useEffect(() => {
    if (subGroupsPage > subGroupsTotalPages) setSubGroupsPage(subGroupsTotalPages);
  }, [subGroupsPage, subGroupsTotalPages]);

  const loadSubGroupCompanies = useCallback(async (subId, page) => {
    setSubCompanies((m) => ({
      ...m,
      [subId]: { ...(m[subId] || { items: [], totalElements: 0, totalPages: 1 }), page, loading: true },
    }));
    try {
      const res = await borrowerApi.getGroupCompanies(subId, page - 1, SUBGROUP_COMPANIES_PAGE_SIZE);
      const totalPages = res.totalPages || 1;
      // A delete can leave this page past the new last one — step back and
      // fetch that instead of showing an empty page with live controls.
      if (page > totalPages && totalPages >= 1) {
        return loadSubGroupCompanies(subId, totalPages);
      }
      setSubCompanies((m) => ({
        ...m,
        [subId]: {
          items: res.content || [], page, totalElements: res.totalElements || 0,
          totalPages, loading: false,
        },
      }));
    } catch (e) {
      setError(e.message || 'Could not load companies');
      setSubCompanies((m) => ({ ...m, [subId]: { ...(m[subId] || {}), loading: false } }));
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sub Groups default to open (collapsedSubs starts empty) so their panels
  // render expanded on first load without the user ever calling toggleSub —
  // which means nothing had ever fetched their companies for that case, and
  // an already-open panel sat on "Loading…" forever. This fires whenever the
  // Sub Groups list itself (re)loads and fetches page 1 for whichever of
  // those panels are open and don't have anything loaded yet.
  useEffect(() => {
    subGroups.forEach((sub) => {
      const subId = String(sub.id);
      if (!collapsedSubs.has(subId) && !subCompanies[subId]) {
        loadSubGroupCompanies(subId, 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subGroups]);

  // Toggling a Sub Group open lazily fetches its first page the first time;
  // re-expanding after a collapse reuses whatever page was already loaded
  // instead of re-fetching, so it never flickers empty on the way back open.
  const toggleSub = (subId) => {
    setCollapsedSubs((s) => {
      const next = new Set(s);
      if (next.has(subId)) next.delete(subId); else next.add(subId);
      return next;
    });
    // Read from the closure, not from inside a setState updater — an
    // updater is expected to be a pure function of its own previous state,
    // and React may invoke it more than once (Strict Mode does, in dev).
    if (!subCompanies[subId]) loadSubGroupCompanies(subId, 1);
  };

  useEffect(() => {
    if (!openSubGroupId) { setPinnedSubGroup(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const detail = await borrowerApi.getGroupDetail(openSubGroupId);
        if (cancelled) return;
        setPinnedSubGroup({
          id: detail.id,
          groupName: detail.groupName,
          companiesCount: detail.directCompaniesCount ?? 0,
          sanctionsCount: detail.sanctionsCount ?? 0,
          totalSanctionedAmount: detail.totalSanctionedAmount,
        });
      } catch {
        if (!cancelled) setPinnedSubGroup(null);
      }
    })();
    return () => { cancelled = true; };
  }, [openSubGroupId]);

  useEffect(() => {
    if (!openSubGroupId) return undefined;
    setCollapsedSubs((s) => {
      if (!s.has(openSubGroupId)) return s;
      const next = new Set(s);
      next.delete(openSubGroupId);
      return next;
    });
    if (!subCompanies[openSubGroupId]) loadSubGroupCompanies(openSubGroupId, 1);
    // Scroll after the panel has had a render to open, so its final height
    // is what the browser scrolls to.
    const t = setTimeout(() => {
      subGroupRefs.current[openSubGroupId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSubGroupId, groupId]);

  const backToRegistry = () => navigate('/lender/borrowers');

  /** Re-fetches everything currently on screen — the group summary, both tables' current pages, and every open panel's own current page. */
  const reload = useCallback(async () => {
    await loadGroup();
    await loadDirectCompanies(directPage);
    await loadSubGroupsList(subGroupsPage);
    Object.entries(subCompanies).forEach(([subId, s]) => {
      if (!collapsedSubs.has(subId)) loadSubGroupCompanies(subId, s.page || 1);
    });
  }, [loadGroup, loadDirectCompanies, directPage, loadSubGroupsList, subGroupsPage,
    subCompanies, collapsedSubs, loadSubGroupCompanies]);

  const openChangeOrgFor = async (company) => {
    setDeleteTarget(null);
    setOrgError('');
    setOrgLoading(true);
    setOrgTarget(company);
    try {
      const full = await borrowerApi.getById(company.id);
      setOrgTarget(full);
      setOrgValue(hierarchyFromBorrower(full));
    } catch (e) {
      setOrgTarget(null);
      setError(e.message || 'Could not load this company');
    } finally {
      setOrgLoading(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!orgTarget) return;
    setOrgError('');
    setSavingOrg(true);
    try {
      const newGroupId = await resolveHierarchyGroupId(orgValue);
      await borrowerApi.updateHierarchy(orgTarget.id, {
        groupId: newGroupId, isSubsidiary: orgValue.isSubsidiary, isSpv: orgValue.isSpv,
      });
      setOrgTarget(null);
      await reload();
    } catch (e) {
      setOrgError(e.message || 'Could not update the organization');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await borrowerApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not delete this borrower');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openMoveGroup = async () => {
    setMovingGroupParentId('');
    setMovingGroup(true);
    try {
      setParentGroupOptions(await borrowerApi.getGroups());
    } catch {
      setParentGroupOptions([]);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    // Deleting a Sub Group listed as a child here just means re-fetching
    // this same page's data afterward. Deleting THIS page's own group (via
    // the header's Delete button) means the page itself no longer exists —
    // reload() would just 404 against the group id we were just looking
    // at, so navigate away instead: to the registry for a Parent Group, or
    // back to its own Parent Group's page for a Sub Group viewed directly.
    const deletingSelf = deleteGroupTarget.id === group.id;
    setDeletingGroup(true);
    setError('');
    try {
      await borrowerApi.deleteGroup(deleteGroupTarget.id);
      setDeleteGroupTarget(null);
      setMovingGroup(false);
      if (deletingSelf) {
        if (deleteGroupTarget.parentGroupId) {
          navigate(`/lender/borrowers/group/${deleteGroupTarget.parentGroupId}`);
        } else {
          backToRegistry();
        }
        return;
      }
      // The Sub Group just deleted no longer exists — drop any companies
      // already fetched for it rather than leaving a stale panel behind.
      setSubCompanies((m) => {
        const next = { ...m };
        delete next[deleteGroupTarget.id];
        return next;
      });
      await reload();
    } catch (err) {
      setError(err.message || 'Could not delete this group');
      setDeleteGroupTarget(null);
      setMovingGroup(false);
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleMoveGroup = async () => {
    if (!deleteGroupTarget || !movingGroupParentId) return;
    setDeletingGroup(true);
    setError('');
    try {
      await borrowerApi.updateGroup(deleteGroupTarget.id, {
        groupName: deleteGroupTarget.groupName,
        parentGroupId: Number(movingGroupParentId),
      });
      setDeleteGroupTarget(null);
      setMovingGroup(false);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not move this group');
    } finally {
      setDeletingGroup(false);
    }
  };

  if (loading) {
    return <div className="br-page"><p className="br-muted">Loading…</p></div>;
  }

  if (!group) {
    return (
      <div className="br-page">
        <button type="button" className="br-back" onClick={backToRegistry}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Registry
        </button>
        <div className="br-banner br-banner-danger">{error || 'Group not found'}</div>
      </div>
    );
  }

  const isParent = !group.parentGroupId;
  const hasSubGroups = !!group.hasSubGroups;
  // deleteGroupTarget is either a Sub Group row from the list below, or (via
  // the header's own Delete button) this page's own `group` — both share
  // the same parentGroupId field, so this check works for either shape.
  const deleteGroupTargetIsParent = !!deleteGroupTarget && !deleteGroupTarget.parentGroupId;

  // The pinned ?openSubGroup target (if any) is shown first, always expanded
  // — the paginated list below it drops the same id if it happens to also
  // land on the current Sub Groups page, so it's never shown twice.
  const listSubGroups = pinnedSubGroup
    ? subGroups.filter((s) => String(s.id) !== String(pinnedSubGroup.id))
    : subGroups;
  const subGroupsToRender = pinnedSubGroup ? [pinnedSubGroup, ...listSubGroups] : listSubGroups;

  return (
    <div className="br-page brx-registry">
      <button type="button" className="br-back" onClick={backToRegistry}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Registry
      </button>

      <div className="brx-head">
        <div className="brx-head-text">
          <div className="brx-crumb-path">
            <button type="button" className="brx-crumb-link" onClick={backToRegistry}>Borrower Registry</button>
            {group.parentGroupId && (
              <>
                <span className="brx-crumb-sep">›</span>
                <button
                  type="button" className="brx-crumb-link"
                  onClick={() => navigate(`/lender/borrowers/group/${group.parentGroupId}`)}
                >
                  {group.parentGroupName}
                </button>
              </>
            )}
            <span className="brx-crumb-sep">›</span>
            <span className="brx-crumb-current">{group.groupName}</span>
          </div>
          <h1 className="brx-title">
            {group.groupName}
            <span style={{ marginLeft: 10, verticalAlign: 'middle', display: 'inline-block' }}>
              <TypeBadge label={isParent ? 'Parent Group' : 'Sub Group'} />
            </span>
          </h1>
        </div>
        <div className="brx-head-actions">
          <button
            type="button"
            className="brx-btn brx-btn-danger"
            onClick={() => setDeleteGroupTarget({ ...group, companiesCount: group.totalCompaniesCount })}
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete {isParent ? 'Parent Group' : 'Sub Group'}
          </button>
        </div>
      </div>

      {error && <div className="br-banner br-banner-danger">{error}</div>}

      <div className="brx-stats">
        {hasSubGroups && <Stat icon={Building2} tone="teal" label="Direct Companies" value={group.directCompaniesCount ?? 0} />}
        <Stat
          icon={Building2} tone="teal"
          label={hasSubGroups ? 'Total Companies' : 'Companies'}
          value={group.totalCompaniesCount ?? 0}
        />
        {hasSubGroups && <Stat icon={Users} tone="purple" label="Sub Groups" value={group.subGroupsCount ?? 0} />}
        <Stat icon={Building2} tone="orange" label="Total SPVs" value={group.totalSpvCount ?? 0} />
        <Stat icon={Users} tone="green" label="Total Sanctioned Amount" value={group.totalSanctionedAmount || '₹0.00 Cr'} />
      </div>

      {hasSubGroups && <h2 className="brx-section-heading">Direct Companies</h2>}
      <CompaniesTable
        companies={directCompanies}
        loading={directLoading}
        emptyMessage="No companies directly under this group."
        navigate={navigate}
        onDeleteCompany={setDeleteTarget}
        page={directPage}
        pageCount={directTotalPages}
        pageSize={DIRECT_PAGE_SIZE}
        totalRows={directTotalElements}
        onPageChange={setDirectPage}
      />

      {hasSubGroups && (
        <>
          <h2 className="brx-section-heading">Sub Groups</h2>
          {subGroupsToRender.map((sub) => {
            const subId = String(sub.id);
            const isOpen = !collapsedSubs.has(subId);
            const subState = subCompanies[subId] || { items: [], loading: true, page: 1, totalPages: 1, totalElements: 0 };
            return (
              <div
                className="brx-tree-card brx-subgroup-panel" key={sub.id}
                ref={(el) => { subGroupRefs.current[subId] = el; }}
              >
                <div
                  className="brx-subgroup-header" role="button" tabIndex={0}
                  onClick={() => toggleSub(subId)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSub(subId); } }}
                >
                  {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                  <Users size={15} aria-hidden="true" />
                  <strong>{sub.groupName}</strong>
                  <TypeBadge label="Sub Group" />
                  <span className="brx-subgroup-meta">
                    {sub.companiesCount ?? 0} compan{(sub.companiesCount ?? 0) === 1 ? 'y' : 'ies'}
                    {' · '}{sub.sanctionsCount ?? 0} sanction{(sub.sanctionsCount ?? 0) === 1 ? '' : 's'}
                    {' · '}{sub.totalSanctionedAmount || '₹0.00 Cr'}
                  </span>
                  <button
                    type="button" className="brx-icon-btn brx-icon-danger brx-subgroup-delete"
                    title={`Delete ${sub.groupName}`} aria-label={`Delete ${sub.groupName}`}
                    onClick={(e) => { e.stopPropagation(); setDeleteGroupTarget(sub); }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                {isOpen && (
                  <CompaniesTable
                    companies={subState.items}
                    loading={!!subState.loading}
                    emptyMessage="No companies in this Sub Group."
                    navigate={navigate}
                    onDeleteCompany={setDeleteTarget}
                    page={subState.page || 1}
                    pageCount={subState.totalPages || 1}
                    pageSize={SUBGROUP_COMPANIES_PAGE_SIZE}
                    totalRows={subState.totalElements}
                    onPageChange={(p) => loadSubGroupCompanies(subId, p)}
                  />
                )}
              </div>
            );
          })}
          {subGroupsLoading && subGroups.length === 0 && (
            <p className="brx-muted brx-pad">Loading…</p>
          )}
          {/* Only shown once there's actually more than one page — with a
              single Sub Group (the common case) this would otherwise sit as
              a stray, always-disabled "page 1 of 1" bar well below the last
              panel, disconnected from any one table it belongs to. */}
          {subGroupsTotalPages > 1 && (
            <Pagination
              page={subGroupsPage}
              pageCount={subGroupsTotalPages}
              pageSize={SUBGROUPS_PAGE_SIZE}
              totalRows={subGroupsTotalElements}
              onPageChange={setSubGroupsPage}
              showSizeSelector={false}
            />
          )}
        </>
      )}

      {deleteTarget && (
        <div className="br-modal-backdrop" onMouseDown={() => setDeleteTarget(null)}>
          <div
            className="br-modal br-modal-confirm"
            onMouseDown={(e) => e.stopPropagation()}
            role="alertdialog" aria-modal="true" aria-label="Confirm delete"
          >
            <div className="br-modal-head">
              <div className="br-viewer-title">
                <AlertTriangle size={18} className="br-tone-warn" aria-hidden="true" />
                <div className="br-viewer-title-text">
                  <h3 className="br-modal-title">Delete this borrower?</h3>
                  <p className="br-modal-sub">{deleteTarget.borrowerName}</p>
                </div>
              </div>
            </div>
            <div className="br-modal-body br-modal-body-single">
              <p className="br-confirm-text">
                {deleteTarget.sanctionsCount > 0
                  ? <>Its {deleteTarget.sanctionsCount} sanction letter{deleteTarget.sanctionsCount === 1 ? '' : 's'}
                      and the stored documents will be removed with it.</>
                  : 'This borrower has no sanction letters recorded.'}
              </p>
              <p className="br-muted br-confirm-note">
                This is permanent — the company, its sanctions and their documents
                are deleted outright, not archived. If you only meant to move it
                elsewhere, use Change organization instead.
              </p>
            </div>
            <div className="br-modal-foot">
              <button type="button" className="br-btn" onClick={() => openChangeOrgFor(deleteTarget)} disabled={deleting}>
                Change organization
              </button>
              <button type="button" className="br-btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="br-btn br-btn-danger" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={15} aria-hidden="true" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteGroupTarget && (
        <div className="br-modal-backdrop" onMouseDown={() => { setDeleteGroupTarget(null); setMovingGroup(false); }}>
          <div
            className="br-modal br-modal-confirm"
            onMouseDown={(e) => e.stopPropagation()}
            role="alertdialog" aria-modal="true" aria-label="Confirm delete"
          >
            <div className="br-modal-head">
              <div className="br-viewer-title">
                <AlertTriangle size={18} className="br-tone-warn" aria-hidden="true" />
                <div className="br-viewer-title-text">
                  <h3 className="br-modal-title">
                    Delete this {deleteGroupTargetIsParent ? 'Parent Group' : 'Sub Group'}?
                  </h3>
                  <p className="br-modal-sub">{deleteGroupTarget.groupName}</p>
                </div>
              </div>
            </div>
            <div className="br-modal-body br-modal-body-single">
              <p className="br-confirm-text">
                {(deleteGroupTarget.companiesCount ?? 0) > 0 || (deleteGroupTarget.subGroupsCount ?? 0) > 0
                  ? <>
                      {(deleteGroupTarget.companiesCount ?? 0) > 0 && (
                        <>The {deleteGroupTarget.companiesCount} compan{deleteGroupTarget.companiesCount === 1 ? 'y' : 'ies'} under it</>
                      )}
                      {(deleteGroupTarget.companiesCount ?? 0) > 0 && (deleteGroupTarget.subGroupsCount ?? 0) > 0 && ' and '}
                      {(deleteGroupTarget.subGroupsCount ?? 0) > 0 && (
                        <>{deleteGroupTarget.subGroupsCount} Sub Group{deleteGroupTarget.subGroupsCount === 1 ? '' : 's'} (with everything under {deleteGroupTarget.subGroupsCount === 1 ? 'it' : 'them'})</>
                      )}
                      {' '}— and every one of their sanction letters and stored documents — will be permanently deleted with it.
                    </>
                  : `This ${deleteGroupTargetIsParent ? 'Parent Group' : 'Sub Group'} has no companies under it.`}
              </p>
              <p className="br-muted br-confirm-note">
                {deleteGroupTargetIsParent
                  ? 'This is permanent and cannot be undone.'
                  : ('This is permanent and cannot be undone. If you only meant to move this '
                    + 'Sub Group under a different Parent Group, use the option below instead.')}
              </p>
              {movingGroup && (
                <label className="br-field" style={{ marginTop: 10 }}>
                  <span className="br-field-label">Move to Parent Group</span>
                  <select
                    className="br-input"
                    value={movingGroupParentId}
                    onChange={(e) => setMovingGroupParentId(e.target.value)}
                  >
                    <option value="">— Select a Parent Group —</option>
                    {parentGroupOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.groupName}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="br-modal-foot">
              {/* A Parent Group has no "different Parent Group" to move under —
                  moving it would mean demoting it into a Sub Group, a bigger,
                  separate decision than "delete," so this option only applies
                  to a Sub Group target. */}
              {!movingGroup && !deleteGroupTargetIsParent && (
                <button type="button" className="br-btn" onClick={openMoveGroup} disabled={deletingGroup}>
                  Change organization
                </button>
              )}
              <button
                type="button" className="br-btn"
                onClick={() => { setDeleteGroupTarget(null); setMovingGroup(false); }}
                disabled={deletingGroup}
              >
                Cancel
              </button>
              {movingGroup ? (
                <button
                  type="button" className="br-btn br-btn-primary"
                  onClick={handleMoveGroup} disabled={deletingGroup || !movingGroupParentId}
                >
                  {deletingGroup ? 'Moving…' : 'Move'}
                </button>
              ) : (
                <button type="button" className="br-btn br-btn-danger" onClick={handleDeleteGroup} disabled={deletingGroup}>
                  <Trash2 size={15} aria-hidden="true" />
                  {deletingGroup ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(orgLoading || orgTarget) && (
        <div className="br-modal-backdrop" onMouseDown={() => { if (!savingOrg) setOrgTarget(null); }}>
          <div
            className="br-modal" onMouseDown={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="Change organization"
          >
            <div className="br-modal-head">
              <div className="br-viewer-title">
                <div className="br-viewer-title-text">
                  <h3 className="br-modal-title">Change organization</h3>
                  {orgTarget && (
                    <p className="br-modal-sub">
                      {orgTarget.borrowerName}
                      {orgTarget.sanctions?.[0] && (
                        <> (<span className="brx-ref-highlight">{orgTarget.sanctions[0].refNo}</span>)</>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button type="button" className="br-icon-btn" onClick={() => setOrgTarget(null)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="br-modal-body br-modal-body-single">
              {orgLoading ? <p className="br-muted">Loading…</p> : <HierarchyPicker value={orgValue} onChange={setOrgValue} />}
            </div>
            {orgError && <div className="br-banner br-banner-danger">{orgError}</div>}
            <div className="br-modal-foot">
              <button type="button" className="br-btn" onClick={() => setOrgTarget(null)} disabled={savingOrg}>
                Cancel
              </button>
              <button type="button" className="br-btn br-btn-primary" onClick={handleSaveOrg} disabled={savingOrg || orgLoading}>
                {savingOrg ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
