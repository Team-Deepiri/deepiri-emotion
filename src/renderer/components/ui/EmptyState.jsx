import React from 'react';
import { cn } from '../../utils/cn';

export default function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('ui-empty-state', className)}>
      {icon && <div className="ui-empty-state-icon">{icon}</div>}
      {title && <div className="ui-empty-state-title">{title}</div>}
      {description && <div className="ui-empty-state-desc">{description}</div>}
      {action && <div className="ui-empty-state-action">{action}</div>}
    </div>
  );
}
