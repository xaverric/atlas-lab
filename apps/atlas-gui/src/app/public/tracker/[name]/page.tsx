'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface TrackerEndpoint {
  id: string;
  name: string;
  displayName: string;
  description: string;
  visibility: 'public';
  schema: { type: string; properties: Record<string, unknown> };
  createdAt: string;
}

interface DataEntry {
  id: string;
  data: Record<string, unknown>;
  metadata: { source: string };
  createdAt: string;
}

interface QueryResult {
  items: DataEntry[];
  total: number;
  limit: number;
  offset: number;
}

const TRACKER_URL = process.env.NEXT_PUBLIC_TRACKER_URL || 'http://localhost:4006';

export default function PublicTrackerPage() {
  const { name } = useParams<{ name: string }>();
  const [endpoint, setEndpoint] = useState<TrackerEndpoint | null>(null);
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const limit = 20;

  useEffect(() => {
    fetch(`${TRACKER_URL}/api/v1/tracker/public/${name}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Not found');
        const body = await res.json();
        setEndpoint(body.data);
      })
      .catch(() => setError('Endpoint not found or is not public'));
  }, [name]);

  const loadData = useCallback(async (off: number) => {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(off) });
      const res = await fetch(`${TRACKER_URL}/api/v1/tracker/public/${name}/data?${params}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      const result: QueryResult = body.data;
      setEntries(result.items);
      setTotal(result.total);
      setOffset(result.offset);
    } catch {
      setError('Failed to load data');
    }
  }, [name]);

  useEffect(() => {
    if (endpoint) loadData(0);
  }, [endpoint, loadData]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Not Found</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!endpoint) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const schemaProperties = Object.keys(endpoint.schema?.properties || {});
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{endpoint.displayName}</h1>
          {endpoint.description && (
            <p className="mt-2 text-muted-foreground">{endpoint.description}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {total} entries
          </p>
        </header>

        <div className="overflow-hidden rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e]">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                {schemaProperties.map((prop) => (
                  <th key={prop} className="p-3 font-medium">{prop}</th>
                ))}
                <th className="p-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b last:border-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  {schemaProperties.map((prop) => (
                    <td key={prop} className="p-3 text-sm text-foreground">
                      {formatValue(entry.data?.[prop])}
                    </td>
                  ))}
                  <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={schemaProperties.length + 1}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No data entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => loadData(offset - limit)}
              disabled={offset <= 0}
              className="rounded bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#2c2c2e] dark:text-white px-3 py-1 text-sm text-foreground disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => loadData(offset + limit)}
              disabled={offset + limit >= total}
              className="rounded bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#2c2c2e] dark:text-white px-3 py-1 text-sm text-foreground disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          Powered by Atlas Tracker
        </footer>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
