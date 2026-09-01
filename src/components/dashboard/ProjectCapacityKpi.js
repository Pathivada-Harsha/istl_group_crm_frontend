// ─────────────────────────────────────────────────────────────────────────────
// "Solar Capacity" KPI tile for the admin dashboard.
//
// CURRENTLY HIDDEN — this component is complete and working but is not mounted
// anywhere. To put it back on the dashboard, add to Pages/Dashboard.js:
//   1. import ProjectCapacityKpi from "../components/dashboard/ProjectCapacityKpi";
//   2. <ProjectCapacityKpi /> inside SuperAdminDashboard's .rd-kpi-grid
// Nothing else is needed; the tile fetches and gates itself.
//
// The admin dashboard payload carries no project capacity, so this tile reads
// the existing GET /projects/dashboard/capacity endpoint directly. That endpoint
// returns one row per sub-group, each with its OWN unit — MW for solar, but Nos
// for CCMS/street lighting, Km for lines, and so on. Adding those together would
// be meaningless, so only power units are summed and the label says "Solar" to be
// honest about what is and is not counted.
//
// Self-contained: own fetch, own state, and it renders nothing at all on any
// failure so it can never blank out the dashboard (which replaces the whole page
// with an error screen when its own fetch fails).
//
// Renders as a fragment-free single tile that sits directly in the dashboard's
// existing .rd-kpi-grid. It re-declares the .rd-kpi-card markup because
// Dashboard.js's KpiCard is module-local and not exported; the dashboard CSS is
// consumed, never modified.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import '../../pages-css/Dashboard.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const USER_KEY = 'bd_portal_user';

const ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN'];

/** Where the full per-sub-group capacity breakdown lives. */
const PROJECTS_PATH = '/project-over-view';

/** Only power units roll up into a capacity total; everything else is skipped. */
const UNIT_TO_MW = { mw: 1, mwp: 1, kw: 0.001, kwp: 0.001 };

// The capacity endpoint reads X-User-Id / X-User-Role; the rest of the app also
// sends the unprefixed pair, so send both.
const getHeaders = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    const u = raw ? JSON.parse(raw)?.user : null;
    const id = String(u?.id ?? '');
    const role = String(u?.role ?? '');
    return {
      'Content-Type': 'application/json',
      'User-Id': id,
      'User-Role': role,
      'X-User-Id': id,
      'X-User-Role': role,
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

const fmtMw = (mw) => {
  if (!Number.isFinite(mw) || mw <= 0) return null;
  return `${mw.toLocaleString('en-IN', { maximumFractionDigits: 2 })} MW`;
};

class SilentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('ProjectCapacityKpi suppressed an error:', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const ProjectCapacityTile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  const role = String(user?.role || '').trim().toUpperCase();
  const allowed = ALLOWED_ROLES.includes(role);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    fetch(`${API_BASE}/projects/dashboard/capacity`, {
      method: 'GET',
      credentials: 'include',
      headers: getHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || !Array.isArray(payload.subGroups)) return;

        let totalMw = 0;
        let projectCount = 0;
        payload.subGroups.forEach((sg) => {
          const factor = UNIT_TO_MW[String(sg?.unit || '').toLowerCase()];
          const qty = Number(sg?.totalQuantity);
          if (!factor || !Number.isFinite(qty)) return;
          totalMw += qty * factor;
          projectCount += Number(sg?.projectCount) || 0;
        });

        setStats({ totalMw, projectCount });
      })
      .catch(() => { /* fail silently — the dashboard must be unaffected */ });

    return () => { cancelled = true; };
  }, [allowed]);

  const value = stats ? fmtMw(stats.totalMw) : null;
  if (!allowed || !value) return null;

  const goToProjects = () => navigate(PROJECTS_PATH);

  return (
    <div
      className="rd-kpi-card"
      style={{ '--kpi-accent': '#10b981', '--kpi-icon-bg': '#ecfdf5', cursor: 'pointer' }}
      onClick={goToProjects}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goToProjects(); }}
    >
      <div className="rd-kpi-icon">☀️</div>
      <div className="rd-kpi-label">Solar Capacity</div>
      <div className="rd-kpi-value">{value}</div>
      <div className="rd-kpi-sub">
        {stats.projectCount ? `Across ${stats.projectCount} projects` : 'Across all projects'}
      </div>
    </div>
  );
};

const ProjectCapacityKpi = () => (
  <SilentBoundary>
    <ProjectCapacityTile />
  </SilentBoundary>
);

export default ProjectCapacityKpi;
