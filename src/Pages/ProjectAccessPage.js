import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../pages-css/ProjectAccessPage.css';

const API = process.env.REACT_APP_API_URL;

const ACCESS_ROLES = [
  { value: 'OWNER',              label: 'Owner',               desc: 'Full access — all sections',     color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
  { value: 'FINANCIAL_VIEWER',   label: 'Financial Viewer',    desc: 'Financials, invoices, expenses', color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  { value: 'PROCUREMENT_VIEWER', label: 'Procurement Viewer',  desc: 'POs, bills, vendors',            color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  { value: 'VIEWER',             label: 'Viewer',              desc: 'Overview & timeline only',       color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
];
const rolesMeta = Object.fromEntries(ACCESS_ROLES.map(r => [r.value, r]));

const STATUS_COLOR = {
  PLANNING: '#f59e0b', IN_PROGRESS: '#3b82f6',
  COMPLETED: '#10b981', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444',
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
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

// ─── Role Picker ──────────────────────────────────────────────────────────────
function RolePicker({ value, onChange }) {
  return (
    <div className="pa-role-picker">
      <div className="pa-role-pills">
        {ACCESS_ROLES.map(r => (
          <button key={r.value} type="button"
            className={`pa-role-pill${value === r.value ? ' active' : ''}`}
            style={value === r.value ? { background: r.bg, color: r.color, borderColor: r.color } : {}}
            onClick={() => onChange(r.value)}>
            <span className="pa-dot" style={{ background: r.dot }} />
            {r.label}
          </button>
        ))}
      </div>
      <p className="pa-role-hint">{rolesMeta[value]?.desc}</p>
    </div>
  );
}

// ─── Multi-User Grant Modal ───────────────────────────────────────────────────
function GrantModal({ open, project, users, existingUserIds, onGrant, onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [role,        setRole]        = useState('VIEWER');
  const [note,        setNote]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const [userSearch,  setUserSearch]  = useState('');

  useEffect(() => {
    if (open) { setSelectedIds(new Set()); setRole('VIEWER'); setNote(''); setUserSearch(''); }
  }, [open]);

  if (!open) return null;

  const available = users.filter(u =>
    !existingUserIds.has(Number(u.id)) &&
    (!userSearch || (u.full_name || u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.role_name || '').toLowerCase().includes(userSearch.toLowerCase()))
  );

  const toggleUser = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === available.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(available.map(u => u.id)));
    }
  };

  const submit = async () => {
    if (!selectedIds.size) return;
    setSaving(true);
    await onGrant([...selectedIds].map(uid => ({
      userId: parseInt(uid), accessRole: role, note: note || null,
    })));
    setSaving(false);
  };

  const allSelected = available.length > 0 && selectedIds.size === available.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < available.length;

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-modal pa-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header">
          <div>
            <h3 className="pa-modal-title">Grant Project Access</h3>
            <p className="pa-modal-sub">{project?.name}</p>
          </div>
          <button className="pa-icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* Role picker */}
        <div className="pa-field">
          <label className="pa-label">Access Level — applied to all selected users</label>
          <RolePicker value={role} onChange={setRole} />
        </div>

        {/* User multi-select */}
        <div className="pa-field">
          <div className="pa-user-select-header">
            <label className="pa-label" style={{ margin: 0 }}>
              Select Users
              {selectedIds.size > 0 && (
                <span className="pa-selected-count">{selectedIds.size} selected</span>
              )}
            </label>
            {available.length > 0 && (
              <button type="button" className="pa-select-all-btn" onClick={toggleAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {/* User search inside modal */}
          <div className="pa-modal-search-wrap">
            <svg className="pa-modal-search-ico" width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input className="pa-modal-search" type="text"
              placeholder="Filter users by name or role…"
              value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            {userSearch && <button className="pa-clear-sm" onClick={() => setUserSearch('')}>✕</button>}
          </div>

          <div className="pa-user-list">
            {available.length === 0 ? (
              <div className="pa-user-list-empty">
                {users.filter(u => !existingUserIds.has(Number(u.id))).length === 0
                  ? 'All users already have access to this project.'
                  : 'No users match your search.'}
              </div>
            ) : (
              available.map(u => {
                const sel = selectedIds.has(u.id);
                return (
                  <label key={u.id} className={`pa-user-option${sel ? ' selected' : ''}`}>
                    <input type="checkbox" checked={sel} onChange={() => toggleUser(u.id)} className="pa-checkbox" />
                    <div className="pa-user-ava"
                      style={{ background: `hsl(${(Number(u.id) * 47) % 360},55%,60%)` }}>
                      {(u.full_name || u.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="pa-user-option-info">
                      <span className="pa-user-option-name">{u.full_name || u.username}</span>
                      <span className="pa-user-option-role">{u.role_name}</span>
                    </div>
                    {sel && <span className="pa-check-mark">✓</span>}
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Note */}
        <div className="pa-field">
          <label className="pa-label">Note <span className="pa-opt">(optional — applied to all)</span></label>
          <input className="pa-input" type="text"
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

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ open, grant, userName, onSave, onClose }) {
  const [role,   setRole]   = useState('');
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (grant) { setRole(grant.accessRole); setNote(grant.note || ''); }
  }, [grant]);

  if (!open || !grant) return null;

  const submit = async () => {
    setSaving(true);
    await onSave({ accessRole: role, note: note || null });
    setSaving(false);
  };

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-modal" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header">
          <div>
            <h3 className="pa-modal-title">Edit Access</h3>
            <p className="pa-modal-sub">{userName}</p>
          </div>
          <button className="pa-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="pa-field">
          <label className="pa-label">Access Level</label>
          <RolePicker value={role} onChange={setRole} />
        </div>
        <div className="pa-field">
          <label className="pa-label">Note <span className="pa-opt">(optional)</span></label>
          <input className="pa-input" type="text" placeholder="Reason for access"
            value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="pa-modal-actions">
          <button className="pa-btn pa-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="pa-btn pa-btn--primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Row ──────────────────────────────────────────────────────────────
function ProjectRow({ project, users, authHeaders, toast }) {
  const [grants,    setGrants]   = useState([]);
  const [expanded,  setExpanded] = useState(false);
  const [fetched,   setFetched]  = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const [editGrant, setEditGrant] = useState(null);
  const [confirm,   setConfirm]   = useState(null);

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

  // Grant multiple users at once — called with array of { userId, accessRole, note }
  const doGrant = async (grants) => {
    let successCount = 0;
    let failCount    = 0;
    for (const body of grants) {
      try {
        const res  = await fetch(`${API}/projects/${project.id}/access`, {
          method: 'POST', credentials: 'include', headers: authHeaders, body: JSON.stringify(body),
        });
        const json = await res.json();
        json.success ? successCount++ : failCount++;
      } catch { failCount++; }
    }
    if (successCount > 0) toast.add(`Access granted to ${successCount} user${successCount !== 1 ? 's' : ''}`);
    if (failCount    > 0) toast.add(`Failed for ${failCount} user${failCount !== 1 ? 's' : ''}`, 'error');
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
      const res  = await fetch(`${API}/projects/${project.id}/access`, {
        method: 'POST', credentials: 'include', headers: authHeaders,
        body: JSON.stringify({ userId: editGrant.userId, ...body }),
      });
      const json = await res.json();
      if (json.success) { toast.add('Access updated'); setEditOpen(false); fetchGrants(); }
      else toast.add(json.message || 'Failed', 'error');
    } catch { toast.add('Network error', 'error'); }
  };

  const getUser     = uid => users.find(u => Number(u.id) === Number(uid));
  const getUserName = uid => { const u = getUser(uid); return u ? (u.full_name || u.username || `User #${uid}`) : `User #${uid}`; };
  const getUserRole = uid => { const u = getUser(uid); return u ? (u.role_name || '') : ''; };
  const existingUserIds = new Set(grants.map(g => Number(g.userId)));

  return (
    <>
      <div className={`pa-row${expanded ? ' pa-row--open' : ''}`}>
        <button className="pa-row-btn" onClick={toggle}>
          <div className="pa-row-left">
            <div className="pa-row-avatar">{(project.name || 'P')[0].toUpperCase()}</div>
            <div>
              <div className="pa-row-name">{project.name}</div>
              <div className="pa-row-meta">
                <span className="pa-row-id">{project.id}</span>
                {project.groupId   && <span className="pa-tag pa-tag--group">{project.groupId}</span>}
                {project.subGroup  && <span className="pa-tag pa-tag--sub">{project.subGroup}</span>}
                {project.location  && <span className="pa-row-loc">📍 {project.location}</span>}
                {project.status    && (
                  <span className="pa-status-tag" style={{
                    background: (STATUS_COLOR[project.status] || '#94a3b8') + '18',
                    color: STATUS_COLOR[project.status] || '#94a3b8',
                  }}>
                    {project.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="pa-row-right">
            {fetched && (
              <span className={`pa-grant-badge${grants.length > 0 ? ' pa-grant-badge--has' : ''}`}>
                {grants.length > 0 ? `${grants.length} user${grants.length !== 1 ? 's' : ''}` : 'No access granted'}
              </span>
            )}
            <span className={`pa-caret${expanded ? ' pa-caret--open' : ''}`}>▾</span>
          </div>
        </button>

        {expanded && (
          <div className="pa-panel">
            {loading ? (
              <div className="pa-panel-msg"><div className="pa-spinner" /> Loading…</div>
            ) : grants.length === 0 ? (
              <div className="pa-panel-empty">
                <span style={{ fontSize: 32 }}>🔒</span>
                <p>No users have been granted access to this project yet.</p>
                <button className="pa-btn pa-btn--primary pa-btn--sm" onClick={() => setGrantOpen(true)}>
                  + Grant First Access
                </button>
              </div>
            ) : (
              <>
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>User</th><th>Access Level</th><th>Note</th><th>Granted On</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map(g => {
                      const rm    = rolesMeta[g.accessRole] || {};
                      const uName = getUserName(g.userId);
                      const uRole = getUserRole(g.userId);
                      return (
                        <tr key={g.id}>
                          <td>
                            <div className="pa-user-cell">
                              <div className="pa-user-ava"
                                style={{ background: `hsl(${(Number(g.userId) * 47) % 360},55%,60%)` }}>
                                {uName[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="pa-user-name">{uName}</div>
                                {uRole && <div className="pa-user-role">{uRole}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="pa-role-tag" style={{ background: rm.bg, color: rm.color }}>
                              <span className="pa-dot" style={{ background: rm.dot }} />
                              {rm.label || g.accessRole}
                            </span>
                          </td>
                          <td className="pa-note-cell">{g.note || <span className="pa-dash">—</span>}</td>
                          <td className="pa-date-cell">
                            {g.grantedAt ? new Date(g.grantedAt).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            }) : '—'}
                          </td>
                          <td>
                            <div className="pa-actions">
                              <button className="pa-act-btn pa-act-btn--edit" title="Edit access level"
                                onClick={() => { setEditGrant(g); setEditOpen(true); }}>✎</button>
                              <button className="pa-act-btn pa-act-btn--remove" title="Remove access"
                                onClick={() => setConfirm({ userId: g.userId, userName: uName })}>✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="pa-panel-footer">
                  <button className="pa-btn pa-btn--primary pa-btn--sm" onClick={() => setGrantOpen(true)}>
                    + Grant Access
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <GrantModal open={grantOpen} project={project} users={users}
        existingUserIds={existingUserIds} onGrant={doGrant} onClose={() => setGrantOpen(false)} />
      <EditModal open={editOpen} grant={editGrant}
        userName={editGrant ? getUserName(editGrant.userId) : ''}
        onSave={doEdit} onClose={() => setEditOpen(false)} />
      <ConfirmModal open={!!confirm} title="Remove Access"
        message={`Remove ${confirm?.userName}'s access to "${project.name}"? They will no longer see this project in any dropdown.`}
        onConfirm={doRevoke} onCancel={() => setConfirm(null)} />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectAccessPage() {
  const { user } = useAuth();
  const toast    = useToast();

  const [projects,       setProjects]       = useState([]);
  const [users,          setUsers]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [groupFilter,    setGroupFilter]    = useState('');
  const [subGroupFilter, setSubGroupFilter] = useState('');

  // Derived from projects (no separate fetch needed)
  const allGroups    = [...new Set(projects.map(p => p.groupId    || p.group_id).filter(Boolean))].sort();
  const allSubGroups = [...new Set(
    projects
      .filter(p => !groupFilter || (p.groupId || p.group_id) === groupFilter)
      .map(p => p.subGroupName).filter(Boolean)
  )].sort();

  const authHeaders = {
    'Content-Type': 'application/json',
    'User-Id':   String(user?.id   || ''),
    'User-Role': user?.role || '',
  };

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/filters/all-projects`, { credentials: 'include', headers: authHeaders });
      const json = await res.json();
      setProjects(Array.isArray(json) ? json : (json.data || []));
    } catch { toast.add('Failed to load projects', 'error'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res  = await fetch(`${API}/login/users/${user.id}?page=1&size=999`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const raw  = json.userWrapper || json.content || json.data || json.users || [];
      setUsers(
        (Array.isArray(raw) ? raw : []).map(u => ({
          id:        u.id,
          full_name: u.name      || u.full_name  || u.user_id || '',
          username:  u.user_id   || u.username   || '',
          role_name: u.role      || u.role_name  || '',
        }))
      );
    } catch { toast.add('Failed to load users', 'error'); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProjects(); fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset subgroup filter when group changes
  const handleGroupChange = (val) => {
    setGroupFilter(val);
    setSubGroupFilter('');
  };

  const normalize = p => ({
    id:       p.projectUniqueId || p.id,
    name:     p.projectName     || p.name    || '',
    location: p.location        || '',
    status:   p.status          || '',
    groupId:  p.groupId         || p.group_id     || '',
    subGroup: p.subGroupName    || '',
  });

  const filtered = projects.filter(p => {
    const n = normalize(p);
    const q = search.toLowerCase();
    return (
      (!q             || n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) &&
      (!groupFilter   || n.groupId  === groupFilter) &&
      (!subGroupFilter|| n.subGroup === subGroupFilter)
    );
  });

  return (
    <div className="pa-page">
      <ToastStack toasts={toast.toasts} remove={toast.remove} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="pa-header">
        <div className="pa-header-left">
          <div className="pa-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="pa-title">Project Access Control</h1>
            <p className="pa-subtitle">
              Grant or remove user access to projects. Users without a grant won't see the project
              in any dropdown across the entire CRM — Invoices, Bills, POs, Order Book, Dashboard.
            </p>
          </div>
        </div>
        <button className="pa-btn pa-btn--ghost" onClick={() => { fetchProjects(); fetchUsers(); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Info strip ──────────────────────────────────────────────────────── */}
      <div className="pa-info-strip">
        <div className="pa-info-item">
          <span className="pa-info-ico">🔐</span>
          <span><strong>SUPERADMIN / ADMIN</strong> always see all projects — no grants needed</span>
        </div>
        <div className="pa-info-sep" />
        <div className="pa-info-item">
          <span className="pa-info-ico">👤</span>
          <span><strong>All other roles</strong> only see projects you grant them, across every page</span>
        </div>
        <div className="pa-info-sep" />
        <div className="pa-info-item">
          <span className="pa-info-ico">🔗</span>
          <span>Enforced via the <strong>project dropdown</strong> — one control point, all pages</span>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="pa-filters">
        {/* Search */}
        <div className="pa-search-wrap">
          <svg className="pa-search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input className="pa-search" type="text"
            placeholder="Search by project name or ID…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="pa-clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        {/* Group filter — built from project data, no separate API call */}
        <div className="pa-filter-group">
          <label className="pa-filter-label">Group</label>
          <select className="pa-sel" value={groupFilter} onChange={e => handleGroupChange(e.target.value)}>
            <option value="">All Groups</option>
            {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Category / SubGroup filter — scoped to selected group */}
        <div className="pa-filter-group">
          <label className="pa-filter-label">Category</label>
          <select className="pa-sel" value={subGroupFilter}
            onChange={e => setSubGroupFilter(e.target.value)} disabled={!groupFilter}>
            <option value="">{groupFilter ? 'All Categories' : 'Select Group First'}</option>
            {allSubGroups.map(sg => <option key={sg} value={sg}>{sg}</option>)}
          </select>
        </div>

        {/* Active filter chips */}
        {(groupFilter || subGroupFilter) && (
          <div className="pa-filter-chips">
            {groupFilter && (
              <span className="pa-chip">
                {groupFilter}
                <button onClick={() => handleGroupChange('')}>✕</button>
              </span>
            )}
            {subGroupFilter && (
              <span className="pa-chip">
                {subGroupFilter}
                <button onClick={() => setSubGroupFilter('')}>✕</button>
              </span>
            )}
          </div>
        )}

        <span className="pa-count-badge">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
        {users.length > 0 && <span className="pa-users-badge">{users.length} users loaded</span>}
      </div>

      {/* ── Project list ────────────────────────────────────────────────────── */}
      <div className="pa-list">
        {loading ? (
          <div className="pa-loading-state">
            <div className="pa-spinner" />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div className="pa-empty-state">
            <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>
              {search || groupFilter ? 'No projects match your filters.' : 'No projects found.'}
            </div>
            {(search || groupFilter) && (
              <button className="pa-btn pa-btn--ghost pa-btn--sm" style={{ marginTop: 12 }}
                onClick={() => { setSearch(''); setGroupFilter(''); setSubGroupFilter(''); }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map(p => {
            const n = normalize(p);
            return (
              <ProjectRow key={n.id} project={n} users={users}
                authHeaders={authHeaders} toast={toast} />
            );
          })
        )}
      </div>
    </div>
  );
}