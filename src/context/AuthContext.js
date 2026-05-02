import React, {
  createContext,
  useState,
  useEffect,
  useCallback
} from 'react';

const USER_KEY = 'bd_portal_user';

// ─── ACCOUNTS_EXECUTIVE permission override ───────────────────────────────────
// Pages the accounts executive can fully use (VIEW + CREATE + EDIT).
// DELETE and ASSIGN are intentionally excluded — the backend enforces this too.
const ACCOUNTS_EXECUTIVE_ROLE = 'ACCOUNTS_EXECUTIVE';
const SUPERADMIN_ROLES = ['SUPERADMIN', 'ADMIN'];

// Full permissions granted to SUPERADMIN and ADMIN on all pages
const SUPERADMIN_PERMISSIONS = {
  LEADS:                   ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN', 'APPROVE', 'DOWNLOAD'],
  CUSTOMERS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  VENDORS:                 ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  PROPOSALS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'DOWNLOAD'],
  PURCHASE_ORDERS:         ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'],
  ORDER_BOOK:              ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'],
  PROCUREMENT_QUOTATIONS:  ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'],
  SALES_QUOTATIONS:        ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'],
  INVOICES:                ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'SEND', 'DOWNLOAD'],
  BILLS:                   ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'DOWNLOAD'],
  PAYMENTS:                ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'],
  REPORTS:                 ['VIEW'],
  SETTINGS:                ['VIEW', 'EDIT'],
  USERS:                   ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  ROLES:                   ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  FOLLOWUPS:               ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  ATTACHMENTS:             ['VIEW', 'UPLOAD', 'DELETE'],
};

const ACCOUNTS_EXECUTIVE_PERMISSIONS = {
  // Finance — core responsibility
  INVOICES:              ['VIEW', 'CREATE', 'EDIT', 'DOWNLOAD'],
  BILLS:                 ['VIEW', 'CREATE', 'EDIT', 'DOWNLOAD'],
  PAYMENTS:              ['VIEW', 'CREATE', 'EDIT'],
  // Procurement visibility
  PURCHASE_ORDERS:       ['VIEW', 'CREATE', 'EDIT'],
  ORDER_BOOK:            ['VIEW', 'CREATE', 'EDIT'],
  PROCUREMENT_QUOTATIONS:['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
  VENDORS:               ['VIEW', 'CREATE', 'EDIT'],
  // Clients / Customers read + edit (no delete)
  CUSTOMERS:             ['VIEW', 'CREATE', 'EDIT'],
  // Leads — read only for accounts context
  LEADS:                 ['VIEW'],
  // Reports
  REPORTS:               ['VIEW'],
};

/**
 * Applies role-specific permission overrides.
 * - SUPERADMIN / ADMIN: trust the server's pagePermissions entirely — no frontend override.
 *   Their permissions are managed in the DB just like any other role.
 * - ACCOUNTS_EXECUTIVE: merges in the hardcoded baseline if the server gave nothing,
 *   so the UI unlocks the finance pages they always need.
 */
const applyAccountsExecutiveOverride = (role, serverPagePermissions) => {
  const merged = { ...(serverPagePermissions || {}) };

  // SUPERADMIN / ADMIN — use whatever the server returned, no forced override
  if (SUPERADMIN_ROLES.includes(role)) {
    return merged;
  }

  if (role !== ACCOUNTS_EXECUTIVE_ROLE) return merged;

  Object.entries(ACCOUNTS_EXECUTIVE_PERMISSIONS).forEach(([page, perms]) => {
    const existing = merged[page] || [];
    // Union: keep anything the server already gave + our override list
    const combined = Array.from(new Set([...existing, ...perms]));
    merged[page] = combined;
  });
  return merged;
};

export const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  menuPermissions: [],
  pagePermissions: {},
  isAccountsExecutive: false,
  sessionTimeout: null,
  warningTime: null,
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
  const [isAccountsExecutive, setIsAccountsExecutive] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(null);
  const [warningTime, setWarningTime] = useState(null);
  const [loading, setLoading] = useState(true);

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
            setIsAccountsExecutive(role === ACCOUNTS_EXECUTIVE_ROLE);

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
      setIsAccountsExecutive(role === ACCOUNTS_EXECUTIVE_ROLE);

      setSessionTimeout(userData.sessionTimeout || null);
      setWarningTime(userData.warningTime || null);

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }, []);

  // Tab/view navigation state keys to clear on logout or session expiry.
  // Only these specific UI-state keys are removed — auth, columns, page-size
  // preferences and all other localStorage entries are left untouched.
  const NAV_STATE_KEYS = [
    'leads_detail_lead',
    'leads_detail_tab',
    'leads_view_mode',
    'invoicesReceiptsActiveTab',
    'billsPaymentsActiveTab',
  ];

  const clearNavState = () => {
    NAV_STATE_KEYS.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  };

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
    isAccountsExecutive,
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