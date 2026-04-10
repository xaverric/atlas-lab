'use client';

import { useEffect, useState, useCallback } from 'react';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Pencil, Trash2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/scheduler/status-badge';
import { JobChart } from '@/components/dashboard/job-chart';
import { CodeMirrorViewer } from '@/components/shared/codemirror-viewer';
import { dashboardStore } from '@/lib/dashboard-store';
import { PageHeader } from '@/components/shared/page-header';

interface Schedule {
  type: string;
  expression?: string;
  timezone?: string;
  runAt?: string;
}

interface NotificationRule {
  _id: string;
  trigger: string;
  channel: string;
  config: Record<string, unknown>;
}

interface Job {
  id: string;
  name: string;
  description: string;
  executionType: string;
  enabled: boolean;
  schedule: Schedule;
  config: Record<string, unknown>;
  timeoutMs: number;
  tags: string[];
  retryPolicy: { maxRetries: number; delayMs: number; backoffMultiplier: number };
  notifications: NotificationRule[];
  lastRunAt?: string;
  lastRunStatus?: string;
  nextRunAt?: string;
  createdAt: string;
}

interface Run {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  triggeredBy: string;
  attempt: number;
}

interface RunListResponse {
  data: Run[];
  total: number;
  page: number;
  limit: number;
}

function formatSchedule(schedule: Schedule): string {
  if (schedule.type === 'cron') return `${schedule.expression} (${schedule.timezone || 'UTC'})`;
  if (schedule.type === 'once' && schedule.runAt) return new Date(schedule.runAt).toLocaleString();
  return schedule.type;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPage, setRunsPage] = useState(1);
  const [pinned, setPinned] = useState(false);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  useEffect(() => { setPinned(dashboardStore.hasItem(id)); }, [id]);

  const togglePin = () => {
    if (pinned) {
      dashboardStore.removeItem(id);
      setPinned(false);
      toast.success('Unpinned from dashboard');
    } else {
      dashboardStore.addItem(id, job?.name || 'Job');
      setPinned(true);
      toast.success('Pinned to dashboard');
    }
  };

  useEffect(() => {
    api<{ data: Job }>(`/api/v1/scheduler/jobs/${id}`)
      .then((res) => setJob(res.data))
      .catch(() => toast.error('Job not found'));
  }, [id]);

  const loadRuns = useCallback(async (p: number) => {
    try {
      const res = await api<RunListResponse>(`/api/v1/scheduler/jobs/${id}/runs?page=${p}&limit=20`);
      setRuns(res.data);
      setRunsTotal(res.total);
      setRunsPage(res.page);
    } catch { /* runs may not exist yet */ }
  }, [id]);

  useEffect(() => { loadRuns(1); }, [loadRuns]);

  const handleRun = async () => {
    try {
      await api(`/api/v1/scheduler/jobs/${id}/run`, { method: 'POST' });
      toast.success('Job triggered');
      setTimeout(() => loadRuns(1), 1000);
    } catch {
      toast.error('Failed to trigger');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete job?', description: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      await api(`/api/v1/scheduler/jobs/${id}`, { method: 'DELETE' });
      toast.success('Job deleted');
      router.push('/scheduler');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (!job) return <p className="p-8 text-muted-foreground">Loading...</p>;

  return (
    <>{ConfirmDialogElement}<div className="flex h-full flex-col">
      <PageHeader title={job.name}>
        <button onClick={togglePin} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${pinned ? 'text-primary border-primary' : ''}`}>
          <BarChart3 className="h-4 w-4" /> {pinned ? 'Unpin' : 'Pin to Dashboard'}
        </button>
        <Link href={`/scheduler/jobs/${id}/edit`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
          <Pencil className="h-4 w-4" /> Edit
        </Link>
        <button onClick={handleRun} className="flex items-center gap-2 rounded-lg bg-[#0071e3] px-3 py-2 text-sm text-white hover:opacity-90">
          <Play className="h-4 w-4" /> Run Now
        </button>
        <button onClick={handleDelete} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </PageHeader>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <button onClick={() => router.push('/scheduler')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${job.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {job.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {job.description && <p className="mt-1 text-muted-foreground">{job.description}</p>}
            </div>
          </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4">
          <p className="text-sm text-muted-foreground">Type</p>
          <p className="font-medium">{job.executionType}</p>
        </div>
        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4">
          <p className="text-sm text-muted-foreground">Schedule</p>
          <p className="font-medium font-mono text-sm">{formatSchedule(job.schedule)}</p>
        </div>
        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4">
          <p className="text-sm text-muted-foreground">Timeout</p>
          <p className="font-medium">{formatDuration(job.timeoutMs)}</p>
        </div>
        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4">
          <p className="text-sm text-muted-foreground">Last Run</p>
          {job.lastRunStatus ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={job.lastRunStatus} />
              {job.lastRunAt && <span className="text-xs text-muted-foreground">{new Date(job.lastRunAt).toLocaleString()}</span>}
            </div>
          ) : (
            <p className="text-muted-foreground">Never</p>
          )}
        </div>
        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4">
          <p className="text-sm text-muted-foreground">Next Run</p>
          <p className="font-medium text-sm">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '-'}</p>
        </div>
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="flex gap-2">
          {job.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium">{tag}</span>
          ))}
        </div>
      )}

      {/* Run Analytics */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Run Analytics</h2>
        <JobChart jobId={id} />
      </div>

      {/* Config */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Configuration</h2>
        {(job.executionType === 'javascript' || job.executionType === 'shell') && typeof job.config.code === 'string' ? (
          <CodeMirrorViewer
            code={job.config.code}
            language={job.executionType === 'shell' ? 'bash' : 'javascript'}
          />
        ) : (
          <CodeMirrorViewer
            code={JSON.stringify(job.config, null, 2)}
            language="json"
          />
        )}
      </div>

      {/* Notifications */}
      {job.notifications.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Notification Rules</h2>
          <div className="space-y-2">
            {job.notifications.map((n) => (
              <div key={n._id} className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-3 text-sm">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{n.trigger}</span>
                <span className="text-muted-foreground">via</span>
                <span className="font-medium">{n.channel}</span>
                {n.channel === 'webhook' && typeof n.config.url === 'string' && (
                  <span className="text-xs text-muted-foreground font-mono truncate">{n.config.url}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Run History</h2>
        <div className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e]">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="p-3">Status</th>
                <th className="p-3">Started At</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Triggered By</th>
                <th className="p-3">Attempt</th>
                <th className="p-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b last:border-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]/50">
                  <td className="p-3"><StatusBadge status={run.status} /></td>
                  <td className="p-3 text-sm">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="p-3 text-sm text-muted-foreground">{run.duration != null ? formatDuration(run.duration) : '-'}</td>
                  <td className="p-3 text-sm text-muted-foreground">{run.triggeredBy}</td>
                  <td className="p-3 text-sm text-muted-foreground">#{run.attempt}</td>
                  <td className="p-3">
                    <Link href={`/scheduler/runs/${run.id}`} className="text-xs text-primary hover:underline">View</Link>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={6} className="py-16 text-center text-muted-foreground">No runs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {runsTotal > 20 && (
          <div className="flex gap-2 justify-center mt-3">
            <button onClick={() => loadRuns(runsPage - 1)} disabled={runsPage <= 1} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <span className="px-3 py-1 text-sm text-muted-foreground">Page {runsPage} of {Math.ceil(runsTotal / 20)}</span>
            <button onClick={() => loadRuns(runsPage + 1)} disabled={runsPage * 20 >= runsTotal} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
        </div>
      </div>
    </div></>
  );
}
