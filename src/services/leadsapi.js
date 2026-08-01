/**
 * api.js  —  Global fetch wrapper
 * Place at: src/api.js
 *
 * Reads user from localStorage key 'bd_portal_user' — the same key
 * AuthContext uses. No hooks needed since this is a plain JS module.
 */

import { redirectToLogin } from "../utils/setupFetchInterceptor";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";
const USER_KEY = "bd_portal_user"; // must match AuthContext.js

// ── Read user from AuthContext localStorage at call time ─────────────────────
const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;  // { id, role, name, email, ... }
  } catch {
    return null;
  }
};

// ── Build headers fresh on every request ─────────────────────────────────────
const getDefaultHeaders = () => {
  const user = getStoredUser();
  return {
    "Content-Type": "application/json",
    "User-Id":      user?.id   ?? "",
    "User-Role":    user?.role ?? "",
  };
};

// ── Session expired → clear storage and redirect ──────────────────────────────
// Funnels through the same guarded redirect the global fetch interceptor
// uses, so a request made through here doesn't push its own separate trip
// to /login on top of one the interceptor (or another caller) already made.
const handleSessionExpired = () => {
  redirectToLogin();
};

// ── Core request ──────────────────────────────────────────────────────────────
const request = async (method, path, { body, headers = {}, params } = {}) => {

  let url = BASE_URL + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += "?" + qs;
  }

  const options = {
    method,
    credentials: "include",  // sends JSESSIONID cookie — required for Spring Session
    headers: { ...getDefaultHeaders(), ...headers },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // 401 from Spring Security authenticationEntryPoint
  if (response.status === 401) {
    handleSessionExpired();
    throw new Error("SESSION_EXPIRED");
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // SESSION_EXPIRED as plain text from SessionFilter
  if (data === "SESSION_EXPIRED" || data?.error === "SESSION_EXPIRED") {
    handleSessionExpired();
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    const err  = new Error(data?.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.data   = data;
    throw err;
  }

  return data;
};

// ── Public API ────────────────────────────────────────────────────────────────
const api = {
  get:    (path, options)       => request("GET",    path, options),
  post:   (path, body, options) => request("POST",   path, { ...options, body }),
  put:    (path, body, options) => request("PUT",    path, { ...options, body }),
  delete: (path, options)       => request("DELETE", path, options),
  patch:  (path, body, options) => request("PATCH",  path, { ...options, body }),
};

export default api;