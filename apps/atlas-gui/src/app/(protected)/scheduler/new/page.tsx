'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const JOB_TYPES = ['http', 'webhook', 'script', 'shell', 'monitor'] as const;
const SCHEDULE_TYPES = ['cron', 'once', 'interval'] as const;

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'http' as string,
    scheduleType: 'cron' as string,
    cron: '',
    runAt: '',
    intervalMs: 60000,
    timeoutMs: 30000,
    config: '{}',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        type: form.type,
        scheduleType: form.scheduleType,
        timeoutMs: form.timeoutMs,
        config: JSON.parse(form.config),
      };

      if (form.scheduleType === 'cron') body.cron = form.cron;
      if (form.scheduleType === 'once') body.runAt = form.runAt;
      if (form.scheduleType === 'interval') body.intervalMs = form.intervalMs;

      await api('/api/v1/scheduler/jobs', { method: 'POST', body: JSON.stringify(body) });
      toast.success('Job created');
      router.push('/scheduler');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">New Job</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2" />
        </div>

        <div>
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <input id="description" value={form.description} onChange={(e) => set('description', e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="text-sm font-medium">Type</label>
            <select id="type" value={form.type} onChange={(e) => set('type', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2">
              {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="scheduleType" className="text-sm font-medium">Schedule</label>
            <select id="scheduleType" value={form.scheduleType} onChange={(e) => set('scheduleType', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2">
              {SCHEDULE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {form.scheduleType === 'cron' && (
          <div>
            <label htmlFor="cron" className="text-sm font-medium">Cron Expression</label>
            <input id="cron" value={form.cron} onChange={(e) => set('cron', e.target.value)}
              placeholder="*/5 * * * *" className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 font-mono" />
          </div>
        )}

        {form.scheduleType === 'once' && (
          <div>
            <label htmlFor="runAt" className="text-sm font-medium">Run At</label>
            <input id="runAt" type="datetime-local" value={form.runAt} onChange={(e) => set('runAt', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2" />
          </div>
        )}

        {form.scheduleType === 'interval' && (
          <div>
            <label htmlFor="intervalMs" className="text-sm font-medium">Interval (ms)</label>
            <input id="intervalMs" type="number" value={form.intervalMs} onChange={(e) => set('intervalMs', Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2" />
          </div>
        )}

        <div>
          <label htmlFor="timeoutMs" className="text-sm font-medium">Timeout (ms)</label>
          <input id="timeoutMs" type="number" value={form.timeoutMs} onChange={(e) => set('timeoutMs', Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2" />
        </div>

        <div>
          <label htmlFor="config" className="text-sm font-medium">Configuration (JSON)</label>
          <textarea id="config" value={form.config} onChange={(e) => set('config', e.target.value)} rows={6}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            placeholder={form.type === 'http' ? '{"url": "https://...", "method": "GET"}' : '{}'}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {form.type === 'http' && 'Fields: url, method, headers, body'}
            {form.type === 'webhook' && 'Fields: url, payload'}
            {form.type === 'shell' && 'Fields: command'}
            {form.type === 'script' && 'Fields: code'}
            {form.type === 'monitor' && 'Fields: url, expectedStatus, expectedBody'}
          </p>
        </div>

        <button type="submit" disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </div>
  );
}
