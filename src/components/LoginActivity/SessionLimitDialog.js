// src/components/LoginActivity/SessionLimitDialog.js
// LOGIN ACTIVITY MODULE — Feature 2 warning dialog shown on the login page
// when the backend returns 409 SESSION_LIMIT_REACHED.

import React from "react";
import "../../pages-css/LoginActivityMonitor.css";

const DEVICE_ICON = { MOBILE: "📱", TABLET: "📱", LAPTOP: "💻", DESKTOP: "🖥️" };

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SessionLimitDialog({ sessions = [], loading, onCancel, onContinue }) {
  return (
    <div className="la-modal-overlay" role="dialog" aria-modal="true">
      <div className="la-modal la-session-limit">
        <h3 className="la-modal-title">Maximum Active Sessions Reached</h3>
        <p className="la-modal-text">
          Your account is already active on two devices. If you continue, your
          oldest active session will be logged out automatically.
        </p>

        {sessions.length > 0 && (
          <div className="la-session-limit-list">
            {sessions.map((s, i) => (
              <div key={s.id || i} className="la-session-limit-item">
                <span className="la-session-limit-icon">
                  {DEVICE_ICON[s.deviceType] || "💻"}
                </span>
                <div className="la-session-limit-info">
                  <div className="la-session-limit-device">
                    {s.browser || "Browser"}
                    {s.operatingSystem ? ` · ${s.operatingSystem}` : ""}
                    {i === 0 && (
                      <span className="la-badge la-badge-warning">
                        Oldest — will be logged out
                      </span>
                    )}
                  </div>
                  <div className="la-session-limit-meta">
                    {s.city ? `${s.city} · ` : ""}Signed in {formatWhen(s.loginAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="la-modal-text la-modal-question">Do you want to continue?</p>

        <div className="la-modal-actions">
          <button type="button" className="la-btn la-btn-secondary"
                  onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="la-btn la-btn-primary"
                  onClick={onContinue} disabled={loading}>
            {loading ? "Signing in…" : "Continue Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
