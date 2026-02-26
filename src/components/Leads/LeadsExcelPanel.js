import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "../../services/leadsapi.js";

import "./Leadsexcelpanel.css";

// Column positions (0-indexed) — must match template exactly:
// 0  Client Name *
// 1  Email
// 2  Phone *
// 3  Source
// 4  Priority
// 5  Group
// 6  Category
// 7  Enquiry *
// 8  State *
// 9  District
// 10 City / Village
// 11 Pincode
// 12 Solar Scheme
// 13 Assigned To (Email)
// 14 Notes / Discussion

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
  const fileRef = useRef(null);
  const [loading,    setLoading]    = useState(false);
  const [progress,   setProgress]   = useState({ done: 0, total: 0 });
  const [result,     setResult]     = useState(null);
  const [showResult, setShowResult] = useState(false);

  // ── Export ──────────────────────────────────────────────────────────────────
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

  // ── Download template ────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const a  = document.createElement("a");
    a.href     = `${process.env.PUBLIC_URL}/templates/leads_import_template.xlsx`;
    a.download = "leads_import_template.xlsx";
    a.click();
  };

  // ── Parse Excel ──────────────────────────────────────────────────────────────
  const parseExcel = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });

        // Must be the "Leads Import" sheet
        const sheetName = wb.SheetNames.find(n => n === "Leads Import");
        if (!sheetName) {
          reject(new Error(
            'Sheet "Leads Import" not found. Make sure you are uploading the correct template and have NOT renamed the sheet.'
          ));
          return;
        }

        const ws  = wb.Sheets[sheetName];
        // header:1 returns array-of-arrays, defval:"" fills empty cells
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Template layout:
        //   Row index 0 → Row 1 in Excel = Title banner        ← skip
        //   Row index 1 → Row 2 in Excel = Warning banner      ← skip
        //   Row index 2 → Row 3 in Excel = Column headers      ← skip
        //   Row index 3 → Row 4 in Excel = DATA STARTS HERE ✅
        const dataRows = aoa.slice(3);   // skip first 3 rows

        resolve(dataRows);
      } catch (err) {
        reject(new Error("Could not read file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });

  // ── Validate one row ─────────────────────────────────────────────────────────
  const validateRow = (row) => {
    const errs = [];
    const name  = String(row[0]  || "").trim();
    const phone = String(row[2]  || "").trim().replace(/\s/g, "");
    const enq   = String(row[7]  || "").trim();
    const state = String(row[8]  || "").trim();
    const email = String(row[1]  || "").trim();

    if (!name)  errs.push("Client Name required");
    if (!phone) errs.push("Phone required");
    if (!enq)   errs.push("Enquiry required");
    if (!state) errs.push("State required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.push("Email format invalid");
    if (phone && !/^\d{10}$/.test(phone))
      errs.push("Phone must be exactly 10 digits");

    return errs;
  };

  // ── Build API payload from row ───────────────────────────────────────────────
  const rowToPayload = (row) => {
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
    };
  };

  // ── Import handler ───────────────────────────────────────────────────────────
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

    let rows;
    try {
      rows = await parseExcel(file);
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [err.message] });
      setShowResult(true);
      setLoading(false);
      return;
    }

    // Filter out completely empty rows
    const dataRows = rows.filter(r =>
      r.some(cell => String(cell).trim() !== "")
    );

    if (!dataRows.length) {
      setResult({
        imported: 0, skipped: 0,
        errors: ["No data found. Fill your data from Row 4 onwards in the 'Leads Import' sheet."]
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
      const row        = dataRows[i];
      const excelRow   = i + 4;   // actual Excel row number shown to user
      const rowErrors  = validateRow(row);

      if (rowErrors.length) {
        errors.push(`Row ${excelRow}: ${rowErrors.join(", ")}`);
        skipped++;
        setProgress({ done: i + 1, total: dataRows.length });
        continue;
      }

      try {
        await api.post("/leads/create", rowToPayload(row));
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

  return (
    <div className="lep-wrap">
      <input ref={fileRef} type="file" accept=".xlsx"
        style={{ display: "none" }} onChange={handleImport} />

      <div className="lep-buttons">
        <button className="lep-btn lep-btn--template"
          onClick={handleDownloadTemplate} title="Download blank import template">
          ⬇ Template
        </button>
        <button className="lep-btn lep-btn--import"
          disabled={loading}
          onClick={() => fileRef.current?.click()}
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
            <button className="lep-result-close"
              onClick={() => setShowResult(false)}>✕</button>
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
    </div>
  );
}