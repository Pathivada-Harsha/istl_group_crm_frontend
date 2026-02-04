import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus, X, Edit2, Eye, Star, TrendingUp, DollarSign, IndianRupee,Package, Calendar, Phone, Mail, MapPin, ShoppingCart, FileText, CheckCircle, Clock, Building2, User, Tag, Briefcase, Truck } from 'lucide-react';
import '../pages-css/Procurement-Vendor-Management.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import vendorApi from '../services/vendorApi';
import filterApi from '../services/filterApi';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    category: 'all',   
    vendorType: 'all',
    rating: 'all',
    status: 'all'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const pageSize = 10;

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorPurchaseOrders, setVendorPurchaseOrders] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Modal dropdown state for Add/Edit vendor form
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({
    groups: false,
    subGroups: false,
    projects: false
  });

  const [availableUsers, setAvailableUsers] = useState([]);

  // Fetch vendors on mount and filter change
  useEffect(() => {
    fetchVendors();
  }, [groupName, subGroupName, projectId, currentPage, filters.search, filters.status, filters.category]);

  // Fetch stats on mount AND when filters change
  useEffect(() => {
    fetchStats();
  }, [groupName, subGroupName, projectId]);

  /**
   * Get auth headers
   */
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

  /**
   * Fetch available users for assignment dropdown
   */
  const fetchAvailableUsers = async () => {
    try {
      const users = await filterApi.getLeadsUsers();
      setAvailableUsers(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  /**
   * Fetch modal groups when opening add/edit form
   */
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups);
    } catch (error) {
      console.error('Failed to fetch modal groups:', error);
      showError('Failed to load groups');
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, groups: false }));
    }
  };

  /**
   * Fetch modal subgroups when group is selected
   */
  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) {
      setModalSubGroups([]);
      setModalProjects([]);
      return;
    }

    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(groupName);
      setModalSubGroups(subGroups);
    } catch (error) {
      console.error('Failed to fetch modal subgroups:', error);
      showError('Failed to load categories');
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, subGroups: false }));
    }
  };

  /**
   * Fetch modal projects when subgroup is selected
   */
  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) {
      setModalProjects([]);
      return;
    }

    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(groupName, subGroupName);
      setModalProjects(projects);
    } catch (error) {
      console.error('Failed to fetch modal projects:', error);
      showError('Failed to load projects');
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, projects: false }));
    }
  };

  /**
   * Handle modal group change
   */
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);

    setEditFormData(prev => ({
      ...prev,
      groupName: newGroupName,
      subGroupName: '',
      projectId: ''
    }));

    if (newGroupName) {
      fetchModalSubGroups(newGroupName);
    }
  };

  /**
   * Handle modal subgroup change
   */
  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setModalProjects([]);

    setEditFormData(prev => ({
      ...prev,
      subGroupName: newSubGroupName,
      projectId: ''
    }));

    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
    }
  };

  /**
   * Handle modal project change
   */
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);

    setEditFormData(prev => ({
      ...prev,
      projectId: newProjectId
    }));
  };

  /**
   * Handle add new vendor button
   */
  const handleAddNewVendor = () => {
    setEditFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      website: '',
      gstNumber: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      rating: 0,
      status: 'Active',
      groupName: '',
      subGroupName: '',
      projectId: '',
      vendorType: '',
      category: '',
      notes: '',
      assignedTo: ''
    });
    setModalGroupName('');
    setModalSubGroupName('');
    setModalProjectId('');
    setModalGroups([]);
    setModalSubGroups([]);
    setModalProjects([]);

    fetchModalGroups();
    setShowCreateModal(true);
  };

  /**
   * Handle create vendor
   */
  const handleCreateVendor = async () => {
    if (!editFormData.name || !editFormData.name.trim()) {
      showError('Vendor name is required');
      return;
    }

    if (!editFormData.email || !editFormData.email.trim()) {
      showError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editFormData.email)) {
      showError('Please enter a valid email address');
      return;
    }

    if (!editFormData.category || editFormData.category === '') {
      showError('Category is required');
      return;
    }

    if (!editFormData.vendorType || editFormData.vendorType === '') {
      showError('Vendor type is required');
      return;
    }

    setLoading(true);
    try {
      await vendorApi.createVendor(editFormData);
      showSuccess('Vendor created successfully!');
      setShowCreateModal(false);
      fetchVendors();
      fetchStats();
    } catch (error) {
      console.error('Failed to create vendor:', error);
      showError(error.message || 'Failed to create vendor');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch vendors from backend
   */
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        size: pageSize,
        sortBy: 'lastPurchaseDate',
        sortDirection: 'DESC'
      });

      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.search) params.append('searchTerm', filters.search);

      const response = await fetch(`${API_BASE_URL}/api/vendors?${params}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      });

      if (!response.ok) throw new Error('Failed to fetch vendors');

      const data = await response.json();
      setVendors(data.vendors || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);

    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      showError('Failed to load vendors');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch statistics with filters
   */
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);

      const response = await fetch(`${API_BASE_URL}/api/vendors/stats?${params}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  /**
   * View vendor details with purchase history
   */
  const handleViewVendor = async (vendor) => {
    setLoading(true);
    try {
      const vendorResponse = await fetch(`${API_BASE_URL}/api/vendors/${vendor.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (!vendorResponse.ok) throw new Error('Failed to fetch vendor details');
      const vendorData = await vendorResponse.json();
      setSelectedVendor(vendorData);

      const posResponse = await fetch(`${API_BASE_URL}/api/purchase-orders/vendor/${vendor.id}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });

      if (posResponse.ok) {
        const posData = await posResponse.json();
        setVendorPurchaseOrders(posData);
      } else {
        setVendorPurchaseOrders([]);
      }

      setShowDetailDrawer(true);

    } catch (error) {
      console.error('Failed to fetch vendor details:', error);
      showError('Failed to load vendor details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open edit modal
   */
  const handleEditVendor = (vendor) => {
    setEditFormData({
      id: vendor.id,
      name: vendor.name || '',
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      website: vendor.website || '',
      gstNumber: vendor.gstNumber || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      rating: vendor.rating || 0,
      status: vendor.status || 'Active',
      vendorType: vendor.vendorType || '',
      category: vendor.category || '',
      notes: vendor.notes || '',
      assignedTo: vendor.assignedTo || '',
      groupName: vendor.groupName || '',
      subGroupName: vendor.subGroupName || '',
      projectId: vendor.projectId || ''
    });

    setModalGroupName(vendor.groupName || '');
    setModalSubGroupName(vendor.subGroupName || '');
    setModalProjectId(vendor.projectId || '');

    fetchModalGroups();
    if (vendor.groupName) {
      fetchModalSubGroups(vendor.groupName);
      if (vendor.subGroupName) {
        fetchModalProjects(vendor.groupName, vendor.subGroupName);
      }
    }

    setShowEditModal(true);
  };

  /**
   * Update vendor
   */
  const handleUpdateVendor = async () => {
    if (!editFormData.name || !editFormData.email) {
      showError('Please fill in required fields (Name, Email)');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/${editFormData.id}`, {
        credentials: "include",
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(editFormData)
      });

      if (!response.ok) throw new Error('Failed to update vendor');

      showSuccess('Vendor updated successfully!');
      setShowEditModal(false);
      fetchVendors();
      fetchStats();

      if (showDetailDrawer && selectedVendor?.id === editFormData.id) {
        handleViewVendor({ id: editFormData.id });
      }

    } catch (error) {
      console.error('Failed to update vendor:', error);
      showError('Failed to update vendor');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete vendor (soft delete)
   */
  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm('Are you sure you want to deactivate this vendor?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors/${vendorId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: "include",
      });

      if (!response.ok) throw new Error('Failed to deactivate vendor');

      showSuccess('Vendor deactivated successfully');
      setShowDetailDrawer(false);
      fetchVendors();
      fetchStats();

    } catch (error) {
      console.error('Failed to delete vendor:', error);
      showError('Failed to deactivate vendor');
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return `${amount.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Format time ago
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'N/A';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return formatDate(dateStr);
  };

  // Render star rating
  const renderStarRating = (rating) => {
    if (!rating) return <span className="no-rating">Not rated</span>;

    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            fill={star <= rating ? '#f59e0b' : 'none'}
            stroke={star <= rating ? '#f59e0b' : '#d1d5db'}
          />
        ))}
      </div>
    );
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    return status === 'Active' ? 'vendor-badge-active' : 'vendor-badge-inactive';
  };

  // PO Timeline Component
  const POTimeline = ({ po }) => {
    const getStatusColor = (status) => {
      const colors = {
        'Draft': '#94a3b8',
        'Approved': '#3b82f6',
        'Ordered': '#8b5cf6',
        'In-Transit': '#f59e0b',
        'Delivered': '#22c55e',
        'Cancelled': '#ef4444'
      };
      return colors[status] || '#94a3b8';
    };

    const statusSteps = ['Draft', 'Approved', 'Ordered', 'In-Transit', 'Delivered'];
    const currentIndex = statusSteps.indexOf(po.status);

    return (
      <div className="po-timeline">
        {statusSteps.map((step, index) => (
          <div 
            key={step} 
            className={`timeline-step ${index <= currentIndex ? 'completed' : ''}`}
          >
            <div 
              className="timeline-dot" 
              style={{ 
                backgroundColor: index <= currentIndex ? getStatusColor(step) : '#e2e8f0' 
              }}
            />
            <div className="timeline-label">
              <span className="timeline-status">{step}</span>
              {index === currentIndex && (
                <span className="timeline-date">{formatDate(po.orderDate)}</span>
              )}
            </div>
            {index < statusSteps.length - 1 && (
              <div 
                className="timeline-line" 
                style={{ 
                  backgroundColor: index < currentIndex ? getStatusColor(step) : '#e2e8f0' 
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // KPI data from stats
  const kpiData = stats ? [
    { 
      title: 'Total Vendors', 
      value: stats.totalVendors.toString(), 
      icon: <Package size={32} />, 
      color: '#2563eb' 
    },
    { 
      title: 'Approved Vendors', 
      value: stats.activeVendors.toString(), 
      icon: <CheckCircle size={32} />, 
      color: '#22c55e' 
    },
    { 
      title: 'Average Rating', 
      value: stats.averageRating.toFixed(1) + '/5', 
      icon: <Star size={32} />, 
      color: '#f59e0b' 
    },
    { 
      title: 'Total Purchase Value', 
      value: formatCurrency(stats.totalPurchaseValue), 
      icon: <IndianRupee size={32} />, 
      color: '#8b5cf6' 
    },
    { 
      title: 'Pending Quotations', 
      value: stats.pendingQuotations.toString(), 
      icon: <FileText size={32} />, 
      color: '#06b6d4' 
    },
    { 
      title: 'Last Updated', 
      value: formatTimeAgo(stats.lastUpdated), 
      icon: <Clock size={32} />, 
      color: '#64748b' 
    }
  ] : [];

  return (
    <div className="vendor-management-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="vendor-management-header">
        <div className="vendor-management-breadcrumb">
          Dashboard &gt; Procurement &gt; Vendor Management
        </div>

        <div className="page-header-with-filter">
          <h1 className="vendor-management-title">
            Vendor Management <span className="vendor-management-count">({totalElements})</span>
          </h1>
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="vendor-management-action-bar">
        <div className="vendor-management-search-filters">
          <input
            type="text"
            placeholder="Search by name, email, phone, code..."
            className="vendor-management-search"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(0);
            }}
          />

          <select
            className="vendor-management-filter"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            className="vendor-management-filter"
            value={filters.category}
            onChange={(e) => {
              setFilters({ ...filters, category: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Categories</option>
            <option value="IT Equipment">IT Equipment</option>
            <option value="Office Furniture">Office Furniture</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Office Supplies">Office Supplies</option>
          </select>
        </div>

        <div className="vendor-management-actions">
          <button
            className="vendor-management-btn-primary"
            onClick={handleAddNewVendor}
          >
            <Plus size={18} /> Add Vendor
          </button>
          <button className="vendor-management-btn-secondary">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="vendor-management-kpi-grid">
          {kpiData.map((kpi, index) => (
            <div key={index} className="vendor-management-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="vendor-management-kpi-icon" style={{ color: kpi.color }}>
                {kpi.icon}
              </div>
              <div className="vendor-management-kpi-content">
                <div className="vendor-management-kpi-value">{kpi.value}</div>
                <div className="vendor-management-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vendors Table */}
      <div className="vendor-management-table-container">
        <table className="vendor-management-table">
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>Contact</th>
              <th>Category</th>
              <th>Rating</th>
              <th>Total Orders</th>
              <th>Total Purchase Value</th>
              <th>Last Purchase</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  No vendors found. Vendors appear here after placing purchase orders.
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr key={vendor.id} className="vendor-management-table-row">
                  <td className="vendor-name-cell">
                    <div className="vendor-name-info">
                      <span className="vendor-name">{vendor.name}</span>
                      {vendor.vendorCode && (
                        <span className="vendor-code">{vendor.vendorCode}</span>
                      )}
                    </div>
                  </td>
                  <td className="vendor-contact-cell">
                    <div className="vendor-contact">
                      {vendor.email && (
                        <div className="contact-item">
                          <Mail size={14} />
                          <span>{vendor.email}</span>
                        </div>
                      )}
                      {vendor.phone && (
                        <div className="contact-item">
                          <Phone size={14} />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{vendor.category || 'N/A'}</td>
                  <td>{renderStarRating(vendor.rating)}</td>
                  <td className="vendor-orders-cell">
                    <div className="orders-badge">
                      <ShoppingCart size={14} />
                      <span>{vendor.totalOrders || 0}</span>
                    </div>
                  </td>
                  <td className="vendor-value-cell">{formatCurrency(vendor.totalPurchaseValue)}</td>
                  <td>{formatDate(vendor.lastPurchaseDate)}</td>
                  <td>
                    <span className={`vendor-management-badge ${getStatusBadgeClass(vendor.status)}`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td>
                    <div className="vendor-management-actions-cell">
                      <button
                        className="vendor-management-action-btn"
                        onClick={() => handleViewVendor(vendor)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="vendor-management-action-btn"
                        onClick={() => handleEditVendor(vendor)}
                        title="Edit Vendor"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="table-footer">
          <span>
            Showing {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} vendors
          </span>
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </button>

            {[...Array(Math.min(5, totalPages))].map((_, index) => {
              const pageNum = currentPage < 3 ? index : currentPage + index - 2;
              if (pageNum >= 0 && pageNum < totalPages) {
                return (
                  <button
                    key={pageNum}
                    className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum + 1}
                  </button>
                );
              }
              return null;
            })}

            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {showDetailDrawer && selectedVendor && (
        <div className="vendor-management-drawer-overlay" onClick={() => setShowDetailDrawer(false)}>
          <div className="vendor-management-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="vendor-management-drawer-header">
              <div>
                <h2>{selectedVendor.name}</h2>
                <p className="vendor-management-drawer-subtitle">{selectedVendor.vendorCode}</p>
              </div>
              <button className="vendor-management-drawer-close" onClick={() => setShowDetailDrawer(false)}>
                ✕
              </button>
            </div>

            <div className="vendor-management-drawer-content">
              {/* Vendor Information */}
              <div className="vendor-management-drawer-section">
                <h3>Vendor Information</h3>
                <div className="vendor-info-grid">
                  <div className="vendor-info-item">
                    <Building2 size={18} />
                    <div>
                      <span className="info-label">Vendor Code</span>
                      <span className="info-value">{selectedVendor.vendorCode || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <User size={18} />
                    <div>
                      <span className="info-label">Contact Person</span>
                      <span className="info-value">{selectedVendor.contactPerson || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <Mail size={18} />
                    <div>
                      <span className="info-label">Email</span>
                      <span className="info-value">{selectedVendor.email || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <Phone size={18} />
                    <div>
                      <span className="info-label">Phone</span>
                      <span className="info-value">{selectedVendor.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <FileText size={18} />
                    <div>
                      <span className="info-label">GST Number</span>
                      <span className="info-value">{selectedVendor.gstNumber || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <MapPin size={18} />
                    <div>
                      <span className="info-label">Address</span>
                      <span className="info-value">
                        {selectedVendor.address ?
                          `${selectedVendor.address}, ${selectedVendor.city}, ${selectedVendor.state} ${selectedVendor.pincode}`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <Tag size={18} />
                    <div>
                      <span className="info-label">Category</span>
                      <span className="info-value">{selectedVendor.category || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <Briefcase size={18} />
                    <div>
                      <span className="info-label">Vendor Type</span>
                      <span className="info-value">{selectedVendor.vendorType || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <Star size={18} />
                    <div>
                      <span className="info-label">Rating</span>
                      {renderStarRating(selectedVendor.rating)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Statistics */}
              <div className="vendor-management-drawer-section">
                <h3>Purchase Statistics</h3>
                <div className="vendor-stats-grid">
                  <div className="vendor-stat-card">
                    <ShoppingCart size={24} />
                    <div>
                      <div className="stat-value">{selectedVendor.totalOrders || 0}</div>
                      <div className="stat-label">Total Orders</div>
                    </div>
                  </div>
                  <div className="vendor-stat-card">
                    <IndianRupee size={24} />
                    <div>
                      <div className="stat-value">{formatCurrency(selectedVendor.totalPurchaseValue)}</div>
                      <div className="stat-label">Total Purchase Value</div>
                    </div>
                  </div>
                  <div className="vendor-stat-card">
                    <Calendar size={24} />
                    <div>
                      <div className="stat-value">{formatDate(selectedVendor.lastPurchaseDate)}</div>
                      <div className="stat-label">Last Purchase</div>
                    </div>
                  </div>
                  <div className="vendor-stat-card">
                    <IndianRupee size={24} />
                    <div>
                      <div className="stat-value">{formatCurrency(selectedVendor.lastPurchaseAmount)}</div>
                      <div className="stat-label">Last Purchase Amount</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase History with Timeline */}
              <div className="vendor-management-drawer-section">
                <h3>Purchase History ({vendorPurchaseOrders.length} Orders)</h3>
                {vendorPurchaseOrders.length === 0 ? (
                  <p className="empty-state">No purchase orders found</p>
                ) : (
                  <div className="purchase-history-list">
                    {vendorPurchaseOrders.map((po) => (
                      <div key={po.id} className="purchase-history-item">
                        <div className="po-item-header">
                          <div>
                            <span className="po-number">{po.poNo}</span>
                            <span className={`vendor-management-badge ${getStatusBadgeClass(po.status)}`}>
                              {po.status}
                            </span>
                          </div>
                          <span className="po-value">{formatCurrency(po.totalValue)}</span>
                        </div>
                        
                        {/* PO Timeline */}
                        <POTimeline po={po} />
                        
                        <div className="po-item-details">
                          <span><Calendar size={14} /> Order: {formatDate(po.orderDate)}</span>
                          <span><Truck size={14} /> Expected: {formatDate(po.expectedDelivery)}</span>
                          <span><Package size={14} /> {po.totalItemsOrdered} items ({po.totalItemsDelivered} delivered)</span>
                        </div>
                        
                        {po.notes && (
                          <div className="po-notes">
                            <FileText size={14} />
                            <span>{po.notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="vendor-management-drawer-actions">
                <button
                  className="vendor-management-btn-primary"
                  onClick={() => handleEditVendor(selectedVendor)}
                >
                  Edit Vendor
                </button>
                {selectedVendor.status === 'Active' && (
                  <button
                    className="vendor-management-btn-danger"
                    onClick={() => handleDeleteVendor(selectedVendor.id)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <div className="vendor-management-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="vendor-management-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vendor-management-modal-header">
              <h2>Edit Vendor</h2>
              <button className="vendor-management-modal-close" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <div className="vendor-management-edit-form">
              <div className="vendor-form-section">
                <h3>Basic Information</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Vendor Name *</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="Enter vendor name"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>Contact Person</label>
                    <input
                      type="text"
                      value={editFormData.contactPerson}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                      placeholder="Enter contact person"
                    />
                  </div>
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      placeholder="Enter phone"
                    />
                  </div>
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Category</label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    >
                      <option value="">Select category</option>
                      <option value="IT Equipment">IT Equipment</option>
                      <option value="Office Furniture">Office Furniture</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Office Supplies">Office Supplies</option>
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Rating</label>
                    <select
                      value={editFormData.rating}
                      onChange={(e) => setEditFormData({ ...editFormData, rating: parseInt(e.target.value) })}
                    >
                      <option value="0">Not Rated</option>
                      <option value="1">⭐ 1 Star</option>
                      <option value="2">⭐⭐ 2 Stars</option>
                      <option value="3">⭐⭐⭐ 3 Stars</option>
                      <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                      <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                    </select>
                  </div>
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>GST Number</label>
                    <input
                      type="text"
                      value={editFormData.gstNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })}
                      placeholder="Enter GST number"
                    />
                  </div>
                </div>
              </div>

              <div className="vendor-form-section">
                <h3>Address</h3>
                <div className="vendor-form-group">
                  <label>Address</label>
                  <textarea
                    rows={2}
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={editFormData.state}
                      onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                      placeholder="Enter state"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>Pincode</label>
                    <input
                      type="text"
                      value={editFormData.pincode}
                      onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                      placeholder="Enter pincode"
                    />
                  </div>
                </div>
              </div>

              <div className="vendor-form-section">
                <h3>Additional Information</h3>
                <div className="vendor-form-group">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    placeholder="Enter any additional notes"
                  />
                </div>
              </div>
            </div>

            <div className="vendor-management-modal-actions">
              <button className="vendor-management-btn-primary" onClick={handleUpdateVendor}>
                Save Changes
              </button>
              <button className="vendor-management-btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Vendor Modal */}
      {showCreateModal && editFormData && (
        <div className="vendor-management-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="vendor-management-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vendor-management-modal-header">
              <h2>Add New Vendor</h2>
              <button className="vendor-management-modal-close" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <div className="vendor-management-edit-form">
              {/* Project Assignment Section */}
              <div className="vendor-form-section">
                <h3>Project Assignment</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Group</label>
                    <select
                      value={modalGroupName}
                      onChange={handleModalGroupChange}
                      disabled={modalDropdownLoading.groups}
                    >
                      <option value="">
                        {modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}
                      </option>
                      {modalGroups.map(group => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="vendor-form-group">
                    <label>Category / Sub-Group</label>
                    <select
                      value={modalSubGroupName}
                      onChange={handleModalSubGroupChange}
                      disabled={!modalGroupName || modalDropdownLoading.subGroups}
                    >
                      <option value="">
                        {!modalGroupName
                          ? 'Select Group First'
                          : modalDropdownLoading.subGroups
                            ? 'Loading...'
                            : 'Select Category'}
                      </option>
                      {modalSubGroups.map(subGroup => (
                        <option key={subGroup.value} value={subGroup.value}>
                          {subGroup.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="vendor-form-group">
                  <label>Project (Optional)</label>
                  <select
                    value={modalProjectId}
                    onChange={handleModalProjectChange}
                    disabled={!modalSubGroupName || modalDropdownLoading.projects}
                  >
                    <option value="">
                      {!modalSubGroupName
                        ? 'Select Category First'
                        : modalDropdownLoading.projects
                          ? 'Loading...'
                          : 'Select Project (Optional)'}
                    </option>
                    {modalProjects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name} - {project.location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Basic Information Section */}
              <div className="vendor-form-section">
                <h3>Basic Information</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Vendor Name *</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="Enter vendor name"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>Contact Person</label>
                    <input
                      type="text"
                      value={editFormData.contactPerson}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                      placeholder="Enter contact person"
                    />
                  </div>
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      placeholder="Enter phone"
                    />
                  </div>
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Category *</label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    >
                      <option value="">Select category</option>
                      <option value="IT Equipment">IT Equipment</option>
                      <option value="Office Furniture">Office Furniture</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Office Supplies">Office Supplies</option>
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Vendor Type *</label>
                    <select
                      value={editFormData.vendorType}
                      onChange={(e) => setEditFormData({ ...editFormData, vendorType: e.target.value })}
                    >
                      <option value="">Select type</option>
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Service Provider">Service Provider</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="vendor-form-section">
                <h3>Contact Information</h3>
                <div className="vendor-form-group">
                  <label>Website</label>
                  <input
                    type="url"
                    value={editFormData.website}
                    onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                    placeholder="https://www.example.com"
                  />
                </div>

                <div className="vendor-form-group">
                  <label>Address</label>
                  <textarea
                    rows={2}
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>

                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={editFormData.state}
                      onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                      placeholder="Enter state"
                    />
                  </div>
                  <div className="vendor-form-group">
                    <label>Pincode</label>
                    <input
                      type="text"
                      value={editFormData.pincode}
                      onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                      placeholder="Enter pincode"
                    />
                  </div>
                </div>

                <div className="vendor-form-group">
                  <label>GST Number</label>
                  <input
                    type="text"
                    value={editFormData.gstNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })}
                    placeholder="Enter GST number"
                  />
                </div>
              </div>

              {/* Additional Details Section */}
              <div className="vendor-form-section">
                <h3>Additional Details</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Rating</label>
                    <select
                      value={editFormData.rating}
                      onChange={(e) => setEditFormData({ ...editFormData, rating: parseInt(e.target.value) })}
                    >
                      <option value="0">Not Rated</option>
                      <option value="1">⭐ 1 Star</option>
                      <option value="2">⭐⭐ 2 Stars</option>
                      <option value="3">⭐⭐⭐ 3 Stars</option>
                      <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                      <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {availableUsers.length > 0 && (
                  <div className="vendor-form-group">
                    <label>Assign To</label>
                    <select
                      value={editFormData.assignedTo}
                      onChange={(e) => setEditFormData({ ...editFormData, assignedTo: e.target.value })}
                    >
                      <option value="">Select user</option>
                      {availableUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="vendor-form-group">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    placeholder="Enter any additional notes"
                  />
                </div>
              </div>
            </div>

            <div className="vendor-management-modal-actions">
              <button className="vendor-management-btn-primary" onClick={handleCreateVendor}>
                Create Vendor
              </button>
              <button className="vendor-management-btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;