import React, {
  createContext,
  useState,
  useEffect,
  useCallback
} from 'react';

const USER_KEY = 'bd_portal_user';

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  menuPermissions: [],
  pagePermissions: {},
  sessionTimeout: null, // seconds
  warningTime: null,    // seconds
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
  const [sessionTimeout, setSessionTimeout] = useState(null); // seconds
  const [warningTime, setWarningTime] = useState(null);       // seconds
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const userStr = localStorage.getItem(USER_KEY);
        if (userStr) {
          const userData = JSON.parse(userStr);

          if (userData && userData.user && userData.menuPermissions) {
            setUser(userData.user);
            setMenuPermissions(userData.menuPermissions);
            setPagePermissions(userData.pagePermissions || {});

            setSessionTimeout(userData.sessionTimeout || null);
            setWarningTime(userData.warningTime || null);

            setIsAuthenticated(true);
          } else {
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

  // Login
  const login = useCallback((userData) => {
    try {
      if (!userData || !userData.user || !userData.menuPermissions) {
        throw new Error('Invalid user data structure');
      }

      localStorage.setItem(USER_KEY, JSON.stringify(userData));

      setUser(userData.user);
      setMenuPermissions(userData.menuPermissions);
      setPagePermissions(userData.pagePermissions || {});

      setSessionTimeout(userData.sessionTimeout || null);
      setWarningTime(userData.warningTime || null);

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setMenuPermissions([]);
    setPagePermissions({});
    setSessionTimeout(null);
    setWarningTime(null);
    setIsAuthenticated(false);
  }, []);

  // Get stored user (raw)
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
    sessionTimeout,
    warningTime,
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
