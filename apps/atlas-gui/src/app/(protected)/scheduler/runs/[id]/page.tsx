'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/scheduler/status-badge';
import { LogViewer } from '@/components/scheduler/log-viewer';

interface EvaluationResult {
  rule: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

interface RunResult {
  exitCode?: number;
  statusCode?: number;
  stdout?: string;
  stderr?: string;
  body?: string;
  error?: string;
  evaluationResults?: EvaluationResult[];
  data?: unknown;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  meta?: unknown;
}

interface Run {
  id: string;
  jobId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  result?: RunResult;
  logs: LogEntry[];
  triggeredBy: string;
  attempt: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    api<{ data: Run }>(`/api/v1/scheduler/runs/${id}`)
      .then((res) => setRun(res.data))
      .catch(() => toast.error('Run not found'));
  }, [id]);

  if (!run) return <p className="text-muted-foreground">Loading...</p>;

  const result = run.result;

  return (
    <div className="space-y-6">
      <button onClick={() => router.push(`/scheduler/jobs/${run.jobId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Job
      </button>

      <h1 className="text-2xl font-semibold tracking-tight">Run Detail</h1>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <StatusBadge status={run.status} />
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Started</p>
          <p className="text-sm font-medium">{new Date(run.startedAt).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Finished</p>
          <p className="text-sm font-medium">{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '-'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Duration</p>
          <p className="font-medium">{run.duration != null ? formatDuration(run.duration) : '-'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Triggered By</p>
          <p className="font-medium">{run.triggeredBy} (attempt #{run.attempt})</p>
        </div>
      </div>

      {/* Error */}
      {result?.error && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Error</h2>
          <pre className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive overflow-auto">
            {result.error}
          </pre>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Result</h2>

          {result.statusCode != null && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground mb-1">HTTP Status</p>
              <p className="font-mono font-medium">{result.statusCode}</p>
            </div>
          )}

          {result.exitCode != null && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground mb-1">Exit Code</p>
              <p className={`font-mono font-medium ${result.exitCode !== 0 ? 'text-destructive' : ''}`}>{result.exitCode}</p>
            </div>
          )}

          {result.data !== undefined && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Return Value</p>
              <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto max-h-48">
                {typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}

          {result.stdout && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">stdout</p>
              <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto max-h-48">{result.stdout}</pre>
            </div>
          )}

          {result.stderr && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">stderr</p>
              <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto max-h-48">{result.stderr}</pre>
            </div>
          )}

          {result.body && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Response Body</p>
              <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto max-h-64">{result.body}</pre>
            </div>
          )}

          {/* Evaluation Results */}
          {result.evaluationResults && result.evaluationResults.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Evaluation Results</p>
              <div className="rounded-lg border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="p-3">Rule</th>
                      <th className="p-3">Result</th>
                      <th className="p-3">Expected</th>
                      <th className="p-3">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.evaluationResults.map((er, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-3 text-sm font-mono">{er.rule}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            er.passed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {er.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td className="p-3 text-sm font-mono text-muted-foreground">{JSON.stringify(er.expected)}</td>
                        <td className="p-3 text-sm font-mono text-muted-foreground">{JSON.stringify(er.actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {run.logs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Logs</h2>
          <LogViewer logs={run.logs} />
        </div>
      )}
    </div>
  );
}
