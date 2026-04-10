'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getUserManager } from '@/lib/auth';
import { UploadQueue } from '@/components/files/upload-queue';
import type { UploadItem } from '@/components/files/upload-queue';
import { MoveDialog } from '@/components/files/move-dialog';
import { PageHeader } from '@/components/shared/page-header';

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFolderId = searchParams.get('folderId') || '';
  const [folderId, setFolderId] = useState(initialFolderId);
  const [folderName, setFolderName] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [tags, setTags] = useState('');
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    api<{ data: string[] }>('/api/v1/files/documents/tags')
      .then((res) => setAvailableTags(res.data))
      .catch(() => {});

    if (initialFolderId) {
      api<{ data: { name: string } }>(`/api/v1/files/folders/${initialFolderId}`)
        .then((res) => setFolderName(res.data.name))
        .catch(() => {});
    }
  }, [initialFolderId]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const items: UploadItem[] = Array.from(files).map((file) => ({
      id: String(++idCounter.current),
      file,
      name: file.name,
      progress: 0,
      status: 'pending' as const,
    }));
    setQueue((prev) => [...prev, ...items]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const uploadOne = async (item: UploadItem, token: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('name', item.name);
      if (folderId) formData.append('folderId', folderId);
      if (tags.trim()) {
        formData.append('tags', JSON.stringify(tags.split(',').map((t) => t.trim()).filter(Boolean)));
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, progress, status: 'uploading' } : q));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, progress: 100, status: 'done' } : q));
          resolve(true);
        } else {
          const error = (() => { try { return JSON.parse(xhr.responseText).error; } catch { return 'Upload failed'; } })();
          setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: 'error', error } : q));
          resolve(false);
        }
      };

      xhr.onerror = () => {
        setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: 'error', error: 'Network error' } : q));
        resolve(false);
      };

      const baseUrl = process.env.NEXT_PUBLIC_DMS_URL || 'http://localhost:4001';
      xhr.open('POST', `${baseUrl}/api/v1/files/documents`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  const handleSubmit = async () => {
    const pending = queue.filter((q) => q.status === 'pending' || q.status === 'error');
    if (pending.length === 0) return;

    setUploading(true);
    const um = getUserManager();
    const user = await um.getUser();
    const token = user?.access_token || '';

    let allOk = true;
    for (const item of pending) {
      setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: 'uploading', progress: 0 } : q));
      const ok = await uploadOne(item, token);
      if (!ok) allOk = false;
    }

    setUploading(false);

    if (allOk) {
      toast.success(`${pending.length} file(s) uploaded`);
      setTimeout(() => router.push(`/files${folderId ? `?folderId=${folderId}` : ''}`), 500);
    } else {
      toast.error('Some uploads failed');
    }
  };

  const currentTagPrefix = tags.split(',').pop()?.trim().toLowerCase() || '';
  const filteredSuggestions = availableTags.filter(
    (t) => t && t.toLowerCase().includes(currentTagPrefix) && !tags.split(',').map((s) => s.trim()).includes(t),
  );

  const handleFolderSelect = (id: string | null) => {
    setFolderId(id || '');
    if (id) {
      api<{ data: { name: string } }>(`/api/v1/files/folders/${id}`)
        .then((res) => setFolderName(res.data.name))
        .catch(() => setFolderName(''));
    } else {
      setFolderName('');
    }
  };

  const selectTag = (tag: string) => {
    const parts = tags.split(',').map((s) => s.trim()).filter(Boolean);
    parts.pop();
    parts.push(tag);
    setTags(parts.join(', ') + ', ');
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Upload Files" />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 sm:p-8 transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Drag and drop files, or</p>
        <label className="mt-2 cursor-pointer rounded-lg bg-[#0071e3] px-4 py-2.5 sm:py-2 text-sm font-medium text-white active:opacity-90">
          Browse Files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }}
          />
        </label>
      </div>

      <UploadQueue items={queue} onRemove={removeFromQueue} />

      <div className="space-y-3 sm:space-y-4">
        <div>
          <label className="text-sm font-medium">Destination folder</label>
          <button
            type="button"
            onClick={() => setShowFolderPicker(true)}
            className="mt-1 flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 sm:py-2 text-sm text-left active:bg-black/[0.04] dark:active:bg-white/[0.06]"
          >
            <Folder className="h-4 w-4 text-warning shrink-0" />
            <span className={folderName || folderId ? 'text-foreground' : 'text-muted-foreground'}>
              {folderName || (folderId ? folderId : 'Root (click to change)')}
            </span>
          </button>
        </div>

        <div className="relative">
          <label htmlFor="tags" className="text-sm font-medium">Tags (comma-separated)</label>
          <input
            id="tags"
            ref={tagInputRef}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            placeholder="invoice, 2024, personal"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2.5 sm:py-2 text-sm"
          />
          {showTagSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
              {filteredSuggestions.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onMouseDown={() => selectTag(tag)}
                  className="block w-full px-3 py-2.5 sm:py-1.5 text-left text-sm active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={queue.filter((q) => q.status === 'pending' || q.status === 'error').length === 0 || uploading}
          className="flex-1 sm:flex-none rounded-lg bg-[#0071e3] px-4 py-2.5 sm:py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : `Upload ${queue.filter((q) => q.status === 'pending' || q.status === 'error').length} file(s)`}
        </button>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#2c2c2e] dark:text-white px-4 py-2.5 sm:py-2 text-sm hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]"
        >
          Cancel
        </button>
      </div>

      {showFolderPicker && (
        <MoveDialog
          title="Select upload folder"
          confirmLabel="Select"
          currentFolderId={folderId || null}
          onConfirm={handleFolderSelect}
          onClose={() => setShowFolderPicker(false)}
        />
      )}
        </div>
      </div>
    </div>
  );
}
