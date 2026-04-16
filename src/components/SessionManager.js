// src/components/SessionManager.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SessionTimeoutModal from "./SessionTimeoutModal";

export default function SessionManager() {
  const { logout, sessionTimeout, warningTime } = useAuth();
  const navigate = useNavigate();

  const SESSION_LIMIT = sessionTimeout || 15 * 60; // seconds (900)
  const WARNING_AT    = warningTime    || 60;       // seconds (60)

  const [secondsLeft, setSecondsLeft] = useState(SESSION_LIMIT);
  const [showPopup,   setShowPopup]   = useState(false);

  // ── Refs — survive re-renders, safe across async boundaries ───────────────
  const isPingingRef      = useRef(false);      // true while "Stay" ping is in-flight
  const hasLoggedOutRef   = useRef(false);      // prevents double-logout
  const showPopupRef      = useRef(false);      // mirrors showPopup for event listeners
  const lastServerSyncRef = useRef(Date.now()); // last time we successfully pinged server

  // ─────────────────────────────────────────────────────────────────────────
  //  THE BUG (original code):
  //    handleActivity() called resetTimer() which only reset the FRONTEND
  //    counter. The SERVER session was never touched during activity. So the
  //    server session could silently expire after 15 min of real inactivity
  //    even while the user was moving the mouse. When the popup appeared and
  //    the user clicked "Stay", the ping got a 401 and triggered logout.
  //
  //  THE FIX:
  //    On user activity, also throttle-ping the server (at most once per
  //    SERVER_SYNC_INTERVAL). This keeps BOTH timers in sync.
  // ─────────────────────────────────────────────────────────────────────────

  // How often (ms) to ping server on activity.
  // Must be < (SESSION_LIMIT - WARNING_AT) seconds so session never expires
  // before the warning has a chance to show and the user can click Stay.
  // Using half the idle window: (900-60)/2 = 420s = 7 min, capped at 5 min max.
  const SERVER_SYNC_MS = Math.min(
    5 * 60 * 1000,                               // hard cap: 5 minutes
    Math.floor((SESSION_LIMIT - WARNING_AT) / 2) * 1000
  );

  // Keep showPopupRef in sync with state
  useEffect(() => {
    showPopupRef.current = showPopup;
  }, [showPopup]);

  // ── Stable logout ─────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    if (hasLoggedOutRef.current) return;
    hasLoggedOutRef.current = true;
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  // ── Reset client-side countdown ───────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setSecondsLeft(SESSION_LIMIT);
    setShowPopup(false);
    showPopupRef.current = false;
  }, [SESSION_LIMIT]);

  // ── Activity listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];

    const handleActivity = () => {
      if (showPopupRef.current) return; // don't interfere while popup is open

      // 1. Always reset the frontend countdown on activity
      resetTimer();

      // 2. ✅ FIX: Also ping the server (throttled) so server session stays alive.
      //    Without this, the server session expires after 15 min of real inactivity
      //    even when the user is actively moving the mouse / typing.
      const now = Date.now();
      if (now - lastServerSyncRef.current > SERVER_SYNC_MS) {
        lastServerSyncRef.current = now; // mark immediately to prevent burst

        fetch(`${process.env.REACT_APP_API_URL}/login/ping`, {
          method: "GET",
          credentials: "include",
        })
          .then((res) => {
            if (!res.ok) {
              // Server session already expired — log out immediately
              handleLogout();
            } else {
              lastServerSyncRef.current = Date.now();
            }
          })
          .catch(() => handleLogout()); // network error → treat as expired
      }
    };

    events.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true })
    );
    return () =>
      events.forEach((e) => window.removeEventListener(e, handleActivity));
  }, [resetTimer, handleLogout, SERVER_SYNC_MS]);

  // ── Countdown tick (runs once) ────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Show warning popup + auto-logout at 0 ────────────────────────────────
 // ── Show warning popup + auto-logout at 0 ────────────────────────────────
  useEffect(() => {
    if (secondsLeft === WARNING_AT && !showPopup) {
      setShowPopup(true);
      showPopupRef.current = true;
    }

    if (secondsLeft <= 0 && !isPingingRef.current) {
      if (showPopupRef.current) {
       
        const tid = setTimeout(() => {
          if (!isPingingRef.current && !hasLoggedOutRef.current) {
            handleLogout();
          }
        }, 1500);
        return () => clearTimeout(tid);
      }
      handleLogout();
    }
  }, [secondsLeft, showPopup, WARNING_AT, handleLogout]);
  // ── Listen for backend session-expired event ──────────────────────────────
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, [handleLogout]);

  // ── "Stay Logged In" button handler ──────────────────────────────────────
  const handleStayActive = async () => {
    if (isPingingRef.current) return; // debounce double-clicks
    isPingingRef.current = true;

    // Optimistic reset — immediately hides modal and resets counter so the
    // countdown cannot hit 0 while the async ping is in-flight
    resetTimer();

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/login/ping`,
        { method: "GET", credentials: "include" }
      );

      if (!response.ok) {
        // Server session is genuinely expired — log out
        handleLogout();
      } else {
        // Server confirmed alive — update last sync time
        lastServerSyncRef.current = Date.now();
      }
    } catch (err) {
      console.error("Ping failed:", err);
      handleLogout();
    } finally {
      isPingingRef.current = false;
    }
  };

  return (
    <>
      {showPopup && (
        <SessionTimeoutModal
          seconds={secondsLeft}
          onStay={handleStayActive}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}