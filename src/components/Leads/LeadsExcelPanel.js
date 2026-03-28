import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "../../services/leadsapi.js";

import "./Leadsexcelpanel.css";

// ── PM Surya Ghar auto-fill values ───────────────────────────────────────────
const PM_SURYAGARH_DEFAULTS = {
  groupName:    "Solar",
  subGroupName: "Solar_Rooftop",
  solarScheme:  "PM_Surya_Ghar",
};

// ── Template registry ────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "standard",
    name: "Standard Template",
    description: "General leads import — fill all fields manually",
    filename: "leads_import_template.xlsx",
    publicPath: true,
  },
  {
    id: "pm_suryagarh",
    name: "PM Surya Ghar Template",
    description: "For PM Surya Ghar leads — Group, Category & Scheme auto-filled on import",
    filename: "leads_import_pm_suryagarh.xlsx",
    publicPath: true,
  },
];

const EXPORT_COLS = [
  { key: "leadCode",         label: "Lead Code"      },
  { key: "name",             label: "Client Name"    },
  { key: "email",            label: "Email"          },
  { key: "phone",            label: "Phone"          },
  { key: "source",           label: "Source"         },
  { key: "priority",         label: "Priority"       },
  { key: "status",           label: "Lead Status"    },
  { key: "telecallerStatus", label: "TC Status"      },
  { key: "telecallerName",   label: "Telecaller"     },
  { key: "bdAssignedToName", label: "BD Executive"   },
  { key: "groupName",        label: "Group"          },
  { key: "subGroupName",     label: "Category"       },
  { key: "state",            label: "State"          },
  { key: "district",         label: "District"       },
  { key: "city",             label: "City"           },
  { key: "pincode",          label: "Pincode"        },
  { key: "solarScheme",      label: "Solar Scheme"   },
  { key: "enquiry",          label: "Enquiry"        },
  { key: "createdAt",        label: "Created At"     },
];


export default function LeadsExcelPanel({ leads = [], onImportDone }) {
  const fileRef          = useRef(null);
  const [loading,        setLoading]        = useState(false);
  const [progress,       setProgress]       = useState({ done: 0, total: 0 });
  const [result,         setResult]         = useState(null);
  const [showResult,     setShowResult]     = useState(false);
  const [templateModal,  setTemplateModal]  = useState(false);
  const [activeTemplate, setActiveTemplate] = useState("standard");

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!leads.length) { alert("No leads to export."); return; }
    const rows = leads.map(l =>
      Object.fromEntries(EXPORT_COLS.map(c => [c.label, l[c.key] ?? ""]))
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = EXPORT_COLS.map(c => ({ wch: Math.max(c.label.length + 4, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Download template ─────────────────────────────────────────────────────
  const handleDownloadTemplate = (tpl) => {
    setTemplateModal(false);
    const a  = document.createElement("a");
    a.href     = `${process.env.PUBLIC_URL}/templates/${tpl.filename}`;
    a.download = tpl.filename;
    a.click();
  };

  // ── Trigger file picker with template context ─────────────────────────────
  const triggerImport = (templateId) => {
    setTemplateModal(false);
    setActiveTemplate(templateId);
    setTimeout(() => fileRef.current?.click(), 60);
  };

  // ── Parse Excel ───────────────────────────────────────────────────────────
  const parseExcel = (file, templateId) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const expectedSheet = templateId === "pm_suryagarh"
          ? "PM Surya Ghar Import"
          : "Leads Import";

        const sheetName = wb.SheetNames.find(n => n === expectedSheet);
        if (!sheetName) {
          reject(new Error(
            `Sheet "${expectedSheet}" not found. Make sure you are uploading the correct template and have NOT renamed the sheet.`
          ));
          return;
        }

        const ws  = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        // PM Surya Ghar: 3 banner rows + 1 header + 1 example = skip 5 rows
        // Standard: skip 3 rows
        const dataRows = aoa.slice(templateId === "pm_suryagarh" ? 4 : 3);
        resolve(dataRows);
      } catch (err) {
        reject(new Error("Could not read file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });

  // ── Validate one row ──────────────────────────────────────────────────────
  // PM Surya Ghar cols:  [name(opt), email, phone*, source, priority, enquiry*, state*, district, city, assignedEmail, notes]
  // Standard cols:       [name*, email, phone*, source, priority, group, category, enquiry*, state*, district, city, pincode, scheme, assignedEmail, notes]
  const validateRow = (row, templateId) => {
    const errs = [];

    if (templateId === "pm_suryagarh") {
      const phone = String(row[2] || "").trim().replace(/\s/g, "");
      const enq   = String(row[5] || "").trim();
      const state = String(row[6] || "").trim();
      const email = String(row[1] || "").trim();
      // name is OPTIONAL — no validation
      if (!phone) errs.push("Phone required");
      if (!enq)   errs.push("Enquiry required");
      if (!state) errs.push("State required");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push("Email format invalid");
      if (phone && !/^\d{10}$/.test(phone)) errs.push("Phone must be exactly 10 digits");
    } else {
      const name  = String(row[0]  || "").trim();
      const phone = String(row[2]  || "").trim().replace(/\s/g, "");
      const enq   = String(row[7]  || "").trim();
      const state = String(row[8]  || "").trim();
      const email = String(row[1]  || "").trim();

      if (!name)  errs.push("Client Name required");
      if (!phone) errs.push("Phone required");
      if (!enq)   errs.push("Enquiry required");
      if (!state) errs.push("State required");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push("Email format invalid");
      if (phone && !/^\d{10}$/.test(phone)) errs.push("Phone must be exactly 10 digits");
    }

    return errs;
  };

  // ── Build API payload ─────────────────────────────────────────────────────
  const rowToPayload = (row, templateId) => {
    if (templateId === "pm_suryagarh") {
      const phone    = String(row[2]  || "").trim().replace(/\s/g, "");
      const rawName  = String(row[0]  || "").trim();
      const name     = rawName || phone; // fallback: use phone as name
      const notes    = String(row[10] || "").trim();
      const enquiry  = String(row[5]  || "").trim();
      const priority = String(row[4]  || "").trim() || "Medium";

      return {
        name,
        email:           String(row[1] || "").trim().toLowerCase() || null,
        phone,
        source:          String(row[3] || "").trim() || "Others",
        priority,
        // Auto-filled — NOT from the spreadsheet
        groupName:       PM_SURYAGARH_DEFAULTS.groupName,
        subGroupName:    PM_SURYAGARH_DEFAULTS.subGroupName,
        solarScheme:     PM_SURYAGARH_DEFAULTS.solarScheme,
        enquiry:         notes ? `${enquiry}\n\nNotes: ${notes}` : enquiry,
        state:           String(row[6] || "").trim() || null,
        district:        String(row[7] || "").trim() || null,
        city:            String(row[8] || "").trim() || null,
        pincode:         null,
        assignedToEmail: String(row[9] || "").trim() || null,
        templateType:    "pm_suryagarh",
      };
    }

    // Standard template
    const notes   = String(row[14] || "").trim();
    const enquiry = String(row[7]  || "").trim();

    return {
      name:            String(row[0]  || "").trim(),
      email:           String(row[1]  || "").trim().toLowerCase() || null,
      phone:           String(row[2]  || "").trim().replace(/\s/g, ""),
      source:          String(row[3]  || "").trim()  || "Others",
      priority:        String(row[4]  || "").trim()  || "Medium",
      groupName:       String(row[5]  || "").trim()  || null,
      subGroupName:    String(row[6]  || "").trim()  || null,
      enquiry:         notes ? `${enquiry}\n\nNotes: ${notes}` : enquiry,
      state:           String(row[8]  || "").trim()  || null,
      district:        String(row[9]  || "").trim()  || null,
      city:            String(row[10] || "").trim()  || null,
      pincode:         String(row[11] || "").trim()  || null,
      solarScheme:     String(row[12] || "").trim()  || null,
      assignedToEmail: String(row[13] || "").trim()  || null,
      templateType:    "standard",
    };
  };

  // ── Import handler ────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert("Please upload a .xlsx file.");
      return;
    }

    setLoading(true);
    setResult(null);
    setShowResult(false);

    const templateId = activeTemplate;

    let rows;
    try {
      rows = await parseExcel(file, templateId);
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [err.message] });
      setShowResult(true);
      setLoading(false);
      return;
    }

    const dataRows = rows.filter(r => r.some(cell => String(cell).trim() !== ""));

    if (!dataRows.length) {
      setResult({
        imported: 0, skipped: 0,
        errors: ["No data found. Fill your data starting from the row after the example row."]
      });
      setShowResult(true);
      setLoading(false);
      return;
    }

    if (dataRows.length > 500) {
      setResult({ imported: 0, skipped: 0, errors: ["Maximum 500 rows per import."] });
      setShowResult(true);
      setLoading(false);
      return;
    }

    setProgress({ done: 0, total: dataRows.length });
    let imported = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row       = dataRows[i];
      const excelRow  = i + (templateId === "pm_suryagarh" ? 5 : 4);
      const rowErrors = validateRow(row, templateId);

      if (rowErrors.length) {
        errors.push(`Row ${excelRow}: ${rowErrors.join(", ")}`);
        skipped++;
        setProgress({ done: i + 1, total: dataRows.length });
        continue;
      }

      try {
        await api.post("/leads/create", rowToPayload(row, templateId));
        imported++;
      } catch (err) {
        if (err.message === "SESSION_EXPIRED") break;
        errors.push(`Row ${excelRow}: ${err.message}`);
        skipped++;
      }

      setProgress({ done: i + 1, total: dataRows.length });
    }

    setResult({ imported, skipped, errors });
    setShowResult(true);
    setLoading(false);
    if (imported > 0) onImportDone?.();
  };

  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
      style={{ verticalAlign: "middle", marginRight: 5 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );

  return (
    <div className="lep-wrap">
      <input ref={fileRef} type="file" accept=".xlsx"
        style={{ display: "none" }} onChange={handleImport} />

      <div className="lep-buttons">
        <button className="lep-btn lep-btn--template"
          onClick={() => setTemplateModal(true)}
          title="Download import template">
          <DownloadIcon /> Template
        </button>

        <button className="lep-btn lep-btn--import"
          disabled={loading}
          onClick={() => setTemplateModal(true)}
          title="Import leads from .xlsx">
          {loading
            ? <><span className="lep-spinner" /> {pct}%</>
            : <>📥 Import</>}
        </button>

        <button className="lep-btn lep-btn--export"
          onClick={handleExport}
          title="Export current leads to Excel">
          📤 Export
        </button>
      </div>

      {loading && (
        <div className="lep-progress-bar">
          <div className="lep-progress-fill" style={{ width: `${pct}%` }} />
          <span>{progress.done} / {progress.total} rows</span>
        </div>
      )}

      {showResult && result && (
        <div className={`lep-result lep-result--${result.imported > 0 ? "ok" : "fail"}`}>
          <div className="lep-result-header">
            <strong>
              {result.imported > 0 ? `✅ ${result.imported} leads imported` : "Import failed"}
            </strong>
            <button className="lep-result-close" onClick={() => setShowResult(false)}>✕</button>
          </div>
          {result.skipped > 0 && (
            <p className="lep-count-skip">⚠ {result.skipped} rows skipped</p>
          )}
          {result.errors.length > 0 && (
            <div className="lep-error-list">
              <p>Issues found:</p>
              <ul>
                {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                {result.errors.length > 20 && (
                  <li>…and {result.errors.length - 20} more issues</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Template / Import Selection Modal ── */}
      {templateModal && (
        <div className="lep-tpl-overlay" onClick={() => setTemplateModal(false)}>
          <div className="lep-tpl-modal" onClick={e => e.stopPropagation()}>
            <div className="lep-tpl-header">
              <h3>📋 Choose Template</h3>
              <button className="lep-tpl-close" onClick={() => setTemplateModal(false)}>✕</button>
            </div>
            <p className="lep-tpl-subtitle">
              Download a blank template to fill data offline, then import it.
              Or import directly with an existing filled file.
            </p>
            <div className="lep-tpl-list">
              {TEMPLATES.map(tpl => (
                <div key={tpl.id} className="lep-tpl-item">
                  <div className="lep-tpl-item-info">
                    <div className="lep-tpl-item-name">{tpl.name}</div>
                    <div className="lep-tpl-item-desc">{tpl.description}</div>
                    {tpl.id === "pm_suryagarh" && (
                      <div className="lep-tpl-autofill-badge">
                        ✅ Auto-fills: Group · Category · Scheme &nbsp;|&nbsp; Name optional
                      </div>
                    )}
                  </div>
                  <div className="lep-tpl-item-actions">
                    <button className="lep-tpl-btn lep-tpl-btn--dl"
                      onClick={() => handleDownloadTemplate(tpl)}>
                      <DownloadIcon /> Download
                    </button>
                    <button className="lep-tpl-btn lep-tpl-btn--imp"
                      onClick={() => triggerImport(tpl.id)}>
                      📥 Import
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}