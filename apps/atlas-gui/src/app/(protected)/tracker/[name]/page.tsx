'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Copy, Globe, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface TrackerEndpoint {
  id: string;
  name: string;
  displayName: string;
  description: string;
  visibility: 'private' | 'public';
  schema: { type: string; properties: Record<string, unknown>; required?: string[] };
  indexes: Array<{ fields: Record<string, unknown>; options?: Record<string, unknown> }>;
  retentionDays?: number;
  createdAt: string;
  updatedAt: string;
}

interface DataEntry {
  id: string;
  data: Record<string, unknown>;
  metadata: { source: string; ip?: string; userAgent?: string };
  createdAt: string;
}

interface QueryResult {
  items: DataEntry[];
  total: number;
  limit: number;
  offset: number;
}

type Tab = 'data' | 'settings' | 'api';

export default function EndpointDetailPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const [endpoint, setEndpoint] = useState<TrackerEndpoint | null>(null);
  const [tab, setTab] = useState<Tab>('data');

  useEffect(() => {
    api<{ data: TrackerEndpoint }>(`/api/v1/tracker/endpoints/${name}`)
      .then((res) => setEndpoint(res.data))
      .catch(() => toast.error('Endpoint not found'));
  }, [name]);

  if (!endpoint) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/tracker')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tracker
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{endpoint.displayName}</h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              endpoint.visibility === 'public'
                ? 'bg-info/10 text-info'
                : 'bg-muted text-muted-foreground'
            }`}>
              {endpoint.visibility === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {endpoint.visibility}
            </span>
          </div>
          {endpoint.description && <p className="mt-1 text-muted-foreground">{endpoint.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground font-mono">{endpoint.name}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {(['data', 'settings', 'api'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'data' ? 'Data' : t === 'settings' ? 'Settings' : 'API Info'}
          </button>
        ))}
      </div>

      {tab === 'data' && <DataTab endpoint={endpoint} />}
      {tab === 'settings' && <SettingsTab endpoint={endpoint} onUpdate={setEndpoint} />}
      {tab === 'api' && <ApiInfoTab endpoint={endpoint} />}
    </div>
  );
}

function DataTab({ endpoint }: { endpoint: TrackerEndpoint }) {
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntryJson, setNewEntryJson] = useState('{}');
  const limit = 20;

  const schemaProperties = Object.keys(endpoint.schema?.properties || {});

  const load = useCallback(async (off: number) => {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(off) });
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      const res = await api<{ data: QueryResult }>(`/api/v1/tracker/endpoints/${endpoint.name}/data?${params}`);
      setEntries(res.data.items);
      setTotal(res.data.total);
      setOffset(res.data.offset);
    } catch {
      toast.error('Failed to load data');
    }
  }, [endpoint.name, from, to]);

  useEffect(() => { load(0); }, [load]);

  const handleAddEntry = async () => {
    let data;
    try {
      data = JSON.parse(newEntryJson);
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    try {
      await api(`/api/v1/tracker/endpoints/${endpoint.name}/data`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast.success('Entry added');
      setNewEntryJson('{}');
      setShowAddForm(false);
      load(offset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add entry');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/v1/tracker/endpoints/${endpoint.name}/data/${id}`, { method: 'DELETE' });
      toast.success('Entry deleted');
      load(offset);
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Entry
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">New Data Entry</p>
          <p className="text-xs text-muted-foreground">
            Schema fields: {schemaProperties.join(', ') || 'none'}
          </p>
          <textarea
            value={newEntryJson}
            onChange={(e) => setNewEntryJson(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddEntry}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Submit
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              {schemaProperties.map((prop) => (
                <th key={prop} className="p-3">{prop}</th>
              ))}
              <th className="p-3">Timestamp</th>
              <th className="p-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                {schemaProperties.map((prop) => (
                  <td key={prop} className="p-3 text-sm">
                    {formatCellValue(entry.data?.[prop])}
                  </td>
                ))}
                <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive"
                    title="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={schemaProperties.length + 2} className="p-6 text-center text-muted-foreground">
                  No data entries yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => load(offset - limit)}
            disabled={offset <= 0}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} entries)
          </span>
          <button
            onClick={() => load(offset + limit)}
            disabled={offset + limit >= total}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function SettingsTab({
  endpoint,
  onUpdate,
}: {
  endpoint: TrackerEndpoint;
  onUpdate: (ep: TrackerEndpoint) => void;
}) {
  const [displayName, setDisplayName] = useState(endpoint.displayName);
  const [description, setDescription] = useState(endpoint.description);
  const [visibility, setVisibility] = useState(endpoint.visibility);
  const [schemaText, setSchemaText] = useState(JSON.stringify(endpoint.schema, null, 2));
  const [retentionDays, setRetentionDays] = useState(endpoint.retentionDays?.toString() || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    let schema;
    try {
      schema = JSON.parse(schemaText);
    } catch {
      toast.error('Invalid JSON schema');
      return;
    }

    setSaving(true);
    try {
      const res = await api<{ data: TrackerEndpoint }>(`/api/v1/tracker/endpoints/${endpoint.name}`, {
        method: 'PUT',
        body: JSON.stringify({
          displayName,
          description,
          visibility,
          schema,
          retentionDays: retentionDays ? Number(retentionDays) : null,
        }),
      });
      onUpdate(res.data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={512}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Visibility</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={visibility === 'private'}
              onChange={() => setVisibility('private')}
            />
            Private
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={visibility === 'public'}
              onChange={() => setVisibility('public')}
            />
            Public
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Data Schema (JSON Schema)</label>
        <textarea
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Retention (days)</label>
        <input
          type="number"
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.value)}
          placeholder="No limit"
          min={1}
          className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

function ApiInfoTab({ endpoint }: { endpoint: TrackerEndpoint }) {
  const trackerUrl = process.env.NEXT_PUBLIC_TRACKER_URL || 'http://localhost:4006';

  const authSubmitUrl = `${trackerUrl}/api/v1/tracker/endpoints/${endpoint.name}/data`;
  const authQueryUrl = `${trackerUrl}/api/v1/tracker/endpoints/${endpoint.name}/data?limit=10`;
  const publicSubmitUrl = `${trackerUrl}/api/v1/tracker/public/${endpoint.name}/data`;
  const publicQueryUrl = `${trackerUrl}/api/v1/tracker/public/${endpoint.name}/data?limit=10`;

  const sampleData: Record<string, unknown> = {};
  for (const [key, schemaDef] of Object.entries(endpoint.schema?.properties || {})) {
    const def = schemaDef as Record<string, unknown>;
    if (def.type === 'number') sampleData[key] = 42;
    else if (def.type === 'boolean') sampleData[key] = true;
    else if (def.type === 'string') sampleData[key] = 'example';
    else sampleData[key] = null;
  }

  const curlSubmit = `curl -X POST ${authSubmitUrl} \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(sampleData)}'`;

  const curlQuery = `curl ${authQueryUrl} \\
  -H "Authorization: Bearer <TOKEN>"`;

  const curlPublicSubmit = `curl -X POST ${publicSubmitUrl} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(sampleData)}'`;

  const curlPublicQuery = `curl ${publicQueryUrl}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Authenticated API</h2>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Submit Data</p>
            <button onClick={() => copyToClipboard(curlSubmit)} className="rounded p-1 hover:bg-muted" title="Copy">
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto whitespace-pre-wrap">{curlSubmit}</pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Query Data</p>
            <button onClick={() => copyToClipboard(curlQuery)} className="rounded p-1 hover:bg-muted" title="Copy">
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto whitespace-pre-wrap">{curlQuery}</pre>
        </div>
      </section>

      {endpoint.visibility === 'public' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Public API (no auth required)</h2>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">Submit Data</p>
              <button onClick={() => copyToClipboard(curlPublicSubmit)} className="rounded p-1 hover:bg-muted" title="Copy">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto whitespace-pre-wrap">{curlPublicSubmit}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">Query Data</p>
              <button onClick={() => copyToClipboard(curlPublicQuery)} className="rounded p-1 hover:bg-muted" title="Copy">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto whitespace-pre-wrap">{curlPublicQuery}</pre>
          </div>

          <div className="rounded-lg border p-4 bg-info/10">
            <p className="text-sm">
              Public page: <a href={`/public/tracker/${endpoint.name}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">/public/tracker/{endpoint.name}</a>
            </p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Query Parameters</h2>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Parameter</th>
                <th className="p-3">Type</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['from', 'ISO date', 'Filter entries from this date'],
                ['to', 'ISO date', 'Filter entries up to this date'],
                ['sort', 'field:asc|desc', 'Sort by field (default: createdAt:desc)'],
                ['limit', 'number', 'Max entries to return (default: 100)'],
                ['offset', 'number', 'Skip N entries (default: 0)'],
              ].map(([param, type, desc]) => (
                <tr key={param} className="border-b last:border-0">
                  <td className="p-3 font-mono">{param}</td>
                  <td className="p-3 text-muted-foreground">{type}</td>
                  <td className="p-3 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Schema</h2>
        <pre className="rounded-lg border bg-muted p-4 text-sm font-mono overflow-auto max-h-64">
          {JSON.stringify(endpoint.schema, null, 2)}
        </pre>
      </section>
    </div>
  );
}
