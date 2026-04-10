'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { KeyValueEditor } from './key-value-editor';
import { CronBuilder } from './cron-builder';
import { CodeEditor } from './code-editor';
import { EvaluationRulesEditor } from './evaluation-rules-editor';

interface KeyValuePair { key: string; value: string }
interface EvaluationRule { type: string; value: string; path?: string }
interface NotificationRule { trigger: string; channel: string; config: Record<string, unknown> }

export interface JobFormData {
  name: string;
  description: string;
  executionType: 'webhook' | 'javascript';
  enabled: boolean;
  group: string;
  tags: string;
  scheduleType: 'cron' | 'once';
  cronExpression: string;
  cronTimezone: string;
  runAt: string;
  timeoutMs: number;
  retryMaxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  webhookUrl: string;
  webhookMethod: string;
  webhookHeaders: KeyValuePair[];
  webhookBody: string;
  webhookAuthType: string;
  webhookAuthToken: string;
  webhookAuthUsername: string;
  webhookAuthPassword: string;
  webhookAuthHeaderName: string;
  webhookAuthHeaderValue: string;
  webhookEvalRules: EvaluationRule[];
  jsCode: string;
  jsEnv: KeyValuePair[];
  notifications: NotificationRule[];
}

const defaultFormData: JobFormData = {
  name: '', description: '', executionType: 'webhook', enabled: true, group: '', tags: '',
  scheduleType: 'cron', cronExpression: '0 * * * *', cronTimezone: 'UTC', runAt: '',
  timeoutMs: 30000, retryMaxRetries: 0, retryDelayMs: 1000, retryBackoffMultiplier: 2,
  webhookUrl: '', webhookMethod: 'GET', webhookHeaders: [], webhookBody: '',
  webhookAuthType: 'none', webhookAuthToken: '', webhookAuthUsername: '', webhookAuthPassword: '',
  webhookAuthHeaderName: '', webhookAuthHeaderValue: '', webhookEvalRules: [],
  jsCode: '', jsEnv: [],
  notifications: [],
};

const kvToRecord = (pairs: KeyValuePair[]): Record<string, string> =>
  Object.fromEntries(pairs.filter((p) => p.key).map((p) => [p.key, p.value]));

export const formToPayload = (form: JobFormData) => {
  const schedule: Record<string, unknown> = { type: form.scheduleType, timezone: form.cronTimezone };
  if (form.scheduleType === 'cron') schedule.expression = form.cronExpression;
  if (form.scheduleType === 'once') schedule.runAt = new Date(form.runAt).toISOString();

  let config: Record<string, unknown> = {};
  if (form.executionType === 'webhook') {
    config = {
      url: form.webhookUrl,
      method: form.webhookMethod,
      ...(form.webhookHeaders.length > 0 ? { headers: kvToRecord(form.webhookHeaders) } : {}),
      ...(form.webhookBody ? { body: JSON.parse(form.webhookBody) } : {}),
      ...(form.webhookAuthType !== 'none' ? {
        auth: {
          type: form.webhookAuthType,
          ...(form.webhookAuthType === 'bearer' ? { token: form.webhookAuthToken } : {}),
          ...(form.webhookAuthType === 'basic' ? { username: form.webhookAuthUsername, password: form.webhookAuthPassword } : {}),
          ...(form.webhookAuthType === 'header' ? { headerName: form.webhookAuthHeaderName, headerValue: form.webhookAuthHeaderValue } : {}),
        },
      } : {}),
      ...(form.webhookEvalRules.length > 0 ? {
        evaluationRules: form.webhookEvalRules.map((r) => ({
          type: r.type,
          value: r.type === 'statusEquals' ? Number(r.value) : r.type === 'jsonSchema' ? JSON.parse(r.value) : r.value,
          ...(r.path ? { path: r.path } : {}),
        })),
      } : {}),
    };
  } else if (form.executionType === 'javascript') {
    config = {
      code: form.jsCode,
      ...(form.jsEnv.length > 0 ? { env: kvToRecord(form.jsEnv) } : {}),
    };
  }

  return {
    name: form.name,
    description: form.description,
    executionType: form.executionType,
    enabled: form.enabled,
    group: form.group,
    schedule,
    config,
    timeoutMs: form.timeoutMs,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    retryPolicy: {
      maxRetries: form.retryMaxRetries,
      delayMs: form.retryDelayMs,
      backoffMultiplier: form.retryBackoffMultiplier,
    },
    notifications: form.notifications,
  };
};

export const jobToFormData = (job: Record<string, unknown>): JobFormData => {
  const schedule = (job.schedule || {}) as Record<string, unknown>;
  const config = (job.config || {}) as Record<string, unknown>;
  const retry = (job.retryPolicy || {}) as Record<string, unknown>;
  const notifications = (job.notifications || []) as NotificationRule[];
  const executionType = (job.executionType || 'webhook') as JobFormData['executionType'];

  const base: JobFormData = {
    ...defaultFormData,
    name: (job.name as string) || '',
    description: (job.description as string) || '',
    executionType,
    enabled: job.enabled !== false,
    group: (job.group as string) || '',
    tags: ((job.tags || []) as string[]).join(', '),
    scheduleType: (schedule.type as 'cron' | 'once') || 'cron',
    cronExpression: (schedule.expression as string) || '',
    cronTimezone: (schedule.timezone as string) || 'UTC',
    runAt: schedule.runAt ? new Date(schedule.runAt as string).toISOString().slice(0, 16) : '',
    timeoutMs: (job.timeoutMs as number) || 30000,
    retryMaxRetries: (retry.maxRetries as number) || 0,
    retryDelayMs: (retry.delayMs as number) || 1000,
    retryBackoffMultiplier: (retry.backoffMultiplier as number) || 2,
    notifications,
  };

  if (executionType === 'webhook') {
    const headers = (config.headers || {}) as Record<string, string>;
    const auth = (config.auth || {}) as Record<string, string>;
    const evalRules = ((config.evaluationRules || []) as Array<Record<string, unknown>>);
    base.webhookUrl = (config.url as string) || '';
    base.webhookMethod = (config.method as string) || 'GET';
    base.webhookHeaders = Object.entries(headers).map(([key, value]) => ({ key, value }));
    base.webhookBody = config.body ? JSON.stringify(config.body, null, 2) : '';
    base.webhookAuthType = auth.type || 'none';
    base.webhookAuthToken = auth.token || '';
    base.webhookAuthUsername = auth.username || '';
    base.webhookAuthPassword = auth.password || '';
    base.webhookAuthHeaderName = auth.headerName || '';
    base.webhookAuthHeaderValue = auth.headerValue || '';
    base.webhookEvalRules = evalRules.map((r) => ({
      type: (r.type as string) || 'statusEquals',
      value: String(r.value ?? ''),
      path: r.path as string | undefined,
    }));
  } else if (executionType === 'javascript') {
    const env = (config.env || {}) as Record<string, string>;
    base.jsCode = (config.code as string) || '';
    base.jsEnv = Object.entries(env).map(([key, value]) => ({ key, value }));
  }

  return base;
};

interface JobFormProps {
  initialData?: JobFormData;
  onSubmit: (data: JobFormData) => void;
  submitLabel: string;
  saving: boolean;
}

export function JobForm({ initialData, onSubmit, submitLabel, saving }: JobFormProps) {
  const [form, setForm] = useState<JobFormData>(initialData || defaultFormData);

  const set = <K extends keyof JobFormData>(key: K, value: JobFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const addNotification = () => {
    set('notifications', [...form.notifications, { trigger: 'onFailure', channel: 'webhook', config: { url: '' } }]);
  };

  const updateNotification = (index: number, field: string, value: unknown) => {
    const updated = form.notifications.map((n, i) => {
      if (i !== index) return n;
      if (field === 'config.url') return { ...n, config: { ...n.config, url: value } };
      return { ...n, [field]: value };
    });
    set('notifications', updated);
  };

  const removeNotification = (index: number) => {
    set('notifications', form.notifications.filter((_, i) => i !== index));
  };

  const input = "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basic Info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} className={input} />
          </div>
          <div>
            <label className="text-sm font-medium">Group</label>
            <input value={form.group} onChange={(e) => set('group', e.target.value)} placeholder="e.g. monitoring" className={input} />
          </div>
          <div>
            <label className="text-sm font-medium">Tags</label>
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="tag1, tag2" className={input} />
            <p className="mt-1 text-xs text-muted-foreground">Comma-separated</p>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="text-sm font-medium">Enabled</label>
            <button
              type="button"
              onClick={() => set('enabled', !form.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? 'bg-[#0071e3]' : 'bg-black/[0.12] dark:bg-white/[0.16]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Execution Type */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Execution Type</h2>
        <div className="flex gap-3">
          {([
            ['webhook', 'Webhook'],
            ['javascript', 'JavaScript'],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => set('executionType', type)}
              className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                form.executionType === type ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Configuration</h2>

        {form.executionType === 'webhook' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="text-sm font-medium">Method</label>
                <select value={form.webhookMethod} onChange={(e) => set('webhookMethod', e.target.value)} className={input}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="text-sm font-medium">URL</label>
                <input value={form.webhookUrl} onChange={(e) => set('webhookUrl', e.target.value)} placeholder="https://..." required className={input} />
              </div>
            </div>

            <KeyValueEditor label="Headers" pairs={form.webhookHeaders} onChange={(p) => set('webhookHeaders', p)} keyPlaceholder="Header name" valuePlaceholder="Header value" />

            <div>
              <label className="text-sm font-medium">Body (JSON)</label>
              <textarea
                value={form.webhookBody}
                onChange={(e) => set('webhookBody', e.target.value)}
                rows={4}
                className={`${input} font-mono`}
                placeholder='{"key": "value"}'
              />
            </div>

            <div>
              <label className="text-sm font-medium">Authentication</label>
              <select value={form.webhookAuthType} onChange={(e) => set('webhookAuthType', e.target.value)} className={input}>
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="header">Custom Header</option>
              </select>
              {form.webhookAuthType === 'bearer' && (
                <input value={form.webhookAuthToken} onChange={(e) => set('webhookAuthToken', e.target.value)} placeholder="Token" className={`${input} mt-2`} />
              )}
              {form.webhookAuthType === 'basic' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input value={form.webhookAuthUsername} onChange={(e) => set('webhookAuthUsername', e.target.value)} placeholder="Username" className={input} />
                  <input value={form.webhookAuthPassword} onChange={(e) => set('webhookAuthPassword', e.target.value)} placeholder="Password" type="password" className={input} />
                </div>
              )}
              {form.webhookAuthType === 'header' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input value={form.webhookAuthHeaderName} onChange={(e) => set('webhookAuthHeaderName', e.target.value)} placeholder="Header name" className={input} />
                  <input value={form.webhookAuthHeaderValue} onChange={(e) => set('webhookAuthHeaderValue', e.target.value)} placeholder="Header value" className={input} />
                </div>
              )}
            </div>

            <EvaluationRulesEditor rules={form.webhookEvalRules} onChange={(r) => set('webhookEvalRules', r)} />
          </div>
        )}

        {form.executionType === 'javascript' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code</label>
              <CodeEditor
                value={form.jsCode}
                onChange={(v) => set('jsCode', v)}
                placeholder={'// Your JavaScript code here\nconst res = await http.fetch("https://api.example.com/data");\nconsole.log(res.json);\nreturn res.json;'}
              />
            </div>
            <KeyValueEditor label="Environment Variables" pairs={form.jsEnv} onChange={(p) => set('jsEnv', p)} keyPlaceholder="VAR_NAME" valuePlaceholder="value" />
          </div>
        )}

      </section>

      {/* Schedule */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Schedule</h2>
        <div className="flex gap-3 mb-4">
          {(['cron', 'once'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set('scheduleType', type)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                form.scheduleType === type ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              {type === 'cron' ? 'Cron' : 'Run Once'}
            </button>
          ))}
        </div>

        {form.scheduleType === 'cron' && (
          <CronBuilder value={form.cronExpression} onChange={(v) => set('cronExpression', v)} timezone={form.cronTimezone} onTimezoneChange={(v) => set('cronTimezone', v)} />
        )}
        {form.scheduleType === 'once' && (
          <div>
            <label className="text-sm font-medium">Run At</label>
            <input type="datetime-local" value={form.runAt} onChange={(e) => set('runAt', e.target.value)} required className={input} />
          </div>
        )}
      </section>

      {/* Timeout & Retry */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Timeout & Retry</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Timeout (ms)</label>
            <input type="number" value={form.timeoutMs} onChange={(e) => set('timeoutMs', Number(e.target.value))} min={1000} max={600000} className={input} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[5000, 15000, 30000, 60000, 300000].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => set('timeoutMs', ms)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${form.timeoutMs === ms ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
                >
                  {ms >= 60000 ? `${ms / 60000}m` : `${ms / 1000}s`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Max Retries</label>
              <input type="number" value={form.retryMaxRetries} onChange={(e) => set('retryMaxRetries', Number(e.target.value))} min={0} max={10} className={input} />
            </div>
            {form.retryMaxRetries > 0 && (
              <>
                <div>
                  <label className="text-sm font-medium">Retry Delay (ms)</label>
                  <input type="number" value={form.retryDelayMs} onChange={(e) => set('retryDelayMs', Number(e.target.value))} min={100} className={input} />
                </div>
                <div>
                  <label className="text-sm font-medium">Backoff Multiplier</label>
                  <input type="number" value={form.retryBackoffMultiplier} onChange={(e) => set('retryBackoffMultiplier', Number(e.target.value))} min={1} max={10} step={0.5} className={input} />
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button type="button" onClick={addNotification} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="space-y-3">
          {form.notifications.map((n, i) => (
            <div key={i} className="flex gap-2 items-start rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-3">
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <select value={n.trigger} onChange={(e) => updateNotification(i, 'trigger', e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                  <option value="onSuccess">On Success</option>
                  <option value="onFailure">On Failure</option>
                  <option value="onTimeout">On Timeout</option>
                  <option value="onEvaluationFailure">On Eval Failure</option>
                  <option value="onRecovery">On Recovery</option>
                </select>
                <select value={n.channel} onChange={(e) => updateNotification(i, 'channel', e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                  <option value="webhook">Webhook</option>
                  <option value="email">Email</option>
                  <option value="telegram">Telegram</option>
                </select>
                {n.channel === 'webhook' && (
                  <input value={(n.config.url as string) || ''} onChange={(e) => updateNotification(i, 'config.url', e.target.value)}
                    placeholder="https://webhook.url" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
                )}
              </div>
              <button type="button" onClick={() => removeNotification(i)} className="rounded p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-[#ff3b30] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {form.notifications.length === 0 && (
            <p className="text-sm text-muted-foreground">No notification rules configured.</p>
          )}
        </div>
      </section>

      <button type="submit" disabled={saving}
        className="rounded-md bg-[#0071e3] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
        {saving ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
