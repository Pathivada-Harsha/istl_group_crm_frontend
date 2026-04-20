import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Download, BarChart2, TrendingUp, Package,
  IndianRupee, ChevronRight, RefreshCw, Eye, FileSpreadsheet,
  CheckCircle, AlertCircle, Clock, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import filterApi from '../services/filterApi';
import { useAuth } from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer';
import CrmPreloader from '../components/preLoader';
import '../pages-css/ProjectReports.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n) => {
  const v = parseFloat(n) || 0;
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtShort = (n) => {
  const v = parseFloat(n) || 0;
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
// PDF-safe formatters — jsPDF built-in fonts don't support Unicode ₹ (U+20B9)
// Use "Rs." prefix which renders correctly in all PDF fonts
const pFmt = (n) => {
  const v = parseFloat(n) || 0;
  const neg = v < 0;
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? '-' : '') + 'Rs.' + formatted;
};
const pFmtShort = (n) => {
  const v = parseFloat(n) || 0;
  const neg = v < 0;
  const abs = Math.abs(v);
  const prefix = (neg ? '-' : '') + 'Rs.';
  if (abs >= 1e7) return prefix + (abs / 1e7).toFixed(2) + ' Cr';
  if (abs >= 1e5) return prefix + (abs / 1e5).toFixed(2) + ' L';
  return prefix + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
const pct = (n) => (parseFloat(n) || 0).toFixed(1) + '%';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, color = '#2563eb', icon }) => (
  <div className="pr-kpi-card" style={{ borderTopColor: color }}>
    <div className="pr-kpi-icon" style={{ color }}>{icon}</div>
    <div className="pr-kpi-body">
      <div className="pr-kpi-value" style={{ color }}>{value}</div>
      <div className="pr-kpi-label">{label}</div>
      {sub && <div className="pr-kpi-sub">{sub}</div>}
    </div>
  </div>
);

// ─── Simple bar chart (SVG) ────────────────────────────────────────────────────
const BarChart = ({ data, height = 140 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 24);
        const x = i * w + w * 0.15;
        const barW = w * 0.7;
        return (
          <g key={i}>
            <rect x={x} y={height - 20 - barH} width={barW} height={barH}
              fill={d.color || '#2563eb'} rx="1.5" opacity="0.85" />
            <text x={x + barW / 2} y={height - 4} textAnchor="middle"
              fontSize="4.5" fill="#6b7280" fontFamily="inherit">{d.label}</text>
            <title>{d.label}: {fmtShort(d.value)}</title>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Donut chart (SVG) ────────────────────────────────────────────────────────
const Donut = ({ segments, size = 120 }) => {
  const r = 38, cx = 60, cy = 60, strokeWidth = 18;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, d) => s + (parseFloat(d.value) || 0), 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset + circ * 0.25}
            style={{ transition: 'stroke-dasharray 0.5s' }}>
            <title>{seg.label}: {fmtShort(seg.value)}</title>
          </circle>
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1e293b">
        {fmtShort(total)}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6" fill="#64748b">Total</text>
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function ProjectReports() {
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Project selection
  const [groups, setGroups]         = useState([]);
  const [subGroups, setSubGroups]   = useState([]);
  const [projects, setProjects]     = useState([]);
  const [selGroup, setSelGroup]     = useState('');
  const [selSubGroup, setSelSubGroup] = useState('');
  const [selProject, setSelProject] = useState('');
  const [dropLoading, setDropLoading] = useState({ g: false, sg: false, p: false });

  // Report data
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
  });

  // Load groups on mount
  useEffect(() => {
    setDropLoading(p => ({ ...p, g: true }));
    filterApi.getAllGroups().then(g => setGroups(g || [])).catch(() => {}).finally(() => setDropLoading(p => ({ ...p, g: false })));
  }, []);

  const handleGroupChange = async (v) => {
    setSelGroup(v); setSelSubGroup(''); setSelProject(''); setSubGroups([]); setProjects([]);
    if (!v) return;
    setDropLoading(p => ({ ...p, sg: true }));
    filterApi.getSubGroups(v).then(sg => setSubGroups(sg || [])).catch(() => {}).finally(() => setDropLoading(p => ({ ...p, sg: false })));
  };

  const handleSubGroupChange = async (v) => {
    setSelSubGroup(v); setSelProject(''); setProjects([]);
    if (!v) return;
    setDropLoading(p => ({ ...p, p: true }));
    filterApi.getProjects(selGroup, v).then(ps => setProjects(ps || [])).catch(() => {}).finally(() => setDropLoading(p => ({ ...p, p: false })));
  };

  // Fetch report
  const fetchReport = async () => {
    if (!selProject) { showError('Please select a project'); return; }
    setLoading(true); setReport(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/project/${encodeURIComponent(selProject)}`, {
        credentials: 'include', headers: getAuthHeaders()
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setReport(data);
      setActiveTab('overview');
      showSuccess('Report generated successfully!');
    } catch (err) { showError(err.message || 'Failed to generate report'); }
    finally { setLoading(false); }
  };

  // ─── Excel Export ────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Style header row
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    // Sheet 1: Overview
    const ov = report.overview || {};
    addSheet('1. Project Overview', [
      ['PROJECT REPORT', '', '', '', '', ''],
      ['Generated:', report.generatedAt, '', '', '', ''],
      [],
      ['PROJECT OVERVIEW', '', '', '', '', ''],
      ['Project ID', ov.projectId], ['Project Name', ov.projectName],
      ['Location', ov.location], ['Status', ov.status],
      ['Group', ov.groupName], ['Sub Group', ov.subGroupName],
      ['Start Date', ov.startDate], ['End Date', ov.endDate],
      ['Budget', parseFloat(ov.budget) || 0], ['Progress %', parseFloat(ov.progressPercentage) || 0],
      [],
      ['FINANCIAL SNAPSHOT', '', '', '', '', ''],
      ['Total Contract Value (Invoiced)', parseFloat(ov.totalContractValue) || 0],
      ['Total Received', parseFloat(ov.totalReceived) || 0],
      ['Total Procurement (Billed)', parseFloat(ov.totalProcurement) || 0],
      ['Total Paid to Vendors', parseFloat(ov.totalPaid) || 0],
      ['Projected Profit', parseFloat(ov.projectedProfit) || 0],
      ['Profit Margin %', parseFloat(ov.profitMarginPercent) || 0],
    ]);

    // Sheet 2: Billing — Invoices
    const bil = report.billing || {};
    const invHeaders = ['Invoice No','Invoice Date','Due Date','Customer','Total Amount','Paid Amount','Balance Amount','Status','GST Amount','Receipt No','Payment Method'];
    const invRows = (bil.invoices || []).map(r => [
      r.invoiceNo, r.invoiceDate, r.dueDate, r.customerName,
      parseFloat(r.totalAmount)||0, parseFloat(r.paidAmount)||0, parseFloat(r.balanceAmount)||0,
      r.status, parseFloat(r.taxAmount)||0, r.receiptNo, r.paymentMethod
    ]);
    addSheet('2. Invoices', [
      ['BILLING STATUS — INVOICES'],
      ['Total Invoiced', parseFloat(bil.totalInvoiced)||0, '', 'Total Received', parseFloat(bil.totalReceived)||0, '', 'Pending', parseFloat(bil.totalPending)||0],
      [],
      invHeaders,
      ...invRows,
      [],
      ['TOTALS', '', '', '',
        invRows.reduce((s,r)=>s+r[4],0), invRows.reduce((s,r)=>s+r[5],0), invRows.reduce((s,r)=>s+r[6],0),
        '', invRows.reduce((s,r)=>s+r[8],0)
      ],
    ]);

    // Sheet 3: Billing — Receipts
    const recHeaders = ['Receipt No','Receipt Date','Type','Amount','Applied','Unapplied','Payment Method','Transaction Ref','Linked Invoice'];
    const recRows = (bil.receipts || []).map(r => [
      r.receiptNo, r.receiptDate, r.receiptType,
      parseFloat(r.amount)||0, parseFloat(r.appliedAmount)||0, parseFloat(r.unappliedAmount)||0,
      r.paymentMethod, r.transactionReference, r.linkedInvoiceNo
    ]);
    addSheet('3. Receipts', [
      ['RECEIPTS / PAYMENTS RECEIVED'],
      ['Total Receipts', parseFloat(bil.totalReceived)||0, '', 'Advances', parseFloat(bil.totalAdvances)||0],
      [],
      recHeaders,
      ...recRows,
      [],
      ['TOTALS','','',...[3,4,5].map(i=>recRows.reduce((s,r)=>s+r[i],0))],
    ]);

    // Sheet 4: Purchase Orders
    const proc = report.procurement || {};
    const poHeaders = ['PO No','Order Date','Vendor','Total Value','Payment Status','Delivery Status','Items Ordered','Items Delivered'];
    const poRows = (proc.purchaseOrders || []).map(r => [
      r.poNo, r.orderDate, r.vendorName, parseFloat(r.totalValue)||0,
      r.paymentStatus, r.status, r.totalItems, r.deliveredItems
    ]);
    addSheet('4. Purchase Orders', [
      ['PROCUREMENT — PURCHASE ORDERS'],
      ['Total PO Value', parseFloat(proc.totalPOValue)||0],
      [],
      poHeaders,
      ...poRows,
      [],
      ['TOTALS','','',poRows.reduce((s,r)=>s+r[3],0)],
    ]);

    // Sheet 5: Bills
    const billHeaders = ['Bill No','Bill Date','Due Date','Vendor','Total Amount','Paid Amount','Balance','Status','Linked PO','GST Amount'];
    const billRows = (proc.bills || []).map(r => [
      r.billNo, r.billDate, r.dueDate, r.vendorName,
      parseFloat(r.totalAmount)||0, parseFloat(r.paidAmount)||0, parseFloat(r.balanceAmount)||0,
      r.status, r.linkedPONo, parseFloat(r.taxAmount)||0
    ]);
    addSheet('5. Bills', [
      ['PROCUREMENT — BILLS RECEIVED'],
      ['Total Billed', parseFloat(proc.totalBilled)||0, '', 'Total Paid', parseFloat(proc.totalPaid)||0, '', 'Balance', parseFloat(proc.totalBalance)||0],
      [],
      billHeaders,
      ...billRows,
      [],
      ['TOTALS','','','',
        billRows.reduce((s,r)=>s+r[4],0), billRows.reduce((s,r)=>s+r[5],0), billRows.reduce((s,r)=>s+r[6],0),
        '','', billRows.reduce((s,r)=>s+r[9],0)
      ],
    ]);

    // Sheet 6: Profitability
    const prof = report.profitability || {};
    const expHeaders = ['Expense Code','Trip Date','Category','Amount','Paid By','Status'];
    const expRows = (prof.expenses || []).map(r => [
      r.expenseCode, r.tripDate, r.category, parseFloat(r.amount)||0, r.paidBy, r.status
    ]);
    addSheet('6. Profitability', [
      ['PROFITABILITY ANALYSIS'],
      [],
      ['REVENUE', '', 'COST', '', 'PROFIT', ''],
      ['Total Revenue (Invoiced)', parseFloat(prof.totalRevenue)||0, 'Total Procurement', parseFloat(prof.totalProcurement)||0, 'Gross Profit', parseFloat(prof.grossProfit)||0],
      ['', '', 'Project Expenses', parseFloat(prof.projectExpenses)||0, 'Net Profit', parseFloat(prof.netProfit)||0],
      ['', '', '', '', 'Gross Margin %', parseFloat(prof.grossMarginPercent)||0],
      ['', '', '', '', 'Net Margin %', parseFloat(prof.netMarginPercent)||0],
      [],
      ['GST ANALYSIS', ''],
      ['Invoice GST (Tax Collected)', parseFloat(prof.invoiceGSTAmount)||0],
      ['PO / Bill GST (Tax Paid)', parseFloat(prof.poGSTAmount)||0],
      ['Additional / Net GST', parseFloat(prof.additionalGST)||0],
      [],
      ['PROJECT EXPENSES', ''],
      expHeaders,
      ...expRows,
      [],
      ['TOTAL EXPENSES', '', '', expRows.reduce((s,r)=>s+r[3],0)],
    ]);

    const projName = (report.overview?.projectName || 'Report').replace(/[^a-zA-Z0-9_]/g, '_');
    XLSX.writeFile(wb, `Project_Report_${projName}.xlsx`);
    showSuccess('Excel report downloaded!');
  };

  // ─── PDF Export (jsPDF + embedded charts) ─────────────────────────────────
  const exportPDF = async () => {
    if (!report) return;
    setLoading(true);
    try {
      // Try dynamic import first, fall back to CDN-loaded global
      let jsPDF;
      try {
        const mod = await import('jspdf');
        jsPDF = mod.jsPDF;
      } catch {
        // jspdf not installed locally — load from CDN
        if (!window.jspdf) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        jsPDF = window.jspdf?.jsPDF;
        if (!jsPDF) throw new Error('jsPDF not available. Run: npm install jspdf');
      }
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const W = 210, margin = 14;
      let y = 0;

      const col = { blue: '#1e40af', green: '#059669', red: '#dc2626', amber: '#d97706', gray: '#64748b', dark: '#1e293b' };

      const addPage = () => { doc.addPage(); y = 20; };
      const checkY = (need = 20) => { if (y + need > 280) addPage(); };

      const drawHRule = (yy, clr = '#e2e8f0') => {
        doc.setDrawColor(clr); doc.setLineWidth(0.3);
        doc.line(margin, yy, W - margin, yy);
      };

      const sectionHeader = (title, clr = col.blue) => {
        checkY(16);
        doc.setFillColor(clr); doc.rect(margin, y, W - margin * 2, 8, 'F');
        doc.setTextColor('#ffffff'); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.text(title, margin + 3, y + 5.5);
        doc.setTextColor(col.dark); y += 12;
      };

      const kpiRow = (items) => {
        checkY(22);
        const w = (W - margin * 2) / items.length;
        items.forEach((kpi, i) => {
          const x = margin + i * w;
          doc.setFillColor('#f8fafc'); doc.roundedRect(x + 1, y, w - 2, 18, 2, 2, 'F');
          doc.setDrawColor('#e2e8f0'); doc.roundedRect(x + 1, y, w - 2, 18, 2, 2, 'S');
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(col.gray);
          doc.text(kpi.label, x + 4, y + 5);
          doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(kpi.color || col.blue);
          doc.text(kpi.value, x + 4, y + 12);
        });
        y += 22;
      };

      const tableHead = (cols, widths) => {
        checkY(8);
        doc.setFillColor(col.dark); doc.rect(margin, y, W - margin * 2, 7, 'F');
        doc.setTextColor('#fff'); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        let x = margin + 1;
        cols.forEach((c, i) => { doc.text(String(c), x, y + 5); x += widths[i]; });
        y += 7;
      };

      const tableRow = (vals, widths, even = false) => {
        checkY(7);
        if (even) { doc.setFillColor('#f8fafc'); doc.rect(margin, y, W - margin * 2, 6.5, 'F'); }
        doc.setTextColor(col.dark); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        let x = margin + 1;
        vals.forEach((v, i) => {
          const s = String(v ?? '');
          doc.text(s.substring(0, 28), x, y + 4.5);
          x += widths[i];
        });
        drawHRule(y + 6.5, '#f1f5f9');
        y += 7;
      };

      const ov   = report.overview       || {};
      const bil  = report.billing        || {};
      const proc = report.procurement    || {};
      const prof = report.profitability  || {};

      // ── Cover / Title ──
      doc.setFillColor('#1e40af'); doc.rect(0, 0, W, 50, 'F');
      doc.setFillColor('#1d4ed8'); doc.rect(0, 45, W, 6, 'F');
      doc.setTextColor('#ffffff'); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('PROJECT REPORT', margin, 22);
      doc.setFontSize(13); doc.setFont('helvetica', 'normal');
      doc.text(ov.projectName || '', margin, 32);
      doc.setFontSize(9);
      doc.text(`${ov.projectId || ''} · ${ov.location || ''}`, margin, 39);
      doc.setFontSize(8); doc.setTextColor('#bfdbfe');
      doc.text(`Generated: ${report.generatedAt || ''}`, margin, 46);

      y = 60;

      // ── 1. Project Overview ──
      sectionHeader('1. PROJECT OVERVIEW');
      const infoItems = [
        ['Project ID', ov.projectId], ['Status', ov.status],
        ['Group', ov.groupName], ['Sub Group', ov.subGroupName],
        ['Start Date', ov.startDate], ['End Date', ov.endDate],
        ['Budget', pFmt(ov.budget)], ['Progress', pct(ov.progressPercentage)],
      ];
      for (let i = 0; i < infoItems.length; i += 2) {
        checkY(8);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.gray);
        doc.text(infoItems[i][0] + ':', margin, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(col.dark);
        doc.text(String(infoItems[i][1] || '—'), margin + 25, y);
        if (infoItems[i + 1]) {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(col.gray);
          doc.text(infoItems[i + 1][0] + ':', 110, y);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(col.dark);
          doc.text(String(infoItems[i + 1][1] || '—'), 135, y);
        }
        y += 7;
      }
      y += 4;
      kpiRow([
        { label: 'Total Invoiced',      value: pFmtShort(ov.totalContractValue), color: col.blue },
        { label: 'Total Received',      value: pFmtShort(ov.totalReceived),      color: col.green },
        { label: 'Total Procurement',   value: pFmtShort(ov.totalProcurement),   color: col.amber },
        { label: 'Total Paid (Vendor)', value: pFmtShort(ov.totalPaid),          color: '#7c3aed' },
      ]);
      kpiRow([
        { label: 'Projected Profit', value: pFmtShort(ov.projectedProfit),    color: col.green },
        { label: 'Profit Margin',    value: pct(ov.profitMarginPercent),      color: col.green },
        { label: 'Pending (Billing)',value: pFmtShort(bil.totalPending),       color: col.amber },
        { label: 'Bill Balance',     value: pFmtShort(proc.totalBalance),      color: col.red },
      ]);

      // ── 2. Billing Status ──
      addPage();
      sectionHeader('2. BILLING STATUS — INVOICES & RECEIPTS', '#065f46');
      kpiRow([
        { label: 'Total Invoiced', value: pFmtShort(bil.totalInvoiced), color: col.blue },
        { label: 'Total Received', value: pFmtShort(bil.totalReceived), color: col.green },
        { label: 'Pending',        value: pFmtShort(bil.totalPending),  color: col.amber },
        { label: 'Advances',       value: pFmtShort(bil.totalAdvances), color: '#7c3aed' },
      ]);
      y += 2;
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.dark);
      doc.text('Invoice Details', margin, y); y += 5;
      const invW = [22, 22, 22, 35, 22, 22, 22, 15];
      tableHead(['Invoice No','Date','Due Date','Customer','Total','Paid','Balance','Status'], invW);
      (bil.invoices || []).slice(0, 30).forEach((r, i) => tableRow([
        r.invoiceNo, r.invoiceDate, r.dueDate,
        (r.customerName||'').substring(0,18), pFmt(r.totalAmount), pFmt(r.paidAmount), pFmt(r.balanceAmount), r.status
      ], invW, i % 2 === 0));
      y += 4;
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.dark);
      doc.text('Receipt Details', margin, y); y += 5;
      const recW = [25, 20, 20, 25, 22, 22, 25, 23];
      tableHead(['Receipt No','Date','Type','Amount','Applied','Unapplied','Method','Invoice Ref'], recW);
      (bil.receipts || []).slice(0, 20).forEach((r, i) => tableRow([
        r.receiptNo, r.receiptDate, r.receiptType,
        pFmt(r.amount), pFmt(r.appliedAmount), pFmt(r.unappliedAmount), r.paymentMethod, r.linkedInvoiceNo
      ], recW, i % 2 === 0));

      // ── 3. Procurement ──
      addPage();
      sectionHeader('3. PROCUREMENT STATUS — PURCHASE ORDERS & BILLS', '#7c2d12');
      kpiRow([
        { label: 'Total PO Value', value: pFmtShort(proc.totalPOValue),  color: col.blue },
        { label: 'Total Billed',   value: pFmtShort(proc.totalBilled),   color: col.amber },
        { label: 'Total Paid',     value: pFmtShort(proc.totalPaid),     color: col.green },
        { label: 'Balance Due',    value: pFmtShort(proc.totalBalance),  color: col.red },
      ]);
      y += 2;
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.dark);
      doc.text('Purchase Orders', margin, y); y += 5;
      const poW = [22, 20, 40, 25, 22, 22, 15, 16];
      tableHead(['PO No','Date','Vendor','Value','Payment','Status','Ordered','Delivered'], poW);
      (proc.purchaseOrders || []).slice(0, 25).forEach((r, i) => tableRow([
        r.poNo, r.orderDate, (r.vendorName||'').substring(0,22),
        pFmt(r.totalValue), r.paymentStatus, r.status, r.totalItems, r.deliveredItems
      ], poW, i % 2 === 0));
      y += 4;
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.dark);
      doc.text('Bills Received', margin, y); y += 5;
      const billW = [22, 20, 20, 35, 22, 22, 22, 19];
      tableHead(['Bill No','Date','Due Date','Vendor','Total','Paid','Balance','Status'], billW);
      (proc.bills || []).slice(0, 25).forEach((r, i) => tableRow([
        r.billNo, r.billDate, r.dueDate, (r.vendorName||'').substring(0,22),
        pFmt(r.totalAmount), pFmt(r.paidAmount), pFmt(r.balanceAmount), r.status
      ], billW, i % 2 === 0));

      // ── 4. Profitability ──
      addPage();
      sectionHeader('4. PROFITABILITY ANALYSIS', '#4a1d96');
      kpiRow([
        { label: 'Total Revenue',      value: pFmtShort(prof.totalRevenue),      color: col.green },
        { label: 'Total Procurement',  value: pFmtShort(prof.totalProcurement),  color: col.amber },
        { label: 'Gross Profit',       value: pFmtShort(prof.grossProfit),        color: col.green },
        { label: 'Gross Margin %',     value: pct(prof.grossMarginPercent),      color: col.green },
      ]);
      kpiRow([
        { label: 'Project Expenses',   value: pFmtShort(prof.projectExpenses),   color: col.red },
        { label: 'Net Profit',         value: pFmtShort(prof.netProfit),          color: parseFloat(prof.netProfit) >= 0 ? col.green : col.red },
        { label: 'Net Margin %',       value: pct(prof.netMarginPercent),        color: parseFloat(prof.netMarginPercent) >= 0 ? col.green : col.red },
        { label: 'Additional GST',     value: pFmtShort(prof.additionalGST),      color: col.blue },
      ]);
      y += 4;
      // GST detail box
      doc.setFillColor('#eff6ff'); doc.roundedRect(margin, y, W - margin * 2, 22, 2, 2, 'F');
      doc.setDrawColor('#bfdbfe'); doc.roundedRect(margin, y, W - margin * 2, 22, 2, 2, 'S');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.blue);
      doc.text('GST ANALYSIS', margin + 3, y + 6);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(col.dark); doc.setFontSize(8);
      doc.text(`Invoice GST Collected: ${pFmt(prof.invoiceGSTAmount)}`, margin + 3, y + 12);
      doc.text(`PO/Bill GST Paid: ${pFmt(prof.poGSTAmount)}`, margin + 3, y + 17);
      doc.text(`Net Additional GST: ${pFmt(prof.additionalGST)}`, 120, y + 12);
      const gstNote = parseFloat(prof.additionalGST) >= 0 ? 'GST surplus (collected more than paid)' : 'GST deficit (paid more than collected)';
      doc.setFontSize(7); doc.setTextColor(col.gray); doc.text(gstNote, 120, y + 17);
      y += 26;

      if ((prof.expenses || []).length > 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(col.dark);
        doc.text('Project Expenses', margin, y); y += 5;
        const expW = [25, 22, 35, 28, 35, 21];
        tableHead(['Code','Date','Category','Amount','Paid By','Status'], expW);
        (prof.expenses || []).forEach((r, i) => tableRow([
          r.expenseCode, r.tripDate, (r.category||'').substring(0,20), pFmt(r.amount), (r.paidBy||'').substring(0,20), r.status
        ], expW, i % 2 === 0));
      }

      // ── Page numbers ──
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(col.gray);
        doc.text(`${ov.projectName || 'Project Report'} | Page ${i} of ${pageCount} | Confidential`, margin, 293);
        doc.setDrawColor('#e2e8f0'); doc.setLineWidth(0.2); doc.line(margin, 290, W - margin, 290);
      }

      const projName = (ov.projectName || 'Report').replace(/[^a-zA-Z0-9_]/g, '_');
      doc.save(`Project_Report_${projName}.pdf`);
      showSuccess('PDF report downloaded!');
    } catch (err) {
      console.error(err);
      showError('PDF generation failed: ' + err.message);
    } finally { setLoading(false); }
  };

  // ─── Tab content renderers ─────────────────────────────────────────────────
  const renderOverview = () => {
    const ov = report?.overview || {};
    const bil = report?.billing || {};
    const proc = report?.procurement || {};
    const prof = report?.profitability || {};
    const billingData = [
      { label: 'Invoiced', value: parseFloat(bil.totalInvoiced)||0, color: '#2563eb' },
      { label: 'Received', value: parseFloat(bil.totalReceived)||0, color: '#059669' },
      { label: 'Pending',  value: parseFloat(bil.totalPending)||0,  color: '#f59e0b' },
    ];
    const procData = [
      { label: 'PO Value', value: parseFloat(proc.totalPOValue)||0,  color: '#7c3aed' },
      { label: 'Billed',   value: parseFloat(proc.totalBilled)||0,   color: '#ea580c' },
      { label: 'Paid',     value: parseFloat(proc.totalPaid)||0,     color: '#059669' },
      { label: 'Balance',  value: parseFloat(proc.totalBalance)||0,  color: '#dc2626' },
    ];
    const profitSegs = [
      { label: 'Revenue',      value: parseFloat(prof.totalRevenue)||0,     color: '#059669' },
      { label: 'Procurement',  value: parseFloat(prof.totalProcurement)||0, color: '#ea580c' },
      { label: 'Expenses',     value: parseFloat(prof.projectExpenses)||0,  color: '#dc2626' },
    ];
    return (
      <div className="pr-section">
        <div className="pr-kpi-row">
          <KPI label="Contract Value" value={fmtShort(ov.totalContractValue)} color="#2563eb" icon={<IndianRupee size={20}/>} />
          <KPI label="Total Received" value={fmtShort(ov.totalReceived)} color="#059669" icon={<CheckCircle size={20}/>} />
          <KPI label="Procurement" value={fmtShort(ov.totalProcurement)} color="#d97706" icon={<Package size={20}/>} />
          <KPI label="Projected Profit" value={fmtShort(ov.projectedProfit)} sub={pct(ov.profitMarginPercent) + ' margin'} color="#7c3aed" icon={<TrendingUp size={20}/>} />
        </div>
        <div className="pr-charts-row">
          <div className="pr-chart-card">
            <div className="pr-chart-title">Billing Overview</div>
            <BarChart data={billingData} />
            <div className="pr-chart-legend">
              {billingData.map(d => <span key={d.label} style={{color:d.color}}>■ {d.label}: {fmtShort(d.value)}</span>)}
            </div>
          </div>
          <div className="pr-chart-card">
            <div className="pr-chart-title">Procurement Overview</div>
            <BarChart data={procData} />
            <div className="pr-chart-legend">
              {procData.map(d => <span key={d.label} style={{color:d.color}}>■ {d.label}: {fmtShort(d.value)}</span>)}
            </div>
          </div>
          <div className="pr-chart-card pr-chart-card--donut">
            <div className="pr-chart-title">Cost Breakdown</div>
            <div className="pr-donut-wrap">
              <Donut segments={profitSegs} size={130} />
              <div className="pr-donut-legend">
                {profitSegs.map(s => (
                  <div key={s.label} className="pr-donut-item">
                    <span style={{background:s.color}} className="pr-donut-dot"/>
                    <span>{s.label}</span>
                    <span>{fmtShort(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="pr-info-grid">
          {[
            ['Project ID', ov.projectId], ['Status', ov.status],
            ['Location', ov.location], ['Group › Sub', `${ov.groupName||''}${ov.subGroupName?' › '+ov.subGroupName:''}`],
            ['Start Date', ov.startDate], ['End Date', ov.endDate],
            ['Budget', fmt(ov.budget)], ['Progress', pct(ov.progressPercentage)],
          ].map(([k, v]) => (
            <div key={k} className="pr-info-item">
              <span className="pr-info-key">{k}</span>
              <span className="pr-info-val">{v || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBilling = () => {
    const bil = report?.billing || {};
    return (
      <div className="pr-section">
        <div className="pr-kpi-row">
          <KPI label="Total Invoiced" value={fmtShort(bil.totalInvoiced)} color="#2563eb" icon={<FileText size={20}/>} />
          <KPI label="Total Received" value={fmtShort(bil.totalReceived)} color="#059669" icon={<CheckCircle size={20}/>} />
          <KPI label="Pending" value={fmtShort(bil.totalPending)} color="#d97706" icon={<Clock size={20}/>} />
          <KPI label="Advances" value={fmtShort(bil.totalAdvances)} color="#7c3aed" icon={<IndianRupee size={20}/>} />
        </div>
        <h3 className="pr-subtable-title">Invoices</h3>
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead><tr>
              <th>Invoice No</th><th>Date</th><th>Due Date</th><th>Customer</th>
              <th>Total</th><th>Paid</th><th>Balance</th><th>Status</th>
              <th>GST</th><th>Receipt No</th><th>Method</th>
            </tr></thead>
            <tbody>
              {(bil.invoices||[]).map((r,i) => (
                <tr key={i}>
                  <td className="pr-td-mono">{r.invoiceNo}</td>
                  <td>{r.invoiceDate}</td><td>{r.dueDate}</td>
                  <td>{r.customerName}</td>
                  <td className="pr-td-num">{fmt(r.totalAmount)}</td>
                  <td className="pr-td-num pr-green">{fmt(r.paidAmount)}</td>
                  <td className="pr-td-num pr-red">{fmt(r.balanceAmount)}</td>
                  <td><span className={`pr-badge pr-badge--${r.status?.toLowerCase()}`}>{r.status}</span></td>
                  <td className="pr-td-num">{fmt(r.taxAmount)}</td>
                  <td className="pr-td-mono">{r.receiptNo||'—'}</td>
                  <td>{r.paymentMethod||'—'}</td>
                </tr>
              ))}
              {(bil.invoices||[]).length === 0 && <tr><td colSpan={11} className="pr-empty">No invoices</td></tr>}
            </tbody>
          </table>
        </div>
        <h3 className="pr-subtable-title">Receipts / Payments Received</h3>
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead><tr>
              <th>Receipt No</th><th>Date</th><th>Type</th>
              <th>Amount</th><th>Applied</th><th>Unapplied</th>
              <th>Method</th><th>Ref</th><th>Invoice</th>
            </tr></thead>
            <tbody>
              {(bil.receipts||[]).map((r,i) => (
                <tr key={i}>
                  <td className="pr-td-mono">{r.receiptNo}</td>
                  <td>{r.receiptDate}</td>
                  <td><span className={`pr-badge pr-badge--${r.receiptType==='ADVANCE'?'advance':'invoice'}`}>{r.receiptType}</span></td>
                  <td className="pr-td-num">{fmt(r.amount)}</td>
                  <td className="pr-td-num pr-green">{fmt(r.appliedAmount)}</td>
                  <td className="pr-td-num pr-amber">{fmt(r.unappliedAmount)}</td>
                  <td>{r.paymentMethod}</td>
                  <td>{r.transactionReference||'—'}</td>
                  <td className="pr-td-mono">{r.linkedInvoiceNo||'—'}</td>
                </tr>
              ))}
              {(bil.receipts||[]).length === 0 && <tr><td colSpan={9} className="pr-empty">No receipts</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProcurement = () => {
    const proc = report?.procurement || {};
    return (
      <div className="pr-section">
        <div className="pr-kpi-row">
          <KPI label="Total PO Value" value={fmtShort(proc.totalPOValue)} color="#2563eb" icon={<Package size={20}/>} />
          <KPI label="Total Billed" value={fmtShort(proc.totalBilled)} color="#d97706" icon={<FileText size={20}/>} />
          <KPI label="Total Paid" value={fmtShort(proc.totalPaid)} color="#059669" icon={<CheckCircle size={20}/>} />
          <KPI label="Balance Due" value={fmtShort(proc.totalBalance)} color="#dc2626" icon={<AlertCircle size={20}/>} />
        </div>
        <h3 className="pr-subtable-title">Purchase Orders</h3>
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead><tr>
              <th>PO No</th><th>Date</th><th>Vendor</th><th>Value</th>
              <th>Payment</th><th>Status</th><th>Ordered</th><th>Delivered</th>
            </tr></thead>
            <tbody>
              {(proc.purchaseOrders||[]).map((r,i) => (
                <tr key={i}>
                  <td className="pr-td-mono">{r.poNo}</td>
                  <td>{r.orderDate}</td><td>{r.vendorName}</td>
                  <td className="pr-td-num">{fmt(r.totalValue)}</td>
                  <td><span className={`pr-badge pr-badge--${r.paymentStatus?.toLowerCase().replace(/\s/g,'-')}`}>{r.paymentStatus}</span></td>
                  <td><span className={`pr-badge pr-badge--${r.status?.toLowerCase()}`}>{r.status}</span></td>
                  <td className="pr-td-num">{r.totalItems}</td>
                  <td className="pr-td-num pr-green">{r.deliveredItems}</td>
                </tr>
              ))}
              {(proc.purchaseOrders||[]).length === 0 && <tr><td colSpan={8} className="pr-empty">No purchase orders</td></tr>}
            </tbody>
          </table>
        </div>
        <h3 className="pr-subtable-title">Bills Received</h3>
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead><tr>
              <th>Bill No</th><th>Date</th><th>Due Date</th><th>Vendor</th>
              <th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>PO Ref</th><th>GST</th>
            </tr></thead>
            <tbody>
              {(proc.bills||[]).map((r,i) => (
                <tr key={i}>
                  <td className="pr-td-mono">{r.billNo}</td>
                  <td>{r.billDate}</td><td>{r.dueDate}</td><td>{r.vendorName}</td>
                  <td className="pr-td-num">{fmt(r.totalAmount)}</td>
                  <td className="pr-td-num pr-green">{fmt(r.paidAmount)}</td>
                  <td className="pr-td-num pr-red">{fmt(r.balanceAmount)}</td>
                  <td><span className={`pr-badge pr-badge--${r.status?.toLowerCase()}`}>{r.status}</span></td>
                  <td className="pr-td-mono">{r.linkedPONo||'—'}</td>
                  <td className="pr-td-num">{fmt(r.taxAmount)}</td>
                </tr>
              ))}
              {(proc.bills||[]).length === 0 && <tr><td colSpan={10} className="pr-empty">No bills</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProfitability = () => {
    const prof = report?.profitability || {};
    const isProfit = parseFloat(prof.netProfit) >= 0;
    return (
      <div className="pr-section">
        <div className="pr-kpi-row">
          <KPI label="Total Revenue" value={fmtShort(prof.totalRevenue)} color="#059669" icon={<TrendingUp size={20}/>} />
          <KPI label="Gross Profit" value={fmtShort(prof.grossProfit)} sub={pct(prof.grossMarginPercent)} color="#059669" icon={<BarChart2 size={20}/>} />
          <KPI label="Net Profit" value={fmtShort(prof.netProfit)} sub={pct(prof.netMarginPercent)} color={isProfit?'#059669':'#dc2626'} icon={<IndianRupee size={20}/>} />
          <KPI label="Project Expenses" value={fmtShort(prof.projectExpenses)} color="#dc2626" icon={<AlertCircle size={20}/>} />
        </div>
        <div className="pr-profit-breakdown">
          <div className="pr-breakdown-row">
            <span>Total Revenue (Invoiced)</span><span className="pr-green">{fmt(prof.totalRevenue)}</span>
          </div>
          <div className="pr-breakdown-row pr-breakdown-sub">
            <span>− Procurement (Bills)</span><span className="pr-red">−{fmt(prof.totalProcurement)}</span>
          </div>
          <div className="pr-breakdown-row pr-breakdown-result">
            <span>= Gross Profit</span><span>{fmt(prof.grossProfit)}</span>
          </div>
          <div className="pr-breakdown-row pr-breakdown-sub">
            <span>− Project Expenses</span><span className="pr-red">−{fmt(prof.projectExpenses)}</span>
          </div>
          <div className={`pr-breakdown-row pr-breakdown-final ${isProfit?'pr-profit':'pr-loss'}`}>
            <span>= Net Profit</span><span>{fmt(prof.netProfit)} ({pct(prof.netMarginPercent)})</span>
          </div>
        </div>
        <div className="pr-gst-box">
          <div className="pr-gst-title">GST Analysis (Additional GST = Invoice GST − PO GST)</div>
          <div className="pr-gst-row">
            <div><span>Invoice GST Collected</span><strong>{fmt(prof.invoiceGSTAmount)}</strong></div>
            <div><span>PO/Bill GST Paid</span><strong>{fmt(prof.poGSTAmount)}</strong></div>
            <div><span>Net Additional GST</span><strong className={parseFloat(prof.additionalGST)>=0?'pr-green':'pr-red'}>{fmt(prof.additionalGST)}</strong></div>
          </div>
        </div>
        {(prof.expenses||[]).length > 0 && (
          <>
            <h3 className="pr-subtable-title">Project Expenses</h3>
            <div className="pr-table-wrap">
              <table className="pr-table">
                <thead><tr><th>Code</th><th>Date</th><th>Category</th><th>Amount</th><th>Paid By</th><th>Status</th></tr></thead>
                <tbody>
                  {(prof.expenses||[]).map((r,i) => (
                    <tr key={i}>
                      <td className="pr-td-mono">{r.expenseCode}</td>
                      <td>{r.tripDate}</td><td>{r.category}</td>
                      <td className="pr-td-num">{fmt(r.amount)}</td>
                      <td>{r.paidBy}</td>
                      <td><span className={`pr-badge pr-badge--${r.status?.toLowerCase()}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  const TABS = [
    { id: 'overview',       label: 'Overview',        icon: <Eye size={15}/> },
    { id: 'billing',        label: 'Billing & Receipts', icon: <FileText size={15}/> },
    { id: 'procurement',    label: 'Procurement',      icon: <Package size={15}/> },
    { id: 'profitability',  label: 'Profitability',    icon: <TrendingUp size={15}/> },
  ];

  return (
    <div className="pr-container">
      {loading && <CrmPreloader text="Generating report..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="pr-header">
        <div>
          <div className="pr-breadcrumb">Dashboard › Reports</div>
          <h1 className="pr-title"><BarChart2 size={26} /> Project Reports</h1>
          <p className="pr-subtitle">Generate comprehensive project reports with financial analytics</p>
        </div>
      </div>

      {/* Project Selector */}
      <div className="pr-selector-card">
        <div className="pr-selector-title">Select Project</div>
        <div className="pr-selector-row">
          <div className="pr-selector-group">
            <label>Group *</label>
            <select value={selGroup} onChange={e => handleGroupChange(e.target.value)} disabled={dropLoading.g}>
              <option value="">{dropLoading.g ? 'Loading...' : 'Select Group'}</option>
              {groups.map((g, i) => <option key={g.value || i} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div className="pr-selector-group">
            <label>Sub Group</label>
            <select value={selSubGroup} onChange={e => handleSubGroupChange(e.target.value)} disabled={!selGroup || dropLoading.sg}>
              <option value="">{dropLoading.sg ? 'Loading...' : 'Select Sub Group'}</option>
              {subGroups.map((s, i) => <option key={s.value || i} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="pr-selector-group">
            <label>Project *</label>
            <select value={selProject} onChange={e => setSelProject(e.target.value)} disabled={!selSubGroup || dropLoading.p}>
              <option value="">{dropLoading.p ? 'Loading...' : 'Select Project'}</option>
              {projects.map((p, i) => <option key={p.id || i} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="pr-btn-generate" onClick={fetchReport} disabled={!selProject || loading}>
            <RefreshCw size={15} /> Generate Report
          </button>
        </div>
      </div>

      {/* Report area */}
      {report ? (
        <div className="pr-report">
          {/* Report header bar */}
          <div className="pr-report-header">
            <div>
              <div className="pr-report-project">{report.overview?.projectName}</div>
              <div className="pr-report-meta">{report.overview?.projectId} · {report.overview?.location} · Generated {report.generatedAt}</div>
            </div>
            <div className="pr-download-row">
              <button className="pr-btn-excel" onClick={exportExcel}>
                <FileSpreadsheet size={16} /> Download Excel
              </button>
              <button className="pr-btn-pdf" onClick={exportPDF}>
                <Download size={16} /> Download PDF
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="pr-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`pr-tab ${activeTab === t.id ? 'pr-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="pr-tab-content">
            {activeTab === 'overview'      && renderOverview()}
            {activeTab === 'billing'       && renderBilling()}
            {activeTab === 'procurement'   && renderProcurement()}
            {activeTab === 'profitability' && renderProfitability()}
          </div>
        </div>
      ) : (
        !loading && (
          <div className="pr-empty-state">
            <BarChart2 size={56} strokeWidth={1} />
            <h3>No report generated yet</h3>
            <p>Select a Group, Sub Group, and Project above, then click <strong>Generate Report</strong></p>
          </div>
        )
      )}
    </div>
  );
}