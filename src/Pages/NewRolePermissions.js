import React, { useEffect, useState, useCallback } from "react";
import "../pages-css/NewRolePermissions.css";

const API = process.env.REACT_APP_API_URL;

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="rp-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`rp-toast rp-toast--${t.type}`}>
          <div className="rp-toast__indicator" />
          <span className="rp-toast__msg">{t.message}</span>
          <button className="rp-toast__close" onClick={() => removeToast(t.id)}>x</button>
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewRolePermissions() {
  const { toasts, addToast, removeToast } = useToast();

  const [roles, setRoles]             = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [menuItems, setMenuItems]     = useState([]);

  const [roleName, setRoleName]                           = useState("");
  const [roleDesc, setRoleDesc]                           = useState("");
  const [permName, setPermName]                           = useState("");
  const [permDesc, setPermDesc]                           = useState("");

  const [selectedRoleId, setSelectedRoleId]               = useState("");
  const [selectedPermIds, setSelectedPermIds]             = useState([]);
  const [menuPerms, setMenuPerms]                         = useState([]);
  const [loadingPage, setLoadingPage]                     = useState(false);
  const [loadingMenu, setLoadingMenu]                     = useState(false);
  const [activeTab, setActiveTab]                         = useState("page");
  const [createTab, setCreateTab]                         = useState("role");

  // FIX #5: Role Hierarchy state
  const [hierarchyData, setHierarchyData]                 = useState([]);
  const [hierarchyLoading, setHierarchyLoading]           = useState(false);
  const [hierForm, setHierForm]                           = useState({ roleName:'', levelOrder:4, description:'', canAssignRoles:[], canSeenRoles:[] });
  const [editingHier, setEditingHier]                     = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); loadHierarchy(); }, []); // run once on mount

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

  // FIX #5: hierarchy helpers
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
      // Use PUT for updates (editingHier set), POST for new entries
      const isUpdate = !!editingHier;
      const url = isUpdate
        ? `${API}/role-hierarchy/${encodeURIComponent(editingHier)}`
        : `${API}/role-hierarchy/save`;
      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method, credentials: "include",
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
        method: "DELETE", credentials: "include",
        headers: { "User-Role": "SUPERADMIN" },
      });
      if (res.ok) { addToast("Deleted", "success"); loadHierarchy(); }
      else addToast("Delete failed", "error");
    } catch { addToast("Network error", "error"); }
  };

  const startEditHierarchy = (entry) => {
    const parseList = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
    setEditingHier(entry.roleName);
    setHierForm({
      roleName: entry.roleName,
      levelOrder: entry.levelOrder || 4,
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
      .then(r => r.json())
      .then(data => setSelectedPermIds(data.map(p => p.id)))
      .catch(() => addToast("Failed to load page permissions", "error"))
      .finally(() => setLoadingPage(false));

    fetch(`${API}/menu-permissions/getByRole/${roleId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setMenuPerms(
        (Array.isArray(data) ? data : []).map(m => ({
          menuId: m.menuId, menuName: m.menuName, hasPermission: Boolean(m.hasPermission)
        }))
      ))
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

  return (
    <div className="rp-shell">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

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
            <button
              key={r.id}
              className={`rp-role-item ${String(selectedRoleId) === String(r.id) ? "rp-role-item--active" : ""}`}
              onClick={() => handleRoleChange(r.id)}
            >
              <div className="rp-role-item__avatar">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="rp-role-item__info">
                <span className="rp-role-item__name">{r.name}</span>
                {r.description && <span className="rp-role-item__desc">{r.description}</span>}
              </div>
              {String(selectedRoleId) === String(r.id) && (
                <div className="rp-role-item__dot" />
              )}
            </button>
          ))}
          {roles.length === 0 && (
            <div className="rp-role-empty">No roles yet</div>
          )}
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
            <button
              className={`rp-ctab ${createTab === "role" ? "rp-ctab--active" : ""}`}
              onClick={() => setCreateTab("role")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New Role
            </button>
            <button
              className={`rp-ctab ${createTab === "perm" ? "rp-ctab--active" : ""}`}
              onClick={() => setCreateTab("perm")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              New Permission
            </button>
          </div>

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
        </section>

        {/* ── Permission Panels ── */}
        {!selectedRoleId ? (
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
              <button className={`rp-ptab ${activeTab === "page" ? "rp-ptab--active" : ""}`}
                onClick={() => setActiveTab("page")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Page Permissions
                <span className="rp-ptab__badge">{selectedPermIds.length}</span>
              </button>
              <button className={`rp-ptab ${activeTab === "menu" ? "rp-ptab--active" : ""}`}
                onClick={() => setActiveTab("menu")}>
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

            {/* ── Page Permissions Panel ── */}
            {activeTab === "page" && (
              <div className="rp-panel">
                {loadingPage ? (
                  <div className="rp-loader-wrap">
                    <div className="rp-loader" />
                    <span>Loading permissions...</span>
                  </div>
                ) : (
                  <div className="rp-perm-groups">
                    {Object.entries(grouped).map(([group, perms]) => {
                      const allChecked = perms.every(p => selectedPermIds.includes(p.id));
                      const someChecked = perms.some(p => selectedPermIds.includes(p.id));
                      const count = perms.filter(p => selectedPermIds.includes(p.id)).length;
                      return (
                        <div key={group} className="rp-group">
                          <div className="rp-group__header">
                            <label className="rp-group__master">
                              <input type="checkbox" checked={allChecked}
                                ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                onChange={e => toggleGroup(perms, e.target.checked)} />
                              <span className="rp-group__name">{group}</span>
                            </label>
                            <span className="rp-group__pill">{count}/{perms.length}</span>
                          </div>
                          <div className="rp-group__items">
                            {perms.map(p => (
                              <label key={p.id} className={`rp-perm-chip ${selectedPermIds.includes(p.id) ? "rp-perm-chip--on" : ""}`}>
                                <input type="checkbox" checked={selectedPermIds.includes(p.id)}
                                  onChange={() => togglePerm(p.id)} />
                                <span className="rp-perm-chip__check">
                                  {selectedPermIds.includes(p.id) && (
                                    <svg width="9" height="9" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                                  )}
                                </span>
                                {label(p.name)}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(grouped).length === 0 && (
                      <div className="rp-no-data">No permissions defined yet</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Menu Access Panel ── */}
            {activeTab === "menu" && (
              <div className="rp-panel">
                {loadingMenu ? (
                  <div className="rp-loader-wrap">
                    <div className="rp-loader" />
                    <span>Loading menu items...</span>
                  </div>
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
                          <span className="rp-menu-card__name">{m.menuName}</span>
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

                {/* ── Explanatory header ── */}
                <div style={{ background:'linear-gradient(135deg,#eff6ff,#f0fdf4)', border:'1px solid #bfdbfe', borderRadius:10, padding:'14px 18px', marginBottom:20, display:'flex', gap:12, alignItems:'flex-start' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:1}}>
                    <circle cx="12" cy="12" r="10" stroke="#2563eb" strokeWidth="1.8"/>
                    <path d="M12 8v4m0 4h.01" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1e40af', marginBottom:3 }}>What is Role Hierarchy?</div>
                    <div style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>
                      Role Hierarchy defines <strong>who can manage whom</strong>. For example: SUPERADMIN can create ADMIN users, ADMIN can create SALES_MANAGER users, etc.
                      Set <strong>Level Order</strong> (1 = top of org), choose which roles this role <strong>can assign</strong> (create users for), and which roles it <strong>can see</strong> in the Users page.
                    </div>
                  </div>
                </div>

                {/* ── Split layout: Form left, visual right ── */}
                <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20, marginBottom:24 }}>

                  {/* LEFT: Form card */}
                  <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20, height:'fit-content' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                      <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#0f172a' }}>
                        {editingHier
                          ? <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b', display:'inline-block' }} />
                              Editing: {editingHier}
                            </span>
                          : <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
                              Add New Entry
                            </span>
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
                      {/* Role Name */}
                      <div className="rp-field">
                        <label className="rp-field__label">Role Name *</label>
                        <select className="rp-field__input"
                          value={hierForm.roleName}
                          onChange={e => setHierForm({...hierForm, roleName: e.target.value})}
                          disabled={!!editingHier}>
                          <option value="">-- Select a role --</option>
                          {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                      </div>

                      {/* Level Order */}
                      <div className="rp-field">
                        <label className="rp-field__label">
                          Level Order
                          <span style={{ fontSize:10, color:'#94a3b8', fontWeight:400, marginLeft:5 }}>1=top (SUPERADMIN), 2=ADMIN, 3=MANAGER...</span>
                        </label>
                        <input className="rp-field__input" type="number" min="1" max="20"
                          value={hierForm.levelOrder}
                          onChange={e => setHierForm({...hierForm, levelOrder: Number(e.target.value) || 1})} />
                      </div>

                      {/* Description */}
                      <div className="rp-field">
                        <label className="rp-field__label">Description <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
                        <input className="rp-field__input" placeholder="e.g. Regional sales manager"
                          value={hierForm.description}
                          onChange={e => setHierForm({...hierForm, description: e.target.value})} />
                      </div>

                      {/* Can Assign Roles */}
                      <div>
                        <label className="rp-field__label" style={{ display:'block', marginBottom:6 }}>
                          Can Create Users With Role
                          <span style={{ fontSize:10, color:'#94a3b8', fontWeight:400, marginLeft:5 }}>Which roles can this role assign to new users?</span>
                        </label>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {roles.map(r => {
                            const on = hierForm.canAssignRoles.includes(r.name.toUpperCase());
                            return (
                              <button key={r.id} type="button"
                                style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.12s',
                                  border: on ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                                  background: on ? '#dbeafe' : '#f9fafb',
                                  color: on ? '#1d4ed8' : '#6b7280',
                                }}
                                onClick={() => {
                                  const nm = r.name.toUpperCase();
                                  setHierForm(prev => ({
                                    ...prev,
                                    canAssignRoles: prev.canAssignRoles.includes(nm)
                                      ? prev.canAssignRoles.filter(x => x !== nm)
                                      : [...prev.canAssignRoles, nm]
                                  }));
                                }}>
                                {on && <span style={{ marginRight:3 }}>&#10003;</span>}{r.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Can See Roles */}
                      <div>
                        <label className="rp-field__label" style={{ display:'block', marginBottom:6 }}>
                          Can View Users With Role
                          <span style={{ fontSize:10, color:'#94a3b8', fontWeight:400, marginLeft:5 }}>Which users appear in this role's Users page?</span>
                        </label>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {roles.map(r => {
                            const on = (hierForm.canSeenRoles || []).includes(r.name.toUpperCase());
                            return (
                              <button key={r.id} type="button"
                                style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.12s',
                                  border: on ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
                                  background: on ? '#d1fae5' : '#f9fafb',
                                  color: on ? '#065f46' : '#6b7280',
                                }}
                                onClick={() => {
                                  const nm = r.name.toUpperCase();
                                  setHierForm(prev => ({
                                    ...prev,
                                    canSeenRoles: (prev.canSeenRoles || []).includes(nm)
                                      ? (prev.canSeenRoles || []).filter(x => x !== nm)
                                      : [...(prev.canSeenRoles || []), nm]
                                  }));
                                }}>
                                {on && <span style={{ marginRight:3 }}>&#10003;</span>}{r.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Save button */}
                      <button className="rp-btn-save" style={{ width:'100%', justifyContent:'center', marginTop:4 }}
                        onClick={saveHierarchyEntry}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {editingHier ? 'Update Entry' : 'Save Entry'}
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: Visual chart */}
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
                      {/* Vertical org chart */}
                      <div style={{ display:'flex', flexDirection:'column', gap:0, alignItems:'center' }}>
                        {[...hierarchyData].sort((a,b) => (a.levelOrder||99) - (b.levelOrder||99)).map((entry, idx, arr) => {
                          const parseList = (s) => { try { return JSON.parse(s||'[]'); } catch { return []; } };
                          const levelColors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#0891b2','#be185d'];
                          const c = levelColors[idx % levelColors.length];
                          const isLast = idx === arr.length - 1;
                          const manages = parseList(entry.canAssignRoles);
                          return (
                            <div key={entry.roleName} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                              {/* Node */}
                              <div style={{
                                background:'#fff', border:`2px solid ${c}`, borderRadius:12,
                                padding:'12px 20px', minWidth:200, textAlign:'center',
                                boxShadow:`0 3px 12px ${c}20`, position:'relative',
                              }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:4 }}>
                                  <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:c, padding:'1px 7px', borderRadius:99 }}>Level {entry.levelOrder}</span>
                                </div>
                                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>{entry.roleName}</div>
                                {entry.description && <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>{entry.description}</div>}
                                {manages.length > 0 && (
                                  <div style={{ marginTop:8, fontSize:10, color:c, fontWeight:600 }}>
                                    Creates: {manages.join(' - ')}
                                  </div>
                                )}
                                {/* Edit/Delete inline */}
                                <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4 }}>
                                  <button title="Edit" style={{ width:22, height:22, borderRadius:5, border:'1px solid #e2e8f0', background:'#f8fafc', color:'#6366f1', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}
                                    onClick={() => startEditHierarchy(entry)}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </button>
                                  <button title="Delete" style={{ width:22, height:22, borderRadius:5, border:'1px solid #fee2e2', background:'#fff5f5', color:'#ef4444', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}
                                    onClick={() => deleteHierarchyEntry(entry.roleName)}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </button>
                                </div>
                              </div>
                              {/* Connector arrow down */}
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
        )}
      </main>
    </div>
  );
}