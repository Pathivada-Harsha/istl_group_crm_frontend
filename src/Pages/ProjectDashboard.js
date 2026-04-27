import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, IndianRupee, Package, FileText, Users,
  Calendar, Clock, AlertCircle, CheckCircle, XCircle, Activity,
  Briefcase, ShoppingCart, BarChart3, PieChart, Target,
  MapPin, Building2, User, Percent,
  RefreshCw, Receipt, CreditCard, Wallet,
  Plane, Utensils, MapPin as MapPinIcon, Hotel, Eye, ChevronDown, ChevronUp, X,
  Layers, Globe, Tag
} from 'lucide-react';
import '../pages-css/ProjectDashboard.css';
import GroupProjectFilter from "../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import {
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area,
  ComposedChart
} from 'recharts';

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
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

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
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {catChartData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
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
        <div className="db-modal-overlay" onClick={() => setUserModal(false)}>
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

// ─── Aggregated (All / Group / SubGroup) Dashboard ───────────────────────────
const AggregatedDashboard = ({ data, scopeLabel, onRefresh, loading }) => {
  const { financial = {}, procurement = {}, projects = [], statusDistribution = [] } = data;
  const breakdownRef = React.useRef(null);
  const scrollToBreakdown = () => breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const EmptyChart = ({ message = 'No data' }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}><BarChart3 size={40} style={{ margin: '0 auto 8px', opacity: .3 }} /><p style={{ fontSize: 13 }}>{message}</p></div>
    </div>
  );

  const statusColor = { Completed: '#22c55e', 'In Progress': '#3b82f6', Planning: '#f59e0b', 'On Hold': '#8b5cf6', Cancelled: '#ef4444' };

  // Top projects by budget for chart
  const topByBudget = [...projects]
    .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
    .slice(0, 6)
    .map(p => ({ name: p.projectName?.slice(0, 18) + (p.projectName?.length > 18 ? '…' : ''), budget: Number(p.budget || 0), received: Number(p.received || 0), spent: Number(p.spent || 0) }));

  return (
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
          {projects.length > 0 && (
            <button className="dashboard-refresh-btn" onClick={scrollToBreakdown}
              style={{ background: '#3b82f6', color: '#fff', border: 'none' }}>
              <Briefcase size={16} /> All Projects ↓
            </button>
          )}
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
            { label: 'Total Projects',      val: data.totalProjects,        color: '#3b82f6', icon: <Briefcase size={32} /> },
            { label: 'Completed',           val: data.completedProjects,    color: '#22c55e', icon: <CheckCircle size={32} /> },
            { label: 'In Progress',         val: data.inProgressProjects,   color: '#06b6d4', icon: <Activity size={32} /> },
            { label: 'Planning',            val: data.planningProjects,     color: '#f59e0b', icon: <Target size={32} /> },
            { label: 'On Hold',             val: data.onHoldProjects,       color: '#8b5cf6', icon: <Clock size={32} /> },
            { label: 'Cancelled',           val: data.cancelledProjects,    color: '#ef4444', icon: <XCircle size={32} /> },
          ].filter(k => k.val > 0 || k.label === 'Total Projects').map((k, i) => (
            <div key={i} className="kpi-card" style={{ borderTopColor: k.color, cursor: projects.length > 0 ? 'pointer' : 'default' }}
              onClick={projects.length > 0 ? scrollToBreakdown : undefined}
              title={projects.length > 0 ? 'Click to view Projects Breakdown' : undefined}>
              <div className="kpi-icon" style={{ color: k.color }}>{k.icon}</div>
              <div className="kpi-content">
                <div className="kpi-value">{k.val}</div>
                <div className="kpi-label">{k.label}</div>
                {projects.length > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>↓ View breakdown</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Overview */}
      <div className="dashboard-section">
        <h3 className="section-title"><IndianRupee size={20} />Consolidated Financial Overview</h3>
        <div className="kpi-grid">
          {[
            { label: 'Total Project Value',   val: formatCurrency(financial.totalProjectValue),  color: '#3b82f6', icon: <Wallet size={32} />,      sub: 'Sum of all budgets' },
            { label: 'Total Billed',          val: formatCurrency(financial.totalBilled),         color: '#8b5cf6', icon: <FileText size={32} />,    sub: 'All invoices raised' },
            { label: 'Total Received',        val: formatCurrency(financial.totalReceived),       color: '#22c55e', icon: <TrendingUp size={32} />,  sub: `${financial.billingPercentage?.toFixed(1)}% collected` },
            { label: 'Pending Receipts',      val: formatCurrency(financial.pendingReceipts),     color: '#f59e0b', icon: <Clock size={32} />,       sub: 'Yet to receive' },
            { label: 'Total Procurement',     val: formatCurrency(financial.totalPayable),        color: '#ef4444', icon: <ShoppingCart size={32} />,sub: 'All vendor bills' },
            { label: 'Total Paid (Vendors)',  val: formatCurrency(financial.totalPaid),           color: '#06b6d4', icon: <CreditCard size={32} />,  sub: `${financial.paymentPercentage?.toFixed(1)}% paid` },
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

      {/* Charts Row */}
      <div className="dashboard-charts-grid">
        {/* Status Pie */}
        {statusDistribution.length > 0 ? (
          <div className="chart-card">
            <div className="chart-header"><h4 className="chart-title"><PieChart size={16} />Project Status Distribution</h4></div>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" labelLine={false}
                  label={e => `${e.name} (${e.value})`} outerRadius={90} dataKey="value">
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={statusColor[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Status Distribution</h4></div><EmptyChart /></div>
        )}

        {/* Top Projects by Budget bar chart */}
        {topByBudget.length > 0 ? (
          <div className="chart-card">
            <div className="chart-header"><h4 className="chart-title"><BarChart3 size={16} />Top Projects — Budget vs Received</h4></div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topByBudget} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="budget"   name="Budget"   fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="received" name="Received" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="spent"    name="Spent"    fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Budget vs Received</h4></div><EmptyChart /></div>
        )}
      </div>

      {/* Projects Breakdown Table */}
      {projects.length > 0 && (
        <div className="dashboard-section" ref={breakdownRef}>
          <h3 className="section-title"><Briefcase size={20} />Projects Breakdown
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#6b7280' }}>({projects.length} projects)</span>
          </h3>
          <div className="agg-table-wrapper">
            {/* Sticky header sits outside the scroll area */}
            <div className="agg-table-scroll">
              <table className="agg-projects-table">
                <colgroup>
                  <col style={{ minWidth: 200 }} />  {/* Project */}
                  <col style={{ minWidth: 140 }} />  {/* Group/Category */}
                  <col style={{ minWidth: 110 }} />  {/* Status */}
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
                    <th className="agg-th-left">Status</th>
                    <th className="agg-th-right">Order Value</th>
                    <th className="agg-th-right">Invoice Raised</th>
                    <th className="agg-th-right">Amount Received</th>
                    <th className="agg-th-right">Vendor Payments</th>
                    <th className="agg-th-right">Pending Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => {
                    const statusColors = { COMPLETED: '#22c55e', IN_PROGRESS: '#3b82f6', PLANNING: '#f59e0b', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444' };
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
                        <td className="agg-td-left">
                          <span className="agg-status-badge" style={{
                            background: (statusColors[p.status] || '#94a3b8') + '22',
                            color: statusColors[p.status] || '#94a3b8',
                          }}>{p.status?.replace(/_/g, ' ')}</span>
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
                    <td colSpan={3} className="agg-td-left agg-tfoot-label">TOTAL — {projects.length} projects</td>
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
  );
};

// ─── Single-project dashboard helpers ────────────────────────────────────────
const calculateProgress = (dashboardData) => {
  if (!dashboardData?.startDate || !dashboardData?.endDate) return 0;
  const start = new Date(dashboardData.startDate);
  const end   = new Date(dashboardData.endDate);
  const now   = new Date();
  return Math.min(Math.max(((now - start) / (end - start)) * 100, 0), 100).toFixed(1);
};
const getStatusColor = (s) => ({
  PLANNING: '#3b82f6', IN_PROGRESS: '#22c55e', COMPLETED: '#8b5cf6',
  ON_HOLD: '#f59e0b', CANCELLED: '#ef4444',
}[s] || '#94a3b8');

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const ProjectDashboard = () => {
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showError } = useToast();
  const [loading, setLoading]           = useState(false);
  const [dashboardData, setDashboardData] = useState(null);   // single-project data
  const [aggData, setAggData]           = useState(null);      // aggregated data
  const [showSpentModal, setShowSpentModal] = useState(false); // Amount Spent breakdown modal
  const [showCashModal,  setShowCashModal]  = useState(false); // Cash Deficit/In-Hand breakdown modal
  const [showProfitModal, setShowProfitModal] = useState(false); // Profit breakdown modal

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

  // ── React to filter changes ────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'PROJECT') fetchProjectDashboard();
    else fetchAggregated();
  }, [mode, projectId, groupName, subGroupName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (mode === 'PROJECT') fetchProjectDashboard();
    else fetchAggregated();
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
            <button className="dashboard-refresh-btn" onClick={handleRefresh} disabled={loading}>
              <RefreshCw size={18} /> Refresh
            </button>
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
              <div className="project-progress-section">
                <div className="progress-circle">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle cx="60" cy="60" r="54" fill="none"
                      stroke={getStatusColor(dashboardData.status)} strokeWidth="12"
                      strokeDasharray={`${calculateProgress(dashboardData) * 3.39} 339`}
                      strokeLinecap="round" transform="rotate(-90 60 60)" />
                    <text x="60" y="55" textAnchor="middle" className="progress-value">{calculateProgress(dashboardData)}%</text>
                    <text x="60" y="70" textAnchor="middle" className="progress-label">Complete</text>
                  </svg>
                </div>
              </div>
            </div>
            <div className="project-overview-details">
              {[
                [<Calendar size={18} />, 'Start Date',            formatDate(dashboardData.startDate)],
                [<Calendar size={18} />, 'End Date',              formatDate(dashboardData.endDate)],
                [<User size={18} />,     'Project Manager',       dashboardData.manager || 'Not Assigned'],
                [<IndianRupee size={18} />, 'Total Project Value', formatCurrency(dashboardData.budget)],
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
                <h3 className="section-title"><IndianRupee size={20} />Project Financial Overview</h3>
                <div className="kpi-grid">
                  {[
                    { icon: <Wallet size={36} />, color: '#3b82f6', val: fmtKpi(dashboardData.financialData.totalProjectValue), label: 'Contract Value', sub: 'Project budget (agreed)' },
                    { icon: <FileText size={36} />, color: '#6366f1', val: fmtKpi(dashboardData.financialData.amountToBeReceived), label: 'Total Invoiced', sub: 'Raised to client (incl. GST)' },
                    {
                      icon: <TrendingDown size={36} />, color: '#f59e0b',
                      val: fmtKpi((dashboardData.financialData.totalSpent || 0) + (dashboardData.financialData.totalEmployeeExpenses || 0)),
                      label: 'Amount Spent',
                      sub: 'Paid to vendors + Approved Expenses',
                      clickable: true,
                    },
                    {
                      icon: <Target size={36} />, color: (dashboardData.financialData.projectedProfit ?? 0) >= 0 ? '#22c55e' : '#ef4444',
                      val: fmtKpi(dashboardData.financialData.projectedProfit),
                      label: 'Net Profit',
                      sub: `${Math.abs(dashboardData.financialData.profitMargin ?? 0).toFixed(1)}% margin · Invoiced(excl.GST) − Bills(excl.GST) − Expenses − Net GST`,
                      clickable: true,
                      onClick: () => setShowProfitModal(true),
                    },
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
              </div>

              {/* Client Billing */}
              <div className="dashboard-section">
                <h3 className="section-title"><Receipt size={20} />Client Billing &amp; Receipts</h3>
                <div className="metrics-grid">
                  {[
                    { icon: <IndianRupee size={24} />, title: 'Billed Amount',       val: formatCurrency(dashboardData.financialData.amountToBeReceived), sub: ['Total Invoice Raised'], cls: [] },
                    { icon: <CheckCircle size={24} />, title: 'Amount Received',     val: formatCurrency(dashboardData.financialData.amountReceived),      sub: [`${dashboardData.financialData.billingPercentage?.toFixed(1)}% Received`, 'From client payments'], cls: ['success', null] },
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

              {dashboardData.financialData.isCompleted && (
                <div className="dashboard-section" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
                  <h3 className="section-title" style={{ color: '#fff' }}><CheckCircle size={20} /> Project Completed — Final Profit Summary</h3>
                  <div className="metrics-grid">
                    {[
                      ['Contract Value (Budget)',   formatCurrency(dashboardData.financialData.totalProjectValue),  'Agreed project contract amount'],
                      ['Total Invoiced (excl. GST)', formatCurrency(dashboardData.financialData.amountToBeReceivedExclGST ?? dashboardData.financialData.amountToBeReceived), 'Basis for profit — invoiced excl. GST'],
                      ['− Procurement Bills (excl. GST)', formatCurrency(dashboardData.financialData.totalPayableExclGST ?? dashboardData.financialData.totalPayable), 'Total vendor bills excl. GST'],
                      ['− Approved Expenses',      formatCurrency(dashboardData.financialData.totalEmployeeExpenses ?? 0), 'Approved employee & project expenses'],
                      [(parseFloat(dashboardData.financialData.netGST)||0) >= 0 ? '− Net GST Liability' : '+ Net GST ITC Benefit',
                        formatCurrency(Math.abs(parseFloat(dashboardData.financialData.netGST)||0)),
                        'Invoice GST collected − Vendor GST paid (ITC)'],
                      ['= Net Profit',             formatCurrency(dashboardData.financialData.projectedProfit),   'Invoiced − Bills − Expenses − Net GST'],
                      ['Profit Margin',            `${Math.abs(dashboardData.financialData.profitMargin ?? 0).toFixed(1)}%`,    '(Profit ÷ Total Invoiced excl. GST) × 100'],
                    ].map(([title, val, sub], i) => (
                      <div key={i} className="metric-card" style={{ background: 'rgba(255,255,255,.1)', border: 'none' }}>
                        <div className="metric-header"><span className="metric-title" style={{ color: '#fff' }}>{title}</span></div>
                        <div className="metric-value" style={{ color: '#fff' }}>{val}</div>
                        <div className="metric-breakdown"><span className="metric-item" style={{ color: 'rgba(255,255,255,.8)' }}>{sub}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
          <div className="dashboard-charts-grid">
            {dashboardData.spendingTrend?.length > 0 ? (
              <div className="chart-card full-width">
                <div className="chart-header"><h4 className="chart-title"><TrendingUp size={18} />Monthly Spending Trend</h4></div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={dashboardData.spendingTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" /><YAxis />
                    <Tooltip formatter={v => formatCurrency(v)} /><Legend />
                    <Area dataKey="spending" fill="#3b82f6" stroke="#3b82f6" fillOpacity={.3} />
                    <Bar dataKey="orders" fill="#22c55e" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card full-width"><div className="chart-header"><h4 className="chart-title">Monthly Spending Trend</h4></div><EmptyChart message="No spending data available" /></div>
            )}

            {dashboardData.procurementData?.posByStatus?.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header"><h4 className="chart-title">PO Status Distribution</h4></div>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie data={dashboardData.procurementData.posByStatus} cx="50%" cy="50%" labelLine={false}
                      label={e => `${e.name} (${e.value})`} outerRadius={80} dataKey="value">
                      {dashboardData.procurementData.posByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card"><div className="chart-header"><h4 className="chart-title">PO Status Distribution</h4></div><EmptyChart message="No POs yet" /></div>
            )}

            {dashboardData.procurementData?.categoryDistribution?.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header"><h4 className="chart-title">Top Categories</h4></div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.procurementData.categoryDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" /><YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Bar dataKey="value" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
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

          {/* Recent Activities */}
          {dashboardData.recentActivities?.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title"><Activity size={20} />Recent Activities</h3>
              <div className="activities-timeline scrollable-block">
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
          )}

          {/* Project Timeline */}
          {dashboardData.projectTimeline?.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title"><Clock size={20} />Project Timeline</h3>
              <div className="project-timeline-container scrollable-block">
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
          )}
        </>
      )}

      {/* ─── Amount Spent Breakdown Modal ──────────────────────────────────── */}
      {showSpentModal && dashboardData?.financialData && (
        <div className="spent-modal-overlay" onClick={() => setShowSpentModal(false)}>
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
                  <span>Procurement (Vendor Bills)</span>
                </div>
                <div className="spent-row">
                  <span className="spent-row-label">Total paid to vendors</span>
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
                <span className="spent-grand-label">Grand Total Spent</span>
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
        const isProfit     = (fd.projectedProfit ?? 0) >= 0;

        // ── All values from backend — no frontend recalculation ──────────────
        const cashInflow   = parseFloat(fd.amountReceived)        || 0;
        const paidVendors  = parseFloat(fd.amountPaid)            || 0;
        const expenses     = parseFloat(fd.totalEmployeeExpenses) || 0;
        const invoiceGST   = parseFloat(fd.invoiceGSTCollected)   || 0;  // GST billed to client
        const vendorGST    = parseFloat(fd.procurementGSTPaid)    || 0;  // ITC from vendor bills
        const netGST       = parseFloat(fd.netGST)                || 0;  // invoiceGST - vendorGST
        // cashOutflow = what backend used: paid vendors + expenses + max(0, netGST)
        const cashOutflow  = paidVendors + expenses + Math.max(0, netGST);

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
                    <span className="spent-block-total" style={{ color: '#b91c1c' }}>− {formatCurrency(cashOutflow)}</span>
                  </div>

                  {/* Paid to vendors */}
                  <div className="spent-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <span className="spent-row-label" style={{ fontWeight: 600, color: '#374151' }}>Paid to Vendors</span>
                    <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 700 }}>− {formatCurrency(paidVendors)}</span>
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
                    <span className="spent-row-amount" style={{ color: '#dc2626', fontWeight: 700 }}>− {formatCurrency(expenses)}</span>
                  </div>

                  {/* Net GST Liability */}
                  <div className="spent-row" style={{ borderTop: '1px solid #f1f5f9', background: '#fffbeb' }}>
                    <span className="spent-row-label" style={{ fontWeight: 600, color: '#92400e' }}>
                      Net GST Liability
                      <span style={{ fontWeight: 400, fontSize: 11, color: '#78716c', display: 'block' }}>Invoice GST collected − Vendor GST paid (ITC)</span>
                    </span>
                    <span className="spent-row-amount" style={{ color: netGST > 0 ? '#d97706' : '#15803d', fontWeight: 700 }}>
                      {netGST > 0 ? `− ${formatCurrency(netGST)}` : `+ ${formatCurrency(Math.abs(netGST))} (ITC benefit)`}
                    </span>
                  </div>
                  <div className="spent-row spent-row--sub" style={{ background: '#fffbeb' }}>
                    <span className="spent-row-label">Invoice GST collected from client</span>
                    <span className="spent-row-amount">{formatCurrency(invoiceGST)}</span>
                  </div>
                  <div className="spent-row spent-row--sub" style={{ background: '#fffbeb' }}>
                    <span className="spent-row-label">Vendor GST paid (Input Tax Credit)</span>
                    <span className="spent-row-amount" style={{ color: '#15803d' }}>− {formatCurrency(vendorGST)}</span>
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
                {isCompleted && (
                  <div className="spent-block" style={{ border: `1.5px solid ${isProfit ? '#bbf7d0' : '#fecaca'}` }}>
                    <div className="spent-block-header" style={{ background: isProfit ? '#f0fdf4' : '#fef2f2', color: isProfit ? '#15803d' : '#b91c1c', borderBottom: `1px solid ${isProfit ? '#bbf7d0' : '#fecaca'}` }}>
                      <CheckCircle size={15} />
                      <span style={{ fontWeight: 700 }}>✅ Project Completed — Final Profit</span>
                    </div>
                    <div className="spent-row">
                      <span className="spent-row-label">Total Invoiced (excl. GST)</span>
                      <span className="spent-row-amount" style={{ color: '#15803d' }}>{formatCurrency((fd.amountToBeReceivedExclGST ?? fd.amountToBeReceived) || 0)}</span>
                    </div>
                    <div className="spent-row">
                      <span className="spent-row-label">− Procurement Bills (excl. GST)</span>
                      <span className="spent-row-amount" style={{ color: '#dc2626' }}>− {formatCurrency((fd.totalPayableExclGST ?? fd.totalPayable) || 0)}</span>
                    </div>
                    <div className="spent-row">
                      <span className="spent-row-label">− Approved Expenses</span>
                      <span className="spent-row-amount" style={{ color: '#dc2626' }}>− {formatCurrency(expenses)}</span>
                    </div>
                    <div className="spent-row">
                      <span className="spent-row-label">
                        {netGST >= 0 ? '− Net GST Liability' : '+ Net GST (ITC benefit)'}
                        <span style={{ fontWeight: 400, fontSize: 10, color: '#78716c', display: 'block' }}>Invoice GST collected − Vendor GST paid</span>
                      </span>
                      <span className="spent-row-amount" style={{ color: netGST >= 0 ? '#d97706' : '#15803d' }}>
                        {netGST >= 0
                          ? `− ${formatCurrency(netGST)}`
                          : `+ ${formatCurrency(Math.abs(netGST))}`}
                      </span>
                    </div>
                    <div className="spent-row" style={{ background: isProfit ? '#f0fdf4' : '#fef2f2', borderTop: `2px solid ${isProfit ? '#bbf7d0' : '#fecaca'}` }}>
                      <span className="spent-row-label" style={{ fontWeight: 800, fontSize: 14, color: isProfit ? '#15803d' : '#b91c1c' }}>
                        {isProfit ? '🟢 Net Profit' : '🔴 Net Loss'}
                      </span>
                      <span className="spent-row-amount" style={{ fontSize: 16, fontWeight: 800, color: isProfit ? '#15803d' : '#b91c1c' }}>
                        {isProfit ? '' : '− '}{formatCurrency(Math.abs(fd.projectedProfit ?? 0))}
                        <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 6, color: '#6b7280' }}>({Math.abs(fd.profitMargin ?? 0).toFixed(1)}% margin)</span>
                      </span>
                    </div>
                  </div>
                )}

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
      {showProfitModal && dashboardData?.financialData && (() => {
        const fd = dashboardData.financialData;
        const isProfit = (fd.projectedProfit ?? 0) >= 0;
        const accentColor = isProfit ? '#16a34a' : '#dc2626';
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
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={18} style={{ color: accentColor }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Profit Breakdown</span>
                </div>
                <button onClick={() => setShowProfitModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', padding: 4 }}><X size={18} /></button>
              </div>

              {/* Formula pill */}
              <div style={{ margin: '10px 14px 4px', padding: '7px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11.5, color: '#475569', textAlign: 'center' }}>
                Invoiced (excl. GST) &nbsp;−&nbsp; Procurement (excl. GST) &nbsp;−&nbsp; Expenses &nbsp;−&nbsp; Net GST &nbsp;=&nbsp; <strong style={{ color: accentColor }}>Net Profit</strong>
              </div>

              {/* P&L Waterfall */}
              <div style={{ margin: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <Row label="Total Invoiced to Client (excl. GST)" value={formatCurrency(fd.amountToBeReceivedExclGST ?? fd.amountToBeReceived ?? 0)} color="#16a34a" bold />
                <Row label="− Procurement Bills (excl. GST)" value={`− ${formatCurrency(fd.totalPayableExclGST ?? fd.totalPayable ?? 0)}`} color="#dc2626" borderTop />
                <Row label="− Approved Expenses (employee)" value={`− ${formatCurrency(fd.totalEmployeeExpenses || 0)}`} color="#dc2626" borderTop />
                <Row
                  label={netGST >= 0 ? '− Net GST Liability' : '+ Net GST (ITC benefit)'}
                  value={netGST >= 0 ? `− ${formatCurrency(netGST)}` : `+ ${formatCurrency(Math.abs(netGST))}`}
                  color={netGST >= 0 ? '#d97706' : '#16a34a'} borderTop />
                <Row
                  label={isProfit ? '= Net Profit' : '= Net Loss'}
                  value={isProfit ? formatCurrency(fd.projectedProfit) : `− ${formatCurrency(Math.abs(fd.projectedProfit ?? 0))}`}
                  color={accentColor} bold borderTop
                  bg={isProfit ? '#f0fdf4' : '#fef2f2'}
                  fontSize={14}
                />
                <div style={{ padding: '4px 14px 8px', background: isProfit ? '#f0fdf4' : '#fef2f2', borderTop: '1px dashed #d1fae5' }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Net Margin: <strong style={{ color: accentColor }}>{Math.abs(fd.profitMargin ?? 0).toFixed(1)}% {!isProfit ? '(loss)' : ''}</strong></span>
                </div>
              </div>

              {/* GST breakdown */}
              <div style={{ margin: '0 14px 14px', border: '1px solid #bfdbfe', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#eff6ff', padding: '7px 14px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 5 }}><Percent size={13} /> Net GST Detail</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: netGST >= 0 ? '#d97706' : '#16a34a' }}>
                    {netGST >= 0 ? `−${formatCurrency(netGST)}` : `+${formatCurrency(Math.abs(netGST))} ITC`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', padding: '10px 0 8px' }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 2 }}>Invoice GST</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{formatCurrency(invGST)}</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 2 }}>Vendor GST (ITC)</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>−{formatCurrency(procGST)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 2 }}>Net {netGST >= 0 ? 'Payable' : 'ITC Benefit'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: netGST >= 0 ? '#d97706' : '#16a34a' }}>{formatCurrency(Math.abs(netGST))}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', padding: '0 14px 8px', textAlign: 'center' }}>
                  GST collected from client is a tax liability — deducted from profit
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default ProjectDashboard;