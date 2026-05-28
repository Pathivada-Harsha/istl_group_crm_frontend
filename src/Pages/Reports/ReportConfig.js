import React, { useState } from 'react';
import { Plus, X, Calendar, Clock, Users, Tag, Play, Download } from 'lucide-react';
import FilterSelect from '../Dropdowns/FilterSelect';

const ReportConfig = ({ reportConfig, onConfigChange, onRunReport, isRunning }) => {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'once',
    recipients: [],
    format: 'docx',
    time: '09:00'
  });

  const handleAddFilter = () => {
    const newFilter = {
      field: 'date',
      operator: '=',
      value: ''
    };
    onConfigChange({
      filters: [...reportConfig.filters, newFilter]
    });
  };

  const handleUpdateFilter = (index, updates) => {
    const newFilters = [...reportConfig.filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onConfigChange({ filters: newFilters });
  };

  const handleRemoveFilter = (index) => {
    const newFilters = reportConfig.filters.filter((_, i) => i !== index);
    onConfigChange({ filters: newFilters });
  };

  const handleSchedule = () => {
    // Save schedule configuration
    onConfigChange({ schedule: scheduleConfig });
    setShowScheduleModal(false);
    alert(`Report scheduled: ${scheduleConfig.frequency} at ${scheduleConfig.time}`);
  };

  const operatorOptions = [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not Equals' },
    { value: '>', label: 'Greater Than' },
    { value: '<', label: 'Less Than' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<=', label: 'Less or Equal' },
    { value: 'IN', label: 'In List' },
    { value: 'BETWEEN', label: 'Between' },
    { value: 'LIKE', label: 'Contains' }
  ];

  const fieldOptions = [
    { value: 'date', label: 'Date' },
    { value: 'customer_name', label: 'Customer Name' },
    { value: 'vendor_name', label: 'Vendor Name' },
    { value: 'status', label: 'Status' },
    { value: 'amount', label: 'Amount' },
    { value: 'group_name', label: 'Group' },
    { value: 'region', label: 'Region' },
    { value: 'assigned_to', label: 'Assigned To' }
  ];

  return (
    <div className="report-config">
      <div className="report-config-header">
        <h2>Report Configuration</h2>
      </div>

      {/* Metadata Section */}
      <div className="config-section">
        <h3 className="config-section-title">Report Details</h3>
        
        <div className="config-form-group">
          <label>Report Name *</label>
          <input
            type="text"
            value={reportConfig.name}
            onChange={(e) => onConfigChange({ name: e.target.value })}
            placeholder="Enter report name"
          />
        </div>

        <div className="config-form-group">
          <label>Description</label>
          <textarea
            value={reportConfig.description}
            onChange={(e) => onConfigChange({ description: e.target.value })}
            placeholder="Describe what this report shows..."
            rows="3"
          />
        </div>

        <div className="config-form-row">
          <div className="config-form-group">
            <label>Owner</label>
            <input
              type="text"
              value={reportConfig.owner}
              onChange={(e) => onConfigChange({ owner: e.target.value })}
            />
          </div>

          <div className="config-form-group">
            <label>Visibility</label>
            <FilterSelect
              value={reportConfig.visibility}
              onChange={v => onConfigChange({ visibility: v })}
              options={[{value:'private',label:'Private'},{value:'team',label:'Team'},{value:'global',label:'Global'}]}
              placeholder="Select Visibility"
            />
          </div>
        </div>

        <div className="config-form-group">
          <label>Tags</label>
          <input
            type="text"
            placeholder="sales, monthly, finance (comma separated)"
            value={reportConfig.tags.join(', ')}
            onChange={(e) => onConfigChange({ 
              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
            })}
          />
        </div>
      </div>

      {/* Filters Section */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">Filters</h3>
          <button className="config-btn-add" onClick={handleAddFilter}>
            <Plus size={16} />
            Add Filter
          </button>
        </div>

        {reportConfig.filters.length === 0 ? (
          <div className="config-empty-state">
            <p>No filters applied</p>
            <p className="config-empty-hint">Add filters to narrow down data</p>
          </div>
        ) : (
          <div className="filters-list">
            {reportConfig.filters.map((filter, index) => (
              <div key={index} className="filter-row">
                <FilterSelect
                  value={filter.field}
                  onChange={v => handleUpdateFilter(index, { field: v })}
                  options={fieldOptions}
                  placeholder="Field"
                />

                <FilterSelect
                  value={filter.operator}
                  onChange={v => handleUpdateFilter(index, { operator: v })}
                  options={operatorOptions}
                  placeholder="Operator"
                />

                <input
                  type="text"
                  className="filter-value"
                  value={filter.value}
                  onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                  placeholder="Value"
                />

                <button
                  className="filter-remove-btn"
                  onClick={() => handleRemoveFilter(index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run Controls */}
      <div className="config-section">
        <h3 className="config-section-title">Run Controls</h3>
        
        <div className="config-run-controls">
          <button 
            className="config-btn-run"
            onClick={onRunReport}
            disabled={isRunning}
          >
            <Play size={18} />
            {isRunning ? 'Running...' : 'Run Now'}
          </button>

          <button className="config-btn-schedule" onClick={() => setShowScheduleModal(true)}>
            <Clock size={18} />
            Schedule Report
          </button>
        </div>
      </div>

      {/* Export Mode */}
      <div className="config-section">
        <h3 className="config-section-title">Export Settings</h3>
        
        <div className="config-form-group">
          <label>Export Mode</label>
          <div className="config-radio-group">
            <label className="config-radio-label">
              <input
                type="radio"
                name="exportMode"
                value="client"
                checked={reportConfig.exportMode !== 'server'}
                onChange={(e) => onConfigChange({ exportMode: 'client' })}
              />
              <span>Client-side</span>
              <span className="config-radio-hint">Fast, for small-medium reports</span>
            </label>
            <label className="config-radio-label">
              <input
                type="radio"
                name="exportMode"
                value="server"
                checked={reportConfig.exportMode === 'server'}
                onChange={(e) => onConfigChange({ exportMode: 'server' })}
              />
              <span>Server-side</span>
              <span className="config-radio-hint">For large datasets or scheduled exports</span>
            </label>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="config-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="config-modal-header">
              <h3>Schedule Report</h3>
              <button onClick={() => setShowScheduleModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="config-modal-body">
              <div className="config-form-group">
                <label>Frequency</label>
                <FilterSelect
                  value={scheduleConfig.frequency}
                  onChange={v => setScheduleConfig({ ...scheduleConfig, frequency: v })}
                  options={[{value:'once',label:'One Time'},{value:'daily',label:'Daily'},{value:'weekly',label:'Weekly'},{value:'monthly',label:'Monthly'},{value:'cron',label:'Custom (Cron)'}]}
                  placeholder="Select Frequency"
                />
              </div>

              <div className="config-form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={scheduleConfig.time}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                />
              </div>

              <div className="config-form-group">
                <label>Recipients (comma separated emails)</label>
                <input
                  type="text"
                  placeholder="email1@example.com, email2@example.com"
                  value={scheduleConfig.recipients.join(', ')}
                  onChange={(e) => setScheduleConfig({ 
                    ...scheduleConfig, 
                    recipients: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                  })}
                />
              </div>

              <div className="config-form-group">
                <label>Export Format</label>
                <FilterSelect
                  value={scheduleConfig.format}
                  onChange={v => setScheduleConfig({ ...scheduleConfig, format: v })}
                  options={[{value:'docx',label:'Word (.docx)'},{value:'pdf',label:'PDF'},{value:'xlsx',label:'Excel'},{value:'csv',label:'CSV'}]}
                  placeholder="Select Format"
                />
              </div>
            </div>

            <div className="config-modal-actions">
              <button className="config-btn-primary" onClick={handleSchedule}>
                Schedule
              </button>
              <button className="config-btn-secondary" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportConfig;