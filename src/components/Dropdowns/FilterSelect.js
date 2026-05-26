// FilterSelect.js — custom styled dropdown with portal rendering
// Renders the dropdown list via ReactDOM.createPortal at document.body level
// so it is never clipped by overflow:hidden/auto on any ancestor (modals, drawers, etc.)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

/**
 * Props:
 *   value        {string}          — current selected value
 *   onChange     {(value) => void} — called with new value string
 *   options      {Array<{ value, label }>}
 *   placeholder  {string}          — shown when no value selected
 *   disabled     {boolean}
 *   id           {string}          — for label htmlFor
 */
const FilterSelect = ({ value, onChange, options = [], placeholder = 'Select', disabled = false, id }) => {
  const [open,    setOpen]    = useState(false);
  const [listPos, setListPos] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const triggerRef  = useRef(null);
  const listRef     = useRef(null);

  // Calculate portal position relative to viewport each time we open
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const listHeight = Math.min(options.length * 36 + 48, 240);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp     = spaceBelow < listHeight && rect.top > listHeight;

    setListPos({
      left:   rect.left,
      width:  rect.width,
      openUp,
      top:    openUp ? rect.top - listHeight - 4 : rect.bottom + 4,
    });
  }, [options.length]);

  const handleOpen = () => {
    if (disabled) return;
    if (!open) calcPosition();
    setOpen(o => !o);
  };

  // Recalculate on scroll / resize while open (handles modal scrolling)
  useEffect(() => {
    if (!open) return;
    const update = () => calcPosition();
    window.addEventListener('scroll',  update, true);
    window.addEventListener('resize',  update, true);
    return () => {
      window.removeEventListener('scroll',  update, true);
      window.removeEventListener('resize',  update, true);
    };
  }, [open, calcPosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const clickedTrigger = triggerRef.current?.contains(e.target);
      const clickedList    = listRef.current?.contains(e.target);
      if (!clickedTrigger && !clickedList) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label;

  const handleSelect = (optValue) => {
    onChange(optValue);
    setOpen(false);
  };

  const triggerClass = [
    'filter-trigger',
    open     ? 'filter-trigger--open'      : '',
    value    ? 'filter-trigger--has-value' : '',
    disabled ? 'filter-trigger--disabled'  : '',
  ].filter(Boolean).join(' ');

  // Portal list — fixed to viewport, never clipped by overflow ancestors
  const portalList = open && ReactDOM.createPortal(
    <ul
      ref={listRef}
      className="filter-dropdown-list"
      style={{
        position:  'fixed',
        top:       listPos.top,
        left:      listPos.left,
        width:     listPos.width,
        zIndex:    99999,
        animation: listPos.openUp ? 'dropdown-up 0.12s ease' : 'dropdown-in 0.12s ease',
      }}
      role="listbox"
    >
      {/* Placeholder row */}
      <li
        className="filter-dropdown-item filter-dropdown-item--placeholder"
        onMouseDown={(e) => { e.preventDefault(); handleSelect(''); }}
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
            onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
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
    </ul>,
    document.body
  );

  return (
    <div ref={triggerRef} style={{ position: 'relative' }} id={id}>
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

      {portalList}
    </div>
  );
};

export default FilterSelect;