// ─────────────────────────────────────────────────────────────────────────────
//  scopeWeights — the weight model shared by anything that edits a group of
//  weights that must total 100%.
//
//  The model is the project scope tab's, not a new one: see
//  components/projects/orderBookTabsPorted.js (distributeSubWeights /
//  snapSubGroup / resetSubWeights, ~lines 701-783), which is the original and
//  stays the source of truth. That file is a hand-maintained port and is left
//  untouched, so the algorithm is carried here rather than imported from it.
//  If the rules ever change, change them in both places.
//
//  The rules:
//   • A row the user typed into is PINNED (weightManual === true) and holds its
//     value. Unpinned rows share whatever is left of 100 equally, so the total
//     stays at 100% while the user works — never only at save time.
//   • Weights display to two decimals but are stored more precisely. Retyping a
//     displayed value therefore enters a slightly different number, so a total
//     off by no more than two-decimal rounding could explain is corrected
//     silently. The correction goes to the LARGEST row: proportionally the
//     smallest possible adjustment, and invisible at two decimals.
//   • Anything off by more than that is a real mistake and is reported.
//   • Once every row is pinned nothing is left to absorb a shortfall, which is
//     why resetWeights() must be reachable from the UI.
//
//  Mirrored server-side in LeadAdminService.normaliseScopeWeights — the same
//  tolerance and the same delta-to-largest rule, so a save that passes here
//  cannot fail there.
// ─────────────────────────────────────────────────────────────────────────────

/** Weights are shown to two decimals. */
export const WEIGHT_DECIMALS = 2;

/** The most a single two-decimal display value can differ from what's stored. */
const DISPLAY_ROUNDING_STEP = 0.005;

/** Float dust guard — comparisons, never a tolerance for real error. */
const EPSILON = 1e-9;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const round = (v, dp) => Number(num(v).toFixed(dp));

/** Two-decimal display value, e.g. 12.5 → "12.50". */
export const fmtWeight = (v) => num(v).toFixed(WEIGHT_DECIMALS);

/** Running total of a weight group. */
export const weightSum = (rows) => (rows || []).reduce((s, r) => s + num(r.weightPct), 0);

/**
 * Re-balance the unpinned rows so the group totals 100%, leaving pinned rows
 * alone. The last unpinned row absorbs the remainder, so the group lands on
 * exactly 100 rather than 99.99.
 *
 * With every row pinned there is nothing to balance, so the rows come back
 * unchanged — resetWeights() is the way out of that state.
 */
export function distributeWeights(rows) {
  const list = rows || [];
  if (list.length === 0) return list;

  const pinnedSum = list.reduce((s, r) => s + (r.weightManual === true ? num(r.weightPct) : 0), 0);
  const remaining = Math.max(0, 100 - pinnedSum);

  const autoIdx = list.map((r, i) => (r.weightManual === true ? -1 : i)).filter(i => i >= 0);
  if (autoIdx.length === 0) return list;

  const base = round(remaining / autoIdx.length, WEIGHT_DECIMALS);
  const lastAuto = autoIdx[autoIdx.length - 1];
  const lastShare = round(remaining - base * (autoIdx.length - 1), WEIGHT_DECIMALS);

  return list.map((r, i) => (r.weightManual === true
    ? r
    : { ...r, weightPct: i === lastAuto ? lastShare : base }));
}

/** Unpin everything and restore an even split. */
export function resetWeights(rows) {
  return distributeWeights((rows || []).map(r => ({ ...r, weightManual: false })));
}

/**
 * Apply a typed weight: the row becomes pinned and holds it, and the unpinned
 * rows absorb the difference so the running total stays at 100%. Clearing the
 * field un-pins the row and hands it back to auto-balancing.
 */
export function setWeightAt(rows, index, raw) {
  const val = raw === '' ? '' : Math.max(0, num(raw));
  return distributeWeights((rows || []).map((r, i) => (i === index
    ? { ...r, weightPct: val, weightManual: raw !== '' }
    : r)));
}

/**
 * Gate a save. Returns `{ ok: true, rows }` with rounding absorbed, or
 * `{ ok: false, error }` with a message that names what is wrong — a zero line
 * by name, a bad total by its actual value.
 *
 * @param {Array}    rows
 * @param {Function} labelOf  row → the name to use in an error message
 */
export function validateWeights(rows, labelOf = (r) => r.activity) {
  const list = rows || [];
  if (list.length === 0) return { ok: true, rows: list };

  // The total is checked before the per-line check: when both are wrong — one
  // line typed at 120% leaves the auto-balanced lines at 0% — naming the total
  // explains the problem, whereas naming a zeroed line points away from what the
  // user actually did. Same order server-side, so the messages agree.
  const sum = weightSum(list);
  const delta = 100 - sum;
  const tolerance = list.length * DISPLAY_ROUNDING_STEP + EPSILON;
  if (Math.abs(delta) > tolerance) {
    return {
      ok: false,
      error: `Scope weights total ${sum.toFixed(WEIGHT_DECIMALS)}% — they must add up to 100%.`,
    };
  }

  for (const r of list) {
    if (!(num(r.weightPct) > 0)) {
      return {
        ok: false,
        error: `Scope line "${labelOf(r) || 'this line'}" has a weight of 0% — `
          + 'every line must carry a weight above zero.',
      };
    }
  }

  if (Math.abs(delta) < EPSILON) return { ok: true, rows: list };

  let largest = 0;
  list.forEach((r, i) => { if (num(r.weightPct) > num(list[largest].weightPct)) largest = i; });
  return {
    ok: true,
    rows: list.map((r, i) => (i === largest
      ? { ...r, weightPct: round(num(r.weightPct) + delta, 6) }
      : r)),
  };
}

/** True when the group is close enough to 100% to save. */
export const weightsOk = (rows) => validateWeights(rows).ok;
