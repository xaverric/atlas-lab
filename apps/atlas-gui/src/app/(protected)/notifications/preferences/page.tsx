'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ChannelPrefs {
  enabled: boolean;
  address?: string;
  chatId?: string;
}

interface Preferences {
  channels: {
    email: ChannelPrefs;
    telegram: ChannelPrefs;
  };
}

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Preferences>({
    channels: {
      email: { enabled: false, address: '' },
      telegram: { enabled: false, chatId: '' },
    },
  });

  useEffect(() => {
    api<{ data: Preferences | null }>('/api/v1/notifications/preferences')
      .then((res) => {
        if (res.data) setPrefs(res.data);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await api('/api/v1/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ channels: prefs.channels }),
      });
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  const updateChannel = (channel: 'email' | 'telegram', field: string, value: unknown) => {
    setPrefs((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: { ...prev.channels[channel], [field]: value },
      },
    }));
  };

  return (
    <div className="max-w-xl space-y-6">
      <button onClick={() => router.push('/notifications')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Notifications
      </button>

      <h1 className="text-3xl font-bold">Notification Preferences</h1>

      <div className="space-y-6">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Email</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.channels.email.enabled}
                onChange={(e) => updateChannel('email', 'enabled', e.target.checked)}
                className="rounded"
              />
              Enabled
            </label>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email address</label>
            <input
              value={prefs.channels.email.address || ''}
              onChange={(e) => updateChannel('email', 'address', e.target.value)}
              placeholder="you@example.com"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Telegram</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.channels.telegram.enabled}
                onChange={(e) => updateChannel('telegram', 'enabled', e.target.checked)}
                className="rounded"
              />
              Enabled
            </label>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Chat ID</label>
            <input
              value={prefs.channels.telegram.chatId || ''}
              onChange={(e) => updateChannel('telegram', 'chatId', e.target.value)}
              placeholder="123456789"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Save Preferences
      </button>
    </div>
  );
}
