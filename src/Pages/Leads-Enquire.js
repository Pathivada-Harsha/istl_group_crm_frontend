// Leads-Enquiries.js - Updated with Grid View, Drag & Drop Column Reorder, and Column Visibility
import React, { useState, useEffect, useRef } from 'react';
import '../pages-css/Leads-Enquire.css';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast.js';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import LeadTimelineModal from '../components/Leads/LeadTimelineModal.js';
import AddFollowupModal from '../components/Leads/AddFollowupModal.js';
import CreateProposalModal from '../components/Leads/CreateProposalModal.js';
import { TiInfo } from 'react-icons/ti';
import { TiInfoLarge } from "react-icons/ti";

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

// All available columns definition
const ALL_COLUMNS = [
  { key: 'name',      label: 'Client Name', sortable: true,  required: true  },
  { key: 'email',     label: 'Email',       sortable: true,  required: false },
  { key: 'phone',     label: 'Phone',       sortable: true,  required: false },
  { key: 'groupName', label: 'Group',       sortable: true,  required: false },
  { key: 'priority',  label: 'Priority',    sortable: true,  required: false },
  { key: 'status',    label: 'Status',      sortable: true,  required: false },
  { key: 'source',    label: 'Source',      sortable: true,  required: false },
  { key: 'assignedToName', label: 'Assigned To', sortable: true, required: false },
  { key: 'createdAt', label: 'Created At',  sortable: true,  required: false },
  { key: 'actions',   label: 'Actions',     sortable: false, required: true  },
];

// Delete Confirmation Toast Component
const DeleteConfirmationToast = ({ onConfirm, onCancel, leadName }) => {
  return (
    <div className="delete-confirmation-toast">
      <div className="delete-confirmation-content">
        <div className="delete-confirmation-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="2" />
            <path d="M12 8V12M12 16H12.01" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="delete-confirmation-text">
          <h4>Delete Lead</h4>
          <p>Are you sure you want to delete lead "{leadName}"? This action cannot be undone.</p>
        </div>
        <button className="delete-confirmation-close" onClick={onCancel} title="Cancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="delete-confirmation-actions">
        <button className="delete-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="delete-btn-confirm" onClick={onConfirm}>Confirm Delete</button>
      </div>
    </div>
  );
};

// ============================================================
// Column Visibility Dropdown Component
// ============================================================
const ColumnVisibilityDropdown = ({ columns, visibleColumns, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hiddenCount = columns.filter(c => !c.required && !visibleColumns.includes(c.key)).length;

  return (
    <div className="col-visibility-wrapper" ref={ref}>
      <button
        className={`col-visibility-btn ${hiddenCount > 0 ? 'has-hidden' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Show / hide columns"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Columns
        {hiddenCount > 0 && <span className="col-visibility-badge">{hiddenCount}</span>}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="col-visibility-dropdown">
          <div className="col-visibility-header">
            <span>Toggle Columns</span>
            <button className="col-visibility-reset" onClick={onReset}>Reset</button>
          </div>
          <div className="col-visibility-list">
            {columns.map(col => (
              <label
                key={col.key}
                className={`col-visibility-item ${col.required ? 'col-required' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.key)}
                  onChange={() => !col.required && onToggle(col.key)}
                  disabled={col.required}
                />
                <span className="col-visibility-label">{col.label}</span>
                {col.required && <span className="col-required-tag">required</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Draggable Table Header Cell
// ============================================================
const DraggableHeaderCell = ({
  col, index, sortColumn, sortDirection, getSortIcon, handleSort,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragOver
}) => {
  return (
    <th
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`
        col-draggable
        ${isDragOver ? 'col-drag-over' : ''}
      `}
      onClick={() => col.sortable && handleSort(col.key)}
      style={{ cursor: col.sortable ? 'pointer' : 'grab' }}
    >
      <div className="th-content">
        <span className="col-drag-handle" title="Drag to reorder">
          <svg fill="currentColor" viewBox="0 0 24 24" width="10" height="10">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </span>
        {col.label}
        {col.sortable && getSortIcon(col.key)}
      </div>
    </th>
  );
};


// ============================================================
// Main Component
// ============================================================
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
  const [viewMode, setViewMode] = useState('table');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { user, pagePermissions } = useAuth();

  // Column ordering & visibility
  const defaultColumnOrder = ALL_COLUMNS.map(c => c.key);
  const defaultVisibleColumns = ALL_COLUMNS
    .filter(c => !['source', 'assignedToName', 'createdAt'].includes(c.key))
    .map(c => c.key);

  const [columnOrder, setColumnOrder] = useState(defaultColumnOrder);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);

  // Drag state
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Follow-up and Timeline states
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedLeadForFollowup, setSelectedLeadForFollowup] = useState(null);
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [selectedLeadForProposal, setSelectedLeadForProposal] = useState(null);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  // Phone validation error
  const [phoneError, setPhoneError] = useState('');

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
  const [allLeads, setAllLeads] = useState([]);

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

  // ── Ordered + visible columns for the table ──────────────────
  const orderedVisibleColumns = columnOrder
    .map(key => ALL_COLUMNS.find(c => c.key === key))
    .filter(col => col && visibleColumns.includes(col.key));

  // ── Column drag handlers ──────────────────────────────────────
  const handleColDragStart = (e, index) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('col-dragging');
  };

  const handleColDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleColDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;

    // Get the visual indices of currently visible columns
    const visibleKeys = orderedVisibleColumns.map(c => c.key);
    const dragKey = visibleKeys[dragIndex];
    const dropKey = visibleKeys[dropIndex];

    // Reorder within the full columnOrder array
    const newOrder = [...columnOrder];
    const fromIdx = newOrder.indexOf(dragKey);
    const toIdx = newOrder.indexOf(dropKey);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragKey);
    setColumnOrder(newOrder);
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  const handleColDragEnd = (e) => {
    e.currentTarget.classList.remove('col-dragging');
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  // ── Column visibility handlers ────────────────────────────────
  const handleToggleColumn = (key) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleResetColumns = () => {
    setColumnOrder(defaultColumnOrder);
    setVisibleColumns(defaultVisibleColumns);
  };

  // ── Fetch helpers ─────────────────────────────────────────────
  const fetchWithHeaders = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'User-Id': currentUser.id,
      'User-Role': currentUser.role,
      ...options.headers
    };
    const response = await fetch(url, { ...options, credentials: "include", headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  useEffect(() => {
    if (canView) { fetchLeads(); fetchUsers(); fetchGroups(); }
  }, [canView]);

  useEffect(() => {
    if (canView) fetchLeads();
  }, [groupName, subGroupName, canView]);

  useEffect(() => {
    if (formData.groupName) fetchSubGroupsForForm(formData.groupName);
    else setSubGroups([]);
  }, [formData.groupName]);

  const fetchLeads = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/getAll?${params}`);
      if (data.success) { setAllLeads(data.data); setLeads(data.data); }
    } catch (err) {
      setError(err.message || 'Error fetching leads');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowup = (lead) => {
    if (!canCreate) { showError('You do not have permission to create follow-ups'); return; }
    setSelectedLeadForFollowup(lead); setShowFollowupModal(true);
  };

  const handleCreateProposal = (lead) => {
    if (!canCreate) { showError('You do not have permission to create proposals'); return; }
    setSelectedLeadForProposal(lead); setShowProposalModal(true);
  };

  const handleProposalCreated = () => {
    setShowProposalModal(false); setSelectedLeadForProposal(null);
    showSuccess('Proposal created successfully'); fetchLeads();
  };

  const handleViewTimeline = async (lead) => {
    if (!canView) { showError('You do not have permission to view timeline'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) { setSelectedLeadForTimeline(data.data); setShowTimelineModal(true); }
    } catch (err) { showError(err.message || 'Error fetching lead details'); }
  };

  const handleFollowupCreated = () => {
    setShowFollowupModal(false); setSelectedLeadForFollowup(null);
    showSuccess('Follow-up created successfully'); fetchLeads();
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-users`, {
        credentials: "include",
        headers: { 'User-Id': currentUser.id, 'User-Role': currentUser.role }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) { console.error('Error fetching users:', err); setUsers([]); }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, {
        credentials: "include",
        headers: { 'User-Id': currentUser.id, 'User-Role': currentUser.role }
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      if (Array.isArray(data)) setGroups(data);
    } catch (err) { console.error('Error fetching groups:', err); setGroups([]); }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) { setSubGroups([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, {
        credentials: "include",
        headers: { 'User-Id': currentUser.id, 'User-Role': currentUser.role }
      });
      if (!response.ok) throw new Error('Failed to fetch subgroups');
      const data = await response.json();
      if (Array.isArray(data)) setSubGroups(data);
    } catch (err) { console.error('Error fetching subgroups:', err); setSubGroups([]); }
  };

  const applyClientSideFilters = () => {
    let filteredLeads = [...allLeads];
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredLeads = filteredLeads.filter(lead =>
        (lead.name && lead.name.toLowerCase().includes(searchLower)) ||
        (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
        (lead.phone && lead.phone.toLowerCase().includes(searchLower)) ||
        (lead.leadCode && lead.leadCode.toLowerCase().includes(searchLower))
      );
    }
    if (statusFilter !== 'All') filteredLeads = filteredLeads.filter(lead => lead.status === statusFilter);
    if (priorityFilter !== 'All') filteredLeads = filteredLeads.filter(lead => lead.priority === priorityFilter);
    if (sourceFilter !== 'All') filteredLeads = filteredLeads.filter(lead => lead.source === sourceFilter);
    setLeads(filteredLeads);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const debounceTimer = setTimeout(() => applyClientSideFilters(), 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, statusFilter, priorityFilter, sourceFilter, allLeads]);

  const handleSort = (column) => {
    const direction = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column); setSortDirection(direction);
    const sortedLeads = [...leads].sort((a, b) => {
      const aValue = a[column] || ''; const bValue = b[column] || '';
      return direction === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });
    setLeads(sortedLeads);
  };

  const handleView = async (lead) => {
    if (!canView) { showError('You do not have permission to view leads'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) { setSelectedLead(data.data); setShowViewModal(true); }
    } catch (err) { showError(err.message || 'Error fetching lead details'); }
  };

  const handleEdit = (lead) => {
    if (!canEdit) { showError('You do not have permission to edit leads'); return; }
    setShowViewModal(false);
    setFormData({
      id: lead.id, customerId: lead.customerId, name: lead.name, email: lead.email,
      phone: lead.phone, source: lead.source, priority: lead.priority, status: lead.status,
      assignedTo: lead.assignedTo, enquiry: lead.enquiry,
      groupName: lead.groupName || '', subGroupName: lead.subGroupName || ''
    });
    setPhoneError(''); setShowAddModal(true);
  };

  const handleDelete = (lead) => {
    if (!canDelete) { showError('You do not have permission to delete leads'); return; }
    setDeleteConfirmation({ id: lead.id, name: lead.name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/delete/${deleteConfirmation.id}`, { method: 'DELETE' });
      if (data.success) { showSuccess('Lead deleted successfully'); setDeleteConfirmation(null); fetchLeads(); }
    } catch (err) { showError(err.message || 'Error deleting lead'); setDeleteConfirmation(null); }
  };

  const cancelDelete = () => setDeleteConfirmation(null);

  const validatePhone = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) { setPhoneError(''); return cleaned; }
    if (cleaned.length > 10) { setPhoneError('Phone number must be maximum 10 digits'); return cleaned.slice(0, 10); }
    setPhoneError(''); return cleaned;
  };

  const handlePhoneChange = (e) => {
    const validatedPhone = validatePhone(e.target.value);
    setFormData({ ...formData, phone: validatedPhone });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.phone && formData.phone.length !== 10) { setPhoneError('Phone number must be exactly 10 digits'); return; }
    if (formData.id && !canEdit) { showError('You do not have permission to edit leads'); return; }
    if (!formData.id && !canCreate) { showError('You do not have permission to create leads'); return; }
    setLoading(true);
    try {
      const isClosingWon = formData.status === 'Closed Won' && formData.id &&
        leads.find(l => l.id === formData.id)?.status !== 'Closed Won';
      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/update/${formData.id}`, { method: 'PUT', body: JSON.stringify(formData) });
        if (data.success) {
          if (isClosingWon) {
            showSuccess('Lead updated successfully!\n\n✅ Lead has been converted to Customer automatically.\nYou can find the customer in the Customers Database.');
          } else { showSuccess('Lead updated successfully'); }
          setShowAddModal(false); resetForm(); fetchLeads();
        }
      } else {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/create`, { method: 'POST', body: JSON.stringify(formData) });
        if (data.success) { showSuccess('Lead created successfully'); setShowAddModal(false); resetForm(); fetchLeads(); }
      }
    } catch (err) { showError(err.message || 'Error saving lead'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({ customerId: null, name: '', email: '', phone: '', source: 'Website', priority: 'Medium', status: 'New', assignedTo: null, enquiry: '', groupName: '', subGroupName: '' });
    setPhoneError('');
  };

  const getStatusClass = (status) => {
    const statusClasses = { 'New': 'leads-enquiries-badge-new', 'Contacted': 'leads-enquiries-badge-contacted', 'In Discussion': 'leads-enquiries-badge-discussion', 'Proposal Sent': 'leads-enquiries-badge-proposal', 'Closed Won': 'leads-enquiries-badge-won', 'Closed Lost': 'leads-enquiries-badge-lost' };
    return statusClasses[status] || 'leads-enquiries-badge-default';
  };

  const getPriorityClass = (priority) => {
    const priorityClasses = { 'High': 'leads-enquiries-badge-high', 'Medium': 'leads-enquiries-badge-medium', 'Low': 'leads-enquiries-badge-low' };
    return priorityClasses[priority] || 'leads-enquiries-badge-default';
  };

  const totalPages = Math.ceil(leads.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentLeads = leads.slice(startIndex, endIndex);

  const exportToCSV = () => {
    if (!canView) { showError('You do not have permission to export leads'); return; }
    const headers = ['Lead ID', 'Client Name', 'Email', 'Phone', 'Source', 'Priority', 'Status', 'Group', 'Category', 'Assigned To', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => [lead.leadCode, lead.name, lead.email, lead.phone, lead.source, lead.priority, lead.status, lead.groupName || '', lead.subGroupName || '', lead.assignedToName || '', lead.createdAt].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return (
        <svg className="sort-icon sort-icon-default" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    if (sortDirection === 'asc') {
      return (
        <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // ── Render cell value for dynamic columns ────────────────────
  const renderCellValue = (lead, colKey) => {
    switch (colKey) {
      case 'name':
        return <span className="leads-enquiries-font-medium">{lead.name}</span>;
      case 'email':
        return lead.email;
      case 'phone':
        return lead.phone;
      case 'groupName':
        return lead.groupName || '-';
      case 'source':
        return lead.source;
      case 'assignedToName':
        return lead.assignedToName || '-';
      case 'createdAt':
        return lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-';
      case 'priority':
        return <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>{lead.priority}</span>;
      case 'status':
        return <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>{lead.status}</span>;
      case 'actions':
        return (
          <div className="leads-enquiries-action-buttons-cell">
            {canView && (
              <button className="leads-enquiries-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            )}
            <button className="leads-enquiries-action-btn leads-enquiries-action-timeline" onClick={() => handleViewTimeline(lead)} title="View Timeline">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button className={`leads-enquiries-action-btn leads-enquiries-action-followup ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleAddFollowup(lead)} title={!canCreate ? 'No permission to add follow-ups' : 'Add Follow-up'} disabled={!canCreate}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button className={`leads-enquiries-action-btn leads-enquiries-action-proposal ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleCreateProposal(lead)} title={!canCreate ? 'No permission to create proposals' : 'Create Proposal'} disabled={!canCreate}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
            <button className={`leads-enquiries-action-btn leads-enquiries-action-edit ${!canEdit ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleEdit(lead)} title={!canEdit ? 'No permission to edit' : 'Edit'} disabled={!canEdit}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button className={`leads-enquiries-action-btn leads-enquiries-action-delete ${!canDelete ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleDelete(lead)} title={!canDelete ? 'No permission to delete' : 'Delete'} disabled={!canDelete}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        );
      default:
        return '-';
    }
  };

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

      {deleteConfirmation && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-toast-wrapper">
            <DeleteConfirmationToast onConfirm={confirmDelete} onCancel={cancelDelete} leadName={deleteConfirmation.name} />
          </div>
        </div>
      )}

      <div className="leads-enquiries-breadcrumb">
        <span>Dashboard</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Leads / Enquiries</span>
      </div>

      <div className="leads-enquiries-header page-header-with-filter">
        <div className="leads-enquiries-title-with-icon">
          <h1>Leads</h1>
        </div>
        <GroupCategoryFilter groupValue={groupName} subGroupValue={subGroupName} onChange={updateFilters} />
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="leads-enquiries-action-bar">
        <div className="leads-enquiries-search-wrapper">
          <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by name, email, phone, or ID..." className="leads-enquiries-search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
            onClick={() => { if (canCreate) { resetForm(); setShowAddModal(true); } else { showError('You do not have permission to create leads'); } }}
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

      {/* View Toggle + Column Controls */}
      <div className="leads-enquiries-view-toggle-container">
        {/* Column visibility - only shown in table mode */}
        {viewMode === 'table' && (
          <ColumnVisibilityDropdown
            columns={ALL_COLUMNS}
            visibleColumns={visibleColumns}
            onToggle={handleToggleColumn}
            onReset={handleResetColumns}
          />
        )}

        <div className="leads-enquiries-view-toggle">
          <button className={`leads-enquiries-view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} title="Table View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Table
          </button>
          <button className={`leads-enquiries-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Grid
          </button>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="leads-enquiries-table-card">
          <div className="leads-enquiries-table-wrapper">
            <table className="leads-enquiries-table">
              <thead>
                <tr>
                  {orderedVisibleColumns.map((col, index) => (
                    <DraggableHeaderCell
                      key={col.key}
                      col={col}
                      index={index}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      getSortIcon={getSortIcon}
                      handleSort={handleSort}
                      onDragStart={handleColDragStart}
                      onDragOver={handleColDragOver}
                      onDrop={handleColDrop}
                      onDragEnd={handleColDragEnd}
                      isDragOver={dragOverIndex === index}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={orderedVisibleColumns.length} className="text-center py-4">No leads found</td>
                  </tr>
                ) : (
                  currentLeads.map((lead) => (
                    <tr key={lead.id}>
                      {orderedVisibleColumns.map(col => (
                        <td key={col.key} style={col.key === 'actions' ? { textAlign: 'center' } : {}}>
                          {renderCellValue(lead, col.key)}
                        </td>
                      ))}
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
                <button className="leads-enquiries-pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                <span className="leads-enquiries-pagination-current">Page {currentPage} of {totalPages}</span>
                <button className="leads-enquiries-pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
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
                  <div className="leads-enquiries-card-id">{lead.leadCode}</div>
                  <div className="leads-enquiries-card-badges">
                    <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>{lead.priority}</span>
                    <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>{lead.status}</span>
                  </div>
                </div>
                <div className="leads-enquiries-card-body">
                  <h3 className="leads-enquiries-card-title">{lead.name}</h3>
                  <div className="leads-enquiries-card-info">
                    <div className="leads-enquiries-card-info-item">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <span>{lead.email}</span>
                    </div>
                    <div className="leads-enquiries-card-info-item">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span>{lead.phone}</span>
                    </div>
                    {lead.groupName && (
                      <div className="leads-enquiries-card-info-item">
                        <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        <span>{lead.groupName}</span>
                      </div>
                    )}
                  </div>
                  {lead.enquiry && <div className="leads-enquiries-card-description">{lead.enquiry}</div>}
                </div>
                <div className="leads-enquiries-card-footer">
                  <div className="leads-enquiries-card-source">
                    <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    {lead.source}
                  </div>
                  <div className="leads-enquiries-card-actions">
                    {canView && (
                      <button className="leads-enquiries-card-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View Details">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    )}
                    <button className="leads-enquiries-card-action-btn leads-enquiries-action-timeline" onClick={() => handleViewTimeline(lead)} title="View Timeline">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <button className={`leads-enquiries-card-action-btn leads-enquiries-action-followup ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleAddFollowup(lead)} title={!canCreate ? 'No permission' : 'Add Follow-up'} disabled={!canCreate}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </button>
                    <button className={`leads-enquiries-card-action-btn leads-enquiries-action-proposal ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleCreateProposal(lead)} title={!canCreate ? 'No permission' : 'Create Proposal'} disabled={!canCreate}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                    {canEdit && (
                      <button className="leads-enquiries-card-action-btn leads-enquiries-action-edit" onClick={() => handleEdit(lead)} title="Edit Lead">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    )}
                    {canDelete && (
                      <button className="leads-enquiries-card-action-btn leads-enquiries-action-delete" onClick={() => handleDelete(lead)} title="Delete Lead">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="leads-enquiries-pagination">
            <div className="leads-enquiries-pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, leads.length)} of {leads.length} entries
            </div>
            <div className="leads-enquiries-pagination-controls">
              <select className="leads-enquiries-rows-select" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                <option value={10}>10 items</option>
                <option value={25}>25 items</option>
                <option value={50}>50 items</option>
              </select>
              <div className="leads-enquiries-pagination-buttons">
                <button className="leads-enquiries-pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                <span className="leads-enquiries-pagination-current">Page {currentPage} of {totalPages}</span>
                <button className="leads-enquiries-pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Lead Modal */}
      {showAddModal && (
        <div className="leads-enquiries-modal-overlay">
          <div className="leads-enquiries-modal" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                    <input type="text" required value={formData.phone} onChange={handlePhoneChange} placeholder="Enter 10 digit number" maxLength="10" />
                    {phoneError && <span className="phone-error-message">{phoneError}</span>}
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Group</label>
                    <select value={formData.groupName} onChange={(e) => setFormData({ ...formData, groupName: e.target.value, subGroupName: '' })}>
                      <option value="">Select Group</option>
                      {groups.map((group, index) => (
                        <option key={group.value || group.label || index} value={group.value || group.label}>{group.label || group.value}</option>
                      ))}
                    </select>
                  </div>
                  <div className="leads-enquiries-form-group">
                    <label>Category</label>
                    <select value={formData.subGroupName} onChange={(e) => setFormData({ ...formData, subGroupName: e.target.value })} disabled={!formData.groupName}>
                      <option value="">Select Category</option>
                      {subGroups.map((sub, index) => (
                        <option key={sub.value || sub.label || index} value={sub.value || sub.label}>{sub.label || sub.value}</option>
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
                    <select value={formData.assignedTo || ''} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? Number(e.target.value) : null })} disabled={!canAssign}>
                      <option value="">Select Member</option>
                      {users.map(user => (<option key={user.id} value={user.id}>{user.name}</option>))}
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
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary" disabled={loading || phoneError}>
                  {loading ? 'Saving...' : (formData.id ? 'Update Lead' : 'Save Lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Lead Modal */}
      {showViewModal && selectedLead && (
        <div className="leads-enquiries-modal-overlay">
          <div className="leads-enquiries-modal leads-enquiries-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>Lead Details - {selectedLead.leadCode}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowViewModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="leads-enquiries-modal-body">
              <div className="leads-enquiries-detail-section">
                <h3>Basic Information</h3>
                <div className="leads-enquiries-detail-grid">
                  {[
                    ['Client Name', selectedLead.name], ['Email', selectedLead.email], ['Phone', selectedLead.phone],
                    ['Source', selectedLead.source], ['Group', selectedLead.groupName || '-'], ['Category', selectedLead.subGroupName || '-'],
                    ['Assigned To', selectedLead.assignedToName || '-'], ['Created By', selectedLead.createdByName || '-'], ['Created At', selectedLead.createdAt],
                  ].map(([label, value]) => (
                    <div className="leads-enquiries-detail-item" key={label}>
                      <span className="leads-enquiries-detail-label">{label}:</span>
                      <span className="leads-enquiries-detail-value">{value}</span>
                    </div>
                  ))}
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Priority:</span>
                    <span className={`leads-enquiries-badge ${getPriorityClass(selectedLead.priority)}`}>{selectedLead.priority}</span>
                  </div>
                  <div className="leads-enquiries-detail-item">
                    <span className="leads-enquiries-detail-label">Status:</span>
                    <span className={`leads-enquiries-badge ${getStatusClass(selectedLead.status)}`}>{selectedLead.status}</span>
                  </div>
                </div>
              </div>
              <div className="leads-enquiries-detail-section">
                <h3>Enquiry Description</h3>
                <p className="leads-enquiries-description">{selectedLead.enquiry}</p>
              </div>
              <div className="leads-enquiries-modal-actions">
                {canCreate && (
                  <button className="leads-enquiries-btn leads-enquiries-btn-success" onClick={() => { setShowViewModal(false); handleAddFollowup(selectedLead); }}>
                    <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Follow-up
                  </button>
                )}
                <button className="leads-enquiries-btn leads-enquiries-btn-info" onClick={() => { setShowViewModal(false); handleViewTimeline(selectedLead); }}>
                  <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  View Timeline
                </button>
                {canEdit && <button className="leads-enquiries-btn leads-enquiries-btn-primary" onClick={() => handleEdit(selectedLead)}>Edit Lead</button>}
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFollowupModal && selectedLeadForFollowup && (
        <AddFollowupModal lead={selectedLeadForFollowup} onClose={() => { setShowFollowupModal(false); setSelectedLeadForFollowup(null); }} onFollowupCreated={handleFollowupCreated} />
      )}

      {showTimelineModal && selectedLeadForTimeline && (
        <LeadTimelineModal lead={selectedLeadForTimeline} onClose={() => { setShowTimelineModal(false); setSelectedLeadForTimeline(null); }} onAddFollowup={() => { setShowTimelineModal(false); handleAddFollowup(selectedLeadForTimeline); }} />
      )}

      {showProposalModal && selectedLeadForProposal && (
        <CreateProposalModal lead={selectedLeadForProposal} onClose={() => { setShowProposalModal(false); setSelectedLeadForProposal(null); }} onProposalCreated={handleProposalCreated} defaultTemplate={DEFAULT_PROPOSAL_TEMPLATE} />
      )}
    </div>
  );
}

export default LeadsEnquiries;