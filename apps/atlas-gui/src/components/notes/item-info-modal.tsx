'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Copy, Globe, Lock, Pencil, Trash2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatSize, formatDate } from '@/lib/utils';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';

type PublicPermission = 'view' | 'edit' | 'full';

interface ItemInfoModalProps {
  type: 'folder' | 'note';
  itemId: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface FolderInfo {
  id: string;
  name: string;
  visibility: string;
  publicPermission?: PublicPermission;
  createdAt: string;
}

interface FolderMeta {
  noteCount: number;
  subfolderCount: number;
  totalSize: number;
}

interface NoteInfo {
  id: string;
  title: string;
  isPublic?: boolean;
  publicPermission?: PublicPermission;
  tags: string[];
  folderId?: string;
  contentSize?: number;
  attachments?: { filename: string; size: number }[];
  createdAt: string;
  updatedAt: string;
}

export function ItemInfoModal({ type, itemId, onClose, onUpdate }: ItemInfoModalProps) {
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [folderMeta, setFolderMeta] = useState<FolderMeta | null>(null);
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (type === 'folder') {
        const [folderRes, metaRes] = await Promise.all([
          api<{ data: FolderInfo }>(`/api/v1/notes/folders/${itemId}`),
          api<{ data: FolderMeta }>(`/api/v1/notes/folders/${itemId}/metadata`),
        ]);
        setFolder(folderRes.data);
        setFolderMeta(metaRes.data);
      } else {
        const res = await api<{ data: NoteInfo }>(`/api/v1/notes/${itemId}`);
        setNote(res.data);
      }
    } catch {
      toast.error(`Failed to load ${type} info`);
    } finally {
      setLoading(false);
    }
  }, [type, itemId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const isPublic = type === 'folder'
    ? folder?.visibility === 'public'
    : note?.isPublic ?? false;

  const permission = type === 'folder'
    ? folder?.publicPermission
    : note?.publicPermission;

  const displayName = type === 'folder' ? folder?.name : note?.title;

  const startEditing = () => {
    setNameDraft(displayName || '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    try {
      if (type === 'folder') {
        await api(`/api/v1/notes/folders/${itemId}`, { method: 'PATCH', body: JSON.stringify({ name: trimmed }) });
        setFolder((prev) => prev ? { ...prev, name: trimmed } : prev);
      } else {
        await api(`/api/v1/notes/${itemId}`, { method: 'PATCH', body: JSON.stringify({ title: trimmed }) });
        setNote((prev) => prev ? { ...prev, title: trimmed } : prev);
      }
      setEditingName(false);
      onUpdate();
      toast.success('Renamed');
    } catch {
      toast.error('Failed to rename');
    }
  };

  const toggleVisibility = async () => {
    try {
      if (type === 'folder') {
        const newVis = isPublic ? 'private' : 'public';
        await api(`/api/v1/notes/folders/${itemId}`, { method: 'PATCH', body: JSON.stringify({ visibility: newVis }) });
        setFolder((prev) => prev ? { ...prev, visibility: newVis } : prev);
      } else {
        await api(`/api/v1/notes/${itemId}`, { method: 'PATCH', body: JSON.stringify({ isPublic: !isPublic }) });
        setNote((prev) => prev ? { ...prev, isPublic: !isPublic } : prev);
      }
      onUpdate();
      toast.success(isPublic ? 'Now private' : 'Now public');
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const changePermission = async (perm: PublicPermission) => {
    try {
      if (type === 'folder') {
        await api(`/api/v1/notes/folders/${itemId}`, { method: 'PATCH', body: JSON.stringify({ publicPermission: perm }) });
        setFolder((prev) => prev ? { ...prev, publicPermission: perm } : prev);
      } else {
        await api(`/api/v1/notes/${itemId}`, { method: 'PATCH', body: JSON.stringify({ publicPermission: perm }) });
        setNote((prev) => prev ? { ...prev, publicPermission: perm } : prev);
      }
      onUpdate();
      toast.success(`Permission set to ${perm}`);
    } catch {
      toast.error('Failed to update permission');
    }
  };

  const copyPublicLink = () => {
    const url = type === 'folder'
      ? `${window.location.origin}/public/notes/folders/${itemId}`
      : `${window.location.origin}/public/notes/${itemId}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied');
  };

  const handleDelete = async () => {
    const label = type === 'folder' ? 'folder' : 'note';
    const ok = await confirm({ title: `Delete ${label}?`, description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      const endpoint = type === 'folder'
        ? `/api/v1/notes/folders/${itemId}`
        : `/api/v1/notes/${itemId}`;
      await api(endpoint, { method: 'DELETE' });
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted`);
      onUpdate();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to delete ${label}`);
    }
  };

  const permissionOptions = type === 'folder'
    ? [
        { value: 'view' as const, label: 'View' },
        { value: 'edit' as const, label: 'Edit' },
        { value: 'full' as const, label: 'Full' },
      ]
    : [
        { value: 'view' as const, label: 'View' },
        { value: 'edit' as const, label: 'Edit' },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {ConfirmDialogElement}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] dark:bg-[#1c1c1e]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">
            {type === 'folder' ? 'Folder' : 'Note'} Info
          </h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3 text-sm">
              {/* Name */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Name</span>
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={nameInputRef}
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      className="rounded border bg-background px-2 py-0.5 text-sm w-48"
                    />
                    <button onClick={saveName} className="rounded-lg p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#0071e3]">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingName(false)} className="rounded-lg p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={startEditing} className="flex items-center gap-1.5 font-medium truncate hover:text-[#0071e3] group">
                    <span className="truncate">{displayName}</span>
                    <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                )}
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Visibility</span>
                <button
                  onClick={toggleVisibility}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    isPublic
                      ? 'bg-info/10 text-info hover:bg-info/20'
                      : 'bg-[#f5f5f7] text-muted-foreground hover:bg-[#e8e8ed] dark:bg-[#2c2c2e] dark:hover:bg-[#3a3a3c]'
                  }`}
                >
                  {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {isPublic ? 'Public' : 'Private'}
                </button>
              </div>

              {/* Permission dropdown */}
              {isPublic && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Permission</span>
                  <select
                    value={permission || 'view'}
                    onChange={(e) => changePermission(e.target.value as PublicPermission)}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    {permissionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Folder-specific fields */}
              {type === 'folder' && folderMeta && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Notes</span>
                    <span>{folderMeta.noteCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subfolders</span>
                    <span>{folderMeta.subfolderCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Size</span>
                    <span>{formatSize(folderMeta.totalSize)}</span>
                  </div>
                  {folder?.createdAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{formatDate(folder.createdAt)}</span>
                    </div>
                  )}
                </>
              )}

              {/* Note-specific fields */}
              {type === 'note' && note && (
                <>
                  {note.tags.length > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Tags</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {note.tags.map((tag) => (
                          <span key={tag} className="rounded bg-[#f5f5f7] dark:bg-[#2c2c2e] px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{note.contentSize != null ? formatSize(note.contentSize) : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Attachments</span>
                    <span>{note.attachments?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(note.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatDate(note.updatedAt)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && (
          <div className="flex items-center gap-2 border-t px-5 py-3">
            {isPublic && (
              <button
                onClick={copyPublicLink}
                className="flex items-center gap-1.5 rounded-lg bg-[#f5f5f7] px-3 py-1.5 text-sm text-[#1d1d1f] hover:bg-[#e8e8ed] dark:bg-[#2c2c2e] dark:text-white dark:hover:bg-[#3a3a3c]"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy public link
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
