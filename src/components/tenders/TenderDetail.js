// ─────────────────────────────────────────────────────────────────────────────
//  TenderDetail — full-page 7-tab tender form (mirrors Leads' LeadDetailPage).
//
//  Holds ONE working-copy `tender` object; every tab edits it. "Save Tender"
//  persists it to the API (POST on first save of a new tender, PUT thereafter).
//  Workflow actions commit immediately via `commit`.
//
//  Also hosts the "Import from PDF" flow: picking a NIT/tender PDF parses it on
//  the backend (stateless), and the result goes to a review modal — nothing
//  reaches the form until the user ticks it. The file itself is stored on Save.
//  A "View PDF" button opens the stored (or freshly-picked) file in an iframe
//  modal, mirroring OrderBook's attached-PO viewer.
//
//  The Excel template is the manual-assist path: "Excel Template" downloads a
//  workbook pre-filled with this tender (for an LLM to complete from the PDF),
//  and "Import from Excel" reads a filled one into the same review modal. That
//  review's confirm is "Apply & Save", and the save carries the file's name so
//  the server records the import in the tender's history.
//
//  Tab order: Basic Info → Eligibility → Documents → Rate Analysis & Bid →
//  Workflow → Submission → Result.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import {
  computeEligibility, nextStatusForEligibility, statusBadgeClass,
  blankBoqItem, blankCriterion, blankDocument, genKey,
} from '../../services/tenderData';
import tenderApi from '../../services/tenderApi';
import TenderBasicInfoTab from './TenderBasicInfoTab';
import TenderEligibilityTab from './TenderEligibilityTab';
import TenderDocumentsTab from './TenderDocumentsTab';
import TenderBoqTab from './TenderBoqTab';
import TenderWorkflowTab from './TenderWorkflowTab';
import TenderSubmissionTab from './TenderSubmissionTab';
import TenderEmdTab from './TenderEmdTab';
import TenderResultTab from './TenderResultTab';
import TenderImportReviewModal from './TenderImportReviewModal';
import TenderExcelImportDialog from './TenderExcelImportDialog';

const TABS = [
  { k: 'basic', l: 'Basic Info' },
  { k: 'eligibility', l: 'Eligibility' },
  { k: 'documents', l: 'Documents' },
  { k: 'boq', l: 'Rate Analysis & Bid' },
  { k: 'workflow', l: 'Workflow' },
  { k: 'emd', l: 'EMD' },
  { k: 'submission', l: 'Submission' },
  { k: 'result', l: 'Result' },
];

// Eligibility gate: Basic Info + Eligibility are always open (you can't qualify
// without them); every downstream (bid-preparation) tab stays LOCKED until the
// Eligibility check computes to GO. NO_GO and PENDING both keep them locked —
// overriding a failing criterion (on the Eligibility tab) is the way through.
// EMD is deliberately NOT gated: money out with a client stays trackable whatever
// the eligibility state.
const GATED_TABS = new Set(['documents', 'boq', 'workflow', 'submission', 'result']);

// Turn the rows the user ticked in the review modal into a patch. Only what was
// ticked is written — including over a value already in the form, because the
// user looked at both and chose. The child arrays arrive as whole collections.
function patchFromReview(selection, current) {
  const out = {};
  Object.entries(selection || {}).forEach(([k, v]) => {
    if (k === 'documents') {
      // The tender's own checklist replaces the generic default list, but a row
      // someone has already worked on (status set, link or notes filled) is
      // progress, and survives unless the tender asks for the same document.
      const incoming = v.map((d) => ({
        ...blankDocument(d.documentName), notes: d.notes || '', _key: genKey(),
      }));
      const names = new Set(incoming.map((d) => d.documentName.trim().toLowerCase()));
      const worked = (current.documents || []).filter((d) =>
        (d.status !== 'pending' || (d.link || '').trim() || (d.notes || '').trim())
        && !names.has((d.documentName || '').trim().toLowerCase()));
      out.documents = [...incoming, ...worked];
    } else if (k === 'boqItems') {
      // `page` / `sourceText` ride along for the review's provenance only; they
      // are not part of a BOQ row and must not be saved as one.
      out.boqItems = v.map(({ page, sourceText, ...r }) => ({ ...blankBoqItem(r.scope || ''), ...r, _key: genKey() }));
    } else if (k === 'eligibilityCriteria') {
      // `note` explains a value the checker blanked and `sourceText` is the
      // spreadsheet's quote; both belong to the review. A verified row brings
      // the PDF's own clause and page instead (clauseText / sourcePage).
      out.eligibilityCriteria = v.map(({ note, sourceText, ...r }) => ({
        ...blankCriterion(r.category || 'Technical'), ...r,
        altGroup: r.altGroup || '', tier: r.tier || '',
        clauseText: r.clauseText || '', sourcePage: r.sourcePage || '',
        _key: genKey(),
      }));
    } else {
      out[k] = v;
    }
  });
  return out;
}

export default function TenderDetail({
  initial, isNew, initialExcelFile = null, canCreate = true, canEdit = true, onCreate, onUpdate, onBack,
}) {
  const [tender, setTender] = useState(initial);
  const [isNewState, setIsNewState] = useState(isNew);
  const [activeTab, setActiveTab] = useState('basic');   // useState only — no browser storage
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');                // '' | 'saved' | 'error'
  const [errMsg, setErrMsg] = useState('');
  const flashTimer = useRef(null);

  // ── source-PDF state ──
  const fileInputRef = useRef(null);
  const pendingPdfRef = useRef(null);                    // File picked but not yet stored (uploaded on Save)
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  // Parsed values wait here until the user picks which ones to keep — the
  // import writes nothing on its own.
  const [review, setReview] = useState({ open: false, parse: null, file: null });
  const [viewer, setViewer] = useState({ open: false, loading: false, url: '', err: '' });
  const viewerBlobRef = useRef(null);                    // objectURL to revoke on close

  // ── Excel template state ──
  // An import is a review like the PDF one, but its confirm button saves. The
  // import's provenance rides along on that save (and on a retry, if the save
  // fails) so the server can record it in the tender's history.
  const pendingImportRef = useRef(null);                 // { importSource, importFileName, importSummary, importBulkAcks }
  const autoImportedRef = useRef(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelDialog, setExcelDialog] = useState(false);
  // `pdf` is the tender PDF picked with the Excel; it becomes the tender's
  // source PDF when the import is applied.
  const [excelReview, setExcelReview] = useState({ open: false, result: null, fileName: '', pdf: null });

  const patch = (changes) => setTender((prev) => ({ ...prev, ...changes }));

  const flashSaved = () => {
    setFlash('saved');
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(''), 1800);
  };

  // commit the working copy to the API (Save Tender + immediate workflow actions)
  const commit = async (next) => {
    const finalized = { ...next, eligibilityDecision: computeEligibility(next.eligibilityCriteria) };
    setTender(finalized);
    setSaving(true);
    setFlash('');
    try {
      const payload = pendingImportRef.current ? { ...finalized, ...pendingImportRef.current } : finalized;
      const saved = isNewState
        ? await onCreate(payload)
        : await onUpdate(finalized.id, payload);
      pendingImportRef.current = null;
      const savedId = (saved && saved.id != null) ? saved.id : finalized.id;
      // The server can add history entries of its own (an Excel import); adopt
      // its log so the next whole-object save doesn't drop them.
      setTender((prev) => ({
        ...prev,
        ...(savedId != null ? { id: savedId } : {}),
        ...(saved && Array.isArray(saved.approvalLog) ? { approvalLog: saved.approvalLog } : {}),
      }));
      if (isNewState) setIsNewState(false);

      // Store the just-imported PDF now that we have an id (OrderBook's
      // save-record-then-upload-file 2-step). Parse is stateless, so the file
      // is re-sent once here.
      if (pendingPdfRef.current && savedId != null) {
        const w = await tenderApi.uploadSourcePdf(savedId, pendingPdfRef.current);
        pendingPdfRef.current = null;
        setTender((prev) => ({
          ...prev,
          hasSourcePdf: true,
          sourcePdfName: (w && w.sourcePdfName) || prev.sourcePdfName,
          sourcePdfMimeType: (w && w.sourcePdfMimeType) || prev.sourcePdfMimeType,
        }));
      }
      flashSaved();
    } catch (e) {
      setErrMsg(e.message || 'Save failed');
      setFlash('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => commit(tender);

  const canSave = isNewState ? canCreate : canEdit;
  const hasPdf = !!(tender.hasSourcePdf || tender.sourcePdfName);
  const tabProps = { tender, setTender, patch, commit };

  // ── eligibility gate: downstream tabs unlock only when the check is GO ──
  const eligDecision = computeEligibility(tender.eligibilityCriteria); // GO | NO_GO | PENDING
  const gateOpen = eligDecision === 'GO';
  const isTabLocked = (key) => GATED_TABS.has(key) && !gateOpen;
  const lockReason = eligDecision === 'NO_GO'
    ? 'Eligibility failed — meet or override the failing criteria to unlock.'
    : 'Complete the Eligibility check (GO) to unlock this step.';
  const goToTab = (key) => { if (!isTabLocked(key)) setActiveTab(key); };

  // Safety net: if the active tab becomes locked (e.g. a criterion flips to fail),
  // snap back to Eligibility so the user never sits on a now-locked step.
  useEffect(() => {
    if (GATED_TABS.has(activeTab) && !gateOpen) setActiveTab('eligibility');
  }, [gateOpen, activeTab]);

  // Keep the tender Status in step with the eligibility decision (forward-only
  // nudges; Submitted/Under Evaluation/Won/Lost are never auto-changed).
  useEffect(() => {
    setTender((prev) => {
      const next = nextStatusForEligibility(prev.status, eligDecision);
      return next === prev.status ? prev : { ...prev, status: next };
    });
  }, [eligDecision]);

  // ── import: parse a picked PDF, then let the user review before anything
  //    reaches the form. The file is stashed for Save either way. ──
  const onPickPdf = () => fileInputRef.current && fileInputRef.current.click();

  const runParse = async (file, useAi) => {
    setImporting(true);
    setImportMsg('');
    try {
      const parse = await tenderApi.parsePdf(file, { ai: useAi });
      setReview({ open: true, parse, file });
    } catch (err) {
      // A failed re-read must not take the regex result down with it — the user
      // still has a review to work through.
      if (!useAi) setReview({ open: false, parse: null, file: null });
      setImportMsg(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const onPdfChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';                   // allow re-picking the same file
    if (!file) return;
    pendingPdfRef.current = file;                        // attached on Save regardless
    patch({ sourcePdfName: file.name });
    await runParse(file, false);
  };

  // Escalation is the user's call, and is offered whether the parse came back
  // incomplete or came back looking plausible but wrong.
  const onRereadWithAi = () => {
    if (review.file) runParse(review.file, true);
  };

  const onApplyReview = (selection) => {
    const changes = patchFromReview(selection, tender);
    patch(changes);
    const n = Object.keys(changes).length;
    setImportMsg(n
      ? `Applied ${n} field${n === 1 ? '' : 's'} — review & Save`
      : 'Nothing applied');
    setReview({ open: false, parse: null, file: null });
  };

  const onCancelReview = () => {
    setReview({ open: false, parse: null, file: null });
    // The file still attaches on Save — cancelling declines the values, not the PDF.
    setImportMsg('Import cancelled — no field was changed');
  };

  // ── Excel: template download (pre-filled) and import → review → Apply & Save ──
  const onDownloadTemplate = async () => {
    setExcelBusy(true);
    setImportMsg('');
    try {
      await tenderApi.downloadExcelTemplate(tender);
    } catch (err) {
      setImportMsg(err.message || 'Could not download the template');
    } finally {
      setExcelBusy(false);
    }
  };

  // { excel, pdf, useStored }: the filled template plus the PDF to check it
  // against — a freshly picked one, or the one this tender already stores.
  const runExcelImport = async ({ excel, pdf, useStored }) => {
    setExcelBusy(true);
    setImportMsg('');
    try {
      const result = await tenderApi.importExcel({
        file: excel, pdf, tenderId: useStored && !isNewState ? tender.id : null,
      });
      setExcelDialog(false);
      setExcelReview({ open: true, result, fileName: excel.name, pdf: pdf || null });
    } catch (err) {
      setImportMsg(err.message || 'Import failed');
      setExcelDialog(false);
    } finally {
      setExcelBusy(false);
    }
  };

  // Opened from the list's "Import from Excel": read the files straight away.
  useEffect(() => {
    if (initialExcelFile && !autoImportedRef.current) {
      autoImportedRef.current = true;
      runExcelImport(initialExcelFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `bulkAcks`: [{ table, rows }] for every table whose unverified rows were
  // confirmed with one tick — the server writes each into the history.
  const onApplyExcel = (selection, summary, bulkAcks = []) => {
    pendingImportRef.current = {
      importSource: 'excel', importFileName: excelReview.fileName, importSummary: summary,
      importBulkAcks: bulkAcks,
    };
    const next = { ...tender, ...patchFromReview(selection, tender) };
    if (excelReview.pdf) {
      // The PDF the values were checked against becomes the tender's own.
      pendingPdfRef.current = excelReview.pdf;
      next.sourcePdfName = excelReview.pdf.name;
    }
    setExcelReview({ open: false, result: null, fileName: '', pdf: null });
    setImportMsg('');
    commit(next);
  };

  const onCancelExcel = () => {
    setExcelReview({ open: false, result: null, fileName: '', pdf: null });
    setImportMsg('Excel import cancelled — nothing was changed');
  };

  // ── viewer: blob for a stored tender, or the local file if not yet saved ──
  const revokeViewerBlob = () => {
    if (viewerBlobRef.current) { URL.revokeObjectURL(viewerBlobRef.current); viewerBlobRef.current = null; }
  };

  const openViewer = async () => {
    revokeViewerBlob();
    setViewer({ open: true, loading: true, url: '', err: '' });
    try {
      let url;
      if (pendingPdfRef.current) {
        url = URL.createObjectURL(pendingPdfRef.current);   // not saved yet — preview local file
      } else {
        url = await tenderApi.downloadSourcePdfBlobUrl(tender.id);
      }
      viewerBlobRef.current = url;
      setViewer({ open: true, loading: false, url, err: '' });
    } catch (err) {
      setViewer({ open: true, loading: false, url: '', err: err.message || 'Could not load PDF' });
    }
  };

  const closeViewer = () => {
    revokeViewerBlob();
    setViewer({ open: false, loading: false, url: '', err: '' });
  };

  return (
    <div className="leads-enquiries-container tnd-detail">
      {/* Back link — its own row, above the title */}
      <div className="tnd-detail-backrow">
        <button className="tnd-back-btn" onClick={onBack}>← Back to Tenders</button>
      </div>

      {/* Title row (full width) */}
      <div className="tnd-detail-titlerow">
        <div className="tnd-detail-heading">
          <h2 className="tnd-detail-title">{tender.tenderName || (isNewState ? 'New Tender' : 'Untitled Tender')}</h2>
          <span className="tnd-detail-sub">
            {tender.tenderNumber || 'No tender number'}{tender.issuingAuthority ? ` · ${tender.issuingAuthority}` : ''}
          </span>
        </div>
        <div className="tnd-detail-actions">
          <span className={`leads-enquiries-badge ${statusBadgeClass(tender.status)}`}>{tender.status}</span>
          {importMsg && <span className="tnd-muted" style={{ fontSize: 12 }} title={importMsg}>{importMsg}</span>}
          {flash === 'saved' && <span className="tnd-saved-flash">✓ Saved</span>}
          {flash === 'error' && <span style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }} title={errMsg}>⚠ {errMsg}</span>}
          {!canSave && <span className="tnd-muted" style={{ fontSize: 12 }}>Read-only</span>}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={onPdfChosen}
          />
          <button
            className="tnd-btn"
            onClick={onPickPdf}
            disabled={importing || !canSave}
            title={!canSave ? 'You do not have permission to edit tenders' : 'Extract fields from a tender PDF'}
          >
            {importing ? 'Parsing…' : '📄 Import from PDF'}
          </button>
          {hasPdf && (
            <button className="tnd-btn" onClick={openViewer} title="View the attached tender PDF">
              👁 View PDF
            </button>
          )}

          <button
            className="tnd-btn"
            onClick={onDownloadTemplate}
            disabled={excelBusy}
            title="Download the Excel template pre-filled with this tender's current values"
          >
            ⬇ Excel Template
          </button>
          <button
            className="tnd-btn"
            onClick={() => setExcelDialog(true)}
            disabled={excelBusy || saving || !canSave}
            title={!canSave ? 'You do not have permission to edit tenders' : 'Import a filled template with its tender PDF — you review it before anything is saved'}
          >
            {excelBusy ? 'Reading…' : '📥 Import from Excel'}
          </button>

          <button
            className="tnd-btn tnd-btn-primary"
            onClick={handleSave}
            disabled={saving || !canSave}
            title={!canSave ? 'You do not have permission to save tenders' : undefined}
          >
            {saving ? 'Saving…' : '💾 Save Tender'}
          </button>
        </div>
      </div>

      {/* Tab bar (reuses Leads' ld-tabs styling). Downstream tabs lock until the
          Eligibility check is GO. */}
      <div className="ld-tabs">
        {TABS.map((t) => {
          const locked = isTabLocked(t.k);
          return (
            <button
              key={t.k}
              className={`ld-tab${activeTab === t.k ? ' active' : ''}${locked ? ' tnd-tab-locked' : ''}`}
              onClick={() => goToTab(t.k)}
              disabled={locked}
              aria-disabled={locked}
              title={locked ? lockReason : undefined}
            >
              {locked ? `🔒 ${t.l}` : t.l}
            </button>
          );
        })}
      </div>

      {!gateOpen && (
        <div className="tnd-gate-hint">
          🔒 Documents, Rate Analysis, Workflow, Submission &amp; Result unlock once{' '}
          <button type="button" className="tnd-linklike" onClick={() => setActiveTab('eligibility')}>
            Eligibility
          </button>{' '}
          passes — currently <strong>{eligDecision === 'NO_GO' ? 'NO-GO' : 'Pending'}</strong>.
          Meet or override the failing criteria to proceed.
        </div>
      )}

      <div className="ld-tab-content">
        {activeTab === 'basic' && <TenderBasicInfoTab {...tabProps} />}
        {activeTab === 'eligibility' && <TenderEligibilityTab {...tabProps} />}
        {activeTab === 'documents' && <TenderDocumentsTab {...tabProps} />}
        {activeTab === 'boq' && <TenderBoqTab {...tabProps} />}
        {activeTab === 'workflow' && <TenderWorkflowTab {...tabProps} />}
        {activeTab === 'emd' && <TenderEmdTab {...tabProps} />}
        {activeTab === 'submission' && <TenderSubmissionTab {...tabProps} />}
        {activeTab === 'result' && <TenderResultTab {...tabProps} />}
      </div>

      {/* Source-PDF viewer modal (mirrors OrderBook's attached-PO viewer) */}
      {viewer.open && (
        <div className="tnd-file-viewer-overlay" onClick={closeViewer}>
          <div className="tnd-file-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tnd-file-viewer-header">
              <span className="tnd-file-viewer-title">{tender.sourcePdfName || 'Tender PDF'}</span>
              <div className="tnd-file-viewer-actions">
                {viewer.url && (
                  <a className="tnd-btn" href={viewer.url} target="_blank" rel="noopener noreferrer">Open</a>
                )}
                {viewer.url && (
                  <a className="tnd-btn" href={viewer.url} download={tender.sourcePdfName || 'tender.pdf'}>Download</a>
                )}
                <button className="tnd-btn" onClick={closeViewer}>✕ Close</button>
              </div>
            </div>
            <div className="tnd-file-viewer-body">
              {viewer.loading && <div className="tnd-file-viewer-loading">Loading…</div>}
              {!viewer.loading && viewer.err && <div className="tnd-file-viewer-error">⚠ {viewer.err}</div>}
              {!viewer.loading && viewer.url && (
                <iframe src={viewer.url} title={tender.sourcePdfName || 'Tender PDF'} className="tnd-file-viewer-iframe" />
              )}
            </div>
          </div>
        </div>
      )}

      {review.open && review.parse && (
        <TenderImportReviewModal
          parse={review.parse}
          tender={tender}
          fileName={review.file && review.file.name}
          busy={importing}
          onApply={onApplyReview}
          onReread={onRereadWithAi}
          onCancel={onCancelReview}
        />
      )}

      {excelDialog && (
        <TenderExcelImportDialog
          // A saved tender's stored PDF can be reused; one picked earlier in this
          // session (not yet uploaded) is offered as the default.
          storedPdfName={!isNewState && tender.hasSourcePdf && !pendingPdfRef.current ? tender.sourcePdfName || 'stored PDF' : ''}
          pendingPdf={pendingPdfRef.current}
          busy={excelBusy}
          onImport={runExcelImport}
          onCancel={() => setExcelDialog(false)}
        />
      )}

      {excelReview.open && excelReview.result && (
        <TenderImportReviewModal
          parse={excelReview.result}
          tender={tender}
          isNew={isNewState}
          fileName={excelReview.fileName}
          busy={saving}
          onApply={onApplyExcel}
          onCancel={onCancelExcel}
        />
      )}
    </div>
  );
}
