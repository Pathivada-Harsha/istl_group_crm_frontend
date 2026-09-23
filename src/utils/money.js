//  money.js — document money, in integer paise.
//
//  WHY  Every create/edit screen used to preview its own grand total with raw
//       float arithmetic, while the server computed the stored total with
//       BigDecimal. Once totals are rounded to the whole rupee that divergence
//       stops being cosmetic: a preview that is a paisa out can round the other
//       way and show a grand total a whole rupee away from what gets saved.
//
//  HOW  Everything here works in integer paise. Floats appear at the boundary
//       only — parsing a server string or an <input> value on the way in, and
//       dividing by 100 for display on the way out.
//
//  The rounding rule, matching util/MoneyRounding.java on the backend:
//    * line tax is rounded to the paisa PER LINE, then summed
//    * the grand total rounds to the nearest whole rupee, .50 away from zero
//    * round off = final - exact, and on incoming documents the user may set it
//      anywhere in [-1.00, +1.00]
//    * round off is never part of the subtotal or the tax
//
//  If the backend's rounding rule ever changes, lineTaxPaise and
//  roundPaiseToRupee are the two functions to change here.

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Round half AWAY FROM ZERO, which is what BigDecimal's HALF_UP does.
 *
 * Math.round is deliberately not used on a signed value: Math.round(-0.5) is -0,
 * i.e. half-towards-positive-infinity. That disagrees with the backend on every
 * negative round-off, so a credit note would preview one rupee off.
 */
const roundHalfAwayFromZero = (x) => (x < 0 ? -1 : 1) * Math.round(Math.abs(x));

/**
 * Rupees (number or string) to integer paise.
 *
 * The toFixed(4) is not decoration: 1.005 * 100 is 100.49999999999999 in binary
 * floating point, which would round DOWN to 100 paise where the backend gives
 * 101. Fixing the representation error first makes the two agree.
 */
export const toPaise = (v) => roundHalfAwayFromZero(parseFloat((num(v) * 100).toFixed(4)));

/** Integer paise back to rupees, for display and for sending to the server. */
export const fromPaise = (p) => (Number(p) || 0) / 100;

/** Paise rounded to the nearest whole rupee, .50 away from zero. */
export const roundPaiseToRupee = (p) => roundHalfAwayFromZero((Number(p) || 0) / 100) * 100;

/** A percentage as integer basis-points-of-a-percent, so 18.5% is 185000. */
const pctScaled = (pct) => roundHalfAwayFromZero(parseFloat((num(pct) * 10000).toFixed(4)));

// ── line arithmetic ─────────────────────────────────────────────────────────

/**
 * One line's taxable value in paise: quantity x unit price, less any discount.
 *
 * `discountPercent` is optional — only Order Book and purchase orders have one.
 */
export const lineSubtotalPaise = ({ quantity, unitPrice, discountPercent = 0 } = {}) => {
  // quantity can be fractional (18,4 on the server), so scale both sides and
  // divide the scaling back out rather than multiplying two rounded integers.
  const gross = roundHalfAwayFromZero(parseFloat((num(quantity) * num(unitPrice) * 100).toFixed(4)));
  const discount = roundHalfAwayFromZero(gross * pctScaled(discountPercent) / 1000000);
  return gross - discount;
};

/** Tax on one line, in paise, rounded to the paisa as the server does. */
export const lineTaxPaise = (subtotalPaise, taxPercent) =>
  roundHalfAwayFromZero((Number(subtotalPaise) || 0) * pctScaled(taxPercent) / 1000000);

/** One line's total including its tax, in paise. */
export const lineTotalPaise = (item) => {
  const sub = lineSubtotalPaise(item);
  return sub + lineTaxPaise(sub, item && item.taxPercent);
};

/** One line's total including its tax, in rupees — for a per-row cell. */
export const lineTotal = (item) => fromPaise(lineTotalPaise(item));

// ── document totals ────────────────────────────────────────────────────────

export const MAX_ROUND_OFF_PAISE = 100;

/**
 * Validate a user-entered round-off.
 *
 * Hosts must call this in their save handler as well as on change: an <input
 * type="number"> with min/max does not enforce either for a pasted or
 * programmatically set value, and the server would reject it with a 400.
 *
 * @returns {{valid: boolean, paise: number|null, message: string|null}}
 */
export const validateRoundOff = (raw) => {
  if (raw === '' || raw === null || raw === undefined) {
    return { valid: true, paise: 0, message: null };
  }
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) {
    return { valid: false, paise: null, message: 'Round off must be a number' };
  }
  const paise = toPaise(n);
  if (Math.abs(paise) > MAX_ROUND_OFF_PAISE) {
    return { valid: false, paise, message: 'Round off must be between -₹1.00 and +₹1.00' };
  }
  return { valid: true, paise, message: null };
};

/**
 * Subtotal, tax, round off and grand total for a document, from its line items.
 *
 * The one function every create/edit preview should use. Items are
 * `{quantity, unitPrice, taxPercent, discountPercent?}`; a document whose lines
 * are flat amounts (project expenses) passes `{unitPrice: amount, quantity: 1}`.
 *
 * @param items  the line items
 * @param opts   `{roundOffOverride}` for an incoming document, where the user may
 *               set the round-off. Omit it (or pass null) to round automatically.
 * @returns rupee values for display, the paise values for further arithmetic, the
 *          automatic round-off (for a "reset to auto" control) and whether the
 *          supplied override actually differs from it.
 */
export const computeDocTotals = (items = [], opts = {}) => {
  const list = Array.isArray(items) ? items : [];

  let subtotalPaise = 0;
  let taxPaise = 0;
  for (const item of list) {
    const sub = lineSubtotalPaise(item);
    subtotalPaise += sub;
    taxPaise += lineTaxPaise(sub, item && item.taxPercent);
  }

  const exactTotalPaise = subtotalPaise + taxPaise;
  const autoRoundOffPaise = roundPaiseToRupee(exactTotalPaise) - exactTotalPaise;

  // An override only counts when it is present AND valid. An invalid one leaves
  // the preview on the automatic value while the host shows the error, so the
  // grand total on screen is never a number the server would refuse.
  const check = validateRoundOff(opts.roundOffOverride);
  const overrideGiven = opts.roundOffOverride !== null
    && opts.roundOffOverride !== undefined
    && opts.roundOffOverride !== '';
  const roundOffPaise = (overrideGiven && check.valid) ? check.paise : autoRoundOffPaise;

  const grandTotalPaise = exactTotalPaise + roundOffPaise;

  return {
    subtotal: fromPaise(subtotalPaise),
    tax: fromPaise(taxPaise),
    exactTotal: fromPaise(exactTotalPaise),
    roundOff: fromPaise(roundOffPaise),
    grandTotal: fromPaise(grandTotalPaise),
    autoRoundOff: fromPaise(autoRoundOffPaise),
    isOverridden: overrideGiven && check.valid && roundOffPaise !== autoRoundOffPaise,
    subtotalPaise,
    taxPaise,
    exactTotalPaise,
    roundOffPaise,
    grandTotalPaise,
  };
};

/**
 * Tax grouped by rate, for a per-rate breakdown. Mirrors InvoiceTotals on the
 * server: one entry per rate, in rate order, each the sum of its lines.
 */
export const taxRowsByRate = (items = []) => {
  const byRate = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const rate = num(item && item.taxPercent);
    const sub = lineSubtotalPaise(item);
    const entry = byRate.get(rate) || { ratePercent: rate, taxablePaise: 0, taxPaise: 0 };
    entry.taxablePaise += sub;
    entry.taxPaise += lineTaxPaise(sub, rate);
    byRate.set(rate, entry);
  }
  return [...byRate.values()]
    .sort((a, b) => a.ratePercent - b.ratePercent)
    .map((e) => ({
      ratePercent: e.ratePercent,
      taxable: fromPaise(e.taxablePaise),
      amount: fromPaise(e.taxPaise),
      label: `GST ${e.ratePercent}%`,
    }));
};

// ── reading a saved document ───────────────────────────────────────────────

/**
 * The document's FINAL total, as saved. `key` is the field this document type
 * uses — `totalAmount` for invoices, bills and order book, `totalValue` for
 * purchase orders, proposals and quotations.
 */
export const finalTotalOf = (doc, key = 'totalAmount') => num(doc && doc[key]);

export const roundOffOf = (doc) => num(doc && doc.roundOff);

/**
 * The total before round-off. Falls back to the final total when the document
 * predates the feature, so a legacy record never renders as a round-off of minus
 * its whole total.
 */
export const exactTotalOf = (doc, key = 'totalAmount') =>
  (doc && doc.exactTotal !== null && doc.exactTotal !== undefined)
    ? num(doc.exactTotal)
    : finalTotalOf(doc, key);

/** True when the amount is not a whole rupee — marks a pre-feature document. */
export const hasPaise = (v) => toPaise(v) % 100 !== 0;

// ── formatting ─────────────────────────────────────────────────────────────

/** Matches the per-page formatCurrency helpers, so adopting this shows no diff. */
export const formatMoney = (v) => `₹${num(v).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

/** A round-off is signed: a bare "0.49" reads as a typo on a deduction. */
export const formatSignedMoney = (v) => {
  const paise = toPaise(v);
  if (paise === 0) return '₹0.00';
  return `${paise > 0 ? '+' : '−'}₹${(Math.abs(paise) / 100).toFixed(2)}`;
};

/** A numeric cell for an XLSX sheet — a number, not a formatted string. */
export const excelMoney = (v) => Number(num(v).toFixed(2));
