import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, IndianRupee, Package, FileText, Users,
  Calendar, Clock, AlertCircle, CheckCircle, XCircle, Activity,
  Briefcase, ShoppingCart, BarChart3, PieChart, Target, Zap,
  MapPin, Building2, Phone, Mail, User, Percent, ArrowUp, ArrowDown,
  AlertTriangle, Download, RefreshCw, Receipt, CreditCard, Wallet,
  Plane, Utensils, MapPin as MapPinIcon, Hotel, Eye, ChevronDown, ChevronUp, X
} from 'lucide-react';
import '../pages-css/ProjectDashboard1.css';
import GroupProjectFilter from "../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "../components/Dropdowns/useGroupProjectFilters.js";
import { useAuth } from "../hooks/useAuth.js";
import useToast from '../hooks/useToast';
import ToastContainer from '../components/Notification_Toast/ToastContainer.js';
import CrmPreloader from "../components/preLoader.js";
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  ComposedChart
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// ─── helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const value = Number(amount);
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const formatDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
  : 'N/A';
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

// ─── Expense Dashboard Block ──────────────────────────────────────────────────
const ExpenseDashboardSection = ({ expenseData, projectId }) => {
  const [expanded, setExpanded] = useState(false);
  const [userModal, setUserModal] = useState(false);

  if (!expenseData) return null;

  const {
    totalExpenses, approvedExpenses, pendingExpenses, pendingApprovals,
    travelAndSiteVisit, totalCommission, approvedThisMonth,
    totalAdvances, unsettledAdvances,
    userBreakdown = [], categoryBreakdown = [], recentExpenses = [],
  } = expenseData;

  const categoryIconMap = {
    Travel: <Plane size={14} />,
    'Site Visit': <MapPinIcon size={14} />,
    Accommodation: <Hotel size={14} />,
    Food: <Utensils size={14} />,
    Commission: <Users size={14} />,
    Miscellaneous: <Briefcase size={14} />,
  };

  const expenseKpis = [
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), color: '#ef4444', icon: <IndianRupee size={20} /> },
    { label: 'Approved', value: formatCurrency(approvedExpenses), color: '#22c55e', icon: <CheckCircle size={20} /> },
    { label: 'Pending', value: formatCurrency(pendingExpenses), color: '#f59e0b', icon: <Clock size={20} /> },
    { label: 'Travel & Site Visit', value: formatCurrency(travelAndSiteVisit), color: '#3b82f6', icon: <Plane size={20} /> },
    { label: 'Commission', value: formatCurrency(totalCommission), color: '#8b5cf6', icon: <Users size={20} /> },
    { label: 'Advances Given', value: formatCurrency(totalAdvances), color: '#06b6d4', icon: <Wallet size={20} /> },
  ];

  // Prepare category chart data
  const catChartData = categoryBreakdown.map(c => ({
    name: c.category?.replace('_', ' ') || 'Other',
    value: Number(c.totalAmount || 0),
    count: c.count,
  }));

  return (
    <div className="db-expense-block">
      {/* Section Header */}
      <div className="db-expense-header" onClick={() => setExpanded(v => !v)}>
        <div className="db-expense-title-row">
          <h3 className="db-section-title">
            <Receipt size={20} />
            Employee Cost &amp; Expense Management
          </h3>
          <div className="db-expense-header-pills">
            {pendingApprovals > 0 && (
              <span className="db-pill db-pill-warning">
                <Clock size={12} /> {pendingApprovals} pending approval{pendingApprovals !== 1 && 's'}
              </span>
            )}
            {unsettledAdvances > 0 && (
              <span className="db-pill db-pill-info">
                <Wallet size={12} /> {formatCurrency(unsettledAdvances)} unsettled advance
              </span>
            )}
          </div>
        </div>
        <button className="db-expand-btn">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Mini KPI Strip (always visible) */}
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

      {/* Expanded Content */}
      {expanded && (
        <div className="db-expense-expanded">
          {/* Employee Breakdown */}
          {userBreakdown.length > 0 && (
            <div className="db-expense-sub-section">
              <div className="db-sub-header">
                <h4><Users size={15} /> Employee Cost Breakdown</h4>
                <button className="db-link-btn" onClick={(e) => { e.stopPropagation(); setUserModal(true); }}>
                  View All <Eye size={13} />
                </button>
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

          {/* Category Chart + Recent Expenses (side by side) */}
          <div className="db-expense-bottom-row">
            {/* Category Breakdown Chart */}
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
                      {catChartData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent Expenses List */}
            {recentExpenses.length > 0 && (
              <div className="db-recent-exp-card">
                <h4><Clock size={15} /> Recent Expenses</h4>
                <div className="db-recent-exp-list">
                  {recentExpenses.slice(0, 5).map((exp, i) => (
                    <div key={i} className="db-recent-exp-item">
                      <div className="db-recent-cat-icon">
                        {categoryIconMap[exp.category] || <FileText size={14} />}
                      </div>
                      <div className="db-recent-info">
                        <div className="db-recent-name">{exp.paidByName || 'Unknown'}</div>
                        <div className="db-recent-meta">
                          {exp.category} · {formatDate(exp.tripDate)}
                        </div>
                      </div>
                      <div className="db-recent-right">
                        <div className="db-recent-amount">{formatCurrency(exp.amount)}</div>
                        <span className={`db-status-pill db-status-${exp.status?.toLowerCase()}`}>{exp.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {projectId && (
                  <a
                    href={`/finance/expenses?projectId=${projectId}`}
                    className="db-view-all-link"
                    onClick={e => e.stopPropagation()}
                  >
                    View all expenses →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Employee Detail Modal ── */}
      {userModal && (
        <div className="db-modal-overlay" onClick={() => setUserModal(false)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3><Users size={18} /> All Employee Expenses</h3>
              <button onClick={() => setUserModal(false)}><X size={18} /></button>
            </div>
            <div className="db-modal-body">
              <table className="db-emp-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Expenses</th>
                    <th>Total</th>
                    <th>Approved</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {userBreakdown.map((u, i) => (
                    <tr key={i}>
                      <td>
                        <div className="db-emp-table-user">
                          <div className="db-emp-avatar sm">{(u.userName || 'U')[0].toUpperCase()}</div>
                          {u.userName || 'Unknown'}
                        </div>
                      </td>
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const ProjectDashboard = () => {
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    if (projectId) fetchDashboardData();
    else setDashboardData(null);
  }, [projectId]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json',
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/dashboard`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else if (response.status === 404) {
        showError('Project not found'); setDashboardData(null);
      } else {
        showError('Failed to load dashboard'); setDashboardData(null);
      }
    } catch (err) {
      showError('Network error. Please check connection.'); setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    if (!dashboardData?.startDate || !dashboardData?.endDate) return 0;
    const start = new Date(dashboardData.startDate);
    const end = new Date(dashboardData.endDate);
    const now = new Date();
    return Math.min(Math.max(((now - start) / (end - start)) * 100, 0), 100).toFixed(1);
  };

  const getStatusColor = (s) => ({
    PLANNING: '#3b82f6', IN_PROGRESS: '#22c55e', COMPLETED: '#8b5cf6',
    ON_HOLD: '#f59e0b', CANCELLED: '#ef4444',
  }[s] || '#94a3b8');

  const EmptyChart = ({ message = 'No data available' }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}>
        <BarChart3 size={48} style={{ margin: '0 auto 10px', opacity: .3 }} />
        <p>{message}</p>
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
            <GroupProjectFilter groupValue={groupName} subGroupValue={subGroupName}
              projectValue={projectId} onChange={updateFilters} />
            {projectId && (
              <button className="dashboard-refresh-btn" onClick={fetchDashboardData} disabled={loading}>
                <RefreshCw size={18} /> Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {!projectId ? (
        <div className="project-dashboard-empty-state">
          <Target size={80} className="empty-state-icon" />
          <h2>Select a Project to View Dashboard</h2>
          <p>Choose a project from the dropdown above to see comprehensive analytics</p>
        </div>
      ) : !dashboardData && !loading ? (
        <div className="project-dashboard-empty-state">
          <AlertCircle size={80} className="empty-state-icon" />
          <h2>No Data Available</h2>
          <p>Unable to load dashboard data. Please try again.</p>
          <button onClick={fetchDashboardData} className="dashboard-refresh-btn">
            <RefreshCw size={18} /> Retry
          </button>
        </div>
      ) : dashboardData ? (
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
                      strokeDasharray={`${calculateProgress() * 3.39} 339`}
                      strokeLinecap="round" transform="rotate(-90 60 60)" />
                    <text x="60" y="55" textAnchor="middle" className="progress-value">{calculateProgress()}%</text>
                    <text x="60" y="70" textAnchor="middle" className="progress-label">Complete</text>
                  </svg>
                </div>
              </div>
            </div>
            <div className="project-overview-details">
              {[
                [<Calendar size={18} />, 'Start Date', formatDate(dashboardData.startDate)],
                [<Calendar size={18} />, 'End Date', formatDate(dashboardData.endDate)],
                [<User size={18} />, 'Project Manager', dashboardData.manager || 'Not Assigned'],
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
                    { icon: <Wallet size={36} />, color: '#3b82f6', val: formatCurrency(dashboardData.financialData.totalProjectValue), label: 'Total Project Value', sub: 'Contract budget' },
                    {
                      icon: <TrendingDown size={36} />, color: '#f59e0b', val: formatCurrency(dashboardData.financialData.totalSpent),
                      label: 'Amount Spent', sub: `Paid to vendors · ${dashboardData.financialData.budgetUtilizationPercent?.toFixed(1)}% of budget`
                    },
                    {
                      icon: <Target size={36} />, color: '#8b5cf6', val: formatCurrency(dashboardData.financialData.projectedProfit),
                      label: dashboardData.financialData.isCompleted ? 'Actual Profit' : 'Projected Profit',
                      sub: dashboardData.financialData.isCompleted ? `${dashboardData.financialData.profitMargin?.toFixed(1)}% margin · Final` :
                        `Project still in progress · ${dashboardData.financialData.profitMargin?.toFixed(1)}% margin`
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

                  {/* Cash Flow Card */}
                  <div className="kpi-card" style={{
                    borderTopColor: (dashboardData.financialData.cashDeficit > 0) ? '#ef4444' : '#22c55e',
                  }}>
                    <div className="kpi-icon" style={{
                      color: (dashboardData.financialData.cashDeficit > 0) ? '#ef4444' : '#22c55e',
                    }}><Wallet size={36} /></div>
                    <div className="kpi-content">
                      <div className="kpi-value">
                        {formatCurrency(dashboardData.financialData.cashDeficit > 0
                          ? dashboardData.financialData.cashDeficit
                          : dashboardData.financialData.cashInHand || 0)}
                      </div>
                      <div className="kpi-label">
                        {dashboardData.financialData.cashDeficit > 0 ? 'Cash Deficit' : 'Cash in Hand'}
                      </div>
                      <div className="kpi-subtitle">
                        {dashboardData.financialData.cashDeficit > 0 ? 'Paid more than received' : 'Received minus paid'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Billing */}
              <div className="dashboard-section">
                <h3 className="section-title"><Receipt size={20} />Client Billing &amp; Receipts</h3>
                <div className="metrics-grid">
                  {[
                    { icon: <IndianRupee size={24} />, title: 'Billed Amount', val: formatCurrency(dashboardData.financialData.amountToBeReceived), sub: ['Total Invoice Raised'], cls: [] },
                    {
                      icon: <CheckCircle size={24} />, title: 'Amount Received', val: formatCurrency(dashboardData.financialData.amountReceived),
                      sub: [`${dashboardData.financialData.billingPercentage?.toFixed(1)}% Received`, 'From client payments'], cls: ['success', null]
                    },
                    {
                      icon: <Clock size={24} />, title: 'Pending Receipts', val: formatCurrency(dashboardData.financialData.pendingReceipts),
                      sub: [`${(100 - (dashboardData.financialData.billingPercentage || 0)).toFixed(1)}% Pending`, 'Yet to collect'], cls: ['warning', null]
                    },
                    {
                      icon: <TrendingUp size={24} />, title: 'Collection Progress', val: `${dashboardData.financialData.billingPercentage?.toFixed(1)}%`,
                      sub: null, progress: dashboardData.financialData.billingPercentage, progressClass: 'success'
                    },
                  ].map((m, i) => (
                    <div key={i} className="metric-card">
                      <div className="metric-header">{m.icon}<span className="metric-title">{m.title}</span></div>
                      <div className="metric-value">{m.val}</div>
                      {m.sub && (
                        <div className="metric-breakdown">
                          {m.sub.map((s, j) => s && <span key={j} className={`metric-item ${m.cls?.[j] || ''}`}>{s}</span>)}
                        </div>
                      )}
                      {m.progress !== undefined && (
                        <div className="metric-breakdown">
                          <div className="progress-bar-container">
                            <div className={`progress-bar-fill ${m.progressClass}`} style={{ width: `${m.progress || 0}%` }} />
                          </div>
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
                    { icon: <IndianRupee size={24} />, title: 'Total Procurement Cost', val: formatCurrency(dashboardData.financialData.totalPayable), sub: ['Total bills from vendors'], cls: [] },
                    {
                      icon: <CheckCircle size={24} />, title: 'Amount Paid', val: formatCurrency(dashboardData.financialData.amountPaid),
                      sub: [`${dashboardData.financialData.paymentPercentage?.toFixed(1)}% Paid`, 'Same as Amount Spent above'], cls: ['success', null]
                    },
                    {
                      icon: <AlertCircle size={24} />, title: 'Pending Payments', val: formatCurrency(dashboardData.financialData.pendingPayments),
                      sub: [`${(100 - (dashboardData.financialData.paymentPercentage || 0)).toFixed(1)}% Pending`, 'Due to vendors'], cls: ['danger', null]
                    },
                    {
                      icon: <Activity size={24} />, title: 'Payment Progress', val: `${dashboardData.financialData.paymentPercentage?.toFixed(1)}%`,
                      sub: null, progress: dashboardData.financialData.paymentPercentage, progressClass: 'warning'
                    },
                  ].map((m, i) => (
                    <div key={i} className="metric-card">
                      <div className="metric-header">{m.icon}<span className="metric-title">{m.title}</span></div>
                      <div className="metric-value">{m.val}</div>
                      {m.sub && (
                        <div className="metric-breakdown">
                          {m.sub.map((s, j) => s && <span key={j} className={`metric-item ${m.cls?.[j] || ''}`}>{s}</span>)}
                        </div>
                      )}
                      {m.progress !== undefined && (
                        <div className="metric-breakdown">
                          <div className="progress-bar-container">
                            <div className={`progress-bar-fill ${m.progressClass}`} style={{ width: `${m.progress || 0}%` }} />
                          </div>
                          <span className="metric-item">Vendor payment completion</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* ── EXPENSE BLOCK (NEW) ───────────────────────────────────────── */}
              <ExpenseDashboardSection
                expenseData={dashboardData.expenseData}
                projectId={projectId}
              />
              {/* Profit info banners */}
              {!dashboardData.financialData.isCompleted && (
                <div className="dashboard-section" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Clock size={24} /><h3 style={{ margin: 0, fontSize: 18 }}>Project In Progress</h3>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: 16, fontSize: 14, lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 8px' }}><strong>Projected Profit:</strong></p>
                    <p style={{ fontFamily: 'monospace', margin: '0 0 8px' }}>
                      {formatCurrency(dashboardData.financialData.totalProjectValue)} (Budget) - {formatCurrency(dashboardData.financialData.totalSpent)} (Spent) = {formatCurrency(dashboardData.financialData.projectedProfit)}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, opacity: .9 }}>ℹ️ Projection — actual profit calculated on project completion.</p>
                  </div>
                </div>
              )}

              {dashboardData.financialData.isCompleted && (
                <div className="dashboard-section" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
                  <h3 className="section-title" style={{ color: '#fff' }}>
                    <CheckCircle size={20} /> Project Completed — Final Summary
                  </h3>
                  <div className="metrics-grid">
                    {[
                      ['Total Revenue', formatCurrency(dashboardData.financialData.amountReceived), 'Received from client'],
                      ['Total Cost', formatCurrency(dashboardData.financialData.totalSpent), 'Paid to vendors'],
                      ['Actual Profit', formatCurrency(dashboardData.financialData.projectedProfit), 'Revenue - Cost'],
                      ['Profit Margin', `${dashboardData.financialData.profitMargin?.toFixed(1)}%`, '(Profit / Revenue) × 100'],
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
                  <div className="metric-breakdown">
                    <span className="metric-item success">{dashboardData.procurementData.approvedQuotations || 0} Approved</span>
                  </div>
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
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Legend />
                    <Area dataKey="spending" fill="#3b82f6" stroke="#3b82f6" fillOpacity={.3} />
                    <Bar dataKey="orders" fill="#22c55e" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card full-width">
                <div className="chart-header"><h4 className="chart-title">Monthly Spending Trend</h4></div>
                <EmptyChart message="No spending data available" />
              </div>
            )}

            {dashboardData.procurementData?.posByStatus?.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header"><h4 className="chart-title">PO Status Distribution</h4></div>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie data={dashboardData.procurementData.posByStatus}
                      cx="50%" cy="50%" labelLine={false}
                      label={e => `${e.name} (${e.value})`} outerRadius={80} dataKey="value">
                      {dashboardData.procurementData.posByStatus.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
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
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
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
                      <div className="vendor-meta">
                        <span>{v.totalOrders} orders</span>
                        {v.rating > 0 && <span>⭐ {v.rating}</span>}
                      </div>
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
          )}

          {/* Project Timeline */}
          {dashboardData.projectTimeline?.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title"><Clock size={20} />Project Timeline</h3>
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
          )}
        </>
      ) : null}
    </div>
  );
};

export default ProjectDashboard;