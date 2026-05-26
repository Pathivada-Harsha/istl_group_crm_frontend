// GroupCategoryFilter.js (2 Dropdowns Only)
import React, { useState, useEffect } from 'react';
import filterApi from '../../services/filterApi.js';
import FilterSelect from './FilterSelect';
import '../../components_css/Dropdowns/GroupProjectFilter.css';

const GroupCategoryFilter = ({ groupValue, subGroupValue, onChange }) => {
  const [groups, setGroups]       = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [loading, setLoading]     = useState({ groups: false, subGroups: false });
  const [error, setError]         = useState({ groups: null, subGroups: null });

  useEffect(() => { fetchGroups(); }, []);

  useEffect(() => {
    if (groupValue) { fetchSubGroups(groupValue); }
    else { setSubGroups([]); }
  }, [groupValue]);

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

  const emit = (patch) => {
    const newFilters = { groupName: groupValue || '', subGroupName: subGroupValue || '', projectId: '', ...patch };
    localStorage.setItem('groupProjectFilters', JSON.stringify(newFilters));
    if (typeof onChange === 'function') onChange(newFilters);
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
          onChange={(v) => emit({ groupName: v, subGroupName: '', projectId: '' })}
        />
        {loading.groups && <div className="filter-loading-bar" />}
        {error.groups && <span className="filter-error">{error.groups}</span>}
      </div>

      {/* Category */}
      <div className="filter-group">
        <label className="filter-label">Category</label>
        <FilterSelect
          value={subGroupValue || ''}
          options={subGroups}
          placeholder={!groupValue ? 'Select Group First' : loading.subGroups ? 'Loading...' : 'Select Category'}
          disabled={!groupValue || loading.subGroups}
          onChange={(v) => emit({ subGroupName: v, projectId: '' })}
        />
        {loading.subGroups && <div className="filter-loading-bar" />}
        {error.subGroups && <span className="filter-error">{error.subGroups}</span>}
      </div>
    </div>
  );
};

export default GroupCategoryFilter;