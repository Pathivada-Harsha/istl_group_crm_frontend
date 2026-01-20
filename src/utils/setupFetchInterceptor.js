/**
 * Global fetch interceptor - automatically handles session expiration
 * Call setupFetchInterceptor() once in your app's entry point
 */

let originalFetch = null;

export const setupFetchInterceptor = () => {
  // Only setup once
  if (originalFetch) return;
  
  // Store original fetch
  originalFetch = window.fetch;
  
  // Override global fetch
  window.fetch = async (url, options = {}) => {
    // Always include credentials for API calls to your backend
    const isBackendCall = url.includes(process.env.REACT_APP_API_URL);
    
    if (isBackendCall) {
      options.credentials = 'include';
    }
    
    // Call original fetch
    const response = await originalFetch(url, options);
    
    // Check if session expired (401 or 403) - only for backend calls
    if (isBackendCall && (response.status === 401 || response.status === 403)) {
      console.warn("Session expired detected - redirecting to login");
      
      // Dispatch custom event for SessionManager
      window.dispatchEvent(new Event('session-expired'));
      
      // Clear local storage
      localStorage.removeItem('user');
      localStorage.removeItem('menuPermissions');
      localStorage.removeItem('pagePermissions');
      
      // Redirect to login
      window.location.href = '/login';
      
      // Return response (but user is already redirected)
      return response;
    }
    
    return response;
  };
  
  console.log('✅ Global fetch interceptor setup complete');
};

// Optional: Restore original fetch (for testing)
export const restoreFetch = () => {
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
};