// src/Pages/Profile.jsx
import React, { useState, useRef, useEffect } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "../pages-css/Profile.css";
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = process.env.REACT_APP_API_URL;

function buildAvatarUrl(userId, flag, cacheBust) {
  if (!flag || flag !== 'db') return null;
  // cacheBust timestamp forces the browser to re-fetch after every upload
  return `${API_BASE_URL}/users/avatar/${userId}?t=${cacheBust}`;
}

// Detect mobile/tablet by touch support + screen width
function isMobileDevice() {
  return (typeof window !== 'undefined') &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.innerWidth <= 1024;
}

export default function Profile() {
  const { user: authUser, login, refreshAvatarTs } = useAuth();

  const initialUser = {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    phone: authUser.phone,
    role: authUser.role.toUpperCase(),
    joined: authUser.created_at,
    lastLogin: authUser.last_login_at,
    avatarFlag: authUser.avatar_url || null,
  };

  const [user, setUser]                       = useState(initialUser);
  const [editing, setEditing]                 = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  // Cache-bust timestamp — updated every time a new photo is saved
  const [avatarCacheBust, setAvatarCacheBust] = useState(() => Date.now());

  // ── Photo editor modal ───────────────────────────────────────────────────
  const [showPhotoModal, setShowPhotoModal]   = useState(false);
  // 'choose' | 'preview' | 'camera'
  const [photoModalView, setPhotoModalView]   = useState('choose');
  const [pendingFile, setPendingFile]         = useState(null);
  const [localPreview, setLocalPreview]       = useState(null);
  const fileRef = useRef();

  // ── Webcam state ─────────────────────────────────────────────────────────
  const [cameraError, setCameraError]   = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode]     = useState('user');
  const videoRef  = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);

  // Password visibility
  const [showCurrentPassword, setShowCurrentPassword]   = useState(false);
  const [showNewPassword, setShowNewPassword]           = useState(false);
  const [showConfirmPassword, setShowConfirmPassword]   = useState(false);

  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  const [profileForm, setProfileForm] = useState({
    name: user.name, email: user.email, phone: user.phone, role: user.role,
  });
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 4000);
  };
  const closeToast = () => setToast({ show: false, type: '', message: '' });

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Auth headers — NOTE: never set Content-Type for FormData (multipart) requests
  const buildAuthHeaders = () => ({
    'User-Id':   String(user.id),
    'User-Role': user.role,
  });

  function initials(name) {
    return (name || '').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }

  function updateStoredFlag(flag) {
    try {
      const raw = localStorage.getItem('bd_portal_user');
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.user) { stored.user.avatar_url = flag; login(stored); }
      }
    } catch (_) {}
  }

  // ── Photo modal: open / close ─────────────────────────────────────────────
  function openPhotoModal() {
    setPendingFile(null);
    setLocalPreview(null);
    setCameraError('');
    setIsCameraReady(false);
    setPhotoModalView('choose');
    setShowPhotoModal(true);
  }

  function closePhotoModal() {
    stopStream();
    setShowPhotoModal(false);
    setPendingFile(null);
    setLocalPreview(null);
    setCameraError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── File pick from device ─────────────────────────────────────────────────
  function handleFileSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { showToast('error', 'Image must be smaller than 10 MB.'); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(f.type)) { showToast('error', 'Only JPEG, PNG, GIF and WEBP images are allowed.'); return; }
    setPendingFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => { setLocalPreview(ev.target.result); setPhotoModalView('preview'); };
    reader.readAsDataURL(f);
  }

  // ── Camera stream ─────────────────────────────────────────────────────────
  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraReady(false);
  }

  async function startStream(mode) {
    stopStream();
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setIsCameraReady(true); };
      }
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'  ? 'Camera permission denied. Please allow camera access in your browser settings.' :
        err.name === 'NotFoundError'    ? 'No camera device found on this device.' :
        err.name === 'NotReadableError' ? 'Camera is in use by another app.' :
        'Could not access camera: ' + err.message;
      setCameraError(msg);
    }
  }

  useEffect(() => {
    if (showPhotoModal && photoModalView === 'camera') {
      startStream(facingMode);
    } else if (photoModalView !== 'camera') {
      stopStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhotoModal, photoModalView, facingMode]);

  // Cleanup stream when modal closes
  useEffect(() => {
    if (!showPhotoModal) stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhotoModal]);

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return;
    const video = videoRef.current, canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Un-mirror the capture so saved image is not flipped
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { showToast('error', 'Failed to capture photo.'); return; }
      const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPendingFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => { setLocalPreview(ev.target.result); setPhotoModalView('preview'); };
      reader.readAsDataURL(file);
      stopStream();
    }, 'image/jpeg', 0.92);
  }

  // ── Upload to backend ─────────────────────────────────────────────────────
  async function uploadAvatar() {
    if (!pendingFile) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);

      // ✅ CRITICAL: Do NOT set Content-Type header for FormData.
      //    The browser must set it automatically with the correct multipart boundary.
      //    Passing buildAuthHeaders() alone (without Content-Type) is correct here.
      const res = await fetch(`${API_BASE_URL}/users/uploadAvatar/${user.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(), // only User-Id + User-Role — NO Content-Type
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed');

      const newBust = Date.now();
      setAvatarCacheBust(newBust);          // bust Profile's own <img>
      refreshAvatarTs();                    // bust Navbar's <img> via context
      setUser((u) => ({ ...u, avatarFlag: 'db' }));
      updateStoredFlag('db');
      showToast('success', 'Profile photo updated!');
      closePhotoModal();
    } catch (err) {
      showToast('error', err.message || 'Failed to upload image.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Remove photo ──────────────────────────────────────────────────────────
  async function removeAvatar() {
    setAvatarUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/removeAvatar/${user.id}`, {
        method: 'DELETE', credentials: 'include', headers: buildAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Remove failed');
      setUser((u) => ({ ...u, avatarFlag: null }));
      updateStoredFlag(null);
      refreshAvatarTs();
      showToast('success', 'Profile photo removed.');
      closePhotoModal();
    } catch (err) {
      showToast('error', err.message || 'Failed to remove photo.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Profile save ──────────────────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    if (!profileForm.name || !profileForm.email) { showToast('error', 'Please provide name and email.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login/updateUser/${user.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name, email: profileForm.email, phone: profileForm.phone, role: profileForm.role, last_login_at: user.lastLogin }),
      });
      const txt = await res.text();
      if (res.ok) {
        setUser((u) => ({ ...u, ...profileForm }));
        const stored = JSON.parse(localStorage.getItem('bd_portal_user'));
        if (stored) { stored.user = { ...stored.user, name: profileForm.name, email: profileForm.email, phone: profileForm.phone, role: profileForm.role }; login(stored); }
        setEditing(false);
        showToast('success', 'Profile updated successfully!');
      } else { throw new Error(txt || 'Failed to update profile'); }
    } catch (err) { showToast('error', err.message || 'Failed to update profile.'); }
    finally { setLoading(false); }
  }

  // ── Password change ───────────────────────────────────────────────────────
  async function changePassword(e) {
    e.preventDefault();
    if (!pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm) { showToast('error', 'Fill all password fields.'); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { showToast('error', 'Passwords do not match.'); return; }
    if (pwdForm.newPwd.length < 6) { showToast('warning', 'Password must be at least 6 characters.'); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login/updatePassword/${user.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: pwdForm.current, newPassword: pwdForm.newPwd }),
      });
      const txt = await res.text();
      if (res.ok) {
        setPwdForm({ current: '', newPwd: '', confirm: '' });
        setShowPasswordForm(false);
        setShowCurrentPassword(false); setShowNewPassword(false); setShowConfirmPassword(false);
        showToast('success', 'Password changed successfully!');
      } else { throw new Error(txt || 'Failed to change password'); }
    } catch (err) { showToast('error', err.message || 'Failed to change password.'); }
    finally { setPasswordLoading(false); }
  }

  function cancelEdit() {
    setEditing(false);
    setProfileForm({ name: user.name, email: user.email, phone: user.phone, role: user.role });
  }

  const serverAvatarUrl = buildAvatarUrl(user.id, user.avatarFlag, avatarCacheBust);
  // In the modal preview view show the pending preview, or the saved photo, or nothing
  const modalDisplaySrc = localPreview || serverAvatarUrl;

  const onMobile = isMobileDevice();
  const uploadLabel = onMobile ? 'Upload from Mobile' : 'Upload from Computer';

  return (
    <div className="profile-user-page-root page-container">

      {/* Toast */}
      {toast.show && (
        <div className={`toast-notification toast-${toast.type}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {toast.type === 'success' && '✓'}{toast.type === 'error' && '✕'}{toast.type === 'warning' && '⚠'}
            </div>
            <div className="toast-text">
              <div className="toast-title">{toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Warning'}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
          </div>
          <button className="toast-close" onClick={closeToast}>✕</button>
        </div>
      )}

      <div className="profile-user-page-grid">

        {/* LEFT CARD */}
        <div className="profile-user-page-card card">
          <div className="profile-user-page-top">

            {/* Avatar — single "Edit Photo" hover trigger */}
            <div className="profile-avatar-section">
              <div className="profile-avatar-circle" onClick={openPhotoModal} title="Edit profile photo">
                {serverAvatarUrl ? (
                  <img src={serverAvatarUrl} alt={user.name} className="profile-user-page-avatar-img" />
                ) : (
                  <div className="profile-user-page-avatar-initials">{initials(user.name)}</div>
                )}
                <div className="profile-avatar-overlay">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Edit Photo</span>
                </div>
              </div>
            </div>

            <div className="profile-user-page-meta">
              <h2 className="profile-user-page-name">{user.name}</h2>
              <div className="profile-user-page-role">{user.role}</div>
              <div className="profile-user-page-email">{user.email}</div>
            </div>
          </div>

          <div className="profile-user-page-stats">
            <div className="profile-user-page-stat">
              <div className="profile-user-page-stat-title">Joined</div>
              <div className="profile-user-page-stat-value">{formatDateTime(user.joined)}</div>
            </div>
            <div className="profile-user-page-stat">
              <div className="profile-user-page-stat-title">Last Login</div>
              <div className="profile-user-page-stat-value">{formatDateTime(user.lastLogin)}</div>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="profile-user-page-main">
          <form className="profile-user-page-form card" onSubmit={saveProfile}>
            <div className="profile-user-page-header">
              <h3>Profile Details</h3>
              {!editing && (
                <button type="button" className="btn primary" onClick={() => setEditing(true)} disabled={loading}>Edit Profile</button>
              )}
            </div>
            <div className="profile-user-page-row">
              <label>Name</label>
              <input name="name" value={profileForm.name} onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))} disabled={!editing || loading} />
            </div>
            <div className="profile-user-page-row">
              <label>Email</label>
              <input name="email" type="email" value={profileForm.email} onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))} disabled={!editing || loading} />
            </div>
            <div className="profile-user-page-row">
              <label>Phone</label>
              <input name="phone" value={profileForm.phone} onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))} disabled={!editing || loading} />
            </div>
            {editing && (
              <div className="profile-user-page-actions-row">
                <button type="button" className="btn" onClick={cancelEdit} disabled={loading}>Cancel</button>
                <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</button>
              </div>
            )}
          </form>

          <div className="profile-user-page-password card">
            <div className="profile-user-page-header">
              <h3>Change Password</h3>
              <button type="button" className="btn primary"
                onClick={() => { setShowPasswordForm(!showPasswordForm); if (showPasswordForm) { setPwdForm({ current: '', newPwd: '', confirm: '' }); setShowCurrentPassword(false); setShowNewPassword(false); setShowConfirmPassword(false); } }}
                disabled={passwordLoading}
              >{showPasswordForm ? 'Hide' : 'Show'}</button>
            </div>
            {showPasswordForm && (
              <form onSubmit={changePassword}>
                {[
                  { label: 'Current Password', key: 'current', show: showCurrentPassword, toggle: () => setShowCurrentPassword(v => !v) },
                  { label: 'New Password', key: 'newPwd', show: showNewPassword, toggle: () => setShowNewPassword(v => !v) },
                  { label: 'Confirm New Password', key: 'confirm', show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v) },
                ].map(({ label, key, show, toggle }) => (
                  <div className="profile-user-page-row" key={key}>
                    <label>{label}</label>
                    <div className="password-input-wrapper">
                      <input type={show ? 'text' : 'password'} name={key} value={pwdForm[key]}
                        onChange={(e) => setPwdForm(p => ({ ...p, [key]: e.target.value }))}
                        onPaste={key === 'confirm' ? (e) => e.preventDefault() : undefined}
                        disabled={passwordLoading} />
                      <button type="button" className="password-toggle-btn" onClick={toggle} disabled={passwordLoading}>
                        {show ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="profile-user-page-actions-row">
                  <button type="submit" className="btn primary" disabled={passwordLoading}>{passwordLoading ? 'Changing...' : 'Change Password'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo Editor Modal ──────────────────────────────────────────────── */}
      {showPhotoModal && (
        <div className="photo-modal-overlay" onClick={closePhotoModal}>
          <div className="photo-modal" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="photo-modal-header">
              <span className="photo-modal-title">
                {photoModalView === 'camera' ? '📷 Take Photo' : photoModalView === 'preview' ? '🖼 Preview' : '✏️ Edit Profile Photo'}
              </span>
              <button type="button" className="photo-modal-close" onClick={closePhotoModal}>✕</button>
            </div>

            {/* Body */}
            <div className="photo-modal-body">

              {/* ── CHOOSE view: current photo + two action buttons ── */}
              {photoModalView === 'choose' && (
                <div className="photo-modal-choose">
                  {/* Current photo or initials placeholder */}
                  <div className="photo-modal-current">
                    {serverAvatarUrl ? (
                      <img src={serverAvatarUrl} alt={user.name} className="photo-modal-current-img" />
                    ) : (
                      <div className="photo-modal-current-initials">{initials(user.name)}</div>
                    )}
                  </div>
                  <p className="photo-modal-current-label">Current photo</p>

                  <div className="photo-modal-actions">
                    {/* Upload from device */}
                    <label className="photo-modal-action-btn" htmlFor="photo-file-input">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span>{uploadLabel}</span>
                    </label>
                    <input id="photo-file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                      style={{ display: 'none' }} ref={fileRef} onChange={handleFileSelect} />

                    {/* Camera */}
                    <button type="button" className="photo-modal-action-btn"
                      onClick={() => { setCameraError(''); setIsCameraReady(false); setPhotoModalView('camera'); }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span>Take Photo</span>
                    </button>

                    {/* Remove — only if photo exists */}
                    {user.avatarFlag === 'db' && (
                      <button type="button" className="photo-modal-action-btn photo-modal-remove-btn"
                        onClick={removeAvatar} disabled={avatarUploading}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        <span>{avatarUploading ? 'Removing…' : 'Remove Photo'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── PREVIEW view: show chosen/captured image + confirm ── */}
              {photoModalView === 'preview' && (
                <div className="photo-modal-preview">
                  <div className="photo-modal-preview-img-wrap">
                    {modalDisplaySrc && <img src={modalDisplaySrc} alt="Preview" className="photo-modal-preview-img" />}
                  </div>
                  <div className="photo-modal-preview-actions">
                    <button type="button" className="photo-modal-back-btn"
                      onClick={() => { setPendingFile(null); setLocalPreview(null); setPhotoModalView('choose'); if (fileRef.current) fileRef.current.value = ''; }}>
                      ← Choose Again
                    </button>
                    <button type="button" className="photo-modal-save-btn" onClick={uploadAvatar} disabled={avatarUploading}>
                      {avatarUploading ? (
                        <><span className="photo-modal-spinner" /> Saving…</>
                      ) : (
                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Photo</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── CAMERA view ── */}
              {photoModalView === 'camera' && (
                <div className="photo-modal-camera">
                  {cameraError ? (
                    <div className="camera-error">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <p>{cameraError}</p>
                    </div>
                  ) : (
                    <div className="camera-video-wrapper">
                      <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
                      {!isCameraReady && (
                        <div className="camera-loading">
                          <div className="camera-spinner" /><span>Starting camera…</span>
                        </div>
                      )}
                      {isCameraReady && <div className="camera-viewfinder" />}
                    </div>
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  <div className="photo-modal-camera-controls">
                    <button type="button" className="camera-btn-flip"
                      onClick={() => { setIsCameraReady(false); setFacingMode(m => m === 'user' ? 'environment' : 'user'); }}
                      disabled={!!cameraError} title="Flip camera">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                      </svg>
                      Flip
                    </button>
                    <button type="button" className="camera-btn-capture" onClick={capturePhoto}
                      disabled={!isCameraReady || !!cameraError}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
                      Capture
                    </button>
                    <button type="button" className="camera-btn-cancel"
                      onClick={() => { stopStream(); setPhotoModalView('choose'); }}>
                      ← Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}