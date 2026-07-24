// src/components/borrowers/BorrowerFormModal.js
//
// The identity block — the part no letter supplies. Used both to create a
// borrower from scratch and to fill in the fields left blank after an import.

import React, { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import borrowerApi from '../../services/borrowerApi';
import '../../pages-css/BorrowerRegistry.css';

const FIELDS = [
  { key: 'borrowerName', label: 'Borrower name', required: true, placeholder: 'Company name in full' },
  { key: 'cin', label: 'CIN', placeholder: 'U40106RJ2021PTC074829' },
  { key: 'pan', label: 'PAN', placeholder: 'AAKCR8842J' },
  { key: 'sponsorName', label: 'Sponsor / parent', placeholder: 'Promoter group behind the SPV' },
  { key: 'registeredAddress', label: 'Registered address', textarea: true, placeholder: 'Registered office as per MCA' },
  { key: 'city', label: 'City', placeholder: 'Jodhpur' },
  { key: 'state', label: 'State', placeholder: 'Rajasthan' },
  { key: 'pincode', label: 'Pincode', placeholder: '342011' },
  { key: 'contactPerson', label: 'Contact person', placeholder: 'Name' },
  { key: 'contactEmail', label: 'Email', placeholder: 'name@company.com' },
  { key: 'contactPhone', label: 'Phone', placeholder: '0291 244 8817' },
  { key: 'notes', label: 'Notes', textarea: true, placeholder: 'Anything worth recording' },
];

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});

const BorrowerFormModal = ({ borrower = null, onClose, onSaved }) => {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!borrower) return;
    const next = { ...EMPTY };
    FIELDS.forEach(({ key }) => {
      if (borrower[key]) next[key] = String(borrower[key]);
    });
    setForm(next);
  }, [borrower]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setError('');
    if (!form.borrowerName.trim()) {
      setError('Borrower name is required');
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
          <div className="br-form-grid">
            {FIELDS.map((f) => (
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
                    onChange={set(f.key)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <input
                    type="text"
                    className="br-input"
                    value={form[f.key]}
                    onChange={set(f.key)}
                    placeholder={f.placeholder}
                  />
                )}
              </label>
            ))}
          </div>
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