// ─────────────────────────────────────────────────────────────────────────────
//  tenderExport — the tender register as an Excel workbook: every tender the
//  list currently shows (its filters, search and sort — every page, not just
//  the visible one), with ALL of its data.
//
//  One row per tender on "Tenders" (every scalar the tender holds, plus the
//  computed bid / cost / margin / eligibility the screens show), and one sheet
//  per child collection — Eligibility, Documents, BOQ, Document Requests,
//  History — each row carrying the tender number and name so the sheets can be
//  filtered and joined. A Summary sheet records which filters produced it.
//
//  Figures are written as numbers (sum / filter work in Excel), dates as real
//  dates; computed columns use the same functions as the app, so the workbook
//  and the screens can never disagree.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSXStyle from 'xlsx-js-style';
import {
  OPERATORS, boqBidTotal, boqCostTotal, boqEffectiveProfitPct, boqTenderTotal, boqLineOurRate,
  boqLineAmount, boqLineTenderAmount, boqLineVariancePct, computeEligibility, evaluateCriterion,
  emdSummary, qualifyingTiers, isOverdue, currentUserLabel,
} from '../../services/tenderData';

const NAVY = '1F4E79';
const BORDER = { style: 'thin', color: { rgb: 'BFBFBF' } };
const HEADER_STYLE = {
  fill: { patternType: 'solid', fgColor: { rgb: NAVY } },
  font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
  alignment: { vertical: 'center', wrapText: true },
  border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
};
const FORMATS = { money: '#,##0.00', number: '#,##0.##', pct: '0.00', date: 'dd-mmm-yyyy' };

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

// '' stays empty; a figure becomes a number cell.
const toNumber = (v) => {
  if (blank(v)) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// 'YYYY-MM-DD' (or with a time) → a real date, kept in local time so the day
// never shifts; anything unreadable is written as text rather than dropped.
const toDate = (v) => {
  if (blank(v)) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return String(v);
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
};

const operatorLabel = (code) => (OPERATORS.find((o) => o.value === code) || {}).label || code || '';
const yesNo = (b) => (b ? 'Yes' : 'No');
const decisionLabel = (d) => ({ GO: 'GO', NO_GO: 'NO-GO', PENDING: 'Pending' }[d] || d || '');

// ── one sheet from a column spec: [{ h, v: (row) => value, t?: 'money'|'number'|'pct'|'date', w? }]
function sheet(columns, rows) {
  const aoa = [columns.map((c) => c.h)];
  rows.forEach((r) => {
    aoa.push(columns.map((c) => {
      const raw = c.v(r);
      if (c.t === 'date') return toDate(raw);
      if (c.t === 'money' || c.t === 'number' || c.t === 'pct') {
        const n = typeof raw === 'number' ? raw : toNumber(raw);
        return n == null ? (blank(raw) ? null : String(raw)) : n;
      }
      return blank(raw) ? null : String(raw);
    }));
  });
  const ws = XLSXStyle.utils.aoa_to_sheet(aoa, { cellDates: true });

  columns.forEach((c, ci) => {
    const head = ws[XLSXStyle.utils.encode_cell({ r: 0, c: ci })];
    if (head) head.s = HEADER_STYLE;
    for (let ri = 1; ri < aoa.length; ri += 1) {
      const cell = ws[XLSXStyle.utils.encode_cell({ r: ri, c: ci })];
      if (!cell) continue;
      if (FORMATS[c.t] && (cell.t === 'n' || cell.t === 'd')) cell.z = FORMATS[c.t];
      cell.s = { alignment: { vertical: 'top', wrapText: !!c.wrap }, border: { bottom: BORDER } };
    }
  });
  ws['!cols'] = columns.map((c) => ({ wch: c.w || Math.min(45, Math.max(12, c.h.length + 2)) }));
  ws['!rows'] = [{ hpt: 30 }];
  if (aoa.length > 1) {
    ws['!autofilter'] = { ref: XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: columns.length - 1 } }) };
  }
  return ws;
}

// The two columns every child sheet starts with, so it can be filtered by tender.
const ofTender = [
  { h: 'Tender Number', v: (r) => r.tender.tenderNumber, w: 24 },
  { h: 'Tender Name', v: (r) => r.tender.tenderName, w: 40 },
];
const children = (tenders, key) => tenders.flatMap((tender) =>
  (tender[key] || []).map((row, i) => ({ tender, row, n: i + 1 })));

const TENDER_COLUMNS = [
  // identification
  { h: 'Tender Number', v: (t) => t.tenderNumber, w: 24 },
  { h: 'Tender Name', v: (t) => t.tenderName, w: 50, wrap: true },
  { h: 'Issuing Authority', v: (t) => t.issuingAuthority, w: 30 },
  { h: 'Status', v: (t) => t.status, w: 16 },
  { h: 'Overdue', v: (t) => (isOverdue(t) ? 'Yes' : ''), w: 10 },
  // client
  { h: 'Client Company', v: (t) => t.clientCompany, w: 30 },
  { h: 'Client Type', v: (t) => t.clientType },
  { h: 'Client GSTIN', v: (t) => t.clientGstin, w: 18 },
  { h: 'Client PAN', v: (t) => t.clientPan },
  { h: 'Client CIN', v: (t) => t.clientCin, w: 24 },
  { h: 'Client Contact Person', v: (t) => t.clientContactPerson, w: 22 },
  { h: 'Client Contact Email', v: (t) => t.clientContactEmail, w: 26 },
  { h: 'Client Contact Phone', v: (t) => t.clientContactPhone, w: 18 },
  { h: 'Client Address', v: (t) => t.clientAddress, w: 40, wrap: true },
  { h: 'Client City', v: (t) => t.clientCity },
  { h: 'Client State', v: (t) => t.clientState },
  // classification
  { h: 'Sector', v: (t) => t.sector },
  { h: 'Tender Type', v: (t) => t.tenderType },
  { h: 'Source', v: (t) => t.source },
  { h: 'Portal Link', v: (t) => t.portalLink, w: 30 },
  { h: 'Location', v: (t) => t.location, w: 20 },
  { h: 'District', v: (t) => t.district },
  { h: 'State', v: (t) => t.state },
  { h: 'Financial Year', v: (t) => t.financialYear },
  // money the tender states
  { h: 'Estimated Value (₹)', v: (t) => t.estimatedValue, t: 'money', w: 18 },
  { h: 'EMD Required (₹)', v: (t) => t.emdAmount, t: 'money', w: 16 },
  { h: 'Performance Security %', v: (t) => t.performanceSecurityPct, t: 'pct' },
  { h: 'Tender Fee (₹)', v: (t) => t.feeAmount, t: 'money', w: 15 },
  { h: 'Fee Refundable', v: (t) => t.feeRefundable },
  { h: 'Fee Beneficiary', v: (t) => t.feeBeneficiaryName, w: 26 },
  { h: 'Fee Bank', v: (t) => t.feeBeneficiaryBank, w: 22 },
  { h: 'Fee Account No', v: (t) => t.feeBeneficiaryAccount, w: 20 },
  { h: 'Fee IFSC', v: (t) => t.feeBeneficiaryIfsc },
  // dates
  { h: 'Submission Deadline', v: (t) => t.submissionDeadline, t: 'date', w: 16 },
  { h: 'Technical Opening', v: (t) => t.technicalOpeningDate, t: 'date', w: 16 },
  { h: 'Financial Opening', v: (t) => t.financialOpeningDate, t: 'date', w: 16 },
  // eligibility
  { h: 'Eligibility', v: (t) => decisionLabel(computeEligibility(t.eligibilityCriteria || [])) },
  { h: 'Qualifies for Tier', v: (t) => qualifyingTiers(t.eligibilityCriteria || []).join(', '), w: 20 },
  { h: 'Eligibility Criteria (count)', v: (t) => (t.eligibilityCriteria || []).length, t: 'number' },
  // rate analysis & bid (computed exactly as the Rate Analysis tab does)
  { h: 'Overhead %', v: (t) => t.overheadPct, t: 'pct' },
  { h: 'Profit %', v: (t) => t.profitPct, t: 'pct' },
  { h: 'BOQ Lines', v: (t) => (t.boqItems || []).length, t: 'number' },
  { h: 'Tender BOQ Total (₹)', v: (t) => boqTenderTotal(t), t: 'money', w: 18 },
  { h: 'Our Cost (₹)', v: (t) => boqCostTotal(t), t: 'money', w: 16 },
  { h: 'Our Bid Value (₹)', v: (t) => boqBidTotal(t), t: 'money', w: 18 },
  { h: 'Effective Margin %', v: (t) => (boqBidTotal(t) > 0 ? boqEffectiveProfitPct(t) : null), t: 'pct' },
  // workflow
  { h: 'Go / No-Go', v: (t) => t.goNoGo },
  { h: 'Go / No-Go Reason', v: (t) => t.goNoGoReason, w: 30, wrap: true },
  { h: 'Go / No-Go Date', v: (t) => t.goNoGoDate, t: 'date', w: 14 },
  { h: 'Documents (count)', v: (t) => (t.documents || []).length, t: 'number' },
  { h: 'Documents Ready', v: (t) => (t.documents || []).filter((d) => d.status === 'ready').length, t: 'number' },
  { h: 'CFO Approval', v: (t) => t.cfoApprovalStatus },
  { h: 'CFO Remarks', v: (t) => t.cfoApprovalRemarks, w: 30, wrap: true },
  { h: 'CFO Date', v: (t) => t.cfoApprovalDate, t: 'date', w: 14 },
  { h: 'MD Approval', v: (t) => t.mdApprovalStatus },
  { h: 'MD Remarks', v: (t) => t.mdApprovalRemarks, w: 30, wrap: true },
  { h: 'MD Date', v: (t) => t.mdApprovalDate, t: 'date', w: 14 },
  // EMD as money
  { h: 'EMD Status', v: (t) => emdSummary(t).status },
  { h: 'EMD Paid (₹)', v: (t) => t.emdPaidAmount, t: 'money', w: 15 },
  { h: 'EMD Paid Date', v: (t) => t.emdPaidDate, t: 'date', w: 14 },
  { h: 'EMD Payment Mode', v: (t) => t.emdPaymentMode },
  { h: 'EMD Reference', v: (t) => t.emdReference, w: 20 },
  { h: 'EMD Paid From', v: (t) => t.emdPaidFromAccount, w: 24 },
  { h: 'EMD Beneficiary', v: (t) => t.emdBeneficiaryName, w: 26 },
  { h: 'EMD Bank', v: (t) => t.emdBeneficiaryBank, w: 22 },
  { h: 'EMD Account No', v: (t) => t.emdBeneficiaryAccount, w: 20 },
  { h: 'EMD IFSC', v: (t) => t.emdBeneficiaryIfsc },
  { h: 'EMD Valid Till', v: (t) => t.emdValidTill, t: 'date', w: 14 },
  { h: 'EMD Refunded (₹)', v: (t) => t.emdRefundAmount, t: 'money', w: 15 },
  { h: 'EMD Refund Date', v: (t) => t.emdRefundDate, t: 'date', w: 14 },
  { h: 'EMD Refund Reference', v: (t) => t.emdRefundReference, w: 20 },
  { h: 'EMD Refund Account', v: (t) => t.emdRefundAccount, w: 22 },
  { h: 'EMD Still With Client (₹)', v: (t) => emdSummary(t).blocked || null, t: 'money', w: 18 },
  { h: 'EMD Notes', v: (t) => t.emdNotes, w: 30, wrap: true },
  // submission
  { h: 'Submission Mode', v: (t) => t.submissionMode },
  { h: 'Submission Reference', v: (t) => t.submissionReference, w: 22 },
  { h: 'Submission Date', v: (t) => t.submissionDate, t: 'date', w: 14 },
  { h: 'Submitted By', v: (t) => t.submittedBy, w: 20 },
  // result
  { h: 'Result', v: (t) => t.result },
  { h: 'Our Rank', v: (t) => t.ourRank },
  { h: 'L1 Value (₹)', v: (t) => t.l1Value, t: 'money', w: 16 },
  { h: 'Loss Reason', v: (t) => t.lossReason, w: 22 },
  { h: 'Competitor Notes', v: (t) => t.competitorNotes, w: 30, wrap: true },
  { h: 'Contract Value (₹)', v: (t) => t.contractValue, t: 'money', w: 18 },
  { h: 'LOA Number', v: (t) => t.loaNumber, w: 18 },
  { h: 'LOA Date', v: (t) => t.loaDate, t: 'date', w: 14 },
  { h: 'Agreement Date', v: (t) => t.agreementDate, t: 'date', w: 14 },
  { h: 'Project', v: (t) => t.projectId },
  // record
  { h: 'Tender PDF', v: (t) => t.sourcePdfName, w: 26 },
  { h: 'Created', v: (t) => t.createdAt, t: 'date', w: 14 },
];

const ELIGIBILITY_COLUMNS = [
  ...ofTender,
  { h: '#', v: (r) => r.n, t: 'number', w: 5 },
  { h: 'Tier', v: (r) => r.row.tier, w: 14 },
  { h: 'Category', v: (r) => r.row.category },
  { h: 'Criterion', v: (r) => r.row.criterionName, w: 45, wrap: true },
  { h: 'Required Value', v: (r) => r.row.requiredValue, w: 18 },
  { h: 'Operator', v: (r) => operatorLabel(r.row.operator), w: 14 },
  { h: 'Our Value', v: (r) => r.row.ourValue, w: 16 },
  { h: 'Alternative Group', v: (r) => r.row.altGroup },
  { h: 'Result', v: (r) => (r.row.override ? 'overridden' : evaluateCriterion(r.row)) },
  { h: 'Overridden', v: (r) => yesNo(r.row.override) },
  { h: 'Override Reason', v: (r) => r.row.overrideReason, w: 30, wrap: true },
  { h: 'Overridden By', v: (r) => r.row.overrideBy, w: 20 },
  { h: 'Overridden On', v: (r) => r.row.overrideAt, t: 'date', w: 14 },
  { h: 'Tender Clause', v: (r) => r.row.clauseText, w: 60, wrap: true },
  { h: 'Page', v: (r) => r.row.sourcePage, t: 'number', w: 7 },
];

const DOCUMENT_COLUMNS = [
  ...ofTender,
  { h: '#', v: (r) => r.n, t: 'number', w: 5 },
  { h: 'Document', v: (r) => r.row.documentName, w: 50, wrap: true },
  { h: 'Status', v: (r) => r.row.status },
  { h: 'Link', v: (r) => r.row.link, w: 30 },
  { h: 'Notes', v: (r) => r.row.notes, w: 40, wrap: true },
];

const BOQ_COLUMNS = [
  ...ofTender,
  { h: 'Item No', v: (r) => r.row.itemNo, w: 9 },
  { h: 'Scope / Section', v: (r) => r.row.scope, w: 18 },
  { h: 'Description', v: (r) => r.row.description, w: 50, wrap: true },
  { h: 'Unit', v: (r) => r.row.unit, w: 8 },
  { h: 'Quantity', v: (r) => r.row.quantity, t: 'number', w: 10 },
  { h: 'Tender Rate (₹)', v: (r) => r.row.tenderRate, t: 'money', w: 15 },
  { h: 'Tender Amount (₹)', v: (r) => boqLineTenderAmount(r.row) || null, t: 'money', w: 16 },
  { h: 'Material Rate (₹)', v: (r) => r.row.materialRate, t: 'money', w: 15 },
  { h: 'Labour Rate (₹)', v: (r) => r.row.labourRate, t: 'money', w: 15 },
  { h: 'Our Rate (₹)', v: (r) => boqLineOurRate(r.row, r.tender.overheadPct, r.tender.profitPct), t: 'money', w: 15 },
  { h: 'Our Amount (₹)', v: (r) => boqLineAmount(r.row, r.tender.overheadPct, r.tender.profitPct), t: 'money', w: 16 },
  { h: 'Variance vs Tender %', v: (r) => boqLineVariancePct(r.row, r.tender.overheadPct, r.tender.profitPct), t: 'pct', w: 12 },
];

const DOC_REQUEST_COLUMNS = [
  ...ofTender,
  { h: 'Document Requested', v: (r) => r.row.label, w: 40, wrap: true },
  { h: 'Department', v: (r) => r.row.department },
  { h: 'Due Date', v: (r) => r.row.dueDate, t: 'date', w: 14 },
  { h: 'Status', v: (r) => r.row.status },
  { h: 'Notes', v: (r) => r.row.notes, w: 40, wrap: true },
];

const HISTORY_COLUMNS = [
  ...ofTender,
  { h: 'Stage', v: (r) => r.row.stage, w: 16 },
  { h: 'Action', v: (r) => r.row.action, w: 28 },
  { h: 'By', v: (r) => r.row.by, w: 22 },
  { h: 'When', v: (r) => r.row.at, t: 'date', w: 14 },
  { h: 'Remarks', v: (r) => r.row.remarks, w: 60, wrap: true },
];

/**
 * @param tenders  the rows the list shows, in its order (all pages)
 * @param filters  [[label, value], …] — what produced this list, for the Summary sheet
 */
export function exportTenders(tenders, filters = []) {
  const now = new Date();
  const wb = buildTenderWorkbook(tenders, filters, now);
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  XLSXStyle.writeFile(wb, `Tenders-${stamp}.xlsx`, { cellDates: true });
}

/** The workbook itself, without writing a file. */
export function buildTenderWorkbook(tenders, filters = [], now = new Date()) {
  const wb = XLSXStyle.utils.book_new();

  const summaryRows = [
    ['Tender Register Export'],
    [],
    ['Exported on', now],
    ['Exported by', currentUserLabel()],
    ['Tenders', tenders.length],
    ...filters.map(([k, v]) => [k, v]),
    [],
    ['Sheets'],
    ['Tenders', 'One row per tender with every field, plus the computed bid, cost, margin and eligibility.'],
    ['Eligibility', 'Every criterion of every tender, with its result and the tender clause.'],
    ['Documents', 'The bid document checklist.'],
    ['BOQ', 'Every BOQ line with tender rate, our rate and amounts.'],
    ['Doc Requests', 'Workflow document requests to departments.'],
    ['History', 'Approvals, imports and other history entries.'],
  ];
  const summary = XLSXStyle.utils.aoa_to_sheet(summaryRows, { cellDates: true });
  summary.A1.s = { font: { bold: true, sz: 14, color: { rgb: NAVY } } };
  summaryRows.forEach((r, i) => {
    const a = summary[XLSXStyle.utils.encode_cell({ r: i, c: 0 })];
    if (a && i > 1 && r.length) a.s = { font: { bold: true, color: { rgb: NAVY } } };
    const b = summary[XLSXStyle.utils.encode_cell({ r: i, c: 1 })];
    if (b && b.t === 'd') b.z = 'dd-mmm-yyyy hh:mm';
  });
  summary['!cols'] = [{ wch: 22 }, { wch: 90 }];

  XLSXStyle.utils.book_append_sheet(wb, summary, 'Summary');
  XLSXStyle.utils.book_append_sheet(wb, sheet(TENDER_COLUMNS, tenders), 'Tenders');
  XLSXStyle.utils.book_append_sheet(wb, sheet(ELIGIBILITY_COLUMNS, children(tenders, 'eligibilityCriteria')), 'Eligibility');
  XLSXStyle.utils.book_append_sheet(wb, sheet(DOCUMENT_COLUMNS, children(tenders, 'documents')), 'Documents');
  XLSXStyle.utils.book_append_sheet(wb, sheet(BOQ_COLUMNS, children(tenders, 'boqItems')), 'BOQ');
  XLSXStyle.utils.book_append_sheet(wb, sheet(DOC_REQUEST_COLUMNS, children(tenders, 'docRequests')), 'Doc Requests');
  XLSXStyle.utils.book_append_sheet(wb, sheet(HISTORY_COLUMNS, children(tenders, 'approvalLog')), 'History');
  return wb;
}
