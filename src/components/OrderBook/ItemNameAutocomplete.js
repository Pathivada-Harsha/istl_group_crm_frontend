import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './ItemNameAutocomplete.css';

const API_BASE_URL = process.env.REACT_APP_API_URL;

/**
 * ItemNameAutocomplete
 *
 * Props:
 *   value         {string}   current itemName value
 *   onChange      {fn}       called with the new string value as user types
 *   onSelect      {fn}       called with the full catalogue object when user picks a suggestion
 *   user          {object}   { id, role } for request headers
 *   placeholder   {string}
 *   required      {bool}
 *   className     {string}   extra class for the <input>
 */
function ItemNameAutocomplete({ value, onChange, onSelect, user, placeholder, required, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // ── Compute dropdown position using fixed positioning ─────
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = Math.min(260, suggestions.length * 52 + 8);

    // Show above if not enough space below but enough above
    const showAbove = spaceBelow < dropdownHeight + 8 && spaceAbove > dropdownHeight + 8;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 3 }
        : { top: rect.bottom + 3 }),
    });
  }, [suggestions.length]);

  // ── Close dropdown when clicking outside ──────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Reposition on scroll / resize while dropdown is open ──
  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [showDropdown, updateDropdownPosition]);

  // ── Debounced search ──────────────────────────────────────
  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/order-book/item-catalogue/search?q=${encodeURIComponent(q.trim())}`,
        {
          credentials: 'include',
          headers: { 'User-Id': user?.id, 'User-Role': user?.role }
        }
      );
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setSuggestions(data.data);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Input change handler ──────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  // ── Keyboard navigation ───────────────────────────────────
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  // ── Select a suggestion ───────────────────────────────────
  const handleSelect = (item) => {
    onChange(item.itemName);
    onSelect(item);           // parent fills all other fields
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  };

  // ── Dropdown rendered via portal to escape overflow ───────
  const dropdown = showDropdown && suggestions.length > 0
    ? ReactDOM.createPortal(
        <ul className="iac-dropdown" role="listbox" style={dropdownStyle}>
          {suggestions.map((item, idx) => (
            <li
              key={item.id}
              className={`iac-option ${idx === activeIndex ? 'iac-option--active' : ''}`}
              onMouseDown={() => handleSelect(item)}   // mousedown fires before blur
              role="option"
              aria-selected={idx === activeIndex}
            >
              <div className="iac-option-name">{item.itemName}</div>
              <div className="iac-option-meta">
                {item.specification && <span>{item.specification}</span>}
                {item.unit && <span className="iac-badge">{item.unit}</span>}
                {item.unitPrice > 0 && (
                  <span className="iac-price">
                    ₹{parseFloat(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  return (
    <div className="iac-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className={`orderbook-table-input iac-input ${className || ''}`}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => value?.length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder || 'Item name'}
        required={required}
        autoComplete="off"
      />

      {/* spinner inside input */}
      {loading && <span className="iac-spinner" />}

      {dropdown}
    </div>
  );
}

export default ItemNameAutocomplete;