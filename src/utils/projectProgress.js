// ─────────────────────────────────────────────────────────────────────────────
//  projectProgress — one reading of "technical progress" for every project
//  surface (dashboard donut, Progress-breakdown modal, list table, list grid,
//  detail header, overview tab).
//
//  Technical progress is the weighted roll-up of the project's scope phases. A
//  project with no scope has NO technical progress — the honest value is
//  "not tracked", not a number.
//
//  Previously each surface did `physicalProgressPct ?? progressPercentage`, and
//  the backend wrote the financial 40/30/20/10 score into progress_percentage
//  whenever there was no scope. The result: scope-less projects displayed the
//  financial number under a "Technical" label, so the breakdown modal showed the
//  same figure twice while stating that no scope existed. That fallback is gone
//  on both sides — progress_percentage now carries only a manual override or the
//  real physical roll-up, so a null here genuinely means untracked.
//
//  A manual override still wins: the backend resolves override → physical → null
//  into progressPercentage, so a non-null value with no scope is operator-set.
// ─────────────────────────────────────────────────────────────────────────────

/** Shown wherever a project has no technical scope to roll up. */
export const NO_TECH_PROGRESS = '—';

/**
 * Technical progress as a number 0-100 (one decimal), or null when untracked.
 * Accepts either shape in use: `physicalProgressPct` (list/detail payloads) or
 * `physicalProgress` (dashboard DTO).
 */
export const techProgressPct = (p) => {
  if (!p) return null;
  const raw = p.physicalProgressPct != null ? p.physicalProgressPct
            : p.physicalProgress    != null ? p.physicalProgress
            : p.progressPercentage;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Number(Math.min(100, Math.max(0, n)).toFixed(1));
};

/** "42.5%" — or "—" when there is no scope. */
export const fmtTechProgress = (p) => {
  const n = techProgressPct(p);
  return n == null ? NO_TECH_PROGRESS : `${n}%`;
};

/** Bar/donut fill width for the same value; an untracked project draws empty. */
export const techProgressBar = (p) => techProgressPct(p) ?? 0;
