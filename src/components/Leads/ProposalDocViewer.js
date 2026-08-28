// ─────────────────────────────────────────────────────────────────────────────
// ProposalDocViewer — preview a generated Solar proposal.
//
// The backend renders the proposal to PDF alongside the .docx (see
// SolarProposalPdfService) purely so it can be shown here. The .docx itself is
// NOT previewable in a browser: its cover is a DrawingML grouped shape, which no
// client-side renderer draws — verified by rendering the skeleton headlessly and
// getting the same output with and without the VML fallback.
//
// The .docx remains the deliverable, so Download Word always re-fetches the Word
// file, never the PDF being displayed. Download PDF saves the blob already on
// screen — the two are renditions of the same version, so this cannot disagree
// with what the preview showed.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { X, Download, FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import './ProposalDocViewer.css';

const ProposalDocViewer = ({
  open, title, version, loading, blob, unavailable, error,
  onClose, onDownloadWord, onDownloadPdf, onRegenerate,
}) => {
  const [url, setUrl] = useState(null);

  // This effect OWNS the object URL. Keyed on `blob` alone — not `open` — so
  // switching versions while the modal stays open still swaps it, and React's
  // cleanup guarantees exactly one revoke per URL on change, close and unmount.
  // The parent sets blob:null at the start of each view, which is what fires the
  // revoke for the previous version.
  useEffect(() => {
    if (!blob) { setUrl(null); return undefined; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => { URL.revokeObjectURL(u); setUrl(null); };
  }, [blob]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Hooks stay above this early return so their cleanup still runs on close.
  if (!open) return null;

  const showDoc = !loading && !unavailable && !error && url;

  return (
    <div className="pdv-overlay" onClick={onClose}>
      <div className="pdv-modal" onClick={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={title || 'Proposal document'}>

        <div className="pdv-head">
          <span className="pdv-head-ico"><FileText size={17} strokeWidth={2} /></span>
          <div className="pdv-head-text">
            <strong className="pdv-title">{title || 'Proposal document'}</strong>
            {version ? <span className="pdv-version">Version {version} · PDF preview</span> : null}
          </div>

          {/* Always enabled: it re-fetches the .docx and never depends on the
              PDF blob currently on screen. */}
          <button type="button" className="pdv-btn pdv-btn-sec" onClick={onDownloadWord}>
            <Download size={14} strokeWidth={2} /> Download Word
          </button>

          {/* Only once the PDF is actually on screen — there is nothing to save
              while it is still loading, or when this version has none. */}
          {onDownloadPdf && showDoc && (
            <button type="button" className="pdv-btn pdv-btn-sec" onClick={onDownloadPdf}>
              <Download size={14} strokeWidth={2} /> Download PDF
            </button>
          )}

          {/* The escape hatch for iOS Safari, which renders only page 1 of a PDF
              inside an iframe. Not a nicety — it is the only way to read the rest. */}
          {url && (
            <a className="pdv-btn pdv-btn-sec" href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} strokeWidth={2} /> Open
            </a>
          )}

          <button type="button" className="pdv-icon-close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="pdv-body" aria-busy={loading ? 'true' : 'false'}>
          {loading && (
            <div className="pdv-state">
              <span className="pdv-spinner" />
              <p>Preparing the preview…</p>
            </div>
          )}

          {!loading && unavailable && (
            <div className="pdv-state">
              <FileText size={30} strokeWidth={1.8} />
              <p><strong>No preview for {version ? `version ${version}` : 'this version'}</strong></p>
              <p className="pdv-state-sub">
                It was generated before PDF previews existed, and the inputs it was built from
                weren’t saved — so it can’t be re-rendered. The Word file is unaffected: it is
                the document that was sent.
              </p>
              <div className="pdv-actions">
                <button type="button" className="pdv-btn pdv-btn-pri" onClick={onDownloadWord}>
                  <Download size={14} strokeWidth={2} /> Download Word
                </button>
                {onRegenerate && (
                  <button type="button" className="pdv-btn pdv-btn-sec" onClick={onRegenerate}>
                    Re-generate as a new version
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && !unavailable && error && (
            <div className="pdv-state pdv-state--error">
              <AlertTriangle size={30} strokeWidth={1.8} />
              <p>{error}</p>
              <p className="pdv-state-sub">The Word document is unaffected.</p>
              <div className="pdv-actions">
                <button type="button" className="pdv-btn pdv-btn-pri" onClick={onDownloadWord}>
                  <Download size={14} strokeWidth={2} /> Download Word
                </button>
              </div>
            </div>
          )}

          {/* key={url} gives each document a fresh viewer, so it opens at page 1
              instead of inheriting the previous version's scroll position. */}
          {showDoc && (
            <iframe key={url} src={url} className="pdv-frame" title={title || 'Proposal preview'} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalDocViewer;
