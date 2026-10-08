import { blankCriterion, computeEligibility, hydrateTender, qualifyingTiers, tierResults } from './tenderData';

test('import-only fields never reach the working copy (a save would send "" for a list)', () => {
  const t = hydrateTender({ id: 3, tenderName: 'X', importBulkAcks: null, importSource: null, importSummary: null });
  expect('importBulkAcks' in t).toBe(false);
  expect('importSource' in t).toBe(false);
  expect(t.tenderName).toBe('X');
});

// A criterion with our value filled in, so it evaluates.
const row = (over) => ({ ...blankCriterion('Technical'), ...over });
const met = (over) => row({ requiredValue: '10', operator: 'gte', ourValue: '12', ...over });
const notMet = (over) => row({ requiredValue: '10', operator: 'gte', ourValue: '8', ...over });
const open = (over) => row({ requiredValue: '10', operator: 'gte', ourValue: '', ...over });

describe('eligibility without tiers (unchanged behaviour)', () => {
  test('every row must pass', () => {
    expect(computeEligibility([met(), met()])).toBe('GO');
    expect(computeEligibility([met(), notMet()])).toBe('NO_GO');
    expect(computeEligibility([met(), open()])).toBe('PENDING');
    expect(computeEligibility([])).toBe('PENDING');
  });

  test('an alternative group needs any one of its rows', () => {
    expect(computeEligibility([notMet({ altGroup: 'A1' }), met({ altGroup: 'A1' })])).toBe('GO');
    expect(computeEligibility([notMet({ altGroup: 'A1' }), notMet({ altGroup: 'A1' })])).toBe('NO_GO');
  });

  test('no tiers, no tier results', () => {
    expect(tierResults([met(), notMet()])).toEqual([]);
  });
});

describe('tiered eligibility (empanelment / EOI)', () => {
  // CEL-style: turnover + experience per category, ISO for everyone.
  const tiered = (a, b, c, iso = met) => [
    a({ tier: 'Category A', category: 'Financial' }),
    a({ tier: 'Category A' }),
    b({ tier: 'Category B', category: 'Financial' }),
    b({ tier: 'Category B' }),
    c({ tier: 'Category C', category: 'Financial' }),
    c({ tier: 'Category C' }),
    iso({ operator: 'boolean', requiredValue: '', ourValue: iso === met ? 'yes' : iso === notMet ? 'no' : '' }),
  ];

  test('meeting every row of one tier is enough', () => {
    const rows = tiered(notMet, notMet, met);
    expect(computeEligibility(rows)).toBe('GO');
    expect(qualifyingTiers(rows)).toEqual(['Category C']);
  });

  test('a tier is met only when all its rows are', () => {
    const rows = [
      met({ tier: 'Category A', category: 'Financial' }),
      notMet({ tier: 'Category A' }),
      notMet({ tier: 'Category B' }),
    ];
    expect(computeEligibility(rows)).toBe('NO_GO');
    expect(tierResults(rows).map((t) => t.status)).toEqual(['fail', 'fail']);
  });

  test('every tier failing is NO-GO', () => {
    expect(computeEligibility(tiered(notMet, notMet, notMet))).toBe('NO_GO');
  });

  test('untiered rows must still all be met', () => {
    expect(computeEligibility(tiered(met, met, met, notMet))).toBe('NO_GO');
    expect(computeEligibility(tiered(met, met, met, open))).toBe('PENDING');
  });

  test('nothing failed outright but no tier met yet is PENDING', () => {
    expect(computeEligibility(tiered(open, notMet, notMet))).toBe('PENDING');
  });

  test('alternative groups still work inside a tier', () => {
    const rows = [
      met({ tier: 'Category A', category: 'Financial' }),
      notMet({ tier: 'Category A', altGroup: 'A1' }),     // > 10 MWp in SPV plants …
      met({ tier: 'Category A', altGroup: 'A1' }),        // … or > 5 MWp + > 5 MWp
      notMet({ tier: 'Category B' }),
    ];
    expect(computeEligibility(rows)).toBe('GO');
    expect(qualifyingTiers(rows)).toEqual(['Category A']);
  });

  test('the same alternative group name in two tiers is two separate groups', () => {
    const rows = [
      met({ tier: 'Category A', altGroup: 'X' }),
      notMet({ tier: 'Category B', altGroup: 'X' }),
    ];
    expect(tierResults(rows).map((t) => t.status)).toEqual(['pass', 'fail']);
  });

  test('an override counts as met inside a tier', () => {
    const rows = [notMet({ tier: 'Category A', override: true }), notMet({ tier: 'Category B' })];
    expect(computeEligibility(rows)).toBe('GO');
  });
});
