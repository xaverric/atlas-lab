'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { StorageChart } from '@/components/system/storage-chart';
import {
  Server, Database, RefreshCw,
} from 'lucide-react';
import type { User as UserType } from '@atlas/core';

interface SystemResources {
  system: {
    hostname: string;
    platform: string;
    nodeVersion: string;
    cpuModel: string;
    cpuCount: number;
    uptimeFormatted: string;
    uptimeSeconds: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: string;
    totalFormatted: string;
    usedFormatted: string;
    freeFormatted: string;
  };
  cpu: {
    usagePercent: string;
    cores: number;
    model: string;
  };
  process: {
    uptimeFormatted: string;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    heapUsedFormatted: string;
    rssFormatted: string;
  };
  updatedAt: string;
}

interface ServiceCheck {
  name: string;
  url: string;
  status: 'loading' | 'ok' | 'error';
  responseTime?: number;
}

const SERVICES: { name: string; url: string }[] = [
  { name: 'Core API', url: '/api/v1/users/me' },
  { name: 'File Storage', url: '/api/v1/files/documents/tags' },
  { name: 'Notes', url: '/api/v1/notes/tags' },
  { name: 'Scheduler', url: '/api/v1/scheduler/jobs?limit=1' },
  { name: 'Notifications', url: '/api/v1/notifications?limit=1' },
];

function getGaugeLevel(pct: number): 'success' | 'warning' | 'destructive' {
  if (pct < 50) return 'success';
  if (pct < 80) return 'warning';
  return 'destructive';
}

const levelColors: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

const badgeColors: Record<string, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

function GaugeCard({ label, pct, detail }: {
  label: string; pct: number; detail: string;
}) {
  const level = getGaugeLevel(pct);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${badgeColors[level]}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${levelColors[level]}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserType | null>(null);
  const [resources, setResources] = useState<SystemResources | null>(null);
  const [services, setServices] = useState<ServiceCheck[]>(
    SERVICES.map(s => ({ ...s, status: 'loading' as const }))
  );
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    api<{ data: UserType }>('/api/v1/users/me')
      .then(res => setProfile(res.data))
      .catch(console.error);
  }, []);

  const loadResources = useCallback(() => {
    api<{ data: SystemResources }>('/api/v1/system/resources')
      .then(res => setResources(res.data))
      .catch(console.error);
  }, []);

  const checkServices = useCallback(() => {
    SERVICES.forEach((svc, i) => {
      const start = performance.now();
      api(svc.url)
        .then(() => {
          const ms = Math.round(performance.now() - start);
          setServices(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'ok', responseTime: ms };
            return next;
          });
        })
        .catch(() => {
          setServices(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'error', responseTime: undefined };
            return next;
          });
        });
    });
  }, []);

  useEffect(() => {
    loadResources();
    checkServices();
    if (!isLive) return;
    const interval = setInterval(() => {
      loadResources();
      checkServices();
    }, 10000);
    return () => clearInterval(interval);
  }, [isLive, loadResources, checkServices]);

  const cpuPct = parseFloat(resources?.cpu.usagePercent || '0');
  const memPct = parseFloat(resources?.memory.usagePercent || '0');
  const heapPct = resources
    ? (resources.process.heapUsed / resources.process.heapTotal) * 100
    : 0;

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const allHealthy = services.every(s => s.status === 'ok');

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLive(prev => !prev)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isLive
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {isLive ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={() => { loadResources(); checkServices(); }}
            className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            {initials}
          </div>
          <div>
            <div className="text-base font-semibold">{profile?.name || 'Loading...'}</div>
            <div className="text-sm text-muted-foreground">{profile?.email || '-'}</div>
            <span className="mt-1 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {profile?.role || 'user'}
            </span>
          </div>
        </div>
      </div>

      {/* Resource gauges */}
      <div className="grid grid-cols-3 gap-4">
        <GaugeCard
          label="CPU"
          pct={cpuPct}
          detail={resources ? `${resources.cpu.model}, ${resources.cpu.cores} cores` : 'Loading...'}
        />
        <GaugeCard
          label="Memory"
          pct={memPct}
          detail={resources ? `${resources.memory.usedFormatted} / ${resources.memory.totalFormatted}` : 'Loading...'}
        />
        <GaugeCard
          label="Heap"
          pct={heapPct}
          detail={resources ? `${resources.process.heapUsedFormatted} / ${formatBytes(resources.process.heapTotal)}` : 'Loading...'}
        />
      </div>

      {/* Service Health */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <span className="text-sm font-medium">Service Health</span>
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
            allHealthy ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
          }`}>
            {allHealthy ? 'All healthy' : `${services.filter(s => s.status === 'ok').length}/${services.length} online`}
          </span>
        </div>
        <div className="px-6">
          {services.map((svc, i) => (
            <div
              key={svc.name}
              className={`flex items-center justify-between py-3 ${
                i < services.length - 1 ? 'border-b' : ''
              }`}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  svc.status === 'ok' ? 'bg-success' : svc.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground animate-pulse'
                }`} />
                {svc.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {svc.status === 'ok' && svc.responseTime !== undefined
                  ? `${svc.responseTime}ms`
                  : svc.status === 'error' ? 'Offline' : 'Checking...'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* System Info + Storage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium">System Info</h3>
              <p className="text-xs text-muted-foreground">Host & runtime</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hostname</span>
              <span className="font-mono text-xs">{resources?.system.hostname || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-mono text-xs">{resources?.system.platform || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Node.js</span>
              <span className="font-mono text-xs">{resources?.system.nodeVersion || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-mono text-xs">{resources?.system.uptimeFormatted || '-'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Storage Usage</h3>
              <p className="text-xs text-muted-foreground">Disk space breakdown</p>
            </div>
          </div>
          <StorageChart />
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
