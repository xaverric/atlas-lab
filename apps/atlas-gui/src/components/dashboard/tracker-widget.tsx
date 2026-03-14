'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface TrackerEndpoint {
  name: string;
  displayName: string;
  schema: { properties: Record<string, { type?: string; description?: string }> };
}

interface TrackerDataRow {
  id: string;
  createdAt: string;
  [key: string]: unknown;
}

interface TrackerTableWidgetProps {
  endpointName: string;
  limit?: number;
}

export function TrackerTableWidget({ endpointName, limit = 10 }: TrackerTableWidgetProps) {
  const [endpoint, setEndpoint] = useState<TrackerEndpoint | null>(null);
  const [rows, setRows] = useState<TrackerDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      api<{ data: TrackerEndpoint }>(`/api/v1/tracker/endpoints/${endpointName}`),
      api<{ data: TrackerDataRow[] }>(`/api/v1/tracker/endpoints/${endpointName}/data?limit=${limit}&sort=-createdAt`),
    ])
      .then(([epRes, dataRes]) => {
        setEndpoint(epRes.data);
        setRows(dataRes.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpointName, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Failed to load: {error}</p>;
  }

  const columns = Object.keys(endpoint?.schema?.properties || {});

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {columns.slice(0, 4).map((col) => (
                  <th key={col} className="px-2 py-1.5 font-medium">{col}</th>
                ))}
                <th className="px-2 py-1.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  {columns.slice(0, 4).map((col) => (
                    <td key={col} className="px-2 py-1.5 truncate max-w-[120px]">
                      {String(row[col] ?? '-')}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link
        href={`/tracker/${endpointName}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        View all <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
