import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Filter, Download, Plus, X, Edit2, Eye, Package, Truck,
  CheckCircle, IndianRupee, Clock, Columns, FileText, TrendingUp,
  DollarSign, AlertCircle, Trash2, Upload, ExternalLink, File,
  ChevronUp, ChevronDown, ChevronsUpDown, GripVertical, Check
} from 'lucide-react';
import '../pages-css/PurchaseOrders.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal';
import ItemNameAutocomplete from '../components/OrderBook/ItemNameAutocomplete.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── Column Definitions ───────────────────────────────────────────────────────
const DEFAULT_COLUMNS = [
  { id: 'poNumber',         label: 'PO Number',         sortable: true,  visible: true },
  { id: 'vendorId',         label: 'Vendor ID',          sortable: false, visible: true },
  { id: 'vendorName',       label: 'Vendor Name',        sortable: true,  visible: true },
  { id: 'orderDate',        label: 'Order Date',         sortable: true,  visible: true },
  { id: 'totalValue',       label: 'Total Value',        sortable: true,  visible: true },
  { id: 'deliveryProgress', label: 'Delivery Progress',  sortable: false, visible: true },
  { id: 'paymentStatus',    label: 'Payment Status',     sortable: true,  visible: true },
  { id: 'status',           label: 'Status',             sortable: true,  visible: true },
  { id: 'group',            label: 'Group',              sortable: false, visible: false },
  { id: 'category',         label: 'Category',           sortable: false, visible: false },
  { id: 'project',          label: 'Project',            sortable: false, visible: true  },
  { id: 'actions',          label: 'Actions',            sortable: false, visible: true },
];

// ─── Sort Icon ────────────────────────────────────────────────────────────────
const SortIcon = ({ columnId, sortConfig }) => {
  if (!sortConfig || sortConfig.key !== columnId)
    return <ChevronsUpDown size={13} className="po-sort-icon po-sort-icon--idle" />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp   size={13} className="po-sort-icon po-sort-icon--active" />
    : <ChevronDown size={13} className="po-sort-icon po-sort-icon--active" />;
};

// ─── Columns Picker ───────────────────────────────────────────────────────────
const ColumnsPicker = ({ columns, onToggle, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div className="po-columns-picker" ref={ref}>
      <div className="po-columns-picker__header">
        <span>Show / Hide Columns</span>
        <button className="po-columns-picker__close" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="po-columns-picker__list">
        {columns.map((col) => (
          <button
            key={col.id}
            className={`po-columns-picker__item ${col.visible ? 'po-columns-picker__item--checked' : ''}`}
            onClick={() => col.id !== 'actions' && onToggle(col.id)}
            disabled={col.id === 'actions'}
            title={col.id === 'actions' ? 'Actions column is always visible' : ''}
          >
            <span className="po-columns-picker__checkbox">
              {col.visible && <Check size={11} />}
            </span>
            {col.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Draggable TH ─────────────────────────────────────────────────────────────
const DraggableTH = ({ col, index, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, sortConfig, onSort }) => (
  <th
    draggable={col.id !== 'actions'}
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    onDragEnd={onDragEnd}
    className={[
      'po-th',
      isDragOver ? 'po-th--drag-over' : '',
      col.sortable ? 'po-th--sortable' : '',
    ].filter(Boolean).join(' ')}
    onClick={() => col.sortable && onSort(col.id)}
  >
    <span className="po-th__inner">
      {col.id !== 'actions' && (
        <span className="po-drag-handle" title="Drag to reorder">
          <GripVertical size={13} />
        </span>
      )}
      <span className="po-th__label">{col.label}</span>
      {col.sortable && <SortIcon columnId={col.id} sortConfig={sortConfig} />}
    </span>
  </th>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions, isAccountsExecutive } = useAuth();
  const poPerms    = pagePermissions?.PURCHASE_ORDERS || [];
  const canView    = poPerms.includes('VIEW')    || isAccountsExecutive;
  const canCreate  = poPerms.includes('CREATE')  || isAccountsExecutive;
  const canEdit    = poPerms.includes('EDIT')    || isAccountsExecutive;
  const canDelete  = poPerms.includes('DELETE')  && !isAccountsExecutive;
  const canApprove = poPerms.includes('APPROVE') || isAccountsExecutive;
  const isViewOnly = canView && !canCreate && !canEdit && !canDelete && !canApprove;
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPOId, setEditingPOId] = useState(null);

  // ── Column state ──
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [showColumnsPicker, setShowColumnsPicker] = useState(false);

  // ── Sort state ──
  const [sortConfig, setSortConfig] = useState({ key: 'orderDate', direction: 'desc' });

  // ── Drag state ──
  const dragSrcIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const [filters, setFilters] = useState({ search: '', status: 'all', paymentStatus: 'all' });
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', type: 'confirm',
    onConfirm: null, onCancel: null, confirmText: 'Confirm', cancelText: 'Cancel'
  });
  const GST_OPTIONS = [0, 5, 12, 18, 28];

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryFormData, setDeliveryFormData] = useState(null);
  const [stats, setStats] = useState(null);

  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  // PO soft-copy file upload state
  const [poFileUpload, setPoFileUpload] = useState(null);
  const [poFileUploading, setPoFileUploading] = useState(false);
  const [showPOFileModal, setShowPOFileModal] = useState(false);
  const [poFileModalUrl, setPoFileModalUrl] = useState('');
  const poFileInputRef = useRef(null);
  const [vendors, setVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [quotations, setQuotations] = useState([]);

  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  const [orderBooks, setOrderBooks] = useState([]);          // list of order books for selected project
  const [selectedOrderBookId, setSelectedOrderBookId] = useState(''); // which orderbook is selected
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  // Once items are loaded (from order book OR manually), keep the form sections
  // visible even if the user removes all items — prevents collapsing back to step 1.
  const [itemsStepUnlocked, setItemsStepUnlocked] = useState(false);
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [createPOFormData, setCreatePOFormData] = useState({
    quotationId: '', quotation: null, vendorId: null, vendorName: '', vendorContact: '',
    groupName: '', subGroupName: '', projectId: '',
    orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '',
    paymentTerms: '', shippingAddress: '', notes: '', items: [], status: 'Draft'
  });
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: '', itemDescription: '', quantity: '', unitPrice: '', gst: 18, discount: '' });

  // ── Edit-mode project change state ──
  const [pendingProjectChange, setPendingProjectChange] = useState(null); // { groupName, subGroupName, projectId }
  const [showProjectChangeWarning, setShowProjectChangeWarning] = useState(false);

  // ─── Column helpers ────────────────────────────────────────────────────────
  const visibleColumns = columns.filter((c) => c.visible);

  const toggleColumnVisibility = useCallback((colId) => {
    setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, visible: !c.visible } : c));
  }, []);

  // ─── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((colId) => {
    setSortConfig((prev) => ({
      key: colId,
      direction: prev.key === colId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(0);
  }, []);

  // ─── Drag-and-drop columns ─────────────────────────────────────────────────
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
    const visibleIds = visibleColumns.map((c) => c.id);
    const srcId = visibleIds[srcIndex];
    const dropId = visibleIds[dropIndex];
    setColumns((prev) => {
      const next = [...prev];
      const fromFull = next.findIndex((c) => c.id === srcId);
      const toFull   = next.findIndex((c) => c.id === dropId);
      const [moved] = next.splice(fromFull, 1);
      next.splice(toFull, 0, moved);
      return next;
    });
    setDragOverIndex(null);
    dragSrcIndex.current = null;
  };
  const handleDragEnd = () => { setDragOverIndex(null); dragSrcIndex.current = null; };

  // ─── Effects ───────────────────────────────────────────────────────────────
  // AbortController + Promise.all: fetches PO list and KPI stats simultaneously
  // with identical filter params. Cleanup aborts both in-flight requests when
  // any filter/page/sort dep changes, eliminating race conditions on rapid typing.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadAll = async () => {
      setLoading(true);
      try {
        const sortKeyMap = { poNumber: 'poNo', vendorName: 'vendorName', orderDate: 'orderDate', totalValue: 'totalValue', paymentStatus: 'paymentStatus', status: 'status' };

        // PO list params
        const poParams = new URLSearchParams({
          page: currentPage, size: pageSize,
          sortBy: sortKeyMap[sortConfig.key] || 'orderDate',
          sortDirection: sortConfig.direction.toUpperCase()
        });
        if (groupName)    poParams.append('groupName',    groupName);
        if (subGroupName) poParams.append('subGroupName', subGroupName);
        if (projectId)    poParams.append('projectId',    projectId);
        if (filters.status        !== 'all') poParams.append('status',        filters.status);
        if (filters.paymentStatus !== 'all') poParams.append('paymentStatus', filters.paymentStatus);
        if (filters.search)                  poParams.append('searchTerm',    filters.search.trim());

        // Stats params — identical filters so KPI cards always match the table
        const statsParams = new URLSearchParams();
        if (groupName)    statsParams.append('groupName',    groupName);
        if (subGroupName) statsParams.append('subGroupName', subGroupName);
        if (projectId)    statsParams.append('projectId',    projectId);
        if (filters.status        !== 'all') statsParams.append('status',        filters.status);
        if (filters.paymentStatus !== 'all') statsParams.append('paymentStatus', filters.paymentStatus);
        if (filters.search)                  statsParams.append('searchTerm',    filters.search.trim());

        const [poRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/purchase-orders?${poParams}`,       { credentials: 'include', headers: getAuthHeaders(), signal }),
          fetch(`${API_BASE_URL}/purchase-orders/stats?${statsParams}`, { credentials: 'include', headers: getAuthHeaders(), signal })
        ]);

        if (!signal.aborted) {
          if (poRes.ok) {
            const data = await poRes.json();
            setPurchaseOrders(data.purchaseOrders || []);
            setProjectNames(data.projectNames || {});
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
          } else {
            showError('Failed to load purchase orders');
            setPurchaseOrders([]);
          }
          if (statsRes.ok) setStats(await statsRes.json());
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // cancelled by dep change — ignore
        showError('Failed to load purchase orders');
        setPurchaseOrders([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    loadAll();
    return () => controller.abort(); // cancel in-flight requests on re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.paymentStatus, filters.search, sortConfig]);
  useEffect(() => { fetchVendors(); }, []);

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id': user?.id || localStorage.getItem('userId'),
    'User-Role': user?.role || localStorage.getItem('userRole')
  });

  // ─── Confirmation Modal ────────────────────────────────────────────────────
  const showConfirmation = (config) => new Promise((resolve) => {
    setConfirmModal({
      show: true,
      title: config.title || 'Confirm Action',
      message: config.message,
      type: config.type || 'confirm',
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      onConfirm: () => { setConfirmModal(prev => ({ ...prev, show: false })); resolve(true); },
      onCancel:  () => { setConfirmModal(prev => ({ ...prev, show: false })); resolve(false); }
    });
  });

  const handlePageSizeChange = (e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); };

  // ─── Modal dropdown helpers ────────────────────────────────────────────────
  const fetchModalGroups = async () => {
    setModalDropdownLoading(prev => ({ ...prev, groups: true }));
    try {
      const r = await fetch(`${API_BASE_URL}/filters/groups`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setModalGroups(await r.json() || []);
    } catch { setModalGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, groups: false })); }
  };

  const fetchModalSubGroups = async (gName) => {
    if (!gName) { setModalSubGroups([]); setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, subGroups: true }));
    try {
      const r = await fetch(`${API_BASE_URL}/filters/subgroups?groupName=${encodeURIComponent(gName)}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setModalSubGroups(await r.json() || []);
    } catch { setModalSubGroups([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, subGroups: false })); }
  };

  const fetchModalProjects = async (gName, sgName) => {
    if (!gName || !sgName) { setModalProjects([]); return; }
    setModalDropdownLoading(prev => ({ ...prev, projects: true }));
    try {
      const r = await fetch(`${API_BASE_URL}/filters/projects?groupName=${encodeURIComponent(gName)}&subGroupName=${encodeURIComponent(sgName)}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setModalProjects(await r.json() || []);
    } catch { setModalProjects([]); }
    finally { setModalDropdownLoading(prev => ({ ...prev, projects: false })); }
  };

  const fetchFilteredQuotations = async (gName, sgName, pId) => {
    try {
      let url = `${API_BASE_URL}/quotations/approved?`;
      if (gName) url += `groupName=${encodeURIComponent(gName)}&`;
      if (sgName) url += `subGroupName=${encodeURIComponent(sgName)}&`;
      if (pId) url += `projectId=${encodeURIComponent(pId)}`;
      const r = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setQuotations(await r.json() || []);
    } catch { setQuotations([]); }
  };

  // Fetch all order books for a project (for the orderbook dropdown)
  const fetchOrderBooks = async (pId) => {
    if (!pId) { setOrderBooks([]); return; }
    try {
      // Pass groupName + subGroupName to filter server-side
      // projectId is not yet in OrderBookWrapper, so we filter by group/subgroup
      // which already scopes to the right project context
      const gName = encodeURIComponent(modalGroupName || '');
      const sgName = encodeURIComponent(modalSubGroupName || '');
      const r = await fetch(
        `${API_BASE_URL}/order-book/getAll?page=0&size=200&groupName=${gName}&subGroupName=${sgName}`,
        { credentials: 'include', headers: getAuthHeaders() }
      );
      if (!r.ok) throw new Error();
      const data = await r.json();
      // API returns { success, data: [...] }
      // Filter by projectId if present in response (requires backend OrderBookWrapper.projectId)
      const all = (data.data || data.content || []).filter(ob => !ob.deletedAt && (!ob.projectId || ob.projectId === pId));
      setOrderBooks(all);
    } catch (e) { console.error('fetchOrderBooks error', e); setOrderBooks([]); }
  };

  const fetchOrderBookItems = async (orderBookId) => {
    if (!orderBookId) { setOrderBookItems([]); return; }
    setLoadingOrderItems(true);
    try {
      const r = await fetch(`${API_BASE_URL}/order-book/${orderBookId}/items-with-tracking`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      // items-with-tracking returns { success, data: [...] } with allocatedQty per item
      setOrderBookItems(data.success ? (data.data || []) : (Array.isArray(data) ? data : []));
    } catch { showError('Failed to load order book items'); setOrderBookItems([]); }
    finally { setLoadingOrderItems(false); }
  };

  // ─── Modal change handlers ────────────────────────────────────────────────
  const handleModalGroupChange = (e) => {
    const v = e.target.value;
    if (isEditMode && createPOFormData.items.length > 0) {
      // In edit mode: immediately update the UI dropdowns so cascading works,
      // but capture the pending change and show a warning before applying to form data.
      setModalGroupName(v);
      setModalSubGroupName('');
      setModalProjectId('');
      setModalSubGroups([]);
      setModalProjects([]);
      setQuotations([]);
      setOrderBooks([]);
      setSelectedOrderBookId('');
      setPendingProjectChange({ groupName: v, subGroupName: '', projectId: '' });
      setShowProjectChangeWarning(true);
      if (v) { fetchModalSubGroups(v); fetchFilteredQuotations(v, null, null); }
      return;
    }
    setModalGroupName(v); setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]); setQuotations([]); setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setCreatePOFormData(prev => ({ ...prev, groupName: v, subGroupName: '', projectId: '', items: [] }));
    if (v) { fetchModalSubGroups(v); fetchFilteredQuotations(v, null, null); }
    fetchVendors();
  };
  const handleModalSubGroupChange = (e) => {
    const v = e.target.value;
    if (isEditMode && createPOFormData.items.length > 0) {
      setModalSubGroupName(v);
      setModalProjectId('');
      setModalProjects([]);
      setQuotations([]);
      setOrderBooks([]);
      setSelectedOrderBookId('');
      setPendingProjectChange(prev => ({ ...(prev || { groupName: modalGroupName }), subGroupName: v, projectId: '' }));
      setShowProjectChangeWarning(true);
      if (modalGroupName && v) { fetchModalProjects(modalGroupName, v); }
      return;
    }
    setModalSubGroupName(v); setModalProjectId(''); setModalProjects([]); setQuotations([]); setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setCreatePOFormData(prev => ({ ...prev, subGroupName: v, projectId: '', items: [] }));
    if (modalGroupName && v) { fetchModalProjects(modalGroupName, v); fetchFilteredQuotations(modalGroupName, v, null); }
  };
  const handleModalProjectChange = async (e) => {
    const v = e.target.value;
    if (isEditMode && createPOFormData.items.length > 0) {
      setModalProjectId(v);
      setQuotations([]);
      setOrderBookItems([]);
      setOrderBooks([]);
      setSelectedOrderBookId('');
      setPendingProjectChange(prev => ({ ...(prev || { groupName: modalGroupName, subGroupName: modalSubGroupName }), projectId: v }));
      setShowProjectChangeWarning(true);
      if (v) {
        await fetchFilteredQuotations(modalGroupName, modalSubGroupName, v);
        await fetchOrderBooks(v);
      }
      return;
    }
    setModalProjectId(v); setQuotations([]); setOrderBookItems([]); setOrderBooks([]); setSelectedOrderBookId('');
    setCreatePOFormData(prev => ({ ...prev, projectId: v, quotationId: '', quotation: null, items: [] }));
    if (v) {
      await fetchFilteredQuotations(modalGroupName, modalSubGroupName, v);
      await fetchOrderBooks(v);
      fetchVendors(modalGroupName, modalSubGroupName, v);
    }
  };

  // ── Confirm project change in edit mode: keep items, just update project fields ──
  const handleConfirmProjectChange = async () => {
    // The modal dropdowns (modalGroupName, modalSubGroupName, modalProjectId) are already
    // updated live — we just need to sync them into createPOFormData WITHOUT clearing items.
    setCreatePOFormData(prev => ({
      ...prev,
      groupName: modalGroupName,
      subGroupName: modalSubGroupName,
      projectId: modalProjectId,
      // items intentionally preserved
    }));
    if (modalProjectId) {
      fetchVendors(modalGroupName, modalSubGroupName, modalProjectId);
    }
    setPendingProjectChange(null);
    setShowProjectChangeWarning(false);
    showSuccess('Project updated. All existing items have been kept.');
  };

  const handleCancelProjectChange = () => {
    // Revert the live dropdowns back to the values stored in createPOFormData (the original PO project)
    setModalGroupName(createPOFormData.groupName || '');
    setModalSubGroupName(createPOFormData.subGroupName || '');
    setModalProjectId(createPOFormData.projectId || '');
    // Re-load the subgroup/project lists for the original selection so dropdowns are correct
    if (createPOFormData.groupName) fetchModalSubGroups(createPOFormData.groupName);
    if (createPOFormData.groupName && createPOFormData.subGroupName) fetchModalProjects(createPOFormData.groupName, createPOFormData.subGroupName);
    setPendingProjectChange(null);
    setShowProjectChangeWarning(false);
  };

  const handleOrderBookSelect = async (e) => {
    const obId = e.target.value;
    setSelectedOrderBookId(obId);
    setOrderBookItems([]);
    setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: [] }));
    if (obId) await fetchOrderBookItems(obId);
  };
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new'); setVendorDropdownOpen(false); setVendorSearch('');
    setCreatePOFormData(prev => ({ ...prev, vendorId: null, vendorName: '', vendorContact: '' }));
  };
  const handleNewVendorContactChange = (value) => {
    setCreatePOFormData(prev => ({ ...prev, vendorContact: value.replace(/\D/g, '').slice(0, 10) }));
  };
  const handleVendorSelection = (e) => {
    const vendorId = e.target.value ? parseInt(e.target.value) : null;
    const sel = vendors.find(v => v.id === vendorId);
    setCreatePOFormData(prev => ({ ...prev, vendorId, vendorName: sel?.name || '', vendorContact: sel?.contactNumber || sel?.phone || '' }));
  };

  const poItems = orderBookItems.map((item, index) => {
    const totalQty   = parseFloat(item.quantity) || 0;
    const allocatedQty = parseFloat(item.allocatedQty) || 0;
    const remainingQty = Math.max(0, totalQty - allocatedQty);
    return {
      id: `orderbook-${index}`,
      orderBookItemId: item.id,           // link back to order_book_items.id
      itemName: item.itemName,
      itemDescription: item.specification || item.description || '',
      quotedQuantity: totalQty,           // total from order book
      allocatedQty,                       // already assigned to other POs
      remainingQty,                       // available to assign
      quantity: remainingQty,             // default to remaining
      unitPrice: 0, gst: item.taxPercent || 18, discount: 0, lineTotal: 0, selected: remainingQty > 0
    };
  });

  const handleSkipQuotationLoadOrderBook = () => {
    if (orderBookItems.length === 0) { showError('No order book items available'); return; }
    setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: poItems }));
    setItemsStepUnlocked(true);
    showSuccess(`Loaded ${poItems.length} items from order book`);
  };
  const handleLoadOrderBookItems = () => {
    if (orderBookItems.length === 0) { showError('No order book items available'); return; }
    setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: poItems }));
    setItemsStepUnlocked(true);
    showSuccess(`Loaded ${poItems.length} items from order book for new vendor`);
  };

  const handleQuotationSelect = async (quotationId) => {
    if (!quotationId) {
      setCreatePOFormData(prev => ({ ...prev, quotationId: '', quotation: null, items: [], vendorId: null, vendorName: '', vendorContact: '' }));
      setShowNewVendorForm(false); return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/quotations/${quotationId}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const qData = await r.json();
      const items = qData.items.map((item, i) => ({
        id: `quotation-${item.id}`, quotationItemId: item.id,
        itemName: item.itemName, itemDescription: item.description || '',
        quotedQuantity: item.quantity, quantity: item.quantity,
        unitPrice: item.unitPrice, gst: item.taxPercent, discount: 0, lineTotal: 0, selected: true
      }));
      items.forEach(item => {
        const base = item.quantity * item.unitPrice;
        const disc = base * (item.discount / 100);
        const tax  = (base - disc) * (item.gst / 100);
        item.lineTotal = (base - disc) + tax;
      });
      setCreatePOFormData(prev => ({
        ...prev, quotationId: qData.id, quotation: qData,
        paymentTerms: qData.paymentTerms || '', notes: qData.notes || '', items,
        vendorId: qData.vendorId || null, vendorName: qData.vendorName || qData.vendorContact || '', vendorContact: qData.vendorContact || ''
      }));
      setItemsStepUnlocked(true);
      setShowNewVendorForm(false);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleToggleItemSelection = (index) => {
    const newItems = [...createPOFormData.items];
    newItems[index].selected = !newItems[index].selected;
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleRemoveItem = async (index) => {
    const confirmed = await showConfirmation({ title: 'Remove Item', message: 'Remove this item?', type: 'alert', confirmText: 'Yes, Remove', cancelText: 'Cancel' });
    if (!confirmed) return;
    setCreatePOFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    showSuccess('Item removed');
  };
  const handleAddManualItem = () => {
    if (!newItem.itemName?.trim()) { showError('Item name is required'); return; }
    if (newItem.quantity <= 0) { showError('Quantity must be > 0'); return; }
    if (newItem.unitPrice <= 0) { showError('Unit price must be > 0'); return; }
    const base = newItem.quantity * newItem.unitPrice;
    const disc = base * (newItem.discount / 100);
    const tax  = (base - disc) * (newItem.gst / 100);
    const item = {
      id: `manual-${Date.now()}`, itemName: newItem.itemName,
      itemDescription: newItem.itemDescription, quantity: newItem.quantity,
      unitPrice: newItem.unitPrice, gst: newItem.gst, discount: newItem.discount,
      lineTotal: (base - disc) + tax, selected: true, isManual: true
    };
    setCreatePOFormData(prev => ({ ...prev, items: [...prev.items, item] }));
    setItemsStepUnlocked(true);
    setNewItem({ itemName: '', itemDescription: '', quantity: '', unitPrice: '', gst: 18, discount: '' });
    setShowManualItemForm(false);
    showSuccess('Manual item added');
  };
  const handleUpdatePOItemQuantity = (index, quantity) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    const qty = parseFloat(quantity) || 0;
    // Enforce max from quotation OR from orderBook remaining qty
    const maxQty = item.quotedQuantity || item.remainingQty;
    if (maxQty && qty > maxQty) {
      showError(`Quantity cannot exceed ${maxQty} (${item.remainingQty != null ? 'remaining from order book' : 'quoted quantity'})`);
      return;
    }
    item.quantity = qty;
    const base = qty * item.unitPrice; const disc = base * (item.discount / 100);
    const tax  = (base - disc) * (item.gst / 100);
    item.lineTotal = (base - disc) + tax;
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleUpdatePOItemPrice = (index, price) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    item.unitPrice = price === '' ? '' : parseFloat(price) || 0;
    if (item.unitPrice !== '') {
      const base = item.quantity * item.unitPrice; const disc = base * (item.discount / 100);
      item.lineTotal = (base - disc) + (base - disc) * (item.gst / 100);
    } else { item.lineTotal = 0; }
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const handleUpdatePOItemGST = (index, gst) => {
    const newItems = [...createPOFormData.items];
    const item = newItems[index];
    item.gst = parseFloat(gst);
    if (item.quantity && item.unitPrice) {
      const base = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      const disc = base * ((parseFloat(item.discount) || 0) / 100);
      item.lineTotal = (base - disc) * (1 + parseFloat(gst) / 100);
    }
    setCreatePOFormData(prev => ({ ...prev, items: newItems }));
  };
  const calculatePOTotal = () => createPOFormData.items.filter(i => i.selected).reduce((sum, i) => {
    const qty      = parseFloat(i.quantity)  || 0;
    const price    = parseFloat(i.unitPrice) || 0;
    const gst      = parseFloat(i.gst)       || 0;
    const discount = parseFloat(i.discount)  || 0;
    const base     = qty * price;
    const disc     = base * (discount / 100);
    return sum + (base - disc) * (1 + gst / 100);
  }, 0);

  // ─── API calls ─────────────────────────────────────────────────────────────
  const fetchPurchaseOrders = async () => {
    setLoading(true);
    const sortKeyMap = { poNumber: 'poNo', vendorName: 'vendorName', orderDate: 'orderDate', totalValue: 'totalValue', paymentStatus: 'paymentStatus', status: 'status' };
    try {
      const params = new URLSearchParams({
        page: currentPage, size: pageSize,
        sortBy: sortKeyMap[sortConfig.key] || 'orderDate',
        sortDirection: sortConfig.direction.toUpperCase()
      });
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.paymentStatus !== 'all') params.append('paymentStatus', filters.paymentStatus);
      if (filters.search) params.append('searchTerm', filters.search);
      const r = await fetch(`${API_BASE_URL}/purchase-orders?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setPurchaseOrders(data.purchaseOrders || []);
      setProjectNames(data.projectNames || {});
      setTotalPages(data.totalPages || 0); setTotalElements(data.totalElements || 0);
    } catch { showError('Failed to load purchase orders'); setPurchaseOrders([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      const r = await fetch(`${API_BASE_URL}/purchase-orders/stats?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) setStats(await r.json());
    } catch { console.error('Failed to fetch stats'); }
  };

  const fetchVendors = async () => {
    try {
      const url = `${API_BASE_URL}/vendors?page=0&size=1000`;
      const r = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      if (r.ok) { const data = await r.json(); setVendors(data.vendors || []); }
    } catch { setVendors([]); }
  };

  const handleViewPO = async (po) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      setSelectedPO(await r.json()); setShowDetailDrawer(true);
    } catch { showError('Failed to load PO details'); }
    finally { setLoading(false); }
  };

  const handleEditPO = async (poId) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const poData = await r.json();
      setIsEditMode(true); setEditingPOId(poId);
      setModalGroupName(poData.groupName || ''); setModalSubGroupName(poData.subGroupName || ''); setModalProjectId(poData.projectId || '');
      await fetchModalGroups();
      if (poData.groupName) await fetchModalSubGroups(poData.groupName);
      if (poData.groupName && poData.subGroupName) await fetchModalProjects(poData.groupName, poData.subGroupName);
      await fetchVendors();
      const items = (poData.items || []).map((item, i) => {
        const qty      = parseFloat(item.quantity)   || 0;
        const price    = parseFloat(item.unitPrice)  || 0;
        const gst      = parseFloat(item.taxPercent) || 0;
        const discount = parseFloat(item.discount)   || 0;
        const base     = qty * price;
        const disc     = base * (discount / 100);
        const lineTotal = (base - disc) * (1 + gst / 100);
        return {
          id: item.id || `item-${i}`, itemName: item.itemName, itemDescription: item.description || '',
          quantity: qty, unitPrice: price || '', gst,
          discount: discount || '', lineTotal, selected: true,
          quotedQuantity: item.quotedQuantity || null
        };
      });
      setCreatePOFormData({
        quotationId: poData.quotationId || '', quotation: null,
        vendorId: poData.vendorId || null, vendorName: poData.vendorName || '', vendorContact: poData.vendorContact || '',
        groupName: poData.groupName || '', subGroupName: poData.subGroupName || '', projectId: poData.projectId || '',
        orderDate: poData.orderDate ? new Date(poData.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDelivery: poData.expectedDelivery ? new Date(poData.expectedDelivery).toISOString().split('T')[0] : '',
        paymentTerms: poData.paymentTerms || '', shippingAddress: poData.deliveryAddress || '',
        notes: poData.notes || '', status: poData.status || 'Draft', items
      });
      setShowNewVendorForm(false); setShowCreatePOModal(true);
    } catch { showError('Failed to load purchase order details'); }
    finally { setLoading(false); }
  };

  const handleDeletePO = async (poId) => {
    const confirmed = await showConfirmation({ title: 'Delete Purchase Order', message: 'Delete this PO? This cannot be undone.', type: 'alert', confirmText: 'Yes, Delete', cancelText: 'Cancel' });
    if (!confirmed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}`, { method: 'DELETE', credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      showSuccess('Purchase order deleted successfully'); fetchPurchaseOrders(); fetchStats();
    } catch { showError('Failed to delete purchase order'); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (poId, newStatus) => {
    const confirmed = await showConfirmation({ title: 'Update Status', message: `Change status to "${newStatus}"?`, type: 'confirm', confirmText: 'Yes, Update', cancelText: 'Cancel' });
    if (!confirmed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}/status`, {
        credentials: 'include', method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus })
      });
      if (!r.ok) throw new Error();
      showSuccess(`PO status updated to ${newStatus}`); fetchPurchaseOrders(); fetchStats(); setShowDetailDrawer(false);
    } catch { showError('Failed to update PO status'); }
    finally { setLoading(false); }
  };

  const handleOpenDeliveryModal = (po, item) => {
    setDeliveryFormData({ poId: po.id, itemId: item.id, itemName: item.itemName, orderedQty: item.quantity, deliveredQty: item.deliveredQty, pendingQty: item.pendingQty, newDeliveryQty: 0 });
    setShowDeliveryModal(true);
  };

  const handleMarkDelivered = async () => {
    if (!deliveryFormData || deliveryFormData.newDeliveryQty <= 0) { showError('Please enter a valid delivery quantity'); return; }
    if (deliveryFormData.newDeliveryQty > deliveryFormData.pendingQty) { showError('Delivery quantity cannot exceed pending quantity'); return; }
    const confirmed = await showConfirmation({ title: 'Confirm Delivery', message: `Record delivery of ${deliveryFormData.newDeliveryQty} units for ${deliveryFormData.itemName}?`, type: 'confirm', confirmText: 'Confirm Delivery', cancelText: 'Cancel' });
    if (!confirmed) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${deliveryFormData.poId}/items/${deliveryFormData.itemId}/deliver`, {
        credentials: 'include', method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ deliveredQty: deliveryFormData.newDeliveryQty })
      });
      if (!r.ok) throw new Error();
      showSuccess('Delivery recorded successfully!'); setShowDeliveryModal(false);
      if (selectedPO) handleViewPO(selectedPO);
      fetchPurchaseOrders(); fetchStats();
    } catch { showError('Failed to record delivery'); }
    finally { setLoading(false); }
  };

  const handleOpenCreatePO = () => {
    setIsEditMode(false); setEditingPOId(null);
    setModalGroupName(''); setModalSubGroupName(''); setModalProjectId('');
    setCreatePOFormData({ quotationId: '', quotation: null, vendorId: null, vendorName: '', vendorContact: '', groupName: '', subGroupName: '', projectId: '', orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '', paymentTerms: '', shippingAddress: '', notes: '', items: [], status: 'Draft' });
    setOrderBooks([]); setSelectedOrderBookId(''); setOrderBookItems([]);
    setShowNewVendorForm(false); setShowManualItemForm(false); setQuotations([]); setOrderBookItems([]);
    setItemsStepUnlocked(false);
    fetchModalGroups(); fetchVendors(); setShowCreatePOModal(true);
  };

  const handleCloseCreatePOModal = () => {
    setShowCreatePOModal(false); setIsEditMode(false); setEditingPOId(null);
    setModalGroupName(''); setModalSubGroupName(''); setModalProjectId('');
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);
    setQuotations([]); setOrderBookItems([]); setShowNewVendorForm(false); setShowManualItemForm(false);
    setCreatePOFormData({ quotationId: '', quotation: null, vendorId: null, vendorName: '', vendorContact: '', groupName: '', subGroupName: '', projectId: '', orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '', paymentTerms: '', shippingAddress: '', notes: '', items: [], status: 'Draft' });
    setOrderBooks([]); setSelectedOrderBookId(''); setOrderBookItems([]);
    setItemsStepUnlocked(false);
    setPoFileUpload(null);
    if (poFileInputRef.current) poFileInputRef.current.value = '';
    setPendingProjectChange(null);
    setShowProjectChangeWarning(false);
  };

  // ─── PO File Upload Helpers ────────────────────────────────────────────────
  const handlePOFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const MAX = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX) { showError('File size must not exceed 10 MB'); e.target.value = ''; return; }
    const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
    if (!allowed.includes(file.type)) { showError('Only PDF, PNG, JPG files are allowed'); e.target.value = ''; return; }
    setPoFileUpload(file);
  };

  const handleUploadPOFile = async (poId) => {
    if (!poFileUpload) return;
    setPoFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', poFileUpload);
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${poId}/upload-file`, {
        method: 'POST', credentials: 'include',
        headers: getAuthHeaders(),
        body: fd
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
      showSuccess('PO document uploaded successfully!');
      setPoFileUpload(null);
      if (poFileInputRef.current) poFileInputRef.current.value = '';
    } catch (err) { showError(err.message || 'Failed to upload PO file'); }
    finally { setPoFileUploading(false); }
  };

  const handleViewPOFile = async (po) => {
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/view-file`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found or could not be loaded'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setPoFileModalUrl(blobUrl);
      setShowPOFileModal(true);
    } catch { showError('Failed to load PO document'); }
  };

  const handleOpenPOFileInTab = async (po) => {
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/view-file`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch { showError('Failed to open PO document'); }
  };

  const handleDownloadPOFile = async (po) => {
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/download-file`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!r.ok) { showError('File not found'); return; }
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = po.poFileName || 'po-document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch { showError('Failed to download PO document'); }
  };

  const handleCreatePO = async () => {
    if (!modalGroupName) { showError('Please select a group'); return; }
    if (!createPOFormData.vendorId && !showNewVendorForm) { showError('Please select a vendor or add a new vendor'); return; }
    if (showNewVendorForm) {
      if (!createPOFormData.vendorName?.trim()) { showError('Vendor name is required'); return; }
      if (!createPOFormData.vendorContact || createPOFormData.vendorContact.length !== 10) { showError('Please enter a valid 10-digit contact number'); return; }
      if (!createPOFormData.vendorCategory) { showError('Vendor category is required'); return; }
      if (!createPOFormData.vendorType) { showError('Vendor type is required'); return; }
    }
    const selectedItems = createPOFormData.items.filter(i => i.selected);
    if (selectedItems.length === 0) { showError('Please select at least one item'); return; }
    if (!selectedItems.every(i => i.quantity && parseFloat(i.quantity) > 0)) { showError('All selected items must have quantity > 0'); return; }
    if (selectedItems.some(i => !i.unitPrice || parseFloat(i.unitPrice) === 0)) { showError('Please enter unit price for all selected items'); return; }
    if (!createPOFormData.expectedDelivery) { showError('Expected delivery date is required'); return; }
    setLoading(true);
    try {
      const poItems = selectedItems.map(({ itemName, itemDescription, quantity, unitPrice, gst, discount }) => ({
        itemName, itemDescription,
        quantity: parseFloat(quantity), unitPrice: parseFloat(unitPrice) || 0,
        gst: parseFloat(gst), discount: parseFloat(discount) || 0
      }));
      const poData = {
        quotationId: createPOFormData.quotationId || null,
        vendorId: createPOFormData.vendorId || null,
        vendorName: showNewVendorForm ? createPOFormData.vendorName : null,
        vendorContact: createPOFormData.vendorContact || null,
        vendorCategory: showNewVendorForm ? createPOFormData.vendorCategory : null,
        vendorType: showNewVendorForm ? createPOFormData.vendorType : null,
        rfqId: createPOFormData.quotation?.rfqId || null,
        groupName: modalGroupName, subGroupName: modalSubGroupName || null, projectId: modalProjectId || null,
        orderDate: createPOFormData.orderDate, expectedDelivery: createPOFormData.expectedDelivery,
        paymentTerms: createPOFormData.paymentTerms, shippingAddress: createPOFormData.shippingAddress,
        notes: createPOFormData.notes, items: poItems, status: createPOFormData.status || 'Draft', paymentStatus: 'Pending'
      };
      let response;
      if (isEditMode && editingPOId) {
        response = await fetch(`${API_BASE_URL}/purchase-orders/${editingPOId}`, {
          credentials: 'include', method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(poData)
        });
      } else {
        const endpoint = createPOFormData.quotationId ? `${API_BASE_URL}/purchase-orders/from-quotation` : `${API_BASE_URL}/purchase-orders`;
        response = await fetch(endpoint, {
          credentials: 'include', method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(poData)
        });
      }
      if (!response.ok) { const err = await response.json(); throw new Error(err.message || 'Failed'); }
      const result = await response.json();
      const savedId = result.id || result.data?.id;
      // Upload soft-copy file if one was selected
      if (poFileUpload && savedId) {
        await handleUploadPOFile(savedId);
      }
      showSuccess(`PO ${result.poNo || result.data?.poNo} ${isEditMode ? 'updated' : 'created'} successfully!`);
      handleCloseCreatePOModal(); fetchPurchaseOrders(); fetchStats();
    } catch (error) { showError(error.message || `Failed to ${isEditMode ? 'update' : 'create'} purchase order`); }
    finally { setLoading(false); }
  };

  const handleViewVendorPOs = async (vendorId) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/purchase-orders/vendor/${vendorId}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      showSuccess(`Found ${data.length} purchase orders for this vendor`);
    } catch { showError('Failed to load vendor purchase orders'); }
    finally { setLoading(false); }
  };

  // ─── Formatters ────────────────────────────────────────────────────────────
  const formatCurrency = (amount) => !amount ? '₹0' : `₹${amount.toLocaleString('en-IN')}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const getStatusBadgeClass = (status) => ({ Draft: 'po-badge-draft', Approved: 'po-badge-approved', Ordered: 'po-badge-ordered', 'In-Transit': 'po-badge-transit', Delivered: 'po-badge-delivered', Cancelled: 'po-badge-cancelled' }[status] || '');
  const getPaymentBadgeClass = (status) => ({ Pending: 'po-payment-pending', 'Partially Paid': 'po-payment-partial', Paid: 'po-payment-paid' }[status] || '');
  const calculateDeliveryProgress = (po) => {
    if (!po.totalItemsOrdered || po.totalItemsOrdered === 0) return 0;
    return Math.round((po.totalItemsDelivered / po.totalItemsOrdered) * 100);
  };

  // ─── Render cell by column id ──────────────────────────────────────────────
  const renderCell = (col, po) => {
    const progress = calculateDeliveryProgress(po);
    switch (col.id) {
      case 'poNumber':
        return <td key={col.id} className="purchase-orders-table-id">{po.poNo}</td>;
      case 'vendorId':
        return <td key={col.id}><button className="vendor-link" onClick={() => handleViewVendorPOs(po.vendorId)}>{po.vendorName || `Vendor #${po.vendorId}`}</button></td>;
      case 'vendorName':
        return <td key={col.id}>{po.vendorName || (po.vendorId ? `Vendor #${po.vendorId}` : '—')}</td>;
      case 'orderDate':
        return <td key={col.id}>{formatDate(po.orderDate)}</td>;
      case 'totalValue':
        return <td key={col.id} className="purchase-orders-table-value">{formatCurrency(po.totalValue)}</td>;
      case 'deliveryProgress':
        return (
          <td key={col.id}>
            <div className="delivery-progress">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              <span className="progress-text">{po.totalItemsDelivered}/{po.totalItemsOrdered} items ({progress}%)</span>
            </div>
          </td>
        );
      case 'paymentStatus':
        return <td key={col.id}><span className={`purchase-orders-badge ${getPaymentBadgeClass(po.paymentStatus)}`}>{po.paymentStatus}</span></td>;
      case 'status':
        return <td key={col.id}><span className={`purchase-orders-badge ${getStatusBadgeClass(po.status)}`}>{po.status}</span></td>;
      case 'actions':
        return (
          <td key={col.id}>
            <div className="purchase-orders-actions-cell">
              {/* View */}
              <button
                className={`purchase-orders-action-btn${!canView ? ' action-btn-disabled' : ''}`}
                onClick={() => canView && handleViewPO(po)}
                title={canView ? 'View Details' : '🔒 No view permission'}
                disabled={!canView}
              >
                <Eye size={14} />
              </button>

              {/* Edit */}
              <button
                className={`purchase-orders-action-btn${!canEdit ? ' action-btn-disabled' : ''}`}
                onClick={() => canEdit && handleEditPO(po.id)}
                title={canEdit ? 'Edit PO' : '🔒 No edit permission'}
                style={{ color: canEdit ? '#3b82f6' : undefined }}
                disabled={!canEdit}
              >
                <Edit2 size={14} />
              </button>

              {/* Mark Delivered — only for active POs */}
              {po.status !== 'Delivered' && po.status !== 'Cancelled' && (
                <button
                  className={`purchase-orders-action-btn${!canEdit ? ' action-btn-disabled' : ''}`}
                  onClick={() => canEdit && handleUpdateStatus(po.id, 'Delivered')}
                  title={canEdit ? 'Mark Delivered' : '🔒 No edit permission'}
                  style={{ color: canEdit ? '#10b981' : undefined }}
                  disabled={!canEdit}
                >
                  <CheckCircle size={14} />
                </button>
              )}

              {/* Delete — always shown, disabled if no permission */}
              <button
                className={`purchase-orders-action-btn${!canDelete ? ' action-btn-disabled' : ''}`}
                onClick={() => canDelete && handleDeletePO(po.id)}
                title={canDelete ? 'Delete PO' : '🔒 No delete permission'}
                style={{ color: canDelete ? '#ef4444' : undefined }}
                disabled={!canDelete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        );
      case 'group':
        return <td key={col.id}>{po.groupName || '—'}</td>;
      case 'category':
        return <td key={col.id}>{po.vendorCategory || po.category || '—'}</td>;
      case 'project': {
        const pName = projectNames[po.projectId];
        return (
          <td key={col.id}>
            {po.projectId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                  {pName || po.projectId}
                </span>
                {pName && (
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                    {po.projectId}
                  </span>
                )}
              </div>
            ) : <span style={{ color: '#94a3b8' }}>—</span>}
          </td>
        );
      }
      default:
        return <td key={col.id}>—</td>;
    }
  };

  // ─── Export all purchase orders to Excel ────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const exportParams = new URLSearchParams({ page: 0, size: 99999, sortBy: 'orderDate', sortDirection: 'DESC' });
      const activeGroup    = filters.groupName    || groupName    || null;
      const activeSubGroup = filters.subGroupName || subGroupName || null;
      const activeProject  = projectId || null;
      if (activeGroup)    exportParams.append('groupName',    activeGroup);
      if (activeSubGroup) exportParams.append('subGroupName', activeSubGroup);
      if (activeProject)  exportParams.append('projectId',    activeProject);
      if (filters.status        !== 'all') exportParams.append('status',        filters.status);
      if (filters.paymentStatus !== 'all') exportParams.append('paymentStatus', filters.paymentStatus);
      if (filters.search)                  exportParams.append('searchTerm',    filters.search.trim());

      const res = await fetch(`${API_BASE_URL}/purchase-orders?${exportParams}`, {
        headers: getAuthHeaders(), credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch PO data for export');
      const data = await res.json();
      const allPOs = data.purchaseOrders || [];
      const pNames = data.projectNames || {};
      if (allPOs.length === 0) { showError('No purchase orders found to export.'); return; }

      const EXPORT_COLS = [
        { key: 'poNo',            label: 'PO Number'              },
        { key: 'vendorName',      label: 'Vendor Name'            },
        { key: 'orderDate',       label: 'Order Date'             },
        { key: 'totalValue',      label: 'Total Value (₹)'        },
        { key: 'status',          label: 'Status'                 },
        { key: 'paymentStatus',   label: 'Payment Status'         },
        { key: 'groupName',       label: 'Group'                  },
        { key: 'subGroupName',    label: 'Sub Group'              },
        { key: 'projectName',     label: 'Project Name'           },
        { key: 'projectId',       label: 'Project ID'             },
        { key: 'rfqId',           label: 'RFQ ID'                 },
        { key: 'category',        label: 'Category'               },
        { key: 'deliveryDate',    label: 'Delivery Date'          },
        { key: 'paymentTerms',    label: 'Payment Terms'          },
        { key: 'notes',           label: 'Notes'                  },
      ];

      const totalCols = EXPORT_COLS.length;
      const now       = new Date();
      const dateStr   = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      const esc       = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

      const headerCells = EXPORT_COLS.map(({ label }) =>
        `<th style="background:#1e3a5f;color:#ffffff;font-weight:bold;font-size:11pt;padding:7px 10px;border:1px solid #334155;white-space:nowrap;text-align:left">${esc(label)}</th>`
      ).join('');

      const dataRowsHtml = allPOs.map((po, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const cells = EXPORT_COLS.map(({ key }) => {
          let val = po[key] ?? '';
          if (key === 'projectName') val = pNames[po.projectId] || '';
          if (key === 'projectId')   val = po.projectId || '';
          if ((key === 'orderDate' || key === 'deliveryDate') && val)
            val = new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          return `<td style="padding:5px 10px;border:1px solid #e2e8f0;background:${bg};font-size:10pt">${esc(val)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>Purchase Orders</x:Name>
  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif">
  <tr>
    <td style="font-weight:bold;font-size:14pt;padding:10px 12px;border:none;background:#ffffff;white-space:nowrap;vertical-align:middle">
      Purchase Orders
    </td>
    <td style="font-weight:bold;font-size:11pt;padding:10px 12px;border:none;background:#ffffff;white-space:nowrap;vertical-align:middle;color:#475569">
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
      a.download = `PurchaseOrders_${now.toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`${allPOs.length} purchase order${allPOs.length !== 1 ? 's' : ''} exported successfully`);
    } catch (err) {
      console.error('Export error:', err);
      showError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ─── KPI ───────────────────────────────────────────────────────────────────
  const kpiData = stats ? [
    { title: 'Total POs',   value: stats.totalPOs.toString(),        icon: <FileText size={32} />,    color: '#2563eb' },
    { title: 'In Transit',  value: stats.inTransit.toString(),       icon: <Truck size={32} />,       color: '#f59e0b' },
    { title: 'Delivered',   value: stats.delivered.toString(),       icon: <CheckCircle size={32} />, color: '#22c55e' },
    { title: 'Total Value', value: formatCurrency(stats.totalValue), icon: <IndianRupee size={32} />, color: '#8b5cf6' },
  ] : [];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="purchase-orders-container">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal
        show={confirmModal.show} title={confirmModal.title} message={confirmModal.message}
        type={confirmModal.type} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText}
        onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel}
      />

      {/* Header */}
      <div className="purchase-orders-header">
        <div className="purchase-orders-breadcrumb">Dashboard &gt; Procurement &gt; Purchase Orders</div>
        <div className="page-header-with-filter">
          <h1 className="purchase-orders-title">
            Purchase Orders <span className="purchase-orders-count">({totalElements})</span>
          </h1>
          <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="purchase-orders-action-bar">
        <div className="purchase-orders-search-filters">
          <input type="text" placeholder="Search by PO Number, RFQ ID, Vendor Name..." className="purchase-orders-search" value={filters.search}
            onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value })); setCurrentPage(0); }} />
          <select className="purchase-orders-filter" value={filters.status}
            onChange={(e) => { setFilters(prev => ({ ...prev, status: e.target.value })); setCurrentPage(0); }}>
            <option value="all">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Ordered">Ordered</option>
            <option value="In-Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select className="purchase-orders-filter" value={filters.paymentStatus}
            onChange={(e) => { setFilters(prev => ({ ...prev, paymentStatus: e.target.value })); setCurrentPage(0); }}>
            <option value="all">All Payment Status</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="purchase-orders-actions">
          {/* Columns Picker */}
          <div className="po-columns-picker-wrapper">
            <button
              className="purchase-orders-btn-secondary po-btn--columns"
              onClick={() => setShowColumnsPicker(v => !v)}
              title="Manage Columns"
            >
              <Columns size={16} />
              <span>Columns</span>
              <span className="po-columns-count-badge">{visibleColumns.length}/{columns.length}</span>
            </button>
            {showColumnsPicker && (
              <ColumnsPicker columns={columns} onToggle={toggleColumnVisibility} onClose={() => setShowColumnsPicker(false)} />
            )}
          </div>

          <button className={`purchase-orders-btn-primary${!canCreate ? ' action-btn-disabled' : ''}`} onClick={() => canCreate && handleOpenCreatePO()} disabled={!canCreate} title={!canCreate ? "🔒 No create permission" : "Create PO"}>
            <Plus size={16} /> Create PO
          </button>
          <button className="purchase-orders-btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {/* Permission notice for view-only users */}
      {isViewOnly && (
        <div className="po-permission-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          You have view-only access. Contact your administrator to request Create, Edit, Approve or Delete permissions.
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="purchase-orders-kpi-grid">
          {kpiData.map((kpi, i) => (
            <div key={i} className="purchase-orders-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="purchase-orders-kpi-icon">{kpi.icon}</div>
              <div className="purchase-orders-kpi-content">
                <div className="purchase-orders-kpi-value">{kpi.value}</div>
                <div className="purchase-orders-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="purchase-orders-table-container">
        <div className="purchase-orders-table-scroll">
          <table className="purchase-orders-table">
            <thead>
              <tr>
                {visibleColumns.map((col, visIdx) => (
                  <DraggableTH
                    key={col.id} col={col} index={visIdx}
                    onDragStart={handleDragStart} onDragOver={handleDragOver}
                    onDrop={handleDrop} onDragEnd={handleDragEnd}
                    isDragOver={dragOverIndex === visIdx}
                    sortConfig={sortConfig} onSort={handleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr><td colSpan={visibleColumns.length} className="empty-state">No purchase orders found</td></tr>
              ) : (
                purchaseOrders.map((po) => (
                  <tr key={po.id} className="purchase-orders-table-row">
                    {visibleColumns.map((col) => renderCell(col, po))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="table-footer">
          <div className="pagination-info">
            <span>Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} purchase orders</span>
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
              return <button key={pageNum} className={`page-btn ${pageNum === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(pageNum)}>{pageNum + 1}</button>;
            })}
            <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>Next</button>
            <button className="page-btn" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>»</button>
          </div>
        </div>
      </div>

      {/* ─── Detail Drawer ────────────────────────────────────────────────────── */}
      {showDetailDrawer && selectedPO && (
        <div className="purchase-orders-drawer-overlay">
          <div className="purchase-orders-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-drawer-header">
              <div>
                <h2>{selectedPO.poNo}</h2>
                <p className="purchase-orders-drawer-subtitle">
                  {selectedPO.vendorName || (selectedPO.vendorId ? `Vendor #${selectedPO.vendorId}` : 'No vendor')}
                  {selectedPO.vendorContact ? ` · ${selectedPO.vendorContact}` : ''}
                </p>
              </div>
              <button className="purchase-orders-drawer-close" onClick={() => setShowDetailDrawer(false)}>✕</button>
            </div>
            <div className="purchase-orders-drawer-content">

              {/* ── Vendor Details ── */}
              <div className="purchase-orders-drawer-section">
                <h3>Vendor Details</h3>
                <div className="po-details-grid">
                  <div className="po-detail-item">
                    <span className="po-detail-label">Vendor Name:</span>
                    <span style={{fontWeight:600}}>
                      {selectedPO.vendorName || (selectedPO.vendorId ? `Vendor #${selectedPO.vendorId}` : '—')}
                    </span>
                  </div>
                  <div className="po-detail-item">
                    <span className="po-detail-label">Contact:</span>
                    <span>{selectedPO.vendorContact || '—'}</span>
                  </div>
                  {selectedPO.vendorId && (
                    <div className="po-detail-item">
                      <span className="po-detail-label">Vendor ID:</span>
                      <span>
                        <button className="vendor-link" style={{fontSize:12}} onClick={() => handleViewVendorPOs(selectedPO.vendorId)}>
                          #{selectedPO.vendorId} — View all POs
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── PO Details ── */}
              <div className="purchase-orders-drawer-section">
                <h3>Purchase Order Details</h3>
                <div className="po-details-grid">
                  <div className="po-detail-item"><span className="po-detail-label">Status:</span><span className={`purchase-orders-badge ${getStatusBadgeClass(selectedPO.status)}`}>{selectedPO.status}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Payment Status:</span><span className={`purchase-orders-badge ${getPaymentBadgeClass(selectedPO.paymentStatus)}`}>{selectedPO.paymentStatus}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Order Date:</span><span>{formatDate(selectedPO.orderDate)}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Expected Delivery:</span><span>{formatDate(selectedPO.expectedDelivery) || '—'}</span></div>
                  <div className="po-detail-item"><span className="po-detail-label">Total Value:</span><span className="po-value">{formatCurrency(selectedPO.totalValue)}</span></div>
                  {selectedPO.groupName && (
                    <div className="po-detail-item"><span className="po-detail-label">Group:</span><span>{selectedPO.groupName}{selectedPO.subGroupName ? ` / ${selectedPO.subGroupName}` : ''}</span></div>
                  )}
                  {selectedPO.projectId && (
                    <div className="po-detail-item"><span className="po-detail-label">Project:</span><span>{selectedPO.projectId}</span></div>
                  )}
                  {selectedPO.quotationId && (
                    <div className="po-detail-item"><span className="po-detail-label">Quotation Ref:</span><span>#{selectedPO.quotationId}</span></div>
                  )}
                  {selectedPO.paymentTerms && (
                    <div className="po-detail-item"><span className="po-detail-label">Payment Terms:</span><span>{selectedPO.paymentTerms}</span></div>
                  )}
                  {selectedPO.deliveryAddress && (
                    <div className="po-detail-item" style={{gridColumn:'1/-1'}}>
                      <span className="po-detail-label">Delivery Address:</span>
                      <span>{selectedPO.deliveryAddress}</span>
                    </div>
                  )}
                  {selectedPO.notes && (
                    <div className="po-detail-item" style={{gridColumn:'1/-1'}}>
                      <span className="po-detail-label">Notes:</span>
                      <span style={{color:'#6b7280'}}>{selectedPO.notes}</span>
                    </div>
                  )}
                </div>

                {/* PO Soft Copy Document */}
                {selectedPO.poFileName ? (
                  <div className="po-doc-section">
                    <div className="po-doc-header">
                      <File size={16} />
                      <span className="po-doc-title">PO Document</span>
                    </div>
                    <div className="po-doc-filename">
                      {selectedPO.poFileName}
                      {selectedPO.poFileSize && (
                        <span className="po-doc-size"> ({(selectedPO.poFileSize / 1024).toFixed(1)} KB)</span>
                      )}
                    </div>
                    <div className="po-doc-actions">
                      <button className="po-doc-btn po-doc-btn-view" onClick={() => handleViewPOFile(selectedPO)}>
                        <Eye size={14} /> View
                      </button>
                      <button className="po-doc-btn po-doc-btn-open" onClick={() => handleOpenPOFileInTab(selectedPO)}>
                        <ExternalLink size={14} /> Open in Tab
                      </button>
                      <button className="po-doc-btn po-doc-btn-download" onClick={() => handleDownloadPOFile(selectedPO)}>
                        <Download size={14} /> Download
                      </button>
                    </div>
                    {/* Allow replacing the file directly from the drawer for any PO status */}
                    {canEdit && (
                      <div className="po-file-upload-row" style={{ marginTop: 10 }}>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          id="drawer-po-file-input"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) { showError('File size must not exceed 10 MB'); e.target.value = ''; return; }
                            const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
                            if (!allowed.includes(file.type)) { showError('Only PDF, PNG, JPG files are allowed'); e.target.value = ''; return; }
                            setPoFileUploading(true);
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const r = await fetch(`${API_BASE_URL}/purchase-orders/${selectedPO.id}/upload-file`, {
                                method: 'POST', credentials: 'include', headers: getAuthHeaders(), body: fd
                              });
                              if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
                              showSuccess('PO document replaced successfully!');
                              handleViewPO(selectedPO); // refresh drawer
                            } catch (err) { showError(err.message || 'Failed to upload PO file'); }
                            finally { setPoFileUploading(false); e.target.value = ''; }
                          }}
                        />
                        <label htmlFor="drawer-po-file-input" className="po-file-choose-btn" style={{ cursor: poFileUploading ? 'not-allowed' : 'pointer', opacity: poFileUploading ? 0.6 : 1 }}>
                          <Upload size={13} /> {poFileUploading ? 'Uploading…' : 'Replace File'}
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="po-doc-section po-doc-empty">
                    <File size={15} style={{ color: '#9ca3af' }} />
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>No PO document attached</span>
                    {/* Allow uploading directly from the drawer for any PO status */}
                    {canEdit && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          id="drawer-po-file-input-new"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) { showError('File size must not exceed 10 MB'); e.target.value = ''; return; }
                            const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
                            if (!allowed.includes(file.type)) { showError('Only PDF, PNG, JPG files are allowed'); e.target.value = ''; return; }
                            setPoFileUploading(true);
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const r = await fetch(`${API_BASE_URL}/purchase-orders/${selectedPO.id}/upload-file`, {
                                method: 'POST', credentials: 'include', headers: getAuthHeaders(), body: fd
                              });
                              if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
                              showSuccess('PO document uploaded successfully!');
                              handleViewPO(selectedPO); // refresh drawer
                            } catch (err) { showError(err.message || 'Failed to upload PO file'); }
                            finally { setPoFileUploading(false); e.target.value = ''; }
                          }}
                        />
                        <label htmlFor="drawer-po-file-input-new" className="po-file-choose-btn" style={{ cursor: poFileUploading ? 'not-allowed' : 'pointer', opacity: poFileUploading ? 0.6 : 1 }}>
                          <Upload size={13} /> {poFileUploading ? 'Uploading…' : 'Upload PO Document'}
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Delivery Summary ── */}
              {(selectedPO.totalItemsOrdered != null) && (
                <div className="purchase-orders-drawer-section">
                  <h3>Delivery Summary</h3>
                  <div className="po-details-grid">
                    <div className="po-detail-item"><span className="po-detail-label">Items Ordered:</span><span>{selectedPO.totalItemsOrdered ?? '—'}</span></div>
                    <div className="po-detail-item"><span className="po-detail-label">Items Delivered:</span><span style={{color:'#059669',fontWeight:600}}>{selectedPO.totalItemsDelivered ?? 0}</span></div>
                    <div className="po-detail-item"><span className="po-detail-label">Items Pending:</span><span style={{color: (selectedPO.totalItemsPending ?? 0) > 0 ? '#dc2626' : '#059669', fontWeight:600}}>{selectedPO.totalItemsPending ?? 0}</span></div>
                  </div>
                </div>
              )}

              {/* ── Order Items ── */}
              <div className="purchase-orders-drawer-section">
                <h3>Order Items</h3>
                <table className="po-items-table">
                  <thead>
                    <tr><th>Item Name</th><th>Qty Ordered</th><th>Delivered</th><th>Pending</th><th>Unit Price</th><th>GST%</th><th>Line Total</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {selectedPO.items && selectedPO.items.length > 0 ? selectedPO.items.map((item) => {
                      const qty      = parseFloat(item.quantity)   || 0;
                      const price    = parseFloat(item.unitPrice)  || 0;
                      const gst      = parseFloat(item.taxPercent) || 0;
                      const discount = parseFloat(item.discount)   || 0;
                      const base     = qty * price;
                      const disc     = base * (discount / 100);
                      const computedLineTotal = (base - disc) * (1 + gst / 100);
                      return (
                      <tr key={item.id}>
                        <td>
                          <div style={{fontWeight:500}}>{item.itemName}</div>
                          {item.description && <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{item.description}</div>}
                        </td>
                        <td>{item.quantity}</td>
                        <td className="delivered-qty">{item.deliveredQty ?? 0}</td>
                        <td className="pending-qty" style={{color: (item.pendingQty ?? 0) > 0 ? '#dc2626' : '#374151'}}>
                          {item.pendingQty ?? 0}
                        </td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{item.taxPercent != null ? `${item.taxPercent}%` : '—'}</td>
                        <td>{formatCurrency(computedLineTotal)}</td>
                        <td>{(item.pendingQty ?? 0) > 0 && selectedPO.status !== 'Cancelled' && (
                          <button className="purchase-orders-btn-small" onClick={() => handleOpenDeliveryModal(selectedPO, item)}>Mark Delivered</button>
                        )}</td>
                      </tr>
                      );
                    }) : (
                      <tr><td colSpan={8} style={{textAlign:'center',padding:'1rem',color:'#9ca3af'}}>No items found</td></tr>
                    )}
                  </tbody>
                  {selectedPO.items && selectedPO.items.length > 0 && (
                    <tfoot>
                      <tr style={{borderTop:'2px solid #e5e7eb',fontWeight:600}}>
                        <td colSpan={6} style={{textAlign:'right',padding:'8px 10px'}}>Grand Total:</td>
                        <td style={{padding:'8px 10px'}}>
                          {formatCurrency(
                            (selectedPO.items || []).reduce((sum, item) => {
                              const qty      = parseFloat(item.quantity)   || 0;
                              const price    = parseFloat(item.unitPrice)  || 0;
                              const gst      = parseFloat(item.taxPercent) || 0;
                              const discount = parseFloat(item.discount)   || 0;
                              const base     = qty * price;
                              const disc     = base * (discount / 100);
                              return sum + (base - disc) * (1 + gst / 100);
                            }, 0)
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="purchase-orders-drawer-actions">
                {selectedPO.status !== 'Delivered' && selectedPO.status !== 'Cancelled' && (
                  <>
                    <button className="purchase-orders-btn-primary" onClick={() => handleUpdateStatus(selectedPO.id, 'In-Transit')}>Mark In Transit</button>
                    <button className="purchase-orders-btn-primary" onClick={() => handleUpdateStatus(selectedPO.id, 'Delivered')}>Mark All Delivered</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PO File Preview Modal ─────────────────────────────────────────────── */}
      {showPOFileModal && (
        <div className="po-file-preview-overlay">
          <div className="po-file-preview-container" onClick={(e) => e.stopPropagation()}>
            <div className="po-file-preview-header">
              <span className="po-file-preview-title"><File size={16} /> PO Document Preview</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="po-doc-btn po-doc-btn-open" onClick={() => window.open(poFileModalUrl, '_blank')}>
                  <ExternalLink size={13} /> Open in Tab
                </button>
                <button className="po-doc-btn po-doc-btn-download" onClick={() => {
                  const a = document.createElement('a');
                  a.href = poFileModalUrl;
                  a.download = selectedPO?.poFileName || 'po-document';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}>
                  <Download size={13} /> Download
                </button>
                <button className="purchase-orders-modal-close" style={{ marginLeft: 4 }} onClick={() => {
                  window.URL.revokeObjectURL(poFileModalUrl);
                  setPoFileModalUrl('');
                  setShowPOFileModal(false);
                }}>✕</button>
              </div>
            </div>
            <iframe
              src={poFileModalUrl}
              title="PO Document"
              className="po-file-preview-iframe"
              style={{ width: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* ─── Delivery Modal ───────────────────────────────────────────────────── */}
      {showDeliveryModal && deliveryFormData && (
        <div className="purchase-orders-modal-overlay">
          <div className="purchase-orders-delivery-modal" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-orders-modal-header">
              <h2>Mark Item Delivered</h2>
              <button className="purchase-orders-modal-close" onClick={() => setShowDeliveryModal(false)}>✕</button>
            </div>
            <div className="purchase-orders-modal-content">
              <div className="delivery-item-info">
                <h3>{deliveryFormData.itemName}</h3>
                <div className="delivery-stats">
                  <div className="delivery-stat"><span className="delivery-stat-label">Ordered:</span><span className="delivery-stat-value">{deliveryFormData.orderedQty}</span></div>
                  <div className="delivery-stat"><span className="delivery-stat-label">Already Delivered:</span><span className="delivery-stat-value">{deliveryFormData.deliveredQty}</span></div>
                  <div className="delivery-stat"><span className="delivery-stat-label">Pending:</span><span className="delivery-stat-value pending">{deliveryFormData.pendingQty}</span></div>
                </div>
              </div>
              <div className="delivery-form-group">
                <label>Quantity Delivered Now *</label>
                <input type="number" min="0" max={deliveryFormData.pendingQty} value={deliveryFormData.newDeliveryQty}
                  onChange={(e) => setDeliveryFormData(prev => ({ ...prev, newDeliveryQty: parseFloat(e.target.value) || 0 }))}
                  placeholder="Enter quantity delivered" />
                <small>Maximum: {deliveryFormData.pendingQty} units</small>
              </div>
            </div>
            <div className="purchase-orders-modal-actions">
              <button className="purchase-orders-btn-primary" onClick={handleMarkDelivered} disabled={deliveryFormData.newDeliveryQty <= 0}>Confirm Delivery</button>
              <button className="purchase-orders-btn-secondary" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create / Edit PO Modal (unchanged logic) ─────────────────────────── */}
      {showCreatePOModal && (
        <div className="purchase-orders-modal-overlay">
          <div className="purchase-orders-create-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="purchase-orders-modal-header" style={{ flexShrink: 0 }}>
              <h2>{isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <button className="purchase-orders-modal-close" onClick={handleCloseCreatePOModal}><X size={24} /></button>
            </div>

            <div className="purchase-orders-modal-content" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Step 1: Project Selection */}
              <div className="po-form-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '2px solid #e2e8f0' }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>📂</span> Step 1: Select Project</h3>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  {isEditMode
                    ? 'Change the project assignment for this PO. Existing items will be preserved.'
                    : 'Choose a project to load approved quotations or order book items'}
                </p>
                <div className="po-form-row">
                  <div className="po-form-group">
                    <label>Group *</label>
                    <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                      <option value="">{modalDropdownLoading.groups ? 'Loading...' : 'Select Group'}</option>
                      {modalGroups.map((g, i) => <option key={g.value || i} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="po-form-group">
                    <label>Sub Group</label>
                    <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                      <option value="">{modalDropdownLoading.subGroups ? 'Loading...' : 'Select Sub Group'}</option>
                      {modalSubGroups.map((s, i) => <option key={s.value || i} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="po-form-group">
                    <label>Project *</label>
                    <select value={modalProjectId} onChange={handleModalProjectChange} disabled={!modalSubGroupName || modalDropdownLoading.projects} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                      <option value="">{modalDropdownLoading.projects ? 'Loading...' : 'Select Project'}</option>
                      {modalProjects.map((p, i) => <option key={p.id || i} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                {loadingOrderItems && <div style={{ marginTop: '12px', padding: '10px', background: '#dbeafe', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>🔄 Loading quotations and order books...</div>}
              </div>

              {/* ─── Edit-mode Project Change Warning Banner ──────────────────── */}
              {showProjectChangeWarning && isEditMode && (
                <div style={{ padding: '18px 20px', background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#92400e', marginBottom: '6px' }}>
                      Change Project for This Purchase Order?
                    </div>
                    <div style={{ fontSize: '13px', color: '#78350f', marginBottom: '14px' }}>
                      You are changing the project while there are <strong>{createPOFormData.items.length} item(s)</strong> in this PO.
                      Click <em>"Keep Items &amp; Change Project"</em> to update only the project assignment without touching the items.
                      Or click <em>"Cancel"</em> to revert.
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleConfirmProjectChange}
                        style={{ padding: '9px 18px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                      >
                        ✅ Keep Items &amp; Change Project
                      </button>
                      <button
                        onClick={handleCancelProjectChange}
                        style={{ padding: '9px 18px', background: 'white', color: '#92400e', border: '1.5px solid #f59e0b', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Quotation / Order Book */}
              {modalProjectId && (
                <div className="po-form-section">
                  {quotations.length > 0 && orderBooks.length > 0 && (
                    <>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><span>✅</span> Choose Your Option</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ padding: '20px', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px' }}>
                          <h4 style={{ marginBottom: '8px', color: '#166534', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>📋</span> Option 1: Use Quotation</h4>
                          <p style={{ fontSize: '13px', color: '#059669', marginBottom: '12px' }}>Select from {quotations.length} available quotation(s)</p>
                          {!createPOFormData.quotationId && (
                            <div className="po-form-group" style={{ marginTop: '12px' }}>
                              <select value={createPOFormData.quotationId} onChange={(e) => handleQuotationSelect(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                                <option value="">Select Quotation</option>
                                {quotations.map(q => <option key={q.id} value={q.id}>{q.quoteNo} — {q.vendorName || q.vendorContact || 'Unknown Vendor'} {q.totalValue ? `— ${formatCurrency(q.totalValue)}` : ''} [{q.status}]</option>)}
                              </select>
                            </div>
                          )}
                          {createPOFormData.quotationId && (
                            <div style={{ marginTop: '12px', padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #86efac' }}>
                              <div style={{ fontSize: '13px', color: '#166534', marginBottom: '4px' }}>✓ {createPOFormData.quotation?.quoteNo}</div>
                              <button onClick={() => handleQuotationSelect('')} style={{ fontSize: '12px', padding: '4px 8px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', color: '#dc2626' }}>Clear</button>
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '20px', background: '#eff6ff', border: '2px solid #93c5fd', borderRadius: '8px' }}>
                          <h4 style={{ marginBottom: '8px', color: '#1e40af', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>📦</span> Option 2: Load from Order Book</h4>
                          <div className="po-form-group" style={{ marginTop: '8px' }}>
                            <select value={selectedOrderBookId} onChange={handleOrderBookSelect} style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid #93c5fd' }}>
                              <option value="">-- Select Order Book --</option>
                              {orderBooks.map(ob => (
                                <option key={ob.id} value={ob.id}>
                                  {ob.poNumber || ob.orderBookNo} — {ob.orderTitle ? (ob.orderTitle.length > 30 ? ob.orderTitle.substring(0, 30) + '...' : ob.orderTitle) : 'No Title'}
                                </option>
                              ))}
                            </select>
                          </div>
                          {loadingOrderItems && <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '6px' }}>🔄 Loading...</div>}
                          {selectedOrderBookId && orderBookItems.length > 0 && (createPOFormData.items.length === 0 || createPOFormData.quotationId) && (
                            <button className="purchase-orders-btn-primary" onClick={handleSkipQuotationLoadOrderBook} style={{ width: '100%', padding: '10px', fontSize: '13px', background: '#3b82f6', marginTop: '8px' }}>
                              📋 Load {orderBookItems.length} Items
                            </button>
                          )}
                          {createPOFormData.items.length > 0 && !createPOFormData.quotationId && (
                            <div style={{ padding: '10px', background: 'white', borderRadius: '6px', border: '1px solid #93c5fd', marginTop: '8px' }}>
                              <div style={{ fontSize: '13px', color: '#1e40af' }}>✓ {createPOFormData.items.length} items loaded</div>
                            </div>
                          )}
                        </div>
                      </div>
                      {createPOFormData.quotation && (
                        <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '2px solid #86efac', marginTop: '16px' }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600', color: '#166534' }}>Selected Quotation Details</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                            <div><strong>Vendor:</strong> {createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || 'N/A'}</div>
                            <div><strong>Category:</strong> {createPOFormData.quotation.category}</div>
                            <div><strong>Valid Until:</strong> {formatDate(createPOFormData.quotation.validTill)}</div>
                            <div><strong>Total:</strong> {formatCurrency(createPOFormData.quotation.totalValue)}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {quotations.length > 0 && orderBooks.length === 0 && (
                    <>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><span>✅</span> Quotations Available ({quotations.length})</h3>
                      <div className="po-form-group">
                        <select value={createPOFormData.quotationId} onChange={(e) => handleQuotationSelect(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                          <option value="">Select Quotation</option>
                          {quotations.map(q => <option key={q.id} value={q.id}>{q.quoteNo} — {q.vendorName || q.vendorContact || 'Unknown Vendor'} {q.totalValue ? `— ${formatCurrency(q.totalValue)}` : ''} [{q.status}]</option>)}
                        </select>
                      </div>
                      {createPOFormData.quotation && (
                        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '2px solid #86efac' }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600', color: '#166534' }}>Quotation Details</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                            <div><strong>Vendor:</strong> {createPOFormData.quotation.vendorContact || 'N/A'}</div>
                            <div><strong>Category:</strong> {createPOFormData.quotation.category}</div>
                            <div><strong>Valid:</strong> {formatDate(createPOFormData.quotation.validTill)}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {!loadingOrderItems && quotations.length === 0 && orderBooks.length > 0 && (
                    <div style={{ padding: '20px', background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '8px' }}>
                      <h4 style={{ marginBottom: '10px', color: '#92400e', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>📦</span> No Approved Quotations — Select Order Book</h4>
                      <div className="po-form-group" style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '13px', color: '#92400e', marginBottom: '6px', display: 'block' }}>Select Order Book</label>
                        <select value={selectedOrderBookId} onChange={handleOrderBookSelect} style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #fbbf24' }}>
                          <option value="">-- Select an Order Book --</option>
                          {orderBooks.map(ob => (
                            <option key={ob.id} value={ob.id}>
                              {ob.poNumber || ob.orderBookNo} — {ob.orderTitle ? (ob.orderTitle.length > 35 ? ob.orderTitle.substring(0, 35) + '...' : ob.orderTitle) : 'No Title'}
                            </option>
                          ))}
                        </select>
                      </div>
                      {loadingOrderItems && <div style={{ marginTop: '10px', fontSize: '13px', color: '#92400e' }}>🔄 Loading items...</div>}
                      {selectedOrderBookId && orderBookItems.length > 0 && (
                        <button className="purchase-orders-btn-primary" onClick={handleLoadOrderBookItems} style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '12px' }}>
                          📋 Load {orderBookItems.length} Items from this Order Book
                        </button>
                      )}
                      {selectedOrderBookId && !loadingOrderItems && orderBookItems.length === 0 && (
                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#92400e' }}>No items found in this order book.</div>
                      )}
                    </div>
                  )}
                  {!loadingOrderItems && quotations.length === 0 && orderBooks.length === 0 && (
                    <div style={{ padding: '20px', background: '#fee2e2', border: '2px solid #fecaca', borderRadius: '8px', textAlign: 'center' }}>
                      <h4 style={{ marginBottom: '10px', color: '#991b1b', fontSize: '16px' }}>❌ No Data Available</h4>
                      <p style={{ fontSize: '14px', color: '#991b1b' }}>No quotations or order book items found.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Vendor */}
              {(isEditMode || createPOFormData.quotationId || itemsStepUnlocked) && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><span>🏢</span> Vendor Information</h3>
                  {createPOFormData.quotation ? (
                    <>
                      <div style={{ padding: '16px', background: '#f0f9ff', border: '2px solid #bae6fd', borderRadius: '8px', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0c4a6e', marginBottom: '8px' }}>📋 Vendor from Quotation</h4>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#0c4a6e' }}>{createPOFormData.quotation.vendorName || createPOFormData.quotation.vendorContact || `Vendor #${createPOFormData.quotation.vendorId}`}</div>
                        {createPOFormData.quotation.vendorContact && <div style={{ fontSize: '13px', color: '#0369a1', marginTop: '4px' }}>Contact: {createPOFormData.quotation.vendorContact}</div>}
                      </div>
                      <div style={{ padding: '12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '6px', fontSize: '13px', color: '#92400e' }}>💡 To use a different vendor, clear the quotation and load order book items instead.</div>
                    </>
                  ) : (
                    <>
                      {!isEditMode && (
                        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input type="radio" name="vendorType" checked={!showNewVendorForm} onChange={() => handleVendorTypeChange('existing')} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
                            <span>Existing Vendor</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                            <input type="radio" name="vendorType" checked={showNewVendorForm} onChange={() => handleVendorTypeChange('new')} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
                            <span>New Vendor</span>
                          </label>
                        </div>
                      )}
                      {!showNewVendorForm && (
                        <div className="po-form-group" style={{ position: 'relative' }}>
                          <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>Select Vendor *</label>
                          {/* Custom searchable vendor dropdown */}
                          <div style={{ position: 'relative' }}>
                            <div
                              onClick={() => { setVendorDropdownOpen(o => !o); setVendorSearch(''); }}
                              style={{ width: '100%', padding: '10px 36px 10px 12px', fontSize: '14px', border: `1px solid ${vendorDropdownOpen ? '#3b82f6' : '#d1d5db'}`, borderRadius: '6px', background: 'white', cursor: 'pointer', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', minHeight: '42px' }}
                            >
                              <span style={{ color: createPOFormData.vendorId ? '#111827' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {createPOFormData.vendorId
                                  ? (() => { const sel = vendors.find(v => v.id === parseInt(createPOFormData.vendorId)); return sel ? `${sel.name}${sel.contactNumber ? ' • ' + sel.contactNumber : ''}` : 'Select Vendor'; })()
                                  : '-- Select Vendor --'}
                              </span>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0, color: '#6b7280', transform: vendorDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            {vendorDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #3b82f6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 9999, marginTop: '4px', overflow: 'hidden' }}>
                                {/* Search box */}
                                <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={vendorSearch}
                                    onChange={e => setVendorSearch(e.target.value)}
                                    placeholder="Search vendor..."
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '5px', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                </div>
                                {/* Options list */}
                                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                  <div
                                    onClick={() => { handleVendorSelection({ target: { value: '' } }); setVendorDropdownOpen(false); }}
                                    style={{ padding: '9px 12px', fontSize: '14px', color: '#9ca3af', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                  >
                                    -- Select Vendor --
                                  </div>
                                  {vendors
                                    .filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.contactNumber?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase()))
                                    .map(v => (
                                      <div
                                        key={v.id}
                                        onClick={() => { handleVendorSelection({ target: { value: String(v.id) } }); setVendorDropdownOpen(false); setVendorSearch(''); }}
                                        style={{ padding: '9px 12px', fontSize: '14px', cursor: 'pointer', background: createPOFormData.vendorId === v.id ? '#eff6ff' : 'white', borderLeft: createPOFormData.vendorId === v.id ? '3px solid #3b82f6' : '3px solid transparent' }}
                                        onMouseEnter={e => { if (createPOFormData.vendorId !== v.id) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={e => { if (createPOFormData.vendorId !== v.id) e.currentTarget.style.background = 'white'; }}
                                      >
                                        <div style={{ fontWeight: 500, color: '#111827' }}>{v.name}</div>
                                        {(v.contactNumber || v.category) && (
                                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                            {v.contactNumber && <span>{v.contactNumber}</span>}
                                            {v.contactNumber && v.category && <span> · </span>}
                                            {v.category && <span>{v.category}</span>}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  }
                                  {vendors.filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.contactNumber?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                                    <div style={{ padding: '12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>No vendors found</div>
                                  )}
                                </div>
                                <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#9ca3af' }}>{vendors.length} vendor(s) total</div>
                              </div>
                            )}
                            {/* Click-outside overlay */}
                            {vendorDropdownOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setVendorDropdownOpen(false)} />}
                          </div>
                          {vendors.length === 0 && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>No vendors available. Add a new vendor.</small>}
                        </div>
                      )}
                      {showNewVendorForm && (
                        <div style={{ padding: '20px', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                            <div className="po-form-group">
                              <label>Vendor Name *</label>
                              <input type="text" value={createPOFormData.vendorName || ''} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, vendorName: e.target.value }))} placeholder="Enter vendor company name" style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                            </div>
                            <div className="po-form-group">
                              <label>Contact Number * (10 digits)</label>
                              <input type="tel" value={createPOFormData.vendorContact || ''} onChange={(e) => handleNewVendorContactChange(e.target.value)} placeholder="Enter 10-digit mobile" maxLength={10} style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                              {createPOFormData.vendorContact && createPOFormData.vendorContact.length < 10 && <small style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>⚠️ Must be 10 digits ({createPOFormData.vendorContact.length}/10)</small>}
                            </div>
                            <div className="po-form-group">
                              <label>Category *</label>
                              <select value={createPOFormData.vendorCategory || ''} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, vendorCategory: e.target.value }))} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                                <option value="">Select category</option>
                                <option value="IT Equipment">IT Equipment</option>
                                <option value="Office Furniture">Office Furniture</option>
                                <option value="Manufacturing">Manufacturing</option>
                                <option value="Office Supplies">Office Supplies</option>
                                <option value="Services">Services</option>
                              </select>
                            </div>
                            <div className="po-form-group">
                              <label>Vendor Type *</label>
                              <select value={createPOFormData.vendorType || ''} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, vendorType: e.target.value }))} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                                <option value="">Select type</option>
                                <option value="Manufacturer">Manufacturer</option>
                                <option value="Distributor">Distributor</option>
                                <option value="Service Provider">Service Provider</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ marginTop: '12px', padding: '12px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>💡 This vendor will be created immediately when you submit the PO.</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 4: PO Details */}
              {(isEditMode || createPOFormData.quotationId || itemsStepUnlocked) && (
                <div className="po-form-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><span>📝</span> Purchase Order Details</h3>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Order Date *</label>
                      <input type="date" value={createPOFormData.orderDate} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, orderDate: e.target.value }))} style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                    </div>
                    <div className="po-form-group">
                      <label>Expected Delivery *</label>
                      <input type="date" value={createPOFormData.expectedDelivery} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))} min={createPOFormData.orderDate} style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Status</label>
                      <select value={createPOFormData.status || 'Draft'} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, status: e.target.value }))} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
                        <option value="Draft">Draft</option>
                        <option value="Approved">Approved</option>
                        <option value="Ordered">Ordered</option>
                        <option value="In-Transit">In-Transit</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="po-form-group">
                      <label>Shipping Address</label>
                      <input type="text" value={createPOFormData.shippingAddress} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, shippingAddress: e.target.value }))} placeholder="Enter delivery address" style={{ width: '100%', padding: '10px', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div className="po-form-row">
                    <div className="po-form-group">
                      <label>Payment Terms</label>
                      <textarea rows={3} value={createPOFormData.paymentTerms} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, paymentTerms: e.target.value }))} placeholder="e.g., Net 30, Advance Payment, 50% advance + 50% on delivery..." style={{ width: '100%', padding: '10px', fontSize: '14px', resize: 'vertical' }} />
                    </div>
                  </div>
                  <div className="po-form-group">
                    <label>Notes / Special Instructions</label>
                    <textarea rows={3} value={createPOFormData.notes} onChange={(e) => setCreatePOFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes, special requirements, etc." style={{ width: '100%', padding: '10px', fontSize: '14px', resize: 'vertical' }} />
                  </div>

                  {/* PO Soft-Copy Upload */}
                  <div className="po-file-upload-section">
                    <label className="po-file-upload-label">
                      <File size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      PO Soft Copy (PDF / PNG / JPG — max 10 MB)
                    </label>
                    <div className="po-file-upload-row">
                      <input
                        ref={poFileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handlePOFileSelect}
                        className="po-file-input"
                        id="po-file-input"
                      />
                      <label htmlFor="po-file-input" className="po-file-choose-btn">
                        <Upload size={14} /> Choose File
                      </label>
                      {poFileUpload && (
                        <span className="po-file-chosen-name">
                          {poFileUpload.name} ({(poFileUpload.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                      {!poFileUpload && isEditMode && editingPOId && (
                        <span className="po-file-existing-hint">
                          A file may already be attached. Selecting a new one will replace it.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Items */}
              {(isEditMode || createPOFormData.quotationId || itemsStepUnlocked) && (
                <div className="po-form-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><span>📋</span> Purchase Order Items</h3>
                      <p style={{ fontSize: '13px', color: '#64748b' }}>{createPOFormData.quotationId ? 'Select items and adjust quantities' : 'Enter vendor prices for selected items'}</p>
                    </div>
                    {!isEditMode && (
                      <button className="purchase-orders-btn-secondary" onClick={() => setShowManualItemForm(!showManualItemForm)} style={{ padding: '8px 16px', fontSize: '14px' }}>
                        <Plus size={16} /> {showManualItemForm ? 'Cancel' : 'Add Manual Item'}
                      </button>
                    )}
                  </div>

                  {showManualItemForm && (
                    <div style={{ padding: '16px', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px', marginBottom: '16px' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#166534' }}>Add Manual Item</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Item Name *</label><ItemNameAutocomplete value={newItem.itemName} onChange={(val) => setNewItem(prev => ({ ...prev, itemName: val }))} onSelect={(catalogueItem) => setNewItem(prev => ({ ...prev, itemName: catalogueItem.itemName, itemDescription: catalogueItem.description || prev.itemDescription, unitPrice: catalogueItem.unitPrice > 0 ? catalogueItem.unitPrice : prev.unitPrice, gst: catalogueItem.taxPercent > 0 ? catalogueItem.taxPercent : prev.gst, discount: catalogueItem.discountPercent > 0 ? catalogueItem.discountPercent : prev.discount }))} user={user} placeholder="Enter item name" /></div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Quantity *</label><input type="number" value={newItem.quantity} onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))} placeholder="0" min="0" step="0.01" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Unit Price (₹) *</label><input type="number" value={newItem.unitPrice} onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || '' }))} placeholder=" " min="0" step="0.01" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>GST %</label><input type="number" value={newItem.gst} onChange={(e) => setNewItem(prev => ({ ...prev, gst: parseFloat(e.target.value) || 0 }))} min="0" max="100" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                        <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Discount %</label><input type="number" value={newItem.discount} onChange={(e) => setNewItem(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))} min="0" max="100" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="purchase-orders-btn-primary" onClick={handleAddManualItem} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>✅ Add Item</button></div>
                      </div>
                      <div><label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Description</label><input type="text" value={newItem.itemDescription} onChange={(e) => setNewItem(prev => ({ ...prev, itemDescription: e.target.value }))} placeholder="Enter item description (optional)" style={{ width: '100%', padding: '8px', fontSize: '14px' }} /></div>
                    </div>
                  )}

                  {createPOFormData.items.length > 0 ? (
                    <>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table className="po-items-table" style={{ width: '100%', minWidth: '1100px' }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '60px' }}>
                                <input type="checkbox" checked={createPOFormData.items.every(i => i.selected)}
                                  onChange={(e) => setCreatePOFormData(prev => ({ ...prev, items: prev.items.map(item => ({ ...item, selected: e.target.checked })) }))}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} title="Select/Deselect All" />
                              </th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Item Name</th>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                              {createPOFormData.quotationId && <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '100px' }}>Quoted Qty</th>}
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '100px' }}>PO Qty *</th>
                              <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', width: '130px' }}>Unit Price (₹) *</th>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>GST %</th>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>Discount %</th>
                              <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', width: '130px' }}>Line Total</th>
                              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', width: '80px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {createPOFormData.items.map((item, index) => {
                              const qty      = parseFloat(item.quantity)  || 0;
                              const price    = parseFloat(item.unitPrice) || 0;
                              const gst      = parseFloat(item.gst)       || 0;
                              const discount = parseFloat(item.discount)  || 0;
                              const base     = qty * price;
                              const disc     = base * (discount / 100);
                              const computedLineTotal = (base - disc) * (1 + gst / 100);
                              return (
                              <tr key={index} style={{ borderTop: '1px solid #e2e8f0', opacity: item.selected ? 1 : 0.5, background: item.selected ? 'white' : '#f9fafb' }}>
                                <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={item.selected} onChange={() => handleToggleItemSelection(index)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} /></td>
                                <td style={{ padding: '12px', fontWeight: '500' }}>{item.itemName}{item.isManual && <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontWeight: '600' }}>MANUAL</span>}{item.remainingQty != null && <div style={{ fontSize: '11px', color: item.remainingQty <= 0 ? '#ef4444' : '#22c55e', marginTop: '2px' }}>OB: {item.quotedQuantity} total · {item.allocatedQty || 0} assigned · <strong>{item.remainingQty} remaining</strong></div>}</td>
                                <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>{item.itemDescription || '—'}</td>
                                {createPOFormData.quotationId && <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#0284c7' }}>{item.quotedQuantity}</td>}
                                <td style={{ padding: '12px', textAlign: 'center' }}><input type="number" min="0" max={createPOFormData.quotationId ? item.quotedQuantity : (item.remainingQty != null ? item.remainingQty : undefined)} value={item.quantity} onChange={(e) => handleUpdatePOItemQuantity(index, e.target.value)} disabled={!item.selected} style={{ width: '70px', padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '14px' }} /></td>
                                <td style={{ padding: '12px', textAlign: 'right' }}><input type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={(e) => handleUpdatePOItemPrice(index, e.target.value)} disabled={createPOFormData.quotationId || !item.selected} placeholder="0.00" style={{ width: '110px', padding: '8px', textAlign: 'right', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '14px', backgroundColor: (createPOFormData.quotationId || !item.selected) ? '#f1f5f9' : 'white' }} /></td>
                                <td style={{ padding: '12px', textAlign: 'center' }}><select value={item.gst} onChange={(e) => handleUpdatePOItemGST(index, e.target.value)} disabled={!item.selected} style={{ width: '90px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '14px', cursor: item.selected ? 'pointer' : 'not-allowed', backgroundColor: item.selected ? 'white' : '#f1f5f9' }}>{GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}</select></td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>{item.discount}%</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: item.selected ? '#059669' : '#94a3b8', fontSize: '14px' }}>{formatCurrency(computedLineTotal)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}><button className="remove-item-btn" onClick={() => handleRemoveItem(index)} title="Remove item"><Trash2 size={16} /></button></td>
                              </tr>
                              );
                            })}
                          </tbody>
                          <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                            <tr>
                              <td colSpan={createPOFormData.quotationId ? 9 : 8} style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '16px' }}>
                                Grand Total ({createPOFormData.items.filter(i => i.selected).length} items selected):
                              </td>
                              <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '18px', color: '#059669' }}>{formatCurrency(calculatePOTotal())}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>{createPOFormData.items.filter(i => i.selected).length} of {createPOFormData.items.length} items selected</div>
                        {!createPOFormData.quotationId && createPOFormData.items.some(i => i.selected && (!i.unitPrice || i.unitPrice === 0)) && (
                          <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '6px', fontSize: '13px', color: '#92400e' }}>⚠️ Please enter unit prices for all selected items</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '60px', textAlign: 'center', background: '#f8fafc', border: '2px dashed #cbd5e0', borderRadius: '8px', color: '#94a3b8' }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                      <div style={{ fontSize: '16px', fontWeight: '500' }}>No items to display</div>
                      <div style={{ fontSize: '14px', marginTop: '4px' }}>Select a quotation, load order book items, or add manual items</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="purchase-orders-modal-actions" style={{ borderTop: '2px solid #e2e8f0', paddingTop: '20px', flexShrink: 0, padding: '16px 24px' }}>
              <button
                className="purchase-orders-btn-primary" onClick={handleCreatePO}
                disabled={!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0}
                style={{ padding: '12px 32px', fontSize: '15px', opacity: (!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0) ? 0.5 : 1, cursor: (!modalGroupName || createPOFormData.items.filter(i => i.selected).length === 0) ? 'not-allowed' : 'pointer' }}
              >
                {isEditMode ? '💾 Update Purchase Order' : '✅ Create Purchase Order'}
              </button>
              <button className="purchase-orders-btn-secondary" onClick={handleCloseCreatePOModal} style={{ padding: '12px 32px', fontSize: '15px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;