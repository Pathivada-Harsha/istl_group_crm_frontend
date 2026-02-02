import React from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import '../components_css/ConfirmationModal.css';

/**
 * Reusable Confirmation Modal Component
 * 
 * @param {boolean} show - Control modal visibility
 * @param {string} title - Modal title
 * @param {string} message - Modal message/question
 * @param {string} type - 'confirm' | 'alert' | 'success' | 'error'
 * @param {function} onConfirm - Callback for confirm/ok button
 * @param {function} onCancel - Callback for cancel button (optional)
 * @param {string} confirmText - Text for confirm button (default: 'Confirm')
 * @param {string} cancelText - Text for cancel button (default: 'Cancel')
 * @param {boolean} showCancel - Show cancel button (default: true for 'confirm', false for others)
 */
const ConfirmationModal = ({
  show,
  title = 'Confirm Action',
  message,
  type = 'confirm', // 'confirm' | 'alert' | 'success' | 'error'
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true

}) => {
  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={48} color="#22c55e" />;
      case 'error':
        return <AlertCircle size={48} color="#ef4444" />;
      case 'alert':
        return <AlertCircle size={48} color="#f59e0b" />;
      default:
        return <AlertCircle size={48} color="#3b82f6" />;
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'confirmation-modal-success';
      case 'error':
        return 'confirmation-modal-error';
      case 'alert':
        return 'confirmation-modal-alert';
      default:
        return 'confirmation-modal-confirm';
    }
  };

  return (
    <div className="confirmation-modal-overlay">
      <div className="confirmation-modal-blur" />
      <div className={`confirmation-modal ${getTypeClass()}`}>
        <div className="confirmation-modal-icon">
          {getIcon()}
        </div>
        
        <div className="confirmation-modal-content">
          <h3 className="confirmation-modal-title">{title}</h3>
          <p className="confirmation-modal-message">{message}</p>
        </div>

        <div className="confirmation-modal-actions">
          <button
            className="confirmation-modal-btn confirmation-modal-btn-confirm"
            onClick={() => {
              if (onConfirm) onConfirm();
            }}
            autoFocus
          >
            {confirmText}
          </button>
          
          {showCancel && (
            <button
              className="confirmation-modal-btn confirmation-modal-btn-cancel"
              onClick={() => {
                if (onCancel) onCancel();
              }}
            >
              {cancelText}
            </button>
            
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;