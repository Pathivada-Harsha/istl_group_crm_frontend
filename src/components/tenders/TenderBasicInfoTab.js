// ─────────────────────────────────────────────────────────────────────────────
//  Basic Info tab — identification, client KYC, classification, location,
//  financials and key dates. Reuses the Leads form-section / form-grid /
//  form-group classes so it looks native.
//
//  NOTE: submissionDeadline and portalLink are single fields shared with the
//  Submission tab (one field per real-world fact).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import FilterSelect from '../Dropdowns/FilterSelect';
import filterApi from '../../services/filterApi';
import { CLIENT_TYPES, TENDER_TYPES, SOURCES, FINANCIAL_YEARS, ISSUING_AUTHORITIES } from '../../services/tenderData';

// Same Group / Category lists the Leads form uses (filterApi → /filters/groups, /filters/subgroups).
const optionOf = (g) => ({ value: g.value || g.label, label: g.label || g.value });

export default function TenderBasicInfoTab({ tender, patch }) {
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    filterApi.getAssignableUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    filterApi.getAllGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!tender.groupName) { setSubGroups([]); return; }
    filterApi.getSubGroups(tender.groupName).then(setSubGroups).catch(() => setSubGroups([]));
  }, [tender.groupName]);

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
          <div className="leads-enquiries-form-group">
            <label>Group</label>
            <FilterSelect
              value={tender.groupName || ''}
              options={groups.map(optionOf)}
              placeholder="Select Group"
              onChange={(v) => patch({ groupName: v, subGroupName: '' })}
            />
          </div>
          <div className="leads-enquiries-form-group">
            <label>Category</label>
            <FilterSelect
              value={tender.subGroupName || ''}
              options={subGroups.map(optionOf)}
              placeholder={!tender.groupName ? 'Select Group First' : 'Select Category'}
              disabled={!tender.groupName}
              onChange={(v) => patch({ subGroupName: v })}
            />
          </div>
          {select('Tender Type', 'tenderType', TENDER_TYPES)}
          {select('Source', 'source', SOURCES)}
          {select('Financial Year', 'financialYear', FINANCIAL_YEARS)}
          <div className="leads-enquiries-form-group">
            <label>Assign To</label>
            <FilterSelect
              value={tender.assignedTo ? String(tender.assignedTo) : ''}
              options={users.map((u) => ({ value: String(u.id), label: u.name }))}
              placeholder="Select Member"
              onChange={(v) => patch({ assignedTo: v ? Number(v) : null, assignedToName: '' })}
            />
          </div>
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
