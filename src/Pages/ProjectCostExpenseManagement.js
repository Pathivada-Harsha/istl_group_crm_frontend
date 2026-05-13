import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Plus, X, Edit2, Eye, Trash2,
  IndianRupee, CreditCard, FileText,
  CheckCircle, Clock, XCircle, Briefcase,
  MapPin, Utensils, Plane, Hotel, Users,
  ArrowUpDown, ArrowUp, ArrowDown, GripVertical,
  Receipt, RefreshCw,
} from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import filterApi from '../services/filterApi';
import ConfirmationModal from '../components/ConfirmationModal';
import '../pages-css/ProjectCostExpenseManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Travel', 'Site Visit', 'Accommodation', 'Food', 'Transportation', 'Labour Charges', 'Commission', 'Miscellaneous', 'Other'];
const PAYMENT_MODES = ['Cash', 'Bank_Transfer', 'UPI', 'Card', 'Cheque'];
const formatPaymentMode = (mode) => mode === 'Bank_Transfer' ? 'Bank Transfer' : (mode || '');
const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];

const DEFAULT_COLUMNS = [
  { key: 'expenseCode', label: 'Code', sortable: true, visible: true },
  { key: 'tripDate', label: 'Date', sortable: true, visible: true },
  { key: 'groupInfo', label: 'Group/Project', sortable: false, visible: true },
  { key: 'expenseItems', label: 'Expense Items', sortable: false, visible: true },
  { key: 'amount', label: 'Total', sortable: true, visible: true },
  { key: 'paidByName', label: 'Paid By', sortable: true, visible: true },
  { key: 'actions', label: 'Actions', sortable: false, visible: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = v => v == null ? '₹0' : `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

const CategoryIcon = ({ cat }) => ({
  'Travel': <Plane size={14} />,
  'Site Visit': <MapPin size={14} />,
  'Accommodation': <Hotel size={14} />,
  'Food': <Utensils size={14} />,
  'Transportation': <Briefcase size={14} />,
  'Labour Charges': <Users size={14} />,
  'Commission': <Users size={14} />,
  'Miscellaneous': <FileText size={14} />,
}[cat] || <FileText size={14} />);

const StatusBadge = ({ s }) => (
  <span className={`exp-badge badge-${(s || 'pending').toLowerCase()}`}>{s || '—'}</span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectCostExpenseManagement = () => {

  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // ── Role-based access ──────────────────────────────────────────────────────
  const userRole = (user?.role || localStorage.getItem('userRole') || '').toLowerCase();
  const canApprove = ['superadmin', 'super_admin', 'admin', 'accounts', 'account'].some(r => userRole.includes(r));

  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [filters, setFilters] = useState({
    search: '', category: 'all', status: 'all', paymentMode: 'all', dateFrom: '', dateTo: '',
  });
  const [sortBy, setSortBy] = useState('tripDate');
  const [sortDir, setSortDir] = useState('desc');

  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColPanel, setShowColPanel] = useState(false);
  const dragCol = useRef(null);
  const dragOver = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', type: 'alert', onConfirm: null });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemsModalExpense, setItemsModalExpense] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalExpense, setViewModalExpense] = useState(null);
  const [expenseFormData, setExpenseFormData] = useState(null);

  // ── Bill upload state ──────────────────────────────────────────────────────
  const [billFile, setBillFile] = useState(null);           // File object
  const [billUploading, setBillUploading] = useState(false);
  const billInputRef = useRef(null);

  // ── Per-item project dropdowns cache (key = item.id) ──────────────────────
  const [itemProjects, setItemProjects] = useState({});     // { [itemId]: [{id,name}] }
  const [itemProjectsLoading, setItemProjectsLoading] = useState({});

  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({
    groups: false, subGroups: false, projects: false,
  });


  const [availableUsers, setAvailableUsers] = useState([]);

  // ── Auth Headers ─────────────────────────────────────────────────────────────
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Name': user?.name || localStorage.getItem('userName') || 'User',
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json',
  });

  // ── Modal dropdown handlers — EXPENSE ────────────────────────────────────────
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups);
    } catch (error) { showError('Failed to load groups'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchModalSubGroups = async (grp) => {
    if (!grp) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(grp);
      setModalSubGroups(subGroups);
    } catch (error) { showError('Failed to load sub-groups'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchModalProjects = async (grp, sub) => {
    if (!grp || !sub) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(grp, sub);
      setModalProjects(projects);
    } catch (error) { showError('Failed to load projects'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(0); // reset to first page on size change
  };
  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName('')
    setModalSubGroups([]); setModalProjects([]);
    setItemProjects({}); // clear all item project caches
    setExpenseFormData(prev => ({ ...prev, groupName: newGroupName, subGroupName: '', projectId: '' }));
    if (newGroupName) fetchModalSubGroups(newGroupName);
  };

  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName); setModalProjects([]);
    setItemProjects({}); // clear item project caches
    setExpenseFormData(prev => ({ ...prev, subGroupName: newSubGroupName, projectId: '' }));
    if (modalGroupName && newSubGroupName) {
      fetchModalProjects(modalGroupName, newSubGroupName);
      // Load projects for all existing items
      setTimeout(() => refreshAllItemProjects(modalGroupName, newSubGroupName), 100);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setExpenseFormData(prev => ({ ...prev, projectId: newProjectId }));
  };

  // ── Per-item project loader ────────────────────────────────────────────────
  // When group/subgroup is set, load projects for every item dropdown
  const loadItemProjects = async (itemId, grp, sub) => {
    if (!grp || !sub) { setItemProjects(prev => ({ ...prev, [itemId]: [] })); return; }
    setItemProjectsLoading(prev => ({ ...prev, [itemId]: true }));
    try {
      const projects = await filterApi.getProjects(grp, sub);
      setItemProjects(prev => ({ ...prev, [itemId]: projects }));
    } catch { /* silent */ }
    finally { setItemProjectsLoading(prev => ({ ...prev, [itemId]: false })); }
  };

  // When group/subgroup changes in create modal, refresh all item project lists
  const refreshAllItemProjects = (grp, sub) => {
    if (!expenseFormData?.expenseItems) return;
    expenseFormData.expenseItems.forEach(item => loadItemProjects(item.id, grp, sub));
  };

  // ── Bill upload handler ────────────────────────────────────────────────────
  const handleBillUpload = async (expenseId) => {
    if (!billFile) return null;
    if (billFile.size > 10 * 1024 * 1024) {
      showError('File size must not exceed 10 MB'); return null;
    }
    setBillUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', billFile);
      const headers = { ...getAuthHeaders() };
      delete headers['Content-Type']; // let browser set multipart boundary
      const res = await fetch(`${API_BASE_URL}/project-expenses/${expenseId}/receipt`, {
        method: 'POST', headers, credentials: 'include', body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setBillFile(null);
      return data.receiptUrl;
    } catch (err) { showError('Bill upload failed: ' + err.message); return null; }
    finally { setBillUploading(false); }
  };

  // ── Modal dropdown handlers — ADVANCE ────────────────────────────────────────
  // ── Fetch users ───────────────────────────────────────────────────────────────
  useEffect(() => {
    filterApi.getLeadsUsers().then(setAvailableUsers).catch(() => { });
  }, []);

  // ── Data fetchers ─────────────────────────────────────────────────────────────
// eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, [groupName, subGroupName, projectId, currentPage, filters.search, filters.status, pageSize,
    filters.category, filters.paymentMode, filters.dateFrom, filters.dateTo, sortBy, sortDir]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy, sortDir });
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.search) params.append('search', filters.search);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.paymentMode !== 'all') params.append('paymentMode', filters.paymentMode);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await fetch(`${API_BASE_URL}/project-expenses?${params}`, {
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
      if (projectId) params.append('projectId', projectId);
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      const response = await fetch(`${API_BASE_URL}/project-expenses/stats?${params}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (response.ok) setStats(await response.json());
    } catch { /* silent */ }
  };



  // ── Add / Create Expense ──────────────────────────────────────────────────────
  const handleAddNewExpense = () => {
    setBillFile(null);
    setItemProjects({});
    const initItem = { id: Date.now(), category: 'Travel', projectId: '', amount: '', paymentMode: 'UPI', description: '' };
    setExpenseFormData({
      groupName: groupName || '', subGroupName: subGroupName || '',
      tripDate: new Date().toISOString().split('T')[0],
      tripReason: '',
      status: 'Approved',
      paidByUserId: String(user?.id || ''), paidByName: user?.name || '',
      adjustedAdvanceId: '', advanceAdjustedAmount: '',
      expenseItems: [initItem],
    });
    setModalGroupName(groupName || '');
    setModalSubGroupName(subGroupName || '');
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);
    fetchModalGroups();
    if (groupName) {
      fetchModalSubGroups(groupName);
      if (subGroupName) {
        fetchModalProjects(groupName, subGroupName);
        loadItemProjects(initItem.id, groupName, subGroupName);
      }
    }
    setShowCreateModal(true);
  };

  const handleCreateExpense = async () => {
    const { groupName: grp, subGroupName: sub, tripDate, tripReason, paidByUserId, paidByName, expenseItems } = expenseFormData || {};
    if (!grp || !sub) { showError('Group and Sub-Group are required'); return; }
    if (!tripDate) { showError('Date is required'); return; }
    if (!expenseItems?.length) { showError('Add at least one expense item'); return; }

    // Validate every item has a project and amount
    const missingProject = expenseItems.find(i => !i.projectId);
    if (missingProject) { showError('Every item must have a project assigned'); return; }
    const missingAmount = expenseItems.find(i => !i.amount || parseFloat(i.amount) <= 0);
    if (missingAmount) { showError('Every item must have a valid amount'); return; }

    // ── Group items by projectId — one expense record per project ────────────
    const byProject = {};
    expenseItems.forEach(i => {
      if (!byProject[i.projectId]) byProject[i.projectId] = [];
      byProject[i.projectId].push(i);
    });
    const projectGroups = Object.entries(byProject); // [[projectId, [items]], ...]

    setLoading(true);
    try {
      const results = [];
      for (const [pid, items] of projectGroups) {
        const body = {
          groupName: grp, subGroupName: sub,
          projectId: pid,                          // one valid projectId per call
          tripDate, tripReason: tripReason || null,
          status: expenseFormData.status || 'Approved',
          paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
          paidByName: paidByName || '',
          expenseItems: items.map(i => ({
            category: i.category,
            amount: parseFloat(i.amount) || 0,
            paymentMode: i.paymentMode,
            description: i.description || '',
          })),
        };
        const res = await fetch(`${API_BASE_URL}/project-expenses`, {
          method: 'POST', headers: getAuthHeaders(), credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed for project ${pid}: ${errText}`);
        }
        const created = await res.json();
        results.push(Array.isArray(created) ? created[0] : created);
      }

      // Upload bill to the first created expense if file selected
      if (billFile && results[0]?.id) await handleBillUpload(results[0].id);

      const projectCount = projectGroups.length;
      const itemCount = expenseItems.length;
      showSuccess(
        projectCount === 1
          ? `Expense created with ${itemCount} item(s) for 1 project`
          : `${itemCount} item(s) split across ${projectCount} project expense records`
      );
      setShowCreateModal(false); setBillFile(null);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to create expense'); }
    finally { setLoading(false); }
  }

  
  // ── Fetch Payments ───────────────────────────────────────────────────────────


  // ── Record single payment (from expense row button) ────────────────────────


  // ── Bulk Payment (multiple expenses at once) ───────────────────────────────


  // ── Bulk Advance (multi-project at once) ────────────────────────────────────


  // ── View / Edit / Update / Delete Expense ─────────────────────────────────────
  const handleViewExpense = async (expense) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-expenses/${expense.id}`, {
        headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch expense details');
      const data = await response.json();
      setViewModalExpense(data);
      setShowViewModal(true);
    } catch (error) {
      // fallback: open with existing data
      setViewModalExpense(expense);
      setShowViewModal(true);
    }
    finally { setLoading(false); }
  };

  const handleEditExpense = (expense) => {
    setBillFile(null);
    setItemProjects({});
    // Build items from expenseItems array; fall back to legacy single-item format
    // ExpenseItemResponse from backend does NOT include projectId on each item —
    // all items under one expense share the parent expense's projectId.
    const parentProjectId = expense.projectId ? String(expense.projectId) : '';
    const items = (expense.expenseItems && expense.expenseItems.length > 0)
      ? expense.expenseItems.map(i => ({
          id: i.id || Date.now() + Math.random(),
          category: i.category || 'Travel',
          projectId: i.projectId ? String(i.projectId) : parentProjectId,
          amount: i.amount?.toString() || '',
          paymentMode: i.paymentMode || 'UPI',
          description: i.description || '',
        }))
      : [{ id: Date.now(), category: expense.category || 'Travel',
           projectId: expense.projectId ? String(expense.projectId) : '',
           amount: expense.amount?.toString() || '',
           paymentMode: expense.paymentMode || 'UPI',
           description: expense.description || '' }];

    setExpenseFormData({
      id: expense.id, groupName: expense.groupName || '', subGroupName: expense.subGroupName || '',
      projectId: expense.projectId || '', tripDate: expense.tripDate || '',
      visitType: expense.visitType || 'Site Visit', tripReason: expense.tripReason || '',
      tripOutcome: expense.tripOutcome || '', paidByUserId: expense.paidByUserId?.toString() || '',
      paidByName: expense.paidByName || '', approvedByUserId: expense.approvedByUserId || '',
      approvedByName: expense.approvedByName || '', status: expense.status || 'Pending',
      receiptUrl: expense.receiptUrl || '',
      commissionType: expense.commissionType || '', commissionGivenTo: expense.commissionGivenTo || '',
      commissionPercentage: expense.commissionPercentage || '', commissionFixedAmount: expense.commissionFixedAmount || '',
      salesOrderRef: expense.salesOrderRef || '',
      expenseItems: items,
    });
    setModalGroupName(expense.groupName || '');
    setModalSubGroupName(expense.subGroupName || '');
    // No default project — each item carries its own projectId
    fetchModalGroups();
    if (expense.groupName) {
      fetchModalSubGroups(expense.groupName);
      if (expense.subGroupName) {
        fetchModalProjects(expense.groupName, expense.subGroupName);
        // Pre-load per-item project dropdowns
        items.forEach(item => loadItemProjects(item.id, expense.groupName, expense.subGroupName));
      }
    }
    setShowEditModal(true);
  }

  const handleUpdateExpense = async () => {
    const { id, groupName: grp, subGroupName: sub, tripDate, tripReason,
            paidByUserId, paidByName, expenseItems } = expenseFormData || {};
    if (!grp || !sub) { showError('Group and Sub-Group are required'); return; }
    if (!expenseItems?.length) { showError('Add at least one expense item'); return; }

    const missingProject = expenseItems.find(i => !i.projectId);
    if (missingProject) { showError('Every item must have a project assigned'); return; }
    const missingAmount = expenseItems.find(i => !i.amount || parseFloat(i.amount) <= 0);
    if (missingAmount) { showError('Every item must have a valid amount'); return; }

    // Check if all items belong to the SAME project as the original expense
    const allSameProject = expenseItems.every(i => i.projectId === expenseItems[0].projectId);

    setLoading(true);
    try {
      if (allSameProject) {
        // Simple update — single project, use PUT on the existing expense
        const res = await fetch(`${API_BASE_URL}/project-expenses/${id}`, {
          method: 'PUT', headers: getAuthHeaders(), credentials: 'include',
          body: JSON.stringify({
            groupName: grp, subGroupName: sub,
            projectId: expenseItems[0].projectId,
            tripDate, tripReason: tripReason || null,
            paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
            paidByName: paidByName || '',
            expenseItems: expenseItems.map(i => ({
              category: i.category, amount: parseFloat(i.amount) || 0,
              paymentMode: i.paymentMode, description: i.description || '',
            })),
          }),
        });
        if (!res.ok) throw new Error('Failed to update expense');
        if (billFile) await handleBillUpload(id);
        showSuccess('Expense updated successfully!');
      } else {
        // Multi-project: DELETE original, create new split records
        await fetch(`${API_BASE_URL}/project-expenses/${id}`, {
          method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
        });

        const byProject = {};
        expenseItems.forEach(i => {
          if (!byProject[i.projectId]) byProject[i.projectId] = [];
          byProject[i.projectId].push(i);
        });

        const results = [];
        for (const [pid, items] of Object.entries(byProject)) {
          const res = await fetch(`${API_BASE_URL}/project-expenses`, {
            method: 'POST', headers: getAuthHeaders(), credentials: 'include',
            body: JSON.stringify({
              groupName: grp, subGroupName: sub, projectId: pid,
              tripDate, tripReason: tripReason || null,
              paidByUserId: paidByUserId ? parseInt(paidByUserId) : null,
              paidByName: paidByName || '',
              expenseItems: items.map(i => ({
                category: i.category, amount: parseFloat(i.amount) || 0,
                paymentMode: i.paymentMode, description: i.description || '',
              })),
            }),
          });
          if (!res.ok) throw new Error('Failed to create split expense');
          const created = await res.json();
          results.push(Array.isArray(created) ? created[0] : created);
        }
        if (billFile && results[0]?.id) await handleBillUpload(results[0].id);
        showSuccess(`Updated: split into ${Object.keys(byProject).length} project expense records`);
      }

      setShowEditModal(false); setBillFile(null);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to update expense'); }
    finally { setLoading(false); }
  }

    const handleStatusChange = (id, newStatus) => {
    const isReject = newStatus === 'Rejected';
    setConfirmModal({
      show: true,
      title: isReject ? 'Reject Expense' : `${newStatus} Expense`,
      message: isReject
        ? 'Are you sure you want to reject this expense?'
        : `Are you sure you want to mark this expense as ${newStatus}?`,
      type: isReject ? 'alert' : 'confirm',
      onConfirm: () => performStatusChange(id, newStatus),
    });
  };

  const performStatusChange = async (id, newStatus) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-expenses/${id}/status`, {
        method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      showSuccess(`Expense ${newStatus}`);
      fetchExpenses(); fetchStats();
    } catch (error) { showError(error.message); }
    finally { setLoading(false); }
  };

  const handleDeleteExpense = (expenseId) => {
    setConfirmModal({
      show: true,
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense? This action cannot be undone.',
      type: 'alert',
      onConfirm: () => performDeleteExpense(expenseId),
    });
  };

  const performDeleteExpense = async (expenseId) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/project-expenses/${expenseId}`, {
        method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete expense');
      showSuccess('Expense deleted successfully');
      // detail drawer removed
      fetchExpenses(); fetchStats();
    } catch (error) { showError('Failed to delete expense'); }
    finally { setLoading(false); }
  };

  // ── Column drag-and-drop ──────────────────────────────────────────────────────
  const onDragStart = (e, i) => { dragCol.current = i; e.dataTransfer.effectAllowed = 'move'; };
  const onDragEnter = (i) => { dragOver.current = i; };
  const onDragEnd = () => {
    const [from, to] = [dragCol.current, dragOver.current];
    if (from === null || to === null || from === to) return;
    setColumns(prev => { const a = [...prev]; a.splice(to, 0, ...a.splice(from, 1)); return a; });
    dragCol.current = null; dragOver.current = null;
  };

  // ── Sorting ───────────────────────────────────────────────────────────────────
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

  // ── Cell renderer ─────────────────────────────────────────────────────────────
  const renderCell = (col, exp) => {
    switch (col.key) {
      case 'expenseCode': return <span className="exp-code">{exp.expenseCode}</span>;
      case 'tripDate': return fmtDate(exp.tripDate);
      case 'groupInfo': return (
        <div className="exp-group-cell">
          {exp.groupName && <span className="grp-name">{exp.groupName}</span>}
          {exp.subGroupName && <span className="sub-name">{exp.subGroupName}</span>}
          {exp.projectId && <span className="prj-name">{exp.projectId}</span>}
        </div>
      );
      case 'expenseItems': return (
        <div className="exp-items-chips-cell" style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); setItemsModalExpense(exp); setShowItemsModal(true); }}>
          {(exp.expenseItems || []).slice(0, 2).map((item, i) => (
            <span key={i} className="exp-item-chip">
              <CategoryIcon cat={item.category} />
              <span className="chip-cat">{item.category}</span>
              <span className="chip-amt">{fmt(item.amount)}</span>
            </span>
          ))}
          {(exp.expenseItems || []).length > 2 && (
            <span className="exp-item-chip chip-more">+{(exp.expenseItems || []).length - 2} more</span>
          )}
          {(exp.expenseItems || []).length === 0 && <span className="text-muted">—</span>}
        </div>
      );
      case 'amount': return <strong className="exp-amount">{fmt(exp.totalAmount)}</strong>;
      case 'paidByName': return exp.paidByName || '—';
      case 'actions': return (
        <div className="exp-actions-cell">
          <StatusBadge s={exp.status} />
          <button className="exp-act-btn view-btn" title="View" onClick={() => handleViewExpense(exp)}><Eye size={14} /></button>
          <button className="exp-act-btn edit-btn" title="Edit" onClick={() => handleEditExpense(exp)}><Edit2 size={14} /></button>
          {canApprove && exp.status === 'Pending' && (
            <>
              <button className="exp-act-btn approve-btn" title="Approve" onClick={() => handleStatusChange(exp.id, 'Approved')}><CheckCircle size={14} /></button>
              <button className="exp-act-btn reject-btn" title="Reject" onClick={() => handleStatusChange(exp.id, 'Rejected')}><XCircle size={14} /></button>
            </>
          )}
          <button className="exp-act-btn del-btn" title="Delete" onClick={() => handleDeleteExpense(exp.id)}><Trash2 size={14} /></button>
        </div>
      );
      default: return exp[col.key] || '—';
    }
  };

  // ── KPI cards ─────────────────────────────────────────────────────────────────
  const kpiData = stats ? [
    { title: 'Total Expenses', value: fmt(stats.totalExpenses), icon: <IndianRupee size={32} />, color: '#ef4444' },
    { title: 'Approved', value: fmt(stats.approvedExpenses), icon: <CheckCircle size={32} />, color: '#22c55e' },
    { title: 'Pending Approval', value: fmt(stats.pendingExpenses), icon: <Clock size={32} />, color: '#f59e0b' },
    { title: 'Travel & Site Visit', value: fmt(stats.travelAndSiteVisit), icon: <Plane size={32} />, color: '#3b82f6' },
    { title: 'Total Commission', value: fmt(stats.totalCommission), icon: <Users size={32} />, color: '#8b5cf6' },
    { title: 'Total Advances', value: fmt(stats.totalAdvances), icon: <Receipt size={32} />, color: '#06b6d4' },
  ] : [];

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="exp-mgmt-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ show: false })}
      />

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
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{formatPaymentMode(m)}</option>)}
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

          <button className="exp-mgmt-btn-secondary">
            <Download size={18} /> Export
          </button>
          <button className="exp-mgmt-btn-icon" title="Refresh"
            onClick={() => { fetchExpenses(); fetchStats(); }}>
            <RefreshCw size={16} />
          </button>
          <button className="exp-mgmt-btn-columns" onClick={() => setShowColPanel(v => !v)}>
            <GripVertical size={14} /> Columns
          </button>
        </div>
      </div>

      {/* ── Column Panel ────────────────────────────────────────────────────── */}
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
        ].map(([tab, lbl, icon]) => (
          <button key={tab} className={`exp-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {icon} {lbl}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EXPENSES TABLE — with responsive scroll wrapper + data-label attrs
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="exp-mgmt-table-container">
          {/* scroll wrapper enables horizontal scroll on medium screens */}
          <div className="exp-table-scroll-wrapper">
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
                  <tr key={exp.id} className="exp-mgmt-table-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleViewExpense(exp)}>
                    {columns.filter(c => c.visible).map(col => (
                      <td
                        key={col.key}
                        data-label={col.label}
                        className={col.key === 'actions' ? 'actions-td' : ''}
                        onClick={col.key === 'actions' ? (e) => e.stopPropagation() : undefined}
                      >
                        {renderCell(col, exp)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{/* end exp-table-scroll-wrapper */}

          {/* Pagination */}
          {/* Pagination */}
          <div className="table-footer">
            <div className="pagination-info">
              <span>
                Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} expenses
              </span>
              <select
                className="page-size-selector"
                value={pageSize}
                onChange={handlePageSizeChange}
              >
                <option value={10}>10 Rows</option>
                <option value={20}>20 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
              </select>
            </div>
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


      {showCreateModal && expenseFormData && (() => {
        const grp  = modalGroupName;
        const sub  = modalSubGroupName;
        const total = (expenseFormData.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const pendingAdvances = []; // advance feature removed

        const addItem = () => {
          const newId = Date.now();
          setExpenseFormData(prev => ({
            ...prev,
            expenseItems: [...prev.expenseItems, {
              id: newId, category: 'Travel', projectId: prev.projectId || '', amount: '', paymentMode: 'UPI', description: '',
            }],
          }));
          if (grp && sub) loadItemProjects(newId, grp, sub);
        };

        const removeItem = (id) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.filter(i => i.id !== id),
        }));

        const updateItem = (id, field, val) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.map(i => i.id === id ? { ...i, [field]: val } : i),
        }));

        return (
          <div className="exp-mgmt-modal-overlay">
            <div className="exp-modal-redesigned" onClick={e => e.stopPropagation()}>
              {/* ── Header ── */}
              <div className="exp-modal-hdr">
                <div className="exp-modal-hdr-left">
                  <Receipt size={20} />
                  <div>
                    <h2>Add Expense Entry</h2>
                    <p>Each item can be assigned to a different project</p>
                  </div>
                </div>
                <button className="exp-modal-close-x" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
              </div>

              <div className="exp-modal-body">
                {/* ── Section 1: Group / SubGroup ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">1</span> Scope</div>
                  <div className="exp-form-row2">
                    <div className="exp-field">
                      <label>Group *</label>
                      <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}</option>
                        {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="exp-field">
                      <label>Sub-Group *</label>
                      <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                        <option value="">{!modalGroupName ? 'Select group first' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Sub-Group'}</option>
                        {modalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {modalSubGroupName && (
                    <div className="exp-scope-hint">
                      <span>✓ Projects loaded — assign each expense item to a project below</span>
                    </div>
                  )}
                </div>

                {/* ── Section 2: Expense Info ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">2</span> Expense Info</div>
                  <div className="exp-form-row3">
                    <div className="exp-field">
                      <label>Date *</label>
                      <input type="date" value={expenseFormData.tripDate}
                        onChange={e => setExpenseFormData(p => ({ ...p, tripDate: e.target.value }))} />
                    </div>
                    <div className="exp-field">
                      <label>Paid By</label>
                      <select value={expenseFormData.paidByUserId}
                        onChange={e => {
                          const u = availableUsers.find(u => String(u.id) === e.target.value);
                          setExpenseFormData(p => ({ ...p, paidByUserId: e.target.value, paidByName: u?.name || '' }));
                        }}>
                        <option value="">Select user</option>
                        {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="exp-field">
                      <label>Purpose / Description</label>
                      <input type="text" value={expenseFormData.tripReason} placeholder="e.g. Site visit, material transport…"
                        onChange={e => setExpenseFormData(p => ({ ...p, tripReason: e.target.value }))} />
                    </div>
                  </div>
                  <div className="exp-form-row2" style={{marginTop:10}}>
                    <div className="exp-field">
                      <label>Status</label>
                      <select value={expenseFormData.status || 'Approved'}
                        onChange={e => setExpenseFormData(p => ({ ...p, status: e.target.value }))}
                        style={{borderColor: expenseFormData.status === 'Approved' ? '#16a34a' : expenseFormData.status === 'Rejected' ? '#dc2626' : '#f59e0b'}}>
                        <option value="Approved">✅ Approved</option>
                        <option value="Pending">⏳ Pending</option>
                        <option value="Rejected">❌ Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Expense Items ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label-row">
                    <div className="exp-section-label"><span className="exp-section-num">3</span> Expense Items</div>
                    <button className="exp-add-item-btn" onClick={addItem} disabled={!modalSubGroupName}>
                      <Plus size={13} /> Add Item
                    </button>
                  </div>

                  {!modalSubGroupName && (
                    <div className="exp-items-hint">Select Group + Sub-Group first to assign projects per item</div>
                  )}

                  <div className="exp-items-list">
                    {(expenseFormData.expenseItems || []).map((item, idx) => {
                      const projList = itemProjects[item.id] || modalProjects;
                      const isLoading = itemProjectsLoading[item.id];
                      return (
                        <div key={item.id} className="exp-item-row">
                          <div className="exp-item-row-num">#{idx + 1}</div>
                          <div className="exp-item-fields">
                            <div className="exp-item-top-row">
                              <div className="exp-field exp-field-sm">
                                <label>Category *</label>
                                <select
                                  value={EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Other'}
                                  onChange={e => updateItem(item.id, 'category', e.target.value === 'Other' ? '' : e.target.value)}>
                                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                                {(!EXPENSE_CATEGORIES.slice(0,-1).includes(item.category)) && (
                                  <input
                                    type="text"
                                    className="exp-other-input"
                                    placeholder="Specify category…"
                                    value={EXPENSE_CATEGORIES.includes(item.category) ? '' : item.category}
                                    onChange={e => updateItem(item.id, 'category', e.target.value)}
                                    autoFocus
                                  />
                                )}
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Amount (₹) *</label>
                                <input type="number" step="0.01" min="0" placeholder="0.00" value={item.amount}
                                  onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Payment Mode</label>
                                <select value={item.paymentMode} onChange={e => updateItem(item.id, 'paymentMode', e.target.value)}>
                                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{formatPaymentMode(m)}</option>)}
                                </select>
                              </div>
                              <div className="exp-field exp-field-proj">
                                <label>Project * <span className="exp-field-hint">(required)</span></label>
                                <select value={item.projectId}
                                  onChange={e => updateItem(item.id, 'projectId', e.target.value)}
                                  disabled={!modalSubGroupName || isLoading}
                                  style={!item.projectId ? {borderColor:'#ef4444',boxShadow:'0 0 0 2px rgba(239,68,68,.15)'} : {}}>
                                  <option value="">{isLoading ? 'Loading…' : !modalSubGroupName ? 'Select sub-group first' : '— Select Project *'}</option>
                                  {projList.map(p => (
                                    <option key={p.id} value={String(p.id)}>{p.name}{p.location ? ` – ${p.location}` : ''}</option>
                                  ))}
                                </select>
                              </div>
                              {expenseFormData.expenseItems.length > 1 && (
                                <button className="exp-item-del-btn" onClick={() => removeItem(item.id)} title="Remove item">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            <div className="exp-field" style={{marginTop:4}}>
                              <input type="text" placeholder="Notes / description for this item…" value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="exp-items-total-bar">
                    <span>
                      Total — {(() => {
                        const projSet = new Set((expenseFormData.expenseItems||[]).filter(i=>i.projectId).map(i=>i.projectId));
                        return projSet.size > 1
                          ? <span style={{color:'#1d4ed8',fontWeight:600}}>splits into {projSet.size} separate project expenses on save</span>
                          : <span style={{color:'#64748b'}}>1 expense record</span>;
                      })()}
                    </span>
                    <strong className="exp-total-amt">{fmt(total)}</strong>
                  </div>
                </div>

                {/* ── Section 4: Bill Upload ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">4</span> Bill / Receipt Upload <span className="exp-field-hint">(max 10 MB)</span></div>
                  <div className="exp-bill-upload-area"
                    onClick={() => billInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setBillFile(f); }}>
                    <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
                      onChange={e => setBillFile(e.target.files[0] || null)} />
                    {billFile ? (
                      <div className="exp-bill-selected">
                        <FileText size={18} />
                        <span>{billFile.name}</span>
                        <span className="exp-bill-size">({(billFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button onClick={e => { e.stopPropagation(); setBillFile(null); }}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="exp-bill-empty">
                        <Receipt size={22} />
                        <span>Click or drag to upload bill / receipt</span>
                        <small>PDF, JPG, PNG — max 10 MB</small>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Section 5: Advance Adjustment ── */}
                {pendingAdvances.length > 0 && (
                  <div className="exp-modal-section">
                    <div className="exp-section-label"><span className="exp-section-num">5</span> Adjust Advance <span className="exp-field-hint">(optional)</span></div>
                    <div className="exp-form-row2">
                      <div className="exp-field">
                        <label>Select Advance to Adjust</label>
                        <select value={expenseFormData.adjustedAdvanceId || ''}
                          onChange={e => setExpenseFormData(p => ({ ...p, adjustedAdvanceId: e.target.value }))}>
                          <option value="">— No advance adjustment —</option>
                          {pendingAdvances.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.advanceCode} — {fmt(a.totalAmount)} ({a.projectId || a.groupName}) — {a.status}
                            </option>
                          ))}
                        </select>
                      </div>
                      {expenseFormData.adjustedAdvanceId && (
                        <div className="exp-field">
                          <label>Amount to Adjust (₹)</label>
                          <input type="number" min="0" step="0.01" placeholder="0.00"
                            value={expenseFormData.advanceAdjustedAmount || ''}
                            onChange={e => setExpenseFormData(p => ({ ...p, advanceAdjustedAmount: e.target.value }))} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="exp-modal-footer">
                <div className="exp-modal-footer-left">
                  {(() => {
                    const items = expenseFormData.expenseItems || [];
                    const projSet = new Set(items.filter(i => i.projectId).map(i => i.projectId));
                    const unassigned = items.filter(i => !i.projectId).length;
                    return (
                      <span className="exp-footer-total">
                        {items.length} item(s) · {fmt(total)}
                        {projSet.size > 1 && <span style={{color:'#1d4ed8',marginLeft:8}}>→ {projSet.size} project records</span>}
                        {unassigned > 0 && <span style={{color:'#ef4444',marginLeft:8}}>⚠ {unassigned} item(s) need a project</span>}
                      </span>
                    );
                  })()}
                  {billFile && <span className="exp-footer-bill"><Receipt size={12} /> {billFile.name}</span>}
                </div>
                <div className="exp-modal-footer-right">
                  <button className="exp-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button className="exp-btn-primary" onClick={handleCreateExpense} disabled={loading || billUploading}>
                    {loading || billUploading ? 'Saving…' : `Save ${expenseFormData.expenseItems.length} Expense(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT EXPENSE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showEditModal && expenseFormData && (() => {
        const grp  = modalGroupName;
        const sub  = modalSubGroupName;
        const total = (expenseFormData.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        const addItem = () => {
          const newId = Date.now();
          setExpenseFormData(prev => ({
            ...prev,
            expenseItems: [...prev.expenseItems, {
              id: newId, category: 'Travel', projectId: prev.projectId || '', amount: '', paymentMode: 'UPI', description: '',
            }],
          }));
          if (grp && sub) loadItemProjects(newId, grp, sub);
        };

        const removeItem = (id) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.filter(i => i.id !== id),
        }));

        const updateItem = (id, field, val) => setExpenseFormData(prev => ({
          ...prev, expenseItems: prev.expenseItems.map(i => i.id === id ? { ...i, [field]: val } : i),
        }));

        return (
          <div className="exp-mgmt-modal-overlay">
            <div className="exp-modal-redesigned" onClick={e => e.stopPropagation()}>
              {/* ── Header ── */}
              <div className="exp-modal-hdr">
                <div className="exp-modal-hdr-left">
                  <Edit2 size={20} />
                  <div>
                    <h2>Edit Expense — {expenseFormData.expenseCode || `#${expenseFormData.id}`}</h2>
                    <p>Update expense details, items, or upload a new bill</p>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {canApprove && expenseFormData.status === 'Pending' && (
                    <>
                      <button className="exp-btn-approve" onClick={() => { performStatusChange(expenseFormData.id, 'Approved'); setShowEditModal(false); }}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button className="exp-btn-reject" onClick={() => { performStatusChange(expenseFormData.id, 'Rejected'); setShowEditModal(false); }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
                  <button className="exp-modal-close-x" onClick={() => setShowEditModal(false)}><X size={18} /></button>
                </div>
              </div>

              <div className="exp-modal-body">
                {/* ── Section 1: Scope ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">1</span> Scope</div>
                  <div className="exp-form-row2">
                    <div className="exp-field">
                      <label>Group *</label>
                      <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                        <option value="">{modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}</option>
                        {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div className="exp-field">
                      <label>Sub-Group *</label>
                      <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                        <option value="">{!modalGroupName ? 'Select group first' : 'Select Sub-Group'}</option>
                        {modalSubGroups.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Expense Info ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">2</span> Expense Info</div>
                  <div className="exp-form-row3">
                    <div className="exp-field">
                      <label>Date *</label>
                      <input type="date" value={expenseFormData.tripDate}
                        onChange={e => setExpenseFormData(p => ({ ...p, tripDate: e.target.value }))} />
                    </div>
                    <div className="exp-field">
                      <label>Paid By</label>
                      <select value={expenseFormData.paidByUserId}
                        onChange={e => {
                          const u = availableUsers.find(u => String(u.id) === e.target.value);
                          setExpenseFormData(p => ({ ...p, paidByUserId: e.target.value, paidByName: u?.name || '' }));
                        }}>
                        <option value="">Select user</option>
                        {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="exp-field">
                      <label>Status</label>
                      <select value={expenseFormData.status}
                        onChange={e => setExpenseFormData(p => ({ ...p, status: e.target.value }))}
                        disabled={!canApprove && expenseFormData.status !== 'Pending'}>
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="exp-field" style={{marginTop:8}}>
                    <label>Purpose / Description</label>
                    <input type="text" value={expenseFormData.tripReason} placeholder="e.g. Site visit, material transport…"
                      onChange={e => setExpenseFormData(p => ({ ...p, tripReason: e.target.value }))} />
                  </div>
                </div>

                {/* ── Section 3: Expense Items ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label-row">
                    <div className="exp-section-label"><span className="exp-section-num">3</span> Expense Items</div>
                    <button className="exp-add-item-btn" onClick={addItem}><Plus size={13} /> Add Item</button>
                  </div>
                  <div className="exp-items-list">
                    {(expenseFormData.expenseItems || []).map((item, idx) => {
                      const projList = itemProjects[item.id] || modalProjects;
                      const isLoading = itemProjectsLoading[item.id];
                      return (
                        <div key={item.id} className="exp-item-row">
                          <div className="exp-item-row-num">#{idx + 1}</div>
                          <div className="exp-item-fields">
                            <div className="exp-item-top-row">
                              <div className="exp-field exp-field-sm">
                                <label>Category *</label>
                                <select
                                  value={EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Other'}
                                  onChange={e => updateItem(item.id, 'category', e.target.value === 'Other' ? '' : e.target.value)}>
                                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                                {(!EXPENSE_CATEGORIES.slice(0,-1).includes(item.category)) && (
                                  <input
                                    type="text"
                                    className="exp-other-input"
                                    placeholder="Specify category…"
                                    value={EXPENSE_CATEGORIES.includes(item.category) ? '' : item.category}
                                    onChange={e => updateItem(item.id, 'category', e.target.value)}
                                    autoFocus
                                  />
                                )}
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Amount (₹) *</label>
                                <input type="number" step="0.01" min="0" value={item.amount}
                                  onChange={e => updateItem(item.id, 'amount', e.target.value)} />
                              </div>
                              <div className="exp-field exp-field-sm">
                                <label>Payment Mode</label>
                                <select value={item.paymentMode} onChange={e => updateItem(item.id, 'paymentMode', e.target.value)}>
                                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{formatPaymentMode(m)}</option>)}
                                </select>
                              </div>
                              <div className="exp-field exp-field-proj">
                                <label>Project * <span className="exp-field-hint">(required)</span></label>
                                <select value={item.projectId}
                                  onChange={e => updateItem(item.id, 'projectId', e.target.value)}
                                  disabled={isLoading}
                                  style={!item.projectId ? {borderColor:'#ef4444',boxShadow:'0 0 0 2px rgba(239,68,68,.15)'} : {}}>
                                  <option value="">{isLoading ? 'Loading…' : '— Select Project *'}</option>
                                  {projList.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                                  {/* Show current project if not yet in list */}
                                  {item.projectId && !projList.find(p => String(p.id) === String(item.projectId)) && !isLoading && (
                                    <option key={item.projectId} value={item.projectId}>Project #{item.projectId} (current)</option>
                                  )}
                                </select>
                              </div>
                              {expenseFormData.expenseItems.length > 1 && (
                                <button className="exp-item-del-btn" onClick={() => removeItem(item.id)}><Trash2 size={13} /></button>
                              )}
                            </div>
                            <div className="exp-field" style={{marginTop:4}}>
                              <input type="text" placeholder="Notes…" value={item.description}
                                onChange={e => updateItem(item.id, 'description', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="exp-items-total-bar">
                    <span>
                      Total — {(() => {
                        const projSet = new Set((expenseFormData.expenseItems||[]).filter(i=>i.projectId).map(i=>i.projectId));
                        return projSet.size > 1
                          ? <span style={{color:'#1d4ed8',fontWeight:600}}>splits into {projSet.size} separate project expenses on save</span>
                          : <span style={{color:'#64748b'}}>1 expense record</span>;
                      })()}
                    </span>
                    <strong className="exp-total-amt">{fmt(total)}</strong>
                  </div>
                </div>

                {/* ── Section 4: Bill Upload ── */}
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">4</span> Bill / Receipt</div>
                  {expenseFormData.receiptUrl && (
                    <div className="exp-existing-bill">
                      <FileText size={14} /> Current bill on file &nbsp;
                      <a href={expenseFormData.receiptUrl} target="_blank" rel="noreferrer">View</a>
                    </div>
                  )}
                  <div className="exp-bill-upload-area"
                    onClick={() => billInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setBillFile(f); }}>
                    <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
                      onChange={e => setBillFile(e.target.files[0] || null)} />
                    {billFile ? (
                      <div className="exp-bill-selected">
                        <FileText size={18} /><span>{billFile.name}</span>
                        <span className="exp-bill-size">({(billFile.size/1024/1024).toFixed(2)} MB)</span>
                        <button onClick={e => { e.stopPropagation(); setBillFile(null); }}><X size={14}/></button>
                      </div>
                    ) : (
                      <div className="exp-bill-empty">
                        <Receipt size={22}/><span>{expenseFormData.receiptUrl ? 'Upload replacement bill' : 'Upload bill / receipt'}</span>
                        <small>PDF, JPG, PNG — max 10 MB</small>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Approval section for managers ── */}
                {canApprove && (
                  <div className="exp-modal-section exp-approval-section">
                    <div className="exp-section-label"><span className="exp-section-num">5</span> Approval</div>
                    <div className="exp-approval-info">
                      <span>Status: <strong><StatusBadge s={expenseFormData.status} /></strong></span>
                      <span className="exp-approval-hint">You can approve or reject using the buttons in the header above.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="exp-modal-footer">
                <div className="exp-modal-footer-left">
                  <span className="exp-footer-total">{(expenseFormData.expenseItems || []).length} item(s) · {fmt(total)}</span>
                </div>
                <div className="exp-modal-footer-right">
                  <button className="exp-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button className="exp-btn-primary" onClick={handleUpdateExpense} disabled={loading || billUploading}>
                    {loading || billUploading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          ADVANCE MODAL
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ══ SINGLE PAYMENT MODAL ═══════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW EXPENSE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showViewModal && viewModalExpense && (
        <div className="exp-mgmt-modal-overlay">
          <div className="exp-view-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="exp-modal-hdr">
              <div className="exp-modal-hdr-left">
                <Eye size={20} />
                <div>
                  <h2>Expense — {viewModalExpense.expenseCode || `#${viewModalExpense.id}`}</h2>
                  <p>{fmtDate(viewModalExpense.tripDate)}{viewModalExpense.paidByName ? ` · Paid by ${viewModalExpense.paidByName}` : ''}</p>
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button className="exp-btn-approve" onClick={() => { setShowViewModal(false); handleEditExpense(viewModalExpense); }}>
                  <Edit2 size={13} /> Edit
                </button>
                <button className="exp-modal-close-x" onClick={() => setShowViewModal(false)}><X size={18} /></button>
              </div>
            </div>

            {/* Body */}
            <div className="exp-modal-body">
              {/* Status + Group Info */}
              <div className="exp-modal-section">
                <div className="exp-section-label"><span className="exp-section-num">1</span> Overview</div>
                <div className="exp-view-grid">
                  <div className="exp-view-item">
                    <span className="exp-view-label">Status</span>
                    <span><StatusBadge s={viewModalExpense.status} /></span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Date</span>
                    <span className="exp-view-val">{fmtDate(viewModalExpense.tripDate)}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Group</span>
                    <span className="exp-view-val">{viewModalExpense.groupName || '—'}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Sub-Group</span>
                    <span className="exp-view-val">{viewModalExpense.subGroupName || '—'}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Paid By</span>
                    <span className="exp-view-val">{viewModalExpense.paidByName || '—'}</span>
                  </div>
                  <div className="exp-view-item">
                    <span className="exp-view-label">Total</span>
                    <span className="exp-view-val" style={{fontWeight:700,color:'#15803d',fontSize:15}}>{fmt(viewModalExpense.totalAmount)}</span>
                  </div>
                  {viewModalExpense.tripReason && (
                    <div className="exp-view-item exp-view-full">
                      <span className="exp-view-label">Purpose</span>
                      <span className="exp-view-val">{viewModalExpense.tripReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Items */}
              <div className="exp-modal-section">
                <div className="exp-section-label"><span className="exp-section-num">2</span> Expense Items</div>
                <table className="exp-view-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Mode</th>
                      <th style={{textAlign:'right'}}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewModalExpense.expenseItems || []).map((item, i) => (
                      <tr key={i}>
                        <td style={{color:'#94a3b8',fontSize:12}}>{i+1}</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <CategoryIcon cat={item.category} />
                            <span style={{fontWeight:500}}>{item.category}</span>
                          </div>
                        </td>
                        <td style={{color:'#64748b'}}>{item.description || '—'}</td>
                        <td style={{color:'#64748b'}}>
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <CreditCard size={12} />{formatPaymentMode(item.paymentMode)}
                          </div>
                        </td>
                        <td style={{textAlign:'right',fontWeight:700}}>{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{fontWeight:600,color:'#374151',padding:'10px 12px'}}>Total</td>
                      <td style={{textAlign:'right',fontWeight:800,fontSize:15,color:'#111827',padding:'10px 12px'}}>
                        {fmt((viewModalExpense.expenseItems||[]).reduce((s,i)=>s+(parseFloat(i.amount)||0),0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Receipt */}
              {viewModalExpense.receiptUrl && (
                <div className="exp-modal-section">
                  <div className="exp-section-label"><span className="exp-section-num">3</span> Bill / Receipt</div>
                  <a href={viewModalExpense.receiptUrl} target="_blank" rel="noreferrer" className="exp-receipt-link">
                    <FileText size={14} /> View Receipt
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="exp-modal-footer">
              <div className="exp-modal-footer-left">
                <span className="exp-footer-total">{(viewModalExpense.expenseItems||[]).length} item(s) · {fmt(viewModalExpense.totalAmount)}</span>
              </div>
              <div className="exp-modal-footer-right">
                {canApprove && viewModalExpense.status === 'Pending' && (
                  <>
                    <button className="exp-btn-approve" onClick={() => { handleStatusChange(viewModalExpense.id,'Approved'); setShowViewModal(false); }}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button className="exp-btn-reject" onClick={() => { handleStatusChange(viewModalExpense.id,'Rejected'); setShowViewModal(false); }}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                <button className="exp-btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

{showItemsModal && itemsModalExpense && (
        <div className="exp-mgmt-modal-overlay">
          <div className="exp-items-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exp-mgmt-modal-header">
              <div>
                <h2>Expense Items — {itemsModalExpense.expenseCode}</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
                  {fmtDate(itemsModalExpense.tripDate)}
                  {itemsModalExpense.paidByName ? ` · Paid by ${itemsModalExpense.paidByName}` : ''}
                  {itemsModalExpense.tripReason ? ` · ${itemsModalExpense.tripReason}` : ''}
                </p>
              </div>
              <button className="exp-mgmt-modal-close" onClick={() => setShowItemsModal(false)}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Mode</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(itemsModalExpense.expenseItems || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', color: '#94a3b8', fontSize: 13 }}>{i + 1}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <CategoryIcon cat={item.category} />
                          <span style={{ fontWeight: 500 }}>{item.category}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{item.description || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                          <CreditCard size={13} />{formatPaymentMode(item.paymentMode)}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <td colSpan={4} style={{ padding: '12px', fontWeight: 600, color: '#374151' }}>Total</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#111827', fontSize: 15 }}>
                      {fmt((itemsModalExpense.expenseItems || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectCostExpenseManagement;