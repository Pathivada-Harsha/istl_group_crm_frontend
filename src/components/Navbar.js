import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../components_css/Navbar.css';
import logo from "../images/logo.png";
import ThemeToggle from './ThemeToggle';

function Navbar({ onMenuClick }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const msgRef = useRef(null);
  const navigate = useNavigate();
  const { logout, user, avatarTs } = useAuth();

  // sample static notifications
  const notifications = [
    { id: 1, text: 'Quotation Q-2025-002 approved', time: '2h' },
    { id: 2, text: 'New lead added: Acme Corp', time: '1d' },
  ];

  const messages = [
    { id: 1, from: 'Ankur', preview: 'Please update the proposal...', time: '3h' },
    { id: 2, from: 'Vijay', preview: 'Sent the revised quote.', time: '1d' },
  ];

  // close dropdowns when clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (msgRef.current && !msgRef.current.contains(e.target)) {
        setShowMessages(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close all dropdowns
  function closeAllDropdowns() {
    setShowProfileMenu(false);
    setShowNotifications(false);
    setShowMessages(false);
  }

  function handleLogout() {
    closeAllDropdowns();
    logout();
    navigate('/login', { replace: true });
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user && user.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return names[0][0] + names[1][0];
      }
      return names[0].substring(0, 2);
    }
    return 'U';
  };

  // Get display name
  const getDisplayName = () => {
    if (user && user.name) {
      return user.name;
    }
    return 'User';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* LEFT SECTION */}
        <div className="navbar-left">
          <button onClick={onMenuClick} className="menu-button" aria-label="Open menu">
            <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="navbar-brand">
            <div className="brand-logo">
              <img src={logo} alt="BD Portal" className="brand-logo-img" />
            </div>
            <h1 className="brand-title">CRM Portal</h1>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="navbar-right">

          {/* Theme toggle (light / dark) */}
          <ThemeToggle />

          {/* Notifications */}
          {/* <div ref={notifRef} style={{ position: "relative" }}>
            <button className="icon-button" onClick={() => {
              setShowNotifications(!showNotifications);
              setShowMessages(false);
              setShowProfileMenu(false);
            }}>
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.length > 0 && <span className="notification-dot"></span>}
            </button>

            {showNotifications && (
              <div className="dropdown-menu">
                <div style={{ padding: "8px 12px", fontWeight: 600 }}>Notifications</div>

                <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ padding: "8px 12px", borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 13 }}>{n.text}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{n.time} ago</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: 8, textAlign: "center", borderTop: "1px solid #eef2f6" }}>
                  <Link to="/notifications" className="dropdown-item" onClick={closeAllDropdowns}>
                    View All
                  </Link>
                </div>
              </div>
            )}
          </div> */}

          {/* Messages */}
          {/* <div ref={msgRef} style={{ position: "relative" }}>
            <button className="icon-button" onClick={() => {
              setShowMessages(!showMessages);
              setShowNotifications(false);
              setShowProfileMenu(false);
            }}>
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {messages.length > 0 && <span className="notification-dot"></span>}
            </button>

            {showMessages && (
              <div className="dropdown-menu">
                <div style={{ padding: "8px 12px", fontWeight: 600 }}>Messages</div>

                <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                  {messages.map(m => (
                    <div key={m.id} style={{ padding: "8px 12px", borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.from}</div>
                      <div style={{ fontSize: 13 }}>{m.preview}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{m.time} ago</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: 8, textAlign: "center", borderTop: "1px solid #eef2f6" }}>
                  <Link to="/messages" className="dropdown-item" onClick={closeAllDropdowns}>
                    View All
                  </Link>
                </div>
              </div>
            )}
          </div> */}

          {/* Profile Dropdown */}
          <div className="profile-dropdown" ref={profileRef}>
            <button className="profile-button" onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
              setShowMessages(false);
            }}>
              <div className="profile-avatar">
                {user?.avatar_url === "db"
                  ? <img
                      src={`${process.env.REACT_APP_API_URL}/users/avatar/${user.id}?t=${avatarTs}`}
                      alt={user.name}
                      className="profile-avatar-img"
                    />
                  : getUserInitials()
                }
              </div>
              <span className="profile-name">{getDisplayName()}</span>
              <svg
                className="icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileMenu && (
              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item" onClick={closeAllDropdowns}>
                  Profile
                </Link>
                {(user?.role?.toLowerCase() === "superadmin" ||
                  user?.role?.toLowerCase() === "admin") && (
                    <Link
                      to="/users"
                      className="dropdown-item"
                      onClick={closeAllDropdowns}
                    >
                      Users
                    </Link>
                  )}
                   {/* <Link
                      to="/users"
                      className="dropdown-item"
                      onClick={closeAllDropdowns}
                    >
                      Users
                    </Link> */}

                {/* <Link to="/settings" className="dropdown-item" onClick={closeAllDropdowns}>
                  Settings
                </Link> */}
                <hr className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item logout logout-btn"
                  onClick={handleLogout}
                >
                  Logout
                </button>

              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}

export default Navbar;