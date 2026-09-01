// src/components/borrowers/DocumentViewerModal.js
//
// Reads the stored sanction letter inside the page. Two render paths, because
// browsers can display a PDF and cannot display a .docx:
//
//   PDF  → blob URL in an iframe, the browser's own viewer
//   DOCX → HTML converted server-side by SanctionDocHtmlRenderer
//
// The HTML is produced from the document by POI with every character escaped
// before it becomes markup, so dangerouslySetInnerHTML here is rendering a
// server-sanitised fragment, not raw upload content.

import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Loader2, AlertTriangle } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import '../../pages-css/BorrowerRegistry.css';

const DocumentViewerModal = ({ sanctionId, fileName, onClose }) => {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    (async () => {
      try {
        const meta = await borrowerApi.previewDoc(sanctionId);
        if (cancelled) return;

        if (meta.kind === 'PDF') {
          objectUrl = await borrowerApi.docBlobUrl(sanctionId);
          if (cancelled) return;
          setState({ status: 'pdf', url: objectUrl, meta });
        } else {
          setState({ status: 'html', html: meta.html || '', meta });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ status: 'error', message: e.message || 'Could not open the document' });
        }
      }
    })();

    return () => {
      cancelled = true;
      // Blob URLs leak until revoked; the browser won't do it on unmount.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sanctionId]);

  // Escape closes, matching the other modals in the module.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = state.meta?.fileName || fileName || 'Sanction letter';

  return (
    <div className="br-modal-backdrop" onMouseDown={onClose}>
      <div
        className="br-modal br-modal-viewer"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Viewing ${displayName}`}
      >
        <div className="br-modal-head">
          <div className="br-viewer-title">
            <FileText size={18} className="br-viewer-icon" aria-hidden="true" />
            <div className="br-viewer-title-text">
              <h3 className="br-modal-title">{displayName}</h3>
              {state.meta?.size ? (
                <p className="br-modal-sub">{Math.round(state.meta.size / 1024)} KB</p>
              ) : null}
            </div>
          </div>
          <div className="br-viewer-actions">
            <button
              type="button"
              className="br-btn br-btn-sm"
              onClick={() => borrowerApi.downloadDocFile(sanctionId, displayName)}
            >
              <Download size={14} aria-hidden="true" />
              <span>Download</span>
            </button>
            <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="br-viewer-body">
          {state.status === 'loading' && (
            <div className="br-viewer-centered">
              <Loader2 size={20} className="br-spin" aria-hidden="true" />
              <span>Opening the document…</span>
            </div>
          )}

          {state.status === 'error' && (
            <div className="br-viewer-centered">
              <span className="br-tone-warn">{state.message}</span>
              <button
                type="button"
                className="br-btn br-btn-sm"
                onClick={() => borrowerApi.downloadDocFile(sanctionId, displayName)}
              >
                <Download size={14} aria-hidden="true" />
                Download instead
              </button>
            </div>
          )}

          {state.status === 'pdf' && (
            <iframe className="br-viewer-frame" src={state.url} title={displayName} />
          )}

          {state.status === 'html' && (
            <div className="br-viewer-doc">
              {state.meta?.degraded && (
                <div className="br-viewer-degraded">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>
                    This letter couldn't be rendered with its original formatting, so it's
                    shown as plain text. Download it to see the formatted version.
                  </span>
                </div>
              )}
              {/* Server-escaped fragment from SanctionDocHtmlRenderer. */}
              <div dangerouslySetInnerHTML={{ __html: state.html }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;