// ─────────────────────────────────────────────────────────────────────────────
//  EMD tab — the bid security as money: how much was paid, how, from which of
//  our accounts, to whose account, and whether (and how much) came back.
//
//  emdAmount is the one field the tender demands (also on Basic Info); every
//  other field here tracks what actually happened. The summary at the top is
//  emdSummary() — the same rule the tenders list uses for its EMD column and
//  tiles, so the two can never disagree.
//
//  Not gated on eligibility: money that is out with a client must stay
//  trackable whatever the tender's state.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import FilterSelect from '../Dropdowns/FilterSelect';
import { EMD_STATUSES, EMD_MODES, EMD_INSTRUMENTS, emdSummary, fmtINR } from '../../services/tenderData';

export default function TenderEmdTab({ tender, patch }) {
  const s = emdSummary(tender);
  const isInstrument = EMD_INSTRUMENTS.has(tender.emdPaymentMode);

  const field = (label, k, { type = 'text', full = false, placeholder = '', onChange } = {}) => (
    <div className="leads-enquiries-form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      <input type={type} value={tender[k] ?? ''} placeholder={placeholder}
        onChange={(e) => (onChange ? onChange(e.target.value) : patch({ [k]: e.target.value }))} />
    </div>
  );
  const select = (label, k, options, placeholder) => (
    <div className="leads-enquiries-form-group">
      <label>{label}</label>
      <FilterSelect
        value={tender[k] || ''}
        options={options.map((o) => ({ value: o, label: o }))}
        placeholder={placeholder}
        onChange={(v) => patch({ [k]: v })}
      />
    </div>
  );

  // Recording a payment marks the EMD paid; recording a refund marks it
  // refunded — but only moving forward from an open state, never over a status
  // someone chose deliberately (Forfeited, Adjusted…).
  const onPaid = (v) => {
    const changes = { emdPaidAmount: v };
    if (v && (!tender.emdStatus || tender.emdStatus === 'Not paid')) changes.emdStatus = 'Paid';
    patch(changes);
  };
  const onRefund = (k) => (v) => {
    const next = { ...tender, [k]: v };
    const changes = { [k]: v };
    const open = ['Paid', 'Refund requested', ''].includes(tender.emdStatus || '');
    if (open && next.emdRefundAmount && next.emdRefundDate) changes.emdStatus = 'Refunded';
    patch(changes);
  };

  const required = Number(tender.emdAmount) || 0;
  const mismatch = s.paid > 0 && required > 0 && s.paid !== required;

  return (
    <div>
      {/* Where the money stands */}
      <div className={`tnd-elig-banner ${s.refundDue || s.expiring ? 'tnd-elig-nogo'
        : s.blocked > 0 ? 'tnd-elig-pending' : 'tnd-elig-go'}`}>
        <span className="tnd-elig-verdict">{s.status || 'Not recorded'}</span>
        <span className="tnd-elig-note">
          Required {required ? fmtINR(required) : '—'}
          {' · '}Paid {s.paid ? fmtINR(s.paid) : '—'}
          {' · '}Returned {s.refunded ? fmtINR(s.refunded) : '—'}
          {s.blocked > 0 && <b>{' · '}{fmtINR(s.blocked)} still with the client</b>}
          {s.deducted > 0 && <b>{' · '}{fmtINR(s.deducted)} deducted on refund</b>}
        </span>
      </div>
      {s.refundDue && (
        <p className="tnd-emd-alert">
          This tender is {tender.status.toLowerCase()} but {fmtINR(s.blocked)} of EMD has not come back —
          follow up with the client and record the refund below.
        </p>
      )}
      {s.expiring && (
        <p className="tnd-emd-alert">
          The {tender.emdPaymentMode.toLowerCase()} is valid only till {tender.emdValidTill} — get it
          extended or returned.
        </p>
      )}
      {tender.status === 'Won' && s.blocked > 0 && (
        <p className="tnd-hint">
          Won: the EMD is usually refunded once the performance security is furnished, or adjusted
          against it — record whichever happens.
        </p>
      )}

      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Payment</h3>
        <div className="leads-enquiries-form-grid">
          {field('EMD Required by Tender (₹)', 'emdAmount', { type: 'number' })}
          {select('EMD Status', 'emdStatus', EMD_STATUSES, 'Select status')}
          <div className="leads-enquiries-form-group">
            <label>Amount Paid (₹)</label>
            <input type="number" value={tender.emdPaidAmount ?? ''} onChange={(e) => onPaid(e.target.value)}
              placeholder={required ? String(required) : ''} />
            {required > 0 && !tender.emdPaidAmount && (
              <button type="button" className="tnd-link-txt" style={{ marginTop: 4, alignSelf: 'flex-start' }}
                onClick={() => onPaid(String(required))}>
                Same as required ({fmtINR(required)})
              </button>
            )}
            {mismatch && <span className="tnd-emd-warn">Differs from the {fmtINR(required)} the tender asks for.</span>}
          </div>
          {field('Date Paid', 'emdPaidDate', { type: 'date' })}
          {select('Payment Mode', 'emdPaymentMode', EMD_MODES, 'Select mode')}
          {field(isInstrument ? 'Instrument No. (BG / DD / bond)' : 'UTR / Transaction Reference', 'emdReference')}
          {isInstrument && field('Valid Till', 'emdValidTill', { type: 'date' })}
          {field('Paid From (our account)', 'emdPaidFromAccount', {
            placeholder: 'e.g. HDFC Current A/c ••••4321', full: !isInstrument,
          })}
        </div>
      </div>

      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Paid To (beneficiary)</h3>
        <div className="leads-enquiries-form-grid">
          {field('Beneficiary / In Favour Of', 'emdBeneficiaryName', { placeholder: tender.issuingAuthority || '' })}
          {field('Bank & Branch', 'emdBeneficiaryBank')}
          {field('Account Number', 'emdBeneficiaryAccount')}
          {field('IFSC', 'emdBeneficiaryIfsc', {
            onChange: (v) => patch({ emdBeneficiaryIfsc: v.toUpperCase() }),
          })}
        </div>
      </div>

      <div className="leads-enquiries-form-section">
        <h3 className="leads-enquiries-form-section-title">Refund / Return</h3>
        <div className="leads-enquiries-form-grid">
          {field(isInstrument ? 'Amount Released (₹)' : 'Amount Refunded (₹)', 'emdRefundAmount', {
            type: 'number', onChange: onRefund('emdRefundAmount'),
          })}
          {field(isInstrument ? 'Date Returned' : 'Date Refunded', 'emdRefundDate', {
            type: 'date', onChange: onRefund('emdRefundDate'),
          })}
          {field('Refund Reference (UTR / letter no.)', 'emdRefundReference')}
          {field('Credited To (our account)', 'emdRefundAccount', { placeholder: tender.emdPaidFromAccount || '' })}
          <div className="leads-enquiries-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Notes</label>
            <textarea rows={3} value={tender.emdNotes ?? ''} onChange={(e) => patch({ emdNotes: e.target.value })}
              placeholder="Refund request letter, follow-ups, reason for any deduction or forfeiture…" />
          </div>
        </div>
      </div>
    </div>
  );
}
