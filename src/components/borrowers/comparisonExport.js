// src/components/borrowers/comparisonExport.js
//
// Downloadable Excel copy of the Borrower Comparison grid — every selected
// sanction (not just the current page) and every section regardless of its
// collapsed/expanded state in the UI, so the file is always the complete
// comparison rather than whatever happened to be on screen. Follows the
// same styled-Excel recipe scheduleExport.js already uses (xlsx-js-style),
// just reshaped for a fields x borrowers grid instead of a period-by-period
// schedule.

import * as XLSXStyle from 'xlsx-js-style';
import { isBlank } from './SanctionOverviewPanel';

const fileBase = () => `Borrower Comparison ${new Date().toISOString().slice(0, 10)}`;

/**
 * @param model     { highlights, sections, valuesBySanctionId } from
 *                  BorrowerComparison.js's buildComparisonModel
 * @param sanctions the full selected list (every column, unpaginated)
 */
export const exportComparisonExcel = (model, sanctions) => {
  if (!sanctions.length) return;

  const headers = ['Field', ...sanctions.map((s) => s.associatedWithName || '—')];
  const aoa = [headers];
  const sectionRowIndexes = []; // rows to bold as a section band

  aoa.push(['Key Highlights']);
  sectionRowIndexes.push(aoa.length - 1);
  model.highlights.forEach((row) => {
    aoa.push([row.label, ...sanctions.map((s) => {
      const v = model.valuesBySanctionId[s.id]?.[row.key];
      return isBlank(v) ? '—' : v;
    })]);
  });

  model.sections.forEach((section) => {
    aoa.push([]);
    aoa.push([section.label]);
    sectionRowIndexes.push(aoa.length - 1);
    if (!section.rows.length) {
      aoa.push(['Nothing recorded for this section yet.']);
      return;
    }
    section.rows.forEach((row) => {
      aoa.push([row.label, ...sanctions.map((s) => {
        const v = model.valuesBySanctionId[s.id]?.[row.key];
        return isBlank(v) ? '—' : v;
      })]);
    });
  });

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  // Header row styling — same navy/white treatment scheduleExport.js uses.
  headers.forEach((h, i) => {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c: i });
    if (!ws[addr]) return;
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1B3A6B' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  });

  // Section band rows — bold, tinted, spanning every column.
  sectionRowIndexes.forEach((r) => {
    for (let c = 0; c < headers.length; c += 1) {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: 'EEF2FF' } },
        font: { bold: true, color: { rgb: '3730A3' }, sz: 11 },
      };
    }
    if (headers.length > 1) {
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } });
    }
  });

  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(32, Math.max(
      h.length,
      ...aoa.map((row) => String(row[i] ?? '').length),
    ) + 2),
  }));

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Borrower Comparison');
  XLSXStyle.writeFile(wb, `${fileBase()}.xlsx`);
};
