'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface StorageBreakdown {
  name: string;
  bytes: number;
  formatted: string;
  color: string;
}

interface StorageStats {
  total: { bytes: number; formatted: string };
  breakdown: StorageBreakdown[];
  updatedAt: string;
}

export function StorageChart() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    api<{ data: StorageStats }>('/api/v1/system/storage')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load storage stats: {error}
      </div>
    );
  }

  if (!stats || loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading storage stats...
      </div>
    );
  }

  const nonZero = stats.breakdown.filter((b) => b.bytes > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-3xl font-bold tracking-tight">{stats.total.formatted}</span>
          <span className="ml-2 text-sm text-muted-foreground">total</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {new Date(stats.updatedAt).toLocaleString()}
          </span>
          <button onClick={load} className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stacked horizontal bar — bigger */}
      <div className="flex h-12 w-full overflow-hidden rounded-xl">
        {nonZero.map((segment) => {
          const pct = (segment.bytes / stats.total.bytes) * 100;
          if (pct < 0.3) return null;
          return (
            <div
              key={segment.name}
              title={`${segment.name}: ${segment.formatted} (${pct.toFixed(1)}%)`}
              className="transition-all duration-500 hover:opacity-80 cursor-default"
              style={{
                width: `${pct}%`,
                backgroundColor: segment.color,
                minWidth: pct > 0 ? '3px' : 0,
              }}
            />
          );
        })}
      </div>

      {/* Legend — 3 columns with percentages */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.breakdown.map((item) => {
          const pct = stats.total.bytes > 0 ? (item.bytes / stats.total.bytes) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <span
                className="inline-block h-4 w-4 shrink-0 rounded"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
              </div>
              <span className="shrink-0 text-sm font-semibold">{item.formatted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
