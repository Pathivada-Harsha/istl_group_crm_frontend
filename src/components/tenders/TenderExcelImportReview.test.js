import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TenderExcelImportReview from './TenderExcelImportReview';

jest.mock('../../services/tenderApi', () => ({ __esModule: true, default: { validateExcel: jest.fn() } }));

const field = (over) => ({
  sheet: 'Tender Fee', raw: '', status: 'OK', reason: null, source: '', verification: 'VERIFIED',
  verifyText: null, verifyPage: null, verifyReason: null, ...over,
});
const row = (over) => ({
  excelRow: 2, category: 'Financial', criterionName: 'Turnover', requiredValue: '1000000000', operator: 'gte',
  tier: 'Category A', altGroup: '', sourceText: 'Rs. 100 Cr', status: 'OK', issues: [],
  verification: 'VERIFIED', verifyText: 'Average Turnover … Rs. 100 Cr.', verifyPage: 2, verifyReason: null, ...over,
});

// A CEL-like import: one verified fee, one unverified IFSC, two eligibility rows (one unverified).
const parse = (over = {}) => ({
  kind: 'excel', version: 'TENDER-XLSX-2', message: 'Read 2 fields.', importId: 'imp-1',
  pdfStatus: 'ok', pdfName: 'cel-eoi.pdf', pdfNote: null,
  verifiedCount: 2, unverifiedCount: 2, mismatchCount: 0, warnings: [],
  fields: [
    field({ field: 'feeAmount', label: 'Fee Amount', raw: 'Rs.59,000/-', value: '59000',
      source: 'processing fees of Rs.59,000/-', verifyText: 'processing fees of Rs.59,000/-', verifyPage: 2 }),
    field({ field: 'feeBeneficiaryIfsc', label: 'Fee Beneficiary IFSC', value: 'CNRB0006999',
      verification: 'UNVERIFIED', verifyReason: 'No Source Text was given for this value.' }),
  ],
  eligibilityCriteria: [
    row(),
    row({ criterionName: 'Turnover', requiredValue: '500000000', tier: 'Category B',
      sourceText: 'Average Turnover greater or equal to Rs. 50 Cr', verification: 'UNVERIFIED',
      verifyText: null, verifyPage: null, verifyReason: 'The Source Text was not found in the PDF.' }),
  ],
  documents: [],
  boqItems: [],
  ...over,
});

const tender = { feeAmount: '', feeBeneficiaryIfsc: '', eligibilityCriteria: [], documents: [], boqItems: [] };

const setup = (p = parse()) => {
  const onApply = jest.fn();
  render(<TenderExcelImportReview parse={p} tender={tender} isNew fileName="filled.xlsx" onApply={onApply} onCancel={() => {}} />);
  const apply = screen.getByRole('button', { name: /Apply & Save/ });
  return { onApply, apply };
};

test('an unverified field needs its own tick before it can be saved', () => {
  const { apply } = setup(parse({ eligibilityCriteria: [] , unverifiedCount: 1 }));
  expect(apply).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I checked this value against the PDF myself/));
  expect(apply).toBeEnabled();
});

test('a table of unverified rows can be confirmed with one tick, which is passed on for the history', () => {
  const { apply, onApply } = setup();
  fireEvent.click(screen.getByLabelText(/I checked this value against the PDF myself/));
  expect(apply).toBeDisabled();                                   // the Category B row is still unconfirmed
  fireEvent.click(screen.getByLabelText(/I have checked all 1 unverified row/));
  expect(apply).toBeEnabled();
  fireEvent.click(apply);

  const [selection, summary, bulkAcks] = onApply.mock.calls[0];
  expect(bulkAcks).toEqual([{ table: 'Eligibility', rows: 1 }]);
  expect(summary).toMatch(/2 verified against the PDF, 2 unverified \(confirmed by the reviewer\)/);
  expect(selection.feeAmount).toBe('59000');
  // The verified row keeps the PDF's own clause and page; the unverified one does not.
  expect(selection.eligibilityCriteria[0]).toMatchObject({ tier: 'Category A', clauseText: 'Average Turnover … Rs. 100 Cr.', sourcePage: '2' });
  expect(selection.eligibilityCriteria[1].clauseText || '').toBe('');
  expect(selection.eligibilityCriteria[1].tier).toBe('Category B');
});

test('a mismatch blocks the save even with the bulk tick', () => {
  const p = parse({
    mismatchCount: 1,
    eligibilityCriteria: [
      row({ status: 'ERROR', issues: ['Does not match the PDF — Required Value: the PDF passage does not state 60000000.'],
        requiredValue: '60000000', verification: 'MISMATCH', verifyReason: 'Required Value: …' }),
      row({ verification: 'UNVERIFIED', verifyText: null, verifyReason: 'The Source Text was not found in the PDF.' }),
    ],
  });
  const { apply } = setup(p);
  fireEvent.click(screen.getByLabelText(/I checked this value against the PDF myself/));
  fireEvent.click(screen.getByLabelText(/I have checked all 1 unverified row/));
  expect(apply).toBeDisabled();
  expect(screen.getByText(/Fix or untick before saving: Eligibility/)).toBeInTheDocument();
});

test('the filter shows only what the PDF did not back up', () => {
  setup(parse({ eligibilityCriteria: [] }));
  fireEvent.click(screen.getByLabelText(/Show only Unverified \/ Mismatch/));
  expect(screen.queryByRole('button', { name: 'Fee Amount' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Fee Beneficiary IFSC' })).toBeInTheDocument();
});

test('a scanned PDF says so plainly', () => {
  setup(parse({ pdfStatus: 'scanned', pdfNote: 'The PDF has no text layer (it is a scan), so values could not be checked against it.' }));
  const banner = screen.getByText(/The PDF is a scan — nothing could be checked/).closest('div');
  expect(within(banner).getByText(/Every value is Unverified/)).toBeInTheDocument();
});
