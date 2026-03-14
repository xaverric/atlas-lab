'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { htmlToMarkdown, markdownToHtml } from '@/lib/markdown';

interface FolderOption {
  id: string;
  name: string;
}

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFolderId = searchParams.get('folderId') || '';

  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState(initialFolderId);
  const [isPublic, setIsPublic] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ data: FolderOption[] }>('/api/v1/notes/folders')
      .then((res) => setFolders(res.data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const content = htmlToMarkdown(html);
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = { title: title.trim(), content, tags: tagList, isPublic };
      if (folderId) body.folderId = folderId;

      const res = await api<{ data: { id: string } }>('/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Note created');
      router.push(`/notes/${res.data.id}`);
    } catch {
      toast.error('Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-md p-1 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">New Note</h1>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="w-full rounded-md border bg-background px-3 py-2 text-lg font-medium"
      />

      <TiptapEditor content="" onChange={setHtml} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Tags (comma separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tag1, tag2"
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Folder</label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Root</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            Public
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => router.back()} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Create Note'}
        </button>
      </div>
    </div>
  );
}
