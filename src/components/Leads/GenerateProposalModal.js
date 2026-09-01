import React, { useCallback, useEffect, useState } from 'react';
import { PROPERTY_TYPES } from './LeadSiteVisitTab';

/* ─── Dark theme helpers (mirror GeneratePoModal.js convention) ────────────── */
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

/* ─── Numbers ──────────────────────────────────────────────────────────────── */
const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const inr = (v) => '₹' + Math.round(num(v)).toLocaleString('en-IN');
const grouped = (v) => Math.round(num(v)).toLocaleString('en-IN');

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

/**
 * The ROI table, derived exactly as the backend derives it. Nothing here is
 * stored in the CRM — the tariff comes off the Site Visit tab and the rest are
 * declared assumptions, both shown and editable above this preview.
 */
const computeRoi = (f) => {
  const capacity = num(f.capacityKw);
  const tariff = num(f.tariffPerUnit);
  const specific = num(f.specificGeneration) || 1460;
  const life = Math.round(num(f.systemLifeYears)) || 25;
  const total = num(f.totalCost);

  const annualGeneration = Math.round(capacity * specific);
  const annualSavings = Math.round(annualGeneration * tariff);
  const monthlySavings = Math.round(annualSavings / 12);
  const paybackYears = annualSavings ? (total / annualSavings) : 0;
  const annualRoiPercent = total ? (annualSavings * 100 / total) : 0;
  const lifetimeGeneration = annualGeneration * life;
  const lifetimeSavings = annualSavings * life;
  return {
    specific, life, annualGeneration, annualSavings, monthlySavings,
    paybackYears: paybackYears.toFixed(1),
    annualRoiPercent: annualRoiPercent.toFixed(2),
    lifetimeGeneration, lifetimeSavings,
    netLifetimeBenefit: lifetimeSavings - total,
  };
};

const blankBomRow = () => ({ component: '', specification: '', make: '', quantity: '', unit: 'No\'s' });

/**
 * Editable review step for the Solar proposal document. Prefilled from the
 * lead's Technical Scope / BOM / Budget / Site Visit tabs; only the variable
 * regions are editable here — the boilerplate, images, header, footer and
 * signatory come from the fixed skeleton on the server and are not shown.
 */
export default function GenerateProposalModal({
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
      const res = await fetch(`${API_BASE_URL}/proposals/solar/prefill?${qs}`, { credentials: 'include', headers });
      const data = await res.json();
      if (!data.success) {
        cbRef.current.showError(data.message || 'Could not prepare the proposal');
        cbRef.current.onClose();
        return;
      }
      const d = data.data;
      // A previous generation wins over the tab defaults — the preparer's
      // corrections (tariff, subsidy, wording) must survive a re-generate.
      const p = d.previous || {};

      // …except the price. The Budget tab's profit markup is the negotiation
      // lever and moves between versions, so the quote follows the live
      // Budget Estimation exactly as the BOM does — carrying the last
      // version's number forward would silently quote a stale markup.
      // The GST % is the preparer's setting, so that one is kept, and the
      // total is re-derived from the pair rather than reused.
      // …and except the two optional-section flags when the lead's property type
      // has been corrected since that version. Inheriting them made a v1 generated
      // under the wrong type sticky: fixing the type on the lead would not bring
      // Subsidy/ROI back on v2. Anything else the preparer typed still carries over.
      const typeChanged = !!p.propertyType && !!d.propertyType && p.propertyType !== d.propertyType;
      const pick = (k) => (typeChanged ? d[k] : (p[k] ?? d[k]));

      const gstPercent = p.gstPercent ?? d.gstPercent ?? 8.9;
      const basePrice = d.basePrice ?? p.basePrice ?? '';
      const totalCost = basePrice === ''
        ? (d.totalCost ?? p.totalCost ?? '')
        : Math.round(num(basePrice) * (1 + num(gstPercent) / 100));

      setMeta({
        regeneration: !!d.regeneration,
        lastVersion: d.lastVersion || 0,
        bomSource: d.bomSource,
        budgetSource: d.budgetSource,
        roiSources: d.roiSources || {},
        // Shown next to the price when the Budget tab has moved since the last
        // version, so the change is visible instead of silent.
        previousBasePrice: p.basePrice ?? null,
        previousTotalCost: p.totalCost ?? null,
      });
      setForm({
        title: p.title ?? d.title ?? '',
        // No 'Residential' fallback: an unrecorded type must stay empty so the
        // preparer picks it, rather than silently quoting an MNRE subsidy.
        propertyType: p.propertyType ?? d.propertyType ?? '',
        coverTitle: p.coverTitle ?? d.coverTitle ?? '',
        coverSubtitle: p.coverSubtitle ?? d.coverSubtitle ?? '',
        clientName: p.clientName ?? d.clientName ?? '',
        siteLocation: p.siteLocation ?? d.siteLocation ?? '',
        capacityLabel: p.capacityLabel ?? d.capacityLabel ?? '',
        capacityLine: p.capacityLine ?? d.capacityLine ?? '',
        workDescription: p.workDescription ?? d.workDescription ?? '',
        basePrice,
        gstPercent,
        totalCost,
        quoteValidDays: p.quoteValidDays ?? d.quoteValidDays ?? 10,
        quoteValidFrom: (p.quoteValidFrom ?? d.quoteValidFrom ?? '').slice(0, 10),
        includeSubsidy: pick('includeSubsidy') ?? false,
        subsidyAmount: pick('subsidyAmount') ?? '',
        subsidyNote1: p.subsidyNote1 ?? d.subsidyNote1 ?? '',
        subsidyNote2: p.subsidyNote2 ?? d.subsidyNote2 ?? '',
        subsidyNote3: p.subsidyNote3 ?? d.subsidyNote3 ?? '',
        includeRoi: pick('includeRoi') ?? false,
        capacityKw: p.capacityKw ?? d.capacityKw ?? '',
        tariffPerUnit: p.tariffPerUnit ?? d.tariffPerUnit ?? '',
        specificGeneration: p.specificGeneration ?? d.specificGeneration ?? 1460,
        systemLifeYears: p.systemLifeYears ?? d.systemLifeYears ?? 25,
        // BOM always comes from the lead's tab: it is the live source of truth,
        // and a stale snapshot is exactly what this feature replaces.
        bomRows: (d.bomRows && d.bomRows.length ? d.bomRows : []).map(r => ({ ...r })),
      });
    } catch {
      cbRef.current.showError('Could not prepare the proposal');
      cbRef.current.onClose();
    } finally {
      setLoading(false);
    }
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

  // Mirrors the backend rules in SolarProposalDocService: subsidy follows the
  // property type, ROI follows the data. Because ROI is re-derived from capacity
  // and tariff rather than cleared, picking a type after ticking ROI no longer
  // wipes the tick — both toggles stay overridable either way.
  const setPropertyType = (v) => setForm(f => ({
    ...f,
    propertyType: v,
    includeSubsidy: v === 'Residential',
    includeRoi: num(f.capacityKw) > 0 && num(f.tariffPerUnit) > 0,
    coverTitle: `${f.clientName} ${v}`.trim(),
  }));

  const setBom = (i, k, v) => setForm(f => ({
    ...f, bomRows: f.bomRows.map((r, idx) => idx === i ? { ...r, [k]: v } : r),
  }));
  const addBom = () => setForm(f => ({ ...f, bomRows: [...f.bomRows, blankBomRow()] }));
  const rmBom = (i) => setForm(f => ({ ...f, bomRows: f.bomRows.filter((_, idx) => idx !== i) }));

  const generate = async () => {
    if (!form.clientName.trim()) { showError('Client name is required'); return; }
    if (!form.propertyType) { showError('Pick the proposal type — it is not recorded on this lead'); return; }
    if (!form.bomRows.some(r => (r.component || '').trim() || (r.specification || '').trim())) {
      showError('The proposal needs at least one Bill of Material line — add them on the lead\'s BOM tab.');
      return;
    }
    if (num(form.totalCost) <= 0) { showError('Enter the total cost'); return; }
    if (form.includeRoi && num(form.tariffPerUnit) <= 0) {
      showError('ROI needs the electricity tariff (₹/unit) — it is blank'); return;
    }
    if (form.includeRoi && num(form.capacityKw) <= 0) {
      showError('ROI needs the plant capacity in kWp'); return;
    }
    if (form.includeSubsidy && num(form.subsidyAmount) <= 0) {
      showError('Enter the subsidy amount, or switch the Subsidy section off'); return;
    }

    setBusy(true);
    try {
      const payload = {
        leadId: lead.id,
        proposalId: proposalId || null,
        title: form.title,
        propertyType: form.propertyType,
        coverTitle: form.coverTitle,
        coverSubtitle: form.coverSubtitle,
        clientName: form.clientName,
        siteLocation: form.siteLocation,
        capacityLabel: form.capacityLabel,
        capacityLine: form.capacityLine,
        workDescription: form.workDescription,
        basePrice: num(form.basePrice),
        gstPercent: num(form.gstPercent),
        totalCost: num(form.totalCost),
        quoteValidDays: Math.round(num(form.quoteValidDays)) || 10,
        quoteValidFrom: form.quoteValidFrom,
        includeSubsidy: !!form.includeSubsidy,
        subsidyAmount: form.includeSubsidy ? num(form.subsidyAmount) : null,
        subsidyNote1: form.subsidyNote1,
        subsidyNote2: form.subsidyNote2,
        subsidyNote3: form.subsidyNote3,
        includeRoi: !!form.includeRoi,
        capacityKw: num(form.capacityKw),
        tariffPerUnit: num(form.tariffPerUnit),
        specificGeneration: num(form.specificGeneration),
        systemLifeYears: Math.round(num(form.systemLifeYears)) || 25,
        bomRows: form.bomRows
          .filter(r => (r.component || '').trim() || (r.specification || '').trim())
          .map(r => ({
            component: r.component || '', specification: r.specification || '',
            make: r.make || '', quantity: String(r.quantity ?? ''), unit: r.unit || '',
          })),
      };
      const res = await fetch(`${API_BASE_URL}/proposals/solar/generate`, {
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

  const roi = form ? computeRoi(form) : null;

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
            <div style={{ background: __sbg('#eef2ff'), border: `1px solid ${__sbg('#cbd5e1')}`, borderRadius: 8, padding: '9px 12px', marginBottom: 12, fontSize: 12, color: __stc('#334155') }}>
              Only the client-specific content is editable here. The cover pages, company sections,
              images, running header, footer, warranty and signatory come from the approved
              proposal template and are identical on every proposal.
            </div>

            {/* ── Client & cover ───────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Client &amp; cover</div>
              <div style={grid2}>
                <div>
                  <label style={L}>Proposal type</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PROPERTY_TYPES.map(t => (
                      <button key={t} type="button" onClick={() => setPropertyType(t)}
                        style={{
                          flex: '1 1 30%', padding: '7px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                          border: `1.5px solid ${form.propertyType === t ? '#2563eb' : __sbg('#cbd5e1')}`,
                          background: form.propertyType === t ? '#2563eb' : __sbg('#fff'),
                          color: form.propertyType === t ? '#fff' : __stc('#334155'), fontWeight: 600,
                        }}>{t}</button>
                    ))}
                  </div>
                  <div style={hint}>
                    {form.propertyType
                      ? 'Subsidy applies to residential rooftops only. ROI is included whenever the capacity and tariff are known.'
                      : 'Property type not recorded on this lead — pick one.'}
                  </div>
                </div>
                <div><label style={L}>Proposal title (CRM record)</label><input style={I} value={form.title} onChange={e => set('title', e.target.value)} /></div>
              </div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div><label style={L}>Client name</label><input style={I} value={form.clientName} onChange={e => set('clientName', e.target.value)} /></div>
                <div>
                  <label style={L}>Location</label>
                  <input style={I} value={form.siteLocation} onChange={e => set('siteLocation', e.target.value)} />
                  <div style={hint}>Technical Scope → site location</div>
                </div>
              </div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div>
                  <label style={L}>Capacity label</label>
                  <input style={I} value={form.capacityLabel} onChange={e => set('capacityLabel', e.target.value)} />
                  <div style={hint}>Used in "Price for … Plant" and the ROI heading</div>
                </div>
                <div>
                  <label style={L}>Proposed solar capacity (header table)</label>
                  <input style={I} value={form.capacityLine} onChange={e => set('capacityLine', e.target.value)} />
                </div>
              </div>
              <div style={{ ...grid2, marginTop: 10 }}>
                <div><label style={L}>Cover title</label><input style={I} value={form.coverTitle} onChange={e => set('coverTitle', e.target.value)} /></div>
                <div>
                  <label style={L}>Cover subtitle</label>
                  <input style={I} value={form.coverSubtitle} onChange={e => set('coverSubtitle', e.target.value)} />
                  <div style={hint}>Printed between vertical bars: | {form.coverSubtitle} |</div>
                </div>
              </div>
            </div>

            {/* ── Financial pricing ────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Financial pricing</div>
              <div><label style={L}>Description of work</label><input style={I} value={form.workDescription} onChange={e => set('workDescription', e.target.value)} /></div>
              <div style={{ ...grid3, marginTop: 10 }}>
                <div>
                  <label style={L}>Price excl. GST (₹)</label>
                  <input style={I} type="number" value={form.basePrice} onChange={e => setBase(e.target.value)} />
                  <div style={hint}>{meta?.budgetSource}</div>
                </div>
                <div><label style={L}>GST %</label><input style={I} type="number" step="0.1" value={form.gstPercent} onChange={e => setGst(e.target.value)} /></div>
                <div>
                  <label style={L}>Total incl. GST (₹)</label>
                  <input style={I} type="number" value={form.totalCost} onChange={e => setTotal(e.target.value)} />
                  <div style={hint}>Edit this to quote a round figure — the base back-computes.</div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: __stc('#334155') }}>
                <span>GST amount: <strong>{inr(num(form.totalCost) - num(form.basePrice))}</strong></span>
                <span>Amount in words: <strong>{amountInWords(form.totalCost)}</strong></span>
              </div>
              {meta?.previousBasePrice != null
                && Math.round(num(meta.previousBasePrice)) !== Math.round(num(form.basePrice)) && (
                <div style={{ marginTop: 10, background: __sbg('#fffbeb'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, color: __stc('#b45309') }}>
                  v{meta.lastVersion} was quoted at <strong>{inr(meta.previousBasePrice)}</strong> excl. GST
                  {meta.previousTotalCost != null ? <> (<strong>{inr(meta.previousTotalCost)}</strong> incl.)</> : null}.
                  The Budget tab has changed since — this version uses the current price above.
                </div>
              )}
            </div>

            {/* ── Optional sections ────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Optional sections</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: __stc('#334155'), cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.includeSubsidy} onChange={e => set('includeSubsidy', e.target.checked)} />
                  Include <strong>Subsidy Details</strong>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: __stc('#334155'), cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.includeRoi} onChange={e => set('includeRoi', e.target.checked)} />
                  Include <strong>ROI Analysis</strong>
                </label>
              </div>
            </div>

            {/* ── Subsidy ──────────────────────────────────────────────────── */}
            {form.includeSubsidy && (
              <div style={{ ...card, borderLeft: `3px solid ${__stc('#059669')}` }}>
                <div style={title}>Subsidy details</div>
                <div style={grid2}>
                  <div>
                    <label style={L}>Central Government subsidy applicable (₹)</label>
                    <input style={I} type="number" value={form.subsidyAmount} onChange={e => set('subsidyAmount', e.target.value)} />
                    <div style={hint}>Default from the MNRE slab for this capacity — confirm before generating.</div>
                  </div>
                  <div style={{ alignSelf: 'end', fontSize: 12, color: __stc('#334155') }}>
                    Prints as: <strong>Central Government Subsidy Applicable: {inr(form.subsidyAmount)}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}><label style={L}>Applicability note 1</label><textarea style={TA} value={form.subsidyNote1} onChange={e => set('subsidyNote1', e.target.value)} /></div>
                <div style={{ marginTop: 10 }}><label style={L}>Applicability note 2</label><textarea style={TA} value={form.subsidyNote2} onChange={e => set('subsidyNote2', e.target.value)} /></div>
                <div style={{ marginTop: 10 }}><label style={L}>Applicability note 3</label><textarea style={TA} value={form.subsidyNote3} onChange={e => set('subsidyNote3', e.target.value)} /></div>
              </div>
            )}

            {/* ── ROI ──────────────────────────────────────────────────────── */}
            {form.includeRoi && (
              <div style={{ ...card, borderLeft: `3px solid ${__stc('#2563eb')}` }}>
                <div style={title}>ROI analysis</div>
                <div style={{ fontSize: 12, color: __stc('#64748b'), marginBottom: 10 }}>
                  Two inputs are entered, two are house assumptions, and the remaining eleven rows are computed.
                  Nothing is filled in for you from thin air — check these before generating.
                </div>
                <div style={grid2}>
                  <div>
                    <label style={L}>Plant capacity (kWp) — entered</label>
                    <input style={I} type="number" step="0.01" value={form.capacityKw} onChange={e => set('capacityKw', e.target.value)} />
                    <div style={hint}>Technical Scope → system capacity</div>
                  </div>
                  <div>
                    <label style={L}>Electricity tariff (₹/unit) — entered</label>
                    <input style={I} type="number" step="0.01" value={form.tariffPerUnit} onChange={e => set('tariffPerUnit', e.target.value)} />
                    <div style={hint}>{meta?.roiSources?.tariffPerUnit}</div>
                  </div>
                </div>
                <div style={{ ...grid2, marginTop: 10 }}>
                  <div>
                    <label style={L}>Specific generation (units/kWp/year) — assumption</label>
                    <input style={I} type="number" value={form.specificGeneration} onChange={e => set('specificGeneration', e.target.value)} />
                  </div>
                  <div>
                    <label style={L}>Estimated system life (years) — assumption</label>
                    <input style={I} type="number" value={form.systemLifeYears} onChange={e => set('systemLifeYears', e.target.value)} />
                  </div>
                </div>
                {(meta?.roiSources?.monthlyConsumptionUnits || meta?.roiSources?.sanctionedLoad) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: __stc('#64748b') }}>
                    From the Site Visit tab, for reference —
                    {meta.roiSources.monthlyConsumptionUnits ? ` monthly consumption: ${meta.roiSources.monthlyConsumptionUnits};` : ''}
                    {meta.roiSources.sanctionedLoad ? ` sanctioned load: ${meta.roiSources.sanctionedLoad}` : ''}
                  </div>
                )}

                <div style={{ marginTop: 12, background: __sbg('#f8fafc'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: __stc('#334155'), marginBottom: 6 }}>
                    Preview — the 15 rows that will print
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: __stc('#334155') }}>
                    <tbody>
                      {[
                        ['Proposed Solar Plant Capacity', form.capacityLabel],
                        ['Total Project Cost (Excl. GST)', inr(form.basePrice)],
                        [`GST @ ${form.gstPercent}%`, inr(num(form.totalCost) - num(form.basePrice))],
                        ['Total Project Cost (Incl. GST)', inr(form.totalCost)],
                        ['Electricity Tariff Considered', `₹${num(form.tariffPerUnit)} / Unit`],
                        ['Specific Energy Generation', `${grouped(roi.specific)} Units/kWp/Year`],
                        ['Annual Energy Generation', `${grouped(roi.annualGeneration)} Units`],
                        ['Annual Electricity Savings', inr(roi.annualSavings)],
                        ['Monthly Average Savings', inr(roi.monthlySavings)],
                        ['Simple Payback Period', `${roi.paybackYears} Years`],
                        ['Annual ROI', `${roi.annualRoiPercent}%`],
                        ['Estimated System Life', `${roi.life}+ Years`],
                        ['Lifetime Energy Generation', `${grouped(roi.lifetimeGeneration)} Units`],
                        ['Lifetime Electricity Savings', inr(roi.lifetimeSavings)],
                        ['Net Lifetime Financial Benefit', inr(roi.netLifetimeBenefit)],
                      ].map(([k, v], i) => (
                        <tr key={k} style={{ borderTop: i ? `1px solid ${__sbg('#e2e8f0')}` : 'none' }}>
                          <td style={{ padding: '3px 6px', width: 28, color: __stc('#94a3b8') }}>{i + 1}</td>
                          <td style={{ padding: '3px 6px' }}>{k}</td>
                          <td style={{ padding: '3px 6px', fontWeight: 600, textAlign: 'right' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Note block ───────────────────────────────────────────────── */}
            <div style={card}>
              <div style={title}>Quote validity</div>
              <div style={grid2}>
                <div><label style={L}>Valid for (days)</label><input style={I} type="number" value={form.quoteValidDays} onChange={e => set('quoteValidDays', e.target.value)} /></div>
                <div><label style={L}>Valid from</label><input style={I} type="date" value={form.quoteValidFrom} onChange={e => set('quoteValidFrom', e.target.value)} /></div>
              </div>
              <div style={{ ...hint, marginTop: 6 }}>
                The rest of the Note block — ROI note, net-metering/CEIG scope, transportation, execution
                timeline and the warranty lines — is fixed boilerplate.
              </div>
            </div>

            {/* ── Bill of Material ─────────────────────────────────────────── */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={title}>Bill of Material</div>
                <button onClick={addBom} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>+ Add row</button>
              </div>
              <div style={{ fontSize: 12, color: __stc('#64748b'), marginBottom: 8 }}>{meta?.bomSource}</div>
              {form.bomRows.length === 0 ? (
                <div style={{ background: __sbg('#fef2f2'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 6, padding: 12, fontSize: 13, color: __stc('#dc2626') }}>
                  This lead has no BOM lines. Add them on the lead's <strong>BOM</strong> tab, then generate —
                  the proposal's Bill of Material comes from there.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 30 }}>#</th>
                        <th style={{ ...th, width: 150 }}>Component</th>
                        <th style={th}>Specifications</th>
                        <th style={{ ...th, width: 150 }}>Make</th>
                        <th style={{ ...th, width: 70 }}>Qty</th>
                        <th style={{ ...th, width: 90 }}>Units</th>
                        <th style={{ ...th, width: 32 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {form.bomRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...td, color: __stc('#94a3b8'), fontSize: 12, paddingTop: 10 }}>{i + 1}</td>
                          <td style={td}><input style={I} value={r.component || ''} onChange={e => setBom(i, 'component', e.target.value)} /></td>
                          <td style={td}><input style={I} value={r.specification || ''} onChange={e => setBom(i, 'specification', e.target.value)} /></td>
                          <td style={td}><input style={I} value={r.make || ''} onChange={e => setBom(i, 'make', e.target.value)} /></td>
                          <td style={td}><input style={I} value={r.quantity ?? ''} onChange={e => setBom(i, 'quantity', e.target.value)} /></td>
                          <td style={td}><input style={I} value={r.unit || ''} onChange={e => setBom(i, 'unit', e.target.value)} /></td>
                          <td style={td}>
                            <button onClick={() => rmBom(i)} title="Remove row"
                              style={{ background: 'none', border: 'none', color: __stc('#dc2626'), cursor: 'pointer', fontSize: 16, padding: '6px 4px' }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button onClick={onClose} disabled={busy}
                style={{ padding: '9px 18px', borderRadius: 7, border: `1px solid ${__sbg('#cbd5e1')}`, background: __sbg('#fff'), color: __stc('#334155'), fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={generate} disabled={busy}
                style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: busy ? '#93b4f0' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
                {busy ? 'Generating…' : (meta?.regeneration ? `Generate v${(meta.lastVersion || 0) + 1}` : 'Generate & Download')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
