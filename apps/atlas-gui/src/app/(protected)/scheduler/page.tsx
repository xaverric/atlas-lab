'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Job {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  scheduleType: string;
  cron?: string;
  createdAt: string;
}

interface ListResponse {
  data: Job[];
  total: number;
  page: number;
  limit: number;
}

export default function SchedulerListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = async (p: number) => {
    try {
      const res = await api<ListResponse>(`/api/v1/scheduler/jobs?page=${p}&limit=20`);
      setJobs(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load jobs');
    }
  };

  useEffect(() => { load(1); }, []);

  const handleToggle = async (id: string) => {
    try {
      const res = await api<{ data: Job }>(`/api/v1/scheduler/jobs/${id}/toggle`, { method: 'PATCH' });
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
        <h1 className="text-3xl font-bold">Scheduler</h1>
        <Link
          href="/scheduler/new"
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Schedule</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-32" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="p-3">
                  <Link href={`/scheduler/${job.id}`} className="hover:underline font-medium">
                    {job.name}
                  </Link>
                </td>
                <td className="p-3 text-sm">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{job.type}</span>
                </td>
                <td className="p-3 text-sm text-muted-foreground font-mono">
                  {job.scheduleType === 'cron' ? job.cron : job.scheduleType}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleToggle(job.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      job.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'
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
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">No jobs yet</td>
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
