'use client';

import { useState, useEffect } from 'react';

interface RenameDialogProps {
  currentName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function RenameDialog({ currentName, onConfirm, onClose }: RenameDialogProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) onConfirm(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm rounded-t-xl sm:rounded-lg bg-background p-5 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4">Rename Document</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-md border px-4 py-2.5 text-sm active:bg-muted">Cancel</button>
          <button onClick={submit} className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground active:bg-primary/90">Rename</button>
        </div>
      </div>
    </div>
  );
}
