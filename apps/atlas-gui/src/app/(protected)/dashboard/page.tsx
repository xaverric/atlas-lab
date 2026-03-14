'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { StatsCard } from '@/components/dashboard/stats-card';
import { DashboardWidget } from '@/components/dashboard/dashboard-widget';
import { dashboardStore, type DashboardItem } from '@/lib/dashboard-store';
import { toast } from 'sonner';
import type { User } from '@atlas/core';

export default function DashboardPage() {
  const { user: oidcUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [pins, setPins] = useState<DashboardItem[]>([]);

  useEffect(() => {
    api<{ data: User }>('/api/v1/users/me')
      .then((res) => setProfile(res.data))
      .catch(console.error);
    setPins(dashboardStore.getItems());
  }, []);

  const handleRemove = useCallback((jobId: string) => {
    setPins(dashboardStore.removeItem(jobId));
    toast.success('Removed from dashboard');
  }, []);

  return (
    <div className="space-y-6">
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

      <div>
        <h2 className="text-lg font-semibold mb-3">Monitoring</h2>
        {pins.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pins.map((pin) => (
              <DashboardWidget
                key={pin.jobId}
                jobId={pin.jobId}
                jobName={pin.jobName}
                onRemove={() => handleRemove(pin.jobId)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
            <p className="text-muted-foreground mb-2">No jobs pinned to dashboard</p>
            <Link href="/scheduler" className="text-sm text-primary hover:underline">
              Go to Scheduler
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
