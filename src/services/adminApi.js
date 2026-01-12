// src/services/adminApi.js

const API_BASE_URL = 'http://localhost:8080/api/admin/dropdowns';

const adminApi = {
  // ============ GROUP OPERATIONS ============

  getAllGroups: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups`, {
        credentials: "include",
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
  },

  createGroup: async (group) => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups`, {
        credentials: "include",
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  },

  updateGroup: async (id, group) => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  },

  deleteGroup: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${id}`, {
        credentials: "include",
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  },

  // ============ SUBGROUP OPERATIONS ============

  getAllSubGroups: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/subgroups`, {
        credentials: "include",
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching subgroups:', error);
      throw error;
    }
  },

  createSubGroup: async (subGroup, groupId) => {
    try {
      const params = new URLSearchParams({ groupId });
      const response = await fetch(`${API_BASE_URL}/subgroups?${params}`, {
        credentials: "include",
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subGroup),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error creating subgroup:', error);
      throw error;
    }
  },

  updateSubGroup: async (id, subGroup) => {
    try {
      const response = await fetch(`${API_BASE_URL}/subgroups/${id}`, {
        credentials: "include",
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subGroup),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating subgroup:', error);
      throw error;
    }
  },

  deleteSubGroup: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/subgroups/${id}`, {
        credentials: "include",
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting subgroup:', error);
      throw error;
    }
  },

  // ============ PROJECT OPERATIONS ============

  getAllProjects: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        credentials: "include",
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  createProject: async (project, subGroupId, userId) => {
    try {
      const params = new URLSearchParams({ subGroupId, userId });
      const response = await fetch(`${API_BASE_URL}/projects?${params}`, {
        credentials: "include",
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  updateProject: async (projectUniqueId, project) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectUniqueId}`, {
        credentials: "include",
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  deleteProject: async (projectUniqueId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectUniqueId}`, {
        credentials: "include",
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },
};

export default adminApi;