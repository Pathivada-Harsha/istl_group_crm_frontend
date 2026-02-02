import React, { useState, useEffect } from 'react';
import { FaEye, FaEdit, FaTrash, FaFilePdf, FaCalendarAlt, FaFileAlt,FaRegTrashAlt } from 'react-icons/fa';
import '../pages-css/Proposals.css';
import { useAuth } from "../hooks/useAuth.js";
import GroupCategoryFilter from "./../components/Dropdowns/groupCategoryFilter.js";
import useGroupProjectFilters from "./../components/Dropdowns/useGroupProjectFilters.js";
import useToast from '../hooks/useToast';
import ToastContainer from './../components/Notification_Toast/ToastContainer.js';
import UnitTypeDropdown from '../components/Dropdowns/Unittypedropdown.js';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// Default template content
const DEFAULT_TEMPLATE = {
  companyName: "SESOLA POWER PROJECTS PROPOSAL PVT LTD",
  aboutUs: `We are a leading provider of renewable energy solutions with expertise in solar power systems. Our team of experienced professionals is committed to delivering high-quality, sustainable energy solutions that meet the unique needs of our clients.

With years of experience in the industry, we have successfully completed numerous projects across various sectors, establishing ourselves as a trusted partner in the transition to clean energy.`,
  aboutSystem: `The proposed solar power system is designed to provide reliable, efficient, and sustainable energy generation. The system includes high-efficiency solar panels, advanced inverters, robust mounting structures, and comprehensive monitoring systems.

Key features:
- High-efficiency solar panels with excellent performance
- Grid-tied inverter system for optimal power conversion
- Durable mounting structures with wind load certification
- Remote monitoring and management capabilities
- Comprehensive safety features and protection systems`,
  paymentTerms: `1. 30% advance payment upon signing of agreement
2. 40% payment on delivery of materials at site
3. 30% payment on successful commissioning and handover

Payment can be made via bank transfer, cheque, or demand draft in favor of SESOLA POWER PROJECTS PROPOSAL PVT LTD.`,
  defectLiabilityPeriod: `Standard 12 months warranty period from date of commissioning and handover.

During this period, any defects in workmanship, materials, or performance will be rectified free of cost. This includes:
- Repair or replacement of defective components
- System performance issues
- Installation-related defects

Extended warranty options are available upon request.`,
  systemPricing: [],
  bomItems: []
};

const ProposalsWithTemplate = () => {
  const { user, pagePermissions } = useAuth();
  const { groupName, subGroupName, updateFilters } = useGroupProjectFilters();

  // Permissions
  const permissions = {
    VIEW: pagePermissions?.PROPOSALS?.includes('VIEW'),
    CREATE: pagePermissions?.PROPOSALS?.includes('CREATE'),
    EDIT: pagePermissions?.PROPOSALS?.includes('EDIT'),
    DELETE: pagePermissions?.PROPOSALS?.includes('DELETE'),
    APPROVE: pagePermissions?.PROPOSALS?.includes('APPROVE'),
    DOWNLOAD: pagePermissions?.PROPOSALS?.includes('DOWNLOAD')
  };

  const currentUser = {
    id: user.id,
    role: user.role,
    name: user.name
  };

  // State variables
  const [bomItemsMaster, setBomItemsMaster] = useState([]);
  const [filteredBomItems, setFilteredBomItems] = useState({});
  const [showBomDropdown, setShowBomDropdown] = useState({});
  const [bomCategories, setBomCategories] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalProposals, setTotalProposals] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPreparedBy, setFilterPreparedBy] = useState('All');

  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteProposalId, setDeleteProposalId] = useState(null);
  const [deleteProposalTitle, setDeleteProposalTitle] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [activeTab, setActiveTab] = useState('company');

  // Custom unit tracking
  const [customUnitInputs, setCustomUnitInputs] = useState({});

  // Form state - Basic Info
  const [formData, setFormData] = useState({
    leadId: '',
    title: '',
    description: '',
    totalValue: '',
    groupName: '',
    subGroupName: '',
    status: 'Draft'
  });

  // Template state
  const [templateData, setTemplateData] = useState({
    companyName: DEFAULT_TEMPLATE.companyName,
    aboutUs: DEFAULT_TEMPLATE.aboutUs,
    aboutSystem: DEFAULT_TEMPLATE.aboutSystem,
    paymentTerms: DEFAULT_TEMPLATE.paymentTerms,
    defectLiabilityPeriod: DEFAULT_TEMPLATE.defectLiabilityPeriod,
    systemPricing: [],
    bomItems: []
  });

  // Toast
  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  // Groups states
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);

  /**
   * Format date to DD-MM-YYYY HH:MM:SS
   */
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  /**
   * Handle unit change for BOM items
   */
  const handleBomUnitChange = (index, value) => {
    if (value === 'Custom') {
      // Enable custom input
      setCustomUnitInputs(prev => ({ ...prev, [index]: '' }));
      updateBOMRow(index, 'unit', '');
    } else {
      // Remove custom input if exists
      const newCustomInputs = { ...customUnitInputs };
      delete newCustomInputs[index];
      setCustomUnitInputs(newCustomInputs);
      updateBOMRow(index, 'unit', value);
    }
  };

  /**
   * Handle custom unit input change
   */
  const handleCustomUnitInput = (index, value) => {
    setCustomUnitInputs(prev => ({ ...prev, [index]: value }));
    updateBOMRow(index, 'unit', value);
  };

  const fetchBomItemsMaster = async (category = null) => {
    try {
      let url = `${API_BASE_URL}/api/bom-items-master/all`;
      if (category) {
        url = `${API_BASE_URL}/api/bom-items-master/by-category?category=${category}`;
      }

      const response = await fetch(url, {
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch BOM items');

      const data = await response.json();
      if (data.success) {
        setBomItemsMaster(data.data || []);
        console.log('Loaded BOM items:', data.data.length);
      }
    } catch (error) {
      console.error('Error fetching BOM items:', error);
      setBomItemsMaster([]);
    }
  };

  const handleBomItemSearch = async (index, searchTerm) => {
    console.log('🔍 Searching BOM items:', searchTerm);

    if (!searchTerm || searchTerm.length < 2) {
      setFilteredBomItems(prev => ({ ...prev, [index]: [] }));
      setShowBomDropdown(prev => ({ ...prev, [index]: false }));
      return;
    }

    try {
      const url = `${API_BASE_URL}/api/bom-items-master/search?searchTerm=${encodeURIComponent(searchTerm)}`;

      const response = await fetch(url, {
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to search BOM items');

      const data = await response.json();
      console.log('✅ Found BOM items:', data.data.length);

      setFilteredBomItems(prev => ({ ...prev, [index]: data.data || [] }));
      setShowBomDropdown(prev => ({ ...prev, [index]: (data.data || []).length > 0 }));

    } catch (error) {
      console.error('Error searching BOM items:', error);
      setFilteredBomItems(prev => ({ ...prev, [index]: [] }));
      setShowBomDropdown(prev => ({ ...prev, [index]: false }));
    }
  };

  const selectBomItem = (index, bomItem) => {
    console.log('🎯 Selected BOM item:', bomItem);

    const updated = [...templateData.bomItems];
    updated[index] = {
      ...updated[index],
      item: bomItem.itemName,
      specification: bomItem.specification || '',
      unit: bomItem.defaultUnit || 'Nos',
      tax: bomItem.defaultTaxPercent || '18'
    };

    setTemplateData({ ...templateData, bomItems: updated });
    setShowBomDropdown(prev => ({ ...prev, [index]: false }));
    setFilteredBomItems(prev => ({ ...prev, [index]: [] }));
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-groups`, {
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setGroups([]);
    }
  };

  const fetchSubGroupsForForm = async (group) => {
    if (!group) {
      setSubGroups([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-subgroups?groupName=${encodeURIComponent(group)}`, {
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subgroups');

      const data = await response.json();
      if (Array.isArray(data)) {
        setSubGroups(data);
      }
    } catch (err) {
      console.error('Error fetching subgroups:', err);
      setSubGroups([]);
    }
  };

  useEffect(() => {
    if (formData.groupName) {
      fetchSubGroupsForForm(formData.groupName);
    } else {
      setSubGroups([]);
    }
  }, [formData.groupName]);

  const fetchWithHeaders = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'User-Id': currentUser.id.toString(),
      'User-Role': currentUser.role,
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers, credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  const parseJSON = (jsonString) => {
    if (!jsonString) return null;
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      return null;
    }
  };

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/proposals/getAll?page=${currentPage - 1}&size=${rowsPerPage}&groupName=${groupName || ''}&subGroupName=${subGroupName || ''}`;
      const data = await fetchWithHeaders(url);

      if (data.success) {
        setProposals(data.data.content || []);
        setTotalProposals(data.data.totalElements || 0);
        setTotalPages(data.data.totalPages || 0);
      }
    } catch (error) {
      console.error('Error fetching proposals:', error);
      showError('Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (groupFilter = null, subGroupFilter = null) => {
    try {
      let url = `${API_BASE_URL}/leads/by-group-subgroup?`;

      if (groupFilter) {
        url += `groupName=${encodeURIComponent(groupFilter)}&`;
      }
      if (subGroupFilter) {
        url += `subGroupName=${encodeURIComponent(subGroupFilter)}`;
      }

      console.log('📡 Fetching leads with filters:', { groupFilter, subGroupFilter });

      const data = await fetchWithHeaders(url);
      if (data.success) {
        setLeads(Array.isArray(data.data) ? data.data : data.data.content || []);
        console.log('✅ Loaded leads:', data.data.length);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filters/leads-users`, {
        credentials: "include",
        headers: {
          'User-Id': currentUser.id,
          'User-Role': currentUser.role
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const filterRequest = {
        searchTerm: searchTerm || null,
        filterStatus: filterStatus !== 'All' ? filterStatus : null,
        filterGroup: groupName || null,
        filterSubGroup: subGroupName || null,
        filterPreparedBy: filterPreparedBy !== 'All' ? parseInt(filterPreparedBy) : null,
        page: currentPage - 1,
        size: rowsPerPage
      };

      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/filter`, {
        method: 'POST',
        body: JSON.stringify(filterRequest)
      });

      if (data.success) {
        setProposals(data.data.content || []);
        setTotalProposals(data.data.totalElements || 0);
        setTotalPages(data.data.totalPages || 0);
      }
    } catch (error) {
      console.error('Error filtering proposals:', error);
      showError('Failed to filter proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.leadId) {
      showWarning('Please fill in Title and Lead');
      return;
    }

    try {
      const requestData = {
        ...formData,
        ...templateData,
        systemPricing: JSON.stringify(templateData.systemPricing),
        bomItems: JSON.stringify(templateData.bomItems)
      };

      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/create`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (data.success) {
        showSuccess('Proposal created successfully!');
        setShowCreateModal(false);
        setShowTemplateModal(false);
        resetForm();
        fetchProposals();
      }
    } catch (error) {
      console.error('Error creating proposal:', error);
      showError('Failed to create proposal');
    }
  };

  const handleUpdate = async () => {
    if (!formData.title) {
      showError('Please fill in Title');
      return;
    }

    try {
      const requestData = {
        ...formData,
        ...templateData,
        systemPricing: JSON.stringify(templateData.systemPricing),
        bomItems: JSON.stringify(templateData.bomItems)
      };

      const data = await fetchWithHeaders(
        `${API_BASE_URL}/proposals/update/${selectedProposal.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(requestData)
        }
      );

      if (data.success) {
        showSuccess(data.message || 'Data saved successfully!');
        setShowCreateModal(false);
        setShowTemplateModal(false);
        resetForm();
        fetchProposals();
      } else {
        showError(data.message || 'Failed to load data');
      }

    } catch (error) {
      console.error('Error updating proposal:', error);
      showError('Failed to load data');
    }
  };

  const handleDeleteClick = (id, title) => {
    setDeleteProposalId(id);
    setDeleteProposalTitle(title);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/delete/${deleteProposalId}`, {
        method: 'DELETE'
      });

      if (data.success) {
        showSuccess('Proposal deleted successfully!');
        setShowDeleteModal(false);
        setDeleteProposalId(null);
        setDeleteProposalTitle('');
        fetchProposals();
      }
    } catch (error) {
      console.error('Error deleting proposal:', error);
      showError('Failed to delete proposal');
      setShowDeleteModal(false);
    }
  };

  const handleDownloadPDF = async (id) => {
    try {
      const headers = {
        'User-Id': currentUser.id.toString(),
        'User-Role': currentUser.role
      };

      const response = await fetch(`${API_BASE_URL}/proposals/download-pdf/${id}`, { credentials: "include", headers });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showError('Failed to download PDF');
    }
  };

  const handleView = async (id) => {
    try {
      const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/${id}`);
      if (data.success) {
        setSelectedProposal(data.data);
        setShowViewModal(true);
      }
    } catch (error) {
      console.error('Error fetching proposal:', error);
      showError('Failed to fetch proposal details');
    }
  };

  const handleEdit = (proposal) => {
    setSelectedProposal(proposal);
    setFormData({
      leadId: proposal.leadId || '',
      title: proposal.title || '',
      description: proposal.description || '',
      totalValue: proposal.totalValue || '',
      groupName: proposal.groupName || '',
      subGroupName: proposal.subGroupName || '',
      status: proposal.status || 'Draft'
    });

    setTemplateData({
      companyName: proposal.companyName || DEFAULT_TEMPLATE.companyName,
      aboutUs: proposal.aboutUs || DEFAULT_TEMPLATE.aboutUs,
      aboutSystem: proposal.aboutSystem || DEFAULT_TEMPLATE.aboutSystem,
      paymentTerms: proposal.paymentTerms || DEFAULT_TEMPLATE.paymentTerms,
      defectLiabilityPeriod: proposal.defectLiabilityPeriod || DEFAULT_TEMPLATE.defectLiabilityPeriod,
      systemPricing: parseJSON(proposal.systemPricing) || [],
      bomItems: parseJSON(proposal.bomItems) || []
    });

    setIsEditMode(true);
    setShowCreateModal(true);
    setShowViewModal(false);
  };

  const resetForm = () => {
    setFormData({
      leadId: '',
      title: '',
      description: '',
      totalValue: '',
      groupName: groupName || '',
      subGroupName: subGroupName || '',
      status: 'Draft'
    });
    setTemplateData({
      companyName: DEFAULT_TEMPLATE.companyName,
      aboutUs: DEFAULT_TEMPLATE.aboutUs,
      aboutSystem: DEFAULT_TEMPLATE.aboutSystem,
      paymentTerms: DEFAULT_TEMPLATE.paymentTerms,
      defectLiabilityPeriod: DEFAULT_TEMPLATE.defectLiabilityPeriod,
      systemPricing: [],
      bomItems: []
    });
    setIsEditMode(false);
    setSelectedProposal(null);
    setActiveTab('company');
    setCustomUnitInputs({});
  };

  const handleCreateNew = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const addSystemPricingRow = () => {
    setTemplateData({
      ...templateData,
      systemPricing: [...templateData.systemPricing, { item: '', description: '', amount: '' }]
    });
  };

  const updateSystemPricingRow = (index, field, value) => {
    const updated = [...templateData.systemPricing];
    updated[index][field] = value;
    setTemplateData({ ...templateData, systemPricing: updated });
  };

  const removeSystemPricingRow = (index) => {
    const updated = templateData.systemPricing.filter((_, i) => i !== index);
    setTemplateData({ ...templateData, systemPricing: updated });
  };

  const addBOMRow = () => {
    setTemplateData({
      ...templateData,
      bomItems: [...templateData.bomItems, {
        item: '',
        specification: '',
        quantity: '',
        unit: 'Nos',
        rate: '',
        tax: '18',
        amount: ''
      }]
    });
  };

  const updateBOMRow = (index, field, value) => {
    const updated = [...templateData.bomItems];
    updated[index][field] = value;

    if (field === 'quantity' || field === 'rate' || field === 'tax') {
      const quantity = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      const tax = parseFloat(updated[index].tax) || 0;

      const subtotal = quantity * rate;
      const taxAmount = (subtotal * tax) / 100;
      updated[index].amount = (subtotal + taxAmount).toFixed(2);
    }

    setTemplateData({ ...templateData, bomItems: updated });
  };

  const calculateBOMTotals = () => {
    const subtotal = templateData.bomItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      return sum + (quantity * rate);
    }, 0);

    const totalTax = templateData.bomItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const tax = parseFloat(item.tax) || 0;
      const itemSubtotal = quantity * rate;
      return sum + ((itemSubtotal * tax) / 100);
    }, 0);

    const grandTotal = templateData.bomItems.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0);
    }, 0);

    return {
      subtotal: subtotal.toFixed(2),
      totalTax: totalTax.toFixed(2),
      grandTotal: grandTotal.toFixed(2)
    };
  };

  const removeBOMRow = (index) => {
    const updated = templateData.bomItems.filter((_, i) => i !== index);
    setTemplateData({ ...templateData, bomItems: updated });

    // Remove custom input tracking if exists
    const newCustomInputs = { ...customUnitInputs };
    delete newCustomInputs[index];
    setCustomUnitInputs(newCustomInputs);
  };

  const calculateSystemPricingTotal = () => {
    return templateData.systemPricing.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2);
  };

  const getStatusClass = (status) => {
    const statusMap = {
      'Draft': 'status-draft',
      'Sent': 'status-sent',
      'Approved': 'status-approved',
      'Rejected': 'status-rejected',
      'On Hold': 'status-hold'
    };
    return statusMap[status] || 'status-draft';
  };

  useEffect(() => {
    if (permissions.VIEW) {
      fetchProposals();
    }
  }, [currentPage, rowsPerPage, groupName, subGroupName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.bom-item-input-container')) {
        setShowBomDropdown({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchUsers();
    fetchGroups();
    fetchBomItemsMaster();
  }, []);

  useEffect(() => {
    if (formData.groupName || formData.subGroupName) {
      fetchLeads(formData.groupName, formData.subGroupName);
    }
  }, [formData.groupName, formData.subGroupName]);

  useEffect(() => {
    if (searchTerm || filterStatus !== 'All' || filterPreparedBy !== 'All') {
      const debounce = setTimeout(() => {
        handleFilter();
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      fetchProposals();
    }
  }, [searchTerm, filterStatus, filterPreparedBy]);

  if (!permissions.VIEW) {
    return (
      <div className="proposal-page-container">
        <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
          You don't have permission to view proposals.
        </div>
      </div>
    );
  }

  return (
    <div className="proposal-page-container">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="proposal-page-header">
        <div className="proposal-page-breadcrumb">
          Dashboard &gt; Proposals
        </div>
      </div>

      <div className="page-header-with-filter">
        <h1 className="proposal-page-title">Proposals</h1>
        <GroupCategoryFilter
          groupValue={groupName}
          subGroupValue={subGroupName}
          onChange={updateFilters}
        />
      </div>

      <div className="proposal-page-action-bar">
        <div className="proposal-page-search-filters">
          <input
            type="text"
            className="proposal-page-search"
            placeholder="Search by Proposal No, Title, Description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="proposal-page-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="On Hold">On Hold</option>
          </select>

          <select
            className="proposal-page-filter"
            value={filterPreparedBy}
            onChange={(e) => setFilterPreparedBy(e.target.value)}
          >
            <option value="All">All Members</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>

        <div className="proposal-page-action-buttons">
          {permissions.CREATE && (
            <button
              className="proposal-page-btn proposal-page-btn-primary"
              onClick={handleCreateNew}
            >
              + Create New Proposal
            </button>
          )}
        </div>
      </div>

      <div className="proposal-page-table-container">
        <table className="proposal-page-table">
          <thead>
            <tr>
              <th>Proposal No</th>
              <th>Lead Code</th>
              <th>Lead Name</th>
              <th>Group</th>
              <th>Sub-Group</th>
              <th>Title</th>
              <th>Value (₹)</th>
              <th>Version</th>
              <th>Status</th>
              <th>Prepared By</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '40px' }}>
                  Loading...
                </td>
              </tr>
            ) : proposals.length > 0 ? (
              proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td className="proposal-page-id">{proposal.proposalNo}</td>
                  <td>{proposal.leadCode || '-'}</td>
                  <td>{proposal.leadName || '-'}</td>
                  <td>{proposal.groupName || '-'}</td>
                  <td>{proposal.subGroupName || '-'}</td>
                  <td>{proposal.title}</td>
                  <td>₹{proposal.totalValue ? parseFloat(proposal.totalValue).toLocaleString('en-IN') : '0'}</td>
                  <td><span className="proposal-page-version">v{proposal.version}</span></td>
                  <td>
                    <span className={`proposal-page-status ${getStatusClass(proposal.status)}`}>
                      {proposal.status}
                    </span>
                  </td>
                  <td>{proposal.preparedByName}</td>
                  <td>{formatDateTime(proposal.updatedAt)}</td>
                  <td>
                    <div className="proposal-actions-inline">

                      {/* View */}
                      <button
                        className="proposal-action-icon proposal-view"
                        onClick={() => handleView(proposal.id)}
                        title="View"
                      >
                        <FaEye />
                        {/* <span>View</span> */}
                      </button>

                      {/* Edit */}
                      {permissions.EDIT && (
                        <button
                          className="proposal-action-icon proposal-edit"
                          onClick={() => handleEdit(proposal)}
                          title="Edit"
                        >
                          <FaEdit />
                          {/* <span>Edit</span> */}
                        </button>
                      )}

                      {/* PDF */}
                      <button
                        className="proposal-action-icon proposal-pdf"
                        onClick={() => handleDownloadPDF(proposal.id)}
                        title="Download PDF"
                      >
                        <FaFilePdf />
                        {/* <span>PDF</span> */}
                      </button>

                      {/* Delete */}
                      {permissions.DELETE && (
                        <button
                          className="proposal-action-icon proposal-delete"
                          onClick={() => handleDeleteClick(proposal.id, proposal.title)}
                          title="Delete"
                        >
                          <FaRegTrashAlt />
                          {/* <span>Delete</span> */}
                        </button>
                      )}

                    </div>
                  </td>


                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                  No proposals found. {permissions.CREATE && 'Create a new proposal to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="proposal-page-pagination">
        <div className="proposal-page-pagination-info">
          {totalProposals > 0 ? (
            <>
              Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalProposals)} of {totalProposals} entries
            </>
          ) : (
            <>No entries to display</>
          )}
        </div>
        <div className="proposal-page-pagination-controls">
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="proposal-page-rows-select"
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="proposal-page-pagination-btn"
          >
            Previous
          </button>
          <span className="proposal-page-pagination-current">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="proposal-page-pagination-btn"
          >
            Next
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="proposal-page-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="proposal-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proposal-delete-modal-icon">
              <div className="proposal-delete-icon-circle">
                <span>!</span>
              </div>
            </div>
            <h2 className="proposal-delete-modal-title">Delete Proposal</h2>
            <p className="proposal-delete-modal-text">
              Are you sure you want to delete proposal "{deleteProposalTitle}"?
              <br />
              This action cannot be undone.
            </p>
            <div className="proposal-delete-modal-actions">
              <button
                className="proposal-page-btn proposal-page-btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="proposal-page-btn proposal-delete-btn"
                onClick={handleDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedProposal && (
        <div className="proposal-page-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="proposal-page-modal proposal-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="proposal-page-modal-header">
              <h2>Proposal Details</h2>
              <button className="proposal-page-modal-close" onClick={() => setShowViewModal(false)}>
                ×
              </button>
            </div>

            <div className="proposal-page-modal-content">
              <div className="proposal-page-card">
                <div className="proposal-page-card-header">
                  <div>
                    <h3>{selectedProposal.companyName || 'SESOLA POWER PROJECTS PROPOSAL PVT LTD'}</h3>
                    <h3>{selectedProposal.title} - v{selectedProposal.version}</h3>
                    <p className="proposal-page-id">{selectedProposal.proposalNo}</p>
                  </div>
                  <span className={`proposal-page-status ${getStatusClass(selectedProposal.status)}`}>
                    {selectedProposal.status}
                  </span>
                </div>
                <div className="proposal-page-info-grid">
                  <div><strong>Created:</strong> {formatDateTime(selectedProposal.createdAt)}</div>
                  <div><strong>Updated:</strong> {formatDateTime(selectedProposal.updatedAt)}</div>
                  <div><strong>Prepared By:</strong> {selectedProposal.preparedByName}</div>
                  <div><strong>Value:</strong> ₹{selectedProposal.totalValue ? parseFloat(selectedProposal.totalValue).toLocaleString('en-IN') : '0'}</div>
                  <div><strong>Group:</strong> {selectedProposal.groupName || '-'}</div>
                  <div><strong>Sub-Group:</strong> {selectedProposal.subGroupName || '-'}</div>
                </div>
              </div>

              {(selectedProposal.leadId || selectedProposal.customerId) && (
                <div className="proposal-page-card">
                  <h3>Client Information</h3>
                  <div className="proposal-page-info-grid">
                    {selectedProposal.leadId && (
                      <>
                        <div><strong>Lead Code:</strong> {selectedProposal.leadCode}</div>
                        <div><strong>Lead Name:</strong> {selectedProposal.leadName}</div>
                      </>
                    )}
                    {selectedProposal.customerId && (
                      <>
                        <div><strong>Customer Code:</strong> {selectedProposal.customerCode}</div>
                        <div><strong>Customer Name:</strong> {selectedProposal.customerName}</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedProposal.description && (
                <div className="proposal-page-card">
                  <h3>Description</h3>
                  <div className="proposal-page-content-section">
                    <p>{selectedProposal.description}</p>
                  </div>
                </div>
              )}

              {selectedProposal.aboutUs && (
                <div className="proposal-page-card">
                  <h3>About Us</h3>
                  <div className="proposal-page-content-section">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selectedProposal.aboutUs}</p>
                  </div>
                </div>
              )}

              {selectedProposal.aboutSystem && (
                <div className="proposal-page-card">
                  <h3>About System</h3>
                  <div className="proposal-page-content-section">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selectedProposal.aboutSystem}</p>
                  </div>
                </div>
              )}

              {selectedProposal.systemPricing && parseJSON(selectedProposal.systemPricing)?.length > 0 && (
                <div className="proposal-page-card">
                  <h3>System Pricing</h3>
                  <table className="proposal-page-table" style={{ marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Description</th>
                        <th>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseJSON(selectedProposal.systemPricing).map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.item}</td>
                          <td>{item.description}</td>
                          <td>₹{parseFloat(item.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 'bold', backgroundColor: '#f7fafc' }}>
                        <td colSpan="2" style={{ textAlign: 'right' }}>Total:</td>
                        <td>₹{parseJSON(selectedProposal.systemPricing).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {selectedProposal.paymentTerms && (
                <div className="proposal-page-card">
                  <h3>Payment Terms</h3>
                  <div className="proposal-page-content-section">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selectedProposal.paymentTerms}</p>
                  </div>
                </div>
              )}

              {selectedProposal.defectLiabilityPeriod && (
                <div className="proposal-page-card">
                  <h3>Defect Liability Period</h3>
                  <div className="proposal-page-content-section">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{selectedProposal.defectLiabilityPeriod}</p>
                  </div>
                </div>
              )}

              {selectedProposal.bomItems && parseJSON(selectedProposal.bomItems)?.length > 0 && (
                <div className="proposal-page-card">
                  <h3>Bill of Materials (BOM)</h3>
                  <table className="proposal-page-table" style={{ marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Specification</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Rate (₹)</th>
                        <th>Tax %</th>
                        <th>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseJSON(selectedProposal.bomItems).map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.item}</td>
                          <td>{item.specification}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unit}</td>
                          <td>₹{parseFloat(item.rate || 0).toLocaleString('en-IN')}</td>
                          <td>{item.tax || 0}%</td>
                          <td>₹{parseFloat(item.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}

                      <tr style={{ backgroundColor: '#f7fafc', borderTop: '2px solid #cbd5e0' }}>
                        <td colSpan="6" style={{ textAlign: 'right', fontWeight: '600' }}>Subtotal (Before Tax):</td>
                        <td style={{ fontWeight: '600' }}>
                          ₹{parseJSON(selectedProposal.bomItems).reduce((sum, item) => {
                            const quantity = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.rate) || 0;
                            return sum + (quantity * rate);
                          }, 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: '#f7fafc' }}>
                        <td colSpan="6" style={{ textAlign: 'right', fontWeight: '600' }}>Total Tax:</td>
                        <td style={{ fontWeight: '600', color: '#d69e2e' }}>
                          ₹{parseJSON(selectedProposal.bomItems).reduce((sum, item) => {
                            const quantity = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.rate) || 0;
                            const tax = parseFloat(item.tax) || 0;
                            const itemSubtotal = quantity * rate;
                            return sum + ((itemSubtotal * tax) / 100);
                          }, 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: '#e6fffa', borderTop: '2px solid #81e6d9', fontWeight: 'bold' }}>
                        <td colSpan="6" style={{ textAlign: 'right' }}>Grand Total (Inc. Tax):</td>
                        <td style={{ color: '#047857' }}>
                          ₹{parseJSON(selectedProposal.bomItems).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="proposal-page-modal-actions">
                {permissions.EDIT && (
                  <button
                    className="proposal-page-btn proposal-page-btn-secondary"
                    onClick={() => handleEdit(selectedProposal)}
                  >
                    Edit Proposal
                  </button>
                )}
                <button
                  className="proposal-page-btn proposal-page-btn-secondary"
                  onClick={() => handleDownloadPDF(selectedProposal.id)}
                >
                  Download PDF
                </button>
                {permissions.APPROVE && (
                  <select
                    className="proposal-page-status-dropdown"
                    value={selectedProposal.status}
                    onChange={async (e) => {
                      try {
                        const data = await fetchWithHeaders(`${API_BASE_URL}/proposals/update/${selectedProposal.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ status: e.target.value })
                        });
                        if (data.success) {
                          showSuccess('Status updated successfully!');
                          setSelectedProposal({ ...selectedProposal, status: e.target.value });
                          fetchProposals();
                        }
                      } catch (error) {
                        showError('Failed to update status');
                      }
                    }}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="proposal-page-modal-overlay" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <div className="proposal-page-modal proposal-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="proposal-page-modal-header">
              <h2>{isEditMode ? 'Edit Proposal' : 'Create New Proposal'}</h2>
              <button className="proposal-page-modal-close" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                ×
              </button>
            </div>

            <div className="proposal-page-modal-content">
              <div className="proposal-page-form">
                <div className="proposal-page-form-row">
                  <div className="proposal-page-form-group">
                    <label>Group *</label>
                    {isEditMode ? (
                      <div style={{
                        padding: '10px',
                        background: '#f7fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        color: '#2d3748',
                        fontWeight: '500'
                      }}>
                        {formData.groupName || 'Not specified'}
                      </div>
                    ) : (
                      <select
                        value={formData.groupName}
                        onChange={(e) => {
                          setFormData({ ...formData, groupName: e.target.value, subGroupName: '' });
                          fetchLeads(e.target.value, null);
                        }}
                      >
                        <option value="">Select Group</option>
                        {groups.map((group, index) => (
                          <option key={group.value || group.label || index} value={group.value || group.label}>
                            {group.label || group.value}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="proposal-page-form-group">
                    <label>Category</label>
                    {isEditMode ? (
                      <div style={{
                        padding: '10px',
                        background: '#f7fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        color: '#2d3748',
                        fontWeight: '500'
                      }}>
                        {formData.subGroupName || 'Not specified'}
                      </div>
                    ) : (
                      <select
                        value={formData.subGroupName}
                        onChange={(e) => {
                          setFormData({ ...formData, subGroupName: e.target.value });
                          fetchLeads(formData.groupName, e.target.value);
                        }}
                        disabled={!formData.groupName}
                      >
                        <option value="">Select Category</option>
                        {subGroups.map((sub, index) => (
                          <option key={sub.value || sub.label || index} value={sub.value || sub.label}>
                            {sub.label || sub.value}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="proposal-page-form-row">
                  <div className="proposal-page-form-group">
                    <label>Lead *</label>
                    {isEditMode ? (
                      <div style={{
                        padding: '10px',
                        background: '#f7fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        color: '#2d3748',
                        fontWeight: '500'
                      }}>
                        {selectedProposal?.leadCode} - {selectedProposal?.leadName}
                      </div>
                    ) : (
                      <>
                        <select
                          value={formData.leadId}
                          onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                        >
                          <option value="">Select Lead</option>
                          {leads.map(lead => (
                            <option key={lead.id} value={lead.id}>
                              {lead.leadCode} - {lead.name}
                            </option>
                          ))}
                        </select>
                        {leads.length === 0 && formData.groupName && (
                          <small style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            No leads found for selected Group/Category. Please select different filters.
                          </small>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="proposal-page-form-row">
                  <div className="proposal-page-form-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter proposal title"
                    />
                  </div>
                  <div className="proposal-page-form-group">
                    <label>Total Value (₹)</label>
                    <input
                      type="number"
                      value={formData.totalValue}
                      onChange={(e) => setFormData({ ...formData, totalValue: e.target.value })}
                      placeholder="Enter total value"
                    />
                  </div>
                </div>

                <div className="proposal-page-form-row">
                  <div className="proposal-page-form-group">
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                </div>

                <div className="proposal-page-form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter proposal description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="proposal-page-modal-actions">
                <button
                  className="proposal-page-btn proposal-page-btn-secondary"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  className="proposal-page-btn proposal-page-btn-secondary"
                  onClick={() => setShowTemplateModal(true)}
                >
                  📝 Edit Template Content
                </button>
                <button
                  className="proposal-page-btn proposal-page-btn-primary"
                  onClick={isEditMode ? handleUpdate : handleCreate}
                >
                  {isEditMode ? 'Update Proposal' : 'Create Proposal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateModal && (
        <div className="proposal-page-modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="proposal-page-modal proposal-page-modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
            <div className="proposal-page-modal-header">
              <h2>📝 Edit Proposal Template</h2>
              <button className="proposal-page-modal-close" onClick={() => setShowTemplateModal(false)}>
                ×
              </button>
            </div>

            <div className="proposal-page-modal-content">
              <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[
                  { key: 'company', label: 'Company Info' },
                  { key: 'aboutUs', label: 'About Us' },
                  { key: 'aboutSystem', label: 'About System' },
                  { key: 'pricing', label: 'System Pricing' },
                  { key: 'payment', label: 'Payment Terms' },
                  { key: 'dlp', label: 'DLP' },
                  { key: 'bom', label: 'BOM' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      background: activeTab === tab.key ? '#3182ce' : 'transparent',
                      color: activeTab === tab.key ? 'white' : '#4a5568',
                      fontWeight: activeTab === tab.key ? '600' : '400',
                      cursor: 'pointer',
                      borderRadius: '6px 6px 0 0',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ minHeight: '400px' }}>
                {activeTab === 'company' && (
                  <div className="proposal-page-form">
                    <div className="proposal-page-form-group">
                      <label>Company Name</label>
                      <input
                        type="text"
                        value={templateData.companyName}
                        onChange={(e) => setTemplateData({ ...templateData, companyName: e.target.value })}
                        placeholder="Enter company name"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'aboutUs' && (
                  <div className="proposal-page-form">
                    <div className="proposal-page-form-group">
                      <label>About Us</label>
                      <textarea
                        value={templateData.aboutUs}
                        onChange={(e) => setTemplateData({ ...templateData, aboutUs: e.target.value })}
                        placeholder="Enter company information..."
                        rows={15}
                        style={{ fontSize: '14px', lineHeight: '1.6' }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'aboutSystem' && (
                  <div className="proposal-page-form">
                    <div className="proposal-page-form-group">
                      <label>About System</label>
                      <textarea
                        value={templateData.aboutSystem}
                        onChange={(e) => setTemplateData({ ...templateData, aboutSystem: e.target.value })}
                        placeholder="Enter system description..."
                        rows={15}
                        style={{ fontSize: '14px', lineHeight: '1.6' }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'pricing' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ margin: 0 }}>System Pricing</h3>
                      <button
                        className="proposal-page-btn proposal-page-btn-secondary proposal-page-btn-sm"
                        onClick={addSystemPricingRow}
                      >
                        + Add Row
                      </button>
                    </div>
                    <div className="proposal-page-table-container">
                      <table className="proposal-page-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Description</th>
                            <th>Amount (₹)</th>
                            <th style={{ width: '80px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templateData.systemPricing.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                                No pricing items added. Click "Add Row" to start.
                              </td>
                            </tr>
                          ) : (
                            <>
                              {templateData.systemPricing.map((row, index) => (
                                <tr key={index}>
                                  <td>
                                    <input
                                      type="text"
                                      value={row.item}
                                      onChange={(e) => updateSystemPricingRow(index, 'item', e.target.value)}
                                      placeholder="Item name"
                                      style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      value={row.description}
                                      onChange={(e) => updateSystemPricingRow(index, 'description', e.target.value)}
                                      placeholder="Description"
                                      style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      value={row.amount}
                                      onChange={(e) => updateSystemPricingRow(index, 'amount', e.target.value)}
                                      placeholder="0.00"
                                      style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                    />
                                  </td>
                                  <td>
                                    <button
                                      onClick={() => removeSystemPricingRow(index)}
                                      style={{
                                        background: '#fed7d7',
                                        color: '#742a2a',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ fontWeight: 'bold', backgroundColor: '#f7fafc' }}>
                                <td colSpan="2" style={{ textAlign: 'right' }}>Total:</td>
                                <td>₹{calculateSystemPricingTotal()}</td>
                                <td></td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'payment' && (
                  <div className="proposal-page-form">
                    <div className="proposal-page-form-group">
                      <label>Payment Terms</label>
                      <textarea
                        value={templateData.paymentTerms}
                        onChange={(e) => setTemplateData({ ...templateData, paymentTerms: e.target.value })}
                        placeholder="Enter payment terms..."
                        rows={12}
                        style={{ fontSize: '14px', lineHeight: '1.6' }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'dlp' && (
                  <div className="proposal-page-form">
                    <div className="proposal-page-form-group">
                      <label>Defect Liability Period</label>
                      <textarea
                        value={templateData.defectLiabilityPeriod}
                        onChange={(e) => setTemplateData({ ...templateData, defectLiabilityPeriod: e.target.value })}
                        placeholder="Enter defect liability period details..."
                        rows={12}
                        style={{ fontSize: '14px', lineHeight: '1.6' }}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'bom' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ margin: 0 }}>Bill of Materials (BOM)</h3>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="proposal-page-btn proposal-page-btn-secondary proposal-page-btn-sm"
                          onClick={() => fetchBomItemsMaster()}
                          style={{ fontSize: '12px' }}
                        >
                          🔄 Refresh Items
                        </button>
                        <button
                          className="proposal-page-btn proposal-page-btn-secondary proposal-page-btn-sm"
                          onClick={addBOMRow}
                        >
                          + Add Row
                        </button>
                      </div>
                    </div>

                    <div className="proposal-page-table-container">
                      <table className="proposal-page-table">
                        <thead>
                          <tr>
                            <th style={{ width: '200px' }}>Item Name *</th>
                            <th style={{ width: '200px' }}>Specification</th>
                            <th style={{ width: '100px' }}>Quantity</th>
                            <th style={{ width: '120px' }}>Unit</th>
                            <th style={{ width: '120px' }}>Rate (₹)</th>
                            <th style={{ width: '100px' }}>Tax %</th>
                            <th style={{ width: '120px' }}>Amount (₹)</th>
                            <th style={{ width: '80px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templateData.bomItems.length === 0 ? (
                            <tr>
                              <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                                No BOM items added. Click "Add Row" to start.
                              </td>
                            </tr>
                          ) : (
                            <>
                              {templateData.bomItems.map((row, index) => (
                                <tr key={index}>
                                  <td>
                                    <div className="bom-item-input-container" style={{ position: 'relative' }}>
                                      <input
                                        type="text"
                                        value={row.item}
                                        onChange={(e) => {
                                          updateBOMRow(index, 'item', e.target.value);
                                          handleBomItemSearch(index, e.target.value);
                                        }}
                                        onFocus={() => {
                                          if (row.item && row.item.length >= 2) {
                                            handleBomItemSearch(index, row.item);
                                          }
                                        }}
                                        placeholder="Start typing..."
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                      />

                                      {showBomDropdown[index] && filteredBomItems[index]?.length > 0 && (
                                        <div style={{
                                          position: 'absolute',
                                          top: '100%',
                                          left: 0,
                                          right: 0,
                                          background: 'white',
                                          border: '2px solid #3b82f6',
                                          borderRadius: '6px',
                                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                          maxHeight: '300px',
                                          overflowY: 'auto',
                                          zIndex: 1000,
                                          marginTop: '4px'
                                        }}>
                                          <div style={{
                                            padding: '8px 12px',
                                            background: '#f8fafc',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontWeight: 600,
                                            fontSize: '11px',
                                            color: '#475569'
                                          }}>
                                            📋 Select from Master Items ({filteredBomItems[index].length})
                                          </div>

                                          {filteredBomItems[index].map((bomItem) => (
                                            <div
                                              key={bomItem.id}
                                              onClick={() => selectBomItem(index, bomItem)}
                                              style={{
                                                padding: '10px 12px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background-color 0.2s'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                                e.currentTarget.style.borderLeft = '3px solid #3b82f6';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'white';
                                                e.currentTarget.style.borderLeft = 'none';
                                              }}
                                            >
                                              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '2px', fontSize: '13px' }}>
                                                {bomItem.itemName}
                                              </div>
                                              {bomItem.specification && (
                                                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                                                  {bomItem.specification}
                                                </div>
                                              )}
                                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px', marginRight: '4px' }}>
                                                  {bomItem.category}
                                                </span>
                                                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px', marginRight: '4px' }}>
                                                  {bomItem.defaultUnit}
                                                </span>
                                                {bomItem.makeBrand && (
                                                  <span style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: '3px' }}>
                                                    {bomItem.makeBrand}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    <textarea
                                      value={row.specification}
                                      onChange={(e) => updateBOMRow(index, 'specification', e.target.value)}
                                      placeholder="Enter specs"
                                      rows={2}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '4px',
                                        resize: 'vertical',
                                        fontSize: '12px'
                                      }}
                                    />
                                  </td>

                                  <td>
                                    <input
                                      type="number"
                                      value={row.quantity}
                                      onChange={(e) => updateBOMRow(index, 'quantity', e.target.value)}
                                      placeholder="0"
                                      style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                    />
                                  </td>

                                  <td>
                                    {customUnitInputs[index] !== undefined ? (
                                      <input
                                        type="text"
                                        value={customUnitInputs[index]}
                                        onChange={(e) => handleCustomUnitInput(index, e.target.value)}
                                        placeholder="Enter custom unit"
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          border: '1px solid #e2e8f0',
                                          borderRadius: '4px',
                                          fontSize: '13px'
                                        }}
                                      />
                                    ) : (
                                      <UnitTypeDropdown
                                        value={row.unit || ''}
                                        onChange={(e) => handleBomUnitChange(index, e.target.value)}
                                        className="proposal-unit-dropdown"
                                        placeholder="Select unit"
                                      />
                                    )}
                                  </td>

                                  <td>
                                    <input
                                      type="number"
                                      value={row.rate}
                                      onChange={(e) => updateBOMRow(index, 'rate', e.target.value)}
                                      placeholder="0.00"
                                      style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                    />
                                  </td>

                                  <td>
                                    <select
                                      value={row.tax || '18'}
                                      onChange={(e) => updateBOMRow(index, 'tax', e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '4px',
                                        backgroundColor: 'white'
                                      }}
                                    >
                                      <option value="0">0%</option>
                                      <option value="5">5%</option>
                                      <option value="12">12%</option>
                                      <option value="18">18%</option>
                                      <option value="28">28%</option>
                                    </select>
                                  </td>

                                  <td>
                                    <input
                                      type="number"
                                      value={row.amount}
                                      readOnly
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '4px',
                                        background: '#f7fafc',
                                        fontWeight: '600',
                                        color: '#2d3748'
                                      }}
                                    />
                                  </td>

                                  <td>
                                    <button
                                      onClick={() => removeBOMRow(index)}
                                      style={{
                                        background: '#fed7d7',
                                        color: '#742a2a',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}

                              <tr style={{ backgroundColor: '#f7fafc', borderTop: '2px solid #cbd5e0' }}>
                                <td colSpan="6" style={{ textAlign: 'right', fontWeight: '600', padding: '12px' }}>
                                  Subtotal (Before Tax):
                                </td>
                                <td style={{ fontWeight: '600', padding: '12px' }}>
                                  ₹{calculateBOMTotals().subtotal}
                                </td>
                                <td></td>
                              </tr>
                              <tr style={{ backgroundColor: '#f7fafc' }}>
                                <td colSpan="6" style={{ textAlign: 'right', fontWeight: '600', padding: '12px' }}>
                                  Total Tax:
                                </td>
                                <td style={{ fontWeight: '600', padding: '12px', color: '#d69e2e' }}>
                                  ₹{calculateBOMTotals().totalTax}
                                </td>
                                <td></td>
                              </tr>
                              <tr style={{ backgroundColor: '#e6fffa', borderTop: '2px solid #81e6d9' }}>
                                <td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px', fontSize: '15px' }}>
                                  Grand Total (Inc. Tax):
                                </td>
                                <td style={{ fontWeight: 'bold', padding: '12px', fontSize: '15px', color: '#047857' }}>
                                  ₹{calculateBOMTotals().grandTotal}
                                </td>
                                <td></td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="proposal-page-modal-actions" style={{ marginTop: '30px' }}>
                <button
                  className="proposal-page-btn proposal-page-btn-secondary"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Close
                </button>
                <button
                  className="proposal-page-btn proposal-page-btn-primary"
                  onClick={() => {
                    setShowTemplateModal(false);
                    showWarning('Template content saved! Now you can create/update the proposal.');
                  }}
                >
                  ✓ Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalsWithTemplate;