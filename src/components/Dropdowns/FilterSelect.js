// src/components/Dropdowns/FilterSelect.js — custom styled dropdown with portal rendering
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
 *   searchable   {boolean}         — enables inline search/filter input in the dropdown
 */
const FilterSelect = ({ value, onChange, options = [], placeholder = 'Select', disabled = false, id, searchable = false }) => {
  const [open,        setOpen]        = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listPos,     setListPos]     = useState({ top: 0, left: 0, width: 0, openUp: false });

  // typeahead state for non-searchable dropdowns
  const typeaheadBuffer = useRef('');
  const typeaheadTimer  = useRef(null);

  const triggerRef = useRef(null);
  const listRef    = useRef(null);
  const searchRef  = useRef(null);

  // Filtered options when searchable
  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  // Calculate portal position relative to viewport each time we open
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const searchBarH = searchable ? 44 : 0;
    const listHeight = Math.min(filteredOptions.length * 36 + 8 + searchBarH, searchable ? 320 : 240);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp     = spaceBelow < listHeight && rect.top > listHeight;

    setListPos({
      left:   rect.left,
      width:  rect.width,
      openUp,
      top:    openUp ? rect.top - listHeight - 4 : rect.bottom + 4,
    });
  }, [filteredOptions.length, searchable]);

  const handleOpen = () => {
    if (disabled) return;
    if (!open) {
      calcPosition();
      setSearchQuery('');
    }
    setOpen(o => !o);
  };

  // Focus search input when dropdown opens (searchable only)
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  // Recalculate on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => calcPosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update, true);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update, true);
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

  // Cleanup typeahead timer on unmount
  useEffect(() => () => clearTimeout(typeaheadTimer.current), []);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label;

  const handleSelect = (optValue) => {
    onChange(optValue);
    setOpen(false);
    setSearchQuery('');
  };

  // ── Keyboard handler on the trigger div ──────────────────────────────────
  const handleTriggerKeyDown = (e) => {
    // Open / close
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
      return;
    }

    if (disabled) return;

    // Printable character typed while trigger is focused
    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isPrintable) return;

    if (searchable) {
      // Searchable dropdown: open it and seed the search with the typed char
      e.preventDefault();
      if (!open) {
        calcPosition();
        setSearchQuery(e.key);
        setOpen(true);
        // After open, focus search and place cursor at end
        setTimeout(() => {
          if (searchRef.current) {
            searchRef.current.focus();
            // value already set via setSearchQuery; move cursor to end
            const len = searchRef.current.value.length;
            searchRef.current.setSelectionRange(len, len);
          }
        }, 60);
      } else {
        // Already open — append to search and keep search focused
        setSearchQuery(prev => prev + e.key);
        searchRef.current?.focus();
      }
    } else {
      // Non-searchable dropdown: native-select-style typeahead
      e.preventDefault();
      clearTimeout(typeaheadTimer.current);
      typeaheadBuffer.current += e.key.toLowerCase();

      const match = options.find(o =>
        o.label.toLowerCase().startsWith(typeaheadBuffer.current)
      );
      if (match) {
        onChange(match.value);
        // If dropdown is open, close it after selection
        if (open) setOpen(false);
      }

      // Reset buffer after 800 ms of no typing
      typeaheadTimer.current = setTimeout(() => {
        typeaheadBuffer.current = '';
      }, 800);
    }
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
        // Searchable (project): anchor right edge to trigger's right edge, expand leftward
        ...(searchable
          ? {
              right: window.innerWidth - listPos.left - listPos.width,
              left:  'auto',
              width: Math.max(listPos.width, 420),
            }
          : {
              left:  listPos.left,
              width: listPos.width,
            }
        ),
        zIndex:    99999,
        animation: listPos.openUp ? 'dropdown-up 0.12s ease' : 'dropdown-in 0.12s ease',
      }}
      role="listbox"
    >
      {/* Search input — shown only when searchable prop is true */}
      {searchable && (
        <li className="filter-dropdown-search-wrapper" role="none">
          <div className="filter-dropdown-search-inner">
            <svg className="filter-dropdown-search-icon" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              className="filter-dropdown-search-input"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); calcPosition(); }}
              onMouseDown={e => e.stopPropagation()}
              onKeyDown={e => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                className="filter-dropdown-search-clear"
                onMouseDown={e => { e.preventDefault(); setSearchQuery(''); searchRef.current?.focus(); }}
                tabIndex={-1}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </li>
      )}

      {/* Placeholder / clear row */}
      <li
        className={`filter-dropdown-item filter-dropdown-item--placeholder${!value ? ' filter-dropdown-item--placeholder-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); handleSelect(''); }}
        role="option"
        aria-selected={!value}
      >
        {value ? `— Clear selection —` : placeholder}
      </li>

      {filteredOptions.map(opt => {
        const isSelected = String(opt.value) === String(value);
        return (
          <li
            key={opt.value}
            className={`filter-dropdown-item${isSelected ? ' filter-dropdown-item--selected' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
            role="option"
            aria-selected={isSelected}
          >
            {opt.label}
          </li>
        );
      })}

      {filteredOptions.length === 0 && (
        <li className="filter-dropdown-item" style={{ color: '#94a3b8', fontStyle: 'italic', cursor: 'default' }}>
          {searchQuery ? `No results for "${searchQuery}"` : 'No options available'}
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
        onKeyDown={handleTriggerKeyDown}
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