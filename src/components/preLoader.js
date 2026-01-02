import React from "react";
import "../components_css/preLoader.css";

const CrmPreloader = ({ text = "Loading..." }) => {
  return (
    <div className="crm-preloader-overlay">
      <div className="crm-preloader-box">
        <div className="crm-spinner"></div>
        <span className="crm-loading-text">{text}</span>
      </div>
    </div>
  );
};

export default CrmPreloader;
