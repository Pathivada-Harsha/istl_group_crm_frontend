import React from 'react';
import { AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import '../components_css/ConfirmationModal.css';

/**
 * Reusable Confirmation Modal Component
 *
 * @param {boolean} show - Control modal visibility
 * @param {string} title - Modal title
 * @param {string} message - Modal message (supports \n for line breaks)
 * @param {string} type - 'confirm' | 'alert' | 'success' | 'error'
 * @param {function} onConfirm - Callback for confirm/ok button
 * @param {function} onCancel - Callback for cancel button
 * @param {string} confirmText - Text for confirm button (default: 'Confirm')
 * @param {string} cancelText - Text for cancel button (default: 'Cancel')
 * @param {boolean} showCancel - Show cancel button
 */
const ConfirmationModal = ({
  show,
  title = 'Confirm Action',
  message,
  type = 'confirm',
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true,
}) => {
  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':  return <CheckCircle size={40} color="#22c55e" />;
      case 'error':    return <AlertCircle size={40} color="#ef4444" />;
      case 'alert':    return <Trash2      size={40} color="#ef4444" />;
      default:         return <AlertCircle size={40} color="#3b82f6" />;
    }
  };

  const getConfirmBtnClass = () => {
    switch (type) {
      case 'alert':  return 'cm-btn-danger';
      case 'success':
      case 'confirm':
      default:       return 'cm-btn-primary';
    }
  };

  // Render message: split on \n, detect key:value lines and section dividers
  const renderMessage = (msg) => {
    if (!msg) return null;
    const lines = msg.split('\n');

    // Check if any line looks like "Key: Value" — if so render as info-card
    const hasInfoLines = lines.some(l => /^[A-Za-z ]+:\s/.test(l) && !l.startsWith('⚠') && !l.startsWith('Note'));
    if (!hasInfoLines) {
      return (
        <p className="cm-message">
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    }

    // Structured rendering: info card + warnings
    const infoRows = [];
    const warningLines = [];
    const noteLines = [];
    let leadText = '';

    lines.forEach(line => {
      if (!line.trim()) return;
      if (line.startsWith('⚠')) { warningLines.push(line); return; }
      if (line.startsWith('Note:')) { noteLines.push(line); return; }
      if (/^[A-Za-z ]+:\s/.test(line)) {
        const colonIdx = line.indexOf(':');
        infoRows.push({ key: line.slice(0, colonIdx).trim(), value: line.slice(colonIdx + 1).trim() });
      } else {
        leadText = line;
      }
    });

    return (
      <div className="cm-structured-message">
        {leadText && <p className="cm-lead">{leadText}</p>}

        {infoRows.length > 0 && (
          <div className="cm-info-card">
            {infoRows.map((row, i) => (
              <div key={i} className="cm-info-row">
                <span className="cm-info-key">{row.key}</span>
                <span className={`cm-info-value${row.key === 'Amount' ? ' cm-amount' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {warningLines.length > 0 && (
          <div className="cm-warning-box">
            {warningLines.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {noteLines.length > 0 && (
          <p className="cm-note">{noteLines.join(' ')}</p>
        )}
      </div>
    );
  };

  return (
    <div className="cm-overlay">
      <div className={`cm-modal cm-type-${type}`}>
        {/* Icon */}
        <div className="cm-icon-wrap">
          {getIcon()}
        </div>

        {/* Title */}
        <h3 className="cm-title">{title}</h3>

        {/* Message */}
        <div className="cm-body">
          {renderMessage(message)}
        </div>

        {/* Actions */}
        <div className="cm-actions">
          {showCancel && (
            <button className="cm-btn cm-btn-cancel" onClick={() => { if (onCancel) onCancel(); }}>
              {cancelText}
            </button>
          )}
          <button
            className={`cm-btn ${getConfirmBtnClass()}`}
            onClick={() => { if (onConfirm) onConfirm(); }}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;