import { useEffect } from 'react';

export function useKeybindings(bindings) {
  useEffect(() => {
    const handler = (e) => {
      for (const { key, ctrlKey, shiftKey, metaKey: _metaKey, altKey, action } of bindings) {
        const mod = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const keyMatch = key === e.key || (key.length === 1 && key.toLowerCase() === e.key?.toLowerCase());
        if (keyMatch && (ctrlKey === undefined || ctrlKey === mod) && (shiftKey === undefined || shiftKey === shift) && (altKey === undefined || altKey === e.altKey)) {
          e.preventDefault();
          action(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindings]);
}
