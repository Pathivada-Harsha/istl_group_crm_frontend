import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SessionTimeoutModal from "./SessionTimeoutModal";

export default function SessionManager() {
  const { logout, sessionTimeout, warningTime } = useAuth();
  const navigate = useNavigate();

  const SESSION_LIMIT = sessionTimeout || 15 * 60;
  const WARNING_AT = warningTime || 60;

  const [secondsLeft, setSecondsLeft] = useState(SESSION_LIMIT);
  const [showPopup, setShowPopup] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const isStayingActiveRef = useRef(false); // 🔒 Race condition guard

  useEffect(() => {
    setSecondsLeft(SESSION_LIMIT);
  }, [SESSION_LIMIT]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(SESSION_LIMIT);
    setShowPopup(false);
  }, [SESSION_LIMIT]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      if (!showPopup || secondsLeft > WARNING_AT) {
        resetTimer();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, showPopup, secondsLeft, WARNING_AT]);

  /* ⏱ Countdown timer */
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []); // ← Empty deps: interval always runs cleanly

  /* ⚠ Trigger modal + auto logout */
  useEffect(() => {
    if (secondsLeft === WARNING_AT && !showPopup) {
      setShowPopup(true);
    }

    if (secondsLeft <= 0 && !isStayingActiveRef.current) { // ← Guard added
      handleLogout();
    }
  }, [secondsLeft, showPopup, WARNING_AT]);

  /* 🔔 Backend session expired */
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);

  /* ✅ Stay logged in */
  const handleStayActive = async () => {
    isStayingActiveRef.current = true; // 🔒 Block auto-logout during ping
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/login/ping`, {
        method: "GET",
        credentials: "include"
      });

      if (response.ok) {
        resetTimer();
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error("Ping failed:", err);
      handleLogout();
    } finally {
      isStayingActiveRef.current = false; // 🔓 Unblock after ping completes
    }
  };

  /* ❌ Logout */
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
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