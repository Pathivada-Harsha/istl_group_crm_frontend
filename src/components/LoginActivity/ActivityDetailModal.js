// src/components/LoginActivity/ActivityDetailModal.js
// LOGIN ACTIVITY MODULE — full details for one audit event, including the
// old → new value diff for change operations.

import React from "react";
import "../../pages-css/LoginActivityMonitor.css";

function Row({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="la-detail-row">
      <span className="la-detail-label">{label}</span>
      <span className="la-detail-value">{String(value)}</span>
    </div>
  );
}

function JsonBlock({ label, json }) {
  if (!json) return null;
  let pretty = json;
  try { pretty = JSON.stringify(JSON.parse(json), null, 2); } catch { /* keep raw */ }
  return (
    <div className="la-detail-json">
      <div className="la-detail-label">{label}</div>
      <pre>{pretty}</pre>
    </div>
  );
}

export default function ActivityDetailModal({ activity, onClose }) {
  if (!activity) return null;
  const failed = activity.status === "FAILURE";

  return (
    <div className="la-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="la-modal la-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="la-modal-header">
          <h3 className="la-modal-title">Activity Details</h3>
          <button type="button" className="la-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="la-detail-status">
          <span className={`la-badge ${failed ? "la-badge-danger" : "la-badge-success"}`}>
            {activity.status}
          </span>
          <span className="la-detail-op">{activity.module} · {activity.operation}</span>
        </div>

        <Row label="Time" value={activity.createdAt ? new Date(activity.createdAt).toLocaleString("en-IN") : ""} />
        <Row label="User" value={activity.username} />
        <Row label="Description" value={activity.description} />
        <Row label="Page" value={activity.page} />
        <Row label="Entity" value={activity.entityType ? `${activity.entityType} #${activity.entityId ?? ""}` : null} />
        {failed && <Row label="Failure reason" value={activity.failureReason} />}
        <Row label="IP address" value={activity.ipAddress} />
        <Row label="Browser" value={activity.browser} />
        <Row label="Operating system" value={activity.operatingSystem} />
        <Row label="Device" value={activity.deviceType} />
        <Row
          label="Location"
          value={activity.latitude != null && activity.longitude != null
            ? `${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}` : null}
        />
        <Row label="Session" value={activity.sessionRowId ? `#${activity.sessionRowId}` : null} />
        <Row label="Request ID" value={activity.requestId} />

        <JsonBlock label="Old value" json={activity.oldValue} />
        <JsonBlock label="New value" json={activity.newValue} />
      </div>
    </div>
  );
}
