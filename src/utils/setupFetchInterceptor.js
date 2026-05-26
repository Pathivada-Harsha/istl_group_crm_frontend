const SIDEBAR_KEY_PREFIX = 'sidebar_state_';

function clearAllSidebarState() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SIDEBAR_KEY_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch { /* ignore */ }
}

let originalFetch = null;

export const setupFetchInterceptor = () => {
  if (originalFetch) return;

  originalFetch = window.fetch;

  window.fetch = async (url, options = {}) => {
    const isBackendCall = url.includes(process.env.REACT_APP_API_URL);

    if (isBackendCall) {
      options.credentials = 'include';
    }

    const response = await originalFetch(url, options);

    const isAuthCall =
      url.includes('/login/userLogin') ||
      url.includes('/login/logout') ||
      url.includes('/login/ping') ||
      url.includes('/login/forgot-password/');

    if (isBackendCall && !isAuthCall && response.status === 401) {
      console.warn('Session expired - redirecting to login');

      // Clear auth data
      localStorage.removeItem('bd_portal_user');

      // Clear sidebar accordion state so the next user starts clean
      clearAllSidebarState();

      window.dispatchEvent(new Event('session-expired'));
      window.location.href = '/login';
      return response;
    }

    return response;
  };
};

export const restoreFetch = () => {
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
};