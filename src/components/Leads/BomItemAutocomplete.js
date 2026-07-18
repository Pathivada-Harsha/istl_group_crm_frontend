// ─────────────────────────────────────────────────────────────────────────────
//  BomItemAutocomplete — item lookup against the BOM master.
//
//  Portal-rendered dropdown (so it escapes table overflow), debounced 250ms,
//  fires from 2 characters. Queries /bom-items-master/search and hands the whole
//  master row back via onSelect so the caller can fill make / unit / category.
//
//  Extracted from LeadBudgetTab so the BOM tab can reuse it. It imports the
//  `lbe-ac-*` styles itself rather than assuming a host tab already has them.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import api from "../../services/leadsapi.js";
import "./LeadBudgetTab.css";

export default function BomItemAutocomplete({ value, onChange, onSelect, disabled, placeholder, category }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const updatePos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(260, suggestions.length * 52 + 8);
    const showAbove = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight + 8;
    setDropdownStyle({
      position: "fixed", left: rect.left, width: rect.width, zIndex: 99999,
      ...(showAbove ? { bottom: window.innerHeight - rect.top + 3 } : { top: rect.bottom + 3 }),
    });
  }, [suggestions.length]);

  useEffect(() => {
    const onDocDown = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [showDropdown, updatePos]);

  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    setLoading(true);
    try {
      const params = { searchTerm: q.trim() };
      if (category) params.category = category;
      const res = await api.get("/bom-items-master/search", { params });
      const data = Array.isArray(res?.data) ? res.data : [];
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]); setShowDropdown(false);
    } finally { setLoading(false); }
  }, [category]);

  const handleInput = e => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const pick = item => {
    onChange(item.itemName || "");
    onSelect?.(item);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const dropdown = showDropdown && suggestions.length > 0
    ? ReactDOM.createPortal(
        <ul className="lbe-ac-dropdown" role="listbox" style={dropdownStyle}>
          {suggestions.map(item => (
            <li key={item.id} className="lbe-ac-option" role="option" aria-selected={false}
              onMouseDown={() => pick(item)}>
              <div className="lbe-ac-name">{item.itemName}</div>
              <div className="lbe-ac-meta">
                {item.makeBrand && <span>{item.makeBrand}</span>}
                {item.defaultUnit && <span className="lbe-ac-badge">{item.defaultUnit}</span>}
                {item.category && <span className="lbe-ac-cat">{item.category}</span>}
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  return (
    <div className="lbe-ac-wrap" ref={wrapperRef}>
      <input ref={inputRef} type="text" className="lbe-inp lbe-ac-input"
        value={value || ""} onChange={handleInput} disabled={disabled}
        onFocus={() => (value?.length >= 2 && suggestions.length > 0) && setShowDropdown(true)}
        placeholder={placeholder || "Item name"} autoComplete="off" />
      {loading && <span className="lbe-ac-spinner" />}
      {dropdown}
    </div>
  );
}
