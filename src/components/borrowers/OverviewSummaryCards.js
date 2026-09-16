// src/components/borrowers/OverviewSummaryCards.js
//
// The five KPI cards atop the read-only Overview tab (SanctionDetailView.js):
// Sanctioned Amount, Debt : Equity, Repayment Tenor, ROI, Repayment
// Frequency. Reuses the same .brx-stat card the Borrower Registry list page
// already uses for its own header stats (see Stat in Pages/BorrowerRegistry.js)
// — no new visual system, just a second instance of it fed from one
// sanction's own fields instead of registry-wide counts.
//
// Every value here is read straight off `sanction` — Debt : Equity falls
// back to a same-page presentational ratio (debt/project cost, from the
// same raw money fields the Project Cost & Finance card already shows) only
// when the letter's own stated ratio (debtEquityRatio) is blank; Repayment
// Tenor's "(X.X years)" caption is the same months/12 conversion, and
// Repayment Frequency reuses the exact same repaymentFrequencyLabel() the
// Interest & Repayment field list already formats its own row with — not a
// new calculation. Nothing here is a source of truth SanctionDerivedCalculator.java
// doesn't already own — see the header note in SanctionDetailView.js.
import React, {
  useEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  IndianRupee, PieChart, Calendar, Percent, RefreshCw,
} from 'lucide-react';
import { BsInfoCircle } from 'react-icons/bs';
import { repaymentFrequencyLabel } from './SanctionOverviewPanel';

const numFrom = (v) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

const debtEquityDisplay = (sanction) => {
  if (sanction.debtEquityRatio) return sanction.debtEquityRatio;
  if (sanction.debtPct && sanction.equityPct) {
    return `${numFrom(sanction.debtPct).toFixed(0)} : ${numFrom(sanction.equityPct).toFixed(0)}`;
  }
  const debt = numFrom(sanction.debtAmount);
  const cost = numFrom(sanction.projectCost);
  if (!debt || !cost) return null;
  const debtPct = (debt / cost) * 100;
  return `${debtPct.toFixed(0)} : ${(100 - debtPct).toFixed(0)}`;
};

const tenorYearsCaption = (months) => {
  const n = parseFloat(String(months ?? '').replace(/[^0-9.]/g, ''));
  return n > 0 ? `(${(n / 12).toFixed(1)} years)` : null;
};

// A long `sub` caption (e.g. ROI's full rate-reset explanation) is clamped
// to 2 lines by CSS rather than left to grow the card taller than its
// neighbors. Whether it actually needed clamping is decided by character
// count rather than measuring the clamped element itself — `-webkit-box` +
// `-webkit-line-clamp` doesn't reliably report a scrollHeight/clientHeight
// gap the way a normal overflow:hidden block does, so that check silently
// never fired. Every other caption this component ever passes ("Total debt
// facility", "Capital structure", "(13.0 years)") is well under 20
// characters — only ROI's `interestRateText` runs long — so a threshold set
// comfortably above the two-line capacity of this card's font/width, but
// below every OTHER caption's length, distinguishes them without needing to
// measure anything. The full text is also always on the native title
// tooltip, so hovering it works even before the (i) icon is reached.
const LONG_SUB_THRESHOLD = 42;
const Card = ({ icon: Icon, tone, label, value, sub }) => {
  const isLong = typeof sub === 'string' && sub.length > LONG_SUB_THRESHOLD;
  const [showInfo, setShowInfo] = useState(false);
  const [popPos, setPopPos] = useState(null);
  const btnRef = useRef(null);

  // .brx-stat clips its own content (overflow: hidden, for the decorative
  // corner sparkline) — a plain absolutely-positioned popover would be
  // silently cut off by that, same failure a table cell's overflow-x caused
  // for SanctionDatePicker (see its own comment). A portal to document.body,
  // positioned off the trigger's own rect, has no such ancestor.
  const reposition = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPopPos({ top: r.bottom + 6, left: r.left });
  };

  useEffect(() => {
    if (!showInfo) return undefined;
    const onOutside = (e) => { if (!btnRef.current?.contains(e.target)) setShowInfo(false); };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInfo]);

  const toggleInfo = () => {
    if (!showInfo) reposition();
    setShowInfo((v) => !v);
  };

  return (
    <div className={`brx-stat brx-stat-${tone}`}>
      <span className="brx-stat-icon"><Icon size={15} aria-hidden="true" /></span>
      <span className="brx-stat-body">
        {sub && (
          <span className="brx-stat-sub-row">
            <span className="brx-stat-sub" title={isLong ? sub : undefined}>{sub}</span>
            {isLong && (
              <span className="br-info-wrap">
                <button
                  ref={btnRef}
                  type="button"
                  className="br-info-btn"
                  onClick={toggleInfo}
                  aria-label={`Full detail for ${label}`}
                  aria-expanded={showInfo}
                >
                  <BsInfoCircle size={12} aria-hidden="true" />
                </button>
                {showInfo && popPos && createPortal(
                  <div
                    className="br-info-popover br-info-popover-portal"
                    role="tooltip"
                    style={{ position: 'fixed', top: popPos.top, left: popPos.left }}
                  >
                    {sub}
                  </div>,
                  document.body,
                )}
              </span>
            )}
          </span>
        )}
        <span className="brx-stat-value">{value || '—'}</span>
        <span className="brx-stat-label">{label}</span>
      </span>
    </div>
  );
};

const OverviewSummaryCards = ({ sanction }) => (
  <div className="sr-kpi-row">
    <Card icon={IndianRupee} tone="blue" label="Sanctioned Amount" value={sanction.sanctionedAmount} sub="Total debt facility" />
    <Card icon={PieChart} tone="green" label="Debt : Equity" value={debtEquityDisplay(sanction)} sub="Capital structure" />
    <Card
      icon={Calendar}
      tone="purple"
      label="Repayment Tenor"
      value={sanction.derivedTotalTenorMonths}
      sub={tenorYearsCaption(sanction.derivedTotalTenorMonths)}
    />
    <Card icon={Percent} tone="amber" label="ROI" value={sanction.roiPct} sub={sanction.interestRateText || null} />
    <Card
      icon={RefreshCw}
      tone="teal"
      label="Repayment Frequency"
      value={sanction.repaymentFrequency ? repaymentFrequencyLabel(sanction) : null}
    />
  </div>
);

export default OverviewSummaryCards;
