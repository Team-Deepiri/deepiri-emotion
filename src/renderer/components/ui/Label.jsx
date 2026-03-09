import React from 'react';
import { cn } from '../../utils/cn';

export default function Label({ htmlFor, children, required, className }) {
  return (
    <label htmlFor={htmlFor} className={cn('ui-label', className)}>
      {children}
      {required && <span className="ui-label-required" aria-hidden> *</span>}
    </label>
  );
}
