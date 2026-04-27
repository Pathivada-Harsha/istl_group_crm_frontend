import React, { useState, useEffect, useCallback } from 'react';
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import '../pages-css/AddNewDropdownItems.css';
import { useAuth } from '../hooks/useAuth.js';
import {
  FiEdit2, FiTrash2, FiLayers, FiGitBranch,
  FiBriefcase, FiCheckCircle, FiXCircle, FiRefreshCw,
  FiSearch, FiSave, FiX, FiChevronLeft, FiChevronRight,
  FiChevronsLeft, FiChevronsRight,
} from 'react-icons/fi';

const API = process.env.REACT_APP_API_URL;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/* ── shared headers ──────────────────────────────────────────────── */
const hdrs = () => ({ 'Content-Type': 'application/json' });

const DropdownAdminPage = () => {
  const [activeTab, setActiveTab] = useState('groups');
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  /* ── Pagination state ──────────────────────────────────────────── */
  const [currentPage,   setCurrentPage]   = useState(0);   // 0-indexed (Spring)
  const [pageSize,      setPageSize]      = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(0);
  const [search,        setSearch]        = useState('');
  const [searchInput,   setSearchInput]   = useState('');  // debounced

  /* ── Table rows ────────────────────────────────────────────────── */
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);

  /* ── Form dropdown data (always full list) ─────────────────────── */
  const [availableGroups,    setAvailableGroups]    = useState([]);
  const [availableSubGroups, setAvailableSubGroups] = useState([]);
  const [filteredSubs,       setFilteredSubs]       = useState([]);

  /* ── Forms ─────────────────────────────────────────────────────── */
  const [groupForm, setGroupForm] = useState({
    id: null, groupName: '', groupLabel: '', description: '', isActive: true,
  });
  const [subGroupForm, setSubGroupForm] = useState({
    id: null, subGroupName: '', subGroupLabel: '', description: '', isActive: true, groupId: '',
  });
  const [projectForm, setProjectForm] = useState({
    projectUniqueId: '', projectName: '', description: '', location: '',
    startDate: '', endDate: '', status: 'PLANNING', budget: '', isActive: true,
    selectedGroupId: '', subGroupId: '',
  });

  const [editModal,     setEditModal]     = useState(null); // { type, data }
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  /* ── Debounce search 400 ms ────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setCurrentPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ── Reset on tab switch ───────────────────────────────────────── */
  useEffect(() => {
    setCurrentPage(0); setSearch(''); setSearchInput('');
    setRows([]); setTotalElements(0); setTotalPages(0);
    loadDropdownData();
  }, [activeTab]);

  /* ── Load paginated table data ─────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, search });
      let url = '';
      if (activeTab === 'groups')    url = `${API}/admin/dropdowns/groups?${params}`;
      if (activeTab === 'subgroups') url = `${API}/admin/dropdowns/subgroups?${params}`;
      if (activeTab === 'projects')  url = `${API}/admin/dropdowns/projects?${params}`;

      const res  = await fetch(url, { credentials: 'include', headers: hdrs() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setRows(data.content       ?? []);
      setTotalElements(data.totalElements ?? 0);
      setTotalPages(data.totalPages    ?? 0);
    } catch { showError('Failed to load data'); }
    finally  { setLoading(false); }
  }, [activeTab, currentPage, pageSize, search]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Load full lists for form selects ──────────────────────────── */
  const loadDropdownData = async () => {
    try {
      const [gRes, sgRes] = await Promise.all([
        fetch(`${API}/admin/dropdowns/groups`,    { credentials: 'include', headers: hdrs() }),
        fetch(`${API}/admin/dropdowns/subgroups`, { credentials: 'include', headers: hdrs() }),
      ]);
      setAvailableGroups(await gRes.json());
      setAvailableSubGroups(await sgRes.json());
    } catch {}
  };

  useEffect(() => {
    if (projectForm.selectedGroupId)
      setFilteredSubs(availableSubGroups.filter(sg => sg.group?.id === Number(projectForm.selectedGroupId)));
    else setFilteredSubs([]);
  }, [projectForm.selectedGroupId, availableSubGroups]);

  /* ── Reset forms ───────────────────────────────────────────────── */
  const resetForms = () => {
    setGroupForm({ id: null, groupName: '', groupLabel: '', description: '', isActive: true });
    setSubGroupForm({ id: null, subGroupName: '', subGroupLabel: '', description: '', isActive: true, groupId: '' });
    setProjectForm({ projectUniqueId: '', projectName: '', description: '', location: '', startDate: '', endDate: '', status: 'PLANNING', budget: '', isActive: true, selectedGroupId: '', subGroupId: '' });
    setFilteredSubs([]);
  };

  /* ── GROUP handlers ────────────────────────────────────────────── */
  const handleGroupSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch(`${API}/admin/dropdowns/groups`, { credentials: 'include', method: 'POST', headers: hdrs(), body: JSON.stringify(groupForm) });
      if (!res.ok) throw new Error();
      showSuccess('Group created'); resetForms(); loadData(); loadDropdownData();
    } catch { showError('Failed to create group'); } finally { setLoading(false); }
  };
  const handleEditGroupSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = editModal.data;
    try {
      const res = await fetch(`${API}/admin/dropdowns/groups/${data.id}`, { credentials: 'include', method: 'PUT', headers: hdrs(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      showSuccess('Group updated'); setEditModal(null); loadData(); loadDropdownData();
    } catch { showError('Failed to update group'); } finally { setLoading(false); }
  };
  const handleEditGroup   = (g)  => setEditModal({ type: 'group', data: { ...g } });
  const handleDeleteGroup = (id, isActive) => setDeleteConfirm({ type: 'group', url: `${API}/admin/dropdowns/groups/${id}`, label: 'group', isActive });

  /* ── SUBGROUP handlers ─────────────────────────────────────────── */
  const handleSubGroupSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch(`${API}/admin/dropdowns/subgroups?groupId=${subGroupForm.groupId}`, { credentials: 'include', method: 'POST', headers: hdrs(), body: JSON.stringify(subGroupForm) });
      if (!res.ok) throw new Error();
      showSuccess('Sub-Group created'); resetForms(); loadData(); loadDropdownData();
    } catch { showError('Failed to create sub-group'); } finally { setLoading(false); }
  };
  const handleEditSubGroupSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = editModal.data;
    try {
      const res = await fetch(`${API}/admin/dropdowns/subgroups/${data.id}`, { credentials: 'include', method: 'PUT', headers: hdrs(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      showSuccess('Sub-Group updated'); setEditModal(null); loadData(); loadDropdownData();
    } catch { showError('Failed to update sub-group'); } finally { setLoading(false); }
  };
  const handleEditSubGroup   = (sg) => setEditModal({ type: 'subgroup', data: { ...sg, groupId: sg.group?.id || '' } });
  const handleDeleteSubGroup = (id, isActive) => setDeleteConfirm({ type: 'subgroup', url: `${API}/admin/dropdowns/subgroups/${id}`, label: 'sub-group', isActive });

  /* ── PROJECT handlers ──────────────────────────────────────────── */
  const handleProjectSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch(`${API}/admin/dropdowns/projects?subGroupId=${projectForm.subGroupId}&userId=${user.id}`, { credentials: 'include', method: 'POST', headers: hdrs(), body: JSON.stringify(projectForm) });
      if (!res.ok) throw new Error();
      showSuccess('Project created'); resetForms(); loadData();
    } catch { showError('Failed to create project'); } finally { setLoading(false); }
  };
  const handleEditProjectSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = editModal.data;
    try {
      const res = await fetch(`${API}/admin/dropdowns/projects/${data.projectUniqueId}`, { credentials: 'include', method: 'PUT', headers: hdrs(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      showSuccess('Project updated'); setEditModal(null); loadData();
    } catch { showError('Failed to update project'); } finally { setLoading(false); }
  };
  const handleEditProject = (p) => setEditModal({
    type: 'project',
    data: { ...p, selectedGroupId: p.subGroup?.group?.id || '', subGroupId: p.subGroup?.id || '', startDate: p.startDate || '', endDate: p.endDate || '', budget: p.budget || '' }
  });
  const handleDeleteProject = (id, isActive) => setDeleteConfirm({ type: 'project', url: `${API}/admin/dropdowns/projects/${id}`, label: 'project', isActive });

  /* ── Confirm delete ────────────────────────────────────────────── */
  const confirmDelete = async () => {
    const { url, type, label } = deleteConfirm; setDeleteConfirm(null); setLoading(true);
    try {
      const res = await fetch(url, { credentials: 'include', method: 'DELETE', headers: hdrs() });
      if (!res.ok) throw new Error();
      showSuccess(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted`);
      loadData(); if (type !== 'project') loadDropdownData();
    } catch { showError(`Failed to delete ${label}`); } finally { setLoading(false); }
  };

  /* ── Pagination helpers ────────────────────────────────────────── */
  const firstEntry = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const lastEntry  = Math.min((currentPage + 1) * pageSize, totalElements);

  const visiblePages = () => {
    const pages = [];
    for (let i = 0; i < Math.min(5, totalPages); i++) {
      const p = currentPage < 3 ? i : currentPage + i - 2;
      if (p < 0 || p >= totalPages) continue;
      pages.push(p);
    }
    return pages;
  };

  const STATUS_MAP = { PLANNING:'Planning', IN_PROGRESS:'In Progress', COMPLETED:'Completed', ON_HOLD:'On Hold', CANCELLED:'Cancelled' };

  const tabs = [
    { key:'groups',    label:'Groups',     icon:<FiLayers size={14}/> },
    { key:'subgroups', label:'Sub-Groups', icon:<FiGitBranch size={14}/> },
    { key:'projects',  label:'Projects',   icon:<FiBriefcase size={14}/> },
  ];

  return (
    <div className="da-root">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Header ── */}
      <div className="da-header">
        <div>
          <p className="da-breadcrumb">Office Use &rsaquo; Dropdown Management</p>
          <h1 className="da-title">Dropdown Management</h1>
          <p className="da-subtitle">Manage groups, sub-groups and projects used throughout the CRM</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="da-tabs-bar">
        {tabs.map(t => (
          <button key={t.key} className={`da-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => { setActiveTab(t.key); resetForms(); }}>
            {t.icon}{t.label}
            {activeTab === t.key && totalElements > 0 && (
              <span className="da-tab-count">{totalElements}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Two-column body ── */}
      <div className="da-body">

        {/* LEFT – Form card */}
        <div className="da-form-panel">
          <div className="da-form-card">
            <div className="da-form-card-hd">
              <span className="da-form-card-title">
                Add New {activeTab === 'groups' ? 'Group' : activeTab === 'subgroups' ? 'Sub-Group' : 'Project'}
              </span>
            </div>

            {/* GROUP form */}
            {activeTab === 'groups' && (
              <form onSubmit={handleGroupSubmit} className="da-form">
                <div className="da-row2">
                  <div className="da-field">
                    <label>Group Name <span className="da-req">*</span></label>
                    <input value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName:e.target.value})} required placeholder="e.g. Solar"/>
                  </div>
                  <div className="da-field">
                    <label>Group Label <span className="da-req">*</span></label>
                    <input value={groupForm.groupLabel} onChange={e => setGroupForm({...groupForm, groupLabel:e.target.value})} required placeholder="e.g. Solar Division"/>
                  </div>
                </div>
                <div className="da-field">
                  <label>Description</label>
                  <textarea value={groupForm.description} onChange={e => setGroupForm({...groupForm, description:e.target.value})} rows={3} placeholder="Optional description"/>
                </div>
                <label className="da-check">
                  <input type="checkbox" checked={groupForm.isActive} onChange={e => setGroupForm({...groupForm, isActive:e.target.checked})}/> Active
                </label>
                <div className="da-form-actions">
                  <button type="submit" className="da-btn da-btn-primary" disabled={loading}>
                    <FiSave size={13}/>{loading ? 'Saving…' : 'Create Group'}
                  </button>
                </div>
              </form>
            )}

            {/* SUBGROUP form */}
            {activeTab === 'subgroups' && (
              <form onSubmit={handleSubGroupSubmit} className="da-form">
                <div className="da-field">
                  <label>Parent Group <span className="da-req">*</span></label>
                  <select value={subGroupForm.groupId} onChange={e => setSubGroupForm({...subGroupForm, groupId:e.target.value})} required>
                    <option value="">Select Group</option>
                    {availableGroups.map(g => <option key={g.id} value={g.id}>{g.groupLabel}</option>)}
                  </select>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Sub-Group Name <span className="da-req">*</span></label>
                    <input value={subGroupForm.subGroupName} onChange={e => setSubGroupForm({...subGroupForm, subGroupName:e.target.value})} required placeholder="e.g. Rooftop Solar"/>
                  </div>
                  <div className="da-field">
                    <label>Sub-Group Label <span className="da-req">*</span></label>
                    <input value={subGroupForm.subGroupLabel} onChange={e => setSubGroupForm({...subGroupForm, subGroupLabel:e.target.value})} required placeholder="e.g. Rooftop Solar"/>
                  </div>
                </div>
                <div className="da-field">
                  <label>Description</label>
                  <textarea value={subGroupForm.description} onChange={e => setSubGroupForm({...subGroupForm, description:e.target.value})} rows={3} placeholder="Optional description"/>
                </div>
                <label className="da-check">
                  <input type="checkbox" checked={subGroupForm.isActive} onChange={e => setSubGroupForm({...subGroupForm, isActive:e.target.checked})}/> Active
                </label>
                <div className="da-form-actions">
                  <button type="submit" className="da-btn da-btn-primary" disabled={loading}>
                    <FiSave size={13}/>{loading ? 'Saving…' : 'Create Sub-Group'}
                  </button>
                </div>
              </form>
            )}

            {/* PROJECT form */}
            {activeTab === 'projects' && (
              <form onSubmit={handleProjectSubmit} className="da-form">
                <div className="da-row2">
                  <div className="da-field">
                    <label>Group <span className="da-req">*</span></label>
                    <select value={projectForm.selectedGroupId} onChange={e => setProjectForm({...projectForm, selectedGroupId:e.target.value, subGroupId:''})} required>
                      <option value="">Select Group</option>
                      {availableGroups.map(g => <option key={g.id} value={g.id}>{g.groupLabel}</option>)}
                    </select>
                  </div>
                  <div className="da-field">
                    <label>Sub-Group <span className="da-req">*</span></label>
                    <select value={projectForm.subGroupId} onChange={e => setProjectForm({...projectForm, subGroupId:e.target.value})} required disabled={!projectForm.selectedGroupId}>
                      <option value="">{!projectForm.selectedGroupId ? 'Select Group First' : 'Select Sub-Group'}</option>
                      {filteredSubs.map(sg => <option key={sg.id} value={sg.id}>{sg.subGroupLabel}</option>)}
                    </select>
                  </div>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Project Name <span className="da-req">*</span></label>
                    <input value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName:e.target.value})} required placeholder="e.g. CCMS Nandyal"/>
                  </div>
                  <div className="da-field">
                    <label>Location</label>
                    <input value={projectForm.location} onChange={e => setProjectForm({...projectForm, location:e.target.value})} placeholder="e.g. Nandyal, AP"/>
                  </div>
                </div>
                <div className="da-field">
                  <label>Description</label>
                  <textarea value={projectForm.description} onChange={e => setProjectForm({...projectForm, description:e.target.value})} rows={2} placeholder="Optional description"/>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Start Date</label>
                    <input type="date" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate:e.target.value})}/>
                  </div>
                  <div className="da-field">
                    <label>End Date</label>
                    <input type="date" value={projectForm.endDate} onChange={e => setProjectForm({...projectForm, endDate:e.target.value})}/>
                  </div>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Status</label>
                    <select value={projectForm.status} onChange={e => setProjectForm({...projectForm, status:e.target.value})}>
                      {Object.entries(STATUS_MAP).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="da-field">
                    <label>Budget (₹)</label>
                    <input type="number" value={projectForm.budget} onChange={e => setProjectForm({...projectForm, budget:e.target.value})} placeholder="e.g. 5000000" step="0.01"/>
                  </div>
                </div>
                <label className="da-check">
                  <input type="checkbox" checked={projectForm.isActive} onChange={e => setProjectForm({...projectForm, isActive:e.target.checked})}/> Active
                </label>
                <div className="da-form-actions">
                  <button type="submit" className="da-btn da-btn-primary" disabled={loading}>
                    <FiSave size={13}/>{loading ? 'Saving…' : 'Create Project'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT – Table card */}
        <div className="da-table-panel">
          <div className="da-table-card">

            {/* Toolbar */}
            <div className="da-toolbar">
              <div className="da-search-wrap">
                <FiSearch size={13} className="da-search-icon"/>
                <input className="da-search" value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={`Search ${activeTab}…`}/>
                {searchInput && (
                  <button className="da-search-clear" onClick={() => { setSearchInput(''); setSearch(''); setCurrentPage(0); }}>
                    <FiX size={12}/>
                  </button>
                )}
              </div>
              <button className="da-btn da-btn-icon" title="Refresh" onClick={loadData}>
                <FiRefreshCw size={13} className={loading ? 'da-spin' : ''}/>
              </button>
            </div>

            {/* Fixed-height scrollable table */}
            <div className="da-tbl-scroll">

              {activeTab === 'groups' && (
                <table className="da-tbl">
                  <thead><tr>
                    <th>ID</th><th>Name</th><th>Label</th><th>Description</th><th>Status</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={6} className="da-empty">Loading…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={6} className="da-empty">No groups found</td></tr>
                    : rows.map(g => (
                      <tr key={g.id}>
                        <td className="da-mono">{g.id}</td>
                        <td className="da-bold">{g.groupName}</td>
                        <td>{g.groupLabel}</td>
                        <td className="da-muted">{g.description || '—'}</td>
                        <td>{g.isActive
                          ? <span className="da-badge da-green"><FiCheckCircle size={10}/>Active</span>
                          : <span className="da-badge da-red"><FiXCircle size={10}/>Inactive</span>}
                        </td>
                        <td><div className="da-acts">
                          <button className="da-act da-act-edit" title="Edit" onClick={() => handleEditGroup(g)}><FiEdit2 size={13}/></button>
                          <button className="da-act da-act-del" title="Delete" onClick={() => handleDeleteGroup(g.id, g.isActive)}><FiTrash2 size={13}/></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'subgroups' && (
                <table className="da-tbl">
                  <thead><tr>
                    <th>ID</th><th>Group</th><th>Name</th><th>Label</th><th>Description</th><th>Status</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7} className="da-empty">Loading…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={7} className="da-empty">No sub-groups found</td></tr>
                    : rows.map(sg => (
                      <tr key={sg.id}>
                        <td className="da-mono">{sg.id}</td>
                        <td><span className="da-chip">{sg.group?.groupName || '—'}</span></td>
                        <td className="da-bold">{sg.subGroupName}</td>
                        <td>{sg.subGroupLabel}</td>
                        <td className="da-muted">{sg.description || '—'}</td>
                        <td>{sg.isActive
                          ? <span className="da-badge da-green"><FiCheckCircle size={10}/>Active</span>
                          : <span className="da-badge da-red"><FiXCircle size={10}/>Inactive</span>}
                        </td>
                        <td><div className="da-acts">
                          <button className="da-act da-act-edit" title="Edit" onClick={() => handleEditSubGroup(sg)}><FiEdit2 size={13}/></button>
                          <button className="da-act da-act-del" title="Delete" onClick={() => handleDeleteSubGroup(sg.id, sg.isActive)}><FiTrash2 size={13}/></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'projects' && (
                <table className="da-tbl">
                  <thead><tr>
                    <th>Project ID</th><th>Name</th><th>Group</th><th>Sub-Group</th>
                    <th>Location</th><th>Status</th><th>Budget</th><th>Active</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={9} className="da-empty">Loading…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={9} className="da-empty">No projects found</td></tr>
                    : rows.map(p => (
                      <tr key={p.id}>
                        <td className="da-mono">{p.projectUniqueId}</td>
                        <td className="da-bold">{p.projectName}</td>
                        <td><span className="da-chip">{p.subGroup?.group?.groupName || '—'}</span></td>
                        <td><span className="da-chip da-chip-blue">{p.subGroup?.subGroupName || '—'}</span></td>
                        <td className="da-muted">{p.location || '—'}</td>
                        <td><span className={`da-badge da-status-${(p.status||'').toLowerCase()}`}>{STATUS_MAP[p.status] || p.status}</span></td>
                        <td className="da-amount">{p.budget ? `₹${Number(p.budget).toLocaleString('en-IN')}` : '—'}</td>
                        <td>{p.isActive
                          ? <span className="da-badge da-green"><FiCheckCircle size={10}/>Yes</span>
                          : <span className="da-badge da-red"><FiXCircle size={10}/>No</span>}
                        </td>
                        <td><div className="da-acts">
                          <button className="da-act da-act-edit" title="Edit" onClick={() => handleEditProject(p)}><FiEdit2 size={13}/></button>
                          <button className="da-act da-act-del" title="Delete" onClick={() => handleDeleteProject(p.projectUniqueId, p.isActive)}><FiTrash2 size={13}/></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination footer ── */}
            <div className="da-tbl-footer">
              <div className="da-pagination-info">
                Showing <strong>{firstEntry}</strong> to <strong>{lastEntry}</strong> of <strong>{totalElements}</strong> entries
                <select className="da-page-size-select" value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(0); }}>
                  {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} Rows</option>)}
                </select>
              </div>

              <div className="da-pagination">
                <button className="da-page-btn" onClick={() => setCurrentPage(0)} disabled={currentPage === 0} title="First">
                  <FiChevronsLeft size={13}/>
                </button>
                <button className="da-page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} title="Previous">
                  <FiChevronLeft size={13}/>
                </button>
                {visiblePages().map(p => (
                  <button key={p} className={`da-page-btn${p === currentPage ? ' active' : ''}`}
                    onClick={() => setCurrentPage(p)}>{p + 1}</button>
                ))}
                <button className="da-page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1} title="Next">
                  <FiChevronRight size={13}/>
                </button>
                <button className="da-page-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1} title="Last">
                  <FiChevronsRight size={13}/>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editModal && (
        <div className="da-overlay">
          <div className="da-modal da-modal-edit">

            {/* Modal header */}
            <div className="da-modal-edit-hd">
              <span className="da-modal-edit-title">
                Edit {editModal.type === 'group' ? 'Group' : editModal.type === 'subgroup' ? 'Sub-Group' : 'Project'}
              </span>
              <button className="da-icon-btn" onClick={() => setEditModal(null)} title="Close"><FiX size={14}/></button>
            </div>

            {/* ── Edit Group form ── */}
            {editModal.type === 'group' && (
              <form onSubmit={handleEditGroupSubmit} className="da-form da-modal-form">
                <div className="da-row2">
                  <div className="da-field">
                    <label>Group Name <span className="da-req">*</span></label>
                    <input value={editModal.data.groupName} onChange={e => setEditModal(m => ({...m, data:{...m.data, groupName:e.target.value}}))} required/>
                  </div>
                  <div className="da-field">
                    <label>Group Label <span className="da-req">*</span></label>
                    <input value={editModal.data.groupLabel} onChange={e => setEditModal(m => ({...m, data:{...m.data, groupLabel:e.target.value}}))} required/>
                  </div>
                </div>
                <div className="da-field">
                  <label>Description</label>
                  <textarea value={editModal.data.description || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, description:e.target.value}}))} rows={3}/>
                </div>
                <label className="da-check">
                  <input type="checkbox" checked={editModal.data.isActive} onChange={e => setEditModal(m => ({...m, data:{...m.data, isActive:e.target.checked}}))}/>  Active
                </label>
                <div className="da-modal-edit-footer">
                  <button type="button" className="da-btn da-btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                  <button type="submit" className="da-btn da-btn-primary" disabled={loading}>
                    <FiSave size={13}/>{loading ? 'Saving…' : 'Update Group'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Edit Sub-Group form ── */}
            {editModal.type === 'subgroup' && (
              <form onSubmit={handleEditSubGroupSubmit} className="da-form da-modal-form">
                <div className="da-field">
                  <label>Parent Group <span className="da-req">*</span></label>
                  <select value={editModal.data.groupId} onChange={e => setEditModal(m => ({...m, data:{...m.data, groupId:e.target.value}}))} required>
                    <option value="">Select Group</option>
                    {availableGroups.map(g => <option key={g.id} value={g.id}>{g.groupLabel}</option>)}
                  </select>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Sub-Group Name <span className="da-req">*</span></label>
                    <input value={editModal.data.subGroupName} onChange={e => setEditModal(m => ({...m, data:{...m.data, subGroupName:e.target.value}}))} required/>
                  </div>
                  <div className="da-field">
                    <label>Sub-Group Label <span className="da-req">*</span></label>
                    <input value={editModal.data.subGroupLabel} onChange={e => setEditModal(m => ({...m, data:{...m.data, subGroupLabel:e.target.value}}))} required/>
                  </div>
                </div>
                <div className="da-field">
                  <label>Description</label>
                  <textarea value={editModal.data.description || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, description:e.target.value}}))} rows={3}/>
                </div>
                <label className="da-check">
                  <input type="checkbox" checked={editModal.data.isActive} onChange={e => setEditModal(m => ({...m, data:{...m.data, isActive:e.target.checked}}))}/>  Active
                </label>
                <div className="da-modal-edit-footer">
                  <button type="button" className="da-btn da-btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                  <button type="submit" className="da-btn da-btn-primary" disabled={loading}>
                    <FiSave size={13}/>{loading ? 'Saving…' : 'Update Sub-Group'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Edit Project form ── */}
            {editModal.type === 'project' && (
              <form onSubmit={handleEditProjectSubmit} className="da-form da-modal-form">
                <div className="da-row2">
                  <div className="da-field">
                    <label>Project ID</label>
                    <input value={editModal.data.projectUniqueId} disabled className="da-disabled"/>
                  </div>
                  <div className="da-field">
                    <label>Project Name <span className="da-req">*</span></label>
                    <input value={editModal.data.projectName} onChange={e => setEditModal(m => ({...m, data:{...m.data, projectName:e.target.value}}))} required/>
                  </div>
                </div>
                <div className="da-field">
                  <label>Location</label>
                  <input value={editModal.data.location || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, location:e.target.value}}))}/>
                </div>
                <div className="da-field">
                  <label>Description</label>
                  <textarea value={editModal.data.description || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, description:e.target.value}}))} rows={2}/>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Start Date</label>
                    <input type="date" value={editModal.data.startDate || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, startDate:e.target.value}}))}/>
                  </div>
                  <div className="da-field">
                    <label>End Date</label>
                    <input type="date" value={editModal.data.endDate || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, endDate:e.target.value}}))}/>
                  </div>
                </div>
                <div className="da-row2">
                  <div className="da-field">
                    <label>Status</label>
                    <select value={editModal.data.status || 'PLANNING'} onChange={e => setEditModal(m => ({...m, data:{...m.data, status:e.target.value}}))}>
                      {Object.entries(STATUS_MAP).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="da-field">
                    <label>Budget (₹)</label>
                    <input type="number" value={editModal.data.budget || ''} onChange={e => setEditModal(m => ({...m, data:{...m.data, budget:e.target.value}}))} step="0.01"/>
                  </div>
                </div>
                <label className="da-check">
                  <input type="checkbox" checked={editModal.data.isActive} onChange={e => setEditModal(m => ({...m, data:{...m.data, isActive:e.target.checked}}))}/>  Active
                </label>
                <div className="da-modal-edit-footer">
                  <button type="button" className="da-btn da-btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                  <button type="submit" className="da-btn da-btn-primary" disabled={loading}>
                    <FiSave size={13}/>{loading ? 'Saving…' : 'Update Project'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteConfirm && (
        <div className="da-overlay">
          <div className="da-modal">
            <div className="da-modal-icon" style={{ background: deleteConfirm.isActive ? '#fffbeb' : '#fef2f2', borderColor: deleteConfirm.isActive ? '#fcd34d' : '#fecaca' }}>
              <FiTrash2 size={26} color={deleteConfirm.isActive ? '#d97706' : '#dc2626'}/>
            </div>
            <h3 className="da-modal-title">
              {deleteConfirm.isActive ? 'Deactivate' : 'Permanently Delete'} {deleteConfirm.label.charAt(0).toUpperCase()+deleteConfirm.label.slice(1)}
            </h3>
            <p className="da-modal-msg">
              {deleteConfirm.isActive ? (
                <>
                  This {deleteConfirm.label} is currently <strong>active</strong>.<br/>
                  It will be marked as <strong style={{color:'#d97706'}}>inactive</strong> and hidden from dropdowns.<br/>
                  <span style={{fontSize:12,color:'#94a3b8'}}>Delete again when inactive to permanently remove it.</span>
                </>
              ) : (
                <>
                  This {deleteConfirm.label} is already <strong style={{color:'#dc2626'}}>inactive</strong>.<br/>
                  It will be <strong style={{color:'#dc2626'}}>permanently deleted</strong> along with all related data.<br/>
                  <strong style={{color:'#dc2626'}}>This action cannot be undone.</strong>
                </>
              )}
            </p>
            <div className="da-modal-actions">
              <button className="da-btn da-btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="da-btn"
                style={{ background: deleteConfirm.isActive ? '#d97706' : '#dc2626', color: '#fff', flex: 1, justifyContent: 'center' }}
                onClick={confirmDelete}>
                {deleteConfirm.isActive ? 'Mark Inactive' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownAdminPage;