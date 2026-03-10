// RoleDashboard.js — Role-based CRM Dashboard
// One API call per role. No sidebar/navbar — those live in the app shell.

import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "../pages-css/RoleDashboard.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";
const USER_KEY = "bd_portal_user";

/* ─── Fetch helper (mirrors leadsapi.js pattern) ────────────────────────────── */
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
  const res = await fetch(API_BASE + path, {
    headers: getHeaders(),
    credentials: "include",
  });
  if (res.status === 401) throw new Error("SESSION_EXPIRED");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const fmt = (n) => {
  if (!n && n !== 0) return "₹0";
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(1)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const daysDiff = (d) => {
  if (!d) return null;
  return Math.round((new Date(d) - Date.now()) / 86400000);
};

const statusBadge = (status) => {
  if (!status) return <span className="rd-badge rd-badge-gray">—</span>;
  const s = status.toLowerCase();
  if (["closed won","converted","paid","accepted","completed","confirmed","interested"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-green">{status}</span>;
  if (["closed lost","rejected","cancelled","not interested"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-red">{status}</span>;
  if (["new","draft"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-indigo">{status}</span>;
  if (["contacted","sent","in production"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-blue">{status}</span>;
  if (["pending","not responded","in discussion"].some(x => s.includes(x)))
    return <span className="rd-badge rd-badge-yellow">{status}</span>;
  return <span className="rd-badge rd-badge-gray">{status}</span>;
};

const roleBadgeStyle = (role) => {
  const map = {
    "SUPERADMIN":    { background:"#ede9fe", color:"#7c3aed" },
    "ADMIN":         { background:"#dbeafe", color:"#1d4ed8" },
    "Sales Manager": { background:"#dcfce7", color:"#15803d" },
    "BD Executive":  { background:"#fff7ed", color:"#c2410c" },
    "BD EXECUTIVE":  { background:"#fff7ed", color:"#c2410c" },
    "TELECALLER":    { background:"#fef3c7", color:"#b45309" },
  };
  return map[role] || { background:"#f1f5f9", color:"#475569" };
};

/* ─── Reusable UI ───────────────────────────────────────────────────────────── */
const Spinner = () => (
  <div className="rd-loading"><div className="rd-spinner" />Loading…</div>
);

const Empty = ({ icon = "📭", msg = "No data available" }) => (
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

const Card = ({ title, sub, right, children }) => (
  <div className="rd-card">
    {title && (
      <div className="rd-card-head">
        <div>
          <h3 className="rd-card-title">{title}</h3>
          {sub && <div className="rd-card-sub">{sub}</div>}
        </div>
        {right}
      </div>
    )}
    <div className="rd-card-body">{children}</div>
  </div>
);

const MiniBarChart = ({ data = [], color = "#3b82f6" }) => {
  const max = Math.max(...data.map(d => d.value ?? d.v), 1);
  return (
    <div className="rd-mini-chart">
      {data.map((d, i) => {
        const v = d.value ?? d.v ?? 0;
        const l = d.label ?? d.l ?? "";
        return (
          <div key={i} className="rd-mini-bar-wrap">
            <div className="rd-mini-bar-bg">
              <div className="rd-mini-bar-fill"
                style={{ height: `${(v / max) * 100}%`, background: color }} />
            </div>
            <div className="rd-mini-bar-label">{l}</div>
          </div>
        );
      })}
    </div>
  );
};

const Funnel = ({ stages = [] }) => {
  const max = stages[0]?.value || 1;
  const colors = ["#3b82f6","#8b5cf6","#f59e0b","#10b981","#ef4444"];
  return (
    <div className="rd-funnel">
      {stages.map((s, i) => (
        <div key={i} className="rd-funnel-row">
          <div className="rd-funnel-labels">
            <span className="rd-funnel-stage">{s.label}</span>
            <span className="rd-funnel-val">{s.value}</span>
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

/* ─── Follow-up Block (data already in the dashboard payload) ───────────────── */
const FollowupBlock = ({ todayCount = 0, overdueCount = 0, upcomingCount = 0, followups = [] }) => (
  <div className="rd-followup-block">
    <div className="rd-followup-stats">
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
    {followups.length === 0 ? (
      <Empty icon="✅" msg="All follow-ups are up to date!" />
    ) : (
      <div className="rd-followup-list">
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
    )}
  </div>
);

/* ─── Team table (shared between Admin and Sales Manager) ───────────────────── */
const TeamTable = ({ members = [] }) => {
  if (!members.length) return <Empty icon="👥" msg="No team members found" />;
  return (
    <div className="rd-table-wrap">
      <table className="rd-table">
        <thead>
          <tr>
            <th>Member</th><th>Role</th><th>Leads</th><th>Won</th>
            <th>Proposals</th><th>Revenue</th><th>FU Done</th><th>FU Pending</th><th>Rate</th>
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
                      {(t.name||"").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <span className="name-cell">{t.name}</span>
                  </div>
                </td>
                <td><span className="rd-badge" style={rs}>{t.role}</span></td>
                <td>{t.leadsHandled ?? "—"}</td>
                <td style={{ color:"#059669", fontWeight:700 }}>{t.leadsWon ?? "—"}</td>
                <td>{t.proposalsSent ?? "—"}</td>
                <td style={{ color:"#059669" }}>{t.revenue ? fmt(t.revenue) : "—"}</td>
                <td>{t.followupsDone ?? "—"}</td>
                <td style={{ color: t.followupsPending > 0 ? "#f59e0b":"#10b981" }}>{t.followupsPending ?? "—"}</td>
                <td>{t.conversionRate != null ? `${t.conversionRate}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Leads table ───────────────────────────────────────────────────────────── */
const LeadsTable = ({ leads = [], emptyMsg = "No leads found" }) => {
  if (!leads.length) return <Empty icon="📂" msg={emptyMsg} />;
  return (
    <div className="rd-table-wrap">
      <table className="rd-table">
        <thead>
          <tr><th>Lead Name</th><th>Status</th><th>Group</th><th>TC Status</th><th>Source</th><th>Date</th></tr>
        </thead>
        <tbody>
          {leads.map((l, i) => (
            <tr key={i}>
              <td className="name-cell">{l.name}</td>
              <td>{statusBadge(l.status)}</td>
              <td style={{ color:"#64748b" }}>{[l.groupName, l.subGroupName].filter(Boolean).join(" / ") || "—"}</td>
              <td>{l.telecallerStatus ? statusBadge(l.telecallerStatus) : <span style={{ color:"#94a3b8", fontSize:12 }}>—</span>}</td>
              <td>{l.source || "—"}</td>
              <td>{fmtDate(l.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─── Proposals table ───────────────────────────────────────────────────────── */
const ProposalsTable = ({ proposals = [] }) => {
  if (!proposals.length) return <Empty icon="📄" msg="No proposals yet" />;
  return (
    <div className="rd-table-wrap">
      <table className="rd-table">
        <thead>
          <tr><th>Proposal No</th><th>Lead</th><th>Value</th><th>Status</th><th>Date</th></tr>
        </thead>
        <tbody>
          {proposals.map((p, i) => (
            <tr key={i}>
              <td style={{ fontFamily:"monospace", color:"#1d4ed8", fontWeight:700 }}>{p.proposalNo || `PROP-${p.id}`}</td>
              <td>{p.leadName || "—"}</td>
              <td style={{ color:"#059669", fontWeight:600 }}>{fmt(p.totalValue)}</td>
              <td>{statusBadge(p.status)}</td>
              <td>{fmtDate(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SUPER ADMIN / ADMIN DASHBOARD
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
  if (err) return <div className="rd-empty" style={{ color:"#ef4444" }}>⚠ {err}</div>;

  const kpis = [
    { label:"Total Leads",      value:d.totalLeads,      sub:"All time",            accent:"#3b82f6", iconBg:"#eff6ff", icon:"🎯" },
    { label:"Leads This Month", value:d.leadsThisMonth,  sub:"Current month",       accent:"#8b5cf6", iconBg:"#f5f3ff", icon:"📅" },
    { label:"Closed Won",       value:d.closedWon,       sub:"Converted leads",     accent:"#10b981", iconBg:"#ecfdf5", icon:"✅" },
    { label:"Proposals",        value:d.totalProposals,  sub:"All proposals",       accent:"#f59e0b", iconBg:"#fffbeb", icon:"📋" },
    { label:"Order Book Value", value:fmt(d.orderBookValue), sub:"Confirmed orders", accent:"#06b6d4", iconBg:"#ecfeff", icon:"💰" },
    { label:"Pending Follow-ups",value:d.pendingFollowups, sub:"Across all reps",   accent:"#ef4444", iconBg:"#fef2f2", icon:"🔔" },
  ];

  return (
    <div>
      <div className="rd-kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <div className="rd-row rd-row-3" style={{ marginBottom:24 }}>
        <Card title="Monthly Leads" sub="New leads per month">
          <MiniBarChart data={d.monthlyLeads || []} color="#3b82f6" />
        </Card>
        <Card title="Lead Pipeline" sub="Stage breakdown">
          <Funnel stages={[
            { label:"Total",        value: d.totalLeads    || 0 },
            { label:"Contacted",    value: d.contacted     || 0 },
            { label:"In Discussion",value: d.inDiscussion  || 0 },
            { label:"Proposal Sent",value: d.proposalSent  || 0 },
            { label:"Closed Won",   value: d.closedWon     || 0 },
          ]} />
        </Card>
        <Card title="Follow-up Reminders" sub="Pending actions">
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={Math.max(0, d.pendingFollowups - d.overdueFollowups - d.todayFollowups)}
            followups={d.followups || []}
          />
        </Card>
      </div>

      {(d.teamPerformance || []).length > 0 && (
        <div style={{ marginBottom:24 }}>
          <Card title="Team Performance" sub="All team members' activity">
            <TeamTable members={d.teamPerformance} />
          </Card>
        </div>
      )}

      <div style={{ marginBottom:24 }}>
        <Card title="Recent Orders" sub="Latest order book entries">
          {!(d.recentOrders?.length) ? <Empty /> : (
            <div className="rd-table-wrap">
              <table className="rd-table">
                <thead>
                  <tr><th>Order No</th><th>Customer</th><th>Segment</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {d.recentOrders.map((o, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:700, color:"#1d4ed8", fontFamily:"monospace" }}>{o.orderBookNo}</td>
                      <td className="name-cell">{o.customerName || "—"}</td>
                      <td style={{ color:"#64748b" }}>{[o.groupName, o.subGroupName].filter(Boolean).join(" / ") || "—"}</td>
                      <td style={{ color:"#059669", fontWeight:700 }}>{fmt(o.totalAmount)}</td>
                      <td>{statusBadge(o.status)}</td>
                      <td>{fmtDate(o.orderDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SALES MANAGER DASHBOARD
═══════════════════════════════════════════════════════════════════════════════ */
const SalesManagerDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    apiFetch("/dashboard/sales-manager")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color:"#ef4444" }}>⚠ {err}</div>;

  const kpis = [
    { label:"My Leads",         value:d.myLeads,        sub:"Assigned to me",      accent:"#3b82f6", iconBg:"#eff6ff", icon:"🎯" },
    { label:"Active Pipeline",  value:d.activeLeads,    sub:"In progress",         accent:"#8b5cf6", iconBg:"#f5f3ff", icon:"🔄" },
    { label:"Closed Won",       value:d.closedWon,      sub:"Converted",           accent:"#10b981", iconBg:"#ecfdf5", icon:"✅" },
    { label:"My Proposals",     value:d.myProposals,    sub:`${d.acceptedProposals} accepted`, accent:"#f59e0b", iconBg:"#fffbeb", icon:"📋" },
    { label:"Revenue",          value:fmt(d.revenue),   sub:"From accepted proposals", accent:"#06b6d4", iconBg:"#ecfeff", icon:"💰" },
    { label:"Conversion Rate",  value:`${d.conversionRate}%`, sub:"My close rate", accent:"#ef4444", iconBg:"#fef2f2", icon:"📊" },
  ];

  return (
    <div>
      <div className="rd-kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <div className="rd-row rd-row-2-1" style={{ marginBottom:24 }}>
        <Card title="My Lead Pipeline" sub="Leads assigned to me">
          <LeadsTable leads={d.leads || []} emptyMsg="No leads assigned to you yet" />
        </Card>
        <Card title="Follow-up Reminders" sub="Your pending actions">
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={Math.max(0, d.pendingFollowups - d.overdueFollowups - d.todayFollowups)}
            followups={d.followups || []}
          />
        </Card>
      </div>

      <div className="rd-row rd-row-2" style={{ marginBottom:24 }}>
        <Card title="My Proposals">
          <ProposalsTable proposals={d.proposals || []} />
        </Card>
        <Card title="My Conversion Funnel" sub="Lead progression">
          <Funnel stages={[
            { label:"Total Leads",   value: d.myLeads      || 0 },
            { label:"Contacted",     value: d.contacted    || 0 },
            { label:"In Discussion", value: d.inDiscussion || 0 },
            { label:"Proposal Sent", value: d.myProposals  || 0 },
            { label:"Closed Won",    value: d.closedWon    || 0 },
          ]} />
        </Card>
      </div>

      {(d.teamMembers || []).length > 0 && (
        <div style={{ marginBottom:24 }}>
          <Card title="Team Under Me" sub="Performance of your team members">
            <TeamTable members={d.teamMembers} />
          </Card>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   BD EXECUTIVE DASHBOARD
═══════════════════════════════════════════════════════════════════════════════ */
const BDExecutiveDashboard = () => {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    apiFetch("/dashboard/bd")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color:"#ef4444" }}>⚠ {err}</div>;

  const kpis = [
    { label:"BD Leads",         value:d.totalLeads,    sub:"Assigned to me as BD", accent:"#3b82f6", iconBg:"#eff6ff", icon:"📂" },
    { label:"Active Leads",     value:d.activeLeads,   sub:"In my pipeline",       accent:"#8b5cf6", iconBg:"#f5f3ff", icon:"🔄" },
    { label:"Closed Won",       value:d.closedWon,     sub:"Converted",            accent:"#10b981", iconBg:"#ecfdf5", icon:"✅" },
    { label:"Proposals Sent",   value:d.proposalsSent, sub:`${d.acceptedProposals} accepted`, accent:"#f59e0b", iconBg:"#fffbeb", icon:"📋" },
    { label:"Revenue Closed",   value:fmt(d.revenue),  sub:"Accepted proposals",   accent:"#06b6d4", iconBg:"#ecfeff", icon:"💰" },
    { label:"Conversion Rate",  value:`${d.conversionRate}%`, sub:"My close rate", accent:"#ef4444", iconBg:"#fef2f2", icon:"📊" },
  ];

  return (
    <div>
      <div className="rd-kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <div className="rd-row rd-row-2-1" style={{ marginBottom:24 }}>
        <Card title="My Lead Conversions" sub="Leads where I am the BD">
          <LeadsTable leads={d.leads || []} emptyMsg="No BD leads assigned yet" />
        </Card>
        <Card title="Follow-up Reminders" sub="Your pending actions">
          <FollowupBlock
            todayCount={d.todayFollowups}
            overdueCount={d.overdueFollowups}
            upcomingCount={Math.max(0, d.pendingFollowups - d.overdueFollowups - d.todayFollowups)}
            followups={d.followups || []}
          />
        </Card>
      </div>

      <div className="rd-row rd-row-2" style={{ marginBottom:24 }}>
        <Card title="My Proposals">
          <ProposalsTable proposals={d.proposals || []} />
        </Card>
        <Card title="My Conversion Funnel" sub="Lead progression">
          <Funnel stages={[
            { label:"BD Leads",      value: d.totalLeads    || 0 },
            { label:"In Discussion", value: d.inDiscussion  || 0 },
            { label:"Proposals Sent",value: d.proposalsSent || 0 },
            { label:"Accepted",      value: d.acceptedProposals || 0 },
            { label:"Closed Won",    value: d.closedWon     || 0 },
          ]} />
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

  useEffect(() => {
    apiFetch("/dashboard/telecaller")
      .then(res => { if (res.success) setD(res.data); else setErr(res.message); })
      .catch(e => setErr(e.message));
  }, []);

  if (!d && !err) return <Spinner />;
  if (err) return <div className="rd-empty" style={{ color:"#ef4444" }}>⚠ {err}</div>;

  const kpis = [
    { label:"Total Assigned",    value:d.total,        sub:"In my queue",      accent:"#3b82f6", iconBg:"#eff6ff", icon:"📋" },
    { label:"Calls Made",        value:d.called,       sub:"Leads contacted",  accent:"#8b5cf6", iconBg:"#f5f3ff", icon:"📞" },
    { label:"Interested",        value:d.interested,   sub:"Warm leads",       accent:"#10b981", iconBg:"#ecfdf5", icon:"🟢" },
    { label:"Not Interested",    value:d.notInterested,sub:"Cold leads",       accent:"#ef4444", iconBg:"#fef2f2", icon:"🔴" },
    { label:"Pending / Callback",value:d.pending,      sub:"Yet to contact",   accent:"#f59e0b", iconBg:"#fffbeb", icon:"⏳" },
    { label:"Handed to BD",      value:d.handedOff,   sub:"Escalated",        accent:"#06b6d4", iconBg:"#ecfeff", icon:"🤝" },
  ];

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

  const interestedLeads = (d.leads || []).filter(l => l.telecallerStatus === "INTERESTED");

  return (
    <div>
      <div className="rd-kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <div className="rd-row rd-row-2-1" style={{ marginBottom:24 }}>
        <Card title="My Lead Queue" sub="All leads assigned to me for calling">
          {!(d.leads?.length) ? <Empty icon="📞" msg="No leads in your queue" /> : (
            <div className="rd-table-wrap">
              <table className="rd-table">
                <thead>
                  <tr><th>Lead Name</th><th>Phone</th><th>Source</th><th>TC Status</th><th>BD Assigned</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {d.leads.map((l, i) => (
                    <tr key={i}>
                      <td className="name-cell">{l.name}</td>
                      <td style={{ fontFamily:"monospace", color:"#64748b" }}>{l.phone || "—"}</td>
                      <td>{l.source || "—"}</td>
                      <td>{tcBadge(l.telecallerStatus)}</td>
                      <td>{l.handedOffToBD
                        ? <span className="rd-badge rd-badge-green">{l.bdAssigneeName || "Assigned"}</span>
                        : <span className="rd-badge rd-badge-gray">—</span>}
                      </td>
                      <td>{fmtDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <Card title="Follow-up Reminders" sub="Your pending actions">
            <FollowupBlock
              todayCount={d.todayFollowups}
              overdueCount={d.overdueFollowups}
              upcomingCount={0}
              followups={d.followups || []}
            />
          </Card>
          <Card title="Today's Call Stats">
            <div className="rd-stat-list">
              {[
                { l:"Total in queue",   v:d.total,        c:"#3b82f6" },
                { l:"Already called",   v:d.called,       c:"#8b5cf6" },
                { l:"Interested",       v:d.interested,   c:"#10b981" },
                { l:"Not interested",   v:d.notInterested,c:"#ef4444" },
                { l:"Not responded",    v:d.notResponded, c:"#f59e0b" },
                { l:"Pending callback", v:d.pending,      c:"#94a3b8" },
              ].map((item, i) => (
                <div key={i} className="rd-stat-row">
                  <div className="rd-stat-row-left">
                    <div className="rd-stat-dot" style={{ background:item.c }} />
                    {item.l}
                  </div>
                  <div className="rd-stat-row-val" style={{ color:item.c }}>{item.v}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {interestedLeads.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <Card title="🟢 Interested Leads — Ready for BD" sub="Marked Interested, awaiting BD assignment">
            <div className="rd-table-wrap">
              <table className="rd-table">
                <thead>
                  <tr><th>Lead Name</th><th>Phone</th><th>Group</th><th>Discussion Note</th><th>BD Status</th></tr>
                </thead>
                <tbody>
                  {interestedLeads.map((l, i) => (
                    <tr key={i}>
                      <td className="name-cell" style={{ color:"#059669" }}>{l.name}</td>
                      <td style={{ fontFamily:"monospace", color:"#64748b" }}>{l.phone || "—"}</td>
                      <td>{[l.groupName, l.subGroupName].filter(Boolean).join(" / ") || "—"}</td>
                      <td style={{ color:"#64748b", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {l.tcDiscussionNote || "—"}
                      </td>
                      <td>{l.handedOffToBD
                        ? <span className="rd-badge rd-badge-green">BD Assigned</span>
                        : <span className="rd-badge rd-badge-yellow">Pending BD</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOT — picks layout by role, single render
═══════════════════════════════════════════════════════════════════════════════ */
export default function RoleDashboard() {
  const { user, loading: authLoading } = useContext(AuthContext);

  if (authLoading) return <div className="rd-container"><Spinner /></div>;
  if (!user) return (
    <div className="rd-container">
      <div className="rd-empty"><div className="rd-empty-icon">🔒</div>Please log in to view your dashboard.</div>
    </div>
  );

  const role = user.role || "";
  const rs   = roleBadgeStyle(role);
  const h    = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const titles = {
    "SUPERADMIN":    "Super Admin Dashboard",
    "ADMIN":         "Admin Dashboard",
    "Sales Manager": "Sales Manager Dashboard",
    "BD Executive":  "BD Executive Dashboard",
    "BD EXECUTIVE":  "BD Executive Dashboard",
    "TELECALLER":    "Telecaller Dashboard",
  };

  const renderView = () => {
    if (role === "SUPERADMIN" || role === "ADMIN")     return <SuperAdminDashboard />;
    if (role === "Sales Manager")                       return <SalesManagerDashboard />;
    if (role === "BD Executive" || role === "BD EXECUTIVE") return <BDExecutiveDashboard />;
    if (role === "TELECALLER")                          return <TelecallerDashboard />;
    return <div className="rd-empty"><div className="rd-empty-icon">🚫</div>No dashboard configured for role: {role}</div>;
  };

  return (
    <div className="rd-container">
      <div className="rd-header">
        <div className="rd-header-left">
          <h1>{titles[role] || "Dashboard"}</h1>
          <p>{greeting}, <strong>{user.fullName || user.name || user.username}</strong>! Here's your overview for today.</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span className="rd-role-badge" style={rs}>{role}</span>
          <span style={{ fontSize:13, color:"#94a3b8" }}>
            {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}
          </span>
        </div>
      </div>
      {renderView()}
    </div>
  );
}