// src/Pages/Profile.jsx
import React, { useState, useRef } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "../pages-css/Profile.css";
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// Build the avatar URL from the flag value stored in user.avatar_url
// "db"  => real endpoint that streams the image
// null  => no photo
function buildAvatarUrl(userId, flag) {
  if (!flag || flag !== 'db') return null;
  return `${API_BASE_URL}/users/avatar/${userId}`;
}

export default function Profile() {
  const { user: authUser, login } = useAuth();

  const initialUser = {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    phone: authUser.phone,
    role: authUser.role.toUpperCase(),
    joined: authUser.created_at,
    lastLogin: authUser.last_login_at,
    avatarFlag: authUser.avatar_url || null, // "db" or null
  };

  const [user, setUser] = useState(initialUser);
  const [editing, setEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // local preview of a newly selected file (before upload)
  const [localPreview, setLocalPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef();

  // Password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  });

  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });

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

  const buildHeaders = () => ({
    'User-Id': String(user.id),
    'User-Role': user.role,
  });

  // ── Avatar: pick file => show local preview ─────────────────────────────
  function handleAvatarSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      showToast('error', 'Image must be smaller than 10 MB.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(f.type)) {
      showToast('error', 'Only JPEG, PNG, GIF and WEBP images are allowed.');
      return;
    }
    setPendingFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setLocalPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  // ── Avatar: upload to backend ────────────────────────────────────────────
  async function uploadAvatar() {
    if (!pendingFile) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);

      const res = await fetch(`${API_BASE_URL}/users/uploadAvatar/${user.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed');

      // Update flag in state and localStorage
      setUser((u) => ({ ...u, avatarFlag: 'db' }));
      updateStoredFlag('db');

      // Clear local preview — the <img> will now load from the server URL
      setLocalPreview(null);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';

      showToast('success', 'Profile photo updated!');
    } catch (err) {
      showToast('error', err.message || 'Failed to upload image.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Avatar: discard pending pick ────────────────────────────────────────
  function discardPendingPhoto() {
    setLocalPreview(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Avatar: remove saved photo ──────────────────────────────────────────
  async function removeAvatar() {
    setAvatarUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/removeAvatar/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: buildHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Remove failed');

      setUser((u) => ({ ...u, avatarFlag: null }));
      updateStoredFlag(null);
      setLocalPreview(null);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
      showToast('success', 'Profile photo removed.');
    } catch (err) {
      showToast('error', err.message || 'Failed to remove photo.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Persist avatar flag to localStorage / AuthContext ───────────────────
  function updateStoredFlag(flag) {
    try {
      const raw = localStorage.getItem('bd_portal_user');
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.user) {
          stored.user.avatar_url = flag;
          login(stored);
        }
      }
    } catch (_) {}
  }

  // ── Profile save ────────────────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    if (!profileForm.name || !profileForm.email) {
      showToast('error', 'Please provide name and email.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login/updateUser/${user.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
          role: profileForm.role,
          last_login_at: user.lastLogin,
        }),
      });
      const txt = await res.text();
      if (res.ok) {
        setUser((u) => ({ ...u, ...profileForm }));
        const stored = JSON.parse(localStorage.getItem('bd_portal_user'));
        if (stored) {
          stored.user = { ...stored.user, name: profileForm.name, email: profileForm.email, phone: profileForm.phone, role: profileForm.role };
          login(stored);
        }
        setEditing(false);
        showToast('success', 'Profile updated successfully!');
      } else {
        throw new Error(txt || 'Failed to update profile');
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  }

  // ── Password change ──────────────────────────────────────────────────────
  async function changePassword(e) {
    e.preventDefault();
    if (!pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm) { showToast('error', 'Fill all password fields.'); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { showToast('error', 'Passwords do not match.'); return; }
    if (pwdForm.newPwd.length < 6) { showToast('warning', 'Password must be at least 6 characters.'); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login/updatePassword/${user.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: pwdForm.current, newPassword: pwdForm.newPwd }),
      });
      const txt = await res.text();
      if (res.ok) {
        setPwdForm({ current: '', newPwd: '', confirm: '' });
        setShowPasswordForm(false);
        setShowCurrentPassword(false); setShowNewPassword(false); setShowConfirmPassword(false);
        showToast('success', 'Password changed successfully!');
      } else {
        throw new Error(txt || 'Failed to change password');
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setProfileForm({ name: user.name, email: user.email, phone: user.phone, role: user.role });
  }

  function initials(name) {
    return (name || '').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }

  // What to show in the avatar circle
  const serverAvatarUrl = buildAvatarUrl(user.id, user.avatarFlag);
  const displaySrc = localPreview || serverAvatarUrl; // local preview takes priority

  return (
    <div className="profile-user-page-root page-container">

      {/* Toast */}
      {toast.show && (
        <div className={`toast-notification toast-${toast.type}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'warning' && '⚠'}
            </div>
            <div className="toast-text">
              <div className="toast-title">
                {toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Warning'}
              </div>
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

            {/* Avatar circle with camera hover */}
            <div className="profile-avatar-section">
              <div className="profile-avatar-circle">
                {displaySrc ? (
                  <img src={displaySrc} alt={user.name} className="profile-user-page-avatar-img" />
                ) : (
                  <div className="profile-user-page-avatar-initials">{initials(user.name)}</div>
                )}
                <label className="profile-avatar-overlay" htmlFor="avatar-file-input" title="Change photo">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Change</span>
                </label>
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  ref={fileRef}
                  onChange={handleAvatarSelect}
                />
              </div>

              {/* Pending file picked — show Save / Discard */}
              {pendingFile && (
                <div className="profile-avatar-actions">
                  <button className="btn primary profile-avatar-btn" onClick={uploadAvatar} disabled={avatarUploading}>
                    {avatarUploading ? 'Uploading...' : 'Save Photo'}
                  </button>
                  <button className="btn profile-avatar-btn" onClick={discardPendingPhoto} disabled={avatarUploading}>
                    Discard
                  </button>
                </div>
              )}

              {/* Saved photo — show Remove */}
              {!pendingFile && user.avatarFlag === 'db' && (
                <div className="profile-avatar-actions">
                  <button className="btn profile-avatar-btn profile-avatar-remove" onClick={removeAvatar} disabled={avatarUploading}>
                    {avatarUploading ? 'Removing...' : 'Remove Photo'}
                  </button>
                </div>
              )}
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

          {/* PROFILE FORM */}
          <form className="profile-user-page-form card" onSubmit={saveProfile}>
            <div className="profile-user-page-header">
              <h3>Profile Details</h3>
              {!editing && (
                <button type="button" className="btn primary" onClick={() => setEditing(true)} disabled={loading}>
                  Edit Profile
                </button>
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
                <button type="submit" className="btn primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}
          </form>

          {/* PASSWORD FORM */}
          <div className="profile-user-page-password card">
            <div className="profile-user-page-header">
              <h3>Change Password</h3>
              <button type="button" className="btn primary"
                onClick={() => {
                  setShowPasswordForm(!showPasswordForm);
                  if (showPasswordForm) {
                    setPwdForm({ current: '', newPwd: '', confirm: '' });
                    setShowCurrentPassword(false); setShowNewPassword(false); setShowConfirmPassword(false);
                  }
                }}
                disabled={passwordLoading}
              >
                {showPasswordForm ? 'Hide' : 'Show'}
              </button>
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
                      <input
                        type={show ? 'text' : 'password'}
                        name={key}
                        value={pwdForm[key]}
                        onChange={(e) => setPwdForm(p => ({ ...p, [key]: e.target.value }))}
                        onPaste={key === 'confirm' ? (e) => e.preventDefault() : undefined}
                        disabled={passwordLoading}
                      />
                      <button type="button" className="password-toggle-btn" onClick={toggle} disabled={passwordLoading}>
                        {show ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="profile-user-page-actions-row">
                  <button type="submit" className="btn primary" disabled={passwordLoading}>
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}