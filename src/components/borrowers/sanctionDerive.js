// src/components/borrowers/sanctionDerive.js
//
// Client-side mirror of the backend SanctionDerivedCalculator, so the review
// screen can update the derived panel live as the user corrects a figure —
// correcting the sanctioned amount should move the equity contribution
// immediately, not after a save round-trip.
//
// The backend remains authoritative: what the detail page shows is what Java
// computed. If a rule changes in SanctionDerivedCalculator.java, change it here
// too.

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
 * Everything the detail page shows under "derived", computed from the form's
 * current values. Fields that can't be computed come back as null so the panel
 * can render a dash rather than a wrong number.
 */
export const deriveSanction = (form) => {
  const cost = parseMoney(form.projectCost);
  const loan = parseMoney(form.sanctionedAmount);
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
