/**
 * NotificationModule.jsx
 * =============================================================================
 * Single, self-contained Notification module for the ISTL CRM.
 *
 * Everything notification-related lives in this one file, organised into clean
 * internal sections:
 *
 *   1. Config & helpers (API base, auth headers, fetch wrapper, utils)
 *   2. API service functions
 *   3. NotificationContext + NotificationProvider (state + STOMP/SockJS realtime)
 *   4. useNotifications hook
 *   5. Presentational components:
 *        - NotificationBadge   (unread count pill)
 *        - NotificationBell     (navbar icon + dropdown of latest 10)
 *        - NotificationCard
 *        - NotificationsPage    (full /notifications page: search/filter/paginate)
 *        - NotificationToaster   (real-time toast popups)
 *   6. Scoped, theme-aware styles (injected once; uses the CRM's CSS variables)
 *
 * Integration is documented in: integration_snippets/03_frontend_integration.md
 *
 * Dependencies (add to package.json):  @stomp/stompjs  sockjs-client
 * Already present: react, react-router-dom, (fetch is native — no axios needed).
 * =============================================================================
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import SockJS from 'sockjs-client';
import { Client as StompClient } from '@stomp/stompjs';

/* ============================================================================
 * 1. CONFIG & HELPERS
 * ========================================================================== */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const USER_KEY = 'bd_portal_user'; // must match AuthContext.js
const API = `${BASE_URL}/api/notifications`;
const WS_URL = `${BASE_URL}/ws-notifications`;
const USER_QUEUE = '/user/queue/notifications';

// Map a notification's module + referenceId to an existing CRM route.
// Pages can read the query param to auto-open the record (see snippet doc).
const MODULE_ROUTES = {
  LEAD:     (id) => `/sales/leads?leadId=${id}`,
  TASK:     (id) => `/taskmanagement?taskId=${id}`,
  FOLLOWUP: (id) => `/follow-ups?followupId=${id}`,
  INVOICE:  (id) => `/sales/invoices?invoiceId=${id}`,
};

function routeForNotification(n) {
  const fn = MODULE_ROUTES[(n.module || '').toUpperCase()];
  return fn && n.referenceId != null ? fn(n.referenceId) : null;
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.user ?? null; // { id, role, name, ... }
  } catch {
    return null;
  }
}

function authHeaders() {
  const user = getStoredUser();
  return {
    'Content-Type': 'application/json',
    'User-Id': user?.id ?? '',
    'User-Role': user?.role ?? '',
  };
}

async function apiRequest(method, path, { body, params } = {}) {
  let url = path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    credentials: 'include', // send JSESSIONID — required for Spring Session
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // session expired — mirror the app's behaviour
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem(USER_KEY);
      window.location.href = '/login';
    }
    throw new Error('SESSION_EXPIRED');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// "2 minutes ago" style relative time
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}

const MODULE_META = {
  LEAD:     { label: 'Lead',      color: '#2563eb', token: '--c-2563eb' },
  TASK:     { label: 'Task',      color: '#7c3aed', token: '--c-6366f1' },
  FOLLOWUP: { label: 'Follow-up', color: '#059669', token: '--c-059669' },
  INVOICE:  { label: 'Invoice',   color: '#d97706', token: '--c-dc2626' },
};

/* ============================================================================
 * 2. API SERVICE FUNCTIONS
 * ========================================================================== */

const notificationApi = {
  getLatest: () => apiRequest('GET', `${API}/latest`),
  getUnreadCount: () => apiRequest('GET', `${API}/unread-count`),
  getPage: ({ filter = 'all', search = '', page = 1, size = 15 }) =>
    apiRequest('GET', API, { params: { filter, search, page, size } }),
  markRead: (id) => apiRequest('PUT', `${API}/${id}/read`),
  markAllRead: () => apiRequest('PUT', `${API}/mark-all-read`),
  remove: (id) => apiRequest('DELETE', `${API}/${id}`),
};

/* ============================================================================
 * 3. CONTEXT + PROVIDER (state + realtime STOMP/SockJS)
 * ========================================================================== */

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [latest, setLatest] = useState([]);     // top 10 for the dropdown
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);      // realtime popups
  const stompRef = useRef(null);

  // Use the real auth state (not raw localStorage) so notifications never
  // connect or fetch before login, and disconnect immediately on logout.
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;

  // ── toast helpers ──────────────────────────────────────────────────
  const pushToast = useCallback((notification) => {
    const id = `${notification.id}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, notification }]);
    // auto-dismiss after 6s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── initial load ───────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!getStoredUser()?.id) return;
    try {
      const data = await notificationApi.getLatest();
      setLatest(data.data || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED') console.error('Notification load failed', e);
    }
  }, []);

  // ── apply a realtime payload from the socket ───────────────────────
  const onRealtime = useCallback((msg) => {
    try {
      const data = JSON.parse(msg.body);
      if (data.type === 'NEW_NOTIFICATION' && data.payload) {
        setLatest((prev) => [data.payload, ...prev].slice(0, 10));
        setUnreadCount((c) => c + 1);
        pushToast(data.payload);
      } else if (data.type === 'UNREAD_COUNT') {
        setUnreadCount(data.count ?? 0);
      }
    } catch (e) {
      console.error('Bad realtime payload', e);
    }
  }, [pushToast]);

  // ── connect STOMP over SockJS after login; auto-reconnect built in ─
  useEffect(() => {
    if (!userId) return undefined;

    refresh();

    const client = new StompClient({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,          // auto-reconnect on failure
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(USER_QUEUE, onRealtime);
        // re-sync after a (re)connect in case we missed events while offline
        refresh();
      },
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) =>
        console.error('STOMP error', frame?.headers?.message),
    });

    client.activate();
    stompRef.current = client;

    return () => {
      try { client.deactivate(); } catch { /* ignore */ }
      stompRef.current = null;
      setConnected(false);
    };
  }, [userId, refresh, onRealtime]);

  // ── mutations (optimistic, then reconcile) ─────────────────────────
  const markRead = useCallback(async (id) => {
    setLatest((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try { await notificationApi.markRead(id); } catch (e) { refresh(); }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setLatest((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try { await notificationApi.markAllRead(); } catch (e) { refresh(); }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    setLatest((prev) => prev.filter((n) => n.id !== id));
    try { await notificationApi.remove(id); } finally { refresh(); }
  }, [refresh]);

  const value = useMemo(() => ({
    latest, unreadCount, connected, toasts,
    refresh, markRead, markAllRead, remove, dismissToast,
  }), [latest, unreadCount, connected, toasts,
       refresh, markRead, markAllRead, remove, dismissToast]);

  return (
    <NotificationContext.Provider value={value}>
      <NotificationStyles />
      {children}
      <NotificationToaster />
    </NotificationContext.Provider>
  );
}

/* ============================================================================
 * 4. HOOK
 * ========================================================================== */

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within <NotificationProvider>');
  }
  return ctx;
}

/* ============================================================================
 * 5. COMPONENTS
 * ========================================================================== */

// ── Bell icon (SVG) ───────────────────────────────────────────────────
function BellIcon() {
  return (
    <svg className="ntf-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// ── Unread badge ──────────────────────────────────────────────────────
export function NotificationBadge({ count }) {
  if (!count) return null;
  return <span className="ntf-badge">{count > 99 ? '99+' : count}</span>;
}

// ── Navbar bell + dropdown of latest 10 ───────────────────────────────
export function NotificationBell() {
  const { latest, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Clicking any dropdown item just goes to the full notifications page.
  // It is NOT marked read here — that happens when the user clicks it there.
  const goToNotifications = () => {
    setOpen(false);
    navigate('/notifications');
  };

  return (
    <div className="ntf-bell-wrap" ref={ref}>
      <button
        className="ntf-icon-button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        <NotificationBadge count={unreadCount} />
      </button>

      {open && (
        <div className="ntf-dropdown">
          <div className="ntf-dropdown-head">
            <span>Notifications</span>
            {unreadCount > 0 && <span className="ntf-dropdown-count">{unreadCount} unread</span>}
          </div>

          <div className="ntf-dropdown-list">
            {latest.length === 0 && (
              <div className="ntf-empty">You're all caught up 🎉</div>
            )}
            {latest.map((n) => (
              <button
                key={n.id}
                className={`ntf-drop-item ${n.isRead ? '' : 'ntf-unread'}`}
                onClick={goToNotifications}
              >
                <span
                  className="ntf-dot"
                  style={{ background: MODULE_META[n.module]?.color || '#2563eb' }}
                />
                <span className="ntf-drop-body">
                  <span className="ntf-drop-title">{n.title}</span>
                  <span className="ntf-drop-msg">{n.message}</span>
                  <span className="ntf-drop-time">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            className="ntf-viewall"
            onClick={goToNotifications}
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
}

// ── A single card (used on the page) ──────────────────────────────────
function NotificationCard({ n, onOpen, onToggleRead, onDelete }) {
  const meta = MODULE_META[n.module] || { label: n.module, color: '#2563eb' };
  return (
    <div className={`ntf-card ${n.isRead ? '' : 'ntf-card-unread'}`}>
      <span className="ntf-card-accent" style={{ background: meta.color }} />
      <button className="ntf-card-main" onClick={() => onOpen(n)}>
        <div className="ntf-card-row">
          <span className="ntf-chip" style={{ borderColor: meta.color, color: meta.color }}>
            {meta.label}
          </span>
          <span className="ntf-card-time">{timeAgo(n.createdAt)}</span>
        </div>
        <div className="ntf-card-title">{n.title}</div>
        <div className="ntf-card-msg">{n.message}</div>
      </button>
      <div className="ntf-card-actions">
        {!n.isRead && (
          <button className="ntf-link" title="Mark as read" onClick={() => onToggleRead(n)}>
            Mark read
          </button>
        )}
        <button className="ntf-link ntf-danger" title="Delete" onClick={() => onDelete(n)}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Full page: /notifications ─────────────────────────────────────────
export function NotificationsPage() {
  const { unreadCount, markRead, markAllRead, remove, refresh } = useNotifications();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');     // all | unread | read
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState(15);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getPage({ filter, search: debounced, page, size });
      setItems(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED') console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, debounced, page, size]);

  useEffect(() => { load(); }, [load]);

  const openRecord = (n) => {
    if (!n.isRead) { markRead(n.id); load(); }
    const route = routeForNotification(n);
    if (route) navigate(route);
  };

  const toggleRead = async (n) => { await markRead(n.id); load(); };
  const del = async (n) => { await remove(n.id); load(); };
  const handleMarkAll = async () => { await markAllRead(); load(); };

  return (
    <div className="ntf-page">
      <div className="ntf-page-head">
        <div>
          <h1 className="ntf-page-title">Notifications</h1>
          <p className="ntf-page-sub">
            {totalElements} total{unreadCount ? ` · ${unreadCount} unread` : ''}
          </p>
        </div>
        <button
          className="ntf-btn ntf-btn-primary"
          disabled={!unreadCount}
          onClick={handleMarkAll}
        >
          Mark all as read
        </button>
      </div>

      <div className="ntf-toolbar">
        <div className="ntf-search">
          <input
            type="text"
            placeholder="Search notifications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ntf-tabs">
          {['all', 'unread', 'read'].map((f) => (
            <button
              key={f}
              className={`ntf-tab ${filter === f ? 'ntf-tab-active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="ntf-list">
        {loading && <div className="ntf-empty">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="ntf-empty">No notifications found.</div>
        )}
        {!loading && items.map((n) => (
          <NotificationCard
            key={n.id}
            n={n}
            onOpen={openRecord}
            onToggleRead={toggleRead}
            onDelete={del}
          />
        ))}
      </div>

      <div className="ntf-pagination">
        <div className="ntf-pagination-left">
          <span className="ntf-page-info">
            {totalElements === 0
              ? 'No entries'
              : `Showing ${(page - 1) * size + 1} to ${Math.min(page * size, totalElements)} of ${totalElements} entries`}
          </span>
          <select
            className="ntf-rows-select"
            value={size}
            onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}
          >
            <option value={10}>10 Rows</option>
            <option value={20}>20 Rows</option>
            <option value={50}>50 Rows</option>
            <option value={100}>100 Rows</option>
          </select>
        </div>

        <div className="ntf-pagination-buttons">
          <button
            className="ntf-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="ntf-page-current">Page {page} of {totalPages || 1}</span>
          <button
            className="ntf-btn"
            disabled={page >= totalPages || totalPages === 0}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Realtime toasts ───────────────────────────────────────────────────
function NotificationToaster() {
  const { toasts, dismissToast } = useNotifications();
  const navigate = useNavigate();
  return (
    <div className="ntf-toaster">
      {toasts.map(({ id, notification }) => (
        <div
          key={id}
          className="ntf-toast"
          role="button"
          onClick={() => {
            dismissToast(id);
            const route = routeForNotification(notification);
            if (route) navigate(route);
          }}
        >
          <span
            className="ntf-toast-accent"
            style={{ background: MODULE_META[notification.module]?.color || '#2563eb' }}
          />
          <div className="ntf-toast-body">
            <div className="ntf-toast-title">{notification.title}</div>
            <div className="ntf-toast-msg">{notification.message}</div>
          </div>
          <button
            className="ntf-toast-close"
            onClick={(e) => { e.stopPropagation(); dismissToast(id); }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
 * 6. SCOPED THEME-AWARE STYLES
 *    Uses the CRM's existing theme tokens: var(--c-xxxxxx, #fallback) for
 *    surfaces/borders and var(--ct-xxxxxx, #fallback) for text. In light mode
 *    the tokens are undefined → fallbacks apply. In dark mode ([data-theme=
 *    "dark"]) theme.css remaps them automatically — no hardcoded #fff/#000.
 * ========================================================================== */

function NotificationStyles() {
  return (
    <style>{`
.ntf-icon { width: 20px; height: 20px; color: var(--ct-4b5563, #4b5563); }
.ntf-icon-button {
  position: relative; width: 38px; height: 38px; padding: 0;
  background: var(--c-f3f4f6, #f3f4f6); border: none; border-radius: 50%;
  cursor: pointer; transition: background-color 0.2s;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ct-4b5563, #4b5563);
}
.ntf-icon-button:hover { background-color: var(--c-e5e7eb, #e5e7eb); }

.ntf-badge {
  position: absolute; top: -2px; right: -2px; min-width: 18px; height: 18px;
  padding: 0 5px; border-radius: 9px; background: var(--c-ef4444, #ef4444);
  color: #fff; font-size: 11px; font-weight: 700; line-height: 18px;
  text-align: center; box-shadow: 0 0 0 2px var(--c-ffffff, #ffffff);
}

.ntf-bell-wrap { position: relative; display: inline-block; }

.ntf-dropdown {
  position: absolute; right: 0; top: calc(100% + 10px); width: 360px; max-width: 92vw;
  background: var(--c-ffffff, #ffffff); border: 1px solid var(--c-e5e7eb, #e5e7eb);
  border-radius: 12px; box-shadow: 0 12px 28px rgba(0,0,0,.18); z-index: 1200;
  overflow: hidden; animation: ntf-fade .14s ease;
}
@keyframes ntf-fade { from { opacity: 0; transform: translateY(-4px);} to {opacity:1;transform:none;} }

.ntf-dropdown-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; font-weight: 700; color: var(--ct-111827, #111827);
  border-bottom: 1px solid var(--c-eef2f7, #eef2f7);
}
.ntf-dropdown-count { font-size: 12px; font-weight: 600; color: var(--ct-2563eb, #2563eb); }

.ntf-dropdown-list { max-height: 360px; overflow-y: auto; }

.ntf-drop-item {
  display: flex; gap: 10px; width: 100%; text-align: left; background: transparent;
  border: none; border-bottom: 1px solid var(--c-f1f5f9, #f1f5f9); padding: 11px 14px;
  cursor: pointer; transition: background .12s ease;
}
.ntf-drop-item:hover { background: var(--c-f8fafc, #f8fafc); }
.ntf-drop-item.ntf-unread { background: var(--c-eff6ff, #eff6ff); }
.ntf-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
.ntf-drop-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ntf-drop-title {
  font-size: 13.5px; font-weight: 600; color: var(--ct-111827, #111827);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ntf-drop-item.ntf-unread .ntf-drop-title { font-weight: 700; }
.ntf-drop-msg {
  font-size: 12.5px; color: var(--ct-4b5563, #4b5563);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ntf-drop-time { font-size: 11.5px; color: var(--ct-94a3b8, #94a3b8); margin-top: 2px; }

.ntf-viewall {
  width: 100%; padding: 11px; background: transparent; border: none;
  border-top: 1px solid var(--c-eef2f7, #eef2f7); color: var(--ct-2563eb, #2563eb);
  font-weight: 600; font-size: 13px; cursor: pointer;
}
.ntf-viewall:hover { background: var(--c-f8fafc, #f8fafc); }

.ntf-empty { padding: 26px 14px; text-align: center; color: var(--ct-94a3b8, #94a3b8); font-size: 13px; }

/* ── Page ── */
.ntf-page { max-width: 860px; margin: 0 auto; padding: 22px 16px 60px; }
.ntf-page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.ntf-page-title { font-size: 22px; font-weight: 700; color: var(--ct-111827, #111827); margin: 0; }
.ntf-page-sub { margin: 4px 0 0; font-size: 13px; color: var(--ct-64748b, #64748b); }

.ntf-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.ntf-search { flex: 1 1 220px; }
.ntf-search input {
  width: 100%; padding: 9px 12px; border-radius: 9px;
  border: 1px solid var(--c-e5e7eb, #e5e7eb); background: var(--c-ffffff, #ffffff);
  color: var(--ct-111827, #111827); font-size: 14px; outline: none;
}
.ntf-search input:focus { border-color: var(--c-2563eb, #2563eb); }

.ntf-tabs { display: inline-flex; background: var(--c-f1f5f9, #f1f5f9); border-radius: 9px; padding: 3px; }
.ntf-tab {
  border: none; background: transparent; padding: 7px 14px; border-radius: 7px;
  font-size: 13px; font-weight: 600; color: var(--ct-64748b, #64748b); cursor: pointer;
}
.ntf-tab-active { background: var(--c-ffffff, #ffffff); color: var(--ct-2563eb, #2563eb); box-shadow: 0 1px 3px rgba(0,0,0,.12); }

.ntf-list { display: flex; flex-direction: column; gap: 10px; }

.ntf-card {
  position: relative; display: flex; align-items: stretch; gap: 0;
  background: var(--c-ffffff, #ffffff); border: 1px solid var(--c-e5e7eb, #e5e7eb);
  border-radius: 11px; overflow: hidden; transition: box-shadow .15s ease, transform .05s ease;
}
.ntf-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.10); }
.ntf-card-unread { background: var(--c-eff6ff, #eff6ff); }
.ntf-card-accent { width: 4px; flex-shrink: 0; }
.ntf-card-main { flex: 1; text-align: left; background: transparent; border: none; cursor: pointer; padding: 13px 14px; min-width: 0; }
.ntf-card-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.ntf-chip { font-size: 11px; font-weight: 700; padding: 2px 8px; border: 1px solid; border-radius: 999px; }
.ntf-card-time { font-size: 12px; color: var(--ct-94a3b8, #94a3b8); }
.ntf-card-title { font-size: 14.5px; font-weight: 600; color: var(--ct-111827, #111827); margin-bottom: 2px; }
.ntf-card-unread .ntf-card-title { font-weight: 700; }
.ntf-card-msg { font-size: 13px; color: var(--ct-4b5563, #4b5563); }
.ntf-card-actions { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 0 12px; border-left: 1px solid var(--c-f1f5f9, #f1f5f9); }
.ntf-link { background: transparent; border: none; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--ct-2563eb, #2563eb); padding: 2px 0; white-space: nowrap; }
.ntf-link:hover { text-decoration: underline; }
.ntf-danger { color: var(--ct-ef4444, #ef4444); }

.ntf-btn {
  padding: 8px 14px; border-radius: 9px; border: 1px solid var(--c-e5e7eb, #e5e7eb);
  background: var(--c-ffffff, #ffffff); color: var(--ct-374151, #374151);
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.ntf-btn:disabled { opacity: .5; cursor: not-allowed; }
.ntf-btn-primary { background: var(--c-2563eb, #2563eb); border-color: var(--c-2563eb, #2563eb); color: #fff; }

.ntf-pagination { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 20px; flex-wrap: wrap; }
.ntf-pagination-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ntf-rows-select { padding: 7px 10px; border-radius: 9px; border: 1px solid var(--c-e5e7eb, #e5e7eb); background: var(--c-ffffff, #ffffff); color: var(--ct-111827, #111827); font-size: 13px; cursor: pointer; }
.ntf-pagination-buttons { display: flex; align-items: center; gap: 12px; }
.ntf-page-current { font-size: 13px; color: var(--ct-64748b, #64748b); }
.ntf-page-info { font-size: 13px; color: var(--ct-64748b, #64748b); }

/* ── Toasts ── */
.ntf-toaster { position: fixed; top: 78px; right: 18px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; width: 340px; max-width: 92vw; }
.ntf-toast {
  position: relative; display: flex; gap: 10px; align-items: flex-start;
  background: var(--c-ffffff, #ffffff); border: 1px solid var(--c-e5e7eb, #e5e7eb);
  border-radius: 11px; padding: 12px 12px 12px 0; box-shadow: 0 10px 26px rgba(0,0,0,.20);
  cursor: pointer; overflow: hidden; animation: ntf-slide .2s ease;
}
@keyframes ntf-slide { from { opacity: 0; transform: translateX(24px);} to {opacity:1;transform:none;} }
.ntf-toast-accent { width: 4px; align-self: stretch; flex-shrink: 0; }
.ntf-toast-body { flex: 1; min-width: 0; }
.ntf-toast-title { font-size: 13.5px; font-weight: 700; color: var(--ct-111827, #111827); }
.ntf-toast-msg { font-size: 12.5px; color: var(--ct-4b5563, #4b5563); margin-top: 2px; }
.ntf-toast-close { background: transparent; border: none; font-size: 18px; line-height: 1; color: var(--ct-94a3b8, #94a3b8); cursor: pointer; padding: 0 6px; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .ntf-toolbar { flex-direction: column; align-items: stretch; }
  .ntf-tabs { width: 100%; justify-content: space-between; }
  .ntf-card-actions { padding: 0 8px; }
  .ntf-dropdown { width: 320px; }
}
    `}</style>
  );
}

export default NotificationsPage;