import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, Filter, Download, Plus, X, Edit2, Eye, ExternalLink, Star, TrendingUp,
  DollarSign, IndianRupee, Package, Calendar, Phone, Mail, MapPin,
  ShoppingCart, FileText, CheckCircle, Clock, Building2, User, Tag,
  Briefcase, Truck, ChevronUp, ChevronDown, ChevronsUpDown, Columns,
  GripVertical, Check, Trash2, Shield, Upload, AlertCircle, BadgeCheck
} from 'lucide-react';
import '../pages-css/Procurement-Vendor-Management.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import FilterSelect from "./../components/Dropdowns/FilterSelect.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import ConfirmationModal from '../components/ConfirmationModal.js';
import vendorApi from '../services/vendorApi';
import filterApi from '../services/filterApi';

/* ── Inline-style theme mappers (added for dark mode) ── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#f8fafb':'#0f1420','#fcfcfd':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f1f1':'#232b3b','#f0f0f0':'#232b3b','#e9eef5':'#2b3445','#eef2f7':'#18202e',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#f0f9ff':'#15243d','#f0f4ff':'#1a2440','#eef2ff':'#1e1f45','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a','#bae6fd':'#16344d','#e0f2fe':'#16344d','#e0e7ff':'#1e2547','#93c5fd':'#2f5d92',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40','#bbf7d0':'#2a5a40','#86efac':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#fecdd3':'#3a1f26','#fff5f5':'#2b1d20','#fff1f2':'#2b1d20','#fff7ed':'#2c2113','#fffbeb':'#2a2710','#fffdf0':'#2a2710','#fef9c3':'#3a3016','#fef3c7':'#3a3016','#fde68a':'#5a4714','#fef08a':'#5a4714',
  '#f5f3ff':'#241b3d','#faf5ff':'#241b3d','#ede9fe':'#2a2147','#ddd6fe':'#2e2147','#e9d5ff':'#2e2147','#ecfeff':'#103038','#fce7f3':'#3a1f30',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a','#c4b5fd':'#3a3d6a','#fcd34d':'#5a4714',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6','#0b1220':'#e7ecf3',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8','#718096':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e','#10b981':'#34d39e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258','#f59e0b':'#f5b945',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0891b2':'#22d3ee','#1e3a8a':'#7fb0f0','#0369a1':'#38bdf8',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3',
};
const __sbg = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __SM[k]) ? __SM[k] : v; };
const __stc = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __TM[k]) ? __TM[k] : v; };
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};


// ─── KYC Document Definitions ──────────────────────────────────────────────
const KYC_DOCUMENTS = [
  { id: 'gst_certificate',          label: 'GST Certificate',             icon: '🏛️', group: 'main',       numberLabel: 'GSTIN Number',          numberPlaceholder: 'e.g. 22AAAAA0000A1Z5'       },
  { id: 'pan_card',                 label: 'PAN Card',                    icon: '💳', group: 'main',       numberLabel: 'PAN Number',             numberPlaceholder: 'e.g. ABCDE1234F'            },
  { id: 'incorporation_certificate',label: 'Certificate of Incorporation',icon: '📋', group: 'main',       numberLabel: 'CIN / Registration No.', numberPlaceholder: 'e.g. U12345MH2020PTC123456' },
  { id: 'cancelled_cheque',         label: 'Cancelled Cheque / Bank',     icon: '🏦', group: 'main',       numberLabel: 'Bank Account Number',    numberPlaceholder: 'Enter account number'        },
  { id: 'msme_certificate',         label: 'MSME / Udyam Registration',   icon: '🏭', group: 'additional', numberLabel: 'Udyam / MSME Number',    numberPlaceholder: 'e.g. UDYAM-XX-00-0000000'   },
  { id: 'trade_licence',            label: 'Trade Licence',               icon: '📜', group: 'additional', numberLabel: 'Licence Number',          numberPlaceholder: 'Enter licence number'        },
  { id: 'iso_certificate',          label: 'ISO / Quality Certificate',   icon: '🏅', group: 'additional', numberLabel: 'Certificate Number',      numberPlaceholder: 'e.g. ISO9001-XXXXX'         },
];
const MAIN_DOCS       = KYC_DOCUMENTS.filter(d => d.group === 'main');
const ADDITIONAL_DOCS = KYC_DOCUMENTS.filter(d => d.group === 'additional');
const REQUIRED_DOCS   = []; // kept for compat

const API_BASE_URL = process.env.REACT_APP_API_URL;

const VENDOR_CATEGORIES = ['Manufacturing', 'Supplier', 'Services', 'Electrical', 'Civil & Structural', 'Instrumentation', 'IoT Hardware', 'Logistics & Transport', 'Installation & Commissioning'];
const VENDOR_TYPES      = ['Manufacturer', 'Distributor', 'Service Provider', 'Contractor', 'System Integrator', 'Trader', 'Installation & Commissioning'];

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
  { id: 'sNo',               label: 'S.No',                 sortable: false, visible: true,  fixed: true  },
  { id: 'name',               label: 'Vendor Name',          sortable: true,  visible: true  },
  { id: 'contact',            label: 'Contact',              sortable: false, visible: true  },
  { id: 'category',           label: 'Category',             sortable: true,  visible: false },
  { id: 'rating',             label: 'Rating',               sortable: true,  visible: false },
  { id: 'totalOrders',        label: 'Total Orders',         sortable: true,  visible: true  },
  { id: 'totalPurchaseValue', label: 'Total Purchase Value', sortable: true,  visible: true  },
  { id: 'lastPurchaseDate',   label: 'Last Purchase',        sortable: true,  visible: false },
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
  useThemeVersion();
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
            onClick={() => !col.fixed && onToggle(col.id)}
            disabled={!!col.fixed}
            title={col.fixed ? `${col.label} column is always visible` : ''}
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
const COL_WIDTHS = {
  name:               { minWidth: 160 },
  contact:            { minWidth: 180 },
  category:           { minWidth: 120 },
  rating:             { minWidth: 100 },
  totalOrders:        { minWidth: 110 },
  totalPurchaseValue: { minWidth: 150 },
  lastPurchaseDate:   { minWidth: 130 },
  status:             { minWidth: 90  },
  group:              { minWidth: 120 },
  project:            { minWidth: 200 },
  actions:            { minWidth: 90  },
};

const DraggableTH = ({ col, index, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, sortConfig, onSort, children }) => {
  const isFixed = col.fixed || col.id === 'actions';
  return (
    <th
      draggable={!isFixed}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      style={COL_WIDTHS[col.id] ? { minWidth: COL_WIDTHS[col.id].minWidth } : undefined}
      className={`
        vendor-management-table__th
        ${isDragOver ? 'vendor-management-table__th--drag-over' : ''}
        ${col.sortable ? 'vendor-management-table__th--sortable' : ''}
      `}
      onClick={() => col.sortable && onSort(col.id)}
    >
      <span className="th-inner">
        {!isFixed && (
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


// ─── PO Status colours ────────────────────────────────────────────────────────
const PO_STATUS_COLORS = {
  Draft: '#94a3b8', Approved: '#3b82f6', Ordered: '#8b5cf6',
  'In-Transit': '#f59e0b', Delivered: '#22c55e', Cancelled: '#ef4444'
};
const PO_STATUS_STEPS = ['Draft', 'Approved', 'Ordered', 'In-Transit', 'Delivered'];

// ─── KYC Document Card ────────────────────────────────────────────────────────
// ─── KYC Document Row — table-row style like items table ─────────────────────
const KycDocCard = ({ doc, uploaded, onUpload, onMetaChange, onViewFile, onSave }) => {
  useThemeVersion();
  const fileRef      = React.useRef(null);
  const docNumber    = uploaded?.docNumber  || '';
  const isUploaded   = !!(uploaded?.fileName || uploaded?.fileUrl);
  const isUploading  = !!uploaded?.uploading;
  const isSaving     = !!uploaded?.saving;
  const isSaved      = !!uploaded?.savedToDb;   // true once backend confirmed
  const fileRequired = docNumber.trim().length > 0;
  const isComplete   = fileRequired && isUploaded;
  // Can save when: has a local file AND (has docNumber OR file already selected)
  const canSave      = isUploaded && !isSaved && !isSaving;

  const maxLen = {
    gst_certificate: 15, pan_card: 10, incorporation_certificate: 21,
    cancelled_cheque: 18, msme_certificate: 19, trade_licence: 20, iso_certificate: 25
  }[doc.id] || 30;

  const sanitize = (v) => {
    if (doc.id === 'gst_certificate') return v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, 15);
    if (doc.id === 'pan_card')        return v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, 10);
    if (doc.id === 'cancelled_cheque')return v.replace(/[^0-9]/g,'').slice(0, 18);
    return v;
  };

  return (
    <tr className={`kyc-row${isSaved ? ' kyc-row--done' : isComplete ? ' kyc-row--ready' : fileRequired && !isUploaded ? ' kyc-row--warn' : ''}`}>
      {/* Status */}
      <td className="kyc-row-status">
        {isSaved    ? <CheckCircle size={15} style={{ color: __stc('#16a34a') }} />
          : isComplete ? <CheckCircle size={15} style={{ color: __stc('#3b82f6') }} />
          : fileRequired ? <AlertCircle size={15} style={{ color: __stc('#f59e0b') }} />
          : <div className="kyc-row-dot" />}
      </td>

      {/* Doc name */}
      <td className="kyc-row-name">
        <span className="kyc-row-icon">{doc.icon}</span>
        <span className="kyc-row-label">{doc.label}</span>
      </td>

      {/* Number input — always visible */}
      <td className="kyc-row-num">
        <input
          className="kyc-row-input"
          type="text"
          placeholder={doc.numberPlaceholder || 'Enter number'}
          value={docNumber}
          maxLength={maxLen}
          onChange={e => onMetaChange(doc.id, 'docNumber', sanitize(e.target.value))}
        />
      </td>

      {/* File + Save cell */}
      <td className="kyc-row-file">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {isUploaded ? (
            <>
              <CheckCircle size={12} style={{ color: isSaved ? __stc('#16a34a') : __stc('#3b82f6'), flexShrink: 0 }} />
              <span className="kyc-row-filename">{uploaded.fileName || 'File selected'}</span>
              <button className="kyc-row-view-btn" onClick={() => onViewFile && onViewFile(doc, uploaded)} title="Preview">
                <Eye size={11} /> View
              </button>
              {uploaded.fileUrl && (
                <a href={uploaded.fileUrl} target="_blank" rel="noreferrer" className="kyc-row-view" title="Open in new tab">↗</a>
              )}
              <button className="kyc-row-replace" onClick={() => fileRef.current?.click()} disabled={isUploading || isSaving}>
                <Upload size={11} /> Replace
              </button>
            </>
          ) : (
            <button
              className={`kyc-row-upload-btn${fileRequired ? ' kyc-row-upload-btn--req' : ''}${isUploading ? ' kyc-row-upload-btn--loading' : ''}`}
              onClick={() => !isUploading && fileRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <><span className="vd-kyc-spin" /> Uploading…</>
                : fileRequired ? <><Upload size={12} /> Upload (Required)</>
                : <><Upload size={12} /> Upload</>}
            </button>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) { onUpload(doc.id, e.target.files[0]); e.target.value = ''; } }} />
        </div>
      </td>

      {/* Save button cell */}
      <td className="kyc-row-save">
        {isSaved ? (
          <span className="kyc-save-done"><CheckCircle size={13} /> Saved</span>
        ) : (
          <button
            className={`kyc-save-btn${canSave ? ' kyc-save-btn--active' : ''}`}
            onClick={() => canSave && onSave && onSave(doc.id)}
            disabled={!canSave || isSaving}
            title={!isUploaded ? 'Select a file first' : !canSave ? 'Already saved' : 'Save to database'}
          >
            {isSaving ? <><span className="vd-kyc-spin vd-kyc-spin--dark" /> Saving…</> : <><Check size={12} /> Save</>}
          </button>
        )}
      </td>
    </tr>
  );
};

// ─── KYC Additional Document Card (card style, 3-col grid) ──────────────────
const KycAddCard = ({ doc, uploaded, onUpload, onMetaChange, onViewFile, onSave }) => {
  useThemeVersion();
  const fileRef      = React.useRef(null);
  const docNumber    = uploaded?.docNumber  || '';
  const isUploaded   = !!(uploaded?.fileName || uploaded?.fileUrl);
  const isUploading  = !!uploaded?.uploading;
  const isSaving     = !!uploaded?.saving;
  const isSaved      = !!uploaded?.savedToDb;
  const fileRequired = docNumber.trim().length > 0;
  const isComplete   = isSaved && isUploaded;
  const canSave      = isUploaded && !isSaved && !isSaving;

  const borderColor = __sbg(isComplete ? '#86efac' : canSave ? '#93c5fd' : fileRequired && !isUploaded ? '#fcd34d' : '#e2e8f0');
  const bgColor     = __sbg(isComplete ? '#f0fdf4' : canSave ? '#eff6ff' : fileRequired && !isUploaded ? '#fffbeb' : '#fff');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: `1.5px solid ${borderColor}`, borderRadius: 10, background: bgColor, transition: 'border-color .18s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{doc.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: __stc('#1e293b'), flex: 1 }}>{doc.label}</span>
        {isComplete
          ? <CheckCircle size={14} style={{ color: __stc('#16a34a'), flexShrink: 0 }} />
          : fileRequired && !isUploaded
            ? <AlertCircle size={14} style={{ color: __stc('#f59e0b'), flexShrink: 0 }} />
            : null}
      </div>

      {/* Number input — always visible */}
      <input
        style={{ padding: '7px 10px', border: `1px solid ${isComplete ? __sbg('#bbf7d0') : __sbg('#e2e8f0')}`, borderRadius: 6, fontSize: 12.5, color: __stc('#1e293b'), background: isComplete ? __sbg('#f0fdf4') : __sbg('#fff'), width: '100%', boxSizing: 'border-box', outline: 'none' }}
        type="text"
        placeholder={doc.numberPlaceholder || 'Enter document number'}
        value={docNumber}
        maxLength={doc.id === 'msme_certificate' ? 19 : doc.id === 'trade_licence' ? 20 : doc.id === 'iso_certificate' ? 25 : 30}
        onChange={e => onMetaChange(doc.id, 'docNumber', e.target.value)}
        onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.1)'; }}
        onBlur={e => { e.target.style.borderColor = isComplete ? '#bbf7d0' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
      />

      {/* Drop zone / file status */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: `1.5px ${isUploaded ? 'solid' : 'dashed'} ${isUploaded ? __sbg('#86efac') : fileRequired ? __sbg('#f59e0b') : __sbg('#cbd5e1')}`, borderRadius: 7, background: isUploaded ? __sbg('#f0fdf4') : fileRequired ? __sbg('#fffbeb') : __sbg('transparent'), cursor: isUploading ? 'not-allowed' : 'pointer', minHeight: 38 }}
        onClick={() => !isUploading && fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onUpload(doc.id, f); }}
      >
        {isUploaded ? (
          <>
            <CheckCircle size={14} style={{ color: __stc('#16a34a'), flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: __stc('#15803d'), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {uploaded.fileName || 'File selected'}
            </span>
          </>
        ) : (
          <>
            <Upload size={14} style={{ color: fileRequired ? __stc('#f59e0b') : __stc('#94a3b8'), flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: fileRequired ? __stc('#b45309') : __stc('#64748b'), fontWeight: fileRequired ? 600 : 400 }}>
              {fileRequired ? 'Upload file (required)' : 'Click or drag to upload'}
            </span>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) { onUpload(doc.id, e.target.files[0]); e.target.value = ''; } }} />
      </div>

      {/* Actions row — View, Replace, Save */}
      {isUploaded && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => onViewFile && onViewFile(doc, uploaded)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 11, fontWeight: 600, color: __stc('#2563eb'), background: __sbg('#eff6ff'), border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: 5, cursor: 'pointer' }}>
            <Eye size={11} /> View
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={isUploading || isSaving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 9px', fontSize: 11, fontWeight: 500, color: __stc('#475569'), background: __sbg('#f1f5f9'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 5, cursor: 'pointer' }}>
            <Upload size={10} /> Replace
          </button>
          <div style={{ marginLeft: 'auto' }}>
            {isSaved ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: __stc('#16a34a') }}>
                <CheckCircle size={13} /> Saved
              </span>
            ) : (
              <button
                onClick={() => canSave && onSave && onSave(doc.id)}
                disabled={!canSave || isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? __sbg('#2563eb') : __sbg('#e2e8f0'), color: canSave ? __stc('#fff') : __stc('#94a3b8'), transition: 'all .15s' }}>
                {isSaving ? <><span className="vd-kyc-spin" style={{ borderTopColor: `${__sbg('#fff')}` }} /> Saving…</> : <><Check size={12} /> Save</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Vendor Detail Page ───────────────────────────────────────────────────────
const VendorDetailPage = ({ vendor, onBack, onEdit, onDelete, canEdit, canDelete, getAuthHeaders, showSuccess, showError }) => {
  useThemeVersion();
  const [activeTab, setActiveTab]           = useState(() => localStorage.getItem('vendor_detail_tab') || 'overview');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPOs, setLoadingPOs]         = useState(false);
  const [kycDocs, setKycDocs]               = useState({});
  const [kycLoading, setKycLoading]         = useState(false);
  // KYC file viewer modal state (same pattern as OrderBook)
  const [kycViewerOpen,    setKycViewerOpen]    = useState(false);
  const [kycViewerDoc,     setKycViewerDoc]     = useState(null);   // { doc, uploaded }
  const [kycViewerUrl,     setKycViewerUrl]     = useState('');
  const [kycViewerLoading, setKycViewerLoading] = useState(false);
  const kycBlobRef = React.useRef(null);

  // Verified = at least one doc entered AND every doc with a number also has a file
  const docsWithNumber = KYC_DOCUMENTS.filter(d => kycDocs[d.id]?.docNumber?.trim());
  const isVerified     = docsWithNumber.length > 0 && docsWithNumber.every(d => kycDocs[d.id]?.fileName || kycDocs[d.id]?.fileUrl);
  const uploadedCount  = KYC_DOCUMENTS.filter(d => kycDocs[d.id]?.fileName || kycDocs[d.id]?.fileUrl).length;
  const completeCount  = KYC_DOCUMENTS.filter(d => kycDocs[d.id]?.docNumber?.trim() && (kycDocs[d.id]?.fileName || kycDocs[d.id]?.fileUrl)).length;
  const pct            = Math.round((completeCount / KYC_DOCUMENTS.length) * 100);

  const fmtCur = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(n)) return '₹0';
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
    if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const renderStars = (rating) => {
    if (!rating) return <span style={{ color: __stc('#9ca3af'), fontSize: 12 }}>Not rated</span>;
    return <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(s => <Star key={s} size={13} fill={s <= rating ? '#f59e0b' : 'none'} stroke={s <= rating ? '#f59e0b' : '#d1d5db'} />)}</div>;
  };

  useEffect(() => {
    // Fetch POs
    setLoadingPOs(true);
    fetch(`${API_BASE_URL}/purchase-orders/vendor/${vendor.id}`, { credentials: 'include', headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPurchaseOrders(data))
      .catch(() => setPurchaseOrders([]))
      .finally(() => setLoadingPOs(false));
    // Fetch KYC docs from backend
    setKycLoading(true);
    fetch(`${API_BASE_URL}/vendors/${vendor.id}/kyc`, { credentials: 'include', headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : {})
      .then(raw => {
        const marked = {};
        Object.entries(raw || {}).forEach(([k, v]) => { marked[k] = { ...v, savedToDb: true }; });
        setKycDocs(marked);
      })
      .catch(() => setKycDocs({}))
      .finally(() => setKycLoading(false));
  }, [vendor.id]);

  // ── Step 1: user picks a file → store locally (for immediate preview) ──────
  const handleKycUpload = (docId, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showError('File too large. Max 10 MB.'); return; }
    setKycDocs(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],       // preserves docNumber and savedToDb flag
        fileName:   file.name,
        fileObject: file,     // raw File object for local preview before saving
        fileUrl:    null,     // set by backend after save
        uploadedAt: new Date().toISOString(),
        uploading:  false,
        savedToDb:  false,    // needs explicit Save to persist
      }
    }));
    showSuccess(`File selected. Click Save to store it in the database.`);
  };

  // ── Step 2: user clicks Save → POST multipart to backend ─────────────────
  const handleSaveKycDoc = async (docId) => {
    const docData = kycDocs[docId];
    if (!docData?.fileObject) { showError('No file selected to save.'); return; }

    const docLabel = KYC_DOCUMENTS.find(d => d.id === docId)?.label || docId;
    setKycDocs(prev => ({ ...prev, [docId]: { ...prev[docId], saving: true } }));

    try {
      const form = new FormData();
      form.append('file',      docData.fileObject);
      form.append('docType',   docId);
      if (docData.docNumber?.trim()) form.append('docNumber', docData.docNumber.trim());

      const res = await fetch(`${API_BASE_URL}/vendors/${vendor.id}/kyc/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
          // Note: do NOT set Content-Type — browser sets multipart boundary automatically
        },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setKycDocs(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          fileUrl:   data.fileUrl || null,
          saving:    false,
          savedToDb: true,
          fileObject: null,   // no longer needed — backend has it
        }
      }));
      showSuccess(`${docLabel} saved successfully.`);
    } catch (err) {
      showError(`Failed to save ${docLabel}: ${err.message}`);
      setKycDocs(prev => ({ ...prev, [docId]: { ...prev[docId], saving: false } }));
    }
  };

  const handleMetaChange = (docId, field, value) => {
    setKycDocs(prev => ({ ...prev, [docId]: { ...prev[docId], [field]: value } }));
  };

  // ── KYC file viewer — uses local File object or fetches from backend ──────────
  const handleViewKycFile = async (doc, uploaded) => {
    if (!uploaded?.fileName && !uploaded?.fileObject && !uploaded?.fileUrl) return;
    // Revoke previous blob URL
    if (kycBlobRef.current) { URL.revokeObjectURL(kycBlobRef.current); kycBlobRef.current = null; }
    setKycViewerDoc({ doc, uploaded });
    setKycViewerUrl('');
    setKycViewerLoading(true);
    setKycViewerOpen(true);
    try {
      let blobUrl;
      if (uploaded.fileObject instanceof File) {
        // Backend not connected yet — use the raw File object directly (no fetch needed)
        blobUrl = URL.createObjectURL(uploaded.fileObject);
      } else if (uploaded.fileUrl) {
        // Backend connected — fetch via authenticated request
        const url = uploaded.fileUrl.startsWith('http')
          ? uploaded.fileUrl
          : `${API_BASE_URL}${uploaded.fileUrl}`;
        const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
      } else {
        throw new Error('No file available to preview');
      }
      kycBlobRef.current = blobUrl;
      setKycViewerUrl(blobUrl);
    } catch (err) {
      showError('Could not load the file preview.');
      setKycViewerOpen(false);
    } finally {
      setKycViewerLoading(false);
    }
  };

  const handleDownloadKycFile = async (doc, uploaded) => {
    if (!uploaded?.fileObject && !uploaded?.fileUrl) return;
    try {
      let blobUrl;
      if (uploaded.fileObject instanceof File) {
        // Local file — create blob URL directly from File object
        blobUrl = URL.createObjectURL(uploaded.fileObject);
      } else {
        const url = uploaded.fileUrl.startsWith('http') ? uploaded.fileUrl : `${API_BASE_URL}${uploaded.fileUrl}`;
        const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Download failed');
        blobUrl = URL.createObjectURL(await res.blob());
      }
      const a    = document.createElement('a');
      a.href     = blobUrl;
      a.download = uploaded.fileName || 'document';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch { showError('Download failed. Please try again.'); }
  };

  const changeTab = (t) => { setActiveTab(t); localStorage.setItem('vendor_detail_tab', t); };
  const statusColor = vendor.status === 'Active' ? '#16a34a' : '#dc2626';
  const statusBg    = vendor.status === 'Active' ? '#dcfce7' : '#fee2e2';

  return (
    <div className="vd-page">
      {/* Top Bar */}
      <div className="vd-topbar">
        <button className="vd-back-btn" onClick={onBack}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Vendors
        </button>
        <div className="vd-breadcrumb">
          <span style={{ cursor: 'pointer', color: __stc('#6b7280') }} onClick={onBack}>Vendors</span>
          <span style={{ margin: '0 6px', color: __stc('#d1d5db') }}>/</span>
          <span style={{ color: __stc('#111827'), fontWeight: 500 }}>{vendor.vendorCode || vendor.name}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && <button className="vd-btn vd-btn--primary" onClick={() => onEdit(vendor)}><Edit2 size={14} /> Edit Vendor</button>}
          {canDelete && vendor.status === 'Active' && <button className="vd-btn vd-btn--danger" onClick={() => onDelete(vendor.id, vendor.name)}><Trash2 size={14} /> Delete</button>}
        </div>
      </div>

      {/* Hero */}
      <div className="vd-hero">
        <div className="vd-hero-left">
          <div className="vd-avatar">{vendor.name?.[0]?.toUpperCase() || 'V'}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="vd-hero-name">{vendor.name}</h2>
              {isVerified && <span className="vd-verified-badge"><BadgeCheck size={14} /> KYC Verified</span>}
            </div>
            <div className="vd-hero-code">{vendor.vendorCode}</div>
          </div>
        </div>
        <div className="vd-hero-chips">
          <span className="vd-chip" style={{ color: statusColor, background: statusBg, border: `1px solid ${statusColor}40` }}>{vendor.status}</span>
          {vendor.category  && <span className="vd-chip" style={{ color: __stc('#7c3aed'), background: __sbg('#ede9fe'), border: `1px solid ${__sbg('#ddd6fe')}` }}>{vendor.category}</span>}
          {vendor.vendorType && <span className="vd-chip" style={{ color: __stc('#0369a1'), background: __sbg('#e0f2fe'), border: `1px solid ${__sbg('#bae6fd')}` }}>{vendor.vendorType}</span>}
          {renderStars(vendor.rating)}
        </div>
        <div className="vd-hero-actions">
          <button className="vd-btn vd-btn--secondary" onClick={() => changeTab('kyc')}>
            <Shield size={14} /> KYC
            {isVerified ? <CheckCircle size={13} style={{ color: __stc('#16a34a') }} /> : <AlertCircle size={13} style={{ color: __stc('#f59e0b') }} />}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="vd-kpi-strip">
        {[
          { Icon: ShoppingCart, label: 'Total Orders',   value: vendor.totalOrders || 0 },
          { Icon: IndianRupee,  label: 'Purchase Value', value: fmtCur(vendor.totalPurchaseValue) },
          { Icon: Calendar,     label: 'Last Purchase',  value: fmtDate(vendor.lastPurchaseDate) },
          { Icon: IndianRupee,  label: 'Last Amount',    value: fmtCur(vendor.lastPurchaseAmount) },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="vd-kpi-item">
            <Icon size={18} className="vd-kpi-icon" />
            <div><div className="vd-kpi-value">{value}</div><div className="vd-kpi-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="vd-tabs">
        {[
          { k: 'overview', l: 'Overview' },
          { k: 'orders',   l: `Purchase Orders${purchaseOrders.length ? ` (${purchaseOrders.length})` : ''}` },
          { k: 'kyc',      l: 'KYC Documents' },
        ].map(t => (
          <button key={t.k} className={`vd-tab${activeTab === t.k ? ' active' : ''}`} onClick={() => changeTab(t.k)}>
            {t.l}
            {t.k === 'kyc' && (isVerified
              ? <CheckCircle size={12} style={{ color: __stc('#16a34a'), marginLeft: 4 }} />
              : <AlertCircle  size={12} style={{ color: __stc('#f59e0b'), marginLeft: 4 }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="vd-tab-body">
          <div className="vd-info-grid">
            <div className="vd-info-card">
              <h4 className="vd-card-title">Contact Information</h4>
              <div className="vd-field-list">
                {[
                  [Mail,      'Email',          vendor.email],
                  [Phone,     'Phone',          vendor.phone],
                  [User,      'Contact Person', vendor.contactPerson],
                  [Building2, 'Website',        vendor.website],
                  [FileText,  'GST Number',     vendor.gstNumber],
                ].map(([Icon, label, val]) => (
                  <div className="vd-field-row" key={label}>
                    <div className="vd-field-left"><Icon size={13} style={{ color: __stc('#6b7280'), flexShrink: 0 }} /><span className="vd-field-label">{label}</span></div>
                    <span className="vd-field-val">{val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="vd-info-card">
              <h4 className="vd-card-title">Business Details</h4>
              <div className="vd-field-list">
                {[
                  [Building2, 'Vendor Code',  vendor.vendorCode],
                  [Tag,       'Category',     vendor.category],
                  [Briefcase, 'Vendor Type',  vendor.vendorType],
                  [CheckCircle, 'Status',     vendor.status],
                  [Star,      'Rating',       renderStars(vendor.rating)],
                ].map(([Icon, label, val]) => (
                  <div className="vd-field-row" key={label}>
                    <div className="vd-field-left"><Icon size={13} style={{ color: __stc('#6b7280'), flexShrink: 0 }} /><span className="vd-field-label">{label}</span></div>
                    <span className="vd-field-val">{val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
            {(vendor.address || vendor.city || vendor.state) && (
              <div className="vd-info-card">
                <h4 className="vd-card-title">Address</h4>
                <div className="vd-field-list">
                  {[
                    [MapPin, 'Address', vendor.address],
                    [MapPin, 'City',    vendor.city],
                    [MapPin, 'State',   vendor.state],
                    [MapPin, 'Pincode', vendor.pincode],
                  ].filter(([,,v]) => v).map(([Icon, label, val]) => (
                    <div className="vd-field-row" key={label}>
                      <div className="vd-field-left"><Icon size={13} style={{ color: __stc('#6b7280'), flexShrink: 0 }} /><span className="vd-field-label">{label}</span></div>
                      <span className="vd-field-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(vendor.groupName || vendor.projectName) && (
              <div className="vd-info-card">
                <h4 className="vd-card-title">Project Assignment</h4>
                <div className="vd-field-list">
                  {[
                    [Building2, 'Group',    vendor.groupName],
                    [Tag,       'Category', vendor.subGroupName],
                    [FileText,  'Project',  vendor.projectName || vendor.projectId],
                  ].filter(([,,v]) => v).map(([Icon, label, val]) => (
                    <div className="vd-field-row" key={label}>
                      <div className="vd-field-left"><Icon size={13} style={{ color: __stc('#6b7280'), flexShrink: 0 }} /><span className="vd-field-label">{label}</span></div>
                      <span className="vd-field-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {vendor.notes && (
              <div className="vd-info-card" style={{ gridColumn: '1 / -1' }}>
                <h4 className="vd-card-title">Notes</h4>
                <p style={{ fontSize: 13, color: __stc('#374151'), lineHeight: 1.6, margin: 0 }}>{vendor.notes}</p>
              </div>
            )}
            {/* KYC Numbers summary on Overview tab */}
            {KYC_DOCUMENTS.some(d => kycDocs[d.id]?.docNumber?.trim() || kycDocs[d.id]?.fileName) && (
              <div className="vd-info-card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Shield size={13} style={{ color: __stc('#2563eb') }} />
                  <h4 className="vd-card-title" style={{ margin: 0 }}>KYC Documents</h4>
                  {KYC_DOCUMENTS.filter(d => kycDocs[d.id]?.savedToDb || kycDocs[d.id]?.fileUrl).length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: __stc('#16a34a'), background: __sbg('#dcfce7'), border: `1px solid ${__sbg('#86efac')}`, borderRadius: 20, padding: '1px 8px' }}>
                      {KYC_DOCUMENTS.filter(d => kycDocs[d.id]?.savedToDb || kycDocs[d.id]?.fileUrl).length} / {KYC_DOCUMENTS.length} saved
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {KYC_DOCUMENTS.filter(d => kycDocs[d.id]?.docNumber?.trim() || kycDocs[d.id]?.fileName).map(doc => {
                    const d = kycDocs[doc.id] || {};
                    const hasFile = !!(d.fileName || d.fileUrl);
                    return (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: d.savedToDb ? __sbg('#f0fdf4') : hasFile ? __sbg('#eff6ff') : __sbg('#f8fafc'), borderRadius: 7, border: `1px solid ${d.savedToDb ? __sbg('#86efac') : hasFile ? __sbg('#bfdbfe') : __sbg('#e5e7eb')}` }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{doc.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: __stc('#374151') }}>{doc.label}</div>
                          {d.docNumber && (
                            <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: __stc('#1e293b'), letterSpacing: '.04em', marginTop: 1 }}>{d.docNumber}</div>
                          )}
                        </div>
                        {hasFile && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: __stc('#475569'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{d.fileName}</span>
                            <button onClick={() => handleViewKycFile(doc, d)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: __stc('#2563eb'), background: __sbg('#eff6ff'), border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: 5, cursor: 'pointer' }}>
                              <Eye size={11} /> View
                            </button>
                          </div>
                        )}
                        {d.savedToDb
                          ? <CheckCircle size={14} style={{ color: __stc('#16a34a'), flexShrink: 0 }} title="Saved to database" />
                          : hasFile
                            ? <span style={{ fontSize: 10, fontWeight: 600, color: __stc('#2563eb'), background: __sbg('#dbeafe'), borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>Unsaved</span>
                            : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Purchase Orders ── */}
      {activeTab === 'orders' && (
        <div className="vd-tab-body">
          {loadingPOs ? (
            <div className="vd-empty">Loading orders…</div>
          ) : purchaseOrders.length === 0 ? (
            <div className="vd-empty">
              <ShoppingCart size={36} style={{ color: __stc('#d1d5db'), marginBottom: 8 }} />
              <p>No purchase orders found for this vendor.</p>
            </div>
          ) : (
            <div className="vd-po-list">
              {purchaseOrders.map(po => {
                const cur = PO_STATUS_STEPS.indexOf(po.status);
                return (
                  <div key={po.id} className="vd-po-card">
                    <div className="vd-po-head">
                      <div>
                        <span className="vd-po-no">{po.poNo}</span>
                        <span className="vd-po-badge" style={{ color: PO_STATUS_COLORS[po.status] || __stc('#64748b'), background: (PO_STATUS_COLORS[po.status] || __sbg('#64748b')) + '18', border: `1px solid ${(PO_STATUS_COLORS[po.status] || __sbg('#64748b'))}40` }}>{po.status}</span>
                      </div>
                      <span className="vd-po-value">{fmtCur(po.totalValue)}</span>
                    </div>
                    {/* Mini timeline */}
                    <div className="vd-po-timeline">
                      {PO_STATUS_STEPS.map((step, i) => (
                        <div key={step} className={`vd-tl-step${i <= cur ? ' done' : ''}`}>
                          <div className="vd-tl-dot" style={{ background: i <= cur ? PO_STATUS_COLORS[step] : __sbg('#e2e8f0') }} />
                          <span className="vd-tl-label">{step}</span>
                          {i < PO_STATUS_STEPS.length - 1 && <div className="vd-tl-line" style={{ background: i < cur ? PO_STATUS_COLORS[step] : __sbg('#e2e8f0') }} />}
                        </div>
                      ))}
                    </div>
                    <div className="vd-po-meta">
                      <span><Calendar size={13} /> {fmtDate(po.orderDate)}</span>
                      <span><Truck size={13} /> Expected: {fmtDate(po.expectedDelivery)}</span>
                      <span><Package size={13} /> {po.totalItemsOrdered} items · {po.totalItemsDelivered} delivered</span>
                    </div>
                    {po.notes && <div className="vd-po-notes"><FileText size={13} />{po.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── KYC Documents ── */}
      {activeTab === 'kyc' && (
        <div className="vd-tab-body">
          {/* Status Banner */}
          <div className={`vd-kyc-banner${isVerified ? ' vd-kyc-banner--ok' : docsWithNumber.length > 0 ? ' vd-kyc-banner--pending' : ' vd-kyc-banner--empty'}`}>
            <div className="vd-kyc-banner-icon">
              {isVerified ? <BadgeCheck size={26} /> : docsWithNumber.length > 0 ? <AlertCircle size={26} /> : <Shield size={26} />}
            </div>
            <div className="vd-kyc-banner-body">
              <div className="vd-kyc-banner-title">
                {isVerified ? 'KYC Verified' : docsWithNumber.length > 0 ? 'Documents Incomplete' : 'No KYC Documents Added'}
              </div>
              <div className="vd-kyc-banner-sub">
                {isVerified
                  ? 'All entered document numbers have supporting files.'
                  : docsWithNumber.length > 0
                    ? `${docsWithNumber.filter(d => !kycDocs[d.id]?.fileName && !kycDocs[d.id]?.fileUrl).length} document(s) need a file upload.`
                    : 'Enter a document number in any card below to begin KYC verification.'}
              </div>
            </div>
            <div className="vd-kyc-banner-pill">{completeCount} / {KYC_DOCUMENTS.length} complete</div>
          </div>

          {/* Progress bar */}
          {completeCount > 0 && (
            <div className="vd-kyc-progress-wrap">
              <div className="vd-kyc-progress-bar" style={{ width: `${pct}%` }} />
            </div>
          )}

          {/* ── Main KYC documents — table rows ── */}
          <div className="kyc-section-hd">
            <Shield size={13} />
            <span>KYC Documents</span>
            <span className="kyc-section-count">
              {MAIN_DOCS.filter(d => kycDocs[d.id]?.docNumber?.trim() && (kycDocs[d.id]?.fileName || kycDocs[d.id]?.fileUrl)).length} / {MAIN_DOCS.length} complete
            </span>
          </div>
          {kycLoading ? <div className="vd-empty">Loading…</div> : (
            <div className="kyc-table-wrap">
              <table className="kyc-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Document</th>
                    <th style={{ minWidth: 190 }}>Document Number</th>
                    <th style={{ minWidth: 210 }}>File</th>
                    <th style={{ width: 90 }}>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {MAIN_DOCS.map(doc => (
                    <KycDocCard key={doc.id} doc={doc} uploaded={kycDocs[doc.id]} onUpload={handleKycUpload} onMetaChange={handleMetaChange} onViewFile={handleViewKycFile} onSave={handleSaveKycDoc} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Additional documents — styled cards ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 8 }}>
            <FileText size={13} style={{ color: __stc('#475569') }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: __stc('#475569') }}>Additional Documents</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: __stc('#6b7280') }}>
              {ADDITIONAL_DOCS.filter(d => kycDocs[d.id]?.docNumber?.trim() && (kycDocs[d.id]?.fileName || kycDocs[d.id]?.fileUrl)).length} / {ADDITIONAL_DOCS.length} complete
            </span>
          </div>
          <div className="kyc-add-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {ADDITIONAL_DOCS.map(doc => (
              <KycAddCard key={doc.id} doc={doc} uploaded={kycDocs[doc.id]} onUpload={handleKycUpload} onMetaChange={handleMetaChange} onViewFile={handleViewKycFile} onSave={handleSaveKycDoc} />
            ))}
          </div>
        </div>
      )}

      {/* ── KYC File Viewer Modal (blob fetch — same pattern as OrderBook) ── */}
      {kycViewerOpen && kycViewerDoc && (() => {
        const { doc, uploaded } = kycViewerDoc;
        const ext     = (uploaded.fileName || '').split('.').pop().toLowerCase();
        const isPdf   = ext === 'pdf';
        const isImage = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => { setKycViewerOpen(false); if (kycBlobRef.current) { URL.revokeObjectURL(kycBlobRef.current); kycBlobRef.current = null; } }}>
            <div style={{ background: __sbg('#fff'), borderRadius: 12, width: 'min(1000px, 94vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.45)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${__sbg('#e5e7eb')}`, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>{isPdf ? '📄' : isImage ? '🖼️' : '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: __stc('#1e293b'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {uploaded.fileName || doc.label}
                  </div>
                  <div style={{ fontSize: 11, color: __stc('#64748b'), marginTop: 2 }}>{doc.icon} {doc.label}{uploaded.docNumber ? ` · ${uploaded.docNumber}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => handleDownloadKycFile(doc, uploaded)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: __sbg('#f1f5f9'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 7, fontSize: 12, fontWeight: 600, color: __stc('#374151'), cursor: 'pointer' }}>
                    <Download size={13} /> Download
                  </button>
                  {kycViewerUrl && (
                    <a href={kycViewerUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: __sbg('#eff6ff'), border: `1px solid ${__sbg('#bfdbfe')}`, borderRadius: 7, fontSize: 12, fontWeight: 600, color: __stc('#2563eb'), textDecoration: 'none' }}>
                      <ExternalLink size={13} /> Open in Tab
                    </a>
                  )}
                  <button onClick={() => { setKycViewerOpen(false); if (kycBlobRef.current) { URL.revokeObjectURL(kycBlobRef.current); kycBlobRef.current = null; } }}
                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: __sbg('#f1f5f9'), border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18, color: __stc('#475569') }}>✕</button>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', background: __sbg('#1e1e2e'), borderRadius: '0 0 12px 12px' }}>
                {kycViewerLoading && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: __stc('#94a3b8') }}>
                    <div style={{ width: 40, height: 40, border: '3px solid rgba(124,58,237,.2)', borderTopColor: `${__sbg('#7c3aed')}`, borderRadius: '50%', animation: 'vd-spin .8s linear infinite' }} />
                    <p style={{ fontSize: 14 }}>Loading file…</p>
                  </div>
                )}
                {!kycViewerLoading && isPdf && kycViewerUrl && (
                  <iframe src={kycViewerUrl} title={uploaded.fileName} style={{ width: '100%', height: '75vh', border: 'none', borderRadius: '0 0 12px 12px' }} />
                )}
                {!kycViewerLoading && isImage && kycViewerUrl && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
                    <img src={kycViewerUrl} alt={uploaded.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }} />
                  </div>
                )}
                {!kycViewerLoading && !isPdf && !isImage && kycViewerUrl && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, color: __stc('#94a3b8') }}>
                    <span style={{ fontSize: 56, opacity: .5 }}>📎</span>
                    <p style={{ fontSize: 15 }}>This file type cannot be previewed in the browser.</p>
                    <button onClick={() => handleDownloadKycFile(doc, uploaded)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: __sbg('#2563eb'), color: __stc('#fff'), border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <Download size={14} /> Download to View
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Date Range Filter (mirrors PurchaseOrders page) ──────────────────────────
const _VM_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _VM_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const PODateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  useThemeVersion();
  const [show, setShow] = React.useState(false);
  const [from, setFrom] = React.useState(null);
  const [to,   setTo]   = React.useState(null);
  const [hover,setHover]= React.useState(null);
  const [calMo,setCalMo]= React.useState(new Date().getMonth());
  const [calYr,setCalYr]= React.useState(new Date().getFullYear());
  const [showYr,setShowYr]=React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);
  const DIM = new Date(calYr, calMo+1, 0).getDate();
  const FD  = new Date(calYr, calMo, 1).getDay();
  const tod = new Date().toISOString().slice(0,10);
  const inR = d => {
    const hi = to || (from && hover ? hover : null);
    if (!from || !hi) return false;
    const [a,b] = from<=hi ? [from,hi] : [hi,from];
    return d > a && d < b;
  };
  const clickDay = d => {
    if (!from || (from && to)) { setFrom(d); setTo(null); }
    else if (d < from) { setFrom(d); setTo(null); }
    else if (d === from) { setFrom(null); setTo(null); }
    else setTo(d);
  };
  const fmt = d => { if (!d) return ''; const [y,m,dy]=d.split('-'); return `${dy}-${m}-${y}`; };
  const handleApply = () => { if (!from) return; onApply(from, to || from); setShow(false); };
  const handleClear = () => { setFrom(null); setTo(null); setHover(null); onClear(); setShow(false); };
  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex' }}>
      <button type="button"
        className={`po-cal-trigger${show?' po-cal--open':''}${appliedFrom?' po-cal--applied':''}`}
        onClick={() => setShow(p => !p)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>{appliedFrom ? fmt(appliedFrom) : 'dd-mm-yyyy'}</span>
        <span className="po-cal-sep">—</span>
        <span className={appliedTo && appliedTo !== appliedFrom ? 'po-cal-val' : 'po-cal-ph'}>
          {appliedTo && appliedTo !== appliedFrom ? fmt(appliedTo) : 'dd-mm-yyyy'}
        </span>
        {appliedFrom && <span className="po-cal-x" onClick={e => { e.stopPropagation(); handleClear(); }}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
        </span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ marginLeft:'auto', color:__stc('#94a3b8'), flexShrink:0, transform:show?'rotate(180deg)':'none', transition:'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {show && (
        <div className="po-cal-dropdown" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, width:264 }}>
          <div className="po-cal-head">
            <button type="button" className="po-cal-nav" onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button type="button" className="po-cal-month-btn" onClick={() => setShowYr(p => !p)}>
              {_VM_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="po-cal-nav" onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          {showYr ? (
            <div className="po-yr-grid">
              {Array.from({length:16},(_,i) => { const yr=new Date().getFullYear()-4+i; return (
                <div key={yr} className={`po-yr-cell${yr===calYr?' po-yr-sel':''}`} onClick={() => { setCalYr(yr); setShowYr(false); }}>{yr}</div>
              );})}</div>
          ) : (
            <div className="po-cal-grid">
              {_VM_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy=i+1, ds=`${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`, dow=(FD+i)%7;
                let cls='po-cal-cell';
                if(ds===from) cls+=' po-cal-from'; else if(ds===to) cls+=' po-cal-to';
                else if(inR(ds)){ cls+=' po-cal-in-range'; if(dow===0) cls+=' po-cal-rr-s'; if(dow===6) cls+=' po-cal-rr-e'; }
                if(ds===tod && ds!==from && ds!==to) cls+=' po-cal-today';
                return <div key={ds} className={cls} onClick={() => clickDay(ds)} onMouseEnter={() => from && !to && setHover(ds)} onMouseLeave={() => setHover(null)}>{dy}</div>;
              })}
            </div>
          )}
          <div className="po-cal-footer">
            <div className="po-cal-chips">
              <span className={`po-cal-chip${from?' po-cal-chip--set':''}`}>{from ? fmt(from) : 'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/></svg>
              <span className={`po-cal-chip${to?' po-cal-chip--set':''}`}>{to ? fmt(to) : 'To —'}</span>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%' }}>
              {(from || appliedFrom) && <button type="button" className="po-cal-clear" onClick={handleClear}>Clear</button>}
              <button type="button" className="po-cal-clear" onClick={() => setShow(false)}>Cancel</button>
              <button type="button" className="po-cal-apply" onClick={handleApply} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VendorManagement = () => {
  useThemeVersion();
  const [vendors, setVendors] = useState([]);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user, pagePermissions } = useAuth();
  const vendorPerms    = pagePermissions?.VENDORS || [];
  // Pure DB-driven page permissions — no role overrides
  const canView        = vendorPerms.includes('VIEW');
  const canCreate      = vendorPerms.includes('CREATE');
  const canEdit        = vendorPerms.includes('EDIT');
  const canDelete      = vendorPerms.includes('DELETE');
  const isViewOnly     = canView && !canCreate && !canEdit && !canDelete;
  // Data scope — ACCOUNTS_*/ADMIN/SUPERADMIN see all vendors; others see only their own
  const isAccountsRole = !!(user?.role && user.role.toUpperCase().startsWith('ACCOUNTS_'));
  const isSuperAdmin   = user?.role === 'SUPERADMIN';
  const isAdmin        = user?.role === 'ADMIN';
  const isFullAccess   = isSuperAdmin || isAdmin || isAccountsRole;
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, vendorId: null, vendorName: '' });
  const [detailVendor, setDetailVendor] = useState(() => {
    try { const s = localStorage.getItem('vendor_detail_vendor'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

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

  // ── Created-At date range filter ──
  const [createdAtFrom, setCreatedAtFrom] = useState('');
  const [createdAtTo,   setCreatedAtTo]   = useState('');

  // ── Pincode auto-fill refs (shared between create & edit modals) ──
  const [pincodeError, setPincodeError]         = useState('');
  const pincodeDebounceRef                       = useRef(null);
  const pincodeAbortRef                          = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorPurchaseOrders, setVendorPurchaseOrders] = useState([]);
  const [drawerActiveTab, setDrawerActiveTab] = useState('details');
  const [kycDocs, setKycDocs] = useState({});
  const [kycLoading, setKycLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1 = Vendor Info, 2 = KYC
  const [createKycDocs, setCreateKycDocs] = useState({});
  const createViewerBlobRef = React.useRef(null); // for create modal KYC file preview

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
  // Clear stale data immediately when logged-in user changes
  useEffect(() => {
    setVendors([]);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // When date filter is active → force sort by createdAt ASC so results appear chronologically
        const isDateFiltered   = !!(createdAtFrom || createdAtTo);
        const activeSortBy     = isDateFiltered ? 'createdAt' : (sortKeyMap[sortConfig.key] || 'createdAt');
        const activeSortDir    = isDateFiltered ? 'ASC'       : sortConfig.direction.toUpperCase();

        // Resolve active group/project (same logic used in standalone fetchVendors/fetchStats)
        const activeGroup    = filters.groupName    || groupName    || null;
        const activeSubGroup = filters.subGroupName || subGroupName || null;
        const activeProject  = projectId || null;

        // Build vendor-list query params
        const vendorParams = new URLSearchParams({
          page: currentPage, size: pageSize,
          sortBy:        activeSortBy,
          sortDirection: activeSortDir
        });
        if (activeGroup)    vendorParams.append('groupName',    activeGroup);
        if (activeSubGroup) vendorParams.append('subGroupName', activeSubGroup);
        if (activeProject)  vendorParams.append('projectId',    activeProject);
        if (filters.status   !== 'all') vendorParams.append('status',      filters.status);
        if (filters.category !== 'all') vendorParams.append('category',    filters.category);
        if (filters.search)              vendorParams.append('searchTerm',  filters.search.trim());
        if (createdAtFrom)               vendorParams.append('createdAtFrom', createdAtFrom);
        if (createdAtTo)                 vendorParams.append('createdAtTo',   createdAtTo);

        // Build stats query params (same filters, no pagination/sort)
        const statsParams = new URLSearchParams();
        if (activeGroup)    statsParams.append('groupName',    activeGroup);
        if (activeSubGroup) statsParams.append('subGroupName', activeSubGroup);
        if (activeProject)  statsParams.append('projectId',    activeProject);
        if (filters.status   !== 'all') statsParams.append('status',      filters.status);
        if (filters.category !== 'all') statsParams.append('category',    filters.category);
        if (filters.search)              statsParams.append('searchTerm',  filters.search.trim());
        if (createdAtFrom)               statsParams.append('createdAtFrom', createdAtFrom);
        if (createdAtTo)                 statsParams.append('createdAtTo',   createdAtTo);

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
  }, [currentPage, pageSize, filters.search, filters.status, filters.category, filters.groupName, filters.subGroupName, sortConfig, groupName, subGroupName, projectId, createdAtFrom, createdAtTo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── API calls ────────────────────────────────────────────────────────────
  // For ACCOUNTS_*/ADMIN/SUPERADMIN: override User-Role header → SUPERADMIN
  // so /filters/leads-users returns ALL users (not team-scoped list).
  const fetchAvailableUsers = async () => {
    try {
      const overrideRole = isFullAccess ? 'SUPERADMIN' : (user?.role || '');
      const res = await fetch(`${API_BASE_URL}/filters/leads-users`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'User-Id':      String(user?.id || ''),
          'X-User-Id':    String(user?.id || ''),
          'User-Role':    overrideRole,
          'X-User-Role':  overrideRole,
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(Array.isArray(data) ? data : []);
      }
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
    // Pre-seed project assignment from the page-level header dropdowns
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    const seedProject  = projectId   || '';
    setEditFormData({
      name: '', contactPerson: '', email: '', phone: '', website: '', gstNumber: '',
      address: '', city: '', state: '', district: '', pincode: '', rating: 0, status: 'Active',
      groupName: seedGroup, subGroupName: seedSubGroup, projectId: seedProject,
      vendorType: '', category: '', notes: '', assignedTo: ''
    });
    setCustomCategory('');
    setCustomVendorType('');
    setPincodeError('');
    setModalGroupName(seedGroup);
    setModalSubGroupName(seedSubGroup);
    setModalProjectId(seedProject);
    setModalGroups([]); setModalSubGroups([]); setModalProjects([]);
    fetchModalGroups();
    if (seedGroup) {
      fetchModalSubGroups(seedGroup);
      if (seedSubGroup) fetchModalProjects(seedGroup, seedSubGroup);
    }
    setCreateStep(1);
    setCreateKycDocs({});
    setShowCreateModal(true);
  };

  // ── Pincode auto-fill (shared for both create & edit) ──────────────────────
  const handlePincodeChange = (value, isEdit = false) => {
    if (!/^\d*$/.test(value)) return;
    if (pincodeDebounceRef.current) clearTimeout(pincodeDebounceRef.current);
    if (pincodeAbortRef.current)    pincodeAbortRef.current.abort();
    setPincodeError('');
    setEditFormData(prev => ({ ...prev, pincode: value, state: '', district: '' }));
    if (value.length !== 6) return;
    pincodeDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      pincodeAbortRef.current = controller;
      try {
        const res = await fetch(`${API_BASE_URL}/pincode/${value}`, { credentials: 'include', signal: controller.signal });
        if (!res.ok) throw new Error('api_error');
        const data = await res.json();
        if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setEditFormData(prev => ({ ...prev, state: po.State, district: po.District }));
          setPincodeError('');
        } else {
          setPincodeError('Invalid PIN code');
        }
      } catch (err) {
        if (err.name !== 'AbortError') setPincodeError('Could not fetch PIN details');
      }
    }, 600);
  };

  const handleCreateVendor = async () => {
    if (!editFormData.name?.trim()) { showWarning('Vendor name is required'); return; }
    if (!editFormData.category) { showWarning('Category is required'); return; }
    if (editFormData.category === 'Other' && !customCategory.trim()) { showWarning('Please enter a custom category'); return; }
    if (!editFormData.vendorType) { showWarning('Vendor type is required'); return; }
    if (editFormData.vendorType === 'Other' && !customVendorType.trim()) { showWarning('Please enter a custom vendor type'); return; }
    // Email is optional — validate format only if provided
    if (editFormData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editFormData.email)) { showWarning('Please enter a valid email address'); return; }
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
      // Full-access roles (admin/accounts_*) see all vendors; others see only their own
      if (!isFullAccess && user?.id) params.append('createdBy', user.id);
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
    if (!canView) return;
    setLoading(true);
    try {
      const vendorResponse = await fetch(`${API_BASE_URL}/vendors/${vendor.id}`, { credentials: 'include', headers: getAuthHeaders() });
      if (!vendorResponse.ok) throw new Error('Failed to fetch vendor details');
      const vendorData = await vendorResponse.json();
      setDetailVendor(vendorData);
      localStorage.setItem('vendor_detail_vendor', JSON.stringify(vendorData));
      localStorage.removeItem('vendor_detail_tab');
    } catch (error) { showError('Failed to load vendor details'); }
    finally { setLoading(false); }
  };

  // KYC functions kept in VendorDetailPage component — not needed here

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
      state: vendor.state || '', district: vendor.district || '', pincode: vendor.pincode || '', rating: vendor.rating || 0,
      status: vendor.status || 'Active',
      vendorType: vtypeIsCustom ? 'Other' : vtype,
      category:   catIsCustom   ? 'Other' : cat,
      notes: vendor.notes || '', assignedTo: vendor.assignedTo || '',
      groupName: vendor.groupName || '', subGroupName: vendor.subGroupName || '', projectId: vendor.projectId || ''
    });
    setPincodeError('');
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
    if (!editFormData.name?.trim()) { showWarning('Vendor name is required'); return; }
    if (!editFormData.category) { showWarning('Category is required'); return; }
    if (editFormData.category === 'Other' && !customCategory.trim()) { showWarning('Please enter a custom category'); return; }
    if (!editFormData.vendorType) { showWarning('Vendor type is required'); return; }
    if (editFormData.vendorType === 'Other' && !customVendorType.trim()) { showWarning('Please enter a custom vendor type'); return; }
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
      if (detailVendor?.id === editFormData.id) { const res = await fetch(`${API_BASE_URL}/vendors/${editFormData.id}`, { credentials: 'include', headers: getAuthHeaders() }); if (res.ok) { const d = await res.json(); setDetailVendor(d); localStorage.setItem('vendor_detail_vendor', JSON.stringify(d)); } }
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
      setDetailVendor(null); localStorage.removeItem('vendor_detail_vendor'); fetchVendors(); fetchStats();
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
      if (createdAtFrom)               exportParams.append('createdAtFrom', createdAtFrom);
      if (createdAtTo)                 exportParams.append('createdAtTo',   createdAtTo);

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
        { key: 'district',           label: 'District'                 },
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
  const renderCell = (col, vendor, rowIndex = 0) => {
    switch (col.id) {
      case 'sNo':
        return (
          <td key={col.id} style={{ textAlign:'center', color:__stc('#64748b'), fontSize:13, fontWeight:500, width:50 }}>
            {currentPage * pageSize + rowIndex + 1}
          </td>
        );
      case 'name':
        return (
          <td key={col.id} className="vendor-name-cell">
            <div className="vendor-name-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="vendor-name">{vendor.name}</span>
                {vendor.kycVerified && (
                  <span className="kyc-verified-badge" title="All 4 KYC documents verified">
                    <BadgeCheck size={13} /> Verified
                  </span>
                )}
              </div>
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
          <td key={col.id} onClick={e => e.stopPropagation()}>
            <div className="vendor-management-actions-cell">
              <button
                className={`vendor-management-action-btn vendor-management-action-view${!canView ? ' action-btn-disabled' : ''}`}
                onClick={(e) => { e.stopPropagation(); canView && handleViewVendor(vendor); }}
                title={canView ? 'View Details' : '🔒 No view permission'}
                disabled={!canView}
              ><Eye size={16} /></button>
              <button
                className={`vendor-management-action-btn vendor-management-action-edit${!canEdit ? ' action-btn-disabled' : ''}`}
                onClick={(e) => { e.stopPropagation(); canEdit && handleEditVendor(vendor); }}
                title={canEdit ? 'Edit Vendor' : '🔒 No edit permission'}
                disabled={!canEdit}
              ><Edit2 size={16} /></button>
              <button
                className={`vendor-management-action-btn vendor-management-action-delete${!canDelete ? ' action-btn-disabled' : ''}`}
                onClick={(e) => { e.stopPropagation(); canDelete && handleDeleteVendor(vendor.id, vendor.vendorName || vendor.name); }}
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
          <td key={col.id} style={{ minWidth: 200 }}>
            {vendor.projectId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: __stc('#1e293b'), wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>
                  {vendor.projectName || vendor.projectId}
                </span>
                {vendor.projectName && (
                  <span style={{ fontSize: 11, color: __stc('#64748b'), fontWeight: 400 }}>
                    {vendor.projectId}
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: __stc('#94a3b8') }}>N/A</span>
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
            <div className="timeline-dot" style={{ backgroundColor: index <= currentIndex ? getStatusColor(step) : __sbg('#e2e8f0') }} />
            <div className="timeline-label">
              <span className="timeline-status">{step}</span>
              {index === currentIndex && <span className="timeline-date">{formatDate(po.orderDate)}</span>}
            </div>
            {index < statusSteps.length - 1 && (
              <div className="timeline-line" style={{ backgroundColor: index < currentIndex ? getStatusColor(step) : __sbg('#e2e8f0') }} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ─── KPI ───────────────────────────────────────────────────────────────────
  const kpiData = stats ? [
    { title: 'Total Vendors',        value: stats.totalVendors.toString(),              icon: <Package size={32} />,     color: __stc('#2563eb') },
    { title: 'Approved Vendors',     value: stats.activeVendors.toString(),             icon: <CheckCircle size={32} />, color: __stc('#22c55e') },
    { title: 'Average Rating',       value: stats.averageRating.toFixed(1) + '/5',      icon: <Star size={32} />,        color: __stc('#f59e0b') },
    { title: 'Total Purchase Value', value: formatCurrency(stats.totalPurchaseValue),   icon: <IndianRupee size={32} />, color: __stc('#8b5cf6') },
  ] : [];

  // ─── Handle edit from detail page ─────────────────────────────────────────
  const handleEditFromDetail = (vendor) => {
    setDetailVendor(null);
    localStorage.removeItem('vendor_detail_vendor');
    handleEditVendor(vendor);
  };

  const handleDeleteFromDetail = (vendorId, vendorName) => {
    setDetailVendor(null);
    localStorage.removeItem('vendor_detail_vendor');
    handleDeleteVendor(vendorId, vendorName);
  };

  // ─── Detail page view ──────────────────────────────────────────────────────
  if (detailVendor) {
    return (
      <div className="vendor-management-container">
        {loading && <CrmPreloader text="Loading..." />}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
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
        <VendorDetailPage
          vendor={detailVendor}
          onBack={() => { setDetailVendor(null); localStorage.removeItem('vendor_detail_vendor'); localStorage.removeItem('vendor_detail_tab'); }}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
          canEdit={canEdit}
          canDelete={canDelete}
          getAuthHeaders={getAuthHeaders}
          showSuccess={showSuccess}
          showError={showError}
        />
        {showEditModal && editFormData && (
          <div className="vendor-management-modal-overlay">
            <div className="vendor-management-edit-modal" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              <div className="vendor-management-modal-header" style={{ flexShrink: 0 }}>
                <h2>Edit Vendor</h2>
                <button className="vendor-management-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {/* Edit form inline — reuse existing edit form fields */}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
          <div className="vendor-filter-select-wrap">
            <FilterSelect
              value={filters.status === 'all' ? '' : filters.status}
              options={[
                { value: 'Active',   label: 'Active'   },
                { value: 'Inactive', label: 'Inactive' },
              ]}
              placeholder="All Status"
              onChange={(v) => { setFilters(prev => ({ ...prev, status: v || 'all' })); setCurrentPage(0); }}
            />
          </div>
          <div className="vendor-filter-select-wrap">
            <FilterSelect
              value={filters.category === 'all' ? '' : filters.category}
              options={VENDOR_CATEGORIES.map(c => ({ value: c, label: c }))}
              placeholder="All Categories"
              onChange={(v) => { setFilters(prev => ({ ...prev, category: v || 'all' })); setCurrentPage(0); }}
            />
          </div>
          {/* Created Date range filter */}
          <div className="po-order-date-filter">
            <span className="po-order-date-label">Created:</span>
            <PODateRangeFilter
              appliedFrom={createdAtFrom}
              appliedTo={createdAtTo}
              onApply={(f, t) => { setCreatedAtFrom(f); setCreatedAtTo(t); setCurrentPage(0); }}
              onClear={() => { setCreatedAtFrom(''); setCreatedAtTo(''); setCurrentPage(0); }}
            />
          </div>
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
                vendors.map((vendor, rowIndex) => (
                  <tr key={vendor.id} className="vendor-management-table-row" onClick={() => canView && handleViewVendor(vendor)} style={{ cursor: canView ? "pointer" : "default" }}>
                    {visibleColumns.map((col) => renderCell(col, vendor, rowIndex))}
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
            <div className="pce-rows-dropdown">
                <FilterSelect
                  value={String(pageSize)}
                  options={[
                    { value: '10',  label: '10 Rows' },
                    { value: '20',  label: '20 Rows' },
                    { value: '50',  label: '50 Rows' },
                    { value: '100', label: '100 Rows' },
                  ]}
                  placeholder="Rows"
                  onChange={(v) => { if (v) { setPageSize(Number(v)); setCurrentPage(0); } }}
                />
              </div>
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
                <h3>Project Assignment</h3>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Group</label>
                    <FilterSelect value={modalGroupName} options={modalGroups} placeholder={modalDropdownLoading.groups ? 'Loading…' : 'Select Group'} disabled={modalDropdownLoading.groups} onChange={v => handleModalGroupChange({ target: { value: v } })} />
                  </div>
                  <div className="vendor-form-group"><label>Category / Sub-Group</label>
                    <FilterSelect value={modalSubGroupName} options={modalSubGroups} placeholder={!modalGroupName ? 'Select Group First' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Category'} disabled={!modalGroupName || modalDropdownLoading.subGroups} onChange={v => handleModalSubGroupChange({ target: { value: v } })} />
                  </div>
                </div>
                <div className="vendor-form-group"><label>Project <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(Optional)</span></label>
                  <FilterSelect value={modalProjectId} options={modalProjects.map(p => ({ value: p.id, label: p.name + (p.location ? ` - ${p.location}` : '') }))} placeholder={!modalSubGroupName ? 'Select Category First' : modalDropdownLoading.projects ? 'Loading…' : 'Select Project (Optional)'} disabled={!modalSubGroupName || modalDropdownLoading.projects} onChange={v => handleModalProjectChange({ target: { value: v } })} searchable={true} />
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
                  <div className="vendor-form-group"><label>Phone / Contact Number <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(optional)</span></label><input type="tel" value={editFormData.phone} maxLength={10} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setEditFormData({ ...editFormData, phone: v }); }} placeholder="Enter 10-digit phone number" /></div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Category *</label>
                    <FilterSelect value={editFormData.category} options={[...VENDOR_CATEGORIES.map(c => ({ value: c, label: c })), ...(editFormData.category && editFormData.category !== 'Other' && !VENDOR_CATEGORIES.includes(editFormData.category) ? [{ value: editFormData.category, label: editFormData.category }] : []), { value: 'Other', label: 'Other (enter manually)' }]} placeholder="Select category" onChange={v => setEditFormData({ ...editFormData, category: v })} />
                    {editFormData.category === 'Other' && (
                      <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                        placeholder="Enter category name" style={{ marginTop: 6 }} />
                    )}
                  </div>
                  <div className="vendor-form-group"><label>Vendor Type *</label>
                    <FilterSelect value={editFormData.vendorType} options={[...VENDOR_TYPES.map(t => ({ value: t, label: t })), ...(editFormData.vendorType && editFormData.vendorType !== 'Other' && !VENDOR_TYPES.includes(editFormData.vendorType) ? [{ value: editFormData.vendorType, label: editFormData.vendorType }] : []), { value: 'Other', label: 'Other (enter manually)' }]} placeholder="Select type" onChange={v => setEditFormData({ ...editFormData, vendorType: v })} />
                    {editFormData.vendorType === 'Other' && (
                      <input type="text" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)}
                        placeholder="Enter vendor type" style={{ marginTop: 6 }} />
                    )}
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group"><label>Rating</label>
                    <FilterSelect value={String(editFormData.rating)} options={[{value:'0',label:'Not Rated'},{value:'1',label:'⭐ 1 Star'},{value:'2',label:'⭐⭐ 2 Stars'},{value:'3',label:'⭐⭐⭐ 3 Stars'},{value:'4',label:'⭐⭐⭐⭐ 4 Stars'},{value:'5',label:'⭐⭐⭐⭐⭐ 5 Stars'}]} placeholder="Select rating" onChange={v => setEditFormData({ ...editFormData, rating: parseInt(v) })} />
                  </div>
                  <div className="vendor-form-group"><label>Status</label>
                    <FilterSelect value={editFormData.status} options={[{value:'Active',label:'Active'},{value:'Inactive',label:'Inactive'}]} placeholder="Select status" onChange={v => setEditFormData({ ...editFormData, status: v })} />
                  </div>
                </div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>GST Number <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(15 chars)</span></label>
                    <input type="text" value={editFormData.gstNumber}
                      maxLength={15}
                      onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15); setEditFormData({ ...editFormData, gstNumber: v }); }}
                      placeholder="e.g. 22AAAAA0000A1Z5" />
                  </div>
                  <div className="vendor-form-group"><label>Website</label><input type="url" value={editFormData.website || ''} onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })} placeholder="https://www.example.com" /></div>
                </div>
              </div>
              <div className="vendor-form-section">
                <h3>Address</h3>
                <div className="vendor-form-group"><label>Address</label><textarea rows={2} value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} placeholder="Enter address" /></div>
                <div className="vendor-form-row">
                  <div className="vendor-form-group">
                    <label>Pincode <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}></span></label>
                    <input type="text" value={editFormData.pincode || ''} maxLength={6}
                      onChange={e => handlePincodeChange(e.target.value)}
                      placeholder="Enter 6-digit pincode" />
                    {pincodeError && <span style={{fontSize:11,color:__stc('#ef4444'),marginTop:2,display:'block'}}>{pincodeError}</span>}
                  </div>
                  <div className="vendor-form-group"><label>State <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(auto-filled)</span></label>
                    <input type="text" value={editFormData.state || ''} readOnly
                      style={{background:__sbg('#f8fafc'),cursor:'default'}}
                      placeholder="Auto-filled from pincode" />
                  </div>
                  <div className="vendor-form-group"><label>District <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(auto-filled)</span></label>
                    <input type="text" value={editFormData.district || ''} readOnly
                      style={{background:__sbg('#f8fafc'),cursor:'default'}}
                      placeholder="Auto-filled from pincode" />
                  </div>
                  <div className="vendor-form-group"><label>City</label><input type="text" value={editFormData.city} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} placeholder="Enter city" /></div>
                </div>
              </div>
              <div className="vendor-form-section">
                <h3>Additional Information</h3>
                <div className="vendor-form-group"><label>Notes</label><textarea rows={3} value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder="Enter any additional notes" /></div>
              </div>
            </div>
            <div className="vendor-management-modal-actions" style={{ flexShrink: 0, borderTop: `1px solid ${__sbg('#e2e8f0')}`, padding: '16px 24px' }}>
              <button className="vendor-management-btn-primary" onClick={handleUpdateVendor}>Save Changes</button>
              <button className="vendor-management-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Modal (unchanged) ────────────────────────────────────────── */}
      {showCreateModal && editFormData && (() => {
        // KYC validation for step 2
        const createDocsWithNumber = KYC_DOCUMENTS.filter(d => createKycDocs[d.id]?.docNumber?.trim());
        // Missing file = doc has a number but no file selected at all
        const missingFiles = createDocsWithNumber.filter(d => !createKycDocs[d.id]?.fileName && !createKycDocs[d.id]?.fileUrl && !createKycDocs[d.id]?.fileObject);
        const handleCreateKycUpload = (docId, file) => {
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { showError('File too large. Max 10 MB.'); return; }
          setCreateKycDocs(prev => ({
            ...prev,
            [docId]: {
              ...prev[docId],        // preserves docNumber
              fileName:   file.name,
              fileObject: file,      // raw File for local preview
              fileUrl:    null,
              uploadedAt: new Date().toISOString(),
              uploading:  false,
              savedToDb:  false,     // will be saved after vendor creation
            }
          }));
        };

        const handleCreateMetaChange = (docId, field, value) => {
          setCreateKycDocs(prev => ({ ...prev, [docId]: { ...prev[docId], [field]: value } }));
        };

        // "Save" in create modal = mark ready locally (actual API call happens after vendor is created)
        const handleCreateKycSave = (docId) => {
          const d = createKycDocs[docId];
          if (!d?.fileObject && !d?.fileName) { showError('Select a file first.'); return; }
          setCreateKycDocs(prev => ({ ...prev, [docId]: { ...prev[docId], savedToDb: true } }));
          showSuccess(`${KYC_DOCUMENTS.find(k => k.id === docId)?.label} marked — will be saved after vendor creation.`);
        };

        // View file in create modal using local File object blob URL
        const handleCreateKycView = async (doc, uploaded) => {
          if (!uploaded?.fileObject && !uploaded?.fileUrl) return;
          if (createViewerBlobRef.current) { URL.revokeObjectURL(createViewerBlobRef.current); createViewerBlobRef.current = null; }
          try {
            let url;
            if (uploaded.fileObject instanceof File) {
              url = URL.createObjectURL(uploaded.fileObject);
            } else {
              url = uploaded.fileUrl.startsWith('http') ? uploaded.fileUrl : `${API_BASE_URL}${uploaded.fileUrl}`;
            }
            createViewerBlobRef.current = url;
            // Open in new tab (simplest approach for create modal — no embedded viewer needed)
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch { showError('Could not preview the file.'); }
        };
        const handleNextStep = () => {
          if (!editFormData.name?.trim()) { showWarning('Vendor name is required'); return; }
          if (!editFormData.category) { showWarning('Category is required'); return; }
          if (editFormData.category === 'Other' && !customCategory.trim()) { showWarning('Please enter a custom category'); return; }
          if (!editFormData.vendorType) { showWarning('Vendor type is required'); return; }
          if (editFormData.vendorType === 'Other' && !customVendorType.trim()) { showWarning('Please enter a custom vendor type'); return; }
          setCreateStep(2);
        };
        return (
        <div className="vendor-management-modal-overlay">
          <div className="vendor-management-edit-modal" onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', maxHeight: '92vh', width: createStep === 2 ? 'min(980px, 96vw)' : undefined }}>

            {/* Header */}
            <div className="vendor-management-modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h2>{createStep === 1 ? 'Add New Vendor' : 'KYC Documents'}</h2>
                <p style={{ fontSize: 12, color: __stc('#64748b'), margin: '2px 0 0' }}>Step {createStep} of 2 — {createStep === 1 ? 'Vendor Information' : 'KYC Details (optional)'}</p>
              </div>
              <button className="vendor-management-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            {/* Stepper */}
            <div className="vc-stepper">
              <div className={`vc-step ${createStep >= 1 ? 'vc-step--active' : ''} ${createStep > 1 ? 'vc-step--done' : ''}`}>
                <div className="vc-step-dot">{createStep > 1 ? <CheckCircle size={14} /> : '1'}</div>
                <span className="vc-step-label">Vendor Info</span>
              </div>
              <div className="vc-step-line" />
              <div className={`vc-step ${createStep >= 2 ? 'vc-step--active' : ''}`}>
                <div className="vc-step-dot">2</div>
                <span className="vc-step-label">KYC Documents</span>
              </div>
            </div>

            {/* ── Step 1: Vendor Info ── */}
            {createStep === 1 && (
              <div className="vendor-management-edit-form" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div className="vendor-form-section">
                  <h3>Project Assignment</h3>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group"><label>Group</label>
                      <FilterSelect value={modalGroupName} options={modalGroups} placeholder={modalDropdownLoading.groups ? 'Loading…' : 'Select Group'} disabled={modalDropdownLoading.groups} onChange={v => handleModalGroupChange({ target: { value: v } })} />
                    </div>
                    <div className="vendor-form-group"><label>Category / Sub-Group</label>
                      <FilterSelect value={modalSubGroupName} options={modalSubGroups} placeholder={!modalGroupName ? 'Select Group First' : modalDropdownLoading.subGroups ? 'Loading…' : 'Select Category'} disabled={!modalGroupName || modalDropdownLoading.subGroups} onChange={v => handleModalSubGroupChange({ target: { value: v } })} />
                    </div>
                  </div>
                  <div className="vendor-form-group"><label>Project (Optional)</label>
                    <FilterSelect value={modalProjectId} options={modalProjects.map(p => ({ value: p.id, label: p.name + (p.location ? ` - ${p.location}` : '') }))} placeholder={!modalSubGroupName ? 'Select Category First' : modalDropdownLoading.projects ? 'Loading…' : 'Select Project (Optional)'} disabled={!modalSubGroupName || modalDropdownLoading.projects} onChange={v => handleModalProjectChange({ target: { value: v } })} searchable={true} />
                  </div>
                </div>
                <div className="vendor-form-section">
                  <h3>Basic Information</h3>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group"><label>Vendor Name *</label><input type="text" value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Enter vendor name" /></div>
                    <div className="vendor-form-group"><label>Contact Person</label><input type="text" value={editFormData.contactPerson} onChange={e => setEditFormData({ ...editFormData, contactPerson: e.target.value })} placeholder="Enter contact person" /></div>
                  </div>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group"><label>Email</label><input type="email" value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} placeholder="Enter email" /></div>
                    <div className="vendor-form-group"><label>Phone <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(optional)</span></label><input type="tel" value={editFormData.phone} maxLength={10} onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,10); setEditFormData({ ...editFormData, phone: v }); }} placeholder="10-digit phone number" /></div>
                  </div>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group"><label>Category *</label>
                      <FilterSelect value={editFormData.category} options={[...VENDOR_CATEGORIES.map(c => ({ value: c, label: c })), ...(editFormData.category && editFormData.category !== 'Other' && !VENDOR_CATEGORIES.includes(editFormData.category) ? [{ value: editFormData.category, label: editFormData.category }] : []), { value: 'Other', label: 'Other (enter manually)' }]} placeholder="Select category" onChange={v => setEditFormData({ ...editFormData, category: v })} />
                      {editFormData.category === 'Other' && <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Enter category name" style={{ marginTop: 6 }} />}
                    </div>
                    <div className="vendor-form-group"><label>Vendor Type *</label>
                      <FilterSelect value={editFormData.vendorType} options={[...VENDOR_TYPES.map(t => ({ value: t, label: t })), ...(editFormData.vendorType && editFormData.vendorType !== 'Other' && !VENDOR_TYPES.includes(editFormData.vendorType) ? [{ value: editFormData.vendorType, label: editFormData.vendorType }] : []), { value: 'Other', label: 'Other (enter manually)' }]} placeholder="Select type" onChange={v => setEditFormData({ ...editFormData, vendorType: v })} />
                      {editFormData.vendorType === 'Other' && <input type="text" value={customVendorType} onChange={e => setCustomVendorType(e.target.value)} placeholder="Enter vendor type" style={{ marginTop: 6 }} />}
                    </div>
                  </div>
                </div>
                <div className="vendor-form-section">
                  <h3>Contact &amp; Address</h3>
                  <div className="vendor-form-group"><label>Website</label><input type="url" value={editFormData.website} onChange={e => setEditFormData({ ...editFormData, website: e.target.value })} placeholder="https://www.example.com" /></div>
                  <div className="vendor-form-group"><label>Address</label><textarea rows={2} value={editFormData.address} onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} placeholder="Enter address" /></div>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group">
                      <label>Pincode <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}></span></label>
                      <input type="text" value={editFormData.pincode || ''} maxLength={6}
                        onChange={e => handlePincodeChange(e.target.value)}
                        placeholder="Enter 6-digit pincode" />
                      {pincodeError && <span style={{fontSize:11,color:__stc('#ef4444'),marginTop:2,display:'block'}}>{pincodeError}</span>}
                    </div>
                    <div className="vendor-form-group"><label>State <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(auto-filled)</span></label>
                      <input type="text" value={editFormData.state || ''} readOnly
                        style={{background:__sbg('#f8fafc'),cursor:'default'}}
                        placeholder="Auto-filled from pincode" />
                    </div>
                    <div className="vendor-form-group"><label>District <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(auto-filled)</span></label>
                      <input type="text" value={editFormData.district || ''} readOnly
                        style={{background:__sbg('#f8fafc'),cursor:'default'}}
                        placeholder="Auto-filled from pincode" />
                    </div>
                    <div className="vendor-form-group"><label>City</label><input type="text" value={editFormData.city} onChange={e => setEditFormData({ ...editFormData, city: e.target.value })} placeholder="Enter city" /></div>
                  </div>
                  <div className="vendor-form-group">
                    <label>GST Number <span style={{fontSize:10,color:__stc('#94a3b8'),fontWeight:400}}>(15 chars)</span></label>
                    <input type="text" value={editFormData.gstNumber} maxLength={15}
                      onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15); setEditFormData({ ...editFormData, gstNumber: v }); }}
                      placeholder="e.g. 22AAAAA0000A1Z5" />
                  </div>
                </div>
                <div className="vendor-form-section">
                  <h3>Additional Details</h3>
                  <div className="vendor-form-row">
                    <div className="vendor-form-group"><label>Rating</label>
                      <FilterSelect value={String(editFormData.rating)} options={[{value:'0',label:'Not Rated'},{value:'1',label:'⭐ 1 Star'},{value:'2',label:'⭐⭐ 2 Stars'},{value:'3',label:'⭐⭐⭐ 3 Stars'},{value:'4',label:'⭐⭐⭐⭐ 4 Stars'},{value:'5',label:'⭐⭐⭐⭐⭐ 5 Stars'}]} placeholder="Select rating" onChange={v => setEditFormData({ ...editFormData, rating: parseInt(v) })} />
                    </div>
                    <div className="vendor-form-group"><label>Status</label>
                      <FilterSelect value={editFormData.status} options={[{value:'Active',label:'Active'},{value:'Inactive',label:'Inactive'}]} placeholder="Select status" onChange={v => setEditFormData({ ...editFormData, status: v })} />
                    </div>
                  </div>
                  {availableUsers.length > 0 && (
                    <div className="vendor-form-group"><label>Assign To</label>
                      <FilterSelect value={editFormData.assignedTo} options={availableUsers.map(u => ({ value: u.id, label: u.name }))} placeholder="Select user" onChange={v => setEditFormData({ ...editFormData, assignedTo: v })} />
                    </div>
                  )}
                  <div className="vendor-form-group"><label>Notes</label><textarea rows={3} value={editFormData.notes} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder="Enter any additional notes" /></div>
                </div>
              </div>
            )}

            {/* ── Step 2: KYC ── */}
            {createStep === 2 && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <p style={{ fontSize: 12, color: __stc('#64748b'), marginBottom: 16, lineHeight: 1.5 }}>
                  All KYC fields are optional. If you enter a document number, uploading the file becomes required before saving.
                </p>
                {missingFiles.length > 0 && (
                  <div style={{ background: __sbg('#fffbeb'), border: `1px solid ${__sbg('#fcd34d')}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: __stc('#92400e'), display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={14} />
                    {missingFiles.length} document(s) have a number but no file uploaded.
                  </div>
                )}
                {/* Main docs — table */}
                <div className="kyc-section-hd">
                  <Shield size={13} /><span>KYC Documents</span>
                  <span className="kyc-section-count">{MAIN_DOCS.filter(d => createKycDocs[d.id]?.docNumber?.trim() && (createKycDocs[d.id]?.fileName || createKycDocs[d.id]?.fileUrl)).length} / {MAIN_DOCS.length} complete</span>
                </div>
                <div className="kyc-table-wrap">
                  <table className="kyc-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}></th>
                        <th>Document</th>
                        <th style={{ minWidth: 190 }}>Document Number</th>
                        <th style={{ minWidth: 210 }}>File</th>
                        <th style={{ width: 90 }}>Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MAIN_DOCS.map(doc => (
                        <KycDocCard key={doc.id} doc={doc} uploaded={createKycDocs[doc.id]} onUpload={handleCreateKycUpload} onMetaChange={handleCreateMetaChange} onSave={handleCreateKycSave} onViewFile={handleCreateKycView} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Additional docs — cards */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 8 }}>
                  <FileText size={13} style={{ color: __stc('#475569') }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: __stc('#475569') }}>Additional Documents</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: __stc('#6b7280') }}>{ADDITIONAL_DOCS.filter(d => createKycDocs[d.id]?.docNumber?.trim() && (createKycDocs[d.id]?.fileName || createKycDocs[d.id]?.fileUrl)).length} / {ADDITIONAL_DOCS.length} complete</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {ADDITIONAL_DOCS.map(doc => (
                    <KycAddCard key={doc.id} doc={doc} uploaded={createKycDocs[doc.id]} onUpload={handleCreateKycUpload} onMetaChange={handleCreateMetaChange} onSave={handleCreateKycSave} onViewFile={handleCreateKycView} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="vendor-management-modal-actions" style={{ flexShrink: 0, borderTop: `1px solid ${__sbg('#e2e8f0')}`, padding: '16px 24px', justifyContent: 'space-between' }}>
              <div>
                {createStep === 2 && (
                  <button className="vendor-management-btn-secondary" onClick={() => setCreateStep(1)}>← Back</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {createStep === 1 ? (
                  <>
                    <button className="vendor-management-btn-primary" onClick={handleNextStep}>Next: KYC →</button>
                    <button className="vendor-management-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      className="vendor-management-btn-primary"
                      onClick={handleCreateVendor}
                      disabled={missingFiles.length > 0}
                      title={missingFiles.length > 0 ? 'Upload files for all entered document numbers' : ''}
                    >
                      Create Vendor
                    </button>
                    <button className="vendor-management-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default VendorManagement;