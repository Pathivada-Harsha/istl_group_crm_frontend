// src/services/tenderApi.js
//
// Service layer for the Tenders module. Mirrors projectsApi.js / filterApi.js:
// reads the logged-in user from the `bd_portal_user` localStorage key, always
// sends credentials:'include' (session-cookie auth) plus the User-Id / User-Role
// headers, and unwraps the backend's { success, message, data } envelope.
// Talks to the Spring Boot TenderController at /tender.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const getUser = () => {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    if (!raw) return {};
    return JSON.parse(raw)?.user || {};
  } catch { return {}; }
};

const getAuthHeaders = () => {
  const u = getUser();
  const id = String(u.id || '');
  const role = String(u.role || '');
  return {
    'Content-Type': 'application/json',
    'User-Id': id,
    'User-Role': role,
    'X-User-Id': id,
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
  let json = {};
  try { json = await res.json(); } catch { /* empty/non-JSON body */ }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (HTTP ${res.status})`);
  }
  return json;
};

// Multipart / blob helpers — the JSON `req` above always JSON.stringifies its
// body and can't read binary, so source-PDF calls use raw fetch. Same auth
// (session cookie + User-Id/User-Role headers) but WITHOUT a Content-Type, so
// the browser sets the multipart boundary itself.
const authHeadersRaw = () => {
  const u = getUser();
  const id = String(u.id || '');
  const role = String(u.role || '');
  return { 'User-Id': id, 'User-Role': role, 'X-User-Id': id, 'X-User-Role': role };
};

const postFile = async (path, file, failLabel, extra) => {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(extra || {}).forEach(([k, v]) => fd.append(k, String(v)));
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST', credentials: 'include', headers: authHeadersRaw(), body: fd,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty/non-JSON body */ }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `${failLabel} (HTTP ${res.status})`);
  }
  return json.data;
};

const tenderApi = {
  getAll: async () => (await req('/tender/getAll')).data || [],
  getById: async (id) => (await req(`/tender/${id}`)).data,
  create: async (tender) => (await req('/tender/create', { method: 'POST', body: tender })).data,
  update: async (id, tender) => (await req(`/tender/update/${id}`, { method: 'PUT', body: tender })).data,
  remove: async (id) => req(`/tender/delete/${id}`, { method: 'DELETE' }),

  // Stateless parse (works before the tender is saved) → proposed values with
  // the page and line each came from, for the import review modal. Nothing is
  // written to the tender by this call.
  //
  // `ai: true` re-reads the document with the LLM. That is always the user's
  // choice from inside the modal — the backend never escalates on its own.
  parsePdf: async (file, { ai = false } = {}) =>
    (await postFile('/tender/parse-pdf', file, 'Parse failed', { ai })) || {},
  // Store the PDF bytes on a saved tender; returns the updated wrapper.
  uploadSourcePdf: async (id, file) => postFile(`/tender/${id}/upload-source-pdf`, file, 'Upload failed'),
  // Fetch the stored PDF as a blob URL for the in-page viewer iframe.
  downloadSourcePdfBlobUrl: async (id) => {
    const res = await fetch(`${API_BASE_URL}/tender/${id}/download-source-pdf`, {
      method: 'GET', credentials: 'include', headers: authHeadersRaw(),
    });
    if (!res.ok) throw new Error(`Could not load PDF (HTTP ${res.status})`);
    return URL.createObjectURL(await res.blob());
  },
};

export default tenderApi;
