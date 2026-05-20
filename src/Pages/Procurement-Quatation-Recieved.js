import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Filter, Download, X, Edit2, Eye, Check, XCircle, FileText, Upload,
  Clock, CheckCircle, Star, AlertCircle,
  ShoppingCart, Trash2, Columns, GripVertical, ChevronUp, ChevronDown, ChevronsUpDown,
  FileSpreadsheet
} from 'lucide-react';
import '../pages-css/Procurement-Quatation-Recieved.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal';
import filterApi from '../services/filterApi';
import * as XLSX from 'xlsx';
import ItemNameAutocomplete from '../components/OrderBook/ItemNameAutocomplete.js';
import UnitTypeDropdown, { COMMON_UNITS } from '../components/Dropdowns/Unittypedropdown.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ── Column definitions ───────────────────────────────────────────────────────
const ALL_QUOTATION_COLUMNS = [
  { id: 'quotationNo', label: 'Quotation No', visible: true },
  { id: 'vendorId', label: 'Vendor Name', visible: true },
  { id: 'rfqId', label: 'RFQ ID', visible: false },
  { id: 'category', label: 'Category', visible: false },
  { id: 'quotationValue', label: 'Quotation Value', visible: true },
  { id: 'validUntil', label: 'Valid Until', visible: true },
  { id: 'file', label: 'File', visible: false },
  { id: 'status', label: 'Status', visible: true },
  { id: 'uploadedOn', label: 'Uploaded On', visible: true },
  { id: 'group', label: 'Group', visible: false },
  { id: 'project', label: 'Project', visible: true },
  { id: 'actions', label: 'Actions', visible: true, fixed: true },
];

const SORTABLE_COLUMNS = new Set([
  'quotationNo', 'vendorId', 'rfqId', 'category',
  'quotationValue', 'validUntil', 'status', 'uploadedOn',
]);

// ── Sort icon component ──────────────────────────────────────────────────────
const SortIcon = ({ columnId, sortConfig }) => {
  if (sortConfig.key !== columnId)
    return <ChevronsUpDown size={12} style={{ opacity: 0.35, marginLeft: 4, verticalAlign: 'middle' }} />;
  return sortConfig.direction === 'asc'
    ? <ChevronUp size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#2563eb' }} />
    : <ChevronDown size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#2563eb' }} />;
};

// ── Validation sets for import ───────────────────────────────────────────────
const VALID_GST = new Set([0, 5, 12, 18, 28]);
const CATEGORIES = [
  'Manufacturer',
  'Supplier',
  'Distributor',
  'Trader',
  'Dealer',
  'Sub-Contractor',
  'Service Provider',
  'Consultant',
  'Other',
];

const QuotationsReceived = () => {
  const [quotations, setQuotations] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions, isAccountsExecutive } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCreatePOFromQuotationModal, setShowCreatePOFromQuotationModal] = useState(false);
  const [poFormData, setPOFormData] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all' });
  const [orderBookItems, setOrderBookItems] = useState([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ── Column state (drag + visibility) ────────────────────────────────────
  const COLUMN_VERSION = 'v3'; // bumped: project column now visible by default
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('quotationColumns');
      const version = localStorage.getItem('quotationColumnsVersion');
      if (saved && version === COLUMN_VERSION) {
        const parsed = JSON.parse(saved);
        // Merge: ensure any new columns that don't exist in cache are added
        const savedIds = new Set(parsed.map(c => c.id));
        const merged = [...parsed];
        ALL_QUOTATION_COLUMNS.forEach(col => {
          if (!savedIds.has(col.id)) merged.push(col);
        });
        return merged;
      }
      return ALL_QUOTATION_COLUMNS;
    } catch { return ALL_QUOTATION_COLUMNS; }
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // ── Drag-and-drop table column state ────────────────────────────────────
  const [draggedColIndex, setDraggedColIndex] = useState(null);
  const [dragOverColIndex, setDragOverColIndex] = useState(null);

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // ── Excel import state ───────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const xlsxFileRef = useRef(null);

  // Detail drawer and modals
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [showUploadQuotationModal, setShowUploadQuotationModal] = useState(false);
  const [quotationFormData, setQuotationFormData] = useState(null);
  const [stats, setStats] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Modal dropdown state
  const [modalGroups, setModalGroups] = useState([]);
  const [modalSubGroups, setModalSubGroups] = useState([]);
  const [modalProjects, setModalProjects] = useState([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalSubGroupName, setModalSubGroupName] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDropdownLoading, setModalDropdownLoading] = useState({ groups: false, subGroups: false, projects: false });

  // Vendor state
  const [vendors, setVendors] = useState([]);
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  // Real permission checks from pagePermissions
  const isAccountsRole = user?.role && user.role.toUpperCase().startsWith('ACCOUNTS_');
  const isSuperAdmin   = user?.role === 'SUPERADMIN';
  const isAdmin        = user?.role === 'ADMIN';
  const isFullAccess   = isSuperAdmin || isAdmin || isAccountsRole || isAccountsExecutive;
  const quotPerms  = pagePermissions?.PROCUREMENT_QUOTATIONS || [];
  // Fallback: if no perms configured yet, allow access (existing behaviour)
  const hasPerms   = quotPerms.length > 0;
  const canView    = !hasPerms || quotPerms.includes('VIEW')    || isFullAccess;
  const canCreate  = !hasPerms || quotPerms.includes('CREATE')  || isFullAccess;
  const canEdit    = !hasPerms || quotPerms.includes('EDIT')    || isFullAccess;
  const canApprove = !hasPerms || quotPerms.includes('APPROVE') || isFullAccess;
  // DELETE: follows permission flag only — not blocked by isAccountsExecutive
  const canDelete  = !hasPerms || quotPerms.includes('DELETE');

  // ── Confirm modal state ──────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', type: 'error', onConfirm: null });

  // ── Persist column config ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('quotationColumns', JSON.stringify(columns));
    localStorage.setItem('quotationColumnsVersion', COLUMN_VERSION);
  }, [columns]);

  // ── Data fetching effects ────────────────────────────────────────────────
  // AbortController + Promise.all: fetches the quotation list and KPI stats
  // simultaneously with identical filter params. When any filter/page dep
  // changes, the cleanup aborts both in-flight requests before starting new
  // ones — eliminating race conditions where a slower earlier response
  // (e.g. search='A') could arrive after a faster later response and
  // overwrite correct KPI values with stale data.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadAll = async () => {
      setLoading(true);
      try {
        // Quotation list params
        const quotParams = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'uploadedAt', sortDirection: 'DESC' });
        if (groupName)    quotParams.append('groupName',    groupName);
        if (subGroupName) quotParams.append('subGroupName', subGroupName);
        if (projectId)    quotParams.append('projectId',    projectId);
        if (filters.status !== 'all') quotParams.append('status',     filters.status);
        if (filters.search)           quotParams.append('searchTerm', filters.search.trim());

        // Stats params — same filters so KPI cards always match the table
        const statsParams = new URLSearchParams();
        if (groupName)    statsParams.append('groupName',    groupName);
        if (subGroupName) statsParams.append('subGroupName', subGroupName);
        if (projectId)    statsParams.append('projectId',    projectId);
        if (filters.status !== 'all') statsParams.append('status',     filters.status);
        if (filters.search)           statsParams.append('searchTerm', filters.search.trim());

        const [quotRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/quotations/procurement?${quotParams}`, { credentials: 'include', headers: getAuthHeaders(), signal }),
          fetch(`${API_BASE_URL}/quotations/stats?${statsParams}`,      { credentials: 'include', headers: getAuthHeaders(), signal })
        ]);

        if (!signal.aborted) {
          if (quotRes.ok) {
            const data = await quotRes.json();
            setQuotations(data.quotations || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
          } else {
            showError('Failed to load quotations');
            setQuotations([]);
          }
          if (statsRes.ok) setStats(await statsRes.json());
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // cancelled by dep change — ignore
        showError('Failed to load quotations');
        setQuotations([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    loadAll();
    return () => controller.abort(); // cancel in-flight requests on re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName, subGroupName, projectId, currentPage, pageSize, filters.status, filters.search]);

  // ── Sorting logic ────────────────────────────────────────────────────────
  const sortedQuotations = useMemo(() => {
    // ── Step 1: client-side filter (catches API gaps) ──────────────────────
    let list = quotations;
    if (filters.status !== 'all') {
      list = list.filter(q => q.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(q =>
        q.quoteNo?.toLowerCase().includes(s) ||
        q.vendorName?.toLowerCase().includes(s) ||
        q.rfqId?.toLowerCase().includes(s) ||
        q.category?.toLowerCase().includes(s)
      );
    }
    // ── Step 2: sort ────────────────────────────────────────────────────────
    if (!sortConfig.key) return list;
    return [...list].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'quotationNo': aVal = a.quoteNo || ''; bVal = b.quoteNo || ''; break;
        case 'vendorId': aVal = a.vendorName || a.vendorId?.toString() || ''; bVal = b.vendorName || b.vendorId?.toString() || ''; break;
        case 'rfqId': aVal = a.rfqId || ''; bVal = b.rfqId || ''; break;
        case 'category': aVal = a.category || ''; bVal = b.category || ''; break;
        case 'quotationValue': aVal = parseFloat(a.totalValue) || 0; bVal = parseFloat(b.totalValue) || 0; break;
        case 'validUntil': aVal = new Date(a.validTill || 0); bVal = new Date(b.validTill || 0); break;
        case 'status': aVal = a.status || ''; bVal = b.status || ''; break;
        case 'uploadedOn': aVal = new Date(a.uploadedAt || 0); bVal = new Date(b.uploadedAt || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [quotations, sortConfig, filters.status, filters.search]);

  const handleSort = (colId) => {
    if (!SORTABLE_COLUMNS.has(colId)) return;
    setSortConfig(prev => ({
      key: colId,
      direction: prev.key === colId && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // ── Table-header drag-and-drop ───────────────────────────────────────────
  const handleColDragStart = (e, index) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleColDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColIndex(index);
  };
  const handleColDrop = (e, index) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === index) {
      setDraggedColIndex(null); setDragOverColIndex(null); return;
    }
    const visibleCols = columns.filter(c => c.visible);
    const newVisible = [...visibleCols];
    const [moved] = newVisible.splice(draggedColIndex, 1);
    newVisible.splice(index, 0, moved);
    const hiddenCols = columns.filter(c => !c.visible);
    setColumns([...newVisible, ...hiddenCols]);
    setDraggedColIndex(null); setDragOverColIndex(null);
  };
  const handleColDragEnd = () => { setDraggedColIndex(null); setDragOverColIndex(null); };

  // ── Column visibility toggle ─────────────────────────────────────────────
  const toggleColumnVisibility = (colId) =>
    setColumns(cols => cols.map(c => c.id === colId ? { ...c, visible: !c.visible } : c));

  const resetColumns = () => {
    setColumns(ALL_QUOTATION_COLUMNS);
    localStorage.removeItem('quotationColumns');
    localStorage.removeItem('quotationColumnsVersion');
  };

  // ── Excel import handlers ────────────────────────────────────────────────
  const handleXlsxFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Always clear previous results first before parsing new file
    setImportErrors([]);
    setImportPreview([]);
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find header row by looking for a cell that contains "description" or "item name"
        const headerRowIdx = data.findIndex(row =>
          row.some(cell => typeof cell === 'string' &&
            (cell.toLowerCase().includes('description') || cell.toLowerCase().includes('item name')))
        );
        if (headerRowIdx === -1) {
          showError('Invalid template. Please use the provided BOQ quotation template.');
          return;
        }

        // Helper: returns true if a cell value looks like a column header label rather than real data
        const isHeaderLike = (val) => {
          const s = String(val || '').trim().toLowerCase();
          return (
            s === '' ||
            s.includes('item name') ||
            s.includes('description') ||
            s.includes('unit price') ||
            s.includes('rate') ||
            s.includes('quantity') ||
            s.includes('qty') ||
            s.includes('make') ||
            s.includes('unit') ||
            s.includes('s.no') ||
            s.includes('sr no') ||
            s.includes('amount') ||
            s.includes('delivery') ||
            s.includes('warranty') ||
            s.includes('notes') ||
            s.includes('order book')
          );
        };

        // Slice everything after the header row, skip blanks and header-like rows
        const rows = data
          .slice(headerRowIdx + 1)
          .filter(row => {
            // first non-empty cell after skipping S.No column
            const firstCell = String(row[1] || row[0] || '').trim();
            return firstCell !== '' && !isHeaderLike(firstCell);
          });

        const errors = [];
        const parsed = rows.map((row, i) => {
          const rowNum = headerRowIdx + 2 + i;
          // New BOQ format: S.No | Description | Unit | Qty | Make | Rate | GST% | Amount
          // Also support old format: Item Name | Description | Qty | Unit Price | GST
          let itemName, description, unit, quantity, make, unitPrice, gst;
          const firstCell = String(row[0] || '').trim();
          const isNewFormat = !isNaN(parseFloat(firstCell)) && parseFloat(firstCell) > 0;

          if (isNewFormat) {
            // New BOQ: S.No, Description, Unit, Qty, Make, Rate, Amount
            itemName = String(row[1] || '').trim();
            description = String(row[1] || '').trim();
            unit = String(row[2] || '').trim();
            quantity = parseFloat(row[3]);
            make = String(row[4] || '').trim();
            unitPrice = parseFloat(row[5]);
            gst = 0; // no per-item GST in new format
          } else {
            // Legacy: Item Name, Description, Qty, Unit Price, GST
            itemName = String(row[0] || '').trim();
            description = String(row[1] || '').trim();
            unit = '';
            quantity = parseFloat(row[2]);
            make = '';
            unitPrice = parseFloat(row[3]);
            gst = parseFloat(row[4]);
          }

          if (!itemName) errors.push(`Row ${rowNum}: Description is required`);
          if (isNaN(quantity) || quantity <= 0) errors.push(`Row ${rowNum}: Invalid quantity "${isNewFormat ? row[3] : row[2]}"`);
          if (isNaN(unitPrice) || unitPrice < 0) errors.push(`Row ${rowNum}: Invalid rate "${isNewFormat ? row[5] : row[3]}"`);

          return {
            itemName,
            description,
            unit,
            quantity: isNaN(quantity) ? 1 : quantity,
            make,
            unitPrice: isNaN(unitPrice) ? '' : unitPrice,
            taxPercent: VALID_GST.has(gst) ? gst : 18,
            included: true,
          };
        });

        setImportErrors(errors);
        setImportPreview(parsed);
        setShowImportModal(true); // auto-open preview modal after file is parsed
      } catch (err) {
        showError('Failed to read file. Please use a valid Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    if (importErrors.length > 0) { showError('Fix errors before importing'); return; }
    if (importPreview.length === 0) { showError('No valid rows to import'); return; }

    // Merge imported items into existing form data
    setQuotationFormData(prev => ({
      ...prev,
      items: importPreview.map(row => ({
        itemName: row.itemName,
        description: row.description,
        unit: row.unit || '',
        quantity: row.quantity,
        make: row.make || '',
        unitPrice: row.unitPrice,
        taxPercent: row.taxPercent,
        included: true,
      })),
      deliveryTime: prev.deliveryTime || importPreview[0]?.deliveryTime || '',
      warranty: prev.warranty || importPreview[0]?.warranty || '',
    }));

    handleCloseImportModal();
    showSuccess(`Imported ${importPreview.length} item${importPreview.length !== 1 ? 's' : ''} into the quotation form`);
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportPreview([]);
    setImportErrors([]);
    setImportFileName('');
    if (xlsxFileRef.current) xlsxFileRef.current.value = '';
  };



  // ── Auth helper ──────────────────────────────────────────────────────────
  const getAuthHeaders = () => {
    try {
      const raw = localStorage.getItem('bd_portal_user');
      const u = raw ? (JSON.parse(raw)?.user || {}) : {};
      const id   = String(u.id   || user?.id   || '');
      const role = String(u.role || user?.role || '');
      return {
        'Content-Type': 'application/json',
        'User-Id':   id,
        'User-Role': role,
        'X-User-Id':   id,
        'X-User-Role': role,
      };
    } catch { return { 'Content-Type': 'application/json' }; }
  };

  // ── API calls ────────────────────────────────────────────────────────────
  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, size: pageSize, sortBy: 'uploadedAt', sortDirection: 'DESC' });
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('searchTerm', filters.search);

      const res = await fetch(`${API_BASE_URL}/quotations/procurement?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotations(data.quotations || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch { showError('Failed to load quotations'); setQuotations([]); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (projectId) params.append('projectId', projectId);
      const res = await fetch(`${API_BASE_URL}/quotations/stats?${params}`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) setStats(await res.json());
    } catch { }
  };

  const fetchVendors = async (gn, sg) => {
    try {
      let url = `${API_BASE_URL}/vendors/by-group-subgroup?`;
      if (gn) url += `groupName=${encodeURIComponent(gn)}&`;
      if (sg) url += `subGroupName=${encodeURIComponent(sg)}`;
      const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setVendors(data.data || []);
    } catch { setVendors([]); }
  };

  const fetchAllVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors/by-group-subgroup`, {
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        }
      });
      const data = await res.json();
      if (data.success) setVendors(data.data || []);
    } catch { setVendors([]); }
  };

  const fetchOrderBookItems = async (pid) => {
    if (!pid) { setOrderBookItems([]); return; }
    setLoadingOrderItems(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/orderbook-items/${pid}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.success) {
        setOrderBookItems(data.data || []);
        if (quotationFormData && !isEditMode && data.data?.length > 0) {
          setQuotationFormData(prev => {
            // If user already imported items, do NOT overwrite them with order book items
            const hasImportedItems = prev.items && prev.items.length > 0;
            if (hasImportedItems) return prev;
            return {
              ...prev,
              items: data.data.map(item => ({
                itemName: item.itemName, description: item.specification || item.description || '',
                quantity: item.quantity || '', unitPrice: '', taxPercent: item.taxPercent || 18,
                orderBookItemId: item.id, included: true,
              })),
            };
          });
        }
      }
    } catch { showError('Failed to load order book items'); setOrderBookItems([]); }
    finally { setLoadingOrderItems(false); }
  };

  const fetchModalGroups = async () => { setModalDropdownLoading(p => ({ ...p, groups: true })); try { setModalGroups(await filterApi.getAllGroups() || []); } catch { } finally { setModalDropdownLoading(p => ({ ...p, groups: false })); } };
  const fetchModalSubGroups = async (gn) => { if (!gn) { setModalSubGroups([]); setModalProjects([]); return; } setModalDropdownLoading(p => ({ ...p, subGroups: true })); try { setModalSubGroups(await filterApi.getSubGroups(gn) || []); } catch { } finally { setModalDropdownLoading(p => ({ ...p, subGroups: false })); } };
  const fetchModalProjects = async (gn, sg) => { if (!gn || !sg) { setModalProjects([]); return; } setModalDropdownLoading(p => ({ ...p, projects: true })); try { setModalProjects(await filterApi.getProjects(gn, sg) || []); } catch { } finally { setModalDropdownLoading(p => ({ ...p, projects: false })); } };

  // ── Modal dropdown change handlers ───────────────────────────────────────
  const handleModalGroupChange = (e) => {
    const g = e.target.value;
    setModalGroupName(g); setModalSubGroupName(''); setModalProjectId('');
    setModalSubGroups([]); setModalProjects([]); setOrderBookItems([]);
    if (quotationFormData) setQuotationFormData({ ...quotationFormData, groupName: g, subGroupName: '', projectId: '', items: quotationFormData.items });
    if (g) { fetchModalSubGroups(g); fetchVendors(g, null); } else setVendors([]);
  };

  const handleModalSubGroupChange = (e) => {
    const sg = e.target.value;
    setModalSubGroupName(sg); setModalProjectId(''); setModalProjects([]); setOrderBookItems([]);
    if (quotationFormData) setQuotationFormData({ ...quotationFormData, subGroupName: sg, projectId: '', items: quotationFormData.items });
    if (modalGroupName && sg) { fetchModalProjects(modalGroupName, sg); fetchVendors(modalGroupName, sg); }
  };

  const handleModalProjectChange = (e) => {
    const pid = e.target.value;
    setModalProjectId(pid);
    if (quotationFormData) setQuotationFormData({ ...quotationFormData, projectId: pid });
    if (pid && !isEditMode) fetchOrderBookItems(pid);
  };

  // ── Vendor handlers ──────────────────────────────────────────────────────
  const handleVendorTypeChange = (type) => {
    setShowNewVendorForm(type === 'new');
    setVendorDropdownOpen(false);
    setVendorSearch('');
    if (type === 'new') { setQuotationFormData({ ...quotationFormData, vendorId: null, vendorName: '', vendorContact: '' }); setSelectedVendorDetails(null); }
    else setQuotationFormData({ ...quotationFormData, vendorName: '', vendorContact: '' });
  };

  const handleNewVendorContactChange = (val) => {
    setQuotationFormData({ ...quotationFormData, vendorContact: val.replace(/\D/g, '').slice(0, 10) });
  };

  const handleVendorSelection = (e) => {
    const vid = e.target.value ? parseInt(e.target.value) : null;
    if (vid) {
      const v = vendors.find(x => x.id === vid);
      if (v) { setSelectedVendorDetails({ id: v.id, name: v.name, phone: v.phone || v.contact }); setQuotationFormData({ ...quotationFormData, vendorId: vid, vendorContact: v.phone || v.contact || '' }); }
    } else { setSelectedVendorDetails(null); setQuotationFormData({ ...quotationFormData, vendorId: null, vendorContact: '' }); }
  };

  const toggleItemInclusion = (idx) => {
    if (!quotationFormData) return;
    const items = [...quotationFormData.items];
    items[idx].included = !items[idx].included;
    setQuotationFormData({ ...quotationFormData, items });
  };

  // ── File select for quotation attachment ─────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) { setSelectedFile(null); setFilePreview(null); return; }
    if (file.size > 5 * 1024 * 1024) { showError('File size exceeds 5MB'); e.target.value = ''; setSelectedFile(null); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) { showError('Only PDF and image files are allowed'); e.target.value = ''; setSelectedFile(null); return; }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) { const r = new FileReader(); r.onloadend = () => setFilePreview(r.result); r.readAsDataURL(file); }
    else setFilePreview(null);
  };

  // ── PO handlers ──────────────────────────────────────────────────────────
  const handleOpenCreatePOModal = async (quotation) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotation.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const qd = await res.json();
      setPOFormData({
        quotationId: qd.id, quoteNo: qd.quoteNo, vendorId: qd.vendorId, vendorContact: qd.vendorContact,
        rfqId: qd.rfqId, groupName: qd.groupName, subGroupName: qd.subGroupName, projectId: qd.projectId,
        orderDate: new Date().toISOString().split('T')[0], expectedDelivery: '',
        paymentTerms: qd.paymentTerms || '', shippingAddress: '', notes: qd.notes || '',
        items: qd.items.map(item => ({ quotationItemId: item.id, itemName: item.itemName, description: item.description, quotedQuantity: item.quantity, selectedQuantity: item.quantity, unitPrice: item.unitPrice, taxPercent: item.taxPercent, lineTotal: 0 })),
      });
      setShowCreatePOFromQuotationModal(true);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleUpdatePOItemQuantity = (index, quantity) => {
    if (!poFormData) return;
    const items = [...poFormData.items];
    const item = items[index];
    const qty = parseFloat(quantity) || 0;
    if (qty > item.quotedQuantity) { showError(`Cannot exceed quoted qty of ${item.quotedQuantity}`); return; }
    item.selectedQuantity = qty;
    item.lineTotal = qty * item.unitPrice * (1 + item.taxPercent / 100);
    setPOFormData({ ...poFormData, items });
  };

  const calculatePOTotal = () => {
    if (!poFormData) return { subtotal: 0, taxAmount: 0, total: 0 };
    const subtotal = poFormData.items.reduce((s, i) => s + i.selectedQuantity * i.unitPrice, 0);
    const taxAmount = poFormData.items.reduce((s, i) => s + i.selectedQuantity * i.unitPrice * i.taxPercent / 100, 0);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleCreatePOFromQuotation = async () => {
    if (!poFormData.expectedDelivery) { showError('Expected delivery date is required'); return; }
    if (!poFormData.items.some(i => i.selectedQuantity > 0)) { showError('Select quantity for at least one item'); return; }
    // Permission check handled by canCreate guard on the button
    setLoading(true);
    try {
      const poData = {
        quotationId: poFormData.quotationId, vendorId: poFormData.vendorId, rfqId: poFormData.rfqId,
        groupName: poFormData.groupName, subGroupName: poFormData.subGroupName, projectId: poFormData.projectId,
        orderDate: poFormData.orderDate, expectedDelivery: poFormData.expectedDelivery,
        paymentTerms: poFormData.paymentTerms, shippingAddress: poFormData.shippingAddress, notes: poFormData.notes,
        items: poFormData.items.filter(i => i.selectedQuantity > 0).map(i => ({
          itemName: i.itemName, itemDescription: i.description || '', quantity: i.selectedQuantity,
          unitPrice: i.unitPrice, gst: i.taxPercent, discount: 0,
        })),
        status: 'Draft', paymentStatus: 'Pending',
      };
      const res = await fetch(`${API_BASE_URL}/purchase-orders/from-quotation`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(poData) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed'); }
      const created = await res.json();
      showSuccess(`Purchase Order ${created.poNo} created!`);
      setShowCreatePOFromQuotationModal(false); setPOFormData(null);
      await handleUpdateStatus(poFormData.quotationId, 'PO Created');
      fetchQuotations(); fetchStats();
    } catch (err) { showError(err.message || 'Failed to create Purchase Order'); }
    finally { setLoading(false); }
  };

  // ── Quotation CRUD ───────────────────────────────────────────────────────
  const handleViewQuotation = async (quotation) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotation.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      setSelectedQuotation(await res.json()); setShowDetailDrawer(true);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleEditQuotation = async (quotation) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotation.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIsEditMode(true);
      setQuotationFormData({
        id: data.id, rfqId: data.rfqId || '', validTill: data.validTill || '',
        groupName: data.groupName || '', subGroupName: data.subGroupName || '', projectId: data.projectId || '',
        category: data.category || 'Manufacturer', vendorId: data.vendorId || null,
        vendorName: data.vendorName || '', vendorContact: data.vendorContact || '',
        vendorRating: data.vendorRating || 0, deliveryTime: data.deliveryTime || '',
        paymentTerms: data.paymentTerms || '', warranty: data.warranty || '',
        notes: data.notes || '', status: data.status || 'New',
        items: (data.items || []).map(item => ({ id: item.id, itemName: item.itemName || '', description: item.description || '', unit: item.unit || '', quantity: item.quantity || 1, make: item.make || '', unitPrice: item.unitPrice || '', taxPercent: item.taxPercent || 18, included: true })),
      });
      if (data.vendorId) { setShowNewVendorForm(false); setSelectedVendorDetails({ id: data.vendorId, name: data.vendorName, phone: data.vendorContact }); }
      else if (data.vendorName) setShowNewVendorForm(true);
      setVendorSearch(''); setVendorDropdownOpen(false);
      setModalGroupName(data.groupName || ''); setModalSubGroupName(data.subGroupName || ''); setModalProjectId(data.projectId || '');
      setSelectedFile(null); setFilePreview(null);
      fetchModalGroups();
      fetchAllVendors();
      if (data.groupName) { fetchModalSubGroups(data.groupName); fetchVendors(data.groupName, null); if (data.subGroupName) { fetchModalProjects(data.groupName, data.subGroupName); fetchVendors(data.groupName, data.subGroupName); } }
      setShowUploadQuotationModal(true);
    } catch { showError('Failed to load quotation details'); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (quotationId, newStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotationId}/status`, { credentials: 'include', method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error();
      showSuccess(`Quotation ${newStatus.toLowerCase()} successfully`);
      fetchQuotations(); fetchStats(); setShowDetailDrawer(false);
    } catch { showError('Failed to update status'); }
    finally { setLoading(false); }
  };

  const handleDeleteQuotation = (quotationId) => {
    if (!canDelete) { showError('No permission to delete quotations'); return; }
    setConfirmModal({
      show: true, title: 'Delete Quotation',
      message: 'Are you sure you want to delete this quotation? This action cannot be undone.',
      type: 'error',
      onConfirm: () => performDeleteQuotation(quotationId)
    });
  };
  const performDeleteQuotation = async (quotationId) => {
    setConfirmModal({ show: false });
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quotations/${quotationId}`, { credentials: 'include', method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      showSuccess('Quotation deleted'); fetchQuotations(); fetchStats(); setShowDetailDrawer(false);
    } catch { showError('Failed to delete quotation'); }
    finally { setLoading(false); }
  };

  const handleUploadQuotation = () => {
    setIsEditMode(false);
    setQuotationFormData({ rfqId: '', validTill: '', groupName: groupName || '', subGroupName: subGroupName || '', projectId: projectId || '', category: 'Manufacturer', vendorId: null, vendorName: '', vendorContact: '', vendorCategory: '', vendorType: '', vendorRating: 0, deliveryTime: '', paymentTerms: '', warranty: '', notes: '', status: 'New', gstOnTotal: 0, items: [] });
    setSelectedVendorDetails(null); setShowNewVendorForm(false); setVendors([]); setOrderBookItems([]);
    setVendorSearch(''); setVendorDropdownOpen(false);
    setModalGroupName(groupName || ''); setModalSubGroupName(subGroupName || ''); setModalProjectId(projectId || '');
    setSelectedFile(null); setFilePreview(null);
    fetchModalGroups();
    fetchAllVendors();
    if (groupName) { fetchModalSubGroups(groupName); fetchVendors(groupName, null); if (subGroupName) { fetchModalProjects(groupName, subGroupName); fetchVendors(groupName, subGroupName); } }
    if (projectId) fetchOrderBookItems(projectId);
    setShowUploadQuotationModal(true);
  };

  const handleSaveQuotation = async () => {
    if (!quotationFormData.groupName) { showError('Group is required'); return; }
    if (!quotationFormData.vendorId) {
      if (!quotationFormData.vendorName?.trim()) { showError('Vendor name is required'); return; }
      if (!quotationFormData.vendorContact || quotationFormData.vendorContact.length !== 10) { showError('Please enter a valid 10-digit contact number'); return; }
      if (!quotationFormData.vendorCategory) { showError('Vendor category is required'); return; }
      if (!quotationFormData.vendorType) { showError('Vendor type is required'); return; }
    }
    if (!quotationFormData.validTill) { showError('Valid until date is required'); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const vtd = new Date(quotationFormData.validTill); vtd.setHours(0, 0, 0, 0);
    if (vtd < today) { showError('Valid until date cannot be in the past'); return; }
    const included = quotationFormData.items.filter(i => i.included !== false);
    if (included.length === 0) { showError('Please include at least one item'); return; }
    for (let i = 0; i < included.length; i++) {
      const item = included[i];
      if (!item.itemName?.trim()) { showError(`Item ${i + 1}: Name is required`); return; }
      if (item.quantity === '' || item.quantity === null || item.quantity === undefined) { showError(`Item ${i + 1}: Quantity is required`); return; }
      if (item.unitPrice === '' || item.unitPrice === null || item.unitPrice === undefined || item.unitPrice < 0) { showError(`Item ${i + 1}: Unit price is required`); return; }
    }
    setLoading(true);
    try {
      const fd = new FormData();
      const qd = {
        vendorId: quotationFormData.vendorId || null, vendorName: quotationFormData.vendorName?.trim() || null,
        vendorContact: quotationFormData.vendorContact?.trim() || null,
        rfqId: quotationFormData.rfqId?.trim() || null,
        validTill: quotationFormData.validTill, groupName: quotationFormData.groupName,
        subGroupName: quotationFormData.subGroupName || null, projectId: quotationFormData.projectId || null,
        category: quotationFormData.category, deliveryTime: quotationFormData.deliveryTime?.trim() || null,
        paymentTerms: quotationFormData.paymentTerms?.trim() || null, warranty: quotationFormData.warranty?.trim() || null,
        notes: quotationFormData.notes?.trim() || null, status: quotationFormData.status, type: 'Procurement',
        items: included.map(item => ({ id: item.id || null, itemName: item.itemName.trim(), description: item.description?.trim() || '', unit: item.unit?.trim() || '', quantity: item.quantity, unitPrice: parseFloat(item.unitPrice), taxPercent: item.taxPercent, make: item.make?.trim() || '' })),
      };
      fd.append('quotation', new Blob([JSON.stringify(qd)], { type: 'application/json' }));
      if (selectedFile) fd.append('file', selectedFile);
      const url = isEditMode ? `${API_BASE_URL}/quotations/${quotationFormData.id}` : `${API_BASE_URL}/quotations/procurement`;
      const method = isEditMode ? 'PUT' : 'POST';
      const { 'Content-Type': _ct, ...multipartHeaders } = getAuthHeaders();
      const res = await fetch(url, { credentials: 'include', method, headers: multipartHeaders, body: fd });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed'); }
      showSuccess(isEditMode ? 'Quotation updated!' : 'Quotation uploaded!');
      setShowUploadQuotationModal(false); setSelectedFile(null); setFilePreview(null);
      setSelectedVendorDetails(null); setVendors([]); setOrderBookItems([]); setShowNewVendorForm(false); setIsEditMode(false);
      fetchQuotations(); fetchStats();
    } catch (err) { showError(err.message || 'Failed to save quotation'); }
    finally { setLoading(false); }
  };

  const handleAddQuotationItem = () => { if (quotationFormData) setQuotationFormData({ ...quotationFormData, items: [...quotationFormData.items, { itemName: '', description: '', unit: '', quantity: '', make: '', unitPrice: '', taxPercent: 18, included: true }] }); };
  const handleRemoveQuotationItem = (idx) => { if (quotationFormData?.items.length > 1) setQuotationFormData({ ...quotationFormData, items: quotationFormData.items.filter((_, i) => i !== idx) }); };
  const handleUpdateQuotationItem = (idx, field, val) => { if (quotationFormData) { const items = [...quotationFormData.items]; items[idx] = { ...items[idx], [field]: val }; setQuotationFormData({ ...quotationFormData, items }); } };

  const calculateQuotationTotal = () => {
    if (!quotationFormData) return { subtotal: 0, gstAmount: 0, total: 0 };
    const inc = quotationFormData.items.filter(i => i.included !== false);
    const subtotal = inc.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
    const gstPct = parseFloat(quotationFormData.gstOnTotal) || 0;
    const gstAmount = subtotal * gstPct / 100;
    return { subtotal, gstAmount, total: subtotal + gstAmount };
  };

  // ── Utility formatters ───────────────────────────────────────────────────
  const formatCurrency = (amt) => { if (!amt && amt !== 0) return '₹0.00'; const n = typeof amt === 'number' ? amt : parseFloat(amt) || 0; return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
  const formatDate = (d) => { if (!d) return ''; return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const formatFileSize = (b) => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(2) + ' KB'; return (b / 1048576).toFixed(2) + ' MB'; };

  const getStatusBadgeClass = (s) => ({ 'New': 'procurement-quotation-received-badge-new', 'Under Review': 'procurement-quotation-received-badge-review', 'Shortlisted': 'procurement-quotation-received-badge-shortlisted', 'Approved': 'procurement-quotation-received-badge-approved', 'PO Created': 'procurement-quotation-received-badge-po-created', 'Rejected': 'procurement-quotation-received-badge-rejected', 'Expired': 'procurement-quotation-received-badge-expired' })[s] || '';

  const isExpiringSoon = (validTill) => {
    if (!validTill) return false;
    const diff = Math.ceil((new Date(validTill) - new Date()) / 86400000);
    return diff <= 7 && diff > 0;
  };

  const kpiData = stats ? [
    { title: 'Total Quotations', value: stats.totalQuotations?.toString() || '0', icon: <FileText size={28} />, color: '#2563eb' },
    { title: 'New', value: stats.newQuotations?.toString() || '0', icon: <Clock size={28} />, color: '#f59e0b' },
    { title: 'Approved', value: stats.approved?.toString() || '0', icon: <CheckCircle size={28} />, color: '#22c55e' },
    { title: 'Rejected', value: stats.rejected?.toString() || '0', icon: <XCircle size={28} />, color: '#ef4444' },
  ] : [];

  const visibleColumns = columns.filter(c => c.visible);

  // ── Render column cell ───────────────────────────────────────────────────
  const renderCell = (col, q) => {
    switch (col.id) {
      case 'quotationNo': return <td className="procurement-quotation-received-table-id">{q.quoteNo}</td>;
      case 'vendorId': return <td>{q.vendorName || q.vendorId || '—'}</td>;
      case 'rfqId': return <td>{q.rfqId || '—'}</td>;
      case 'category': return <td>{q.category || 'N/A'}</td>;
      case 'quotationValue': return <td className="procurement-quotation-received-table-value">{formatCurrency(q.totalValue)}</td>;
      case 'validUntil': return (
        <td className={isExpiringSoon(q.validTill) ? 'procurement-quotation-received-expiring' : ''}>
          {formatDate(q.validTill)}
          {isExpiringSoon(q.validTill) && <span className="procurement-quotation-received-warning-icon"><AlertCircle size={14} /></span>}
        </td>
      );
      case 'file': return (
        <td>{q.fileName ? <a href={`${API_BASE_URL}/quotations/${q.id}/file`} target="_blank" rel="noopener noreferrer" className="file-link" title={`${q.fileName} (${formatFileSize(q.fileSize)})`}>📄 {q.fileName.substring(0, 15)}…</a> : '—'}</td>
      );
      case 'status': return (
        <td><span className={`procurement-quotation-received-badge ${getStatusBadgeClass(q.status)}`}>{q.status}</span></td>
      );
      case 'uploadedOn': return <td>{formatDate(q.uploadedAt)}</td>;
      case 'actions': return (
        <td>
          <div className="procurement-quotation-received-actions-cell">
            <button className="procurement-quotation-received-action-btn" onClick={() => handleViewQuotation(q)} title="View"><Eye size={14} /></button>
            <button className="procurement-quotation-received-action-btn" onClick={() => handleEditQuotation(q)} title="Edit" disabled={q.status === 'PO Created'} style={{ opacity: q.status !== 'PO Created' ? 1 : 0.4 }}><Edit2 size={14} /></button>
            {q.status === 'New' && <button className="procurement-quotation-received-action-btn" onClick={() => handleUpdateStatus(q.id, 'Shortlisted')} title="Shortlist"><Star size={14} /></button>}
            {(q.status === 'Shortlisted' || q.status === 'New') && <button className="procurement-quotation-received-action-btn" onClick={() => handleUpdateStatus(q.id, 'Approved')} title="Approve"><Check size={14} /></button>}
            {q.status === 'Approved' && <button className="procurement-quotation-received-action-btn procurement-quotation-received-create-po-btn" onClick={() => handleOpenCreatePOModal(q)} title="Create PO"><ShoppingCart size={14} /></button>}
{canDelete && <button className="procurement-quotation-received-action-btn" onClick={() => handleDeleteQuotation(q.id)} title="Delete" disabled={q.status === 'PO Created'} style={{ opacity: q.status !== 'PO Created' ? 1 : 0.4, color: '#ef4444' }}><Trash2 size={14} /></button>}
          </div>
        </td>
      );
      case 'group': return <td>{q.groupName || '—'}</td>;
      case 'project': return (
        <td style={{ minWidth: 200 }}>
          {q.projectId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                {q.projectName || q.projectId}
              </span>
              {q.projectName && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, whiteSpace: 'nowrap' }}>
                  {q.projectId}
                </span>
              )}
            </div>
          ) : <span style={{ color: '#94a3b8' }}>—</span>}
        </td>
      );
      default: return <td>—</td>;
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="procurement-quotation-received-container">
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

      {/* Header */}
      <div className="procurement-quotation-received-header">
        <div className="procurement-quotation-received-breadcrumb">Dashboard &gt; Procurement &gt; Quotations Received</div>
        <div className="page-header-with-filter">
          <h1 className="procurement-quotation-received-title">Quotations Received <span className="procurement-quotation-received-count">({totalElements})</span></h1>
          <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName} projectValue={projectId} onChange={updateFilters} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="procurement-quotation-received-action-bar">
        <div className="procurement-quotation-received-search-filters">
          <input type="text" placeholder="Search by Quotation No, RFQ ID, Vendor Name…" className="procurement-quotation-received-search" value={filters.search}
            onChange={(e) => { setFilters(prev => ({ ...prev, search: e.target.value })); setCurrentPage(0); }} />
          <select className="procurement-quotation-received-filter" value={filters.status}
            onChange={(e) => { setFilters(prev => ({ ...prev, status: e.target.value })); setCurrentPage(0); }}>
            <option value="all">All Status</option>
            <option value="New">New</option>
            <option value="Under Review">Under Review</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Approved">Approved</option>
            <option value="PO Created">PO Created</option>
            <option value="Rejected">Rejected</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <div className="procurement-quotation-received-actions">
          {/* Column manager */}
          <div style={{ position: 'relative' }}>
            <button className="procurement-quotation-received-btn-secondary procurement-btn-icon" onClick={() => setShowColumnManager(!showColumnManager)} title="Manage Columns">
              <Columns size={15} style={{ marginRight: 6 }} /> Columns
            </button>
            {showColumnManager && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', minWidth: 220, padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Manage Columns</span>
                  <button onClick={() => setShowColumnManager(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                {columns.map(col => (
                  <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: col.fixed ? 'default' : 'pointer', fontSize: 13, color: '#334155', background: 'none' }}
                    onMouseEnter={e => { if (!col.fixed) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                    <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.id)} disabled={col.fixed} style={{ width: 15, height: 15, cursor: col.fixed ? 'default' : 'pointer' }} />
                    <span>{col.label}</span>
                    {col.fixed && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>fixed</span>}
                  </label>
                ))}
                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 6, padding: '8px 16px 0' }}>
                  <button onClick={resetColumns} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset to default</button>
                </div>
              </div>
            )}
          </div>

          <button className="procurement-quotation-received-btn-primary" onClick={handleUploadQuotation}>
            <Upload size={15} style={{ marginRight: 6 }} /> Upload Quotation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="procurement-quotation-received-kpi-grid">
          {kpiData.map((kpi, i) => (
            <div key={i} className="procurement-quotation-received-kpi-card" style={{ borderTopColor: kpi.color }}>
              <div className="procurement-quotation-received-kpi-icon">{kpi.icon}</div>
              <div className="procurement-quotation-received-kpi-content">
                <div className="procurement-quotation-received-kpi-value">{kpi.value}</div>
                <div className="procurement-quotation-received-kpi-label">{kpi.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Table with draggable + sortable headers ── */}
      <div className="procurement-quotation-received-table-container">

        {/* Scrollable table */}
        <div className="procurement-table-scroll">
          <div className="procurement-table-wrapper">
            <table className="procurement-quotation-received-table">
              <thead>
                <tr>
                  {visibleColumns.map((col, index) => (
                    <th
                      key={col.id}
                      draggable={!col.fixed}
                      onDragStart={(e) => handleColDragStart(e, index)}
                      onDragOver={(e) => handleColDragOver(e, index)}
                      onDrop={(e) => handleColDrop(e, index)}
                      onDragEnd={handleColDragEnd}
                      onClick={() => handleSort(col.id)}
                      style={{
                        cursor: SORTABLE_COLUMNS.has(col.id)
                          ? "pointer"
                          : col.fixed
                            ? "default"
                            : "grab",
                        userSelect: "none",
                        background: dragOverColIndex === index ? "#dbeafe" : undefined,
                        transition: "background 0.15s",
                        whiteSpace: "nowrap",
                        minWidth: col.id === 'project' ? 200 : col.id === 'vendor' ? 160 : col.id === 'rfqId' ? 130 : undefined,
                      }}
                    >
                      {!col.fixed && (
                        <GripVertical
                          size={11}
                          style={{
                            opacity: 0.28,
                            marginRight: 3,
                            verticalAlign: "middle",
                            display: "inline-block",
                          }}
                        />
                      )}

                      {col.label}

                      {SORTABLE_COLUMNS.has(col.id) && (
                        <SortIcon columnId={col.id} sortConfig={sortConfig} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="empty-state">
                      No quotations found
                    </td>
                  </tr>
                ) : (
                  sortedQuotations.map((q) => (
                    <tr key={q.id} className="procurement-quotation-received-table-row">
                      {visibleColumns.map((col) => (
                        <React.Fragment key={col.id}>
                          {renderCell(col, q)}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="table-footer">
          <div className="table-footer-left">
            <span>
              Showing {totalElements === 0 ? 0 : currentPage * pageSize + 1}–
              {Math.min((currentPage + 1) * pageSize, totalElements)} of{" "}
              {totalElements} quotations
            </span>

            <div className="records-per-page">
             
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value));
                  setCurrentPage(0);
                }}
                className="page-size-select"
              >
                <option value="10">10 Rows</option>
                <option value="20">20 Rows</option>
                <option value="50">50 Rows</option>
                <option value="100">100 Rows</option>
              </select>
            </div>
          </div>

          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </button>

            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pn = currentPage < 3 ? i : currentPage + i - 2;

              if (pn >= 0 && pn < totalPages) {
                return (
                  <button
                    key={pn}
                    className={`page-btn ${pn === currentPage ? "active" : ""}`}
                    onClick={() => setCurrentPage(pn)}
                  >
                    {pn + 1}
                  </button>
                );
              }

              return null;
            })}

            <button
              className="page-btn"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      {showDetailDrawer && selectedQuotation && (
        <div className="procurement-quotation-received-drawer-overlay">
          <div className="procurement-quotation-received-drawer">
            <div className="procurement-quotation-received-drawer-header">
              <div>
                <h2>{selectedQuotation.quoteNo}</h2>
                <p className="procurement-quotation-received-drawer-subtitle">Vendor: {selectedQuotation.vendorName || selectedQuotation.vendorId || 'N/A'} | Category: {selectedQuotation.category || 'N/A'}</p>
              </div>
              <button className="procurement-quotation-received-drawer-close" onClick={() => setShowDetailDrawer(false)}>✕</button>
            </div>
            <div className="procurement-quotation-received-drawer-content">
              <div className="procurement-quotation-received-drawer-section">
                <h3>Quotation Details</h3>
                <div className="quotation-details-grid">
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Status:</span><span className={`procurement-quotation-received-badge ${getStatusBadgeClass(selectedQuotation.status)}`}>{selectedQuotation.status}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">RFQ ID:</span><span>{selectedQuotation.rfqId || '—'}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Valid Until:</span><span>{formatDate(selectedQuotation.validTill)}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Uploaded On:</span><span>{formatDate(selectedQuotation.uploadedAt)}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Total Value:</span><span className="quotation-value">{formatCurrency(selectedQuotation.totalValue)}</span></div>
                  <div className="quotation-detail-item"><span className="quotation-detail-label">Vendor Contact:</span><span>{selectedQuotation.vendorContact || '—'}</span></div>
                </div>
              </div>
              {(selectedQuotation.groupName || selectedQuotation.subGroupName || selectedQuotation.projectId) && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Project Assignment</h3>
                  <div className="quotation-details-grid">
                    {selectedQuotation.groupName && <div className="quotation-detail-item"><span className="quotation-detail-label">Group:</span><span>{selectedQuotation.groupName}</span></div>}
                    {selectedQuotation.subGroupName && <div className="quotation-detail-item"><span className="quotation-detail-label">Sub Group:</span><span>{selectedQuotation.subGroupName}</span></div>}
                    {selectedQuotation.projectId && <div className="quotation-detail-item"><span className="quotation-detail-label">Project ID:</span><span>{selectedQuotation.projectId}</span></div>}
                  </div>
                </div>
              )}
              {(selectedQuotation.deliveryTime || selectedQuotation.paymentTerms || selectedQuotation.warranty) && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Terms & Conditions</h3>
                  <div className="quotation-details-grid">
                    {selectedQuotation.deliveryTime && <div className="quotation-detail-item"><span className="quotation-detail-label">Delivery Time:</span><span>{selectedQuotation.deliveryTime}</span></div>}
                    {selectedQuotation.paymentTerms && <div className="quotation-detail-item"><span className="quotation-detail-label">Payment Terms:</span><span>{selectedQuotation.paymentTerms}</span></div>}
                    {selectedQuotation.warranty && <div className="quotation-detail-item"><span className="quotation-detail-label">Warranty:</span><span>{selectedQuotation.warranty}</span></div>}
                  </div>
                </div>
              )}
              {selectedQuotation.items?.length > 0 && (
                <div className="procurement-quotation-received-drawer-section">
                  <h3>Quotation Items ({selectedQuotation.items.length})</h3>
                  <div className="quotation-items-table-wrapper">
                    <table className="quotation-items-table">
                      <thead><tr><th>Line</th><th>Item Name</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Line Total</th></tr></thead>
                      <tbody>
                        {selectedQuotation.items.map((item, idx) => {
                          const qty = parseFloat(item.quantity) || 0, price = parseFloat(item.unitPrice) || 0, tax = parseFloat(item.taxPercent) || 0;
                          const sub = qty * price, total = sub + sub * tax / 100;
                          return (
                            <tr key={item.id || idx}>
                              <td>{item.lineNo || idx + 1}</td><td>{item.itemName}</td><td>{item.description || '—'}</td>
                              <td className="text-right">{qty}</td><td className="text-right">{formatCurrency(price)}</td>
                              <td className="text-center">{tax}%</td><td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedQuotation.notes && <div className="procurement-quotation-received-drawer-section"><h3>Notes</h3><p style={{ color: '#475569', lineHeight: 1.6 }}>{selectedQuotation.notes}</p></div>}
              <div className="procurement-quotation-received-drawer-section">
                <h3>Attached Files</h3>
                {selectedQuotation.fileName ? (
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={24} color="#64748b" />
                      <div><div style={{ fontWeight: 500, color: '#1e293b' }}>{selectedQuotation.fileName}</div><div style={{ fontSize: 12, color: '#64748b' }}>{formatFileSize(selectedQuotation.fileSize)}</div></div>
                    </div>
                    <a href={`${API_BASE_URL}/quotations/${selectedQuotation.id}/file`} target="_blank" rel="noopener noreferrer" className="procurement-quotation-received-btn-secondary" style={{ padding: '6px 12px', fontSize: 14 }}><Download size={16} /> View</a>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No file attached</p>}
              </div>
              <div className="procurement-quotation-received-drawer-actions">
                {selectedQuotation.status === 'Approved' && !selectedQuotation.poId && canCreate && (
                  <button className="procurement-quotation-received-btn-primary" onClick={() => { setShowDetailDrawer(false); handleOpenCreatePOModal(selectedQuotation); }}><ShoppingCart size={18} /> Create Purchase Order</button>
                )}
                {selectedQuotation.status !== 'PO Created' && canEdit && (
                  <button className="procurement-quotation-received-btn-secondary" onClick={() => { setShowDetailDrawer(false); handleEditQuotation(selectedQuotation); }}><Edit2 size={18} /> Edit Quotation</button>
                )}
                {selectedQuotation.status !== 'Approved' && selectedQuotation.status !== 'Rejected' && selectedQuotation.status !== 'PO Created' && (
                  <>
                    {selectedQuotation.status === 'New' && canEdit && <button className="procurement-quotation-received-btn-secondary" onClick={() => handleUpdateStatus(selectedQuotation.id, 'Shortlisted')}><Star size={18} /> Shortlist</button>}
                    {(selectedQuotation.status === 'Shortlisted' || selectedQuotation.status === 'New') && canApprove && <button className="procurement-quotation-received-btn-secondary" onClick={() => handleUpdateStatus(selectedQuotation.id, 'Approved')}><Check size={18} /> Approve</button>}
                    {canEdit && <button className="procurement-quotation-received-btn-secondary" style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleUpdateStatus(selectedQuotation.id, 'Rejected')}><XCircle size={18} /> Reject</button>}
                  </>
                )}
                {selectedQuotation.status !== 'PO Created' && canDelete && (
                  <button className="procurement-quotation-received-btn-secondary" style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleDeleteQuotation(selectedQuotation.id)}><Trash2 size={18} /> Delete Quotation</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload / Edit Quotation Modal ── */}
      {showUploadQuotationModal && quotationFormData && (
        <div className="procurement-quotation-received-modal-overlay">
          <div className="procurement-quotation-received-upload-modal" style={{ maxWidth: 1400, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="procurement-quotation-received-modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h2>{isEditMode ? 'Edit Quotation' : 'Upload New Quotation'}</h2>
                {isEditMode && quotationFormData.quoteNo && <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Quotation: {quotationFormData.quoteNo}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Download Template + Excel Import — only show when creating */}
                {!isEditMode && (
                  <>
                    <a
                      href="/templates/BOQ_Quotation_Template.xlsx"
                      download="BOQ_Quotation_Template.xlsx"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #86efac', borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      title="Download Excel template to fill and import"
                    >
                      <Download size={14} /> Download Template
                    </a>
                    <button
                      onClick={() => { setImportPreview([]); setImportErrors([]); setImportFileName(''); xlsxFileRef.current?.click(); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 15px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                      title="Select an Excel file to import items directly"
                    >
                      <FileSpreadsheet size={15} /> Import Items from Excel
                    </button>
                  </>
                )}
                <button className="procurement-quotation-received-modal-close" onClick={() => { setShowUploadQuotationModal(false); setIsEditMode(false); setVendorDropdownOpen(false); setVendorSearch(''); }}>✕</button>
              </div>
            </div>

            <div className="procurement-quotation-received-upload-form" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Project Assignment */}
              <div className="procurement-quotation-received-form-section" style={{ background: '#f8fafc', padding: 20, borderRadius: 8 }}>
                <h3>📂 Project Assignment</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Group *</label>
                    <select value={modalGroupName} onChange={handleModalGroupChange} disabled={modalDropdownLoading.groups}>
                      <option value="">{modalDropdownLoading.groups ? 'Loading…' : 'Select Group'}</option>
                      {modalGroups.map((g, i) => <option key={g.value || i} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Sub Group</label>
                    <select value={modalSubGroupName} onChange={handleModalSubGroupChange} disabled={!modalGroupName || modalDropdownLoading.subGroups}>
                      <option value="">{modalDropdownLoading.subGroups ? 'Loading…' : 'Select Sub Group'}</option>
                      {modalSubGroups.map((sg, i) => <option key={sg.value || i} value={sg.value}>{sg.label}</option>)}
                    </select>
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Project (Optional)</label>
                    <select value={modalProjectId} onChange={handleModalProjectChange} disabled={!modalSubGroupName || modalDropdownLoading.projects}>
                      <option value="">{modalDropdownLoading.projects ? 'Loading…' : 'Select Project'}</option>
                      {modalProjects.map((p, i) => <option key={p.id || i} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                {loadingOrderItems && <div style={{ marginTop: 10, color: '#3b82f6', fontSize: 13 }}>🔄 Loading order book items…</div>}
                {!isEditMode && orderBookItems.length > 0 && <div style={{ marginTop: 10, color: '#059669', fontSize: 13 }}>✅ Loaded {orderBookItems.length} items from order book</div>}
              </div>

              {/* Vendor */}
              <div className="procurement-quotation-received-form-section">
                <h3>🏢 Vendor Information</h3>
                <div style={{ marginBottom: 15, display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="radio" name="vendorType" checked={!showNewVendorForm} onChange={() => handleVendorTypeChange('existing')} style={{ marginRight: 8 }} /><span>Select Existing Vendor</span></label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="radio" name="vendorType" checked={showNewVendorForm} onChange={() => handleVendorTypeChange('new')} style={{ marginRight: 8 }} /><span>Add New Vendor</span></label>
                </div>
                {!showNewVendorForm && (
                  <div className="procurement-quotation-received-form-row">
                    <div className="procurement-quotation-received-form-group" style={{ position: 'relative' }}>
                      <label>Select Vendor *</label>
                      {/* Searchable vendor dropdown — matches Create PO modal */}
                      <div style={{ position: 'relative' }}>
                        <div
                          onClick={() => { setVendorDropdownOpen(o => !o); setVendorSearch(''); }}
                          style={{
                            width: '100%', padding: '10px 36px 10px 12px', fontSize: '14px',
                            border: `1px solid ${vendorDropdownOpen ? '#3b82f6' : '#d1d5db'}`,
                            borderRadius: '6px', background: 'white', cursor: 'pointer',
                            boxSizing: 'border-box', position: 'relative', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between',
                            userSelect: 'none', minHeight: '42px'
                          }}
                        >
                          <span style={{ color: quotationFormData.vendorId ? '#111827' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {quotationFormData.vendorId
                              ? (() => { const sel = vendors.find(v => v.id === quotationFormData.vendorId); return sel ? `${sel.name}${(sel.phone || sel.contact) ? ' • ' + (sel.phone || sel.contact) : ''}` : 'Select Vendor'; })()
                              : '-- Select Vendor --'}
                          </span>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0, color: '#6b7280', transform: vendorDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
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
                                placeholder="Search vendor by name, phone..."
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
                                .filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || (v.phone || v.contact)?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase()))
                                .map(v => (
                                  <div
                                    key={v.id}
                                    onClick={() => { handleVendorSelection({ target: { value: String(v.id) } }); setVendorDropdownOpen(false); setVendorSearch(''); }}
                                    style={{
                                      padding: '9px 12px', fontSize: '14px', cursor: 'pointer',
                                      background: quotationFormData.vendorId === v.id ? '#eff6ff' : 'white',
                                      borderLeft: quotationFormData.vendorId === v.id ? '3px solid #3b82f6' : '3px solid transparent'
                                    }}
                                    onMouseEnter={e => { if (quotationFormData.vendorId !== v.id) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={e => { if (quotationFormData.vendorId !== v.id) e.currentTarget.style.background = 'white'; }}
                                  >
                                    <div style={{ fontWeight: 500, color: '#111827' }}>{v.name}</div>
                                    {((v.phone || v.contact) || v.category) && (
                                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                        {(v.phone || v.contact) && <span>{v.phone || v.contact}</span>}
                                        {(v.phone || v.contact) && v.category && <span> · </span>}
                                        {v.category && <span>{v.category}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))
                              }
                              {vendors.filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || (v.phone || v.contact)?.includes(vendorSearch) || v.category?.toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                                <div style={{ padding: '12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>No vendors found</div>
                              )}
                            </div>
                            <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#9ca3af' }}>{vendors.length} vendor(s) total</div>
                          </div>
                        )}
                        {/* Click-outside overlay */}
                        {vendorDropdownOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setVendorDropdownOpen(false)} />}
                      </div>
                      {vendors.length === 0 && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>No vendors available. Select a group or add a new vendor.</small>}
                    </div>
                    {quotationFormData.vendorId && selectedVendorDetails && (
                      <div className="procurement-quotation-received-form-group">
                        <label>Selected Vendor Details</label>
                        <div style={{ padding: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, fontSize: 14, color: '#0c4a6e' }}>
                          <div style={{ marginBottom: 6 }}><strong>📋 Name:</strong> {selectedVendorDetails.name}</div>
                          {selectedVendorDetails.phone && <div><strong>📞 Contact:</strong> {selectedVendorDetails.phone}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {showNewVendorForm && (
                  <div style={{ padding: 20, background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 8 }}>
                    <div className="procurement-quotation-received-form-row">
                      <div className="procurement-quotation-received-form-group">
                        <label>Vendor Name *</label>
                        <input type="text" value={quotationFormData.vendorName || ''} onChange={(e) => setQuotationFormData({ ...quotationFormData, vendorName: e.target.value })} placeholder="Enter vendor name" />
                      </div>
                      <div className="procurement-quotation-received-form-group">
                        <label>Contact Number * (10 digits)</label>
                        <input type="tel" value={quotationFormData.vendorContact || ''} onChange={(e) => handleNewVendorContactChange(e.target.value)} placeholder="10-digit mobile" maxLength={10} />
                        {quotationFormData.vendorContact && quotationFormData.vendorContact.length < 10 && <small style={{ color: '#dc2626', fontSize: 12, marginTop: 4, display: 'block' }}>Must be exactly 10 digits</small>}
                      </div>
                    </div>
                    <div className="procurement-quotation-received-form-row">
                      <div className="procurement-quotation-received-form-group">
                        <label>Category *</label>
                        <select value={quotationFormData.vendorCategory || ''} onChange={(e) => setQuotationFormData({ ...quotationFormData, vendorCategory: e.target.value })}>
                          <option value="">Select category</option>
                          <option value="IT Equipment">IT Equipment</option>
                          <option value="Office Furniture">Office Furniture</option>
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Office Supplies">Office Supplies</option>
                          <option value="Services">Services</option>
                        </select>
                      </div>
                      <div className="procurement-quotation-received-form-group">
                        <label>Vendor Type *</label>
                        <select value={quotationFormData.vendorType || ''} onChange={(e) => setQuotationFormData({ ...quotationFormData, vendorType: e.target.value })}>
                          <option value="">Select type</option>
                          <option value="Manufacturer">Manufacturer</option>
                          <option value="Distributor">Distributor</option>
                          <option value="Service Provider">Service Provider</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', padding: '12px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '13px', color: '#1e40af' }}>💡 This vendor will be created when you save the quotation.</div>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="procurement-quotation-received-form-section">
                <h3>Basic Information</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>RFQ ID</label>
                    <input type="text" value={quotationFormData.rfqId} onChange={(e) => setQuotationFormData({ ...quotationFormData, rfqId: e.target.value })} placeholder="e.g., RFQ-2024-001" />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Category *</label>
                    <select value={quotationFormData.category} onChange={(e) => setQuotationFormData({ ...quotationFormData, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Status *</label>
                    <select value={quotationFormData.status} onChange={(e) => setQuotationFormData({ ...quotationFormData, status: e.target.value })}>
                      <option value="New">New</option><option value="Under Review">Under Review</option>
                      <option value="Shortlisted">Shortlisted</option><option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      {isEditMode && quotationFormData.status === 'PO Created' && <option value="PO Created">PO Created</option>}
                    </select>
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Valid Till *</label>
                    <input type="date" value={quotationFormData.validTill} onChange={(e) => setQuotationFormData({ ...quotationFormData, validTill: e.target.value })} min={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Payment Terms</label>
                    <input type="text" value={quotationFormData.paymentTerms} onChange={(e) => setQuotationFormData({ ...quotationFormData, paymentTerms: e.target.value })} placeholder="e.g., Net 30" />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group">
                    <label>Delivery Time</label>
                    <input type="text" value={quotationFormData.deliveryTime} onChange={(e) => setQuotationFormData({ ...quotationFormData, deliveryTime: e.target.value })} placeholder="e.g., 2 weeks" />
                  </div>
                  <div className="procurement-quotation-received-form-group">
                    <label>Warranty</label>
                    <input type="text" value={quotationFormData.warranty} onChange={(e) => setQuotationFormData({ ...quotationFormData, warranty: e.target.value })} placeholder="e.g., 1 year" />
                  </div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group" style={{ flex: '1 1 100%' }}>
                    <label>Notes</label>
                    <input type="text" value={quotationFormData.notes} onChange={(e) => setQuotationFormData({ ...quotationFormData, notes: e.target.value })} placeholder="Additional notes" />
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div className="procurement-quotation-received-form-section">
                <h3>Attach Quotation File (Optional)</h3>
                <div className="procurement-quotation-received-form-group">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} style={{ marginBottom: 10 }} />
                  {selectedFile && <div className="file-info-box">📄 {selectedFile.name} ({formatFileSize(selectedFile.size)})</div>}
                  {filePreview && <img src={filePreview} alt="Preview" style={{ maxWidth: 200, marginTop: 10 }} />}
                  <small style={{ color: '#64748b' }}>Max 5MB | PDF, JPG, PNG</small>
                  {isEditMode && <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 13 }}>ℹ️ Uploading a new file will replace the existing one</div>}
                </div>
              </div>

              {/* Items */}
              <div className="procurement-quotation-received-form-section">
                <div className="procurement-quotation-received-section-header">
                  <h3>
                    Quotation Items *
                    {quotationFormData.items.length > 0 && (
                      <span style={{ fontSize: 14, color: '#64748b', fontWeight: 'normal', marginLeft: 8 }}>
                        ({quotationFormData.items.filter(i => i.included !== false).length} of {quotationFormData.items.length} included)
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isEditMode && (
                      <button type="button" onClick={() => { setImportPreview([]); setImportErrors([]); setImportFileName(''); xlsxFileRef.current?.click(); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        <FileSpreadsheet size={13} /> Import from Excel
                      </button>
                    )}
                    <button type="button" className="procurement-quotation-received-btn-add-item" onClick={handleAddQuotationItem}>+ Add Item</button>
                  </div>
                </div>

                {quotationFormData.items.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', border: '2px dashed #cbd5e0', borderRadius: 8 }}>
                    <div style={{ fontSize: 48, marginBottom: 10 }}>📦</div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 5, color: '#64748b' }}>No Items Added</div>
                    <div style={{ fontSize: 14, color: '#94a3b8' }}>
                      {isEditMode ? 'Click "+ Add Item" to add items' : 'Click "Import from Excel" to bulk-add items, or "+ Add Item" to add manually'}
                    </div>
                  </div>
                ) : (
                  <>
                    {!isEditMode && orderBookItems.length > 0 && (
                      <div style={{ marginBottom: 15, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, color: '#1e40af' }}>
                        💡 <strong>Tip:</strong> Items loaded from order book. Uncheck items you don't want and enter vendor prices.
                      </div>
                    )}
                    <div className="procurement-quotation-received-items-table-wrapper">
                      <table className="procurement-quotation-received-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>Inc</th>
                            <th style={{ width: 40 }}>S.No</th>
                            <th style={{ minWidth: 200 }}>Description *</th>
                            <th style={{ minWidth: 140 }}>Unit</th>
                            <th style={{ width: 80 }}>Qty *</th>
                            <th style={{ minWidth: 150 }}>Make</th>
                            <th style={{ width: 120 }}>Rate (₹) *</th>
                            <th style={{ width: 120 }}>Amount</th>
                            <th style={{ width: 50 }}>Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotationFormData.items.map((item, idx) => {
                            const inc = item.included !== false;
                            const qty = parseFloat(item.quantity) || 0;
                            const price = parseFloat(item.unitPrice) || 0;
                            const amount = qty * price;
                            return (
                              <tr key={idx} style={{ background: inc ? 'white' : '#f8fafc', opacity: inc ? 1 : 0.5 }}>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={inc} onChange={() => toggleItemInclusion(idx)} style={{ width: 18, height: 18, cursor: 'pointer' }} /></td>
                                <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{idx + 1}</td>
                                <td>
                                  {inc ? (
                                    <ItemNameAutocomplete
                                      value={item.itemName}
                                      onChange={(val) => handleUpdateQuotationItem(idx, 'itemName', val)}
                                      onSelect={(cat) => {
                                        const items = [...quotationFormData.items];
                                        items[idx] = {
                                          ...items[idx],
                                          itemName:    cat.itemName,
                                          description: cat.specification || cat.description || items[idx].description,
                                          unit:        cat.unit           || items[idx].unit,
                                          unitPrice:   cat.unitPrice  > 0 ? cat.unitPrice  : items[idx].unitPrice,
                                        };
                                        setQuotationFormData({ ...quotationFormData, items });
                                      }}
                                      user={user}
                                      placeholder="Item name / description"
                                      className="table-input"
                                    />
                                  ) : (
                                    <input type="text" placeholder="Item name / description" value={item.itemName} className="table-input" disabled />
                                  )}
                                  <input type="text" placeholder="Specification (optional)" value={item.description} onChange={(e) => handleUpdateQuotationItem(idx, 'description', e.target.value)} className="table-input" disabled={!inc} style={{ marginTop: 3, fontSize: 11, color: '#64748b' }} />
                                </td>
                                <td>
                                  <UnitTypeDropdown
                                    value={item.unit === '' || item.unit == null || COMMON_UNITS.includes(item.unit) ? (item.unit || '') : 'Custom'}
                                    onChange={(e) => {
                                      if (e.target.value === 'Custom') {
                                        handleUpdateQuotationItem(idx, 'unit', '');
                                      } else {
                                        handleUpdateQuotationItem(idx, 'unit', e.target.value);
                                      }
                                    }}
                                    className="table-input text-center"
                                    disabled={!inc}
                                    placeholder="Select Unit"
                                  />
                                  {(item.unit !== '' && item.unit != null && !COMMON_UNITS.includes(item.unit)) && (
                                    <input
                                      type="text"
                                      placeholder="Enter custom unit"
                                      value={item.unit}
                                      onChange={(e) => handleUpdateQuotationItem(idx, 'unit', e.target.value)}
                                      className="table-input text-center"
                                      disabled={!inc}
                                      style={{ marginTop: 3, fontSize: 11 }}
                                    />
                                  )}
                                </td>
                                <td><input type="number" min="0" placeholder="Qty" value={item.quantity === '' || item.quantity == null ? '' : item.quantity} onChange={(e) => handleUpdateQuotationItem(idx, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))} className="table-input text-center" disabled={!inc} /></td>
                                <td><input type="text" placeholder="Brand / Make" value={item.make || ''} onChange={(e) => handleUpdateQuotationItem(idx, 'make', e.target.value)} className="table-input" disabled={!inc} /></td>
                                <td><input type="number" min="0" step="0.01" placeholder="Rate" value={item.unitPrice} onChange={(e) => handleUpdateQuotationItem(idx, 'unitPrice', e.target.value)} className="table-input text-right" disabled={!inc} /></td>
                                <td className="text-right" style={{ fontWeight: 600, color: inc ? '#1e293b' : '#94a3b8' }}>{inc && item.unitPrice ? formatCurrency(amount) : '-'}</td>
                                <td className="text-center"><button type="button" className="procurement-quotation-received-btn-remove-item" onClick={() => handleRemoveQuotationItem(idx)} title="Remove">✕</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Overall GST on Total */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 6px', justifyContent: 'flex-end' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>GST on Total (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="e.g. 8.9"
                        value={quotationFormData.gstOnTotal || ''}
                        onChange={(e) => setQuotationFormData({ ...quotationFormData, gstOnTotal: e.target.value })}
                        style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 100, textAlign: 'right' }}
                      />
                    </div>
                    <div className="procurement-quotation-received-quote-summary">
                      <div className="procurement-quotation-received-summary-row"><span>Subtotal:</span><span>{formatCurrency(calculateQuotationTotal().subtotal)}</span></div>
                      {(parseFloat(quotationFormData.gstOnTotal) > 0) && <div className="procurement-quotation-received-summary-row"><span>GST ({parseFloat(quotationFormData.gstOnTotal)}%):</span><span>{formatCurrency(calculateQuotationTotal().gstAmount)}</span></div>}
                      <div className="procurement-quotation-received-summary-row procurement-quotation-received-summary-total"><span><strong>Total Value:</strong></span><span><strong>{formatCurrency(calculateQuotationTotal().total)}</strong></span></div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="procurement-quotation-received-modal-actions" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <button className="procurement-quotation-received-btn-primary" onClick={handleSaveQuotation} disabled={quotationFormData.items.filter(i => i.included !== false).length === 0}>
                {isEditMode ? 'Update Quotation' : 'Upload Quotation'}
              </button>
              <button className="procurement-quotation-received-btn-secondary" onClick={() => { setShowUploadQuotationModal(false); setIsEditMode(false); setVendorDropdownOpen(false); setVendorSearch(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for Excel import — rendered unconditionally so
          xlsxFileRef.current is always valid when the user clicks Import Items from Excel */}
      <input ref={xlsxFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleXlsxFileSelect} style={{ display: 'none' }} />

      {/* ── Excel Import Modal ── */}
      {showImportModal && (
        <div className="procurement-quotation-received-modal-overlay">
          <div className="procurement-quotation-received-upload-modal" style={{ maxWidth: 900 }}>
            <div className="procurement-quotation-received-modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={22} color="#2563eb" /> Import Quotation Items from Excel
              </h2>
              <button className="procurement-quotation-received-modal-close" onClick={handleCloseImportModal}>✕</button>
            </div>

            <div className="procurement-quotation-received-upload-form" style={{ padding: '20px 24px' }}>

              {/* File selected info + option to change */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileSpreadsheet size={20} color="#2563eb" />
                  <div>
                    <strong style={{ fontSize: 13, color: '#1e40af', display: 'block' }}>{importFileName || 'Excel file selected'}</strong>
                    <span style={{ fontSize: 12, color: '#3b82f6' }}>Review the items below before importing into the form</span>
                  </div>
                </div>
                <button
                  onClick={() => { setImportPreview([]); setImportErrors([]); setImportFileName(''); xlsxFileRef.current?.click(); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#2563eb', border: '1.5px solid #93c5fd', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  <Upload size={13} /> Choose Different File
                </button>
              </div>

              {/* Errors */}
              {importErrors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                  <strong style={{ color: '#dc2626', display: 'block', marginBottom: 6 }}>⚠ Fix these errors before importing:</strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#b91c1c', fontSize: 12, lineHeight: 1.7 }}>
                    {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Preview */}
              {importPreview.length > 0 && importErrors.length === 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong style={{ color: '#1e40af', fontSize: 14 }}>✓ {importPreview.length} item{importPreview.length !== 1 ? 's' : ''} ready to import</strong>
                    <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 12 }}>
                      Est. total: {formatCurrency(importPreview.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0), 0))}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 280, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: '#1e3a5f' }}>
                          {['#', 'Description', 'Unit', 'Qty', 'Make', 'Rate (₹)', 'Amount'].map(h => (
                            <th key={h} style={{ padding: '9px 11px', textAlign: 'left', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => {
                          const lt = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                              <td style={{ padding: '7px 11px', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                              <td style={{ padding: '7px 11px', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.itemName}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'center', color: '#64748b' }}>{row.unit || '—'}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'center' }}>{row.quantity}</td>
                              <td style={{ padding: '7px 11px', color: '#64748b', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.make || '—'}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.unitPrice)}</td>
                              <td style={{ padding: '7px 11px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(lt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="procurement-quotation-received-modal-actions">
              <button className="procurement-quotation-received-btn-secondary" onClick={handleCloseImportModal}>Cancel</button>
              <button
                className="procurement-quotation-received-btn-primary"
                onClick={handleConfirmImport}
                disabled={importPreview.length === 0 || importErrors.length > 0}
                style={{ opacity: (importPreview.length === 0 || importErrors.length > 0) ? 0.5 : 1 }}
              >
                Import {importPreview.length > 0 ? `${importPreview.length} Item${importPreview.length !== 1 ? 's' : ''}` : 'Items'} into Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create PO Modal ── */}
      {showCreatePOFromQuotationModal && poFormData && (
        <div className="procurement-quotation-received-modal-overlay">
          <div className="procurement-quotation-received-upload-modal" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="procurement-quotation-received-modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h2>Create Purchase Order</h2>
                <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>From Quotation: {poFormData.quoteNo}</p>
              </div>
              <button className="procurement-quotation-received-modal-close" onClick={() => setShowCreatePOFromQuotationModal(false)}>✕</button>
            </div>
            <div className="procurement-quotation-received-upload-form" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="procurement-quotation-received-form-section">
                <h3>Purchase Order Details</h3>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group"><label>Vendor Contact</label><input type="text" value={poFormData.vendorContact || 'N/A'} disabled style={{ backgroundColor: '#f1f5f9' }} /></div>
                  <div className="procurement-quotation-received-form-group"><label>RFQ ID</label><input type="text" value={poFormData.rfqId || 'N/A'} disabled style={{ backgroundColor: '#f1f5f9' }} /></div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group"><label>Order Date</label><input type="date" value={poFormData.orderDate} onChange={(e) => setPOFormData({ ...poFormData, orderDate: e.target.value })} /></div>
                  <div className="procurement-quotation-received-form-group"><label>Expected Delivery *</label><input type="date" value={poFormData.expectedDelivery} onChange={(e) => setPOFormData({ ...poFormData, expectedDelivery: e.target.value })} min={poFormData.orderDate} /></div>
                </div>
                <div className="procurement-quotation-received-form-row">
                  <div className="procurement-quotation-received-form-group"><label>Payment Terms</label><input type="text" value={poFormData.paymentTerms} onChange={(e) => setPOFormData({ ...poFormData, paymentTerms: e.target.value })} placeholder="e.g., Net 30" /></div>
                  <div className="procurement-quotation-received-form-group"><label>Shipping Address</label><input type="text" value={poFormData.shippingAddress} onChange={(e) => setPOFormData({ ...poFormData, shippingAddress: e.target.value })} placeholder="Enter shipping address" /></div>
                </div>
                <div className="procurement-quotation-received-form-group"><label>Notes</label><textarea rows={2} value={poFormData.notes} onChange={(e) => setPOFormData({ ...poFormData, notes: e.target.value })} placeholder="Additional notes" style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #e2e8f0' }} /></div>
              </div>
              <div className="procurement-quotation-received-form-section">
                <h3>Select Items & Quantities</h3>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>Adjust quantities as needed (cannot exceed quoted quantities)</p>
                <div className="procurement-quotation-received-items-table-wrapper">
                  <table className="procurement-quotation-received-items-table">
                    <thead><tr><th>Item Name</th><th>Description</th><th>Quoted Qty</th><th>PO Qty *</th><th>Unit Price (₹)</th><th>GST %</th><th>Line Total</th></tr></thead>
                    <tbody>
                      {poFormData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.itemName}</td><td>{item.description || '—'}</td>
                          <td className="text-center" style={{ fontWeight: 600 }}>{item.quotedQuantity}</td>
                          <td><input type="number" min="0" max={item.quotedQuantity} value={item.selectedQuantity} onChange={(e) => handleUpdatePOItemQuantity(idx, e.target.value)} className="table-input text-center" style={{ fontWeight: 600 }} /></td>
                          <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-center">{item.taxPercent}%</td>
                          <td className="text-right" style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="procurement-quotation-received-quote-summary">
                  <div className="procurement-quotation-received-summary-row"><span>Subtotal:</span><span>{formatCurrency(calculatePOTotal().subtotal)}</span></div>
                  <div className="procurement-quotation-received-summary-row"><span>Tax Amount:</span><span>{formatCurrency(calculatePOTotal().taxAmount)}</span></div>
                  <div className="procurement-quotation-received-summary-row procurement-quotation-received-summary-total"><span><strong>Total PO Value:</strong></span><span><strong>{formatCurrency(calculatePOTotal().total)}</strong></span></div>
                </div>
              </div>
            </div>
            <div className="procurement-quotation-received-modal-actions" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <button className="procurement-quotation-received-btn-primary" onClick={handleCreatePOFromQuotation} disabled={!poFormData.expectedDelivery || !poFormData.items.some(i => i.selectedQuantity > 0)}>Create Purchase Order</button>
              <button className="procurement-quotation-received-btn-secondary" onClick={() => setShowCreatePOFromQuotationModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationsReceived;