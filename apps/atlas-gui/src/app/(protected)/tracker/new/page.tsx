'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';

const DEFAULT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      value: { type: 'number' },
    },
    required: ['value'],
  },
  null,
  2,
);

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CreateEndpointPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState('');
  const [nameManual, setNameManual] = useState(false);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [retentionDays, setRetentionDays] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (!nameManual) setName(toSlug(val));
  };

  const handleNameChange = (val: string) => {
    setNameManual(true);
    setName(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let schema;
    try {
      schema = JSON.parse(schemaText);
    } catch {
      toast.error('Invalid JSON schema');
      return;
    }

    if (schema.type !== 'object' || !schema.properties) {
      toast.error('Schema must have type "object" and "properties"');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/v1/tracker/endpoints', {
        method: 'POST',
        body: JSON.stringify({
          name,
          displayName,
          description: description || undefined,
          visibility,
          schema,
          retentionDays: retentionDays ? Number(retentionDays) : undefined,
        }),
      });
      toast.success('Endpoint created');
      router.push(`/tracker/${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create endpoint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Create Endpoint" />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <button
            onClick={() => router.push('/tracker')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Tracker
          </button>

          <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="My Tracker"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="my-tracker"
            required
            pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
            title="URL-friendly slug: lowercase letters, numbers, and hyphens"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">URL-friendly identifier. Auto-generated from display name.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
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
          <p className="mt-1 text-xs text-muted-foreground">
            Public endpoints can be queried and submitted to without authentication.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Data Schema (JSON Schema)</label>
          <textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Defines the shape of data entries. Must be a JSON Schema with type &quot;object&quot;.
          </p>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Automatically delete entries older than this. Leave empty for no limit.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !name || !displayName}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Endpoint'}
        </button>
      </form>
        </div>
      </div>
    </div>
  );
}
