// src/hooks/useToast.js
import { useState, useCallback } from 'react';

let toastId = 0;

const useToast = (duration = 3000) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, title = null, overrideDuration = null) => {
    const id = toastId++;
    const newToast = { id, type, message, title };

    setToasts((prevToasts) => [...prevToasts, newToast]);

    // Auto remove after duration (per-call override wins over the hook default)
    setTimeout(() => {
      removeToast(id);
    }, overrideDuration ?? duration);

    return id;
  }, [duration]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message, title, duration) => {
    return addToast('success', message, title, duration);
  }, [addToast]);

  const showError = useCallback((message, title, duration) => {
    return addToast('error', message, title, duration);
  }, [addToast]);

  const showWarning = useCallback((message, title, duration) => {
    return addToast('warning', message, title, duration);
  }, [addToast]);

  const showInfo = useCallback((message, title, duration) => {
    return addToast('info', message, title, duration);
  }, [addToast]);

  return {
    toasts,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

export default useToast;