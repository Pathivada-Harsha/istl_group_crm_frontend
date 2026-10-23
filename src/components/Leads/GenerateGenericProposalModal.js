import React, { useCallback, useEffect, useState } from 'react';

/* ─── Dark theme helpers (mirror GenerateProposalModal.js convention) ──────── */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff': '#1b2130', '#ffffff': '#1b2130', 'white': '#1b2130',
  '#f9fafb': '#0f1420', '#f8fafc': '#0f1420', '#fafafa': '#0f1420',
  '#f3f4f6': '#232b3b', '#f1f5f9': '#232b3b', '#eef2ff': '#1d2a4a', '#ecfdf5': '#12301f',
  '#fffbeb': '#332a12', '#fef2f2': '#3a1d1d', '#f5f3ff': '#241d3d',
  '#e5e7eb': '#2b3445', '#e2e8f0': '#2b3445', '#cbd5e1': '#3a4456', '#d1d5db': '#3a4456',
};
const __TM = {
  '#0f172a': '#e7ecf3', '#111827': '#e7ecf3', '#1e293b': '#d4dbe6',
  '#374151': '#c2cbd8', '#475569': '#aab4c2', '#334155': '#aab4c2',
  '#64748b': '#94a1b3', '#6b7280': '#94a1b3', '#94a3b8': '#9aa7b8', '#9ca3af': '#9aa7b8',
  '#ef4444': '#f06a6a', '#dc2626': '#f06a6a', '#2563eb': '#5b9bf0', '#4f46e5': '#7c8cf8',
  '#059669': '#34d399', '#15803d': '#34d399', '#b45309': '#fbbf24',
};
const __sbg = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __SM[k]) ? __SM[k] : v; };
const __stc = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __TM[k]) ? __TM[k] : v; };
const useThemeVersion = () => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const DEFAULT_GST = 18;
const DEFAULT_VALIDITY_DAYS = 15;

/* ─── Numbers ──────────────────────────────────────────────────────────────── */
const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const inr = (v) => '₹' + Math.round(num(v)).toLocaleString('en-IN');

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
  'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const under1000 = (n) => {
  if (n >= 100) {
    const head = ONES[Math.floor(n / 100)] + ' Hundred';
    return n % 100 ? head + ' ' + under1000(n % 100) : head;
  }
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? t + ' ' + ONES[n % 10] : t;
};
/**
 * Preview only — the document itself is worded by the backend's AmountInWords,
 * which this mirrors so the review step shows what will actually print.
 */
const amountInWords = (value) => {
  let n = Math.round(num(value));
  if (!n) return 'Rupees Zero Only.';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (crore) parts.push(under1000(crore) + (crore === 1 ? ' Crore' : ' Crores'));
  if (lakh) parts.push(under1000(lakh) + (lakh === 1 ? ' Lakh' : ' Lakhs'));
  if (thousand) parts.push(under1000(thousand) + ' Thousand');
  if (hundred) parts.push(under1000(hundred) + ' Hundred');
  if (rest) parts.push(under1000(rest));
  return 'Rupees ' + parts.join(' ') + ' Only.';
};

const blankScopeRow = () => ({ activity: '', specification: '', quantity: '', unit: '', notes: '' });
const blankBomRow = () => ({ component: '', specification: '', make: '', quantity: '', unit: '' });

const filledScope = (r) => (r.activity || '').trim() || (r.specification || '').trim();
const filledBom = (r) => (r.component || '').trim() || (r.specification || '').trim();

/**
 * Editable review step for the standard business proposal — the document every
 * lead that is not solar gets.
 *
 * <p>Prefilled from the lead's Technical Scope, BOM and Budget tabs plus the
 * proposal record's own narrative fields (About Us, About the System, Payment
 * Terms, Defect Liability), which are authored on the proposal form. The
 * company name and logo are NOT editable here: they are fixed server-side.
 *
 * <p>Deliberately carries no capacity, subsidy or ROI — those are solar concepts
 * and this document is industry-neutral.
 */
export default function GenerateGenericProposalModal({
  open, lead, currentUser, proposalId = null, onClose, onGenerated, showSuccess, showError,
}) {
  useThemeVersion();
  const [form, setForm] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const leadId = lead?.id;

  const headers = React.useMemo(() => ({
    'User-Id': String(currentUser?.id ?? ''),
    'User-Role': currentUser?.role ?? '',
  }), [currentUser?.id, currentUser?.role]);

  // Callbacks arrive as inline arrows from the lead page, so they change every
  // render. Reading them through a ref keeps the prefill effect keyed on the
  // lead/proposal alone instead of refetching on every parent re-render.
  const cbRef = React.useRef({ onClose, showError });
  cbRef.current = { onClose, showError };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ leadId: String(leadId) });
      if (proposalId) qs.set('proposalId', String(proposalId));
      const res = await fetch(`${API_BASE_URL}/proposals/generic/prefill?${qs}`, { credentials: 'include', headers });
      const data = await res.json();
      if (!data.success) {
        cbRef.current.showError(data.message || 'Could not prepare the proposal');
        cbRef.current.onClose();
        return;
      }
      const d = data.data;
      // A previous generation wins over the defaults — the preparer's corrections
      // to the wording and the signatory must survive a re-generate.
      const p = d.previous || {};

      // …except the price. The Budget tab's markup is the negotiation lever and
      // moves between versions, so the quote follows the live Budget Estimation
      // exactly as the scope and BOM do. The GST % is the preparer's setting, so
      // that one is kept, and the total is re-derived from the pair.
      const gstPercent = p.gstPercent ?? d.gstPercent ?? DEFAULT_GST;
      const basePrice = d.basePrice ?? p.basePrice ?? '';
      const totalCost = basePrice === ''
        ? (d.totalCost ?? p.totalCost ?? '')
        : Math.round(num(basePrice) * (1 + num(gstPercent) / 100));

      setMeta({
        regeneration: !!d.regeneration,
        lastVersion: d.lastVersion || 0,
        orgName: d.orgName || '',
        hasLogo: !!d.hasLogo,
        scopeSource: d.scopeSource,
        bomSource: d.bomSource,
        budgetSource: d.budgetSource,
        textSource: d.textSource,
        previousBasePrice: p.basePrice ?? null,
      });
      setForm({
        title: p.title ?? d.title ?? '',
        clientName: p.clientName ?? d.clientName ?? '',
        clientAddress: p.clientAddress ?? d.clientAddress ?? '',
        siteLocation: p.siteLocation ?? d.siteLocation ?? '',
        description: p.description ?? d.description ?? '',
        aboutUs: p.aboutUs ?? d.aboutUs ?? '',
        aboutSystem: p.aboutSystem ?? d.aboutSystem ?? '',
        workDescription: p.workDescription ?? d.workDescription ?? '',
        basePrice,
        gstPercent,
        totalCost,
        paymentTerms: p.paymentTerms ?? d.paymentTerms ?? '',
        defectLiabilityPeriod: p.defectLiabilityPeriod ?? d.defectLiabilityPeriod ?? '',
        warrantyNotes: p.warrantyNotes ?? d.warrantyNotes ?? '',
        validityDays: p.validityDays ?? d.validityDays ?? DEFAULT_VALIDITY_DAYS,
        quoteValidFrom: (p.quoteValidFrom ?? d.quoteValidFrom ?? '').slice(0, 10),
        preparedByName: p.preparedByName ?? currentUser?.name ?? '',
        preparedByDesignation: p.preparedByDesignation ?? '',
        preparedByPhone: p.preparedByPhone ?? '',
        preparedByEmail: p.preparedByEmail ?? '',
        // Scope and BOM always come from the lead's tabs: they are the live source
        // of truth, and a stale snapshot is exactly what this feature replaces.
        scopeRows: (d.scopeRows || []).map(r => ({ ...r })),
        bomRows: (d.bomRows || []).map(r => ({ ...r })),
      });
    } catch {
      cbRef.current.showError('Could not prepare the proposal');
      cbRef.current.onClose();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, proposalId, headers]);

  useEffect(() => { if (open && leadId) load(); }, [open, leadId, load]);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Base / GST / total stay consistent whichever field is touched: sales quote
  // round totals, so editing the total back-computes the base.
  const setBase = (v) => setForm(f => ({
    ...f, basePrice: v,
    totalCost: v === '' ? '' : Math.round(num(v) * (1 + num(f.gstPercent) / 100)),
  }));
  const setGst = (v) => setForm(f => ({
    ...f, gstPercent: v,
    totalCost: f.basePrice === '' ? f.totalCost : Math.round(num(f.basePrice) * (1 + num(v) / 100)),
  }));
  const setTotal = (v) => setForm(f => ({
    ...f, totalCost: v,
    basePrice: v === '' ? '' : Math.round(num(v) / (1 + num(f.gstPercent) / 100)),
  }));

  const setRow = (key, i, k, v) => setForm(f => ({
    ...f, [key]: f[key].map((r, idx) => idx === i ? { ...r, [k]: v } : r),
  }));
  const addRow = (key, blank) => setForm(f => ({ ...f, [key]: [...f[key], blank()] }));
  const rmRow = (key, i) => setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));

  const generate = async () => {
    if (!form.title.trim() && !form.clientName.trim()) {
      showError('The proposal needs a title or a client name'); return;
    }
    if (!form.scopeRows.some(filledScope) && !form.bomRows.some(filledBom)) {
      showError("The proposal needs at least one scope or Bill of Material line — add them on the lead's Technical Scope or BOM tab.");
      return;
    }
    if (num(form.totalCost) <= 0) { showError('Enter the total cost'); return; }

    setBusy(true);
    try {
      const payload = {
        leadId: lead.id,
        proposalId: proposalId || null,
        title: form.title,
        clientName: form.clientName,
        clientAddress: form.clientAddress,
        siteLocation: form.siteLocation,
        description: form.description,
        aboutUs: form.aboutUs,
        aboutSystem: form.aboutSystem,
        workDescription: form.workDescription,
        basePrice: num(form.basePrice),
        gstPercent: num(form.gstPercent),
        totalCost: num(form.totalCost),
        paymentTerms: form.paymentTerms,
        defectLiabilityPeriod: form.defectLiabilityPeriod,
        warrantyNotes: form.warrantyNotes,
        validityDays: Math.round(num(form.validityDays)) || DEFAULT_VALIDITY_DAYS,
        quoteValidFrom: form.quoteValidFrom,
        preparedByName: form.preparedByName,
        preparedByDesignation: form.preparedByDesignation,
        preparedByPhone: form.preparedByPhone,
        preparedByEmail: form.preparedByEmail,
        scopeRows: form.scopeRows.filter(filledScope).map(r => ({
          activity: r.activity || '', specification: r.specification || '',
          quantity: String(r.quantity ?? ''), unit: r.unit || '', notes: r.notes || '',
        })),
        bomRows: form.bomRows.filter(filledBom).map(r => ({
          component: r.component || '', specification: r.specification || '',
          make: r.make || '', quantity: String(r.quantity ?? ''), unit: r.unit || '',
        })),
      };
      const res = await fetch(`${API_BASE_URL}/proposals/generic/generate`, {
        method: 'POST', credentials: 'include',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { showError(data.message || 'Failed to generate the proposal'); return; }

      showSuccess(`Proposal document generated (v${data.data.version}).`);
      onGenerated && onGenerated(data.data);
      onClose();
    } catch {
      showError('Failed to generate the proposal');
    } finally {
      setBusy(false);
    }
  };

  /* ─── Styles ─────────────────────────────────────────────────────────────── */
  const L = { display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#475569'), marginBottom: 3 };
  const I = { width: '100%', padding: '7px 9px', border: `1px solid ${__sbg('#cbd5e1')}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: __sbg('#fff'), color: __stc('#0f172a') };
  const TA = { ...I, minHeight: 54, resize: 'vertical', fontFamily: 'inherit' };
  const card = { background: __sbg('#fff'), borderRadius: 8, border: `1px solid ${__sbg('#e2e8f0')}`, padding: 14, marginBottom: 12 };
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 };
  const title = { fontWeight: 700, marginBottom: 8, color: __stc('#0f172a'), fontSize: 14 };
  const hint = { fontSize: 11, color: __stc('#64748b'), marginTop: 3 };
  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: __stc('#64748b'), padding: '4px 6px', whiteSpace: 'nowrap' };
  const td = { padding: '3px 4px', verticalAlign: 'top' };
  const rmBtn = { border: 'none', background: 'none', color: __stc('#ef4444'), cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '4px 6px' };
  const addBtn = { marginTop: 6, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${__sbg('#cbd5e1')}`, background: __sbg('#f8fafc'), color: __stc('#334155') };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: __sbg('#f8fafc'), borderRadius: 12, width: 'min(1000px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ position: 'sticky', top: 0, background: '#2563eb', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <strong style={{ fontSize: 15 }}>
            {meta?.regeneration ? `Re-generate Proposal (v${(meta.lastVersion || 0) + 1})` : 'Generate Proposal'} — {lead?.name}
          </strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {loading || !form ? (
          <div style={{ padding: 40, textAlign: 'center', color: __stc('#64748b') }}>Reading the lead's tabs…</div>
        ) : (
          <div style={{ padding: 18 }}>
            {/* Branding is fixed server-side, not editable from this form. */}
            <div style={{ background: __sbg('#eef2ff'), border: `1px solid ${__sbg('#cbd5e1')}`, borderRadius: 8, padding: '9px 12px', marginBottom: 12, fontSize: 12, color: __stc('#334155') }}>
              The document will be branded as <strong>{meta?.orgName || 'the company'}</strong>
              {meta?.hasLogo ? ' with the company logo.' : '.'}
              {' '}Sections you leave blank are omitted from the document entirely.
            </div>

            {/* ── Cover ────────────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Cover</div>
              <div style={grid2}>
                <div><label style={L}>Proposal title</label><input style={I} value={form.title} onChange={e => set('title', e.target.value)} /></div>
                <div><label style={L}>Client name</label><input style={I} value={form.clientName} onChange={e => set('clientName', e.target.value)} /></div>
              </div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div><label style={L}>Client address</label><input style={I} value={form.clientAddress} onChange={e => set('clientAddress', e.target.value)} /></div>
                <div>
                  <label style={L}>Site location</label>
                  <input style={I} value={form.siteLocation} onChange={e => set('siteLocation', e.target.value)} />
                  <div style={hint}>Technical Scope → site location</div>
                </div>
              </div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div>
                  <label style={L}>Valid from</label>
                  <input type="date" style={I} value={form.quoteValidFrom} onChange={e => set('quoteValidFrom', e.target.value)} />
                </div>
                <div>
                  <label style={L}>Valid for (days)</label>
                  <input type="number" min="1" style={I} value={form.validityDays} onChange={e => set('validityDays', e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Narrative ────────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Introduction, about us &amp; proposed solution</div>
              <div style={hint}>{meta?.textSource}</div>
              <div style={{ marginTop: 8 }}>
                <label style={L}>Introduction</label>
                <textarea style={TA} value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={L}>About us</label>
                <textarea style={TA} value={form.aboutUs} onChange={e => set('aboutUs', e.target.value)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={L}>Proposed solution</label>
                <textarea style={TA} value={form.aboutSystem} onChange={e => set('aboutSystem', e.target.value)} />
              </div>
            </div>

            {/* ── Scope of work ────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Scope of work</div>
              <div style={hint}>{meta?.scopeSource}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead><tr>
                  <th style={{ ...th, width: '26%' }}>Activity</th>
                  <th style={{ ...th, width: '34%' }}>Specification</th>
                  <th style={{ ...th, width: '10%' }}>Qty</th>
                  <th style={{ ...th, width: '12%' }}>Unit</th>
                  <th style={{ ...th, width: '14%' }}>Notes</th>
                  <th style={{ ...th, width: '4%' }}></th>
                </tr></thead>
                <tbody>
                  {form.scopeRows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}><input style={I} value={r.activity || ''} onChange={e => setRow('scopeRows', i, 'activity', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.specification || ''} onChange={e => setRow('scopeRows', i, 'specification', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.quantity ?? ''} onChange={e => setRow('scopeRows', i, 'quantity', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.unit || ''} onChange={e => setRow('scopeRows', i, 'unit', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.notes || ''} onChange={e => setRow('scopeRows', i, 'notes', e.target.value)} /></td>
                      <td style={td}><button type="button" style={rmBtn} title="Remove line" onClick={() => rmRow('scopeRows', i)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" style={addBtn} onClick={() => addRow('scopeRows', blankScopeRow)}>+ Add line</button>
            </div>

            {/* ── Scope of supply ──────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Scope of supply / bill of materials</div>
              <div style={hint}>{meta?.bomSource} Rates are not printed — the offer is quoted as one lump sum below.</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead><tr>
                  <th style={{ ...th, width: '26%' }}>Item</th>
                  <th style={{ ...th, width: '32%' }}>Specification</th>
                  <th style={{ ...th, width: '18%' }}>Make</th>
                  <th style={{ ...th, width: '10%' }}>Qty</th>
                  <th style={{ ...th, width: '10%' }}>Unit</th>
                  <th style={{ ...th, width: '4%' }}></th>
                </tr></thead>
                <tbody>
                  {form.bomRows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}><input style={I} value={r.component || ''} onChange={e => setRow('bomRows', i, 'component', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.specification || ''} onChange={e => setRow('bomRows', i, 'specification', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.make || ''} onChange={e => setRow('bomRows', i, 'make', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.quantity ?? ''} onChange={e => setRow('bomRows', i, 'quantity', e.target.value)} /></td>
                      <td style={td}><input style={I} value={r.unit || ''} onChange={e => setRow('bomRows', i, 'unit', e.target.value)} /></td>
                      <td style={td}><button type="button" style={rmBtn} title="Remove line" onClick={() => rmRow('bomRows', i)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" style={addBtn} onClick={() => addRow('bomRows', blankBomRow)}>+ Add line</button>
            </div>

            {/* ── Commercial ───────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Commercial summary</div>
              <div>
                <label style={L}>Description of work</label>
                <input style={I} value={form.workDescription} onChange={e => set('workDescription', e.target.value)} />
              </div>
              <div style={{ ...grid3, marginTop: 10 }}>
                <div>
                  <label style={L}>Price excl. GST</label>
                  <input style={I} value={form.basePrice} onChange={e => setBase(e.target.value)} />
                  <div style={hint}>{meta?.budgetSource}</div>
                </div>
                <div>
                  <label style={L}>GST %</label>
                  <input style={I} value={form.gstPercent} onChange={e => setGst(e.target.value)} />
                </div>
                <div>
                  <label style={L}>Total incl. GST</label>
                  <input style={I} value={form.totalCost} onChange={e => setTotal(e.target.value)} />
                  <div style={hint}>Editing the total back-computes the base</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 10px', background: __sbg('#ecfdf5'), borderRadius: 6, fontSize: 13, color: __stc('#15803d'), fontWeight: 600 }}>
                {inr(form.totalCost)} — {amountInWords(form.totalCost)}
              </div>
            </div>

            {/* ── Terms ────────────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Payment terms, warranty &amp; defect liability</div>
              <div>
                <label style={L}>Payment terms</label>
                <textarea style={TA} value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} />
                <div style={hint}>One clause per line prints as a bulleted list; a single block prints as a paragraph.</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={L}>Defect liability period</label>
                <textarea style={TA} value={form.defectLiabilityPeriod} onChange={e => set('defectLiabilityPeriod', e.target.value)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={L}>Additional warranty notes (optional)</label>
                <textarea style={TA} value={form.warrantyNotes} onChange={e => set('warrantyNotes', e.target.value)} />
              </div>
            </div>

            {/* ── Signatory ────────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Signature block</div>
              <div style={hint}>Printed under "For {meta?.orgName || 'the company'}". The client's side is left blank for them to sign.</div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div><label style={L}>Name</label><input style={I} value={form.preparedByName} onChange={e => set('preparedByName', e.target.value)} /></div>
                <div><label style={L}>Designation</label><input style={I} value={form.preparedByDesignation} onChange={e => set('preparedByDesignation', e.target.value)} /></div>
              </div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div><label style={L}>Phone</label><input style={I} value={form.preparedByPhone} onChange={e => set('preparedByPhone', e.target.value)} /></div>
                <div><label style={L}>Email</label><input style={I} value={form.preparedByEmail} onChange={e => set('preparedByEmail', e.target.value)} /></div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={onClose} disabled={busy}
                style={{ padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${__sbg('#cbd5e1')}`, background: __sbg('#fff'), color: __stc('#334155') }}>
                Cancel
              </button>
              <button onClick={generate} disabled={busy}
                style={{ padding: '9px 20px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', border: 'none', background: busy ? '#93b4f0' : '#2563eb', color: '#fff' }}>
                {busy ? 'Generating…' : (meta?.regeneration ? `Generate v${(meta.lastVersion || 0) + 1}` : 'Generate Proposal')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
