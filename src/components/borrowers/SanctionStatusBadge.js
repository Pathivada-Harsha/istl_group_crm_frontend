// src/components/borrowers/SanctionStatusBadge.js
//
// The one editable Active/Inactive control in the Borrower Registry, and it
// lives ONLY in a table row's own STATUS cell — never a separate button, a
// separate "edit status" section, or a Company/Group-level control. Every
// Company/Parent Group/Sub Group's own displayed status is always DERIVED
// from sanctions (see BorrowerService.deriveStatusLabel) and is never itself
// editable; this badge changes exactly one sanction letter's own
// `active_status`, identified by `sanctionId`, then hands control back to
// the caller via `onChanged` so it can reload and pick up the (possibly now
// different) derived statuses above it — without navigating anywhere.
//
// Self-contained: owns its own open/closed menu state AND its own
// confirmation dialog, so any table (Level 1 standalone rows, a Parent
// Group's Direct Companies, a Sub Group's companies, a company's own
// Sanction Letters tab) can drop one in per row with no state to thread
// through the parent besides "what to do when it's done".

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, AlertTriangle } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';

const labelOf = (v) => (String(v).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active');

// Every table this badge sits in (Direct Companies, a Sub Group's own
// companies, Level 1's standalone rows) scrolls its own body
// (.brx-tree-scroll's overflow-x/y: auto) — a plain `position: absolute`
// menu anchored to the button gets clipped the moment it would extend past
// that scrolling ancestor's bounds, which is exactly the bug reported
// (dropdown opening but not visible). Rendering the menu into `document.body`
// via a portal, positioned with `position: fixed` from the button's own
// on-screen coordinates, sidesteps every such ancestor entirely — no
// overflow/z-index/stacking-context change needed on any table container.
const MENU_HEIGHT_ESTIMATE = 84; // two items + padding; only used to decide open-up vs open-down

const useMenuPosition = (open, anchorRef, onDismiss) => {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const openUpward = r.bottom + MENU_HEIGHT_ESTIMATE > window.innerHeight
        && r.top - MENU_HEIGHT_ESTIMATE > 0;
      setPos({
        left: r.left,
        top: openUpward ? undefined : r.bottom + 4,
        bottom: openUpward ? window.innerHeight - r.top + 4 : undefined,
        minWidth: r.width,
      });
    };
    place();
    // The menu is `position: fixed` (viewport-relative), so its on-screen
    // spot goes stale the moment the page — or the table's own scroll
    // container — scrolls under it; simplest correct behavior is to close
    // it rather than chase the scroll. `capture: true` catches scroll
    // events from any nested scrollable ancestor, not only window scroll.
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('resize', place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef]);
  return pos;
};

/**
 * `sanctionId`: the exact sanction letter this row represents — for a
 * company/group summary row (which can have more than one sanction) this is
 * that company's most recent sanction by date, the same "latest letter"
 * convention this app already uses elsewhere for a list row (see
 * BorrowerService.rollupsFor's `latestSanctionId`) — never "all of them".
 * `disabled`: true when there is no sanction to edit (a company with zero
 * sanctions) — renders a plain, non-interactive pill instead.
 */
const SanctionStatusBadge = ({ sanctionId, refNo, cin, status, onChanged, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // the other value, awaiting confirmation
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef(null);
  const current = labelOf(status);
  // Sanction Reference → this exact sanction's associated Company/Parent
  // Group CIN → "—". Never a different record's CIN — `cin` is always
  // threaded down from the same row (company summary row's own `cin`, or
  // the sanction wrapper's own `cin`, which the backend already resolves to
  // its actual associated borrower/group — see BorrowerService.toWrapper).
  // The label follows whichever value actually ends up shown, so a CIN is
  // never mislabeled as a "Sanction Reference".
  const hasRefNo = !!refNo?.trim();
  const hasCin = !!cin?.trim();
  const referenceLabel = hasRefNo ? 'Sanction Reference' : hasCin ? 'CIN' : 'Sanction Reference / CIN';
  const referenceDisplay = hasRefNo ? refNo : hasCin ? cin : '—';
  // Hooks run unconditionally every render — the disabled/no-sanction early
  // return (below) must come after them, not before, so this component
  // never breaks the rules of hooks if `disabled`/`sanctionId` change.
  const menuPos = useMenuPosition(open, buttonRef, () => setOpen(false));

  if (disabled || !sanctionId) {
    return <span className="brx-status-pill brx-status-muted">Inactive</span>;
  }

  const requestChange = (next) => {
    setOpen(false);
    if (next !== current) setPending(next);
  };

  const confirm = async () => {
    setSaving(true);
    setError('');
    try {
      await borrowerApi.updateSanctionStatus(sanctionId, pending);
      setPending(null);
      onChanged?.();
    } catch (e) {
      setError(e.message || "Could not update this sanction's status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="brx-status-dropdown" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className={`brx-status-pill brx-status-pill-btn ${current === 'Active' ? 'brx-status-active' : 'brx-status-muted'}`}
        onClick={() => setOpen((v) => !v)}
      >
        {current}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && menuPos && createPortal(
        <>
          <div className="brx-status-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div
            className="brx-status-dropdown-menu"
            role="menu"
            style={{
              position: 'fixed', left: menuPos.left, top: menuPos.top, bottom: menuPos.bottom,
              minWidth: menuPos.minWidth,
            }}
          >
            {['Active', 'Inactive'].map((opt) => (
              <button
                key={opt}
                type="button"
                role="menuitem"
                className="brx-status-dropdown-item"
                onClick={() => requestChange(opt)}
              >
                <span className="brx-status-dropdown-check">
                  {opt === current && <Check size={12} aria-hidden="true" />}
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}

      {pending && (
        <div className="br-modal-backdrop" onMouseDown={() => (!saving && setPending(null))}>
          <div
            className="br-modal br-modal-confirm"
            onMouseDown={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm status change"
          >
            <div className="br-modal-head">
              <div className="br-viewer-title">
                <AlertTriangle size={18} className="br-tone-warn" aria-hidden="true" />
                <div className="br-viewer-title-text">
                  <h3 className="br-modal-title">Change this sanction letter's status?</h3>
                </div>
              </div>
            </div>
            <div className="br-modal-body br-modal-body-single">
              <p className="br-confirm-text">
                Are you sure you want to change the status of this sanction letter?
              </p>
              <div className="br-confirm-detail">
                <span className="br-confirm-detail-label">{referenceLabel}</span>
                <span className="br-confirm-detail-value br-mono">{referenceDisplay}</span>
              </div>
              <div className="br-confirm-status-rows">
                <div className="br-confirm-status-row">
                  <span>Current Status</span>
                  <span className={`brx-status-pill ${current === 'Active' ? 'brx-status-active' : 'brx-status-muted'}`}>
                    {current}
                  </span>
                </div>
                <div className="br-confirm-status-row">
                  <span>New Status</span>
                  <span className={`brx-status-pill ${pending === 'Active' ? 'brx-status-active' : 'brx-status-muted'}`}>
                    {pending}
                  </span>
                </div>
              </div>
              {error && <div className="br-banner br-banner-danger">{error}</div>}
            </div>
            <div className="br-modal-foot">
              <button type="button" className="br-btn" onClick={() => setPending(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="br-btn br-btn-primary" onClick={confirm} disabled={saving}>
                <Check size={15} aria-hidden="true" />
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};

export default SanctionStatusBadge;
