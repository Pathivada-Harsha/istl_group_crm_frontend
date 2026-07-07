// src/hooks/useActivityTracker.js
// LOGIN ACTIVITY MODULE — records page views for the activity timeline.
// Mounted once inside the authenticated app shell (see App.js). Buffers
// route changes and flushes them in one batched call every 10 seconds,
// so navigation adds zero latency to the UI.

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { loginActivityApi } from "../services/loginActivityApi";

const FLUSH_MS = 10_000;

// Maps a route prefix to the module name stored in the audit log
const MODULE_BY_PREFIX = [
  ["/dashboard", "DASHBOARD"],
  ["/sales", "LEADS"],
  ["/follow-ups", "LEADS"],
  ["/proposals", "PROPOSALS"],
  ["/procurement", "PROCUREMENT"],
  ["/invoices", "INVOICES"],
  ["/reports", "REPORTS"],
  ["/analytics", "REPORTS"],
  ["/users", "USERS"],
  ["/officeuse", "OFFICE_USE"],
  ["/profile", "PROFILE"],
  ["/inventory", "INVENTORY"],
  ["/documents", "DOCUMENTS"],
  ["/taskmanagement", "TASKS"],
];

function moduleFor(pathname) {
  const hit = MODULE_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  return hit ? hit[1] : "NAVIGATION";
}

export function useActivityTracker(isAuthenticated) {
  const location = useLocation();
  const bufferRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const path = location.pathname;
    if (path === "/" || path === "/login") return;

    bufferRef.current.push({ page: path, module: moduleFor(path) });

    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        const events = bufferRef.current.splice(0);
        timerRef.current = null;
        if (events.length) {
          loginActivityApi.track(events).catch(() => { /* tracking is best-effort */ });
        }
      }, FLUSH_MS);
    }
  }, [location.pathname, isAuthenticated]);

  // Flush whatever is left when the tab closes
  useEffect(() => {
    const onHide = () => {
      const events = bufferRef.current.splice(0);
      if (!events.length) return;
      try {
        navigator.sendBeacon?.(
          `${process.env.REACT_APP_API_URL}/office-use/login-activity/track`,
          new Blob([JSON.stringify(events)], { type: "application/json" })
        );
      } catch { /* ignore */ }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);
}
