// src/Pages/Profile.jsx
import React, { useState, useRef } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "../pages-css/Profile.css";
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = process.env.REACT_APP_API_URL;

export default function Profile() {
  const { user: authUser, login } = useAuth();

  const initialUser = {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    phone: authUser.phone,
    role: authUser.role.toUpperCase(),
    team: "Business Development",
    joined: authUser.created_at,
    lastLogin: authUser.last_login_at,
    avatarUrl: null,
  };

  const [user, setUser] = useState(initialUser);
  const [editing, setEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    type: '', // 'success', 'error', 'warning'
    message: ''
  });
  
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    team: user.team,
  });

  const [pwdForm, setPwdForm] = useState({
    current: "",
    newPwd: "",
    confirm: "",
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl || null);
  const fileRef = useRef();

  // Show toast notification
  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    
    // Auto hide after 4 seconds
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 4000);
  };

  const formatDateTime = (dateStr) => {
  const d = new Date(dateStr);

  const pad = (n) => n.toString().padStart(2, '0');

  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

  // Close toast manually
  const closeToast = () => {
    setToast({ show: false, type: '', message: '' });
  };

  function handleProfileChange(e) {
    const { name, value } = e.target;
    setProfileForm((p) => ({ ...p, [name]: value }));
  }

  function handlePwdChange(e) {
    const { name, value } = e.target;
    setPwdForm((p) => ({ ...p, [name]: value }));
  }


  function handleAvatarSelect(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    fileRef.current.value = "";
  }

  async function saveProfile(e) {
    e.preventDefault();
    
    if (!profileForm.name || !profileForm.email) {
      showToast('error', 'Please provide name and email.');
      return;
    }

    setLoading(true);

    try {
      // Prepare the data to send to backend
      const updateData = {
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        role: profileForm.role,
        last_login_at: user.lastLogin,
      };

      // Call the backend API
      const response = await fetch(
        `${API_BASE_URL}/login/updateUser/${user.id}`,
        {
          method: 'PUT',
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      const responseText = await response.text();

      if (response.ok) {
        // Update local state
        const updatedUser = {
          ...user,
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
          role: profileForm.role,
          team: profileForm.team,
          avatarUrl: avatarPreview || user.avatarUrl,
          
        };
        
        setUser(updatedUser);
        
        // Update AuthContext with new user data
        const userData = JSON.parse(localStorage.getItem('bd_portal_user'));
        if (userData) {
          userData.user = {
            ...userData.user,
            name: profileForm.name,
            email: profileForm.email,
            phone: profileForm.phone,
            role: profileForm.role,
          };
          login(userData);
        }

        setEditing(false);
        showToast('success', 'Profile updated successfully!');
      } else {
        throw new Error(responseText || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      showToast('error', err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    if (!pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm) {
      showToast('error', 'Fill all password fields.');
      return;
    }
    
    if (pwdForm.newPwd !== pwdForm.confirm) {
      showToast('error', 'New password and confirm password do not match.');
      return;
    }

    if (pwdForm.newPwd.length < 6) {
      showToast('warning', 'New password must be at least 6 characters long.');
      return;
    }

    setPasswordLoading(true);

    try {
      const passwordData = {
        oldPassword: pwdForm.current,
        newPassword: pwdForm.newPwd,
      };

      const response = await fetch(
        `${API_BASE_URL}/login/updatePassword/${user.id}`,
        {
          method: 'PUT',
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(passwordData),
        }
      );

      const responseText = await response.text();

      if (response.ok) {
        setPwdForm({ current: "", newPwd: "", confirm: "" });
        setShowPasswordForm(false);
        // Reset password visibility states
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        showToast('success', 'Password changed successfully!');
      } else {
        throw new Error(responseText || 'Failed to change password');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      showToast('error', err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setProfileForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      team: user.team,
    });

    setAvatarFile(null);
    setAvatarPreview(user.avatarUrl || null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function initials(name) {
    return (name || "")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <div className="profile-user-page-root page-container">
      
      {/* Toast Notification */}
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
                {toast.type === 'success' && 'Success'}
                {toast.type === 'error' && 'Error'}
                {toast.type === 'warning' && 'Warning'}
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
            <div className="profile-user-page-avatar-wrap">
              {avatarPreview ? (
                <img src={avatarPreview} alt={user.name} className="profile-user-page-avatar-img" />
              ) : (
                <div className="profile-user-page-avatar-initials">
                  {initials(user.name)}
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
              <div className="profile-user-page-stat-value">
                {formatDateTime(user.joined)}
              </div>
            </div>

            <div className="profile-user-page-stat">
              <div className="profile-user-page-stat-title">Last Login</div>
              <div className="profile-user-page-stat-value">
                {formatDateTime(user.lastLogin)}
              </div>
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
                <button 
                  type="button" 
                  className="btn primary" 
                  onClick={() => setEditing(true)}
                  disabled={loading}
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="profile-user-page-row">
              <label>Name</label>
              <input 
                name="name" 
                value={profileForm.name} 
                onChange={handleProfileChange} 
                disabled={!editing || loading} 
              />
            </div>

            <div className="profile-user-page-row">
              <label>Email</label>
              <input 
                name="email" 
                type="email"
                value={profileForm.email} 
                onChange={handleProfileChange} 
                disabled={!editing || loading} 
              />
            </div>

            <div className="profile-user-page-row">
              <label>Phone</label>
              <input 
                name="phone" 
                value={profileForm.phone} 
                onChange={handleProfileChange} 
                disabled={!editing || loading} 
              />
            </div>

            {/* <div className="profile-user-page-row">
              <label>Designation / Role</label>
              <input 
                name="role" 
                value={profileForm.role} 
                onChange={handleProfileChange} 
                disabled={!editing || loading} 
              />
            </div> */}

            {editing && (
              <div className="profile-user-page-actions-row">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={cancelEdit}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}
          </form>

          {/* PASSWORD FORM */}
          <div className="profile-user-page-password card">
            <div className="profile-user-page-header">
              <h3>Change Password</h3>
              <button 
                type="button" 
                className="btn primary" 
                onClick={() => {
                  setShowPasswordForm(!showPasswordForm);
                  if (showPasswordForm) {
                    setPwdForm({ current: "", newPwd: "", confirm: "" });
                    // Reset visibility states when hiding form
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }
                }}
                disabled={passwordLoading}
              >
                {showPasswordForm ? 'Hide' : 'Show'}
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={changePassword}>
                <div className="profile-user-page-row">
                  <label>Current Password</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showCurrentPassword ? "text" : "password"}
                      name="current" 
                      value={pwdForm.current} 
                      onChange={handlePwdChange}
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      disabled={passwordLoading}
                    >
                      {showCurrentPassword ? (
                        <AiOutlineEyeInvisible size={20} />
                      ) : (
                        <AiOutlineEye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="profile-user-page-row">
                  <label>New Password</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showNewPassword ? "text" : "password"}
                      name="newPwd" 
                      value={pwdForm.newPwd} 
                      onChange={handlePwdChange}
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={passwordLoading}
                    >
                      {showNewPassword ? (
                        <AiOutlineEyeInvisible size={20} />
                      ) : (
                        <AiOutlineEye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="profile-user-page-row">
                  <label>Confirm New Password</label>
                  <div className="password-input-wrapper">
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirm" 
                      value={pwdForm.confirm} 
                      onChange={handlePwdChange}
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={passwordLoading}
                    >
                      {showConfirmPassword ? (
                        <AiOutlineEyeInvisible size={20} />
                      ) : (
                        <AiOutlineEye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="profile-user-page-actions-row">
                  <button 
                    type="submit" 
                    className="btn primary"
                    disabled={passwordLoading}
                  >
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