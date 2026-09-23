// src/components/borrowers/RegistryAnalytics.js
//
// The analytics strip on the Borrower Registry page, between the KPI cards and
// the borrower table. Display-only: every figure comes from the registry-wide
// `stats.analytics` block the registry call already returns (see
// BorrowerService.getHierarchyStats / buildRegistryAnalytics), so it always
// reconciles with the KPI cards and never depends on which page, search or
// filter the table below is showing.

import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { displayName } from './displayName';

// One colour per type, used identically in the type-count and the amount card.
const TYPE_COLORS = {
  'Parent Group': '#7c3aed',
  Standalone: '#22c55e',
  Subsidiary: '#3b82f6',
  SPV: '#f59e0b',
  'Subsidiary + SPV': '#ec4899',
};
const STATUS_COLORS = { Active: '#22c55e', Inactive: '#ef4444', Pending: '#f59e0b' };
const FALLBACK_COLORS = ['#64748b', '#0ea5e9', '#a3a3a3'];
const EMPTY_RING = '#e5e7eb';

const colorFor = (map, label, i) => map[label] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
const share = (value, total) => (total > 0 ? (value / total) * 100 : 0);
const fmtShare = (p) => `${p.toFixed(1)}%`;

// The centre value can be a short count ("11") or a long amount
// ("₹1434.23 Cr") — scaled down by length so the longest amount this app
// formats still sits fully inside the ring's inner circle, on any screen
// width, rather than overflowing past it.
const centerFontSize = (text) => {
  const len = String(text ?? '').length;
  if (len <= 3) return 15;
  if (len <= 6) return 13;
  if (len <= 9) return 11;
  return 9.5;
};

const CardTitle = ({ children }) => (
  <h3 className="brx-an-title">{children}</h3>
);

/** Ring with a centre total on the left, legend (value + share) on the right. */
const DonutCard = ({ title, tone, segments, centerValue, centerLabel }) => {
  const total = segments.reduce((t, s) => t + s.value, 0);
  const drawn = segments.filter((s) => s.value > 0);
  const ring = drawn.length ? drawn : [{ label: 'none', value: 1, color: EMPTY_RING }];
  return (
    <section className={`brx-an-card brx-an-card-${tone}`}>
      <CardTitle>{title}</CardTitle>
      {segments.length === 0 ? (
        <p className="brx-an-empty">No data yet</p>
      ) : (
        <div className="brx-an-donut-row">
          <div className="brx-an-donut">
            <PieChart width={96} height={96}>
              <Pie
                data={ring} dataKey="value" innerRadius={34} outerRadius={47}
                startAngle={90} endAngle={-270} stroke="#ffffff" strokeWidth={2} isAnimationActive={false}
              >
                {ring.map((s) => <Cell key={s.label} fill={s.color} />)}
              </Pie>
            </PieChart>
            <div className="brx-an-donut-center">
              <strong style={{ fontSize: `${centerFontSize(centerValue)}px` }}>{centerValue}</strong>
              <span>{centerLabel}</span>
            </div>
          </div>
          <ul className="brx-an-legend">
            {segments.map((s) => (
              <li key={s.label}>
                <span className="brx-an-dot" style={{ background: s.color }} aria-hidden="true" />
                <span className="brx-an-legend-label" title={s.label}>{s.label}</span>
                <span className="brx-an-legend-value">
                  {s.display} <em>({fmtShare(share(s.value, total))})</em>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

/** Ranking of the largest borrowers: name, proportional bar and amount on one line each. */
const TopBorrowersCard = ({ items }) => {
  const max = items.reduce((m, i) => Math.max(m, Number(i.amountCr) || 0), 0);
  return (
    <section className="brx-an-card brx-an-card-white">
      <CardTitle>{`Top ${items.length || 5} Borrowers by Sanctioned Amount`}</CardTitle>
      {items.length === 0 ? (
        <p className="brx-an-empty">No sanctioned amounts yet</p>
      ) : (
        <ol className="brx-an-rank">
          {items.map((i) => {
            const name = displayName(i.label);
            const width = max > 0 ? Math.max(((Number(i.amountCr) || 0) / max) * 100, 4) : 0;
            return (
              <li key={`${i.kind}-${i.label}`}>
                <span className="brx-an-rank-name" title={name}>{name}</span>
                <span className="brx-an-rank-track">
                  <span className="brx-an-rank-bar" style={{ width: `${width}%` }} />
                </span>
                <span className="brx-an-rank-amount">{i.amountLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

const RegistryAnalytics = ({ analytics, totalSanctionedLabel }) => {
  if (!analytics) return null;

  const types = (analytics.borrowerTypes || []).map((t, i) => ({
    label: t.label, value: t.count, display: String(t.count), color: colorFor(TYPE_COLORS, t.label, i),
  }));
  const typeTotal = types.reduce((t, s) => t + s.value, 0);

  const statuses = (analytics.sanctionStatus || []).map((t, i) => ({
    label: t.label, value: t.count, display: String(t.count), color: colorFor(STATUS_COLORS, t.label, i),
  }));
  const statusTotal = statuses.reduce((t, s) => t + s.value, 0);

  const amounts = (analytics.amountByType || []).map((t, i) => ({
    label: t.label, value: Number(t.amountCr) || 0, display: t.amountLabel, color: colorFor(TYPE_COLORS, t.label, i),
  }));

  return (
    <div className="brx-an">
      <div className="brx-an-grid">
        <DonutCard
          title="Borrower Type Distribution"
          tone="white"
          segments={types}
          centerValue={typeTotal}
          centerLabel="Total"
        />
        <DonutCard
          title="Sanction Status"
          tone="green"
          segments={statusTotal > 0 ? statuses : []}
          centerValue={statusTotal}
          centerLabel="Sanctions"
        />
        <DonutCard
          title="Sanctioned Amount by Type"
          tone="blue"
          segments={amounts}
          centerValue={totalSanctionedLabel || ''}
          centerLabel="Total"
        />
        <TopBorrowersCard items={analytics.topBorrowers || []} />
      </div>
    </div>
  );
};

export default RegistryAnalytics;
