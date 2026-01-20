import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SessionTimeoutModal from "./SessionTimeoutModal";

export default function SessionManager() {
  const { logout, sessionTimeout, warningTime } = useAuth();
  const navigate = useNavigate();

  // ✅ Use backend configuration values
  const SESSION_LIMIT = sessionTimeout || 15 * 60; // fallback to 15 minutes
  const WARNING_AT = warningTime || 60; // fallback to 60 seconds

  const [secondsLeft, setSecondsLeft] = useState(SESSION_LIMIT);
  const [showPopup, setShowPopup] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // ✅ Update timer when SESSION_LIMIT changes (when backend config loads)
  useEffect(() => {
    setSecondsLeft(SESSION_LIMIT);
  }, [SESSION_LIMIT]);

  /* 🔄 Reset timer on user activity */
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(SESSION_LIMIT);
    setShowPopup(false);
  }, [SESSION_LIMIT]);

  /* 👆 Detect user activity */
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      // Only reset if not in warning state or if user was recently active
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
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /* ⚠ Trigger modal + auto logout */
  useEffect(() => {
    if (secondsLeft === WARNING_AT && !showPopup) {
      setShowPopup(true);
    }

    if (secondsLeft <= 0) {
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
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/login/ping`, {
        method: "GET",
        credentials: "include"
      });

      if (response.ok) {
        // ✅ Backend session refreshed
        resetTimer();
      } else {
        // Session invalid on backend
        handleLogout();
      }
    } catch (err) {
      // If ping fails → force logout
      console.error("Ping failed:", err);
      handleLogout();
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