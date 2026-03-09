import React from 'react';
import { cn } from '../../utils/cn';

export default function Spinner({ size = 24, className }) {
  return (
    <span
      className={cn('ui-spinner', className)}
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
    />
  );
}
