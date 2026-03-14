'use client';

import { useEffect, useState, useCallback } from 'react';
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
    if (!confirm(`Delete endpoint "${name}"? All stored data will be lost.`)) return;
    try {
      await api(`/api/v1/tracker/endpoints/${name}`, { method: 'DELETE' });
      toast.success('Endpoint deleted');
      load();
    } catch {
      toast.error('Failed to delete endpoint');
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/tracker/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Endpoint
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="p-3">Name</th>
              <th className="p-3">Visibility</th>
              <th className="p-3">Schema Fields</th>
              <th className="p-3">Retention</th>
              <th className="p-3">Updated</th>
              <th className="p-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="p-3">
                  <Link href={`/tracker/${ep.name}`} className="hover:underline font-medium">
                    {ep.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono">{ep.name}</p>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ep.visibility === 'public'
                      ? 'bg-info/10 text-info'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {ep.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {ep.visibility}
                  </span>
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {Object.keys(ep.schema?.properties || {}).length} fields
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {ep.retentionDays ? `${ep.retentionDays}d` : 'Forever'}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {relativeTime(ep.updatedAt)}
                </td>
                <td className="p-3">
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
  );
}
