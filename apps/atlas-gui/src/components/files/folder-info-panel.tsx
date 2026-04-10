'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatSize, formatDate } from '@/lib/utils';

type PublicPermission = 'view' | 'edit' | 'full';

interface FolderMetadata {
  id: string;
  name: string;
  isPublic?: boolean;
  publicPermission?: PublicPermission;
  createdAt: string;
  docCount: number;
  subfolderCount: number;
  totalSize: number;
}

interface FolderInfoPanelProps {
  folderId: string;
  onClose: () => void;
  onPublicToggle?: (isPublic: boolean) => void;
}

export function FolderInfoPanel({ folderId, onClose, onPublicToggle }: FolderInfoPanelProps) {
  const [meta, setMeta] = useState<FolderMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<{ data: FolderMetadata }>(`/api/v1/files/folders/${folderId}/metadata`)
      .then((res) => setMeta(res.data))
      .catch(() => toast.error('Failed to load folder info'))
      .finally(() => setLoading(false));
  }, [folderId]);

  const copyId = () => {
    navigator.clipboard.writeText(folderId);
    toast.success('Folder ID copied');
  };

  const copyLink = () => {
    const url = meta?.isPublic
      ? `${window.location.origin}/public/files/${folderId}`
      : `${window.location.origin}/files?folderId=${folderId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  const togglePublic = async () => {
    if (!meta) return;
    const newValue = !meta.isPublic;
    try {
      await api(`/api/v1/files/folders/${folderId}/public`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: newValue, publicPermission: newValue ? (meta.publicPermission || 'view') : undefined }),
      });
      setMeta({ ...meta, isPublic: newValue });
      onPublicToggle?.(newValue);
      toast.success(newValue ? 'Folder is now public' : 'Folder is now private');
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const changePermission = async (perm: PublicPermission) => {
    if (!meta) return;
    try {
      await api(`/api/v1/files/folders/${folderId}/public`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: true, publicPermission: perm }),
      });
      setMeta({ ...meta, publicPermission: perm });
      toast.success(`Permission set to ${perm}`);
    } catch {
      toast.error('Failed to update permission');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4">
        <p className="text-sm text-muted-foreground">Loading folder info...</p>
      </div>
    );
  }

  if (!meta) return null;

  return (
    <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Folder Info</h3>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium truncate ml-4">{meta.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">ID</span>
          <button onClick={copyId} className="flex items-center gap-1 font-mono text-xs hover:text-primary truncate ml-4">
            {meta.id.slice(0, 12)}...
            <Copy className="h-3 w-3 shrink-0" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Created</span>
          <span>{formatDate(meta.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Documents</span>
          <span>{meta.docCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subfolders</span>
          <span>{meta.subfolderCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Size</span>
          <span>{formatSize(meta.totalSize)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Visibility</span>
          <button
            onClick={togglePublic}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
              meta.isPublic
                ? 'bg-success/10 text-success'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {meta.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {meta.isPublic ? 'Public' : 'Private'}
          </button>
        </div>
        {meta.isPublic && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Permission</span>
            <select
              value={meta.publicPermission || 'view'}
              onChange={(e) => changePermission(e.target.value as PublicPermission)}
              className="rounded border bg-background px-2 py-0.5 text-xs"
            >
              <option value="view">View (browse, download)</option>
              <option value="edit">Edit (+ rename)</option>
              <option value="full">Full (+ upload, delete)</option>
            </select>
          </div>
        )}
      </div>

      <button
        onClick={copyLink}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white dark:bg-[#2c2c2e] px-3 py-1.5 text-sm hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy link
      </button>
    </div>
  );
}
