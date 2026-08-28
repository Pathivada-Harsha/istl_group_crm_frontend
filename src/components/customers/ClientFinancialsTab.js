/**
 * Client Financials — the combined money-in / money-out picture for ONE client,
 * across every project that client has.
 *
 * Everything on this screen comes from GET /customers/{id}/financials, which is
 * the projects' OWN live roll-up filtered to this client (see
 * ClientFinancialsService on the backend). Nothing is recomputed here: the
 * breakdown table's rows are the same numbers each project's dashboard shows,
 * and the totals are their sum. If a figure ever looks wrong, the bug is in the
 * project it came from, not in this file.
 *
 * Charts use recharts, which is what the project dashboards already render with
 * (recharts 3.x, see package.json) — no second charting dependency.
 *
 * Exports:
 *   ClientFinancialsTab   — the full tab (KPIs + charts + breakdown table)
 *   ClientFinancialsStrip — the 3-number strip embedded in the Overview tab
 *   useClientFinancials   — the shared fetch, so the two never disagree
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, TrendingDown, TrendingUp, Wallet, Receipt, AlertTriangle,
  ArrowUpRight, PieChart as PieChartIcon, BarChart3, Scale, Building2,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, PieChart, Pie,
} from 'recharts';
import './ClientFinancials.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

/* ── Formatting ───────────────────────────────────────────────────────────
   Two formatters on purpose. Charts and KPI tiles get the compact Cr / L form
   the project dashboards use; the breakdown table gets full rupees, because
   that table's job is to let someone add the column up and check it against a
   project dashboard. Rounding it would defeat the point. */
const fmtCompact = (amount) => {
  if (amount === null || amount === undefined || amount === '') return '₹0';
  const value = Number(amount);
  if (!Number.isFinite(value)) return '₹0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const fmtFull = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '₹0';
  const sign = value < 0 ? '−' : '';
  return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

/** null means "we cannot say" (no denominator) and must not render as 0%. */
const fmtPct = (pct) => (pct === null || pct === undefined ? '—' : `${Number(pct).toFixed(1)}%`);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Long project names get two lines on the axis instead of an ellipsis. */
const shortName = (name, id) => {
  const s = (name || id || '').trim();
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
};

const STATUS_TONE = {
  COMPLETED:   'cfin-pill--ok',
  IN_PROGRESS: 'cfin-pill--warn',
  ON_HOLD:     'cfin-pill--bad',
  CANCELLED:   'cfin-pill--bad',
};

const C = {
  in:       '#3b82f6',   // money in
  out:      '#f97316',   // money out
  received: '#10b981',
  billed:   '#6366f1',
  positive: '#16a34a',
  negative: '#dc2626',
  advance:  '#8b5cf6',
  internal: '#06b6d4',
};

/* ── Shared fetch ─────────────────────────────────────────────────────────
   The Overview strip and the Financials tab both call this. They are separate
   mounts and so make separate requests, but they read the same endpoint, so
   the 3-number strip can never quote a figure the full tab contradicts. */
export function useClientFinancials(customerId) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      // credentials + 401 handling come from setupFetchInterceptor.
      const res  = await fetch(`${API_BASE_URL}/customers/${customerId}/financials`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Could not load client financials');
      setData(json.data);
    } catch (e) {
      setError(e.message || 'Could not load client financials');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

/* ── Overview tab: the three numbers worth interrupting someone for ─────── */
export function ClientFinancialsStrip({ customerId, onOpenFinancials }) {
  const { data, loading, error } = useClientFinancials(customerId);

  if (loading || error || !data) return null;

  const t = data.totals || {};
  const netCash = num(t.netCash);

  const cells = [
    {
      label: 'Outstanding receivable',
      value: fmtCompact(t.outstandingReceivable),
      hint:  'Billed − received, across all projects',
      tone:  num(t.outstandingReceivable) > 0 ? 'cfin-neg' : '',
      icon:  <AlertTriangle size={13} strokeWidth={2.4} />,
    },
    {
      label: 'Net cash',
      value: fmtCompact(netCash),
      hint:  'Received − spent',
      tone:  netCash < 0 ? 'cfin-neg' : '',
      icon:  netCash < 0 ? <TrendingDown size={13} strokeWidth={2.4} /> : <TrendingUp size={13} strokeWidth={2.4} />,
    },
    {
      label: '% collected',
      value: fmtPct(t.percentCollected),
      hint:  t.percentCollected === null || t.percentCollected === undefined
        ? 'No contract value on record'
        : `of ${fmtCompact(t.contractValue)} contract value`,
      tone:  '',
      icon:  <Wallet size={13} strokeWidth={2.4} />,
    },
  ];

  return (
    <div className="cfin-headline" style={{ marginTop: '1.25rem' }}>
      {cells.map((c) => (
        <div
          key={c.label}
          className={`cfin-headline-card${c.tone ? ' cfin-headline-card--owed' : ''}`}
          onClick={onOpenFinancials}
          role={onOpenFinancials ? 'button' : undefined}
          tabIndex={onOpenFinancials ? 0 : undefined}
          onKeyDown={(e) => { if (onOpenFinancials && (e.key === 'Enter' || e.key === ' ')) onOpenFinancials(); }}
          style={onOpenFinancials ? { cursor: 'pointer' } : undefined}
        >
          <div className="cfin-headline-label">{c.icon}{c.label}</div>
          <div className={`cfin-headline-value ${c.tone}`} style={{ fontSize: 22 }}>{c.value}</div>
          <div className="cfin-headline-sub">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Chart chrome ─────────────────────────────────────────────────────────
   Every chart carries the question it answers. A chart that cannot state its
   question does not belong on the page. */
const ChartCard = ({ icon: Icon, title, question, children, footer }) => (
  <div className="cfin-card">
    <div className="cfin-card-head">
      <h4 className="cfin-card-title"><Icon size={16} strokeWidth={2.2} aria-hidden="true" />{title}</h4>
      <div className="cfin-card-q">{question}</div>
    </div>
    {children}
    {footer ? <div className="cfin-card-q" style={{ marginTop: 8 }}>{footer}</div> : null}
  </div>
);

const MoneyTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="cfin-tooltip">
      <div className="cfin-tooltip-name">{label}</div>
      {payload.map((p) => (
        <div className="cfin-tooltip-row" key={p.dataKey}>
          <span className="cfin-tooltip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{fmtFull(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const SliceTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="cfin-tooltip">
      <div className="cfin-tooltip-row">
        <span className="cfin-tooltip-dot" style={{ background: p.payload.fill }} />
        {p.name}: <strong>{fmtFull(p.value)}</strong>
      </div>
    </div>
  );
};

/* ── Breakdown table ──────────────────────────────────────────────────────
   The audit trail. Its rows are per-project dashboard figures and its footer
   is their sum, which is exactly the totals block above — so anyone doubting
   a headline number can check it here against the project itself. */
const COLUMNS = [
  { k: 'projectName',   l: 'Project',        type: 'text' },
  { k: 'status',        l: 'Status',         type: 'text' },
  { k: 'contractValue', l: 'Contract',       type: 'money' },
  { k: 'billed',        l: 'Billed',         type: 'money' },
  { k: 'received',      l: 'Received',       type: 'money' },
  { k: 'spent',         l: 'Spent',          type: 'money' },
  { k: 'netCash',       l: 'Balance',        type: 'signed' },
  { k: 'budgetUtilisationPercent', l: 'Budget used', type: 'pct' },
];

function BreakdownTable({ rows, totals }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState({ key: 'billed', dir: 'desc' });

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.k === sort.key);
    const list = [...rows];
    list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      let cmp;
      if (col && col.type === 'text') {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      } else {
        // null budget-utilisation sorts last in both directions: "unknown" is
        // not a small number, and burying it under 0% would read as "0% used".
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        cmp = num(av) - num(bv);
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, sort]);

  const toggle = (k) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' }));

  return (
    <div className="cfin-card">
      <div className="cfin-card-head">
        <h4 className="cfin-card-title"><Receipt size={16} strokeWidth={2.2} aria-hidden="true" />Per-project breakdown</h4>
        <div className="cfin-card-q">
          Each row is that project&rsquo;s own dashboard figure. Open a project to check it.
        </div>
      </div>
      <div className="cfin-table-scroll">
        <table className="cfin-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.k}
                  className={sort.key === c.k ? 'cfin-sorted' : undefined}
                  onClick={() => toggle(c.k)}
                  title={`Sort by ${c.l}`}
                >
                  {c.l}{sort.key === c.k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const bal = num(r.netCash);
              return (
                <tr key={r.projectUniqueId}>
                  <td>
                    <button
                      type="button"
                      className="cfin-proj-link"
                      onClick={() => navigate(`/projects/${encodeURIComponent(r.projectUniqueId)}?tab=financials`)}
                    >
                      <span>
                        {r.projectName || r.projectUniqueId}
                        <span className="cfin-proj-id">{r.projectUniqueId}</span>
                      </span>
                    </button>
                  </td>
                  <td><span className={`cfin-pill ${STATUS_TONE[r.status] || ''}`}>{(r.status || '—').replace(/_/g, ' ')}</span></td>
                  <td>{fmtFull(r.contractValue)}</td>
                  <td>{fmtFull(r.billed)}</td>
                  <td>{fmtFull(r.received)}</td>
                  <td>{fmtFull(r.spent)}</td>
                  <td className={bal < 0 ? 'cfin-neg-cell' : (bal > 0 ? 'cfin-pos-cell' : undefined)}>{fmtFull(bal)}</td>
                  <td>
                    {r.budgetUtilisationPercent === null || r.budgetUtilisationPercent === undefined ? (
                      <span className="cfin-pill cfin-pill--muted" title="This project carries no budget, so utilisation cannot be worked out">
                        No budget
                      </span>
                    ) : (
                      <span className={`cfin-pill ${r.overBudget ? 'cfin-pill--bad' : (r.budgetUtilisationPercent >= 85 ? 'cfin-pill--warn' : 'cfin-pill--ok')}`}>
                        {fmtPct(r.budgetUtilisationPercent)}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cfin-proj-link"
                      title="Open this project's dashboard"
                      onClick={() => navigate(`/projects/${encodeURIComponent(r.projectUniqueId)}?tab=financials`)}
                    >
                      <ArrowUpRight size={14} strokeWidth={2.4} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total ({rows.length} {rows.length === 1 ? 'project' : 'projects'})</td>
              <td />
              <td>{fmtFull(totals.contractValue)}</td>
              <td>{fmtFull(totals.billed)}</td>
              <td>{fmtFull(totals.received)}</td>
              <td>{fmtFull(totals.spent)}</td>
              <td className={num(totals.netCash) < 0 ? 'cfin-neg-cell' : undefined}>{fmtFull(totals.netCash)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ── The tab ──────────────────────────────────────────────────────────── */
export default function ClientFinancialsTab({ customer }) {
  const { data, loading, error, reload } = useClientFinancials(customer?.id);
  // Cash vs accrual. Drives the charts only — the KPI block always shows both
  // pairs, because "what we collected" and "what we billed" are both true and
  // hiding one behind a toggle invites someone to quote the wrong one.
  const [basis, setBasis] = useState('cash');

  if (loading) {
    return <div className="cfin-empty">Loading client financials…</div>;
  }

  if (error) {
    return (
      <div className="cfin-empty">
        <AlertTriangle size={30} strokeWidth={1.8} />
        <div className="cfin-empty-title">Could not load financials</div>
        <div className="cfin-empty-sub">{error}</div>
        <button type="button" className="custd-btn custd-btn-sec custd-btn-sm" style={{ marginTop: 12 }} onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const t     = data.totals || {};
  const rows  = data.projects || [];
  const spend = data.spendComposition || {};
  const conc  = data.concentration || {};

  if (!rows.length) {
    return (
      <div className="cfin-empty">
        <Building2 size={30} strokeWidth={1.8} />
        <div className="cfin-empty-title">No projects for this client yet</div>
        <div className="cfin-empty-sub">
          Financials roll up from the client&rsquo;s projects. Create an order book and its project, and the numbers appear here.
          {data.excludedProjectCount > 0 && ` (${data.excludedProjectCount} cancelled or inactive ${data.excludedProjectCount === 1 ? 'project is' : 'projects are'} excluded.)`}
        </div>
      </div>
    );
  }

  const netCash = num(t.netCash);
  const margin  = num(t.projectedMargin);
  const cash    = basis === 'cash';

  /* Chart data. Built once, read by four charts. */
  const perProject = rows.map((r) => ({
    name:     shortName(r.projectName, r.projectUniqueId),
    fullName: r.projectName || r.projectUniqueId,
    moneyIn:  cash ? num(r.received) : num(r.billed),
    moneyOut: cash ? num(r.spent)    : num(r.payable),
    billed:   num(r.billed),
    received: num(r.received),
    margin:   cash ? num(r.netCash)  : num(r.projectedMargin),
  }));

  const composition = [
    { name: 'Vendor bill payments', value: num(spend.vendorBillPayments), fill: C.out },
    { name: 'Vendor advances',      value: num(spend.vendorAdvances),     fill: C.advance },
    { name: 'Internal expenses',    value: num(spend.internalExpenses),   fill: C.internal },
  ].filter((s) => s.value > 0);

  const chartHeight = Math.max(240, Math.min(420, 90 + rows.length * 42));

  return (
    <div className="cfin-wrap">
      {/* Prominent: what they owe us, and how much of the contract we have collected */}
      <div className="cfin-headline">
        <div className="cfin-headline-card cfin-headline-card--owed">
          <div className="cfin-headline-label"><AlertTriangle size={13} strokeWidth={2.4} />Outstanding receivable</div>
          <div className="cfin-headline-value cfin-neg">{fmtCompact(t.outstandingReceivable)}</div>
          <div className="cfin-headline-sub">Billed {fmtCompact(t.billed)} − received {fmtCompact(t.received)}</div>
        </div>

        <div className="cfin-headline-card">
          <div className="cfin-headline-label"><Wallet size={13} strokeWidth={2.4} />% collected</div>
          <div className="cfin-headline-value">{fmtPct(t.percentCollected)}</div>
          <div className="cfin-headline-sub">
            {t.percentCollected === null || t.percentCollected === undefined
              ? 'No contract value on record for these projects'
              : `of ${fmtCompact(t.contractValue)} contract value · ${fmtPct(t.percentBilled)} billed`}
          </div>
          {t.percentCollected !== null && t.percentCollected !== undefined && (
            <div className="cfin-meter">
              <div className="cfin-meter-fill" style={{ width: `${Math.min(100, Math.max(0, t.percentCollected))}%` }} />
            </div>
          )}
        </div>

        <div className="cfin-headline-card" style={{ borderLeftColor: C.internal }}>
          <div className="cfin-headline-label"><Building2 size={13} strokeWidth={2.4} />Share of company billing</div>
          <div className="cfin-headline-value">{fmtPct(conc.billedSharePercent)}</div>
          <div className="cfin-headline-sub">
            {conc.billedSharePercent === null || conc.billedSharePercent === undefined
              ? 'Nothing billed company-wide yet'
              : `${fmtCompact(t.billed)} of ${fmtCompact(conc.companyBilled)} billed across all live projects`}
          </div>
        </div>
      </div>

      {/* Both bases, always. Labelled pairs, not eight loose numbers. */}
      <div className="cfin-bases">
        <div className="cfin-basis">
          <div className="cfin-basis-head">
            <span className="cfin-basis-title">Cash</span>
            <span className="cfin-basis-note">money that actually moved</span>
          </div>
          <div className="cfin-basis-row">
            <div>
              <div className="cfin-stat-label">Received</div>
              <div className="cfin-stat-value">{fmtCompact(t.received)}</div>
            </div>
            <div>
              <div className="cfin-stat-label">Spent</div>
              <div className="cfin-stat-value">{fmtCompact(t.spent)}</div>
            </div>
            <div>
              <div className="cfin-stat-label">Net cash</div>
              <div className={`cfin-stat-value ${netCash < 0 ? 'cfin-neg' : 'cfin-pos'}`}>{fmtCompact(netCash)}</div>
            </div>
          </div>
        </div>

        <div className="cfin-basis">
          <div className="cfin-basis-head">
            <span className="cfin-basis-title">Accrual</span>
            <span className="cfin-basis-note">invoiced and booked, paid or not</span>
          </div>
          <div className="cfin-basis-row">
            <div>
              <div className="cfin-stat-label">Billed</div>
              <div className="cfin-stat-value">{fmtCompact(t.billed)}</div>
            </div>
            <div>
              <div className="cfin-stat-label">Payable</div>
              <div className="cfin-stat-value">{fmtCompact(t.payable)}</div>
            </div>
            <div>
              <div className="cfin-stat-label">Projected margin</div>
              <div className={`cfin-stat-value ${margin < 0 ? 'cfin-neg' : 'cfin-pos'}`}>{fmtCompact(margin)}</div>
            </div>
          </div>
        </div>
      </div>

      {data.excludedProjectCount > 0 && (
        <div className="cfin-note">
          <AlertTriangle size={14} strokeWidth={2.2} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span>
            {data.excludedProjectCount} cancelled or inactive {data.excludedProjectCount === 1 ? 'project is' : 'projects are'} excluded
            from every figure on this tab, the same way the project dashboards exclude them.
          </span>
        </div>
      )}

      {data.noActivity && (
        <div className="cfin-note">
          <AlertTriangle size={14} strokeWidth={2.2} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span>
            This client has {rows.length === 1 ? 'a project' : 'projects'} but no invoices, receipts, vendor bills or payments yet.
            Everything below is genuinely zero, not missing.
          </span>
        </div>
      )}

      <div className="cfin-toolbar">
        <div className="cfin-card-q" style={{ margin: 0 }}>
          Charts on the <strong>{cash ? 'cash' : 'accrual'}</strong> basis
          {cash ? ' — received vs spent.' : ' — billed vs payable.'} The figures above always show both.
        </div>
        <div className="cfin-toggle" role="group" aria-label="Reporting basis">
          <button type="button" className={cash ? 'active' : ''} onClick={() => setBasis('cash')}>Cash</button>
          <button type="button" className={!cash ? 'active' : ''} onClick={() => setBasis('accrual')}>Accrual</button>
        </div>
      </div>

      <div className="cfin-charts">
        <ChartCard
          icon={BarChart3}
          title="Money in vs out, per project"
          question="Which projects carry this client's money?"
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={perProject} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10.5 }} interval={0} angle={-18} textAnchor="end" height={54} />
              <YAxis tick={{ fontSize: 10.5 }} tickFormatter={fmtCompact} width={72} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="moneyIn"  name={cash ? 'Received' : 'Billed'}  fill={C.in}  radius={[3, 3, 0, 0]} />
              <Bar dataKey="moneyOut" name={cash ? 'Spent'    : 'Payable'} fill={C.out} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={Receipt}
          title="Billed vs received, per project"
          question="Where is this client behind on paying us?"
          footer="Always accrual vs cash — that gap IS the outstanding receivable, so the basis toggle does not apply here."
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={perProject} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10.5 }} interval={0} angle={-18} textAnchor="end" height={54} />
              <YAxis tick={{ fontSize: 10.5 }} tickFormatter={fmtCompact} width={72} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="billed"   name="Billed"   fill={C.billed}   radius={[3, 3, 0, 0]} />
              <Bar dataKey="received" name="Received" fill={C.received} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={PieChartIcon}
          title="Spend composition"
          question="What is the money going out actually being spent on?"
          footer={
            <>
              Vendor payments and advances add up to <strong>{fmtCompact(t.spent)}</strong> spent. Internal expenses
              ({fmtCompact(spend.internalExpenses)}) are approved employee and site cost, not money paid to a vendor,
              so they sit outside that figure — total outflow is <strong>{fmtCompact(spend.totalOutflow)}</strong>.
            </>
          }
        >
          {composition.length === 0 ? (
            <div className="cfin-empty" style={{ padding: '48px 12px' }}>
              <div className="cfin-empty-sub">Nothing has been paid out on this client&rsquo;s projects yet.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={composition}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="72%"
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {composition.map((s) => <Cell key={s.name} fill={s.fill} />)}
                </Pie>
                <Tooltip content={<SliceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          icon={Scale}
          title={cash ? 'Net cash per project' : 'Projected margin per project'}
          question="Is any project losing money?"
          footer={
            cash
              ? 'Received − spent. Negative bars are projects where more cash has gone out than has come in.'
              : 'Billed − payable. Projected, not final: unbilled scope and unbooked vendor cost can still move it.'
          }
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={perProject} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10.5 }} interval={0} angle={-18} textAnchor="end" height={54} />
              <YAxis tick={{ fontSize: 10.5 }} tickFormatter={fmtCompact} width={72} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
              {/* Zero line, so an underwater bar is unmistakably below it. */}
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="margin" name={cash ? 'Net cash' : 'Projected margin'} radius={[3, 3, 0, 0]}>
                {perProject.map((p) => (
                  <Cell key={p.fullName} fill={p.margin < 0 ? C.negative : C.positive} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <BreakdownTable rows={rows} totals={t} />

      <div className="cfin-card-q" style={{ paddingLeft: 2 }}>
        <IndianRupee size={11} strokeWidth={2.4} style={{ verticalAlign: -1 }} /> All figures in INR, computed live from
        invoices, receipts, vendor bills and vendor payments — the same source each project&rsquo;s own dashboard reads.
      </div>
    </div>
  );
}
