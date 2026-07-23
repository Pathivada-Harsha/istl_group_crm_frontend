// ─────────────────────────────────────────────────────────────────────────────
//  Basic Info tab — identification, client KYC, classification, location,
//  financials and key dates. Reuses the Leads form-section / form-grid /
//  form-group classes so it looks native.
//
//  NOTE: submissionDeadline and portalLink are single fields shared with the
//  Submission tab (one field per real-world fact).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import FilterSelect from '../Dropdowns/FilterSelect';
import { CLIENT_TYPES, SECTORS, TENDER_TYPES, SOURCES, FINANCIAL_YEARS, ISSUING_AUTHORITIES } from '../../services/tenderData';

export default function TenderBasicInfoTab({ tender, patch }) {
  // helper renderers (plain functions, NOT components, so inputs never remount)
  const field = (label, k, { type = 'text', full = false, placeholder = '' } = {}) => (
    <div className="leads-enquiries-form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      <input
        type={type}
        value={tender[k] ?? ''}
        placeholder={placeholder}
        onChange={(e) => patch({ [k]: e.target.value })}
      />
    </div>
  );

  const select = (label, k, options) => (
    <div className="leads-enquiries-form-group">
      <label>{label}</label>
      <FilterSelect
        value={tender[k] || ''}
        options={options.map((o) => ({ value: o, label: o }))}
        placeholder={`Select ${label}`}
        onChange={(v) => patch({ [k]: v })}
      />
    </div>
  );

  return (
    <div>
      {/* Identification */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Tender Identification</h3>
        <div className="leads-enquiries-form-grid">
          {field('Tender Number / NIT No.', 'tenderNumber', { placeholder: 'e.g. GEM/2026/B/5541203' })}
          {field('Tender Name / Title', 'tenderName', { full: true })}
          <div className="leads-enquiries-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Issuing Authority</label>
            <input
              list="tnd-issuing-authorities"
              value={tender.issuingAuthority ?? ''}
              placeholder="Select a known authority or type your own…"
              onChange={(e) => patch({ issuingAuthority: e.target.value })}
            />
            <datalist id="tnd-issuing-authorities">
              {ISSUING_AUTHORITIES.map((a) => <option key={a} value={a} />)}
            </datalist>
          </div>
          {select('Sector', 'sector', SECTORS)}
          {select('Tender Type', 'tenderType', TENDER_TYPES)}
          {select('Source', 'source', SOURCES)}
          {select('Financial Year', 'financialYear', FINANCIAL_YEARS)}
        </div>
      </div>

      {/* Client / Developer KYC */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Client / Developer KYC</h3>
        <div className="leads-enquiries-form-grid">
          {field('Company / Organisation', 'clientCompany')}
          {select('Client Type', 'clientType', CLIENT_TYPES)}
          {field('GSTIN', 'clientGstin')}
          {field('PAN', 'clientPan')}
          {field('CIN', 'clientCin')}
          {field('Contact Person', 'clientContactPerson')}
          {field('Contact Email', 'clientContactEmail', { type: 'email' })}
          {field('Contact Phone', 'clientContactPhone')}
          {field('Address', 'clientAddress', { full: true })}
          {field('City', 'clientCity')}
          {field('State', 'clientState')}
        </div>
      </div>

      {/* Location & Portal */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Location & Portal</h3>
        <div className="leads-enquiries-form-grid">
          {field('Portal Link', 'portalLink', { full: true, placeholder: 'https://…' })}
          {field('Site Location', 'location')}
          {field('District', 'district')}
          {field('State', 'state')}
        </div>
      </div>

      {/* Financials */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Financials</h3>
        <div className="leads-enquiries-form-grid">
          {field('Estimated Value (₹)', 'estimatedValue', { type: 'number' })}
          {field('EMD Amount (₹)', 'emdAmount', { type: 'number' })}
          {field('Performance Security (%)', 'performanceSecurityPct', { type: 'number' })}
        </div>
      </div>

      {/* Key Dates */}
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Key Dates</h3>
        <div className="leads-enquiries-form-grid">
          {field('Submission Deadline', 'submissionDeadline', { type: 'date' })}
          {field('Technical Opening', 'technicalOpeningDate', { type: 'date' })}
          {field('Financial Opening', 'financialOpeningDate', { type: 'date' })}
        </div>
      </div>
    </div>
  );
}
