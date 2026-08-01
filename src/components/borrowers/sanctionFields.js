// src/components/borrowers/sanctionFields.js
//
// Every field on a sanction letter, in the order the lender's registry sheet
// prints them. One array, four consumers — SanctionFormModal, SanctionCompareModal,
// BorrowerDetail and the registry table — so adding a column is one line here
// rather than four edits that drift apart.
//
// Per entry:
//   key         wrapper property name, identical on the Java DTO
//   group       the sheet's header band; drives form sections and table groups
//   label       exactly as the sheet prints it
//   kind        text | money | pct | multiple | date | ratio — how the value is
//               compared and what unit hint the form shows. Inputs stay
//               type="text" regardless; see the note at the bottom.
//   suffix      unit hint rendered beside the input
//   align       'right' for numerics in the registry table
//   width       column width in the registry table, px

export const SANCTION_FIELDS = [
  // ── Number ──
  // The registry sheet heads this column "SL Ref. No"; the letter calls it the
  // reference number. One field, labelled for wherever it is being read.
  { key: 'refNo', group: 'Number', label: 'Reference number', required: true,
    kind: 'text', placeholder: 'VIFL/PF/2025/1007', width: 160, mono: true },

  // ── Borrower Details (letter-level, mirrored onto the borrower on save) ──
  { key: 'borrowerName', group: 'Borrower Details', label: 'Borrower', required: true,
    kind: 'text', placeholder: 'Company name in full', width: 220 },
  { key: 'lenderName', group: 'Borrower Details', label: 'Lender',
    kind: 'text', placeholder: 'Vindhya Infra Finance Ltd.', width: 180 },
  { key: 'projectName', group: 'Borrower Details', label: 'Project',
    kind: 'text', placeholder: '50 MWac ground-mounted solar', width: 200 },
  { key: 'category', group: 'Borrower Details', label: 'Category',
    kind: 'text', placeholder: 'Utility-Scale Solar', width: 150 },
  { key: 'location', group: 'Borrower Details', label: 'Location',
    kind: 'text', placeholder: 'Jodhpur, Rajasthan', width: 160 },

  // ── Project Cost & Means of Finance ──
  // Money is quoted in crore on this sheet, so the inputs say so and a bare
  // number scales. An explicit unit still wins.
  { key: 'projectCost', group: 'Project Cost & Means of Finance', label: 'Project Cost',
    kind: 'money', placeholder: '205.00', suffix: 'in ₹ Cr', align: 'right', width: 120 },
  { key: 'debtAmount', group: 'Project Cost & Means of Finance', label: "Debt (Rs. Cr's)",
    kind: 'money', placeholder: '153.75', suffix: 'in ₹ Cr', align: 'right', width: 120 },
  { key: 'equityAmount', group: 'Project Cost & Means of Finance', label: "Equity (Rs. Cr's)",
    kind: 'money', placeholder: '51.25', suffix: 'in ₹ Cr', align: 'right', width: 130 },
  { key: 'debtPct', group: 'Project Cost & Means of Finance', label: 'Debt (%)',
    kind: 'pct', placeholder: '75', align: 'right', width: 90 },
  { key: 'equityPct', group: 'Project Cost & Means of Finance', label: 'Equity (%)',
    kind: 'pct', placeholder: '25', align: 'right', width: 100 },
  { key: 'sanctionedAmount', group: 'Project Cost & Means of Finance', label: 'Sanctioned amount',
    required: true, kind: 'money', placeholder: '153.75', suffix: 'in ₹ Cr',
    align: 'right', width: 140, listHidden: true },
  { key: 'debtEquityRatio', group: 'Project Cost & Means of Finance', label: 'Debt : equity',
    kind: 'ratio', placeholder: '75:25', width: 110, listHidden: true },

  // ── Rate of Interest ──
  { key: 'baseRatePct', group: 'Rate of Interest', label: 'Base Rate',
    kind: 'pct', placeholder: '7.25', align: 'right', width: 100 },
  { key: 'spreadPct', group: 'Rate of Interest', label: 'Spread',
    kind: 'pct', placeholder: '2.50', align: 'right', width: 90 },
  // Not a separate box to type into — Rate of interest already states it, and
  // fillGaps (backend) / deriveSanction (client) pull the number out of that
  // text on every read. Kept out of the sanction form and the borrower detail
  // page for the same reason — Rate of interest already carries the number in
  // full there — and shown only as its own column in the registry table's Key
  // columns view, where a bare percentage is worth having without opening a
  // record just to read it off the sentence.
  { key: 'roiPct', group: 'Rate of Interest', label: 'ROI',
    kind: 'pct', placeholder: '9.75', align: 'right', width: 90,
    formHidden: true, detailHidden: true },
  { key: 'interestRateText', group: 'Rate of Interest', label: 'Rate of interest',
    kind: 'text', placeholder: '10.35% p.a. (floating)', width: 200, listHidden: true },

  // ── Project Details ──
  // State is the borrower's, not the sanction's — the registry column reads it
  // off the borrower row, so there is no field for it here.
  { key: 'technology', group: 'Project Details', label: 'Technology',
    kind: 'text', placeholder: 'Solar PV', width: 130 },
  { key: 'village', group: 'Project Details', label: 'Village',
    kind: 'text', placeholder: 'Bhadla', width: 130 },
  { key: 'district', group: 'Project Details', label: 'District',
    kind: 'text', placeholder: 'Jodhpur', width: 130 },

  // ── Product ──
  { key: 'instrument', group: 'Product', label: 'Instrument',
    kind: 'text', placeholder: 'Rupee Term Loan', width: 150 },

  // ── Security ──
  { key: 'coObligators', group: 'Security', label: 'Co Obligators',
    kind: 'text', placeholder: 'Names of any co-obligators', width: 190 },
  { key: 'pledgeOfSharesPct', group: 'Security', label: 'Pledge of share of borrower',
    kind: 'pct', placeholder: '75', align: 'right', width: 150 },

  // ── Financial Covenants ──
  // DSRA, ISRA and cash sweep are phrases in real letters, not numbers, so they
  // stay free text and are compared as text.
  { key: 'minDscr', group: 'Financial Covenants', label: 'Min. DSCR',
    kind: 'multiple', placeholder: '1.12x', align: 'right', width: 100 },
  { key: 'dsra', group: 'Financial Covenants', label: 'DSRA',
    kind: 'text', placeholder: "One quarter's debt service", width: 170 },
  { key: 'isra', group: 'Financial Covenants', label: 'ISRA',
    kind: 'text', placeholder: 'As printed in the letter', width: 170 },
  { key: 'cashSweep', group: 'Financial Covenants', label: 'Cash Sweep',
    kind: 'text', placeholder: '100% above 1.30x DSCR', width: 300 },

  // ── Time Lines ──
  { key: 'sanctionDate', group: 'Time Lines', label: 'Sanction Date',
    kind: 'date', placeholder: '14 March 2025', width: 130 },
  { key: 'disbursementDate', group: 'Time Lines', label: 'Disb. Date',
    kind: 'date', placeholder: '30 April 2025', width: 130 },
  { key: 'tenorText', group: 'Time Lines', label: 'Tenor',
    kind: 'text', placeholder: '16 years including moratorium of 6 months', width: 300 },
  { key: 'repaymentStartDate', group: 'Time Lines', label: 'Repayment Start Date',
    kind: 'date', placeholder: '30 September 2026', width: 170 },
  { key: 'repaymentEndDate', group: 'Time Lines', label: 'Repayment End date',
    kind: 'date', placeholder: '30 September 2041', width: 170 },
  { key: 'scheduledCod', group: 'Time Lines', label: 'Scheduled COD',
    kind: 'date', placeholder: '14 February 2026', width: 150, listHidden: true },

  // ── Base Case Assumptions ──
  { key: 'plfPct', group: 'Base Case Assumptions', label: 'PLF',
    kind: 'pct', placeholder: '24.5', align: 'right', width: 90 },
  { key: 'tariffPerUnit', group: 'Base Case Assumptions', label: 'Tariff',
    kind: 'text', placeholder: '2.53', suffix: '₹ / kWh', align: 'right', width: 110 },
];

/** The latest letter on a registry row, or an empty object so accessors are safe. */
export const latestSanction = (row) => (row && row.sanctions && row.sanctions[0]) || {};

/** Field definitions bucketed by their sheet band, in declaration order. */
export const sanctionFieldGroups = () => {
  const out = [];
  const index = new Map();
  SANCTION_FIELDS.forEach((f) => {
    if (!index.has(f.group)) {
      index.set(f.group, out.length);
      out.push({ group: f.group, fields: [] });
    }
    out[index.get(f.group)].fields.push(f);
  });
  return out;
};

export const SANCTION_KEYS = SANCTION_FIELDS.map((f) => f.key);

// Inputs stay type="text" on purpose, including the date ones. The backend
// returns dates formatted "14 Mar 2025" via formatDate, which a native
// <input type="date"> cannot consume — opening a saved record for edit would
// silently blank every date. `kind` is used for placeholders, unit hints and
// comparison only.

export default SANCTION_FIELDS;
