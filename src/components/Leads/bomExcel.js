// ─────────────────────────────────────────────────────────────────────────────
//  bomExcel — shared Excel helpers for the lead BOM tab and the BOM template
//  admin. Downloads a styled template (colored header + per-column widths) via
//  xlsx-js-style, and reads an uploaded sheet into plain row objects via xlsx.
//  Same split the projects BOM tab uses (xlsx to read, xlsx-js-style to style).
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { fgColor: { rgb: "1B3A6B" } },              // app navy
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    top:    { style: "thin", color: { rgb: "0F2748" } },
    bottom: { style: "thin", color: { rgb: "0F2748" } },
    left:   { style: "thin", color: { rgb: "0F2748" } },
    right:  { style: "thin", color: { rgb: "0F2748" } },
  },
};

const SAMPLE_STYLE = {
  font: { italic: true, color: { rgb: "6B7280" } },
  fill: { fgColor: { rgb: "F3F6FB" } },              // very light blue
  alignment: { vertical: "center" },
};

/**
 * Download a styled .xlsx template.
 * @param columns  [{ header, width }]  — header text + column width (chars)
 * @param sample   array of example cell values (one row), aligned to columns.
 *                 Pass null/omit to emit a header-only template (so nothing gets
 *                 imported back as a real row).
 * @param sheetName / fileName
 */
export function downloadStyledTemplate(columns, sample, sheetName, fileName) {
  const headers = columns.map(c => c.header);
  const ws = XLSXStyle.utils.aoa_to_sheet(sample ? [headers, sample] : [headers]);
  ws["!cols"] = columns.map(c => ({ wch: c.width }));
  ws["!rows"] = sample ? [{ hpt: 24 }, { hpt: 20 }] : [{ hpt: 24 }];

  headers.forEach((_, c) => {
    const head = XLSXStyle.utils.encode_cell({ r: 0, c });
    if (ws[head]) ws[head].s = HEADER_STYLE;
    if (sample) {
      const samp = XLSXStyle.utils.encode_cell({ r: 1, c });
      if (ws[samp]) ws[samp].s = SAMPLE_STYLE;
    }
  });

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
  XLSXStyle.writeFile(wb, fileName);
}

/** Read the first sheet of an uploaded file into plain row objects (blanks → ""). */
export async function readSheetRows(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

/** First non-empty value among a row's aliased column names. */
export function cell(row, ...names) {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}
