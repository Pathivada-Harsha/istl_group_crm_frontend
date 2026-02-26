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

  useEffect(() => { loadData(); }, []);

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
  const selectedRole = roles.find(r => r.id == selectedRoleId);

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
              className={`rp-role-item ${selectedRoleId == r.id ? "rp-role-item--active" : ""}`}
              onClick={() => handleRoleChange(r.id)}
            >
              <div className="rp-role-item__avatar">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="rp-role-item__info">
                <span className="rp-role-item__name">{r.name}</span>
                {r.description && <span className="rp-role-item__desc">{r.description}</span>}
              </div>
              {selectedRoleId == r.id && (
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
            </div>

            {/* ── Page Permissions Panel ── */}
            {activeTab === "page" && (
              <div className="rp-panel">
                {loadingPage ? (
                  <div className="rp-loader-wrap">
                    <div className="rp-loader" />
                    <span>Loading permissions…</span>
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
                    <span>Loading menu items…</span>
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
          </div>
        )}
      </main>
    </div>
  );
}