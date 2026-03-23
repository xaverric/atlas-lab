'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Trash2, Pencil, X, Link, Clock, Info, Globe, Lock } from 'lucide-react';
import { ItemInfoModal } from './item-info-modal';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';
import { api } from '@/lib/api';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { NoteViewer } from '@/components/notes/note-viewer';
import { AttachmentPanel } from '@/components/notes/attachment-panel';
import { FilePickerDialog } from '@/components/notes/file-picker-dialog';
import { CodeMirrorEditor } from '@/components/shared/codemirror-editor';
import { HistoryDrawer } from '@/components/notes/history-drawer';
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
  publicPermission?: 'view' | 'edit';
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

export interface NoteDetailProps {
  noteId: string;
  onBack: () => void;
  onNoteUpdate?: () => void;
}

export function NoteDetail({ noteId, onBack, onNoteUpdate }: NoteDetailProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [publicPermission, setPublicPermission] = useState<'view' | 'edit'>('view');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>('view');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const editorRef = useRef<{ insertImage: (url: string, docId: string, alt: string) => void; insertLink: (url: string, docId: string, text: string) => void } | null>(null);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

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
      const res = await api<{ data: Note }>(`/api/v1/notes/${noteId}`);
      const n = res.data;
      setNote(n);
      setTitle(n.title);

      const rawHtml = markdownToHtml(n.content);
      const resolvedHtml = await resolveAttachmentUrls(rawHtml);
      setHtml(resolvedHtml);

      setTags(n.tags.join(', '));
      setFolderId(n.folderId || '');
      setIsPublic(n.isPublic);
      setPublicPermission(n.publicPermission || 'view');
      setLoaded(true);
    } catch {
      toast.error('Failed to load note');
      onBack();
    }
  }, [noteId, onBack]);

  useEffect(() => { loadNote(); }, [loadNote]);

  useEffect(() => { setShowHistory(false); setMode('view'); setLoaded(false); }, [noteId]);

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
    setPublicPermission(note.publicPermission || 'view');
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
        publicPermission: isPublic ? publicPermission : undefined,
      };

      await api(`/api/v1/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success('Note saved');
      await loadNote();
      setMode('view');
      onNoteUpdate?.();
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete note?', description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      await api(`/api/v1/notes/${noteId}`, { method: 'DELETE' });
      toast.success('Note deleted');
      onBack();
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
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="px-12 py-8">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between">
                <button onClick={onBack} className="rounded-md p-1 hover:bg-accent">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Clock className="h-4 w-4" /> History
                  </button>
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

              <h1 className="mt-6 text-4xl font-bold tracking-tight">{note?.title}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                {note && note.tags.length > 0 &&
                  note.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-primary">{tag}</span>
                  ))
                }
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-primary">{folderName}</span>
                <button
                  onClick={() => setShowInfo(true)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                    note?.isPublic ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {note?.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {note?.isPublic ? `Public (${note.publicPermission === 'edit' ? 'editable' : 'view only'})` : 'Private'}
                </button>
                {note?.isPublic && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/public/notes/${note.id}`); toast.success('Public link copied'); }}
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Link className="h-3 w-3" /> Copy link
                  </button>
                )}
                {note && <span className="text-xs">Updated {formatDate(note.updatedAt)}</span>}
                <button onClick={() => setShowInfo(true)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" title="Note info">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-8 prose dark:prose-invert prose-base max-w-none leading-relaxed">
                <NoteViewer html={html} />
              </div>

              <div className="mt-8">
                <AttachmentPanel
                  noteId={noteId}
                  editable={false}
                  onAttach={() => {}}
                  refreshKey={attachmentRefreshKey}
                />
              </div>

              {showFilePicker && note && (
                <FilePickerDialog
                  noteId={noteId}
                  dmsFolderId={note.dmsFolderId}
                  onClose={() => setShowFilePicker(false)}
                  onAttached={(att) => {
                    handleAttached(att);
                    setShowFilePicker(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <HistoryDrawer
          noteId={noteId}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          onRestore={() => { loadNote(); setShowHistory(false); }}
        />
        {showInfo && (
          <ItemInfoModal type="note" itemId={noteId} onClose={() => setShowInfo(false)} onUpdate={() => loadNote()} />
        )}
        {ConfirmDialogElement}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="px-12 py-6">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={cancelEdit} className="rounded-md p-1 hover:bg-accent">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm text-muted-foreground">Editing</span>
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
                placeholder="Untitled"
                className="mt-6 w-full bg-transparent text-[32px] font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
              />

              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                {note && note.tags.length > 0 &&
                  note.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-primary">{tag}</span>
                  ))
                }
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-primary">{folderName}</span>
                <button
                  onClick={() => setShowInfo(true)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                    isPublic ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {isPublic ? `Public (${publicPermission === 'edit' ? 'editable' : 'view only'})` : 'Private'}
                </button>
              </div>
            </div>
          </div>

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

          <div className="px-12 py-4">
            <div className="mx-auto max-w-3xl">
              <AttachmentPanel
                noteId={noteId}
                editable={true}
                onAttach={() => setShowFilePicker(true)}
                refreshKey={attachmentRefreshKey}
              />
            </div>
          </div>

          {showFilePicker && note && (
            <FilePickerDialog
              noteId={noteId}
              dmsFolderId={note.dmsFolderId}
              onClose={() => setShowFilePicker(false)}
              onAttached={(att) => {
                handleAttached(att);
                setShowFilePicker(false);
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-card px-12 py-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{html.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length} words</span>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="h-3.5 w-3.5" /> History
            </button>
            <button
              onClick={() => setShowInfo(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" /> Settings
            </button>
          </div>
          <div className="flex items-center gap-2">
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
        </div>
      </div>
      <HistoryDrawer
        noteId={noteId}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={() => { loadNote(); setShowHistory(false); }}
      />
      {showInfo && (
        <ItemInfoModal type="note" itemId={noteId} onClose={() => setShowInfo(false)} onUpdate={() => loadNote()} />
      )}
      {ConfirmDialogElement}
    </>
  );
}
