// src/components/Notifications/NotificationDrawer.js
//
// Presentation only. Every piece of behaviour — fetching, unread count, realtime
// STOMP updates, mark-as-read, delete — comes from useNotifications(), which is
// untouched. This component renders what the context already holds and calls the
// handlers the context already exposes.
//
// Modelled on a shadcn/ui drawer, built with the project's own CSS conventions
// because the app has no Tailwind or shadcn installed. Same behaviour: right
// slide-in, overlay, ESC to close, scroll lock, focus trap.

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, Check, CheckCheck, Trash2, RefreshCw, AlertCircle, Wifi, WifiOff,
  UserPlus, ClipboardList, CalendarClock, FileText, Receipt,
} from 'lucide-react';
import { useNotifications, MODULE_META, timeAgo } from './NotificationPage';
import '../../components_css/Notifications/NotificationDrawer.css';

/**
 * Per-module icon. Notifications carry no user, so an avatar image would be
 * invented data — the module is the real distinguishing attribute, so the
 * avatar slot shows its icon in the module's colour instead.
 */
const MODULE_ICON = {
  LEAD: UserPlus,
  TASK: ClipboardList,
  FOLLOWUP: CalendarClock,
  INVOICE: FileText,
  EXPENSE: Receipt,
};

/** Two-letter fallback when a module has no icon mapped. */
const initialsOf = (n) => {
  const src = (MODULE_META[n.module]?.label || n.module || n.title || '?').trim();
  const parts = src.split(/[\s-]+/).filter(Boolean);
  return (parts.length > 1
    ? parts[0][0] + parts[1][0]
    : src.slice(0, 2)).toUpperCase();
};

/* ── one row ──────────────────────────────────────────────────────────── */

const NotificationRow = memo(function NotificationRow({ n, onOpen, onMarkRead, onDelete }) {
  const meta = MODULE_META[n.module] || { label: n.module, color: '#2563eb' };
  const Icon = MODULE_ICON[n.module];
  const unread = !n.isRead;

  return (
    <li
      className={`ntfd-item ${unread ? 'ntfd-item-unread' : ''}`}
      // The colour drives the accent bar, avatar tint and unread dot, so it is
      // set once here as a custom property rather than on three elements.
      style={{ '--ntfd-accent': meta.color }}
    >
      <button
        type="button"
        className="ntfd-item-main"
        onClick={() => onOpen(n)}
        aria-label={`${meta.label}: ${n.title}${unread ? ' (unread)' : ''}`}
      >
        <span className="ntfd-avatar" aria-hidden="true">
          {Icon ? <Icon size={16} /> : <span className="ntfd-initials">{initialsOf(n)}</span>}
        </span>

        <span className="ntfd-item-body">
          <span className="ntfd-item-top">
            <span className="ntfd-chip">{meta.label}</span>
            <span className="ntfd-time">{timeAgo(n.createdAt)}</span>
          </span>
          <span className="ntfd-title">{n.title}</span>
          <span className="ntfd-msg">{n.message}</span>
        </span>

        {unread && <span className="ntfd-dot" aria-hidden="true" />}
      </button>

      {/* Revealed on hover and on keyboard focus — hover alone would put these
          out of reach for anyone navigating by keyboard. */}
      <span className="ntfd-item-actions">
        {unread && (
          <button
            type="button"
            className="ntfd-icon-btn"
            title="Mark as read"
            aria-label={`Mark "${n.title}" as read`}
            onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
          >
            <Check size={14} />
          </button>
        )}
        <button
          type="button"
          className="ntfd-icon-btn ntfd-icon-danger"
          title="Delete"
          aria-label={`Delete "${n.title}"`}
          onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        >
          <Trash2 size={14} />
        </button>
      </span>
    </li>
  );
});

/* ── skeleton while a refresh is in flight ────────────────────────────── */

const NotificationSkeleton = () => (
  <li className="ntfd-item ntfd-skel" aria-hidden="true">
    <span className="ntfd-skel-avatar" />
    <span className="ntfd-skel-body">
      <span className="ntfd-skel-line ntfd-skel-sm" />
      <span className="ntfd-skel-line ntfd-skel-lg" />
      <span className="ntfd-skel-line ntfd-skel-md" />
    </span>
  </li>
);

/* ── drawer ───────────────────────────────────────────────────────────── */

export default function NotificationDrawer({ open, onClose }) {
  const {
    latest, unreadCount, connected, refresh, markRead, markAllRead, remove,
  } = useNotifications();

  const navigate = useNavigate();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* Pull fresh data whenever the drawer opens. The provider already keeps the
     list current over STOMP; this covers the case where the socket dropped
     while the drawer was closed. */
  const reload = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await refresh();
    } catch (e) {
      setError(e?.message || 'Could not load notifications.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  /* Lock background scrolling. Compensating for the scrollbar width stops the
     page shifting sideways as it disappears. */
  useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open]);

  /* ESC to close, and a focus trap so Tab cycles within the panel. */
  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current = document.activeElement;
    const t = setTimeout(() => closeRef.current?.focus(), 60);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      // Return focus to the bell so keyboard users don't land at the page top.
      if (restoreFocusRef.current?.focus) restoreFocusRef.current.focus();
    };
  }, [open, onClose]);

  /* Opening an item marks it read, then goes to the full page — same contract
     the previous dropdown had, using the same handlers. */
  const handleOpen = useCallback((n) => {
    if (!n.isRead) markRead(n.id);
    onClose();
    navigate('/notifications');
  }, [markRead, navigate, onClose]);

  const handleMarkRead = useCallback((id) => markRead(id), [markRead]);
  const handleDelete = useCallback((id) => remove(id), [remove]);

  const handleViewAll = useCallback(() => {
    onClose();
    navigate('/notifications');
  }, [navigate, onClose]);

  const items = useMemo(() => latest || [], [latest]);
  const showSkeleton = busy && items.length === 0;

  if (!open) return null;

  return (
    <div className="ntfd-root">
      <div
        className="ntfd-overlay"
        onMouseDown={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className="ntfd-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ntfd-heading"
      >
        <header className="ntfd-head">
          <div className="ntfd-head-title">
            <h2 id="ntfd-heading" className="ntfd-heading">Notifications</h2>
            {unreadCount > 0 && (
              <span className="ntfd-count" aria-label={`${unreadCount} unread`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          <div className="ntfd-head-actions">
            <span
              className={`ntfd-conn ${connected ? 'ntfd-conn-on' : 'ntfd-conn-off'}`}
              title={connected ? 'Live updates connected' : 'Live updates disconnected'}
            >
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            </span>
            <button
              type="button"
              className="ntfd-icon-btn"
              onClick={reload}
              disabled={busy}
              title="Refresh"
              aria-label="Refresh notifications"
            >
              <RefreshCw size={15} className={busy ? 'ntfd-spin' : ''} />
            </button>
            <button
              ref={closeRef}
              type="button"
              className="ntfd-icon-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close notifications"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        {unreadCount > 0 && (
          <div className="ntfd-toolbar">
            <button type="button" className="ntfd-link" onClick={() => markAllRead()}>
              <CheckCheck size={14} />
              Mark all as read
            </button>
          </div>
        )}

        <div className="ntfd-body">
          {error && (
            <div className="ntfd-state" role="alert">
              <AlertCircle size={26} className="ntfd-state-icon ntfd-state-danger" />
              <p className="ntfd-state-title">Couldn't load notifications</p>
              <p className="ntfd-state-text">{error}</p>
              <button type="button" className="ntfd-btn" onClick={reload}>
                <RefreshCw size={14} />
                Try again
              </button>
            </div>
          )}

          {!error && showSkeleton && (
            <ul className="ntfd-list">
              {[0, 1, 2, 3, 4].map((i) => <NotificationSkeleton key={i} />)}
            </ul>
          )}

          {!error && !showSkeleton && items.length === 0 && (
            <div className="ntfd-state">
              <Bell size={28} className="ntfd-state-icon" />
              <p className="ntfd-state-title">No notifications</p>
              <p className="ntfd-state-text">You are all caught up.</p>
            </div>
          )}

          {!error && !showSkeleton && items.length > 0 && (
            <ul className="ntfd-list">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onOpen={handleOpen}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="ntfd-foot">
          <button type="button" className="ntfd-btn ntfd-btn-block" onClick={handleViewAll}>
            View all notifications
          </button>
        </footer>
      </aside>
    </div>
  );
}