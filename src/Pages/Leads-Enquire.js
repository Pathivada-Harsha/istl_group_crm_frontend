// Leads-Enquiries.js - Updated with Permissions
import React, { useState, useEffect, useRef } from 'react';
import '../pages-css/Leads-Enquire.css';
import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import LeadTimelineModal from './../components/Leads/LeadTimelineModal.js'; // NEW
import AddFollowupModal from './../components/Leads/AddFollowupModal.js'; // NEW
import CreateProposalModal from './../components/Leads/CreateProposalModal'; // NEW

const API_BASE_URL = process.env.REACT_APP_API_URL;
// DEFAULT TEMPLATE for proposals
const DEFAULT_PROPOSAL_TEMPLATE = {
  companyName: "SESOLA POWER PROJECTS PROPOSAL PVT LTD",
  aboutUs: `We are a leading provider of renewable energy solutions with expertise in solar power systems. Our team of experienced professionals is committed to delivering high-quality, sustainable energy solutions that meet the unique needs of our clients.

With years of experience in the industry, we have successfully completed numerous projects across various sectors, establishing ourselves as a trusted partner in the transition to clean energy.`,
  aboutSystem: `The proposed solar power system is designed to provide reliable, efficient, and sustainable energy generation. The system includes high-efficiency solar panels, advanced inverters, robust mounting structures, and comprehensive monitoring systems.

Key features:
- High-efficiency solar panels with excellent performance
- Grid-tied inverter system for optimal power conversion
- Durable mounting structures with wind load certification
- Remote monitoring and management capabilities
- Comprehensive safety features and protection systems`,
  paymentTerms: `1. 30% advance payment upon signing of agreement
2. 40% payment on delivery of materials at site
3. 30% payment on successful commissioning and handover

Payment can be made via bank transfer, cheque, or demand draft in favor of SESOLA POWER PROJECTS PROPOSAL PVT LTD.`,
  defectLiabilityPeriod: `Standard 12 months warranty period from date of commissioning and handover.

During this period, any defects in workmanship, materials, or performance will be rectified free of cost. This includes:
- Repair or replacement of defective components
- System performance issues
- Installation-related defects

Extended warranty options are available upon request.`,
  systemPricing: [],
  bomItems: []
};
function LeadsEnquiries() {
  const isFirstRender = useRef(true);
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
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { user, pagePermissions } = useAuth();
  // NEW: Follow-up and Timeline states
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedLeadForFollowup, setSelectedLeadForFollowup] = useState(null);
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [selectedLeadForProposal, setSelectedLeadForProposal] = useState(null);
  // Extract permissions
  const leadsPermissions = pagePermissions?.LEADS || [];
  const canView = leadsPermissions.includes('VIEW');
  const canCreate = leadsPermissions.includes('CREATE');
  const canEdit = leadsPermissions.includes('EDIT');
  const canDelete = leadsPermissions.includes('DELETE');
  const canAssign = leadsPermissions.includes('ASSIGN');

  const currentUser = {
    id: user.id || 1,
    role: user.role || 'USER',
    name: user.name || 'Current User'
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

  const fetchWithHeaders = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'User-Id': currentUser.id,
      'User-Role': currentUser.role,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      credentials: "include",
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
      fetchLeads();
      fetchUsers();
      fetchGroups();
    }
  }, [canView]);

  useEffect(() => {
    if (canView) {
      fetchLeads();
    }
  }, [groupName, subGroupName, canView]);

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
  // NEW: Handle Add Follow-up
  const handleAddFollowup = (lead) => {
    if (!canCreate) {
      showError('You do not have permission to create follow-ups');
      return;
    }
    setSelectedLeadForFollowup(lead);
    setShowFollowupModal(true);
  };
  // NEW: Handle Create Proposal
  const handleCreateProposal = (lead) => {
    if (!canCreate) {
      showError('You do not have permission to create proposals');
      return;
    }
    setSelectedLeadForProposal(lead);
    setShowProposalModal(true);
  };

  // NEW: Handle Proposal Created
  const handleProposalCreated = () => {
    setShowProposalModal(false);
    setSelectedLeadForProposal(null);
    showSuccess('Proposal created successfully');
    fetchLeads(); // Refresh to update any counts
  };
  // NEW: Handle View Timeline
  const handleViewTimeline = async (lead) => {
    if (!canView) {
      showError('You do not have permission to view timeline');
      return;
    }

    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) {
        setSelectedLeadForTimeline(data.data);
        setShowTimelineModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error fetching lead details');
    }
  };

  // NEW: Handle Follow-up Created
  const handleFollowupCreated = () => {
    setShowFollowupModal(false);
    setSelectedLeadForFollowup(null);
    showSuccess('Follow-up created successfully');
    fetchLeads(); // Refresh to update pending follow-up counts
  };
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-users`, {
        credentials: "include",
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

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, {
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();
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
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subgroups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setSubGroups(data);
      }
    } catch (err) {
      console.error('Error fetching subgroups:', err);
      setSubGroups([]);
    }
  };

  const applyFilters = async () => {
    if (!canView) return;

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
    // ⛔ Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // ⛔ Skip if filters are still default
    const isDefaultFilter =
      !searchTerm &&
      statusFilter === 'All' &&
      priorityFilter === 'All' &&
      sourceFilter === 'All';

    if (isDefaultFilter) {
      return;
    }

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
    if (!canView) {
      showError('You do not have permission to view leads');
      return;
    }

    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) {
        setSelectedLead(data.data);
        setShowViewModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error fetching lead details');
    }
  };

  const handleEdit = (lead) => {
    if (!canEdit) {
      showError('You do not have permission to edit leads');
      return;
    }

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
    if (!canDelete) {
      showError('You do not have permission to delete leads');
      return;
    }

    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/delete/${leadId}`, {
          method: 'DELETE'
        });

        if (data.success) {
          showSuccess('Lead deleted successfully');
          fetchLeads();
        }
      } catch (err) {
        showError(err.message || 'Error deleting lead');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.id && !canEdit) {
      showError('You do not have permission to edit leads');
      return;
    }

    if (!formData.id && !canCreate) {
      showError('You do not have permission to create leads');
      return;
    }

    setLoading(true);

    try {
      const isClosingWon = formData.status === 'Closed Won' &&
        formData.id &&
        leads.find(l => l.id === formData.id)?.status !== 'Closed Won';

      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/update/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });

        if (data.success) {
          if (isClosingWon) {
            showSuccess('Lead updated successfully!\n\n✅ Lead has been converted to Customer automatically.\nYou can find the customer in the Customers Database.');
          } else {
            showSuccess('Lead updated successfully');
          }
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
          showSuccess('Lead created successfully');
          setShowAddModal(false);
          resetForm();
          fetchLeads();
        }
      }
    } catch (err) {
      showError(err.message || 'Error saving lead');
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
    if (!canView) {
      showError('You do not have permission to export leads');
      return;
    }

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

  // Check if user has no permissions at all
  if (!canView) {
    return (
      <div className="leads-enquiries-container">
        <div className="alert alert-warning" role="alert">
          You do not have permission to view leads. Please contact your administrator.
        </div>
      </div>
    );
  }

  return (
    <div className="leads-enquiries-container">
      {loading && <CrmPreloader text="Loading Leads..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="leads-enquiries-breadcrumb">
        <span>Dashboard</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Leads / Enquiries</span>
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
          <button
            className={`leads-enquiries-btn leads-enquiries-btn-primary ${!canCreate ? 'leads-enquiries-btn-disabled' : ''}`}
            onClick={() => {
              if (canCreate) {
                resetForm();
                setShowAddModal(true);
              } else {
                showError('You do not have permission to create leads');
              }
            }}
            disabled={!canCreate}
            title={!canCreate ? 'No permission to create leads' : 'Add New Lead'}
          >
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
                <th>Follow-Ups</th>
                <th>Assigned To</th>
                <th onClick={() => handleSort('createdAt')}>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentLeads.length === 0 ? (
                <tr>
                  <td colSpan="13" className="text-center py-4">No leads found</td>
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
                    <td>
                      {lead.hasPendingFollowups && (
                        <span className="badge badge-orange">
                          {lead.pendingFollowupsCount} Pending
                        </span>
                      )}
                    </td>
                    <td>{lead.assignedToName || '-'}</td>
                    <td>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-'}</td>
                    <td>
                      <td>
                        <div className="leads-enquiries-action-buttons-cell">
                          {canView && (
                            <button
                              className="leads-enquiries-action-btn leads-enquiries-action-view"
                              onClick={() => handleView(lead)}
                              title="View"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}

                          {/* Timeline Button */}
                          <button
                            className="leads-enquiries-action-btn leads-enquiries-action-timeline"
                            onClick={() => handleViewTimeline(lead)}
                            title="View Timeline"
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>

                          {/* Add Follow-up Button */}
                          <button
                            className={`leads-enquiries-action-btn leads-enquiries-action-followup ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`}
                            onClick={() => handleAddFollowup(lead)}
                            title={!canCreate ? 'No permission to add follow-ups' : 'Add Follow-up'}
                            disabled={!canCreate}
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>

                          {/* NEW: Create Proposal Button */}
                          <button
                            className={`leads-enquiries-action-btn leads-enquiries-action-proposal ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`}
                            onClick={() => handleCreateProposal(lead)}
                            title={!canCreate ? 'No permission to create proposals' : 'Create Proposal'}
                            disabled={!canCreate}
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>

                          <button
                            className={`leads-enquiries-action-btn leads-enquiries-action-edit ${!canEdit ? 'leads-enquiries-action-disabled' : ''}`}
                            onClick={() => handleEdit(lead)}
                            title={!canEdit ? 'No permission to edit' : 'Edit'}
                            disabled={!canEdit}
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          <button
                            className={`leads-enquiries-action-btn leads-enquiries-action-delete ${!canDelete ? 'leads-enquiries-action-disabled' : ''}`}
                            onClick={() => handleDelete(lead.id)}
                            title={!canDelete ? 'No permission to delete' : 'Delete'}
                            disabled={!canDelete}
                          >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
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
                    <select
                      value={formData.assignedTo || ''}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? Number(e.target.value) : null })}
                      disabled={!canAssign}
                    >
                      <option value="">Select Member</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    {!canAssign && <small style={{ color: '#6b7280', fontSize: '12px' }}>You don't have permission to assign leads</small>}
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
                {/* NEW: Add Follow-up from View Modal */}
                {canCreate && (
                  <button
                    className="leads-enquiries-btn leads-enquiries-btn-success"
                    onClick={() => {
                      setShowViewModal(false);
                      handleAddFollowup(selectedLead);
                    }}
                  >
                    <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Follow-up
                  </button>
                )}

                {/* NEW: View Timeline from View Modal */}
                <button
                  className="leads-enquiries-btn leads-enquiries-btn-info"
                  onClick={() => {
                    setShowViewModal(false);
                    handleViewTimeline(selectedLead);
                  }}
                >
                  <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View Timeline
                </button>

                {canEdit && (
                  <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => handleEdit(selectedLead)}>
                    Edit Lead
                  </button>
                )}
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Follow-up Modal */}
      {showFollowupModal && selectedLeadForFollowup && (
        <AddFollowupModal
          lead={selectedLeadForFollowup}
          onClose={() => {
            setShowFollowupModal(false);
            setSelectedLeadForFollowup(null);
          }}
          onFollowupCreated={handleFollowupCreated}
        />
      )}

      {/* NEW: Timeline Modal */}
      {showTimelineModal && selectedLeadForTimeline && (
        <LeadTimelineModal
          lead={selectedLeadForTimeline}
          onClose={() => {
            setShowTimelineModal(false);
            setSelectedLeadForTimeline(null);
          }}
          onAddFollowup={() => {
            setShowTimelineModal(false);
            handleAddFollowup(selectedLeadForTimeline);
          }}
        />
      )}
    {/* Proposal Modal */}
      {showProposalModal && selectedLeadForProposal && (
        <CreateProposalModal
          lead={selectedLeadForProposal}
          onClose={() => {
            setShowProposalModal(false);
            setSelectedLeadForProposal(null);
          }}
          onProposalCreated={handleProposalCreated}
          defaultTemplate={DEFAULT_PROPOSAL_TEMPLATE}
        />
      )}
    </div>
  );
}

export default LeadsEnquiries;
