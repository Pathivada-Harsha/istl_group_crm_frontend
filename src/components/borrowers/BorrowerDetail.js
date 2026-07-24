// src/components/borrowers/BorrowerDetail.js
//
// The borrower record. Reached by clicking a row in the registry, and landed on
// directly after an import completes — that is the moment the derived panel
// earns its place, since the user sees nine values appear that they never typed.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Pencil, Plus, Download, MapPin, Mail, Phone,
  Building2, Users, Link2, Eye, Paperclip, RefreshCw,
} from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import BorrowerFormModal from './BorrowerFormModal';
import SanctionFormModal from './SanctionFormModal';
import DocumentViewerModal from './DocumentViewerModal';
import SanctionCompareModal from './SanctionCompareModal';
import '../../pages-css/BorrowerRegistry.css';

const BorrowerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [borrower, setBorrower] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editIdentity, setEditIdentity] = useState(false);
  const [sanctionModal, setSanctionModal] = useState(null); // { mode, initial }
  const [viewerFor, setViewerFor] = useState(null);         // sanction being read
  const [attaching, setAttaching] = useState(false);        // parse in flight
  const [compare, setCompare] = useState(null);             // { sanction, parsed, file }
  const attachRef = useRef(null);
  const attachTargetRef = useRef(null);

  const backToRegistry = useCallback(() => navigate('/lender/borrowers'), [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await borrowerApi.getById(id);
      setBorrower(data);
      setActiveId((prev) => prev || data?.sanctions?.[0]?.id || null);
    } catch (e) {
      setError(e.message || 'Could not load this borrower');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Escape returns to the registry — the same gesture that closes the modals,
  // so it stays consistent across the module.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !editIdentity && !sanctionModal && !viewerFor && !compare) {
        backToRegistry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [backToRegistry, editIdentity, sanctionModal, viewerFor, compare]);

  const openDocument = (sanction) => setViewerFor(sanction);

  /** Open the file picker for a specific sanction. */
  const startAttach = (sanction) => {
    attachTargetRef.current = sanction;
    attachRef.current?.click();
  };

  /**
   * A letter is being attached to a sanction whose values were typed by hand.
   * Parse it first and compare, so a mistyped figure surfaces against what the
   * lender actually wrote — the whole reason for re-reading rather than just
   * storing the file.
   */
  const handleAttachFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a cancel
    const sanction = attachTargetRef.current;
    if (!file || !sanction) return;

    setAttaching(true);
    setError('');
    try {
      const parsed = await borrowerApi.parseSanction(file);
      setCompare({ sanction, parsed, file });
    } catch (err) {
      // The document may be a scan, or an unreadable format. Storing it is
      // still useful even when nothing could be read from it.
      setCompare({ sanction, parsed: {}, file, parseFailed: err.message });
    } finally {
      setAttaching(false);
    }
  };

  /**
   * Apply whichever values the user chose to adopt, then store the document.
   * The save runs first: if it fails, nothing is attached and the record is
   * left exactly as it was.
   */
  const handleCompareConfirm = async (updates) => {
    const { sanction, file } = compare;
    setCompare(null);
    setAttaching(true);
    setError('');
    try {
      if (Object.keys(updates).length > 0) {
        await borrowerApi.saveSanction({
          ...sanction,
          ...updates,
          id: sanction.id,
          borrowerId: borrower.id,
        }, null);
      }
      await borrowerApi.uploadDoc(sanction.id, file);
      await load();
    } catch (err) {
      setError(err.message || 'Could not attach the letter');
    } finally {
      setAttaching(false);
    }
  };

  if (loading) return <div className="br-page"><p className="br-muted">Loading…</p></div>;

  if (!borrower) {
    return (
      <div className="br-page">
        <button type="button" className="br-back" onClick={backToRegistry}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to registry
        </button>
        <div className="br-banner br-banner-danger">{error || 'Borrower not found'}</div>
      </div>
    );
  }

  const sanctions = borrower.sanctions || [];
  const active = sanctions.find((s) => s.id === activeId) || sanctions[0] || null;
  const filled = borrower.identityFilled ?? 0;
  const total = borrower.identityTotal ?? 7;
  const pending = total - filled;

  return (
    <div className="br-page">
      {/* Back sits above the title on its own line, so it reads as leaving the
          page rather than as an action on the record. */}
      <button type="button" className="br-back" onClick={backToRegistry}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to registry
      </button>

      <div className="br-head">
        <div className="br-head-text">
          <button type="button" className="br-crumb" onClick={backToRegistry}>
            Lender · Borrower registry
          </button>
          <h1 className="br-title">{borrower.borrowerName}</h1>
          <p className="br-sub">
            {active
              ? `${active.refNo}${active.sanctionDate ? ` · ${active.sanctionDate}` : ''}`
              : 'No sanction letter on file'}
          </p>
        </div>
        <div className="br-head-actions">
          {active?.hasDocument && (
            <button
              type="button"
              className="br-btn"
              onClick={() => openDocument(active)}
            >
              <Eye size={15} aria-hidden="true" />
              View letter
            </button>
          )}
          <button type="button" className="br-btn" onClick={() => setEditIdentity(true)}>
            <Pencil size={15} aria-hidden="true" />
            Edit
          </button>
        </div>
      </div>

      {/* Provenance legend, keyed to the dot on each card header — so it is
          obvious which numbers the system worked out and which a person must
          still supply. */}
      <div className="br-legend">
        <span className="br-legend-item">
          <span className="br-dot br-dot-read" aria-hidden="true" />
          Read from the letter
        </span>
        <span className="br-legend-item">
          <span className="br-dot br-dot-calc" aria-hidden="true" />
          Calculated automatically
        </span>
        <span className="br-legend-item">
          <span className="br-dot br-dot-user" aria-hidden="true" />
          Entered by the user
        </span>
      </div>

      {/* The stored letter sits directly under the legend rather than at the
          foot of the page: it is the source every value above was read from,
          so View and Download should be reachable without scrolling past the
          whole record. */}
      {active && (
        <div className="br-docstrip">
          <FileText size={20} className="br-docstrip-icon" aria-hidden="true" />
          <div className="br-docstrip-text">
            <strong>
              {active.hasDocument ? 'Sanction letter stored' : 'No letter attached'}
            </strong>
            <span>
              {active.hasDocument ? (
                <>
                  {active.sanctionDocName}
                  {active.sanctionDocSize
                    ? ` · ${Math.round(active.sanctionDocSize / 1024)} KB`
                    : ''}
                </>
              ) : (
                'Attach the letter and its values will be checked against this record.'
              )}
            </span>
          </div>
          <div className="br-docstrip-actions">
            {active.hasDocument ? (
              <>
                <button
                  type="button"
                  className="br-btn br-btn-sm"
                  onClick={() => openDocument(active)}
                >
                  <Eye size={14} aria-hidden="true" />
                  View
                </button>
                <a className="br-btn br-btn-sm" href={borrowerApi.docDownloadUrl(active.id)}>
                  <Download size={14} aria-hidden="true" />
                  Download
                </a>
                <button
                  type="button"
                  className="br-btn br-btn-sm"
                  onClick={() => startAttach(active)}
                  disabled={attaching}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Replace
                </button>
              </>
            ) : (
              <button
                type="button"
                className="br-btn br-btn-sm br-btn-primary"
                onClick={() => startAttach(active)}
                disabled={attaching}
              >
                <Paperclip size={14} aria-hidden="true" />
                {attaching ? 'Reading…' : 'Attach letter'}
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={attachRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleAttachFile}
        hidden
      />

      {error && <div className="br-banner br-banner-danger">{error}</div>}

      {sanctions.length > 1 && (
        <div className="br-tabstrip" role="tablist">
          {sanctions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === active?.id}
              className={`br-tab ${s.id === active?.id ? 'br-tab-on' : ''}`}
              onClick={() => setActiveId(s.id)}
            >
              {s.refNo}
            </button>
          ))}
        </div>
      )}

      <div className="br-grid-2">
        <section className="br-card">
          <header className="br-card-head">
            <span className="br-dot br-dot-read" aria-hidden="true" />
            <h2 className="br-card-title">Sanction details</h2>
            {active?.source && <span className="br-chip">{sourceLabel(active.source)}</span>}
          </header>
          {active ? (
            <dl className="br-dl">
              <Row label="Lender" value={active.lenderName} />
              <Row label="Project" value={active.projectName} />
              <Row label="Category" value={active.category} />
              <Row label="Location" value={active.location} />
              <Row label="Project cost" value={active.projectCost} />
              <Row label="Sanctioned" value={active.sanctionedAmount} strong />
              <Row label="Debt : equity" value={active.debtEquityRatio} />
              <Row label="Interest" value={active.interestRateText} />
              <Row label="Tenor" value={active.tenorText} />
              <Row label="Scheduled COD" value={active.scheduledCod} />
            </dl>
          ) : (
            <div className="br-empty">
              <p>No sanction letter yet.</p>
              <button
                type="button"
                className="br-btn"
                onClick={() => setSanctionModal({ mode: 'create', initial: null })}
              >
                <Plus size={15} aria-hidden="true" />
                Add sanction
              </button>
            </div>
          )}
        </section>

        <section className="br-card">
          <header className="br-card-head">
            <span className="br-dot br-dot-calc" aria-hidden="true" />
            <h2 className="br-card-title">Derived from the letter</h2>
          </header>
          {active ? (
            <dl className="br-dl">
              <Row label="Equity contribution" value={active.derivedEquityContribution} />
              <Row
                label="Ratio check"
                value={active.derivedRatioCheck}
                tone={active.derivedRatioCheck === 'Reconciles' ? 'ok' : 'warn'}
              />
              <Row label="Moratorium ends" value={active.derivedMoratoriumEnd} />
              <Row label="Repayment starts" value={active.derivedRepaymentStart} />
              <Row label="Repayment ends" value={active.derivedRepaymentEnd} />
              <Row label="Total tenor" value={active.derivedTotalTenorMonths} />
              <Row label="First-year interest" value={active.derivedFirstYearInterest} />
              <Row label="Sanction valid till" value={active.derivedSanctionValidTill} />
              <Row
                label="COD status"
                value={active.derivedCodStatus}
                tone={/Overdue/i.test(active.derivedCodStatus || '') ? 'warn' : ''}
              />
            </dl>
          ) : (
            <p className="br-muted">These fill in once a sanction is recorded.</p>
          )}
        </section>
      </div>

      <section className="br-card">
        <header className="br-card-head">
          <span className="br-dot br-dot-user" aria-hidden="true" />
          <h2 className="br-card-title">Borrower identity</h2>
          <span className={`br-chip ${pending ? 'br-chip-warn' : 'br-chip-ok'}`}>
            {pending ? `${pending} of ${total} pending` : 'Complete'}
          </span>
        </header>
        <div className="br-grid-2 br-grid-tight">
          <dl className="br-dl">
            <Row label="CIN" value={borrower.cin} empty="Not entered" mono />
            <Row label="PAN" value={borrower.pan} empty="Not entered" mono />
            <Row label="Sponsor" value={borrower.sponsorName} empty="Not entered"
                 icon={<Building2 size={14} aria-hidden="true" />} />
            <Row label="Registered office" value={borrower.registeredAddress} empty="Not entered"
                 icon={<MapPin size={14} aria-hidden="true" />} />
          </dl>
          <dl className="br-dl">
            <Row label="Contact person" value={borrower.contactPerson} empty="Not entered"
                 icon={<Users size={14} aria-hidden="true" />} />
            <Row label="Email" value={borrower.contactEmail} empty="Not entered"
                 icon={<Mail size={14} aria-hidden="true" />} />
            <Row label="Phone" value={borrower.contactPhone} empty="Not entered"
                 icon={<Phone size={14} aria-hidden="true" />} />
            <Row
              label="Linked project"
              value={borrower.projectId ? `#${borrower.projectId}` : null}
              empty="Not linked"
              icon={<Link2 size={14} aria-hidden="true" />}
            />
          </dl>
        </div>
        <div className="br-card-foot">
          <button type="button" className="br-btn br-btn-sm" onClick={() => setEditIdentity(true)}>
            <Plus size={14} aria-hidden="true" />
            {pending ? 'Complete identity details' : 'Edit identity details'}
          </button>
        </div>
      </section>

      <section className="br-card">
        <header className="br-card-head">
          <h2 className="br-card-title">Sanctions</h2>
          <button
            type="button"
            className="br-btn br-btn-sm"
            onClick={() => setSanctionModal({ mode: 'create', initial: null })}
          >
            <Plus size={14} aria-hidden="true" />
            Add sanction
          </button>
        </header>
        {sanctions.length === 0 ? (
          <p className="br-muted">None recorded.</p>
        ) : (
          <table className="br-table">
            <tbody>
              {sanctions.map((s) => (
                <tr key={s.id}>
                  <td className="br-mono">{s.refNo}</td>
                  <td className="br-muted">{s.sanctionDate || '—'}</td>
                  <td>{s.sanctionedAmount || '—'}</td>
                  <td><span className="br-chip">{statusLabel(s.status)}</span></td>
                  <td className="br-right">
                    <button
                      type="button"
                      className="br-link"
                      onClick={() => setSanctionModal({ mode: 'edit', initial: s })}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {compare && (
        <SanctionCompareModal
          current={compare.sanction}
          parsed={compare.parsed}
          fileName={compare.file?.name}
          onCancel={() => setCompare(null)}
          onConfirm={handleCompareConfirm}
        />
      )}

      {viewerFor && (
        <DocumentViewerModal
          sanctionId={viewerFor.id}
          fileName={viewerFor.sanctionDocName}
          onClose={() => setViewerFor(null)}
        />
      )}

      {editIdentity && (
        <BorrowerFormModal
          borrower={borrower}
          onClose={() => setEditIdentity(false)}
          onSaved={() => { setEditIdentity(false); load(); }}
        />
      )}

      {sanctionModal && (
        <SanctionFormModal
          mode={sanctionModal.mode}
          initial={sanctionModal.initial}
          borrowerId={borrower.id}
          onClose={() => setSanctionModal(null)}
          onSaved={() => { setSanctionModal(null); load(); }}
        />
      )}
    </div>
  );
};

const Row = ({ label, value, strong = false, tone = '', empty = '—', mono = false, icon = null }) => (
  <div className="br-dl-row">
    <dt className="br-dl-label">
      {icon && <span className="br-dl-icon">{icon}</span>}
      {label}
    </dt>
    <dd className={[
      'br-dl-value',
      strong ? 'br-strong' : '',
      mono && value ? 'br-mono' : '',
      value ? (tone ? `br-tone-${tone}` : '') : 'br-muted',
    ].filter(Boolean).join(' ')}>
      {value || empty}
    </dd>
  </div>
);

const statusLabel = (s) => ({
  DRAFT: 'Draft',
  IMPORTED: 'Imported',
  REVIEW: 'Review',
  ONBOARDED: 'Onboarded',
}[s] || s || '—');

const sourceLabel = (s) => ({
  MANUAL: 'Entered manually',
  IMPORTED: 'Imported',
  IMPORTED_EDITED: 'Imported, edited',
}[s] || s);

export default BorrowerDetail;