import * as XLSXStyle from 'xlsx-js-style';
import { buildTenderWorkbook } from './tenderExport';
import { hydrateTender, boqBidTotal } from '../../services/tenderData';

// Two tenders as the API returns them, hydrated the way the list hydrates them.
const cel = hydrateTender({
  id: 1, tenderNumber: 'C-2(b)/EOI/704/0388/2025', tenderName: 'EOI for Solar EPC empanelment',
  issuingAuthority: 'Central Electronics Limited', status: 'Preparing', financialYear: '2026-27',
  feeAmount: '59000', feeRefundable: 'No', feeBeneficiaryBank: 'Canara Bank', feeBeneficiaryIfsc: 'CNRB0006999',
  submissionDeadline: '2026-03-31T15:00', overheadPct: 10, profitPct: 12,
  eligibilityCriteria: [
    { category: 'Financial', criterionName: 'Turnover', requiredValue: '1000000000', operator: 'gte',
      ourValue: '1200000000', tier: 'Category A', clauseText: 'Rs. 100 Cr', sourcePage: '2' },
    { category: 'Technical', criterionName: 'ISO 9001:2015', operator: 'boolean', ourValue: 'yes' },
  ],
  documents: [{ documentName: 'GST certificate', status: 'ready' }],
  boqItems: [{ itemNo: '1', description: 'Module', unit: 'Nos', quantity: '100', tenderRate: '20',
    materialRate: '10', labourRate: '5' }],
  approvalLog: [{ stage: 'Import', action: 'Imported from Excel', by: 'superadmin', at: '2026-10-01T10:00', remarks: 'File: x.xlsx' }],
});
const other = hydrateTender({ id: 2, tenderNumber: 'GEM/2026/B/1', tenderName: 'Rooftop', status: 'Draft' });

const read = (wb, name) => XLSXStyle.utils.sheet_to_json(wb.Sheets[name], { defval: null });

test('one workbook: a summary, every tender, and every child row', () => {
  const wb = buildTenderWorkbook([cel, other], [['Status', 'All'], ['Search', 'solar']]);
  expect(wb.SheetNames).toEqual(['Summary', 'Tenders', 'Eligibility', 'Documents', 'BOQ', 'Doc Requests', 'History']);

  const tenders = read(wb, 'Tenders');
  expect(tenders.map((t) => t['Tender Number'])).toEqual(['C-2(b)/EOI/704/0388/2025', 'GEM/2026/B/1']);
  expect(read(wb, 'Eligibility')).toHaveLength(2);
  expect(read(wb, 'Documents')).toHaveLength(1);
  expect(read(wb, 'BOQ')).toHaveLength(1);
  expect(read(wb, 'History')).toHaveLength(1);
  expect(read(wb, 'History')[0]['Tender Number']).toBe('C-2(b)/EOI/704/0388/2025');

  const summary = XLSXStyle.utils.sheet_to_json(wb.Sheets.Summary, { header: 1, defval: null });
  expect(summary).toEqual(expect.arrayContaining([['Status', 'All'], ['Search', 'solar'], ['Tenders', 2]]));
});

test('figures are numbers, dates are dates, computed values match the app', () => {
  const wb = buildTenderWorkbook([cel]);
  const t = read(wb, 'Tenders')[0];
  expect(t['Tender Fee (₹)']).toBe(59000);
  expect(t['Fee Refundable']).toBe('No');
  expect(t['Fee IFSC']).toBe('CNRB0006999');
  expect(t['Our Bid Value (₹)']).toBeCloseTo(boqBidTotal(cel));
  expect(t['Tender BOQ Total (₹)']).toBe(2000);
  expect(t.Eligibility).toBe('GO');
  expect(t['Qualifies for Tier']).toBe('Category A');

  // Header → column, to inspect the raw cell types.
  const ws = wb.Sheets.Tenders;
  const headers = XLSXStyle.utils.sheet_to_json(ws, { header: 1 })[0];
  const cell = (h) => ws[XLSXStyle.utils.encode_cell({ r: 1, c: headers.indexOf(h) })];
  expect(cell('Tender Fee (₹)').t).toBe('n');
  expect(cell('Submission Deadline').t).toBe('d');
  expect(cell('Submission Deadline').v.getDate()).toBe(31);       // no time-zone day shift

  const e = read(wb, 'Eligibility')[0];
  expect(e).toMatchObject({ Tier: 'Category A', Operator: '≥ (at least)', Result: 'pass', 'Tender Clause': 'Rs. 100 Cr', Page: 2 });
  const b = read(wb, 'BOQ')[0];
  expect(b['Tender Amount (₹)']).toBe(2000);
  expect(b['Our Amount (₹)']).toBeCloseTo(100 * 15 * 1.1 * 1.12);
});

test('an empty selection still produces a valid workbook', () => {
  const wb = buildTenderWorkbook([]);
  expect(read(wb, 'Tenders')).toEqual([]);
});
