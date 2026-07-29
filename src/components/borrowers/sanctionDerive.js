// src/components/borrowers/sanctionDerive.js
//
// Client-side mirror of the backend SanctionDerivedCalculator, so the review
// screen can update the derived panel live as the user corrects a figure —
// correcting the sanctioned amount should move the equity contribution
// immediately, not after a save round-trip.
//
// The backend remains authoritative: what the detail page shows is what Java
// computed. If a rule changes in SanctionDerivedCalculator.java — in either
// apply() or fillGaps() — change it here too. This file and that one are the
// highest drift risk in the module.

const CRORE = 10000000;
const LAKH = 100000;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

/** "Rs. 205.00 Crore", "205 Cr", "2050000000" → 2050000000 */
export const parseMoney = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/\u00A0/g, ' ').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/(-?\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  const tail = s.slice(m.index + m[1].length);
  if (/crore|^\s*crs?\b/.test(tail)) return n * CRORE;
  if (/lakh|lac|^\s*lk?\b/.test(tail)) return n * LAKH;
  return n;
};

export const formatCrore = (rupees) => {
  if (rupees === null || rupees === undefined || Number.isNaN(rupees)) return null;
  return `₹${(rupees / CRORE).toFixed(2)} Cr`;
};

/** Accepts "14 March 2025", "14 Mar 2025", "14/03/2025", "2025-03-14". */
export const parseDate = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');

  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,12})\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS.findIndex((mo) => mo.startsWith(m[2].toLowerCase()));
    if (idx >= 0) return new Date(Number(m[3]), idx, Number(m[1]));
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (d) => {
  if (!d) return null;
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')} ${mo} ${d.getFullYear()}`;
};

const addMonths = (d, n) => {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + n);
  return out;
};

/** "16 years including moratorium of 6 months" → 192 */
export const parseTenorMonths = (raw) => {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  const y = s.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  if (y) return Math.round(parseFloat(y[1]) * 12);
  const mo = s.match(/(\d+)\s*months?/);
  if (mo && !s.slice(0, mo.index).includes('moratorium')) return parseInt(mo[1], 10);
  return null;
};

export const parseMoratoriumMonths = (raw) => {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  const i = s.indexOf('moratorium');
  if (i < 0) return null;
  const m = s.slice(i).match(/(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2].startsWith('y') ? Math.round(n * 12) : Math.round(n);
};

export const parseRatePct = (raw) => {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
};

/**
 * A percentage that may arrive with or without its sign: "75", "75%", "9.75 %".
 * Not parseRatePct — that one requires the "%" and returns null for a bare
 * number, which is exactly what a value copied off the registry sheet is.
 */
export const parsePct = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? null : n;
};

/** "1.12x", "1.12 times", "1.12" → 1.12 */
export const parseMultiple = parsePct;

/** Trim trailing zeros so 9.750 renders as "9.75%". */
const pct = (n) => (n === null || n === undefined || Number.isNaN(n)
  ? null
  : `${parseFloat(n.toFixed(3))}%`);

/**
 * Money quoted in crore. A bare number scales; an explicit unit wins; and a
 * bare figure of a lakh or more is left alone, because nothing in this book
 * costs a hundred thousand crore and a number that large was plainly already
 * pasted in rupees. Mirrors SanctionValueParser.parseMoneyCrore.
 */
export const parseMoneyCrore = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/ /g, ' ').trim().toLowerCase();
  if (!s) return null;
  if (/crore|lakh|lac|\bcrs?\b|\blk?\b/.test(s)) return parseMoney(raw);
  const m = s.match(/(-?\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return Math.abs(n) >= LAKH ? n : n * CRORE;
};

/**
 * Everything the detail page shows under "derived", computed from the form's
 * current values. Fields that can't be computed come back as null so the panel
 * can render a dash rather than a wrong number.
 */
export const deriveSanction = (form) => {
  const cost = parseMoneyCrore(form.projectCost);
  const loan = parseMoneyCrore(form.sanctionedAmount);
  const signed = parseDate(form.sanctionDate);
  const cod = parseDate(form.scheduledCod);
  const tenor = parseTenorMonths(form.tenorText);
  const mora = parseMoratoriumMonths(form.tenorText);
  const rate = parseRatePct(form.interestRateText);

  const out = {
    equityContribution: null,
    ratioCheck: null,
    ratioOk: null,
    moratoriumEnd: null,
    repaymentStart: null,
    repaymentEnd: null,
    totalTenorMonths: null,
    firstYearInterest: null,
    sanctionValidTill: null,
    codStatus: null,
    codOverdue: false,
    // Registry-sheet gap-fills. Printed wins; these only appear where the
    // letter was silent, and `computed` names the ones that were worked out.
    debtAmount: null,
    equityAmount: null,
    debtPct: null,
    equityPct: null,
    roi: null,
    roiCheck: null,
    roiOk: null,
    computed: new Set(),
  };

  if (cost !== null && loan !== null) {
    out.equityContribution = formatCrore(cost - loan);
    if (cost > 0) {
      const debtPct = (loan / cost) * 100;
      const printed = String(form.debtEquityRatio || '').split(/[:/]/);
      if (printed.length === 2) {
        const stated = parseFloat(printed[0].replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(stated)) {
          out.ratioOk = Math.abs(stated - debtPct) <= 1;
          out.ratioCheck = out.ratioOk
            ? 'Reconciles'
            : `Does not reconcile — amounts imply ${debtPct.toFixed(1)}% debt`;
        }
      } else {
        out.ratioCheck = `Implies ${debtPct.toFixed(1)} : ${(100 - debtPct).toFixed(1)}`;
      }
    }
  }

  if (signed) {
    const moratoriumEnd = mora ? addMonths(signed, mora) : signed;
    out.moratoriumEnd = formatDate(moratoriumEnd);
    out.repaymentStart = formatDate(addMonths(moratoriumEnd, 3));
    if (tenor) out.repaymentEnd = formatDate(addMonths(signed, tenor));
    out.sanctionValidTill = formatDate(addMonths(signed, 6));
  }

  if (tenor) out.totalTenorMonths = `${tenor} months`;

  if (loan !== null && rate !== null) {
    out.firstYearInterest = `${formatCrore((loan * rate) / 100)} approx.`;
  }

  // ── registry-sheet gap-fills, mirroring SanctionDerivedCalculator.fillGaps ──
  let debt = parseMoneyCrore(form.debtAmount);
  if (debt === null && loan !== null) {
    debt = loan;                              // one lender, one facility
    out.debtAmount = formatCrore(debt);
    out.computed.add('debtAmount');
  }

  let equity = parseMoneyCrore(form.equityAmount);
  if (equity === null && cost !== null && debt !== null) {
    equity = cost - debt;
    out.equityAmount = formatCrore(equity);
    out.computed.add('equityAmount');
  }

  let debtPctValue = parsePct(form.debtPct);
  if (debtPctValue === null && cost !== null && debt !== null && cost !== 0) {
    debtPctValue = Math.round((debt / cost) * 1000) / 10;
    out.debtPct = pct(debtPctValue);
    out.computed.add('debtPct');
  }

  if (parsePct(form.equityPct) === null) {
    let equityPctValue = null;
    if (equity !== null && cost !== null && cost !== 0) {
      equityPctValue = Math.round((equity / cost) * 1000) / 10;
    } else if (debtPctValue !== null) {
      equityPctValue = 100 - debtPctValue;
    }
    if (equityPctValue !== null) {
      out.equityPct = pct(equityPctValue);
      out.computed.add('equityPct');
    }
  }

  const base = parsePct(form.baseRatePct);
  const spread = parsePct(form.spreadPct);
  const printedRoi = parsePct(form.roiPct);
  if (base !== null && spread !== null) {
    const built = base + spread;
    if (printedRoi === null) {
      out.roi = pct(built);
      out.computed.add('roiPct');
    } else if (Math.abs(printedRoi - built) > 0.001) {
      out.roiOk = false;
      out.roiCheck = `Does not reconcile — base + spread = ${pct(built)}`;
    } else {
      out.roiOk = true;
      out.roiCheck = 'Reconciles';
    }
  }

  if (cod) {
    const days = Math.round((Date.now() - cod.getTime()) / 86400000);
    if (days > 0) {
      out.codStatus = `Overdue by ${days} day${days === 1 ? '' : 's'}`;
      out.codOverdue = true;
    } else if (days === 0) {
      out.codStatus = 'Due today';
    } else {
      out.codStatus = `In ${-days} days`;
    }
  }

  return out;
};

export default deriveSanction;
