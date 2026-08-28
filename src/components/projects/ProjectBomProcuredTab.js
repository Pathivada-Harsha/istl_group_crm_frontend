// ─────────────────────────────────────────────────────────────────────────────
//  ProjectBomProcuredTab — what was actually purchased, grouped BY PURCHASE ORDER.
//
//  This is the one view the comparison table cannot express: the comparison is
//  organised by what was planned, so a PO that spans six BOM lines is scattered
//  across it. Here the PO is the row and its lines hang under it.
//
//  Grouping switches between purchase order, vendor and item, because those answer
//  three different questions — "what did we order on this PO", "what is our total
//  exposure to this supplier", and "everything we bought of this item". All three are
//  the SAME rows regrouped in the browser; no figure is recomputed.
//
//  A PO or line with no BOM link is labelled as such, never omitted.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Link2Off } from "lucide-react";

const fmtINR = (n) =>
  Number(Math.round((Number(n) || 0) * 100) / 100)
    .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (v) => (v === null || v === undefined ? "—" : `₹${fmtINR(v)}`);

const qty = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};

const dateOf = (s) => {
  if (!s) return "—";
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return d ? `${d}-${m}-${y}` : String(s);
};

const GROUPINGS = [
  { key: "po", label: "Purchase order" },
  { key: "vendor", label: "Vendor" },
  { key: "item", label: "Item" },
];

const statusClass = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "draft") return "pvab-st-draft";
  if (v === "delivered") return "pvab-st-done";
  if (v.includes("partially")) return "pvab-st-part";
  return "pvab-st-open";
};

export default function ProjectBomProcuredTab({ data, canSeeRates }) {
  const [groupBy, setGroupBy] = useState("po");
  const [open, setOpen] = useState({});

  // Memoised so the two groupings below don't rebuild on every render just because
  // `|| []` handed them a fresh array.
  const pos = useMemo(() => data?.purchaseOrders || [], [data]);

  /** Every PO line once, flattened, each carrying its PO header. */
  const flat = useMemo(
    () =>
      pos.flatMap((p) =>
        (p.lines || []).map((l) => ({
          ...l,
          poNo: p.poNo,
          poRefId: p.poRefId,
          vendorName: p.vendorName,
          vendorId: p.vendorId,
          orderDate: p.orderDate,
          status: p.status,
        }))
      ),
    [pos]
  );

  /** The same rows, grouped three ways. Totals are summed from the rows shown. */
  const groups = useMemo(() => {
    if (groupBy === "po") {
      return pos.map((p) => ({
        key: `po-${p.poId}`,
        title: p.poRefId || p.poNo,
        meta: [p.vendorName || "—", dateOf(p.orderDate)].join(" · "),
        status: p.status,
        totalExGst: p.totalExGst,
        totalIncGst: p.totalIncGst,
        unlinked: p.unlinkedLineCount,
        lines: p.lines || [],
      }));
    }
    const by = new Map();
    for (const l of flat) {
      const k =
        groupBy === "vendor"
          ? l.vendorId != null ? `v-${l.vendorId}` : `vn-${l.vendorName || "—"}`
          : `i-${String(l.itemName || "").trim().toLowerCase()}`;
      if (!by.has(k)) {
        by.set(k, {
          key: k,
          title: groupBy === "vendor" ? l.vendorName || "(no vendor)" : l.itemName || "(unnamed item)",
          meta: null,
          lines: [],
        });
      }
      by.get(k).lines.push(l);
    }
    return [...by.values()].map((g) => {
      let ex = 0;
      let q = 0;
      let unlinked = 0;
      for (const l of g.lines) {
        ex += Number(l.amount) || 0;
        q += Number(l.quantity) || 0;
        if (l.bomLineId == null) unlinked += 1;
      }
      return {
        ...g,
        meta:
          groupBy === "vendor"
            ? `${g.lines.length} line${g.lines.length === 1 ? "" : "s"} · ${
                new Set(g.lines.map((l) => l.poRefId || l.poNo)).size
              } PO(s)`
            : `${qty(q)} across ${g.lines.length} line${g.lines.length === 1 ? "" : "s"}`,
        totalExGst: canSeeRates ? ex : null,
        totalIncGst: null,
        unlinked,
      };
    });
  }, [groupBy, pos, flat, canSeeRates]);

  if (!pos.length) {
    return (
      <div className="pvab-empty">
        No live purchase orders on this project yet. Cancelled and deleted POs are never
        counted here; Draft POs are.
      </div>
    );
  }

  const toggle = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="pvab">
      <div className="pvab-groupbar">
        <span className="pvab-groupbar-label">Group by</span>
        {GROUPINGS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`pvab-group-btn${groupBy === g.key ? " pvab-group-btn-on" : ""}`}
            onClick={() => { setGroupBy(g.key); setOpen({}); }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="pvab-table-wrap">
        <table className="pvab-table">
          <thead>
            <tr>
              <th className="pvab-c-exp" />
              <th className="pvab-c-name">{groupBy === "po" ? "PO / Item" : groupBy === "vendor" ? "Vendor / Item" : "Item / PO"}</th>
              <th className="pvab-c-name">BOM line</th>
              <th className="pvab-c-num">Qty</th>
              {canSeeRates && <th className="pvab-c-amt">Rate</th>}
              <th className="pvab-c-num">GST %</th>
              {canSeeRates && <th className="pvab-c-amt">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = !!open[g.key];
              return (
                <React.Fragment key={g.key}>
                  <tr className="pvab-row-scope" onClick={() => toggle(g.key)}>
                    <td className="pvab-c-exp">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="pvab-c-name">
                      <span className="pvab-scope-name">{g.title}</span>
                      <span className="pvab-scope-meta">
                        {g.meta}
                        {/* Status belongs with the PO it describes, not in a numeric
                            column where it would sit under the wrong header. */}
                        {g.status && (
                          <> · <span className={`pvab-status ${statusClass(g.status)}`}>{g.status}</span></>
                        )}
                      </span>
                    </td>
                    <td className="pvab-c-name">
                      {g.unlinked > 0 && (
                        <span className="pvab-badge pvab-badge-none">
                          <Link2Off size={11} /> {g.unlinked} not linked
                        </span>
                      )}
                    </td>
                    <td className="pvab-c-num" />
                    {canSeeRates && <td className="pvab-c-amt" />}
                    <td className="pvab-c-num" />
                    {canSeeRates && (
                      <td className="pvab-c-amt">
                        {money(g.totalExGst)}
                        {g.totalIncGst != null && (
                          <em className="pvab-inc">{money(g.totalIncGst)} incl.</em>
                        )}
                      </td>
                    )}
                  </tr>

                  {isOpen && g.lines.map((l, i) => (
                    <tr key={i} className="pvab-row-line">
                      <td className="pvab-c-exp" />
                      <td className="pvab-c-name pvab-indent">
                        <span className="pvab-item">{l.itemName || "(unnamed item)"}</span>
                        {l.make && <span className="pvab-make">{l.make}</span>}
                        {groupBy !== "po" && (
                          <span className="pvab-po-meta">
                            {l.poRefId || l.poNo} · {dateOf(l.orderDate)} · {l.status || "—"}
                          </span>
                        )}
                      </td>
                      <td className="pvab-c-name">
                        {l.bomLineId ? (
                          <>
                            <span className="pvab-item">{l.bomItemName}</span>
                            <span className="pvab-po-meta">
                              {l.bomScopeName}
                              {l.match === "NAME" && <> · <span className="pvab-legacy">matched by name</span></>}
                            </span>
                          </>
                        ) : (
                          <span className="pvab-badge pvab-badge-none">
                            <Link2Off size={11} /> No BOM link
                          </span>
                        )}
                      </td>
                      <td className="pvab-c-num">{qty(l.quantity)} {l.unit || ""}</td>
                      {canSeeRates && <td className="pvab-c-amt">{money(l.rate)}</td>}
                      <td className="pvab-c-num">
                        {l.gstPercent === null || l.gstPercent === undefined ? "—" : `${Number(l.gstPercent)}%`}
                      </td>
                      {canSeeRates && <td className="pvab-c-amt">{money(l.amount)}</td>}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="pvab-block-foot">
        Every live purchase order on this project, Drafts included — a draft has reserved
        the material, so the BOM enforcement counts it and so does this. Cancelled and
        deleted POs appear nowhere.
      </p>
    </div>
  );
}
