'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, Check, CheckCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useNotificationContext } from '@/contexts/notification-context';
import { getStatusClasses } from '@/lib/status-colors';
import { PageHeader } from '@/components/shared/page-header';

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

type FilterValue = 'all' | 'unread' | 'read';

const filterOptions: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

export default function NotificationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sendingTest, setSendingTest] = useState(false);
  const { markRead, markAllRead } = useNotificationContext();

  const filter: FilterValue = (['all', 'unread', 'read'] as const).includes(
    searchParams.get('filter') as FilterValue
  )
    ? (searchParams.get('filter') as FilterValue)
    : 'all';

  const setFilter = (value: FilterValue) => {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('filter', value);
    const qs = params.toString();
    router.push(`/notifications${qs ? `?${qs}` : ''}`);
  };

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

  const sendTest = async () => {
    setSendingTest(true);
    try {
      await api('/api/v1/notifications/test', { method: 'POST' });
      toast.success('Test notification sent');
      setTimeout(() => load(page), 500);
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setSendingTest(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deliveryLabel = (status: string) => {
    if (status === 'sent') return 'delivered';
    return status;
  };

  const channelBadges = (n: Notification) => {
    if (n.deliveries?.length) {
      return n.deliveries.map((d) => (
        <span
          key={d.channelType}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            d.status === 'sent'
              ? getStatusClasses('delivered')
              : d.status === 'failed'
                ? getStatusClasses('failed')
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {d.channelType}: {deliveryLabel(d.status)}
        </span>
      ));
    }
    if (n.channel) {
      return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{n.channel}</span>;
    }
    return null;
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Notifications">
        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          title="Mark all read"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
        <button
          onClick={sendTest}
          disabled={sendingTest}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
          title="Send a test notification"
        >
          <Send className="h-4 w-4" />
          {sendingTest ? 'Sending...' : 'Send Test'}
        </button>
        <Link
          href="/notifications/preferences"
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <Settings className="h-4 w-4" />
          Preferences
        </Link>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        <div className="flex items-center gap-1.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-[#0071e3] text-white'
                  : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] text-muted-foreground hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-3 rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-4 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
                !n.read ? 'border-l-[3px] border-l-primary' : ''
              }`}
            >
              <div className="mt-1.5 flex-shrink-0">
                {!n.read ? (
                  <span className="block h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <span className="block h-2 w-2" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug">
                  {n.title || n.subject || n.event || 'Notification'}
                </p>
                {n.body && (
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
                    {n.body}
                  </p>
                )}
                {n.error && (
                  <p className="mt-0.5 text-[13px] text-destructive">{n.error}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {channelBadges(n)}
                  <span className="text-[12px] text-muted-foreground">
                    {formatTime(n.createdAt)}
                  </span>
                  {n.event && (
                    <span className="text-[12px] text-muted-foreground/60">
                      {n.event}
                    </span>
                  )}
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-black/[0.04] dark:hover:bg-white/[0.06] group-hover:opacity-100"
                  title="Mark read"
                >
                  <Check className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <p>No notifications yet</p>
            </div>
          )}
        </div>

        {total > 20 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
            <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => load(page + 1)} disabled={page * 20 >= total} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
