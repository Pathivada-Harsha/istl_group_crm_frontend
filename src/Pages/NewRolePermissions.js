import React, { useEffect, useState, useCallback } from "react";
import "../pages-css/NewRolePermissions.css";
import { useAuth } from '../hooks/useAuth';
const API = process.env.REACT_APP_API_URL;

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="rp-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`rp-toast rp-toast--${t.type}`}>
          <div className="rp-toast__indicator" />
          <span className="rp-toast__msg">{t.message}</span>
          <button className="rp-toast__close" onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  const removeToast = useCallback((id) =>
    setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, addToast, removeToast };
}

// ─── Custom Confirm Modal (replaces window.confirm) ───────────────────────────
function ConfirmModal({ isOpen, title, message, subMessage, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 32px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        animation: 'rpSlideUp 0.2s ease-out',
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#fee2e2', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>{title}</h3>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 1.5 }}>{message}</p>
        {subMessage && (
          <p style={{ margin: '0 0 22px', fontSize: 12, color: '#ef4444', textAlign: 'center', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{subMessage}</p>
        )}
        {!subMessage && <div style={{ marginBottom: 22 }} />}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#f8fafc', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: snake_case → "Title Case" ───────────────────────────────────────
function formatMenuName(name) {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewRolePermissions() {
  const { toasts, addToast, removeToast } = useToast();
  const { user } = useAuth();

  const [roles, setRoles]             = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [menuItems, setMenuItems]     = useState([]);

  const [roleName, setRoleName]   = useState("");
  const [roleDesc, setRoleDesc]   = useState("");
  const [permName, setPermName]   = useState("");
  const [permDesc, setPermDesc]   = useState("");

  const [selectedRoleId, setSelectedRoleId]   = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState([]);
  const [menuPerms, setMenuPerms]             = useState([]);
  const [loadingPage, setLoadingPage]         = useState(false);
  const [loadingMenu, setLoadingMenu]         = useState(false);
  const [activeTab, setActiveTab]             = useState("page");
  const [createTab, setCreateTab]             = useState("role");

  // Hierarchy state
  const [hierarchyData, setHierarchyData]     = useState([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierForm, setHierForm]               = useState({ roleName:'', levelOrder:4, description:'', canAssignRoles:[], canSeenRoles:[] });
  const [editingHier, setEditingHier]         = useState(null);

  // Menu item CRUD state
  const [newMenuItemName, setNewMenuItemName] = useState('');
  const [editingMenuId, setEditingMenuId]     = useState(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [menuItemLoading, setMenuItemLoading] = useState(false);

  // Delete confirm modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, menuId: null, menuName: '' });

  useEffect(() => { loadData(); loadHierarchy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [r, p, m] = await Promise.all([
        fetch(`${API}/roles/getAllRoles`, { credentials: "include" }).then(res => res.json()),
        fetch(`${API}/permissions/getAllPermissions`, { credentials: "include" }).then(res => res.json()),
        fetch(`${API}/menu-permissions/getAllMenuItems`, { credentials: "include" }).then(res => res.json()),
      ]);
      setRoles(r); setPermissions(p); setMenuItems(m);
    } catch { addToast("Failed to load data", "error"); }
  };

  const loadHierarchy = async () => {
    setHierarchyLoading(true);
    try {
      const res = await fetch(`${API}/role-hierarchy/all`, { credentials: "include" });
      if (res.ok) setHierarchyData(await res.json());
    } catch {}
    finally { setHierarchyLoading(false); }
  };

  const saveHierarchyEntry = async () => {
    if (!hierForm.roleName.trim()) { addToast("Role name required", "error"); return; }
    const payload = {
      roleName: hierForm.roleName.toUpperCase(),
      levelOrder: Number(hierForm.levelOrder) || 1,
      description: hierForm.description,
      canAssignRoles: JSON.stringify(hierForm.canAssignRoles),
      canSeeRoles: JSON.stringify(hierForm.canSeenRoles || []),
    };
    try {
      const isUpdate = !!editingHier;
      const url = isUpdate ? `${API}/role-hierarchy/${encodeURIComponent(editingHier)}` : `${API}/role-hierarchy/save`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "User-Role": "SUPERADMIN" },
        body: JSON.stringify(payload),
      });
      const data = res.headers.get("content-type")?.includes("json") ? await res.json() : { message: await res.text() };
      if (!res.ok) { addToast(data.message || "Failed to save", "error"); return; }
      addToast(isUpdate ? "Role hierarchy updated!" : "Role hierarchy saved!", "success");
      setHierForm({ roleName:'', levelOrder:4, description:'', canAssignRoles:[], canSeenRoles:[] });
      setEditingHier(null);
      loadHierarchy();
    } catch { addToast("Network error", "error"); }
  };

  const deleteHierarchyEntry = async (roleName) => {
    if (!window.confirm('Delete hierarchy entry for "' + roleName + '"?')) return;
    try {
      const res = await fetch(`${API}/role-hierarchy/${roleName}`, {
        method: "DELETE", credentials: "include", headers: { "User-Role": "SUPERADMIN" },
      });
      if (res.ok) { addToast("Deleted", "success"); loadHierarchy(); }
      else addToast("Delete failed", "error");
    } catch { addToast("Network error", "error"); }
  };

  const startEditHierarchy = (entry) => {
    const parseList = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
    setEditingHier(entry.roleName);
    setHierForm({
      roleName: entry.roleName, levelOrder: entry.levelOrder || 4,
      description: entry.description || '',
      canAssignRoles: parseList(entry.canAssignRoles),
      canSeenRoles: parseList(entry.canSeeRoles),
    });
  };

  const handleRoleChange = async (roleId) => {
    setSelectedRoleId(roleId);
    setSelectedPermIds([]);
    setMenuPerms([]);
    if (!roleId) return;
    setLoadingPage(true); setLoadingMenu(true);
    fetch(`${API}/role-permission/getPermissionsByRole/${roleId}`, { credentials: "include" })
      .then(r => r.json()).then(data => setSelectedPermIds(data.map(p => p.id)))
      .catch(() => addToast("Failed to load page permissions", "error"))
      .finally(() => setLoadingPage(false));
    fetch(`${API}/menu-permissions/getByRole/${roleId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setMenuPerms((Array.isArray(data) ? data : []).map(m => ({
        menuId: m.menuId, menuName: m.menuName, hasPermission: Boolean(m.hasPermission)
      }))))
      .catch(() => addToast("Failed to load menu permissions", "error"))
      .finally(() => setLoadingMenu(false));
  };

  const createRole = async () => {
    if (!roleName.trim()) { addToast("Role name required", "error"); return; }
    try {
      const res = await fetch(`${API}/roles/addNewRole`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roleName, description: roleDesc }),
      });
      const ct = res.headers.get("content-type");
      const msg = ct?.includes("json") ? (await res.json()).message : await res.text();
      if (!res.ok) { addToast(msg || "Failed", "error"); return; }
      addToast(msg || "Role created", "success");
      setRoleName(""); setRoleDesc(""); loadData();
    } catch { addToast("Network error", "error"); }
  };

  const createPermission = async () => {
    if (!permName.trim()) { addToast("Permission name required", "error"); return; }
    try {
      const res = await fetch(`${API}/permissions/addNewPermission`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: permName, description: permDesc }),
      });
      const ct = res.headers.get("content-type");
      const msg = ct?.includes("json") ? (await res.json()).message : await res.text();
      if (!res.ok) { addToast(msg || "Failed", "error"); return; }
      addToast(msg || "Permission created", "success");
      setPermName(""); setPermDesc(""); loadData();
    } catch { addToast("Network error", "error"); }
  };

  const assignPermissions = async () => {
    if (!selectedRoleId) { addToast("Select a role first", "error"); return; }
    if (!selectedPermIds.length) { addToast("Select at least one permission", "error"); return; }
    try {
      const res = await fetch(`${API}/role-permission/assignPermissions`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: selectedRoleId, permission_ids: selectedPermIds }),
      });
      const msg = await res.text();
      if (!res.ok) { addToast(msg || "Failed", "error"); return; }
      addToast(msg || "Page permissions saved", "success");
    } catch { addToast("Network error", "error"); }
  };

  const saveMenuPermissions = async () => {
    if (!selectedRoleId) { addToast("Select a role first", "error"); return; }
    const enabledIds = menuPerms.filter(m => m.hasPermission).map(m => m.menuId);
    try {
      const res = await fetch(`${API}/menu-permissions/save`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: selectedRoleId, menu_ids: enabledIds }),
      });
      const ct = res.headers.get("content-type");
      const msg = ct?.includes("json") ? (await res.json()).message : await res.text();
      if (!res.ok) { addToast(msg || "Failed", "error"); return; }
      addToast(msg || "Menu permissions saved", "success");
    } catch { addToast("Network error", "error"); }
  };

  // ── Grouped permissions ──
  const grouped = permissions.reduce((acc, p) => {
    const g = p.name.includes(".") ? p.name.split(".")[0] : "general";
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  const label = (name) => name.includes(".") ? name.split(".").pop() : name;

  const toggleGroup = (perms, checked) => {
    const ids = perms.map(p => p.id);
    setSelectedPermIds(prev =>
      checked ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id))
    );
  };

  const togglePerm = (id) =>
    setSelectedPermIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const toggleMenuItem = (menuId) =>
    setMenuPerms(prev => prev.map(m => m.menuId === menuId ? { ...m, hasPermission: !m.hasPermission } : m));

  const toggleAllMenus = (checked) =>
    setMenuPerms(prev => prev.map(m => ({ ...m, hasPermission: checked })));

  const allMenus = menuPerms.length > 0 && menuPerms.every(m => m.hasPermission);
  const someMenus = menuPerms.some(m => m.hasPermission);
  const selectedRole = roles.find(r => String(r.id) === String(selectedRoleId));

  // ── Menu Item CRUD helpers ─────────────────────────────────────────────────
  const toSnakeCase = (str) => str.trim().toLowerCase().replace(/\s+/g, '_');

  const handleAddMenuItem = async () => {
    if (!newMenuItemName.trim()) { addToast('Menu item name is required', 'error'); return; }
    setMenuItemLoading(true);
    try {
      const res = await fetch(`${API}/menu-permissions/addMenuItem`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'User-Id': String(user.id) },
        body: JSON.stringify({ name: newMenuItemName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { addToast(data.message || 'Failed to add', 'error'); return; }
      addToast(data.message || 'Menu item added!', 'success');
      setNewMenuItemName('');
      loadData();
      // Also refresh menuPerms if a role is selected
      if (selectedRoleId) handleRoleChange(selectedRoleId);
    } catch { addToast('Network error', 'error'); }
    finally { setMenuItemLoading(false); }
  };

  const handleStartEditMenuItem = (item) => {
    setEditingMenuId(item.id);
    setEditingMenuName(item.name);
  };

  const handleSaveEditMenuItem = async (menuId) => {
    if (!editingMenuName.trim()) { addToast('Name cannot be empty', 'error'); return; }
    setMenuItemLoading(true);
    try {
      const res = await fetch(`${API}/menu-permissions/editMenuItem/${menuId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingMenuName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { addToast(data.message || 'Failed to update', 'error'); return; }
      addToast(data.message || 'Menu item updated!', 'success');
      setEditingMenuId(null); setEditingMenuName('');
      loadData();
      if (selectedRoleId) handleRoleChange(selectedRoleId);
    } catch { addToast('Network error', 'error'); }
    finally { setMenuItemLoading(false); }
  };

  // ── Opens custom confirm modal ─────────────────────────────────────────────
  const handleDeleteMenuItem = (menuId, menuName) => {
    setDeleteModal({ open: true, menuId, menuName });
  };

  // ── Executes after confirm ─────────────────────────────────────────────────
  const confirmDeleteMenuItem = async () => {
    const { menuId, menuName } = deleteModal;
    setDeleteModal({ open: false, menuId: null, menuName: '' });
    setMenuItemLoading(true);
    try {
      const res = await fetch(`${API}/menu-permissions/deleteMenuItem/${menuId}`, {
        method: 'DELETE', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) { addToast(data.message || 'Failed to delete', 'error'); return; }
      addToast(data.message, 'success');
      // Refresh menu items list AND role menu perms
      await loadData();
      if (selectedRoleId) handleRoleChange(selectedRoleId);
    } catch { addToast('Network error', 'error'); }
    finally { setMenuItemLoading(false); }
  };

  return (
    <div className="rp-shell">
      {/* ── Keyframe for modal ── */}
      <style>{`@keyframes rpSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Custom Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={deleteModal.open}
        title="Delete Menu Item"
        message={`Delete "${deleteModal.menuName}"?`}
        subMessage="This will also remove all permissions for all users and roles."
        onConfirm={confirmDeleteMenuItem}
        onCancel={() => setDeleteModal({ open: false, menuId: null, menuName: '' })}
      />

      {/* ── Sidebar ── */}
      <aside className="rp-sidebar">
        <div className="rp-sidebar__brand">
          <div className="rp-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="rp-brand-name">AccessCtrl</span>
        </div>

        <div className="rp-sidebar__section-label">Overview</div>
        <div className="rp-sidebar__stats">
          <div className="rp-stat">
            <div className="rp-stat__val">{roles.length}</div>
            <div className="rp-stat__key">Roles</div>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <div className="rp-stat__val">{permissions.length}</div>
            <div className="rp-stat__key">Permissions</div>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <div className="rp-stat__val">{menuItems.length}</div>
            <div className="rp-stat__key">Menus</div>
          </div>
        </div>

        <div className="rp-sidebar__section-label">Roles</div>
        <div className="rp-role-list">
          {roles.map(r => (
            <button key={r.id}
              className={`rp-role-item ${String(selectedRoleId) === String(r.id) ? "rp-role-item--active" : ""}`}
              onClick={() => handleRoleChange(r.id)}>
              <div className="rp-role-item__avatar">{r.name.charAt(0).toUpperCase()}</div>
              <div className="rp-role-item__info">
                <span className="rp-role-item__name">{r.name}</span>
                {r.description && <span className="rp-role-item__desc">{r.description}</span>}
              </div>
              {String(selectedRoleId) === String(r.id) && <div className="rp-role-item__dot" />}
            </button>
          ))}
          {roles.length === 0 && <div className="rp-role-empty">No roles yet</div>}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="rp-main">

        {/* ── Header ── */}
        <header className="rp-header">
          <div className="rp-header__left">
            <h1 className="rp-header__title">Role & Permission Management</h1>
            <p className="rp-header__sub">Configure access control for your application</p>
          </div>
          {selectedRole && (
            <div className="rp-header__role-pill">
              <div className="rp-live-dot" />
              Editing: <strong>{selectedRole.name}</strong>
            </div>
          )}
        </header>

        {/* ── Create Section ── */}
        <section className="rp-create-section">
          <div className="rp-create-tabs">
            <button className={`rp-ctab ${createTab === "role" ? "rp-ctab--active" : ""}`} onClick={() => setCreateTab("role")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New Role
            </button>
            <button className={`rp-ctab ${createTab === "perm" ? "rp-ctab--active" : ""}`} onClick={() => setCreateTab("perm")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New Page Permission
            </button>
            <button className={`rp-ctab ${createTab === "menuitem" ? "rp-ctab--active" : ""}`} onClick={() => setCreateTab("menuitem")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="19" cy="18" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19 16v2l1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              New Menu Item
            </button>
          </div>

          {/* ── New Role form ── */}
          {createTab === "role" && (
            <div className="rp-create-form rp-create-form--enter">
              <div className="rp-field">
                <label className="rp-field__label">Role Name</label>
                <input className="rp-field__input" placeholder="e.g. Sales Manager"
                  value={roleName} onChange={e => setRoleName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createRole()} />
              </div>
              <div className="rp-field">
                <label className="rp-field__label">Description</label>
                <input className="rp-field__input" placeholder="Brief description (optional)"
                  value={roleDesc} onChange={e => setRoleDesc(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createRole()} />
              </div>
              <button className="rp-btn-create" onClick={createRole}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Create Role
              </button>
            </div>
          )}

          {/* ── New Page Permission form ── */}
          {createTab === "perm" && (
            <div className="rp-create-form rp-create-form--enter">
              <div className="rp-field">
                <label className="rp-field__label">Permission Name</label>
                <input className="rp-field__input" placeholder="e.g. users.view"
                  value={permName} onChange={e => setPermName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createPermission()} />
              </div>
              <div className="rp-field">
                <label className="rp-field__label">Description</label>
                <input className="rp-field__input" placeholder="Brief description (optional)"
                  value={permDesc} onChange={e => setPermDesc(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createPermission()} />
              </div>
              <button className="rp-btn-create" onClick={createPermission}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Create Permission
              </button>
            </div>
          )}

          {/* ── New Menu Item form — simple, like the other two ── */}
          {createTab === "menuitem" && (
            <div className="rp-create-form" style={{ alignItems: 'flex-start' }}>
              <div className="rp-field">
                <label className="rp-field__label">
                  Menu Item Name
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>
                    "New Page" will be stored as "new_page"
                  </span>
                </label>
                <input
                  className="rp-field__input"
                  placeholder='e.g. "New Page" → saved as "new_page"'
                  value={newMenuItemName}
                  onChange={e => setNewMenuItemName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMenuItem()}
                />
                {newMenuItemName.trim() && (
                  <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2, fontWeight: 500 }}>
                    Will be stored as: <strong>"{toSnakeCase(newMenuItemName)}"</strong>
                  </div>
                )}
              </div>
              {/* Button sits at top, aligned with the input not the hint */}
              <div style={{ flexShrink: 0, paddingTop: 18 }}>
                <button className="rp-btn-create" onClick={handleAddMenuItem} disabled={menuItemLoading}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  {menuItemLoading ? 'Adding...' : 'Add Menu Item'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Main panel area ── */}

        {/* When "New Menu Item" tab is active → show the menu items table */}
        {createTab === "menuitem" && (
          <div className="rp-panels">
            {/* Table header bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', background: '#f8fafc',
              borderBottom: '2px solid #e2e8f0', borderRadius: '10px 10px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h10" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  All Menu Items
                </span>
                <span style={{ fontSize: 11, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                  {menuItems.length}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Click Edit to rename · Delete removes all linked permissions</span>
            </div>

            {/* Table */}
            <div className="rp-panel" style={{ borderRadius: '0 0 10px 10px', padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', maxHeight: 550 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: 60 }}>S.No</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Display Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>DB Key (stored in database)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No menu items found</td></tr>
                    )}
                    {menuItems.map((item, idx) => (
                      <tr key={item.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>

                        {/* Display Name column */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                            {formatMenuName(item.name)}
                          </span>
                        </td>

                        {/* DB Key column — editable inline */}
                        <td style={{ padding: '12px 16px' }}>
                          {editingMenuId === item.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <input
                                style={{ padding: '6px 10px', border: '1.5px solid #6366f1', borderRadius: 6, fontSize: 13, outline: 'none', width: '100%', maxWidth: 280 }}
                                value={editingMenuName}
                                onChange={e => setEditingMenuName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEditMenuItem(item.id);
                                  if (e.key === 'Escape') { setEditingMenuId(null); setEditingMenuName(''); }
                                }}
                                autoFocus
                              />
                              {editingMenuName.trim() && editingMenuName.trim() !== item.name && (
                                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500 }}>
                                  Will be stored as: <strong>"{toSnakeCase(editingMenuName)}"</strong>
                                </div>
                              )}
                              {/* ⚠️ Sidebar warning */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, maxWidth: 380 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                                  <strong>Important:</strong> After renaming, update <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 3 }}>backendKey</code> and <code style={{ background: '#fef3c7', padding: '1px 4px', borderRadius: 3 }}>dbField</code> in your <strong>Sidebar</strong> and <strong>UsersPage.js</strong>.
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 9px', borderRadius: 5 }}>
                              {item.name}
                            </span>
                          )}
                        </td>

                        {/* Actions column */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {editingMenuId === item.id ? (
                              <>
                                <button
                                  style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                  onClick={() => handleSaveEditMenuItem(item.id)}
                                  disabled={menuItemLoading}
                                >Save</button>
                                <button
                                  style={{ padding: '5px 10px', fontSize: 12, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}
                                  onClick={() => { setEditingMenuId(null); setEditingMenuName(''); }}
                                >Cancel</button>
                              </>
                            ) : (
                              <>
                                <button
                                  style={{ padding: '5px 12px', fontSize: 12, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}
                                  onClick={() => handleStartEditMenuItem(item)}
                                >Edit</button>
                                <button
                                  style={{ padding: '5px 12px', fontSize: 12, background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}
                                  onClick={() => handleDeleteMenuItem(item.id, item.name)}
                                  disabled={menuItemLoading}
                                >Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* When role tab or perm tab is active → show role-based panels */}
        {createTab !== "menuitem" && (
          !selectedRoleId ? (
            <div className="rp-empty-state">
              <div className="rp-empty-state__graphic">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
                </svg>
              </div>
              <h3 className="rp-empty-state__title">Select a role to configure</h3>
              <p className="rp-empty-state__sub">Choose a role from the sidebar to manage its page and menu permissions</p>
            </div>
          ) : (
            <div className="rp-panels">
              {/* Tab switcher */}
              <div className="rp-panel-tabs">
                <button className={`rp-ptab ${activeTab === "page" ? "rp-ptab--active" : ""}`} onClick={() => setActiveTab("page")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Page Permissions
                  <span className="rp-ptab__badge">{selectedPermIds.length}</span>
                </button>
                <button className={`rp-ptab ${activeTab === "menu" ? "rp-ptab--active" : ""}`} onClick={() => setActiveTab("menu")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Menu Access
                  <span className="rp-ptab__badge">{menuPerms.filter(m => m.hasPermission).length}</span>
                </button>
                <button className={`rp-ptab ${activeTab === "hierarchy" ? "rp-ptab--active" : ""}`}
                  onClick={() => { setActiveTab("hierarchy"); loadHierarchy(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 9l9-6 9 6M5 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Role Hierarchy
                  <span className="rp-ptab__badge">{hierarchyData.length}</span>
                </button>
                <div className="rp-panel-tabs__spacer" />
                {activeTab === "page" && (
                  <button className="rp-btn-save" onClick={assignPermissions}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Save Changes
                  </button>
                )}
                {activeTab === "menu" && (
                  <button className="rp-btn-save" onClick={saveMenuPermissions}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Save Changes
                  </button>
                )}
                {activeTab === "hierarchy" && (
                  <button className="rp-btn-save" onClick={saveHierarchyEntry}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {editingHier ? 'Update Entry' : 'Save Entry'}
                  </button>
                )}
              </div>

              {/* ── Page Permissions Panel → module-grouped layout ── */}
              {activeTab === "page" && (
                <div className="rp-panel">
                  {loadingPage ? (
                    <div className="rp-loader-wrap"><div className="rp-loader" /><span>Loading permissions...</span></div>
                  ) : (
                    <>
                      {Object.keys(grouped).length === 0 ? (
                        <div className="rp-no-data">No permissions defined yet</div>
                      ) : (
                        <>
                          {/* Summary bar */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRadius: '8px 8px 0 0', marginBottom: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                                <input
                                  type="checkbox"
                                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                                  checked={permissions.length > 0 && permissions.every(p => selectedPermIds.includes(p.id))}
                                  ref={el => {
                                    if (el) el.indeterminate = permissions.some(p => selectedPermIds.includes(p.id)) && !permissions.every(p => selectedPermIds.includes(p.id));
                                  }}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedPermIds(permissions.map(p => p.id));
                                    else setSelectedPermIds([]);
                                  }}
                                />
                                Select All Permissions
                              </label>
                            </div>
                            <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                              {selectedPermIds.length} / {permissions.length} selected
                            </span>
                          </div>

                          {/* Module cards */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {Object.entries(grouped).map(([group, perms], groupIdx) => {
                              const allGroupOn   = perms.every(p => selectedPermIds.includes(p.id));
                              const someGroupOn  = perms.some(p => selectedPermIds.includes(p.id));
                              const groupCount   = perms.filter(p => selectedPermIds.includes(p.id)).length;
                              const isLastGroup  = groupIdx === Object.entries(grouped).length - 1;

                              // Action colours — same across all modules
                              const actionColor = {
                                view:    { bg: '#dbeafe', color: '#1e40af', on: '#2563eb' },
                                create:  { bg: '#d1fae5', color: '#065f46', on: '#059669' },
                                edit:    { bg: '#fef3c7', color: '#92400e', on: '#d97706' },
                                delete:  { bg: '#fee2e2', color: '#991b1b', on: '#ef4444' },
                                manage:  { bg: '#ede9fe', color: '#5b21b6', on: '#7c3aed' },
                                approve: { bg: '#ecfdf5', color: '#065f46', on: '#10b981' },
                                assign:  { bg: '#fdf4ff', color: '#6b21a8', on: '#a21caf' },
                                send:    { bg: '#fff7ed', color: '#9a3412', on: '#ea580c' },
                                record:  { bg: '#f0fdf4', color: '#14532d', on: '#16a34a' },
                              };
                              const getActionStyle = (actionName) =>
                                actionColor[actionName.toLowerCase()] || { bg: '#f1f5f9', color: '#475569', on: '#6366f1' };

                              return (
                                <div key={group} style={{
                                  borderBottom: isLastGroup ? 'none' : '1px solid #e2e8f0',
                                  padding: '0',
                                }}>
                                  {/* Module header row */}
                                  <div style={{
                                    display: 'flex', alignItems: 'center',
                                    padding: '10px 16px',
                                    background: allGroupOn ? '#f5f3ff' : someGroupOn ? '#fafafa' : '#fff',
                                    borderBottom: '1px solid #f1f5f9',
                                    gap: 12,
                                  }}>
                                    {/* Group select-all checkbox */}
                                    <input
                                      type="checkbox"
                                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
                                      checked={allGroupOn}
                                      ref={el => { if (el) el.indeterminate = someGroupOn && !allGroupOn; }}
                                      onChange={e => toggleGroup(perms, e.target.checked)}
                                    />

                                    {/* Module name badge */}
                                    <div style={{
                                      minWidth: 160, fontSize: 13, fontWeight: 700,
                                      color: '#0f172a', textTransform: 'capitalize',
                                      display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                      <span style={{
                                        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                                        background: allGroupOn ? '#6366f1' : someGroupOn ? '#a5b4fc' : '#cbd5e1',
                                        flexShrink: 0,
                                      }} />
                                      {group.charAt(0).toUpperCase() + group.slice(1)}
                                      <span style={{
                                        fontSize: 10, fontWeight: 700, color: allGroupOn ? '#4338ca' : '#94a3b8',
                                        background: allGroupOn ? '#e0e7ff' : '#f1f5f9',
                                        padding: '1px 7px', borderRadius: 99,
                                      }}>
                                        {groupCount}/{perms.length}
                                      </span>
                                    </div>

                                    {/* Action checkboxes inline */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                                      {perms.map(p => {
                                        const isOn     = selectedPermIds.includes(p.id);
                                        const action   = label(p.name);
                                        const aStyle   = getActionStyle(action);
                                        return (
                                          <label key={p.id}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: 5,
                                              padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                                              fontSize: 12, fontWeight: 600,
                                              border: isOn ? `1.5px solid ${aStyle.on}` : '1.5px solid #e2e8f0',
                                              background: isOn ? aStyle.bg : '#f8fafc',
                                              color: isOn ? aStyle.color : '#64748b',
                                              transition: 'all 0.15s',
                                              userSelect: 'none',
                                            }}
                                            onMouseEnter={e => { if (!isOn) e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                            onMouseLeave={e => { if (!isOn) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isOn}
                                              onChange={() => togglePerm(p.id)}
                                              style={{ width: 13, height: 13, accentColor: aStyle.on, cursor: 'pointer' }}
                                            />
                                            {action.charAt(0).toUpperCase() + action.slice(1)}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Menu Access Panel ── */}
              {activeTab === "menu" && (
                <div className="rp-panel">
                  {loadingMenu ? (
                    <div className="rp-loader-wrap"><div className="rp-loader" /><span>Loading menu items...</span></div>
                  ) : (
                    <>
                      <div className="rp-menu-toolbar">
                        <label className="rp-select-all">
                          <input type="checkbox" checked={allMenus}
                            ref={el => { if (el) el.indeterminate = someMenus && !allMenus; }}
                            onChange={e => toggleAllMenus(e.target.checked)} />
                          <span>Select all</span>
                        </label>
                        <span className="rp-menu-count">
                          {menuPerms.filter(m => m.hasPermission).length} of {menuPerms.length} enabled
                        </span>
                      </div>
                      <div className="rp-menu-grid">
                        {menuPerms.map(m => (
                          <div key={m.menuId}
                            className={`rp-menu-card ${m.hasPermission ? "rp-menu-card--on" : ""}`}
                            onClick={() => toggleMenuItem(m.menuId)}>
                            <div className="rp-menu-card__icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            </div>
                            {/* ✅ Formatted display name */}
                            <span className="rp-menu-card__name">{formatMenuName(m.menuName)}</span>
                            <div className={`rp-toggle ${m.hasPermission ? "rp-toggle--on" : ""}`}>
                              <div className="rp-toggle__knob" />
                            </div>
                          </div>
                        ))}
                        {menuPerms.length === 0 && (
                          <div className="rp-no-data">No menu items found</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Role Hierarchy Panel ── */}
              {activeTab === "hierarchy" && (
                <div className="rp-panel">
                  <div style={{ background:'linear-gradient(135deg,#eff6ff,#f0fdf4)', border:'1px solid #bfdbfe', borderRadius:10, padding:'14px 18px', marginBottom:20, display:'flex', gap:12, alignItems:'flex-start' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:1}}>
                      <circle cx="12" cy="12" r="10" stroke="#2563eb" strokeWidth="1.8"/>
                      <path d="M12 8v4m0 4h.01" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'#1e40af', marginBottom:3 }}>What is Role Hierarchy?</div>
                      <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>
                        Role Hierarchy defines <strong>who can manage whom</strong>. Set <strong>Level Order</strong> (1 = top), choose which roles this role <strong>can assign</strong> and <strong>can see</strong>.
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20, marginBottom:24 }}>
                    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20, height:'fit-content' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                        <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#0f172a' }}>
                          {editingHier
                            ? <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b', display:'inline-block' }} />Editing: {editingHier}</span>
                            : <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />Add New Entry</span>
                          }
                        </h3>
                        {editingHier && (
                          <button style={{ fontSize:11, color:'#6b7280', background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}
                            onClick={() => { setEditingHier(null); setHierForm({ roleName:'', levelOrder:4, description:'', canAssignRoles:[], canSeenRoles:[] }); }}>
                            Cancel
                          </button>
                        )}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        <div className="rp-field">
                          <label className="rp-field__label">Role Name *</label>
                          <select className="rp-field__input" value={hierForm.roleName}
                            onChange={e => setHierForm({...hierForm, roleName: e.target.value})} disabled={!!editingHier}>
                            <option value="">-- Select a role --</option>
                            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                          </select>
                        </div>
                        <div className="rp-field">
                          <label className="rp-field__label">Level Order <span style={{ fontSize:10, color:'#94a3b8', fontWeight:400, marginLeft:5 }}>1=top (SUPERADMIN)...</span></label>
                          <input className="rp-field__input" type="number" min="1" max="20"
                            value={hierForm.levelOrder} onChange={e => setHierForm({...hierForm, levelOrder: Number(e.target.value) || 1})} />
                        </div>
                        <div className="rp-field">
                          <label className="rp-field__label">Description <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
                          <input className="rp-field__input" placeholder="e.g. Regional sales manager"
                            value={hierForm.description} onChange={e => setHierForm({...hierForm, description: e.target.value})} />
                        </div>
                        <div>
                          <label className="rp-field__label" style={{ display:'block', marginBottom:6 }}>Can Create Users With Role</label>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                            {roles.map(r => {
                              const on = hierForm.canAssignRoles.includes(r.name.toUpperCase());
                              return (
                                <button key={r.id} type="button"
                                  style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border: on ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0', background: on ? '#dbeafe' : '#f9fafb', color: on ? '#1d4ed8' : '#6b7280' }}
                                  onClick={() => { const nm = r.name.toUpperCase(); setHierForm(prev => ({ ...prev, canAssignRoles: prev.canAssignRoles.includes(nm) ? prev.canAssignRoles.filter(x => x !== nm) : [...prev.canAssignRoles, nm] })); }}>
                                  {on && <span style={{ marginRight:3 }}>✓</span>}{r.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="rp-field__label" style={{ display:'block', marginBottom:6 }}>Can View Users With Role</label>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                            {roles.map(r => {
                              const on = (hierForm.canSeenRoles || []).includes(r.name.toUpperCase());
                              return (
                                <button key={r.id} type="button"
                                  style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border: on ? '1.5px solid #059669' : '1.5px solid #e2e8f0', background: on ? '#d1fae5' : '#f9fafb', color: on ? '#065f46' : '#6b7280' }}
                                  onClick={() => { const nm = r.name.toUpperCase(); setHierForm(prev => ({ ...prev, canSeenRoles: (prev.canSeenRoles || []).includes(nm) ? (prev.canSeenRoles || []).filter(x => x !== nm) : [...(prev.canSeenRoles || []), nm] })); }}>
                                  {on && <span style={{ marginRight:3 }}>✓</span>}{r.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button className="rp-btn-save" style={{ width:'100%', justifyContent:'center', marginTop:4 }} onClick={saveHierarchyEntry}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {editingHier ? 'Update Entry' : 'Save Entry'}
                        </button>
                      </div>
                    </div>

                    {hierarchyLoading ? (
                      <div className="rp-loader-wrap" style={{ alignSelf:'center' }}><div className="rp-loader" /><span>Loading...</span></div>
                    ) : hierarchyData.length === 0 ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, background:'#f8fafc', borderRadius:12, border:'1px dashed #e2e8f0', color:'#9ca3af', textAlign:'center' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom:12 }}>
                          <rect x="9" y="2" width="6" height="5" rx="1.5" stroke="#cbd5e1" strokeWidth="1.5"/>
                          <rect x="2" y="17" width="6" height="5" rx="1.5" stroke="#e2e8f0" strokeWidth="1.5"/>
                          <rect x="16" y="17" width="6" height="5" rx="1.5" stroke="#e2e8f0" strokeWidth="1.5"/>
                          <path d="M12 7v4M5 17v-3h14v3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <div style={{ fontWeight:600, fontSize:13, color:'#6b7280' }}>No hierarchy defined yet</div>
                        <div style={{ fontSize:12, marginTop:4 }}>Add entries using the form on the left</div>
                      </div>
                    ) : (
                      <div style={{ background:'linear-gradient(135deg,#f8fafc,#f1f5f9)', borderRadius:12, border:'1px solid #e2e8f0', overflowX:'auto', padding:'24px 20px' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:0, alignItems:'center' }}>
                          {[...hierarchyData].sort((a,b) => (a.levelOrder||99) - (b.levelOrder||99)).map((entry, idx, arr) => {
                            const parseList = (s) => { try { return JSON.parse(s||'[]'); } catch { return []; } };
                            const levelColors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#0891b2','#be185d'];
                            const c = levelColors[idx % levelColors.length];
                            const isLast = idx === arr.length - 1;
                            const manages = parseList(entry.canAssignRoles);
                            return (
                              <div key={entry.roleName} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                                <div style={{ background:'#fff', border:`2px solid ${c}`, borderRadius:12, padding:'12px 20px', minWidth:200, textAlign:'center', boxShadow:`0 3px 12px ${c}20`, position:'relative' }}>
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:4 }}>
                                    <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:c, padding:'1px 7px', borderRadius:99 }}>Level {entry.levelOrder}</span>
                                  </div>
                                  <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>{entry.roleName}</div>
                                  {entry.description && <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>{entry.description}</div>}
                                  {manages.length > 0 && <div style={{ marginTop:8, fontSize:10, color:c, fontWeight:600 }}>Creates: {manages.join(' - ')}</div>}
                                  <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4 }}>
                                    <button title="Edit" style={{ width:22, height:22, borderRadius:5, border:'1px solid #e2e8f0', background:'#f8fafc', color:'#6366f1', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                                      onClick={() => startEditHierarchy(entry)}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </button>
                                    <button title="Delete" style={{ width:22, height:22, borderRadius:5, border:'1px solid #fee2e2', background:'#fff5f5', color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                                      onClick={() => deleteHierarchyEntry(entry.roleName)}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </button>
                                  </div>
                                </div>
                                {!isLast && (
                                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', color:'#cbd5e1' }}>
                                    <div style={{ width:2, height:16, background:'#cbd5e1' }} />
                                    <svg width="10" height="6" viewBox="0 0 10 6"><path d="M0 0 L5 6 L10 0" fill="#cbd5e1"/></svg>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
} 