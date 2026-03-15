'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';

interface StorageItem {
  id: string;
  name: string;
  type: string;
  size: number;
  sizeFormatted: string;
  date: string | null;
}

interface StorageDetail {
  items: StorageItem[];
  total: number;
}

type SortField = 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

interface Props {
  section: string;
  sectionName: string;
  color: string;
  onClose: () => void;
}

export function StorageDetailModal({ section, sectionName, color, onClose }: Props) {
  const [data, setData] = useState<StorageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>('size');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api<{ data: StorageDetail }>(`/api/v1/system/storage/${section}?sortBy=${sortBy}&sortOrder=${sortOrder}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [section, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc'
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border bg-card shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: color }} />
            <h2 className="text-lg font-semibold">{sectionName}</h2>
            {data && (
              <span className="text-xs text-muted-foreground">
                {data.total} item{data.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sort controls */}
        <div className="flex gap-1 border-b px-5 py-2">
          <span className="text-xs text-muted-foreground mr-2 self-center">Sort by:</span>
          {(['name', 'size', 'date'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                sortBy === field ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              <SortIcon field={field} />
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </div>
          )}

          {error && (
            <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium text-right">Size</th>
                  <th className="px-5 py-2 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-2.5 font-medium truncate max-w-[240px]" title={item.name}>
                      {item.name}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px]" title={item.type}>
                      {item.type}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{item.sizeFormatted}</td>
                    <td className="px-5 py-2.5 text-right text-muted-foreground">{formatDate(item.date)}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
