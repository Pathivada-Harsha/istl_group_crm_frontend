import React, { useState, useEffect } from 'react';
import { COMMON_UNITS } from '../components/Dropdowns/Unittypedropdown.js';

// ─── Dark theme helpers (mirror PurchaseOrders.js convention) ───────────────
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f9fafb':'#0f1420','#f8fafc':'#0f1420','#fafafa':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b','#dbeafe':'#1d3a5f',
  '#e5e7eb':'#2b3445','#e2e8f0':'#2b3445','#cbd5e1':'#3a4456',
};
const __TM = {
  '#0f172a':'#e7ecf3','#111827':'#e7ecf3','#1e293b':'#d4dbe6',
  '#374151':'#c2cbd8','#475569':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#94a3b8':'#9aa7b8',
  '#ef4444':'#f06a6a','#2563eb':'#5b9bf0',
};
const __sbg = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __SM[k]) ? __SM[k] : v; };
const __stc = (v) => { const k = String(v).toLowerCase(); return (__isDarkTheme() && __TM[k]) ? __TM[k] : v; };
const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};

const API_BASE_URL = process.env.REACT_APP_API_URL;

const _MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// Single-date calendar (mirrors PurchaseOrders' PODatePicker; ISO in/out, dd-mm-yyyy display).
const DatePicker = ({ value, onChange, placeholder = 'Select date' }) => {
  useThemeVersion();
  const [show, setShow] = useState(false);
  const [calMo, setCalMo] = useState(() => value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth());
  const [calYr, setCalYr] = useState(() => value ? parseInt(value.slice(0, 4)) : new Date().getFullYear());
  const [showYrP, setShowYrP] = useState(false);
  const wrapRef = React.useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const open = () => {
    if (value) { setCalMo(parseInt(value.slice(5, 7)) - 1); setCalYr(parseInt(value.slice(0, 4))); }
    setShowYrP(false); setShow(true);
  };
  const DIM = new Date(calYr, calMo + 1, 0).getDate();
  const FD = new Date(calYr, calMo, 1).getDay();
  const fmtD = d => { if (!d) return null; const [y, m, dy] = d.split('-'); return `${dy}-${m}-${y}`; };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button type="button" className={`po-dtp-trigger${show ? ' po-dtp--open' : ''}${value ? ' po-dtp--set' : ''}`}
        onClick={show ? () => setShow(false) : open} style={{ width: '100%' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: value ? __stc('#4f46e5') : __stc('#94a3b8') }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {value
          ? <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: __stc('#0f172a') }}>{fmtD(value)}</span>
          : <span className="po-dtp-ph">{placeholder}</span>}
        {value
          ? <span className="po-dtp-x" onClick={e => { e.stopPropagation(); onChange(''); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </span>
          : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 'auto', color: __stc('#94a3b8'), transform: show ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
      </button>
      {show && (
        <div className="po-dtp-dropdown" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 280, zIndex: 100001 }}>
          <div className="po-dtp-cal-head">
            <button type="button" className="po-cal-nav" onClick={() => { if (calMo === 0) { setCalMo(11); setCalYr(y => y - 1); } else setCalMo(m => m - 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" className="po-dtp-month" onClick={() => setShowYrP(p => !p)}>{_MONTHS[calMo]} <span className="po-cal-yr-num">{calYr}</span></button>
            <button type="button" className="po-cal-nav" onClick={() => { if (calMo === 11) { setCalMo(0); setCalYr(y => y + 1); } else setCalMo(m => m + 1); }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {showYrP ? (
            <div className="po-yr-grid">
              {Array.from({ length: 16 }, (_, i) => { const yr = new Date().getFullYear() - 4 + i; return <div key={yr} className={`po-yr-cell${yr === calYr ? ' po-yr-sel' : ''}`} onClick={() => { setCalYr(yr); setShowYrP(false); }}>{yr}</div>; })}
            </div>
          ) : (
            <div className="po-dtp-grid">
              {_DAYS.map(d => <div key={d} className="po-cal-dl">{d}</div>)}
              {Array.from({ length: FD }).map((_, i) => <div key={`e${i}`} className="po-cal-cell po-cal-empty" />)}
              {Array.from({ length: DIM }).map((_, i) => {
                const dy = i + 1;
                const ds = `${calYr}-${String(calMo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
                const isSel = value === ds;
                return <div key={dy} className={`po-cal-cell${isSel ? ' po-cal-sel' : ''}`} onClick={() => { onChange(ds); setShow(false); }}>{dy}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// dd/mm/yyyy <-> yyyy-mm-dd helpers bridging the picker (ISO) and the PDF text (dd/mm/yyyy).
const displayToIso = (disp) => {
  if (!disp) return '';
  const parts = String(disp).split(/[/-]/);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!y || y.length !== 4) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
const isoToDisplay = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

// SESOLA defaults for Bill-To / Ship-To (editable per PO).
const SESOLA_NAME = 'SESOLA POWER PROJECTS PVT. LTD.';
const SESOLA_ADDR = '8TH Floor Pranava Vaishnoi Business Park,\nSy.No.29,30,31,32, &33, kothaguda, serilingampally\nHyderabad-500084, Telangana, India.';
const SESOLA_SHIP_PHONE = '7032223920';

// Editable "from" (SESOLA) defaults.
const SESOLA_GST = 'GST: 36AAYCS6860P1Z2';
const SESOLA_CONTACT = 'Contact person: Mr. G Sudhakar\nEmail ID: sudhakar@sesolaenergy.com\nPhone: +91 9247598798';

const DEFAULT_TERMS = [
  'Price is firm till the 100% supply.',
  'Payment terms: Before dispatching the goods, 100% payment must be completed',
  'Delivery will be done Immediately.',
  'Delivery Terms: Transportation Extra',
  'Insurance: Sesola Power Projects Pvt. Ltd, Scope',
  'Packing Charges: Included',
  'Freight: Extra as per actuals',
  'Invoice should bear our purchase order number or name of our executive who has ordered the goods/services.',
  'Kindly mention Delivery Challan numbers on the invoice wherever you have delivered goods through a DC. DC should bear our Purchase Order Number.',
  'Test certificate should be provided with batch numbers before dispatches.',
  'The description of goods/services on the invoice should be similar to the description in the PO. Also kindly mention the serial number of goods/services as per PO on the invoice.',
  'Please ensure to supply the material during working hours, i.e., between 9:00 AM to 4:00 PM. In case of critical supplies, if there is any deviation from the same, please keep the concerned person informed about the delivery of material.',
  'Please send us an order acknowledgement confirming acceptance. Delivery of goods and/or services will be deemed as confirmation of acceptance of the terms and conditions of the purchase order.',
  'Subject to Hyderabad Jurisdiction.',
];

const blankItem = () => ({ description: '', unit: 'Nos', qty: '', pricePerUnit: '' });
const blankAdj = () => ({ label: '', amount: '' });

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Self-contained modal that collects PO-document data (prefilled from the PO + vendor,
 * fully editable), then calls POST /purchase-orders/{id}/generate-document.
 * On success the PDF is stored on the PO and served by the existing view/download routes.
 */
export default function GeneratePoModal({ open, po, vendor, authHeaders, onClose, onGenerated, showSuccess, showError }) {
  useThemeVersion();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stamps, setStamps] = useState(['sesola_stamp.png']);
  const [newStampName, setNewStampName] = useState('');
  const [pendingStampFile, setPendingStampFile] = useState(null); // chosen but not yet uploaded

  useEffect(() => {
    if (!open || !po) return;
    // If this PO was generated before, prefill exactly from the saved payload.
    if (po.poDocPayload) {
      try {
        const saved = typeof po.poDocPayload === 'string' ? JSON.parse(po.poDocPayload) : po.poDocPayload;
        // Always take line items from the CURRENT PO (reflects any add/edit since last time).
        // Fall back to the saved snapshot only if the PO has no items loaded.
        const liveItems = (po.items && po.items.length)
          ? po.items.filter(it => (it.itemName || it.description)).map(it => {
              const label = it.itemName ? (it.itemName + (it.itemDescription ? ' - ' + it.itemDescription : (it.description ? ' - ' + it.description : ''))) : (it.description || '');
              // Prefer the item's own unit; else reuse a saved unit for the same description.
              const savedMatch = (saved.items || []).find(s => (s.description || '') === label);
              return {
                description: label,
                unit: it.unit || (savedMatch ? savedMatch.unit : '') || 'Nos',
                qty: it.quantity ?? it.qty ?? '',
                pricePerUnit: it.unitPrice ?? it.pricePerUnit ?? '',
              };
            })
          : (saved.items && saved.items.length ? saved.items.map(it => ({
              description: it.description || '', unit: it.unit || 'Nos', qty: it.qty ?? '', pricePerUnit: it.pricePerUnit ?? '',
            })) : [blankItem()]);
        setForm({
          poNo: saved.poNo || po.poNo || '',
          poDate: saved.poDate || '', quoteRef: saved.quoteRef || 'NA', quoteRefDate: saved.quoteRefDate || '',
          vendorName: saved.vendorName || '', vendorAddress: saved.vendorAddress || '',
          supplierGst: saved.supplierGst || '', kindAttention: saved.kindAttention || '',
          vendorPhone: saved.vendorPhone || '', vendorEmail: saved.vendorEmail || '',
          billToName: saved.billToName || SESOLA_NAME, billToAddress: saved.billToAddress || SESOLA_ADDR,
          shipToName: saved.shipToName || SESOLA_NAME, shipToAddress: saved.shipToAddress || SESOLA_ADDR,
          shipToPhone: saved.shipToPhone || SESOLA_SHIP_PHONE,
          items: liveItems,
          gstPercent: saved.gstPercent ?? 18,
          adjustments: (saved.adjustments || []).map(a => ({ label: a.label || '', amount: a.amount ?? '' })),
          bankAccountName: saved.bankAccountName || '', bankName: saved.bankName || '', bankBranch: saved.bankBranch || '',
          bankAccountNo: saved.bankAccountNo || '', bankIfsc: saved.bankIfsc || '',
          signatoryName: saved.signatoryName || 'G Sudhakar', signatoryTitle: saved.signatoryTitle || 'Manager-Procurement',
          signatoryPhone: saved.signatoryPhone || '+91-9247598798',
          companyName: saved.companyName || SESOLA_NAME, companyAddress: saved.companyAddress || SESOLA_ADDR,
          companyGst: saved.companyGst || SESOLA_GST, companyContact: saved.companyContact || SESOLA_CONTACT,
          terms: (saved.terms && saved.terms.length) ? saved.terms.slice() : DEFAULT_TERMS.slice(),
          stampFileName: saved.stampFileName || 'sesola_stamp.png',
        });
        return;
      } catch { /* fall through to fresh prefill */ }
    }
    // First-time: prefill from the PO and (if available) the selected vendor.
    const vAddr = vendor
      ? [vendor.address, [vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(' ')].filter(Boolean).join('\n')
      : '';
    const items = (po.items && po.items.length ? po.items : [])
      .filter(it => (it.itemName || it.description))
      .map((it, i) => ({
        description: it.itemName ? (it.itemName + (it.itemDescription ? ' - ' + it.itemDescription : '')) : (it.description || ''),
        unit: it.unit || 'Nos',
        qty: it.quantity ?? it.qty ?? '',
        pricePerUnit: it.unitPrice ?? it.pricePerUnit ?? '',
      }));
    setForm({
      poNo: po.poNo || '',
      poDate: po.orderDate ? String(po.orderDate).split('T')[0].split('-').reverse().join('/') : '',
      quoteRef: po.poRefId || 'NA',
      quoteRefDate: '',
      vendorName: po.vendorName || vendor?.name || '',
      vendorAddress: vAddr,
      supplierGst: vendor?.gstNumber || '',
      kindAttention: (po.vendorName || vendor?.name || '').toUpperCase(),
      vendorPhone: vendor?.phone || po.vendorContact || '',
      vendorEmail: vendor?.email || '',
      billToName: SESOLA_NAME, billToAddress: SESOLA_ADDR,
      shipToName: SESOLA_NAME, shipToAddress: SESOLA_ADDR, shipToPhone: SESOLA_SHIP_PHONE,
      items: items.length ? items : [blankItem()],
      gstPercent: 18,
      adjustments: [],
      bankAccountName: vendor?.name || '', bankName: '', bankBranch: '', bankAccountNo: '', bankIfsc: '',
      signatoryName: 'G Sudhakar', signatoryTitle: 'Manager-Procurement', signatoryPhone: '+91-9247598798',
      companyName: SESOLA_NAME, companyAddress: SESOLA_ADDR, companyGst: SESOLA_GST, companyContact: SESOLA_CONTACT,
      terms: DEFAULT_TERMS.slice(),
      stampFileName: 'sesola_stamp.png',
    });
  }, [open, po, vendor]);

  // Load available stamps whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/purchase-orders/stamps`, { credentials: 'include', headers: authHeaders });
        if (r.ok) { const d = await r.json(); if (Array.isArray(d.stamps) && d.stamps.length) setStamps(d.stamps); }
      } catch { /* keep default */ }
    })();
  }, [open]);

  if (!open || !form) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, blankItem()] }));
  const rmItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const setAdj = (i, k, v) => setForm(f => ({ ...f, adjustments: f.adjustments.map((a, idx) => idx === i ? { ...a, [k]: v } : a) }));
  const addAdj = () => setForm(f => ({ ...f, adjustments: [...f.adjustments, blankAdj()] }));
  const rmAdj = (i) => setForm(f => ({ ...f, adjustments: f.adjustments.filter((_, idx) => idx !== i) }));

  const setTerm = (i, v) => setForm(f => ({ ...f, terms: f.terms.map((t, idx) => idx === i ? v : t) }));
  const addTerm = () => setForm(f => ({ ...f, terms: [...f.terms, ''] }));
  const rmTerm = (i) => setForm(f => ({ ...f, terms: f.terms.filter((_, idx) => idx !== i) }));
  const resetTerms = () => setForm(f => ({ ...f, terms: DEFAULT_TERMS.slice() }));

  // Upload the pending stamp (called at Generate time). Returns the stored file name.
  // Throws on failure so the caller can stop before generating.
  const uploadPendingStamp = async () => {
    const name = (newStampName || '').trim();
    const fd = new FormData();
    fd.append('file', pendingStampFile);
    fd.append('name', name);
    const r = await fetch(`${API_BASE_URL}/purchase-orders/stamps/upload`, {
      method: 'POST', credentials: 'include', headers: authHeaders, body: fd,
    });
    let d = {};
    try { d = await r.json(); } catch { /* non-JSON */ }
    if (!r.ok || !d.stampFileName) throw new Error(d.error || 'Stamp upload failed');
    return d.stampFileName;
  };

  const subtotal = form.items.reduce((s, it) => s + num(it.qty) * num(it.pricePerUnit), 0);
  const gstAmount = subtotal * num(form.gstPercent) / 100;
  const adjTotal = form.adjustments.reduce((s, a) => s + num(a.amount), 0);
  const grandTotal = subtotal + gstAmount + adjTotal;

  const generate = async () => {
    if (!form.vendorName.trim()) { showError('Vendor name is required'); return; }
    if (!form.items.some(it => (it.description || '').trim())) { showError('At least one line item is required'); return; }
    // A newly chosen stamp requires a name and is uploaded first; if it fails, stop.
    if (pendingStampFile && !(newStampName || '').trim()) { showError('Please enter a name for the new stamp'); return; }
    setBusy(true);
    try {
      let stampToUse = form.stampFileName || 'sesola_stamp.png';
      if (pendingStampFile) {
        try {
          stampToUse = await uploadPendingStamp();
          setStamps(prev => prev.includes(stampToUse) ? prev : [...prev, stampToUse]);
          set('stampFileName', stampToUse);
          setPendingStampFile(null);
          setNewStampName('');
        } catch (se) {
          setBusy(false);
          showError(se.message || 'Stamp upload failed — PO not generated');
          return;
        }
      }
      const payload = {
        docTitle: po?.documentType === 'WORK_ORDER' ? 'WORK ORDER' : 'PURCHASE ORDER',
        poNo: form.poNo, poDate: form.poDate, quoteRef: form.quoteRef, quoteRefDate: form.quoteRefDate,
        vendorName: form.vendorName, vendorAddress: form.vendorAddress, supplierGst: form.supplierGst,
        kindAttention: form.kindAttention, vendorPhone: form.vendorPhone, vendorEmail: form.vendorEmail,
        billToName: form.billToName, billToAddress: form.billToAddress,
        shipToName: form.shipToName, shipToAddress: form.shipToAddress, shipToPhone: form.shipToPhone,
        items: form.items.filter(it => (it.description || '').trim()).map((it, i) => ({
          sNo: i + 1, description: it.description, unit: it.unit || 'Nos',
          qty: num(it.qty), pricePerUnit: num(it.pricePerUnit), amount: num(it.qty) * num(it.pricePerUnit),
        })),
        gstPercent: num(form.gstPercent), gstAmount, totalAmount: grandTotal,
        adjustments: form.adjustments.filter(a => (a.label || '').trim() || a.amount).map(a => ({ label: a.label, amount: num(a.amount) })),
        bankAccountName: form.bankAccountName, bankName: form.bankName, bankBranch: form.bankBranch,
        bankAccountNo: form.bankAccountNo, bankIfsc: form.bankIfsc,
        signatoryName: form.signatoryName, signatoryTitle: form.signatoryTitle, signatoryPhone: form.signatoryPhone,
        companyName: form.companyName, companyAddress: form.companyAddress,
        companyGst: form.companyGst, companyContact: form.companyContact,
        terms: (form.terms || []).map(t => (t || '').trim()).filter(Boolean),
        stampFileName: stampToUse,
      };
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${po.id}/generate-document`, {
        method: 'POST', credentials: 'include',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('PO document generated.');
        onGenerated && onGenerated(po.id);
        onClose();
      } else {
        showError(data.error || 'Failed to generate PO document');
      }
    } catch { showError('Failed to generate PO document'); }
    finally { setBusy(false); }
  };

  const L = { display: 'block', fontSize: 12, fontWeight: 600, color: __stc('#475569'), marginBottom: 3 };
  const I = { width: '100%', padding: '7px 9px', border: `1px solid ${__sbg('#cbd5e1')}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: __sbg('#fff'), color: __stc('#0f172a') };
  const TA = { ...I, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' };
  const card = { background: __sbg('#fff'), borderRadius: 8, border: `1px solid ${__sbg('#e2e8f0')}`, padding: 14, marginBottom: 12 };
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: __sbg('#f8fafc'), borderRadius: 12, width: 'min(880px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ position: 'sticky', top: 0, background: '#2563eb', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <strong style={{ fontSize: 15 }}>{po.poDocPayload ? 'Re-generate' : 'Generate'} Purchase Order — {form.poNo || po.poNo}</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          {/* Company ("From") + signatory — editable, first to match PDF order */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: __stc('#0f172a') }}>Company / From (SESOLA side)</div>
            <div style={grid2}>
              <div><label style={L}>Company Name</label><input style={I} value={form.companyName} onChange={e => set('companyName', e.target.value)} /></div>
              <div><label style={L}>Company GST</label><input style={I} value={form.companyGst} onChange={e => set('companyGst', e.target.value)} /></div>
            </div>
            <div style={{ ...grid2, marginTop: 10 }}>
              <div><label style={L}>Company Address</label><textarea style={TA} value={form.companyAddress} onChange={e => set('companyAddress', e.target.value)} /></div>
              <div><label style={L}>Contact Block (person / email / phone)</label><textarea style={TA} value={form.companyContact} onChange={e => set('companyContact', e.target.value)} /></div>
            </div>
            <div style={{ ...grid2, marginTop: 10 }}>
              <div><label style={L}>Signatory Name</label><input style={I} value={form.signatoryName} onChange={e => set('signatoryName', e.target.value)} /></div>
              <div><label style={L}>Signatory Title</label><input style={I} value={form.signatoryTitle} onChange={e => set('signatoryTitle', e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 10 }}><label style={L}>Signatory Phone</label><input style={I} value={form.signatoryPhone} onChange={e => set('signatoryPhone', e.target.value)} /></div>
          </div>

          {/* PO meta */}
          <div style={card}>
            <div style={grid2}>
              <div><label style={L}>PO No</label><input style={I} value={form.poNo} onChange={e => set('poNo', e.target.value)} /></div>
              <div><label style={L}>PO Date</label><DatePicker value={displayToIso(form.poDate)} onChange={iso => set('poDate', isoToDisplay(iso))} placeholder="Select date" /></div>
              <div><label style={L}>Quote Ref</label><input style={I} value={form.quoteRef} onChange={e => set('quoteRef', e.target.value)} /></div>
              <div><label style={L}>Quote Ref Date</label><DatePicker value={displayToIso(form.quoteRefDate)} onChange={iso => set('quoteRefDate', isoToDisplay(iso))} placeholder="Select date" /></div>
            </div>
          </div>

          {/* Vendor (To) */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: __stc('#0f172a') }}>Vendor (To)</div>
            <div style={grid2}>
              <div><label style={L}>Vendor Name</label><input style={I} value={form.vendorName} onChange={e => set('vendorName', e.target.value)} /></div>
              <div><label style={L}>Supplier GST</label><input style={I} value={form.supplierGst} onChange={e => set('supplierGst', e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 10 }}><label style={L}>Vendor Address</label><textarea style={TA} value={form.vendorAddress} onChange={e => set('vendorAddress', e.target.value)} /></div>
            <div style={{ ...grid2, marginTop: 10 }}>
              <div><label style={L}>Kind Attention</label><input style={I} value={form.kindAttention} onChange={e => set('kindAttention', e.target.value)} /></div>
              <div><label style={L}>Phone</label><input style={I} value={form.vendorPhone} onChange={e => set('vendorPhone', e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 10 }}><label style={L}>Email</label><input style={I} value={form.vendorEmail} onChange={e => set('vendorEmail', e.target.value)} /></div>
          </div>

          {/* Bill To / Ship To */}
          <div style={card}>
            <div style={grid2}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, color: __stc('#0f172a') }}>Bill To</div>
                <input style={I} value={form.billToName} onChange={e => set('billToName', e.target.value)} />
                <textarea style={{ ...TA, marginTop: 8 }} value={form.billToAddress} onChange={e => set('billToAddress', e.target.value)} />
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, color: __stc('#0f172a') }}>Ship To</div>
                <input style={I} value={form.shipToName} onChange={e => set('shipToName', e.target.value)} />
                <textarea style={{ ...TA, marginTop: 8 }} value={form.shipToAddress} onChange={e => set('shipToAddress', e.target.value)} />
                <input style={{ ...I, marginTop: 8 }} value={form.shipToPhone} onChange={e => set('shipToPhone', e.target.value)} placeholder="Ship-to phone" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: __stc('#0f172a') }}>Line Items</div>
              <button onClick={addItem} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>+ Add item</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: __stc('#64748b') }}>
                  <th style={{ padding: 4, width: 30 }}>#</th><th style={{ padding: 4 }}>Item &amp; Description</th>
                  <th style={{ padding: 4, width: 70 }}>Qty</th><th style={{ padding: 4, width: 90 }}>Unit</th>
                  <th style={{ padding: 4, width: 100 }}>Price/Unit</th><th style={{ padding: 4, width: 100 }}>Amount</th><th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: 4, color: __stc('#94a3b8') }}>{i + 1}</td>
                    <td style={{ padding: 4 }}><input style={{ ...I, padding: '5px 7px' }} value={it.description} onChange={e => setItem(i, 'description', e.target.value)} /></td>
                    <td style={{ padding: 4 }}><input style={{ ...I, padding: '5px 7px' }} type="number" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} /></td>
                    <td style={{ padding: 4 }}>
                      <select
                        style={{ ...I, padding: '5px 7px' }}
                        value={it.unit === '' || it.unit == null || COMMON_UNITS.includes(it.unit) ? (it.unit || '') : 'Custom'}
                        onChange={e => setItem(i, 'unit', e.target.value === 'Custom' ? '' : e.target.value)}
                      >
                        <option value="">Unit</option>
                        {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        <option value="Custom">✏️ Custom</option>
                      </select>
                      {(it.unit !== '' && it.unit != null && !COMMON_UNITS.includes(it.unit)) && (
                        <input
                          style={{ ...I, padding: '5px 7px', marginTop: 3 }}
                          placeholder="Enter unit"
                          value={it.unit}
                          onChange={e => setItem(i, 'unit', e.target.value)}
                        />
                      )}
                    </td>
                    <td style={{ padding: 4 }}><input style={{ ...I, padding: '5px 7px' }} type="number" value={it.pricePerUnit} onChange={e => setItem(i, 'pricePerUnit', e.target.value)} /></td>
                    <td style={{ padding: 4, textAlign: 'right', fontWeight: 600 }}>{(num(it.qty) * num(it.pricePerUnit)).toLocaleString('en-IN')}</td>
                    <td style={{ padding: 4 }}><button onClick={() => rmItem(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...grid2, marginTop: 12, alignItems: 'end' }}>
              <div><label style={L}>GST %</label><input style={I} type="number" value={form.gstPercent} onChange={e => set('gstPercent', e.target.value)} /></div>
              <div style={{ textAlign: 'right', fontSize: 13, color: __stc('#334155') }}>
                <div>Subtotal: <strong>{subtotal.toLocaleString('en-IN')}</strong></div>
                <div>GST: <strong>{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></div>
                <div style={{ fontSize: 15, marginTop: 4 }}>Total: <strong>{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></div>
              </div>
            </div>
          </div>

          {/* Adjustment lines */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: __stc('#0f172a') }}>Adjustment Lines <span style={{ fontWeight: 400, color: __stc('#94a3b8'), fontSize: 12 }}>(optional, e.g. "DC Cable difference amount", "Amount to be paid")</span></div>
              <button onClick={addAdj} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>+ Add line</button>
            </div>
            {form.adjustments.length === 0 ? <div style={{ color: __stc('#94a3b8'), fontSize: 12 }}>No adjustment lines.</div> : form.adjustments.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input style={{ ...I, flex: 1 }} placeholder="Label" value={a.label} onChange={e => setAdj(i, 'label', e.target.value)} />
                <input style={{ ...I, width: 140 }} type="number" placeholder="Amount" value={a.amount} onChange={e => setAdj(i, 'amount', e.target.value)} />
                <button onClick={() => rmAdj(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>

          {/* Vendor bank */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: __stc('#0f172a') }}>Vendor Bank Details</div>
            <div style={grid2}>
              <div><label style={L}>Account Name</label><input style={I} value={form.bankAccountName} onChange={e => set('bankAccountName', e.target.value)} /></div>
              <div><label style={L}>Bank</label><input style={I} value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
              <div><label style={L}>Branch</label><input style={I} value={form.bankBranch} onChange={e => set('bankBranch', e.target.value)} /></div>
              <div><label style={L}>A/c No</label><input style={I} value={form.bankAccountNo} onChange={e => set('bankAccountNo', e.target.value)} /></div>
              <div><label style={L}>IFSC</label><input style={I} value={form.bankIfsc} onChange={e => set('bankIfsc', e.target.value)} /></div>
            </div>
          </div>

          {/* Stamp picker + upload */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: __stc('#0f172a') }}>Stamp</div>
            <div style={grid2}>
              <div>
                <label style={L}>Select stamp</label>
                <select style={I} value={form.stampFileName} onChange={e => set('stampFileName', e.target.value)}>
                  {stamps.map(s => <option key={s} value={s}>{s === 'sesola_stamp.png' ? 'SESOLA (default)' : s}</option>)}
                </select>
              </div>
              <div>
                <label style={L}>Upload new stamp {pendingStampFile ? <span style={{ color: __stc('#ef4444') }}>(name required)</span> : ''}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...I, flex: 1, borderColor: (pendingStampFile && !(newStampName || '').trim()) ? __stc('#ef4444') : __sbg('#cbd5e1') }}
                    placeholder="Name (required for new stamp)" value={newStampName} onChange={e => setNewStampName(e.target.value)} />
                  <label style={{ padding: '7px 10px', border: `1px solid ${__stc('#2563eb')}`, color: __stc('#2563eb'), borderRadius: 6, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {pendingStampFile ? 'Change' : 'Choose'}
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) setPendingStampFile(f); }} />
                  </label>
                </div>
                {pendingStampFile
                  ? <div style={{ fontSize: 11, color: __stc('#2563eb'), marginTop: 4 }}>Selected: {pendingStampFile.name} — will be saved and applied when you click {po.poDocPayload ? 'Re-generate' : 'Generate'}.
                      <button onClick={() => setPendingStampFile(null)} style={{ marginLeft: 6, background: 'none', border: 'none', color: __stc('#ef4444'), cursor: 'pointer', fontSize: 11 }}>clear</button></div>
                  : <div style={{ fontSize: 11, color: __stc('#94a3b8'), marginTop: 4 }}>Enter a name and choose an image. PNG with transparent background works best.</div>}
              </div>
            </div>
          </div>

          {/* Terms & Conditions editor */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: __stc('#0f172a') }}>Terms &amp; Conditions</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetTerms} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: __stc('#475569') }}>Reset to default</button>
                <button onClick={addTerm} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>+ Add term</button>
              </div>
            </div>
            {(form.terms || []).map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, color: __stc('#94a3b8'), paddingTop: 8, width: 20, textAlign: 'right' }}>{i + 1}.</span>
                <textarea style={{ ...I, flex: 1, minHeight: 34, resize: 'vertical', fontFamily: 'inherit' }} value={t} onChange={e => setTerm(i, e.target.value)} />
                <button onClick={() => rmTerm(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, paddingTop: 4 }}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: __sbg('#fff'), borderTop: `1px solid ${__sbg('#e2e8f0')}`, padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: `1px solid ${__sbg('#cbd5e1')}`, background: __sbg('#fff'), color: __stc('#0f172a'), borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
          <button onClick={generate} disabled={busy} style={{ padding: '8px 18px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Generating…' : (po.poDocPayload ? 'Re-generate PO PDF' : 'Generate PO PDF')}
          </button>
        </div>
      </div>
    </div>
  );
}