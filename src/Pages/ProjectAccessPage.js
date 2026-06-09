import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import '../pages-css/ProjectAccessPage.css';

/* Dark-mode helpers: mute the per-user accent so cards aren't garish in dark */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __paStripe = (hue) => __isDarkTheme() ? `hsl(${hue},32%,42%)` : `hsl(${hue},55%,55%)`;
const __paAvatar = (hue) => __isDarkTheme() ? `hsl(${hue},38%,48%)` : `hsl(${hue},55%,62%)`;
const __paDivider = () => __isDarkTheme() ? '#2b3445' : '#f1f5f9';
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};

const API = process.env.REACT_APP_API_URL;

const STATUS_META = {
  PLANNING:    { color: '#f59e0b', bg: '#fffbeb', label: 'Planning' },
  IN_PROGRESS: { color: '#3b82f6', bg: '#eff6ff', label: 'In Progress' },
  COMPLETED:   { color: '#10b981', bg: '#ecfdf5', label: 'Completed' },
  ON_HOLD:     { color: '#8b5cf6', bg: '#f5f3ff', label: 'On Hold' },
  CANCELLED:   { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled' },
};

const LS_TAB       = 'pa_active_tab';
const LS_PROJ_SIZE = 'pa_proj_page_size';
const LS_USER_SIZE = 'pa_user_page_size';

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
// Rendered via portal into document.body so it always floats above every other
// modal / overlay in the page regardless of DOM nesting order.
function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="pa-overlay pa-overlay--confirm" onClick={onCancel}>
      <div className="pa-modal pa-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-warn-icon">⚠</div>
        <h3 className="pa-modal-title">{title}</h3>
        <p className="pa-modal-body">{message}</p>
        <div className="pa-modal-actions">
          <button className="pa-btn pa-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="pa-btn pa-btn--danger" onClick={onConfirm}>Remove Access</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Grant Modal (project→users) ─────────────────────────────────────────────
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

// ─── Assign Projects Modal (user→projects) ────────────────────────────────────
function AssignProjectsModal({ open, user: targetUser, allProjects, currentProjectIds, onAssign, onRevoke, onBulkRevoke, onClose, saving }) {
  const [search,         setSearch]         = useState('');
  const [selected,       setSelected]       = useState(new Set());
  const [note,           setNote]           = useState('');
  const [tab,            setTab]            = useState('assign'); // 'assign' | 'current'
  const [removeSelected, setRemoveSelected] = useState(new Set()); // multi-select for bulk revoke
  const [revoking,       setRevoking]       = useState(false);

  useEffect(() => {
    if (open) { setSearch(''); setSelected(new Set()); setNote(''); setTab('assign'); setRemoveSelected(new Set()); }
  }, [open]);

  if (!open || !targetUser) return null;

  const available = allProjects.filter(p =>
    !currentProjectIds.has(String(p.id)) &&
    ((p.name || '').toLowerCase().includes(search.toLowerCase()) ||
     (p.id    || '').toLowerCase().includes(search.toLowerCase()))
  );
  const current = allProjects.filter(p =>
    currentProjectIds.has(String(p.id)) &&
    ((p.name || '').toLowerCase().includes(search.toLowerCase()) ||
     (p.id   || '').toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = id => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const allSel = available.length > 0 && selected.size === available.length;
  const toggleAll = () => allSel
    ? setSelected(new Set())
    : setSelected(new Set(available.map(p => p.id)));

  // Multi-select helpers for "Current Access" remove
  const toggleRemove = id => setRemoveSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const allRemoveSel = current.length > 0 && removeSelected.size === current.length;
  const toggleAllRemove = () => allRemoveSel
    ? setRemoveSelected(new Set())
    : setRemoveSelected(new Set(current.map(p => p.id)));

  const handleBulkRevoke = async () => {
    if (!removeSelected.size) return;
    setRevoking(true);
    await onBulkRevoke([...removeSelected]);
    setRemoveSelected(new Set());
    setRevoking(false);
  };

  return (
    <div className="pa-overlay" onClick={onClose}>
      <div className="pa-modal pa-modal--assign" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pa-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="pa-uv-avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
              {(targetUser.full_name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <h3 className="pa-modal-title">{targetUser.full_name}</h3>
              <p className="pa-modal-sub">{targetUser.role_name} · Manage project access</p>
            </div>
          </div>
          <button className="pa-icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* Sub-tabs */}
        <div className="pa-modal-tabs">
          <button className={`pa-modal-tab ${tab === 'assign' ? 'active' : ''}`}
            onClick={() => setTab('assign')}>
            + Assign Projects
            {selected.size > 0 && <span className="pa-badge" style={{ marginLeft: 6 }}>{selected.size}</span>}
          </button>
          <button className={`pa-modal-tab ${tab === 'current' ? 'active' : ''}`}
            onClick={() => setTab('current')}>
            ✓ Current Access
            <span className="pa-badge pa-badge--green" style={{ marginLeft: 6 }}>{currentProjectIds.size}</span>
          </button>
        </div>

        {/* Search */}
        <div className="pa-field" style={{ paddingBottom: 8 }}>
          <div className="pa-search-wrap" style={{ flex: 'none' }}>
            <svg className="pa-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input className="pa-search" style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              placeholder="Search projects…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="pa-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
        </div>

        {/* Assign tab */}
        {tab === 'assign' && (
          <>
            <div className="pa-field" style={{ paddingBottom: 4 }}>
              <div className="pa-user-select-header">
                <span className="pa-label" style={{ margin: 0 }}>
                  Available Projects
                  <span className="pa-count-pill">{available.length}</span>
                </span>
                {available.length > 0 && (
                  <button className="pa-btn pa-btn--xs pa-btn--ghost" onClick={toggleAll}>
                    {allSel ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <div className="pa-user-list pa-proj-list">
                {available.length === 0 ? (
                  <p className="pa-empty-hint">
                    {search ? 'No projects match your search.' : 'All projects already assigned to this user.'}
                  </p>
                ) : (
                  available.map(p => {
                    const sm = STATUS_META[(p.status || '').toUpperCase()] || STATUS_META.PLANNING;
                    const sel = selected.has(p.id);
                    return (
                      <label key={p.id} className={`pa-user-item pa-proj-item${sel ? ' selected' : ''}`}>
                        <input type="checkbox" checked={sel} onChange={() => toggle(p.id)} />
                        <div className="pa-proj-dot" style={{ background: sm.bg, color: sm.color }}>
                          {(p.name || 'P')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="pa-user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div className="pa-user-role">
                            <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{p.id}</span>
                            {p.groupId && <span className="pa-chip" style={{ fontSize: 9 }}>{p.groupId}</span>}
                            {p.subGroup && <span className="pa-chip pa-chip--sub" style={{ fontSize: 9, marginLeft: 4 }}>{p.subGroup}</span>}
                          </div>
                        </div>
                        <span className="pa-status-badge" style={{ background: sm.bg, color: sm.color, fontSize: 9, padding: '2px 6px', flexShrink: 0 }}>
                          {sm.label}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pa-field">
              <label className="pa-label">Note <span className="pa-opt">(optional)</span></label>
              <textarea className="pa-textarea" rows={2}
                placeholder="Reason for granting access…"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="pa-modal-actions">
              <button className="pa-btn pa-btn--ghost" onClick={onClose}>Cancel</button>
              <button className="pa-btn pa-btn--primary"
                disabled={selected.size === 0 || saving}
                onClick={() => onAssign([...selected], note || null)}>
                {saving ? 'Granting…' : `Grant ${selected.size} Project${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {/* Current access tab — with multi-select bulk remove */}
        {tab === 'current' && (
          <>
            <div className="pa-field" style={{ paddingBottom: 4 }}>
              {/* Bulk-select header — only shown when there are projects */}
              {current.length > 0 && (
                <div className="pa-user-select-header" style={{ marginBottom: 6 }}>
                  <span className="pa-label" style={{ margin: 0 }}>
                    Assigned Projects
                    <span className="pa-count-pill">{current.length}</span>
                    {removeSelected.size > 0 && (
                      <span className="pa-badge" style={{ marginLeft: 6, background: '#fee2e2', color: '#991b1b' }}>
                        {removeSelected.size} selected
                      </span>
                    )}
                  </span>
                  <button className="pa-btn pa-btn--xs pa-btn--ghost" onClick={toggleAllRemove}>
                    {allRemoveSel ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              )}
              <div className="pa-user-list pa-proj-list">
                {current.length === 0 ? (
                  <p className="pa-empty-hint">
                    {search ? 'No matching projects in current access.' : 'No projects assigned yet.'}
                  </p>
                ) : (
                  current.map(p => {
                    const sm = STATUS_META[(p.status || '').toUpperCase()] || STATUS_META.PLANNING;
                    const checked = removeSelected.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`pa-user-item pa-proj-item${checked ? ' pa-proj-remove-selected' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRemove(p.id)}
                        />
                        <div className="pa-proj-dot" style={{ background: sm.bg, color: sm.color }}>
                          {(p.name || 'P')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="pa-user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div className="pa-user-role">
                            <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{p.id}</span>
                            {p.groupId && <span className="pa-chip" style={{ fontSize: 9 }}>{p.groupId}</span>}
                          </div>
                        </div>
                        <span className="pa-status-badge" style={{ background: sm.bg, color: sm.color, fontSize: 9, padding: '2px 6px', flexShrink: 0 }}>
                          {sm.label}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <div className="pa-modal-actions">
              <button className="pa-btn pa-btn--ghost" onClick={onClose}>Close</button>
              {removeSelected.size > 0 && (
                <button
                  className="pa-btn pa-btn--danger"
                  disabled={revoking}
                  onClick={handleBulkRevoke}
                >
                  {revoking
                    ? 'Removing…'
                    : `Remove ${removeSelected.size} Project${removeSelected.size !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Project Card (Projects tab) ──────────────────────────────────────────────
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
                      <th>User</th><th>Role</th><th>Granted By</th>
                      <th>Note</th><th>Granted On</th>
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

// ─── User Row (Users tab) ─────────────────────────────────────────────────────
function UserAccessRow({ u, allProjects, authHeaders, toast, isAdmin }) {
  useThemeVersion();
  const [grants,       setGrants]       = useState([]);
  const [fetched,      setFetched]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [confirm,      setConfirm]      = useState(null); // { projectId, projectName }

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/projects/access/user/${u.id}`, { credentials: 'include', headers: authHeaders });
      const json = await res.json();
      if (json.success) setGrants(json.data || []);
      else setGrants([]);
    } catch { setGrants([]); }
    finally { setLoading(false); setFetched(true); }
  }, [u.id, authHeaders]);

  // Auto-fetch on mount so the row shows current project chips immediately
  useEffect(() => { fetchGrants(); }, []); // eslint-disable-line

  const openModal = () => {
    setModalOpen(true);
  };

  const doAssign = async (projectIds, note) => {
    setAssignSaving(true);
    try {
      let ok = 0;
      for (const pid of projectIds) {
        const res  = await fetch(`${API}/projects/${pid}/access`, {
          method: 'POST', credentials: 'include', headers: authHeaders,
          body: JSON.stringify({ userIds: [u.id], note }),
        });
        const json = await res.json();
        if (json.success) ok++;
      }
      toast.add(`Granted access to ${ok} project${ok !== 1 ? 's' : ''}`);
      setModalOpen(false);
      fetchGrants();
    } catch { toast.add('Network error', 'error'); }
    finally { setAssignSaving(false); }
  };

  const doRevoke = async (projectId, projectName) => {
    // Single-revoke: show confirmation dialog first
    setConfirm({ projectId, projectName });
  };

  // Bulk-revoke: called from AssignProjectsModal when user clicks "Remove N Projects".
  // Skips the confirm dialog (user already confirmed via the bulk selection UI)
  // and calls the DELETE API for every selected project in one pass.
  const doBulkRevoke = async (projectIds) => {
    let ok = 0;
    for (const pid of projectIds) {
      try {
        const res  = await fetch(`${API}/projects/${pid}/access/${u.id}`, {
          method: 'DELETE', credentials: 'include', headers: authHeaders,
        });
        const json = await res.json();
        if (json.success) ok++;
        else toast.add(json.message || `Failed to remove project ${pid}`, 'error');
      } catch { toast.add('Network error', 'error'); }
    }
    if (ok > 0) toast.add(`Removed access to ${ok} project${ok !== 1 ? 's' : ''}`);
    fetchGrants();
  };

  const confirmRevoke = async () => {
    const { projectId, projectName } = confirm;
    setConfirm(null);
    try {
      const res  = await fetch(`${API}/projects/${projectId}/access/${u.id}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders,
      });
      const json = await res.json();
      if (json.success) { toast.add(`Removed access to "${projectName}"`); fetchGrants(); }
      else toast.add(json.message || 'Failed', 'error');
    } catch { toast.add('Network error', 'error'); }
  };

  // Entity field is `projectId` (String like 'PROJ-0123').
  // allProjects uses p.id = projectUniqueId, same format — compare as strings.
  const grantedProjectIds = new Set(grants.map(g => String(g.projectId)));
  const grantedProjects   = allProjects.filter(p => grantedProjectIds.has(String(p.id)));

  // Color hue from user id for avatar
  const hue    = (u.id * 47) % 360;
  const avatar = (u.full_name || 'U')[0].toUpperCase();

  return (
    <>
      <ConfirmModal open={!!confirm} title="Revoke Access"
        message={`Remove "${u.full_name}"'s access to "${confirm?.projectName}"?`}
        onConfirm={confirmRevoke} onCancel={() => setConfirm(null)} />

      {modalOpen && (
        <AssignProjectsModal
          open={modalOpen}
          user={u}
          allProjects={allProjects}
          currentProjectIds={grantedProjectIds}
          onAssign={doAssign}
          onRevoke={doRevoke}
          onBulkRevoke={doBulkRevoke}
          onClose={() => setModalOpen(false)}
          saving={assignSaving}
        />
      )}

      <div className="pa-uv-row" onClick={isAdmin ? openModal : undefined} style={{ cursor: isAdmin ? "pointer" : "default" }}>
        {/* Top colour stripe — matches project card style */}
        <div style={{ height: 5, background: __paStripe(hue), margin: '-16px -18px 4px', borderRadius: '12px 12px 0 0' }} />

        {/* User header */}
        <div className="pa-uv-user">
          <div className="pa-uv-avatar" style={{ background: __paAvatar(hue) }}>{avatar}</div>
          <div className="pa-uv-info">
            <div className="pa-uv-name">{u.full_name}</div>
            <div className="pa-uv-meta">
              <span className="pa-role-chip">{u.role_name || '—'}</span>
              {u.designation && <span className="pa-muted" style={{ fontSize: 11 }}>{u.designation}</span>}
            </div>
          </div>
          {/* Count pill top-right */}
          <div className={`pa-uv-count-badge ${!fetched || grantedProjects.length === 0 ? 'zero' : ''}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
            {loading ? '…' : grantedProjects.length}
            <span style={{ fontWeight: 500, opacity: 0.75 }}>proj</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: __paDivider(), margin: '0 -2px' }} />

        {/* Project chips */}
        <div className="pa-uv-access">
          {loading ? (
            <span className="pa-muted" style={{ fontSize: 12 }}>Loading…</span>
          ) : grantedProjects.length === 0 ? (
            <span className="pa-uv-no-access">🔓 No projects assigned yet</span>
          ) : (
            <div className="pa-uv-chips">
              {grantedProjects.slice(0, 4).map(p => {
                const sm = STATUS_META[(p.status || '').toUpperCase()] || STATUS_META.PLANNING;
                return (
                  <span key={p.id} className="pa-uv-proj-chip"
                    style={{ borderColor: sm.color + '55', color: sm.color, background: sm.bg }}>
                    {p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name}
                  </span>
                );
              })}
              {grantedProjects.length > 4 && (
                <span className="pa-uv-proj-chip pa-uv-more">
                  +{grantedProjects.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="pa-uv-actions">
            <button className="pa-btn pa-btn--sm pa-btn--primary" onClick={e => { e.stopPropagation(); openModal(); }}
              style={{ gap: 6, paddingLeft: 14, paddingRight: 14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              Manage Access
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Pagination Bar ───────────────────────────────────────────────────────────
function PaginationBar({ page, totalPages, total, pageSize, onPageChange, onSizeChange, sizeOptions, label }) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, total);
  return (
    <div className="pa-pagination">
      <div className="pa-pagination-info">
        Showing {start}–{end} of {total} {label || 'items'}
      </div>
      <div className="pa-pagination-controls">
        <select className="pa-page-size-select" value={pageSize}
          onChange={e => onSizeChange(Number(e.target.value))}>
          {(sizeOptions || [6, 12, 24, 48]).map(s => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
        <button className="pa-page-btn" disabled={page === 0} onClick={() => onPageChange(0)}>«</button>
        <button className="pa-page-btn" disabled={page === 0} onClick={() => onPageChange(page - 1)}>‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pg = i;
          if (totalPages > 5) {
            const start = Math.max(0, Math.min(page - 2, totalPages - 5));
            pg = start + i;
          }
          return (
            <button key={pg} className={`pa-page-btn${pg === page ? ' active' : ''}`}
              onClick={() => onPageChange(pg)}>{pg + 1}</button>
          );
        })}
        <button className="pa-page-btn" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>›</button>
        <button className="pa-page-btn" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}>»</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectAccessPage() {
  const { user } = useAuth();
  const toast    = useToast();

  // ── Active tab — persisted in localStorage ────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(LS_TAB) || 'projects');
  const switchTab = (t) => { setActiveTab(t); localStorage.setItem(LS_TAB, t); };

  const isAdmin = ['SUPERADMIN', 'ADMIN'].includes((user?.role || '').toUpperCase());
  const authHeaders = {
    'Content-Type': 'application/json',
    'User-Id':      String(user?.id   || ''),
    'User-Role':    user?.role || '',
    'X-User-Id':    String(user?.id   || ''),
    'X-User-Role':  user?.role || '',
  };

  // ── Shared: all projects (normalized) ────────────────────────────────────
  const [allProjectsRaw, setAllProjectsRaw] = useState([]);
  const [allGroups,      setAllGroups]      = useState([]);
  const [allSubGroups,   setAllSubGroups]   = useState([]);
  const [users,          setUsers]          = useState([]);
  const searchTimer = useRef(null);

  // ── Projects tab state ────────────────────────────────────────────────────
  const PROJ_SIZE_OPTS = [6, 12, 24, 48];
  const [projLoading,   setProjLoading]   = useState(false);
  const [projList,      setProjList]      = useState([]);
  const [projTotal,     setProjTotal]     = useState(0);
  const [projPage,      setProjPage]      = useState(0);
  const [projPageSize,  setProjPageSize]  = useState(() => Number(localStorage.getItem(LS_PROJ_SIZE)) || 12);
  const [projSearch,    setProjSearch]    = useState('');
  const [projGroup,     setProjGroup]     = useState('');
  const [projSubGroup,  setProjSubGroup]  = useState('');

  // ── Users tab state ───────────────────────────────────────────────────────
  const USER_SIZE_OPTS = [10, 20, 50, 100];
  const [userLoading,   setUserLoading]   = useState(false);
  const [userSearch,    setUserSearch]    = useState('');
  const [userRoleFilter,setUserRoleFilter]= useState('');
  const [userPage,      setUserPage]      = useState(0);
  const [userPageSize,  setUserPageSize]  = useState(() => Number(localStorage.getItem(LS_USER_SIZE)) || 20);
  const [allRoles,      setAllRoles]      = useState([]);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchAllProjects = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/projects`, { credentials: 'include', headers: authHeaders });
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      const norm = list.map(p => ({
        id:       p.projectUniqueId || p.id,
        name:     p.projectName     || p.name    || '',
        location: p.location        || '',
        status:   p.status          || '',
        groupId:  p.groupId         || p.group_id     || '',
        subGroup: p.subGroupName    || '',
      }));
      setAllProjectsRaw(norm);
      return norm;
    } catch { return []; }
  }, []); // eslint-disable-line

  const applyProjFilters = useCallback((raw, srch, grp, sub, pg, sz) => {
    let filtered = raw;
    if (srch) filtered = filtered.filter(p =>
      (p.name || '').toLowerCase().includes(srch.toLowerCase()) ||
      (p.id   || '').toLowerCase().includes(srch.toLowerCase())
    );
    if (grp) filtered = filtered.filter(p => p.groupId === grp);
    if (sub) filtered = filtered.filter(p => p.subGroup === sub);
    setProjTotal(filtered.length);
    setProjList(filtered.slice(pg * sz, pg * sz + sz));
    setProjPage(pg);
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/filters/leads-groups`, { credentials: 'include', headers: authHeaders });
      const data = await res.json();
      setAllGroups(Array.isArray(data) ? data.map(g => g.value || g.label || g) : []);
    } catch {}
  }, []); // eslint-disable-line

  const fetchSubGroups = useCallback(async (grp) => {
    if (!grp) { setAllSubGroups([]); return; }
    try {
      const res  = await fetch(`${API}/filters/leads-subgroups?groupName=${encodeURIComponent(grp)}`, { credentials: 'include', headers: authHeaders });
      const data = await res.json();
      setAllSubGroups(Array.isArray(data) ? data.map(g => g.value || g.label || g) : []);
    } catch {}
  }, []); // eslint-disable-line

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    setUserLoading(true);
    try {
      const res  = await fetch(`${API}/login/users/${user.id}?page=1&size=999`, {
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const raw  = json.userWrapper || json.content || json.data || json.users || [];
      const mapped = (Array.isArray(raw) ? raw : []).map(u => ({
        id:          u.id,
        full_name:   u.name      || u.full_name  || '',
        username:    u.user_id   || u.username   || '',
        role_name:   u.role      || u.role_name  || '',
        designation: u.designation || '',
      }));
      setUsers(mapped);
      // Collect unique roles for filter
      const roles = [...new Set(mapped.map(u => u.role_name).filter(Boolean))].sort();
      setAllRoles(roles);
    } catch {}
    finally { setUserLoading(false); }
  }, [user?.id]); // eslint-disable-line

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const raw = await fetchAllProjects();
      applyProjFilters(raw, '', '', '', 0, projPageSize);
      fetchGroups();
      fetchUsers();
    };
    init();
  }, []); // eslint-disable-line

  // ── Projects tab handlers ──────────────────────────────────────────────────
  const handleProjSearch = (val) => {
    setProjSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => applyProjFilters(allProjectsRaw, val, projGroup, projSubGroup, 0, projPageSize), 250);
  };

  const handleProjGroup = (val) => {
    setProjGroup(val); setProjSubGroup(''); setAllSubGroups([]);
    fetchSubGroups(val);
    applyProjFilters(allProjectsRaw, projSearch, val, '', 0, projPageSize);
  };

  const handleProjSubGroup = (val) => {
    setProjSubGroup(val);
    applyProjFilters(allProjectsRaw, projSearch, projGroup, val, 0, projPageSize);
  };

  const handleProjReset = () => {
    setProjSearch(''); setProjGroup(''); setProjSubGroup(''); setAllSubGroups([]);
    applyProjFilters(allProjectsRaw, '', '', '', 0, projPageSize);
  };

  const handleProjPageChange = (pg) => applyProjFilters(allProjectsRaw, projSearch, projGroup, projSubGroup, pg, projPageSize);

  const handleProjPageSize = (sz) => {
    setProjPageSize(sz); localStorage.setItem(LS_PROJ_SIZE, sz);
    applyProjFilters(allProjectsRaw, projSearch, projGroup, projSubGroup, 0, sz);
  };

  // ── Users tab derived ──────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    (!userSearch     || (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                        (u.username  || '').toLowerCase().includes(userSearch.toLowerCase())) &&
    (!userRoleFilter || u.role_name === userRoleFilter)
  );
  const userTotalPages = Math.ceil(filteredUsers.length / userPageSize);
  const pagedUsers     = filteredUsers.slice(userPage * userPageSize, (userPage + 1) * userPageSize);

  const handleUserSearch = (val) => { setUserSearch(val); setUserPage(0); };
  const handleUserRole   = (val) => { setUserRoleFilter(val); setUserPage(0); };
  const handleUserReset  = ()    => { setUserSearch(''); setUserRoleFilter(''); setUserPage(0); };
  const handleUserPageSize = (sz) => { setUserPageSize(sz); localStorage.setItem(LS_USER_SIZE, sz); setUserPage(0); };

  const projTotalPages = Math.ceil(projTotal / projPageSize);

  return (
    <div className="pa-page">
      <ToastStack toasts={toast.toasts} remove={toast.remove} />

      {/* ── Sticky top ───────────────────────────────────────────────────── */}
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
            <p className="pa-subtitle">Grant or remove user access to projects across the CRM.</p>
          </div>
          <button className="pa-btn pa-btn--ghost pa-refresh-btn"
            onClick={async () => {
              const raw = await fetchAllProjects();
              applyProjFilters(raw, projSearch, projGroup, projSubGroup, projPage, projPageSize);
              fetchUsers();
            }} title="Refresh">
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
            <span><strong>All other users</strong> only see projects you grant them.</span>
          </div>
          <div className="pa-info-sep" />
          <div className="pa-info-item">
            <span className="pa-info-ico">💡</span>
            <span>Use <strong>Users View</strong> to bulk-assign projects to a new user easily.</span>
          </div>
        </div>

        {/* ── Tab switcher ────────────────────────────────────────────────── */}
        <div className="pa-tabs">
          <button className={`pa-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => switchTab('projects')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Projects View
            <span className="pa-tab-count">{projTotal}</span>
          </button>
          <button className={`pa-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => switchTab('users')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Users View
            <span className="pa-tab-count">{users.length}</span>
          </button>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        {activeTab === 'projects' && (
          <div className="pa-filter-bar">
            <div className="pa-search-wrap">
              <svg className="pa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input className="pa-search" placeholder="Search by project name or ID…"
                value={projSearch} onChange={e => handleProjSearch(e.target.value)} />
              {projSearch && <button className="pa-search-clear" onClick={() => handleProjSearch('')}>✕</button>}
            </div>
            <select className="pa-select" value={projGroup} onChange={e => handleProjGroup(e.target.value)}>
              <option value="">All Groups</option>
              {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="pa-select" value={projSubGroup} onChange={e => handleProjSubGroup(e.target.value)} disabled={!projGroup}>
              <option value="">{projGroup ? 'All Sub-Groups' : 'Select Group First'}</option>
              {allSubGroups.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(projSearch || projGroup || projSubGroup) && (
              <button className="pa-btn pa-btn--ghost pa-btn--sm" onClick={handleProjReset}>✕ Clear</button>
            )}
            <div className="pa-filter-count">
              {projLoading ? 'Loading…' : `${projTotal} project${projTotal !== 1 ? 's' : ''}`}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="pa-filter-bar">
            <div className="pa-search-wrap">
              <svg className="pa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input className="pa-search" placeholder="Search by name or username…"
                value={userSearch} onChange={e => handleUserSearch(e.target.value)} />
              {userSearch && <button className="pa-search-clear" onClick={() => handleUserSearch('')}>✕</button>}
            </div>
            <select className="pa-select" value={userRoleFilter} onChange={e => handleUserRole(e.target.value)}>
              <option value="">All Roles</option>
              {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {(userSearch || userRoleFilter) && (
              <button className="pa-btn pa-btn--ghost pa-btn--sm" onClick={handleUserReset}>✕ Clear</button>
            )}
            <div className="pa-filter-count">
              {userLoading ? 'Loading…' : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        )}
      </div>

      {/* ── Scrollable content area ──────────────────────────────────────── */}
      <div className="pa-scroll-area">

        {/* ── PROJECTS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'projects' && (
          projLoading ? (
            <div className="pa-loading"><div className="pa-spinner" /><p>Loading projects…</p></div>
          ) : projList.length === 0 ? (
            <div className="pa-empty">
              <div className="pa-empty-icon">📂</div>
              <p>{projSearch || projGroup ? 'No projects match your filters.' : 'No projects found.'}</p>
              {(projSearch || projGroup) && <button className="pa-btn pa-btn--ghost" onClick={handleProjReset}>Clear filters</button>}
            </div>
          ) : (
            <>
              <div className="pa-cards-grid">
                {projList.map(p => (
                  <ProjectCard key={p.id} project={p} users={users}
                    authHeaders={authHeaders} toast={toast} isAdmin={isAdmin} />
                ))}
              </div>
              <PaginationBar
                page={projPage} totalPages={projTotalPages} total={projTotal}
                pageSize={projPageSize} sizeOptions={PROJ_SIZE_OPTS}
                onPageChange={handleProjPageChange} onSizeChange={handleProjPageSize}
                label="projects"
              />
            </>
          )
        )}

        {/* ── USERS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          userLoading ? (
            <div className="pa-loading"><div className="pa-spinner" /><p>Loading users…</p></div>
          ) : filteredUsers.length === 0 ? (
            <div className="pa-empty">
              <div className="pa-empty-icon">👤</div>
              <p>{userSearch || userRoleFilter ? 'No users match your filters.' : 'No users found.'}</p>
              {(userSearch || userRoleFilter) && <button className="pa-btn pa-btn--ghost" onClick={handleUserReset}>Clear filters</button>}
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="pa-uv-summary">
                <span>Showing {userPage * userPageSize + 1}–{Math.min((userPage + 1) * userPageSize, filteredUsers.length)} of {filteredUsers.length} users</span>
                <span className="pa-uv-summary-hint">Click <strong>Manage Access</strong> to assign or revoke projects for any user</span>
              </div>

              {/* Users list */}
              <div className="pa-uv-list">
                {pagedUsers.map(u => (
                  <UserAccessRow key={u.id} u={u} allProjects={allProjectsRaw}
                    authHeaders={authHeaders} toast={toast} isAdmin={isAdmin} />
                ))}
              </div>

              <PaginationBar
                page={userPage} totalPages={userTotalPages} total={filteredUsers.length}
                pageSize={userPageSize} sizeOptions={USER_SIZE_OPTS}
                onPageChange={(pg) => setUserPage(pg)} onSizeChange={handleUserPageSize}
                label="users"
              />
            </>
          )
        )}
      </div>
    </div>
  );
}