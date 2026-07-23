// ─────────────────────────────────────────────────────────────────────────────
//  tenderData.js — the Tenders module's local data layer (frontend-only).
//
//  This is a MOCK/state module in the spirit of services/energyMockData.js: it
//  exports the canonical tender shape (blankTender), a seed list (MOCK_TENDERS),
//  the option/constant vocabularies, and pure helpers. There is NO fetch, NO
//  auth boilerplate and NO browser-storage persistence — the Tenders page holds
//  everything in React state.
//
//  DATA-SHAPE DISCIPLINE (the backend will be built to match these names):
//   • exactly one field per real-world fact,
//   • derived numbers (our_rate, amount, bid total, cost total, margin %) are
//     COMPUTED here, never stored, so they can never drift,
//   • submissionDeadline / portalLink are single fields shared by Basic Info and
//     the Submission tab,
//   • submissionReference is the single portal-acknowledgement field shared by
//     the Submission tab and the Workflow "Ready for Submission" stage,
//   • no l2_value, no separate workflow_status.
// ─────────────────────────────────────────────────────────────────────────────

/* ── option vocabularies ─────────────────────────────────────────────────── */
export const TENDER_STATUSES = [
  'Draft', 'Preparing', 'Submitted', 'Under Evaluation', 'Won', 'Lost', 'Cancelled',
];
export const CLOSED_STATUSES = ['Won', 'Lost', 'Cancelled'];

// Common tender issuing authorities (central agencies, state RE agencies /
// nodal agencies, DISCOMs, departments). Used as datalist suggestions on the
// Basic Info tab — the field still accepts any custom value.
export const ISSUING_AUTHORITIES = [
  // Central agencies & PSUs
  'MNRE — Ministry of New and Renewable Energy',
  'SECI — Solar Energy Corporation of India',
  'NTPC Ltd',
  'NTPC Renewable Energy Ltd (NGEL)',
  'NHPC Ltd',
  'SJVN Ltd',
  'IREDA — Indian Renewable Energy Development Agency',
  'PGCIL — Power Grid Corporation of India',
  'EESL — Energy Efficiency Services Ltd',
  'CPWD — Central Public Works Department',
  'Indian Railways / RITES',
  // State RE / nodal agencies
  'KREDL — Karnataka Renewable Energy Development Ltd',
  'GEDA — Gujarat Energy Development Agency',
  'MEDA — Maharashtra Energy Development Agency',
  'TEDA — Tamil Nadu Energy Development Agency',
  'TSREDCO — Telangana State Renewable Energy Development Corporation',
  'NREDCAP — New & Renewable Energy Development Corp. of Andhra Pradesh',
  'RRECL — Rajasthan Renewable Energy Corporation Ltd',
  'UPNEDA — UP New & Renewable Energy Development Agency',
  'HAREDA — Haryana Renewable Energy Development Agency',
  'PEDA — Punjab Energy Development Agency',
  'MP Urja Vikas Nigam Ltd',
  'CREDA — Chhattisgarh State Renewable Energy Development Agency',
  'ANERT — Agency for New & Renewable Energy, Kerala',
  'HIMURJA — Himachal Pradesh Energy Development Agency',
  // DISCOMs
  'BESCOM — Bangalore Electricity Supply Company',
  'MSEDCL — Maharashtra State Electricity Distribution Co.',
  'TANGEDCO — Tamil Nadu Generation & Distribution Corporation',
  'APSPDCL — Andhra Pradesh Southern Power Distribution Co.',
  'TSSPDCL — Telangana State Southern Power Distribution Co.',
  'UPPCL — Uttar Pradesh Power Corporation Ltd',
  'PSPCL — Punjab State Power Corporation Ltd',
  // Departments / local bodies
  'Public Works Department (PWD)',
  'Municipal Corporation',
  'Jal Nigam / Water Supply Board',
  'Minor Irrigation Department',
  'Health & Family Welfare Department',
  'Education Department',
  'State Housing Board',
  'State Industrial Development Corporation',
];

export const SECTORS = [
  'Solar EPC', 'Rooftop Solar', 'Ground Mount', 'Solar Pump', 'O&M',
  'Street Lighting', 'BESS / Storage', 'Electrical', 'Civil', 'Other',
];
export const TENDER_TYPES = ['Open', 'Limited', 'EOI', 'RFP', 'RFQ', 'Reverse Auction', 'Nomination'];
export const SOURCES = ['GeM', 'CPPP', 'State Portal', 'Newspaper', 'Direct / Client', 'Referral', 'Other'];
export const CLIENT_TYPES = ['Government', 'PSU', 'Private', 'Cooperative', 'Individual', 'Developer'];
export const SUBMISSION_MODES = ['Online Portal', 'Physical', 'Email', 'Both'];
export const LOSS_REASONS = [
  'Price (L1 lost)', 'Technical disqualification', 'Eligibility not met',
  'EMD / documentation', 'Withdrew', 'Cancelled by authority', 'Other',
];
export const OUR_RANKS = ['L1', 'L2', 'L3', 'L4', 'L5+', 'Disqualified'];
export const DEPARTMENTS = ['Accounts', 'Finance', 'Technical', 'Design', 'Procurement', 'Legal', 'HR', 'Management'];
export const DOCUMENT_STATUSES = ['pending', 'ready', 'na'];

// Eligibility comparison operators (value shown to the user + how it evaluates)
export const OPERATORS = [
  { value: 'gte', label: '≥ (at least)' },
  { value: 'lte', label: '≤ (at most)' },
  { value: 'eq', label: '= (equals)' },
  { value: 'contains', label: 'contains' },
  { value: 'boolean', label: 'yes / no' },
];

// Suggest an eligibility operator from the shape of a typed value, so criteria
// don't stay stuck on the default '≥'. yes/no → boolean, a number → ≥ (gte),
// free text → contains. Returns null when nothing can be inferred yet.
export const suggestOperator = (value) => {
  const v = String(value == null ? '' : value).trim();
  if (v === '') return null;
  const low = v.toLowerCase();
  if (['yes', 'no', 'true', 'false', 'y', 'n'].includes(low)) return 'boolean';
  const numeric = low
    .replace(/[₹,%\s]/g, '')
    .replace(/^rs\.?/, '')
    .replace(/(lakhs?|crores?|cr|nos?|units?)$/, '');
  if (/^\d+(\.\d+)?$/.test(numeric)) return 'gte';
  return 'contains';
};

// Financial years for the list filter (newest first)
export const CURRENT_FY = '2026-27';
export const FINANCIAL_YEARS = ['2026-27', '2025-26', '2024-25', '2023-24'];

// Default document checklist seeded into a tender that has none (KYC + technical)
export const DEFAULT_DOCUMENTS = [
  'Tender Fee / Document Fee Receipt',
  'EMD / Bid Security',
  'Company Registration / Incorporation Certificate',
  'GST Registration Certificate',
  'PAN Card',
  'Audited Balance Sheet (last 3 FY)',
  'Annual Turnover Certificate (CA certified)',
  'Solvency Certificate',
  'ISO / Quality Certifications',
  'Similar Work Experience / Completion Certificates',
  'Power of Attorney / Authorization Letter',
  'Technical Compliance Sheet',
  'Manufacturer Authorization Form (MAF)',
  'Undertaking / Affidavit (Non-blacklisting)',
];

// Workflow subsystem — a self-contained, ordered config. Each block is gated on
// every earlier block being complete; drop an entry to shorten the chain and the
// gating recomputes with no other change needed.
export const WORKFLOW_STAGES = [
  { key: 'documents', title: 'Document Collection', icon: '📄',
    desc: 'Request documents from departments and track requested → received → verified.' },
  { key: 'cfo', title: 'CFO Pricing Approval', icon: '💰',
    desc: 'CFO reviews the computed bid value, cost and margin, then approves or rejects the pricing.' },
  { key: 'md', title: 'MD Submission Approval', icon: '✍️',
    desc: 'MD signs off on the final submission. Gated on CFO approval.' },
  { key: 'ready', title: 'Ready for Submission', icon: '🚀',
    desc: 'Record the portal submission reference once CFO & MD have approved.' },
];

/* ── tiny utilities ──────────────────────────────────────────────────────── */
export const genKey = () => 'k' + Math.random().toString(36).slice(2, 10);

let _idSeq = 1000;
export const nextId = () => ++_idSeq;

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ₹ with 2 decimals, en-IN grouping (matches the BOM tab's formatter)
export const fmtINR = (n) =>
  '₹' + Number(Math.round((num(n)) * 100) / 100)
    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Compact ₹ for stat tiles (₹1.2 Cr / ₹3.4 L)
export const fmtINRShort = (n) => {
  const v = num(n);
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
  return fmtINR(v);
};

export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Read the logged-in user's display name/email (existing auth state, read-only —
// we never write storage). Used to stamp overrides / approvals / submissions.
export const currentUserLabel = () => {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    if (!raw) return 'You';
    const u = JSON.parse(raw)?.user || {};
    return u.email || u.name || u.userName || 'You';
  } catch { return 'You'; }
};

export const isClosed = (status) => CLOSED_STATUSES.includes(status);

// A tender is OVERDUE when its deadline has passed but it is neither submitted
// nor closed (won/lost/cancelled).
export const isOverdue = (tender) => {
  if (!tender?.submissionDeadline) return false;
  if (isClosed(tender.status) || tender.status === 'Submitted') return false;
  const d = new Date(tender.submissionDeadline);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

// Map a tender status onto the shared Leads badge modifier classes.
export const statusBadgeClass = (status) => ({
  'Draft': 'leads-enquiries-badge-default',
  'Preparing': 'leads-enquiries-badge-new',
  'Submitted': 'leads-enquiries-badge-proposal',
  'Under Evaluation': 'leads-enquiries-badge-kiv',
  'Won': 'leads-enquiries-badge-won',
  'Lost': 'leads-enquiries-badge-lost',
  'Cancelled': 'leads-enquiries-badge-default',
}[status] || 'leads-enquiries-badge-default');

/* ── BOQ math (all derived — never stored) ───────────────────────────────── */
// our_rate = (material + labour) × (1 + oh%) × (1 + pr%)
export const boqLineOurRate = (line, overheadPct, profitPct) =>
  (num(line.materialRate) + num(line.labourRate)) *
  (1 + num(overheadPct) / 100) *
  (1 + num(profitPct) / 100);

// amount = qty × our_rate
export const boqLineAmount = (line, overheadPct, profitPct) =>
  num(line.quantity) * boqLineOurRate(line, overheadPct, profitPct);

// raw cost (before markup) = qty × (material + labour)
export const boqLineCost = (line) =>
  num(line.quantity) * (num(line.materialRate) + num(line.labourRate));

// tenderRate is the rate quoted in the tender document (NIT / estimated rate).
export const boqLineTenderAmount = (line) => num(line.quantity) * num(line.tenderRate);
export const boqTenderTotal = (tender) =>
  (tender.boqItems || []).reduce((s, l) => s + boqLineTenderAmount(l), 0);

// variance of our rate vs the tender's quoted rate, as a % (null when no quote).
// negative = we are BELOW the tender estimate (competitive); positive = above.
export const boqLineVariancePct = (line, overheadPct, profitPct) => {
  const t = num(line.tenderRate);
  if (t <= 0) return null;
  return ((boqLineOurRate(line, overheadPct, profitPct) - t) / t) * 100;
};

export const boqBidTotal = (tender) =>
  (tender.boqItems || []).reduce((s, l) => s + boqLineAmount(l, tender.overheadPct, tender.profitPct), 0);

export const boqCostTotal = (tender) =>
  (tender.boqItems || []).reduce((s, l) => s + boqLineCost(l), 0);

// Effective margin the CFO block shows: (bid − cost) / bid.
export const boqEffectiveProfitPct = (tender) => {
  const bid = boqBidTotal(tender);
  const cost = boqCostTotal(tender);
  return bid > 0 ? ((bid - cost) / bid) * 100 : 0;
};

/* ── Eligibility evaluation ──────────────────────────────────────────────── */
// One criterion → 'pass' | 'fail' | 'pending' (before any override).
export const evaluateCriterion = (c) => {
  const our = c.ourValue;
  const req = c.requiredValue;
  const missingOur = our === '' || our === null || our === undefined;
  if (c.operator === 'boolean') {
    if (missingOur) return 'pending';
    const truthy = our === true || ['yes', 'true', '1'].includes(String(our).trim().toLowerCase());
    return truthy ? 'pass' : 'fail';
  }
  const missingReq = req === '' || req === null || req === undefined;
  if (missingOur || missingReq) return 'pending';
  switch (c.operator) {
    case 'gte': return num(our) >= num(req) ? 'pass' : 'fail';
    case 'lte': return num(our) <= num(req) ? 'pass' : 'fail';
    case 'eq': return String(our).trim().toLowerCase() === String(req).trim().toLowerCase() ? 'pass' : 'fail';
    case 'contains': return String(our).toLowerCase().includes(String(req).trim().toLowerCase()) ? 'pass' : 'fail';
    default: return 'pending';
  }
};

// A criterion counts as satisfied for the roll-up if it passes OR is overridden.
export const criterionSatisfied = (c) => !!c.override || evaluateCriterion(c) === 'pass';

// Overall Go/No-Go: NO-GO if any un-overridden failure, else PENDING if any
// un-overridden pending, else GO. Empty list → PENDING.
export const computeEligibility = (criteria = []) => {
  if (!criteria.length) return 'PENDING';
  const live = criteria.filter((c) => !c.override).map(evaluateCriterion);
  if (live.includes('fail')) return 'NO_GO';
  if (live.includes('pending')) return 'PENDING';
  return 'GO';
};

// Auto-transition the tender status from the live eligibility decision. Only
// nudges the early lifecycle (Draft / Preparing / Cancelled); never overrides
// real progress (Submitted, Under Evaluation, Won, Lost). Reversible: an
// override that flips NO_GO → GO reopens a Cancelled tender to Preparing.
export const nextStatusForEligibility = (status, decision) => {
  const LATE = ['Submitted', 'Under Evaluation', 'Won', 'Lost'];
  if (LATE.includes(status)) return status;
  if (decision === 'GO'    && (status === 'Draft' || status === 'Cancelled')) return 'Preparing';
  if (decision === 'NO_GO' && (status === 'Draft' || status === 'Preparing')) return 'Cancelled';
  return status;
};

/* ── Workflow stage state (pure functions of tender data) ────────────────── */
export const stageComplete = (tender, key) => {
  switch (key) {
    case 'documents':
      return (tender.docRequests || []).length > 0 &&
        (tender.docRequests || []).every((d) => d.status === 'verified');
    case 'cfo': return tender.cfoApprovalStatus === 'approved';
    case 'md': return tender.mdApprovalStatus === 'approved';
    case 'ready': return !!tender.submissionReference && !!tender.submissionDate;
    default: return false;
  }
};

// A stage is unlocked once every earlier stage in WORKFLOW_STAGES is complete.
export const stageUnlocked = (tender, key) => {
  for (const s of WORKFLOW_STAGES) {
    if (s.key === key) return true;
    if (!stageComplete(tender, s.key)) return false;
  }
  return true;
};

/* ── row/record factories ────────────────────────────────────────────────── */
export const blankCriterion = (category = 'Technical') => ({
  _key: genKey(), category, criterionName: '', requiredValue: '', ourValue: '',
  operator: 'gte', override: false, overrideReason: '', overrideBy: '', overrideAt: '',
});

export const blankDocument = (documentName = '') => ({
  _key: genKey(), documentName, status: 'pending', link: '', notes: '',
});

export const seedDocuments = () => DEFAULT_DOCUMENTS.map((n) => blankDocument(n));

export const blankBoqItem = (scope = '') => ({
  _key: genKey(), itemNo: '', scope, description: '', unit: 'Nos',
  quantity: '', tenderRate: '', materialRate: '', labourRate: '',
});

export const blankDocRequest = () => ({
  _key: genKey(), label: '', department: DEPARTMENTS[0], dueDate: '',
  status: 'requested', notes: '',
});

export const blankTender = () => ({
  id: null,
  // identification
  tenderNumber: '', tenderName: '', issuingAuthority: '',
  // client KYC
  clientCompany: '', clientType: '', clientGstin: '', clientPan: '', clientCin: '',
  clientContactPerson: '', clientContactEmail: '', clientContactPhone: '',
  clientAddress: '', clientCity: '', clientState: '',
  // classification
  sector: '', tenderType: '', source: '', portalLink: '',
  location: '', district: '', state: '', financialYear: CURRENT_FY,
  // financials
  estimatedValue: '', emdAmount: '', performanceSecurityPct: '',
  // dates
  submissionDeadline: '', technicalOpeningDate: '', financialOpeningDate: '',
  // eligibility
  eligibilityCriteria: [], eligibilityDecision: 'PENDING',
  // documents (single owner)
  documents: [],
  // rate analysis & bid
  overheadPct: 10, profitPct: 12, boqItems: [],
  // workflow
  goNoGo: '', goNoGoReason: '', goNoGoDate: '',
  docRequests: [],
  cfoApprovalStatus: 'pending', cfoApprovalRemarks: '', cfoApprovalDate: '',
  mdApprovalStatus: 'pending', mdApprovalRemarks: '', mdApprovalDate: '',
  approvalLog: [],
  // submission (single reference)
  submissionMode: '', submissionReference: '', submissionDate: '', submittedBy: '',
  // result
  l1Value: '', ourRank: '', status: 'Draft', lossReason: '', result: '', competitorNotes: '',
  contractValue: '', loaNumber: '', loaDate: '', agreementDate: '',
  projectId: '',
  // source PDF (uploaded NIT; bytes live server-side — these are metadata only)
  sourcePdfName: '', sourcePdfMimeType: '', hasSourcePdf: false,
  createdAt: new Date().toISOString().slice(0, 10),
});

// A fresh tender for the "Add" flow: blank + a seeded document checklist.
export const newTender = () => ({
  ...blankTender(), id: nextId(), status: 'Draft', documents: seedDocuments(),
});

// Normalise a tender coming from the API into the shape the UI expects:
// merge in defaults, coerce null/undefined scalars to '', give every child row a
// client-side _key (for React keys), and turn the server's `override` into a
// real boolean. Numeric fields stay as strings — the UI's num() coerces them.
export const hydrateTender = (t) => {
  if (!t) return newTender();
  const base = blankTender();
  const m = { ...base, ...t };
  Object.keys(m).forEach((k) => {
    if (Array.isArray(base[k])) return;
    if (m[k] === null || m[k] === undefined) m[k] = '';
  });
  const row = (x, blank) => {
    const r = { ...blank, ...x, _key: genKey() };
    Object.keys(r).forEach((k) => { if (r[k] === null || r[k] === undefined) r[k] = ''; });
    return r;
  };
  m.boqItems = (t.boqItems || []).map((x) => row(x, blankBoqItem('')));
  m.eligibilityCriteria = (t.eligibilityCriteria || []).map((x) => {
    const r = row(x, blankCriterion('Technical'));
    r.override = x.override === true || x.override === 1 || x.override === '1' || x.override === 'true';
    return r;
  });
  m.documents = (t.documents || []).map((x) => row(x, blankDocument('')));
  m.docRequests = (t.docRequests || []).map((x) => row(x, blankDocRequest()));
  m.approvalLog = (t.approvalLog || []).map((x) => ({
    _key: genKey(),
    stage: x.stage || '', action: x.action || '', by: x.by || '', remarks: x.remarks || '', at: x.at || '',
  }));
  return m;
};

/* ── seed data ───────────────────────────────────────────────────────────── */
const mk = (over) => ({ ...blankTender(), id: nextId(), ...over });

export const MOCK_TENDERS = [
  mk({
    tenderNumber: 'GEM/2026/B/5541203', tenderName: '2 MW Rooftop Solar — District Hospital Complex',
    issuingAuthority: 'Karnataka Health & Family Welfare Dept',
    clientCompany: 'Govt. of Karnataka', clientType: 'Government',
    clientGstin: '29AAACG1234F1Z5', clientPan: 'AAACG1234F',
    clientContactPerson: 'Ramesh K', clientContactEmail: 'ee.solar@karhealth.gov.in', clientContactPhone: '080-22334455',
    clientCity: 'Bengaluru', clientState: 'Karnataka',
    sector: 'Rooftop Solar', tenderType: 'Open', source: 'GeM',
    portalLink: 'https://gem.gov.in/bid/5541203',
    location: 'Victoria Hospital', district: 'Bengaluru Urban', state: 'Karnataka', financialYear: '2026-27',
    estimatedValue: 92000000, emdAmount: 920000, performanceSecurityPct: 5,
    submissionDeadline: '2026-08-14', technicalOpeningDate: '2026-08-18', financialOpeningDate: '2026-08-25',
    overheadPct: 10, profitPct: 12,
    boqItems: [
      { _key: genKey(), itemNo: '1.1', scope: 'Supply', description: 'Mono PERC Bifacial Module 550Wp', unit: 'Nos', quantity: 3640, tenderRate: 12500, materialRate: 9800, labourRate: 0 },
      { _key: genKey(), itemNo: '1.2', scope: 'Supply', description: 'String Inverter 100kW', unit: 'Nos', quantity: 20, tenderRate: 435000, materialRate: 340000, labourRate: 0 },
      { _key: genKey(), itemNo: '2.1', scope: 'Installation', description: 'Module Mounting Structure (GI) & install', unit: 'kW', quantity: 2000, tenderRate: 5100, materialRate: 2600, labourRate: 1400 },
      { _key: genKey(), itemNo: '2.2', scope: 'Installation', description: 'DC/AC cabling, LT panel, earthing & commissioning', unit: 'kW', quantity: 2000, tenderRate: 3850, materialRate: 1800, labourRate: 1200 },
    ],
    eligibilityCriteria: [
      { _key: genKey(), category: 'Financial', criterionName: 'Average annual turnover (last 3 FY)', requiredValue: 30000000, ourValue: 46000000, operator: 'gte', override: false, overrideReason: '', overrideBy: '', overrideAt: '' },
      { _key: genKey(), category: 'Financial', criterionName: 'Net worth positive', requiredValue: 'yes', ourValue: 'yes', operator: 'boolean', override: false, overrideReason: '', overrideBy: '', overrideAt: '' },
      { _key: genKey(), category: 'Technical', criterionName: 'Cumulative solar installed (MW)', requiredValue: 5, ourValue: 12, operator: 'gte', override: false, overrideReason: '', overrideBy: '', overrideAt: '' },
      { _key: genKey(), category: 'Technical', criterionName: 'Single order value executed', requiredValue: 40000000, ourValue: 38000000, operator: 'gte', override: false, overrideReason: '', overrideBy: '', overrideAt: '' },
    ],
    eligibilityDecision: 'NO_GO',
    documents: seedDocuments(),
    status: 'Preparing', createdAt: '2026-07-05',
  }),
  mk({
    tenderNumber: 'CPPP/2026/MNRE/0088', tenderName: '5 MW Ground Mount Solar Park — Phase II',
    issuingAuthority: 'NTPC Renewable Energy Ltd', clientCompany: 'NTPC REL', clientType: 'PSU',
    sector: 'Ground Mount', tenderType: 'RFP', source: 'CPPP',
    location: 'Pavagada', district: 'Tumakuru', state: 'Karnataka', financialYear: '2026-27',
    estimatedValue: 245000000, emdAmount: 2450000, performanceSecurityPct: 3,
    submissionDeadline: '2026-07-10', technicalOpeningDate: '2026-07-15',
    overheadPct: 9, profitPct: 11,
    boqItems: [
      { _key: genKey(), itemNo: '1', scope: 'Supply', description: 'PV Modules 550Wp', unit: 'Nos', quantity: 9100, tenderRate: 12000, materialRate: 9700, labourRate: 0 },
      { _key: genKey(), itemNo: '2', scope: 'Civil', description: 'Pile foundation & structure', unit: 'kW', quantity: 5000, tenderRate: 6300, materialRate: 3200, labourRate: 1800 },
    ],
    documents: seedDocuments(),
    submissionMode: 'Online Portal', submissionReference: 'CPPP-ACK-778812', submissionDate: '2026-07-09', submittedBy: 'tender.desk@sesolaenergy.com',
    cfoApprovalStatus: 'approved', cfoApprovalRemarks: 'Margin acceptable at 11%.', cfoApprovalDate: '2026-07-08',
    mdApprovalStatus: 'approved', mdApprovalRemarks: 'Proceed.', mdApprovalDate: '2026-07-08',
    goNoGo: 'GO', goNoGoReason: 'Strong fit, healthy margin.', goNoGoDate: '2026-07-06',
    l1Value: '', ourRank: '', status: 'Submitted', createdAt: '2026-06-20',
  }),
  mk({
    tenderNumber: 'KREDL/2025/RT/2231', tenderName: '750 kW Rooftop — Engineering College Campus',
    issuingAuthority: 'KREDL', clientCompany: 'Visvesvaraya Technological University', clientType: 'Government',
    sector: 'Rooftop Solar', tenderType: 'Open', source: 'State Portal',
    location: 'Belagavi', district: 'Belagavi', state: 'Karnataka', financialYear: '2025-26',
    estimatedValue: 34000000, emdAmount: 340000, performanceSecurityPct: 5,
    submissionDeadline: '2026-03-12',
    overheadPct: 10, profitPct: 12,
    boqItems: [
      { _key: genKey(), itemNo: '1', scope: 'Supply', description: 'PV Modules + inverters (turnkey)', unit: 'kW', quantity: 750, tenderRate: 48000, materialRate: 32000, labourRate: 6000 },
    ],
    documents: seedDocuments(),
    status: 'Won', result: 'Awarded', ourRank: 'L1', l1Value: 31500000,
    contractValue: 31500000, loaNumber: 'VTU/LOA/2026/014', loaDate: '2026-04-02', agreementDate: '2026-04-20',
    projectId: 'PRJ-2026-0042',
    cfoApprovalStatus: 'approved', mdApprovalStatus: 'approved',
    goNoGo: 'GO', createdAt: '2026-01-15',
  }),
  mk({
    tenderNumber: 'GEM/2026/B/4410765', tenderName: '1.2 MW Solar Pump Cluster — Lift Irrigation',
    issuingAuthority: 'Minor Irrigation Dept', clientCompany: 'Govt. of Maharashtra', clientType: 'Government',
    sector: 'Solar Pump', tenderType: 'Reverse Auction', source: 'GeM',
    location: 'Latur', district: 'Latur', state: 'Maharashtra', financialYear: '2025-26',
    estimatedValue: 58000000, emdAmount: 580000, performanceSecurityPct: 3,
    submissionDeadline: '2026-02-28',
    boqItems: [
      { _key: genKey(), itemNo: '1', scope: 'Supply', description: 'Solar pump sets (7.5HP)', unit: 'Nos', quantity: 160, tenderRate: 395000, materialRate: 285000, labourRate: 22000 },
    ],
    documents: seedDocuments(),
    status: 'Lost', ourRank: 'L2', l1Value: 51200000, lossReason: 'Price (L1 lost)',
    competitorNotes: 'Lost to incumbent by ~4% on price in RA.',
    createdAt: '2025-12-10',
  }),
];
