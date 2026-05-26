// useGroupProjectFilters.js
import { useState, useEffect, useCallback } from 'react';

const useGroupProjectFilters = () => {
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('groupProjectFilters');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { groupName: '', subGroupName: '', projectId: '' };
  });

  // Only sync from OTHER tabs (cross-tab sync via native storage event).
  // Same-tab updates go through setFilters directly — no custom event needed,
  // which eliminates the double-render that was causing the zigzag.
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'groupProjectFilters' && e.newValue) {
        try { setFilters(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateFilters = useCallback((newFilters) => {
    // Single setFilters call — no custom event dispatch to avoid double render
    setFilters(newFilters);
    try { localStorage.setItem('groupProjectFilters', JSON.stringify(newFilters)); } catch {}
  }, []);

  const resetFilters = useCallback(() => {
    const empty = { groupName: '', subGroupName: '', projectId: '' };
    setFilters(empty);
    try { localStorage.setItem('groupProjectFilters', JSON.stringify(empty)); } catch {}
  }, []);

  return {
    filters,
    groupName:    filters.groupName,
    subGroupName: filters.subGroupName,
    projectId:    filters.projectId,
    updateFilters,
    resetFilters,
  };
};

export default useGroupProjectFilters;