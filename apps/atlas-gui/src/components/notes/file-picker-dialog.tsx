'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Folder, ChevronRight, Upload, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { FileIcon } from '@/components/files/file-icon';
import { formatSize } from '@/lib/utils';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

interface FolderItem {
  id: string;
  name: string;
}

interface FilePickerDialogProps {
  noteId: string;
  dmsFolderId: string | null;
  onClose: () => void;
  onAttached: (attachment: { documentId: string; filename: string; mimeType: string; size: number }) => void;
}

export function FilePickerDialog({ noteId, dmsFolderId, onClose, onAttached }: FilePickerDialogProps) {
  const [tab, setTab] = useState<'browse' | 'upload'>('browse');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Attach File</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('browse')}
            className={`px-4 py-2.5 text-sm font-medium ${tab === 'browse' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Browse Files
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`px-4 py-2.5 text-sm font-medium ${tab === 'upload' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Upload New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'browse' ? (
            <BrowseTab noteId={noteId} onAttached={onAttached} />
          ) : (
            <UploadTab noteId={noteId} dmsFolderId={dmsFolderId} onAttached={onAttached} />
          )}
        </div>
      </div>
    </div>
  );
}

function BrowseTab({ noteId, onAttached }: { noteId: string; onAttached: FilePickerDialogProps['onAttached'] }) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState<string | null>(null);

  const loadContents = useCallback(async (id: string | null) => {
    setLoading(true);
    try {
      const folderQuery = id ? `?parentId=${id}` : '';
      const fileQuery = new URLSearchParams({ limit: '50' });
      if (id) fileQuery.set('folderId', id);

      const [fRes, dRes] = await Promise.all([
        api<{ data: FolderItem[] }>(`/api/v1/files/folders${folderQuery}`),
        api<{ data: FileItem[]; total: number }>(`/api/v1/files/documents?${fileQuery}`),
      ]);
      setFolders(fRes.data);
      setFiles(dRes.data);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContents(folderId);
  }, [folderId, loadContents]);

  const navigateInto = (folder: FolderItem) => {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setFolderId(folder.id);
  };

  const navigateBack = () => {
    if (folderStack.length <= 1) return;
    const newStack = folderStack.slice(0, -1);
    setFolderStack(newStack);
    setFolderId(newStack[newStack.length - 1].id);
  };

  const handlePick = async (file: FileItem) => {
    setAttaching(file.id);
    try {
      const body = { documentId: file.id, filename: file.name, mimeType: file.mimeType, size: file.size };
      await api(`/api/v1/notes/${noteId}/attachments`, { method: 'POST', body: JSON.stringify(body) });
      toast.success(`"${file.name}" attached`);
      onAttached(body);
    } catch {
      toast.error('Failed to attach file');
    } finally {
      setAttaching(null);
    }
  };

  const currentFolder = folderStack[folderStack.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {folderStack.length > 1 && (
          <button onClick={navigateBack} className="rounded p-1 hover:bg-accent">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-1">
          {folderStack.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={i === folderStack.length - 1 ? 'font-medium text-foreground' : ''}>
                {item.name}
              </span>
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => navigateInto(folder)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span>{folder.name}</span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => handlePick(file)}
              disabled={attaching === file.id}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              <FileIcon mimeType={file.mimeType} className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate text-left">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
            </button>
          ))}
          {folders.length === 0 && files.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {currentFolder.id ? 'This folder is empty' : 'No files yet'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function UploadTab({
  noteId,
  dmsFolderId,
  onAttached,
}: {
  noteId: string;
  dmsFolderId: string | null;
  onAttached: FilePickerDialogProps['onAttached'];
}) {
  const [uploading, setUploading] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(dmsFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureFolder = async (): Promise<string> => {
    if (targetFolderId) return targetFolderId;
    const res = await api<{ data: { id: string } }>('/api/v1/files/folders', {
      method: 'POST',
      body: JSON.stringify({ name: `Note Attachments` }),
    });
    const id = res.data.id;
    setTargetFolderId(id);

    await api(`/api/v1/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dmsFolderId: id }),
    }).catch(() => {});

    return id;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fId = await ensureFolder();
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        formData.append('folderId', fId);
        const res = await uploadFile<{ data: { id: string; name: string; mimeType: string; size: number } }>(
          '/api/v1/files/documents',
          formData,
        );
        const doc = res.data;
        const body = { documentId: doc.id, filename: doc.name, mimeType: doc.mimeType, size: doc.size };
        await api(`/api/v1/notes/${noteId}/attachments`, { method: 'POST', body: JSON.stringify(body) });
        toast.success(`"${doc.name}" uploaded and attached`);
        onAttached(body);
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleUpload(e.dataTransfer.files);
        }}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {uploading ? 'Uploading...' : 'Drag files here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Files will be stored in the note's attachment folder</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Choose Files'}
        </button>
      </div>
    </div>
  );
}
