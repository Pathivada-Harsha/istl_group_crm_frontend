import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const REDIRECT_SECONDS = 5;

const NotFound = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isAuthenticated, loading, user } = useAuth();

  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const timerRef       = useRef(null);
  const hasRedirected  = useRef(false);

  /* ── Determine redirect target once auth resolves ── */
  const redirectTarget = isAuthenticated ? '/dashboard' : '/login';
  const redirectLabel  = isAuthenticated ? 'Dashboard'  : 'Login';

  /* ── Start countdown ONLY after localStorage hydration finishes ── */
  useEffect(() => {
    if (loading) return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            navigate(redirectTarget, { replace: true });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);           // intentionally run once when loading flips to false

  /* ── Manual redirect ── */
  const handleRedirect = () => {
    clearInterval(timerRef.current);
    hasRedirected.current = true;
    navigate(redirectTarget, { replace: true });
  };

  /* ── Go back or fallback ── */
  const handleGoBack = () => {
    clearInterval(timerRef.current);
    hasRedirected.current = true;
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(redirectTarget, { replace: true });
    }
  };

  /* ── SVG ring progress ── */
  const RADIUS       = 24;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 150.8
  const dashArray    = `${(countdown / REDIRECT_SECONDS) * CIRCUMFERENCE} ${CIRCUMFERENCE}`;

  /* ────────────────────────────────────────────────────
     LOADING STATE — wait for AuthContext to hydrate
  ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.gridBg} />
        <div style={styles.spinnerWrap}>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#E2E8F0" strokeWidth="3" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#3B82F6" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="45 67"
              style={{ animation: 'spin 0.85s linear infinite', transformOrigin: 'center' }} />
          </svg>
          <span style={styles.spinnerText}>Checking session…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ────────────────────────────────────────────────────
     MAIN 404 PAGE
  ──────────────────────────────────────────────────── */
  return (
    <div style={styles.wrapper}>
      <div style={styles.gridBg} />

      <div style={styles.card}>

        {/* 404 badge */}
        <div style={styles.badge}>
          <span style={styles.badgeText}>404</span>
        </div>

        {/* Illustration */}
        <div style={styles.iconWrap}>
          <svg width="76" height="76" viewBox="0 0 76 76" fill="none">
            <circle cx="38" cy="38" r="36" stroke="#E2E8F0" strokeWidth="2" />
            <circle cx="38" cy="38" r="36" stroke="url(#g1)" strokeWidth="2"
              strokeDasharray="64 162" />
            <rect x="22" y="20" width="32" height="36" rx="4"
              fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />
            <path d="M29 30H47M29 36H42M29 42H36"
              stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
            {/* X circle */}
            <circle cx="50" cy="50" r="11" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
            <path d="M46.5 46.5L53.5 53.5M53.5 46.5L46.5 53.5"
              stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="g1" x1="2" y1="2" x2="74" y2="74"
                gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h1 style={styles.title}>Page Not Found</h1>

        <p style={styles.subtitle}>
          The path{' '}
          <code style={styles.urlCode}>{location.pathname}</code>{' '}
          doesn't exist or may have been moved.
        </p>

        {/* Auth status pill */}
        <div style={isAuthenticated ? styles.pillGreen : styles.pillOrange}>
          <span style={dot(isAuthenticated)} />
          {isAuthenticated
            ? `Signed in as ${user?.name || user?.username || 'User'}`
            : 'Not signed in — redirecting to Login'}
        </div>

        {/* Countdown ring */}
        <div style={styles.countdownWrap}>
          <svg width="56" height="56" viewBox="0 0 56 56"
            style={{ position: 'absolute', inset: 0 }}>
            <circle cx="28" cy="28" r={RADIUS}
              fill="none" stroke="#E2E8F0" strokeWidth="3" />
            <circle cx="28" cy="28" r={RADIUS}
              fill="none" stroke="#3B82F6" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dasharray 0.95s linear' }} />
          </svg>
          <span style={styles.countdownNum}>{countdown}</span>
        </div>

        <p style={styles.redirectMsg}>
          Redirecting to <strong>{redirectLabel}</strong> in {countdown}s
        </p>

        {/* Buttons */}
        <div style={styles.btnRow}>
          <button
            style={styles.btnPrimary}
            onClick={handleRedirect}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Go to {redirectLabel}
          </button>
          <button
            style={styles.btnSecondary}
            onClick={handleGoBack}
            onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}
          >
            ← Go Back
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={styles.footer}>
        <span style={styles.footerBrand}>SESOLA</span> CRM Portal
      </p>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
};

/* ────────── Helpers ────────── */

const dot = (active) => ({
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  flexShrink: 0,
  background: active ? '#22C55E' : '#F97316',
  animation: 'pulse 2s ease infinite',
});

const pillBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  borderRadius: '99px',
  padding: '5px 14px',
  fontSize: '12.5px',
  fontWeight: '500',
  marginBottom: '24px',
};

/* ────────── Styles ────────── */

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: '24px',
  },
  gridBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(148,163,184,0.13) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.13) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  spinnerWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    position: 'relative',
    zIndex: 1,
  },
  spinnerText: {
    fontSize: '13px',
    color: '#94A3B8',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '48px 40px',
    maxWidth: '440px',
    width: '100%',
    boxShadow:
      '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 40px -10px rgba(0,0,0,0.10)',
    border: '1px solid #E2E8F0',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
    animation: 'fadeUp 0.4s ease both',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #EFF6FF 0%, #EDE9FE 100%)',
    border: '1px solid #BFDBFE',
    borderRadius: '10px',
    padding: '5px 16px',
    marginBottom: '20px',
  },
  badgeText: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '2.5px',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  iconWrap: {
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0F172A',
    margin: '0 0 10px',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },
  urlCode: {
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    borderRadius: '5px',
    padding: '1px 7px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#475569',
    wordBreak: 'break-all',
  },
  pillGreen: { ...pillBase, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' },
  pillOrange: { ...pillBase, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412' },
  countdownWrap: {
    position: 'relative',
    width: '56px',
    height: '56px',
    margin: '0 auto 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNum: {
    position: 'relative',
    zIndex: 1,
    fontSize: '18px',
    fontWeight: '700',
    color: '#3B82F6',
    lineHeight: 1,
  },
  redirectMsg: {
    fontSize: '13px',
    color: '#94A3B8',
    margin: '0 0 24px',
  },
  btnRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 22px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
    transition: 'opacity 0.2s',
  },
  btnSecondary: {
    background: '#F8FAFC',
    color: '#475569',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '10px 22px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  footer: {
    marginTop: '28px',
    fontSize: '12px',
    color: '#CBD5E1',
    position: 'relative',
    zIndex: 1,
    letterSpacing: '0.5px',
  },
  footerBrand: {
    fontWeight: '700',
    letterSpacing: '2px',
    color: '#94A3B8',
  },
};

export default NotFound;