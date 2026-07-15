// src/constants/leadStatus.js
//
// Single source of truth for the lead funnel ORDER. Two rules are derived from it:
//
//   1. DOWNGRADE  — moving a lead to an earlier funnel stage requires a reason.
//   2. LOCKED     — once a lead has progressed past a stage, that earlier stage
//                   can no longer be selected in the status pickers.
//
// Mirrors LeadsService.STATUS_RANK on the backend — keep both in sync.
//
// Deliberately UNRANKED (neither a downgrade nor ever locked):
//   • "Keep in View" — a legitimate HOLD at any stage (e.g. the client asks for
//     more time after a proposal was sent). Moving in/out of it is never a
//     regression, so it is always selectable and never needs a reason.
//   • "Closed Lost"  — the CORRECT terminal exit for a deal lost after a
//     proposal. It already captures its own mandatory `closedLostReason`.
//
// "Not Interested" IS ranked (below "Interested") on purpose: going from
// Proposal Sent → Not Interested doesn't make sense (that should be Closed Lost),
// so it must be justified. It captures BOTH the downgrade reason and its own
// `notInterestedReason`.

/** The status options offered in the lead status pickers (display order). */
export const LEAD_STATUS_OPTIONS = [
  'New',
  'Interested',
  'Not Interested',
  'Not Responded',
  'Keep in View',
  'Prospect',
  'Proposal Sent',
  'Closed Won',
  'Closed Lost',
];

/** Funnel rank — higher means further along. Absent = unranked (see above). */
export const LEAD_STATUS_RANK = {
  'new': 1,
  'not responded': 1,
  'not interested': 1,
  'interested': 2,
  'prospect': 2,
  'contacted': 3,
  'in discussion': 4,
  'proposal sent': 5,
  'closed won': 6,
};

/** Terminal outcomes that are ALWAYS selectable at any stage. */
export const LEAD_TERMINAL_STATUSES = ['Closed Lost', 'Closed Won'];

/** Rank of "Interested" — the cut-off past which "Not Interested" stops being valid. */
const RANK_INTERESTED = LEAD_STATUS_RANK['interested'];

/**
 * Canonicalise a status so BOTH conventions resolve to the same key:
 *   • main leads page  → title case  ("Not Responded")
 *   • telecaller view  → UPPER_SNAKE ("NOT_RESPONDED")
 */
export const normalizeStatus = (status) =>
  String(status || '').trim().toLowerCase().replace(/_/g, ' ');

export const rankOfStatus = (status) =>
  status ? LEAD_STATUS_RANK[normalizeStatus(status)] ?? null : null;

/**
 * True only when BOTH statuses are ranked and the new one sits earlier in the
 * funnel than the old one. Forward moves, lateral moves (equal rank) and anything
 * involving an unranked hold/exit ("Keep in View", "Closed Lost") return false.
 */
export const isStatusDowngrade = (oldStatus, newStatus) => {
  const oldRank = rankOfStatus(oldStatus);
  const newRank = rankOfStatus(newStatus);
  if (oldRank == null || newRank == null) return false;
  return newRank < oldRank;
};

/**
 * True when `option` is no longer a valid choice for a lead sitting at
 * `currentStatus`, and so must be greyed out in the pickers.
 *
 * Locks:
 *   • any earlier ACTIVE funnel stage the lead has already moved past;
 *   • "Not Interested" once the lead has progressed BEYOND "Interested" — at that
 *     point the correct exit is "Closed Lost", not "Not Interested".
 *
 * Never locks: the unranked hold/exit ("Keep in View", "Closed Lost") and
 * "Closed Won".
 */
export const isStatusLocked = (currentStatus, option) => {
  const currentRank = rankOfStatus(currentStatus);
  const optionRank  = rankOfStatus(option);

  // "Not Interested" is only valid while the lead is still at or below Interested.
  if (normalizeStatus(option) === 'not interested') {
    return currentRank != null && currentRank > RANK_INTERESTED;
  }

  if (LEAD_TERMINAL_STATUSES.some(t => normalizeStatus(t) === normalizeStatus(option))) return false;
  if (currentRank == null || optionRank == null) return false; // unranked hold → always open
  return optionRank < currentRank;
};

/** Tooltip shown on a locked option. */
export const lockedStatusHint = (currentStatus, option) => {
  if (normalizeStatus(option) === 'not interested') {
    return `This lead has already progressed to “${currentStatus}” — mark it “Closed Lost” instead of “Not Interested”.`;
  }
  return `This lead has already moved to “${currentStatus}” — it can't be sent back to an earlier stage. ` +
    `Use “Keep in View” to hold it, or “Closed Lost” to close it.`;
};
