'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { User } from '@atlas/core';

export default function SettingsPage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [theme, setTheme] = useState<string>('system');

  useEffect(() => {
    api<{ data: User }>('/api/v1/users/me')
      .then((res) => {
        setProfile(res.data);
        setTheme(res.data.preferences?.theme || 'system');
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      const res = await api<{ data: User }>('/api/v1/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ theme }),
      });
      setProfile(res.data);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-4 rounded-lg border p-6">
        <div>
          <label className="text-sm font-medium">Email</label>
          <p className="text-muted-foreground">{profile?.email || '-'}</p>
        </div>
        <div>
          <label htmlFor="theme" className="text-sm font-medium">Theme</label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <button
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  );
}
