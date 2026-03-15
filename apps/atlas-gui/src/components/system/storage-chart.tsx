'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    api<{ data: StorageStats }>('/api/v1/system/storage')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        Failed to load storage stats: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading storage stats...
      </div>
    );
  }

  const nonZero = stats.breakdown.filter((b) => b.bytes > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold">{stats.total.formatted}</span>
        <span className="text-xs text-muted-foreground">
          Updated {new Date(stats.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex h-10 w-full overflow-hidden rounded-lg">
        {nonZero.map((segment) => {
          const pct = (segment.bytes / stats.total.bytes) * 100;
          if (pct < 0.3) return null;
          return (
            <div
              key={segment.name}
              title={`${segment.name}: ${segment.formatted}`}
              className="transition-all duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: segment.color,
                minWidth: pct > 0 ? '2px' : 0,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {stats.breakdown.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-medium">{item.formatted}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
