'use client';

import { useEffect, useRef } from 'react';
import { Download, Eye, Pencil, FolderInput, Info, Trash2 } from 'lucide-react';
import { canPreview } from './file-icon';

interface ContextMenuProps {
  x: number;
  y: number;
  mimeType: string;
  onClose: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onDetails: () => void;
  onDelete: () => void;
}

export function ContextMenu({
  x, y, mimeType, onClose, onPreview, onDownload, onRename, onMove, onDetails, onDelete,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) ref.current.style.left = `${Math.max(8, x - rect.width)}px`;
    if (rect.bottom > vh) ref.current.style.top = `${Math.max(8, y - rect.height)}px`;
    if (rect.left < 0) ref.current.style.left = '8px';
  }, [x, y]);

  const previewable = canPreview(mimeType);

  const items = [
    ...(previewable ? [{ icon: Eye, label: 'Preview', action: onPreview }] : []),
    { icon: Download, label: 'Download', action: onDownload },
    { icon: Pencil, label: 'Rename', action: onRename },
    { icon: FolderInput, label: 'Move to...', action: onMove },
    { icon: Info, label: 'Details', action: onDetails },
    { icon: Trash2, label: 'Delete', action: onDelete, destructive: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-xl bg-white shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] dark:bg-[#1c1c1e] py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors ${
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
