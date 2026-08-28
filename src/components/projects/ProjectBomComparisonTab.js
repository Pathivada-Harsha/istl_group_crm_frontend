// ─────────────────────────────────────────────────────────────────────────────
//  ProjectBomComparisonTab — Planned vs Procured for the project BOM.
//
//  PLANNED is the BOM as entered. PROCURED is purchase-order value only — not
//  expenses, not invoices, not payments. A PO raised is a commitment, which is why
//  the column says Procured and never "Spent", and why this screen's total will not
//  equal the project financials total.
//
//  Every figure comes from ONE backend read that is itself computed from the same
//  attribution the BOM enforcement guard uses, so the procured quantity shown for a
//  line is the "already ordered" figure that would block a purchase order for it.
//  Nothing on this screen is recomputed client-side except which rows are open.
//
//  Rate gating: when the API returns canSeeRates=false every money figure is absent
//  — including variance, which discloses the planned rate by arithmetic even when the
//  planned column itself is hidden. Quantities stay: neither a quantity nor a GST
//  rate is a price.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { ChevronRight, ChevronDown, AlertTriangle, PackageX, Info } from "lucide-react";

const fmtINR = (n) =>
  Number(Math.round((Number(n) || 0) * 100) / 100)
    .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (v) => (v === null || v === undefined ? "—" : `₹${fmtINR(v)}`);

/** Quantities arrive as strings to preserve DECIMAL scale — trim trailing zeros. */
const qty = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};

const pct = (v) => (v === null || v === undefined ? "" : `${Number(v) > 0 ? "+" : ""}${Number(v)}%`);

/** Over budget reads one way, under budget the other; equal reads as neither. */
const varClass = (v) => {
  const n = Number(v) || 0;
  if (n > 0.005) return "pvab-over";
  if (n < -0.005) return "pvab-under";
  return "pvab-level";
};

const signed = (v) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v) || 0;
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}₹${fmtINR(Math.abs(n))}`;
};

const dateOf = (s) => {
  if (!s) return "—";
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return d ? `${d}-${m}-${y}` : String(s);
};

export default function ProjectBomComparisonTab({ data, canSeeRates }) {
  const [openScopes, setOpenScopes] = useState({});
  const [openLines, setOpenLines] = useState({});
  const [showUnattributed, setShowUnattributed] = useState(false);

  const scopes = data?.scopes || [];
  const summary = data?.summary || {};
  const gst = data?.gstSummary || {};
  const unattributed = data?.unattributed || { lines: [] };
  const rec = data?.reconciliation || null;

  const toggleScope = (k) => setOpenScopes((p) => ({ ...p, [k]: !p[k] }));
  const toggleLine = (k) => setOpenLines((p) => ({ ...p, [k]: !p[k] }));

  if (!scopes.length) {
    return (
      <div className="pvab-empty">
        No BOM lines on this project yet. Add them on the <b>Planned BOM</b> tab — this
        view compares them against the purchase orders raised for the project.
      </div>
    );
  }

  return (
    <div className="pvab">
      {/* ── Summary. Inclusive of GST, above the fold, before any scrolling. ── */}
      <div className="pvab-summary">
        {canSeeRates ? (
          <>
            <div className="pvab-stat">
              <label>Planned (incl. GST)</label>
              <span>{money(summary.plannedIncGst)}</span>
            </div>
            <div className="pvab-stat">
              <label>Procured (incl. GST)</label>
              <span>{money(summary.procuredIncGst)}</span>
            </div>
            <div className={`pvab-stat ${varClass(summary.varianceIncGst)}`}>
              <label>Variance</label>
              <span>
                {signed(summary.varianceIncGst)}
                {summary.variancePct != null && <em> {pct(summary.variancePct)}</em>}
              </span>
            </div>
          </>
        ) : (
          <div className="pvab-stat pvab-stat-wide">
            <label>Amounts hidden</label>
            <span className="pvab-gated">Your access level shows quantities, not values.</span>
          </div>
        )}
        <div className="pvab-stat">
          <label>Not ordered</label>
          <span>{summary.notOrderedLineCount ?? 0} of {data?.bomLineCount ?? 0} lines</span>
        </div>
        {(summary.overBomLineCount ?? 0) > 0 && (
          <div className="pvab-stat pvab-over">
            <label>Over BOM</label>
            <span>{summary.overBomLineCount} line{summary.overBomLineCount === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      <p className="pvab-note">
        <Info size={13} />
        <span>
          <b>Procured</b> is purchase-order value — every live PO including Drafts,
          excluding Cancelled. It is what has been committed, not what has been spent, so
          this total will not match the project financials total, which also carries
          expenses. Line figures exclude GST; GST is summarised at the foot.
        </span>
      </p>

      {/* ── Scope rows ─────────────────────────────────────────────────────── */}
      <div className="pvab-table-wrap">
        <table className="pvab-table">
          <thead>
            <tr>
              <th className="pvab-c-exp" />
              <th className="pvab-c-name">Scope / Item</th>
              <th className="pvab-c-num">Planned qty</th>
              <th className="pvab-c-num">Procured qty</th>
              {canSeeRates && <th className="pvab-c-amt">Planned</th>}
              {canSeeRates && <th className="pvab-c-amt">Procured</th>}
              {canSeeRates && <th className="pvab-c-amt">Variance</th>}
            </tr>
          </thead>
          <tbody>
            {scopes.map((s) => {
              const key = String(s.scopeItemId ?? "__unassigned__");
              const open = !!openScopes[key];
              return (
                <React.Fragment key={key}>
                  <tr className="pvab-row-scope" onClick={() => toggleScope(key)}>
                    <td className="pvab-c-exp">
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="pvab-c-name">
                      <span className="pvab-scope-name">{s.scopeName}</span>
                      <span className="pvab-scope-meta">
                        {s.itemCount} item{s.itemCount === 1 ? "" : "s"}
                        {s.notOrderedCount > 0 && <> · {s.notOrderedCount} not ordered</>}
                        {s.overBomCount > 0 && (
                          <> · <span className="pvab-over">{s.overBomCount} over BOM</span></>
                        )}
                      </span>
                    </td>
                    <td className="pvab-c-num" />
                    <td className="pvab-c-num" />
                    {canSeeRates && <td className="pvab-c-amt">{money(s.plannedAmount)}</td>}
                    {canSeeRates && <td className="pvab-c-amt">{money(s.procuredAmount)}</td>}
                    {canSeeRates && (
                      <td className={`pvab-c-amt ${varClass(s.variance)}`}>
                        {signed(s.variance)}
                        {s.variancePct != null && <em> {pct(s.variancePct)}</em>}
                      </td>
                    )}
                  </tr>

                  {open && (s.lines || []).map((l) => {
                    const lk = `${key}:${l.bomLineId}`;
                    const lopen = !!openLines[lk];
                    const hasPos = (l.pos || []).length > 0;
                    return (
                      <React.Fragment key={lk}>
                        <tr className="pvab-row-line">
                          <td className="pvab-c-exp">
                            {hasPos && (
                              <button type="button" className="pvab-exp-btn" onClick={() => toggleLine(lk)}
                                title={`${l.poCount} purchase order${l.poCount === 1 ? "" : "s"} feed this line`}>
                                {lopen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            )}
                          </td>
                          <td className="pvab-c-name pvab-indent">
                            <span className="pvab-item">{l.itemName}</span>
                            {l.make && <span className="pvab-make">{l.make}</span>}
                            {/* An explicit state, not a blank: a planned item nobody
                                bought is one of the most useful things here. */}
                            {l.notOrdered && (
                              <span className="pvab-badge pvab-badge-none">
                                <PackageX size={11} /> Not ordered
                              </span>
                            )}
                            {l.overBom && (
                              <span className="pvab-badge pvab-badge-over">
                                <AlertTriangle size={11} /> Over BOM
                              </span>
                            )}
                          </td>
                          <td className="pvab-c-num">{qty(l.plannedQty)} {l.unit || ""}</td>
                          <td className="pvab-c-num">
                            {l.notOrdered ? <span className="pvab-dim">0</span> : qty(l.procuredQty)}
                          </td>
                          {canSeeRates && <td className="pvab-c-amt">{money(l.plannedAmount)}</td>}
                          {canSeeRates && (
                            <td className="pvab-c-amt">
                              {l.notOrdered ? <span className="pvab-dim">—</span> : money(l.procuredAmount)}
                            </td>
                          )}
                          {canSeeRates && (
                            <td className={`pvab-c-amt ${varClass(l.variance)}`}>{signed(l.variance)}</td>
                          )}
                        </tr>

                        {/* One BOM line commonly draws on several POs at different
                            rates; a single averaged rate would hide that. */}
                        {lopen && (l.pos || []).map((p, pi) => (
                          <tr key={pi} className="pvab-row-po">
                            <td className="pvab-c-exp" />
                            <td className="pvab-c-name pvab-indent2">
                              <span className="pvab-po-no">{p.poRefId || p.poNo}</span>
                              <span className="pvab-po-meta">
                                {p.vendorName || "—"} · {dateOf(p.orderDate)} · {p.status || "—"}
                                {p.legacy && <> · <span className="pvab-legacy">pre-BOM row</span></>}
                                {p.match === "NAME" && <> · <span className="pvab-legacy">matched by name</span></>}
                              </span>
                            </td>
                            <td className="pvab-c-num" />
                            <td className="pvab-c-num">{qty(p.quantity)}</td>
                            {canSeeRates && <td className="pvab-c-amt pvab-dim">@ {money(p.rate)}</td>}
                            {canSeeRates && <td className="pvab-c-amt">{money(p.amount)}</td>}
                            {canSeeRates && <td className="pvab-c-amt" />}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── GST summary ────────────────────────────────────────────────────── */}
      {canSeeRates && (gst.rows || []).length > 0 && (
        <div className="pvab-block">
          <h5 className="pvab-block-title">GST</h5>
          <p className="pvab-block-lede">
            A slab present on only one side still shows both columns. A vendor billing 18%
            on an item planned at 5% is exactly what this is for — a blank would read as
            missing data instead of a finding.
          </p>
          <div className="pvab-table-wrap">
            <table className="pvab-table pvab-table-gst">
              <thead>
                <tr>
                  <th className="pvab-c-name">Slab</th>
                  <th className="pvab-c-amt">Planned taxable</th>
                  <th className="pvab-c-amt">Planned GST</th>
                  <th className="pvab-c-amt">Procured taxable</th>
                  <th className="pvab-c-amt">Procured GST</th>
                  <th className="pvab-c-amt">GST variance</th>
                </tr>
              </thead>
              <tbody>
                {gst.rows.map((r, i) => (
                  <tr key={i} className={r.label?.startsWith("No GST") ? "pvab-row-norate" : undefined}>
                    <td className="pvab-c-name">{r.label}</td>
                    <td className="pvab-c-amt">{money(r.plannedTaxable)}</td>
                    <td className="pvab-c-amt">{money(r.plannedGst)}</td>
                    <td className="pvab-c-amt">{money(r.procuredTaxable)}</td>
                    <td className="pvab-c-amt">{money(r.procuredGst)}</td>
                    <td className={`pvab-c-amt ${varClass(r.gstVariance)}`}>{signed(r.gstVariance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pvab-c-name">Subtotal excl. GST</td>
                  <td className="pvab-c-amt" colSpan={2}>{money(gst.plannedSubtotal)}</td>
                  <td className="pvab-c-amt" colSpan={2}>{money(gst.procuredSubtotal)}</td>
                  <td className={`pvab-c-amt ${varClass(gst.subtotalVariance)}`}>{signed(gst.subtotalVariance)}</td>
                </tr>
                <tr>
                  <td className="pvab-c-name">GST</td>
                  <td className="pvab-c-amt" colSpan={2}>{money(gst.plannedGst)}</td>
                  <td className="pvab-c-amt" colSpan={2}>{money(gst.procuredGst)}</td>
                  <td className={`pvab-c-amt ${varClass(gst.gstVariance)}`}>{signed(gst.gstVariance)}</td>
                </tr>
                <tr className="pvab-row-total">
                  <td className="pvab-c-name">Total incl. GST</td>
                  <td className="pvab-c-amt" colSpan={2}>{money(gst.plannedTotal)}</td>
                  <td className="pvab-c-amt" colSpan={2}>{money(gst.procuredTotal)}</td>
                  <td className={`pvab-c-amt ${varClass(gst.totalVariance)}`}>{signed(gst.totalVariance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {(gst.rows || []).some((r) => r.label?.startsWith("No GST")) && (
            <p className="pvab-block-foot">
              Lines with no catalogue reference carry no default GST rate, so they sit in
              the no-rate row rather than being counted at 0%.
            </p>
          )}
        </div>
      )}

      {/* ── Unattributed procurement + the reconciliation ─────────────────── */}
      <div className="pvab-block">
        <h5 className="pvab-block-title">
          Procurement not linked to a BOM line
          <span className="pvab-block-count">
            {unattributed.lineCount || 0} line{unattributed.lineCount === 1 ? "" : "s"}
            {unattributed.poCount ? ` across ${unattributed.poCount} PO${unattributed.poCount === 1 ? "" : "s"}` : ""}
          </span>
        </h5>
        {(unattributed.lineCount || 0) === 0 ? (
          <p className="pvab-block-lede">
            Every purchase-order line on this project resolves to a BOM line.
          </p>
        ) : (
          <>
            <p className="pvab-block-lede">
              Legacy purchase orders raised before BOM linking existed, and any line that
              could not be resolved. They are listed rather than dropped, because the
              totals only tie if they are visible.
            </p>
            <button type="button" className="pvab-toggle" onClick={() => setShowUnattributed((v) => !v)}>
              {showUnattributed ? "Hide" : "Show"} the {unattributed.lineCount} line
              {unattributed.lineCount === 1 ? "" : "s"}
            </button>
            {showUnattributed && (
              <div className="pvab-table-wrap">
                <table className="pvab-table">
                  <thead>
                    <tr>
                      <th className="pvab-c-name">PO / Item</th>
                      <th className="pvab-c-num">Qty</th>
                      {canSeeRates && <th className="pvab-c-amt">Rate</th>}
                      {canSeeRates && <th className="pvab-c-amt">Amount</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {unattributed.lines.map((p, i) => (
                      <tr key={i}>
                        <td className="pvab-c-name">
                          <span className="pvab-item">{p.itemName || "(unnamed item)"}</span>
                          <span className="pvab-po-meta">
                            {p.poRefId || p.poNo} · {p.vendorName || "—"} · {dateOf(p.orderDate)} · {p.status || "—"}
                            {p.legacy && <> · <span className="pvab-legacy">pre-BOM row</span></>}
                          </span>
                        </td>
                        <td className="pvab-c-num">{qty(p.quantity)} {p.unit || ""}</td>
                        {canSeeRates && <td className="pvab-c-amt">{money(p.rate)}</td>}
                        {canSeeRates && <td className="pvab-c-amt">{money(p.amount)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Two figures that fail to tie on one screen destroy confidence in both,
            so the arithmetic is shown rather than left to the reader. */}
        {rec && (
          <div className="pvab-recon">
            <div><label>Procured against the BOM</label><span>{money(rec.bomProcuredExGst)}</span></div>
            <div className="pvab-recon-op">+</div>
            <div><label>Not linked to a BOM line</label><span>{money(rec.unattributedExGst)}</span></div>
            <div className="pvab-recon-op">=</div>
            <div className="pvab-recon-total">
              <label>Project procurement (excl. GST)</label><span>{money(rec.projectProcuredExGst)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
