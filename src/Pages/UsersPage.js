import React, { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import '../pages-css/UsersPage.css';

// Toast Component (embedded)
const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'notification':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-header">
        <span className="toast-icon">{getIcon()}</span>
        <strong className="toast-title">{type.charAt(0).toUpperCase() + type.slice(1)}</strong>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
      <div className="toast-body">{message}</div>
    </div>
  );
};

// ConfirmModal Component (embedded)
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger"
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '!';
      case 'warning':
        return '⚠';
      case 'info':
        return 'i';
      default:
        return '!';
    }
  };

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-modal-icon confirm-modal-icon-${type}`}>
          <span>{getIcon()}</span>
        </div>

        <h2 className="confirm-modal-title">{title}</h2>

        <p className="confirm-modal-message">{message}</p>
        <p className="confirm-modal-warning">This action cannot be undone.</p>

        <div className="confirm-modal-actions">
          <button
            className="confirm-modal-btn confirm-modal-btn-cancel"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-${type}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const UsersPage = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showMenuPermissionsModal, setShowMenuPermissionsModal] = useState(false);
  const [showEditMenuPermissionsModal, setShowEditMenuPermissionsModal] = useState(false);
  const [showUserPermissionsModal, setShowUserPermissionsModal] = useState(false);
  const [showEditUserPermissionsModal, setShowEditUserPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserMenuPermissions, setSelectedUserMenuPermissions] = useState({});
  const [selectedUserPermissions, setSelectedUserPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const { user, pagePermissions, menuPermissions } = useAuth();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Debounce timer for search
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);

  // New User Form State
  const [newUser, setNewUser] = useState({
    user_id: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: '',
    is_active: true
  });
  const [userIdValidation, setUserIdValidation] = useState({
    checking: false,
    isValid: null,
    message: ''
  });
  const [passwordMatch, setPasswordMatch] = useState({
    isValid: null,
    message: ''
  });
  const [phoneValidation, setPhoneValidation] = useState({
    isValid: null,
    message: ''
  });
  const [passwordStrength, setPasswordStrength] = useState({
    isValid: null,
    message: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Statistics from API
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);

  // Menu permissions list structure - matches database columns (15 permissions)
  const menuPermissionsList = [
    { id: 'dashboard', name: 'Dashboard', dbField: 'dashboard', backendKey: 'DASHBOARD' },
    { id: 'analytics', name: 'Analytics', dbField: 'analytics', backendKey: 'ANALYTICS' },
    { id: 'documents', name: 'Documents', dbField: 'documents', backendKey: 'DOCUMENTS' },
    { id: 'settings', name: 'Settings', dbField: 'settings', backendKey: 'SETTINGS' },
    { id: 'follow_ups', name: 'Follow Ups', dbField: 'follow_ups', backendKey: 'FOLLOW_UPS' },
    { id: 'reports', name: 'Reports', dbField: 'reports', backendKey: 'REPORTS' },
    { id: 'invoices', name: 'Invoices', dbField: 'invoices', backendKey: 'INVOICES' },
    { id: 'sales_clients', name: 'Sales - Clients', dbField: 'sales_clients', backendKey: 'SALES_CLIENTS' },
    { id: 'sales_leads', name: 'Sales - Leads', dbField: 'sales_leads', backendKey: 'SALES_LEADS' },
    { id: 'sales_estimation', name: 'Sales - Estimation', dbField: 'sales_estimation', backendKey: 'SALES_ESTIMATION' },
    { id: 'procurement_venders', name: 'Procurement - Vendors', dbField: 'procurement_venders', backendKey: 'PROCUREMENT_VENDERS' },
    { id: 'procurement_quotations_recived', name: 'Procurement - Quotations', dbField: 'procurement_quotations_recived', backendKey: 'PROCUREMENT_QUOTATIONS' },
    { id: 'procurement_purchase_orders', name: 'Procurement - Purchase Orders', dbField: 'procurement_purchase_orders', backendKey: 'PROCUREMENT_PURCHASE_ORDERS' },
    { id: 'procurement_bills_received', name: 'Procurement - Bills', dbField: 'procurement_bills_received', backendKey: 'PROCUREMENT_BILLS' },
    { id: 'office_use', name: 'Office Use', dbField: 'office_use', backendKey: 'OFFICE_USE' }
  ];

  // Filter menu permissions based on logged-in user's access
  const availableMenuPermissions = menuPermissions && Array.isArray(menuPermissions)
    ? menuPermissionsList.filter(menu => menuPermissions.includes(menu.backendKey))
    : menuPermissionsList; // If no restrictions, show all

  // Page permissions structure - matches your database exactly
  const pagePermissionsStructure = [
    { id: 1, name: 'users.view', description: 'View users', module: 'User Management' },
    { id: 2, name: 'users.create', description: 'Create new users', module: 'User Management' },
    { id: 3, name: 'users.edit', description: 'Edit user details', module: 'User Management' },
    { id: 4, name: 'users.delete', description: 'Delete users', module: 'User Management' },
    { id: 5, name: 'roles.manage', description: 'Manage roles and permissions', module: 'User Management' },
    { id: 6, name: 'customers.view', description: 'View customers', module: 'Customer Management' },
    { id: 7, name: 'customers.create', description: 'Create customers', module: 'Customer Management' },
    { id: 8, name: 'customers.edit', description: 'Edit customer details', module: 'Customer Management' },
    { id: 9, name: 'customers.delete', description: 'Delete customers', module: 'Customer Management' },
    { id: 10, name: 'vendors.view', description: 'View vendors', module: 'Vendor Management' },
    { id: 11, name: 'vendors.create', description: 'Create vendors', module: 'Vendor Management' },
    { id: 12, name: 'vendors.edit', description: 'Edit vendor details', module: 'Vendor Management' },
    { id: 13, name: 'vendors.delete', description: 'Delete vendors', module: 'Vendor Management' },
    { id: 14, name: 'leads.view', description: 'View leads', module: 'Lead Management' },
    { id: 15, name: 'leads.create', description: 'Create leads', module: 'Lead Management' },
    { id: 16, name: 'leads.edit', description: 'Edit leads', module: 'Lead Management' },
    { id: 17, name: 'leads.delete', description: 'Delete leads', module: 'Lead Management' },
    { id: 18, name: 'leads.assign', description: 'Assign leads to team members', module: 'Lead Management' },
    { id: 19, name: 'proposals.view', description: 'View proposals', module: 'Proposal Management' },
    { id: 20, name: 'proposals.create', description: 'Create proposals', module: 'Proposal Management' },
    { id: 21, name: 'proposals.edit', description: 'Edit proposals', module: 'Proposal Management' },
    { id: 22, name: 'proposals.delete', description: 'Delete proposals', module: 'Proposal Management' },
    { id: 23, name: 'proposals.approve', description: 'Approve proposals', module: 'Proposal Management' },
    { id: 24, name: 'quotations.sales.view', description: 'View sales quotations', module: 'Sales Quotations' },
    { id: 25, name: 'quotations.sales.create', description: 'Create sales quotations', module: 'Sales Quotations' },
    { id: 26, name: 'quotations.sales.edit', description: 'Edit sales quotations', module: 'Sales Quotations' },
    { id: 27, name: 'quotations.sales.delete', description: 'Delete sales quotations', module: 'Sales Quotations' },
    { id: 28, name: 'quotations.sales.approve', description: 'Approve sales quotations', module: 'Sales Quotations' },
    { id: 29, name: 'sales_orders.view', description: 'View sales orders', module: 'Sales Orders' },
    { id: 30, name: 'sales_orders.create', description: 'Create sales orders', module: 'Sales Orders' },
    { id: 31, name: 'sales_orders.edit', description: 'Edit sales orders', module: 'Sales Orders' },
    { id: 32, name: 'sales_orders.delete', description: 'Delete sales orders', module: 'Sales Orders' },
    { id: 33, name: 'sales_orders.approve', description: 'Approve sales orders', module: 'Sales Orders' },
    { id: 34, name: 'invoices.view', description: 'View invoices', module: 'Invoices' },
    { id: 35, name: 'invoices.create', description: 'Create invoices', module: 'Invoices' },
    { id: 36, name: 'invoices.edit', description: 'Edit invoices', module: 'Invoices' },
    { id: 37, name: 'invoices.delete', description: 'Delete invoices', module: 'Invoices' },
    { id: 38, name: 'invoices.send', description: 'Send invoices to customers', module: 'Invoices' },
    { id: 39, name: 'quotations.procurement.view', description: 'View procurement quotations', module: 'Procurement Quotations' },
    { id: 40, name: 'quotations.procurement.create', description: 'Create procurement quotations', module: 'Procurement Quotations' },
    { id: 41, name: 'quotations.procurement.edit', description: 'Edit procurement quotations', module: 'Procurement Quotations' },
    { id: 42, name: 'quotations.procurement.delete', description: 'Delete procurement quotations', module: 'Procurement Quotations' },
    { id: 43, name: 'quotations.procurement.approve', description: 'Approve procurement quotations', module: 'Procurement Quotations' },
    { id: 44, name: 'purchase_orders.view', description: 'View purchase orders', module: 'Purchase Orders' },
    { id: 45, name: 'purchase_orders.create', description: 'Create purchase orders', module: 'Purchase Orders' },
    { id: 46, name: 'purchase_orders.edit', description: 'Edit purchase orders', module: 'Purchase Orders' },
    { id: 47, name: 'purchase_orders.delete', description: 'Delete purchase orders', module: 'Purchase Orders' },
    { id: 48, name: 'purchase_orders.approve', description: 'Approve purchase orders', module: 'Purchase Orders' },
    { id: 49, name: 'bills.view', description: 'View bills', module: 'Bills' },
    { id: 50, name: 'bills.create', description: 'Create/upload bills', module: 'Bills' },
    { id: 51, name: 'bills.edit', description: 'Edit bills', module: 'Bills' },
    { id: 52, name: 'bills.delete', description: 'Delete bills', module: 'Bills' },
    { id: 53, name: 'bills.approve', description: 'Approve bills for payment', module: 'Bills' },
    { id: 54, name: 'payments.view', description: 'View payments', module: 'Payments' },
    { id: 55, name: 'payments.record', description: 'Record payments', module: 'Payments' },
    { id: 56, name: 'payments.approve', description: 'Approve payments', module: 'Payments' },
    { id: 57, name: 'reports.sales', description: 'View sales reports', module: 'Reports' },
    { id: 58, name: 'reports.procurement', description: 'View procurement reports', module: 'Reports' },
    { id: 59, name: 'reports.financial', description: 'View financial reports', module: 'Reports' },
    { id: 60, name: 'reports.analytics', description: 'View analytics dashboard', module: 'Reports' },
    { id: 61, name: 'followups.view', description: 'View followups', module: 'Followups' },
    { id: 62, name: 'followups.create', description: 'Create followups', module: 'Followups' },
    { id: 63, name: 'followups.edit', description: 'Edit followups', module: 'Followups' },
    { id: 64, name: 'followups.delete', description: 'Delete followups', module: 'Followups' },
    { id: 65, name: 'settings.view', description: 'View system settings', module: 'System' },
    { id: 66, name: 'settings.edit', description: 'Edit system settings', module: 'System' },
    { id: 67, name: 'activity_logs.view', description: 'View activity logs', module: 'System' },
    { id: 68, name: 'attachments.upload', description: 'Upload attachments', module: 'System' },
    { id: 69, name: 'attachments.delete', description: 'Delete attachments', module: 'System' }
  ];

  // Enhanced mapping function to convert backend module.action to frontend permission name
  const mapBackendPermissionToFrontend = (module, action) => {
    // Comprehensive mapping for all backend module name variations
    const moduleMap = {
      'USERS': 'users',
      'ROLES': 'roles',
      'CUSTOMERS': 'customers',
      'VENDORS': 'vendors',
      'LEADS': 'leads',
      'PROPOSALS': 'proposals',
      'QUOTATIONS.SALES': 'quotations.sales',
      'SALES.ORDERS': 'sales_orders',
      'INVOICES': 'invoices',
      'QUOTATIONS.PROCUREMENT': 'quotations.procurement',
      'PURCHASE.ORDERS': 'purchase_orders',
      'BILLS': 'bills',
      'PAYMENTS': 'payments',
      'REPORTS': 'reports',
      'FOLLOWUPS': 'followups',
      'SETTINGS': 'settings',
      'ACTIVITY.LOGS': 'activity_logs',
      'ATTACHMENTS': 'attachments'
    };

    const frontendModule = moduleMap[module] || module.toLowerCase().replace(/\./g, '_');
    const frontendAction = action.toLowerCase();

    return `${frontendModule}.${frontendAction}`;
  };

  // Filter page permissions based on logged-in user's access
  const availablePagePermissions = React.useMemo(() => {
    // If no pagePermissions from auth, show all permissions
    if (!pagePermissions || typeof pagePermissions !== 'object') {
      console.log('No page permissions restrictions - showing all 69 permissions');
      return pagePermissionsStructure;
    }

    // Build a Set of all permission names the user has access to
    const userPermissionNames = new Set();

    Object.entries(pagePermissions).forEach(([module, actions]) => {
      if (Array.isArray(actions)) {
        actions.forEach(action => {
          const permName = mapBackendPermissionToFrontend(module, action);
          userPermissionNames.add(permName);
        });
      }
    });

    console.log('User has access to these permission names:', Array.from(userPermissionNames));
    console.log('Total accessible permissions:', userPermissionNames.size);

    // Filter permissions structure to only include what user has access to
    const filtered = pagePermissionsStructure.filter(perm =>
      userPermissionNames.has(perm.name)
    );

    console.log('Filtered permissions count:', filtered.length);
    console.log('Total permissions in structure:', pagePermissionsStructure.length);

    return filtered;
  }, [pagePermissions]);

  // Toast functions
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Format date to dd-mm-yyyy hh:mm:ss
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  // Fetch users with search and filters
  const fetchUsers = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Use search API endpoint
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/users/search/${user.id}?searchTerm=${encodeURIComponent(searchTerm)}&role=${filterRole}&page=${currentPage}&size=${pageSize}`
      );
      const data = await response.json();

      const transformedUsers = data.userWrapper.map(apiUser => ({
        id: apiUser.id,
        username: apiUser.user_id,
        email: apiUser.email,
        full_name: apiUser.name,
        phone: apiUser.phone,
        is_active: apiUser.is_active === 1,
        role_id: apiUser.role,
        role_name: apiUser.role,
        permission_count: apiUser.pagePermissionsCount || 0,
        menu_permissions_count: apiUser.menuPermissionsCount || 0,
        created_at: formatDateTime(apiUser.created_at)
      }));

      setUsers(transformedUsers);
      setTotalUsers(data.totalUsers || 0);
      setActiveUsers(data.activeUsers || 0);
      setInactiveUsers(data.inactiveUsers || 0);

      // Pagination Meta from Backend
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalUsers || 0);

      const uniqueRoles = data.roles.map((roleName) => ({
        id: roleName, name: roleName, description: `${roleName} role`
      }));
      setRoles(uniqueRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (user?.id) {
      fetchUsers();
    }
  }, [user]);

  // Fetch when pagination or role filter changes (immediate)
  useEffect(() => {
    if (user?.id) {
      fetchUsers();
    }
  }, [currentPage, pageSize, filterRole]);

  // Debounced search - only triggers after user stops typing
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      if (user?.id) {
        setCurrentPage(1); // Reset to first page on new search
        fetchUsers();
      }
    }, 500); // 500ms debounce delay

    setSearchDebounceTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [searchTerm]);

  // Check if User ID exists
  const checkUserIdExists = async (userId) => {
    if (!userId || userId.trim() === '') {
      setUserIdValidation({
        checking: false,
        isValid: null,
        message: ''
      });
      return;
    }

    setUserIdValidation({
      checking: true,
      isValid: null,
      message: 'Checking availability...'
    });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/isUserIdExist/${userId}`);
      const exists = await response.json(); // Boolean response

      if (exists) {
        setUserIdValidation({
          checking: false,
          isValid: false,
          message: 'User Name Already Exist Choose Another Name'
        });
      } else {
        setUserIdValidation({
          checking: false,
          isValid: true,
          message: 'Username is available'
        });
      }
    } catch (error) {
      console.error('Error checking user ID:', error);
      setUserIdValidation({
        checking: false,
        isValid: null,
        message: 'Error checking username'
      });
    }
  };

  // Debounce user ID check
  useEffect(() => {
    if (showAddUserModal && newUser.user_id) {
      const timer = setTimeout(() => {
        checkUserIdExists(newUser.user_id);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [newUser.user_id, showAddUserModal]);

  // Password match validation
  useEffect(() => {
    if (showAddUserModal && newUser.password && newUser.confirmPassword) {
      if (newUser.password === newUser.confirmPassword) {
        setPasswordMatch({
          isValid: true,
          message: 'Passwords match'
        });
      } else {
        setPasswordMatch({
          isValid: false,
          message: 'Passwords do not match'
        });
      }
    } else if (showAddUserModal && newUser.confirmPassword) {
      setPasswordMatch({
        isValid: false,
        message: 'Passwords do not match'
      });
    } else {
      setPasswordMatch({
        isValid: null,
        message: ''
      });
    }
  }, [newUser.password, newUser.confirmPassword, showAddUserModal]);

  // Phone number validation
  useEffect(() => {
    if (showAddUserModal && newUser.phone) {
      const phoneRegex = /^\d{10}$/;
      if (phoneRegex.test(newUser.phone)) {
        setPhoneValidation({
          isValid: true,
          message: 'Valid phone number'
        });
      } else if (newUser.phone.length < 10) {
        setPhoneValidation({
          isValid: false,
          message: `${newUser.phone.length}/10 digits`
        });
      } else {
        setPhoneValidation({
          isValid: false,
          message: 'Phone number must be exactly 10 digits'
        });
      }
    } else {
      setPhoneValidation({
        isValid: null,
        message: ''
      });
    }
  }, [newUser.phone, showAddUserModal]);

  // Password strength validation
  useEffect(() => {
    if (showAddUserModal && newUser.password) {
      const hasUpperCase = /[A-Z]/.test(newUser.password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newUser.password);
      const isLengthValid = newUser.password.length >= 6;

      if (isLengthValid && hasUpperCase && hasSpecialChar) {
        setPasswordStrength({
          isValid: true,
          message: 'Strong password'
        });
      } else {
        const errors = [];
        if (!isLengthValid) errors.push('at least 6 characters');
        if (!hasUpperCase) errors.push('1 uppercase letter');
        if (!hasSpecialChar) errors.push('1 special symbol');

        setPasswordStrength({
          isValid: false,
          message: `Password must contain ${errors.join(', ')}`
        });
      }
    } else {
      setPasswordStrength({
        isValid: null,
        message: ''
      });
    }
  }, [newUser.password, showAddUserModal]);

  // Handle Add User Modal Open
  const handleOpenAddUserModal = () => {
    setNewUser({
      user_id: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      role: '',
      is_active: true
    });
    setUserIdValidation({
      checking: false,
      isValid: null,
      message: ''
    });
    setPasswordMatch({
      isValid: null,
      message: ''
    });
    setPhoneValidation({
      isValid: null,
      message: ''
    });
    setPasswordStrength({
      isValid: null,
      message: ''
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowAddUserModal(true);
  };

  // Handle Add User Form Submit
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();

    // Validate User ID
    if (!userIdValidation.isValid) {
      showToast('Please choose a valid username', 'error');
      return;
    }

    // Validate Password Strength
    if (!passwordStrength.isValid) {
      showToast('Password does not meet requirements', 'error');
      return;
    }

    // Validate Password Match
    if (!passwordMatch.isValid) {
      showToast('Passwords do not match', 'error');
      return;
    }

    // Validate Phone (optional but if provided should be valid)
    if (newUser.phone && !phoneValidation.isValid) {
      showToast('Please enter a valid 10-digit phone number', 'error');
      return;
    }

    // Prepare data for backend
    const userData = {
      user_id: newUser.user_id,
      name: newUser.name,
      email: newUser.email.toLowerCase(),
      password: newUser.password,
      phone: newUser.phone || '',
      role: newUser.role,
      is_active: newUser.is_active ? 1 : 0,
      created_by: user.id
    };

    // Log the data to console
    console.log('New User Data:', userData);
    console.log('Created By User ID:', user.id);

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/addNewUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const result = await response.text(); // Backend returns plain string: "New User Added Successfully"
        console.log('User created successfully:', result);

        // Refresh users list
        await fetchUsers();

        // Close modal and reset form
        setShowAddUserModal(false);

        // Show success message
        showToast(result || 'User created successfully!', 'success');
      } else {
        // Handle error response
        const errorText = await response.text();
        console.error('Error creating user:', errorText);

        // Try to parse as JSON if it's a CustomException
        try {
          const errorJson = JSON.parse(errorText);
          showToast(errorJson.message || 'Error creating user', 'error');
        } catch {
          // If not JSON, use the text directly
          showToast(errorText || 'Error creating user', 'error');
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error creating user:', error);
      setLoading(false);
      showToast('Network error: Unable to create user', 'error');
    }
  };

  // Fetch menu permissions for a user
  const fetchUserMenuPermissions = async (userId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/login/menuPermissions/${userId}`);
      const data = await response.json();

      console.log('Menu permissions response:', data);

      // Initialize all 15 permissions to 0
      const permissionsObject = {};
      menuPermissionsList.forEach(menu => {
        permissionsObject[menu.dbField] = 0;
      });

      // Mapping between backend keys and frontend dbFields
      const backendToFrontendMap = {
        'DASHBOARD': 'dashboard',
        'ANALYTICS': 'analytics',
        'DOCUMENTS': 'documents',
        'SETTINGS': 'settings',
        'FOLLOW_UPS': 'follow_ups',
        'REPORTS': 'reports',
        'INVOICES': 'invoices',
        'SALES_CLIENTS': 'sales_clients',
        'SALES_LEADS': 'sales_leads',
        'SALES_ESTIMATION': 'sales_estimation',
        'PROCUREMENT_VENDERS': 'procurement_venders',
        'PROCUREMENT_QUOTATIONS': 'procurement_quotations_recived',
        'PROCUREMENT_PURCHASE_ORDERS': 'procurement_purchase_orders',
        'PROCUREMENT_BILLS': 'procurement_bills_received',
        'OFFICE_USE': 'office_use'
      };

      // If data is an array of strings
      if (Array.isArray(data)) {
        data.forEach(backendKey => {
          const frontendKey = backendToFrontendMap[backendKey];
          if (frontendKey && permissionsObject.hasOwnProperty(frontendKey)) {
            permissionsObject[frontendKey] = 1;
          } else {
            console.warn(`No mapping found for backend key: ${backendKey}`);
          }
        });
      }

      console.log('Processed menu permissions:', permissionsObject);
      console.log('Total permissions set to 1:', Object.values(permissionsObject).filter(v => v === 1).length);

      return permissionsObject;
    } catch (error) {
      console.error('Error fetching user menu permissions:', error);
      // Return default permissions (all 15 set to 0)
      const defaultPerms = {};
      menuPermissionsList.forEach(menu => {
        defaultPerms[menu.dbField] = 0;
      });
      return defaultPerms;
    }
  };

  // Fetch page permissions for a user
  const fetchUserPagePermissions = async (userId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/login/pagePermissions/${userId}`
      );

      const text = await response.text();

      // Case 1: Backend sends plain string message
      if (!response.ok || text === "No Permissions") {
        console.warn("No permissions found for user");
        return [];
      }

      // Case 2: Backend sends JSON
      const data = JSON.parse(text);
      console.log("Page permissions response:", data);

      const permissionIds = [];

      Object.entries(data).forEach(([module, actions]) => {
        actions.forEach((action) => {
          const permName = mapBackendPermissionToFrontend(module, action);

          const perm = pagePermissionsStructure.find(
            (p) => p.name === permName
          );

          if (perm) {
            permissionIds.push(perm.id);
          } else {
            console.warn(`Permission not found in structure: ${permName} (from backend: ${module}.${action})`);
          }
        });
      });

      console.log("Processed page permissions:", permissionIds);
      console.log("Total permissions found:", permissionIds.length);
      return permissionIds;

    } catch (error) {
      console.error("Error fetching user page permissions:", error);
      return [];
    }
  };

  // Handlers
  const handleEditUser = async (user) => {
    setSelectedUser({ ...user });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/updateUser/${selectedUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedUser.full_name,
          email: selectedUser.email,
          phone: selectedUser.phone,
          role: selectedUser.role_id,
          is_active: selectedUser.is_active ? 1 : 0
        })
      });

      if (response.ok) {
        fetchUsers();
        setShowEditUserModal(false);
        setSelectedUser(null);
        showToast('User updated successfully!', 'success');
      } else {
        showToast('Error updating user', 'error');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error updating user:', error);
      setLoading(false);
      showToast('Error updating user', 'error');
    }
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    setShowDeleteConfirm(false);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/deleteUser/${userToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchUsers();
        showToast('User deleted successfully!', 'success');
      } else {
        showToast('Error deleting user', 'error');
      }
      setLoading(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      setLoading(false);
      showToast('Error deleting user', 'error');
      setUserToDelete(null);
    }
  };

  // View Menu Permissions
  const handleViewMenuPermissions = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    const menuPerms = await fetchUserMenuPermissions(user.id);
    setSelectedUserMenuPermissions(menuPerms);
    setShowMenuPermissionsModal(true);
    setLoading(false);
  };

  // Edit Menu Permissions
  const handleEditMenuPermissions = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    const menuPerms = await fetchUserMenuPermissions(user.id);

    // Initialize only the permissions that the logged-in user has access to
    const completeMenuPerms = {};
    availableMenuPermissions.forEach(menu => {
      completeMenuPerms[menu.dbField] = menuPerms[menu.dbField] || 0;
    });

    console.log('Initialized menu permissions for editing:', completeMenuPerms);
    setSelectedUserMenuPermissions(completeMenuPerms);
    setShowEditMenuPermissionsModal(true);
    setLoading(false);
  };

  const handleToggleMenuPermission = (dbField) => {
    setSelectedUserMenuPermissions(prev => ({
      ...prev,
      [dbField]: prev[dbField] === 1 ? 0 : 1
    }));
  };

  const handleSaveMenuPermissions = async () => {
    setLoading(true);
    try {
      // Send ALL 15 menu fields (not just available ones) to maintain database integrity
      const completePermissions = {};
      menuPermissionsList.forEach(menu => {
        completePermissions[menu.dbField] = selectedUserMenuPermissions[menu.dbField] || 0;
      });

      console.log('Saving complete menu permissions (15 fields):', completePermissions);
      console.log('Number of fields being sent:', Object.keys(completePermissions).length);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/updateMenuPermissions/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completePermissions)
      });

      if (response.ok) {
        fetchUsers();
        setShowEditMenuPermissionsModal(false);
        setSelectedUser(null);
        setSelectedUserMenuPermissions({});
        showToast('Menu permissions updated successfully!', 'success');
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        showToast('Error saving menu permissions', 'error');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error saving menu permissions:', error);
      setLoading(false);
      showToast('Error saving menu permissions', 'error');
    }
  };

  // View Page Permissions
  const handleViewUserPermissions = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    const pagePerms = await fetchUserPagePermissions(user.id);
    setPermissions(pagePermissionsStructure);
    setSelectedUserPermissions(pagePerms);
    setShowUserPermissionsModal(true);
    setLoading(false);
  };

  // Edit Page Permissions
  const handleEditUserPermissions = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    const pagePerms = await fetchUserPagePermissions(user.id);
    setPermissions(pagePermissionsStructure);
    setSelectedUserPermissions(pagePerms);
    setShowEditUserPermissionsModal(true);
    setLoading(false);
  };

  const handleToggleUserPermission = (permissionId) => {
    if (selectedUserPermissions.includes(permissionId)) {
      setSelectedUserPermissions(selectedUserPermissions.filter(id => id !== permissionId));
    } else {
      setSelectedUserPermissions([...selectedUserPermissions, permissionId]);
    }
  };

  const handleSelectAllUserPermissionsInModule = (module) => {
    const modulePermissions = availablePagePermissions.filter(p => p.module === module);
    const modulePermissionIds = modulePermissions.map(p => p.id);
    const allSelected = modulePermissionIds.every(id => selectedUserPermissions.includes(id));

    if (allSelected) {
      setSelectedUserPermissions(selectedUserPermissions.filter(id => !modulePermissionIds.includes(id)));
    } else {
      const newPermissions = [...new Set([...selectedUserPermissions, ...modulePermissionIds])];
      setSelectedUserPermissions(newPermissions);
    }
  };

  const handleSaveUserPermissions = async () => {
    setLoading(true);
    try {
      console.log('Saving page permissions:', selectedUserPermissions);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/updatePagePermissions/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: selectedUserPermissions })
      });

      if (response.ok) {
        fetchUsers();
        setShowEditUserPermissionsModal(false);
        setSelectedUser(null);
        setSelectedUserPermissions([]);
        showToast('Page permissions updated successfully!', 'success');
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        showToast('Error saving page permissions', 'error');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error saving page permissions:', error);
      setLoading(false);
      showToast('Error saving page permissions', 'error');
    }
  };

  // Group permissions by module
  const groupPermissionsByModule = (perms) => {
    const grouped = {};
    perms.forEach(perm => {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    });
    return grouped;
  };

  const groupedPermissions = groupPermissionsByModule(availablePagePermissions);

  // Get role badge class
  const getRoleBadgeClass = (roleName) => {
    const roleMap = {
      'SuperAdmin': 'users-page-badge-role-1',
      'Admin': 'users-page-badge-role-2',
      'Sales Manager': 'users-page-badge-role-3',
      'BD Executive': 'users-page-badge-role-4',
      'Procurement Manager': 'users-page-badge-role-5',
      'Procurement Executive': 'users-page-badge-role-6'
    };
    return roleMap[roleName] || 'users-page-badge-role-1';
  };

  return (
    <div className="users-page-container">
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Header */}
      <div className="users-page-header">
        <div className="users-page-header-left">
          <h1 className="users-page-title">User Management</h1>
          <p className="users-page-subtitle">Manage users, roles, and permissions</p>
        </div>
        <button
          className="users-page-btn users-page-btn-primary"
          onClick={handleOpenAddUserModal}
        >
          <span className="users-page-icon">+</span>
          Add New User
        </button>
      </div>

      {/* Filters */}
      <div className="users-page-filters">
        <div className="users-page-search-box">
          <input
            type="text"
            className="users-page-search-input"
            placeholder="Search by name, email, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="users-page-search-icon">🔍</span>
        </div>

        <select
          className="users-page-filter-select"
          value={filterRole}
          onChange={(e) => {
            setFilterRole(e.target.value);
            setCurrentPage(1); // Reset to page 1 when changing filter
          }}
        >
          <option value="all">All Roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.name}>{role.name}</option>
          ))}
        </select>
      </div>

      {/* Statistics */}
      <div className="users-page-stats">
        <div className="users-page-stat-card">
          <div className="users-page-stat-number">{totalUsers}</div>
          <div className="users-page-stat-label">Total Users</div>
        </div>
        <div className="users-page-stat-card">
          <div className="users-page-stat-number">{activeUsers}</div>
          <div className="users-page-stat-label">Active Users</div>
        </div>
        <div className="users-page-stat-card">
          <div className="users-page-stat-number">{inactiveUsers}</div>
          <div className="users-page-stat-label">Inactive Users</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-page-table-container">
        {loading ? (
          <div className="users-page-loading">Loading...</div>
        ) : (
          <>
            <table className="users-page-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Page Perms</th>
                  <th>Menu Perms</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={!u.is_active ? 'users-page-row-inactive' : ''}>
                    <td><div className="users-page-user-name">{u.full_name}</div></td>
                    <td><div>{u.phone}</div><div>{u.email}</div></td>
                    <td><span className={`users-page-badge ${getRoleBadgeClass(u.role_name)}`}>{u.role_name}</span></td>
                    <td><button className="users-page-btn-link" onClick={() => handleViewUserPermissions(u)}>{u.permission_count} permissions</button></td>
                    <td><button className="users-page-btn-link" onClick={() => handleViewMenuPermissions(u)}>{u.menu_permissions_count} menus</button></td>
                    <td><span className={`users-page-status-badge ${u.is_active ? 'users-page-status-active' : 'users-page-status-inactive'}`}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td>{u.created_at}</td>
                    <td>
                      <div className="users-page-actions">
                        <button className="users-page-btn-icon" onClick={() => handleEditUser(u)} style={{color:"#5252ff"}}><FiEdit /></button>
                        <button className="users-page-btn-icon" onClick={() => handleDeleteUser(u)} style={{color:"red"}}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length > 0 && (
              <div className="pagination-footer">
                <div className="pagination-info">
                  Showing {((currentPage - 1) * pageSize) + 1} to{" "}
                  {Math.min(currentPage * pageSize, totalElements)} of {totalElements} entries
                </div>

                <div className="pagination-controls">
                  <div className="pagination-row-selector">
                    <select
                      className="pagination-select"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5 rows</option>
                      <option value={10}>10 rows</option>
                      <option value={25}>25 rows</option>
                      <option value={50}>50 rows</option>
                    </select>
                  </div>

                  <div className="pagination-nav">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                    >
                      Previous
                    </button>

                    <span className="pagination-current">
                      Page <strong>{currentPage}</strong> of{" "}
                      <strong>{totalPages}</strong>
                    </span>

                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && users.length === 0 && (
          <div className="users-page-empty-state">
            <p>No users found</p>
          </div>
        )}
      </div>

      {/* All modals remain exactly the same as your original code */}
      {/* I'm keeping them all here for completeness */}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="users-page-modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="users-page-modal users-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <h2>Add New User</h2>
              <button
                className="users-page-modal-close"
                onClick={() => setShowAddUserModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} autoComplete="off">
              <div className="users-page-modal-body">
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Username (User ID) <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      data-form-type="other"
                      value={newUser.user_id}
                      onChange={(e) => setNewUser({ ...newUser, user_id: e.target.value })}
                      placeholder="Enter unique username"
                    />
                    {userIdValidation.message && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          color: userIdValidation.isValid ? '#22c55e' : userIdValidation.isValid === false ? '#ef4444' : '#6b7280'
                        }}
                      >
                        {userIdValidation.checking ? '⏳ ' : userIdValidation.isValid ? '✓ ' : userIdValidation.isValid === false ? '✕ ' : ''}
                        {userIdValidation.message}
                      </div>
                    )}
                  </div>

                  <div className="users-page-form-group">
                    <label>Full Name <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      data-form-type="other"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                </div>

                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Email <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="email"
                      required
                      autoComplete="new-email"
                      data-form-type="other"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div className="users-page-form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      autoComplete="off"
                      data-form-type="other"
                      value={newUser.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setNewUser({ ...newUser, phone: value });
                        }
                      }}
                      placeholder="Enter 10-digit phone number"
                      maxLength="10"
                    />
                    {phoneValidation.message && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          color: phoneValidation.isValid ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {phoneValidation.isValid ? '✓ ' : ''}
                        {phoneValidation.message}
                      </div>
                    )}
                  </div>
                </div>

                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Password <span style={{ color: 'red' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        data-form-type="other"
                        name="new-user-password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Enter password"
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#718096',
                          fontSize: '18px',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {passwordStrength.message && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          color: passwordStrength.isValid ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {passwordStrength.isValid ? '✓ ' : '✕ '}
                        {passwordStrength.message}
                      </div>
                    )}
                  </div>

                  <div className="users-page-form-group">
                    <label>Confirm Password <span style={{ color: 'red' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        data-form-type="other"
                        name="confirm-user-password"
                        value={newUser.confirmPassword}
                        onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#718096',
                          fontSize: '18px',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {passwordMatch.message && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '13px',
                          color: passwordMatch.isValid ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {passwordMatch.isValid ? '✓ ' : '✕ '}
                        {passwordMatch.message}
                      </div>
                    )}
                  </div>
                </div>

                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Role <span style={{ color: 'red' }}>*</span></label>
                    <select
                      required
                      autoComplete="off"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="">Select Role</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="users-page-form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '40px' }}>
                    <label className="users-page-checkbox-label" style={{ marginBottom: '0' }}>
                      <span><input
                        type="checkbox"
                        checked={newUser.is_active}
                        onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })}
                      /></span>
                      <span style={{ paddingLeft: "5px", marginTop: "0px" }}>Active User</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="users-page-modal-footer">
                <button
                  type="button"
                  className="users-page-btn users-page-btn-secondary"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="users-page-btn users-page-btn-primary"
                  disabled={loading || !userIdValidation.isValid || !passwordStrength.isValid || !passwordMatch.isValid}
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && selectedUser && (
        <div className="users-page-modal-overlay" onClick={() => setShowEditUserModal(false)}>
          <div className="users-page-modal users-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <h2>Edit User</h2>
              <button
                className="users-page-modal-close"
                onClick={() => setShowEditUserModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="users-page-modal-body">
                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      required
                      value={selectedUser.full_name}
                      onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                    />
                  </div>

                  <div className="users-page-form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      required
                      value={selectedUser.email}
                      onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="users-page-form-row">
                  <div className="users-page-form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={selectedUser.phone}
                      onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })}
                    />
                  </div>

                  <div className="users-page-form-group">
                    <label>Role</label>
                    <select
                      required
                      value={selectedUser.role_id}
                      onChange={(e) => setSelectedUser({ ...selectedUser, role_id: e.target.value, role_name: e.target.value })}
                    >
                      <option value="">Select Role</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="users-page-form-group">
                  <label className="users-page-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedUser.is_active}
                      onChange={(e) => setSelectedUser({ ...selectedUser, is_active: e.target.checked })}
                    />
                    <span>Active User</span>
                  </label>
                </div>

                <div style={{ marginTop: '20px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#0369a1' }}>
                    <strong>Note:</strong> To edit permissions, use the permission buttons from the table row for this user.
                  </p>
                </div>
              </div>

              <div className="users-page-modal-footer">
                <button
                  type="button"
                  className="users-page-btn users-page-btn-secondary"
                  onClick={() => setShowEditUserModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="users-page-btn users-page-btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Menu Permissions Modal */}
      {showMenuPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay" onClick={() => setShowMenuPermissionsModal(false)}>
          <div className="users-page-modal users-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div>
                <h2>Menu Permissions - {selectedUser.full_name}</h2>
                <p className="users-page-modal-subtitle">@{selectedUser.username}</p>
              </div>
              <button
                className="users-page-modal-close"
                onClick={() => setShowMenuPermissionsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="users-page-modal-body">
              <div className="users-page-permissions-summary">
                <strong>Total Menu Permissions:</strong> {Object.values(selectedUserMenuPermissions).filter(v => v === 1).length} / 15
              </div>

              <div className="users-page-permission-list">
                {menuPermissionsList.map(menu => (
                  selectedUserMenuPermissions[menu.dbField] === 1 && (
                    <div key={menu.id} className="users-page-permission-item">
                      <span className="users-page-permission-check">✓</span>
                      <div className="users-page-permission-details">
                        <div className="users-page-permission-name">{menu.name}</div>
                      </div>
                    </div>
                  )
                ))}
              </div>

              {Object.values(selectedUserMenuPermissions).filter(v => v === 1).length === 0 && (
                <div className="users-page-empty-state">
                  <p>No menu permissions assigned</p>
                </div>
              )}
            </div>

            <div className="users-page-modal-footer">
              <button
                className="users-page-btn users-page-btn-secondary"
                onClick={() => setShowMenuPermissionsModal(false)}
              >
                Close
              </button>
              <button
                className="users-page-btn users-page-btn-primary"
                onClick={() => {
                  setShowMenuPermissionsModal(false);
                  handleEditMenuPermissions(selectedUser);
                }}
              >
                Edit Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Menu Permissions Modal */}
      {showEditMenuPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay" onClick={() => setShowEditMenuPermissionsModal(false)}>
          <div className="users-page-modal users-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div>
                <h2>Edit Menu Permissions - {selectedUser.full_name}</h2>
                <p className="users-page-modal-subtitle">
                  Select menu access permissions (showing only permissions you have access to)
                </p>
              </div>
              <button
                className="users-page-modal-close"
                onClick={() => setShowEditMenuPermissionsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="users-page-modal-body">
              <div className="users-page-permissions-summary">
                <strong>Selected:</strong> {Object.values(selectedUserMenuPermissions).filter(v => v === 1).length} of {availableMenuPermissions.length} menus (Total: 15 menu permissions)
                <button
                  type="button"
                  className="users-page-btn-select-all"
                  style={{ marginLeft: '16px' }}
                  onClick={() => {
                    const allSelected = Object.values(selectedUserMenuPermissions).every(v => v === 1);
                    const newPerms = {};
                    availableMenuPermissions.forEach(menu => {
                      newPerms[menu.dbField] = allSelected ? 0 : 1;
                    });
                    setSelectedUserMenuPermissions(newPerms);
                  }}
                >
                  {Object.values(selectedUserMenuPermissions).every(v => v === 1) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="users-page-menu-permissions-grid">
                {availableMenuPermissions.map(menu => (
                  <div key={menu.id} className="users-page-menu-permission-item">
                    <label className="users-page-toggle-label">
                      <span className="users-page-menu-permission-name">{menu.name}</span>
                      <label className="users-page-toggle users-page-toggle-small">
                        <input
                          type="checkbox"
                          checked={selectedUserMenuPermissions[menu.dbField] === 1}
                          onChange={() => handleToggleMenuPermission(menu.dbField)}
                        />
                        <span className="users-page-toggle-slider"></span>
                      </label>
                    </label>
                  </div>
                ))}
              </div>

              {availableMenuPermissions.length === 0 && (
                <div className="users-page-empty-state">
                  <p>You don't have access to any menu permissions</p>
                </div>
              )}
            </div>

            <div className="users-page-modal-footer">
              <button
                type="button"
                className="users-page-btn users-page-btn-secondary"
                onClick={() => setShowEditMenuPermissionsModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="users-page-btn users-page-btn-primary"
                onClick={handleSaveMenuPermissions}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Permissions Modal */}
      {showUserPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay" onClick={() => setShowUserPermissionsModal(false)}>
          <div className="users-page-modal users-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div>
                <h2>Page Permissions - {selectedUser.full_name}</h2>
                <p className="users-page-modal-subtitle">@{selectedUser.username} • {selectedUser.role_name}</p>
              </div>
              <button
                className="users-page-modal-close"
                onClick={() => setShowUserPermissionsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="users-page-modal-body">
              <div className="users-page-permissions-summary">
                <strong>Total Permissions:</strong> {selectedUserPermissions.length}
              </div>

              {Object.entries(groupPermissionsByModule(
                pagePermissionsStructure.filter(p => selectedUserPermissions.includes(p.id))
              )).map(([module, perms]) => (
                <div key={module} className="users-page-permission-group">
                  <h3 className="users-page-permission-module">{module}</h3>
                  <div className="users-page-permission-list">
                    {perms.map(perm => (
                      <div key={perm.id} className="users-page-permission-item">
                        <span className="users-page-permission-check">✓</span>
                        <div className="users-page-permission-details">
                          <div className="users-page-permission-name">{perm.name}</div>
                          <div className="users-page-permission-desc">{perm.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {selectedUserPermissions.length === 0 && (
                <div className="users-page-empty-state">
                  <p>No page permissions assigned</p>
                </div>
              )}
            </div>

            <div className="users-page-modal-footer">
              <button
                className="users-page-btn users-page-btn-secondary"
                onClick={() => setShowUserPermissionsModal(false)}
              >
                Close
              </button>
              <button
                className="users-page-btn users-page-btn-primary"
                onClick={() => {
                  setShowUserPermissionsModal(false);
                  handleEditUserPermissions(selectedUser);
                }}
              >
                Edit Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Permissions Modal */}
      {showEditUserPermissionsModal && selectedUser && (
        <div className="users-page-modal-overlay" onClick={() => setShowEditUserPermissionsModal(false)}>
          <div className="users-page-modal users-page-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="users-page-modal-header">
              <div>
                <h2>Edit Page Permissions - {selectedUser.full_name}</h2>
                <p className="users-page-modal-subtitle">
                  Select feature permissions (showing only permissions you have access to)
                </p>
              </div>
              <button
                className="users-page-modal-close"
                onClick={() => setShowEditUserPermissionsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="users-page-modal-body">
              <div className="users-page-permissions-summary">
                <strong>Selected:</strong> {selectedUserPermissions.length} of {availablePagePermissions.length} permissions
              </div>

              {Object.entries(groupedPermissions).map(([module, perms]) => {
                const modulePermissionIds = perms.map(p => p.id);
                const allSelected = modulePermissionIds.every(id => selectedUserPermissions.includes(id));

                return (
                  <div key={module} className="users-page-permission-group">
                    <div className="users-page-permission-module-header">
                      <h3 className="users-page-permission-module">{module}</h3>
                      <button
                        type="button"
                        className="users-page-btn-select-all"
                        onClick={() => handleSelectAllUserPermissionsInModule(module)}
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="users-page-permission-toggles">
                      {perms.map(perm => (
                        <div key={perm.id} className="users-page-permission-toggle-item">
                          <label className="users-page-toggle-label">
                            <div className="users-page-permission-toggle-details">
                              <div className="users-page-permission-name">{perm.name}</div>
                              <div className="users-page-permission-desc">{perm.description}</div>
                            </div>
                            <label className="users-page-toggle users-page-toggle-small">
                              <input
                                type="checkbox"
                                checked={selectedUserPermissions.includes(perm.id)}
                                onChange={() => handleToggleUserPermission(perm.id)}
                              />
                              <span className="users-page-toggle-slider"></span>
                            </label>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {availablePagePermissions.length === 0 && (
                <div className="users-page-empty-state">
                  <p>You don't have access to any page permissions</p>
                </div>
              )}
            </div>

            <div className="users-page-modal-footer">
              <button
                type="button"
                className="users-page-btn users-page-btn-secondary"
                onClick={() => setShowEditUserPermissionsModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="users-page-btn users-page-btn-primary"
                onClick={handleSaveUserPermissions}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.full_name}?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default UsersPage;