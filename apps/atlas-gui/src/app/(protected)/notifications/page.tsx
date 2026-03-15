'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ViewToggle, useViewMode } from '@/components/shared/view-toggle';
import { useNotificationContext } from '@/contexts/notification-context';
import { getStatusClasses } from '@/lib/status-colors';

interface Notification {
  id: string;
  event?: string;
  title?: string;
  templateKey?: string;
  channel?: string;
  status?: string;
  subject?: string;
  body?: string;
  error?: string;
  read: boolean;
  priority?: string;
  deliveries?: Array<{ channelType: string; status: string }>;
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
  const [view, setView] = useViewMode('notifications-view', 'list');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const { markRead, markAllRead } = useNotificationContext();

  const load = async (p: number) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (filter === 'unread') params.set('read', 'false');
      if (filter === 'read') params.set('read', 'true');
      const res = await api<ListResponse>(`/api/v1/notifications?${params}`);
      setNotifications(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load notifications');
    }
  };

  useEffect(() => { load(1); }, [filter]);

  const handleMarkRead = async (id: string) => {
    await markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const channelBadges = (n: Notification) => {
    if (n.deliveries?.length) {
      return n.deliveries.map((d) => (
        <span key={d.channelType} className={`rounded px-1.5 py-0.5 text-xs ${d.status === 'sent' ? getStatusClasses('delivered') : d.status === 'failed' ? getStatusClasses('failed') : 'bg-muted text-muted-foreground'}`}>
          {d.channelType}
        </span>
      ));
    }
    if (n.channel) {
      return <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{n.channel}</span>;
    }
    return null;
  };

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            title="Mark all read"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
          <ViewToggle view={view} onChange={setView} />
          <Link
            href="/notifications/preferences"
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
            Preferences
          </Link>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`rounded-lg border p-4 ${!n.read ? 'border-info/30 bg-info/5' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-info" />}
                    {channelBadges(n)}
                    {n.event && <span className="text-xs text-muted-foreground">{n.event}</span>}
                  </div>
                  <p className="mt-2 font-medium">{n.title || n.subject || n.event || 'Notification'}</p>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{n.body}</p>}
                  {n.error && <p className="mt-1 text-sm text-destructive">{n.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <button onClick={() => handleMarkRead(n.id)} className="rounded p-1 hover:bg-muted" title="Mark read">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No notifications yet</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Date</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className={`border-b last:border-b-0 hover:bg-accent/50 transition-colors ${!n.read ? 'bg-info/5' : ''}`}>
                  <td className="px-4 py-3">
                    {!n.read && <span className="block h-2 w-2 rounded-full bg-info" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">{channelBadges(n)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-md">
                      <p className="truncate font-medium">{n.title || n.subject || 'Notification'}</p>
                      {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{n.event || n.templateKey}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {!n.read && (
                      <button onClick={() => handleMarkRead(n.id)} className="rounded p-1 hover:bg-muted" title="Mark read">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {notifications.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No notifications yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
          <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => load(page + 1)} disabled={page * 20 >= total} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
