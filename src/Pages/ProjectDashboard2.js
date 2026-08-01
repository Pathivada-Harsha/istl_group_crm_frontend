import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, IndianRupee, Package, FileText, Users,
  Calendar, Clock, AlertCircle, CheckCircle, XCircle, Activity,
  Briefcase, ShoppingCart, BarChart3, PieChart, Target,
  MapPin, Building2, User, Percent,
  RefreshCw, Receipt, CreditCard, Wallet,
  Plane, Utensils, MapPin as MapPinIcon, Hotel, Eye, EyeOff, ChevronDown, ChevronUp, X,
  Layers, Globe, Tag, LayoutGrid, List as ListIcon
} from 'lucide-react';
import { FiDownload, FiFileText, FiGrid } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import '../pages-css/ProjectDashboard2.css';
import GroupProjectFilter from "../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
// Reuse the project detail's Progress & Timeline tab (planned-vs-actual phase Gantt
// + billing/cost financial timelines) so the dashboard shows the same charts under
// each project. Its CSS lives in OrderBookDetail.css.
import { ProgressTab } from '../components/projects/orderBookTabsPorted.js';
import projectsApi from '../services/projectsApi.js';
import { techProgressPct, fmtTechProgress, NO_TECH_PROGRESS } from '../utils/projectProgress.js';
import '../pages-css/OrderBookDetail.css';
import {
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area,
  ComposedChart, Treemap, RadialBarChart, RadialBar, Brush, LabelList, Line
} from 'recharts';

// ─── Custom 2-line X-axis tick (keeps bar names properly horizontal) ─────────
const MultilineAxisTick = (props) => {
  const { x, y, payload, fill = '#64748b' } = props;
  const lines = String(payload?.value ?? '').split('\n');
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={0} dy={14 + i * 13} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={fill}>
          {line}
        </text>
      ))}
    </g>
  );
};

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const value = Number(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
// PDF-safe formatter — replaces ₹ with Rs. since jsPDF's Helvetica lacks the ₹ glyph
const fmtPDF = (amount) => {
  if (!amount && amount !== 0) return 'Rs.0';
  const value = Number(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}Rs.${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `${sign}Rs.${(abs / 100000).toFixed(2)} L`;
  return `${sign}Rs.${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
// Excel formatter — returns a human-readable string (SheetJS CE ignores numFmt styles)
const fmtXLSX = (amount) => {
  if (!amount && amount !== 0) return 'Rs. 0';
  const value = Number(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}Rs. ${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `${sign}Rs. ${(abs / 100000).toFixed(2)} L`;
  return `${sign}Rs. ${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
// Compact formatter for KPI cards — always abbreviates to prevent overflow
const fmtKpi = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const value = Number(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000)     return `${sign}₹${(abs / 1000).toFixed(1)} K`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const formatDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
  : 'N/A';
// Capacity/quantity formatter — kW auto-bumps to MW, otherwise just unit-suffixed
const formatCapacityQty = (qty, unit) => {
  const n = Number(qty);
  if (!qty && qty !== 0) return null;
  if (!unit) return n.toLocaleString('en-IN');
  const u = unit.toLowerCase();
  if (u === 'kw' || u === 'kwp') {
    if (n >= 1000) return `${(n / 1000).toFixed(2)} MW`;
    return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} kW`;
  }
  if (u === 'mw' || u === 'mwp') return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} MW`;
  return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} ${unit}`;
};
// Softer, lighter palette that sits comfortably against the dashboard's white/light-grey theme
const CHART_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#fb923c', '#4ade80'];
// Distinct, vibrant-but-not-harsh palette specifically for donut slices
const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'];


// ─── Chart.js zoom/pan — same behaviour as the reference video ────────────────
// Uses Chart.js + chartjs-plugin-zoom (hammerjs) so scroll-wheel zooms the
// DATA window (bars get wider), anchored exactly to the mouse cursor.
// Drag pans left/right. Double-click resets. Page never scrolls.
//
// Chart.js + plugin are loaded via CDN <script> tags injected once into <head>.
// We communicate with Chart.js through a <canvas> ref instead of Recharts.

const CHARTJS_LOADED = { current: false, promise: null };

function loadChartJS() {
  if (CHARTJS_LOADED.promise) return CHARTJS_LOADED.promise;
  CHARTJS_LOADED.promise = new Promise((resolve) => {
    if (window.Chart && window.Chart.registry) { resolve(); return; }
    // Load Chart.js then chartjs-plugin-zoom (depends on hammerjs)
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js',
    ];
    let idx = 0;
    function next() {
      if (idx >= scripts.length) { resolve(); return; }
      const s = document.createElement('script');
      s.src = scripts[idx++];
      s.onload = next;
      document.head.appendChild(s);
    }
    next();
  });
  return CHARTJS_LOADED.promise;
}

// Shared Chart.js bar chart with zoom/pan via plugin
/* ── Theme-aware chart palette + redraw-on-toggle hook (added for dark mode) ── */
const getChartPalette = () => {
  const dark = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'dark';
  return dark
    ? { plotBg: '#1b2130', tick: '#9aa7b8', muted: '#9aa7b8', grid: '#2b3445',
        legend: '#c2cbd8', tipBg: '#232b3b', tipBorder: '#3a4456',
        tipTitle: '#e7ecf3', tipBody: '#c2cbd8', donutLabel: '#e7ecf3' }
    : { plotBg: '#ffffff', tick: '#374151', muted: '#94a3b8', grid: '#e5e7eb',
        legend: '#666', tipBg: '#ffffff', tipBorder: '#e2e8f0',
        tipTitle: '#1e293b', tipBody: '#475569', donutLabel: '#1e293b' };
};

const useThemeVersion = () => {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};

// ─── Ctrl+Scroll zoom guard — shared by every Chart.js chart on this page ─────
// Plain wheel ALWAYS scrolls the page normally — charts never trap it.
// Holding Ctrl (Cmd on Mac) while scrolling zooms the chart instead (same
// pattern as embedded Google Maps). chartjs-plugin-zoom is configured with
// modifierKey:'ctrl' so its own internal zoom logic agrees with this guard;
// we still attach this listener ourselves so the browser's page-level scroll
// is only ever suppressed for the exact instant a Ctrl-zoom is happening.
const attachWheelZoomGuard = (el) => {
  if (!el) return () => {};
  const handler = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); // zoom is about to happen — don't also scroll the page
    }
    // no Ctrl/Cmd → do nothing, the browser scrolls the page as normal
  };
  el.addEventListener('wheel', handler, { passive: false });
  return () => el.removeEventListener('wheel', handler);
};

const IDENTITY_FMT = (v) => v; // stable default — inline `(v) => v` would change identity every render and re-trigger the chart rebuild effects

// Wrap a long name into multiple lines so the FULL project name is always
// visible under its bar (Chart.js renders an array label as stacked lines).
const wrapChartLabel = (label, maxChars = 14) => {
  const text = String(label ?? '').trim();
  if (text.length <= maxChars) return text;
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(w => {
    // A single word longer than the limit gets hard-broken so it can't overflow
    while (w.length > maxChars) { if (line) { lines.push(line); line = ''; } lines.push(w.slice(0, maxChars)); w = w.slice(maxChars); }
    if (!line) line = w;
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
    else { lines.push(line); line = w; }
  });
  if (line) lines.push(line);
  // Show the COMPLETE name — no 3-line cap, no '…' truncation
  return lines;
};
const ChartJSBar = ({
  data,          // [{ label, values: { Budget?, Received?, Spent?, 'Order Value'? }, color? }]
  labels,        // string[] — X axis labels
  datasets,      // Chart.js dataset objects (pre-built by caller)
  height = 280,
  yTickFormatter = IDENTITY_FMT,
  xLabelRotation = -30,
  modal = false,
  showValueLabels = true,         // amounts are shown above each bar by default
  valueLabelFormatter = IDENTITY_FMT,
  onReset,       // optional external reset trigger ref
}) => {
  const canvasRef  = React.useRef(null);
  const chartRef   = React.useRef(null);
  const themeV = useThemeVersion();
  const [ready, setReady] = React.useState(!!window.Chart);
  const [logScaleActive, setLogScaleActive] = React.useState(false);
  const [hiddenSets, setHiddenSets] = React.useState({}); // HTML-legend toggled-off series

  React.useEffect(() => {
    if (!window.Chart) {
      loadChartJS().then(() => setReady(true));
    }
  }, []);

  React.useEffect(() => {
    if (!ready || !canvasRef.current || !datasets?.length) return;

    // Destroy previous instance
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    // When the series mixes very large and very small values (e.g. one
    // project at ₹513 Cr next to others at ₹1-50 L), a linear y-axis makes
    // every small bar collapse to a sliver near zero and their labels pile
    // up on top of each other. Auto-switch to a logarithmic y-axis whenever
    // the spread is large enough that this would happen — same convention
    // already used by the Contribution bar chart.
    const allVals = datasets.flatMap(ds => (ds.data || []).map(Number)).filter(v => Number.isFinite(v) && v > 0);
    const maxVal = allVals.length ? Math.max(...allVals) : 0;
    const minVal = allVals.length ? Math.min(...allVals) : 0;
    const skewRatio = minVal > 0 ? maxVal / minVal : 1;
    const yScaleType = skewRatio > 15 ? 'logarithmic' : 'linear';
    setLogScaleActive(yScaleType === 'logarithmic');

    const Chart = window.Chart;
    const P = getChartPalette();

    // Register zoom plugin
    if (window.ChartZoom) Chart.register(window.ChartZoom);

    // White background plugin (canvas default is transparent)
    const whiteBgPlugin = {
      id: 'whiteBg',
      beforeDraw(chart) {
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return;
        c.save();
        c.fillStyle = P.plotBg;
        c.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        c.restore();
      },
    };

    // Value-on-bar label plugin (toggleable via showValueLabels prop)
    const valueLabelPlugin = {
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        if (!showValueLabels) return;
        const { ctx: c } = chart;
        const metas = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i));
        const step = modal ? 15 : 13;
        // Final label Y of every already-drawn label, per category index —
        // collision checks compare against where labels ACTUALLY ended up
        // (including earlier lifts), so equal amounts always stack cleanly.
        const placed = {}; // { [idx]: [y, y, ...] }
        chart.data.datasets.forEach((ds, dsIndex) => {
          const meta = metas[dsIndex];
          if (!chart.isDatasetVisible(dsIndex)) return;
          meta.data.forEach((bar, idx) => {
            const val = ds.data[idx];
            if (val == null) return;
            const isZero = Number(val) === 0;
            // Zero values have no height (and NO position on a log axis), so
            // their label is pinned just above the x-axis baseline instead of
            // floating at whatever y Chart.js assigns the empty bar.
            let labelY = isZero ? chart.chartArea.bottom - 4 : bar.y - 5;
            // Lift until this label is at least one line away from EVERY
            // label already placed in this group — covers equal amounts,
            // near-equal heights, and multiple zeros alike.
            const others = placed[idx] || [];
            let moved = true;
            while (moved) {
              moved = false;
              for (const oy of others) {
                if (Math.abs(oy - labelY) < step) { labelY = oy - step; moved = true; }
              }
            }
            (placed[idx] = others).push(labelY);
            c.save();
            c.font = `700 ${modal ? 11 : 9}px system-ui,sans-serif`;
            c.textAlign = 'center';
            c.textBaseline = 'bottom';
            // Contrast pill: a rounded background chip behind the amount so
            // the text stays readable even when it sits over a bar of the
            // same colour (e.g. red amount over the red Spent bar).
            const txt = valueLabelFormatter(val);
            const tw = c.measureText(txt).width;
            const fh = modal ? 11 : 9;
            const px = 4, py = 2, r = 4;
            const bx = bar.x - tw / 2 - px;
            const by = labelY - fh - py;
            const bw = tw + px * 2;
            const bh = fh + py * 2;
            c.beginPath();
            c.moveTo(bx + r, by);
            c.arcTo(bx + bw, by, bx + bw, by + bh, r);
            c.arcTo(bx + bw, by + bh, bx, by + bh, r);
            c.arcTo(bx, by + bh, bx, by, r);
            c.arcTo(bx, by, bx + bw, by, r);
            c.closePath();
            c.fillStyle = P.plotBg;
            c.globalAlpha = 0.88;
            c.fill();
            c.globalAlpha = 1;
            // Theme-aware text shade of the bar's colour: on the LIGHT theme
            // the pastels are too light to read, so darken them; on the DARK
            // theme darks vanish, so brighten them instead.
            const isDarkTheme = typeof document !== 'undefined'
              && document.documentElement.getAttribute('data-theme') === 'dark';
            const darken   = { '#60a5fa': '#2563eb', '#34d399': '#059669', '#f87171': '#dc2626', '#a78bfa': '#7c3aed', '#fbbf24': '#d97706' };
            const brighten = { '#60a5fa': '#93c5fd', '#34d399': '#6ee7b7', '#f87171': '#fca5a5', '#a78bfa': '#c4b5fd', '#fbbf24': '#fcd34d' };
            const base = ds.borderColor || P.tick;
            const key = String(base).toLowerCase();
            c.fillStyle = (isDarkTheme ? brighten[key] : darken[key]) || base;
            c.fillText(txt, bar.x, labelY);
            c.restore();
          });
        });
      },
    };

    // Full names, wrapped onto multiple lines under each bar
    const wrappedLabels = labels.map(l => wrapChartLabel(l, modal ? 24 : 13));
    // Clear gap between bars/groups so amount labels never collide
    const isDarkTheme = typeof document !== 'undefined'
      && document.documentElement.getAttribute('data-theme') === 'dark';
    const spacedDatasets = datasets.map(ds => ({
      maxBarThickness: modal ? 56 : 44,
      // Wider bars with a clear gap between groups; labels are stacked above
      // the whole group now, so bar width no longer risks label collisions.
      categoryPercentage: 0.6,
      barPercentage: 0.8,
      ...ds,
      // Dark theme: the pale 1.5px borders clash against dark cards and make
      // the bars look outlined/odd — draw them flat (fill only) instead.
      ...(isDarkTheme ? { borderWidth: 0 } : {}),
    }));

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: { labels: wrappedLabels, datasets: spacedDatasets },
      plugins: [whiteBgPlugin, valueLabelPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        backgroundColor: P.plotBg,
        layout: { padding: { top: showValueLabels ? (modal ? 36 : 32) : 6 } },
        plugins: {
          legend: {
            // Canvas legend disabled — legend chips are rendered as HTML in
            // the top-right badge row, just BEFORE the "Log scale" badge
            display: false,
          },
          tooltip: {
            enabled: !showValueLabels,
            backgroundColor: P.tipBg,
            borderColor: P.tipBorder,
            borderWidth: 1,
            titleColor: P.tipTitle,
            bodyColor: P.tipBody,
            padding: 10,
            callbacks: {
              title: (items) => {
                const raw = items?.[0]?.chart?.data?.labels?.[items[0].dataIndex];
                return Array.isArray(raw) ? raw.join(' ') : raw;
              },
              label: (ctx) => ` ${ctx.dataset.label}: ${yTickFormatter(ctx.raw)}`,
            },
          },
          // Modal: plain mouse wheel zooms directly (dedicated full-screen
          // view, nothing else to scroll). Inline preview cards on the page
          // still require Ctrl/Cmd + Scroll so the dashboard itself can be
          // scrolled past a chart without getting trapped.
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              threshold: 5,
              modifierKey: modal ? undefined : 'ctrl',
            },
            zoom: {
              wheel: {
                enabled: true,
                speed: 0.08,
                modifierKey: modal ? undefined : 'ctrl',
              },
              pinch: { enabled: true },
              mode: 'x',
              scaleMode: 'x',
            },
            limits: {
              x: { minRange: 1 },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: modal ? 11 : 10 },
              color: P.tick,
              // Names now wrap onto multiple lines, so they stay horizontal
              // and are always shown completely — no rotation, no skipping.
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false,
            },
            grid: { display: false },
            border: { color: P.muted, width: 1.5 },
          },
          y: {
            type: yScaleType,
            // Extend the axis ~15% above the tallest bar so the topmost tick
            // value is never SMALLER than what the bars visually show.
            ...(yScaleType === 'linear' ? { grace: '15%', beginAtZero: true } : {}),
            ticks: {
              font: { size: modal ? 11 : 10 },
              color: P.tick,
              callback: (v) => yTickFormatter(v),
              maxTicksLimit: 6,
            },
            grid: { color: P.grid },
            border: { color: P.muted, width: 1.5 },
          },
        },
      },
    });

    // Modal: every wheel zooms, so every wheel is intercepted.
    // Preview: only Ctrl/Cmd+wheel zooms, so only that combination is
    // intercepted — plain scroll passes straight through to the page.
    const canvas = canvasRef.current;
    const detachWheelGuard = modal
      ? (() => { const h = (e) => e.preventDefault(); canvas.addEventListener('wheel', h, { passive: false }); return () => canvas.removeEventListener('wheel', h); })()
      : attachWheelZoomGuard(canvas);

    return () => {
      detachWheelGuard();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [ready, labels, datasets, yTickFormatter, modal, themeV, showValueLabels, valueLabelFormatter, xLabelRotation]);

  const handleReset = () => {
    if (chartRef.current) chartRef.current.resetZoom();
  };

  return (
    <div style={{ height, position: 'relative', width: '100%' }}>
      {!ready && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:13 }}>
          Loading chart…
        </div>
      )}
      {/* Scroll container: with huge data every group keeps a readable
          minimum width (bars + amount labels) and the chart scrolls
          horizontally instead of crushing everything together. */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', height: '100%' }}>
        <div style={{ position: 'relative', height: '100%', minWidth: labels && labels.length > (modal ? 10 : 6) ? `${labels.length * (modal ? 130 : 110)}px` : '100%' }}>
          <canvas
            ref={canvasRef}
            style={{ display: ready ? 'block' : 'none', width:'100%', height:'100%' }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        </div>
      </div>
      {ready && (
        <div
          style={{ position:'absolute', top:6, right:8, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}
          onClick={e => e.stopPropagation()}
        >
          {datasets.length > 1 && datasets.map((ds, i) => (
            <span
              key={ds.label || i}
              title="Click to show / hide this series"
              onClick={e => {
                e.stopPropagation();
                const ch = chartRef.current;
                if (!ch) return;
                ch.setDatasetVisibility(i, !ch.isDatasetVisible(i));
                ch.update();
                setHiddenSets(hs => ({ ...hs, [i]: !ch.isDatasetVisible(i) }));
              }}
              style={{
                display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer',
                fontSize:10, fontWeight:600, lineHeight:'16px', userSelect:'none',
                color: getChartPalette().legend,
                textDecoration: hiddenSets[i] ? 'line-through' : 'none',
                opacity: hiddenSets[i] ? 0.5 : 1,
              }}
            >
              <span style={{ width:11, height:11, borderRadius:2, background: ds.backgroundColor, border:`1px solid ${ds.borderColor}`, display:'inline-block' }} />
              {ds.label}
            </span>
          ))}
          {logScaleActive && (
            <span
              title="Values differ greatly — logarithmic scale used so all bars are visible"
              style={{ fontSize:9, color:'#b45309', background:'rgba(255,251,235,0.95)', borderRadius:4, padding:'2px 6px', border:'1px solid #fde68a', pointerEvents:'none', lineHeight:'16px', userSelect:'none' }}
            >
              Log scale
            </span>
          )}
          <span
            title={modal ? 'Scroll to zoom · Drag to pan' : 'Hold Ctrl (or Cmd) + Scroll to zoom · Ctrl + Drag to pan'}
            style={{
              fontSize:9, color:'#94a3b8', background:'rgba(248,250,252,0.92)',
              borderRadius:4, padding:'2px 6px', border:'1px solid #e2e8f0',
              pointerEvents:'none', lineHeight:'16px', userSelect:'none'
            }}
          >{modal ? '🖱 Scroll to Zoom' : '🖱 Ctrl+Scroll to Zoom'}</span>
          <button
            title="Reset zoom"
            onClick={e => { e.stopPropagation(); handleReset(); }}
            style={{
              fontSize:9, color:'#64748b', background:'#f8fafc',
              borderRadius:4, padding:'2px 7px', border:'1px solid #e2e8f0',
              cursor:'pointer', lineHeight:'16px', fontWeight:500
            }}
          >⟳ Reset</button>
        </div>
      )}
    </div>
  );
};


// ─── ProjDonutChart — Chart.js donut with external elbow labels + zoom ───────
const ProjDonutChart = ({ data, height = 280, labelKey = 'name', valueKey = 'value', colorKey = null, modal = false, showAmount = false, amountFormatter = IDENTITY_FMT }) => {
  const [ready, setReady] = React.useState(!!window.Chart);
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);
  const themeV = useThemeVersion();

  React.useEffect(() => {
    if (!window.Chart) { loadChartJS().then(() => setReady(true)); }
  }, []);

  React.useEffect(() => {
    if (!ready || !canvasRef.current || !data || data.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const Chart = window.Chart;
    const P = getChartPalette();
    if (window.ChartZoom) Chart.register(window.ChartZoom);

    const labels  = data.map(d => d[labelKey]);
    const values  = data.map(d => Number(d[valueKey]));
    const total   = values.reduce((s, v) => s + v, 0);
    const bdColors = data.map((d, i) => (colorKey && d[colorKey]) ? d[colorKey] : DONUT_COLORS[i % DONUT_COLORS.length]);
    const bgColors = bdColors.map(c => c + 'dd');

    // ── External elbow-line label plugin (mimics original Recharts style) ──────
    const elbowLabelPlugin = {
      id: 'elbowLabels',
      afterDraw(chart) {
        const { ctx: c, chartArea, width, height: h } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data.length) return;

        // Total over VISIBLE slices only — hidden (legend-toggled) slices are
        // excluded so percentages re-flow like the bar charts do.
        const visTotal = values.reduce((s, v, i) => s + (chart.getDataVisibility(i) ? v : 0), 0);

        const cx = chartArea ? (chartArea.left + chartArea.right) / 2 : width / 2;
        const cy = chartArea ? (chartArea.top + chartArea.bottom) / 2 : h * 0.44;

        // ── Pass 1: compute a label entry for every visible slice ──────────
        const entries = [];
        meta.data.forEach((arc, i) => {
          if (!chart.getDataVisibility(i)) return; // skip hidden slices
          const val = values[i];
          const pct = visTotal > 0 ? ((val / visTotal) * 100).toFixed(1) : '0';
          if (parseFloat(pct) < 2) return; // skip slivers

          const midAngle = (arc.startAngle + arc.endAngle) / 2;
          const outerR   = arc.outerRadius;
          const elbowR   = outerR + (modal ? (showAmount ? 38 : 32) : (showAmount ? 30 : 24));
          const cos = Math.cos(midAngle);
          const sin = Math.sin(midAngle);
          entries.push({
            i, val, pct, cos, sin,
            x1: cx + (outerR + 4) * cos,
            y1: cy + (outerR + 4) * sin,
            y2: cy + elbowR * sin,
            x2: cx + elbowR * cos,
            side: cos >= 0 ? 'right' : 'left',
          });
        });

        // ── Pass 2: per side, push overlapping labels apart vertically ─────
        // Each label needs labelH px of vertical space (2 lines when
        // showAmount). Sort by y and nudge downward until nothing overlaps,
        // then clamp the whole column back inside the canvas.
        const labelH = showAmount ? (modal ? 30 : 26) : (modal ? 16 : 14);
        ['left', 'right'].forEach(side => {
          const col = entries.filter(e => e.side === side).sort((a, b) => a.y2 - b.y2);
          for (let k = 1; k < col.length; k++) {
            if (col[k].y2 - col[k - 1].y2 < labelH) col[k].y2 = col[k - 1].y2 + labelH;
          }
          // Clamp bottom inside the canvas, then re-resolve upward overlaps
          for (let k = col.length - 1; k >= 0; k--) {
            const maxY = h - labelH / 2 - 2;
            if (col[k].y2 > maxY) col[k].y2 = maxY;
            if (k < col.length - 1 && col[k + 1].y2 - col[k].y2 < labelH) col[k].y2 = col[k + 1].y2 - labelH;
          }
          // Clamp top
          col.forEach(e => { if (e.y2 < labelH / 2 + 2) e.y2 = labelH / 2 + 2; });
        });

        // ── Pass 3: draw ────────────────────────────────────────────────────
        entries.forEach(e => {
          const { i, val, pct, cos } = e;
          const x3 = e.x2 + (cos >= 0 ? (modal ? 14 : 10) : -(modal ? 14 : 10));
          const y3 = e.y2;
          const anchor = cos >= 0 ? 'left' : 'right';

          // Clamp label x inside the canvas so amounts never run off-screen —
          // measure the widest text line and pull the anchor point inward.
          c.save();
          c.font = `700 ${modal ? 12 : 10.5}px system-ui,sans-serif`;
          const txtW = Math.max(
            c.measureText(showAmount ? amountFormatter(val) : `${pct}%`).width,
            showAmount ? c.measureText(`${pct}%`).width : 0
          );
          let labelX = x3 + (cos >= 0 ? 5 : -5);
          if (anchor === 'left'  && labelX + txtW > width - 4) labelX = width - 4 - txtW;
          if (anchor === 'right' && labelX - txtW < 4)         labelX = 4 + txtW;

          // Elbow line follows the (possibly moved) label position
          c.beginPath();
          c.moveTo(e.x1, e.y1);
          c.lineTo(e.x2, y3);
          c.lineTo(x3, y3);
          c.strokeStyle = P.muted;
          c.lineWidth = 1.2;
          c.stroke();
          c.beginPath();
          c.arc(x3, y3, 2.5, 0, Math.PI * 2);
          c.fillStyle = P.muted;
          c.fill();
          c.textAlign = anchor;
          if (showAmount) {
            c.textBaseline = 'alphabetic';
            c.font = `700 ${modal ? 12 : 10.5}px system-ui,sans-serif`;
            c.fillStyle = P.donutLabel;
            c.fillText(amountFormatter(val), labelX, y3 - 1);
            c.font = `600 ${modal ? 10 : 9}px system-ui,sans-serif`;
            c.fillStyle = bdColors[i];
            c.fillText(`${pct}%`, labelX, y3 + (modal ? 13 : 11));
          } else {
            c.textBaseline = 'middle';
            c.font = `600 ${modal ? 11 : 10}px system-ui,sans-serif`;
            c.fillStyle = P.donutLabel;
            c.fillText(`${pct}%`, labelX, y3);
          }
          c.restore();
        });
      },
    };

    // No background-fill plugin here (unlike the bar charts) — a donut only
    // covers a circle, so filling its full rectangular chartArea painted a
    // visible box around the ring instead of blending into the card behind it.
    // The canvas stays transparent so the card's own background shows through.
    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      plugins: [elbowLabelPlugin],
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: bdColors,
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: modal ? '50%' : '45%',
        animation: { duration: 400 },
        // Extra padding on all sides so elbow labels aren't clipped
        layout: { padding: { top: modal ? 44 : 30, bottom: modal ? 44 : 30, left: modal ? 24 : 16, right: modal ? (showAmount ? 70 : 56) : (showAmount ? 54 : 42) } },
        plugins: {
          legend: {
            display: true,
            position: 'left',
            align: 'center',
            labels: {
              color: P.legend,
              font: { size: modal ? 12 : 10 },
              padding: modal ? 12 : 8,
              boxWidth: 12,
              generateLabels(chart) {
                // Mirror the bar-chart legend behaviour: clicking toggles the
                // slice, hidden items render with a strikethrough, and the
                // percentages re-flow across the remaining visible slices.
                const visTotal = chart.data.datasets[0].data.reduce(
                  (s, v, i) => s + (chart.getDataVisibility(i) ? Number(v) : 0), 0);
                return chart.data.labels.map((label, i) => {
                  const isHidden = !chart.getDataVisibility(i);
                  const val = chart.data.datasets[0].data[i];
                  const pct = !isHidden && visTotal > 0 ? ((val / visTotal) * 100).toFixed(1) : '0';
                  return {
                    text: isHidden ? `${label}` : (showAmount ? `${label} — ${amountFormatter(val)} (${pct}%)` : `${label} (${pct}%)`),
                    fillStyle: bgColors[i],
                    strokeStyle: bdColors[i],
                    fontColor: P.legend,
                    lineWidth: 1,
                    hidden: isHidden, // Chart.js draws the strikethrough from this flag
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            backgroundColor: P.tipBg,
            borderColor: P.tipBorder,
            borderWidth: 1,
            titleColor: P.tipTitle,
            bodyColor: P.tipBody,
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const visTotal = ctx.chart.data.datasets[0].data.reduce(
                  (s, v, i) => s + (ctx.chart.getDataVisibility(i) ? Number(v) : 0), 0);
                const pct = visTotal > 0 ? ((val / visTotal) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${showAmount ? amountFormatter(val) : val} (${pct}%)`;
              },
            },
          },
          // Zoom/pan only inside the Expand & Zoom modal — preview donuts on
          // the page stay fully static.
          ...(modal ? { zoom: {
            zoom: { wheel: { enabled: true, speed: 0.05, modifierKey: 'ctrl' }, pinch: { enabled: true }, mode: 'xy' },
            pan: { enabled: true, mode: 'xy', modifierKey: 'ctrl' },
          } } : {}),
        },
      },
    });

    const canvas = canvasRef.current;
    const detachWheelGuard = modal ? attachWheelZoomGuard(canvas) : () => {};
    return () => {
      detachWheelGuard();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [ready, data, modal, labelKey, valueKey, colorKey, themeV, showAmount, amountFormatter]);

  if (!data || data.length === 0) return null;
  const handleReset = () => { if (chartRef.current) chartRef.current.resetZoom(); };

  return (
    <div style={{ height, position: 'relative', width: '100%' }}>
      {!ready && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:13 }}>
          Loading chart…
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: ready ? 'block' : 'none', width:'100%', height:'100%' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      />
      {ready && modal && (
        <div
          style={{ position:'absolute', top:6, right:8, display:'flex', gap:4, alignItems:'center' }}
          onClick={e => e.stopPropagation()}
        >
          <span title="Hold Ctrl (or Cmd) + Scroll to zoom · Ctrl + Drag to pan" style={{ fontSize:9, color:'#94a3b8', background:'rgba(248,250,252,0.92)', borderRadius:4, padding:'2px 6px', border:'1px solid #e2e8f0', pointerEvents:'none', lineHeight:'16px' }}>
            🖱 Ctrl+Scroll to Zoom
          </span>
          <button
            title="Reset zoom"
            onClick={e => { e.stopPropagation(); handleReset(); }}
            style={{ fontSize:9, color:'#64748b', background:'#f8fafc', borderRadius:4, padding:'2px 7px', border:'1px solid #e2e8f0', cursor:'pointer', lineHeight:'16px', fontWeight:500 }}
          >⟳ Reset</button>
        </div>
      )}
    </div>
  );
};


// ─── ContributionBarChart — Chart.js powered, handles skewed data ─────────────
const ContributionBarChart = ({ data, height = 300, modal = false }) => {
  // ALL hooks must be declared before any conditional return
  const [ready, setReady] = React.useState(!!window.Chart);
  const canvasRef = React.useRef(null);
  const chartRef  = React.useRef(null);
  const themeV = useThemeVersion();
  // Amount labels shown above each bar by default — same convention as the
  // Financial Overview chart's Show/Hide Amounts toggle.
  const [showLabels, setShowLabels] = React.useState(true);

  const fmtCurr = (v) => {
    const abs = Math.abs(Number(v));
    if (abs >= 10000000) return `₹${(abs/10000000).toFixed(1)}Cr`;
    if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
    return `₹${abs.toLocaleString('en-IN')}`;
  };

  React.useEffect(() => {
    if (!window.Chart) { loadChartJS().then(() => setReady(true)); }
  }, []);

  React.useEffect(() => {
    // Guard: no data or canvas not mounted yet
    if (!ready || !canvasRef.current || !data || data.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const Chart = window.Chart;
    const P = getChartPalette();
    if (window.ChartZoom) Chart.register(window.ChartZoom);

    const whiteBgPlugin = {
      id: 'whiteBg',
      beforeDraw(chart) {
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return;
        c.save();
        c.fillStyle = P.plotBg;
        c.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        c.restore();
      },
    };

    // Amount + % label above each bar — MUST be a registered plugin (a bare
    // afterDraw sibling under `options` is silently ignored by Chart.js,
    // which is why labels never rendered before this fix).
    const valueLabelPlugin = {
      id: 'contribValueLabels',
      afterDraw(chart) {
        if (!showLabels) return;
        const { ctx: c, scales: { x, y } } = chart;
        const _bdColors = data.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]);
        chart.data.datasets[0].data.forEach((val, i) => {
          const item = data[i];
          if (!item) return;
          const xPos = x.getPixelForValue(i);
          const yPos = y.getPixelForValue(val);
          c.save();
          c.textAlign = 'center';
          c.font = `700 ${modal ? 11 : 10}px system-ui,sans-serif`;
          c.fillStyle = _bdColors[i];
          c.fillText(fmtCurr(val), xPos, yPos - 16);
          c.font = `400 ${modal ? 10 : 9}px system-ui,sans-serif`;
          c.fillStyle = P.muted;
          c.fillText(`${item.pct ?? 0}%`, xPos, yPos - 4);
          c.restore();
        });
      },
    };

    const maxBudget = Math.max(...data.map(d => d.budget));
    const minBudget = Math.min(...data.map(d => d.budget));
    const skewRatio = maxBudget / (minBudget || 1);
    const yScaleType = skewRatio > 15 ? 'logarithmic' : 'linear';

    const labels   = data.map(d => wrapChartLabel(d.name, modal ? 24 : 12));
    const bdColors = data.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]);
    const bgColors = bdColors.map(c => c + 'dd');

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      plugins: [whiteBgPlugin, valueLabelPlugin],
      data: {
        labels,
        datasets: [{
          label: 'Order Value',
          data: data.map(d => d.budget),
          backgroundColor: bgColors,
          borderColor: bdColors,
          borderWidth: 1.5,
          borderRadius: 0,
          borderSkipped: false,
          maxBarThickness: modal ? 52 : 36,
          categoryPercentage: 0.5,
          barPercentage: 0.7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        layout: { padding: { top: 40 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            // Amounts are already printed above every bar when showLabels is
            // on — a hover tooltip repeating the same number is redundant, so
            // it only appears once the labels are hidden.
            enabled: !showLabels,
            backgroundColor: P.tipBg,
            borderColor: P.tipBorder,
            borderWidth: 1,
            titleColor: P.tipTitle,
            bodyColor: P.tipBody,
            padding: 10,
            callbacks: {
              title: (items) => data[items?.[0]?.dataIndex]?.name ?? '',
              label: (tooltipCtx) => {
                const item = data[tooltipCtx.dataIndex];
                return [` Order Value: ${fmtCurr(tooltipCtx.raw)}`, ` Share: ${item?.pct ?? 0}%`];
              },
            },
          },
          // Modal: plain wheel zooms. Preview: Ctrl/Cmd + wheel zooms, so the
          // page can still be scrolled past the chart normally.
          zoom: {
            pan: { enabled: true, mode: 'x', threshold: 5, modifierKey: modal ? undefined : 'ctrl' },
            zoom: {
              wheel: { enabled: true, speed: 0.08, modifierKey: modal ? undefined : 'ctrl' },
              pinch: { enabled: true },
              mode: 'x',
            },
            limits: { x: { minRange: 1 } },
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: modal ? 12 : 10, weight: '600' },
              color: P.tick,
              maxRotation: 0,   // names shown horizontally, never diagonal
              minRotation: 0,
              autoSkip: false,
              // Names are pre-wrapped into multi-line arrays, so the complete
              // project name always renders under its bar — no truncation.
            },
            grid: { display: false },
            border: { color: P.muted, width: 1.5 },
          },
          y: {
            type: yScaleType,
            ticks: {
              font: { size: modal ? 11 : 10 },
              color: P.tick,
              callback: (v) => fmtCurr(v),
              maxTicksLimit: 6,
            },
            grid: { color: P.grid },
            border: { color: P.muted, width: 1.5 },
          },
        },
      },
    });

    const canvas = canvasRef.current;
    const detachWheelGuard = modal
      ? (() => { const h = (e) => e.preventDefault(); canvas.addEventListener('wheel', h, { passive: false }); return () => canvas.removeEventListener('wheel', h); })()
      : attachWheelZoomGuard(canvas);
    return () => {
      detachWheelGuard();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [ready, data, modal, themeV, showLabels]);

  // Early return AFTER all hooks
  if (!data || data.length === 0) return null;

  const maxBudget = Math.max(...data.map(d => d.budget));
  const minBudget = Math.min(...data.map(d => d.budget));
  const skewRatio = maxBudget / (minBudget || 1);

  const handleReset = () => { if (chartRef.current) chartRef.current.resetZoom(); };

  return (
    <div style={{ height, position: 'relative', width: '100%' }}>
      {!ready && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:13 }}>
          Loading chart…
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: ready ? 'block' : 'none', width:'100%', height:'100%' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      />
      {ready && (
        <div
          style={{ position:'absolute', top:6, right:8, display:'flex', gap:4, alignItems:'center' }}
          onClick={e => e.stopPropagation()}
        >
          {skewRatio > 15 && (
            <span
              title="Values differ greatly — logarithmic scale used so all bars are visible"
              style={{ fontSize:9, color:'#b45309', background:'rgba(255,251,235,0.95)', borderRadius:4, padding:'2px 6px', border:'1px solid #fde68a', pointerEvents:'none', lineHeight:'16px', userSelect:'none' }}
            >
              Log scale
            </span>
          )}
          <span
            title={modal ? "Scroll to zoom · Drag to pan" : "Hold Ctrl (or Cmd) + Scroll to zoom · Ctrl + Drag to pan"}
            style={{ fontSize:9, color:'#94a3b8', background:'rgba(248,250,252,0.92)', borderRadius:4, padding:'2px 6px', border:'1px solid #e2e8f0', pointerEvents:'none', lineHeight:'16px', userSelect:'none' }}
          >
            {modal ? '🖱 Scroll to Zoom' : '🖱 Ctrl+Scroll to Zoom'}
          </span>
          <button
            title={showLabels ? 'Hide the amount labels above each bar' : 'Show the amount labels above each bar'}
            onClick={e => { e.stopPropagation(); setShowLabels(v => !v); }}
            style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'#3b82f6', background: showLabels ? '#eff6ff' : '#f8fafc', borderRadius:4, padding:'2px 7px', border:'1px solid #e2e8f0', cursor:'pointer', lineHeight:'16px', fontWeight:600 }}
          >
            {showLabels ? <EyeOff size={10} /> : <Eye size={10} />} {showLabels ? 'Hide Amounts' : 'Show Amounts'}
          </button>
          <button
            title="Reset zoom to full view"
            onClick={e => { e.stopPropagation(); handleReset(); }}
            style={{ fontSize:9, color:'#64748b', background:'#f8fafc', borderRadius:4, padding:'2px 7px', border:'1px solid #e2e8f0', cursor:'pointer', lineHeight:'16px', fontWeight:500 }}
          >
            ⟳ Reset
          </button>
        </div>
      )}
    </div>
  );
};

// ─── ZoomableBarChart — fallback wrapper (hooks always at top) ────────────────
const ZoomableBarChart = ({ data, children, height, brushDataKey = 'name', datasets, labels, yTickFormatter, modal = false }) => {
  // Hooks declared unconditionally — before any conditional return
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const el = wrapRef.current;
    return attachWheelZoomGuard(el);
  }, []);

  // After hooks: conditional render
  if (datasets && labels) {
    return (
      <ChartJSBar
        data={data}
        labels={labels}
        datasets={datasets}
        height={height}
        yTickFormatter={yTickFormatter}
        modal={modal}
      />
    );
  }
  return (
    <div ref={wrapRef} style={{ height, position: 'relative', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
};



/**
 * Renders a pointer line + label only for slices whose value >= minPct.
 * Small slices are silently skipped to avoid clutter.
 */
const renderPieLabel = (minPct = 0) => ({
  cx, cy, midAngle, innerRadius, outerRadius, name, value, percent, pct
}) => {
  const displayPct = pct !== undefined ? pct : +(percent * 100).toFixed(1);
  if (displayPct < minPct) return null;
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const mx = cx + (outerRadius + 22) * cos;
  const my = cy + (outerRadius + 22) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 16;
  const ey = my;
  const anchor = cos >= 0 ? 'start' : 'end';
  return (
    <g>
      {/* Elbow line */}
      <path d={`M${cx + outerRadius * cos},${cy + outerRadius * sin}L${mx},${my}L${ex},${ey}`}
        stroke="#94a3b8" strokeWidth={1.2} fill="none" />
      {/* Dot */}
      <circle cx={ex} cy={ey} r={2.5} fill="#94a3b8" />
      {/* Label text */}
      <text x={ex + (cos >= 0 ? 5 : -5)} y={ey} textAnchor={anchor}
        dominantBaseline="central" fontSize={11} fontWeight={600} fill="#1e293b">
        {displayPct}%
      </text>
    </g>
  );
};

// ─── Expense Dashboard Block ──────────────────────────────────────────────────
const ExpenseDashboardSection = ({ expenseData, projectId }) => {
  const [expanded, setExpanded]   = useState(false);
  const [userModal, setUserModal] = useState(false);

  if (!expenseData) return null;

  const {
    totalExpenses, approvedExpenses, pendingExpenses, pendingApprovals,
    travelAndSiteVisit, totalCommission, _approvedThisMonth,
    totalAdvances, unsettledAdvances,
    userBreakdown = [], categoryBreakdown = [], recentExpenses = [],
  } = expenseData;

  const categoryIconMap = {
    Travel: <Plane size={14} />, 'Site Visit': <MapPinIcon size={14} />,
    Accommodation: <Hotel size={14} />, Food: <Utensils size={14} />,
    Commission: <Users size={14} />, Miscellaneous: <Briefcase size={14} />,
  };

  const expenseKpis = [
    { label: 'Total Expenses',       value: formatCurrency(totalExpenses),       color: '#ef4444', icon: <IndianRupee size={20} /> },
    { label: 'Approved',             value: formatCurrency(approvedExpenses),     color: '#22c55e', icon: <CheckCircle size={20} /> },
    { label: 'Pending',              value: formatCurrency(pendingExpenses),      color: '#f59e0b', icon: <Clock size={20} /> },
    { label: 'Travel & Site Visit',  value: formatCurrency(travelAndSiteVisit),  color: '#3b82f6', icon: <Plane size={20} /> },
    { label: 'Commission',           value: formatCurrency(totalCommission),      color: '#8b5cf6', icon: <Users size={20} /> },
    { label: 'Advances Given',       value: formatCurrency(totalAdvances),        color: '#06b6d4', icon: <Wallet size={20} /> },
  ];

  const catChartData = categoryBreakdown.map(c => ({
    name: c.category?.replace('_', ' ') || 'Other',
    value: Number(c.totalAmount || 0),
    count: c.count,
  }));

  return (
    <div className="db-expense-block">
      <div className="db-expense-header" onClick={() => setExpanded(v => !v)}>
        <div className="db-expense-title-row">
          <h3 className="db-section-title"><Receipt size={20} />Employee Cost &amp; Expense Management</h3>
          <div className="db-expense-header-pills">
            {pendingApprovals > 0 && (
              <span className="db-pill db-pill-warning"><Clock size={12} /> {pendingApprovals} pending approval{pendingApprovals !== 1 && 's'}</span>
            )}
            {unsettledAdvances > 0 && (
              <span className="db-pill db-pill-info"><Wallet size={12} /> {formatCurrency(unsettledAdvances)} unsettled advance</span>
            )}
          </div>
        </div>
        <button className="db-expand-btn">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
      </div>

      <div className="db-expense-kpi-strip">
        {expenseKpis.map((k, i) => (
          <div key={i} className="db-expense-kpi-mini" style={{ borderLeftColor: k.color }}>
            <div className="db-expense-kpi-icon" style={{ color: k.color }}>{k.icon}</div>
            <div>
              <div className="db-expense-kpi-val">{k.value}</div>
              <div className="db-expense-kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="db-expense-expanded">
          {userBreakdown.length > 0 && (
            <div className="db-expense-sub-section">
              <div className="db-sub-header">
                <h4><Users size={15} /> Employee Cost Breakdown</h4>
                <button className="db-link-btn" onClick={e => { e.stopPropagation(); setUserModal(true); }}>View All <Eye size={13} /></button>
              </div>
              <div className="db-employee-grid">
                {userBreakdown.slice(0, 4).map((u, i) => (
                  <div key={i} className="db-employee-card">
                    <div className="db-emp-avatar">{(u.userName || 'U')[0].toUpperCase()}</div>
                    <div className="db-emp-info">
                      <div className="db-emp-name">{u.userName || 'Unknown'}</div>
                      <div className="db-emp-count">{u.expenseCount} expenses</div>
                    </div>
                    <div className="db-emp-amounts">
                      <div className="db-emp-total">{formatCurrency(u.totalAmount)}</div>
                      <div className="db-emp-subs">
                        <span className="db-approved-pill">{formatCurrency(u.approvedAmount)}</span>
                        {u.pendingAmount > 0 && <span className="db-pending-pill">{formatCurrency(u.pendingAmount)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="db-expense-bottom-row">
            {catChartData.length > 0 && (
              <div className="db-cat-chart-card">
                <h4><BarChart3 size={15} /> Expense by Category</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catChartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v)} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                      {catChartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} opacity={0.9} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {recentExpenses.length > 0 && (
              <div className="db-recent-exp-card">
                <h4><Clock size={15} /> Recent Expenses</h4>
                <div className="db-recent-exp-list">
                  {recentExpenses.slice(0, 5).map((exp, i) => (
                    <div key={i} className="db-recent-exp-item">
                      <div className="db-recent-cat-icon">{categoryIconMap[exp.category] || <FileText size={14} />}</div>
                      <div className="db-recent-info">
                        <div className="db-recent-name">{exp.paidByName || 'Unknown'}</div>
                        <div className="db-recent-meta">{exp.category} · {formatDate(exp.tripDate)}</div>
                      </div>
                      <div className="db-recent-right">
                        <div className="db-recent-amount">{formatCurrency(exp.amount)}</div>
                        <span className={`db-status-pill db-status-${exp.status?.toLowerCase()}`}>{exp.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {projectId && (
                  <Link to={`/project-cost-expense?projectId=${projectId}`} className="db-view-all-link" onClick={e => e.stopPropagation()}>
                    View all expenses →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {userModal && (
        <div className="db-modal-overlay">
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3><Users size={18} /> All Employee Expenses</h3>
              <button onClick={() => setUserModal(false)}><X size={18} /></button>
            </div>
            <div className="db-modal-body">
              <table className="db-emp-table">
                <thead><tr><th>Employee</th><th>Expenses</th><th>Total</th><th>Approved</th><th>Pending</th></tr></thead>
                <tbody>
                  {userBreakdown.map((u, i) => (
                    <tr key={i}>
                      <td><div className="db-emp-table-user"><div className="db-emp-avatar sm">{(u.userName || 'U')[0].toUpperCase()}</div>{u.userName || 'Unknown'}</div></td>
                      <td>{u.expenseCount}</td>
                      <td><strong>{formatCurrency(u.totalAmount)}</strong></td>
                      <td className="db-green">{formatCurrency(u.approvedAmount)}</td>
                      <td className="db-amber">{formatCurrency(u.pendingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Capacity / Quantity Block ────────────────────────────────────────────────
const CapacityBlock = ({ subGroups }) => {
  const [activeModal, setActiveModal] = React.useState(null);

  const formatQty = (qty, unit) => {
    const n = Number(qty);
    if (!unit) return n.toLocaleString('en-IN');
    const u = unit.toLowerCase();
    if (u === 'kw' || u === 'kwp') {
      if (n >= 1000) return `${(n / 1000).toFixed(2)} MW`;
      return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} kW`;
    }
    if (u === 'mw' || u === 'mwp') return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} MW`;
    return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} ${unit}`;
  };

  const META = {
    ccms:           { bg: 'var(--c-eff6ff, #eff6ff)', border: '#3b82f6', text: 'var(--ct-1d4ed8, #1d4ed8)', icon: '📦', label: 'CCMS' },
    mcms:           { bg: 'var(--c-f0fdf4, #f0fdf4)', border: '#22c55e', text: 'var(--ct-15803d, #15803d)', icon: '🔧', label: 'MCMS' },
    itms:           { bg: 'var(--c-faf5ff, #fdf4ff)', border: '#a855f7', text: 'var(--ct-1e293b, #7e22ce)', icon: '🚦', label: 'ITMS' },
    solar_rooftop:  { bg: 'var(--c-fffbeb, #fffbeb)', border: '#f59e0b', text: 'var(--ct-b45309, #b45309)', icon: '☀️', label: 'Solar Rooftop' },
    solar_ground:   { bg: 'var(--c-fff7ed, #fff7ed)', border: '#f97316', text: 'var(--ct-c2410c, #c2410c)', icon: '🏭', label: 'Ground Mount' },
    solar_carports: { bg: 'var(--c-f0f9ff, #f0f9ff)', border: '#0ea5e9', text: 'var(--ct-0369a1, #0369a1)', icon: '🅿️', label: 'Carports' },
    solar_wind:     { bg: 'var(--c-ecfdf5, #ecfdf5)', border: '#10b981', text: 'var(--ct-065f46, #065f46)', icon: '💨', label: 'Solar Wind' },
    default:        { bg: 'var(--c-f8fafc, #f8fafc)', border: '#94a3b8', text: 'var(--ct-475569, #475569)', icon: '📊', label: null },
  };

  const getMeta = (sg) => {
    const s = (sg || '').toLowerCase().replace(/[^a-z]/g, '_');
    if (s.includes('ccms'))    return META.ccms;
    if (s.includes('mcms'))    return META.mcms;
    if (s.includes('itms'))    return META.itms;
    if (s.includes('rooftop')) return META.solar_rooftop;
    if (s.includes('ground'))  return META.solar_ground;
    if (s.includes('carport')) return META.solar_carports;
    if (s.includes('wind'))    return META.solar_wind;
    return META.default;
  };

  const isWind = (sg) => (sg || '').toLowerCase().includes('wind');

  const getWindUnits = (sg) => {
    const all = sg.allUnitTotals || [];
    const km = all.find(u => u.unit?.toLowerCase() === 'km');
    const kgTotal = all.filter(u => ['kg','kgs'].includes(u.unit?.toLowerCase()))
                       .reduce((s, u) => s + Number(u.quantity), 0);
    return { km, kg: kgTotal > 0 ? { unit: 'Kg', quantity: kgTotal } : null };
  };

  const n = subGroups.length;
  // auto-fit (not auto-fill) collapses unused tracks, so however many category
  // cards exist — 4, 5, or a newly added one — they always stretch to fill the
  // full row width, and wrap to a new line on narrow screens.
  const gridCols = `repeat(auto-fit, minmax(min(200px, 100%), 1fr))`;

  return (
    <>
      <div className="dashboard-section" style={{ paddingBottom: 8 }}>
        <h3 className="section-title" style={{ marginBottom: 10 }}>
          <span style={{ marginRight: 6 }}>⚡</span>Capacity & Quantity
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
          {subGroups.map((sg, i) => {
            const m = getMeta(sg.subGroupName);
            const wind = isWind(sg.subGroupName);
            const { km, kg } = wind ? getWindUnits(sg) : {};
            return (
              <div key={i} onClick={() => setActiveModal(sg)} title="Click to see project breakdown"
                style={{ background: (m.bg && m.bg.startsWith('#') ? `var(--c-${m.bg.slice(1)}, ${m.bg})` : m.bg), borderLeft: `3px solid ${m.border}`, borderRadius: 10,
                  padding: '12px 14px 11px', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${m.border}33`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,.08)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: m.text, textTransform: 'uppercase', letterSpacing: .6 }}>
                    {m.label || sg.subGroupName}
                  </span>
                </div>
                {wind && (km || kg) ? (
                  <div style={{ marginBottom: 8 }}>
                    {km && <div style={{ fontSize: 18, fontWeight: 800, color: m.text, lineHeight: 1.15 }}>{formatQty(km.quantity, 'Km')}</div>}
                    {kg && <div style={{ fontSize: 13, fontWeight: 600, color: m.text, opacity: .75, lineHeight: 1.2 }}>{formatQty(kg.quantity, 'Kg')}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.text, lineHeight: 1.1, marginBottom: 8 }}>
                    {formatQty(sg.totalQuantity, sg.unit)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ background: m.border, color: '#fff', borderRadius: 9999, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                    {sg.projectCount} proj{sg.projectCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 9, color: m.border, fontWeight: 600 }}>Details →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeModal && (() => {
        const m = getMeta(activeModal.subGroupName);
        const wind = isWind(activeModal.subGroupName);
        const windKmTotal = wind ? (activeModal.allUnitTotals || []).find(u => u.unit?.toLowerCase() === 'km') : null;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--c-ffffff, #fff)', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
              onClick={e => e.stopPropagation()}>
              {/* Sticky header */}
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--c-f1f5f9, #f1f5f9)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: (m.bg && m.bg.startsWith('#') ? `var(--c-${m.bg.slice(1)}, ${m.bg})` : m.bg), borderRadius: '14px 14px 0 0', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ct-94a3b8, #94a3b8)', textTransform: 'uppercase', letterSpacing: 1 }}>Capacity Breakdown</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.text, marginTop: 2 }}>{m.icon} {m.label || activeModal.subGroupName}</div>
                  {wind ? (
                    <div style={{ fontSize: 12, color: 'var(--ct-64748b, #64748b)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {(activeModal.allUnitTotals || []).map((u, i) => (
                        <span key={i}><strong>{formatQty(u.quantity, u.unit)}</strong></span>
                      ))}
                      <span>· <strong>{activeModal.projectCount}</strong> project{activeModal.projectCount !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--ct-64748b, #64748b)', marginTop: 3 }}>
                      Total <strong>{formatQty(activeModal.totalQuantity, activeModal.unit)}</strong> · <strong>{activeModal.projectCount}</strong> project{activeModal.projectCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <button onClick={() => setActiveModal(null)} style={{ background: 'var(--c-ffffff, #fff)', border: `1px solid ${m.border}`, borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: m.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
              {/* Scrollable list */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0 8px' }}
                onWheel={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}>
                {activeModal.projects.map((p, i) => {
                  const pct = activeModal.totalQuantity > 0 ? (p.quantity / activeModal.totalQuantity) * 100 : 0;
                  const breakdown = p.unitBreakdown || [];
                  const windKmEntry = wind ? breakdown.find(u => u.unit?.toLowerCase() === 'km') : null;
                  const windPct = windKmEntry && windKmTotal && Number(windKmTotal.quantity) > 0
                    ? (Number(windKmEntry.quantity) / Number(windKmTotal.quantity)) * 100 : pct;
                  return (
                    <div key={i} style={{ padding: '12px 22px', borderBottom: i < activeModal.projects.length - 1 ? '1px solid var(--c-f1f5f9, #f1f5f9)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                          {/* Customer name — primary bold dark */}
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ct-1e293b, #1e293b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.customerName || p.orderTitle || p.orderBookNo}
                          </div>
                          {/* Order book number — secondary small blue */}
                          {p.orderBookNo && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ct-3b82f6, #3b82f6)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.orderBookNo}
                            </div>
                          )}
                          {/* Order title — grey subtitle */}
                          {p.orderTitle && (
                            <div style={{ fontSize: 11, color: 'var(--ct-64748b, #64748b)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.orderTitle}
                            </div>
                          )}
                          {p.projectId && (
                            <span style={{ fontSize: 10, color: 'var(--ct-94a3b8, #94a3b8)', background: 'var(--c-f1f5f9, #f1f5f9)', borderRadius: 3, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>{p.projectId}</span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {wind && windKmEntry ? (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 700, color: m.text }}>{formatQty(windKmEntry.quantity, 'Km')}</div>
                              <div style={{ fontSize: 10, color: 'var(--ct-94a3b8, #94a3b8)' }}>{windPct.toFixed(1)}% of Km</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 700, color: m.text }}>{formatQty(p.quantity, p.unit)}</div>
                              <div style={{ fontSize: 10, color: 'var(--ct-94a3b8, #94a3b8)' }}>{pct.toFixed(1)}%</div>
                            </>
                          )}
                        </div>
                      </div>
                      {wind && breakdown.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                          {breakdown.map((u, bi) => (
                            <span key={bi} style={{ fontSize: 11, background: 'var(--c-f1f5f9, #f1f5f9)', border: `1px solid ${m.border}33`, borderRadius: 5, padding: '2px 7px', color: 'var(--ct-475569, #475569)', fontWeight: 500 }}>
                              {formatQty(u.quantity, u.unit)}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ height: 4, background: 'var(--c-f1f5f9, #f1f5f9)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${wind ? windPct : pct}%`, background: m.border, borderRadius: 99, transition: 'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

// ─── Aggregated (All / Group / SubGroup) Dashboard ───────────────────────────
const AggregatedDashboard = ({ data, scopeLabel, onRefresh, loading, capacityData }) => {
  const { financial = {}, procurement = {}, projects = [], statusDistribution = [] } = data;
  const breakdownRef = React.useRef(null);
  const scrollToBreakdown = () => breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ── Export helpers ─────────────────────────────────────────────────────────
  // ── Status filter for the projects breakdown table ─────────────────────────
  const [statusFilter, setStatusFilter]   = React.useState('ALL');
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const exportMenuRef = React.useRef(null);

  // Close export menu on outside click
  React.useEffect(() => {
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [statusModal, setStatusModal]   = React.useState(null); // { status, projects[] }
  const [chartModal, setChartModal]     = React.useState(null); // { type: 'statusPie'|'budgetBar'|'contributionBar'|'contributionPie', title }
  const [finViewMode, setFinViewMode]   = React.useState('cards'); // 'cards' | 'table' | 'graph'
  const [finBarShowLabels, setFinBarShowLabels] = React.useState(true); // toggle: amount labels on Financial Overview bars
  const [budgetBarShowLabels, setBudgetBarShowLabels] = React.useState(true); // toggle: amount labels on Top Projects (Budget vs Received) bars
  const [rvsShowLabels, setRvsShowLabels] = React.useState(true); // toggle: amount labels on Received vs Spent bars (shown by default)
  const _themeVersion = useThemeVersion(); // re-render inline-styled modals on theme toggle
  const isDark = React.useMemo(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark',
    [_themeVersion]
  );
  const [updatingProject, setUpdatingProject] = React.useState(null); // projectUniqueId being updated
  const [editProgressModal, setEditProgressModal] = React.useState(null); // { project }
  const [epStatus, setEpStatus] = React.useState('IN_PROGRESS');
  const [epPct, setEpPct]       = React.useState(0);

  // ── Smart progress helpers ────────────────────────────────────────────────
  // Auto-compute progress from financial data when no manual value exists
  // Defined here (before the useEffect that calls it) to avoid temporal dead zone
  const autoProgress = (p) => {
    if (p.progressPercentage != null) return Number(p.progressPercentage);
    const budget = Number(p.budget) || 0;
    const received = Number(p.received) || 0;
    if (budget <= 0) return 0;
    return Math.min(100, Math.round((received / budget) * 100));
  };

  // Sync editable values whenever a project is selected for editing
  React.useEffect(() => {
    if (editProgressModal?.project) {
      setEpStatus(editProgressModal.project.status || 'IN_PROGRESS');
      setEpPct(autoProgress(editProgressModal.project));
    }
  }, [editProgressModal]);

  // PATCH status + progress to backend
  const updateProjectStatusProgress = async (projectUniqueId, status, progressPercentage) => {
    setUpdatingProject(projectUniqueId);
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectUniqueId}/status-progress`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, progressPercentage }),
      });
      if (res.ok) onRefresh();
    } catch (e) { console.error('Failed to update project', e); }
    finally { setUpdatingProject(null); }
  };

  const filteredProjects = statusFilter === 'ALL'
    ? projects
    : projects.filter(p => p.status === statusFilter || p.status?.replace(/ /g,'_') === statusFilter);

  // Flatten capacityData.subGroups[].projects[] into a projectId → {quantity, unit} lookup
  // so the Projects Breakdown table can show each project's capacity.
  const capacityByProjectId = React.useMemo(() => {
    const map = {};
    if (capacityData?.subGroups) {
      capacityData.subGroups.forEach(sg => {
        (sg.projects || []).forEach(p => {
          if (p.projectId) map[p.projectId] = { quantity: p.quantity, unit: p.unit || sg.unit };
        });
      });
    }
    return map;
  }, [capacityData]);

  // ── Export helpers (placed after filteredProjects + capacityByProjectId) ─────
  const buildExportRows = React.useCallback(() => {
    const cols = ['#', 'Project Name', 'Project ID', 'Group', 'Category', 'Capacity', 'Status', 'Progress %', 'Order Value', 'Invoice Raised', 'Amt Received', 'Vendor Payments', 'Pending Payable'];
    const rows = filteredProjects.map((p, i) => {
      const cap = capacityByProjectId[p.projectId];
      return [
        i + 1,
        p.projectName || '',
        p.projectId || '',
        p.groupId || '',
        p.subGroupName || '',
        cap ? formatCapacityQty(cap.quantity, cap.unit) : '',
        (p.status || '').replace(/_/g, ' '),
        autoProgress(p),
        Number(p.budget || 0),
        Number(p.billed || 0),
        Number(p.received || 0),
        Number(p.spent || 0),
        Number(p.pendingPay || 0),
      ];
    });
    const sumOf = (key) => filteredProjects.reduce((acc, p) => acc + Number(p[key] || 0), 0);
    const totals = ['', `TOTAL (${filteredProjects.length} projects)`, '', '', '', '', '', '',
      sumOf('budget'), sumOf('billed'), sumOf('received'), sumOf('spent'), sumOf('pendingPay'),
    ];
    const filterLabel = statusFilter === 'ALL' ? 'All Projects' : statusFilter.replace(/_/g, ' ');
    return { cols, rows, totals, filterLabel };
  }, [filteredProjects, capacityByProjectId, statusFilter]);

  const exportExcel = React.useCallback(() => {
    const { cols, rows, totals, filterLabel } = buildExportRows();
    const dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    const slug    = filterLabel.replace(/\s+/g,'_');

    const STATUS_STYLES = {
      COMPLETED:   'background:#DCFCE7;color:#166534;',
      'IN PROGRESS':'background:#DBEAFE;color:#1E40AF;',
      PLANNING:    'background:#FEF9C3;color:#854D0E;',
      'ON HOLD':   'background:#F3E8FF;color:#6B21A8;',
      CANCELLED:   'background:#FEE2E2;color:#991B1B;',
      'NOT STARTED':'background:#F1F5F9;color:#475569;',
    };

    const statusBadge = (val) => {
      const key = String(val).toUpperCase();
      const st = STATUS_STYLES[key] || 'background:#F1F5F9;color:#475569;';
      return `<span style="${st}padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${val}</span>`;
    };

    // ── Build the HTML table ──────────────────────────────────────────────────
    const HDR_LEFT  = 'background:#1E3A5F;color:#fff;padding:7px 6px;font-size:11px;font-weight:700;text-align:left;border:1px solid #2a4f7a;white-space:nowrap;';
    const HDR_RIGHT = 'background:#065F46;color:#fff;padding:7px 6px;font-size:11px;font-weight:700;text-align:right;border:1px solid #0a7a5a;white-space:nowrap;';
    const TD_L  = (z) => `background:${z?'#F8FAFC':'#fff'};padding:5px 6px;font-size:11px;border:1px solid #E2E8F0;text-align:left;`;
    const TD_R  = (z) => `background:${z?'#F8FAFC':'#fff'};padding:5px 6px;font-size:11px;border:1px solid #E2E8F0;text-align:right;`;
    const CURRENCY = new Set([8,9,10,11,12]);

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  body{font-family:Calibri,Arial,sans-serif;}
  table{border-collapse:collapse;width:100%;}
</style>
</head><body>
<table>
  <tr>
    <td colspan="8" style="background:#1E3A5F;color:#fff;padding:10px 12px;font-size:14px;font-weight:700;border:1px solid #1E3A5F;">Projects Breakdown — ${filterLabel}</td>
    <td colspan="5" style="background:#1E3A5F;color:#93C5FD;padding:10px 12px;font-size:11px;text-align:right;border:1px solid #1E3A5F;">Generated: ${dateStr}</td>
  </tr>
  <tr>
    <td colspan="13" style="background:#1E40AF;color:#BFDBFE;padding:5px 12px;font-size:10px;font-style:italic;border:1px solid #1E40AF;">Filter: ${filterLabel} &nbsp;|&nbsp; ${rows.length} of ${projects.length} projects shown</td>
  </tr>
  <tr>
    <th style="${HDR_LEFT}width:24px;">#</th>
    <th style="${HDR_LEFT}min-width:130px;">Project Name</th>
    <th style="${HDR_LEFT}min-width:90px;">Project ID</th>
    <th style="${HDR_LEFT}min-width:40px;">Group</th>
    <th style="${HDR_LEFT}min-width:70px;">Category</th>
    <th style="${HDR_LEFT}min-width:56px;">Capacity</th>
    <th style="${HDR_LEFT}min-width:80px;">Status</th>
    <th style="${HDR_LEFT}min-width:50px;">Progress %</th>
    <th style="${HDR_RIGHT}min-width:90px;">Order Value</th>
    <th style="${HDR_RIGHT}min-width:90px;">Invoice Raised</th>
    <th style="${HDR_RIGHT}min-width:90px;">Amt Received</th>
    <th style="${HDR_RIGHT}min-width:90px;">Vendor Payments</th>
    <th style="${HDR_RIGHT}min-width:90px;">Pending Payable</th>
  </tr>`;

    rows.forEach((row, ri) => {
      const z = ri % 2 === 0;
      html += '<tr>';
      row.forEach((cell, ci) => {
        const isR = CURRENCY.has(ci);
        const style = isR ? TD_R(z) : TD_L(z);
        let val = cell == null ? '' : String(cell);
        if (ci === 6) { val = statusBadge(cell); }
        else if (ci === 7) { val = `${cell}%`; }
        else if (CURRENCY.has(ci)) { val = fmtXLSX(cell); }
        html += `<td style="${style}">${val}</td>`;
      });
      html += '</tr>';
    });

    // Totals row — use border-bottom on last data row + styled totals row (no border-top trick which leaves ghost lines in Excel)
    html += `<tr>
      <td colspan="13" style="background:#3B82F6;height:2px;padding:0;border:none;font-size:1px;">&nbsp;</td>
    </tr>`;
    html += '<tr>';
    totals.forEach((cell, ci) => {
      const isR = CURRENCY.has(ci);
      const style = `background:#DBEAFE;color:#1E3A5F;padding:6px 6px;font-size:11px;font-weight:700;border:1px solid #BFDBFE;text-align:${isR?'right':'left'};`;
      let val = '';
      if (CURRENCY.has(ci)) val = fmtXLSX(cell);
      else if (ci === 1) val = String(cell);
      html += `<td style="${style}">${val}</td>`;
    });
    html += '</tr>';

    html += '</table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    saveAs(blob, `Projects_${slug}_${new Date().toISOString().slice(0,10)}.xls`);
    setExportMenuOpen(false);
  }, [buildExportRows, financial, filteredProjects, projects]);

  const exportPDF = React.useCallback(() => {
    const { cols, rows, totals, filterLabel } = buildExportRows();
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const PW = doc.internal.pageSize.getWidth();   // 297mm
    const PH = doc.internal.pageSize.getHeight();  // 210mm
    const M  = 8;
    // A4 landscape usable width = 297 - 16 = 281mm. Columns fill it fully.
    const CW = [8, 62, 26, 14, 22, 17, 19, 14, 20, 20, 20, 20, 19]; // total = 281mm
    const TW = CW.reduce((a,b)=>a+b,0);
    const TX = (PW-TW)/2;
    const CURRENCY = new Set([8,9,10,11,12]);
    const PAD = 1.6;                 // horizontal cell padding
    const LH  = 3.2;                 // line height for wrapped text
    const MIN_RH = 7;                // minimum row height
    const FOOTER_Y = PH - 10;

    // ── Header banner ──
    doc.setFillColor(30,58,95); doc.rect(0,0,PW,18,'F');
    doc.setFillColor(59,130,246); doc.rect(0,18,PW,1.2,'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text('Projects Breakdown Report', M, 9);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.setTextColor(147,197,253);
    doc.text(`Filter: ${filterLabel}`, M, 15);
    const now = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    doc.setTextColor(255,255,255);
    doc.text(`Generated: ${now}   |   ${filteredProjects.length} of ${projects.length} projects`, PW-M, 11, {align:'right'});

    // ── Summary cards ──
    const stripY = 21;
    const summaryItems = [
      {label:'Contract Value', val:fmtPDF(financial.totalProjectValue), accent:[59,130,246]},
      {label:'Billed',         val:fmtPDF(financial.totalBilled),       accent:[139,92,246]},
      {label:'Received',       val:fmtPDF(financial.totalReceived),     accent:[34,197,94]},
      {label:'Procurement',    val:fmtPDF(financial.totalPayable),      accent:[239,68,68]},
      {label:'Paid (Vendors)', val:fmtPDF(financial.totalPaid),         accent:[6,182,212]},
      {label:'Pending Pay',    val:fmtPDF(financial.pendingPayments),   accent:[245,158,11]},
      {label:financial.cashDeficit>0?'Cash Deficit':'Cash in Hand',
       val:fmtPDF(financial.cashDeficit>0?financial.cashDeficit:(financial.cashInHand||0)),
       accent:financial.cashDeficit>0?[239,68,68]:[34,197,94]},
    ];
    const SW = (PW-M*2)/summaryItems.length;
    summaryItems.forEach((item,i) => {
      const sx = M+i*SW;
      doc.setFillColor(248,250,252); doc.roundedRect(sx+0.5,stripY,SW-1,11,1.5,1.5,'F');
      doc.setDrawColor(...item.accent); doc.setLineWidth(0.5); doc.roundedRect(sx+0.5,stripY,SW-1,11,1.5,1.5,'S');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...item.accent);
      doc.text(item.val, sx+SW/2, stripY+5, {align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100,116,139);
      doc.text(item.label, sx+SW/2, stripY+9.5, {align:'center'});
    });

    const STATUS_COL = {COMPLETED:[34,197,94],'IN PROGRESS':[59,130,246],PLANNING:[245,158,11],'ON HOLD':[139,92,246],CANCELLED:[239,68,68],'NOT STARTED':[100,116,139]};
    let Y = stripY+14;

    // ── Table header (wraps 2-line labels like "Invoice Raised") ──
    const HRH = 8.5;
    const drawTableHeader = () => {
      doc.setFillColor(30,58,95); doc.rect(TX,Y,TW,HRH,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.3); doc.setTextColor(255,255,255);
      let cx=TX;
      cols.forEach((col,ci)=>{
        const isR = ci>=8;
        const lines = doc.splitTextToSize(String(col), CW[ci]-PAD*2);
        const startYh = Y + HRH/2 - ((lines.length-1)*LH)/2 + 1.1;
        lines.forEach((ln,li)=>{
          doc.text(ln, isR?cx+CW[ci]-PAD:cx+PAD, startYh+li*LH, {align:isR?'right':'left'});
        });
        cx+=CW[ci];
      });
      // vertical separators in header
      doc.setDrawColor(58,90,130); doc.setLineWidth(0.1);
      let vx=TX; CW.forEach(w=>{ vx+=w; if (vx<TX+TW-0.1) doc.line(vx,Y,vx,Y+HRH); });
      Y+=HRH;
    };
    drawTableHeader();

    // ── Data rows: wrap text, dynamic row height, cell borders ──
    doc.setFontSize(6.3);
    rows.forEach((row,ri) => {
      // Pre-compute wrapped lines per cell to get row height
      doc.setFont('helvetica','normal');
      const cellLines = row.map((cell,ci)=>{
        let txt;
        if (ci===6) txt = String(cell??'');
        else if (ci===7) txt = `${cell}%`;
        else if (CURRENCY.has(ci)) txt = fmtPDF(cell);
        else txt = String(cell??'');
        return doc.splitTextToSize(txt, CW[ci]-PAD*2);
      });
      const maxLines = Math.max(1, ...cellLines.map(l=>l.length));
      const rh = Math.max(MIN_RH, maxLines*LH + 3.2);

      // Page break
      if (Y+rh > FOOTER_Y) { doc.addPage(); Y=12; drawTableHeader(); doc.setFontSize(6.3); }

      // Zebra background
      if (ri%2===0) { doc.setFillColor(248,250,252); doc.rect(TX,Y,TW,rh,'F'); }

      let cx=TX;
      row.forEach((cell,ci) => {
        const isR = ci>=8;
        if (ci===6) {
          // Status badge, vertically centered
          const sc = STATUS_COL[(String(cell)).toUpperCase()]||[100,116,139];
          const bh = 4.6, by = Y+(rh-bh)/2;
          doc.setFillColor(Math.min(sc[0]+190,255),Math.min(sc[1]+190,255),Math.min(sc[2]+190,255));
          doc.roundedRect(cx+0.6, by, CW[ci]-1.2, bh, 1, 1, 'F');
          doc.setTextColor(sc[0],sc[1],sc[2]); doc.setFont('helvetica','bold'); doc.setFontSize(5.6);
          doc.text(String(cell??''), cx+CW[ci]/2, by+3.2, {align:'center'});
          doc.setFont('helvetica','normal'); doc.setFontSize(6.3);
        } else {
          doc.setTextColor(30,41,59);
          const lines = cellLines[ci];
          const startYt = Y + rh/2 - ((lines.length-1)*LH)/2 + 1.1;
          lines.forEach((ln,li)=>{
            doc.text(ln, isR?cx+CW[ci]-PAD:cx+PAD, startYt+li*LH, {align:isR?'right':'left'});
          });
        }
        cx+=CW[ci];
      });

      // Cell borders: bottom line + vertical separators
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.12);
      doc.line(TX,Y+rh,TX+TW,Y+rh);
      let vx=TX; CW.forEach(w=>{ vx+=w; if (vx<TX+TW-0.1) doc.line(vx,Y,vx,Y+rh); });
      doc.line(TX,Y,TX,Y+rh); doc.line(TX+TW,Y,TX+TW,Y+rh);

      Y+=rh;
    });

    // ── Totals row ──
    const TRH = 8;
    if (Y+TRH+2 > FOOTER_Y) { doc.addPage(); Y=12; }
    doc.setFillColor(219,234,254); doc.rect(TX,Y,TW,TRH,'F');
    doc.setDrawColor(59,130,246); doc.setLineWidth(0.6);
    doc.line(TX,Y,TX+TW,Y); doc.line(TX,Y+TRH,TX+TW,Y+TRH);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.6); doc.setTextColor(30,64,175);
    let cx=TX;
    totals.forEach((cell,ci) => {
      const isR=ci>=8;
      const txt=CURRENCY.has(ci)?fmtPDF(cell):(ci===1?String(cell):'');
      if (txt) doc.text(txt, isR?cx+CW[ci]-PAD:cx+PAD, Y+5.2, {align:isR?'right':'left'});
      cx+=CW[ci];
    });

    // ── Footer on every page ──
    const pages=doc.internal.getNumberOfPages();
    for (let pg=1;pg<=pages;pg++) {
      doc.setPage(pg);
      doc.setFillColor(248,250,252); doc.rect(0,PH-8,PW,8,'F');
      doc.setDrawColor(203,213,225); doc.setLineWidth(0.25); doc.line(0,PH-8,PW,PH-8);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(148,163,184);
      doc.text('ISTL Group CRM  —  Confidential', M, PH-3);
      doc.text(`Page ${pg} of ${pages}`, PW-M, PH-3, {align:'right'});
    }
    doc.save(`Projects_${filterLabel.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    setExportMenuOpen(false);
  }, [buildExportRows, financial, filteredProjects, projects]);

  const handleStatusCardClick = (statusKey) => {
    if (projects.length === 0) return;
    const matched = projects.filter(p =>
      p.status === statusKey || p.status?.replace(/ /g,'_') === statusKey ||
      p.status?.toLowerCase() === statusKey.toLowerCase()
    );
    if (matched.length === 0) return;
    setStatusModal({ status: statusKey, projects: matched });
  };

  // ── Sub-group / project contribution chart data ───────────────────────────
  // ALL scope: group-wise contribution | GROUP scope: sub-group-wise | SUBGROUP: project-wise
  const contributionData = React.useMemo(() => {
    if (projects.length === 0) return [];
    const total = projects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
    if (total === 0) return [];

    // ALL scope — group by groupId
    if (data.scope === 'ALL' || !data.scope) {
      const hasGroups = projects.some(p => p.groupId);
      if (hasGroups) {
        const map = {};
        projects.forEach(p => {
          const key = p.groupId || 'Unassigned';
          if (!map[key]) map[key] = { name: key, budget: 0, received: 0, spent: 0, count: 0 };
          map[key].budget   += Number(p.budget) || 0;
          map[key].received += Number(p.received) || 0;
          map[key].spent    += Number(p.spent) || 0;
          map[key].count  += 1;
        });
        return Object.values(map)
          .map(g => ({ ...g, pct: total > 0 ? +((g.budget / total) * 100).toFixed(1) : 0 }))
          .sort((a, b) => b.budget - a.budget);
      }
    }

    if (data.scope === 'GROUP') {
      // Group by subGroupName
      const map = {};
      projects.forEach(p => {
        const key = p.subGroupName || p.subGroup || 'Other';
        if (!map[key]) map[key] = { name: key, budget: 0, received: 0, spent: 0, count: 0 };
        map[key].budget   += Number(p.budget) || 0;
        map[key].received += Number(p.received) || 0;
        map[key].spent    += Number(p.spent) || 0;
        map[key].count  += 1;
      });
      return Object.values(map)
        .map(g => ({ ...g, pct: total > 0 ? +((g.budget / total) * 100).toFixed(1) : 0 }))
        .sort((a, b) => b.budget - a.budget);
    }

    // SUBGROUP scope — each project's contribution
    return projects
      .map(p => ({
        name: p.projectName || '',
        budget: Number(p.budget) || 0,
        received: Number(p.received) || 0,
        spent: Number(p.spent) || 0,
        pct: +((Number(p.budget) / total) * 100).toFixed(1),
        count: 1,
      }))
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 10);
  }, [projects, data.scope]);

  const EmptyChart = ({ message = 'No data' }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}><BarChart3 size={40} style={{ margin: '0 auto 8px', opacity: .3 }} /><p style={{ fontSize: 13 }}>{message}</p></div>
    </div>
  );

  const statusColor = { 'Not Started': '#64748b', Completed: '#22c55e', 'In Progress': '#3b82f6', Planning: '#f59e0b', 'On Hold': '#8b5cf6', Cancelled: '#ef4444', NOT_STARTED: '#64748b', IN_PROGRESS: '#3b82f6', COMPLETED: '#22c55e', PLANNING: '#f59e0b', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444' };

  // Memoised — only rebuilds when the underlying projects list changes,
  // NOT when statusFilter changes (that only affects the Breakdown table).
  const topByBudget = React.useMemo(() => [...projects]
    .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
    .slice(0, 6)
    .map(p => ({ name: p.projectName || '', budget: Number(p.budget || 0), received: Number(p.received || 0), spent: Number(p.spent || 0) })),
  [projects]);

  // ── Stable chart props ─────────────────────────────────────────────────────
  // The chart components destroy & rebuild whenever data/labels/datasets props
  // change identity. Memoise everything so a statusFilter change (which only
  // affects the Breakdown table) doesn't re-create these arrays and re-animate
  // the charts.
  const statusPieData = React.useMemo(
    () => statusDistribution.map(d => ({ name: d.name, value: d.value, color: statusColor[d.name] })),
    [statusDistribution] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const topBudgetLabels = React.useMemo(() => topByBudget.map(d => d.name), [topByBudget]);
  // Only 2 bars — Budget vs Received (Spent removed as requested)
  const topBudgetDatasets = React.useMemo(() => [
    { label: 'Budget',   data: topByBudget.map(d => d.budget),   backgroundColor: '#93c5fd', borderColor: '#60a5fa', borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
    { label: 'Received', data: topByBudget.map(d => d.received), backgroundColor: '#6ee7b7', borderColor: '#34d399', borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
  ], [topByBudget]);
  // NEW chart — Received vs Spent per group/sub-group/project (replaces the
  // old "Order Value" contribution bar chart)
  const rvsLabels = React.useMemo(() => contributionData.map(d => d.name), [contributionData]);
  const rvsDatasets = React.useMemo(() => [
    { label: 'Received', data: contributionData.map(d => d.received || 0), backgroundColor: '#6ee7b7', borderColor: '#34d399', borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
    { label: 'Spent',    data: contributionData.map(d => d.spent || 0),    backgroundColor: '#fca5a5', borderColor: '#f87171', borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
  ], [contributionData]);
  const contributionPieData = React.useMemo(
    // Pass the ₹ amount as the value — the donut computes % itself and, with
    // showAmount, renders "₹X Cr" + "NN%" on every slice label.
    () => contributionData.map(d => ({ name: d.name, value: d.budget })),
    [contributionData]
  );

  return (
    <>
      <div>
      {/* Scope Banner */}
      <div className="agg-scope-banner">
        <div className="agg-scope-icon">
          {data.scope === 'ALL' ? <Globe size={22} /> : data.scope === 'GROUP' ? <Layers size={22} /> : <Tag size={22} />}
        </div>
        <div>
          <div className="agg-scope-title">{scopeLabel}</div>
          <div className="agg-scope-sub">{data.totalProjects} project{data.totalProjects !== 1 ? 's' : ''} · Aggregated view</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="dashboard-refresh-btn" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Project Count KPIs */}
      <div className="dashboard-section">
        <h3 className="section-title"><Briefcase size={20} />Projects Overview</h3>
        <div className="kpi-grid">
          {[
            { label: 'Total Projects', val: data.totalProjects,          color: '#3b82f6', icon: <Briefcase size={32} />,   statusKey: 'ALL' },
            { label: 'Not Started',    val: data.notStartedProjects,  color: '#64748b', icon: <Target size={32} />,      statusKey: 'NOT_STARTED' },
            { label: 'Planning',       val: data.planningProjects,    color: '#f59e0b', icon: <Target size={32} />,      statusKey: 'PLANNING' },
            { label: 'In Progress',    val: data.inProgressProjects,  color: '#06b6d4', icon: <Activity size={32} />,    statusKey: 'IN_PROGRESS' },
            { label: 'Completed',      val: data.completedProjects,   color: '#22c55e', icon: <CheckCircle size={32} />, statusKey: 'COMPLETED' },
            { label: 'On Hold',        val: data.onHoldProjects,      color: '#8b5cf6', icon: <Clock size={32} />,       statusKey: 'ON_HOLD' },
            { label: 'Cancelled',      val: data.cancelledProjects,   color: '#ef4444', icon: <XCircle size={32} />,     statusKey: 'CANCELLED' },
          ].filter(k => k.val > 0 || k.label === 'Total Projects').map((k, i) => (
            <div key={i} className="kpi-card" style={{ borderTopColor: k.color, cursor: projects.length > 0 ? 'pointer' : 'default',
              outline: (statusFilter === k.statusKey && k.statusKey !== 'ALL') ? `2px solid ${k.color}` : 'none' }}
              onClick={() => {
                if (!projects.length) return;
                if (k.statusKey === 'ALL') {
                  setStatusFilter('ALL');
                  scrollToBreakdown();
                } else {
                  handleStatusCardClick(k.statusKey);
                }
              }}
              title={projects.length > 0 ? (k.statusKey === 'ALL' ? 'View all projects' : `Click to view ${k.label} projects`) : undefined}>
              <div className="kpi-icon" style={{ color: k.color }}>{k.icon}</div>
              <div className="kpi-content">
                <div className="kpi-value">{k.val}</div>
                <div className="kpi-label">{k.label}</div>
                {projects.length > 0 && (
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    {k.statusKey === 'ALL' ? '↓ View all' : '→ Filter table'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capacity / Quantity Block */}
      {capacityData && capacityData.subGroups && capacityData.subGroups.length > 0 && (
        <CapacityBlock subGroups={capacityData.subGroups} />
      )}

      {/* Financial Overview — Cards / Data View / Graphical View */}
      <div className="dashboard-section">
        {/* ── Section header + 3-tab toggle ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <h3 className="section-title" style={{ margin: 0 }}><IndianRupee size={20} />Consolidated Financial Overview</h3>
          <div style={{ display: 'flex', gap: 6, background: 'var(--c-f1f5f9, #f1f5f9)', borderRadius: 10, padding: 4, border: '1px solid var(--c-e2e8f0, #e2e8f0)' }} className="fin-view-toggle">
            {[
              { key: 'cards', icon: <LayoutGrid size={13} />, label: 'Tiles' },
              { key: 'table', icon: <ListIcon  size={13} />, label: 'List' },
              { key: 'graph', icon: <PieChart  size={13} />, label: 'Graphical' },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => setFinViewMode(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  background: finViewMode === tab.key ? 'var(--c-white, #fff)' : 'transparent',
                  color: finViewMode === tab.key ? '#0b63d6' : 'var(--ct-64748b, #64748b)',
                  boxShadow: finViewMode === tab.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CARDS VIEW ── */}
        {finViewMode === 'cards' && (() => {
          // Computed locally — same basis as List/Graphical (received/billed, paid/procurement)
          // so the % shown here always matches those other two views instead of relying on
          // backend %-fields that can use a different denominator.
          const recvPct = financial.totalBilled  > 0 ? (financial.totalReceived / financial.totalBilled)  * 100 : 0;
          const paidPct = financial.totalPayable > 0 ? (financial.totalPaid     / financial.totalPayable) * 100 : 0;
          return (
          <div className="kpi-grid kpi-grid-4col">
            {[
              { label: 'Total Project Value',   val: formatCurrency(financial.totalProjectValue),  color: '#3b82f6', icon: <Wallet size={32} />,      sub: 'Sum of all budgets' },
              { label: 'Total Billed',          val: formatCurrency(financial.totalBilled),         color: '#8b5cf6', icon: <FileText size={32} />,    sub: 'All invoices raised' },
              { label: 'Total Received',        val: formatCurrency(financial.totalReceived),       color: '#22c55e', icon: <TrendingUp size={32} />,  sub: `${recvPct.toFixed(1)}% collected` },
              { label: 'Pending Receipts',      val: formatCurrency(financial.pendingReceipts),     color: '#f59e0b', icon: <Clock size={32} />,       sub: 'Yet to receive' },
              { label: 'Total Procurement',     val: formatCurrency(financial.totalPayable),        color: '#ef4444', icon: <ShoppingCart size={32} />,sub: 'All vendor bills' },
              { label: 'Total Paid (Vendors)',  val: formatCurrency(financial.totalPaid),           color: '#06b6d4', icon: <CreditCard size={32} />,  sub: `${paidPct.toFixed(1)}% paid` },
              { label: 'Pending Payments',      val: formatCurrency(financial.pendingPayments),     color: '#ef4444', icon: <AlertCircle size={32} />, sub: 'Due to vendors' },
              {
                label: financial.cashDeficit > 0 ? 'Cash Deficit' : 'Cash in Hand',
                val: formatCurrency(financial.cashDeficit > 0 ? financial.cashDeficit : financial.cashInHand),
                color: financial.cashDeficit > 0 ? '#ef4444' : '#22c55e',
                icon: <Wallet size={32} />,
                sub: financial.cashDeficit > 0 ? 'Paid more than received' : 'Received minus paid'
              },
            ].map((k, i) => (
              <div key={i} className="kpi-card" style={{ borderTopColor: k.color }}>
                <div className="kpi-icon" style={{ color: k.color }}>{k.icon}</div>
                <div className="kpi-content">
                  <div className="kpi-value">{k.val}</div>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-subtitle">{k.sub}</div>
                </div>
              </div>
            ))}
          </div>
          );
        })()}

        {/* ── LIST VIEW (formerly Data View) ── */}
        {finViewMode === 'table' && (() => {
          const totalVal    = Number(financial.totalProjectValue  || 0);
          const billed      = Number(financial.totalBilled        || 0);
          const received    = Number(financial.totalReceived      || 0);
          const balRec      = Number(financial.pendingReceipts    || 0);
          const unBilled    = Math.max(0, totalVal - billed);
          const procurement = Number(financial.totalPayable       || 0);
          const paid        = Number(financial.totalPaid          || 0);
          const pendPay     = Number(financial.pendingPayments    || 0);
          const cashAbs     = financial.cashDeficit > 0
            ? Number(financial.cashDeficit)
            : Number(financial.cashInHand || 0);
          const isDeficit   = financial.cashDeficit > 0;
          const pct = (num, den) => den > 0 ? +((num / den) * 100).toFixed(1) : 0;
          // Shows the unit that actually matches formatCurrency's own threshold for
          // this value, instead of a hardcoded "Cr's" label on every row.
          const unitLabel = (v) => {
            const abs = Math.abs(Number(v) || 0);
            if (abs >= 10000000) return "Cr's";
            if (abs >= 100000) return "Lc's";
            return '₹';
          };

          // Simplified, single-accent palette: every row uses the SAME neutral
          // text/value colour (matching the rest of the page's tables), so the
          // list reads cleanly instead of a different colour per row. Status is
          // still communicated — just narrowed to the small badge pill instead
          // of being smeared across the whole row.
          const tone = (kind) => {
            const map = {
              header: { bg: isDark ? '#16263f' : '#1e3a5f', text: '#ffffff', val: '#ffffff', pct: '#ffffff' },
              plain:  { bg: 'transparent', text: isDark ? '#e7ecf3' : '#1e293b', val: null, pct: isDark ? '#c2cbd8' : '#475569' },
            };
            return map[kind] || map.plain;
          };
          const badgeTone = (kind) => {
            const map = {
              success: { bg: isDark ? 'rgba(34,197,94,0.22)'  : '#dcfce7', col: isDark ? '#86efac' : '#15803d' },
              danger:  { bg: isDark ? 'rgba(239,68,68,0.24)'  : '#fee2e2', col: isDark ? '#fca5a5' : '#b91c1c' },
              warning: { bg: isDark ? 'rgba(245,158,11,0.24)' : '#fef3c7', col: isDark ? '#fcd34d' : '#92400e' },
              info:    { bg: isDark ? 'rgba(6,182,212,0.24)'  : '#cffafe', col: isDark ? '#67e8f9' : '#0e7490' },
            };
            return map[kind] || map.success;
          };

          const receivedOverInvoiced = pct(received, billed) > 100;

          const rows = [
            // ── CLIENT BILLING ──────────────────────────────────────────────
            { group: 'Client Billing & Collection', groupIcon: '💰', isGroupHeader: true },
            { label: 'Total Contract Value',    ref: 'a',       val: totalVal,    pctVal: 100,                        t: tone('header'), isHdr: true },
            { label: 'Billed Amount',           ref: 'b',       val: billed,      pctVal: pct(billed,totalVal),       t: tone('plain') },
            { label: 'Received Amount',         ref: 'c',       val: received,    pctVal: pct(received,billed),       t: tone('plain'), badge: receivedOverInvoiced ? '⚠ Over-Received' : '✓ Collected', badgeKind: receivedOverInvoiced ? 'warning' : 'success' },
            ...(receivedOverInvoiced ? [{
              isNote: true,
              noteText: 'Received More Amount Than Invoiced — client has paid more than the billed value (likely an advance receipt; raise/adjust an invoice to match).',
            }] : []),
            { label: 'Balance Receivable',      ref: 'd = b−c', val: balRec,      pctVal: pct(balRec,billed),         t: tone('plain'), badge: '⚠ Pending', badgeKind: 'danger', bold: true },
            { label: 'Un-Billed Contract Value',ref: 'e = a−b', val: unBilled,    pctVal: pct(unBilled,totalVal),     t: tone('plain'), badge: '◷ Not Billed', badgeKind: 'warning', bold: true },
            // ── VENDOR PAYMENTS ─────────────────────────────────────────────
            { group: 'Vendor Procurement & Payments', groupIcon: '🧾', isGroupHeader: true },
            { label: 'Total Procurement',       ref: 'f',       val: procurement, pctVal: pct(procurement,totalVal),  t: tone('plain') },
            { label: 'Total Paid to Vendors',   ref: 'g',       val: paid,        pctVal: pct(paid,procurement),      t: tone('plain'), badge: '✓ Paid', badgeKind: 'success' },
            { label: 'Pending Vendor Payments', ref: 'h = f−g', val: pendPay,     pctVal: pct(pendPay,procurement),   t: tone('plain'), badge: '⚠ Pending', badgeKind: 'danger', bold: true },
            // ── CASH POSITION ───────────────────────────────────────────────
            { group: 'Cash Position',           groupIcon: isDeficit ? '🔴' : '🟢', isGroupHeader: true },
            { label: isDeficit ? 'Cash Deficit' : 'Cash in Hand', ref: 'c − g', val: cashAbs, pctVal: pct(cashAbs,totalVal), t: tone('plain'), badge: isDeficit ? '🔴 Deficit' : '🟢 Surplus', badgeKind: isDeficit ? 'danger' : 'success', bold: true },
          ];

          // Column header config
          const colHdrs = ['Particulars', 'Ref #', 'Units', 'Value (₹)', '% Share', 'Status'];
          const headerBg   = isDark ? '#0f1726' : '#1e293b';
          const wrapBorder = isDark ? '#2b3445' : 'var(--c-e2e8f0,#e2e8f0)';
          const zebraEven  = isDark ? '#1b2233' : 'var(--c-white,#fff)';
          const zebraOdd   = isDark ? '#171e2c' : 'var(--c-f8fafc,#f8fafc)';
          const rowBorder  = isDark ? '#262f42' : 'var(--c-f1f5f9,#f1f5f9)';

          return (
            <div className="fin-list-table" style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${wrapBorder}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 90px 160px 110px 130px', background: headerBg, padding: '10px 20px', gap: 8 }}>
                {colHdrs.map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>

              {rows.map((row, ri) => {
                // ── Group header row ──────────────────────────────────────
                if (row.isGroupHeader) return (
                  <div key={ri} style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,41,59,0.05)', borderTop: ri > 0 ? `1px solid ${rowBorder}` : 'none', padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11 }}>{row.groupIcon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#93c5fd' : '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{row.group}</span>
                  </div>
                );

                // ── Inline note row (e.g. over-received warning) ───────────
                if (row.isNote) return (
                  <div key={ri} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 20px',
                    background: isDark ? 'rgba(245,158,11,0.10)' : '#fffbeb',
                    borderBottom: `1px solid ${rowBorder}`,
                  }}>
                    <AlertCircle size={13} style={{ color: isDark ? '#fbbf24' : '#b45309', flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: isDark ? '#fcd34d' : '#92400e' }}>{row.noteText}</span>
                  </div>
                );

                const isHdr = row.isHdr;
                const t = row.t;
                const baseBg = isHdr ? t.bg : (ri % 2 === 0 ? zebraEven : zebraOdd);
                // Header row keeps its dark navy background on hover (just a touch lighter)
                // so the white text stays legible — a light accent wash here is what made it
                // unreadable in light theme.
                const hoverBg = isHdr
                  ? (isDark ? '#1c3155' : '#274d80')
                  : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.035)');
                return (
                  <div key={ri}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 110px 90px 160px 110px 130px',
                      padding: '12px 20px', gap: 8,
                      background: baseBg,
                      borderBottom: `1px solid ${rowBorder}`,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
                  >
                    {/* Particulars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span style={{ fontSize: isHdr ? 14 : 13, fontWeight: row.bold || isHdr ? 700 : 500, color: t.text }}>{row.label}</span>
                    </div>
                    {/* Ref */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700,
                        color: isHdr ? '#ffffff' : (isDark ? '#93c5fd' : '#1d4ed8'),
                        padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
                      }}>{row.ref}</span>
                    </div>
                    {/* Units — matches the actual scale of this row's value (₹ / Lacs / Cr's) */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12.5, fontWeight: 700,
                        color: isHdr ? 'rgba(255,255,255,0.92)' : (isDark ? '#cbd5e1' : '#475569'),
                        padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
                      }}>{unitLabel(row.val)}</span>
                    </div>
                    {/* Value — coloured to match this row's status badge (if any),
                        so the figure and its status read as one signal */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: isHdr ? 16 : 14, fontWeight: 800, color: isHdr ? t.val : (row.badgeKind ? badgeTone(row.badgeKind).col : t.text) }}>
                      {formatCurrency(row.val)}
                    </div>
                    {/* % */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.pct }}>{row.pctVal.toFixed(1)}%</span>
                    </div>
                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {row.badge ? (() => {
                        const bt = badgeTone(row.badgeKind);
                        return (
                          <span style={{ color: bt.col, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.badge}
                          </span>
                        );
                      })() : <span style={{ fontSize: 11, color: isDark ? '#7a869c' : 'var(--ct-94a3b8,#94a3b8)' }}>—</span>}
                    </div>
                  </div>
                );
              })}

              {/* Footer note */}
              <div style={{ background: isDark ? '#171e2c' : 'var(--c-f8fafc,#f8fafc)', borderTop: `1px solid ${wrapBorder}`, padding: '8px 20px' }}>
                <span style={{ fontSize: 11, color: isDark ? '#8a96aa' : 'var(--ct-94a3b8,#94a3b8)' }}>
                  % — Billed/Balance as % of Contract · Received as % of Billed · Paid/Pending as % of Procurement · Cash as % of Contract
                </span>
              </div>
            </div>
          );
        })()}

        {/* ── GRAPHICAL VIEW ── */}
        {finViewMode === 'graph' && (() => {
          const totalVal    = Number(financial.totalProjectValue  || 0);
          const billed      = Number(financial.totalBilled        || 0);
          const received    = Number(financial.totalReceived      || 0);
          const balRec      = Number(financial.pendingReceipts    || 0);
          const unBilled    = Math.max(0, totalVal - billed);
          const procurement = Number(financial.totalPayable       || 0);
          const paid        = Number(financial.totalPaid          || 0);
          const pendPay     = Number(financial.pendingPayments    || 0);
          // Computed locally (instead of trusting backend %-fields, which can use a
          // different denominator) so the KPI strip always matches the bar amounts below.
          const pctOf       = (num, den) => den > 0 ? (num / den) * 100 : 0;
          const cashAbs     = financial.cashDeficit > 0
            ? Number(financial.cashDeficit)
            : Number(financial.cashInHand || 0);
          const isDeficit   = financial.cashDeficit > 0;

          const barLabels = ['Contract\nValue', 'Total\nBilled', 'Received', 'Balance\nReceivable', 'Un-Billed', 'Total\nProcurement', 'Paid\n(Vendors)', 'Pending\nPayments', isDeficit ? 'Cash\nDeficit' : 'Cash\nin Hand'];
          const barColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#f59e0b', '#ef4444', '#06b6d4', '#f59e0b', isDeficit ? '#ef4444' : '#22c55e'];
          const barValues = [totalVal, billed, received, balRec, unBilled, procurement, paid, pendPay, cashAbs];

          const clientDonut = [
            { name: 'Received',    value: received,  color: '#22c55e' },
            { name: 'Balance Rec', value: balRec,    color: '#ef4444' },
            { name: 'Un-Billed',   value: unBilled,  color: '#f59e0b' },
          ].filter(d => d.value > 0);

          const vendorDonut = [
            { name: 'Paid',    value: paid,    color: '#06b6d4' },
            { name: 'Pending', value: pendPay, color: '#f59e0b' },
          ].filter(d => d.value > 0);

          return (
            <div>

              {/* ── Main bar chart — static preview with Expand button ── */}
              <div style={{ background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart3 size={16} style={{ color: '#3b82f6' }} /> Financial Overview — All Figures (₹)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setFinBarShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: finBarShowLabels ? '#eff6ff' : 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {finBarShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {finBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                    <button
                      onClick={() => setChartModal({ type: 'finOverviewBar', barLabels, barValues, barColors })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Eye size={13} /> Expand & Zoom
                    </button>
                  </div>
                </div>
                {/* Static non-zoomable preview using Recharts — labels stay horizontal (2-line wrap).
                    minPointSize guarantees every bar a minimum visible sliver — without it, a
                    bar like ₹19,470 next to ₹4.52 Cr rounds to 0px tall and disappears entirely,
                    along with its label. The real amount is still shown exactly via the label
                    and tooltip; only the drawn bar height gets a floor. */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barLabels.map((l, i) => ({ name: l, value: barValues[i], fill: barColors[i] }))} margin={{ top: finBarShowLabels ? 26 : 10, right: 10, left: 10, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={<MultilineAxisTick />} interval={0} height={44} />
                    <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                    {!finBarShowLabels && (
                      <Tooltip formatter={(v) => [formatCurrency(v), 'Amount']} contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                    )}
                    <Bar dataKey="value" radius={[4,4,0,0]} minPointSize={(value) => (value === 0 ? 2 : 4)}>
                      {barLabels.map((_, i) => <Cell key={i} fill={barColors[i] + 'cc'} stroke={barColors[i]} strokeWidth={1.5} />)}
                      {finBarShowLabels && (
                        <LabelList
                          dataKey="value"
                          position="top"
                          formatter={v => formatCurrency(v)}
                          style={{ fontSize: 10, fontWeight: 700, fill: 'var(--ct-1e293b,#1e293b)' }}
                        />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 11, color: 'var(--ct-94a3b8,#94a3b8)', textAlign: 'center', marginTop: 4 }}>
                  Click "Expand &amp; Zoom" to enable scroll-to-zoom and drag-to-pan · use "{finBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}" to toggle the value labels on the bars
                </p>
              </div>

              {/* ── Two donuts side by side ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PieChart size={14} style={{ color: '#8b5cf6' }} /> Client Billing Breakdown
                  </div>
                  {clientDonut.length > 0 ? (
                    <ProjDonutChart data={clientDonut} height={240} labelKey="name" valueKey="value" colorKey="color" showAmount amountFormatter={formatCurrency} />
                  ) : (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ct-94a3b8,#94a3b8)', fontSize: 13 }}>No data</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' }}>
                    {[
                      { label: 'Received',    color: '#22c55e', val: formatCurrency(received) },
                      { label: 'Balance Rec', color: '#ef4444', val: formatCurrency(balRec) },
                      { label: 'Un-Billed',   color: '#f59e0b', val: formatCurrency(unBilled) },
                    ].map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--ct-374151,#374151)', fontWeight: 600 }}>{l.label}:</span>
                        <span style={{ color: l.color, fontWeight: 700 }}>{l.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PieChart size={14} style={{ color: '#06b6d4' }} /> Vendor Payment Breakdown
                  </div>
                  {vendorDonut.length > 0 ? (
                    <ProjDonutChart data={vendorDonut} height={240} labelKey="name" valueKey="value" colorKey="color" showAmount amountFormatter={formatCurrency} />
                  ) : (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ct-94a3b8,#94a3b8)', fontSize: 13 }}>No data</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' }}>
                    {[
                      { label: 'Paid',    color: '#06b6d4', val: formatCurrency(paid) },
                      { label: 'Pending', color: '#f59e0b', val: formatCurrency(pendPay) },
                    ].map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--ct-374151,#374151)', fontWeight: 600 }}>{l.label}:</span>
                        <span style={{ color: l.color, fontWeight: 700 }}>{l.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      {/* Client Billing */}
      <div className="dashboard-section">
        <h3 className="section-title"><Receipt size={20} />Client Billing &amp; Collection</h3>
        <div className="metrics-grid">
          {[
            { icon: <IndianRupee size={24} />, title: 'Total Billed',        val: formatCurrency(financial.totalBilled),    sub: ['Total invoices raised'], cls: [] },
            { icon: <CheckCircle size={24} />, title: 'Amount Received',     val: formatCurrency(financial.totalReceived),  sub: [`${financial.billingPercentage?.toFixed(1)}% Collected`, 'From clients'], cls: ['success', null] },
            { icon: <Clock size={24} />,       title: 'Pending Receipts',    val: formatCurrency(financial.pendingReceipts),sub: [`${(100 - (financial.billingPercentage || 0)).toFixed(1)}% Pending`, 'Yet to collect'], cls: ['warning', null] },
            { icon: <TrendingUp size={24} />,  title: 'Collection Progress', val: `${financial.billingPercentage?.toFixed(1)}%`, sub: null, progress: financial.billingPercentage, progressClass: 'success' },
          ].map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-header">{m.icon}<span className="metric-title">{m.title}</span></div>
              <div className="metric-value">{m.val}</div>
              {m.sub && <div className="metric-breakdown">{m.sub.map((s, j) => s && <span key={j} className={`metric-item ${m.cls?.[j] || ''}`}>{s}</span>)}</div>}
              {m.progress !== undefined && (
                <div className="metric-breakdown">
                  <div className="progress-bar-container"><div className={`progress-bar-fill ${m.progressClass}`} style={{ width: `${m.progress || 0}%` }} /></div>
                  <span className="metric-item">Collection progress</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vendor Payments */}
      <div className="dashboard-section">
        <h3 className="section-title"><CreditCard size={20} />Vendor Payments (Procurement)</h3>
        <div className="metrics-grid">
          {[
            { icon: <IndianRupee size={24} />, title: 'Total Procurement',  val: formatCurrency(financial.totalPayable),   sub: ['All vendor bills'], cls: [] },
            { icon: <CheckCircle size={24} />, title: 'Amount Paid',        val: formatCurrency(financial.totalPaid),      sub: [`${financial.paymentPercentage?.toFixed(1)}% Paid`, 'To vendors'], cls: ['success', null] },
            { icon: <AlertCircle size={24} />, title: 'Pending Payments',   val: formatCurrency(financial.pendingPayments),sub: [`${(100 - (financial.paymentPercentage || 0)).toFixed(1)}% Pending`, 'Due to vendors'], cls: ['danger', null] },
            { icon: <Activity size={24} />,    title: 'Payment Progress',   val: `${financial.paymentPercentage?.toFixed(1)}%`, sub: null, progress: financial.paymentPercentage, progressClass: 'warning' },
          ].map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-header">{m.icon}<span className="metric-title">{m.title}</span></div>
              <div className="metric-value">{m.val}</div>
              {m.sub && <div className="metric-breakdown">{m.sub.map((s, j) => s && <span key={j} className={`metric-item ${m.cls?.[j] || ''}`}>{s}</span>)}</div>}
              {m.progress !== undefined && (
                <div className="metric-breakdown">
                  <div className="progress-bar-container"><div className={`progress-bar-fill ${m.progressClass}`} style={{ width: `${m.progress || 0}%` }} /></div>
                  <span className="metric-item">Vendor payment completion</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Procurement Summary */}
      <div className="dashboard-section">
        <h3 className="section-title"><ShoppingCart size={20} />Procurement Summary</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header"><FileText size={24} /><span className="metric-title">Purchase Orders</span></div>
            <div className="metric-value">{procurement.totalPOs || 0}</div>
            <div className="metric-breakdown">
              <span className="metric-item success"><CheckCircle size={14} />{procurement.deliveredPOs || 0} Delivered</span>
              <span className="metric-item">Value: {formatCurrency(procurement.totalPOValue)}</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-header"><Package size={24} /><span className="metric-title">Delivery Rate</span></div>
            <div className="metric-value">{procurement.deliveryRate?.toFixed(1) || 0}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-header"><FileText size={24} /><span className="metric-title">Quotations</span></div>
            <div className="metric-value">{procurement.totalQuotations || 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-header"><Users size={24} /><span className="metric-title">Active Vendors</span></div>
            <div className="metric-value">{procurement.totalVendors || 0}</div>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Budget vs Received | Received vs Spent */}
      <div className="dashboard-charts-grid">
        {/* Top Projects Budget Bar — expands ONLY via the expand button */}
        {topByBudget.length > 0 ? (
          <div className="chart-card" style={{ height: 320 }}>
            <div className="chart-header">
              <h4 className="chart-title"><BarChart3 size={16} />Top Projects — Budget vs Received</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={e => { e.stopPropagation(); setBudgetBarShowLabels(v => !v); }}
                  title="Toggle the amount label shown on top of each bar"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: budgetBarShowLabels ? '#eff6ff' : 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {budgetBarShowLabels ? <EyeOff size={11} /> : <Eye size={11} />} {budgetBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setChartModal({ type: 'budgetBar' }); }}
                  title="Open this chart in a large view"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-white,#fff)', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  🔍 Click to expand
                </button>
              </div>
            </div>
            <ChartJSBar
              key="top-budget-bar-stable"
              labels={topBudgetLabels}
              datasets={topBudgetDatasets}
              height={264}
              yTickFormatter={formatCurrency}
              showValueLabels={budgetBarShowLabels}
              valueLabelFormatter={formatCurrency}
            />
          </div>
        ) : (
          <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Budget vs Received</h4></div><EmptyChart /></div>
        )}

        {/* Received vs Spent grouped bars — card itself is NOT clickable,
            expands ONLY via the button. */}
        {contributionData.length > 0 ? (
          <div className="chart-card" style={{ height: 320 }}>
            <div className="chart-header">
              <h4 className="chart-title">
                <BarChart3 size={15} />
                {data.scope === 'SUBGROUP' ? 'Projects — Received vs Spent (₹)' : data.scope === 'GROUP' ? 'Sub-groups — Received vs Spent (₹)' : 'Groups — Received vs Spent (₹)'}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={e => { e.stopPropagation(); setRvsShowLabels(v => !v); }}
                  title="Toggle the amount label shown on top of each bar"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: rvsShowLabels ? '#eff6ff' : 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {rvsShowLabels ? <EyeOff size={11} /> : <Eye size={11} />} {rvsShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setChartModal({ type: 'contributionBar' }); }}
                  title="Open this chart in a large view"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-white,#fff)', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  🔍 Click to expand
                </button>
              </div>
            </div>
            <ChartJSBar
              key="rvs-bar-stable"
              labels={rvsLabels}
              datasets={rvsDatasets}
              height={264}
              yTickFormatter={formatCurrency}
              showValueLabels={rvsShowLabels}
              valueLabelFormatter={formatCurrency}
            />
          </div>
        ) : (
          <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Received vs Spent</h4></div><EmptyChart /></div>
        )}
      </div>

      {/* ── Charts Row 2: Project Status Distribution | Turnover Share ── */}
      {contributionData.length > 1 && (
        <div className="dashboard-section">
          <div className="dashboard-charts-grid">
            {/* Status Pie */}
            {statusDistribution.length > 0 ? (
              <div className="chart-card" style={{ height: 360 }}>
                <div className="chart-header">
                  <h4 className="chart-title"><PieChart size={16} />Project Status Distribution</h4>
                </div>
                <ProjDonutChart
                  key="status-pie-stable"
                  data={statusPieData}
                  height={304}
                  labelKey="name"
                  valueKey="value"
                  colorKey="color"
                />
              </div>
            ) : (
              <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Status Distribution</h4></div><EmptyChart /></div>
            )}

            {/* Pie chart — % contribution */}
            <div className="chart-card" style={{ height: 360 }}>
              <div className="chart-header">
                <h4 className="chart-title">
                  <PieChart size={15} />
                  {data.scope === 'SUBGROUP' ? 'Project Turnover Share (%)' : data.scope === 'GROUP' ? 'Sub-group Turnover Share (%)' : 'Group Turnover Share (%)'}
                </h4>
              </div>
              <ProjDonutChart
                key="contrib-pie-stable"
                data={contributionPieData}
                height={304}
                labelKey="name"
                valueKey="value"
                showAmount
                amountFormatter={formatCurrency}
              />
            </div>
          </div>
        </div>
      )}

      {/* Projects Breakdown Table */}
      {projects.length > 0 && (
        <div className="dashboard-section" ref={breakdownRef}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              <Briefcase size={20} />Projects Breakdown
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#6b7280' }}>
                ({filteredProjects.length}{statusFilter !== 'ALL' ? ` ${statusFilter.replace(/_/g,' ')}` : ''} of {projects.length} total)
              </span>
            </h3>
            {/* Export + Status filter pills row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

              {/* ── Export button ── */}
              <div ref={exportMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setExportMenuOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                    border: '1.5px solid #3b82f6',
                    background: exportMenuOpen ? '#3b82f6' : 'transparent',
                    color: exportMenuOpen ? '#fff' : '#3b82f6',
                    fontSize: 13, fontWeight: 700,
                    transition: 'all 0.15s',
                    boxShadow: exportMenuOpen ? '0 2px 8px rgba(59,130,246,0.30)' : 'none',
                  }}>
                  <FiDownload size={14} />
                  Export
                </button>

                {exportMenuOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                    background: isDark ? '#1b2130' : '#fff',
                    border: `1px solid ${isDark ? '#2b3445' : '#e2e8f0'}`,
                    borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    minWidth: 190, zIndex: 9999, overflow: 'hidden',
                  }}>
                    {/* Dropdown header */}
                    <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${isDark ? '#2b3445' : '#f1f5f9'}` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Choose Format</span>
                    </div>
                    {/* Excel option */}
                    <button
                      onClick={exportExcel}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: `1px solid ${isDark ? '#1e293b' : '#f8fafc'}`,
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? '#1e293b' : '#f0fdf4'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FiGrid size={16} style={{ color: '#16a34a' }} />
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>Excel Format</div>
                        <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 1 }}>.xlsx — with summary sheet</div>
                      </div>
                    </button>
                    {/* PDF option */}
                    <button
                      onClick={exportPDF}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? '#1e293b' : '#fef2f2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FiFileText size={16} style={{ color: '#dc2626' }} />
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>PDF Format</div>
                        <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 1 }}>.pdf — print-ready A4 landscape</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Status filter pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ALL','NOT_STARTED','PLANNING','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED'].filter(s =>
                s === 'ALL' || projects.some(p => p.status === s || p.status?.replace(/ /g,'_') === s)
              ).map(s => {
                const colors = { NOT_STARTED:'#64748b', COMPLETED:'#22c55e', IN_PROGRESS:'#06b6d4', PLANNING:'#f59e0b', ON_HOLD:'#8b5cf6', CANCELLED:'#ef4444', ALL:'#3b82f6' };
                const active = statusFilter === s;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    style={{
                      padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                      border: `1.5px solid ${colors[s]}`,
                      background: active ? colors[s] : 'transparent',
                      color: active ? '#fff' : colors[s],
                      transition: 'all 0.15s'
                    }}>
                    {s === 'ALL' ? 'All' : s.replace(/_/g,' ')}
                  </button>
                );
              })}
            </div> {/* end filter pills */}
            </div> {/* end Export + filters row */}
          </div>
          <div className="agg-table-wrapper">
            {/* Sticky header sits outside the scroll area */}
            <div className="agg-table-scroll">
              <table className="agg-projects-table">
                <colgroup>
                  <col style={{ minWidth: 200 }} />  {/* Project */}
                  <col style={{ minWidth: 140 }} />  {/* Group/Category */}
                  <col style={{ minWidth: 110 }} />  {/* Capacity */}
                  <col style={{ minWidth: 110 }} />  {/* Status */}
                  <col style={{ minWidth: 130 }} />  {/* Progress */}
                  <col style={{ minWidth: 120 }} />  {/* Budget */}
                  <col style={{ minWidth: 110 }} />  {/* Billed */}
                  <col style={{ minWidth: 120 }} />  {/* Received */}
                  <col style={{ minWidth: 130 }} />  {/* Spent */}
                  <col style={{ minWidth: 120 }} />  {/* Pending Pay */}
                  <col style={{ minWidth: 70 }} />   {/* POs */}
                  <col style={{ minWidth: 90 }} />   {/* Delivered */}
                </colgroup>
                <thead>
                  <tr>
                    <th className="agg-th-left">Project</th>
                    <th className="agg-th-left">Group / Category</th>
                    <th className="agg-th-left">Capacity</th>
                    <th className="agg-th-left">Status</th>
                    <th className="agg-th-left">Progress</th>
                    <th className="agg-th-right">Order Value</th>
                    <th className="agg-th-right">Invoice Raised</th>
                    <th className="agg-th-right">Amount Received</th>
                    <th className="agg-th-right">Vendor Payments</th>
                    <th className="agg-th-right">Pending Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p, i) => {
                    const statusColors = { NOT_STARTED: '#64748b', COMPLETED: '#22c55e', IN_PROGRESS: '#3b82f6', PLANNING: '#f59e0b', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444' };
                    const pct = autoProgress(p);
                    const isUpdating = updatingProject === p.projectId;
                    const cap = capacityByProjectId[p.projectId];
                    const capLabel = cap ? formatCapacityQty(cap.quantity, cap.unit) : null;
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'agg-tr-even' : 'agg-tr-odd'}>
                        <td className="agg-td-left">
                          <div className="agg-proj-name">{p.projectName}</div>
                          <div className="agg-proj-id">{p.projectId}</div>
                        </td>
                        <td className="agg-td-left">
                          <div className="agg-group-name">{p.groupId || '-'}</div>
                          <div className="agg-subgroup-name">{p.subGroupName || ''}</div>
                        </td>
                        {/* Capacity — looked up from the capacity/quantity dataset by projectId */}
                        <td className="agg-td-left">
                          {capLabel ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', background: 'rgba(14,165,233,0.12)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                              ⚡ {capLabel}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        {/* Clickable status badge — opens inline editor */}
                        <td className="agg-td-left">
                          <button
                            className="agg-status-badge agg-status-btn"
                            title="Click to update status"
                            disabled={isUpdating}
                            onClick={() => setEditProgressModal({ project: p })}
                            style={{
                              background: (statusColors[p.status] || '#94a3b8') + '22',
                              color: statusColors[p.status] || '#94a3b8',
                              border: `1.5px solid ${(statusColors[p.status] || '#94a3b8')}55`,
                              cursor: 'pointer',
                            }}>
                            {isUpdating ? '…' : (p.status?.replace(/_/g, ' ') || '—')}
                          </button>
                        </td>
                        {/* Progress bar cell */}
                        <td className="agg-td-left" style={{ minWidth: 130 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 99, transition: 'width 0.4s',
                                width: `${pct}%`,
                                background: pct >= 100 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444'
                              }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', minWidth: 34 }}>{pct}%</span>
                            {p.progressPercentage == null && (
                              <span title="Auto-calculated from received amount" style={{ fontSize: 9, color: '#94a3b8' }}>auto</span>
                            )}
                          </div>
                        </td>
                        <td className="agg-td-right agg-val-default">{formatCurrency(p.budget)}</td>
                        <td className="agg-td-right agg-val-default">{formatCurrency(p.billed)}</td>
                        <td className="agg-td-right agg-val-green">{formatCurrency(p.received)}</td>
                        <td className="agg-td-right agg-val-red">{formatCurrency(p.spent)}</td>
                        <td className="agg-td-right agg-val-amber">{formatCurrency(p.pendingPay)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="agg-tfoot-row">
                    <td colSpan={5} className="agg-td-left agg-tfoot-label">TOTAL — {projects.length} projects</td>
                    <td className="agg-td-right">{formatCurrency(financial.totalProjectValue)}</td>
                    <td className="agg-td-right">{formatCurrency(financial.totalBilled)}</td>
                    <td className="agg-td-right agg-val-green">{formatCurrency(financial.totalReceived)}</td>
                    <td className="agg-td-right agg-val-red">{formatCurrency(financial.totalPaid)}</td>
                    <td className="agg-td-right agg-val-amber">{formatCurrency(financial.pendingPayments)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ── Chart Expand Modal ──────────────────────────────────────────────────── */}
      {chartModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.72)', backdropFilter:'blur(6px)',
          zIndex:10300, display:'flex', alignItems:'center', justifyContent:'center', padding:24
        }}>
          <div style={{
            background: isDark ? '#1b2130' : '#fff', borderRadius:16, width:'100%', maxWidth:900, maxHeight:'90vh',
            display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(0,0,0,0.28)', overflow:'hidden'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:'16px 24px', borderBottom: isDark ? '1px solid #2b3445' : '1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color: isDark ? '#e7ecf3' : '#1e293b', display:'flex', alignItems:'center', gap:8 }}>
                {chartModal.type === 'statusPie' && <><PieChart size={18} /> Project Status Distribution</>}
                {chartModal.type === 'budgetBar' && <><BarChart3 size={18} /> Top Projects — Budget vs Received</>}
                {chartModal.type === 'contributionBar' && <><BarChart3 size={18} /> {data.scope === 'SUBGROUP' ? 'Projects' : data.scope === 'GROUP' ? 'Sub-groups' : 'Groups'} — Received vs Spent (₹)</>}
                {chartModal.type === 'contributionPie' && <><PieChart size={18} /> {data.scope === 'SUBGROUP' ? 'Project' : data.scope === 'GROUP' ? 'Sub-group' : 'Group'} Turnover Share (%)</>}
                {chartModal.type === 'finOverviewBar' && <><BarChart3 size={18} /> Financial Overview — All Figures (₹)</>}
              </h3>
              <button onClick={() => setChartModal(null)} style={{ background: isDark ? '#2b3445' : '#f1f5f9', color: isDark ? '#e7ecf3' : '#1e293b', border:'none', cursor:'pointer', padding:'6px 10px', borderRadius:8, fontWeight:700, fontSize:16 }}>✕</button>
            </div>
            {/* Chart body */}
            <div style={{ flex:1, padding:'20px 24px', overflow:'auto' }}>
              {chartModal.type === 'statusPie' && statusDistribution.length > 0 && (
                <ProjDonutChart
                  data={statusDistribution.map(d => ({ name: d.name, value: d.value, color: statusColor[d.name] }))}
                  height={440}
                  labelKey="name"
                  valueKey="value"
                  colorKey="color"
                  modal={true}
                />
              )}
              {chartModal.type === 'budgetBar' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      onClick={() => setBudgetBarShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: isDark ? '1px solid #2b3445' : '1px solid #e2e8f0', background: budgetBarShowLabels ? (isDark ? 'rgba(59,130,246,0.18)' : '#eff6ff') : (isDark ? '#232b3b' : '#fff'), color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {budgetBarShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {budgetBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                  </div>
                  <ChartJSBar
                    labels={topByBudget.map(d => d.name)}
                    datasets={[
                      { label: 'Budget',   data: topByBudget.map(d => d.budget),   backgroundColor: '#93c5fd', borderColor: '#60a5fa', borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
                      { label: 'Received', data: topByBudget.map(d => d.received), backgroundColor: '#6ee7b7', borderColor: '#34d399', borderWidth: 1.5, borderRadius: 0, borderSkipped: false },
                    ]}
                    height={400}
                    yTickFormatter={v => formatCurrency(v)}
                    showValueLabels={budgetBarShowLabels}
                    valueLabelFormatter={formatCurrency}
                    modal={true}
                  />
                </>
              )}
              {chartModal.type === 'contributionBar' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      onClick={() => setRvsShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: isDark ? '1px solid #2b3445' : '1px solid #e2e8f0', background: rvsShowLabels ? (isDark ? 'rgba(59,130,246,0.18)' : '#eff6ff') : (isDark ? '#232b3b' : '#fff'), color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {rvsShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {rvsShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                  </div>
                  <ChartJSBar
                    labels={rvsLabels}
                    datasets={rvsDatasets}
                    height={Math.max(400, contributionData.length * 60 + 120)}
                    yTickFormatter={formatCurrency}
                    showValueLabels={rvsShowLabels}
                    valueLabelFormatter={formatCurrency}
                    modal={true}
                  />
                </>
              )}
              {chartModal.type === 'contributionPie' && (
                <ProjDonutChart
                  data={contributionPieData}
                  height={460}
                  labelKey="name"
                  valueKey="value"
                  modal={true}
                  showAmount
                  amountFormatter={formatCurrency}
                />
              )}
              {chartModal.type === 'finOverviewBar' && chartModal.barLabels && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      onClick={() => setFinBarShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: isDark ? '1px solid #2b3445' : '1px solid #e2e8f0', background: finBarShowLabels ? (isDark ? 'rgba(59,130,246,0.18)' : '#eff6ff') : (isDark ? '#232b3b' : '#fff'), color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {finBarShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {finBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                  </div>
                  <ChartJSBar
                    labels={chartModal.barLabels.map(l => l.split('\n'))}
                    datasets={[{
                      label: 'Amount (₹)',
                      data: chartModal.barValues,
                      backgroundColor: chartModal.barColors.map(c => c + 'cc'),
                      borderColor: chartModal.barColors,
                      borderWidth: 2,
                      borderRadius: 0,
                      borderSkipped: false,
                    }]}
                    height={440}
                    yTickFormatter={v => formatCurrency(v)}
                    xLabelRotation={0}
                    showValueLabels={finBarShowLabels}
                    valueLabelFormatter={formatCurrency}
                    modal={true}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Status & Progress Modal ──────────────────────────────────────── */}
      {editProgressModal && (() => {
        const ep = editProgressModal.project;
        const statusColors = { NOT_STARTED: '#64748b', COMPLETED: '#22c55e', IN_PROGRESS: '#3b82f6', PLANNING: '#f59e0b', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444' };
        const handleSave = () => {
          updateProjectStatusProgress(ep.projectId, epStatus, epPct);
          setEditProgressModal(null);
        };
        // Auto-set to 100 when COMPLETED selected
        const handleStatusChange = (s) => {
          setEpStatus(s);
          if (s === 'COMPLETED') setEpPct(100);
          if (s === 'PLANNING') setEpPct(0);
        };
        return (
          <div style={{
            position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)',
            zIndex:10400, display:'flex', alignItems:'center', justifyContent:'center', padding:24
          }}>
            <div style={{
              background:'#fff', borderRadius:16, width:'100%', maxWidth:480,
              boxShadow:'0 24px 60px rgba(0,0,0,0.22)', overflow:'hidden'
            }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ background: `linear-gradient(135deg, ${statusColors[epStatus] || '#3b82f6'}ee, ${statusColors[epStatus] || '#3b82f6'}bb)`, padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ color:'rgba(255,255,255,0.8)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Update Project</div>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:16, marginTop:2 }}>{ep.projectName}</div>
                    <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{ep.projectId}</div>
                  </div>
                  <button onClick={() => setEditProgressModal(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', color:'#fff', padding:8, borderRadius:8, fontSize:18 }}>✕</button>
                </div>
              </div>
              <div style={{ padding:24 }}>
                {/* Status selector */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:8 }}>Project Status</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['NOT_STARTED','PLANNING','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED'].map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)} style={{
                        padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                        border:`2px solid ${statusColors[s] || '#94a3b8'}`,
                        background: epStatus === s ? statusColors[s] : 'transparent',
                        color: epStatus === s ? '#fff' : statusColors[s],
                        transition:'all 0.15s'
                      }}>{s.replace(/_/g,' ')}</button>
                    ))}
                  </div>
                </div>
                {/* Progress slider */}
                <div style={{ marginBottom:24 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>Completion Progress</label>
                    <span style={{ fontSize:20, fontWeight:800, color: statusColors[epStatus] || '#3b82f6' }}>{epPct}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={epPct}
                    onChange={e => setEpPct(Number(e.target.value))}
                    style={{ width:'100%', accentColor: statusColors[epStatus] || '#3b82f6' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#94a3b8', marginTop:4 }}>
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                  {/* Progress bar preview */}
                  <div style={{ marginTop:10, height:10, background:'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:99, transition:'width 0.3s',
                      width:`${epPct}%`,
                      background: epPct >= 100 ? '#22c55e' : epPct >= 60 ? '#3b82f6' : epPct >= 30 ? '#f59e0b' : '#ef4444'
                    }} />
                  </div>
                  {/* Smart hint */}
                  <div style={{ marginTop:8, fontSize:11, color:'#6b7280', background:'#f8fafc', padding:'8px 12px', borderRadius:8 }}>
                    💡 <strong>Auto rules:</strong> COMPLETED → 100% · NOT_STARTED / PLANNING → 0% · IN_PROGRESS → weighted from PO delivery + invoicing + payments
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setEditProgressModal(null)} style={{
                    flex:1, padding:'10px 0', borderRadius:8, border:'1.5px solid #e2e8f0',
                    background:'#fff', color:'#374151', fontWeight:600, cursor:'pointer', fontSize:14
                  }}>Cancel</button>
                  <button onClick={handleSave} style={{
                    flex:2, padding:'10px 0', borderRadius:8, border:'none',
                    background: statusColors[epStatus] || '#3b82f6', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14
                  }}>Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Status Filter Modal ──────────────────────────────────────────────── */}
      {statusModal && (() => {
        const statusMeta = {
          NOT_STARTED: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', light: '#f1f5f9', icon: <Target size={18} />,      label: 'Not Started' },
          COMPLETED:   { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', light: '#dcfce7', icon: <CheckCircle size={18} />, label: 'Completed' },
          IN_PROGRESS: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', light: '#dbeafe', icon: <Activity size={18} />,    label: 'In Progress' },
          PLANNING:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a', light: '#fef3c7', icon: <Target size={18} />,      label: 'Planning' },
          ON_HOLD:     { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', light: '#ede9fe', icon: <Clock size={18} />,       label: 'On Hold' },
          CANCELLED:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', light: '#fee2e2', icon: <XCircle size={18} />,     label: 'Cancelled' },
        };
        const meta = statusMeta[statusModal.status] || { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', light: '#dbeafe', icon: <Briefcase size={18} />, label: statusModal.status };
        const totalBudget   = statusModal.projects.reduce((s,p)=>s+(Number(p.budget)||0),0);
        const totalReceived = statusModal.projects.reduce((s,p)=>s+(Number(p.received)||0),0);
        const totalSpent    = statusModal.projects.reduce((s,p)=>s+(Number(p.spent)||0),0);
        const totalPending  = statusModal.projects.reduce((s,p)=>s+(Number(p.pendingPay)||0),0);
        return (
          <div style={{
            position:'fixed', inset:0, background:'rgba(15,23,42,0.65)', backdropFilter:'blur(4px)',
            zIndex:10200, display:'flex', alignItems:'center', justifyContent:'center', padding:20
          }}>
            <div style={{
              background:'#fff', borderRadius:16, width:'100%', maxWidth:960,
              maxHeight:'88vh', display:'flex', flexDirection:'column',
              boxShadow:'0 32px 80px rgba(0,0,0,0.28)', overflow:'hidden',
            }} onClick={e => e.stopPropagation()}>

              {/* ── Colored Header ── */}
              <div style={{
                background: `linear-gradient(135deg, ${meta.color}ee, ${meta.color}cc)`,
                padding: '18px 24px', flexShrink: 0,
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:10, padding:8, display:'flex', color:'#fff' }}>
                      {meta.icon}
                    </div>
                    <div>
                      <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11, fontWeight:600, letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:2 }}>
                        Project Status
                      </div>
                      <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                        {meta.label} Projects
                        <span style={{ fontSize:13, fontWeight:500, background:'rgba(255,255,255,0.22)', borderRadius:20, padding:'2px 10px' }}>
                          {statusModal.projects.length}
                        </span>
                      </h3>
                    </div>
                  </div>
                  <button onClick={() => setStatusModal(null)}
                    style={{ background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', color:'#fff', padding:8, borderRadius:8, display:'flex', transition:'background 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'}>
                    <X size={18} />
                  </button>
                </div>

                {/* Summary KPI strip */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:16 }}>
                  {[
                    { label: 'Total Order Value', value: formatCurrency(totalBudget),   icon: <Wallet size={14} /> },
                    { label: 'Amount Received',   value: formatCurrency(totalReceived), icon: <TrendingUp size={14} /> },
                    { label: 'Vendor Paid',        value: formatCurrency(totalSpent),    icon: <ShoppingCart size={14} /> },
                    { label: 'Pending Payable',    value: formatCurrency(totalPending),  icon: <AlertCircle size={14} /> },
                  ].map((k, i) => (
                    <div key={i} style={{ background:'rgba(255,255,255,0.18)', borderRadius:10, padding:'10px 14px', backdropFilter:'blur(4px)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, color:'rgba(255,255,255,0.75)', fontSize:11, marginBottom:4 }}>
                        {k.icon} {k.label}
                      </div>
                      <div style={{ color:'#fff', fontWeight:800, fontSize:15 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Table ── */}
              <div style={{ overflow:'auto', flex:1, padding:'0' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', position:'sticky', top:0, zIndex:2 }}>
                      <th style={{ padding:'12px 16px', textAlign:'left', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>#</th>
                      <th style={{ padding:'12px 16px', textAlign:'left', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Project</th>
                      <th style={{ padding:'12px 16px', textAlign:'left', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>Group / Sub-group</th>
                      <th style={{ padding:'12px 16px', textAlign:'right', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>Order Value</th>
                      <th style={{ padding:'12px 16px', textAlign:'right', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>Received</th>
                      <th style={{ padding:'12px 16px', textAlign:'right', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>Vendor Paid</th>
                      <th style={{ padding:'12px 16px', textAlign:'right', borderBottom:`2px solid ${meta.border}`, color:'#374151', fontWeight:700, fontSize:11.5, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>Pending Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusModal.projects.map((p, i) => {
                      const collPct = totalBudget > 0 ? Math.min(100, (Number(p.received||0)/Number(p.budget||1))*100) : 0;
                      return (
                        <tr key={i}
                          style={{ background: i % 2 === 0 ? '#fff' : '#fafbfd', transition:'background 0.12s', cursor:'default' }}
                          onMouseEnter={e=>e.currentTarget.style.background=meta.light}
                          onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafbfd'}>
                          <td style={{ padding:'11px 16px', borderBottom:'1px solid #f1f5f9', color:'#94a3b8', fontWeight:600, fontSize:12 }}>{i+1}</td>
                          <td style={{ padding:'11px 16px', borderBottom:'1px solid #f1f5f9', maxWidth:260 }}>
                            <div style={{ fontWeight:700, color:'#0f172a', fontSize:13, whiteSpace:'normal', wordBreak:'break-word', lineHeight:1.35 }}>{p.projectName}</div>
                            <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ background: meta.bg, color: meta.color, borderRadius:4, padding:'1px 6px', fontWeight:600, fontSize:10 }}>{p.projectId}</span>
                            </div>
                            {/* Mini collection progress bar */}
                            <div style={{ marginTop:5, height:3, background:'#e5e7eb', borderRadius:99, width:100, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${collPct}%`, background: meta.color, borderRadius:99, transition:'width 0.4s' }} />
                            </div>
                            <div style={{ fontSize:9.5, color:'#94a3b8', marginTop:2 }}>{collPct.toFixed(0)}% collected</div>
                          </td>
                          <td style={{ padding:'11px 16px', borderBottom:'1px solid #f1f5f9' }}>
                            {p.groupId && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#f1f5f9', color:'#374151', borderRadius:5, padding:'2px 8px', fontSize:11.5, fontWeight:600 }}>
                                <Layers size={10} /> {p.groupId}
                              </span>
                            )}
                            {p.subGroupName && <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:3 }}>{p.subGroupName}</div>}
                            {!p.groupId && !p.subGroupName && <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>}
                          </td>
                          <td style={{ padding:'11px 16px', textAlign:'right', borderBottom:'1px solid #f1f5f9', color:'#0f172a', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>{formatCurrency(p.budget)}</td>
                          <td style={{ padding:'11px 16px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                            <span style={{ color:'#16a34a' }}>{formatCurrency(p.received)}</span>
                          </td>
                          <td style={{ padding:'11px 16px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                            <span style={{ color:'#dc2626' }}>{formatCurrency(p.spent)}</span>
                          </td>
                          <td style={{ padding:'11px 16px', textAlign:'right', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>
                            <span style={{
                              background: Number(p.pendingPay)>0 ? '#fff7ed' : '#f0fdf4',
                              color: Number(p.pendingPay)>0 ? '#d97706' : '#16a34a',
                              borderRadius:6, padding:'2px 8px', fontSize:12
                            }}>{formatCurrency(p.pendingPay)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:`linear-gradient(135deg, ${meta.color}18, ${meta.color}0a)`, position:'sticky', bottom:0, zIndex:2 }}>
                      <td colSpan={3} style={{ padding:'12px 16px', borderTop:`2px solid ${meta.border}`, color: meta.color, fontWeight:800, fontSize:12.5, letterSpacing:'0.3px' }}>
                        TOTAL — {statusModal.projects.length} project{statusModal.projects.length!==1?'s':''}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right', borderTop:`2px solid ${meta.border}`, color:'#0f172a', fontWeight:800, fontSize:13, whiteSpace:'nowrap' }}>{formatCurrency(totalBudget)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', borderTop:`2px solid ${meta.border}`, color:'#16a34a', fontWeight:800, fontSize:13, whiteSpace:'nowrap' }}>{formatCurrency(totalReceived)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', borderTop:`2px solid ${meta.border}`, color:'#dc2626', fontWeight:800, fontSize:13, whiteSpace:'nowrap' }}>{formatCurrency(totalSpent)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', borderTop:`2px solid ${meta.border}`, color:'#d97706', fontWeight:800, fontSize:13, whiteSpace:'nowrap' }}>{formatCurrency(totalPending)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
};

// ─── Single-project dashboard helpers ────────────────────────────────────────
// (A client-side re-derivation of the financial 40/30/20/10 score used to live
//  here as calculateProgress, purely to stand in for missing technical progress.
//  The financial score comes from the backend — dashboardData.progressBreakdown —
//  so the duplicate is gone rather than left to drift from it.)

// Headline progress = TECHNICAL (physical) — techProgressPct, null when the project
// has no scope. See utils/projectProgress for why there is no financial fallback.
// Financial progress (40/30/20/10) — shown separately, never blended into the headline.
const financialProgress = (d) => {
  const f = d?.progressBreakdown?.financialProgress;
  return f != null ? Number(Number(f).toFixed(1)) : 0;
};
const fmtPct1 = (v) => `${Number(v || 0).toFixed(1)}%`;

const getStatusColor = (s) => ({
  NOT_STARTED: '#64748b', PLANNING: '#f59e0b', IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444',
}[s] || '#94a3b8');

// ─── Warehouse Issuance Block — needs own component so useState is valid ──────
function WarehouseIssuanceBlock({ wi, siteReturn, formatCurrency }) {
  const [expanded,  setExpanded]  = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('outward');
  const [modal,     setModal]     = React.useState(null); // null | 'outward' | 'inward'

  if (!wi) return null;

  const outwardLines = wi.issuanceLines || [];
  const inwardLines  = (siteReturn && siteReturn.lines) ? siteReturn.lines : [];

  const tabStyle = (tab) => ({
    padding: '5px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    background:  activeTab === tab ? '#0f172a' : '#fff',
    color:       activeTab === tab ? '#fff'    : '#64748b',
    borderColor: activeTab === tab ? '#0f172a' : '#e2e8f0',
    transition: 'all 0.15s',
  });

  // ── Shared table renderers ────────────────────────────────────────────────
  const OutwardTable = ({ lines, totalQty, totalValue, compact }) => (
    lines.length === 0
      ? <div style={{ padding:'28px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
          No materials received from warehouse for this project
        </div>
      : <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize: compact ? 12 : 13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Txn No','Date','Item Code','Item Name','Warehouse','Qty','Unit Cost (₹)','Value (₹)'].map(h => (
                  <th key={h} style={{ padding: compact ? '8px 12px' : '10px 14px',
                    textAlign: h.includes('₹') || h === 'Qty' ? 'right' : 'left',
                    borderBottom:'2px solid #e2e8f0', color:'#374151', fontWeight:700,
                    fontSize:11, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}
                  style={{ background: i%2===0 ? '#fff' : '#fafbfd' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafbfd'}>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:11.5, color:'#475569', whiteSpace:'nowrap' }}>{l.txnNo||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', whiteSpace:'nowrap' }}>{l.txnDate||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:11.5 }}>{l.itemCode||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', fontWeight:500, color:'#0f172a' }}>{l.itemName||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{l.warehouseName||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:600, color:'#1e40af' }}>
                    {Number(l.qtyIssued||0).toLocaleString('en-IN')}{l.unit ? <span style={{ fontSize:10, fontWeight:400, color:'#94a3b8', marginLeft:3 }}>{l.unit}</span> : null}
                  </td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', color:'#475569' }}>{formatCurrency(l.unitCost||0)}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:700, color:'#0f172a' }}>{formatCurrency(l.lineValue||0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f8fafc' }}>
                <td colSpan={5} style={{ padding: compact?'8px 12px':'10px 14px', borderTop:'2px solid #e2e8f0', fontWeight:700, fontSize:12, color:'#374151' }}>
                  Total — {lines.length} receipt{lines.length!==1?'s':''}
                </td>
                <td style={{ padding: compact?'8px 12px':'10px 14px', borderTop:'2px solid #e2e8f0', textAlign:'right', fontWeight:700, color:'#1e40af' }}>
                  {Number(totalQty||0).toLocaleString('en-IN')}
                </td>
                <td style={{ padding: compact?'8px 12px':'10px 14px', borderTop:'2px solid #e2e8f0' }}/>
                <td style={{ padding: compact?'8px 12px':'10px 14px', borderTop:'2px solid #e2e8f0', textAlign:'right', fontWeight:700, color:'#0f172a' }}>
                  {formatCurrency(totalValue||0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
  );

  const InwardTable = ({ lines, totalQty, compact }) => (
    lines.length === 0
      ? <div style={{ padding:'28px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
          No items returned to warehouse for this project
        </div>
      : <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize: compact ? 12 : 13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Txn No','Date','Item Code','Item Name','Warehouse','Qty'].map(h => (
                  <th key={h} style={{ padding: compact?'8px 12px':'10px 14px',
                    textAlign: h==='Qty' ? 'right' : 'left',
                    borderBottom:'2px solid #e2e8f0', color:'#374151', fontWeight:700,
                    fontSize:11, textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}
                  style={{ background: i%2===0 ? '#fff' : '#fafbfd' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafbfd'}>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:11.5, color:'#475569', whiteSpace:'nowrap' }}>{l.txnNo||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', whiteSpace:'nowrap' }}>{l.txnDate||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:11.5 }}>{l.itemCode||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', fontWeight:500, color:'#0f172a' }}>{l.itemName||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{l.warehouseName||'—'}</td>
                  <td style={{ padding: compact?'8px 12px':'10px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:600, color:'#15803d' }}>
                    {Number(l.qty||0).toLocaleString('en-IN')}{l.unit ? <span style={{ fontSize:10, fontWeight:400, color:'#94a3b8', marginLeft:3 }}>{l.unit}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f8fafc' }}>
                <td colSpan={5} style={{ padding: compact?'8px 12px':'10px 14px', borderTop:'2px solid #e2e8f0', fontWeight:700, fontSize:12, color:'#374151' }}>
                  Total — {lines.length} return{lines.length!==1?'s':''}
                </td>
                <td style={{ padding: compact?'8px 12px':'10px 14px', borderTop:'2px solid #e2e8f0', textAlign:'right', fontWeight:700, color:'#15803d' }}>
                  {Number(totalQty||0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
  );

  return (
    <>
      <div className="dashboard-section">
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 className="section-title" style={{ margin:0 }}>
            <Package size={20} style={{ marginRight:6 }} />
            Site Material &amp; Warehouse Returns
          </h3>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, background:'#f8fafc',
              border:'1px solid #e2e8f0', borderRadius:6, padding:'5px 12px',
              fontSize:12, color:'#374151', fontWeight:600, cursor:'pointer' }}>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {expanded ? 'Collapse' : 'Expand Details'}
          </button>
        </div>

        {/* KPI cards — clickable */}
        <div className="kpi-grid" style={{ marginTop:12 }}>
          {/* Received from Warehouse */}
          <div className="kpi-card" style={{ borderTopColor:'#3b82f6', cursor:'pointer' }}
            title="Click to view issued items detail"
            onClick={() => setModal('outward')}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(59,130,246,0.18)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow=''}>
            <div className="kpi-icon" style={{ color:'#3b82f6' }}><Package size={28}/></div>
            <div className="kpi-content">
              <div className="kpi-value">{wi.totalItemsIssued || 0}</div>
              <div className="kpi-label">Received from Warehouse</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
                Qty: {Number(wi.totalQtyIssued||0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize:10, color:'#3b82f6', marginTop:4, fontWeight:600 }}>View details →</div>
            </div>
          </div>

          {/* Issuance Value */}
          <div className="kpi-card" style={{ borderTopColor:'#8b5cf6', cursor:'pointer' }}
            title="Click to view issuance value detail"
            onClick={() => setModal('outward')}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(139,92,246,0.18)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow=''}>
            <div className="kpi-icon" style={{ color:'#8b5cf6' }}><IndianRupee size={28}/></div>
            <div className="kpi-content">
              <div className="kpi-value">{formatCurrency(wi.totalIssuanceValue||0)}</div>
              <div className="kpi-label">Issuance Value</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
                {wi.warehouseBillCount||0} bill{wi.warehouseBillCount!==1?'s':''} auto-generated
              </div>
              <div style={{ fontSize:10, color:'#8b5cf6', marginTop:4, fontWeight:600 }}>View details →</div>
            </div>
          </div>

          {/* Returned to Warehouse */}
          <div className="kpi-card" style={{ borderTopColor:'#22c55e', cursor:'pointer' }}
            title="Click to view returned items detail"
            onClick={() => setModal('inward')}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(34,197,94,0.18)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow=''}>
            <div className="kpi-icon" style={{ color:'#22c55e' }}><Package size={28}/></div>
            <div className="kpi-content">
              <div className="kpi-value">{wi.totalItemsReturned || 0}</div>
              <div className="kpi-label">Returned to Warehouse</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
                Value: {formatCurrency(wi.totalReturnValue||0)}
              </div>
              <div style={{ fontSize:10, color:'#22c55e', marginTop:4, fontWeight:600 }}>View details →</div>
            </div>
          </div>
        </div>

        {/* Inline expand — tabs + tables */}
        {expanded && (
          <div style={{ marginTop:16 }}>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <button style={tabStyle('outward')} onClick={() => setActiveTab('outward')}>
                ↑ Received from Warehouse ({outwardLines.length})
              </button>
              <button style={tabStyle('inward')} onClick={() => setActiveTab('inward')}>
                ↓ Returned to Warehouse ({inwardLines.length})
              </button>
            </div>
            {activeTab === 'outward' && (
              <OutwardTable lines={outwardLines} totalQty={wi.totalQtyIssued} totalValue={wi.totalIssuanceValue} compact />
            )}
            {activeTab === 'inward' && (
              <InwardTable lines={inwardLines} totalQty={siteReturn?.totalQtyReturned} compact />
            )}
          </div>
        )}
      </div>

      {/* ── Outward detail modal ─────────────────────────────────────────────── */}
      {modal === 'outward' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.65)', backdropFilter:'blur(4px)',
          zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:900,
            maxHeight:'88vh', display:'flex', flexDirection:'column',
            boxShadow:'0 24px 64px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9',
              display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>
                  Project Material Movements
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:'#0f172a', marginTop:2, display:'flex', alignItems:'center', gap:8 }}>
                  <Package size={20} style={{ color:'#3b82f6' }}/>
                  Items Received from Warehouse
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Total Value</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>{formatCurrency(wi.totalIssuanceValue||0)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Transactions</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#3b82f6' }}>{outwardLines.length}</div>
                </div>
                <button onClick={() => setModal(null)}
                  style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8,
                    padding:'8px 10px', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}>
                  <X size={16}/>
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div style={{ overflowY:'auto', padding:'16px 24px 24px', flex:1 }}>
              <OutwardTable lines={outwardLines} totalQty={wi.totalQtyIssued} totalValue={wi.totalIssuanceValue} />
            </div>
          </div>
        </div>
      )}

      {/* ── Inward detail modal ──────────────────────────────────────────────── */}
      {modal === 'inward' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.65)', backdropFilter:'blur(4px)',
          zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:860,
            maxHeight:'88vh', display:'flex', flexDirection:'column',
            boxShadow:'0 24px 64px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9',
              display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1 }}>
                  Project Material Movements
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:'#0f172a', marginTop:2, display:'flex', alignItems:'center', gap:8 }}>
                  <Package size={20} style={{ color:'#22c55e' }}/>
                  Items Returned to Warehouse
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Total Qty Returned</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#15803d' }}>
                    {Number(siteReturn?.totalQtyReturned||0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Returns</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#22c55e' }}>{inwardLines.length}</div>
                </div>
                <button onClick={() => setModal(null)}
                  style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8,
                    padding:'8px 10px', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}>
                  <X size={16}/>
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div style={{ overflowY:'auto', padding:'16px 24px 24px', flex:1 }}>
              <InwardTable lines={inwardLines} totalQty={siteReturn?.totalQtyReturned} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const ProjectDashboard = () => {
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showError } = useToast();
  const [loading, setLoading]           = useState(false);
  const [dashboardData, setDashboardData] = useState(null);   // single-project data
  const [aggData, setAggData]           = useState(null);      // aggregated data
  const [capacityData, setCapacityData] = useState(null);      // capacity block data
  const [projectCapacity, setProjectCapacity] = useState(null); // single-project capacity
  const [showSpentModal, setShowSpentModal] = useState(false); // Amount Spent breakdown modal
  const [showCashModal,  setShowCashModal]  = useState(false); // Cash Deficit/In-Hand breakdown modal
  const [showProfitModal, setShowProfitModal] = useState(false); // Profit breakdown modal
  const [showProgressModal, setShowProgressModal] = useState(false); // Technical vs Financial progress breakdown
  const [progressPhases, setProgressPhases] = useState(null); // tech-scope phases for the breakdown modal
  const [projChartModal, setProjChartModal] = useState(null); // single-project chart expand modal
  const [projFinViewMode, setProjFinViewMode] = useState('cards'); // 'cards' | 'table' | 'graph' — Project Financial Overview
  const [projFinBarShowLabels, setProjFinBarShowLabels] = useState(true); // toggle: amount labels on Project Financial Overview bars
  const [showActivitiesModal, setShowActivitiesModal] = useState(false); // Recent Activities — full list
  const [showTimelineModal, setShowTimelineModal] = useState(false); // Project Timeline — full list
  const [projSpendingShowLabels, setProjSpendingShowLabels] = useState(true); // toggle: amount labels on Monthly Spending Trend
  const _projThemeVersion = useThemeVersion(); // re-render inline-styled financial views on theme toggle
  const isDark = React.useMemo(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark',
    [_projThemeVersion]
  );


  // ── Stable chart props ─────────────────────────────────────────────────
  // ChartJSBar destroys & rebuilds its canvas whenever labels/datasets change
  // identity. Without memoising, these arrays were rebuilt as new objects on
  // EVERY render of this component — including renders triggered by unrelated
  // state like opening the Recent Activities / Project Timeline "View All"
  // modals — which made Top Categories (and, via the same pattern, Monthly
  // Spending Trend's modal chart) visibly flash/rebuild for no real reason.
  const topCategoriesLabels = React.useMemo(
    () => (dashboardData?.procurementData?.categoryDistribution || [])
      .map(d => d.name || d.category || d.label || 'Uncategorized'),
    [dashboardData?.procurementData?.categoryDistribution]
  );
  const topCategoriesDatasets = React.useMemo(() => {
    const cats = dashboardData?.procurementData?.categoryDistribution || [];
    return [{
      label: 'Value',
      data: cats.map(d => d.value),
      backgroundColor: cats.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length] + 'cc'),
      borderColor: cats.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
      borderWidth: 1.5,
      borderRadius: 0,
      borderSkipped: false,
    }];
  }, [dashboardData?.procurementData?.categoryDistribution]);

  const spendingTrendLabels = React.useMemo(
    () => (dashboardData?.spendingTrend || []).map(d => d.month),
    [dashboardData?.spendingTrend]
  );
  const spendingTrendDatasets = React.useMemo(() => {
    const trend = dashboardData?.spendingTrend || [];
    // Bars show the monthly SPENDING amount (₹) — the trend line and the
    // Orders count series were removed as requested.
    return [
      {
        label: 'Spending',
        data: trend.map(d => d.spending),
        backgroundColor: '#6ee7b7',
        borderColor: '#34d399',
        borderWidth: 1.5,
        borderRadius: 0,
        borderSkipped: false,
      },
    ];
  }, [dashboardData?.spendingTrend]);

  // Determine which mode we are in
  const mode = projectId ? 'PROJECT' : groupName ? (subGroupName ? 'SUBGROUP' : 'GROUP') : 'ALL';

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id':   user?.id   || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json',
  });

  // ── Fetch single-project dashboard ────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchProjectDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/dashboard`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (res.ok) { setDashboardData(await res.json()); setAggData(null); }
      else if (res.status === 404) { showError('Project not found'); setDashboardData(null); }
      else { showError('Failed to load dashboard'); setDashboardData(null); }
    } catch { showError('Network error.'); setDashboardData(null); }
    finally { setLoading(false); }
  }, [projectId]);

  // ── Fetch aggregated dashboard ─────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAggregated = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (groupName)    params.append('groupName',    groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      const res = await fetch(`${API_BASE_URL}/projects/dashboard/aggregate?${params}`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (res.ok) { setAggData(await res.json()); setDashboardData(null); }
      else { showError('Failed to load aggregated dashboard'); setAggData(null); }
    } catch { showError('Network error.'); setAggData(null); }
    finally { setLoading(false); }
  }, [groupName, subGroupName]);

  // ── Fetch capacity/quantity summary from order book items ─────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchCapacity = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (groupName)    params.append('groupName',    groupName);
      if (subGroupName) params.append('subGroupName', subGroupName);
      const res = await fetch(`${API_BASE_URL}/projects/dashboard/capacity?${params}`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (res.ok) setCapacityData(await res.json());
      else setCapacityData(null);
    } catch { setCapacityData(null); }
  }, [groupName, subGroupName]);

  // ── React to filter changes ────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'PROJECT') {
      fetchProjectDashboard();
      setCapacityData(null);
      // Fetch capacity for the specific project via subGroupName (derived after dashboard loads)
      setProjectCapacity(null);
    }
    else { setProjectCapacity(null); fetchAggregated(); fetchCapacity(); }
  }, [mode, projectId, groupName, subGroupName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch capacity for single project using filter context (subGroupName is known from dropdown) ─
  useEffect(() => {
    if (!dashboardData?.projectId) return;
    // subGroupName & groupName are already in scope from useGroupProjectFilters
    if (!subGroupName) return;
    const params = new URLSearchParams();
    if (groupName) params.append('groupName', groupName);
    params.append('subGroupName', subGroupName);
    fetch(`${API_BASE_URL}/projects/dashboard/capacity?${params}`, {
      credentials: 'include', headers: getAuthHeaders(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.subGroups?.length) { setProjectCapacity(null); return; }
        const sgEntry = data.subGroups[0];
        const proj = sgEntry?.projects?.find(p => p.projectId === dashboardData.projectId);
        if (proj)       setProjectCapacity({ value: proj.quantity,          unit: proj.unit });
        else if (sgEntry) setProjectCapacity({ value: sgEntry.totalQuantity, unit: sgEntry.unit });
        else            setProjectCapacity(null);
      })
      .catch(() => setProjectCapacity(null));
  }, [dashboardData?.projectId, subGroupName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (mode === 'PROJECT') fetchProjectDashboard();
    else { fetchAggregated(); fetchCapacity(); }
  };

  // ── Scope label for aggregated view ────────────────────────────────────────
  const getScopeLabel = () => {
    if (mode === 'ALL')      return 'All Projects — Company-wide Overview';
    if (mode === 'GROUP')    return `${groupName} — Group Overview`;
    if (mode === 'SUBGROUP') return `${groupName} › ${subGroupName} — Category Overview`;
    return '';
  };

  const EmptyChart = ({ message = 'No data available' }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}>
        <BarChart3 size={48} style={{ margin: '0 auto 10px', opacity: .3 }} /><p>{message}</p>
      </div>
    </div>
  );

  return (
    <div className="project-dashboard-container">
      {loading && <CrmPreloader text="Loading dashboard…" />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="project-dashboard-header">
        <div className="project-dashboard-breadcrumb">Dashboard › Projects › Project Dashboard</div>
        <div className="page-header-with-filter">
          <h1 className="project-dashboard-title"><BarChart3 size={28} /> Project Dashboard</h1>
          <div className="header-actions">
            <GroupProjectFilter
              groupValue={groupName} subGroupValue={subGroupName}
              projectValue={projectId} onChange={updateFilters}
            />
          </div>
        </div>
      </div>

      {/* ── AGGREGATED VIEW (All / Group / SubGroup) ───────────────────────── */}
      {mode !== 'PROJECT' && (
        aggData ? (
          <AggregatedDashboard
            data={aggData}
            scopeLabel={getScopeLabel()}
            onRefresh={handleRefresh}
            loading={loading}
            capacityData={capacityData}
          />
        ) : !loading ? (
          <div className="project-dashboard-empty-state">
            <AlertCircle size={80} className="empty-state-icon" />
            <h2>No Data Available</h2>
            <p>Unable to load dashboard data. Please try again.</p>
            <button onClick={handleRefresh} className="dashboard-refresh-btn"><RefreshCw size={18} /> Retry</button>
          </div>
        ) : null
      )}

      {/* ── SINGLE PROJECT VIEW ────────────────────────────────────────────── */}
      {mode === 'PROJECT' && !dashboardData && !loading && (
        <div className="project-dashboard-empty-state">
          <AlertCircle size={80} className="empty-state-icon" />
          <h2>No Data Available</h2>
          <p>Unable to load project dashboard. Please try again.</p>
          <button onClick={handleRefresh} className="dashboard-refresh-btn"><RefreshCw size={18} /> Retry</button>
        </div>
      )}

      {mode === 'PROJECT' && dashboardData && (
        <>
          {/* Project Overview Card */}
          <div className="project-overview-card">
            <div className="project-overview-header">
              <div className="project-overview-info">
                <h2>{dashboardData.projectName || 'Untitled Project'}</h2>
                <div className="project-meta">
                  <span className="project-code"><Building2 size={14} />{dashboardData.projectId}</span>
                  <span className="project-status-badge" style={{ backgroundColor: getStatusColor(dashboardData.status) }}>
                    {dashboardData.status}
                  </span>
                  {dashboardData.location && (
                    <span className="project-location"><MapPin size={14} />{dashboardData.location}</span>
                  )}
                </div>
              </div>
              <div className="project-progress-section" style={{ cursor: 'pointer' }}
                title="Click for the technical vs financial breakdown"
                onClick={async () => {
                  setShowProgressModal(true);
                  try {
                    const id = dashboardData.projectId || dashboardData.uniqueId;
                    const res = await projectsApi.getScope(id);
                    setProgressPhases(res?.success ? (res.data?.phases || []) : []);
                  } catch { setProgressPhases([]); }
                }}>
                <div className="progress-circle">
                  {(() => {
                    const tech = techProgressPct(dashboardData);
                    return (
                      <svg viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                        <circle cx="60" cy="60" r="54" fill="none"
                          stroke={getStatusColor(dashboardData.status)} strokeWidth="12"
                          strokeDasharray={`${(tech ?? 0) * 3.39} 339`}
                          strokeLinecap="round" transform="rotate(-90 60 60)" />
                        <text x="60" y="54" textAnchor="middle" className="progress-value">
                          {tech != null ? `${tech}%` : NO_TECH_PROGRESS}
                        </text>
                        <text x="60" y="70" textAnchor="middle" className="progress-label">
                          {tech != null ? 'Technical' : 'No scope'}
                        </text>
                      </svg>
                    );
                  })()}
                </div>
                <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                  Financial: <strong style={{ color: '#0f172a' }}>{financialProgress(dashboardData)}%</strong>
                  <span style={{ marginLeft: 6, color: '#3b82f6' }}>🔍 details</span>
                </div>
              </div>
            </div>
            <div className="project-overview-details">
              {[
                [<Calendar size={18} />, 'Notice to Proceed',     formatDate(dashboardData.startDate)],
                [<Calendar size={18} />, 'Scheduled Completion Date',  formatDate(dashboardData.endDate)],
                [<User size={18} />,     'Project Manager',       dashboardData.manager || 'Not Assigned'],
                [<IndianRupee size={18} />, 'Total Project Value', formatCurrency(dashboardData.budget)],
                ...(projectCapacity ? [[<span style={{ fontSize: 16 }}>⚡</span>, 'Capacity', (() => {
                  const n = Number(projectCapacity.value);
                  const u = (projectCapacity.unit || '').toLowerCase();
                  if (u === 'kw' || u === 'kwp') return n >= 1000 ? `${(n/1000).toFixed(2)} MW` : `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} kW`;
                  if (u === 'mw' || u === 'mwp') return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} MW`;
                  return `${n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2)} ${projectCapacity.unit || 'Units'}`;
                })()]] : []),
              ].map(([icon, label, val], i) => (
                <div key={i} className="project-detail-item">
                  {icon}
                  <div>
                    <span className="detail-label">{label}</span>
                    <span className="detail-value">{val}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Overview */}
          {dashboardData.financialData && (
            <>
              <div className="dashboard-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                  <h3 className="section-title" style={{ margin: 0 }}><IndianRupee size={20} />Project Financial Overview</h3>
                  <div style={{ display: 'flex', gap: 6, background: 'var(--c-f1f5f9, #f1f5f9)', borderRadius: 10, padding: 4, border: '1px solid var(--c-e2e8f0, #e2e8f0)' }} className="fin-view-toggle">
                    {[
                      { key: 'cards', icon: <LayoutGrid size={13} />, label: 'Tiles' },
                      { key: 'table', icon: <ListIcon  size={13} />, label: 'List' },
                      { key: 'graph', icon: <PieChart  size={13} />, label: 'Graphical' },
                    ].map(tab => (
                      <button key={tab.key}
                        onClick={() => setProjFinViewMode(tab.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                          background: projFinViewMode === tab.key ? 'var(--c-white, #fff)' : 'transparent',
                          color: projFinViewMode === tab.key ? '#0b63d6' : 'var(--ct-64748b, #64748b)',
                          boxShadow: projFinViewMode === tab.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                        }}>
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {projFinViewMode === 'cards' && (
                <div className="kpi-grid">
                  {[
                    { icon: <Wallet size={36} />, color: '#3b82f6', val: fmtKpi(dashboardData.financialData.totalProjectValue), label: 'Contract Value', sub: 'Project budget (agreed)' },
                    { icon: <FileText size={36} />, color: '#6366f1', val: fmtKpi(dashboardData.financialData.amountToBeReceived), label: 'Total Invoiced', sub: 'Raised to client (incl. GST)' },
                    {
                      icon: <TrendingDown size={36} />, color: '#f59e0b',
                      val: fmtKpi((dashboardData.financialData.totalSpent || 0) + (dashboardData.financialData.totalEmployeeExpenses || 0)),
                      label: 'Amount Spent',
                      sub: 'Paid to vendors (net of returns) + Approved Expenses',
                      clickable: true,
                    },
                    ...(dashboardData.financialData.isCompleted ? [(() => {
                      const p = dashboardData.financialData.projectedProfit ?? 0;
                      const isLoss = p < 0;
                      return {
                        icon: <Target size={36} />, color: isLoss ? '#ef4444' : '#22c55e',
                        val: fmtKpi(Math.abs(p)),
                        label: isLoss ? 'In Loss' : 'Net Profit',
                        sub: `${Math.abs(dashboardData.financialData.profitMargin ?? 0).toFixed(1)}% margin · Received − Paid − Expenses − Net GST`,
                        clickable: true,
                        onClick: () => setShowProfitModal(true),
                      };
                    })()] : []),
                  ].map((k, i) => (
                    <div
                      key={i}
                      className={`kpi-card${k.clickable ? ' kpi-card-clickable' : ''}`}
                      style={{ borderTopColor: k.color }}
                      onClick={k.clickable ? (k.onClick || (() => setShowSpentModal(true))) : undefined}
                      title={k.clickable ? 'Click to see breakdown' : undefined}
                    >
                      <div className="kpi-icon" style={{ color: k.color }}>{k.icon}</div>
                      <div className="kpi-content">
                        <div className="kpi-value">{k.val}</div>
                        <div className="kpi-label">{k.label}{k.clickable && <span className="kpi-click-hint"> 🔍</span>}</div>
                        <div className="kpi-subtitle">{k.sub}</div>
                      </div>
                    </div>
                  ))}

                  {/* Cash Flow Card */}
                  <div
                    className="kpi-card kpi-card-clickable"
                    style={{ borderTopColor: dashboardData.financialData.cashDeficit > 0 ? '#ef4444' : '#22c55e' }}
                    onClick={() => setShowCashModal(true)}
                    title="Click to see cash flow breakdown"
                  >
                    <div className="kpi-icon" style={{ color: dashboardData.financialData.cashDeficit > 0 ? '#ef4444' : '#22c55e' }}><Wallet size={36} /></div>
                    <div className="kpi-content">
                      <div className="kpi-value">
                        {fmtKpi(dashboardData.financialData.cashDeficit > 0
                          ? dashboardData.financialData.cashDeficit
                          : dashboardData.financialData.cashInHand || 0)}
                      </div>
                      <div className="kpi-label">{dashboardData.financialData.cashDeficit > 0 ? 'Cash Deficit' : 'Cash in Hand'}<span className="kpi-click-hint"> 🔍</span></div>
                      <div className="kpi-subtitle">{dashboardData.financialData.cashDeficit > 0 ? 'Paid more than received' : 'Received minus paid'}</div>
                    </div>
                  </div>
                </div>
                )}

        {projFinViewMode === 'table' && (() => {
          const totalVal    = Number(dashboardData.financialData.totalProjectValue  || 0);
          const billed      = Number(dashboardData.financialData.amountToBeReceived        || 0);
          const received    = Number(dashboardData.financialData.amountReceived      || 0);
          const balRec      = Number(dashboardData.financialData.pendingReceipts    || 0);
          const unBilled    = Math.max(0, totalVal - billed);
          const procurement = Number(dashboardData.financialData.totalPayable       || 0);
          const paid        = Number(dashboardData.financialData.amountPaid          || 0);
          const pendPay     = Number(dashboardData.financialData.pendingPayments    || 0);
          const cashAbs     = dashboardData.financialData.cashDeficit > 0
            ? Number(dashboardData.financialData.cashDeficit)
            : Number(dashboardData.financialData.cashInHand || 0);
          const isDeficit   = dashboardData.financialData.cashDeficit > 0;
          const pct = (num, den) => den > 0 ? +((num / den) * 100).toFixed(1) : 0;
          // Shows the unit that actually matches formatCurrency's own threshold for
          // this value, instead of a hardcoded "Cr's" label on every row.
          const unitLabel = (v) => {
            const abs = Math.abs(Number(v) || 0);
            if (abs >= 10000000) return "Cr's";
            if (abs >= 100000) return "Lc's";
            return '₹';
          };

          // Simplified, single-accent palette: every row uses the SAME neutral
          // text/value colour (matching the rest of the page's tables), so the
          // list reads cleanly instead of a different colour per row. Status is
          // still communicated — just narrowed to the small badge pill instead
          // of being smeared across the whole row.
          const tone = (kind) => {
            const map = {
              header: { bg: isDark ? '#16263f' : '#1e3a5f', text: '#ffffff', val: '#ffffff', pct: '#ffffff' },
              plain:  { bg: 'transparent', text: isDark ? '#e7ecf3' : '#1e293b', val: null, pct: isDark ? '#c2cbd8' : '#475569' },
            };
            return map[kind] || map.plain;
          };
          const badgeTone = (kind) => {
            const map = {
              success: { bg: isDark ? 'rgba(34,197,94,0.22)'  : '#dcfce7', col: isDark ? '#86efac' : '#15803d' },
              danger:  { bg: isDark ? 'rgba(239,68,68,0.24)'  : '#fee2e2', col: isDark ? '#fca5a5' : '#b91c1c' },
              warning: { bg: isDark ? 'rgba(245,158,11,0.24)' : '#fef3c7', col: isDark ? '#fcd34d' : '#92400e' },
              info:    { bg: isDark ? 'rgba(6,182,212,0.24)'  : '#cffafe', col: isDark ? '#67e8f9' : '#0e7490' },
            };
            return map[kind] || map.success;
          };

          const receivedOverInvoiced = pct(received, billed) > 100;

          const rows = [
            // ── CLIENT BILLING ──────────────────────────────────────────────
            { group: 'Client Billing & Collection', groupIcon: '💰', isGroupHeader: true },
            { label: 'Total Contract Value',    ref: 'a',       val: totalVal,    pctVal: 100,                        t: tone('header'), isHdr: true },
            { label: 'Billed Amount',           ref: 'b',       val: billed,      pctVal: pct(billed,totalVal),       t: tone('plain') },
            { label: 'Received Amount',         ref: 'c',       val: received,    pctVal: pct(received,billed),       t: tone('plain'), badge: receivedOverInvoiced ? '⚠ Over-Received' : '✓ Collected', badgeKind: receivedOverInvoiced ? 'warning' : 'success' },
            ...(receivedOverInvoiced ? [{
              isNote: true,
              noteText: 'Received More Amount Than Invoiced — client has paid more than the billed value (likely an advance receipt; raise/adjust an invoice to match).',
            }] : []),
            { label: 'Balance Receivable',      ref: 'd = b−c', val: balRec,      pctVal: pct(balRec,billed),         t: tone('plain'), badge: '⚠ Pending', badgeKind: 'danger', bold: true },
            { label: 'Un-Billed Contract Value',ref: 'e = a−b', val: unBilled,    pctVal: pct(unBilled,totalVal),     t: tone('plain'), badge: '◷ Not Billed', badgeKind: 'warning', bold: true },
            // ── VENDOR PAYMENTS ─────────────────────────────────────────────
            { group: 'Vendor Procurement & Payments', groupIcon: '🧾', isGroupHeader: true },
            { label: 'Total Procurement',       ref: 'f',       val: procurement, pctVal: pct(procurement,totalVal),  t: tone('plain') },
            { label: 'Total Paid to Vendors',   ref: 'g',       val: paid,        pctVal: pct(paid,procurement),      t: tone('plain'), badge: '✓ Paid', badgeKind: 'success' },
            { label: 'Pending Vendor Payments', ref: 'h = f−g', val: pendPay,     pctVal: pct(pendPay,procurement),   t: tone('plain'), badge: '⚠ Pending', badgeKind: 'danger', bold: true },
            // ── CASH POSITION ───────────────────────────────────────────────
            { group: 'Cash Position',           groupIcon: isDeficit ? '🔴' : '🟢', isGroupHeader: true },
            { label: isDeficit ? 'Cash Deficit' : 'Cash in Hand', ref: 'c − g', val: cashAbs, pctVal: pct(cashAbs,totalVal), t: tone('plain'), badge: isDeficit ? '🔴 Deficit' : '🟢 Surplus', badgeKind: isDeficit ? 'danger' : 'success', bold: true },
          ];

          // Column header config
          const colHdrs = ['Particulars', 'Ref #', 'Units', 'Value (₹)', '% Share', 'Status'];
          const headerBg   = isDark ? '#0f1726' : '#1e293b';
          const wrapBorder = isDark ? '#2b3445' : 'var(--c-e2e8f0,#e2e8f0)';
          const zebraEven  = isDark ? '#1b2233' : 'var(--c-white,#fff)';
          const zebraOdd   = isDark ? '#171e2c' : 'var(--c-f8fafc,#f8fafc)';
          const rowBorder  = isDark ? '#262f42' : 'var(--c-f1f5f9,#f1f5f9)';

          return (
            <div className="fin-list-table" style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${wrapBorder}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 90px 160px 110px 130px', background: headerBg, padding: '10px 20px', gap: 8 }}>
                {colHdrs.map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>

              {rows.map((row, ri) => {
                // ── Group header row ──────────────────────────────────────
                if (row.isGroupHeader) return (
                  <div key={ri} style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,41,59,0.05)', borderTop: ri > 0 ? `1px solid ${rowBorder}` : 'none', padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11 }}>{row.groupIcon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#93c5fd' : '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{row.group}</span>
                  </div>
                );

                // ── Inline note row (e.g. over-received warning) ───────────
                if (row.isNote) return (
                  <div key={ri} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 20px',
                    background: isDark ? 'rgba(245,158,11,0.10)' : '#fffbeb',
                    borderBottom: `1px solid ${rowBorder}`,
                  }}>
                    <AlertCircle size={13} style={{ color: isDark ? '#fbbf24' : '#b45309', flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: isDark ? '#fcd34d' : '#92400e' }}>{row.noteText}</span>
                  </div>
                );

                const isHdr = row.isHdr;
                const t = row.t;
                const baseBg = isHdr ? t.bg : (ri % 2 === 0 ? zebraEven : zebraOdd);
                // Header row keeps its dark navy background on hover (just a touch lighter)
                // so the white text stays legible — a light accent wash here is what made it
                // unreadable in light theme.
                const hoverBg = isHdr
                  ? (isDark ? '#1c3155' : '#274d80')
                  : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.035)');
                return (
                  <div key={ri}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 110px 90px 160px 110px 130px',
                      padding: '12px 20px', gap: 8,
                      background: baseBg,
                      borderBottom: `1px solid ${rowBorder}`,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
                  >
                    {/* Particulars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span style={{ fontSize: isHdr ? 14 : 13, fontWeight: row.bold || isHdr ? 700 : 500, color: t.text }}>{row.label}</span>
                    </div>
                    {/* Ref — visible pill chip instead of low-contrast monospace text */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700,
                        color: isHdr ? '#ffffff' : (isDark ? '#93c5fd' : '#1d4ed8'),
                        padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
                      }}>{row.ref}</span>
                    </div>
                    {/* Units — visible chip instead of low-contrast muted text */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12.5, fontWeight: 700,
                        color: isHdr ? 'rgba(255,255,255,0.92)' : (isDark ? '#cbd5e1' : '#475569'),
                        padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
                      }}>{unitLabel(row.val)}</span>
                    </div>
                    {/* Value — coloured to match this row's status badge (if any),
                        so the figure and its status read as one signal */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: isHdr ? 16 : 14, fontWeight: 800, color: isHdr ? t.val : (row.badgeKind ? badgeTone(row.badgeKind).col : t.text) }}>
                      {formatCurrency(row.val)}
                    </div>
                    {/* % */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.pct }}>{row.pctVal.toFixed(1)}%</span>
                    </div>
                    {/* Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {row.badge ? (() => {
                        const bt = badgeTone(row.badgeKind);
                        return (
                          <span style={{ color: bt.col, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {row.badge}
                          </span>
                        );
                      })() : <span style={{ fontSize: 11, color: isDark ? '#7a869c' : 'var(--ct-94a3b8,#94a3b8)' }}>—</span>}
                    </div>
                  </div>
                );
              })}

              {/* Footer note */}
              <div style={{ background: isDark ? '#171e2c' : 'var(--c-f8fafc,#f8fafc)', borderTop: `1px solid ${wrapBorder}`, padding: '8px 20px' }}>
                <span style={{ fontSize: 11, color: isDark ? '#8a96aa' : 'var(--ct-94a3b8,#94a3b8)' }}>
                  % — Billed/Balance as % of Contract · Received as % of Billed · Paid/Pending as % of Procurement · Cash as % of Contract
                </span>
              </div>
            </div>
          );
        })()}

        {projFinViewMode === 'graph' && (() => {
          const totalVal    = Number(dashboardData.financialData.totalProjectValue  || 0);
          const billed      = Number(dashboardData.financialData.amountToBeReceived        || 0);
          const received    = Number(dashboardData.financialData.amountReceived      || 0);
          const balRec      = Number(dashboardData.financialData.pendingReceipts    || 0);
          const unBilled    = Math.max(0, totalVal - billed);
          const procurement = Number(dashboardData.financialData.totalPayable       || 0);
          const paid        = Number(dashboardData.financialData.amountPaid          || 0);
          const pendPay     = Number(dashboardData.financialData.pendingPayments    || 0);
          // Computed locally (instead of trusting backend %-fields, which can use a
          // different denominator) so the KPI strip always matches the bar amounts below.
          const pctOf       = (num, den) => den > 0 ? (num / den) * 100 : 0;
          const cashAbs     = dashboardData.financialData.cashDeficit > 0
            ? Number(dashboardData.financialData.cashDeficit)
            : Number(dashboardData.financialData.cashInHand || 0);
          const isDeficit   = dashboardData.financialData.cashDeficit > 0;

          const barLabels = ['Contract\nValue', 'Total\nBilled', 'Received', 'Balance\nReceivable', 'Un-Billed', 'Total\nProcurement', 'Paid\n(Vendors)', 'Pending\nPayments', isDeficit ? 'Cash\nDeficit' : 'Cash\nin Hand'];
          const barColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#f59e0b', '#ef4444', '#06b6d4', '#f59e0b', isDeficit ? '#ef4444' : '#22c55e'];
          const barValues = [totalVal, billed, received, balRec, unBilled, procurement, paid, pendPay, cashAbs];

          const clientDonut = [
            { name: 'Received',    value: received,  color: '#22c55e' },
            { name: 'Balance Rec', value: balRec,    color: '#ef4444' },
            { name: 'Un-Billed',   value: unBilled,  color: '#f59e0b' },
          ].filter(d => d.value > 0);

          const vendorDonut = [
            { name: 'Paid',    value: paid,    color: '#06b6d4' },
            { name: 'Pending', value: pendPay, color: '#f59e0b' },
          ].filter(d => d.value > 0);

          return (
            <div>

              {/* ── Main bar chart — static preview with Expand button ── */}
              <div style={{ background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart3 size={16} style={{ color: '#3b82f6' }} /> Financial Overview — All Figures (₹)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setProjFinBarShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: projFinBarShowLabels ? '#eff6ff' : 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {projFinBarShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {projFinBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                    <button
                      onClick={() => setProjChartModal({ type: 'projFinOverviewBar', barLabels, barValues, barColors })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Eye size={13} /> Expand & Zoom
                    </button>
                  </div>
                </div>
                {/* Static non-zoomable preview using Recharts — labels stay horizontal (2-line wrap).
                    minPointSize guarantees every bar a minimum visible sliver — without it, a
                    bar like ₹19,470 next to ₹4.52 Cr rounds to 0px tall and disappears entirely,
                    along with its label. The real amount is still shown exactly via the label
                    and tooltip; only the drawn bar height gets a floor. */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barLabels.map((l, i) => ({ name: l, value: barValues[i], fill: barColors[i] }))} margin={{ top: projFinBarShowLabels ? 26 : 10, right: 10, left: 10, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={<MultilineAxisTick />} interval={0} height={44} />
                    <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                    {!projFinBarShowLabels && (
                      <Tooltip formatter={(v) => [formatCurrency(v), 'Amount']} contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                    )}
                    <Bar dataKey="value" radius={[4,4,0,0]} minPointSize={(value) => (value === 0 ? 2 : 4)}>
                      {barLabels.map((_, i) => <Cell key={i} fill={barColors[i] + 'cc'} stroke={barColors[i]} strokeWidth={1.5} />)}
                      {projFinBarShowLabels && (
                        <LabelList
                          dataKey="value"
                          position="top"
                          formatter={v => formatCurrency(v)}
                          style={{ fontSize: 10, fontWeight: 700, fill: 'var(--ct-1e293b,#1e293b)' }}
                        />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 11, color: 'var(--ct-94a3b8,#94a3b8)', textAlign: 'center', marginTop: 4 }}>
                  Click "Expand &amp; Zoom" to enable scroll-to-zoom and drag-to-pan · use "{projFinBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}" to toggle the value labels on the bars
                </p>
              </div>

              {/* ── Two donuts side by side ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PieChart size={14} style={{ color: '#8b5cf6' }} /> Client Billing Breakdown
                  </div>
                  {clientDonut.length > 0 ? (
                    <ProjDonutChart data={clientDonut} height={240} labelKey="name" valueKey="value" colorKey="color" showAmount amountFormatter={formatCurrency} />
                  ) : (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ct-94a3b8,#94a3b8)', fontSize: 13 }}>No data</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' }}>
                    {[
                      { label: 'Received',    color: '#22c55e', val: formatCurrency(received) },
                      { label: 'Balance Rec', color: '#ef4444', val: formatCurrency(balRec) },
                      { label: 'Un-Billed',   color: '#f59e0b', val: formatCurrency(unBilled) },
                    ].map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--ct-374151,#374151)', fontWeight: 600 }}>{l.label}:</span>
                        <span style={{ color: l.color, fontWeight: 700 }}>{l.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PieChart size={14} style={{ color: '#06b6d4' }} /> Vendor Payment Breakdown
                  </div>
                  {vendorDonut.length > 0 ? (
                    <ProjDonutChart data={vendorDonut} height={240} labelKey="name" valueKey="value" colorKey="color" showAmount amountFormatter={formatCurrency} />
                  ) : (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ct-94a3b8,#94a3b8)', fontSize: 13 }}>No data</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'center' }}>
                    {[
                      { label: 'Paid',    color: '#06b6d4', val: formatCurrency(paid) },
                      { label: 'Pending', color: '#f59e0b', val: formatCurrency(pendPay) },
                    ].map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--ct-374151,#374151)', fontWeight: 600 }}>{l.label}:</span>
                        <span style={{ color: l.color, fontWeight: 700 }}>{l.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

              </div>

              {/* Client Billing */}
              <div className="dashboard-section">
                <h3 className="section-title"><Receipt size={20} />Client Billing &amp; Receipts</h3>
                <div className="metrics-grid">
                  {[
                    { icon: <IndianRupee size={24} />, title: 'Billed Amount',       val: formatCurrency(dashboardData.financialData.amountToBeReceived), sub: ['Total Invoice Raised'], cls: [] },
                    { icon: <CheckCircle size={24} />, title: 'Amount Received',     val: formatCurrency(dashboardData.financialData.amountReceived),      sub: [`${dashboardData.financialData.billingPercentage?.toFixed(1)}% Received`, dashboardData.financialData.advanceAmount > 0 ? `Advances: ${formatCurrency(dashboardData.financialData.advanceAmount)}` : null, dashboardData.financialData.invoicePaymentAmount > 0 ? `Invoices: ${formatCurrency(dashboardData.financialData.invoicePaymentAmount)}` : null].filter(Boolean), cls: ['success', null, null] },
                    { icon: <Clock size={24} />,       title: 'Pending Receipts',    val: formatCurrency(dashboardData.financialData.pendingReceipts),     sub: [`${(100 - (dashboardData.financialData.billingPercentage || 0)).toFixed(1)}% Pending`, 'Yet to collect'], cls: ['warning', null] },
                    { icon: <TrendingUp size={24} />,  title: 'Collection Progress', val: `${dashboardData.financialData.billingPercentage?.toFixed(1)}%`, sub: null, progress: dashboardData.financialData.billingPercentage, progressClass: 'success' },
                  ].map((m, i) => (
                    <div key={i} className="metric-card">
                      <div className="metric-header">{m.icon}<span className="metric-title">{m.title}</span></div>
                      <div className="metric-value">{m.val}</div>
                      {m.sub && <div className="metric-breakdown">{m.sub.map((s, j) => s && <span key={j} className={`metric-item ${m.cls?.[j] || ''}`}>{s}</span>)}</div>}
                      {m.progress !== undefined && (
                        <div className="metric-breakdown">
                          <div className="progress-bar-container"><div className={`progress-bar-fill ${m.progressClass}`} style={{ width: `${m.progress || 0}%` }} /></div>
                          <span className="metric-item">Client payment collection</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Vendor Payments */}
              <div className="dashboard-section">
                <h3 className="section-title"><CreditCard size={20} />Vendor Payments (Procurement Spend)</h3>
                <div className="metrics-grid">
                  {[
                    { icon: <IndianRupee size={24} />, title: 'Total Procurement Cost', val: formatCurrency(dashboardData.financialData.totalPayable),   sub: ['Total bills from vendors'], cls: [] },
                    { icon: <CheckCircle size={24} />, title: 'Amount Paid',            val: formatCurrency(dashboardData.financialData.amountPaid),      sub: [`${dashboardData.financialData.paymentPercentage?.toFixed(1)}% Paid`, 'Same as Amount Spent above'], cls: ['success', null] },
                    { icon: <AlertCircle size={24} />, title: 'Pending Payments',       val: formatCurrency(dashboardData.financialData.pendingPayments), sub: [`${(100 - (dashboardData.financialData.paymentPercentage || 0)).toFixed(1)}% Pending`, 'Due to vendors'], cls: ['danger', null] },
                    { icon: <Activity size={24} />,    title: 'Payment Progress',       val: `${dashboardData.financialData.paymentPercentage?.toFixed(1)}%`, sub: null, progress: dashboardData.financialData.paymentPercentage, progressClass: 'warning' },
                  ].map((m, i) => (
                    <div key={i} className="metric-card">
                      <div className="metric-header">{m.icon}<span className="metric-title">{m.title}</span></div>
                      <div className="metric-value">{m.val}</div>
                      {m.sub && <div className="metric-breakdown">{m.sub.map((s, j) => s && <span key={j} className={`metric-item ${m.cls?.[j] || ''}`}>{s}</span>)}</div>}
                      {m.progress !== undefined && (
                        <div className="metric-breakdown">
                          <div className="progress-bar-container"><div className={`progress-bar-fill ${m.progressClass}`} style={{ width: `${m.progress || 0}%` }} /></div>
                          <span className="metric-item">Vendor payment completion</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <ExpenseDashboardSection expenseData={dashboardData.expenseData} projectId={projectId} />

              {dashboardData.financialData.isCompleted && (() => {
                const completedProfit = parseFloat(dashboardData.financialData.projectedProfit) || 0;
                const completedIsLoss = completedProfit < 0;
                const completedBg = completedIsLoss ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'linear-gradient(135deg,#22c55e,#16a34a)';
                return (
                <div className="dashboard-section" style={{ background: completedBg, color: '#fff' }}>
                  <h3 className="section-title" style={{ color: '#fff' }}>{completedIsLoss ? <AlertCircle size={20} /> : <CheckCircle size={20} />} Project Completed — {completedIsLoss ? 'Final Loss Summary' : 'Final Profit Summary'}</h3>
                  <div className="metrics-grid">
                    {[
                      ['Contract Value (Budget)',   formatCurrency(dashboardData.financialData.totalProjectValue),  'Agreed project contract amount'],
                      ['Received from Client',      formatCurrency(dashboardData.financialData.amountReceived ?? 0), 'Actual cash received (advances + invoice payments)'],
                      ['− Bills Paid to Vendors',   formatCurrency(dashboardData.financialData.amountPaid ?? 0),    'Actual payments made to vendors'],
                      ['− Approved Expenses',       formatCurrency(dashboardData.financialData.totalEmployeeExpenses ?? 0), 'Approved employee & project expenses'],
                      ['− Net GST (Invoice GST − Vendor GST)',
                        formatCurrency(Math.abs(parseFloat(dashboardData.financialData.netGST)||0)),
                        'Net GST always deducted from profit'],
                      [completedIsLoss ? '= In Loss' : '= Net Profit', formatCurrency(Math.abs(parseFloat(dashboardData.financialData.projectedProfit) || 0)), completedIsLoss ? 'Outflows exceeded cash received' : 'Received − Paid − Expenses − Net GST'],
                      [(completedIsLoss ? 'Loss' : 'Profit') + ' Margin', `${Math.abs(dashboardData.financialData.profitMargin ?? 0).toFixed(1)}%`, `(${completedIsLoss ? 'Loss' : 'Profit'} ÷ Amount Received) × 100`],
                    ].map(([title, val, sub], i) => (
                      <div key={i} className="metric-card" style={{ background: 'rgba(255,255,255,.1)', border: 'none' }}>
                        <div className="metric-header"><span className="metric-title" style={{ color: '#fff' }}>{title}</span></div>
                        <div className="metric-value" style={{ color: '#fff' }}>{val}</div>
                        <div className="metric-breakdown"><span className="metric-item" style={{ color: 'rgba(255,255,255,.8)' }}>{sub}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}
            </>
          )}

          {/* Warehouse Issuance Block */}
          {dashboardData.warehouseIssuanceData && (dashboardData.warehouseIssuanceData.totalItemsIssued > 0 || dashboardData.warehouseIssuanceData.totalItemsReturned > 0) && (
            <WarehouseIssuanceBlock
              wi={dashboardData.warehouseIssuanceData}
              siteReturn={dashboardData.siteReturnData}
              formatCurrency={formatCurrency} />
          )}

          {/* Procurement */}
          {dashboardData.procurementData && (
            <div className="dashboard-section">
              <h3 className="section-title"><ShoppingCart size={20} />Procurement Overview</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-header"><FileText size={24} /><span className="metric-title">Purchase Orders</span></div>
                  <div className="metric-value">{dashboardData.procurementData.totalPOs || 0}</div>
                  <div className="metric-breakdown">
                    <span className="metric-item success"><CheckCircle size={14} />{dashboardData.procurementData.deliveredPOs || 0} Delivered</span>
                    <span className="metric-item">Value: {formatCurrency(dashboardData.procurementData.totalPOValue)}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-header"><Package size={24} /><span className="metric-title">Delivery Rate</span></div>
                  <div className="metric-value">{dashboardData.procurementData.deliveryRate?.toFixed(1) || 0}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-header"><FileText size={24} /><span className="metric-title">Quotations</span></div>
                  <div className="metric-value">{dashboardData.procurementData.totalQuotations || 0}</div>
                  <div className="metric-breakdown"><span className="metric-item success">{dashboardData.procurementData.approvedQuotations || 0} Approved</span></div>
                </div>
                <div className="metric-card">
                  <div className="metric-header"><Users size={24} /><span className="metric-title">Active Vendors</span></div>
                  <div className="metric-value">{dashboardData.procurementData.activeVendors || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          {/* ── Single-project Charts Row ── */}
          <div className="dashboard-charts-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Spending Trend — full row, styled like "Financial Overview — All Figures":
                boxed card, static Recharts preview, Show/Hide Amounts toggle, explicit
                Expand & Zoom button (Chart.js, fully interactive) opens the modal. */}
            {dashboardData.spendingTrend?.length > 0 ? (
              <div style={{ gridColumn: '1 / -1', background: 'var(--c-f8fafc,#f8fafc)', border: '1px solid var(--c-e2e8f0,#e2e8f0)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ct-1e293b,#1e293b)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={16} style={{ color: '#3b82f6' }} /> Monthly Spending Trend
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setProjSpendingShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: projSpendingShowLabels ? '#eff6ff' : 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {projSpendingShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {projSpendingShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                    <button
                      onClick={() => setProjChartModal({ type: 'spendingTrend' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-white,#fff)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Eye size={13} /> Expand & Zoom
                    </button>
                  </div>
                </div>
                {/* Static non-zoomable preview using Recharts — bars show the monthly
                    SPENDING amount (₹) with the amount labelled on top of each bar.
                    The line series and the right-hand count axis were removed. */}
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={dashboardData.spendingTrend} margin={{ top: projSpendingShowLabels ? 26 : 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="left" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                    {!projSpendingShowLabels && (
                      <Tooltip
                        formatter={(v, name) => [formatCurrency(v), name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    )}
                    <Bar yAxisId="left" dataKey="spending" name="Spending" fill="#6ee7b7" stroke="#34d399" strokeWidth={1.5} radius={[4,4,0,0]} minPointSize={2}>
                      {projSpendingShowLabels && (
                        <LabelList dataKey="spending" position="top" formatter={v => formatCurrency(v)} style={{ fontSize: 10, fontWeight: 700, fill: '#059669' }} />
                      )}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 11, color: 'var(--ct-94a3b8,#94a3b8)', textAlign: 'center', marginTop: 4 }}>
                  Click "Expand &amp; Zoom" to enable scroll-to-zoom and drag-to-pan · use "{projSpendingShowLabels ? 'Hide Amounts' : 'Show Amounts'}" to toggle the value labels
                </p>
              </div>
            ) : (
              <div className="chart-card full-width"><div className="chart-header"><h4 className="chart-title">Monthly Spending Trend</h4></div><EmptyChart message="No spending data available" /></div>
            )}

            {/* PO Status Donut — static, no expand modal (simple 2-3 status
                breakdown doesn't need a separate zoom view) */}
            {dashboardData.procurementData?.posByStatus?.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title"><PieChart size={16} />PO Status Distribution</h4>
                </div>
                <ProjDonutChart
                  data={dashboardData.procurementData.posByStatus}
                  height={250}
                  labelKey="name"
                  valueKey="value"
                />
              </div>
            ) : (
              <div className="chart-card"><div className="chart-header"><h4 className="chart-title">PO Status Distribution</h4></div><EmptyChart message="No POs yet" /></div>
            )}

            {/* Top Categories Bar — expands ONLY via the expand button */}
            {dashboardData.procurementData?.categoryDistribution?.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title"><BarChart3 size={16} />Top Categories</h4>
                  <button
                    onClick={e => { e.stopPropagation(); setProjChartModal({ type: 'topCategories' }); }}
                    title="Open this chart in a large view"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-white,#fff)', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    🔍 Click to expand
                  </button>
                </div>
                <ChartJSBar
                  labels={topCategoriesLabels}
                  datasets={topCategoriesDatasets}
                  height={250}
                  yTickFormatter={v => formatCurrency(v)}
                  valueLabelFormatter={v => formatCurrency(v)}
                />
              </div>
            ) : (
              <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Top Categories</h4></div><EmptyChart message="No category data" /></div>
            )}
          </div>

          {/* Top Vendors */}
          {dashboardData.topVendors?.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title"><Users size={20} />Top Vendors</h3>
              <div className="vendors-list">
                {dashboardData.topVendors.map((v, i) => (
                  <div key={v.id} className="vendor-item">
                    <div className="vendor-rank">#{i + 1}</div>
                    <div className="vendor-info">
                      <div className="vendor-name">{v.name}</div>
                      <div className="vendor-meta"><span>{v.totalOrders} orders</span>{v.rating > 0 && <span>⭐ {v.rating}</span>}</div>
                    </div>
                    <div className="vendor-amount">{formatCurrency(v.totalPurchaseValue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Scope + Financial Progress & Timeline (Gantt) — reuses the
              ProgressTab from the project detail page so this dashboard shows the
              same planned-vs-actual phase Gantt (physical progress) AND the
              billing/cost financial timelines under each project. Physical progress
              is computed live from the scope phases (weighted), independent of the
              stored figure, so it is always current. */}
          {(dashboardData.projectId || dashboardData.uniqueId) && (
            <div className="dashboard-section">
              <h3 className="section-title"><BarChart3 size={20} />Progress &amp; Timeline</h3>
              {/* Key off the RESOLVED project id the dashboard already loaded
                  (project_unique_id), not the raw filter value — so the scope /
                  commercial fetches resolve the same project shown above. */}
              <ProgressTab
                orderBook={{ id: dashboardData.projectId || dashboardData.uniqueId }}
                /* Use projectsApi headers (send User-Id / User-Role, which /scope and
                   /commercial-summary-v2 require via @RequestHeader) — the dashboard's
                   own getAuthHeaders only sends the X-User-* variants, so those calls
                   would 400 and the charts would come back empty. */
                authHeaders={projectsApi.getAuthHeaders()}
                showError={showError}
                /* Dashboard shows only the tech-scope Gantt (renamed); the financial
                   Billing/Cost timelines are hidden here. */
                scheduleTitle="Tech Scope Progress (Planned vs Actual)"
                showFinancials={false}
              />
            </div>
          )}

          {/* Project Timeline + Recent Activities — combined side-by-side section.
              Timeline on the left, Activities on the right; each shows its 3 most
              recent entries with a "View All" button opening the full list in a modal. */}
          {(dashboardData.projectTimeline?.length > 0 || dashboardData.recentActivities?.length > 0) && (
            <div className="dashboard-section">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                {/* ── Project Timeline (left) ── */}
                {dashboardData.projectTimeline?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <h3 className="section-title" style={{ margin: 0 }}><Clock size={20} />Project Timeline</h3>
                      {dashboardData.projectTimeline.length > 3 && (
                        <button
                          onClick={() => setShowTimelineModal(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-f8fafc,#f8fafc)', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          View All ({dashboardData.projectTimeline.length}) <Eye size={13} />
                        </button>
                      )}
                    </div>
                    <div className="project-timeline-container" style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {dashboardData.projectTimeline.slice(0, 3).map((m, i) => (
                        <div key={i} className={`timeline-milestone ${m.status}`}>
                          <div className="milestone-marker">
                            {m.status === 'completed' ? <CheckCircle size={18} /> : <Clock size={18} />}
                          </div>
                          <div className="milestone-content">
                            <div className="milestone-date">{formatDate(m.date)}</div>
                            <h4 className="milestone-title">{m.title}</h4>
                            <p className="milestone-description">{m.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Recent Activities (right) ── */}
                {dashboardData.recentActivities?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <h3 className="section-title" style={{ margin: 0 }}><Activity size={20} />Recent Activities</h3>
                      {dashboardData.recentActivities.length > 3 && (
                        <button
                          onClick={() => setShowActivitiesModal(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--c-e2e8f0,#e2e8f0)', background: 'var(--c-f8fafc,#f8fafc)', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          View All ({dashboardData.recentActivities.length}) <Eye size={13} />
                        </button>
                      )}
                    </div>
                    <div className="activities-timeline" style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {dashboardData.recentActivities.slice(0, 3).map((a, i) => (
                        <div key={i} className="activity-item">
                          <div className="activity-icon" style={{ backgroundColor: a.color }}>
                            {a.type === 'Purchase Order' ? <ShoppingCart size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="activity-content">
                            <div className="activity-header">
                              <span className="activity-type">{a.type}</span>
                              <span className="activity-date">{formatDate(a.date)}</span>
                            </div>
                            <div className="activity-action">{a.action}</div>
                            {a.amount && <div className="activity-amount">{formatCurrency(a.amount)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Single-project Chart Expand Modal ────────────────────────────── */}
      {projChartModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.72)', backdropFilter:'blur(6px)',
          zIndex:10300, display:'flex', alignItems:'center', justifyContent:'center', padding:24
        }}>
          <div style={{
            background:'#fff', borderRadius:16, width:'100%', maxWidth:940, maxHeight:'90vh',
            display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(0,0,0,0.28)', overflow:'hidden'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:'16px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:8 }}>
                {projChartModal.type === 'spendingTrend'  && <><TrendingUp size={18} /> Monthly Spending Trend</>}
                {projChartModal.type === 'topCategories'  && <><BarChart3 size={18} /> Top Categories</>}
                {projChartModal.type === 'projFinOverviewBar' && <><BarChart3 size={18} /> Project Financial Overview — All Figures (₹)</>}
              </h3>
              <button onClick={() => setProjChartModal(null)} style={{ background:'#f1f5f9', border:'none', cursor:'pointer', padding:'6px 10px', borderRadius:8, fontWeight:700, fontSize:16 }}>✕</button>
            </div>
            {/* Chart body */}
            <div style={{ flex:1, padding:'20px 24px', overflow:'auto' }}>
              {projChartModal.type === 'spendingTrend' && dashboardData?.spendingTrend?.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      onClick={() => setProjSpendingShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: isDark ? '1px solid #2b3445' : '1px solid #e2e8f0', background: projSpendingShowLabels ? (isDark ? 'rgba(59,130,246,0.18)' : '#eff6ff') : (isDark ? '#232b3b' : '#fff'), color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {projSpendingShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {projSpendingShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                  </div>
                  <ChartJSBar
                    labels={spendingTrendLabels}
                    datasets={spendingTrendDatasets}
                    height={400}
                    yTickFormatter={v => formatCurrency(v)}
                    showValueLabels={projSpendingShowLabels}
                    valueLabelFormatter={formatCurrency}
                    modal={true}
                  />
                </>
              )}
              {projChartModal.type === 'topCategories' && dashboardData?.procurementData?.categoryDistribution?.length > 0 && (
                <ChartJSBar
                  labels={topCategoriesLabels}
                  datasets={topCategoriesDatasets}
                  height={420}
                  yTickFormatter={v => formatCurrency(v)}
                  valueLabelFormatter={v => formatCurrency(v)}
                  modal={true}
                />
              )}
              {projChartModal.type === 'projFinOverviewBar' && projChartModal.barLabels && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      onClick={() => setProjFinBarShowLabels(s => !s)}
                      title="Toggle the amount label shown on top of each bar"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: isDark ? '1px solid #2b3445' : '1px solid #e2e8f0', background: projFinBarShowLabels ? (isDark ? 'rgba(59,130,246,0.18)' : '#eff6ff') : (isDark ? '#232b3b' : '#fff'), color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {projFinBarShowLabels ? <EyeOff size={13} /> : <Eye size={13} />} {projFinBarShowLabels ? 'Hide Amounts' : 'Show Amounts'}
                    </button>
                  </div>
                  <ChartJSBar
                    labels={projChartModal.barLabels.map(l => l.split('\n'))}
                    datasets={[{
                      label: 'Amount (₹)',
                      data: projChartModal.barValues,
                      backgroundColor: projChartModal.barColors.map(c => c + 'cc'),
                      borderColor: projChartModal.barColors,
                      borderWidth: 2,
                      borderRadius: 0,
                      borderSkipped: false,
                    }]}
                    height={440}
                    yTickFormatter={v => formatCurrency(v)}
                    xLabelRotation={0}
                    showValueLabels={projFinBarShowLabels}
                    valueLabelFormatter={formatCurrency}
                    modal={true}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ─── Amount Spent Breakdown Modal ──────────────────────────────────── */}
      {/* ── Progress breakdown: Technical vs Financial ── */}
      {showProgressModal && dashboardData && (
        <div className="spent-modal-overlay">
          <div className="spent-modal" onClick={e => e.stopPropagation()}>
            <div className="spent-modal-header">
              <div className="spent-modal-title-row">
                <BarChart3 size={22} className="spent-modal-icon" />
                <h2 className="spent-modal-title">Progress — Breakdown</h2>
              </div>
              <button className="spent-modal-close" onClick={() => setShowProgressModal(false)}><X size={20} /></button>
            </div>
            <div className="spent-modal-body">

              {/* Technical */}
              <div className="spent-block">
                <div className="spent-block-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Technical progress — site execution</span>
                  <strong>{fmtTechProgress(dashboardData)}</strong>
                </div>
                {progressPhases == null ? (
                  <div className="spent-row"><span className="spent-row-label">Loading phases…</span></div>
                ) : progressPhases.length === 0 ? (
                  <div className="spent-row"><span className="spent-row-label">No technical scope defined yet (add phases in the project's Scope / SOW tab).</span></div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '4px 6px' }}>Phase</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Weight %</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Actual %</th>
                    </tr></thead>
                    <tbody>
                      {progressPhases.map((ph, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '4px 6px' }}>{ph.phaseName || '—'}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmtPct1(ph.weightPct)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{fmtPct1(ph.progressPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="obd-spec" style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                  Technical % = Σ(phase actual × phase weight) ÷ Σ(weights).
                </p>
              </div>

              {/* Financial */}
              {dashboardData.progressBreakdown && (() => {
                const b = dashboardData.progressBreakdown;
                const rows = [
                  { label: 'Collection',     weight: 40, pct: b.collectionPct, basis: `${formatCurrency(b.received)} received ÷ ${formatCurrency(b.budget)} budget` },
                  { label: 'PO Delivery',    weight: 30, pct: b.deliveryPct,   basis: `${formatCurrency(b.deliveredPoValue)} delivered ÷ ${formatCurrency(b.committedPoValue)} committed` },
                  { label: 'Invoicing',      weight: 20, pct: b.invoicingPct,  basis: `${formatCurrency(b.invoiced)} invoiced ÷ ${formatCurrency(b.budget)} budget` },
                  { label: 'PO Commitment',  weight: 10, pct: b.commitmentPct, basis: `${formatCurrency(b.committedPoValue)} committed ÷ ${formatCurrency(b.budget)} budget` },
                ];
                return (
                  <div className="spent-block" style={{ marginTop: 18 }}>
                    <div className="spent-block-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Financial progress — cash &amp; procurement</span>
                      <strong>{financialProgress(dashboardData)}%</strong>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '4px 6px' }}>Component</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Weight</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Score</th>
                        <th style={{ padding: '4px 6px' }}>Basis</th>
                      </tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '4px 6px' }}>{r.label}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{r.weight}%</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{fmtPct1(r.pct)}</td>
                            <td style={{ padding: '4px 6px', fontSize: 11, color: '#64748b' }}>{r.basis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="obd-spec" style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                      Financial % = 0.40·Collection + 0.30·PO Delivery + 0.20·Invoicing + 0.10·PO Commitment.
                      This is separate from Technical progress and is not part of the headline % complete.
                    </p>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {showSpentModal && dashboardData?.financialData && (
        <div className="spent-modal-overlay">
          <div className="spent-modal" onClick={e => e.stopPropagation()}>
            <div className="spent-modal-header">
              <div className="spent-modal-title-row">
                <TrendingDown size={22} className="spent-modal-icon" />
                <h2 className="spent-modal-title">Amount Spent — Breakdown</h2>
              </div>
              <button className="spent-modal-close" onClick={() => setShowSpentModal(false)}><X size={20} /></button>
            </div>
            <div className="spent-modal-body">
              <div className="spent-block">
                <div className="spent-block-header spent-block-header--procurement">
                  <ShoppingCart size={16} />
                  <span>Procurement (Vendor Bills + Material from Warehouse)</span>
                </div>
                <div className="spent-row">
                  <span className="spent-row-label">Gross paid to vendors (incl. warehouse issuances)</span>
                  <span className="spent-row-amount spent-amount--procurement">
                    {formatCurrency((dashboardData.financialData.totalSpent || 0) + (dashboardData.financialData.inwardRecoveryValue || 0))}
                  </span>
                </div>
                {(dashboardData.financialData.inwardRecoveryValue > 0) && (
                  <div className="spent-row spent-row--sub" style={{ color: '#059669' }}>
                    <span className="spent-row-label">↩ Materials returned from site to warehouse (credit)</span>
                    <span className="spent-row-amount" style={{ color: '#059669' }}>
                      − {formatCurrency(dashboardData.financialData.inwardRecoveryValue || 0)}
                    </span>
                  </div>
                )}
                <div className="spent-row spent-row--sub" style={{ fontWeight: 600 }}>
                  <span className="spent-row-label">Net paid to vendors (after returns)</span>
                  <span className="spent-row-amount spent-amount--procurement">{formatCurrency(dashboardData.financialData.totalSpent || 0)}</span>
                </div>
                <div className="spent-row spent-row--sub">
                  <span className="spent-row-label">Bills raised (total payable)</span>
                  <span className="spent-row-amount">{formatCurrency(dashboardData.financialData.totalPayable || 0)}</span>
                </div>
                <div className="spent-row spent-row--sub">
                  <span className="spent-row-label">Pending vendor payments</span>
                  <span className="spent-row-amount spent-amount--pending">{formatCurrency(dashboardData.financialData.pendingPayments || 0)}</span>
                </div>
              </div>
              <div className="spent-block">
                <div className="spent-block-header spent-block-header--expense">
                  <Users size={16} />
                  <span>Employee &amp; Project Expenses</span>
                  <span className="spent-block-total">{formatCurrency(dashboardData.financialData.totalEmployeeExpenses || 0)}</span>
                </div>
                {dashboardData.expenseData?.categoryBreakdown?.length > 0 ? (
                  <div className="spent-category-list">
                    {dashboardData.expenseData.categoryBreakdown.map((cat, i) => {
                      const icons = { 'Travel': <Plane size={14} />, 'Site Visit': <MapPinIcon size={14} />, 'Accommodation': <Hotel size={14} />, 'Food': <Utensils size={14} />, 'Commission': <Users size={14} />, 'Miscellaneous': <Tag size={14} /> };
                      const icon = icons[cat.category] || <Tag size={14} />;
                      const total = Number(dashboardData.expenseData.approvedExpenses || 0);
                      const pct = total > 0 ? ((Number(cat.totalAmount) / total) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={i} className="spent-cat-row">
                          <div className="spent-cat-left">
                            <span className="spent-cat-icon">{icon}</span>
                            <span className="spent-cat-name">{cat.category}</span>
                            <span className="spent-cat-count">{cat.count} expense{cat.count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="spent-cat-right">
                            <div className="spent-cat-bar-wrap"><div className="spent-cat-bar" style={{ width: `${pct}%` }} /></div>
                            <span className="spent-cat-pct">{pct}%</span>
                            <span className="spent-cat-amount">{formatCurrency(cat.totalAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="spent-empty-expenses">No approved employee expenses recorded</div>
                )}
                {dashboardData.expenseData && (
                  <div className="spent-expense-summary-rows">
                    {(dashboardData.expenseData.pendingExpenses > 0) && (
                      <div className="spent-row spent-row--sub">
                        <span className="spent-row-label">⏳ Pending approval</span>
                        <span className="spent-row-amount spent-amount--pending">{formatCurrency(dashboardData.expenseData.pendingExpenses)}</span>
                      </div>
                    )}
                    {(dashboardData.expenseData.unsettledAdvances > 0) && (
                      <div className="spent-row spent-row--sub">
                        <span className="spent-row-label">💳 Unsettled advances</span>
                        <span className="spent-row-amount spent-amount--pending">{formatCurrency(dashboardData.expenseData.unsettledAdvances)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="spent-grand-total">
                <span className="spent-grand-label">Grand Total Spent (Net)</span>
                <span className="spent-grand-value">{formatCurrency((dashboardData.financialData.totalSpent || 0) + (dashboardData.financialData.totalEmployeeExpenses || 0))}</span>
              </div>
              <div className="spent-util-row">
                <span className="spent-util-label">Budget utilisation</span>
                <div className="spent-util-bar-wrap">
                  <div className="spent-util-bar" style={{ width: `${Math.min(dashboardData.financialData.budgetUtilizationPercent || 0, 100)}%`, background: (dashboardData.financialData.budgetUtilizationPercent || 0) > 90 ? '#ef4444' : (dashboardData.financialData.budgetUtilizationPercent || 0) > 70 ? '#f59e0b' : '#22c55e' }} />
                </div>
                <span className="spent-util-pct">{(dashboardData.financialData.budgetUtilizationPercent || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cash Flow Breakdown Modal ──────────────────────────────────────── */}
      {showCashModal && dashboardData?.financialData && (() => {
        const fd = dashboardData.financialData;
        const isCompleted  = fd.isCompleted;

        // ── All values from backend — no frontend recalculation ──────────────
        const cashInflow   = parseFloat(fd.amountReceived)        || 0;
        const paidVendors  = parseFloat(fd.amountPaid)            || 0;
        const expenses     = parseFloat(fd.totalEmployeeExpenses) || 0;
        const invoiceGST   = parseFloat(fd.invoiceGSTCollected)   || 0;  // GST billed to client
        const vendorGST    = parseFloat(fd.procurementGSTPaid)    || 0;  // ITC from vendor bills
        const netGST       = parseFloat(fd.netGST)                || 0;  // invoiceGST - vendorGST
        // cashOutflow: paid vendors + expenses + netGST (always subtract full net GST)
        const cashOutflow  = paidVendors + expenses + netGST;

        const isDeficit    = (parseFloat(fd.cashDeficit) || 0) > 0;
        const accentColor  = isDeficit ? '#ef4444' : '#22c55e';
        const accentLight  = isDeficit ? '#fef2f2' : '#f0fdf4';
        const accentBorder = isDeficit ? '#fecaca' : '#bbf7d0';

        return (
          <div className="spent-modal-overlay">
            <div className="spent-modal" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="spent-modal-header">
                <div className="spent-modal-title-row">
                  <Wallet size={22} style={{ color: accentColor }} />
                  <h2 className="spent-modal-title">Cash Flow Breakdown</h2>
                </div>
                <button className="spent-modal-close" onClick={() => setShowCashModal(false)}><X size={20} /></button>
              </div>

              <div className="spent-modal-body">

                {/* Status banner */}
                <div style={{ background: accentLight, border: `1px solid ${accentBorder}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {isDeficit
                    ? <AlertCircle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
                    : <CheckCircle size={24} style={{ color: '#22c55e', flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: accentColor }}>
                      {isDeficit ? 'Cash Deficit — outflows exceed inflows' : 'Positive Cash Position'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>
                      {isDeficit
                        ? 'Total cash paid out exceeds cash received from clients'
                        : 'Cash received from clients exceeds total cash paid out'}
                    </div>
                  </div>
                </div>

                {/* ── CASH INFLOW ── */}
                <div className="spent-block">
                  <div className="spent-block-header" style={{ background: '#f0fdf4', color: '#15803d', borderBottom: '1px solid #bbf7d0' }}>
                    <CheckCircle size={15} />
                    <span style={{ fontWeight: 700 }}>Cash Inflow — Received from Clients</span>
                    <span className="spent-block-total" style={{ color: '#15803d' }}>+ {formatCurrency(cashInflow)}</span>
                  </div>
                  <div className="spent-row">
                    <span className="spent-row-label">Total invoiced to client</span>
                    <span className="spent-row-amount">{formatCurrency(fd.amountToBeReceived || 0)}</span>
                  </div>
                  <div className="spent-row">
                    <span className="spent-row-label">✅ Received from client</span>
                    <span className="spent-row-amount" style={{ color: '#15803d', fontWeight: 700 }}>{formatCurrency(cashInflow)}</span>
                  </div>
                  <div className="spent-row spent-row--sub">
                    <span className="spent-row-label">⏳ Still pending from client</span>
                    <span className="spent-row-amount spent-amount--pending">{formatCurrency(fd.pendingReceipts || 0)}</span>
                  </div>
                </div>

                {/* ── CASH OUTFLOW ── */}
                <div className="spent-block">
                  <div className="spent-block-header" style={{ background: '#fef2f2', color: '#b91c1c', borderBottom: '1px solid #fecaca' }}>
                    <CreditCard size={15} />
                    <span style={{ fontWeight: 700 }}>Cash Outflow</span>
                    <span className="spent-block-total" style={{ color: '#b91c1c' }}>{formatCurrency(cashOutflow)}</span>
                  </div>

                  {/* Paid to vendors */}
                  <div className="spent-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <span className="spent-row-label" style={{ fontWeight: 600, color: '#374151' }}>Paid to Vendors</span>
                    <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 700 }}>{formatCurrency(paidVendors)}</span>
                  </div>
                  <div className="spent-row spent-row--sub">
                    <span className="spent-row-label">Total billed by vendors</span>
                    <span className="spent-row-amount">{formatCurrency(fd.totalPayable || 0)}</span>
                  </div>
                  <div className="spent-row spent-row--sub" style={{ marginBottom: 4 }}>
                    <span className="spent-row-label">⏳ Still pending to vendors</span>
                    <span className="spent-row-amount spent-amount--pending">{formatCurrency(fd.pendingPayments || 0)}</span>
                  </div>

                  {/* Expenses */}
                  <div className="spent-row" style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                    <span className="spent-row-label" style={{ fontWeight: 600, color: '#374151' }}>Approved Expenses</span>
                    <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 700 }}>{formatCurrency(expenses)}</span>
                  </div>

                  {/* Net GST Liability */}
                  <div className="spent-row" style={{ borderTop: '1px solid #f1f5f9', background: '#fffbeb' }}>
                    <span className="spent-row-label" style={{ fontWeight: 600, color: '#92400e' }}>
                      Net GST (Invoice GST − Vendor GST)
                      <span style={{ fontWeight: 400, fontSize: 11, color: '#78716c', display: 'block' }}>Always deducted from profit</span>
                    </span>
                    <span className="spent-row-amount" style={{ color: '#d97706', fontWeight: 700 }}>
                      {formatCurrency(netGST)}
                    </span>
                  </div>
                  <div className="spent-row spent-row--sub" style={{ background: '#fffbeb' }}>
                    <span className="spent-row-label">Invoice GST collected from client</span>
                    <span className="spent-row-amount">{formatCurrency(invoiceGST)}</span>
                  </div>
                  <div className="spent-row spent-row--sub" style={{ background: '#fffbeb' }}>
                    <span className="spent-row-label">Vendor GST paid</span>
                    <span className="spent-row-amount">{formatCurrency(vendorGST)}</span>
                  </div>
                </div>

                {/* ── NET CASH POSITION ── */}
                <div className="spent-block" style={{ border: `1.5px solid ${accentBorder}` }}>
                  <div className="spent-block-header" style={{ background: accentLight, color: accentColor, borderBottom: `1px solid ${accentBorder}` }}>
                    <Activity size={15} />
                    <span style={{ fontWeight: 700 }}>Net Cash Position</span>
                  </div>
                  <div className="spent-row">
                    <span className="spent-row-label">Cash Inflow (received from clients)</span>
                    <span className="spent-row-amount" style={{ color: '#15803d', fontWeight: 600 }}>+ {formatCurrency(cashInflow)}</span>
                  </div>
                  <div className="spent-row">
                    <span className="spent-row-label">Cash Outflow (vendors + expenses + GST)</span>
                    <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 600 }}>− {formatCurrency(cashOutflow)}</span>
                  </div>
                  <div className="spent-row" style={{ background: accentLight, borderTop: `2px solid ${accentBorder}` }}>
                    <span className="spent-row-label" style={{ fontWeight: 700, fontSize: 13, color: accentColor }}>
                      {isDeficit ? '🔴 Cash Deficit' : '🟢 Cash in Hand'}
                    </span>
                    <span className="spent-row-amount" style={{ fontSize: 15, fontWeight: 800, color: accentColor }}>
                      {isDeficit ? '− ' : '+ '}{formatCurrency(isDeficit ? (parseFloat(fd.cashDeficit)||0) : (parseFloat(fd.cashInHand)||0))}
                    </span>
                  </div>
                </div>

                {/* ── PROJECT PROFIT (only when completed) ── */}
                {isCompleted && (() => {
                  const cpBlock = parseFloat(fd.projectedProfit) || 0;
                  const clBlock = cpBlock < 0;
                  const bdrCol  = clBlock ? '#fecaca' : '#bbf7d0';
                  const bgCol   = clBlock ? '#fef2f2' : '#f0fdf4';
                  const txtCol  = clBlock ? '#b91c1c' : '#15803d';
                  return (
                    <div className="spent-block" style={{ border: `1.5px solid ${bdrCol}` }}>
                      <div className="spent-block-header" style={{ background: bgCol, color: txtCol, borderBottom: `1px solid ${bdrCol}` }}>
                        {clBlock ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
                        <span style={{ fontWeight: 700 }}>{clBlock ? '🔴 Project Completed — In Loss' : '✅ Project Completed — Final Profit'}</span>
                      </div>
                      <div className="spent-row" style={{ background: '#f0fdf4' }}>
                        <span className="spent-row-label" style={{ color: '#15803d', fontWeight: 600 }}>Received from Clients</span>
                        <span className="spent-row-amount" style={{ color: '#15803d', fontWeight: 700 }}>{formatCurrency(cashInflow)}</span>
                      </div>
                      <div className="spent-row" style={{ background: '#fff5f5' }}>
                        <span className="spent-row-label">Bills Paid to Vendors</span>
                        <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(paidVendors)}</span>
                      </div>
                      <div className="spent-row" style={{ background: '#fff5f5' }}>
                        <span className="spent-row-label">Approved Expenses</span>
                        <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(expenses)}</span>
                      </div>
                      <div className="spent-row" style={{ background: '#fffbeb' }}>
                        <span className="spent-row-label" style={{ color: '#92400e' }}>
                          Net GST (Invoice GST − Vendor GST)
                        </span>
                        <span className="spent-row-amount" style={{ color: '#d97706', fontWeight: 600 }}>
                          {formatCurrency(netGST)}
                        </span>
                      </div>
                      <div className="spent-row" style={{ background: clBlock ? '#fef2f2' : '#f0fdf4', borderTop: `2px solid ${bdrCol}` }}>
                        <span className="spent-row-label" style={{ fontWeight: 800, fontSize: 14, color: txtCol }}>
                          {clBlock ? '🔴 In Loss' : '🟢 Net Profit'}
                        </span>
                        <span className="spent-row-amount" style={{ fontSize: 16, fontWeight: 800, color: txtCol }}>
                          {formatCurrency(Math.abs(cpBlock))}
                          <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 6, color: '#6b7280' }}>({Math.abs(fd.profitMargin ?? 0).toFixed(1)}% {clBlock ? 'loss margin' : 'margin'})</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Tip */}
                {isDeficit && (
                  <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 4px', lineHeight: 1.6 }}>
                    💡 <strong>Tip:</strong> Collect {formatCurrency(fd.pendingReceipts || 0)} pending from clients or defer {formatCurrency(fd.pendingPayments || 0)} outstanding vendor payments to improve cash position.
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Profit Breakdown Modal ───────────────────────────────────────── */}
      {showProfitModal && dashboardData?.financialData && dashboardData.financialData.isCompleted && (() => {
        const fd = dashboardData.financialData;
        const modalProfit = parseFloat(fd.projectedProfit) || 0;
        const modalIsLoss = modalProfit < 0;
        const accentColor = modalIsLoss ? '#dc2626' : '#16a34a';
        const netGST = fd.netGST ?? 0;
        const invGST = fd.invoiceGSTCollected ?? 0;
        const procGST = fd.procurementGSTPaid ?? 0;

        const Row = ({ label, value, color, borderTop, bold, bg, fontSize }) => (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 14px',
            borderTop: borderTop ? '1.5px solid #e5e7eb' : undefined,
            background: bg || 'transparent',
          }}>
            <span style={{ fontSize: fontSize || 13, color: bold ? '#111827' : '#374151', fontWeight: bold ? 600 : 400 }}>{label}</span>
            <span style={{ fontSize: fontSize || 13, fontWeight: bold ? 700 : 500, color: color || '#111827', whiteSpace: 'nowrap' }}>{value}</span>
          </div>
        );

        return (
          <div className="spent-modal-overlay">
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460,
              maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              {/* Header — fixed, never scrolls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={18} style={{ color: accentColor }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Profit Breakdown</span>
                </div>
                <button onClick={() => setShowProfitModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', padding: 4 }}><X size={18} /></button>
              </div>

              {/* Scrollable body */}
              <div style={{ overflowY: 'auto', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Formula pill */}
                <div style={{ padding: '7px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11.5, color: '#475569', textAlign: 'center' }}>
                  Received from Clients &nbsp;−&nbsp; Bills Paid to Vendors &nbsp;−&nbsp; Expenses &nbsp;−&nbsp; Net GST &nbsp;=&nbsp; <strong style={{ color: accentColor }}>{modalIsLoss ? 'Loss' : 'Net Profit'}</strong>
                </div>

                {/* P&L Waterfall */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Inflow row — green */}
                  <Row label="Received from Clients" value={formatCurrency(fd.amountReceived ?? 0)}
                    color="#16a34a" bold bg="#f0fdf4" />
                  {/* Deduction rows — red tint bg, amount in red, label clean (no − prefix) */}
                  <Row label="Bills Paid to Vendors" value={formatCurrency(fd.amountPaid ?? fd.totalSpent ?? 0)}
                    color="#dc2626" borderTop bg="#fff5f5" />
                  <Row label="Approved Expenses" value={formatCurrency(fd.totalEmployeeExpenses || 0)}
                    color="#dc2626" borderTop bg="#fff5f5" />
                  <Row
                    label="Net GST (Invoice GST − Vendor GST)"
                    value={formatCurrency(netGST)}
                    color="#d97706" borderTop bg="#fffbeb" />
                  {/* Result row */}
                  <Row
                    label={modalIsLoss ? '= In Loss' : '= Net Profit'}
                    value={formatCurrency(Math.abs(modalProfit))}
                    color={accentColor} bold borderTop
                    bg={modalIsLoss ? '#fef2f2' : '#f0fdf4'}
                    fontSize={14}
                  />
                  <div style={{ padding: '4px 14px 8px', background: modalIsLoss ? '#fef2f2' : '#f0fdf4', borderTop: `1px dashed ${modalIsLoss ? '#fecaca' : '#d1fae5'}` }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{modalIsLoss ? 'Loss' : 'Net'} Margin: <strong style={{ color: accentColor }}>{Math.abs(fd.profitMargin ?? 0).toFixed(1)}%{modalIsLoss ? ' (In Loss)' : ''}</strong></span>
                  </div>
                </div>

                {/* GST breakdown */}
                <div style={{ border: '1px solid #bfdbfe', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#eff6ff', padding: '7px 14px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 5 }}><Percent size={13} /> Net GST Detail</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{formatCurrency(netGST)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', padding: '10px 0 8px' }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 2 }}>Invoice GST</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{formatCurrency(invGST)}</div>
                    </div>
                    <div style={{ borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 2 }}>Vendor GST Paid</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{formatCurrency(procGST)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 2 }}>Net GST</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>{formatCurrency(netGST)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', padding: '0 14px 8px', textAlign: 'center' }}>
                    Net GST (Invoice GST − Vendor GST) always deducted from profit
                  </div>
                </div>

              </div>{/* end scrollable body */}
            </div>
          </div>
        );
      })()}

      {/* ─── Recent Activities — full list modal ───────────────────────────── */}
      {showActivitiesModal && dashboardData?.recentActivities?.length > 0 && (
        <div className="spent-modal-overlay">
          <div className="spent-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="spent-modal-header">
              <div className="spent-modal-title-row">
                <Activity size={22} className="spent-modal-icon" />
                <h2 className="spent-modal-title">All Activities ({dashboardData.recentActivities.length})</h2>
              </div>
              <button className="spent-modal-close" onClick={() => setShowActivitiesModal(false)}><X size={20} /></button>
            </div>
            <div className="spent-modal-body">
              <div className="activities-timeline">
                {dashboardData.recentActivities.map((a, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-icon" style={{ backgroundColor: a.color }}>
                      {a.type === 'Purchase Order' ? <ShoppingCart size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-type">{a.type}</span>
                        <span className="activity-date">{formatDate(a.date)}</span>
                      </div>
                      <div className="activity-action">{a.action}</div>
                      {a.amount && <div className="activity-amount">{formatCurrency(a.amount)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Project Timeline — full list modal ────────────────────────────── */}
      {showTimelineModal && dashboardData?.projectTimeline?.length > 0 && (
        <div className="spent-modal-overlay">
          <div className="spent-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="spent-modal-header">
              <div className="spent-modal-title-row">
                <Clock size={22} className="spent-modal-icon" />
                <h2 className="spent-modal-title">Full Project Timeline ({dashboardData.projectTimeline.length})</h2>
              </div>
              <button className="spent-modal-close" onClick={() => setShowTimelineModal(false)}><X size={20} /></button>
            </div>
            <div className="spent-modal-body">
              <div className="project-timeline-container">
                {dashboardData.projectTimeline.map((m, i) => (
                  <div key={i} className={`timeline-milestone ${m.status}`}>
                    <div className="milestone-marker">
                      {m.status === 'completed' ? <CheckCircle size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="milestone-content">
                      <div className="milestone-date">{formatDate(m.date)}</div>
                      <h4 className="milestone-title">{m.title}</h4>
                      <p className="milestone-description">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectDashboard;