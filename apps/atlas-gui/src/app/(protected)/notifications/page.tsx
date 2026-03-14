'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  templateKey: string;
  channel: string;
  status: string;
  subject?: string;
  body?: string;
  error?: string;
  createdAt: string;
}

interface ListResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = async (p: number) => {
    try {
      const res = await api<ListResponse>(`/api/v1/notifications?page=${p}&limit=20`);
      setNotifications(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load notifications');
    }
  };

  useEffect(() => { load(1); }, []);

  const statusColor = (status: string) => {
    if (status === 'sent') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (status === 'failed') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Link
          href="/notifications/preferences"
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Preferences
        </Link>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(n.status)}`}>
                    {n.status}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{n.channel}</span>
                  <span className="text-xs text-muted-foreground">{n.templateKey}</span>
                </div>
                {n.subject && <p className="mt-2 font-medium">{n.subject}</p>}
                {n.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{n.body}</p>}
                {n.error && <p className="mt-1 text-sm text-red-600">{n.error}</p>}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No notifications yet</p>
        )}
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
