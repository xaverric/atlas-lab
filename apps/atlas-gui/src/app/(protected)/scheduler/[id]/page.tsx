'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Job {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  scheduleType: string;
  cron?: string;
  config: Record<string, unknown>;
  timeoutMs: number;
  createdAt: string;
}

interface ExecutionResult {
  exitCode?: number;
  statusCode?: number;
  stdout?: string;
  stderr?: string;
  body?: string;
  error?: string;
}

interface Execution {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  result?: ExecutionResult;
  triggeredBy: string;
}

interface ExecListResponse {
  data: Execution[];
  total: number;
  page: number;
  limit: number;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [expandedExec, setExpandedExec] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Job }>(`/api/v1/scheduler/jobs/${id}`)
      .then((res) => setJob(res.data))
      .catch(() => toast.error('Job not found'));

    api<ExecListResponse>(`/api/v1/scheduler/executions?jobId=${id}&limit=50`)
      .then((res) => setExecutions(res.data))
      .catch(() => {});
  }, [id]);

  const handleRun = async () => {
    try {
      await api(`/api/v1/scheduler/jobs/${id}/run`, { method: 'POST' });
      toast.success('Job triggered');
    } catch {
      toast.error('Failed to trigger');
    }
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (status === 'failed' || status === 'timeout') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (status === 'running') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    return 'bg-muted text-muted-foreground';
  };

  if (!job) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/scheduler')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{job.name}</h1>
          {job.description && <p className="mt-1 text-muted-foreground">{job.description}</p>}
        </div>
        <button onClick={handleRun} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          <Play className="h-4 w-4" /> Run Now
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Type</p>
          <p className="font-medium">{job.type}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Schedule</p>
          <p className="font-medium font-mono">{job.scheduleType === 'cron' ? job.cron : job.scheduleType}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-medium">{job.enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Timeout</p>
          <p className="font-medium">{(job.timeoutMs / 1000).toFixed(0)}s</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">Configuration</h2>
        <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto">
          {JSON.stringify(job.config, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">Execution History</h2>
        <div className="space-y-2">
          {executions.map((exec) => (
            <div key={exec.id} className="rounded-lg border">
              <button
                onClick={() => setExpandedExec(expandedExec === exec.id ? null : exec.id)}
                className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {expandedExec === exec.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(exec.status)}`}>
                    {exec.status}
                  </span>
                  <span className="text-sm">{new Date(exec.startedAt).toLocaleString()}</span>
                  {exec.duration != null && (
                    <span className="text-sm text-muted-foreground">{exec.duration}ms</span>
                  )}
                  <span className="text-xs text-muted-foreground">{exec.triggeredBy}</span>
                </div>
              </button>

              {expandedExec === exec.id && exec.result && (
                <div className="border-t p-3 space-y-2">
                  {exec.result.statusCode != null && (
                    <p className="text-sm"><span className="text-muted-foreground">Status:</span> {exec.result.statusCode}</p>
                  )}
                  {exec.result.exitCode != null && (
                    <p className="text-sm"><span className="text-muted-foreground">Exit code:</span> {exec.result.exitCode}</p>
                  )}
                  {exec.result.error && (
                    <pre className="rounded bg-red-50 dark:bg-red-950 p-2 text-sm text-red-800 dark:text-red-200 overflow-auto">{exec.result.error}</pre>
                  )}
                  {exec.result.stdout && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">stdout</p>
                      <pre className="rounded bg-muted p-2 text-sm font-mono overflow-auto max-h-48">{exec.result.stdout}</pre>
                    </div>
                  )}
                  {exec.result.stderr && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">stderr</p>
                      <pre className="rounded bg-muted p-2 text-sm font-mono overflow-auto max-h-48">{exec.result.stderr}</pre>
                    </div>
                  )}
                  {exec.result.body && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Response body</p>
                      <pre className="rounded bg-muted p-2 text-sm font-mono overflow-auto max-h-48">{exec.result.body}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {executions.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No executions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
