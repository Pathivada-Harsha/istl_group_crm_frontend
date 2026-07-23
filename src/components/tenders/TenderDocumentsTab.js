// ─────────────────────────────────────────────────────────────────────────────
//  Documents tab — the tender's document checklist. SINGLE OWNER of
//  tender.documents. Seeded from a ~14-item KYC/technical default list; rows can
//  be added, removed and edited. Links are plain pasted URLs (no file storage).
//
//  Nothing else in the module writes tender.documents — the Workflow tab tracks
//  department requests in tender.docRequests instead, so the two never clobber.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { blankDocument, seedDocuments, DOCUMENT_STATUSES } from '../../services/tenderData';

const STATUS_LABEL = { pending: 'Pending', ready: 'Ready', na: 'N/A' };

export default function TenderDocumentsTab({ tender, setTender }) {
  const docs = tender.documents || [];

  // Seed the default checklist the first time a tender is opened with none.
  useEffect(() => {
    if ((tender.documents || []).length === 0) {
      setTender((prev) => ((prev.documents || []).length === 0 ? { ...prev, documents: seedDocuments() } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upd = (key, changes) => setTender((prev) => ({
    ...prev, documents: prev.documents.map((d) => (d._key === key ? { ...d, ...changes } : d)),
  }));
  const add = () => setTender((prev) => ({ ...prev, documents: [...(prev.documents || []), blankDocument()] }));
  const remove = (key) => setTender((prev) => ({ ...prev, documents: prev.documents.filter((d) => d._key !== key) }));
  const restoreDefaults = () => setTender((prev) => ({ ...prev, documents: seedDocuments() }));

  const readyCount = docs.filter((d) => d.status === 'ready').length;
  const pendingCount = docs.filter((d) => d.status === 'pending').length;

  return (
    <div>
      <div className="tnd-card-title" style={{ marginBottom: 12 }}>
        <span>Document Checklist</span>
        <div className="tnd-row-actions">
          <span className="tnd-hint" style={{ margin: 0 }}>{readyCount} ready · {pendingCount} pending · {docs.length} total</span>
          <button className="tnd-btn tnd-btn-ghost tnd-btn-sm" onClick={restoreDefaults}>Restore default list</button>
          <button className="tnd-btn tnd-btn-primary tnd-btn-sm" onClick={add}>＋ Add document</button>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="tnd-empty">No documents. <button className="tnd-link-txt" onClick={restoreDefaults}>Load the default checklist</button>.</div>
      ) : (
        <div className="tnd-table-wrap">
          <table className="tnd-table">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Document</th>
                <th style={{ width: 130 }}>Status</th>
                <th style={{ minWidth: 200 }}>Link</th>
                <th style={{ minWidth: 180 }}>Notes</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d._key}>
                  <td>
                    <input className="tnd-inp" value={d.documentName}
                      placeholder="Document name"
                      onChange={(e) => upd(d._key, { documentName: e.target.value })} />
                  </td>
                  <td>
                    <select className="tnd-inp" value={d.status}
                      onChange={(e) => upd(d._key, { status: e.target.value })}>
                      {DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="tnd-inp" value={d.link} placeholder="https://…"
                      onChange={(e) => upd(d._key, { link: e.target.value })} />
                  </td>
                  <td>
                    <input className="tnd-inp" value={d.notes} placeholder="Notes"
                      onChange={(e) => upd(d._key, { notes: e.target.value })} />
                  </td>
                  <td>
                    <button className="tnd-icon-x" title="Remove" onClick={() => remove(d._key)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
