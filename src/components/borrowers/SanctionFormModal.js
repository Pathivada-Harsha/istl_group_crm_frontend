// src/components/borrowers/SanctionFormModal.js
//
// One form, three ways in:
//   mode="import" — pre-filled from a parsed letter, low-confidence fields
//                   flagged, document preview beside it
//   mode="create" — opened blank for a borrower with no letter yet
//   mode="edit"   — opened on a saved sanction
//
// Keeping them in one component is deliberate: an imported record must stay as
// editable as a typed one, and two forms would drift apart the first time a
// field is added.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, AlertTriangle, FileText, Paperclip } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import { deriveSanction } from './sanctionDerive';
import SanctionCompareModal from './SanctionCompareModal';
import { SANCTION_FIELDS as FIELDS, sanctionFieldGroups } from './sanctionFields';
import { BORROWER_IMPORT_KEYS } from './borrowerFields';
import '../../pages-css/BorrowerRegistry.css';

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});
const GROUPS = sanctionFieldGroups();

const SanctionFormModal = ({
  mode = 'create',
  initial = null,        // parsed field map (import) or saved wrapper (edit)
  borrowerId = null,     // set when adding a sanction to a known borrower
  borrowerName = null,   // pre-fills the borrower field for a known borrower
  file = null,           // the uploaded File, for preview and post-save storage
  allowAttach = false,   // offer to attach a letter while entering by hand
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [attached, setAttached] = useState(null);   // File chosen in this form
  const [reading, setReading] = useState(false);
  const [compare, setCompare] = useState(null);     // { parsed, file }
  const attachRef = useRef(null);

  // The letter to store on save: the one passed in (import) or picked here.
  const documentFile = file || attached;

  const lowConfidence = useMemo(
    () => new Set(initial?._lowConfidenceFields || []),
    [initial],
  );
  const duplicateRef = Boolean(initial?._duplicateRefNo);
  const engine = initial?._extractionEngine;

  useEffect(() => {
    if (!initial) return;
    const next = { ...EMPTY };
    FIELDS.forEach(({ key }) => {
      if (initial[key] !== undefined && initial[key] !== null) next[key] = String(initial[key]);
    });
    setForm(next);
  }, [initial]);

  // Adding a sanction to a borrower we already know — no reason to make the
  // user retype the company name.
  useEffect(() => {
    if (borrowerName) setForm((f) => (f.borrowerName ? f : { ...f, borrowerName }));
  }, [borrowerName]);

  /**
   * A letter attached while entering values by hand. Read it and, if anything
   * has already been typed, compare rather than overwrite — the typed value
   * may be the deliberate one. On an empty form there is nothing to disagree
   * with, so the parsed values simply fill it.
   */
  const handleAttach = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;

    setAttached(picked);
    setError('');
    setReading(true);
    try {
      const parsed = await borrowerApi.parseSanction(picked);
      const hasTypedValues = FIELDS.some(({ key }) => String(form[key] || '').trim());
      if (!hasTypedValues) {
        const next = { ...EMPTY };
        FIELDS.forEach(({ key }) => {
          if (parsed[key] != null) next[key] = String(parsed[key]);
        });
        setForm(next);
      } else {
        setCompare({ parsed, file: picked });
      }
    } catch (err) {
      // Unreadable documents are still worth storing against the record.
      setError(`${err.message} The file will still be attached when you save.`);
    } finally {
      setReading(false);
    }
  };

  const applyCompare = (updates) => {
    setForm((f) => ({ ...f, ...updates }));
    setCompare(null);
  };

  // Preview only makes sense for PDFs — no browser renders .docx.
  useEffect(() => {
    if (!documentFile || !/pdf$/i.test(documentFile.name)) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(documentFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [documentFile]);

  const derived = useMemo(() => deriveSanction(form), [form]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const missingRequired = FIELDS
    .filter((f) => f.required && !String(form[f.key] || '').trim())
    .map((f) => f.label);

  const handleSave = async () => {
    setError('');
    if (missingRequired.length) {
      setError(`Still needed: ${missingRequired.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      // Resolve the borrower first — find by name or create — so the sanction
      // always has a parent, whether or not the company was already on file.
      // The borrower-level values the letter carried (promoter, guarantor,
      // group, Cat / Sub Cat, SL ref.) ride along; the server fills only blank
      // fields with them, so an import never overwrites something typed.
      let bId = borrowerId;
      if (!bId) {
        const identity = { borrowerName: form.borrowerName.trim() };
        BORROWER_IMPORT_KEYS.forEach((k) => {
          const v = initial?.[k];
          if (v != null && String(v).trim()) identity[k] = String(v);
        });
        const b = await borrowerApi.resolve(identity);
        bId = b.id;
      }

      // Built from FIELDS rather than a hand-written literal, so a field added
      // to the array is posted without a second edit here.
      const payload = {
        id: initial?.id || null,
        borrowerId: bId,
        ...FIELDS.reduce((p, f) => ({ ...p, [f.key]: form[f.key] }), {}),
        status: mode === 'import' ? 'IMPORTED' : (initial?.status || 'DRAFT'),
        source: mode === 'import' ? 'IMPORTED' : (initial?.source || 'MANUAL'),
        extractionEngine: engine || initial?.extractionEngine || null,
      };

      const saved = await borrowerApi.saveSanction(
        payload,
        mode === 'import' ? initial : null,
      );

      // Store the letter against the row we just created.
      if (documentFile && saved?.sanctions?.length) {
        const target = saved.sanctions.find((s) => s.refNo === form.refNo.trim())
          || saved.sanctions[0];
        if (target?.id) {
          try {
            await borrowerApi.uploadDoc(target.id, documentFile);
          } catch (e) {
            // The record is saved; a failed attachment shouldn't lose it.
            console.warn('Sanction saved but the document could not be stored:', e);
          }
        }
      }

      onSaved?.(saved);
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'import'
    ? 'Review what was read'
    : mode === 'edit' ? 'Edit sanction' : 'Add sanction';

  return (
    <div className="br-modal-backdrop" onMouseDown={onClose}>
      {/* Wide in every mode now: thirty-odd fields in a single narrow column
          is unusable, whether they arrived from a letter or by hand. */}
      <div
        className="br-modal br-modal-wide"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="br-modal-head">
          <div className="br-viewer-title">
            {documentFile && <FileText size={18} className="br-viewer-icon" aria-hidden="true" />}
            <div className="br-viewer-title-text">
              <h3 className="br-modal-title">{title}</h3>
              {/* The file being reviewed, named at the top — the reviewer needs
                  to know which letter these values came from before trusting
                  them, especially when importing several in a row. */}
              {documentFile ? (
                <p className="br-modal-sub br-modal-file">
                  <span className="br-modal-filename">{documentFile.name}</span>
                  <span className="br-modal-filesize">
                    {Math.round(documentFile.size / 1024)} KB
                  </span>
                </p>
              ) : mode === 'import' ? (
                <p className="br-modal-sub">
                  Check every value against the letter before saving. Nothing is stored yet.
                </p>
              ) : null}
            </div>
          </div>
          <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {mode === 'import' && documentFile && (
          <p className="br-modal-hint">
            Check every value against the letter before saving. Nothing is stored yet.
          </p>
        )}

        {mode === 'import' && duplicateRef && (
          <div className="br-banner br-banner-danger">
            A sanction with this reference number has already been imported. Saving will
            be blocked until the reference is corrected.
          </div>
        )}

        {mode === 'import' && lowConfidence.size > 0 && (
          <div className="br-banner br-banner-warn">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              {lowConfidence.size} field{lowConfidence.size === 1 ? ' was' : 's were'} read by
              the AI rather than matched from the document's tables. Those are marked below —
              check them first.
            </span>
          </div>
        )}

        <div className="br-modal-body">
          <div className="br-form-col">
            {GROUPS.map(({ group, fields }) => (
              <fieldset key={group} className="br-fieldset">
                <legend className="br-fieldset-legend">{group}</legend>
                <div className="br-form-grid">
                  {fields.map((f) => (
                    <label key={f.key} className="br-field">
                      <span className="br-field-label">
                        {f.label}
                        {f.required && <span className="br-req" aria-hidden="true"> *</span>}
                        {/* The unit the column is quoted in. Without it a user
                            typing 205 into "Project Cost" has no way to know
                            whether that means rupees or crore. */}
                        {f.suffix && <span className="br-field-suffix">{f.suffix}</span>}
                        {lowConfidence.has(f.key) && (
                          <span className="br-chip br-chip-warn">check</span>
                        )}
                      </span>
                      <input
                        type="text"
                        value={form[f.key]}
                        onChange={set(f.key)}
                        placeholder={f.placeholder}
                        className={[
                          'br-input',
                          lowConfidence.has(f.key) ? 'br-input-warn' : '',
                          f.mono ? 'br-input-mono' : '',
                        ].filter(Boolean).join(' ')}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="br-side-col">
            <div className="br-derived-card">
              <p className="br-derived-title">Updates as you type</p>
              <Row label="Equity contribution" value={derived.equityContribution} />
              <Row
                label="Ratio check"
                value={derived.ratioCheck}
                tone={derived.ratioOk === false ? 'warn' : derived.ratioOk ? 'ok' : ''}
              />
              {/* Only shown where the form left the column blank — a printed
                  value always wins over the one worked out here. */}
              <Row label="Debt" value={derived.debtAmount} />
              <Row label="Equity" value={derived.equityAmount} />
              <Row label="Debt %" value={derived.debtPct} />
              <Row label="Equity %" value={derived.equityPct} />
              <Row label="ROI (base + spread)" value={derived.roi} />
              <Row
                label="ROI check"
                value={derived.roiCheck}
                tone={derived.roiOk === false ? 'warn' : derived.roiOk ? 'ok' : ''}
              />
              <Row label="Moratorium ends" value={derived.moratoriumEnd} />
              <Row label="Repayment starts" value={derived.repaymentStart} />
              <Row label="Repayment ends" value={derived.repaymentEnd} />
              <Row label="Total tenor" value={derived.totalTenorMonths} />
              <Row label="First-year interest" value={derived.firstYearInterest} />
              <Row label="Sanction valid till" value={derived.sanctionValidTill} />
              <Row
                label="COD status"
                value={derived.codStatus}
                tone={derived.codOverdue ? 'warn' : ''}
              />
            </div>

            {previewUrl ? (
              <iframe className="br-preview" src={previewUrl} title="Sanction letter" />
            ) : documentFile ? (
              <div className="br-preview-note">
                <FileText size={18} aria-hidden="true" />
                <div>
                  <strong>{documentFile.name}</strong>
                  <span>
                    Word files can't be previewed before saving. Once saved, the letter
                    opens in the page from the borrower record.
                  </span>
                </div>
              </div>
            ) : null}

            {allowAttach && (
              <div className="br-attach-box">
                <p className="br-attach-title">Sanction letter</p>
                <p className="br-attach-help">
                  {documentFile
                    ? 'Attached. It will be stored when you save.'
                    : 'Optional. If you attach one, its values are checked against '
                      + 'what you have entered and any differences are shown.'}
                </p>
                <button
                  type="button"
                  className="br-btn br-btn-sm"
                  onClick={() => attachRef.current?.click()}
                  disabled={reading}
                >
                  <Paperclip size={14} aria-hidden="true" />
                  {reading ? 'Reading…' : documentFile ? 'Choose a different file' : 'Attach letter'}
                </button>
                <input
                  ref={attachRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleAttach}
                  hidden
                />
              </div>
            )}
          </div>
        </div>

        {compare && (
          <SanctionCompareModal
            current={form}
            parsed={compare.parsed}
            fileName={compare.file?.name}
            onCancel={() => setCompare(null)}
            onConfirm={applyCompare}
          />
        )}

        {error && <div className="br-banner br-banner-danger">{error}</div>}

        <div className="br-modal-foot">
          <button type="button" className="br-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="br-btn br-btn-primary"
            onClick={handleSave}
            disabled={saving || duplicateRef}
          >
            <Check size={15} aria-hidden="true" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, tone = '' }) => (
  <div className="br-derived-row">
    <span className="br-derived-label">{label}</span>
    <span className={`br-derived-value ${tone ? `br-tone-${tone}` : ''}`}>
      {value || '—'}
    </span>
  </div>
);

export default SanctionFormModal;