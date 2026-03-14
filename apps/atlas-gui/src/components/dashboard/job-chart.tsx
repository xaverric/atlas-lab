'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';

interface EvaluationResult {
  rule: string;
  passed: boolean;
}

interface RunResult {
  evaluationResults?: EvaluationResult[];
}

interface Run {
  id: string;
  status: string;
  startedAt: string;
  duration?: number;
  result?: RunResult;
}

interface RunListResponse {
  data: Run[];
  total: number;
  page: number;
  limit: number;
}

interface ChartPoint {
  date: string;
  completed: number;
  failed: number;
  timeout: number;
  duration: number;
  evalPassed: number;
  evalFailed: number;
}

function toChartData(runs: Run[]): ChartPoint[] {
  return [...runs].reverse().map((r) => {
    const evals = r.result?.evaluationResults || [];
    return {
      date: new Date(r.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      completed: r.status === 'completed' ? 1 : 0,
      failed: r.status === 'failed' ? 1 : 0,
      timeout: r.status === 'timeout' ? 1 : 0,
      duration: r.duration ?? 0,
      evalPassed: evals.filter((e) => e.passed).length,
      evalFailed: evals.filter((e) => !e.passed).length,
    };
  });
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface JobChartProps {
  jobId: string;
  compact?: boolean;
}

export function JobChart({ jobId, compact }: JobChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api<RunListResponse>(`/api/v1/scheduler/jobs/${jobId}/runs?page=1&limit=100`)
      .then((res) => setData(toChartData(res.data)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-muted" style={{ height: compact ? 150 : 200 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load runs: {error}</p>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No run data to chart yet.</p>;
  }

  const chartHeight = compact ? 150 : 200;
  const hasEvals = data.some((d) => d.evalPassed > 0 || d.evalFailed > 0);
  const wrapperClass = compact && hasEvals
    ? 'grid gap-4 grid-cols-1 md:grid-cols-3'
    : compact
      ? 'grid gap-4 grid-cols-1 md:grid-cols-2'
      : 'space-y-4';

  return (
    <div className={wrapperClass}>
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Run Status</p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
            <Tooltip />
            <Bar dataKey="completed" stackId="status" fill="#22c55e" name="Completed" />
            <Bar dataKey="failed" stackId="status" fill="#ef4444" name="Failed" />
            <Bar dataKey="timeout" stackId="status" fill="#f97316" name="Timeout" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Duration Trend</p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={formatMs} />
            <Tooltip formatter={(value) => formatMs(Number(value))} />
            <Area type="monotone" dataKey="duration" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Duration" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {hasEvals && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Eval Breakdown</p>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
              <Tooltip />
              <Bar dataKey="evalPassed" stackId="eval" fill="#22c55e" name="Passed" />
              <Bar dataKey="evalFailed" stackId="eval" fill="#ef4444" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
