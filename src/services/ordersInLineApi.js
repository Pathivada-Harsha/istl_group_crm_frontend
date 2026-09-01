// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONAL FEATURE — "Orders in Line"
// Temporary stopgap register, scheduled for replacement by a permanent pipeline
// module. Data here migrates into the leads table at that point.
// Removal: drop table `orders_in_line`, delete the OrdersInLine* files, revert the
// two lines in Dashboard.js, the sidebar entry, and the App.js import + route.
// ─────────────────────────────────────────────────────────────────────────────
//
// Follows the house service-module pattern (see filterApi.js): base URL from the
// environment, current user read off the `bd_portal_user` localStorage key, and
// credentials always included so the JSESSIONID cookie rides along.
// setupFetchInterceptor already handles global 401 → /login redirect.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Same key AuthContext persists to.
const getUser = () => {
  try {
    const raw = localStorage.getItem('bd_portal_user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.user || {};
  } catch { return {}; }
};

const getAuthHeaders = () => {
  const u    = getUser();
  const id   = String(u.id   || '');
  const role = String(u.role || '');
  return {
    'Content-Type': 'application/json',
    'User-Id':      id,
    'User-Role':    role,
    'X-User-Id':    id,
    'X-User-Role':  role,
  };
};

// Unwraps the {success, message, data} envelope; throws the server message on failure.
const handle = async (response) => {
  let payload = null;
  try { payload = await response.json(); } catch { /* empty body */ }
  if (!response.ok || payload?.success === false) {
    const err = new Error(payload?.message || `HTTP error! status: ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return payload;
};

/** The only six values `status` may hold — mirrors OrdersInLineService.STATUSES. */
export const ORDERS_IN_LINE_STATUSES = [
  'Enquiry Received',
  'In Discussion',
  'Quoted',
  'Confirmed',
  'On Hold',
  'Dropped',
];

export const ORDERS_IN_LINE_SOURCE_TYPES = [
  'Developer',
  'Channel Partner',
  'Direct',
  'Reference',
  'Other',
];

/** Same list the Leads form offers. */
export const CAPACITY_UNITS = ['kW', 'kWp', 'MW', 'HP', 'kVA', 'Units'];

const ordersInLineApi = {
  /** Filtered list. Blank filters are omitted so the server ignores them. */
  getAll: async ({ search, status, category, fromDate, toDate } = {}) => {
    const params = new URLSearchParams();
    if (search)   params.append('search', search);
    if (status)   params.append('status', status);
    if (category) params.append('category', category);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate)   params.append('toDate', toDate);
    const qs = params.toString();

    const response = await fetch(
      `${API_BASE_URL}/orders-in-line/getAll${qs ? `?${qs}` : ''}`,
      { method: 'GET', credentials: 'include', headers: getAuthHeaders() }
    );
    const payload = await handle(response);
    return payload?.data || [];
  },

  create: async (record) => {
    const response = await fetch(`${API_BASE_URL}/orders-in-line/create`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(record),
    });
    const payload = await handle(response);
    return payload?.data;
  },

  update: async (id, record) => {
    const response = await fetch(`${API_BASE_URL}/orders-in-line/update/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(record),
    });
    const payload = await handle(response);
    return payload?.data;
  },

  /** Soft delete — the row survives in the DB with a deleted_at timestamp. */
  remove: async (id) => {
    const response = await fetch(`${API_BASE_URL}/orders-in-line/delete/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    await handle(response);
  },

  /** Dashboard block only. */
  getSummary: async () => {
    const response = await fetch(`${API_BASE_URL}/orders-in-line/summary`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    const payload = await handle(response);
    return payload?.data || null;
  },

  /**
   * Category options — the leads sub-group master, flattened.
   *
   * /filters/leads-subgroups requires a groupName and there is no "all
   * sub-groups" endpoint, so fetch the groups then every group's sub-groups in
   * parallel and merge. Values are raw sub_group_name strings, identical to
   * what leads stores in sub_group_name, which is what keeps the eventual
   * migration a field-to-field copy.
   */
  getCategoryOptions: async () => {
    const groupsRes = await fetch(`${API_BASE_URL}/filters/leads-groups`, {
      method: 'GET', credentials: 'include', headers: getAuthHeaders(),
    });
    if (!groupsRes.ok) throw new Error(`HTTP error! status: ${groupsRes.status}`);
    const groups = await groupsRes.json();
    if (!Array.isArray(groups) || groups.length === 0) return [];

    const perGroup = await Promise.all(
      groups.map(async (g) => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/filters/leads-subgroups?groupName=${encodeURIComponent(g.value)}`,
            { method: 'GET', credentials: 'include', headers: getAuthHeaders() }
          );
          if (!res.ok) return [];
          const subs = await res.json();
          return Array.isArray(subs) ? subs : [];
        } catch {
          return [];   // one bad group must not empty the whole dropdown
        }
      })
    );

    // Dedupe by value — the same sub-group name can appear under two groups.
    const seen = new Map();
    perGroup.flat().forEach((sg) => {
      if (sg?.value && !seen.has(sg.value)) {
        seen.set(sg.value, { value: sg.value, label: sg.label || sg.value });
      }
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  },

  /** Owner options — reuses the existing all-users endpoint. */
  getUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/filters/all-users`, {
      method: 'GET', credentials: 'include', headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * PIN-code → State / District, same lookup the Leads form uses.
   * `signal` lets the caller abort a superseded keystroke.
   */
  lookupPincode: async (pin, signal) => {
    const response = await fetch(`${API_BASE_URL}/pincode/${pin}`, {
      credentials: 'include', headers: getAuthHeaders(), signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    const po = data?.[0]?.Status === 'Success' ? data[0]?.PostOffice?.[0] : null;
    return po ? { state: po.State, district: po.District } : null;
  },
};

export default ordersInLineApi;
