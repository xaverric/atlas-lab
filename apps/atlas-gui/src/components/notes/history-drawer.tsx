'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  const handleRestore = async (rev: Revision) => {
    if (!confirm('Restore this version? Current content will be replaced.')) return;
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

  // version label: count from oldest (1 = oldest)
  const versionIndex = Object.fromEntries(
    [...revisions].reverse().map((r, i) => [r.id, i + 1])
  );

  return (
    <div className="w-[300px] border-l flex flex-col bg-background shrink-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium">History</span>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 py-2">
        {loading && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</p>
        )}

        {!loading && revisions.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No history yet</p>
        )}

        {!loading && groups.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-1">
              {label}
            </p>
            {items.map((rev) => {
              const isCurrent = rev.id === mostRecentId;
              return (
                <div
                  key={rev.id}
                  className={cn(
                    'px-4 py-2.5 rounded-md mx-2 cursor-pointer hover:bg-accent/50',
                    isCurrent && 'bg-accent/30 border-l-2 border-info'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      Version {versionIndex[rev.id]}
                    </span>
                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(rev)}
                        className="shrink-0 flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{rev.editorName}</p>
                  {rev.summary && (
                    <p className="text-xs text-muted-foreground truncate">{rev.summary}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(rev.createdAt)}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
