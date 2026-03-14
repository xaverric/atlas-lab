'use client';

import { useState, useEffect, useCallback } from 'react';
import { Folder, ChevronRight, Home } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FolderItem {
  id: string;
  name: string;
}

interface MoveDialogProps {
  title?: string;
  documentName?: string;
  currentFolderId: string | null;
  onConfirm: (folderId: string | null) => void;
  onClose: () => void;
  confirmLabel?: string;
}

export function MoveDialog({ title, documentName, currentFolderId, onConfirm, onClose, confirmLabel }: MoveDialogProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selected, setSelected] = useState<string | null>(currentFolderId);
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);

  const displayTitle = title || (documentName ? `Move "${documentName}"` : 'Select folder');
  const displayConfirm = confirmLabel || (documentName ? 'Move here' : 'Select');

  const loadFolders = useCallback(async (parentId: string | null) => {
    try {
      const q = parentId ? `?parentId=${parentId}` : '';
      const res = await api<{ data: FolderItem[] }>(`/api/v1/dms/folders${q}`);
      setFolders(res.data);
    } catch { /* */ }
  }, []);

  const loadBreadcrumb = useCallback(async (folderId: string | null) => {
    if (!folderId) { setBreadcrumb([]); return; }
    try {
      const res = await api<{ data: { breadcrumb: { id: string; name: string }[] } }>(`/api/v1/dms/folders/${folderId}`);
      setBreadcrumb(res.data.breadcrumb);
    } catch { setBreadcrumb([]); }
  }, []);

  useEffect(() => {
    loadFolders(browsing);
    loadBreadcrumb(browsing);
  }, [browsing, loadFolders, loadBreadcrumb]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-t-xl sm:rounded-lg bg-background p-5 sm:p-6 shadow-xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-1">{displayTitle}</h3>
        <p className="text-sm text-muted-foreground mb-4">Select a destination folder</p>

        <nav className="flex items-center gap-1 text-xs mb-3 overflow-x-auto">
          <button
            onClick={() => { setBrowsing(null); setSelected(null); }}
            className="flex items-center gap-1 text-muted-foreground active:text-foreground shrink-0"
          >
            <Home className="h-3 w-3" /> Root
          </button>
          {breadcrumb.map((item) => (
            <span key={item.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
              <button
                onClick={() => { setBrowsing(item.id); setSelected(item.id); }}
                className="text-muted-foreground active:text-foreground"
              >
                {item.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex-1 overflow-auto rounded border min-h-0">
          <button
            onClick={() => setSelected(browsing)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2.5 text-sm active:bg-muted border-b',
              selected === browsing && 'bg-primary/10 text-primary',
            )}
          >
            <Folder className="h-4 w-4 text-yellow-500" />
            (current folder)
          </button>
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center border-b last:border-0">
              <button
                onClick={() => setSelected(folder.id)}
                className={cn(
                  'flex flex-1 items-center gap-2 px-3 py-2.5 text-sm active:bg-muted',
                  selected === folder.id && 'bg-primary/10 text-primary',
                )}
              >
                <Folder className="h-4 w-4 text-yellow-500" />
                {folder.name}
              </button>
              <button
                onClick={() => { setBrowsing(folder.id); setSelected(folder.id); }}
                className="px-3 py-2.5 text-muted-foreground active:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ))}
          {folders.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">No subfolders</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-md border px-4 py-2.5 text-sm active:bg-muted">Cancel</button>
          <button
            onClick={() => { onConfirm(selected); onClose(); }}
            disabled={selected === currentFolderId}
            className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground disabled:opacity-50 active:bg-primary/90"
          >
            {displayConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
