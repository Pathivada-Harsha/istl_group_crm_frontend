// sidebar.js
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BsArrowReturnRight } from "react-icons/bs";
import { IoChevronDown } from "react-icons/io5";
import '../components_css/sidebar.css';
import { useAuth } from '../hooks/useAuth';

const API = process.env.REACT_APP_API_URL;

// Group display order in the sidebar
const GROUP_ORDER = ['Main', 'Sales', 'Procurement', 'Office Use'];

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();
  const { menuPermissions } = useAuth();

  const [expandedGroups, setExpandedGroups] = useState({
    Main: true,
    Sales: false,
    Procurement: false,
    'Office Use': false
  });

  // Fetched from DB — keyed by permission_key (e.g. "DASHBOARD")
  // Each value: { displayName, routePath, sidebarGroup, sortOrder, icon }
  const [menuDefinitions, setMenuDefinitions] = useState({});

  // ─── Load menu definitions from DB on mount ───────────────────────────────
  // When a new page is inserted into menu_items, it will automatically appear
  // here without any code change.
  useEffect(() => {
    fetch(`${API}/menu-permissions/getAllMenuItems`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const defs = {};
        data.forEach(m => {
          if (!m.permissionKey) return;
          defs[m.permissionKey] = {
            displayName: m.displayName || m.name || m.permissionKey,
            routePath:   m.routePath   || '/',
            sidebarGroup: m.sidebarGroup || 'Main',
            sortOrder:   m.sortOrder   || 0,
            icon:        m.iconPath    || 'M4 6h16M4 12h16M4 18h16' // fallback icon
          };
        });
        setMenuDefinitions(defs);
      })
      .catch(() => {
        // If the fetch fails (e.g. not yet logged in), silently ignore.
        // menuDefinitions stays empty and the sidebar shows nothing,
        // which is the correct behaviour before login.
      });
  }, []);

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  const getGroupAbbreviation = (groupTitle) => {
    return { Sales: 'S', Procurement: 'P', 'Office Use': 'O' }[groupTitle] || groupTitle.charAt(0);
  };

  // Build the sidebar dynamically from:
  //   menuPermissions  — what THIS user is allowed to see (array of permission_key strings)
  //   menuDefinitions  — display metadata loaded from DB (keyed by permission_key)
  const buildMenuGroups = () => {
    const grouped = {};

    (menuPermissions || []).forEach(permKey => {
      const def = menuDefinitions[permKey];
      if (!def) return; // DB row not loaded yet or permission_key not in menu_items
      const group = def.sidebarGroup;
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({
        name:      def.displayName,
        path:      def.routePath,
        icon:      def.icon,
        sortOrder: def.sortOrder
      });
    });

    // Sort items within each group by sort_order
    Object.keys(grouped).forEach(g =>
      grouped[g].sort((a, b) => a.sortOrder - b.sortOrder)
    );

    // Return groups in the fixed display order, skipping empty ones
    return GROUP_ORDER
      .filter(g => grouped[g] && grouped[g].length > 0)
      .map(g => ({
        title:      g,
        collapsible: g !== 'Main',
        items:      grouped[g]
      }));
  };

  const filteredMenuGroups = buildMenuGroups();

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      <button
        className="sidebar-external-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? ">" : "<"}
      </button>

      <aside className={`sidebar ${isOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-content">
          <nav className="sidebar-nav">
            {filteredMenuGroups.map(group => {
              const isExpanded = expandedGroups[group.title];
              const showHeader = group.title !== 'Main';

              return (
                <div key={group.title} className="sidebar-group">
                  {showHeader && (
                    <div
                      className={`sidebar-group-header ${group.collapsible ? 'collapsible' : ''} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => group.collapsible && toggleGroup(group.title)}
                      data-full-name={group.title}
                    >
                      <span className="sidebar-group-title">{group.title}</span>

                      <div className="sidebar-group-abbreviation-container">
                        <span className="sidebar-group-abbreviation">
                          {getGroupAbbreviation(group.title)}
                        </span>
                        {group.collapsible && (
                          <IoChevronDown
                            className={`sidebar-group-collapsed-arrow ${isExpanded ? 'expanded' : ''}`}
                            size={14}
                          />
                        )}
                      </div>

                      {group.collapsible && (
                        <svg
                          className={`sidebar-group-chevron ${isExpanded ? 'expanded' : ''}`}
                          width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  )}

                  <div className={`sidebar-group-items ${isExpanded ? 'expanded' : 'collapsed'}`}>
                    {group.items.map(item => {
                      const active = location.pathname === item.path;
                      return (
                        <Link
                          key={item.name}
                          to={item.path}
                          onClick={onClose}
                          className={`sidebar-item ${active ? "active" : ""} ${group.collapsible && showHeader ? 'child-item' : ''}`}
                          title={item.name}
                        >
                          {group.collapsible && showHeader && (
                            <BsArrowReturnRight className="child-connector" />
                          )}
                          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                          </svg>
                          <span className="sidebar-label">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;