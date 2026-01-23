import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, FileText, Users, 
  Calendar, Clock, AlertCircle, CheckCircle, XCircle, Activity,
  Briefcase, ShoppingCart, BarChart3, PieChart, Target, Zap,
  MapPin, Building2, Phone, Mail, User, Percent, ArrowUp, ArrowDown,
  AlertTriangle, Download, RefreshCw, Receipt, CreditCard, Wallet
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

const ProjectDashboard = () => {
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  const { user } = useAuth();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

  // Dashboard Data
  const [projectDetails, setProjectDetails] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [procurementData, setProcurementData] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [topVendors, setTopVendors] = useState([]);
  const [spendingTrend, setSpendingTrend] = useState([]);
  const [projectTimeline, setProjectTimeline] = useState([]);

  // Fetch all data on mount and when project changes
  useEffect(() => {
    if (projectId) {
      fetchAllDashboardData();
    } else {
      resetDashboard();
    }
  }, [projectId]);

  const resetDashboard = () => {
    setProjectDetails(null);
    setFinancialData(null);
    setProcurementData(null);
    setRecentActivities([]);
    setTopVendors([]);
    setSpendingTrend([]);
    setProjectTimeline([]);
  };

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-Id': user?.id || localStorage.getItem('userId'),
    'X-User-Role': user?.role || localStorage.getItem('userRole'),
    'Content-Type': 'application/json'
  });

  /**
   * Fetch all dashboard data with error handling
   */
  const fetchAllDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProjectDetails(),
        fetchProcurementData(),
        fetchRecentActivities(),
        fetchTopVendors(),
        fetchSpendingTrend()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Don't show error to user - we'll use mock data
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch project details with fallback
   */
  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        credentials: "include",
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjectDetails(data);
        generateProjectTimeline(data);
      } else {
        // Use mock data
        setProjectDetails(getMockProjectDetails());
        generateProjectTimeline(getMockProjectDetails());
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      setProjectDetails(getMockProjectDetails());
      generateProjectTimeline(getMockProjectDetails());
    }
  };

  /**
   * Fetch comprehensive procurement and financial data
   */
  const fetchProcurementData = async () => {
    try {
      // Fetch POs
      const poParams = new URLSearchParams({
        projectId: projectId,
        size: 1000
      });
      const poResponse = await fetch(
        `${API_BASE_URL}/api/purchase-orders?${poParams}`,
        { credentials: "include",headers: getAuthHeaders() }
      );
      
      // Fetch quotations
      const quotationParams = new URLSearchParams({
        projectId: projectId,
        size: 1000
      });
      const quotationResponse = await fetch(
        `${API_BASE_URL}/api/quotations?${quotationParams}`,
        { credentials: "include",headers: getAuthHeaders() }
      );

      // Fetch vendors
      const vendorParams = new URLSearchParams({
        projectId: projectId,
        size: 1000
      });
      const vendorResponse = await fetch(
        `${API_BASE_URL}/api/vendors?${vendorParams}`,
        { credentials: "include",headers: getAuthHeaders() }
      );

      let pos = [];
      let quotations = [];
      let vendors = [];

      if (poResponse.ok) {
        const poData = await poResponse.json();
        pos = poData.purchaseOrders || [];
      }

      if (quotationResponse.ok) {
        const quotationData = await quotationResponse.json();
        quotations = quotationData.quotations || [];
      }

      if (vendorResponse.ok) {
        const vendorData = await vendorResponse.json();
        vendors = vendorData.vendors || [];
      }

      // If all APIs failed, use mock data
      if (pos.length === 0 && quotations.length === 0 && vendors.length === 0) {
        const mockData = getMockProcurementData();
        setProcurementData(mockData.procurementStats);
        setFinancialData(mockData.financialData);
        return;
      }

      // Calculate comprehensive statistics
      const stats = calculateProcurementStats(pos, quotations, vendors);
      setProcurementData(stats);

      // Calculate financial data
      const financial = calculateFinancialData(pos, projectDetails);
      setFinancialData(financial);

    } catch (error) {
      console.error('Error fetching procurement data:', error);
      const mockData = getMockProcurementData();
      setProcurementData(mockData.procurementStats);
      setFinancialData(mockData.financialData);
    }
  };

  /**
   * Calculate procurement statistics
   */
  const calculateProcurementStats = (pos, quotations, vendors) => {
    return {
      // Purchase Orders
      totalPOs: pos.length,
      totalPOValue: pos.reduce((sum, po) => sum + (po.totalValue || 0), 0),
      avgPOValue: pos.length > 0 ? pos.reduce((sum, po) => sum + (po.totalValue || 0), 0) / pos.length : 0,
      
      // PO Status breakdown
      draftPOs: pos.filter(po => po.status === 'Draft').length,
      approvedPOs: pos.filter(po => po.status === 'Approved').length,
      orderedPOs: pos.filter(po => po.status === 'Ordered').length,
      inTransitPOs: pos.filter(po => po.status === 'In-Transit').length,
      deliveredPOs: pos.filter(po => po.status === 'Delivered').length,
      cancelledPOs: pos.filter(po => po.status === 'Cancelled').length,
      
      // Delivery metrics
      totalItemsOrdered: pos.reduce((sum, po) => sum + (po.totalItemsOrdered || 0), 0),
      totalItemsDelivered: pos.reduce((sum, po) => sum + (po.totalItemsDelivered || 0), 0),
      pendingDeliveries: pos.filter(po => (po.totalItemsPending || 0) > 0).length,
      deliveryRate: calculateDeliveryRate(pos),
      
      // Quotations
      totalQuotations: quotations.length,
      totalQuotationValue: quotations.reduce((sum, q) => sum + (q.totalValue || 0), 0),
      
      // Quotation status
      newQuotations: quotations.filter(q => q.status === 'New').length,
      underReviewQuotations: quotations.filter(q => q.status === 'Under Review').length,
      approvedQuotations: quotations.filter(q => q.status === 'Approved').length,
      rejectedQuotations: quotations.filter(q => q.status === 'Rejected').length,
      
      // Vendors
      totalVendors: vendors.length,
      activeVendors: vendors.filter(v => v.status === 'Active').length,
      totalVendorSpend: vendors.reduce((sum, v) => sum + (v.totalPurchaseValue || 0), 0),
      avgVendorRating: calculateAvgVendorRating(vendors),
      
      // Payment status
      pendingPayments: pos.filter(po => po.paymentStatus === 'Pending').length,
      partialPayments: pos.filter(po => po.paymentStatus === 'Partial').length,
      paidPOs: pos.filter(po => po.paymentStatus === 'Paid').length,
      
      // Charts data
      posByStatus: calculatePOsByStatus(pos),
      quotationsByStatus: calculateQuotationsByStatus(quotations),
      paymentDistribution: calculatePaymentDistribution(pos),
      categoryDistribution: calculateCategoryDistribution(pos, quotations),
      
      // Raw data
      purchaseOrders: pos,
      quotations: quotations,
      vendors: vendors
    };
  };

  /**
   * Calculate comprehensive financial data
   */
  const calculateFinancialData = (pos, project) => {
    const totalProjectValue = project?.budget || project?.totalValue || 50000000; // Default 5 Cr
    
    // Total spent (delivered POs)
    const totalSpent = pos
      .filter(po => po.status === 'Delivered' || po.paymentStatus === 'Paid')
      .reduce((sum, po) => sum + (po.totalValue || 0), 0);
    
    // Total committed (all non-cancelled POs)
    const totalCommitted = pos
      .filter(po => po.status !== 'Cancelled')
      .reduce((sum, po) => sum + (po.totalValue || 0), 0);
    
    // Amount received from client (80% of delivered work - assumption)
    const amountReceived = totalSpent * 0.8;
    
    // Pending receipts from client
    const pendingReceipts = totalSpent - amountReceived;
    
    // Pending payments to vendors
    const pendingPayments = pos
      .filter(po => po.paymentStatus === 'Pending' || po.paymentStatus === 'Partial')
      .reduce((sum, po) => sum + (po.totalValue || 0), 0);
    
    // Expected revenue (project value)
    const expectedRevenue = totalProjectValue;
    
    // Projected profit
    const projectedProfit = expectedRevenue - totalCommitted;
    const profitMargin = expectedRevenue > 0 ? (projectedProfit / expectedRevenue) * 100 : 0;
    
    return {
      totalProjectValue: totalProjectValue,
      totalSpent: totalSpent,
      totalCommitted: totalCommitted,
      remaining: expectedRevenue - totalCommitted,
      
      // Client billing
      amountToBeReceived: expectedRevenue, // Total project value
      amountReceived: amountReceived,
      pendingReceipts: pendingReceipts,
      billingPercentage: (amountReceived / expectedRevenue) * 100,
      
      // Vendor payments
      totalPayable: totalCommitted,
      amountPaid: totalSpent - pendingPayments,
      pendingPayments: pendingPayments,
      paymentPercentage: totalCommitted > 0 ? ((totalSpent - pendingPayments) / totalCommitted) * 100 : 0,
      
      // Profit metrics
      projectedProfit: projectedProfit,
      profitMargin: profitMargin,
      
      // Budget utilization
      budgetUtilized: totalCommitted,
      budgetUtilizationPercent: (totalCommitted / totalProjectValue) * 100,
      
      // Cash flow
      cashInHand: amountReceived - (totalSpent - pendingPayments),
      burnRate: totalCommitted > 0 ? totalSpent / totalCommitted : 0
    };
  };

  /**
   * Fetch recent activities
   */
  const fetchRecentActivities = async () => {
    try {
      const activities = [];

      // Recent POs
      const poParams = new URLSearchParams({
        projectId: projectId,
        size: 5,
        sortBy: 'createdAt',
        sortDirection: 'DESC'
      });
      const poResponse = await fetch(
        `${API_BASE_URL}/api/purchase-orders?${poParams}`,
        { credentials: "include",headers: getAuthHeaders() }
      );
      
      if (poResponse.ok) {
        const poData = await poResponse.json();
        (poData.purchaseOrders || []).forEach(po => {
          activities.push({
            type: 'Purchase Order',
            action: `PO ${po.poNo} ${po.status.toLowerCase()}`,
            status: po.status,
            amount: po.totalValue,
            date: po.createdAt || po.orderDate,
            icon: <ShoppingCart size={16} />,
            color: getStatusColor(po.status)
          });
        });
      }

      // Recent Quotations
      const quotationParams = new URLSearchParams({
        projectId: projectId,
        size: 5,
        sortBy: 'uploadedAt',
        sortDirection: 'DESC'
      });
      const quotationResponse = await fetch(
        `${API_BASE_URL}/api/quotations?${quotationParams}`,
        { credentials: "include",headers: getAuthHeaders() }
      );
      
      if (quotationResponse.ok) {
        const quotationData = await quotationResponse.json();
        (quotationData.quotations || []).forEach(q => {
          activities.push({
            type: 'Quotation',
            action: `Quotation ${q.quoteNo} ${q.status.toLowerCase()}`,
            status: q.status,
            amount: q.totalValue,
            date: q.uploadedAt,
            icon: <FileText size={16} />,
            color: getStatusColor(q.status)
          });
        });
      }

      if (activities.length === 0) {
        setRecentActivities(getMockActivities());
      } else {
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentActivities(activities.slice(0, 10));
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities(getMockActivities());
    }
  };

  /**
   * Fetch top vendors by spending
   */
  const fetchTopVendors = async () => {
    try {
      const params = new URLSearchParams({
        projectId: projectId,
        size: 5,
        sortBy: 'totalPurchaseValue',
        sortDirection: 'DESC'
      });
      
      const response = await fetch(
        `${API_BASE_URL}/api/vendors?${params}`,
        { credentials: "include",headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setTopVendors(data.vendors || getMockVendors());
      } else {
        setTopVendors(getMockVendors());
      }
    } catch (error) {
      console.error('Error fetching top vendors:', error);
      setTopVendors(getMockVendors());
    }
  };

  /**
   * Fetch spending trend over time
   */
  const fetchSpendingTrend = async () => {
    try {
      const params = new URLSearchParams({
        projectId: projectId,
        size: 1000
      });
      
      const response = await fetch(
        `${API_BASE_URL}/api/purchase-orders?${params}`,
        { credentials: "include",headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        const trend = generateSpendingTrend(data.purchaseOrders || []);
        setSpendingTrend(trend.length > 0 ? trend : getMockSpendingTrend());
      } else {
        setSpendingTrend(getMockSpendingTrend());
      }
    } catch (error) {
      console.error('Error fetching spending trend:', error);
      setSpendingTrend(getMockSpendingTrend());
    }
  };

  /**
   * Generate project timeline
   */
  const generateProjectTimeline = (project) => {
    if (!project) return;

    const timeline = [];
    
    // Project start
    if (project.startDate) {
      timeline.push({
        date: project.startDate,
        title: 'Project Kickoff',
        description: `${project.name} started`,
        type: 'milestone',
        status: 'completed',
        icon: <CheckCircle size={18} />
      });
    }

    // Add milestone at 25% progress
    const now = new Date();
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const progress = ((now - start) / (end - start)) * 100;

    if (progress >= 25 && progress < 50) {
      timeline.push({
        date: new Date(start.getTime() + (end - start) * 0.25),
        title: '25% Milestone',
        description: 'First quarter completed',
        type: 'milestone',
        status: 'completed',
        icon: <CheckCircle size={18} />
      });
    }

    if (progress >= 50 && progress < 75) {
      timeline.push({
        date: new Date(start.getTime() + (end - start) * 0.5),
        title: '50% Milestone',
        description: 'Halfway point reached',
        type: 'milestone',
        status: 'completed',
        icon: <CheckCircle size={18} />
      });
    }

    if (progress >= 75) {
      timeline.push({
        date: new Date(start.getTime() + (end - start) * 0.75),
        title: '75% Milestone',
        description: 'Final quarter underway',
        type: 'milestone',
        status: 'completed',
        icon: <CheckCircle size={18} />
      });
    }

    // Project end
    if (project.endDate) {
      const status = now > end ? 'overdue' : progress > 90 ? 'in-progress' : 'upcoming';
      timeline.push({
        date: project.endDate,
        title: 'Project Completion',
        description: 'Target completion date',
        type: 'milestone',
        status: status,
        icon: status === 'overdue' ? <AlertCircle size={18} /> : 
              status === 'completed' ? <CheckCircle size={18} /> : 
              <Clock size={18} />
      });
    }

    setProjectTimeline(timeline);
  };

  // Helper calculation functions
  const calculateDeliveryRate = (pos) => {
    const totalOrdered = pos.reduce((sum, po) => sum + (po.totalItemsOrdered || 0), 0);
    const totalDelivered = pos.reduce((sum, po) => sum + (po.totalItemsDelivered || 0), 0);
    
    if (totalOrdered === 0) return 0;
    return ((totalDelivered / totalOrdered) * 100).toFixed(1);
  };

  const calculateAvgVendorRating = (vendors) => {
    const ratedVendors = vendors.filter(v => v.rating && v.rating > 0);
    if (ratedVendors.length === 0) return 0;
    
    const totalRating = ratedVendors.reduce((sum, v) => sum + v.rating, 0);
    return (totalRating / ratedVendors.length).toFixed(1);
  };

  const calculatePOsByStatus = (pos) => {
    const statusCount = {};
    pos.forEach(po => {
      statusCount[po.status] = (statusCount[po.status] || 0) + 1;
    });
    return Object.keys(statusCount).map(status => ({
      name: status,
      value: statusCount[status]
    }));
  };

  const calculateQuotationsByStatus = (quotations) => {
    const statusCount = {};
    quotations.forEach(q => {
      statusCount[q.status] = (statusCount[q.status] || 0) + 1;
    });
    return Object.keys(statusCount).map(status => ({
      name: status,
      value: statusCount[status]
    }));
  };

  const calculatePaymentDistribution = (pos) => {
    const paymentCount = {};
    pos.forEach(po => {
      const status = po.paymentStatus || 'Unknown';
      paymentCount[status] = (paymentCount[status] || 0) + 1;
    });
    return Object.keys(paymentCount).map(status => ({
      name: status,
      value: paymentCount[status]
    }));
  };

  const calculateCategoryDistribution = (pos, quotations) => {
    const categorySpend = {};
    
    pos.forEach(po => {
      const category = po.category || 'Uncategorized';
      categorySpend[category] = (categorySpend[category] || 0) + (po.totalValue || 0);
    });
    
    return Object.keys(categorySpend).map(category => ({
      name: category,
      value: categorySpend[category]
    })).sort((a, b) => b.value - a.value).slice(0, 5);
  };

  const generateSpendingTrend = (pos) => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      
      const monthPOs = pos.filter(po => {
        const poDate = new Date(po.orderDate);
        return poDate.getMonth() === date.getMonth() && 
               poDate.getFullYear() === date.getFullYear();
      });

      const totalSpend = monthPOs.reduce((sum, po) => sum + (po.totalValue || 0), 0);
      const poCount = monthPOs.length;

      months.push({
        month: monthName,
        spending: totalSpend,
        orders: poCount,
        avgOrderValue: poCount > 0 ? totalSpend / poCount : 0
      });
    }
    
    return months;
  };

  const calculateProjectProgress = () => {
    if (!projectDetails?.startDate || !projectDetails?.endDate) return 0;
    
    const start = new Date(projectDetails.startDate);
    const end = new Date(projectDetails.endDate);
    const now = new Date();
    
    const total = end - start;
    const elapsed = now - start;
    
    const progress = (elapsed / total) * 100;
    return Math.min(Math.max(progress, 0), 100).toFixed(1);
  };

  const getProjectStatusColor = () => {
    if (!projectDetails) return '#94a3b8';
    
    const statusColors = {
      'Active': '#22c55e',
      'Planning': '#3b82f6',
      'On Hold': '#f59e0b',
      'Completed': '#8b5cf6',
      'Cancelled': '#ef4444'
    };
    
    return statusColors[projectDetails.status] || '#94a3b8';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': '#94a3b8',
      'New': '#3b82f6',
      'Under Review': '#f59e0b',
      'Approved': '#22c55e',
      'Ordered': '#8b5cf6',
      'In-Transit': '#06b6d4',
      'Delivered': '#22c55e',
      'Rejected': '#ef4444',
      'Cancelled': '#ef4444',
      'Pending': '#f59e0b',
      'Partial': '#f97316',
      'Paid': '#22c55e'
    };
    return colors[status] || '#94a3b8';
  };

  // Format functions
  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    } else {
      return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Mock data functions
  const getMockProjectDetails = () => ({
    id: projectId,
    name: 'Sample Construction Project',
    uniqueId: projectId,
    location: 'Hyderabad, Telangana',
    status: 'Active',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    manager: 'Project Manager',
    budget: 50000000 // 5 Crore
  });

  const getMockProcurementData = () => ({
    procurementStats: {
      totalPOs: 15,
      totalPOValue: 15000000,
      avgPOValue: 1000000,
      draftPOs: 2,
      approvedPOs: 3,
      orderedPOs: 4,
      inTransitPOs: 3,
      deliveredPOs: 2,
      cancelledPOs: 1,
      totalItemsOrdered: 150,
      totalItemsDelivered: 80,
      pendingDeliveries: 5,
      deliveryRate: 53.3,
      totalQuotations: 25,
      totalQuotationValue: 18000000,
      newQuotations: 5,
      underReviewQuotations: 8,
      approvedQuotations: 10,
      rejectedQuotations: 2,
      totalVendors: 8,
      activeVendors: 7,
      totalVendorSpend: 15000000,
      avgVendorRating: 4.2,
      pendingPayments: 5,
      partialPayments: 3,
      paidPOs: 7,
      posByStatus: [
        { name: 'Draft', value: 2 },
        { name: 'Approved', value: 3 },
        { name: 'Ordered', value: 4 },
        { name: 'In-Transit', value: 3 },
        { name: 'Delivered', value: 2 },
        { name: 'Cancelled', value: 1 }
      ],
      quotationsByStatus: [
        { name: 'New', value: 5 },
        { name: 'Under Review', value: 8 },
        { name: 'Approved', value: 10 },
        { name: 'Rejected', value: 2 }
      ],
      paymentDistribution: [
        { name: 'Pending', value: 5 },
        { name: 'Partial', value: 3 },
        { name: 'Paid', value: 7 }
      ],
      categoryDistribution: [
        { name: 'IT Equipment', value: 5000000 },
        { name: 'Office Furniture', value: 3000000 },
        { name: 'Construction Materials', value: 4000000 },
        { name: 'Services', value: 2000000 },
        { name: 'Others', value: 1000000 }
      ]
    },
    financialData: {
      totalProjectValue: 50000000,
      totalSpent: 12000000,
      totalCommitted: 15000000,
      remaining: 35000000,
      amountToBeReceived: 50000000,
      amountReceived: 9600000,
      pendingReceipts: 2400000,
      billingPercentage: 19.2,
      totalPayable: 15000000,
      amountPaid: 10000000,
      pendingPayments: 5000000,
      paymentPercentage: 66.7,
      projectedProfit: 35000000,
      profitMargin: 70,
      budgetUtilized: 15000000,
      budgetUtilizationPercent: 30,
      cashInHand: -400000,
      burnRate: 0.8
    }
  });

  const getMockActivities = () => [
    {
      type: 'Purchase Order',
      action: 'PO PO-2025-001 delivered',
      status: 'Delivered',
      amount: 1500000,
      date: new Date().toISOString(),
      icon: <ShoppingCart size={16} />,
      color: '#22c55e'
    },
    {
      type: 'Quotation',
      action: 'Quotation QT-2025-015 approved',
      status: 'Approved',
      amount: 800000,
      date: new Date(Date.now() - 86400000).toISOString(),
      icon: <FileText size={16} />,
      color: '#22c55e'
    }
  ];

  const getMockVendors = () => [
    { id: 1, name: 'ABC Suppliers', totalOrders: 15, rating: 4.5, totalPurchaseValue: 5000000 },
    { id: 2, name: 'XYZ Contractors', totalOrders: 12, rating: 4.2, totalPurchaseValue: 4000000 },
    { id: 3, name: 'Tech Solutions', totalOrders: 8, rating: 4.8, totalPurchaseValue: 3000000 },
    { id: 4, name: 'Office Depot', totalOrders: 10, rating: 4.0, totalPurchaseValue: 2000000 },
    { id: 5, name: 'General Traders', totalOrders: 5, rating: 3.8, totalPurchaseValue: 1000000 }
  ];

  const getMockSpendingTrend = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      
      months.push({
        month: monthName,
        spending: Math.random() * 3000000 + 1000000,
        orders: Math.floor(Math.random() * 5) + 2,
        avgOrderValue: Math.random() * 1000000 + 500000
      });
    }
    
    return months;
  };

  // Chart colors
  const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#10b981'];

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
                onClick={fetchAllDashboardData}
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
        // No project selected
        <div className="project-dashboard-empty-state">
          <Target size={80} className="empty-state-icon" />
          <h2>Select a Project to View Dashboard</h2>
          <p>Choose a project from the dropdown above to see comprehensive analytics, financial details, and procurement overview</p>
        </div>
      ) : (
        <>
          {/* Project Overview Card */}
          {projectDetails && (
            <div className="project-overview-card">
              <div className="project-overview-header">
                <div className="project-overview-info">
                  <h2>{projectDetails.name}</h2>
                  <div className="project-meta">
                    <span className="project-code">
                      <Building2 size={14} />
                      {projectDetails.uniqueId || projectDetails.id}
                    </span>
                    <span 
                      className="project-status-badge" 
                      style={{ backgroundColor: getProjectStatusColor() }}
                    >
                      {projectDetails.status}
                    </span>
                    <span className="project-location">
                      <MapPin size={14} />
                      {projectDetails.location}
                    </span>
                  </div>
                </div>
                <div className="project-progress-section">
                  <div className="progress-circle">
                    <svg viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                      <circle 
                        cx="60" 
                        cy="60" 
                        r="54" 
                        fill="none" 
                        stroke={getProjectStatusColor()}
                        strokeWidth="12" 
                        strokeDasharray={`${calculateProjectProgress() * 3.39} 339`}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                      <text x="60" y="55" textAnchor="middle" className="progress-value">
                        {calculateProjectProgress()}%
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
                    <span className="detail-value">{formatDate(projectDetails.startDate)}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <Calendar size={18} />
                  <div>
                    <span className="detail-label">End Date</span>
                    <span className="detail-value">{formatDate(projectDetails.endDate)}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <User size={18} />
                  <div>
                    <span className="detail-label">Project Manager</span>
                    <span className="detail-value">{projectDetails.manager || 'Not Assigned'}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <DollarSign size={18} />
                  <div>
                    <span className="detail-label">Total Project Value</span>
                    <span className="detail-value">{formatCurrency(financialData?.totalProjectValue || projectDetails.budget)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ENHANCED Financial Overview - Client & Vendor */}
          {financialData && (
            <>
              {/* Top Level KPIs */}
              <div className="dashboard-section">
                <h3 className="section-title">
                  <DollarSign size={20} />
                  Project Financial Overview
                </h3>
                <div className="kpi-grid">
                  <div className="kpi-card highlight" style={{ borderTopColor: '#3b82f6' }}>
                    <div className="kpi-icon" style={{ color: '#3b82f6' }}>
                      <Wallet size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(financialData.totalProjectValue)}</div>
                      <div className="kpi-label">Total Project Value</div>
                      <div className="kpi-subtitle">
                        Expected revenue from client
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card" style={{ borderTopColor: '#22c55e' }}>
                    <div className="kpi-icon" style={{ color: '#22c55e' }}>
                      <TrendingUp size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(financialData.totalSpent)}</div>
                      <div className="kpi-label">Total Spent</div>
                      <div className="kpi-subtitle">
                        {financialData.budgetUtilizationPercent.toFixed(1)}% of project value
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card" style={{ borderTopColor: '#8b5cf6' }}>
                    <div className="kpi-icon" style={{ color: '#8b5cf6' }}>
                      <Target size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(financialData.projectedProfit)}</div>
                      <div className="kpi-label">Projected Profit</div>
                      <div className="kpi-trend positive">
                        <ArrowUp size={14} />
                        {financialData.profitMargin.toFixed(1)}% margin
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card" style={{ borderTopColor: financialData.cashInHand >= 0 ? '#22c55e' : '#ef4444' }}>
                    <div className="kpi-icon" style={{ color: financialData.cashInHand >= 0 ? '#22c55e' : '#ef4444' }}>
                      <Wallet size={36} />
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{formatCurrency(Math.abs(financialData.cashInHand))}</div>
                      <div className="kpi-label">{financialData.cashInHand >= 0 ? 'Cash in Hand' : 'Cash Deficit'}</div>
                      <div className="kpi-subtitle">
                        Received - Paid
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Billing Section */}
              <div className="dashboard-section">
                <h3 className="section-title">
                  <Receipt size={20} />
                  Client Billing & Receipts
                </h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-header">
                      <DollarSign size={24} />
                      <span className="metric-title">Amount to be Received</span>
                    </div>
                    <div className="metric-value">{formatCurrency(financialData.amountToBeReceived)}</div>
                    <div className="metric-breakdown">
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${financialData.billingPercentage}%` }}></div>
                      </div>
                      <span className="metric-item">Total Project Value</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <CheckCircle size={24} />
                      <span className="metric-title">Amount Received</span>
                    </div>
                    <div className="metric-value">{formatCurrency(financialData.amountReceived)}</div>
                    <div className="metric-breakdown">
                      <span className="metric-item success">
                        {financialData.billingPercentage.toFixed(1)}% Received
                      </span>
                      <span className="metric-item">
                        Of total project value
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <Clock size={24} />
                      <span className="metric-title">Pending Receipts</span>
                    </div>
                    <div className="metric-value">{formatCurrency(financialData.pendingReceipts)}</div>
                    <div className="metric-breakdown">
                      <span className="metric-item warning">
                        {(100 - financialData.billingPercentage).toFixed(1)}% Pending
                      </span>
                      <span className="metric-item">
                        To be collected from client
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <TrendingUp size={24} />
                      <span className="metric-title">Billing Progress</span>
                    </div>
                    <div className="metric-value">{financialData.billingPercentage.toFixed(1)}%</div>
                    <div className="metric-breakdown">
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill success" style={{ width: `${financialData.billingPercentage}%` }}></div>
                      </div>
                      <span className="metric-item">Client billing completion</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vendor Payment Section */}
              <div className="dashboard-section">
                <h3 className="section-title">
                  <CreditCard size={20} />
                  Vendor Payments
                </h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-header">
                      <DollarSign size={24} />
                      <span className="metric-title">Total Payable</span>
                    </div>
                    <div className="metric-value">{formatCurrency(financialData.totalPayable)}</div>
                    <div className="metric-breakdown">
                      <span className="metric-item">
                        Total committed to vendors
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <CheckCircle size={24} />
                      <span className="metric-title">Amount Paid</span>
                    </div>
                    <div className="metric-value">{formatCurrency(financialData.amountPaid)}</div>
                    <div className="metric-breakdown">
                      <span className="metric-item success">
                        {financialData.paymentPercentage.toFixed(1)}% Paid
                      </span>
                      <span className="metric-item">
                        Of total payable
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <AlertCircle size={24} />
                      <span className="metric-title">Pending Payments</span>
                    </div>
                    <div className="metric-value">{formatCurrency(financialData.pendingPayments)}</div>
                    <div className="metric-breakdown">
                      <span className="metric-item danger">
                        {(100 - financialData.paymentPercentage).toFixed(1)}% Pending
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
                    <div className="metric-value">{financialData.paymentPercentage.toFixed(1)}%</div>
                    <div className="metric-breakdown">
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill warning" style={{ width: `${financialData.paymentPercentage}%` }}></div>
                      </div>
                      <span className="metric-item">Vendor payment completion</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Procurement Metrics */}
          {procurementData && (
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
                  <div className="metric-value">{procurementData.totalPOs}</div>
                  <div className="metric-breakdown">
                    <span className="metric-item success">
                      <CheckCircle size={14} />
                      {procurementData.deliveredPOs} Delivered
                    </span>
                    <span className="metric-item warning">
                      <Clock size={14} />
                      {procurementData.orderedPOs + procurementData.inTransitPOs} In Progress
                    </span>
                    <span className="metric-item danger">
                      <XCircle size={14} />
                      {procurementData.cancelledPOs} Cancelled
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Package size={24} />
                    <span className="metric-title">Delivery Status</span>
                  </div>
                  <div className="metric-value">{procurementData.deliveryRate}%</div>
                  <div className="metric-breakdown">
                    <span className="metric-item">
                      Delivered: {procurementData.totalItemsDelivered.toLocaleString()}
                    </span>
                    <span className="metric-item">
                      Ordered: {procurementData.totalItemsOrdered.toLocaleString()}
                    </span>
                    <span className="metric-item warning">
                      Pending: {procurementData.pendingDeliveries} POs
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <FileText size={24} />
                    <span className="metric-title">Quotations</span>
                  </div>
                  <div className="metric-value">{procurementData.totalQuotations}</div>
                  <div className="metric-breakdown">
                    <span className="metric-item success">
                      <CheckCircle size={14} />
                      {procurementData.approvedQuotations} Approved
                    </span>
                    <span className="metric-item warning">
                      <Clock size={14} />
                      {procurementData.underReviewQuotations} Under Review
                    </span>
                    <span className="metric-item">
                      {procurementData.newQuotations} New
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Users size={24} />
                    <span className="metric-title">Active Vendors</span>
                  </div>
                  <div className="metric-value">{procurementData.totalVendors}</div>
                  <div className="metric-breakdown">
                    <span className="metric-item">
                      Total Spend: {formatCurrency(procurementData.totalVendorSpend)}
                    </span>
                    <span className="metric-item">
                      Avg Rating: {procurementData.avgVendorRating} ⭐
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="dashboard-charts-grid">
            {/* Spending Trend */}
            {spendingTrend.length > 0 && (
              <div className="chart-card full-width">
                <div className="chart-header">
                  <h4 className="chart-title">
                    <TrendingUp size={18} />
                    Monthly Spending Trend
                  </h4>
                  <span className="chart-subtitle">Last 6 months procurement spend</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={spendingTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'spending') return formatCurrency(value);
                        if (name === 'avgOrderValue') return formatCurrency(value);
                        return value;
                      }}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="spending" 
                      fill="#3b82f6" 
                      stroke="#3b82f6"
                      fillOpacity={0.3}
                      name="Total Spending"
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="orders" 
                      fill="#22c55e"
                      name="Number of Orders"
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="avgOrderValue" 
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Avg Order Value"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* PO Status Distribution */}
            {procurementData?.posByStatus?.length > 0 && (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">
                    <PieChart size={18} />
                    Purchase Orders by Status
                  </h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={procurementData.posByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name} (${entry.value})`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {procurementData.posByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Payment Distribution */}
            {procurementData?.paymentDistribution?.length > 0 && (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">
                    <DollarSign size={18} />
                    Payment Status Distribution
                  </h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={procurementData.paymentDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category Spending */}
            {procurementData?.categoryDistribution?.length > 0 && (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">
                    <BarChart3 size={18} />
                    Top Spending Categories
                  </h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={procurementData.categoryDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Quotation Status */}
            {procurementData?.quotationsByStatus?.length > 0 && (
              <div className="chart-card">
                <div className="chart-header">
                  <h4 className="chart-title">
                    <FileText size={18} />
                    Quotations by Status
                  </h4>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={procurementData.quotationsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Grid - Vendors & Activities */}
          <div className="dashboard-bottom-grid">
            {/* Top Vendors */}
            {topVendors.length > 0 && (
              <div className="dashboard-section">
                <h3 className="section-title">
                  <Users size={20} />
                  Top Vendors by Spending
                </h3>
                <div className="vendors-list">
                  {topVendors.map((vendor, index) => (
                    <div key={vendor.id} className="vendor-item">
                      <div className="vendor-rank">#{index + 1}</div>
                      <div className="vendor-info">
                        <div className="vendor-name">{vendor.name}</div>
                        <div className="vendor-meta">
                          <span className="vendor-orders">
                            {vendor.totalOrders} orders
                          </span>
                          {vendor.rating > 0 && (
                            <span className="vendor-rating">
                              ⭐ {vendor.rating}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="vendor-amount">{formatCurrency(vendor.totalPurchaseValue)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activities */}
            {recentActivities.length > 0 && (
              <div className="dashboard-section">
                <h3 className="section-title">
                  <Activity size={20} />
                  Recent Activities
                </h3>
                <div className="activities-timeline">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div 
                        className="activity-icon"
                        style={{ backgroundColor: activity.color }}
                      >
                        {activity.icon}
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
          </div>

          {/* Project Timeline */}
          {projectTimeline.length > 0 && (
            <div className="dashboard-section">
              <h3 className="section-title">
                <Clock size={20} />
                Project Timeline & Milestones
              </h3>
              <div className="project-timeline-container">
                {projectTimeline.map((milestone, index) => (
                  <div key={index} className={`timeline-milestone ${milestone.status}`}>
                    <div className="milestone-marker">
                      {milestone.icon}
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
          )}
        </>
      )}
    </div>
  );
};

export default ProjectDashboard;