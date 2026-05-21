// ClientDashboardFollowUps.js
import React, { useState, useEffect, useRef } from "react";
import "../pages-css/Follow-ups.css";
import GroupCategoryFilter from './../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { FiTrash2, FiEdit } from 'react-icons/fi';
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";

const API_BASE_URL = process.env.REACT_APP_API_URL;

/* ── DatePicker — same calendar style as Task Management ─────────────────── */
const _FU_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _FU_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const FollowUpDatePicker = ({ value, onChange, minDate, placeholder = 'Select date', required }) => {
  const [show, setShow]   = useState(false);
  const [calMo, setCalMo] = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth());
  const [calYr, setCalYr] = useState(() => value ? parseInt(value.slice(0,4))   : new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const [pos,   setPos]   = useState({ top:0, left:0, width:260 });
  const trRef = useRef(null);
  const dpRef = useRef(null);

  useEffect(() => {
    const h = e => {
      if (trRef.current && !trRef.current.contains(e.target) &&
          dpRef.current && !dpRef.current.contains(e.target)) setShow(false);
    };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const openPicker = () => {
    if (value) { setCalMo(parseInt(value.slice(5,7))-1); setCalYr(parseInt(value.slice(0,4))); }
    if (trRef.current) {
      const r = trRef.current.getBoundingClientRect();
      const dH = 310;
      const openUp = window.innerHeight - r.bottom < dH && r.top > dH;
      setPos({ top: openUp ? r.top - dH - 4 : r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    }
    setShow(true);
  };

  const DIM   = new Date(calYr, calMo+1, 0).getDate();
  const FD    = new Date(calYr, calMo, 1).getDay();
  const today = new Date().toISOString().slice(0, 10);
  const fmtD  = d => { if (!d) return null; const [y,m,dy] = d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <>
      <button
        ref={trRef}
        type="button"
        className={`fu-datepicker-trigger${show ? ' fu-datepicker--open' : ''}${value ? ' fu-datepicker--set' : ''}`}
        onClick={show ? () => setShow(false) : openPicker}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink:0, color: value ? '#3b82f6' : '#94a3b8' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        {value
          ? <span style={{ flex:1, fontSize:14, fontWeight:500, color:'#0f172a' }}>{fmtD(value)}</span>
          : <span style={{ flex:1, fontSize:14, color:'#94a3b8' }}>{placeholder}</span>}
        {value
          ? <span className="fu-dp-x" onClick={e => { e.stopPropagation(); onChange({ target: { name: '', value: '' } }); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ marginLeft:'auto', color:'#94a3b8', transform: show?'rotate(180deg)':'none', transition:'transform .2s', flexShrink:0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
        }
      </button>

      {show && (
        <div ref={dpRef} className="fu-datepicker-dropdown"
          style={{ position:'fixed', top:pos.top, left:pos.left, width:pos.width, zIndex:9999 }}>
          <div className="fu-dp-head">
            <button type="button" className="fu-dp-nav"
              onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="fu-dp-month" onClick={() => setShowYr(p => !p)}>
              {_FU_MONTHS[calMo]} <span className="fu-dp-yr">{calYr}</span>
            </button>
            <button type="button" className="fu-dp-nav"
              onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
          {showYr ? (
            <div className="fu-yr-grid">
              {Array.from({length:18},(_,i)=>{
                const yr=new Date().getFullYear()-5+i;
                return <div key={yr} className={`fu-yr-cell${yr===calYr?' fu-yr-sel':''}`} onClick={()=>{setCalYr(yr);setShowYr(false);}}>{yr}</div>;
              })}
            </div>
          ) : (
          <div className="fu-dp-grid">
            {_FU_DAYS.map(d => <div key={d} className="fu-dp-dl">{d}</div>)}
            {Array.from({ length: FD }).map((_,i) => <div key={`e${i}`} className="fu-dp-cell fu-dp-empty"/>)}
            {Array.from({ length: DIM }).map((_,i) => {
              const dy  = i + 1;
              const ds  = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
              const dis = minDate && ds < minDate;
              let cls   = 'fu-dp-cell';
              if (dis)        cls += ' fu-dp-disabled';
              else if (ds === value) cls += ' fu-dp-sel';
              else if (ds === today) cls += ' fu-dp-today';
              return (
                <div key={ds} className={cls}
                  onClick={() => { if (dis) return; onChange({ target: { name: 'scheduledDate', value: ds } }); setShow(false); }}>
                  {dy}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </>
  );
};

export default function ClientDashboardFollowUps() {
  const { user } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const [followUps, setFollowUps] = useState([]);
  const [filteredFollowUps, setFilteredFollowUps] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingFollowup, setViewingFollowup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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

  // Date range calendar filter
  const [fromDate,    setFromDate]    = useState(null);
  const [toDate,      setToDate]      = useState(null);
  const [hoverDate,   setHoverDate]   = useState(null);
  const [appliedFrom, setAppliedFrom] = useState(null);
  const [appliedTo,   setAppliedTo]   = useState(null);
  const [calMonth,    setCalMonth]    = useState(new Date().getMonth());
  const [calYear,     setCalYear]     = useState(new Date().getFullYear());
  const [showYrCal,   setShowYrCal]   = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef(null);

  // Time picker state — Add modal
  const [showAddTimePicker, setShowAddTimePicker] = useState(false);
  const [tempAddTime, setTempAddTime] = useState('');
  const addTimeRef = useRef(null);
  const addTimeInputRef = useRef(null);

  // Time picker state — Edit modal
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [tempEditTime, setTempEditTime] = useState('');
  const editTimeRef = useRef(null);
  const editTimeInputRef = useRef(null);

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
    applyFilters();
  }, [followUps, statusFilter, priorityFilter, typeFilter, assignedToFilter, searchTerm, appliedFrom, appliedTo]);

  // Group/subgroup filtering is handled server-side (backend SQL).
  // applyFilters only handles the UI-level dropdowns (status, priority, type, assignedTo, source, search).

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

  // Re-fetch from backend whenever group/subgroup selection changes.
  // Backend applies the group filter in SQL — no client-side filtering needed.
  useEffect(() => {
    fetchFollowUps();
  }, [groupName, subGroupName]);

  // Close Add time picker when clicking outside
  useEffect(() => {
    const handler = e => {
      if (addTimeRef.current && !addTimeRef.current.contains(e.target)) {
        setShowAddTimePicker(false);
        setTempAddTime('');
      }
    };
    if (showAddTimePicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddTimePicker]);

  // Close Edit time picker when clicking outside
  useEffect(() => {
    const handler = e => {
      if (editTimeRef.current && !editTimeRef.current.contains(e.target)) {
        setShowEditTimePicker(false);
        setTempEditTime('');
      }
    };
    if (showEditTimePicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEditTimePicker]);

  // Close calendar dropdown when clicking outside
  useEffect(() => {
    const handler = e => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalendar]);

  const fetchFollowUps = async (grp = groupName, subGrp = subGroupName) => {
    setLoading(true);
    try {
      // Build query params — only include non-empty values so backend treats absent params as "no filter"
      const params = new URLSearchParams();
      if (grp)    params.append('groupName',    grp);
      if (subGrp) params.append('subGroupName', subGrp);

      const qs = params.toString() ? `?${params.toString()}` : '';

      // Always call /my-followups — backend decides what "mine" means per role:
      //   SUPERADMIN / ADMIN  → all matching records (no userId restriction)
      //   Everyone else       → only records where assigned_to = me OR created_by = me
      // groupName / subGroupName params are applied in SQL on the backend.
      const response = await fetch(`${API_BASE_URL}/followups/my-followups${qs}`, {
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

    // Group/subgroup filters are applied server-side on fetch.
    // Here we only handle the UI dropdown filters.

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
        (f.outcome && f.outcome.toLowerCase().includes(term)) ||
        (f.leadCode && f.leadCode.toLowerCase().includes(term)) ||
        (f.customerCode && f.customerCode.toLowerCase().includes(term)) ||
        (f.assignedToName && f.assignedToName.toLowerCase().includes(term)) ||
        (f.createdByName && f.createdByName.toLowerCase().includes(term)) ||
        (f.followupType && f.followupType.toLowerCase().includes(term)) ||
        (f.groupName && f.groupName.toLowerCase().includes(term))
      );
    }

    if (appliedFrom) {
      const from = new Date(appliedFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(appliedTo || appliedFrom);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(f => {
        const d = new Date(String(f.scheduledAt || '').replace(' ', 'T'));
        return !isNaN(d.getTime()) && d >= from && d <= to;
      });
      // Sort ascending by scheduledAt when date filter is active
      filtered.sort((a, b) => {
        const da = new Date(String(a.scheduledAt || '').replace(' ', 'T'));
        const db = new Date(String(b.scheduledAt || '').replace(' ', 'T'));
        return da - db;
      });
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

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const calDaysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDay     = new Date(calYear, calMonth, 1).getDay();
  const todayStr        = new Date().toISOString().split('T')[0];

  const calPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const calNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0);  setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const handleCalDayClick = (dateStr) => {
    if (!fromDate || (fromDate && toDate)) {
      setFromDate(dateStr);
      setToDate(null);
    } else {
      if (dateStr < fromDate) { setFromDate(dateStr); setToDate(null); }
      else if (dateStr === fromDate) { setFromDate(null); setToDate(null); }
      else setToDate(dateStr);
    }
  };

  const calIsFrom    = d => d === fromDate;
  const calIsTo      = d => d === toDate;
  const calInRange   = d => {
    const lo = fromDate, hi = toDate || (fromDate && hoverDate ? hoverDate : null);
    if (!lo || !hi) return false;
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    return d > a && d < b;
  };

  const handleCalApply = () => {
    if (!fromDate) return;
    setAppliedFrom(fromDate);
    setAppliedTo(toDate || fromDate);
    setShowCalendar(false);
  };

  const handleCalClear = () => {
    setFromDate(null);
    setToDate(null);
    setHoverDate(null);
    setAppliedFrom(null);
    setAppliedTo(null);
    setShowCalendar(false);
  };

  const fmtCalDate = d => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y}`;
  };
  // ────────────────────────────────────────────────────────────────────────────

  const fmtTimeDisplay = t => {
    if (!t) return 'Select time';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    return `${hour % 12 === 0 ? 12 : hour % 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
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

  const handleView = (followup) => {
    setViewingFollowup(followup);
    setShowViewModal(true);
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

  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirm;
    setDeleteConfirm(null);

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

        {/* Search */}
        <div className="followups-search-wrapper">
          <svg className="followups-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by lead, customer, notes, assigned to..."
            className="followups-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter bar row */}

          {/* Date range trigger + dropdown */}
          <div className="fu-cal-wrapper" ref={calendarRef}>
            <button
              type="button"
              className={`fu-cal-trigger ${showCalendar ? 'fu-cal-trigger--open' : ''} ${appliedFrom ? 'fu-cal-trigger--applied' : ''}`}
              onClick={() => setShowCalendar(p => !p)}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span className={appliedFrom ? 'fu-cal-val' : 'fu-cal-ph'}>
                {appliedFrom ? fmtCalDate(appliedFrom) : 'dd-mm-yyyy'}
              </span>
              <span className="fu-cal-sep">—</span>
              <span className={appliedTo && appliedTo !== appliedFrom ? 'fu-cal-val' : 'fu-cal-ph'}>
                {appliedTo && appliedTo !== appliedFrom ? fmtCalDate(appliedTo) : 'dd-mm-yyyy'}
              </span>
              {appliedFrom && (
                <span
                  className="fu-cal-x"
                  onClick={e => { e.stopPropagation(); handleCalClear(); }}
                  title="Clear date filter"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </span>
              )}
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                style={{ marginLeft: 'auto', color: '#94a3b8', flexShrink: 0, transform: showCalendar ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {/* Dropdown calendar */}
            {showCalendar && (
              <div className="fu-cal-dropdown">
                <div className="fu-cal-head">
                  <button className="fu-cal-nav-btn" onClick={calPrevMonth}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <button type="button" className="fu-cal-month-label fu-cal-month-btn" onClick={() => setShowYrCal(p => !p)}>
                    {CAL_MONTHS[calMonth]} <span className="fu-cal-yr-num">{calYear}</span>
                  </button>
                  <button className="fu-cal-nav-btn" onClick={calNextMonth}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>

                {showYrCal ? (
                  <div className="fu-inline-yr-grid">
                    {Array.from({length:18},(_,i)=>{
                      const yr = new Date().getFullYear()-5+i;
                      return (
                        <div key={yr}
                          className={`fu-inline-yr-cell${yr===calYear?' fu-inline-yr-sel':''}`}
                          onClick={()=>{setCalYear(yr);setShowYrCal(false);}}>
                          {yr}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div className="fu-cal-grid">
                  {CAL_DAYS.map(d => (
                    <div key={d} className="fu-cal-day-label">{d}</div>
                  ))}
                  {Array.from({ length: calFirstDay }).map((_, i) => (
                    <div key={`e${i}`} className="fu-cal-cell fu-cal-empty" />
                  ))}
                  {Array.from({ length: calDaysInMonth }).map((_, i) => {
                    const day     = i + 1;
                    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const dow     = (calFirstDay + i) % 7;
                    const isFrom  = calIsFrom(dateStr);
                    const isTo    = calIsTo(dateStr);
                    const inRange = calInRange(dateStr);
                    const isToday = dateStr === todayStr;

                    let cls = 'fu-cal-cell';
                    if (isFrom)        cls += ' fu-cal-from';
                    else if (isTo)     cls += ' fu-cal-to';
                    else if (inRange) {
                      cls += ' fu-cal-in-range';
                      if (dow === 0) cls += ' fu-cal-rr-start';
                      if (dow === 6) cls += ' fu-cal-rr-end';
                    }
                    if (isToday && !isFrom && !isTo) cls += ' fu-cal-today';

                    return (
                      <div
                        key={dateStr}
                        className={cls}
                        onClick={() => handleCalDayClick(dateStr)}
                        onMouseEnter={() => fromDate && !toDate && setHoverDate(dateStr)}
                        onMouseLeave={() => setHoverDate(null)}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
                )}

                <div className="fu-cal-footer">
                  <div className="fu-cal-range-chips">
                    <span className={`fu-cal-chip ${fromDate ? 'fu-cal-chip--set' : ''}`}>
                      {fromDate ? fmtCalDate(fromDate) : 'From —'}
                    </span>
                    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
                    <span className={`fu-cal-chip ${toDate ? 'fu-cal-chip--set' : ''}`}>
                      {toDate ? fmtCalDate(toDate) : 'To —'}
                    </span>
                  </div>
                  <div className="fu-cal-footer-actions">
                    {(fromDate || appliedFrom) && (
                      <button className="fu-cal-clear-btn" onClick={handleCalClear}>Clear</button>
                    )}
                    <button className="fu-cal-apply-btn" onClick={handleCalApply} disabled={!fromDate}>
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Existing filters */}
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
            onClick={() => { resetAddForm(); setShowAddModal(true); }}
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
                <th>S.No</th>
                <th>Source</th>
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
                  <td colSpan="9" className="followups-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>No follow-ups found</p>
                  </td>
                </tr>
              ) : (
                currentFollowUps.map((followup, index) => (
                  <tr key={followup.id}
                    className={isOverdue(followup) ? 'followup-overdue' : ''}
                    onClick={() => handleView(followup)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td data-label="S.No" style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 13 }}>{index + 1}</td>
                    <td data-label="Source">
                      <div className="followup-lead-info">
                        {followup.relatedType === 'CUSTOMER' ? (
                          <>
                            <span style={{ display:'inline-block', padding:'1px 7px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:4, fontSize:10, fontWeight:700, marginBottom:2 }}>🏢 Customer</span>
                            <strong style={{ display:'block', fontSize:13 }}>{followup.customerCode ? followup.customerCode.split(' — ')[0] : 'N/A'}</strong>
                            {followup.customerCode && followup.customerCode.includes(' — ') && (
                              <span className="followup-group-badge">{followup.customerCode.split(' — ')[1]}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ display:'inline-block', padding:'1px 7px', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:4, fontSize:10, fontWeight:700, marginBottom:2 }}>👤 Lead</span>
                            <strong style={{ display:'block', fontSize:13 }}>{followup.leadCode || 'N/A'}</strong>
                            {followup.groupName && <span className="followup-group-badge">{followup.groupName}</span>}
                          </>
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
                    <td data-label="Actions" className="followup-actions-td">
                      <div className="followup-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="followup-action-btn action-view"
                          onClick={e => { e.stopPropagation(); handleView(followup); }}
                          title="View Details"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        </button>
                        <button
                          className="followup-action-btn action-edit"
                          onClick={e => { e.stopPropagation(); handleEdit(followup); }}
                          title="Edit"
                        >
                          <FiEdit size={14} />
                        </button>
                        <button
                          className="followup-action-btn action-delete"
                          onClick={e => { e.stopPropagation(); handleDelete(followup.id); }}
                          title="Delete"
                        >
                          <FiTrash2 size={14} />
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
                    <FollowUpDatePicker
                      value={addForm.scheduledDate}
                      onChange={handleAddFormChange}
                      minDate={new Date().toISOString().split('T')[0]}
                      placeholder="Select date"
                      required
                    />
                  </div>

                  <div className="followup-form-group" ref={addTimeRef} style={{ position: 'relative' }}>
                    <label>Scheduled Time</label>
                    <button
                      type="button"
                      className="followup-time-trigger"
                      onClick={() => { setTempAddTime(addForm.scheduledTime || ''); setShowAddTimePicker(p => !p); }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                      </svg>
                      {fmtTimeDisplay(addForm.scheduledTime)}
                    </button>

                    {showAddTimePicker && (
                      <div className="followup-time-popover">
                        <span className="followup-time-popover-label" style={{cursor:"pointer"}} onClick={()=>{try{addTimeInputRef.current.showPicker();}catch(_){addTimeInputRef.current.focus();}}}>Pick a time</span>
                        <input
                          type="time"
                          ref={addTimeInputRef}
                          autoFocus
                          className="followup-time-input"
                          value={tempAddTime}
                          onChange={e => setTempAddTime(e.target.value)}
                          onClick={e => { try { e.target.showPicker(); } catch(_) {} }}
                        />
                        <div className="followup-time-popover-actions">
                          <button type="button" className="followup-time-btn-cancel"
                            onClick={() => { setShowAddTimePicker(false); setTempAddTime(''); }}>
                            Cancel
                          </button>
                          <button type="button" className="followup-time-btn-save"
                            onClick={() => {
                              setAddForm(prev => ({ ...prev, scheduledTime: tempAddTime }));
                              setShowAddTimePicker(false);
                              setTempAddTime('');
                            }}>
                            Save
                          </button>
                        </div>
                      </div>
                    )}
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
                <span className="followup-info-label">Source:</span>
                <span className="followup-info-value">
                  {editingFollowup.relatedType === 'CUSTOMER'
                    ? <span style={{ background:'#eff6ff', color:'#1d4ed8', borderRadius:4, padding:'1px 8px', fontSize:11, fontWeight:700 }}>🏢 Customer</span>
                    : <span style={{ background:'#f0fdf4', color:'#15803d', borderRadius:4, padding:'1px 8px', fontSize:11, fontWeight:700 }}>👤 Lead</span>
                  }
                </span>
              </div>
              <div className="followup-info-item">
                <span className="followup-info-label">{editingFollowup.relatedType === 'CUSTOMER' ? 'Customer:' : 'Lead:'}</span>
                <span className="followup-info-value">
                  {editingFollowup.relatedType === 'CUSTOMER'
                    ? (editingFollowup.customerCode || 'N/A')
                    : (editingFollowup.leadCode || 'N/A')
                  }
                </span>
              </div>
              <div className="followup-info-item">
                <span className="followup-info-label">Group:</span>
                <span className="followup-info-value">{editingFollowup.groupName || 'N/A'}</span>
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
                    <FollowUpDatePicker
                      value={editForm.scheduledDate}
                      onChange={handleEditFormChange}
                      minDate={new Date().toISOString().split('T')[0]}
                      placeholder="Select date"
                      required
                    />
                  </div>

                  <div className="followup-form-group" ref={editTimeRef} style={{ position: 'relative' }}>
                    <label>Scheduled Time</label>
                    <button
                      type="button"
                      className="followup-time-trigger"
                      onClick={() => { setTempEditTime(editForm.scheduledTime || ''); setShowEditTimePicker(p => !p); }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                      </svg>
                      {fmtTimeDisplay(editForm.scheduledTime)}
                    </button>

                    {showEditTimePicker && (
                      <div className="followup-time-popover">
                        <span className="followup-time-popover-label" style={{cursor:"pointer"}} onClick={()=>{try{editTimeInputRef.current.showPicker();}catch(_){editTimeInputRef.current.focus();}}}>Pick a time</span>
                        <input
                          type="time"
                          ref={editTimeInputRef}
                          autoFocus
                          className="followup-time-input"
                          value={tempEditTime}
                          onChange={e => setTempEditTime(e.target.value)}
                          onClick={e => { try { e.target.showPicker(); } catch(_) {} }}
                        />
                        <div className="followup-time-popover-actions">
                          <button type="button" className="followup-time-btn-cancel"
                            onClick={() => { setShowEditTimePicker(false); setTempEditTime(''); }}>
                            Cancel
                          </button>
                          <button type="button" className="followup-time-btn-save"
                            onClick={() => {
                              setEditForm(prev => ({ ...prev, scheduledTime: tempEditTime }));
                              setShowEditTimePicker(false);
                              setTempEditTime('');
                            }}>
                            Save
                          </button>
                        </div>
                      </div>
                    )}
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

      {/* ── View Follow-up Details Modal ── */}
      {showViewModal && viewingFollowup && (() => {
        const f = viewingFollowup;
        const isCustomer = f.relatedType === 'CUSTOMER';
        const TYPE_ICON  = { Call:'📞', Email:'✉️', Meeting:'🤝', Visit:'🏠', Demo:'💻', Proposal:'📄', Other:'📌' };
        const TYPE_COLOR = { Call:'#2563EB', Email:'#059669', Meeting:'#7C3AED', Visit:'#D97706', Demo:'#DC2626', Proposal:'#0891B2', Other:'#6B7280' };
        const TYPE_BG    = { Call:'#EFF6FF', Email:'#ECFDF5', Meeting:'#F5F3FF', Visit:'#FFFBEB', Demo:'#FFF1F2', Proposal:'#F0F9FF', Other:'#F9FAFB' };
        const TYPE_BORDER= { Call:'#BFDBFE', Email:'#A7F3D0', Meeting:'#DDD6FE', Visit:'#FDE68A', Demo:'#FECDD3', Proposal:'#BAE6FD', Other:'#E5E7EB' };
        const SM = { Pending:{bg:'#FEF9C3',color:'#92400E',dot:'#F59E0B'}, Completed:{bg:'#D1FAE5',color:'#065F46',dot:'#10B981'}, Cancelled:{bg:'#FEE2E2',color:'#991B1B',dot:'#EF4444'}, Rescheduled:{bg:'#E0E7FF',color:'#3730A3',dot:'#6366F1'} };
        const PM = { High:{bg:'#FEE2E2',color:'#991B1B'}, Medium:{bg:'#FEF3C7',color:'#92400E'}, Low:{bg:'#D1FAE5',color:'#065F46'} };
        const sm = SM[f.status] || SM.Pending;
        const pm = PM[f.priority] || PM.Medium;
        const tc = TYPE_COLOR[f.followupType] || '#6B7280';
        const tb = TYPE_BG[f.followupType]   || '#F9FAFB';
        const tbd= TYPE_BORDER[f.followupType]|| '#E5E7EB';
        const overdue = f.status === 'Pending' && f.scheduledAt && new Date(String(f.scheduledAt).replace(' ','T')) < new Date();
        const closeFn = () => { setShowViewModal(false); setViewingFollowup(null); };

        return (
          <div className="followup-modal-overlay" onClick={closeFn}>
            <div className="followup-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:580 }}>
              {/* Header */}
              <div style={{ background:tb, padding:'20px 24px', borderRadius:'16px 16px 0 0', borderBottom:`2px solid ${tc}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, border:`1.5px solid ${tbd}` }}>
                    {TYPE_ICON[f.followupType] || '📋'}
                  </div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:'#0f172a' }}>{f.followupType} Follow-up</h3>
                      <span style={{ background:sm.bg, color:sm.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:sm.dot, display:'inline-block' }}/>{f.status}
                      </span>
                      {overdue && <span style={{ background:'#FEE2E2', color:'#991B1B', borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>⚠ OVERDUE</span>}
                    </div>
                    <p style={{ margin:'3px 0 0', fontSize:12, color:'#64748b' }}>Follow-up #{f.id}</p>
                  </div>
                </div>
                <button className="followup-modal-close" onClick={closeFn}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
                {/* Source + Priority */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Source</div>
                    {isCustomer ? (
                      <>
                        <span style={{ display:'inline-block', padding:'1px 8px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:4, fontSize:10, fontWeight:700, marginBottom:4 }}>🏢 Customer</span>
                        <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{f.customerCode ? f.customerCode.split(' — ')[0] : 'N/A'}</div>
                        {f.customerCode && f.customerCode.includes(' — ') && <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{f.customerCode.split(' — ')[1]}</div>}
                      </>
                    ) : (
                      <>
                        <span style={{ display:'inline-block', padding:'1px 8px', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:4, fontSize:10, fontWeight:700, marginBottom:4 }}>👤 Lead</span>
                        <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{f.leadCode || 'N/A'}</div>
                        {f.groupName && <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{f.groupName}{f.subGroupName ? ` › ${f.subGroupName}` : ''}</div>}
                      </>
                    )}
                  </div>
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Priority</div>
                    <span style={{ background:pm.bg, color:pm.color, borderRadius:20, padding:'4px 14px', fontSize:13, fontWeight:700 }}>{f.priority}</span>
                  </div>
                </div>

                {/* Scheduled + People */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>📅 Scheduled</div>
                    <div style={{ fontWeight:700, fontSize:13, color: overdue ? '#DC2626' : '#0f172a' }}>{formatDateTime(f.scheduledAt) || '—'}</div>
                    {f.completedAt && <div style={{ fontSize:11, color:'#059669', marginTop:4 }}>✓ Completed: {formatDateTime(f.completedAt)}</div>}
                  </div>
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>👥 People</div>
                    <div style={{ fontSize:13, marginBottom:4 }}><span style={{ color:'#64748b' }}>Assigned: </span><strong>{f.assignedToName || 'Unassigned'}</strong></div>
                    <div style={{ fontSize:13 }}><span style={{ color:'#64748b' }}>Created by: </span><strong>{f.createdByName || '—'}</strong></div>
                    {f.createdAt && <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>On {formatDateTime(f.createdAt)}</div>}
                  </div>
                </div>

                {/* Notes */}
                {f.notes && (
                  <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#0369a1', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>📋 Pre-call Notes</div>
                    <p style={{ margin:0, fontSize:13, color:'#0f172a', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{f.notes}</p>
                  </div>
                )}

                {/* Outcome */}
                {f.outcome && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#15803d', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>📊 Outcome / Result</div>
                    <p style={{ margin:0, fontSize:13, color:'#0f172a', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{f.outcome}</p>
                  </div>
                )}

                {!f.notes && !f.outcome && (
                  <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, padding:'8px 0' }}>No notes or outcome recorded yet.</div>
                )}

                {/* Footer */}
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:6, borderTop:'1px solid #f1f5f9' }}>
                  <button className="followups-btn followups-btn-secondary" onClick={closeFn}>Close</button>
                  <button className="followups-btn followups-btn-primary" onClick={() => { closeFn(); handleEdit(f); }}>
                    <FiEdit size={13} style={{ marginRight:4 }}/> Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bootstrap-style Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:9999, padding:16,
        }}>
          <div style={{
            background:'#fff', borderRadius:16, padding:'36px 32px 28px',
            width:'min(420px,94vw)', textAlign:'center',
            boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
            animation:'fu-pop .18s ease',
          }}>
            <div style={{
              width:64, height:64, borderRadius:'50%',
              background:'#fff0f0', border:'1px solid #fecaca',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 20px',
            }}>
              <FiTrash2 size={28} color="#dc2626" />
            </div>
            <h3 style={{ margin:'0 0 10px', fontSize:20, fontWeight:700, color:'#0f172a' }}>
              Delete Follow-Up
            </h3>
            <p style={{ margin:'0 0 28px', fontSize:14, color:'#64748b', lineHeight:1.6 }}>
              Are you sure you want to delete this follow-up?<br />
              <strong style={{ color:'#dc2626' }}>This action cannot be undone.</strong>
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                flex:1, padding:'10px 20px', borderRadius:10,
                border:'1.5px solid #e2e8f0', background:'#fff',
                fontSize:14, fontWeight:600, color:'#374151', cursor:'pointer',
              }}>Cancel</button>
              <button onClick={confirmDelete} style={{
                flex:1, padding:'10px 20px', borderRadius:10,
                border:'none', background:'#dc2626',
                fontSize:14, fontWeight:600, color:'#fff', cursor:'pointer',
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── pop-in animation for modal ── */
const fuStyle = document.createElement('style');
fuStyle.textContent = '@keyframes fu-pop { from { transform:scale(.88); opacity:0 } to { transform:scale(1); opacity:1 } }';
if (!document.head.querySelector('[data-fu-anim]')) {
  fuStyle.setAttribute('data-fu-anim','1');
  document.head.appendChild(fuStyle);
}