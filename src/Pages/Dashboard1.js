import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../pages-css/Dashboard1.css';
import { useAuth } from '../hooks/useAuth.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

/* ─── Role routing ─────────────────────────────────────────────────────────── */
function getDashboardEndpoint(role) {
  if (!role) return 'generic';
  const r = role.trim().toUpperCase();
  if (r === 'SUPERADMIN' || r === 'ADMIN') return 'admin';
  if (r === 'MANAGER' || r === 'BD_MANAGER' || r === 'SALES_MANAGER') return 'sales-manager';
  if (r === 'TELECALLER') return 'telecaller';
  if (r === 'BD_EXECUTIVE' || r === 'BDEXECUTIVE' || r === 'SALES_EXEC') return 'bd';
  return 'generic';
}

/* ─── Greeting helpers ─────────────────────────────────────────────────────── */
function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const MOTIVATIONAL_QUOTES = [
  "Every lead is a new opportunity — make it count! 🚀",
  "Your hustle today builds tomorrow's success. 💪",
  "Small wins add up to big victories. Keep pushing! 🏆",
  "The best time to close a deal is right now. ⚡",
  "Your follow-ups today are someone's solution tomorrow. 🎯",
  "Consistency beats talent — show up and deliver! 🌟",
  "Every 'no' brings you closer to the next 'yes'. 💡",
  "Your pipeline is your future. Nurture it well! 🌱",
];

function getDailyQuote() {
  const idx = new Date().getDate() % MOTIVATIONAL_QUOTES.length;
  return MOTIVATIONAL_QUOTES[idx];
}

/* ─── Formatters ───────────────────────────────────────────────────────────── */
const fmt = n => (n ?? 0).toLocaleString('en-IN');
const fmtCr = v => {
  const n = parseFloat(v || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const fmtDate = s => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return s; }
};
const roleFmt = r => (r || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/* ─── Status colors & badge ────────────────────────────────────────────────── */
const STATUS_COLORS = {
  'Closed Won':     { bg: '#d1fae5', color: '#065f46' },
  'Closed Lost':    { bg: '#fee2e2', color: '#991b1b' },
  'New':            { bg: '#eff6ff', color: '#1e40af' },
  'Contacted':      { bg: '#fef3c7', color: '#92400e' },
  'In Discussion':  { bg: '#fde8d8', color: '#9a3412' },
  'Proposal Sent':  { bg: '#e0e7ff', color: '#3730a3' },
  'INTERESTED':     { bg: '#d1fae5', color: '#065f46' },
  'NOT_INTERESTED': { bg: '#fee2e2', color: '#991b1b' },
  'NOT_RESPONDED':  { bg: '#fef3c7', color: '#92400e' },
  'Accepted':       { bg: '#d1fae5', color: '#065f46' },
  'Draft':          { bg: '#f3f4f6', color: '#374151' },
  'Sent':           { bg: '#e0e7ff', color: '#3730a3' },
  'Completed':      { bg: '#d1fae5', color: '#065f46' },
  'Confirmed':      { bg: '#dbeafe', color: '#1e40af' },
  'Pending':        { bg: '#fef3c7', color: '#92400e' },
};
const StatusBadge = ({ s }) => {
  const c = STATUS_COLORS[s] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s || '—'}
    </span>
  );
};

/* ─── KPI Card ─────────────────────────────────────────────────────────────── */
const KpiCard = ({ icon, label, value, sub, accent = '#3b82f6', trend }) => (
  <div className="db-kpi-card" style={{ borderLeft: `4px solid ${accent}` }}>
    <div className="db-kpi-icon">{icon}</div>
    <div className="db-kpi-value">{value}</div>
    <div className="db-kpi-label">{label}</div>
    {sub  && <div className="db-kpi-sub">{sub}</div>}
    {trend && <div className="db-kpi-trend" style={{ color: trend > 0 ? '#059669' : '#ef4444' }}>
      {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
    </div>}
  </div>
);

/* ─── Section card with FIXED height + inner scroll ──────────────────────── */
const Section = ({ title, children, badge, height = 320, noPad = false }) => (
  <div className="db-section" style={{ height }}>
    <div className="db-section-header">
      <h3 className="db-section-title">{title}</h3>
      {badge != null && (
        <span className="db-section-badge">{badge}</span>
      )}
    </div>
    <div className="db-section-body" style={{ padding: noPad ? 0 : undefined }}>
      {children}
    </div>
  </div>
);

/* ─── Table with internal scroll ───────────────────────────────────────────── */
const SimpleTable = ({ cols, rows, empty = 'No data' }) => (
  <div className="db-table-wrap">
    {rows.length === 0
      ? <div className="db-empty">{empty}</div>
      : <table className="db-table">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c.key} style={{ textAlign: c.right ? 'right' : 'left', fontWeight: c.bold ? 600 : 400, color: c.bold ? '#111827' : '#374151', whiteSpace: c.nowrap ? 'nowrap' : 'normal' }}>
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
    }
  </div>
);

/* ─── Follow-up list ───────────────────────────────────────────────────────── */
const FollowupList = ({ items }) => {
  if (!items?.length) return <div className="db-empty">✅ No pending follow-ups right now</div>;
  return (
    <div className="db-followup-list">
      {items.map((f, i) => {
        const pColor = f.priority === 'High' ? '#ef4444' : f.priority === 'Medium' ? '#f59e0b' : '#10b981';
        const isOverdue = f.scheduledAt && new Date(f.scheduledAt) < new Date();
        return (
          <div key={i} className="db-followup-item" style={{ borderLeft: `3px solid ${pColor}` }}>
            <div className="db-followup-main">
              <div className="db-followup-name">{f.leadName || '—'}</div>
              <div className="db-followup-meta">
                {f.followupType}
                {f.scheduledAt && <> · <span style={{ color: isOverdue ? '#ef4444' : '#6b7280', fontWeight: isOverdue ? 600 : 400 }}>{fmtDate(f.scheduledAt)}{isOverdue ? ' ⚠️' : ''}</span></>}
                {f.assignedToName && ` · ${f.assignedToName}`}
              </div>
            </div>
            <StatusBadge s={f.status} />
          </div>
        );
      })}
    </div>
  );
};

/* ─── Bar chart ────────────────────────────────────────────────────────────── */
const BarChart = ({ data }) => {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="db-barchart">
      {data.map((d, i) => (
        <div key={i} className="db-bar-wrap">
          <div className="db-bar-val">{d.value}</div>
          <div className="db-bar" style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }} />
          <div className="db-bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
};

/* ─── Lead pipeline funnel ─────────────────────────────────────────────────── */
const LeadPipeline = ({ stages }) => {
  if (!stages?.length) return null;
  const max = Math.max(...stages.map(s => s.count), 1);
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];
  return (
    <div className="db-pipeline">
      {stages.map((s, i) => (
        <div key={i} className="db-pipeline-stage">
          <div className="db-pipeline-bar-wrap">
            <div className="db-pipeline-bar" style={{
              width: `${Math.max((s.count / max) * 100, 8)}%`,
              background: colors[i % colors.length],
            }} />
          </div>
          <div className="db-pipeline-info">
            <span className="db-pipeline-label">{s.label}</span>
            <span className="db-pipeline-count" style={{ color: colors[i % colors.length] }}>{fmt(s.count)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Team performance table ───────────────────────────────────────────────── */
const TeamTable = ({ members }) => {
  if (!members?.length)
    return <div className="db-empty">No team members assigned yet. Contact admin to set up your team.</div>;
  return (
    <SimpleTable
      cols={[
        { key: 'name',            label: 'Member', bold: true },
        { key: 'role',            label: 'Role',       render: r => <span style={{ fontSize: 11, color: '#6b7280' }}>{r.role}</span> },
        { key: 'leadsHandled',    label: 'Leads',      right: true, render: r => fmt(r.leadsHandled) },
        { key: 'interested',      label: 'Interested', right: true, render: r => <span style={{ color: '#059669', fontWeight: 600 }}>{fmt(r.interested)}</span> },
        { key: 'leadsWon',        label: 'Won',        right: true, render: r => <span style={{ color: '#065f46', fontWeight: 700 }}>{fmt(r.leadsWon)}</span> },
        { key: 'proposalsSent',   label: 'Proposals',  right: true, render: r => fmt(r.proposalsSent) },
        { key: 'revenue',         label: 'Revenue',    right: true, render: r => <span style={{ color: '#059669', fontWeight: 600 }}>{fmtCr(r.revenue)}</span> },
        { key: 'followupsDone',   label: 'FU Done',    right: true, render: r => fmt(r.followupsDone) },
        { key: 'followupsPending',label: 'FU Pending', right: true, render: r => <span style={{ color: r.followupsPending > 0 ? '#d97706' : '#374151' }}>{fmt(r.followupsPending)}</span> },
        {
          key: 'conversionRate', label: 'Conv%', right: true,
          render: r => <span style={{ color: r.conversionRate > 20 ? '#059669' : '#374151', fontWeight: 600 }}>{r.conversionRate}%</span>,
        },
      ]}
      rows={members}
    />
  );
};

/* ─── Task list ────────────────────────────────────────────────────────────── */
const taskStatusColor = s => {
  const m = {
    Pending:      { bg: '#fef3c7', color: '#92400e' },
    Completed:    { bg: '#d1fae5', color: '#065f46' },
    Overdue:      { bg: '#fee2e2', color: '#991b1b' },
    'In Progress':{ bg: '#dbeafe', color: '#1e40af' },
  };
  return m[s] || { bg: '#f3f4f6', color: '#374151' };
};

const TaskList = ({ items }) => {
  if (!items?.length) return <div className="db-empty">✅ No pending tasks — you're all caught up!</div>;
  return (
    <div className="db-task-list">
      {items.map((t, i) => {
        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed';
        const pColor = t.priority === 'High' ? '#ef4444' : t.priority === 'Medium' ? '#f59e0b' : '#10b981';
        const sc = taskStatusColor(isOverdue ? 'Overdue' : t.status);
        return (
          <div key={i} className="db-task-item" style={{ borderLeft: `3px solid ${pColor}` }}>
            <div className="db-task-main">
              <div className="db-task-title">{t.title || '—'}</div>
              <div className="db-task-meta">
                {t.category && <span className="db-tag">{t.category}</span>}
                {t.dueDate && <span style={{ color: isOverdue ? '#ef4444' : '#6b7280', fontSize: 11 }}>Due {fmtDate(t.dueDate)}{isOverdue ? ' ⚠️' : ''}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
                {isOverdue ? 'Overdue' : t.status}
              </span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{t.priority} priority</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Header greeting banner ────────────────────────────────────────────────── */
const GreetingBanner = ({ userName, subtitle, roleLabel, showQuote = true }) => (
  <div className="db-greeting-banner">
    <div className="db-greeting-left">
      <div className="db-greeting-time">{getTimeGreeting()},</div>
      <div className="db-greeting-name">{userName} 👋</div>
      <div className="db-greeting-sub">
        {roleLabel && <span className="db-role-tag">{roleLabel}</span>}
        {subtitle}
      </div>
    </div>
    {showQuote && (
      <div className="db-greeting-quote">
        <span className="db-quote-mark">"</span>
        {getDailyQuote()}
      </div>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ADMIN / SUPERADMIN DASHBOARD                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */
function AdminDashboard({ data: d, userName }) {
  const pipeline = [
    { label: 'New',            count: d.totalLeads - d.contacted - d.inDiscussion - d.closedWon },
    { label: 'Contacted',      count: d.contacted },
    { label: 'In Discussion',  count: d.inDiscussion },
    { label: 'Proposal Sent',  count: d.proposalSent },
    { label: 'Closed Won',     count: d.closedWon },
  ];

  return (
    <>
      <GreetingBanner userName={userName} subtitle="Full company overview — everything at a glance" />

      {/* KPI Strip */}
      <div className="db-kpi-grid">
        <KpiCard icon="📋" label="Total Leads"    value={fmt(d.totalLeads)}      sub={`+${fmt(d.leadsThisMonth)} this month`} accent="#3b82f6" />
        <KpiCard icon="✅" label="Closed Won"     value={fmt(d.closedWon)}       accent="#059669" />
        <KpiCard icon="🔄" label="Active"         value={fmt(d.activeLeads)}     accent="#8b5cf6" />
        <KpiCard icon="📝" label="Proposals"      value={fmt(d.totalProposals)}  sub={`${fmt(d.proposalSent)} sent`} accent="#f59e0b" />
        <KpiCard icon="📦" label="Orders"         value={fmt(d.totalOrders)}     sub={fmtCr(d.orderBookValue)} accent="#10b981" />
        <KpiCard icon="📞" label="Follow-ups"     value={fmt(d.pendingFollowups)}sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ef4444" />
        <KpiCard icon="💬" label="Contacted"      value={fmt(d.contacted)}       accent="#6366f1" />
        <KpiCard icon="🤝" label="In Discussion"  value={fmt(d.inDiscussion)}    accent="#ec4899" />
      </div>

      {/* Row 1: Monthly chart + Pipeline */}
      <div className="db-row-2">
        <Section title="📈 Lead Trend — Last 6 Months" height={260}>
          <BarChart data={d.monthlyLeads} />
        </Section>
        <Section title="🔀 Lead Pipeline" height={260}>
          <LeadPipeline stages={pipeline} />
        </Section>
      </div>

      {/* Team Performance — tall enough for table */}
      <Section title="🏆 Team Performance" badge={d.teamPerformance?.length} height={360} noPad>
        <TeamTable members={d.teamPerformance} />
      </Section>

      {/* Row 2: Recent Orders + Follow-ups */}
      <div className="db-row-2" style={{ marginTop: '1rem' }}>
        <Section title="📦 Recent Orders" badge={d.recentOrders?.length} height={320} noPad>
          <SimpleTable
            cols={[
              { key: 'orderBookNo',  label: 'Order #', bold: true, nowrap: true },
              { key: 'customerName', label: 'Customer' },
              { key: 'totalAmount',  label: 'Value', right: true, render: r => fmtCr(r.totalAmount) },
              { key: 'status',       label: 'Status', render: r => <StatusBadge s={r.status} /> },
            ]}
            rows={d.recentOrders || []}
            empty="No recent orders"
          />
        </Section>
        <Section title="⏰ Follow-up Reminders" height={320}>
          <FollowupList items={d.followups} />
        </Section>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MANAGER DASHBOARD                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */
function ManagerDashboard({ data: d, userName, tasks }) {
  const pipeline = [
    { label: 'New / Contacted',  count: (d.contacted || 0) },
    { label: 'In Discussion',    count: d.inDiscussion },
    { label: 'Proposal Sent',    count: d.myProposals },
    { label: 'Closed Won',       count: d.closedWon },
  ];

  const monthlyTeam = d.monthlyLeads || [];

  return (
    <>
      <GreetingBanner userName={userName} subtitle="Your team is counting on you — lead them to excellence!" />

      {/* KPI Strip */}
      <div className="db-kpi-grid">
        <KpiCard icon="📋" label="Team Leads"      value={fmt(d.myLeads)}          accent="#3b82f6" />
        <KpiCard icon="✅" label="Closed Won"      value={fmt(d.closedWon)}        sub={`${d.conversionRate}% conv.`} accent="#059669" />
        <KpiCard icon="🔄" label="Active"          value={fmt(d.activeLeads)}      accent="#8b5cf6" />
        <KpiCard icon="📝" label="Proposals"       value={fmt(d.myProposals)}      sub={`${fmt(d.acceptedProposals)} accepted`} accent="#f59e0b" />
        <KpiCard icon="💰" label="Team Revenue"    value={fmtCr(d.revenue)}        accent="#10b981" />
        <KpiCard icon="📞" label="Pending FU"      value={fmt(d.pendingFollowups)} sub={`${fmt(d.overdueFollowups)} overdue · ${fmt(d.todayFollowups)} today`} accent="#ef4444" />
        <KpiCard icon="📋" label="My Tasks"        value={fmt(tasks.total)}        sub={`${fmt(tasks.overdue)} overdue`} accent="#6366f1" />
        <KpiCard icon="🤝" label="In Discussion"   value={fmt(d.inDiscussion)}     accent="#ec4899" />
      </div>

      {/* Row 1: Monthly leads + Pipeline */}
      <div className="db-row-2">
        <Section title="📈 Team Lead Trend — Last 6 Months" height={260}>
          <BarChart data={monthlyTeam} />
        </Section>
        <Section title="🔀 Team Lead Pipeline" height={260}>
          <LeadPipeline stages={pipeline} />
        </Section>
      </div>

      {/* Team Performance */}
      <Section title="🏆 Your Team's Performance" badge={d.teamMembers?.length} height={360} noPad>
        <TeamTable members={d.teamMembers} />
      </Section>

      {/* Row 2: Recent leads + Tasks */}
      <div className="db-row-2" style={{ marginTop: '1rem' }}>
        <Section title="📋 Recent Team Leads" badge={d.leads?.length} height={320} noPad>
          <SimpleTable
            cols={[
              { key: 'name',      label: 'Client', bold: true },
              { key: 'groupName', label: 'Group', render: r => <span style={{ fontSize: 11 }}>{r.groupName || '—'}</span> },
              { key: 'status',    label: 'Status', render: r => <StatusBadge s={r.status} /> },
            ]}
            rows={d.leads || []}
            empty="No leads yet"
          />
        </Section>
        <Section title="📝 My Pending Tasks" badge={tasks.items?.length} height={320}>
          <TaskList items={tasks.items} />
        </Section>
      </div>

      {/* Follow-ups */}
      <Section title="⏰ Follow-up Reminders" height={300}>
        <FollowupList items={d.followups} />
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* BD EXECUTIVE DASHBOARD                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
function BdDashboard({ data: d, userName, tasks }) {
  return (
    <>
      <GreetingBanner userName={userName} subtitle="Your leads, your targets — let's crush them today!" />

      <div className="db-kpi-grid">
        <KpiCard icon="📋" label="My Leads"        value={fmt(d.totalLeads)}       accent="#3b82f6" />
        <KpiCard icon="✅" label="Closed Won"       value={fmt(d.closedWon)}        sub={`${d.conversionRate}% conv.`} accent="#059669" />
        <KpiCard icon="🔄" label="Active"           value={fmt(d.activeLeads)}      accent="#8b5cf6" />
        <KpiCard icon="🤝" label="In Discussion"    value={fmt(d.inDiscussion)}     accent="#6366f1" />
        <KpiCard icon="📝" label="Proposals Sent"   value={fmt(d.proposalsSent)}    sub={`${fmt(d.acceptedProposals)} accepted`} accent="#f59e0b" />
        <KpiCard icon="💰" label="My Revenue"       value={fmtCr(d.revenue)}        accent="#10b981" />
        <KpiCard icon="📞" label="Pending FU"       value={fmt(d.pendingFollowups)} sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ef4444" />
        <KpiCard icon="📅" label="Today's FUs"      value={fmt(d.todayFollowups)}   accent="#f59e0b" />
      </div>

      <div className="db-row-2">
        <Section title="📋 My Leads" badge={d.leads?.length} height={320} noPad>
          <SimpleTable
            cols={[
              { key: 'name',      label: 'Client', bold: true },
              { key: 'groupName', label: 'Group', render: r => <span style={{ fontSize: 11 }}>{r.groupName || '—'}</span> },
              { key: 'status',    label: 'Status', render: r => <StatusBadge s={r.status} /> },
              { key: 'source',    label: 'Source', render: r => <span style={{ fontSize: 11, color: '#6b7280' }}>{r.source || '—'}</span> },
            ]}
            rows={d.leads || []}
            empty="No leads assigned yet"
          />
        </Section>
        <Section title="📝 My Proposals" height={320} noPad>
          <SimpleTable
            cols={[
              { key: 'proposalNo', label: '#', bold: true, nowrap: true },
              { key: 'leadName',   label: 'Lead' },
              { key: 'totalValue', label: 'Value', right: true, render: r => fmtCr(r.totalValue) },
              { key: 'status',     label: 'Status', render: r => <StatusBadge s={r.status} /> },
            ]}
            rows={d.proposals || []}
            empty="No proposals yet"
          />
        </Section>
      </div>

      <div className="db-row-2" style={{ marginTop: '1rem' }}>
        <Section title="⏰ Follow-up Reminders" height={300}>
          <FollowupList items={d.followups} />
        </Section>
        <Section title="✅ My Pending Tasks" badge={tasks.items?.length} height={300}>
          <TaskList items={tasks.items} />
        </Section>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TELECALLER DASHBOARD                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
function TcDashboard({ data: d, userName, tasks }) {
  const tcColor = s => ({
    INTERESTED:    { bg: '#d1fae5', color: '#065f46' },
    NOT_INTERESTED:{ bg: '#fee2e2', color: '#991b1b' },
    NOT_RESPONDED: { bg: '#fef3c7', color: '#92400e' },
  }[s] || { bg: '#f3f4f6', color: '#374151' });

  const pct = d.total > 0 ? Math.round((d.interested / d.total) * 100) : 0;

  return (
    <>
      <GreetingBanner userName={userName} subtitle="Every call is a chance to change someone's life — dial with conviction!" />

      <div className="db-kpi-grid">
        <KpiCard icon="📋" label="Total Assigned"  value={fmt(d.total)}          accent="#3b82f6" />
        <KpiCard icon="📞" label="Called"          value={fmt(d.called)}         accent="#6366f1" />
        <KpiCard icon="✅" label="Interested"      value={fmt(d.interested)}     accent="#059669" />
        <KpiCard icon="❌" label="Not Interested"  value={fmt(d.notInterested)}  accent="#ef4444" />
        <KpiCard icon="⏳" label="Not Responded"   value={fmt(d.notResponded)}   accent="#f59e0b" />
        <KpiCard icon="🆕" label="Pending"         value={fmt(d.pending)}        accent="#8b5cf6" />
        <KpiCard icon="🤝" label="Handed to BD"    value={fmt(d.handedOff)}      accent="#10b981" />
        <KpiCard icon="📅" label="Today's FUs"     value={fmt(d.todayFollowups)} sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ec4899" />
      </div>

      {/* Interest rate bar */}
      {d.total > 0 && (
        <div className="db-progress-card">
          <div className="db-progress-header">
            <span>Interest Rate</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>{pct}% 🎯</span>
          </div>
          <div className="db-progress-track">
            <div className="db-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="db-progress-legend">
            <span style={{ color: '#059669' }}>● Interested: {fmt(d.interested)}</span>
            <span style={{ color: '#ef4444' }}>● Not Interested: {fmt(d.notInterested)}</span>
            <span style={{ color: '#f59e0b' }}>● Not Responded: {fmt(d.notResponded)}</span>
          </div>
        </div>
      )}

      <div className="db-row-2">
        <Section title="📋 My Recent Leads" badge={d.leads?.length} height={340} noPad>
          <SimpleTable
            cols={[
              { key: 'name',      label: 'Client', bold: true },
              { key: 'phone',     label: 'Phone', nowrap: true },
              { key: 'groupName', label: 'Group', render: r => <span style={{ fontSize: 11 }}>{r.groupName || '—'}</span> },
              {
                key: 'telecallerStatus', label: 'Status',
                render: r => {
                  const c = tcColor(r.telecallerStatus);
                  return <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{r.telecallerStatus || 'NEW'}</span>;
                },
              },
              { key: 'handedOffToBD', label: 'BD', render: r => r.handedOffToBD ? <span style={{ color: '#059669', fontSize: 11 }}>✅ {r.bdAssigneeName || 'BD'}</span> : <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span> },
            ]}
            rows={d.leads || []}
            empty="No leads assigned yet"
          />
        </Section>

        <div className="db-col-2">
          <Section title="⏰ Follow-up Reminders" height={200}>
            <FollowupList items={d.followups} />
          </Section>
          <Section title="✅ My Tasks" badge={tasks.items?.length} height={200}>
            <TaskList items={tasks.items} />
          </Section>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* GENERIC / OTHER ROLES DASHBOARD                                            */
/* Shown to: Procurement Manager, Accounts, HR, custom roles, etc.           */
/* ═══════════════════════════════════════════════════════════════════════════ */
function GenericDashboard({ data: d, tasks, userName, role }) {
  const hasLeads = d.myLeads > 0 || d.activeLeads > 0 || d.closedWon > 0;
  const isL3 = d.levelOrder === 3;

  const motivations = {
    PROCUREMENT: "Every purchase you make powers the team's success! 💼",
    ACCOUNTS:    "Numbers tell the story — you're the narrator! 📊",
    HR:          "Happy teams deliver great results — thanks for keeping the culture alive! 🌟",
  };

  const roleKey = Object.keys(motivations).find(k => role?.toUpperCase().includes(k));
  const subtitle = motivations[roleKey] || "You're an important part of this team — make today count! 🎯";

  const pipeline = hasLeads ? [
    { label: 'Active',         count: d.activeLeads },
    { label: 'Won',            count: d.closedWon },
  ] : [];

  return (
    <>
      <GreetingBanner userName={userName} roleLabel={roleFmt(role)} subtitle={subtitle} />

      <div className="db-kpi-grid">
        <KpiCard icon="📞" label="Pending Follow-ups"  value={fmt(d.pendingFollowups)}  sub={`${fmt(d.overdueFollowups)} overdue`} accent="#ef4444" />
        <KpiCard icon="📅" label="Today's Follow-ups"  value={fmt(d.todayFollowups)}    accent="#f59e0b" />
        <KpiCard icon="📋" label="My Tasks"            value={fmt(tasks.total)}          sub={`${fmt(tasks.pending)} pending`} accent="#3b82f6" />
        <KpiCard icon="⚠️" label="Overdue Tasks"       value={fmt(tasks.overdue)}        accent="#dc2626" />
        {hasLeads && <KpiCard icon="🎯" label="My Leads"      value={fmt(d.myLeads)}     sub={`${fmt(d.closedWon)} won`} accent="#059669" />}
        {hasLeads && <KpiCard icon="🔄" label="Active Leads"  value={fmt(d.activeLeads)} accent="#8b5cf6" />}
        {hasLeads && <KpiCard icon="📝" label="My Proposals"  value={fmt(d.myProposals)} accent="#6366f1" />}
      </div>

      {/* L3: Show team performance */}
      {isL3 && (
        <Section title="🏆 Your Team's Performance" badge={d.teamMembers?.length} height={360} noPad>
          <TeamTable members={d.teamMembers} />
        </Section>
      )}

      {/* My Performance Summary */}
      {hasLeads && (
        <div className="db-row-2">
          <Section title="🎯 My Performance" height={220}>
            <LeadPipeline stages={pipeline} />
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#059669' }}>{d.closedWon > 0 && d.myLeads > 0 ? Math.round((d.closedWon / d.myLeads) * 100) : 0}%</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Conversion Rate</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{fmt(d.myProposals)}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Proposals Made</div>
              </div>
            </div>
          </Section>
          <Section title="📋 My Recent Leads" badge={d.leads?.length} height={220} noPad>
            <SimpleTable
              cols={[
                { key: 'name',      label: 'Client', bold: true },
                { key: 'groupName', label: 'Group', render: r => <span style={{ fontSize: 11 }}>{r.groupName || '—'}</span> },
                { key: 'status',    label: 'Status', render: r => <StatusBadge s={r.status} /> },
              ]}
              rows={d.leads || []}
              empty="No leads"
            />
          </Section>
        </div>
      )}

      {/* Tasks + Follow-ups */}
      <div className="db-row-2" style={{ marginTop: '1rem' }}>
        <Section title="✅ My Pending Tasks" badge={tasks.items?.length} height={320}>
          <TaskList items={tasks.items} />
        </Section>
        <Section title="⏰ Follow-up Reminders" height={320}>
          <FollowupList items={d.followups} />
        </Section>
      </div>
    </>
  );
}

/* ─── Loading skeleton ─────────────────────────────────────────────────────── */
const Skeleton = () => (
  <div style={{ padding: 24 }}>
    <div className="db-skel" style={{ height: 100, borderRadius: 12, marginBottom: 16 }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
      {[...Array(8)].map((_, i) => <div key={i} className="db-skel" style={{ height: 90, borderRadius: 10 }} />)}
    </div>
    <div className="db-skel" style={{ height: 200, borderRadius: 10, marginBottom: 16 }} />
    <div className="db-skel" style={{ height: 300, borderRadius: 10 }} />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ROOT COMPONENT                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [tasks,   setTasks]   = useState({ total: 0, pending: 0, overdue: 0, items: [] });

  const role     = user?.role || '';
  const userId   = user?.id   || '';
  const userName = user?.name || user?.username || 'there';
  const endpoint = getDashboardEndpoint(role);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/tasks?userId=${userId}&status=Pending&size=10&page=1`,
        { credentials: 'include', headers: { 'User-Id': String(userId), 'User-Role': role } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const items   = json.data || json.tasks || [];
      const total   = json.totalElements || json.total || items.length;
      const pending = items.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
      const overdue = items.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
      setTasks({ total, pending, overdue, items: items.slice(0, 8) });
    } catch { /* tasks optional */ }
  }, [userId, role]);

  const fetchDashboard = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/${endpoint}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'User-Id': String(userId), 'User-Role': role },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else throw new Error(json.message || 'Failed to load dashboard');
    } catch (e) {
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [endpoint, userId, role]);

  useEffect(() => {
    fetchDashboard();
    // Always fetch tasks — all roles benefit from them
    fetchTasks();
  }, [fetchDashboard, fetchTasks]);

  if (loading) return <Skeleton />;

  if (error) return (
    <div className="dashboard-home-container">
      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ color: '#374151', marginBottom: 8 }}>Could not load dashboard</h3>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <button onClick={fetchDashboard} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          Retry
        </button>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="dashboard-home-container db-root">
      {endpoint === 'admin'        && <AdminDashboard   data={data} userName={userName} />}
      {endpoint === 'sales-manager'&& <ManagerDashboard data={data} userName={userName} tasks={tasks} />}
      {endpoint === 'bd'           && <BdDashboard      data={data} userName={userName} tasks={tasks} />}
      {endpoint === 'telecaller'   && <TcDashboard      data={data} userName={userName} tasks={tasks} />}
      {endpoint === 'generic'      && <GenericDashboard data={data} tasks={tasks} userName={userName} role={role} />}
    </div>
  );
}