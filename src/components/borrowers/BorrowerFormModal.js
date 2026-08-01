// src/components/borrowers/BorrowerFormModal.js
//
// The identity block — the part no letter supplies. Used both to create a
// borrower from scratch and to fill in the fields left blank after an import.

import React, { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import { BORROWER_FIELDS as FIELDS, borrowerFieldGroups } from './borrowerFields';
import { loadGoogleMaps } from '../../utils/googleMaps';
import '../../pages-css/BorrowerRegistry.css';

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});
const GROUPS = borrowerFieldGroups();

const BorrowerFormModal = ({ borrower = null, onClose, onSaved }) => {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // idle | loading | done | error — feedback next to the Pincode field only.
  const [pincodeLookup, setPincodeLookup] = useState('idle');

  useEffect(() => {
    if (!borrower) return;
    const next = { ...EMPTY };
    FIELDS.forEach(({ key }) => {
      if (borrower[key]) next[key] = String(borrower[key]);
    });
    setForm(next);
  }, [borrower]);

  // A complete 6-digit pincode looks up its city/state/district via Google's
  // Geocoding API and sets those fields to match it — the pincode is the
  // source of truth, so a stale or mistyped value gets corrected the moment
  // a valid pincode is entered. Retyping any of them afterwards still wins,
  // since the lookup only re-fires when the pincode itself changes again.
  const lastFilledPincode = useRef(null);
  useEffect(() => {
    const pincode = form.pincode;
    if (!/^\d{6}$/.test(pincode)) { setPincodeLookup('idle'); return undefined; }
    if (pincode === lastFilledPincode.current) return undefined;
    let cancelled = false;
    setPincodeLookup('loading');
    loadGoogleMaps()
      .then((gm) => {
        if (cancelled) return;
        new gm.Geocoder().geocode({ address: `${pincode}, India` }, (results, status) => {
          if (cancelled) return;
          if (status !== 'OK' || !results || !results[0]) { setPincodeLookup('error'); return; }
          const comps = results[0].address_components;
          const find = (type) => comps.find((c) => c.types.includes(type))?.long_name || '';
          // India's revenue "district" is usually admin level 3 (occasionally
          // level 2 in states that don't use level 3); the city is the
          // locality, falling back the same way when it's not set.
          const city = find('locality') || find('administrative_area_level_3') || find('administrative_area_level_2');
          const state = find('administrative_area_level_1');
          const district = find('administrative_area_level_3') || find('administrative_area_level_2');
          lastFilledPincode.current = pincode;
          setForm((f) => (f.pincode === pincode
            ? { ...f, city: city || f.city, state: state || f.state, district: district || f.district }
            : f));
          setPincodeLookup('done');
        });
      })
      .catch(() => { if (!cancelled) setPincodeLookup('error'); });
    return () => { cancelled = true; };
  }, [form.pincode]);

  const set = (field) => (e) => {
    const raw = e.target.value;
    const value = field.normalize ? field.normalize(raw) : raw;
    setForm((f) => ({ ...f, [field.key]: value }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.borrowerName.trim()) {
      setError('Borrower name is required');
      return;
    }
    if (form.pincode && form.pincode.length !== 6) {
      setError('Pincode must be 6 digits');
      return;
    }
    if (form.contactPhone && form.contactPhone.length !== 10) {
      setError('Phone must be 10 digits');
      return;
    }
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      setError('Enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      const saved = borrower?.id
        ? await borrowerApi.update(borrower.id, { ...form, id: borrower.id })
        : await borrowerApi.create(form);
      onSaved?.(saved);
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="br-modal-backdrop" onMouseDown={onClose}>
      <div
        className="br-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={borrower?.id ? 'Edit borrower' : 'Add borrower'}
      >
        <div className="br-modal-head">
          <div>
            <h3 className="br-modal-title">
              {borrower?.id ? 'Edit borrower details' : 'Add borrower'}
            </h3>
            <p className="br-modal-sub">
              Only the name is required. Everything else can be filled in as the
              KYC pack arrives.
            </p>
          </div>
          <button type="button" className="br-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="br-modal-body br-modal-body-single">
          {GROUPS.map(({ group, fields }) => (
            <fieldset key={group} className="br-fieldset">
              <legend className="br-fieldset-legend">{group}</legend>
              <div className="br-form-grid">
                {fields.map((f) => (
                  <label
                    key={f.key}
                    className={`br-field ${f.textarea ? 'br-field-wide' : ''}`}
                  >
                    <span className="br-field-label">
                      {f.label}
                      {f.required && <span className="br-req" aria-hidden="true"> *</span>}
                    </span>
                    {f.textarea ? (
                      <textarea
                        className="br-input br-textarea"
                        rows={2}
                        value={form[f.key]}
                        onChange={set(f)}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <input
                        type={f.type || 'text'}
                        className={`br-input ${f.mono ? 'br-input-mono' : ''}`.trim()}
                        value={form[f.key]}
                        onChange={set(f)}
                        placeholder={f.placeholder}
                        maxLength={f.maxLength}
                        inputMode={f.inputMode}
                      />
                    )}
                    {f.key === 'pincode' && pincodeLookup === 'loading' && (
                      <span className="br-field-hint">Looking up city / state / district…</span>
                    )}
                    {f.key === 'pincode' && pincodeLookup === 'error' && (
                      <span className="br-field-hint br-field-hint-warn">
                        Could not look up this pincode — enter city / state / district manually.
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        {error && <div className="br-banner br-banner-danger">{error}</div>}

        <div className="br-modal-foot">
          <button type="button" className="br-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="br-btn br-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Check size={15} aria-hidden="true" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowerFormModal;