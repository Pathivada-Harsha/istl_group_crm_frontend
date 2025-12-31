// Leads-Enquiries.js - Updated with fetch API
import React, { useState, useEffect } from 'react';
import '../pages-css/Leads-Enquire.css';
import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

function LeadsEnquiries() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();

  const currentUser = {
    id: localStorage.getItem('userId') || 1,
    role: localStorage.getItem('userRole') || 'USER',
    name: localStorage.getItem('userName') || 'Current User'
  };

  const [leads, setLeads] = useState([]);

  const [formData, setFormData] = useState({
    customerId: null,
    name: '',
    email: '',
    phone: '',
    source: 'Website',
    priority: 'Medium',
    status: 'New',
    assignedTo: null,
    enquiry: '',
    groupName: '',
    subGroupName: ''
  });

  // Helper function for fetch requests
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
    fetchLeads();
    fetchUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [groupName, subGroupName]);

  useEffect(() => {
    if (formData.groupName) {
      fetchSubGroupsForForm(formData.groupName);
    } else {
      setSubGroups([]);
    }
  }, [formData.groupName]);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/getAll?${params}`);
      if (data.success) {
        setLeads(data.data);
      }
    } catch (err) {
      setError(err.message || 'Error fetching leads');
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
      console.log('Leads Users Response:', data);
      
      // Backend returns array of LeadsUserWrapper: [{id, name}, ...]
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, {
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch groups');
      
      const data = await response.json();
      console.log('Leads Groups Response:', data);
      
      // Backend returns array of LeadsGroupWrapper: [{value, label}, ...]
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) {
      setSubGroups([]);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, {
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch subgroups');
      
      const data = await response.json();
      console.log('Leads SubGroups Response:', data);
      
      // Backend returns array of LeadsSubGroupWrapper: [{value, label}, ...]
      if (Array.isArray(data)) {
        setSubGroups(data);
      }
    } catch (err) {
      console.error('Error fetching subgroups:', err);
      setSubGroups([]);
    }
  };

  const applyFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterRequest = {
        searchTerm: searchTerm || null,
        status: statusFilter !== 'All' ? statusFilter : null,
        priority: priorityFilter !== 'All' ? priorityFilter : null,
        source: sourceFilter !== 'All' ? sourceFilter : null,
        groupName: groupName || null,
        subGroupName: subGroupName || null,
        assignedTo: null,
        fromDate: null,
        toDate: null
      };

      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/filter`, {
        method: 'POST',
        body: JSON.stringify(filterRequest)
      });
      
      if (data.success) {
        setLeads(data.data);
        setCurrentPage(1);
      }
    } catch (err) {
      setError(err.message || 'Error applying filters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      applyFilters();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, statusFilter, priorityFilter, sourceFilter]);

  const handleSort = (column) => {
    const direction = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(direction);

    const sortedLeads = [...leads].sort((a, b) => {
      const aValue = a[column] || '';
      const bValue = b[column] || '';
      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    setLeads(sortedLeads);
  };

  const handleView = async (lead) => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) {
        setSelectedLead(data.data);
        setShowViewModal(true);
      }
    } catch (err) {
      alert(err.message || 'Error fetching lead details');
    }
  };

  const handleEdit = (lead) => {
    setShowViewModal(false);
    setFormData({
      id: lead.id,
      customerId: lead.customerId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      priority: lead.priority,
      status: lead.status,
      assignedTo: lead.assignedTo,
      enquiry: lead.enquiry,
      groupName: lead.groupName || '',
      subGroupName: lead.subGroupName || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/delete/${leadId}`, {
          method: 'DELETE'
        });
        
        if (data.success) {
          alert('Lead deleted successfully');
          fetchLeads();
        }
      } catch (err) {
        alert(err.message || 'Error deleting lead');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/update/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        
        if (data.success) {
          alert('Lead updated successfully');
          setShowAddModal(false);
          resetForm();
          fetchLeads();
        }
      } else {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/create`, {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        
        if (data.success) {
          alert('Lead created successfully');
          setShowAddModal(false);
          resetForm();
          fetchLeads();
        }
      }
    } catch (err) {
      alert(err.message || 'Error saving lead');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: null,
      name: '',
      email: '',
      phone: '',
      source: 'Website',
      priority: 'Medium',
      status: 'New',
      assignedTo: null,
      enquiry: '',
      groupName: '',
      subGroupName: ''
    });
  };

  const getStatusClass = (status) => {
    const statusClasses = {
      'New': 'leads-enquiries-badge-new',
      'Contacted': 'leads-enquiries-badge-contacted',
      'In Discussion': 'leads-enquiries-badge-discussion',
      'Proposal Sent': 'leads-enquiries-badge-proposal',
      'Closed Won': 'leads-enquiries-badge-won',
      'Closed Lost': 'leads-enquiries-badge-lost'
    };
    return statusClasses[status] || 'leads-enquiries-badge-default';
  };

  const getPriorityClass = (priority) => {
    const priorityClasses = {
      'High': 'leads-enquiries-badge-high',
      'Medium': 'leads-enquiries-badge-medium',
      'Low': 'leads-enquiries-badge-low'
    };
    return priorityClasses[priority] || 'leads-enquiries-badge-default';
  };

  const totalPages = Math.ceil(leads.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentLeads = leads.slice(startIndex, endIndex);

  const exportToCSV = () => {
    const headers = ['Lead ID', 'Client Name', 'Email', 'Phone', 'Source', 'Priority', 'Status', 'Group', 'Category', 'Assigned To', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => [
        lead.leadCode,
        lead.name,
        lead.email,
        lead.phone,
        lead.source,
        lead.priority,
        lead.status,
        lead.groupName || '',
        lead.subGroupName || '',
        lead.assignedToName || '',
        lead.createdAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="leads-enquiries-container">
      <div className="leads-enquiries-breadcrumb">
        <span>Dashboard</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Leads / Enquiries</span>
      </div>

      <div className="leads-enquiries-header">
        <div className="page-header-with-filter">
          <h1 className="leads-enquiries-title">Leads / Enquiries</h1>
          <GroupCategoryFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            onChange={updateFilters}
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="leads-enquiries-action-bar">
        <div className="leads-enquiries-search-wrapper">
          <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, phone, or ID..."
            className="leads-enquiries-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="leads-enquiries-filters">
          <select className="leads-enquiries-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="In Discussion">In Discussion</option>
            <option value="Proposal Sent">Proposal Sent</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>

          <select className="leads-enquiries-filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="All">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select className="leads-enquiries-filter-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="All">All Sources</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
            <option value="Cold Call">Cold Call</option>
            <option value="Email">Email</option>
            <option value="Others">Others</option>
          </select>
        </div>

        <div className="leads-enquiries-action-buttons">
          <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Lead
          </button>
          <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={exportToCSV}>
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      )}

      <div className="leads-enquiries-table-card">
        <div className="leads-enquiries-table-wrapper">
          <table className="leads-enquiries-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('leadCode')}>Lead ID</th>
                <th onClick={() => handleSort('name')}>Client Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Group</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th onClick={() => handleSort('createdAt')}>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentLeads.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-4">No leads found</td>
                </tr>
              ) : (
                currentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="leads-enquiries-font-medium">{lead.leadCode}</td>
                    <td className="leads-enquiries-font-medium">{lead.name}</td>
                    <td>{lead.email}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.source}</td>
                    <td>{lead.groupName || '-'}</td>
                    <td>{lead.subGroupName || '-'}</td>
                    <td>
                      <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td>{lead.assignedToName || '-'}</td>
                    <td>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className="leads-enquiries-action-buttons-cell">
                        <button className="leads-enquiries-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button className="leads-enquiries-action-btn leads-enquiries-action-edit" onClick={() => handleEdit(lead)} title="Edit">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button className="leads-enquiries-action-btn leads-enquiries-action-delete" onClick={() => handleDelete(lead.id)} title="Delete">
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
            Showing {startIndex + 1} to {Math.min(endIndex, leads.length)} of {leads.length} entries
          </div>
          <div className="leads-enquiries-pagination-controls">
            <select className="leads-enquiries-rows-select" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
            </select>
            <div className="leads-enquiries-pagination-buttons">
              <button className="leads-enquiries-pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                Previous
              </button>
              <span className="leads-enquiries-pagination-current">
                Page {currentPage} of {totalPages}
              </span>
              <button className="leads-enquiries-pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="leads-enquiries-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="leads-enquiries-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="leads-enquiries-form">
              <div className="leads-enquiries-form-section">
                <h3 className="leads-enquiries-form-section-title">Client Information</h3>
                <div className="leads-enquiries-form-grid">
                  <div className="leads-enquiries-form-group">
                    <label>Client Name *</label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
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
                    <select value={formData.groupName} onChange={(e) => setFormData({ ...formData, groupName: e.target.value, subGroupName: '' })}>
                      <option value="">Select Group</option>
                      {groups.map((group, index) => (
                        <option key={group.value || group.label || index} value={group.value || group.label}>
                          {group.label || group.value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Category</label>
                    <select value={formData.subGroupName} onChange={(e) => setFormData({ ...formData, subGroupName: e.target.value })} disabled={!formData.groupName}>
                      <option value="">Select Category</option>
                      {subGroups.map((sub, index) => (
                        <option key={sub.value || sub.label || index} value={sub.value || sub.label}>
                          {sub.label || sub.value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="leads-enquiries-form-section">
                <h3 className="leads-enquiries-form-section-title">Lead Details</h3>
                <div className="leads-enquiries-form-grid">
                  <div className="leads-enquiries-form-group">
                    <label>Lead Source *</label>
                    <select required value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                      <option value="Website">Website</option>
                      <option value="Referral">Referral</option>
                      <option value="Cold Call">Cold Call</option>
                      <option value="Email">Email</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Priority *</label>
                    <select required value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Status *</label>
                    <select required value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="In Discussion">In Discussion</option>
                      <option value="Proposal Sent">Proposal Sent</option>
                      <option value="Closed Won">Closed Won</option>
                      <option value="Closed Lost">Closed Lost</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Assign To</label>
                    <select value={formData.assignedTo || ''} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Select Member</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="leads-enquiries-form-group">
                  <label>Enquiry Description *</label>
                  <textarea required rows={4} value={formData.enquiry} onChange={(e) => setFormData({ ...formData, enquiry: e.target.value })} placeholder="Describe the client's requirements..." />
                </div>
              </div>

              <div className="leads-enquiries-form-actions">
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : (formData.id ? 'Update Lead' : 'Save Lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedLead && (
        <div className="leads-enquiries-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="leads-enquiries-modal leads-enquiries-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>Lead Details - {selectedLead.leadCode}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowViewModal(false)}>
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
                    <span className="leads-enquiries-detail-label">Client Name:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.name}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Email:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.email}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Phone:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.phone}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Source:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.source}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Group:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.groupName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Category:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.subGroupName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Priority:</span>
                    <span className={`leads-enquiries-badge ${getPriorityClass(selectedLead.priority)}`}>
                      {selectedLead.priority}
                    </span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Status:</span>
                    <span className={`leads-enquiries-badge ${getStatusClass(selectedLead.status)}`}>
                      {selectedLead.status}
                    </span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Assigned To:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.assignedToName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Created By:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.createdByName || '-'}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Created At:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="leads-enquiries-detail-section">
                <h3>Enquiry Description</h3>
                <p className="leads-enquiries-description">{selectedLead.enquiry}</p>
              </div>

              <div className="leads-enquiries-modal-actions">
                <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => handleEdit(selectedLead)}>
                  Edit Lead
                </button>
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadsEnquiries;