// src/services/filterApi.js

const API_BASE_URL = process.env.REACT_APP_API_URL;
const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
  'Content-Type': 'application/json'
});
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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