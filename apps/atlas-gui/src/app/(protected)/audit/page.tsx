'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getStatusClasses } from '@/lib/status-colors';

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
  request?: unknown;
  result?: unknown;
  details?: unknown;
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
    <span className={`rounded px-1.5 py-0.5 text-xs ${getStatusClasses(status)}`}>{status}</span>
  );

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          Auto-refresh
        </label>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border p-3">
        <select
          value={filters.service}
          onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value }))}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {SERVICES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <input
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          placeholder="Action"
          className="rounded-md border bg-background px-3 py-1.5 text-sm w-40"
        />

        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          title="From date"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          title="To date"
        />

        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <input
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
          placeholder="User ID"
          className="rounded-md border bg-background px-3 py-1.5 text-sm w-40"
        />

        <button
          onClick={applyFilters}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        <button
          onClick={clearFilters}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Clear
        </button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="w-8 p-3"></th>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Service</th>
              <th className="p-3">Action</th>
              <th className="p-3">User</th>
              <th className="p-3">Resource</th>
              <th className="p-3">Status</th>
              <th className="p-3">Duration</th>
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

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {offset + 1}-{Math.min(offset + LIMIT, total)} of {total}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => load(offset - LIMIT)}
            disabled={offset <= 0}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => load(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
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
        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
      >
        <td className="p-3">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="p-3 text-sm whitespace-nowrap">{formatTimestamp(event.timestamp)}</td>
        <td className="p-3">
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{event.service}</span>
        </td>
        <td className="p-3 text-sm font-medium">{event.action}</td>
        <td className="p-3 text-sm text-muted-foreground truncate max-w-[140px]">
          {event.userName || event.userId || '-'}
        </td>
        <td className="p-3 text-sm text-muted-foreground truncate max-w-[140px]">
          {event.resourceType ? `${event.resourceType}${event.resourceId ? `:${event.resourceId}` : ''}` : '-'}
        </td>
        <td className="p-3">{statusBadge(event.status)}</td>
        <td className="p-3 text-sm text-muted-foreground">
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
