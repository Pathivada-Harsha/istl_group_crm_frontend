// src/Pages/Login.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AiOutlineEye, AiOutlineEyeInvisible, AiOutlineUser, AiOutlineLock } from "react-icons/ai";
import "../pages-css/Login.css";
import ThemeToggle from "../components/ThemeToggle";
import heroDesktop from "../images/logo.png";
import heroMobile from "../images/logo.png";
// ── LOGIN ACTIVITY MODULE ──────────────────────────────────────────────
import { collectClientContext, reportGeoWhenAvailable } from "../utils/clientContext";
import SessionLimitDialog from "../components/LoginActivity/SessionLimitDialog";
// ───────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.REACT_APP_API_URL;
const FP_OTP_KEY = "fp_otp";
const FP_IDENTIFIER_KEY = "fp_identifier";
const RESEND_SECONDS = 30;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading } = useAuth();

  // ── Login form state ──────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── LOGIN ACTIVITY MODULE state ───────────────────────────────────────
  // limitSessions !== null → the "Maximum Active Sessions Reached" dialog
  // is open, showing the user's currently active sessions.
  const [limitSessions, setLimitSessions] = useState(null);
  const [forceSubmitting, setForceSubmitting] = useState(false);
  // Message shown when this device was signed out remotely (evicted /
  // terminated by an admin) — written by setupFetchInterceptor.
  const [signOutNotice, setSignOutNotice] = useState("");

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem("la_logout_reason");
      if (notice) {
        setSignOutNotice(notice);
        sessionStorage.removeItem("la_logout_reason");
      }
    } catch { /* ignore */ }
  }, []);
  // ───────────────────────────────────────────────────────────────────────

  // ── Forgot-password modal state ───────────────────────────────────────────
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStep, setFpStep] = useState(1);       // 1 | 2 | 3
  const [fpIdentifier, setFpIdentifier] = useState("");
  const [fpMaskedEmail, setFpMaskedEmail] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPwd, setFpNewPwd] = useState("");
  const [fpConfirmPwd, setFpConfirmPwd] = useState("");
  const [fpShowNew, setFpShowNew] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpSuccess, setFpSuccess] = useState("");
  const [fpLoading, setFpLoading] = useState(false);

  // Login page follows the saved theme (managed by ThemeProvider):
  // first-ever visit defaults to light, otherwise it uses the user's last
  // choice persisted in localStorage. No override is applied here.

  // Resend timer
  const [fpTimer, setFpTimer] = useState(0);
  const [fpResendActive, setFpResendActive] = useState(false);
  const timerRef = useRef(null);

  // ── Redirect if already authenticated ────────────────────────────────────
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate, location]);

  // ── Resend countdown timer ────────────────────────────────────────────────
  useEffect(() => {
    if (fpResendActive && fpTimer > 0) {
      timerRef.current = setInterval(() => {
        setFpTimer((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            setFpResendActive(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [fpResendActive]);

  // ── Clean up localStorage when modal closes ───────────────────────────────
  const closeFpModal = () => {
    setFpOpen(false);
    setFpStep(1);
    setFpIdentifier("");
    setFpMaskedEmail("");
    setFpOtp("");
    setFpNewPwd("");
    setFpConfirmPwd("");
    setFpError("");
    setFpSuccess("");
    setFpLoading(false);
    setFpTimer(0);
    setFpResendActive(false);
    clearInterval(timerRef.current);
    localStorage.removeItem(FP_OTP_KEY);
    localStorage.removeItem(FP_IDENTIFIER_KEY);
  };

  // ── START resend timer ────────────────────────────────────────────────────
  const startResendTimer = () => {
    setFpTimer(RESEND_SECONDS);
    setFpResendActive(true);
  };

  // ── STEP 1: Verify user & send OTP ───────────────────────────────────────
  const handleFpVerify = async (e) => {
    e.preventDefault();
    setFpError("");
    if (!fpIdentifier.trim()) {
      setFpError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fpIdentifier.trim())) {
      setFpError("Please enter a valid email address.");
      return;
    }
    setFpLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login/forgot-password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: fpIdentifier.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Store OTP and identifier in localStorage for validation
        localStorage.setItem(FP_OTP_KEY, data.otp);
        localStorage.setItem(FP_IDENTIFIER_KEY, fpIdentifier.trim());
        setFpMaskedEmail(data.maskedEmail || "");
        setFpStep(2);
        startResendTimer();
      } else {
        setFpError(data.message || "User not found. Please check your input.");
      }
    } catch {
      setFpError("Network error. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  // ── STEP 2: Resend OTP ────────────────────────────────────────────────────
  const handleFpResend = async () => {
    if (fpResendActive) return;
    setFpError("");
    setFpLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login/forgot-password/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: fpIdentifier.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem(FP_OTP_KEY, data.otp);
        setFpOtp("");
        startResendTimer();
        setFpSuccess("A new code has been sent to " + (data.maskedEmail || fpMaskedEmail));
        setTimeout(() => setFpSuccess(""), 4000);
      } else {
        setFpError(data.message || "Failed to resend code. Please try again.");
      }
    } catch {
      setFpError("Network error. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  // ── STEP 2: Validate OTP ──────────────────────────────────────────────────
  const handleFpOtpVerify = (e) => {
    e.preventDefault();
    setFpError("");
    if (!fpOtp.trim()) {
      setFpError("Please enter the 6-digit code.");
      return;
    }
    const storedOtp = localStorage.getItem(FP_OTP_KEY);
    if (!storedOtp) {
      setFpError("Session expired. Please start over.");
      setFpStep(1);
      return;
    }
    if (fpOtp.trim() !== storedOtp) {
      setFpError("Invalid code. Please check and try again.");
      return;
    }
    // OTP matched — proceed to new password step
    setFpStep(3);
    setFpError("");
  };

  // ── STEP 3: Reset password ────────────────────────────────────────────────
  const handleFpReset = async (e) => {
    e.preventDefault();
    setFpError("");

    if (!fpNewPwd || !fpConfirmPwd) {
      setFpError("Please fill in both password fields.");
      return;
    }
    if (fpNewPwd.length < 6) {
      const pwdRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,}$/;
      if (!pwdRegex.test(fpNewPwd)) {
        setFpError("Password must be at least 6 characters, include 1 uppercase letter and 1 special character.");
        return;
      }
    }
      if (fpNewPwd !== fpConfirmPwd) {
        setFpError("Passwords do not match.");
        return;
      }

      const identifier = localStorage.getItem(FP_IDENTIFIER_KEY) || fpIdentifier.trim();
      setFpLoading(true);

      try {
        const res = await fetch(`${API_BASE_URL}/login/forgot-password/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, newPassword: fpNewPwd }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          // Clean up and show success
          localStorage.removeItem(FP_OTP_KEY);
          localStorage.removeItem(FP_IDENTIFIER_KEY);
          setFpSuccess("Password reset successfully! You can now log in.");
          setTimeout(() => closeFpModal(), 2500);
        } else {
          setFpError(data.message || "Failed to reset password. Please try again.");
        }
      } catch {
        setFpError("Network error. Please try again.");
      } finally {
        setFpLoading(false);
      }
    };

    // ── LOGIN submit ──────────────────────────────────────────────────────────
    // LOGIN ACTIVITY MODULE: sends device/location context with the
    // credentials and handles 409 SESSION_LIMIT_REACHED (two-device limit).
    async function doLogin(mode) {
      // mode: undefined/false → normal attempt; 'force' → evict oldest; 'all' → logout everywhere
      try {
        // Device, browser, screen, timezone and (if already permitted)
        // location — collected once, never blocks login on failure.
        const clientContext = await collectClientContext();

        const response = await fetch(`${API_BASE_URL}/login/userLogin`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
            ...clientContext,
            ...(mode === 'force' ? { forceLogin: "true" } : {}),
            ...(mode === 'all' ? { logoutAllDevices: "true" } : {}),
          }),
        });

        let data = null;
        try {
          data = await response.json();
        } catch {
          setError("Server error. Please try again or contact support.");
          return;
        }

        if (response.ok) {
          if (!data || !data.user || !data.menuPermissions) {
            setError("Login response is invalid. Please contact support.");
            return;
          }
          setLimitSessions(null);
          login(data);
          // If the location permission popup is still open (or positioning
          // was slow), report coordinates in the background once available.
          reportGeoWhenAvailable();
          navigate("/dashboard", { replace: true });
        } else if (response.status === 409 && data?.error === "SESSION_LIMIT_REACHED") {
          // Two devices already active — show the professional warning dialog
          setLimitSessions(data.sessions || []);
        } else {
          setLimitSessions(null);
          setError(data?.message || data?.error || "Login failed. Please try again.");
        }
      } catch (err) {
        if (!navigator.onLine) {
          setError("No internet connection. Please check your network.");
        } else {
          setError("Unable to connect to server. Please try again.");
        }
      }
    }

    async function handleSubmit(e) {
      e.preventDefault();
      setError("");
      setSignOutNotice("");

      if (!username || !password) {
        setError("Please enter username and password.");
        return;
      }

      setSubmitting(true);
      try {
        await doLogin(false);
      } finally {
        setSubmitting(false);
      }
    }

    // "Continue Login" in the session-limit dialog — retries with the flag;
    // the backend then evicts the oldest session automatically.
    async function handleForceLogin() {
      setForceSubmitting(true);
      try {
        await doLogin('force');
      } finally {
        setForceSubmitting(false);
      }
    }

    // "Logout from all devices" — signs out every active session, then logs in here.
    async function handleLogoutAllLogin() {
      setForceSubmitting(true);
      try {
        await doLogin('all');
      } finally {
        setForceSubmitting(false);
      }
    }

    if (loading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "18px", color: "#666" }}>
          Loading...
        </div>
      );
    }

    if (isAuthenticated) return null;

    // ── Step labels ───────────────────────────────────────────────────────────
    const stepTitle = ["", "Forgot Password", "Enter OTP", "Reset Password"][fpStep];
    const stepSub = [
      "",
      "Enter your registered email address",
      `We sent a 6-digit code to ${fpMaskedEmail || "your registered email"}`,
      "Choose a strong new password",
    ][fpStep];

    return (
      <>
        {/* ══════════════════ LOGIN PAGE ══════════════════ */}
        <div className="login-root">
          {/* Theme toggle — fixed bottom-right */}
          <div className="login-theme-toggle">
            <ThemeToggle />
          </div>
          <div className="login-container">

            {/* LEFT: hero */}
            <div className="login-hero">
              <img src={heroDesktop} alt="ISTL CRM" className="login-hero-img desktop" />
              <img src={heroMobile} alt="ISTL CRM" className="login-hero-img mobile" />
            </div>

            {/* RIGHT: form */}
            <div className="login-panel">
              <div className="login-card">
                <h2 className="login-heading">Welcome back</h2>
                <p className="login-sub">Sign in to continue to CRM Portal</p>

                <form className="login-form" onSubmit={handleSubmit}>

                  <label className="login-label">
                    Username <span className="required">*</span>
                  </label>
                  <div className="login-input-wrap" style={{ position: "relative" }}>
                    <AiOutlineUser size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input
                      className="login-input"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      disabled={submitting}
                      style={{ paddingLeft: "38px" }}
                    />
                  </div>

                  <label className="login-label">
                    Password <span className="required">*</span>
                  </label>
                  <div className="login-password-row">
                    <AiOutlineLock size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", zIndex: 1 }} />
                    <input
                      className="login-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={submitting}
                      style={{ paddingRight: "40px", paddingLeft: "38px" }}
                    />
                    <button
                      type="button"
                      className="login-showpw"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label="toggle password"
                      disabled={submitting}
                    >
                      {showPassword ? <AiOutlineEyeInvisible size={18} /> : <AiOutlineEye size={18} />}
                    </button>
                  </div>

                  <div className="login-extras">
                    <button
                      type="button"
                      className="login-forgot"
                      onClick={() => { setFpOpen(true); setFpStep(1); }}
                    >
                      Forgot Password ?
                    </button>
                  </div>

                  {signOutNotice && !error && (
                    <div className="login-error" style={{ background: "#fef3c7", color: "#92400e" }}>
                      {signOutNotice}
                    </div>
                  )}
                  {error && <div className="login-error">{error}</div>}

                  <div className="login-submit-row">
                    <button type="submit" className="login-btn" disabled={submitting}>
                      {submitting ? "Signing in..." : "Sign in"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* LOGIN ACTIVITY MODULE — Feature 2: two-device limit dialog */}
          {limitSessions !== null && (
            <SessionLimitDialog
              sessions={limitSessions}
              loading={forceSubmitting}
              onCancel={() => setLimitSessions(null)}
              onContinue={handleForceLogin}
              onLogoutAll={handleLogoutAllLogin}
            />
          )}
        </div>

        {/* ══════════════════ FORGOT PASSWORD MODAL ══════════════════ */}
        {fpOpen && (
          <div className="fp-overlay">
            <div className="fp-modal" onClick={(e) => e.stopPropagation()}>

              {/* Modal header */}
              <div className="fp-modal-header">
                <div>
                  <h3 className="fp-modal-title">{stepTitle}</h3>
                  <p className="fp-modal-sub">{stepSub}</p>
                </div>
                <button className="fp-close-btn" onClick={closeFpModal} aria-label="Close">✕</button>
              </div>

              {/* Step indicators */}
              <div className="fp-steps">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`fp-step-dot ${fpStep >= s ? "active" : ""} ${fpStep > s ? "done" : ""}`}>
                    {fpStep > s ? "✓" : s}
                  </div>
                ))}
                <div className="fp-step-line" />
              </div>

              {/* ── STEP 1: Enter username/mobile ── */}
              {fpStep === 1 && (
                <form className="fp-form" onSubmit={handleFpVerify}>
                  <label className="fp-label">Email Address</label>
                  <input
                    className="fp-input"
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={fpIdentifier}
                    onChange={(e) => setFpIdentifier(e.target.value)}
                    autoComplete="email"
                    disabled={fpLoading}
                  />
                  {fpError && <div className="fp-error">{fpError}</div>}
                  {fpSuccess && <div className="fp-success">{fpSuccess}</div>}
                  <button type="submit" className="fp-btn" disabled={fpLoading}>
                    {fpLoading ? "Verifying..." : "Send OTP"}
                  </button>
                </form>
              )}

              {/* ── STEP 2: Enter OTP ── */}
              {fpStep === 2 && (
                <form className="fp-form" onSubmit={handleFpOtpVerify}>
                  <label className="fp-label">6-Digit Code</label>
                  <input
                    className="fp-input fp-otp-input"
                    type="text"
                    placeholder="Enter the code sent to your email"
                    value={fpOtp}
                    onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    autoComplete="one-time-code"
                    disabled={fpLoading}
                  />

                  {fpError && <div className="fp-error">{fpError}</div>}
                  {fpSuccess && <div className="fp-success">{fpSuccess}</div>}

                  {/* Resend row */}
                  <div className="fp-resend-row">
                    <span className="fp-resend-text">Didn't receive the code?</span>
                    {fpResendActive ? (
                      <span className="fp-timer">Resend in {fpTimer}s</span>
                    ) : (
                      <button type="button" className="fp-resend-btn" onClick={handleFpResend} disabled={fpLoading}>
                        Resend Code
                      </button>
                    )}
                  </div>

                  <button type="submit" className="fp-btn" disabled={fpLoading || fpOtp.length !== 6}>
                    {fpLoading ? "Verifying..." : "Verify Code"}
                  </button>

                  <button type="button" className="fp-back-btn" onClick={() => { setFpStep(1); setFpError(""); setFpOtp(""); }}>
                    ← Back
                  </button>
                </form>
              )}

              {/* ── STEP 3: New password ── */}
              {fpStep === 3 && (
                <form className="fp-form" onSubmit={handleFpReset}>
                  <label className="fp-label">New Password</label>
                  <div className="fp-pwd-row">
                    <input
                      className="fp-input"
                      type={fpShowNew ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={fpNewPwd}
                      onChange={(e) => setFpNewPwd(e.target.value)}
                      disabled={fpLoading}
                      style={{ paddingRight: "40px" }}
                    />
                    <button type="button" className="fp-eye-btn" onClick={() => setFpShowNew((s) => !s)}>
                      {fpShowNew ? <AiOutlineEyeInvisible size={17} /> : <AiOutlineEye size={17} />}
                    </button>
                  </div>

                  <label className="fp-label" style={{ marginTop: "12px" }}>Confirm New Password</label>
                  <div className="fp-pwd-row">
                    <input
                      className="fp-input"
                      type={fpShowConfirm ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      value={fpConfirmPwd}
                      onChange={(e) => setFpConfirmPwd(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      disabled={fpLoading}
                      style={{ paddingRight: "40px" }}
                    />
                    <button type="button" className="fp-eye-btn" onClick={() => setFpShowConfirm((s) => !s)}>
                      {fpShowConfirm ? <AiOutlineEyeInvisible size={17} /> : <AiOutlineEye size={17} />}
                    </button>
                  </div>

                  {fpError && <div className="fp-error">{fpError}</div>}
                  {fpSuccess && <div className="fp-success">{fpSuccess}</div>}

                  <button type="submit" className="fp-btn" disabled={fpLoading}>
                    {fpLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </form>
              )}

            </div>
          </div>
        )}
      </>
    );
  }