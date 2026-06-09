import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Clock, ChevronDown, ChevronUp, RefreshCw, CheckCircle, TrendingDown, Download } from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters';
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = process.env.REACT_APP_API_URL;

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

const Th = ({ children, right, color, bg = '#f8fafc' }) => (
  <th style={{
    padding: '8px 12px', textAlign: right ? 'right' : 'left',
    fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px',
    color: color || '#475569', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, background: bg, zIndex: 2, boxShadow: '0 1px 0 #e2e8f0',
  }}>{children}</th>
);

export default function BillsOutstandingsTab() {
  const { user } = useAuth();
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id':   user?.id   || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'User-Id':     user?.id   || localStorage.getItem('userId'),
    'User-Role':   user?.role || localStorage.getItem('userRole'),
  });

  const [bills,       setBills]       = useState([]);
  const [allBills,    setAllBills]    = useState([]);
  const [advances,    setAdvances]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [expandedBkt, setExpandedBkt] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting,   setExporting]   = useState(false);

  // ── Excel export ────────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (bills.length === 0 && advances.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const fmtN  = (n) => parseFloat(n || 0);
      const fmtD  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

      const calcDays = (bill) => {
        if (!bill.dueDate) return null;
        const due = new Date(bill.dueDate); due.setHours(0,0,0,0);
        const now = new Date();             now.setHours(0,0,0,0);
        return Math.floor((now - due) / 86400000);
      };
      const getBucket = (d) => {
        if (d === null) return 'No Due Date';
        if (d <= 0)     return 'Not Yet Due';
        if (d <= 30)    return '1 – 30 Days Overdue';
        if (d <= 60)    return '31 – 60 Days Overdue';
        if (d <= 90)    return '61 – 90 Days Overdue';
        return 'Over 90 Days Overdue';
      };
      const getBalanceN = (bill) => fmtN(bill.balanceAmount ?? (fmtN(bill.totalAmount) - fmtN(bill.paidAmount)));

      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Summary ───────────────────────────────────────────────────
      const totalPayable   = bills.reduce((s, b) => s + getBalanceN(b), 0);
      const totalPaid      = allBills.reduce((s, b) => s + fmtN(b.paidAmount), 0);
      const totalBilled    = allBills.reduce((s, b) => s + fmtN(b.totalAmount), 0);
      const totalUnapplied = advances.reduce((s, a) => s + fmtN(a.unappliedAmount), 0);
      const netPayable     = Math.max(0, totalPayable - totalUnapplied);
      const overdueBalance = bills.filter(b => (calcDays(b) ?? 0) > 0).reduce((s, b) => s + getBalanceN(b), 0);
      const overdueCount   = bills.filter(b => (calcDays(b) ?? 0) > 0).length;

      const summaryData = [
        ['AP Outstandings — Summary'],
        [`As of ${today}`],
        [],
        ['Metric', 'Value'],
        ['Total Payable (₹)',           totalPayable],
        ['Already Paid (₹)',            totalPaid],
        ['Total Billed (₹)',            totalBilled],
        ['Vendor Advances Available (₹)', totalUnapplied],
        ['Net Payable (₹)',             netPayable],
        ['Overdue to Vendors (₹)',      overdueBalance],
        ['Overdue Bill Count',          overdueCount],
        ['Total Outstanding Bills',     bills.length],
        ['Total Vendor Advances',       advances.length],
        [],
        ['Ageing Breakdown', 'Amount (₹)', 'Count', '% of Total'],
      ];
      const buckets = ['Not Yet Due','1 – 30 Days Overdue','31 – 60 Days Overdue','61 – 90 Days Overdue','Over 90 Days Overdue','No Due Date'];
      buckets.forEach(label => {
        const rows = bills.filter(b => getBucket(calcDays(b)) === label);
        const amt  = rows.reduce((s, b) => s + getBalanceN(b), 0);
        if (rows.length > 0) summaryData.push([label, amt, rows.length, totalPayable > 0 ? (amt / totalPayable * 100).toFixed(1) + '%' : '0%']);
      });
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // ── Sheet 2: Outstanding Bills ─────────────────────────────────────────
      const billHeaders = ['Bill No.', 'Vendor', 'PO Reference', 'Bill Date', 'Due Date', 'Days Overdue', 'Ageing Bucket', 'Status', 'Bill Amount (₹)', 'Paid (₹)', 'Balance (₹)'];
      const billRows = bills.map(bill => {
        const days = calcDays(bill);
        return [
          bill.billNo   || bill.billRefId || '',
          bill.vendorName || '',
          bill.poNumber || bill.poRefId  || '',
          fmtD(bill.billDate),
          fmtD(bill.dueDate),
          days === null ? '' : days <= 0 ? `In ${Math.abs(days)}d` : `${days}d`,
          getBucket(days),
          bill.status || 'Pending',
          fmtN(bill.totalAmount),
          fmtN(bill.paidAmount),
          getBalanceN(bill),
        ];
      });
      const wsOutstanding = XLSX.utils.aoa_to_sheet([billHeaders, ...billRows]);
      wsOutstanding['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsOutstanding, 'Outstanding Bills');

      // ── Sheet 3: Ageing Detail (per bucket) ───────────────────────────────
      buckets.forEach(label => {
        const rows = bills.filter(b => getBucket(calcDays(b)) === label);
        if (rows.length === 0) return;
        const sheetName = label.length > 31 ? label.slice(0, 31) : label;
        const headers = ['Bill No.', 'Vendor', 'PO Ref', 'Bill Date', 'Due Date', 'Days', 'Status', 'Bill Amount (₹)', 'Paid (₹)', 'Balance (₹)'];
        const dataRows = rows.map(bill => {
          const days = calcDays(bill);
          return [
            bill.billNo || bill.billRefId || '',
            bill.vendorName || '',
            bill.poNumber || bill.poRefId || '',
            fmtD(bill.billDate),
            fmtD(bill.dueDate),
            days === null ? '' : days <= 0 ? `In ${Math.abs(days)}d` : `${days}d`,
            bill.status || 'Pending',
            fmtN(bill.totalAmount),
            fmtN(bill.paidAmount),
            getBalanceN(bill),
          ];
        });
        const subtotal = rows.reduce((s, b) => s + getBalanceN(b), 0);
        const ws = XLSX.utils.aoa_to_sheet([
          headers,
          ...dataRows,
          [],
          ['', '', '', '', '', 'Subtotal', '', rows.reduce((s,b) => s + fmtN(b.totalAmount), 0), rows.reduce((s,b) => s + fmtN(b.paidAmount), 0), subtotal],
        ]);
        ws['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // ── Sheet 4: All Bills (paid + outstanding) ────────────────────────────
      if (allBills.length > 0) {
        const allHeaders = ['Bill No.', 'Vendor', 'PO Reference', 'Bill Date', 'Due Date', 'Status', 'Bill Amount (₹)', 'Paid (₹)', 'Balance (₹)'];
        const allRows = allBills.map(bill => [
          bill.billNo || bill.billRefId || '',
          bill.vendorName || '',
          bill.poNumber || bill.poRefId || '',
          fmtD(bill.billDate),
          fmtD(bill.dueDate),
          bill.status || '',
          fmtN(bill.totalAmount),
          fmtN(bill.paidAmount),
          fmtN(bill.balanceAmount ?? (fmtN(bill.totalAmount) - fmtN(bill.paidAmount))),
        ]);
        const wsAll = XLSX.utils.aoa_to_sheet([allHeaders, ...allRows]);
        wsAll['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, wsAll, 'All Bills');
      }

      // ── Sheet 5: Vendor Advances ───────────────────────────────────────────
      if (advances.length > 0) {
        const advHeaders = ['Advance No.', 'Vendor', 'Date', 'Payment Method', 'Reference', 'Total Amount (₹)', 'Applied (₹)', 'Unapplied (₹)'];
        const advRows = advances.map(a => [
          a.advanceNo            || '',
          a.vendorName           || '',
          fmtD(a.advanceDate),
          a.paymentMode          || '',
          a.transactionReference || '',
          fmtN(a.amount),
          fmtN(a.appliedAmount),
          fmtN(a.unappliedAmount),
        ]);
        const wsAdv = XLSX.utils.aoa_to_sheet([
          advHeaders,
          ...advRows,
          [],
          ['', '', '', '', 'Total Unapplied', advances.reduce((s,a) => s + fmtN(a.amount), 0), advances.reduce((s,a) => s + fmtN(a.appliedAmount), 0), totalUnapplied],
        ]);
        wsAdv['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsAdv, 'Vendor Advances');
      }

      const fileName = `AP_Outstandings_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ── 1. Outstanding bills via dedicated endpoint (no pagination, stable sort) ──
      const billParams = new URLSearchParams();
      if (groupName)    billParams.append('groupId',    groupName);
      if (subGroupName) billParams.append('subGroupId', subGroupName);
      if (projectId)    billParams.append('projectId',  projectId);

      // ── 2. Unapplied vendor advances ──────────────────────────────────────
      const advParams = new URLSearchParams({ page: 0, size: 500, paymentType: 'ADVANCE' });
      if (groupName)    advParams.append('groupId',    groupName);
      if (subGroupName) advParams.append('subGroupId', subGroupName);
      if (projectId)    advParams.append('projectId',  projectId);

      const [billRes, advRes] = await Promise.all([
        fetch(`${API_BASE_URL}/bills/outstandings?${billParams}`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/vendor-advances?${advParams}`,     { credentials: 'include', headers: getAuthHeaders() }),
      ]);

      const billData = billRes.ok ? await billRes.json() : {};
      const advData  = advRes.ok  ? await advRes.json()  : {};

      // Backend already computed the split — use directly
      setBills(billData.outstanding || []);
      setAllBills(billData.allBills  || []);
      setAdvances((advData.advances || []).filter(a => parseFloat(a.unappliedAmount || 0) > 0.01));
      setLastRefresh(new Date());
    } catch {
      setError('Failed to load payables data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [groupName, subGroupName, projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const totalPaid       = allBills.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0);
  const totalBilled     = allBills.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0);
  const totalUnapplied  = advances.reduce((s, a) => s + parseFloat(a.unappliedAmount || 0), 0);
  const netPayable      = Math.max(0, totalPayable - totalUnapplied);
  const overdueBalance  = bills.filter(b => (getDays(b) ?? 0) > 0).reduce((s, b) => s + getBalance(b), 0);
  const overdueCount    = bills.filter(b => (getDays(b) ?? 0) > 0).length;

  const toggleBucket = (key) => setExpandedBkt(p => ({ ...p, [key]: !p[key] }));

  return (
    <div style={{ padding: 'clamp(14px, 2vw, 24px) clamp(16px, 2.5vw, 28px)', background: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(15px, 1.5vw, 20px)', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={20} color="#dc2626" />
            Accounts Payable — Outstandings
          </h2>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
            Bills you owe to vendors · As of {today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            {lastRefresh && <span style={{ marginLeft: 8 }}>· Refreshed {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={exportToExcel} disabled={exporting || loading || (bills.length === 0 && advances.length === 0)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#16a34a', border: '1px solid #15803d', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: (exporting || loading || (bills.length === 0 && advances.length === 0)) ? 'not-allowed' : 'pointer', opacity: (exporting || loading || (bills.length === 0 && advances.length === 0)) ? 0.55 : 1, whiteSpace: 'nowrap' }}
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            onClick={fetchData} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#374151', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={13} style={loading ? { animation: 'bos-spin 1s linear infinite' } : {}} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Filter by:</span>
        <GroupProjectFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          projectValue={projectId}
          onChange={updateFilters}
        />
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#dc2626', background: '#fff', borderRadius: 10, border: '1px solid #fca5a5', marginBottom: 16 }}>
          <AlertCircle size={24} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>{error}</div>
          <button onClick={fetchData} style={{ marginTop: 10, padding: '7px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Retry</button>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && !error && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={26} style={{ animation: 'bos-spin 1s linear infinite', marginBottom: 10 }} />
          <div style={{ fontSize: 13 }}>Loading payables…</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI cards ──────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Payable',         value: fmt(totalPayable),   sub: `${bills.length} bill${bills.length !== 1 ? 's' : ''} unpaid`,          color: '#dc2626', bg: '#fff5f5', border: '#fca5a5', icon: '📋' },
              { label: 'Already Paid',           value: fmt(totalPaid),      sub: `of ${fmt(totalBilled)} total billed`,                                   color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
              { label: 'Vendor Advances (Avail)',value: fmt(totalUnapplied), sub: `${advances.length} advance${advances.length !== 1 ? 's' : ''} unused`,  color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', icon: '💳' },
              { label: 'Net Payable',            value: fmt(netPayable),     sub: 'After netting advances',                                               color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', icon: '⚡' },
              { label: 'Overdue to Vendors',     value: fmt(overdueBalance), sub: `${overdueCount} bill${overdueCount !== 1 ? 's' : ''} past due`,         color: '#991b1b', bg: '#fff1f2', border: '#fca5a5', icon: '⚠️' },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontSize: 'clamp(13px, 1.3vw, 17px)', fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 2 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── AP Ageing Analysis ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} /> AP Ageing Analysis
              <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>Click a bucket to expand</span>
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
                      style={{ flex: '1 1 130px', padding: '9px 12px', background: b.bg, border: `1px solid ${b.border}`, borderRadius: 8, cursor: 'pointer', minWidth: 110, maxWidth: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.3 }}>{b.label}</div>
                      <div style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 800, color: b.color, marginTop: 3 }}>{fmt(bTot)}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{rows.length} bill{rows.length !== 1 ? 's' : ''} · {pct}%</div>
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
                <div key={bucket.key} style={{ marginBottom: 8, border: `1px solid ${bucket.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {/* Header */}
                  <div onClick={() => toggleBucket(bucket.key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: bucket.bg, cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: bucket.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 'clamp(11px, 1.1vw, 13px)', color: bucket.color, whiteSpace: 'nowrap' }}>{bucket.label}</span>
                      <span style={{ fontSize: 11, color: '#64748b', background: '#fff', borderRadius: 10, padding: '1px 8px', border: `1px solid ${bucket.border}`, whiteSpace: 'nowrap' }}>
                        {rows.length} bill{rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 'clamp(12px, 1.2vw, 14px)', color: bucket.color }}>{fmt(bucketTot)}</span>
                      {isOpen ? <ChevronUp size={15} color={bucket.color} /> : <ChevronDown size={15} color={bucket.color} />}
                    </div>
                  </div>

                  {/* Scrollable table */}
                  {isOpen && (
                    <ScrollTable maxRows={8}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ background: '#f8fafc' }}>
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
                              <tr key={bill.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfd', borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb', fontWeight: 700 }}>
                                    {bill.billNo || bill.billRefId || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '7px 12px', color: '#0f172a', fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {bill.vendorName || '—'}
                                </td>
                                <td style={{ padding: '7px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                                  {bill.poNumber || bill.poRefId || '—'}
                                </td>
                                <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(bill.billDate)}</td>
                                <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(bill.dueDate)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {days === null ? <span style={{ color: '#94a3b8' }}>—</span>
                                    : days <= 0   ? <span style={{ color: '#15803d', fontWeight: 600, fontSize: 11 }}>in {Math.abs(days)}d</span>
                                    : <span style={{ color: bucket.color, fontWeight: 700, fontSize: 11 }}>{days}d</span>}
                                </td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(parseFloat(bill.totalAmount) || 0)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#15803d', whiteSpace: 'nowrap' }}>{fmt(parseFloat(bill.paidAmount) || 0)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: bucket.color, whiteSpace: 'nowrap' }}>{fmt(bal)}</td>
                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                    background: bill.status === 'Paid' ? '#dcfce7' : bill.status === 'Partially Paid' ? '#fef3c7' : '#fee2e2',
                                    color:      bill.status === 'Paid' ? '#166534' : bill.status === 'Partially Paid' ? '#92400e' : '#991b1b',
                                  }}>
                                    {bill.status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: bucket.bg, position: 'sticky', bottom: 0 }}>
                            <td colSpan={6} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: bucket.color }}>
                              Subtotal — {rows.length} bill{rows.length !== 1 ? 's' : ''}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>{fmt(rows.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0))}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(rows.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0))}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: bucket.color }}>{fmt(bucketTot)}</td>
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
              <div style={{ textAlign: 'center', padding: '40px 0', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <CheckCircle size={32} style={{ color: '#22c55e', marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>All bills are fully paid!</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>No outstanding payables for the selected filters.</div>
              </div>
            )}
          </div>

          {/* ── Unapplied Vendor Advances ──────────────────────────────────────── */}
          {advances.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                💳 Unapplied Vendor Advances
                <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>Advances paid to vendors not yet matched to a bill</span>
              </h3>
              <div style={{ background: '#fff', border: '1px solid #93c5fd', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <ScrollTable maxRows={8}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: '#eff6ff' }}>
                      <tr>
                        <Th color="#1e40af" bg="#eff6ff">Advance No.</Th>
                        <Th color="#1e40af" bg="#eff6ff">Vendor</Th>
                        <Th color="#1e40af" bg="#eff6ff">Date</Th>
                        <Th color="#1e40af" bg="#eff6ff">Method</Th>
                        <Th color="#1e40af" bg="#eff6ff">Reference</Th>
                        <Th color="#1e40af" bg="#eff6ff" right>Total Paid</Th>
                        <Th color="#1e40af" bg="#eff6ff" right>Applied</Th>
                        <Th color="#1e40af" bg="#eff6ff" right>Unapplied</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {advances.map((adv, idx) => (
                        <tr key={adv.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfd', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11, color: '#2563eb', fontWeight: 700, whiteSpace: 'nowrap' }}>{adv.advanceNo || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#0f172a', fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.vendorName || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(adv.advanceDate)}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{adv.paymentMode || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 10, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.transactionReference || '—'}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.amount) || 0)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: '#15803d', whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.appliedAmount) || 0)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.unappliedAmount) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#eff6ff', position: 'sticky', bottom: 0 }}>
                        <td colSpan={5} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: '#1e40af' }}>
                          Total — {advances.length} advance{advances.length !== 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>{fmt(advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0))}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(advances.reduce((s, a) => s + (parseFloat(a.appliedAmount) || 0), 0))}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{fmt(totalUnapplied)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </ScrollTable>
              </div>

              {/* Net payable summary */}
              <div style={{
                marginTop: 14, padding: '12px 18px',
                background: netPayable <= 0 ? '#f0fdf4' : '#fef3c7',
                border: `1px solid ${netPayable <= 0 ? '#86efac' : '#fcd34d'}`,
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: '#374151' }}>
                  <strong>Net Payable Position</strong>
                  <span style={{ color: '#64748b', marginLeft: 8 }}>
                    {fmt(totalPayable)} payable − {fmt(totalUnapplied)} advances available
                  </span>
                </div>
                <div style={{ fontSize: 'clamp(15px, 1.5vw, 18px)', fontWeight: 800, color: netPayable <= 0 ? '#15803d' : '#92400e' }}>
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