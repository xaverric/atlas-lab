'use client';

import { useState, useEffect } from 'react';
import { Modal } from './modal';

const shortcuts = [
  { keys: ['\u2318', 'K'], description: 'Search in current section' },
  { keys: ['\u2318', 'N'], description: 'Create new item' },
  { keys: ['\u2318', '/'], description: 'Show this help' },
  { keys: ['Esc'], description: 'Close modal / drawer' },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(prev => !prev);
    document.addEventListener('toggle-shortcuts-help', handler);
    return () => document.removeEventListener('toggle-shortcuts-help', handler);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard Shortcuts" maxWidth="max-w-sm">
      <div className="space-y-3">
        {shortcuts.map((s) => (
          <div key={s.description} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{s.description}</span>
            <div className="flex gap-1">
              {s.keys.map((key) => (
                <kbd key={key} className="rounded-md bg-[#f5f5f7] dark:bg-[#1c1c1e] px-2 py-1 text-xs font-mono font-medium">
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
