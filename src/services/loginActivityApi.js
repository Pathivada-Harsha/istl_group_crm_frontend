// src/services/loginActivityApi.js
// LOGIN ACTIVITY MODULE — API wrapper for /office-use/login-activity/*
// Follows the same fetch + credentials pattern as the other service files.

const API_BASE_URL = process.env.REACT_APP_API_URL;
const BASE = `${API_BASE_URL}/office-use/login-activity`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function qs(params) {
  const clean = Object.entries(params || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== "" && v !== "ALL"
  );
  return clean.length ? `?${new URLSearchParams(clean)}` : "";
}

export const loginActivityApi = {
  dashboardStats: () => request("/dashboard-stats"),
  filterOptions: () => request("/filter-options"),

  loginHistory: (params) => request(`/login-history${qs(params)}`),
  activities: (params) => request(`/activities${qs(params)}`),
  activityById: (id, archive = false) => request(`/activities/${id}${qs({ archive })}`),

  activeSessions: () => request("/active-sessions"),
  terminateSession: (id) => request(`/active-sessions/${id}`, { method: "DELETE" }),
  signOutAllDevices: (userId) => request(`/users/${userId}/sessions`, { method: "DELETE" }),

  userSummary: (userId) => request(`/users/${userId}/summary`),

  track: (events) =>
    request("/track", { method: "POST", body: JSON.stringify(events) }),
};
