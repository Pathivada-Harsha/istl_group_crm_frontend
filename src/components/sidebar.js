// Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BsArrowReturnRight } from "react-icons/bs";
import { IoChevronDown } from "react-icons/io5"; // Add this import
import '../components_css/sidebar.css';
import {useAuth} from '../hooks/useAuth';

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const location = useLocation();

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState({
    Main: true,
    Sales: false,
    Procurement: false,
    'Office Use': false
  });

  const {menuPermissions}=useAuth();

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }));
  };

  // Helper function to check if user has permission
  const hasPermission = (permission) => {
    if (!menuPermissions || !Array.isArray(menuPermissions)) return false;
    return menuPermissions.includes(permission);
  };

  // Helper function to get group abbreviation
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
          name: 'Analytics',
          path: '/analytics',
          permission: 'ANALYTICS',
          icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
        },
        {
          name: 'Documents',
          path: '/documents',
          permission: 'DOCUMENTS',
          icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
        },
        {
          name: 'Settings',
          path: '/settings',
          permission: 'SETTINGS',
          icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
        },
        {
          name: 'Follow-Ups',
          path: '/sales/followups',
          permission: 'FOLLOW_UPS',
          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
        },
        {
          name: 'Reports',
          path: '/reports',
          permission: 'REPORTS',
          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
        },
      ]
    },
    {
      title: 'Sales',
      collapsible: true,
      items: [{
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
          name: 'Estimation/Proposals',
          path: '/sales/proposals',
          permission: 'SALES_ESTIMATION',
          icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
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
        {
          name: 'Vendor Data',
          path: '/procurement/vendors',
          permission: 'PROCUREMENT_VENDERS',
          icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
        },
        {
          name: 'Quotations Recieved',
          path: '/procurement/procurementquatations',
          permission: 'PROCUREMENT_QUOTATIONS',
          icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        },
        {
          name: 'Purchase Orders',
          path: '/procurement/purchaseorders',
          permission: 'PROCUREMENT_PURCHASE_ORDERS',
          icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'
        },
        {
          name: 'Bills Received',
          path: '/procurement/billsrecieved',
          permission: 'PROCUREMENT_BILLS',
          icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
        },
      ]
    },
    {
      title: 'Office Use',
      collapsible: true,
      items: [
        {
          name: 'Add New Group / Project',
          path: '/officeuse/addgroupproject',
          permission: 'OFFICE_USE',
          icon: 'M12 4v16m8-8H4'
        }
      ]
    }

  ];

  // Filter menu groups and items based on permissions
  const filteredMenuGroups = menuGroups.map(group => {
    const filteredItems = group.items.filter(item => 
      hasPermission(item.permission)
    );

    return {
      ...group,
      items: filteredItems
    };
  }).filter(group => {
    if (group.title === 'Main') {
      return group.items.length > 0;
    }
    return group.items.length > 0;
  });

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      
      {/* Collapse button - outside sidebar, desktop only */}
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
                  {/* Group Header */}
                  {showHeader && (
                    <div
                      className={`sidebar-group-header ${group.collapsible ? 'collapsible' : ''} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => group.collapsible && toggleGroup(group.title)}
                      data-full-name={group.title}
                    >
                      <span className="sidebar-group-title">{group.title}</span>
                      
                      {/* Abbreviation with dropdown arrow when collapsed */}
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

                      {/* Regular chevron for expanded view */}
                      {group.collapsible && (
                        <svg
                          className={`sidebar-group-chevron ${isExpanded ? 'expanded' : ''}`}
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Group Items */}
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
                          {group.collapsible && showHeader && <BsArrowReturnRight className="child-connector" />}
                          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={item.icon}
                            />
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