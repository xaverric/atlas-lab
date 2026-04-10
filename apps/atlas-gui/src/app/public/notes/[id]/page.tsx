'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { NoteViewer } from '@/components/notes/note-viewer';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { markdownToHtml, htmlToMarkdown } from '@/lib/markdown';

type Permission = 'view' | 'edit' | 'full';

interface PublicNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  publicPermission?: Permission;
  createdAt: string;
  updatedAt: string;
}

const publicApi = async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
};

const canDo = (perm: Permission, level: Permission): boolean => {
  const levels: Permission[] = ['view', 'edit', 'full'];
  return levels.indexOf(perm) >= levels.indexOf(level);
};

export default function PublicNotePage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<PublicNote | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const permission: Permission = note?.publicPermission || 'view';

  const loadNote = useCallback(async () => {
    try {
      const res = await publicApi<{ data: PublicNote }>(`/public/notes/${id}`);
      setNote(res.data);
      setHtml(markdownToHtml(res.data.content));
      setTitle(res.data.title);
    } catch {
      setError('Note not found or is not public');
    }
  }, [id]);

  useEffect(() => { loadNote(); }, [loadNote]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const content = htmlToMarkdown(html);
      await publicApi(`/public/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: title.trim(), content }),
      });
      await loadNote();
      setEditing(false);
    } catch { /* */ } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (note) {
      setHtml(markdownToHtml(note.content));
      setTitle(note.title);
    }
    setEditing(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-3xl px-4 py-8 flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Not Found</h1>
            <p className="mt-2 text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-3xl px-4 py-8 flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (editing) {
    return (
      <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={cancelEdit} className="rounded-md p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Edit Note</h1>
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="w-full rounded-md bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 py-2 text-lg font-medium  dark:bg-[#1c1c1e] dark:text-foreground"
        />

        <TiptapEditor content={html} onChange={setHtml} />

        <div className="flex justify-end gap-2">
          <button onClick={cancelEdit} className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ">
            <X className="h-4 w-4" /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {note.folderId && (
            <Link href={`/public/notes/folders/${note.folderId}`} className="rounded-md p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
          )}
          <h1 className="text-2xl font-bold text-foreground">{note.title}</h1>
        </div>
        {canDo(permission, 'edit') && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] "
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
      </div>

      <div className="rounded-md bg-[#f5f5f7] dark:bg-[#1c1c1e] p-6  dark:bg-[#1c1c1e]">
        <NoteViewer html={html} skipAttachmentResolve />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {note.tags.length > 0 && (
          <div className="flex items-center gap-2">
            <span>Tags:</span>
            <div className="flex gap-1">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        <span>Updated: {formatDate(note.updatedAt)}</span>
      </div>

      <footer className="text-center text-xs text-muted-foreground">
        Powered by Atlas Notes
      </footer>
    </div>
    </div>
  );
}
