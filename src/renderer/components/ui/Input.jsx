import React from 'react';
import { cn } from '../../utils/cn';

export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  label,
  ...rest
}) {
  const input = (
    <input
      type={type}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn('ui-input', className)}
      {...rest}
    />
  );
  if (label) {
    return (
      <div className="ui-input-wrap">
        <label htmlFor={id} className="ui-input-label">
          {label}
        </label>
        {input}
      </div>
    );
  }
  return input;
}
