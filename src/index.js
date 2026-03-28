import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

let sessionExpiredTriggered = false;

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

  // ✅ Skip auth endpoints — never intercept login/logout/ping
  const isAuthCall =
    url.includes('/login/userLogin') ||
    url.includes('/login/logout') ||
    url.includes('/login/ping');

  // ✅ Only intercept calls to your own backend
  const isBackendCall = url.includes(process.env.REACT_APP_API_URL);

  if (isBackendCall && !isAuthCall && response.status === 401 && !sessionExpiredTriggered) {
    sessionExpiredTriggered = true;

    // ✅ Remove correct localStorage key used by AuthContext
    localStorage.removeItem('bd_portal_user');

    // ✅ Notify SessionManager component
    window.dispatchEvent(new Event('session-expired'));

    // ✅ Small delay so React state can clean up before hard redirect
    setTimeout(() => {
      sessionExpiredTriggered = false;
      window.location.replace('/login');
    }, 100);
  }

  return response;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <>
    <App />
  </>
);