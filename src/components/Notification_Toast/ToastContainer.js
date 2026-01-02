// src/components/Toast/ToastContainer.js
import React from 'react';
import ToastNotification from './ToastNotification';
import '../../components_css/Notification_Toast/ToastNotification.css';

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;