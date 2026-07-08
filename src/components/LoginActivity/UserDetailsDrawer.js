// src/components/LoginActivity/UserDetailsDrawer.js
// LOGIN ACTIVITY MODULE — Feature 5: side drawer with a user's profile,
// session stats, active devices and recent activity. Opens when a user is
// clicked anywhere on the Login & Activity Monitor page.

import React, { useEffect, useState } from "react";
import { loginActivityApi } from "../../services/loginActivityApi";
import useToast from "../../hooks/useToast";
import ToastContainer from "../Notification_Toast/ToastContainer";
import useConfirmationModal from "../HandleConfirmationModal";
import ConfirmationModal from "../ConfirmationModal";
import "../../pages-css/LoginActivityMonitor.css";

const DEVICE_ICON = { MOBILE: "📱", TABLET: "📱", LAPTOP: "💻", DESKTOP: "🖥️" };

function initials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtDuration(sec) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function UserDetailsDrawer({ userId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { confirmModal, showConfirmation } = useConfirmationModal();

  const load = () => {
    setLoading(true);
    setError("");
    loginActivityApi
      .userSummary(userId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOutAll = async () => {
    const confirmed = await showConfirmation({
      title: "Sign Out All Devices",
      message: "This user will be signed out of every active device. Continue?",
      type: "confirm",
      confirmText: "Sign out all",
    });
    if (!confirmed) return;
    setWorking(true);
    try {
      const res = await loginActivityApi.signOutAllDevices(userId);
      showSuccess(res?.message || "All devices signed out");
      load();
      onChanged && onChanged();
    } catch (e) {
      showError(e.message);
    } finally {
      setWorking(false);
    }
  };

  const terminate = async (sessionId) => {
    const confirmed = await showConfirmation({
      title: "Terminate Session",
      message: "The user on that device will be signed out immediately. Continue?",
      type: "confirm",
      confirmText: "Terminate",
    });
    if (!confirmed) return;
    setWorking(true);
    try {
      await loginActivityApi.terminateSession(sessionId);
      showSuccess("Session terminated");
      load();
      onChanged && onChanged();
    } catch (e) {
      showError(e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <div className="la-drawer-overlay" onClick={onClose}></div>
      <aside className="la-drawer" role="dialog" aria-label="User details">
        <div className="la-drawer-header">
          <h3>User Details</h3>
          <button type="button" className="la-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading && <div className="la-drawer-loading">Loading…</div>}
        {error && <div className="la-error">{error}</div>}

        {data && !loading && (
          <div className="la-drawer-body">
            {/* Profile */}
            <div className="la-drawer-profile">
              <span className="la-avatar la-avatar-lg">{initials(data.name)}</span>
              <div>
                <div className="la-drawer-name">{data.name}</div>
                <div className="la-drawer-meta">
                  {data.role}{data.designation ? ` · ${data.designation}` : ""}
                  {data.team ? ` · ${data.team}` : ""}
                </div>
                <div className="la-drawer-meta">{data.email}</div>
              </div>
              <span className={`la-badge ${data.activeSessions?.length ? "la-badge-success" : "la-badge-muted"}`}>
                {data.activeSessions?.length ? "Online" : "Offline"}
              </span>
            </div>

            {/* Stats */}
            <div className="la-drawer-stats">
              <div><span className="la-drawer-stat-label">Total Logins</span><span>{data.totalLoginCount}</span></div>
              <div><span className="la-drawer-stat-label">Avg Session</span><span>{fmtDuration(data.avgSessionDurationSec)}</span></div>
              <div><span className="la-drawer-stat-label">Latest Device</span><span>{data.mostUsedDevice || "—"}</span></div>
              <div><span className="la-drawer-stat-label">Latest Browser</span><span>{data.mostUsedBrowser || "—"}</span></div>
              <div><span className="la-drawer-stat-label">Latest Location</span><span>{data.mostUsedLocation || "—"}</span></div>
            </div>

            {/* Active sessions */}
            <div className="la-drawer-section">
              <div className="la-drawer-section-head">
                <h4>Active sessions ({data.activeSessions?.length || 0})</h4>
                {data.activeSessions?.length > 0 && (
                  <button type="button" className="la-btn la-btn-danger la-btn-sm"
                          onClick={signOutAll} disabled={working}>
                    Sign out all devices
                  </button>
                )}
              </div>
              {(data.activeSessions || []).map((s) => (
                <div key={s.id} className="la-drawer-session">
                  <span className="la-session-limit-icon">{DEVICE_ICON[s.deviceType] || "💻"}</span>
                  <div className="la-drawer-session-info">
                    <div>
                      {s.browser} · {s.operatingSystem}
                      {s.currentSession && <span className="la-badge la-badge-info">This device</span>}
                    </div>
                    <div className="la-drawer-meta">
                      {s.city ? `${s.city} · ` : ""}{s.ipAddress} · since {fmtWhen(s.loginAt)}
                    </div>
                  </div>
                  <button type="button" className="la-btn la-btn-secondary la-btn-sm"
                          onClick={() => terminate(s.id)} disabled={working || s.currentSession}>
                    Terminate
                  </button>
                </div>
              ))}
              {!data.activeSessions?.length && <div className="la-drawer-meta">No active sessions</div>}
            </div>

            {/* Recent logins */}
            <div className="la-drawer-section">
              <h4>Recent logins</h4>
              <div className="la-drawer-scroll-list">
              {(data.recentLogins || []).map((h) => (
                <div key={h.id} className="la-drawer-login-row">
                  <span className={`la-dot ${h.loginStatus === "SUCCESS" ? "la-dot-success" : "la-dot-danger"}`}></span>
                  <span className="la-drawer-login-time">{fmtWhen(h.loginAt)}</span>
                  <span className="la-drawer-meta">
                    {h.deviceType || "—"} · {h.browser || "—"}{h.city ? ` · ${h.city}` : ""}
                  </span>
                  <span className="la-drawer-meta">{fmtDuration(h.sessionDurationSec)}</span>
                </div>
              ))}
              {!data.recentLogins?.length && <div className="la-drawer-meta">No logins recorded yet</div>}
              </div>
            </div>

            {/* Recent activities */}
            <div className="la-drawer-section">
              <h4>Recent activities</h4>
              <div className="la-drawer-scroll-list">
              {(data.recentActivities || []).map((a) => (
                <div key={a.id} className="la-drawer-activity-row">
                  <span className={`la-dot ${a.status === "SUCCESS" ? "la-dot-success" : "la-dot-danger"}`}></span>
                  <div>
                    <div>{a.description || `${a.module} · ${a.operation}`}</div>
                    <div className="la-drawer-meta">
                      {a.module} · {a.operation} · {fmtWhen(a.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
              {!data.recentActivities?.length && <div className="la-drawer-meta">No activities recorded yet</div>}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Project-standard confirmation modal + toasts */}
      <ConfirmationModal {...confirmModal} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
