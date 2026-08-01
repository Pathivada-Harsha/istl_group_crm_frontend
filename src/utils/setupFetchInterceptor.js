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
let redirecting = false;

/**
 * The single place every session-expiry path funnels through. Guarded so
 * only the first caller actually navigates — every other 401 arriving around
 * the same moment (a page firing several requests at once) just no-ops
 * instead of each pushing its own trip to /login. replace(), not href=, so
 * Back doesn't have to click through a stack of duplicate login hops.
 */
export const redirectToLogin = (evictedMessage) => {
  if (redirecting || window.location.pathname.includes('/login')) return;
  redirecting = true;

  console.warn('Session expired - redirecting to login');

  if (evictedMessage) {
    sessionStorage.setItem('la_logout_reason', evictedMessage);
  }

  localStorage.removeItem('bd_portal_user');
  clearAllSidebarState();
  window.dispatchEvent(new Event('session-expired'));
  window.location.replace('/login');
};

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
      // LOGIN ACTIVITY MODULE: if the session was ended remotely (evicted by
      // a login on another device, or terminated by an admin), pass the exact
      // reason to the login page so the user understands what happened.
      let evictedMessage;
      try {
        const body = await response.clone().json();
        if (body?.error === 'SESSION_EVICTED' && body?.message) {
          evictedMessage = body.message;
        }
      } catch { /* body not JSON — ignore */ }

      redirectToLogin(evictedMessage);
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