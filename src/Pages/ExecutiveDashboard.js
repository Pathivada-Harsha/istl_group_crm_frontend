/**
 * ExecutiveDashboard.jsx — ISTL Group CRM
 * ═══════════════════════════════════════════════════════════════════════════
 * Single-page executive dashboard built from full analysis of:
 *   - 74 DB tables (leads, projects, invoices, bills, inventory, tasks, etc.)
 *   - 5 role types (SUPERADMIN/ADMIN, SALES_MANAGER, BD_EXECUTIVE, TELECALLER, GENERIC)
 *   - 5 existing dashboard API endpoints (/dashboard/admin|sales-manager|bd|telecaller|generic)
 *   - DashboardDTO exact field names (matched 1:1)
 *   - Existing theme tokens var(--c-*, --ct-*)
 *   - Recharts + react-icons (already in package.json)
 *
 * INSTALL:
 *   cp ExecutiveDashboard.jsx  src/Pages/ExecutiveDashboard.jsx
 *   cp ExecutiveDashboard.css  src/pages-css/ExecutiveDashboard.css
 *
 * ROUTE (add to App.js):
 *   import ExecutiveDashboard from './Pages/ExecutiveDashboard';
 *   <Route path="/executive-dashboard" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
 *
 * PERFORMANCE:
 *   - Single API call per role (matches backend CompletableFuture parallel design)
 *   - useMemo for all derived/chart data
 *   - React.memo on heavy sub-components
 *   - Auto-refresh every 5 min
 *   - All chart heights fixed to prevent reflow
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, {
  useState, useEffect, useCallback, useMemo, memo
} from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  FiTrendingUp, FiTrendingDown, FiUsers, FiTarget, FiCheckCircle,
  FiAlertCircle, FiClock, FiDollarSign, FiPackage, FiFileText,
  FiRefreshCw, FiCalendar, FiArrowUp, FiArrowDown, FiMinus,
  FiActivity, FiShoppingCart, FiBarChart2, FiAward, FiAlertTriangle,
  FiZap, FiEye, FiPhone, FiThumbsUp, FiThumbsDown, FiSend,
  FiLayers, FiPieChart, FiGrid,
} from "react-icons/fi";
import { MdOutlineLeaderboard, MdOutlineInventory2 } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import "../pages-css/ExecutiveDashboard.css";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════════════════ */
const API = process.env.REACT_APP_API_URL || "http://localhost:8080";
const UKEY = "bd_portal_user";

/* Brand palette — mapped to app's existing color system */
const C = {
  blue:   "#2563eb",
  green:  "#10b981",
  amber:  "#f59e0b",
  red:    "#ef4444",
  purple: "#8b5cf6",
  teal:   "#14b8a6",
  indigo: "#6366f1",
  rose:   "#f43f5e",
  sky:    "#0ea5e9",
  lime:   "#84cc16",
  orange: "#f97316",
  cyan:   "#06b6d4",
};

const DONUT_COLORS = [C.blue, C.green, C.amber, C.red, C.purple, C.teal, C.indigo, C.rose];
const BAR_COLORS   = [C.blue, C.green, C.purple, C.amber, C.rose, C.teal];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
const storedUser = () => {
  try { return JSON.parse(localStorage.getItem(UKEY))?.user ?? null; }
  catch { return null; }
};

const hdrs = () => {
  const u = storedUser();
  return { "Content-Type": "application/json", "User-Id": String(u?.id ?? ""), "User-Role": String(u?.role ?? "") };
};

const get = async (path) => {
  const r = await fetch(API + path, { headers: hdrs(), credentials: "include" });
  if (r.status === 401) { window.dispatchEvent(new Event("session-expired")); throw new Error("SESSION"); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const fmtRupee = (n) => {
  if (!n && n !== 0) return "₹0";
  const v = Number(n);
  if (v >= 1e7) return `₹${(v/1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v/1e5).toFixed(1)} L`;
  if (v >= 1e3) return `₹${(v/1e3).toFixed(0)}K`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};

const fmtN = (n) => Math.round(n ?? 0).toLocaleString("en-IN");

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return "—"; }
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

/* Role normalization — exact match to existing Dashboard.js logic */
const normRole = (r) => {
  if (!r) return "generic";
  const u = r.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["SUPERADMIN","ADMIN"].includes(u))                          return "admin";
  if (["MANAGER","SALES_MANAGER","BD_MANAGER","SALES_MGR",
       "REGIONAL_MANAGER","AREA_MANAGER"].includes(u))             return "manager";
  if (["TELECALLER","TELE_CALLER","TELE","CALLING_AGENT"].includes(u)) return "telecaller";
  if (["BD_EXECUTIVE","BDEXECUTIVE","BD_EXEC","SALES_EXEC",
       "SALES_EXECUTIVE","BD"].includes(u))                        return "bd";
  return "generic";
};

const ENDPOINTS = {
  admin:      "/dashboard/admin",
  manager:    "/dashboard/sales-manager",
  bd:         "/dashboard/bd",
  telecaller: "/dashboard/telecaller",
  generic:    "/dashboard/generic",
};

const QUOTES = [
  "Your pipeline is your future. Nurture it well! 🌱",
  "Every lead is a new opportunity — make it count! 🚀",
  "Small wins compound into big victories. 🏆",
  "Consistency beats talent — show up and deliver! 🌟",
  "Follow-ups today are someone's solution tomorrow. 🎯",
  "The best time to close a deal is right now. ⚡",
  "Every 'no' brings you closer to the next 'yes'. 💡",
];
const dailyQuote = () => QUOTES[new Date().getDate() % QUOTES.length];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

/* ═══════════════════════════════════════════════════════════════════════════
   TINY REUSABLE COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */
const Spin = () => (
  <div className="ed-center-page">
    <div className="ed-spinner" />
    <span style={{ marginTop: 14, color: "var(--ct-64748b,#64748b)", fontSize: 14 }}>
      Loading dashboard…
    </span>
  </div>
);

const ErrView = ({ msg, onRetry }) => (
  <div className="ed-err-box">
    <FiAlertCircle size={28} />
    <div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Failed to load</div>
      <div style={{ fontSize: 13 }}>{msg}</div>
    </div>
    <button className="ed-btn ed-btn-primary" onClick={onRetry}>Retry</button>
  </div>
);

const Empty = ({ icon, text = "No data" }) => (
  <div className="ed-empty-state">{icon && <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>}<div>{text}</div></div>
);

/* Trend indicator */
const Trend = ({ v }) => {
  if (v == null) return null;
  if (v > 0)  return <span className="ed-trend up"><FiArrowUp size={9}/>{v}%</span>;
  if (v < 0)  return <span className="ed-trend dn"><FiArrowDown size={9}/>{Math.abs(v)}%</span>;
  return       <span className="ed-trend fl"><FiMinus size={9}/>0%</span>;
};

/* Status badge */
const SBadge = memo(({ s }) => {
  if (!s) return <span className="sbd gray">—</span>;
  const l = s.toLowerCase();
  const cls =
    ["closed won","converted","paid","accepted","completed","interested"].some(x=>l.includes(x)) ? "green" :
    ["closed lost","rejected","cancelled","not interested"].some(x=>l.includes(x))               ? "red"   :
    ["contacted","sent","in production","new","draft"].some(x=>l.includes(x))                    ? "blue"  :
    ["pending","in discussion","not responded","on hold"].some(x=>l.includes(x))                 ? "amber" : "gray";
  return <span className={`sbd ${cls}`}>{s}</span>;
});

/* Custom recharts tooltip */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ed-chart-tip">
      {label && <div className="ed-chart-tip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="ed-chart-tip-row">
          <span style={{ color: p.color || p.stroke }}>●</span>
          <span>{p.name}:&nbsp;<b>{
            typeof p.value === "number" && p.value > 9999
              ? fmtRupee(p.value)
              : fmtN(p.value)
          }</b></span>
        </div>
      ))}
    </div>
  );
};

/* Section card wrapper */
const Card = memo(({ title, icon, sub, right, children, className = "", noPad = false }) => (
  <div className={`ed-card ${className}`}>
    {title && (
      <div className="ed-card-hd">
        <div className="ed-card-hd-l">
          {icon && <span className="ed-card-icon-wrap">{icon}</span>}
          <div>
            <div className="ed-card-title">{title}</div>
            {sub && <div className="ed-card-sub">{sub}</div>}
          </div>
        </div>
        {right && <div className="ed-card-hd-r">{right}</div>}
      </div>
    )}
    <div className={noPad ? "" : "ed-card-body"}>{children}</div>
  </div>
));

/* KPI card with sparkline */
const KPI = memo(({ label, value, sub, color = C.blue, icon, trend, spark, onClick }) => (
  <div className="ed-kpi" style={{ "--kc": color }} onClick={onClick} role={onClick?"button":undefined}>
    <div className="ed-kpi-top">
      <div className="ed-kpi-icon">{icon}</div>
      <Trend v={trend} />
    </div>
    <div className="ed-kpi-value">{value ?? "—"}</div>
    <div className="ed-kpi-label">{label}</div>
    {sub && <div className="ed-kpi-sub">{sub}</div>}
    {spark?.length > 1 && (
      <div className="ed-kpi-spark">
        <ResponsiveContainer width="100%" height={32}>
          <AreaChart data={spark} margin={{ top:2, right:0, bottom:0, left:0 }}>
            <defs>
              <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
              fill={`url(#sg-${color.replace("#","")})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
));

/* ═══════════════════════════════════════════════════════════════════════════
   CHART COMPONENTS (memoized)
═══════════════════════════════════════════════════════════════════════════ */
/* Area chart — monthly trend */
const MonthlyArea = memo(({ data, color = C.blue, h = 220 }) => {
  if (!data?.length) return <Empty text="No monthly data yet" />;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data} margin={{ top:10, right:16, bottom:0, left:-10 }}>
        <defs>
          <linearGradient id="ma-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.22}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--c-f1f5f9,#f1f5f9)" vertical={false}/>
        <XAxis dataKey="month" tick={{ fontSize:11, fill:"var(--ct-64748b,#64748b)" }} tickLine={false} axisLine={false}/>
        <YAxis tick={{ fontSize:11, fill:"var(--ct-64748b,#64748b)" }} tickLine={false} axisLine={false} allowDecimals={false}/>
        <Tooltip content={<ChartTip/>}/>
        <Area type="monotone" dataKey="leads" name="Leads" stroke={color} strokeWidth={2.5}
          fill="url(#ma-grad)" dot={{ r:3, fill:color, strokeWidth:0 }} activeDot={{ r:5 }}/>
      </AreaChart>
    </ResponsiveContainer>
  );
});

/* Bar chart — stage comparison or team */
const StageBar = memo(({ data, h = 230 }) => {
  if (!data?.length) return <Empty text="No data" />;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top:8, right:8, bottom:8, left:-10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--c-f1f5f9,#f1f5f9)" vertical={false}/>
        <XAxis dataKey="stage" tick={{ fontSize:10, fill:"var(--ct-64748b,#64748b)" }} tickLine={false} axisLine={false}/>
        <YAxis tick={{ fontSize:10, fill:"var(--ct-64748b,#64748b)" }} tickLine={false} axisLine={false} allowDecimals={false}/>
        <Tooltip content={<ChartTip/>}/>
        <Bar dataKey="v" name="Count" radius={[5,5,0,0]} maxBarSize={52}>
          {data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

/* Grouped bar — team handled vs won */
const TeamBar = memo(({ data, h = 240 }) => {
  if (!data?.length) return <Empty text="No team data" />;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top:8, right:8, bottom:8, left:-10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--c-f1f5f9,#f1f5f9)" vertical={false}/>
        <XAxis dataKey="name" tick={{ fontSize:10, fill:"var(--ct-64748b,#64748b)" }} tickLine={false} axisLine={false}/>
        <YAxis tick={{ fontSize:10, fill:"var(--ct-64748b,#64748b)" }} tickLine={false} axisLine={false} allowDecimals={false}/>
        <Tooltip content={<ChartTip/>}/>
        <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }}/>
        <Bar dataKey="handled" name="Assigned" fill={C.blue}  radius={[4,4,0,0]} maxBarSize={30}/>
        <Bar dataKey="won"     name="Won"      fill={C.green} radius={[4,4,0,0]} maxBarSize={30}/>
      </BarChart>
    </ResponsiveContainer>
  );
});

/* Donut with center text + legend */
const Donut = memo(({ data, centerVal, centerLabel, h = 200 }) => {
  const valid = (data||[]).filter(d=>d.value>0);
  if (!valid.length) return <Empty text="No data" />;
  return (
    <div className="ed-donut-wrap">
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie data={valid} cx="50%" cy="50%" innerRadius={h*0.28} outerRadius={h*0.42}
            dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
            {valid.map((_,i) => <Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]}/>)}
          </Pie>
          <Tooltip formatter={v=>fmtN(v)} contentStyle={{ fontSize:12 }}/>
        </PieChart>
      </ResponsiveContainer>
      {centerVal != null && (
        <div className="ed-donut-center">
          <div className="ed-donut-num">{typeof centerVal==="number" && centerVal>9999 ? fmtRupee(centerVal) : fmtN(centerVal)}</div>
          {centerLabel && <div className="ed-donut-lbl">{centerLabel}</div>}
        </div>
      )}
      <div className="ed-donut-legend">
        {valid.map((d,i) => (
          <div key={i} className="ed-leg-row">
            <span className="ed-leg-dot" style={{ background: DONUT_COLORS[i%DONUT_COLORS.length] }}/>
            <span className="ed-leg-name">{d.name}</span>
            <span className="ed-leg-val">{fmtN(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/* Radial progress ring — for telecaller stats */
const RadialRing = memo(({ value, max, color, label, subLabel }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value/max)*100)) : 0;
  return (
    <div className="ed-radial-wrap">
      <ResponsiveContainer width={110} height={110}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="90%"
          startAngle={90} endAngle={-270} data={[{ value: pct, fill: color }]}>
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "var(--c-f1f5f9,#f1f5f9)" }}/>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="ed-radial-center">
        <div className="ed-radial-num" style={{ color }}>{pct}%</div>
      </div>
      <div className="ed-radial-label">{label}</div>
      {subLabel && <div className="ed-radial-sub">{subLabel}</div>}
    </div>
  );
});

/* Sales funnel */
const Funnel = memo(({ data }) => {
  if (!data?.length) return <Empty text="No pipeline data"/>;
  const max = data[0]?.value || 1;
  return (
    <div className="ed-funnel">
      {data.map((s,i) => (
        <div key={i} className="ed-funnel-row">
          <div className="ed-funnel-lbl">{s.label}</div>
          <div className="ed-funnel-track">
            <div className="ed-funnel-fill" style={{
              width: `${Math.max(6, Math.round((s.value/max)*100))}%`,
              background: s.color,
            }}/>
          </div>
          <div className="ed-funnel-num">{fmtN(s.value)}</div>
        </div>
      ))}
    </div>
  );
});

/* Team performance table */
const TeamTable = memo(({ rows }) => {
  if (!rows?.length) return <Empty text="No team data" />;
  return (
    <div className="ed-tbl-wrap">
      <table className="ed-tbl">
        <thead>
          <tr>
            <th>#</th><th>Member</th><th>Leads</th><th>Won</th>
            <th>Conv%</th><th>Revenue</th><th>FU Done</th><th>FU Pending</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,10).map((m,i) => (
            <tr key={i}>
              <td className="ed-rank">{i+1}</td>
              <td>
                <div className="ed-member-cell">
                  <div className="ed-avatar" style={{ background: `${C.blue}22`, color: C.blue }}>
                    {(m.name||"?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="ed-member-nm">{m.name||"—"}</div>
                    <div className="ed-member-role">{(m.role||"").replace(/_/g," ")}</div>
                  </div>
                </div>
              </td>
              <td><b>{fmtN(m.leadsHandled)}</b></td>
              <td><span className="sbd green">{fmtN(m.leadsWon)}</span></td>
              <td>
                <div className="ed-pbar-wrap">
                  <div className="ed-pbar" style={{ width:`${Math.min(100,m.conversionRate||0)}%`, background: m.conversionRate>=20?C.green:C.amber }}/>
                  <span>{m.conversionRate||0}%</span>
                </div>
              </td>
              <td style={{ color: C.green, fontWeight:600 }}>{fmtRupee(m.revenue)}</td>
              <td><span className="sbd blue">{fmtN(m.followupsDone)}</span></td>
              <td><span className={`sbd ${m.followupsPending>0?"amber":"green"}`}>{fmtN(m.followupsPending)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* Follow-ups list */
const FUList = memo(({ items }) => {
  if (!items?.length) return <Empty icon="🎉" text="No pending follow-ups — you're all caught up!" />;
  return (
    <div className="ed-fu-list">
      {items.slice(0,10).map((f,i) => {
        const dt    = f.scheduledAt ? new Date(f.scheduledAt) : null;
        const over  = dt && dt < new Date();
        return (
          <div key={i} className={`ed-fu-row${over?" ed-fu-over":""}`}>
            <div className="ed-fu-dot" style={{ background: over?C.red:C.blue }}/>
            <div className="ed-fu-info">
              <div className="ed-fu-lead">{f.leadName||"—"}</div>
              <div className="ed-fu-meta">{f.followupType} · {f.assignedToName||"—"}</div>
            </div>
            <div className="ed-fu-right">
              <div className={`ed-fu-time${over?" ed-fu-late":""}`}>{fmtDateTime(f.scheduledAt)}</div>
              <SBadge s={f.priority}/>
            </div>
          </div>
        );
      })}
    </div>
  );
});

/* Recent orders table */
const OrdersTable = memo(({ rows }) => {
  if (!rows?.length) return <Empty text="No recent orders" />;
  return (
    <div className="ed-tbl-wrap">
      <table className="ed-tbl">
        <thead>
          <tr><th>Order No</th><th>Customer</th><th>Group</th><th>Amount</th><th>Date</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((o,i) => (
            <tr key={i}>
              <td><span style={{ fontWeight:700, color:C.blue }}>{o.orderBookNo||"—"}</span></td>
              <td>{o.customerName||"—"}</td>
              <td><span className="ed-tag">{o.groupName||"—"}</span></td>
              <td><b>{fmtRupee(o.totalAmount)}</b></td>
              <td>{fmtDate(o.orderDate)}</td>
              <td><SBadge s={o.status}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* Leads table */
const LeadsTable = memo(({ rows }) => {
  if (!rows?.length) return <Empty text="No leads data" />;
  return (
    <div className="ed-tbl-wrap">
      <table className="ed-tbl">
        <thead>
          <tr><th>Code</th><th>Name</th><th>Status</th><th>Group</th><th>Source</th><th>Created</th></tr>
        </thead>
        <tbody>
          {rows.slice(0,10).map((l,i) => (
            <tr key={i}>
              <td><code className="ed-code">{l.leadCode||"—"}</code></td>
              <td>
                <div style={{ fontWeight:600 }}>{l.name||"—"}</div>
                <div style={{ fontSize:11, color:"var(--ct-94a3b8,#94a3b8)" }}>{l.phone||""}</div>
              </td>
              <td><SBadge s={l.status}/></td>
              <td><span className="ed-tag">{l.groupName||"—"}</span></td>
              <td>{l.source||"—"}</td>
              <td>{fmtDate(l.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* Proposals table */
const ProposalTable = memo(({ rows }) => {
  if (!rows?.length) return <Empty text="No proposals" />;
  return (
    <div className="ed-tbl-wrap">
      <table className="ed-tbl">
        <thead>
          <tr><th>No.</th><th>Lead</th><th>Value</th><th>Status</th><th>Date</th></tr>
        </thead>
        <tbody>
          {rows.slice(0,8).map((p,i) => (
            <tr key={i}>
              <td><code className="ed-code">{p.proposalNo||"—"}</code></td>
              <td>{p.leadName||"—"}</td>
              <td><b style={{ color:C.green }}>{fmtRupee(p.totalValue)}</b></td>
              <td><SBadge s={p.status}/></td>
              <td>{fmtDate(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* Telecaller lead table */
const TCTable = memo(({ rows }) => {
  if (!rows?.length) return <Empty text="No leads assigned" />;
  return (
    <div className="ed-tbl-wrap">
      <table className="ed-tbl">
        <thead>
          <tr><th>Code</th><th>Name / Phone</th><th>Group</th><th>TC Status</th><th>BD Assigned</th><th>Created</th></tr>
        </thead>
        <tbody>
          {rows.slice(0,12).map((l,i) => (
            <tr key={i}>
              <td><code className="ed-code">{l.leadCode||"—"}</code></td>
              <td>
                <div style={{ fontWeight:600 }}>{l.name||"—"}</div>
                <div style={{ fontSize:11, color:"var(--ct-94a3b8,#94a3b8)" }}>{l.phone||""}</div>
              </td>
              <td><span className="ed-tag">{l.groupName||"—"}</span></td>
              <td><SBadge s={l.telecallerStatus}/></td>
              <td>{l.handedOffToBD
                ? <span className="sbd green">→ {l.bdAssigneeName||"BD"}</span>
                : <span className="sbd gray">Not handed off</span>}
              </td>
              <td>{fmtDate(l.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* Insight card */
const Insight = memo(({ type="info", icon, title, body }) => (
  <div className={`ed-insight ${type}`}>
    <div className="ed-insight-icon">{icon}</div>
    <div>
      <div className="ed-insight-title">{title}</div>
      <div className="ed-insight-body">{body}</div>
    </div>
  </div>
));

/* Quick-action button */
const QA = memo(({ label, icon, to, color }) => {
  const nav = useNavigate();
  return (
    <button className="ed-qa" style={{ "--qc": color }} onClick={() => nav(to)}>
      <span className="ed-qa-icon">{icon}</span>
      <span className="ed-qa-lbl">{label}</span>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function ExecutiveDashboard() {
  const user = storedUser();
  const role = normRole(user?.role);
  const nav  = useNavigate();

  const [data,        setData]   = useState(null);
  const [err,         setErr]    = useState(null);
  const [loading,     setLoad]   = useState(true);
  const [tab,         setTab]    = useState("overview");
  const [lastRefresh, setLR]     = useState(new Date());

  const ep = ENDPOINTS[role] || ENDPOINTS.generic;

  const load = useCallback(async () => {
    setLoad(true); setErr(null);
    try {
      const res = await get(ep);
      setData(res.data ?? res);
      setLR(new Date());
    } catch (e) {
      if (e.message !== "SESSION") setErr(e.message);
    } finally {
      setLoad(false);
    }
  }, [ep]);

  useEffect(() => { load(); }, [load]);
  /* Auto-refresh every 5 minutes */
  useEffect(() => { const t = setInterval(load, 300_000); return () => clearInterval(t); }, [load]);

  /* ── Derived data (memoized) ──────────────────────────────────────────── */
  const monthlyData = useMemo(() =>
    (data?.monthlyLeads ?? []).map(m => ({ month: m.label, leads: Number(m.value) }))
  , [data]);

  const sparkData = useMemo(() =>
    (data?.monthlyLeads ?? []).slice(-6).map(m => ({ value: Number(m.value) }))
  , [data]);

  const funnelData = useMemo(() => {
    if (!data) return [];
    const total = Number(data.totalLeads ?? data.myLeads ?? 0);
    return [
      { label:"Total Leads",    value: total,                            color: C.blue   },
      { label:"Contacted",      value: Number(data.contacted??0),        color: C.sky    },
      { label:"In Discussion",  value: Number(data.inDiscussion??0),     color: C.purple },
      { label:"Proposal Sent",  value: Number(data.proposalSent??0),     color: C.amber  },
      { label:"Closed Won",     value: Number(data.closedWon??0),        color: C.green  },
    ].filter(s => s.value >= 0);
  }, [data]);

  const stageBarData = useMemo(() => [
    { stage:"Total",      v: Number(data?.totalLeads ?? data?.myLeads ?? 0) },
    { stage:"Contacted",  v: Number(data?.contacted  ?? 0) },
    { stage:"Discussion", v: Number(data?.inDiscussion ?? 0) },
    { stage:"Proposal",   v: Number(data?.proposalSent ?? 0) },
    { stage:"Won",        v: Number(data?.closedWon ?? 0) },
  ], [data]);

  const teamChartData = useMemo(() =>
    (data?.teamPerformance ?? data?.teamMembers ?? []).slice(0,8).map(m => ({
      name: (m.name||"").split(" ")[0],
      handled: Number(m.leadsHandled),
      won:     Number(m.leadsWon),
    }))
  , [data]);

  const leadStatusDonut = useMemo(() => [
    { name:"Closed Won",    value: Number(data?.closedWon??0) },
    { name:"Active",        value: Number(data?.activeLeads??0) },
    { name:"Contacted",     value: Number(data?.contacted??0) },
    { name:"Discussion",    value: Number(data?.inDiscussion??0) },
    { name:"Proposal Sent", value: Number(data?.proposalSent??0) },
  ].filter(d=>d.value>0), [data]);

  const fuDonut = useMemo(() => [
    { name:"Pending",  value: Number(data?.pendingFollowups??0) },
    { name:"Overdue",  value: Number(data?.overdueFollowups??0) },
    { name:"Today",    value: Number(data?.todayFollowups??0) },
  ].filter(d=>d.value>0), [data]);

  /* Telecaller-specific donut */
  const tcDonut = useMemo(() => [
    { name:"Interested",     value: Number(data?.interested??0) },
    { name:"Not Interested", value: Number(data?.notInterested??0) },
    { name:"Not Responded",  value: Number(data?.notResponded??0) },
    { name:"Handed to BD",   value: Number(data?.handedOff??0) },
    { name:"Pending",        value: Number(data?.pending??0) },
  ].filter(d=>d.value>0), [data]);

  /* Smart insights */
  const insights = useMemo(() => {
    if (!data) return [];
    const out = [];
    const total = Number(data.totalLeads ?? data.myLeads ?? 0);
    const won   = Number(data.closedWon ?? 0);
    const conv  = data.conversionRate ?? (total > 0 ? Math.round((won/total)*100) : null);

    if (Number(data.overdueFollowups ?? 0) > 0)
      out.push({ type:"warning", icon:<FiAlertTriangle/>,
        title:`${data.overdueFollowups} Overdue Follow-ups`,
        body:"These leads are waiting for your response. Addressing them now prevents losing opportunities." });

    if (conv !== null && conv < 15)
      out.push({ type:"danger", icon:<FiTrendingDown/>,
        title:`Low Conversion Rate: ${conv}%`,
        body:"Industry benchmark is 20–25%. Review lead quality, follow-up frequency, and proposal effectiveness." });

    if (conv !== null && conv >= 25)
      out.push({ type:"success", icon:<FiTrendingUp/>,
        title:`Strong Conversion: ${conv}%`,
        body:"Above industry benchmark! This team is closing deals effectively. Keep the momentum." });

    if (Number(data.orderBookValue ?? 0) > 0)
      out.push({ type:"info", icon:<FiPackage/>,
        title:`Order Book: ${fmtRupee(data.orderBookValue)}`,
        body:`${fmtN(data.totalOrders)} confirmed orders. Ensure delivery timelines and invoicing are on track.` });

    if (Number(data.todayFollowups ?? 0) > 0)
      out.push({ type:"info", icon:<FiClock/>,
        title:`${data.todayFollowups} Follow-ups Due Today`,
        body:"Complete these to stay on track. Timely follow-ups improve conversion by up to 50%." });

    if (Number(data.leadsThisMonth ?? 0) > 0)
      out.push({ type:"info", icon:<FiZap/>,
        title:`${data.leadsThisMonth} New Leads This Month`,
        body:"Monitor quality over quantity. Ensure each lead is properly qualified and assigned." });

    return out.slice(0, 5);
  }, [data]);

  const isAdmin   = role === "admin";
  const isManager = role === "manager";
  const isBD      = role === "bd";
  const isTC      = role === "telecaller";
  const hasTeam   = isAdmin || isManager;
  const hasOrders = isAdmin || isManager;
  const hasRevenue = isManager || isBD;

  const TABS = [
    { id:"overview",  label:"Overview",  icon:<FiGrid size={13}/> },
    { id:"pipeline",  label:"Pipeline",  icon:<FiTarget size={13}/> },
    ...(hasTeam ? [{ id:"team", label:"Team", icon:<FiUsers size={13}/> }] : []),
    ...(hasOrders? [{ id:"orders", label:"Orders", icon:<FiShoppingCart size={13}/> }] : []),
    { id:"insights",  label:"Insights",  icon:<FiZap size={13}/> },
  ];

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  if (loading) return <Spin />;
  if (err)     return <ErrView msg={err} onRetry={load}/>;
  if (!data)   return null;

  return (
    <div className="ed-root">

      {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
      <div className="ed-header">
        <div className="ed-header-l">
          <div className="ed-greeting-time">{greeting()},</div>
          <div className="ed-greeting-name">
            {user?.name ?? "User"}
            <span className="ed-role-pill">
              {(user?.role||"").replace(/_/g," ")}
            </span>
          </div>
          <div className="ed-header-date">
            {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>
        </div>
        <div className="ed-header-r">
          <div className="ed-quote">"{dailyQuote()}"</div>
          <div className="ed-header-meta">
            <span className="ed-refresh-info">
              <FiClock size={11}/> {lastRefresh.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
            </span>
            <button className="ed-btn ed-btn-ghost" onClick={load}>
              <FiRefreshCw size={13}/> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ══ QUICK ACTIONS ════════════════════════════════════════════════ */}
      <div className="ed-qa-row">
        <QA label="New Lead"        icon={<FiTarget size={14}/>}     to="/sales/leads"               color={C.blue}/>
        <QA label="Follow-Ups"      icon={<FiCalendar size={14}/>}   to="/follow-ups"                color={C.green}/>
        {(isAdmin||isManager||isBD) && <QA label="Proposals" icon={<FiFileText size={14}/>} to="/sales/proposals" color={C.purple}/>}
        {hasOrders && <QA label="Order Book"   icon={<FiShoppingCart size={14}/>} to="/order-book"     color={C.amber}/>}
        {isAdmin   && <QA label="Users"        icon={<FiUsers size={14}/>}        to="/users"          color={C.teal}/>}
        {isAdmin   && <QA label="Invoices"     icon={<FiDollarSign size={14}/>}   to="/sales/invoices" color={C.rose}/>}
        <QA label="Project DB"      icon={<FiBarChart2 size={14}/>}  to="/project-over-view"         color={C.indigo}/>
        <QA label="Reports"         icon={<MdOutlineLeaderboard size={14}/>} to="/reports"            color={C.sky}/>
        {isAdmin   && <QA label="Inventory" icon={<MdOutlineInventory2 size={14}/>} to="/inventory-management" color={C.orange}/>}
      </div>

      {/* ══ KPI STRIP ════════════════════════════════════════════════════ */}
      <div className="ed-kpi-grid">

        <KPI label="Total Leads"
          value={fmtN(data.totalLeads ?? data.myLeads ?? data.total ?? 0)}
          icon={<FiTarget/>} color={C.blue}
          sub={data.leadsThisMonth != null ? `${data.leadsThisMonth} this month` : undefined}
          spark={sparkData} />

        <KPI label="Closed Won"
          value={fmtN(data.closedWon ?? 0)}
          icon={<FiCheckCircle/>} color={C.green}
          sub={data.conversionRate != null ? `${data.conversionRate}% conv. rate` : undefined}
          spark={(data?.monthlyLeads??[]).slice(-6).map(m=>({value:Math.round(Number(m.value)*0.2)}))}/>

        <KPI label="Active Leads"
          value={fmtN(data.activeLeads ?? 0)}
          icon={<FiActivity/>} color={C.indigo}/>

        <KPI label="Follow-Ups"
          value={fmtN(data.pendingFollowups ?? 0)}
          icon={<FiClock/>} color={C.amber}
          sub={`${data.overdueFollowups??0} overdue`}/>

        <KPI label="Today's FU"
          value={fmtN(data.todayFollowups ?? 0)}
          icon={<FiCalendar/>} color={C.rose}
          sub="Scheduled today"/>

        {hasOrders && (
          <KPI label="Order Book"
            value={fmtRupee(data.orderBookValue ?? 0)}
            icon={<FiDollarSign/>} color={C.teal}
            sub={`${data.totalOrders??0} orders`}/>
        )}

        {hasOrders && (
          <KPI label="Proposals"
            value={fmtN(data.totalProposals ?? data.myProposals ?? 0)}
            icon={<FiFileText/>} color={C.purple}/>
        )}

        {hasRevenue && data.revenue != null && (
          <KPI label="My Revenue"
            value={fmtRupee(data.revenue)}
            icon={<FiTrendingUp/>} color={C.sky}/>
        )}

        {/* Telecaller KPIs */}
        {isTC && (
          <KPI label="Called" value={fmtN(data.called??0)}
            icon={<FiPhone/>} color={C.sky}/>
        )}
        {isTC && (
          <KPI label="Interested" value={fmtN(data.interested??0)}
            icon={<FiThumbsUp/>} color={C.green}
            sub={`${data.handedOff??0} → BD`}/>
        )}
        {isTC && (
          <KPI label="Not Responded" value={fmtN(data.notResponded??0)}
            icon={<FiAlertCircle/>} color={C.amber}/>
        )}
        {isTC && (
          <KPI label="Handed to BD" value={fmtN(data.handedOff??0)}
            icon={<FiSend/>} color={C.purple}/>
        )}
      </div>

      {/* ══ TABS ═════════════════════════════════════════════════════════ */}
      <div className="ed-tabs-bar">
        {TABS.map(t => (
          <button key={t.id} className={`ed-tab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ═════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="ed-grid">

          {/* Monthly trend — full width */}
          <Card title="Monthly Lead Trend" icon={<FiTrendingUp size={14}/>}
            sub="Last 6 months performance"
            right={<span className="ed-card-badge">Area Chart</span>}
            className="span-2">
            <MonthlyArea data={monthlyData} h={230}/>
          </Card>

          {/* Lead status donut */}
          <Card title="Lead Status Breakdown" icon={<FiPieChart size={14}/>}>
            <Donut data={leadStatusDonut}
              centerVal={Number(data.totalLeads??data.myLeads??0)}
              centerLabel="Leads"/>
          </Card>

          {/* Follow-up donut */}
          <Card title="Follow-up Overview" icon={<FiClock size={14}/>}>
            <Donut data={fuDonut}
              centerVal={Number(data.pendingFollowups??0)}
              centerLabel="Pending"/>
          </Card>

          {/* Telecaller radial rings */}
          {isTC && data.total > 0 && (
            <Card title="Telecaller Performance Rings" icon={<FiActivity size={14}/>} className="span-2">
              <div className="ed-radial-row">
                <RadialRing value={data.interested??0}    max={data.total??1} color={C.green}  label="Interested"      subLabel={`${data.interested??0} / ${data.total??0}`}/>
                <RadialRing value={data.handedOff??0}     max={data.total??1} color={C.blue}   label="Handed to BD"    subLabel={`${data.handedOff??0} / ${data.total??0}`}/>
                <RadialRing value={data.called??0}        max={data.total??1} color={C.purple} label="Called"          subLabel={`${data.called??0} / ${data.total??0}`}/>
                <RadialRing value={data.notInterested??0} max={data.total??1} color={C.red}    label="Not Interested"  subLabel={`${data.notInterested??0} / ${data.total??0}`}/>
                <RadialRing value={data.notResponded??0}  max={data.total??1} color={C.amber}  label="Not Responded"   subLabel={`${data.notResponded??0} / ${data.total??0}`}/>
              </div>
            </Card>
          )}

          {/* Telecaller status donut */}
          {isTC && (
            <Card title="Lead Status Mix" icon={<FiPieChart size={14}/>}>
              <Donut data={tcDonut} centerVal={data.total??0} centerLabel="Total"/>
            </Card>
          )}

          {/* Pending follow-ups list */}
          <Card title="Upcoming Follow-ups" icon={<FiClock size={14}/>}
            sub="Sorted by schedule"
            right={<button className="ed-link-btn" onClick={()=>nav("/follow-ups")}>View all →</button>}
            className="span-2">
            <FUList items={data.followups}/>
          </Card>
        </div>
      )}

      {/* ══════════ PIPELINE TAB ════════════════════════════════════════ */}
      {tab === "pipeline" && (
        <div className="ed-grid">

          <Card title="Sales Pipeline Funnel" icon={<FiTarget size={14}/>}
            sub="Lead journey from new to won">
            <Funnel data={funnelData}/>
          </Card>

          <Card title="Stage Comparison" icon={<FiBarChart2 size={14}/>}
            sub="Counts per stage">
            <StageBar data={stageBarData} h={240}/>
          </Card>

          {/* Leads table */}
          <Card title="My Leads" icon={<FiTarget size={14}/>}
            right={<button className="ed-link-btn" onClick={()=>nav("/sales/leads")}>View all →</button>}
            className="span-2">
            {isTC
              ? <TCTable rows={data.leads}/>
              : <LeadsTable rows={data.leads}/>
            }
          </Card>

          {/* Proposals */}
          {data.proposals?.length > 0 && (
            <Card title="Proposals" icon={<FiFileText size={14}/>}
              right={<button className="ed-link-btn" onClick={()=>nav("/sales/proposals")}>View all →</button>}
              className="span-2">
              <ProposalTable rows={data.proposals}/>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ TEAM TAB ════════════════════════════════════════════ */}
      {tab === "team" && hasTeam && (
        <div className="ed-grid">
          {teamChartData.length > 0 && (
            <Card title="Team Performance Chart" icon={<FiBarChart2 size={14}/>}
              sub="Assigned vs won leads" className="span-2">
              <TeamBar data={teamChartData} h={250}/>
            </Card>
          )}
          <Card title="Team Member Scorecards" icon={<FiAward size={14}/>}
            sub="Full performance breakdown" className="span-2">
            <TeamTable rows={data.teamPerformance ?? data.teamMembers}/>
          </Card>
        </div>
      )}

      {/* ══════════ ORDERS TAB ══════════════════════════════════════════ */}
      {tab === "orders" && hasOrders && (
        <div className="ed-grid">
          {/* Order KPIs */}
          <Card title="Order Book Summary" icon={<FiShoppingCart size={14}/>}
            className="span-2" noPad>
            <div className="ed-order-kpi-row">
              <div className="ed-ok">
                <div className="ed-ok-icon" style={{background:`${C.teal}18`,color:C.teal}}><FiDollarSign/></div>
                <div className="ed-ok-val">{fmtRupee(data.orderBookValue??0)}</div>
                <div className="ed-ok-lbl">Total Order Book</div>
              </div>
              <div className="ed-ok">
                <div className="ed-ok-icon" style={{background:`${C.blue}18`,color:C.blue}}><FiShoppingCart/></div>
                <div className="ed-ok-val">{fmtN(data.totalOrders??0)}</div>
                <div className="ed-ok-lbl">Total Orders</div>
              </div>
              <div className="ed-ok">
                <div className="ed-ok-icon" style={{background:`${C.purple}18`,color:C.purple}}><FiFileText/></div>
                <div className="ed-ok-val">{fmtN(data.totalProposals??data.myProposals??0)}</div>
                <div className="ed-ok-lbl">Total Proposals</div>
              </div>
              <div className="ed-ok">
                <div className="ed-ok-icon" style={{background:`${C.green}18`,color:C.green}}><FiCheckCircle/></div>
                <div className="ed-ok-val">{fmtN(data.closedWon??0)}</div>
                <div className="ed-ok-lbl">Closed Won</div>
              </div>
            </div>
          </Card>

          <Card title="Recent Orders" icon={<FiShoppingCart size={14}/>}
            right={<button className="ed-link-btn" onClick={()=>nav("/order-book")}>View all →</button>}
            className="span-2">
            <OrdersTable rows={data.recentOrders}/>
          </Card>

          <Card title="Proposals" icon={<FiFileText size={14}/>}
            right={<button className="ed-link-btn" onClick={()=>nav("/sales/proposals")}>View all →</button>}
            className="span-2">
            <ProposalTable rows={data.proposals}/>
          </Card>
        </div>
      )}

      {/* ══════════ INSIGHTS TAB ════════════════════════════════════════ */}
      {tab === "insights" && (
        <div className="ed-grid">
          <Card title="Smart Insights & Alerts" icon={<FiZap size={14}/>}
            sub="AI-powered recommendations" className="span-2">
            {insights.length === 0
              ? <Empty icon="🎉" text="Everything looks great! No alerts at this time."/>
              : <div className="ed-insights-list">
                  {insights.map((ins,i) => <Insight key={i} {...ins}/>)}
                </div>
            }
          </Card>

          {monthlyData.length > 0 && (
            <Card title="Lead Growth Line" icon={<FiTrendingUp size={14}/>}
              sub="Month-over-month trajectory" className="span-2">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyData} margin={{top:10,right:16,bottom:0,left:-10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-f1f5f9,#f1f5f9)" vertical={false}/>
                  <XAxis dataKey="month" tick={{fontSize:11,fill:"var(--ct-64748b,#64748b)"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:11,fill:"var(--ct-64748b,#64748b)"}} tickLine={false} axisLine={false} allowDecimals={false}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Line type="monotone" dataKey="leads" name="Leads" stroke={C.blue}
                    strokeWidth={2.5} dot={{r:4,fill:C.blue,strokeWidth:0}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Conversion rate gauge */}
          {(data.conversionRate != null || data.closedWon != null) && (() => {
            const conv = data.conversionRate ??
              (Number(data.totalLeads??data.myLeads??0) > 0
                ? Math.round((Number(data.closedWon??0)/Number(data.totalLeads??data.myLeads??1))*100)
                : 0);
            const color = conv >= 25 ? C.green : conv >= 15 ? C.amber : C.red;
            return (
              <Card title="Conversion Rate" icon={<FiAward size={14}/>}
                sub="Won / Total Leads">
                <div className="ed-conv-center">
                  <RadialRing value={conv} max={100} color={color}
                    label="Conversion" subLabel={`${conv}% (target: 25%)`}/>
                  <div className="ed-conv-detail">
                    <div className="ed-conv-row"><span>Total Leads</span><b>{fmtN(data.totalLeads??data.myLeads??0)}</b></div>
                    <div className="ed-conv-row"><span>Closed Won</span><b style={{color:C.green}}>{fmtN(data.closedWon??0)}</b></div>
                    <div className="ed-conv-row"><span>Benchmark</span><b style={{color:C.blue}}>25%</b></div>
                    <div className="ed-conv-row"><span>Status</span>
                      <b style={{color}}>{conv>=25?"Above":"Below"} target</b>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* Follow-up health */}
          <Card title="Follow-up Health" icon={<FiClock size={14}/>}>
            <Donut data={fuDonut}
              centerVal={Number(data.pendingFollowups??0)}
              centerLabel="Pending"/>
          </Card>
        </div>
      )}

    </div>
  );
}