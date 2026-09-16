// src/components/borrowers/LimitsCard.js
//
// Card rendering of the Overview tab's "Limits" section (06) — a pure
// extraction of the read-only Sanction Limits table SanctionDetailView.js
// used to render inline, now wrapped in a .br-card so it sits beside
// Project Cost & Finance in the two-column card grid. No change to the
// %-of-limit math or the Fund/Non Fund Based label logic.
import React, { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import { getSanctionLimitLabel } from './sanctionFields';

const numFrom = (v) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

// No "View All Limits" link — the table below already renders every limit
// (limits.map, no row limit/pagination), nothing held back.
const LimitsCard = ({ limits, limit }) => {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpanded = (idx) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  return (
    <div className="br-card">
      <div className="br-card-head">
        <ClipboardList size={16} aria-hidden="true" className="br-dl-icon" />
        <h3 className="br-card-title">Limits</h3>
      </div>
      {limits.length > 0 ? (
        <div className="br-table-wrap">
          <table className="br-table-list sr-limits-table-readonly">
            <thead>
              <tr>
                <th className="br-center">Limit</th>
                <th className="br-right">Amount Rs. Cr's</th>
                <th>Instrument</th>
                <th className="br-right">% of Limit</th>
                <th className="br-center">Tentative Disb. Date</th>
                <th className="br-center">Actual Disb. Date</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((l, i) => {
                const pct = limit > 0 ? (numFrom(l.facilityLimitAmount) / limit) * 100 : 0;
                const limitName = l.limitLabel || getSanctionLimitLabel(i);
                const tranches = l.tranches || [];
                const isOpen = expanded.has(i);
                return (
                  <React.Fragment key={i}>
                    <tr>
                      <td className="br-center">
                        {tranches.length > 0 ? (
                          <button
                            type="button" className="br-limit-name-toggle"
                            onClick={() => toggleExpanded(i)}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} tranches for ${limitName}`}
                            aria-expanded={isOpen}
                            title="Tranches"
                          >
                            {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                            {limitName}
                          </button>
                        ) : limitName}
                      </td>
                      <td className="br-right">{l.facilityLimitAmount || '—'}</td>
                      <td>{l.facilityType || '—'}</td>
                      <td className="br-right">{pct.toFixed(2)}%</td>
                      <td className="br-center">{l.tentativeDisbursementDate || '—'}</td>
                      <td className="br-center">{l.actualDisbursementDate || '—'}</td>
                    </tr>
                    {isOpen && tranches.length > 0 && (
                      <tr className="br-tranches-row">
                        <td colSpan={6}>
                          <div className="br-tranches-panel">
                            <div className="br-tranches-head">
                              <span className="br-tranches-title">Tranches for {limitName}</span>
                            </div>
                            <table className="br-table-list br-tranches-table">
                              <thead>
                                <tr>
                                  <th>Tranche</th>
                                  <th className="br-right">Amount Rs. Cr's</th>
                                  <th className="br-center">Tentative Disb. Date</th>
                                  <th className="br-center">Actual Disb. Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tranches.map((tr, tIdx) => (
                                  <tr key={tIdx}>
                                    <td>Tranche {tIdx + 1}</td>
                                    <td className="br-right">{tr.trancheAmount || '—'}</td>
                                    <td className="br-center">{tr.tentativeDisbursementDate || '—'}</td>
                                    <td className="br-center">{tr.actualDisbursementDate || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="br-muted">No Limits recorded.</p>
      )}
    </div>
  );
};

export default LimitsCard;
