'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Globe, Lock, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { htmlToMarkdown } from '@/lib/markdown';

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

  const folderName = folders.find((f) => f.id === folderId)?.name ?? 'Root';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 px-12 py-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
            autoFocus
          />

          <div className="flex flex-wrap items-center gap-3 border-b pb-4">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma separated)"
              className="rounded-full border bg-secondary/50 px-3 py-1 text-xs outline-none placeholder:text-muted-foreground/60 w-48 focus:ring-1 focus:ring-ring"
            />

            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="rounded-full border bg-secondary/50 px-3 py-1 text-xs outline-none cursor-pointer focus:ring-1 focus:ring-ring"
            >
              <option value="">Root</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                isPublic ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {isPublic ? 'Public' : 'Private'}
            </button>
          </div>

          <TiptapEditor content="" onChange={setHtml} />
        </div>
      </div>

      <div className="border-t bg-background px-12 py-3">
        <div className="mx-auto flex max-w-4xl justify-end gap-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            <X className="h-4 w-4" /> Cancel
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
    </div>
  );
}
