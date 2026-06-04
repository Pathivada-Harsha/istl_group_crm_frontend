import React, {
  createContext,
  useState,
  useEffect,
  useCallback
} from 'react';

const USER_KEY = 'bd_portal_user';
const SIDEBAR_KEY_PREFIX = 'sidebar_state_';

// ─── Permission policy ────────────────────────────────────────────────────────
// Permissions are driven ENTIRELY by what the backend returns at login.
// No role-based overrides (ACCOUNTS_*, SUPERADMIN, etc.) are applied here.
// Every user — regardless of role — only gets what is in their DB permissions.
//
// isAccountsRole is kept solely so pages can still read isAccountsExecutive
// from the context without breaking their destructuring — it no longer affects
// what permissions are merged.
const isAccountsRole = (role) =>
  typeof role === 'string' && role.trim().toUpperCase().startsWith('ACCOUNTS_');

// No-op: just return server permissions as-is. The old ACCOUNTS_PERMISSIONS
// block was removed so that permissions are purely DB-driven.
const applyAccountsExecutiveOverride = (_role, serverPagePermissions) => ({
  ...(serverPagePermissions || {}),
});

// ─── Sidebar state cleanup helper ─────────────────────────────────────────────
/**
 * Removes ALL sidebar accordion state keys from localStorage.
 * Called on logout and session expiry so a new user on the same device
 * always starts with the default collapsed state.
 *
 * Keys written by sidebar.js follow the pattern:
 *   sidebar_state_<userId>   (e.g. sidebar_state_42)
 *   sidebar_state_anonymous  (fallback when user id not yet resolved)
 */
function clearAllSidebarState() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SIDEBAR_KEY_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch { /* localStorage unavailable — nothing to clear */ }
}

// ─────────────────────────────────────────────────────────────────────────────

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  menuPermissions: [],
  pagePermissions: {},
  isAccountsExecutive: false,
  sessionTimeout: null,
  warningTime: null,
  loading: true,
  avatarTs: 0,
  refreshAvatarTs: () => {},
  login: () => {},
  logout: () => {},
  getUser: () => null,
});

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [menuPermissions, setMenuPermissions] = useState([]);
  const [pagePermissions, setPagePermissions] = useState({});
  const [isAccountsExecutive, setIsAccountsExecutive] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(null);
  const [warningTime, setWarningTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarTs, setAvatarTs] = useState(() => Date.now());
  const refreshAvatarTs = useCallback(() => setAvatarTs(Date.now()), []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const userStr = localStorage.getItem(USER_KEY);
        if (userStr) {
          const userData = JSON.parse(userStr);

          if (userData && userData.user && userData.menuPermissions) {
            const role = userData.user?.role || '';
            const effectivePagePermissions = applyAccountsExecutiveOverride(
              role,
              userData.pagePermissions || {}
            );

            setUser(userData.user);
            setMenuPermissions(userData.menuPermissions);
            setPagePermissions(effectivePagePermissions);
            setIsAccountsExecutive(isAccountsRole(role));
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

      const role = userData.user?.role || '';
      const effectivePagePermissions = applyAccountsExecutiveOverride(
        role,
        userData.pagePermissions || {}
      );

      setUser(userData.user);
      setMenuPermissions(userData.menuPermissions);
      setPagePermissions(effectivePagePermissions);
      setIsAccountsExecutive(isAccountsRole(role));
      setSessionTimeout(userData.sessionTimeout || null);
      setWarningTime(userData.warningTime || null);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }, []);

  // ── Tab / view navigation state ────────────────────────────────────────────
  const NAV_STATE_KEYS = [
    'leads_detail_lead',
    'leads_detail_tab',
    'leads_view_mode',
    'cust_detail_customer',
    'cust_detail_tab',
    'invoicesReceiptsActiveTab',
    'billsPaymentsActiveTab',
  ];

  const clearNavState = useCallback(() => {
    // 1. Clear fixed tab/view state keys
    NAV_STATE_KEYS.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // 2. Clear ALL sidebar accordion state (all users, all keys)
    clearAllSidebarState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Logout
  const logout = useCallback(() => {
    clearNavState();
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setMenuPermissions([]);
    setPagePermissions({});
    setIsAccountsExecutive(false);
    setSessionTimeout(null);
    setWarningTime(null);
    setIsAuthenticated(false);
  }, [clearNavState]);

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
    isAccountsExecutive,
    sessionTimeout,
    warningTime,
    loading,
    avatarTs,
    refreshAvatarTs,
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