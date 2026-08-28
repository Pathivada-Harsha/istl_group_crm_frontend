// Leads-Enquiries.js — Enhanced with:
// • Lead Detail "page" (replaces view modal — full in-page panel with back button)
// • Integrated Proposals per lead (create / list / download PDF)
// • "Closed Lost" reason field → stored in lead_history via existing update API
// • Drag & drop column reorder + column visibility
// • Grid / Table toggle
// • SERVER-SIDE PAGINATION — page/size/filters are sent to backend on every change

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GrDocumentUpdate } from 'react-icons/gr';
import { User, Calendar, MapPin, Sun, Users, Phone, FileText,
         LayoutDashboard, ClipboardList, Package, Wallet, FolderOpen, Repeat, History as HistoryIcon,
         Eye, Download as DownloadIcon, Sparkles, Trash2 } from 'lucide-react';
import '../components/Leads/LeadCardHead.css';
import ProposalDocViewer from '../components/Leads/ProposalDocViewer.js';
import '../pages-css/Leads-Enquire.css';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import FilterSelect from '../components/Dropdowns/FilterSelect.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast.js';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import LeadTimelineModal from '../components/Leads/LeadTimelineModal.js';
import AddFollowupModal from '../components/Leads/AddFollowupModal.js';
import { COMMON_UNITS } from '../components/Dropdowns/Unittypedropdown.js';
import LeadsExcelPanel from "./../components/Leads/LeadsExcelPanel.js";
import LeadFollowupsTab from './../components/Leads/LeadFollowupsTab';
import LeadSiteVisitTab from './../components/Leads/LeadSiteVisitTab.js';
import LeadTechnicalScopeTab from './../components/Leads/LeadTechnicalScopeTab';
import LeadBomTab from './../components/Leads/LeadBomTab';
import LeadBudgetTab from './../components/Leads/LeadBudgetTab';
import GenerateProposalModal from './../components/Leads/GenerateProposalModal.js';
import { isStatusDowngrade, isStatusLocked, lockedStatusHint, LEAD_STATUS_OPTIONS } from './../constants/leadStatus';
import ConfirmationModal from '../components/ConfirmationModal.js';

/**
 * Solar leads generate their client proposal from their own tabs (Technical
 * Scope / BOM / Budget / Site Visit) into the approved Word template. Other
 * groups keep the generic proposal form.
 *
 * Solar is an EPC *sub-group*, not a group — the live taxonomy is
 * EPC → Solar_Rooftop | Solar_ground_mounted | Solar_carports | Solar Wind |
 * Pm_kusum | Substations, IoT → CCMS | ITMS | MCMS, plus CBG. Must stay in step
 * with SolarProposalDocService.isSolar on the backend.
 */
const isSolarLead = (lead) =>
  String(lead?.subGroupName || '').trim().toLowerCase().startsWith('solar') ||
  String(lead?.groupName || '').trim().toLowerCase() === 'solar';

/* ── Inline-style theme mappers (added for dark mode) ── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#f8f9fa':'#0f1420','#fafafa':'#0f1420','#f8fafb':'#0f1420','#f9fffe':'#161b27','#fffafa':'#2b1d20',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#f1f1f1':'#232b3b','#f0f0f0':'#232b3b','#e9eef5':'#2b3445',
  '#eff6ff':'#15243d','#f0f7ff':'#15243d','#f0f9ff':'#15243d','#f0f4ff':'#1a2440','#dbeafe':'#1d3a5f','#bfdbfe':'#244b7a','#bae6fd':'#16344d','#e0f2fe':'#16344d','#e0e7ff':'#1e2547',
  '#ecfdf5':'#102a22','#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#a7f3d0':'#2a5a40','#6ee7b7':'#2a5a40','#bbf7d0':'#2a5a40','#86efac':'#2a5a40',
  '#fef2f2':'#2a1719','#fee2e2':'#3a1f22','#fecaca':'#3a1f22','#fff9f9':'#2b1d20','#fff5f5':'#2b1d20','#fff0f0':'#2b1d20','#fff7ed':'#2c2113','#fff7e6':'#2c2113','#fffbeb':'#2a2710','#fffdf0':'#2a2710','#fffdf5':'#2a2710','#fef9c3':'#3a3016','#fef3c7':'#3a3016','#fde68a':'#5a4714','#fef08a':'#5a4714',
  '#f5f3ff':'#241b3d','#faf5ff':'#241b3d','#eef2ff':'#1e1f45','#ede9fe':'#2a2147','#ddd6fe':'#2e2147','#e9d5ff':'#2e2147','#ecfeff':'#103038','#fce7f3':'#3a1f30','#fdf2f8':'#3a1f30',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456','#a5b4fc':'#3a3d6a',
  '#c4b5fd':'#3a3d6a','#fca5a5':'#5a2a2e','#fefce8':'#2a2710',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6','#1f2937':'#d4dbe6',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#4b5563':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#6b7280':'#94a1b3','#9ca3af':'#9aa7b8','#94a3b8':'#9aa7b8',
  '#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#1c4532':'#6ee7b7','#059669':'#18c08a','#16a34a':'#2bc55e',
  '#b45309':'#f0c07a','#c2410c':'#fb923c','#92400e':'#f0c07a','#78350f':'#f0b080','#d97706':'#f0b454','#ca8a04':'#e3c258',
  '#b91c1c':'#f08a8a','#991b1b':'#f08a8a','#dc2626':'#f05252','#ef4444':'#f06a6a',
  '#1d4ed8':'#5b9bf0','#2563eb':'#5b9bf0','#1e40af':'#5b9bf0','#0e7490':'#22d3ee','#3b82f6':'#5b9bf0','#0284c7':'#38bdf8','#0369a1':'#38bdf8',
  '#7c3aed':'#a78bfa','#8b5cf6':'#b39bf7','#6d28d9':'#c4b5fd','#5b21b6':'#c4b5fd','#3730a3':'#a5b4fc','#4338ca':'#a5b4fc','#4f46e5':'#8589f3','#6366f1':'#8589f3',
  '#9d174d':'#f0a0c0','#db2777':'#f06fad','#be185d':'#f06fad','#1b3a6b':'#7fb0f0','#1e3a5f':'#7fb0f0','#4d7ce0':'#9bbcf5',
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

const API_BASE_URL = process.env.REACT_APP_API_URL;

// Indian Rupee formatter for amount fields
const toINR = v => { const n = String(v).replace(/[^0-9]/g,''); if (!n) return ''; return parseInt(n,10).toLocaleString('en-IN'); };

// ─── Tender Lead Utilities ────────────────────────────────────────────────────
const TENDER_META_PREFIX = '__TENDER_META__:';

/**
 * Encode tender metadata into the enquiry field.
 * The field starts with the prefix, followed by JSON, then an optional
 * human-readable description after a newline separator.
 */
const encodeTenderMeta = (meta, description = '') => {
  const json = JSON.stringify(meta);
  return `${TENDER_META_PREFIX}${json}\n${description}`.trimEnd();
};

/**
 * Decode tender metadata from the enquiry field.
 * Returns { meta, description } or null if not a tender lead.
 */
const decodeTenderMeta = (enquiry) => {
  if (!enquiry || !enquiry.startsWith(TENDER_META_PREFIX)) return null;
  try {
    const body = enquiry.slice(TENDER_META_PREFIX.length);
    const nlIdx = body.indexOf('\n');
    const jsonStr = nlIdx === -1 ? body : body.slice(0, nlIdx);
    const description = nlIdx === -1 ? '' : body.slice(nlIdx + 1);
    const meta = JSON.parse(jsonStr);
    return { meta, description };
  } catch { return null; }
};

/** Determine if a lead is a tender lead */
const isTenderLead = (lead) => {
  if (!lead) return false;
  return lead.source === 'Tender' ||
    (lead.enquiry && lead.enquiry.startsWith(TENDER_META_PREFIX));
};

/** Tender statuses — separate lifecycle from customer leads */
const TENDER_STATUSES = [
  'Tender Floated',
  'Pre-Bid Meeting',
  'Bid Submitted',
  'Technical Evaluation',
  'Financial Evaluation',
  'L1 (Lowest Bidder)',
  'Tender Won',
  'Tender Lost',
  'Cancelled / Withdrawn',
];

// ─── Default Proposal Template ───────────────────────────────────────────────
const DEFAULT_PROPOSAL_TEMPLATE = {
  companyName: 'SESOLA POWER PROJECTS PROPOSAL PVT LTD',
  aboutUs: `We are a leading provider of renewable energy solutions with expertise in solar power systems. Our team of experienced professionals is committed to delivering high-quality, sustainable energy solutions that meet the unique needs of our clients.\n\nWith years of experience in the industry, we have successfully completed numerous projects across various sectors, establishing ourselves as a trusted partner in the transition to clean energy.`,
  aboutSystem: `The proposed solar power system is designed to provide reliable, efficient, and sustainable energy generation. The system includes high-efficiency solar panels, advanced inverters, robust mounting structures, and comprehensive monitoring systems.\n\nKey features:\n- High-efficiency solar panels with excellent performance\n- Grid-tied inverter system for optimal power conversion\n- Durable mounting structures with wind load certification\n- Remote monitoring and management capabilities\n- Comprehensive safety features and protection systems`,
  paymentTerms: `1. 30% advance payment upon signing of agreement\n2. 40% payment on delivery of materials at site\n3. 30% payment on successful commissioning and handover\n\nPayment can be made via bank transfer, cheque, or demand draft in favor of SESOLA POWER PROJECTS PROPOSAL PVT LTD.`,
  defectLiabilityPeriod: `Standard 12 months warranty period from date of commissioning and handover.\n\nDuring this period, any defects in workmanship, materials, or performance will be rectified free of cost. This includes:\n- Repair or replacement of defective components\n- System performance issues\n- Installation-related defects\n\nExtended warranty options are available upon request.`,
  systemPricing: [],
  bomItems: [],
};
// Unified status helper - module-level so all components can use it
// Priority rules for the unified display status:
// 1. Closed Won / Closed Lost always win (terminal states).
// 2. If BD has progressed the lead (status is NOT a raw TC-mirror value),
//    show the BD-set status — do NOT let telecaller status override it.
// 3. Only surface TC status when the main status is still at an early
//    TC-driven stage (New, Interested, Not Interested, Not Responded).
const TC_EARLY_STATUSES = new Set(['New', 'Interested', 'Not Interested', 'Not Responded', 'Keep in View']);
const getUnifiedStatus = (lead) => {
  if (!lead) return 'New';
  const s  = lead.status || 'New';
  const tc = lead.telecallerStatus;
  // Terminal / BD-progressed states always win — never overridden by TC
  if (s === 'Closed Won' || s === 'Closed Lost') return s;
  if (!TC_EARLY_STATUSES.has(s)) return s;
  // TC override ONLY applies when the BD status is still 'New'
  // If BD has explicitly set status to Interested / Not Interested / etc,
  // respect that choice and don't let telecallerStatus overwrite it.
  if (s !== 'New') return s;
  // Lead is still 'New' — surface telecaller status if set
  if (tc === 'INTERESTED')     return 'Interested';
  if (tc === 'NOT_INTERESTED') return 'Not Interested';
  if (tc === 'NOT_RESPONDED')  return 'Not Responded';
  if (tc === 'KEEP_IN_VIEW')   return 'Keep in View';
  return s;
};

const LeadFollowupsOverviewSnippet = ({ leadId, onGoToFollowups }) => {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    const user = JSON.parse(localStorage.getItem('bd_portal_user') || '{}');
    fetch(`${API_BASE_URL}/followups/lead/${leadId}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'User-Id': String(user.id || 1), 'User-Role': user.role || '' }
    })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data || []); })
      .catch(() => {});
  }, [leadId]);

  if (!data) return null;

  const isOverdue = f => f.status === 'Pending' && f.scheduledAt && new Date(f.scheduledAt) < new Date();
  const pending   = data.filter(f => f.status === 'Pending' && !isOverdue(f));
  const overdue   = data.filter(isOverdue);
  const completed = data.filter(f => f.status === 'Completed');
  const latest    = [...data].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))[0];

  const TYPE_ICON = { Call:'📞', Email:'✉️', Meeting:'🤝', Visit:'🏠', Demo:'💻' };

  if (data.length === 0) return (
    <div className="ld-info-card" style={{ borderStyle: 'dashed', borderColor: __sbg('#E5E7EB') }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 className="ld-card-title">Follow-ups</h4>
        <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToFollowups}>Schedule →</button>
      </div>
      <p style={{ fontSize: 12, color: __stc('#9CA3AF'), margin: '8px 0 0' }}>No follow-ups yet for this lead.</p>
    </div>
  );

  return (
    <div className="ld-info-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h4 className="ld-card-title" style={{ margin: 0 }}>Follow-ups</h4>
        <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToFollowups}>View All →</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          { label: 'Total',     val: data.length,      bg: __sbg('#F3F4F6'), color: __stc('#374151') },
          { label: 'Pending',   val: pending.length,   bg: __sbg('#FEF9C3'), color: __stc('#92400E') },
          { label: 'Overdue',   val: overdue.length,   bg: __sbg('#FEE2E2'), color: __stc('#991B1B') },
          { label: 'Completed', val: completed.length, bg: __sbg('#D1FAE5'), color: __stc('#065F46') },
        ].filter(s => s.val > 0).map(s => (
          <div key={s.label} style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
            <strong style={{ fontSize: 16 }}>{s.val}</strong> {s.label}
          </div>
        ))}
      </div>
      {latest && (
        <div style={{ background: __sbg('#F8FAFC'), borderRadius: 8, padding: '8px 12px', fontSize: 12, border: `1px solid ${__sbg('#E5E7EB')}` }}>
          <span style={{ fontWeight: 600, color: __stc('#374151') }}>
            {TYPE_ICON[latest.followupType] || '📌'} Next/Latest: {latest.followupType}
          </span>
          <span style={{ color: __stc('#6B7280'), marginLeft: 8 }}>
            {new Date(latest.scheduledAt).toLocaleDateString('en-IN')}
            {latest.assignedToName && ` · ${latest.assignedToName}`}
          </span>
          {latest.outcome && (
            <p style={{ margin: '5px 0 0', color: __stc('#374151'), lineHeight: 1.4 }}>
              {latest.outcome.slice(0, 120)}{latest.outcome.length > 120 ? '…' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
// ─── All Columns ──────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'name',           label: 'Client Name',  sortable: true,  required: true  },
  { key: 'contact',        label: 'Contact',       sortable: false, required: false },
  { key: 'groupName',      label: 'Group',         sortable: true,  required: false },
  { key: 'subGroupName',   label: 'Category',      sortable: true,  required: false },
  { key: 'createdAt',      label: 'Date',          sortable: true,  required: false },
  { key: 'capacity',       label: 'Capacity',      sortable: true,  required: false },
  { key: 'priority',       label: 'Priority',      sortable: true,  required: false },
  { key: 'status',         label: 'Status',        sortable: true,  required: false },
  { key: 'source',         label: 'Source',        sortable: true,  required: false },
  { key: 'assignedToName', label: 'Assigned To',   sortable: false, required: false },
  { key: 'leadOwner',      label: 'Lead Owner',    sortable: true,  required: false },
  { key: 'actions',        label: 'Actions',       sortable: false, required: true  },
];

// Maps a frontend column key to the LeadsEntity field the backend can sort on.
// Keys NOT present here are not server-sortable (e.g. assignedToName is a
// wrapper-only field with no entity column — sorting by it would crash JPA),
// so their headers fall back to non-interactive.
const SORT_FIELD_MAP = {
  name:         'name',
  email:        'email',
  phone:        'phone',
  groupName:    'groupName',
  subGroupName: 'subGroupName',
  createdAt:    'createdAt',
  capacity:     'capacity',
  priority:     'priority',
  status:       'status',
  source:       'source',
  leadOwner:    'leadOwner',
};

const DEFAULT_ORDER = ALL_COLUMNS.map(c => c.key);
const DEFAULT_VISIBLE = ALL_COLUMNS
  .filter(c => !['source', 'assignedToName', 'groupName'].includes(c.key))
  .map(c => c.key);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseJSON = s => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } };
const fmtDate = s => s ? new Date(s).toLocaleDateString() : '-';
// Local (not UTC) today as yyyy-MM-dd — for date-input `min` so early-morning IST
// hours don't allow a past date (toISOString() is UTC).
const todayLocalStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fmtDT = s => { if (!s) return '-'; const d = new Date(s); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// ─── Delete Confirmation ──────────────────────────────────────────────────────
const DeleteConfirmationToast = ({ onConfirm, onCancel, leadName }) => (
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
        <p>Are you sure you want to delete "{leadName}"? This action cannot be undone.</p>
      </div>
      <button className="delete-confirmation-close" onClick={onCancel}>
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

// ─── Column Visibility Dropdown ───────────────────────────────────────────────
const ColumnVisibilityDropdown = ({ columns, visibleColumns, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const hiddenCount = columns.filter(c => !c.required && !visibleColumns.includes(c.key)).length;
  return (
    <div className="col-visibility-wrapper" ref={ref}>
      <button className={`col-visibility-btn ${hiddenCount > 0 ? 'has-hidden' : ''}`} onClick={() => setOpen(o => !o)}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Columns
        {hiddenCount > 0 && <span className="col-visibility-badge">{hiddenCount}</span>}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
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
              <label key={col.key} className={`col-visibility-item ${col.required ? 'col-required' : ''}`}>
                <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => !col.required && onToggle(col.key)} disabled={col.required} />
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

// ─── Draggable Header Cell ────────────────────────────────────────────────────
const DraggableHeaderCell = ({ col, index, sortColumn, sortDirection, getSortIcon, handleSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) => (
  <th
    draggable
    onDragStart={e => onDragStart(e, index)}
    onDragOver={e => onDragOver(e, index)}
    onDrop={e => onDrop(e, index)}
    onDragEnd={onDragEnd}
    data-col={col.key}
    className={`col-draggable${isDragOver ? ' col-drag-over' : ''}${col.key === 'actions' ? ' actions-column-header' : ''}`}
    onClick={() => col.sortable && handleSort(col.key)}
    style={{ cursor: col.sortable ? 'pointer' : 'grab' }}
  >
    <div className="th-content">
      <span className="col-drag-handle" title="Drag to reorder">
        <svg fill="currentColor" viewBox="0 0 24 24" width="10" height="10">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>
      {col.label}
      {col.sortable && getSortIcon(col.key)}
    </div>
  </th>
);

// ─── Proposal Form (inline in lead detail) ───────────────────────────────────
const ProposalForm = ({ lead, currentUser, onSaved, onCancel, existingProposal, apiBase }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [customUnitInputs, setCustomUnitInputs] = useState({});
  const [filteredBomItems, setFilteredBomItems] = useState({});
  const [showBomDropdown, setShowBomDropdown] = useState({});

  // Offline PDF edit state
  const isOfflineProposal = !!(existingProposal?.offlinePdfName || existingProposal?.offlinePdfPath);
  const [offlineReplaceFile, setOfflineReplaceFile] = useState(null);
  const [offlineReplacing, setOfflineReplacing] = useState(false);

  const [formData, setFormData] = useState({
    leadId: lead.id,
    title: existingProposal?.title || '',
    description: existingProposal?.description || '',
    totalValue: existingProposal?.totalValue || '',
    groupName: lead.groupName || '',
    subGroupName: lead.subGroupName || '',
    status: existingProposal?.status || 'Draft',
  });
  const [tmpl, setTmpl] = useState({
    companyName: existingProposal?.companyName || DEFAULT_PROPOSAL_TEMPLATE.companyName,
    aboutUs: existingProposal?.aboutUs || DEFAULT_PROPOSAL_TEMPLATE.aboutUs,
    aboutSystem: existingProposal?.aboutSystem || DEFAULT_PROPOSAL_TEMPLATE.aboutSystem,
    paymentTerms: existingProposal?.paymentTerms || DEFAULT_PROPOSAL_TEMPLATE.paymentTerms,
    defectLiabilityPeriod: existingProposal?.defectLiabilityPeriod || DEFAULT_PROPOSAL_TEMPLATE.defectLiabilityPeriod,
    systemPricing: parseJSON(existingProposal?.systemPricing) || [],
    bomItems: parseJSON(existingProposal?.bomItems) || [],
  });

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

  const handleBomSearch = async (idx, term) => {
    if (!term || term.length < 2) { setFilteredBomItems(p => ({ ...p, [idx]: [] })); setShowBomDropdown(p => ({ ...p, [idx]: false })); return; }
    try {
      const res = await fetch(`${apiBase}/bom-items-master/search?searchTerm=${encodeURIComponent(term)}`, { credentials: 'include', headers });
      const data = await res.json();
      setFilteredBomItems(p => ({ ...p, [idx]: data.data || [] }));
      setShowBomDropdown(p => ({ ...p, [idx]: (data.data || []).length > 0 }));
    } catch { setFilteredBomItems(p => ({ ...p, [idx]: [] })); }
  };

  const selectBomItem = (idx, bom) => {
    const u = [...tmpl.bomItems]; u[idx] = { ...u[idx], item: bom.itemName, specification: bom.specification || '', unit: bom.defaultUnit || 'Nos', tax: bom.defaultTaxPercent || '18' };
    setTmpl({ ...tmpl, bomItems: u }); setShowBomDropdown(p => ({ ...p, [idx]: false }));
  };

  const updBOM = (idx, f, v) => {
    const u = [...tmpl.bomItems]; u[idx][f] = v;
    if (['quantity', 'rate', 'tax'].includes(f)) { const q = parseFloat(u[idx].quantity) || 0, r = parseFloat(u[idx].rate) || 0, t = parseFloat(u[idx].tax) || 0; u[idx].amount = ((q * r) + (q * r * t / 100)).toFixed(2); }
    setTmpl({ ...tmpl, bomItems: u });
  };
  // Row aux-state (custom-unit inputs, search dropdowns) is keyed by row index —
  // shift keys above the removed row down by one so they stay aligned.
  const reindexAfterRemove = (map, removed) => {
    const out = {};
    Object.keys(map).forEach(k => { const i = Number(k); if (i < removed) out[i] = map[k]; else if (i > removed) out[i - 1] = map[k]; });
    return out;
  };
  const rmBOM = idx => {
    setTmpl({ ...tmpl, bomItems: tmpl.bomItems.filter((_, i) => i !== idx) });
    setCustomUnitInputs(m => reindexAfterRemove(m, idx));
    setShowBomDropdown(m => reindexAfterRemove(m, idx));
    setFilteredBomItems(m => reindexAfterRemove(m, idx));
  };
  const addBOM = () => setTmpl({ ...tmpl, bomItems: [...tmpl.bomItems, { item: '', specification: '', quantity: '', unit: 'Nos', rate: '', tax: '18', amount: '' }] });

  const updPricing = (idx, f, v) => { const u = [...tmpl.systemPricing]; u[idx][f] = v; setTmpl({ ...tmpl, systemPricing: u }); };
  const rmPricing = idx => setTmpl({ ...tmpl, systemPricing: tmpl.systemPricing.filter((_, i) => i !== idx) });
  const addPricing = () => setTmpl({ ...tmpl, systemPricing: [...tmpl.systemPricing, { item: '', description: '', amount: '' }] });

  const bomTotals = () => {
    const sub = tmpl.bomItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0);
    const tax = tmpl.bomItems.reduce((s, it) => { const st = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0); return s + st * (parseFloat(it.tax) || 0) / 100; }, 0);
    const grand = tmpl.bomItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    return { sub: sub.toFixed(2), tax: tax.toFixed(2), grand: grand.toFixed(2) };
  };

  // Save for offline proposal: only update title + totalValue, then optionally replace PDF
  const handleSaveOffline = async () => {
    if (!formData.title.trim()) { alert('Please enter a title'); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ title: formData.title.trim(), totalValue: parseFloat(formData.totalValue) || 0, status: formData.status || 'Draft' });
      const res = await fetch(`${apiBase}/proposals/update/${existingProposal.id}`, {
        method: 'PUT', headers, credentials: 'include', body,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');

      // If a replacement PDF was chosen, upload it too
      if (offlineReplaceFile) {
        setOfflineReplacing(true);
        const form = new FormData();
        form.append('file', offlineReplaceFile);
        const upRes = await fetch(`${apiBase}/proposals/${existingProposal.id}/upload-offline`, {
          method: 'POST', credentials: 'include',
          headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
          body: form,
        });
        const upData = await upRes.json();
        if (!upData.success) throw new Error(upData.error || 'PDF replace failed');
      }

      onSaved(data.data || data.message);
    } catch (e) { alert(e.message || 'Failed to save proposal'); }
    finally { setSaving(false); setOfflineReplacing(false); }
  };

  const handleSave = async () => {
    if (!formData.title) { alert('Please fill in Title'); return; }
    setSaving(true);
    try {
      // Solar carries no typed template — writing the defaults back would clobber
      // fields the generated document doesn't use anyway.
      const body = JSON.stringify(isSolarLead(lead)
        ? formData
        : { ...formData, ...tmpl, systemPricing: JSON.stringify(tmpl.systemPricing), bomItems: JSON.stringify(tmpl.bomItems) });
      const url = existingProposal ? `${apiBase}/proposals/update/${existingProposal.id}` : `${apiBase}/proposals/create`;
      const method = existingProposal ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, credentials: 'include', body });
      const data = await res.json();
      if (data.success) onSaved(data.data || data.message);
      else alert(data.error || data.message || 'Failed to save proposal');
    } catch (e) { alert('Failed to save proposal'); }
    finally { setSaving(false); }
  };

  // ── Offline proposal edit: simplified form with only Title, Total Value, Replace PDF ──
  if (isOfflineProposal) {
    return (
      <div className="ld-proposal-form">
        <div style={{ background: __sbg('#faf5ff'), border: `1.5px solid ${__sbg('#e9d5ff')}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <span style={{ fontSize: 13, color: __stc('#6d28d9'), fontWeight: 600 }}>Offline PDF Proposal</span>
          <span style={{ fontSize: 12, color: __stc('#6b7280'), marginLeft: 4 }}>— {existingProposal.offlinePdfName || 'uploaded PDF'}</span>
        </div>
        <div className="ld-form-grid">
          <div className="ld-fgroup ld-full">
            <label>Title *</label>
            <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Proposal title" />
          </div>
          <div className="ld-fgroup">
            <label>Total Value (₹)</label>
            <input type="number" value={formData.totalValue} onChange={e => setFormData({ ...formData, totalValue: e.target.value })} placeholder="0.00" min="0" step="0.01" />
          </div>
          <div className="ld-fgroup">
            <label>Status</label>
            <FilterSelect
              value={formData.status}
              options={['Draft','Sent','Approved','Rejected','On Hold'].map(s => ({ value: s, label: s }))}
              placeholder="Select Status"
              onChange={v => setFormData({ ...formData, status: v })}
            />
          </div>
          <div className="ld-fgroup">
            <label>Replace PDF <span style={{ fontSize: 11, color: __stc('#9ca3af'), fontWeight: 400 }}>(optional)</span></label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              border: '1.5px dashed ' + (offlineReplaceFile ? __sbg('#7c3aed') : __sbg('#c4b5fd')),
              borderRadius: 7, padding: '8px 12px', background: offlineReplaceFile ? __sbg('#f5f3ff') : __sbg('#faf5ff'),
              fontSize: 13, color: offlineReplaceFile ? __stc('#6d28d9') : __stc('#7c3aed'), fontWeight: 500, userSelect: 'none'
            }}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {offlineReplaceFile ? offlineReplaceFile.name : 'Choose new PDF to replace…'}
              </span>
              <input type="file" accept=".pdf,application/pdf" onChange={e => setOfflineReplaceFile(e.target.files[0] || null)} style={{ display: 'none' }} />
            </label>
            {offlineReplaceFile && <div style={{ fontSize: 11, color: __stc('#059669'), marginTop: 4 }}>✓ {offlineReplaceFile.name} — will replace current PDF</div>}
          </div>
        </div>
        <div className="ld-pform-footer">
          <button className="ld-btn ld-btn-sec" onClick={onCancel}>Cancel</button>
          <button className="ld-btn ld-btn-pri" onClick={handleSaveOffline} disabled={saving || offlineReplacing}>
            {saving || offlineReplacing ? 'Saving…' : 'Update Proposal'}
          </button>
        </div>
      </div>
    );
  }

  // Solar proposals no longer carry a typed template or a catalog-picked BOM:
  // the client document is generated from the lead's own tabs. What is left to
  // edit here is the tracked record itself.
  const solarLead = isSolarLead(lead);
  const TABS = solarLead
    ? [{ k: 'basic', l: 'Basic' }]
    : [
        { k: 'basic', l: 'Basic' }, { k: 'company', l: 'Company' }, { k: 'aboutUs', l: 'About Us' },
        { k: 'system', l: 'System' }, { k: 'pricing', l: 'Pricing' }, { k: 'payment', l: 'Payment' },
        { k: 'dlp', l: 'DLP' }, { k: 'bom', l: 'BOM' },
      ];
  const tab = solarLead ? 'basic' : activeTab;

  return (
    <div className="ld-proposal-form">
      {solarLead && (
        <div style={{ background: __sbg('#eef2ff'), border: `1.5px solid ${__sbg('#cbd5e1')}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: __stc('#334155') }}>
          <strong>Solar proposal.</strong> The client document is generated from this lead's
          Technical Scope, BOM, Budget and Site Visit tabs into the approved template —
          use <strong>Generate Proposal</strong>. Only the tracked record is edited here.
        </div>
      )}
      <div className="ld-ptabs">
        {TABS.map(t => <button key={t.k} className={`ld-ptab${tab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>{t.l}</button>)}
      </div>

      <div className="ld-ptab-body">
        {tab === 'basic' && (
          <div className="ld-form-grid">
            <div className="ld-fgroup ld-full">
              <label>Title *</label>
              <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Proposal title" />
            </div>
            <div className="ld-fgroup">
              <label>Total Value (₹)</label>
              <input type="number" value={formData.totalValue} onChange={e => setFormData({ ...formData, totalValue: e.target.value })} placeholder="0.00" />
            </div>
            <div className="ld-fgroup">
              <label>Status</label>
              <FilterSelect
                value={formData.status}
                onChange={v => setFormData({ ...formData, status: v })}
                options={['Draft','Sent','Approved','Rejected','On Hold'].map(s => ({ value: s, label: s }))}
                placeholder="Select Status"
              />
            </div>
            <div className="ld-fgroup ld-full">
              <label>Description</label>
              <textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description..." />
            </div>
          </div>
        )}

        {tab === 'company' && (
          <div className="ld-fgroup"><label>Company Name</label>
            <input value={tmpl.companyName} onChange={e => setTmpl({ ...tmpl, companyName: e.target.value })} />
          </div>
        )}
        {tab === 'aboutUs' && (
          <div className="ld-fgroup"><label>About Us</label>
            <textarea rows={12} value={tmpl.aboutUs} onChange={e => setTmpl({ ...tmpl, aboutUs: e.target.value })} />
          </div>
        )}
        {tab === 'system' && (
          <div className="ld-fgroup"><label>About System</label>
            <textarea rows={12} value={tmpl.aboutSystem} onChange={e => setTmpl({ ...tmpl, aboutSystem: e.target.value })} />
          </div>
        )}
        {tab === 'payment' && (
          <div className="ld-fgroup"><label>Payment Terms</label>
            <textarea rows={12} value={tmpl.paymentTerms} onChange={e => setTmpl({ ...tmpl, paymentTerms: e.target.value })} />
          </div>
        )}
        {tab === 'dlp' && (
          <div className="ld-fgroup"><label>Defect Liability Period</label>
            <textarea rows={12} value={tmpl.defectLiabilityPeriod} onChange={e => setTmpl({ ...tmpl, defectLiabilityPeriod: e.target.value })} />
          </div>
        )}

        {tab === 'pricing' && (
          <div>
            <div className="ld-section-hdr"><span>System Pricing</span><button className="ld-btn ld-btn-sm ld-btn-sec" onClick={addPricing}>+ Add Row</button></div>
            <table className="ld-inner-table">
              <thead><tr><th>Item</th><th>Description</th><th>Amount (₹)</th><th style={{ width: 40 }}>×</th></tr></thead>
              <tbody>
                {tmpl.systemPricing.length === 0
                  ? <tr><td colSpan="4" style={{ textAlign: 'center', color: __stc('#9ca3af'), padding: '16px' }}>No items — click "+ Add Row"</td></tr>
                  : tmpl.systemPricing.map((row, i) => (
                    <tr key={i}>
                      <td><input value={row.item} onChange={e => updPricing(i, 'item', e.target.value)} placeholder="Item" /></td>
                      <td><input value={row.description} onChange={e => updPricing(i, 'description', e.target.value)} placeholder="Description" /></td>
                      <td><input type="number" value={row.amount} onChange={e => updPricing(i, 'amount', e.target.value)} placeholder="0.00" /></td>
                      <td><button className="ld-del-row" onClick={() => rmPricing(i)}>🗑</button></td>
                    </tr>
                  ))
                }
                {tmpl.systemPricing.length > 0 && (
                  <tr className="ld-total-row"><td colSpan="2" style={{ textAlign: 'right' }}>Total:</td><td>₹{tmpl.systemPricing.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(2)}</td><td /></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'bom' && (
          <div>
            <div className="ld-section-hdr"><span>Bill of Materials</span><button className="ld-btn ld-btn-sm ld-btn-sec" onClick={addBOM}>+ Add Row</button></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ld-inner-table ld-bom-tbl">
                <thead><tr><th>Item Name*</th><th>Spec</th><th>Qty</th><th>Unit</th><th>Rate(₹)</th><th>Tax%</th><th>Amount</th><th style={{ width: 40 }}>×</th></tr></thead>
                <tbody>
                  {tmpl.bomItems.length === 0
                    ? <tr><td colSpan="8" style={{ textAlign: 'center', color: __stc('#9ca3af'), padding: '16px' }}>No items — click "+ Add Row"</td></tr>
                    : <>
                      {tmpl.bomItems.map((row, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ position: 'relative' }}>
                              <input value={row.item}
                                onChange={e => { updBOM(i, 'item', e.target.value); handleBomSearch(i, e.target.value); }}
                                onFocus={() => { if (row.item?.length >= 2) handleBomSearch(i, row.item); }}
                                placeholder="Type to search..." />
                              {showBomDropdown[i] && filteredBomItems[i]?.length > 0 && (
                                <div className="ld-bom-drop">
                                  {filteredBomItems[i].map(bom => (
                                    <div key={bom.id} className="ld-bom-drop-item" onMouseDown={() => selectBomItem(i, bom)}>
                                      <strong>{bom.itemName}</strong>
                                      {bom.specification && <span style={{ fontSize: 11, color: __stc('#6b7280') }}>{bom.specification}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td><textarea value={row.specification} onChange={e => updBOM(i, 'specification', e.target.value)} rows={2} placeholder="Specs" /></td>
                          <td><input type="number" value={row.quantity} onChange={e => updBOM(i, 'quantity', e.target.value)} placeholder="0" /></td>
                          <td>
                            {customUnitInputs[i] !== undefined
                              ? <input type="text" value={customUnitInputs[i]} onChange={e => { setCustomUnitInputs(p => ({ ...p, [i]: e.target.value })); updBOM(i, 'unit', e.target.value); }} placeholder="Unit" />
                              : <FilterSelect
                                  value={row.unit || ''}
                                  onChange={v => { if (v === 'Custom') { setCustomUnitInputs(p => ({ ...p, [i]: '' })); updBOM(i, 'unit', ''); } else { const n = { ...customUnitInputs }; delete n[i]; setCustomUnitInputs(n); updBOM(i, 'unit', v); } }}
                                  options={[...COMMON_UNITS.map(u => ({ value: u, label: u })), { value: 'Custom', label: '✏️ Custom' }]}
                                  placeholder="Unit"
                                />
                            }
                          </td>
                          <td><input type="number" value={row.rate} onChange={e => updBOM(i, 'rate', e.target.value)} placeholder="0.00" /></td>
                          <td>
                            <FilterSelect
                              value={String(row.tax || '18')}
                              onChange={v => updBOM(i, 'tax', v)}
                              options={[{value:'0',label:'0%'},{value:'5',label:'5%'},{value:'12',label:'12%'},{value:'18',label:'18%'},{value:'28',label:'28%'}]}
                              placeholder="Tax"
                            />
                          </td>
                          <td><input type="number" value={row.amount} readOnly style={{ background: __sbg('#f9fafb'), fontWeight: 600 }} /></td>
                          <td><button className="ld-del-row" onClick={() => rmBOM(i)}>🗑</button></td>
                        </tr>
                      ))}
                      <tr className="ld-subtotal-row"><td colSpan="6" style={{ textAlign: 'right', fontWeight: 600 }}>Subtotal:</td><td style={{ fontWeight: 600 }}>₹{bomTotals().sub}</td><td /></tr>
                      <tr className="ld-subtotal-row"><td colSpan="6" style={{ textAlign: 'right', fontWeight: 600 }}>Tax:</td><td style={{ fontWeight: 600, color: __stc('#d97706') }}>₹{bomTotals().tax}</td><td /></tr>
                      <tr className="ld-total-row"><td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold' }}>Grand Total:</td><td style={{ fontWeight: 'bold', color: __stc('#059669') }}>₹{bomTotals().grand}</td><td /></tr>
                    </>
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="ld-pform-footer">
        <button className="ld-btn ld-btn-sec" onClick={onCancel}>Cancel</button>
        <button className="ld-btn ld-btn-pri" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : existingProposal ? 'Update Proposal' : 'Create Proposal'}</button>
      </div>
    </div>
  );
};

// ─── Overview Proposals Summary (shown in overview tab) ─────────────────────
// ── Bill File Preview Modal ────────────────────────────────────────────────────
function BillPreviewModal({ url, name, type, onClose }) {
  const [blobUrl, setBlobUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState(null);

  React.useEffect(() => {
    let objectUrl = null;
    const fetchBlob = async () => {
      try {
        setLoading(true); setError(null);
        const stored  = JSON.parse(localStorage.getItem('bd_portal_user') || '{}');
        const u       = stored?.user || stored || {};
        const resp    = await fetch(url, {
          headers: { 'User-Id': String(u.id || ''), 'User-Role': String(u.role || '') },
        });
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const blob = await resp.blob();
        objectUrl  = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBlob();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  const isPdf   = type?.includes('pdf') || name?.toLowerCase().endsWith('.pdf');
  const isImage = type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name || '');

  return (
    <div className="bill-preview-overlay" onClick={onClose}>
      <div className="bill-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="bill-preview-header">
          <span className="bill-preview-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {name}
          </span>
          <div className="bill-preview-actions">
            {blobUrl && (
              <>
                <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="bill-preview-btn bill-preview-btn--newtab">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Open in New Tab
                </a>
                <a href={blobUrl} download={name} className="bill-preview-btn bill-preview-btn--download">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </a>
              </>
            )}
            <button className="bill-preview-btn bill-preview-btn--close" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <div className="bill-preview-body">
          {loading && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:12,color:__stc('#6b7280')}}>
              <div className="bill-spinner"/>
              <span style={{fontSize:14}}>Loading file…</span>
            </div>
          )}
          {error && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,color:__stc('#dc2626')}}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="40" height="40"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <p style={{fontSize:14,margin:0}}>Failed to load file: {error}</p>
            </div>
          )}
          {!loading && !error && blobUrl && isPdf && (
            <iframe src={blobUrl} title={name} width="100%" height="100%" style={{border:'none'}} />
          )}
          {!loading && !error && blobUrl && isImage && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',padding:16}}>
              <img src={blobUrl} alt={name} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:8}} />
            </div>
          )}
          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,color:__stc('#6b7280')}}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              <p style={{fontSize:14,margin:0}}>Preview not available for this file type.</p>
              <a href={blobUrl} download={name} className="bill-preview-btn bill-preview-btn--download">⬇ Download File</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const OverviewProposalsSummary = ({ lead, currentUser, apiBase, onGoToProposals }) => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };
    fetch(`${apiBase}/proposals/getAll?page=0&size=100&groupName=${lead.groupName || ''}&subGroupName=${lead.subGroupName || ''}`, { credentials: 'include', headers })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const all = data.data.content || [];
          setProposals(all.filter(p => p.leadId === lead.id));
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [lead.id]);

  const totalValue = proposals.reduce((s, p) => s + (parseFloat(p.totalValue) || 0), 0);
  const approved = proposals.filter(p => p.status === 'Approved').length;
  const latestStatus = proposals.length > 0
    ? proposals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0].status
    : null;

  const getPropStatusClass = s => ({ Draft: 'ld-ps-draft', Sent: 'ld-ps-sent', Approved: 'ld-ps-approved', Rejected: 'ld-ps-rejected', 'On Hold': 'ld-ps-hold' }[s] || 'ld-ps-draft');

  if (loading) return null;
  if (proposals.length === 0) return (
    <div className="ld-overview-proposals ld-overview-proposals-empty">
      <div className="ld-ovp-icon">📝</div>
      <div className="ld-ovp-text">
        <span className="ld-ovp-label">Proposals</span>
        <span className="ld-ovp-sub">No proposals created yet</span>
      </div>
      <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToProposals}>Create Proposal</button>
    </div>
  );

  return (
    <div className="ld-overview-proposals">
      <div className="ld-ovp-header">
        <h4 className="ld-card-title" style={{ margin: 0 }}>Proposals Summary</h4>
        <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToProposals}>View All →</button>
      </div>
      <div className="ld-ovp-stats">
        <div className="ld-ovp-stat">
          <span className="ld-ovp-stat-val">{proposals.length}</span>
          <span className="ld-ovp-stat-label">Total</span>
        </div>
        <div className="ld-ovp-stat ld-ovp-stat-money">
          <span className="ld-ovp-stat-val">₹{totalValue.toLocaleString('en-IN')}</span>
          <span className="ld-ovp-stat-label">Cumulative Value</span>
        </div>
        <div className="ld-ovp-stat">
          <span className="ld-ovp-stat-val">{approved}</span>
          <span className="ld-ovp-stat-label">Approved</span>
        </div>
        {latestStatus && (
          <div className="ld-ovp-stat">
            <span className={`ld-proposal-status ${getPropStatusClass(latestStatus)}`} style={{ fontSize: 11 }}>{latestStatus}</span>
            <span className="ld-ovp-stat-label">Latest Status</span>
          </div>
        )}
      </div>
      {proposals.length > 0 && (() => {
        const latest = [...proposals].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
        return (
          <div className="ld-ovp-latest">
            <span className="ld-ovp-latest-label">Latest:</span>
            <span className="ld-proposal-no" style={{ fontSize: 10 }}>{latest.proposalNo}</span>
            <span className="ld-ovp-latest-title">{latest.title}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: __stc('#6b7280') }}>₹{parseFloat(latest.totalValue || 0).toLocaleString('en-IN')}</span>
          </div>
        );
      })()}
    </div>
  );
};

// ─── TenderDocumentsTab ──────────────────────────────────────────────────────
// Dedicated Documents tab for Tender leads — upload, view, download, delete PDFs
// Uses the same /proposals/* API as the offline proposal mechanism, but surfaced
// as "documents" so it's semantically correct for tenders.
const TenderDocumentsTab = ({ lead, currentUser, permissions, showSuccess, showError }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadPanel, setUploadPanel] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pdfModal, setPdfModal] = useState({ open: false, url: null, name: null });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/getAll?page=0&size=100&groupName=${lead.groupName || ''}&subGroupName=${lead.subGroupName || ''}`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) {
        const all = data.data.content || [];
        // Only show docs for this lead that are "offline" (i.e. actual uploaded PDFs)
        setDocs(all.filter(p => (p.leadId === lead.id || p.leadCode === lead.leadCode) && p.offlinePdfName));
      }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, [lead.id]);

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { showError('Please enter a document title'); return; }
    if (!uploadFile) { showError('Please select a PDF file'); return; }
    if (!uploadFile.name.toLowerCase().endsWith('.pdf')) { showError('Only PDF files allowed'); return; }
    if (uploadFile.size > 50 * 1024 * 1024) { showError('File too large — max 50 MB'); return; }
    setUploading(true);
    let newId = null;
    try {
      const body = JSON.stringify({
        title: uploadTitle.trim(), leadId: lead.id, status: 'Draft',
        groupName: lead.groupName || '', subGroupName: lead.subGroupName || '',
        totalValue: 0, description: 'Tender document',
      });
      const createRes = await fetch(`${API_BASE_URL}/proposals/create`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
        body,
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error || 'Failed to create doc entry');
      newId = createData.data?.id;
      const form = new FormData();
      form.append('file', uploadFile);
      const upRes = await fetch(`${API_BASE_URL}/proposals/${newId}/upload-offline`, {
        method: 'POST', credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
        body: form,
      });
      const upData = await upRes.json();
      if (!upData.success) throw new Error(upData.error || 'PDF upload failed');
      showSuccess('Document uploaded!');
      setUploadPanel(false); setUploadTitle(''); setUploadFile(null);
      fetchDocs();
    } catch (err) {
      if (newId) {
        try { await fetch(`${API_BASE_URL}/proposals/delete/${newId}`, { method: 'DELETE', credentials: 'include', headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role } }); } catch { /* cleanup */ }
      }
      showError(err.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleView = async (doc) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/${doc.id}/view-offline`, {
        credentials: 'include', headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
      });
      if (!res.ok) throw new Error('PDF not found');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfModal({ open: true, url, name: doc.title || doc.offlinePdfName });
    } catch (err) { showError('Failed to load: ' + (err.message || 'Server error')); }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/${doc.id}/view-offline`, {
        credentials: 'include', headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
      });
      if (!res.ok) throw new Error('PDF not found');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.offlinePdfName || `${doc.title}.pdf`; a.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) { showError('Download failed: ' + (err.message || 'Server error')); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/delete/${id}`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
      });
      const data = await res.json();
      if (data.success) { showSuccess('Document deleted.'); fetchDocs(); }
      else showError(data.error || 'Delete failed');
    } catch { showError('Delete failed'); }
  };

  return (
    <div className="ld-tab-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h4 className="ld-card-title" style={{ margin: 0 }}>Tender Documents</h4>
        {permissions.PROPOSAL_CREATE && (
          <button className="ld-btn ld-btn-pri ld-btn-sm" onClick={() => setUploadPanel(p => !p)}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {uploadPanel ? 'Cancel' : 'Upload Document'}
          </button>
        )}
      </div>

      {uploadPanel && (
        <div style={{ background: __sbg('#f0f9ff'), border: `1.5px solid ${__sbg('#bae6fd')}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: __stc('#0369a1'), fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            📎 Upload New Document
          </div>
          <div className="ld-form-grid">
            <div className="ld-fgroup ld-full">
              <label style={{ fontSize: 12, fontWeight: 600, color: __stc('#374151'), display: 'block', marginBottom: 4 }}>Document Title *</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="e.g. Tender Notice, Bid Document, EMD Receipt…"
                style={{ width: '100%', padding: '8px 12px', border: `1.5px solid ${__sbg('#d1d5db')}`, borderRadius: 7, fontSize: 13, background: __sbg('#fff'), color: __stc('#111827'), boxSizing: 'border-box' }}
              />
            </div>
            <div className="ld-fgroup ld-full">
              <label style={{ fontSize: 12, fontWeight: 600, color: __stc('#374151'), display: 'block', marginBottom: 4 }}>PDF File *</label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                border: '1.5px dashed ' + (uploadFile ? __sbg('#0369a1') : __sbg('#93c5fd')),
                borderRadius: 7, padding: '8px 12px', background: uploadFile ? __sbg('#eff6ff') : __sbg('#f0f9ff'),
                fontSize: 13, color: uploadFile ? __stc('#0369a1') : __stc('#2563eb'), fontWeight: 500
              }}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <span>{uploadFile ? uploadFile.name : 'Choose PDF file…'}</span>
                <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0] || null)} />
              </label>
              {uploadFile && <div style={{ fontSize: 11, color: __stc('#0369a1'), marginTop: 4 }}>✓ {uploadFile.name} selected</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={() => { setUploadPanel(false); setUploadTitle(''); setUploadFile(null); }}>Cancel</button>
            <button className="ld-btn ld-btn-pri ld-btn-sm" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : '⬆ Upload Document'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ld-loading-row"><div className="p-loading-spinner"></div> Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className="ld-empty-state">
          <div className="ld-empty-icon">📁</div>
          <p>No documents uploaded yet.</p>
          <p style={{ fontSize: 12, color: __stc('#9ca3af') }}>Upload tender notices, bid documents, EMD receipts, extension letters, etc.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {docs.map((doc, i) => (
            <div key={doc.id} style={{
              background: __sbg('#fff'), border: `1px solid ${__sbg('#e5e7eb')}`,
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 38, height: 38, background: __sbg('#eff6ff'), borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg fill="none" stroke={__stc('#2563eb')} viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: __stc('#111827'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {doc.title || doc.offlinePdfName}
                </div>
                <div style={{ fontSize: 11, color: __stc('#6b7280'), marginTop: 2 }}>
                  {doc.offlinePdfName && <span>📎 {doc.offlinePdfName} &nbsp;</span>}
                  {doc.createdAt && <span>· {fmtDate(doc.createdAt)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleView(doc)} className="ld-pact-btn" title="View PDF">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  View
                </button>
                <button onClick={() => handleDownload(doc)} className="ld-pact-btn ld-pact-offline-dl" title="Download">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
                {permissions.PROPOSAL_DELETE && (
                  <button onClick={() => setDeleteConfirm({ id: doc.id, title: doc.title })} className="ld-pact-btn ld-pact-delete" title="Delete">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Viewer Modal */}
      {pdfModal.open && (
        <div className="ld-pdf-modal-overlay" onClick={() => { setPdfModal({ open: false, url: null, name: null }); if (pdfModal.url) window.URL.revokeObjectURL(pdfModal.url); }}>
          <div className="ld-pdf-modal" onClick={e => e.stopPropagation()}>
            <div className="ld-pdf-modal-header">
              <span className="ld-pdf-modal-title">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                {pdfModal.name}
              </span>
              <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={() => { setPdfModal({ open: false, url: null, name: null }); if (pdfModal.url) window.URL.revokeObjectURL(pdfModal.url); }}>✕ Close</button>
            </div>
            <div className="ld-pdf-modal-body">
              <iframe src={pdfModal.url} title={pdfModal.name} width="100%" height="100%" style={{ border: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmationModal
          show={true}
          type="alert"
          title="Delete Document"
          message={`Delete "${deleteConfirm.title}"? This cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

// Overview card header: a tinted icon badge next to the title. Icon is a
// lucide component; sizing/colour live in .ld-card-ico so the badge stays
// consistent across every card.
const CardHead = ({ icon: Icon, children }) => (
  <div className="ld-card-head">
    <span className="lead-card-ico"><Icon size={17} strokeWidth={2} /></span>
    <h4 className="ld-card-title">{children}</h4>
  </div>
);

// ─── Lead Detail Page (full-page view inside leads container) ─────────────────
const LeadDetailPage = ({ lead, currentUser, onBack, onLeadUpdated, permissions, onEdit, showSuccess, showError }) => {
  useThemeVersion();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('leads_detail_tab') || 'overview');
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [followupModal, setFollowupModal] = useState(false);
  const [timelineModal, setTimelineModal] = useState(false);
  const [pdfModal, setPdfModal] = useState({ open: false, url: null, name: null });
  const [deleteProposalConfirm, setDeleteProposalConfirm] = useState(null); // { id, proposalNo }
  // One generated version, not the whole proposal: { id, proposalNo, version, isLatest }
  const [deleteVersionConfirm, setDeleteVersionConfirm] = useState(null);
  const [billPreview, setBillPreview] = useState(null); // { url, name, type }
  const [uploadingId, setUploadingId] = useState(null);
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);
  const [offlineTitle, setOfflineTitle] = useState('');
  const [offlineFile, setOfflineFile] = useState(null);
  const [offlineTotalValue, setOfflineTotalValue] = useState('');
  const [offlineStatus, setOfflineStatus] = useState('Draft');
  const [offlineUploading, setOfflineUploading] = useState(false);
  // Solar proposal generation: { open, proposalId } — proposalId null = new record.
  const [generateProposal, setGenerateProposal] = useState(null);
  // proposalId -> [{ version, fileName, generatedAt, generatedByName }]
  const [proposalDocs, setProposalDocs] = useState({});
  // Generated-proposal preview: { open, loading, blob, unavailable, error, title,
  // version, proposalId, fileName }. `blob` holds the PDF rendition; the .docx is
  // only ever fetched on demand by Download.
  const [docViewer, setDocViewer] = useState({ open: false });
  // Monotonic request id — guards against an older, slower response overwriting a
  // newer one when the user clicks through versions quickly.
  const docReqRef = useRef(0);
  const isSolar = isSolarLead(lead);

  // ── Lead access: user has direct access if they are the assignee, creator,
  //    BD executive on this lead, or have admin/manager level permissions
  const hasLeadAccess = !!(
    permissions.EDIT ||                                         // admins / managers
    (lead.assignedTo   && Number(lead.assignedTo)   === Number(currentUser.id)) ||
    (lead.createdBy    && Number(lead.createdBy)    === Number(currentUser.id)) ||
    (lead.bdAssignedTo && Number(lead.bdAssignedTo) === Number(currentUser.id))
  );

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

  // ── BD reassignment: change or remove the BD executive on this lead ────────
  const canAssignBd = !!(permissions.ASSIGN || permissions.EDIT);
  const [bdExecs, setBdExecs] = useState([]);
  const [bdBusy, setBdBusy] = useState(false);

  useEffect(() => {
    if (!canAssignBd) return;
    fetch(`${API_BASE_URL}/filters/bd-executives`, { credentials: 'include', headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBdExecs(d); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignBd]);

  // bdIdOrNull: a user id to (re)assign, or null to remove the current BD.
  const handleBdChange = async (bdIdOrNull) => {
    setBdBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/bd`, {
        method: 'PUT', credentials: 'include', headers,
        body: JSON.stringify({ bdAssignedTo: bdIdOrNull }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        showSuccess(bdIdOrNull == null ? 'BD executive removed' : 'BD executive updated');
        if (onLeadUpdated) onLeadUpdated();
      } else {
        showError(d.message || 'Failed to update BD executive');
      }
    } catch {
      showError('Failed to update BD executive');
    } finally {
      setBdBusy(false);
    }
  };

  const fetchProposals = useCallback(async () => {
    setLoadingProposals(true);
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/getAll?page=0&size=50&groupName=${lead.groupName || ''}&subGroupName=${lead.subGroupName || ''}`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) {
        const all = data.data.content || [];
        setProposals(all.filter(p => p.leadId === lead.id || p.leadCode === lead.leadCode));
      }
    } catch { showError('Failed to load proposals'); }
    finally { setLoadingProposals(false); }
  }, [lead.id]);

  // Auto-advance lead status to "Proposal Sent" whenever a proposal is created
  // or an offline PDF is attached — but only if the lead hasn't already moved
  // to a later stage (Closed Won / Closed Lost / Proposal Sent already set).
  const markProposalSent = async () => {
    const skip = ['Proposal Sent', 'Closed Won', 'Closed Lost'];
    if (skip.includes(lead.status)) return;
    try {
      await fetch(`${API_BASE_URL}/leads/update/${lead.id}`, {
        method: 'PUT', credentials: 'include',
        headers,
        // Send only the status change — posting the whole wrapper object back
        // (computed/echo fields) risks the backend rejecting the update.
        body: JSON.stringify({ status: 'Proposal Sent' }),
      });
      if (onLeadUpdated) onLeadUpdated();
    } catch { /* non-blocking — proposal was still saved */ }
  };

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/history`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch { }
    finally { setLoadingHistory(false); }
  }, [lead.id]);

  // Reasons for a closed lead are surfaced at the top of the Overview tab. The
  // "Not Interested" reason lives on the lead itself (telecallerReason), but the
  // "Closed Lost" reason is only ever written to lead history — so the Overview
  // tab needs history loaded too when the lead is in a closed state.
  const isClosedLost     = lead.status === 'Closed Lost';
  const isNotInterested  = lead.status === 'Not Interested';
  const isClosedLead     = isClosedLost || isNotInterested;

  useEffect(() => {
    if (activeTab === 'proposals') fetchProposals();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'overview' && isClosedLead) fetchHistory();
  }, [activeTab, isClosedLead]);   // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPDF = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/download-pdf/${id}`, { credentials: 'include', headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `proposal-${id}.pdf`; a.click(); window.URL.revokeObjectURL(url);
    } catch { showError('Failed to download PDF'); }
  };

  // ── Generated Solar proposal documents (versioned Word files) ─────────────

  const fetchProposalDocs = useCallback(async (ids) => {
    const wanted = (ids || []).filter(Boolean);
    if (!wanted.length) return;
    try {
      const results = await Promise.all(wanted.map(async id => {
        const res = await fetch(`${API_BASE_URL}/proposals/${id}/documents`, { credentials: 'include', headers });
        const data = await res.json().catch(() => ({}));
        return [id, data.success ? (data.data || []) : []];
      }));
      setProposalDocs(prev => ({ ...prev, ...Object.fromEntries(results) }));
    } catch { /* the cards just fall back to "no document yet" */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which proposals have a generated Word document (and how many versions).
  useEffect(() => {
    if (!isSolar || !proposals.length) return;
    fetchProposalDocs(proposals.map(p => p.id));
  }, [isSolar, proposals, fetchProposalDocs]);

  /** The .docx — always the deliverable, and always what Download hands over. */
  const fetchProposalDocxBlob = async (proposalId, version) => {
    const qs = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/documents/download${qs}`,
      { credentials: 'include', headers });
    if (!res.ok) throw new Error();
    return res.blob();
  };

  const saveBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    // Deferred: Firefox/Safari can drop a large download if the URL is revoked
    // the instant the click is dispatched.
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const downloadProposalDoc = async (proposalId, version, fileName) => {
    try {
      const blob = await fetchProposalDocxBlob(proposalId, version);
      saveBlob(blob, fileName || `proposal-${proposalId}-v${version || 'latest'}.docx`);
    } catch { showError('Failed to download the proposal document'); }
  };

  /**
   * Fetch the PDF rendition for preview.
   * 409 = this version exists but can never have a PDF (no stored payload) — the
   * viewer shows its "no preview" state rather than an error.
   */
  const fetchProposalPdfBlob = async (proposalId, version) => {
    const qs = version ? `?version=${version}` : '';
    const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/documents/pdf${qs}`,
      { credentials: 'include', headers });
    if (res.status === 409) return null;
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!blob.size) return null;
    // A blob URL typed application/octet-stream DOWNLOADS instead of rendering,
    // which looks exactly like the feature being broken.
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  };

  /**
   * Save the PDF rendition. Same endpoint the preview uses — the file is named
   * from the .docx with its extension swapped, so a proposal's two renditions
   * land side by side in the downloads folder.
   *
   * A null blob means 409: this version predates the PDF feature AND has no
   * stored payload to re-render from, so it can never have one. Say that rather
   * than writing a 0-byte file.
   */
  const downloadProposalPdf = async (proposalId, version, fileName) => {
    try {
      const blob = await fetchProposalPdfBlob(proposalId, version);
      if (!blob) {
        showError('This version has no PDF — download the Word file, or re-generate to get one.');
        return;
      }
      const base = (fileName || `proposal-${proposalId}-v${version || 'latest'}.docx`);
      saveBlob(blob, base.replace(/\.docx$/i, '') + '.pdf');
    } catch { showError('Failed to download the proposal PDF'); }
  };

  // The modal fetches through JS rather than pointing an iframe at the endpoint:
  // it requires the User-Id/User-Role headers, and <iframe src> cannot send them.
  const viewProposalDoc = async (proposalId, version, fileName, title) => {
    const seq = ++docReqRef.current;
    setDocViewer({
      open: true, loading: true, blob: null, unavailable: false, error: null,
      title: title || fileName || 'Proposal document',
      version, proposalId, fileName,
    });
    try {
      const blob = await fetchProposalPdfBlob(proposalId, version);
      // Two guards, not one: res.blob() is a second await, so a large body can
      // still be streaming when a newer click has already fully landed. Without
      // the second check, clicking v3 then v1 can show v3 under the v1 header.
      if (seq !== docReqRef.current) return;
      setDocViewer(v => (v.open
        ? { ...v, loading: false, blob, unavailable: !blob }
        : v));
    } catch {
      if (seq !== docReqRef.current) return;
      setDocViewer(v => (v.open
        ? { ...v, loading: false, error: 'Could not load this preview.' }
        : v));
    }
  };

  // After a generate: show the new version straight away (the PDF is rendered in
  // the same transaction, so it is already there), and refresh the list behind it.
  const handleProposalGenerated = async (result) => {
    viewProposalDoc(result.proposalId, result.version, result.fileName,
                    result.fileName || `${lead.name} — proposal`);
    await fetchProposals();
    await fetchProposalDocs([result.proposalId]);
    if (result.version === 1) markProposalSent();
    else if (onLeadUpdated) onLeadUpdated();
  };

  const handleUploadOffline = async (proposalId, file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { showError('Only PDF files are allowed'); return; }
    if (file.size > 50 * 1024 * 1024) { showError('File too large. Maximum allowed size is 50 MB.'); return; }
    setUploadingId(proposalId);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/upload-offline`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
        body: form,
      });
      const data = await res.json();
      if (data.success) { showSuccess('Offline proposal uploaded!'); fetchProposals(); markProposalSent(); }
      else showError(data.error || 'Upload failed');
    } catch { showError('Upload failed'); }
    finally { setUploadingId(null); }
  };

  const handleViewOffline = async (proposalId, proposalName) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/view-offline`, {
        credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
      });
      if (!res.ok) throw new Error('PDF not found');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfModal({ open: true, url, name: proposalName || 'Offline Proposal' });
    } catch (err) { showError('Failed to load PDF: ' + (err.message || 'Server error')); }
  };

  const handleDownloadOffline = async (proposalId, fileName) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/view-offline`, {
        credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
      });
      if (!res.ok) throw new Error('PDF not found');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName || 'offline-proposal.pdf'; a.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) { showError('Failed to download: ' + (err.message || 'Server error')); }
  };

  const handleDeleteProposal = (proposalId, proposalNo) => {
    setDeleteProposalConfirm({ id: proposalId, proposalNo });
  };

  const confirmDeleteProposal = async () => {
    if (!deleteProposalConfirm) return;
    const { id } = deleteProposalConfirm;
    setDeleteProposalConfirm(null);
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/delete/${id}`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
      });
      const data = await res.json();
      if (data.success) { showSuccess('Proposal deleted.'); fetchProposals(); if (onLeadUpdated) onLeadUpdated(); }
      else showError(data.error || 'Delete failed');
    } catch { showError('Delete failed'); }
  };

  /**
   * Delete one generated version. Removing the latest rolls the proposal back to
   * the version below it — the earlier files were sent to the client and are the
   * proposal's history, so they stay. The backend refuses the last one standing;
   * that is what deleting the proposal is for.
   */
  const confirmDeleteVersion = async () => {
    if (!deleteVersionConfirm) return;
    const { id, version } = deleteVersionConfirm;
    setDeleteVersionConfirm(null);
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/${id}/documents/${version}`, {
        method: 'DELETE', credentials: 'include', headers,
      });
      const data = await res.json();
      if (!data.success) { showError(data.message || 'Failed to delete this version'); return; }
      showSuccess(data.message || `v${version} deleted.`);
      fetchProposalDocs([id]);
      fetchProposals();
    } catch { showError('Failed to delete this version'); }
  };

  // Create a minimal proposal record then upload the offline PDF to it
  const handleUploadOfflineNew = async () => {
    if (!offlineTitle.trim()) { showError('Please enter a proposal title'); return; }
    if (!offlineFile) { showError('Please select a PDF file'); return; }
    if (!offlineFile.name.toLowerCase().endsWith('.pdf')) { showError('Only PDF files are allowed'); return; }
    if (offlineFile.size > 50 * 1024 * 1024) { showError('File too large. Maximum allowed size is 50 MB.'); return; }
    setOfflineUploading(true);
    let newId = null;
    try {
      const body = JSON.stringify({
        title: offlineTitle.trim(), leadId: lead.id, status: offlineStatus || 'Draft',
        groupName: lead.groupName || '', subGroupName: lead.subGroupName || '',
        totalValue: parseFloat(offlineTotalValue) || 0, description: 'Offline proposal uploaded',
      });
      const createRes = await fetch(`${API_BASE_URL}/proposals/create`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
        body,
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error || 'Failed to create proposal');
      newId = createData.data?.id;
      if (!newId) throw new Error('No proposal ID returned');
      const form = new FormData();
      form.append('file', offlineFile);
      const upRes = await fetch(`${API_BASE_URL}/proposals/${newId}/upload-offline`, {
        method: 'POST', credentials: 'include',
        headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
        body: form,
      });
      const upData = await upRes.json();
      if (!upData.success) throw new Error(upData.error || 'PDF upload failed');
      showSuccess('Offline proposal uploaded successfully!');
      setShowOfflinePanel(false); setOfflineTitle(''); setOfflineFile(null); setOfflineTotalValue(''); setOfflineStatus('Draft');
      fetchProposals();
      markProposalSent();
    } catch (err) {
      // If upload failed after proposal was created, delete the orphan proposal record
      if (newId) {
        try {
          await fetch(`${API_BASE_URL}/proposals/${newId}`, {
            method: 'DELETE', credentials: 'include',
            headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
          });
        } catch { /* silent — cleanup best-effort */ }
      }
      showError(err.message || 'Upload failed');
    }
    finally { setOfflineUploading(false); }
  };

  const getStatusClass = s => ({
    'New': 'leads-enquiries-badge-new', 'Proposal Sent': 'leads-enquiries-badge-proposal',
    'Closed Won': 'leads-enquiries-badge-won', 'Closed Lost': 'leads-enquiries-badge-lost',
    'Interested': 'leads-enquiries-badge-won', 'Not Interested': 'leads-enquiries-badge-lost',
    'Not Responded': 'leads-enquiries-badge-default', 'Prospect': 'leads-enquiries-badge-prospect',
    'Keep in View': 'leads-enquiries-badge-kiv',
  }[s] || 'leads-enquiries-badge-default');

  const getPriorityClass = p => ({ 'High': 'leads-enquiries-badge-high', 'Medium': 'leads-enquiries-badge-medium', 'Low': 'leads-enquiries-badge-low' }[p] || 'leads-enquiries-badge-default');

  const getPropStatusClass = s => ({ Draft: 'ld-ps-draft', Sent: 'ld-ps-sent', Approved: 'ld-ps-approved', Rejected: 'ld-ps-rejected', 'On Hold': 'ld-ps-hold' }[s] || 'ld-ps-draft');

  const HISTORY_CONFIG = {
    STATUS_CHANGE:        { icon: '🔄', label: 'Status Changed',           color: __stc('#6366f1'), bg: __sbg('#eef2ff') },
    LEAD_UPDATED:         { icon: '✏️',  label: 'Lead Updated',             color: __stc('#0284c7'), bg: __sbg('#e0f2fe') },
    FOLLOW_UP:            { icon: '📅', label: 'Follow-up Added',           color: __stc('#059669'), bg: __sbg('#ecfdf5') },
    FOLLOWUP_ADDED:       { icon: '📅', label: 'Follow-up Scheduled',       color: __stc('#059669'), bg: __sbg('#ecfdf5') },
    FOLLOWUP_COMPLETED:   { icon: '✅', label: 'Follow-up Completed',       color: __stc('#16a34a'), bg: __sbg('#f0fdf4') },
    FOLLOWUP_DELETED:     { icon: '🗑', label: 'Follow-up Deleted',         color: __stc('#dc2626'), bg: __sbg('#fef2f2') },
    DIRECT_INTERACTION:   { icon: '⚡', label: 'Direct Interaction',        color: __stc('#d97706'), bg: __sbg('#fffbeb') },
    SITE_VISIT_ADDED:     { icon: '🏠', label: 'Site Visit Recorded',       color: __stc('#d97706'), bg: __sbg('#fffbeb') },
    PROPOSAL_CREATED:     { icon: '📝', label: 'Proposal Created',          color: __stc('#7c3aed'), bg: __sbg('#f5f3ff') },
    PROPOSAL_SENT:        { icon: '📤', label: 'Proposal Sent',             color: __stc('#7c3aed'), bg: __sbg('#f5f3ff') },
    CREATED:              { icon: '✅', label: 'Lead Created',              color: __stc('#16a34a'), bg: __sbg('#f0fdf4') },
    UPDATED:              { icon: '✏️',  label: 'Updated',                  color: __stc('#0284c7'), bg: __sbg('#e0f2fe') },
    CLOSED_LOST_REASON:   { icon: '❌', label: 'Closed — Lost',             color: __stc('#dc2626'), bg: __sbg('#fef2f2') },
    CLOSED_WON:           { icon: '🏆', label: 'Closed — Won',              color: __stc('#ca8a04'), bg: __sbg('#fefce8') },
    CONVERTED:            { icon: '🎉', label: 'Converted to Customer',     color: __stc('#ca8a04'), bg: __sbg('#fefce8') },
    CONVERTED_TO_CUSTOMER:{ icon: '🎉', label: 'Converted to Customer',     color: __stc('#ca8a04'), bg: __sbg('#fefce8') },
    ASSIGNED:             { icon: '👤', label: 'Assigned',                  color: __stc('#0284c7'), bg: __sbg('#e0f2fe') },
    NOTE_ADDED:           { icon: '💬', label: 'Note Added',                color: __stc('#64748b'), bg: __sbg('#f8fafc') },
    TELECALLER_UPDATE:    { icon: '📞', label: 'Telecaller Update',         color: __stc('#db2777'), bg: __sbg('#fdf2f8') },
    TELECALLER_STATUS_CHANGE: { icon: '📞', label: 'Telecaller Update',     color: __stc('#db2777'), bg: __sbg('#fdf2f8') },
    STATUS_CHANGED:       { icon: '🔄', label: 'Status Changed',            color: __stc('#6366f1'), bg: __sbg('#eef2ff') },
  };
  const getHistoryIcon = type => (HISTORY_CONFIG[type] || { icon: '📋' }).icon;

  // Build a compact human-readable summary for each history entry
  const getHistorySummary = h => {
    if (h.description && h.description.trim()) return h.description.trim();
    if (h.fieldChanged && (h.oldValue || h.newValue)) {
      const field = h.fieldChanged.replace(/_/g, ' ');
      if (h.oldValue && h.newValue) return `${field}: "${h.oldValue}" → "${h.newValue}"`;
      if (h.newValue) return `${field} set to "${h.newValue}"`;
      if (h.oldValue) return `${field} cleared (was "${h.oldValue}")`;
    }
    const cfg = HISTORY_CONFIG[h.actionType];
    return cfg ? cfg.label : (h.actionType?.replace(/_/g, ' ') || 'Activity recorded');
  };

  return (
    <div className="ld-detail-page">
      <div className="ld-detail-topbar">
        <button className="ld-back-btn" onClick={onBack}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Leads
        </button>
        <div className="ld-detail-breadcrumb">
          <span style={{ cursor: 'pointer', color: __stc('#6b7280') }} onClick={onBack}>Leads</span>
          <span style={{ margin: '0 6px', color: __stc('#d1d5db') }}>/</span>
          <span style={{ color: __stc('#111827'), fontWeight: 500 }}>{lead.leadCode}</span>
        </div>
        {permissions.EDIT && (
          <button className="leads-enquiries-btn leads-enquiries-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => onEdit(lead)}>
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit Lead
          </button>
        )}
      </div>

      <div className="ld-hero">
        <div className="ld-hero-left">
          <div className="ld-hero-avatar">{lead.name?.[0]?.toUpperCase() || '?'}</div>
          <div>
            <h2 className="ld-hero-name">{lead.name}</h2>
            <div className="ld-hero-code">{lead.leadCode}</div>
          </div>
        </div>
        <div className="ld-hero-badges">
          <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>{lead.priority}</span>
          <span className={`leads-enquiries-badge ${getStatusClass(getUnifiedStatus(lead))}`}>{getUnifiedStatus(lead)}</span>
          {getUnifiedStatus(lead) === 'Closed Won' && lead.closedByName && (
            <span title="Closed by" style={{fontSize:11,fontWeight:600,color:__stc('#15803d'),background:__sbg('#f0fdf4'),border:`1px solid ${__sbg('#bbf7d0')}`,borderRadius:20,padding:'3px 10px',whiteSpace:'nowrap'}}>
              ✓ by {lead.closedByName}
            </span>
          )}
        </div>
        <div className="ld-hero-actions">
          {permissions.CREATE && (
            <>
              <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => { setActiveTab('followups'); setFollowupModal(false); }}>
                <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Add Follow-up
              </button>
              {isSolar ? (
                /* Solar: the client proposal is generated from this lead's tabs
                   into the approved Word template — there is no second path. */
                <button className="leads-enquiries-btn leads-enquiries-btn-primary"
                  onClick={() => { setActiveTab('proposals'); setShowProposalForm(false); setGenerateProposal({ proposalId: null }); }}>
                  <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Generate Proposal
                </button>
              ) : (
                <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => { setActiveTab('proposals'); setShowProposalForm(true); setEditingProposal(null); }}>
                  <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  New Proposal
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {generateProposal && (
        <GenerateProposalModal
          open
          lead={lead}
          currentUser={currentUser}
          proposalId={generateProposal.proposalId}
          onClose={() => setGenerateProposal(null)}
          onGenerated={handleProposalGenerated}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* ── Tab navigation ───────────────────────────────────────────────────
          One row, every tab, in the original order. Each tab is drawn as a
          chevron that nests into the next so the selected one reads as an arrow.

          A tab's appearance depends ONLY on whether it is selected. Per-tab
          completion state (has a site visit / a BOM / a budget) is deliberately
          not modelled — GET /leads/{id} does not report it and this component
          holds no state for it. Adding it later is a class on the button below,
          not a restructure.                                                     */}
      {(() => {
        const go = k => { setActiveTab(k); setShowProposalForm(false); localStorage.setItem('leads_detail_tab', k); };

        const tabs = [
          { k: 'overview',  l: 'Overview',        i: LayoutDashboard },
          { k: 'sitevisit', l: 'Site visit',      i: MapPin },
          // Scope → BOM → Budget, in the order they're worked through.
          ...(permissions?.EDIT ? [
            { k: 'techscope', l: 'Technical scope', i: ClipboardList },
            { k: 'bom',       l: 'BOM',             i: Package },
            { k: 'budget',    l: 'Budget',          i: Wallet },
          ] : []),
          { k: 'proposals', l: 'Proposals',       i: FileText },
          ...(isTenderLead(lead) ? [{ k: 'documents', l: 'Documents', i: FolderOpen }] : []),
          { k: 'followups', l: 'Follow-ups',      i: Repeat },
          { k: 'history',   l: 'History',         i: HistoryIcon },
        ];

        return (
          <div className="ld-tabnav">
            <div className="ld-pipe">
              {tabs.map(t => {
                const Ico = t.i;
                return (
                  <button key={t.k} type="button"
                    className={`ld-pipe-step${activeTab === t.k ? ' active' : ''}`}
                    aria-current={activeTab === t.k ? 'true' : undefined}
                    title={t.l}
                    onClick={() => go(t.k)}>
                    <Ico className="ld-pipe-ico" size={14} strokeWidth={2} aria-hidden="true" />
                    <span className="ld-pipe-label">{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {activeTab === 'overview' && (
        <div className="ld-tab-content">
          {/* Closed-lead callout — sits ABOVE Contact Information because once a
              lead is Closed Lost / Not Interested the reason is the only thing
              anyone needs; the rest of the detail is no longer actionable. */}
          {isClosedLead && (() => {
            const reason = isClosedLost
              ? (history.find(h => h.actionType === 'CLOSED_LOST_REASON')?.newValue || '')
              : (lead.telecallerReason
                 || history.find(h => h.actionType === 'NOT_INTERESTED_REASON')?.newValue
                 || '');
            return (
              <div className="ld-closed-banner"
                   style={{ background: __sbg('#fef2f2'), border: `1.5px solid ${__sbg('#fecaca')}`, borderLeft: `4px solid ${__sbg('#dc2626')}` }}>
                <h4 className="ld-card-title" style={{ color: __stc('#b91c1c'), margin: 0 }}>
                  {isClosedLost ? '❌ Closed Lost — Reason' : '🚫 Not Interested — Reason'}
                </h4>
                <p className="ld-enquiry-text" style={{ marginTop: 6, marginBottom: 0, color: __stc('#374151') }}>
                  {reason || (loadingHistory ? 'Loading reason…' : 'No reason was recorded for this lead.')}
                </p>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: __stc('#b91c1c') }}>
                  This lead is closed — no further follow-up is needed.
                </div>
              </div>
            );
          })()}

          <div className="ld-info-grid">
            <div className="ld-info-card">
              <CardHead icon={User}>Contact Information</CardHead>
              <div className="ld-field-list">
                {[
                  ['Email', lead.email || '-'],
                  ['Phone', lead.phone || '-'],
                  ['Source', lead.source || '-'],
                  ...(lead.source === 'Referral' ? [
                    ['Referred By', lead.referralName || '-'],
                    ['Referrer Phone', lead.referralPhone || '-'],
                  ] : []),
                  ['Group', lead.groupName || '-'],
                  ['Category', lead.subGroupName || '-'],
                  ...(lead.capacity ? [['Project Capacity', `${lead.capacity} ${lead.capacityUnit || 'kW'}`]] : []),
                ].map(([l, v]) => (
                  <div className="ld-field-row" key={l}>
                    <span className="ld-field-label">{l}</span>
                    <span className="ld-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ld-info-card">
              <CardHead icon={Calendar}>Assignment &amp; Dates</CardHead>
              <div className="ld-field-list">
                {[
                  ['Lead Owner', lead.leadOwner || '-'],
                  ['Assigned To', lead.assignedToName || '-'],
                  ['Created By', lead.createdByName || '-'],
                  ['Created At', lead.createdAt ? fmtDate(lead.createdAt) : '-'],
                  ['Updated At', lead.updatedAt ? fmtDate(lead.updatedAt) : '-'],
                  ...(lead.status === 'Closed Won' ? [['Closed By', lead.closedByName || '-']] : []),
                ].map(([l, v]) => (
                  <div className="ld-field-row" key={l}>
                    <span className="ld-field-label">{l}</span>
                    <span className="ld-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Address card — show only if address data exists */}
            {(lead.state || lead.district || lead.city) && (
              <div className="ld-info-card">
                <CardHead icon={MapPin}>Address</CardHead>
                <div className="ld-field-list">
                  {[
                    ['State', lead.state],
                    ['District', lead.district],
                    ['City', lead.city],
                    ['Pincode', lead.pincode],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div className="ld-field-row" key={l}>
                      <span className="ld-field-label">{l}</span>
                      <span className="ld-field-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Solar scheme — only for Solar_Rooftop */}
            {lead.solarScheme && (
              <div className="ld-info-card">
                <CardHead icon={Sun}>Solar Scheme</CardHead>
                <div className="ld-field-list">
                  <div className="ld-field-row">
                    <span className="ld-field-label">Scheme</span>
                    <span className="ld-field-val">{lead.solarScheme.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tender Info Card — only for Tender leads ──────────────────── */}
            {(() => {
              const td = decodeTenderMeta(lead.enquiry);
              if (!td) return null;
              const { meta } = td;
              return (
                <div className="ld-info-card" style={{ border: `1.5px solid ${__sbg('#bae6fd')}`, background: __sbg('#f0f9ff') }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>📋</span>
                    <h4 className="ld-card-title" style={{ margin: 0, color: __stc('#0369a1') }}>Tender Details</h4>
                    <span style={{ marginLeft: 'auto', background: __sbg('#e0f2fe'), color: __stc('#0369a1'), borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>TENDER</span>
                  </div>
                  <div className="ld-field-list">
                    {[
                      ['Tender Reference No.', meta.tenderRefNo],
                      ['Tender Title', meta.tenderTitle],
                      ['Issuing Authority', meta.issuingAuthority],
                      ['Tender Portal / Source', meta.tenderPortal],
                      ['Location Floated At', meta.locationFloated],
                      ['Scope of Work', meta.scopeOfWork],
                      ['Capacity', meta.capacity ? `${meta.capacity} ${meta.capacityUnit || 'kW'}` : null],
                      ['Price Floated (₹)', meta.priceFloated ? `₹${Number(meta.priceFloated).toLocaleString('en-IN')}` : null],
                      ['EMD Amount (₹)', meta.emdAmount ? `₹${Number(meta.emdAmount).toLocaleString('en-IN')}` : null],
                      ['Bid Submission Deadline', meta.bidDeadline],
                      ['Pre-Bid Meeting Date', meta.preBidDate],
                      ['Original Close Date', meta.originalCloseDate],
                    ].filter(([, v]) => v).map(([l, v]) => (
                      <div className="ld-field-row" key={l}>
                        <span className="ld-field-label">{l}</span>
                        <span className="ld-field-val">{v}</span>
                      </div>
                    ))}

                    {/* Extensions */}
                    {meta.extensions && meta.extensions.length > 0 && (
                      <div className="ld-field-row ld-field-row--block" key="ext">
                        <span className="ld-field-label">Extensions</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                          {meta.extensions.map((ext, i) => (
                            <div key={i} style={{ background: __sbg('#fff7ed'), border: `1px solid ${__sbg('#fed7aa')}`, borderRadius: 6, padding: '5px 10px', fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: __stc('#c2410c') }}>Extension {i + 1}</span>
                              {ext.newDeadline && <span style={{ marginLeft: 8, color: __stc('#374151') }}>→ {ext.newDeadline}</span>}
                              {ext.reason && <span style={{ color: __stc('#6b7280'), marginLeft: 8 }}>({ext.reason})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {meta.tenderNotes && (
                      <div className="ld-field-row ld-field-row--block" key="tnotes">
                        <span className="ld-field-label">Notes</span>
                        <span className="ld-field-val ld-field-val--note">{meta.tenderNotes}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}


            {(lead.telecallerName || lead.assignedToName || lead.bdAssignedToName || canAssignBd) && (
              <div className="ld-info-card">
                <CardHead icon={Users}>Team Assignment</CardHead>
                <div className="ld-field-list">
                  {[
                    // Telecaller shows ONLY a real telecaller. A non-telecaller in
                    // the assigned slot is a "Lead Handler", never a Telecaller.
                    ['Telecaller', lead.telecallerName],
                    ['Lead Handler', lead.telecallerName ? null : lead.assignedToName],
                    ['BD Executive', lead.bdAssignedToName],
                    ['BD Assigned At', lead.bdAssignedAt],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div className="ld-field-row" key={l}>
                      <span className="ld-field-label">{l}</span>
                      <span className="ld-field-val">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Change / remove the BD executive — any lead, any time. */}
                {canAssignBd && (
                  <div className="ld-bd-actions">
                    <span className="ld-field-label">
                      {lead.bdAssignedToName ? 'Change BD Executive' : 'Assign BD Executive'}
                    </span>
                    <div className="ld-bd-actions-row">
                      <div className="ld-bd-select">
                        <FilterSelect
                          value={lead.bdAssignedToId ? String(lead.bdAssignedToId) : ''}
                          options={bdExecs.map(u => ({ value: String(u.id), label: u.name }))}
                          placeholder={bdBusy ? 'Updating…' : 'Select BD executive'}
                          disabled={bdBusy}
                          onChange={v => {
                            if (v && String(v) !== String(lead.bdAssignedToId || '')) handleBdChange(Number(v));
                          }}
                        />
                      </div>
                      {lead.bdAssignedToId && (
                        <button type="button" className="ld-bd-remove-btn" disabled={bdBusy}
                          onClick={() => handleBdChange(null)}>
                          Remove BD
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Telecaller interaction details — shown when TC has marked Interested */}
            {(lead.tcDiscussionNote || lead.tcLocation || lead.tcSiteVisitDate || lead.tcPropertyType || lead.tcQuotedPrice || lead.tcAddons || lead.tcOtherComments || lead.tcMonthlyBill || lead.tcHasBillFile) && (
              <div className="ld-info-card">
                <CardHead icon={Phone}>Telecaller Interaction Details</CardHead>
                <div className="ld-field-list">
                  {lead.tcDiscussionNote && (
                    <div className="ld-field-row ld-field-row--block" key="disc">
                      <span className="ld-field-label">Discussion Summary</span>
                      <span className="ld-field-val ld-field-val--note">{lead.tcDiscussionNote}</span>
                    </div>
                  )}
                  {[
                    ['Location', lead.tcLocation],
                    ['Site Visit Date', lead.tcSiteVisitDate],
                    ['Property Type', lead.tcPropertyType],
                    ['Pricing Quoted', lead.tcQuotedPrice ? `₹${lead.tcQuotedPrice}` : null],
                    ['Monthly Bill', lead.tcMonthlyBill ? `₹${lead.tcMonthlyBill}` : null],
                    ['Existing Contract Load', lead.tcExistingContractLoad],
                    ['Required Contract Load', lead.tcRequiredContractLoad],
                    ['Add-ons', lead.tcAddons],
                    ['Other Comments', lead.tcOtherComments],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div className="ld-field-row" key={l}>
                      <span className="ld-field-label">{l}</span>
                      <span className="ld-field-val">{v}</span>
                    </div>
                  ))}
                  {lead.tcHasBillFile && lead.tcBillFileName && (
                    <div className="ld-field-row" key="bill">
                      <span className="ld-field-label">Electricity Bill</span>
                      <span className="ld-field-val">
                        <button
                          className="ld-bill-view-btn"
                          onClick={() => setBillPreview({
                            url: `${API_BASE_URL}/leads/${lead.id}/bill`,
                            name: lead.tcBillFileName,
                            type: lead.tcBillFileType || 'application/octet-stream',
                            leadId: lead.id,
                          })}
                        >
                          📄 {lead.tcBillFileName}
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="ld-enquiry-card">
            <CardHead icon={FileText}>{isTenderLead(lead) ? 'Tender Description / Notes' : 'Enquiry Description'}</CardHead>
            <p className="ld-enquiry-text">
              {(() => {
                const td = decodeTenderMeta(lead.enquiry);
                if (td) {
                  const desc = td.description || td.meta?.tenderNotes || '';
                  return desc || 'No additional description provided.';
                }
                return lead.enquiry || 'No description provided.';
              })()}
            </p>
          </div>
          {/* The "Not Interested — Reason" card that used to sit here now renders as a
              full-width callout at the TOP of this tab (above Contact Information). */}
          {lead.telecallerStatus === 'KEEP_IN_VIEW' && (lead.telecallerReason || lead.kivReminderDate) && (
            <div className="ld-enquiry-card" style={{background:__sbg('#f5f3ff'),border:`1.5px solid ${__sbg('#e9d5ff')}`}}>
              <h4 className="ld-card-title" style={{color:__stc('#6d28d9')}}>👁 Keep in View Details</h4>
              {lead.telecallerReason && (
                <div style={{marginBottom:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:__stc('#7c3aed'),textTransform:'uppercase',letterSpacing:'0.5px'}}>Conversation Note</span>
                  <p className="ld-enquiry-text" style={{marginTop:4,color:__stc('#374151')}}>{lead.telecallerReason}</p>
                </div>
              )}
              {lead.kivReminderDate && (
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:__stc('#7c3aed'),textTransform:'uppercase',letterSpacing:'0.5px'}}>Callback Date</span>
                  <span style={{fontSize:13,fontWeight:600,color:__stc('#7c3aed'),background:__sbg('#ede9fe'),borderRadius:20,padding:'2px 12px'}}>
                    📅 {new Date(lead.kivReminderDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                  </span>
                </div>
              )}
            </div>
          )}
          <OverviewProposalsSummary
            lead={lead}
            currentUser={currentUser}
            apiBase={API_BASE_URL}
            onGoToProposals={() => { setActiveTab('proposals'); setShowProposalForm(false); }}
          />
          {/* <LeadFollowupsOverviewSnippet
            leadId={lead.id}
            onGoToFollowups={() => setActiveTab('followups')}
          /> */}
        </div>

      )}

      {activeTab === 'sitevisit' && (
        <div className="ld-tab-content">
          <LeadSiteVisitTab
            lead={lead}
            currentUser={currentUser}
            permissions={permissions}
            onRefreshLead={() => { if (onLeadUpdated) onLeadUpdated(); }}
            showSuccess={showSuccess}
            showError={showError}
          />
        </div>
      )}

      {activeTab === 'proposals' && (
        <div className="ld-tab-content">
          {!permissions.PROPOSAL_VIEW && (
            <div className="ld-empty-state">
              <div className="ld-empty-icon">🔒</div>
              <p>You don't have permission to view proposals.</p>
            </div>
          )}
          {permissions.PROPOSAL_VIEW && (showProposalForm ? (
            <div>
              <div className="ld-section-hdr" style={{ marginBottom: 12 }}>
                <h4 className="ld-card-title" style={{ margin: 0 }}>{editingProposal ? 'Edit Proposal' : 'New Proposal'} — {lead.name}</h4>
                <button className="ld-btn ld-btn-sec" onClick={() => { setShowProposalForm(false); setEditingProposal(null); }}>Cancel</button>
              </div>
              <ProposalForm
                lead={lead}
                currentUser={currentUser}
                apiBase={API_BASE_URL}
                existingProposal={editingProposal}
                onSaved={() => { setShowProposalForm(false); setEditingProposal(null); showSuccess(editingProposal ? 'Proposal updated!' : 'Proposal created!'); fetchProposals(); if (!editingProposal) markProposalSent(); else if (onLeadUpdated) onLeadUpdated(); }}
                onCancel={() => { setShowProposalForm(false); setEditingProposal(null); }}
              />
            </div>
          ) : (
            <div>
              <div className="ld-section-hdr">
                <div style={{display:'flex',alignItems:'center',gap:11}}><span className="lead-card-ico"><FileText size={17} strokeWidth={2} /></span><h4 className="ld-card-title" style={{ margin: 0 }}>{proposals.length} Proposal{proposals.length !== 1 ? 's' : ''}</h4></div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {permissions.PROPOSAL_OFFLINE_UPLOAD && (
                    <label className="ld-pact-btn ld-pact-upload" title="Upload an offline proposal PDF given by client" style={{cursor:'pointer',padding:'7px 14px',fontSize:13}} onClick={() => { setShowOfflinePanel(v => !v); setShowProposalForm(false); }}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Upload Offline PDF
                    </label>
                  )}
                  {permissions.PROPOSAL_CREATE && (
                    isSolar ? (
                      <button className="ld-btn ld-btn-pri" onClick={() => { setShowOfflinePanel(false); setGenerateProposal({ proposalId: null }); }}>
                        Generate Proposal
                      </button>
                    ) : (
                      <button className="ld-btn ld-btn-pri" onClick={() => { setShowProposalForm(true); setEditingProposal(null); setShowOfflinePanel(false); }}>
                        + New Proposal
                      </button>
                    )
                  )}
                </div>
              </div>

              {showOfflinePanel && (
                <div style={{background:__sbg('#f5f3ff'),border:`1.5px solid ${__sbg('#e9d5ff')}`,borderRadius:10,padding:'18px 20px',marginBottom:16,display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{fontWeight:600,color:__stc('#6d28d9'),fontSize:14,marginBottom:2}}>📎 Upload Offline Proposal PDF</div>
                  <div style={{fontSize:13,color:__stc('#6b7280'),marginTop:-8}}>Upload a proposal PDF received from the client. A new proposal record will be created automatically.</div>
                  <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                    <div style={{flex:'2 1 0',minWidth:0}}>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Proposal Title *</label>
                      <input
                        type="text"
                        value={offlineTitle}
                        onChange={e => setOfflineTitle(e.target.value)}
                        placeholder="e.g. Rooftop Solar Proposal – Client Name"
                        style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${__sbg('#d1d5db')}`,borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}
                      />
                    </div>
                    <div style={{flex:'1 1 0',minWidth:0}}>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Total Value (₹)</label>
                      <input
                        type="number"
                        value={offlineTotalValue}
                        onChange={e => setOfflineTotalValue(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${__sbg('#d1d5db')}`,borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}
                      />
                    </div>
                    <div style={{flex:'1 1 0',minWidth:0}}>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Status</label>
                      <FilterSelect
                        value={offlineStatus}
                        options={['Draft','Sent','Approved','Rejected','On Hold'].map(s => ({ value: s, label: s }))}
                        placeholder="Select Status"
                        onChange={v => setOfflineStatus(v)}
                      />
                    </div>
                    <div style={{flex:'2 1 0',minWidth:0}}>
                      <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>PDF File *</label>
                      <label style={{
                        display:'flex',alignItems:'center',gap:6,cursor:'pointer',
                        border:'1.5px dashed ' + (offlineFile ? __sbg('#7c3aed') : __sbg('#c4b5fd')),
                        borderRadius:7,padding:'8px 12px',background: offlineFile ? __sbg('#f5f3ff') : __sbg('#faf5ff'),
                        transition:'all .18s',fontSize:13,userSelect:'none',boxSizing:'border-box',width:'100%'
                      }}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{flexShrink:0,color: offlineFile ? __stc('#6d28d9') : __stc('#7c3aed')}}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,color: offlineFile ? __stc('#6d28d9') : __stc('#7c3aed'),fontWeight:500}}>
                          {offlineFile ? offlineFile.name : 'Choose PDF file…'}
                        </span>
                        <span style={{fontSize:11,color:__stc('#9ca3af'),whiteSpace:'nowrap',flexShrink:0}}>PDF only · Max 50 MB</span>
                        <input type="file" accept=".pdf,application/pdf" onChange={e => setOfflineFile(e.target.files[0] || null)} style={{display:'none'}} />
                      </label>
                      {offlineFile && <div style={{fontSize:11,color:__stc('#059669'),marginTop:3}}>✓ {offlineFile.name} — Ready to upload</div>}
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      <button className="ld-btn ld-btn-pri" onClick={handleUploadOfflineNew} disabled={offlineUploading || !offlineTitle.trim() || !offlineFile} style={{whiteSpace:'nowrap'}}>
                        {offlineUploading ? 'Uploading…' : 'Save & Upload'}
                      </button>
                      <button className="ld-btn ld-btn-sec" onClick={() => { setShowOfflinePanel(false); setOfflineTitle(''); setOfflineFile(null); setOfflineTotalValue(''); setOfflineStatus('Draft'); }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {loadingProposals ? (
                <div className="ld-loading-row"><div className="p-loading-spinner"></div> Loading proposals…</div>
              ) : proposals.length === 0 ? (
                <div className="ld-empty-state">
                  <div className="ld-empty-icon">📝</div>
                  <p>No proposals yet for this lead.</p>
                  <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                    {permissions.PROPOSAL_CREATE && (isSolar
                      ? <button className="ld-btn ld-btn-pri" onClick={() => { setShowOfflinePanel(false); setGenerateProposal({ proposalId: null }); }}>Generate Proposal</button>
                      : <button className="ld-btn ld-btn-pri" onClick={() => { setShowProposalForm(true); setShowOfflinePanel(false); }}>+ Create Proposal</button>
                    )}
                    {permissions.PROPOSAL_OFFLINE_UPLOAD && (
                    <button className="ld-pact-btn ld-pact-upload" style={{padding:'8px 16px',fontSize:13,cursor:'pointer'}} onClick={() => setShowOfflinePanel(v => !v)}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Upload Offline PDF
                    </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="ld-proposals-list">
                  {proposals.map(p => (
                    <div key={p.id} className="ld-proposal-card">
                      <div className="ld-proposal-card-left">
                        <div className="ld-proposal-no-row" style={{display:'flex',alignItems:'center',gap:6}}>
                          <div className="ld-proposal-no">{p.proposalNo}</div>
                          {/* Where this proposal's document came from. Both can be
                              true: a generated proposal can also have a signed copy
                              uploaded against it later. */}
                          {(proposalDocs[p.id] || []).length > 0 && (() => {
                            const docs = proposalDocs[p.id];
                            const latest = docs[0];
                            return (
                              <span className="ld-generated-badge"
                                title={`Generated from this lead's tabs — ${docs.length} version${docs.length > 1 ? 's' : ''}, latest v${latest.version} on ${fmtDT(latest.generatedAt)}${latest.generatedByName ? ' by ' + latest.generatedByName : ''}`}>
                                <Sparkles size={11} strokeWidth={2.2} />
                                System generated
                              </span>
                            );
                          })()}
                          {p.offlinePdfName && (
                            <span className="ld-offline-badge" title={`Offline PDF: ${p.offlinePdfName}`}>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="11" height="11"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              Offline PDF
                            </span>
                          )}
                        </div>
                        <div className="ld-proposal-title">{p.title}</div>
                        <div className="ld-proposal-meta">
                          <span>v{p.version}</span>
                          <span>·</span>
                          <span>₹{p.totalValue ? parseFloat(p.totalValue).toLocaleString('en-IN') : '0'}</span>
                          <span>·</span>
                          <span>{fmtDT(p.updatedAt)}</span>
                          {p.preparedByName && <><span>·</span><span>by {p.preparedByName}</span></>}
                        </div>
                        {/* Every generated version stays available — re-generating
                            appends, it never overwrites an already-sent file.
                            Clicking a version previews it; the chip's ⬇ saves it
                            and its 🗑 removes that version alone. */}
                        {isSolar && (proposalDocs[p.id] || []).length > 1 && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6,alignItems:'center'}}>
                            <span style={{fontSize:11,color:__stc('#6b7280')}}>Earlier versions:</span>
                            {proposalDocs[p.id].slice(1).map(d => (
                              <span key={d.version} className="ld-docver"
                                title={`${d.fileName} — ${fmtDT(d.generatedAt)}${d.generatedByName ? ' by ' + d.generatedByName : ''}`}>
                                <button type="button" className="ld-docver-view"
                                  onClick={() => viewProposalDoc(p.id, d.version, d.fileName, p.title)}
                                  title={`Preview v${d.version}`}>
                                  <Eye size={11} strokeWidth={2.2} />
                                  v{d.version}
                                </button>
                                <button type="button" className="ld-docver-dl"
                                  onClick={() => downloadProposalDoc(p.id, d.version, d.fileName)}
                                  title={`Download v${d.version}`} aria-label={`Download version ${d.version}`}>
                                  <DownloadIcon size={11} strokeWidth={2.2} />
                                </button>
                                {permissions.PROPOSAL_DELETE && (
                                  <button type="button" className="ld-docver-del"
                                    onClick={() => setDeleteVersionConfirm({ id: p.id, proposalNo: p.proposalNo, version: d.version, isLatest: false })}
                                    title={`Delete v${d.version}`} aria-label={`Delete version ${d.version}`}>
                                    <Trash2 size={11} strokeWidth={2.2} />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ld-proposal-card-right">
                        <span className={`ld-proposal-status ${getPropStatusClass(p.status)}`}>{p.status}</span>
                        <div className="ld-proposal-actions">
                          {permissions.PROPOSAL_DOWNLOAD && (p.offlinePdfName ? (
                            /* ── Offline PDF uploaded — show View / Download / Replace only ── */
                            <>
                              <button className="ld-pact-btn ld-pact-offline-view" onClick={() => handleViewOffline(p.id, p.offlinePdfName)} title="View uploaded offline proposal">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                View
                              </button>
                              <button className="ld-pact-btn ld-pact-offline-dl" onClick={() => handleDownloadOffline(p.id, p.offlinePdfName)} title="Download offline proposal">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download
                              </button>
                              {permissions.PROPOSAL_OFFLINE_UPLOAD && (
                              <label className="ld-pact-btn ld-pact-upload" title="Replace offline PDF" style={{cursor:'pointer'}}>
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                {uploadingId === p.id ? 'Uploading…' : 'Replace'}
                                <input type="file" accept=".pdf,application/pdf" style={{display:'none'}}
                                  onChange={e => { if(e.target.files[0]) handleUploadOffline(p.id, e.target.files[0]); e.target.value=''; }}
                                  disabled={uploadingId === p.id}
                                />
                              </label>
                              )}
                            </>
                          ) : (
                            /* ── No offline PDF — Solar downloads its generated Word
                                 document; other groups keep the generic PDF. ── */
                            <>
                              {isSolar ? (
                                (proposalDocs[p.id] || []).length > 0 ? (
                                  <>
                                    <button className="ld-pact-btn ld-pact-offline-view"
                                      onClick={() => viewProposalDoc(p.id, proposalDocs[p.id][0].version, proposalDocs[p.id][0].fileName, p.title)}
                                      title={`Preview the latest generated proposal (v${proposalDocs[p.id][0].version})`}>
                                      <Eye size={15} strokeWidth={2} />
                                      View v{proposalDocs[p.id][0].version}
                                    </button>
                                    <button className="ld-pact-btn" onClick={() => downloadProposalDoc(p.id, proposalDocs[p.id][0].version, proposalDocs[p.id][0].fileName)}
                                      title={`Download the editable Word file (v${proposalDocs[p.id][0].version}) — this is what gets sent to the client`}>
                                      <DownloadIcon size={15} strokeWidth={2} />
                                      Word
                                    </button>
                                    {/* The PDF is the same version rendered for sending/printing.
                                        Hidden when the row can never have one (a version generated
                                        before the feature, with no payload to re-render from). */}
                                    {proposalDocs[p.id][0].previewable !== false && (
                                      <button className="ld-pact-btn ld-pact-pdf"
                                        onClick={() => downloadProposalPdf(p.id, proposalDocs[p.id][0].version, proposalDocs[p.id][0].fileName)}
                                        title={`Download v${proposalDocs[p.id][0].version} as PDF`}>
                                        <DownloadIcon size={15} strokeWidth={2} />
                                        PDF
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="ld-pact-btn" style={{opacity:.65,cursor:'default'}} title="No document generated for this proposal yet">
                                    No document yet
                                  </span>
                                )
                              ) : (
                                <button className="ld-pact-btn" onClick={() => downloadPDF(p.id)} title="Download generated PDF">
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  PDF
                                </button>
                              )}
                              {isSolar && permissions.PROPOSAL_CREATE && (
                                <button className="ld-pact-btn ld-pact-edit" onClick={() => setGenerateProposal({ proposalId: p.id })}
                                  title="Re-generate from the lead's current tabs as a new version">
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                  Re-generate
                                </button>
                              )}
                              {/* Undo a bad re-generate without losing the versions already
                                  sent — the card falls back to the one below it. Only offered
                                  while there is something to fall back to. */}
                              {isSolar && permissions.PROPOSAL_DELETE && (proposalDocs[p.id] || []).length > 1 && (
                                <button className="ld-pact-btn ld-pact-delete"
                                  onClick={() => setDeleteVersionConfirm({ id: p.id, proposalNo: p.proposalNo, version: proposalDocs[p.id][0].version, isLatest: true })}
                                  title={`Delete only v${proposalDocs[p.id][0].version} — v${proposalDocs[p.id][1].version} becomes the latest again`}>
                                  <Trash2 size={15} strokeWidth={2} />
                                  Delete v{proposalDocs[p.id][0].version}
                                </button>
                              )}
                              {permissions.PROPOSAL_OFFLINE_UPLOAD && (
                              <label className="ld-pact-btn ld-pact-upload" title="Upload offline proposal PDF given by client" style={{cursor:'pointer'}}>
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                {uploadingId === p.id ? 'Uploading…' : 'Upload Offline PDF'}
                                <input type="file" accept=".pdf,application/pdf" style={{display:'none'}}
                                  onChange={e => { if(e.target.files[0]) handleUploadOffline(p.id, e.target.files[0]); e.target.value=''; }}
                                  disabled={uploadingId === p.id}
                                />
                              </label>
                              )}
                            </>
                          ))}
                          {permissions.PROPOSAL_EDIT && (
                            <button className="ld-pact-btn ld-pact-edit" onClick={() => { setEditingProposal(p); setShowProposalForm(true); }} title="Edit">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Edit
                            </button>
                          )}
                          {permissions.PROPOSAL_DELETE && (
                            <button className="ld-pact-btn ld-pact-delete" onClick={() => handleDeleteProposal(p.id, p.proposalNo)} title="Delete proposal">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {activeTab === 'documents' && isTenderLead(lead) && (
        <TenderDocumentsTab
          lead={lead}
          currentUser={currentUser}
          permissions={permissions}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
      {activeTab === 'followups' && (
        <div className="ld-tab-content">
          <LeadFollowupsTab
            lead={lead}
            currentUser={currentUser}
            permissions={permissions}
            onRefreshLead={() => {
              if (onLeadUpdated) onLeadUpdated();
            }}
            showSuccess={showSuccess}
            showError={showError}
          />
        </div>
      )}
      {activeTab === 'techscope' && (
        <div className="ld-tab-content">
          <LeadTechnicalScopeTab
            lead={lead}
            currentUser={currentUser}
            permissions={permissions}
            onRefreshLead={() => { if (onLeadUpdated) onLeadUpdated(); }}
            showSuccess={showSuccess}
            showError={showError}
          />
        </div>
      )}
      {activeTab === 'bom' && (
        <div className="ld-tab-content">
          <LeadBomTab
            lead={lead}
            currentUser={currentUser}
            permissions={permissions}
            onRefreshLead={() => { if (onLeadUpdated) onLeadUpdated(); }}
            showSuccess={showSuccess}
            showError={showError}
          />
        </div>
      )}
      {activeTab === 'budget' && (
        <div className="ld-tab-content">
          <LeadBudgetTab
            lead={lead}
            currentUser={currentUser}
            permissions={permissions}
            onRefreshLead={() => { if (onLeadUpdated) onLeadUpdated(); }}
            showSuccess={showSuccess}
            showError={showError}
          />
        </div>
      )}
      {activeTab === 'history' && (
        <div className="ld-tab-content ld-tab-content--history">
          <div className="ld-card-head"><span className="lead-card-ico"><HistoryIcon size={17} strokeWidth={2} /></span><h4 className="ld-card-title">Activity History</h4></div>
          {loadingHistory ? (
            <div className="ld-loading-row"><div className="p-loading-spinner"></div> Loading history…</div>
          ) : history.length === 0 ? (
            <div className="ld-empty-state"><div className="ld-empty-icon">📋</div><p>No history found.</p></div>
          ) : (
            <div className="ld-history-scroll">
              <div className="ld-history-timeline">
                {history.map((h, idx) => {
                  const cfg = HISTORY_CONFIG[h.actionType] || { icon: '📋', label: h.actionType?.replace(/_/g, ' ') || 'Activity', color: __stc('#64748b'), bg: __sbg('#f8fafc') };
                  const summary = getHistorySummary(h);
                  const isDirect = h.actionType === 'DIRECT_INTERACTION';
                  const isCompleted = h.actionType === 'FOLLOWUP_COMPLETED';

                  // For DIRECT_INTERACTION: description = "Direct Visit recorded on … — <outcome text>"
                  // Extract everything after the first " — " as the outcome
                  const directOutcome = isDirect && h.description
                    ? h.description.split(' — ').slice(1).join(' — ').trim()
                    : null;

                  // For FOLLOWUP_COMPLETED: description = "Follow-up completed: Type — <outcome>"
                  const completedOutcome = isCompleted && h.description
                    ? h.description.split(' — ').slice(1).join(' — ').trim()
                    : null;

                  // newValue = notes (context/background stored by service)
                  const contextNotes = h.newValue && h.newValue.trim() ? h.newValue.trim() : null;

                  return (
                    <div key={h.id} className="ld-history-entry">
                      {idx < history.length - 1 && <div className="ld-history-line" />}
                      <div className="ld-history-bubble" style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}22` }}>
                        <span>{cfg.icon}</span>
                      </div>
                      <div className={`ld-history-card ${isDirect ? 'ld-history-card--direct' : ''}`}>
                        <div className="ld-history-card-hdr">
                          <span className="ld-history-tag" style={{ color: cfg.color, background: cfg.bg }}>
                            {cfg.label}
                          </span>
                          <span className="ld-history-meta">
                            {h.createdByName && <span className="ld-history-who">👤 {h.createdByName}</span>}
                            <span className="ld-history-when">🕐 {fmtDT(h.createdAt)}</span>
                          </span>
                        </div>

                        {/* Summary line — for direct, show only the first part (before " — "); for TC status change show only the label (description shown in note block below) */}
                        <div className="ld-history-summary">
                          {isDirect && h.description
                            ? h.description.split(' — ')[0].trim()
                            : h.actionType === 'TELECALLER_STATUS_CHANGE'
                            ? (HISTORY_CONFIG['TELECALLER_STATUS_CHANGE']?.label || 'Telecaller Update')
                            : summary}
                        </div>

                        {/* DIRECT INTERACTION: outcome block */}
                        {isDirect && directOutcome && (
                          <div className="ld-history-outcome ld-history-outcome--direct">
                            <span className="ld-history-outcome-label">⚡ What happened</span>
                            <span className="ld-history-outcome-text">{directOutcome}</span>
                          </div>
                        )}

                        {/* DIRECT INTERACTION: context/background notes */}
                        {isDirect && contextNotes && (
                          <div className="ld-history-notes">
                            <span className="ld-history-notes-label">Context</span>
                            <span className="ld-history-notes-text">{contextNotes}</span>
                          </div>
                        )}

                        {/* FOLLOWUP COMPLETED: outcome block */}
                        {isCompleted && completedOutcome && (
                          <div className="ld-history-outcome">
                            <span className="ld-history-outcome-label">📊 Outcome</span>
                            <span className="ld-history-outcome-text">{completedOutcome}</span>
                          </div>
                        )}

                        {/* FOLLOWUP COMPLETED: pre-call notes */}
                        {isCompleted && contextNotes && (
                          <div className="ld-history-notes">
                            <span className="ld-history-notes-label">Pre-call Notes</span>
                            <span className="ld-history-notes-text">{contextNotes}</span>
                          </div>
                        )}

                        {/* TELECALLER_STATUS_CHANGE: show full description as note (contains reason/conversation/callback date) */}
                        {h.actionType === 'TELECALLER_STATUS_CHANGE' && h.description && (
                          <div className="ld-history-notes" style={{marginTop:6}}>
                            <span className="ld-history-notes-text" style={{color:__stc('#374151'),fontStyle:'normal'}}>{h.description}</span>
                          </div>
                        )}

                        {/* Other types: field change display */}
                        {!isDirect && !isCompleted && h.fieldChanged && (h.oldValue || h.newValue) && (
                          <div className="ld-history-change-row">
                            <span className="ld-chg-field">{h.fieldChanged.replace(/_/g, ' ')}</span>
                            {h.oldValue && <><span className="ld-chg-old">{h.oldValue}</span><span className="ld-chg-arrow">→</span></>}
                            {h.newValue && <span className="ld-chg-new">{h.newValue}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Generated proposal preview (PDF rendition of the .docx) ───── */}
      <ProposalDocViewer
        open={!!docViewer.open}
        title={docViewer.title}
        version={docViewer.version}
        loading={!!docViewer.loading}
        blob={docViewer.blob}
        unavailable={!!docViewer.unavailable}
        error={docViewer.error}
        // Bump the request id so a response still in flight cannot repopulate a
        // modal the user has closed (or reopened on another version).
        onClose={() => { docReqRef.current++; setDocViewer({ open: false }); }}
        // Re-fetches the real .docx. It must NOT save docViewer.blob — that holds
        // the PDF rendition, and writing those bytes to a .docx would hand the
        // client a file Word cannot open.
        onDownloadWord={() => downloadProposalDoc(
          docViewer.proposalId, docViewer.version, docViewer.fileName)}
        // The PDF on screen IS the file to save, so this writes docViewer.blob
        // directly — no second fetch, and no chance of handing over a different
        // render than the one just reviewed.
        onDownloadPdf={() => {
          if (!docViewer.blob) return;
          const base = docViewer.fileName
            || `proposal-${docViewer.proposalId}-v${docViewer.version || 'latest'}.docx`;
          saveBlob(docViewer.blob, base.replace(/\.docx$/i, '') + '.pdf');
        }}
        onRegenerate={permissions.PROPOSAL_CREATE ? () => {
          setDocViewer({ open: false });
          setGenerateProposal({ proposalId: docViewer.proposalId });
        } : null}
      />

      {/* ── PDF Viewer Modal ─────────────────────────────────────────── */}
      {pdfModal.open && (
        <div className="ld-pdf-modal-overlay" onClick={() => { setPdfModal({ open: false, url: null, name: null }); if(pdfModal.url) window.URL.revokeObjectURL(pdfModal.url); }}>
          <div className="ld-pdf-modal" onClick={e => e.stopPropagation()}>
            <div className="ld-pdf-modal-header">
              <span className="ld-pdf-modal-title">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                {pdfModal.name}
              </span>
              <div className="ld-pdf-modal-actions">
                <a href={pdfModal.url} download={pdfModal.name} className="ld-pact-btn ld-pact-offline-dl" style={{textDecoration:'none'}}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </a>
                <a href={pdfModal.url} target="_blank" rel="noopener noreferrer" className="ld-pact-btn" style={{textDecoration:'none'}}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  New Tab
                </a>
                <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={() => { setPdfModal({ open: false, url: null, name: null }); if(pdfModal.url) window.URL.revokeObjectURL(pdfModal.url); }}>
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="ld-pdf-modal-body">
              <iframe
                src={pdfModal.url}
                title={pdfModal.name}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {deleteProposalConfirm && (() => {
        // Say how much goes with it — this button removes the whole record,
        // every generated version included. Deleting one version is the ✕ on
        // its chip (or "Delete v…" in the card's actions).
        const versions = (proposalDocs[deleteProposalConfirm.id] || []).length;
        return (
          <ConfirmationModal
            show={true}
            type="alert"
            title="Delete Proposal"
            message={`Are you sure you want to delete proposal ${deleteProposalConfirm.proposalNo}?`
              + (versions > 1 ? `\nAll ${versions} generated versions go with it.` : '')
              + `\nThis action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            onConfirm={confirmDeleteProposal}
            onCancel={() => setDeleteProposalConfirm(null)}
          />
        );
      })()}

      {deleteVersionConfirm && (() => {
        const docs = proposalDocs[deleteVersionConfirm.id] || [];
        const below = docs.find(d => d.version < deleteVersionConfirm.version);
        return (
          <ConfirmationModal
            show={true}
            type="alert"
            title={`Delete version ${deleteVersionConfirm.version}`}
            message={`Delete v${deleteVersionConfirm.version} of ${deleteVersionConfirm.proposalNo}?`
              + (deleteVersionConfirm.isLatest && below
                  ? `\nv${below.version} becomes the latest again.`
                  : `\nThe other versions are not affected.`)
              + `\nThis action cannot be undone.`}
            confirmText={`Delete v${deleteVersionConfirm.version}`}
            cancelText="Cancel"
            onConfirm={confirmDeleteVersion}
            onCancel={() => setDeleteVersionConfirm(null)}
          />
        );
      })()}

      {/* ── Bill File Preview Modal ── */}
      {billPreview && (
        <BillPreviewModal
          url={billPreview.url}
          name={billPreview.name}
          type={billPreview.type}
          onClose={() => setBillPreview(null)}
        />
      )}

      {followupModal && (
        <AddFollowupModal
          lead={lead}
          onClose={() => setFollowupModal(false)}
          onFollowupCreated={() => { setFollowupModal(false); showSuccess('Follow-up created!'); if (onLeadUpdated) onLeadUpdated(); }}
        />
      )}

      {timelineModal && (
        <LeadTimelineModal
          lead={lead}
          onClose={() => setTimelineModal(false)}
          onAddFollowup={() => { setTimelineModal(false); setFollowupModal(true); }}
        />
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ── Leads Date Range Filter ──────────────────────────────────────────────────
const _LD_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _LD_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const LeadsDateRangeFilter = ({ appliedFrom, appliedTo, onApply, onClear }) => {
  const [show,   setShow]   = useState(false);
  const [from,   setFrom]   = useState(null);
  const [to,     setTo]     = useState(null);
  const [hover,  setHover]  = useState(null);
  const [calMo,  setCalMo]  = useState(new Date().getMonth());
  const [calYr,  setCalYr]  = useState(new Date().getFullYear());
  const [showYr, setShowYr] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
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

  const handleApply = () => {
    if (!from) return;
    onApply(from, to || from);
    setShow(false);
  };
  const handleClear = () => {
    setFrom(null); setTo(null); setHover(null);
    onClear();
    setShow(false);
  };

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex' }}>
      <button
        type="button"
        className={`ld-cal-trigger${show?' ld-cal--open':''}${appliedFrom?' ld-cal--applied':''}`}
        onClick={() => setShow(p => !p)}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className={appliedFrom ? 'ld-cal-val' : 'ld-cal-ph'}>{appliedFrom ? fmt(appliedFrom) : 'dd-mm-yyyy'}</span>
        <span className="ld-cal-sep">—</span>
        <span className={appliedTo && appliedTo !== appliedFrom ? 'ld-cal-val' : 'ld-cal-ph'}>
          {appliedTo && appliedTo !== appliedFrom ? fmt(appliedTo) : 'dd-mm-yyyy'}
        </span>
        {appliedFrom && (
          <span className="ld-cal-x" onClick={e => { e.stopPropagation(); handleClear(); }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </span>
        )}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ marginLeft:'auto', color:__stc('#94a3b8'), flexShrink:0,
            transform: show?'rotate(180deg)':'none', transition:'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {show && (
        <div className="ld-cal-dropdown" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:9999, width:264 }}>
          <div className="ld-cal-head">
            <button type="button" className="ld-cal-nav"
              onClick={() => { if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <button type="button" className="ld-cal-month-btn" onClick={() => setShowYr(p => !p)}>
              {_LD_MONTHS[calMo]} <span className="ld-cal-yr-num">{calYr}</span>
            </button>
            <button type="button" className="ld-cal-nav"
              onClick={() => { if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {showYr ? (
            <div className="ld-yr-grid">
              {Array.from({length:16},(_,i) => {
                const yr = new Date().getFullYear()-4+i;
                return (
                  <div key={yr} className={`ld-yr-cell${yr===calYr?' ld-yr-sel':''}`}
                    onClick={() => { setCalYr(yr); setShowYr(false); }}>
                    {yr}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ld-cal-grid">
              {_LD_DAYS.map(d => <div key={d} className="ld-cal-dl">{d}</div>)}
              {Array.from({length:FD}).map((_,i) => <div key={`e${i}`} className="ld-cal-cell ld-cal-empty"/>)}
              {Array.from({length:DIM}).map((_,i) => {
                const dy  = i+1;
                const ds  = `${calYr}-${String(calMo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                const dow = (FD+i)%7;
                let cls   = 'ld-cal-cell';
                if (ds===from)      cls += ' ld-cal-from';
                else if (ds===to)   cls += ' ld-cal-to';
                else if (inR(ds)) {
                  cls += ' ld-cal-in-range';
                  if (dow===0) cls += ' ld-cal-rr-s';
                  if (dow===6) cls += ' ld-cal-rr-e';
                }
                if (ds===tod && ds!==from && ds!==to) cls += ' ld-cal-today';
                return (
                  <div key={ds} className={cls}
                    onClick={() => clickDay(ds)}
                    onMouseEnter={() => from && !to && setHover(ds)}
                    onMouseLeave={() => setHover(null)}>
                    {dy}
                  </div>
                );
              })}
            </div>
          )}

          <div className="ld-cal-footer">
            <div className="ld-cal-chips">
              <span className={`ld-cal-chip${from?' ld-cal-chip--set':''}`}>{from ? fmt(from) : 'From —'}</span>
              <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14"/>
              </svg>
              <span className={`ld-cal-chip${to?' ld-cal-chip--set':''}`}>{to ? fmt(to) : 'To —'}</span>
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%' }}>
              {(from || appliedFrom) && (
                <button type="button" className="ld-cal-clear" onClick={handleClear}>Clear</button>
              )}
              <button type="button" className="ld-cal-clear" onClick={() => setShow(false)}>Cancel</button>
              <button type="button" className="ld-cal-apply" onClick={handleApply} disabled={!from}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
function LeadsEnquiries() {
  useThemeVersion();
  //  console.log('🔄 RENDER');
  const { user, pagePermissions } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
// ── Guard refs ────────────────────────────────────────────────────
const initialFetchDone    = useRef(false);
const isFirstGroupRender  = useRef(true);
const isFirstFilterRender = useRef(true);
const fetchLeadsSeq       = useRef(0); // guards against out-of-order list responses
const filterStateRef      = useRef({ rowsPerPage: 10, groupName: '', subGroupName: '' });
  // ── Permissions ──────────────────────────────────────────────────
  const leadsPermissions = pagePermissions?.LEADS || [];
  const canView = leadsPermissions.includes('VIEW');
  const canCreate = leadsPermissions.includes('CREATE');
  const canEdit = leadsPermissions.includes('EDIT');
  const canDelete = leadsPermissions.includes('DELETE');
  const canAssign = leadsPermissions.includes('ASSIGN');

  // ── Proposals permissions (used inside Proposals tab of Lead detail) ──
  const proposalsPermissions = pagePermissions?.PROPOSALS || [];

  const currentUser = { id: user.id || 1, role: user.role || 'USER', name: user.name || 'Current User' };

  const permissions = {
    VIEW: canView, CREATE: canCreate, EDIT: canEdit, DELETE: canDelete, ASSIGN: canAssign,
    APPROVE: leadsPermissions.includes('APPROVE'), DOWNLOAD: leadsPermissions.includes('DOWNLOAD'),
    // Proposal-specific permissions — mapped from PROPOSALS page permissions
    PROPOSAL_VIEW:     proposalsPermissions.includes('VIEW'),
    PROPOSAL_CREATE:   proposalsPermissions.includes('CREATE'),
    PROPOSAL_EDIT:     proposalsPermissions.includes('EDIT'),
    PROPOSAL_DELETE:   proposalsPermissions.includes('DELETE'),
    PROPOSAL_APPROVE:  proposalsPermissions.includes('APPROVE'),
    PROPOSAL_UPLOAD:   proposalsPermissions.includes('UPLOAD'),
    // VIEW on proposals grants download/view of PDFs; UPLOAD grants offline upload
    PROPOSAL_DOWNLOAD: proposalsPermissions.includes('VIEW'),
    PROPOSAL_OFFLINE_UPLOAD: proposalsPermissions.includes('UPLOAD') || proposalsPermissions.includes('CREATE'),
  };

  // ── UI state ─────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('leads_view_mode') || 'table');
  const [detailLead, setDetailLead] = useState(() => { try { const s = localStorage.getItem('leads_detail_lead'); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Data ─────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);

  // ── SERVER-SIDE PAGINATION state ─────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);   // 1-based for display
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // ── Filters ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  // Date range filter
  const [dateRangeMode, setDateRangeMode] = useState('all'); // 'all' | 'single' | 'range'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Column state ─────────────────────────────────────────────────
  const [columnOrder, setColumnOrder] = useState(DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ── Modals ───────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedLeadForFollowup, setSelectedLeadForFollowup] = useState(null);
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState(null);
  const [showQuickStatusModal, setShowQuickStatusModal] = useState(false);
  const [quickStatusLead, setQuickStatusLead] = useState(null);
  const [quickStatus, setQuickStatus] = useState('');
  const [quickStatusSaving, setQuickStatusSaving] = useState(false);
  const [quickClosedBy, setQuickClosedBy] = useState('');
  const [quickClosedByName, setQuickClosedByName] = useState('');
  const [quickClosedLostReason, setQuickClosedLostReason] = useState('');
  const [quickNotInterestedReason, setQuickNotInterestedReason] = useState('');
  const [quickDowngradeReason, setQuickDowngradeReason] = useState('');
  const [quickKivDate, setQuickKivDate] = useState('');
  const [quickKivTime, setQuickKivTime] = useState('09:00');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [phoneError, setPhoneError] = useState('');

  // ── Form ─────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    customerId: null, name: '', email: '', phone: '', source: 'Website',
    priority: 'Medium', status: 'New', assignedTo: null, enquiry: '',
    groupName: '', subGroupName: '', closedLostReason: '', notInterestedReason: '',
    statusDowngradeReason: '',
    closedByUserId: null, closedByName: '',
    referralName: '', referralPhone: '',
    capacity: '', capacityUnit: 'kW',
    leadOwner: user?.name || '',
    // New TC interested fields
    tcMonthlyBill: '', tcExistingContractLoad: '', tcRequiredContractLoad: '',
  });
  // The lead's status when the edit form was opened — the baseline the downgrade
  // guard compares against (formData.status changes as the user picks a new one).
  const [originalStatus, setOriginalStatus] = useState('');
  const [billFile, setBillFile] = useState(null);
  const [billFileUploading, setBillFileUploading] = useState(false);
  const [kivDate, setKivDate] = useState('');
  const [kivTime, setKivTime] = useState('09:00');
  // Baseline KIV "date time" captured when opening an existing KIV lead, so we
  // only (re)schedule a callback follow-up when it actually changes (no dupes).
  const kivBaselineRef = useRef('');

  // ── Derived columns ──────────────────────────────────────────────
  const orderedVisibleColumns = columnOrder
    .map(k => ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && (c.required || visibleColumns.includes(c.key)));

  // ── Fetch helpers ─────────────────────────────────────────────────
  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    'User-Id': currentUser.id,
    'User-Role': currentUser.role,
  });

  const fetchWithHeaders = async (url, opts = {}) => {
    const headers = { ...buildHeaders(), ...opts.headers };
    const res = await fetch(url, { ...opts, credentials: 'include', headers });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `HTTP ${res.status}`); }
    return res.json();
  };

  // ─────────────────────────────────────────────────────────────────
  // SERVER-SIDE FETCH — called whenever page / size / filters change
  // Uses POST /leads/filter so all filter params go in the body.
  // ─────────────────────────────────────────────────────────────────
  const fetchLeads = async (page, size, search, status, priority, source, group, subGroup, _reason, fromDate, toDate, sortByCol, sortDir) => {
  // console.trace('🚀 fetchLeads called — reason:', _reason);
  const seq = ++fetchLeadsSeq.current; // claim the latest-request slot
  setLoading(true);
  setError(null);
  try {
    // Sort precedence:
    //   1. Explicit args passed by handleSort (a fresh column click)
    //   2. The currently-active column sort held in state (so pagination,
    //      filtering, and refreshes keep the user's chosen order)
    //   3. Date-filter default (createdAt asc) when a date range is active
    //   4. null → backend default (createdAt desc)
    const activeCol = sortByCol !== undefined ? sortByCol : sortColumn;
    const activeDir = sortDir   !== undefined ? sortDir   : sortDirection;
    const mappedSort = activeCol ? SORT_FIELD_MAP[activeCol] : null;
    const effectiveSortBy = mappedSort || ((fromDate || toDate) ? 'createdAt' : null);
    const effectiveSortDir = mappedSort ? (activeDir || 'asc') : ((fromDate || toDate) ? 'asc' : null);

    const filterBody = {
      searchTerm:    search   || null,
      status:        status   !== 'All' ? status : null,
      priority:      priority !== 'All' ? priority : null,
      source:        source   !== 'All' ? source   : null,
      groupName:     group    || null,
      subGroupName:  subGroup || null,
      fromDate:      fromDate || null,
      toDate:        toDate   || null,
      sortBy:        effectiveSortBy,
      sortDirection: effectiveSortDir,
    };

    const data = await fetchWithHeaders(
      `${API_BASE_URL}/leads/filter?page=${page - 1}&size=${size}`,  // ← page param
      { method: 'POST', body: JSON.stringify(filterBody) }
    );

    // Race guard: a newer request started while this one was in flight → drop this result.
    if (seq !== fetchLeadsSeq.current) return;

    if (data.success) {
      setLeads(data.data || []);
      setTotalRecords(data.count ?? 0);
      setTotalPages(data.totalPages ?? Math.ceil((data.count ?? 0) / size));
    }
  } catch (e) {
    if (seq === fetchLeadsSeq.current) setError(e.message || 'Error fetching leads');
  } finally {
    // Only the newest request controls the loading spinner, so a stale
    // response resolving late can't prematurely hide the spinner.
    if (seq === fetchLeadsSeq.current) setLoading(false);
  }
  // ← NO }, [...]) at the end — this is NOT a useCallback
};

  // `users` backs every picker on this page that attributes a lead to somebody:
  // "Assign To" (create + edit) and "Closed By" (quick status + edit).
  //
  // It comes from /filters/assignable-users, which scopes by the REPORTING GRAPH:
  // a top-level role (hierarchy level 1–2) gets everyone, anybody else gets their
  // own reporting subtree — themselves plus every transitive report. The old
  // /filters/leads-users rule (role allow-lists narrowed by the free-text team
  // field) is gone from this page: a manager whose reports span five roles could
  // not be expressed by any role list without also exposing unrelated users.
  //
  // The endpoint takes no User-Role header on purpose — it resolves the role from
  // the database, and the same rule gates the write endpoints, so a hand-crafted
  // assign/close request cannot reach outside the subtree either.
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/filters/assignable-users`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setUsers(data);
    } catch (e) { console.error('fetchUsers failed:', e); setUsers([]); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/filters/all-users`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setAllUsers(data);
    } catch (e) { console.error('fetchAllUsers failed:', e); setAllUsers([]); }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/filters/leads-groups`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setGroups(data);
    } catch (e) { console.error('fetchGroups failed:', e); setGroups([]); }
  };

  const fetchSubGroupsForForm = async g => {
    if (!g) { setSubGroups([]); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/filters/leads-subgroups?groupName=${encodeURIComponent(g)}`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setSubGroups(data);
    } catch (e) { console.error('fetchSubGroupsForForm failed:', e); setSubGroups([]); }
  };
// Effect 1 — initial load
useEffect(() => {
  // console.log('⚡ Effect1 fired | canView:', canView, '| initialFetchDone:', initialFetchDone.current);
  if (!canView || initialFetchDone.current) return;
  initialFetchDone.current = true;
  fetchUsers();
  fetchAllUsers();
  fetchGroups();
  fetchLeads(1, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'INITIAL_LOAD', dateFrom, dateTo);
}, [canView]); // eslint-disable-line react-hooks/exhaustive-deps

// Effect 1b — refresh a cache-rehydrated detail lead on mount.
// detailLead is seeded from localStorage for instant render, but that snapshot
// can be stale (edited elsewhere since). Refetch by id once so the open detail
// view reflects current server data.
useEffect(() => {
  if (!canView || !detailLead?.id) return;
  let cancelled = false;
  fetchWithHeaders(`${API_BASE_URL}/leads/${detailLead.id}`)
    .then(d => {
      if (!cancelled && d?.success && d.data) {
        setDetailLead(d.data);
        localStorage.setItem('leads_detail_lead', JSON.stringify(d.data));
      }
    })
    .catch(() => {});
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [canView]); // run once when view permission resolves (mount)

// Keep the live ref in sync so debounced fetches read fresh page-size/group values.
filterStateRef.current = { rowsPerPage, groupName, subGroupName };

// Effect 2 — group/subGroup changes
useEffect(() => {
  // console.log('⚡ Effect2 fired | isFirstGroupRender:', isFirstGroupRender.current, '| groupName:', groupName, '| subGroupName:', subGroupName);
  if (isFirstGroupRender.current) { isFirstGroupRender.current = false; return; }
  if (!canView) return;
  setCurrentPage(1);
  fetchLeads(1, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'GROUP_CHANGE', dateFrom, dateTo);
}, [groupName, subGroupName]); // eslint-disable-line react-hooks/exhaustive-deps

// Effect 3 — search/filter debounced
useEffect(() => {
  // console.log('⚡ Effect3 fired | isFirstFilterRender:', isFirstFilterRender.current);
  if (isFirstFilterRender.current) { isFirstFilterRender.current = false; return; }
  if (!canView) return;
  setCurrentPage(1); // reset to page 1 whenever filters change
  const timer = setTimeout(() => {
    // Read page-size and group/subgroup from the live ref at fire time, so a
    // page-size change made during the 400ms debounce isn't lost to a stale
    // closure. (Deps intentionally exclude these to avoid double-fetching —
    // rows/group have their own immediate fetch paths.)
    const { rowsPerPage: rpp, groupName: gn, subGroupName: sgn } = filterStateRef.current;
    fetchLeads(1, rpp, searchTerm, statusFilter, priorityFilter, sourceFilter, gn, sgn, 'FILTER_CHANGE', dateFrom, dateTo);
  }, 400);
  return () => clearTimeout(timer);
}, [searchTerm, statusFilter, priorityFilter, sourceFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  // ── Form subgroup load ─────────────────────────────────────────────
  useEffect(() => {
    if (formData.groupName) fetchSubGroupsForForm(formData.groupName); else setSubGroups([]);
  }, [formData.groupName]);

  // ─────────────────────────────────────────────────────────────────
  // PAGINATION HANDLERS — each triggers a fresh backend fetch
  // ─────────────────────────────────────────────────────────────────
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchLeads(newPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'PAGE_CHANGE', dateFrom, dateTo);
  };

  const handleRowsPerPageChange = (newSize) => {
    setRowsPerPage(newSize);
    setCurrentPage(1);
    fetchLeads(1, newSize, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'ROWS_CHANGE', dateFrom, dateTo);
  };

  // ── Sort (server-side: sorts the FULL dataset, not just the current page) ──
  const handleSort = col => {
    // Only columns mapped to a real entity field can be sorted server-side.
    if (!SORT_FIELD_MAP[col]) return;
    const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col); setSortDirection(dir);
    setCurrentPage(1); // re-sorted list → start from page 1
    fetchLeads(1, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter,
      groupName, subGroupName, 'SORT_CHANGE', dateFrom, dateTo, col, dir);
  };

  // ── Drag column ───────────────────────────────────────────────────
  const handleColDragStart = (e, idx) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('col-dragging'); };
  const handleColDragOver = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(idx); };
  const handleColDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const visKeys = orderedVisibleColumns.map(c => c.key);
    const fromKey = visKeys[fromIdx], toKey = visKeys[dropIdx];
    const o = [...columnOrder];
    const a = o.indexOf(fromKey), b = o.indexOf(toKey);
    o.splice(a, 1); o.splice(b, 0, fromKey);
    setColumnOrder(o); setDragOverIndex(null); dragIndexRef.current = null;
  };
  const handleColDragEnd = e => { e.currentTarget.classList.remove('col-dragging'); setDragOverIndex(null); dragIndexRef.current = null; };

  // ── Column visibility ────────────────────────────────────────────
  const handleToggleColumn = k => setVisibleColumns(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);
  const handleResetColumns = () => { setColumnOrder(DEFAULT_ORDER); setVisibleColumns(DEFAULT_VISIBLE); };

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleView = async lead => {
    if (!canView) { showWarning('No permission'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) {
        setDetailLead(data.data);
        localStorage.setItem('leads_detail_lead', JSON.stringify(data.data));
        localStorage.removeItem('leads_detail_tab');
      }
    } catch (e) { showError(e.message || 'Error fetching lead'); }
  };

  // ── Deep-link: open a lead automatically when arriving from a notification.
  //    Route used by NotificationModule: /sales/leads?leadId=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  const leadDeepLinkRef = useRef(null);
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId || leadDeepLinkRef.current === leadId) return;
    leadDeepLinkRef.current = leadId;
    handleView({ id: Number(leadId) });   // fetches /leads/{id} and shows the detail page
    const next = new URLSearchParams(searchParams);
    next.delete('leadId');                 // clean the URL so back/refresh doesn't re-open
    setSearchParams(next, { replace: true });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = lead => {
    setFormData({
      id: lead.id, customerId: lead.customerId, name: lead.name, email: lead.email,
      phone: lead.phone, source: lead.source, priority: lead.priority, status: lead.status,
      assignedTo: lead.assignedTo, enquiry: lead.enquiry,
      groupName: lead.groupName || '', subGroupName: lead.subGroupName || '',
      // Pre-fill existing reasons / closer so editing an unrelated field doesn't
      // force re-entry or blank out recorded values.
      closedLostReason: lead.closedLostReason || '',
      notInterestedReason: lead.notInterestedReason || (lead.status === 'Not Interested' ? (lead.telecallerReason || '') : ''),
      // Always re-entered per downgrade — never pre-filled.
      statusDowngradeReason: '',
      closedByName: lead.closedByName || '',
      closedByUserId: lead.closedByUserId ?? '',
      // NEW fields:
      state: lead.state || '',
      district: lead.district || '',
      city: lead.city || '',
      pincode: lead.pincode || '',
      solarScheme: lead.solarScheme || '',
      subsidyRequired: lead.subsidyRequired || '',
      referralName: lead.referralName || '',
      referralPhone: lead.referralPhone || '',
      capacity: lead.capacity || '',
      capacityUnit: lead.capacityUnit || 'kW',
      leadOwner: lead.leadOwner || '',
      tcMonthlyBill: lead.tcMonthlyBill || '',
      tcExistingContractLoad: lead.tcExistingContractLoad || '',
      tcRequiredContractLoad: lead.tcRequiredContractLoad || '',
    });
    // Baseline for the downgrade guard — the status this lead had before editing.
    setOriginalStatus(lead.status || '');
    // Seed the KIV callback date/time from the lead so a KIV lead can be edited
    // without being blocked, and record the baseline to avoid duplicate follow-ups.
    if (lead.status === 'Keep in View' && lead.kivReminderDate) {
      const d = new Date(lead.kivReminderDate);
      if (!isNaN(d)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        setKivDate(dateStr); setKivTime(timeStr);
        kivBaselineRef.current = `${dateStr} ${timeStr}`;
      } else { setKivDate(''); setKivTime('09:00'); kivBaselineRef.current = ''; }
    } else {
      setKivDate(''); setKivTime('09:00'); kivBaselineRef.current = '';
    }
    setBillFile(null);
    setPhoneError(''); setShowAddModal(true);
  };

  const handleDelete = lead => { if (!canDelete) { showWarning('No permission'); return; } setDeleteConfirmation({ id: lead.id, name: lead.name }); };

  const confirmDelete = async () => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/delete/${deleteConfirmation.id}`, { method: 'DELETE' });
      if (data.success) {
        showSuccess('Lead deleted');
        setDeleteConfirmation(null);
        // If current page is now empty (last item deleted), go back one page
        const remainingOnPage = leads.length - 1;
        if (remainingOnPage === 0 && currentPage > 1) {
          handlePageChange(currentPage - 1);
        } else {
          fetchLeads(currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'DELETE_REFRESH', dateFrom, dateTo);
        }
      }
    } catch (e) { showError(e.message || 'Error deleting'); setDeleteConfirmation(null); }
  };

  const validatePhone = v => {
    const c = v.replace(/\D/g, '');
    if (c.length === 0) { setPhoneError(''); return c; }
    if (c.length > 10) { setPhoneError('Max 10 digits'); return c.slice(0, 10); }
    setPhoneError(''); return c;
  };

  const openQuickStatusModal = (lead) => {
    setQuickStatusLead(lead);
    setQuickStatus(lead.status || 'New');
    setQuickClosedBy(lead.closedByUserId ? String(lead.closedByUserId) : '');
    setQuickClosedByName(lead.closedByName || '');
    setQuickClosedLostReason('');
    setQuickNotInterestedReason('');
    setQuickDowngradeReason('');
    setQuickKivDate(''); setQuickKivTime('09:00');
    setShowQuickStatusModal(true);
  };

  const handleQuickStatus = async () => {
    if (!quickStatusLead || !quickStatus) return;
    if (quickStatus === 'Closed Won' && !quickClosedBy) { showError('Please select who closed this lead'); return; }
    if (quickStatus === 'Closed Lost' && !quickClosedLostReason.trim()) { showError('Please enter a reason for closing lost'); return; }
    if (quickStatus === 'Not Interested' && !quickNotInterestedReason.trim()) { showError('Please enter a reason for marking this lead Not Interested'); return; }
    if (quickStatus === 'Keep in View' && (!quickKivDate || !quickKivTime)) { showError('Please set the callback date & time'); return; }
    // Moving a lead BACKWARD in the funnel requires a reason (mirrors the backend guard).
    const quickIsDowngrade = isStatusDowngrade(quickStatusLead.status, quickStatus);
    if (quickIsDowngrade && !quickDowngradeReason.trim()) {
      showError(`Please enter a reason for moving this lead back from "${quickStatusLead.status}" to "${quickStatus}"`);
      return;
    }
    setQuickStatusSaving(true);
    try {
      const payload = {
        status: quickStatus,
        ...(quickStatus === 'Closed Won' && { closedByUserId: Number(quickClosedBy), closedByName: quickClosedByName }),
        ...(quickStatus === 'Closed Lost' && { closedLostReason: quickClosedLostReason.trim() }),
        ...(quickStatus === 'Not Interested' && { notInterestedReason: quickNotInterestedReason.trim() }),
        ...(quickStatus === 'Keep in View' && { kivReminderDate: quickKivDate }),
        ...(quickIsDowngrade && { statusDowngradeReason: quickDowngradeReason.trim() }),
      };
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/update/${quickStatusLead.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (data.success) {
        // For KIV: auto-create followup
        if (quickStatus === 'Keep in View' && quickKivDate) {
          try {
            await fetchWithHeaders(`${API_BASE_URL}/followups/create`, {
              method: 'POST',
              body: JSON.stringify({
                relatedType: 'LEAD', relatedId: quickStatusLead.id, leadId: quickStatusLead.id,
                followupType: 'Call', priority: 'Medium', status: 'Pending',
                scheduledAt: `${quickKivDate} ${quickKivTime}:00`,
                notes: 'Keep in View — client requested callback on this date',
              }),
            });
          } catch { /* non-fatal */ }
        }
        showSuccess(quickStatus === 'Closed Won' ? 'Status updated! ✅ Converted to Customer.' : `Status updated to ${quickStatus}`);
        setShowQuickStatusModal(false);
        fetchLeads(currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'STATUS_REFRESH', dateFrom, dateTo);
      }
    } catch (e) { showError(e.message || 'Failed to update status'); }
    finally { setQuickStatusSaving(false); }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const isTender = formData.source === 'Tender';
    if (!isTender && formData.phone && formData.phone.length !== 10) { setPhoneError('Must be exactly 10 digits'); return; }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) { showError('Please enter a valid email address'); return; }
    if (formData.id && !canEdit) { showWarning('No edit permission'); return; }
    if (!formData.id && !canCreate) { showWarning('No create permission'); return; }
    if (formData.status === 'Keep in View' && (!kivDate || !kivTime)) { showError('Please set the callback date & time for Keep in View'); return; }
    if (formData.status === 'Not Interested' && !(formData.notInterestedReason || '').trim()) { showError('Please enter a reason for marking this lead Not Interested'); return; }
    if (formData.status === 'Closed Won' && !formData.closedByUserId) { showError('Please select who closed this lead'); return; }
    // Moving an existing lead BACKWARD in the funnel requires a reason (mirrors the backend guard).
    if (formData.id && isStatusDowngrade(originalStatus, formData.status)
        && !(formData.statusDowngradeReason || '').trim()) {
      showError(`Please enter a reason for moving this lead back from "${originalStatus}" to "${formData.status}"`);
      return;
    }
    setLoading(true);
    try {
      const payload = { ...formData };
      // Persist the KIV callback date on the lead (drives the callback badge).
      if (formData.status === 'Keep in View' && kivDate) payload.kivReminderDate = kivDate;
      let savedLeadId = formData.id;

      const scheduleKivFollowup = async (leadId) => {
        if (formData.status !== 'Keep in View' || !kivDate) return;
        // Only create a callback follow-up when the KIV date/time is new or changed —
        // editing other fields on an existing KIV lead must not pile up duplicates.
        if (kivBaselineRef.current && `${kivDate} ${kivTime}` === kivBaselineRef.current) return;
        try {
          await fetchWithHeaders(`${API_BASE_URL}/followups/create`, {
            method: 'POST',
            body: JSON.stringify({
              relatedType: 'LEAD', relatedId: leadId, leadId,
              followupType: 'Call', priority: 'Medium', status: 'Pending',
              scheduledAt: `${kivDate} ${kivTime}:00`,
              notes: 'Keep in View — client requested callback on this date',
            }),
          });
        } catch { /* non-fatal — followup creation failure shouldn't block lead save */ }
      };

      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/update/${formData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (data.success) {
          savedLeadId = formData.id;
          await scheduleKivFollowup(savedLeadId);
          let billUploadFailed = false;
          if (billFile) {
            try {
              setBillFileUploading(true);
              const form = new FormData(); form.append('file', billFile);
              const uploadResp = await fetch(`${API_BASE_URL}/leads/${savedLeadId}/upload-bill`, {
                method: 'POST',
                headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
                body: form,
              });
              if (!uploadResp.ok) {
                billUploadFailed = true;
                const err = await uploadResp.json().catch(() => ({}));
                showError('Bill upload failed: ' + (err.message || uploadResp.status));
              }
            } catch (uploadErr) {
              billUploadFailed = true;
              showError('Bill upload failed: ' + uploadErr.message);
            } finally { setBillFileUploading(false); }
          }
          const wasClosedWon = data.data?.status === 'Closed Won';
          if (!billUploadFailed) {
            showSuccess(wasClosedWon ? 'Lead updated! ✅ Converted to Customer automatically.' : formData.status === 'Keep in View' ? 'Lead updated & KIV follow-up scheduled!' : 'Lead updated successfully');
          } else {
            showWarning('Lead updated, but the bill file did not upload. You can re-upload it from the lead.');
          }
          setShowAddModal(false); resetForm(); setKivDate(''); setKivTime('09:00');
          fetchLeads(currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'EDIT_REFRESH', dateFrom, dateTo);
          if (detailLead && detailLead.id === formData.id) {
            fetchWithHeaders(`${API_BASE_URL}/leads/${formData.id}`)
              .then(d => { if (d.success && d.data) { setDetailLead(d.data); localStorage.setItem('leads_detail_lead', JSON.stringify(d.data)); } })
              .catch(() => {});
          }
        }
      } else {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/create`, { method: 'POST', body: JSON.stringify(payload) });
        if (data.success) {
          savedLeadId = data.data?.id;
          await scheduleKivFollowup(savedLeadId);
          let billUploadFailed = false;
          if (billFile && savedLeadId) {
            try {
              setBillFileUploading(true);
              const form = new FormData(); form.append('file', billFile);
              const uploadResp = await fetch(`${API_BASE_URL}/leads/${savedLeadId}/upload-bill`, {
                method: 'POST',
                headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role },
                body: form,
              });
              if (!uploadResp.ok) {
                billUploadFailed = true;
                const err = await uploadResp.json().catch(() => ({}));
                showError('Bill upload failed: ' + (err.message || uploadResp.status));
              }
            } catch (uploadErr) {
              billUploadFailed = true;
              showError('Bill upload failed: ' + uploadErr.message);
            } finally { setBillFileUploading(false); }
          }
          const wasClosedWon = data.data?.status === 'Closed Won';
          if (!billUploadFailed) {
            showSuccess(wasClosedWon
              ? 'Lead created & automatically converted to Customer! ✅'
              : formData.status === 'Keep in View'
              ? 'Lead created & KIV follow-up scheduled!'
              : 'Lead created successfully');
          } else {
            showWarning('Lead created, but the bill file did not upload. You can re-upload it from the lead.');
          }
          setShowAddModal(false); resetForm(); setKivDate(''); setKivTime('09:00');
          setCurrentPage(1);
          fetchLeads(1, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'CREATE_REFRESH', dateFrom, dateTo);
        }
      }
    } catch (e) { showError(e.message || 'Error saving lead'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    // Pre-seed group/subgroup from page-level header filters
    const seedGroup    = groupName    || '';
    const seedSubGroup = subGroupName || '';
    setFormData({
      customerId: null, name: '', email: '', phone: '',
      source: 'Website', priority: 'Medium', status: 'New',
      assignedTo: null, enquiry: '', groupName: seedGroup, subGroupName: seedSubGroup,
      closedLostReason: '', notInterestedReason: '', statusDowngradeReason: '',
      closedByUserId: null, closedByName: '',
      // NEW:
      state: '', district: '', city: '', pincode: '', solarScheme: '', subsidyRequired: '',
      referralName: '', referralPhone: '',
      capacity: '', capacityUnit: 'kW',
      leadOwner: user?.name || '',   // ← auto-fill with logged-in user
      tcMonthlyBill: '', tcExistingContractLoad: '', tcRequiredContractLoad: '',
    });
    setOriginalStatus('');   // new lead — no downgrade baseline
    // Load subgroups for seeded group so the dropdown is ready
    if (seedGroup) fetchSubGroupsForForm(seedGroup);
    setPhoneError('');
    setBillFile(null);
    setKivDate(''); setKivTime('09:00'); kivBaselineRef.current = '';
  };

  // ── Badge helpers ─────────────────────────────────────────────────
  const getStatusClass = s => ({ 'New': 'leads-enquiries-badge-new', 'Proposal Sent': 'leads-enquiries-badge-proposal', 'Closed Won': 'leads-enquiries-badge-won', 'Closed Lost': 'leads-enquiries-badge-lost', 'Interested': 'leads-enquiries-badge-won', 'Not Interested': 'leads-enquiries-badge-lost', 'Not Responded': 'leads-enquiries-badge-default', 'Prospect': 'leads-enquiries-badge-prospect', 'Keep in View': 'leads-enquiries-badge-kiv' }[s] || 'leads-enquiries-badge-default');
  const getPriorityClass = p => ({ 'High': 'leads-enquiries-badge-high', 'Medium': 'leads-enquiries-badge-medium', 'Low': 'leads-enquiries-badge-low' }[p] || 'leads-enquiries-badge-default');

  // ── Sort icon ────────────────────────────────────────────────────
  const getSortIcon = col => {
    if (sortColumn !== col) return <svg className="sort-icon sort-icon-default" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortDirection === 'asc'
      ? <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="sort-icon sort-icon-active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  // ── Render cell ──────────────────────────────────────────────────
  const renderCell = (lead, colKey) => {
    const empty = <span style={{display:'block',textAlign:'center',color:__stc('#9ca3af')}}>—</span>;
    switch (colKey) {
      case 'name': return lead.name
        ? (
          <span className="leads-enquiries-font-medium" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {lead.source === 'Tender' && (
              <span style={{
                background: __sbg('#e0f2fe'), color: __stc('#0369a1'),
                borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0,
                border: `1px solid ${__sbg('#bae6fd')}`, letterSpacing: '0.3px',
              }}>📋 TENDER</span>
            )}
            {lead.name}
          </span>
        )
        : empty;
      case 'contact': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          {lead.email
            ? <span style={{ fontSize: 12, color: __stc('#1e293b'), display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2, color: __stc('#6366f1') }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 }}>{lead.email}</span>
              </span>
            : null}
          {lead.phone
            ? <span style={{ fontSize: 12, color: __stc('#374151'), display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: __stc('#10b981') }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                {lead.phone}
              </span>
            : null}
          {!lead.email && !lead.phone ? empty : null}
        </div>
      );
      case 'groupName': return lead.groupName || empty;
      case 'subGroupName': return lead.subGroupName || empty;
      case 'capacity': return lead.capacity ? `${lead.capacity} ${lead.capacityUnit || 'kW'}` : empty;
      case 'source': return lead.source || empty;
      case 'assignedToName': return lead.assignedToName || empty;
      case 'leadOwner': {
        if (!lead.leadOwner) return empty;
        // Backend now resolves the user id and avatar url directly on the lead object.
        // Fall back to allUsers lookup for legacy records that pre-date this field.
        const hasPhoto  = lead.leadOwnerAvatarUrl === 'db';
        const ownerId   = lead.leadOwnerUserId
          || allUsers.find(u => u.name?.trim().toLowerCase() === lead.leadOwner?.trim().toLowerCase())?.id;
        return (
          <span className="leads-owner-cell">
            <span className="leads-owner-avatar">
              {hasPhoto && ownerId
                ? <img src={`${API_BASE_URL}/users/avatar/${ownerId}`} alt={lead.leadOwner} className="leads-owner-avatar-img"
                    onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                  />
                : null
              }
              <span className="leads-owner-avatar-initials"
                style={{ display: (hasPhoto && ownerId) ? 'none' : 'flex' }}>
                {(lead.leadOwner[0] || '').toUpperCase()}
              </span>
            </span>
            <span className="leads-owner-name">{lead.leadOwner}</span>
          </span>
        );
      }
      case 'createdAt': return lead.createdAt ? (() => { const d = new Date(lead.createdAt); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })() : empty;
      case 'priority': return lead.priority
        ? <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>{lead.priority}</span>
        : empty;
      case 'status': {
        const unified = getUnifiedStatus(lead);
        return (
          <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'flex-start'}}>
            <span className={`leads-enquiries-badge ${getStatusClass(unified)}`}>{unified}</span>
            {unified==='Keep in View' && lead.kivReminderDate && (
              <span style={{fontSize:10,fontWeight:600,color:__stc('#7c3aed'),background:__sbg('#f5f3ff'),border:`1px solid ${__sbg('#e9d5ff')}`,borderRadius:20,padding:'1px 8px',whiteSpace:'nowrap'}}>
                🔔 {new Date(lead.kivReminderDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
              </span>
            )}
            {unified==='Closed Won' && lead.closedByName && (
              <span title="Closed by" style={{fontSize:10,fontWeight:600,color:__stc('#15803d'),background:__sbg('#f0fdf4'),border:`1px solid ${__sbg('#bbf7d0')}`,borderRadius:20,padding:'1px 8px',whiteSpace:'nowrap'}}>
                ✓ by {lead.closedByName}
              </span>
            )}
          </div>
        );
      }
      case 'actions': return (
        <div className="leads-enquiries-action-buttons-cell">
          {canView && (
            <button className="leads-enquiries-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View Details">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
          )}
          {canEdit && (
            <button className="leads-enquiries-action-btn leads-enquiries-action-edit" onClick={() => handleEdit(lead)} title="Edit">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          )}
          {canEdit && (
            <button className="leads-enquiries-action-btn leads-enquiries-action-status" onClick={() => openQuickStatusModal(lead)} title="Update Status">
              <GrDocumentUpdate size={16} />
            </button>
          )}
          <button className="leads-enquiries-action-btn leads-enquiries-action-timeline" onClick={() => { setSelectedLeadForTimeline(lead); setShowTimelineModal(true); }} title="Timeline">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          {canCreate && (
            <button className="leads-enquiries-action-btn leads-enquiries-action-followup" onClick={() => { setSelectedLeadForFollowup(lead); setShowFollowupModal(true); }} title="Follow-up">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
          )}
          {canDelete && (
            <button className="leads-enquiries-action-btn leads-enquiries-action-delete" onClick={() => handleDelete(lead)} title="Delete">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      );
      default: {
        const val = lead[colKey];
        return (val !== null && val !== undefined && val !== '') ? val : empty;
      }
    }
  };

  // ── Export Excel (ALL filtered data fetched from backend) ─────────────────
  const exportToCSV = async () => {
    if (!canView) { showWarning('No permission'); return; }
    try {
      setLoading(true);
      const filterBody = {
        searchTerm:   searchTerm   || null,
        status:       statusFilter !== 'All' ? statusFilter : null,
        priority:     priorityFilter !== 'All' ? priorityFilter : null,
        source:       sourceFilter !== 'All' ? sourceFilter : null,
        groupName:    groupName    || null,
        subGroupName: subGroupName || null,
        fromDate:     dateFrom     || null,
        toDate:       dateTo       || null,
        exportAll:    true,
      };
      const data = await fetchWithHeaders(
        `${API_BASE_URL}/leads/filter?page=0&size=10000`,
        { method: 'POST', body: JSON.stringify(filterBody) }
      );
      const allLeads = data.data || [];
      if (!allLeads.length) { showError('No records to export for the current filters.'); return; }

      // Build rows for xlsx
      const COLS = [
        { key: 'leadCode',         label: 'Lead Code'      },
        { key: 'name',             label: 'Client Name'    },
        { key: 'email',            label: 'Email'          },
        { key: 'phone',            label: 'Phone'          },
        { key: 'source',           label: 'Source'         },
        { key: 'priority',         label: 'Priority'       },
        { key: 'status',           label: 'Lead Status'    },
        { key: 'telecallerStatus', label: 'TC Status'      },
        { key: 'telecallerName',   label: 'Telecaller'     },
        { key: 'bdAssignedToName', label: 'BD Executive'   },
        { key: 'assignedToName',   label: 'Assigned To'    },
        { key: 'leadOwner',        label: 'Lead Owner'     },
        { key: 'groupName',        label: 'Group'          },
        { key: 'subGroupName',     label: 'Category'       },
        { key: 'state',            label: 'State'          },
        { key: 'district',         label: 'District'       },
        { key: 'city',             label: 'City'           },
        { key: 'pincode',          label: 'Pincode'        },
        { key: 'capacity',         label: 'Capacity'       },
        { key: 'capacityUnit',     label: 'Capacity Unit'  },
        { key: 'tcQuotedPrice',    label: 'Quoted Price'   },
        { key: 'tcPropertyType',   label: 'Property Type'  },
        { key: 'tcMonthlyBill',    label: 'Monthly Bill'   },
        { key: 'enquiry',          label: 'Enquiry'        },
        { key: 'createdAt',        label: 'Created At'     },
      ];

      const XLSX = await import('xlsx');
      const rows = allLeads.map(l =>
        Object.fromEntries(COLS.map(c => [c.label, l[c.key] ?? '']))
      );
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = COLS.map(c => ({ wch: Math.max(c.label.length + 4, 16) }));
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      XLSX.writeFile(wb, `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`);

      showSuccess(`✅ Exported ${allLeads.length} leads to Excel`);
    } catch (e) {
      showError('Export failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Pagination display ────────────────────────────────────────────
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecord = Math.min(currentPage * rowsPerPage, totalRecords);

  if (!canView) return (
    <div className="leads-enquiries-container">
      <div className="alert alert-warning">You do not have permission to view leads.</div>
    </div>
  );

  // ── Detail page ───────────────────────────────────────────────────
  if (detailLead) {
    return (
      <div className="leads-enquiries-container">
        {loading && <CrmPreloader text="Loading…" />}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LeadDetailPage
          lead={detailLead}
          currentUser={currentUser}
          permissions={permissions}
          onBack={() => {
            setDetailLead(null);
            localStorage.removeItem('leads_detail_lead');
            localStorage.removeItem('leads_detail_tab');
            fetchLeads(currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'BACK_REFRESH', dateFrom, dateTo);
          }}
          onLeadUpdated={() => {
            // Re-fetch the single lead so detail view shows fresh data immediately
            fetchWithHeaders(`${API_BASE_URL}/leads/${detailLead.id}`)
              .then(d => { if (d.success && d.data) { setDetailLead(d.data); localStorage.setItem('leads_detail_lead', JSON.stringify(d.data)); } })
              .catch(() => {});
            // Also refresh the list in the background
            fetchLeads(currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'LEAD_UPDATED', dateFrom, dateTo);
          }}
          onEdit={lead => { setDetailLead(null); handleEdit(lead); }}
          showSuccess={showSuccess}
          showError={showError}
        />

        {showAddModal && (
          <div className="leads-enquiries-modal-overlay">
            <div className="leads-enquiries-modal leads-enquiries-modal--wide leads-enquiries-modal--fixed-layout" onClick={e => e.stopPropagation()}>
              <div className="leads-enquiries-modal-header leads-enquiries-modal-header--fixed">
                <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
                <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="leads-enquiries-modal-scrollable-body">
                <LeadFormBody
                  formData={formData} setFormData={setFormData}
                  phoneError={phoneError} handlePhoneChange={e => setFormData(p => ({ ...p, phone: validatePhone(e.target.value) }))}
                  groups={groups} subGroups={subGroups} users={users} allUsers={allUsers}
                  canAssign={canAssign} loading={loading} currentUser={user}
                  billFile={billFile} setBillFile={setBillFile} billFileUploading={billFileUploading}
                  kivDate={kivDate} setKivDate={setKivDate} kivTime={kivTime} setKivTime={setKivTime}
                  originalStatus={originalStatus}
                  onCancel={() => setShowAddModal(false)} onSubmit={handleSubmit}
                />
              </div>
              <div className="leads-enquiries-modal-footer">
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" form="ld-lead-form" className="leads-enquiries-btn leads-enquiries-btn-primary" disabled={loading}>
                  {loading ? 'Saving…' : (formData.id ? 'Update Lead' : 'Save Lead')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Leads list ─────────────────────────────────────────────────────
  return (
    <div className="leads-enquiries-container">
      {loading && <CrmPreloader text="Loading Leads…" />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {deleteConfirmation && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-toast-wrapper">
            <DeleteConfirmationToast onConfirm={confirmDelete} onCancel={() => setDeleteConfirmation(null)} leadName={deleteConfirmation.name} />
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="leads-enquiries-breadcrumb">
        <span>Sales</span>
        <span className="leads-enquiries-breadcrumb-separator">&gt;</span>
        <span className="leads-enquiries-breadcrumb-active">Leads / Enquiries</span>
      </div>

      {/* Header */}
      <div className="leads-enquiries-header page-header-with-filter">
        <div className="leads-enquiries-title-with-icon"><h1>Leads</h1></div>
        <GroupCategoryFilter groupValue={groupName} subGroupValue={subGroupName} onChange={updateFilters} />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Action bar */}
      <div className="leads-enquiries-action-bar">
        <div className="leads-enquiries-search-wrapper">
          <svg className="leads-enquiries-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by name, email, phone, or ID…" className="leads-enquiries-search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="leads-enquiries-filters">
          <FilterSelect value={statusFilter} options={[{value:'All',label:'All Status'},...['New','Interested','Not Interested','Not Responded','Keep in View','Prospect','Proposal Sent','Closed Won','Closed Lost'].map(s=>({value:s,label:s}))]} placeholder="All Status" onChange={v=>setStatusFilter(v)} />
          <FilterSelect value={priorityFilter} options={[{value:'All',label:'All Priority'},...['High','Medium','Low'].map(s=>({value:s,label:s}))]} placeholder="All Priority" onChange={v=>setPriorityFilter(v)} />
          <FilterSelect value={sourceFilter} options={[{value:'All',label:'All Sources'},...['Website','Referral','Cold Call','Email','Walk-in','Social Media','Digital Marketing','Campaign','Tender','Others'].map(s=>({value:s,label:s}))]} placeholder="All Sources" onChange={v=>setSourceFilter(v)} />

          {/* Date range filter */}
          <div className="leads-date-filter-group">
            <LeadsDateRangeFilter
              appliedFrom={dateFrom}
              appliedTo={dateTo}
              onApply={(f, t) => {
                setDateFrom(f);
                setDateTo(t);
                setDateRangeMode(f === t ? 'single' : 'range');
              }}
              onClear={() => {
                setDateFrom('');
                setDateTo('');
                setDateRangeMode('all');
              }}
            />
          </div>
        </div>
        <div className="leads-enquiries-action-buttons">
          {canCreate && (
            <button
              className="leads-enquiries-btn leads-enquiries-btn-primary"
              onClick={() => { resetForm(); setShowAddModal(true); }}
            >
              <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add New Lead
            </button>
          )}
          {canView && (
            <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={exportToCSV} disabled={loading}>
              <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {loading ? 'Exporting…' : 'Export'}
            </button>
          )}
          {canCreate && (
            <LeadsExcelPanel
              currentUser={currentUser}
              onImportDone={() => { setCurrentPage(1); fetchLeads(1, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'IMPORT_REFRESH', dateFrom, dateTo); }}
            />
          )}
        </div>
      </div>

      {/* View toggle + column controls */}
      <div className="leads-enquiries-view-toggle-container">
        {viewMode === 'table' && (
          <ColumnVisibilityDropdown columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
        )}
        <div className="leads-enquiries-view-toggle">
          <button className={`leads-enquiries-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => { setViewMode('table'); localStorage.setItem('leads_view_mode', 'table'); }} title="Table View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Table
          </button>
          <button className={`leads-enquiries-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => { setViewMode('grid'); localStorage.setItem('leads_view_mode', 'grid'); }} title="Grid View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
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
                  <th className="ld-sno-th">S.No</th>
                  {orderedVisibleColumns.map((col, idx) => (
                    <DraggableHeaderCell key={col.key} col={col} index={idx} sortColumn={sortColumn} sortDirection={sortDirection} getSortIcon={getSortIcon} handleSort={handleSort}
                      onDragStart={handleColDragStart} onDragOver={handleColDragOver} onDrop={handleColDrop} onDragEnd={handleColDragEnd} isDragOver={dragOverIndex === idx} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={orderedVisibleColumns.length + 1} className="text-center py-4">No leads found</td></tr>
                ) : leads.map((lead, rowIndex) => (
                  <tr key={lead.id} onClick={() => canView && handleView(lead)} style={{ cursor: canView ? 'pointer' : 'default' }} className="leads-enquiries-clickable-row">
                    <td className="ld-sno-td">{(currentPage - 1) * rowsPerPage + rowIndex + 1}</td>
                    {orderedVisibleColumns.map(col => (
                      <td key={col.key} data-col={col.key} onClick={col.key === 'actions' ? e => e.stopPropagation() : undefined}>{renderCell(lead, col.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ServerPagination
            startRecord={startRecord}
            endRecord={endRecord}
            totalRecords={totalRecords}
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </div>
      ) : (
        /* GRID VIEW */
        <div className="leads-enquiries-grid-container">
          <div className="leads-enquiries-grid">
            {leads.map(lead => (
              <div key={lead.id} className="leads-enquiries-card">
                <div className="leads-enquiries-card-clickable" onClick={() => canView && handleView(lead)} style={{ cursor: canView ? 'pointer' : 'default' }}>
                  <div className="leads-enquiries-card-header">
                    <div className="leads-enquiries-card-id">{lead.leadCode}</div>
                    <div className="leads-enquiries-card-badges">
                      <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>{lead.priority}</span>
                      <span className={`leads-enquiries-badge ${getStatusClass(getUnifiedStatus(lead))}`}>{getUnifiedStatus(lead)}</span>
                    </div>
                  </div>
                  <div className="leads-enquiries-card-body">
                    <h3 className="leads-enquiries-card-title">{lead.name}</h3>
                    <div className="leads-enquiries-card-info">
                      <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>{lead.email}</span></div>
                      <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span>{lead.phone}</span></div>
                      {lead.groupName && <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg><span>{lead.groupName}</span></div>}
                      {lead.subGroupName && <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg><span>{lead.subGroupName}</span></div>}
                      {lead.capacity && <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg><span>{lead.capacity} {lead.capacityUnit || 'kW'}</span></div>}
                    </div>
                    {lead.enquiry && <div className="leads-enquiries-card-description">{lead.enquiry}</div>}
                  </div>
                </div>
                <div className="leads-enquiries-card-footer" onClick={e => e.stopPropagation()}>
                  <div className="leads-enquiries-card-source">
                    <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    {lead.source}
                  </div>
                  {lead.leadOwner && (
                    <div className="leads-enquiries-card-owner">
                      <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span>Owner: <strong>{lead.leadOwner}</strong></span>
                    </div>
                  )}
                  <div className="leads-enquiries-card-actions">
                    {canView && <button className="leads-enquiries-card-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View Details"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>}
                    <button className="leads-enquiries-card-action-btn leads-enquiries-action-timeline" onClick={() => { setSelectedLeadForTimeline(lead); setShowTimelineModal(true); }} title="Timeline"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                    {canCreate && <button className="leads-enquiries-card-action-btn leads-enquiries-action-followup" onClick={() => { setSelectedLeadForFollowup(lead); setShowFollowupModal(true); }} title="Follow-up"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>}
                    {permissions.PROPOSAL_VIEW && <button className="leads-enquiries-card-action-btn leads-enquiries-action-proposal" onClick={() => handleView(lead)} title="View Proposals"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>}
                    {canEdit && <button className="leads-enquiries-card-action-btn leads-enquiries-action-edit" onClick={() => handleEdit(lead)} title="Edit"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
                    {canEdit && <button className="leads-enquiries-card-action-btn leads-enquiries-action-status" onClick={() => openQuickStatusModal(lead)} title="Update Status"><GrDocumentUpdate size={16} /></button>}
                    {canDelete && <button className="leads-enquiries-card-action-btn leads-enquiries-action-delete" onClick={() => handleDelete(lead)} title="Delete"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ServerPagination
            startRecord={startRecord}
            endRecord={endRecord}
            totalRecords={totalRecords}
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </div>
      )}

      {/* Add / Edit Lead Modal */}
      {showAddModal && (
        <div className="leads-enquiries-modal-overlay">
          <div className="leads-enquiries-modal leads-enquiries-modal--wide leads-enquiries-modal--fixed-layout" onClick={e => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header leads-enquiries-modal-header--fixed">
              <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="leads-enquiries-modal-scrollable-body">
              <LeadFormBody
                formData={formData} setFormData={setFormData}
                phoneError={phoneError} handlePhoneChange={e => setFormData(p => ({ ...p, phone: validatePhone(e.target.value) }))}
                groups={groups} subGroups={subGroups} users={users} allUsers={allUsers}
                canAssign={canAssign} loading={loading} currentUser={user}
                billFile={billFile} setBillFile={setBillFile} billFileUploading={billFileUploading}
                kivDate={kivDate} setKivDate={setKivDate} kivTime={kivTime} setKivTime={setKivTime}
                originalStatus={originalStatus}
                onCancel={() => setShowAddModal(false)} onSubmit={handleSubmit}
              />
            </div>
          <div className="leads-enquiries-modal-footer">
                <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" form="ld-lead-form" className="leads-enquiries-btn leads-enquiries-btn-primary" disabled={loading}>
                  {loading ? 'Saving…' : (formData.id ? 'Update Lead' : 'Save Lead')}
                </button>
              </div>
        </div>
        </div>
      )}

      {/* Quick Status Modal */}
      {showQuickStatusModal && quickStatusLead && (
        <div className="qs-modal-overlay" onClick={()=>setShowQuickStatusModal(false)}>
          <div className="qs-modal" onClick={e=>e.stopPropagation()}>
            <div className="qs-modal-header">
              <div>
                <h3>Update Status</h3>
                <p>{quickStatusLead.leadCode} · {quickStatusLead.name}</p>
              </div>
              <button className="qs-modal-close" onClick={()=>setShowQuickStatusModal(false)}>✕</button>
            </div>

            <div className="qs-status-label">New Status</div>
            <div className="qs-status-grid">
              {LEAD_STATUS_OPTIONS.map(s=>{
                // Earlier funnel stages are locked once the lead has moved past them.
                // "Keep in View" (hold) and the terminal outcomes stay selectable.
                const locked = isStatusLocked(quickStatusLead.status, s);
                return (
                  <button key={s} type="button" disabled={locked}
                    className={`qs-status-btn${quickStatus===s?' active':''}${locked?' qs-status-btn--locked':''}`}
                    title={locked ? lockedStatusHint(quickStatusLead.status, s) : undefined}
                    onClick={()=>{ if(!locked) setQuickStatus(s); }}>{s}</button>
                );
              })}
            </div>

            {quickStatus==='Closed Won' && (
              <div className="qs-conditional qs-conditional-won">
                <div className="qs-conditional-label">✅ Closed Won — Closed By *</div>
                <FilterSelect value={quickClosedBy} options={users.map(u=>({value:String(u.id),label:u.name}))} placeholder="Select who closed this lead"
                  onChange={v=>{const u=users.find(u=>String(u.id)===v);setQuickClosedBy(v);setQuickClosedByName(u?.name||'');}}/>
              </div>
            )}

            {quickStatus==='Closed Lost' && (
              <div className="qs-conditional qs-conditional-lost">
                <div className="qs-conditional-label">❌ Closed Lost — Reason *</div>
                <textarea rows={3} value={quickClosedLostReason} onChange={e=>setQuickClosedLostReason(e.target.value)}
                  placeholder="Why was this lead closed as lost?"
                  style={{width:'100%',padding:'8px 10px',border:`1.5px solid ${__sbg('#fca5a5')}`,borderRadius:7,fontSize:13,resize:'vertical',boxSizing:'border-box',fontFamily:"'Poppins',sans-serif"}}/>
              </div>
            )}

            {quickStatus==='Not Interested' && (
              <div className="qs-conditional qs-conditional-lost">
                <div className="qs-conditional-label">❌ Not Interested — Reason *</div>
                <textarea rows={3} value={quickNotInterestedReason} onChange={e=>setQuickNotInterestedReason(e.target.value)}
                  placeholder="Why is this lead not interested?"
                  style={{width:'100%',padding:'8px 10px',border:`1.5px solid ${__sbg('#fca5a5')}`,borderRadius:7,fontSize:13,resize:'vertical',boxSizing:'border-box',fontFamily:"'Poppins',sans-serif"}}/>
              </div>
            )}

            {quickStatusLead && isStatusDowngrade(quickStatusLead.status, quickStatus) && (
              <div className="qs-conditional qs-conditional-lost">
                <div className="qs-conditional-label">⬇️ Moving back from “{quickStatusLead.status}” to “{quickStatus}” — Reason *</div>
                <textarea rows={3} value={quickDowngradeReason} onChange={e=>setQuickDowngradeReason(e.target.value)}
                  placeholder="Why is this lead being moved back to an earlier stage?"
                  style={{width:'100%',padding:'8px 10px',border:`1.5px solid ${__sbg('#fca5a5')}`,borderRadius:7,fontSize:13,resize:'vertical',boxSizing:'border-box',fontFamily:"'Poppins',sans-serif"}}/>
              </div>
            )}

            {quickStatus==='Keep in View' && (
              <div className="qs-conditional qs-conditional-kiv">
                <div className="qs-conditional-label">👁 Keep in View — Callback Date & Time *</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  <input type="date" value={quickKivDate} onChange={e=>setQuickKivDate(e.target.value)} min={todayLocalStr()}
                    style={{flex:'1 1 140px',padding:'8px 10px',border:`1.5px solid ${__sbg('#bfdbfe')}`,borderRadius:7,fontSize:13,fontFamily:"'Poppins',sans-serif"}}/>
                  <input type="time" value={quickKivTime} onChange={e=>setQuickKivTime(e.target.value)}
                    style={{flex:'1 1 110px',padding:'8px 10px',border:`1.5px solid ${__sbg('#bfdbfe')}`,borderRadius:7,fontSize:13,fontFamily:"'Poppins',sans-serif"}}/>
                </div>
                <div className="qs-time-presets">
                  {['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'].map(t=>(
                    <button key={t} type="button" className={`qs-time-preset${quickKivTime===t?' active':''}`} onClick={()=>setQuickKivTime(t)}>{t}</button>
                  ))}
                </div>
                {quickKivDate && <div className="qs-kiv-hint">📅 Follow-up auto-created for {new Date(quickKivDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} at {quickKivTime}</div>}
              </div>
            )}

            <div className="qs-footer">
              <button className="qs-btn-cancel" onClick={()=>setShowQuickStatusModal(false)}>Cancel</button>
              <button className="qs-btn-confirm" onClick={handleQuickStatus} disabled={quickStatusSaving}>
                {quickStatusSaving?'Saving…':'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowupModal && selectedLeadForFollowup && (
        <AddFollowupModal lead={selectedLeadForFollowup} onClose={() => { setShowFollowupModal(false); setSelectedLeadForFollowup(null); }} onFollowupCreated={() => { setShowFollowupModal(false); setSelectedLeadForFollowup(null); showSuccess('Follow-up created!'); fetchLeads(currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName, 'FOLLOWUP_REFRESH', dateFrom, dateTo); }} />
      )}

      {/* Timeline Modal */}
      {showTimelineModal && selectedLeadForTimeline && (
        <LeadTimelineModal lead={selectedLeadForTimeline} onClose={() => { setShowTimelineModal(false); setSelectedLeadForTimeline(null); }} onAddFollowup={() => { setShowTimelineModal(false); setSelectedLeadForFollowup(selectedLeadForTimeline); setShowFollowupModal(true); }} />
      )}
    </div>
  );
}

// ─── Server-Side Pagination widget ───────────────────────────────────────────
// Shows total record count from the server; fetches on every change.
const ServerPagination = ({
  startRecord, endRecord, totalRecords,
  currentPage, totalPages, rowsPerPage,
  onPageChange, onRowsPerPageChange
}) => {
  // Build visible page numbers (up to 5, centered on current)
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pages.push(i);
    return pages;
  };

  const tp = totalPages || 1;
  return (
    <div className="leads-enquiries-pagination">
      {/* Left: rows per page + info */}
      <div className="leads-enquiries-pagination-info">
        <span style={{whiteSpace:'nowrap'}}>Rows per page:</span>
        <FilterSelect
          value={String(rowsPerPage)}
          onChange={v => onRowsPerPageChange(Number(v))}
          options={[{value:'10',label:'10 rows'},{value:'20',label:'20 rows'},{value:'50',label:'50 rows'},{value:'100',label:'100 rows'}]}
          placeholder="Rows"
        />
        <span style={{whiteSpace:'nowrap',color:__stc('#64748b')}}>
          {totalRecords === 0 ? 'No records' : `${startRecord}–${endRecord} of ${totalRecords} leads`}
        </span>
        <span style={{fontSize:12,color:__stc('#94a3b8'),whiteSpace:'nowrap'}}>
          Page <strong style={{color:__stc('#0f172a')}}>{currentPage}</strong> of <strong style={{color:__stc('#0f172a')}}>{tp}</strong>
        </span>
      </div>
      {/* Right: page buttons */}
      <div className="leads-enquiries-pagination-buttons">
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1}>«</button>
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</button>
        {getPageNumbers().map(p => (
          <button key={p} className={`leads-enquiries-pagination-btn${p === currentPage ? ' leads-enquiries-pagination-btn-active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === tp || tp === 0}>›</button>
        <button className="leads-enquiries-pagination-btn" onClick={() => onPageChange(tp)} disabled={currentPage === tp || tp === 0}>»</button>
      </div>
    </div>
  );
};

// ─── Lead Owner Dropdown — searchable, with "Other" free-text fallback ──────────
function LeadOwnerDropdown({ users, value, onChange }) {
  const [search,   setSearch]   = React.useState('');
  const [open,     setOpen]     = React.useState(false);
  const [isOther,  setIsOther]  = React.useState(() =>
    value && !users.some(u => u.name === value) && value !== '' ? true : false
  );
  const [otherVal, setOtherVal] = React.useState(() =>
    value && !users.some(u => u.name === value) ? value : ''
  );
  const ref = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectUser = u => {
    setIsOther(false);
    setOtherVal('');
    onChange(u.name);
    setOpen(false);
    setSearch('');
  };

  const selectOther = () => {
    setIsOther(true);
    setOpen(false);
    setSearch('');
    onChange(otherVal);
  };

  const clearOwner = e => {
    e.stopPropagation();
    setIsOther(false);
    setOtherVal('');
    onChange('');
  };

  const displayLabel = isOther
    ? (otherVal || 'Enter name…')
    : (value || 'Select or search lead owner…');

  const isSelected = !!value || isOther;

  return (
    <div className="lo-wrap" ref={ref}>
      {/* Trigger button */}
      <button type="button" className={`lo-trigger ${open ? 'lo-trigger--open' : ''} ${isSelected ? 'lo-trigger--selected' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <span className="lo-trigger-icon">👤</span>
        <span className="lo-trigger-label">
          {isSelected
            ? <><span className="lo-selected-dot" />{displayLabel}</>
            : displayLabel}
        </span>
        {isSelected && (
          <span className="lo-clear" onClick={clearOwner} title="Clear">✕</span>
        )}
        <svg className={`lo-chevron ${open ? 'lo-chevron--up' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="lo-dropdown">
          {/* Search */}
          <div className="lo-search-wrap">
            <svg className="lo-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input autoFocus className="lo-search" placeholder="Search users…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button type="button" className="lo-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>

          {/* User list */}
          <div className="lo-list">
            {filtered.length === 0 && (
              <div className="lo-no-results">No users match "{search}"</div>
            )}
            {filtered.map(u => (
              <button key={u.id} type="button"
                className={`lo-item ${value === u.name && !isOther ? 'lo-item--active' : ''}`}
                onClick={() => selectUser(u)}>
                <span className="lo-avatar">{u.name?.[0]?.toUpperCase()}</span>
                <div className="lo-item-info">
                  <span className="lo-item-name">{u.name}</span>
                  {u.role && <span className="lo-item-role">{u.role}</span>}
                </div>
                {value === u.name && !isOther && <span className="lo-check">✓</span>}
              </button>
            ))}

            {/* Other option */}
            <button type="button"
              className={`lo-item lo-item--other ${isOther ? 'lo-item--active' : ''}`}
              onClick={selectOther}>
              <span className="lo-avatar lo-avatar--other">+</span>
              <div className="lo-item-info">
                <span className="lo-item-name">Other</span>
                <span className="lo-item-role">Enter a custom name</span>
              </div>
              {isOther && <span className="lo-check">✓</span>}
            </button>
          </div>
        </div>
      )}

      {/* Free-text input when "Other" is selected */}
      {isOther && (
        <input
          autoFocus
          type="text"
          className="lo-other-input"
          placeholder="Type owner name manually…"
          value={otherVal}
          onChange={e => { setOtherVal(e.target.value); onChange(e.target.value); }}
        />
      )}
    </div>
  );
}

// ─── Tender Form Section ─────────────────────────────────────────────────────
// The fields shown when "Tender Lead" mode is active.
const TenderFormSection = ({ tenderMeta, setTenderMeta, tenderDesc, setTenderDesc, groups, subGroups, users, allUsers, canAssign, formData, setFormData }) => {
  // Extensions: array of { newDeadline, reason }
  const addExtension = () => setTenderMeta(m => ({ ...m, extensions: [...(m.extensions || []), { newDeadline: '', reason: '' }] }));
  const updateExtension = (i, field, val) => setTenderMeta(m => {
    const exts = [...(m.extensions || [])];
    exts[i] = { ...exts[i], [field]: val };
    return { ...m, extensions: exts };
  });
  const removeExtension = (i) => setTenderMeta(m => ({ ...m, extensions: (m.extensions || []).filter((_, idx) => idx !== i) }));

  return (
    <div>
      {/* Tender notice banner */}
      <div style={{
        background: __sbg('#f0f9ff'), border: `1.5px solid ${__sbg('#bae6fd')}`,
        borderRadius: 10, padding: '10px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div>
          <div style={{ fontWeight: 700, color: __stc('#0369a1'), fontSize: 13 }}>Tender Lead Mode</div>
          <div style={{ fontSize: 11, color: __stc('#6b7280') }}>Fill in tender-specific fields. Documents can be uploaded from the Documents tab after saving.</div>
        </div>
      </div>

      {/* ── Tender Identity ─────────────────────────────────────────────── */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Tender Identity</h3>
        <div className="leads-enquiries-form-grid">
          <div className="leads-enquiries-form-group">
            <label>Tender Reference / NIT No.</label>
            <input type="text" value={tenderMeta.tenderRefNo || ''} onChange={e => setTenderMeta(m => ({ ...m, tenderRefNo: e.target.value }))} placeholder="e.g. NIT/2024-25/SOLAR/042" />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Tender Title *</label>
            <input type="text" required value={tenderMeta.tenderTitle || ''} onChange={e => setTenderMeta(m => ({ ...m, tenderTitle: e.target.value }))} placeholder="e.g. Supply & Installation of 5 MW Solar Plant" />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Issuing Authority / Organisation</label>
            <input type="text" value={tenderMeta.issuingAuthority || ''} onChange={e => setTenderMeta(m => ({ ...m, issuingAuthority: e.target.value }))} placeholder="e.g. SPDCL, NREDCAP, Govt of AP…" />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Tender Portal / Source</label>
            <input type="text" value={tenderMeta.tenderPortal || ''} onChange={e => setTenderMeta(m => ({ ...m, tenderPortal: e.target.value }))} placeholder="e.g. eprocure.gov.in, GeM, TANGEDCO portal…" />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Location Floated At</label>
            <input type="text" value={tenderMeta.locationFloated || ''} onChange={e => setTenderMeta(m => ({ ...m, locationFloated: e.target.value }))} placeholder="e.g. Visakhapatnam District, AP" />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Scope of Work</label>
            <input type="text" value={tenderMeta.scopeOfWork || ''} onChange={e => setTenderMeta(m => ({ ...m, scopeOfWork: e.target.value }))} placeholder="e.g. EPC, O&M, Supply Only…" />
          </div>
        </div>
      </div>

      {/* ── Tender Financials ───────────────────────────────────────────── */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Financials & Capacity</h3>
        <div className="leads-enquiries-form-grid">
          <div className="leads-enquiries-form-group">
            <label>Price Floated (₹)</label>
            <input type="text" value={tenderMeta.priceFloated || ''} onChange={e => setTenderMeta(m => ({ ...m, priceFloated: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g. 50000000" />
            {tenderMeta.priceFloated && <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>= ₹{Number(tenderMeta.priceFloated || 0).toLocaleString('en-IN')}</small>}
          </div>
          <div className="leads-enquiries-form-group">
            <label>EMD Amount (₹)</label>
            <input type="text" value={tenderMeta.emdAmount || ''} onChange={e => setTenderMeta(m => ({ ...m, emdAmount: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="Earnest Money Deposit" />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Project Capacity</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min="0" step="any" value={tenderMeta.capacity || ''} onChange={e => setTenderMeta(m => ({ ...m, capacity: e.target.value }))} placeholder="e.g. 5" style={{ flex: 1 }} />
              <select value={tenderMeta.capacityUnit || 'MW'} onChange={e => setTenderMeta(m => ({ ...m, capacityUnit: e.target.value }))} style={{ width: 80 }}>
                <option value="kW">kW</option>
                <option value="kWp">kWp</option>
                <option value="MW">MW</option>
                <option value="kVA">kVA</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tender Timeline ─────────────────────────────────────────────── */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Timeline & Dates</h3>
        <div className="leads-enquiries-form-grid">
          <div className="leads-enquiries-form-group">
            <label>Bid Submission Deadline *</label>
            <input type="date" value={tenderMeta.bidDeadline || ''} onChange={e => setTenderMeta(m => ({ ...m, bidDeadline: e.target.value }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Pre-Bid Meeting Date</label>
            <input type="date" value={tenderMeta.preBidDate || ''} onChange={e => setTenderMeta(m => ({ ...m, preBidDate: e.target.value }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Original Close Date</label>
            <input type="date" value={tenderMeta.originalCloseDate || ''} onChange={e => setTenderMeta(m => ({ ...m, originalCloseDate: e.target.value }))} />
          </div>
        </div>

        {/* Extensions */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontWeight: 600, color: __stc('#374151'), fontSize: 13 }}>Extensions / Corrigendum</label>
            <button type="button" onClick={addExtension} style={{
              background: __sbg('#fff7ed'), color: __stc('#c2410c'), border: `1px solid ${__sbg('#fed7aa')}`,
              borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>+ Add Extension</button>
          </div>
          {(tenderMeta.extensions || []).length === 0 ? (
            <div style={{ fontSize: 12, color: __stc('#9ca3af'), fontStyle: 'italic' }}>No extensions recorded.</div>
          ) : (
            (tenderMeta.extensions || []).map((ext, i) => (
              <div key={i} style={{
                background: __sbg('#fff7ed'), border: `1px solid ${__sbg('#fed7aa')}`, borderRadius: 8,
                padding: '10px 12px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-end',
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: __stc('#c2410c'), display: 'block', marginBottom: 3 }}>Extension {i + 1} — New Deadline</label>
                  <input type="date" value={ext.newDeadline || ''} onChange={e => updateExtension(i, 'newDeadline', e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${__sbg('#fed7aa')}`, borderRadius: 6, fontSize: 12, background: __sbg('#fff'), color: __stc('#111827'), boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: __stc('#c2410c'), display: 'block', marginBottom: 3 }}>Reason / Reference</label>
                  <input type="text" value={ext.reason || ''} onChange={e => updateExtension(i, 'reason', e.target.value)} placeholder="e.g. Corrigendum No. 1 — clarifications received" style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${__sbg('#fed7aa')}`, borderRadius: 6, fontSize: 12, background: __sbg('#fff'), color: __stc('#111827'), boxSizing: 'border-box' }} />
                </div>
                <button type="button" onClick={() => removeExtension(i)} style={{ background: __sbg('#fef2f2'), color: __stc('#dc2626'), border: `1px solid ${__sbg('#fecaca')}`, borderRadius: 6, padding: '7px 10px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Lead Metadata ───────────────────────────────────────────────── */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Lead Metadata</h3>
        <div className="leads-enquiries-form-grid">
          <div className="leads-enquiries-form-group">
            <label>Group</label>
            <FilterSelect value={formData.groupName} options={groups.map(g => ({ value: g.value || g.label, label: g.label || g.value }))} placeholder="Select Group" onChange={v => setFormData(p => ({ ...p, groupName: v, subGroupName: '' }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Category</label>
            <FilterSelect value={formData.subGroupName} options={subGroups.map(s => ({ value: s.value || s.label, label: s.label || s.value }))} placeholder={!formData.groupName ? 'Select Group First' : 'Select Category'} disabled={!formData.groupName} onChange={v => setFormData(p => ({ ...p, subGroupName: v }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Tender Status *</label>
            <FilterSelect value={formData.status} options={TENDER_STATUSES.map(s => ({ value: s, label: s }))} placeholder="Select Tender Status" onChange={v => setFormData(p => ({ ...p, status: v }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Priority</label>
            <FilterSelect value={formData.priority} options={['High', 'Medium', 'Low'].map(s => ({ value: s, label: s }))} placeholder="Select Priority" onChange={v => setFormData(p => ({ ...p, priority: v }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Assign To</label>
            <FilterSelect value={formData.assignedTo ? String(formData.assignedTo) : ''} options={users.map(u => ({ value: String(u.id), label: u.name }))} placeholder="Select Member" disabled={!canAssign} onChange={v => setFormData(p => ({ ...p, assignedTo: v ? Number(v) : null }))} />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Lead Owner</label>
            <LeadOwnerDropdown users={allUsers || []} value={formData.leadOwner || ''} onChange={name => setFormData(p => ({ ...p, leadOwner: name }))} />
          </div>
        </div>
      </div>

      {/* ── Additional Notes ─────────────────────────────────────────────── */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Notes & Remarks</h3>
        <div className="leads-enquiries-form-group">
          <label>Tender Notes / Remarks</label>
          <textarea rows={4} value={tenderDesc} onChange={e => setTenderDesc(e.target.value)} placeholder="Any additional context, requirements, competitive intelligence, etc." />
        </div>
      </div>
    </div>
  );
};

// ─── Lead Add/Edit form body ──────────────────────────────────────────────────
const LeadFormBody = ({ formData, setFormData, phoneError, handlePhoneChange, groups, subGroups, users, allUsers, canAssign, loading, onCancel, onSubmit, currentUser, billFile, setBillFile, billFileUploading, kivDate, setKivDate, kivTime, setKivTime, originalStatus = '' }) => {
  // ── Detect if this is an edit of an existing tender lead ──────────────────
  /* TENDER TYPE TEMPORARILY DISABLED — uncomment when re-enabling tender leads
  const isEditingTender = !!(formData.id && formData.source === 'Tender');
  const initialTenderMode = isEditingTender ||
    (formData.enquiry && formData.enquiry.startsWith(TENDER_META_PREFIX));
  */

  // ── Lead type toggle state ─────────────────────────────────────────────────
  // TENDER TYPE TEMPORARILY DISABLED — always customer for now
  // const [leadType, setLeadType] = React.useState(initialTenderMode ? 'tender' : 'customer');
  const leadType = 'customer';

  // ── Tender metadata state ─────────────────────────────────────────────────
  /* TENDER TYPE TEMPORARILY DISABLED
  const [tenderMeta, setTenderMeta] = React.useState(() => {
    if (!initialTenderMode) return {};
    const td = decodeTenderMeta(formData.enquiry);
    return td ? td.meta : {};
  });
  const [tenderDesc, setTenderDesc] = React.useState(() => {
    if (!initialTenderMode) return '';
    const td = decodeTenderMeta(formData.enquiry);
    return td ? td.description : '';
  });
  */

  // ── Sync tender metadata into formData.enquiry & formData.source ────────────
  /* TENDER TYPE TEMPORARILY DISABLED
  React.useEffect(() => {
    if (leadType !== 'tender') return;
    setFormData(p => ({
      ...p,
      source: 'Tender',
      enquiry: encodeTenderMeta(tenderMeta, tenderDesc),
    }));
  }, [tenderMeta, tenderDesc, leadType]); // eslint-disable-line react-hooks/exhaustive-deps
  */

  // ── When switching lead type, reset relevant fields ───────────────────────
  /* TENDER TYPE TEMPORARILY DISABLED
  const switchLeadType = (type) => {
    setLeadType(type);
    if (type === 'customer') {
      setFormData(p => ({ ...p, source: 'Website', enquiry: '' }));
    } else {
      setFormData(p => ({
        ...p,
        source: 'Tender',
        status: TENDER_STATUSES[0],
        enquiry: encodeTenderMeta(tenderMeta, tenderDesc),
        phone: p.phone || '',
      }));
    }
  };
  */

  // ── Pincode auto-fill ──────────────────────────────────────────────────────
  const [pincodeError, setPincodeError] = React.useState('');
  const pincodeDebounceRef              = React.useRef(null);
  const pincodeAbortRef                 = React.useRef(null);

  const handlePincodeChange = (value) => {
    if (!/^\d*$/.test(value)) return;

    // Cancel any pending debounce timer and abort any in-flight request
    if (pincodeDebounceRef.current) clearTimeout(pincodeDebounceRef.current);
    if (pincodeAbortRef.current)    pincodeAbortRef.current.abort();

    // Always clear error and stale auto-filled values when pin changes
    setPincodeError('');
    setFormData(p => ({ ...p, pincode: value, state: '', district: '' }));

    if (value.length !== 6) return;

    // Debounce: wait 600ms after the user stops typing before calling the API
    pincodeDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      pincodeAbortRef.current = controller;
      try {
        const res  = await fetch(`${API_BASE_URL}/pincode/${value}`, { credentials: 'include', signal: controller.signal });
        if (!res.ok) throw new Error('api_error');
        const data = await res.json();
        if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setFormData(p => ({ ...p, state: po.State, district: po.District }));
          setPincodeError('');
        } else {
          setPincodeError('Invalid PIN code');
        }
      } catch (err) {
        if (err.name !== 'AbortError') setPincodeError('Could not fetch PIN details');
      }
    }, 600);
  };

  return (
  <form id="ld-lead-form" onSubmit={onSubmit} className="leads-enquiries-form">

    {/* ── Lead Type Toggle — TEMPORARILY DISABLED (customer only for now) ──
    {!formData.id && (
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: `2px solid ${__sbg('#e5e7eb')}`, width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => switchLeadType('customer')}
          style={{
            padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: leadType === 'customer' ? __sbg('#2563eb') : __sbg('#f9fafb'),
            color: leadType === 'customer' ? '#fff' : __stc('#6b7280'),
            transition: 'all .15s',
          }}
        >
          👤 Customer Lead
        </button>
        <button
          type="button"
          onClick={() => switchLeadType('tender')}
          style={{
            padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            borderLeft: `2px solid ${__sbg('#e5e7eb')}`,
            background: leadType === 'tender' ? __sbg('#0369a1') : __sbg('#f9fafb'),
            color: leadType === 'tender' ? '#fff' : __stc('#6b7280'),
            transition: 'all .15s',
          }}
        >
          📋 Tender Lead
        </button>
      </div>
    )}
    ── End Lead Type Toggle */}

    {/* ── Editing Tender Badge — TEMPORARILY DISABLED
    {formData.id && leadType === 'tender' && (
      <div style={{ background: __sbg('#e0f2fe'), border: `1.5px solid ${__sbg('#bae6fd')}`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: __stc('#0369a1') }}>
        📋 Editing Tender Lead
      </div>
    )}
    ── End Editing Tender Badge */}

    {/* ── Tender Lead Form — TEMPORARILY DISABLED
    {leadType === 'tender' && (
      <>
        <div className="leads-enquiries-form-section">
          <h3 className="leads-enquiries-form-section-title">Tender Identification</h3>
          <div className="leads-enquiries-form-grid">
            <div className="leads-enquiries-form-group">
              <label>Tender Short Name / Organisation *</label>
              <input type="text" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. SPDCL 5MW Solar — AP" />
              <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>Used as the lead name in the list view.</small>
            </div>
            <div className="leads-enquiries-form-group">
              <label>Contact Person (optional)</label>
              <input type="text" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="Contact name or email at issuing authority" />
            </div>
            <div className="leads-enquiries-form-group">
              <label>Contact Phone (optional)</label>
              <input type="text" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit phone (optional)" maxLength="10" />
            </div>
          </div>
        </div>
        <TenderFormSection
          tenderMeta={tenderMeta}
          setTenderMeta={setTenderMeta}
          tenderDesc={tenderDesc}
          setTenderDesc={setTenderDesc}
          groups={groups}
          subGroups={subGroups}
          users={users}
          allUsers={allUsers}
          canAssign={canAssign}
          formData={formData}
          setFormData={setFormData}
        />
      </>
    )}
    ── End Tender Lead Form */}

    {/* ── Regular Customer Lead Form ─────────────────────────────────── */}
    {/* leadType === 'customer' condition removed — always customer for now */}
    {/* {leadType === 'customer' && ( */}
    <>
    <div className="leads-enquiries-form-section">
      <h3 className="leads-enquiries-form-section-title">Client Information</h3>
      <div className="leads-enquiries-form-grid">
        <div className="leads-enquiries-form-group">
          <label>Client Name *</label>
          <input type="text" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Email</label>
          <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Phone *</label>
          <input type="text" required value={formData.phone} onChange={handlePhoneChange} placeholder="10 digit number" maxLength="10" />
          {phoneError && <span className="phone-error-message">{phoneError}</span>}
        </div>
        <div className="leads-enquiries-form-group">
          <label>Group</label>
          <FilterSelect value={formData.groupName} options={groups.map(g=>({value:g.value||g.label,label:g.label||g.value}))} placeholder="Select Group" onChange={v=>setFormData(p=>({...p,groupName:v,subGroupName:''}))} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Category</label>
          <FilterSelect value={formData.subGroupName} options={subGroups.map(s=>({value:s.value||s.label,label:s.label||s.value}))} placeholder={!formData.groupName?'Select Group First':'Select Category'} disabled={!formData.groupName} onChange={v=>setFormData(p=>({...p,subGroupName:v}))} />
        </div>
      </div>
    </div>
    {formData.subGroupName === 'Solar_Rooftop' && (
      <div className="leads-enquiries-form-group">
        <label>Solar Scheme</label>
        <FilterSelect value={formData.solarScheme||''} options={[{value:'PM_Surya_Ghar',label:'PM Surya Ghar'},{value:'PM_Kusum',label:'PM Kusum'},{value:'State_Subsidy',label:'State Subsidy'},{value:'Net_Metering_Only',label:'Net Metering Only'},{value:'No_Scheme',label:'No Scheme'},{value:'Others',label:'Others'}]} placeholder="Select Scheme" onChange={v=>setFormData(p=>({...p,solarScheme:v,subsidyRequired:''}))} />
      </div>
    )}
    {formData.subGroupName === 'Solar_ground_mounted' && (
      <div className="leads-enquiries-form-group">
        <label>Solar Scheme</label>
        <FilterSelect value={formData.solarScheme||''} options={[{value:'PM_Kusum',label:'PM Kusum'},{value:'No_Scheme',label:'No Scheme'}]} placeholder="Select Scheme" onChange={v=>setFormData(p=>({...p,solarScheme:v,subsidyRequired:''}))} />
      </div>
    )}
    {formData.solarScheme === 'PM_Surya_Ghar' && (
      <div className="leads-enquiries-form-group">
        <label>Subsidy Required?</label>
        <div className="le-subsidy-toggle">
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button"
              className={'le-subsidy-btn' + (formData.subsidyRequired === opt ? ' le-subsidy-btn--' + opt.toLowerCase() : '')}
              onClick={() => setFormData(p => ({ ...p, subsidyRequired: p.subsidyRequired === opt ? '' : opt }))}>
              {opt === 'Yes' ? '✅ Yes, wants subsidy' : '❌ No subsidy needed'}
            </button>
          ))}
        </div>
        {formData.subsidyRequired && (
          <span className="le-subsidy-hint">
            {formData.subsidyRequired === 'Yes'
              ? 'Customer is eligible and wants the PM Surya Ghar subsidy.'
              : 'Customer does not require the subsidy.'}
          </span>
        )}
      </div>
    )}
    {/* Address Section — 2-column grid to reduce scrolling */}
    <div className="leads-enquiries-form-section">
      <h3 className="leads-enquiries-form-section-title">Address Details</h3>
      <div className="leads-enquiries-form-grid">
        <div className="leads-enquiries-form-group">
          <label>Pincode</label>
          <input
            type="text"
            value={formData.pincode || ''}
            onChange={e => handlePincodeChange(e.target.value)}
            maxLength="6"
            placeholder="Enter 6-digit PINCODE — auto fills State & District"
          />
          {pincodeError && <span style={{fontSize:11, color:__stc('#ef4444'), marginTop:2, display:'block'}}>{pincodeError}</span>}
        </div>
        <div className="leads-enquiries-form-group">
          <label>State</label>
          <input
            type="text"
            value={formData.state || ''}
            onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
            placeholder="Auto-filled by PINCODE or type manually"
          />
        </div>
        <div className="leads-enquiries-form-group">
          <label>District</label>
          <input
            type="text"
            value={formData.district || ''}
            onChange={e => setFormData(p => ({ ...p, district: e.target.value }))}
            placeholder="Auto-filled by PINCODE or type manually"
          />
        </div>
        <div className="leads-enquiries-form-group">
          <label>City / Village</label>
          <input type="text" value={formData.city || ''} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Uppal" />
        </div>
      </div>
    </div>
    <div className="leads-enquiries-form-section">
      <h3 className="leads-enquiries-form-section-title">Lead Details</h3>
      <div className="leads-enquiries-form-grid">
        <div className="leads-enquiries-form-group">
          <label>Lead Source *</label>
          <FilterSelect value={formData.source} options={['Website','Referral','Cold Call','Email','Walk-in','Social Media','Digital Marketing','Campaign','Others'].map(s=>({value:s,label:s}))} placeholder="Select Source" onChange={v=>setFormData(p=>({...p,source:v}))} />
        </div>
        {formData.source === 'Referral' && (
          <>
            <div className="leads-enquiries-form-group">
              <label>Referred By — Name</label>
              <LeadOwnerDropdown
                users={allUsers || []}
                value={formData.referralName || ''}
                onChange={name => {
                  // When a user is selected from the list, also auto-fill their phone
                  const matched = (allUsers || []).find(u => u.name === name);
                  setFormData(p => ({
                    ...p,
                    referralName: name,
                    referralPhone: matched?.phone ? matched.phone : p.referralPhone,
                  }));
                }}
              />
            </div>
            <div className="leads-enquiries-form-group">
              <label>Referred By — Phone</label>
              <input type="text" value={formData.referralPhone || ''} onChange={e => setFormData(p => ({ ...p, referralPhone: e.target.value.replace(/\D/g,'').slice(0,10) }))} placeholder="10-digit phone" maxLength="10" />
            </div>
          </>
        )}
        <div className="leads-enquiries-form-group">
          <label>Priority *</label>
          <FilterSelect value={formData.priority} options={['High','Medium','Low'].map(s=>({value:s,label:s}))} placeholder="Select Priority" onChange={v=>setFormData(p=>({...p,priority:v}))} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Status *</label>
          {/* On an existing lead, earlier funnel stages are locked once it has moved
              past them. "Keep in View" (hold) and terminal outcomes stay selectable. */}
          <FilterSelect
            value={formData.status}
            options={LEAD_STATUS_OPTIONS.map(s=>{
              const locked = !!formData.id && isStatusLocked(originalStatus, s);
              return { value:s, label:s, disabled: locked, disabledReason: locked ? lockedStatusHint(originalStatus, s) : undefined };
            })}
            placeholder="Select Status"
            onChange={v=>{setFormData(p=>({...p,status:v,...(v==='Closed Won'&&!p.closedByUserId?{closedByUserId:currentUser?.id||null,closedByName:currentUser?.name||''}:{})}));}} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Assign To</label>
          <FilterSelect value={formData.assignedTo?String(formData.assignedTo):''} options={users.map(u=>({value:String(u.id),label:u.name}))} placeholder="Select Member" disabled={!canAssign} onChange={v=>setFormData(p=>({...p,assignedTo:v?Number(v):null}))} />
          {!canAssign && <small style={{ color: __stc('#6b7280'), fontSize: 12 }}>No assign permission</small>}
        </div>
      </div>

      {formData.status === 'Keep in View' && (
        <div style={{background:__sbg('#f5f3ff'),border:`1.5px solid ${__sbg('#e9d5ff')}`,borderRadius:10,padding:'14px 16px',marginTop:4,marginBottom:4}}>
          <div style={{fontWeight:600,color:__stc('#6d28d9'),fontSize:13,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
            👁 Keep in View — Callback Date &amp; Time <span style={{fontSize:11,background:__sbg('#ede9fe'),color:__stc('#7c3aed'),borderRadius:4,padding:'1px 7px',fontWeight:700}}>Required</span>
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div style={{flex:'1 1 160px',minWidth:140}}>
              <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Date *</label>
              <input type="date" value={kivDate} onChange={e=>setKivDate(e.target.value)} min={todayLocalStr()}
                style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${__sbg('#c4b5fd')}`,borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{flex:'1 1 130px',minWidth:120}}>
              <label style={{fontSize:12,fontWeight:600,color:__stc('#374151'),display:'block',marginBottom:4}}>Time *</label>
              <input type="time" value={kivTime} onChange={e=>setKivTime(e.target.value)}
                style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${__sbg('#c4b5fd')}`,borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'].map(t=>(
                <button key={t} type="button" onClick={()=>setKivTime(t)}
                  style={{padding:'5px 10px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',border:kivTime===t?'none':'1.5px solid #e2e8f0',background:kivTime===t?__sbg('#7c3aed'):__sbg('#f8fafc'),color:kivTime===t?__stc('#fff'):__stc('#374151'),transition:'all .15s'}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {kivDate && <div style={{marginTop:8,fontSize:12,color:__stc('#7c3aed'),fontWeight:500}}>📅 A follow-up will be automatically created for {new Date(kivDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} at {kivTime}</div>}
        </div>
      )}

      {/* ── Lead Owner ──────────────────────────────────────────────────── */}
      <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Lead Owner
          <span style={{ background: __sbg('#EFF6FF'), color: __stc('#2563eb'), borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>OPTIONAL</span>
        </label>
        {/* Lead Owner is a NAME, not an assignment — it takes free text via the
            "Other" fallback and grants nobody anything. It therefore keeps the full
            user list (like the tender and referral pickers already did) rather than
            the subtree-scoped `users` that backs Assign To / Closed By. */}
        <LeadOwnerDropdown
          users={allUsers || []}
          value={formData.leadOwner || ''}
          onChange={val => setFormData(p => ({ ...p, leadOwner: val }))}
        />
        <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>Person responsible for this lead. Select from users or type a custom name.</small>
      </div>

      {formData.status === 'Closed Won' && (
        <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: __sbg('#dcfce7'), color: __stc('#166534'), borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>CLOSED WON</span>
            Closed By *
          </label>
          <FilterSelect value={formData.closedByUserId?String(formData.closedByUserId):''} options={users.map(u=>({value:String(u.id),label:u.name}))} placeholder="Select who closed this lead" onChange={v=>{const u=users.find(u=>String(u.id)===v);setFormData(p=>({...p,closedByUserId:v?Number(v):null,closedByName:u?.name||''}));}} />
          <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>Select the person who closed this deal.</small>
        </div>
      )}

      {formData.id && isStatusDowngrade(originalStatus, formData.status) && (
        <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: __sbg('#fee2e2'), color: __stc('#991b1b'), borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>REQUIRED</span>
            Reason for moving back from “{originalStatus}” to “{formData.status}” *
          </label>
          <textarea
            required
            rows={3}
            value={formData.statusDowngradeReason || ''}
            onChange={e => setFormData(p => ({ ...p, statusDowngradeReason: e.target.value }))}
            placeholder="Why is this lead being moved back to an earlier stage?"
            style={{ borderColor: __sbg('#fca5a5') }}
          />
          <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>This reason will be recorded in the lead history.</small>
        </div>
      )}

      {formData.status === 'Closed Lost' && (
        <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: __sbg('#fee2e2'), color: __stc('#991b1b'), borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>REQUIRED</span>
            Reason for Closing Lost *
          </label>
          <textarea
            required
            rows={3}
            value={formData.closedLostReason || ''}
            onChange={e => setFormData(p => ({ ...p, closedLostReason: e.target.value }))}
            placeholder="Please specify why this lead was closed as lost…"
            style={{ borderColor: __sbg('#fca5a5') }}
          />
          <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>This reason will be recorded in the lead history.</small>
        </div>
      )}

      {formData.status === 'Not Interested' && (
        <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: __sbg('#fee2e2'), color: __stc('#991b1b'), borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>REQUIRED</span>
            Reason for Not Interested *
          </label>
          <textarea
            required
            rows={3}
            value={formData.notInterestedReason || ''}
            onChange={e => setFormData(p => ({ ...p, notInterestedReason: e.target.value }))}
            placeholder="Please specify why this lead is not interested…"
            style={{ borderColor: __sbg('#fca5a5') }}
          />
          <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>This reason will be shown on the lead's detail page and recorded in the lead history.</small>
        </div>
      )}




      <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
        <label>Enquiry Description</label>
        <textarea rows={4} value={formData.enquiry} onChange={e => setFormData(p => ({ ...p, enquiry: e.target.value }))} placeholder="Describe the client's requirements…" />
      </div>

      <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
        <label>Project Capacity</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min="0"
            step="any"
            value={formData.capacity || ''}
            onChange={e => setFormData(p => ({ ...p, capacity: e.target.value }))}
            placeholder="e.g. 10"
            style={{ flex: 1 }}
          />
          <select
            value={formData.capacityUnit || 'kW'}
            onChange={e => setFormData(p => ({ ...p, capacityUnit: e.target.value }))}
            style={{ width: 90 }}
          >
            <option value="kW">kW</option>
            <option value="kWp">kWp</option>
            <option value="MW">MW</option>
            <option value="HP">HP</option>
            <option value="kVA">kVA</option>
            <option value="Units">Units</option>
          </select>
        </div>
        <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>Optional — enter the project capacity if known.</small>
      </div>

      {/* TC Interested Details (optional, available for pre-filling) */}
      <div className="leads-enquiries-form-section" style={{ marginTop: 16 }}>
        <h3 className="leads-enquiries-form-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Telecaller Interested Details
          <span style={{ background: __sbg('#f0fdf4'), color: __stc('#166534'), borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>OPTIONAL</span>
        </h3>
        <div className="leads-enquiries-form-grid">
          <div className="leads-enquiries-form-group">
            <label>Monthly Bill Amount (₹)</label>
            <input
              type="text"
              value={toINR(formData.tcMonthlyBill || '')}
              onChange={e => setFormData(p => ({ ...p, tcMonthlyBill: e.target.value.replace(/[^0-9]/g,'') }))}
              placeholder="e.g. 2,500"
            />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Existing Contract Load</label>
            <input
              type="text"
              value={formData.tcExistingContractLoad || ''}
              onChange={e => setFormData(p => ({ ...p, tcExistingContractLoad: e.target.value }))}
              placeholder="e.g. 5 kW"
            />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Required Contract Load</label>
            <input
              type="text"
              value={formData.tcRequiredContractLoad || ''}
              onChange={e => setFormData(p => ({ ...p, tcRequiredContractLoad: e.target.value }))}
              placeholder="e.g. 10 kW"
            />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Upload Current Bill (PDF/Image, max 10 MB)</label>
            <label className="le-bill-upload-label" style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              border: '1.5px dashed ' + (billFile ? __sbg('#059669') : __sbg('#d1d5db')),
              borderRadius: 8, padding: '8px 14px',
              background: billFile ? __sbg('#f0fdf4') : __sbg('#fafafa'),
              fontSize: 13, color: billFile ? __stc('#059669') : __stc('#6b7280'),
            }}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{billFile ? billFile.name : 'Choose bill file…'}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={e => setBillFile(e.target.files[0] || null)}
              />
            </label>
            {billFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: __stc('#059669') }}>✓ {billFile.name} selected</span>
                <button type="button" style={{ fontSize: 11, color: __stc('#dc2626'), background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setBillFile(null)}>✕ Remove</button>
              </div>
            )}
            <small style={{ color: __stc('#6b7280'), fontSize: 11 }}>Upload the customer's current electricity bill (optional, max 10 MB).</small>
          </div>
        </div>
      </div>
    </div>
    </> {/* end customer form — leadType condition removed temporarily */}
    {/* )} */}

  </form>
  );
};

export default LeadsEnquiries;