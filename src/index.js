import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Session-expiry handling (detecting a 401 and redirecting to /login) lives
// in one place — src/utils/setupFetchInterceptor.js, wired up from App.js —
// so it isn't duplicated here on top of it. Two independent fetch wrappers
// both reacting to the same 401 was exactly what made Back have to click
// through several redundant /login hops.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <>
    <App />
  </>
);