'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Download, Trash2, Plus, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { FileIcon } from '@/components/files/file-icon';
import { formatSize } from '@/lib/utils';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';

export interface Attachment {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface AttachmentPanelProps {
  noteId: string;
  editable: boolean;
  onAttach: () => void;
  refreshKey?: number;
}

export function AttachmentPanel({ noteId, editable, onAttach, refreshKey }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const loadAttachments = useCallback(async () => {
    try {
      const res = await api<{ data: Attachment[] }>(`/api/v1/notes/${noteId}/attachments`);
      setAttachments(res.data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments, refreshKey]);

  const handleDownload = async (att: Attachment) => {
    try {
      const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${att.documentId}/download`);
      window.open(res.data.url, '_blank');
    } catch {
      toast.error('Failed to get download link');
    }
  };

  const handleRemove = async (att: Attachment) => {
    const ok = await confirm({ title: 'Remove attachment?', description: `Remove "${att.filename}" from this note?`, confirmLabel: 'Remove', variant: 'destructive' });
    if (!ok) return;
    try {
      await api(`/api/v1/notes/${noteId}/attachments/${att.documentId}`, { method: 'DELETE' });
      toast.success('Attachment removed');
      loadAttachments();
    } catch {
      toast.error('Failed to remove attachment');
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          Loading attachments...
        </div>
      </div>
    );
  }

  return (
    <>
    {ConfirmDialogElement}
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </div>
        {editable && (
          <button
            onClick={onAttach}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" /> Attach
          </button>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No attachments yet.
          {editable && (
            <button onClick={onAttach} className="ml-1 text-primary hover:underline">
              Attach a file
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y">
          {attachments.map((att) => (
            <li key={att.documentId} className="flex items-center gap-3 px-4 py-2.5">
              <FileIcon mimeType={att.mimeType} className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.filename}</p>
                <p className="text-xs text-muted-foreground">{formatSize(att.size)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/files/${att.documentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1.5 hover:bg-accent"
                  title="Open in Files"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => handleDownload(att)}
                  className="rounded p-1.5 hover:bg-accent"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {editable && (
                  <button
                    onClick={() => handleRemove(att)}
                    className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
}
