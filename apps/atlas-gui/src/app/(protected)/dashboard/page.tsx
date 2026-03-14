'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { StatsCard } from '@/components/dashboard/stats-card';
import type { User } from '@atlas/core';

export default function DashboardPage() {
  const { user: oidcUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    api<{ data: User }>('/api/v1/users/me')
      .then((res) => setProfile(res.data))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Welcome"
          value={profile?.name || oidcUser?.profile?.name || 'User'}
          description="Good to see you"
        />
        <StatsCard
          title="Role"
          value={profile?.role || 'user'}
          description="Your current role"
        />
        <StatsCard
          title="Theme"
          value={profile?.preferences?.theme || 'system'}
          description="Current preference"
        />
      </div>
    </div>
  );
}
