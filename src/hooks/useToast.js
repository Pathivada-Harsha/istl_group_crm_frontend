// src/hooks/useToast.js
import { useState, useCallback } from 'react';

let toastId = 0;

const useToast = (duration = 3000) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, title = null) => {
    const id = toastId++;
    const newToast = { id, type, message, title };

    setToasts((prevToasts) => [...prevToasts, newToast]);

    // Auto remove after duration
    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  }, [duration]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message, title) => {
    return addToast('success', message, title);
  }, [addToast]);

  const showError = useCallback((message, title) => {
    return addToast('error', message, title);
  }, [addToast]);

  const showWarning = useCallback((message, title) => {
    return addToast('warning', message, title);
  }, [addToast]);

  const showInfo = useCallback((message, title) => {
    return addToast('info', message, title);
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