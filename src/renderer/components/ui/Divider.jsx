import React from 'react';
import { cn } from '../../utils/cn';

export default function Divider({ vertical, className }) {
  return (
    <hr
      className={cn('ui-divider', vertical && 'ui-divider--vertical', className)}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
    />
  );
}
