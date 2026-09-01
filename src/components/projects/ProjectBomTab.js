// ─────────────────────────────────────────────────────────────────────────────
//  ProjectBomTab — the project BOM tab, which is three views of one BOM.
//
//    1. Comparison   — planned vs procured, by scope. Shown by DEFAULT: the first
//                      question anyone opens this tab with is "are we on budget".
//    2. Planned BOM  — the BOM as entered, and the editor for it (no actuals).
//    3. Procured BOM — what was bought, grouped by purchase order.
//
//  Tabs, not accordions. Planned and actual figures have to be readable together,
//  and an accordion forces one closed to open another.
//
//  This file owns only the tab bar and the one fetch the two actuals views share.
//  The editor lives in ProjectPlannedBomTab.js and loads its own data, so editing is
//  unaffected by anything here; switching back to Comparison refetches, which is how
//  a just-saved BOM shows up against its POs.
//
//  "Procured" is purchase-order value only — a commitment, not spend. That is why
//  this screen's total does not equal the project financials total, which also
//  carries expenses.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import projectsApi from "../../services/projectsApi.js";
import ProjectPlannedBomTab from "./ProjectPlannedBomTab.js";
import ProjectBomComparisonTab from "./ProjectBomComparisonTab.js";
import ProjectBomProcuredTab from "./ProjectBomProcuredTab.js";
import "../Leads/LeadBomTab.css";
import "./ProjectBomActuals.css";

const TABS = [
  { key: "comparison", label: "Comparison" },
  { key: "planned",    label: "Planned BOM" },
  { key: "procured",   label: "Procured BOM" },
];

export default function ProjectBomTab(props) {
  const { projectUniqueId, showError } = props;

  const [tab, setTab] = useState("comparison");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.getBomPlannedVsActual(projectUniqueId);
      if (res?.success) {
        setData(res.data || null);
        setLoadedFor(projectUniqueId);
      } else {
        showError?.(res?.message || "Failed to load planned vs procured");
      }
    } catch (e) {
      if (e?.message !== "SESSION_EXPIRED") showError?.("Failed to load planned vs procured");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUniqueId]);

  // Fetched only for the two views that need it, and refetched when returning from the
  // editor so a BOM just saved is compared against the real purchase orders.
  useEffect(() => {
    if (tab === "planned") return;
    if (loading) return;
    if (loadedFor === projectUniqueId && data) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, projectUniqueId]);

  const canSeeRates = data?.canSeeRates !== false;

  return (
    <div className="lbm">
      <div className="pvab-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pvab-tab${tab === t.key ? " pvab-tab-on" : ""}`}
            onClick={() => {
              // Leaving the editor invalidates the comparison — the BOM may have changed.
              if (tab === "planned" && t.key !== "planned") setLoadedFor(null);
              setTab(t.key);
            }}
          >
            {t.label}
          </button>
        ))}
        {tab !== "planned" && (
          <button type="button" className="pvab-refresh" onClick={load} disabled={loading}
            title="Reload from the live purchase orders">
            <RefreshCw size={13} className={loading ? "pvab-spin" : undefined} /> {loading ? "Loading…" : "Refresh"}
          </button>
        )}
      </div>

      {tab === "planned" ? (
        <ProjectPlannedBomTab {...props} />
      ) : loading && !data ? (
        <div className="lbm-loading"><span className="lbm-spinner" /> Loading…</div>
      ) : tab === "comparison" ? (
        <ProjectBomComparisonTab data={data} canSeeRates={canSeeRates} />
      ) : (
        <ProjectBomProcuredTab data={data} canSeeRates={canSeeRates} />
      )}
    </div>
  );
}
