// src/services/filterApi.js

const API_BASE_URL = process.env.REACT_APP_API_URL;

// Read logged-in user from the same key AuthContext uses
const getUser = () => {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.user || {};
  } catch { return {}; }
};

const getAuthHeaders = () => {
  const u = getUser();
  const id   = String(u.id   || '');
  const role = String(u.role || '');
  return {
    'Content-Type': 'application/json',
    'User-Id':     id,
    'User-Role':   role,
    'X-User-Id':   id,
    'X-User-Role': role,
  };
};
const filterApi = {
  // Get all groups
   getLeadsUsers : async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/leads-users`, {credentials: "include",
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching leads users:', error);
      throw error;
    }
  },
  getAllGroups: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters/groups`, {credentials: "include",
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
  },

  // Get subgroups by group name
  getSubGroups: async (groupName) => {
    try {
      const params = new URLSearchParams({ groupName });
      const response = await fetch(`${API_BASE_URL}/filters/subgroups?${params}`, {credentials: "include",
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching subgroups:', error);
      throw error;
    }
  },

  // Get projects by group and subgroup
  getProjects: async (groupName, subGroupName) => {
    try {
      const params = new URLSearchParams({ groupName, subGroupName });
      const response = await fetch(`${API_BASE_URL}/filters/projects?${params}`, {credentials: "include",
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  // Get project details by unique ID
  getProjectDetails: async (projectUniqueId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectUniqueId}`, {credentials: "include",
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching project details:', error);
      throw error;
    }
  },

  // Create new project
  createProject: async (project, subGroupId) => {
    try {
      const params = new URLSearchParams({ subGroupId });
      const response = await fetch(`${API_BASE_URL}/projects?${params}`, {credentials: "include",
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(project),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  // Update project
  updateProject: async (projectUniqueId, project) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectUniqueId}`, {credentials: "include",
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(project),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  // Delete project (soft delete)
  deleteProject: async (projectUniqueId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectUniqueId}`, {credentials: "include",
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // DELETE returns 204 No Content, so don't try to parse JSON
      if (response.status === 204) {
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },

};

export default filterApi;