import React, { useState, useEffect } from 'react';
import {
  FileText, Download, BarChart2, TrendingUp, Package,
  IndianRupee, RefreshCw, Eye, FileSpreadsheet,
  CheckCircle, AlertCircle, Clock
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

  // ─── PDF Export — renders to canvas pages → assembles real PDF → direct download ──
  const exportPDF = async () => {
    if (!report) return;
    setLoading(true);
    try {
      const ov   = report.overview      || {};
      const bil  = report.billing       || {};
      const proc = report.procurement   || {};
      const prof = report.profitability || {};
      const vn   = n => parseFloat(n) || 0;
      const isP  = vn(prof.netProfit) >= 0;
      const projName = (ov.projectName || 'Report').replace(/[^a-zA-Z0-9_\- ]/g, '');

      // ── 1. Build full HTML report page ────────────────────────────────────
      const stC = { PLANNING:'#3b82f6', ACTIVE:'#059669', COMPLETED:'#0d9488', ON_HOLD:'#d97706', CANCELLED:'#dc2626' };
      const sc  = stC[ov.status] || '#64748b';

      // Canvas bar chart helper
      const barChart = (bars, W=500, H=190) => {
        const cv = document.createElement('canvas');
        cv.width = W*2; cv.height = H*2;
        const ctx = cv.getContext('2d'); ctx.scale(2,2);
        const max = Math.max(...bars.map(b => vn(b.value)), 1);
        const pL=10, pR=10, pT=30, pB=38;
        const cW=W-pL-pR, cH=H-pT-pB, bw=cW/bars.length;
        // Grid lines
        [0.25,0.5,0.75,1].forEach(t => {
          ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=0.5;
          ctx.beginPath(); ctx.moveTo(pL, pT+cH*(1-t)); ctx.lineTo(pL+cW, pT+cH*(1-t)); ctx.stroke();
        });
        bars.forEach((b, i) => {
          const bh = Math.max((vn(b.value)/max)*cH, 3);
          const x  = pL + i*bw + bw*0.1, bW = bw*0.8;
          const g  = ctx.createLinearGradient(x, pT+cH-bh, x, pT+cH);
          g.addColorStop(0, b.color); g.addColorStop(1, b.color+'bb');
          ctx.fillStyle = g;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, pT+cH-bh, bW, bh, [3,3,0,0]);
          else ctx.rect(x, pT+cH-bh, bW, bh);
          ctx.fill();
          ctx.fillStyle = b.color; ctx.font = 'bold 9px system-ui'; ctx.textAlign='center';
          ctx.fillText(pFmtShort(b.value), x+bW/2, pT+cH-bh-4);
          ctx.fillStyle = '#6b7280'; ctx.font = '9px system-ui';
          ctx.fillText(b.label.substring(0,10), x+bW/2, H-9);
        });
        return cv.toDataURL('image/jpeg', 0.92);
      };

      const donutChart = (segs, size=180) => {
        const cv = document.createElement('canvas');
        cv.width = size*2; cv.height = size*2;
        const ctx = cv.getContext('2d'); ctx.scale(2,2);
        ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,size,size);
        const cx=size/2, cy=size/2, r=size*0.42, total=segs.reduce((s,d)=>s+vn(d.value),0)||1;
        let angle=-Math.PI/2;
        segs.forEach(seg => {
          const sweep=(vn(seg.value)/total)*Math.PI*2;
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,angle,angle+sweep); ctx.closePath();
          ctx.fillStyle=seg.color; ctx.fill();
          ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
          angle+=sweep;
        });
        ctx.beginPath(); ctx.arc(cx,cy,r*0.52,0,Math.PI*2);
        ctx.fillStyle='#f8fafc'; ctx.fill();
        ctx.fillStyle='#1e293b'; ctx.font='bold 13px system-ui'; ctx.textAlign='center';
        ctx.fillText(pFmtShort(total), cx, cy+3);
        ctx.font='9px system-ui'; ctx.fillStyle='#6b7280';
        ctx.fillText('Total', cx, cy+15);
        return cv.toDataURL('image/jpeg', 0.92);
      };

      const bilBars=[{label:'Invoiced',value:vn(bil.totalInvoiced),color:'#2563eb'},{label:'Received',value:vn(bil.totalReceived),color:'#059669'},{label:'Pending',value:vn(bil.totalPending),color:'#d97706'},{label:'Advances',value:vn(bil.totalAdvances),color:'#7c3aed'}];
      const prBars=[{label:'PO Value',value:vn(proc.totalPOValue),color:'#1e3a8a'},{label:'Billed',value:vn(proc.totalBilled),color:'#d97706'},{label:'Paid',value:vn(proc.totalPaid),color:'#059669'},{label:'Balance',value:vn(proc.totalBalance),color:'#dc2626'}];
      const plBars=[{label:'Revenue',value:Math.abs(vn(prof.totalRevenue)),color:'#059669'},{label:'Procure.',value:Math.abs(vn(prof.totalProcurement)),color:'#d97706'},{label:'Expenses',value:Math.abs(vn(prof.projectExpenses)),color:'#f43f5e'},{label:isP?'Profit':'Loss',value:Math.abs(vn(prof.netProfit)),color:isP?'#0d9488':'#dc2626'}];
      const costSegs=[{label:'Revenue',value:vn(prof.totalRevenue),color:'#059669'},{label:'Procurement',value:vn(prof.totalProcurement),color:'#d97706'},{label:'Expenses',value:vn(prof.projectExpenses),color:'#f43f5e'}].filter(s=>s.value>0);

      const imgBil  = barChart(bilBars);
      const imgPr   = barChart(prBars);
      const imgPL   = barChart(plBars);
      const imgDnut = donutChart(costSegs.length ? costSegs : [{label:'N/A',value:1,color:'#e2e8f0'}]);

      // Conclusions
      const bPct=vn(bil.totalInvoiced)>0?(vn(bil.totalReceived)/vn(bil.totalInvoiced)*100).toFixed(1):'0.0';
      const pPct=vn(proc.totalBilled) >0?(vn(proc.totalPaid)/vn(proc.totalBilled)*100).toFixed(1):'0.0';
      const findings=[
        parseFloat(bPct)>=90?{tag:'BILLING',c:'#059669',bg:'#f0fdf4',t:`Excellent collection rate of ${bPct}% — receivables well managed.`}:parseFloat(bPct)>=60?{tag:'BILLING',c:'#d97706',bg:'#fffbeb',t:`Collection rate ${bPct}%. ${pFmtShort(bil.totalPending)} outstanding from client.`}:{tag:'BILLING',c:'#dc2626',bg:'#fef2f2',t:`Low collection rate of ${bPct}%. ${pFmtShort(bil.totalPending)} requires immediate follow-up.`},
        parseFloat(pPct)>=90?{tag:'PAYMENTS',c:'#059669',bg:'#f0fdf4',t:`Vendor payments ${pPct}% complete — obligations nearly fully discharged.`}:{tag:'PAYMENTS',c:'#d97706',bg:'#fffbeb',t:`${pPct}% of vendor bills paid. ${pFmtShort(proc.totalBalance)} outstanding to suppliers.`},
        isP?{tag:'PROFIT',c:'#059669',bg:'#f0fdf4',t:`Profitable — net margin ${pct(prof.netMarginPercent)}, net profit ${pFmtShort(prof.netProfit)}.`}:{tag:'PROFIT',c:'#dc2626',bg:'#fef2f2',t:`Loss of ${pFmtShort(prof.netProfit)} (${pct(prof.netMarginPercent)} margin). Costs exceed revenue.`},
        vn(prof.additionalGST)>=0?{tag:'GST',c:'#2563eb',bg:'#eff6ff',t:`GST surplus ${pFmtShort(prof.additionalGST)} — collected more from client than paid to vendors.`}:{tag:'GST',c:'#d97706',bg:'#fffbeb',t:`GST deficit ${pFmtShort(Math.abs(vn(prof.additionalGST)))} — eligible for Input Tax Credit (ITC).`},
      ];
      const recs=[];
      if(parseFloat(bPct)<80) recs.push(`Follow up on ${pFmtShort(bil.totalPending)} pending from client to improve cash flow.`);
      if(parseFloat(pPct)<80) recs.push(`Clear ${pFmtShort(proc.totalBalance)} in outstanding vendor dues.`);
      if(!isP) recs.push('Review procurement costs — renegotiate vendor rates or apply value engineering.');
      if(vn(prof.additionalGST)<0) recs.push('File for Input Tax Credit (ITC) to recover excess GST paid to vendors.');
      if(recs.length===0) recs.push('Maintain current performance — continue timely invoicing and vendor payment discipline.');

      const sb=(s='')=>`<span class="b b-${(s||'').toLowerCase().replace(/\s+/g,'-')}">${s||'—'}</span>`;
      const leg=(bars)=>bars.map(b=>`<div class="li"><span class="ld" style="background:${b.color}"></span>${b.label}: <b>${pFmtShort(b.value)}</b></div>`).join('');

      // ── 2. Build HTML ─────────────────────────────────────────────────────
      const HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>${projName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
@page{size:A4 portrait;margin:10mm 12mm}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'Poppins',system-ui,sans-serif;font-size:9pt;color:#1e293b;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{page-break-before:always;height:0;display:block}
.r{text-align:right} .g{color:#059669;font-weight:600} .rd{color:#dc2626;font-weight:600} .am{color:#d97706;font-weight:600}
/* Cover */
.cover{background:linear-gradient(140deg,#0f2554 0%,#1e3a8a 45%,#1d4ed8 100%);padding:44px 44px 36px;color:#fff;position:relative;overflow:hidden}
.cover::after{content:'';position:absolute;right:-50px;top:-50px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.05)}
.eye{font-size:7pt;font-weight:600;letter-spacing:.14em;color:#93c5fd;text-transform:uppercase;margin-bottom:14px}
.ctit{font-size:30pt;font-weight:800;line-height:1.0;letter-spacing:-1px}
.cbar{width:52px;height:3px;background:#f59e0b;border-radius:2px;margin:14px 0}
.cproj{font-size:13pt;font-weight:500;color:#bfdbfe;margin-bottom:5px;word-break:break-word;max-width:480px}
.cmeta{font-size:8pt;color:#64748b;margin-top:5px}
.pill{display:inline-block;background:${sc};color:#fff;font-size:7pt;font-weight:700;padding:3px 12px;border-radius:99px;letter-spacing:.05em;text-transform:uppercase;margin:8px 0 3px}
/* Snapshot */
.snap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 44px 0}
.sc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:13px 15px;border-top:3px solid}
.sl{font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.sv{font-size:15pt;font-weight:700;line-height:1.1;word-break:break-all}
.ss{font-size:7.5pt;color:#9ca3af;margin-top:4px}
/* Info */
.info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 20px;padding:14px 44px;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:2px solid #e2e8f0;margin-top:16px}
.il{font-size:7pt;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.iv{font-size:9.5pt;font-weight:600;color:#1e293b;word-break:break-word}
/* Section header */
.sh{display:flex;align-items:center;gap:8px;padding:9px 44px;font-size:9pt;font-weight:700;color:#fff;letter-spacing:.04em;text-transform:uppercase}
/* Section body */
.sb{padding:0 44px 20px}
/* KPI */
.kg{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0 8px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;border-top:3px solid}
.kl{font-size:7pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.kv{font-size:13pt;font-weight:700;line-height:1.1;word-break:break-all}
/* Charts */
.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 44px 0}
.cc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.ct{font-size:9pt;font-weight:700;color:#1e293b;margin-bottom:2px}
.cs{font-size:7.5pt;color:#6b7280;margin-bottom:8px}
.ci{width:100%;height:auto;display:block}
.leg{display:flex;flex-wrap:wrap;gap:5px 12px;margin-top:8px}
.li{display:flex;align-items:center;gap:5px;font-size:8pt;color:#374151}
.ld{width:9px;height:9px;border-radius:2px;flex-shrink:0;display:inline-block}
.drow{display:flex;align-items:center;gap:14px}
.dleg{display:flex;flex-direction:column;gap:7px}
/* Tables */
.stl{font-size:10pt;font-weight:700;color:#1e293b;margin:16px 0 7px;padding-bottom:5px;border-bottom:2px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:8pt}
thead tr{background:#1e293b}
th{color:#fff;padding:7px 8px;text-align:left;font-size:7.5pt;font-weight:600;white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:#f8fafc}
/* Badges */
.b{display:inline-block;padding:2px 8px;border-radius:99px;font-size:7pt;font-weight:600;white-space:nowrap}
.b-paid,.b-approved,.b-completed,.b-active,.b-delivered{background:#dcfce7;color:#166534}
.b-pending{background:#fef3c7;color:#92400e}
.b-partially-paid,.b-partially-delivered{background:#fed7aa;color:#9a3412}
.b-overdue,.b-cancelled{background:#fee2e2;color:#991b1b}
.b-advance{background:#ede9fe;color:#5b21b6}
.b-invoice_payment{background:#dbeafe;color:#1e40af}
/* P&L */
.plb{border:1px solid #bbf7d0;border-left:4px solid #059669;background:#f0fdf4;border-radius:8px;padding:14px 18px;margin:12px 0}
.pr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:9pt;border-bottom:1px dashed #d1fae5}
.pr:last-child{border-bottom:none}
.pi{padding-left:16px;font-size:8.5pt;color:#475569}
.prs{font-weight:700;font-size:9.5pt;background:#eff6ff;padding:6px 10px;border-radius:5px;margin:2px -10px}
.prt{font-weight:800;font-size:10.5pt;padding:7px 10px;border-radius:5px;margin:2px -10px}
.pp{background:#dcfce7;color:#166534} .pl2{background:#fee2e2;color:#991b1b}
/* GST */
.gb{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:12px 0}
.gt{font-size:7.5pt;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
.gg{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.gl{font-size:7.5pt;color:#6b7280;font-weight:500;margin-bottom:3px}
.gv{font-size:13pt;font-weight:700}
/* Conclusion */
.cp{background:#0f172a;padding:40px 44px;min-height:300px}
.ce{font-size:7.5pt;font-weight:600;letter-spacing:.14em;color:#475569;text-transform:uppercase;margin-bottom:10px}
.ctt{font-size:22pt;font-weight:800;line-height:1.05;color:#fff;margin-bottom:3px}
.cd{width:46px;height:3px;background:#f59e0b;border-radius:2px;margin:12px 0 4px}
.cp2{font-size:9pt;color:#475569;margin-bottom:22px}
.cs2{font-size:7.5pt;font-weight:700;color:#475569;letter-spacing:.1em;text-transform:uppercase;margin:18px 0 8px}
.fi{display:flex;gap:9px;align-items:flex-start;padding:10px 13px;border-radius:7px;margin-bottom:7px;border-left:4px solid}
.ft{font-size:7.5pt;font-weight:700;color:#fff;padding:2px 8px;border-radius:99px;white-space:nowrap;flex-shrink:0;margin-top:1px}
.fx{font-size:9pt;color:#1e293b;line-height:1.5}
.ri{display:flex;gap:9px;align-items:flex-start;padding:9px 13px;background:#f0fdfa;border-left:4px solid #0d9488;border-radius:7px;margin-bottom:7px}
.ra{color:#0d9488;font-size:14pt;font-weight:700;margin-top:-2px;flex-shrink:0}
.rx{font-size:9pt;color:#1e293b;line-height:1.5}
/* Footer */
.ft2{background:#0f172a;border-top:2px solid #0d9488;padding:10px 44px;text-align:center;font-size:8pt;color:#475569}
.ft2 strong{color:#fff;font-weight:600}
</style></head><body>

<div class="cover">
  <div class="eye">Confidential · Financial Report</div>
  <div class="ctit">PROJECT<br>REPORT</div>
  <div class="cbar"></div>
  <div class="cproj">${ov.projectName||'—'}</div>
  <div class="pill">${ov.status||'UNKNOWN'}</div>
  <div class="cmeta">${ov.projectId||''} · ${ov.location||''} · Generated ${report.generatedAt||''}</div>
</div>
<div class="snap">
  <div class="sc" style="border-top-color:#2563eb"><div class="sl">Contract Value</div><div class="sv" style="color:#2563eb">${fmtShort(ov.totalContractValue)}</div><div class="ss">Total invoiced</div></div>
  <div class="sc" style="border-top-color:#059669"><div class="sl">Amount Received</div><div class="sv" style="color:#059669">${fmtShort(ov.totalReceived)}</div><div class="ss">Payments collected</div></div>
  <div class="sc" style="border-top-color:#d97706"><div class="sl">Procurement</div><div class="sv" style="color:#d97706">${fmtShort(ov.totalProcurement)}</div><div class="ss">Total bills</div></div>
  <div class="sc" style="border-top-color:${isP?'#059669':'#dc2626'}"><div class="sl">Net Profit/Loss</div><div class="sv" style="color:${isP?'#059669':'#dc2626'}">${fmtShort(prof.netProfit)}</div><div class="ss">${pct(prof.netMarginPercent)} margin</div></div>
</div>
<div class="info">
  ${[['Project ID',ov.projectId],['Group',ov.groupName],['Sub Group',ov.subGroupName],['Start Date',ov.startDate],['End Date',ov.endDate],['Budget',fmt(ov.budget)],['Status',ov.status],['Location',ov.location],['Progress',pct(ov.progressPercentage)]].map(([l,val])=>`<div><div class="il">${l}</div><div class="iv">${val||'—'}</div></div>`).join('')}
</div>

<div class="pg"></div>
<div class="sh" style="background:#1e40af">📊 Financial Analytics</div>
<div class="cg">
  <div class="cc"><div class="ct">Billing Overview</div><div class="cs">Invoice vs Receipt comparison</div><img src="${imgBil}" class="ci"/><div class="leg">${leg(bilBars)}</div></div>
  <div class="cc"><div class="ct">Procurement Overview</div><div class="cs">PO vs Bills vs Payments</div><img src="${imgPr}" class="ci"/><div class="leg">${leg(prBars)}</div></div>
  <div class="cc"><div class="ct">Cost Breakdown</div><div class="cs">Revenue vs Costs</div><div class="drow"><img src="${imgDnut}" style="width:100px;height:100px;flex-shrink:0"/><div class="dleg">${costSegs.map(s=>`<div class="li"><span class="ld" style="background:${s.color}"></span>${s.label}<b style="margin-left:4px">${fmtShort(s.value)}</b></div>`).join('')}</div></div></div>
  <div class="cc"><div class="ct">Profit & Loss</div><div class="cs">Revenue / Cost / Net</div><img src="${imgPL}" class="ci"/><div class="leg">${leg(plBars)}</div></div>
</div>

<div class="pg"></div>
<div class="sh" style="background:#065f46">🧾 Billing Status</div>
<div class="sb">
  <div class="kg">
    <div class="kpi" style="border-top-color:#2563eb"><div class="kl">Total Invoiced</div><div class="kv" style="color:#2563eb">${fmtShort(bil.totalInvoiced)}</div></div>
    <div class="kpi" style="border-top-color:#059669"><div class="kl">Total Received</div><div class="kv" style="color:#059669">${fmtShort(bil.totalReceived)}</div></div>
    <div class="kpi" style="border-top-color:#d97706"><div class="kl">Pending</div><div class="kv" style="color:#d97706">${fmtShort(bil.totalPending)}</div></div>
    <div class="kpi" style="border-top-color:#7c3aed"><div class="kl">Advances</div><div class="kv" style="color:#7c3aed">${fmtShort(bil.totalAdvances)}</div></div>
  </div>
  <div class="stl">Invoice Details</div>
  <table><thead><tr><th>Invoice No</th><th>Date</th><th>Due Date</th><th>Customer</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th><th>Status</th></tr></thead>
  <tbody>${(bil.invoices||[]).map(r=>`<tr><td>${r.invoiceNo||'—'}</td><td>${r.invoiceDate||'—'}</td><td>${r.dueDate||'—'}</td><td>${r.customerName||'—'}</td><td class="r g">${fmt(r.totalAmount)}</td><td class="r">${fmt(r.paidAmount)}</td><td class="r ${vn(r.balanceAmount)>0?'rd':''}">${fmt(r.balanceAmount)}</td><td>${sb(r.status)}</td></tr>`).join('')}</tbody></table>
  <div class="stl">Receipts</div>
  <table><thead><tr><th>Receipt No</th><th>Date</th><th>Type</th><th class="r">Amount</th><th class="r">Applied</th><th class="r">Unapplied</th><th>Method</th><th>Invoice Ref</th></tr></thead>
  <tbody>${(bil.receipts||[]).map(r=>`<tr><td>${r.receiptNo||'—'}</td><td>${r.receiptDate||'—'}</td><td><span class="b ${r.receiptType==='ADVANCE'?'b-advance':'b-invoice_payment'}">${r.receiptType}</span></td><td class="r g">${fmt(r.amount)}</td><td class="r">${fmt(r.appliedAmount)}</td><td class="r">${fmt(r.unappliedAmount)}</td><td>${r.paymentMethod||'—'}</td><td>${r.linkedInvoiceNo||'—'}</td></tr>`).join('')}</tbody></table>
</div>

<div class="pg"></div>
<div class="sh" style="background:#7c2d12">📦 Procurement Status</div>
<div class="sb">
  <div class="kg">
    <div class="kpi" style="border-top-color:#1e3a8a"><div class="kl">Total PO Value</div><div class="kv" style="color:#1e3a8a">${fmtShort(proc.totalPOValue)}</div></div>
    <div class="kpi" style="border-top-color:#d97706"><div class="kl">Total Billed</div><div class="kv" style="color:#d97706">${fmtShort(proc.totalBilled)}</div></div>
    <div class="kpi" style="border-top-color:#059669"><div class="kl">Total Paid</div><div class="kv" style="color:#059669">${fmtShort(proc.totalPaid)}</div></div>
    <div class="kpi" style="border-top-color:#dc2626"><div class="kl">Balance Due</div><div class="kv" style="color:#dc2626">${fmtShort(proc.totalBalance)}</div></div>
  </div>
  <div class="stl">Purchase Orders</div>
  <table><thead><tr><th>PO No</th><th>Date</th><th>Vendor</th><th class="r">Value</th><th>Payment</th><th>Status</th><th class="r">Ordered</th><th class="r">Delivered</th></tr></thead>
  <tbody>${(proc.purchaseOrders||[]).map(r=>`<tr><td>${r.poNo||'—'}</td><td>${r.orderDate||'—'}</td><td>${r.vendorName||'—'}</td><td class="r g">${fmt(r.totalValue)}</td><td>${r.paymentStatus||'—'}</td><td>${sb(r.status)}</td><td class="r">${r.totalItems||0}</td><td class="r">${r.deliveredItems||0}</td></tr>`).join('')}</tbody></table>
  <div class="stl">Bills Received</div>
  <table><thead><tr><th>Bill No</th><th>Date</th><th>Due Date</th><th>Vendor</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th><th>Status</th></tr></thead>
  <tbody>${(proc.bills||[]).map(r=>`<tr><td>${r.billNo||'—'}</td><td>${r.billDate||'—'}</td><td>${r.dueDate||'—'}</td><td>${r.vendorName||'—'}</td><td class="r">${fmt(r.totalAmount)}</td><td class="r g">${fmt(r.paidAmount)}</td><td class="r ${vn(r.balanceAmount)>0?'rd':''}">${fmt(r.balanceAmount)}</td><td>${sb(r.status)}</td></tr>`).join('')}</tbody></table>
</div>

<div class="pg"></div>
<div class="sh" style="background:#4a1d96">📈 Profitability Analysis</div>
<div class="sb">
  <div class="kg">
    <div class="kpi" style="border-top-color:#059669"><div class="kl">Total Revenue</div><div class="kv" style="color:#059669">${fmtShort(prof.totalRevenue)}</div></div>
    <div class="kpi" style="border-top-color:${vn(prof.grossProfit)>=0?'#059669':'#dc2626'}"><div class="kl">Gross Profit</div><div class="kv" style="color:${vn(prof.grossProfit)>=0?'#059669':'#dc2626'}">${fmtShort(prof.grossProfit)}</div></div>
    <div class="kpi" style="border-top-color:${isP?'#059669':'#dc2626'}"><div class="kl">Net Profit</div><div class="kv" style="color:${isP?'#059669':'#dc2626'}">${fmtShort(prof.netProfit)}</div></div>
    <div class="kpi" style="border-top-color:#dc2626"><div class="kl">Project Expenses</div><div class="kv" style="color:#dc2626">${fmtShort(prof.projectExpenses)}</div></div>
  </div>
  <div class="plb">
    <div class="pr"><span>Total Revenue (Invoiced)</span><span class="g">${fmt(prof.totalRevenue)}</span></div>
    <div class="pr pi"><span>− Procurement Cost (Bills)</span><span class="rd">− ${fmt(prof.totalProcurement)}</span></div>
    <div class="pr prs"><span>= Gross Profit</span><span>${fmt(prof.grossProfit)} <small style="font-weight:400;color:#6b7280">(${pct(prof.grossMarginPercent)})</small></span></div>
    <div class="pr pi"><span>− Project Expenses</span><span class="rd">− ${fmt(prof.projectExpenses)}</span></div>
    <div class="pr prt ${isP?'pp':'pl2'}"><span>= Net Profit / (Loss)</span><span>${fmt(prof.netProfit)} <small>(${pct(prof.netMarginPercent)})</small></span></div>
  </div>
  <div class="gb">
    <div class="gt">GST Analysis — Invoice GST Collected − PO/Bill GST Paid = Net Additional GST</div>
    <div class="gg">
      <div><div class="gl">Invoice GST Collected</div><div class="gv g">${fmt(prof.invoiceGSTAmount)}</div></div>
      <div><div class="gl">PO / Bill GST Paid</div><div class="gv am">${fmt(prof.poGSTAmount)}</div></div>
      <div><div class="gl">Net Additional GST</div><div class="gv ${vn(prof.additionalGST)>=0?'g':'rd'}">${fmt(prof.additionalGST)}</div></div>
    </div>
  </div>
  ${(prof.expenses||[]).length>0?`<div class="stl">Project Expenses</div><table><thead><tr><th>Code</th><th>Date</th><th>Category</th><th class="r">Amount</th><th>Paid By</th><th>Status</th></tr></thead><tbody>${(prof.expenses||[]).map(r=>`<tr><td>${r.expenseCode||'—'}</td><td>${r.tripDate||'—'}</td><td>${r.category||'—'}</td><td class="r">${fmt(r.amount)}</td><td>${r.paidBy||'—'}</td><td>${sb(r.status)}</td></tr>`).join('')}</tbody></table>`:''}
</div>

<div class="pg"></div>
<div class="cp">
  <div class="ce">Final Assessment</div>
  <div class="ctt">Conclusion &<br>Recommendations</div>
  <div class="cd"></div>
  <div class="cp2">${ov.projectName||''} · ${report.generatedAt||''}</div>
  <div class="cs2">Key Findings</div>
  ${findings.map(f=>`<div class="fi" style="background:${f.bg};border-left-color:${f.c}"><span class="ft" style="background:${f.c}">${f.tag}</span><span class="fx">${f.t}</span></div>`).join('')}
  <div class="cs2">Recommendations</div>
  ${recs.map(r=>`<div class="ri"><span class="ra">→</span><span class="rx">${r}</span></div>`).join('')}
</div>
<div class="ft2"><strong>ISTL GROUP CRM</strong> · Auto-generated for internal use · All figures based on recorded transactions</div>
</body></html>`;

      // ── 3. Direct download as .html (opens with system default — browser prints to PDF) ──
      // For TRUE direct PDF: inject into iframe, auto-print silently
      const blob = new Blob([HTML], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);

      // Create hidden iframe — write HTML — wait for load — call print() — cleanup
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;border:none;background:#fff';
      document.body.appendChild(frame);

      frame.onload = () => {
        setTimeout(() => {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          // Hide frame after print dialog opens
          setTimeout(() => {
            frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
            setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 30000);
          }, 1000);
        }, 800);
      };

      frame.src = url;
      showSuccess('Preparing PDF — the print dialog will open. Select "Save as PDF" as printer.');
    } catch(err) {
      console.error(err);
      showError('Failed to generate report: ' + err.message);
    } finally {
      setLoading(false);
    }
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