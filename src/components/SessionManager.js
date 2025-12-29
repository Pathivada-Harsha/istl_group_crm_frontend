import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const IDLE_LIMIT = 14 * 60 * 1000; // 14 minutes
const COUNTDOWN_TIME = 60;        // 1 minute

export default function SessionManager() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();

  const lastActivityRef = useRef(Date.now());
  const countdownRef = useRef(null);

  const [showPopup, setShowPopup] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_TIME);

  // 1️⃣ Track user activity
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    ["click", "keydown", "scroll"].forEach(e =>
      window.addEventListener(e, updateActivity)
    );

    return () =>
      ["click", "keydown", "scroll"].forEach(e =>
        window.removeEventListener(e, updateActivity)
      );
  }, []);

  // 2️⃣ Idle detection
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;

      if (idleTime >= IDLE_LIMIT && !showPopup) {
        setShowPopup(true);
        startCountdown();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, showPopup]);

  // 3️⃣ Countdown logic
  const startCountdown = () => {
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev === 1) {
          handleLogout();
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 4️⃣ Keep login (extend backend session)
  const keepLogin = async () => {
    await fetch("http://localhost:8080/login/session/keep-alive", {
      method: "POST",
      credentials: "include"
    });

    clearInterval(countdownRef.current);
    setSecondsLeft(COUNTDOWN_TIME);
    setShowPopup(false);
    lastActivityRef.current = Date.now();
  };

  // 5️⃣ Logout
  const handleLogout = async () => {
    clearInterval(countdownRef.current);
    await logout();
    navigate("/login", { replace: true });
  };

  if (!showPopup || !isAuthenticated) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>Session Expiring</h3>
        <p>You will be logged out in {secondsLeft} seconds</p>
        <button onClick={keepLogin}>Keep Login</button>
        <button onClick={handleLogout} style={{ marginLeft: 10 }}>
          Logout
        </button>
      </div>
    </div>
  );
}

/* simple styles */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const modal = {
  background: "#fff",
  padding: "20px",
  borderRadius: "6px",
  minWidth: "300px",
  textAlign: "center"
};
