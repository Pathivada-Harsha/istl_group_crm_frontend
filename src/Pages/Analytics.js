import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Maximize2, X } from 'lucide-react';
import '../pages-css/Analytics.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const RANGES = [
  { k: 'this_month',     l: 'This Month' },
  { k: 'last_month',     l: 'Last Month' },
  { k: 'last_3_months',  l: 'Last 3 Months' },
  { k: 'this_year',      l: 'This Year' },
  { k: 'last_year',      l: 'Last Year' },
  { k: 'last_12_months', l: 'Last 12 Months' },
];

const SERIES = ['#5b8cff', '#27d3a2', '#ffb545', '#ff6b8a', '#a880ff', '#46c8ff', '#8de36a', '#ff8f5c'];
const DOT = '\u00b7';

const fmtInt = n => (n == null ? '-' : Number(n).toLocaleString('en-IN'));
const fmtPct = n => (n == null ? '-' : `${n}%`);
const fmtDays = n => (n == null ? '-' : `${n} day${n === 1 ? '' : 's'}`);

// ── Chart.js loader (same CDN set as Project Dashboard) for native x-axis zoom ─
const CHARTJS_LOADED = {};
function loadChartJS() {
  if (CHARTJS_LOADED.promise) return CHARTJS_LOADED.promise;
  CHARTJS_LOADED.promise = new Promise((resolve) => {
    if (window.Chart && window.Chart.registry) { resolve(); return; }
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js',
    ];
    let idx = 0;
    (function next() {
      if (idx >= scripts.length) { resolve(); return; }
      const s = document.createElement('script');
      s.src = scripts[idx++];
      s.onload = next;
      document.head.appendChild(s);
    })();
  });
  return CHARTJS_LOADED.promise;
}

const chartPalette = () => {
  const dark = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'dark';
  return dark
    ? { tick: '#9aa7b8', grid: 'rgba(255,255,255,0.06)', legend: '#c2cbd8',
        tipBg: '#232b3b', tipBorder: '#3a4456', tipTitle: '#e7ecf3', tipBody: '#c2cbd8' }
    : { tick: '#5d6b85', grid: 'rgba(20,30,60,0.08)', legend: '#5d6b85',
        tipBg: '#ffffff', tipBorder: '#e2e8f0', tipTitle: '#1d2535', tipBody: '#475569' };
};

const useThemeVersion = () => {
  const [v, setV] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setV(x => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return v;
};

const Analytics = () => {
  const [range, setRange] = useState('last_12_months');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalChart, setModalChart] = useState(null); // { title, render }

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('bd_portal_user') || '{}'); } catch { return {}; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/leads?range=${range}`, {
        credentials: 'include',
        headers: { 'User-Id': String(user.id || 1), 'User-Role': user.role || '' },
      });
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message || 'Failed to load analytics');
    } catch {
      setError('Could not reach the analytics service.');
    } finally {
      setLoading(false);
    }
  }, [range, user.id, user.role]);

  useEffect(() => { load(); }, [load]);

  const openModal = (title, render, selfZoom) => setModalChart({ title, render, selfZoom });

  return (
    <div className="anl-root">
      <div className="anl-bg" aria-hidden="true" />
      <header className="anl-head">
        <div>
          <h1 className="anl-title">Lead Analytics</h1>
          <p className="anl-sub">{data ? `${data.from} to ${data.to}` : 'Performance overview'}</p>
        </div>
        <div className="anl-range">
          {RANGES.map(r => (
            <button key={r.k} className={`anl-chip ${range === r.k ? 'is-active' : ''}`}
              onClick={() => setRange(r.k)}>{r.l}</button>
          ))}
        </div>
      </header>

      {loading && <div className="anl-state">Loading analytics...</div>}
      {error && !loading && <div className="anl-state anl-state--err">{error}</div>}

      {!loading && !error && data && (
        <>
          <section className="anl-kpis">
            <KpiCard label="Leads Generated" value={fmtInt(data.leadsGenerated)} accent={SERIES[0]} />
            <KpiCard label="Leads Won" value={fmtInt(data.leadsWon)} accent={SERIES[1]} />
            <KpiCard label="Conversion Rate" value={fmtPct(data.conversionRate)} hint="Won of all generated" accent={SERIES[2]} />
            <KpiCard label="Weighted (Priority)" value={fmtPct(data.weightedConversionRate)} hint="High 3 / Med 2 / Low 1" accent={SERIES[4]} />
            <KpiCard label="Weighted (Subgroup)" value={fmtPct(data.weightedConversionByGroup)} hint="By subgroup volume" accent={SERIES[5]} />
            <KpiCard label="Avg Time to Convert" value={fmtDays(data.avgDaysToConvert)} hint={`n = ${data.convertedSampleSize}`} accent={SERIES[3]} />
          </section>

          <section className="anl-grid">
            <Panel title="Leads Generated vs Won" subtitle="Monthly" wide selfZoom
                   onExpand={openModal} render={(m) => <BarChart series={data.monthly} modal={m} />} />

            <Panel title="Status Distribution" subtitle="Where leads sit now"
                   onExpand={openModal} render={(m) => <PieChart data={data.byStatus} modal={m} />} />

            <Panel title="Conversion by Priority" subtitle="Rate within each tier"
                   onExpand={openModal} render={() => <RateBars rows={data.byPriority} nameKey="priority" metaFn={r => `${r.won} won of ${r.total} ${DOT} weight ${r.weight}`} />} />

            <Panel title="Conversion by Subgroup" subtitle="Leads in vs converted"
                   onExpand={openModal} render={(m) => <LineChart rows={data.byGroup} modal={m} />} />

            <Panel title="Employee Handling" subtitle="Leads handled and won"
                   onExpand={openModal} render={() => <EmployeeTable rows={data.byEmployee} />} />

            <Panel title="Lead Sources" subtitle="Top channels"
                   onExpand={openModal} render={() => <HBars data={data.bySource} />} />

            <Panel title="Geographic Spread" subtitle="Top states"
                   onExpand={openModal} render={(m) => <Treemap data={data.byState} modal={m} />} />
          </section>
        </>
      )}

      {modalChart && (
        <ChartModal title={modalChart.title} selfZoom={modalChart.selfZoom} onClose={() => setModalChart(null)}>
          {modalChart.render(true)}
        </ChartModal>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, hint, accent }) => (
  <div className="anl-kpi">
    <span className="anl-kpi-bar" style={{ background: accent }} />
    <div className="anl-kpi-body">
      <div className="anl-kpi-label">{label}</div>
      <div className="anl-kpi-value">{value}</div>
      {hint && <div className="anl-kpi-hint">{hint}</div>}
    </div>
  </div>
);

const Panel = ({ title, subtitle, wide, render, onExpand, selfZoom }) => (
  <div className={`anl-panel ${wide ? 'anl-panel--wide' : ''}`}>
    <div className="anl-panel-head">
      <div>
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <button className="anl-expand" title="Expand" onClick={() => onExpand(title, render, selfZoom)}>
        <Maximize2 size={14} />
      </button>
    </div>
    <div className="anl-panel-body">{render(false)}</div>
  </div>
);

// Modal. For static SVG charts it provides scroll-to-zoom + drag-to-pan on the
// content. For self-zooming charts (Chart.js bars) it steps aside and lets the
// chart handle zoom on its own axis, so only the bars scale — not the block.
const ChartModal = ({ title, onClose, children, selfZoom }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onWheel = e => {
    if (selfZoom) return;
    e.preventDefault();
    setScale(s => Math.min(4, Math.max(0.6, s + (e.deltaY < 0 ? 0.15 : -0.15))));
  };
  const onDown = e => { if (selfZoom) return; drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMove = e => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  return (
    <div className="anl-modal-overlay" onClick={onClose}>
      <div className="anl-modal" onClick={e => e.stopPropagation()}>
        <div className="anl-modal-head">
          <h3>{title}</h3>
          <div className="anl-modal-actions">
            {!selfZoom && <span className="anl-modal-hint">Scroll to zoom {DOT} drag to pan</span>}
            {!selfZoom && <button className="anl-expand" onClick={reset} title="Reset">Reset</button>}
            <button className="anl-expand" onClick={onClose} title="Close"><X size={16} /></button>
          </div>
        </div>
        <div className={`anl-modal-body ${selfZoom ? 'anl-modal-body--plain' : ''}`}
             onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <div className="anl-modal-stage"
               style={selfZoom ? undefined : { transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// Chart.js grouped bars with native x-axis zoom/pan — only the bars/axis zoom,
// not the whole block (same behaviour as the Project Dashboard charts).
const BarChart = ({ series, modal }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const themeV = useThemeVersion();
  const [ready, setReady] = useState(!!window.Chart);

  useEffect(() => { if (!window.Chart) loadChartJS().then(() => setReady(true)); }, []);

  useEffect(() => {
    if (!ready || !canvasRef.current || !series || series.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const Chart = window.Chart;
    if (window.ChartZoom) Chart.register(window.ChartZoom);
    const P = chartPalette();
    const labels = series.map(d => d.month.slice(2));
    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Generated', data: series.map(d => d.generated), backgroundColor: SERIES[0], borderRadius: 4, maxBarThickness: modal ? 34 : 24 },
          { label: 'Won',       data: series.map(d => d.won),       backgroundColor: SERIES[1], borderRadius: 4, maxBarThickness: modal ? 34 : 24 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        plugins: {
          legend: { labels: { color: P.legend, font: { size: 11 }, boxWidth: 12, padding: 12 } },
          tooltip: { backgroundColor: P.tipBg, borderColor: P.tipBorder, borderWidth: 1,
                     titleColor: P.tipTitle, bodyColor: P.tipBody, padding: 10 },
          zoom: {
            pan:  { enabled: true, mode: 'x', threshold: 5 },
            zoom: { wheel: { enabled: true, speed: 0.08 }, pinch: { enabled: true }, mode: 'x', scaleMode: 'x' },
            limits: { x: { minRange: 1 } },
          },
        },
        scales: {
          x: { ticks: { color: P.tick, font: { size: modal ? 11 : 10 }, autoSkip: false }, grid: { display: false }, border: { color: P.tick } },
          y: { ticks: { color: P.tick, font: { size: modal ? 11 : 10 }, maxTicksLimit: 5, precision: 0 }, grid: { color: P.grid }, border: { color: P.tick } },
        },
      },
    });
    const canvas = canvasRef.current;
    const stop = e => e.preventDefault();
    canvas.addEventListener('wheel', stop, { passive: false });
    return () => { canvas.removeEventListener('wheel', stop); if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [ready, series, modal, themeV]);

  const reset = () => { if (chartRef.current) chartRef.current.resetZoom(); };

  if (!series || series.length === 0) return <Empty />;
  return (
    <div className="anl-cjs" style={{ height: modal ? 320 : 170 }}>
      {!ready && <div className="anl-cjs-loading">Loading chart...</div>}
      <canvas ref={canvasRef} style={{ display: ready ? 'block' : 'none' }}
              onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} />
      {ready && (
        <div className="anl-cjs-tools" onClick={e => e.stopPropagation()}>
          <span className="anl-cjs-hint">Scroll to zoom {DOT} drag to pan</span>
          <button className="anl-expand" onClick={e => { e.stopPropagation(); reset(); }}>Reset</button>
        </div>
      )}
    </div>
  );
};

// Large filled pie — chart is the focus, labels sit on the slices.
const PieChart = ({ data, modal }) => {
  if (!data || data.length === 0) return <Empty />;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const size = modal ? 300 : 190;
  const cx = size / 2, cy = size / 2, R = size / 2 - (modal ? 36 : 28);
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const frac = d.count / total;
    const a0 = angle, a1 = angle + frac * 2 * Math.PI; angle = a1;
    const mid = (a0 + a1) / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1);
    const dPath = `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    const [lx, ly] = p(R * 0.62, mid);
    const pct = Math.round(frac * 100);
    return { dPath, color: SERIES[i % SERIES.length], label: d.label, count: d.count, pct, lx, ly };
  });
  return (
    <div className="anl-pie-wrap">
      <svg className="anl-svg anl-pie" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
        {slices.map((s, i) => (
          <g key={i} className="anl-slice">
            <title>{`${s.label}: ${s.count} (${s.pct}%)`}</title>
            <path d={s.dPath} fill={s.color} className="anl-arc" />
            {s.pct >= 7 && <text x={s.lx} y={s.ly} className="anl-pie-pct" textAnchor="middle">{s.pct}%</text>}
          </g>
        ))}
      </svg>
      <div className="anl-pie-legend">
        {slices.map((s, i) => (
          <span className="anl-pie-leg-item" key={i}>
            <span className="anl-dot" style={{ background: s.color }} />
            <span className="anl-pie-leg-label">{s.label}</span>
            <span className="anl-pie-leg-val">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// Line chart: leads-in vs converted across subgroups.
const LineChart = ({ rows, modal }) => {
  if (!rows || rows.length === 0) return <Empty />;
  const W = 720, H = modal ? 320 : 170, pad = { t: 20, r: 14, b: 44, l: 30 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const rawMax = Math.max(1, ...rows.map(d => d.total));
  const niceMax = rawMax <= 5 ? rawMax : Math.ceil(rawMax / 5) * 5;
  const n = rows.length;
  const x = i => pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = v => pad.t + ih - (ih * v) / niceMax;
  const line = key => rows.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ');
  const area = `${line('total')} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const ticks = Math.min(4, niceMax);

  return (
    <svg className="anl-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (niceMax / ticks) * i, yy = y(v);
        return (
          <g key={i}>
            <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} className="anl-grid-line" />
            <text x={pad.l - 6} y={yy + 3} className="anl-axis" textAnchor="end">{Math.round(v)}</text>
          </g>
        );
      })}
      <path d={area} className="anl-area" style={{ fill: SERIES[0] }} />
      <path d={line('total')} className="anl-line" style={{ stroke: SERIES[0] }} />
      <path d={line('won')} className="anl-line" style={{ stroke: SERIES[1] }} />
      {rows.map((d, i) => (
        <g key={i} className="anl-pt">
          <title>{`${d.group}\nLeads in: ${d.total}  Won: ${d.won}  (${d.rate}%)`}</title>
          <circle cx={x(i)} cy={y(d.total)} r={modal ? 4.5 : 3.5} style={{ fill: SERIES[0] }} />
          <circle cx={x(i)} cy={y(d.won)} r={modal ? 4.5 : 3.5} style={{ fill: SERIES[1] }} />
          <text x={x(i)} y={H - 30} className="anl-axis anl-axis--rot" textAnchor="end"
                transform={`rotate(-35 ${x(i)} ${H - 30})`}>{d.group}</text>
        </g>
      ))}
      <g className="anl-legend" transform={`translate(${pad.l},${10})`}>
        <rect x="0" y="-7" width="9" height="9" rx="2" style={{ fill: SERIES[0] }} />
        <text x="13" y="1" className="anl-legend-t">Leads in</text>
        <rect x="78" y="-7" width="9" height="9" rx="2" style={{ fill: SERIES[1] }} />
        <text x="91" y="1" className="anl-legend-t">Converted</text>
      </g>
    </svg>
  );
};

// Treemap for geographic spread — boxes sized by lead count (area-proportional).
// Slice-and-dice layout: splits the rectangle alternately by orientation.
// Treemap as plain HTML/CSS (no SVG) so it sizes to a fixed compact height and
// does not stretch its grid row. Boxes flex-grow proportional to lead count.
const Treemap = ({ data, modal }) => {
  if (!data || data.length === 0) return <Empty />;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const sorted = [...data].sort((a, b) => b.count - a.count);
  // Two columns: split list so areas roughly balance left/right.
  const half = total / 2;
  let acc = 0, split = 1;
  for (let i = 0; i < sorted.length; i++) { acc += sorted[i].count; if (acc >= half) { split = i + 1; break; } }
  const cols = [sorted.slice(0, split), sorted.slice(split)].filter(c => c.length);

  const cell = (d, i) => {
    const pct = Math.round((d.count / total) * 100);
    return (
      <div key={i} className="anl-tm-cell" title={`${d.label}: ${d.count} (${pct}%)`}
           style={{ flexGrow: d.count, background: SERIES[(d._idx) % SERIES.length] }}>
        <span className="anl-tm-label">{d.label}</span>
        <span className="anl-tm-val">{d.count} {DOT} {pct}%</span>
      </div>
    );
  };
  let idx = 0;
  return (
    <div className="anl-tm" style={{ height: modal ? 280 : 150 }}>
      {cols.map((col, c) => (
        <div className="anl-tm-col" key={c} style={{ flexGrow: col.reduce((s, d) => s + d.count, 0) }}>
          {col.map(d => cell({ ...d, _idx: idx++ }, d.label))}
        </div>
      ))}
    </div>
  );
};

const RateBars = ({ rows, nameKey, metaFn, offset = 0 }) => {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div className="anl-pbars">
      {rows.map((r, i) => (
        <div className="anl-pbar-row" key={i}>
          <div className="anl-pbar-top">
            <span className="anl-pbar-name">{r[nameKey]}</span>
            <span className="anl-pbar-rate">{r.rate}%</span>
          </div>
          <div className="anl-pbar-track">
            <div className="anl-pbar-fill" style={{ width: `${Math.min(100, r.rate)}%`, background: SERIES[(i + offset) % SERIES.length] }} />
          </div>
          <div className="anl-pbar-meta">{metaFn(r)}</div>
        </div>
      ))}
    </div>
  );
};

const EmployeeTable = ({ rows }) => {
  if (!rows || rows.length === 0) return <Empty />;
  const max = Math.max(1, ...rows.map(r => r.handled));
  return (
    <div className="anl-emp">
      {rows.map((r, i) => (
        <div className="anl-emp-row" key={i}>
          <span className="anl-emp-name" title={r.name}>{r.name}</span>
          <div className="anl-emp-track">
            <div className="anl-emp-fill" style={{ width: `${(r.handled / max) * 100}%`, background: SERIES[i % SERIES.length] }} />
          </div>
          <span className="anl-emp-stat">{r.handled}</span>
          <span className="anl-emp-rate">{r.won} won {DOT} {r.rate}%</span>
        </div>
      ))}
    </div>
  );
};

const HBars = ({ data, colorOffset = 0 }) => {
  if (!data || data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="anl-hbars">
      {data.map((d, i) => (
        <div className="anl-hbar-row" key={i}>
          <span className="anl-hbar-label" title={d.label}>{d.label}</span>
          <div className="anl-hbar-track">
            <div className="anl-hbar-fill" style={{ width: `${(d.count / max) * 100}%`, background: SERIES[(i + colorOffset) % SERIES.length] }} />
          </div>
          <span className="anl-hbar-val">{d.count}</span>
        </div>
      ))}
    </div>
  );
};

const Empty = () => <div className="anl-empty">No data in this range.</div>;

export default Analytics;