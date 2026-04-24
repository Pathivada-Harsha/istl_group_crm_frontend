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

  // ── localStorage keys ────────────────────────────────────────────────────────
  const SK = {
    group:    'pr_sel_group',
    subGroup: 'pr_sel_subgroup',
    project:  'pr_sel_project',
    tab:      'pr_active_tab',
    report:   'pr_report_cache',
  };

  // Project selection — initialise from localStorage so selections survive refresh
  const [groups, setGroups]           = useState([]);
  const [subGroups, setSubGroups]     = useState([]);
  const [projects, setProjects]       = useState([]);
  const [selGroup, setSelGroup]       = useState(() => localStorage.getItem(SK.group)    || '');
  const [selSubGroup, setSelSubGroup] = useState(() => localStorage.getItem(SK.subGroup) || '');
  const [selProject, setSelProject]   = useState(() => localStorage.getItem(SK.project)  || '');
  const [dropLoading, setDropLoading] = useState({ g: false, sg: false, p: false });

  // Report data — restore from cache so it survives browser refresh
  const [report, setReport]   = useState(() => {
    try {
      const cached = localStorage.getItem(SK.report);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(SK.tab) || 'overview');

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
  });

  // ── Persist each selection to localStorage whenever it changes ───────────────
  useEffect(() => { localStorage.setItem(SK.group,    selGroup);    }, [selGroup]);    // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem(SK.subGroup, selSubGroup); }, [selSubGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem(SK.project,  selProject);  }, [selProject]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem(SK.tab,      activeTab);   }, [activeTab]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Persist report data — save when set, clear when null
  useEffect(() => {
    if (report) {
      try { localStorage.setItem(SK.report, JSON.stringify(report)); } catch {}
    } else {
      localStorage.removeItem(SK.report);
    }
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On mount: load groups, then cascade-restore subgroups → projects ─────────
  useEffect(() => {
    const savedGroup    = localStorage.getItem(SK.group)    || '';
    const savedSubGroup = localStorage.getItem(SK.subGroup) || '';

    setDropLoading(p => ({ ...p, g: true }));
    filterApi.getAllGroups()
      .then(g => {
        setGroups(g || []);
        if (!savedGroup) return;
        // Group was saved — reload its subgroups
        setDropLoading(p => ({ ...p, sg: true }));
        return filterApi.getSubGroups(savedGroup)
          .then(sg => {
            setSubGroups(sg || []);
            if (!savedSubGroup) return;
            // Subgroup was also saved — reload its projects
            setDropLoading(p => ({ ...p, p: true }));
            return filterApi.getProjects(savedGroup, savedSubGroup)
              .then(ps => setProjects(ps || []))
              .catch(() => {})
              .finally(() => setDropLoading(p => ({ ...p, p: false })));
          })
          .catch(() => {})
          .finally(() => setDropLoading(p => ({ ...p, sg: false })));
      })
      .catch(() => {})
      .finally(() => setDropLoading(p => ({ ...p, g: false })));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGroupChange = (v) => {
    setSelGroup(v);
    setSelSubGroup(''); localStorage.removeItem(SK.subGroup);
    setSelProject('');  localStorage.removeItem(SK.project);
    setReport(null);    localStorage.removeItem(SK.report);
    setSubGroups([]);   setProjects([]);
    if (!v) return;
    setDropLoading(p => ({ ...p, sg: true }));
    filterApi.getSubGroups(v)
      .then(sg => setSubGroups(sg || []))
      .catch(() => {})
      .finally(() => setDropLoading(p => ({ ...p, sg: false })));
  };

  const handleSubGroupChange = (v) => {
    setSelSubGroup(v);
    setSelProject(''); localStorage.removeItem(SK.project);
    setReport(null);   localStorage.removeItem(SK.report);
    setProjects([]);
    if (!v) return;
    setDropLoading(p => ({ ...p, p: true }));
    filterApi.getProjects(selGroup, v)
      .then(ps => setProjects(ps || []))
      .catch(() => {})
      .finally(() => setDropLoading(p => ({ ...p, p: false })));
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
      // Only reset tab to overview on a fresh manual generate
      setActiveTab('overview');
      showSuccess('Report generated successfully!');
    } catch (err) { showError(err.message || 'Failed to generate report'); }
    finally { setLoading(false); }
  };

  // ─── Excel Export ────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    // headerRows: array of row indices (0-based) that should be bolded
    const addSheet = (name, rows, headerRows = []) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // ── Auto column widths based on content ──────────────────────────────
      const colWidths = [];
      rows.forEach(row => {
        (row || []).forEach((cell, ci) => {
          const len = cell != null ? String(cell).length : 0;
          colWidths[ci] = Math.min(Math.max(colWidths[ci] || 8, len + 2), 60);
        });
      });
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      // ── Bold specified header rows + any ALL-CAPS section title rows ─────
      const boldRowSet = new Set(headerRows);
      rows.forEach((row, ri) => {
        if (!row || row.length === 0) return;
        const strings = row.filter(c => typeof c === 'string' && c.trim().length > 0);
        // Auto-detect ALL-CAPS section title rows (e.g. "BILLING STATUS — INVOICES")
        if (strings.length > 0 && strings.every(s => s === s.toUpperCase())) {
          boldRowSet.add(ri);
        }
      });

      boldRowSet.forEach(ri => {
        (rows[ri] || []).forEach((_, ci) => {
          const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
          if (!ws[addr]) return;
          ws[addr].s = { font: { bold: true } };
        });
      });

      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    // Sheet 1: Overview
    const ov = report.overview || {};
    const bil = report.billing || {};
    const proc = report.procurement || {};
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
      ['Amount to be Received (Billing Pending)', parseFloat(bil.totalPending) || 0],
      ['Total Procurement (Billed)', parseFloat(ov.totalProcurement) || 0],
      ['Total Paid to Vendors', parseFloat(ov.totalPaid) || 0],
      ['Amount to be Paid (Vendor Balance Due)', parseFloat(proc.totalBalance) || 0],
      ['Projected Profit', parseFloat(ov.projectedProfit) || 0],
      ['Profit Margin %', parseFloat(ov.profitMarginPercent) || 0],
    ]);

    // Sheet 2: Billing — Invoices
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
    ], [3]);

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
    ], [3]);

    // Sheet 4: Purchase Orders
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
    ], [3]);

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
    ], [3]);

    // Sheet 6: Profitability
    const prof = report.profitability || {};
    const expHeaders = ['Expense Code','Trip Date','Category','Amount','Paid By','Status'];
    const expRows = (prof.expenses || []).map(r => [
      r.expenseCode, r.tripDate, r.category, parseFloat(r.amount)||0, r.paidBy, r.status
    ]);
    addSheet('6. Profitability', [
      ['PROFITABILITY ANALYSIS'],                                                          // 0
      [],                                                                                  // 1
      ['REVENUE', '', 'COST', '', 'PROFIT', ''],                                          // 2
      ['Total Revenue (Invoiced)', parseFloat(prof.totalRevenue)||0, 'Total Procurement', parseFloat(prof.totalProcurement)||0, 'Gross Profit', parseFloat(prof.grossProfit)||0],
      ['', '', 'Project Expenses', parseFloat(prof.projectExpenses)||0, 'Net Profit', parseFloat(prof.netProfit)||0],
      ['', '', '', '', 'Gross Margin %', parseFloat(prof.grossMarginPercent)||0],
      ['', '', '', '', 'Net Margin %', parseFloat(prof.netMarginPercent)||0],
      [],                                                                                  // 7
      ['GST ANALYSIS', ''],                                                                // 8
      ['Invoice GST (Tax Collected)', parseFloat(prof.invoiceGSTAmount)||0],
      ['PO / Bill GST (Tax Paid)', parseFloat(prof.poGSTAmount)||0],
      ['Additional / Net GST', parseFloat(prof.additionalGST)||0],
      [],                                                                                  // 12
      ['PROJECT EXPENSES', ''],                                                            // 13
      expHeaders,                                                                          // 14
      ...expRows,
      [],
      ['TOTAL EXPENSES', '', '', expRows.reduce((s,r)=>s+r[3],0)],
    ], [14]);

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

      const sb=(s='')=>`<span class="badge badge-${(s||'').toLowerCase().replace(/\s+/g,'-')}">${s||'—'}</span>`;
      const leg=(bars)=>bars.map(b=>`<span class="legend-item"><span class="legend-dot" style="background:${b.color}"></span>${b.label}: <strong>${pFmtShort(b.value)}</strong></span>`).join('');
      const pageFooter=(num,title)=>`<div class="page-footer"><span class="footer-brand">ISTL GROUP CRM &nbsp;·&nbsp; Confidential</span><span class="footer-title">${title}</span><span class="footer-page">Page ${num}</span></div>`;
      const pageHeader=(title,color)=>`<div class="page-header" style="border-bottom-color:${color}"><div class="page-header-left"><div class="page-header-section" style="color:${color}">${title}</div><div class="page-header-project">${ov.projectName||'—'}</div></div><div class="page-header-right">${ov.projectId||''}</div></div>`;
      const sectionTitle=(icon,text,color)=>`<div class="section-title-bar" style="background:linear-gradient(135deg,${color} 0%,${color}dd 100%)"><span class="section-icon">${icon}</span><span>${text}</span></div>`;
      const narrative=(text)=>`<p class="narrative">${text}</p>`;
      const divider=`<div class="divider"></div>`;

      // ── 2. Build HTML — one <div class="page"> per section ───────────────
      const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${projName} — Project Report</title>
<style>
@font-face{font-family:'Poppins';font-style:normal;font-weight:400;src:url('data:font/woff2;base64,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') format('woff2');}@font-face{font-family:'Poppins';font-style:normal;font-weight:500;src:url('data:font/woff2;base64,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') format('woff2');}@font-face{font-family:'Poppins';font-style:normal;font-weight:600;src:url('data:font/woff2;base64,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') format('woff2');}@font-face{font-family:'Poppins';font-style:normal;font-weight:700;src:url('data:font/woff2;base64,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') format('woff2');}@font-face{font-family:'Poppins';font-style:normal;font-weight:800;src:url('data:font/woff2;base64,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') format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'Poppins','Segoe UI',Arial,sans-serif;font-size:10pt;color:#1e293b;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ── PAGE STRUCTURE ── */
.page{width:794px;min-height:1122px;padding:0;position:relative;page-break-after:always;break-after:page;display:flex;flex-direction:column;overflow:hidden}
.page:last-child{page-break-after:auto;break-after:auto}
.page-body{flex:1;padding:28px 40px 0}
.page-footer{position:relative;margin-top:auto;padding:9px 40px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:7.5pt;color:#94a3b8}
.footer-brand{font-weight:600;color:#64748b}
.footer-title{color:#94a3b8;font-size:7pt}
.footer-page{font-weight:700;color:#475569}

/* ── PAGE HEADER (inner pages) ── */
.page-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;margin-bottom:18px;border-bottom:3px solid}
.page-header-left{}
.page-header-section{font-size:7.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}
.page-header-project{font-size:13pt;font-weight:800;color:#1e293b;line-height:1.1}
.page-header-right{font-size:8pt;color:#94a3b8;font-weight:500;text-align:right;padding-top:4px}

/* ── COVER PAGE ── */
.cover-page{background:linear-gradient(150deg,#0c1f4a 0%,#1e3a8a 50%,#1d4ed8 100%);height:1123px;display:flex;flex-direction:column;position:relative;overflow:hidden}
.cover-accent-circle{position:absolute;right:-80px;top:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.04);pointer-events:none}
.cover-accent-circle2{position:absolute;left:-60px;bottom:100px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.03);pointer-events:none}
.cover-top{flex:1;padding:60px 52px 40px;display:flex;flex-direction:column;justify-content:center}
.cover-eyebrow{font-size:8pt;font-weight:700;letter-spacing:.2em;color:#93c5fd;text-transform:uppercase;margin-bottom:18px}
.cover-title{font-size:48pt;font-weight:900;line-height:.9;letter-spacing:-2px;color:#fff;margin-bottom:4px}
.cover-title span{color:#f59e0b}
.cover-subtitle{font-size:13pt;font-weight:300;color:#93c5fd;letter-spacing:.06em;text-transform:uppercase;margin-bottom:30px}
.cover-bar{width:64px;height:4px;background:#f59e0b;border-radius:2px;margin:20px 0}
.cover-project{font-size:18pt;font-weight:700;color:#bfdbfe;line-height:1.2;max-width:520px;word-break:break-word;margin-bottom:10px}
.cover-status-pill{display:inline-block;background:${sc};color:#fff;font-size:8pt;font-weight:700;padding:5px 18px;border-radius:99px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.cover-meta{font-size:8.5pt;color:#64748b;margin-top:6px;line-height:1.8}
.cover-meta span{color:#94a3b8}

/* Cover snapshot strip */
.cover-strip{display:grid;grid-template-columns:repeat(4,1fr);background:rgba(255,255,255,.06);border-top:1px solid rgba(255,255,255,.1)}
.cover-strip-item{padding:20px 22px;border-right:1px solid rgba(255,255,255,.08)}
.cover-strip-item:last-child{border-right:none}
.cover-strip-label{font-size:7pt;font-weight:600;letter-spacing:.1em;color:#93c5fd;text-transform:uppercase;margin-bottom:6px}
.cover-strip-value{font-size:16pt;font-weight:800;color:#fff;line-height:1;word-break:break-all}
.cover-strip-sub{font-size:7.5pt;color:#64748b;margin-top:5px}

/* ── SECTION TITLE BAR ── */
.section-title-bar{display:flex;align-items:center;gap:10px;padding:11px 18px;border-radius:8px;color:#fff;font-size:10.5pt;font-weight:700;letter-spacing:.04em;margin-bottom:18px}
.section-icon{font-size:14pt}

/* ── NARRATIVE ── */
.narrative{font-size:9.5pt;color:#475569;line-height:1.75;margin-bottom:14px;padding:14px 18px;background:#f8fafc;border-left:4px solid #e2e8f0;border-radius:0 6px 6px 0}

/* ── DIVIDER ── */
.divider{height:1px;background:#e2e8f0;margin:18px 0}

/* ── KPI GRID ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;border-top:3px solid;transition:box-shadow .2s}
.kpi-label{font-size:7pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
.kpi-value{font-size:15pt;font-weight:800;line-height:1.1;word-break:break-all}
.kpi-sub{font-size:7.5pt;color:#9ca3af;margin-top:5px}

/* ── INFO GRID ── */
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 24px;margin-bottom:18px}
.info-item{padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
.info-label{font-size:7pt;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.info-value{font-size:10pt;font-weight:700;color:#1e293b;word-break:break-word}

/* ── CHARTS GRID ── */
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.chart-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px}
.chart-card-title{font-size:10pt;font-weight:700;color:#1e293b;margin-bottom:3px}
.chart-card-sub{font-size:7.5pt;color:#6b7280;margin-bottom:10px}
.chart-card img{width:100%;height:auto;display:block;border-radius:4px}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px}
.legend-item{display:flex;align-items:center;gap:5px;font-size:8pt;color:#374151}
.legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.donut-row{display:flex;align-items:center;gap:16px}
.donut-legend{display:flex;flex-direction:column;gap:8px}

/* ── TABLES ── */
.table-section-title{font-size:10pt;font-weight:700;color:#1e293b;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px}
.table-section-title::before{content:'';display:inline-block;width:4px;height:16px;background:#3b82f6;border-radius:2px}
table{width:100%;border-collapse:collapse;font-size:7.5pt;table-layout:auto}
thead tr{background:#1e293b}
th{color:#fff;padding:6px 8px;text-align:left;font-size:7pt;font-weight:600;white-space:nowrap;letter-spacing:.02em}
th.r,td.r{text-align:right}
td{padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:#f9fafb}
.table-wrap{overflow-x:auto;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:18px}
.g{color:#059669;font-weight:600} .rd{color:#dc2626;font-weight:600} .am{color:#d97706;font-weight:600}

/* ── BADGES ── */
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:7pt;font-weight:600;white-space:nowrap}
.badge-paid,.badge-approved,.badge-completed,.badge-active,.badge-delivered{background:#dcfce7;color:#166534}
.badge-pending{background:#fef3c7;color:#92400e}
.badge-partially-paid,.badge-partially-delivered{background:#fed7aa;color:#9a3412}
.badge-overdue,.badge-cancelled{background:#fee2e2;color:#991b1b}
.badge-advance{background:#ede9fe;color:#5b21b6}
.badge-invoice_payment{background:#dbeafe;color:#1e40af}

/* ── P&L STATEMENT ── */
.pl-box{border:1px solid #bbf7d0;border-left:5px solid #059669;background:#f0fdf4;border-radius:10px;padding:18px 22px;margin-bottom:18px}
.pl-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:9.5pt;border-bottom:1px dashed #d1fae5}
.pl-row:last-child{border-bottom:none}
.pl-indent{padding-left:20px;font-size:9pt;color:#475569}
.pl-subtotal{font-weight:700;font-size:10pt;background:#eff6ff;padding:7px 12px;border-radius:6px;margin:2px -12px}
.pl-total{font-weight:800;font-size:11pt;padding:8px 12px;border-radius:6px;margin:2px -12px}
.pl-profit{background:#dcfce7;color:#166534}
.pl-loss{background:#fee2e2;color:#991b1b}

/* ── GST BOX ── */
.gst-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:18px 22px;margin-bottom:18px}
.gst-title{font-size:8pt;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px}
.gst-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.gst-label{font-size:7.5pt;color:#6b7280;font-weight:500;margin-bottom:4px}
.gst-value{font-size:15pt;font-weight:800}

/* ── CONCLUSION PAGE ── */
.conclusion-page{background:#0f172a;flex:1;padding:52px 52px 32px;display:flex;flex-direction:column}
.concl-eyebrow{font-size:7.5pt;font-weight:700;letter-spacing:.18em;color:#475569;text-transform:uppercase;margin-bottom:12px}
.concl-title{font-size:30pt;font-weight:900;line-height:1.0;color:#fff;margin-bottom:6px}
.concl-title span{color:#f59e0b}
.concl-bar{width:52px;height:4px;background:#f59e0b;border-radius:2px;margin:14px 0 8px}
.concl-sub{font-size:9.5pt;color:#475569;margin-bottom:28px;line-height:1.6}
.concl-section-label{font-size:7.5pt;font-weight:700;color:#475569;letter-spacing:.12em;text-transform:uppercase;margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid #1e293b}
.finding-item{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:8px;margin-bottom:8px;border-left:4px solid}
.finding-tag{font-size:7pt;font-weight:700;color:#fff;padding:3px 10px;border-radius:99px;white-space:nowrap;flex-shrink:0;margin-top:2px}
.finding-text{font-size:9.5pt;color:#1e293b;line-height:1.6}
.rec-item{display:flex;gap:12px;align-items:flex-start;padding:11px 16px;background:#0d2b47;border-left:4px solid #0d9488;border-radius:8px;margin-bottom:8px}
.rec-arrow{color:#0d9488;font-size:16pt;font-weight:800;margin-top:-3px;flex-shrink:0;line-height:1}
.rec-text{font-size:9.5pt;color:#94a3b8;line-height:1.6}
.concl-footer{margin-top:auto;padding-top:24px;border-top:1px solid #1e293b;text-align:center;font-size:8pt;color:#334155}
.concl-footer strong{color:#94a3b8}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 1 — COVER PAGE
═══════════════════════════════════════════════════════════════ -->
<div class="page cover-page">
  <div class="cover-accent-circle"></div>
  <div class="cover-accent-circle2"></div>
  <div class="cover-top">
    <div class="cover-eyebrow">Confidential &nbsp;·&nbsp; Financial Report &nbsp;·&nbsp; ISTL Group CRM</div>
    <div class="cover-title">PROJECT<br><span>REPORT</span></div>
    <div class="cover-subtitle">Comprehensive Financial Analysis</div>
    <div class="cover-bar"></div>
    <div class="cover-project">${ov.projectName||'—'}</div>
    <div class="cover-status-pill">${ov.status||'UNKNOWN'}</div>
    <div class="cover-meta">
      <span>Project ID:&nbsp;</span>${ov.projectId||'N/A'}<br>
      <span>Location:&nbsp;</span>${ov.location||'N/A'}<br>
      <span>Report Generated:&nbsp;</span>${report.generatedAt||'N/A'}
    </div>
  </div>
  <div class="cover-strip">
    <div class="cover-strip-item">
      <div class="cover-strip-label">Contract Value</div>
      <div class="cover-strip-value">${fmtShort(ov.totalContractValue)}</div>
      <div class="cover-strip-sub">Total invoiced to client</div>
    </div>
    <div class="cover-strip-item">
      <div class="cover-strip-label">Amount Received</div>
      <div class="cover-strip-value">${fmtShort(ov.totalReceived)}</div>
      <div class="cover-strip-sub">Payments collected</div>
    </div>
    <div class="cover-strip-item">
      <div class="cover-strip-label">Procurement</div>
      <div class="cover-strip-value">${fmtShort(ov.totalProcurement)}</div>
      <div class="cover-strip-sub">Total vendor bills</div>
    </div>
    <div class="cover-strip-item">
      <div class="cover-strip-label">Net ${isP?'Profit':'Loss'}</div>
      <div class="cover-strip-value" style="color:${isP?'#86efac':'#fca5a5'}">${fmtShort(prof.netProfit)}</div>
      <div class="cover-strip-sub">${pct(prof.netMarginPercent)} net margin</div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 2 — PROJECT OVERVIEW
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 01 — Project Overview','#2563eb')}
    ${sectionTitle('🏗️','Project Overview & Key Details','#1e40af')}
    ${narrative(`This section provides a comprehensive overview of <strong>${ov.projectName||'the project'}</strong>, including its current status, timeline, budgetary position, and key financial metrics. The data below has been extracted directly from the CRM system and reflects the most recent recorded transactions as of the report generation date.`)}

    <div class="kpi-grid">
      <div class="kpi-card" style="border-top-color:#2563eb"><div class="kpi-label">Contract Value</div><div class="kpi-value" style="color:#2563eb">${fmtShort(ov.totalContractValue)}</div><div class="kpi-sub">Total invoiced</div></div>
      <div class="kpi-card" style="border-top-color:#059669"><div class="kpi-label">Total Received</div><div class="kpi-value" style="color:#059669">${fmtShort(ov.totalReceived)}</div><div class="kpi-sub">Collected to date</div></div>
      <div class="kpi-card" style="border-top-color:#d97706"><div class="kpi-label">Procurement</div><div class="kpi-value" style="color:#d97706">${fmtShort(ov.totalProcurement)}</div><div class="kpi-sub">Total vendor bills</div></div>
      <div class="kpi-card" style="border-top-color:${isP?'#059669':'#dc2626'}"><div class="kpi-label">Projected Profit</div><div class="kpi-value" style="color:${isP?'#059669':'#dc2626'}">${fmtShort(ov.projectedProfit)}</div><div class="kpi-sub">${pct(ov.profitMarginPercent)} margin</div></div>
    </div>

    ${divider}
    <div class="table-section-title">Project Details</div>
    <div class="info-grid">
      ${[['Project ID',ov.projectId],['Project Name',ov.projectName],['Status',ov.status],['Location',ov.location],['Group',ov.groupName],['Sub Group',ov.subGroupName],['Start Date',ov.startDate],['End Date',ov.endDate],['Budget',fmt(ov.budget)],['Progress',pct(ov.progressPercentage)],['Gross Margin',pct(prof.grossMarginPercent)],['Net Margin',pct(prof.netMarginPercent)]].map(([l,v])=>`<div class="info-item"><div class="info-label">${l}</div><div class="info-value">${v||'—'}</div></div>`).join('')}
    </div>

    ${narrative(`The project is currently <strong>${ov.status||'in progress'}</strong>, with an overall completion of <strong>${pct(ov.progressPercentage)}</strong> against a total allocated budget of <strong>${fmt(ov.budget)}</strong>. The project runs from ${ov.startDate||'N/A'} through ${ov.endDate||'N/A'}. A contract value of <strong>${fmt(ov.totalContractValue)}</strong> has been invoiced to the client, with <strong>${fmt(ov.totalReceived)}</strong> received — representing a collection rate of <strong>${bPct}%</strong>.`)}
  </div>
  ${pageFooter(2,'Project Overview')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 3 — FINANCIAL ANALYTICS (CHARTS)
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 02 — Financial Analytics','#1d4ed8')}
    ${sectionTitle('📊','Financial Analytics & Visual Summary','#1e40af')}
    ${narrative(`The charts below provide a visual breakdown of the project's financial performance across billing, procurement, and profitability dimensions. These graphics are designed to enable quick identification of cash flow positions, outstanding obligations, and overall project health at a glance.`)}

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-card-title">Billing Overview</div>
        <div class="chart-card-sub">Invoice vs Receipts vs Pending comparison</div>
        <img src="${imgBil}"/>
        <div class="legend">${leg(bilBars)}</div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Procurement Overview</div>
        <div class="chart-card-sub">PO Value vs Bills vs Payments vs Balance</div>
        <img src="${imgPr}"/>
        <div class="legend">${leg(prBars)}</div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Cost Breakdown</div>
        <div class="chart-card-sub">Revenue vs Procurement vs Expenses</div>
        <div class="donut-row">
          <img src="${imgDnut}" style="width:110px;height:110px;flex-shrink:0"/>
          <div class="donut-legend">${costSegs.map(s=>`<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label} &nbsp;<strong>${fmtShort(s.value)}</strong></div>`).join('')}</div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Profit &amp; Loss Summary</div>
        <div class="chart-card-sub">Revenue / Procurement / Expenses / Net</div>
        <img src="${imgPL}"/>
        <div class="legend">${leg(plBars)}</div>
      </div>
    </div>

    ${narrative(`Billing collection stands at <strong>${bPct}%</strong> with <strong>${fmtShort(bil.totalPending)}</strong> still outstanding from the client. On the procurement side, <strong>${pPct}%</strong> of vendor bills have been settled, leaving <strong>${fmtShort(proc.totalBalance)}</strong> in outstanding vendor dues. The project is currently <strong>${isP?'profitable':'in a loss position'}</strong> with a net ${isP?'profit':'loss'} of <strong>${fmtShort(prof.netProfit)}</strong> (${pct(prof.netMarginPercent)} margin).`)}
  </div>
  ${pageFooter(3,'Financial Analytics')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 4 — BILLING STATUS — INVOICES
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 03 — Billing Status','#065f46')}
    ${sectionTitle('🧾','Billing Status — Invoices','#065f46')}
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top-color:#2563eb"><div class="kpi-label">Total Invoiced</div><div class="kpi-value" style="color:#2563eb">${fmtShort(bil.totalInvoiced)}</div><div class="kpi-sub">Raised to client</div></div>
      <div class="kpi-card" style="border-top-color:#059669"><div class="kpi-label">Total Received</div><div class="kpi-value" style="color:#059669">${fmtShort(bil.totalReceived)}</div><div class="kpi-sub">Payments collected</div></div>
      <div class="kpi-card" style="border-top-color:#f59e0b"><div class="kpi-label">Pending</div><div class="kpi-value" style="color:#f59e0b">${fmtShort(bil.totalPending)}</div><div class="kpi-sub">Yet to be collected</div></div>
      <div class="kpi-card" style="border-top-color:#7c3aed"><div class="kpi-label">Advances</div><div class="kpi-value" style="color:#7c3aed">${fmtShort(bil.totalAdvances)}</div><div class="kpi-sub">Advance receipts</div></div>
    </div>
    ${narrative(`A total of <strong>${(bil.invoices||[]).length} invoice(s)</strong> have been raised against this project amounting to <strong>${fmt(bil.totalInvoiced)}</strong>. Of this, <strong>${fmt(bil.totalReceived)}</strong> has been received — a collection rate of <strong>${bPct}%</strong>. The remaining <strong>${fmt(bil.totalPending)}</strong> is pending collection from the client and requires follow-up to maintain healthy project cash flow.`)}
    <div class="table-section-title">Invoice Details</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Invoice No</th><th>Date</th><th>Due Date</th><th>Customer</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th><th>Status</th></tr></thead>
        <tbody>${(bil.invoices||[]).map(r=>`<tr><td>${r.invoiceNo||'—'}</td><td>${r.invoiceDate||'—'}</td><td>${r.dueDate||'—'}</td><td>${r.customerName||'—'}</td><td class="r g">${fmt(r.totalAmount)}</td><td class="r">${fmt(r.paidAmount)}</td><td class="r ${vn(r.balanceAmount)>0?'rd':''}">${fmt(r.balanceAmount)}</td><td>${sb(r.status)}</td></tr>`).join('')}${(bil.invoices||[]).length===0?'<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">No invoices recorded</td></tr>':''}</tbody>
      </table>
    </div>
  </div>
  ${pageFooter(4,'Billing — Invoices')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 5 — BILLING STATUS — RECEIPTS
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 03 — Billing Status (Continued)','#065f46')}
    ${sectionTitle('💳','Receipts & Payment Records','#047857')}
    ${narrative(`The receipts table below captures all payment transactions received against this project — including advance payments, invoice settlements, and partial receipts. Each receipt is reconciled against its linked invoice, providing a clear audit trail of all incoming funds. Applied amounts represent funds matched to specific invoices, while unapplied amounts represent unallocated credit balances.`)}
    <div class="table-section-title">Receipts / Payments Received</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Receipt No</th><th>Date</th><th>Type</th><th class="r">Amount</th><th class="r">Applied</th><th class="r">Unapplied</th><th>Method</th><th>Invoice Ref</th></tr></thead>
        <tbody>${(bil.receipts||[]).map(r=>`<tr><td>${r.receiptNo||'—'}</td><td>${r.receiptDate||'—'}</td><td><span class="badge ${r.receiptType==='ADVANCE'?'badge-advance':'badge-invoice_payment'}">${r.receiptType||'—'}</span></td><td class="r g">${fmt(r.amount)}</td><td class="r">${fmt(r.appliedAmount)}</td><td class="r am">${fmt(r.unappliedAmount)}</td><td>${r.paymentMethod||'—'}</td><td>${r.linkedInvoiceNo||'—'}</td></tr>`).join('')}${(bil.receipts||[]).length===0?'<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">No receipts recorded</td></tr>':''}</tbody>
      </table>
    </div>
    ${(bil.receipts||[]).length>0?narrative(`A total of <strong>${(bil.receipts||[]).length} receipt(s)</strong> have been recorded amounting to <strong>${fmt(bil.totalReceived)}</strong>. Advance receipts of <strong>${fmt(bil.totalAdvances)}</strong> have been collected. All transactions have been recorded via the CRM and are available for audit.`): ''}
  </div>
  ${pageFooter(5,'Billing — Receipts')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 6 — PROCUREMENT — PURCHASE ORDERS
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 04 — Procurement Status','#7c2d12')}
    ${sectionTitle('📦','Procurement — Purchase Orders','#92400e')}
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top-color:#1e3a8a"><div class="kpi-label">Total PO Value</div><div class="kpi-value" style="color:#1e3a8a">${fmtShort(proc.totalPOValue)}</div><div class="kpi-sub">Orders placed</div></div>
      <div class="kpi-card" style="border-top-color:#d97706"><div class="kpi-label">Total Billed</div><div class="kpi-value" style="color:#d97706">${fmtShort(proc.totalBilled)}</div><div class="kpi-sub">Vendor bills received</div></div>
      <div class="kpi-card" style="border-top-color:#059669"><div class="kpi-label">Total Paid</div><div class="kpi-value" style="color:#059669">${fmtShort(proc.totalPaid)}</div><div class="kpi-sub">Settled to vendors</div></div>
      <div class="kpi-card" style="border-top-color:#dc2626"><div class="kpi-label">Balance Due</div><div class="kpi-value" style="color:#dc2626">${fmtShort(proc.totalBalance)}</div><div class="kpi-sub">Outstanding to vendors</div></div>
    </div>
    ${narrative(`This section details all purchase orders issued to vendors in relation to this project. A total of <strong>${(proc.purchaseOrders||[]).length} purchase order(s)</strong> have been raised with a combined value of <strong>${fmt(proc.totalPOValue)}</strong>. Vendor bills of <strong>${fmt(proc.totalBilled)}</strong> have been received, of which <strong>${fmt(proc.totalPaid)}</strong> has been paid — a payment completion rate of <strong>${pPct}%</strong>. An outstanding balance of <strong>${fmt(proc.totalBalance)}</strong> is yet to be settled with vendors.`)}
    <div class="table-section-title">Purchase Orders</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>PO No</th><th>Date</th><th>Vendor</th><th class="r">Value</th><th>Payment Status</th><th>Delivery Status</th><th class="r">Ordered</th><th class="r">Delivered</th></tr></thead>
        <tbody>${(proc.purchaseOrders||[]).map(r=>`<tr><td>${r.poNo||'—'}</td><td>${r.orderDate||'—'}</td><td>${r.vendorName||'—'}</td><td class="r g">${fmt(r.totalValue)}</td><td>${sb(r.paymentStatus)}</td><td>${sb(r.status)}</td><td class="r">${r.totalItems||0}</td><td class="r">${r.deliveredItems||0}</td></tr>`).join('')}${(proc.purchaseOrders||[]).length===0?'<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">No purchase orders recorded</td></tr>':''}</tbody>
      </table>
    </div>
  </div>
  ${pageFooter(6,'Procurement — Purchase Orders')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 7 — PROCUREMENT — BILLS
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 04 — Procurement Status (Continued)','#7c2d12')}
    ${sectionTitle('📋','Vendor Bills Received','#b45309')}
    ${narrative(`The vendor bills register below captures all bills raised by suppliers against their respective purchase orders. Each bill is tracked for payment status and outstanding balance. Timely clearance of vendor dues is essential to maintain healthy supplier relationships and ensure uninterrupted project execution. Bills highlighted in red indicate outstanding balances that require attention.`)}
    <div class="table-section-title">Bills Received from Vendors</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Bill No</th><th>Bill Date</th><th>Due Date</th><th>Vendor</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th><th>Status</th><th>PO Ref</th><th class="r">GST</th></tr></thead>
        <tbody>${(proc.bills||[]).map(r=>`<tr><td>${r.billNo||'—'}</td><td>${r.billDate||'—'}</td><td>${r.dueDate||'—'}</td><td>${r.vendorName||'—'}</td><td class="r">${fmt(r.totalAmount)}</td><td class="r g">${fmt(r.paidAmount)}</td><td class="r ${vn(r.balanceAmount)>0?'rd':''}">${fmt(r.balanceAmount)}</td><td>${sb(r.status)}</td><td>${r.linkedPONo||'—'}</td><td class="r">${fmt(r.taxAmount)}</td></tr>`).join('')}${(proc.bills||[]).length===0?'<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:16px">No bills recorded</td></tr>':''}</tbody>
      </table>
    </div>
  </div>
  ${pageFooter(7,'Procurement — Bills')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 8 — PROFITABILITY ANALYSIS
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-body">
    ${pageHeader('Section 05 — Profitability Analysis','#4a1d96')}
    ${sectionTitle('📈','Profitability & Margin Analysis','#4a1d96')}
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top-color:#059669"><div class="kpi-label">Total Revenue</div><div class="kpi-value" style="color:#059669">${fmtShort(prof.totalRevenue)}</div><div class="kpi-sub">From invoices</div></div>
      <div class="kpi-card" style="border-top-color:${vn(prof.grossProfit)>=0?'#059669':'#dc2626'}"><div class="kpi-label">Gross Profit</div><div class="kpi-value" style="color:${vn(prof.grossProfit)>=0?'#059669':'#dc2626'}">${fmtShort(prof.grossProfit)}</div><div class="kpi-sub">${pct(prof.grossMarginPercent)} gross margin</div></div>
      <div class="kpi-card" style="border-top-color:${isP?'#059669':'#dc2626'}"><div class="kpi-label">Net Profit</div><div class="kpi-value" style="color:${isP?'#059669':'#dc2626'}">${fmtShort(prof.netProfit)}</div><div class="kpi-sub">${pct(prof.netMarginPercent)} net margin</div></div>
      <div class="kpi-card" style="border-top-color:#dc2626"><div class="kpi-label">Project Expenses</div><div class="kpi-value" style="color:#dc2626">${fmtShort(prof.projectExpenses)}</div><div class="kpi-sub">Additional costs</div></div>
    </div>
    ${narrative(`This section presents the profit and loss statement for <strong>${ov.projectName||'the project'}</strong>. Total revenue of <strong>${fmt(prof.totalRevenue)}</strong> (based on invoiced amounts) is set against procurement costs of <strong>${fmt(prof.totalProcurement)}</strong> to arrive at a gross profit of <strong>${fmt(prof.grossProfit)}</strong> (${pct(prof.grossMarginPercent)} gross margin). After deducting project expenses of <strong>${fmt(prof.projectExpenses)}</strong>, the net ${isP?'profit':'loss'} stands at <strong>${fmt(prof.netProfit)}</strong> — a net margin of <strong>${pct(prof.netMarginPercent)}</strong>.`)}

    <div class="table-section-title">Profit &amp; Loss Statement</div>
    <div class="pl-box">
      <div class="pl-row"><span>Total Revenue (Invoiced)</span><span class="g">${fmt(prof.totalRevenue)}</span></div>
      <div class="pl-row pl-indent"><span>− Procurement Cost (Vendor Bills)</span><span class="rd">− ${fmt(prof.totalProcurement)}</span></div>
      <div class="pl-row pl-subtotal"><span>= Gross Profit</span><span>${fmt(prof.grossProfit)} &nbsp;<small style="font-weight:400;color:#6b7280">(${pct(prof.grossMarginPercent)})</small></span></div>
      <div class="pl-row pl-indent"><span>− Project Expenses (Travel / Misc)</span><span class="rd">− ${fmt(prof.projectExpenses)}</span></div>
      <div class="pl-row pl-total ${isP?'pl-profit':'pl-loss'}"><span>= Net ${isP?'Profit':'Loss'}</span><span>${fmt(prof.netProfit)} &nbsp;<small>(${pct(prof.netMarginPercent)})</small></span></div>
    </div>

    <div class="table-section-title">GST Analysis</div>
    <div class="gst-box">
      <div class="gst-title">GST Summary — Invoice GST Collected &minus; PO / Bill GST Paid = Net Position</div>
      <div class="gst-grid">
        <div><div class="gst-label">Invoice GST Collected (from client)</div><div class="gst-value g">${fmt(prof.invoiceGSTAmount)}</div></div>
        <div><div class="gst-label">PO / Bill GST Paid (to vendors)</div><div class="gst-value am">${fmt(prof.poGSTAmount)}</div></div>
        <div><div class="gst-label">Net Additional GST Position</div><div class="gst-value ${vn(prof.additionalGST)>=0?'g':'rd'}">${fmt(prof.additionalGST)}</div></div>
      </div>
    </div>
    ${(prof.expenses||[]).length>0?`
    <div class="table-section-title">Project Expenses Breakdown</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Expense Code</th><th>Date</th><th>Category</th><th class="r">Amount</th><th>Paid By</th><th>Status</th></tr></thead>
      <tbody>${(prof.expenses||[]).map(r=>`<tr><td>${r.expenseCode||'—'}</td><td>${r.tripDate||'—'}</td><td>${r.category||'—'}</td><td class="r">${fmt(r.amount)}</td><td>${r.paidBy||'—'}</td><td>${sb(r.status)}</td></tr>`).join('')}</tbody>
    </table></div>`:''}
  </div>
  ${pageFooter(8,'Profitability Analysis')}
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PAGE 9 — CONCLUSION & RECOMMENDATIONS
═══════════════════════════════════════════════════════════════ -->
<div class="page" style="page-break-after:avoid;break-after:avoid">
  <div class="conclusion-page">
    <div class="concl-eyebrow">Section 06 &nbsp;·&nbsp; Final Assessment</div>
    <div class="concl-title">Conclusion &amp;<br><span>Recommendations</span></div>
    <div class="concl-bar"></div>
    <div class="concl-sub">${ov.projectName||'Project'} &nbsp;·&nbsp; ${report.generatedAt||''}<br>This assessment is based on all recorded transactions in the CRM system and is intended for internal use only.</div>

    <div class="concl-section-label">Key Findings</div>
    ${findings.map(f=>`<div class="finding-item" style="background:${f.bg};border-left-color:${f.c}"><span class="finding-tag" style="background:${f.c}">${f.tag}</span><span class="finding-text">${f.t}</span></div>`).join('')}

    <div class="concl-section-label">Action Items &amp; Recommendations</div>
    ${recs.map(r=>`<div class="rec-item"><span class="rec-arrow">→</span><span class="rec-text">${r}</span></div>`).join('')}

    <div class="concl-footer"><strong>ISTL GROUP CRM</strong> &nbsp;·&nbsp; Auto-generated report for internal use &nbsp;·&nbsp; All figures based on recorded transactions &nbsp;·&nbsp; Confidential</div>
  </div>
</div>

</body></html>`;

      // ── 3. Render HTML in a hidden iframe → capture with html2canvas → build PDF ──
      const blob = new Blob([HTML], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);

      // Render HTML in a hidden off-screen iframe
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:850px;height:1px;border:none;visibility:hidden';
      document.body.appendChild(frame);

      frame.onload = async () => {
        try {
          const iDoc = frame.contentDocument || frame.contentWindow.document;
          const iBody = iDoc.body;
          const fullH = Math.max(iBody.scrollHeight, iDoc.documentElement.scrollHeight);
          frame.style.height = fullH + 'px';

          // Wait for fonts to load (Poppins is embedded so should be instant, but give browser time to parse)
          await new Promise(r => setTimeout(r, 800));
          try { await frame.contentDocument.fonts.ready; } catch(e) {}
          await new Promise(r => setTimeout(r, 400));

          // Dynamically load html2canvas if not already present
          if (!window.html2canvas) {
            await new Promise((res, rej) => {
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
              s.onload = res; s.onerror = rej;
              document.head.appendChild(s);
            });
          }

          // Capture full page as canvas
          const canvas = await window.html2canvas(iBody, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 794,
            height: fullH,
            windowWidth: 850,
            scrollX: 0,
            scrollY: 0,
          });

          // Build PDF — A4 pages (794 × 1123 px at 96dpi)
          const { jsPDF } = window.jspdf || await import('jspdf');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pageW = pdf.internal.pageSize.getWidth();   // 210mm
          const pageH = pdf.internal.pageSize.getHeight();  // 297mm

          const canvasW = canvas.width;
          const canvasH = canvas.height;
          const pxPerMm = canvasW / pageW;
          const pageHeightPx = pageH * pxPerMm;
          const totalPages = Math.ceil(canvasH / pageHeightPx);

          for (let i = 0; i < totalPages; i++) {
            if (i > 0) pdf.addPage();
            const sliceH = Math.min(pageHeightPx, canvasH - i * pageHeightPx);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width  = canvasW;
            sliceCanvas.height = sliceH;
            const ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, i * pageHeightPx, canvasW, sliceH, 0, 0, canvasW, sliceH);
            const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
            pdf.addImage(imgData, 'JPEG', 0, 0, pageW, sliceH / pxPerMm);
          }

          pdf.save(`Project_Report_${projName}.pdf`);
          showSuccess('PDF downloaded successfully!');
        } catch (pdfErr) {
          console.error('PDF render error:', pdfErr);
          // Fallback: download the HTML file so user can print manually
          const a = document.createElement('a');
          a.href = url; a.download = `Project_Report_${projName}.html`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          showSuccess('Downloaded as HTML — open in browser and print → Save as PDF.');
        } finally {
          frame.remove();
          URL.revokeObjectURL(url);
        }
      };

      frame.src = url;
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
          <KPI label="Amt to be Received" value={fmtShort(bil.totalPending)} sub="From clients (pending)" color="#f59e0b" icon={<Clock size={20}/>} />
          <KPI label="Procurement" value={fmtShort(ov.totalProcurement)} color="#d97706" icon={<Package size={20}/>} />
          <KPI label="Amt to be Paid" value={fmtShort(proc.totalBalance)} sub="To vendors (balance due)" color="#dc2626" icon={<AlertCircle size={20}/>} />
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
            <select value={selProject} onChange={e => { setSelProject(e.target.value); setReport(null); localStorage.removeItem(SK.report); }} disabled={!selSubGroup || dropLoading.p}>
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