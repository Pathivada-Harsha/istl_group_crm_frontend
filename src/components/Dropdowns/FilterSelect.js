// FilterSelect.js — custom styled dropdown (replaces native <select>)
// Auto-detects available space and opens upward or downward accordingly.
import React, { useState, useRef, useEffect } from 'react';

/**
 * Props:
 *   value        {string}         — current selected value
 *   onChange     {(value) => void}— called with new value string
 *   options      {Array<{ value, label }>}
 *   placeholder  {string}         — shown when no value selected
 *   disabled     {boolean}
 *   id           {string}         — for label htmlFor
 */
const FilterSelect = ({ value, onChange, options = [], placeholder = 'Select', disabled = false, id }) => {
  const [open, setOpen]       = useState(false);
  const [openUp, setOpenUp]   = useState(false); // true = list opens upward
  const containerRef = useRef(null);

  // Measure space when opening to decide direction
  const handleOpen = () => {
    if (disabled) return;
    if (!open && containerRef.current) {
      const rect         = containerRef.current.getBoundingClientRect();
      const spaceBelow   = window.innerHeight - rect.bottom;
      const dropdownH    = Math.min(options.length * 36 + 40, 240); // approx height
      setOpenUp(spaceBelow < dropdownH && rect.top > dropdownH);
    }
    setOpen(o => !o);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label;

  const handleSelect = (optValue) => {
    onChange(optValue);
    setOpen(false);
  };

  const triggerClass = [
    'filter-trigger',
    open      ? 'filter-trigger--open'      : '',
    value     ? 'filter-trigger--has-value' : '',
    disabled  ? 'filter-trigger--disabled'  : '',
  ].filter(Boolean).join(' ');

  const listStyle = openUp
    ? { top: 'auto', bottom: 'calc(100% + 4px)', animation: 'dropdown-up 0.12s ease' }
    : { top: 'calc(100% + 4px)', bottom: 'auto', animation: 'dropdown-in 0.12s ease' };

  return (
    <div ref={containerRef} style={{ position: 'relative' }} id={id}>
      {/* Trigger */}
      <div
        className={triggerClass}
        onClick={handleOpen}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); }
        }}
      >
        <span className={`filter-trigger__text${!value ? ' filter-trigger__text--placeholder' : ''}`}>
          {selectedLabel || placeholder}
        </span>
        <span className="filter-trigger__chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {/* Dropdown list */}
      {open && (
        <ul className="filter-dropdown-list" style={listStyle} role="listbox">
          {/* Placeholder row */}
          <li
            className="filter-dropdown-item filter-dropdown-item--placeholder"
            onClick={() => handleSelect('')}
            role="option"
            aria-selected={!value}
          >
            {placeholder}
          </li>

          {options.map(opt => {
            const isSelected = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                className={`filter-dropdown-item${isSelected ? ' filter-dropdown-item--selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
                role="option"
                aria-selected={isSelected}
              >
                {isSelected && (
                  <svg className="filter-dropdown-item__check" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {opt.label}
              </li>
            );
          })}

          {options.length === 0 && (
            <li className="filter-dropdown-item" style={{ color: '#94a3b8', fontStyle: 'italic', cursor: 'default' }}>
              No options available
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default FilterSelect;