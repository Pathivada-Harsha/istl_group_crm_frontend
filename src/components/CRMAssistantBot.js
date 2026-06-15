/**
 * CRMAssistantBot.js  (v3 — login permissions + voice + image search)
 * ─────────────────────────────────────────────────────────────────────
 * Changes from v2:
 *  1. Permissions: reads menuPermissions + pagePermissions directly from
 *     AuthContext (set at login via /login/userLogin). These are sent to
 *     the backend with every chat request — no more DB lookups per message.
 *
 *  2. Voice output: every assistant reply is spoken aloud via Web Speech API
 *     (SpeechSynthesis). Mute toggle in the header.
 *
 *  3. Voice input: microphone button (SpeechRecognition) for hands-free
 *     questions. Falls back gracefully on unsupported browsers.
 *
 *  4. Image upload: camera/file button sends image as base64 to the backend
 *     alongside the text question (e.g. "What lead is this?" + screenshot).
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import '../components_css/CRMAssistantBot.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// ─── Speech helpers ───────────────────────────────────────────────────────────
const canSpeak   = typeof window !== 'undefined' && 'speechSynthesis' in window;
const canListen  = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

function speak(text, { muted = false, rate = 1, pitch = 1 } = {}) {
  if (!canSpeak || muted) return;
  window.speechSynthesis.cancel();
  // Strip markdown-ish symbols so TTS doesn't read "asterisk asterisk"
  const clean = text
    .replace(/\*\*/g, '')
    .replace(/[*_#>`]/g, '')
    .replace(/\n+/g, '. ');
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate  = rate;
  utt.pitch = pitch;
  // Prefer an English voice if available
  const voices = window.speechSynthesis.getVoices();
  const eng = voices.find(v => v.lang.startsWith('en'));
  if (eng) utt.voice = eng;
  window.speechSynthesis.speak(utt);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function renderText(text) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const nodes = parts.map((p, j) =>
      j % 2 === 1 ? <strong key={j}>{p}</strong> : p
    );
    return <span key={i}>{nodes}{i < arr.length - 1 && <br />}</span>;
  });
}

const ROLE_COLORS = {
  SUPERADMIN:    '#7c3aed',
  ADMIN:         '#2563eb',
  BD_MANAGER:    '#10b981',
  SALES_MANAGER: '#10b981',
  BD_EXECUTIVE:  '#f59e0b',
  SALES_EXEC:    '#f59e0b',
  TELECALLER:    '#6b7280',
};
const roleColor = (role) => ROLE_COLORS[role?.toUpperCase()] || '#0b63d6';

// Role-aware suggestions
const SUGGESTIONS = {
  SUPERADMIN:    ['How many leads?', 'Pending follow-ups today', 'Total order book value', 'Active projects', 'Top performing user'],
  ADMIN:         ['How many leads?', 'Pending follow-ups today', 'Total invoices', 'Active users', 'Top performing user'],
  BD_MANAGER:    ['Show hot leads', 'Pending follow-ups', 'Total customers', 'Proposals sent this month'],
  SALES_MANAGER: ['Show hot leads', 'Pending follow-ups', 'Total customers', 'Proposals sent this month'],
  BD_EXECUTIVE:  ['My leads', 'Follow-ups due today', 'Pending leads'],
  SALES_EXEC:    ['My leads', 'Follow-ups due today', 'Pending leads'],
  TELECALLER:    ['My assigned leads', 'Follow-ups due today'],
};
const getSuggestions = (role) => SUGGESTIONS[role?.toUpperCase()] || ['What can you help me with?'];

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CRMAssistantBot() {
  const { user, menuPermissions, pagePermissions, isAuthenticated } = useAuth();

  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [listening,  setListening]  = useState(false);
  const [imageFile,  setImageFile]  = useState(null);   // File object
  const [imagePreview, setImagePreview] = useState(null); // data URL for preview

  const conversationRef = useRef([]);
  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);
  const fileInputRef    = useRef(null);
  const recognitionRef  = useRef(null);
  const initialized     = useRef(false);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Focus input when panel opens ─────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // ── Preload voices (Chrome needs this) ───────────────────────────────────
  useEffect(() => {
    if (canSpeak) window.speechSynthesis.getVoices();
  }, []);

  // ── Greeting on first open ───────────────────────────────────────────────
  useEffect(() => {
    if (!open || initialized.current || !user) return;
    initialized.current = true;
    conversationRef.current = [];

    const greeting = `Hello, **${user.name}** 👋\n\nI'm your CRM assistant. Ask me anything — I can also hear you 🎤 or read images 📷.`;
    setMessages([{ role: 'assistant', text: greeting, time: new Date() }]);
    speak(greeting, { muted });
  }, [open, user, muted]);

  // ── Speech recognition setup ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!canListen || listening) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // ── Image selection ───────────────────────────────────────────────────────
  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    e.target.value = '';
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if ((!userText && !imageFile) || loading) return;
    setInput('');

    // Build display text
    const displayText = userText || (imageFile ? '📷 Image sent' : '');
    const userMsg = { role: 'user', text: displayText, time: new Date(), hasImage: !!imageFile, imagePreview };
    setMessages(prev => [...prev, userMsg]);

    // Build conversation history entry
    conversationRef.current = [
      ...conversationRef.current,
      { role: 'user', content: userText || 'Please analyse this image and answer based on the CRM data.' },
    ];

    // Capture image before clearing
    const imageToSend = imageFile;
    clearImage();
    setLoading(true);

    try {
      // Build request body
      const body = {
        messages: conversationRef.current,
        // Pass login-time permissions so backend can use them directly
        menuPermissions:  menuPermissions  || [],
        pagePermissions:  pagePermissions  || {},
      };

      // Attach image as base64 if present
      if (imageToSend) {
        body.imageBase64 = await fileToBase64(imageToSend);
        body.imageMimeType = imageToSend.type;
        body.imageFileName = imageToSend.name;
      }

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

      if (res.status === 401) {
        window.dispatchEvent(new Event('session-expired'));
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't process that.";

      setMessages(prev => [...prev, { role: 'assistant', text: reply, time: new Date() }]);
      speak(reply, { muted });

      conversationRef.current = [
        ...conversationRef.current,
        { role: 'assistant', content: reply },
      ];
    } catch {
      const err = '⚠️ Something went wrong. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', text: err, time: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, imageFile, imagePreview, user, menuPermissions, pagePermissions, muted]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    initialized.current = false;
    conversationRef.current = [];
    setMessages([]);
    setInput('');
    clearImage();
    window.speechSynthesis?.cancel();
  }

  if (!isAuthenticated || !user) return null;

  const accent = roleColor(user.role);
  const suggestions = getSuggestions(user.role);
  const showSuggestions = messages.length === 1 && !loading;

  return (
    <>
      {/* ── Chat Panel ────────────────────────────────────────────────── */}
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
            {/* Mute/Unmute voice */}
            <button
              className="crm-bot-icon-btn"
              onClick={() => { setMuted(m => !m); window.speechSynthesis?.cancel(); }}
              title={muted ? 'Unmute voice' : 'Mute voice'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="crm-bot-icon-btn" onClick={clearChat} title="Clear conversation">↺</button>
            <button className="crm-bot-icon-btn" onClick={() => setOpen(false)} title="Close">✕</button>
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
              {/* Show image preview above bubble if user sent one */}
              {m.hasImage && m.imagePreview && (
                <img
                  src={m.imagePreview}
                  alt="Uploaded"
                  className="crm-bot-img-preview"
                />
              )}
              <div className={`crm-bot-bubble crm-bot-bubble--${m.role}`}>
                {renderText(m.text)}
              </div>
              {/* Replay voice button on assistant messages */}
              {m.role === 'assistant' && (
                <button
                  className="crm-bot-replay-btn"
                  onClick={() => speak(m.text, { muted: false })}
                  title="Replay voice"
                >
                  🔈
                </button>
              )}
              <div className="crm-bot-time">{formatTime(m.time)}</div>
            </div>
          ))}

          {/* Typing dots */}
          {loading && (
            <div className="crm-bot-msg-row crm-bot-msg-row--assistant">
              <div className="crm-bot-bubble crm-bot-bubble--assistant crm-bot-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && (
            <div className="crm-bot-suggestions">
              <div className="crm-bot-suggestions-label">Try asking…</div>
              <div className="crm-bot-suggestions-chips">
                {suggestions.map((s, i) => (
                  <button key={i} className="crm-bot-chip" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Image preview strip */}
        {imagePreview && (
          <div className="crm-bot-img-strip">
            <img src={imagePreview} alt="To send" className="crm-bot-img-thumb" />
            <span className="crm-bot-img-name">{imageFile?.name}</span>
            <button className="crm-bot-img-remove" onClick={clearImage} title="Remove image">✕</button>
          </div>
        )}

        {/* Input row */}
        <div className="crm-bot-input-row">
          {/* Image upload */}
          <button
            className="crm-bot-icon-btn crm-bot-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
            📷
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />

          {/* Text input */}
          <textarea
            ref={inputRef}
            className="crm-bot-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? '🎤 Listening…' : 'Ask about leads, invoices, projects…'}
            rows={1}
          />

          {/* Mic button */}
          {canListen && (
            <button
              className={`crm-bot-icon-btn crm-bot-mic-btn ${listening ? 'crm-bot-mic-btn--active' : ''}`}
              onClick={listening ? stopListening : startListening}
              title={listening ? 'Stop listening' : 'Speak your question'}
            >
              🎤
            </button>
          )}

          {/* Send */}
          <button
            className="crm-bot-send"
            onClick={() => sendMessage()}
            disabled={loading || (!input.trim() && !imageFile)}
            title="Send (Enter)"
          >
            {loading ? '⏳' : '↑'}
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
        {open ? '✕' : '🤖'}
      </button>
    </>
  );
}
