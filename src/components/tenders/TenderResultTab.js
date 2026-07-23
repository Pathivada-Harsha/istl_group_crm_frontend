// ─────────────────────────────────────────────────────────────────────────────
//  Result tab — bid outcome. Owns the single tender.status field (the lifecycle
//  status shown everywhere else). When status is "Won", the award fields reveal
//  and a linked-project affordance appears.
//
//  The linked project is UI-ONLY here: a won tender would create a linked project
//  in the Projects module (contract value seeds the budget). No project is
//  created in this frontend-only build.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import FilterSelect from '../Dropdowns/FilterSelect';
import { TENDER_STATUSES, OUR_RANKS, LOSS_REASONS } from '../../services/tenderData';

export default function TenderResultTab({ tender, patch }) {
  const field = (label, k, { type = 'text', full = false, placeholder = '' } = {}) => (
    <div className="leads-enquiries-form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      <input type={type} value={tender[k] ?? ''} placeholder={placeholder} onChange={(e) => patch({ [k]: e.target.value })} />
    </div>
  );
  const select = (label, k, options, placeholder) => (
    <div className="leads-enquiries-form-group">
      <label>{label}</label>
      <FilterSelect
        value={tender[k] || ''}
        options={options.map((o) => ({ value: o, label: o }))}
        placeholder={placeholder || `Select ${label}`}
        onChange={(v) => patch({ [k]: v })}
      />
    </div>
  );

  const isWon = tender.status === 'Won';

  return (
    <div>
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Bid Result</h3>
        <div className="leads-enquiries-form-grid">
          {select('Status', 'status', TENDER_STATUSES)}
          {select('Our Rank', 'ourRank', OUR_RANKS)}
          {field('L1 Value (₹)', 'l1Value', { type: 'number' })}
          {field('Result', 'result', { placeholder: 'e.g. Awarded / Technically qualified' })}
          {select('Loss Reason', 'lossReason', LOSS_REASONS, 'If lost, why?')}
          <div className="leads-enquiries-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Competitor Notes</label>
            <textarea rows={3} value={tender.competitorNotes ?? ''} onChange={(e) => patch({ competitorNotes: e.target.value })}
              placeholder="Competitors, rates, observations…" />
          </div>
        </div>
      </div>

      {/* Won → award details + linked-project affordance */}
      {isWon && (
        <div className="tnd-won-block">
          <h3 className="tnd-won-title">🏆 Award Details</h3>
          <div className="leads-enquiries-form-grid">
            {field('Contract Value (₹)', 'contractValue', { type: 'number' })}
            {field('LOA Number', 'loaNumber')}
            {field('LOA Date', 'loaDate', { type: 'date' })}
            {field('Agreement Date', 'agreementDate', { type: 'date' })}
          </div>

          <div className="tnd-project-strip">
            <span className="tnd-project-strip-tag">Linked Project</span>
            {tender.projectId
              ? <span className="tnd-link-chip">🔗 {tender.projectId}</span>
              : <span className="tnd-link-chip tnd-link-chip--none">No project linked yet — will be created on award</span>}
            <span className="tnd-project-strip-note">
              A won tender creates a linked project in the Projects module, with the contract value seeding the project budget.
              Shown here as an indicator only — no project is created in this frontend-only build.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
