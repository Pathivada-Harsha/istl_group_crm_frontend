// ─────────────────────────────────────────────────────────────────────────────
//  TenderExcelImportDialog — picks the two files an Excel import needs: the
//  filled template and the tender PDF it was filled from.
//
//  The PDF is required because every imported value is checked against it —
//  whichever assistant filled the sheet, the document is what is trusted. A
//  saved tender that already has its PDF can reuse that one instead.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';

const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function TenderExcelImportDialog({
  storedPdfName = '', pendingPdf = null, busy = false, onImport, onCancel,
}) {
  const [excel, setExcel] = useState(null);
  const [pdf, setPdf] = useState(pendingPdf);
  const [useStored, setUseStored] = useState(!pendingPdf && !!storedPdfName);
  const excelRef = useRef(null);
  const pdfRef = useRef(null);

  const pick = (setter) => (e) => {
    const f = e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';
    if (f) setter(f);
  };

  const pdfReady = useStored ? !!storedPdfName : !!pdf;
  const canImport = !busy && !!excel && pdfReady;

  return (
    <div className="tnd-modal-overlay" role="dialog" aria-modal="true" aria-label="Import from Excel">
      <div className="tnd-modal tnd-xl-dialog">
        <div className="tnd-modal-head">
          <div className="tnd-modal-title">Import from Excel</div>
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={onCancel} disabled={busy} aria-label="Close">✕</button>
        </div>

        <p className="tnd-xl-dialog-lead">
          Choose the filled template and the tender PDF it was filled from. Every value is checked
          against the PDF, and nothing is saved until you review it.
        </p>

        <div className="tnd-xl-dialog-files">
          <div className="tnd-xl-file">
            <span className="tnd-xl-file-step">1</span>
            <div className="tnd-xl-file-body">
              <div className="tnd-xl-file-label">Filled Excel template</div>
              <div className={`tnd-xl-file-name${excel ? '' : ' is-empty'}`}>{excel ? excel.name : 'No file chosen'}</div>
            </div>
            <input ref={excelRef} type="file" accept={XLSX_ACCEPT} style={{ display: 'none' }} onChange={pick(setExcel)} />
            <button type="button" className="tnd-btn tnd-btn-sm" onClick={() => excelRef.current && excelRef.current.click()} disabled={busy}>
              {excel ? 'Change' : 'Choose .xlsx'}
            </button>
          </div>

          <div className="tnd-xl-file">
            <span className="tnd-xl-file-step">2</span>
            <div className="tnd-xl-file-body">
              <div className="tnd-xl-file-label">Tender PDF</div>
              {storedPdfName && (
                <label className="tnd-xl-file-stored">
                  <input type="checkbox" checked={useStored} onChange={(e) => setUseStored(e.target.checked)} disabled={busy} />
                  Use the PDF already on this tender ({storedPdfName})
                </label>
              )}
              {!useStored && (
                <div className={`tnd-xl-file-name${pdf ? '' : ' is-empty'}`}>{pdf ? pdf.name : 'No file chosen'}</div>
              )}
            </div>
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={pick(setPdf)} />
            {!useStored && (
              <button type="button" className="tnd-btn tnd-btn-sm" onClick={() => pdfRef.current && pdfRef.current.click()} disabled={busy}>
                {pdf ? 'Change' : 'Choose .pdf'}
              </button>
            )}
          </div>
        </div>

        <div className="tnd-modal-foot">
          <span className="tnd-muted tnd-import-foot-note">
            {!excel ? 'Choose the filled .xlsx.' : !pdfReady ? 'Choose the tender PDF — values are checked against it.' : 'Ready to read both files.'}
          </span>
          <button className="tnd-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="tnd-btn tnd-btn-primary" disabled={!canImport}
            onClick={() => onImport({ excel, pdf: useStored ? null : pdf, useStored })}>
            {busy ? 'Reading…' : 'Import & review'}
          </button>
        </div>
      </div>
    </div>
  );
}
