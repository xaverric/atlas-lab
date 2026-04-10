'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getStatusClasses } from '@/lib/status-colors';
import { PageHeader } from '@/components/shared/page-header';

interface AuditEvent {
  id: string;
  timestamp: string;
  service: string;
  action: string;
  userId?: string;
  userName?: string;
  resourceType?: string;
  resourceId?: string;
  status: string;
  duration?: number;
  request?: Record<string, unknown>;
  result?: Record<string, unknown>;
  details?: Record<string, unknown>;
  error?: string;
}

interface ListResponse {
  data: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

const SERVICES = [
  { value: '', label: 'All Services' },
  { value: 'atlas-core', label: 'atlas-core' },
  { value: 'atlas-dms', label: 'atlas-dms' },
  { value: 'atlas-scheduler', label: 'atlas-scheduler' },
  { value: 'atlas-notify', label: 'atlas-notify' },
  { value: 'atlas-notes', label: 'atlas-notes' },
  { value: 'atlas-tracker', label: 'atlas-tracker' },
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
];

const LIMIT = 50;

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [filters, setFilters] = useState({
    service: '',
    action: '',
    from: '',
    to: '',
    status: '',
    userId: '',
  });

  const [applied, setApplied] = useState({ ...filters });

  const load = useCallback(async (o: number) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      params.set('offset', String(o));
      if (applied.service) params.set('service', applied.service);
      if (applied.action) params.set('action', applied.action);
      if (applied.from) params.set('from', applied.from);
      if (applied.to) params.set('to', applied.to);
      if (applied.status) params.set('status', applied.status);
      if (applied.userId) params.set('userId', applied.userId);

      const res = await api<ListResponse>(`/api/v1/audit/events?${params}`);
      setEvents(res.data);
      setTotal(res.total);
      setOffset(res.offset);
    } catch {
      toast.error('Failed to load audit events');
    }
  }, [applied]);

  useEffect(() => { load(0); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(offset), 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load, offset]);

  const applyFilters = () => {
    setApplied({ ...filters });
    setOffset(0);
  };

  const clearFilters = () => {
    const empty = { service: '', action: '', from: '', to: '', status: '', userId: '' };
    setFilters(empty);
    setApplied(empty);
    setOffset(0);
  };

  const statusBadge = (status: string) => (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getStatusClasses(status)}`}>{status}</span>
  );

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Audit Log">
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            autoRefresh
              ? 'bg-[#0071e3] text-white'
              : 'border bg-background text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          }`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
          Auto-refresh
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filters.service}
            onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value }))}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors focus:border-primary focus:text-foreground"
          >
            {SERVICES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <input
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            placeholder="Action"
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground placeholder:text-muted-foreground/60 w-36 transition-colors focus:border-primary focus:text-foreground"
          />

          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors focus:border-primary focus:text-foreground"
            title="From date"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors focus:border-primary focus:text-foreground"
            title="To date"
          />

          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors focus:border-primary focus:text-foreground"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <input
            value={filters.userId}
            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
            placeholder="User ID"
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground placeholder:text-muted-foreground/60 w-36 transition-colors focus:border-primary focus:text-foreground"
          />

          <button
            onClick={applyFilters}
            className="rounded-full bg-[#0071e3] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={clearFilters}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Clear
          </button>
        </div>

        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#f5f5f7]/60 dark:bg-[#2c2c2e]/60 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  expanded={expandedId === ev.id}
                  onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                  statusBadge={statusBadge}
                  formatTimestamp={formatTimestamp}
                />
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">No audit events found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => load(offset - LIMIT)}
            disabled={offset <= 0}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}-{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <button
            onClick={() => load(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  expanded,
  onToggle,
  statusBadge,
  formatTimestamp,
}: {
  event: AuditEvent;
  expanded: boolean;
  onToggle: () => void;
  statusBadge: (s: string) => React.ReactNode;
  formatTimestamp: (ts: string) => string;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b last:border-b-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
      >
        <td className="px-4 py-3">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTimestamp(event.timestamp)}</td>
        <td className="px-4 py-3">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{event.service}</span>
        </td>
        <td className="px-4 py-3 font-medium">{event.action}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[140px]">
          {event.userName || event.userId || '-'}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[140px]">
          {event.resourceType ? `${event.resourceType}${event.resourceId ? `:${event.resourceId}` : ''}` : '-'}
        </td>
        <td className="px-4 py-3">{statusBadge(event.status)}</td>
        <td className={`px-4 py-3 text-xs ${event.duration != null && event.duration > 1000 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
          {event.duration != null ? `${event.duration}ms` : '-'}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b">
          <td colSpan={8} className="bg-muted/30 p-4">
            <div className="space-y-3">
              {event.error && (
                <div>
                  <p className="text-xs font-semibold text-destructive mb-1">Error</p>
                  <pre className="rounded border bg-background p-3 text-xs overflow-auto max-h-40">{event.error}</pre>
                </div>
              )}
              {event.request && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Request</p>
                  <pre className="rounded border bg-background p-3 text-xs overflow-auto max-h-60">
                    {JSON.stringify(event.request, null, 2)}
                  </pre>
                </div>
              )}
              {event.result && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Result</p>
                  <pre className="rounded border bg-background p-3 text-xs overflow-auto max-h-60">
                    {JSON.stringify(event.result, null, 2)}
                  </pre>
                </div>
              )}
              {event.details && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Details</p>
                  <pre className="rounded border bg-background p-3 text-xs overflow-auto max-h-60">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </div>
              )}
              {!event.request && !event.result && !event.details && !event.error && (
                <p className="text-sm text-muted-foreground">No additional details</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
