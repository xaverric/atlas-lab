'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePush } from '@/hooks/use-push';

interface Channel {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  verified: boolean;
  enabled: boolean;
}

interface Rule {
  id: string;
  eventPattern: string;
  channelIds: Array<{ id: string; type: string; label: string } | string>;
  enabled: boolean;
}

const CHANNEL_TYPES = [
  { value: 'email', label: 'Email', configField: 'address', placeholder: 'you@example.com' },
  { value: 'telegram', label: 'Telegram', configField: 'chatId', placeholder: 'Chat ID' },
  { value: 'web_push', label: 'Web Push', configField: null, placeholder: '' },
  { value: 'signal', label: 'Signal', configField: 'signalNumber', placeholder: '+1234567890' },
  { value: 'whatsapp', label: 'WhatsApp', configField: 'phoneNumber', placeholder: '+1234567890' },
  { value: 'sms', label: 'SMS', configField: 'phoneNumber', placeholder: '+1234567890' },
];

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newChannelType, setNewChannelType] = useState('email');
  const [newChannelValue, setNewChannelValue] = useState('');
  const [newPattern, setNewPattern] = useState('*');
  const [newRuleChannels, setNewRuleChannels] = useState<string[]>([]);
  const { isSupported: pushSupported, isEnabled: pushEnabled, permission: pushPermission, enablePush } = usePush();

  const loadData = useCallback(async () => {
    try {
      const [chRes, rRes] = await Promise.all([
        api<{ data: Channel[] }>('/api/v1/notifications/channels'),
        api<{ data: Rule[] }>('/api/v1/notifications/preferences/rules'),
      ]);
      setChannels(chRes.data);
      setRules(rRes.data);
    } catch { toast.error('Failed to load preferences'); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const addChannel = async () => {
    const typeDef = CHANNEL_TYPES.find((t) => t.value === newChannelType);
    if (!typeDef) return;

    const config: Record<string, unknown> = {};
    if (typeDef.configField && newChannelValue) {
      config[typeDef.configField] = newChannelValue;
    }

    try {
      await api('/api/v1/notifications/channels', {
        method: 'POST',
        body: JSON.stringify({ type: newChannelType, label: typeDef.label, config }),
      });
      setNewChannelValue('');
      toast.success('Channel added');
      loadData();
    } catch { toast.error('Failed to add channel'); }
  };

  const removeChannel = async (id: string) => {
    try {
      await api(`/api/v1/notifications/channels/${id}`, { method: 'DELETE' });
      loadData();
    } catch { toast.error('Failed to remove channel'); }
  };

  const toggleChannel = async (id: string, enabled: boolean) => {
    try {
      await api(`/api/v1/notifications/channels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      loadData();
    } catch { toast.error('Failed to update channel'); }
  };

  const verifyChannel = async (id: string, code: string) => {
    try {
      await api(`/api/v1/notifications/channels/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      toast.success('Channel verified');
      loadData();
    } catch { toast.error('Verification failed'); }
  };

  const addRule = async () => {
    if (!newPattern || newRuleChannels.length === 0) {
      toast.error('Select at least one channel');
      return;
    }
    try {
      await api('/api/v1/notifications/preferences/rules', {
        method: 'POST',
        body: JSON.stringify({ eventPattern: newPattern, channelIds: newRuleChannels }),
      });
      setNewPattern('*');
      setNewRuleChannels([]);
      toast.success('Rule added');
      loadData();
    } catch { toast.error('Failed to add rule'); }
  };

  const removeRule = async (id: string) => {
    try {
      await api(`/api/v1/notifications/preferences/rules/${id}`, { method: 'DELETE' });
      loadData();
    } catch { toast.error('Failed to remove rule'); }
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    try {
      await api(`/api/v1/notifications/preferences/rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      loadData();
    } catch { toast.error('Failed to update rule'); }
  };

  const getChannelLabel = (ch: Rule['channelIds'][0]) =>
    typeof ch === 'string' ? ch : `${ch.label} (${ch.type})`;

  return (
    <div className="max-w-2xl space-y-8">
      <button onClick={() => router.push('/notifications')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Notifications
      </button>

      <h1 className="text-2xl font-semibold tracking-tight">Notification Preferences</h1>

      {/* Channels */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Delivery Channels</h2>

        {channels.map((ch) => (
          <div key={ch.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ch.enabled} onChange={(e) => toggleChannel(ch.id, e.target.checked)} className="rounded" />
              </label>
              <div>
                <span className="text-sm font-medium">{ch.label}</span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{ch.type}</span>
                {!ch.verified && <span className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">unverified</span>}
                {ch.verified && <span className="ml-2 text-xs text-success"><Check className="inline h-3 w-3" /> verified</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!ch.verified && ch.type !== 'in_app' && ch.type !== 'web_push' && (
                <VerifyInput onVerify={(code) => verifyChannel(ch.id, code)} />
              )}
              <button onClick={() => removeChannel(ch.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value)} className="rounded-md border bg-background px-2 py-1.5 text-sm">
            {CHANNEL_TYPES.map((t) => (
              <option key={t.value} value={t.value} disabled={t.disabled}>
                {t.label}{t.disabled ? ' (Coming soon)' : ''}
              </option>
            ))}
          </select>
          {CHANNEL_TYPES.find((t) => t.value === newChannelType)?.configField && (
            <input
              value={newChannelValue}
              onChange={(e) => setNewChannelValue(e.target.value)}
              placeholder={CHANNEL_TYPES.find((t) => t.value === newChannelType)?.placeholder}
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          )}
          <button onClick={addChannel} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {/* Web Push */}
        {pushSupported && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Browser Push Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  {pushPermission === 'denied' ? 'Permission denied by browser' :
                   pushEnabled ? 'Enabled' : 'Get notified even when the app is in the background'}
                </p>
              </div>
              {!pushEnabled && pushPermission !== 'denied' && (
                <button onClick={enablePush} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Enable
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Routing Rules */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Routing Rules</h2>
        <p className="text-sm text-muted-foreground">Define which events get delivered to which channels. Use glob patterns like <code>scheduler.job.*</code> or <code>*</code> for all events.</p>

        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={rule.enabled} onChange={(e) => toggleRule(rule.id, e.target.checked)} className="rounded" />
              <div>
                <code className="text-sm font-medium">{rule.eventPattern}</code>
                <div className="mt-1 flex gap-1">
                  {rule.channelIds.map((ch, i) => (
                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs">{getChannelLabel(ch)}</span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => removeRule(rule.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="Event pattern (e.g. scheduler.job.*)"
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {channels.filter((ch) => ch.verified).map((ch) => (
              <label key={ch.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={newRuleChannels.includes(ch.id)}
                  onChange={(e) => {
                    setNewRuleChannels((prev) =>
                      e.target.checked ? [...prev, ch.id] : prev.filter((id) => id !== ch.id)
                    );
                  }}
                  className="rounded"
                />
                {ch.label}
              </label>
            ))}
          </div>
          <button onClick={addRule} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        </div>
      </section>
    </div>
  );
}

function VerifyInput({ onVerify }: { onVerify: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <div className="flex gap-1">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code"
        className="w-20 rounded-md border bg-background px-2 py-1 text-xs"
      />
      <button onClick={() => onVerify(code)} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
        Verify
      </button>
    </div>
  );
}
