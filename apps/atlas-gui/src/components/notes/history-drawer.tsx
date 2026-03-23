'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';

interface Revision {
  id: string;
  editorName: string;
  summary: string;
  createdAt: string;
}

interface HistoryDrawerProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function groupByDate(revisions: Revision[]): { label: string; items: Revision[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, Revision[]> = {};
  for (const rev of revisions) {
    const d = new Date(rev.createdAt); d.setHours(0, 0, 0, 0);
    const label = d >= today ? 'Today' : d >= yesterday ? 'Yesterday' : 'Earlier';
    (groups[label] ??= []).push(rev);
  }
  return ['Today', 'Yesterday', 'Earlier']
    .filter((l) => groups[l]?.length)
    .map((label) => ({ label, items: groups[label] }));
}

export function HistoryDrawer({ noteId, isOpen, onClose, onRestore }: HistoryDrawerProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: Revision[] }>(`/api/v1/notes/${noteId}/revisions`);
      setRevisions(res.data);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (isOpen) fetchRevisions();
  }, [isOpen, fetchRevisions]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleRestore = async (rev: Revision) => {
    const ok = await confirm({ title: 'Restore version?', description: 'Current content will be replaced with this version.', confirmLabel: 'Restore' });
    if (!ok) return;
    try {
      await api(`/api/v1/notes/${noteId}/revisions/${rev.id}/restore`, { method: 'POST' });
      toast.success('Version restored');
      onRestore();
    } catch {
      toast.error('Failed to restore version');
    }
  };

  if (!isOpen) return null;

  const groups = groupByDate(revisions);
  const mostRecentId = revisions[0]?.id;
  const versionIndex = Object.fromEntries(
    [...revisions].reverse().map((r, i) => [r.id, i + 1])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      {ConfirmDialogElement}
      <div
        className="relative w-full max-w-md max-h-[80vh] rounded-xl border bg-card shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Version History</h2>
            <p className="text-xs text-muted-foreground">{revisions.length} version{revisions.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 py-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && revisions.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">No history yet. Changes will appear here after saving.</p>
          )}

          {!loading && groups.map(({ label, items }) => (
            <div key={label} className="mb-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold px-5 py-1.5">
                {label}
              </p>
              {items.map((rev) => {
                const isCurrent = rev.id === mostRecentId;
                return (
                  <div
                    key={rev.id}
                    className={cn(
                      'mx-3 px-3 py-3 rounded-lg transition-colors',
                      isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          'text-sm font-medium',
                          isCurrent && 'text-primary'
                        )}>
                          {isCurrent ? 'Current' : `Version ${versionIndex[rev.id]}`}
                        </span>
                        <span className="text-xs text-muted-foreground">{relativeTime(rev.createdAt)}</span>
                      </div>
                      {!isCurrent && (
                        <button
                          onClick={() => handleRestore(rev)}
                          className="shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{rev.editorName}</span>
                      {rev.summary && <span>· {rev.summary}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
