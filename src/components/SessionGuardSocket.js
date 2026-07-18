// src/components/SessionGuardSocket.js
// LOGIN ACTIVITY MODULE — real-time force-logout guard.
//
// Listens on /user/queue/session-events (same STOMP/SockJS endpoint the
// notification module uses). The backend publishes SESSION_TERMINATED
// whenever a session is EVICTED (login-page eviction), ADMIN_TERMINATED
// (remote sign-out from Profile / Login Activity / admin monitor) or
// EXPIRED (idle-timeout sweep).
//
// Every open browser of the user receives the event; only the browser whose
// own sessionRowId (fetched once from GET /session/whoami) matches the
// payload logs itself out IMMEDIATELY and redirects to /login — no waiting
// for the next API call to be rejected by the SessionFilter.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client as StompClient } from "@stomp/stompjs";
import { useAuth } from "../hooks/useAuth";

const BASE_URL = process.env.REACT_APP_API_URL;
const WS_URL = `${BASE_URL}/ws-notifications`;
const SESSION_QUEUE = "/user/queue/session-events";

export default function SessionGuardSocket() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const mySessionRowIdRef = useRef(null);
  const kickedRef = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    kickedRef.current = false;

    // ── Learn this browser's own session registry row id ────────────────
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/session/whoami`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.sessionRowId != null) {
          mySessionRowIdRef.current = Number(data.sessionRowId);
        }
      } catch {
        /* best-effort — SessionFilter still enforces on next API call */
      }
    })();

    // ── Kick handler ─────────────────────────────────────────────────────
    const forceLogout = (message) => {
      if (kickedRef.current) return;
      kickedRef.current = true;
      try {
        sessionStorage.setItem(
          "la_logout_reason",
          message || "You were signed out from this device."
        );
      } catch { /* ignore */ }
      try { logout(); } catch { /* ignore */ }
      navigate("/login", { replace: true });
    };

    const onSessionEvent = (msg) => {
      try {
        const data = JSON.parse(msg.body);
        if (data?.type !== "SESSION_TERMINATED") return;
        const target = Number(data.sessionRowId);
        const mine = mySessionRowIdRef.current;
        // Only react when THIS browser's session is the terminated one.
        if (mine != null && target === mine) {
          forceLogout(data.message);
        }
      } catch (e) {
        console.error("Bad session event payload", e);
      }
    };

    // ── STOMP over SockJS (same endpoint as notifications) ───────────────
    const client = new StompClient({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => client.subscribe(SESSION_QUEUE, onSessionEvent),
      onStompError: (frame) =>
        console.error("Session guard STOMP error", frame?.headers?.message),
    });
    client.activate();

    return () => {
      cancelled = true;
      try { client.deactivate(); } catch { /* ignore */ }
    };
  }, [userId, logout, navigate]);

  return null; // invisible guard component
}