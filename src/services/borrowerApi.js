// src/services/borrowerApi.js
//
// Service layer for the Borrower Registry. Mirrors tenderApi.js: reads the
// logged-in user from the `bd_portal_user` localStorage key, always sends
// credentials:'include' (session-cookie auth) plus the User-Id / User-Role
// headers, and unwraps the backend's { success, message, data } envelope.
// Talks to the Spring Boot BorrowerController at /borrower.

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

// Multipart / blob helpers — `req` above always JSON.stringifies its body and
// can't read binary, so document calls use raw fetch. Same auth, but WITHOUT a
// Content-Type so the browser sets the multipart boundary itself.
const authHeadersRaw = () => {
  const u = getUser();
  const id = String(u.id || '');
  const role = String(u.role || '');
  return { 'User-Id': id, 'User-Role': role, 'X-User-Id': id, 'X-User-Role': role };
};

const postFile = async (path, file, failLabel) => {
  const fd = new FormData();
  fd.append('file', file);
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

const borrowerApi = {
  getAll: async (search, category) => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    const suffix = qs.toString() ? `?${qs}` : '';
    return (await req(`/borrower/getAll${suffix}`)).data || [];
  },

  // Every category on file, not just those on the rows currently shown.
  getCategories: async () => (await req('/borrower/categories')).data || [],

  getById: async (id) => (await req(`/borrower/${id}`)).data,

  create: async (borrower) =>
    (await req('/borrower/create', { method: 'POST', body: borrower })).data,

  update: async (id, borrower) =>
    (await req(`/borrower/update/${id}`, { method: 'PUT', body: borrower })).data,

  remove: async (id) => req(`/borrower/delete/${id}`, { method: 'DELETE' }),

  // Find-or-create by name. Called once the user confirms which company a
  // reviewed letter belongs to, so the sanction has a borrower to hang off.
  resolve: async (borrowerName) =>
    (await req('/borrower/resolve', { method: 'POST', body: { borrowerName } })).data,

  // Stateless parse → partial field map. Writes nothing; safe to call before
  // any borrower exists.
  parseSanction: async (file) =>
    (await postFile('/borrower/parse-sanction', file, 'Could not read the document')) || {},

  // `rawExtracted` is the untouched parser output, stored alongside the saved
  // values so an edited figure can be audited against what was read.
  saveSanction: async (sanction, rawExtracted) =>
    (await req('/borrower/sanction/save', {
      method: 'POST', body: { sanction, rawExtracted },
    })).data,

  removeSanction: async (id) => req(`/borrower/sanction/delete/${id}`, { method: 'DELETE' }),

  uploadDoc: async (sanctionId, file) =>
    postFile(`/borrower/sanction/${sanctionId}/upload-doc`, file, 'Upload failed'),

  // Returns { kind: 'PDF' | 'HTML', fileName, mimeType, size, html? }.
  // Word files come back as sanitised HTML rendered server-side, since no
  // browser can display a .docx — that is what makes in-page viewing possible.
  previewDoc: async (sanctionId) =>
    (await req(`/borrower/sanction/${sanctionId}/preview-doc`)).data,

  // Blob URL for the in-page viewer iframe (PDFs) or a download (Word).
  docBlobUrl: async (sanctionId) => {
    const res = await fetch(
      `${API_BASE_URL}/borrower/sanction/${sanctionId}/download-doc`,
      { method: 'GET', credentials: 'include', headers: authHeadersRaw() },
    );
    if (!res.ok) throw new Error(`Could not load the document (HTTP ${res.status})`);
    return URL.createObjectURL(await res.blob());
  },

  docDownloadUrl: (sanctionId) =>
    `${API_BASE_URL}/borrower/sanction/${sanctionId}/download-doc?forceDownload=true`,
};

export default borrowerApi;