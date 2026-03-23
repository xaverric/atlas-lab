'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  FolderPlus,
  Upload,
  Folder,
  FileText,
  StickyNote,
  Clock,
  Bell,
  BarChart3,
  ScrollText,
  Settings,
  User,
  Mail,
  MessageCircle,
  Palette,
  Activity,
  Layout,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  SectionPanel,
  PanelHeader,
  PanelSearch,
  PanelScroll,
  PanelGroup,
  PanelItem,
  PanelAction,
} from '@/components/layout/section-panel';
import { useNotificationContext } from '@/contexts/notification-context';
import { api } from '@/lib/api';

function DashboardPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Dashboard" />
      <PanelScroll>
        <PanelGroup label="Widgets">
          <PanelItem icon={<Layout />} label="All Widgets" active />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

interface PanelFolder {
  id: string;
  name: string;
  documentCount?: number;
}

function FilesPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('folderId');
  const [folders, setFolders] = useState<PanelFolder[]>([]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api<{ data: PanelFolder[] }>('/api/v1/files/folders');
      setFolders(res.data);
    } catch {
      // silently ignore — panel will show empty list
    }
  }, []);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  return (
    <SectionPanel>
      <PanelHeader title="Files">
        <PanelAction primary title="Upload" onClick={() => router.push('/files/upload')}><Upload /></PanelAction>
      </PanelHeader>
      <PanelScroll>
        <PanelGroup label="Folders">
          <PanelItem
            icon={<Folder />}
            label="All Files"
            active={!activeFolderId}
            onClick={() => router.push('/files')}
          />
          {folders.map((f) => (
            <PanelItem
              key={f.id}
              icon={<Folder />}
              label={f.name}
              count={f.documentCount != null ? f.documentCount : undefined}
              active={activeFolderId === f.id}
              onClick={() => router.push(`/files?folderId=${f.id}`)}
            />
          ))}
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

interface SchedulerJob {
  id: string;
  name: string;
  group?: string;
  enabled: boolean;
  lastRun?: { status: string };
}

function SchedulerPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);

  useEffect(() => {
    api<{ data: SchedulerJob[]; total: number }>('/api/v1/scheduler/jobs?limit=100')
      .then((res) => setJobs(res.data))
      .catch(() => {});
  }, []);

  const groups = jobs.reduce<Record<string, number>>((acc, job) => {
    const g = job.group || 'Ungrouped';
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });

  const runningCount = jobs.filter((j) => j.enabled && j.lastRun?.status === 'success').length;
  const failedCount = jobs.filter((j) => j.lastRun?.status === 'failed').length;
  const disabledCount = jobs.filter((j) => !j.enabled).length;

  const activeGroup = searchParams.get('group');
  const isAllJobs = pathname === '/scheduler' && !activeGroup;

  return (
    <SectionPanel>
      <PanelHeader title="Scheduler">
        <PanelAction primary title="New job" onClick={() => router.push('/scheduler/jobs/new')}>
          <Plus />
        </PanelAction>
      </PanelHeader>
      <PanelScroll>
        <PanelGroup label="Groups">
          <PanelItem
            icon={<Clock />}
            label="All Jobs"
            count={jobs.length || undefined}
            active={isAllJobs}
            onClick={() => router.push('/scheduler')}
          />
          {sortedGroups.map(([group, count]) => (
            <PanelItem
              key={group}
              label={group}
              count={count}
              active={activeGroup === group}
              onClick={() => router.push(`/scheduler?group=${encodeURIComponent(group)}`)}
            />
          ))}
        </PanelGroup>
        <PanelGroup label="Status">
          <PanelItem label="Running" badge={{ text: String(runningCount), color: 'green' }} />
          <PanelItem label="Failed" badge={{ text: String(failedCount), color: 'red' }} />
          <PanelItem label="Disabled" badge={{ text: String(disabledCount), color: 'muted' }} />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function NotificationsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unreadCount } = useNotificationContext();
  const currentFilter = searchParams.get('filter') || 'all';

  const navigate = (filter: string) => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    const qs = params.toString();
    router.push(`/notifications${qs ? `?${qs}` : ''}`);
  };

  return (
    <SectionPanel>
      <PanelHeader title="Notifications" />
      <PanelScroll>
        <PanelGroup label="Filters">
          <PanelItem
            icon={<Bell />}
            label="All"
            active={currentFilter === 'all'}
            onClick={() => navigate('all')}
          />
          <PanelItem
            label="Unread"
            active={currentFilter === 'unread'}
            badge={unreadCount > 0 ? { text: String(unreadCount), color: 'blue' } : undefined}
            onClick={() => navigate('unread')}
          />
          <PanelItem
            label="Read"
            active={currentFilter === 'read'}
            onClick={() => navigate('read')}
          />
        </PanelGroup>
        <PanelGroup label="Channels">
          <PanelItem icon={<Mail />} label="Email" />
          <PanelItem icon={<MessageCircle />} label="Telegram" />
        </PanelGroup>
        <PanelGroup label="Manage">
          <PanelItem
            icon={<Settings />}
            label="Preferences"
            onClick={() => router.push('/notifications/preferences')}
          />
          <PanelItem icon={<FileText />} label="Templates" />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

interface NoteFolder {
  id: string;
  name: string;
  noteCount?: number;
}

interface RecentNote {
  id: string;
  title: string;
  updatedAt: string;
}

function NotesPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('folderId') || null;
  const activeNoteId = searchParams.get('noteId') || null;

  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);

  useEffect(() => {
    api<{ data: NoteFolder[] }>('/api/v1/notes/folders')
      .then((res) => setFolders(res.data))
      .catch((err) => console.error('NotesPanel: failed to load folders', err));
    api<{ data: RecentNote[] }>('/api/v1/notes?limit=5&sortBy=updatedAt&sortOrder=desc')
      .then((res) => setRecentNotes(res.data))
      .catch((err) => console.error('NotesPanel: failed to load recent notes', err));
  }, []);

  const navigateToFolder = (id: string | null) => {
    router.push(id ? `/notes?folderId=${id}` : '/notes');
  };

  const navigateToNote = (id: string) => {
    const params = new URLSearchParams();
    if (activeFolderId) params.set('folderId', activeFolderId);
    params.set('noteId', id);
    router.push(`/notes?${params}`);
  };

  return (
    <SectionPanel>
      <PanelHeader title="Notes">
        <PanelAction primary title="New folder" onClick={() => {
          const name = prompt('Folder name:');
          if (name?.trim()) {
            api('/api/v1/notes/folders', { method: 'POST', body: JSON.stringify({ name: name.trim(), parentId: activeFolderId }) })
              .then(() => api<{ data: NoteFolder[] }>('/api/v1/notes/folders'))
              .then((res) => setFolders(res.data))
              .catch(() => {});
          }
        }}><FolderPlus /></PanelAction>
        <PanelAction primary title="New note" onClick={() => {
          router.push(`/notes/new${activeFolderId ? `?folderId=${activeFolderId}` : ''}`);
        }}><Plus /></PanelAction>
      </PanelHeader>
      <PanelScroll>
        <PanelGroup label="Folders">
          <PanelItem
            icon={<StickyNote />}
            label="All Notes"
            active={!activeFolderId && !activeNoteId}
            onClick={() => navigateToFolder(null)}
          />
          {folders.map((f) => (
            <PanelItem
              key={f.id}
              icon={<Folder />}
              label={f.name}
              count={f.noteCount != null ? f.noteCount : undefined}
              active={activeFolderId === f.id}
              onClick={() => navigateToFolder(f.id)}
            />
          ))}
        </PanelGroup>
        {recentNotes.length > 0 && (
          <PanelGroup label="Recent">
            {recentNotes.map((n) => (
              <PanelItem
                key={n.id}
                icon={<FileText />}
                label={n.title}
                active={activeNoteId === n.id}
                onClick={() => navigateToNote(n.id)}
              />
            ))}
          </PanelGroup>
        )}
      </PanelScroll>
    </SectionPanel>
  );
}

interface TrackerEndpoint {
  name: string;
  displayName?: string;
  visibility?: string;
}

function TrackerPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [endpoints, setEndpoints] = useState<TrackerEndpoint[]>([]);

  useEffect(() => {
    api<{ data: TrackerEndpoint[] }>('/api/v1/tracker/endpoints')
      .then((res) => setEndpoints(res.data))
      .catch(() => {});
  }, []);

  const isAll = pathname === '/tracker';

  return (
    <SectionPanel>
      <PanelHeader title="Tracker">
        <PanelAction primary title="Create endpoint" onClick={() => router.push('/tracker/new')}>
          <Plus />
        </PanelAction>
      </PanelHeader>
      <PanelScroll>
        <PanelGroup label="Endpoints">
          <PanelItem
            icon={<BarChart3 />}
            label="All Endpoints"
            count={endpoints.length || undefined}
            active={isAll}
            onClick={() => router.push('/tracker')}
          />
          {endpoints.map((ep) => (
            <PanelItem
              key={ep.name}
              icon={<Activity />}
              label={ep.displayName || ep.name}
              badge={{ text: '', color: ep.visibility === 'active' ? 'green' : 'muted' }}
              active={pathname === `/tracker/${ep.name}`}
              onClick={() => router.push(`/tracker/${ep.name}`)}
            />
          ))}
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function AuditPanel() {
  const [stats, setStats] = useState<{ service: string; count: number }[]>([]);
  const [totals, setTotals] = useState({ success: 0, error: 0, total: 0 });

  useEffect(() => {
    const services = ['atlas-core', 'atlas-dms', 'atlas-scheduler', 'atlas-notify', 'atlas-notes', 'atlas-tracker'];
    Promise.all(
      services.map(async (svc) => {
        try {
          const res = await api<{ total: number }>(`/api/v1/audit?service=${svc}&limit=1`);
          return { service: svc, count: res.total ?? 0 };
        } catch { return { service: svc, count: 0 }; }
      })
    ).then(setStats);
    Promise.all([
      api<{ total: number }>('/api/v1/audit?limit=1').then(r => r.total ?? 0).catch(() => 0),
      api<{ total: number }>('/api/v1/audit?status=error&limit=1').then(r => r.total ?? 0).catch(() => 0),
    ]).then(([total, errors]) => setTotals({ total, error: errors, success: total - errors }));
  }, []);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <SectionPanel>
      <PanelHeader title="Audit Log" />
      <PanelScroll>
        <PanelGroup label="Services">
          <PanelItem icon={<ScrollText />} label="All Events" active count={totals.total || undefined} />
          {stats.map((s) => (
            <PanelItem key={s.service} label={s.service} count={s.count || undefined} />
          ))}
        </PanelGroup>
        <PanelGroup label="Status">
          <PanelItem label="Success" badge={{ text: fmt(totals.success), color: 'green' }} />
          <PanelItem label="Error" badge={{ text: fmt(totals.error), color: 'red' }} />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Auto' },
  ] as const;
  return (
    <div className="mx-3 mt-2 mb-1 flex gap-1 rounded-lg bg-muted p-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
            theme === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

function SettingsPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Settings" />
      <ThemeSwitcher />
      <PanelScroll>
        <PanelGroup label="General">
          <PanelItem icon={<User />} label="Profile" active />
        </PanelGroup>
        <PanelGroup label="System">
          <PanelItem icon={<Layout />} label="Resources" />
          <PanelItem icon={<Activity />} label="Services Health" />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

const panelMap: [string, () => React.JSX.Element][] = [
  ['/files', FilesPanel],
  ['/scheduler', SchedulerPanel],
  ['/notifications', NotificationsPanel],
  ['/notes', NotesPanel],
  ['/tracker', TrackerPanel],
  ['/audit', AuditPanel],
  ['/settings', SettingsPanel],
  ['/dashboard', DashboardPanel],
];

export function ActivePanel() {
  const pathname = usePathname();
  const match = panelMap.find(([prefix]) => pathname.startsWith(prefix));
  const Panel = match ? match[1] : DashboardPanel;
  return <Panel />;
}
