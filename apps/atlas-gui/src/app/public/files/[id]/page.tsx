'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Folder, Download, Eye, Upload, FolderPlus, Trash2,
  Pencil, ChevronRight, Home, X,
} from 'lucide-react';
import { FileIcon, canPreview } from '@/components/files/file-icon';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';

type Permission = 'view' | 'edit' | 'full';

interface FolderData {
  id: string;
  name: string;
  isPublic: boolean;
  publicPermission: Permission;
  parentId?: string | null;
  breadcrumb?: { id: string; name: string }[];
}

interface SubfolderItem {
  id: string;
  name: string;
}

interface DocumentItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  tags: string[];
  createdAt: string;
  folderId?: string | null;
}

const DMS_URL = process.env.NEXT_PUBLIC_DMS_URL || 'http://localhost:4001';

const publicApi = async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${DMS_URL}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
};

const publicUpload = async <T = unknown>(path: string, formData: FormData): Promise<T> => {
  const res = await fetch(`${DMS_URL}${path}`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const canDo = (perm: Permission, level: Permission): boolean => {
  const levels: Permission[] = ['view', 'edit', 'full'];
  return levels.indexOf(perm) >= levels.indexOf(level);
};

export default function PublicFilesPage() {
  const { id } = useParams<{ id: string }>();
  const [folder, setFolder] = useState<FolderData | null>(null);
  const [subfolders, setSubfolders] = useState<SubfolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingDoc, setRenamingDoc] = useState<DocumentItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<SubfolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const permission: Permission = folder?.publicPermission || 'view';

  const loadFolder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await publicApi<{ data: { folder: FolderData; subfolders: SubfolderItem[]; documents: DocumentItem[] } }>(
        `/public/files/folders/${id}`
      );
      setFolder(res.data.folder);
      setSubfolders(res.data.subfolders);
      setDocuments(res.data.documents);
    } catch {
      setError('Folder not found or is not public');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadFolder(); }, [loadFolder]);

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const res = await publicApi<{ data: { url: string } }>(`/public/files/documents/${doc.id}/download`);
      window.open(res.data.url, '_blank');
    } catch { /* */ }
  };

  const handlePreview = async (doc: DocumentItem) => {
    try {
      const res = await publicApi<{ data: { url: string } }>(`/public/files/documents/${doc.id}/preview`);
      setPreviewUrl(res.data.url);
      setPreviewDoc(doc);
    } catch { /* */ }
  };

  const handleUpload = async (files: FileList) => {
    let uploaded = 0;
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        formData.append('folderId', id);
        await publicUpload('/public/files/documents', formData);
        uploaded++;
      } catch { /* continue */ }
    }
    if (uploaded > 0) loadFolder();
  };

  const handleDeleteDoc = async (docId: string) => {
    const ok = await confirm({ title: 'Delete document?', description: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      await publicApi(`/public/files/documents/${docId}`, { method: 'DELETE' });
      loadFolder();
    } catch { /* */ }
  };

  const handleRenameDoc = async () => {
    if (!renamingDoc || !renameValue.trim()) return;
    try {
      await publicApi(`/public/files/documents/${renamingDoc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setRenamingDoc(null);
      loadFolder();
    } catch { /* */ }
  };

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameFolderValue.trim()) return;
    try {
      await publicApi(`/public/files/folders/${renamingFolder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameFolderValue.trim() }),
      });
      setRenamingFolder(null);
      loadFolder();
    } catch { /* */ }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await publicApi('/public/files/folders', {
        method: 'POST',
        body: JSON.stringify({ name: newFolderName.trim(), parentId: id }),
      });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolder();
    } catch { /* */ }
  };

  const handleDeleteFolder = async (fId: string) => {
    const ok = await confirm({ title: 'Delete folder?', description: 'The folder must be empty. This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      await publicApi(`/public/files/folders/${fId}`, { method: 'DELETE' });
      loadFolder();
    } catch { /* */ }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-5xl px-4 py-8 flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Not Found</h1>
            <p className="mt-2 text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !folder) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-5xl px-4 py-8 flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const breadcrumb = folder.breadcrumb || [];

  return (
    <div className="min-h-screen bg-muted">
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground">{folder.name}</h1>
        {breadcrumb.length > 0 && (
          <nav className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            {breadcrumb.map((b, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={b.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {isLast ? (
                    <span className="text-foreground">{b.name}</span>
                  ) : (
                    <Link href={`/public/files/${b.id}`} className="hover:text-foreground">
                      {b.name}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            Public ({permission})
          </span>
        </div>
      </header>

      {canDo(permission, 'full') && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent dark:border-border"
          >
            <FolderPlus className="h-4 w-4" /> New Folder
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4" /> Upload
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
        </div>
      )}

      {showNewFolder && (
        <div className="flex items-center gap-2">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            placeholder="Folder name"
            autoFocus
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm dark:border-border dark:bg-card"
          />
          <button onClick={handleCreateFolder} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="rounded-md border border-border px-3 py-1.5 text-sm dark:border-border">Cancel</button>
        </div>
      )}

      {subfolders.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Folders</h2>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {subfolders.map((sf) => (
              <div key={sf.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent dark:border-border dark:bg-card hover:bg-accent">
                {renamingFolder?.id === sf.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Folder className="h-5 w-5 text-warning shrink-0" />
                    <input
                      value={renameFolderValue}
                      onChange={(e) => setRenameFolderValue(e.target.value)}
                      onBlur={handleRenameFolder}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder();
                        if (e.key === 'Escape') setRenamingFolder(null);
                      }}
                      autoFocus
                      className="rounded border border-border px-2 py-0.5 text-sm dark:border-border dark:bg-card"
                    />
                  </div>
                ) : (
                  <Link href={`/public/files/${sf.id}`} className="flex flex-1 items-center gap-3 text-left min-w-0">
                    <Folder className="h-5 w-5 text-warning shrink-0" />
                    <span className="text-sm font-medium truncate text-foreground">{sf.name}</span>
                  </Link>
                )}
                {canDo(permission, 'edit') && (
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setRenamingFolder(sf); setRenameFolderValue(sf.name); }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {canDo(permission, 'full') && (
                      <button
                        onClick={() => handleDeleteFolder(sf.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Files</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card dark:border-border dark:bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted-foreground dark:border-border dark:text-muted-foreground">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium hidden sm:table-cell">Type</th>
                  <th className="p-3 font-medium hidden sm:table-cell">Size</th>
                  <th className="p-3 font-medium hidden md:table-cell">Uploaded</th>
                  <th className="p-3 font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border last:border-0 hover:bg-accent dark:border-border dark:hover:bg-accent"
                  >
                    <td className="p-3">
                      {renamingDoc?.id === doc.id ? (
                        <div className="flex items-center gap-2">
                          <FileIcon mimeType={doc.mimeType} className="shrink-0 text-muted-foreground" />
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleRenameDoc}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameDoc();
                              if (e.key === 'Escape') setRenamingDoc(null);
                            }}
                            autoFocus
                            className="rounded border border-border px-2 py-0.5 text-sm dark:border-border dark:bg-card"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FileIcon mimeType={doc.mimeType} className="shrink-0 text-muted-foreground" />
                          <span className="text-sm text-foreground truncate max-w-xs">{doc.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {doc.mimeType.split('/').pop()}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {formatSize(doc.size)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {canPreview(doc.mimeType) && (
                          <button onClick={() => handlePreview(doc)} className="p-1 text-muted-foreground hover:text-foreground" title="Preview">
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => handleDownload(doc)} className="p-1 text-muted-foreground hover:text-foreground" title="Download">
                          <Download className="h-4 w-4" />
                        </button>
                        {canDo(permission, 'edit') && (
                          <button
                            onClick={() => { setRenamingDoc(doc); setRenameValue(doc.name); }}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDo(permission, 'full') && (
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subfolders.length === 0 && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">This folder is empty</h3>
          {canDo(permission, 'full') && (
            <p className="mt-1 text-sm text-muted-foreground">Upload files or create subfolders to get started.</p>
          )}
        </div>
      )}

      {previewDoc && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-card shadow-xl dark:bg-card mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon mimeType={previewDoc.mimeType} className="shrink-0" />
                <span className="font-medium truncate text-foreground">{previewDoc.name}</span>
                <span className="text-sm text-muted-foreground shrink-0">({formatSize(previewDoc.size)})</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleDownload(previewDoc)} className="rounded p-2 hover:bg-accent">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }} className="rounded p-2 hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.name} className="mx-auto max-h-[70vh] object-contain" />
              ) : previewDoc.mimeType.startsWith('video/') ? (
                <video src={previewUrl} controls playsInline className="mx-auto max-h-[70vh] w-full" />
              ) : previewDoc.mimeType.includes('pdf') ? (
                <iframe src={previewUrl} className="h-[70vh] w-full rounded border" title={previewDoc.name} />
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">Preview not available</div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-muted-foreground dark:text-muted-foreground">
        Powered by Atlas File Storage
      </footer>
    </div>
    {ConfirmDialogElement}
    </div>
  );
}
