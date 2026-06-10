import React, { useEffect, useState, useCallback } from "react";
import "../pages-css/NewRolePermissions.css";
import { useAuth } from '../hooks/useAuth';

/* Inline-style theme mappers (dark mode) */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#f8fafb':'#0f1420','#fcfcfd':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f1f1':'#232b3b','#f0f0f0':'#232b3b','#e9eef5':'#2b3445','#eef2f7':'#18202e',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#f0f9ff':'#15243d','#f0f4ff':'#1a2440','#eef2ff':'#1e1f45','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a','#bae6fd':'#16344d','#e0f2fe':'#16344d','#e0e7ff':'#1e2547','#93c5fd':'#2f5d92',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40','#bbf7d0':'#2a5a40','#86efac':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#fecdd3':'#3a1f26','#fff5f5':'#2b1d20','#fff1f2':'#2b1d20','#fff7ed':'#2c2113','#fffbeb':'#2a2710','#fffdf0':'#2a2710','#fef9c3':'#3a3016','#fef3c7':'#3a3016','#fde68a':'#5a4714','#fef08a':'#5a4714','#fcd34d':'#5a4714','#fca5a5':'#5a2a2e',
  '#f5f3ff':'#241b3d','#faf5ff':'#241b3d','#fdf4ff':'#2e2147','#fff0f0':'#2b1d20','#ede9fe':'#2a2147','#ddd6fe':'#2e2147','#e9d5ff':'#2e2147','#ecfeff':'#103038','#fce7f3':'#3a1f30',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#cbd5e0':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6','#0b1220':'#e7ecf3',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#14532d':'#6ee7b7','#6b21a8':'#c4b5fd','#9a3412':'#fb923c','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258','#f59e0b':'#f5b945',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a','#be123c':'#f0708a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0369a1':'#38bdf8','#0c4a6e':'#7cc3f0','#0891b2':'#22d3ee','#1e3a8a':'#7fb0f0',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#4c1d95':'#a78bfa','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3',
};
const __sbg = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __SM[k]) ? __SM[k] : v; };
const __stc = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __TM[k]) ? __TM[k] : v; };
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

// ─── Custom Confirm Modal ───────────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, subMessage, onConfirm, onCancel }) {
  useThemeVersion();
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: __sbg('#fff'), borderRadius: 16, padding: '28px 32px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        animation: 'rpSlideUp 0.2s ease-out',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: __sbg('#fee2e2'), display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: __stc('#0f172a'), textAlign: 'center' }}>{title}</h3>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: __stc('#374151'), textAlign: 'center', lineHeight: 1.5 }}>{message}</p>
        {subMessage && (
          <p style={{ margin: '0 0 22px', fontSize: 12, color: __stc('#ef4444'), textAlign: 'center', background: __sbg('#fef2f2'), padding: '8px 12px', borderRadius: 8 }}>{subMessage}</p>
        )}
        {!subMessage && <div style={{ marginBottom: 22 }} />}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${__sbg('#e2e8f0')}`,
            background: __sbg('#f8fafc'), color: __stc('#374151'), fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: __sbg('#ef4444'), color: __stc('#fff'), fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: snake_case → "Title Case" ───────────────────────────────────────
function formatMenuName(name) {
  if (!name) return '';
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewRolePermissions() {
  useThemeVersion();
  const { toasts, addToast, removeToast } = useToast();
  const { user } = useAuth();

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [permName, setPermName] = useState("");
  const [permDesc, setPermDesc] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermIds, setSelectedPermIds] = useState([]);
  const [menuPerms, setMenuPerms] = useState([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("page");
  const [createTab, setCreateTab] = useState("role");

  // Hierarchy state
  const [hierarchyData, setHierarchyData] = useState([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierForm, setHierForm] = useState({ roleName: '', levelOrder: 4, description: '', canAssignRoles: [], canSeenRoles: [] });
  const [deleteHierConfirm, setDeleteHierConfirm] = useState(null); // roleName string
  const [editingHier, setEditingHier] = useState(null);
  const [hierRoleUsers, setHierRoleUsers] = useState([]);
  const [hierRoleUsersLoading, setHierRoleUsersLoading] = useState(false);
  const [hierRoleStatus, setHierRoleStatus] = useState(null);

  // Menu item CRUD state
  const [newMenuItemName, setNewMenuItemName] = useState('');
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [menuItemLoading, setMenuItemLoading] = useState(false);

  // Permission CRUD state
  const [editingPermId, setEditingPermId] = useState(null);
  const [editingPermName, setEditingPermName] = useState('');
  const [permLoading, setPermLoading] = useState(false);
  const [permDeleteModal, setPermDeleteModal] = useState({ open: false, permId: null, permName: '' });

  // Delete confirm modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, menuId: null, menuName: '' });
  const [roleDeleteModal, setRoleDeleteModal] = useState({ open: false, roleId: null, roleName: '' });

  // ── Pagination state for Permission & Menu Item tables ────────────────────
  const [permPage, setPermPage] = useState(0);
  const [permPageSize, setPermPageSize] = useState(10);
  const [menuPage, setMenuPage] = useState(0);
  const [menuPageSize, setMenuPageSize] = useState(10);

  // ── Search state for Permission & Menu Item tables ─────────────────────────
  const [permSearch, setPermSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');

  // Derived filtered arrays — computed from state, not stored separately
  const filteredPermissions = permissions.filter(p =>
    p.name.toLowerCase().includes(permSearch.toLowerCase().trim())
  );
  const filteredMenuItems = menuItems.filter(item =>
    formatMenuName(item.name).toLowerCase().includes(menuSearch.toLowerCase().trim())
  );

  useEffect(() => { loadData(); loadHierarchy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset pagination when switching tabs or when search changes
  useEffect(() => { setPermPage(0); setMenuPage(0); }, [createTab]);
  useEffect(() => { setPermPage(0); }, [permSearch]);
  useEffect(() => { setMenuPage(0); }, [menuSearch]);

  const loadData = async () => {
    try {
      const [r, p, m] = await Promise.all([
        fetch(`${API}/roles/getAllRoles`, { credentials: "include" }).then(res => res.json()),
        fetch(`${API}/permissions/getAllPermissions`, { credentials: "include" }).then(res => res.json()),
        fetch(`${API}/menu-permissions/getAllMenuItems`, { credentials: "include" }).then(res => res.json()),
      ]);
      setRoles(r);
      setPermissions([...p].sort((a, b) => a.name.localeCompare(b.name)));
      setMenuItems([...m].sort((a, b) => a.name.localeCompare(b.name)));
    } catch { addToast("Failed to load data", "error"); }
  };

  const loadHierarchy = async () => {
    setHierarchyLoading(true);
    try {
      const res = await fetch(`${API}/role-hierarchy/all`, { credentials: "include" });
      if (res.ok) setHierarchyData(await res.json());
    } catch { }
    finally { setHierarchyLoading(false); }
  };

  // Fetch users belonging to a specific role name
  const fetchRoleUsers = async (roleName) => {
    if (!roleName) { setHierRoleUsers([]); setHierRoleStatus(null); return; }
    setHierRoleUsersLoading(true);
    try {
      const res = await fetch(`${API}/login/users/${user.id}?page=1&size=999`, {
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const raw  = json.userWrapper || json.content || json.data || json.users || [];
        const filtered = (Array.isArray(raw) ? raw : []).filter(u =>
          (u.role || u.role_name || '').toUpperCase() === roleName.toUpperCase()
        );
        setHierRoleUsers(filtered);
      }
    } catch {}
    finally { setHierRoleUsersLoading(false); }
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
      setHierForm({ roleName: '', levelOrder: 4, description: '', canAssignRoles: [], canSeenRoles: [] });
      setEditingHier(null);
      loadHierarchy();
    } catch { addToast("Network error", "error"); }
  };

  const deleteHierarchyEntry = (roleName) => { setDeleteHierConfirm(roleName); };

  const confirmDeleteHierarchy = async () => {
    const roleName = deleteHierConfirm;
    setDeleteHierConfirm(null);
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
    setCreateTab("role");
    setActiveTab("page");
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
      })).sort((a, b) => a.menuName.localeCompare(b.menuName))))
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

  const handleDeleteRole = (roleId, roleName) =>
    setRoleDeleteModal({ open: true, roleId, roleName });

  const confirmDeleteRole = async () => {
    const { roleId, roleName: rName } = roleDeleteModal;
    setRoleDeleteModal({ open: false, roleId: null, roleName: '' });
    try {
      const res = await fetch(`${API}/roles/deleteRole/${roleId}`, {
        method: "DELETE", credentials: "include",
      });
      const ct = res.headers.get("content-type");
      const msg = ct?.includes("json") ? (await res.json()).message : await res.text();
      if (!res.ok) { addToast(msg || "Failed to delete", "error"); return; }
      addToast(msg || `Role "${rName}" deleted`, "success");
      // Clear selection if the deleted role was selected
      if (String(selectedRoleId) === String(roleId)) {
        setSelectedRoleId(""); setSelectedPermIds([]); setMenuPerms([]);
      }
      loadData();
    } catch { addToast("Network error", "error"); }
  };

  const createPermission = async () => {
    if (!permName.trim()) { addToast("Permission name required", "error"); return; }
    try {
      const res = await fetch(`${API}/permissions/addNewPermission`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "User-Id": String(user.id) },
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

  const grouped = permissions.reduce((acc, p) => {
    const g = p.name.includes(".") ? p.name.split(".")[0] : "general";
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  const label = (name) => name.includes(".") ? name.split(".").pop() : name;

  const toggleGroup = (perms, checked) => {
    const ids = perms.map(p => p.id);
    setSelectedPermIds(prev => checked ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id)));
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
      if (selectedRoleId) handleRoleChange(selectedRoleId);
      // Notify other open pages (e.g. UsersPage) to refresh their menu items list
      window.dispatchEvent(new CustomEvent('menuItemsChanged'));
    } catch { addToast('Network error', 'error'); }
    finally { setMenuItemLoading(false); }
  };

  const handleStartEditMenuItem = (item) => { setEditingMenuId(item.id); setEditingMenuName(item.name); };

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
      window.dispatchEvent(new CustomEvent('menuItemsChanged'));
    } catch { addToast('Network error', 'error'); }
    finally { setMenuItemLoading(false); }
  };

  const handleDeleteMenuItem = (menuId, menuName) => setDeleteModal({ open: true, menuId, menuName });

  const confirmDeleteMenuItem = async () => {
    const { menuId } = deleteModal;
    setDeleteModal({ open: false, menuId: null, menuName: '' });
    setMenuItemLoading(true);
    try {
      const res = await fetch(`${API}/menu-permissions/deleteMenuItem/${menuId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) { addToast(data.message || 'Failed to delete', 'error'); return; }
      addToast(data.message, 'success');
      await loadData();
      if (selectedRoleId) handleRoleChange(selectedRoleId);
      window.dispatchEvent(new CustomEvent('menuItemsChanged'));
    } catch { addToast('Network error', 'error'); }
    finally { setMenuItemLoading(false); }
  };

  const handleStartEditPerm = (p) => { setEditingPermId(p.id); setEditingPermName(p.name); };

  const handleSaveEditPerm = async (permId) => {
    if (!editingPermName.trim()) { addToast('Permission name required', 'error'); return; }
    setPermLoading(true);
    try {
      const res = await fetch(`${API}/permissions/updatePermission/${permId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingPermName.trim() }),
      });
      const ct = res.headers.get('content-type');
      const msg = ct?.includes('json') ? (await res.json()).message : await res.text();
      if (!res.ok) { addToast(msg || 'Failed to update', 'error'); setPermLoading(false); return; }
      addToast(msg || 'Permission updated', 'success');
      setEditingPermId(null); setEditingPermName('');
      loadData();
    } catch { addToast('Network error', 'error'); }
    setPermLoading(false);
  };

  const handleDeletePerm = (permId, permName) => setPermDeleteModal({ open: true, permId, permName });

  const confirmDeletePerm = async () => {
    const { permId } = permDeleteModal;
    setPermDeleteModal({ open: false, permId: null, permName: '' });
    setPermLoading(true);
    try {
      const res = await fetch(`${API}/permissions/deletePermission/${permId}`, { method: 'DELETE', credentials: 'include' });
      const ct = res.headers.get('content-type');
      const msg = ct?.includes('json') ? (await res.json()).message : await res.text();
      if (!res.ok) { addToast(msg || 'Failed to delete', 'error'); setPermLoading(false); return; }
      addToast(msg || 'Permission deleted', 'success');
      loadData();
    } catch { addToast('Network error', 'error'); }
    setPermLoading(false);
  };

  // ── Reusable Table Pagination Component ──────────────────────────────────
  const TablePagination = ({ currentPage, setCurrentPage, pageSize, setPageSize, total, label }) => {
    const totalPages = Math.ceil(total / pageSize) || 1;
    const from = total === 0 ? 0 : currentPage * pageSize + 1;
    const to   = Math.min((currentPage + 1) * pageSize, total);
    return (
      <div className="rp-pagination-wrap">
        <div className="rp-pagination-info">
          Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> {label}
          <select className="rp-page-size-select" value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(0); }}>
            {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s} per page</option>)}
          </select>
        </div>
        <div className="rp-pagination">
          <button className="rp-page-btn" onClick={() => setCurrentPage(0)} disabled={currentPage === 0} title="First">«</button>
          <button className="rp-page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} title="Previous">‹</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = currentPage < 3 ? i : currentPage + i - 2;
            if (pageNum >= totalPages) return null;
            return (
              <button key={pageNum}
                className={`rp-page-btn${pageNum === currentPage ? ' rp-page-btn--active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}>{pageNum + 1}</button>
            );
          })}
          <button className="rp-page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1} title="Next">›</button>
          <button className="rp-page-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1} title="Last">»</button>
        </div>
      </div>
    );
  };

  // ── Reusable Hierarchy Chart ──────────────────────────────────────────────
  const HierarchyChart = () => (
    hierarchyLoading ? (
      <div className="rp-loader-wrap" style={{ alignSelf: 'center' }}><div className="rp-loader" /><span>Loading...</span></div>
    ) : hierarchyData.length === 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, background: __sbg('#f8fafc'), borderRadius: 12, border: `1px dashed ${__sbg('#e2e8f0')}`, color: __stc('#9ca3af'), textAlign: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}>
          <rect x="9" y="2" width="6" height="5" rx="1.5" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="2" y="17" width="6" height="5" rx="1.5" stroke="#e2e8f0" strokeWidth="1.5" />
          <rect x="16" y="17" width="6" height="5" rx="1.5" stroke="#e2e8f0" strokeWidth="1.5" />
          <path d="M12 7v4M5 17v-3h14v3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontWeight: 600, fontSize: 13, color: __stc('#6b7280') }}>No hierarchy defined yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Add entries using the form on the left</div>
      </div>
    ) : (
      <div style={{ background: `linear-gradient(135deg,${__sbg('#f8fafc')},${__sbg('#f1f5f9')})`, borderRadius: 12, border: `1px solid ${__sbg('#e2e8f0')}`, overflowX: 'auto', overflowY: 'auto', maxHeight: 600, padding: '24px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
          {[...hierarchyData].sort((a, b) => (a.levelOrder || 99) - (b.levelOrder || 99)).map((entry, idx, arr) => {
            const parseList = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
            const levelColors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#be185d'];
            const c = levelColors[idx % levelColors.length];
            const isLast = idx === arr.length - 1;
            const manages = parseList(entry.canAssignRoles);
            return (
              <div key={entry.roleName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: __sbg('#fff'), border: `2px solid ${c}`, borderRadius: 12, padding: '12px 20px', minWidth: 200, textAlign: 'center', boxShadow: `0 3px 12px ${c}20`, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: __stc('#fff'), background: c, padding: '1px 7px', borderRadius: 99 }}>Level {entry.levelOrder}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: __stc('#0f172a') }}>{entry.roleName}</div>
                  {entry.description && <div style={{ fontSize: 11, color: __stc('#6b7280'), marginTop: 3 }}>{entry.description}</div>}
                  {manages.length > 0 && <div style={{ marginTop: 8, fontSize: 10, color: c, fontWeight: 600 }}>Creates: {manages.join(' - ')}</div>}
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                    <button title="Edit" style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${__sbg('#e2e8f0')}`, background: __sbg('#f8fafc'), color: __stc('#6366f1'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => startEditHierarchy(entry)}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button title="Delete" style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${__sbg('#fee2e2')}`, background: __sbg('#fff5f5'), color: __stc('#ef4444'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => deleteHierarchyEntry(entry.roleName)}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
                {!isLast && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: __stc('#cbd5e1') }}>
                    <div style={{ width: 2, height: 16, background: __sbg('#cbd5e1') }} />
                    <svg width="10" height="6" viewBox="0 0 10 6"><path d="M0 0 L5 6 L10 0" fill="#cbd5e1" /></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )
  );

  // ── Reusable Hierarchy Form ───────────────────────────────────────────────
  const HierarchyForm = () => {
    const parseList = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };
    const assignRoles = hierRoleStatus ? parseList(hierRoleStatus.canAssignRoles) : [];
    const seeRoles    = hierRoleStatus ? parseList(hierRoleStatus.canSeeRoles)    : [];
    return (
      <div className="hf-card">
        {/* Header */}
        <div className="hf-header">
          <div className="hf-header-left">
            <span className={`hf-mode-dot ${editingHier ? 'hf-mode-dot--edit' : 'hf-mode-dot--new'}`} />
            <span className="hf-header-title">{editingHier ? `Editing: ${editingHier}` : 'Add / Edit Entry'}</span>
          </div>
          {editingHier && (
            <button className="hf-cancel-btn"
              onClick={() => { setEditingHier(null); setHierForm({ roleName: '', levelOrder: 4, description: '', canAssignRoles: [], canSeenRoles: [] }); setHierRoleStatus(null); setHierRoleUsers([]); }}>
              ✕ Cancel
            </button>
          )}
        </div>

        <div className="hf-body">
          {/* ── Role selector ── */}
          <div className="rp-field">
            <label className="rp-field__label">Role Name *</label>
            <select className="rp-field__input" value={hierForm.roleName} disabled={!!editingHier}
              onChange={e => {
                const selected = e.target.value;
                const existing = hierarchyData.find(h => h.roleName === selected);
                if (existing) {
                  setHierForm({ roleName: selected, levelOrder: existing.levelOrder || 4, description: existing.description || '', canAssignRoles: parseList(existing.canAssignRoles), canSeenRoles: parseList(existing.canSeeRoles) });
                  setHierRoleStatus(existing);
                } else {
                  setHierForm({ roleName: selected, levelOrder: 4, description: '', canAssignRoles: [], canSeenRoles: [] });
                  setHierRoleStatus(null);
                }
                fetchRoleUsers(selected);
              }}>
              <option value="">— Select a role —</option>
              {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>

          {/* ── Current saved status — shown when role has existing entry ── */}
          {hierRoleStatus && !editingHier && (
            <div className="hf-status-box">
              <div className="hf-status-title">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Current saved config
              </div>
              <div className="hf-status-rows">
                <div className="hf-status-row">
                  <span className="hf-status-key">Level</span>
                  <span className="hf-level-badge">{hierRoleStatus.levelOrder}</span>
                </div>
                {assignRoles.length > 0 && (
                  <div className="hf-status-row">
                    <span className="hf-status-key">Creates</span>
                    <div className="hf-tags">
                      {assignRoles.map(r => <span key={r} className="hf-tag hf-tag--blue">{r}</span>)}
                    </div>
                  </div>
                )}
                {seeRoles.length > 0 && (
                  <div className="hf-status-row">
                    <span className="hf-status-key">Views</span>
                    <div className="hf-tags">
                      {seeRoles.map(r => <span key={r} className="hf-tag hf-tag--green">{r}</span>)}
                    </div>
                  </div>
                )}
                {hierRoleStatus.description && (
                  <div className="hf-status-row">
                    <span className="hf-status-key">Note</span>
                    <span className="hf-status-desc">{hierRoleStatus.description}</span>
                  </div>
                )}
              </div>
              <p className="hf-status-hint">Fields below pre-filled — edit and click Update Entry to apply.</p>
            </div>
          )}

          {/* ── Users with this role ── */}
          {hierForm.roleName && (
            <div className="hf-users-box">
              <div className="hf-users-header">
                <span className="hf-users-title">Users with this role</span>
                {!hierRoleUsersLoading && (
                  <span className={`hf-users-count ${hierRoleUsers.length > 0 ? 'hf-users-count--has' : ''}`}>
                    {hierRoleUsers.length}
                  </span>
                )}
              </div>
              <div className="hf-users-list">
                {hierRoleUsersLoading ? (
                  <div className="hf-users-loading"><div className="rp-loader" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading…</div>
                ) : hierRoleUsers.length === 0 ? (
                  <div className="hf-users-empty">No users assigned this role yet</div>
                ) : (
                  hierRoleUsers.map(u => (
                    <div key={u.id} className="hf-user-row">
                      <div className="hf-user-avatar" style={{ background: `hsl(${(u.id * 47) % 360},55%,62%)` }}>
                        {(u.name || u.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="hf-user-info">
                        <span className="hf-user-name">{u.name || u.full_name}</span>
                        {(u.designation || u.email) && <span className="hf-user-sub">{u.designation || u.email}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Level + Description (edit fields) ── */}
          <div className="hf-row-2">
            <div className="rp-field">
              <label className="rp-field__label">Level <span className="hf-hint">1 = top</span></label>
              <input className="rp-field__input" type="number" min="1" max="20"
                value={hierForm.levelOrder} onChange={e => setHierForm({ ...hierForm, levelOrder: Number(e.target.value) || 1 })} />
            </div>
            <div className="rp-field">
              <label className="rp-field__label">Description <span className="hf-hint">optional</span></label>
              <input className="rp-field__input" placeholder="e.g. Regional manager"
                value={hierForm.description} onChange={e => setHierForm({ ...hierForm, description: e.target.value })} />
            </div>
          </div>

          {/* ── Can Create ── */}
          <div className="rp-field">
            <label className="rp-field__label">Can Create Users With Role</label>
            <div className="hf-chips">
              {roles.map(r => {
                const nm = r.name.toUpperCase();
                const on = hierForm.canAssignRoles.includes(nm);
                return (
                  <button key={r.id} type="button" className={`hf-chip hf-chip--blue ${on ? 'on' : ''}`}
                    onClick={() => setHierForm(prev => ({ ...prev, canAssignRoles: on ? prev.canAssignRoles.filter(x => x !== nm) : [...prev.canAssignRoles, nm] }))}>
                    {on && '✓ '}{r.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Can View ── */}
          <div className="rp-field">
            <label className="rp-field__label">Can View Users With Role</label>
            <div className="hf-chips">
              {roles.map(r => {
                const nm = r.name.toUpperCase();
                const on = (hierForm.canSeenRoles || []).includes(nm);
                return (
                  <button key={r.id} type="button" className={`hf-chip hf-chip--green ${on ? 'on' : ''}`}
                    onClick={() => setHierForm(prev => ({ ...prev, canSeenRoles: on ? (prev.canSeenRoles || []).filter(x => x !== nm) : [...(prev.canSeenRoles || []), nm] }))}>
                    {on && '✓ '}{r.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Save ── */}
          <button className="rp-btn-save hf-save-btn" onClick={saveHierarchyEntry}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {editingHier ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rp-shell">
      <style>{`@keyframes rpSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Role Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={roleDeleteModal.open}
        title="Delete Role"
        message={`Delete role "${roleDeleteModal.roleName}"?`}
        subMessage="All page permissions and menu access assigned to this role will also be removed."
        onConfirm={confirmDeleteRole}
        onCancel={() => setRoleDeleteModal({ open: false, roleId: null, roleName: '' })}
      />

      {/* ── Permission Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={permDeleteModal.open}
        title="Delete Permission"
        message={`Delete permission "${permDeleteModal.permName}"?`}
        subMessage="This will also remove it from all roles that have this permission assigned."
        onConfirm={confirmDeletePerm}
        onCancel={() => setPermDeleteModal({ open: false, permId: null, permName: '' })}
      />

      {/* ── Menu Item Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={deleteModal.open}
        title="Delete Menu Item"
        message={`Delete menu item "${formatMenuName(deleteModal.menuName)}"?`}
        subMessage="This will also remove all linked permissions for all users and roles."
        onConfirm={confirmDeleteMenuItem}
        onCancel={() => setDeleteModal({ open: false, menuId: null, menuName: '' })}
      />

      {/* ── Sidebar ── */}
      <aside className="rp-sidebar">
        <div className="rp-sidebar__brand">
          <div className="rp-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="rp-brand-name">AccessCtrl</span>
        </div>

        <div className="rp-sidebar__section-label">Overview</div>
        <div className="rp-sidebar__stats">
          <div className="rp-stat"><div className="rp-stat__val">{roles.length}</div><div className="rp-stat__key">Roles</div></div>
          <div className="rp-stat-divider" />
          <div className="rp-stat"><div className="rp-stat__val">{permissions.length}</div><div className="rp-stat__key">Permissions</div></div>
          <div className="rp-stat-divider" />
          <div className="rp-stat"><div className="rp-stat__val">{menuItems.length}</div><div className="rp-stat__key">Menus</div></div>
        </div>

        <div className="rp-sidebar__section-label">Roles</div>
        {selectedRoleId && (
          <button
            onClick={() => { setSelectedRoleId(""); setSelectedPermIds([]); setMenuPerms([]); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              margin: '0 0 8px', padding: '6px 10px', borderRadius: 7,
              border: `1px solid ${__sbg('#e2e8f0')}`, background: __sbg('#f8fafc'),
              color: __stc('#64748b'), fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Clear selection
          </button>
        )}
        <div className="rp-role-list">
          {roles.map(r => (
            <div key={r.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                className={`rp-role-item ${String(selectedRoleId) === String(r.id) ? "rp-role-item--active" : ""}`}
                style={{ flex: 1, paddingRight: 32 }}
                onClick={() => handleRoleChange(r.id)}>
                <div className="rp-role-item__avatar">{r.name.charAt(0).toUpperCase()}</div>
                <div className="rp-role-item__info">
                  <span className="rp-role-item__name">{r.name}</span>
                  {r.description && <span className="rp-role-item__desc">{r.description}</span>}
                </div>
                {String(selectedRoleId) === String(r.id) && <div className="rp-role-item__dot" />}
              </button>
              <button
                title={`Delete ${r.name}`}
                onClick={e => { e.stopPropagation(); handleDeleteRole(r.id, r.name); }}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 22, height: 22, borderRadius: 5, border: `1px solid ${__sbg('#fecdd3')}`,
                  background: __sbg('#fff1f2'), color: __stc('#be123c'),
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
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

        {/* ── Create Section — only small forms here, no large tables ── */}
        <section className="rp-create-section">
          <div className="rp-create-tabs">
            <button className={`rp-ctab ${createTab === "role" ? "rp-ctab--active" : ""}`} onClick={() => setCreateTab("role")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              New Role
            </button>
            <button className={`rp-ctab ${createTab === "perm" ? "rp-ctab--active" : ""}`} onClick={() => setCreateTab("perm")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              New Page Permission
            </button>
            <button className={`rp-ctab ${createTab === "menuitem" ? "rp-ctab--active" : ""}`} onClick={() => setCreateTab("menuitem")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="19" cy="18" r="3" stroke="currentColor" strokeWidth="2" /><path d="M19 16v2l1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              New Menu Item
            </button>
            <button className={`rp-ctab ${createTab === "hierarchy" ? "rp-ctab--active" : ""}`} onClick={() => { setCreateTab("hierarchy"); loadHierarchy(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 9l9-6 9 6M5 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Role Hierarchy
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                Create Role
              </button>
            </div>
          )}

          {/* ── New Page Permission form only (table is outside section below) ── */}
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                Create Permission
              </button>
            </div>
          )}

          {/* ── New Menu Item form ── */}
          {createTab === "menuitem" && (
            <div className="rp-create-form" style={{ alignItems: 'flex-start' }}>
              <div className="rp-field" style={{ flex: 1 }}>
                <label className="rp-field__label">
                  Menu Item Name
                  <span style={{ fontSize: 11, color: __stc('#94a3b8'), fontWeight: 400, marginLeft: 8 }}>
                    "New Page" will be stored as "new_page"
                  </span>
                </label>
                {/* Input + button in a single row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input className="rp-field__input"
                    style={{ flex: 1, marginBottom: 0 }}
                    placeholder='e.g. "New Page" → saved as "new_page"'
                    value={newMenuItemName}
                    onChange={e => setNewMenuItemName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMenuItem()} />
                  <button className="rp-btn-create" onClick={handleAddMenuItem} disabled={menuItemLoading}
                    style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                    {menuItemLoading ? 'Adding...' : 'Add Menu Item'}
                  </button>
                </div>
                {newMenuItemName.trim() && (
                  <div style={{ fontSize: 11, color: __stc('#6366f1'), marginTop: 4, fontWeight: 500 }}>
                    Will be stored as: <strong>"{toSnakeCase(newMenuItemName)}"</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            FULL-WIDTH PANELS — outside rp-create-section for proper width
            ════════════════════════════════════════════════════════════════════ */}

        {/* ── FIX #3: Perm table full width ── */}
        {createTab === "perm" && (
          <div className="rp-panels">
            {/* Table header row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10, flexShrink: 0,
              padding: '12px 20px', background: __sbg('#f8fafc'),
              borderBottom: `2px solid ${__sbg('#e2e8f0')}`, borderRadius: '10px 10px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#6366f1" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: __stc('#0f172a') }}>All Page Permissions</span>
                <span style={{ fontSize: 11, background: __sbg('#e0e7ff'), color: __stc('#4338ca'), padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                  {filteredPermissions.length}{permSearch.trim() ? ` / ${permissions.length}` : ''}
                </span>
              </div>
              {/* Search bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', maxWidth: 340 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" stroke="#94a3b8" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    style={{ width: '100%', padding: '7px 10px 7px 28px', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 7, fontSize: 12, outline: 'none', background: __sbg('#fff'), color: __stc('#0f172a'), boxSizing: 'border-box' }}
                    placeholder="Search by permission name…"
                    value={permSearch}
                    onChange={e => setPermSearch(e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                  {permSearch && (
                    <button onClick={() => setPermSearch('')}
                      style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: __stc('#94a3b8'), fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, color: __stc('#94a3b8'), whiteSpace: 'nowrap' }}>Edit to rename · Delete removes from all roles</span>
            </div>
            <div className="rp-table-outer">
              <div className="rp-table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: __sbg('#f8fafc') }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}`, width: 50 }}>#</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}` }}>Permission Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}`, width: 110 }}>Module</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}`, width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPermissions.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: __stc('#94a3b8'), fontSize: 13 }}>
                        {permSearch.trim() ? `No permissions match "${permSearch}"` : 'No permissions found'}
                      </td></tr>
                    )}
                    {filteredPermissions.slice(permPage * permPageSize, (permPage + 1) * permPageSize).map((perm, idx) => {
                      const module = perm.name.includes('.') ? perm.name.split('.')[0] : 'general';
                      const isEditing = editingPermId === perm.id;
                      const globalIdx = permPage * permPageSize + idx + 1;
                      return (
                        <tr key={perm.id} style={{ borderBottom: `1px solid ${__sbg('#f1f5f9')}` }}
                          onMouseEnter={e => e.currentTarget.style.background = (__isDarkTheme() ? '#232c3e' : '#f8fafc')}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: __stc('#94a3b8'), fontWeight: 600 }}>{globalIdx}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {isEditing ? (
                              <input style={{ padding: '6px 10px', border: `1.5px solid ${__sbg('#6366f1')}`, borderRadius: 6, fontSize: 13, outline: 'none', width: '100%', maxWidth: 300 }}
                                value={editingPermName} onChange={e => setEditingPermName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEditPerm(perm.id); if (e.key === 'Escape') { setEditingPermId(null); setEditingPermName(''); } }}
                                autoFocus />
                            ) : (
                              <span style={{ fontSize: 13, fontFamily: 'monospace', background: __sbg('#f1f5f9'), padding: '3px 9px', borderRadius: 5, color: __stc('#334155') }}>{perm.name}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: __sbg('#e0e7ff'), color: __stc('#4338ca'), padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize' }}>{module}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {isEditing ? (
                                <>
                                  <button style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: __sbg('#6366f1'), color: __stc('#fff'), border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={() => handleSaveEditPerm(perm.id)} disabled={permLoading}>Save</button>
                                  <button style={{ padding: '5px 10px', fontSize: 12, background: __sbg('#f3f4f6'), color: __stc('#374151'), border: `1px solid ${__sbg('#e5e7eb')}`, borderRadius: 6, cursor: 'pointer' }} onClick={() => { setEditingPermId(null); setEditingPermName(''); }}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button style={{ padding: '5px 12px', fontSize: 12, background: __sbg('#eff6ff'), color: __stc('#2563eb'), border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500 }} onClick={() => handleStartEditPerm(perm)}>Edit</button>
                                  <button style={{ padding: '5px 12px', fontSize: 12, background: __sbg('#fff1f2'), color: __stc('#be123c'), border: `1px solid ${__sbg('#fecdd3')}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500 }} onClick={() => handleDeletePerm(perm.id, perm.name)} disabled={permLoading}>Delete</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredPermissions.length > permPageSize && (
                <TablePagination
                  currentPage={permPage} setCurrentPage={setPermPage}
                  pageSize={permPageSize} setPageSize={setPermPageSize}
                  total={filteredPermissions.length} label="permissions"
                />
              )}
            </div>
          </div>
        )}

        {/* ── FIX #1 & #3: Hierarchy full width + scrollable chart ── */}
        {createTab === "hierarchy" && (
          <div className="rp-panels">
            <div className="rp-panel">
              <div style={{ background: `linear-gradient(135deg,${__sbg('#eff6ff')},${__sbg('#f0fdf4')})`, border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" stroke="#2563eb" strokeWidth="1.8" />
                  <path d="M12 8v4m0 4h.01" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: __stc('#1e40af'), marginBottom: 3 }}>What is Role Hierarchy?</div>
                  <div style={{ fontSize: 12, color: __stc('#374151'), lineHeight: 1.6 }}>
                    Role Hierarchy defines <strong>who can manage whom</strong>. Set <strong>Level Order</strong> (1 = top), choose which roles this role <strong>can assign</strong> and <strong>can see</strong>.
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'min(340px, 100%) 1fr', gap: 20, marginBottom: 24 }} className="rp-hier-grid">
                <HierarchyForm />
                <HierarchyChart />
              </div>
            </div>
          </div>
        )}

        {/* ── Menu Items table — full width ── */}
        {createTab === "menuitem" && (
          <div className="rp-panels">
            {/* Table header row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10, flexShrink: 0,
              padding: '12px 20px', background: __sbg('#f8fafc'),
              borderBottom: `2px solid ${__sbg('#e2e8f0')}`, borderRadius: '10px 10px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h10" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" /></svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: __stc('#0f172a') }}>All Menu Items</span>
                <span style={{ fontSize: 11, background: __sbg('#e0e7ff'), color: __stc('#4338ca'), padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                  {filteredMenuItems.length}{menuSearch.trim() ? ` / ${menuItems.length}` : ''}
                </span>
              </div>
              {/* Search bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', maxWidth: 340 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" stroke="#94a3b8" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    style={{ width: '100%', padding: '7px 10px 7px 28px', border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 7, fontSize: 12, outline: 'none', background: __sbg('#fff'), color: __stc('#0f172a'), boxSizing: 'border-box' }}
                    placeholder="Search by display name…"
                    value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                  {menuSearch && (
                    <button onClick={() => setMenuSearch('')}
                      style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: __stc('#94a3b8'), fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, color: __stc('#94a3b8'), whiteSpace: 'nowrap' }}>Click Edit to rename · Delete removes all linked permissions</span>
            </div>
            <div className="rp-table-outer">
              <div className="rp-table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: __sbg('#f8fafc') }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}`, width: 60 }}>S.No</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}` }}>Display Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}` }}>DB Key (stored in database)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${__sbg('#e2e8f0')}`, width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMenuItems.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: __stc('#94a3b8'), fontSize: 13 }}>
                        {menuSearch.trim() ? `No menu items match "${menuSearch}"` : 'No menu items found'}
                      </td></tr>
                    )}
                    {filteredMenuItems.slice(menuPage * menuPageSize, (menuPage + 1) * menuPageSize).map((item, idx) => (
                      <tr key={item.id}
                        style={{ borderBottom: `1px solid ${__sbg('#f1f5f9')}`, transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = (__isDarkTheme() ? '#232c3e' : '#f8fafc')}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: __stc('#94a3b8'), fontWeight: 600 }}>{menuPage * menuPageSize + idx + 1}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: __stc('#0f172a') }}>{formatMenuName(item.name)}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {editingMenuId === item.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <input style={{ padding: '6px 10px', border: `1.5px solid ${__sbg('#6366f1')}`, borderRadius: 6, fontSize: 13, outline: 'none', width: '100%', maxWidth: 280 }}
                                value={editingMenuName} onChange={e => setEditingMenuName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEditMenuItem(item.id); if (e.key === 'Escape') { setEditingMenuId(null); setEditingMenuName(''); } }}
                                autoFocus />
                              {editingMenuName.trim() && editingMenuName.trim() !== item.name && (
                                <div style={{ fontSize: 11, color: __stc('#6366f1'), fontWeight: 500 }}>
                                  Will be stored as: <strong>"{toSnakeCase(editingMenuName)}"</strong>
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 10px', background: __sbg('#fffbeb'), border: `1px solid ${__sbg('#fde68a')}`, borderRadius: 7, maxWidth: 380 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span style={{ fontSize: 11, color: __stc('#92400e'), lineHeight: 1.5 }}>
                                  <strong>Important:</strong> After renaming, update <code style={{ background: __sbg('#fef3c7'), padding: '1px 4px', borderRadius: 3 }}>backendKey</code> and <code style={{ background: __sbg('#fef3c7'), padding: '1px 4px', borderRadius: 3 }}>dbField</code> in your <strong>Sidebar</strong> and <strong>UsersPage.js</strong>.
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: __stc('#475569'), fontFamily: 'monospace', background: __sbg('#f1f5f9'), padding: '3px 9px', borderRadius: 5 }}>{item.name}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {editingMenuId === item.id ? (
                              <>
                                <button style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: __sbg('#6366f1'), color: __stc('#fff'), border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={() => handleSaveEditMenuItem(item.id)} disabled={menuItemLoading}>Save</button>
                                <button style={{ padding: '5px 10px', fontSize: 12, background: __sbg('#f3f4f6'), color: __stc('#374151'), border: `1px solid ${__sbg('#e5e7eb')}`, borderRadius: 6, cursor: 'pointer' }} onClick={() => { setEditingMenuId(null); setEditingMenuName(''); }}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button style={{ padding: '5px 12px', fontSize: 12, background: __sbg('#eff6ff'), color: __stc('#2563eb'), border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500 }} onClick={() => handleStartEditMenuItem(item)}>Edit</button>
                                <button style={{ padding: '5px 12px', fontSize: 12, background: __sbg('#fff1f2'), color: __stc('#be123c'), border: `1px solid ${__sbg('#fecdd3')}`, borderRadius: 6, cursor: 'pointer', fontWeight: 500 }} onClick={() => handleDeleteMenuItem(item.id, item.name)} disabled={menuItemLoading}>Delete</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredMenuItems.length > menuPageSize && (
                <TablePagination
                  currentPage={menuPage} setCurrentPage={setMenuPage}
                  pageSize={menuPageSize} setPageSize={setMenuPageSize}
                  total={filteredMenuItems.length} label="menu items"
                />
              )}
            </div>
          </div>
        )}

        {/* ── FIX #2: Role panels — hidden for perm, hierarchy, menuitem tabs ── */}
        {createTab !== "menuitem" && createTab !== "hierarchy" && createTab !== "perm" && (
          !selectedRoleId ? (
            <div className="rp-empty-state">
              <div className="rp-empty-state__graphic">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <h3 className="rp-empty-state__title">Select a role to configure</h3>
              <p className="rp-empty-state__sub">Choose a role from the sidebar to manage its page and menu permissions</p>
            </div>
          ) : (
            <div className="rp-panels">
              <div className="rp-panel-tabs">
                <button className={`rp-ptab ${activeTab === "page" ? "rp-ptab--active" : ""}`} onClick={() => setActiveTab("page")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Page Permissions
                  <span className="rp-ptab__badge">{selectedPermIds.length}</span>
                </button>
                <button className={`rp-ptab ${activeTab === "menu" ? "rp-ptab--active" : ""}`} onClick={() => setActiveTab("menu")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  Menu Access
                  <span className="rp-ptab__badge">{menuPerms.filter(m => m.hasPermission).length}</span>
                </button>
                <div className="rp-panel-tabs__spacer" />
                {activeTab === "page" && (
                  <button className="rp-btn-save" onClick={assignPermissions}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Save Changes
                  </button>
                )}
                {activeTab === "menu" && (
                  <button className="rp-btn-save" onClick={saveMenuPermissions}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Save Changes
                  </button>
                )}
              </div>

              {/* ── Page Permissions Panel ── */}
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: __sbg('#f8fafc'), borderBottom: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: '8px 8px 0 0', marginBottom: 0 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: __stc('#374151') }}>
                              <input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                                checked={permissions.length > 0 && permissions.every(p => selectedPermIds.includes(p.id))}
                                ref={el => { if (el) el.indeterminate = permissions.some(p => selectedPermIds.includes(p.id)) && !permissions.every(p => selectedPermIds.includes(p.id)); }}
                                onChange={e => { if (e.target.checked) setSelectedPermIds(permissions.map(p => p.id)); else setSelectedPermIds([]); }} />
                              Select All Permissions
                            </label>
                            <span style={{ fontSize: 12, color: __stc('#6366f1'), fontWeight: 600 }}>{selectedPermIds.length} / {permissions.length} selected</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, perms], groupIdx) => {
                              const allGroupOn = perms.every(p => selectedPermIds.includes(p.id));
                              const someGroupOn = perms.some(p => selectedPermIds.includes(p.id));
                              const groupCount = perms.filter(p => selectedPermIds.includes(p.id)).length;
                              const isLastGroup = groupIdx === Object.entries(grouped).length - 1;
                              const actionColor = {
                                view: { bg: __sbg('#dbeafe'), color: __stc('#1e40af'), on: '#2563eb' },
                                create: { bg: __sbg('#d1fae5'), color: __stc('#065f46'), on: '#059669' },
                                edit: { bg: __sbg('#fef3c7'), color: __stc('#92400e'), on: '#d97706' },
                                delete: { bg: __sbg('#fee2e2'), color: __stc('#991b1b'), on: '#ef4444' },
                                manage: { bg: __sbg('#ede9fe'), color: __stc('#5b21b6'), on: '#7c3aed' },
                                approve: { bg: __sbg('#ecfdf5'), color: __stc('#065f46'), on: '#10b981' },
                                assign: { bg: __sbg('#fdf4ff'), color: __stc('#6b21a8'), on: '#a21caf' },
                                send: { bg: __sbg('#fff7ed'), color: __stc('#9a3412'), on: '#ea580c' },
                                record: { bg: __sbg('#f0fdf4'), color: __stc('#14532d'), on: '#16a34a' },
                              };
                              const getActionStyle = (actionName) => actionColor[actionName.toLowerCase()] || { bg: __sbg('#f1f5f9'), color: __stc('#475569'), on: '#6366f1' };
                              return (
                                <div key={group} style={{ borderBottom: isLastGroup ? 'none' : `1px solid ${__sbg('#e2e8f0')}`, padding: '0' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: allGroupOn ? __sbg('#f5f3ff') : someGroupOn ? __sbg('#fafafa') : __sbg('#fff'), borderBottom: `1px solid ${__sbg('#f1f5f9')}`, gap: 12 }}>
                                    <input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
                                      checked={allGroupOn}
                                      ref={el => { if (el) el.indeterminate = someGroupOn && !allGroupOn; }}
                                      onChange={e => toggleGroup(perms, e.target.checked)} />
                                    <div style={{ minWidth: 160, fontSize: 13, fontWeight: 700, color: __stc('#0f172a'), textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: allGroupOn ? __sbg('#6366f1') : someGroupOn ? __sbg('#a5b4fc') : __sbg('#cbd5e1'), flexShrink: 0 }} />
                                      {group.charAt(0).toUpperCase() + group.slice(1)}
                                      <span style={{ fontSize: 10, fontWeight: 700, color: allGroupOn ? __stc('#4338ca') : __stc('#94a3b8'), background: allGroupOn ? __sbg('#e0e7ff') : __sbg('#f1f5f9'), padding: '1px 7px', borderRadius: 99 }}>{groupCount}/{perms.length}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                                      {perms.map(p => {
                                        const isOn = selectedPermIds.includes(p.id);
                                        const action = label(p.name);
                                        const aStyle = getActionStyle(action);
                                        return (
                                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: isOn ? `1.5px solid ${aStyle.on}` : `1.5px solid ${__sbg('#e2e8f0')}`, background: isOn ? aStyle.bg : __sbg('#f8fafc'), color: isOn ? aStyle.color : __stc('#64748b'), transition: 'all 0.15s', userSelect: 'none' }}
                                            onMouseEnter={e => { if (!isOn) e.currentTarget.style.borderColor = __sbg('#cbd5e1'); }}
                                            onMouseLeave={e => { if (!isOn) e.currentTarget.style.borderColor = __sbg('#e2e8f0'); }}>
                                            <input type="checkbox" checked={isOn} onChange={() => togglePerm(p.id)} style={{ width: 13, height: 13, accentColor: aStyle.on, cursor: 'pointer' }} />
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
                        <span className="rp-menu-count">{menuPerms.filter(m => m.hasPermission).length} of {menuPerms.length} enabled</span>
                      </div>
                      <div className="rp-menu-grid">
                        {menuPerms.map(m => (
                          <div key={m.menuId} className={`rp-menu-card ${m.hasPermission ? "rp-menu-card--on" : ""}`} onClick={() => toggleMenuItem(m.menuId)}>
                            <div className="rp-menu-card__icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                            </div>
                            <span className="rp-menu-card__name">{formatMenuName(m.menuName)}</span>
                            <div className={`rp-toggle ${m.hasPermission ? "rp-toggle--on" : ""}`}><div className="rp-toggle__knob" /></div>
                          </div>
                        ))}
                        {menuPerms.length === 0 && <div className="rp-no-data">No menu items found</div>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* ── Delete Hierarchy Confirmation Modal ── */}
      {deleteHierConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
          <div style={{background:__sbg('#fff'),borderRadius:16,padding:'36px 32px 28px',width:'min(420px,94vw)',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:__sbg('#fff0f0'),border:`1px solid ${__sbg('#fecaca')}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:28}}>🗑️</div>
            <h3 style={{margin:'0 0 10px',fontSize:20,fontWeight:700,color:__stc('#0f172a')}}>Delete Hierarchy Entry</h3>
            <p style={{margin:'0 0 28px',fontSize:14,color:__stc('#64748b'),lineHeight:1.6}}>
              Delete hierarchy entry for <strong>"{deleteHierConfirm}"</strong>?<br/>
              <strong style={{color:__stc('#dc2626')}}>This action cannot be undone.</strong>
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center'}}>
              <button onClick={() => setDeleteHierConfirm(null)} style={{flex:1,padding:'10px 20px',borderRadius:10,border:`1.5px solid ${__sbg('#e2e8f0')}`,background:__sbg('#fff'),fontSize:14,fontWeight:600,color:__stc('#374151'),cursor:'pointer'}}>Cancel</button>
              <button onClick={confirmDeleteHierarchy} style={{flex:1,padding:'10px 20px',borderRadius:10,border:'none',background:__sbg('#dc2626'),fontSize:14,fontWeight:600,color:__stc('#fff'),cursor:'pointer'}}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}