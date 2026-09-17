// src/Pages/BorrowerComparison.js
//
// Standalone, read-only Borrower Comparison module. Reached either from the
// sidebar ("Borrower Comparison", lands here empty) or the Borrower
// Registry's "Compare Borrower" button (navigates here with an initial
// selection already made). Nothing here can edit/delete/create anything —
// it only ever fetches and displays.
//
// Field labels/order/formatting are NOT reinvented: every row in the
// field-driven sections comes from buildDetailRows/DERIVED_ROWS
// (SanctionOverviewPanel.js), the exact same helpers the single-sanction
// read-only detail view already uses — so a figure here can never disagree
// with what the same sanction shows on its own detail page.

import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, X, Star, Building2, FileText,
  Layers, Send, Calendar, Calculator, ShieldCheck, FileCheck2, Download,
  RotateCcw, Plus, Lock, CheckCircle2, FileSpreadsheet, ListFilter, Search,
} from 'lucide-react';
import borrowerApi from '../services/borrowerApi';
import { useAuth } from '../hooks/useAuth';
import {
  buildDetailRows, DERIVED_ROWS, DSRA_DETAIL_KEYS, ISRA_DETAIL_KEYS,
  LEFT_ALIGN_KEYS, isBlank, statusLabel, repaymentFrequencyLabel,
} from '../components/borrowers/SanctionOverviewPanel';
import SanctionComparePicker from '../components/borrowers/SanctionComparePicker';
import Pagination from '../components/borrowers/Pagination';
import CrmPreloader from '../components/preLoader';
import { exportComparisonExcel } from '../components/borrowers/comparisonExport';
import '../pages-css/BorrowerComparison.css';

const MAX_LIMIT_COLUMNS = 6;
const PAGE_SIZE = 5;
const CHIP_TONES = ['blue', 'green', 'purple', 'orange', 'amber', 'teal', 'rose', 'indigo'];

// Which SANCTION_FIELDS group (sanctionFields.js) feeds which comparison
// section — "Conditions & Covenants" is split further below (DSRA/ISRA keys
// vs everything else), and "Product"/limits data isn't field-driven at all
// (see the limits/tranching/disbursement block further down).
const GROUP_TO_SECTION = {
  'Borrower Details': 'borrower',
  'Project Details': 'borrower',
  'Project Cost & Finance': 'summary',
  'Important Dates': 'summary',
  'Interest & Repayment': 'repayment',
  'Additional Information': 'other',
};

const SECTION_ORDER = [
  { id: 'borrower', label: 'Borrower & Project Details', icon: Building2 },
  { id: 'summary', label: 'Sanction Summary', icon: FileText },
  { id: 'limits', label: 'Limits & Instruments', icon: Layers },
  { id: 'disbursement', label: 'Disbursement Details', icon: Send },
  { id: 'repayment', label: 'Repayment Schedule', icon: Calendar },
  { id: 'derived', label: 'Derived Values (DSRA / ISRA etc.)', icon: Calculator },
  { id: 'security', label: 'Security & Covenants', icon: ShieldCheck },
  { id: 'other', label: 'Other Terms & Conditions', icon: FileCheck2 },
];

const numFrom = (v) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

/**
 * Builds { highlights: [...rows], sections: [{id,label,icon,rows}], valuesBySanctionId }.
 * Field-driven sections get their row LIST from the first sanction —
 * buildDetailRows/DERIVED_ROWS iterate the same static field arrays for
 * every sanction, so keys/labels/order are identical regardless of whose
 * values fill them in. Limits/Tranching/Disbursement have no such fixed
 * field list (a sanction can have any number of Limits), so their rows are
 * sized off the max count actually present among ALL selected sanctions
 * (not just the current page), capped at MAX_LIMIT_COLUMNS.
 */
const buildComparisonModel = (sanctions, perms) => {
  const sections = new Map(SECTION_ORDER.map((s) => [s.id, { ...s, rows: [] }]));
  const valuesBySanctionId = {};
  sanctions.forEach((s) => { valuesBySanctionId[s.id] = {}; });

  const highlightRows = [
    { key: 'hl_sanctionedAmount', label: 'Total Sanctioned Amount' },
    { key: 'hl_debtEquity', label: 'Debt : Equity' },
    { key: 'hl_roi', label: 'ROI (p.a.)' },
    { key: 'hl_tenor', label: 'Repayment Tenor' },
    { key: 'hl_frequency', label: 'Repayment Frequency' },
    { key: 'hl_status', label: 'Status' },
    { key: 'hl_lender', label: 'Lender' },
    { key: 'hl_project', label: 'Project' },
  ];
  sanctions.forEach((s) => {
    const v = valuesBySanctionId[s.id];
    v.hl_sanctionedAmount = s.sanctionedAmount;
    v.hl_debtEquity = s.debtEquityRatio;
    v.hl_roi = s.roiPct;
    v.hl_tenor = s.derivedTotalTenorMonths
      ? `${s.derivedTotalTenorMonths} months` : null;
    v.hl_frequency = s.repaymentFrequency ? repaymentFrequencyLabel(s) : null;
    v.hl_status = statusLabel(s.status);
    v.hl_lender = s.lenderName;
    v.hl_project = s.projectName;
  });

  // ── Field-driven sections ──
  if (sanctions.length) {
    const firstRows = buildDetailRows({ borrowerName: sanctions[0].associatedWithName }, sanctions[0], perms);
    firstRows.forEach((f) => {
      const covenant = f.group === 'Conditions & Covenants';
      const sectionId = covenant
        ? ((DSRA_DETAIL_KEYS.has(f.key) || ISRA_DETAIL_KEYS.has(f.key)) ? 'derived' : 'security')
        : GROUP_TO_SECTION[f.group];
      if (!sectionId) return; // "Product"/"Number" groups: not field-driven here (see limits section)
      sections.get(sectionId).rows.push({ key: f.key, label: f.label, align: LEFT_ALIGN_KEYS.has(f.key) ? 'left' : '' });
    });
  }
  sanctions.forEach((s) => {
    const rows = buildDetailRows({ borrowerName: s.associatedWithName }, s, perms);
    rows.forEach((f) => { valuesBySanctionId[s.id][f.key] = f.value; });
  });

  // ── Derived Values (folds in DSRA/ISRA, per the merged section above) ──
  const derivedRows = DERIVED_ROWS.filter((d) => (
    (perms.hasDsraPermission || !DSRA_DETAIL_KEYS.has(d.key))
    && (perms.hasIsraPermission || !ISRA_DETAIL_KEYS.has(d.key))
  ));
  sections.get('derived').rows.push(...derivedRows.map((d) => ({ key: d.key, label: d.label })));
  sanctions.forEach((s) => {
    derivedRows.forEach((d) => { valuesBySanctionId[s.id][d.key] = s[d.key]; });
  });

  // ── Limits & Instruments (dynamic row count, folds tranche totals in) ──
  const maxLimits = Math.min(
    sanctions.reduce((m, s) => Math.max(m, (s.limits || []).length), 0),
    MAX_LIMIT_COLUMNS,
  );
  const limitRows = [];
  for (let i = 0; i < maxLimits; i += 1) {
    const n = i + 1;
    limitRows.push(
      { key: `limit_${i}_label`, label: `Limit ${n} — Name` },
      { key: `limit_${i}_amount`, label: `Limit ${n} — Amount` },
      { key: `limit_${i}_instrument`, label: `Limit ${n} — Instrument` },
      { key: `limit_${i}_tentative`, label: `Limit ${n} — Tentative Disb. Date` },
      { key: `limit_${i}_actual`, label: `Limit ${n} — Actual Disb. Date` },
      { key: `limit_${i}_tranches`, label: `Limit ${n} — Tranches` },
    );
  }
  sections.get('limits').rows = limitRows;

  sanctions.forEach((s) => {
    const v = valuesBySanctionId[s.id];
    (s.limits || []).slice(0, maxLimits).forEach((l, i) => {
      v[`limit_${i}_label`] = l.limitLabel;
      v[`limit_${i}_amount`] = l.facilityLimitAmount;
      v[`limit_${i}_instrument`] = l.facilityType;
      v[`limit_${i}_tentative`] = l.tentativeDisbursementDate;
      v[`limit_${i}_actual`] = l.actualDisbursementDate;
      const tranches = l.tranches || [];
      if (tranches.length) {
        const total = tranches.reduce((t, tr) => t + numFrom(tr.trancheAmount), 0);
        v[`limit_${i}_tranches`] = `${tranches.length} tranche${tranches.length === 1 ? '' : 's'} — Rs. ${total.toFixed(2)} Cr`;
      }
    });
  });

  // ── Disbursement Details (aggregate across limits, plus sanction-level dates) ──
  sections.get('disbursement').rows = [
    { key: 'disb_totalLimit', label: 'Total Sanctioned Limit' },
    { key: 'disb_totalDisbursed', label: 'Total Disbursed Amount' },
    { key: 'disb_pending', label: 'Pending Amount' },
    { key: 'disb_tentative', label: 'Tentative Disbursement Date' },
    { key: 'disb_actual', label: 'Actual Disbursement Date' },
    { key: 'disb_status', label: 'Disbursement Status' },
  ];
  sanctions.forEach((s) => {
    const v = valuesBySanctionId[s.id];
    const limits = s.limits || [];
    const totalLimit = limits.length
      ? limits.reduce((t, l) => t + numFrom(l.facilityLimitAmount), 0)
      : numFrom(s.limitAmount);
    const totalDisbursed = limits.reduce((t, l) => t + (l.actualDisbursementDate ? numFrom(l.facilityLimitAmount) : 0), 0);
    const pending = Math.max(totalLimit - totalDisbursed, 0);
    if (totalLimit > 0) v.disb_totalLimit = `Rs. ${totalLimit.toFixed(2)} Cr`;
    if (limits.length) {
      v.disb_totalDisbursed = `Rs. ${totalDisbursed.toFixed(2)} Cr`;
      v.disb_pending = `Rs. ${pending.toFixed(2)} Cr`;
      v.disb_status = pending <= 0.01 ? 'Disbursed' : (totalDisbursed > 0 ? 'Partially Disbursed' : 'Pending');
    }
    v.disb_tentative = s.tentativeDisbursementDate;
    v.disb_actual = s.disbursementDate;
  });

  return { highlights: highlightRows, sections: [...sections.values()], valuesBySanctionId };
};

const ChipIcon = ({ tone }) => (
  <span className={`cmp-chip-icon cmp-tone-${tone}`}><Building2 size={15} aria-hidden="true" /></span>
);

const BorrowerComparison = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pagePermissions } = useAuth();
  const hasDsraPermission = !!pagePermissions?.BARROWER?.includes('VIEW_DSRA_DETAILS');
  const hasIsraPermission = !!pagePermissions?.BARROWER?.includes('VIEW_ISRA_DETAILS');

  const [sanctions, setSanctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openSections, setOpenSections] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  // Which fields to show, across every section — null means "no filter
  // applied yet" (show everything, the default). Once the user unchecks
  // even one field, this materializes into an explicit Set so the checked
  // state has something concrete to toggle against.
  const [selectedFieldKeys, setSelectedFieldKeys] = useState(null);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const fieldPickerRef = useRef(null);

  const fetchSanctions = async (ids) => {
    if (!ids.length) { setSanctions([]); return; }
    setLoading(true);
    setError('');
    try {
      const data = await borrowerApi.compareSanctions(ids);
      setSanctions(data);
      setPage(1);
    } catch (e) {
      setError(e.message || 'Could not load the selected sanction letters.');
    } finally {
      setLoading(false);
    }
  };

  // Only ever consumed once, on arrival from the Registry's own "Compare
  // Borrower" button — the picker opened here on this page (sidebar entry,
  // "+ Compare Borrower", or a later re-open) manages its own selection
  // going forward without touching route state again.
  useEffect(() => {
    const ids = location.state?.sanctionIds || [];
    if (ids.length) fetchSanctions(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOutside = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    if (exportOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [exportOpen]);

  useEffect(() => {
    const onOutside = (e) => { if (fieldPickerRef.current && !fieldPickerRef.current.contains(e.target)) setFieldPickerOpen(false); };
    if (fieldPickerOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [fieldPickerOpen]);

  const perms = useMemo(() => ({ hasDsraPermission, hasIsraPermission }), [hasDsraPermission, hasIsraPermission]);
  const model = useMemo(() => buildComparisonModel(sanctions, perms), [sanctions, perms]);

  // Every field across Key Highlights + every section, in catalog order —
  // what the field picker lists, and what a filtered view's row list is
  // built from. Recomputed off `model`, not stored separately, so a newly
  // added Limit column (say) is pickable the moment it appears.
  const allFieldOptions = useMemo(() => {
    const opts = model.highlights.map((r) => ({ key: r.key, label: r.label, section: 'Key Highlights', align: r.align }));
    model.sections.forEach((sec) => {
      sec.rows.forEach((r) => opts.push({ key: r.key, label: r.label, section: sec.label, align: r.align }));
    });
    return opts;
  }, [model]);

  const isFieldFiltered = selectedFieldKeys !== null;
  const isFieldChecked = (key) => (selectedFieldKeys === null ? true : selectedFieldKeys.has(key));
  const toggleField = (key) => {
    setSelectedFieldKeys((prev) => {
      const base = prev === null ? new Set(allFieldOptions.map((o) => o.key)) : new Set(prev);
      if (base.has(key)) base.delete(key); else base.add(key);
      return base;
    });
  };
  const selectAllFields = () => setSelectedFieldKeys(null);
  const clearFields = () => setSelectedFieldKeys(new Set());

  const filteredFieldRows = useMemo(
    () => (isFieldFiltered ? allFieldOptions.filter((o) => selectedFieldKeys.has(o.key)) : []),
    [isFieldFiltered, allFieldOptions, selectedFieldKeys],
  );

  const fieldPickerGroups = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    const matches = q ? allFieldOptions.filter((o) => o.label.toLowerCase().includes(q)) : allFieldOptions;
    const groups = new Map();
    matches.forEach((o) => {
      if (!groups.has(o.section)) groups.set(o.section, []);
      groups.get(o.section).push(o);
    });
    return [...groups.entries()];
  }, [allFieldOptions, fieldSearch]);

  const pageCount = Math.max(1, Math.ceil(sanctions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageSanctions = sanctions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSection = (id) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const removeColumn = (id) => setSanctions((prev) => prev.filter((s) => s.id !== id));

  const handleReset = () => {
    setSanctions([]);
    setOpenSections(new Set());
    setPage(1);
    navigate('.', { replace: true, state: {} });
  };

  const handlePickerCompare = (ids) => {
    setPickerOpen(false);
    fetchSanctions(ids);
  };

  const chipTone = (i) => CHIP_TONES[i % CHIP_TONES.length];
  const visibleChips = chipsExpanded ? sanctions : sanctions.slice(0, 5);
  const hiddenChipCount = sanctions.length - visibleChips.length;

  const renderValue = (row, s) => {
    const value = model.valuesBySanctionId[s.id]?.[row.key];
    return isBlank(value) ? '—' : value;
  };

  return (
    <div className="cmp-page">
      {loading && <CrmPreloader text="Loading sanction letters…" />}

      <div className="cmp-head">
        <div className="cmp-head-text">
          <p className="cmp-breadcrumb">Lender &gt; Borrower Comparison</p>
          <h1 className="cmp-title">Borrower Comparison</h1>
          <p className="cmp-subtitle">Compare sanction details, limits, repayment and disbursement across selected borrowers</p>
        </div>
        {sanctions.length > 0 && (
          <div className="cmp-toolbar">
            <div className="cmp-export-menu" ref={fieldPickerRef}>
              <button type="button" className="cmp-btn" onClick={() => setFieldPickerOpen((v) => !v)} aria-haspopup="menu" aria-expanded={fieldPickerOpen}>
                <ListFilter size={15} aria-hidden="true" />
                {isFieldFiltered ? `Fields (${selectedFieldKeys.size})` : 'Select Fields'}
              </button>
              {fieldPickerOpen && (
                <div className="cmp-field-picker-panel" role="menu">
                  <div className="cmp-field-picker-search">
                    <Search size={14} aria-hidden="true" />
                    <input
                      type="text"
                      placeholder="Search fields…"
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                    />
                  </div>
                  <div className="cmp-field-picker-actions">
                    <button type="button" onClick={selectAllFields}>Select all</button>
                    <button type="button" onClick={clearFields}>Clear</button>
                  </div>
                  <div className="cmp-field-picker-list">
                    {fieldPickerGroups.length === 0 && (
                      <p className="cmp-field-picker-empty">No fields match “{fieldSearch}”.</p>
                    )}
                    {fieldPickerGroups.map(([section, opts]) => (
                      <div key={section} className="cmp-field-picker-group">
                        <p className="cmp-field-picker-group-title">{section}</p>
                        {opts.map((o) => (
                          <label key={o.key} className="cmp-field-picker-item">
                            <input type="checkbox" checked={isFieldChecked(o.key)} onChange={() => toggleField(o.key)} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="cmp-field-picker-footer">
                    <button type="button" className="cmp-btn cmp-btn-primary cmp-btn-sm" onClick={() => setFieldPickerOpen(false)}>Done</button>
                  </div>
                </div>
              )}
            </div>
            <div className="cmp-export-menu" ref={exportRef}>
              <button type="button" className="cmp-btn" onClick={() => setExportOpen((v) => !v)} aria-haspopup="menu" aria-expanded={exportOpen}>
                <Download size={15} aria-hidden="true" /> Export
              </button>
              {exportOpen && (
                <div className="cmp-export-menu-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setExportOpen(false); exportComparisonExcel(model, sanctions); }}
                  >
                    <FileSpreadsheet size={14} aria-hidden="true" /> Excel
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="cmp-btn" onClick={handleReset}>
              <RotateCcw size={15} aria-hidden="true" /> Reset
            </button>
            <button type="button" className="cmp-btn cmp-btn-primary" onClick={() => setPickerOpen(true)}>
              <Plus size={15} aria-hidden="true" /> Compare Borrower
            </button>
          </div>
        )}
      </div>

      {error && <div className="cmp-banner cmp-banner-danger">{error}</div>}

      {!loading && !error && sanctions.length === 0 && (
        <div className="cmp-empty-state">
          <div className="cmp-empty-icon">
            <FileText size={40} aria-hidden="true" />
          </div>
          <h2>Compare Borrowers</h2>
          <p>Select multiple sanctions from different borrowers to compare their key details side by side.</p>
          <button type="button" className="cmp-btn cmp-btn-primary cmp-btn-lg" onClick={() => setPickerOpen(true)}>
            <Plus size={16} aria-hidden="true" /> Compare Borrower
          </button>
        </div>
      )}

      {!loading && sanctions.length > 0 && (
        <>
          <div className="cmp-chip-row">
            {visibleChips.map((s, i) => (
              <div key={s.id} className="cmp-chip">
                <ChipIcon tone={chipTone(i)} />
                <div className="cmp-chip-text">
                  <span className="cmp-chip-name">{s.associatedWithName || '—'}</span>
                  <span className="cmp-chip-sub">{s.refNo || '—'}</span>
                </div>
                <button
                  type="button"
                  className="cmp-chip-remove"
                  onClick={() => removeColumn(s.id)}
                  aria-label={`Remove ${s.associatedWithName || 'this sanction'}`}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
            {hiddenChipCount > 0 && (
              <button type="button" className="cmp-chip-more" onClick={() => setChipsExpanded(true)}>
                +{hiddenChipCount} more <ChevronDown size={13} aria-hidden="true" />
              </button>
            )}
            {chipsExpanded && sanctions.length > 5 && (
              <button type="button" className="cmp-chip-more" onClick={() => setChipsExpanded(false)}>
                Show less
              </button>
            )}
          </div>

          {isFieldFiltered && (
            <div className="cmp-panel">
              <div className="cmp-filtered-head">
                <span>
                  Comparing {filteredFieldRows.length} selected field{filteredFieldRows.length === 1 ? '' : 's'}
                </span>
                <button type="button" className="cmp-link-btn" onClick={selectAllFields}>Show all fields</button>
              </div>
              {filteredFieldRows.length === 0 ? (
                <div className="cmp-empty-state cmp-empty-state-inline">
                  <p>No fields selected yet.</p>
                  <button type="button" className="cmp-btn cmp-btn-primary" onClick={() => setFieldPickerOpen(true)}>
                    <ListFilter size={15} aria-hidden="true" /> Select Fields
                  </button>
                </div>
              ) : (
                <div className="cmp-table-wrap">
                  <table className="cmp-table">
                    <thead>
                      <tr>
                        <th className="cmp-sticky-col cmp-field-head">Field</th>
                        {pageSanctions.map((s, i) => (
                          <th key={s.id} className="cmp-col-head">
                            <div className="cmp-col-head-inner">
                              <ChipIcon tone={chipTone((currentPage - 1) * PAGE_SIZE + i)} />
                              <span className="cmp-col-head-name">{s.associatedWithName || '—'}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFieldRows.map((row) => (
                        <tr key={row.key}>
                          <td className={`cmp-sticky-col cmp-field-name${row.align === 'left' ? ' cmp-left' : ''}`}>
                            {row.label}
                            <span className="cmp-field-section-tag">{row.section}</span>
                          </td>
                          {pageSanctions.map((s) => (
                            <td key={s.id} className={row.align === 'left' ? 'cmp-left' : ''}>
                              {renderValue(row, s)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!isFieldFiltered && (
            <>
              <div className="cmp-panel">
                <div className="cmp-table-wrap">
                  <table className="cmp-table cmp-highlights-table">
                    <thead>
                      <tr>
                        <th className="cmp-sticky-col cmp-field-head">
                          <Star size={14} aria-hidden="true" className="cmp-highlights-star" /> Key Highlights
                        </th>
                        {pageSanctions.map((s, i) => (
                          <th key={s.id} className="cmp-col-head">
                            <div className="cmp-col-head-inner">
                              <ChipIcon tone={chipTone((currentPage - 1) * PAGE_SIZE + i)} />
                              <span className="cmp-col-head-name">{s.associatedWithName || '—'}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {model.highlights.map((row) => (
                        <tr key={row.key}>
                          <td className="cmp-sticky-col cmp-field-name">{row.label}</td>
                          {pageSanctions.map((s) => (
                            <td key={s.id}>{renderValue(row, s)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cmp-sections">
                {model.sections.map((section) => {
                  const isOpen = openSections.has(section.id);
                  const Icon = section.icon;
                  return (
                    <div key={section.id} className="cmp-section-card">
                      <button
                        type="button"
                        className="cmp-section-row"
                        onClick={() => toggleSection(section.id)}
                        aria-expanded={isOpen}
                      >
                        <span className="cmp-section-icon"><Icon size={16} aria-hidden="true" /></span>
                        <span className="cmp-section-label">{section.label}</span>
                        <span className="cmp-section-link">
                          {isOpen ? 'Hide Comparison' : 'Show Comparison'}
                          {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="cmp-table-wrap">
                          <table className="cmp-table">
                            <thead>
                              <tr>
                                <th className="cmp-sticky-col cmp-field-head">Field</th>
                                {pageSanctions.map((s) => (
                                  <th key={s.id} className="cmp-col-head">
                                    <span className="cmp-col-head-name">{s.associatedWithName || '—'}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.length === 0 && (
                                <tr><td className="cmp-sticky-col cmp-field-name" colSpan={pageSanctions.length + 1}>Nothing recorded for this section yet.</td></tr>
                              )}
                              {section.rows.map((row) => (
                                <tr key={row.key}>
                                  <td className={`cmp-sticky-col cmp-field-name${row.align === 'left' ? ' cmp-left' : ''}`}>
                                    {row.label}
                                  </td>
                                  {pageSanctions.map((s) => (
                                    <td key={s.id} className={row.align === 'left' ? 'cmp-left' : ''}>
                                      {renderValue(row, s)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {pageCount > 1 && (
            <div className="cmp-pagination-wrap">
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                totalRows={sanctions.length}
                onPageChange={setPage}
                showSizeSelector={false}
              />
            </div>
          )}

          <div className="cmp-info-bar">
            <div className="cmp-info-item cmp-info-item-primary">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Selected {sanctions.length} sanction{sanctions.length === 1 ? '' : 's'} for comparison</span>
            </div>
            <div className="cmp-info-item">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>All fields are grouped in collapsible sections for easy comparison</span>
            </div>
            <div className="cmp-info-item">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>You can select up to 20 sanctions at a time</span>
            </div>
            <div className="cmp-info-item">
              <Lock size={15} aria-hidden="true" />
              <span>Data shown is based on your access permissions — only borrowers and sanctions assigned to you are listed</span>
            </div>
          </div>
        </>
      )}

      {pickerOpen && (
        <SanctionComparePicker
          initialSelectedIds={sanctions.map((s) => s.id)}
          onClose={() => setPickerOpen(false)}
          onCompare={handlePickerCompare}
        />
      )}
    </div>
  );
};

export default BorrowerComparison;
