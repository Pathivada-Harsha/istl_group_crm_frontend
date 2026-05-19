import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, Filter, Download, Plus, X, Edit2, Eye, Star, TrendingUp,
  DollarSign, IndianRupee, Package, Calendar, Phone, Mail, MapPin,
  ShoppingCart, FileText, CheckCircle, Clock, Building2, User, Tag,
  Briefcase, Truck, ChevronUp, ChevronDown, ChevronsUpDown, Columns,
  GripVertical, Check, Trash2
} from 'lucide-react';
import '../pages-css/Procurement-Vendor-Management.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal.js';
import vendorApi from '../services/vendorApi';
import filterApi from '../services/filterApi';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const VENDOR_CATEGORIES = ['IT Equipment', 'Office Furniture', 'Manufacturing', 'Office Supplies', 'Services'];
const VENDOR_TYPES      = ['Manufacturer', 'Distributor', 'Service Provider'];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
];


// ─── Column Definitions ───────────────────────────────────────────────────────
const DEFAULT_COLUMNS = [
  { id: 'name',               label: 'Vendor Name',          sortable: true,  visible: true  },
  { id: 'contact',            label: 'Contact',              sortable: false, visible: true  },
  { id: 'category',           label: 'Category',             sortable: true,  visible: false },
  { id: 'rating',             label: 'Rating',               sortable: true,  visible: true  },
  { id: 'totalOrders',        label: 'Total Orders',         sortable: true,  visible: true  },
  { id: 'totalPurchaseValue', label: 'Total Purchase Value', sortable: true,  visible: true  },
  { id: 'lastPurchaseDate',   label: 'Last Purchase',        sortable: true,  visible: true  },
  { id: 'status',             label: 'Status',               sortable: true,  visible: true  },
  { id: 'group',              label: 'Group',                sortable: false, visible: false },
  { id: 'project',            label: 'Project',              sortable: false, visible: true  },
  { id: 'actions',            label: 'Actions',              sortable: false, visible: true  },
];

// ─── Sort Icon Component ──────────────────────────────────────────────────────
const SortIcon = ({ columnId, sortConfig }) => {
  if (!sortConfig || sortConfig.key !== columnId) {
    return <ChevronsUpDown size={13} className="sort-icon sort-icon--idle" />;
  }
  return sortConfig.direction === 'asc'
    ? <ChevronUp   size={13} className="sort-icon sort-icon--active" />
    : <ChevronDown size={13} className="sort-icon sort-icon--active" />;
};

// ─── Columns Picker Dropdown ──────────────────────────────────────────────────
const ColumnsPicker = ({ columns, onToggle, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="columns-picker" ref={ref}>
      <div className="columns-picker__header">
        <span>Show / Hide Columns</span>
        <button className="columns-picker__close" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="columns-picker__list">
        {columns.map((col) => (
          <button
            key={col.id}
            className={`columns-picker__item ${col.visible ? 'columns-picker__item--checked' : ''}`}
            onClick={() => col.id !== 'actions' && onToggle(col.id)}
            disabled={col.id === 'actions'}
            title={col.id === 'actions' ? 'Actions column is always visible' : ''}
          >
            <span className="columns-picker__checkbox">
              {col.visible && <Check size={11} />}
            </span>
            {col.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Draggable TH ────────────────────────────────────────────────────────────
const DraggableTH = ({ col, index, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, sortConfig, onSort, children }) => {
  return (
    <th
      draggable={col.id !== 'actions'}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`
        vendor-management-table__th
        ${isDragOver ? 'vendor-management-table__th--drag-over' : ''}
        ${col.sortable ? 'vendor-management-table__th--sortable' : ''}
      `}
      onClick={() => col.sortable && onSort(col.id)}
    >
      <span className="th-inner">
        {col.id !== 'actions' && (
          <span className="drag-handle" title="Drag to reorder">
            <GripVertical size={13} />
          </span>
        )}
        <span className="th-label">{col.label}</span>
        {col.sortable && <SortIcon columnId={col.id} sortConfig={sortConfig} />}
      </span>
    </th>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions, isAccountsExecutive } = useAuth();
  const vendorPerms = pagePermissions?.VENDORS || [];
  const canView     = vendorPerms.includes('VIEW')   || isAccountsExecutive;
  const canCreate   = vendorPerms.includes('CREATE') || isAccountsExecutive;
  const canEdit     = vendorPerms.includes('EDIT')   || isAccountsExecutive;
  const canDelete   = vendorPerms.includes('DELETE') && !isAccountsExecutive;
  const isViewOnly  = canView && !canCreate && !canEdit && !canDelete;
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, vendorId: null, vendorName: '' });

  // ── Column state ──
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColumnsPicker, setShowColumnsPicker] = useState(false);
  const columnsPickerBtnRef = useRef(null);

  // ── Drag state ──
  const dragSrcIndex = useRef(null);

  // ── Sort state ──
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const [filters, setFilters] = useState({
    search: '', category: 'all', vendorType: 'all',
    rating: 'all', status: 'all',
    groupName: '', subGroupName: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorPurchaseOrders, setVendorPurchaseOrders] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // "Other" custom inputs for category and vendor type — shared between create & edit modals
  const [customCategory, setCustomCategory]     = useState('');
  const [customVendorType, setCustomVendorType] = useState('');

  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });
  const [availableUsers, setAvailableUsers] = useState([]);

  // ─── Fetch on filter / sort / page change ──────────────────────────────────
  // ─── Main data loader — AbortController pattern (mirrors Bills-Recieved.js) ──
  // Both the vendor list and KPI stats are fetched simultaneously via Promise.all
  // sharing one AbortController signal. When any filter/page/sort dep changes,
  // React's cleanup cancels the in-flight pair before starting a fresh one.
  // This eliminates the race-condition where a slow earlier response (e.g. search='T')
  // could arrive after a faster later response (search='Test Vender From PO') and
  // silently overwrite the correct KPI values with stale/broader data.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadAll = async () => {
      setLoading(true);
      try {
        const sortKeyMap = {
          name: 'name', category: 'category', rating: 'rating',
          totalOrders: 'totalOrders', totalPurchaseValue: 'totalPurchaseValue',
          lastPurchaseDate: 'lastPurchaseDate', status: 'status', createdAt: 'createdAt',
        };

        // Resolve active group/project (same logic used in standalone fetchVendors/fetchStats)
        const activeGroup    = filters.groupName    || groupName    || null;
        const activeSubGroup = filters.subGroupName || subGroupName || null;
        const activeProject  = projectId || null;

        // Build vendor-list query params
        const vendorParams = new URLSearchParams({
          page: currentPage, size: pageSize,
          sortBy: sortKeyMap[sortConfig.key] || 'createdAt',
          sortDirection: sortConfig.direction.toUpperCase()
        });
        if (activeGroup)    vendorParams.append('groupName',    activeGroup);
        if (activeSubGroup) vendorParams.append('subGroupName', activeSubGroup);
        if (activeProject)  vendorParams.append('projectId',    activeProject);
        if (filters.status   !== 'all') vendorParams.append('status',      filters.status);
        if (filters.category !== 'all') vendorParams.append('category',    filters.category);
        if (filters.search)              vendorParams.append('searchTerm',  filters.search.trim());

        // Build stats query params (same filters, no pagination/sort)
        const statsParams = new URLSearchParams();
        if (activeGroup)    statsParams.append('groupName',    activeGroup);
        if (activeSubGroup) statsParams.append('subGroupName', activeSubGroup);
        if (activeProject)  statsParams.append('projectId',    activeProject);
        if (filters.status   !== 'all') statsParams.append('status',      filters.status);
        if (filters.category !== 'all') statsParams.append('category',    filters.category);
        if (filters.search)              statsParams.append('searchTerm',  filters.search.trim());

        // Fire both requests simultaneously; share the same abort signal
        const [vendorRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/vendors?${vendorParams}`,      { headers: getAuthHeaders(), credentials: 'include', signal }),
          fetch(`${API_BASE_URL}/vendors/stats?${statsParams}`, { headers: getAuthHeaders(), credentials: 'include', signal })
        ]);

        if (!signal.aborted) {
          if (vendorRes.ok) {
            const data = await vendorRes.json();
            setVendors(data.vendors || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
          } else {
            showError('Failed to load vendors');
            setVendors([]);
          }
          if (statsRes.ok) {
            const data = await statsRes.json();
            setStats(data);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // cancelled by dep change — ignore
        showError('Failed to load vendors');
        setVendors([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    loadAll();
    return () => controller.abort(); // cancel previous in-flight requests on re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, filters.search, filters.status, filters.category, filters.groupName, filters.subGroupName, sortConfig, groupName, subGroupName, projectId]);

  // ─── Column helpers ────────────────────────────────────────────────────────
  const visibleColumns = columns.filter((c) => c.visible);

  const toggleColumnVisibility = useCallback((colId) => {
    setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, visible: !c.visible } : c));
  }, []);

  // ─── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((colId) => {
    setSortConfig((prev) => {
      if (prev.key === colId) {
        return { key: colId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: colId, direction: 'asc' };
    });
    setCurrentPage(0);
  }, []);

  // ─── Drag-and-drop columns ─────────────────────────────────────────────────
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    dragSrcIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const srcIndex = dragSrcIndex.current;
    if (srcIndex === null || srcIndex === dropIndex) return;

    // We work on the FULL columns array to maintain stable reordering
    const visibleIds = visibleColumns.map((c) => c.id);
    const srcId   = visibleIds[srcIndex];
    const dropId  = visibleIds[dropIndex];

    setColumns((prev) => {
      const next = [...prev];
      const fromFull = next.findIndex((c) => c.id === srcId);
      const toFull   = next.findIndex((c) => c.id === dropId);
      const [moved]  = next.splice(fromFull, 1);
      next.splice(toFull, 0, moved);
      return next;
    });

    setDragOverIndex(null);
    dragSrcIndex.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragSrcIndex.current = null;
  };

  // ─── Auth headers ──────────────────────────────────────────────────────────
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole')
  });

  // ─── API calls (unchanged logic, just sortConfig wired in) ─────────────────
  const fetchAvailableUsers = async () => {
    try {
      const users = await filterApi.getLeadsUsers();
      setAvailableUsers(users);
    } catch (error) { console.error('Failed to fetch users:', error); }
  };

  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const groups = await filterApi.getAllGroups();
      setModalGroups(groups);
    } catch (error) { showError('Failed to load groups'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchModalSubGroups = async (groupName) => {
    if (!groupName) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const subGroups = await filterApi.getSubGroups(groupName);
      setModalSubGroups(subGroups);
    } catch (error) { showError('Failed to load categories'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchModalProjects = async (groupName, subGroupName) => {
    if (!groupName || !subGroupName) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const projects = await filterApi.getProjects(groupName, subGroupName);
      setModalProjects(projects);
    } catch (error) { showError('Failed to load projects'); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const handlePageSizeChange = (e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); };

  const handleModalGroupChange = (e) => {
    const newGroupName = e.target.value;
    setModalGroupName(newGroupName);
    setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]);
    setEditFormData(prev => ({ ...prev, groupName: newGroupName, subGroupName: '', projectId: '' }));
    if (newGroupName) fetchModalSubGroups(newGroupName);
  };

  const handleModalSubGroupChange = (e) => {
    const newSubGroupName = e.target.value;
    setModalSubGroupName(newSubGroupName); setModalProjectId(''); setModalProjects([]);
    setEditFormData(prev => ({ ...prev, subGroupName: newSubGroupName, projectId: '' }));
    if (modalGroupName && newSubGroupName) fetchModalProjects(modalGroupName, newSubGroupName);
  };

  const handleModalProjectChange = (e) => {
    const newProjectId = e.target.value;
    setModalProjectId(newProjectId);
    setEditFormData(prev => ({ ...prev, projectId: newProjectId }));
  };

  const handleAddNewVendor = () => {
    setEditFormData({
      name: '', contactPerson: '', email: '', phone: '', website: '', gstNumber: '',
      address: '', city: '', state: '', pincode: '', rating: 0, status: 'Active',
      groupName: '', subGroupName: '', projectId: '', vendorType: '', category: '', notes: '', assignedTo: ''
    });
    setCustomCategory('');
    setCustomVendorType('');
    setModalGroupName(''); setModalSubGroupName(''); setModalProjectId('');
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);
    fetchModalGroups();
    setShowCreateModal(true);
  };

  const handleCreateVendor = async () => {
    if (!editFormData.name?.trim()) { showError('Vendor name is required'); return; }
    if (!editFormData.phone?.trim()) { showError('Phone / Contact number is required'); return; }
    if (!editFormData.category) { showError('Category is required'); return; }
    if (editFormData.category === 'Other' && !customCategory.trim()) { showError('Please enter a custom category'); return; }
    if (!editFormData.vendorType) { showError('Vendor type is required'); return; }
    if (editFormData.vendorType === 'Other' && !customVendorType.trim()) { showError('Please enter a custom vendor type'); return; }
    // Email is optional — validate format only if provided
    if (editFormData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editFormData.email)) { showError('Please enter a valid email address'); return; }
    }

    setLoading(true);
    try {
      const payload = {
        ...editFormData,
        email:      editFormData.email?.trim() || null,
        category:   editFormData.category   === 'Other' ? customCategory.trim()   : editFormData.category,
        vendorType: editFormData.vendorType === 'Other' ? customVendorType.trim() : editFormData.vendorType,
      };
      await vendorApi.createVendor(payload);
      showSuccess('Vendor created successfully!');
      setShowCreateModal(false);
      fetchVendors(); fetchStats();
    } catch (error) { showError(error.message || 'Failed to create vendor'); }
    finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const sortKeyMap = {
        name: 'name', category: 'category', rating: 'rating',
        totalOrders: 'totalOrders', totalPurchaseValue: 'totalPurchaseValue',
        lastPurchaseDate: 'lastPurchaseDate', status: 'status', createdAt: 'createdAt',
      };
      const params = new URLSearchParams({
        page: currentPage, size: pageSize,
        sortBy: sortKeyMap[sortConfig.key] || 'createdAt',
        sortDirection: sortConfig.direction.toUpperCase()
      });
      // Use same active group/project resolution as fetchStats so both
      // the vendor list and the KPI cards always filter by the same scope.
      const activeGroup    = filters.groupName    || groupName    || null;
      const activeSubGroup = filters.subGroupName || subGroupName || null;
      const activeProject  = projectId || null;
      if (activeGroup)    params.append('groupName',    activeGroup);
      if (activeSubGroup) params.append('subGroupName', activeSubGroup);
      if (activeProject)  params.append('projectId',    activeProject);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.search) params.append('searchTerm', filters.search);
      const response = await fetch(`${API_BASE_URL}/vendors?${params}`, {
        headers: getAuthHeaders(), credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch vendors');
      const data = await response.json();
      setVendors(data.vendors || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (error) {
      showError('Failed to load vendors'); setVendors([]);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      const activeGroup    = filters.groupName    || groupName    || null;
      const activeSubGroup = filters.subGroupName || subGroupName || null;
      const activeProject  = projectId || null;
      if (activeGroup)    params.append('groupName',    activeGroup);
      if (activeSubGroup) params.append('subGroupName', activeSubGroup);
      if (activeProject)  params.append('projectId',    activeProject);
      if (filters.status   && filters.status   !== 'all') params.append('status',   filters.status);
      if (filters.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters.search   && filters.search.trim())      params.append('searchTerm', filters.search.trim());
      const response = await fetch(`${API_BASE_URL}/vendors/stats?${params}`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (response.ok) { const data = await response.json(); setStats(data); }
    } catch (error) { console.error('Failed to fetch stats:', error); }
  };

  const handleViewVendor = async (vendor) => {
    setLoading(true);
    try {
      const vendorResponse = await fetch(`${API_BASE_URL}/vendors/${vendor.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!vendorResponse.ok) throw new Error('Failed to fetch vendor details');
      const vendorData = await vendorResponse.json();
      setSelectedVendor(vendorData);
      const posResponse = await fetch(`${API_BASE_URL}/purchase-orders/vendor/${vendor.id}`, { credentials: 'include', headers: getAuthHeaders() });
      setVendorPurchaseOrders(posResponse.ok ? await posResponse.json() : []);
      setShowDetailDrawer(true);
    } catch (error) { showError('Failed to load vendor details'); }
    finally { setLoading(false); }
  };

  const handleEditVendor = (vendor) => {
    const cat   = (vendor.category   || '').trim();
    const vtype = (vendor.vendorType || '').trim();
    // If the saved value isn't in our known list, treat it as a custom "Other" entry
    const catIsCustom   = cat   && !VENDOR_CATEGORIES.includes(cat);
    const vtypeIsCustom = vtype && !VENDOR_TYPES.includes(vtype);
    setCustomCategory(catIsCustom ? cat : '');
    setCustomVendorType(vtypeIsCustom ? vtype : '');
    setEditFormData({
      id: vendor.id, name: vendor.name || '', contactPerson: vendor.contactPerson || '',
      email: vendor.email || '', phone: vendor.phone || '', website: vendor.website || '',
      gstNumber: vendor.gstNumber || '', address: vendor.address || '', city: vendor.city || '',
      state: vendor.state || '', pincode: vendor.pincode || '', rating: vendor.rating || 0,
      status: vendor.status || 'Active',
      vendorType: vtypeIsCustom ? 'Other' : vtype,
      category:   catIsCustom   ? 'Other' : cat,
      notes: vendor.notes || '', assignedTo: vendor.assignedTo || '',
      groupName: vendor.groupName || '', subGroupName: vendor.subGroupName || '', projectId: vendor.projectId || ''
    });
    setModalGroupName(vendor.groupName || '');
    setModalSubGroupName(vendor.subGroupName || '');
    setModalProjectId(vendor.projectId || '');
    fetchModalGroups();
    if (vendor.groupName) {
      fetchModalSubGroups(vendor.groupName);
      if (vendor.subGroupName) fetchModalProjects(vendor.groupName, vendor.subGroupName);
    }
    setShowEditModal(true);
  };

  const handleUpdateVendor = async () => {
    if (!editFormData.name?.trim()) { showError('Vendor name is required'); return; }
    if (!editFormData.phone?.trim()) { showError('Phone / Contact number is required'); return; }
    if (!editFormData.category) { showError('Category is required'); return; }
    if (editFormData.category === 'Other' && !customCategory.trim()) { showError('Please enter a custom category'); return; }
    if (!editFormData.vendorType) { showError('Vendor type is required'); return; }
    if (editFormData.vendorType === 'Other' && !customVendorType.trim()) { showError('Please enter a custom vendor type'); return; }
    setLoading(true);
    try {
      const payload = {
        ...editFormData,
        category:   editFormData.category   === 'Other' ? customCategory.trim()   : editFormData.category,
        vendorType: editFormData.vendorType === 'Other' ? customVendorType.trim() : editFormData.vendorType,
      };
      const response = await fetch(`${API_BASE_URL}/vendors/${editFormData.id}`, {
        credentials: 'include', method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update vendor');
      showSuccess('Vendor updated successfully!');
      setShowEditModal(false);
      fetchVendors(); fetchStats();
      if (showDetailDrawer && selectedVendor?.id === editFormData.id) handleViewVendor({ id: editFormData.id });
    } catch (error) { showError('Failed to update vendor'); }
    finally { setLoading(false); }
  };

  const handleDeleteVendor = (vendorId, vendorName) => {
    setConfirmModal({ show: true, vendorId, vendorName: vendorName || 'this vendor' });
  };

  const confirmDeleteVendor = async () => {
    const { vendorId } = confirmModal;
    setConfirmModal({ show: false, vendorId: null, vendorName: '' });
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, {
        method: 'DELETE', headers: getAuthHeaders(), credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete vendor');
      showSuccess('Vendor deleted successfully');
      setShowDetailDrawer(false); fetchVendors(); fetchStats();
    } catch (error) { showError('Failed to delete vendor'); }
    finally { setLoading(false); }
  };

  // ─── Formatters ────────────────────────────────────────────────────────────
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(n)) return '₹0';
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
    if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  };
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'N/A';
    const diff = Date.now() - new Date(dateStr);
    const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return formatDate(dateStr);
  };
  const renderStarRating = (rating) => {
    if (!rating) return <span className="no-rating">Not rated</span>;
    return (
      <div className="star-rating">
        {[1,2,3,4,5].map((star) => (
          <Star key={star} size={16} fill={star <= rating ? '#f59e0b' : 'none'} stroke={star <= rating ? '#f59e0b' : '#d1d5db'} />
        ))}
      </div>
    );
  };
  const getStatusBadgeClass = (status) => status === 'Active' ? 'vendor-badge-active' : 'vendor-badge-inactive';

  // ─── Export all vendors to Excel ─────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const exportParams = new URLSearchParams({ page: 0, size: 99999, sortBy: 'createdAt', sortDirection: 'DESC' });
      const activeGroup    = filters.groupName    || groupName    || null;
      const activeSubGroup = filters.subGroupName || subGroupName || null;
      const activeProject  = projectId || null;
      if (activeGroup)    exportParams.append('groupName',    activeGroup);
      if (activeSubGroup) exportParams.append('subGroupName', activeSubGroup);
      if (activeProject)  exportParams.append('projectId',    activeProject);
      if (filters.status   !== 'all') exportParams.append('status',      filters.status);
      if (filters.category !== 'all') exportParams.append('category',    filters.category);
      if (filters.search)              exportParams.append('searchTerm', filters.search.trim());

      const res = await fetch(`${API_BASE_URL}/vendors?${exportParams}`, {
        headers: getAuthHeaders(), credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch vendor data for export');
      const data = await res.json();
      const allVendors = data.vendors || [];
      if (allVendors.length === 0) { showError('No vendors found to export.'); return; }

      const EXPORT_COLS = [
        { key: 'name',               label: 'Vendor Name'              },
        { key: 'vendorCode',         label: 'Vendor Code'              },
        { key: 'contactPerson',      label: 'Contact Person'           },
        { key: 'email',              label: 'Email'                    },
        { key: 'phone',              label: 'Phone'                    },
        { key: 'category',           label: 'Category'                 },
        { key: 'vendorType',         label: 'Vendor Type'              },
        { key: 'rating',             label: 'Rating'                   },
        { key: 'totalOrders',        label: 'Total Orders'             },
        { key: 'totalPurchaseValue', label: 'Total Purchase Value (₹)' },
        { key: 'lastPurchaseDate',   label: 'Last Purchase Date'       },
        { key: 'status',             label: 'Status'                   },
        { key: 'groupName',          label: 'Group'                    },
        { key: 'subGroupName',       label: 'Sub Group'                },
        { key: 'projectName',        label: 'Project Name'             },
        { key: 'projectId',          label: 'Project ID'               },
        { key: 'city',               label: 'City'                     },
        { key: 'state',              label: 'State'                    },
        { key: 'gstNumber',          label: 'GST Number'               },
        { key: 'notes',              label: 'Notes'                    },
      ];

      const totalCols = EXPORT_COLS.length;
      const now       = new Date();
      const dateStr   = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

      // ── Build HTML table (Excel opens .xls HTML tables with full CSS styling) ──
      const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

      const headerCells = EXPORT_COLS.map(({ label }) =>
        `<th style="background:#1e3a5f;color:#ffffff;font-weight:bold;font-size:11pt;
          padding:7px 10px;border:1px solid #334155;white-space:nowrap;text-align:left">${esc(label)}</th>`
      ).join('');

      const dataRowsHtml = allVendors.map((v, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const cells = EXPORT_COLS.map(({ key }) => {
          let val = v[key] ?? '';
          if (key === 'lastPurchaseDate' && val)
            val = new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          return `<td style="padding:5px 10px;border:1px solid #e2e8f0;background:${bg};font-size:10pt">${esc(val)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const half = Math.ceil(totalCols / 2);

      const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>Vendors</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
  </xml><![endif]-->
</head>
<body>
<table border="1" cellpadding="0" cellspacing="0"
       style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif">
  <tr>
    <td style="font-weight:bold;font-size:14pt;padding:10px 12px;
               border:none;background:#ffffff;white-space:nowrap;vertical-align:middle">
      Vendor Management
    </td>
    <td style="font-weight:bold;font-size:11pt;padding:10px 12px;
               border:none;background:#ffffff;white-space:nowrap;vertical-align:middle;color:#475569">
      Downloaded on: ${dateStr}
    </td>
    <td colspan="${totalCols - 2}" style="border:none;background:#ffffff"></td>
  </tr>
  <tr>${headerCells}</tr>
  ${dataRowsHtml}
</table>
</body></html>`;

      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=UTF-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Vendors_${now.toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess(`${allVendors.length} vendor${allVendors.length !== 1 ? 's' : ''} exported successfully`);
    } catch (err) {
      console.error('Export error:', err);
      showError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ─── Render cell by column id ──────────────────────────────────────────────
  const renderCell = (col, vendor) => {
    switch (col.id) {
      case 'name':
        return (
          <td key={col.id} className="vendor-name-cell">
            <div className="vendor-name-info">
              <span className="vendor-name">{vendor.name}</span>
              {vendor.vendorCode && <span className="vendor-code">{vendor.vendorCode}</span>}
            </div>
          </td>
        );
      case 'contact':
        return (
          <td key={col.id} className="vendor-contact-cell">
            <div className="vendor-contact">
              {vendor.email && <div className="contact-item"><Mail size={14} /><span>{vendor.email}</span></div>}
              {vendor.phone && <div className="contact-item"><Phone size={14} /><span>{vendor.phone}</span></div>}
            </div>
          </td>
        );
      case 'category':
        return <td key={col.id}>{vendor.category || 'N/A'}</td>;
      case 'rating':
        return <td key={col.id}>{renderStarRating(vendor.rating)}</td>;
      case 'totalOrders':
        return (
          <td key={col.id} className="vendor-orders-cell">
            <div className="orders-badge"><ShoppingCart size={14} /><span>{vendor.totalOrders || 0}</span></div>
          </td>
        );
      case 'totalPurchaseValue':
        return <td key={col.id} className="vendor-value-cell">{formatCurrency(vendor.totalPurchaseValue)}</td>;
      case 'lastPurchaseDate':
        return <td key={col.id}>{formatDate(vendor.lastPurchaseDate)}</td>;
      case 'status':
        return (
          <td key={col.id}>
            <span className={`vendor-management-badge ${getStatusBadgeClass(vendor.status)}`}>{vendor.status}</span>
          </td>
        );
      case 'actions':
        return (
          <td key={col.id}>
            <div className="vendor-management-actions-cell">
              <button
                className={`vendor-management-action-btn${!canView ? ' action-btn-disabled' : ''}`}
                onClick={() => canView && handleViewVendor(vendor)}
                title={canView ? 'View Details' : '🔒 No view permission'}
                disabled={!canView}
              ><Eye size={16} /></button>
              <button
                className={`vendor-management-action-btn${!canEdit ? ' action-btn-disabled' : ''}`}
                onClick={() => canEdit && handleEditVendor(vendor)}
                title={canEdit ? 'Edit Vendor' : '🔒 No edit permission'}
                disabled={!canEdit}
              ><Edit2 size={16} /></button>
              <button
                className={`vendor-management-action-btn vendor-management-action-btn--danger${!canDelete ? ' action-btn-disabled' : ''}`}
                onClick={() => canDelete && handleDeleteVendor(vendor.id, vendor.vendorName || vendor.name)}
                title={canDelete ? 'Delete Vendor' : '🔒 No delete permission'}
                disabled={!canDelete}
              ><Trash2 size={16} /></button>
            </div>
          </td>
        );
      case 'group':
        return <td key={col.id}>{vendor.groupName || 'N/A'}</td>;
      case 'project':
        return (
          <td key={col.id}>
            {vendor.projectId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                  {vendor.projectName || vendor.projectId}
                </span>
                {vendor.projectName && (
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                    {vendor.projectId}
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: '#94a3b8' }}>N/A</span>
            )}
          </td>
        );
      default:
        return <td key={col.id}>—</td>;
    }
  };

  // ─── PO Timeline ───────────────────────────────────────────────────────────
  const POTimeline = ({ po }) => {
    const getStatusColor = (status) => ({
      Draft: '#94a3b8', Approved: '#3b82f6', Ordered: '#8b5cf6',
      'In-Transit': '#f59e0b', Delivered: '#22c55e', Cancelled: '#ef4444'
    }[status] || '#94a3b8');

    const statusSteps = ['Draft', 'Approved', 'Ordered', 'In-Transit', 'Delivered'];
    const currentIndex = statusSteps.indexOf(po.status);

    return (
      <div className="po-timeline">
        {statusSteps.map((step, index) => (
          <div key={step} className={`timeline-step ${index <= currentIndex ? 'completed' : ''}`}>
            <div className="timeline-dot" style={{ backgroundColor: index <= currentIndex ? getStatusColor(step) : '#e2e8f0' }} />
            <div className="timeline-label">
              <span className="timeline-status">{step}</span>
              {index === currentIndex && <span className="timeline-date">{formatDate(po.orderDate)}</span>}
            </div>
            {index < statusSteps.length - 1 && (
              <div className="timeline-line" style={{ backgroundColor: index < currentIndex ? getStatusColor(step) : '#e2e8f0' }} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ─── KPI ───────────────────────────────────────────────────────────────────
  const kpiData = stats ? [
    { title: 'Total Vendors',        value: stats.totalVendors.toString(),              icon: <Package size={32} />,     color: '#2563eb' },
    { title: 'Approved Vendors',     value: stats.activeVendors.toString(),             icon: <CheckCircle size={32} />, color: '#22c55e' },
    { title: 'Average Rating',       value: stats.averageRating.toFixed(1) + '/5',      icon: <Star size={32} />,        color: '#f59e0b' },
    { title: 'Total Purchase Value', value: formatCurrency(stats.totalPurchaseValue),   icon: <IndianRupee size={32} />, color: '#8b5cf6' },
  ] : [];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vendor-management-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ConfirmationModal
        show={confirmModal.show}
        type="alert"
        title="Delete Vendor"
        message={`Are you sure you want to delete "${confirmModal.vendorName}"?\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteVendor}
        onCancel={() => setConfirmModal({ show: false, vendorId: null, vendorName: '' })}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="vendor-management-header">
        <div className="vendor-management-breadcrumb">Dashboard &gt; Procurement &gt; Vendor Management</div>
        <div className="page-header-with-filter">
          <h1 className="vendor-management-title">
            Vendor Management <span className="vendor-management-count">({totalElements})</span>
          </h1>
          <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="vendor-management-action-bar">
        <div className="vendor-management-search-filters">
          <input
            type="text" placeholder="Search by name, email, phone, code..."
            className="vendor-management-search" value={filters.search}
            onChange={(e) => { const v = e.target.value; setFilters(prev => ({ ...prev, search: v })); setCurrentPage(0); }}
          />
          <select className="vendor-management-filter" value={filters.status}
            onChange={(e) => { const v = e.target.value; setFilters(prev => ({ ...prev, status: v })); setCurrentPage(0); }}>
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select className="vendor-management-filter" value={filters.category}
            onChange={(e) => { const v = e.target.value; setFilters(prev => ({ ...prev, category: v })); setCurrentPage(0); }}>
            <option value="all">All Categories</option>
            <option value="IT Equipment">IT Equipment</option>
            <option value="Office Furniture">Office Furniture</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Services">Services</option>
          </select>
        </div>
        <div className="vendor-management-actions">
          {/* ── Columns Picker Button ── */}
          <div className="columns-picker-wrapper">
            <button
              ref={columnsPickerBtnRef}
              className="vendor-management-btn-secondary vendor-management-btn--columns"
              onClick={() => setShowColumnsPicker((v) => !v)}
              title="Manage Columns"
            >
              <Columns size={16} />
              <span>Columns</span>
              {/* <span className="columns-count-badge">{visibleColumns.length}/{columns.length}</span> */}
            </button>
            {showColumnsPicker && (
              <ColumnsPicker
                columns={columns}
                onToggle={toggleColumnVisibility}
                onClose={() => setShowColumnsPicker(false)}
              />
            )}
          </div>
          <button className="vendor-management-btn-primary" onClick={handleAddNewVendor}>
            <Plus size={18} /> Add Vendor
          </button>
          <button className="vendor-management-btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={18} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="vendor-management-kpi-grid">
          {kpiData.map((kpi, index) => (
            <div key={index} className="vendor-management-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="vendor-management-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
              <div className="vendor-management-kpi-content">
                <div className="vendor-management-kpi-value">{kpi.value}</div>
                <div className="vendor-management-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="vendor-management-table-container">
        <div className="vendor-management-table-scroll">
          <table className="vendor-management-table">
            <thead>
              <tr>
                {visibleColumns.map((col, visIdx) => (
                  <DraggableTH
                    key={col.id}
                    col={col}
                    index={visIdx}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    isDragOver={dragOverIndex === visIdx}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="empty-state">
                    No vendors found. Vendors appear here after placing purchase orders.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id} className="vendor-management-table-row">
                    {visibleColumns.map((col) => renderCell(col, vendor))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="table-footer">
          <div className="pagination-info">
            <span>
              Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} vendors
            </span>
            <select className="page-size-selector" value={pageSize} onChange={handlePageSizeChange}>
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

      {/* ─── Detail Drawer (unchanged) ──────────────────────────────────────── */}
      {showDetailDrawer && selectedVendor && (
        <div className="vendor-management-drawer-overlay">
          <div className="vendor-management-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="vendor-management-drawer-header">
              <div>
                <h2>{selectedVendor.name}</h2>
                <p className="vendor-management-drawer-subtitle">{selectedVendor.vendorCode}</p>
              </div>
              <button className="vendor-management-drawer-close" onClick={() => setShowDetailDrawer(false)}>✕</button>
            </div>
            <div className="vendor-management-drawer-content">
              <div className="vendor-management-drawer-section">
                <h3>Vendor Information</h3>
                <div className="vendor-info-grid">
                  {[
                    [Building2, 'Vendor Code', selectedVendor.vendorCode],
                    [User,      'Contact Person', selectedVendor.contactPerson],
                    [Mail,      'Email', selectedVendor.email],
                    [Phone,     'Phone', selectedVendor.phone],
                    [FileText,  'GST Number', selectedVendor.gstNumber],
                    [Tag,       'Category', selectedVendor.category],
                    [Briefcase, 'Vendor Type', selectedVendor.vendorType],
                  ].map(([Icon, label, val]) => (
                    <div key={label} className="vendor-info-item">
                      <Icon size={18} />
                      <div><span className="info-label">{label}</span><span className="info-value">{val || 'N/A'}</span></div>
                    </div>
                  ))}
                  <div className="vendor-info-item">
                    <MapPin size={18} />
                    <div>
                      <span className="info-label">Address</span>
                      <span className="info-value">
                        {selectedVendor.address ? `${selectedVendor.address}, ${selectedVendor.city}, ${selectedVendor.state} ${selectedVendor.pincode}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="vendor-info-item">
                    <Star size={18} />
                    <div><span className="info-label">Rating</span>{renderStarRating(selectedVendor.rating)}</div>
                  </div>
                </div>
              </div>

              <div className="vendor-management-drawer-section">
                <h3>Purchase Statistics</h3>
                <div className="vendor-stats-grid">
                  {[
                    [ShoppingCart,  selectedVendor.totalOrders || 0,                        'Total Orders'],
                    [IndianRupee,   formatCurrency(selectedVendor.totalPurchaseValue),       'Total Purchase Value'],
                    [Calendar,      formatDate(selectedVendor.lastPurchaseDate),             'Last Purchase'],
                    [IndianRupee,   formatCurrency(selectedVendor.lastPurchaseAmount),       'Last Purchase Amount'],
                  ].map(([Icon, val, label]) => (
                    <div key={label} className="vendor-stat-card">
                      <Icon size={24} />
                      <div><div className="stat-value">{val}</div><div className="stat-label">{label}</div></div>
                    </div>
                  ))}
                </div>
              </div>

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
                            <span className={`vendor-management-badge ${getStatusBadgeClass(po.status)}`}>{po.status}</span>
                          </div>
                          <span className="po-value">{formatCurrency(po.totalValue)}</span>
                        </div>
                        <POTimeline po={po} />
                        <div className="po-item-details">
                          <span><Calendar size={14} /> Order: {formatDate(po.orderDate)}</span>
                          <span><Truck size={14} /> Expected: {formatDate(po.expectedDelivery)}</span>
                          <span><Package size={14} /> {po.totalItemsOrdered} items ({po.totalItemsDelivered} delivered)</span>
                        </div>
                        {po.notes && (
                          <div className="po-notes"><FileText size={14} /><span>{po.notes}</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="vendor-management-drawer-actions">
                <button className="vendor-management-btn-primary" onClick={() => handleEditVendor(selectedVendor)}>Edit Vendor</button>
                {selectedVendor.status === 'Active' && canDelete && (
                  <button className="vendor-management-btn-danger" onClick={() => handleDeleteVendor(selectedVendor.id, selectedVendor.vendorName || selectedVendor.name)}>Delete</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Modal (unchanged) ──────────────────────────────────────────── */}
      {showEditModal && editFormData && (
        <div className="vendor-management-modal-overlay">
          <div className="vendor-management-edit-modal" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="vendor-management-modal-header" style={{ flexShrink: 0 }}>
              <h2>Edit Vendor</h2>
              <button className="vendor-management-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="vendor-management-edit-form" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div className="vendor-form-section">
                <h3>Basic Information</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Vendor Name *</label><input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Enter vendor name" /></div>
                  <div className="vendor-form-group"><label>Contact Person</label><input type="text" value={editFormData.contactPerson} onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })} placeholder="Enter contact person" /></div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Email</label><input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} placeholder="Enter email" /></div>
                  <div className="vendor-form-group"><label>Phone / Contact Number *</label><input type="tel" value={editFormData.phone} maxLength={10} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setEditFormData({ ...editFormData, phone: v }); }} placeholder="Enter 10-digit phone number" /></div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Category *</label>
                    <select value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}>
                      <option value="">Select category</option>
                      {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      {/* Show current value as option if it's not in the standard list */}
                      {editFormData.category && editFormData.category !== 'Other' && !VENDOR_CATEGORIES.includes(editFormData.category) && (
                        <option value={editFormData.category}>{editFormData.category}</option>
                      )}
                      <option value="Other">Other (enter manually)</option>
                    </select>
                    {editFormData.category === 'Other' && (
                      <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                        placeholder="Enter category name" style={{ marginTop: 6 }} />
                    )}
                  </div>
                  <div className="vendor-form-group"><label>Vendor Type *</label>
                    <select value={editFormData.vendorType} onChange={(e) => setEditFormData({ ...editFormData, vendorType: e.target.value })}>
                      <option value="">Select type</option>
                      {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      {/* Show current value as option if it's not in the standard list */}
                      {editFormData.vendorType && editFormData.vendorType !== 'Other' && !VENDOR_TYPES.includes(editFormData.vendorType) && (
                        <option value={editFormData.vendorType}>{editFormData.vendorType}</option>
                      )}
                      <option value="Other">Other (enter manually)</option>
                    </select>
                    {editFormData.vendorType === 'Other' && (
                      <input type="text" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)}
                        placeholder="Enter vendor type" style={{ marginTop: 6 }} />
                    )}
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Rating</label>
                    <select value={editFormData.rating} onChange={(e) => setEditFormData({ ...editFormData, rating: parseInt(e.target.value) })}>
                      <option value="0">Not Rated</option>
                      <option value="1">⭐ 1 Star</option>
                      <option value="2">⭐⭐ 2 Stars</option>
                      <option value="3">⭐⭐⭐ 3 Stars</option>
                      <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                      <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                    </select>
                  </div>
                  <div className="vendor-form-group"><label>Status</label>
                    <select value={editFormData.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>GST Number</label><input type="text" value={editFormData.gstNumber} onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })} placeholder="Enter GST number" /></div>
                  <div className="vendor-form-group"><label>Website</label><input type="url" value={editFormData.website || ''} onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })} placeholder="https://www.example.com" /></div>
                </div>
              </div>
              <div className="vendor-form-section">
                <h3>Address</h3>
                <div className="vendor-form-group"><label>Address</label><textarea rows={2} value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} placeholder="Enter address" /></div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>City</label><input type="text" value={editFormData.city} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} placeholder="Enter city" /></div>
                  <div className="vendor-form-group"><label>State</label>
                    <select value={editFormData.state || ''} onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group"><label>Pincode</label><input type="text" value={editFormData.pincode} onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })} placeholder="Enter pincode" /></div>
                </div>
              </div>
              <div className="vendor-form-section">
                <h3>Additional Information</h3>
                <div className="vendor-form-group"><label>Notes</label><textarea rows={3} value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder="Enter any additional notes" /></div>
              </div>
            </div>
            <div className="vendor-management-modal-actions" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <button className="vendor-management-btn-primary" onClick={handleUpdateVendor}>Save Changes</button>
              <button className="vendor-management-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Modal (unchanged) ────────────────────────────────────────── */}
      {showCreateModal && editFormData && (
        <div className="vendor-management-modal-overlay">
          <div className="vendor-management-edit-modal" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="vendor-management-modal-header" style={{ flexShrink: 0 }}>
              <h2>Add New Vendor</h2>
              <button className="vendor-management-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className="vendor-management-edit-form" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div className="vendor-form-section">
                <h3>Project Assignment</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Group</label>
                    <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                      <option value="">{modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}</option>
                      {modalGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group"><label>Category / Sub-Group</label>
                    <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                      <option value="">{!modalGroupName ? 'Select Group First' : modalDropdownLoading.subGroups ? 'Loading...' : 'Select Category'}</option>
                      {modalSubGroups.map(sg => <option key={sg.value} value={sg.value}>{sg.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="vendor-form-group"><label>Project (Optional)</label>
                  <select value={modalProjectId} onChange={handleModalProjectChange} disabled={!modalSubGroupName || modalDropdownLoading.projects}>
                    <option value="">{!modalSubGroupName ? 'Select Category First' : modalDropdownLoading.projects ? 'Loading...' : 'Select Project (Optional)'}</option>
                    {modalProjects.map(p => <option key={p.id} value={p.id}>{p.name} - {p.location}</option>)}
                  </select>
                </div>
              </div>
              <div className="vendor-form-section">
                <h3>Basic Information</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Vendor Name *</label><input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Enter vendor name" /></div>
                  <div className="vendor-form-group"><label>Contact Person</label><input type="text" value={editFormData.contactPerson} onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })} placeholder="Enter contact person" /></div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Email</label><input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} placeholder="Enter email" /></div>
                  <div className="vendor-form-group"><label>Phone / Contact Number *</label><input type="tel" value={editFormData.phone} maxLength={10} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setEditFormData({ ...editFormData, phone: v }); }} placeholder="Enter 10-digit phone number" /></div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Category *</label>
                    <select value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}>
                      <option value="">Select category</option>
                      {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      {/* Show current value as option if it's not in the standard list */}
                      {editFormData.category && editFormData.category !== 'Other' && !VENDOR_CATEGORIES.includes(editFormData.category) && (
                        <option value={editFormData.category}>{editFormData.category}</option>
                      )}
                      <option value="Other">Other (enter manually)</option>
                    </select>
                    {editFormData.category === 'Other' && (
                      <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                        placeholder="Enter category name" style={{ marginTop: 6 }} />
                    )}
                  </div>
                  <div className="vendor-form-group"><label>Vendor Type *</label>
                    <select value={editFormData.vendorType} onChange={(e) => setEditFormData({ ...editFormData, vendorType: e.target.value })}>
                      <option value="">Select type</option>
                      {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      {/* Show current value as option if it's not in the standard list */}
                      {editFormData.vendorType && editFormData.vendorType !== 'Other' && !VENDOR_TYPES.includes(editFormData.vendorType) && (
                        <option value={editFormData.vendorType}>{editFormData.vendorType}</option>
                      )}
                      <option value="Other">Other (enter manually)</option>
                    </select>
                    {editFormData.vendorType === 'Other' && (
                      <input type="text" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)}
                        placeholder="Enter vendor type" style={{ marginTop: 6 }} />
                    )}
                  </div>
                </div>
              </div>
              <div className="vendor-form-section">
                <h3>Contact Information</h3>
                <div className="vendor-form-group"><label>Website</label><input type="url" value={editFormData.website} onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })} placeholder="https://www.example.com" /></div>
                <div className="vendor-form-group"><label>Address</label><textarea rows={2} value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} placeholder="Enter address" /></div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>City</label><input type="text" value={editFormData.city} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} placeholder="Enter city" /></div>
                  <div className="vendor-form-group"><label>State</label>
                    <select value={editFormData.state || ''} onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="vendor-form-group"><label>Pincode</label><input type="text" value={editFormData.pincode} onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })} placeholder="Enter pincode" /></div>
                </div>
                <div className="vendor-form-group"><label>GST Number</label><input type="text" value={editFormData.gstNumber} onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })} placeholder="Enter GST number" /></div>
              </div>
              <div className="vendor-form-section">
                <h3>Additional Details</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Rating</label>
                    <select value={editFormData.rating} onChange={(e) => setEditFormData({ ...editFormData, rating: parseInt(e.target.value) })}>
                      <option value="0">Not Rated</option>
                      <option value="1">⭐ 1 Star</option>
                      <option value="2">⭐⭐ 2 Stars</option>
                      <option value="3">⭐⭐⭐ 3 Stars</option>
                      <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                      <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                    </select>
                  </div>
                  <div className="vendor-form-group"><label>Status</label>
                    <select value={editFormData.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                {availableUsers.length > 0 && (
                  <div className="vendor-form-group"><label>Assign To</label>
                    <select value={editFormData.assignedTo} onChange={(e) => setEditFormData({ ...editFormData, assignedTo: e.target.value })}>
                      <option value="">Select user</option>
                      {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="vendor-form-group"><label>Notes</label><textarea rows={3} value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder="Enter any additional notes" /></div>
              </div>
            </div>
            <div className="vendor-management-modal-actions" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <button className="vendor-management-btn-primary" onClick={handleCreateVendor}>Create Vendor</button>
              <button className="vendor-management-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;