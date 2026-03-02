import React from 'react';
import { useNotifications } from '../context/NotificationContext';

export default function Notifications() {
  const { notifications, remove } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="notifications-container">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`notification notification-${n.type || 'info'}`}
          role="alert"
        >
          <span className="notification-message">{n.message}</span>
          <button type="button" className="notification-close" onClick={() => remove(n.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
