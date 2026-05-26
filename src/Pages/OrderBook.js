import React, { useState, useEffect, useRef } from 'react';
import '../pages-css/OrderBook.css';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import FilterSelect from '../components/Dropdowns/FilterSelect.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import UnitTypeDropdown from '../components/Dropdowns/Unittypedropdown.js';
import ItemNameAutocomplete from '../components/OrderBook/ItemNameAutocomplete.js';
import { Eye, Edit2, Trash2, Upload, CloudUpload } from 'lucide-react';
import { FaFileDownload, FaCloudUploadAlt, FaColumns, FaFileAlt, FaFilePdf, FaFileImage, FaTimes, FaDownload, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';

/* ── OrderBook Date Range Picker (same style as Clients Data) ────────────── */
const _OB_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _OB_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const OBDateRangePicker = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  const [show,  setShow]  = useState(false);
  const [from,  setFrom]  = useState(null);
  const [to,    setTo]    = useState(null);
  const [hover, setHover] = useState(null);
  const [calMo, setCalMo] = useState(new Date().getMonth());
  const [calYr, setCalYr] = useState(new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const DIM = new Date(calYr, calMo + 1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0, 10);

  const inR = d => {
    const hi = to || (from && hover ? hover : null);
    if (!from || !hi) return false;
    const [a, b] = from <= hi ? [from, hi] : [hi, from];
    return d > a && d < b;
  };
  const clickDay = d => {
    if (!from || (from && to)) { setFrom(d); setTo(null); }
    else if (d < from) { setFrom(d); setTo(null); }
    else if (d === from) { setFrom(null); setTo(null); }
    else setTo(d);
  };
  const fmt = d => { if (!d) return 'dd-mm-yyyy'; const [y, m, dy] = d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`orderbook-filter ob-date-trigger${show ? ' ob-date-trigger--open' : ''}${appliedFrom ? ' ob-date-trigger--applied' : ''}`}
        onClick={() => setShow(p => !p)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span style={{ fontSize: 12, color: appliedFrom ? '#1e293b' : '#94a3b8' }}>FROM</span>
        <span style={{ fontSize: 12, fontWeight: appliedFrom ? 600 : 400, color: appliedFrom ? '#1e293b' : '#94a3b8' }}>{fmt(appliedFrom)}</span>
        <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>TO</span>
        <span style={{ fontSize: 12, fontWeight: appliedTo ? 600 : 400, color: appliedTo ? '#1e293b' : '#94a3b8' }}>{fmt(appliedTo)}</span>
        {appliedFrom && (
          <span onClick={e => { e.stopPropagation(); setFrom(null); setTo(null); onClear(); }} style={{ marginLeft: 2, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>
            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </span>
        )}
      </button>

      {show && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.12)', padding: 16, minWidth: 280 }}>
          {/* Month/Year header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr(y => y - 1); } else setCalMo(m => m - 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 16 }}>‹</button>
            <button type="button" onClick={() => setShowYr(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{_OB_MONTHS[calMo]} {calYr}</button>
            <button type="button" onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr(y => y + 1); } else setCalMo(m => m + 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: 16 }}>›</button>
          </div>
          {showYr ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 10 }}>
              {Array.from({ length: 16 }, (_, i) => { const yr = new Date().getFullYear() - 4 + i; return (
                <div key={yr} onClick={() => { setCalYr(yr); setShowYr(false); }} style={{ textAlign: 'center', padding: '4px 0', borderRadius: 4, cursor: 'pointer', fontWeight: yr === calYr ? 700 : 400, background: yr === calYr ? '#4f46e5' : 'transparent', color: yr === calYr ? '#fff' : '#1e293b', fontSize: 12 }}>{yr}</div>
              ); })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 8 }}>
              {_OB_DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '2px 0' }}>{d}</div>)}
              {Array.from({ length: FD }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: DIM }).map((_, i) => {
                const dy = i + 1;
                const ds = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
                const dow = (FD + i) % 7;
                let bg = 'transparent', color = '#1e293b', borderRadius = 4;
                if (ds === from || ds === to) { bg = '#4f46e5'; color = '#fff'; }
                else if (inR(ds)) { bg = '#e0e7ff'; color = '#3730a3'; if (dow === 0) borderRadius = '4px 0 0 4px'; if (dow === 6) borderRadius = '0 4px 4px 0'; }
                else if (ds === tod) { color = '#4f46e5'; }
                return (
                  <div key={ds} onClick={() => clickDay(ds)} onMouseEnter={() => from && !to && setHover(ds)} onMouseLeave={() => setHover(null)}
                    style={{ textAlign: 'center', padding: '5px 0', cursor: 'pointer', borderRadius, background: bg, color, fontSize: 12, fontWeight: ds === from || ds === to ? 700 : 400 }}>{dy}</div>
                );
              })}
            </div>
          )}
          {/* Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: from ? '#e0e7ff' : '#f1f5f9', color: from ? '#3730a3' : '#94a3b8', fontWeight: from ? 600 : 400 }}>{from ? fmt(from) : 'From —'}</span>
            <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: to ? '#e0e7ff' : '#f1f5f9', color: to ? '#3730a3' : '#94a3b8', fontWeight: to ? 600 : 400 }}>{to ? fmt(to) : 'To —'}</span>
          </div>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {(from || appliedFrom) && <button type="button" onClick={() => { setFrom(null); setTo(null); onClear(); setShow(false); }} style={{ flex: 1, padding: '6px 0', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>Clear</button>}
            <button type="button" onClick={() => setShow(false)} style={{ flex: 1, padding: '6px 0', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>Cancel</button>
            <button type="button" onClick={() => { if (!from) return; onApply(from, to || from); setShow(false); }} disabled={!from} style={{ flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, background: from ? '#4f46e5' : '#e2e8f0', color: from ? '#fff' : '#94a3b8', cursor: from ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Simple DatePicker (calendar only, no time — same style as TaskManagement) ── */
const OBDatePicker = ({ value, onChange, placeholder = 'Select date' }) => {
  const [show, setShow] = useState(false);
  const [calMo, setCalMo] = useState(() => value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth());
  const [calYr, setCalYr] = useState(() => value ? parseInt(value.slice(0, 4)) : new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const trigRef = useRef(null), dpRef = useRef(null);

  useEffect(() => {
    const h = e => { if (trigRef.current && !trigRef.current.contains(e.target) && dpRef.current && !dpRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const open = () => {
    if (value) { setCalMo(parseInt(value.slice(5, 7)) - 1); setCalYr(parseInt(value.slice(0, 4))); }
    if (trigRef.current) {
      const r = trigRef.current.getBoundingClientRect();
      const dH = 310;
      const up = window.innerHeight - r.bottom < dH && r.top > dH;
      setPos({ top: up ? r.top - dH - 4 : r.bottom + 4, left: r.left });
    }
    setShow(true);
  };

  const DIM = new Date(calYr, calMo + 1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0, 10);
  const fmtD = d => { if (!d) return null; const [y, m, dy] = d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <>
      <button ref={trigRef} type="button"
        className={`ob-dp-trigger${show ? ' ob-dp-trigger--open' : ''}${value ? ' ob-dp-trigger--set' : ''}`}
        onClick={show ? () => setShow(false) : open}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: value ? '#4f46e5' : '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        {value
          ? <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmtD(value)}</span>
          : <span style={{ flex: 1, fontSize: 13, color: '#94a3b8' }}>{placeholder}</span>}
        {value
          ? <span onClick={e => { e.stopPropagation(); onChange(''); }} style={{ cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 'auto', color: '#94a3b8', transform: show ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>}
      </button>
      {show && (
        <div ref={dpRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.12)', padding: 14, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr(y => y - 1); } else setCalMo(m => m - 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>‹</button>
            <button type="button" onClick={() => setShowYr(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{_OB_MONTHS[calMo]} {calYr}</button>
            <button type="button" onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr(y => y + 1); } else setCalMo(m => m + 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>›</button>
          </div>
          {showYr ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
              {Array.from({ length: 16 }, (_, i) => { const yr = new Date().getFullYear() - 4 + i; return (
                <div key={yr} onClick={() => { setCalYr(yr); setShowYr(false); }} style={{ textAlign: 'center', padding: '4px 0', borderRadius: 4, cursor: 'pointer', fontWeight: yr === calYr ? 700 : 400, background: yr === calYr ? '#4f46e5' : 'transparent', color: yr === calYr ? '#fff' : '#1e293b', fontSize: 12 }}>{yr}</div>
              ); })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {_OB_DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '2px 0' }}>{d}</div>)}
              {Array.from({ length: FD }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: DIM }).map((_, i) => {
                const dy = i + 1;
                const ds = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
                const isSel = ds === value, isToday = ds === tod;
                return (
                  <div key={ds} onClick={() => { onChange(ds); setShow(false); }}
                    style={{ textAlign: 'center', padding: '6px 0', cursor: 'pointer', borderRadius: 4, background: isSel ? '#4f46e5' : 'transparent', color: isSel ? '#fff' : isToday ? '#4f46e5' : '#1e293b', fontWeight: isSel ? 700 : isToday ? 700 : 400, fontSize: 12 }}>{dy}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};

const API_BASE_URL = process.env.REACT_APP_API_URL;
const fmtOBDate = d => { if (!d) return '-'; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`; };

function OrderBook() {
  const { user, pagePermissions, isAccountsExecutive } = useAuth();
  const obPerms   = pagePermissions?.ORDER_BOOK || [];
  const canDelete = obPerms.includes('DELETE') && !isAccountsExecutive;
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);

  // State
  const [orderBooks, setOrderBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Column order for drag-and-drop
  const [columnOrder, setColumnOrder] = useState([
    'sno','orderNo','customer','group','subGroup','orderTitle','orderDate',
    'expectedDelivery','poNumber','poDate','totalAmount','advanceAmount',
    'balanceAmount','status','createdBy','actions'
  ]);
  const dragCol = React.useRef(null);
  const dragOverCol = React.useRef(null);

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    sno: true,
    orderNo: true,
    customer: true,
    group: true,
    subGroup: false,
    orderTitle: true,
    orderDate: true,
    expectedDelivery: false,
    poNumber: true,
    poDate: false,
    totalAmount: true,
    advanceAmount: false,
    balanceAmount: false,
    status: true,
    createdBy: false,
    actions: true
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPOUploadModal, setShowPOUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedOrderBook, setSelectedOrderBook] = useState(null);

  // File Viewer Modal
  const [showFileViewerModal, setShowFileViewerModal] = useState(false);
  const [fileViewerUrl, setFileViewerUrl] = useState('');   // blob: URL created from fetch
  const [fileViewerName, setFileViewerName] = useState('');
  const [fileViewerType, setFileViewerType] = useState('');
  const [fileViewerLoading, setFileViewerLoading] = useState(false);
  const fileViewerBlobRef = React.useRef(null); // track blob URL for cleanup

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    proposalId: '',
    groupName: '',
    subGroupName: '',
    orderTitle: '',
    orderDescription: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    poNumber: '',
    poDate: '',
    advanceAmount: '',
    status: 'Draft',
    remarks: '',
    items: []
  });

  // Attachment file state for create/edit
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState(null); // {fileName, filePath}

  // PO Upload State
  const [poUploadData, setPoUploadData] = useState({
    file: null,
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    // When page/size/group changes, use the correct fetch based on active filters
    if (searchTerm || statusFilter !== 'All' || fromDate || toDate) {
      handleSearch();
    } else {
      fetchOrderBooks();
    }
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, rowsPerPage, groupName, subGroupName]);

  useEffect(() => {
    // When filters change, always reset to page 1
    if (searchTerm || statusFilter !== 'All' || fromDate || toDate) {
      setCurrentPage(1);
      const debounce = setTimeout(() => {
        handleSearch(1); // pass page=1 explicitly to avoid stale state
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setCurrentPage(1);
      fetchOrderBooks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, fromDate, toDate]);

  useEffect(() => {
    if (formData.groupName) {
      fetchSubGroupsForForm(formData.groupName);
      fetchCustomersByGroup(formData.groupName, formData.subGroupName);
    } else {
      setSubGroups([]);
      setCustomers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.groupName, formData.subGroupName]);

  const fetchOrderBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage - 1,
        size: rowsPerPage
      });

      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);

      const response = await fetch(`${API_BASE_URL}/order-book/getAll?${params}`, {
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch order books');

      const data = await response.json();
      if (data.success) {
        setOrderBooks(data.data || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      showError(err.message || 'Error fetching order books');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e) => {
    e.preventDefault();

    if (!excelFile) {
      showWarning('Please select an Excel file');
      return;
    }

    setLoading(true);
    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        showWarning('The Excel file is empty');
        setLoading(false);
        return;
      }

      const mappedItems = jsonData.map((row, index) => ({
        lineNo: index + 1,
        itemName: row['Item Name'] || row['itemName'] || '',
        specification: row['Specification'] || row['specification'] || '',
        description: row['Description'] || row['description'] || '',
        quantity: row['Quantity'] || row['quantity'] || '',
        unit: row['Unit'] || row['unit'] || 'Nos',
        unitPrice: row['Unit Price'] || row['unitPrice'] || '',
        taxPercent: row['Tax %'] || row['taxPercent'] || '',
        discountPercent: row['Discount %'] || row['discountPercent'] || '',
        itemRemarks: row['Remarks'] || row['itemRemarks'] || '',
        proposalItemId: null,
        isCustomUnit: false,
        customUnit: ''
      }));

      const validItems = mappedItems.filter(item => item.itemName && item.itemName.trim() !== '');

      if (validItems.length === 0) {
        showWarning('No valid items found in the Excel file');
        setLoading(false);
        return;
      }

      setFormData(prev => ({ ...prev, items: validItems }));
      showSuccess(`Successfully imported ${validItems.length} items from Excel`);
      setShowExcelUploadModal(false);
      setExcelFile(null);

    } catch (error) {
      console.error('Error reading Excel file:', error);
      showError('Failed to read Excel file. Please ensure it follows the correct format.');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcelTemplate = () => {
    const headers = [
      'Line No', 'Item Name', 'Specification', 'Description',
      'Quantity', 'Unit', 'Unit Price', 'Tax %', 'Discount %', 'Item Remarks'
    ];
    const sampleRow = ['1', 'Sample Item', 'Spec details', 'Item description',
      '10', 'Nos', '1000', '18', '0', 'Optional remarks'];
    const csvContent = [headers, sampleRow]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `OrderBook_Template_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    showSuccess('Template downloaded successfully!');
  };

  // ── Export ALL filtered order books to Excel ────────────────────
  // Fetches every matching record (not just the current page) using the
  // same active filters: group, subGroup, status, date range, searchTerm.
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      showWarning('No order books to export');
      return;
    }

    setExporting(true);
    try {
      // ── Fetch ALL matching records in one request ────────────────
      // Use the same endpoint that is currently active (search vs getAll)
      const hasFilters = searchTerm || statusFilter !== 'All' || fromDate || toDate;

      let allRecords = [];

      if (hasFilters) {
        // Use search endpoint with size = totalItems to get everything
        const params = new URLSearchParams({
          page: 0,
          size: totalItems || 10000
        });
        if (searchTerm)            params.append('searchTerm', searchTerm);
        if (statusFilter !== 'All') params.append('status', statusFilter);
        if (groupName)             params.append('groupName', groupName);
        if (subGroupName)          params.append('subGroupName', subGroupName);
        if (fromDate)              params.append('fromDate', fromDate);
        if (toDate)                params.append('toDate', toDate);

        const res = await fetch(`${API_BASE_URL}/order-book/search?${params}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'User-Id': user.id, 'User-Role': user.role }
        });
        if (!res.ok) throw new Error('Failed to fetch data for export');
        const data = await res.json();
        allRecords = data.data || [];
      } else {
        // Use getAll endpoint with size = totalItems
        const params = new URLSearchParams({
          page: 0,
          size: totalItems || 10000
        });
        if (groupName)    params.append('groupName', groupName);
        if (subGroupName) params.append('subGroupName', subGroupName);

        const res = await fetch(`${API_BASE_URL}/order-book/getAll?${params}`, {
          credentials: 'include',
          headers: { 'User-Id': user.id, 'User-Role': user.role }
        });
        if (!res.ok) throw new Error('Failed to fetch data for export');
        const data = await res.json();
        allRecords = data.data || [];
      }

      if (allRecords.length === 0) {
        showWarning('No records found for the selected filters');
        return;
      }

      // ── Build Excel rows ─────────────────────────────────────────
      const exportData = allRecords.map((o, idx) => ({
        'S.No':             idx + 1,
        'Customer':         o.customerName || '',
        'Group':            o.groupName || '',
        'Sub Group':        o.subGroupName || '',
        'Order Title':      o.orderTitle || '',
        'Order Date':       o.orderDate ? fmtOBDate(o.orderDate) : '',
        'PO Number':        o.poNumber || '',
        'PO Date':          o.poDate ? fmtOBDate(o.poDate) : '',
        'Status':           o.status || '',
        'Subtotal (₹)':     o.subtotal    ? parseFloat(o.subtotal).toFixed(2)    : '0.00',
        'Tax Amount (₹)':   o.taxAmount   ? parseFloat(o.taxAmount).toFixed(2)   : '0.00',
        'Total Amount (₹)': o.totalAmount ? parseFloat(o.totalAmount).toFixed(2) : '0.00',
        'Created By':       o.createdByName || '',
        'Has Attachment':   o.hasPoFile ? 'Yes' : 'No',
      }));

      // ── Auto column widths ───────────────────────────────────────
      const worksheet  = XLSX.utils.json_to_sheet(exportData);
      const colWidths  = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, ...exportData.map(r => String(r[key] || '').length)) + 2
      }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Order Books');

      // ── Filename includes active filter labels ───────────────────
      const date = new Date().toISOString().split('T')[0];
      const filterLabel = [
        statusFilter !== 'All' ? statusFilter : '',
        groupName    || '',
        subGroupName || '',
        fromDate     ? `from_${fromDate}` : '',
        toDate       ? `to_${toDate}`     : '',
      ].filter(Boolean).join('_');

      XLSX.writeFile(
        workbook,
        `OrderBooks_${filterLabel ? filterLabel + '_' : ''}${date}.xlsx`
      );
      showSuccess(`Exported ${exportData.length} of ${totalItems} order books to Excel`);

    } catch (err) {
      showError(err.message || 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ── Open file in viewer modal ─────────────────────────────────────
  // Fetches the file via authenticated fetch() → creates a blob: URL.
  // This avoids the X-Frame-Options / cross-origin / cookie issues that
  // occur when setting an API URL directly as an iframe src.
  const handleViewFile = async (orderId, fileName) => {
    if (!orderId) return;

    // Revoke any previous blob URL to free memory
    if (fileViewerBlobRef.current) {
      URL.revokeObjectURL(fileViewerBlobRef.current);
      fileViewerBlobRef.current = null;
    }

    const ext = (fileName || '').split('.').pop().toLowerCase();
    setFileViewerName(fileName || 'Attached File');
    setFileViewerType(ext);
    setFileViewerUrl('');        // clear previous
    setFileViewerLoading(true);
    setShowFileViewerModal(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/order-book/${orderId}/download-po`,
        {
          credentials: 'include',
          headers: {
            'User-Id':   String(user.id),
            'User-Role': user.role,
          },
        }
      );

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const blob    = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      fileViewerBlobRef.current = blobUrl;
      setFileViewerUrl(blobUrl);
    } catch (err) {
      console.error('File viewer fetch error:', err);
      showError('Could not load the file. Please try downloading it instead.');
      setShowFileViewerModal(false);
    } finally {
      setFileViewerLoading(false);
    }
  };

  // Download: fetch blob and trigger <a> download (works with session cookies)
  const handleDownloadFile = async (orderId, fileName) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/order-book/${orderId}/download-po?forceDownload=true`,
        {
          credentials: 'include',
          headers: {
            'User-Id':   String(user.id),
            'User-Role': user.role,
          },
        }
      );
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = fileName || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showError('Download failed. Please try again.');
    }
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return <FaFileAlt />;
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <FaFilePdf style={{ color: '#e53e3e' }} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <FaFileImage style={{ color: '#38a169' }} />;
    return <FaFileAlt style={{ color: '#3182ce' }} />;
  };

  const isImageFile = (ext) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  const isPdfFile = (ext) => ext === 'pdf';

  // Page change handler — updates page then triggers correct fetch via Effect 1
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  // Smart refresh: respects active filters
  const refreshOrderBooks = () => {
    if (searchTerm || statusFilter !== 'All' || fromDate || toDate) {
      handleSearch(currentPage);
    } else {
      fetchOrderBooks();
    }
  };

  const handleSearch = async (pageOverride) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: (pageOverride !== undefined ? pageOverride : currentPage) - 1,
        size: rowsPerPage
      });

      if (searchTerm) params.append('searchTerm', searchTerm);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (groupName) params.append('groupName', groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      params.append('sortBy',  (fromDate || toDate) ? 'orderDate' : 'createdAt');
      params.append('sortDir', (fromDate || toDate) ? 'asc'       : 'desc');

      const response = await fetch(`${API_BASE_URL}/order-book/search?${params}`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'User-Id': user.id,
          'User-Role': user.role
        }
      });

      if (!response.ok) throw new Error('Failed to search order books');

      const data = await response.json();
      if (data.success) {
        setOrderBooks(data.data || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      showError(err.message || 'Error searching order books');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-groups`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      if (Array.isArray(data)) setGroups(data);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) { setSubGroups([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to fetch subgroups');
      const data = await response.json();
      if (Array.isArray(data)) setSubGroups(data);
    } catch (err) {
      console.error('Error fetching subgroups:', err);
      setSubGroups([]);
    }
  };

  const fetchCustomersByGroup = async (group, subGroup) => {
    if (!group) { setCustomers([]); return; }
    try {
      const params = new URLSearchParams();
      params.append('groupName', group);
      if (subGroup) params.append('subGroupName', subGroup);
      const response = await fetch(`${API_BASE_URL}/customers/by-group?${params}`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      if (data.success) {
        const customerList = Array.isArray(data.data) ? data.data : data.data.content || [];
        setCustomers(customerList);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomers([]);
    }
  };

  const fetchProposalsByCustomer = async (customerId) => {
    if (!customerId) { setProposals([]); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/by-customer/${customerId}`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to fetch proposals');
      const data = await response.json();
      if (data.success) {
        const proposalList = Array.isArray(data.data) ? data.data : [];
        setProposals(proposalList);
      }
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setProposals([]);
    }
  };

  const loadProposalItems = async (proposalId) => {
    if (!proposalId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/proposal-items/${proposalId}`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to load proposal items');
      const data = await response.json();
      if (data.success) {
        const items = (data.data || []).map((item, index) => ({
          lineNo: index + 1,
          itemName: item.itemName,
          specification: item.specification,
          description: item.description,
          proposalItemId: item.id,
          quantity: item.quantity || '',
          unit: item.unit || 'Nos',
          unitPrice: item.unitPrice || '',
          taxPercent: item.taxPercent || '',
          discountPercent: '',
          itemRemarks: '',
          isCustomUnit: false,
          customUnit: ''
        }));
        setFormData(prev => ({ ...prev, items }));
        showSuccess('Proposal items loaded successfully');
      }
    } catch (err) {
      showError(err.message || 'Error loading proposal items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleEdit = async (orderBook) => {
    setSelectedOrderBook(orderBook);
    setFormData(prev => ({
      ...prev,
      groupName: orderBook.groupName || '',
      subGroupName: orderBook.subGroupName || ''
    }));

    if (orderBook.groupName) {
      await fetchSubGroupsForForm(orderBook.groupName);
      await fetchCustomersByGroup(orderBook.groupName, orderBook.subGroupName);
    }
    if (orderBook.customerId) {
      await fetchProposalsByCustomer(orderBook.customerId);
    }

    // Restore existing attachment info (file lives in DB; no file path needed)
    if (orderBook.hasPoFile && orderBook.poFileName) {
      setExistingAttachment({ fileName: orderBook.poFileName, mimeType: orderBook.poFileMimeType });
    } else {
      setExistingAttachment(null);
    }
    setAttachmentFile(null);

    try {
      const response = await fetch(`${API_BASE_URL}/order-book/${orderBook.id}/items`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          setFormData({
            customerId: orderBook.customerId || '',
            proposalId: orderBook.proposalId || '',
            groupName: orderBook.groupName || '',
            subGroupName: orderBook.subGroupName || '',
            orderTitle: orderBook.orderTitle || '',
            orderDescription: orderBook.orderDescription || '',
            orderDate: orderBook.orderDate || '',
            expectedDeliveryDate: orderBook.expectedDeliveryDate || '',
            poNumber: orderBook.poNumber || '',
            poDate: orderBook.poDate || '',
            advanceAmount: orderBook.advanceAmount || '',
            status: orderBook.status || 'Draft',
            remarks: orderBook.remarks || '',
            items: (data.data || []).map(item => ({
              ...item,
              quantity: item.quantity || '',
              unitPrice: item.unitPrice || '',
              taxPercent: item.taxPercent || '',
              discountPercent: item.discountPercent || '',
              isCustomUnit: false,
              customUnit: ''
            }))
          });
        }, 300);
        setIsEditMode(true);
        setShowCreateModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error loading order book details');
    }
  };

  const handleView = async (orderBook) => {
    setSelectedOrderBook(orderBook);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/${orderBook.id}/items`, {
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();
      if (data.success) {
        setSelectedOrderBook({ ...orderBook, items: data.data || [] });
        setShowViewModal(true);
      }
    } catch (err) {
      showError(err.message || 'Error loading order book details');
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteOrderId(id);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteOrderId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/order-book/delete/${deleteOrderId}`, {
        method: 'DELETE',
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role }
      });
      if (!response.ok) throw new Error('Failed to delete order book');
      const data = await response.json();
      if (data.success) {
        showSuccess('Order book deleted successfully');
        setShowDeleteConfirm(false);
        setDeleteOrderId(null);
        refreshOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error deleting order book');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerId || !formData.orderTitle || formData.items.length === 0) {
      showWarning('Please fill in all required fields and add at least one item');
      return;
    }

    const preparedItems = formData.items.map(item => ({
      ...item,
      unit: item.isCustomUnit ? item.customUnit : item.unit,
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      taxPercent: item.taxPercent || 0,
      discountPercent: item.discountPercent || 0
    }));

    const submitData = {
      ...formData,
      advanceAmount: formData.advanceAmount || 0,
      items: preparedItems
    };

    setLoading(true);
    try {
      const url = isEditMode
        ? `${API_BASE_URL}/order-book/update/${selectedOrderBook.id}`
        : `${API_BASE_URL}/order-book/create`;
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save order book');
      }

      const data = await response.json();
      if (data.success) {
        const savedId = data.data?.id || (isEditMode ? selectedOrderBook.id : null);

        // If there's an attachment file, upload it now
        if (attachmentFile && savedId) {
          try {
            const poFormData = new FormData();
            poFormData.append('file', attachmentFile);
            poFormData.append('poNumber', formData.poNumber || data.data?.poNumber || '');
            if (formData.poDate) poFormData.append('poDate', formData.poDate);

            await fetch(`${API_BASE_URL}/order-book/${savedId}/upload-po`, {
              method: 'POST',
              credentials: "include",
              headers: { 'User-Id': user.id, 'User-Role': user.role },
              body: poFormData
            });
          } catch (uploadErr) {
            console.error('Attachment upload error:', uploadErr);
            showWarning('Order book saved but file attachment failed. Use Upload PO to retry.');
          }
        }

        showSuccess(isEditMode ? 'Order book updated successfully' : 'Order book created successfully');
        setShowCreateModal(false);
        resetForm();
        refreshOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error saving order book');
    } finally {
      setLoading(false);
    }
  };

  const handlePOUploadClick = (orderBook) => {
    setSelectedOrderBook(orderBook);
    setPoUploadData({
      file: null,
      poNumber: orderBook.poNumber || '',
      poDate: new Date().toISOString().split('T')[0]
    });
    setShowPOUploadModal(true);
  };

  const handlePOUpload = async (e) => {
    e.preventDefault();
    if (!poUploadData.file || !poUploadData.poNumber) {
      showWarning('Please select a file and enter PO number');
      return;
    }
    setLoading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', poUploadData.file);
      formDataUpload.append('poNumber', poUploadData.poNumber);
      if (poUploadData.poDate) formDataUpload.append('poDate', poUploadData.poDate);

      const response = await fetch(`${API_BASE_URL}/order-book/${selectedOrderBook.id}/upload-po`, {
        method: 'POST',
        credentials: "include",
        headers: { 'User-Id': user.id, 'User-Role': user.role },
        body: formDataUpload
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload PO');
      }

      const data = await response.json();
      if (data.success) {
        showSuccess('PO uploaded successfully');
        setShowPOUploadModal(false);
        setPoUploadData({ file: null, poNumber: '', poDate: new Date().toISOString().split('T')[0] });
        refreshOrderBooks();
      }
    } catch (err) {
      showError(err.message || 'Error uploading PO');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      proposalId: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      orderTitle: '',
      orderDescription: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      poNumber: '',
      poDate: '',
      advanceAmount: '',
      status: 'Draft',
      remarks: '',
      items: []
    });
    setIsEditMode(false);
    setSelectedOrderBook(null);
    setCustomers([]);
    setProposals([]);
    setSubGroups([]);
    setAttachmentFile(null);
    setExistingAttachment(null);
    // Load dropdown data for pre-seeded group/subgroup values
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    if (seedGroup) {
      fetchSubGroupsForForm(seedGroup);
      fetchCustomersByGroup(seedGroup, seedSubGroup || '');
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          lineNo: prev.items.length + 1,
          itemName: '',
          specification: '',
          description: '',
          proposalItemId: null,
          quantity: '',
          unit: 'Nos',
          unitPrice: '',
          taxPercent: '',
          discountPercent: '',
          itemRemarks: '',
          isCustomUnit: false,
          customUnit: ''
        }
      ]
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      if (field === 'unit') {
        if (value === 'Custom') {
          items[index].isCustomUnit = true;
          items[index].unit = 'Custom';
          items[index].customUnit = '';
        } else {
          items[index].isCustomUnit = false;
          items[index].unit = value;
          items[index].customUnit = '';
        }
      } else {
        items[index][field] = value;
      }
      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index).map((item, idx) => ({
        ...item,
        lineNo: idx + 1
      }))
    }));
  };

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const taxPercent = parseFloat(item.taxPercent) || 0;
    const subtotal = quantity * unitPrice;
    const discount = subtotal * (discountPercent / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (taxPercent / 100);
    // Round to 2 decimal places to avoid floating-point drift
    return Math.round((taxable + tax) * 100) / 100;
  };

  const calculateGrandTotal = () => {
    // Sum the already-rounded line totals so grand total always equals sum of displayed line totals
    const raw = formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    return Math.round(raw * 100) / 100;
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'Draft': 'status-draft',
      'Confirmed': 'status-confirmed',
      'In Production': 'status-production',
      'Ready for Dispatch': 'status-ready',
      'Dispatched': 'status-dispatched',
      'Completed': 'status-completed',
      'Cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-draft';
  };

  const closeModal = (modalSetter) => {
    modalSetter(false);
    if (modalSetter === setShowCreateModal) resetForm();
    if (modalSetter === setShowDeleteConfirm) setDeleteOrderId(null);
    if (modalSetter === setShowFileViewerModal) {
      // Revoke the blob URL to free browser memory
      if (fileViewerBlobRef.current) {
        URL.revokeObjectURL(fileViewerBlobRef.current);
        fileViewerBlobRef.current = null;
      }
      setFileViewerUrl('');
      setFileViewerName('');
      setFileViewerType('');
      setFileViewerLoading(false);
    }
  };

  const formatDisplayValue = (value) => {
    if (value === null || value === undefined || value === '' || value === 0) return '-';
    return value;
  };

  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const columnDefinitions = [
    { key: 'sno', label: 'S.No' },
    { key: 'orderNo', label: 'Order No' },
    { key: 'customer', label: 'Customer' },
    { key: 'group', label: 'Group' },
    { key: 'subGroup', label: 'Sub Group' },
    { key: 'orderTitle', label: 'Order Title' },
    { key: 'orderDate', label: 'Order Date' },
    { key: 'expectedDelivery', label: 'Expected Delivery' },
    { key: 'poNumber', label: 'PO Number' },
    { key: 'poDate', label: 'PO Date' },
    { key: 'totalAmount', label: 'Total Amount (₹)' },
    { key: 'advanceAmount', label: 'Advance Amount (₹)' },
    { key: 'balanceAmount', label: 'Balance Amount (₹)' },
    { key: 'status', label: 'Status' },
    { key: 'createdBy', label: 'Created By' },
    { key: 'actions', label: 'Actions' }
  ];

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedOrderBooks = [...orderBooks].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const getVal = (obj, key) => {
      const map = {
        orderNo:          obj.orderBookNo || '',
        customer:         obj.customerName || '',
        group:            obj.groupName || '',
        subGroup:         obj.subGroupName || '',
        orderTitle:       obj.orderTitle || '',
        orderDate:        obj.orderDate || '',
        expectedDelivery: obj.expectedDeliveryDate || '',
        poNumber:         obj.poNumber || '',
        poDate:           obj.poDate || '',
        totalAmount:      parseFloat(obj.totalAmount) || 0,
        advanceAmount:    parseFloat(obj.advanceAmount) || 0,
        balanceAmount:    parseFloat(obj.balanceAmount) || 0,
        status:           obj.status || '',
        createdBy:        obj.createdByName || '',
      };
      return map[key] ?? '';
    };
    const aVal = getVal(a, sortConfig.key);
    const bVal = getVal(b, sortConfig.key);
    if (typeof aVal === 'number') return (aVal - bVal) * dir;
    if (sortConfig.key.toLowerCase().includes('date')) return aVal.localeCompare(bVal) * dir;
    return String(aVal).localeCompare(String(bVal)) * dir;
  });

  const handleDragStart = (key) => { dragCol.current = key; };
  const handleDragEnter = (key) => { dragOverCol.current = key; };
  const handleDragEnd   = () => {
    const from = dragCol.current;
    const to   = dragOverCol.current;
    if (!from || !to || from === to) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(to);
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragCol.current     = null;
    dragOverCol.current = null;
  };

  const columnMeta = {
    sno: {
      label: 'S.No', sortKey: null,
      render: (o, idx) => <td key="sno" style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 13 }}>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
    },
    orderNo:          {
      label: 'Order No', sortKey: 'orderNo',
      render: (o) => <td key="orderNo" className="orderbook-id">{o.orderBookNo}</td>
    },
    customer:         {
      label: 'Customer', sortKey: 'customer',
      render: (o) => (
        <td key="customer">
          <div className="orderbook-customer-info">
            <strong>{o.customerName}</strong>
            <span className="orderbook-customer-code">{o.customerCode}</span>
          </div>
        </td>
      )
    },
    group:            { label: 'Group',     sortKey: 'group',     render: (o) => <td key="group">{o.groupName || '-'}</td> },
    subGroup:         { label: 'Sub Group', sortKey: 'subGroup',  render: (o) => <td key="subGroup">{o.subGroupName || '-'}</td> },
    orderTitle:       { label: 'Order Title', sortKey: 'orderTitle', render: (o) => <td key="orderTitle">{o.orderTitle}</td> },
    orderDate:        { label: 'Order Date', sortKey: 'orderDate', render: (o) => <td key="orderDate">{fmtOBDate(o.orderDate)}</td> },
    expectedDelivery: { label: 'Expected Delivery', sortKey: 'expectedDelivery', render: (o) => <td key="expectedDelivery">{fmtOBDate(o.expectedDeliveryDate)}</td> },
    poNumber:         { label: 'PO Number', sortKey: 'poNumber', render: (o) => <td key="poNumber">{o.poNumber || '-'}</td> },
    poDate:           { label: 'PO Date',   sortKey: 'poDate',   render: (o) => <td key="poDate">{fmtOBDate(o.poDate)}</td> },
    totalAmount:      { label: 'Total Amount (₹)', sortKey: 'totalAmount', render: (o) => <td key="totalAmount" className="orderbook-amount">₹{o.totalAmount ? parseFloat(o.totalAmount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '0.00'}</td> },
    advanceAmount:    { label: 'Advance Amount (₹)', sortKey: 'advanceAmount', render: (o) => <td key="advanceAmount" className="orderbook-amount">₹{o.advanceAmount ? parseFloat(o.advanceAmount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '0.00'}</td> },
    balanceAmount:    { label: 'Balance Amount (₹)', sortKey: 'balanceAmount', render: (o) => <td key="balanceAmount" className="orderbook-amount orderbook-balance">₹{o.balanceAmount ? parseFloat(o.balanceAmount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '0.00'}</td> },
    status:           {
      label: 'Status', sortKey: 'status',
      render: (o) => (
        <td key="status">
          <span className={`orderbook-status ${getStatusClass(o.status)}`}>{o.status}</span>
        </td>
      )
    },
    createdBy:        { label: 'Created By', sortKey: 'createdBy', render: (o) => <td key="createdBy">{o.createdByName || '-'}</td> },
    actions:          {
      label: 'Actions', sortKey: null,
      render: (o) => (
        <td key="actions">
          <div className="orderbook-actions-inline" onClick={e => e.stopPropagation()}>
            <button className="orderbook-icon-btn ob-view"   onClick={() => handleView(o)}          title="View"><Eye size={14} /></button>
            <button className="orderbook-icon-btn ob-edit"   onClick={() => handleEdit(o)}          title="Edit"><Edit2 size={14} /></button>
            <button className="orderbook-icon-btn ob-upload" onClick={() => handlePOUploadClick(o)} title="Upload PO"><FaCloudUploadAlt /></button>
            {canDelete && <button className="orderbook-icon-btn ob-delete" onClick={() => handleDeleteClick(o.id)} title="Delete"><Trash2 size={14} /></button>}
          </div>
        </td>
      )
    },
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <span className="ob-sort-icon ob-sort-none">⇅</span>;
    return sortConfig.direction === 'asc'
      ? <span className="ob-sort-icon ob-sort-active">↑</span>
      : <span className="ob-sort-icon ob-sort-active">↓</span>;
  };

  return (
    <div className="orderbook-page">
      {loading && <CrmPreloader text="Loading..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Breadcrumb */}
      <div className="orderbook-breadcrumb">
        <span>Dashboard</span>
        <span className="orderbook-breadcrumb-separator">&gt;</span>
        <span className="orderbook-breadcrumb-active">Order Book</span>
      </div>

      {/* Header */}
      <div className="orderbook-header page-header-with-filter">
        <h1>Order Book</h1>
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      {/* Action Bar */}
      <div className="orderbook-action-bar" style={{ alignItems: 'center' }}>
        <div className="orderbook-search-filters" style={{ alignItems: 'center' }}>
          <input
            type="text"
            className="orderbook-search"
            placeholder="Search by Order No, Title, PO Number, Customer Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="ob-filter-select-wrap">
            <FilterSelect
              value={statusFilter === 'All' ? '' : statusFilter}
              options={[
                { value: 'Draft',             label: 'Draft'             },
                { value: 'Confirmed',          label: 'Confirmed'         },
                { value: 'In Production',      label: 'In Production'     },
                { value: 'Ready for Dispatch', label: 'Ready for Dispatch'},
                { value: 'Dispatched',         label: 'Dispatched'        },
                { value: 'Completed',          label: 'Completed'         },
                { value: 'Cancelled',          label: 'Cancelled'         },
              ]}
              placeholder="All Status"
              onChange={(v) => setStatusFilter(v || 'All')}
            />
          </div>

          <OBDateRangePicker
            appliedFrom={fromDate}
            appliedTo={toDate}
            onApply={(f, t) => { setFromDate(f); setToDate(t); setSortConfig({ key: 'orderDate', direction: 'asc' }); }}
            onClear={() => { setFromDate(''); setToDate(''); setSortConfig({ key: null, direction: 'asc' }); }}
          />
        </div>

        <div className="orderbook-action-buttons">
          {/* Export Excel Button - exports ALL filtered records, not just current page */}
          <button
            className="orderbook-btn orderbook-btn-export orderbook-btn-icon"
            onClick={handleExportExcel}
            title={totalItems > 0 ? `Export all ${totalItems} matching order book(s) to Excel` : 'No records to export'}
            disabled={totalItems === 0 || exporting}
          >
            {exporting ? (
              <><span className="ob-export-spinner" /> Exporting…</>
            ) : (
              <>
                <FaFileExcel /> Export Excel
                {totalItems > 0 && (
                  <span className="ob-export-count">{totalItems}</span>
                )}
              </>
            )}
          </button>

          <div className="orderbook-column-picker-container">
            <button
              className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              title="Manage Columns"
            >
              <FaColumns /> Columns
            </button>

            {showColumnPicker && (
              <div className="orderbook-column-picker-dropdown">
                <div className="orderbook-column-picker-header">
                  <span>Show/Hide Columns</span>
                  <button
                    className="orderbook-column-picker-close"
                    onClick={() => setShowColumnPicker(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="orderbook-column-picker-list">
                  {columnDefinitions.map(col => (
                    <label key={col.key} className="orderbook-column-picker-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={() => toggleColumnVisibility(col.key)}
                        disabled={col.key === 'actions'}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="orderbook-btn orderbook-btn-primary" onClick={handleCreateNew}>
            + Create Order Book
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="orderbook-table-card">
        <div className="orderbook-table-wrapper">
          <table className="orderbook-table">
            <thead>
              <tr>
                {columnOrder
                  .filter(key => visibleColumns[key])
                  .map(key => {
                    const col = columnMeta[key];
                    const isActive = sortConfig.key === col.sortKey;
                    return (
                      <th
                        key={key}
                        draggable
                        onDragStart={() => handleDragStart(key)}
                        onDragEnter={() => handleDragEnter(key)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className={`ob-draggable-th ${col.sortKey ? 'ob-sortable' : ''} ${isActive ? 'ob-th-sorted' : ''}`}
                        onClick={() => col.sortKey && handleSort(col.sortKey)}
                        title={col.sortKey ? 'Drag to reorder · Click to sort' : 'Drag to reorder'}
                      >
                        <span className="ob-th-grip">⠿</span>
                        {col.label}
                        {col.sortKey && <SortIcon colKey={col.sortKey} />}
                      </th>
                    );
                  })}
              </tr>
            </thead>
            <tbody>
              {orderBooks.length === 0 ? (
                <tr>
                  <td colSpan={columnOrder.filter(k => visibleColumns[k]).length} className="orderbook-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No order books found</p>
                  </td>
                </tr>
              ) : (
                sortedOrderBooks.map((order, idx) => (
                  <tr key={order.id} onClick={() => handleView(order)} style={{ cursor: 'pointer' }}>
                    {columnOrder
                      .filter(key => visibleColumns[key])
                      .map(key => columnMeta[key].render(order, idx))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="orderbook-pagination">
          <div className="orderbook-pagination-info">
            {totalItems > 0
              ? `Showing ${((currentPage - 1) * rowsPerPage) + 1}–${Math.min(currentPage * rowsPerPage, totalItems)} of ${totalItems} entries`
              : 'No entries to display'}
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="orderbook-rows-select"
            >
              <option value={10}>10 Rows</option>
              <option value={20}>20 Rows</option>
              <option value={50}>50 Rows</option>
              <option value={100}>100 Rows</option>
            </select>
          </div>
          <div className="orderbook-pagination-controls">
            <div className="orderbook-pagination-buttons">
              {/* First */}
              <button className="orderbook-pagination-btn" onClick={() => handlePageChange(1)} disabled={currentPage === 1} title="First page">«</button>
              {/* Previous */}
              <button className="orderbook-pagination-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
              {/* Ellipsis left */}
              {currentPage > 3 && totalPages > 5 && <span className="orderbook-pagination-ellipsis">…</span>}
              {/* Page number pills */}
              {(() => {
                const delta = 2;
                const left  = Math.max(1, currentPage - delta);
                const right = Math.min(totalPages, currentPage + delta);
                const pages = [];
                for (let i = left; i <= right; i++) pages.push(i);
                return pages.map(p => (
                  <button
                    key={p}
                    className={`orderbook-pagination-btn${p === currentPage ? ' orderbook-pagination-btn-active' : ''}`}
                    onClick={() => handlePageChange(p)}
                  >{p}</button>
                ));
              })()}
              {/* Ellipsis right */}
              {currentPage < totalPages - 2 && totalPages > 5 && <span className="orderbook-pagination-ellipsis">…</span>}
              {/* Next */}
              <button className="orderbook-pagination-btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}>Next</button>
              {/* Last */}
              <button className="orderbook-pagination-btn" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0} title="Last page">»</button>
            </div>
            <span className="orderbook-pagination-current">Page {currentPage} of {totalPages || 1}</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-delete-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Delete Order Book</h3>
            <p>Are you sure you want to delete this order book?</p>
            <p className="orderbook-delete-warning">This action cannot be undone.</p>
            <div className="orderbook-delete-actions">
              <button className="orderbook-btn orderbook-btn-secondary" onClick={() => closeModal(setShowDeleteConfirm)}>Cancel</button>
              <button className="orderbook-btn orderbook-btn-danger" onClick={handleDeleteConfirm} disabled={loading}>
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ───────────────────────────────────────────────── */}
      {showViewModal && selectedOrderBook && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal orderbook-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Order Book Details</h2>
              <button className="orderbook-modal-close" onClick={() => closeModal(setShowViewModal)}>×</button>
            </div>

            <div className="orderbook-modal-content">
              {/* Order Info */}
              <div className="orderbook-card">
                <div className="orderbook-card-header">
                  <div>
                    <h3>{selectedOrderBook.orderTitle}</h3>
                    <p className="orderbook-id">{selectedOrderBook.orderBookNo}</p>
                  </div>
                  <span className={`orderbook-status ${getStatusClass(selectedOrderBook.status)}`}>
                    {selectedOrderBook.status}
                  </span>
                </div>
                <div className="orderbook-info-grid">
                  <div><strong>Customer:</strong> {selectedOrderBook.customerName} ({selectedOrderBook.customerCode})</div>
                  <div><strong>Group:</strong> {selectedOrderBook.groupName || '-'}</div>
                  <div><strong>Sub Group:</strong> {selectedOrderBook.subGroupName || '-'}</div>
                  <div><strong>Order Date:</strong> {fmtOBDate(selectedOrderBook.orderDate)}</div>
                  <div><strong>Expected Delivery:</strong> {fmtOBDate(selectedOrderBook.expectedDeliveryDate)}</div>
                  <div><strong>PO Number:</strong> {selectedOrderBook.poNumber || '-'}</div>
                  <div><strong>PO Date:</strong> {fmtOBDate(selectedOrderBook.poDate)}</div>
                  <div><strong>Created By:</strong> {selectedOrderBook.createdByName || '-'}</div>
                </div>

                {selectedOrderBook.orderDescription && (
                  <div className="orderbook-description">
                    <strong>Description:</strong>
                    <p>{selectedOrderBook.orderDescription}</p>
                  </div>
                )}

                {/* Attachment section in View Modal */}
                {selectedOrderBook.hasPoFile && (
                  <div className="ob-attachment-section">
                    <strong className="ob-attachment-label">
                      <FaFileAlt style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Attached Document
                    </strong>
                    <div className="ob-attachment-card">
                      <div className="ob-attachment-info">
                        <span className="ob-attachment-icon">
                          {getFileIcon(selectedOrderBook.poFileName)}
                        </span>
                        <span className="ob-attachment-name">
                          {selectedOrderBook.poFileName || 'Attached File'}
                        </span>
                      </div>
                      <div className="ob-attachment-actions">
                        <button
                          className="ob-attachment-btn ob-attachment-btn-view"
                          onClick={() => handleViewFile(selectedOrderBook.id, selectedOrderBook.poFileName)}
                          title="Open file in viewer"
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          className="ob-attachment-btn ob-attachment-btn-download"
                          onClick={() => handleDownloadFile(selectedOrderBook.id, selectedOrderBook.poFileName)}
                          title="Download file"
                          type="button"
                        >
                          <FaDownload /> Download
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Items */}
              {selectedOrderBook.items && selectedOrderBook.items.length > 0 && (
                <div className="orderbook-card">
                  <h3>Order Items</h3>
                  <div className="orderbook-table-wrapper">
                    <table className="orderbook-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item Name</th>
                          <th>Specification</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Discount %</th>
                          <th>Tax %</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderBook.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.lineNo}</td>
                            <td>{item.itemName}</td>
                            <td>{item.specification || '-'}</td>
                            <td>{formatDisplayValue(item.quantity)}</td>
                            <td>{item.unit}</td>
                            <td>₹{item.unitPrice ? parseFloat(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                            <td>{formatDisplayValue(item.discountPercent)}%</td>
                            <td>{formatDisplayValue(item.taxPercent)}%</td>
                            <td>₹{item.lineTotal !== undefined && item.lineTotal !== null ? parseFloat(item.lineTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                          </tr>
                        ))}
                        <tr className="orderbook-total-row">
                          <td colSpan="8" style={{ textAlign: 'right' }}><strong>Total Amount:</strong></td>
                          <td><strong>₹{parseFloat(selectedOrderBook.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div className="orderbook-card">
                <h3>Financial Summary</h3>
                <div className="orderbook-financial-grid">
                  <div className="orderbook-financial-item">
                    <span>Subtotal:</span>
                    <strong>₹{parseFloat(selectedOrderBook.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Tax Amount:</span>
                    <strong>₹{parseFloat(selectedOrderBook.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Total Amount:</span>
                    <strong className="orderbook-total">₹{parseFloat(selectedOrderBook.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Advance Paid:</span>
                    <strong>₹{parseFloat(selectedOrderBook.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="orderbook-financial-item">
                    <span>Balance Due:</span>
                    <strong className="orderbook-balance">₹{parseFloat(selectedOrderBook.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {selectedOrderBook.remarks && (
                <div className="orderbook-card">
                  <h3>Remarks</h3>
                  <p>{selectedOrderBook.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ──────────────────────────────────────── */}
      {showCreateModal && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal orderbook-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>{isEditMode ? 'Edit Order Book' : 'Create Order Book'}</h2>
              <button className="orderbook-modal-close" onClick={() => closeModal(setShowCreateModal)}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="orderbook-modal-content">
              {/* Basic Info */}
              <div className="orderbook-card">
                <h3>Basic Information</h3>
                <div className="orderbook-form-grid">
                  <div className="orderbook-form-group">
                    <label>Group *</label>
                    <FilterSelect
                      value={formData.groupName}
                      options={groups.map(g => ({ value: g.value || g.label, label: g.label || g.value }))}
                      placeholder="Select Group"
                      onChange={(v) => {
                        setFormData({ ...formData, groupName: v || '', subGroupName: '', customerId: '', proposalId: '' });
                      }}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Sub Group</label>
                    <FilterSelect
                      value={formData.subGroupName}
                      options={subGroups.map(s => ({ value: s.value || s.label, label: s.label || s.value }))}
                      placeholder={!formData.groupName ? 'Select Group First' : 'Select Sub Group'}
                      disabled={!formData.groupName}
                      onChange={(v) => {
                        setFormData({ ...formData, subGroupName: v || '', customerId: '', proposalId: '' });
                      }}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Customer *</label>
                    <FilterSelect
                      value={formData.customerId ? String(formData.customerId) : ''}
                      options={customers.map(c => ({ value: String(c.id), label: `${c.name} - ${c.customerCode}` }))}
                      placeholder={!formData.groupName ? 'Select Group First' : 'Select Customer'}
                      disabled={!formData.groupName}
                      onChange={(v) => {
                        setFormData({ ...formData, customerId: v || '', proposalId: '' });
                        if (v) fetchProposalsByCustomer(v);
                      }}
                    />
                    {!formData.groupName && (
                      <small className="orderbook-help-text">Please select a group first</small>
                    )}
                  </div>

                  <div className="orderbook-form-group">
                    <label>Proposal (Optional)</label>
                    <FilterSelect
                      value={formData.proposalId ? String(formData.proposalId) : ''}
                      options={proposals.map(p => ({ value: String(p.id), label: `${p.proposalNo} - ${p.title}` }))}
                      placeholder={!formData.customerId ? 'Select Customer First' : 'Select Proposal'}
                      disabled={!formData.customerId}
                      onChange={(v) => {
                        setFormData({ ...formData, proposalId: v || '' });
                        if (v) loadProposalItems(v);
                      }}
                    />
                    {formData.proposalId && (
                      <small className="orderbook-help-text">Items will be loaded automatically from proposal</small>
                    )}
                  </div>

                  <div className="orderbook-form-group">
                    <label>Order Title *</label>
                    <input
                      type="text"
                      value={formData.orderTitle}
                      onChange={(e) => setFormData({ ...formData, orderTitle: e.target.value })}
                      placeholder="Enter order title"
                      required
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Order Date *</label>
                    <OBDatePicker
                      value={formData.orderDate}
                      onChange={v => setFormData({ ...formData, orderDate: v })}
                      placeholder="Select order date"
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Expected Delivery Date</label>
                    <OBDatePicker
                      value={formData.expectedDeliveryDate}
                      onChange={v => setFormData({ ...formData, expectedDeliveryDate: v })}
                      placeholder="Select delivery date"
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Status</label>
                    <FilterSelect
                      value={formData.status}
                      options={[
                        { value: 'Draft',             label: 'Draft'             },
                        { value: 'Confirmed',          label: 'Confirmed'         },
                        { value: 'In Production',      label: 'In Production'     },
                        { value: 'Ready for Dispatch', label: 'Ready for Dispatch'},
                        { value: 'Dispatched',         label: 'Dispatched'        },
                        { value: 'Completed',          label: 'Completed'         },
                        { value: 'Cancelled',          label: 'Cancelled'         },
                      ]}
                      placeholder="Select Status"
                      onChange={(v) => setFormData({ ...formData, status: v || 'Draft' })}
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>PO Number</label>
                    <input
                      type="text"
                      value={formData.poNumber}
                      onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                      placeholder="Enter PO number"
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>PO Date</label>
                    <OBDatePicker
                      value={formData.poDate}
                      onChange={v => setFormData({ ...formData, poDate: v })}
                      placeholder="Select PO date"
                    />
                  </div>

                  <div className="orderbook-form-group">
                    <label>Advance Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.advanceAmount}
                      onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  {/* ── Attachment field ── */}
                  <div className="orderbook-form-group orderbook-form-full">
                    <label>
                      <FaFileAlt style={{ marginRight: 6, verticalAlign: 'middle', color: '#7c3aed' }} />
                      Attach Document (PO / Reference File)
                    </label>

                    {/* Show existing attachment if in edit mode */}
                    {existingAttachment && existingAttachment.fileName && !attachmentFile && (
                      <div className="ob-existing-attachment">
                        <div className="ob-attachment-card" style={{ marginBottom: 10 }}>
                          <div className="ob-attachment-info">
                            <span className="ob-attachment-icon">{getFileIcon(existingAttachment.fileName)}</span>
                            <span className="ob-attachment-name">{existingAttachment.fileName}</span>
                            <span className="ob-attachment-badge">Current</span>
                          </div>
                          <div className="ob-attachment-actions">
                            <button
                              type="button"
                              className="ob-attachment-btn ob-attachment-btn-view"
                              onClick={() => handleViewFile(selectedOrderBook?.id, existingAttachment.fileName)}
                            >
                              <Eye size={14} /> View
                            </button>
                          </div>
                        </div>
                        <small className="orderbook-help-text">Upload a new file below to replace the current attachment</small>
                      </div>
                    )}

                    <div className="ob-file-upload-zone">
                      <input
                        type="file"
                        id="ob-attachment-input"
                        className="ob-file-input-hidden"
                        onChange={(e) => setAttachmentFile(e.target.files[0] || null)}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      />
                      <label htmlFor="ob-attachment-input" className="ob-file-upload-label">
                        <FaCloudUploadAlt className="ob-file-upload-icon" />
                        <span>
                          {attachmentFile
                            ? attachmentFile.name
                            : 'Click to browse or drag & drop'}
                        </span>
                        <small>PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</small>
                      </label>
                      {attachmentFile && (
                        <button
                          type="button"
                          className="ob-file-clear-btn"
                          onClick={() => setAttachmentFile(null)}
                          title="Remove selected file"
                        >
                          <FaTimes />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="orderbook-form-group orderbook-form-full">
                    <label>Description</label>
                    <textarea
                      value={formData.orderDescription}
                      onChange={(e) => setFormData({ ...formData, orderDescription: e.target.value })}
                      placeholder="Enter order description"
                      rows={3}
                    />
                  </div>

                  <div className="orderbook-form-group orderbook-form-full">
                    <label>Remarks</label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Enter any remarks"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="orderbook-card">
                <div className="orderbook-items-header">
                  <h3>Order Items</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon" onClick={downloadExcelTemplate} title="Download Excel Template">
                      <FaFileDownload /> Download Template
                    </button>
                    <button type="button" className="orderbook-btn orderbook-btn-secondary orderbook-btn-icon" onClick={() => setShowExcelUploadModal(true)} title="Import from Excel">
                      <Upload size={14} /> Import Excel
                    </button>
                    <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={addItem}>
                      + Add Item
                    </button>
                  </div>
                </div>

                {formData.items.length === 0 ? (
                  <div className="orderbook-empty-items">
                    <p>No items added. Click "Add Item" to start or import from Excel.</p>
                  </div>
                ) : (
                  <>
                    <div className="orderbook-table-wrapper">
                      <table className="orderbook-table orderbook-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ width: '200px' }}>Item Name *</th>
                            <th style={{ width: '150px' }}>Specification</th>
                            <th style={{ width: '100px' }}>Quantity *</th>
                            <th style={{ width: '120px' }}>Unit *</th>
                            <th style={{ width: '120px' }}>Unit Price (₹)</th>
                            <th style={{ width: '100px' }}>Discount %</th>
                            <th style={{ width: '80px' }}>Tax %</th>
                            <th style={{ width: '120px' }}>Line Total</th>
                            <th style={{ width: '60px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, index) => (
                            <tr key={index}>
                              <td className="orderbook-table-cell-centered">{item.lineNo}</td>
                              <td>
                                <ItemNameAutocomplete
                                  value={item.itemName}
                                  onChange={(val) => updateItem(index, 'itemName', val)}
                                  onSelect={(catalogueItem) => {
                                    setFormData(prev => {
                                      const items = [...prev.items];
                                      items[index] = {
                                        ...items[index],
                                        itemName:        catalogueItem.itemName,
                                        specification:   catalogueItem.specification   || items[index].specification,
                                        description:     catalogueItem.description     || items[index].description,
                                        unit:            catalogueItem.unit            || items[index].unit,
                                        unitPrice:       catalogueItem.unitPrice       != null ? catalogueItem.unitPrice       : items[index].unitPrice,
                                        taxPercent:      catalogueItem.taxPercent      != null ? catalogueItem.taxPercent      : items[index].taxPercent,
                                        discountPercent: catalogueItem.discountPercent != null ? catalogueItem.discountPercent : items[index].discountPercent,
                                        isCustomUnit: false,
                                        customUnit: '',
                                      };
                                      return { ...prev, items };
                                    });
                                  }}
                                  user={user}
                                  placeholder="Item name"
                                  required
                                />
                              </td>
                              <td>
                                <input type="text" className="orderbook-table-input" value={item.specification} onChange={(e) => updateItem(index, 'specification', e.target.value)} placeholder="Specification" />
                              </td>
                              <td>
                                <input type="number" step="0.0001" className="orderbook-table-input orderbook-table-input-number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} placeholder="0" required />
                              </td>
                              <td>
                                {item.isCustomUnit ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input
                                      type="text"
                                      className="orderbook-table-input"
                                      value={item.customUnit}
                                      onChange={(e) => updateItem(index, 'customUnit', e.target.value)}
                                      placeholder="e.g. MWp, kWh"
                                      autoFocus
                                      required
                                      style={{ flex: 1, minWidth: 0 }}
                                    />
                                    <button
                                      type="button"
                                      title="Back to dropdown"
                                      onClick={() => updateItem(index, 'unit', 'Nos')}
                                      style={{
                                        flexShrink: 0, background: 'none', border: '1px solid #d1d5db',
                                        borderRadius: 4, cursor: 'pointer', padding: '2px 5px',
                                        fontSize: 13, color: '#6b7280', lineHeight: 1
                                      }}
                                    >\u2715</button>
                                  </div>
                                ) : (
                                  <UnitTypeDropdown value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="orderbook-table-input" placeholder="Select Unit" />
                                )}
                              </td>
                              <td>
                                <input type="number" step="0.01" className="orderbook-table-input orderbook-table-input-number" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} placeholder="0.00" />
                              </td>
                              <td>
                                <input type="number" step="0.01" className="orderbook-table-input orderbook-table-input-number" value={item.discountPercent} onChange={(e) => updateItem(index, 'discountPercent', e.target.value)} placeholder="0" />
                              </td>
                              <td>
                                <input type="number" step="0.01" className="orderbook-table-input orderbook-table-input-number" value={item.taxPercent} onChange={(e) => updateItem(index, 'taxPercent', e.target.value)} placeholder="0" />
                              </td>
                              <td className="orderbook-table-cell-total">₹{calculateItemTotal(item).toFixed(2)}</td>
                              <td className="orderbook-table-cell-centered">
                                <button type="button" className="orderbook-table-delete-btn" onClick={() => removeItem(index)} title="Remove item">
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="orderbook-grand-total">
                      <span>Grand Total:</span>
                      <strong>₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="orderbook-modal-actions">
                <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={() => closeModal(setShowCreateModal)}>Cancel</button>
                <button type="submit" className="orderbook-btn orderbook-btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : (isEditMode ? 'Update Order Book' : 'Create Order Book')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Upload Modal */}
      {showPOUploadModal && selectedOrderBook && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Upload PO for {selectedOrderBook.orderBookNo}</h2>
              <button className="orderbook-modal-close" onClick={() => closeModal(setShowPOUploadModal)}>×</button>
            </div>

            <form onSubmit={handlePOUpload} className="orderbook-modal-content">
              <div className="orderbook-form-group">
                <label>PO Number *</label>
                <input
                  type="text"
                  value={poUploadData.poNumber}
                  onChange={(e) => setPoUploadData({ ...poUploadData, poNumber: e.target.value })}
                  placeholder="Enter PO number"
                  required
                />
              </div>

              <div className="orderbook-form-group">
                <label>PO Date</label>
                <OBDatePicker
                  value={poUploadData.poDate}
                  onChange={v => setPoUploadData({ ...poUploadData, poDate: v })}
                  placeholder="Select PO date"
                />
              </div>

              <div className="orderbook-form-group">
                <label>PO File *</label>
                <div className="ob-file-upload-zone">
                  <input
                    type="file"
                    id="ob-po-file-input"
                    className="ob-file-input-hidden"
                    onChange={(e) => setPoUploadData({ ...poUploadData, file: e.target.files[0] })}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    required
                  />
                  <label htmlFor="ob-po-file-input" className="ob-file-upload-label">
                    <FaCloudUploadAlt className="ob-file-upload-icon" />
                    <span>{poUploadData.file ? poUploadData.file.name : 'Click to select file'}</span>
                    <small>PDF, DOC, DOCX, JPG, PNG</small>
                  </label>
                  {poUploadData.file && (
                    <button type="button" className="ob-file-clear-btn" onClick={() => setPoUploadData({ ...poUploadData, file: null })} title="Remove file">
                      <FaTimes />
                    </button>
                  )}
                </div>
              </div>

              <div className="orderbook-modal-actions">
                <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={() => closeModal(setShowPOUploadModal)}>Cancel</button>
                <button type="submit" className="orderbook-btn orderbook-btn-primary" disabled={loading}>
                  {loading ? 'Uploading...' : 'Upload PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelUploadModal && (
        <div className="orderbook-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="orderbook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header">
              <h2>Import Items from Excel</h2>
              <button className="orderbook-modal-close" onClick={() => { setShowExcelUploadModal(false); setExcelFile(null); }}>×</button>
            </div>

            <form onSubmit={handleExcelUpload} className="orderbook-modal-content">
              <div className="orderbook-info-box" style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #90caf9' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>📋 Excel Format Instructions:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#555' }}>
                  <li>Use the downloaded template for correct format</li>
                  <li>Required columns: Item Name, Quantity, Unit</li>
                  <li>Optional columns: Specification, Description, Unit Price, Discount %, Tax %, Remarks</li>
                  <li>First row must contain column headers</li>
                  <li>Data should start from row 2</li>
                </ul>
              </div>

              <div className="orderbook-form-group">
                <label>
                  Excel File *
                  <button type="button" onClick={downloadExcelTemplate} style={{ marginLeft: '10px', padding: '4px 12px', fontSize: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    <FaFileDownload /> Download Template
                  </button>
                </label>
                <input type="file" onChange={(e) => setExcelFile(e.target.files[0])} accept=".xlsx,.xls" required />
                <small className="orderbook-help-text">Accepted formats: .xlsx, .xls</small>
                {excelFile && (
                  <small style={{ display: 'block', marginTop: '8px', color: '#4CAF50' }}>
                    ✓ Selected: {excelFile.name}
                  </small>
                )}
              </div>

              <div className="orderbook-modal-actions">
                <button type="button" className="orderbook-btn orderbook-btn-secondary" onClick={() => { setShowExcelUploadModal(false); setExcelFile(null); }}>Cancel</button>
                <button type="submit" className="orderbook-btn orderbook-btn-primary" disabled={loading || !excelFile}>
                  {loading ? 'Importing...' : 'Import Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── File Viewer Modal ─────────────────────────────────────── */}
      {showFileViewerModal && (
        <div className="orderbook-modal-overlay ob-file-viewer-overlay" onClick={() => closeModal(setShowFileViewerModal)}>
          <div className="orderbook-modal ob-file-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="orderbook-modal-header ob-file-viewer-header">
              <div className="ob-file-viewer-title">
                <span className="ob-file-viewer-icon">{getFileIcon(fileViewerName)}</span>
                <h2 title={fileViewerName}>{fileViewerName}</h2>
              </div>
              <div className="ob-file-viewer-controls">
                <button
                  type="button"
                  className="ob-attachment-btn ob-attachment-btn-download"
                  onClick={() => handleDownloadFile(
                    selectedOrderBook?.id,
                    fileViewerName
                  )}
                  title="Download"
                >
                  <FaDownload /> Download
                </button>
                <a
                  className="ob-attachment-btn ob-attachment-btn-view"
                  href={fileViewerUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  style={{ pointerEvents: fileViewerUrl ? 'auto' : 'none', opacity: fileViewerUrl ? 1 : 0.5 }}
                >
                  <Eye size={14} /> Open
                </a>
                <button className="orderbook-modal-close" onClick={() => closeModal(setShowFileViewerModal)}>×</button>
              </div>
            </div>

            <div className="ob-file-viewer-body">
              {fileViewerLoading && (
                <div className="ob-file-viewer-loading">
                  <div className="ob-file-viewer-spinner" />
                  <p>Loading file…</p>
                </div>
              )}
              {!fileViewerLoading && isPdfFile(fileViewerType) && (
                <iframe
                  src={fileViewerUrl}
                  title={fileViewerName}
                  className="ob-file-viewer-iframe"
                />
              )}
              {!fileViewerLoading && isImageFile(fileViewerType) && (
                <div className="ob-file-viewer-image-wrapper">
                  <img src={fileViewerUrl} alt={fileViewerName} className="ob-file-viewer-image" />
                </div>
              )}
              {!fileViewerLoading && !isPdfFile(fileViewerType) && !isImageFile(fileViewerType) && fileViewerUrl && (
                <div className="ob-file-viewer-unsupported">
                  <div className="ob-file-viewer-unsupported-icon">{getFileIcon(fileViewerName)}</div>
                  <p>This file type cannot be previewed in the browser.</p>
                  <button
                    type="button"
                    className="orderbook-btn orderbook-btn-primary"
                    onClick={() => handleDownloadFile(
                      selectedOrderBook?.id,
                      fileViewerName
                    )}
                  >
                    <FaDownload /> Download to View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderBook;