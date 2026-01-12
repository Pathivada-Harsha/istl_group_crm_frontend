import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import SessionTimeoutModal from "./SessionTimeoutModal";

export default function SessionManager() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const SESSION_LIMIT = 15 * 60; // ⏱ 15 minutes
  const WARNING_AT = 60;// ⚠ show popup at 60s

  const [secondsLeft, setSecondsLeft] = useState(SESSION_LIMIT);
  const [showPopup, setShowPopup] = useState(false);

  /* ⏱ Countdown timer */
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /* ⚠ Trigger modal + auto logout */
  useEffect(() => {
    if (secondsLeft === WARNING_AT) {
      setShowPopup(true);
    }

    if (secondsLeft <= 0) {
      handleLogout();
    }
  }, [secondsLeft]);

  /* 🔔 Backend session expired */
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);

  /* ✅ Stay logged in */
 const handleStayActive = async () => {
  try {
    await fetch(`${process.env.REACT_APP_API_URL}/login/ping`, {
      method: "GET",
      credentials: "include"
    });

    // ✅ backend session refreshed
    setShowPopup(false);
    setSecondsLeft(SESSION_LIMIT);
  } catch (err) {
    // If ping fails → force logout
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
