'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, Pencil, X, Copy, Link } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { NoteViewer } from '@/components/notes/note-viewer';
import { AttachmentPanel } from '@/components/notes/attachment-panel';
import { FilePickerDialog } from '@/components/notes/file-picker-dialog';
import { CodeMirrorEditor } from '@/components/shared/codemirror-editor';
import { htmlToMarkdown, markdownToHtml, resolveAttachmentUrls } from '@/lib/markdown';

interface Attachment {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  isPublic: boolean;
  dmsFolderId: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

interface FolderOption {
  id: string;
  name: string;
}

type Mode = 'view' | 'edit';

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>('view');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const editorRef = useRef<{ insertImage: (url: string, docId: string, alt: string) => void; insertLink: (url: string, docId: string, text: string) => void } | null>(null);

  const toggleMarkdown = () => {
    if (isMarkdown) {
      const newHtml = markdownToHtml(markdownContent);
      setHtml(newHtml);
      setIsMarkdown(false);
    } else {
      const md = htmlToMarkdown(html);
      setMarkdownContent(md);
      setIsMarkdown(true);
    }
  };

  const loadNote = useCallback(async () => {
    try {
      const res = await api<{ data: Note }>(`/api/v1/notes/${id}`);
      const n = res.data;
      setNote(n);
      setTitle(n.title);

      const rawHtml = markdownToHtml(n.content);
      const resolvedHtml = await resolveAttachmentUrls(rawHtml);
      setHtml(resolvedHtml);

      setTags(n.tags.join(', '));
      setFolderId(n.folderId || '');
      setIsPublic(n.isPublic);
      setLoaded(true);
    } catch {
      toast.error('Failed to load note');
      router.push('/notes');
    }
  }, [id, router]);

  useEffect(() => { loadNote(); }, [loadNote]);

  useEffect(() => {
    api<{ data: FolderOption[] }>('/api/v1/notes/folders')
      .then((res) => setFolders(res.data))
      .catch(() => {});
  }, []);

  const resetToNote = async () => {
    if (!note) return;
    setTitle(note.title);
    const rawHtml = markdownToHtml(note.content);
    const resolvedHtml = await resolveAttachmentUrls(rawHtml);
    setHtml(resolvedHtml);
    setTags(note.tags.join(', '));
    setFolderId(note.folderId || '');
    setIsPublic(note.isPublic);
  };

  const enterEdit = () => setMode('edit');

  const cancelEdit = () => {
    resetToNote();
    setIsMarkdown(false);
    setMode('view');
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const content = isMarkdown ? markdownContent : htmlToMarkdown(html);
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        title: title.trim(),
        content,
        tags: tagList,
        folderId: folderId || null,
        isPublic,
      };

      await api(`/api/v1/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success('Note saved');
      await loadNote();
      setMode('view');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;
    try {
      await api(`/api/v1/notes/${id}`, { method: 'DELETE' });
      toast.success('Note deleted');
      router.push('/notes');
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const handleAttached = async (att: { documentId: string; filename: string; mimeType: string; size: number }) => {
    setAttachmentRefreshKey((k) => k + 1);

    if (mode === 'edit') {
      const isImage = att.mimeType.startsWith('image/');
      if (isImage) {
        try {
          const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${att.documentId}/preview`);
          const imgTag = `<img src="${res.data.url}" alt="${att.filename}" data-attachment-id="${att.documentId}">`;
          setHtml((prev) => prev + imgTag);
        } catch { /* silent */ }
      } else {
        try {
          const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${att.documentId}/download`);
          const linkTag = `<p><a href="${res.data.url}" data-attachment-id="${att.documentId}">${att.filename}</a></p>`;
          setHtml((prev) => prev + linkTag);
        } catch { /* silent */ }
      }
    }
  };

  const folderName = folders.find((f) => f.id === note?.folderId)?.name ?? 'Root';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (!loaded) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>;
  }

  if (mode === 'view') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(note?.folderId ? `/notes?folderId=${note.folderId}` : '/notes')} className="rounded-md p-1 hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">{note?.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enterEdit}
              className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </div>

        <div className="rounded-md border p-6">
          <NoteViewer html={html} />
        </div>

        <AttachmentPanel
          noteId={id}
          editable={false}
          onAttach={() => {}}
          refreshKey={attachmentRefreshKey}
        />

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {note && note.tags.length > 0 && (
            <div className="flex items-center gap-2">
              <span>Tags:</span>
              <div className="flex gap-1">
                {note.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <span>Folder: {folderName}</span>
          {note?.isPublic && (
            <>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Public</span>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/public/notes/${note.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Public link copied');
                }}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Link className="h-3 w-3" /> Copy public link
              </button>
            </>
          )}
          {note && <span>Updated: {formatDate(note.updatedAt)}</span>}
        </div>

        {showFilePicker && note && (
          <FilePickerDialog
            noteId={id}
            dmsFolderId={note.dmsFolderId}
            onClose={() => setShowFilePicker(false)}
            onAttached={(att) => {
              handleAttached(att);
              setShowFilePicker(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={cancelEdit} className="rounded-md p-1 hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Note</h1>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="w-full rounded-md border bg-background px-3 py-2 text-lg font-medium"
      />

      <TiptapEditor
        content={html}
        onChange={setHtml}
        isMarkdown={isMarkdown}
        onToggleMarkdown={toggleMarkdown}
        onInsertImage={() => setShowFilePicker(true)}
      >
        {isMarkdown && (
          <CodeMirrorEditor
            value={markdownContent}
            onChange={setMarkdownContent}
            language="markdown"
            minHeight="400px"
          />
        )}
      </TiptapEditor>

      <AttachmentPanel
        noteId={id}
        editable={true}
        onAttach={() => setShowFilePicker(true)}
        refreshKey={attachmentRefreshKey}
      />

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
        <button onClick={cancelEdit} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent">
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {showFilePicker && note && (
        <FilePickerDialog
          noteId={id}
          dmsFolderId={note.dmsFolderId}
          onClose={() => setShowFilePicker(false)}
          onAttached={(att) => {
            handleAttached(att);
            setShowFilePicker(false);
          }}
        />
      )}
    </div>
  );
}
