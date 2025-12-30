// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';

const USER_KEY = 'bd_portal_user';

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  menuPermissions: [],
  pagePermissions: {},
  loading: true,
  login: () => {},
  logout: () => {},
  getUser: () => null,
});

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [menuPermissions, setMenuPermissions] = useState([]);
  const [pagePermissions, setPagePermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const userStr = localStorage.getItem(USER_KEY);
        if (userStr) {
          const userData = JSON.parse(userStr);
          
          // Validate the stored data structure
          if (userData && userData.user && userData.menuPermissions) {
            setUser(userData.user);
            setMenuPermissions(userData.menuPermissions);
            setPagePermissions(userData.pagePermissions || {});
            setIsAuthenticated(true);
          } else {
            // Invalid data structure, clear storage
            localStorage.removeItem(USER_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        localStorage.removeItem(USER_KEY);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback((userData) => {
    try {
      // Validate userData structure
      if (!userData || !userData.user || !userData.menuPermissions) {
        throw new Error('Invalid user data structure');
      }

      // Store the complete data
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      setUser(userData.user);
      setMenuPermissions(userData.menuPermissions);
      setPagePermissions(userData.pagePermissions || {});
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setMenuPermissions([]);
    setPagePermissions({});
    setIsAuthenticated(false);
  }, []);

  // Get current user data
  const getUser = useCallback(() => {
    try {
      const userStr = localStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }, []);

  const value = {
    isAuthenticated,
    user,
    menuPermissions,
    pagePermissions,
    loading,
    login,
    logout,
    getUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};