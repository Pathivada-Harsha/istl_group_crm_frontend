import { useState } from 'react';

/**
 * Custom Hook for Confirmation Modal
 * 
 * Usage:
 * const { confirmModal, showConfirmation, ConfirmationModalComponent } = useConfirmationModal();
 * 
 * // In your JSX
 * <ConfirmationModalComponent />
 * 
 * // To show confirmation
 * const confirmed = await showConfirmation({
 *   title: 'Delete Item',
 *   message: 'Are you sure?',
 *   type: 'alert'
 * });
 */
const useConfirmationModal = () => {
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null,
    onCancel: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    showCancel: true
  });

  /**
   * Show confirmation modal
   * @param {Object} config - Configuration object
   * @param {string} config.title - Modal title
   * @param {string} config.message - Modal message
   * @param {string} config.type - 'confirm' | 'alert' | 'success' | 'error'
   * @param {string} config.confirmText - Text for confirm button
   * @param {string} config.cancelText - Text for cancel button
   * @param {boolean} config.showCancel - Show cancel button (default: true for confirm, false for others)
   * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
   */
  const showConfirmation = (config) => {
    return new Promise((resolve) => {
      const showCancel = config.showCancel !== undefined 
        ? config.showCancel 
        : (config.type === 'confirm' || config.type === 'alert');

      setConfirmModal({
        show: true,
        title: config.title || 'Confirm Action',
        message: config.message || 'Are you sure you want to proceed?',
        type: config.type || 'confirm',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        showCancel: showCancel,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, show: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal(prev => ({ ...prev, show: false }));
          resolve(false);
        }
      });
    });
  };

  /**
   * Hide confirmation modal programmatically
   */
  const hideConfirmation = () => {
    setConfirmModal(prev => ({ ...prev, show: false }));
  };

  return {
    confirmModal,
    showConfirmation,
    hideConfirmation
  };
};

export default useConfirmationModal;