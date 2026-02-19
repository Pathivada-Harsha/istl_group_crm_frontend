import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Download, Plus, X, Edit2, Eye, Trash2,
  Calendar, IndianRupee, CreditCard, FileText,
  CheckCircle, Clock, XCircle, Briefcase,
  MapPin, Utensils, Plane, Hotel, Users,
  ArrowUpDown, ArrowUp, ArrowDown, GripVertical,
  History, Filter, Receipt, Wallet, DollarSign, RefreshCw
} from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import filterApi from '../services/filterApi';
import '../pages-css/ProjectCostExpenseManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Travel', 'Site Visit', 'Accommodation', 'Food', 'Commission', 'Miscellaneous'];
const PAYMENT_MODES      = ['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque'];
const COMMISSION_TYPES   = ['Sales', 'Referral', 'Partner'];
const STATUS_OPTIONS     = ['Pending', 'Approved', 'Rejected'];
const ADVANCE_STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected', 'Settled'];
const VISIT_TYPES        = ['Site Visit', 'Client Meeting', 'Installation', 'Inspection', 'Training', 'Maintenance'];

const DEFAULT_COLUMNS = [
  { key: 'expenseCode', label: 'Code',         sortable: true,  visible: true  },
  { key: 'tripDate',    label: 'Date',          sortable: true,  visible: true  },
  { key: 'groupInfo',   label: 'Group/Project', sortable: false, visible: true  },
  { key: 'category',    label: 'Category',      sortable: true,  visible: true  },
  { key: 'amount',      label: 'Amount',        sortable: true,  visible: true  },
  { key: 'paidByName',  label: 'Paid By',       sortable: true,  visible: true  },
  { key: 'approvedByName', label: 'Approved By',sortable: false, visible: true  },
  { key: 'paymentMode', label: 'Mode',          sortable: true,  visible: true  },
  { key: 'status',      label: 'Status',        sortable: true,  visible: true  },
  { key: 'actions',     label: 'Actions',       sortable: false, visible: true  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = v  => v == null ? '₹0' : `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = d  => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

const CategoryIcon = ({ cat }) => ({
  'Travel':        <Plane    size={14} />,
  'Site Visit':    <MapPin   size={14} />,
  'Accommodation': <Hotel    size={14} />,
  'Food':          <Utensils size={14} />,
  'Commission':    <Users    size={14} />,
  'Miscellaneous': <Briefcase size={14} />,
}[cat] || <FileText size={14} />);

const StatusBadge = ({ s }) => (
  <span className={`exp-badge badge-${(s || 'pending').toLowerCase()}`}>{s || '—'}</span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectCostExpenseManagement = () => {

  // ── Group/Project filter (from hook — same as VendorManagement) ─────────────
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // ── Data state ───────────────────────────────────────────────────────────────
  const [expenses,   setExpenses]   = useState([]);
  const [advances,   setAdvances]   = useState([]);
  const [stats,      setStats]      = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('expenses');

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [currentPage,    setCurrentPage]    = useState(0);
  const [totalPages,     setTotalPages]     = useState(0);
  const [totalElements,  setTotalElements]  = useState(0);
  const pageSize = 10;

  // ── Table filters ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    search: '', category: 'all', status: 'all', paymentMode: 'all', dateFrom: '', dateTo: '',
  });
  const [sortBy,  setSortBy]  = useState('tripDate');
  const [sortDir, setSortDir] = useState('desc');

  // ── Columns drag-and-drop ────────────────────────────────────────────────────
  const [columns,      setColumns]      = useState(DEFAULT_COLUMNS);
  const [showColPanel, setShowColPanel] = useState(false);
  const dragCol  = useRef(null);
  const dragOver = useRef(null);

  // ── Modals ────────────────────────────────────────────────────────────────────
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedExpense,  setSelectedExpense]  = useState(null);
  const [expenseFormData,  setExpenseFormData]  = useState(null);
  const [advanceFormData,  setAdvanceFormData]  = useState(null);

  // ── Modal dropdown state (exact same pattern as VendorManagement) ─────────────
  const [modalGroups,    setModalGroups]    = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects,  setModalProjects]  = useState([]);
  const [modalGroupName,    setModalGroupName]    = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId,    setModalProjectId]    = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({
    groups: false, subGroups: false, projects: false,
  });

  // ── Advance modal dropdown state ─────────────────────────────────────────────
  const [advModalGroups,    setAdvModalGroups]    = useState([]);
  const [advModalSubGroups, setAdvModalSubGroups] = useState([]);
  const [advModalProjects,  setAdvModalProjects]  = useState([]);
  const [advModalGroupName,    setAdvModalGroupName]    = useState('');
  const [advModalSubGroupName, setAdvModalSubGroupName] = useState('');
  const [advModalProjectId,    setAdvModalProjectId]    = useState('');
  const [advModalDropdownLoading, setAdvModalDropdownLoading] = useState({
    groups: false, subGroups: false, projects: false,
  });

  const [availableUsers, setAvailableUsers] = useState([]);

  // ============================================================================
  // Auth Headers (same pattern as VendorManagement)
  // ============================================================================
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id':     user?.id   || localStorage.getItem('userId'),
    'X-User-Name':   user?.name || localStorage.getItem('userName') || 'User',
    'X-User-Role':   user?.role || localStorage.getItem('userRole'),
    'Content-Type':  'application/json',
  });

  // ============================================================================
  // Modal dropdown handlers — EXPENSE (same pattern as VendorManagement)
  // ============================================================================
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups);
    } catch (error) {
      showError('Failed to load groups');
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, groups: false }));
    }
  };

  const fetchModalSubGroups = async (grp) => {
    if (!grp) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(grp);
      setModalSubGroups(subGroups);
    } catch (error) {
      showError('Failed to load sub-groups');
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, subGroups: false }));
    }
  };

  const fetchModalProjects = async (grp, sub) => {
    if (!grp || !sub) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(grp, sub);
      setModalProjects(projects);
    } catch (error) {
      showError('Failed to load projects');
    } finally {
      setModalDropdownLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('');
    setModalProjectId('');
    setModalSubGroups([]);
    setModalProjects([]);
    setExpenseFormData(prev => ({ ...prev, groupName: newGroupName, subGroupName: '', projectId: '' }));
    if (newGroupName) fetchModalSubGroups(newGroupName);
  };

  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName);
    setModalProjectId('');
    setModalProjects([]);
    setExpenseFormData(prev => ({ ...prev, subGroupName: newSubGroupName, projectId: '' }));
    if (modalGroupName && newSubGroupName) fetchModalProjects(modalGroupName, newSubGroupName);
  };

  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setExpenseFormData(prev => ({ ...prev, projectId: newProjectId }));
  };

  // ============================================================================
  // Modal dropdown handlers — ADVANCE (same pattern, separate state)
  // ============================================================================
  const fetchAdvModalGroups = async () => {
    setAdvModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setAdvModalGroups(groups);
    } catch { showError('Failed to load groups'); }
    finally { setAdvModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchAdvModalSubGroups = async (grp) => {
    if (!grp) { setAdvModalSubGroups([]); setAdvModalProjects([]); return; }
    setAdvModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(grp);
      setAdvModalSubGroups(subGroups);
    } catch { showError('Failed to load sub-groups'); }
    finally { setAdvModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchAdvModalProjects = async (grp, sub) => {
    if (!grp || !sub) { setAdvModalProjects([]); return; }
    setAdvModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(grp, sub);
      setAdvModalProjects(projects);
    } catch { showError('Failed to load projects'); }
    finally { setAdvModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const handleAdvModalGroupChange = (e) => {
    const v = e.target.value;
    setAdvModalGroupName(v); setAdvModalSubGroupName(''); setAdvModalProjectId('');
    setAdvModalSubGroups([]); setAdvModalProjects([]);
    setAdvanceFormData(prev => ({ ...prev, groupName: v, subGroupName: '', projectId: '' }));
    if (v) fetchAdvModalSubGroups(v);
  };

  const handleAdvModalSubGroupChange = (e) => {
    const v = e.target.value;
    setAdvModalSubGroupName(v); setAdvModalProjectId(''); setAdvModalProjects([]);
    setAdvanceFormData(prev => ({ ...prev, subGroupName: v, projectId: '' }));
    if (advModalGroupName && v) fetchAdvModalProjects(advModalGroupName, v);
  };

  const handleAdvModalProjectChange = (e) => {
    const v = e.target.value;
    setAdvModalProjectId(v);
    setAdvanceFormData(prev => ({ ...prev, projectId: v }));
  };

  // ============================================================================
  // Fetch available users
  // ============================================================================
  useEffect(() => {
    filterApi.getLeadsUsers().then(setAvailableUsers).catch(() => {});
  }, []);

  // ============================================================================
  // Data fetchers (same pattern as VendorManagement)
  // ============================================================================
  useEffect(() => {
    fetchExpenses();
    fetchStats();
    fetchAdvances();
    fetchHistory();
  }, [groupName, subGroupName, projectId, currentPage, filters.search, filters.status,
      filters.category, filters.paymentMode, filters.dateFrom, filters.dateTo, sortBy, sortDir]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy, sortDir });
      if (groupName)              params.append('groupName',    groupName);
      if (subGroupName)           params.append('subGroupName', subGroupName);
      if (projectId)              params.append('projectId',    projectId);
      if (filters.search)         params.append('search',       filters.search);
      if (filters.status    !== 'all') params.append('status',      filters.status);
      if (filters.category  !== 'all') params.append('category',    filters.category);
      if (filters.paymentMode !== 'all') params.append('paymentMode', filters.paymentMode);
      if (filters.dateFrom)       params.append('dateFrom',     filters.dateFrom);
      if (filters.dateTo)         params.append('dateTo',       filters.dateTo);

      const response = await fetch(`${API_BASE_URL}/api/project-expenses?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch expenses');
      const data = await response.json();
      setExpenses(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (error) {
      showError('Failed to load expenses');
      setExpenses([]);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId)    params.append('projectId',    projectId);
      if (groupName)    params.append('groupName',    groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);

      const response = await fetch(`${API_BASE_URL}/api/project-expenses/stats?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (response.ok) setStats(await response.json());
    } catch { /* silent */ }
  };

  const fetchAdvances = async () => {
    try {
      const params = new URLSearchParams({ page: 0, size: 50 });
      if (groupName)    params.append('groupName',    groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId)    params.append('projectId',    projectId);

      const response = await fetch(`${API_BASE_URL}/api/project-expenses/advances?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (response.ok) { const d = await response.json(); setAdvances(d.content || []); }
    } catch { /* silent */ }
  };

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams({ page: 0, size: 50 });
      if (projectId)    params.append('projectId',    projectId);
      if (groupName)    params.append('groupName',    groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);

      const response = await fetch(`${API_BASE_URL}/api/project-expenses/history?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (response.ok) { const d = await response.json(); setHistory(d.content || []); }
    } catch { /* silent */ }
  };

  // ============================================================================
  // Open Add Expense Modal (same as handleAddNewVendor)
  // ============================================================================
  const handleAddNewExpense = () => {
    setExpenseFormData({
      groupName: groupName || '', subGroupName: subGroupName || '', projectId: projectId || '',
      tripDate: new Date().toISOString().split('T')[0],
      visitType: 'Site Visit', tripReason: '', tripOutcome: '',
      paidByUserId: '', paidByName: '', approvedByUserId: '', approvedByName: '',
      status: 'Pending',
      commissionType: '', commissionGivenTo: '',
      commissionPercentage: '', commissionFixedAmount: '', salesOrderRef: '',
      expenseItems: [{ id: Date.now(), category: 'Travel', amount: '', paymentMode: 'UPI', description: '' }],
    });

    // Pre-fill modal dropdowns from current page filter
    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalProjectId(projectId || '');
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);

    fetchModalGroups();
    if (groupName) {
      fetchModalSubGroups(groupName);
      if (subGroupName) fetchModalProjects(groupName, subGroupName);
    }

    setShowCreateModal(true);
  };

  // ============================================================================
  // Create Expense (same as handleCreateVendor)
  // ============================================================================
  const handleCreateExpense = async () => {
    if (!expenseFormData.groupName || !expenseFormData.subGroupName) {
      showError('Group and Sub-Group are required'); return;
    }
    if (!expenseFormData.projectId) {
      showError('Project is required'); return;
    }
    if (!expenseFormData.tripDate || !expenseFormData.tripReason?.trim()) {
      showError('Trip Date and Trip Reason are required'); return;
    }
    if (!expenseFormData.expenseItems?.length ||
        expenseFormData.expenseItems.some(i => !i.amount || parseFloat(i.amount) <= 0)) {
      showError('Add at least one expense item with a valid amount'); return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/project-expenses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          groupName:    expenseFormData.groupName,
          subGroupName: expenseFormData.subGroupName,
          projectId:    expenseFormData.projectId,
          tripDate:     expenseFormData.tripDate,
          visitType:    expenseFormData.visitType,
          tripReason:   expenseFormData.tripReason,
          tripOutcome:  expenseFormData.tripOutcome,
          paidByUserId: expenseFormData.paidByUserId || null,
          paidByName:   expenseFormData.paidByName || '',
          approvedByUserId: expenseFormData.approvedByUserId || null,
          approvedByName:   expenseFormData.approvedByName || '',
          status:       expenseFormData.status,
          commissionType:        expenseFormData.commissionType || null,
          commissionGivenTo:     expenseFormData.commissionGivenTo || null,
          commissionPercentage:  expenseFormData.commissionPercentage  ? parseFloat(expenseFormData.commissionPercentage)  : null,
          commissionFixedAmount: expenseFormData.commissionFixedAmount ? parseFloat(expenseFormData.commissionFixedAmount) : null,
          salesOrderRef: expenseFormData.salesOrderRef || null,
          expenseItems: expenseFormData.expenseItems.map(i => ({
            category: i.category, amount: parseFloat(i.amount),
            paymentMode: i.paymentMode, description: i.description,
          })),
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      showSuccess(`${expenseFormData.expenseItems.length} expense(s) created successfully!`);
      setShowCreateModal(false);
      fetchExpenses(); fetchStats();
    } catch (error) {
      showError(error.message || 'Failed to create expense');
    } finally { setLoading(false); }
  };

  // ============================================================================
  // View Expense Detail (same as handleViewVendor)
  // ============================================================================
  const handleViewExpense = async (expense) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/project-expenses/${expense.id}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch expense details');
      setSelectedExpense(await response.json());
      setShowDetailDrawer(true);
    } catch (error) {
      showError('Failed to load expense details');
    } finally { setLoading(false); }
  };

  // ============================================================================
  // Open Edit Modal (same as handleEditVendor)
  // ============================================================================
  const handleEditExpense = (expense) => {
    setExpenseFormData({
      id:           expense.id,
      groupName:    expense.groupName    || '',
      subGroupName: expense.subGroupName || '',
      projectId:    expense.projectId    || '',
      tripDate:     expense.tripDate     || '',
      visitType:    expense.visitType    || 'Site Visit',
      tripReason:   expense.tripReason   || '',
      tripOutcome:  expense.tripOutcome  || '',
      paidByUserId: expense.paidByUserId || '',
      paidByName:   expense.paidByName   || '',
      approvedByUserId: expense.approvedByUserId || '',
      approvedByName:   expense.approvedByName   || '',
      status:       expense.status       || 'Pending',
      category:     expense.category     || '',
      amount:       expense.amount       || '',
      paymentMode:  expense.paymentMode  || '',
      description:  expense.description  || '',
      commissionType:        expense.commissionType        || '',
      commissionGivenTo:     expense.commissionGivenTo     || '',
      commissionPercentage:  expense.commissionPercentage  || '',
      commissionFixedAmount: expense.commissionFixedAmount || '',
      salesOrderRef:         expense.salesOrderRef         || '',
    });

    setModalGroupName(expense.groupName    || '');
    setModalSubGroupName(expense.subGroupName || '');
    setModalProjectId(expense.projectId    || '');

    fetchModalGroups();
    if (expense.groupName) {
      fetchModalSubGroups(expense.groupName);
      if (expense.subGroupName) fetchModalProjects(expense.groupName, expense.subGroupName);
    }

    setShowEditModal(true);
  };

  // ============================================================================
  // Update Expense (same as handleUpdateVendor)
  // ============================================================================
  const handleUpdateExpense = async () => {
    if (!expenseFormData.groupName || !expenseFormData.subGroupName) {
      showError('Group and Sub-Group are required'); return;
    }
    if (!expenseFormData.amount || parseFloat(expenseFormData.amount) <= 0) {
      showError('Valid amount is required'); return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/project-expenses/${expenseFormData.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          groupName:    expenseFormData.groupName,
          subGroupName: expenseFormData.subGroupName,
          projectId:    expenseFormData.projectId,
          category:     expenseFormData.category,
          amount:       parseFloat(expenseFormData.amount),
          paymentMode:  expenseFormData.paymentMode,
          description:  expenseFormData.description,
          status:       expenseFormData.status,
          tripReason:   expenseFormData.tripReason,
          tripOutcome:  expenseFormData.tripOutcome,
        }),
      });
      if (!response.ok) throw new Error('Failed to update expense');
      showSuccess('Expense updated successfully!');
      setShowEditModal(false);
      fetchExpenses(); fetchStats();
      if (showDetailDrawer && selectedExpense?.id === expenseFormData.id) {
        handleViewExpense({ id: expenseFormData.id });
      }
    } catch (error) {
      showError('Failed to update expense');
    } finally { setLoading(false); }
  };

  // ============================================================================
  // Status change
  // ============================================================================
  const handleStatusChange = async (id, newStatus) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/project-expenses/${id}/status`, {
        method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      showSuccess(`Expense ${newStatus}`);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message); }
    finally { setLoading(false); }
  };

  // ============================================================================
  // Delete Expense (same as handleDeleteVendor)
  // ============================================================================
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/project-expenses/${expenseId}`, {
        method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete expense');
      showSuccess('Expense deleted successfully');
      setShowDetailDrawer(false);
      fetchExpenses(); fetchStats();
    } catch (error) { showError('Failed to delete expense'); }
    finally { setLoading(false); }
  };

  // ============================================================================
  // Open Advance Modal
  // ============================================================================
  const handleAddNewAdvance = (relatedExpense = null) => {
    const grp = relatedExpense?.groupName    || groupName    || '';
    const sub = relatedExpense?.subGroupName || subGroupName || '';
    const pid = relatedExpense?.projectId    || projectId    || '';

    setAdvanceFormData({
      groupName: grp, subGroupName: sub, projectId: pid,
      advanceDate: new Date().toISOString().split('T')[0],
      expectedTripDate: relatedExpense?.tripDate || '',
      tripPurpose: relatedExpense
        ? `Advance for ${relatedExpense.category} – ${relatedExpense.tripReason || ''}`.trim()
        : '',
      requestedByUserId: '', requestedByName: '',
      approvedByUserId:  '', approvedByName:  '',
      status: 'Pending',
      relatedExpenseId: relatedExpense?.id || null,
      advancePayments: [{ id: Date.now(), advanceNumber: 1, amount: '', paymentMode: 'Bank Transfer',
        paymentDate: new Date().toISOString().split('T')[0], notes: '' }],
    });

    setAdvModalGroupName(grp); setAdvModalSubGroupName(sub); setAdvModalProjectId(pid);
    setAdvModalGroups([]); setAdvModalSubGroups([]); setAdvModalProjects([]);

    fetchAdvModalGroups();
    if (grp) {
      fetchAdvModalSubGroups(grp);
      if (sub) fetchAdvModalProjects(grp, sub);
    }

    setShowAdvanceModal(true);
  };

  // ============================================================================
  // Create Advance
  // ============================================================================
  const handleCreateAdvance = async () => {
    if (!advanceFormData.groupName || !advanceFormData.subGroupName) {
      showError('Group and Sub-Group are required'); return;
    }
    if (!advanceFormData.projectId) {
      showError('Project is required'); return;
    }
    if (!advanceFormData.tripPurpose?.trim()) {
      showError('Trip Purpose is required'); return;
    }
    if (advanceFormData.advancePayments.some(p => !p.amount || parseFloat(p.amount) <= 0)) {
      showError('Enter valid amounts for all advance payments'); return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/project-expenses/advances`, {
        method: 'POST', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify({
          ...advanceFormData,
          advancePayments: advanceFormData.advancePayments.map(p => ({
            ...p, amount: parseFloat(p.amount),
          })),
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      showSuccess('Advance recorded successfully!');
      setShowAdvanceModal(false);
      fetchAdvances(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to record advance'); }
    finally { setLoading(false); }
  };

  // ============================================================================
  // Column drag-and-drop
  // ============================================================================
  const onDragStart = (e, i) => { dragCol.current = i; e.dataTransfer.effectAllowed = 'move'; };
  const onDragEnter = (i)    => { dragOver.current = i; };
  const onDragEnd   = ()     => {
    const [from, to] = [dragCol.current, dragOver.current];
    if (from === null || to === null || from === to) return;
    setColumns(prev => { const a = [...prev]; a.splice(to, 0, ...a.splice(from, 1)); return a; });
    dragCol.current = null; dragOver.current = null;
  };

  // ============================================================================
  // Sorting
  // ============================================================================
  const handleSort = (key) => {
    if (!columns.find(c => c.key === key)?.sortable) return;
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (!columns.find(c => c.key === col)?.sortable) return null;
    if (sortBy !== col) return <ArrowUpDown size={12} className="sort-neutral" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="sort-active" />
      : <ArrowDown size={12} className="sort-active" />;
  };

  // ============================================================================
  // Cell renderer
  // ============================================================================
  const renderCell = (col, exp) => {
    switch (col.key) {
      case 'expenseCode': return <span className="exp-code">{exp.expenseCode}</span>;
      case 'tripDate':    return fmtDate(exp.tripDate);
      case 'groupInfo':   return (
        <div className="exp-group-cell">
          {exp.groupName    && <span className="grp-name">{exp.groupName}</span>}
          {exp.subGroupName && <span className="sub-name">{exp.subGroupName}</span>}
          {exp.projectId    && <span className="prj-name">{exp.projectId}</span>}
        </div>
      );
      case 'category':    return (
        <div className="exp-cat-cell">
          <CategoryIcon cat={exp.category} /><span>{exp.category}</span>
        </div>
      );
      case 'amount':      return <strong className="exp-amount">{fmt(exp.amount)}</strong>;
      case 'paidByName':  return exp.paidByName || '—';
      case 'approvedByName': return exp.approvedByName || <span className="text-muted">Pending</span>;
      case 'paymentMode': return (
        <div className="exp-mode-cell"><CreditCard size={13} /><span>{exp.paymentMode}</span></div>
      );
      case 'status':      return <StatusBadge s={exp.status} />;
      case 'actions':     return (
        <div className="exp-actions-cell">
          <button className="exp-act-btn view-btn" title="View"    onClick={() => handleViewExpense(exp)}><Eye size={14} /></button>
          <button className="exp-act-btn edit-btn" title="Edit"    onClick={() => handleEditExpense(exp)}><Edit2 size={14} /></button>
          {exp.status === 'Pending' && <>
            <button className="exp-act-btn ok-btn"  title="Approve" onClick={() => handleStatusChange(exp.id, 'Approved')}><CheckCircle size={14} /></button>
            <button className="exp-act-btn rej-btn" title="Reject"  onClick={() => handleStatusChange(exp.id, 'Rejected')}><XCircle size={14} /></button>
          </>}
          <button className="exp-act-btn adv-btn" title="Advance" onClick={() => handleAddNewAdvance(exp)}><DollarSign size={14} /></button>
          <button className="exp-act-btn del-btn" title="Delete"  onClick={() => handleDeleteExpense(exp.id)}><Trash2 size={14} /></button>
        </div>
      );
      default: return exp[col.key] || '—';
    }
  };

  // ============================================================================
  // KPI cards
  // ============================================================================
  const kpiData = stats ? [
    { title: 'Total Expenses',      value: fmt(stats.totalExpenses),      icon: <IndianRupee size={32} />, color: '#ef4444' },
    { title: 'Approved',            value: fmt(stats.approvedExpenses),   icon: <CheckCircle size={32} />, color: '#22c55e' },
    { title: 'Pending Approval',    value: fmt(stats.pendingExpenses),    icon: <Clock size={32} />,       color: '#f59e0b' },
    { title: 'Travel & Site Visit', value: fmt(stats.travelAndSiteVisit), icon: <Plane size={32} />,       color: '#3b82f6' },
    { title: 'Total Commission',    value: fmt(stats.totalCommission),    icon: <Users size={32} />,       color: '#8b5cf6' },
    { title: 'Total Advances',      value: fmt(stats.totalAdvances),      icon: <Wallet size={32} />,      color: '#06b6d4' },
  ] : [];

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="exp-mgmt-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="exp-mgmt-header">
        <div className="exp-mgmt-breadcrumb">
          Dashboard &gt; Finance &gt; Project Cost &amp; Expense Management
        </div>

        <div className="page-header-with-filter">
          <h1 className="exp-mgmt-title">
            Project Cost &amp; Expense Management{' '}
            <span className="exp-mgmt-count">({totalElements})</span>
          </h1>
          {/* GroupProjectFilter — mandatory, same position as VendorManagement */}
          <GroupProjectFilter
            groupValue={groupName}
            subGroupValue={subGroupName}
            projectValue={projectId}
            onChange={updateFilters}
          />
        </div>
      </div>

      {/* ── Action Bar ──────────────────────────────────────────────────────── */}
      <div className="exp-mgmt-action-bar">
        <div className="exp-mgmt-search-filters">
          <input
            type="text"
            placeholder="Search by code, description, paid by..."
            className="exp-mgmt-search"
            value={filters.search}
            onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(0); }}
          />

          <select className="exp-mgmt-filter" value={filters.category}
            onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>

          <select className="exp-mgmt-filter" value={filters.status}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>

          <select className="exp-mgmt-filter" value={filters.paymentMode}
            onChange={(e) => { setFilters({ ...filters, paymentMode: e.target.value }); setCurrentPage(0); }}>
            <option value="all">All Modes</option>
            {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
          </select>

          <input type="date" className="exp-mgmt-filter" value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          <input type="date" className="exp-mgmt-filter" value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        </div>

        <div className="exp-mgmt-actions">
          <button className="exp-mgmt-btn-primary" onClick={handleAddNewExpense}>
            <Plus size={18} /> Add Expense
          </button>
          <button className="exp-mgmt-btn-success" onClick={() => handleAddNewAdvance()}>
            <DollarSign size={18} /> Record Advance
          </button>
          <button className="exp-mgmt-btn-secondary">
            <Download size={18} /> Export
          </button>
          <button className="exp-mgmt-btn-icon" title="Refresh"
            onClick={() => { fetchExpenses(); fetchStats(); fetchAdvances(); fetchHistory(); }}>
            <RefreshCw size={16} />
          </button>
          <button className="exp-mgmt-btn-columns" onClick={() => setShowColPanel(v => !v)}>
            <GripVertical size={14} /> Columns
          </button>
        </div>
      </div>

      {/* ── Column visibility panel ──────────────────────────────────────────── */}
      {showColPanel && (
        <div className="exp-col-panel">
          <div className="exp-col-panel-title">Drag to reorder · toggle visibility</div>
          <div className="exp-col-list">
            {columns.filter(c => c.key !== 'actions').map((col, idx) => (
              <div key={col.key} className="exp-col-item" draggable
                onDragStart={e => onDragStart(e, idx)} onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}>
                <GripVertical size={13} className="grip-icon" />
                <input type="checkbox" checked={col.visible}
                  onChange={() => setColumns(prev => prev.map((c, i) =>
                    i === idx ? { ...c, visible: !c.visible } : c))} />
                <span>{col.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      {stats && (
        <div className="exp-mgmt-kpi-grid">
          {kpiData.map((kpi, index) => (
            <div key={index} className="exp-mgmt-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="exp-mgmt-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
              <div className="exp-mgmt-kpi-content">
                <div className="exp-mgmt-kpi-value">{kpi.value}</div>
                <div className="exp-mgmt-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Employee Breakdown ───────────────────────────────────────────────── */}
      {stats?.userBreakdown?.length > 0 && (
        <div className="exp-user-breakdown">
          <h3 className="exp-section-title"><Users size={15} /> Employee Cost Breakdown</h3>
          <div className="exp-user-grid">
            {stats.userBreakdown.map((u, i) => (
              <div key={i} className="exp-user-card">
                <div className="exp-user-avatar">{(u.userName || 'U')[0].toUpperCase()}</div>
                <div className="exp-user-info">
                  <div className="exp-user-name">{u.userName}</div>
                  <div className="exp-user-meta">{u.expenseCount} expenses</div>
                </div>
                <div className="exp-user-amounts">
                  <div className="exp-user-total">{fmt(u.totalAmount)}</div>
                  <div className="exp-user-sub">
                    <span className="green">{fmt(u.approvedAmount)}</span>
                    {u.pendingAmount > 0 && <span className="amber">{fmt(u.pendingAmount)} pending</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="exp-tabs">
        {[
          ['expenses', `Expenses (${totalElements})`, <FileText size={14} />],
          ['advances', `Advances (${advances.length})`, <Wallet size={14} />],
          ['history',  'History', <History size={14} />],
        ].map(([tab, lbl, icon]) => (
          <button key={tab} className={`exp-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {icon} {lbl}
          </button>
        ))}
      </div>

      {/* ── EXPENSES TABLE ───────────────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div className="exp-mgmt-table-container">
          <table className="exp-mgmt-table">
            <thead>
              <tr>
                {columns.filter(c => c.visible).map((col, idx) => (
                  <th key={col.key} draggable
                    className={`${col.sortable ? 'sortable' : ''} ${sortBy === col.key ? 'sorted' : ''}`}
                    onDragStart={e => onDragStart(e, idx)} onDragEnter={() => onDragEnter(idx)}
                    onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}
                    onClick={() => handleSort(col.key)}>
                    <div className="th-inner">
                      <GripVertical size={11} className="th-grip" />
                      {col.label}<SortIcon col={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={columns.filter(c => c.visible).length} className="exp-empty-state">
                  No expenses found. Adjust your filters or add a new expense.
                </td></tr>
              ) : expenses.map(exp => (
                <tr key={exp.id} className="exp-mgmt-table-row">
                  {columns.filter(c => c.visible).map(col => (
                    <td key={col.key}>{renderCell(col, exp)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="table-footer">
            <span>
              Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} expenses
            </span>
            <div className="pagination">
              <button className="page-btn" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>«</button>
              <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>Previous</button>
              {[...Array(Math.min(5, totalPages))].map((_, index) => {
                const pageNum = currentPage < 3 ? index : currentPage + index - 2;
                if (pageNum < 0 || pageNum >= totalPages) return null;
                return (
                  <button key={pageNum} className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}>{pageNum + 1}</button>
                );
              })}
              <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>Next</button>
              <button className="page-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>»</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADVANCES TABLE ───────────────────────────────────────────────────── */}
      {activeTab === 'advances' && (
        <div className="exp-mgmt-table-container">
          <table className="exp-mgmt-table">
            <thead>
              <tr>
                <th>Code</th><th>Date</th><th>Group / Project</th><th>Purpose</th>
                <th>Expected Trip</th><th>Requested By</th><th>Approved By</th>
                <th>Total</th><th>Payments</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 ? (
                <tr><td colSpan={11} className="exp-empty-state">No advances found.</td></tr>
              ) : advances.map(adv => (
                <tr key={adv.id} className="exp-mgmt-table-row">
                  <td><span className="exp-code">{adv.advanceCode}</span></td>
                  <td>{fmtDate(adv.advanceDate)}</td>
                  <td>
                    <div className="exp-group-cell">
                      {adv.groupName    && <span className="grp-name">{adv.groupName}</span>}
                      {adv.subGroupName && <span className="sub-name">{adv.subGroupName}</span>}
                      {adv.projectId    && <span className="prj-name">{adv.projectId}</span>}
                    </div>
                  </td>
                  <td className="exp-purpose-cell">
                    {adv.tripPurpose?.length > 50 ? adv.tripPurpose.substring(0, 50) + '…' : adv.tripPurpose}
                  </td>
                  <td>{fmtDate(adv.expectedTripDate)}</td>
                  <td>{adv.requestedByName || '—'}</td>
                  <td>{adv.approvedByName  || '—'}</td>
                  <td><strong className="exp-amount">{fmt(adv.totalAdvanceAmount)}</strong></td>
                  <td>{adv.advancePayments?.length || 0} payment(s)</td>
                  <td><StatusBadge s={adv.status} /></td>
                  <td>
                    <div className="exp-actions-cell">
                      {adv.status === 'Pending' && (
                        <button className="exp-act-btn ok-btn" title="Approve" onClick={async () => {
                          try {
                            const r = await fetch(`${API_BASE_URL}/api/project-expenses/advances/${adv.id}/status`,
                              { method: 'PATCH', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify({ status: 'Approved' }) });
                            if (!r.ok) throw new Error();
                            showSuccess('Advance approved'); fetchAdvances();
                          } catch { showError('Failed to approve'); }
                        }}><CheckCircle size={14} /></button>
                      )}
                      {adv.status === 'Approved' && (
                        <button className="exp-act-btn ok-btn settle-btn" onClick={async () => {
                          try {
                            const r = await fetch(`${API_BASE_URL}/api/project-expenses/advances/${adv.id}/status`,
                              { method: 'PATCH', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify({ status: 'Settled' }) });
                            if (!r.ok) throw new Error();
                            showSuccess('Advance settled'); fetchAdvances(); fetchStats();
                          } catch { showError('Failed to settle'); }
                        }}>Settle</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── HISTORY TABLE ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="exp-mgmt-table-container">
          <table className="exp-mgmt-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Reference ID</th><th>Action</th>
                <th>Changed By</th><th>Old Status</th><th>New Status</th><th>Description</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={8} className="exp-empty-state">No history found.</td></tr>
              ) : history.map(h => (
                <tr key={h.id} className="exp-mgmt-table-row">
                  <td>{fmtDate(h.createdAt)}</td>
                  <td><StatusBadge s={h.referenceType} /></td>
                  <td><span className="exp-code">#{h.referenceId}</span></td>
                  <td><span className="history-action-badge">{h.action}</span></td>
                  <td>{h.changedByName || '—'}</td>
                  <td>{h.oldStatus || '—'}</td>
                  <td>{h.newStatus || '—'}</td>
                  <td>{h.changeDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADD EXPENSE MODAL (same structure as Create Vendor Modal)
      ══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && expenseFormData && (
        <div className="exp-mgmt-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="exp-mgmt-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exp-mgmt-modal-header">
              <h2>Add New Trip Expense</h2>
              <button className="exp-mgmt-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <div className="exp-mgmt-edit-form">

              {/* ── Project Assignment (same as VendorManagement Create Modal) ── */}
              <div className="exp-form-section">
                <h3>Project Assignment</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Group *</label>
                    <select value={modalGroupName} onChange={handleModalGroupChange}
                      disabled={modalDropdownLoading.groups}>
                      <option value="">
                        {modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}
                      </option>
                      {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Sub-Group *</label>
                    <select value={modalSubGroupName} onChange={handleModalSubGroupChange}
                      disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                      <option value="">
                        {!modalGroupName ? 'Select Group First'
                          : modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub-Group'}
                      </option>
                      {modalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-group">
                  <label>Project *</label>
                  <select value={modalProjectId} onChange={handleModalProjectChange}
                    disabled={!modalSubGroupName || modalDropdownLoading.projects}>
                    <option value="">
                      {!modalSubGroupName ? 'Select Sub-Group First'
                        : modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}
                    </option>
                    {modalProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.location ? ` - ${p.location}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Trip Information ───────────────────────────────────────────── */}
              <div className="exp-form-section">
                <h3>Trip Information</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Trip Date *</label>
                    <input type="date" value={expenseFormData.tripDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tripDate: e.target.value })} />
                  </div>
                  <div className="vendor-form-group">
                    <label>Visit Type</label>
                    <select value={expenseFormData.visitType}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, visitType: e.target.value })}>
                      {VISIT_TYPES.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Trip Reason / Purpose *</label>
                    <textarea rows={2} value={expenseFormData.tripReason}
                      placeholder="E.g. Client meeting for solar panel inspection…"
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tripReason: e.target.value })} />
                  </div>
                  <div className="vendor-form-group">
                    <label>Trip Outcome / Result</label>
                    <textarea rows={2} value={expenseFormData.tripOutcome}
                      placeholder="E.g. Client approved the plan…"
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tripOutcome: e.target.value })} />
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Paid By</label>
                    <select value={expenseFormData.paidByUserId}
                      onChange={(e) => {
                        const u = availableUsers.find(u => String(u.id) === e.target.value);
                        setExpenseFormData({ ...expenseFormData, paidByUserId: e.target.value, paidByName: u?.name || '' });
                      }}>
                      <option value="">Select User</option>
                      {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Approved By</label>
                    <select value={expenseFormData.approvedByUserId}
                      onChange={(e) => {
                        const u = availableUsers.find(u => String(u.id) === e.target.value);
                        setExpenseFormData({ ...expenseFormData, approvedByUserId: e.target.value, approvedByName: u?.name || '' });
                      }}>
                      <option value="">Select Manager</option>
                      {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Status</label>
                    <select value={expenseFormData.status}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, status: e.target.value })}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Expense Items ──────────────────────────────────────────────── */}
              <div className="exp-form-section">
                <div className="exp-items-header">
                  <h3>Expense Items</h3>
                  <button className="exp-mgmt-btn-primary btn-sm"
                    onClick={() => setExpenseFormData(prev => ({
                      ...prev,
                      expenseItems: [...prev.expenseItems, {
                        id: Date.now(), category: 'Food', amount: '', paymentMode: 'Cash', description: '',
                      }],
                    }))}>
                    <Plus size={13} /> Add Item
                  </button>
                </div>

                {expenseFormData.expenseItems.map((item, idx) => (
                  <div key={item.id} className="exp-item-card">
                    <div className="exp-item-header">
                      <span>Item #{idx + 1}</span>
                      {expenseFormData.expenseItems.length > 1 && (
                        <button className="exp-item-remove"
                          onClick={() => setExpenseFormData(prev => ({
                            ...prev, expenseItems: prev.expenseItems.filter(i => i.id !== item.id),
                          }))}>
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="vendor-form-row">
                      <div className="vendor-form-group">
                        <label>Category *</label>
                        <select value={item.category}
                          onChange={(e) => setExpenseFormData(prev => ({
                            ...prev, expenseItems: prev.expenseItems.map(i =>
                              i.id === item.id ? { ...i, category: e.target.value } : i),
                          }))}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="vendor-form-group">
                        <label>Amount (₹) *</label>
                        <input type="number" step="0.01" placeholder="0.00" value={item.amount}
                          onChange={(e) => setExpenseFormData(prev => ({
                            ...prev, expenseItems: prev.expenseItems.map(i =>
                              i.id === item.id ? { ...i, amount: e.target.value } : i),
                          }))} />
                      </div>
                      <div className="vendor-form-group">
                        <label>Payment Mode</label>
                        <select value={item.paymentMode}
                          onChange={(e) => setExpenseFormData(prev => ({
                            ...prev, expenseItems: prev.expenseItems.map(i =>
                              i.id === item.id ? { ...i, paymentMode: e.target.value } : i),
                          }))}>
                          {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="vendor-form-group">
                      <label>Description / Notes</label>
                      <input type="text" value={item.description} placeholder="E.g. Flight to Mumbai…"
                        onChange={(e) => setExpenseFormData(prev => ({
                          ...prev, expenseItems: prev.expenseItems.map(i =>
                            i.id === item.id ? { ...i, description: e.target.value } : i),
                        }))} />
                    </div>
                  </div>
                ))}

                <div className="exp-items-total">
                  <span>Total Trip Amount:</span>
                  <strong>{fmt(expenseFormData.expenseItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</strong>
                </div>
              </div>

              {/* ── Commission Details (conditional) ──────────────────────────── */}
              {expenseFormData.expenseItems.some(i => i.category === 'Commission') && (
                <div className="exp-form-section commission-section">
                  <h3>Commission Details</h3>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group">
                      <label>Commission Type</label>
                      <select value={expenseFormData.commissionType}
                        onChange={(e) => setExpenseFormData({ ...expenseFormData, commissionType: e.target.value })}>
                        <option value="">Select Type</option>
                        {COMMISSION_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="vendor-form-group">
                      <label>Given To</label>
                      <input type="text" value={expenseFormData.commissionGivenTo}
                        placeholder="Name / Vendor"
                        onChange={(e) => setExpenseFormData({ ...expenseFormData, commissionGivenTo: e.target.value })} />
                    </div>
                  </div>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group">
                      <label>Percentage (%)</label>
                      <input type="number" step="0.01" value={expenseFormData.commissionPercentage}
                        onChange={(e) => setExpenseFormData({ ...expenseFormData, commissionPercentage: e.target.value })} />
                    </div>
                    <div className="vendor-form-group">
                      <label>Fixed Amount (₹)</label>
                      <input type="number" step="0.01" value={expenseFormData.commissionFixedAmount}
                        onChange={(e) => setExpenseFormData({ ...expenseFormData, commissionFixedAmount: e.target.value })} />
                    </div>
                    <div className="vendor-form-group">
                      <label>Sales Order Ref</label>
                      <input type="text" value={expenseFormData.salesOrderRef} placeholder="SO-2024-001"
                        onChange={(e) => setExpenseFormData({ ...expenseFormData, salesOrderRef: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="exp-mgmt-modal-actions">
              <button className="exp-mgmt-btn-primary" onClick={handleCreateExpense}>
                Save {expenseFormData.expenseItems.length} Expense(s)
              </button>
              <button className="exp-mgmt-btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT EXPENSE MODAL (same structure as Edit Vendor Modal)
      ══════════════════════════════════════════════════════════════════════ */}
      {showEditModal && expenseFormData && (
        <div className="exp-mgmt-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="exp-mgmt-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exp-mgmt-modal-header">
              <h2>Edit Expense</h2>
              <button className="exp-mgmt-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div className="exp-mgmt-edit-form">

              {/* ── Project Assignment ─────────────────────────────────────────── */}
              <div className="exp-form-section">
                <h3>Project Assignment</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Group</label>
                    <select value={modalGroupName} onChange={handleModalGroupChange}
                      disabled={modalDropdownLoading.groups}>
                      <option value="">{modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}</option>
                      {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Sub-Group</label>
                    <select value={modalSubGroupName} onChange={handleModalSubGroupChange}
                      disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                      <option value="">
                        {!modalGroupName ? 'Select Group First'
                          : modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub-Group'}
                      </option>
                      {modalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-group">
                  <label>Project</label>
                  <select value={modalProjectId} onChange={handleModalProjectChange}
                    disabled={!modalSubGroupName || modalDropdownLoading.projects}>
                    <option value="">
                      {!modalSubGroupName ? 'Select Sub-Group First'
                        : modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}
                    </option>
                    {modalProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.location ? ` - ${p.location}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Basic Information ──────────────────────────────────────────── */}
              <div className="exp-form-section">
                <h3>Expense Details</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Category</label>
                    <select value={expenseFormData.category}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}>
                      {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Amount (₹) *</label>
                    <input type="number" step="0.01" value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })} />
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Payment Mode</label>
                    <select value={expenseFormData.paymentMode}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, paymentMode: e.target.value })}>
                      {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Status</label>
                    <select value={expenseFormData.status}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, status: e.target.value })}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-group">
                  <label>Description</label>
                  <textarea rows={2} value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })} />
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Trip Reason</label>
                    <textarea rows={2} value={expenseFormData.tripReason}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tripReason: e.target.value })} />
                  </div>
                  <div className="vendor-form-group">
                    <label>Trip Outcome</label>
                    <textarea rows={2} value={expenseFormData.tripOutcome}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tripOutcome: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="exp-mgmt-modal-actions">
              <button className="exp-mgmt-btn-primary" onClick={handleUpdateExpense}>Save Changes</button>
              <button className="exp-mgmt-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADVANCE MODAL (same structure as VendorManagement modals)
      ══════════════════════════════════════════════════════════════════════ */}
      {showAdvanceModal && advanceFormData && (
        <div className="exp-mgmt-modal-overlay" onClick={() => setShowAdvanceModal(false)}>
          <div className="exp-mgmt-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exp-mgmt-modal-header">
              <h2>Record Advance Payment</h2>
              <button className="exp-mgmt-modal-close" onClick={() => setShowAdvanceModal(false)}>✕</button>
            </div>

            <div className="exp-mgmt-edit-form">

              {/* ── Project Assignment ─────────────────────────────────────────── */}
              <div className="exp-form-section">
                <h3>Project Assignment</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Group *</label>
                    <select value={advModalGroupName} onChange={handleAdvModalGroupChange}
                      disabled={advModalDropdownLoading.groups}>
                      <option value="">{advModalDropdownLoading.groups ? 'Loading...' : 'Select Group'}</option>
                      {advModalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Sub-Group *</label>
                    <select value={advModalSubGroupName} onChange={handleAdvModalSubGroupChange}
                      disabled={!advModalGroupName || advModalDropdownLoading.subGroups}>
                      <option value="">
                        {!advModalGroupName ? 'Select Group First'
                          : advModalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub-Group'}
                      </option>
                      {advModalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-group">
                  <label>Project *</label>
                  <select value={advModalProjectId} onChange={handleAdvModalProjectChange}
                    disabled={!advModalSubGroupName || advModalDropdownLoading.projects}>
                    <option value="">
                      {!advModalSubGroupName ? 'Select Sub-Group First'
                        : advModalDropdownLoading.projects ? 'Loading...' : 'Select Project'}
                    </option>
                    {advModalProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.location ? ` - ${p.location}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Trip Details ───────────────────────────────────────────────── */}
              <div className="exp-form-section">
                <h3>Trip Details</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Request Date *</label>
                    <input type="date" value={advanceFormData.advanceDate}
                      onChange={(e) => setAdvanceFormData({ ...advanceFormData, advanceDate: e.target.value })} />
                  </div>
                  <div className="vendor-form-group">
                    <label>Expected Trip Date</label>
                    <input type="date" value={advanceFormData.expectedTripDate}
                      onChange={(e) => setAdvanceFormData({ ...advanceFormData, expectedTripDate: e.target.value })} />
                  </div>
                </div>
                <div className="vendor-form-group">
                  <label>Trip Purpose *</label>
                  <textarea rows={2} value={advanceFormData.tripPurpose}
                    placeholder="E.g. Site visit to Hyderabad for installation…"
                    onChange={(e) => setAdvanceFormData({ ...advanceFormData, tripPurpose: e.target.value })} />
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Requested By</label>
                    <select value={advanceFormData.requestedByUserId}
                      onChange={(e) => {
                        const u = availableUsers.find(u => String(u.id) === e.target.value);
                        setAdvanceFormData({ ...advanceFormData, requestedByUserId: e.target.value, requestedByName: u?.name || '' });
                      }}>
                      <option value="">Select User</option>
                      {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group">
                    <label>Approved By</label>
                    <select value={advanceFormData.approvedByUserId}
                      onChange={(e) => {
                        const u = availableUsers.find(u => String(u.id) === e.target.value);
                        setAdvanceFormData({ ...advanceFormData, approvedByUserId: e.target.value, approvedByName: u?.name || '' });
                      }}>
                      <option value="">Select Manager</option>
                      {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Status</label>
                    <select value={advanceFormData.status}
                      onChange={(e) => setAdvanceFormData({ ...advanceFormData, status: e.target.value })}>
                      {ADVANCE_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Advance Payments ───────────────────────────────────────────── */}
              <div className="exp-form-section">
                <div className="exp-items-header">
                  <h3>Advance Payments</h3>
                  <button className="exp-mgmt-btn-primary btn-sm"
                    disabled={advanceFormData.advancePayments.length >= 3}
                    onClick={() => setAdvanceFormData(prev => ({
                      ...prev,
                      advancePayments: [...prev.advancePayments, {
                        id: Date.now(),
                        advanceNumber: prev.advancePayments.length + 1,
                        amount: '', paymentMode: 'Bank Transfer',
                        paymentDate: new Date().toISOString().split('T')[0], notes: '',
                      }],
                    }))}>
                    <Plus size={13} /> Add Payment
                  </button>
                </div>
                <p className="exp-help-text">Maximum 3 advance payments per trip</p>

                {advanceFormData.advancePayments.map((pmt) => (
                  <div key={pmt.id} className="exp-item-card">
                    <div className="exp-item-header">
                      <span>Advance #{pmt.advanceNumber}</span>
                      {advanceFormData.advancePayments.length > 1 && (
                        <button className="exp-item-remove"
                          onClick={() => setAdvanceFormData(prev => ({
                            ...prev,
                            advancePayments: prev.advancePayments
                              .filter(p => p.id !== pmt.id)
                              .map((p, i) => ({ ...p, advanceNumber: i + 1 })),
                          }))}>
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="vendor-form-row">
                      <div className="vendor-form-group">
                        <label>Amount (₹) *</label>
                        <input type="number" step="0.01" value={pmt.amount}
                          onChange={(e) => setAdvanceFormData(prev => ({
                            ...prev,
                            advancePayments: prev.advancePayments.map(p =>
                              p.id === pmt.id ? { ...p, amount: e.target.value } : p),
                          }))} />
                      </div>
                      <div className="vendor-form-group">
                        <label>Payment Mode</label>
                        <select value={pmt.paymentMode}
                          onChange={(e) => setAdvanceFormData(prev => ({
                            ...prev,
                            advancePayments: prev.advancePayments.map(p =>
                              p.id === pmt.id ? { ...p, paymentMode: e.target.value } : p),
                          }))}>
                          {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="vendor-form-group">
                        <label>Payment Date</label>
                        <input type="date" value={pmt.paymentDate}
                          onChange={(e) => setAdvanceFormData(prev => ({
                            ...prev,
                            advancePayments: prev.advancePayments.map(p =>
                              p.id === pmt.id ? { ...p, paymentDate: e.target.value } : p),
                          }))} />
                      </div>
                    </div>
                    <div className="vendor-form-group">
                      <label>Notes</label>
                      <input type="text" value={pmt.notes}
                        placeholder="E.g. First advance for travel booking…"
                        onChange={(e) => setAdvanceFormData(prev => ({
                          ...prev,
                          advancePayments: prev.advancePayments.map(p =>
                            p.id === pmt.id ? { ...p, notes: e.target.value } : p),
                        }))} />
                    </div>
                  </div>
                ))}

                <div className="exp-items-total">
                  <span>Total Advance:</span>
                  <strong>{fmt(advanceFormData.advancePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0))}</strong>
                </div>
              </div>
            </div>

            <div className="exp-mgmt-modal-actions">
              <button className="exp-mgmt-btn-primary" onClick={handleCreateAdvance}>Save Advance</button>
              <button className="exp-mgmt-btn-secondary" onClick={() => setShowAdvanceModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DETAIL DRAWER (same structure as VendorManagement Detail Drawer)
      ══════════════════════════════════════════════════════════════════════ */}
      {showDetailDrawer && selectedExpense && (
        <div className="exp-mgmt-drawer-overlay" onClick={() => setShowDetailDrawer(false)}>
          <div className="exp-mgmt-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="exp-mgmt-drawer-header">
              <div>
                <h2>{selectedExpense.expenseCode}</h2>
                <p className="exp-mgmt-drawer-subtitle">
                  {selectedExpense.groupName}{selectedExpense.subGroupName ? ` › ${selectedExpense.subGroupName}` : ''}
                  {selectedExpense.projectId ? ` › ${selectedExpense.projectId}` : ''}
                </p>
              </div>
              <button className="exp-mgmt-drawer-close" onClick={() => setShowDetailDrawer(false)}>✕</button>
            </div>

            <div className="exp-mgmt-drawer-content">
              {/* Expense Information */}
              <div className="exp-mgmt-drawer-section">
                <h3>Expense Information</h3>
                <div className="vendor-info-grid">
                  {[
                    [<Calendar size={18} />, 'Trip Date',    fmtDate(selectedExpense.tripDate)],
                    [<MapPin size={18} />,   'Visit Type',   selectedExpense.visitType],
                    [<FileText size={18} />, 'Category',     selectedExpense.category],
                    [<IndianRupee size={18}/>, 'Amount',     fmt(selectedExpense.amount)],
                    [<CreditCard size={18}/>, 'Payment Mode',selectedExpense.paymentMode],
                    [<Users size={18} />,    'Paid By',      selectedExpense.paidByName || 'N/A'],
                    [<CheckCircle size={18}/>, 'Approved By',selectedExpense.approvedByName || 'Pending'],
                    [<Clock size={18} />,    'Status',       null],
                  ].map(([icon, label, val], i) => (
                    <div key={i} className="vendor-info-item">
                      {icon}
                      <div>
                        <span className="info-label">{label}</span>
                        {label === 'Status'
                          ? <StatusBadge s={selectedExpense.status} />
                          : <span className="info-value">{val || 'N/A'}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trip Details */}
              {(selectedExpense.tripReason || selectedExpense.tripOutcome) && (
                <div className="exp-mgmt-drawer-section">
                  <h3>Trip Details</h3>
                  {selectedExpense.tripReason && (
                    <div className="exp-info-box"><h4>Reason / Purpose</h4><p>{selectedExpense.tripReason}</p></div>
                  )}
                  {selectedExpense.tripOutcome && (
                    <div className="exp-info-box"><h4>Outcome / Result</h4><p>{selectedExpense.tripOutcome}</p></div>
                  )}
                  {selectedExpense.description && (
                    <div className="exp-info-box"><h4>Description</h4><p>{selectedExpense.description}</p></div>
                  )}
                </div>
              )}

              {/* Commission Details */}
              {selectedExpense.category === 'Commission' && selectedExpense.commissionType && (
                <div className="exp-mgmt-drawer-section">
                  <h3>Commission Details</h3>
                  <div className="vendor-info-grid">
                    {[
                      ['Type',        selectedExpense.commissionType],
                      ['Given To',    selectedExpense.commissionGivenTo],
                      ['Percentage',  selectedExpense.commissionPercentage ? `${selectedExpense.commissionPercentage}%` : 'N/A'],
                      ['Fixed Amount',selectedExpense.commissionFixedAmount ? fmt(selectedExpense.commissionFixedAmount) : 'N/A'],
                      ['Sales Order', selectedExpense.salesOrderRef || 'N/A'],
                    ].map(([label, val], i) => (
                      <div key={i} className="vendor-info-item">
                        <FileText size={18} />
                        <div><span className="info-label">{label}</span><span className="info-value">{val || 'N/A'}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Receipt */}
              {selectedExpense.receiptUrl && (
                <div className="exp-mgmt-drawer-section">
                  <h3>Receipt</h3>
                  <a href={selectedExpense.receiptUrl} target="_blank" rel="noreferrer" className="exp-receipt-link">
                    <FileText size={14} /> View Receipt
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="exp-mgmt-drawer-actions">
                <button className="exp-mgmt-btn-primary"
                  onClick={() => { setShowDetailDrawer(false); handleEditExpense(selectedExpense); }}>
                  Edit Expense
                </button>
                {selectedExpense.status === 'Pending' && (
                  <>
                    <button className="exp-mgmt-btn-success"
                      onClick={() => { handleStatusChange(selectedExpense.id, 'Approved'); setShowDetailDrawer(false); }}>
                      Approve
                    </button>
                    <button className="exp-mgmt-btn-secondary"
                      onClick={() => { handleStatusChange(selectedExpense.id, 'Rejected'); setShowDetailDrawer(false); }}>
                      Reject
                    </button>
                  </>
                )}
                <button className="exp-mgmt-btn-danger" onClick={() => handleDeleteExpense(selectedExpense.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectCostExpenseManagement;