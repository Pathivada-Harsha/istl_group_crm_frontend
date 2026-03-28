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

    // ✅ Skip login/logout endpoints — don't intercept auth calls
    const isAuthCall = url.includes('/login/userLogin') || 
                       url.includes('/login/logout') ||
                       url.includes('/login/ping');

    if (isBackendCall && !isAuthCall && response.status === 401) {
      console.warn("Session expired - redirecting to login");

      // ✅ Use the CORRECT storage key that AuthContext uses
      localStorage.removeItem('bd_portal_user');

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