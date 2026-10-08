// ─────────────────────────────────────────────────────────────────────────────
//  tenderImportFields — what kind of control each tender field gets in an
//  import review. Shared by the PDF review and the Excel review, so a field
//  looks and edits the same whichever way it was imported.
// ─────────────────────────────────────────────────────────────────────────────
import {
  SECTORS, TENDER_TYPES, SOURCES, CLIENT_TYPES, FINANCIAL_YEARS,
} from '../../services/tenderData';

// A parser can put a value outside a fixed vocabulary, so every dropdown keeps
// whatever was read as an extra option rather than silently dropping it.
export const SELECTS = {
  sector: SECTORS,
  tenderType: TENDER_TYPES,
  source: SOURCES,
  clientType: CLIENT_TYPES,
  financialYear: FINANCIAL_YEARS,
  feeRefundable: ['Yes', 'No'],
};
export const DATE_FIELDS = new Set([
  'submissionDeadline', 'technicalOpeningDate', 'financialOpeningDate', 'emdValidTill',
]);
export const MONEY_FIELDS = new Set(['estimatedValue', 'emdAmount', 'feeAmount']);
export const LONG_FIELDS = new Set(['tenderName', 'clientAddress']);

export const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// Money is stored as plain rupees. The input keeps the raw figure — it is what
// gets saved — and a formatted hint sits beside it, because nine unbroken
// digits are exactly the thing a reviewer cannot check at a glance.
export const money = (value) => {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : null;
};
