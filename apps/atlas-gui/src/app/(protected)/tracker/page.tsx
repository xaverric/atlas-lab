'use client';

import { useEffect, useState, useCallback } from 'react';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import Link from 'next/link';
import { Plus, Trash2, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface TrackerEndpoint {
  id: string;
  name: string;
  displayName: string;
  description: string;
  visibility: 'private' | 'public';
  schema: { properties: Record<string, unknown> };
  retentionDays?: number;
  createdAt: string;
  updatedAt: string;
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TrackerListPage() {
  const [endpoints, setEndpoints] = useState<TrackerEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: TrackerEndpoint[] }>('/api/v1/tracker/endpoints');
      setEndpoints(res.data);
    } catch {
      toast.error('Failed to load endpoints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (name: string) => {
    const ok = await confirm({ title: `Delete endpoint "${name}"?`, description: 'All stored data will be lost. This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      await api(`/api/v1/tracker/endpoints/${name}`, { method: 'DELETE' });
      toast.success('Endpoint deleted');
      load();
    } catch {
      toast.error('Failed to delete endpoint');
    }
  };

  if (loading) return <p className="p-8 text-muted-foreground">Loading...</p>;

  return (
    <>{ConfirmDialogElement}<div className="flex h-full flex-col">
      <PageHeader title="Data Tracker">
        <Link
          href="/tracker/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Endpoint
        </Link>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visibility</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Schema Fields</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Retention</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Updated</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id} className="border-b last:border-b-0 hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tracker/${ep.name}`} className="font-medium text-primary hover:underline">
                      {ep.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground font-mono">{ep.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ep.visibility === 'public'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {ep.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {ep.visibility}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(ep.schema?.properties || {}).map((field) => (
                        <span key={field} className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                          {field}
                        </span>
                      ))}
                      {Object.keys(ep.schema?.properties || {}).length === 0 && (
                        <span className="text-xs text-muted-foreground">none</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ep.retentionDays ? `${ep.retentionDays}d` : 'Forever'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {relativeTime(ep.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(ep.name)}
                      className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {endpoints.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No tracker endpoints yet. Create one to start collecting data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div></>
  );
}
