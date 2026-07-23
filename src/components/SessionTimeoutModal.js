import React, { useEffect, useRef } from "react";
import "../components_css/SessionTimeoutModal.css";

/**
 * SessionTimeoutModal — inactivity warning shown before auto sign-out.
 *
 * Shows a circular countdown ring around the remaining seconds:
 *   • the ring starts FULL and drains clockwise every second
 *   • color shifts with remaining time:  green (>50%) → amber (>25%) → red
 *
 * Props:
 *   seconds       remaining seconds (ticked down by SessionManager)
 *   totalSeconds  full warning window (ring = seconds / totalSeconds).
 *                 Optional — defaults to the first `seconds` value received.
 *   onStay        "Stay signed in" handler
 *   onLogout      "Sign out now" handler
 */

const RING_SIZE = 90;                 // px — compact ring (confirmed size)
const RING_STROKE = 6;                // px
const RING_R = (RING_SIZE - RING_STROKE) / 2;          // 42
const RING_CIRC = 2 * Math.PI * RING_R;                // ≈ 263.9

export default function SessionTimeoutModal({ seconds, totalSeconds, onStay, onLogout }) {
  // Remember the initial window so the ring scales correctly even when the
  // caller doesn't pass totalSeconds (e.g. warning window of 51s or 60s).
  const totalRef = useRef(totalSeconds || seconds || 60);
  useEffect(() => {
    if (totalSeconds) totalRef.current = totalSeconds;
  }, [totalSeconds]);

  useEffect(() => {
    document.body.classList.add("session-modal-open");
    return () => {
      document.body.classList.remove("session-modal-open");
    };
  }, []);

  const total = Math.max(totalRef.current, 1);
  const pct = Math.max(0, Math.min(1, seconds / total));

  // green → amber → red by remaining fraction
  const ringColor = pct > 0.5 ? "#16a34a" : pct > 0.25 ? "#f59e0b" : "#dc2626";
  const urgent = pct <= 0.25;

  return (
    <div className="session-backdrop">
      <div className="session-dialog">

        <div className="session-header">
          <h3>Are you still there?</h3>
        </div>

        <div className="session-body">
          <p className="session-text">
            You've been inactive for a while. For your security, you'll be
            signed out automatically in
          </p>

          {/* ── Circular countdown ring ─────────────────────────────── */}
          <div
            className="session-ring-wrap"
            style={{ width: RING_SIZE, height: RING_SIZE }}
            role="timer"
            aria-live="polite"
            aria-label={`${seconds} seconds remaining`}
          >
            <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              {/* Track */}
              <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                fill="none" className="session-ring-track" strokeWidth={RING_STROKE}
              />
              {/* Progress — drains clockwise as time runs out */}
              <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                fill="none" strokeWidth={RING_STROKE} strokeLinecap="round"
                stroke={ringColor}
                strokeDasharray={RING_CIRC}
                /* negative offset ⇒ the arc recedes CLOCKWISE as time runs out */
                strokeDashoffset={-(RING_CIRC * (1 - pct))}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                className="session-ring-progress"
              />
            </svg>
            <div className="session-ring-center">
              <span className={`session-ring-secs ${urgent ? "session-ring-urgent" : ""}`}>
                {seconds}
              </span>
              <span className="session-ring-unit">sec</span>
            </div>
          </div>

          <p className="session-subtext">Any unsaved work may be lost.</p>
        </div>

        <div className="session-footer">
          <button className="session-btn session-btn-outline" onClick={onStay}>
            Stay Signed In
          </button>
          <button className="session-btn session-btn-danger" onClick={onLogout}>
            Sign Out Now
          </button>
        </div>

      </div>
    </div>
  );
} 