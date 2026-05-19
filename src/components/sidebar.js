import React, { useEffect,useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BsArrowReturnRight } from "react-icons/bs";
import { IoChevronDown } from "react-icons/io5";
import '../components_css/sidebar.css';
import { useAuth } from '../hooks/useAuth';

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();

  const [expandedGroups, setExpandedGroups] = useState({
    Main: true,
    Sales: false,
    Procurement: false,
    'Office Use': false
  });

  const { menuPermissions, user } = useAuth();
  const [liveMenuPermissions, setLiveMenuPermissions] = useState(menuPermissions);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${process.env.REACT_APP_API_URL}/login/menuPermissions/${user.id}`, {
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0 && data[0] !== 'No Menu Permissions') {
          setLiveMenuPermissions(data);
        }
      })
      .catch(() => {}); 
  }, [user?.id]);

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }));
  };

  const hasPermission = (permission) => {
    return liveMenuPermissions?.includes(permission);
  };

  const getGroupAbbreviation = (groupTitle) => {
    const abbreviations = {
      'Sales': 'S',
      'Procurement': 'P',
      'Office Use': 'O'
    };
    return abbreviations[groupTitle] || groupTitle.charAt(0);
  };

    const menuGroups = [
    {
      title: 'Main',
      items: [
        {
          name: 'Dashboard',
          path: '/dashboard',
          permission: 'DASHBOARD',
          icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
        },
        {
          name: 'Project Dashboard',
          path: '/project-over-view',
          permission: 'PROJECT_DASHBOARD',
          icon: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 4v8m4-5v5m4-3v3'
        },
        {
          name: 'Follow-Ups',
          path: '/follow-ups',
          permission: 'FOLLOW_UPS',
          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
        },
        {
          name: 'Reports',
          path: '/reports',
          permission: 'REPORTS',
          icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
        },
        {
          name: 'Project Cost & Expenses',
          path: '/project-cost-expense',
          permission: 'PROJECT_COST_EXPENSE',
          icon: 'M7 4h10M7 8h10M10 8c3 0 5 2 5 4s-2 4-5 4H7m4 0l5 5'
        },
        {
          name: 'Task Management',
          path: '/taskmanagement',
          permission: 'TASK_MANAGEMENT',
          icon: 'M9 5l2 2 4-4M7 13h10M7 17h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z'
        },
        
      ]
    },
    {
      title: 'Sales',
      collapsible: true,
      items: [
        {
          name: 'Leads / Enquiries',
          path: '/sales/leads',
          permission: 'SALES_LEADS',
          icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
        },
        {
          name: 'Clients Data',
          path: '/sales/clients',
          permission: 'SALES_CLIENTS',
          icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4'
        },
        {
          name: 'OrderBook',
          path: '/order-book',
          permission: 'SALES_ORDERBOOK',
          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
        },
        {
          name: 'Invoices',
          path: '/sales/invoices',
          permission: 'INVOICES',
          icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z'
        },
      ]
    },
     {
      title: 'Procurement',
      collapsible: true,
      items: [
        { name: 'Vendor Data', path: '/procurement/vendors', permission: 'PROCUREMENT_VENDERS', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { name: 'Quotations Recieved', path: '/procurement/quotations', permission: 'PROCUREMENT_QUOTATIONS_RECEIVED', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'},
        { name: 'Purchase Orders', path: '/procurement/purchase-orders', permission: 'PROCUREMENT_PURCHASE_ORDERS', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
        { name: 'Bills Received', path: '/procurement/bills-recieved', permission: 'PROCUREMENT_BILLS_RECEIVED', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }
      ]
    },
    {
      title: 'Office Use',
      collapsible: true,
      items: [
        {
          name: 'Add New Group / Project',
          path: '/officeuse/add-group-project',
          permission: 'OFFICE_USE',
          icon: 'M12 4v16m8-8H4'
        },
        {
          name: 'Add New Roles / Permissions',
          path: '/officeuse/roles-permissions',
          permission: 'OFFICE_USE',
          icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 4a6.94 6.94 0 00-.1-1l2.02-1.57-2-3.46-2.38.96a7.02 7.02 0 00-1.73-1l-.36-2.54h-4l-.36 2.54a7.02 7.02 0 00-1.73 1l-2.38-.96-2 3.46 2.02 1.57a6.94 6.94 0 000 2l-2.02 1.57 2 3.46 2.38-.96a7.02 7.02 0 001.73 1l.36 2.54h4l.36-2.54a7.02 7.02 0 001.73-1l2.38.96 2-3.46-2.02-1.57c.07-.33.1-.66.1-1z'
        },
        {
          name: 'Project Access Manager',
          path: '/officeuse/projectaccess',
          permission: 'OFFICE_USE',
          icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 4a6.94 6.94 0 00-.1-1l2.02-1.57-2-3.46-2.38.96a7.02 7.02 0 00-1.73-1l-.36-2.54h-4l-.36 2.54a7.02 7.02 0 00-1.73 1l-2.38-.96-2 3.46 2.02 1.57a6.94 6.94 0 000 2l-2.02 1.57 2 3.46 2.38-.96a7.02 7.02 0 001.73 1l.36 2.54h4l.36-2.54a7.02 7.02 0 001.73-1l2.38.96 2-3.46-2.02-1.57c.07-.33.1-.66.1-1z'
        },
        // ── NEW ──────────────────────────────────────────────────────────────
        // {
        //   name: 'Role Hierarchy',
        //   path: '/officeuse/role-hierarchy',
        //   permission: 'OFFICE_USE',
        //   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
        // },
        // ─────────────────────────────────────────────────────────────────────
      ]
    }
  ];
  const filteredMenuGroups = menuGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasPermission(item.permission))
    }))
    .filter(group => group.items.length > 0);

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      <button
        className="sidebar-external-collapse-btn"
        onClick={onToggleCollapse}
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
                      className={`sidebar-group-header collapsible ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleGroup(group.title)}
                      data-full-name={group.title}
                    >
                      <span className="sidebar-group-title">{group.title}</span>

                      <div className="sidebar-group-abbreviation-container">
                        <span className="sidebar-group-abbreviation">
                          {getGroupAbbreviation(group.title)}
                        </span>
                        <IoChevronDown
                          className={`sidebar-group-collapsed-arrow ${isExpanded ? 'expanded' : ''}`}
                          size={14}
                        />
                      </div>

                      <svg
                        className={`sidebar-group-chevron ${isExpanded ? 'expanded' : ''}`}
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
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
                            <path strokeWidth={2} d={item.icon} />
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