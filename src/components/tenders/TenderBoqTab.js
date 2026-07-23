// ─────────────────────────────────────────────────────────────────────────────
//  Rate Analysis & Bid (BOQ) tab — reuses the Leads BOM line-item pattern: one
//  flat array of items grouped by scope, inline add/remove, and Excel
//  import/export via the shared bomExcel helpers.
//
//  Cost-plus pricing: our_rate = (material + labour) × (1 + oh%) × (1 + pr%),
//  amount = qty × our_rate. Each line also carries the tender's own quoted rate
//  (tenderRate — the NIT / estimated rate), and the tab shows the VARIANCE of our
//  rate vs that quote per line and overall. our_rate / amount / totals / variance
//  are all COMPUTED, never stored.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import * as XLSXStyle from 'xlsx-js-style';
import { downloadStyledTemplate, readSheetRows, cell } from '../../components/Leads/bomExcel';
import {
  blankBoqItem, num, fmtINR,
  boqLineOurRate, boqLineAmount, boqBidTotal, boqCostTotal, boqEffectiveProfitPct,
  boqTenderTotal, boqLineVariancePct,
} from '../../services/tenderData';

// Excel import template (8 input columns, incl. the tender's quoted rate).
const BOQ_COLUMNS = [
  { header: 'Item No', width: 10 },
  { header: 'Scope', width: 16 },
  { header: 'Description', width: 34 },
  { header: 'Unit', width: 10 },
  { header: 'Qty', width: 10 },
  { header: 'Tender Rate', width: 13 },
  { header: 'Material Rate', width: 14 },
  { header: 'Labour Rate', width: 14 },
];
const BOQ_SAMPLE = ['1.1', 'Supply', 'Mono PERC Module 550Wp', 'Nos', 100, 12500, 9800, 0];
// Export adds the computed columns.
const EXPORT_HEADERS = [...BOQ_COLUMNS.map((c) => c.header), 'Our Rate', 'Amount', 'Variance %'];
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '1B3A6B' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const scopeLabel = (s) => s || 'Unassigned';
const varClass = (v) => (v > 0.05 ? 'tnd-var-over' : v < -0.05 ? 'tnd-var-under' : 'tnd-var-even');

export default function TenderBoqTab({ tender, setTender }) {
  const fileRef = useRef(null);
  const [newScope, setNewScope] = useState('');

  const items = tender.boqItems || [];
  const oh = tender.overheadPct;
  const pr = tender.profitPct;

  // distinct scopes in first-seen order
  const scopeOrder = [];
  items.forEach((it) => { const s = it.scope || ''; if (!scopeOrder.includes(s)) scopeOrder.push(s); });

  const updItem = (key, changes) => setTender((prev) => ({
    ...prev, boqItems: prev.boqItems.map((it) => (it._key === key ? { ...it, ...changes } : it)),
  }));
  const addItemTo = (scope) => setTender((prev) => ({ ...prev, boqItems: [...(prev.boqItems || []), blankBoqItem(scope)] }));
  const removeItem = (key) => setTender((prev) => ({ ...prev, boqItems: prev.boqItems.filter((it) => it._key !== key) }));
  const setKnob = (k, v) => setTender((prev) => ({ ...prev, [k]: v }));

  const addScopeGroup = () => {
    const name = newScope.trim();
    if (!name || scopeOrder.includes(name)) return;
    addItemTo(name);
    setNewScope('');
  };

  // ── Excel ──────────────────────────────────────────────────────────────
  const downloadTemplate = () =>
    downloadStyledTemplate(BOQ_COLUMNS, BOQ_SAMPLE, 'BOQ', 'tender_boq_template.xlsx');

  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rows = await readSheetRows(file);
      const mapped = rows.map((r) => ({
        ...blankBoqItem(String(cell(r, 'Scope')).trim()),
        itemNo: String(cell(r, 'Item No', 'ItemNo', 'Item')).trim(),
        description: String(cell(r, 'Description', 'Desc')).trim(),
        unit: String(cell(r, 'Unit', 'Units')).trim() || 'Nos',
        quantity: cell(r, 'Qty', 'Quantity'),
        tenderRate: cell(r, 'Tender Rate', 'TenderRate', 'NIT Rate', 'Quoted Rate'),
        materialRate: cell(r, 'Material Rate', 'MaterialRate', 'Material'),
        labourRate: cell(r, 'Labour Rate', 'LabourRate', 'Labour'),
      })).filter((x) => x.description || x.itemNo);
      if (mapped.length) setTender((prev) => ({ ...prev, boqItems: [...(prev.boqItems || []), ...mapped] }));
    } catch {
      /* ignore unreadable files — same tolerant behaviour as the BOM tab */
    }
  };

  const exportCurrent = () => {
    const aoa = [EXPORT_HEADERS];
    items.forEach((it) => {
      const v = boqLineVariancePct(it, oh, pr);
      aoa.push([
        it.itemNo, it.scope, it.description, it.unit,
        num(it.quantity), num(it.tenderRate), num(it.materialRate), num(it.labourRate),
        Math.round(boqLineOurRate(it, oh, pr) * 100) / 100,
        Math.round(boqLineAmount(it, oh, pr) * 100) / 100,
        v == null ? '' : Math.round(v * 10) / 10,
      ]);
    });
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!cols'] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    EXPORT_HEADERS.forEach((_, c) => {
      const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = HEADER_STYLE;
    });
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'BOQ');
    XLSXStyle.writeFile(wb, `${tender.tenderNumber || 'tender'}_BOQ.xlsx`);
  };

  const bidTotal = boqBidTotal(tender);
  const costTotal = boqCostTotal(tender);
  const marginPct = boqEffectiveProfitPct(tender);
  const tenderTotal = boqTenderTotal(tender);
  const overallVar = tenderTotal > 0 ? ((bidTotal - tenderTotal) / tenderTotal) * 100 : null;

  const renderVariance = (it) => {
    const v = boqLineVariancePct(it, oh, pr);
    if (v == null) return <span className="tnd-muted">—</span>;
    return <span className={`tnd-var ${varClass(v)}`}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>;
  };

  return (
    <div>
      {/* Global controls */}
      <div className="tnd-boq-controls">
        <div className="tnd-boq-control">
          <label>Overhead %</label>
          <input className="tnd-inp" type="number" min="0" step="any" value={oh}
            onChange={(e) => setKnob('overheadPct', e.target.value)} />
        </div>
        <div className="tnd-boq-control">
          <label>Profit %</label>
          <input className="tnd-inp" type="number" min="0" step="any" value={pr}
            onChange={(e) => setKnob('profitPct', e.target.value)} />
        </div>
        <div className="tnd-boq-spacer" />
        <div className="tnd-boq-tools">
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={downloadTemplate}>⬇ Template</button>
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={() => fileRef.current?.click()}>⬆ Import</button>
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={exportCurrent} disabled={!items.length}>⇪ Export</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFilePicked} />
        </div>
      </div>

      {/* Add scope */}
      <div className="tnd-row-actions" style={{ marginBottom: 14 }}>
        <input className="tnd-inp" style={{ maxWidth: 220 }} placeholder="New scope (e.g. Supply, Civil)…"
          value={newScope} onChange={(e) => setNewScope(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addScopeGroup(); }} />
        <button className="tnd-btn tnd-btn-secondary tnd-btn-sm" onClick={addScopeGroup} disabled={!newScope.trim()}>＋ Add scope group</button>
      </div>

      {items.length === 0 ? (
        <div className="tnd-empty">No BOQ line items yet. Add a scope group above, import an Excel sheet, or download the template.</div>
      ) : (
        scopeOrder.map((scope) => {
          const secItems = items.filter((it) => (it.scope || '') === scope);
          const secTotal = secItems.reduce((s, it) => s + boqLineAmount(it, oh, pr), 0);
          return (
            <div key={scope || '__unassigned__'} className="tnd-scope-group">
              <div className="tnd-scope-head">
                <span>{scopeLabel(scope)}</span>
                <span className="tnd-scope-total">{fmtINR(secTotal)}</span>
              </div>
              <div className="tnd-table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <table className="tnd-table" style={{ minWidth: 1120 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 66 }}>Item No</th>
                      <th style={{ minWidth: 200 }}>Description</th>
                      <th style={{ width: 62 }}>Unit</th>
                      <th style={{ width: 74 }}>Qty</th>
                      <th style={{ width: 104 }}>Tender Rate</th>
                      <th style={{ width: 104 }}>Material Rate</th>
                      <th style={{ width: 104 }}>Labour Rate</th>
                      <th style={{ width: 104 }}>Our Rate</th>
                      <th style={{ width: 116 }}>Amount</th>
                      <th style={{ width: 86 }}>Variance</th>
                      <th style={{ width: 120 }}>Move to</th>
                      <th style={{ width: 38 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {secItems.map((it) => (
                      <tr key={it._key}>
                        <td><input className="tnd-inp" value={it.itemNo} onChange={(e) => updItem(it._key, { itemNo: e.target.value })} /></td>
                        <td><input className="tnd-inp" value={it.description} placeholder="Description" onChange={(e) => updItem(it._key, { description: e.target.value })} /></td>
                        <td><input className="tnd-inp" value={it.unit} onChange={(e) => updItem(it._key, { unit: e.target.value })} /></td>
                        <td><input className="tnd-inp" type="number" min="0" step="any" value={it.quantity} onChange={(e) => updItem(it._key, { quantity: e.target.value })} /></td>
                        <td><input className="tnd-inp" type="number" min="0" step="any" value={it.tenderRate} placeholder="NIT rate" onChange={(e) => updItem(it._key, { tenderRate: e.target.value })} /></td>
                        <td><input className="tnd-inp" type="number" min="0" step="any" value={it.materialRate} onChange={(e) => updItem(it._key, { materialRate: e.target.value })} /></td>
                        <td><input className="tnd-inp" type="number" min="0" step="any" value={it.labourRate} onChange={(e) => updItem(it._key, { labourRate: e.target.value })} /></td>
                        <td className="tnd-num">{fmtINR(boqLineOurRate(it, oh, pr))}</td>
                        <td className="tnd-num">{fmtINR(boqLineAmount(it, oh, pr))}</td>
                        <td className="tnd-num">{renderVariance(it)}</td>
                        <td>
                          <select className="tnd-inp" value={it.scope || ''} onChange={(e) => updItem(it._key, { scope: e.target.value })}>
                            {scopeOrder.map((s) => <option key={s || '__u'} value={s}>{scopeLabel(s)}</option>)}
                          </select>
                        </td>
                        <td><button className="tnd-icon-x" title="Remove" onClick={() => removeItem(it._key)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="tnd-add-row" style={{ marginTop: 8 }} onClick={() => addItemTo(scope)}>
                ＋ Add line to {scopeLabel(scope)}
              </button>
            </div>
          );
        })
      )}

      {/* Totals */}
      <div className="tnd-boq-statrow">
        <div className="tnd-boq-stat">Line items<strong>{items.length}</strong></div>
        <div className="tnd-boq-stat">Raw cost (material + labour)<strong>{fmtINR(costTotal)}</strong></div>
        <div className="tnd-boq-stat">Effective margin<strong>{marginPct.toFixed(1)}%</strong></div>
        <div className="tnd-boq-stat">Tender estimated value<strong>{tenderTotal > 0 ? fmtINR(tenderTotal) : '—'}</strong></div>
        <div className="tnd-boq-stat">Bid vs tender
          <strong className={overallVar == null ? '' : varClass(overallVar)}>
            {overallVar == null ? '—' : `${overallVar > 0 ? '+' : ''}${overallVar.toFixed(1)}%`}
          </strong>
        </div>
      </div>
      <div className="tnd-boq-grand">
        <span>Total Bid Value</span>
        <span className="tnd-boq-grand-val">{fmtINR(bidTotal)}</span>
      </div>
    </div>
  );
}
