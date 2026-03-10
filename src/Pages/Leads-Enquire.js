// Leads-Enquiries.js — Enhanced with:
// • Lead Detail "page" (replaces view modal — full in-page panel with back button)
// • Integrated Proposals per lead (create / list / download PDF)
// • "Closed Lost" reason field → stored in lead_history via existing update API
// • Drag & drop column reorder + column visibility
// • Grid / Table toggle
// • SERVER-SIDE PAGINATION — page/size/filters are sent to backend on every change

import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../pages-css/Leads-Enquire.css';
import GroupCategoryFilter from '../components/Dropdowns/groupCategoryFilter.js';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters.js';
import { useAuth } from '../hooks/useAuth.js';
import useToast from '../hooks/useToast.js';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from '../components/preLoader.js';
import LeadTimelineModal from '../components/Leads/LeadTimelineModal.js';
import AddFollowupModal from '../components/Leads/AddFollowupModal.js';
import UnitTypeDropdown from '../components/Dropdowns/Unittypedropdown.js';
import LeadsExcelPanel from "./../components/Leads/LeadsExcelPanel.js";
import LeadFollowupsTab from './../components/Leads/LeadFollowupsTab';
const API_BASE_URL = process.env.REACT_APP_API_URL;

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
    <div className="ld-info-card" style={{ borderStyle: 'dashed', borderColor: '#E5E7EB' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 className="ld-card-title">Follow-ups</h4>
        <button className="ld-btn ld-btn-sec ld-btn-sm" onClick={onGoToFollowups}>Schedule →</button>
      </div>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>No follow-ups yet for this lead.</p>
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
          { label: 'Total',     val: data.length,      bg: '#F3F4F6', color: '#374151' },
          { label: 'Pending',   val: pending.length,   bg: '#FEF9C3', color: '#92400E' },
          { label: 'Overdue',   val: overdue.length,   bg: '#FEE2E2', color: '#991B1B' },
          { label: 'Completed', val: completed.length, bg: '#D1FAE5', color: '#065F46' },
        ].filter(s => s.val > 0).map(s => (
          <div key={s.label} style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
            <strong style={{ fontSize: 16 }}>{s.val}</strong> {s.label}
          </div>
        ))}
      </div>
      {latest && (
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', fontSize: 12, border: '1px solid #E5E7EB' }}>
          <span style={{ fontWeight: 600, color: '#374151' }}>
            {TYPE_ICON[latest.followupType] || '📌'} Next/Latest: {latest.followupType}
          </span>
          <span style={{ color: '#6B7280', marginLeft: 8 }}>
            {new Date(latest.scheduledAt).toLocaleDateString('en-IN')}
            {latest.assignedToName && ` · ${latest.assignedToName}`}
          </span>
          {latest.outcome && (
            <p style={{ margin: '5px 0 0', color: '#374151', lineHeight: 1.4 }}>
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
  { key: 'name', label: 'Client Name', sortable: true, required: true },
  { key: 'email', label: 'Email', sortable: true, required: false },
  { key: 'phone', label: 'Phone', sortable: true, required: false },
  { key: 'groupName', label: 'Group', sortable: true, required: false },
  { key: 'priority', label: 'Priority', sortable: true, required: false },
  { key: 'status', label: 'Status', sortable: true, required: false },
  { key: 'source', label: 'Source', sortable: true, required: false },
  { key: 'assignedToName', label: 'Assigned To', sortable: true, required: false },
  { key: 'createdAt', label: 'Created At', sortable: true, required: false },
  { key: 'actions', label: 'Actions', sortable: false, required: true },
];

const DEFAULT_ORDER = ALL_COLUMNS.map(c => c.key);
const DEFAULT_VISIBLE = ALL_COLUMNS
  .filter(c => !['source', 'assignedToName', 'createdAt'].includes(c.key))
  .map(c => c.key);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseJSON = s => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } };
const fmtDate = s => s ? new Date(s).toLocaleDateString() : '-';
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
    className={`col-draggable${isDragOver ? ' col-drag-over' : ''}`}
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
      const res = await fetch(`${apiBase}/api/bom-items-master/search?searchTerm=${encodeURIComponent(term)}`, { credentials: 'include', headers });
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
  const rmBOM = idx => { setTmpl({ ...tmpl, bomItems: tmpl.bomItems.filter((_, i) => i !== idx) }); const n = { ...customUnitInputs }; delete n[idx]; setCustomUnitInputs(n); };
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

  const handleSave = async () => {
    if (!formData.title) { alert('Please fill in Title'); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ ...formData, ...tmpl, systemPricing: JSON.stringify(tmpl.systemPricing), bomItems: JSON.stringify(tmpl.bomItems) });
      const url = existingProposal ? `${apiBase}/proposals/update/${existingProposal.id}` : `${apiBase}/proposals/create`;
      const method = existingProposal ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, credentials: 'include', body });
      const data = await res.json();
      if (data.success) onSaved(data.data || data.message);
    } catch (e) { alert('Failed to save proposal'); }
    finally { setSaving(false); }
  };

  const TABS = [
    { k: 'basic', l: 'Basic' }, { k: 'company', l: 'Company' }, { k: 'aboutUs', l: 'About Us' },
    { k: 'system', l: 'System' }, { k: 'pricing', l: 'Pricing' }, { k: 'payment', l: 'Payment' },
    { k: 'dlp', l: 'DLP' }, { k: 'bom', l: 'BOM' },
  ];

  return (
    <div className="ld-proposal-form">
      <div className="ld-ptabs">
        {TABS.map(t => <button key={t.k} className={`ld-ptab${activeTab === t.k ? ' active' : ''}`} onClick={() => setActiveTab(t.k)}>{t.l}</button>)}
      </div>

      <div className="ld-ptab-body">
        {activeTab === 'basic' && (
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
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                <option>Draft</option><option>Sent</option><option>Approved</option><option>Rejected</option><option>On Hold</option>
              </select>
            </div>
            <div className="ld-fgroup ld-full">
              <label>Description</label>
              <textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description..." />
            </div>
          </div>
        )}

        {activeTab === 'company' && (
          <div className="ld-fgroup"><label>Company Name</label>
            <input value={tmpl.companyName} onChange={e => setTmpl({ ...tmpl, companyName: e.target.value })} />
          </div>
        )}
        {activeTab === 'aboutUs' && (
          <div className="ld-fgroup"><label>About Us</label>
            <textarea rows={12} value={tmpl.aboutUs} onChange={e => setTmpl({ ...tmpl, aboutUs: e.target.value })} />
          </div>
        )}
        {activeTab === 'system' && (
          <div className="ld-fgroup"><label>About System</label>
            <textarea rows={12} value={tmpl.aboutSystem} onChange={e => setTmpl({ ...tmpl, aboutSystem: e.target.value })} />
          </div>
        )}
        {activeTab === 'payment' && (
          <div className="ld-fgroup"><label>Payment Terms</label>
            <textarea rows={12} value={tmpl.paymentTerms} onChange={e => setTmpl({ ...tmpl, paymentTerms: e.target.value })} />
          </div>
        )}
        {activeTab === 'dlp' && (
          <div className="ld-fgroup"><label>Defect Liability Period</label>
            <textarea rows={12} value={tmpl.defectLiabilityPeriod} onChange={e => setTmpl({ ...tmpl, defectLiabilityPeriod: e.target.value })} />
          </div>
        )}

        {activeTab === 'pricing' && (
          <div>
            <div className="ld-section-hdr"><span>System Pricing</span><button className="ld-btn ld-btn-sm ld-btn-sec" onClick={addPricing}>+ Add Row</button></div>
            <table className="ld-inner-table">
              <thead><tr><th>Item</th><th>Description</th><th>Amount (₹)</th><th style={{ width: 40 }}>×</th></tr></thead>
              <tbody>
                {tmpl.systemPricing.length === 0
                  ? <tr><td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>No items — click "+ Add Row"</td></tr>
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

        {activeTab === 'bom' && (
          <div>
            <div className="ld-section-hdr"><span>Bill of Materials</span><button className="ld-btn ld-btn-sm ld-btn-sec" onClick={addBOM}>+ Add Row</button></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ld-inner-table ld-bom-tbl">
                <thead><tr><th>Item Name*</th><th>Spec</th><th>Qty</th><th>Unit</th><th>Rate(₹)</th><th>Tax%</th><th>Amount</th><th style={{ width: 40 }}>×</th></tr></thead>
                <tbody>
                  {tmpl.bomItems.length === 0
                    ? <tr><td colSpan="8" style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>No items — click "+ Add Row"</td></tr>
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
                                      {bom.specification && <span style={{ fontSize: 11, color: '#6b7280' }}>{bom.specification}</span>}
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
                              : <UnitTypeDropdown value={row.unit || ''} onChange={e => { if (e.target.value === 'Custom') { setCustomUnitInputs(p => ({ ...p, [i]: '' })); updBOM(i, 'unit', ''); } else { const n = { ...customUnitInputs }; delete n[i]; setCustomUnitInputs(n); updBOM(i, 'unit', e.target.value); } }} className="proposal-unit-dropdown" placeholder="Unit" />
                            }
                          </td>
                          <td><input type="number" value={row.rate} onChange={e => updBOM(i, 'rate', e.target.value)} placeholder="0.00" /></td>
                          <td><select value={row.tax || '18'} onChange={e => updBOM(i, 'tax', e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></td>
                          <td><input type="number" value={row.amount} readOnly style={{ background: '#f9fafb', fontWeight: 600 }} /></td>
                          <td><button className="ld-del-row" onClick={() => rmBOM(i)}>🗑</button></td>
                        </tr>
                      ))}
                      <tr className="ld-subtotal-row"><td colSpan="6" style={{ textAlign: 'right', fontWeight: 600 }}>Subtotal:</td><td style={{ fontWeight: 600 }}>₹{bomTotals().sub}</td><td /></tr>
                      <tr className="ld-subtotal-row"><td colSpan="6" style={{ textAlign: 'right', fontWeight: 600 }}>Tax:</td><td style={{ fontWeight: 600, color: '#d97706' }}>₹{bomTotals().tax}</td><td /></tr>
                      <tr className="ld-total-row"><td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold' }}>Grand Total:</td><td style={{ fontWeight: 'bold', color: '#059669' }}>₹{bomTotals().grand}</td><td /></tr>
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
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>₹{parseFloat(latest.totalValue || 0).toLocaleString('en-IN')}</span>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Lead Detail Page (full-page view inside leads container) ─────────────────
const LeadDetailPage = ({ lead, currentUser, onBack, permissions, onEdit, showSuccess, showError }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [followupModal, setFollowupModal] = useState(false);
  const [timelineModal, setTimelineModal] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'User-Id': String(currentUser.id), 'User-Role': currentUser.role };

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

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${lead.id}/history`, { credentials: 'include', headers });
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch { }
    finally { setLoadingHistory(false); }
  }, [lead.id]);

  useEffect(() => {
    if (activeTab === 'proposals') fetchProposals();
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const downloadPDF = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/proposals/download-pdf/${id}`, { credentials: 'include', headers: { 'User-Id': String(currentUser.id), 'User-Role': currentUser.role } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `proposal-${id}.pdf`; a.click(); window.URL.revokeObjectURL(url);
    } catch { showError('Failed to download PDF'); }
  };

  const getStatusClass = s => ({
    'New': 'leads-enquiries-badge-new', 'Contacted': 'leads-enquiries-badge-contacted', 'In Discussion': 'leads-enquiries-badge-discussion',
    'Proposal Sent': 'leads-enquiries-badge-proposal', 'Closed Won': 'leads-enquiries-badge-won', 'Closed Lost': 'leads-enquiries-badge-lost',
  }[s] || 'leads-enquiries-badge-default');

  const getPriorityClass = p => ({ 'High': 'leads-enquiries-badge-high', 'Medium': 'leads-enquiries-badge-medium', 'Low': 'leads-enquiries-badge-low' }[p] || 'leads-enquiries-badge-default');

  const getPropStatusClass = s => ({ Draft: 'ld-ps-draft', Sent: 'ld-ps-sent', Approved: 'ld-ps-approved', Rejected: 'ld-ps-rejected', 'On Hold': 'ld-ps-hold' }[s] || 'ld-ps-draft');

  const getHistoryIcon = type => {
    const icons = { STATUS_CHANGE: '🔄', FOLLOW_UP: '📅', PROPOSAL_CREATED: '📝', CREATED: '✅', UPDATED: '✏️', CLOSED_LOST_REASON: '❌', CONVERTED: '🎉' };
    return icons[type] || '📌';
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
          <span style={{ cursor: 'pointer', color: '#6b7280' }} onClick={onBack}>Leads</span>
          <span style={{ margin: '0 6px', color: '#d1d5db' }}>/</span>
          <span style={{ color: '#111827', fontWeight: 500 }}>{lead.leadCode}</span>
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
          <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>{lead.status}</span>
        </div>
        <div className="ld-hero-actions">
          {permissions.CREATE && (
            <>
              <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => { setActiveTab('followups'); setFollowupModal(false); }}>
                <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Add Follow-up
              </button>
              <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={() => { setActiveTab('proposals'); setShowProposalForm(true); setEditingProposal(null); }}>
                <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                New Proposal
              </button>
            </>
          )}
        </div>
      </div>

      <div className="ld-tabs">
        {[
          { k: 'overview', l: 'Overview' },
          { k: 'proposals', l: 'Proposals' },
          { k: 'followups', l: 'Follow-ups' },
          { k: 'history', l: 'History' },
        ].map(t => (
          <button key={t.k}
            className={`ld-tab${activeTab === t.k ? ' active' : ''}`}
            onClick={() => { setActiveTab(t.k); setShowProposalForm(false); }}>
            {t.l}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="ld-tab-content">
          <div className="ld-info-grid">
            <div className="ld-info-card">
              <h4 className="ld-card-title">Contact Information</h4>
              <div className="ld-field-list">
                {[
                  ['Email', lead.email || '-'],
                  ['Phone', lead.phone || '-'],
                  ['Source', lead.source || '-'],
                  ['Group', lead.groupName || '-'],
                  ['Category', lead.subGroupName || '-'],
                ].map(([l, v]) => (
                  <div className="ld-field-row" key={l}>
                    <span className="ld-field-label">{l}</span>
                    <span className="ld-field-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ld-info-card">
              <h4 className="ld-card-title">Assignment & Dates</h4>
              <div className="ld-field-list">
                {[
                  ['Assigned To', lead.assignedToName || '-'],
                  ['Created By', lead.createdByName || '-'],
                  ['Created At', lead.createdAt ? fmtDate(lead.createdAt) : '-'],
                  ['Updated At', lead.updatedAt ? fmtDate(lead.updatedAt) : '-'],
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
                <h4 className="ld-card-title">Address</h4>
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
                <h4 className="ld-card-title">Solar Scheme</h4>
                <div className="ld-field-list">
                  <div className="ld-field-row">
                    <span className="ld-field-label">Scheme</span>
                    <span className="ld-field-val">{lead.solarScheme.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* BD assignment info — shown when lead has been handed off */}
            {lead.bdAssignedToName && (
              <div className="ld-info-card">
                <h4 className="ld-card-title">Team Assignment</h4>
                <div className="ld-field-list">
                  {[
                    ['Telecaller', lead.telecallerName || lead.assignedToName],
                    ['BD Executive', lead.bdAssignedToName],
                    ['BD Assigned At', lead.bdAssignedAt],
                    ['TC Status', lead.telecallerStatus],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div className="ld-field-row" key={l}>
                      <span className="ld-field-label">{l}</span>
                      <span className="ld-field-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Telecaller interaction details — shown when TC has marked Interested */}
            {(lead.tcDiscussionNote || lead.tcLocation || lead.tcSiteVisitDate || lead.tcPropertyType || lead.tcQuotedPrice || lead.tcAddons || lead.tcOtherComments) && (
              <div className="ld-info-card">
                <h4 className="ld-card-title">Telecaller Interaction Details</h4>
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
                    ['Add-ons', lead.tcAddons],
                    ['Other Comments', lead.tcOtherComments],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div className="ld-field-row" key={l}>
                      <span className="ld-field-label">{l}</span>
                      <span className="ld-field-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="ld-enquiry-card">
            <h4 className="ld-card-title">Enquiry Description</h4>
            <p className="ld-enquiry-text">{lead.enquiry || 'No description provided.'}</p>
          </div>
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

      {activeTab === 'proposals' && (
        <div className="ld-tab-content">
          {showProposalForm ? (
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
                onSaved={() => { setShowProposalForm(false); setEditingProposal(null); showSuccess(editingProposal ? 'Proposal updated!' : 'Proposal created!'); fetchProposals(); }}
                onCancel={() => { setShowProposalForm(false); setEditingProposal(null); }}
              />
            </div>
          ) : (
            <div>
              <div className="ld-section-hdr">
                <h4 className="ld-card-title" style={{ margin: 0 }}>{proposals.length} Proposal{proposals.length !== 1 ? 's' : ''}</h4>
                {permissions.CREATE && (
                  <button className="ld-btn ld-btn-pri" onClick={() => { setShowProposalForm(true); setEditingProposal(null); }}>
                    + New Proposal
                  </button>
                )}
              </div>

              {loadingProposals ? (
                <div className="ld-loading-row"><div className="p-loading-spinner"></div> Loading proposals…</div>
              ) : proposals.length === 0 ? (
                <div className="ld-empty-state">
                  <div className="ld-empty-icon">📝</div>
                  <p>No proposals yet for this lead.</p>
                  {permissions.CREATE && <button className="ld-btn ld-btn-pri" onClick={() => setShowProposalForm(true)}>Create First Proposal</button>}
                </div>
              ) : (
                <div className="ld-proposals-list">
                  {proposals.map(p => (
                    <div key={p.id} className="ld-proposal-card">
                      <div className="ld-proposal-card-left">
                        <div className="ld-proposal-no">{p.proposalNo}</div>
                        <div className="ld-proposal-title">{p.title}</div>
                        <div className="ld-proposal-meta">
                          <span>v{p.version}</span>
                          <span>·</span>
                          <span>₹{p.totalValue ? parseFloat(p.totalValue).toLocaleString('en-IN') : '0'}</span>
                          <span>·</span>
                          <span>{fmtDT(p.updatedAt)}</span>
                          {p.preparedByName && <><span>·</span><span>by {p.preparedByName}</span></>}
                        </div>
                      </div>
                      <div className="ld-proposal-card-right">
                        <span className={`ld-proposal-status ${getPropStatusClass(p.status)}`}>{p.status}</span>
                        <div className="ld-proposal-actions">
                          <button className="ld-pact-btn" onClick={() => downloadPDF(p.id)} title="Download PDF">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            PDF
                          </button>
                          {permissions.EDIT && (
                            <button className="ld-pact-btn ld-pact-edit" onClick={() => { setEditingProposal(p); setShowProposalForm(true); }} title="Edit">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'followups' && (
        <div className="ld-tab-content">
          <LeadFollowupsTab
            lead={lead}
            currentUser={currentUser}
            permissions={permissions}
            onRefreshLead={() => {
              // re-fetch the lead to update pending followups count in overview
              fetch(`${API_BASE_URL}/leads/${lead.id}`, {
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Id': String(currentUser.id),
                  'User-Role': currentUser.role,
                }
              })
                .then(r => r.json())
                .then(data => { if (data.success) showSuccess('Follow-up updated'); })
                .catch(() => { });
            }}
          />
        </div>
      )}
      {activeTab === 'history' && (
        <div className="ld-tab-content">
          <h4 className="ld-card-title">Activity History</h4>
          {loadingHistory ? (
            <div className="ld-loading-row"><div className="p-loading-spinner"></div> Loading history…</div>
          ) : history.length === 0 ? (
            <div className="ld-empty-state"><div className="ld-empty-icon">📋</div><p>No history found.</p></div>
          ) : (
            <div className="ld-history-list">
              {history.map(h => (
                <div key={h.id} className="ld-history-item">
                  <div className="ld-history-icon">{getHistoryIcon(h.actionType)}</div>
                  <div className="ld-history-body">
                    <div className="ld-history-hdr">
                      <span className="ld-history-type">{h.actionType?.replace(/_/g, ' ')}</span>
                      <span className="ld-history-date">{fmtDT(h.createdAt)}</span>
                      {h.createdByName && <span className="ld-history-by">by {h.createdByName}</span>}
                    </div>
                    {h.description && <div className="ld-history-desc">{h.description}</div>}
                    {h.fieldChanged && (
                      <div className="ld-history-change">
                        <span className="ld-chg-field">{h.fieldChanged}</span>:
                        {h.oldValue && <><span className="ld-chg-old">{h.oldValue}</span><span style={{ margin: '0 4px', color: '#9ca3af' }}>→</span></>}
                        {h.newValue && <span className="ld-chg-new">{h.newValue}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {followupModal && (
        <AddFollowupModal
          lead={lead}
          onClose={() => setFollowupModal(false)}
          onFollowupCreated={() => { setFollowupModal(false); showSuccess('Follow-up created!'); }}
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
// ═══════════════════════════════════════════════════════════════════
function LeadsEnquiries() {
  const { user, pagePermissions } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // ── Permissions ──────────────────────────────────────────────────
  const leadsPermissions = pagePermissions?.LEADS || [];
  const canView = leadsPermissions.includes('VIEW');
  const canCreate = leadsPermissions.includes('CREATE');
  const canEdit = leadsPermissions.includes('EDIT');
  const canDelete = leadsPermissions.includes('DELETE');
  const canAssign = leadsPermissions.includes('ASSIGN');

  const currentUser = { id: user.id || 1, role: user.role || 'USER', name: user.name || 'Current User' };

  const permissions = {
    VIEW: canView, CREATE: canCreate, EDIT: canEdit, DELETE: canDelete,
    APPROVE: leadsPermissions.includes('APPROVE'), DOWNLOAD: leadsPermissions.includes('DOWNLOAD'),
  };

  // ── UI state ─────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState('table');
  const [detailLead, setDetailLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Data ─────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
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
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [phoneError, setPhoneError] = useState('');

  // ── Form ─────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    customerId: null, name: '', email: '', phone: '', source: 'Website',
    priority: 'Medium', status: 'New', assignedTo: null, enquiry: '',
    groupName: '', subGroupName: '', closedLostReason: '',
  });

  // ── Derived columns ──────────────────────────────────────────────
  const orderedVisibleColumns = columnOrder
    .map(k => ALL_COLUMNS.find(c => c.key === k))
    .filter(c => c && visibleColumns.includes(c.key));

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
  const fetchLeads = useCallback(async (page = currentPage, size = rowsPerPage) => {
    setLoading(true); setError(null);
    try {
      // page param is 1-based in state, backend expects 0-based
      const zeroPage = page - 1;

      const filterBody = {
        searchTerm: searchTerm || null,
        status: statusFilter !== 'All' ? statusFilter : null,
        priority: priorityFilter !== 'All' ? priorityFilter : null,
        source: sourceFilter !== 'All' ? sourceFilter : null,
        groupName: groupName || null,
        subGroupName: subGroupName || null,
      };

      const data = await fetchWithHeaders(
        `${API_BASE_URL}/leads/filter?page=${zeroPage}&size=${size}`,
        { method: 'POST', body: JSON.stringify(filterBody) }
      );

      if (data.success) {
        setLeads(data.data || []);
        setTotalRecords(data.count ?? 0);
        setTotalPages(data.totalPages ?? Math.ceil((data.count ?? 0) / size));
      }
    } catch (e) {
      setError(e.message || 'Error fetching leads');
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, searchTerm, statusFilter, priorityFilter, sourceFilter, groupName, subGroupName]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-users`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setUsers(data);
    } catch { setUsers([]); }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setGroups(data);
    } catch { setGroups([]); }
  };

  const fetchSubGroupsForForm = async g => {
    if (!g) { setSubGroups([]); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(g)}`, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json(); if (Array.isArray(data)) setSubGroups(data);
    } catch { setSubGroups([]); }
  };

  // ── Initial load ──────────────────────────────────────────────────
  useEffect(() => {
    if (canView) { fetchLeads(1, rowsPerPage); fetchUsers(); fetchGroups(); }
  }, [canView]);

  // ── Re-fetch when group/subGroup filter (from header) changes ─────
  useEffect(() => {
    if (canView) { setCurrentPage(1); fetchLeads(1, rowsPerPage); }
  }, [groupName, subGroupName]);

  // ── Debounced re-fetch when search / filter dropdowns change ──────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (canView) { setCurrentPage(1); fetchLeads(1, rowsPerPage); }
    }, 400); // 400 ms debounce on search
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, priorityFilter, sourceFilter]);

  // ── Form subgroup load ─────────────────────────────────────────────
  useEffect(() => {
    if (formData.groupName) fetchSubGroupsForForm(formData.groupName); else setSubGroups([]);
  }, [formData.groupName]);

  // ─────────────────────────────────────────────────────────────────
  // PAGINATION HANDLERS — each triggers a fresh backend fetch
  // ─────────────────────────────────────────────────────────────────
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchLeads(newPage, rowsPerPage);
  };

  const handleRowsPerPageChange = (newSize) => {
    setRowsPerPage(newSize);
    setCurrentPage(1);
    fetchLeads(1, newSize);
  };

  // ── Sort (client-side on current page only — for server-side sort, extend later) ──
  const handleSort = col => {
    const dir = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col); setSortDirection(dir);
    setLeads(prev => [...prev].sort((a, b) => { const av = a[col] || '', bv = b[col] || ''; return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); }));
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
    if (!canView) { showError('No permission'); return; }
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/leads/${lead.id}`);
      if (data.success) setDetailLead(data.data);
    } catch (e) { showError(e.message || 'Error fetching lead'); }
  };

  const handleEdit = lead => {
    setFormData({
      id: lead.id, customerId: lead.customerId, name: lead.name, email: lead.email,
      phone: lead.phone, source: lead.source, priority: lead.priority, status: lead.status,
      assignedTo: lead.assignedTo, enquiry: lead.enquiry,
      groupName: lead.groupName || '', subGroupName: lead.subGroupName || '',
      closedLostReason: '',
      // NEW fields:
      state: lead.state || '',
      district: lead.district || '',
      city: lead.city || '',
      pincode: lead.pincode || '',
      solarScheme: lead.solarScheme || '',
    });
    setPhoneError(''); setShowAddModal(true);
  };

  const handleDelete = lead => { if (!canDelete) { showError('No permission'); return; } setDeleteConfirmation({ id: lead.id, name: lead.name }); };

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
          fetchLeads(currentPage, rowsPerPage);
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

  const handleSubmit = async e => {
    e.preventDefault();
    if (formData.phone && formData.phone.length !== 10) { setPhoneError('Must be exactly 10 digits'); return; }
    if (formData.id && !canEdit) { showError('No edit permission'); return; }
    if (!formData.id && !canCreate) { showError('No create permission'); return; }
    setLoading(true);
    try {
      const payload = { ...formData };

      if (formData.id) {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/update/${formData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (data.success) {
          const wasClosedWon = data.data?.status === 'Closed Won';
          showSuccess(wasClosedWon ? 'Lead updated! ✅ Converted to Customer automatically.' : 'Lead updated successfully');
          setShowAddModal(false); resetForm(); fetchLeads(currentPage, rowsPerPage);
        }
      } else {
        const data = await fetchWithHeaders(`${API_BASE_URL}/leads/create`, { method: 'POST', body: JSON.stringify(payload) });
        if (data.success) {
          showSuccess('Lead created');
          setShowAddModal(false); resetForm();
          // Go to page 1 to see the new record (sorted desc by createdAt)
          setCurrentPage(1);
          fetchLeads(1, rowsPerPage);
        }
      }
    } catch (e) { showError(e.message || 'Error saving lead'); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({
      customerId: null, name: '', email: '', phone: '',
      source: 'Website', priority: 'Medium', status: 'New',
      assignedTo: null, enquiry: '', groupName: '', subGroupName: '',
      closedLostReason: '',
      // NEW:
      state: '', district: '', city: '', pincode: '', solarScheme: '',
    });
    setPhoneError('');
  };

  // ── Badge helpers ─────────────────────────────────────────────────
  const getStatusClass = s => ({ 'New': 'leads-enquiries-badge-new', 'Contacted': 'leads-enquiries-badge-contacted', 'In Discussion': 'leads-enquiries-badge-discussion', 'Proposal Sent': 'leads-enquiries-badge-proposal', 'Closed Won': 'leads-enquiries-badge-won', 'Closed Lost': 'leads-enquiries-badge-lost' }[s] || 'leads-enquiries-badge-default');
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
    switch (colKey) {
      case 'name': return <span className="leads-enquiries-font-medium">{lead.name}</span>;
      case 'email': return lead.email;
      case 'phone': return lead.phone;
      case 'groupName': return lead.groupName || '-';
      case 'source': return lead.source;
      case 'assignedToName': return lead.assignedToName || '-';
      case 'createdAt': return lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-';
      case 'priority': return <span className={`leads-enquiries-badge ${getPriorityClass(lead.priority)}`}>{lead.priority}</span>;
      case 'status': return <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>{lead.status}</span>;
      case 'actions': return (
        <div className="leads-enquiries-action-buttons-cell">
          {canView && (
            <button className="leads-enquiries-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View Details">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
          )}
          <button className="leads-enquiries-action-btn leads-enquiries-action-timeline" onClick={() => { setSelectedLeadForTimeline(lead); setShowTimelineModal(true); }} title="View Timeline">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          <button className={`leads-enquiries-action-btn leads-enquiries-action-followup ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => { if (canCreate) { setSelectedLeadForFollowup(lead); setShowFollowupModal(true); } }} disabled={!canCreate} title="Add Follow-up">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <button className={`leads-enquiries-action-btn leads-enquiries-action-proposal ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleView(lead)} disabled={!canCreate} title="View Proposals">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </button>
          <button className={`leads-enquiries-action-btn leads-enquiries-action-edit ${!canEdit ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleEdit(lead)} disabled={!canEdit} title="Edit">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button className={`leads-enquiries-action-btn leads-enquiries-action-delete ${!canDelete ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleDelete(lead)} disabled={!canDelete} title="Delete">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      );
      default: return '-';
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────
  const exportToCSV = () => {
    if (!canView) { showError('No permission'); return; }
    const headers = ['Lead ID', 'Client Name', 'Email', 'Phone', 'Source', 'Priority', 'Status', 'Group', 'Category', 'Assigned To', 'Created At'];
    const csv = [headers.join(','), ...leads.map(l => [l.leadCode, l.name, l.email, l.phone, l.source, l.priority, l.status, l.groupName || '', l.subGroupName || '', l.assignedToName || '', l.createdAt].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`; a.click();
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
          onBack={() => setDetailLead(null)}
          onEdit={lead => { setDetailLead(null); handleEdit(lead); }}
          showSuccess={showSuccess}
          showError={showError}
        />

        {showAddModal && (
          <div className="leads-enquiries-modal-overlay">
            <div className="leads-enquiries-modal" onClick={e => e.stopPropagation()}>
              <div className="leads-enquiries-modal-header">
                <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
                <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <LeadFormBody
                formData={formData} setFormData={setFormData}
                phoneError={phoneError} handlePhoneChange={e => setFormData(p => ({ ...p, phone: validatePhone(e.target.value) }))}
                groups={groups} subGroups={subGroups} users={users}
                canAssign={canAssign} loading={loading}
                onCancel={() => setShowAddModal(false)} onSubmit={handleSubmit}
              />
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
        <span>Dashboard</span>
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
          <select className="leads-enquiries-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option>New</option><option>Contacted</option><option>In Discussion</option>
            <option>Proposal Sent</option><option>Closed Won</option><option>Closed Lost</option>
          </select>
          <select className="leads-enquiries-filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="All">All Priority</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
          <select className="leads-enquiries-filter-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="All">All Sources</option><option>Website</option><option>Referral</option><option>Cold Call</option><option>Email</option><option>Others</option>
          </select>
        </div>
        <div className="leads-enquiries-action-buttons">
          <button
            className={`leads-enquiries-btn leads-enquiries-btn-primary${!canCreate ? ' leads-enquiries-btn-disabled' : ''}`}
            onClick={() => { if (canCreate) { resetForm(); setShowAddModal(true); } else showError('No permission'); }}
            disabled={!canCreate}
          >
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add New Lead
          </button>
          <button className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={exportToCSV}>
            <svg className="leads-enquiries-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <LeadsExcelPanel
            leads={leads}
            onImportDone={() => fetchLeads(1, rowsPerPage)}
          />
        </div>
      </div>

      {/* View toggle + column controls */}
      <div className="leads-enquiries-view-toggle-container">
        {viewMode === 'table' && (
          <ColumnVisibilityDropdown columns={ALL_COLUMNS} visibleColumns={visibleColumns} onToggle={handleToggleColumn} onReset={handleResetColumns} />
        )}
        <div className="leads-enquiries-view-toggle">
          <button className={`leads-enquiries-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')} title="Table View">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Table
          </button>
          <button className={`leads-enquiries-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid View">
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
                  {orderedVisibleColumns.map((col, idx) => (
                    <DraggableHeaderCell key={col.key} col={col} index={idx} sortColumn={sortColumn} sortDirection={sortDirection} getSortIcon={getSortIcon} handleSort={handleSort}
                      onDragStart={handleColDragStart} onDragOver={handleColDragOver} onDrop={handleColDrop} onDragEnd={handleColDragEnd} isDragOver={dragOverIndex === idx} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={orderedVisibleColumns.length} className="text-center py-4">No leads found</td></tr>
                ) : leads.map(lead => (
                  <tr key={lead.id} onClick={() => canView && handleView(lead)} style={{ cursor: canView ? 'pointer' : 'default' }} className="leads-enquiries-clickable-row">
                    {orderedVisibleColumns.map(col => (
                      <td key={col.key} style={col.key === 'actions' ? { textAlign: 'center' } : {}} onClick={col.key === 'actions' ? e => e.stopPropagation() : undefined}>{renderCell(lead, col.key)}</td>
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
                      <span className={`leads-enquiries-badge ${getStatusClass(lead.status)}`}>{lead.status}</span>
                    </div>
                  </div>
                  <div className="leads-enquiries-card-body">
                    <h3 className="leads-enquiries-card-title">{lead.name}</h3>
                    <div className="leads-enquiries-card-info">
                      <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>{lead.email}</span></div>
                      <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span>{lead.phone}</span></div>
                      {lead.groupName && <div className="leads-enquiries-card-info-item"><svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg><span>{lead.groupName}</span></div>}
                    </div>
                    {lead.enquiry && <div className="leads-enquiries-card-description">{lead.enquiry}</div>}
                  </div>
                </div>
                <div className="leads-enquiries-card-footer" onClick={e => e.stopPropagation()}>
                  <div className="leads-enquiries-card-source">
                    <svg className="leads-enquiries-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    {lead.source}
                  </div>
                  <div className="leads-enquiries-card-actions">
                    {canView && <button className="leads-enquiries-card-action-btn leads-enquiries-action-view" onClick={() => handleView(lead)} title="View Details"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>}
                    <button className="leads-enquiries-card-action-btn leads-enquiries-action-timeline" onClick={() => { setSelectedLeadForTimeline(lead); setShowTimelineModal(true); }} title="Timeline"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                    <button className={`leads-enquiries-card-action-btn leads-enquiries-action-followup ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => { if (canCreate) { setSelectedLeadForFollowup(lead); setShowFollowupModal(true); } }} disabled={!canCreate} title="Follow-up"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                    <button className={`leads-enquiries-card-action-btn leads-enquiries-action-proposal ${!canCreate ? 'leads-enquiries-action-disabled' : ''}`} onClick={() => handleView(lead)} disabled={!canCreate} title="View Proposals"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                    {canEdit && <button className="leads-enquiries-card-action-btn leads-enquiries-action-edit" onClick={() => handleEdit(lead)} title="Edit"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
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
          <div className="leads-enquiries-modal" onClick={e => e.stopPropagation()}>
            <div className="leads-enquiries-modal-header">
              <h2>{formData.id ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button className="leads-enquiries-modal-close" onClick={() => setShowAddModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <LeadFormBody
              formData={formData} setFormData={setFormData}
              phoneError={phoneError} handlePhoneChange={e => setFormData(p => ({ ...p, phone: validatePhone(e.target.value) }))}
              groups={groups} subGroups={subGroups} users={users}
              canAssign={canAssign} loading={loading}
              onCancel={() => setShowAddModal(false)} onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowupModal && selectedLeadForFollowup && (
        <AddFollowupModal lead={selectedLeadForFollowup} onClose={() => { setShowFollowupModal(false); setSelectedLeadForFollowup(null); }} onFollowupCreated={() => { setShowFollowupModal(false); setSelectedLeadForFollowup(null); showSuccess('Follow-up created!'); fetchLeads(currentPage, rowsPerPage); }} />
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

  return (
    <div className="leads-enquiries-pagination">
      <div className="leads-enquiries-pagination-info">
        {totalRecords === 0
          ? 'No records found'
          : `Showing ${startRecord}–${endRecord} of ${totalRecords} leads`}
      </div>
      <div className="leads-enquiries-pagination-controls">
        {/* Rows per page */}
        <select
          className="leads-enquiries-rows-select"
          value={rowsPerPage}
          onChange={e => onRowsPerPageChange(Number(e.target.value))}
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        <div className="leads-enquiries-pagination-buttons">
          {/* First + Prev */}
          <button
            className="leads-enquiries-pagination-btn"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="First page"
          >«</button>
          <button
            className="leads-enquiries-pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >Previous</button>

          {/* Page number pills */}
          {currentPage > 3 && totalPages > 5 && (
            <span className="leads-enquiries-pagination-ellipsis">…</span>
          )}
          {getPageNumbers().map(p => (
            <button
              key={p}
              className={`leads-enquiries-pagination-btn${p === currentPage ? ' leads-enquiries-pagination-btn-active' : ''}`}
              onClick={() => onPageChange(p)}
            >{p}</button>
          ))}
          {currentPage < totalPages - 2 && totalPages > 5 && (
            <span className="leads-enquiries-pagination-ellipsis">…</span>
          )}

          {/* Next + Last */}
          <button
            className="leads-enquiries-pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >Next</button>
          <button
            className="leads-enquiries-pagination-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            title="Last page"
          >»</button>
        </div>

        <span className="leads-enquiries-pagination-current">
          Page {currentPage} of {totalPages || 1}
        </span>
      </div>
    </div>
  );
};

// ─── Lead Add/Edit form body ──────────────────────────────────────────────────
const LeadFormBody = ({ formData, setFormData, phoneError, handlePhoneChange, groups, subGroups, users, canAssign, loading, onCancel, onSubmit }) => (
  <form onSubmit={onSubmit} className="leads-enquiries-form">
    <div className="leads-enquiries-form-section">
      <h3 className="leads-enquiries-form-section-title">Client Information</h3>
      <div className="leads-enquiries-form-grid">
        <div className="leads-enquiries-form-group">
          <label>Client Name *</label>
          <input type="text" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Email *</label>
          <input type="email" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
        </div>
        <div className="leads-enquiries-form-group">
          <label>Phone *</label>
          <input type="text" required value={formData.phone} onChange={handlePhoneChange} placeholder="10 digit number" maxLength="10" />
          {phoneError && <span className="phone-error-message">{phoneError}</span>}
        </div>
        <div className="leads-enquiries-form-group">
          <label>Group</label>
          <select value={formData.groupName} onChange={e => setFormData(p => ({ ...p, groupName: e.target.value, subGroupName: '' }))}>
            <option value="">Select Group</option>
            {groups.map((g, i) => <option key={g.value || i} value={g.value || g.label}>{g.label || g.value}</option>)}
          </select>
        </div>
        <div className="leads-enquiries-form-group">
          <label>Category</label>
          <select value={formData.subGroupName} onChange={e => setFormData(p => ({ ...p, subGroupName: e.target.value }))} disabled={!formData.groupName}>
            <option value="">Select Category</option>
            {subGroups.map((s, i) => <option key={s.value || i} value={s.value || s.label}>{s.label || s.value}</option>)}
          </select>
        </div>
      </div>
    </div>
    {formData.subGroupName === 'Solar_Rooftop' && (
      <div className="leads-enquiries-form-group">
        <label>Solar Scheme</label>
        <select value={formData.solarScheme || ''} onChange={e => setFormData(p => ({ ...p, solarScheme: e.target.value }))}>
          <option value="">Select Scheme</option>
          <option value="PM_Surya_Ghar">PM Surya Ghar</option>
          <option value="PM_Kusum">PM Kusum</option>
          <option value="State_Subsidy">State Subsidy</option>
          <option value="Net_Metering_Only">Net Metering Only</option>
          <option value="No_Scheme">No Scheme</option>
          <option value="Others">Others</option>
        </select>
      </div>
    )}
    <div className="leads-enquiries-form-group">
      <label>State</label>
      <input type="text" value={formData.state || ''} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} placeholder="e.g. Telangana" />
    </div>
    <div className="leads-enquiries-form-group">
      <label>District</label>
      <input type="text" value={formData.district || ''} onChange={e => setFormData(p => ({ ...p, district: e.target.value }))} placeholder="e.g. Hyderabad" />
    </div>
    <div className="leads-enquiries-form-group">
      <label>City / Village</label>
      <input type="text" value={formData.city || ''} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Uppal" />
    </div>
    <div className="leads-enquiries-form-group">
      <label>Pincode</label>
      <input type="text" value={formData.pincode || ''} onChange={e => setFormData(p => ({ ...p, pincode: e.target.value }))} maxLength="6" placeholder="6-digit PIN" />
    </div>
    <div className="leads-enquiries-form-section">
      <h3 className="leads-enquiries-form-section-title">Lead Details</h3>
      <div className="leads-enquiries-form-grid">
        <div className="leads-enquiries-form-group">
          <label>Lead Source *</label>
          <select required value={formData.source} onChange={e => setFormData(p => ({ ...p, source: e.target.value }))}>
            <option>Website</option><option>Referral</option><option>Cold Call</option><option>Email</option><option>Others</option>
          </select>
        </div>
        <div className="leads-enquiries-form-group">
          <label>Priority *</label>
          <select required value={formData.priority} onChange={e => setFormData(p => ({ ...p, priority: e.target.value }))}>
            <option>High</option><option>Medium</option><option>Low</option>
          </select>
        </div>
        <div className="leads-enquiries-form-group">
          <label>Status *</label>
          <select required value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
            <option>New</option><option>Contacted</option><option>In Discussion</option>
            <option>Proposal Sent</option><option>Closed Won</option><option>Closed Lost</option>
          </select>
        </div>
        <div className="leads-enquiries-form-group">
          <label>Assign To</label>
          <select value={formData.assignedTo || ''} onChange={e => setFormData(p => ({ ...p, assignedTo: e.target.value ? Number(e.target.value) : null }))} disabled={!canAssign}>
            <option value="">Select Member</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {!canAssign && <small style={{ color: '#6b7280', fontSize: 12 }}>No assign permission</small>}
        </div>
      </div>

      {formData.status === 'Closed Lost' && (
        <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>REQUIRED</span>
            Reason for Closing Lost *
          </label>
          <textarea
            required
            rows={3}
            value={formData.closedLostReason || ''}
            onChange={e => setFormData(p => ({ ...p, closedLostReason: e.target.value }))}
            placeholder="Please specify why this lead was closed as lost…"
            style={{ borderColor: '#fca5a5' }}
          />
          <small style={{ color: '#6b7280', fontSize: 11 }}>This reason will be recorded in the lead history.</small>
        </div>
      )}

      <div className="leads-enquiries-form-group" style={{ marginTop: 12 }}>
        <label>Enquiry Description *</label>
        <textarea required rows={4} value={formData.enquiry} onChange={e => setFormData(p => ({ ...p, enquiry: e.target.value }))} placeholder="Describe the client's requirements…" />
      </div>
    </div>

    <div className="leads-enquiries-form-actions">
      <button type="button" className="leads-enquiries-btn leads-enquiries-btn-secondary" onClick={onCancel}>Cancel</button>
      <button type="submit" className="leads-enquiries-btn leads-enquiries-btn-primary" disabled={loading || !!phoneError}>
        {loading ? 'Saving…' : (formData.id ? 'Update Lead' : 'Save Lead')}
      </button>
    </div>
  </form>
);

export default LeadsEnquiries;