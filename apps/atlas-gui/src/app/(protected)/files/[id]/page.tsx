'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Share2, Trash2, Copy, ArrowLeft, Pencil, Check, X, FolderInput } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FileIcon } from '@/components/files/file-icon';
import { MoveDialog } from '@/components/files/move-dialog';
import { formatSize, formatDateTime } from '@/lib/utils';

interface Document {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  tags: string[];
  folderId: string | null;
  createdAt: string;
}

interface ShareToken {
  id: string;
  token: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  createdAt: string;
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Document | null>(null);
  const [shares, setShares] = useState<ShareToken[]>([]);
  const [showShareForm, setShowShareForm] = useState(false);
  const [shareHours, setShareHours] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [editTags, setEditTags] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  useEffect(() => {
    api<{ data: Document }>(`/api/v1/files/documents/${id}`)
      .then((res) => setDoc(res.data))
      .catch(() => toast.error('Document not found'));

    api<{ data: { url: string } }>(`/api/v1/files/documents/${id}/preview`)
      .then((res) => setPreviewUrl(res.data.url))
      .catch(() => {});
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${id}/download`);
      window.open(res.data.url, '_blank');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this document?')) return;
    try {
      await api(`/api/v1/files/documents/${id}`, { method: 'DELETE' });
      toast.success('Document deleted');
      router.push('/files');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    try {
      const res = await api<{ data: Document }>(`/api/v1/files/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setDoc(res.data);
      toast.success('Updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const saveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== doc?.name) handleUpdate({ name: trimmed });
    setEditingName(false);
  };

  const saveTags = () => {
    const newTags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
    handleUpdate({ tags: newTags });
    setEditingTags(false);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    handleUpdate({ folderId });
  };

  const handleCreateShare = async () => {
    try {
      const res = await api<{ data: ShareToken }>('/api/v1/files/shares', {
        method: 'POST',
        body: JSON.stringify({ documentId: id, expiresInHours: shareHours, maxDownloads }),
      });
      setShares((prev) => [res.data, ...prev]);
      setShowShareForm(false);
      toast.success('Share link created');
    } catch {
      toast.error('Failed to create share link');
    }
  };

  const copyShareUrl = (token: string) => {
    const url = `${window.location.origin}/api/v1/files/shares/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  if (!doc) return <p className="text-muted-foreground">Loading...</p>;

  const isImage = doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType.includes('pdf');

  return (
    <div className="space-y-4 sm:space-y-6">
      <button onClick={() => router.push('/files')} className="flex items-center gap-1 text-sm text-muted-foreground active:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to File Storage
      </button>

      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <FileIcon mimeType={doc.mimeType} className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
            {editingName ? (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="rounded border border-input bg-background px-2 py-1 text-2xl font-semibold tracking-tight min-w-0 flex-1"
                  autoFocus
                />
                <button onClick={saveName} className="text-success p-1"><Check className="h-5 w-5" /></button>
                <button onClick={() => setEditingName(false)} className="text-muted-foreground p-1"><X className="h-5 w-5" /></button>
              </div>
            ) : (
              <h1
                className="text-2xl font-semibold tracking-tight cursor-pointer active:text-primary/80 transition-colors truncate"
                onClick={() => { setEditName(doc.name); setEditingName(true); }}
                title="Click to edit"
              >
                {doc.name}
              </h1>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground truncate">{doc.originalName}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleDownload} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground active:bg-primary/90">
            <Download className="h-4 w-4" /> Download
          </button>
          <button onClick={() => setShowShareForm(true)} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm active:bg-muted">
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm text-destructive active:bg-destructive/10">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {previewUrl && (isImage || isPdf) && (
        <div className="rounded-lg border overflow-hidden">
          {isImage ? (
            <img src={previewUrl} alt={doc.name} className="mx-auto max-h-[50dvh] sm:max-h-96 object-contain" />
          ) : (
            <iframe src={previewUrl} className="h-[50dvh] sm:h-[500px] w-full" title={doc.name} />
          )}
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">Type</p>
          <p className="text-sm sm:text-base font-medium truncate">{doc.mimeType}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">Size</p>
          <p className="text-sm sm:text-base font-medium">{formatSize(doc.size)}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">Uploaded</p>
          <p className="text-sm sm:text-base font-medium">{formatDateTime(doc.createdAt)}</p>
        </div>
        <div className="rounded-lg border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">Folder</p>
            <button
              onClick={() => setShowFolderPicker(true)}
              className="text-muted-foreground active:text-foreground p-1"
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm sm:text-base font-medium truncate">{doc.folderId || 'Root'}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-medium">Tags</p>
          <button
            onClick={() => { setEditTags(doc.tags.join(', ')); setEditingTags(!editingTags); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        {editingTags ? (
          <div className="flex items-center gap-2">
            <input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTags(); if (e.key === 'Escape') setEditingTags(false); }}
              placeholder="tag1, tag2, tag3"
              className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <button onClick={saveTags} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Save</button>
            <button onClick={() => setEditingTags(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {doc.tags.length > 0 ? (
              doc.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-3 py-1 text-sm">{tag}</span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No tags</span>
            )}
          </div>
        )}
      </div>

      {showShareForm && (
        <div className="rounded-lg border p-3 sm:p-4 space-y-3">
          <h3 className="font-medium">Create Share Link</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <label className="text-sm">Expires in (hours)</label>
              <input
                type="number"
                value={shareHours}
                onChange={(e) => setShareHours(Number(e.target.value))}
                className="mt-1 block w-full sm:w-32 rounded-md border border-input bg-background px-3 py-2.5 sm:py-2"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm">Max downloads (0 = unlimited)</label>
              <input
                type="number"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(Number(e.target.value))}
                className="mt-1 block w-full sm:w-32 rounded-md border border-input bg-background px-3 py-2.5 sm:py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateShare} className="rounded-md bg-primary px-4 py-2.5 sm:py-2 text-sm text-primary-foreground active:bg-primary/90">Create</button>
            <button onClick={() => setShowShareForm(false)} className="rounded-md border px-4 py-2.5 sm:py-2 text-sm active:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {shares.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Share Links</h3>
          <div className="space-y-2">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="text-sm min-w-0">
                  <span className="font-mono text-xs">{share.token.slice(0, 16)}...</span>
                  <span className="ml-2 sm:ml-3 text-muted-foreground text-xs sm:text-sm">
                    Expires: {new Date(share.expiresAt).toLocaleString()}
                  </span>
                  {share.maxDownloads > 0 && (
                    <span className="ml-2 sm:ml-3 text-muted-foreground text-xs sm:text-sm">
                      {share.downloadCount}/{share.maxDownloads}
                    </span>
                  )}
                </div>
                <button onClick={() => copyShareUrl(share.token)} className="text-muted-foreground active:text-foreground shrink-0 p-1">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFolderPicker && (
        <MoveDialog
          documentName={doc.name}
          currentFolderId={doc.folderId}
          onConfirm={handleMoveToFolder}
          onClose={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
}
