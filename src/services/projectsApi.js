// src/services/projectsApi.js
//
// Service layer for the Projects module. Mirrors the style of filterApi.js:
// reads the logged-in user from the `bd_portal_user` localStorage key, always
// sends credentials:'include' (session-cookie auth) and the User-Id / User-Role
// headers. The project detail endpoints MIRROR the existing /order-book/{id}/...
// endpoints exactly (same request/response bodies), keyed by projectUniqueId.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const getUser = () => {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.user || {};
  } catch { return {}; }
};

const getAuthHeaders = () => {
  const u = getUser();
  const id   = String(u.id   || '');
  const role = String(u.role || '');
  return {
    'Content-Type': 'application/json',
    'User-Id':     id,
    'User-Role':   role,
    'X-User-Id':   id,
    'X-User-Role': role,
  };
};

const req = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: getAuthHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return { success: true };
  return res.json();
};

const enc = (v) => encodeURIComponent(v);

const projectsApi = {
  getAuthHeaders,

  // ── LIST ──────────────────────────────────────────────────────────────────
  // GET /projects?search=&groupId=&subGroupName=&status=  → JSON ARRAY of maps.
  // Blank params are omitted so the backend AND-filters only what's supplied.
  listProjects: async ({ search, groupId, subGroupName, status } = {}) => {
    const params = new URLSearchParams();
    if (search)       params.append('search', search);
    if (groupId)      params.append('groupId', groupId);
    if (subGroupName) params.append('subGroupName', subGroupName);
    if (status)       params.append('status', status);
    const qs = params.toString();
    return req(`/projects${qs ? `?${qs}` : ''}`);
  },

  // ── DETAIL / HEADER ─────────────────────────────────────────────────────────
  getProject: (id) => req(`/projects/${enc(id)}`),

  // Two-stage on the server: an active project is deactivated (and so leaves the
  // list, which only shows active ones); deleting an already-inactive one removes
  // it permanently. Returns 204, which req() maps to { success: true }.
  deleteProject: (id) => req(`/projects/${enc(id)}`, { method: 'DELETE' }),

  // ── SCOPE / SOW (Technical tab) ──────────────────────────────────────────────
  getScope:        (id) => req(`/projects/${enc(id)}/scope`),
  saveScope:       (id, body) => req(`/projects/${enc(id)}/scope`, { method: 'PUT', body }),
  getDefaultPlan:  (id) => req(`/projects/${enc(id)}/scope/default-plan`),
  // Template-driven scope + BOM suggestion (mirrors /leads/{id}/scope/suggest).
  suggestScope:    (id, target = 'both') => req(`/projects/${enc(id)}/scope/suggest?target=${enc(target)}`),
  templateInfo:    (id) => req(`/projects/${enc(id)}/scope/template-info`),

  // ── FINANCIALS (Commercial + BOM tabs) ───────────────────────────────────────
  getBudget:            (id) => req(`/projects/${enc(id)}/budget`),
  saveBudget:           (id, body) => req(`/projects/${enc(id)}/budget`, { method: 'PUT', body }),
  getBilling:           (id) => req(`/projects/${enc(id)}/billing`),
  saveBilling:          (id, body) => req(`/projects/${enc(id)}/billing`, { method: 'PUT', body }),
  getCost:              (id) => req(`/projects/${enc(id)}/cost`),
  saveCost:             (id, body) => req(`/projects/${enc(id)}/cost`, { method: 'PUT', body }),
  getBom:               (id) => req(`/projects/${enc(id)}/bom`),
  saveBom:              (id, body) => req(`/projects/${enc(id)}/bom`, { method: 'PUT', body }),
  // Planned vs Procured for the BOM tab. "Procured" is purchase-order value only —
  // never expenses — and is computed from the same attribution the BOM enforcement
  // guard uses, so the two can never report different figures for one BOM line.
  getBomPlannedVsActual: (id) => req(`/projects/${enc(id)}/bom/planned-vs-actual`),
  getItems:             (id) => req(`/projects/${enc(id)}/items`),
  getCommercialSummary: (id) => req(`/projects/${enc(id)}/commercial-summary`),
  getCommercialSummaryV2: (id) => req(`/projects/${enc(id)}/commercial-summary-v2`),
};

export default projectsApi;
