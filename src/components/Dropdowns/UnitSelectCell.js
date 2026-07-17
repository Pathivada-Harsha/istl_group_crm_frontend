// ─────────────────────────────────────────────────────────────────────────────
//  UnitSelectCell — the app-standard unit dropdown, safe for a table cell.
//
//  Wraps UnitTypeDropdown (the shared COMMON_UNITS list) and adds the one thing
//  a plain <select> can't do: show a value that isn't on the list.
//
//  That matters because existing BOM rows hold units like "No's" and "Piece"
//  which aren't in COMMON_UNITS — a bare select would render them blank and the
//  next save would silently wipe them. Here an unlisted value keeps showing in a
//  text input instead, and "✏️ Custom" lets a user type a new one.
//
//  onChange emits the unit STRING (not an event), since callers store a value.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import UnitTypeDropdown, { COMMON_UNITS } from './Unittypedropdown.js';
import './UnitSelectCell.css';

const UnitSelectCell = ({ value, onChange, disabled = false, className = '', placeholder = 'Select Unit' }) => {
  const [typingCustom, setTypingCustom] = useState(false);

  // An unlisted stored value must render as custom whether or not the user just
  // chose "Custom" — otherwise reloading a row with "No's" shows an empty select.
  const unlisted = !!value && !COMMON_UNITS.includes(value);

  if (typingCustom || unlisted) {
    return (
      <div className="unit-cell-custom">
        <input
          className={className}
          value={value || ''}
          disabled={disabled}
          placeholder="Unit"
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          className="unit-cell-back"
          title="Back to list"
          disabled={disabled}
          onClick={() => { setTypingCustom(false); onChange(''); }}
        >↩</button>
      </div>
    );
  }

  return (
    <UnitTypeDropdown
      value={value || ''}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      onChange={e => {
        const v = e.target.value;
        if (v === 'Custom') { setTypingCustom(true); onChange(''); }
        else onChange(v);
      }}
    />
  );
};

export default UnitSelectCell;
