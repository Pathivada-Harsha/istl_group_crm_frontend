// src/components/borrowers/BorrowerDetail.js
//
// The borrower record. Reached by clicking a row in the registry, and landed on
// directly after an import completes — that is the moment the derived panel
// earns its place, since the user sees nine values appear that they never typed.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Pencil, Plus, Download, MapPin, Mail, Phone,
  Building2, Users, Link2, Eye, Paperclip, RefreshCw, Upload, Trash2, AlertTriangle,
} from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import BorrowerFormModal from './BorrowerFormModal';
import SanctionFormModal from './SanctionFormModal';
import DocumentViewerModal from './DocumentViewerModal';
import SanctionCompareModal from './SanctionCompareModal';
import { SANCTION_FIELDS } from './sanctionFields';
import '../../pages-css/BorrowerRegistry.css';
import '../../pages-css/BorrowerRegistryPremium.css';

// Free-text covenant fields read as sentences, not numbers — left-aligning
// just these keeps every other field's right-aligned number/date look intact.
const LEFT_ALIGN_KEYS = new Set(['cashSweep', 'dsra', 'isra']);

// ROI (detailHidden) is left out of this card — Rate of interest already
// states it in full, and the bare percentage is only worth a place of its
// own in the registry table's Key columns view.
const DETAIL_FIELDS = SANCTION_FIELDS.filter((f) => !f.detailHidden);

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

/** The derived panel, as data — so it can be filtered like the card beside it. */
const DERIVED_ROWS = [
  { key: 'derivedEquityContribution', label: 'Equity contribution' },
  { key: 'derivedRatioCheck', label: 'Ratio check', tone: (v) => (v === 'Reconciles' ? 'ok' : 'warn') },
  { key: 'derivedRoiCheck', label: 'ROI check', tone: (v) => (v === 'Reconciles' ? 'ok' : 'warn') },
  { key: 'derivedMoratoriumEnd', label: 'Moratorium ends' },
  // Modelled from tenor and moratorium, deliberately distinct from the
  // contractual dates in the card alongside. Where the two disagree, that gap
  // is worth seeing rather than reconciling away.
  { key: 'derivedRepaymentStart', label: 'Repayment starts (modelled)' },
  { key: 'derivedRepaymentEnd', label: 'Repayment ends (modelled)' },
  { key: 'derivedTotalTenorMonths', label: 'Total tenor' },
  { key: 'derivedFirstYearInterest', label: 'First-year interest' },
  { key: 'derivedSanctionValidTill', label: 'Sanction valid till' },
  { key: 'derivedCodStatus', label: 'COD status', tone: (v) => (/Overdue/i.test(v || '') ? 'warn' : '') },
];

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
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [deleteSanction, setDeleteSanction] = useState(null); // row awaiting confirmation
  const [deleting, setDeleting] = useState(false);
  // A letter states maybe a dozen of the thirty-odd registry columns. Showing
  // the rest as dashes turned a short page into three screens of nothing, so
  // they are left out until asked for.
  const [showAll, setShowAll] = useState(false);

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
      if (e.key === 'Escape' && !editIdentity && !sanctionModal && !viewerFor
          && !compare && !deleteSanction) {
        backToRegistry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [backToRegistry, editIdentity, sanctionModal, viewerFor, compare, deleteSanction]);

  const openDocument = (sanction) => setViewerFor(sanction);

  /**
   * Add a further sanction by importing its letter. Same parse as the registry
   * import, but the borrower is already known, so the review screen saves
   * against this record rather than matching on the name.
   */
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setError('');
    try {
      const parsed = await borrowerApi.parseSanction(file);
      setSanctionModal({ mode: 'import', initial: parsed, file });
    } catch (err) {
      setError(err.message || 'Could not read the document');
    } finally {
      setImporting(false);
    }
  };

  /**
   * Soft-deletes one sanction, leaving the borrower and any other letters
   * intact. Frees the reference number for a corrected re-import.
   */
  const handleDeleteSanction = async () => {
    if (!deleteSanction) return;
    setDeleting(true);
    setError('');
    try {
      await borrowerApi.removeSanction(deleteSanction.id);
      // If the deleted row was the one on display, fall back to whatever
      // remains rather than leaving the cards showing a removed record.
      if (activeId === deleteSanction.id) setActiveId(null);
      setDeleteSanction(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete this sanction');
      setDeleteSanction(null);
    } finally {
      setDeleting(false);
    }
  };

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
  const hiddenCount = active
    ? DETAIL_FIELDS.filter((f) => isBlank(active[f.key])).length
    : 0;

  // Same rule as the sanction cards — an unfilled identity field is left out
  // rather than repeated as "Not entered" fifteen times. The pending chip and
  // the button below already say what's outstanding.
  //
  // The name is exempt: it is always set, and a card headed "Borrower identity"
  // that doesn't show the borrower's name reads as broken — the more so once
  // the blank rows around it are hidden and the card falls back to an empty
  // state while the name sits in the title right above it.
  const identityKyc = [
    { label: 'CIN', value: borrower.cin, mono: true },
    { label: 'PAN', value: borrower.pan, mono: true },
    { label: 'Promoter', value: borrower.promoterName, icon: <Building2 size={14} aria-hidden="true" /> },
    { label: 'Sponsor', value: borrower.sponsorName, icon: <Building2 size={14} aria-hidden="true" /> },
    { label: 'Guarantor', value: borrower.guarantorName, icon: <Users size={14} aria-hidden="true" /> },
    { label: 'Group name', value: borrower.groupName },
    { label: 'Cat', value: borrower.borrowerCategory },
    { label: 'Sub Cat', value: borrower.borrowerSubCategory },
    { label: 'State', value: borrower.state, icon: <MapPin size={14} aria-hidden="true" /> },
    { label: 'Registered office', value: borrower.registeredAddress, icon: <MapPin size={14} aria-hidden="true" /> },
    { label: 'Contact person', value: borrower.contactPerson, icon: <Users size={14} aria-hidden="true" /> },
    { label: 'Email', value: borrower.contactEmail, icon: <Mail size={14} aria-hidden="true" /> },
    { label: 'Phone', value: borrower.contactPhone, icon: <Phone size={14} aria-hidden="true" /> },
    {
      label: 'Linked project',
      value: borrower.projectId ? `#${borrower.projectId}` : null,
      empty: 'Not linked',
      icon: <Link2 size={14} aria-hidden="true" />,
    },
  ].filter((r) => showAll || !isBlank(r.value));

  const identityRows = [
    { label: 'Borrower name', value: borrower.borrowerName, strong: true },
    ...identityKyc,
  ];
  const filled = borrower.identityFilled ?? 0;
  const total = borrower.identityTotal ?? 7;
  const pending = total - filled;

  return (
    <div className="br-page">
      {/* Back sits above the title on its own line, so it reads as leaving the
          page rather than as an action on the record. */}
      <button type="button" className="br-back" onClick={backToRegistry}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Registry
      </button>

      <div className="br-head">
        <div className="br-head-text">
          <button type="button" className="br-crumb" onClick={backToRegistry}>
            Lender · Borrower Registry
          </button>
          <h1 className="br-title">{borrower.borrowerName}</h1>
          <p className="br-sub">
            {active
              ? `${active.refNo}${active.sanctionDate ? ` · ${active.sanctionDate}` : ''}`
              : 'No sanction letter on file'}
          </p>
        </div>
      </div>

      {/* Provenance legend. Each entry names the card it keys to, so the dot
          on a card header is unambiguous — labelling these by source alone
          ("Read from the letter") left the reader to guess which card was
          which. */}
      <div className="br-legend">
        <span className="br-legend-item">
          <span className="br-dot br-dot-read" aria-hidden="true" />
          <strong className="br-legend-name">Sanction details</strong>
          <span className="br-legend-src">read from the letter</span>
        </span>
        <span className="br-legend-item">
          <span className="br-dot br-dot-calc" aria-hidden="true" />
          <strong className="br-legend-name">Derived values</strong>
          <span className="br-legend-src">calculated automatically</span>
        </span>
        <span className="br-legend-item">
          <span className="br-dot br-dot-user" aria-hidden="true" />
          <strong className="br-legend-name">Borrower identity</strong>
          <span className="br-legend-src">entered by the user</span>
        </span>
      </div>

      {error && <div className="br-banner br-banner-danger">{error}</div>}

      {/* One section, not two: the stored letter and the list of sanctions
          describe the same thing, so the document sits at the top of this
          card rather than floating above it as a card of its own. */}
      <section className="br-card">
        <header className="br-card-head">
          <h2 className="br-card-title">Sanctions</h2>
          <div className="br-docstrip-actions">
            <button
              type="button"
              className="br-btn br-btn-sm"
              onClick={() => setSanctionModal({ mode: 'create', initial: null })}
            >
              <Plus size={14} aria-hidden="true" />
              Add manually
            </button>
            <button
              type="button"
              className="br-btn br-btn-sm br-btn-primary"
              onClick={() => importRef.current?.click()}
              disabled={importing}
            >
              <Upload size={14} aria-hidden="true" />
              {importing ? 'Reading…' : 'Import sanction letter'}
            </button>
          </div>
        </header>

        <input
          ref={importRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleImportFile}
          hidden
        />

        {/* The document belongs to whichever sanction is selected above. */}
        {active && (
          <div className="br-docstrip br-docstrip-inset">
            <FileText size={20} className="br-docstrip-icon" aria-hidden="true" />
            <div className="br-docstrip-text">
              <strong>
                {active.hasDocument ? 'Sanction letter' : 'No letter attached'}
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

        {sanctions.length === 0 ? (
          <div className="br-empty">
            <p>No sanction letter yet.</p>
            <div className="br-docstrip-actions">
              <button
                type="button"
                className="br-btn"
                onClick={() => setSanctionModal({ mode: 'create', initial: null })}
              >
                <Plus size={15} aria-hidden="true" />
                Add manually
              </button>
              <button
                type="button"
                className="br-btn br-btn-primary"
                onClick={() => importRef.current?.click()}
                disabled={importing}
              >
                <Upload size={15} aria-hidden="true" />
                {importing ? 'Reading…' : 'Import sanction letter'}
              </button>
            </div>
          </div>
        ) : (
          <table className="br-table">
            <tbody>
              {sanctions.map((s) => (
                <tr
                  key={s.id}
                  className={s.id === active?.id ? 'br-row-active' : ''}
                  onClick={() => setActiveId(s.id)}
                >
                  <td className="br-mono">{s.refNo}</td>
                  <td className="br-muted">{s.sanctionDate || '—'}</td>
                  <td>{s.sanctionedAmount || '—'}</td>
                  <td><span className="br-chip">{statusLabel(s.status)}</span></td>
                  <td
                    className="br-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="br-row-actions">
                      <button
                        type="button"
                        className="br-icon-btn"
                        title={`Edit ${s.refNo}`}
                        aria-label={`Edit ${s.refNo}`}
                        onClick={() => setSanctionModal({ mode: 'edit', initial: s })}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="br-icon-btn br-icon-danger"
                        title={`Delete ${s.refNo}`}
                        aria-label={`Delete ${s.refNo}`}
                        onClick={() => setDeleteSanction(s)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="br-grid-2">
        <section className="br-card">
          <header className="br-card-head">
            <span className="br-dot br-dot-read" aria-hidden="true" />
            <h2 className="br-card-title">Sanction details</h2>
            {active?.source && <span className="br-chip">{sourceLabel(active.source)}</span>}
            {active && hiddenCount > 0 && (
              <button
                type="button"
                className="br-link"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Hide empty fields' : `Show all ${DETAIL_FIELDS.length} fields`}
              </button>
            )}
          </header>
          {active ? (
            // One flat list, in the order the registry sheet prints the fields.
            // A letter states maybe a dozen of the thirty-odd columns, so the
            // rest are left out rather than shown as a wall of dashes — the
            // link in the header brings them back when you want to see what a
            // record is missing.
            //
            // `borrowerName` here is the letter's own field, separate from
            // the borrower record's name below — but a letter that didn't
            // capture one shouldn't just look blank when the record's name is
            // right there, so it falls back to that.
            <dl className="br-dl br-scroll-body">
              {DETAIL_FIELDS
                .map((f) => ({
                  ...f,
                  value: f.key === 'borrowerName'
                    ? (active[f.key] || borrower.borrowerName)
                    : active[f.key],
                }))
                .filter((f) => showAll || !isBlank(f.value))
                .map((f) => (
                  <Row
                    key={f.key}
                    label={f.label}
                    value={f.value}
                    strong={f.key === 'sanctionedAmount'}
                    mono={f.mono}
                    align={LEFT_ALIGN_KEYS.has(f.key) ? 'left' : ''}
                  />
                ))}
            </dl>
          ) : (
            <p className="br-muted">These fill in once a sanction is recorded.</p>
          )}
        </section>

        <section className="br-card">
          <header className="br-card-head">
            <span className="br-dot br-dot-calc" aria-hidden="true" />
            <h2 className="br-card-title">Derived values</h2>
          </header>
          {active ? (
            // Same rule as the card alongside: a derived value with nothing to
            // work from is left out rather than printed as a dash.
            <dl className="br-dl br-scroll-body">
              {DERIVED_ROWS
                .filter((d) => showAll || !isBlank(active[d.key]))
                .map((d) => (
                  <Row
                    key={d.key}
                    label={d.label}
                    value={active[d.key]}
                    tone={d.tone ? d.tone(active[d.key]) : ''}
                  />
                ))}
              {!showAll && DERIVED_ROWS.every((d) => isBlank(active[d.key])) && (
                <p className="br-muted br-dl-note">
                  Nothing to work these out from yet. They fill in as the
                  amounts, rate and dates are recorded.
                </p>
              )}
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
        {/* Split down the middle so the two columns stay even as fields fill in. */}
        <div className="br-grid-2 br-grid-tight">
          <dl className="br-dl">
            {identityRows.slice(0, Math.ceil(identityRows.length / 2)).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} empty={r.empty || 'Not entered'}
                   mono={r.mono} icon={r.icon} strong={r.strong} />
            ))}
          </dl>
          <dl className="br-dl">
            {identityRows.slice(Math.ceil(identityRows.length / 2)).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} empty={r.empty || 'Not entered'}
                   mono={r.mono} icon={r.icon} strong={r.strong} />
            ))}
          </dl>
        </div>
        {identityKyc.length === 0 && (
          <p className="br-muted br-dl-note">
            The rest comes from the KYC pack — a sanction letter doesn't carry it.
          </p>
        )}
        <div className="br-card-foot">
          <button type="button" className="br-btn br-btn-sm" onClick={() => setEditIdentity(true)}>
            <Plus size={14} aria-hidden="true" />
            {pending ? 'Complete identity details' : 'Edit identity details'}
          </button>
        </div>
      </section>

      {deleteSanction && (
        <div className="br-modal-backdrop" onMouseDown={() => setDeleteSanction(null)}>
          <div
            className="br-modal br-modal-confirm"
            onMouseDown={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete sanction"
          >
            <div className="br-modal-head">
              <div className="br-viewer-title">
                <AlertTriangle size={18} className="br-tone-warn" aria-hidden="true" />
                <div className="br-viewer-title-text">
                  <h3 className="br-modal-title">Delete this sanction?</h3>
                  <p className="br-modal-sub br-mono">{deleteSanction.refNo}</p>
                </div>
              </div>
            </div>
            <div className="br-modal-body br-modal-body-single">
              <p className="br-confirm-text">
                {deleteSanction.hasDocument
                  ? <>The stored letter <strong>{deleteSanction.sanctionDocName}</strong> will
                      be removed with it.</>
                  : 'No letter is attached to this sanction.'}
              </p>
              <p className="br-muted br-confirm-note">
                {borrower.borrowerName} stays on the registry. The record is archived rather
                than erased, so this reference number becomes free to import again.
              </p>
            </div>
            <div className="br-modal-foot">
              <button
                type="button"
                className="br-btn"
                onClick={() => setDeleteSanction(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="br-btn br-btn-danger"
                onClick={handleDeleteSanction}
                disabled={deleting}
              >
                <Trash2 size={15} aria-hidden="true" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          file={sanctionModal.file || null}
          borrowerId={borrower.id}
          borrowerName={borrower.borrowerName}
          allowAttach={sanctionModal.mode === 'create'}
          onClose={() => setSanctionModal(null)}
          onSaved={() => { setSanctionModal(null); load(); }}
        />
      )}
    </div>
  );
};

const Row = ({
  label, value, strong = false, tone = '', empty = '—',
  mono = false, icon = null, align = '',
}) => (
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
      align === 'left' ? 'brx-dl-value-left' : '',
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