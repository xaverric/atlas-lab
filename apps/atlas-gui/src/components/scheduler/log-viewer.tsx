'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  meta?: unknown;
}

interface LogViewerProps {
  logs: LogEntry[];
}

const levels = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

const levelStyles: Record<string, string> = {
  debug: 'text-muted-foreground',
  info: 'text-info',
  warn: 'text-warning',
  error: 'text-destructive',
};

const badgeStyles: Record<string, string> = {
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-info/10 text-info',
  warn: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
};

export function LogViewer({ logs }: LogViewerProps) {
  const [filter, setFilter] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = filter === 'ALL' ? logs : logs.filter((l) => l.level.toUpperCase() === filter);

  const toggleMeta = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filter === level ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
            )}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-auto rounded-lg bg-[#1c1c1e] font-mono text-sm">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-muted-foreground">No logs</p>
        ) : (
          filtered.map((log, i) => (
            <div key={i} className="border-b border-white/[0.06] last:border-0">
              <div
                className={cn('flex items-start gap-2 px-3 py-1.5', log.meta ? 'cursor-pointer hover:bg-white/[0.04] transition-colors' : '')}
                onClick={() => log.meta && toggleMeta(i)}
              >
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', badgeStyles[log.level])}>
                  {log.level}
                </span>
                <span className={cn('break-all', levelStyles[log.level])}>
                  {log.message}
                </span>
              </div>
              {log.meta != null && expanded.has(i) && (
                <pre className="mx-3 mb-2 rounded-lg bg-black/30 p-2 text-xs overflow-auto">
                  {JSON.stringify(log.meta, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
