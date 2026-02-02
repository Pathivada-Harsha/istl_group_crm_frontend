import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign,IndianRupee, Package, FileText, Users,
  Calendar, Clock, AlertCircle, CheckCircle, XCircle, Activity,
  Briefcase, ShoppingCart, BarChart3, PieChart, Target, Zap,
  MapPin, Building2, Phone, Mail, User, Percent, ArrowUp, ArrowDown,
  AlertTriangle, Download, RefreshCw, Receipt, CreditCard, Wallet
} from 'lucide-react';
import Timeline from "./../components/projects/HorizontalTimeline.js";
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

const ProjectDashboard = () => {
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchDashboardData();
    } else {
      setDashboardData(null);
    }
  }, [projectId]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json'
  });

  /**
   * Fetch complete dashboard data from backend
   */
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/dashboard`,
        {
          credentials: "include",
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard Data:', data);
        setDashboardData(data);
      } else if (response.status === 404) {
        showError('Project not found');
        setDashboardData(null);
      } else {
        showError('Failed to load dashboard data');
        setDashboardData(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      showError('Network error. Please check your connection.');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    const value = Number(amount);
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const calculateProgress = () => {
    if (!dashboardData?.startDate || !dashboardData?.endDate) return 0;

    const start = new Date(dashboardData.startDate);
    const end = new Date(dashboardData.endDate);
    const now = new Date();

    const total = end - start;
    const elapsed = now - start;

    const progress = (elapsed / total) * 100;
    return Math.min(Math.max(progress, 0), 100).toFixed(1);
  };

  const getStatusColor = (status) => {
    const colors = {
      'PLANNING': '#3b82f6', 'IN_PROGRESS': '#22c55e',
      'COMPLETED': '#8b5cf6', 'ON_HOLD': '#f59e0b', 'CANCELLED': '#ef4444'
    };
    return colors[status] || '#94a3b8';
  };

  const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

  // Empty state component for charts
  const EmptyChart = ({ message = "No data available" }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '300px',
      color: '#94a3b8'
    }}>
      <div style={{ textAlign: 'center' }}>
        <BarChart3 size={48} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
        <p>{message}</p>
      </div>
    </div>
  );

  return (
    <div className="project-dashboard-container">
      {loading && <CrmPreloader text="Loading dashboard..." />}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="project-dashboard-header">
        <div className="project-dashboard-breadcrumb">
          Dashboard &gt; Projects &gt; Project Dashboard
        </div>

        <div className="page-header-with-filter">
          <h1 className="project-dashboard-title">
            <BarChart3 size={28} />
            Project Dashboard
          </h1>
          <div className="header-actions">
            <GroupProjectFilter
              groupValue={groupName}
              subGroupValue={subGroupName}
              projectValue={projectId}
              onChange={updateFilters}
            />
            {projectId && (
              <button
                className="dashboard-refresh-btn"
                onClick={fetchDashboardData}
                disabled={loading}
              >
                <RefreshCw size={18} />
                Refresh
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
            <RefreshCw size={18} />
            Retry
          </button>
        </div>
      ) : dashboardData ? (
        <>
          {/* Project Overview */}
          <div className="project-overview-card">
            <div className="project-overview-header">
              <div className="project-overview-info">
                <h2>{dashboardData.projectName || 'Untitled Project'}</h2>
                <div className="project-meta">
                  <span className="project-code">
                    <Building2 size={14} />
                    {dashboardData.projectId}
                  </span>
                  <span
                    className="project-status-badge"
                    style={{ backgroundColor: getStatusColor(dashboardData.status) }}
                  >
                    {dashboardData.status}
                  </span>
                  {dashboardData.location && (
                    <span className="project-location">
                      <MapPin size={14} />
                      {dashboardData.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="project-progress-section">
                <div className="progress-circle">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                    <circle
                      cx="60" cy="60" r="54" fill="none"
                      stroke={getStatusColor(dashboardData.status)}
                      strokeWidth="12"
                      strokeDasharray={`${calculateProgress() * 3.39} 339`}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />
                    <text x="60" y="55" textAnchor="middle" className="progress-value">
                      {calculateProgress()}%
                    </text>
                    <text x="60" y="70" textAnchor="middle" className="progress-label">
                      Complete
                    </text>
                  </svg>
                </div>
              </div>
            </div>

            <div className="project-overview-details">
              <div className="project-detail-item">
                <Calendar size={18} />
                <div>
                  <span className="detail-label">Start Date</span>
                  <span className="detail-value">{formatDate(dashboardData.startDate)}</span>
                </div>
              </div>
              <div className="project-detail-item">
                <Calendar size={18} />
                <div>
                  <span className="detail-label">End Date</span>
                  <span className="detail-value">{formatDate(dashboardData.endDate)}</span>
                </div>
              </div>
              <div className="project-detail-item">
                <User size={18} />
                <div>
                  <span className="detail-label">Project Manager</span>
                  <span className="detail-value">{dashboardData.manager || 'Not Assigned'}</span>
                </div>
              </div>
              <div className="project-detail-item">
                <IndianRupee size={18} />
                <div>
                  <span className="detail-label">Total Project Value</span>
                  <span className="detail-value">{formatCurrency(dashboardData.budget)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Overview */}
          {/* Financial Overview */}
          {dashboardData.financialData && (
            <>
              <div className="dashboard-section">
                <h3 className="section-title">
                  <IndianRupee size={20} />
                  Project Financial Overview
                </h3>
                <div className="kpi-grid">
                  <div className="kpi-card highlight" style={{ borderTopColor: '#3b82f6' }}>
                    <div className="kpi-icon" style={{ color: '#3b82f6' }}>
                      <Wallet size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(dashboardData.financialData.totalProjectValue)}</div>
                      <div className="kpi-label">Total Project Value</div>
                      <div className="kpi-subtitle">Contract budget</div>
                    </div>
                  </div>

                  {/* Amount Spent = Amount Paid to Vendors */}
                  <div className="kpi-card" style={{ borderTopColor: '#f59e0b' }}>
                    <div className="kpi-icon" style={{ color: '#f59e0b' }}>
                      <TrendingDown size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(dashboardData.financialData.totalSpent)}</div>
                      <div className="kpi-label">Amount Spent</div>
                      <div className="kpi-subtitle">
                        Paid to vendors • {dashboardData.financialData.budgetUtilizationPercent?.toFixed(1)}% of budget
                      </div>
                    </div>
                  </div>

                  {/* Profit - Shows "Actual" if completed, "Projected" with warning if in progress */}
                  <div className="kpi-card" style={{ borderTopColor: '#8b5cf6' }}>
                    <div className="kpi-icon" style={{ color: '#8b5cf6' }}>
                      <Target size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(dashboardData.financialData.projectedProfit)}</div>
                      <div className="kpi-label">
                        {dashboardData.financialData.isCompleted ? 'Actual Profit' : 'Projected Profit'}
                      </div>
                      {dashboardData.financialData.isCompleted ? (
                        <div className="kpi-trend positive">
                          <CheckCircle size={14} />
                          {dashboardData.financialData.profitMargin?.toFixed(1)}% margin
                          <span style={{ marginLeft: '4px', fontSize: '11px' }}>✓ Final</span>
                        </div>
                      ) : (
                        <div className="kpi-subtitle" style={{
                          color: '#f59e0b',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Clock size={12} />
                          Project still going on • {dashboardData.financialData.profitMargin?.toFixed(1)}% margin
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cash Flow - Shows Deficit or Surplus */}
                  <div className="kpi-card" style={{
                    borderTopColor: (dashboardData.financialData.cashDeficit && dashboardData.financialData.cashDeficit > 0)
                      ? '#ef4444'
                      : '#22c55e'
                  }}>
                    <div className="kpi-icon" style={{
                      color: (dashboardData.financialData.cashDeficit && dashboardData.financialData.cashDeficit > 0)
                        ? '#ef4444'
                        : '#22c55e'
                    }}>
                      <Wallet size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">
                        {formatCurrency(
                          (dashboardData.financialData.cashDeficit && dashboardData.financialData.cashDeficit > 0)
                            ? dashboardData.financialData.cashDeficit
                            : (dashboardData.financialData.cashInHand || 0)
                        )}
                      </div>
                      <div className="kpi-label">
                        {(dashboardData.financialData.cashDeficit && dashboardData.financialData.cashDeficit > 0)
                          ? 'Cash Deficit'
                          : 'Cash in Hand'}
                      </div>
                      <div className="kpi-subtitle">
                        {(dashboardData.financialData.cashDeficit && dashboardData.financialData.cashDeficit > 0)
                          ? 'Paid more than received'
                          : 'Received minus paid'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Billing */}
              <div className="dashboard-section">
                <h3 className="section-title">
                  <Receipt size={20} />
                  Client Billing & Receipts
                </h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-header">
                      <IndianRupee size={24} />
                      <span className="metric-title">Billed Amount</span>
                    </div>
                    <div className="metric-value">
                      {formatCurrency(dashboardData.financialData.amountToBeReceived)}
                    </div>
                    <div className="metric-breakdown">
                      <span className="metric-item">Total Invoice Raised</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <CheckCircle size={24} />
                      <span className="metric-title">Amount Received</span>
                    </div>
                    <div className="metric-value">
                      {formatCurrency(dashboardData.financialData.amountReceived)}
                    </div>
                    <div className="metric-breakdown">
                      <span className="metric-item success">
                        {dashboardData.financialData.billingPercentage?.toFixed(1)}% Received
                      </span>
                      <span className="metric-item">
                        From client payments
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <Clock size={24} />
                      <span className="metric-title">Pending Receipts</span>
                    </div>
                    <div className="metric-value">
                      {formatCurrency(dashboardData.financialData.pendingReceipts)}
                    </div>
                    <div className="metric-breakdown">
                      <span className="metric-item warning">
                        {(100 - (dashboardData.financialData.billingPercentage || 0)).toFixed(1)}% Pending
                      </span>
                      <span className="metric-item">
                        Yet to collect from client
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <TrendingUp size={24} />
                      <span className="metric-title">Collection Progress</span>
                    </div>
                    <div className="metric-value">
                      {dashboardData.financialData.billingPercentage?.toFixed(1)}%
                    </div>
                    <div className="metric-breakdown">
                      <div className="progress-bar-container">
                        <div
                          className="progress-bar-fill success"
                          style={{ width: `${dashboardData.financialData.billingPercentage || 0}%` }}
                        ></div>
                      </div>
                      <span className="metric-item">Client payment collection</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vendor Payments */}
              <div className="dashboard-section">
                <h3 className="section-title">
                  <CreditCard size={20} />
                  Vendor Payments (Procurement Spend)
                </h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-header">
                      <IndianRupee size={24} />
                      <span className="metric-title">Total Procurement Cost</span>
                    </div>
                    <div className="metric-value">
                      {formatCurrency(dashboardData.financialData.totalPayable)}
                    </div>
                    <div className="metric-breakdown">
                      <span className="metric-item">Total bills from vendors</span>
                    </div>
                  </div>

                  {/* Amount Paid = Amount Spent (same value) */}
                  <div className="metric-card">
                    <div className="metric-header">
                      <CheckCircle size={24} />
                      <span className="metric-title">Amount Paid</span>
                    </div>
                    <div className="metric-value">
                      {formatCurrency(dashboardData.financialData.amountPaid)}
                    </div>
                    <div className="metric-breakdown">
                      <span className="metric-item success">
                        {dashboardData.financialData.paymentPercentage?.toFixed(1)}% Paid
                      </span>
                      <span className="metric-item">
                        Same as Amount Spent above
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <AlertCircle size={24} />
                      <span className="metric-title">Pending Payments</span>
                    </div>
                    <div className="metric-value">
                      {formatCurrency(dashboardData.financialData.pendingPayments)}
                    </div>
                    <div className="metric-breakdown">
                      <span className="metric-item danger">
                        {(100 - (dashboardData.financialData.paymentPercentage || 0)).toFixed(1)}% Pending
                      </span>
                      <span className="metric-item">
                        Due to vendors
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <Activity size={24} />
                      <span className="metric-title">Payment Progress</span>
                    </div>
                    <div className="metric-value">
                      {dashboardData.financialData.paymentPercentage?.toFixed(1)}%
                    </div>
                    <div className="metric-breakdown">
                      <div className="progress-bar-container">
                        <div
                          className="progress-bar-fill warning"
                          style={{ width: `${dashboardData.financialData.paymentPercentage || 0}%` }}
                        ></div>
                      </div>
                      <span className="metric-item">Vendor payment completion</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profit Breakdown Info Card - Shows formula based on status */}
              {!dashboardData.financialData.isCompleted && (
                <div className="dashboard-section" style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  padding: '20px 24px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <Clock size={24} />
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Project In Progress</h3>
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      <strong>Projected Profit Calculation:</strong>
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontFamily: 'monospace' }}>
                      {formatCurrency(dashboardData.financialData.totalProjectValue)} (Budget)
                      - {formatCurrency(dashboardData.financialData.totalSpent)} (Amount Spent)
                      = {formatCurrency(dashboardData.financialData.projectedProfit)}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
                      ℹ️ This is a projection. Actual profit will be calculated when the project is marked as completed.
                    </p>
                  </div>
                </div>
              )}

              {/* Completed Project Banner - Shows final breakdown */}
              {dashboardData.financialData.isCompleted && (
                <div className="dashboard-section" style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white'
                }}>
                  <h3 className="section-title" style={{ color: 'white' }}>
                    <CheckCircle size={20} />
                    Project Completed - Final Financial Summary
                  </h3>
                  <div className="metrics-grid">
                    <div className="metric-card" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                      <div className="metric-header">
                        <span className="metric-title" style={{ color: 'white' }}>Total Revenue</span>
                      </div>
                      <div className="metric-value" style={{ color: 'white' }}>
                        {formatCurrency(dashboardData.financialData.amountReceived)}
                      </div>
                      <div className="metric-breakdown">
                        <span className="metric-item" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          Received from client
                        </span>
                      </div>
                    </div>

                    <div className="metric-card" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                      <div className="metric-header">
                        <span className="metric-title" style={{ color: 'white' }}>Total Cost</span>
                      </div>
                      <div className="metric-value" style={{ color: 'white' }}>
                        {formatCurrency(dashboardData.financialData.totalSpent)}
                      </div>
                      <div className="metric-breakdown">
                        <span className="metric-item" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          Paid to vendors
                        </span>
                      </div>
                    </div>

                    <div className="metric-card" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                      <div className="metric-header">
                        <span className="metric-title" style={{ color: 'white' }}>Actual Profit</span>
                      </div>
                      <div className="metric-value" style={{ color: 'white' }}>
                        {formatCurrency(dashboardData.financialData.projectedProfit)}
                      </div>
                      <div className="metric-breakdown">
                        <span className="metric-item" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          Revenue - Cost
                        </span>
                      </div>
                    </div>

                    <div className="metric-card" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                      <div className="metric-header">
                        <span className="metric-title" style={{ color: 'white' }}>Profit Margin</span>
                      </div>
                      <div className="metric-value" style={{ color: 'white' }}>
                        {dashboardData.financialData.profitMargin?.toFixed(1)}%
                      </div>
                      <div className="metric-breakdown">
                        <span className="metric-item" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          (Profit / Revenue) × 100
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Procurement Overview */}
          {dashboardData.procurementData && (
            <div className="dashboard-section">
              <h3 className="section-title">
                <ShoppingCart size={20} />
                Procurement Overview
              </h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <FileText size={24} />
                    <span className="metric-title">Purchase Orders</span>
                  </div>
                  <div className="metric-value">{dashboardData.procurementData.totalPOs || 0}</div>
                  <div className="metric-breakdown">
                    <span className="metric-item success">
                      <CheckCircle size={14} />
                      {dashboardData.procurementData.deliveredPOs || 0} Delivered
                    </span>
                    <span className="metric-item">
                      Value: {formatCurrency(dashboardData.procurementData.totalPOValue)}
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Package size={24} />
                    <span className="metric-title">Delivery Rate</span>
                  </div>
                  <div className="metric-value">
                    {dashboardData.procurementData.deliveryRate?.toFixed(1) || 0}%
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <FileText size={24} />
                    <span className="metric-title">Quotations</span>
                  </div>
                  <div className="metric-value">{dashboardData.procurementData.totalQuotations || 0}</div>
                  <div className="metric-breakdown">
                    <span className="metric-item success">
                      {dashboardData.procurementData.approvedQuotations || 0} Approved
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Users size={24} />
                    <span className="metric-title">Active Vendors</span>
                  </div>
                  <div className="metric-value">{dashboardData.procurementData.activeVendors || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="dashboard-charts-grid">
            {/* Spending Trend */}
            {dashboardData.spendingTrend && dashboardData.spendingTrend.length > 0 ? (
              <div className="chart-card full-width">
                <div className="chart-header">
                  <h4 className="chart-title">
                    <TrendingUp size={18} />
                    Monthly Spending Trend
                  </h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={dashboardData.spendingTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area dataKey="spending" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.3} />
                    <Bar dataKey="orders" fill="#22c55e" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card full-width">
                <div className="chart-header">
                  <h4 className="chart-title">Monthly Spending Trend</h4>
                </div>
                <EmptyChart message="No spending data available" />
              </div>
            )}

            {/* PO Status */}
            {dashboardData.procurementData?.posByStatus && dashboardData.procurementData.posByStatus.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">PO Status Distribution</h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={dashboardData.procurementData.posByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name} (${entry.value})`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {dashboardData.procurementData.posByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">PO Status Distribution</h4>
                </div>
                <EmptyChart message="No purchase orders yet" />
              </div>
            )}

            {/* Payment Distribution */}
            {dashboardData.procurementData?.paymentDistribution &&
              dashboardData.procurementData.paymentDistribution.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">Payment Status</h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.procurementData.paymentDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">Payment Status</h4>
                </div>
                <EmptyChart message="No payment data available" />
              </div>
            )}

            {/* Category Spending */}
            {dashboardData.procurementData?.categoryDistribution &&
              dashboardData.procurementData.categoryDistribution.length > 0 ? (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">Top Categories</h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.procurementData.categoryDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">Top Categories</h4>
                </div>
                <EmptyChart message="No category data available" />
              </div>
            )}
          </div>

          {/* Top Vendors */}
          {dashboardData.topVendors && dashboardData.topVendors.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title">
                <Users size={20} />
                Top Vendors
              </h3>
              <div className="vendors-list">
                {dashboardData.topVendors.map((vendor, index) => (
                  <div key={vendor.id} className="vendor-item">
                    <div className="vendor-rank">#{index + 1}</div>
                    <div className="vendor-info">
                      <div className="vendor-name">{vendor.name}</div>
                      <div className="vendor-meta">
                        <span className="vendor-orders">{vendor.totalOrders} orders</span>
                        {vendor.rating > 0 && <span className="vendor-rating">⭐ {vendor.rating}</span>}
                      </div>
                    </div>
                    <div className="vendor-amount">{formatCurrency(vendor.totalPurchaseValue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activities */}
          {dashboardData.recentActivities && dashboardData.recentActivities.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title">
                <Activity size={20} />
                Recent Activities
              </h3>
              <div className="activities-timeline">
                {dashboardData.recentActivities.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-icon" style={{ backgroundColor: activity.color }}>
                      {activity.type === 'Purchase Order' ? <ShoppingCart size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-type">{activity.type}</span>
                        <span className="activity-date">{formatDate(activity.date)}</span>
                      </div>
                      <div className="activity-action">{activity.action}</div>
                      {activity.amount && (
                        <div className="activity-amount">{formatCurrency(activity.amount)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Timeline */}
          {dashboardData.projectTimeline && dashboardData.projectTimeline.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title">
                <Clock size={20} />
                Project Timeline
              </h3>
              <div className="project-timeline-container">
                {dashboardData.projectTimeline.map((milestone, index) => (
                  <div key={index} className={`timeline-milestone ${milestone.status}`}>
                    <div className="milestone-marker">
                      {milestone.status === 'completed' ? <CheckCircle size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="milestone-content">
                      <div className="milestone-date">{formatDate(milestone.date)}</div>
                      <h4 className="milestone-title">{milestone.title}</h4>
                      <p className="milestone-description">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            // <Timeline />
          )}
        </>
      ) : null}
    </div>
  );
};

export default ProjectDashboard;