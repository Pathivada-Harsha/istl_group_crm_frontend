// src/components/SessionManager.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SessionTimeoutModal from "./SessionTimeoutModal";

/**
 * SessionManager
 * --------------------------------------------------------------------------
 * WHY THE OLD CODE FAILED ON THE SERVER (but worked locally):
 *
 *  1. The countdown was driven by a decrementing setInterval counter.
 *     Browsers THROTTLE / FREEZE setInterval in background or inactive tabs,
 *     so the client's idea of "idle time" ran slower than real time, while the
 *     Tomcat session expired on real wall-clock time (server.servlet.session
 *     .timeout=15m). The two clocks drifted apart.
 *
 *  2. The server was only pinged on user activity, throttled to once every
 *     5 minutes — so the server's lastAccessedTime lagged the client by
 *     minutes. By the time the warning popup appeared and the user clicked
 *     "Stay Logged In", the server session had ALREADY expired, the ping
 *     returned 401, and the click logged the user out.
 *
 *     Locally this was hidden because testing happens with a focused tab and a
 *     fresh login, so both clocks stayed aligned.
 *
 * THE FIX:
 *   - Idle time is measured from REAL timestamps (Date.now()), so it is
 *     immune to background-tab timer throttling.
 *   - A lightweight HEARTBEAT keeps the server session alive while the tab is
 *     open, so the server never expires before the client decides to. The
 *     client is the single source of truth for the inactivity policy.
 *   - "Stay Logged In" only logs out on a DEFINITIVE 401/403, retries once on
 *     a transient network error, and never ejects the user on a blip.
 * --------------------------------------------------------------------------
 */
export default function SessionManager() {
  const { logout, sessionTimeout, warningTime } = useAuth();
  const navigate = useNavigate();

  const SESSION_LIMIT = sessionTimeout || 15 * 60; // seconds (e.g. 900)
  const WARNING_AT    = warningTime    || 60;      // seconds (e.g. 60)

  // How often (ms) to ping the server to keep its session alive.
  // Must be comfortably smaller than SESSION_LIMIT so the server session is
  // always fresh when the user clicks "Stay Logged In". 60s is plenty and
  // survives background-tab timer throttling (which caps at ~1/min).
  const HEARTBEAT_MS = Math.min(60 * 1000, Math.floor((SESSION_LIMIT * 1000) / 3));

  const PING_URL = `${process.env.REACT_APP_API_URL}/login/ping`;

  const [secondsLeft, setSecondsLeft] = useState(SESSION_LIMIT);
  const [showPopup,   setShowPopup]   = useState(false);

  // ── Refs — survive re-renders, safe across async boundaries ───────────────
  const lastActivityRef   = useRef(Date.now()); // wall-clock time of last user activity
  const lastPingRef       = useRef(Date.now()); // wall-clock time of last successful server ping
  const isPingingRef      = useRef(false);      // a "Stay" ping is in-flight
  const hasLoggedOutRef   = useRef(false);      // prevents double-logout
  const showPopupRef      = useRef(false);      // mirrors showPopup for event listeners

  // ── Stable logout ─────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    if (hasLoggedOutRef.current) return;
    hasLoggedOutRef.current = true;
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  // ── Low-level ping helper ──────────────────────────────────────────────────
  // Returns the HTTP status number, or null on a network/transport error.
  const pingServer = useCallback(async () => {
    try {
      const res = await fetch(PING_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      return res.status;
    } catch {
      return null; // network blip / offline — NOT a session expiry
    }
  }, [PING_URL]);

  // ── Reset the inactivity window (treat "now" as the latest activity) ───────
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(SESSION_LIMIT);
    setShowPopup(false);
    showPopupRef.current = false;
  }, [SESSION_LIMIT]);

  // ── Track user activity via timestamps (no per-event re-render storm) ──────
  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];

    const handleActivity = () => {
      // Once the warning is showing, require an explicit choice — stray events
      // must not silently dismiss it.
      if (showPopupRef.current) return;
      lastActivityRef.current = Date.now();
    };

    events.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true })
    );
    return () =>
      events.forEach((e) => window.removeEventListener(e, handleActivity));
  }, []);

  // ── When the tab becomes visible again, force an immediate server re-check ─
  // Background tabs may have been frozen; re-validate as soon as we're back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !hasLoggedOutRef.current) {
        lastPingRef.current = 0; // force the next tick to send a heartbeat
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // ── Master tick: timestamp-based countdown + heartbeat + warning + logout ──
  useEffect(() => {
    const tick = () => {
      if (hasLoggedOutRef.current) return;

      const now    = Date.now();
      const idleMs = now - lastActivityRef.current;
      const left   = Math.max(0, Math.ceil(SESSION_LIMIT - idleMs / 1000));

      setSecondsLeft(left);

      // 1. Heartbeat: keep the server session alive so it never expires before
      //    the client does. Skipped while a "Stay" ping is already in-flight.
      if (!isPingingRef.current && now - lastPingRef.current >= HEARTBEAT_MS) {
        lastPingRef.current = now; // mark immediately to avoid bursts
        pingServer().then((status) => {
          if (status === 401 || status === 403) {
            handleLogout();        // server session is genuinely gone
          } else if (status != null) {
            lastPingRef.current = Date.now();
          }
          // network error (null) → ignore; we'll retry on the next heartbeat
        });
      }

      // 2. Show the warning popup in the final WARNING_AT seconds.
      if (left <= WARNING_AT && left > 0 && !showPopupRef.current) {
        showPopupRef.current = true;
        setShowPopup(true);
      }

      // 3. Auto-logout when the inactivity window is fully elapsed.
      if (left <= 0) {
        handleLogout();
      }
    };

    const id = setInterval(tick, 1000);
    tick(); // run once immediately
    return () => clearInterval(id);
  }, [SESSION_LIMIT, WARNING_AT, HEARTBEAT_MS, pingServer, handleLogout]);

  // ── Listen for backend session-expired event (fired by fetch interceptor) ──
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, [handleLogout]);

  // ── "Stay Logged In" button handler ───────────────────────────────────────
  const handleStayActive = async () => {
    if (isPingingRef.current) return; // debounce double-clicks
    isPingingRef.current = true;

    // Optimistic reset — hide the modal and restart the counter immediately so
    // the countdown cannot reach 0 while the async ping is in flight.
    resetActivity();

    try {
      let status = await pingServer();

      // Retry ONCE on a transient network error before giving up.
      if (status == null) {
        await new Promise((r) => setTimeout(r, 1000));
        status = await pingServer();
      }

      if (status === 401 || status === 403) {
        // Session is genuinely expired on the server — we cannot revive it
        // without re-authenticating, so log out.
        handleLogout();
      } else {
        // 200 (alive) OR still a network error → keep the user logged in.
        // A real expiry would surface as a 401 on the next actual API call,
        // which the fetch interceptor handles. We never eject on a blip.
        lastPingRef.current = Date.now();
        lastActivityRef.current = Date.now();
      }
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