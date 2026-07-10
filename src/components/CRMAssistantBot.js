/**
 * CRMAssistantBot.js (v9 — role-gated: SUPERADMIN & ADMIN only)
 * ──────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaMicrophone, FaMicrophoneSlash,
  FaVolumeUp, FaVolumeMute,
  FaPaperPlane, FaRedo, FaTimes,
  FaEdit, FaCopy, FaCheck, FaBan,
} from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import '../components_css/CRMAssistantBot.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
// Switched back to the Java backend's Groq pipeline (AiController → GroqClient).
// The Node MCP server (:3001, Claude-based) is no longer used — its API limit was reached.
// const MCP_SERVER = process.env.REACT_APP_MCP_URL || 'http://localhost:3001';
// ─── Roles allowed to see the bot ────────────────────────────────────────────
const ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN'];

// ─── Speech ──────────────────────────────────────────────────────────────────
const canSpeak  = typeof window !== 'undefined' && 'speechSynthesis' in window;
const canListen = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

function speak(text, muted = true) {
  if (!canSpeak || muted) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\*\*/g, '').replace(/[*_#>`]/g, '').replace(/\n+/g, '. ');
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 1; utt.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const eng = voices.find(v => v.lang.startsWith('en'));
  if (eng) utt.voice = eng;
  window.speechSynthesis.speak(utt);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(d) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function renderText(text) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const nodes = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
    return <span key={i}>{nodes}{i < arr.length - 1 && <br />}</span>;
  });
}

const ROLE_COLORS = {
  SUPERADMIN: '#7c3aed', ADMIN: '#2563eb',
  BD_MANAGER: '#10b981', SALES_MANAGER: '#10b981',
  BD_EXECUTIVE: '#f59e0b', SALES_EXEC: '#f59e0b', TELECALLER: '#6b7280',
};
const roleColor = r => ROLE_COLORS[r?.toUpperCase()] || '#0b63d6';

const SUGGESTIONS = {
  SUPERADMIN:    ['What is my name?', 'How many leads?', 'Total projects in progress', 'Top performing user', 'Active users'],
  ADMIN:         ['What is my name?', 'How many leads?', 'Total invoices', 'Active users'],
  BD_MANAGER:    ['My leads', 'Pending follow-ups', 'Total customers', 'Proposals this month'],
  SALES_MANAGER: ['My leads', 'Pending follow-ups', 'Total customers'],
  BD_EXECUTIVE:  ['What is my name?', 'My leads', 'Follow-ups due today', 'Pending leads'],
  SALES_EXEC:    ['My leads', 'Follow-ups due today'],
  TELECALLER:    ['What is my name?', 'My assigned leads', 'Follow-ups due today'],
};
const getSuggestions = r => SUGGESTIONS[r?.toUpperCase()] || ['What can you help me with?'];

// ─── Bot icon (chat bubble + AI sparkle) ─────────────────────────────────────
// Matches what the bot actually does: an AI chat assistant for the CRM.
function BotIcon({ size = 26, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* chat bubble */}
      <path
        d="M12 3C7.03 3 3 6.58 3 11c0 2.08.9 3.97 2.37 5.39-.1 1.1-.46 2.26-1.2 3.21-.15.2 0 .48.25.45 1.63-.16 3.02-.79 4.05-1.44C9.55 18.86 10.75 19 12 19c4.97 0 9-3.58 9-8s-4.03-8-9-8Z"
        fill={color} fillOpacity="0.95"
      />
      {/* AI sparkle */}
      <path
        d="M12 6.6l1.02 2.58L15.6 10.2l-2.58 1.02L12 13.8l-1.02-2.58L8.4 10.2l2.58-1.02L12 6.6Z"
        fill="#0b63d6"
      />
      <circle cx="16.6" cy="7.4" r="1" fill="#0b63d6" opacity="0.85" />
    </svg>
  );
}

// ─── FAB position persistence ────────────────────────────────────────────────
const FAB_STORAGE_KEY = 'crmBotFab_v1';
const FAB_SIZE = 52;
const FAB_MARGIN = 16;

function loadFabState() {
  try {
    const raw = localStorage.getItem(FAB_STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if ((s.side === 'left' || s.side === 'right') && typeof s.top === 'number') {
        return { side: s.side, top: s.top, hidden: !!s.hidden };
      }
    }
  } catch { /* ignore */ }
  return { side: 'right', top: (typeof window !== 'undefined' ? window.innerHeight : 800) - FAB_SIZE - 28, hidden: false };
}

function saveFabState(s) {
  try { localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

const clampFabTop = top =>
  Math.min(Math.max(top, FAB_MARGIN), (window.innerHeight || 800) - FAB_SIZE - FAB_MARGIN);

// ─── Component ────────────────────────────────────────────────────────────────
export default function CRMAssistantBot() {
  const { user, menuPermissions, pagePermissions, visibleRoles, isAuthenticated } = useAuth();

  const [open,         setOpen]         = useState(false);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [muted,        setMuted]        = useState(true);   // muted by default
  const [editingId,    setEditingId]    = useState(null);  // index of message being edited
  const [editText,     setEditText]     = useState('');    // live text in the edit textarea
  const [copiedId,     setCopiedId]     = useState(null);  // index of recently copied message
  const [listening,    setListening]    = useState(false);

  // ── FAB drag / dock / hide state ──────────────────────────────────────────
  const [fab, setFab] = useState(loadFabState);           // { side, top, hidden }
  const [dragging, setDragging] = useState(false);        // true only while actually moving
  const [dragPos, setDragPos] = useState(null);           // { x, y } live position while dragging
  const dragRef = useRef(null);                            // live drag data
  const fabBtnRef = useRef(null);

  // Keep the FAB inside the viewport when the window resizes.
  useEffect(() => {
    const onResize = () => setFab(f => {
      const next = { ...f, top: clampFabTop(f.top) };
      saveFabState(next);
      return next;
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onFabPointerDown = e => {
    // Left button / touch only
    if (e.button !== undefined && e.button !== 0) return;
    const point = e.touches ? e.touches[0] : e;
    const rect = fabBtnRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: point.clientX, startY: point.clientY,
      offsetX: point.clientX - rect.left, offsetY: point.clientY - rect.top,
      x: rect.left, y: rect.top,
      moved: false,
    };

    const onMove = ev => {
      const p = ev.touches ? ev.touches[0] : ev;
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved && Math.hypot(p.clientX - d.startX, p.clientY - d.startY) < 6) return; // click tolerance
      if (!d.moved) { d.moved = true; setDragging(true); }
      if (ev.cancelable) ev.preventDefault();
      d.x = Math.min(Math.max(p.clientX - d.offsetX, 0), window.innerWidth - FAB_SIZE);
      d.y = clampFabTop(p.clientY - d.offsetY);
      // Follow the pointer via state — React re-renders the wrapper at d.x/d.y
      setDragPos({ x: d.x, y: d.y });
    };

    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      if (d && d.moved) {
        // Snap to the nearest screen edge and persist
        const side = (d.x + FAB_SIZE / 2) < window.innerWidth / 2 ? 'left' : 'right';
        const top = clampFabTop(d.y);
        setDragging(false);
        setDragPos(null);
        setFab(f => {
          const next = { ...f, side, top };
          saveFabState(next);
          return next;
        });
      } else {
        // No movement → treat as a normal click (toggle the panel)
        setOpen(o => !o);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const hideBot = e => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
    setFab(f => { const next = { ...f, hidden: true }; saveFabState(next); return next; });
  };

  const showBot = () => {
    setFab(f => { const next = { ...f, hidden: false }; saveFabState(next); return next; });
  };

  const conversationRef = useRef([]);
  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);
  const recognitionRef  = useRef(null);
  const initialized     = useRef(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);
  useEffect(() => { if (canSpeak) window.speechSynthesis.getVoices(); }, []);

  // ── Greeting ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || initialized.current || !user) return;
    initialized.current = true;
    conversationRef.current = [];
    const greeting =
      `Hello, **${user.name}** 👋\n\n` +
      `I'm your CRM assistant. I can help with:\n` +
      `• Leads, follow-ups & customers\n` +
      `• Invoices, orders & payments\n` +
      `• Vendors, purchase orders & bills\n` +
      `• Tasks, projects & inventory\n` +
      `• How-to guidance for this app\n\n` +
      `Ask me anything, or use my voice 🎤 to talk to me.`;
    // setMessages([{ role: 'assistant', text: greeting, time: new Date() }]);
    // speak(greeting, muted);
  }, [open, user, muted]);

  // ── Voice input ───────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!canListen || listening) return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = 'en-IN'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = e => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onerror  = () => setListening(false);
    rec.onend    = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // ── Build userContext from localStorage ───────────────────────────────────
  function buildUserContext() {
    if (!user) return null;
    return {
      name:        user.name        || null,
      email:       user.email       || null,
      phone:       user.phone       || null,
      role:        user.role        || null,
      userId:      String(user.id   || ''),
      designation: user.designation || null,
      team:        user.team        || null,
    };
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg = { role: 'user', text: userText, time: new Date() };
    setMessages(prev => [...prev, userMsg]);

    conversationRef.current = [
      ...conversationRef.current,
      { role: 'user', content: userText },
    ];

    setLoading(true);

    try {
      const body = {
        messages:        conversationRef.current,

        // Layer 1: page/module access (menu-level)
        menuPermissions: menuPermissions || [],

        // Layer 2: CRUD operation access (within a module)
        pagePermissions: pagePermissions || {},

        // Layer 3: hierarchy team visibility (canSeeRoles from role_hierarchy)
        visibleRoles: visibleRoles || [],

        // Personal context: who is the logged-in user
        userContext: buildUserContext(),
      };

      const res = await fetch(`${API_BASE}/ai-assistant/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'User-Id':   String(user.id),
          'User-Role': String(user.role),
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) { window.dispatchEvent(new Event('session-expired')); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data  = await res.json();
      const reply = data.reply || "Sorry, I couldn't process that.";

      setMessages(prev => [...prev, { role: 'assistant', text: reply, time: new Date() }]);
      speak(reply, muted);

      conversationRef.current = [
        ...conversationRef.current,
        { role: 'assistant', content: reply },
      ];
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', text: '⚠️ Something went wrong. Please try again.', time: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, user, menuPermissions, pagePermissions, visibleRoles, muted]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Edit handlers ─────────────────────────────────────────────────────
  function startEdit(i, text) {
    setEditingId(i);
    setEditText(text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit(i) {
    const newText = editText.trim();
    if (!newText) return;
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, text: newText } : m));
    setEditingId(null);
    setEditText('');
    await sendMessage(newText);
  }

  function copyMessage(i, text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(i);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  function clearChat() {
    initialized.current = false;
    conversationRef.current = [];
    setMessages([]);
    setInput('');
    window.speechSynthesis?.cancel();
  }

  // ── Role gate — only SUPERADMIN and ADMIN may see the bot ─────────────────
  if (!isAuthenticated || !user) return null;
  if (!ALLOWED_ROLES.includes(user.role?.toUpperCase())) return null;

  const accent = roleColor(user.role);
  const suggestions = getSuggestions(user.role);
  const showSuggestions = messages.length === 1 && !loading;

  // ── Position the panel anchored to wherever the FAB currently sits ────────
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const panelH = Math.min(560, vh - 120);            // matches .crm-bot-panel height/max-height
  const maxBottom = Math.max(12, vh - panelH - 16);  // keep panel fully on screen
  const panelBottom = Math.min(Math.max(12, vh - fab.top + 12), maxBottom);
  const panelStyle = {
    [fab.side]: 28,
    left: fab.side === 'left' ? 28 : undefined,
    right: fab.side === 'right' ? 28 : undefined,
    bottom: panelBottom,
  };

  // ── Hidden state → only show a slim docked "restore" tab ──────────────────
  if (fab.hidden) {
    return (
      <button
        onClick={showBot}
        title="Show CRM Assistant"
        aria-label="Show CRM Assistant"
        style={{
          position: 'fixed', top: fab.top + 8, [fab.side]: 0, zIndex: 1200,
          width: 26, height: 44, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #0b63d6, #0952b8)', color: '#fff',
          borderRadius: fab.side === 'right' ? '10px 0 0 10px' : '0 10px 10px 0',
          boxShadow: '0 2px 12px rgba(11,99,214,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, opacity: 0.85, transition: 'opacity 0.15s, width 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.width = '32px'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.width = '26px'; }}
      >
        <BotIcon size={16} />
      </button>
    );
  }

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────────── */}
      <div className={`crm-bot-panel ${open ? 'crm-bot-panel--open' : ''}`} style={panelStyle}>

        {/* Header */}
        <div className="crm-bot-header">
          <div className="crm-bot-header-left">
            <div className="crm-bot-avatar-sm"><BotIcon size={18} /></div>
            <div>
              <div className="crm-bot-header-title">CRM Assistant</div>
              <div className="crm-bot-header-sub">● Online</div>
            </div>
          </div>
          <div className="crm-bot-header-actions">
            <button
              className="crm-bot-icon-btn"
              title={muted ? 'Unmute voice' : 'Mute voice'}
              onClick={() => { setMuted(m => !m); if (!muted) window.speechSynthesis?.cancel(); }}
            >
              {muted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
            </button>
            <button className="crm-bot-icon-btn" title="Clear conversation" onClick={clearChat}>
              <FaRedo size={13} />
            </button>
            <button className="crm-bot-icon-btn" title="Close" onClick={() => setOpen(false)}>
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        {/* User pill */}
        <div className="crm-bot-user-pill">
          <span className="crm-bot-user-dot" style={{ background: accent }} />
          <span className="crm-bot-user-name">{user.name}</span>
          <span className="crm-bot-user-role" style={{ color: accent }}>{user.role}</span>
        </div>

        {/* Messages */}
        <div className="crm-bot-messages">
          {messages.map((m, i) => (
            <div key={i} className={`crm-bot-msg-row crm-bot-msg-row--${m.role}`}>
              {/* ── USER message: show edit textarea OR bubble ── */}
              {m.role === 'user' && editingId === i ? (
                <div className="crm-bot-edit-wrap">
                  <textarea
                    className="crm-bot-edit-area"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(i); }
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                    rows={3}
                  />
                  <div className="crm-bot-edit-actions">
                    <button className="crm-bot-edit-save" onClick={() => saveEdit(i)}
                      title="Save & search">
                      <FaCheck size={11} /> Save
                    </button>
                    <button className="crm-bot-edit-cancel" onClick={cancelEdit}
                      title="Cancel edit">
                      <FaBan size={11} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`crm-bot-bubble crm-bot-bubble--${m.role}`}>
                    {renderText(m.text)}
                  </div>

                  {/* Edit + Copy shown only on user messages */}
                  {m.role === 'user' && !loading && (
                    <div className="crm-bot-msg-actions">
                      <button className="crm-bot-msg-action-btn" title="Edit message"
                        onClick={() => startEdit(i, m.text)}>
                        <FaEdit size={11} />
                      </button>
                      <button className="crm-bot-msg-action-btn" title="Copy message"
                        onClick={() => copyMessage(i, m.text)}>
                        {copiedId === i ? <FaCheck size={11} style={{color:'#10b981'}}/> : <FaCopy size={11} />}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Assistant: voice replay */}
              {m.role === 'assistant' && editingId === null && (
                <button
                  className="crm-bot-replay-btn"
                  title="Play voice"
                  onClick={() => speak(m.text, false)}
                >
                  <FaVolumeUp size={11} />
                </button>
              )}

              {editingId !== i && (
                <div className="crm-bot-time">{formatTime(m.time)}</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="crm-bot-msg-row crm-bot-msg-row--assistant">
              <div className="crm-bot-bubble crm-bot-bubble--assistant crm-bot-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {showSuggestions && (
            <div className="crm-bot-suggestions">
              <div className="crm-bot-suggestions-label">Try asking…</div>
              <div className="crm-bot-suggestions-chips">
                {suggestions.map((s, i) => (
                  <button key={i} className="crm-bot-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="crm-bot-input-row">
          <textarea
            ref={inputRef}
            className="crm-bot-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? '🎤 Listening…' : 'Have a Question?'}
            rows={1}
          />

          {canListen && (
            <button
              className={`crm-bot-icon-btn crm-bot-mic-btn ${listening ? 'crm-bot-mic-btn--active' : ''}`}
              onClick={listening ? stopListening : startListening}
              title={listening ? 'Stop listening' : 'Speak your question'}
            >
              {listening ? <FaMicrophoneSlash size={15} /> : <FaMicrophone size={15} />}
            </button>
          )}

          <button
            className="crm-bot-send"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            title="Send (Enter)"
          >
            {loading ? '⏳' : <FaPaperPlane size={14} />}
          </button>
        </div>
      </div>

      {/* ── FAB (draggable, snaps to edges, position remembered) ─────── */}
      <div
        style={
          dragging && dragPos
            ? { position: 'fixed', zIndex: 1200, top: dragPos.y, left: dragPos.x, right: 'auto' }
            : {
                position: 'fixed', zIndex: 1200,
                top: fab.top,
                left: fab.side === 'left' ? 28 : 'auto',
                right: fab.side === 'right' ? 28 : 'auto',
              }
        }
        ref={fabBtnRef}
        className="crm-bot-fab-wrap"
      >
        <button
          className={`crm-bot-fab ${open ? 'crm-bot-fab--active' : ''} ${dragging ? 'crm-bot-fab--dragging' : ''}`}
          onMouseDown={onFabPointerDown}
          onTouchStart={onFabPointerDown}
          title={dragging ? '' : 'CRM Assistant — drag to move'}
          aria-label="Toggle CRM Assistant"
          style={{
            position: 'static',
            cursor: dragging ? 'grabbing' : 'pointer',
            transition: dragging ? 'none' : undefined,
          }}
        >
          {open ? <FaTimes size={20} /> : <BotIcon size={28} />}
        </button>

        {/* Hide (✕) badge — appears on hover */}
        {!open && !dragging && (
          <button
            className="crm-bot-hide-badge"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={hideBot}
            title="Hide assistant"
            aria-label="Hide assistant"
          >
            <FaTimes size={9} />
          </button>
        )}
      </div>
    </>
  );
}