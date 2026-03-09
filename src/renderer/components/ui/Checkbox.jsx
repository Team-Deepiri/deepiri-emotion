import React from 'react';
import { cn } from '../../utils/cn';

export default function Checkbox({ checked, onChange, disabled, id, label, className }) {
  return (
    <label className={cn('ui-checkbox-wrap', className)}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        className="ui-checkbox"
      />
      {label && <span className="ui-checkbox-label">{label}</span>}
    </label>
  );
}
