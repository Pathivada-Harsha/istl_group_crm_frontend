// Customers.js - Complete with Permissions
import React, { useState, useEffect, useRef } from 'react';
import '../pages-css/Sales-Customer.css';
import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const CustomerDatabase = () => {
  const isFirstRender = useRef(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedRows, setSelectedRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { user, pagePermissions } = useAuth();

  // Extract permissions
  const customersPermissions = pagePermissions?.CUSTOMERS || [];
  const canView = customersPermissions.includes('VIEW');
  console.log(canView);
  const canCreate = customersPermissions.includes('CREATE');
  const canEdit = customersPermissions.includes('EDIT');
  const canDelete = customersPermissions.includes('DELETE');

  const currentUser = {
    id: user.id || 1,
    role: user.role || 'USER',
    name: user.name || 'Current User'
  };

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    groupName: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    altPhone: '',
    website: '',
    gstNumber: '',
    pan: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    status: 'Active',
    assignedTo: null
  });

  const [followupFormData, setFollowupFormData] = useState({
    followupType: 'Call',
    scheduledAt: '',
    assignedTo: '',
    priority: 'Medium',
    notes: ''
  });

  const fetchWithHeaders = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'User-Id': currentUser.id,
      'User-Role': currentUser.role,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  useEffect(() => {
    if (canView) {
      fetchCustomers();
      fetchUsers();
    }
  }, [canView]);

  useEffect(() => {
    if (canView) {
      fetchCustomers();
    }
  }, [groupName, subGroupName, currentPage, rowsPerPage, canView]);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      params.append('page', currentPage - 1);
      params.append('size', rowsPerPage);

      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/getAll?${params}`);
      if (data.success) {
        setCustomers(data.data.content || data.data);
        setTotalCustomers(data.data.totalElements || data.data.length || 0);
      }
    } catch (err) {
      setError(err.message || 'Error fetching customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-users`, {
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  const fetchFollowups = async (customerId) => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/followups/entity/Customer/${customerId}`);
      if (data.success) {
        setFollowups(data.data);
      }
    } catch (err) {
      console.error('Error fetching followups:', err);
      setFollowups([]);
    }
  };

  const applyFilters = async () => {
    if (!canView) return;

    setLoading(true);
    setError(null);
    try {
      const filterRequest = {
        searchTerm: searchTerm || null,
        groupName: selectedGroup !== 'All' ? selectedGroup : null,
        status: selectedStatus !== 'All' ? selectedStatus : null,
        city: null,
        state: null,
        assignedTo: null,
        fromDate: null,
        toDate: null,
        page: currentPage - 1,
        size: rowsPerPage
      };

      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/filter`, {
        method: 'POST',
        body: JSON.stringify(filterRequest)
      });

      if (data.success) {
        setCustomers(data.data.content || data.data);
        setTotalCustomers(data.data.totalElements || data.data.length || 0);
      }
    } catch (err) {
      setError(err.message || 'Error applying filters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ⛔ Skip first render (StrictMode safe)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // ⛔ Skip when filters are default
    const isDefaultFilter =
      !searchTerm &&
      selectedGroup === 'All' &&
      selectedStatus === 'All';

    if (isDefaultFilter) {
      return;
    }

    const debounceTimer = setTimeout(() => {
      setCurrentPage(1);
      applyFilters();
    }, 500);

    return () => clearTimeout(debounceTimer);

  }, [searchTerm, selectedGroup, selectedStatus]);

  const handleViewCustomer = async (customer) => {
    if (!canView) {
      showError('You do not have permission to view customers');
      return;
    }

    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/customers/${customer.id}`);
      if (data.success) {
        setSelectedCustomer(data.data);
        setIsDrawerOpen(true);
        fetchFollowups(customer.id);
      }
    } catch (err) {
      showError(err.message || 'Error fetching customer details');
    }
  };

  const handleEdit = (customer) => {
    if (!canEdit) {
      showError('You do not have permission to edit customers');
      return;
    }

    setIsDrawerOpen(false);
    setFormData({
      id: customer.id,
      name: customer.name,
      companyName: customer.companyName || '',
      groupName: customer.groupName || '',
      contactPerson: customer.contactPerson || '',
      designation: customer.designation || '',
      email: customer.email,
      phone: customer.phone,
      altPhone: customer.altPhone || '',
      website: customer.website || '',
      gstNumber: customer.gstNumber || '',
      pan: customer.pan || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      status: customer.status || 'Active',
      assignedTo: customer.assignedTo
    });
    setIsAddFormOpen(true);
  };

  const handleDelete = async (customerId) => {
    if (!canDelete) {
      showError('You do not have permission to delete customers');
      return;
    }

    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        const data = await fetchWithHeaders(`${API_BASE_URL}/customers/delete/${customerId}`, {
          method: 'DELETE'
        });

        if (data.success) {
          showSuccess('Customer deleted successfully');
          fetchCustomers();
        }
      } catch (err) {
        showError(err.message || 'Error deleting customer');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.id && !canEdit) {
      showError('You do not have permission to edit customers');
      return;
    }

    if (!formData.id && !canCreate) {
      showError('You do not have permission to create customers');
      return;
    }

    setLoading(true);

    try {
      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/customers/update/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });

        if (data.success) {
          showSuccess('Customer updated successfully');
          setIsAddFormOpen(false);
          resetForm();
          fetchCustomers();
        }
      } else {
        const data = await fetchWithHeaders(`${API_BASE_URL}/customers/create`, {
          method: 'POST',
          body: JSON.stringify(formData)
        });

        if (data.success) {
          showSuccess('Customer created successfully');
          setIsAddFormOpen(false);
          resetForm();
          fetchCustomers();
        }
      }
    } catch (err) {
      showError(err.message || 'Error saving customer');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowupSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = {
        relatedType: 'Customer',
        relatedId: selectedCustomer.id,
        ...followupFormData,
        status: 'Pending'
      };

      const response = await fetchWithHeaders(`${API_BASE_URL}/followups/create`, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (response.success) {
        showSuccess('Follow-up created successfully');
        setShowFollowupModal(false);
        resetFollowupForm();
        fetchFollowups(selectedCustomer.id);
        fetchCustomers();
      }
    } catch (err) {
      showError(err.message || 'Error creating follow-up');
    }
  };

  const handleCompleteFollowup = async (followupId) => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/followups/update/${followupId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Completed' })
      });

      if (data.success) {
        showSuccess('Follow-up marked as completed');
        fetchFollowups(selectedCustomer.id);
        fetchCustomers();
      }
    } catch (err) {
      showError(err.message || 'Error updating follow-up');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      companyName: '',
      groupName: '',
      contactPerson: '',
      designation: '',
      email: '',
      phone: '',
      altPhone: '',
      website: '',
      gstNumber: '',
      pan: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      status: 'Active',
      assignedTo: null
    });
  };

  const resetFollowupForm = () => {
    setFollowupFormData({
      followupType: 'Call',
      scheduledAt: '',
      assignedTo: '',
      priority: 'Medium',
      notes: ''
    });
  };

  const handleSelectRow = (customerId) => {
    if (selectedRows.includes(customerId)) {
      setSelectedRows(selectedRows.filter(id => id !== customerId));
    } else {
      setSelectedRows([...selectedRows, customerId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.length === customers.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(customers.map(c => c.id));
    }
  };

  const getGroupColor = (group) => {
    const colors = {
      CCMS: 'blue',
      Solar: 'yellow',
      EPC: 'green',
      IoT: 'purple',
      Hybrid: 'orange',
      Others: 'grey'
    };
    return colors[group] || 'grey';
  };

  const getStatusColor = (status) => {
    const colors = {
      Active: 'green',
      Inactive: 'grey',
      Prospect: 'orange',
      Lead: 'blue'
    };
    return colors[status] || 'grey';
  };

  const exportToCSV = () => {
    if (!canView) {
      showError('You do not have permission to export customers');
      return;
    }

    const headers = ['Customer Code', 'Name', 'Company', 'Email', 'Phone', 'Group', 'Status', 'City', 'State', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...customers.map(customer => [
        customer.customerCode,
        customer.name,
        customer.companyName || '',
        customer.email,
        customer.phone,
        customer.groupName || '',
        customer.status,
        customer.city || '',
        customer.state || '',
        customer.createdAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const kpiData = {
    totalCustomers: totalCustomers,
    newThisMonth: customers.filter(c => {
      const createdDate = new Date(c.createdAt);
      const now = new Date();
      return createdDate.getMonth() === now.getMonth() &&
        createdDate.getFullYear() === now.getFullYear();
    }).length,
    activeCustomers: customers.filter(c => c.status === 'Active').length,
    pendingFollowups: customers.reduce((sum, c) => sum + (c.pendingFollowupsCount || 0), 0)
  };

  const totalPages = Math.ceil(totalCustomers / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalCustomers);

  // Check if user has no permissions at all
  if (!canView) {
    return (
      <div className="leads-enquiries-container">
        <div className="alert alert-warning" role="alert">
          You do not have permission to view customers. Please contact your administrator.
        </div>
      </div>
    );
  }

  return (
    <div className="leads-enquiries-container">
      {loading && <CrmPreloader text="Loading Customers..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="leads-enquiries-breadcrumb">
        <span>Dashboard</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Customers</span>
      </div>

      <div className="leads-enquiries-header page-header-with-filter">
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#eff6ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}>👥</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.2' }}>{kpiData.totalCustomers}</div>
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.125rem' }}>Total Customers</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#fef3c7',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}>✨</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.2' }}>{kpiData.newThisMonth}</div>
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.125rem' }}>New This Month</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#dbeafe',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}>📊</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.2' }}>{kpiData.activeCustomers}</div>
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.125rem' }}>Active Customers</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#fce7f3',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}>📞</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.2' }}>{kpiData.pendingFollowups}</div>
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.125rem' }}>Follow-Ups Pending</div>
          </div>
        </div>
      </div>

      <div className="leads-enquiries-action-bar">
        <div className="leads-enquiries-search-wrapper">
          <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, company, phone, email, GST..."
            className="leads-enquiries-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="leads-enquiries-filters">
          <select className="leads-enquiries-filter-select" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            <option value="All">All Groups</option>
            <option value="CCMS">CCMS</option>
            <option value="Solar">Solar</option>
            <option value="EPC">EPC</option>
            <option value="IoT">IoT</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Others">Others</option>
          </select>

          <select className="leads-enquiries-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Prospect">Prospect</option>
            <option value="Lead">Lead</option>
          </select>
        </div>

        <div className="leads-enquiries-action-buttons">
          <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={exportToCSV}>
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            className={`leads-enquiries-btn leads-enquiries-btn-primary ${!canCreate ? 'leads-enquiries-btn-disabled' : ''}`}
            onClick={() => {
              if (canCreate) {
                resetForm();
                setIsAddFormOpen(true);
              } else {
                showError('You do not have permission to create customers');
              }
            }}
            disabled={!canCreate}
            title={!canCreate ? 'No permission to create customers' : 'Add New Customer'}
          >
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Customer
          </button>
        </div>
      </div>

      <div className="leads-enquiries-table-card">
        <div className="leads-enquiries-table-wrapper">
          <table className="leads-enquiries-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedRows.length === customers.length && customers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Customer Code</th>
                <th>Name</th>
                <th>Company</th>
                <th>Group</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Location</th>
                <th>Status</th>
                <th>Follow-Ups</th>
                <th>Created On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-4">
                    {loading ? 'Loading...' : 'No customers found'}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(customer.id)}
                        onChange={() => handleSelectRow(customer.id)}
                      />
                    </td>
                    <td className="leads-enquiries-font-medium">{customer.customerCode}</td>
                    <td className="leads-enquiries-font-medium">{customer.name}</td>
                    <td>{customer.companyName || '-'}</td>
                    <td>
                      <span className={`leads-enquiries-badge badge-${getGroupColor(customer.groupName)}`}>
                        {customer.groupName || 'Others'}
                      </span>
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.email}</td>
                    <td>{customer.city ? `${customer.city}, ${customer.state}` : '-'}</td>
                    <td>
                      <span className={`leads-enquiries-badge status-${getStatusColor(customer.status)}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td>
                      {customer.hasPendingFollowups && (
                        <span className="leads-enquiries-badge leads-enquiries-badge-proposal">
                          {customer.pendingFollowupsCount} Pending
                        </span>
                      )}
                    </td>
                    <td>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className="leads-enquiries-action-buttons-cell">
                        {canView && (
                          <button
                            className="leads-enquiries-action-btn leads-enquiries-action-view"
                            onClick={() => handleViewCustomer(customer)}
                            title="View"
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        )}
                        <button
                          className={`leads-enquiries-action-btn leads-enquiries-action-edit ${!canEdit ? 'leads-enquiries-action-disabled' : ''}`}
                          onClick={() => handleEdit(customer)}
                          title={!canEdit ? 'No permission to edit' : 'Edit'}
                          disabled={!canEdit}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className={`leads-enquiries-action-btn leads-enquiries-action-delete ${!canDelete ? 'leads-enquiries-action-disabled' : ''}`}
                          onClick={() => handleDelete(customer.id)}
                          title={!canDelete ? 'No permission to delete' : 'Delete'}
                          disabled={!canDelete}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="leads-enquiries-pagination">
          <div className="leads-enquiries-pagination-info">
            Showing {startIndex + 1} to {endIndex} of {totalCustomers} entries
          </div>
          <div className="leads-enquiries-pagination-controls">
            <select
              className="leads-enquiries-rows-select"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <div className="leads-enquiries-pagination-buttons">
              <button
                className="leads-enquiries-pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="leads-enquiries-pagination-current">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="leads-enquiries-pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {isAddFormOpen && (
        <div className="leads-enquiries-modal-overlay" onClick={() => setIsAddFormOpen(false)}>
          <div className="leads-enquiries-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>{formData.id ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setIsAddFormOpen(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="leads-enquiries-form">
              <div className="leads-enquiries-form-section">
                <h3 className="leads-enquiries-form-section-title">Customer Information</h3>
                <div className="leads-enquiries-form-grid">
                  <div className="leads-enquiries-form-group">
                    <label>Customer Name *</label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Company Name</label>
                    <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Email *</label>
                    <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Phone *</label>
                    <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Group</label>
                    <select value={formData.groupName} onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}>
                      <option value="">Select group</option>
                      <option value="CCMS">CCMS</option>
                      <option value="Solar">Solar</option>
                      <option value="EPC">EPC</option>
                      <option value="IoT">IoT</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Prospect">Prospect</option>
                      <option value="Lead">Lead</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Contact Person</label>
                    <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Designation</label>
                    <input type="text" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Alternate Phone</label>
                    <input type="tel" value={formData.altPhone} onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Website</label>
                    <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>GST Number</label>
                    <input type="text" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>PAN Number</label>
                    <input type="text" value={formData.pan} onChange={(e) => setFormData({ ...formData, pan: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>City</label>
                    <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>State</label>
                    <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Pincode</label>
                    <input type="text" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Assign To</label>
                    <select value={formData.assignedTo || ''} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Select Member</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="leads-enquiries-form-group">
                  <label>Address</label>
                  <textarea rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Enter full address..." />
                </div>
              </div>

              <div className="leads-enquiries-form-actions">
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setIsAddFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : (formData.id ? 'Update Customer' : 'Save Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Customer Modal with Follow-ups */}
      {isDrawerOpen && selectedCustomer && (
        <div className="leads-enquiries-modal-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="leads-enquiries-modal leads-enquiries-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>Customer Details - {selectedCustomer.customerCode}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setIsDrawerOpen(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="leads-enquiries-modal-body">
              <div className="leads-enquiries-detail-section">
                <h3>Basic Information</h3>
                <div className="leads-enquiries-detail-grid">
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Customer Code:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.customerCode}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Name:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.name}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Company:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.companyName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Email:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.email}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Phone:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.phone}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Group:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.groupName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Status:</span>
                    <span className={`leads-enquiries-badge status-${getStatusColor(selectedCustomer.status)}`}>
                      {selectedCustomer.status}
                    </span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Assigned To:</span>
                    <span className="leads-enquiries-detail-value">{selectedCustomer.assignedToName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Address:</span>
                    <span className="leads-enquiries-detail-value">
                      {selectedCustomer.address ? `${selectedCustomer.address}, ${selectedCustomer.city}, ${selectedCustomer.state} - ${selectedCustomer.pincode}` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Follow-ups Section */}
              <div className="leads-enquiries-detail-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>Follow-Ups ({followups.length})</h3>
                  <button
                    className="leads-enquiries-btn leads-enquiries-btn-primary"
                    onClick={() => setShowFollowupModal(true)}
                  >
                    + Add Follow-Up
                  </button>
                </div>

                {followups.length === 0 ? (
                  <p>No follow-ups scheduled</p>
                ) : (
                  <div>
                    {followups.map(followup => (
                      <div key={followup.id} style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: followup.status === 'Completed' ? '#f0f9ff' : '#fff'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div>
                            <strong>{followup.followupType}</strong>
                            <span className={`leads-enquiries-badge leads-enquiries-badge-${followup.priority === 'High' ? 'high' : followup.priority === 'Low' ? 'low' : 'medium'}`} style={{ marginLeft: '0.5rem' }}>
                              {followup.priority}
                            </span>
                          </div>
                          <span className={`leads-enquiries-badge ${followup.status === 'Completed' ? 'leads-enquiries-badge-won' : 'leads-enquiries-badge-new'}`}>
                            {followup.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                          📅 Scheduled: {new Date(followup.scheduledAt).toLocaleString()}
                        </div>
                        {followup.notes && (
                          <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            {followup.notes}
                          </div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: '#999' }}>
                          Assigned to: {followup.assignedToName || 'Unassigned'}
                        </div>
                        {followup.status === 'Pending' && (
                          <button
                            className="leads-enquiries-btn leads-enquiries-btn-secondary"
                            style={{ marginTop: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                            onClick={() => handleCompleteFollowup(followup.id)}
                          >
                            Mark as Completed
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="leads-enquiries-modal-actions">
                {canEdit && (
                  <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => handleEdit(selectedCustomer)}>
                    Edit Customer
                  </button>
                )}
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setIsDrawerOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow-up Modal */}
      {showFollowupModal && (
        <div className="leads-enquiries-modal-overlay" onClick={() => setShowFollowupModal(false)}>
          <div className="leads-enquiries-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>Add Follow-Up</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowFollowupModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleFollowupSubmit} className="leads-enquiries-form">
              <div className="leads-enquiries-form-section">
                <div className="leads-enquiries-form-grid">
                  <div className="leads-enquiries-form-group">
                    <label>Follow-up Type *</label>
                    <select
                      required
                      value={followupFormData.followupType}
                      onChange={(e) => setFollowupFormData({ ...followupFormData, followupType: e.target.value })}
                    >
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Site Visit">Site Visit</option>
                      <option value="Reminder">Reminder</option>
                      <option value="Note">Note</option>
                    </select>
                  </div>

                  <div className="leads-enquiries-form-group">
                    <label>Scheduled Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={followupFormData.scheduledAt}
                      onChange={(e) => setFollowupFormData({ ...followupFormData, scheduledAt: e.target.value })}
                    />
                  </div>

                  <div className="leads-enquiries-form-group">
                    <label>Priority *</label>
                    <select
                      value={followupFormData.priority}
                      onChange={(e) => setFollowupFormData({ ...followupFormData, priority: e.target.value })}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="leads-enquiries-form-group">
                    <label>Assign To</label>
                    <select
                      value={followupFormData.assignedTo}
                      onChange={(e) => setFollowupFormData({ ...followupFormData, assignedTo: e.target.value ? Number(e.target.value) : '' })}
                    >
                      <option value="">Select User</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="leads-enquiries-form-group">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={followupFormData.notes}
                    onChange={(e) => setFollowupFormData({ ...followupFormData, notes: e.target.value })}
                    placeholder="Add notes about this follow-up..."
                  />
                </div>
              </div>

              <div className="leads-enquiries-form-actions">
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowFollowupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary">
                  Save Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDatabase;