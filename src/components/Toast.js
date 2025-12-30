import React, { useEffect } from 'react';
import '../components_css/Toast.css';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'notification':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'notification':
        return 'Notification';
      default:
        return 'Info';
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-header">
        <span className="toast-icon">{getIcon()}</span>
        <strong className="toast-title">{getTitle()}</strong>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
      <div className="toast-body">{message}</div>
    </div>
  );
};

export default Toast;