// ProjectAccessManager.js
// Renders a panel (inside ProjectDashboard) allowing SUPERADMIN/ADMIN to
// grant or revoke per-user access to a specific project.
//
// Also exports:
//   useProjectAccess(projectId) — hook for any component to know what the
//   current user can see in a project.

import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL;

// ── Access role labels & descriptions ────────────────────────────────────────
export const ACCESS_ROLES = [
  {
    value: 'OWNER',
    label: 'Owner / Full Access',
    description: 'Can view all sections: overview, financials, procurement, expenses, timeline, activities.',
    color: '#1e40af',
    bg: '#dbeafe',
  },
  {
    value: 'FINANCIAL_VIEWER',
    label: 'Financial Viewer',
    description: 'Can view overview, financial details, invoices, and expenses. Cannot see procurement or POs.',
    color: '#065f46',
    bg: '#d1fae5',
  },
  {
    value: 'PROCUREMENT_VIEWER',
    label: 'Procurement Viewer',
    description: 'Can view overview, purchase orders, bills, and vendor details. Cannot see financial figures.',
    color: '#92400e',
    bg: '#fef3c7',
  },
  {
    value: 'VIEWER',
    label: 'Viewer (Overview only)',
    description: 'Can view the project overview, timeline, and recent activities. No financial or procurement data.',
    color: '#374151',
    bg: '#f3f4f6',
  },
];

// ── Hook: useProjectAccess ────────────────────────────────────────────────────
// Call this in ProjectDashboard to know what the current user is allowed to see.
// Returns { loading, canAccess, allowedSections, canViewFinancial, canViewProcurement, canViewExpenses }
export function useProjectAccess(projectId) {
  const { user } = useContext(AuthContext);
  const [state, setState] = useState({
    loading: true,
    canAccess: false,
    accessRole: null,
    allowedSections: [],
    canViewFinancial: false,
    canViewProcurement: false,
    canViewExpenses: false,
  });

  const fetchAccess = useCallback(async () => {
    if (!projectId || !user?.id) return;

    // Admins always have full access — skip the API call
    const role = (user.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || role === 'ADMIN') {
      setState({
        loading: false,
        canAccess: true,
        accessRole: 'OWNER',
        allowedSections: ['overview','financial','procurement','expenses','timeline','activities'],
        canViewFinancial: true,
        canViewProcurement: true,
        canViewExpenses: true,
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/access/me`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'User-Id':   String(user.id),
          'User-Role': user.role || '',
        },
      });

      if (res.status === 403) {
        setState(s => ({ ...s, loading: false, canAccess: false }));
        return;
      }

      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setState({
          loading: false,
          canAccess: true,
          accessRole: d.accessRole,
          allowedSections: d.allowedSections || [],
          canViewFinancial:   !!d.canViewFinancial,
          canViewProcurement: !!d.canViewProcurement,
          canViewExpenses:    !!d.canViewExpenses,
        });
      } else {
        setState(s => ({ ...s, loading: false, canAccess: false }));
      }
    } catch {
      setState(s => ({ ...s, loading: false, canAccess: false }));
    }
  }, [projectId, user]);

  useEffect(() => { fetchAccess(); }, [fetchAccess]);

  return state;
}

// ── ProjectAccessManager component ───────────────────────────────────────────
// Rendered inside ProjectDashboard for SUPERADMIN / ADMIN only.
// Shows the current grants and an "Add User" form.
export default function ProjectAccessManager({ projectId, allUsers = [] }) {
  const { user }  = useContext(AuthContext);
  const [grants,  setGrants]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // "Add user" form state
  const [form, setForm] = useState({ userId: '', accessRole: 'VIEWER', note: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Memoize headers so they are stable across renders (fixes exhaustive-deps warning)
  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'User-Id':   String(user?.id || ''),
    'User-Role': user?.role || '',
  }), [user?.id, user?.role]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch current grants ──────────────────────────────────────────────────
  const fetchGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/access`, {
        credentials: 'include', headers,
      });
      const json = await res.json();
      if (json.success) setGrants(json.data || []);
      else setError(json.message || 'Failed to load access list');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [projectId, headers]);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  // ── Grant access ──────────────────────────────────────────────────────────
  const handleGrant = async (e) => {
    e.preventDefault();
    if (!form.userId) { showToast('Please select a user', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/access`, {
        method: 'POST', credentials: 'include', headers,
        body: JSON.stringify({
          userId:     parseInt(form.userId),
          accessRole: form.accessRole,
          note:       form.note || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Access granted successfully');
        setForm({ userId: '', accessRole: 'VIEWER', note: '' });
        fetchGrants();
      } else {
        showToast(json.message || 'Failed to grant access', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  // ── Revoke access ─────────────────────────────────────────────────────────
  const handleRevoke = async (userId, userName) => {
    if (!window.confirm(`Remove ${userName}'s access to this project?`)) return;
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/access/${userId}`, {
        method: 'DELETE', credentials: 'include', headers,
      });
      const json = await res.json();
      if (json.success) { showToast('Access revoked'); fetchGrants(); }
      else showToast(json.message || 'Failed to revoke', 'error');
    } catch { showToast('Network error', 'error'); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const roleMeta = (roleValue) =>
    ACCESS_ROLES.find(r => r.value === roleValue) || ACCESS_ROLES[3];

  // Filter out users who already have a grant, to show only addable users
  const grantedUserIds = new Set(grants.map(g => g.userId));
  const addableUsers   = allUsers.filter(u => !grantedUserIds.has(u.id));

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 20 }}>
      {/* Header */}
      <div style={{ background: '#f8fafc', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>🔐 Project Access Control</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Grant specific users access to view parts of this project.
          </div>
        </div>
        <span style={{ background: '#eff6ff', color: '#1e40af', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Admin only
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          margin: '12px 18px 0',
          padding: '8px 14px',
          borderRadius: 7,
          fontSize: 13,
          background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
          color:      toast.type === 'error' ? '#991b1b' : '#065f46',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '16px 18px' }}>
        {/* Access role legend */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 18 }}>
          {ACCESS_ROLES.map(r => (
            <div key={r.value} style={{ padding: '8px 12px', borderRadius: 8, background: r.bg, border: `1px solid ${r.color}22` }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: r.color }}>{r.label}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{r.description}</div>
            </div>
          ))}
        </div>

        {/* Add user form */}
        <form onSubmit={handleGrant} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>USER</label>
            <select
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#0f172a' }}
            >
              <option value="">Select user…</option>
              {addableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>ACCESS LEVEL</label>
            <select
              value={form.accessRole}
              onChange={e => setForm(f => ({ ...f, accessRole: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#0f172a' }}
            >
              {ACCESS_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>NOTE (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Accounts team needs to review invoices"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving || !form.userId}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#1e40af', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Grant Access'}
            </button>
          </div>
        </form>

        {/* Current grants table */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Current access grants ({grants.length})
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>
        ) : grants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: 13 }}>
            No users have been granted access yet. Add users above.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>User</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Access Level</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Note</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Granted At</th>
                <th style={{ padding: '8px 12px' }}></th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g, i) => {
                const rm = roleMeta(g.accessRole);
                const uName = allUsers.find(u => u.id === g.userId)?.name || `User #${g.userId}`;
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0f172a' }}>{uName}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ background: rm.bg, color: rm.color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {rm.label}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{g.note || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 12 }}>
                      {g.grantedAt ? new Date(g.grantedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleRevoke(g.userId, uName)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}