// src/components/Dropdowns/GroupSubgroupWarehouseFilter.js
//
// Mirrors GroupProjectFilter visually but the third dropdown is WAREHOUSE
// instead of PROJECT. Warehouses cascade from the selected group + sub-group.
// Used by the Inventory Management page where projects are not a concept.
//
// Group + sub-group state is kept in the same localStorage key as
// GroupProjectFilter ('groupProjectFilters') so picking a group on this page
// stays in sync with all other pages that use the project-based filter.
// The warehouse selection is page-local (key: 'inv_active_wh').

import React, { useState, useEffect, useRef } from 'react';
import filterApi from '../../services/filterApi';
import FilterSelect from './FilterSelect';
import '../../components_css/Dropdowns/GroupProjectFilter.css';

const API = process.env.REACT_APP_API_URL;

function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    const u = raw ? (JSON.parse(raw)?.user || {}) : {};
    const id = String(u.id || ''), role = String(u.role || '');
    return {
      'Content-Type': 'application/json',
      'User-Id': id, 'User-Role': role,
      'X-User-Id': id, 'X-User-Role': role,
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

const GroupSubgroupWarehouseFilter = ({
  groupValue,
  subGroupValue,
  warehouseValue,
  onChange,
}) => {
  const [groups, setGroups]         = useState([]);
  const [subGroups, setSubGroups]   = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading]       = useState({ groups: false, subGroups: false, warehouses: false });
  const [error, setError]           = useState({ groups: null, subGroups: null, warehouses: null });

  // Track the latest in-flight warehouse fetch so stale responses can't overwrite newer state
  const whReqId = useRef(0);

  useEffect(() => { fetchGroups(); }, []);

  useEffect(() => {
    if (groupValue) fetchSubGroups(groupValue);
    else { setSubGroups([]); setWarehouses([]); }
  }, [groupValue]);

  useEffect(() => {
    // Warehouses depend on group + sub-group. If either is missing, we still
    // allow fetching a "global" set (warehouses with null scope show under any
    // group). For the page-level filter we only fetch once a group is picked
    // to keep the UX consistent with how Project works.
    if (groupValue) fetchWarehouses(groupValue, subGroupValue);
    else            setWarehouses([]);
  }, [groupValue, subGroupValue]);

  const fetchGroups = async () => {
    setLoading(p => ({ ...p, groups: true }));
    try { setGroups(await filterApi.getAllGroups()); }
    catch { setError(p => ({ ...p, groups: 'Failed to load groups' })); setGroups([]); }
    finally { setLoading(p => ({ ...p, groups: false })); }
  };

  const fetchSubGroups = async (g) => {
    setLoading(p => ({ ...p, subGroups: true }));
    try { setSubGroups(await filterApi.getSubGroups(g)); }
    catch { setError(p => ({ ...p, subGroups: 'Failed to load categories' })); setSubGroups([]); }
    finally { setLoading(p => ({ ...p, subGroups: false })); }
  };

  const fetchWarehouses = async (g, sg) => {
    const reqId = ++whReqId.current;
    setLoading(p => ({ ...p, warehouses: true }));
    try {
      const params = new URLSearchParams();
      if (g)  params.append('groupName', g);
      if (sg) params.append('subGroupName', sg);
      const res = await fetch(`${API}/warehouses?${params.toString()}`, {
        method: 'GET', headers: getAuthHeaders(), credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Drop the response if a newer request has been issued meanwhile
      if (reqId !== whReqId.current) return;
      setWarehouses(Array.isArray(data) ? data : []);
    } catch {
      if (reqId === whReqId.current) {
        setError(p => ({ ...p, warehouses: 'Failed to load warehouses' }));
        setWarehouses([]);
      }
    } finally {
      if (reqId === whReqId.current) setLoading(p => ({ ...p, warehouses: false }));
    }
  };

  // Emit the changed filter. group/subgroup also persist to the shared
  // localStorage key so other pages stay in sync; warehouseId is page-local
  // and the page itself persists it under 'inv_active_wh'.
  const emit = (patch) => {
    const next = {
      groupName:    groupValue    || '',
      subGroupName: subGroupValue || '',
      warehouseId:  warehouseValue || '',
      ...patch,
    };
    // Mirror to the cross-page filter so Group/Subgroup stay in sync everywhere
    try {
      const existing = JSON.parse(localStorage.getItem('groupProjectFilters') || '{}');
      localStorage.setItem('groupProjectFilters', JSON.stringify({
        ...existing,
        groupName: next.groupName,
        subGroupName: next.subGroupName,
        // Clear projectId when group/subgroup change so it doesn't dangle on
        // other pages that consume the same filter
        projectId: patch.groupName !== undefined || patch.subGroupName !== undefined
          ? ''
          : (existing.projectId || ''),
      }));
    } catch {}
    if (typeof onChange === 'function') onChange(next);
  };

  return (
    <div className="group-project-filter">
      {/* Group */}
      <div className="filter-group">
        <label className="filter-label">Group</label>
        <FilterSelect
          value={groupValue || ''}
          options={groups}
          placeholder={loading.groups ? 'Loading...' : 'Select Group'}
          disabled={loading.groups}
          onChange={(v) => emit({ groupName: v, subGroupName: '', warehouseId: '' })}
        />
        {loading.groups && <div className="filter-loading-bar" />}
        {error.groups && <span className="filter-error">{error.groups}</span>}
      </div>

      {/* Category (sub-group) */}
      <div className="filter-group">
        <label className="filter-label">Category</label>
        <FilterSelect
          value={subGroupValue || ''}
          options={subGroups}
          placeholder={!groupValue ? 'Select Group First' : loading.subGroups ? 'Loading...' : 'Select Category'}
          disabled={!groupValue || loading.subGroups}
          onChange={(v) => emit({ subGroupName: v, warehouseId: '' })}
        />
        {loading.subGroups && <div className="filter-loading-bar" />}
        {error.subGroups && <span className="filter-error">{error.subGroups}</span>}
      </div>

      {/* Warehouse — searchable + wider dropdown (matches the Project slot visually) */}
      <div className="filter-group filter-group--project">
        <label className="filter-label">Warehouse</label>
        <FilterSelect
          value={warehouseValue ? String(warehouseValue) : ''}
          options={warehouses.map(w => ({
            value: String(w.id),
            label: w.code ? `${w.name} (${w.code})` : w.name,
          }))}
          placeholder={!groupValue
            ? 'Select Group First'
            : loading.warehouses
              ? 'Loading...'
              : warehouses.length === 0
                ? 'No Warehouses'
                : 'Select Warehouse'}
          disabled={!groupValue || loading.warehouses}
          onChange={(v) => emit({ warehouseId: v })}
          searchable={true}
        />
        {loading.warehouses && <div className="filter-loading-bar filter-loading-bar--project" />}
        {error.warehouses && <span className="filter-error">{error.warehouses}</span>}
      </div>
    </div>
  );
};

export default GroupSubgroupWarehouseFilter;