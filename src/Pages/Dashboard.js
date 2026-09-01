// RoleDashboard.js — Role-based CRM Dashboard
// Fixed: role matching, fixed-height cards, generic dashboard for all roles

import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../pages-css/Dashboard.css";
// Solar Capacity tile is currently hidden — see components/dashboard/ProjectCapacityKpi.js
// to re-enable (one import here, one <ProjectCapacityKpi /> in the KPI grid below).
// The Orders-in-Pipeline KPI tiles were folded into the Pipeline Value card, so
// the dashboard now calls that summary endpoint directly instead of mounting
// components/dashboard/OrdersInLineDashboardBlock (still used nowhere else).
import ordersInLineApi from "../services/ordersInLineApi";
// Admin dashboard only. Both already ship with the app — no new dependency.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ReceiptIndianRupee, BarChart3, Users, ShoppingBag, ClipboardCheck, Activity,
  Building2, Briefcase, CheckCircle2, UserCheck,
  ArrowUp, ArrowDown, ArrowRight,
  // Manager / BD / Telecaller / Generic — these replace the emoji that used to
  // be handed to the old KpiCard, so every dashboard speaks one icon language.
  ClipboardList, RefreshCw, Wallet, FileText, MessagesSquare, PhoneCall,
  CalendarClock, AlertTriangle, XCircle, Clock, Target, TrendingUp, Sparkles,
} from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";
const USER_KEY = "bd_portal_user";

/* ─── Fetch helper ──────────────────────────────────────────────────────────── */
const getHeaders = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    const u   = raw ? JSON.parse(raw)?.user : null;
    return {
      "Content-Type": "application/json",
      "User-Id":   String(u?.id   ?? ""),
      "User-Role": String(u?.role ?? ""),
    };
  } catch { return { "Content-Type": "application/json" }; }
};

const apiFetch = async (path) => {
  const res = await fetch(API_BASE + path, { headers: getHeaders(), credentials: "include" });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ─── Role normalizer — handles all DB variants ─────────────────────────────── */
function normalizeRole(role) {
  if (!role) return "generic";
  const r = role.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (r === "SUPERADMIN" || r === "ADMIN") return "admin";
  // Manager variants
  if (["MANAGER","SALES_MANAGER","BD_MANAGER","SALES_MGR","REGIONAL_MANAGER","AREA_MANAGER"].includes(r)) return "manager";
  // Telecaller variants
  if (["TELECALLER","TELE_CALLER","TELE","CALLING_AGENT"].includes(r)) return "telecaller";
  // BD executive variants
  if (["BD_EXECUTIVE","BDEXECUTIVE","BD_EXEC","SALES_EXEC","SALES_EXECUTIVE","BD"].includes(r)) return "bd";
  return "generic";
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const fmtMoney = (n) => {
  if (!n && n !== 0) return "₹0";
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(1)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
};

const fmtNum = (n) => (n ?? 0).toLocaleString("en-IN");

/* kW in, human-readable capacity out. */
const fmtCapacity = (kwRaw) => {
  const kw = typeof kwRaw === "string" ? parseFloat(kwRaw) : Number(kwRaw);
  if (!Number.isFinite(kw) || kw <= 0) return null;
  if (kw >= 1000) return `${(kw / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} MW`;
  return `${kw.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kW`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return "—"; }
};

const daysDiff = (d) => {
  if (!d) return null;
  return Math.round((new Date(d) - Date.now()) / 86400000);
};

const roleFmt = (r) => (r || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const statusBadge = (status) => {
  if (!status) return <span className="rd-badge rd-badge-gray">—</span>;
  const s = status.toLowerCase();
  if (["closed won","converted","paid","accepted","completed","confirmed","interested"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-green">{status}</span>;
  if (["closed lost","rejected","cancelled","not interested","not_interested"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-red">{status}</span>;
  if (["new","draft"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-indigo">{status}</span>;
  if (["contacted","sent","in production"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-blue">{status}</span>;
  if (["pending","not responded","in discussion","not_responded"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-yellow">{status}</span>;
  return <span className="rd-badge rd-badge-gray">{status}</span>;
};

const roleBadgeStyle = (role) => {
  const r = (role || "").toUpperCase();
  if (r === "SUPERADMIN") return { background: "#ede9fe", color: "#7c3aed" };
  if (r === "ADMIN")      return { background: "#dbeafe", color: "#1d4ed8" };
  if (normalizeRole(role) === "manager")  return { background: "#dcfce7", color: "#15803d" };
  if (normalizeRole(role) === "bd")       return { background: "#fff7ed", color: "#c2410c" };
  if (normalizeRole(role) === "telecaller") return { background: "#fef3c7", color: "#b45309" };
  return { background: "#f1f5f9", color: "#475569" };
};

/* ─── Motivational quotes ────────────────────────────────────────────────────── */
const QUOTES = [
  "Every lead is a new opportunity — make it count! 🚀",
  "Your hustle today builds tomorrow's success. 💪",
  "Small wins add up to big victories. Keep pushing! 🏆",
  "The best time to close a deal is right now. ⚡",
  "Your follow-ups today are someone's solution tomorrow. 🎯",
  "Consistency beats talent — show up and deliver! 🌟",
  "Every 'no' brings you closer to the next 'yes'. 💡",
  "Your pipeline is your future. Nurture it well! 🌱",
];
const getDailyQuote = () => QUOTES[new Date().getDate() % QUOTES.length];

/* ─── Reusable UI ───────────────────────────────────────────────────────────── */
const Spinner = () => <div className="rd-loading"><div className="rd-spinner" />Loading…</div>;
const Empty   = ({ icon = "📭", msg = "No data available" }) => (
  <div className="rd-empty"><div className="rd-empty-icon">{icon}</div>{msg}</div>
);

const MiniBarChart = ({ data = [], color = "#3b82f6" }) => {
  const max = Math.max(...data.map(d => d.value ?? d.v ?? 0), 1);
  return (
    <div className="rd-mini-chart">
      {data.map((d, i) => {
        const v = d.value ?? d.v ?? 0;
        const l = d.label ?? d.l ?? "";
        return (
          <div key={i} className="rd-mini-bar-wrap">
            <div className="rd-mini-bar-bg">
              <div className="rd-mini-bar-fill" style={{ height: `${(v / max) * 100}%`, background: color }} />
            </div>
            <div className="rd-mini-bar-val">{v}</div>
            <div className="rd-mini-bar-label">{l}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Leads table ─────────────────────────────────────────────────────────────── */
const LeadsTable = ({ leads = [], emptyMsg = "No leads found" }) => {
  if (!leads.length) return <Empty icon="📂" msg={emptyMsg} />;
  return (
    <table className="rd-table rd-ad-table compact auto" style={{ width: "100%" }}>
      <thead>
        <tr><th>Lead Name</th><th>Status</th><th>Group</th><th>Source</th><th>Date</th></tr>
      </thead>
      <tbody>
        {leads.map((l, i) => (
          <tr key={i}>
            <td className="name-cell">{l.name}</td>
            <td>{statusBadge(l.status)}</td>
            <td style={{ color: "#64748b" }}>{[l.groupName, l.subGroupName].filter(Boolean).join(" / ") || "—"}</td>
            <td>{l.source || "—"}</td>
            <td>{fmtDate(l.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ─── Proposals table ────────────────────────────────────────────────────────── */
const ProposalsTable = ({ proposals = [] }) => {
  if (!proposals.length) return <Empty icon="📄" msg="No proposals yet" />;
  return (
    <table className="rd-table rd-ad-table compact auto" style={{ width: "100%" }}>
      <thead>
        <tr><th>Proposal No</th><th>Lead</th><th>Value</th><th>Status</th><th>Date</th></tr>
      </thead>
      <tbody>
        {proposals.map((p, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "monospace", color: "#1d4ed8", fontWeight: 700 }}>{p.proposalNo || `PROP-${p.id}`}</td>
            <td>{p.leadName || "—"}</td>
            <td style={{ color: "#059669", fontWeight: 600 }}>{fmtMoney(p.totalValue)}</td>
            <td>{statusBadge(p.status)}</td>
            <td>{fmtDate(p.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ─── Task list ──────────────────────────────────────────────────────────────── */
const TaskList = ({ tasks = [] }) => {
  if (!tasks.length) return <Empty icon="✅" msg="No pending tasks — you're all caught up!" />;
  return (
    <div className="rd-task-list">
      {tasks.map((t, i) => {
        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed";
        const pColor = t.priority === "High" ? "#ef4444" : t.priority === "Medium" ? "#f59e0b" : "#10b981";
        const sc = isOverdue
          ? { bg: "#fee2e2", color: "#991b1b" }
          : { Pending: { bg: "#fef3c7", color: "#92400e" }, "In Progress": { bg: "#dbeafe", color: "#1e40af" }, Completed: { bg: "#d1fae5", color: "#065f46" } }[t.status]
          || { bg: "#f3f4f6", color: "#374151" };
        return (
          <div key={i} className="rd-task-item" style={{ borderLeft: `3px solid ${pColor}` }}>
            <div className="rd-task-main">
              <div className="rd-task-title">{t.title || "—"}</div>
              <div className="rd-task-meta">
                {t.category && <span className="rd-tag">{t.category}</span>}
                {t.dueDate && <span style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#94a3b8" }}>Due {fmtDate(t.dueDate)}{isOverdue ? " ⚠️" : ""}</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
              <span style={{ background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                {isOverdue ? "Overdue" : t.status}
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{t.priority}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SUPER ADMIN / ADMIN
   ───────────────────────────────────────────────────────────────────────────────
   Everything named Ad* below is ADMIN-ONLY on purpose. The shared helpers above
   (Card / TallCard / KpiCard / Funnel / FollowupBlock / TeamTable) are each
   rendered by three to five role dashboards, so redesigning the admin view means
   adding components BESIDE them — never restyling theirs.

   Colour lives in Dashboard.css under the rd-ad-* namespace. Inline hex in JSX
   bypasses theme.css's --c-* / --ct-* token layer and would not flip in dark
   mode; the only hex kept here is what recharts needs as a literal SVG prop.

   Every field added to /dashboard/admin is read defensively (?? / ?.) so this
   page renders correctly against a backend that has not been updated yet.
═══════════════════════════════════════════════════════════════════════════════ */

/* recharts needs real colour literals for stroke/fill — CSS vars are only safe
   on the props that take a plain string (grid stroke, tick fill). */
const AD_BLUE   = "#2563eb";
const AD_PURPLE = "#7c3aed";

/* Growth pill. Renders NOTHING when the backend has no delta for this KPI, so a
   dashboard talking to an older API degrades quietly instead of claiming 0%. */
const AdDelta = ({ value }) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const up = n >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <div className="rd-ad-delta-wrap">
      <div className={`rd-ad-delta ${up ? "up" : "down"}`}>
        <Arrow size={13} strokeWidth={2.8} />
        {up ? "" : "-"}{Math.abs(n).toFixed(1)}%
      </div>
      <div className="rd-ad-delta-note">vs last month</div>
    </div>
  );
};

/* `sub` is the descriptor line the role dashboards carry ("45% conv.",
   "3 accepted") where admin carries a month-over-month `delta`. Optional and
   additive: the admin cards never pass it, so they render exactly as before. */
const AdKpiCard = ({ label, value, sub, delta, extra, icon: Icon, tone = "blue", onClick }) => (
  <div
    className={`rd-ad-kpi rd-ad-tone-${tone}`}
    style={{ cursor: onClick ? "pointer" : undefined }}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
  >
    <div className="rd-ad-kpi-top">
      <div className="rd-ad-kpi-icon"><Icon size={19} strokeWidth={2.1} /></div>
      <div className="rd-ad-kpi-body">
        <div className="rd-ad-kpi-label">{label}</div>
        <div className="rd-ad-kpi-value">{value ?? "—"}</div>
        <div className="rd-ad-kpi-foot">
          <AdDelta value={delta} />
          {sub && <span className="rd-ad-kpi-sub">{sub}</span>}
          {extra && <span className="rd-ad-kpi-extra">{extra}</span>}
        </div>
      </div>
    </div>
  </div>
);

/* Admin KPI tile in the ORIGINAL block style: coloured rule across the top, icon,
   label, figure, caption. Admin briefly used AdKpiCard's horizontal icon-beside-text
   layout; this restores the block look while keeping the growth pill.

   It reuses .rd-kpi-card — the same class the Orders-in-Pipeline tiles already draw
   with — so there is one definition of the block, not a copy. Only the admin row
   uses it; every other dashboard keeps AdKpiCard untouched.

   NO growth pill. The "vs last month" deltas were removed from this row: they are
   computed against the previous calendar month, so early in a month — or on any
   figure that is a running total rather than a period flow — they printed things
   like +1276% and +2482%, which is noise dressed up as insight. The KPI is the
   number; the trend lives in the Order Book Overview chart below. */
const AdBlockKpi = ({ label, value, sub, strongSub = false, accent, iconBg, icon: Icon, onClick }) => (
  <div
    className="rd-kpi-card"
    style={{ "--kpi-accent": accent, "--kpi-icon-bg": iconBg, cursor: onClick ? "pointer" : undefined }}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
  >
    <div className="rd-kpi-icon" style={{ color: accent }}><Icon size={17} strokeWidth={2.2} /></div>
    <div className="rd-kpi-label">{label}</div>
    <div className="rd-kpi-value">{value ?? "—"}</div>
    {/* strongSub promotes the caption to a second headline figure — used for the
        capacity under Expected Order Value, which is a number in its own right. */}
    {sub && (
      <div className="rd-kpi-sub"
           style={strongSub ? { fontSize: 13, fontWeight: 700, color: "var(--ct-0f172a, #0f172a)", marginTop: 2 } : undefined}>
        {sub}
      </div>
    )}
  </div>
);

/* Section shell. Deliberately NOT the shared <Card>, which hard-codes an inline
   pixel height and is fought by an !important block in Dashboard.css.
   Flex column so a card that spans two grid rows can give its body the slack. */
const AdCard = ({ title, right, children, bodyClass = "" }) => (
  <section className="rd-ad-card">
    {(title || right) && (
      <header className="rd-ad-card-head">
        <h3 className="rd-ad-card-title">{title}</h3>
        {right}
      </header>
    )}
    <div className={`rd-ad-card-body ${bodyClass}`}>{children}</div>
  </section>
);

/* ─── Revenue overview ───────────────────────────────────────────────────────── */
const AdChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rd-ad-tip">
      {label && <div className="rd-ad-tip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="rd-ad-tip-row">
          <span className="rd-ad-tip-dash" style={{ borderTopColor: p.color || p.stroke }} />
          <span className="rd-ad-tip-name">{p.name}</span>
          <b className="rd-ad-tip-val">{fmtMoney(p.value)}</b>
        </div>
      ))}
    </div>
  );
};

/* Named for what the series actually holds. The solid line is monthlyRevenue(),
   which sums order_book.total_amount — orders BOOKED in each month, not money
   received. Calling that "Revenue" implied cash collected and put it in direct
   conflict with the Total Billed Value tile above, which is the invoiced figure
   and is much smaller. The dashed line is open proposals, i.e. what is not
   booked yet. Both are order-book quantities, so the card is named for that. */
const AdOrderBookChart = ({ data = [] }) => {
  if (!data.length) return <Empty icon="📈" msg="No order history yet" />;
  return (
    <>
      <div className="rd-ad-axis-cap">Amount (Cr)</div>
      {/* flex:1 + minHeight:0 lets the plot absorb whatever height the stretched
          card has left over, instead of leaving a gap under a fixed 218px. */}
      <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 10, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-f1f5f9, #f1f5f9)" vertical={false} />
          {/* Backend labels are "Aug 26"; the axis only needs the month. */}
          <XAxis dataKey="label" tickFormatter={(v) => String(v).split(" ")[0]}
                 tick={{ fontSize: 11, fill: "var(--ct-94a3b8, #94a3b8)" }}
                 tickLine={false} axisLine={false} dy={4} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ct-94a3b8, #94a3b8)" }}
                 tickLine={false} axisLine={false} width={52}
                 tickFormatter={(v) => (Number(v) / 1e7).toFixed(0)} />
          <Tooltip content={<AdChartTip />} cursor={{ stroke: "var(--c-cbd5e1, #cbd5e1)", strokeWidth: 1 }} />
          <Line type="linear" dataKey="revenue" name="Booked" stroke={AD_BLUE}
                strokeWidth={2.4} dot={{ r: 2.5, fill: AD_BLUE, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: AD_BLUE, strokeWidth: 0 }} />
          <Line type="linear" dataKey="pipeline" name="Expected" stroke={AD_PURPLE}
                strokeWidth={2} strokeDasharray="5 4" dot={false}
                activeDot={{ r: 5, fill: AD_PURPLE, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
      </div>
      <div className="rd-ad-legend">
        <span className="rd-ad-leg"><i className="rd-ad-leg-line solid" />Booked</span>
        <span className="rd-ad-leg"><i className="rd-ad-leg-line dash" />Expected</span>
      </div>
    </>
  );
};

/* ─── Lead funnel ────────────────────────────────────────────────────────────── */
const AD_FUNNEL_TONES = ["blue", "indigo", "orange", "amber", "green"];

/* The silhouette is a TEMPLATE, not a bar chart: every band tapers into the one
   below it by the same fixed step, so the picture is always a clean funnel and
   the figures on the right carry the data.

   It used to scale each band to its own value against the largest stage. That
   drew an hourglass whenever a middle stage sagged, and an upside-down funnel
   whenever a later stage outran an earlier one — "4 leads → 2 proposals →
   7 closed won" came out as a diamond widening towards the bottom. Both are
   fixed at the source now (the backend feeds cumulative "reached this stage or
   beyond" counts over one lead set), but the geometry no longer depends on that
   holding: bad data shows up as a flagged percentage in the legend, which is
   readable, instead of as a deformed shape, which is not. */
const AD_FN_TOP_W = 100;   // widest band, % of the shape box
const AD_FN_BOT_W = 30;    // the neck

const AdFunnel = ({ stages = [], total = 0 }) => {
  const rows = (stages || []).filter(Boolean);
  if (!rows.length) return <Empty icon="🧭" msg="No funnel data yet" />;

  const n    = rows.length;
  const val  = (s) => Math.max(Number(s?.value) || 0, 0);
  /* Conversion is measured against the top stage — the explicit `total` when the
     caller passes one, otherwise the first stage, which is the same thing. */
  const base = Math.max(Number(total) || val(rows[0]), 1);

  /* n bands need n+1 boundary widths, stepped evenly from the mouth to the neck. */
  const edgeW = (i) => AD_FN_TOP_W - (AD_FN_TOP_W - AD_FN_BOT_W) * (i / n);
  const sides = (w) => [(100 - w) / 2, (100 + w) / 2];

  return (
    <div className="rd-ad-funnel">
      <div className="rd-ad-funnel-shape">
        {rows.map((s, i) => {
          const [tl, tr] = sides(edgeW(i));
          const [bl, br] = sides(edgeW(i + 1));
          const pct = (val(s) / base) * 100;
          return (
            <div
              key={i}
              className={`rd-ad-fn-seg rd-ad-tone-${AD_FUNNEL_TONES[i % AD_FUNNEL_TONES.length]}`}
              style={{ clipPath: `polygon(${tl}% 0, ${tr}% 0, ${br}% 100%, ${bl}% 100%)` }}
              title={`${s.label}: ${fmtNum(val(s))}${i ? ` — ${pct.toFixed(1)}% of ${fmtNum(base)}` : ""}`}
            >
              <span className="rd-ad-fn-num">{fmtNum(val(s))}</span>
            </div>
          );
        })}
      </div>
      <ul className="rd-ad-funnel-legend">
        {rows.map((s, i) => {
          const pct  = (val(s) / base) * 100;
          const prev = i > 0 ? val(rows[i - 1]) : null;
          /* A stage larger than the one above it is a data problem, not a shape
             problem. Flag the row and leave the silhouette alone. */
          const odd  = prev !== null && val(s) > prev;
          return (
            <li key={i} className={`rd-ad-fn-row rd-ad-tone-${AD_FUNNEL_TONES[i % AD_FUNNEL_TONES.length]}`}>
              <span className="rd-ad-fn-dot" />
              <span className="rd-ad-fn-name">{s.label}</span>
              <span className="rd-ad-fn-val">{fmtNum(val(s))}</span>
              {i > 0 && (
                <span
                  className={`rd-ad-fn-pct${odd ? " warn" : ""}`}
                  title={odd ? `Higher than "${rows[i - 1].label}" above it` : undefined}
                >
                  ({pct.toFixed(1)}%)
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
/* ─── Business snapshot ──────────────────────────────────────────────────────── */
const AdSnapshot = ({ snap = {} }) => {
  const tiles = [
    { label: "Total Projects",   value: snap.totalProjects,     icon: Building2,    tone: "blue"   },
    { label: "Active Projects",  value: snap.activeProjects,    icon: Activity,     tone: "green"  },
    { label: "Completed",        value: snap.completedProjects, icon: CheckCircle2, tone: "green"  },
    { label: "Total Customers",  value: snap.totalCustomers,    icon: Users,        tone: "orange" },
    { label: "Active Customers", value: snap.activeCustomers,   icon: UserCheck,    tone: "indigo" },
    { label: "Total Vendors",    value: snap.totalVendors,      icon: Briefcase,    tone: "amber"  },
  ];
  return (
    <div className="rd-ad-snap">
      {tiles.map((t, i) => (
        <div key={i} className={`rd-ad-snap-tile rd-ad-tone-${t.tone}`}>
          <div className="rd-ad-snap-icon"><t.icon size={16} strokeWidth={2.2} /></div>
          <div className="rd-ad-snap-text">
            <div className="rd-ad-snap-value">{fmtNum(t.value)}</div>
            <div className="rd-ad-snap-label">{t.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Team performance ───────────────────────────────────────────────────────── */
const AdTeamTable = ({ members = [] }) => {
  if (!members.length) return <Empty icon="👥" msg="No team activity recorded yet" />;
  return (
    <div className="rd-ad-table-wrap rd-ad-scroll">
      <table className="rd-table rd-ad-table compact">
        <thead>
          <tr>
            <th>Member</th><th>Role</th>
            <th className="num">Leads</th><th className="num">Won</th>
            <th className="num">Revenue</th><th className="num">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {/* Every member renders; .rd-ad-scroll caps the card height and the
              sticky header keeps the columns readable while scrolling. */}
          {members.map((t, i) => {
            const rs = roleBadgeStyle(t.role);
            const rate = Number(t.conversionRate ?? 0);
            return (
              <tr key={t.userId ?? i}>
                <td>
                  <div className="rd-team-member-cell">
                    <div className="rd-avatar" style={{ background: rs.background, color: rs.color }}>
                      {(t.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="name-cell">{t.name || "—"}</span>
                  </div>
                </td>
                <td><span className="rd-badge rd-ad-role" style={rs}>{roleFmt(t.role)}</span></td>
                <td className="num">{fmtNum(t.leadsHandled)}</td>
                <td className="num rd-ad-won">{fmtNum(t.leadsWon)}</td>
                {/* Blank rather than a misleading ₹0 when a member has booked nothing. */}
                <td className="num rd-ad-rev">{t.revenue ? fmtMoney(t.revenue) : "—"}</td>
                <td className={`num rd-ad-rate ${rate > 0 ? "good" : ""}`}>{rate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Attention required ─────────────────────────────────────────────────────── */
const AdAttention = ({ overdue = 0, today = 0, upcoming = 0, followups = [], onViewAll }) => (
  <div className="rd-ad-att">
    <div className="rd-ad-att-counts">
      <div className="rd-ad-att-count overdue">
        <div className="rd-ad-att-num">{fmtNum(overdue)}</div>
        <div className="rd-ad-att-cap">Overdue</div>
      </div>
      <div className="rd-ad-att-count today">
        <div className="rd-ad-att-num">{fmtNum(today)}</div>
        <div className="rd-ad-att-cap">Today</div>
      </div>
      <div className="rd-ad-att-count upcoming">
        <div className="rd-ad-att-num">{fmtNum(upcoming)}</div>
        <div className="rd-ad-att-cap">Upcoming</div>
      </div>
    </div>
    {!followups.length ? (
      <Empty icon="✅" msg="All follow-ups are up to date!" />
    ) : (
      <div className="rd-ad-att-list">
        {followups.map((f, i) => {
          const dd = daysDiff(f.scheduledAt);
          const cls = dd < 0 ? "overdue" : dd === 0 ? "today" : "upcoming";
          return (
            <div key={f.id ?? i} className={`rd-ad-att-item ${cls}`}>
              <span className="rd-ad-att-dot" />
              <div className="rd-ad-att-main">
                <div className="rd-ad-att-name">{f.leadName || `Follow-up #${f.id}`}</div>
                <div className="rd-ad-att-meta">
                  {f.followupType || "Call"} - {fmtDate(f.scheduledAt)}
                  {f.assignedToName && ` - ${f.assignedToName}`}
                </div>
              </div>
              <div className="rd-ad-att-when">
                {dd < 0 ? `${Math.abs(dd)}d overdue` : dd === 0 ? "Today" : `In ${dd}d`}
              </div>
            </div>
          );
        })}
      </div>
    )}
    <button type="button" className="rd-ad-att-all" onClick={onViewAll}>
      View all follow-ups <ArrowRight size={13} strokeWidth={2.4} />
    </button>
  </div>
);

/* ─── Recent orders ──────────────────────────────────────────────────────────── */
const AdOrdersTable = ({ orders = [] }) => {
  if (!orders.length) return <Empty icon="📦" msg="No orders yet" />;
  return (
    <div className="rd-ad-table-wrap">
      <table className="rd-table rd-ad-table">
        <thead>
          <tr>
            <th>Order ID</th><th>Customer</th><th>Segment</th>
            <th className="num">Amount</th><th>Status</th><th className="num">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={o.id ?? i}>
              <td className="rd-ad-code">{o.orderBookNo || "—"}</td>
              <td className="name-cell">{o.customerName || "—"}</td>
              <td className="rd-ad-muted">
                {[o.groupName, o.subGroupName].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="num rd-ad-rev">{fmtMoney(o.totalAmount)}</td>
              <td>{statusBadge(o.status)}</td>
              <td className="num rd-ad-muted">{fmtDate(o.orderDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── The dashboard ──────────────────────────────────────────────────────────── */
/* The greeting banner (name, date, "Company Overview" chip) is rendered by the
   shared RoleDashboard wrapper below and is intentionally left untouched. */
const SuperAdminDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  /* The backend returns a fixed 8-month window; this only narrows what is drawn. */
  const [range, setRange] = useState("year");
  /* Orders-in-pipeline summary: the Pipeline Value card shows its estimated
     value and capacity. Separate endpoint, so it fails silently and the card
     falls back to the proposals-based figure — it must never take the
     dashboard down with it. */
  const [oil, setOil] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/dashboard/admin")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    ordersInLineApi.getSummary()
      .then(sum => { if (!cancelled) setOil(sum); })
      .catch(() => { /* optional enrichment — ignore */ });
    return () => { cancelled = true; };
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color: "#ef4444" }}>⚠ {err}</div>;

  const trend = (d.monthlyTrend ?? []).map(m => ({
    label:    m.label,
    revenue:  Number(m.revenue ?? 0),
    pipeline: Number(m.pipeline ?? 0),
  }));
  /* Labels are "MMM yy" — "This Year" keeps the ones whose year matches today's. */
  const yy      = String(new Date().getFullYear()).slice(2);
  const shown   = range === "year" ? trend.filter(m => String(m.label).endsWith(yy))
                : range === "6"    ? trend.slice(-6)
                :                    trend.slice(-3);
  const upcoming = Math.max(
    0,
    (d.pendingFollowups || 0) - (d.overdueFollowups || 0) - (d.todayFollowups || 0)
  );

  return (
    <div className="rd-ad">
      {/* ── KPI row ── */}
      {/* Five blocks, ordered the way the business reads them: what is booked,
          how many bookings that is, what is expected next and at what capacity,
          how many of those are still unconfirmed, and the leads feeding it all.

          "Total Revenue" is gone. It was d.totalRevenue — sumConfirmedRevenue()
          over the SAME order_book rows as Order Book beside it, so the two tiles
          printed the same figure (₹576.38 Cr vs ₹576.39 Cr, differing only by
          rounding) and it read as two separate achievements.

          The grid stays .rd-ad-kpis: it already carries the 5 → 3 → 2 → 1 column
          breakpoints. Only the tile inside it changed. */}
      <div className="rd-ad-kpis">
        <AdBlockKpi
          label="Order Book"
          value={fmtMoney(d.orderBookValue)}
          sub={`${fmtNum(d.totalOrders)} orders`}
          accent="#10b981" iconBg="#ecfdf5"
          icon={ShoppingBag} onClick={() => navigate("/order-book")}
        />
        <AdBlockKpi
          label="Confirmed Orders"
          value={fmtNum(d.totalOrders)}
          sub="Booked & confirmed"
          accent="#3b82f6" iconBg="#eff6ff"
          icon={ClipboardCheck} onClick={() => navigate("/order-book")}
        />
        {/* Billed, NOT booked. An order is booked once and then invoiced in
            stages, so this trails Order Book on purpose — the gap between the two
            is what is still to be raised. */}
        <AdBlockKpi
          label="Total Billed Value"
          value={fmtMoney(d.totalBilledValue ?? 0)}
          sub={`${fmtNum(d.totalInvoices ?? 0)} invoices`}
          accent="#0ea5e9" iconBg="#e0f2fe"
          icon={ReceiptIndianRupee} onClick={() => navigate("/sales/invoices")}
        />
        <AdBlockKpi
          label="Expected Order Value"
          value={fmtMoney(oil?.openEstimatedValue ?? d.pipelineValue ?? 0)}
          /* Capacity rides on this tile rather than getting one of its own —
             it is the same pipeline measured in MW instead of rupees. */
          sub={fmtCapacity(oil?.openCapacityKw) || "Capacity not estimated"}
          strongSub={!!fmtCapacity(oil?.openCapacityKw)}
          accent="#8b5cf6" iconBg="#f5f3ff"
          icon={BarChart3} onClick={() => navigate("/sales/orders-in-line")}
        />
        <AdBlockKpi
          label="Orders in Pipeline"
          value={fmtNum(oil?.openCount ?? 0)}
          sub="Unconfirmed prospects"
          accent="#f59e0b" iconBg="#fffbeb"
          icon={FileText} onClick={() => navigate("/sales/orders-in-line")}
        />
        <AdBlockKpi
          label="Active Leads"
          value={fmtNum(d.activeLeads)}
          sub={`${fmtNum(d.totalLeads)} total`}
          accent="#6366f1" iconBg="#eef2ff"
          icon={Users} onClick={() => navigate("/sales/leads")}
        />
      </div>

      {/* ── Main grid: Attention Required is the tall right column, spanning
             both the chart row and the team row. ── */}
      <div className="rd-ad-grid">
        <AdCard
          title="Order Book Overview"
          right={
            <select className="rd-ad-select" value={range}
                    onChange={(e) => setRange(e.target.value)} aria-label="Chart period">
              <option value="year">This Year</option>
              <option value="6">Last 6 Months</option>
              <option value="3">Last 3 Months</option>
            </select>
          }
          bodyClass="rd-ad-fill"
        >
          <AdOrderBookChart data={shown} />
        </AdCard>

        <AdCard
          title="Lead Funnel"
          right={<span className="rd-ad-chip">All Time</span>}
        >
          <AdFunnel
            total={d.totalLeads || 0}
            /* Cumulative stages, so each is a subset of the one above it and the
               funnel descends. Falls back to the current-status counts if the
               backend has not been updated. */
            stages={[
              { label: "Total Leads",   value: d.totalLeads         || 0 },
              { label: "Contacted",     value: d.reachedContacted   ?? d.contacted    ?? 0 },
              { label: "In Discussion", value: d.reachedDiscussion  ?? d.inDiscussion ?? 0 },
              { label: "Proposal Sent", value: d.reachedProposal    ?? d.proposalSent ?? 0 },
              { label: "Closed Won",    value: d.closedWon          || 0 },
            ]}
          />
        </AdCard>

        <div className="rd-ad-tall">
          <AdCard title="Attention Required" bodyClass="rd-ad-fill">
            <AdAttention
              overdue={d.overdueFollowups} today={d.todayFollowups} upcoming={upcoming}
              followups={d.followups ?? []} onViewAll={() => navigate("/follow-ups")}
            />
          </AdCard>
        </div>

        <AdCard
          title="Team Performance"
          right={
            <button type="button" className="rd-ad-link" onClick={() => navigate("/team-performance")}>
              View all
            </button>
          }
          bodyClass="rd-ad-flush"
        >
          <AdTeamTable members={d.teamPerformance ?? []} />
        </AdCard>

        <AdCard title="Business Snapshot">
          <AdSnapshot snap={d.businessSnapshot ?? {}} />
        </AdCard>
      </div>

      {/* ── Recent orders ── */}
      <div className="rd-ad-row">
        <AdCard
          title="Recent Orders"
          right={
            <button type="button" className="rd-ad-link" onClick={() => navigate("/order-book")}>
              View all orders
            </button>
          }
          bodyClass="rd-ad-flush"
        >
          <AdOrdersTable orders={d.recentOrders ?? []} />
        </AdCard>
      </div>
    </div>
  );
};
/* ═══════════════════════════════════════════════════════════════════════════════
   MANAGER DASHBOARD
   Handles: MANAGER, SALES_MANAGER, BD_MANAGER + any manager variant
═══════════════════════════════════════════════════════════════════════════════ */
const ManagerDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/dashboard/sales-manager")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
    // Fetch tasks
    try {
      const raw = localStorage.getItem(USER_KEY);
      const u = raw ? JSON.parse(raw)?.user : null;
      if (u?.id) {
        apiFetch(`/tasks?userId=${u.id}&status=Pending&size=8&page=1`)
          .then(res => { const items = res.data || res.tasks || []; setTasks(items.slice(0, 8)); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color: "#ef4444" }}>⚠ {err}</div>;

  /* Every figure below is the manager's reporting subtree — themselves plus
     everyone whose manager_id chains up to them. `teamSize` is the count of
     reports; 0 means this user has nobody under them, in which case the page is
     honestly just their own numbers and the copy says so. */
  const teamSize = Number(d.teamSize ?? 0);
  const hasTeam  = teamSize > 0;

  const kpis = [
    { label: hasTeam ? "Team Leads" : "My Leads",
      value: fmtNum(d.myLeads),          sub: hasTeam ? `Across ${teamSize + 1} people` : "Total in pipeline", icon: ClipboardList,  tone: "blue"   },
    { label: "Active",        value: fmtNum(d.activeLeads),      sub: "In progress",                             icon: RefreshCw,      tone: "indigo" },
    { label: "Closed Won",    value: fmtNum(d.closedWon),        sub: `${d.conversionRate}% conv.`,               icon: CheckCircle2,   tone: "green"  },
    { label: "Team Revenue",  value: fmtMoney(d.revenue),        sub: "From closed deals",                       icon: Wallet,         tone: "green"  },
    { label: "Proposals",     value: fmtNum(d.myProposals),      sub: `${fmtNum(d.acceptedProposals)} accepted`,  icon: FileText,       tone: "amber"  },
    { label: "In Discussion", value: fmtNum(d.inDiscussion),     sub: "Active deals",                            icon: MessagesSquare, tone: "indigo" },
    { label: "Pending FU",    value: fmtNum(d.pendingFollowups), sub: `${fmtNum(d.overdueFollowups)} overdue`,    icon: PhoneCall,      tone: "orange" },
    { label: "Today's FUs",   value: fmtNum(d.todayFollowups),   sub: "Due today",                               icon: CalendarClock,  tone: "amber"  },
  ];

  const upcomingFU = Math.max(0, (d.pendingFollowups || 0) - (d.overdueFollowups || 0) - (d.todayFollowups || 0));

  return (
    <div className="rd-ad">
      <div className="rd-ad-kpis-auto">
        {kpis.map((k, i) => <AdKpiCard key={i} {...k} />)}
      </div>

      {/* Row 1: monthly leads + funnel.
          MiniBarChart stays: d.monthlyLeads is {label, value} lead COUNTS, and
          AdOrderBookChart draws {label, revenue, pipeline} money. Only the shell
          around it becomes an AdCard. */}
      <div className="rd-ad-eqrow cols-2 h-sm">
        <AdCard title={hasTeam ? "Team Monthly Leads" : "Monthly Leads"} right={<span className="rd-ad-chip">Last 6 months</span>}
                bodyClass="rd-ad-fill rd-ad-chartfill">
          <MiniBarChart data={d.monthlyLeads || []} color="#8b5cf6" />
        </AdCard>
        <AdCard title={hasTeam ? "Team Lead Funnel" : "Lead Funnel"} right={<span className="rd-ad-chip">Stage breakdown</span>}>
          {/* Cumulative stages, so each is a subset of the one above it. The old
              current-status counts (d.contacted / d.inDiscussion) read ~0 on new
              data — the lead UI no longer sets either status — which collapsed
              the middle of the funnel. They are kept as the fallback for a
              backend that has not been updated. */}
          <AdFunnel
            total={d.myLeads || 0}
            stages={[
              { label: "Team Leads",    value: d.myLeads           || 0 },
              { label: "Contacted",     value: d.reachedContacted  ?? d.contacted    ?? 0 },
              { label: "In Discussion", value: d.reachedDiscussion ?? d.inDiscussion ?? 0 },
              { label: "Proposal Sent", value: d.reachedProposal   ?? d.myProposals  ?? 0 },
              { label: "Closed Won",    value: d.closedWon         || 0 },
            ]}
          />
        </AdCard>
      </div>

      {/* Row 2: team performance + follow-ups */}
      <div className="rd-ad-eqrow cols-2 h-lg">
        <AdCard
          title={hasTeam ? "Your Team's Performance" : "Performance"}
          right={
            <button type="button" className="rd-ad-link" onClick={() => navigate("/team-performance")}>
              View more
            </button>
          }
          bodyClass="rd-ad-flush rd-ad-fill"
        >
          {/* An empty table here used to be the norm — the team was resolved from
              users.created_by, which records who typed the account into the admin
              screen (user #1 for nearly every row), not who it reports to. */}
          <AdTeamTable members={d.teamMembers || []} />
        </AdCard>
        <AdCard title="Follow-up Reminders" bodyClass="rd-ad-fill">
          <AdAttention
            today={d.todayFollowups}
            overdue={d.overdueFollowups}
            upcoming={upcomingFU}
            followups={d.followups || []}
            onViewAll={() => navigate("/follow-ups")}
          />
        </AdCard>
      </div>

      {/* Row 3: recent leads + tasks */}
      <div className="rd-ad-eqrow cols-2 h-md">
        <AdCard title="Recent Team Leads" bodyClass="rd-ad-flush rd-ad-fill">
          <div className="rd-ad-pane rd-ad-table-wrap">
            <LeadsTable leads={d.leads || []} emptyMsg="No leads assigned yet" />
          </div>
        </AdCard>
        <AdCard title="My Pending Tasks" bodyClass="rd-ad-fill">
          <div className="rd-ad-pane">
            <TaskList tasks={tasks} />
          </div>
        </AdCard>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   BD EXECUTIVE DASHBOARD
═══════════════════════════════════════════════════════════════════════════════ */
const BDExecutiveDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/dashboard/bd")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
    try {
      const raw = localStorage.getItem(USER_KEY);
      const u = raw ? JSON.parse(raw)?.user : null;
      if (u?.id) {
        apiFetch(`/tasks?userId=${u.id}&status=Pending&size=8&page=1`)
          .then(res => { setTasks((res.data || res.tasks || []).slice(0, 8)); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color: "#ef4444" }}>⚠ {err}</div>;

  /* Same eight figures as before — only the card that draws them changed. */
  const kpis = [
    { label: "BD Leads",       value: fmtNum(d.totalLeads),       sub: "Assigned to me as BD",                    icon: ClipboardList,  tone: "blue"   },
    { label: "Active",         value: fmtNum(d.activeLeads),      sub: "In my pipeline",                          icon: RefreshCw,      tone: "indigo" },
    { label: "Closed Won",     value: fmtNum(d.closedWon),        sub: `${d.conversionRate}% conv.`,               icon: CheckCircle2,   tone: "green"  },
    { label: "In Discussion",  value: fmtNum(d.inDiscussion),     sub: "Active deals",                            icon: MessagesSquare, tone: "indigo" },
    { label: "Proposals Sent", value: fmtNum(d.proposalsSent),    sub: `${fmtNum(d.acceptedProposals)} accepted`,  icon: FileText,       tone: "amber"  },
    { label: "My Revenue",     value: fmtMoney(d.revenue),        sub: "From closed deals",                       icon: Wallet,         tone: "green"  },
    { label: "Pending FU",     value: fmtNum(d.pendingFollowups), sub: `${fmtNum(d.overdueFollowups)} overdue`,    icon: PhoneCall,      tone: "orange" },
    { label: "Today's FUs",    value: fmtNum(d.todayFollowups),   sub: "Due today",                               icon: CalendarClock,  tone: "amber"  },
  ];

  const upcomingFU = Math.max(0, (d.pendingFollowups || 0) - (d.overdueFollowups || 0) - (d.todayFollowups || 0));

  return (
    <div className="rd-ad">
      <div className="rd-ad-kpis-auto">
        {kpis.map((k, i) => <AdKpiCard key={i} {...k} />)}
      </div>

      {/* Row 1: my leads + funnel */}
      <div className="rd-ad-eqrow cols-2 h-md">
        <AdCard title="My Lead Conversions" right={<span className="rd-ad-chip">Leads where I am the BD</span>}
                bodyClass="rd-ad-flush rd-ad-fill">
          <div className="rd-ad-pane rd-ad-table-wrap">
            <LeadsTable leads={d.leads || []} emptyMsg="No BD leads assigned yet" />
          </div>
        </AdCard>
        <AdCard title="My Conversion Funnel" right={<span className="rd-ad-chip">All Time</span>}>
          {/* Cumulative stages over this BD's own leads. The proposal stage is
              deliberately the lead count that reached "Proposal Sent", not
              d.proposalsSent: that KPI counts proposal DOCUMENTS prepared by the
              user, several of which can hang off one lead — mixing the two units
              in one funnel is what put 23 proposals under 0 in-discussion. */}
          <AdFunnel
            total={d.totalLeads || 0}
            stages={[
              { label: "BD Leads",      value: d.totalLeads        || 0 },
              { label: "Contacted",     value: d.reachedContacted  ?? d.activeLeads  ?? 0 },
              { label: "In Discussion", value: d.reachedDiscussion ?? d.inDiscussion ?? 0 },
              { label: "Proposal Sent", value: d.reachedProposal   ?? d.proposalsSent ?? 0 },
              { label: "Closed Won",    value: d.reachedWon        ?? d.closedWon    ?? 0 },
            ]}
          />
        </AdCard>
      </div>

      {/* Row 2: follow-ups + proposals + tasks — three equal columns */}
      <div className="rd-ad-eqrow cols-3 h-lg">
        <AdCard title="Follow-up Reminders" bodyClass="rd-ad-fill">
          <AdAttention
            today={d.todayFollowups}
            overdue={d.overdueFollowups}
            upcoming={upcomingFU}
            followups={d.followups || []}
            onViewAll={() => navigate("/follow-ups")}
          />
        </AdCard>
        <AdCard title="My Proposals" bodyClass="rd-ad-flush rd-ad-fill">
          <div className="rd-ad-pane rd-ad-table-wrap">
            <ProposalsTable proposals={d.proposals || []} />
          </div>
        </AdCard>
        <AdCard title="My Pending Tasks" bodyClass="rd-ad-fill">
          <div className="rd-ad-pane">
            <TaskList tasks={tasks} />
          </div>
        </AdCard>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TELECALLER DASHBOARD
═══════════════════════════════════════════════════════════════════════════════ */
const TelecallerDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/dashboard/telecaller")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
    try {
      const raw = localStorage.getItem(USER_KEY);
      const u = raw ? JSON.parse(raw)?.user : null;
      if (u?.id) {
        apiFetch(`/tasks?userId=${u.id}&status=Pending&size=8&page=1`)
          .then(res => { setTasks((res.data || res.tasks || []).slice(0, 8)); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color: "#ef4444" }}>⚠ {err}</div>;

  const tcBadge = (status) => {
    if (!status) return <span className="rd-badge rd-badge-gray">Not Called</span>;
    const map = {
      "INTERESTED":     <span className="rd-badge rd-badge-green">Interested</span>,
      "NOT_INTERESTED": <span className="rd-badge rd-badge-red">Not Interested</span>,
      "NOT_RESPONDED":  <span className="rd-badge rd-badge-yellow">Not Responded</span>,
      "NEW":            <span className="rd-badge rd-badge-indigo">New</span>,
      "PENDING":        <span className="rd-badge rd-badge-indigo">Pending</span>,
    };
    return map[status.toUpperCase()] || <span className="rd-badge rd-badge-gray">{status}</span>;
  };

  const pct = d.total > 0 ? Math.round((d.interested / d.total) * 100) : 0;

  /* Same nine figures the StatPill strip showed — now on the shared KPI card. */
  const kpis = [
    { label: "Assigned",       value: fmtNum(d.total),            icon: ClipboardList,  tone: "blue"   },
    { label: "Called",         value: fmtNum(d.called),           icon: PhoneCall,      tone: "indigo" },
    { label: "Interested",     value: fmtNum(d.interested),       icon: CheckCircle2,   tone: "green"  },
    { label: "Not Interested", value: fmtNum(d.notInterested),    icon: XCircle,        tone: "orange" },
    { label: "No Response",    value: fmtNum(d.notResponded),     icon: Clock,          tone: "amber"  },
    { label: "Pending",        value: fmtNum(d.pending),          icon: RefreshCw,      tone: "indigo" },
    { label: "Handed to BD",   value: fmtNum(d.handedOff),        icon: MessagesSquare, tone: "cyan"   },
    { label: "Today's FUs",    value: fmtNum(d.todayFollowups),   icon: CalendarClock,  tone: "amber"  },
    { label: "Overdue FUs",    value: fmtNum(d.overdueFollowups), icon: AlertTriangle,  tone: "orange" },
  ];

  return (
    <div className="rd-ad">
      <div className="rd-ad-kpis-auto c5">
        {kpis.map((k, i) => <AdKpiCard key={i} {...k} />)}
      </div>

      {/* Interest rate — same pct, same three legend counts, new shell. */}
      {d.total > 0 && (
        <div className="rd-ad-ir">
          <div className="rd-ad-ir-left">
            <span className="rd-ad-ir-title">
              <TrendingUp size={15} strokeWidth={2.4} />Interest Rate
            </span>
            <div className="rd-ad-ir-track">
              <div className="rd-ad-ir-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
          <div className="rd-ad-ir-right">
            <span className="rd-ad-ir-pct">{pct}%</span>
            <span className="rd-ad-ir-cap">interest rate</span>
          </div>
          <div className="rd-ad-ir-legend">
            <span className="yes"><b>{fmtNum(d.interested)}</b> interested</span>
            <span className="no"><b>{fmtNum(d.notInterested)}</b> not interested</span>
            <span className="none"><b>{fmtNum(d.notResponded)}</b> no response</span>
          </div>
        </div>
      )}

      {/* Three equal-height cards side by side */}
      <div className="rd-ad-eqrow cols-3 h-lg">
        <AdCard title="My Lead Queue" right={<span className="rd-ad-chip">For calling</span>}
                bodyClass="rd-ad-flush rd-ad-fill">
          {!(d.leads?.length) ? <Empty icon="📞" msg="No leads in your queue" /> : (
            <div className="rd-ad-pane rd-ad-table-wrap">
              <table className="rd-table rd-ad-table compact auto" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Name</th><th>Phone</th><th>Status</th><th>BD</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {d.leads.map((l, i) => (
                    <tr key={i}>
                      <td className="name-cell">{l.name}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{l.phone || "—"}</td>
                      <td>{tcBadge(l.telecallerStatus)}</td>
                      <td>{l.handedOffToBD
                        ? <span className="rd-badge rd-badge-green" style={{ fontSize: 10 }}>{l.bdAssigneeName || "✓"}</span>
                        : <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdCard>

        <AdCard title="Follow-up Reminders" bodyClass="rd-ad-fill">
          <AdAttention
            today={d.todayFollowups}
            overdue={d.overdueFollowups}
            upcoming={0}
            followups={d.followups || []}
            onViewAll={() => navigate("/follow-ups")}
          />
        </AdCard>

        <AdCard title="My Tasks" bodyClass="rd-ad-fill">
          <div className="rd-ad-pane">
            <TaskList tasks={tasks} />
          </div>
        </AdCard>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   GENERIC DASHBOARD
   Shown for ALL other roles: Procurement, Accounts, HR, custom roles, etc.
   Never shows "empty" — always shows meaningful data
═══════════════════════════════════════════════════════════════════════════════ */
const GenericDashboard = ({ role }) => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/dashboard/generic")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
    try {
      const raw = localStorage.getItem(USER_KEY);
      const u = raw ? JSON.parse(raw)?.user : null;
      if (u?.id) {
        apiFetch(`/tasks?userId=${u.id}&status=Pending&size=8&page=1`)
          .then(res => { setTasks((res.data || res.tasks || []).slice(0, 8)); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color: "#ef4444" }}>⚠ {err}</div>;

  const hasLeads   = (d.myLeads || 0) > 0 || (d.activeLeads || 0) > 0;
  /* Whoever has people under them gets the team card — driven by the reporting
     line, not by the role's level. The old `d.levelOrder === 3` check hid the
     card from every manager-ish role sitting at another level (ACCOUNTS_MANAGER,
     PROCUREMENT_MANAGER) and from any role missing from role_hierarchy, whose
     levelOrder comes back as Integer.MAX_VALUE. teamSize is the backend's count
     of reports, resolved transitively down users.manager_id. */
  const teamSize   = Number(d.teamSize ?? 0);
  const hasTeam    = teamSize > 0;

  const pendingFU  = d.pendingFollowups || 0;
  const overdueFU  = d.overdueFollowups || 0;
  const todayFU    = d.todayFollowups   || 0;
  const upcomingFU = Math.max(0, pendingFU - overdueFU - todayFU);

  const pendingTasks  = tasks.filter(t => t.status === "Pending" || t.status === "In Progress").length;
  const overdueTasks  = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed").length;

  /* Base four, plus the same three that only appear when this role owns leads. */
  const kpis = [
    { label: "Pending Follow-ups", value: fmtNum(pendingFU),     sub: `${fmtNum(overdueFU)} overdue`,    icon: PhoneCall,     tone: "orange" },
    { label: "Today's FUs",        value: fmtNum(todayFU),       sub: "Due today",                       icon: CalendarClock, tone: "amber"  },
    { label: "My Tasks",           value: fmtNum(tasks.length),  sub: `${fmtNum(pendingTasks)} pending`, icon: ClipboardList, tone: "blue"   },
    { label: "Overdue Tasks",      value: fmtNum(overdueTasks),  sub: "Need attention",                  icon: AlertTriangle, tone: "orange" },
    ...(hasLeads ? [
      { label: hasTeam ? "Team Leads" : "My Leads",
        value: fmtNum(d.myLeads),     sub: `${fmtNum(d.closedWon)} won`,      icon: Target,        tone: "green"  },
      { label: "Active Leads",     value: fmtNum(d.activeLeads), sub: "In pipeline",                     icon: RefreshCw,     tone: "indigo" },
      { label: hasTeam ? "Team Proposals" : "My Proposals",
        value: fmtNum(d.myProposals), sub: "All proposals",                   icon: FileText,      tone: "amber"  },
    ] : []),
  ];

  return (
    <div className="rd-ad">
      <div className="rd-ad-kpis-auto">
        {kpis.map((k, i) => <AdKpiCard key={i} {...k} />)}
      </div>

      {/* Row 1: recent leads + funnel.
          The funnel sits directly under the KPI row on EVERY dashboard that has
          one — admin, manager and BD all put it there. This view used to bury it
          below follow-ups and tasks, so a PROCUREMENT_MANAGER had to scroll past
          two full-height rows to reach the same chart their manager sees first. */}
      {hasLeads && (
        <div className="rd-ad-eqrow cols-2 h-md">
          <AdCard title={hasTeam ? "Recent Team Leads" : "My Recent Leads"} bodyClass="rd-ad-flush rd-ad-fill">
            <div className="rd-ad-pane rd-ad-table-wrap">
              <LeadsTable leads={d.leads || []} />
            </div>
          </AdCard>
          <AdCard
            title={hasTeam ? "Team Lead Funnel" : "My Lead Funnel"}
            right={<span className="rd-ad-chip">All Time</span>}
            bodyClass="rd-ad-fill"
          >
            <div className="rd-ad-pane rd-ad-perf">
              {/* Cumulative stages over one lead set — see AdFunnel. "Active"
                  is not a funnel stage at all (it is everything NOT closed, so
                  it grows as Closed Won shrinks); it is replaced by the leads
                  that got past New. */}
              <AdFunnel
                total={d.myLeads || 0}
                stages={[
                  { label: hasTeam ? "Team Leads" : "My Leads",
                                            value: d.myLeads           || 0 },
                  { label: "Contacted",     value: d.reachedContacted  ?? (d.activeLeads || 0) },
                  { label: "In Discussion", value: d.reachedDiscussion ?? 0 },
                  { label: "Proposal Sent", value: d.reachedProposal   ?? (d.myProposals || 0) },
                  { label: "Closed Won",    value: d.closedWon         || 0 },
                ]}
              />
              <div className="rd-ad-stats">
                <div className="rd-ad-stat good">
                  <div className="rd-ad-stat-val">
                    {d.myLeads > 0 ? Math.round(((d.closedWon || 0) / d.myLeads) * 100) : 0}%
                  </div>
                  <div className="rd-ad-stat-cap">Conversion Rate</div>
                </div>
                <div className="rd-ad-stat info">
                  <div className="rd-ad-stat-val">{fmtNum(d.myProposals)}</div>
                  <div className="rd-ad-stat-cap">Proposals Made</div>
                </div>
              </div>
            </div>
          </AdCard>
        </div>
      )}

      {/* Anyone with reports: show team performance */}
      {hasTeam && (d.teamMembers || []).length > 0 && (
        <div className="rd-ad-eqrow cols-1 h-lg">
          <AdCard
            title="Your Team's Performance"
            right={<span className="rd-ad-chip">
              {teamSize === 1 ? "1 person reports to you" : `${teamSize} people report to you`}
            </span>}
            bodyClass="rd-ad-flush rd-ad-fill"
          >
            <AdTeamTable members={d.teamMembers} />
          </AdCard>
        </div>
      )}

      {/* Row: Follow-ups + Tasks */}
      <div className="rd-ad-eqrow cols-2 h-lg">
        <AdCard title="Follow-up Reminders" bodyClass="rd-ad-fill">
          <AdAttention
            today={todayFU}
            overdue={overdueFU}
            upcoming={upcomingFU}
            followups={d.followups || []}
            onViewAll={() => navigate("/follow-ups")}
          />
        </AdCard>
        <AdCard title="My Pending Tasks" right={<span className="rd-ad-chip">Assigned to you</span>}
                bodyClass="rd-ad-fill">
          <div className="rd-ad-pane">
            <TaskList tasks={tasks} />
          </div>
        </AdCard>
      </div>

      {/* Empty state for roles with no relevant data at all */}
      {!hasLeads && !tasks.length && !pendingFU && (
        <div className="rd-ad-row">
          <AdCard title="Getting Started">
            <div className="rd-ad-welcome">
              <div className="rd-ad-welcome-icon"><Sparkles size={22} strokeWidth={2.1} /></div>
              <div className="rd-ad-welcome-title">Welcome to your dashboard!</div>
              <div className="rd-ad-welcome-sub">Your activity will show up here as you start working in the system.</div>
            </div>
          </AdCard>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOT — picks layout by role
═══════════════════════════════════════════════════════════════════════════════ */
export default function RoleDashboard() {
  const { user, loading: authLoading } = useContext(AuthContext);

  if (authLoading) return <div className="rd-container"><Spinner /></div>;
  if (!user) return (
    <div className="rd-container">
      <div className="rd-empty"><div className="rd-empty-icon">🔒</div>Please log in to view your dashboard.</div>
    </div>
  );

  const role       = user.role || "";
  const normalized = normalizeRole(role);
  const rs         = roleBadgeStyle(role);
  const h          = new Date().getHours();
  const greeting   = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const name       = user.fullName || user.name || user.username || "there";

  const titleMap = {
    admin:      "Company Overview",
    manager:    "Team Dashboard",
    bd:         "BD Dashboard",
    telecaller: "Calling Dashboard",
    generic:    "My Dashboard",
  };

  const subtitleMap = {
    admin:      "Full company overview — everything at a glance",
    manager:    "Your team is counting on you — lead them to success!",
    bd:         "Your leads, your targets — let's close them today! 💪",
    telecaller: "Every call is a chance — dial with purpose! 📞",
    generic:    getDailyQuote(),
  };

  const renderView = () => {
    if (normalized === "admin")      return <SuperAdminDashboard />;
    if (normalized === "manager")    return <ManagerDashboard />;
    if (normalized === "bd")         return <BDExecutiveDashboard />;
    if (normalized === "telecaller") return <TelecallerDashboard />;
    return <GenericDashboard role={role} />;
  };

  return (
    <div className="rd-container">
      {/* ── Header greeting ── */}
      <div className="rd-greeting-banner">
        <div className="rd-greeting-left">
          <div className="rd-greeting-time">{greeting},</div>
          <div className="rd-greeting-name">{name} 👋</div>
          <div className="rd-greeting-sub">
            <span className="rd-role-badge" style={{ ...rs, marginRight: 8 }}>{roleFmt(role)}</span>
            {subtitleMap[normalized]}
          </div>
        </div>
        <div className="rd-greeting-quote">
          <span className="rd-quote-mark">"</span>
          {getDailyQuote()}
        </div>
        <div className="rd-greeting-meta">
          <div className="rd-greeting-date">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="rd-greeting-title">{titleMap[normalized]}</div>
        </div>
      </div>

      {renderView()}
    </div>
  );
}