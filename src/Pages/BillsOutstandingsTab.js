import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Clock, ChevronDown, ChevronUp, RefreshCw, CheckCircle, TrendingDown } from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters';

/* Inline-style theme mappers (dark mode) — no-ops in light mode */
const __isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const __SM = {
  '#fff':'#1b2130','#ffffff':'#1b2130','white':'#1b2130','transparent':'transparent',
  '#f8fafc':'#0f1420','#f9fafb':'#0f1420','#fafbfd':'#161b27','#fafafa':'#0f1420',
  '#f3f4f6':'#232b3b','#f1f5f9':'#232b3b',
  '#dbeafe':'#1d3a5f','#93c5fd':'#2f5d92','#bfdbfe':'#244b7a',
  '#fef3c7':'#3a3016','#fcd34d':'#5a4714','#fde68a':'#5a4714',
  '#ffedd5':'#2c2113','#fed7aa':'#3a2a13','#fb923c':'#7a3d18','#fff7ed':'#2c2113','#fffbeb':'#2a2710',
  '#fee2e2':'#3a1f22','#fca5a5':'#5a2a2e','#fecaca':'#3a1f22','#fff5f5':'#2b1d20','#fff1f2':'#2b1d20','#ef4444':'#7a2a2e',
  '#f0fdf4':'#14301f','#dcfce7':'#14302a','#d1fae5':'#14302a','#86efac':'#2a5a40','#bbf7d0':'#2a5a40','#d1fae5':'#14302a',
  '#eff6ff':'#15243d','#93c5fd':'#2f5d92','#f5f3ff':'#241b3d','#c4b5fd':'#3a3d6a','#e2e8f0':'#2b3445','#e5e7eb':'#2b3445','#d1d5db':'#3a4456','#cbd5e1':'#3a4456',
};
const __TM = {
  '#0f172a':'#e7ecf3','#1e293b':'#d4dbe6','#374151':'#c2cbd8','#475569':'#aab4c2','#334155':'#aab4c2',
  '#64748b':'#94a1b3','#94a3b8':'#9aa7b8',
  '#1e40af':'#7fb0f0','#2563eb':'#5b9bf0','#7c3aed':'#a78bfa','#6d28d9':'#c4b5fd',
  '#92400e':'#f0c07a','#9a3412':'#fb923c','#991b1b':'#f08a8a','#7f1d1d':'#f08a8a','#b45309':'#f0c07a','#78350f':'#f0b080',
  '#d97706':'#f0b454','#15803d':'#46c46f','#166534':'#6ee7b7','#065f46':'#6ee7b7','#059669':'#18c08a',
  '#dc2626':'#f05252','#22c55e':'#34d39e',
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
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`,
});

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Ageing buckets — from vendor POV (AP ageing):
// how long has each bill been outstanding since due date
const BUCKETS = [
  { key: 'not-due',  label: 'Not Yet Due',           color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  { key: '1-30',     label: '1 – 30 Days Overdue',   color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  { key: '31-60',    label: '31 – 60 Days Overdue',  color: '#9a3412', bg: '#ffedd5', border: '#fb923c' },
  { key: '61-90',    label: '61 – 90 Days Overdue',  color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  { key: '90+',      label: 'Over 90 Days Overdue',  color: '#7f1d1d', bg: '#fecaca', border: '#ef4444' },
  { key: 'no-due',   label: 'No Due Date',            color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
];

// Sticky scrollable table wrapper — caps height so page doesn't overflow
function ScrollTable({ children, maxRows = 8 }) {
  const maxH = 38 + maxRows * 38 + 2;
  return (
    <div style={{
      overflowX: 'auto', overflowY: 'auto', maxHeight: maxH,
      scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9',
    }}>
      {children}
    </div>
  );
}

const Th = ({ children, right, color }) => (
  <th style={{
    padding: '8px 12px', textAlign: right ? 'right' : 'left',
    fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px',
    color: color || __stc('#475569'), whiteSpace: 'nowrap',
    position: 'sticky', top: 0, background: 'inherit', zIndex: 2, boxShadow: '0 1px 0 #e2e8f0',
  }}>{children}</th>
);

export default function BillsOutstandingsTab() {
  useThemeVersion();
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();

  const [bills,       setBills]       = useState([]);
  const [advances,    setAdvances]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [expandedBkt, setExpandedBkt] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Unpaid / partially paid bills — status != Paid, != Cancelled
      const billParams = new URLSearchParams({ page: 0, size: 500, sortBy: 'dueDate', sortDirection: 'ASC' });
      if (groupName)    billParams.append('groupId',    groupName);
      if (subGroupName) billParams.append('subGroupId', subGroupName);
      if (projectId)    billParams.append('projectId',  projectId);

      // 2. Unapplied vendor advances (ADVANCE type with remaining balance)
      const advParams = new URLSearchParams({ page: 0, size: 500, paymentType: 'ADVANCE' });
      if (groupName)    advParams.append('groupId',    groupName);
      if (subGroupName) advParams.append('subGroupId', subGroupName);
      if (projectId)    advParams.append('projectId',  projectId);

      const [billRes, advRes] = await Promise.all([
        fetch(`${API_BASE_URL}/bills?${billParams}`,           { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/vendor-advances?${advParams}`,  { credentials: 'include', headers: getAuthHeaders() }),
      ]);

      const billData = billRes.ok ? await billRes.json() : {};
      const advData  = advRes.ok  ? await advRes.json()  : {};

      // Filter: keep only bills that still have a balance to pay
      const outstanding = (billData.bills || billData.content || []).filter(bill => {
        const s = (bill.status || '').toLowerCase();
        if (s === 'paid' || s === 'cancelled') return false;
        const bal = parseFloat(
          bill.balanceAmount ?? (parseFloat(bill.totalAmount || 0) - parseFloat(bill.paidAmount || 0))
        );
        return bal > 0.01;
      });

      // Filter: only advances with unapplied amount
      const unapplied = (advData.content || advData.advances || []).filter(
        a => parseFloat(a.unappliedAmount || 0) > 0.01
      );

      setBills(outstanding);
      setAdvances(unapplied);
      setLastRefresh(new Date());
    } catch {
      setError('Failed to load payables data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [groupName, subGroupName, projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDays = (bill) => {
    if (!bill.dueDate) return null;
    const due = new Date(bill.dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.floor((today - due) / 86400000);
  };

  const getBucket = (d) => {
    if (d === null) return 'no-due';
    if (d <= 0)     return 'not-due';
    if (d <= 30)    return '1-30';
    if (d <= 60)    return '31-60';
    if (d <= 90)    return '61-90';
    return '90+';
  };

  const getBalance = (bill) =>
    parseFloat(bill.balanceAmount ?? (parseFloat(bill.totalAmount || 0) - parseFloat(bill.paidAmount || 0)));

  // Group bills
  const grouped = Object.fromEntries(BUCKETS.map(b => [b.key, []]));
  bills.forEach(bill => {
    const d = getDays(bill);
    grouped[getBucket(d)].push({ ...bill, _days: d });
  });

  // Totals
  const totalPayable    = bills.reduce((s, b) => s + getBalance(b), 0);
  const totalPaid       = bills.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0);
  const totalBilled     = bills.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0);
  const totalUnapplied  = advances.reduce((s, a) => s + parseFloat(a.unappliedAmount || 0), 0);
  const netPayable      = Math.max(0, totalPayable - totalUnapplied);
  const overdueBalance  = bills.filter(b => (getDays(b) ?? 0) > 0).reduce((s, b) => s + getBalance(b), 0);
  const overdueCount    = bills.filter(b => (getDays(b) ?? 0) > 0).length;

  const toggleBucket = (key) => setExpandedBkt(p => ({ ...p, [key]: !p[key] }));

  return (
    <div style={{ padding: 'clamp(14px, 2vw, 24px) clamp(16px, 2.5vw, 28px)', background: __sbg('#f8fafc'), minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(15px, 1.5vw, 20px)', fontWeight: 700, color: __stc('#0f172a'), display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={20} color="#dc2626" />
            Accounts Payable — Outstandings
          </h2>
          <div style={{ fontSize: 11, color: __stc('#64748b'), marginTop: 3 }}>
            Bills you owe to vendors · As of {today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            {lastRefresh && <span style={{ marginLeft: 8 }}>· Refreshed {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
        <button
          onClick={fetchData} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: __sbg('#fff'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: __stc('#374151'), cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={13} style={loading ? { animation: 'bos-spin 1s linear infinite' } : {}} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{ background: __sbg('#fff'), border: `1px solid ${__sbg('#e2e8f0')}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: __stc('#374151'), whiteSpace: 'nowrap' }}>Filter by:</span>
        <GroupProjectFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          projectValue={projectId}
          onChange={updateFilters}
        />
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '20px', textAlign: 'center', color: __stc('#dc2626'), background: __sbg('#fff'), borderRadius: 10, border: `1px solid ${__sbg('#fca5a5')}`, marginBottom: 16 }}>
          <AlertCircle size={24} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>{error}</div>
          <button onClick={fetchData} style={{ marginTop: 10, padding: '7px 18px', background: __sbg('#dc2626'), color: __stc('#fff'), border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Retry</button>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && !error && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: __stc('#64748b') }}>
          <RefreshCw size={26} style={{ animation: 'bos-spin 1s linear infinite', marginBottom: 10 }} />
          <div style={{ fontSize: 13 }}>Loading payables…</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI cards ──────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Payable',         value: fmt(totalPayable),   sub: `${bills.length} bill${bills.length !== 1 ? 's' : ''} unpaid`,          color: __stc('#dc2626'), bg: __sbg('#fff5f5'), border: __sbg('#fca5a5'), icon: '📋' },
              { label: 'Already Paid',           value: fmt(totalPaid),      sub: `of ${fmt(totalBilled)} total billed`,                                   color: __stc('#15803d'), bg: __sbg('#f0fdf4'), border: __sbg('#86efac'), icon: '✅' },
              { label: 'Vendor Advances (Avail)',value: fmt(totalUnapplied), sub: `${advances.length} advance${advances.length !== 1 ? 's' : ''} unused`,  color: __stc('#2563eb'), bg: __sbg('#eff6ff'), border: __sbg('#93c5fd'), icon: '💳' },
              { label: 'Net Payable',            value: fmt(netPayable),     sub: 'After netting advances',                                               color: __stc('#7c3aed'), bg: __sbg('#f5f3ff'), border: __sbg('#c4b5fd'), icon: '⚡' },
              { label: 'Overdue to Vendors',     value: fmt(overdueBalance), sub: `${overdueCount} bill${overdueCount !== 1 ? 's' : ''} past due`,         color: __stc('#991b1b'), bg: __sbg('#fff1f2'), border: __sbg('#fca5a5'), icon: '⚠️' },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontSize: 'clamp(13px, 1.3vw, 17px)', fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: __stc('#374151'), marginTop: 2 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: __stc('#64748b'), marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── AP Ageing Analysis ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 700, color: __stc('#0f172a'), display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} /> AP Ageing Analysis
              <span style={{ fontSize: 11, fontWeight: 400, color: __stc('#94a3b8') }}>Click a bucket to expand</span>
            </h3>

            {/* Summary bar */}
            {bills.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {BUCKETS.map(b => {
                  const rows = grouped[b.key];
                  if (rows.length === 0) return null;
                  const bTot = rows.reduce((s, i) => s + getBalance(i), 0);
                  const pct  = totalPayable > 0 ? (bTot / totalPayable * 100).toFixed(1) : 0;
                  return (
                    <div key={b.key} onClick={() => toggleBucket(b.key)}
                      style={{ flex: '1 1 130px', padding: '9px 12px', background: __sbg(b.bg), border: `1px solid ${__sbg(b.border)}`, borderRadius: 8, cursor: 'pointer', minWidth: 110, maxWidth: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: __stc(b.color), textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.3 }}>{b.label}</div>
                      <div style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 800, color: __stc(b.color), marginTop: 3 }}>{fmt(bTot)}</div>
                      <div style={{ fontSize: 10, color: __stc('#64748b'), marginTop: 2 }}>{rows.length} bill{rows.length !== 1 ? 's' : ''} · {pct}%</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bucket detail tables */}
            {BUCKETS.map(bucket => {
              const rows      = grouped[bucket.key];
              if (rows.length === 0) return null;
              const bucketTot = rows.reduce((s, b) => s + getBalance(b), 0);
              const isOpen    = !!expandedBkt[bucket.key];

              return (
                <div key={bucket.key} style={{ marginBottom: 8, border: `1px solid ${__sbg(bucket.border)}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {/* Header */}
                  <div onClick={() => toggleBucket(bucket.key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: __sbg(bucket.bg), cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: __stc(bucket.color), flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 'clamp(11px, 1.1vw, 13px)', color: __stc(bucket.color), whiteSpace: 'nowrap' }}>{bucket.label}</span>
                      <span style={{ fontSize: 11, color: __stc('#64748b'), background: __sbg('#fff'), borderRadius: 10, padding: '1px 8px', border: `1px solid ${__sbg(bucket.border)}`, whiteSpace: 'nowrap' }}>
                        {rows.length} bill{rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 'clamp(12px, 1.2vw, 14px)', color: __stc(bucket.color) }}>{fmt(bucketTot)}</span>
                      {isOpen ? <ChevronUp size={15} color={__stc(bucket.color)} /> : <ChevronDown size={15} color={__stc(bucket.color)} />}
                    </div>
                  </div>

                  {/* Scrollable table */}
                  {isOpen && (
                    <ScrollTable maxRows={8}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ background: __sbg('#f8fafc') }}>
                          <tr>
                            <Th>Bill No.</Th>
                            <Th>Vendor</Th>
                            <Th>PO Ref</Th>
                            <Th>Bill Date</Th>
                            <Th>Due Date</Th>
                            <Th right>Days</Th>
                            <Th right>Bill Amt</Th>
                            <Th right>Paid</Th>
                            <Th right>Balance</Th>
                            <Th>Status</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((bill, idx) => {
                            const bal  = getBalance(bill);
                            const days = bill._days;
                            return (
                              <tr key={bill.id} style={{ background: idx % 2 === 0 ? __sbg('#fff') : __sbg('#fafbfd'), borderBottom: `1px solid ${__sbg('#f1f5f9')}` }}>
                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: __stc('#2563eb'), fontWeight: 700 }}>
                                    {bill.billNo || bill.billRefId || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '7px 12px', color: __stc('#0f172a'), fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {bill.vendorName || '—'}
                                </td>
                                <td style={{ padding: '7px 12px', color: __stc('#64748b'), fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                                  {bill.poNumber || bill.poRefId || '—'}
                                </td>
                                <td style={{ padding: '7px 12px', color: __stc('#64748b'), whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(bill.billDate)}</td>
                                <td style={{ padding: '7px 12px', color: __stc('#64748b'), whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(bill.dueDate)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {days === null ? <span style={{ color: __stc('#94a3b8') }}>—</span>
                                    : days <= 0   ? <span style={{ color: __stc('#15803d'), fontWeight: 600, fontSize: 11 }}>in {Math.abs(days)}d</span>
                                    : <span style={{ color: __stc(bucket.color), fontWeight: 700, fontSize: 11 }}>{days}d</span>}
                                </td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: __stc('#374151'), whiteSpace: 'nowrap' }}>{fmt(parseFloat(bill.totalAmount) || 0)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: __stc('#15803d'), whiteSpace: 'nowrap' }}>{fmt(parseFloat(bill.paidAmount) || 0)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: __stc(bucket.color), whiteSpace: 'nowrap' }}>{fmt(bal)}</td>
                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                    background: bill.status === 'Paid' ? __sbg('#dcfce7') : bill.status === 'Partially Paid' ? __sbg('#fef3c7') : __sbg('#fee2e2'),
                                    color:      bill.status === 'Paid' ? __stc('#166534') : bill.status === 'Partially Paid' ? __stc('#92400e') : __stc('#991b1b'),
                                  }}>
                                    {bill.status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: __sbg(bucket.bg), position: 'sticky', bottom: 0 }}>
                            <td colSpan={6} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: __stc(bucket.color) }}>
                              Subtotal — {rows.length} bill{rows.length !== 1 ? 's' : ''}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: __stc('#374151') }}>{fmt(rows.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0))}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: __stc('#15803d') }}>{fmt(rows.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0))}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: __stc(bucket.color) }}>{fmt(bucketTot)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </ScrollTable>
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {bills.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', background: __sbg('#fff'), borderRadius: 10, border: `1px solid ${__sbg('#e2e8f0')}` }}>
                <CheckCircle size={32} style={{ color: __stc('#22c55e'), marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: __stc('#0f172a') }}>All bills are fully paid!</div>
                <div style={{ fontSize: 12, color: __stc('#64748b'), marginTop: 4 }}>No outstanding payables for the selected filters.</div>
              </div>
            )}
          </div>

          {/* ── Unapplied Vendor Advances ──────────────────────────────────────── */}
          {advances.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 700, color: __stc('#0f172a'), display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                💳 Unapplied Vendor Advances
                <span style={{ fontSize: 11, fontWeight: 400, color: __stc('#94a3b8') }}>Advances paid to vendors not yet matched to a bill</span>
              </h3>
              <div style={{ background: __sbg('#fff'), border: `1px solid ${__sbg('#93c5fd')}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <ScrollTable maxRows={8}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: __sbg('#eff6ff') }}>
                      <tr>
                        <Th color="#1e40af">Advance No.</Th>
                        <Th color="#1e40af">Vendor</Th>
                        <Th color="#1e40af">Date</Th>
                        <Th color="#1e40af">Method</Th>
                        <Th color="#1e40af">Reference</Th>
                        <Th color="#1e40af" right>Total Paid</Th>
                        <Th color="#1e40af" right>Applied</Th>
                        <Th color="#1e40af" right>Unapplied</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {advances.map((adv, idx) => (
                        <tr key={adv.id} style={{ background: idx % 2 === 0 ? __sbg('#fff') : __sbg('#fafbfd'), borderBottom: `1px solid ${__sbg('#f1f5f9')}` }}>
                          <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11, color: __stc('#2563eb'), fontWeight: 700, whiteSpace: 'nowrap' }}>{adv.advanceNo || '—'}</td>
                          <td style={{ padding: '7px 12px', color: __stc('#0f172a'), fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.vendorName || '—'}</td>
                          <td style={{ padding: '7px 12px', color: __stc('#64748b'), whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(adv.advanceDate)}</td>
                          <td style={{ padding: '7px 12px', color: __stc('#64748b'), whiteSpace: 'nowrap' }}>{adv.paymentMode || '—'}</td>
                          <td style={{ padding: '7px 12px', color: __stc('#64748b'), fontFamily: 'monospace', fontSize: 10, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.transactionReference || '—'}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: __stc('#374151'), whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.amount) || 0)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: __stc('#15803d'), whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.appliedAmount) || 0)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: __stc('#2563eb'), whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.unappliedAmount) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: __sbg('#eff6ff'), position: 'sticky', bottom: 0 }}>
                        <td colSpan={5} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: __stc('#1e40af') }}>
                          Total — {advances.length} advance{advances.length !== 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: __stc('#374151') }}>{fmt(advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0))}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: __stc('#15803d') }}>{fmt(advances.reduce((s, a) => s + (parseFloat(a.appliedAmount) || 0), 0))}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: __stc('#2563eb') }}>{fmt(totalUnapplied)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </ScrollTable>
              </div>

              {/* Net payable summary */}
              <div style={{
                marginTop: 14, padding: '12px 18px',
                background: netPayable <= 0 ? __sbg('#f0fdf4') : __sbg('#fef3c7'),
                border: `1px solid ${netPayable <= 0 ? __sbg('#86efac') : __sbg('#fcd34d')}`,
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: __stc('#374151') }}>
                  <strong>Net Payable Position</strong>
                  <span style={{ color: __stc('#64748b'), marginLeft: 8 }}>
                    {fmt(totalPayable)} payable − {fmt(totalUnapplied)} advances available
                  </span>
                </div>
                <div style={{ fontSize: 'clamp(15px, 1.5vw, 18px)', fontWeight: 800, color: netPayable <= 0 ? __stc('#15803d') : __stc('#92400e') }}>
                  = {fmt(netPayable)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes bos-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}