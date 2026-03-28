// src/Pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "../pages-css/Login.css";
import heroDesktop from "../images/logo.png";
import heroMobile from "../images/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, location]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/login/userLogin`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      // ✅ Try to parse JSON — catch parse errors separately
      let data = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        // Backend returned non-JSON (plain text like SESSION_EXPIRED)
        console.error("Non-JSON response from server:", parseErr);
        setError("Server error. Please try again or contact support.");
        return;
      }

      if (response.ok) {
        // ✅ Validate the response has required user data
        if (!data || !data.user || !data.menuPermissions) {
          setError("Login response is invalid. Please contact support.");
          return;
        }
        // ✅ Store user and navigate
        login(data);
        navigate('/dashboard', { replace: true });

      } else {
        // ✅ Show EXACT backend error message
        // Backend sends: { "error": "LOGIN_FAILED", "message": "Invalid Credentials" }
        // Or:            { "error": "LOGIN_FAILED", "message": "No menu permissions assigned..." }
        const errorMessage = data?.message || data?.error || "Login failed. Please try again.";
        setError(errorMessage);
      }

    } catch (err) {
      // ✅ Only reaches here if network is completely unreachable
      console.error("Login error:", err);
      if (!navigator.onLine) {
        setError("No internet connection. Please check your network.");
      } else {
        setError("Unable to connect to server. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="login-root">
      <div className="login-container">
        {/* LEFT: hero */}
        <div className="login-hero">
          <img
            src={heroDesktop}
            alt="BD Portal logo"
            className="login-hero-img desktop"
          />
          <img
            src={heroMobile}
            alt="BD Portal logo"
            className="login-hero-img mobile"
          />
        </div>

        {/* RIGHT: login form */}
        <div className="login-panel">
          <div className="login-card">
            <h2 className="login-heading">Welcome back</h2>
            <p className="login-sub">
              Sign in to continue to CRM Portal
            </p>

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-label">
                Username <span className="required">*</span>
              </label>
              <input
                className="login-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={submitting}
              />

              <label className="login-label">
                Password <span className="required">*</span>
              </label>
              <div className="login-password-row">
                <input
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-showpw"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label="toggle password"
                  disabled={submitting}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="login-extras">
                <button
                  type="button"
                  className="login-forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log("Forgot password clicked");
                  }}
                >
                  Forgot Password ?
                </button>
              </div>

              {error && <div className="login-error">{error}</div>}

              <div className="login-submit-row">
                <button
                  type="submit"
                  className="login-btn"
                  disabled={submitting}
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>
              </div>
            </form>
          </div>

          <div className="login-footer-note">
            For demo: <strong>AdminSesola</strong> /{" "}
            <strong>Admin@123</strong>
          </div>
        </div>
      </div>
    </div>
  );
}