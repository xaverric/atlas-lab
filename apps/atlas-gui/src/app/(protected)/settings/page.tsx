'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { StorageChart } from '@/components/system/storage-chart';
import {
  Cpu, MemoryStick, Clock, Server, Activity,
  User, Mail, Shield, Database, RefreshCw,
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

function getGaugeColor(pct: number): string {
  if (pct < 50) return '#40a02b';
  if (pct < 75) return '#df8e1d';
  return '#d20f39';
}

function GaugeBar({ value, max, label, detail, color }: {
  value: number; max: number; label: string; detail: string; color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-2xl font-bold">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
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

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">System Dashboard</h1>
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

      {/* Resource gauges */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GaugeBar
          value={cpuPct}
          max={100}
          label="CPU Usage"
          detail={resources ? `${resources.cpu.model} - ${resources.cpu.cores} cores` : 'Loading...'}
          color={getGaugeColor(cpuPct)}
        />
        <GaugeBar
          value={memPct}
          max={100}
          label="Memory Usage"
          detail={resources ? `${resources.memory.usedFormatted} / ${resources.memory.totalFormatted}` : 'Loading...'}
          color={getGaugeColor(memPct)}
        />
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Uptime</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">System</span>
              <span className="text-lg font-bold">{resources?.system.uptimeFormatted || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Atlas Core</span>
              <span className="text-lg font-bold">{resources?.process.uptimeFormatted || '-'}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Heap: {resources?.process.heapUsedFormatted || '-'} | RSS: {resources?.process.rssFormatted || '-'}
          </p>
        </div>
      </div>

      {/* Service health + Profile + System info */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Service health */}
        <div className="rounded-lg border bg-card p-6 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">Service Health</h3>
              <p className="text-xs text-muted-foreground">
                {services.filter(s => s.status === 'ok').length}/{services.length} online
              </p>
            </div>
          </div>
          <div className="space-y-3 pt-1">
            {services.map(svc => (
              <div key={svc.name} className="flex items-center justify-between text-sm">
                <span>{svc.name}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${
                  svc.status === 'ok' ? 'text-success' : svc.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {svc.status === 'ok' && svc.responseTime !== undefined && (
                    <span className="text-muted-foreground mr-1">{svc.responseTime}ms</span>
                  )}
                  <span className={`h-2 w-2 rounded-full ${
                    svc.status === 'ok' ? 'bg-success' : svc.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground animate-pulse'
                  }`} />
                  {svc.status === 'ok' ? 'Online' : svc.status === 'error' ? 'Offline' : 'Checking'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div className="rounded-lg border bg-card p-6 space-y-4 lg:col-span-1">
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

        {/* System info */}
        <div className="rounded-lg border bg-card p-6 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">System Info</h3>
              <p className="text-xs text-muted-foreground">Host & runtime</p>
            </div>
          </div>
          <div className="space-y-3 pt-2 text-sm">
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
              <span className="text-muted-foreground">CPU Cores</span>
              <span className="font-mono text-xs">{resources?.system.cpuCount || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Storage — full width */}
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
