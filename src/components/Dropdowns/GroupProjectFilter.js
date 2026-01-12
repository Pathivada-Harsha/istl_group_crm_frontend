// src/components/Dropdowns/GroupProjectFilter.js
import React, { useState, useEffect } from 'react';
import filterApi from '../../services/filterApi';
import '../../components_css/Dropdowns/GroupProjectFilter.css';

const GroupProjectFilter = ({ 
  groupValue, 
  subGroupValue,
  projectValue, 
  onChange 
}) => {
  const [groups, setGroups] = useState([]);
  const [subGroups, setSubGroups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState({
    groups: false,
    subGroups: false,
    projects: false
  });
  const [error, setError] = useState({
    groups: null,
    subGroups: null,
    projects: null
  });

  // Fetch groups on component mount
  useEffect(() => {
    fetchGroups();
  }, []);

  // Fetch subgroups when group changes
  useEffect(() => {
    if (groupValue) {
      fetchSubGroups(groupValue);
    } else {
      setSubGroups([]);
      setProjects([]);
    }
  }, [groupValue]);

  // Fetch projects when subgroup changes
  useEffect(() => {
    if (groupValue && subGroupValue) {
      fetchProjects(groupValue, subGroupValue);
    } else {
      setProjects([]);
    }
  }, [groupValue, subGroupValue]);

  const fetchGroups = async () => {
    setLoading(prev => ({ ...prev, groups: true }));
    setError(prev => ({ ...prev, groups: null }));
    
    try {
      const data = await filterApi.getAllGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setError(prev => ({ ...prev, groups: 'Failed to load groups' }));
      setGroups([]);
    } finally {
      setLoading(prev => ({ ...prev, groups: false }));
    }
  };

  const fetchSubGroups = async (groupName) => {
    setLoading(prev => ({ ...prev, subGroups: true }));
    setError(prev => ({ ...prev, subGroups: null }));
    
    try {
      const data = await filterApi.getSubGroups(groupName);
      setSubGroups(data);
    } catch (error) {
      console.error('Failed to fetch subgroups:', error);
      setError(prev => ({ ...prev, subGroups: 'Failed to load categories' }));
      setSubGroups([]);
    } finally {
      setLoading(prev => ({ ...prev, subGroups: false }));
    }
  };

  const fetchProjects = async (groupName, subGroupName) => {
    setLoading(prev => ({ ...prev, projects: true }));
    setError(prev => ({ ...prev, projects: null }));
    
    try {
      const data = await filterApi.getProjects(groupName, subGroupName);
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setError(prev => ({ ...prev, projects: 'Failed to load projects' }));
      setProjects([]);
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const handleGroupChange = (e) => {
    const newGroup = e.target.value;
    const newFilters = {
      groupName: newGroup,
      subGroupName: '',
      projectId: ''
    };
    
    localStorage.setItem('groupProjectFilters', JSON.stringify(newFilters));
    
    if (typeof onChange === 'function') {
      onChange(newFilters);
    }
  };

  const handleSubGroupChange = (e) => {
    const newFilters = {
      groupName: groupValue,
      subGroupName: e.target.value,
      projectId: ''
    };
    
    localStorage.setItem('groupProjectFilters', JSON.stringify(newFilters));
    
    if (typeof onChange === 'function') {
      onChange(newFilters);
    }
  };

  const handleProjectChange = (e) => {
    const newFilters = {
      groupName: groupValue,
      subGroupName: subGroupValue,
      projectId: e.target.value
    };
    
    localStorage.setItem('groupProjectFilters', JSON.stringify(newFilters));
    
    if (typeof onChange === 'function') {
      onChange(newFilters);
    }
  };

  return (
    <div className="group-project-filter">
      <div className="filter-group">
        <label htmlFor="group-filter" className="filter-label">
          Group
        </label>
        <select
          id="group-filter"
          className="filter-select"
          value={groupValue || ''}
          onChange={handleGroupChange}
          disabled={loading.groups}
        >
          <option value="">
            {loading.groups ? 'Loading...' : error.groups ? 'Error loading groups' : 'Select Group'}
          </option>
          {groups.map(group => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
        {error.groups && (
          <span className="filter-error">{error.groups}</span>
        )}
      </div>

      <div className="filter-group">
        <label htmlFor="subgroup-filter" className="filter-label">
          Category
        </label>
        <select
          id="subgroup-filter"
          className="filter-select"
          value={subGroupValue || ''}
          onChange={handleSubGroupChange}
          disabled={!groupValue || loading.subGroups}
        >
          <option value="">
            {!groupValue 
              ? 'Select Group First' 
              : loading.subGroups 
              ? 'Loading...'
              : error.subGroups
              ? 'Error loading categories'
              : 'Select Category'
            }
          </option>
          {subGroups.map(subGroup => (
            <option key={subGroup.value} value={subGroup.value}>
              {subGroup.label}
            </option>
          ))}
        </select>
        {error.subGroups && (
          <span className="filter-error">{error.subGroups}</span>
        )}
      </div>

      <div className="filter-group">
        <label htmlFor="project-filter" className="filter-label">
          Project
        </label>
        <select
          id="project-filter"
          className="filter-select"
          value={projectValue || ''}
          onChange={handleProjectChange}
          disabled={!subGroupValue || loading.projects}
        >
          <option value="">
            {!subGroupValue 
              ? 'Select Category First' 
              : loading.projects
              ? 'Loading...'
              : error.projects
              ? 'Error loading projects'
              : 'Select Project'
            }
          </option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {error.projects && (
          <span className="filter-error">{error.projects}</span>
        )}
      </div>
    </div>
  );
};

export default GroupProjectFilter;



