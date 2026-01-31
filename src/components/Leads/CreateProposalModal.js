import React, { useState, useEffect } from 'react';
import './CreateProposalModal.css';
import { useAuth } from "../../hooks/useAuth";
import useToast from '../../hooks/useToast';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// Common units list
const COMMON_UNITS = [
  // Quantity
  'Nos', 'Pcs', 'Units', 'Pairs', 'Dozen', 'Gross',
  // Length
  'Meter', 'Meters', 'Feet', 'Inch', 'Km', 'mm', 'cm',
  // Area
  'Sqft', 'Sq.ft', 'Sqm', 'Sq.m', 'Acres', 'Hectares',
  // Volume
  'Liters', 'Litres', 'ml', 'Gallons', 'Cu.ft', 'Cu.m',
  // Weight
  'Kg', 'Kgs', 'Grams', 'Tons', 'MT', 'Quintal', 'Lbs',
  // Electrical
  'Watt', 'KW', 'KVA', 'Amp', 'Volt',
  // Set/Bundle
  'Set', 'Sets', 'Kit', 'Kits', 'Bundle', 'Lot', 'Box', 'Boxes', 'Carton', 'Bag', 'Bags',
  // Time
  'Hours', 'Days', 'Months', 'Years',
  // Others
  'Roll', 'Rolls', 'Sheet', 'Sheets', 'Panel', 'Panels', 'RM', 'RMT', 'Running Meter', 'Coil', 'Drum'
].sort();

function CreateProposalModal({ lead, onClose, onProposalCreated, defaultTemplate, isEditMode = false, existingProposal = null }) {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // BOM and Unit states
  const [bomItemsMaster, setBomItemsMaster] = useState([]);
  const [filteredBomItems, setFilteredBomItems] = useState({});
  const [showBomDropdown, setShowBomDropdown] = useState({});
  const [showUnitDropdown, setShowUnitDropdown] = useState({});
  const [filteredUnits, setFilteredUnits] = useState({});
  const [customUnits, setCustomUnits] = useState({});

  const currentUser = {
    id: user.id,
    role: user.role,
    name: user.name
  };

  // Form state - Basic Info
  const [formData, setFormData] = useState({
    leadId: lead?.id || '',
    title: '',
    description: '',
    totalValue: '',
    groupName: lead?.groupName || '',
    subGroupName: lead?.subGroupName || '',
    status: 'Draft'
  });

  // Template state
  const [templateData, setTemplateData] = useState({
    companyName: defaultTemplate.companyName,
    aboutUs: defaultTemplate.aboutUs,
    aboutSystem: defaultTemplate.aboutSystem,
    paymentTerms: defaultTemplate.paymentTerms,
    defectLiabilityPeriod: defaultTemplate.defectLiabilityPeriod,
    systemPricing: [],
    bomItems: []
  });

  // Load existing proposal data if in edit mode
  useEffect(() => {
    if (isEditMode && existingProposal) {
      setFormData({
        leadId: existingProposal.leadId || '',
        title: existingProposal.title || '',
        description: existingProposal.description || '',
        totalValue: existingProposal.totalValue || '',
        groupName: existingProposal.groupName || '',
        subGroupName: existingProposal.subGroupName || '',
        status: existingProposal.status || 'Draft'
      });

      const parseJSON = (jsonString) => {
        if (!jsonString) return null;
        try {
          return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        } catch (e) {
          return null;
        }
      };

      setTemplateData({
        companyName: existingProposal.companyName || defaultTemplate.companyName,
        aboutUs: existingProposal.aboutUs || defaultTemplate.aboutUs,
        aboutSystem: existingProposal.aboutSystem || defaultTemplate.aboutSystem,
        paymentTerms: existingProposal.paymentTerms || defaultTemplate.paymentTerms,
        defectLiabilityPeriod: existingProposal.defectLiabilityPeriod || defaultTemplate.defectLiabilityPeriod,
        systemPricing: parseJSON(existingProposal.systemPricing) || [],
        bomItems: parseJSON(existingProposal.bomItems) || []
      });
    }
  }, [isEditMode, existingProposal]);

  // Fetch BOM items master
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
        console.log('✅ Loaded BOM items:', data.data.length);
      }
    } catch (error) {
      console.error('Error fetching BOM items:', error);
      setBomItemsMaster([]);
    }
  };

  // Search/filter BOM items
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

  // Select BOM item from dropdown
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

  // Filter units based on search term
  const filterUnits = (index, searchTerm) => {
    if (!searchTerm || searchTerm.trim().length === 0) {
      setFilteredUnits(prev => ({ ...prev, [index]: COMMON_UNITS }));
      return;
    }

    const search = searchTerm.toLowerCase().trim();
    const filtered = COMMON_UNITS.filter(unit =>
      unit.toLowerCase().includes(search)
    );

    setFilteredUnits(prev => ({ ...prev, [index]: filtered }));
  };

  // Handle unit input change
  const handleUnitChange = (index, value) => {
    updateBOMRow(index, 'unit', value);

    if (value && value.length > 0) {
      filterUnits(index, value);
      setShowUnitDropdown(prev => ({ ...prev, [index]: true }));
    } else {
      setShowUnitDropdown(prev => ({ ...prev, [index]: false }));
    }
  };

  // Select unit from dropdown
  const selectUnit = (index, unit) => {
    updateBOMRow(index, 'unit', unit);
    setShowUnitDropdown(prev => ({ ...prev, [index]: false }));
    setFilteredUnits(prev => ({ ...prev, [index]: [] }));
  };

  // Handle unit blur - add to custom units if not in list
  const handleUnitBlur = (index, value) => {
    if (value && value.trim().length > 0) {
      const trimmedValue = value.trim();

      // Check if it's already in COMMON_UNITS (case-insensitive)
      const existsInCommon = COMMON_UNITS.some(unit =>
        unit.toLowerCase() === trimmedValue.toLowerCase()
      );

      // If not in common list and not already in custom, add it
      if (!existsInCommon && !customUnits[trimmedValue.toLowerCase()]) {
        setCustomUnits(prev => ({
          ...prev,
          [trimmedValue.toLowerCase()]: trimmedValue
        }));
        console.log('✅ Added custom unit:', trimmedValue);
      }
    }

    // Close dropdown
    setShowUnitDropdown(prev => ({ ...prev, [index]: false }));
  };

  // Load BOM items on mount
  useEffect(() => {
    fetchBomItemsMaster();
  }, []);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.unit-input-container')) {
        setShowUnitDropdown({});
      }
      if (!event.target.closest('.bom-item-input-container')) {
        setShowBomDropdown({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      showWarning('Please enter a title');
      return;
    }

    setLoading(true);

    try {
      const requestData = {
        ...formData,
        ...templateData,
        systemPricing: JSON.stringify(templateData.systemPricing),
        bomItems: JSON.stringify(templateData.bomItems)
      };

      const url = isEditMode 
        ? `${API_BASE_URL}/proposals/update/${existingProposal.id}`
        : `${API_BASE_URL}/proposals/create`;

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'User-Id': user.id,
          'User-Role': user.role
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} proposal`);
      }

      const data = await response.json();
      
      if (data.success) {
        showSuccess(isEditMode ? 'Proposal updated successfully!' : 'Proposal created successfully!');
        onProposalCreated();
      } else {
        throw new Error(data.message || `Failed to ${isEditMode ? 'update' : 'create'} proposal`);
      }
    } catch (err) {
      showError(err.message || `Error ${isEditMode ? 'updating' : 'creating'} proposal`);
    } finally {
      setLoading(false);
    }
  };

  // System Pricing handlers
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

  // BOM handlers
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

    // Auto-calculate amount if quantity, rate, or tax changes
    if (field === 'quantity' || field === 'rate' || field === 'tax') {
      const quantity = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      const tax = parseFloat(updated[index].tax) || 0;

      // Calculate: (quantity * rate) + tax
      const subtotal = quantity * rate;
      const taxAmount = (subtotal * tax) / 100;
      updated[index].amount = (subtotal + taxAmount).toFixed(2);
    }

    setTemplateData({ ...templateData, bomItems: updated });
  };

  const removeBOMRow = (index) => {
    const updated = templateData.bomItems.filter((_, i) => i !== index);
    setTemplateData({ ...templateData, bomItems: updated });
  };

  // Calculate BOM totals
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

  // Calculate totals
  const calculateSystemPricingTotal = () => {
    return templateData.systemPricing.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2);
  };

  return (
    <div className="proposal-modal-overlay" onClick={onClose}>
      <div className="proposal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="proposal-modal-header">
          <div>
            <h2>{isEditMode ? 'Edit Proposal' : `Create Proposal for ${lead?.name || 'Lead'}`}</h2>
            {lead && (
              <p className="proposal-modal-lead-info">
                Lead: {lead.leadCode} | {lead.email} | {lead.phone}
              </p>
            )}
          </div>
          <button className="proposal-modal-close" onClick={onClose}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="proposal-modal-tabs">
          {[
            { key: 'basic', label: 'Basic Info' },
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
              className={`proposal-modal-tab ${activeTab === tab.key ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="proposal-modal-form">
          <div className="proposal-modal-content">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="proposal-form-section">
                <div className="proposal-form-grid">
                  <div className="proposal-form-group proposal-form-full">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter proposal title"
                      required
                    />
                  </div>

                  <div className="proposal-form-group">
                    <label>Total Value (₹)</label>
                    <input
                      type="number"
                      value={formData.totalValue}
                      onChange={(e) => setFormData({ ...formData, totalValue: e.target.value })}
                      placeholder="Enter total value"
                    />
                  </div>

                  <div className="proposal-form-group">
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

                  <div className="proposal-form-group">
                    <label>Group</label>
                    <input
                      type="text"
                      value={formData.groupName}
                      readOnly
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b' }}
                    />
                  </div>

                  <div className="proposal-form-group">
                    <label>Sub Group</label>
                    <input
                      type="text"
                      value={formData.subGroupName}
                      readOnly
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b' }}
                    />
                  </div>

                  <div className="proposal-form-group proposal-form-full">
                    <label>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter proposal description"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Company Info Tab */}
            {activeTab === 'company' && (
              <div className="proposal-form-section">
                <div className="proposal-form-group">
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

            {/* About Us Tab */}
            {activeTab === 'aboutUs' && (
              <div className="proposal-form-section">
                <div className="proposal-form-group">
                  <label>About Us</label>
                  <textarea
                    value={templateData.aboutUs}
                    onChange={(e) => setTemplateData({ ...templateData, aboutUs: e.target.value })}
                    placeholder="Enter company information..."
                    rows={15}
                  />
                </div>
              </div>
            )}

            {/* About System Tab */}
            {activeTab === 'aboutSystem' && (
              <div className="proposal-form-section">
                <div className="proposal-form-group">
                  <label>About System</label>
                  <textarea
                    value={templateData.aboutSystem}
                    onChange={(e) => setTemplateData({ ...templateData, aboutSystem: e.target.value })}
                    placeholder="Enter system description..."
                    rows={15}
                  />
                </div>
              </div>
            )}

            {/* System Pricing Tab */}
            {activeTab === 'pricing' && (
              <div className="proposal-form-section">
                <div className="proposal-table-header">
                  <h3>System Pricing</h3>
                  <button
                    type="button"
                    className="proposal-btn proposal-btn-secondary proposal-btn-sm"
                    onClick={addSystemPricingRow}
                  >
                    + Add Row
                  </button>
                </div>
                <div className="proposal-table-wrapper">
                  <table className="proposal-table">
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
                          <td colSpan="4" className="proposal-table-empty">
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
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={row.description}
                                  onChange={(e) => updateSystemPricingRow(index, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={row.amount}
                                  onChange={(e) => updateSystemPricingRow(index, 'amount', e.target.value)}
                                  placeholder="0.00"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => removeSystemPricingRow(index)}
                                  className="proposal-delete-btn"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr className="proposal-table-total">
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

            {/* Payment Terms Tab */}
            {activeTab === 'payment' && (
              <div className="proposal-form-section">
                <div className="proposal-form-group">
                  <label>Payment Terms</label>
                  <textarea
                    value={templateData.paymentTerms}
                    onChange={(e) => setTemplateData({ ...templateData, paymentTerms: e.target.value })}
                    placeholder="Enter payment terms..."
                    rows={12}
                  />
                </div>
              </div>
            )}

            {/* DLP Tab */}
            {activeTab === 'dlp' && (
              <div className="proposal-form-section">
                <div className="proposal-form-group">
                  <label>Defect Liability Period</label>
                  <textarea
                    value={templateData.defectLiabilityPeriod}
                    onChange={(e) => setTemplateData({ ...templateData, defectLiabilityPeriod: e.target.value })}
                    placeholder="Enter defect liability period details..."
                    rows={12}
                  />
                </div>
              </div>
            )}

            {/* BOM Tab */}
            {activeTab === 'bom' && (
              <div className="proposal-form-section">
                <div className="proposal-table-header">
                  <h3>Bill of Materials (BOM)</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="proposal-btn proposal-btn-secondary proposal-btn-sm"
                      onClick={() => fetchBomItemsMaster()}
                      style={{ fontSize: '12px' }}
                    >
                      🔄 Refresh Items
                    </button>
                    <button
                      type="button"
                      className="proposal-btn proposal-btn-secondary proposal-btn-sm"
                      onClick={addBOMRow}
                    >
                      + Add Row
                    </button>
                  </div>
                </div>

                <div className="proposal-table-wrapper">
                  <table className="proposal-table">
                    <thead>
                      <tr>
                        <th style={{ width: '200px' }}>Item Name *</th>
                        <th style={{ width: '200px' }}>Specification</th>
                        <th style={{ width: '100px' }}>Quantity</th>
                        <th style={{ width: '80px' }}>Unit</th>
                        <th style={{ width: '120px' }}>Rate (₹)</th>
                        <th style={{ width: '100px' }}>Tax %</th>
                        <th style={{ width: '120px' }}>Amount (₹)</th>
                        <th style={{ width: '80px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateData.bomItems.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="proposal-table-empty">
                            No BOM items added. Click "Add Row" to start.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {templateData.bomItems.map((row, index) => (
                            <tr key={index}>
                              {/* ITEM NAME WITH AUTOCOMPLETE */}
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
                                    className="proposal-table-input"
                                  />

                                  {/* AUTOCOMPLETE DROPDOWN */}
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

                              {/* SPECIFICATION */}
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

                              {/* QUANTITY */}
                              <td>
                                <input
                                  type="number"
                                  value={row.quantity}
                                  onChange={(e) => updateBOMRow(index, 'quantity', e.target.value)}
                                  placeholder="0"
                                  className="proposal-table-input"
                                />
                              </td>

                              {/* UNIT */}
                              <td>
                                <div className="unit-input-container" style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    value={row.unit || ''}
                                    onChange={(e) => handleUnitChange(index, e.target.value)}
                                    onFocus={() => {
                                      filterUnits(index, row.unit || '');
                                      setShowUnitDropdown(prev => ({ ...prev, [index]: true }));
                                    }}
                                    onBlur={(e) => {
                                      setTimeout(() => handleUnitBlur(index, e.target.value), 200);
                                    }}
                                    placeholder="Type or select"
                                    autoComplete="off"
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '4px',
                                      fontSize: '13px'
                                    }}
                                  />

                                  {/* UNIT DROPDOWN */}
                                  {showUnitDropdown[index] && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: 0,
                                      right: 0,
                                      background: 'white',
                                      border: '2px solid #3b82f6',
                                      borderRadius: '6px',
                                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                      maxHeight: '250px',
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
                                        color: '#475569',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1
                                      }}>
                                        📏 Select Unit ({filteredUnits[index]?.length || COMMON_UNITS.length})
                                        <button
                                          type="button"
                                          onClick={() => setShowUnitDropdown(prev => ({ ...prev, [index]: false }))}
                                          style={{
                                            float: 'right',
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '16px',
                                            cursor: 'pointer',
                                            color: '#94a3b8'
                                          }}
                                        >
                                          ×
                                        </button>
                                      </div>

                                      <div>
                                        {(filteredUnits[index]?.length > 0 ? filteredUnits[index] : COMMON_UNITS).map((unit) => (
                                          <div
                                            key={unit}
                                            onClick={() => selectUnit(index, unit)}
                                            style={{
                                              padding: '8px 12px',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #f1f5f9',
                                              transition: 'background-color 0.2s',
                                              fontSize: '13px'
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
                                            {unit}
                                          </div>
                                        ))}

                                        {row.unit && row.unit.trim().length > 0 &&
                                          !COMMON_UNITS.some(u => u.toLowerCase() === row.unit.toLowerCase()) && (
                                            <div style={{
                                              padding: '10px 12px',
                                              background: '#fef3c7',
                                              borderTop: '2px solid #fbbf24',
                                              fontSize: '11px',
                                              color: '#92400e',
                                              fontWeight: '500'
                                            }}>
                                              ✨ Press Enter or Tab to add "{row.unit}" as custom unit
                                            </div>
                                          )}

                                        {filteredUnits[index]?.length === 0 && (
                                          <div style={{
                                            padding: '20px',
                                            textAlign: 'center',
                                            color: '#94a3b8',
                                            fontSize: '12px'
                                          }}>
                                            No matching units found.
                                            <br />
                                            <strong>Type and press Enter</strong> to add "{row.unit}" as custom unit.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* RATE */}
                              <td>
                                <input
                                  type="number"
                                  value={row.rate}
                                  onChange={(e) => updateBOMRow(index, 'rate', e.target.value)}
                                  placeholder="0.00"
                                  className="proposal-table-input"
                                />
                              </td>

                              {/* TAX */}
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

                              {/* AMOUNT (READ-ONLY) */}
                              <td>
                                <input
                                  type="number"
                                  value={row.amount}
                                  readOnly
                                  className="proposal-table-input proposal-table-readonly"
                                  style={{
                                    fontWeight: '600',
                                    color: '#2d3748'
                                  }}
                                />
                              </td>

                              {/* ACTIONS */}
                              <td>
                                <button
                                  type="button"
                                  onClick={() => removeBOMRow(index)}
                                  className="proposal-delete-btn"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}

                          {/* SUMMARY ROWS */}
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

          <div className="proposal-modal-actions">
            <button 
              type="button" 
              className="proposal-btn proposal-btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="proposal-btn proposal-btn-primary" 
              disabled={loading}
            >
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Proposal' : 'Create Proposal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProposalModal;