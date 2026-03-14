'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Play, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/scheduler/status-badge';

interface Job {
  id: string;
  name: string;
  executionType: string;
  enabled: boolean;
  group: string;
  schedule: { type: string; expression?: string; timezone?: string; runAt?: string };
  tags: string[];
  lastRunAt?: string;
  lastRunStatus?: string;
  nextRunAt?: string;
  createdAt: string;
}

interface ListResponse {
  data: Job[];
  total: number;
  page: number;
  limit: number;
}

function formatSchedule(schedule: Job['schedule']): string {
  if (schedule.type === 'cron' && schedule.expression) return schedule.expression;
  if (schedule.type === 'once' && schedule.runAt) return `Once: ${new Date(schedule.runAt).toLocaleString()}`;
  return schedule.type;
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

export default function SchedulerListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const load = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('executionType', typeFilter);
      if (enabledFilter) params.set('enabled', enabledFilter);

      const res = await api<ListResponse>(`/api/v1/scheduler/jobs?${params}`);
      setJobs(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load jobs');
    }
  }, [search, typeFilter, enabledFilter]);

  useEffect(() => { load(1); }, [load]);

  const groupedJobs = jobs.reduce<Record<string, Job[]>>((acc, job) => {
    const group = job.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(job);
    return acc;
  }, {});

  const sortedGroups = Object.keys(groupedJobs).sort((a, b) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await api<{ data: Job }>(`/api/v1/scheduler/jobs/${id}/${enabled ? 'disable' : 'enable'}`, { method: 'POST' });
      setJobs((prev) => prev.map((j) => (j.id === id ? res.data : j)));
      toast.success(res.data.enabled ? 'Job enabled' : 'Job disabled');
    } catch {
      toast.error('Failed to toggle job');
    }
  };

  const handleRun = async (id: string) => {
    try {
      await api(`/api/v1/scheduler/jobs/${id}/run`, { method: 'POST' });
      toast.success('Job triggered');
    } catch {
      toast.error('Failed to trigger job');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job?')) return;
    try {
      await api(`/api/v1/scheduler/jobs/${id}`, { method: 'DELETE' });
      toast.success('Job deleted');
      load(page);
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Scheduler</h1>
        <Link
          href="/scheduler/jobs/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All Types</option>
          <option value="webhook">Webhook</option>
          <option value="javascript">JavaScript</option>
          <option value="shell">Shell</option>
        </select>
        <select value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Schedule</th>
              <th className="p-3">Last Run</th>
              <th className="p-3">Next Run</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group) => {
              const groupJobs = groupedJobs[group];
              const isCollapsed = collapsedGroups.has(group);
              return (
                <Fragment key={group}>
                  {sortedGroups.length > 1 && (
                    <tr
                      className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleGroup(group)}
                    >
                      <td colSpan={7} className="p-2 px-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {isCollapsed
                            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          {group}
                          <span className="text-xs text-muted-foreground font-normal">({groupJobs.length})</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!isCollapsed && groupJobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-3">
                        <Link href={`/scheduler/jobs/${job.id}`} className="hover:underline font-medium">
                          {job.name}
                        </Link>
                        {job.tags.length > 0 && (
                          <div className="mt-1 flex gap-1">
                            {job.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{job.executionType}</span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground font-mono">
                        {formatSchedule(job.schedule)}
                      </td>
                      <td className="p-3 text-sm">
                        {job.lastRunStatus && <StatusBadge status={job.lastRunStatus} className="mr-2" />}
                        {job.lastRunAt && <span className="text-xs text-muted-foreground">{relativeTime(job.lastRunAt)}</span>}
                        {!job.lastRunAt && <span className="text-xs text-muted-foreground">Never</span>}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '-'}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggle(job.id, job.enabled)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            job.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {job.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleRun(job.id)} className="rounded p-1 hover:bg-muted" title="Run now">
                            <Play className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(job.id)} className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">No jobs yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex gap-2 justify-center">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page * 20 >= total} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
