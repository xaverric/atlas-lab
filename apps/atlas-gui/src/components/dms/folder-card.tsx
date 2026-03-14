'use client';

import { Folder, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface FolderItem {
  id: string;
  name: string;
}

interface FolderCardProps {
  folder: FolderItem;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function FolderCard({ folder, onClick, onRename, onDelete }: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  const submitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 active:bg-muted/50 transition-colors">
      <button onClick={onClick} className="flex flex-1 items-center gap-3 text-left min-w-0">
        <Folder className="h-5 w-5 text-yellow-500 shrink-0" />
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-input bg-background px-2 py-0.5 text-sm w-full"
          />
        ) : (
          <span className="text-sm font-medium truncate">{folder.name}</span>
        )}
      </button>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="rounded p-1.5 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 hover:text-foreground active:bg-muted transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 rounded-md border bg-popover shadow-md min-w-[140px]">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setEditing(true); setEditName(folder.name); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive active:bg-muted"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
