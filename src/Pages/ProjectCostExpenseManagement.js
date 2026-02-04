import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, Plus, X, Edit2, Eye, Trash2,
  Calendar, DollarSign, IndianRupee, CreditCard, User, 
  FileText, CheckCircle, Clock, XCircle, TrendingUp,
  Briefcase, MapPin, Utensils, Plane, Hotel, Users,
  Upload, ChevronDown, ChevronUp
} from 'lucide-react';
import '../pages-css/ProjectCostExpenseManagement.css';
import { dummyExpenses, dummyStats, dummyUsers, dummyManagers, dummyProjects } from './DUMMY_DATA.js';

const ProjectCostExpenseManagement = () => {
  // Initialize with dummy data
  const [expenses, setExpenses] = useState(dummyExpenses);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
    paymentMode: 'all',
    dateFrom: '',
    dateTo: '',
    groupName: 'all',
    projectId: 'all'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;

  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [stats, setStats] = useState(dummyStats);

  // Using dummy data for dropdowns
  const [availableUsers, setAvailableUsers] = useState(dummyUsers);
  const [managers, setManagers] = useState(dummyManagers);
  const [projects, setProjects] = useState(dummyProjects);

  // Expense categories
  const expenseCategories = [
    'Travel',
    'Site Visit',
    'Accommodation',
    'Food',
    'Commission',
    'Miscellaneous'
  ];

  const paymentModes = ['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque'];
  const commissionTypes = ['Sales', 'Referral', 'Partner'];
  const statusOptions = ['Pending', 'Approved', 'Rejected'];

  // Filter expenses based on filters
  const getFilteredExpenses = () => {
    let filtered = [...expenses];

    if (filters.search) {
      filtered = filtered.filter(exp => 
        exp.projectName.toLowerCase().includes(filters.search.toLowerCase()) ||
        exp.paidByName.toLowerCase().includes(filters.search.toLowerCase()) ||
        exp.description.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(exp => exp.category === filters.category);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(exp => exp.status === filters.status);
    }

    if (filters.paymentMode !== 'all') {
      filtered = filtered.filter(exp => exp.paymentMode === filters.paymentMode);
    }

    if (filters.groupName !== 'all') {
      filtered = filtered.filter(exp => exp.groupName === filters.groupName);
    }

    if (filters.projectId !== 'all') {
      filtered = filtered.filter(exp => exp.projectId === filters.projectId);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(exp => new Date(exp.expenseDate) >= new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
      filtered = filtered.filter(exp => new Date(exp.expenseDate) <= new Date(filters.dateTo));
    }

    return filtered;
  };

  const filteredExpenses = getFilteredExpenses();
  const totalPages = Math.ceil(filteredExpenses.length / pageSize);
  const totalElements = filteredExpenses.length;
  const paginatedExpenses = filteredExpenses.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const handleAddNewExpense = () => {
    setEditFormData({
      // Trip Details
      tripDate: new Date().toISOString().split('T')[0],
      projectId: '',
      groupName: '',
      subGroupName: '',
      tripReason: '',
      tripOutcome: '',
      visitType: 'Site Visit', // Site Visit, Client Meeting, Installation, Inspection
      paidBy: '',
      approvedBy: '',
      status: 'Pending',
      
      // Expense Items Array
      expenseItems: [
        {
          id: Date.now(),
          category: 'Travel',
          amount: '',
          paymentMode: 'UPI',
          description: '',
          receiptFile: null
        }
      ],
      
      // Commission specific (if needed)
      commissionType: '',
      commissionGivenTo: '',
      commissionPercentage: '',
      commissionFixedAmount: '',
      salesOrderRef: ''
    });
    setShowAddExpenseForm(true);
  };

  const handleAddExpenseItem = () => {
    setEditFormData({
      ...editFormData,
      expenseItems: [
        ...editFormData.expenseItems,
        {
          id: Date.now(),
          category: 'Food',
          amount: '',
          paymentMode: 'Cash',
          description: '',
          receiptFile: null
        }
      ]
    });
  };

  const handleRemoveExpenseItem = (itemId) => {
    setEditFormData({
      ...editFormData,
      expenseItems: editFormData.expenseItems.filter(item => item.id !== itemId)
    });
  };

  const handleExpenseItemChange = (itemId, field, value) => {
    setEditFormData({
      ...editFormData,
      expenseItems: editFormData.expenseItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    });
  };

  const handleCreateExpense = () => {
    if (!editFormData.tripDate || !editFormData.projectId || !editFormData.tripReason) {
      alert('Please fill in required fields (Date, Project, Trip Reason)');
      return;
    }

    if (editFormData.expenseItems.length === 0) {
      alert('Please add at least one expense item');
      return;
    }

    // Validate all expense items
    for (let item of editFormData.expenseItems) {
      if (!item.amount || item.amount <= 0) {
        alert('Please enter valid amounts for all expense items');
        return;
      }
    }

    const selectedProject = projects.find(p => p.id === editFormData.projectId);
    const selectedUser = availableUsers.find(u => u.id === editFormData.paidBy);
    const selectedManager = managers.find(m => m.id === editFormData.approvedBy);

    // Create individual expense records for each item
    const newExpenses = editFormData.expenseItems.map((item, index) => ({
      id: expenses.length + index + 1,
      expenseDate: editFormData.tripDate,
      projectId: editFormData.projectId,
      projectName: selectedProject?.name || '',
      groupName: selectedProject?.groupName || '',
      subGroupName: selectedProject?.subGroupName || '',
      category: item.category,
      amount: parseFloat(item.amount),
      paymentMode: item.paymentMode,
      paidBy: editFormData.paidBy,
      paidByName: selectedUser?.name || '',
      approvedBy: editFormData.approvedBy,
      approvedByName: selectedManager?.name || null,
      status: editFormData.status,
      description: `${editFormData.tripReason} - ${editFormData.visitType} - ${item.description || item.category}`,
      tripReason: editFormData.tripReason,
      tripOutcome: editFormData.tripOutcome,
      visitType: editFormData.visitType,
      commissionType: item.category === 'Commission' ? editFormData.commissionType : null,
      commissionGivenTo: item.category === 'Commission' ? editFormData.commissionGivenTo : null,
      commissionPercentage: item.category === 'Commission' ? editFormData.commissionPercentage : null,
      commissionFixedAmount: item.category === 'Commission' ? editFormData.commissionFixedAmount : null,
      salesOrderRef: item.category === 'Commission' ? editFormData.salesOrderRef : null
    }));

    setExpenses([...newExpenses, ...expenses]);
    setShowAddExpenseForm(false);
    alert(`Trip expenses created successfully! ${newExpenses.length} expense(s) added.`);
  };

  const handleViewExpense = (expense) => {
    setSelectedExpense(expense);
    setShowDetailDrawer(true);
  };

  const handleEditExpense = (expense) => {
    setEditFormData({
      id: expense.id,
      expenseDate: expense.expenseDate,
      projectId: expense.projectId,
      groupName: expense.groupName,
      subGroupName: expense.subGroupName,
      category: expense.category,
      amount: expense.amount,
      paymentMode: expense.paymentMode,
      paidBy: expense.paidBy,
      approvedBy: expense.approvedBy,
      commissionType: expense.commissionType || '',
      commissionGivenTo: expense.commissionGivenTo || '',
      commissionPercentage: expense.commissionPercentage || '',
      commissionFixedAmount: expense.commissionFixedAmount || '',
      salesOrderRef: expense.salesOrderRef || '',
      description: expense.description,
      status: expense.status,
      receiptFile: null
    });
    setShowEditModal(true);
  };

  const handleUpdateExpense = () => {
    if (!editFormData.expenseDate || !editFormData.category || !editFormData.amount) {
      alert('Please fill in required fields');
      return;
    }

    const selectedProject = projects.find(p => p.id === editFormData.projectId);
    const selectedUser = availableUsers.find(u => u.id === editFormData.paidBy);
    const selectedManager = managers.find(m => m.id === editFormData.approvedBy);

    const updatedExpenses = expenses.map(exp => 
      exp.id === editFormData.id 
        ? {
            ...editFormData,
            projectName: selectedProject?.name || exp.projectName,
            groupName: selectedProject?.groupName || exp.groupName,
            subGroupName: selectedProject?.subGroupName || exp.subGroupName,
            paidByName: selectedUser?.name || exp.paidByName,
            approvedByName: selectedManager?.name || null
          }
        : exp
    );

    setExpenses(updatedExpenses);
    setShowEditModal(false);
    alert('Expense updated successfully!');

    if (showDetailDrawer && selectedExpense?.id === editFormData.id) {
      const updated = updatedExpenses.find(e => e.id === editFormData.id);
      setSelectedExpense(updated);
    }
  };

  const handleDeleteExpense = (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    setExpenses(expenses.filter(exp => exp.id !== expenseId));
    setShowDetailDrawer(false);
    alert('Expense deleted successfully');
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'Pending': 'expense-badge-pending',
      'Approved': 'expense-badge-approved',
      'Rejected': 'expense-badge-rejected'
    };
    return statusMap[status] || 'expense-badge-pending';
  };

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Travel': <Plane size={18} />,
      'Site Visit': <MapPin size={18} />,
      'Accommodation': <Hotel size={18} />,
      'Food': <Utensils size={18} />,
      'Commission': <Users size={18} />,
      'Miscellaneous': <Briefcase size={18} />
    };
    return iconMap[category] || <FileText size={18} />;
  };

  const kpiData = [
    {
      title: 'Total Expenses',
      value: formatCurrency(stats.totalExpenses),
      icon: <IndianRupee size={32} />,
      color: '#ef4444'
    },
    {
      title: 'Travel & Site Visit',
      value: formatCurrency(stats.travelAndSiteVisit),
      icon: <Plane size={32} />,
      color: '#3b82f6'
    },
    {
      title: 'Total Commission',
      value: formatCurrency(stats.totalCommission),
      icon: <Users size={32} />,
      color: '#8b5cf6'
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals.toString(),
      icon: <Clock size={32} />,
      color: '#f59e0b'
    },
    {
      title: 'Approved This Month',
      value: formatCurrency(stats.approvedThisMonth),
      icon: <CheckCircle size={32} />,
      color: '#22c55e'
    },
    {
      title: 'Project Margin',
      value: formatCurrency(stats.projectMargin),
      icon: <TrendingUp size={32} />,
      color: '#06b6d4'
    }
  ];

  const uniqueGroups = [...new Set(dummyExpenses.map(e => e.groupName))];

  return (
    <div className="expense-management-container">
      {/* Header */}
      <div className="expense-management-header">
        <div className="expense-management-breadcrumb">
          Dashboard &gt; Finance &gt; Project Cost & Expense Management
        </div>

        <div className="page-header-with-filter">
          <div className="page-title-section">
            <h1 className="expense-management-title">
              Project Cost & Expense Management
            </h1>
            <p className="expense-management-subtitle">
              Track and manage all project-related costs, expenses, and commission payouts
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="expense-management-action-bar">
        <div className="expense-management-search-filters">
          <input
            type="text"
            placeholder="Search by project, description, paid by..."
            className="expense-management-search"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setCurrentPage(0);
            }}
          />

          <select
            className="expense-management-filter"
            value={filters.groupName}
            onChange={(e) => {
              setFilters({ ...filters, groupName: e.target.value, projectId: 'all' });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Groups</option>
            {uniqueGroups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>

          <select
            className="expense-management-filter"
            value={filters.projectId}
            onChange={(e) => {
              setFilters({ ...filters, projectId: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Projects</option>
            {projects
              .filter(p => filters.groupName === 'all' || p.groupName === filters.groupName)
              .map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
          </select>

          <input
            type="date"
            className="expense-management-filter date-filter"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters({ ...filters, dateFrom: e.target.value });
              setCurrentPage(0);
            }}
            placeholder="From Date"
          />

          <input
            type="date"
            className="expense-management-filter date-filter"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters({ ...filters, dateTo: e.target.value });
              setCurrentPage(0);
            }}
            placeholder="To Date"
          />

          <select
            className="expense-management-filter"
            value={filters.category}
            onChange={(e) => {
              setFilters({ ...filters, category: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Categories</option>
            {expenseCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className="expense-management-filter"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Status</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            className="expense-management-filter"
            value={filters.paymentMode}
            onChange={(e) => {
              setFilters({ ...filters, paymentMode: e.target.value });
              setCurrentPage(0);
            }}
          >
            <option value="all">All Payment Modes</option>
            {paymentModes.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>

        <div className="expense-management-actions">
          <button
            className="expense-management-btn-primary"
            onClick={handleAddNewExpense}
          >
            <Plus size={18} /> Add Expense
          </button>
          <button className="expense-management-btn-secondary">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="expense-management-kpi-grid">
        {kpiData.map((kpi, index) => (
          <div key={index} className="expense-management-kpi-card" style={{ borderTopColor: kpi.color }}>
            <div className="expense-management-kpi-icon" style={{ color: kpi.color }}>
              {kpi.icon}
            </div>
            <div className="expense-management-kpi-content">
              <div className="expense-management-kpi-value">{kpi.value}</div>
              <div className="expense-management-kpi-label">{kpi.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="expense-management-table-container">
        <table className="expense-management-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Paid By</th>
              <th>Approved By</th>
              <th>Payment Mode</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedExpenses.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  No expenses found. Add your first expense to get started.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map((expense) => (
                <tr key={expense.id} className="expense-management-table-row">
                  <td>{formatDate(expense.expenseDate)}</td>
                  <td className="expense-project-cell">
                    <div className="expense-project-info">
                      <span className="expense-project-name">{expense.projectName}</span>
                      <span className="expense-project-group">{expense.groupName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="expense-category-cell">
                      {getCategoryIcon(expense.category)}
                      <span>{expense.category}</span>
                    </div>
                  </td>
                  <td className="expense-amount-cell">{formatCurrency(expense.amount)}</td>
                  <td>{expense.paidByName || 'N/A'}</td>
                  <td>{expense.approvedByName || 'Pending'}</td>
                  <td>
                    <div className="expense-payment-mode">
                      <CreditCard size={14} />
                      <span>{expense.paymentMode}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`expense-management-badge ${getStatusBadgeClass(expense.status)}`}>
                      {expense.status}
                    </span>
                  </td>
                  <td>
                    <div className="expense-management-actions-cell">
                      <button
                        className="expense-management-action-btn"
                        onClick={() => handleViewExpense(expense)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="expense-management-action-btn"
                        onClick={() => handleEditExpense(expense)}
                        title="Edit Expense"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="expense-management-action-btn delete-btn"
                        onClick={() => handleDeleteExpense(expense.id)}
                        title="Delete Expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="table-footer">
          <span>
            Showing {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} expenses
          </span>
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </button>

            {[...Array(Math.min(5, totalPages))].map((_, index) => {
              const pageNum = currentPage < 3 ? index : currentPage + index - 2;
              if (pageNum >= 0 && pageNum < totalPages) {
                return (
                  <button
                    key={pageNum}
                    className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum + 1}
                  </button>
                );
              }
              return null;
            })}

            <button
              className="page-btn"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddExpenseForm && editFormData && (
        <div className="expense-management-modal-overlay" onClick={() => setShowAddExpenseForm(false)}>
          <div className="expense-management-edit-modal expense-trip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="expense-management-modal-header">
              <h2>Add Trip Expenses</h2>
              <button className="expense-management-modal-close" onClick={() => setShowAddExpenseForm(false)}>
                ✕
              </button>
            </div>

            <div className="expense-management-edit-form">
              {/* Trip Information */}
              <div className="expense-form-section">
                <h3>Trip Information</h3>
                <div className="expense-form-row">
                  <div className="expense-form-group">
                    <label>Trip Date *</label>
                    <input
                      type="date"
                      value={editFormData.tripDate}
                      onChange={(e) => setEditFormData({ ...editFormData, tripDate: e.target.value })}
                    />
                  </div>
                  <div className="expense-form-group">
                    <label>Project *</label>
                    <select
                      value={editFormData.projectId}
                      onChange={(e) => setEditFormData({ ...editFormData, projectId: e.target.value })}
                    >
                      <option value="">Select Project</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name} - {project.location}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="expense-form-group">
                    <label>Visit Type</label>
                    <select
                      value={editFormData.visitType}
                      onChange={(e) => setEditFormData({ ...editFormData, visitType: e.target.value })}
                    >
                      <option value="Site Visit">Site Visit</option>
                      <option value="Client Meeting">Client Meeting</option>
                      <option value="Installation">Installation</option>
                      <option value="Inspection">Inspection</option>
                      <option value="Training">Training</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="expense-form-row">
                  <div className="expense-form-group">
                    <label>Trip Reason / Purpose *</label>
                    <textarea
                      rows={2}
                      value={editFormData.tripReason}
                      onChange={(e) => setEditFormData({ ...editFormData, tripReason: e.target.value })}
                      placeholder="E.g., Client meeting for project discussion, Site inspection for solar panel installation..."
                    />
                  </div>
                  <div className="expense-form-group">
                    <label>Trip Outcome / Result</label>
                    <textarea
                      rows={2}
                      value={editFormData.tripOutcome}
                      onChange={(e) => setEditFormData({ ...editFormData, tripOutcome: e.target.value })}
                      placeholder="E.g., Successfully completed installation, Client approved project plan..."
                    />
                  </div>
                </div>

                <div className="expense-form-row">
                  <div className="expense-form-group">
                    <label>Paid By</label>
                    <select
                      value={editFormData.paidBy}
                      onChange={(e) => setEditFormData({ ...editFormData, paidBy: e.target.value })}
                    >
                      <option value="">Select User</option>
                      {availableUsers.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="expense-form-group">
                    <label>Approved By</label>
                    <select
                      value={editFormData.approvedBy}
                      onChange={(e) => setEditFormData({ ...editFormData, approvedBy: e.target.value })}
                    >
                      <option value="">Select Manager</option>
                      {managers.map(manager => (
                        <option key={manager.id} value={manager.id}>{manager.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="expense-form-group">
                    <label>Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Expense Items */}
              <div className="expense-form-section">
                <div className="expense-items-header">
                  <h3>Expense Items</h3>
                  <button 
                    type="button"
                    className="expense-management-btn-primary btn-sm"
                    onClick={handleAddExpenseItem}
                  >
                    <Plus size={16} /> Add Expense Item
                  </button>
                </div>

                <div className="expense-items-list">
                  {editFormData.expenseItems.map((item, index) => (
                    <div key={item.id} className="expense-item-card">
                      <div className="expense-item-header">
                        <span className="expense-item-number">Item #{index + 1}</span>
                        {editFormData.expenseItems.length > 1 && (
                          <button
                            type="button"
                            className="expense-item-remove"
                            onClick={() => handleRemoveExpenseItem(item.id)}
                          >
                            <Trash2 size={16} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="expense-form-row">
                        <div className="expense-form-group">
                          <label>Category *</label>
                          <select
                            value={item.category}
                            onChange={(e) => handleExpenseItemChange(item.id, 'category', e.target.value)}
                          >
                            {expenseCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="expense-form-group">
                          <label>Amount (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => handleExpenseItemChange(item.id, 'amount', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="expense-form-group">
                          <label>Payment Mode</label>
                          <select
                            value={item.paymentMode}
                            onChange={(e) => handleExpenseItemChange(item.id, 'paymentMode', e.target.value)}
                          >
                            {paymentModes.map(mode => (
                              <option key={mode} value={mode}>{mode}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="expense-form-group">
                        <label>Description / Notes</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleExpenseItemChange(item.id, 'description', e.target.value)}
                          placeholder="E.g., Flight tickets, Hotel stay, Lunch with client..."
                        />
                      </div>

                      <div className="expense-form-group">
                        <label>Upload Receipt</label>
                        <div className="file-upload-area-small">
                          <Upload size={18} />
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleExpenseItemChange(item.id, 'receiptFile', e.target.files[0])}
                          />
                          <span>Click to upload (PDF, PNG, JPG)</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Amount Display */}
                <div className="expense-items-total">
                  <span>Total Trip Expenses:</span>
                  <span className="total-amount">
                    {formatCurrency(
                      editFormData.expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Commission Details (if any item is Commission category) */}
              {editFormData.expenseItems.some(item => item.category === 'Commission') && (
                <div className="expense-form-section commission-section">
                  <h3>Commission Details</h3>
                  <div className="expense-form-row">
                    <div className="expense-form-group">
                      <label>Commission Type</label>
                      <select
                        value={editFormData.commissionType}
                        onChange={(e) => setEditFormData({ ...editFormData, commissionType: e.target.value })}
                      >
                        <option value="">Select Type</option>
                        {commissionTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="expense-form-group">
                      <label>Commission Given To</label>
                      <input
                        type="text"
                        value={editFormData.commissionGivenTo}
                        onChange={(e) => setEditFormData({ ...editFormData, commissionGivenTo: e.target.value })}
                        placeholder="Name or vendor"
                      />
                    </div>
                  </div>

                  <div className="expense-form-row">
                    <div className="expense-form-group">
                      <label>Commission Percentage (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.commissionPercentage}
                        onChange={(e) => setEditFormData({ ...editFormData, commissionPercentage: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="expense-form-group">
                      <label>Fixed Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.commissionFixedAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, commissionFixedAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="expense-form-group">
                    <label>Sales Order / Invoice Reference</label>
                    <input
                      type="text"
                      value={editFormData.salesOrderRef}
                      onChange={(e) => setEditFormData({ ...editFormData, salesOrderRef: e.target.value })}
                      placeholder="SO-2024-001"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="expense-management-modal-actions">
              <button 
                className="expense-management-btn-primary" 
                onClick={handleCreateExpense}
              >
                Save Trip Expenses ({editFormData.expenseItems.length} items)
              </button>
              <button 
                className="expense-management-btn-secondary" 
                onClick={() => setShowAddExpenseForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal (Single Item) */}
      {showEditModal && editFormData && (
        <div className="expense-management-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="expense-management-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="expense-management-modal-header">
              <h2>Edit Expense</h2>
              <button className="expense-management-modal-close" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <div className="expense-management-edit-form">
              {/* Basic Details */}
              <div className="expense-form-section">
                <h3>Basic Details</h3>
                <div className="expense-form-row">
                  <div className="expense-form-group">
                    <label>Expense Date *</label>
                    <input
                      type="date"
                      value={editFormData.expenseDate}
                      onChange={(e) => setEditFormData({ ...editFormData, expenseDate: e.target.value })}
                    />
                  </div>
                  <div className="expense-form-group">
                    <label>Category *</label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    >
                      {expenseCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="expense-form-group">
                    <label>Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="expense-form-row">
                  <div className="expense-form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="expense-form-group">
                    <label>Payment Mode</label>
                    <select
                      value={editFormData.paymentMode}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentMode: e.target.value })}
                    >
                      {paymentModes.map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="expense-form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="Enter description..."
                  />
                </div>
              </div>
            </div>

            <div className="expense-management-modal-actions">
              <button 
                className="expense-management-btn-primary" 
                onClick={handleUpdateExpense}
              >
                Update Expense
              </button>
              <button 
                className="expense-management-btn-secondary" 
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {showDetailDrawer && selectedExpense && (
        <div className="expense-management-drawer-overlay" onClick={() => setShowDetailDrawer(false)}>
          <div className="expense-management-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="expense-management-drawer-header">
              <div>
                <h2>Expense Details</h2>
                <p className="expense-management-drawer-subtitle">
                  {formatDate(selectedExpense.expenseDate)}
                </p>
              </div>
              <button className="expense-management-drawer-close" onClick={() => setShowDetailDrawer(false)}>
                ✕
              </button>
            </div>

            <div className="expense-management-drawer-content">
              {/* Expense Information */}
              <div className="expense-management-drawer-section">
                <h3>Expense Information</h3>
                <div className="expense-info-grid">
                  <div className="expense-info-item">
                    <Calendar size={18} />
                    <div>
                      <span className="info-label">Expense Date</span>
                      <span className="info-value">{formatDate(selectedExpense.expenseDate)}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <Briefcase size={18} />
                    <div>
                      <span className="info-label">Project</span>
                      <span className="info-value">{selectedExpense.projectName}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <FileText size={18} />
                    <div>
                      <span className="info-label">Category</span>
                      <span className="info-value">{selectedExpense.category}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <IndianRupee size={18} />
                    <div>
                      <span className="info-label">Amount</span>
                      <span className="info-value">{formatCurrency(selectedExpense.amount)}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <CreditCard size={18} />
                    <div>
                      <span className="info-label">Payment Mode</span>
                      <span className="info-value">{selectedExpense.paymentMode}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <User size={18} />
                    <div>
                      <span className="info-label">Paid By</span>
                      <span className="info-value">{selectedExpense.paidByName || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <CheckCircle size={18} />
                    <div>
                      <span className="info-label">Approved By</span>
                      <span className="info-value">{selectedExpense.approvedByName || 'Pending'}</span>
                    </div>
                  </div>
                  <div className="expense-info-item">
                    <FileText size={18} />
                    <div>
                      <span className="info-label">Status</span>
                      <span className={`expense-management-badge ${getStatusBadgeClass(selectedExpense.status)}`}>
                        {selectedExpense.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commission Details */}
              {selectedExpense.category === 'Commission' && (
                <div className="expense-management-drawer-section">
                  <h3>Commission Details</h3>
                  <div className="expense-info-grid">
                    <div className="expense-info-item">
                      <Users size={18} />
                      <div>
                        <span className="info-label">Commission Type</span>
                        <span className="info-value">{selectedExpense.commissionType || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="expense-info-item">
                      <User size={18} />
                      <div>
                        <span className="info-label">Given To</span>
                        <span className="info-value">{selectedExpense.commissionGivenTo || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="expense-info-item">
                      <FileText size={18} />
                      <div>
                        <span className="info-label">Percentage</span>
                        <span className="info-value">
                          {selectedExpense.commissionPercentage ? `${selectedExpense.commissionPercentage}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="expense-info-item">
                      <IndianRupee size={18} />
                      <div>
                        <span className="info-label">Fixed Amount</span>
                        <span className="info-value">
                          {selectedExpense.commissionFixedAmount ? formatCurrency(selectedExpense.commissionFixedAmount) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    {selectedExpense.salesOrderRef && (
                      <div className="expense-info-item full-width">
                        <FileText size={18} />
                        <div>
                          <span className="info-label">Sales Order Reference</span>
                          <span className="info-value">{selectedExpense.salesOrderRef}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedExpense.description && (
                <div className="expense-management-drawer-section">
                  <h3>Description / Remarks</h3>
                  <div className="expense-description-box">
                    <p>{selectedExpense.description}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="expense-management-drawer-actions">
                <button
                  className="expense-management-btn-primary"
                  onClick={() => {
                    setShowDetailDrawer(false);
                    handleEditExpense(selectedExpense);
                  }}
                >
                  Edit Expense
                </button>
                <button
                  className="expense-management-btn-danger"
                  onClick={() => handleDeleteExpense(selectedExpense.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCostExpenseManagement;