// ─────────────────────────────────────────────────────────────────────────────
// energyMockData.js — Centralized mock data for all Energy SaaS modules
// ─────────────────────────────────────────────────────────────────────────────

// ── ASSETS ──────────────────────────────────────────────────────────────────
export const MOCK_ASSETS = [
  { id: 'AST-001', name: 'Rajasthan Solar Farm – Unit A', type: 'Solar PV', capacity: 50, capacityUnit: 'MW', location: 'Jodhpur, Rajasthan', operator: 'SunPower O&M Ltd', status: 'Operational', cod: '2022-03-15', loanId: 'LN-001', health: 98, lastInspection: '2024-11-20', coordinates: { lat: 26.29, lng: 73.01 } },
  { id: 'AST-002', name: 'Gujarat Wind Cluster – Phase 1', type: 'Wind', capacity: 120, capacityUnit: 'MW', location: 'Kutch, Gujarat', operator: 'WindTech Services', status: 'Operational', cod: '2021-07-01', loanId: 'LN-002', health: 92, lastInspection: '2024-10-15', coordinates: { lat: 23.73, lng: 69.86 } },
  { id: 'AST-003', name: 'Karnataka Hydro – Dam 3', type: 'Hydro', capacity: 30, capacityUnit: 'MW', location: 'Shivamogga, Karnataka', operator: 'HydroOps India', status: 'Under Maintenance', cod: '2019-09-10', loanId: 'LN-003', health: 67, lastInspection: '2024-09-05', coordinates: { lat: 13.93, lng: 75.56 } },
  { id: 'AST-004', name: 'Tamil Nadu Solar Park – Zone B', type: 'Solar PV', capacity: 80, capacityUnit: 'MW', location: 'Tirunelveli, Tamil Nadu', operator: 'SunPower O&M Ltd', status: 'Operational', cod: '2023-01-20', loanId: 'LN-004', health: 99, lastInspection: '2024-12-01', coordinates: { lat: 8.72, lng: 77.69 } },
  { id: 'AST-005', name: 'MP Solar – Grid 7', type: 'Solar PV', capacity: 25, capacityUnit: 'MW', location: 'Rewa, Madhya Pradesh', operator: 'GreenGrid O&M', status: 'Offline', cod: '2020-11-30', loanId: 'LN-005', health: 34, lastInspection: '2024-08-12', coordinates: { lat: 24.53, lng: 81.29 } },
  { id: 'AST-006', name: 'Maharashtra Wind – Satara Hills', type: 'Wind', capacity: 45, capacityUnit: 'MW', location: 'Satara, Maharashtra', operator: 'WindTech Services', status: 'Operational', cod: '2022-06-15', loanId: 'LN-006', health: 88, lastInspection: '2024-11-10', coordinates: { lat: 17.68, lng: 74.0 } },
];

// ── WORK ORDERS ───────────────────────────────────────────────────────────────
export const MOCK_WORK_ORDERS = [
  { id: 'WO-2025-001', assetId: 'AST-001', assetName: 'Rajasthan Solar Farm – Unit A', title: 'Inverter Module Replacement', type: 'Corrective', priority: 'High', status: 'In Progress', assignedTo: 'Ramesh Kumar', createdAt: '2025-06-10', dueDate: '2025-06-20', slaHours: 48, elapsedHours: 36, description: 'Inverter string #4 showing fault codes F012. Replace faulty modules and test output.', updates: [{ by: 'Ramesh Kumar', at: '2025-06-11 09:00', note: 'Modules identified, spare parts ordered.' }] },
  { id: 'WO-2025-002', assetId: 'AST-003', assetName: 'Karnataka Hydro – Dam 3', title: 'Turbine Bearing Inspection', type: 'Preventive', priority: 'Medium', status: 'Open', assignedTo: 'Priya Nair', createdAt: '2025-06-12', dueDate: '2025-06-25', slaHours: 72, elapsedHours: 12, description: 'Schedule routine turbine bearing lubrication and visual inspection per PM calendar.', updates: [] },
  { id: 'WO-2025-003', assetId: 'AST-002', assetName: 'Gujarat Wind Cluster – Phase 1', title: 'Blade Crack Assessment', type: 'Corrective', priority: 'Critical', status: 'Open', assignedTo: 'Arun Singh', createdAt: '2025-06-13', dueDate: '2025-06-15', slaHours: 24, elapsedHours: 22, description: 'Drone inspection detected hairline crack on blade #2 of turbine T-14. Urgent assessment required.', updates: [] },
  { id: 'WO-2025-004', assetId: 'AST-004', assetName: 'Tamil Nadu Solar Park – Zone B', title: 'Module Cleaning & Performance Check', type: 'Preventive', priority: 'Low', status: 'Closed', assignedTo: 'Suresh Patel', createdAt: '2025-06-05', dueDate: '2025-06-10', slaHours: 120, elapsedHours: 100, description: 'Quarterly panel cleaning and performance ratio check.', updates: [{ by: 'Suresh Patel', at: '2025-06-09 16:30', note: 'Cleaning completed. PR improved from 79% to 84%.' }] },
  { id: 'WO-2025-005', assetId: 'AST-005', assetName: 'MP Solar – Grid 7', title: 'SCADA Communication Failure', type: 'Corrective', priority: 'High', status: 'In Progress', assignedTo: 'Vikram Mehta', createdAt: '2025-06-14', dueDate: '2025-06-17', slaHours: 48, elapsedHours: 20, description: 'Asset has lost SCADA telemetry. Investigate communication box and restore connectivity.', updates: [{ by: 'Vikram Mehta', at: '2025-06-14 14:00', note: 'On-site. RTU found unresponsive. Replacement unit en-route.' }] },
];

// ── LOANS ─────────────────────────────────────────────────────────────────────
export const MOCK_LOANS = [
  { id: 'LN-001', assetId: 'AST-001', assetName: 'Rajasthan Solar Farm – Unit A', lender: 'State Bank of India', amount: 180000000, disbursed: 180000000, outstanding: 132000000, interestRate: 9.5, tenure: 180, emi: 1876543, nextEmiDate: '2025-07-05', status: 'Active', dscr: 1.42, covenants: ['DSCR ≥ 1.20', 'D/E ≤ 2.5', 'PLF ≥ 18%'] },
  { id: 'LN-002', assetId: 'AST-002', assetName: 'Gujarat Wind Cluster – Phase 1', lender: 'IREDA', amount: 420000000, disbursed: 420000000, outstanding: 310000000, interestRate: 8.8, tenure: 240, emi: 4320000, nextEmiDate: '2025-07-10', status: 'Active', dscr: 1.28, covenants: ['DSCR ≥ 1.15', 'CUF ≥ 20%', 'Debt Coverage ≥ 1.1'] },
  { id: 'LN-003', assetId: 'AST-003', assetName: 'Karnataka Hydro – Dam 3', lender: 'PFC (Power Finance Corp)', amount: 95000000, disbursed: 95000000, outstanding: 78000000, interestRate: 10.2, tenure: 144, emi: 1043000, nextEmiDate: '2025-07-01', status: 'Warning', dscr: 1.09, covenants: ['DSCR ≥ 1.10', 'Insurance Coverage', 'O&M Escrow funded'] },
  { id: 'LN-004', assetId: 'AST-004', assetName: 'Tamil Nadu Solar Park – Zone B', lender: 'HDFC Bank', amount: 260000000, disbursed: 260000000, outstanding: 245000000, interestRate: 9.2, tenure: 240, emi: 2680000, nextEmiDate: '2025-07-15', status: 'Active', dscr: 1.55, covenants: ['DSCR ≥ 1.25', 'PLF ≥ 19%', 'Net Worth Positive'] },
  { id: 'LN-005', assetId: 'AST-005', assetName: 'MP Solar – Grid 7', lender: 'REC Limited', amount: 72000000, disbursed: 72000000, outstanding: 68000000, interestRate: 10.75, tenure: 120, emi: 948000, nextEmiDate: '2025-07-20', status: 'Risk', dscr: 0.88, covenants: ['DSCR ≥ 1.10', 'Availability ≥ 90%'] },
  { id: 'LN-006', assetId: 'AST-006', assetName: 'Maharashtra Wind – Satara Hills', lender: 'Axis Bank', amount: 155000000, disbursed: 155000000, outstanding: 118000000, interestRate: 9.0, tenure: 180, emi: 1574000, nextEmiDate: '2025-07-08', status: 'Active', dscr: 1.33, covenants: ['DSCR ≥ 1.20', 'CUF ≥ 22%'] },
];

// ── COVENANTS ─────────────────────────────────────────────────────────────────
export const MOCK_COVENANTS = [
  { id: 'COV-001', loanId: 'LN-001', assetName: 'Rajasthan Solar Farm – Unit A', type: 'Financial', metric: 'DSCR', condition: '≥', threshold: 1.20, currentValue: 1.42, unit: 'x', frequency: 'Quarterly', lastChecked: '2025-06-01', status: 'Compliant', nextReview: '2025-09-01' },
  { id: 'COV-002', loanId: 'LN-001', assetName: 'Rajasthan Solar Farm – Unit A', type: 'Operational', metric: 'PLF (Plant Load Factor)', condition: '≥', threshold: 18, currentValue: 22.4, unit: '%', frequency: 'Monthly', lastChecked: '2025-06-01', status: 'Compliant', nextReview: '2025-07-01' },
  { id: 'COV-003', loanId: 'LN-002', assetName: 'Gujarat Wind Cluster – Phase 1', type: 'Financial', metric: 'DSCR', condition: '≥', threshold: 1.15, currentValue: 1.28, unit: 'x', frequency: 'Quarterly', lastChecked: '2025-06-01', status: 'Compliant', nextReview: '2025-09-01' },
  { id: 'COV-004', loanId: 'LN-003', assetName: 'Karnataka Hydro – Dam 3', type: 'Financial', metric: 'DSCR', condition: '≥', threshold: 1.10, currentValue: 1.09, unit: 'x', frequency: 'Quarterly', lastChecked: '2025-06-01', status: 'Breached', nextReview: '2025-07-01' },
  { id: 'COV-005', loanId: 'LN-003', assetName: 'Karnataka Hydro – Dam 3', type: 'Insurance', metric: 'O&M Escrow Balance', condition: '≥', threshold: 5000000, currentValue: 4200000, unit: '₹', frequency: 'Monthly', lastChecked: '2025-06-01', status: 'Breached', nextReview: '2025-07-01' },
  { id: 'COV-006', loanId: 'LN-004', assetName: 'Tamil Nadu Solar Park – Zone B', type: 'Financial', metric: 'DSCR', condition: '≥', threshold: 1.25, currentValue: 1.55, unit: 'x', frequency: 'Quarterly', lastChecked: '2025-06-01', status: 'Compliant', nextReview: '2025-09-01' },
  { id: 'COV-007', loanId: 'LN-005', assetName: 'MP Solar – Grid 7', type: 'Financial', metric: 'DSCR', condition: '≥', threshold: 1.10, currentValue: 0.88, unit: 'x', frequency: 'Quarterly', lastChecked: '2025-06-01', status: 'Breached', nextReview: '2025-07-01' },
  { id: 'COV-008', loanId: 'LN-005', assetName: 'MP Solar – Grid 7', type: 'Operational', metric: 'Plant Availability', condition: '≥', threshold: 90, currentValue: 64, unit: '%', frequency: 'Monthly', lastChecked: '2025-06-01', status: 'Breached', nextReview: '2025-07-01' },
  { id: 'COV-009', loanId: 'LN-006', assetName: 'Maharashtra Wind – Satara Hills', type: 'Operational', metric: 'CUF (Capacity Utilization Factor)', condition: '≥', threshold: 22, currentValue: 24.8, unit: '%', frequency: 'Monthly', lastChecked: '2025-06-01', status: 'Compliant', nextReview: '2025-07-01' },
];

// ── SCADA TELEMETRY ───────────────────────────────────────────────────────────
export const generateSCADAReading = (assetId) => {
  const base = {
    'AST-001': { power: 42, irradiance: 890, temp: 34.2, availability: 98 },
    'AST-002': { power: 98, windSpeed: 7.8, temp: 28.1, availability: 92 },
    'AST-003': { power: 18, flow: 42.5, temp: 22.4, availability: 67 },
    'AST-004': { power: 74, irradiance: 920, temp: 37.1, availability: 99 },
    'AST-005': { power: 0, irradiance: 400, temp: 41.3, availability: 34 },
    'AST-006': { power: 38, windSpeed: 6.9, temp: 26.4, availability: 88 },
  };
  const b = base[assetId] || { power: 0, availability: 0 };
  const jitter = (v, pct = 0.05) => +(v * (1 + (Math.random() - 0.5) * pct * 2)).toFixed(2);
  return {
    assetId,
    timestamp: new Date().toISOString(),
    activePower: jitter(b.power),
    availability: jitter(b.availability, 0.01),
    temperature: jitter(b.temp || 30, 0.03),
    ...(b.irradiance ? { irradiance: jitter(b.irradiance) } : {}),
    ...(b.windSpeed ? { windSpeed: jitter(b.windSpeed) } : {}),
    ...(b.flow ? { waterFlow: jitter(b.flow) } : {}),
  };
};

// ── ALERTS ────────────────────────────────────────────────────────────────────
export const INITIAL_ALERTS = [
  { id: 'ALT-001', assetId: 'AST-005', assetName: 'MP Solar – Grid 7', type: 'Critical', category: 'SCADA', message: 'SCADA telemetry lost — plant offline', timestamp: new Date(Date.now() - 3600000).toISOString(), acknowledged: false },
  { id: 'ALT-002', assetId: 'AST-003', assetName: 'Karnataka Hydro – Dam 3', type: 'Warning', category: 'Financial', message: 'DSCR breached covenant threshold (1.09 < 1.10)', timestamp: new Date(Date.now() - 7200000).toISOString(), acknowledged: false },
  { id: 'ALT-003', assetId: 'AST-002', assetName: 'Gujarat Wind Cluster – Phase 1', type: 'Critical', category: 'O&M', message: 'Blade crack detected on turbine T-14 — WO-2025-003 raised', timestamp: new Date(Date.now() - 1800000).toISOString(), acknowledged: false },
  { id: 'ALT-004', assetId: 'AST-005', assetName: 'MP Solar – Grid 7', type: 'Critical', category: 'Financial', message: 'DSCR critically low at 0.88 — lender notification required', timestamp: new Date(Date.now() - 900000).toISOString(), acknowledged: false },
  { id: 'ALT-005', assetId: 'AST-001', assetName: 'Rajasthan Solar Farm – Unit A', type: 'Info', category: 'O&M', message: 'EMI of ₹18.76L due on 2025-07-05', timestamp: new Date(Date.now() - 86400000).toISOString(), acknowledged: true },
];

// ── DSCR HISTORY for charts ────────────────────────────────────────────────────
export const DSCR_HISTORY = {
  'LN-001': [
    { month: 'Jan', dscr: 1.38 }, { month: 'Feb', dscr: 1.41 }, { month: 'Mar', dscr: 1.35 },
    { month: 'Apr', dscr: 1.44 }, { month: 'May', dscr: 1.40 }, { month: 'Jun', dscr: 1.42 },
  ],
  'LN-002': [
    { month: 'Jan', dscr: 1.22 }, { month: 'Feb', dscr: 1.30 }, { month: 'Mar', dscr: 1.27 },
    { month: 'Apr', dscr: 1.25 }, { month: 'May', dscr: 1.31 }, { month: 'Jun', dscr: 1.28 },
  ],
  'LN-003': [
    { month: 'Jan', dscr: 1.18 }, { month: 'Feb', dscr: 1.14 }, { month: 'Mar', dscr: 1.10 },
    { month: 'Apr', dscr: 1.07 }, { month: 'May', dscr: 1.08 }, { month: 'Jun', dscr: 1.09 },
  ],
  'LN-004': [
    { month: 'Jan', dscr: 1.60 }, { month: 'Feb', dscr: 1.58 }, { month: 'Mar', dscr: 1.62 },
    { month: 'Apr', dscr: 1.55 }, { month: 'May', dscr: 1.57 }, { month: 'Jun', dscr: 1.55 },
  ],
  'LN-005': [
    { month: 'Jan', dscr: 1.05 }, { month: 'Feb', dscr: 0.98 }, { month: 'Mar', dscr: 0.95 },
    { month: 'Apr', dscr: 0.91 }, { month: 'May', dscr: 0.89 }, { month: 'Jun', dscr: 0.88 },
  ],
  'LN-006': [
    { month: 'Jan', dscr: 1.28 }, { month: 'Feb', dscr: 1.30 }, { month: 'Mar', dscr: 1.35 },
    { month: 'Apr', dscr: 1.32 }, { month: 'May', dscr: 1.30 }, { month: 'Jun', dscr: 1.33 },
  ],
};

// ── USERS / TEAM ──────────────────────────────────────────────────────────────
export const MOCK_USERS = [
  { id: 'U001', name: 'Arjun Mehta', role: 'Admin', email: 'arjun@sesola.in', active: true },
  { id: 'U002', name: 'Ramesh Kumar', role: 'Operator', email: 'ramesh@sesola.in', active: true },
  { id: 'U003', name: 'Priya Nair', role: 'Operator', email: 'priya@sesola.in', active: true },
  { id: 'U004', name: 'Arun Singh', role: 'Operator', email: 'arun@sesola.in', active: true },
  { id: 'U005', name: 'Vikram Mehta', role: 'Operator', email: 'vikram@sesola.in', active: true },
  { id: 'U006', name: 'Suresh Patel', role: 'Operator', email: 'suresh@sesola.in', active: true },
  { id: 'U007', name: 'IREDA Analyst', role: 'Lender', email: 'ireda@lender.in', active: true },
  { id: 'U008', name: 'SBI Relationship Manager', role: 'Lender', email: 'sbi@lender.in', active: true },
];

// ── REPORT TEMPLATES ──────────────────────────────────────────────────────────
export const REPORT_TEMPLATES = [
  { id: 'RPT-001', name: 'Monthly Generation Report', category: 'Operations', description: 'Plant-wise generation, PLF, PR, availability' },
  { id: 'RPT-002', name: 'DSCR Compliance Report', category: 'Finance', description: 'Covenant status, DSCR trends, risk flags' },
  { id: 'RPT-003', name: 'Work Order Summary', category: 'O&M', description: 'Open/closed WOs, SLA adherence, MTTR analysis' },
  { id: 'RPT-004', name: 'Loan Portfolio Statement', category: 'Finance', description: 'Outstanding principal, EMI schedule, overdue' },
  { id: 'RPT-005', name: 'Covenant Tracker Report', category: 'Compliance', description: 'All covenants, breaches, upcoming reviews' },
  { id: 'RPT-006', name: 'Asset Health Dashboard', category: 'Operations', description: 'Asset health scores, alert counts, maintenance history' },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const fmtCurrency = (n) => {
  if (!n && n !== 0) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

export const dscrRisk = (dscr) => {
  if (dscr >= 1.25) return { label: 'Safe', color: '#059669', bg: '#ecfdf5', badge: 'en-safe' };
  if (dscr >= 1.10) return { label: 'Warning', color: '#d97706', bg: '#fffbeb', badge: 'en-warning' };
  return { label: 'Risk', color: '#dc2626', bg: '#fef2f2', badge: 'en-risk' };
};

export const assetStatusColor = (status) => {
  if (status === 'Operational') return { color: '#059669', bg: '#ecfdf5' };
  if (status === 'Under Maintenance') return { color: '#d97706', bg: '#fffbeb' };
  if (status === 'Offline') return { color: '#dc2626', bg: '#fef2f2' };
  return { color: '#64748b', bg: '#f1f5f9' };
};

export const priorityColor = (p) => {
  if (p === 'Critical') return { color: '#7c3aed', bg: '#f5f3ff' };
  if (p === 'High') return { color: '#dc2626', bg: '#fef2f2' };
  if (p === 'Medium') return { color: '#d97706', bg: '#fffbeb' };
  return { color: '#059669', bg: '#ecfdf5' };
};

export const woStatusColor = (s) => {
  if (s === 'Closed') return { color: '#059669', bg: '#ecfdf5' };
  if (s === 'In Progress') return { color: '#2563eb', bg: '#eff6ff' };
  if (s === 'Open') return { color: '#d97706', bg: '#fffbeb' };
  return { color: '#64748b', bg: '#f1f5f9' };
};
