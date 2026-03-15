'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { StorageChart } from '@/components/system/storage-chart';
import { User, Mail, Shield, Database, Server, RefreshCw } from 'lucide-react';
import type { User as UserType } from '@atlas/core';

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserType | null>(null);

  useEffect(() => {
    api<{ data: UserType }>('/api/v1/users/me')
      .then((res) => setProfile(res.data))
      .catch(console.error);
  }, []);

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Profile section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">{profile?.name || 'Loading...'}</h3>
              <p className="text-sm text-muted-foreground">{profile?.role || 'user'}</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{profile?.email || '-'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Role: <span className="font-medium">{profile?.role || 'user'}</span></span>
            </div>
          </div>
        </div>

        {/* Quick system info */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">System</h3>
              <p className="text-sm text-muted-foreground">Service health & info</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <ServiceStatus name="Core API" url="/api/v1/users/me" />
            <ServiceStatus name="File Storage" url="/api/v1/files/documents/tags" />
            <ServiceStatus name="Notes" url="/api/v1/notes/tags" />
            <ServiceStatus name="Scheduler" url="/api/v1/scheduler/jobs?limit=1" />
          </div>
        </div>
      </div>

      {/* Storage — full width, bigger */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">Storage Usage</h3>
            <p className="text-sm text-muted-foreground">Disk space breakdown across all services</p>
          </div>
        </div>
        <StorageChart />
      </div>
    </div>
  );
}

function ServiceStatus({ name, url }: { name: string; url: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    api(url)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [url]);

  return (
    <div className="flex items-center justify-between text-sm">
      <span>{name}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${
        status === 'ok' ? 'text-success' : status === 'error' ? 'text-destructive' : 'text-muted-foreground'
      }`}>
        <span className={`h-2 w-2 rounded-full ${
          status === 'ok' ? 'bg-success' : status === 'error' ? 'bg-destructive' : 'bg-muted-foreground animate-pulse'
        }`} />
        {status === 'ok' ? 'Online' : status === 'error' ? 'Offline' : 'Checking...'}
      </span>
    </div>
  );
}
