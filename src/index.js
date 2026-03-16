import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';



let sessionExpiredTriggered = false;

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  if (response.status === 401 && !sessionExpiredTriggered) {
    sessionExpiredTriggered = true;

    // ✅ CLEAR LOCAL AUTH
    localStorage.clear();
    sessionStorage.clear();

    // ✅ FORCE RELOAD TO LOGIN
    window.location.replace("/login");
  }

  return response;
};


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <>
    <App />
  </>
);


