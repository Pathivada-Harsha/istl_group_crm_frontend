import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../pages-css/ProjectAccessPage.css';

const API = process.env.REACT_APP_API_URL;

const STATUS_META = {
  PLANNING:    { color: '#f59e0b', bg: '#fffbeb', label: 'Planning' },
  IN_PROGRESS: { color: '#3b82f6', bg: '#eff6ff', label: 'In Progress' },
  COMPLETED:   { color: '#10b981', bg: '#ecfdf5', label: 'Completed' },
  ON_HOLD:     { color: '#8b5cf6', bg: '#f5f3ff', label: 'On Hold' },
  CANCELLED:   { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled' },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add    = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
}
function ToastStack({ toasts, remove }) {
  if (!toasts.length) return null;
  return (
    <div className="pa-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`pa-toast pa-toast--${t.type}`}>
          <span>{t.type === 'success' ? '✓' : '!'}</span>
          <span>{t.msg}</span>
          <button onClick={() => remove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="pa-overlay" onClick={onCancel}>
      <div className="pa-modal pa-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-warn-icon">⚠</div>
        <h3 className="pa-modal-title">{title}</h3>
        <p className="pa-modal-body">{message}</p>
        <div className="pa-modal-actions">
          <button className="pa-btn pa-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="pa-btn pa-btn--danger" onClick={onConfirm}>Remove Access</button>
        </div>
      </div>
    </div>
  );
}

// ─── Grant Modal ──────────────────────────────────────────────────────────────
function GrantModal({ open, project, users, existingUserIds, onGrant, onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [note,        setNote]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const [userSearch,  setUserSearch]  = useState('');

  useEffect(() => {
    if (open) { setSelectedIds(new Set()); setNote(''); setUserSearch(''); }
  }, [open]);

  if (!open) return null;

  const available = users.filter(u =>
    !existingUserIds.has(u.id) &&
    (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const toggle = id => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allSelected = available.length > 0 && selectedIds.size === available.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(available.map(u => u.id)));
  };

  const submit = async () => {
    if (!selectedIds.size) return;
    setSaving(true);
    await onGrant([...selectedIds].map(uid => parseInt(uid)), note || null);
    setSaving(false);
  };

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-modal pa-modal--grant" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header">
          <div>
            <h3 className="pa-modal-title">Grant Access</h3>
            <p className="pa-modal-sub">{project.name}</p>
          </div>
          <button className="pa-icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* User search + list */}
        <div className="pa-field">
          <input className="pa-input" placeholder="Search users…"
            value={userSearch} onChange={e => setUserSearch(e.target.value)} />
        </div>
        <div className="pa-field">
          <div className="pa-user-select-header">
            <span className="pa-label" style={{ margin: 0 }}>
              Select Users {selectedIds.size > 0 && <span className="pa-badge">{selectedIds.size} selected</span>}
            </span>
            <button className="pa-btn pa-btn--xs pa-btn--ghost" onClick={toggleAll}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="pa-user-list">
            {available.length === 0
              ? <p className="pa-empty-hint">{users.length === 0 ? 'Loading users…' : 'All users already have access.'}</p>
              : available.map(u => (
                <label key={u.id} className={`pa-user-item${selectedIds.has(u.id) ? ' selected' : ''}`}>
                  <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggle(u.id)} />
                  <div className="pa-user-avatar">{(u.full_name || 'U')[0].toUpperCase()}</div>
                  <div>
                    <div className="pa-user-name">{u.full_name}</div>
                    <div className="pa-user-role">{u.role_name}</div>
                  </div>
                </label>
              ))
            }
          </div>
        </div>

        {/* Note */}
        <div className="pa-field">
          <label className="pa-label">Note <span className="pa-opt">(optional)</span></label>
          <textarea className="pa-textarea" rows={2}
            placeholder="e.g. Accounts team needs invoice visibility"
            value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div className="pa-modal-actions">
          <button className="pa-btn pa-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="pa-btn pa-btn--primary" onClick={submit}
            disabled={selectedIds.size === 0 || saving}>
            {saving ? 'Granting…' : `Grant to ${selectedIds.size || 0} User${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Note Modal ──────────────────────────────────────────────────────────
function EditModal({ open, grant, userName, onSave, onClose }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (grant) setNote(grant.note || ''); }, [grant]);
  if (!open || !grant) return null;

  const submit = async () => { setSaving(true); await onSave({ note: note || null }); setSaving(false); };

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-modal pa-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header">
          <div>
            <h3 className="pa-modal-title">Edit Note</h3>
            <p className="pa-modal-sub">{userName}</p>
          </div>
          <button className="pa-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="pa-field">
          <label className="pa-label">Note <span className="pa-opt">(optional)</span></label>
          <textarea className="pa-textarea" rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Reason for access…" />
        </div>
        <div className="pa-modal-actions">
          <button className="pa-btn pa-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="pa-btn pa-btn--primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, users, authHeaders, toast, isAdmin }) {
  const [grants,    setGrants]   = useState([]);
  const [expanded,  setExpanded] = useState(false);
  const [fetched,   setFetched]  = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const [editGrant, setEditGrant] = useState(null);
  const [confirm,   setConfirm]   = useState(null);

  const sm = STATUS_META[project.status?.toUpperCase()] || STATUS_META.PLANNING;

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/projects/${project.id}/access`, { credentials: 'include', headers: authHeaders });
      const json = await res.json();
      if (json.success) setGrants(json.data || []);
    } catch {}
    finally { setLoading(false); setFetched(true); }
  }, [project.id, authHeaders]);

  const toggle = () => {
    if (!expanded && !fetched) fetchGrants();
    setExpanded(v => !v);
  };

  const doGrant = async (userIds, note) => {
    try {
      const res  = await fetch(`${API}/projects/${project.id}/access`, {
        method: 'POST', credentials: 'include', headers: authHeaders,
        body: JSON.stringify({ userIds, note }),
      });
      const json = await res.json();
      if (json.success) toast.add(`Access granted to ${userIds.length} user${userIds.length !== 1 ? 's' : ''}`);
      else toast.add(json.message || 'Failed', 'error');
    } catch { toast.add('Network error', 'error'); }
    setGrantOpen(false);
    fetchGrants();
  };

  const doRevoke = async () => {
    const { userId, userName } = confirm;
    setConfirm(null);
    try {
      const res  = await fetch(`${API}/projects/${project.id}/access/${userId}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders,
      });
      const json = await res.json();
      if (json.success) { toast.add(`Removed ${userName}'s access`); fetchGrants(); }
      else toast.add(json.message || 'Failed', 'error');
    } catch { toast.add('Network error', 'error'); }
  };

  const doEdit = async (body) => {
    try {
      const res = await fetch(`${API}/projects/${project.id}/access`, {
        method: 'POST', credentials: 'include', headers: authHeaders,
        body: JSON.stringify({ userIds: [editGrant.userId], note: body.note }),
      });
      const json = await res.json();
      if (json.success) { toast.add('Note updated'); setEditOpen(false); fetchGrants(); }
      else toast.add(json.message || 'Failed', 'error');
    } catch { toast.add('Network error', 'error'); }
  };

  const existingUserIds = new Set(grants.map(g => g.userId));

  return (
    <>
      <ConfirmModal open={!!confirm} title="Remove Access"
        message={`Remove ${confirm?.userName}'s access to "${project.name}"?`}
        onConfirm={doRevoke} onCancel={() => setConfirm(null)} />
      <GrantModal open={grantOpen} project={project} users={users}
        existingUserIds={existingUserIds}
        onGrant={doGrant} onClose={() => setGrantOpen(false)} />
      <EditModal open={editOpen} grant={editGrant}
        userName={users.find(u => u.id === editGrant?.userId)?.full_name || ''}
        onSave={doEdit} onClose={() => { setEditOpen(false); setEditGrant(null); }} />

      <div className="pa-card">
        {/* Card header */}
        <div className="pa-card-header">
          <div className="pa-card-avatar" style={{ background: sm.bg, color: sm.color }}>
            {(project.name || 'P')[0].toUpperCase()}
          </div>
          <div className="pa-card-info">
            <div className="pa-card-id">{project.id}</div>
            <div className="pa-card-name">{project.name || '—'}</div>
            <div className="pa-card-meta">
              {project.groupId && <span className="pa-chip">{project.groupId}</span>}
              {project.subGroup && <span className="pa-chip pa-chip--sub">{project.subGroup}</span>}
              {project.location && <span className="pa-card-loc">📍 {project.location}</span>}
            </div>
          </div>
          <div className="pa-card-right">
            <span className="pa-status-badge" style={{ background: sm.bg, color: sm.color }}>
              {sm.label}
            </span>
            <div className="pa-card-actions">
              {isAdmin && (
                <button className="pa-btn pa-btn--xs pa-btn--primary"
                  onClick={e => { e.stopPropagation(); setGrantOpen(true); if (!fetched) fetchGrants(); }}>
                  + Grant
                </button>
              )}
              <button className="pa-btn pa-btn--xs pa-btn--ghost" onClick={toggle}>
                {expanded ? '▲ Hide' : '▼ Members'}
                {!loading && fetched && grants.length > 0 && (
                  <span className="pa-badge pa-badge--sm">{grants.length}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Grants table — expandable, scrollable */}
        {expanded && (
          <div className="pa-card-grants">
            {loading ? (
              <div className="pa-loading-row">Loading…</div>
            ) : grants.length === 0 ? (
              <div className="pa-empty-grants">
                <span>🔓</span> No users have been granted access yet.
                {isAdmin && (
                  <button className="pa-btn pa-btn--xs pa-btn--primary" style={{ marginLeft: 10 }}
                    onClick={() => setGrantOpen(true)}>Grant Access</button>
                )}
              </div>
            ) : (
              <div className="pa-grants-scroll">
                <table className="pa-grants-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Granted By</th>
                      <th>Note</th>
                      <th>Granted On</th>
                      {isAdmin && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map(g => {
                      const uName = users.find(u => u.id === g.userId)?.full_name || `User #${g.userId}`;
                      const uRole = users.find(u => u.id === g.userId)?.role_name || '';
                      const gName = users.find(u => u.id === g.grantedBy)?.full_name || (g.grantedBy === g.userId ? 'Self (auto)' : `#${g.grantedBy}`);
                      const date  = g.grantedAt ? new Date(g.grantedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
                      return (
                        <tr key={g.id}>
                          <td>
                            <div className="pa-grant-user">
                              <div className="pa-user-dot">{(uName)[0].toUpperCase()}</div>
                              <span>{uName}</span>
                            </div>
                          </td>
                          <td><span className="pa-role-chip">{uRole || '—'}</span></td>
                          <td className="pa-muted">{gName}</td>
                          <td className="pa-muted" title={g.note}>{g.note ? (g.note.length > 30 ? g.note.slice(0, 30) + '…' : g.note) : '—'}</td>
                          <td className="pa-muted">{date}</td>
                          {isAdmin && (
                            <td>
                              <div className="pa-grant-btns">
                                <button className="pa-act-btn" onClick={() => { setEditGrant(g); setEditOpen(true); }} title="Edit note">✏</button>
                                <button className="pa-act-btn pa-act-btn--del" onClick={() => setConfirm({ userId: g.userId, userName: uName })} title="Remove">✕</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectAccessPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const searchTimer = useRef(null);

  const [projects,       setProjects]       = useState([]);
  const [users,          setUsers]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [totalCount,     setTotalCount]     = useState(0);

  // Pagination
  const PAGE_SIZE_OPTIONS = [6, 12, 24, 48];
  const [pageSize,    setPageSize]    = useState(12);
  const [currentPage, setCurrentPage] = useState(0); // 0-based

  // Filter state — these drive backend fetch
  const [search,         setSearch]         = useState('');
  const [groupFilter,    setGroupFilter]    = useState('');
  const [subGroupFilter, setSubGroupFilter] = useState('');

  // Available groups/subgroups for dropdowns — fetched once
  const [allGroups,    setAllGroups]    = useState([]);
  const [allSubGroups, setAllSubGroups] = useState([]);

  const isAdmin = ['SUPERADMIN','ADMIN'].includes((user?.role || '').toUpperCase());

  const authHeaders = {
    'Content-Type': 'application/json',
    'User-Id':     String(user?.id   || ''),
    'User-Role':   user?.role || '',
    'X-User-Id':   String(user?.id   || ''),
    'X-User-Role': user?.role || '',
  };

  // ── Fetch projects from backend with filters ───────────────────────────────
  const fetchProjects = useCallback(async (srch, grp, sub, pg = 0, sz = 12) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (srch) params.append('search',       srch);
      if (grp)  params.append('groupId',      grp);
      if (sub)  params.append('subGroupName', sub);
      const qs  = params.toString() ? `?${params}` : '';
      const res = await fetch(`${API}/projects${qs}`, { credentials: 'include', headers: authHeaders });
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      const normalized = list.map(p => ({
        id:       p.projectUniqueId || p.id,
        name:     p.projectName     || p.name    || '',
        location: p.location        || '',
        status:   p.status          || '',
        groupId:  p.groupId         || p.group_id     || '',
        subGroup: p.subGroupName    || '',
      }));
      setTotalCount(normalized.length);
      // Client-side pagination slice (backend returns all matching)
      setProjects(normalized.slice(pg * sz, pg * sz + sz));
      setCurrentPage(pg);
    } catch { toast.add('Failed to load projects', 'error'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  // ── Fetch all groups for dropdown ─────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/filters/leads-groups`, { credentials: 'include', headers: authHeaders });
      const data = await res.json();
      setAllGroups(Array.isArray(data) ? data.map(g => g.value || g.label || g) : []);
    } catch {}
  }, []); // eslint-disable-line

  // ── Fetch subgroups when group changes ────────────────────────────────────
  const fetchSubGroups = useCallback(async (grp) => {
    if (!grp) { setAllSubGroups([]); return; }
    try {
      const res  = await fetch(`${API}/filters/leads-subgroups?groupName=${encodeURIComponent(grp)}`, { credentials: 'include', headers: authHeaders });
      const data = await res.json();
      setAllSubGroups(Array.isArray(data) ? data.map(g => g.value || g.label || g) : []);
    } catch {}
  }, []); // eslint-disable-line

  // ── Fetch users for grant modal ───────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res  = await fetch(`${API}/login/users/${user.id}?page=1&size=999`, {
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw  = json.userWrapper || json.content || json.data || json.users || [];
      setUsers((Array.isArray(raw) ? raw : []).map(u => ({
        id:        u.id,
        full_name: u.name     || u.full_name  || '',
        username:  u.user_id  || u.username   || '',
        role_name: u.role     || u.role_name  || '',
      })));
    } catch {}
  }, [user?.id]); // eslint-disable-line

  useEffect(() => { fetchProjects('', '', '', 0, pageSize); fetchGroups(); fetchUsers(); }, []); // eslint-disable-line

  const handleSearch = (val) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchProjects(val, groupFilter, subGroupFilter, 0, pageSize), 350);
  };

  const handleGroupChange = (val) => {
    setGroupFilter(val);
    setSubGroupFilter('');
    setAllSubGroups([]);
    fetchSubGroups(val);
    fetchProjects(search, val, '', 0, pageSize);
  };

  const handleSubGroupChange = (val) => {
    setSubGroupFilter(val);
    fetchProjects(search, groupFilter, val, 0, pageSize);
  };

  const handleReset = () => {
    setSearch(''); setGroupFilter(''); setSubGroupFilter(''); setAllSubGroups([]);
    fetchProjects('', '', '', 0, pageSize);
  };

  const handlePageChange = (pg) => {
    fetchProjects(search, groupFilter, subGroupFilter, pg, pageSize);
  };

  const handlePageSizeChange = (sz) => {
    setPageSize(sz);
    fetchProjects(search, groupFilter, subGroupFilter, 0, sz);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="pa-page">
      <ToastStack toasts={toast.toasts} remove={toast.remove} />

      {/* ── Sticky top: header + info + filters ─────────────────────────── */}
      <div className="pa-sticky-top">

        {/* Header */}
        <div className="pa-header">
          <div className="pa-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="pa-title">Project Access Control</h1>
            <p className="pa-subtitle">Grant or remove user access to projects. Users without a grant won't see the project in any dropdown across the CRM.</p>
          </div>
          <button className="pa-btn pa-btn--ghost pa-refresh-btn" onClick={() => fetchProjects(search, groupFilter, subGroupFilter, currentPage, pageSize)} title="Refresh">
            ↻ Refresh
          </button>
        </div>

        {/* Info strip */}
        <div className="pa-info-strip">
          <div className="pa-info-item">
            <span className="pa-info-ico">🔐</span>
            <span><strong>SUPERADMIN / ADMIN / ACCOUNTS_*</strong> always see all projects — no grants needed</span>
          </div>
          <div className="pa-info-sep" />
          <div className="pa-info-item">
            <span className="pa-info-ico">👤</span>
            <span><strong>All other users</strong> only see projects you grant them. What they can do depends on their page permissions.</span>
          </div>
          <div className="pa-info-sep" />
          <div className="pa-info-item">
            <span className="pa-info-ico">🔗</span>
            <span>Enforced via the <strong>project dropdown</strong> — one control point, all pages</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="pa-filter-bar">
          <div className="pa-search-wrap">
            <svg className="pa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="pa-search" placeholder="Search by project name or ID…"
              value={search} onChange={e => handleSearch(e.target.value)} />
            {search && <button className="pa-search-clear" onClick={() => handleSearch('')}>✕</button>}
          </div>

          <select className="pa-select" value={groupFilter} onChange={e => handleGroupChange(e.target.value)}>
            <option value="">All Groups</option>
            {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select className="pa-select" value={subGroupFilter} onChange={e => handleSubGroupChange(e.target.value)} disabled={!groupFilter}>
            <option value="">{groupFilter ? 'All Sub-Groups' : 'Select Group First'}</option>
            {allSubGroups.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {(search || groupFilter || subGroupFilter) && (
            <button className="pa-btn pa-btn--ghost pa-btn--sm" onClick={handleReset}>✕ Clear</button>
          )}

          <div className="pa-filter-count">
            {loading ? 'Loading…' : `${totalCount} project${totalCount !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* ── Scrollable grid area ─────────────────────────────────────────── */}
      <div className="pa-scroll-area">
        {loading ? (
          <div className="pa-loading">
            <div className="pa-spinner" />
            <p>Loading projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="pa-empty">
            <div className="pa-empty-icon">📂</div>
            <p>{search || groupFilter ? 'No projects match your filters.' : 'No projects found.'}</p>
            {(search || groupFilter) && (
              <button className="pa-btn pa-btn--ghost" onClick={handleReset}>Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="pa-cards-grid">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} users={users}
                  authHeaders={authHeaders} toast={toast} isAdmin={isAdmin} />
              ))}
            </div>

            {/* Pagination */}
            <div className="pa-pagination">
              <div className="pa-pagination-info">
                Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} projects
              </div>

              <div className="pa-pagination-controls">
                {/* Rows per page — same style as other pages */}
                <select className="pa-page-size-select" value={pageSize}
                  onChange={e => handlePageSizeChange(Number(e.target.value))}>
                  {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} Cards</option>)}
                </select>

                <button className="pa-page-btn" disabled={currentPage === 0}
                  onClick={() => handlePageChange(0)}>«</button>
                <button className="pa-page-btn" disabled={currentPage === 0}
                  onClick={() => handlePageChange(currentPage - 1)}>‹</button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg = i;
                  if (totalPages > 5) {
                    const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
                    pg = start + i;
                  }
                  return (
                    <button key={pg} className={`pa-page-btn${pg === currentPage ? ' active' : ''}`}
                      onClick={() => handlePageChange(pg)}>
                      {pg + 1}
                    </button>
                  );
                })}

                <button className="pa-page-btn" disabled={currentPage >= totalPages - 1}
                  onClick={() => handlePageChange(currentPage + 1)}>›</button>
                <button className="pa-page-btn" disabled={currentPage >= totalPages - 1}
                  onClick={() => handlePageChange(totalPages - 1)}>»</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}