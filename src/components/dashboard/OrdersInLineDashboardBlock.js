// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONAL FEATURE — displayed as "Orders in Pipeline"
//
// NAMING: the UI says "Orders in Pipeline". This file, the /orders-in-line
// endpoint and the orders_in_line table keep the original name by choice.
//
// Two KPI tiles for the admin dashboard: the open count and the total capacity
// behind it. Renders as a fragment so both tiles sit directly in the dashboard's
// existing .rd-kpi-grid as siblings of the built-in cards.
//
// Self-contained by design: it owns its fetch and calls ONLY the dedicated
// /orders-in-line/summary endpoint — it never reads or extends the existing
// /dashboard/admin payload. Removal is one import + one element in Dashboard.js.
//
// It re-declares the formatters and the .rd-kpi-card markup rather than importing
// them because KpiCard/fmtMoney/fmtNum are module-local to Dashboard.js and not
// exported. The dashboard's CSS is consumed, never modified, so the tiles are
// visually identical to the built-in ones.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import ordersInLineApi from '../../services/ordersInLineApi';
import '../../pages-css/Dashboard.css';

/** Raw roles allowed to see these tiles. Checked here so Dashboard.js's
 *  normalizeRole (which collapses SUPERADMIN and ADMIN into one bucket) stays
 *  untouched. */
const ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN'];

const PAGE_PATH = '/sales/orders-in-line';

/* Copies of the dashboard's formatters — see the file header for why. */
const fmtMoney = (n) => {
  if (!n && n !== 0) return '₹0';
  const num = typeof n === 'string' ? parseFloat(n) : Number(n);
  if (!Number.isFinite(num)) return '₹0';
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(1)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');

/** kW in, human-readable capacity out. */
const fmtCapacity = (kwRaw) => {
  const kw = typeof kwRaw === 'string' ? parseFloat(kwRaw) : Number(kwRaw);
  if (!Number.isFinite(kw) || kw <= 0) return '—';
  if (kw >= 1000) return `${(kw / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} MW`;
  return `${kw.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kW`;
};

/** Mirrors Dashboard.js's KpiCard markup so the tiles are indistinguishable. */
const Tile = ({ label, value, sub, accent, iconBg, icon, onClick }) => (
  <div
    className="rd-kpi-card"
    style={{ '--kpi-accent': accent, '--kpi-icon-bg': iconBg, cursor: onClick ? 'pointer' : undefined }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
  >
    <div className="rd-kpi-icon">{icon}</div>
    <div className="rd-kpi-label">{label}</div>
    <div className="rd-kpi-value">{value ?? '—'}</div>
    {sub && <div className="rd-kpi-sub">{sub}</div>}
  </div>
);

/**
 * Last line of defence. The existing dashboard replaces the whole page with an
 * error screen when its own fetch fails; this add-on must never be able to
 * trigger anything like that. The fetch path already fails silently — this
 * catches a render-time throw too.
 */
class SilentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('OrdersInPipeline KPI tiles suppressed an error:', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const OrdersInPipelineTiles = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const role = String(user?.role || '').trim().toUpperCase();
  const allowed = ALLOWED_ROLES.includes(role);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    ordersInLineApi.getSummary()
      .then((summary) => { if (!cancelled) setData(summary); })
      .catch(() => { /* fail silently — the dashboard must be unaffected */ });

    return () => { cancelled = true; };
  }, [allowed]);

  // Not permitted, still loading, request failed, or empty payload → render
  // nothing. The sibling tiles simply take the space.
  if (!allowed || !data || data.openCount == null) return null;

  const goToPage = () => navigate(PAGE_PATH);

  return (
    <>
      <Tile
        label="Orders in Pipeline"
        value={fmtNum(data.openCount)}
        sub="Unconfirmed prospects"
        accent="#f59e0b"
        iconBg="#fffbeb"
        icon="🧾"
        onClick={goToPage}
      />
      <Tile
        label="Pipeline Capacity"
        value={fmtCapacity(data.openCapacityKw)}
        sub={`${fmtMoney(data.openEstimatedValue)} estimated`}
        accent="#8b5cf6"
        iconBg="#f5f3ff"
        icon="⚡"
        onClick={goToPage}
      />
    </>
  );
};

const OrdersInLineDashboardBlock = () => (
  <SilentBoundary>
    <OrdersInPipelineTiles />
  </SilentBoundary>
);

export default OrdersInLineDashboardBlock;
