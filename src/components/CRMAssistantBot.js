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

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────────── */}
      <div className={`crm-bot-panel ${open ? 'crm-bot-panel--open' : ''}`}>

        {/* Header */}
        <div className="crm-bot-header">
          <div className="crm-bot-header-left">
            <div className="crm-bot-avatar-sm">🤖</div>
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

      {/* ── FAB ───────────────────────────────────────────────────────── */}
      <button
        className={`crm-bot-fab ${open ? 'crm-bot-fab--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="CRM Assistant"
        aria-label="Toggle CRM Assistant"
      >
        {open ? <FaTimes size={20} /> : '🤖'}
      </button>
    </>
  );
}