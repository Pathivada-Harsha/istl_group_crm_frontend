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
  ComposedChart, Treemap, RadialBarChart, RadialBar
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

/**
 * Renders a pointer line + label only for slices whose value >= minPct.
 * Small slices are silently skipped to avoid clutter.
 */
const renderPieLabel = (minPct = 5) => ({
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
    ccms:           { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', icon: '📦', label: 'CCMS' },
    mcms:           { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', icon: '🔧', label: 'MCMS' },
    itms:           { bg: '#fdf4ff', border: '#a855f7', text: '#7e22ce', icon: '🚦', label: 'ITMS' },
    solar_rooftop:  { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', icon: '☀️', label: 'Solar Rooftop' },
    solar_ground:   { bg: '#fff7ed', border: '#f97316', text: '#c2410c', icon: '🏭', label: 'Ground Mount' },
    solar_carports: { bg: '#f0f9ff', border: '#0ea5e9', text: '#0369a1', icon: '🅿️', label: 'Carports' },
    solar_wind:     { bg: '#ecfdf5', border: '#10b981', text: '#065f46', icon: '💨', label: 'Solar Wind' },
    default:        { bg: '#f8fafc', border: '#94a3b8', text: '#475569', icon: '📊', label: null },
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
  const gridCols = n === 1 ? '1fr' : n === 2 ? '1fr 1fr' : n === 3 ? '1fr 1fr 1fr' : n === 4 ? 'repeat(4,1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))';

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
                style={{ background: m.bg, border: `1.5px solid ${m.border}`, borderRadius: 8,
                  padding: '8px 12px 7px', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${m.border}44`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{m.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: m.text, textTransform: 'uppercase', letterSpacing: .5 }}>
                    {m.label || sg.subGroupName}
                  </span>
                </div>
                {wind && (km || kg) ? (
                  <div style={{ marginBottom: 5 }}>
                    {km && <div style={{ fontSize: 17, fontWeight: 800, color: m.text, lineHeight: 1.15 }}>{formatQty(km.quantity, 'Km')}</div>}
                    {kg && <div style={{ fontSize: 13, fontWeight: 600, color: m.text, opacity: .75, lineHeight: 1.2 }}>{formatQty(kg.quantity, 'Kg')}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 17, fontWeight: 800, color: m.text, lineHeight: 1.1, marginBottom: 5 }}>
                    {formatQty(sg.totalQuantity, sg.unit)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ background: m.border, color: '#fff', borderRadius: 9999, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={() => setActiveModal(null)}>
            <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: m.bg, borderRadius: '14px 14px 0 0' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Capacity Breakdown</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.text, marginTop: 2 }}>{m.icon} {m.label || activeModal.subGroupName}</div>
                  {wind ? (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {(activeModal.allUnitTotals || []).map((u, i) => (
                        <span key={i}><strong>{formatQty(u.quantity, u.unit)}</strong></span>
                      ))}
                      <span>· <strong>{activeModal.projectCount}</strong> project{activeModal.projectCount !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      Total <strong>{formatQty(activeModal.totalQuantity, activeModal.unit)}</strong> · <strong>{activeModal.projectCount}</strong> project{activeModal.projectCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <button onClick={() => setActiveModal(null)} style={{ background: '#fff', border: `1px solid ${m.border}`, borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: m.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ padding: '4px 0 8px' }}>
                {activeModal.projects.map((p, i) => {
                  const pct = activeModal.totalQuantity > 0 ? (p.quantity / activeModal.totalQuantity) * 100 : 0;
                  const breakdown = p.unitBreakdown || [];
                  const windKmEntry = wind ? breakdown.find(u => u.unit?.toLowerCase() === 'km') : null;
                  const windPct = windKmEntry && windKmTotal && Number(windKmTotal.quantity) > 0
                    ? (Number(windKmEntry.quantity) / Number(windKmTotal.quantity)) * 100 : pct;
                  return (
                    <div key={i} style={{ padding: '12px 22px', borderBottom: i < activeModal.projects.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.orderBookNo || p.projectId}
                          </div>
                          {p.orderTitle && (
                            <div style={{ fontSize: 12, color: '#1e293b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.orderTitle}
                            </div>
                          )}
                          {p.projectId && (
                            <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', borderRadius: 3, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>{p.projectId}</span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {wind && windKmEntry ? (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 700, color: m.text }}>{formatQty(windKmEntry.quantity, 'Km')}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{windPct.toFixed(1)}% of Km</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 700, color: m.text }}>{formatQty(p.quantity, p.unit)}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{pct.toFixed(1)}%</div>
                            </>
                          )}
                        </div>
                      </div>
                      {wind && breakdown.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                          {breakdown.map((u, bi) => (
                            <span key={bi} style={{ fontSize: 11, background: '#f1f5f9', border: `1px solid ${m.border}33`, borderRadius: 5, padding: '2px 7px', color: '#475569', fontWeight: 500 }}>
                              {formatQty(u.quantity, u.unit)}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
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

  // ── Status filter for the projects breakdown table ─────────────────────────
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [statusModal, setStatusModal]   = React.useState(null); // { status, projects[] }
  const [chartModal, setChartModal]     = React.useState(null); // { type: 'statusPie'|'budgetBar'|'contributionBar'|'contributionPie', title }
  const [updatingProject, setUpdatingProject] = React.useState(null); // projectUniqueId being updated
  const [editProgressModal, setEditProgressModal] = React.useState(null); // { project }
  const [epStatus, setEpStatus] = React.useState('IN_PROGRESS');
  const [epPct, setEpPct]       = React.useState(0);

  // Sync editable values whenever a project is selected for editing
  React.useEffect(() => {
    if (editProgressModal?.project) {
      setEpStatus(editProgressModal.project.status || 'IN_PROGRESS');
      setEpPct(autoProgress(editProgressModal.project));
    }
  }, [editProgressModal]);

  // ── Smart progress helpers ────────────────────────────────────────────────
  // Auto-compute progress from financial data when no manual value exists
  const autoProgress = (p) => {
    if (p.progressPercentage != null) return Number(p.progressPercentage);
    const budget = Number(p.budget) || 0;
    const received = Number(p.received) || 0;
    if (budget <= 0) return 0;
    return Math.min(100, Math.round((received / budget) * 100));
  };

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

  // Called when a KPI status card is clicked
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
          if (!map[key]) map[key] = { name: key, budget: 0, count: 0 };
          map[key].budget += Number(p.budget) || 0;
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
        if (!map[key]) map[key] = { name: key, budget: 0, count: 0 };
        map[key].budget += Number(p.budget) || 0;
        map[key].count  += 1;
      });
      return Object.values(map)
        .map(g => ({ ...g, pct: total > 0 ? +((g.budget / total) * 100).toFixed(1) : 0 }))
        .sort((a, b) => b.budget - a.budget);
    }

    // SUBGROUP scope — each project's contribution
    return projects
      .map(p => ({
        name: p.projectName?.slice(0, 22) + (p.projectName?.length > 22 ? '…' : ''),
        budget: Number(p.budget) || 0,
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

  // Top projects by budget for chart
  const topByBudget = [...projects]
    .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
    .slice(0, 6)
    .map(p => ({ name: p.projectName?.slice(0, 18) + (p.projectName?.length > 18 ? '…' : ''), budget: Number(p.budget || 0), received: Number(p.received || 0), spent: Number(p.spent || 0) }));

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
            { label: 'Total Projects', val: data.totalProjects,          color: '#3b82f6', icon: <Briefcase size={32} />,   statusKey: 'ALL' },
            { label: 'Not Started',    val: data.notStartedProjects,  color: '#64748b', icon: <Target size={32} />,      statusKey: 'NOT_STARTED' },
            { label: 'Planning',       val: data.planningProjects,    color: '#f59e0b', icon: <Target size={32} />,      statusKey: 'PLANNING' },
            { label: 'In Progress',    val: data.inProgressProjects,  color: '#06b6d4', icon: <Activity size={32} />,    statusKey: 'IN_PROGRESS' },
            { label: 'Completed',      val: data.completedProjects,   color: '#22c55e', icon: <CheckCircle size={32} />, statusKey: 'COMPLETED' },
            { label: 'On Hold',        val: data.onHoldProjects,      color: '#8b5cf6', icon: <Clock size={32} />,       statusKey: 'ON_HOLD' },
            { label: 'Cancelled',      val: data.cancelledProjects,   color: '#ef4444', icon: <XCircle size={32} />,     statusKey: 'CANCELLED' },
          ].filter(k => k.val > 0 || k.label === 'Total Projects').map((k, i) => (
            <div key={i} className="kpi-card" style={{ borderTopColor: k.color, cursor: projects.length > 0 ? 'pointer' : 'default',
              outline: statusFilter === k.statusKey ? `2px solid ${k.color}` : 'none' }}
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
        {/* Status Pie — click to expand */}
        {statusDistribution.length > 0 ? (
          <div className="chart-card chart-card-clickable" onClick={() => setChartModal({ type: 'statusPie' })}>
            <div className="chart-header">
              <h4 className="chart-title"><PieChart size={16} />Project Status Distribution</h4>
              <span className="chart-expand-hint">🔍 Click to expand</span>
            </div>
            <div style={{ height: 260, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart margin={{ top: 10, bottom: 30, left: 20, right: 20 }}>
                  <Pie data={statusDistribution} cx="50%" cy="44%" labelLine={false}
                    label={renderPieLabel(8)} outerRadius={75} dataKey="value">
                    {statusDistribution.map((entry, i) => (
                      <Cell key={i} fill={statusColor[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Status Distribution</h4></div><EmptyChart /></div>
        )}

        {/* Top Projects Budget Bar — click to expand */}
        {topByBudget.length > 0 ? (
          <div className="chart-card chart-card-clickable" onClick={() => setChartModal({ type: 'budgetBar' })}>
            <div className="chart-header">
              <h4 className="chart-title"><BarChart3 size={16} />Top Projects — Budget vs Received</h4>
              <span className="chart-expand-hint">🔍 Click to expand</span>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByBudget} margin={{ left: 10, right: 10, top: 5, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budget"   name="Budget"   fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="received" name="Received" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="spent"    name="Spent"    fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="chart-card"><div className="chart-header"><h4 className="chart-title">Budget vs Received</h4></div><EmptyChart /></div>
        )}
      </div>

      {/* ── Contribution Chart: Group (ALL) / Sub-group (GROUP) / Project (SUBGROUP) ── */}
      {contributionData.length > 1 && (
        <div className="dashboard-section">
          <h3 className="section-title">
            <Percent size={20} />
            {data.scope === 'SUBGROUP'
              ? 'Project-wise Turnover Contribution'
              : data.scope === 'GROUP'
              ? 'Sub-group Turnover Contribution'
              : 'Group-wise Turnover Contribution'}
          </h3>
          <div className="dashboard-charts-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Horizontal Bar chart — budget amounts */}
            <div className="chart-card chart-card-clickable" onClick={() => setChartModal({ type: 'contributionBar' })}>
              <div className="chart-header">
                <h4 className="chart-title">
                  <BarChart3 size={15} />
                  {data.scope === 'SUBGROUP' ? 'Projects by Order Value (₹)' : data.scope === 'GROUP' ? 'Sub-groups by Order Value (₹)' : 'Groups by Order Value (₹)'}
                </h4>
                <span className="chart-expand-hint">🔍 Click to expand</span>
              </div>
              <div style={{ height: Math.max(220, contributionData.length * 36 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contributionData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip
                      formatter={(v, name) => name === 'budget' ? [formatCurrency(v), 'Order Value'] : [v, name]}
                      labelFormatter={label => label}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="budget" name="Order Value" radius={[0,4,4,0]}>
                      {contributionData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie chart — % contribution */}
            <div className="chart-card chart-card-clickable" onClick={() => setChartModal({ type: 'contributionPie' })}>
              <div className="chart-header">
                <h4 className="chart-title">
                  <PieChart size={15} />
                  {data.scope === 'SUBGROUP' ? 'Project Turnover Share (%)' : data.scope === 'GROUP' ? 'Sub-group Turnover Share (%)' : 'Group Turnover Share (%)'}
                </h4>
                <span className="chart-expand-hint">🔍 Click to expand</span>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart margin={{ top: 10, bottom: 30, left: 20, right: 20 }}>
                    <Pie
                      data={contributionData}
                      dataKey="pct"
                      nameKey="name"
                      cx="50%" cy="44%"
                      outerRadius={85}
                      labelLine={false}
                      label={renderPieLabel(5)}
                    >
                      {contributionData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v}%`, name]} />
                    <Legend
                      formatter={(value, entry) => `${value} (${entry.payload.pct}%)`}
                      wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
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
            </div>
          </div>
          <div className="agg-table-wrapper">
            {/* Sticky header sits outside the scroll area */}
            <div className="agg-table-scroll">
              <table className="agg-projects-table">
                <colgroup>
                  <col style={{ minWidth: 200 }} />  {/* Project */}
                  <col style={{ minWidth: 140 }} />  {/* Group/Category */}
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
                    <td colSpan={4} className="agg-td-left agg-tfoot-label">TOTAL — {projects.length} projects</td>
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
        }} onClick={() => setChartModal(null)}>
          <div style={{
            background:'#fff', borderRadius:16, width:'100%', maxWidth:900, maxHeight:'90vh',
            display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(0,0,0,0.28)', overflow:'hidden'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:'16px 24px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:8 }}>
                {chartModal.type === 'statusPie' && <><PieChart size={18} /> Project Status Distribution</>}
                {chartModal.type === 'budgetBar' && <><BarChart3 size={18} /> Top Projects — Budget vs Received</>}
                {chartModal.type === 'contributionBar' && <><BarChart3 size={18} /> {data.scope === 'SUBGROUP' ? 'Projects' : data.scope === 'GROUP' ? 'Sub-groups' : 'Groups'} by Order Value</>}
                {chartModal.type === 'contributionPie' && <><PieChart size={18} /> {data.scope === 'SUBGROUP' ? 'Project' : data.scope === 'GROUP' ? 'Sub-group' : 'Group'} Turnover Share (%)</>}
              </h3>
              <button onClick={() => setChartModal(null)} style={{ background:'#f1f5f9', border:'none', cursor:'pointer', padding:'6px 10px', borderRadius:8, fontWeight:700, fontSize:16 }}>✕</button>
            </div>
            {/* Chart body */}
            <div style={{ flex:1, padding:'20px 24px', overflow:'auto' }}>
              {chartModal.type === 'statusPie' && statusDistribution.length > 0 && (
                <ResponsiveContainer width="100%" height={420}>
                  <RechartsPieChart margin={{ top: 20, bottom: 40, left: 40, right: 40 }}>
                    <Pie data={statusDistribution} cx="50%" cy="44%" labelLine={false}
                      label={renderPieLabel(5)} outerRadius={140} dataKey="value">
                      {statusDistribution.map((entry, i) => (
                        <Cell key={i} fill={statusColor[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
              {chartModal.type === 'budgetBar' && (
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={topByBudget} margin={{ left: 20, right: 20, top: 10, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="budget"   name="Budget"   fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="received" name="Received" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="spent"    name="Spent"    fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartModal.type === 'contributionBar' && (
                <ResponsiveContainer width="100%" height={Math.max(320, contributionData.length * 44 + 60)}>
                  <BarChart data={contributionData} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                    <Tooltip formatter={(v, n) => n === 'budget' ? [formatCurrency(v), 'Order Value'] : [v, n]} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="budget" name="Order Value" radius={[0,4,4,0]}>
                      {contributionData.map((d, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartModal.type === 'contributionPie' && (
                <ResponsiveContainer width="100%" height={460}>
                  <RechartsPieChart>
                    <Pie
                      data={contributionData} dataKey="pct" nameKey="name"
                      cx="50%" cy="44%" outerRadius={150} labelLine={false}
                      label={renderPieLabel(5)}
                    >
                      {contributionData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v}%`, name]} />
                    <Legend formatter={(value, entry) => `${value} (${entry.payload.pct}%)`} wrapperStyle={{ fontSize: 13 }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
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
          }} onClick={() => setEditProgressModal(null)}>
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
          }} onClick={() => setStatusModal(null)}>
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
const calculateProgress = (dashboardData) => {
  if (!dashboardData) return 0;

  // Priority 1: manual override stored in DB (set via Edit Status modal)
  const manual = Number(dashboardData.progressPercentage || 0);
  if (manual > 0) return Number(manual.toFixed(1));

  const fin  = dashboardData.financialData  || {};
  const proc = dashboardData.procurementData || {};
  const budget = Number(dashboardData.budget || fin.totalProjectValue || 0);

  // Priority 2: weighted formula across 4 signals
  // Financial collection 40% — actual cash received vs budget
  const billingPct   = Number(fin.billingPercentage   || 0);           // already a %
  // PO delivery      30% — delivered POs vs total non-cancelled POs
  const totalPOs     = Number(proc.totalPOs     || 0);
  const deliveredPOs = Number(proc.deliveredPOs || 0);
  const cancelledPOs = Number(proc.cancelledPOs || 0);
  const activePOs    = Math.max(1, totalPOs - cancelledPOs);
  const deliveryPct  = totalPOs > 0 ? Math.min(100, (deliveredPOs / activePOs) * 100) : 0;
  // Invoicing        20% — total invoiced vs budget (billing coverage)
  const totalInvoiced = Number(fin.amountToBeReceived || 0);
  const invoicingPct  = budget > 0 ? Math.min(100, (totalInvoiced / budget) * 100) : 0;
  // PO commitment    10% — budget utilization (committed spend vs budget)
  const commitPct    = Math.min(100, Number(fin.budgetUtilizationPercent || 0));

  const weighted = (billingPct  * 0.40)
                 + (deliveryPct * 0.30)
                 + (invoicingPct* 0.20)
                 + (commitPct   * 0.10);

  // Priority 3: timeline fallback only when truly zero activity
  if (weighted === 0 && dashboardData.startDate && dashboardData.endDate) {
    const start   = new Date(dashboardData.startDate);
    const end     = new Date(dashboardData.endDate);
    const elapsed = ((new Date() - start) / (end - start)) * 100;
    return Math.min(Math.max(elapsed, 0), 5).toFixed(1); // cap 5% — just shows "started"
  }

  return Math.min(100, weighted).toFixed(1);
};
const getStatusColor = (s) => ({
  NOT_STARTED: '#64748b', PLANNING: '#f59e0b', IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e', ON_HOLD: '#8b5cf6', CANCELLED: '#ef4444',
}[s] || '#94a3b8');

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
                <ResponsiveContainer width="100%" height={230}>
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
                <ResponsiveContainer width="100%" height={230}>
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
                <ResponsiveContainer width="100%" height={230}>
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

    </div>
  );
};

export default ProjectDashboard;