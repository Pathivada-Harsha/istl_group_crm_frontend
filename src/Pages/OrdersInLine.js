// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONAL FEATURE — displayed as "Orders in Pipeline"
//
// NAMING: the UI says "Orders in Pipeline" everywhere. The files, Java classes,
// the /orders-in-line endpoint and the orders_in_line table keep the original
// "orders in line" name by choice — renaming those buys nothing users can see
// and would cost a table rename on a live database.
//
// Temporary stopgap register, scheduled for replacement by a permanent pipeline
// module. Data here migrates into the leads table at that point.
// Removal: drop table `orders_in_line`, delete the OrdersInLine* files, revert the
// sidebar entry, the App.js import + route, and the dashboard KPI import + element.
//
// A lightweight register of potential orders that arrive informally — referred by
// developers, channel partners, or direct enquiries — where it is not yet known
// whether the order will be confirmed. These are NOT leads: nothing here feeds any
// lead listing, count, conversion metric, funnel, or report.
//
// Scope is deliberately minimal: no conversion workflow, no duplicate detection,
// no approvals, no exports, no attachments, no follow-ups. Resist adding them —
// this is scheduled for replacement.
//
// NOTE: the "temporary register" banner that used to sit at the top of the page
// was removed deliberately — this screen is shown to clients and lenders, and the
// provisional framing is internal information. It stays in these headers only.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Pencil, Trash2, Inbox, Eye, X } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import FilterSelect from '../components/Dropdowns/FilterSelect';
import DateRangeFilter from '../components/DateRangeFilter';
import ConfirmationModal from '../components/ConfirmationModal';
import ToastContainer from '../components/Notification_Toast/ToastContainer';
import CrmPreloader from '../components/preLoader';
import useToast from '../hooks/useToast';
import ordersInLineApi, {
  ORDERS_IN_LINE_STATUSES,
  ORDERS_IN_LINE_SOURCE_TYPES,
  CAPACITY_UNITS,
} from '../services/ordersInLineApi';
import '../pages-css/OrdersInLine.css';

const todayIso = () => new Date().toISOString().slice(0, 10);

/* ── capacity × rate → estimated value ───────────────────────────────────────
 * Deals here are quoted as a rate per MW (e.g. 81.16 MW at ₹3,20,00,000/MW), so
 * the modal takes the rate and derives the total rather than making anyone do
 * the arithmetic. `ratePerMw` is NOT stored — it is exactly estimatedValue /
 * capacityInMw, so it round-trips losslessly and needs no extra column, which
 * keeps the table the shape the later migration into `leads` expects.
 */
const UNIT_TO_MW = { mw: 1, mwp: 1, kw: 0.001, kwp: 0.001 };

/** Capacity expressed in MW, or null when the unit is not a power unit. */
const toMw = (capacity, unit) => {
  const n = parseFloat(capacity);
  const factor = UNIT_TO_MW[String(unit || '').toLowerCase()];
  if (!Number.isFinite(n) || n <= 0 || !factor) return null;
  return n * factor;
};

/** Round to 2dp and drop a trailing .00 — keeps 81.16 × 3.2e7 off floating-point dust. */
const money2 = (n) => {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return String(Number.isInteger(r) ? r : r.toFixed(2));
};

const fmtInr = (raw) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/** Short form so a ten-digit total is readable at a glance. */
const fmtCompactInr = (raw) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n) || n === 0) return '';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return fmtInr(n);
};

const emptyForm = () => ({
  id: null,
  clientName: '',
  sourceParty: '',
  sourceType: '',
  capacity: '',
  capacityUnit: 'kW',
  capacityType: '',         // AC | DC
  ratePerMw: '',            // UI-only — derived from estimatedValue / capacity
  category: '',
  pincode: '',              // lookup helper only — never sent to the server
  state: '',
  district: '',
  contactPerson: '',
  phone: '',
  email: '',
  estimatedValue: '',
  receivedDate: todayIso(),
  expectedDecisionDate: '',
  status: 'Enquiry Received',
  ownerUserId: '',
  remarks: '',
});

const statusClass = (status) => {
  const map = {
    'Enquiry Received': 'oil-badge-enquiry-received',
    'In Discussion':    'oil-badge-in-discussion',
    'Quoted':           'oil-badge-quoted',
    'Confirmed':        'oil-badge-confirmed',
    'On Hold':          'oil-badge-on-hold',
    'Dropped':          'oil-badge-dropped',
  };
  return map[status] || 'oil-badge-default';
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}-${m}-${y}` : iso;
};

const toOptions = (values) => values.map((v) => ({ value: v, label: v }));

const CAPACITY_TYPES = ['AC', 'DC'];

/** "81.16 MW DC" — the AC/DC side rides along with the capacity wherever it shows. */
const capacityLabel = (row) => {
  if (!row.capacity) return null;
  return [row.capacity, row.capacityUnit, row.capacityType].filter(Boolean).join(' ');
};

/**
 * Below this, a per-MW rate is not shown.
 *
 * Dividing a sub-MW job by its capacity extrapolates it to a full megawatt and
 * produces a figure that reads as absurd — a ₹13.75 Cr / 725 kW rooftop comes out
 * at "₹18.97 Cr per MW", which is arithmetically right and commercially
 * meaningless. Small jobs are not priced per MW, so the rate is simply withheld.
 */
const MIN_MW_FOR_RATE = 1;

/** Cost per MW is derived, not stored — exactly estimatedValue / capacityInMw. */
const ratePerMwOf = (row) => {
  const mw = toMw(row.capacity, row.capacityUnit);
  const value = parseFloat(row.estimatedValue);
  if (!mw || mw < MIN_MW_FOR_RATE || !Number.isFinite(value)) return null;
  return value / mw;
};

export default function OrdersInLine() {
  const { user, pagePermissions } = useAuth();

  // Own page permission (orders_in_pipeline.view/create/edit/delete in the
  // `permissions` table). Previously this reused LEADS, which meant anyone who
  // could see leads could see this register and vice versa — the two audiences
  // are not the same, so it now stands on its own code.
  // Removal note: dropping this feature now also means deleting the
  // orders_in_pipeline.* permission rows and the sales_orders_in_pipeline menu item.
  const perms     = pagePermissions?.ORDERS_IN_PIPELINE || [];
  const canView   = perms.includes('VIEW');
  const canCreate = perms.includes('CREATE');
  const canEdit   = perms.includes('EDIT');
  const canDelete = perms.includes('DELETE');

  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  // filters
  const [searchTerm,     setSearchTerm]     = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');

  // master data
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [users,           setUsers]           = useState([]);

  // modal + delete
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState(emptyForm());
  const [phoneError, setPhoneError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewRecord,   setViewRecord]   = useState(null);

  const pinAbortRef = useRef(null);
  const pinTimerRef = useRef(null);

  /* ── data ──────────────────────────────────────────────────────────────── */
  const fetchRecords = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await ordersInLineApi.getAll({
        search: searchTerm.trim(),
        status: statusFilter,
        category: categoryFilter,
        fromDate: dateFrom,
        toDate: dateTo,
      });
      setRecords(data);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED') showError(e.message || 'Failed to load orders in pipeline');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [canView, searchTerm, statusFilter, categoryFilter, dateFrom, dateTo, showError]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchRecords, 350);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  // Master data — loaded once. A failure here must not stop the list rendering.
  useEffect(() => {
    if (!canView) return;
    ordersInLineApi.getCategoryOptions()
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]));
    ordersInLineApi.getUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [canView]);

  const ownerName = useCallback((ownerUserId) => {
    if (!ownerUserId) return '—';
    const u = users.find((x) => String(x.id) === String(ownerUserId));
    return u?.name || u?.fullName || `User #${ownerUserId}`;
  }, [users]);

  /* ── capacity ⇄ rate ⇄ estimated value, kept consistent both ways ───────── */

  // Numbers only, at most one decimal point.
  const numeric = (raw) => raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

  // Editing capacity or rate recomputes the total; editing the total recomputes
  // the rate. Each handler writes both fields from the value being edited, so
  // there is no feedback loop.
  const setCapacityFields = (patch) => setForm((p) => {
    const next = { ...p, ...patch };
    const mw = toMw(next.capacity, next.capacityUnit);
    if (mw && next.ratePerMw) {
      next.estimatedValue = money2(mw * parseFloat(next.ratePerMw));
    } else if (mw >= MIN_MW_FOR_RATE && next.estimatedValue) {
      next.ratePerMw = money2(parseFloat(next.estimatedValue) / mw);
    }
    // Dropping below 1 MW clears a rate that would now be misleading.
    if (!mw || mw < MIN_MW_FOR_RATE) next.ratePerMw = '';
    return next;
  });

  const setRatePerMw = (raw) => setForm((p) => {
    const ratePerMw = numeric(raw);
    const mw = toMw(p.capacity, p.capacityUnit);
    return {
      ...p,
      ratePerMw,
      estimatedValue: mw && ratePerMw ? money2(mw * parseFloat(ratePerMw)) : p.estimatedValue,
    };
  });

  const setEstimatedValue = (raw) => setForm((p) => {
    const estimatedValue = numeric(raw);
    const mw = toMw(p.capacity, p.capacityUnit);
    const canRate = mw && mw >= MIN_MW_FOR_RATE;
    return {
      ...p,
      estimatedValue,
      ratePerMw: canRate && estimatedValue ? money2(parseFloat(estimatedValue) / mw) : p.ratePerMw,
    };
  });

  const formMw = toMw(form.capacity, form.capacityUnit);
  // Per-MW pricing only makes sense at or above a megawatt — see MIN_MW_FOR_RATE.
  const canUseRate = Boolean(formMw) && formMw >= MIN_MW_FOR_RATE;

  /* ── PIN → state / district, same lookup the Leads form uses ────────────── */
  const handlePincodeChange = (value) => {
    const pin = value.replace(/\D/g, '').slice(0, 6);
    setForm((p) => ({ ...p, pincode: pin }));

    if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    if (pinAbortRef.current) pinAbortRef.current.abort();
    if (pin.length !== 6) return;

    pinTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      pinAbortRef.current = controller;
      try {
        const hit = await ordersInLineApi.lookupPincode(pin, controller.signal);
        if (hit) setForm((p) => ({ ...p, state: hit.state, district: hit.district }));
      } catch { /* aborted or unreachable — the fields stay manually editable */ }
    }, 600);
  };

  useEffect(() => () => {
    if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    if (pinAbortRef.current) pinAbortRef.current.abort();
  }, []);

  /* ── modal ─────────────────────────────────────────────────────────────── */
  const openCreate = () => {
    if (!canCreate) { showWarning('You do not have permission to create records'); return; }
    setPhoneError('');
    setForm({ ...emptyForm(), ownerUserId: user?.id ? String(user.id) : '' });
    setShowModal(true);
  };

  const openEdit = (row) => {
    if (!canEdit) { showWarning('You do not have permission to edit records'); return; }
    setPhoneError('');
    // Rate is not a column — recover it from the stored total and capacity.
    // ratePerMwOf withholds it below 1 MW, so sub-MW records open with it blank.
    setForm({
      id: row.id,
      clientName: row.clientName || '',
      sourceParty: row.sourceParty || '',
      sourceType: row.sourceType || '',
      capacity: row.capacity || '',
      capacityUnit: row.capacityUnit || 'kW',
      capacityType: row.capacityType || '',
      ratePerMw: money2(ratePerMwOf(row)),
      category: row.category || '',
      pincode: '',
      state: row.state || '',
      district: row.district || '',
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      estimatedValue: row.estimatedValue || '',
      receivedDate: row.receivedDate || '',
      expectedDecisionDate: row.expectedDecisionDate || '',
      status: row.status || 'Enquiry Received',
      ownerUserId: row.ownerUserId ? String(row.ownerUserId) : '',
      remarks: row.remarks || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.clientName.trim()) { showError('Client name is required'); return; }
    if (form.phone && form.phone.length !== 10) { setPhoneError('Must be exactly 10 digits'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showError('Please enter a valid email address'); return;
    }
    if (form.capacity && !form.capacityUnit) { showError('Select a capacity unit'); return; }
    if (form.id && !canEdit)   { showWarning('You do not have permission to edit records'); return; }
    if (!form.id && !canCreate) { showWarning('You do not have permission to create records'); return; }

    // `pincode` and `ratePerMw` are UI-only helpers with no column — strip them.
    // ratePerMw is recoverable as estimatedValue / capacityInMw on edit.
    const { pincode, ratePerMw, ...rest } = form;
    const payload = { ...rest, ownerUserId: form.ownerUserId ? Number(form.ownerUserId) : null };

    setSaving(true);
    try {
      if (form.id) {
        await ordersInLineApi.update(form.id, payload);
        showSuccess('Order in pipeline updated');
      } else {
        await ordersInLineApi.create(payload);
        showSuccess('Order in pipeline added');
      }
      setShowModal(false);
      setForm(emptyForm());
      fetchRecords();
    } catch (err) {
      showError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await ordersInLineApi.remove(target.id);
      showSuccess('Order in pipeline removed');
      fetchRecords();
    } catch (err) {
      showError(err.message || 'Delete failed');
    }
  };

  const clearFilters = () => {
    setSearchTerm(''); setStatusFilter(''); setCategoryFilter('');
    setDateFrom(''); setDateTo('');
  };

  const hasFilters = Boolean(searchTerm || statusFilter || categoryFilter || dateFrom || dateTo);

  /* ── render ────────────────────────────────────────────────────────────── */
  if (!canView) {
    return (
      <div className="oil-container">
        <div className="oil-empty">
          <h3>No access</h3>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="oil-container">
      <div className="oil-breadcrumb">
        <span>Sales</span>
        <span className="oil-breadcrumb-separator">›</span>
        <span className="oil-breadcrumb-active">Orders in Pipeline</span>
      </div>

      <div className="oil-header">
        <h1>Orders in Pipeline</h1>
        <div className="oil-header-sub">
          Potential orders where it is not yet known whether they will be confirmed.
        </div>
      </div>

      <div className="oil-action-bar">
        <div className="oil-search-wrapper">
          <Search className="oil-search-icon" size={16} />
          <input
            type="text"
            className="oil-search-input"
            placeholder="Search client, source party or contact person…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="oil-filters">
          <div className="oil-filter-slot">
            <FilterSelect
              value={statusFilter}
              options={toOptions(ORDERS_IN_LINE_STATUSES)}
              placeholder="All Statuses"
              onChange={setStatusFilter}
            />
          </div>
          <div className="oil-filter-slot">
            <FilterSelect
              value={categoryFilter}
              options={categoryOptions}
              placeholder="All Categories"
              onChange={setCategoryFilter}
            />
          </div>
          <DateRangeFilter
            appliedFrom={dateFrom}
            appliedTo={dateTo}
            onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onClear={() => { setDateFrom(''); setDateTo(''); }}
          />
          {hasFilters && (
            <button type="button" className="oil-btn-link" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="oil-action-buttons">
          {canCreate && (
            <button type="button" className="oil-btn oil-btn-primary" onClick={openCreate}>
              <Plus size={15} /> Add Order in Pipeline
            </button>
          )}
        </div>
      </div>

      {loading && <CrmPreloader text="Loading Orders in Pipeline…" />}

      <div className="oil-table-card">
        {records.length === 0 && !loading ? (
          <div className="oil-empty">
            <Inbox className="oil-empty-icon" size={48} />
            <h3>{hasFilters ? 'No matching records' : 'No orders in pipeline yet'}</h3>
            <p>
              {hasFilters
                ? 'Try clearing the search or filters.'
                : 'Record the first potential order that came in informally.'}
            </p>
            {hasFilters ? (
              <button type="button" className="oil-btn oil-btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            ) : canCreate && (
              <button type="button" className="oil-btn oil-btn-primary" onClick={openCreate}>
                <Plus size={15} /> Add the first record
              </button>
            )}
          </div>
        ) : (
          <div className="oil-table-wrapper">
            <table className="oil-table">
              <thead>
                <tr>
                  <th className="oil-sno">S.No</th>
                  <th>Client Name</th>
                  <th>Capacity</th>
                  <th>Category</th>
                  <th className="oil-num-th">Estimated Cost</th>
                  <th className="oil-num-th">Cost per MW</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Owner</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row, i) => {
                  const rate = ratePerMwOf(row);
                  return (
                    <tr key={row.id}>
                      <td className="oil-sno">{i + 1}</td>
                      <td className="oil-cell-strong">{row.clientName}</td>
                      <td>
                        {capacityLabel(row) || <span className="oil-cell-muted">—</span>}
                      </td>
                      <td>{row.category || <span className="oil-cell-muted">—</span>}</td>
                      <td className="oil-num-td">
                        {row.estimatedValue
                          ? <span title={fmtInr(row.estimatedValue)}>{fmtCompactInr(row.estimatedValue)}</span>
                          : <span className="oil-cell-muted">—</span>}
                      </td>
                      <td className="oil-num-td">
                        {rate
                          ? <span title={`${fmtInr(rate)} per MW`}>{fmtCompactInr(rate)}</span>
                          : <span className="oil-cell-muted">—</span>}
                      </td>
                      <td>
                        <span className={`oil-badge ${statusClass(row.status)}`}>{row.status}</span>
                      </td>
                      <td>{fmtDate(row.receivedDate)}</td>
                      <td>{ownerName(row.ownerUserId)}</td>
                      <td>
                        <div className="oil-actions-cell">
                          <button
                            type="button"
                            className="oil-icon-btn"
                            title="View"
                            onClick={() => setViewRecord(row)}
                          >
                            <Eye size={15} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              className="oil-icon-btn"
                              title="Edit"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="oil-icon-btn oil-icon-danger"
                              title="Delete"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── create / edit modal — one modal serves both ─────────────────────── */}
      {showModal && (
        <div className="oil-modal-overlay">
          <div className="oil-modal" onClick={(e) => e.stopPropagation()}>
            <div className="oil-modal-header">
              <h2>{form.id ? 'Edit Order in Pipeline' : 'Add Order in Pipeline'}</h2>
              <button type="button" className="oil-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="oil-modal-body">
              <form id="oil-form" onSubmit={handleSubmit}>
                <div className="oil-form-section">
                  <h3 className="oil-form-section-title">Enquiry</h3>
                  <div className="oil-form-grid">
                    <div className="oil-form-group">
                      <label>Client / Site Name *</label>
                      <input
                        type="text"
                        required
                        value={form.clientName}
                        onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                        placeholder="Who is the order for?"
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Source Party</label>
                      <input
                        type="text"
                        value={form.sourceParty}
                        onChange={(e) => setForm((p) => ({ ...p, sourceParty: e.target.value }))}
                        placeholder="Which developer / partner referred it"
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Source Type</label>
                      <FilterSelect
                        value={form.sourceType}
                        options={toOptions(ORDERS_IN_LINE_SOURCE_TYPES)}
                        placeholder="Select Source Type"
                        onChange={(v) => setForm((p) => ({ ...p, sourceType: v }))}
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Category</label>
                      <FilterSelect
                        value={form.category}
                        options={categoryOptions}
                        placeholder="Select Category"
                        onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Capacity</label>
                      <div className="oil-capacity-row">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.capacity}
                          onChange={(e) => setCapacityFields({ capacity: numeric(e.target.value) })}
                          placeholder="e.g. 81.16"
                        />
                        <FilterSelect
                          value={form.capacityUnit}
                          options={toOptions(CAPACITY_UNITS)}
                          placeholder="Unit"
                          onChange={(v) => setCapacityFields({ capacityUnit: v })}
                        />
                      </div>
                      {form.capacity && !form.capacityUnit && (
                        <span className="oil-field-error">Select a unit</span>
                      )}
                    </div>
                    <div className="oil-form-group">
                      <label>AC / DC</label>
                      <FilterSelect
                        value={form.capacityType}
                        options={toOptions(CAPACITY_TYPES)}
                        placeholder="Select AC or DC"
                        onChange={(v) => setForm((p) => ({ ...p, capacityType: v }))}
                      />
                      <span className="oil-field-hint">Which side the capacity is quoted on</span>
                    </div>
                    <div className="oil-form-group">
                      <label>Rate per MW (₹)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.ratePerMw}
                        onChange={(e) => setRatePerMw(e.target.value)}
                        placeholder="e.g. 32000000"
                        disabled={!canUseRate}
                      />
                      <span className="oil-field-hint">
                        {!formMw
                          ? 'Enter a capacity in kW / kWp / MW / MWp first'
                          : !canUseRate
                            ? 'Only for 1 MW and above — enter the value directly below'
                            : `${fmtInr(form.ratePerMw) || '—'} per MW`}
                      </span>
                    </div>

                    <div className="oil-form-group oil-form-group-full">
                      <label>Estimated Value (₹)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={form.estimatedValue}
                        onChange={(e) => setEstimatedValue(e.target.value)}
                        placeholder="Indicative only — or let the rate above fill it in"
                      />
                      {(canUseRate && form.ratePerMw && form.estimatedValue) ? (
                        <div className="oil-calc-hint">
                          <strong>{money2(formMw)} MW</strong> × <strong>{fmtInr(form.ratePerMw)}</strong> per MW
                          {' = '}
                          <span className="oil-calc-total">{fmtInr(form.estimatedValue)}</span>
                          {fmtCompactInr(form.estimatedValue) && ` (${fmtCompactInr(form.estimatedValue)})`}
                        </div>
                      ) : form.estimatedValue ? (
                        <span className="oil-field-hint">
                          {fmtInr(form.estimatedValue)}
                          {fmtCompactInr(form.estimatedValue) && ` · ${fmtCompactInr(form.estimatedValue)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="oil-form-section">
                  <h3 className="oil-form-section-title">Location</h3>
                  <div className="oil-form-grid">
                    <div className="oil-form-group">
                      <label>PIN Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength="6"
                        value={form.pincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="6 digits"
                      />
                      <span className="oil-field-hint">Fills state &amp; district automatically</span>
                    </div>
                    <div className="oil-form-group">
                      <label>State</label>
                      <input
                        type="text"
                        value={form.state}
                        onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                        placeholder="Auto-filled by PIN code or type manually"
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>District</label>
                      <input
                        type="text"
                        value={form.district}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                        placeholder="Auto-filled by PIN code or type manually"
                      />
                    </div>
                  </div>
                </div>

                <div className="oil-form-section">
                  <h3 className="oil-form-section-title">Contact</h3>
                  <div className="oil-form-grid">
                    <div className="oil-form-group">
                      <label>Contact Person</label>
                      <input
                        type="text"
                        value={form.contactPerson}
                        onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Phone</label>
                      <input
                        type="text"
                        maxLength="10"
                        value={form.phone}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setForm((p) => ({ ...p, phone: v }));
                          setPhoneError(v && v.length !== 10 ? 'Must be exactly 10 digits' : '');
                        }}
                        placeholder="10 digit number"
                      />
                      {phoneError && <span className="oil-field-error">{phoneError}</span>}
                    </div>
                    <div className="oil-form-group">
                      <label>Email</label>
                      <input
                        type="text"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="oil-form-section">
                  <h3 className="oil-form-section-title">Tracking</h3>
                  <div className="oil-form-grid">
                    <div className="oil-form-group">
                      <label>Status</label>
                      <FilterSelect
                        value={form.status}
                        options={toOptions(ORDERS_IN_LINE_STATUSES)}
                        placeholder="Select Status"
                        onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Owner</label>
                      <FilterSelect
                        value={form.ownerUserId}
                        options={users.map((u) => ({
                          value: String(u.id),
                          label: u.name || u.fullName || `User #${u.id}`,
                        }))}
                        placeholder="Select Owner"
                        onChange={(v) => setForm((p) => ({ ...p, ownerUserId: v }))}
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Received Date</label>
                      <input
                        type="date"
                        value={form.receivedDate}
                        onChange={(e) => setForm((p) => ({ ...p, receivedDate: e.target.value }))}
                      />
                    </div>
                    <div className="oil-form-group">
                      <label>Expected Decision Date</label>
                      <input
                        type="date"
                        value={form.expectedDecisionDate}
                        onChange={(e) => setForm((p) => ({ ...p, expectedDecisionDate: e.target.value }))}
                      />
                    </div>
                    <div className="oil-form-group oil-form-group-full">
                      <label>Remarks</label>
                      <textarea
                        value={form.remarks}
                        onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                        placeholder="Anything worth remembering about this enquiry"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="oil-modal-footer">
              <button
                type="button"
                className="oil-btn oil-btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" form="oil-form" className="oil-btn oil-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : (form.id ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── read-only detail view ───────────────────────────────────────────── */}
      {viewRecord && (
        <div className="oil-modal-overlay" onClick={() => setViewRecord(null)}>
          <div className="oil-modal oil-modal-view" onClick={(e) => e.stopPropagation()}>
            <div className="oil-modal-header">
              <div style={{ minWidth: 0 }}>
                <h2>{viewRecord.clientName}</h2>
                <span className={`oil-badge ${statusClass(viewRecord.status)}`}>{viewRecord.status}</span>
              </div>
              <button type="button" className="oil-modal-close" onClick={() => setViewRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="oil-modal-body">
              {(() => {
                const rate = ratePerMwOf(viewRecord);
                const sections = [
                  ['Enquiry', [
                    ['Source Party',  viewRecord.sourceParty],
                    ['Source Type',   viewRecord.sourceType],
                    ['Category',      viewRecord.category],
                    ['Capacity',      capacityLabel(viewRecord)],
                    ['Estimated Cost', viewRecord.estimatedValue
                      ? `${fmtInr(viewRecord.estimatedValue)} (${fmtCompactInr(viewRecord.estimatedValue)})` : null],
                    ['Cost per MW',   rate ? `${fmtInr(rate)} (${fmtCompactInr(rate)})` : null],
                  ]],
                  ['Location', [
                    ['State',    viewRecord.state],
                    ['District', viewRecord.district],
                  ]],
                  ['Contact', [
                    ['Contact Person', viewRecord.contactPerson],
                    ['Phone',          viewRecord.phone],
                    ['Email',          viewRecord.email],
                  ]],
                  ['Tracking', [
                    ['Owner',                  ownerName(viewRecord.ownerUserId)],
                    ['Received Date',          fmtDate(viewRecord.receivedDate)],
                    ['Expected Decision Date', fmtDate(viewRecord.expectedDecisionDate)],
                  ]],
                ];

                return (
                  <>
                    {sections.map(([title, rows]) => (
                      <div key={title} className="oil-form-section">
                        <h3 className="oil-form-section-title">{title}</h3>
                        <div className="oil-view-grid">
                          {rows.map(([label, value]) => (
                            <div key={label} className="oil-view-item">
                              <div className="oil-view-label">{label}</div>
                              <div className="oil-view-value">
                                {value || <span className="oil-cell-muted">—</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {viewRecord.remarks && (
                      <div className="oil-form-section">
                        <h3 className="oil-form-section-title">Remarks</h3>
                        <div className="oil-view-value oil-view-remarks">{viewRecord.remarks}</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="oil-modal-footer">
              <button type="button" className="oil-btn oil-btn-secondary" onClick={() => setViewRecord(null)}>
                Close
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="oil-btn oil-btn-primary"
                  onClick={() => { const r = viewRecord; setViewRecord(null); openEdit(r); }}
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        type="alert"
        title="Delete this record?"
        message={`${deleteTarget?.clientName || 'This record'} will be removed from the register.`}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
