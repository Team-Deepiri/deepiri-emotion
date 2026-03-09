import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { useClickOutside } from '../../hooks/useClickOutside';

export default function Modal({ open, onClose, title, children, className }) {
  const ref = React.useRef(null);

  useClickOutside(ref, () => open && onClose?.());

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
      <div ref={ref} className={cn('ui-modal', className)}>
        {title && (
          <h2 id="modal-title" className="ui-modal-title">
            {title}
          </h2>
        )}
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}
