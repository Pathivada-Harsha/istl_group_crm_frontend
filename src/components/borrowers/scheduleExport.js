// src/components/borrowers/scheduleExport.js
//
// Downloadable PDF, Word and Excel copies of a Repayment Schedule. Built on
// buildScheduleData (RepaymentScheduleTab.js) — the same source the on-screen
// table renders from, so an export can never show a number the table doesn't.

import { jsPDF } from 'jspdf';
import * as XLSXStyle from 'xlsx-js-style';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import { formatCrore, formatDate } from './sanctionDerive';
import { buildScheduleData, mergeSplitInterestRows, frequencyLabel, moratoriumLabel } from './RepaymentScheduleTab';

// Word's COL_WIDTHS is a percentage per column, summing to 100 — kept next
// to each column here so hiding DSRA/ISRA (see getColumns) can drop both
// the header and its width together, then renormalize the rest back to
// 100 instead of leaving Word's table short of full width.
const ALL_COLUMNS = [
  { key: 'No.', width: 4 },
  { key: 'Repayment Date', width: 9 },
  { key: 'No. of Days', width: 7 },
  { key: 'Period', width: 6 },
  { key: 'Loan Opening', width: 8 },
  { key: 'Repayment %', width: 7 },
  { key: 'Disbursement', width: 8 },
  { key: 'Principal Repayment', width: 9 },
  { key: 'Interest', width: 7 },
  { key: 'Total Debt Service', width: 9 },
  { key: 'Loan Closing', width: 8 },
  { key: 'DSRA Amount', width: 9, permission: 'showDsra' },
  { key: 'ISRA Amount', width: 9, permission: 'showIsra' },
];

// perm = { showDsra, showIsra, showDetailedInterest } — same permission
// flags the on-screen table uses (RepaymentScheduleTab.js), passed down
// from the caller (SanctionOverviewPanel.js's ScheduleExportMenu), so an
// export can never contain a column or a split-interest row the table
// itself is hiding from that user.
const getColumns = (perm) => {
  const cols = ALL_COLUMNS.filter((c) => !c.permission || perm[c.permission]);
  const widthSum = cols.reduce((t, c) => t + c.width, 0);
  return {
    headers: cols.map((c) => c.key),
    wordWidths: cols.map((c) => Math.round((c.width / widthSum) * 100)),
  };
};

// jsPDF's built-in fonts (and most Word default fonts) can't render the ₹
// glyph, so PDF/Word swap it for "Rs." — same fix already used for jsPDF
// exports elsewhere in this app (ProjectReports.js). Excel keeps ₹ as-is,
// since Excel renders it natively.
const money = (n, rsafe) => {
  if (n == null) return '—';
  const str = typeof n === 'number' ? formatCrore(n) : n;
  return rsafe ? str.replace(/₹/g, 'Rs. ') : str;
};

const buildRows = (view, form, rsafe, perm, headers) => {
  const { rows: allRows, debt } = buildScheduleData(view, form);
  const rows = perm.showDetailedInterest ? allRows : mergeSplitInterestRows(allRows);
  return rows.map((r) => {
    const days = Math.round((r.end.getTime() - r.start.getTime()) / 86400000);
    const pct = r.amortIndex === null ? '—' : `${(Math.round(r.repaymentPct * 100) / 100).toFixed(2)}%`;
    const disbursement = r.isFirstRow && debt !== null ? debt : null;
    const dsra = r.amortIndex !== null && view.dsraByPeriod ? view.dsraByPeriod[r.amortIndex] : view.dsraAmount;
    const isra = r.amortIndex !== null && view.israByPeriod ? view.israByPeriod[r.amortIndex] : view.israAmount;
    const record = {
      'No.': r.no,
      'Repayment Date': formatDate(r.displayEnd) || '—',
      'No. of Days': days,
      Period: r.periodLabel,
      'Loan Opening': money(r.opening, rsafe),
      'Repayment %': pct,
      Disbursement: money(disbursement, rsafe),
      'Principal Repayment': money(r.principalDue, rsafe),
      Interest: money(r.interestDue, rsafe),
      'Total Debt Service': money(r.principalDue + r.interestDue, rsafe),
      'Loan Closing': money(r.closing, rsafe),
      'DSRA Amount': money(dsra, rsafe),
      'ISRA Amount': money(isra, rsafe),
    };
    return headers.reduce((o, h) => ({ ...o, [h]: record[h] }), {});
  });
};

const buildSummary = (view, form, rsafe) => {
  const { debt, moratoriumPeriods, moratoriumStart, moratoriumEnd } = buildScheduleData(view, form);
  return [
    ['Sanctioned Amount', money(debt, rsafe)],
    ['Disbursement Date', formatDate(moratoriumStart) || '—'],
    ['Repayment Start Date', formatDate(view.repaymentStart) || '—'],
    ['Repayment End Date', formatDate(view.repaymentEnd) || '—'],
    ['ROI', view.roi || '—'],
    ['Repayment Frequency', frequencyLabel(form)],
    ['Interest During Moratorium', moratoriumLabel(form.interestDuringMoratorium)],
    ['Moratorium Period', moratoriumPeriods.length
      ? `${formatDate(moratoriumStart)} - ${moratoriumEnd}`
      : 'None - repayment begins immediately'],
  ];
};

const fileBase = (meta = {}) => [meta.borrowerName, meta.refNo, 'Repayment Schedule']
  .filter(Boolean).join(' - ')
  .replace(/[\\/:*?"<>|]+/g, '-');

const reportTitle = (meta = {}) => ['Repayment Schedule', meta.borrowerName, meta.refNo && `(${meta.refNo})`]
  .filter(Boolean).join(' — ');

// ── Excel ────────────────────────────────────────────────────────────────
export const exportScheduleExcel = (view, form, meta = {}, perm = {}) => {
  const { headers } = getColumns(perm);
  const summary = buildSummary(view, form, false);
  const rows = buildRows(view, form, false, perm, headers);
  if (!rows.length) return;

  const aoa = [[reportTitle(meta)], []];
  for (let i = 0; i < summary.length; i += 2) {
    const [l1, v1] = summary[i];
    const pair = summary[i + 1];
    aoa.push(pair ? [l1, v1, pair[0], pair[1]] : [l1, v1]);
  }
  aoa.push([], headers, ...rows.map((r) => headers.map((h) => r[h])));

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
  const headerRow = summary.length / 2 + 3; // title + blank + summary rows + blank

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
  const titleAddr = XLSXStyle.utils.encode_cell({ r: 0, c: 0 });
  ws[titleAddr].s = { font: { bold: true, sz: 13 } };

  for (let r = 2; r < headerRow - 1; r++) {
    [0, 2].forEach((c) => {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: '6B7280' }, sz: 10 } };
    });
  }

  headers.forEach((k, i) => {
    const addr = XLSXStyle.utils.encode_cell({ r: headerRow, c: i });
    if (!ws[addr]) return;
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1B3A6B' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '0F2647' } }, bottom: { style: 'thin', color: { rgb: '0F2647' } },
        left: { style: 'thin', color: { rgb: '0F2647' } }, right: { style: 'thin', color: { rgb: '0F2647' } },
      },
    };
  });

  ws['!cols'] = headers.map((k) => ({
    wch: Math.min(28, Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2),
  }));

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Repayment Schedule');
  XLSXStyle.writeFile(wb, `${fileBase(meta)}.xlsx`);
};

// ── PDF (A4) ─────────────────────────────────────────────────────────────
export const exportSchedulePDF = (view, form, meta = {}, perm = {}) => {
  const { headers: HEADERS } = getColumns(perm);
  const summary = buildSummary(view, form, true);
  const rows = buildRows(view, form, true, perm, HEADERS);
  if (!rows.length) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usable = pageW - margin * 2;
  const weights = HEADERS.map((h) => /repayment|debt service|amount/i.test(h) ? 1.3 : 1);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const colW = weights.map((w) => (usable * w) / wSum);
  const FS = 7;
  const LH = FS * 0.45;

  doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.setFont(undefined, 'bold');
  doc.text(reportTitle(meta), margin, 12);

  let y = 18;
  doc.setFontSize(8.5); doc.setFont(undefined, 'normal'); doc.setTextColor(55, 65, 81);
  const half = usable / 2;
  for (let i = 0; i < summary.length; i += 2) {
    doc.setFont(undefined, 'bold');
    doc.text(`${summary[i][0]}:`, margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(summary[i][1]), margin + 38, y);
    if (summary[i + 1]) {
      doc.setFont(undefined, 'bold');
      doc.text(`${summary[i + 1][0]}:`, margin + half, y);
      doc.setFont(undefined, 'normal');
      doc.text(String(summary[i + 1][1]), margin + half + 38, y);
    }
    y += 5;
  }
  y += 3;

  const drawHeader = (yy) => {
    doc.setFillColor(27, 58, 107);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(FS);
    doc.setFont(undefined, 'bold');
    let x = margin;
    const hLines = HEADERS.map((h, i) => doc.splitTextToSize(h, colW[i] - 2));
    const hH = Math.max(...hLines.map((l) => l.length)) * LH + 3;
    doc.rect(margin, yy, usable, hH, 'F');
    HEADERS.forEach((h, i) => { doc.text(hLines[i], x + 1, yy + LH + 1); x += colW[i]; });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 41, 59);
    return yy + hH;
  };

  y = drawHeader(y);
  rows.forEach((r, ri) => {
    const cells = HEADERS.map((h, i) => doc.splitTextToSize(String(r[h] ?? ''), colW[i] - 2));
    const rowH = Math.max(1, ...cells.map((c) => c.length)) * LH + 2.5;
    if (y + rowH > pageH - margin) { doc.addPage(); y = drawHeader(10); }
    if (ri % 2 === 1) { doc.setFillColor(241, 245, 249); doc.rect(margin, y, usable, rowH, 'F'); }
    doc.setFontSize(FS);
    let x = margin;
    cells.forEach((c, i) => { doc.text(c, x + 1, y + LH + 0.6); x += colW[i]; });
    doc.setDrawColor(226, 232, 240); doc.line(margin, y + rowH, margin + usable, y + rowH);
    y += rowH;
  });

  doc.save(`${fileBase(meta)}.pdf`);
};

// ── Word (A4) ────────────────────────────────────────────────────────────
const A4 = { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE }; // twips, landscape

const cellText = (text, opts = {}) => new TableCell({
  width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  shading: opts.fill ? { fill: opts.fill } : undefined,
  children: [new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({ text: String(text ?? '—'), bold: !!opts.bold, color: opts.color, size: opts.size || 15 })],
  })],
});

const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 2, color: 'D1D5DB' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'D1D5DB' },
  left: { style: BorderStyle.SINGLE, size: 2, color: 'D1D5DB' },
  right: { style: BorderStyle.SINGLE, size: 2, color: 'D1D5DB' },
};

export const exportScheduleWord = async (view, form, meta = {}, perm = {}) => {
  const { headers: HEADERS, wordWidths: COL_WIDTHS } = getColumns(perm);
  const summary = buildSummary(view, form, true);
  const rows = buildRows(view, form, true, perm, HEADERS);
  if (!rows.length) return;

  const summaryRows = [];
  for (let i = 0; i < summary.length; i += 2) {
    const pair = summary[i + 1];
    summaryRows.push(new TableRow({
      children: pair
        ? [
          cellText(summary[i][0], { width: 15, bold: true, color: '6B7280', size: 14 }),
          cellText(summary[i][1], { width: 35, bold: true, size: 15 }),
          cellText(pair[0], { width: 15, bold: true, color: '6B7280', size: 14 }),
          cellText(pair[1], { width: 35, bold: true, size: 15 }),
        ]
        : [
          cellText(summary[i][0], { width: 15, bold: true, color: '6B7280', size: 14 }),
          cellText(summary[i][1], { width: 85, bold: true, size: 15 }),
        ],
    }));
  }
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS,
    rows: summaryRows,
  });

  const headerRow = new TableRow({
    tableHeader: true,
    children: HEADERS.map((h, i) => cellText(h, {
      bold: true, color: 'FFFFFF', fill: '1B3A6B', align: AlignmentType.CENTER, size: 14, width: COL_WIDTHS[i],
    })),
  });
  const bodyRows = rows.map((r, i) => new TableRow({
    children: HEADERS.map((h, ci) => cellText(r[h], {
      align: AlignmentType.CENTER, fill: i % 2 === 1 ? 'F1F5F9' : undefined, size: 13, width: COL_WIDTHS[ci],
    })),
  }));
  const scheduleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS,
    rows: [headerRow, ...bodyRows],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: A4.width, height: A4.height, orientation: A4.orientation },
          margin: { top: 720, bottom: 720, left: 560, right: 560 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
          children: [new TextRun({ text: reportTitle(meta), bold: true })],
        }),
        summaryTable,
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: '', break: 1 })] }),
        scheduleTable,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileBase(meta)}.docx`);
};
