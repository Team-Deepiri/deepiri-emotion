import React from 'react';
import { cn } from '../../utils/cn';

export default function Badge({ children, variant = 'default', className }) {
  return (
    <span className={cn('ui-badge', `ui-badge--${variant}`, className)}>
      {children}
    </span>
  );
}
