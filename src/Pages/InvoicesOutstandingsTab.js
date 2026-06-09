import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Clock, ChevronDown, ChevronUp, RefreshCw, CheckCircle, Download } from 'lucide-react';
import GroupProjectFilter from '../components/Dropdowns/GroupProjectFilter';
import useGroupProjectFilters from '../components/Dropdowns/useGroupProjectFilters';
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BUCKETS = [
  { key: 'current', label: 'Current (Not Yet Due)',  color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  { key: '1-30',    label: '1 – 30 Days Overdue',    color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  { key: '31-60',   label: '31 – 60 Days Overdue',   color: '#9a3412', bg: '#ffedd5', border: '#fb923c' },
  { key: '61-90',   label: '61 – 90 Days Overdue',   color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  { key: '90+',     label: 'Over 90 Days Overdue',   color: '#7f1d1d', bg: '#fecaca', border: '#ef4444' },
  { key: 'no-due',  label: 'No Due Date',            color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
];

/* ── Shared sticky-header table wrapper ─────────────────────────────────────
   Gives each expanded table its own scroll box so the page doesn't grow tall. */
function ScrollTable({ children, maxRows = 8 }) {
  // Approx row height 38px + header 38px
  const maxH = 38 + maxRows * 38 + 2; // +2 for borders
  return (
    <div style={{
      overflowX: 'auto',
      overflowY: 'auto',
      maxHeight: maxH,
      /* Custom thin scrollbar */
      scrollbarWidth: 'thin',
      scrollbarColor: '#cbd5e1 #f1f5f9',
    }}>
      {children}
    </div>
  );
}

/* ── Th helper — sticky on scroll ────────────────────────────────────────── */
/* bg must be an explicit colour (not 'inherit') so Chrome repaints correctly  */
const Th = ({ children, right, color, bg = '#f8fafc' }) => (
  <th style={{
    padding: '8px 12px',
    textAlign: right ? 'right' : 'left',
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: color || '#475569',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: bg,
    zIndex: 2,
    boxShadow: '0 1px 0 #e2e8f0',
  }}>{children}</th>
);

export default function OutstandingsTab() {
  const { user } = useAuth();
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'x-user-id':   user?.id   || localStorage.getItem('userId'),
    'x-user-role': user?.role || localStorage.getItem('userRole'),
  });

  const [invoices,    setInvoices]    = useState([]);
  const [advances,    setAdvances]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [expandedBkt, setExpandedBkt] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);

  const [exporting, setExporting] = useState(false);

  // ── Excel export ────────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (invoices.length === 0 && advances.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const fmtN  = (n) => parseFloat(n || 0);
      const fmtD  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

      const calcDays = (inv) => {
        if (!inv.dueDate) return null;
        const due = new Date(inv.dueDate); due.setHours(0,0,0,0);
        const now = new Date();            now.setHours(0,0,0,0);
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
      const getBalance = (inv) => fmtN(inv.balanceAmount ?? (fmtN(inv.totalAmount) - fmtN(inv.paidAmount)));

      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Summary ───────────────────────────────────────────────────
      const totalOutstanding = invoices.reduce((s, i) => s + getBalance(i), 0);
      const totalUnapplied   = advances.reduce((s, a) => s + fmtN(a.unappliedAmount), 0);
      const netOutstanding   = Math.max(0, totalOutstanding - totalUnapplied);
      const overdueBalance   = invoices.filter(i => (calcDays(i) ?? 0) > 0).reduce((s, i) => s + getBalance(i), 0);
      const overdueCount     = invoices.filter(i => (calcDays(i) ?? 0) > 0).length;

      const summaryData = [
        ['AR Outstandings — Summary'],
        [`As of ${today}`],
        [],
        ['Metric', 'Value'],
        ['Total Outstanding (₹)',    totalOutstanding],
        ['Unapplied Advances (₹)',   totalUnapplied],
        ['Net Receivable (₹)',       netOutstanding],
        ['Overdue Amount (₹)',       overdueBalance],
        ['Overdue Invoice Count',    overdueCount],
        ['Total Outstanding Invoices', invoices.length],
        ['Total Unapplied Advances',   advances.length],
        [],
        ['Ageing Breakdown', 'Amount (₹)', 'Count', '% of Total'],
      ];
      const buckets = ['Not Yet Due','1 – 30 Days Overdue','31 – 60 Days Overdue','61 – 90 Days Overdue','Over 90 Days Overdue','No Due Date'];
      buckets.forEach(label => {
        const rows = invoices.filter(i => getBucket(calcDays(i)) === label);
        const amt  = rows.reduce((s, i) => s + getBalance(i), 0);
        if (rows.length > 0) summaryData.push([label, amt, rows.length, totalOutstanding > 0 ? (amt / totalOutstanding * 100).toFixed(1) + '%' : '0%']);
      });
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // ── Sheet 2: Outstanding Invoices ──────────────────────────────────────
      const invHeaders = ['Invoice No.', 'Customer / Project', 'Project ID', 'Invoice Date', 'Due Date', 'Days Overdue', 'Ageing Bucket', 'Status', 'Invoice Amount (₹)', 'Paid (₹)', 'Outstanding Balance (₹)'];
      const invRows = invoices.map(inv => {
        const days = calcDays(inv);
        return [
          inv.invoiceNumber || inv.tallyInvoiceNo || '',
          inv.customerName  || inv.projectName    || '',
          inv.projectId     || '',
          fmtD(inv.invoiceDate),
          fmtD(inv.dueDate),
          days === null ? '' : days <= 0 ? `In ${Math.abs(days)}d` : `${days}d`,
          getBucket(days),
          (inv.status || '').replace(/_/g, ' '),
          fmtN(inv.totalAmount),
          fmtN(inv.paidAmount),
          getBalance(inv),
        ];
      });
      const wsInvoices = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows]);
      wsInvoices['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, wsInvoices, 'Outstanding Invoices');

      // ── Sheet 3: Ageing Detail (one sheet per non-empty bucket) ───────────
      buckets.forEach(label => {
        const rows = invoices.filter(i => getBucket(calcDays(i)) === label);
        if (rows.length === 0) return;
        const sheetName = label.length > 31 ? label.slice(0, 31) : label;
        const bucketHeaders = ['Invoice No.', 'Customer / Project', 'Project ID', 'Invoice Date', 'Due Date', 'Days', 'Status', 'Invoice Amount (₹)', 'Paid (₹)', 'Outstanding (₹)'];
        const bucketRows = rows.map(inv => {
          const days = calcDays(inv);
          return [
            inv.invoiceNumber || inv.tallyInvoiceNo || '',
            inv.customerName  || inv.projectName    || '',
            inv.projectId     || '',
            fmtD(inv.invoiceDate),
            fmtD(inv.dueDate),
            days === null ? '' : days <= 0 ? `In ${Math.abs(days)}d` : `${days}d`,
            (inv.status || '').replace(/_/g, ' '),
            fmtN(inv.totalAmount),
            fmtN(inv.paidAmount),
            getBalance(inv),
          ];
        });
        const subtotal = rows.reduce((s, i) => s + getBalance(i), 0);
        const ws = XLSX.utils.aoa_to_sheet([
          bucketHeaders,
          ...bucketRows,
          [],
          ['', '', '', '', '', '', 'Subtotal', rows.reduce((s,i) => s + fmtN(i.totalAmount), 0), rows.reduce((s,i) => s + fmtN(i.paidAmount), 0), subtotal],
        ]);
        ws['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // ── Sheet 4: Unapplied Advances ────────────────────────────────────────
      if (advances.length > 0) {
        const advHeaders = ['Receipt No.', 'Customer', 'Receipt Date', 'Payment Method', 'Reference', 'Total Amount (₹)', 'Applied (₹)', 'Unapplied (₹)'];
        const advRows = advances.map(a => [
          a.receiptNo          || '',
          a.customerName       || '',
          fmtD(a.receiptDate),
          a.paymentMethod      || '',
          a.transactionReference || '',
          fmtN(a.amount),
          fmtN(a.appliedAmount),
          fmtN(a.unappliedAmount),
        ]);
        const advSubtotal = advances.reduce((s, a) => s + fmtN(a.unappliedAmount), 0);
        const wsAdv = XLSX.utils.aoa_to_sheet([
          advHeaders,
          ...advRows,
          [],
          ['', '', '', '', 'Total Unapplied', advances.reduce((s,a) => s + fmtN(a.amount), 0), advances.reduce((s,a) => s + fmtN(a.appliedAmount), 0), advSubtotal],
        ]);
        wsAdv['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsAdv, 'Unapplied Advances');
      }

      const fileName = `AR_Outstandings_${new Date().toISOString().slice(0,10)}.xlsx`;
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
      // ── 1. Outstanding invoices via dedicated endpoint (no pagination, stable sort) ──
      const invParams = new URLSearchParams();
      if (groupName)    invParams.append('groupId',    groupName);
      if (subGroupName) invParams.append('subGroupId', subGroupName);
      if (projectId)    invParams.append('projectId',  projectId);

      // ── 2. Unapplied customer advance receipts ────────────────────────────
      const rcpParams = new URLSearchParams({ page: 0, size: 500, receiptType: 'ADVANCE' });
      if (groupName)    rcpParams.append('groupId',    groupName);
      if (subGroupName) rcpParams.append('subGroupId', subGroupName);
      if (projectId)    rcpParams.append('projectId',  projectId);

      const [invRes, rcpRes] = await Promise.all([
        fetch(`${API_BASE_URL}/invoices/outstandings?${invParams}`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/invoices/receipts?${rcpParams}`,     { credentials: 'include', headers: getAuthHeaders() }),
      ]);

      const invData = invRes.ok ? await invRes.json() : {};
      const rcpData = rcpRes.ok ? await rcpRes.json() : {};

      // Backend already computed the split — use directly
      setInvoices(invData.outstanding || []);
      setAdvances((rcpData.receipts || []).filter(r => parseFloat(r.unappliedAmount || 0) > 0.01));
      setLastRefresh(new Date());
    } catch {
      setError('Failed to load outstanding data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [groupName, subGroupName, projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDays = (inv) => {
    if (!inv.dueDate) return null;
    const due = new Date(inv.dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.floor((today - due) / 86400000);
  };

  const getBucket = (d) => {
    if (d === null) return 'no-due';
    if (d <= 0)     return 'current';
    if (d <= 30)    return '1-30';
    if (d <= 60)    return '31-60';
    if (d <= 90)    return '61-90';
    return '90+';
  };

  const getBalance = (inv) =>
    parseFloat(inv.balanceAmount ?? (parseFloat(inv.totalAmount || 0) - parseFloat(inv.paidAmount || 0)));

  const grouped = Object.fromEntries(BUCKETS.map(b => [b.key, []]));
  invoices.forEach(inv => {
    const d = getDays(inv);
    grouped[getBucket(d)].push({ ...inv, _days: d });
  });

  const totalOutstanding = invoices.reduce((s, i) => s + getBalance(i), 0);
  const totalUnapplied   = advances.reduce((s, a) => s + parseFloat(a.unappliedAmount || 0), 0);
  const netOutstanding   = Math.max(0, totalOutstanding - totalUnapplied);
  const overdueBalance   = invoices.filter(i => (getDays(i) ?? 0) > 0).reduce((s, i) => s + getBalance(i), 0);
  const overdueCount     = invoices.filter(i => (getDays(i) ?? 0) > 0).length;

  const toggleBucket = (key) => setExpandedBkt(p => ({ ...p, [key]: !p[key] }));

  return (
    <div style={{ padding: 'clamp(14px, 2vw, 24px) clamp(16px, 2.5vw, 28px)', background: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(15px, 1.5vw, 20px)', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} color="#dc2626" />
            Accounts Receivable — Outstandings
          </h2>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
            As of {today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            {lastRefresh && <span style={{ marginLeft: 8 }}>· Refreshed {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={exportToExcel} disabled={exporting || loading || (invoices.length === 0 && advances.length === 0)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#16a34a', border: '1px solid #15803d', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: (exporting || loading || (invoices.length === 0 && advances.length === 0)) ? 'not-allowed' : 'pointer', opacity: (exporting || loading || (invoices.length === 0 && advances.length === 0)) ? 0.55 : 1, whiteSpace: 'nowrap' }}
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            onClick={fetchData} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#374151', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={13} style={loading ? { animation: 'outstanding-spin 1s linear infinite' } : {}} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
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
          <button onClick={fetchData} style={{ marginTop: 10, padding: '7px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Retry</button>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && !error && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={26} style={{ animation: 'outstanding-spin 1s linear infinite', marginBottom: 10 }} />
          <div style={{ fontSize: 13 }}>Loading outstanding receivables…</div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI cards ────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Outstanding', value: fmt(totalOutstanding), sub: `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`,       color: '#dc2626', bg: '#fff5f5', border: '#fca5a5', icon: '📋' },
              { label: 'Unapplied Advances', value: fmt(totalUnapplied),  sub: `${advances.length} advance${advances.length !== 1 ? 's' : ''}`,         color: '#d97706', bg: '#fffbeb', border: '#fcd34d', icon: '💰' },
              { label: 'Net Receivable',     value: fmt(netOutstanding),  sub: 'After netting advances',                                               color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: '✅' },
              { label: 'Overdue Amount',     value: fmt(overdueBalance),  sub: `${overdueCount} invoice${overdueCount !== 1 ? 's' : ''} past due date`, color: '#991b1b', bg: '#fff1f2', border: '#fca5a5', icon: '⚠️' },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontSize: 'clamp(14px, 1.4vw, 18px)', fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 2 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Ageing Analysis ────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} /> Ageing Analysis
              <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>Click a bucket to expand</span>
            </h3>

            {/* Summary bar */}
            {invoices.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {BUCKETS.map(b => {
                  const rows  = grouped[b.key];
                  if (rows.length === 0) return null;
                  const bTot  = rows.reduce((s, i) => s + getBalance(i), 0);
                  const pct   = totalOutstanding > 0 ? (bTot / totalOutstanding * 100).toFixed(1) : 0;
                  return (
                    <div key={b.key} onClick={() => toggleBucket(b.key)}
                      style={{ flex: '1 1 130px', padding: '9px 12px', background: b.bg, border: `1px solid ${b.border}`, borderRadius: 8, cursor: 'pointer', minWidth: 110, maxWidth: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.3 }}>{b.label}</div>
                      <div style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 800, color: b.color, marginTop: 3 }}>{fmt(bTot)}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{rows.length} inv · {pct}%</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bucket tables */}
            {BUCKETS.map(bucket => {
              const rows      = grouped[bucket.key];
              if (rows.length === 0) return null;
              const bucketTot = rows.reduce((s, i) => s + getBalance(i), 0);
              const isOpen    = !!expandedBkt[bucket.key];

              return (
                <div key={bucket.key} style={{ marginBottom: 8, border: `1px solid ${bucket.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {/* Bucket header */}
                  <div onClick={() => toggleBucket(bucket.key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: bucket.bg, cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: bucket.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 'clamp(11px, 1.1vw, 13px)', color: bucket.color, whiteSpace: 'nowrap' }}>{bucket.label}</span>
                      <span style={{ fontSize: 11, color: '#64748b', background: '#fff', borderRadius: 10, padding: '1px 8px', border: `1px solid ${bucket.border}`, whiteSpace: 'nowrap' }}>
                        {rows.length} inv
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 'clamp(12px, 1.2vw, 14px)', color: bucket.color }}>{fmt(bucketTot)}</span>
                      {isOpen ? <ChevronUp size={15} color={bucket.color} /> : <ChevronDown size={15} color={bucket.color} />}
                    </div>
                  </div>

                  {/* Scrollable table — max 8 rows visible */}
                  {isOpen && (
                    <ScrollTable maxRows={8}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr>
                            <Th>Invoice No.</Th>
                            <Th>Customer / Project</Th>
                            <Th>Inv. Date</Th>
                            <Th>Due Date</Th>
                            <Th right>Days</Th>
                            <Th right>Inv. Amt</Th>
                            <Th right>Paid</Th>
                            <Th right>Outstanding</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((inv, idx) => {
                            const bal  = getBalance(inv);
                            const days = inv._days;
                            const stat = (inv.status || '').replace(/_/g, ' ');
                            return (
                              <tr key={inv.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfd', borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb', fontWeight: 700 }}>
                                    {inv.invoiceNumber || inv.tallyInvoiceNo || '—'}
                                  </span>
                                  <span style={{ display: 'block', fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{stat}</span>
                                </td>
                                <td style={{ padding: '7px 12px', color: '#0f172a', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {inv.customerName || inv.projectName || '—'}
                                  {inv.projectId && <span style={{ display: 'block', fontSize: 9, color: '#94a3b8' }}>{inv.projectId}</span>}
                                </td>
                                <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(inv.invoiceDate)}</td>
                                <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(inv.dueDate)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {days === null ? <span style={{ color: '#94a3b8' }}>—</span>
                                    : days <= 0   ? <span style={{ color: '#15803d', fontWeight: 600, fontSize: 11 }}>in {Math.abs(days)}d</span>
                                    : <span style={{ color: bucket.color, fontWeight: 700, fontSize: 11 }}>{days}d</span>}
                                </td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(parseFloat(inv.totalAmount) || 0)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#15803d', whiteSpace: 'nowrap' }}>{fmt(parseFloat(inv.paidAmount) || 0)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: bucket.color, whiteSpace: 'nowrap' }}>{fmt(bal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: bucket.bg, position: 'sticky', bottom: 0 }}>
                            <td colSpan={5} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: bucket.color }}>
                              Subtotal — {rows.length} invoice{rows.length !== 1 ? 's' : ''}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>{fmt(rows.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0))}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(rows.reduce((s, i) => s + (parseFloat(i.paidAmount) || 0), 0))}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: bucket.color }}>{fmt(bucketTot)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </ScrollTable>
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {invoices.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <CheckCircle size={32} style={{ color: '#22c55e', marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>All invoices are fully paid!</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>No outstanding receivables for the selected filters.</div>
              </div>
            )}
          </div>

          {/* ── Unapplied Advances ─────────────────────────────────────────────── */}
          {advances.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                💰 Unapplied Advances
                <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>Client money received but not yet applied to any invoice</span>
              </h3>
              <div style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <ScrollTable maxRows={8}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: '#fffbeb' }}>
                      <tr>
                        <Th color="#92400e" bg="#fffbeb">Receipt No.</Th>
                        <Th color="#92400e" bg="#fffbeb">Customer</Th>
                        <Th color="#92400e" bg="#fffbeb">Date</Th>
                        <Th color="#92400e" bg="#fffbeb">Method</Th>
                        <Th color="#92400e" bg="#fffbeb">Reference</Th>
                        <Th color="#92400e" bg="#fffbeb" right>Total Amt</Th>
                        <Th color="#92400e" bg="#fffbeb" right>Applied</Th>
                        <Th color="#92400e" bg="#fffbeb" right>Unapplied</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {advances.map((adv, idx) => (
                        <tr key={adv.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfd', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 11, color: '#d97706', fontWeight: 700, whiteSpace: 'nowrap' }}>{adv.receiptNo || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#0f172a', fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.customerName || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(adv.receiptDate)}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{adv.paymentMethod || '—'}</td>
                          <td style={{ padding: '7px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 10, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.transactionReference || '—'}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: '#374151', whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.amount) || 0)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: '#15803d', whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.appliedAmount) || 0)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706', whiteSpace: 'nowrap' }}>{fmt(parseFloat(adv.unappliedAmount) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#fffbeb', position: 'sticky', bottom: 0 }}>
                        <td colSpan={5} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: '#92400e' }}>
                          Total — {advances.length} advance{advances.length !== 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>{fmt(advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0))}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>{fmt(advances.reduce((s, a) => s + (parseFloat(a.appliedAmount) || 0), 0))}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>{fmt(totalUnapplied)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </ScrollTable>
              </div>

              {/* Net receivable summary */}
              <div style={{
                marginTop: 14, padding: '12px 18px',
                background: netOutstanding <= 0 ? '#f0fdf4' : '#fff7ed',
                border: `1px solid ${netOutstanding <= 0 ? '#86efac' : '#fed7aa'}`,
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: '#374151' }}>
                  <strong>Net Receivable Position</strong>
                  <span style={{ color: '#64748b', marginLeft: 8 }}>
                    {fmt(totalOutstanding)} outstanding − {fmt(totalUnapplied)} advances
                  </span>
                </div>
                <div style={{ fontSize: 'clamp(15px, 1.5vw, 18px)', fontWeight: 800, color: netOutstanding <= 0 ? '#15803d' : '#92400e' }}>
                  = {fmt(netOutstanding)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes outstanding-spin { to { transform: rotate(360deg); } }
        /* Thin scrollbar for webkit */
        .outstanding-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .outstanding-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
        .outstanding-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}