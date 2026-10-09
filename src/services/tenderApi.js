// src/services/tenderApi.js
//
// Service layer for the Tenders module. Mirrors projectsApi.js / filterApi.js:
// reads the logged-in user from the `bd_portal_user` localStorage key, always
// sends credentials:'include' (session-cookie auth) plus the User-Id / User-Role
// headers, and unwraps the backend's { success, message, data } envelope.
// Talks to the Spring Boot TenderController at /tender.

import { tenderExcelOptions } from './tenderData';

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

// `file` is one File (sent as "file") or a map of part name → File for an
// upload that carries several; a missing File is simply left out.
const postFile = async (path, file, failLabel, extra) => {
  const fd = new FormData();
  if (file instanceof Blob) fd.append('file', file);
  else Object.entries(file || {}).forEach(([k, f]) => { if (f) fd.append(k, f); });
  Object.entries(extra || {}).forEach(([k, v]) => { if (v != null) fd.append(k, String(v)); });
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

// Save a blob response as a download, named from Content-Disposition when sent.
const saveBlob = async (res, fallbackName) => {
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = (m && m[1]) || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  // ── Excel template round trip ──
  // Every call carries the app's own dropdown vocabularies (tenderExcelOptions),
  // so the template and the import never hold a copy that could drift.

  // Blank template, or pre-filled from `tender` (the working copy) so an LLM
  // only has to fill the gaps.
  downloadExcelTemplate: async (tender = null) => {
    const res = await fetch(`${API_BASE_URL}/tender/excel/template`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ options: tenderExcelOptions(), tender }),
    });
    if (!res.ok) throw new Error(`Could not build the template (HTTP ${res.status})`);
    await saveBlob(res, 'Tender-Template.xlsx');
  },
  // Reads the filled file into a review, checking every value against the
  // tender PDF: `pdf` when given, else (for a saved tender) the one stored on
  // `tenderId`. Nothing is saved. The result's `importId` keys the PDF the
  // server holds for re-checking edits.
  importExcel: async ({ file, pdf = null, tenderId = null }) =>
    (await postFile('/tender/excel/import', { file, pdf }, 'Import failed', {
      options: JSON.stringify(tenderExcelOptions()),
      tenderId: pdf ? null : tenderId,
    })) || {},
  // Re-check values edited in the review by the import's own rules — and
  // against the same PDF (held on the session under importId).
  validateExcel: async ({ fields, fieldSources, eligibilityCriteria, documents, boqItems, version, importId }) =>
    (await req('/tender/excel/validate', {
      method: 'POST',
      body: {
        options: tenderExcelOptions(), fields, fieldSources, eligibilityCriteria, documents, boqItems,
        version, importId,
      },
    })).data,
};

export default tenderApi;
