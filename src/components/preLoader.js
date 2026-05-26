import React from "react";
import "../components_css/preLoader.css";

/**
 * CrmPreloader
 *
 * Props:
 *   text    {string}  — loading message (default "Loading...")
 *   inline  {boolean} — if true, renders a small inline indicator instead of
 *                       the full-screen overlay. Use `inline` for filter/re-fetch
 *                       operations so the page never jumps or zigzags.
 *
 * Usage:
 *   Full-screen (initial page load):
 *     {loading && <CrmPreloader text="Loading data..." />}
 *
 *   Inline (filter changes, re-fetches):
 *     {filterLoading && <CrmPreloader text="Updating..." inline />}
 */
const CrmPreloader = ({ text = "Loading...", inline = false }) => {
  if (inline) {
    return (
      <div className="crm-preloader-inline">
        <div className="crm-spinner" />
        <span className="crm-loading-text">{text}</span>
      </div>
    );
  }

  return (
    <div className="crm-preloader-overlay">
      <div className="crm-preloader-box">
        <div className="crm-spinner" />
        <span className="crm-loading-text">{text}</span>
      </div>
    </div>
  );
};

export default CrmPreloader;