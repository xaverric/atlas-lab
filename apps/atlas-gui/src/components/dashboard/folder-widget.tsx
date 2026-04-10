'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, StickyNote, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface FolderItem {
  id: string;
  name?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

interface FolderWidgetProps {
  type: 'notes' | 'files';
  folderId: string | null;
  folderName: string;
}

export function FolderWidget({ type, folderId, folderName }: FolderWidgetProps) {
  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const folderParam = folderId ? `folderId=${folderId}&` : '';

    const url = type === 'notes'
      ? `/api/v1/notes?${folderParam}limit=5&sortBy=updatedAt&sortOrder=desc`
      : `/api/v1/files/documents?${folderParam}limit=5&sortBy=createdAt&sortOrder=desc`;

    api<{ data: FolderItem[] }>(url)
      .then((res) => setItems(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type, folderId]);

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

  const Icon = type === 'notes' ? StickyNote : FileText;
  const basePath = type === 'notes' ? '/notes' : '/files';
  const paramKey = type === 'notes' ? 'noteId' : 'docId';

  return (
    <div className="space-y-1">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No items</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`${basePath}?${paramKey}=${item.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{item.title || item.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(item.updatedAt || item.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={folderId ? `${basePath}?folderId=${folderId}` : basePath}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2"
      >
        View all in {folderName} <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
