import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import "../pages-css/RoleHierarchyPage.css";

const API = process.env.REACT_APP_API_URL;

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  const remove = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, add, remove };
}

function ToastStack({ toasts, remove }) {
  return (
    <div className="rh-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`rh-toast rh-toast--${t.type}`}>
          <span className="rh-toast__dot" />
          <span className="rh-toast__msg">{t.message}</span>
          <button className="rh-toast__close" onClick={() => remove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="rh-overlay" onClick={onCancel}>
      <div className="rh-modal rh-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="rh-modal__header"><h3 className="rh-modal__title">{title}</h3></div>
        <div className="rh-modal__body">{message}</div>
        <div className="rh-modal__actions">
          <button className="rh-btn rh-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="rh-btn rh-btn--danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Role chip picker ──────────────────────────────────────────────────────────
function RolePicker({ label, allRoles, selected, onChange }) {
  const toggle = (r) => onChange(selected.includes(r) ? selected.filter((x) => x !== r) : [...selected, r]);
  return (
    <div className="rh-role-picker">
      <label className="rh-label">{label}</label>
      <div className="rh-chips">
        {allRoles.map((r) => (
          <button key={r} type="button"
            className={`rh-chip ${selected.includes(r) ? "rh-chip--on" : ""}`}
            onClick={() => toggle(r)}>{r}</button>
        ))}
      </div>
    </div>
  );
}

// ── Hierarchy Modal ───────────────────────────────────────────────────────────
function HierarchyModal({ open, entry, allRoles, onSave, onClose }) {
  const isNew = !entry?.roleName;
  const parseList = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
  const [roleName, setRoleName] = useState("");
  const [level, setLevel] = useState(4);
  const [description, setDescription] = useState("");
  const [canAssign, setCanAssign] = useState([]);
  const [canSee, setCanSee] = useState([]);

  useEffect(() => {
    if (open) {
      setRoleName(entry?.roleName || "");
      setLevel(entry?.levelOrder ?? 4);
      setDescription(entry?.description || "");
      setCanAssign(parseList(entry?.canAssignRoles));
      setCanSee(parseList(entry?.canSeeRoles));
    }
  }, [open, entry]);

  if (!open) return null;
  const rolesForPicker = allRoles.filter((r) => r !== roleName);

  return (
    <div className="rh-overlay" onClick={onClose}>
      <div className="rh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rh-modal__header">
          <h3 className="rh-modal__title">{isNew ? "Add Role Hierarchy" : `Edit — ${entry.roleName}`}</h3>
          <button className="rh-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="rh-modal__body rh-form-grid">
          <div className="rh-form-group">
            <label className="rh-label">Role Name *</label>
            <input className="rh-input" value={roleName} onChange={(e) => setRoleName(e.target.value.toUpperCase())}
              disabled={!isNew} placeholder="e.g. BD_MANAGER" />
            {isNew && <span className="rh-hint">Must match role string in users table exactly</span>}
          </div>
          <div className="rh-form-group">
            <label className="rh-label">Level Order *</label>
            <input className="rh-input" type="number" min={1} max={99} value={level} onChange={(e) => setLevel(e.target.value)} />
            <span className="rh-hint">1 = top (SUPERADMIN). Higher = lower in chain.</span>
          </div>
          <div className="rh-form-group rh-form-group--full">
            <label className="rh-label">Description</label>
            <input className="rh-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
          </div>
          <div className="rh-form-group rh-form-group--full">
            <RolePicker label="Can assign follow-ups to" allRoles={rolesForPicker} selected={canAssign} onChange={setCanAssign} />
            <span className="rh-hint">Empty = can only assign to self. Mid-levels with a team set will only see users in their own team.</span>
          </div>
          <div className="rh-form-group rh-form-group--full">
            <RolePicker label="Can see users with role" allRoles={rolesForPicker} selected={canSee} onChange={setCanSee} />
            <span className="rh-hint">Roles visible to this user on the Users page.</span>
          </div>
        </div>
        <div className="rh-modal__actions">
          <button className="rh-btn rh-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="rh-btn rh-btn--primary" disabled={!roleName.trim()}
            onClick={() => onSave({ roleName: roleName.trim().toUpperCase(), levelOrder: Number(level), description: description.trim(), canAssignRoles: JSON.stringify(canAssign), canSeeRoles: JSON.stringify(canSee) })}>
            {isNew ? "Add" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Team Modal ────────────────────────────────────────────────────────────────
function TeamModal({ open, team, allUsers, onSave, onClose }) {
  const isNew = !team?.id;
  const [name, setName] = useState("");
  const [description, setDesc] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setName(team?.name || "");
      setDesc(team?.description || "");
      setMemberIds((team?.memberIds || []).map(Number));
      setSearch("");
    }
  }, [open, team]);

  if (!open) return null;

  const toggle = (id) => setMemberIds((p) => p.includes(id) ? p.filter((m) => m !== id) : [...p, id]);
  const filtered = allUsers.filter((u) =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.role || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rh-overlay" onClick={onClose}>
      <div className="rh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rh-modal__header">
          <h3 className="rh-modal__title">{isNew ? "Create Team" : `Edit — ${team.name}`}</h3>
          <button className="rh-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="rh-modal__body rh-form-grid">
          <div className="rh-form-group rh-form-group--full">
            <label className="rh-label">Team Name *</label>
            <input className="rh-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Team A, BD North" />
          </div>
          <div className="rh-form-group rh-form-group--full">
            <label className="rh-label">Description</label>
            <textarea className="rh-textarea" value={description} onChange={(e) => setDesc(e.target.value)} placeholder="What does this team work on?" />
          </div>
          <div className="rh-form-group rh-form-group--full">
            <label className="rh-label">Members <span style={{ color: "#6b7280", fontWeight: 400 }}>({memberIds.length} selected)</span></label>
            <input className="rh-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." style={{ marginBottom: 8 }} />
            <div className="rh-member-picker">
              {allUsers.length === 0 && <div style={{ padding: 12, color: "#9ca3af", fontSize: 13 }}>Loading users…</div>}
              {allUsers.length > 0 && filtered.length === 0 && <div style={{ padding: 12, color: "#9ca3af", fontSize: 13 }}>No users match</div>}
              {filtered.map((u) => {
                const uid = Number(u.id);
                return (
                  <label key={uid} className="rh-member-item">
                    <input type="checkbox" checked={memberIds.includes(uid)} onChange={() => toggle(uid)} />
                    <span className="rh-member-item__name">{u.name}</span>
                    <span className="rh-member-item__role">{u.role}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="rh-modal__actions">
          <button className="rh-btn rh-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="rh-btn rh-btn--primary" disabled={!name.trim()}
            onClick={() => onSave({ id: team?.id, name: name.trim(), description: description.trim(), memberIds })}>
            {isNew ? "Create Team" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Level badge ───────────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const colors = { 1: "purple", 2: "blue", 3: "teal", 4: "amber" };
  return <span className={`rh-badge rh-badge--${colors[level] || "gray"}`}>L{level}</span>;
}

// ── Visual Hierarchy Chart (Teams as grouping) ────────────────────────────────
function HierarchyVisual({ hierarchies, teams }) {
  const parseList = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

  const levelColors = {
    1: { bg: "#ede9fe", border: "#5b21b6", text: "#5b21b6" },
    2: { bg: "#dbeafe", border: "#1e40af", text: "#1e40af" },
    3: { bg: "#ccfbf1", border: "#0f766e", text: "#0f766e" },
    4: { bg: "#fef3c7", border: "#92400e", text: "#92400e" },
  };

  // Group hierarchies by level
  const byLevel = {};
  hierarchies.forEach((h) => {
    const l = h.levelOrder || 99;
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(h);
  });
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  return (
    <div>
      {/* Hierarchy flow */}
      <div style={{ overflowX: "auto", padding: "20px 0" }}>
        {levels.map((level, li) => {
          const c = levelColors[level] || levelColors[4];
          return (
            <div key={level}>
              {/* Level row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 28, textAlign: "right", flexShrink: 0 }}>L{level}</div>
                <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingLeft: 40, marginBottom: 8 }}>
                {byLevel[level].map((h) => {
                  const assignRoles = parseList(h.canAssignRoles);
                  const seeRoles    = parseList(h.canSeeRoles);
                  // Find which teams contain members with this role
                  const teamsForRole = teams.filter((t) =>
                    (t.members || []).some((m) => m.role === h.roleName)
                  );
                  return (
                    <div key={h.roleName} style={{
                      background: c.bg, border: `1.5px solid ${c.border}40`,
                      borderLeft: `4px solid ${c.border}`,
                      borderRadius: 10, padding: "12px 16px",
                      minWidth: 200, maxWidth: 280,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }}>
                      {/* Role name */}
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.text, marginBottom: 4 }}>{h.roleName}</div>
                      {h.description && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{h.description}</div>}

                      {/* Can assign to */}
                      {assignRoles.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Assigns to</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {assignRoles.map((r) => (
                              <span key={r} style={{ padding: "1px 7px", borderRadius: 99, background: "#dbeafe", color: "#1e40af", fontSize: 11, border: "1px solid #bfdbfe" }}>{r}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {assignRoles.length === 0 && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Self-assign only</div>
                      )}

                      {/* Teams this role appears in */}
                      {teamsForRole.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Teams</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {teamsForRole.map((t) => (
                              <span key={t.id} style={{ padding: "1px 7px", borderRadius: 99, background: "#f3e8ff", color: "#6b21a8", fontSize: 11, border: "1px solid #e9d5ff" }}>{t.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Arrow connector between levels */}
              {li < levels.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", paddingLeft: 40, marginBottom: 8, color: "#9ca3af", fontSize: 18 }}>↓</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Teams grid — shows which team has which roles */}
      {teams.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Teams & Members</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {teams.map((t) => {
              const members = t.members || [];
              // Group members by role
              const byRole = {};
              members.forEach((m) => {
                if (!byRole[m.role]) byRole[m.role] = [];
                byRole[m.role].push(m.name);
              });
              return (
                <div key={t.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6b21a8", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{t.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{members.length} member{members.length !== 1 ? "s" : ""}</span>
                  </div>
                  {t.description && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{t.description}</div>}
                  {Object.entries(byRole).map(([role, names]) => {
                    const level = hierarchies.find((h) => h.roleName === role)?.levelOrder;
                    const c = levelColors[level] || levelColors[4];
                    return (
                      <div key={role} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: c.text, marginBottom: 3, textTransform: "uppercase" }}>{role}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {names.map((name) => (
                            <span key={name} style={{ padding: "2px 8px", borderRadius: 99, background: c.bg, color: c.text, fontSize: 11, border: `1px solid ${c.border}40` }}>{name}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {members.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>No members yet</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function RoleHierarchyPage() {
  const { user } = useAuth();
  const { toasts, add: addToast, remove } = useToast();

  const [activeTab, setActiveTab] = useState("hierarchy");

  // Hierarchy state
  const [hierarchies, setHierarchies]   = useState([]);
  const [allRoleNames, setAllRoleNames] = useState([]);
  const [hierLoading, setHierLoading]   = useState(false);
  const [hierModal, setHierModal]       = useState(false);
  const [editEntry, setEditEntry]       = useState(null);
  const [deleteHierTarget, setDeleteHierTarget] = useState(null);

  // Teams state
  const [teams, setTeams]               = useState([]);
  const [allUsers, setAllUsers]         = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamModal, setTeamModal]       = useState(false);
  const [editTeam, setEditTeam]         = useState(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState(null);

  const isSuperAdmin = user?.role?.toUpperCase() === "SUPERADMIN";

  const authHeaders = {
    "Content-Type": "application/json",
    "User-Id": user?.id,
    "User-Role": user?.role,
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadHierarchyData = useCallback(async () => {
    setHierLoading(true);
    try {
      const [hierRes, rolesRes] = await Promise.all([
        fetch(`${API}/role-hierarchy/all`, { credentials: "include", headers: authHeaders }),
        fetch(`${API}/roles/getAllRoles`,   { credentials: "include" }),
      ]);
      const hierData  = await hierRes.json();
      const rolesData = await rolesRes.json();
      setHierarchies(Array.isArray(hierData) ? hierData : []);
      setAllRoleNames(Array.isArray(rolesData) ? rolesData.map((r) => r.name) : []);
    } catch { addToast("Failed to load hierarchy data", "error"); }
    finally { setHierLoading(false); }
  }, []); // eslint-disable-line

  const loadTeamsData = useCallback(async () => {
    if (!user?.id) return;
    setTeamsLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        fetch(`${API}/teams/all`, { credentials: "include", headers: authHeaders }),
        fetch(`${API}/users/search/${user.id}?searchTerm=&role=all&page=1&size=500`, { credentials: "include" }),
      ]);
      if (teamsRes.ok) { const d = await teamsRes.json(); setTeams(Array.isArray(d) ? d : []); }
      else setTeams([]);
      if (usersRes.ok) {
        const d = await usersRes.json();
        setAllUsers((d.userWrapper || []).map((u) => ({ id: Number(u.id), name: u.name || u.user_id, role: u.role || "" })));
      }
    } catch { setTeams([]); }
    finally { setTeamsLoading(false); }
  }, [user?.id]); // eslint-disable-line

  useEffect(() => { loadHierarchyData(); loadTeamsData(); }, [loadHierarchyData, loadTeamsData]);

  // ── Hierarchy CRUD ────────────────────────────────────────────────────────
  const handleSaveHierarchy = async (data) => {
    try {
      const isNew = !hierarchies.find((h) => h.roleName === data.roleName);
      const res = await fetch(
        isNew ? `${API}/role-hierarchy/save` : `${API}/role-hierarchy/${data.roleName}`,
        { method: isNew ? "POST" : "PUT", credentials: "include", headers: authHeaders, body: JSON.stringify(data) }
      );
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Save failed"); }
      addToast(isNew ? "Added" : "Updated", "success");
      setHierModal(false); loadHierarchyData();
    } catch (e) { addToast(e.message, "error"); }
  };

  const handleDeleteHierarchy = async () => {
    try {
      const res = await fetch(`${API}/role-hierarchy/${deleteHierTarget}`, { method: "DELETE", credentials: "include", headers: authHeaders });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Delete failed"); }
      addToast("Deleted", "success"); setDeleteHierTarget(null); loadHierarchyData();
    } catch (e) { addToast(e.message, "error"); }
  };

  // ── Teams CRUD ────────────────────────────────────────────────────────────
  const handleSaveTeam = async (data) => {
    try {
      const isEdit = !!data.id;
      const res = await fetch(
        isEdit ? `${API}/teams/${data.id}` : `${API}/teams/create`,
        { method: isEdit ? "PUT" : "POST", credentials: "include", headers: authHeaders, body: JSON.stringify(data) }
      );
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Save failed"); }
      await loadTeamsData();
      addToast(isEdit ? "Team updated" : "Team created", "success");
      setTeamModal(false);
    } catch (e) { addToast(e.message || "Failed to save team", "error"); }
  };

  const handleDeleteTeam = async () => {
    const id = deleteTeamTarget;
    try { await fetch(`${API}/teams/${id}`, { method: "DELETE", credentials: "include", headers: authHeaders }); }
    catch { /* remove locally anyway */ }
    setDeleteTeamTarget(null); await loadTeamsData(); addToast("Team deleted", "success");
  };

  const parseList = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="rh-page">
      <ToastStack toasts={toasts} remove={remove} />
      <ConfirmModal open={!!deleteHierTarget} title="Delete hierarchy entry?"
        message={`Remove all rules for "${deleteHierTarget}"?`}
        onConfirm={handleDeleteHierarchy} onCancel={() => setDeleteHierTarget(null)} />
      <ConfirmModal open={!!deleteTeamTarget} title="Delete team?"
        message="Members will not be deleted — only the team record and their team field will be cleared."
        onConfirm={handleDeleteTeam} onCancel={() => setDeleteTeamTarget(null)} />
      <HierarchyModal open={hierModal} entry={editEntry} allRoles={allRoleNames}
        onSave={handleSaveHierarchy} onClose={() => setHierModal(false)} />
      <TeamModal open={teamModal} team={editTeam} allUsers={allUsers}
        onSave={handleSaveTeam} onClose={() => setTeamModal(false)} />

      {/* Page header */}
      <div className="rh-header">
        <div>
          <h1 className="rh-title">Role Hierarchy & Teams</h1>
          <p className="rh-subtitle">Define who can see and assign to whom. Teams scope the assign-to dropdown to same-team members only.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rh-tabs">
        <button className={`rh-tab ${activeTab === "hierarchy" ? "rh-tab--active" : ""}`} onClick={() => setActiveTab("hierarchy")}>Role Hierarchy</button>
        <button className={`rh-tab ${activeTab === "visual" ? "rh-tab--active" : ""}`} onClick={() => setActiveTab("visual")}>Visual Chart</button>
        <button className={`rh-tab ${activeTab === "teams" ? "rh-tab--active" : ""}`} onClick={() => setActiveTab("teams")}>Teams</button>
      </div>

      {/* ── HIERARCHY TABLE TAB ───────────────────────────────────────────── */}
      {activeTab === "hierarchy" && (
        <>
          <div className="rh-tab-header">
            <h2>Role Hierarchy Rules</h2>
            {isSuperAdmin && (
              <button className="rh-btn rh-btn--primary" onClick={() => { setEditEntry(null); setHierModal(true); }}>+ Add Entry</button>
            )}
          </div>
          {!isSuperAdmin && <div className="rh-info-banner">Read-only — only SUPERADMIN can make changes.</div>}
          <div className="rh-card">
            {hierLoading ? <div className="rh-empty">Loading…</div> :
              hierarchies.length === 0 ? <div className="rh-empty">No hierarchy entries yet.</div> : (
                <table className="rh-table">
                  <thead>
                    <tr>
                      <th>Level</th><th>Role Name</th><th>Description</th>
                      <th>Can assign to</th><th>Can see users with role</th>
                      {isSuperAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {hierarchies.map((h) => {
                      const assignRoles = parseList(h.canAssignRoles);
                      const seeRoles    = parseList(h.canSeeRoles);
                      return (
                        <tr key={h.roleName}>
                          <td><LevelBadge level={h.levelOrder} /></td>
                          <td className="rh-role-name">{h.roleName}</td>
                          <td className="rh-desc">{h.description || "—"}</td>
                          <td>{assignRoles.length === 0 ? <span className="rh-muted">Self only</span> : assignRoles.map((r) => <span key={r} className="rh-tag">{r}</span>)}</td>
                          <td>{seeRoles.length === 0 ? <span className="rh-muted">None</span> : seeRoles.map((r) => <span key={r} className="rh-tag rh-tag--see">{r}</span>)}</td>
                          {isSuperAdmin && (
                            <td className="rh-actions">
                              <button className="rh-icon-btn rh-icon-btn--edit" onClick={() => { setEditEntry(h); setHierModal(true); }}>✎</button>
                              <button className="rh-icon-btn rh-icon-btn--del" onClick={() => setDeleteHierTarget(h.roleName)}>✕</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <div className="rh-info-card">
            <h4 className="rh-info-card__title">How this works</h4>
            <ul className="rh-info-card__list">
              <li><strong>Can assign to</strong> — roles shown in the "Assign To" dropdown when creating a follow-up, task, or lead assignment.</li>
              <li><strong>Team scoping</strong> — if the logged-in user belongs to a team, only users with those roles AND in the same team will appear in the dropdown.</li>
              <li><strong>Can see users</strong> — roles visible on the Users management page for this role.</li>
              <li>Levels 1–2 (SUPERADMIN / ADMIN) always see all users and all assignment options.</li>
            </ul>
          </div>
        </>
      )}

      {/* ── VISUAL CHART TAB ─────────────────────────────────────────────── */}
      {activeTab === "visual" && (
        <>
          <div className="rh-tab-header">
            <h2>Hierarchy & Teams Visual</h2>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Roles flow top-to-bottom · Teams show membership by role</span>
          </div>
          {hierLoading || teamsLoading ? <div className="rh-empty">Loading…</div> :
            <HierarchyVisual hierarchies={hierarchies} teams={teams} />
          }
        </>
      )}

      {/* ── TEAMS TABLE TAB ───────────────────────────────────────────────── */}
      {activeTab === "teams" && (
        <>
          <div className="rh-tab-header">
            <h2>Teams</h2>
            <button className="rh-btn rh-btn--primary" onClick={() => { setEditTeam(null); setTeamModal(true); }}>+ Create Team</button>
          </div>
          <div className="rh-card">
            {teamsLoading ? <div className="rh-empty">Loading…</div> :
              teams.length === 0 ? <div className="rh-empty">No teams yet. Create a team to group users — members' user records are updated automatically.</div> : (
                <table className="rh-table">
                  <thead><tr><th>Team Name</th><th>Description</th><th>Members</th><th>Actions</th></tr></thead>
                  <tbody>
                    {teams.map((t) => {
                      const members = t.members || [];
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</td>
                          <td className="rh-desc">{t.description || "—"}</td>
                          <td>
                            {members.length === 0 ? <span className="rh-muted">No members</span> : (
                              <div className="rh-avatar-row">
                                {members.slice(0, 5).map((m) => (
                                  <div key={m.id} className="rh-avatar" title={`${m.name} (${m.role})`}>
                                    <div className="rh-avatar__dot">{(m.name || "?").charAt(0).toUpperCase()}</div>
                                    {m.name}
                                  </div>
                                ))}
                                {members.length > 5 && <span className="rh-muted" style={{ fontSize: 12 }}>+{members.length - 5} more</span>}
                              </div>
                            )}
                          </td>
                          <td className="rh-actions">
                            <button className="rh-icon-btn rh-icon-btn--edit" onClick={() => { setEditTeam(t); setTeamModal(true); }}>✎</button>
                            <button className="rh-icon-btn rh-icon-btn--del" onClick={() => setDeleteTeamTarget(t.id)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          <div className="rh-info-card">
            <h4 className="rh-info-card__title">How teams work</h4>
            <ul className="rh-info-card__list">
              <li>Saving a team sets the <strong>team</strong> field on each member's user record automatically.</li>
              <li>Removing a member clears their team field. Deleting a team clears it for all members.</li>
              <li>When a mid-level user (e.g. BD_MANAGER) is in a team, their follow-up "Assign To" dropdown only shows users with allowed roles who are <strong>in the same team</strong>.</li>
              <li>Teams are visible in the Hierarchy → Visual Chart tab combined view.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}