// ClientDashboardFollowUps.js
import React, { useState, useEffect } from "react";
import "../pages-css/Follow-ups.css";
import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function ClientDashboardFollowUps() {
  const { user } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const [followUps, setFollowUps] = useState([]);
  const [filteredFollowUps, setFilteredFollowUps] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [assignedToFilter, setAssignedToFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // KPI States
  const [kpis, setKpis] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    overdue: 0,
    today: 0
  });

  // Add Form state
  const [addForm, setAddForm] = useState({
    modalGroupName: '',
    modalSubGroupName: '',
    leadId: '',
    followupType: 'Call',
    scheduledDate: '',
    scheduledTime: '',
    assignedTo: '',
    status: 'Pending',
    priority: 'Medium',
    notes: ''
  });

  // Edit Form state
  const [editForm, setEditForm] = useState({
    followupType: 'Call',
    scheduledDate: '',
    scheduledTime: '',
    assignedTo: '',
    status: 'Pending',
    priority: 'Medium',
    notes: '',
    outcome: ''
  });

  useEffect(() => {
    fetchFollowUps();
    fetchUsers();
    fetchAllLeads();
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [groupName, subGroupName]);

  useEffect(() => {
    applyFilters();
  }, [followUps, statusFilter, priorityFilter, typeFilter, assignedToFilter, searchTerm]);

  useEffect(() => {
    calculateKPIs();
  }, [filteredFollowUps]);

  // Fetch leads when modal group/subgroup changes
  useEffect(() => {
    if (addForm.modalGroupName) {
      fetchSubGroupsForModal(addForm.modalGroupName);
      fetchLeadsForModal();
    } else {
      setSubGroups([]);
      setLeads([]);
    }
  }, [addForm.modalGroupName]);

  useEffect(() => {
    if (addForm.modalGroupName) {
      fetchLeadsForModal();
    }
  }, [addForm.modalSubGroupName]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/followups/my-followups`;

      if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') {
        url = `${API_BASE_URL}/followups/all`;
      }

      const response = await fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch follow-ups');

      const data = await response.json();
      if (data.success) {
        setFollowUps(data.data || []);
      }
    } catch (err) {
      showError(err.message || 'Error fetching follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-users`, {
        credentials: "include",
        headers: {
          'User-Id':   String(user.id),
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      // Default assignedTo to the current user if they are in the list,
      // otherwise default to the first user in the list
      if (list.length > 0) {
        const selfInList = list.some(u => Number(u.id) === Number(user.id));
        const defaultId = selfInList ? user.id : list[0].id;
        setAddForm(prev => ({ ...prev, assignedTo: defaultId }));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchAllLeads = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/leads/getAll`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      if (data.success) {
        setAllLeads(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-groups`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
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

  const fetchSubGroupsForModal = async (group) => {
    if (!group) {
      setSubGroups([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`,
        {
          credentials: "include",
          headers: {
            'User-Id': user.id,
            'User-Role': user.role
          }
        }
      );

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

  const fetchLeadsForModal = async () => {
    try {
      const params = new URLSearchParams();
      if (addForm.modalGroupName) params.append('groupName', addForm.modalGroupName);
      if (addForm.modalSubGroupName) params.append('subGroupName', addForm.modalSubGroupName);

      const response = await fetch(`${API_BASE_URL}/leads/getAll?${params}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      if (data.success) {
        setLeads(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setLeads([]);
    }
  };

  const applyFilters = () => {
    let filtered = [...followUps];

    // Apply group/subgroup filters from page-level filter
    if (groupName) {
      filtered = filtered.filter(f => f.groupName === groupName);
    }
    if (subGroupName) {
      filtered = filtered.filter(f => f.subGroupName === subGroupName);
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }

    if (priorityFilter !== 'All') {
      filtered = filtered.filter(f => f.priority === priorityFilter);
    }

    if (typeFilter !== 'All') {
      filtered = filtered.filter(f => f.followupType === typeFilter);
    }

    if (assignedToFilter !== 'All') {
      filtered = filtered.filter(f => f.assignedTo === parseInt(assignedToFilter));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        (f.notes && f.notes.toLowerCase().includes(term)) ||
        (f.leadCode && f.leadCode.toLowerCase().includes(term)) ||
        (f.assignedToName && f.assignedToName.toLowerCase().includes(term)) ||
        (f.followupType && f.followupType.toLowerCase().includes(term))
      );
    }

    setFilteredFollowUps(filtered);
    setCurrentPage(1);
  };

  const calculateKPIs = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const total = filteredFollowUps.length;
    const pending = filteredFollowUps.filter(f => f.status === 'Pending').length;
    const completed = filteredFollowUps.filter(f => f.status === 'Completed').length;

    const overdue = filteredFollowUps.filter(f => {
      if (f.status !== 'Pending') return false;
      const scheduledDate = new Date(f.scheduledAt);
      return scheduledDate < now;
    }).length;

    const todayCount = filteredFollowUps.filter(f => {
      if (f.status !== 'Pending') return false;
      const scheduledDate = new Date(f.scheduledAt);
      const scheduleDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
      return scheduleDay.getTime() === today.getTime();
    }).length;

    setKpis({ total, pending, completed, overdue, today: todayCount });
  };

  const resetAddForm = () => {
    setAddForm({
      modalGroupName: '',
      modalSubGroupName: '',
      leadId: '',
      followupType: 'Call',
      scheduledDate: '',
      scheduledTime: '',
      assignedTo: user.id,
      status: 'Pending',
      priority: 'Medium',
      notes: ''
    });
    setLeads([]);
    setSubGroups([]);
    setLeadDropdownOpen(false);
    setLeadSearch('');
  };

  const resetEditForm = () => {
    setEditForm({
      followupType: 'Call',
      scheduledDate: '',
      scheduledTime: '',
      assignedTo: '',
      status: 'Pending',
      priority: 'Medium',
      notes: '',
      outcome: ''
    });
  };

  const handleAddFormChange = (e) => {
    const { name, value } = e.target;
    setAddForm(prev => ({ ...prev, [name]: value }));

    // Reset subgroup and lead when group changes
    if (name === 'modalGroupName') {
      setAddForm(prev => ({
        ...prev,
        [name]: value,
        modalSubGroupName: '',
        leadId: ''
      }));
      setLeadSearch('');
      setLeadDropdownOpen(false);
    }

    // Reset lead when subgroup changes
    if (name === 'modalSubGroupName') {
      setAddForm(prev => ({
        ...prev,
        [name]: value,
        leadId: ''
      }));
      setLeadSearch('');
      setLeadDropdownOpen(false);
    }
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();

    if (!addForm.scheduledDate) {
      showError('Please select a date');
      return;
    }

    if (!addForm.leadId) {
      showError('Please select a lead');
      return;
    }

    setLoading(true);

    try {
      const selectedLead = leads.find(l => l.id === parseInt(addForm.leadId))
                        || allLeads.find(l => l.id === parseInt(addForm.leadId));

      const scheduledAt = addForm.scheduledTime
        ? `${addForm.scheduledDate} ${addForm.scheduledTime}:00`
        : `${addForm.scheduledDate} 09:00:00`;

      const requestData = {
        relatedType: 'LEAD',
        relatedId: parseInt(addForm.leadId),
        leadId: parseInt(addForm.leadId),
        customerId: selectedLead?.customerId || null,
        projectId: null,
        groupName: selectedLead?.groupName || addForm.modalGroupName,
        subGroupName: selectedLead?.subGroupName || addForm.modalSubGroupName,
        followupType: addForm.followupType,
        scheduledAt: scheduledAt,
        assignedTo: parseInt(addForm.assignedTo),
        status: addForm.status,
        priority: addForm.priority,
        notes: addForm.notes
      };

      const response = await fetch(`${API_BASE_URL}/followups/create`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create follow-up');
      }

      const data = await response.json();

      if (data.success) {
        showSuccess('Follow-up created successfully');
        setShowAddModal(false);
        resetAddForm();
        fetchFollowUps();
      }
    } catch (err) {
      showError(err.message || 'Error creating follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editForm.scheduledDate) {
      showError('Please select a date');
      return;
    }

    setLoading(true);

    try {
      const scheduledAt = editForm.scheduledTime
        ? `${editForm.scheduledDate} ${editForm.scheduledTime}:00`
        : `${editForm.scheduledDate} 09:00:00`;

      const requestData = {
        followupType: editForm.followupType,
        scheduledAt: scheduledAt,
        assignedTo: parseInt(editForm.assignedTo),
        status: editForm.status,
        priority: editForm.priority,
        notes: editForm.notes,
        outcome: editForm.outcome
      };

      const response = await fetch(`${API_BASE_URL}/followups/update/${editingFollowup.id}`, {
        method: 'PUT',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update follow-up');
      }

      const data = await response.json();

      if (data.success) {
        showSuccess('Follow-up updated successfully');
        setShowEditModal(false);
        resetEditForm();
        setEditingFollowup(null);
        fetchFollowUps();
      }
    } catch (err) {
      showError(err.message || 'Error updating follow-up');
    } finally {
      setLoading(false);
    }
  };

  /**
   * FIX: Robust datetime parser that handles multiple formats from the database:
   * - "2026-02-27 16:59:00"   (space-separated, from MySQL/PostgreSQL)
   * - "2026-02-27T16:59:00"   (ISO with T separator)
   * - "2026-02-27T16:59:00Z"  (ISO with timezone)
   * - "2026-02-27T16:59:00.000Z" (ISO with milliseconds)
   * - "2026-02-27"            (date only)
   */
  const parseDateTimeFromDB = (dateTimeString) => {
    if (!dateTimeString) return { date: '', time: '' };

    // Normalize: replace space separator with T for consistent JS Date parsing
    // Also strip any trailing timezone info that might cause offset issues
    const normalized = String(dateTimeString).trim();

    // Extract date and time parts using regex — handles both "YYYY-MM-DD HH:MM:SS" and ISO formats
    const match = normalized.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);

    if (match) {
      const date = match[1];           // "2026-02-27"
      const time = match[2];           // "16:59"
      return { date, time };
    }

    // Fallback: date only (no time part)
    const dateOnlyMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnlyMatch) {
      return { date: dateOnlyMatch[1], time: '' };
    }

    // Last resort: try native Date parsing
    try {
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) {
        const date = d.toISOString().split('T')[0];
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return { date, time: `${hours}:${minutes}` };
      }
    } catch (_) { }

    return { date: '', time: '' };
  };

  const handleEdit = (followup) => {
    // FIX: Use the robust parser instead of simple string split
    const { date: scheduledDate, time: scheduledTime } = parseDateTimeFromDB(followup.scheduledAt);

    setEditForm({
      followupType: followup.followupType || 'Call',
      scheduledDate,
      scheduledTime,
      assignedTo: followup.assignedTo || user.id,
      status: followup.status || 'Pending',
      priority: followup.priority || 'Medium',
      notes: followup.notes || '',
      outcome: followup.outcome || ''
    });
    setEditingFollowup(followup);
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this follow-up?")) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/followups/delete/${id}`, {
        method: 'DELETE',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to delete follow-up');

      const data = await response.json();
      if (data.success) {
        showSuccess('Follow-up deleted successfully');
        fetchFollowUps();
      }
    } catch (err) {
      showError(err.message || 'Error deleting follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStatusUpdate = async (followup, newStatus) => {
    setLoading(true);
    try {
      const requestData = {
        status: newStatus,
        outcome: newStatus === 'Completed' ? 'Completed via quick action' : undefined
      };

      const response = await fetch(`${API_BASE_URL}/followups/update/${followup.id}`, {
        method: 'PUT',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) throw new Error('Failed to update status');

      const data = await response.json();
      if (data.success) {
        showSuccess('Status updated successfully');
        fetchFollowUps();
      }
    } catch (err) {
      showError(err.message || 'Error updating status');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    // Normalize space-separated datetime for safe JS Date parsing
    const normalized = String(dateString).replace(' ', 'T');
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusClass = (status) => {
    const classes = {
      'Pending': 'pending',
      'Completed': 'completed',
      'Cancelled': 'cancelled',
      'Rescheduled': 'rescheduled'
    };
    return classes[status] || 'pending';
  };

  const getPriorityClass = (priority) => {
    const classes = {
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low'
    };
    return classes[priority] || 'medium';
  };

  const isOverdue = (followup) => {
    if (followup.status !== 'Pending') return false;
    const normalized = String(followup.scheduledAt || '').replace(' ', 'T');
    const scheduledDate = new Date(normalized);
    return !isNaN(scheduledDate.getTime()) && scheduledDate < new Date();
  };

  // Pagination
  const totalPages = Math.ceil(filteredFollowUps.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentFollowUps = filteredFollowUps.slice(startIndex, endIndex);

  return (
    <div className="followups-page-root">
      {loading && <CrmPreloader text="Loading Follow-ups..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Breadcrumb */}
      <div className="followups-breadcrumb">
        <span>Dashboard</span>
        <span className="followups-breadcrumb-separator">&gt;</span>
        <span className="followups-breadcrumb-active">Follow-ups Management</span>
      </div>

      {/* Header with Group Filter */}
      <div className="followups-header page-header-with-filter">
        <h1>Follow-ups Management</h1>
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      {/* KPI Cards */}
      <div className="followups-kpi-container">
        <div className="followups-kpi-card kpi-total">
          <div className="kpi-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Follow-ups</div>
            <div className="kpi-value">{kpis.total}</div>
          </div>
        </div>

        <div className="followups-kpi-card kpi-pending">
          <div className="kpi-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Pending</div>
            <div className="kpi-value">{kpis.pending}</div>
          </div>
        </div>

        <div className="followups-kpi-card kpi-today">
          <div className="kpi-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Due Today</div>
            <div className="kpi-value">{kpis.today}</div>
          </div>
        </div>

        <div className="followups-kpi-card kpi-overdue">
          <div className="kpi-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Overdue</div>
            <div className="kpi-value">{kpis.overdue}</div>
          </div>
        </div>

        <div className="followups-kpi-card kpi-completed">
          <div className="kpi-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Completed</div>
            <div className="kpi-value">{kpis.completed}</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="followups-action-bar">
        <div className="followups-search-wrapper">
          <svg className="followups-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by notes, lead code, or assigned to..."
            className="followups-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="followups-filters">
          <select className="followups-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rescheduled">Rescheduled</option>
          </select>

          <select className="followups-filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="All">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select className="followups-filter-select" value={assignedToFilter} onChange={(e) => setAssignedToFilter(e.target.value)}>
            <option value="All">All Assigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <button
          className="followups-btn followups-btn-primary"
          onClick={() => {
            resetAddForm();
            setShowAddModal(true);
          }}
        >
          <svg className="followups-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Follow-up
        </button>
      </div>


      {/* Table */}
      <div className="followups-table-card">
        <div className="followups-table-scroll-wrapper">  {/* ← new wrapper */}
          <table className="followups-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Type</th>
                <th>Scheduled</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentFollowUps.length === 0 ? (
                <tr>
                  <td colSpan="8" className="followups-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>No follow-ups found</p>
                  </td>
                </tr>
              ) : (
                currentFollowUps.map((followup) => (
                  <tr key={followup.id} className={isOverdue(followup) ? 'followup-overdue' : ''}>
                    <td data-label="Lead">
                      <div className="followup-lead-info">
                        <strong>{followup.leadCode || 'N/A'}</strong>
                        {followup.groupName && (
                          <span className="followup-group-badge">{followup.groupName}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Type">
                      <span className="followup-type-badge">
                        {followup.followupType === 'Call' && '📞'}
                        {followup.followupType === 'Email' && '📧'}
                        {followup.followupType === 'Meeting' && '👥'}
                        {followup.followupType === 'Visit' && '🏢'}
                        {followup.followupType === 'Demo' && '💻'}
                        {followup.followupType === 'Proposal' && '📄'}
                        {followup.followupType === 'Other' && '📌'}
                        {' '}{followup.followupType}
                      </span>
                    </td>
                    <td data-label="Scheduled">
                      <div className="followup-scheduled">
                        {formatDateTime(followup.scheduledAt)}
                        {isOverdue(followup) && (
                          <span className="followup-overdue-badge">Overdue</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Priority">
                      <span className={`followup-priority-badge priority-${getPriorityClass(followup.priority)}`}>
                        {followup.priority}
                      </span>
                    </td>
                    <td data-label="Status">
                      <button
                        className={`followup-status-btn status-${getStatusClass(followup.status)}`}
                        onClick={() => {
                          const newStatus = followup.status === 'Pending' ? 'Completed' : 'Pending';
                          handleQuickStatusUpdate(followup, newStatus);
                        }}
                        title="Click to toggle status"
                      >
                        {followup.status}
                      </button>
                    </td>
                    <td data-label="Assigned To">{followup.assignedToName || 'Unassigned'}</td>
                    <td data-label="Notes">
                      <div className="followup-notes-preview">
                        {followup.notes ? followup.notes.substring(0, 50) + (followup.notes.length > 50 ? '...' : '') : '-'}
                      </div>
                    </td>
                    <td data-label="Actions" className="followup-actions-td">  {/* ← actions class */}
                      <div className="followup-actions">
                        <button
                          className="followup-action-btn action-edit"
                          onClick={() => handleEdit(followup)}
                          title="Edit"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="followup-action-btn action-delete"
                          onClick={() => handleDelete(followup.id)}
                          title="Delete"
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
        </div>{/* end followups-table-scroll-wrapper */}

        {/* Pagination — unchanged */}
        <div className="followups-pagination">

          <div className="followups-pagination-info">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredFollowUps.length)} of {filteredFollowUps.length} entries
             <select className="followups-rows-select" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={10}>10 Rows</option>
              <option value={20}>20 Rows</option>
              <option value={50}>50 Rows</option>
              <option value={100}>100 Rows</option>
            </select>
          </div>
          <div className="followups-pagination-controls">
           
            <div className="followups-pagination-buttons">
              <button
                className="followups-pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="followups-pagination-current">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                className="followups-pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Follow-up Modal */}
      {showAddModal && (
        <div className="followup-modal-overlay">
          <div className="followup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="followup-modal-header">
              <h2>Add New Follow-up</h2>
              <button className="followup-modal-close" onClick={() => { setShowAddModal(false); resetAddForm(); }}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="followup-modal-form">
              <div className="followup-form-section">
                <h3>Select Lead</h3>
                <div className="followup-form-grid">
                  <div className="followup-form-group">
                    <label>Group *</label>
                    <select
                      name="modalGroupName"
                      value={addForm.modalGroupName}
                      onChange={handleAddFormChange}
                      required
                    >
                      <option value="">Select Group</option>
                      {groups.map((group, index) => (
                        <option key={group.value || group.label || index} value={group.value || group.label}>
                          {group.label || group.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Sub Group</label>
                    <select
                      name="modalSubGroupName"
                      value={addForm.modalSubGroupName}
                      onChange={handleAddFormChange}
                      disabled={!addForm.modalGroupName}
                    >
                      <option value="">Select Sub Group</option>
                      {subGroups.map((sub, index) => (
                        <option key={sub.value || sub.label || index} value={sub.value || sub.label}>
                          {sub.label || sub.value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="followup-form-group followup-form-full">
                    <label>Lead *</label>
                    <div style={{ position: 'relative' }}>
                      {/* Trigger button */}
                      <div
                        onClick={() => {
                          if (!addForm.modalGroupName) return;
                          setLeadDropdownOpen(o => !o);
                          setLeadSearch('');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 36px 10px 14px',
                          fontSize: '14px',
                          border: `1px solid ${leadDropdownOpen ? '#3b82f6' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          background: !addForm.modalGroupName ? '#f8fafc' : 'white',
                          cursor: !addForm.modalGroupName ? 'not-allowed' : 'pointer',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: '44px',
                          userSelect: 'none',
                          boxShadow: leadDropdownOpen ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{ color: addForm.leadId ? '#111827' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {addForm.leadId
                            ? (() => {
                                const sel = leads.find(l => String(l.id) === String(addForm.leadId));
                                return sel
                                  ? `${sel.leadCode} — ${sel.name}${sel.phone ? ' • ' + sel.phone : ''}`
                                  : 'Select a lead';
                              })()
                            : !addForm.modalGroupName
                              ? 'Select a group first'
                              : leads.length === 0
                                ? 'No leads found for this group'
                                : '— Select a Lead —'}
                        </span>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"
                          style={{ flexShrink: 0, color: '#6b7280', transform: leadDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', marginLeft: 8 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Dropdown panel */}
                      {leadDropdownOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                          background: 'white', border: '1.5px solid #3b82f6', borderRadius: '10px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.13)', zIndex: 9999, overflow: 'hidden'
                        }}>
                          {/* Search box */}
                          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                            <input
                              autoFocus
                              type="text"
                              value={leadSearch}
                              onChange={e => setLeadSearch(e.target.value)}
                              placeholder="Search by name, code, phone, email…"
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: '100%', padding: '8px 12px', fontSize: '13px',
                                border: '1px solid #e2e8f0', borderRadius: '6px',
                                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                              }}
                            />
                          </div>

                          {/* Options list */}
                          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                            {/* Clear option */}
                            <div
                              onClick={() => {
                                setAddForm(prev => ({ ...prev, leadId: '' }));
                                setLeadDropdownOpen(false);
                                setLeadSearch('');
                              }}
                              style={{ padding: '9px 14px', fontSize: '13px', color: '#9ca3af', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            >
                              — Select a Lead —
                            </div>

                            {leads
                              .filter(l => {
                                if (!leadSearch) return true;
                                const q = leadSearch.toLowerCase();
                                return (
                                  l.name?.toLowerCase().includes(q) ||
                                  l.leadCode?.toLowerCase().includes(q) ||
                                  l.phone?.includes(leadSearch) ||
                                  l.email?.toLowerCase().includes(q) ||
                                  l.status?.toLowerCase().includes(q)
                                );
                              })
                              .map(l => {
                                const isSelected = String(addForm.leadId) === String(l.id);
                                return (
                                  <div
                                    key={l.id}
                                    onClick={() => {
                                      setAddForm(prev => ({ ...prev, leadId: String(l.id) }));
                                      setLeadDropdownOpen(false);
                                      setLeadSearch('');
                                    }}
                                    style={{
                                      padding: '10px 14px', cursor: 'pointer',
                                      background: isSelected ? '#eff6ff' : 'white',
                                      borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                                      borderBottom: '1px solid #f8fafc',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6366f1', background: '#eef2ff', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                                        {l.leadCode}
                                      </span>
                                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {l.name}
                                      </span>
                                      {l.status && (
                                        <span style={{
                                          marginLeft: 'auto', flexShrink: 0, fontSize: '11px', fontWeight: 600,
                                          padding: '1px 7px', borderRadius: 20,
                                          background: l.status === 'Closed Won' ? '#dcfce7' : l.status === 'Closed Lost' ? '#fee2e2' : '#f1f5f9',
                                          color:      l.status === 'Closed Won' ? '#166534' : l.status === 'Closed Lost' ? '#991b1b' : '#475569',
                                        }}>
                                          {l.status}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: 3, display: 'flex', gap: 10 }}>
                                      {l.phone && <span>📞 {l.phone}</span>}
                                      {l.email && <span>✉️ {l.email}</span>}
                                    </div>
                                  </div>
                                );
                              })
                            }

                            {leads.filter(l => {
                              if (!leadSearch) return true;
                              const q = leadSearch.toLowerCase();
                              return l.name?.toLowerCase().includes(q) || l.leadCode?.toLowerCase().includes(q) || l.phone?.includes(leadSearch) || l.email?.toLowerCase().includes(q);
                            }).length === 0 && (
                              <div style={{ padding: '16px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                                No leads match "{leadSearch}"
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div style={{ padding: '6px 14px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{leads.length} lead{leads.length !== 1 ? 's' : ''} in this group</span>
                            {leadSearch && <span>{leads.filter(l => l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.leadCode?.toLowerCase().includes(leadSearch.toLowerCase())).length} match{leads.filter(l => l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.leadCode?.toLowerCase().includes(leadSearch.toLowerCase())).length !== 1 ? 'es' : ''}</span>}
                          </div>
                        </div>
                      )}

                      {/* Click-outside overlay */}
                      {leadDropdownOpen && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setLeadDropdownOpen(false); setLeadSearch(''); }} />
                      )}
                    </div>

                    {!addForm.modalGroupName && (
                      <small className="followup-help-text">Please select a group first</small>
                    )}
                    {addForm.modalGroupName && leads.length === 0 && (
                      <small className="followup-help-text">No leads found for selected group/subgroup</small>
                    )}
                  </div>
                </div>
              </div>

              <div className="followup-form-section">
                <h3>Follow-up Details</h3>
                <div className="followup-form-grid">
                  <div className="followup-form-group">
                    <label>Follow-up Type *</label>
                    <select name="followupType" value={addForm.followupType} onChange={handleAddFormChange} required>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Visit">Site Visit</option>
                      <option value="Demo">Demo</option>
                      <option value="Proposal">Send Proposal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Priority *</label>
                    <select name="priority" value={addForm.priority} onChange={handleAddFormChange} required>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Scheduled Date *</label>
                    <input
                      type="date"
                      name="scheduledDate"
                      value={addForm.scheduledDate}
                      onChange={handleAddFormChange}
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="followup-form-group">
                    <label>Scheduled Time</label>
                    <input
                      type="time"
                      name="scheduledTime"
                      value={addForm.scheduledTime}
                      onChange={handleAddFormChange}
                    />
                  </div>

                  <div className="followup-form-group">
                    <label>Assign To *</label>
                    <select name="assignedTo" value={addForm.assignedTo} onChange={handleAddFormChange} required>
                      {users.length === 0 && (
                        <option value={user.id}>{user.name || 'Me'} (Me)</option>
                      )}
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {Number(u.id) === Number(user.id) ? '(Me)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Status</label>
                    <select name="status" value={addForm.status} onChange={handleAddFormChange}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Rescheduled">Rescheduled</option>
                    </select>
                  </div>
                </div>

                <div className="followup-form-group">
                  <label>Notes / Description</label>
                  <textarea
                    name="notes"
                    value={addForm.notes}
                    onChange={handleAddFormChange}
                    rows={4}
                    placeholder="Add notes about this follow-up..."
                  />
                </div>
              </div>

              <div className="followup-modal-actions">
                <button
                  type="button"
                  className="followups-btn followups-btn-secondary"
                  onClick={() => { setShowAddModal(false); resetAddForm(); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="followups-btn followups-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Follow-up Modal */}
      {showEditModal && editingFollowup && (
        <div className="followup-modal-overlay">
          <div className="followup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="followup-modal-header">
              <h2>Edit Follow-up</h2>
              <button className="followup-modal-close" onClick={() => { setShowEditModal(false); resetEditForm(); setEditingFollowup(null); }}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="followup-modal-lead-info">
              <div className="followup-info-item">
                <span className="followup-info-label">Lead:</span>
                <span className="followup-info-value">{editingFollowup.leadCode}</span>
              </div>
              <div className="followup-info-item">
                <span className="followup-info-label">Group:</span>
                <span className="followup-info-value">{editingFollowup.groupName || 'N/A'}</span>
              </div>
              <div className="followup-info-item">
                <span className="followup-info-label">Sub Group:</span>
                <span className="followup-info-value">{editingFollowup.subGroupName || 'N/A'}</span>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="followup-modal-form">
              <div className="followup-form-section">
                <h3>Follow-up Details</h3>
                <div className="followup-form-grid">
                  <div className="followup-form-group">
                    <label>Follow-up Type *</label>
                    <select name="followupType" value={editForm.followupType} onChange={handleEditFormChange} required>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Visit">Site Visit</option>
                      <option value="Demo">Demo</option>
                      <option value="Proposal">Send Proposal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Priority *</label>
                    <select name="priority" value={editForm.priority} onChange={handleEditFormChange} required>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Scheduled Date *</label>
                    <input
                      type="date"
                      name="scheduledDate"
                      value={editForm.scheduledDate}
                      onChange={handleEditFormChange}
                      required
                    />
                  </div>

                  <div className="followup-form-group">
                    <label>Scheduled Time</label>
                    <input
                      type="time"
                      name="scheduledTime"
                      value={editForm.scheduledTime}
                      onChange={handleEditFormChange}
                    />
                  </div>

                  <div className="followup-form-group">
                    <label>Assign To *</label>
                    <select name="assignedTo" value={editForm.assignedTo} onChange={handleEditFormChange} required>
                      {users.length === 0 && (
                        <option value={user.id}>{user.name || 'Me'} (Me)</option>
                      )}
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {Number(u.id) === Number(user.id) ? '(Me)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="followup-form-group">
                    <label>Status *</label>
                    <select name="status" value={editForm.status} onChange={handleEditFormChange} required>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Rescheduled">Rescheduled</option>
                    </select>
                  </div>
                </div>

                <div className="followup-form-group">
                  <label>Notes / Description</label>
                  <textarea
                    name="notes"
                    value={editForm.notes}
                    onChange={handleEditFormChange}
                    rows={3}
                    placeholder="Add notes about this follow-up..."
                  />
                </div>

                <div className="followup-form-group">
                  <label>Outcome</label>
                  <textarea
                    name="outcome"
                    value={editForm.outcome}
                    onChange={handleEditFormChange}
                    rows={3}
                    placeholder="What was the result of this follow-up?"
                  />
                </div>
              </div>

              <div className="followup-modal-actions">
                <button
                  type="button"
                  className="followups-btn followups-btn-secondary"
                  onClick={() => { setShowEditModal(false); resetEditForm(); setEditingFollowup(null); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="followups-btn followups-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}