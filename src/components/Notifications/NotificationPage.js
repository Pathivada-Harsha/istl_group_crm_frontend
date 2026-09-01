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
import { redirectToLogin } from '../../utils/setupFetchInterceptor';
import SockJS from 'sockjs-client';
import { Client as StompClient } from '@stomp/stompjs';
import { useAuth } from '../../hooks/useAuth.js';
import NotificationDrawer from './NotificationDrawer.js';
import {
  Search, CheckCheck, Trash2, Inbox, CircleDot, MailOpen, BellOff,
} from 'lucide-react';
import '../../components_css/Notifications/NotificationsPage.css';
import useToast from '../../hooks/useToast.js';
import ToastContainer from '../Notification_Toast/ToastContainer.js';
import useConfirmationModal from '../HandleConfirmationModal.js';
import ConfirmationModal from '../ConfirmationModal.js';

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
  EXPENSE:  (id) => `/project-cost-expense?expenseId=${id}`,
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
    // Same guarded redirect the global fetch interceptor uses, so this
    // doesn't push its own separate trip to /login on top of one already
    // in progress.
    redirectToLogin();
    throw new Error('SESSION_EXPIRED');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// "2 minutes ago" style relative time
export function timeAgo(iso) {
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

export const MODULE_META = {
  LEAD:     { label: 'Lead',      color: '#2563eb', token: '--c-2563eb' },
  TASK:     { label: 'Task',      color: '#7c3aed', token: '--c-6366f1' },
  FOLLOWUP: { label: 'Follow-up', color: '#059669', token: '--c-059669' },
  INVOICE:  { label: 'Invoice',   color: '#d97706', token: '--c-dc2626' },
  EXPENSE:  { label: 'Expense',   color: '#0891b2', token: '--c-0891b2' },
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

  // FIX: read userId from AuthContext (reactive state) instead of localStorage
  // getStoredUser()?.id is read once at render and never updates after login,
  // so the WebSocket useEffect never re-fires. useAuth() is reactive — when the
  // user logs in, isAuthenticated flips to true, userId updates, and the effect
  // connects the STOMP socket so real-time toasts start working immediately.
  const { user: authUser, isAuthenticated } = useAuth();
  const userId = isAuthenticated ? (authUser?.id ?? null) : null;

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
    if (!userId) return;
    try {
      const data = await notificationApi.getLatest();
      setLatest(data.data || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (e) {
      if (e.message !== 'SESSION_EXPIRED') console.error('Notification load failed', e);
    }
  }, [userId]);

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
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  // No click-outside listener here any more: the drawer owns its own overlay,
  // ESC handling and focus trap, so a document-level listener would fight it.
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="ntf-bell-wrap">
      <button
        className="ntf-icon-button"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        data-tooltip="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BellIcon />
        <NotificationBadge count={unreadCount} />
      </button>

      <NotificationDrawer open={open} onClose={close} />
    </div>
  );
}

// ── Full page: /notifications ─────────────────────────────────────────
export function NotificationsPage() {
  const { unreadCount, markRead, markAllRead, remove, refresh } = useNotifications();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');     // all | unread | read
  const [moduleFilter, setModuleFilter] = useState('');  // '' = every module
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const size = 15;

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
  }, [filter, debounced, page]);

  useEffect(() => { load(); }, [load]);

  const openRecord = (n) => {
    if (!n.isRead) { markRead(n.id); load(); }
    const route = routeForNotification(n);
    if (route) navigate(route);
  };

  const toggleRead = async (n) => { await markRead(n.id); load(); };
  // App-standard toast feedback (same useToast + ToastContainer as other pages)
  const { toasts, removeToast, showSuccess, showError } = useToast();
  // App-standard centered confirmation modal (same as Follow-Ups / POs)
  const { confirmModal, showConfirmation } = useConfirmationModal();
  const del = async (n) => {
    const ok = await showConfirmation({
      title: 'Delete Notification',
      message: 'Are you sure you want to delete this notification? This action cannot be undone.',
      type: 'alert',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    try {
      await remove(n.id);
      showSuccess('Notification deleted successfully.');
    } catch (e) {
      showError('Failed to delete the notification. Please try again.');
    }
    load();
  };
  const handleMarkAll = async () => { await markAllRead(); load(); };

  // ── Multi-select / bulk actions ────────────────────────────────────────────
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkReading, setBulkReading] = useState(false);

  // Reset the selection whenever the visible list changes
  useEffect(() => { setSelected(new Set()); }, [filter, moduleFilter, debounced, page]);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Client-side module narrowing. The API takes no module parameter, so this
  // filters the page already fetched — the rail counts are labelled "on this
  // page" for the same reason. Add a `module` param server-side and this
  // becomes a one-line change.
  const visible = useMemo(
    () => (moduleFilter ? items.filter(n => n.module === moduleFilter) : items),
    [items, moduleFilter],
  );

  const moduleCounts = useMemo(() => {
    const counts = {};
    items.forEach(n => { counts[n.module] = (counts[n.module] || 0) + 1; });
    return counts;
  }, [items]);

  // Grouped by calendar day, newest first, so chronology is read rather than
  // inferred from a column of timestamps.
  const groups = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    const out = [];
    visible.forEach((n) => {
      const d = n.createdAt ? new Date(n.createdAt) : null;
      let label = 'Earlier';
      if (d && !Number.isNaN(d.getTime())) {
        const day = new Date(d); day.setHours(0, 0, 0, 0);
        if (day.getTime() === today.getTime()) label = 'Today';
        else if (day.getTime() === yesterday.getTime()) label = 'Yesterday';
        else label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      }
      const bucket = out.find(g => g.label === label);
      if (bucket) bucket.items.push(n);
      else out.push({ label, items: [n] });
    });
    return out;
  }, [visible]);

  const allOnPageSelected = visible.length > 0 && visible.every(n => selected.has(n.id));
  const toggleSelectAll = () => setSelected(
    allOnPageSelected ? new Set() : new Set(visible.map(n => n.id))
  );

  const bulkDelete = async () => {
    if (!selected.size) return;
    const count = selected.size;
    const ok = await showConfirmation({
      title: `Delete ${count} Notification${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count === 1 ? 'this notification' : `these ${count} notifications`}? This action cannot be undone.`,
      type: 'alert',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      // Delete every selected notification; failures on individual ids
      // shouldn't abort the rest of the batch.
      const results = await Promise.allSettled([...selected].map(id => notificationApi.remove(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        showSuccess(`${count} notification${count > 1 ? 's' : ''} deleted successfully.`);
      } else if (failed < count) {
        showError(`${count - failed} deleted, ${failed} failed. Please try again for the rest.`);
      } else {
        showError('Failed to delete the selected notifications. Please try again.');
      }
    } finally {
      setBulkDeleting(false);
      setSelected(new Set());
      refresh();   // updates the bell's unread badge
      load();      // reloads this page's list
    }
  };

  // Bulk mark-as-read reuses the existing per-item markRead, so no new API.
  const bulkMarkRead = async () => {
    const ids = [...selected].filter(id => {
      const n = items.find(x => x.id === id);
      return n && !n.isRead;
    });
    if (!ids.length) { setSelected(new Set()); return; }
    setBulkReading(true);
    try {
      const results = await Promise.allSettled(ids.map(id => markRead(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) showSuccess(`${ids.length} marked as read.`);
      else showError(`${ids.length - failed} marked as read, ${failed} failed.`);
    } finally {
      setBulkReading(false);
      setSelected(new Set());
      load();
    }
  };

  const busy = bulkDeleting || bulkReading;
  const rangeFrom = totalElements === 0 ? 0 : (page - 1) * size + 1;
  const rangeTo = Math.min(page * size, totalElements);

  return (
    <div className="ntfp-page">
      <div className="ntfp-head">
        <div>
          <h1 className="ntfp-title">Notifications</h1>
          <p className="ntfp-sub">
            {totalElements} total{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
          </p>
        </div>
        <div className="ntfp-head-actions">
          <div className="ntfp-search">
            <Search size={15} className="ntfp-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="ntfp-input"
              placeholder="Search notifications"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="ntfp-btn"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={15} aria-hidden="true" />
            Mark all read
          </button>
        </div>
      </div>

      <div className="ntfp-layout">
        <nav className="ntfp-rail" aria-label="Filter notifications">
          <p className="ntfp-rail-label">Status</p>
          {[
            { key: 'all', label: 'All', Icon: Inbox },
            { key: 'unread', label: 'Unread', Icon: CircleDot },
            { key: 'read', label: 'Read', Icon: MailOpen },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`ntfp-rail-item ${filter === key ? 'ntfp-rail-on' : ''}`}
              aria-current={filter === key}
              onClick={() => { setFilter(key); setPage(1); }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              {/* Only the unread figure is globally accurate — it comes from the
                  provider. A count beside All or Read would reflect the current
                  filter, not the whole set. */}
              {key === 'unread' && unreadCount > 0 && (
                <span className="ntfp-rail-pill">{unreadCount}</span>
              )}
            </button>
          ))}

          <div className="ntfp-rail-sep" />

          <p className="ntfp-rail-label">Module · this page</p>
          <button
            type="button"
            className={`ntfp-rail-item ${moduleFilter === '' ? 'ntfp-rail-on' : ''}`}
            onClick={() => setModuleFilter('')}
          >
            <span className="ntfp-swatch" style={{ background: 'var(--c-94a3b8, #94a3b8)' }} />
            All modules
            <span className="ntfp-rail-count">{items.length}</span>
          </button>
          {Object.entries(MODULE_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              className={`ntfp-rail-item ${moduleFilter === key ? 'ntfp-rail-on' : ''}`}
              onClick={() => setModuleFilter(moduleFilter === key ? '' : key)}
            >
              <span className="ntfp-swatch" style={{ background: meta.color }} />
              {meta.label}
              <span className="ntfp-rail-count">{moduleCounts[key] || 0}</span>
            </button>
          ))}
        </nav>

        <div className="ntfp-feed">
          <div className="ntfp-feed-scroll">
          {visible.length > 0 && (
            <label className="ntfp-selectall">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAll}
                aria-label="Select all on this page"
              />
              Select all on this page
            </label>
          )}

          {selected.size > 0 && (
            <div className="ntfp-bulkbar" role="region" aria-label="Bulk actions">
              <span className="ntfp-bulk-count">{selected.size} selected</span>
              <span className="ntfp-bulk-of">of {visible.length} on this page</span>
              <span className="ntfp-bulk-actions">
                <button
                  type="button"
                  className="ntfp-btn ntfp-btn-sm"
                  onClick={bulkMarkRead}
                  disabled={busy}
                >
                  <CheckCheck size={14} aria-hidden="true" />
                  {bulkReading ? 'Marking…' : 'Mark as read'}
                </button>
                <button
                  type="button"
                  className="ntfp-btn ntfp-btn-sm ntfp-btn-danger"
                  onClick={bulkDelete}
                  disabled={busy}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
                </button>
                <button
                  type="button"
                  className="ntfp-btn ntfp-btn-sm"
                  onClick={() => setSelected(new Set())}
                  disabled={busy}
                >
                  Cancel
                </button>
              </span>
            </div>
          )}

          {loading && (
            <>
              {[0, 1, 2, 3].map(i => (
                <div className="ntfp-skel" key={i} aria-hidden="true">
                  <div className="ntfp-skel-body">
                    <span className="ntfp-skel-line ntfp-skel-sm" />
                    <span className="ntfp-skel-line ntfp-skel-lg" />
                    <span className="ntfp-skel-line ntfp-skel-md" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && visible.length === 0 && (
            <div className="ntfp-state">
              <BellOff size={28} className="ntfp-state-icon" aria-hidden="true" />
              <p className="ntfp-state-title">No notifications found</p>
              <p className="ntfp-state-text">
                {search || moduleFilter || filter !== 'all'
                  ? 'Try clearing the search or filters.'
                  : 'You are all caught up.'}
              </p>
            </div>
          )}

          {!loading && groups.map((group) => (
            <div key={group.label}>
              <p className="ntfp-daylabel">{group.label}</p>
              <div className="ntfp-timeline">
                {group.items.map((n) => {
                  const meta = MODULE_META[n.module] || { label: n.module, color: '#64748b' };
                  const isSel = selected.has(n.id);
                  return (
                    <div
                      key={n.id}
                      className="ntfp-node"
                      style={{ '--ntfp-accent': meta.color }}
                    >
                      <div
                        className={`ntfp-card ${n.isRead ? 'ntfp-card-read' : 'ntfp-card-unread'} ${isSel ? 'ntfp-card-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="ntfp-check"
                          checked={isSel}
                          onChange={() => toggleSelect(n.id)}
                          aria-label={`Select: ${n.title}`}
                        />
                        <div className="ntfp-card-body">
                          <div className="ntfp-card-top">
                            <span className="ntfp-card-title">{n.title}</span>
                            <span className="ntfp-card-time">{timeAgo(n.createdAt)}</span>
                          </div>
                          <p className="ntfp-card-msg">{n.message}</p>
                          <div className="ntfp-card-foot">
                            <span className="ntfp-chip">{meta.label}</span>
                            <span className="ntfp-card-links">
                              <button type="button" className="ntfp-link" onClick={() => openRecord(n)}>
                                Open
                              </button>
                              {!n.isRead && (
                                <button type="button" className="ntfp-link ntfp-link-muted" onClick={() => toggleRead(n)}>
                                  Mark read
                                </button>
                              )}
                              <button type="button" className="ntfp-link ntfp-link-danger" onClick={() => del(n)}>
                                Delete
                              </button>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          </div>

          {/* Pager sits outside the scroller, so it stays put as the feed moves. */}
          {!loading && totalElements > 0 && (
            <div className="ntfp-pager">
              <span>Showing {rangeFrom}–{rangeTo} of {totalElements}</span>
              <span className="ntfp-pager-nav">
                <button
                  type="button"
                  className="ntfp-btn ntfp-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  type="button"
                  className="ntfp-btn ntfp-btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* App-standard toasts for delete feedback */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* App-standard centered delete-confirmation modal */}
      <ConfirmationModal
        show={confirmModal.show} title={confirmModal.title} message={confirmModal.message}
        type={confirmModal.type} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText}
        onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel}
      />
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
/* Force Poppins across every notification surface. Something in the CSS loaded
   on this route was leaking an Arial-terminated stack into this subtree (the
   global body Poppins rule wasn't reaching it), so we set the family explicitly
   on each root AND its descendants to win the cascade regardless of source. */
.ntf-page, .ntf-page *,
.ntf-dropdown, .ntf-dropdown *,
.ntf-bell-wrap, .ntf-bell-wrap *,
.ntf-toaster, .ntf-toaster * {
  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
    'Helvetica Neue', sans-serif;
}
.ntf-icon { width: 17px; height: 17px; color: var(--ct-4b5563, #4b5563); }
.ntf-icon-button {
  /* Match .theme-toggle-btn in Navbar.css exactly */
  position: relative; width: 34px; height: 34px; padding: 0;
  background: var(--c-f1f5f9, #f1f5f9);
  border: 1.5px solid var(--c-94a3b8, #94a3b8);
  border-radius: 50%;
  cursor: pointer; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--ct-4b5563, #4b5563);
  transition: background 0.25s ease, border-color 0.25s ease,
              box-shadow 0.25s ease, transform 0.2s ease;
}
.ntf-icon-button:hover { transform: scale(1.12); }
.ntf-icon-button:active { transform: scale(0.93); }
.ntf-icon-button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 3px; }

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

/* ── Dropdown header with Mark All button ── */
.ntf-dropdown-head-right { display: flex; align-items: center; gap: 8px; }
.ntf-mark-all-btn {
  background: none; border: none; cursor: pointer;
  font-size: 11.5px; font-weight: 600;
  color: var(--ct-2563eb, #2563eb);
  padding: 3px 8px; border-radius: 6px;
  transition: background 0.15s;
  white-space: nowrap;
}
.ntf-mark-all-btn:hover { background: var(--c-eff6ff, #eff6ff); }

/* ── Per-notification hover Mark as Read ── */
.ntf-drop-item {
  position: relative; display: flex; align-items: center;
  border-bottom: 1px solid var(--c-f1f5f9, #f1f5f9);
  transition: background .12s ease;
}
.ntf-drop-item:hover { background: var(--c-f8fafc, #f8fafc); }
.ntf-drop-item.ntf-unread { background: var(--c-eff6ff, #eff6ff); }
.ntf-drop-item.ntf-unread:hover { background: var(--c-dbeafe, #dbeafe); }

.ntf-drop-item-main {
  display: flex; gap: 10px; flex: 1; text-align: left;
  background: transparent; border: none; padding: 11px 14px;
  cursor: pointer; min-width: 0;
}

.ntf-drop-mark-read {
  flex-shrink: 0; width: 30px; height: 30px; margin-right: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--c-ffffff, #ffffff);
  border: 1.5px solid var(--c-2563eb, #2563eb);
  border-radius: 50%; cursor: pointer;
  color: var(--ct-2563eb, #2563eb);
  transition: background 0.15s, transform 0.1s;
  animation: ntf-pop .15s ease;
}
.ntf-drop-mark-read:hover {
  background: var(--c-2563eb, #2563eb);
  color: #fff;
  transform: scale(1.1);
}
@keyframes ntf-pop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }

.ntf-empty { padding: 26px 14px; text-align: center; color: var(--ct-94a3b8, #94a3b8); font-size: 13px; }

/* ── Page ── */
.ntf-page { padding: 22px 24px 60px; }
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

.ntf-list { display: flex; flex-direction: column; gap: 10px; max-height: 600px; overflow-y: auto; padding-right: 6px; }
.ntf-list::-webkit-scrollbar { width: 8px; }
.ntf-list::-webkit-scrollbar-thumb { background: var(--c-d1d5db, #d1d5db); border-radius: 8px; }
.ntf-list::-webkit-scrollbar-track { background: transparent; }

.ntf-card {
  position: relative; display: flex; align-items: stretch; gap: 0; flex-shrink: 0;
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

.ntf-delete-confirm {
  display: flex; align-items: center; gap: 4px;
  animation: ntf-pop .15s ease;
}
.ntf-delete-confirm-text {
  font-size: 12px; font-weight: 600;
  color: var(--ct-ef4444, #ef4444); white-space: nowrap;
}

.ntf-btn {
  padding: 8px 14px; border-radius: 9px; border: 1px solid var(--c-e5e7eb, #e5e7eb);
  background: var(--c-ffffff, #ffffff); color: var(--ct-374151, #374151);
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.ntf-btn:disabled { opacity: .5; cursor: not-allowed; }
.ntf-btn-primary { background: var(--c-2563eb, #2563eb); border-color: var(--c-2563eb, #2563eb); color: #fff; }
.ntf-btn-danger { background: var(--c-ef4444, #ef4444); border-color: var(--c-ef4444, #ef4444); color: #fff; }
.ntf-btn-danger:hover { background: var(--c-dc2626, #dc2626); }

/* ── Multi-select / bulk delete ── */
.ntf-bulkbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; margin-bottom: 10px; background: var(--c-f8fafc, #f8fafc); border: 1px solid var(--c-e2e8f0, #e2e8f0); border-radius: 10px; flex-wrap: wrap; }
.ntf-bulkbar-selectall { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ct-475569, #475569); cursor: pointer; user-select: none; }
.ntf-bulkbar-selectall input, .ntf-select input { width: 16px; height: 16px; accent-color: var(--c-2563eb, #2563eb); cursor: pointer; }
.ntf-select { display: flex; align-items: center; padding: 0 0 0 12px; cursor: pointer; }
.ntf-card-selected { outline: 2px solid var(--c-93c5fd, #93c5fd); outline-offset: -2px; background: var(--c-eff6ff, #eff6ff); }

.ntf-pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 20px; }
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