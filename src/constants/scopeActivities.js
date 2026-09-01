// ─────────────────────────────────────────────────────────────────────────────
//  Shared option lists for the lead Technical Scope / BOM / Budget tabs.
//
//  The projects module carries its own copy of ACTIVITY_SUGGESTIONS inside
//  components/projects/orderBookTabsPorted.js, which is generated and must not
//  be hand-edited — so that duplication stays for now. Anything new reads from
//  here rather than adding a third copy.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built-in EPC activity/item names for the scope dropdown. Users can add their
 * own via "Other (type your own)…"; those are persisted to the shared
 * scope_activity_suggestion table and merged in at runtime.
 */
export const ACTIVITY_SUGGESTIONS = [
  // Engineering & pre-construction
  'Site Survey', 'Topographic Survey', 'Geotechnical Investigation', 'System Simulation',
  'Civil Design', 'Structural Design', 'Electrical Design', 'SLD & Layout Design',
  'Detailed Engineering', 'Statutory Approvals & Permits',
  // Civil
  'Site Mobilization', 'Earthworks, Grading & Drainage', 'Civil Works', 'Foundation & Piling',
  'Boundary & Fencing', 'Site Roads & Access',
  // Mechanical / structures
  'MMS Supply', 'MMS Erection & Alignment', 'Module Mounting Structure',
  'Module Earthing & Row Bonding', 'Mechanical Installation', 'Module Installation',
  // Electrical
  'Procurement', 'DC Cabling', 'AC Cabling', 'Earthing & Lightning Protection',
  'Inverter Installation', 'Transformer Installation', 'Electrical & Cabling',
  'Switchgear & LT/HT Panels', 'SCADA & Monitoring', 'Substation Works',
  // Closeout
  'Testing & Pre-Commissioning', 'Testing & Commissioning', 'Grid Synchronization',
  'Inspection', 'Snag Rectification', 'Documentation & As-Builts', 'Handover',
];

/**
 * The company's standard EPC lifecycle, used by "Suggest EPC scope". Matches
 * DEFAULT_EPC_PHASES in OrderBookDetailService — minus the week numbers, since a
 * lead's scope deliberately carries no dates.
 */
export const DEFAULT_EPC_SCOPE = [
  'Site Survey', 'System Simulation', 'Civil Design', 'Electrical Design',
  'Procurement', 'Installation', 'Commissioning', 'Handover',
];

/** Units offered on scope lines and BOM lines. */
export const UNIT_SUGGESTIONS = [
  'Nos', 'kW', 'kWp', 'MW', 'Lot', 'Set', 'm', 'sqm', 'kg', 'MT', 'Ltr', 'Job',
];

/** Fallback BOM categories, matching bom_items_master.category. */
export const BOM_CATEGORIES = ['CCMS', 'ITMS', 'MCMS', 'EPC', 'COMMON'];

/**
 * Standard extra-allocation names for the Budget Estimation tab — costs that
 * aren't a BOM material. Contingency and overheads are conventionally a
 * percentage of the BOM base; freight and insurance are usually flat.
 */
export const EXTRA_ALLOCATION_TYPES = [
  'Freight & Logistics', 'Contingency', 'Site Overheads', 'Installation Labour',
  'Transportation', 'Insurance', 'Statutory & Approvals', 'Testing & Commissioning',
  'Warranty / O&M Provision', 'Financing Cost',
];

/** Sentinel value for the "type your own" option in a name dropdown. */
export const OTHER_OPTION = '__OTHER__';

// ─────────────────────────────────────────────────────────────────────────────
//  Suggestion / template constants (Lead Templates admin + the Suggest actions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a template BOM line's quantity scales with the lead's capacity. Mirrors the
 * backend basis constants on LeadBomTemplateItemEntity.
 */
export const BASIS_OPTIONS = [
  { value: 'FIXED', label: 'Fixed quantity', help: 'Same quantity regardless of capacity (e.g. 1 lightning arrestor).' },
  { value: 'PER_KW', label: 'Per kW', help: 'Quantity = value × capacity in kW (e.g. 1.7 modules per kW).' },
  { value: 'PER_STEP', label: 'Per step', help: 'One unit per N kW, rounded up (e.g. one 50 kW inverter per 50 kW).' },
  { value: 'FROM_SITE_VISIT', label: 'From site visit', help: 'Quantity read from a site visit field (e.g. DC cable length).' },
  { value: 'PER_WATT_PEAK', label: 'Module count (from Wp)', help: 'Module count = ceil(kW×1000 ÷ selected make wattage). Attach module makes that carry a Wp wattage.' },
  { value: 'PER_INVERTER_KW', label: 'Inverter count (from kW)', help: 'Inverter count = ceil(kW ÷ selected make kW). Attach inverter makes that carry a kW capacity.' },
  { value: 'PER_MODULE', label: 'Per module count', help: 'Quantity = ceil(value × module count), e.g. 2 connectors per module. Use PER_KW for weight/area items.' },
  { value: 'PER_INVERTER', label: 'Per inverter count', help: 'Quantity = ceil(value × inverter count), e.g. 1 ACDB per inverter.' },
];

/** Site-visit fields a FROM_SITE_VISIT line can pull its quantity from. */
export const SITE_VISIT_FIELDS = [
  { value: 'dc_cable_length', label: 'DC cable length' },
  { value: 'ac_cable_length', label: 'AC cable length' },
  { value: 'sanctioned_load', label: 'Sanctioned load' },
  { value: 'shadow_free_area', label: 'Shadow-free area' },
];

/** Human labels for the suggestion warning codes the backend returns. */
export const SUGGESTION_WARNING_LABELS = {
  NEEDS_CAPACITY: 'This lead has no usable capacity — per-kW quantities were left blank.',
  LARGE_SCALE_CHECK: 'Some quantities were scaled from a job of a very different size — review them.',
  AMBIGUOUS_MATCH: 'Some items matched the template only loosely — check their quantities.',
  BASIS_UNRESOLVED: 'Some items had no matching template rule — a sensible default was used; verify.',
  NEEDS_SITE_VISIT: 'Some quantities come from the site visit and were left blank — fill them in.',
  NO_TEMPLATE_NO_HISTORY: 'No template exists for this project type yet, and no similar past job was found.',
  NEEDS_MODULE_WATT: 'Pick a module make with a wattage (Wp) so the module count can be computed.',
  NEEDS_INVERTER_KW: 'Pick an inverter make with a kW rating so the inverter count can be computed.',
  NEEDS_MODULE_DRIVER: 'A per-module item could not size — there is no module (watt-peak) line to scale from.',
  NEEDS_INVERTER_DRIVER: 'A per-inverter item could not size — there is no inverter line to scale from.',
  MULTIPLE_DRIVERS: 'More than one module/inverter driver line was found — counts were summed; verify.',
  NEEDS_BASIS_VALUE: 'Some template lines have a quantity rule but no value for it — fix them in Lead Scope / BOM Templates.',
  NEEDS_STEP_VALUE: 'Some per-step template lines have no kW-per-unit set — fix them in Lead Scope / BOM Templates.',
  NEEDS_SITE_VISIT_FIELD: 'Some template lines read from the site visit but name no field — fix them in Lead Scope / BOM Templates.',
};

/**
 * The same codes said on ONE ROW, in the space of a caption. The banner labels
 * above speak about the BOM as a whole ("some items…"); a row has to name the
 * one input it is waiting for, or a blank quantity is indistinguishable from a
 * quantity that is still being calculated.
 *
 * `attr` is the catalogue's own name for the numeric attribute the line reads
 * off the selected make (driverAttrLabel), so the message points at the field
 * the estimator would actually go and fill in.
 */
export const LINE_REASON_LABELS = {
  NEEDS_CAPACITY: () => 'needs system capacity',
  NEEDS_BASIS_VALUE: () => 'template line has no quantity value',
  NEEDS_STEP_VALUE: () => 'template line has no kW per unit',
  NEEDS_SITE_VISIT_FIELD: () => 'template line names no site-visit field',
  NEEDS_SITE_VISIT: () => 'needs a site visit measurement',
  NEEDS_MODULE_WATT: (attr) => `selected make has no ${attr || 'wattage'}`,
  NEEDS_INVERTER_KW: (attr) => `selected make has no ${attr || 'kW rating'}`,
  NEEDS_MODULE_DRIVER: () => 'no module line to scale from',
  NEEDS_INVERTER_DRIVER: () => 'no inverter line to scale from',
  BASIS_UNRESOLVED: () => 'no quantity rule for this line',
};

/** The one-line reason a BOM row shows in place of its "auto" caption. */
export const lineReason = (code, attrLabel) => {
  const f = LINE_REASON_LABELS[code];
  return f ? f(attrLabel) : 'cannot be calculated';
};
