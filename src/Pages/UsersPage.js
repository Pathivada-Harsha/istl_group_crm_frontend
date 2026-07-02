import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiEdit, FiTrash2, FiEye, FiEyeOff, FiX, FiSearch, FiRefreshCw, FiUsers, FiAlertCircle, FiGrid, FiUserPlus, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import '../pages-css/UsersPage.css';
import CrmPreloader from '../components/preLoader';
import FilterSelect from '../components/Dropdowns/FilterSelect';

/* Inline-style theme mappers (dark mode) */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#f8fafb':'#0f1420','#fcfcfd':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f1f1':'#232b3b','#f0f0f0':'#232b3b','#e9eef5':'#2b3445','#eef2f7':'#18202e',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#f0f9ff':'#15243d','#f0f4ff':'#1a2440','#eef2ff':'#1e1f45','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a','#bae6fd':'#16344d','#e0f2fe':'#16344d','#e0e7ff':'#1e2547','#93c5fd':'#2f5d92',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40','#bbf7d0':'#2a5a40','#86efac':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#fecdd3':'#3a1f26','#fff5f5':'#2b1d20','#fff1f2':'#2b1d20','#fff7ed':'#2c2113','#fffbeb':'#2a2710','#fffdf0':'#2a2710','#fef9c3':'#3a3016','#fef3c7':'#3a3016','#fde68a':'#5a4714','#fef08a':'#5a4714','#fcd34d':'#5a4714','#fca5a5':'#5a2a2e',
  '#f5f3ff':'#241b3d','#faf5ff':'#241b3d','#f3e8ff':'#2e2147','#fdf4ff':'#2e2147','#94a3b8':'#3a4456','#ede9fe':'#2a2147','#ddd6fe':'#2e2147','#e9d5ff':'#2e2147','#ecfeff':'#103038','#fce7f3':'#3a1f30',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#cbd5e0':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6','#0b1220':'#e7ecf3',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#14532d':'#6ee7b7','#6b21a8':'#c4b5fd','#7e22ce':'#c4b5fd','#854d0e':'#f0c07a','#9a3412':'#fb923c','#1e1b4b':'#a5b4fc','#0ea5e9':'#38bdf8','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
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

// Toast 
const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);
  const icons = { success: '\u2713', error: '\u2715', warning: '!', notification: 'i' };
  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-header">
        <span className="toast-icon">{icons[type] || '\u2713'}</span>
        <strong className="toast-title">{type.charAt(0).toUpperCase() + type.slice(1)}</strong>
        <button className="toast-close" onClick={onClose}><FiX size={14} /></button>
      </div>
      <div className="toast-body">{message}</div>
    </div>
  );
};

//  Confirm Modal 
const ConfirmModal = ({ isOpen, onClose, onConfirm, title = "Confirm Action",
  message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", type = "danger" }) => {
  useThemeVersion();
  if (!isOpen) return null;
  const icons = { danger: '!', warning: '\u2713', info: 'i' };
  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-modal-icon confirm-modal-icon-${type}`}><span>{icons[type] || '!'}</span></div>
        <h2 className="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-message">{message}</p>
        <p className="confirm-modal-warning">This action cannot be undone.</p>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn confirm-modal-btn-cancel" onClick={onClose}>{cancelText}</button>
          <button className={`confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-${type}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

//  Hierarchy Chart Component 
//  Role palette 
const ROLE_STYLE = {
  SUPERADMIN: { bg: '#f5f3ff', border: '#7c3aed', text: '#5b21b6', badge: '#7c3aed' },
  ADMIN: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', badge: '#3b82f6' },
  BD_MANAGER: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', badge: '#10b981' },
  SALES_MANAGER: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', badge: '#10b981' },
  BD_EXECUTIVE: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' },
  SALES_EXEC: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' },
  TELECALLER: { bg: '#f8fafc', border: '#94a3b8', text: '#334155', badge: '#94a3b8' },
};
const ROLE_ORDER = ['SUPERADMIN', 'ADMIN', 'BD_MANAGER', 'SALES_MANAGER', 'BD_EXECUTIVE', 'SALES_EXEC', 'TELECALLER'];

// Resolve theme at call time (called inside render) so cards react to dark/light.
function getRoleStyle(role) {
  const key = (role || '').toUpperCase().replace(/\s+/g, '_');
  const r = ROLE_STYLE[key] || { bg: '#f8fafc', border: '#94a3b8', text: '#334155', badge: '#94a3b8' };
  return { bg: __sbg(r.bg), border: __sbg(r.border), text: __stc(r.text), badge: r.badge };
}

//  Tree node card 
function TreeNode({ node, isLast, isRoot }) {
  useThemeVersion();
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const s = getRoleStyle(node.role_name);
  const name = node.full_name || node.username || '?';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/*  Card  */}
      <div
        onClick={() => hasChildren && setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: s.bg,
          border: `2px solid ${s.border}`,
          borderRadius: 12,
          padding: '10px 16px',
          minWidth: 180, maxWidth: 220,
          cursor: hasChildren ? 'pointer' : 'default',
          boxShadow: isRoot
            ? `0 4px 14px ${s.border}30`
            : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.2s, transform 0.15s',
          position: 'relative',
          userSelect: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 18px ${s.border}35`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isRoot ? `0 4px 14px ${s.border}30` : '0 2px 8px rgba(0,0,0,0.08)'; }}
      >
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: s.badge, color: __stc('#fff'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, flexShrink: 0,
          boxShadow: `0 2px 6px ${s.badge}55`,
        }}>
          {initial}
        </div>

        {/* Info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: __stc('#0f172a'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          {/* FIX #7: show designation if set, else fall back to role_name */}
          <div style={{ fontSize: 10, fontWeight: 600, color: s.text, marginTop: 1, letterSpacing: '0.03em' }}>
            {node.designation || node.role_name}
          </div>
          {node.designation && (
            <div style={{ fontSize: 9, color: s.text, opacity: 0.7, marginTop: 1 }}>
              {node.role_name}
            </div>
          )}
          {node.team && (
            <div style={{ fontSize: 9, color: __stc('#94a3b8'), marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>&#9632;</span>{node.team}
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        {hasChildren && (
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: s.border, color: __stc('#fff'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, flexShrink: 0,
          }}>
            {collapsed ? '+' : '\u2713'}
          </div>
        )}
      </div>

      {/*  Children  */}
      {hasChildren && !collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* stem down from parent */}
          <div style={{ width: 2, height: 28, background: __sbg('#cbd5e1') }} />

          {/* horizontal branch */}
          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            {node.children.map((child, idx) => {
              const isFirst = idx === 0;
              const isLastChild = idx === node.children.length - 1;
              const single = node.children.length === 1;
              return (
                <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {/* horizontal arm */}
                  {!single && (
                    <div style={{
                      position: 'absolute', top: 0,
                      left: isFirst ? '50%' : 0,
                      right: isLastChild ? '50%' : 0,
                      height: 2, background: __sbg('#cbd5e1'),
                    }} />
                  )}
                  {/* vertical stem down to child */}
                  <div style={{ width: 2, height: 24, background: __sbg('#cbd5e1') }} />
                  <div style={{ paddingLeft: 12, paddingRight: 12 }}>
                    <TreeNode node={child} isRoot={false} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

//  Main HierarchyChart 
// ── Teams View for Hierarchy ─────────────────────────────────────────────────
function TeamsView({ teams }) {
  useThemeVersion();
  if (!teams || teams.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: __stc('#94a3b8') }}>
        <FiUsers size={48} style={{ margin: '0 auto 12px', display: 'block', color: __stc('#cbd5e1') }} />
        <div style={{ fontWeight: 600, color: __stc('#374151') }}>No teams found</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Go to Teams tab to create teams first</div>
      </div>
    );
  }
  const teamColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
  return (
    <div style={{ padding: '32px 24px 40px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center', minWidth: 'max-content' }}>
        {teams.map((team, idx) => {
          const color = teamColors[idx % teamColors.length];
          const members = team.members || [];
          return (
            <div key={team.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Team bubble */}
              <div style={{
                background: `${color}15`, border: `2px solid ${color}`,
                borderRadius: 14, padding: '14px 20px', textAlign: 'center',
                boxShadow: `0 3px 12px ${color}25`, minWidth: 160,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, color: __stc('#fff'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 800, fontSize: 16 }}>
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: __stc('#0f172a') }}>{team.name}</div>
                <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 3 }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
                {team.description && <div style={{ fontSize: 10, color: __stc('#94a3b8'), marginTop: 4, maxWidth: 140 }}>{team.description}</div>}
              </div>
              {/* Connector line */}
              {members.length > 0 && <div style={{ width: 2, height: 20, background: __sbg('#cbd5e1') }} />}
              {/* Members */}
              {members.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 320 }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `hsl(${(m.id * 47) % 360},55%,62%)`, color: __stc('#fff'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.12)', border: `2px solid ${__sbg('#fff')}` }}>
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: __stc('#374151'), textAlign: 'center', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: color, fontWeight: 500, textAlign: 'center', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.role}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 14px', background: __sbg('#fff'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 10 }}>
        <span style={{ fontSize: 11, color: __stc('#94a3b8'), fontWeight: 600, marginRight: 4, alignSelf: 'center' }}>TEAMS</span>
        {teams.map((team, idx) => {
          const color = teamColors[idx % teamColors.length];
          return (
            <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: `${color}10`, border: `1.5px solid ${color}40` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: color }}>{team.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HierarchySection (wraps Org Chart + Teams View with toggle) ───────────────
function HierarchySection({ users, teams, loading, onRefresh }) {
  useThemeVersion();
  const [viewMode, setViewMode] = React.useState('org');

  React.useEffect(() => {
    if (users.length === 0 && !loading) onRefresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* Toggle + Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, background: __sbg('#f1f5f9'), borderRadius: 8, padding: 3 }}>
          {[
            { key: 'org', label: 'Org Chart', icon: <FiGrid size={14} /> },
            { key: 'teams', label: 'Teams View', icon: <FiUsers size={14} /> },
          ].map(btn => (
            <button key={btn.key} onClick={() => setViewMode(btn.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                background: viewMode === btn.key ? __sbg('#fff') : __sbg('transparent'),
                color: viewMode === btn.key ? __stc('#4f46e5') : __stc('#6b7280'),
                boxShadow: viewMode === btn.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
        <button onClick={onRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${__sbg('#e2e8f0')}`, background: __sbg('#fff'), cursor: 'pointer', color: __stc('#374151'), fontWeight: 500 }}>
          <FiRefreshCw size={13} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: __stc('#94a3b8') }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${__sbg('#e2e8f0')}`, borderTopColor: `${__sbg('#6366f1')}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading...
        </div>
      ) : viewMode === 'org' ? (
        <HierarchyChart users={users} />
      ) : (
        <div style={{ background: `linear-gradient(135deg,${__sbg('#f8fafc')} 0%,${__sbg('#f1f5f9')} 100%)`, borderRadius: 16, border: `1px solid ${__sbg('#e2e8f0')}`, minHeight: 200 }}>
          <TeamsView teams={teams} />
        </div>
      )}
    </div>
  );
}

function HierarchyChart({ users }) {
  useThemeVersion();

  //  Build tree from managerId, fallback to role-level grouping 
  const buildTree = () => {
    if (!users || users.length === 0) return [];
    const map = {};
    users.forEach(u => { map[u.id] = { ...u, children: [] }; });

    // Check if any manager relationships exist
    const hasManagerLinks = users.some(u => u.managerId && map[u.managerId]);

    if (hasManagerLinks) {
      // Real org-chart from managerId
      const roots = [];
      users.forEach(u => {
        if (u.managerId && map[u.managerId]) {
          map[u.managerId].children.push(map[u.id]);
        } else {
          roots.push(map[u.id]);
        }
      });
      // Sort children by role order
      const sortNode = n => {
        n.children.sort((a, b) => {
          const ai = ROLE_ORDER.indexOf((a.role_name || '').toUpperCase());
          const bi = ROLE_ORDER.indexOf((b.role_name || '').toUpperCase());
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        n.children.forEach(sortNode);
      };
      roots.forEach(sortNode);
      return roots;
    }

    // Fallback: build role-level tree (group by role order)
    // Creates virtual group nodes for each role level
    const roleGroups = {};
    ROLE_ORDER.forEach(r => { roleGroups[r] = []; });
    users.forEach(u => {
      const key = (u.role_name || '').toUpperCase().replace(/\s+/g, '_');
      if (roleGroups[key]) roleGroups[key].push(map[u.id]);
      else {
        if (!roleGroups['OTHER']) roleGroups['OTHER'] = [];
        roleGroups['OTHER'].push(map[u.id]);
      }
    });

    // Build virtual parent-child by role level
    const nonEmpty = ROLE_ORDER.filter(r => roleGroups[r].length > 0);
    if (nonEmpty.length === 0) return Object.values(map);

    // Nest: each level's users become children of the previous level's users
    // Simple approach: top level = first role group, etc.
    const buildRoleTree = (levels, idx) => {
      if (idx >= levels.length) return [];
      const currentNodes = [...roleGroups[levels[idx]]];
      const childNodes = buildRoleTree(levels, idx + 1);

      if (childNodes.length === 0) return currentNodes;
      if (currentNodes.length === 0) return childNodes;

      // Distribute children evenly among parents at this level
      if (currentNodes.length === 1) {
        currentNodes[0].children = childNodes;
      } else {
        // Assign each child to the parent with matching managerId, else first parent
        const unassigned = [];
        childNodes.forEach(child => {
          const parent = currentNodes.find(p => child.managerId && p.id === child.managerId);
          if (parent) parent.children.push(child);
          else unassigned.push(child);
        });
        // Spread unassigned evenly
        unassigned.forEach((child, i) => {
          currentNodes[i % currentNodes.length].children.push(child);
        });
      }
      return currentNodes;
    };

    return buildRoleTree(nonEmpty, 0);
  };

  const tree = buildTree();
  const hasManagerLinks = users.some(u => u.managerId);

  if (users.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: __stc('#94a3b8') }}>
        <FiUsers size={48} style={{ margin: '0 auto 12px', display: 'block', color: __stc('#cbd5e1') }} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>No users to display</div>
      </div>
    );
  }

  return (
    <div>
      {/* Info banner when no manager links */}
      {!hasManagerLinks && (
        <div style={{
          background: __sbg('#fef9c3'), border: `1px solid ${__sbg('#fde047')}`, borderRadius: 8,
          padding: '10px 16px', fontSize: 13, color: __stc('#854d0e'),
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <FiAlertCircle size={16} style={{ flexShrink: 0, color: __stc('#ca8a04') }} />
          <span>No "Reports To" manager assignments found  showing role-level grouping. Set managers via Edit User to see the real org chart.</span>
        </div>
      )}

      {/* Tree */}
      <div style={{
        overflowX: 'auto', overflowY: 'visible',
        padding: '32px 24px 40px',
        background: `linear-gradient(135deg, ${__sbg('#f8fafc')} 0%, ${__sbg('#f1f5f9')} 100%)`,
        borderRadius: 16, border: `1px solid ${__sbg('#e2e8f0')}`,
        minHeight: 200,
      }}>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'nowrap', minWidth: 'max-content' }}>
          {tree.map(root => (
            <TreeNode key={root.id} node={root} isRoot={true} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8,
        padding: '12px 16px', background: __sbg('#fff'),
        border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 10,
      }}>
        <span style={{ fontSize: 11, color: __stc('#94a3b8'), fontWeight: 600, marginRight: 4, alignSelf: 'center' }}>ROLES</span>
        {ROLE_ORDER.map(role => {
          const s = ROLE_STYLE[role];
          const hasUsers = users.some(u => (u.role_name || '').toUpperCase().replace(/\s+/g, '_') === role);
          if (!hasUsers) return null;
          return (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: s.bg, border: `1.5px solid ${s.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.badge }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: s.text }}>{role}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


const formatDateTime = (dateString) => {
  const d = new Date(dateString);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const transformUser = (apiUser) => ({
  id: apiUser.id,
  username: apiUser.user_id,
  email: apiUser.email,
  full_name: apiUser.name,
  phone: apiUser.phone,
  is_active: apiUser.is_active === 1,
  role_id: apiUser.role,
  role_name: apiUser.role,
  //  FIX #1: hierarchy + designation fields from API 
  managerId: apiUser.managerId || null,
  managerName: apiUser.managerName || '',
  team: apiUser.team || '',
  designation: apiUser.designation || '',
  // 
  permission_count: apiUser.pagePermissionsCount || 0,
  menu_permissions_count: apiUser.menuPermissionsCount || 0,
  created_at: formatDateTime(apiUser.created_at)
});

const UsersPage = () => {
  useThemeVersion();
  const [activeTab, setActiveTab] = useState('list');   // 'list' | 'hierarchy'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showMenuPermissionsModal, setShowMenuPermissionsModal] = useState(false);
  const [showEditMenuPermissionsModal, setShowEditMenuPermissionsModal] = useState(false);
  const [showUserPermissionsModal, setShowUserPermissionsModal] = useState(false);
  const [showEditUserPermissionsModal, setShowEditUserPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserMenuPermissions, setSelectedUserMenuPermissions] = useState({});
  const [selectedUserPermissions, setSelectedUserPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [modalLoading, setModalLoading] = useState(false); // local loader for permission modals — avoids full-page flicker
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const { user, pagePermissions, menuPermissions } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const searchDebounceTimer = useRef(null);
  const [isSearching, setIsSearching] = useState(false);

  const [newUser, setNewUser] = useState({
    user_id: '', name: '', email: '', password: '', confirmPassword: '',
    phone: '', role: '', managerId: '', team: '', designation: '', is_active: true
  });
  const [userIdValidation, setUserIdValidation] = useState({ checking: false, isValid: null, message: '' });
  const [passwordMatch, setPasswordMatch] = useState({ isValid: null, message: '' });
  const [phoneValidation, setPhoneValidation] = useState({ isValid: null, message: '' });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ isValid: null, message: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Searchable Reports To dropdown state
  const [createManagerSearch, setCreateManagerSearch] = useState('');
  const [createManagerOpen, setCreateManagerOpen] = useState(false);
  const [editManagerSearch, setEditManagerSearch] = useState('');
  const [editManagerOpen, setEditManagerOpen] = useState(false);
  const createManagerRef = React.useRef(null);
  const editManagerRef = React.useRef(null);
  // Reports-To dropdown: separate user list (not paginated table data)
  const [dropdownUsers, setDropdownUsers] = useState([]);
  const [dropdownUsersLoading, setDropdownUsersLoading] = useState(false);
  const dropdownSearchTimer = useRef(null);

  const [toasts, setToasts] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  // Full list for hierarchy chart (pagination-free)
  const [allUsersForHierarchy, setAllUsersForHierarchy] = useState([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  // Full list for team member picker (pagination-free, all users regardless of role/page)
  const [allUsersForTeams, setAllUsersForTeams] = useState([]);
  const [allUsersForTeamsLoading, setAllUsersForTeamsLoading] = useState(false);
  // FIX #6: teams state
  const [teams, setTeams] = useState([]);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [showViewTeamModal, setShowViewTeamModal] = useState(false);
  const [viewingTeam, setViewingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', memberIds: [] });
  const [teamsLoading, setTeamsLoading] = useState(false);
  // 1. Fetch menu items from backend (add this state)
  const [dynamicMenuItems, setDynamicMenuItems] = useState([]);
  const [initialUserPermIds, setInitialUserPermIds] = useState([]);
  const [loggedInActualPermIds, setLoggedInActualPermIds] = useState([]);
  const [pagePermissionsStructure, setPagePermissionsStructure] = useState([]);
  useEffect(() => {
    fetch(`${API}/menu-permissions/getAllMenuItems`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setDynamicMenuItems((Array.isArray(data) ? data : []).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => { });
  }, []);

  // When a new menu item is created/edited/deleted in NewRolePermissions (same browser
  // session), refresh the list immediately so the Edit Menu Permissions modal shows
  // the latest items without requiring a logout/login.
  useEffect(() => {
    const handleMenuItemsChanged = () => {
      fetch(`${API}/menu-permissions/getAllMenuItems`, { credentials: "include" })
        .then(r => r.json())
        .then(data => setDynamicMenuItems((Array.isArray(data) ? data : []).sort((a, b) => a.name.localeCompare(b.name))))
        .catch(() => { });
    };
    window.addEventListener('menuItemsChanged', handleMenuItemsChanged);
    return () => window.removeEventListener('menuItemsChanged', handleMenuItemsChanged);
  }, []);

  // Fetch logged-in user's ACTUAL DB permissions — bypasses AuthContext overrides
useEffect(() => {
  if (!user?.id || pagePermissionsStructure.length === 0) return;
  fetchUserPagePermissions(user.id).then(ids => setLoggedInActualPermIds(ids));
}, [user?.id, pagePermissionsStructure.length]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    fetch(`${API}/permissions/getAllPermissions`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setPagePermissionsStructure(
        (Array.isArray(data) ? data : []).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          module: p.name.includes('.')
            ? p.name.split('.').slice(0, -1).join('.')  // handles "quotations.sales.view" → "quotations.sales"
            : 'general',
        })).sort((a, b) => a.name.localeCompare(b.name))
      ))
      .catch(() => { });
  }, []);
  // 2. Derive menuPermissionsList dynamically — NO hardcoding needed
  const menuPermissionsList = dynamicMenuItems.map(item => ({
    id: item.name,
    name: item.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    dbField: item.name,
    backendKey: item.name.toUpperCase(),
  }));
  // availableMenuPermissions: always use the full live list from the backend.
  // Filtering by the auth-context menuPermissions was causing newly-created menu
  // items to be invisible until the admin logged out and back in, because the
  // auth context is only populated at login time.
  // refreshMenuItems() re-fetches from the API whenever the edit modal is opened,
  // so menuPermissionsList is always up-to-date — no auth-context filter needed.
  const availableMenuPermissions = menuPermissionsList;


  const mapBackendPermissionToFrontend = (module, action) => {
    const moduleMap = {
      'USERS': 'users', 'ROLES': 'roles', 'CUSTOMERS': 'customers', 'VENDORS': 'vendors',
      'LEADS': 'leads', 'PROPOSALS': 'proposals', 'QUOTATIONS.SALES': 'quotations.sales',
      'SALES.ORDERS': 'sales_orders', 'INVOICES': 'invoices',
      'QUOTATIONS.PROCUREMENT': 'quotations.procurement', 'PURCHASE.ORDERS': 'purchase_orders',
      'BILLS': 'bills', 'PAYMENTS': 'payments', 'REPORTS': 'reports', 'FOLLOWUPS': 'followups',
      'SETTINGS': 'settings', 'ACTIVITY.LOGS': 'activity_logs', 'ATTACHMENTS': 'attachments',
      // Explicit mappings — DB uses 'orderbook.*' (no underscore), not 'order_book.*'
      'ORDER_BOOK': 'orderbook',
      'INVOICE_RECEIPTS': 'invoice_receipts',
      
    };
    // Normalise action: lowercase, spaces to underscores
    const normAction = action.toLowerCase().replace(/\s+/g, '_');
    // Fallback: strip underscores from module name to match DB convention (e.g. some_module -> somemodule)
    const normModule = moduleMap[module] || module.toLowerCase().replace(/\./g, '_').replace(/__+/g, '_');
    return `${normModule}.${normAction}`;
  };

  const availablePagePermissions = React.useMemo(() => {
    if (!pagePermissions || typeof pagePermissions !== 'object') return pagePermissionsStructure;
    const names = new Set();
    Object.entries(pagePermissions).forEach(([mod, actions]) => {
      if (Array.isArray(actions)) actions.forEach(a => names.add(mapBackendPermissionToFrontend(mod, a)));
    });
    return pagePermissionsStructure.filter(p => names.has(p.name));
    // pagePermissionsStructure is module-level constant, safe to omit from deps
  }, [pagePermissions, pagePermissionsStructure]);

  const filteredRoles = React.useMemo(() => {
    if (!user?.role) return roles;
    if (['SUPERADMIN', 'SuperAdmin'].includes(user.role)) return roles;
    return roles.filter(r => !['SUPERADMIN', 'SuperAdmin'].includes(r.name));
  }, [roles, user?.role]);

  const showToast = (message, type = 'success') =>
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));




  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setLoadingText('Fetching users...');
    try {
      const res = await fetch(`${API}/login/users/${user.id}?page=${currentPage}&size=${pageSize}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.userWrapper.map(transformUser));
      setTotalUsers(data.totalUsers || 0);
      setActiveUsers(data.activeUsers || 0);
      setInactiveUsers(data.inactiveUsers || 0);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalUsers || 0);
      setRoles(data.roles.map(r => ({ id: r, name: r, description: `${r} role` })));
    } catch { showToast('Error fetching users', 'error'); }
    finally { setLoading(false); }
  }, [user?.id, currentPage, pageSize]);

  // FIX #3: fetch ALL users (no pagination) for hierarchy chart
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAllUsersForHierarchy = useCallback(async () => {
    if (!user?.id) return;
    setHierarchyLoading(true);
    try {
      const res = await fetch(`${API}/users/search/${user.id}?page=1&size=9999`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAllUsersForHierarchy((data.userWrapper || []).map(transformUser));
    } catch { /* silently fail for hierarchy */ }
    finally { setHierarchyLoading(false); }
  }, [user?.id]);

  // Fetch ALL users for team member picker — ignores role/pagination, always gets everyone
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAllUsersForTeams = useCallback(async () => {
    if (!user?.id) return;
    setAllUsersForTeamsLoading(true);
    try {
      const res = await fetch(`${API}/users/search/${user.id}?page=1&size=9999`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAllUsersForTeams((data.userWrapper || []).map(transformUser));
    } catch { }
    finally { setAllUsersForTeamsLoading(false); }
  }, [user?.id]);

  // Fetch up to 200 users for the Reports-To dropdown (not paginated)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchDropdownUsers = useCallback(async () => {
    if (!user?.id) return;
    setDropdownUsersLoading(true);
    try {
      const res = await fetch(`${API}/users/search/${user.id}?page=1&size=200`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setDropdownUsers((data.userWrapper || []).map(transformUser));
    } catch { /* silently fail */ }
    finally { setDropdownUsersLoading(false); }
  }, [user?.id]);

  // Backend search for Reports-To dropdown (called when user types in search box)
  const searchDropdownUsers = useCallback(async (term) => {
    if (!user?.id) return;
    setDropdownUsersLoading(true);
    try {
      const params = new URLSearchParams({ searchTerm: term.trim(), role: 'all', page: 1, size: 200 });
      const res = await fetch(`${API}/users/search/${user.id}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setDropdownUsers((data.userWrapper || []).map(transformUser));
    } catch { /* silently fail */ }
    finally { setDropdownUsersLoading(false); }
  }, [user?.id]);

  // Fetch teams list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const res = await fetch(`${API}/teams/all`, { credentials: "include" });
      if (res.ok) setTeams(await res.json());
    } catch { }
    finally { setTeamsLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchUsers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setLoadingText('Searching...'); setIsSearching(true);
    try {
      const params = new URLSearchParams({ searchTerm: searchTerm.trim(), role: filterRole, page: currentPage, size: pageSize });
      const res = await fetch(`${API}/users/search/${user.id}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to search');
      const data = await res.json();
      setUsers(data.userWrapper.map(transformUser));
      setTotalUsers(data.totalUsers || 0);
      setActiveUsers(data.activeUsers || 0);
      setInactiveUsers(data.inactiveUsers || 0);
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalUsers || 0);
      // Keep the role-filter dropdown complete: merge instead of overwrite, so
      // a filtered search response can never shrink the list and hide a newly
      // added role while a search/role filter is active.
      if (Array.isArray(data.roles) && data.roles.length > 0) {
        setRoles(prev => {
          const merged = new Set([...prev.map(r => r.name), ...data.roles]);
          return [...merged].map(r => ({ id: r, name: r, description: `${r} role` }));
        });
      }
    } catch { showToast('Error searching users', 'error'); }
    finally { setLoading(false); setIsSearching(false); }
  }, [user?.id, searchTerm, filterRole, currentPage, pageSize]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.id) return;
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    const shouldSearch = searchTerm.trim() !== '' || filterRole !== 'all';
    if (shouldSearch) searchDebounceTimer.current = setTimeout(searchUsers, 1000);
    else fetchUsers();
    return () => { if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current); };
  }, [searchTerm, filterRole, user?.id]); // intentional: fetchUsers/searchUsers are stable refs

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.id) return;
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    const shouldSearch = searchTerm.trim() !== '' || filterRole !== 'all';
    if (shouldSearch) searchUsers(); else fetchUsers();
  }, [currentPage, pageSize]); // intentional: fetchUsers/searchUsers are stable refs

  const checkUserIdExists = async (userId) => {
    if (!userId?.trim()) { setUserIdValidation({ checking: false, isValid: null, message: '' }); return; }
    setUserIdValidation({ checking: true, isValid: null, message: 'Checking...' });
    try {
      const res = await fetch(`${API}/users/isUserIdExist/${userId}`, { credentials: "include" });
      const exists = await res.json();
      setUserIdValidation(exists
        ? { checking: false, isValid: false, message: 'Username already exists' }
        : { checking: false, isValid: true, message: 'Username available' });
    } catch { setUserIdValidation({ checking: false, isValid: null, message: 'Error checking' }); }
  };

  useEffect(() => {
    if (showAddUserModal && newUser.user_id) {
      const t = setTimeout(() => checkUserIdExists(newUser.user_id), 500);
      return () => clearTimeout(t);
    }
  }, [newUser.user_id, showAddUserModal]);

  useEffect(() => {
    if (showAddUserModal && newUser.password && newUser.confirmPassword) {
      setPasswordMatch(newUser.password === newUser.confirmPassword
        ? { isValid: true, message: 'Passwords match' }
        : { isValid: false, message: 'Passwords do not match' });
    } else {
      setPasswordMatch({ isValid: null, message: '' });
    }
  }, [newUser.password, newUser.confirmPassword, showAddUserModal]);

  useEffect(() => {
    if (showAddUserModal && phoneTouched) {
      if (!newUser.phone) {
        setPhoneValidation({ isValid: false, message: 'Phone number is required' });
      } else {
        const ok = /^\d{10}$/.test(newUser.phone);
        setPhoneValidation(ok
          ? { isValid: true, message: 'Valid phone number' }
          : { isValid: false, message: `${newUser.phone.length}/10 digits required` });
      }
    } else if (!showAddUserModal) {
      setPhoneValidation({ isValid: null, message: '' });
      setPhoneTouched(false);
    }
  }, [newUser.phone, showAddUserModal, phoneTouched]);

  useEffect(() => {
    if (showAddUserModal && newUser.password) {
      const ok = newUser.password.length >= 6 && /[A-Z]/.test(newUser.password) && /[!@#$%^&*(),.?":{}|<>]/.test(newUser.password);
      const errs = [];
      if (newUser.password.length < 6) errs.push('6+ chars');
      if (!/[A-Z]/.test(newUser.password)) errs.push('1 uppercase');
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newUser.password)) errs.push('1 special char');
      setPasswordStrength(ok ? { isValid: true, message: 'Strong password' } : { isValid: false, message: `Needs: ${errs.join(', ')}` });
    } else {
      setPasswordStrength({ isValid: null, message: '' });
    }
  }, [newUser.password, showAddUserModal]);

  // Close searchable manager dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (createManagerRef.current && !createManagerRef.current.contains(e.target)) setCreateManagerOpen(false);
      if (editManagerRef.current && !editManagerRef.current.contains(e.target)) setEditManagerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpenAddUserModal = () => {
    setNewUser({ user_id: '', name: '', email: '', password: '', confirmPassword: '', phone: '', role: '', managerId: '', team: '', designation: '', is_active: true });
    setUserIdValidation({ checking: false, isValid: null, message: '' });
    setPasswordMatch({ isValid: null, message: '' });
    setPhoneValidation({ isValid: null, message: '' });
    setPasswordStrength({ isValid: null, message: '' });
    setShowPassword(false); setShowConfirmPassword(false);
    fetchDropdownUsers();
    setShowAddUserModal(true);
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    if (!userIdValidation.isValid) { showToast('Please choose a valid username', 'error'); return; }
    if (!passwordStrength.isValid) { showToast('Password does not meet requirements', 'error'); return; }
    if (!passwordMatch.isValid) { showToast('Passwords do not match', 'error'); return; }
    // FIX #4: Phone is REQUIRED in the backend  validate always, not only when filled
    if (!phoneValidation.isValid) { showToast('Phone number is required (10 digits)', 'error'); return; }
    if (!newUser.role) { showToast('Please select a role', 'error'); return; }
    setLoading(true); setLoadingText('Creating user...');
    try {
      const res = await fetch(`${API}/users/addNewUser`, {
        method: 'POST', credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: newUser.user_id, name: newUser.name, email: newUser.email.toLowerCase(),
          password: newUser.password, phone: newUser.phone,
          role: newUser.role.toUpperCase(),
          managerId: newUser.managerId ? Number(newUser.managerId) : null,
          team: newUser.team || null,
          designation: newUser.designation || null,
          is_active: newUser.is_active ? 1 : 0, created_by: user.id
        })
      });
      // FIX #4: proper error handling  don't let backend errors cause logout
      if (res.ok) {
        const result = await res.text();
        if (searchTerm.trim() || filterRole !== 'all') await searchUsers(); else await fetchUsers();
        setShowAddUserModal(false);
        showToast(result || 'User created successfully!', 'success');
      } else {
        const errText = await res.text();
        let msg = errText;
        try { const j = JSON.parse(errText); msg = j.message || j.error || errText; } catch { }
        // 409 = duplicate email → warning (expected user mistake, not a system error)
        if (res.status === 409) {
          showToast(msg || 'This email or mobile number is already in use.', 'warning');
        } else {
          showToast(msg || 'Error creating user', 'error');
        }
      }
      setLoading(false);
    } catch (err) { setLoading(false); showToast('Network error: ' + (err.message || ''), 'error'); }
  };

  const fetchUserMenuPermissions = async (userId) => {
    try {
      const res = await fetch(`${API}/login/menuPermissions/${userId}`, { credentials: "include" });
      const data = await res.json();
      const obj = {};
      menuPermissionsList.forEach(m => { obj[m.dbField] = 0; });

      // Build map dynamically from menuPermissionsList — no hardcoding
      const map = {};
      menuPermissionsList.forEach(m => { map[m.backendKey] = m.dbField; });

      if (Array.isArray(data)) data.forEach(k => { const fk = map[k]; if (fk) obj[fk] = 1; });
      return obj;
    } catch {
      const obj = {};
      menuPermissionsList.forEach(m => { obj[m.dbField] = 0; });
      return obj;
    }
  };

  const fetchUserPagePermissions = async (userId) => {
    try {
      const res = await fetch(`${API}/login/pagePermissions/${userId}`, { credentials: "include" });
      const text = await res.text();
      if (!res.ok || text === "No Permissions") return [];
      const data = JSON.parse(text);
      const ids = [];
      Object.entries(data).forEach(([mod, actions]) => {
        actions.forEach(a => {
          const name = mapBackendPermissionToFrontend(mod, a);
          const p = pagePermissionsStructure.find(p => p.name === name);
          if (p) ids.push(p.id);
        });
      });
      return ids;
    } catch { return []; }
  };

  const handleEditUser = (u) => { setSelectedUser({ ...u }); fetchDropdownUsers(); setShowEditUserModal(true); };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true); setLoadingText('Updating...');
    try {
      const res = await fetch(`${API}/users/updateUser/${selectedUser.id}`, {
        method: 'POST', credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedUser.full_name, email: selectedUser.email,
          phone: selectedUser.phone, role: selectedUser.role_id,
          managerId: selectedUser.managerId ? Number(selectedUser.managerId) : null,
          team: selectedUser.team || null,
          designation: selectedUser.designation || null,
          is_active: selectedUser.is_active ? 1 : 0
        })
      });
      if (res.ok) {
        if (searchTerm.trim() || filterRole !== 'all') await searchUsers(); else await fetchUsers();
        setShowEditUserModal(false); setSelectedUser(null);
        const msg = await res.text().catch(() => '');
        showToast(msg || 'User updated successfully!', 'success');
      } else {
        // Toast type follows the response: 409 (duplicate email) → warning,
        // everything else → error, always showing the backend's message.
        const msg = await res.text().catch(() => '');
        if (res.status === 409) {
          showToast(msg || 'This email or mobile number is already in use.', 'warning');
        } else {
          showToast(msg || 'Error updating user', 'error');
        }
      }
      setLoading(false);
    } catch { setLoading(false); showToast('Error updating user', 'error'); }
  };

  const handleDeleteUser = (u) => { setUserToDelete(u); setShowDeleteConfirm(true); };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setShowDeleteConfirm(false);

    // If user is ACTIVE → deactivate first; if already INACTIVE → permanently delete
    if (userToDelete.is_active) {
      // Step 1: Deactivate
      setLoading(true); setLoadingText('Deactivating...');
      try {
        const res = await fetch(`${API}/users/deactivateUser/${userToDelete.id}`, { credentials: "include", method: 'PUT' });
        if (res.ok) {
          if (searchTerm.trim() || filterRole !== 'all') await searchUsers(); else await fetchUsers();
          showToast('User deactivated successfully! Delete again to permanently remove.', 'warning');
        } else { showToast('Error deactivating user', 'error'); }
        setLoading(false); setUserToDelete(null);
      } catch { setLoading(false); showToast('Error deactivating user', 'error'); setUserToDelete(null); }
    } else {
      // Step 2: Permanently delete (user was already inactive)
      setLoading(true); setLoadingText('Deleting...');
      try {
        const res = await fetch(`${API}/users/deleteUser/${userToDelete.id}`, { credentials: "include", method: 'DELETE' });
        if (res.ok) {
          if (searchTerm.trim() || filterRole !== 'all') await searchUsers(); else await fetchUsers();
          showToast('User deleted successfully!', 'success');
        } else { showToast('Error deleting user', 'error'); }
        setLoading(false); setUserToDelete(null);
      } catch { setLoading(false); showToast('Error deleting user', 'error'); setUserToDelete(null); }
    }
  };

  const refreshMenuItems = async () => {
    try {
        const data = await fetch(`${API}/menu-permissions/getAllMenuItems`, { credentials: "include" }).then(r => r.json());
        setDynamicMenuItems(Array.isArray(data) ? data : []);
    } catch { }
};

const handleViewMenuPermissions = async (u) => {
    setSelectedUser(u); setModalLoading(true);
    await refreshMenuItems();
    setSelectedUserMenuPermissions(await fetchUserMenuPermissions(u.id));
    setShowMenuPermissionsModal(true); setModalLoading(false);
};

const handleEditMenuPermissions = async (u) => {
    setSelectedUser(u); setModalLoading(true);
    await refreshMenuItems();
    const perms = await fetchUserMenuPermissions(u.id);
    const complete = {};
    menuPermissionsList.forEach(m => { complete[m.dbField] = perms[m.dbField] || 0; });
    setSelectedUserMenuPermissions(complete);
    setShowEditMenuPermissionsModal(true); setModalLoading(false);
};

  const handleToggleMenuPermission = (dbField) =>
    setSelectedUserMenuPermissions(prev => ({ ...prev, [dbField]: prev[dbField] === 1 ? 0 : 1 }));

  const handleSaveMenuPermissions = async () => {
    setLoading(true); setLoadingText('Saving...');
    try {
      const complete = {};
      menuPermissionsList.forEach(m => { complete[m.dbField] = selectedUserMenuPermissions[m.dbField] || 0; });
      const res = await fetch(`${API}/users/updateMenuPermissions/${selectedUser.id}`, {
        method: 'PUT', credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complete)
      });
      if (res.ok) {
        if (searchTerm.trim() || filterRole !== 'all') await searchUsers(); else await fetchUsers();
        // ✅ Modal stays open so admin can keep editing — only show a success toast
        showToast('Menu permissions updated!', 'success');
      } else { showToast('Error saving menu permissions', 'error'); }
      setLoading(false);
    } catch { setLoading(false); showToast('Error saving menu permissions', 'error'); }
  };

  const handleViewUserPermissions = async (u) => {
    setSelectedUser(u); setModalLoading(true);
    setSelectedUserPermissions(await fetchUserPagePermissions(u.id));
    setShowUserPermissionsModal(true); setModalLoading(false);
  };

  const handleEditUserPermissions = async (u) => {
    setSelectedUser(u); setModalLoading(true);
    const perms = await fetchUserPagePermissions(u.id);
    setSelectedUserPermissions(perms);
    setInitialUserPermIds(perms);   // ← store the user's original permission set
    setShowEditUserPermissionsModal(true); setModalLoading(false);
  };
  const handleToggleUserPermission = (id) =>
    setSelectedUserPermissions(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleSelectAllUserPermissionsInModule = (module) => {
    const ids = assignablePagePerms
      .filter(p => p.module === module)
      .map(p => p.id);
    const allSelected = ids.every(id => selectedUserPermissions.includes(id));
    setSelectedUserPermissions(allSelected
      ? selectedUserPermissions.filter(id => !ids.includes(id))
      : [...new Set([...selectedUserPermissions, ...ids])]);
  };

  const handleSaveUserPermissions = async () => {
    setLoading(true); setLoadingText('Saving...');
    try {
      const res = await fetch(`${API}/users/updatePagePermissions/${selectedUser.id}`, {
        method: 'PUT', credentials: "include",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: selectedUserPermissions })
      });
      if (res.ok) {
        if (searchTerm.trim() || filterRole !== 'all') await searchUsers(); else await fetchUsers();
        // ✅ Modal stays open so admin can keep editing — only show a success toast
        showToast('Page permissions updated!', 'success');
      } else { showToast('Error saving page permissions', 'error'); }
      setLoading(false);
    } catch { setLoading(false); showToast('Error saving page permissions', 'error'); }
  };

  const groupPermissionsByModule = (perms) => {
    const grouped = {};
    perms.forEach(p => { if (!grouped[p.module]) grouped[p.module] = []; grouped[p.module].push(p); });
    // Sort perms within each group alphabetically
    Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => a.name.localeCompare(b.name)));
    // Return a new object with keys sorted alphabetically
    return Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)));
  };

  // Permissions the selected user currently has — used in Edit modal
  const userEditPerms = React.useMemo(() => {
    if (!initialUserPermIds.length) return [];
    return pagePermissionsStructure.filter(p => initialUserPermIds.includes(p.id));
  }, [initialUserPermIds, pagePermissionsStructure]);

  const userEditPermsGrouped = React.useMemo(
    () => groupPermissionsByModule(userEditPerms),
    [userEditPerms]  // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Logged-in user's actual permissions — used as boundary for what they can assign
const loggedInActualPerms = React.useMemo(() => {
  return pagePermissionsStructure.filter(p => loggedInActualPermIds.includes(p.id));
}, [loggedInActualPermIds, pagePermissionsStructure]);

const loggedInActualPermsGrouped = React.useMemo(
  () => groupPermissionsByModule(loggedInActualPerms),
  [loggedInActualPerms] // eslint-disable-line react-hooks/exhaustive-deps
);

// SUPERADMIN can assign ALL DB permissions; other roles can only assign their own.
const assignablePagePerms = React.useMemo(() => {
  if (user?.role && ['SUPERADMIN', 'SuperAdmin'].includes(user.role)) {
    return pagePermissionsStructure;
  }
  return loggedInActualPerms;
}, [user?.role, pagePermissionsStructure, loggedInActualPerms]); // eslint-disable-line react-hooks/exhaustive-deps

const assignablePagePermsGrouped = React.useMemo(
  () => groupPermissionsByModule(assignablePagePerms),
  [assignablePagePerms] // eslint-disable-line react-hooks/exhaustive-deps
);

// ── ADD THESE 4 LINES HERE ─────────────────────────────────────────────────
const view    = loggedInActualPerms.some(p => p.name === 'users.view');
const create  = loggedInActualPerms.some(p => p.name === 'users.create');
const edit    = loggedInActualPerms.some(p => p.name === 'users.edit');
const deletee = loggedInActualPerms.some(p => p.name === 'users.delete');
  // Action label from permission name — e.g. "users.view" → "view"
  const labelFromName = (name) => name.includes('.') ? name.split('.').pop() : name;

  // Action colour chips — same as Role & Permission page
  const actionChipStyle = (actionName, isOn) => {
    const map = {
      view: { bg: __sbg('#dbeafe'), color: __stc('#1e40af'), border: __sbg('#2563eb') },
      create: { bg: __sbg('#d1fae5'), color: __stc('#065f46'), border: __sbg('#059669') },
      edit: { bg: __sbg('#fef3c7'), color: __stc('#92400e'), border: __sbg('#d97706') },
      delete: { bg: __sbg('#fee2e2'), color: __stc('#991b1b'), border: __sbg('#ef4444') },
      manage: { bg: __sbg('#ede9fe'), color: __stc('#5b21b6'), border: __sbg('#7c3aed') },
      approve: { bg: __sbg('#ecfdf5'), color: __stc('#065f46'), border: __sbg('#10b981') },
      assign: { bg: __sbg('#fdf4ff'), color: __stc('#6b21a8'), border: __sbg('#a21caf') },
      send: { bg: __sbg('#fff7ed'), color: __stc('#9a3412'), border: __sbg('#ea580c') },
      record: { bg: __sbg('#f0fdf4'), color: __stc('#14532d'), border: __sbg('#16a34a') },
      upload: { bg: __sbg('#e0f2fe'), color: __stc('#0369a1'), border: __sbg('#0284c7') },
      download: { bg: __sbg('#f0fdf4'), color: __stc('#065f46'), border: __sbg('#22c55e') },
      adjust: { bg: __sbg('#fdf4ff'), color: __stc('#7e22ce'), border: __sbg('#9333ea') },
      upload_po: { bg: __sbg('#e0f2fe'), color: __stc('#0369a1'), border: __sbg('#0284c7') },
    };
    const s = map[actionName.toLowerCase()] || { bg: __sbg('#f1f5f9'), color: __stc('#475569'), border: __sbg('#6366f1') };
    return {
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
      fontSize: 12, fontWeight: 600, userSelect: 'none', transition: 'all 0.15s',
      border: isOn ? `1.5px solid ${s.border}` : '1.5px solid #e2e8f0',
      background: isOn ? s.bg : __sbg('#f8fafc'),
      color: isOn ? s.color : __stc('#64748b'),
    };
  };
  const groupedPermissions = groupPermissionsByModule(availablePagePermissions);

  const getRoleBadgeClass = (roleName) => {
    const map = { 'SuperAdmin': 'users-page-badge-role-1', 'Admin': 'users-page-badge-role-2', 'Sales Manager': 'users-page-badge-role-3', 'BD Executive': 'users-page-badge-role-4', 'Procurement Manager': 'users-page-badge-role-5', 'Procurement Executive': 'users-page-badge-role-6' };
    return map[roleName] || 'users-page-badge-role-1';
  };

  // Manager options (exclude bottom-level roles)
  const managerOptions = users.filter(u =>
    !['TELECALLER', 'BD_EXECUTIVE', 'SALES_EXEC'].includes(u.role_name?.toUpperCase())
  );

  //  Render 
  return (
    <div className="users-page-container">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {loading && <CrmPreloader text={loadingText} />}
      {modalLoading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:__sbg('#fff'), borderRadius:12, padding:'20px 28px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
            <FiLoader size={20} color="#3b82f6" style={{ animation:'spin 0.8s linear infinite' }} />
            <span style={{ fontSize:14, fontWeight:500, color:__stc('#374151') }}>Loading permissions...</span>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />)}
      </div>

      {/* Header */}
      <div className="users-page-header">
        <div className="users-page-header-left">
          <h1 className="users-page-title">User Management</h1>
          <p className="users-page-subtitle">Manage users, roles, and permissions</p>
        </div>
        <div className="tooltip-wrapper">
          <button className="users-page-btn users-page-btn-primary" onClick={handleOpenAddUserModal} disabled={!create}>
            <span className="users-page-icon">+</span> Add New User
          </button>
          {!create && <span className="tooltip">No Permission</span>}
        </div>
      </div>

      {/*  TABS  */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${__sbg('#e5e7eb')}`, marginBottom: 10 }}>
        {[{ key: 'list', label: 'Users List' }, { key: 'hierarchy', label: 'Hierarchy Chart' }, { key: 'teams', label: 'Teams' }].map(tab => (
          <button key={tab.key} onClick={() => {
            setActiveTab(tab.key);
            if (tab.key === 'teams') fetchTeams();
            if (tab.key === 'hierarchy') { fetchAllUsersForHierarchy(); fetchTeams(); }
          }}
            style={{
              padding: '9px 20px', fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? __stc('#2563eb') : __stc('#6b7280'),
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── HIERARCHY CHART TAB ── */}
      {activeTab === 'hierarchy' && (
        <HierarchySection
          users={allUsersForHierarchy}
          teams={teams}
          loading={hierarchyLoading}
          onRefresh={() => { fetchAllUsersForHierarchy(); fetchTeams(); }}
        />
      )}
      {/*  USERS LIST TAB  */}
      {activeTab === 'list' && (
        <>
         {!view && (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 20px', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: __sbg('#fef2f2'),
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <FiAlertCircle size={36} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: __stc('#111827') }}>
          Access Denied
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: __stc('#6b7280'), maxWidth: 360 }}>
          You don't have permission to view the data. Please contact your administrator.
        </p>
      </div>
    )}
          {view && <>
    {/* Filters */}
    <div className="users-page-filters">
            <div className="users-page-search-box">
              <input type="text" className="users-page-search-input"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
              <span className="users-page-search-icon">
                {isSearching ? <FiLoader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <FiSearch size={15} />}
              </span>
            </div>
            <div className="users-page-role-filter">
              <FilterSelect
                value={filterRole === 'all' ? '' : filterRole}
                options={filteredRoles.map(r => ({ value: r.name, label: r.name }))}
                placeholder="All Roles"
                onChange={(v) => { setFilterRole(v || 'all'); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="users-page-stats">
            <div className="users-page-stat-card">
              <div className="users-page-stat-number">{totalUsers}</div>
              <div className="users-page-stat-label">Total Users</div>
            </div>
            <div className="users-page-stat-card">
              <div className="users-page-stat-number">{activeUsers}</div>
              <div className="users-page-stat-label">Active Users</div>
            </div>
            <div className="users-page-stat-card">
              <div className="users-page-stat-number">{inactiveUsers}</div>
              <div className="users-page-stat-label">Inactive Users</div>
            </div>
          </div>

          {/* Table */}
          <div className="users-page-table-container">
            {!loading && (
              <>
                <div className="users-page-table-wrapper">
                  <table className="users-page-table">
                    <thead>
                      <tr >
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Role / Designation</th>
                        <th>Reports To</th>
                        <th>Team</th>
                        <th>Page Perms</th>
                        <th>Menu Perms</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className={!u.is_active ? 'users-page-row-inactive' : ''}>
                          <td><div className="users-page-user-name">{u.full_name}</div></td>
                          <td><div>{u.phone}</div><div style={{ fontSize: 12, color: __stc('#6b7280') }}>{u.email}</div></td>
                          <td>
                            <span className={`users-page-badge ${getRoleBadgeClass(u.role_name)}`}>{u.role_name}</span>
                            {u.designation && <div style={{ fontSize: 11, color: __stc('#6b7280'), marginTop: 3 }}>{u.designation}</div>}
                          </td>

                          {/*  Reports To column  */}
                          <td>
                            {u.managerName
                              ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: __sbg('#dbeafe'), color: __stc('#1e40af'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                  {u.managerName.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: 13, color: __stc('#374151'), fontWeight: 500 }}>{u.managerName}</span>
                              </div>
                              : <span style={{ color: __stc('#d1d5db'), fontSize: 12 }}>--</span>
                            }
                          </td>

                          {/*  Team column  */}
                          <td>
                            {u.team
                              ? <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, background: __sbg('#f3e8ff'), color: __stc('#6b21a8'), border: `1px solid ${__sbg('#e9d5ff')}`, fontSize: 12, fontWeight: 500 }}>
                                {u.team}
                              </span>
                              : <span style={{ color: __stc('#d1d5db'), fontSize: 12 }}></span>
                            }
                          </td>

                          <td>
                            <div className="users-perm-tooltip-wrap">
                              <span className="users-page-perm-count users-page-perm-count--page" onClick={() => handleViewUserPermissions(u)}>
                                {u.permission_count} permissions
                              </span>
                              <div className="users-perm-tooltip users-perm-tooltip--page">
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z"/></svg>
                                View &amp; Edit Page Permissions
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="users-perm-tooltip-wrap">
                              <span className="users-page-perm-count users-page-perm-count--menu" onClick={() => handleViewMenuPermissions(u)}>
                                {u.menu_permissions_count} menus
                              </span>
                              <div className="users-perm-tooltip users-perm-tooltip--menu">
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z"/></svg>
                                View &amp; Edit Menu Permissions
                              </div>
                            </div>
                          </td>
                          <td><span className={`users-page-status-badge ${u.is_active ? 'users-page-status-active' : 'users-page-status-inactive'}`}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                          <td style={{ fontSize: 12, color: __stc('#6b7280') }}>{u.created_at}</td>
                          <td>
                            <div className="users-page-actions">
                              <div className="tooltip-wrapper">
                                <button className="users-page-btn-icon" onClick={() => handleEditUser(u)} disabled={!edit} style={{ color: edit ? "#5252ff" : "#9ca3af" }}><FiEdit /></button>
                                {!edit && <span className="tooltip">No Permission</span>}
                              </div>
                              <div className="tooltip-wrapper">
                                <button className="users-page-btn-icon" onClick={() => handleDeleteUser(u)} disabled={!deletee} style={{ color: deletee ? "red" : "#9ca3af" }}><FiTrash2 /></button>
                                {!deletee && <span className="tooltip error">No Permission</span>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {users.length > 0 && (
                  <div className="pagination-footer">
                    <div className="pagination-info">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalElements)} of {totalElements} entries
                      <div className="pagination-row-selector">
                        <FilterSelect
                          value={String(pageSize)}
                          options={[
                            { value: '10',  label: '10 Rows' },
                            { value: '20',  label: '20 Rows' },
                            { value: '50',  label: '50 Rows' },
                            { value: '100', label: '100 Rows' },
                          ]}
                          placeholder="Rows"
                          onChange={(v) => { if (v) { setPageSize(Number(v)); setCurrentPage(1); } }}
                        />
                      </div>
                    </div>
                    <div className="pagination-controls">

                      <div className="pagination-nav">
                        <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
                        <span className="pagination-current">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
                        <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {!loading && users.length === 0 && <div className="users-page-empty-state"><p>No users found</p></div>}
        </div>
    </>}
  </>
)}

      {/* TEAMS TAB - FIX #6 */}
      {activeTab === 'teams' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: __stc('#0f172a') }}>Teams</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: __stc('#6b7280') }}>Manage teams and their members</p>
            </div>
            <button className="users-page-btn users-page-btn-primary"
              onClick={() => { setTeamForm({ name: '', description: '', memberIds: [] }); setShowCreateTeamModal(true); fetchAllUsersForTeams(); }}>
              + Create Team
            </button>
          </div>
          {teamsLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: __stc('#94a3b8') }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${__sbg('#e2e8f0')}`, borderTopColor: `${__sbg('#6366f1')}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              Loading teams...
            </div>
          ) : teams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: __stc('#94a3b8') }}>
              <FiUsers size={52} style={{ margin: '0 auto 16px', display: 'block', color: __stc('#cbd5e1') }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: __stc('#374151'), marginBottom: 6 }}>No teams yet</div>
              <div style={{ fontSize: 13, color: __stc('#9ca3af'), marginBottom: 20 }}>Create your first team to group users together</div>
              <button className="users-page-btn users-page-btn-primary"
                onClick={() => { setTeamForm({ name: '', description: '', memberIds: [] }); setShowCreateTeamModal(true); fetchAllUsersForTeams(); }}>
                + Create First Team
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {teams.map(team => {
                const teamColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
                const colorIdx = team.id % teamColors.length;
                const teamColor = teamColors[colorIdx];
                const teamBg = teamColor + '12';
                return (
                  <div key={team.id} style={{
                    background: __sbg('#fff'), borderRadius: 14, border: `1px solid ${__sbg('#e5e7eb')}`,
                    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'box-shadow 0.2s, transform 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = ''; }}>
                    {/* Card header stripe */}
                    <div style={{ height: 5, background: `linear-gradient(90deg,${teamColor},${teamColor}88)` }} />
                    <div style={{ padding: '16px 20px 12px' }}>
                      {/* Team name + actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: teamBg, border: `2px solid ${teamColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiUsers size={18} color={teamColor} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: __stc('#0f172a'), lineHeight: 1.2 }}>{team.name}</div>
                            <div style={{ fontSize: 11, color: teamColor, fontWeight: 600, marginTop: 2 }}>
                              {team.memberCount || 0} member{(team.memberCount || 0) !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${__sbg('#e5e7eb')}`, background: __sbg('#f0fdf4'), color: __stc('#10b981'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="View members"
                            onClick={() => { setViewingTeam(team); setShowViewTeamModal(true); }}>
                            <FiEye size={13} />
                          </button>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${__sbg('#e5e7eb')}`, background: __sbg('#f8fafc'), color: __stc('#6366f1'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Edit team"
                            onClick={() => { setSelectedTeam(team); setTeamForm({ name: team.name, description: team.description || '', memberIds: (team.memberIds || []) }); setShowEditTeamModal(true); fetchAllUsersForTeams(); }}>
                            <FiEdit size={13} />
                          </button>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${__sbg('#fee2e2')}`, background: __sbg('#fff5f5'), color: __stc('#ef4444'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete team"
                            onClick={async () => {
                              if (!window.confirm('Delete team "' + team.name + '"?')) return;
                              try {
                                const r = await fetch(`${API}/teams/${team.id}`, { method: 'DELETE', credentials: 'include' });
                                if (r.ok) { showToast('Team deleted', 'success'); fetchTeams(); }
                                else showToast('Delete failed', 'error');
                              } catch { showToast('Network error', 'error'); }
                            }}>
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {/* Description */}
                      {team.description && (
                        <p style={{ margin: '0 0 12px', fontSize: 12, color: __stc('#6b7280'), lineHeight: 1.5 }}>{team.description}</p>
                      )}
                      {/* Member avatars */}
                      {(team.members || []).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8 }}>
                          {(team.members || []).slice(0, 5).map((m, idx) => (
                            <div key={m.id} title={m.name} style={{
                              width: 28, height: 28, borderRadius: '50%', border: `2px solid ${__sbg('#fff')}`,
                              background: `hsl(${(m.id * 47) % 360},60%,65%)`, color: __stc('#fff'),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, marginLeft: idx === 0 ? 0 : -8,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            }}>
                              {(m.name || '?').charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {(team.members || []).length > 5 && (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${__sbg('#fff')}`, background: __sbg('#e5e7eb'), color: __stc('#6b7280'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, marginLeft: -8 }}>
                              +{(team.members || []).length - 5}
                            </div>
                          )}
                          <span style={{ fontSize: 11, color: __stc('#9ca3af'), marginLeft: 10 }}>
                            {(team.members || []).map(m => m.name).slice(0, 2).join(', ')}{(team.members || []).length > 2 ? '...' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW TEAM MEMBERS MODAL */}
      {showViewTeamModal && viewingTeam && (() => {
        const teamColors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6'];
        const teamColor = teamColors[viewingTeam.id % teamColors.length];
        const members = viewingTeam.members || [];
        return (
          <div className="users-page-modal-overlay" onClick={() => { setShowViewTeamModal(false); setViewingTeam(null); }}>
            <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}
              style={{ maxWidth: 520, borderRadius: 16, overflow: 'hidden' }}>
              {/* Header */}
              <div className="users-page-modal-header"
                style={{ background: `linear-gradient(135deg,${teamColor},${teamColor}cc)`, color: __stc('#fff'), padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: __stc('#fff') }}>
                    {viewingTeam.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: __stc('#fff') }}>{viewingTeam.name}</h2>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      {members.length} member{members.length !== 1 ? 's' : ''}
                      {viewingTeam.description ? ` · ${viewingTeam.description}` : ''}
                    </p>
                  </div>
                </div>
                <button className="users-page-modal-close"
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8, color: __stc('#fff'), cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
                  onClick={() => { setShowViewTeamModal(false); setViewingTeam(null); }}>
                  <FiX size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="users-page-modal-body" style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
                {members.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: __stc('#9ca3af') }}>
                    <FiUsers size={40} style={{ display: 'block', margin: '0 auto 12px', color: __stc('#cbd5e1') }} />
                    <div style={{ fontWeight: 600, color: __stc('#374151'), marginBottom: 4 }}>No members yet</div>
                    <div style={{ fontSize: 13 }}>Edit this team to add members</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {members.map((m, idx) => (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 10,
                        background: idx % 2 === 0 ? __sbg('#f8fafc') : __sbg('#fff'),
                        border: `1px solid ${__sbg('#f1f5f9')}`,
                      }}>
                        {/* Avatar */}
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${(m.id * 47) % 360},55%,62%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: __stc('#fff'), fontSize: 14, fontWeight: 700,
                          border: `2px solid ${teamColor}30`,
                        }}>
                          {(m.name || '?').charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: __stc('#0f172a'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: 11, color: __stc('#6b7280'), marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {m.role && <span style={{ background: `${teamColor}15`, color: teamColor, borderRadius: 4, padding: '1px 7px', fontWeight: 600, fontSize: 10 }}>{m.role}</span>}
                            {m.designation && <span style={{ color: __stc('#9ca3af') }}>{m.designation}</span>}
                            {m.email && <span style={{ color: __stc('#9ca3af') }}>{m.email}</span>}
                          </div>
                        </div>
                        {/* Member number badge */}
                        <div style={{ fontSize: 11, color: __stc('#9ca3af'), fontWeight: 600, flexShrink: 0 }}>
                          #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="users-page-modal-footer" style={{ padding: '14px 24px', borderTop: `1px solid ${__sbg('#f1f5f9')}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: __stc('#6b7280') }}>
                  Team has <strong style={{ color: teamColor }}>{members.length}</strong> member{members.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="users-page-btn users-page-btn-secondary"
                    onClick={() => { setShowViewTeamModal(false); setViewingTeam(null); }}>
                    Close
                  </button>
                  <button className="users-page-btn users-page-btn-primary"
                    style={{ background: teamColor, borderColor: teamColor }}
                    onClick={() => {
                      setShowViewTeamModal(false);
                      setSelectedTeam(viewingTeam);
                      setTeamForm({ name: viewingTeam.name, description: viewingTeam.description || '', memberIds: viewingTeam.memberIds || [] });
                      setShowEditTeamModal(true);
                      fetchAllUsersForTeams();
                    }}>
                    <FiEdit size={13} style={{ marginRight: 5 }} /> Edit Team
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CREATE TEAM MODAL */}
      {showCreateTeamModal && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}
            style={{ maxWidth: 560, borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div className="users-page-modal-header" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: __stc('#fff'), padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiUsers size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: __stc('#fff') }}>Create New Team</h2>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Group users into a team</p>
                </div>
              </div>
              <button className="users-page-modal-close" onClick={() => setShowCreateTeamModal(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: __stc('#fff'), cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}>
                <FiX size={18} />
              </button>
            </div>
            <div className="users-page-modal-body" style={{ padding: '20px 24px' }}>
              {/* Team Name + Description side by side */}
              <div className="users-page-form-row">
                <div className="users-page-form-group">
                  <label>Team Name <span style={{ color: __stc('#ef4444') }}>*</span></label>
                  <input type="text" value={teamForm.name}
                    onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="e.g. Sales North Team"
                    style={{ borderColor: teamForm.name ? __sbg('#6366f1') : '' }} />
                </div>
                <div className="users-page-form-group">
                  <label>Description <span style={{ color: __stc('#9ca3af'), fontWeight: 400 }}>(optional)</span></label>
                  <input type="text" value={teamForm.description}
                    onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                    placeholder="Brief description of this team" />
                </div>
              </div>
              {/* Members */}
              <div className="users-page-form-group" style={{ marginTop: 4 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Members</span>
                  {teamForm.memberIds.length > 0 && (
                    <button type="button" style={{ fontSize: 11, color: __stc('#ef4444'), background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setTeamForm(prev => ({ ...prev, memberIds: [] }))}>
                      Clear all
                    </button>
                  )}
                </label>
                <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 10, border: `1px solid ${__sbg('#e5e7eb')}` }}>
                  <div style={{ padding: '10px 14px', background: __sbg('#f8fafc'), borderBottom: `1px solid ${__sbg('#e5e7eb')}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: __stc('#6b7280'), display: 'flex', alignItems: 'center', gap: 6 }}><FiUsers size={13} /> USERS</span>
                    <span style={{ fontSize: 12, color: __stc('#6366f1'), fontWeight: 700 }}>
                        {teamForm.memberIds.length} selected · {allUsersForTeams.filter(u => !new Set(teams.flatMap(t => t.memberIds || [])).has(u.id)).length} available
                      </span>
                  </div>
                  {allUsersForTeamsLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: __stc('#9ca3af'), fontSize: 13 }}>
                      <FiLoader size={18} style={{ animation: 'spin 0.8s linear infinite', marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
                      Loading users...
                    </div>
                  ) : (() => {
                    // Only show users not already in any team
                    const allAssignedIds = new Set(teams.flatMap(t => t.memberIds || []));
                    const availableUsers = allUsersForTeams.filter(u => !allAssignedIds.has(u.id));
                    return availableUsers.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: __stc('#9ca3af'), fontSize: 13 }}>
                        <FiUsers size={28} style={{ display: 'block', margin: '0 auto 8px', color: __stc('#cbd5e1') }} />
                        All users are already assigned to a team
                      </div>
                    ) : (
                      availableUsers.map(u => {
                        const isSelected = teamForm.memberIds.includes(u.id);
                        return (
                          <label key={u.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                            cursor: 'pointer', transition: 'background 0.1s',
                            background: isSelected ? __sbg('#f0f4ff') : __sbg('#fff'),
                            borderBottom: `1px solid ${__sbg('#f1f5f9')}`,
                          }}>
                            <input type="checkbox" checked={isSelected}
                              onChange={e => setTeamForm(prev => ({
                                ...prev,
                                memberIds: e.target.checked
                                  ? [...prev.memberIds, u.id]
                                  : prev.memberIds.filter(id => id !== u.id)
                              }))}
                              style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0, marginTop: 1 }} />
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                              background: isSelected ? __sbg('#6366f1') : `hsl(${(u.id * 47) % 360},55%,62%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: __stc('#fff'), fontSize: 13, fontWeight: 700,
                            }}>{(u.full_name || '?').charAt(0).toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? __stc('#1e1b4b') : __stc('#111827'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {u.full_name}
                              </div>
                              <div style={{ fontSize: 11, color: isSelected ? __stc('#6366f1') : __stc('#9ca3af'), marginTop: 1 }}>
                                {u.role_name}{u.designation ? ` · ${u.designation}` : ''}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="users-page-modal-footer" style={{ padding: '16px 24px', borderTop: `1px solid ${__sbg('#f1f5f9')}` }}>
              <button className="users-page-btn users-page-btn-secondary" onClick={() => setShowCreateTeamModal(false)}>Cancel</button>
              <button className="users-page-btn users-page-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={async () => {
                  if (!teamForm.name.trim()) { showToast('Team name is required', 'error'); return; }
                  try {
                    const r = await fetch(`${API}/teams/create`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'User-Id': String(user.id) }, body: JSON.stringify({ name: teamForm.name, description: teamForm.description, memberIds: teamForm.memberIds }) });
                    if (r.ok) { showToast('Team created!', 'success'); setShowCreateTeamModal(false); fetchTeams(); }
                    else { const t = await r.text(); let m = t; try { m = JSON.parse(t).message || t; } catch { } showToast(m || 'Error creating team', 'error'); }
                  } catch { showToast('Network error', 'error'); }
                }}>
                <FiUserPlus size={15} /> Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {showEditTeamModal && selectedTeam && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}
            style={{ maxWidth: 560, borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div className="users-page-modal-header" style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: __stc('#fff'), padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiEdit size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: __stc('#fff') }}>Edit Team</h2>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{selectedTeam.name}</p>
                </div>
              </div>
              <button className="users-page-modal-close" onClick={() => setShowEditTeamModal(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: __stc('#fff'), cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}>
                <FiX size={18} />
              </button>
            </div>
            <div className="users-page-modal-body" style={{ padding: '20px 24px' }}>
              {/* Team Name + Description side by side */}
              <div className="users-page-form-row">
                <div className="users-page-form-group">
                  <label>Team Name <span style={{ color: __stc('#ef4444') }}>*</span></label>
                  <input type="text" value={teamForm.name}
                    onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
                </div>
                <div className="users-page-form-group">
                  <label>Description <span style={{ color: __stc('#9ca3af'), fontWeight: 400 }}>(optional)</span></label>
                  <input type="text" value={teamForm.description}
                    onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
                    placeholder="Brief description" />
                </div>
              </div>
              {/* Members */}
              <div className="users-page-form-group" style={{ marginTop: 4 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Members</span>
                  {teamForm.memberIds.length > 0 && (
                    <button type="button" style={{ fontSize: 11, color: __stc('#ef4444'), background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setTeamForm(prev => ({ ...prev, memberIds: [] }))}>
                      Clear all
                    </button>
                  )}
                </label>
                <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 10, border: `1px solid ${__sbg('#e5e7eb')}` }}>
                  <div style={{ padding: '10px 14px', background: __sbg('#f8fafc'), borderBottom: `1px solid ${__sbg('#e5e7eb')}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: __stc('#6b7280'), display: 'flex', alignItems: 'center', gap: 6 }}><FiUsers size={13} /> USERS</span>
                    <span style={{ fontSize: 12, color: __stc('#0ea5e9'), fontWeight: 700 }}>
                        {teamForm.memberIds.length} selected
                      </span>
                  </div>
                  {allUsersForTeamsLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: __stc('#9ca3af'), fontSize: 13 }}>
                      <FiLoader size={18} style={{ animation: 'spin 0.8s linear infinite', marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
                      Loading users...
                    </div>
                  ) : (() => {
                    // Show: current team's own members + users not in any other team
                    const currentTeamMemberIds = new Set(selectedTeam?.memberIds || []);
                    const otherTeamsAssignedIds = new Set(
                      teams
                        .filter(t => t.id !== selectedTeam?.id)
                        .flatMap(t => t.memberIds || [])
                    );
                    const availableForEdit = allUsersForTeams.filter(
                      u => currentTeamMemberIds.has(u.id) || !otherTeamsAssignedIds.has(u.id)
                    );
                    return availableForEdit.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: __stc('#9ca3af'), fontSize: 13 }}>
                        <FiUsers size={28} style={{ display: 'block', margin: '0 auto 8px', color: __stc('#cbd5e1') }} />
                        No available users to add
                      </div>
                    ) : (
                      availableForEdit.map(u => {
                        const isSelected = teamForm.memberIds.includes(u.id);
                        const isCurrentMember = currentTeamMemberIds.has(u.id);
                        return (
                          <label key={u.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                            cursor: 'pointer', transition: 'background 0.1s',
                            background: isSelected ? __sbg('#f0f9ff') : __sbg('#fff'),
                            borderBottom: `1px solid ${__sbg('#f1f5f9')}`,
                          }}>
                            <input type="checkbox" checked={isSelected}
                              onChange={e => setTeamForm(prev => ({
                                ...prev,
                                memberIds: e.target.checked
                                  ? [...prev.memberIds, u.id]
                                  : prev.memberIds.filter(id => id !== u.id)
                              }))}
                              style={{ width: 15, height: 15, accentColor: '#0ea5e9', cursor: 'pointer', flexShrink: 0, marginTop: 1 }} />
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                              background: isSelected ? __sbg('#0ea5e9') : `hsl(${(u.id * 47) % 360},55%,62%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: __stc('#fff'), fontSize: 13, fontWeight: 700,
                            }}>{(u.full_name || '?').charAt(0).toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? __stc('#0c4a6e') : __stc('#111827'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {u.full_name}
                              </div>
                              <div style={{ fontSize: 11, color: isSelected ? __stc('#0ea5e9') : __stc('#9ca3af'), marginTop: 1 }}>
                                {u.role_name}{u.designation ? ` · ${u.designation}` : ''}
                                {isCurrentMember && <span style={{ marginLeft: 6, background: __sbg('#e0f2fe'), color: __stc('#0284c7'), borderRadius: 4, padding: '0 5px', fontSize: 10, fontWeight: 600 }}>Current</span>}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="users-page-modal-footer" style={{ padding: '16px 24px', borderTop: `1px solid ${__sbg('#f1f5f9')}` }}>
              <button className="users-page-btn users-page-btn-secondary" onClick={() => setShowEditTeamModal(false)}>Cancel</button>
              <button className="users-page-btn users-page-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={async () => {
                  if (!teamForm.name.trim()) { showToast('Team name is required', 'error'); return; }
                  try {
                    const r = await fetch(`${API}/teams/${selectedTeam.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: teamForm.name, description: teamForm.description, memberIds: teamForm.memberIds }) });
                    if (r.ok) { showToast('Team updated!', 'success'); setShowEditTeamModal(false); setSelectedTeam(null); fetchTeams(); }
                    else { const t = await r.text(); let m = t; try { m = JSON.parse(t).message || t; } catch { } showToast(m || 'Error updating team', 'error'); }
                  } catch { showToast('Network error', 'error'); }
                }}>
                <FiCheckCircle size={15} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/*  ADD USER MODAL  */}
      {showAddUserModal && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <h2>Add New User</h2>
              <button className="users-page-modal-close" onClick={() => setShowAddUserModal(false)}><FiX size={18} /></button>
            </div>
            <form onSubmit={handleAddUserSubmit} autoComplete="off">
              <div className="users-page-modal-body">
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Username (User ID) <span style={{ color: 'red' }}>*</span></label>
                    <input type="text" required autoComplete="off" value={newUser.user_id}
                      onChange={e => setNewUser({ ...newUser, user_id: e.target.value })} placeholder="Enter unique username" />
                    {userIdValidation.message && (
                      <div style={{ marginTop: 4, fontSize: 13, color: userIdValidation.isValid ? __stc('#22c55e') : userIdValidation.isValid === false ? __stc('#ef4444') : __stc('#6b7280'), display: 'flex', alignItems: 'center', gap: 4 }}>
                        {userIdValidation.checking ? <FiLoader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : userIdValidation.isValid ? <FiCheckCircle size={13} color="#22c55e" /> : userIdValidation.isValid === false ? <FiAlertCircle size={13} color="#ef4444" /> : null}
                        {userIdValidation.message}
                      </div>
                    )}
                  </div>
                  <div className="users-page-form-group">
                    <label>Full Name <span style={{ color: 'red' }}>*</span></label>
                    <input type="text" required autoComplete="off" value={newUser.name}
                      onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Enter full name" />
                  </div>
                </div>
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Email <span style={{ color: 'red' }}>*</span></label>
                    <input type="email" required autoComplete="new-email" value={newUser.email}
                      onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Enter email address" />
                  </div>
                  <div className="users-page-form-group">
                    <label>Phone <span style={{ color: __stc('#ef4444') }}>*</span></label>
                    <input type="tel" required autoComplete="off" value={newUser.phone}
                      onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setNewUser({ ...newUser, phone: v }); setPhoneTouched(true); }}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder="Enter 10-digit phone number" maxLength="10"
                      style={{ borderColor: phoneTouched && phoneValidation.isValid ? __sbg('#22c55e') : phoneTouched && !phoneValidation.isValid ? __sbg('#ef4444') : '' }} />
                    {phoneValidation.message && (
                      <div style={{ marginTop: 4, fontSize: 13, color: phoneValidation.isValid ? __stc('#22c55e') : __stc('#ef4444'), display: 'flex', alignItems: 'center', gap: 4 }}>
                        {phoneValidation.isValid ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
                        {phoneValidation.message}
                      </div>
                    )}
                  </div>
                </div>
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Password <span style={{ color: 'red' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? "text" : "password"} required autoComplete="new-password" value={newUser.password}
                        onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Enter password" style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: __stc('#718096'), fontSize: 18, padding: 4, display: 'flex', alignItems: 'center' }}>
                        {showPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {passwordStrength.message && <div style={{ marginTop: 4, fontSize: 13, color: passwordStrength.isValid ? __stc('#22c55e') : __stc('#ef4444'), display: 'flex', alignItems: 'center', gap: 4 }}>{passwordStrength.isValid ? <FiCheckCircle size={13} color="#22c55e" /> : <FiAlertCircle size={13} color="#ef4444" />}{passwordStrength.message}</div>}
                  </div>
                  <div className="users-page-form-group">
                    <label>Confirm Password <span style={{ color: 'red' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input type={showConfirmPassword ? "text" : "password"} required autoComplete="new-password" value={newUser.confirmPassword}
                        onChange={e => setNewUser({ ...newUser, confirmPassword: e.target.value })} placeholder="Re-enter password" style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: __stc('#718096'), fontSize: 18, padding: 4, display: 'flex', alignItems: 'center' }}>
                        {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {passwordMatch.message && <div style={{ marginTop: 4, fontSize: 13, color: passwordMatch.isValid ? __stc('#22c55e') : __stc('#ef4444'), display: 'flex', alignItems: 'center', gap: 4 }}>{passwordMatch.isValid ? <FiCheckCircle size={13} color="#22c55e" /> : <FiAlertCircle size={13} color="#ef4444" />}{passwordMatch.message}</div>}
                  </div>
                </div>
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Role <span style={{ color: 'red' }}>*</span></label>
                    <FilterSelect
                      value={newUser.role}
                      options={filteredRoles.map(r => ({ value: r.name, label: r.name }))}
                      placeholder="Select Role"
                      onChange={(v) => setNewUser({ ...newUser, role: v || '' })}
                    />
                  </div>
                  <div className="users-page-form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 40 }}>
                    <label className="users-page-checkbox-label" style={{ marginBottom: 0 }}>
                      <span><input type="checkbox" checked={newUser.is_active} onChange={e => setNewUser({ ...newUser, is_active: e.target.checked })} /></span>
                      <span style={{ paddingLeft: 5 }}>Active User</span>
                    </label>
                  </div>
                </div>
                <div className="users-page-form-row">
                  <div className="users-page-form-group" ref={createManagerRef} style={{ position: 'relative' }}>
                    <label>Reports To (Manager)</label>
                    <div
                      onClick={() => { setCreateManagerOpen(o => !o); setCreateManagerSearch(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 8, padding: '9px 12px',
                        cursor: 'pointer', background: __sbg('#fff'), fontSize: 14, color: newUser.managerId ? __stc('#111827') : __stc('#9ca3af'),
                        minHeight: 40
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {newUser.managerId
                          ? (() => { const u = dropdownUsers.find(u => u.id === Number(newUser.managerId)); return u ? `${u.full_name} (${u.role_name})` : '-- None --'; })()
                          : '-- None --'}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    {createManagerOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                        background: __sbg('#fff'), border: `1px solid ${__sbg('#e5e7eb')}`, borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden'
                      }}>
                        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${__sbg('#f3f4f6')}` }}>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search users..."
                            value={createManagerSearch}
                            onChange={e => {
                              const val = e.target.value;
                              setCreateManagerSearch(val);
                              if (dropdownSearchTimer.current) clearTimeout(dropdownSearchTimer.current);
                              if (val.trim()) {
                                dropdownSearchTimer.current = setTimeout(() => searchDropdownUsers(val), 400);
                              } else {
                                fetchDropdownUsers();
                              }
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              width: '100%', border: `1px solid ${__sbg('#e5e7eb')}`, borderRadius: 6,
                              padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: __sbg('#fff'), color: __stc('#111827')
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {dropdownUsersLoading ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: 13, color: __stc('#9ca3af'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <FiLoader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading...
                            </div>
                          ) : (
                            <>
                          <div
                            onClick={() => { setNewUser({ ...newUser, managerId: '' }); setCreateManagerOpen(false); }}
                            style={{ padding: '9px 12px', fontSize: 13, color: __stc('#6b7280'), cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = __sbg('#f9fafb')}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >-- None --</div>
                          {dropdownUsers
                            .map(u => (
                              <div
                                key={u.id}
                                onClick={() => { setNewUser({ ...newUser, managerId: u.id }); setCreateManagerOpen(false); }}
                                style={{
                                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                                  background: newUser.managerId === u.id ? __sbg('#eff6ff') : __sbg('transparent'),
                                  color: __stc('#111827')
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = __sbg('#f9fafb')}
                                onMouseLeave={e => e.currentTarget.style.background = newUser.managerId === u.id ? __sbg('#eff6ff') : 'transparent'}
                              >
                                <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                                <div style={{ fontSize: 11, color: __stc('#6b7280'), marginTop: 2 }}>{u.role_name}</div>
                              </div>
                          ))}
                          {dropdownUsers.length === 0 && (
                            <div style={{ padding: '10px 12px', fontSize: 13, color: __stc('#9ca3af'), textAlign: 'center' }}>No users found</div>
                          )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: __stc('#9ca3af'), marginTop: 4, display: 'block' }}>Sets who this user reports to in the hierarchy</span>
                  </div>
                  <div className="users-page-form-group">
                    <label>Team</label>
                    <input type="text" value={newUser.team} onChange={e => setNewUser({ ...newUser, team: e.target.value })} placeholder="e.g. Sales Team A, BD North" />
                    <span style={{ fontSize: 12, color: __stc('#9ca3af'), marginTop: 4, display: 'block' }}>Optional grouping label</span>
                  </div>
                </div>
                {/* FIX #7: designation field */}
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Designation</label>
                    <input type="text" value={newUser.designation} onChange={e => setNewUser({ ...newUser, designation: e.target.value })} placeholder="e.g. Senior Sales Executive" />
                    <span style={{ fontSize: 12, color: __stc('#9ca3af'), marginTop: 4, display: 'block' }}>Job title shown in hierarchy chart</span>
                  </div>
                </div>
              </div>
              <div className="users-page-modal-footer">
                <button type="button" className="users-page-btn users-page-btn-secondary" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                <button type="submit" className="users-page-btn users-page-btn-primary"
                  disabled={loading || !userIdValidation.isValid || !passwordStrength.isValid || !passwordMatch.isValid}>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  EDIT USER MODAL  */}
      {showEditUserModal && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <h2>Edit User</h2>
              <button className="users-page-modal-close" onClick={() => setShowEditUserModal(false)}><FiX size={18} /></button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="users-page-modal-body">
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Full Name</label>
                    <input type="text" required value={selectedUser.full_name} onChange={e => setSelectedUser({ ...selectedUser, full_name: e.target.value })} />
                  </div>
                  <div className="users-page-form-group">
                    <label>Email</label>
                    <input type="email" required value={selectedUser.email} onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })} />
                  </div>
                </div>
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Phone</label>
                    <input type="tel" value={selectedUser.phone} maxLength={10} inputMode="numeric"
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setSelectedUser({ ...selectedUser, phone: v }); }} />
                  </div>
                  <div className="users-page-form-group">
                    <label>Role</label>
                    <FilterSelect
                      value={selectedUser.role_id || selectedUser.role_name || ''}
                      options={filteredRoles.map(r => ({ value: r.name, label: r.name }))}
                      placeholder="Select Role"
                      onChange={(v) => setSelectedUser({ ...selectedUser, role_id: v || '', role_name: v || '' })}
                    />
                  </div>
                </div>
                <div className="users-page-form-row">
                  <div className="users-page-form-group" ref={editManagerRef} style={{ position: 'relative' }}>
                    <label>Reports To (Manager)</label>
                    <div
                      onClick={() => { setEditManagerOpen(o => !o); setEditManagerSearch(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: `1px solid ${__sbg('#d1d5db')}`, borderRadius: 8, padding: '9px 12px',
                        cursor: 'pointer', background: __sbg('#fff'), fontSize: 14,
                        color: selectedUser.managerId ? __stc('#111827') : __stc('#9ca3af'), minHeight: 40
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedUser.managerId
                          ? (() => { const u = dropdownUsers.find(u => u.id === Number(selectedUser.managerId)); return u ? `${u.full_name} (${u.role_name})` : '-- None --'; })()
                          : '-- None --'}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    {editManagerOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                        background: __sbg('#fff'), border: `1px solid ${__sbg('#e5e7eb')}`, borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden'
                      }}>
                        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${__sbg('#f3f4f6')}` }}>
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search users..."
                            value={editManagerSearch}
                            onChange={e => {
                              const val = e.target.value;
                              setEditManagerSearch(val);
                              if (dropdownSearchTimer.current) clearTimeout(dropdownSearchTimer.current);
                              if (val.trim()) {
                                dropdownSearchTimer.current = setTimeout(() => searchDropdownUsers(val), 400);
                              } else {
                                fetchDropdownUsers();
                              }
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              width: '100%', border: `1px solid ${__sbg('#e5e7eb')}`, borderRadius: 6,
                              padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: __sbg('#fff'), color: __stc('#111827')
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {dropdownUsersLoading ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: 13, color: __stc('#9ca3af'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <FiLoader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading...
                            </div>
                          ) : (
                            <>
                          <div
                            onClick={() => { setSelectedUser({ ...selectedUser, managerId: null }); setEditManagerOpen(false); }}
                            style={{ padding: '9px 12px', fontSize: 13, color: __stc('#6b7280'), cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = __sbg('#f9fafb')}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >-- None --</div>
                          {dropdownUsers
                            .filter(u => u.id !== selectedUser.id)
                            .map(u => (
                              <div
                                key={u.id}
                                onClick={() => { setSelectedUser({ ...selectedUser, managerId: u.id }); setEditManagerOpen(false); }}
                                style={{
                                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                                  background: selectedUser.managerId === u.id ? __sbg('#eff6ff') : __sbg('transparent'),
                                  color: __stc('#111827')
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = __sbg('#f9fafb')}
                                onMouseLeave={e => e.currentTarget.style.background = selectedUser.managerId === u.id ? __sbg('#eff6ff') : 'transparent'}
                              >
                                <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                                <div style={{ fontSize: 11, color: __stc('#6b7280'), marginTop: 2 }}>{u.role_name}</div>
                              </div>
                          ))}
                          {dropdownUsers.filter(u => u.id !== selectedUser.id).length === 0 && (
                            <div style={{ padding: '10px 12px', fontSize: 13, color: __stc('#9ca3af'), textAlign: 'center' }}>No users found</div>
                          )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="users-page-form-group">
                    <label>Team</label>
                    <input type="text" value={selectedUser.team || ''} onChange={e => setSelectedUser({ ...selectedUser, team: e.target.value })} placeholder="e.g. Sales Team A" />
                  </div>
                </div>
                {/* FIX #7: designation in edit modal */}
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Designation</label>
                    <input type="text" value={selectedUser.designation || ''} onChange={e => setSelectedUser({ ...selectedUser, designation: e.target.value })} placeholder="e.g. Senior Sales Executive" />
                    <span style={{ fontSize: 12, color: __stc('#9ca3af'), marginTop: 4, display: 'block' }}>Job title shown in hierarchy chart</span>
                  </div>
                </div>
                <div className="users-page-form-group">
                  <label className="users-page-checkbox-label">
                    <input type="checkbox" checked={selectedUser.is_active} onChange={e => setSelectedUser({ ...selectedUser, is_active: e.target.checked })} />
                    <span>Active User</span>
                  </label>
                </div>
                <div style={{ marginTop: 20, padding: 12, background: __sbg('#f0f9ff'), borderRadius: 8, border: `1px solid ${__sbg('#bae6fd')}` }}>
                  <p style={{ margin: 0, fontSize: 14, color: __stc('#0369a1') }}><strong>Note:</strong> To edit permissions, use the permission buttons from the table row for this user.</p>
                </div>
              </div>
              <div className="users-page-modal-footer">
                <button type="button" className="users-page-btn users-page-btn-secondary" onClick={() => setShowEditUserModal(false)}>Cancel</button>
                <button type="submit" className="users-page-btn users-page-btn-primary" disabled={loading}>{loading ? 'Updating...' : 'Update User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  VIEW MENU PERMISSIONS  */}
      {showMenuPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div><h2>Menu Permissions - {selectedUser.full_name}</h2><p className="users-page-modal-subtitle">@{selectedUser.username}</p></div>
              <button className="users-page-modal-close" onClick={() => setShowMenuPermissionsModal(false)}><FiX size={18} /></button>
            </div>
            <div className="users-page-modal-body">
              <div className="users-page-permissions-summary"><strong>Total Assigned:</strong> {Object.values(selectedUserMenuPermissions).filter(v => v === 1).length}</div>
              <div className="users-page-permission-list">
                {menuPermissionsList.map(m => selectedUserMenuPermissions[m.dbField] === 1 && (
                  <div key={m.id} className="users-page-permission-item"><span className="users-page-permission-check"></span><div className="users-page-permission-details"><div className="users-page-permission-name">{m.name}</div></div></div>
                ))}
              </div>
              {Object.values(selectedUserMenuPermissions).filter(v => v === 1).length === 0 && <div className="users-page-empty-state"><p>No menu permissions assigned</p></div>}
            </div>
            <div className="users-page-modal-footer">
              <button className="users-page-btn users-page-btn-secondary" onClick={() => setShowMenuPermissionsModal(false)}>Close</button>
              <button className="users-page-btn users-page-btn-primary" onClick={() => { setShowMenuPermissionsModal(false); handleEditMenuPermissions(selectedUser); }}>Edit Permissions</button>
            </div>
          </div>
        </div>
      )}

      {/*  EDIT MENU PERMISSIONS  */}
      {showEditMenuPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div><h2>Edit Menu Permissions - {selectedUser.full_name}</h2><p className="users-page-modal-subtitle">Select menu access permissions</p></div>
              <button className="users-page-modal-close" onClick={() => setShowEditMenuPermissionsModal(false)}><FiX size={18} /></button>
            </div>
            <div className="users-page-modal-body">
              <div className="users-page-permissions-summary">
                <strong>Selected:</strong> {Object.values(selectedUserMenuPermissions).filter(v => v === 1).length} of {availableMenuPermissions.length}
                <button type="button" className="users-page-btn-select-all" style={{ marginLeft: 16 }} onClick={() => {
                  const allSel = availableMenuPermissions.every(m => selectedUserMenuPermissions[m.dbField] === 1);
                  const newP = { ...selectedUserMenuPermissions };  // ← preserve all existing keys
                  availableMenuPermissions.forEach(m => { newP[m.dbField] = allSel ? 0 : 1; });
                  setSelectedUserMenuPermissions(newP);
                }}>{availableMenuPermissions.every(m => selectedUserMenuPermissions[m.dbField] === 1) ? 'Deselect All' : 'Select All'}</button>
              </div>
              <div className="users-page-menu-permissions-grid">
                {availableMenuPermissions.map(m => (
                  <div key={m.id} className="users-page-menu-permission-item">
                    <label className="users-page-toggle-label">
                      <span className="users-page-menu-permission-name">{m.name}</span>
                      <label className="users-page-toggle users-page-toggle-small">
                        <input type="checkbox" checked={selectedUserMenuPermissions[m.dbField] === 1} onChange={() => handleToggleMenuPermission(m.dbField)} />
                        <span className="users-page-toggle-slider"></span>
                      </label>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="users-page-modal-footer">
              <button type="button" className="users-page-btn users-page-btn-secondary" onClick={() => setShowEditMenuPermissionsModal(false)}>Cancel</button>
              <button type="button" className="users-page-btn users-page-btn-primary" onClick={handleSaveMenuPermissions} disabled={loading}>{loading ? 'Saving...' : 'Save Permissions'}</button>
            </div>
          </div>
        </div>
      )}


      {/*  VIEW PAGE PERMISSIONS  */}
      {showUserPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div><h2>Page Permissions - {selectedUser.full_name}</h2>
                <p className="users-page-modal-subtitle">@{selectedUser.username} · {selectedUser.role_name}</p></div>
              <button className="users-page-modal-close" onClick={() => setShowUserPermissionsModal(false)}><FiX size={18} /></button>
            </div>

            <div className="users-page-modal-body" style={{ padding: 0 }}>

              {/* ── Summary bar ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: __sbg('#f8fafc'), borderBottom: `1px solid ${__sbg('#e2e8f0')}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: __stc('#374151') }}>Total Assigned</span>
                <span style={{ fontSize: 12, color: __stc('#6366f1'), fontWeight: 700 }}>
                  {selectedUserPermissions.length} permissions assigned
                </span>
              </div>

              {/* ── Module rows — read-only chips ── */}
              <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                {Object.entries(
                  groupPermissionsByModule(pagePermissionsStructure.filter(p => selectedUserPermissions.includes(p.id)))
                ).map(([mod, perms], groupIdx, arr) => (
                  <div key={mod} style={{ borderBottom: groupIdx === arr.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 12,
                      background: __sbg('#f5f3ff'), borderBottom: `1px solid ${__sbg('#f1f5f9')}`,
                    }}>
                      {/* Module name */}
                      <div style={{ minWidth: 160, fontSize: 13, fontWeight: 700, color: __stc('#0f172a'), display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: __sbg('#6366f1') }} />
                        {mod.charAt(0).toUpperCase() + mod.slice(1)}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: __sbg('#e0e7ff'), color: __stc('#4338ca') }}>
                          {perms.length}
                        </span>
                      </div>

                      {/* Read-only action chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                        {perms.map(p => {
                          const action = labelFromName(p.name);
                          const chipStyle = actionChipStyle(action, true);
                          return (
                            <span key={p.id} style={{ ...chipStyle, cursor: 'default' }}>
                              <FiCheckCircle size={11} />
                              {action.charAt(0).toUpperCase() + action.slice(1)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {selectedUserPermissions.length === 0 && (
                  <div className="users-page-empty-state"><p>No page permissions assigned</p></div>
                )}
              </div>
            </div>

            <div className="users-page-modal-footer">
              <button className="users-page-btn users-page-btn-secondary" onClick={() => setShowUserPermissionsModal(false)}>Close</button>
              <button className="users-page-btn users-page-btn-primary" onClick={() => { setShowUserPermissionsModal(false); handleEditUserPermissions(selectedUser); }}>Edit Permissions</button>
            </div>
          </div>
        </div>
      )}

      {/*  EDIT PAGE PERMISSIONS  */}
      {showEditUserPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal users-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div><h2>Edit Page Permissions - {selectedUser.full_name}</h2>
                <p className="users-page-modal-subtitle">Select feature permissions</p></div>
              <button className="users-page-modal-close" onClick={() => setShowEditUserPermissionsModal(false)}><FiX size={18} /></button>
            </div>

            <div className="users-page-modal-body" style={{ padding: 0 }}>

              {/* ── Summary bar with master select-all ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: __sbg('#f8fafc'), borderBottom: `1px solid ${__sbg('#e2e8f0')}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: __stc('#374151') }}>
                  <input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                    checked={assignablePagePerms.length > 0 && assignablePagePerms.every(p => selectedUserPermissions.includes(p.id))}
                    ref={el => {
                      if (el) el.indeterminate =
                        assignablePagePerms.some(p => selectedUserPermissions.includes(p.id)) &&
                        !assignablePagePerms.every(p => selectedUserPermissions.includes(p.id));
                    }}
                    onChange={e => {
                      if (e.target.checked) setSelectedUserPermissions(assignablePagePerms.map(p => p.id));
                      else setSelectedUserPermissions([]);
                    }}
                  />
                  Select All Permissions
                </label>
                <span style={{ fontSize: 12, color: __stc('#6366f1'), fontWeight: 600 }}>
                  {selectedUserPermissions.length} / {assignablePagePerms.length} selected
                </span>
              </div>

              {/* ── Module rows with inline action chips ── */}
              <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                {Object.entries(assignablePagePermsGrouped).map(([mod, perms], groupIdx) => {
                  const allGroupOn = perms.every(p => selectedUserPermissions.includes(p.id));
                  const someGroupOn = perms.some(p => selectedUserPermissions.includes(p.id));
                  const groupCount = perms.filter(p => selectedUserPermissions.includes(p.id)).length;
                  const isLast = groupIdx === Object.entries(assignablePagePermsGrouped).length - 1;

                  return (
                    <div key={mod} style={{ borderBottom: isLast ? 'none' : '1px solid #e2e8f0' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 12,
                        background: allGroupOn ? __sbg('#f5f3ff') : someGroupOn ? __sbg('#fafafa') : __sbg('#fff'),
                        borderBottom: `1px solid ${__sbg('#f1f5f9')}`,
                      }}>
                        {/* Group checkbox */}
                        <input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }}
                          checked={allGroupOn}
                          ref={el => { if (el) el.indeterminate = someGroupOn && !allGroupOn; }}
                          onChange={e => handleSelectAllUserPermissionsInModule(mod)}
                        />

                        {/* Module name */}
                        <div style={{ minWidth: 160, fontSize: 13, fontWeight: 700, color: __stc('#0f172a'), display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                            background: allGroupOn ? __sbg('#6366f1') : someGroupOn ? __sbg('#a5b4fc') : __sbg('#cbd5e1')
                          }} />
                          {mod.charAt(0).toUpperCase() + mod.slice(1)}
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                            background: allGroupOn ? __sbg('#e0e7ff') : __sbg('#f1f5f9'),
                            color: allGroupOn ? __stc('#4338ca') : __stc('#94a3b8')
                          }}>
                            {groupCount}/{perms.length}
                          </span>
                        </div>

                        {/* Action chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
                          {perms.map(p => {
                            const isOn = selectedUserPermissions.includes(p.id);
                            const action = labelFromName(p.name);
                            return (
                              <label key={p.id} style={actionChipStyle(action, isOn)}>
                                <input type="checkbox" checked={isOn} onChange={() => handleToggleUserPermission(p.id)}
                                  style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#6366f1' }} />
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
            </div>

            <div className="users-page-modal-footer">
              <button type="button" className="users-page-btn users-page-btn-secondary" onClick={() => setShowEditUserPermissionsModal(false)}>Cancel</button>
              <button type="button" className="users-page-btn users-page-btn-primary" onClick={handleSaveUserPermissions} disabled={loading}>{loading ? 'Saving...' : 'Save Permissions'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirm */}
      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}
        onConfirm={confirmDeleteUser}
        title={userToDelete?.is_active ? "Deactivate User" : "Delete User"}
        message={
          userToDelete?.is_active
            ? `"${userToDelete?.full_name}" is currently active. They will be marked as Inactive. Delete again to permanently remove.`
            : `"${userToDelete?.full_name}" is already inactive. Are you sure you want to permanently delete this user? This cannot be undone.`
        }
        confirmText={userToDelete?.is_active ? "Deactivate" : "Delete Permanently"}
        cancelText="Cancel"
        type={userToDelete?.is_active ? "warning" : "danger"} />
    </div>
  );
};

export default UsersPage;