import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const add = useCallback((notification) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item = typeof notification === 'string' ? { id, message: notification, type: 'info' } : { id, ...notification };
    setNotifications((prev) => [...prev, item]);
    const timeout = item.duration ?? 4000;
    if (timeout > 0) {
      setTimeout(() => {
        setNotifications((p) => p.filter((n) => n.id !== id));
      }, timeout);
    }
    return id;
  }, []);

  const remove = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const success = useCallback((msg) => add({ message: msg, type: 'success' }), [add]);
  const error = useCallback((msg) => add({ message: msg, type: 'error', duration: 6000 }), [add]);
  const warning = useCallback((msg) => add({ message: msg, type: 'warning' }), [add]);
  const info = useCallback((msg) => add({ message: msg, type: 'info' }), [add]);

  return (
    <NotificationContext.Provider value={{ notifications, add, remove, success, error, warning, info }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Intentional: provider and hook in same file for co-location
// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
