import React, { useEffect } from "react";
import "../components_css/SessionTimeoutModal.css";

export default function SessionTimeoutModal({
  seconds,
  onStay,
  onLogout
}) {
  useEffect(() => {
    document.body.classList.add("session-modal-open");
    return () => {
      document.body.classList.remove("session-modal-open");
    };
  }, []);

  return (
    <div className="session-backdrop">
      <div className="session-dialog">

        <div className="session-header">
          <div className="session-icon">⚠</div>
          <h3>Session Expiring</h3>
        </div>

        <div className="session-body">
          <p className="session-text">
            Your session will expire due to inactivity in
          </p>

          <div className="session-timer">
            {seconds}s
          </div>

          <p className="session-subtext">
            Do you want to stay logged in?
          </p>
        </div>

        <div className="session-footer">
          <button
            className="session-btn session-btn-outline"
            onClick={onStay}
          >
            Stay Logged In
          </button>

          <button
            className="session-btn session-btn-danger"
            onClick={onLogout}
          >
            Logout Now
          </button>
        </div>

      </div>
    </div>
  );
}
