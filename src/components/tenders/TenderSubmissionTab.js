// ─────────────────────────────────────────────────────────────────────────────
//  Submission tab — the portal submission record.
//
//  Every field here is a SINGLE source of truth, not a duplicate:
//   • submissionReference is the one portal-acknowledgement field — the same
//     field the Workflow "Ready for Submission" stage records.
//   • submissionDeadline and portalLink are the same fields shown on Basic Info.
//  Editing them here edits those one-and-only fields.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import FilterSelect from '../Dropdowns/FilterSelect';
import { SUBMISSION_MODES } from '../../services/tenderData';

export default function TenderSubmissionTab({ tender, patch }) {
  const field = (label, k, { type = 'text', full = false, placeholder = '' } = {}) => (
    <div className="leads-enquiries-form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      <input type={type} value={tender[k] ?? ''} placeholder={placeholder} onChange={(e) => patch({ [k]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Portal Submission</h3>
        <div className="leads-enquiries-form-grid">
          <div className="leads-enquiries-form-group">
            <label>Submission Mode</label>
            <FilterSelect
              value={tender.submissionMode || ''}
              options={SUBMISSION_MODES.map((m) => ({ value: m, label: m }))}
              placeholder="Select Mode"
              onChange={(v) => patch({ submissionMode: v })}
            />
          </div>
          {field('Submission Reference', 'submissionReference', { placeholder: 'Portal acknowledgement number' })}
          {field('Submission Date', 'submissionDate', { type: 'date' })}
          {field('Submitted By', 'submittedBy')}
        </div>
        <p className="tnd-hint" style={{ marginTop: 10 }}>
          Submission Reference is shared with the Workflow tab's “Ready for Submission” stage — one field, one value.
        </p>
      </div>

      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Deadline & Portal</h3>
        <div className="leads-enquiries-form-grid">
          {field('Submission Deadline', 'submissionDeadline', { type: 'date' })}
          {field('Portal Link', 'portalLink', { full: true, placeholder: 'https://…' })}
        </div>
        <p className="tnd-hint" style={{ marginTop: 10 }}>
          Deadline and Portal Link are the same fields as on Basic Info — editing them here updates that one record.
        </p>
      </div>
    </div>
  );
}
