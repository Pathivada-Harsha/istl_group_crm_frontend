import React, { useState, useEffect } from 'react';
import './CreateProposalModal.css';
import { useAuth } from "../../hooks/useAuth";
import useToast from '../../hooks/useToast';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function CreateProposalModal({ lead, onClose, onProposalCreated, defaultTemplate }) {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Form state - Basic Info
  const [formData, setFormData] = useState({
    leadId: lead.id,
    title: '',
    description: '',
    totalValue: '',
    groupName: lead.groupName || '',
    subGroupName: lead.subGroupName || '',
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

      const response = await fetch(`${API_BASE_URL}/proposals/create`, {
        method: 'POST',
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
        throw new Error(errorData.message || 'Failed to create proposal');
      }

      const data = await response.json();
      
      if (data.success) {
        onProposalCreated();
      } else {
        throw new Error(data.message || 'Failed to create proposal');
      }
    } catch (err) {
      showError(err.message || 'Error creating proposal');
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
      bomItems: [...templateData.bomItems, { item: '', specification: '', quantity: '', unit: '', rate: '', amount: '' }]
    });
  };

  const updateBOMRow = (index, field, value) => {
    const updated = [...templateData.bomItems];
    updated[index][field] = value;

    // Auto-calculate amount if quantity and rate are present
    if (field === 'quantity' || field === 'rate') {
      const quantity = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      updated[index].amount = (quantity * rate).toFixed(2);
    }

    setTemplateData({ ...templateData, bomItems: updated });
  };

  const removeBOMRow = (index) => {
    const updated = templateData.bomItems.filter((_, i) => i !== index);
    setTemplateData({ ...templateData, bomItems: updated });
  };

  // Calculate totals
  const calculateBOMTotal = () => {
    return templateData.bomItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2);
  };

  const calculateSystemPricingTotal = () => {
    return templateData.systemPricing.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2);
  };

  return (
    <div className="proposal-modal-overlay" onClick={onClose}>
      <div className="proposal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="proposal-modal-header">
          <div>
            <h2>Create Proposal for {lead.name}</h2>
            <p className="proposal-modal-lead-info">
              Lead: {lead.leadCode} | {lead.email} | {lead.phone}
            </p>
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
                  <button
                    type="button"
                    className="proposal-btn proposal-btn-secondary proposal-btn-sm"
                    onClick={addBOMRow}
                  >
                    + Add Row
                  </button>
                </div>
                <div className="proposal-table-wrapper">
                  <table className="proposal-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Specification</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Rate (₹)</th>
                        <th>Amount (₹)</th>
                        <th style={{ width: '80px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateData.bomItems.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="proposal-table-empty">
                            No BOM items added. Click "Add Row" to start.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {templateData.bomItems.map((row, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="text"
                                  value={row.item}
                                  onChange={(e) => updateBOMRow(index, 'item', e.target.value)}
                                  placeholder="Item name"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={row.specification}
                                  onChange={(e) => updateBOMRow(index, 'specification', e.target.value)}
                                  placeholder="Specification"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={row.quantity}
                                  onChange={(e) => updateBOMRow(index, 'quantity', e.target.value)}
                                  placeholder="0"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={row.unit}
                                  onChange={(e) => updateBOMRow(index, 'unit', e.target.value)}
                                  placeholder="Nos/Kg"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={row.rate}
                                  onChange={(e) => updateBOMRow(index, 'rate', e.target.value)}
                                  placeholder="0.00"
                                  className="proposal-table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={row.amount}
                                  readOnly
                                  className="proposal-table-input proposal-table-readonly"
                                />
                              </td>
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
                          <tr className="proposal-table-total">
                            <td colSpan="5" style={{ textAlign: 'right' }}>Total:</td>
                            <td>₹{calculateBOMTotal()}</td>
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
              {loading ? 'Creating...' : 'Create Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProposalModal;