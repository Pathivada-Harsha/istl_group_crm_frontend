import React, { useState } from 'react';
import '../pages-css/Invoices.css';
import GroupProjectFilter from "./../components/Dropdowns/GroupProjectFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
// Sample data
const sampleInvoices = [
  {
    id: 'INV-2024-001',
    clientName: 'Acme Corporation',
    invoiceTitle: 'Website Development Services',
    amount: 85000,
    gstAmount: 15300,
    totalPayable: 100300,
    paymentStatus: 'Paid',
    invoiceStatus: 'Sent',
    invoiceDate: '2024-11-15',
    dueDate: '2024-12-15',
    preparedBy: 'John Smith',
    quotationRef: 'QUO-2024-089',
    companyName: 'Acme Corporation',
    email: 'contact@acme.com',
    phone: '+91 98765 43210',
    billingAddress: '123 Business Park, Mumbai, Maharashtra 400001',
    gstNumber: '27AABCU9603R1ZM',
    items: [
      { name: 'Frontend Development', description: 'React-based UI', quantity: 1, unitPrice: 50000, tax: 18 },
      { name: 'Backend Development', description: 'Node.js API', quantity: 1, unitPrice: 35000, tax: 18 }
    ],
    payments: [
      { date: '2024-11-20', amount: 100300, method: 'Bank Transfer' }
    ],
    termsConditions: 'Payment due within 30 days. Late payments subject to 2% monthly interest.',
    notes: 'Thank you for your business!'
  },
  {
    id: 'INV-2024-002',
    clientName: 'Tech Innovators',
    invoiceTitle: 'Mobile App Development',
    amount: 120000,
    gstAmount: 21600,
    totalPayable: 141600,
    paymentStatus: 'Partially Paid',
    invoiceStatus: 'Sent',
    invoiceDate: '2024-11-20',
    dueDate: '2024-12-20',
    preparedBy: 'Sarah Johnson',
    quotationRef: 'QUO-2024-092',
    companyName: 'Tech Innovators Pvt Ltd',
    email: 'info@techinnovators.com',
    phone: '+91 99887 76655',
    billingAddress: '456 Tech Tower, Bangalore, Karnataka 560001',
    gstNumber: '29AACCT1234Q1Z5',
    items: [
      { name: 'iOS App Development', description: 'Native Swift app', quantity: 1, unitPrice: 60000, tax: 18 },
      { name: 'Android App Development', description: 'Native Kotlin app', quantity: 1, unitPrice: 60000, tax: 18 }
    ],
    payments: [
      { date: '2024-11-25', amount: 70800, method: 'UPI' }
    ],
    termsConditions: 'Payment due within 30 days.',
    notes: 'Milestone-based payment schedule applies.'
  },
  {
    id: 'INV-2024-003',
    clientName: 'Global Enterprises',
    invoiceTitle: 'Cloud Infrastructure Setup',
    amount: 65000,
    gstAmount: 11700,
    totalPayable: 76700,
    paymentStatus: 'Pending',
    invoiceStatus: 'Overdue',
    invoiceDate: '2024-10-25',
    dueDate: '2024-11-25',
    preparedBy: 'Michael Chen',
    quotationRef: 'QUO-2024-078',
    companyName: 'Global Enterprises Ltd',
    email: 'billing@globalent.com',
    phone: '+91 88776 65544',
    billingAddress: '789 Business Center, Delhi, NCR 110001',
    gstNumber: '07AADCG1234M1ZP',
    items: [
      { name: 'AWS Infrastructure', description: 'EC2, S3, RDS setup', quantity: 1, unitPrice: 45000, tax: 18 },
      { name: 'DevOps Configuration', description: 'CI/CD pipeline', quantity: 1, unitPrice: 20000, tax: 18 }
    ],
    payments: [],
    termsConditions: 'Payment due within 30 days.',
    notes: 'Includes 3 months support.'
  },
  {
    id: 'INV-2024-004',
    clientName: 'StartUp Inc',
    invoiceTitle: 'Digital Marketing Campaign',
    amount: 45000,
    gstAmount: 8100,
    totalPayable: 53100,
    paymentStatus: 'Pending',
    invoiceStatus: 'Sent',
    invoiceDate: '2024-12-01',
    dueDate: '2024-12-31',
    preparedBy: 'Emily Davis',
    quotationRef: 'QUO-2024-095',
    companyName: 'StartUp Inc',
    email: 'hello@startupinc.com',
    phone: '+91 77665 54433',
    billingAddress: '321 Innovation Hub, Pune, Maharashtra 411001',
    gstNumber: '27AACCS1234N1Z6',
    items: [
      { name: 'Social Media Marketing', description: '3 months campaign', quantity: 1, unitPrice: 30000, tax: 18 },
      { name: 'SEO Services', description: 'Keyword optimization', quantity: 1, unitPrice: 15000, tax: 18 }
    ],
    payments: [],
    termsConditions: 'Payment due within 30 days.',
    notes: 'Monthly reporting included.'
  },
  {
    id: 'INV-2024-005',
    clientName: 'Future Systems',
    invoiceTitle: 'ERP System Customization',
    amount: 95000,
    gstAmount: 17100,
    totalPayable: 112100,
    paymentStatus: 'Pending',
    invoiceStatus: 'Draft',
    invoiceDate: '2024-12-05',
    dueDate: '2025-01-05',
    preparedBy: 'Robert Lee',
    quotationRef: 'QUO-2024-098',
    companyName: 'Future Systems Pvt Ltd',
    email: 'contact@futuresystems.com',
    phone: '+91 99887 12345',
    billingAddress: '555 Tech Valley, Hyderabad, Telangana 500001',
    gstNumber: '36AACCP1234P1Z7',
    items: [
      { name: 'ERP Module Development', description: 'Custom modules', quantity: 1, unitPrice: 70000, tax: 18 },
      { name: 'Training & Documentation', description: 'User training', quantity: 1, unitPrice: 25000, tax: 18 }
    ],
    payments: [],
    termsConditions: 'Payment due within 30 days.',
    notes: 'Draft - pending client approval.'
  }
];

const InvoicesManagementPage = () => {
  const [invoices, setInvoices] = useState(sampleInvoices);
  const [filteredInvoices, setFilteredInvoices] = useState(sampleInvoices);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('All');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { groupName, subGroupName, projectId, updateFilters } = useGroupProjectFilters();
  // Form states
  const [formData, setFormData] = useState({
    invoiceTitle: '',
    clientName: '',
    companyName: '',
    email: '',
    phone: '',
    billingAddress: '',
    gstNumber: '',
    quotationRef: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: [{ name: '', description: '', quantity: 1, unitPrice: 0, tax: 18 }],
    termsConditions: '',
    notes: ''
  });

  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'Bank Transfer',
    notes: ''
  });

  // Search and filter
  const handleSearch = (value) => {
    setSearchTerm(value);
    applyFilters(value, filterStatus, filterPaymentStatus);
  };

  const applyFilters = (search, status, paymentStatus) => {
    let filtered = invoices;

    if (search) {
      filtered = filtered.filter(inv =>
        inv.id.toLowerCase().includes(search.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
        inv.companyName.toLowerCase().includes(search.toLowerCase()) ||
        inv.quotationRef.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status !== 'All') {
      filtered = filtered.filter(inv => inv.invoiceStatus === status);
    }

    if (paymentStatus !== 'All') {
      filtered = filtered.filter(inv => inv.paymentStatus === paymentStatus);
    }

    setFilteredInvoices(filtered);
    setCurrentPage(1);
  };

  const handleStatusFilter = (value) => {
    setFilterStatus(value);
    applyFilters(searchTerm, value, filterPaymentStatus);
  };

  const handlePaymentStatusFilter = (value) => {
    setFilterPaymentStatus(value);
    applyFilters(searchTerm, filterStatus, value);
  };

  // View invoice
  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
    setEditMode(false);
  };

  // Create/Edit invoice
  const handleCreateNew = () => {
    setFormData({
      invoiceTitle: '',
      clientName: '',
      companyName: '',
      email: '',
      phone: '',
      billingAddress: '',
      gstNumber: '',
      quotationRef: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [{ name: '', description: '', quantity: 1, unitPrice: 0, tax: 18 }],
      termsConditions: 'Payment due within 30 days.',
      notes: ''
    });
    setShowCreateModal(true);
    setEditMode(false);
  };

  const handleEditInvoice = (invoice) => {
    setFormData({
      invoiceTitle: invoice.invoiceTitle,
      clientName: invoice.clientName,
      companyName: invoice.companyName,
      email: invoice.email,
      phone: invoice.phone,
      billingAddress: invoice.billingAddress,
      gstNumber: invoice.gstNumber,
      quotationRef: invoice.quotationRef,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      items: invoice.items,
      termsConditions: invoice.termsConditions,
      notes: invoice.notes
    });
    setSelectedInvoice(invoice);
    setShowCreateModal(true);
    setEditMode(true);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', description: '', quantity: 1, unitPrice: 0, tax: 18 }]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateInvoice = () => {
    let subtotal = 0;
    let taxTotal = 0;

    formData.items.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = (lineTotal * item.tax) / 100;
      subtotal += lineTotal;
      taxTotal += lineTax;
    });

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal
    };
  };

  const handleSaveInvoice = (status) => {
    const totals = calculateInvoice();
    const newInvoice = {
      id: editMode ? selectedInvoice.id : `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      ...formData,
      amount: totals.subtotal,
      gstAmount: totals.taxTotal,
      totalPayable: totals.grandTotal,
      paymentStatus: 'Pending',
      invoiceStatus: status,
      preparedBy: 'Current User',
      payments: editMode ? selectedInvoice.payments : []
    };

    if (editMode) {
      const updated = invoices.map(inv => inv.id === selectedInvoice.id ? newInvoice : inv);
      setInvoices(updated);
      setFilteredInvoices(updated);
    } else {
      setInvoices([...invoices, newInvoice]);
      setFilteredInvoices([...invoices, newInvoice]);
    }

    setShowCreateModal(false);
    alert(`Invoice ${editMode ? 'updated' : 'created'} successfully!`);
  };

  // Record payment
  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      date: new Date().toISOString().split('T')[0],
      amount: invoice.totalPayable - (invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0),
      method: 'Bank Transfer',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = () => {
    const newPayment = {
      date: paymentData.date,
      amount: parseFloat(paymentData.amount),
      method: paymentData.method,
      notes: paymentData.notes
    };

    const updatedInvoice = { ...selectedInvoice };
    updatedInvoice.payments = [...(updatedInvoice.payments || []), newPayment];

    const totalPaid = updatedInvoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = updatedInvoice.totalPayable - totalPaid;

    if (balanceDue <= 0) {
      updatedInvoice.paymentStatus = 'Paid';
    } else if (totalPaid > 0) {
      updatedInvoice.paymentStatus = 'Partially Paid';
    }

    const updated = invoices.map(inv => inv.id === selectedInvoice.id ? updatedInvoice : inv);
    setInvoices(updated);
    setFilteredInvoices(updated);
    setShowPaymentModal(false);
    alert('Payment recorded successfully!');
  };

  // Delete invoice
  const handleDeleteInvoice = (id) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      const updated = invoices.filter(inv => inv.id !== id);
      setInvoices(updated);
      setFilteredInvoices(updated);
      alert('Invoice deleted successfully!');
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'Draft': 'Invoices-page-status-draft',
      'Sent': 'Invoices-page-status-sent',
      'Paid': 'Invoices-page-status-paid',
      'Overdue': 'Invoices-page-status-overdue',
      'Cancelled': 'Invoices-page-status-cancelled'
    };
    return statusMap[status] || '';
  };

  const getPaymentStatusClass = (status) => {
    const statusMap = {
      'Pending': 'Invoices-page-payment-pending',
      'Partially Paid': 'Invoices-page-payment-partial',
      'Paid': 'Invoices-page-payment-paid'
    };
    return statusMap[status] || '';
  };

  return (
    <div className="Invoices-page-container">
      {/* Breadcrumb */}
      <div className="Invoices-page-breadcrumb">
        <span>Pages</span>
        <span className="Invoices-page-separator">{'>'}</span>
        <span className="Invoices-page-current">Invoices</span>
      </div>


      <div className="page-header-with-filter">
        <h1 className="Invoices-page-title">Invoices</h1>

        <GroupProjectFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          projectValue={projectId}
          onChange={updateFilters}
        />
      </div>
      {/* Action Bar */}
      <div className="Invoices-page-action-bar">
        <div className="Invoices-page-search-filters">
          <input
            type="text"
            className="Invoices-page-search"
            placeholder="Search invoices by ID, client, company..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />

          <select
            className="Invoices-page-filter"
            value={filterStatus}
            onChange={(e) => handleStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            className="Invoices-page-filter"
            value={filterPaymentStatus}
            onChange={(e) => handlePaymentStatusFilter(e.target.value)}
          >
            <option value="All">Payment Status</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="Invoices-page-actions">
          <button className="Invoices-page-btn-secondary">Export Excel</button>
          <button className="Invoices-page-btn-primary" onClick={handleCreateNew}>
            + Create New Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="Invoices-page-stats">
        <div className="Invoices-page-stat-card">
          <div className="Invoices-page-stat-label">Total Invoices</div>
          <div className="Invoices-page-stat-value">{invoices.length}</div>
        </div>
        <div className="Invoices-page-stat-card">
          <div className="Invoices-page-stat-label">Paid</div>
          <div className="Invoices-page-stat-value Invoices-page-stat-success">
            {invoices.filter(inv => inv.paymentStatus === 'Paid').length}
          </div>
        </div>
        <div className="Invoices-page-stat-card">
          <div className="Invoices-page-stat-label">Pending</div>
          <div className="Invoices-page-stat-value Invoices-page-stat-warning">
            {invoices.filter(inv => inv.paymentStatus === 'Pending').length}
          </div>
        </div>
        <div className="Invoices-page-stat-card">
          <div className="Invoices-page-stat-label">Overdue</div>
          <div className="Invoices-page-stat-value Invoices-page-stat-danger">
            {invoices.filter(inv => inv.invoiceStatus === 'Overdue').length}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="Invoices-page-table-container">
        <table className="Invoices-page-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Client Name</th>
              <th>Invoice Title</th>
              <th>Amount</th>
              <th>GST/Tax</th>
              <th>Total Payable</th>
              <th>Payment Status</th>
              <th>Invoice Status</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Prepared By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentInvoices.map(invoice => (
              <tr key={invoice.id}>
                <td className="Invoices-page-invoice-id">{invoice.id}</td>
                <td>{invoice.clientName}</td>
                <td>{invoice.invoiceTitle}</td>
                <td>{formatCurrency(invoice.amount)}</td>
                <td>{formatCurrency(invoice.gstAmount)}</td>
                <td className="Invoices-page-total">{formatCurrency(invoice.totalPayable)}</td>
                <td>
                  <span className={`Invoices-page-badge ${getPaymentStatusClass(invoice.paymentStatus)}`}>
                    {invoice.paymentStatus}
                  </span>
                </td>
                <td>
                  <span className={`Invoices-page-badge ${getStatusClass(invoice.invoiceStatus)}`}>
                    {invoice.invoiceStatus}
                  </span>
                </td>
                <td>{invoice.invoiceDate}</td>
                <td>{invoice.dueDate}</td>
                <td>{invoice.preparedBy}</td>
                <td>
                  <div className="Invoices-page-action-buttons">
                    <button
                      className="Invoices-page-action-btn Invoices-page-btn-view"
                      onClick={() => handleViewInvoice(invoice)}
                      title="View"
                    >
                      👁
                    </button>
                    <button
                      className="Invoices-page-action-btn Invoices-page-btn-edit"
                      onClick={() => handleEditInvoice(invoice)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="Invoices-page-action-btn Invoices-page-btn-payment"
                      onClick={() => handleRecordPayment(invoice)}
                      title="Record Payment"
                    >
                      💰
                    </button>
                    <button
                      className="Invoices-page-action-btn Invoices-page-btn-delete"
                      onClick={() => handleDeleteInvoice(invoice.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="Invoices-page-pagination">
        <div className="Invoices-page-pagination-info">
          Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredInvoices.length)} of {filteredInvoices.length} invoices
        </div>
        <div className="Invoices-page-pagination-controls">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="Invoices-page-pagination-btn"
          >
            Previous
          </button>
          <span className="Invoices-page-pagination-current">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="Invoices-page-pagination-btn"
          >
            Next
          </button>
        </div>
      </div>

      {/* View Invoice Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="Invoices-page-modal Invoices-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>Invoice Details</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowInvoiceModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-invoice-view">
                {/* Header Section */}
                <div className="Invoices-page-invoice-header">
                  <div className="Invoices-page-invoice-company">
                    <h1>INVOICE</h1>
                    <p className="Invoices-page-invoice-number">{selectedInvoice.id}</p>
                  </div>
                  <div className="Invoices-page-invoice-status-badge">
                    <span className={`Invoices-page-badge ${getStatusClass(selectedInvoice.invoiceStatus)}`}>
                      {selectedInvoice.invoiceStatus}
                    </span>
                  </div>
                </div>

                <div className="Invoices-page-invoice-meta">
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>Invoice Date:</strong> {selectedInvoice.invoiceDate}
                  </div>
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>Due Date:</strong> {selectedInvoice.dueDate}
                  </div>
                  <div className="Invoices-page-invoice-meta-item">
                    <strong>Reference:</strong> {selectedInvoice.quotationRef}
                  </div>
                </div>

                {/* Client Information */}
                <div className="Invoices-page-invoice-section">
                  <h3>Bill To</h3>
                  <div className="Invoices-page-client-info">
                    <p><strong>{selectedInvoice.companyName}</strong></p>
                    <p>{selectedInvoice.clientName}</p>
                    <p>{selectedInvoice.email}</p>
                    <p>{selectedInvoice.phone}</p>
                    <p>{selectedInvoice.billingAddress}</p>
                    {selectedInvoice.gstNumber && <p><strong>GST:</strong> {selectedInvoice.gstNumber}</p>}
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="Invoices-page-invoice-section">
                  <h3>{selectedInvoice.invoiceTitle}</h3>
                  <table className="Invoices-page-invoice-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Tax %</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item, index) => {
                        const lineTotal = item.quantity * item.unitPrice;
                        const lineTax = (lineTotal * item.tax) / 100;
                        return (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.description}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td>{item.tax}%</td>
                            <td>{formatCurrency(lineTotal + lineTax)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="Invoices-page-invoice-totals">
                  <div className="Invoices-page-total-row">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedInvoice.amount)}</span>
                  </div>
                  <div className="Invoices-page-total-row">
                    <span>GST/Tax:</span>
                    <span>{formatCurrency(selectedInvoice.gstAmount)}</span>
                  </div>
                  <div className="Invoices-page-total-row Invoices-page-grand-total">
                    <span>Total Payable:</span>
                    <span>{formatCurrency(selectedInvoice.totalPayable)}</span>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="Invoices-page-invoice-section">
                  <h3>Payment Summary</h3>
                  <div className="Invoices-page-payment-summary">
                    <div className="Invoices-page-payment-info">
                      <div className="Invoices-page-payment-row Invoices-page-balance-due">
                        <span><strong>Balance Due:</strong></span>
                        <span className="Invoices-page-text-danger">
                          {formatCurrency(selectedInvoice.totalPayable - (selectedInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0))}
                        </span>
                      </div>
                    </div>

                    {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                      <div className="Invoices-page-payment-history">
                        <h4>Payment History</h4>
                        {selectedInvoice.payments.map((payment, index) => (
                          <div key={index} className="Invoices-page-payment-item">
                            <span>{payment.date}</span>
                            <span>{payment.method}</span>
                            <span className="Invoices-page-payment-amount">{formatCurrency(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Terms */}
                {selectedInvoice.termsConditions && (
                  <div className="Invoices-page-invoice-section">
                    <h3>Terms & Conditions</h3>
                    <p>{selectedInvoice.termsConditions}</p>
                  </div>
                )}

                {selectedInvoice.notes && (
                  <div className="Invoices-page-invoice-section">
                    <h3>Notes</h3>
                    <p>{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="Invoices-page-modal-footer">
              <button className="Invoices-page-btn-secondary" onClick={() => handleEditInvoice(selectedInvoice)}>
                Edit Invoice
              </button>
              <button className="Invoices-page-btn-secondary">Download PDF</button>
              <button className="Invoices-page-btn-secondary">Send to Client</button>
              <button className="Invoices-page-btn-primary" onClick={() => {
                setShowInvoiceModal(false);
                handleRecordPayment(selectedInvoice);
              }}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Invoice Modal */}
      {showCreateModal && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="Invoices-page-modal Invoices-page-modal-large" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>{editMode ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-form">
                {/* Invoice Details */}
                <div className="Invoices-page-form-section">
                  <h3>Invoice Details</h3>
                  <div className="Invoices-page-form-grid">
                    <div className="Invoices-page-form-group">
                      <label>Invoice Title*</label>
                      <input
                        type="text"
                        value={formData.invoiceTitle}
                        onChange={(e) => setFormData({ ...formData, invoiceTitle: e.target.value })}
                        placeholder="e.g., Website Development Services"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Quotation Reference</label>
                      <input
                        type="text"
                        value={formData.quotationRef}
                        onChange={(e) => setFormData({ ...formData, quotationRef: e.target.value })}
                        placeholder="QUO-2024-XXX"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Invoice Date*</label>
                      <input
                        type="date"
                        value={formData.invoiceDate}
                        onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Due Date*</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Client Information */}
                <div className="Invoices-page-form-section">
                  <h3>Client Information</h3>
                  <div className="Invoices-page-form-grid">
                    <div className="Invoices-page-form-group">
                      <label>Client Name*</label>
                      <input
                        type="text"
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Company Name*</label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="Company Pvt Ltd"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Email*</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@company.com"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>Phone*</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 99999 99999"
                      />
                    </div>
                    <div className="Invoices-page-form-group Invoices-page-form-group-full">
                      <label>Billing Address*</label>
                      <textarea
                        value={formData.billingAddress}
                        onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                        placeholder="Full billing address"
                        rows="2"
                      />
                    </div>
                    <div className="Invoices-page-form-group">
                      <label>GST Number</label>
                      <input
                        type="text"
                        value={formData.gstNumber}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                        placeholder="27AABCU9603R1ZM"
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="Invoices-page-form-section">
                  <div className="Invoices-page-section-header">
                    <h3>Invoice Items</h3>
                    <button className="Invoices-page-btn-secondary" onClick={addItem}>+ Add Item</button>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="Invoices-page-item-row">
                      <div className="Invoices-page-form-grid Invoices-page-item-grid">
                        <div className="Invoices-page-form-group">
                          <label>Item Name*</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            placeholder="Service/Product name"
                          />
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-wide">
                          <label>Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Brief description"
                          />
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Qty*</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            min="1"
                          />
                        </div>
                        <div className="Invoices-page-form-group">
                          <label>Unit Price*</label>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                            min="0"
                            placeholder="0"
                          />
                        </div>
                        <div className="Invoices-page-form-group Invoices-page-form-group-small">
                          <label>Tax %</label>
                          <input
                            type="number"
                            value={item.tax}
                            onChange={(e) => updateItem(index, 'tax', parseFloat(e.target.value))}
                            min="0"
                            max="100"
                          />
                        </div>
                        <div className="Invoices-page-form-group">
                          <label>Line Total</label>
                          <div className="Invoices-page-calculated-value">
                            {formatCurrency(item.quantity * item.unitPrice * (1 + item.tax / 100))}
                          </div>
                        </div>
                        <div className="Invoices-page-item-actions">
                          {formData.items.length > 1 && (
                            <button
                              className="Invoices-page-btn-icon-danger"
                              onClick={() => removeItem(index)}
                              title="Remove item"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="Invoices-page-invoice-totals Invoices-page-form-totals">
                    <div className="Invoices-page-total-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(calculateInvoice().subtotal)}</span>
                    </div>
                    <div className="Invoices-page-total-row">
                      <span>Tax Total:</span>
                      <span>{formatCurrency(calculateInvoice().taxTotal)}</span>
                    </div>
                    <div className="Invoices-page-total-row Invoices-page-grand-total">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(calculateInvoice().grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Notes */}
                <div className="Invoices-page-form-section">
                  <h3>Additional Information</h3>
                  <div className="Invoices-page-form-group">
                    <label>Terms & Conditions</label>
                    <textarea
                      value={formData.termsConditions}
                      onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
                      placeholder="Payment terms, conditions, etc."
                      rows="3"
                    />
                  </div>
                  <div className="Invoices-page-form-group">
                    <label>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes for the client"
                      rows="2"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="Invoices-page-modal-footer">
              <button className="Invoices-page-btn-secondary" onClick={() => handleSaveInvoice('Draft')}>
                Save as Draft
              </button>
              <button className="Invoices-page-btn-primary" onClick={() => handleSaveInvoice('Sent')}>
                {editMode ? 'Update Invoice' : 'Create & Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="Invoices-page-modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="Invoices-page-modal" onClick={e => e.stopPropagation()}>
            <div className="Invoices-page-modal-header">
              <h2>Record Payment</h2>
              <button className="Invoices-page-modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>

            <div className="Invoices-page-modal-body">
              <div className="Invoices-page-payment-summary-box">
                <div className="Invoices-page-payment-detail">
                  <span>Invoice ID:</span>
                  <strong>{selectedInvoice.id}</strong>
                </div>
                <div className="Invoices-page-payment-detail">
                  <span>Total Amount:</span>
                  <strong>{formatCurrency(selectedInvoice.totalPayable)}</strong>
                </div>
                <div className="Invoices-page-payment-detail">
                  <span>Already Paid:</span>
                  <strong className="Invoices-page-text-success">
                    {formatCurrency(selectedInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)}
                  </strong>
                </div>
                <div className="Invoices-page-payment-detail">
                  <span>Balance Due:</span>
                  <strong className="Invoices-page-text-danger">
                    {formatCurrency(selectedInvoice.totalPayable - (selectedInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0))}
                  </strong>
                </div>
              </div>

              <div className="Invoices-page-form">
                <div className="Invoices-page-form-group">
                  <label>Payment Date*</label>
                  <input
                    type="date"
                    value={paymentData.date}
                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                  />
                </div>
                <div className="Invoices-page-form-group">
                  <label>Amount Paid*</label>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="Invoices-page-form-group">
                  <label>Payment Method*</label>
                  <select
                    value={paymentData.method}
                    onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
                <div className="Invoices-page-form-group">
                  <label>Notes</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    placeholder="Transaction reference, notes, etc."
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="Invoices-page-modal-footer">
              <button className="Invoices-page-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
              <button className="Invoices-page-btn-primary" onClick={handleSavePayment}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesManagementPage;