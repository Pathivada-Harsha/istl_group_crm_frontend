// RoleDashboard.js — Role-based CRM Dashboard
// Fixed: role matching, fixed-height cards, generic dashboard for all roles

import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "../pages-css/Dashboard.css";

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

const KpiCard = ({ label, value, sub, accent = "#3b82f6", iconBg = "#eff6ff", icon }) => (
  <div className="rd-kpi-card" style={{ "--kpi-accent": accent, "--kpi-icon-bg": iconBg }}>
    <div className="rd-kpi-icon">{icon}</div>
    <div className="rd-kpi-label">{label}</div>
    <div className="rd-kpi-value">{value ?? "—"}</div>
    {sub && <div className="rd-kpi-sub">{sub}</div>}
  </div>
);

/* Card with FIXED HEIGHT and internal scroll */
const Card = ({ title, sub, right, children, height = 340, noBodyPad = false }) => (
  <div className="rd-card" style={{ height, display: "flex", flexDirection: "column" }}>
    {title && (
      <div className="rd-card-head" style={{ flexShrink: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="rd-card-title"
            style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {title}
          </div>
          {sub && (
            <div
              className="rd-card-sub"
              style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, fontWeight: 400 }}
            >
              {sub}
            </div>
          )}
        </div>
        {right}
      </div>
    )}
    <div
      className="rd-card-body rd-card-scroll"
      style={{ padding: noBodyPad ? 0 : "14px 18px", flex: 1, minHeight: 0 }}
    >
      {children}
    </div>
  </div>
);

/* Tall card for tables that need more space */
const TallCard = ({ title, sub, right, children }) => (
  <Card title={title} sub={sub} right={right} height={440} noBodyPad>
    {children}
  </Card>
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

const Funnel = ({ stages = [] }) => {
  const max = Math.max(stages[0]?.value || 1, 1);
  const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];
  return (
    <div className="rd-funnel">
      {stages.map((s, i) => (
        <div key={i} className="rd-funnel-row">
          <div className="rd-funnel-labels">
            <span className="rd-funnel-stage">{s.label}</span>
            <span className="rd-funnel-val">{fmtNum(s.value)}</span>
          </div>
          <div className="rd-funnel-bar-bg">
            <div className="rd-funnel-bar-fill"
              style={{ width: `${Math.max((s.value / max) * 100, 2)}%`, background: colors[i % colors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Follow-up block (scrollable inside fixed card) ────────────────────────── */
const FollowupBlock = ({ todayCount = 0, overdueCount = 0, upcomingCount = 0, followups = [] }) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
    <div className="rd-followup-stats" style={{ flexShrink: 0 }}>
      <div className="rd-fu-stat">
        <div className="rd-fu-stat-value rd-fu-today">{todayCount}</div>
        <div className="rd-fu-stat-label">Today</div>
      </div>
      <div className="rd-fu-stat">
        <div className="rd-fu-stat-value rd-fu-overdue">{overdueCount}</div>
        <div className="rd-fu-stat-label">Overdue</div>
      </div>
      <div className="rd-fu-stat">
        <div className="rd-fu-stat-value rd-fu-upcoming">{upcomingCount}</div>
        <div className="rd-fu-stat-label">Upcoming</div>
      </div>
    </div>
    {followups.length === 0
      ? <Empty icon="✅" msg="All follow-ups are up to date!" />
      : (
        <div className="rd-followup-list" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {followups.map((f, i) => {
            const dd = daysDiff(f.scheduledAt);
            const cls = dd < 0 ? "overdue" : dd === 0 ? "today" : "upcoming";
            const dotColor = dd < 0 ? "#ef4444" : dd === 0 ? "#3b82f6" : "#f59e0b";
            return (
              <div key={f.id || i} className={`rd-fu-item ${cls}`}>
                <div className="rd-fu-dot" style={{ background: dotColor }} />
                <div className="rd-fu-content">
                  <div className="rd-fu-lead-name">{f.leadName || `Follow-up #${f.id}`}</div>
                  <div className="rd-fu-meta">
                    {f.followupType || "Call"} · {fmtDate(f.scheduledAt)}
                    {f.assignedToName && ` · ${f.assignedToName}`}
                  </div>
                </div>
                <div className="rd-fu-days" style={{ color: dotColor }}>
                  {dd < 0 ? `${Math.abs(dd)}d overdue` : dd === 0 ? "Today" : `In ${dd}d`}
                </div>
              </div>
            );
          })}
        </div>
      )
    }
  </div>
);

/* ─── Team table ─────────────────────────────────────────────────────────────── */
const TeamTable = ({ members = [] }) => {
  if (!members.length) return <Empty icon="👥" msg="No team members found. Ask admin to assign team members to you." />;
  return (
    <div className="rd-table-wrap">
    <table className="rd-table" style={{ width: "100%", minWidth: 700 }}>
      <thead>
        <tr>
          <th>Member</th><th>Role</th><th>Leads</th><th>Won</th>
          <th>Revenue</th><th>Proposals</th><th>FU Done</th><th>FU Pending</th><th>Rate</th>
        </tr>
      </thead>
      <tbody>
        {members.map((t, i) => {
          const rs = roleBadgeStyle(t.role);
          return (
            <tr key={i}>
              <td>
                <div className="rd-team-member-cell">
                  <div className="rd-avatar" style={{ background: rs.background, color: rs.color }}>
                    {(t.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="name-cell">{t.name}</span>
                </div>
              </td>
              <td><span className="rd-badge" style={rs}>{roleFmt(t.role)}</span></td>
              <td>{fmtNum(t.leadsHandled)}</td>
              <td style={{ color: "#059669", fontWeight: 700 }}>{fmtNum(t.leadsWon)}</td>
              <td style={{ color: "#059669" }}>{t.revenue ? fmtMoney(t.revenue) : "—"}</td>
              <td>{fmtNum(t.proposalsSent)}</td>
              <td>{fmtNum(t.followupsDone)}</td>
              <td style={{ color: t.followupsPending > 0 ? "#f59e0b" : "#10b981" }}>{fmtNum(t.followupsPending)}</td>
              <td><span style={{ fontWeight: 700, color: t.conversionRate > 20 ? "#059669" : "#374151" }}>{t.conversionRate ?? 0}%</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
};

/* ─── Leads table ─────────────────────────────────────────────────────────────── */
const LeadsTable = ({ leads = [], emptyMsg = "No leads found" }) => {
  if (!leads.length) return <Empty icon="📂" msg={emptyMsg} />;
  return (
    <table className="rd-table" style={{ width: "100%" }}>
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
    <table className="rd-table" style={{ width: "100%" }}>
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
═══════════════════════════════════════════════════════════════════════════════ */
const SuperAdminDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    apiFetch("/dashboard/admin")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color: "#ef4444" }}>⚠ {err}</div>;

  const kpis = [
    { label: "Total Leads",      value: fmtNum(d.totalLeads),      sub: `+${fmtNum(d.leadsThisMonth)} this month`, accent: "#3b82f6", iconBg: "#eff6ff", icon: "🎯" },
    { label: "Leads This Month", value: fmtNum(d.leadsThisMonth),  sub: "Current month",       accent: "#8b5cf6", iconBg: "#f5f3ff", icon: "📅" },
    { label: "Closed Won",       value: fmtNum(d.closedWon),       sub: "Converted leads",     accent: "#10b981", iconBg: "#ecfdf5", icon: "✅" },
    { label: "Proposals",        value: fmtNum(d.totalProposals),  sub: `${fmtNum(d.proposalSent)} sent`, accent: "#f59e0b", iconBg: "#fffbeb", icon: "📋" },
    { label: "Order Book",       value: fmtMoney(d.orderBookValue),sub: `${fmtNum(d.totalOrders)} orders`, accent: "#06b6d4", iconBg: "#ecfeff", icon: "💰" },
    { label: "Follow-ups",       value: fmtNum(d.pendingFollowups),sub: `${fmtNum(d.overdueFollowups)} overdue`, accent: "#ef4444", iconBg: "#fef2f2", icon: "🔔" },
    { label: "Contacted",        value: fmtNum(d.contacted),       sub: "Leads reached",       accent: "#6366f1", iconBg: "#eef2ff", icon: "💬" },
    { label: "In Discussion",    value: fmtNum(d.inDiscussion),    sub: "Active conversations",accent: "#ec4899", iconBg: "#fdf2f8", icon: "🤝" },
  ];

  return (
    <div>
      <div className="rd-kpi-grid rd-kpi-grid-8">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Row 1: Chart + Pipeline side by side */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        <Card title="📈 Monthly Leads" sub="New leads per month" height={260}>
          <MiniBarChart data={d.monthlyLeads || []} color="#3b82f6" />
        </Card>
        <Card title="🔀 Lead Pipeline" sub="Stage breakdown" height={260}>
          <Funnel stages={[
            { label: "Total",         value: d.totalLeads   || 0 },
            { label: "Contacted",     value: d.contacted    || 0 },
            { label: "In Discussion", value: d.inDiscussion || 0 },
            { label: "Proposal Sent", value: d.proposalSent || 0 },
            { label: "Closed Won",    value: d.closedWon    || 0 },
          ]} />
        </Card>
      </div>

      {/* Row 2: Team Performance + Follow-up Reminders side by side */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        {(d.teamPerformance || []).length > 0 ? (
          <TallCard title="🏆 Team Performance" sub="All team members' activity">
            <TeamTable members={d.teamPerformance} />
          </TallCard>
        ) : <div />}
        <Card title="⏰ Follow-up Reminders" sub="Pending actions" height={440}>
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={Math.max(0, (d.pendingFollowups || 0) - (d.overdueFollowups || 0) - (d.todayFollowups || 0))}
            followups={d.followups || []}
          />
        </Card>
      </div>

      {/* Recent Orders — fixed height, internal scroll */}
      <div style={{ marginBottom: 14 }}>
        <Card title="📦 Recent Orders" sub="Latest order book entries" height={360} noBodyPad>
          {!(d.recentOrders?.length) ? <Empty /> : (
            <table className="rd-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>Order No</th><th>Customer</th><th>Segment</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {d.recentOrders.map((o, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: "#1d4ed8", fontFamily: "monospace" }}>{o.orderBookNo}</td>
                    <td className="name-cell">{o.customerName || "—"}</td>
                    <td style={{ color: "#64748b" }}>{[o.groupName, o.subGroupName].filter(Boolean).join(" / ") || "—"}</td>
                    <td style={{ color: "#059669", fontWeight: 700 }}>{fmtMoney(o.totalAmount)}</td>
                    <td>{statusBadge(o.status)}</td>
                    <td>{fmtDate(o.orderDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
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

  const kpis = [
    { label: "Team Leads",      value: fmtNum(d.myLeads),          sub: "Total in pipeline",           accent: "#3b82f6", iconBg: "#eff6ff", icon: "📋" },
    { label: "Active",          value: fmtNum(d.activeLeads),      sub: "In progress",                 accent: "#8b5cf6", iconBg: "#f5f3ff", icon: "🔄" },
    { label: "Closed Won",      value: fmtNum(d.closedWon),        sub: `${d.conversionRate}% conv.`,  accent: "#10b981", iconBg: "#ecfdf5", icon: "✅" },
    { label: "Team Revenue",    value: fmtMoney(d.revenue),        sub: "From closed deals",           accent: "#059669", iconBg: "#ecfdf5", icon: "💰" },
    { label: "Proposals",       value: fmtNum(d.myProposals),      sub: `${fmtNum(d.acceptedProposals)} accepted`, accent: "#f59e0b", iconBg: "#fffbeb", icon: "📝" },
    { label: "In Discussion",   value: fmtNum(d.inDiscussion),     sub: "Active deals",                accent: "#6366f1", iconBg: "#eef2ff", icon: "🤝" },
    { label: "Pending FU",      value: fmtNum(d.pendingFollowups), sub: `${fmtNum(d.overdueFollowups)} overdue`, accent: "#ef4444", iconBg: "#fef2f2", icon: "📞" },
    { label: "Today's FUs",     value: fmtNum(d.todayFollowups),   sub: "Due today",                   accent: "#ec4899", iconBg: "#fdf2f8", icon: "📅" },
  ];

  return (
    <div>
      <div className="rd-kpi-grid rd-kpi-grid-8">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Row 1: Monthly chart + Pipeline side by side */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        <Card title="📈 Team Monthly Leads" sub="Last 6 months" height={260}>
          <MiniBarChart data={d.monthlyLeads || []} color="#8b5cf6" />
        </Card>
        <Card title="🔀 Team Lead Funnel" sub="Stage breakdown" height={260}>
          <Funnel stages={[
            { label: "Total",         value: d.myLeads       || 0 },
            { label: "Contacted",     value: d.contacted     || 0 },
            { label: "In Discussion", value: d.inDiscussion  || 0 },
            { label: "Proposals",     value: d.myProposals   || 0 },
            { label: "Closed Won",    value: d.closedWon     || 0 },
          ]} />
        </Card>
      </div>

      {/* Row 2: Team Performance + Follow-up Reminders */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        <TallCard title="🏆 Your Team's Performance" sub="All team members under you">
          <TeamTable members={d.teamMembers || []} />
        </TallCard>
        <Card title="⏰ Follow-up Reminders" sub="Pending actions" height={440}>
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={Math.max(0, (d.pendingFollowups || 0) - (d.overdueFollowups || 0) - (d.todayFollowups || 0))}
            followups={d.followups || []}
          />
        </Card>
      </div>

      {/* Row 3: Recent leads + Tasks */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        <Card title="📋 Recent Team Leads" sub="Latest leads in your team" height={360} noBodyPad>
          <LeadsTable leads={d.leads || []} emptyMsg="No leads assigned yet" />
        </Card>
        <Card title="✅ My Pending Tasks" height={360}>
          <TaskList tasks={tasks} />
        </Card>
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

  const kpis = [
    { label: "BD Leads",        value: fmtNum(d.totalLeads),    sub: "Assigned to me as BD",           accent: "#3b82f6", iconBg: "#eff6ff", icon: "📂" },
    { label: "Active",          value: fmtNum(d.activeLeads),   sub: "In my pipeline",                 accent: "#8b5cf6", iconBg: "#f5f3ff", icon: "🔄" },
    { label: "Closed Won",      value: fmtNum(d.closedWon),     sub: `${d.conversionRate}% conv.`,     accent: "#10b981", iconBg: "#ecfdf5", icon: "✅" },
    { label: "In Discussion",   value: fmtNum(d.inDiscussion),  sub: "Active deals",                   accent: "#6366f1", iconBg: "#eef2ff", icon: "🤝" },
    { label: "Proposals Sent",  value: fmtNum(d.proposalsSent), sub: `${fmtNum(d.acceptedProposals)} accepted`, accent: "#f59e0b", iconBg: "#fffbeb", icon: "📋" },
    { label: "My Revenue",      value: fmtMoney(d.revenue),     sub: "From closed deals",              accent: "#059669", iconBg: "#ecfdf5", icon: "💰" },
    { label: "Pending FU",      value: fmtNum(d.pendingFollowups), sub: `${fmtNum(d.overdueFollowups)} overdue`, accent: "#ef4444", iconBg: "#fef2f2", icon: "📞" },
    { label: "Today's FUs",     value: fmtNum(d.todayFollowups),sub: "Due today",                      accent: "#ec4899", iconBg: "#fdf2f8", icon: "📅" },
  ];

  return (
    <div>
      <div className="rd-kpi-grid rd-kpi-grid-8">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Row 1: Leads + Funnel */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        <Card title="📋 My Lead Conversions" sub="Leads where I am the BD" height={340} noBodyPad>
          <LeadsTable leads={d.leads || []} emptyMsg="No BD leads assigned yet" />
        </Card>
        <Card title="🔀 My Conversion Funnel" height={340}>
          <Funnel stages={[
            { label: "BD Leads",      value: d.totalLeads        || 0 },
            { label: "In Discussion", value: d.inDiscussion      || 0 },
            { label: "Proposals",     value: d.proposalsSent     || 0 },
            { label: "Accepted",      value: d.acceptedProposals || 0 },
            { label: "Closed Won",    value: d.closedWon         || 0 },
          ]} />
        </Card>
      </div>

      {/* Row 2: Follow-up Reminders + Proposals + Tasks — all equal height */}
      <div className="rd-row rd-row-3" style={{ marginBottom: 14 }}>
        <Card title="⏰ Follow-up Reminders" sub="Your pending actions" height={420}>
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={Math.max(0, (d.pendingFollowups || 0) - (d.overdueFollowups || 0) - (d.todayFollowups || 0))}
            followups={d.followups || []}
          />
        </Card>
        <Card title="📝 My Proposals" height={420} noBodyPad>
          <ProposalsTable proposals={d.proposals || []} />
        </Card>
        <Card title="✅ My Pending Tasks" height={420}>
          <TaskList tasks={tasks} />
        </Card>
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

  /* Compact stat pill — replaces full KpiCard for telecaller */
  const StatPill = ({ icon, label, value, accent, bg }) => (
    <div style={{
      background: "#fff", borderRadius: 8, padding: "10px 14px",
      border: `1px solid #f1f5f9`, borderTop: `3px solid ${accent}`,
      display: "flex", alignItems: "center", gap: 10, minWidth: 0,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
  );

  const CARD_HEIGHT = 440; // single consistent height for all 3 bottom cards

  return (
    <div>

      {/* ── Compact KPI strip (horizontal pills, not tall cards) ── */}
      <div className="rd-tc-kpi-strip">
        <StatPill icon="📋" label="Assigned"       value={fmtNum(d.total)}          accent="#3b82f6" bg="#eff6ff" />
        <StatPill icon="📞" label="Called"          value={fmtNum(d.called)}         accent="#8b5cf6" bg="#f5f3ff" />
        <StatPill icon="🟢" label="Interested"      value={fmtNum(d.interested)}     accent="#10b981" bg="#ecfdf5" />
        <StatPill icon="🔴" label="Not Interested"  value={fmtNum(d.notInterested)}  accent="#ef4444" bg="#fef2f2" />
        <StatPill icon="⏳" label="No Response"     value={fmtNum(d.notResponded)}   accent="#f59e0b" bg="#fffbeb" />
        <StatPill icon="🆕" label="Pending"         value={fmtNum(d.pending)}        accent="#6366f1" bg="#eef2ff" />
        <StatPill icon="🤝" label="Handed to BD"    value={fmtNum(d.handedOff)}      accent="#06b6d4" bg="#ecfeff" />
        <StatPill icon="📅" label="Today's FUs"     value={fmtNum(d.todayFollowups)} accent="#ec4899" bg="#fdf2f8" />
        <StatPill icon="⚠️" label="Overdue FUs"     value={fmtNum(d.overdueFollowups)} accent="#dc2626" bg="#fef2f2" />
      </div>

      {/* ── Interest rate bar (compact, inline) ── */}
      {d.total > 0 && (
        <div className="rd-tc-interest-bar">
          <div className="rd-tc-interest-left">
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>📊 Interest Rate</span>
            <div className="rd-tc-progress-track">
              <div className="rd-tc-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
          <div className="rd-tc-interest-right">
            <span style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{pct}%</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>interest rate</span>
          </div>
          <div className="rd-tc-interest-legend">
            <span style={{ color: "#059669" }}>● {fmtNum(d.interested)} interested</span>
            <span style={{ color: "#ef4444" }}>● {fmtNum(d.notInterested)} not interested</span>
            <span style={{ color: "#f59e0b" }}>● {fmtNum(d.notResponded)} no response</span>
          </div>
        </div>
      )}

      {/* ── Three equal-height cards side by side ── */}
      <div className="rd-row rd-row-3">

        {/* Lead Queue */}
        <Card title="📋 My Lead Queue" sub="Leads assigned for calling" height={CARD_HEIGHT} noBodyPad>
          {!(d.leads?.length) ? <Empty icon="📞" msg="No leads in your queue" /> : (
            <table className="rd-table" style={{ width: "100%" }}>
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
          )}
        </Card>

        {/* Follow-up Reminders */}
        <Card title="⏰ Follow-up Reminders" sub="Pending actions" height={CARD_HEIGHT}>
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={0}
            followups={d.followups || []}
          />
        </Card>

        {/* Tasks */}
        <Card title="✅ My Tasks" sub="Pending tasks" height={CARD_HEIGHT}>
          <TaskList tasks={tasks} />
        </Card>

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
  const isL3       = d.levelOrder === 3;

  const pendingFU  = d.pendingFollowups || 0;
  const overdueFU  = d.overdueFollowups || 0;
  const todayFU    = d.todayFollowups   || 0;
  const upcomingFU = Math.max(0, pendingFU - overdueFU - todayFU);

  const pendingTasks  = tasks.filter(t => t.status === "Pending" || t.status === "In Progress").length;
  const overdueTasks  = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed").length;

  const kpis = [
    { label: "Pending Follow-ups", value: fmtNum(pendingFU),  sub: `${fmtNum(overdueFU)} overdue`, accent: "#ef4444", iconBg: "#fef2f2", icon: "📞" },
    { label: "Today's FUs",        value: fmtNum(todayFU),    sub: "Due today",                    accent: "#f59e0b", iconBg: "#fffbeb", icon: "📅" },
    { label: "My Tasks",           value: fmtNum(tasks.length),sub: `${fmtNum(pendingTasks)} pending`, accent: "#3b82f6", iconBg: "#eff6ff", icon: "📋" },
    { label: "Overdue Tasks",      value: fmtNum(overdueTasks),sub: "Need attention",              accent: "#dc2626", iconBg: "#fef2f2", icon: "⚠️" },
    ...(hasLeads ? [
      { label: "My Leads",         value: fmtNum(d.myLeads),   sub: `${fmtNum(d.closedWon)} won`, accent: "#059669", iconBg: "#ecfdf5", icon: "🎯" },
      { label: "Active Leads",     value: fmtNum(d.activeLeads),sub: "In pipeline",               accent: "#8b5cf6", iconBg: "#f5f3ff", icon: "🔄" },
      { label: "My Proposals",     value: fmtNum(d.myProposals),sub: "All proposals",             accent: "#6366f1", iconBg: "#eef2ff", icon: "📝" },
    ] : []),
  ];

  return (
    <div>
      <div className="rd-kpi-grid rd-kpi-grid-8">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* L3 managers: show team performance */}
      {isL3 && (d.teamMembers || []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <TallCard title="🏆 Your Team's Performance" sub="Performance of team members under you">
            <TeamTable members={d.teamMembers} />
          </TallCard>
        </div>
      )}

      {/* Row: Follow-ups + Tasks */}
      <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
        <Card title="⏰ Follow-up Reminders" sub="Your pending follow-up actions" height={420}>
          <FollowupBlock
            todayCount={todayFU}
            overdueCount={overdueFU}
            upcomingCount={upcomingFU}
            followups={d.followups || []}
          />
        </Card>
        <Card title="✅ My Pending Tasks" sub="Tasks assigned to you" height={420}>
          <TaskList tasks={tasks} />
        </Card>
      </div>

      {/* Leads section if applicable */}
      {hasLeads && (
        <div className="rd-row rd-row-2" style={{ marginBottom: 14 }}>
          <Card title="📋 My Recent Leads" height={340} noBodyPad>
            <LeadsTable leads={d.leads || []} />
          </Card>
          <Card title="📊 My Performance" height={340}>
            <Funnel stages={[
              { label: "My Leads",   value: d.myLeads     || 0 },
              { label: "Active",     value: d.activeLeads || 0 },
              { label: "Proposals",  value: d.myProposals || 0 },
              { label: "Closed Won", value: d.closedWon   || 0 },
            ]} />
            <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
              <div style={{ flex: 1, textAlign: "center", padding: 12, background: "#f8fafc", borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>
                  {d.myLeads > 0 ? Math.round(((d.closedWon || 0) / d.myLeads) * 100) : 0}%
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Conversion Rate</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: 12, background: "#f8fafc", borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#3b82f6" }}>{fmtNum(d.myProposals)}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Proposals Made</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Empty state for roles with no relevant data at all */}
      {!hasLeads && !tasks.length && !pendingFU && (
        <div style={{ marginBottom: 20 }}>
          <Card title="👋 Getting Started" height={200}>
            <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌟</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Welcome to your dashboard!</div>
              <div style={{ fontSize: 13 }}>Your activity will show up here as you start working in the system.</div>
            </div>
          </Card>
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