// Leads-Enquiries.js
import React, { useState } from 'react';
import '../pages-css/Leads-Enquire1.css';

import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";

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
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();

  // Sample data
  const [leads, setLeads] = useState([
    {
      id: 'LD-2024-001',
      clientName: 'John Smith',
      companyName: 'Tech Solutions Inc',
      email: 'john@techsolutions.com',
      phone: '+1 234 567 8900',
      source: 'Website',
      priority: 'High',
      status: 'New',
      assignedTo: 'Sarah M.',
      lastUpdated: '2024-12-09',
      description: 'Looking for enterprise software solution',
      documents: ['requirement_doc.pdf'],
      activities: [
        { type: 'Note', date: '2024-12-09', user: 'Sarah M.', content: 'Initial contact made' }
      ]
    },
    {
      id: 'LD-2024-002',
      clientName: 'Emily Johnson',
      companyName: 'Global Enterprises',
      email: 'emily@global.com',
      phone: '+1 234 567 8901',
      source: 'Referral',
      priority: 'Medium',
      status: 'Contacted',
      assignedTo: 'Mike R.',
      lastUpdated: '2024-12-08',
      description: 'Interested in cloud infrastructure',
      documents: [],
      activities: [
        { type: 'Call', date: '2024-12-08', user: 'Mike R.', content: 'Discussed requirements' }
      ]
    },
    {
      id: 'LD-2024-003',
      clientName: 'Robert Brown',
      companyName: 'Innovation Labs',
      email: 'robert@innovationlabs.com',
      phone: '+1 234 567 8902',
      source: 'Cold Call',
      priority: 'High',
      status: 'Proposal Sent',
      assignedTo: 'Emma T.',
      lastUpdated: '2024-12-07',
      description: 'Custom CRM development needed',
      documents: ['proposal_v1.pdf'],
      activities: [
        { type: 'Email', date: '2024-12-07', user: 'Emma T.', content: 'Sent proposal document' },
        { type: 'Follow-up', date: '2024-12-06', user: 'Emma T.', content: 'Scheduled meeting' }
      ]
    }
  ]);

  const [formData, setFormData] = useState({
    clientName: '',
    companyName: '',
    email: '',
    phone: '',
    source: 'Website',
    priority: 'Medium',
    status: 'New',
    assignedTo: '',
    description: ''
  });

  const handleSort = (column) => {
    const direction = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(direction);
  };

  const handleView = (lead) => {
    setSelectedLead(lead);
    setShowViewModal(true);
  };

  const handleEdit = (lead) => {
    setFormData(lead);
    setShowAddModal(true);
  };

  const handleDelete = (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      setLeads(leads.filter(lead => lead.id !== leadId));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.id) {
      // Update existing lead
      setLeads(leads.map(lead => lead.id === formData.id ? formData : lead));
    } else {
      // Add new lead
      const newLead = {
        ...formData,
        id: `LD-2024-${String(leads.length + 1).padStart(3, '0')}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        documents: [],
        activities: []
      };
      setLeads([...leads, newLead]);
    }
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      clientName: '',
      companyName: '',
      email: '',
      phone: '',
      source: 'Website',
      priority: 'Medium',
      status: 'New',
      assignedTo: '',
      description: ''
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

  // Filter and search logic
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      lead.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || lead.priority === priorityFilter;
    const matchesSource = sourceFilter === 'All' || lead.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesSource;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

  return (
    <div className="leads-enquiries-container">
      {/* Breadcrumb */}
      <div className="leads-enquiries-breadcrumb">
        <span>Dashboard</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Leads / Enquiries</span>
      </div>

      {/* Page Header */}
      <div className="leads-enquiries-header">
        <div className="page-header-with-filter">
          <h1 className="leads-enquiries-title">Leads / Enquiries</h1>
          <div className="leads-enquiries-header-actions">
            <GroupCategoryFilter
              groupValue={groupName}
              subGroupValue={subGroupName}
              onChange={updateFilters}
            />
            
            {/* View Toggle */}
            <div className="leads-enquiries-view-toggle">
              <button
                className={`leads-enquiries-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Table
              </button>
              <button
                className={`leads-enquiries-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="leads-enquiries-action-bar">
        <div className="leads-enquiries-search-wrapper">
          <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, company, email, phone, or ID..."
            className="leads-enquiries-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="leads-enquiries-filters">
          <select
            className="leads-enquiries-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="In Discussion">In Discussion</option>
            <option value="Proposal Sent">Proposal Sent</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>

          <select
            className="leads-enquiries-filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="All">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            className="leads-enquiries-filter-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
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
          <button className="leads-enquiries-btn leads-enquiries-btn-secondary">
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Conditional Rendering: Table View or Grid View */}
      {viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="leads-enquiries-table-card">
          <div className="leads-enquiries-table-wrapper">
            <table className="leads-enquiries-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id')}>Lead ID</th>
                  <th onClick={() => handleSort('clientName')}>Client Name</th>
                  <th onClick={() => handleSort('companyName')}>Company Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th onClick={() => handleSort('lastUpdated')}>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="leads-enquiries-font-medium">{lead.id}</td>
                    <td className="leads-enquiries-font-medium">{lead.clientName}</td>
                    <td>{lead.companyName}</td>
                    <td>{lead.email}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.source}</td>
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
                    <td>{lead.assignedTo}</td>
                    <td>{lead.lastUpdated}</td>
                    <td>
                      <div className="leads-enquiries-action-buttons-cell">
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
                        <button
                          className="leads-enquiries-action-btn leads-enquiries-action-edit"
                          onClick={() => handleEdit(lead)}
                          title="Edit"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="leads-enquiries-action-btn leads-enquiries-action-delete"
                          onClick={() => handleDelete(lead.id)}
                          title="Delete"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="leads-enquiries-pagination">
            <div className="leads-enquiries-pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length} entries
            </div>
            <div className="leads-enquiries-pagination-controls">
              <select
                className="leads-enquiries-rows-select"
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
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
      ) : (
        /* GRID VIEW */
        <div className="leads-enquiries-grid-container">
          <div className="leads-enquiries-grid">
            {currentLeads.map((lead) => (
              <div key={lead.id} className="leads-enquiries-card">
                <div className="leads-enquiries-card-header">
                  <div className="leads-enquiries-card-id">{lead.id}</div>
                  <div className="leads-enquiries-card-badges">
                    <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>
                      {lead.priority}
                    </span>
                    <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>
                      {lead.status}
                    </span>
                  </div>
                </div>

                <div className="leads-enquiries-card-body">
                  <h3 className="leads-enquiries-card-title">{lead.clientName}</h3>
                  <p className="leads-enquiries-card-company">{lead.companyName}</p>
                  
                  <div className="leads-enquiries-card-info">
                    <div className="leads-enquiries-card-info-item">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{lead.email}</span>
                    </div>
                    <div className="leads-enquiries-card-info-item">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{lead.phone}</span>
                    </div>
                    <div className="leads-enquiries-card-info-item">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Assigned to: {lead.assignedTo}</span>
                    </div>
                    <div className="leads-enquiries-card-info-item">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Updated: {lead.lastUpdated}</span>
                    </div>
                  </div>

                  <div className="leads-enquiries-card-description">
                    {lead.description}
                  </div>
                </div>

                <div className="leads-enquiries-card-footer">
                  <div className="leads-enquiries-card-source">
                    <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {lead.source}
                  </div>
                  <div className="leads-enquiries-card-actions">
                    <button
                      className="leads-enquiries-card-action-btn leads-enquiries-action-view"
                      onClick={() => handleView(lead)}
                      title="View Details"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      className="leads-enquiries-card-action-btn leads-enquiries-action-edit"
                      onClick={() => handleEdit(lead)}
                      title="Edit Lead"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      className="leads-enquiries-card-action-btn leads-enquiries-action-delete"
                      onClick={() => handleDelete(lead.id)}
                      title="Delete Lead"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for Grid View */}
          <div className="leads-enquiries-pagination">
            <div className="leads-enquiries-pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length} entries
            </div>
            <div className="leads-enquiries-pagination-controls">
              <select
                className="leads-enquiries-rows-select"
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10 items</option>
                <option value={25}>25 items</option>
                <option value={50}>50 items</option>
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
      )}

      {/* Add/Edit Lead Modal */}
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
                    <input
                      type="text"
                      required
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="leads-enquiries-form-section">
                <h3 className="leads-enquiries-form-section-title">Lead Details</h3>
                <div className="leads-enquiries-form-grid">
                  <div className="leads-enquiries-form-group">
                    <label>Lead Source *</label>
                    <select
                      required
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    >
                      <option value="Website">Website</option>
                      <option value="Referral">Referral</option>
                      <option value="Cold Call">Cold Call</option>
                      <option value="Email">Email</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Priority *</label>
                    <select
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Status *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="In Discussion">In Discussion</option>
                      <option value="Proposal Sent">Proposal Sent</option>
                      <option value="Closed Won">Closed Won</option>
                      <option value="Closed Lost">Closed Lost</option>
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Assign To *</label>
                    <select
                      required
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      <option value="">Select Member</option>
                      <option value="Sarah M.">Sarah M.</option>
                      <option value="Mike R.">Mike R.</option>
                      <option value="Emma T.">Emma T.</option>
                    </select>
                  </div>
                </div>
                <div className="leads-enquiries-form-group">
                  <label>Enquiry Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the client's requirements..."
                  />
                </div>
              </div>

              <div className="leads-enquiries-form-actions">
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary">
                  {formData.id ? 'Update Lead' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedLead && (
        <div className="leads-enquiries-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="leads-enquiries-modal leads-enquiries-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>Lead Details - {selectedLead.id}</h2>
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
                    <span className="leads-enquiries-detail-value">{selectedLead.clientName}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Company:</span>
                    <span className="leads-enquiries-detail-value">{selectedLead.companyName}</span>
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
                    <span className="leads-enquiries-detail-value">{selectedLead.assignedTo}</span>
                  </div>
                </div>
              </div>

              <div className="leads-enquiries-detail-section">
                <h3>Enquiry Description</h3>
                <p className="leads-enquiries-description">{selectedLead.description}</p>
              </div>

              <div className="leads-enquiries-detail-section">
                <h3>Activity Timeline</h3>
                <div className="leads-enquiries-timeline">
                  {selectedLead.activities.map((activity, index) => (
                    <div key={index} className="leads-enquiries-timeline-item">
                      <div className="leads-enquiries-timeline-marker"></div>
                      <div className="leads-enquiries-timeline-content">
                        <div className="leads-enquiries-timeline-header">
                          <span className="leads-enquiries-timeline-type">{activity.type}</span>
                          <span className="leads-enquiries-timeline-date">{activity.date}</span>
                        </div>
                        <div className="leads-enquiries-timeline-body">
                          <p>{activity.content}</p>
                          <span className="leads-enquiries-timeline-user">by {activity.user}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="leads-enquiries-modal-actions">
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary">Add Note</button>
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary">Add Follow-Up</button>
                <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => handleEdit(selectedLead)}>
                  Edit Lead
                </button>
                <button className="leads-enquiries-btn leads-enquiries-btn-primary">Convert to Proposal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadsEnquiries;

// Leads-Enquiries.js
// import React, { useState } from 'react';
// import '../pages-css/Leads-Enquire.css';


// import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
// import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
// function LeadsEnquiries() {
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [showViewModal, setShowViewModal] = useState(false);
//   const [selectedLead, setSelectedLead] = useState(null);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [statusFilter, setStatusFilter] = useState('All');
//   const [priorityFilter, setPriorityFilter] = useState('All');
//   const [sourceFilter, setSourceFilter] = useState('All');
//   const [rowsPerPage, setRowsPerPage] = useState(10);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [sortColumn, setSortColumn] = useState('');
//   const [sortDirection, setSortDirection] = useState('asc');
//   const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();

//   // Sample data
//   const [leads, setLeads] = useState([
//     {
//       id: 'LD-2024-001',
//       clientName: 'John Smith',
//       companyName: 'Tech Solutions Inc',
//       email: 'john@techsolutions.com',
//       phone: '+1 234 567 8900',
//       source: 'Website',
//       priority: 'High',
//       status: 'New',
//       assignedTo: 'Sarah M.',
//       lastUpdated: '2024-12-09',
//       description: 'Looking for enterprise software solution',
//       documents: ['requirement_doc.pdf'],
//       activities: [
//         { type: 'Note', date: '2024-12-09', user: 'Sarah M.', content: 'Initial contact made' }
//       ]
//     },
//     {
//       id: 'LD-2024-002',
//       clientName: 'Emily Johnson',
//       companyName: 'Global Enterprises',
//       email: 'emily@global.com',
//       phone: '+1 234 567 8901',
//       source: 'Referral',
//       priority: 'Medium',
//       status: 'Contacted',
//       assignedTo: 'Mike R.',
//       lastUpdated: '2024-12-08',
//       description: 'Interested in cloud infrastructure',
//       documents: [],
//       activities: [
//         { type: 'Call', date: '2024-12-08', user: 'Mike R.', content: 'Discussed requirements' }
//       ]
//     },
//     {
//       id: 'LD-2024-003',
//       clientName: 'Robert Brown',
//       companyName: 'Innovation Labs',
//       email: 'robert@innovationlabs.com',
//       phone: '+1 234 567 8902',
//       source: 'Cold Call',
//       priority: 'High',
//       status: 'Proposal Sent',
//       assignedTo: 'Emma T.',
//       lastUpdated: '2024-12-07',
//       description: 'Custom CRM development needed',
//       documents: ['proposal_v1.pdf'],
//       activities: [
//         { type: 'Email', date: '2024-12-07', user: 'Emma T.', content: 'Sent proposal document' },
//         { type: 'Follow-up', date: '2024-12-06', user: 'Emma T.', content: 'Scheduled meeting' }
//       ]
//     }
//   ]);

//   const [formData, setFormData] = useState({
//     clientName: '',
//     companyName: '',
//     email: '',
//     phone: '',
//     source: 'Website',
//     priority: 'Medium',
//     status: 'New',
//     assignedTo: '',
//     description: ''
//   });

//   const handleSort = (column) => {
//     const direction = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
//     setSortColumn(column);
//     setSortDirection(direction);
//   };

//   const handleView = (lead) => {
//     setSelectedLead(lead);
//     setShowViewModal(true);
//   };

//   const handleEdit = (lead) => {
//     setFormData(lead);
//     setShowAddModal(true);
//   };

//   const handleDelete = (leadId) => {
//     if (window.confirm('Are you sure you want to delete this lead?')) {
//       setLeads(leads.filter(lead => lead.id !== leadId));
//     }
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (formData.id) {
//       // Update existing lead
//       setLeads(leads.map(lead => lead.id === formData.id ? formData : lead));
//     } else {
//       // Add new lead
//       const newLead = {
//         ...formData,
//         id: `LD-2024-${String(leads.length + 1).padStart(3, '0')}`,
//         lastUpdated: new Date().toISOString().split('T')[0],
//         documents: [],
//         activities: []
//       };
//       setLeads([...leads, newLead]);
//     }
//     setShowAddModal(false);
//     resetForm();
//   };

//   const resetForm = () => {
//     setFormData({
//       clientName: '',
//       companyName: '',
//       email: '',
//       phone: '',
//       source: 'Website',
//       priority: 'Medium',
//       status: 'New',
//       assignedTo: '',
//       description: ''
//     });
//   };

//   const getStatusClass = (status) => {
//     const statusClasses = {
//       'New': 'leads-enquiries-badge-new',
//       'Contacted': 'leads-enquiries-badge-contacted',
//       'In Discussion': 'leads-enquiries-badge-discussion',
//       'Proposal Sent': 'leads-enquiries-badge-proposal',
//       'Closed Won': 'leads-enquiries-badge-won',
//       'Closed Lost': 'leads-enquiries-badge-lost'
//     };
//     return statusClasses[status] || 'leads-enquiries-badge-default';
//   };

//   const getPriorityClass = (priority) => {
//     const priorityClasses = {
//       'High': 'leads-enquiries-badge-high',
//       'Medium': 'leads-enquiries-badge-medium',
//       'Low': 'leads-enquiries-badge-low'
//     };
//     return priorityClasses[priority] || 'leads-enquiries-badge-default';
//   };

//   // Filter and search logic
//   const filteredLeads = leads.filter(lead => {
//     const matchesSearch =
//       lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       lead.phone.includes(searchTerm) ||
//       lead.id.toLowerCase().includes(searchTerm.toLowerCase());

//     const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
//     const matchesPriority = priorityFilter === 'All' || lead.priority === priorityFilter;
//     const matchesSource = sourceFilter === 'All' || lead.source === sourceFilter;

//     return matchesSearch && matchesStatus && matchesPriority && matchesSource;
//   });

//   // Pagination
//   const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);
//   const startIndex = (currentPage - 1) * rowsPerPage;
//   const endIndex = startIndex + rowsPerPage;
//   const currentLeads = filteredLeads.slice(startIndex, endIndex);

//   return (
//     <div className="leads-enquiries-container">
//       {/* Breadcrumb */}
//       <div className="leads-enquiries-breadcrumb">
//         <span>Dashboard</span>
//         <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
//         <span className="leads-enquiries-breadcrumb-active">Leads / Enquiries</span>
//       </div>

//       {/* Page Header */}
//       <div className="leads-enquiries-header">
        
//         <div className="page-header-with-filter">
//                     <h1 className="leads-enquiries-title">Leads / Enquiries</h1>

//           <GroupCategoryFilter
//           groupValue={groupName}
//           subGroupValue={subGroupName}
//           onChange={updateFilters}
//         />
//         </div>
//       </div>

//       {/* Action Bar */}
//       <div className="leads-enquiries-action-bar">
//         <div className="leads-enquiries-search-wrapper">
//           <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//           </svg>
//           <input
//             type="text"
//             placeholder="Search by name, company, email, phone, or ID..."
//             className="leads-enquiries-search-input"
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//           />
//         </div>

//         <div className="leads-enquiries-filters">
//           <select
//             className="leads-enquiries-filter-select"
//             value={statusFilter}
//             onChange={(e) => setStatusFilter(e.target.value)}
//           >
//             <option value="All">All Status</option>
//             <option value="New">New</option>
//             <option value="Contacted">Contacted</option>
//             <option value="In Discussion">In Discussion</option>
//             <option value="Proposal Sent">Proposal Sent</option>
//             <option value="Closed Won">Closed Won</option>
//             <option value="Closed Lost">Closed Lost</option>
//           </select>

//           <select
//             className="leads-enquiries-filter-select"
//             value={priorityFilter}
//             onChange={(e) => setPriorityFilter(e.target.value)}
//           >
//             <option value="All">All Priority</option>
//             <option value="High">High</option>
//             <option value="Medium">Medium</option>
//             <option value="Low">Low</option>
//           </select>

//           <select
//             className="leads-enquiries-filter-select"
//             value={sourceFilter}
//             onChange={(e) => setSourceFilter(e.target.value)}
//           >
//             <option value="All">All Sources</option>
//             <option value="Website">Website</option>
//             <option value="Referral">Referral</option>
//             <option value="Cold Call">Cold Call</option>
//             <option value="Email">Email</option>
//             <option value="Others">Others</option>
//           </select>
//         </div>

//         <div className="leads-enquiries-action-buttons">
//           <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
//             <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
//             </svg>
//             Add New Lead
//           </button>
//           <button className="leads-enquiries-btn leads-enquiries-btn-secondary">
//             <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
//             </svg>
//             Export
//           </button>
//         </div>
//       </div>

//       {/* Data Table */}
//       <div className="leads-enquiries-table-card">
//         <div className="leads-enquiries-table-wrapper">
//           <table className="leads-enquiries-table">
//             <thead>
//               <tr>
//                 <th onClick={() => handleSort('id')}>Lead ID</th>
//                 <th onClick={() => handleSort('clientName')}>Client Name</th>
//                 <th onClick={() => handleSort('companyName')}>Company Name</th>
//                 <th>Email</th>
//                 <th>Phone</th>
//                 <th>Source</th>
//                 <th>Priority</th>
//                 <th>Status</th>
//                 <th>Assigned To</th>
//                 <th onClick={() => handleSort('lastUpdated')}>Last Updated</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {currentLeads.map((lead) => (
//                 <tr key={lead.id}>
//                   <td className="leads-enquiries-font-medium">{lead.id}</td>
//                   <td className="leads-enquiries-font-medium">{lead.clientName}</td>
//                   <td>{lead.companyName}</td>
//                   <td>{lead.email}</td>
//                   <td>{lead.phone}</td>
//                   <td>{lead.source}</td>
//                   <td>
//                     <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>
//                       {lead.priority}
//                     </span>
//                   </td>
//                   <td>
//                     <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>
//                       {lead.status}
//                     </span>
//                   </td>
//                   <td>{lead.assignedTo}</td>
//                   <td>{lead.lastUpdated}</td>
//                   <td>
//                     <div className="leads-enquiries-action-buttons-cell">
//                       <button
//                         className="leads-enquiries-action-btn leads-enquiries-action-view"
//                         onClick={() => handleView(lead)}
//                         title="View"
//                       >
//                         <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
//                         </svg>
//                       </button>
//                       <button
//                         className="leads-enquiries-action-btn leads-enquiries-action-edit"
//                         onClick={() => handleEdit(lead)}
//                         title="Edit"
//                       >
//                         <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
//                         </svg>
//                       </button>
//                       <button
//                         className="leads-enquiries-action-btn leads-enquiries-action-delete"
//                         onClick={() => handleDelete(lead.id)}
//                         title="Delete"
//                       >
//                         <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
//                         </svg>
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>

//         {/* Pagination */}
//         <div className="leads-enquiries-pagination">
//           <div className="leads-enquiries-pagination-info">
//             Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length} entries
//           </div>
//           <div className="leads-enquiries-pagination-controls">
//             <select
//               className="leads-enquiries-rows-select"
//               value={rowsPerPage}
//               onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
//             >
//               <option value={10}>10 rows</option>
//               <option value={25}>25 rows</option>
//               <option value={50}>50 rows</option>
//             </select>
//             <div className="leads-enquiries-pagination-buttons">
//               <button
//                 className="leads-enquiries-pagination-btn"
//                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
//                 disabled={currentPage === 1}
//               >
//                 Previous
//               </button>
//               <span className="leads-enquiries-pagination-current">
//                 Page {currentPage} of {totalPages}
//               </span>
//               <button
//                 className="leads-enquiries-pagination-btn"
//                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
//                 disabled={currentPage === totalPages}
//               >
//                 Next
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Add/Edit Lead Modal */}
//       {showAddModal && (
//         <div className="leads-enquiries-modal-overlay" onClick={() => setShowAddModal(false)}>
//           <div className="leads-enquiries-modal" onClick={(e) => e.stopPropagation()}>
//             <div className="leads-enquiries-modal-header">
//               <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
//               <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
//                 <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>
//             <form onSubmit={handleSubmit} className="leads-enquiries-form">
//               <div className="leads-enquiries-form-section">
//                 <h3 className="leads-enquiries-form-section-title">Client Information</h3>
//                 <div className="leads-enquiries-form-grid">
//                   <div className="leads-enquiries-form-group">
//                     <label>Client Name *</label>
//                     <input
//                       type="text"
//                       required
//                       value={formData.clientName}
//                       onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
//                     />
//                   </div>
//                   <div className="leads-enquiries-form-group">
//                     <label>Company Name *</label>
//                     <input
//                       type="text"
//                       required
//                       value={formData.companyName}
//                       onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
//                     />
//                   </div>
//                   <div className="leads-enquiries-form-group">
//                     <label>Email *</label>
//                     <input
//                       type="email"
//                       required
//                       value={formData.email}
//                       onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//                     />
//                   </div>
//                   <div className="leads-enquiries-form-group">
//                     <label>Phone *</label>
//                     <input
//                       type="tel"
//                       required
//                       value={formData.phone}
//                       onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
//                     />
//                   </div>
//                 </div>
//               </div>

//               <div className="leads-enquiries-form-section">
//                 <h3 className="leads-enquiries-form-section-title">Lead Details</h3>
//                 <div className="leads-enquiries-form-grid">
//                   <div className="leads-enquiries-form-group">
//                     <label>Lead Source *</label>
//                     <select
//                       required
//                       value={formData.source}
//                       onChange={(e) => setFormData({ ...formData, source: e.target.value })}
//                     >
//                       <option value="Website">Website</option>
//                       <option value="Referral">Referral</option>
//                       <option value="Cold Call">Cold Call</option>
//                       <option value="Email">Email</option>
//                       <option value="Others">Others</option>
//                     </select>
//                   </div>
//                   <div className="leads-enquiries-form-group">
//                     <label>Priority *</label>
//                     <select
//                       required
//                       value={formData.priority}
//                       onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
//                     >
//                       <option value="High">High</option>
//                       <option value="Medium">Medium</option>
//                       <option value="Low">Low</option>
//                     </select>
//                   </div>
//                   <div className="leads-enquiries-form-group">
//                     <label>Status *</label>
//                     <select
//                       required
//                       value={formData.status}
//                       onChange={(e) => setFormData({ ...formData, status: e.target.value })}
//                     >
//                       <option value="New">New</option>
//                       <option value="Contacted">Contacted</option>
//                       <option value="In Discussion">In Discussion</option>
//                       <option value="Proposal Sent">Proposal Sent</option>
//                       <option value="Closed Won">Closed Won</option>
//                       <option value="Closed Lost">Closed Lost</option>
//                     </select>
//                   </div>
//                   <div className="leads-enquiries-form-group">
//                     <label>Assign To *</label>
//                     <select
//                       required
//                       value={formData.assignedTo}
//                       onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
//                     >
//                       <option value="">Select Member</option>
//                       <option value="Sarah M.">Sarah M.</option>
//                       <option value="Mike R.">Mike R.</option>
//                       <option value="Emma T.">Emma T.</option>
//                     </select>
//                   </div>
//                 </div>
//                 <div className="leads-enquiries-form-group">
//                   <label>Enquiry Description *</label>
//                   <textarea
//                     required
//                     rows={4}
//                     value={formData.description}
//                     onChange={(e) => setFormData({ ...formData, description: e.target.value })}
//                     placeholder="Describe the client's requirements..."
//                   />
//                 </div>
//               </div>

//               <div className="leads-enquiries-form-actions">
//                 <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowAddModal(false)}>
//                   Cancel
//                 </button>
//                 <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary">
//                   {formData.id ? 'Update Lead' : 'Save Lead'}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* View Details Modal */}
//       {showViewModal && selectedLead && (
//         <div className="leads-enquiries-modal-overlay" onClick={() => setShowViewModal(false)}>
//           <div className="leads-enquiries-modal leads-enquiries-modal-large" onClick={(e) => e.stopPropagation()}>
//             <div className="leads-enquiries-modal-header">
//               <h2>Lead Details - {selectedLead.id}</h2>
//               <button className="leads-enquiries-modal-close" onClick={() => setShowViewModal(false)}>
//                 <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                 </svg>
//               </button>
//             </div>
//             <div className="leads-enquiries-modal-body">
//               <div className="leads-enquiries-detail-section">
//                 <h3>Basic Information</h3>
//                 <div className="leads-enquiries-detail-grid">
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Client Name:</span>
//                     <span className="leads-enquiries-detail-value">{selectedLead.clientName}</span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Company:</span>
//                     <span className="leads-enquiries-detail-value">{selectedLead.companyName}</span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Email:</span>
//                     <span className="leads-enquiries-detail-value">{selectedLead.email}</span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Phone:</span>
//                     <span className="leads-enquiries-detail-value">{selectedLead.phone}</span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Source:</span>
//                     <span className="leads-enquiries-detail-value">{selectedLead.source}</span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Priority:</span>
//                     <span className={`leads-enquiries-badge ${getPriorityClass(selectedLead.priority)}`}>
//                       {selectedLead.priority}
//                     </span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Status:</span>
//                     <span className={`leads-enquiries-badge ${getStatusClass(selectedLead.status)}`}>
//                       {selectedLead.status}
//                     </span>
//                   </div>
//                   <div className="leads-enquiries-detail-item">
//                     <span className="leads-enquiries-detail-label">Assigned To:</span>
//                     <span className="leads-enquiries-detail-value">{selectedLead.assignedTo}</span>
//                   </div>
//                 </div>
//               </div>

//               <div className="leads-enquiries-detail-section">
//                 <h3>Enquiry Description</h3>
//                 <p className="leads-enquiries-description">{selectedLead.description}</p>
//               </div>

//               <div className="leads-enquiries-detail-section">
//                 <h3>Activity Timeline</h3>
//                 <div className="leads-enquiries-timeline">
//                   {selectedLead.activities.map((activity, index) => (
//                     <div key={index} className="leads-enquiries-timeline-item">
//                       <div className="leads-enquiries-timeline-marker"></div>
//                       <div className="leads-enquiries-timeline-content">
//                         <div className="leads-enquiries-timeline-header">
//                           <span className="leads-enquiries-timeline-type">{activity.type}</span>
//                           <span className="leads-enquiries-timeline-date">{activity.date}</span>
//                         </div>
//                         <div className="leads-enquiries-timeline-body">
//                           <p>{activity.content}</p>
//                           <span className="leads-enquiries-timeline-user">by {activity.user}</span>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <div className="leads-enquiries-modal-actions">
//                 <button className="leads-enquiries-btn leads-enquiries-btn-secondary">Add Note</button>
//                 <button className="leads-enquiries-btn leads-enquiries-btn-secondary">Add Follow-Up</button>
//                 <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => handleEdit(selectedLead)}>
//                   Edit Lead
//                 </button>
//                 <button className="leads-enquiries-btn leads-enquiries-btn-primary">Convert to Proposal</button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default LeadsEnquiries;