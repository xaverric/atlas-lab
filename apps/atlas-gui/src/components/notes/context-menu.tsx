'use client';

import { useEffect, useRef } from 'react';
import { Eye, Pencil, FolderInput, Globe, Lock, Link, Bot, Trash2, Info } from 'lucide-react';

interface NoteContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: { icon: typeof Eye; label: string; action: () => void; destructive?: boolean }[];
}

export function NoteContextMenu({ x, y, onClose, items }: NoteContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) ref.current.style.left = `${Math.max(8, x - rect.width)}px`;
    if (rect.bottom > window.innerHeight) ref.current.style.top = `${Math.max(8, y - rect.height)}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-md border bg-popover py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent ${
            item.destructive ? 'text-destructive' : ''
          } ${i > 0 && item.destructive ? 'border-t mt-1 pt-2.5' : ''}`}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

export { Eye, Pencil, FolderInput, Globe, Lock, Link, Bot, Trash2, Info };
