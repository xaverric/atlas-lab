# GUI Redesign Phase 1: Foundation

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sidebar+header layout with a service-rail+section-panel pattern, and create reusable Modal/Drawer shells.

**Architecture:** New AppShell renders three zones: ServiceRail (52px icon strip), SectionPanel (220px contextual nav), and MainContent (flex-1). Header is removed; its functionality (user info, theme, logout) moves into a UserMenu dropdown on the rail. Each section page provides its own panel content via a layout convention.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, Lucide React icons, next-themes, existing auth/notification contexts.

**Reference:** `mockup-full-app.html` for all visual specs.

---

### Task 1: Add CSS variables for the rail

**Files:**
- Modify: `apps/atlas-gui/src/app/globals.css`

- [ ] **Step 1:** Add rail-specific color variables to the `@theme` block and `.dark` block in globals.css

Add after the existing sidebar variables in `@theme` (around line 46):
```css
/* Rail — darker than sidebar */
--color-rail-background: #eceef4;
--color-rail-border: #e2e4ea;
```

Add to `.dark` block (around line 191):
```css
--color-rail-background: #181825;
--color-rail-border: #1e1e2e;
```

- [ ] **Step 2:** Verify build

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npm -w @atlas/gui run build`
Expected: Build succeeds

- [ ] **Step 3:** Commit

```bash
git add apps/atlas-gui/src/app/globals.css
git commit -m "feat(gui): add rail CSS variables for new layout"
```

---

### Task 2: Create ServiceRail component

**Files:**
- Create: `apps/atlas-gui/src/components/layout/service-rail.tsx`

- [ ] **Step 1:** Create the ServiceRail component

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Clock, Bell, StickyNote,
  BarChart3, ScrollText, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationContext } from '@/contexts/notification-context';
import { UserMenu } from './user-menu';
import type { LucideIcon } from 'lucide-react';

interface RailItem {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: boolean;
}

const mainItems: RailItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/files', icon: FileText, label: 'File Storage' },
  { href: '/scheduler', icon: Clock, label: 'Scheduler' },
  { href: '/notifications', icon: Bell, label: 'Notifications', badge: true },
  { href: '/notes', icon: StickyNote, label: 'Notes' },
  { href: '/tracker', icon: BarChart3, label: 'Data Tracker' },
];

const systemItems: RailItem[] = [
  { href: '/audit', icon: ScrollText, label: 'Audit Log' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

function RailButton({ item, isActive }: { item: RailItem; isActive: boolean }) {
  const { unreadCount } = useNotificationContext();
  const showBadge = item.badge && unreadCount > 0;

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.06]',
      )}
      aria-label={item.label}
    >
      <item.icon className="h-[18px] w-[18px]" />
      {showBadge && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-rail-background" />
      )}
      <span className="pointer-events-none absolute left-[calc(100%+8px)] z-50 hidden rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-lg group-hover:block whitespace-nowrap">
        {item.label}
      </span>
    </Link>
  );
}

export function ServiceRail() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');

  return (
    <aside className="flex h-full w-[52px] flex-col items-center gap-1 border-r border-rail-border bg-rail-background py-3 flex-shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="mb-3 flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 40 40" fill="none" className="h-6 w-6 text-foreground">
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="28" r="3.5" />
            <circle cx="26" cy="20" r="3" />
            <circle cx="18" cy="8" r="2.5" />
            <circle cx="32" cy="10" r="2.5" />
            <line x1="14.5" y1="26" x2="23.5" y2="21.5" />
            <line x1="19.5" y1="10" x2="24" y2="18" />
            <line x1="28.5" y1="18.5" x2="30" y2="12" />
          </g>
        </svg>
      </Link>

      {/* Main nav */}
      {mainItems.map((item) => (
        <RailButton key={item.href} item={item} isActive={isActive(item.href)} />
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="mx-auto my-1 h-px w-6 bg-border/60" />

      {/* System nav */}
      {systemItems.map((item) => (
        <RailButton key={item.href} item={item} isActive={isActive(item.href)} />
      ))}

      <div className="h-1" />

      {/* User menu */}
      <UserMenu />
    </aside>
  );
}
```

- [ ] **Step 2:** Verify no type errors

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npx -w @atlas/gui tsc --noEmit 2>&1 | head -20`
Expected: Will fail because UserMenu doesn't exist yet — that's fine, we create it next.

---

### Task 3: Create UserMenu component

**Files:**
- Create: `apps/atlas-gui/src/components/layout/user-menu.tsx`

- [ ] **Step 1:** Create the UserMenu dropdown component (replaces header user/theme/logout)

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/use-auth';

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : '??';
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const profile = user?.profile;
  const initials = getInitials(profile?.name as string, profile?.email as string);

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-opacity hover:opacity-85"
        title={profile?.name as string || 'User'}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute bottom-full left-[calc(100%+8px)] mb-0 w-52 rounded-xl border bg-card shadow-lg z-50">
          {/* User info */}
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-semibold truncate">{profile?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email || ''}</p>
          </div>

          {/* Theme */}
          <div className="border-b px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Theme</p>
            <div className="flex gap-1">
              {themeOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                    theme === value
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Logout */}
          <div className="px-1.5 py-1.5">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** Verify types compile

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npx -w @atlas/gui tsc --noEmit 2>&1 | head -20`
Expected: Should still fail only due to unused ServiceRail/UserMenu (not imported yet)

- [ ] **Step 3:** Commit

```bash
git add apps/atlas-gui/src/components/layout/service-rail.tsx apps/atlas-gui/src/components/layout/user-menu.tsx
git commit -m "feat(gui): add ServiceRail and UserMenu components"
```

---

### Task 4: Create SectionPanel component

**Files:**
- Create: `apps/atlas-gui/src/components/layout/section-panel.tsx`

- [ ] **Step 1:** Create the reusable SectionPanel shell with all sub-components

```tsx
'use client';

import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

/* ---------- Panel root ---------- */
export function SectionPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="flex h-full w-[220px] flex-col overflow-hidden border-r border-border bg-sidebar-background flex-shrink-0">
      {children}
    </aside>
  );
}

/* ---------- Header ---------- */
export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
      <span className="text-sm font-semibold">{title}</span>
      {children && <div className="flex gap-1">{children}</div>}
    </div>
  );
}

/* ---------- Search ---------- */
export function PanelSearch({ placeholder = 'Search...' }: { placeholder?: string }) {
  return (
    <div className="mx-3 mt-2.5 mb-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 focus-within:border-ring transition-colors">
      <Search className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
      <input
        type="text"
        placeholder={placeholder}
        className="w-full border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

/* ---------- Scrollable area ---------- */
export function PanelScroll({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-y-auto pb-2">{children}</div>;
}

/* ---------- Group title ---------- */
export function PanelGroup({ label }: { label: string }) {
  return (
    <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/60">
      {label}
    </p>
  );
}

/* ---------- Nav item ---------- */
interface PanelItemProps {
  active?: boolean;
  icon?: ReactNode;
  label: string;
  count?: number | string;
  badge?: { text: string; color: 'green' | 'red' | 'blue' | 'yellow' | 'info' | 'muted' };
  onClick?: () => void;
  href?: string;
}

const badgeColors = {
  green: 'bg-success/10 text-success',
  red: 'bg-destructive/10 text-destructive',
  blue: 'bg-primary/10 text-primary',
  yellow: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted text-muted-foreground',
} as const;

export function PanelItem({ active, icon, label, count, badge, onClick }: PanelItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'mx-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-left transition-all',
        active
          ? 'bg-primary/8 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon && <span className="flex h-4 w-4 items-center justify-center flex-shrink-0">{icon}</span>}
      <span className="truncate min-w-0">{label}</span>
      {count != null && <span className="ml-auto text-[11px] text-muted-foreground/40">{count}</span>}
      {badge && (
        <span className={cn('ml-auto rounded px-1.5 py-px text-[10px] font-semibold', badgeColors[badge.color])}>
          {badge.text}
        </span>
      )}
    </button>
  );
}

/* ---------- Header action button ---------- */
export function PanelAction({
  children,
  primary,
  onClick,
  title,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        primary
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2:** Commit

```bash
git add apps/atlas-gui/src/components/layout/section-panel.tsx
git commit -m "feat(gui): add SectionPanel compound component"
```

---

### Task 5: Create Modal and Drawer shells

**Files:**
- Create: `apps/atlas-gui/src/components/shared/modal.tsx`
- Create: `apps/atlas-gui/src/components/shared/drawer.tsx`

- [ ] **Step 1:** Create reusable Modal shell

```tsx
'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-[640px]' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[4px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${maxWidth} w-[90%] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-card border border-border shadow-[0_24px_64px_rgba(0,0,0,0.15)]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Create reusable Drawer shell

```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Drawer({ open, onClose, title, children, width = 'w-[380px]' }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[199] bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[200] flex flex-col border-l border-border bg-card shadow-[-8px_0_32px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-out',
          width,
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}
```

- [ ] **Step 3:** Commit

```bash
git add apps/atlas-gui/src/components/shared/modal.tsx apps/atlas-gui/src/components/shared/drawer.tsx
git commit -m "feat(gui): add reusable Modal and Drawer shells"
```

---

### Task 6: Create PageHeader component

**Files:**
- Create: `apps/atlas-gui/src/components/shared/page-header.tsx`

- [ ] **Step 1:** Create reusable PageHeader for section views

```tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-8 py-5 flex-shrink-0">
      <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2:** Commit

```bash
git add apps/atlas-gui/src/components/shared/page-header.tsx
git commit -m "feat(gui): add PageHeader shared component"
```

---

### Task 7: Create placeholder section panels

**Files:**
- Create: `apps/atlas-gui/src/components/layout/panels/index.tsx`

Create a single file that exports a panel selector component. In Phase 2, each section will get its own dedicated panel — for now we provide simple placeholder panels that show the section name and basic nav, so the app is functional after the layout swap.

- [ ] **Step 1:** Create panels index with placeholder content per section

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Plus, FolderPlus, Upload, Search,
  Folder, FileText, StickyNote, Clock, Bell, BarChart3, ScrollText, Settings as SettingsIcon, User,
} from 'lucide-react';
import {
  SectionPanel, PanelHeader, PanelSearch, PanelScroll,
  PanelGroup, PanelItem, PanelAction,
} from '../section-panel';

function DashboardPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Dashboard" />
      <PanelScroll>
        <PanelGroup label="Widgets" />
        <PanelItem active label="All Widgets" icon={<BarChart3 className="h-3.5 w-3.5" />} />
      </PanelScroll>
    </SectionPanel>
  );
}

function FilesPanel() {
  const router = useRouter();
  return (
    <SectionPanel>
      <PanelHeader title="Files">
        <PanelAction title="New folder"><FolderPlus className="h-3.5 w-3.5" /></PanelAction>
        <PanelAction primary title="Upload" onClick={() => router.push('/files')}><Upload className="h-3.5 w-3.5" /></PanelAction>
      </PanelHeader>
      <PanelSearch placeholder="Search files..." />
      <PanelScroll>
        <PanelGroup label="Folders" />
        <PanelItem active label="All Files" icon={<Folder className="h-3.5 w-3.5" />} count="—" />
      </PanelScroll>
    </SectionPanel>
  );
}

function SchedulerPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Scheduler">
        <PanelAction primary title="New job"><Plus className="h-3.5 w-3.5" /></PanelAction>
      </PanelHeader>
      <PanelSearch placeholder="Search jobs..." />
      <PanelScroll>
        <PanelGroup label="Groups" />
        <PanelItem active label="All Jobs" icon={<Clock className="h-3.5 w-3.5" />} count="—" />
      </PanelScroll>
    </SectionPanel>
  );
}

function NotificationsPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Notifications" />
      <PanelScroll>
        <PanelGroup label="Filters" />
        <PanelItem active label="All" icon={<Bell className="h-3.5 w-3.5" />} count="—" />
        <PanelItem label="Unread" />
      </PanelScroll>
    </SectionPanel>
  );
}

function NotesPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Notes">
        <PanelAction title="New folder"><FolderPlus className="h-3.5 w-3.5" /></PanelAction>
        <PanelAction primary title="New note"><Plus className="h-3.5 w-3.5" /></PanelAction>
      </PanelHeader>
      <PanelSearch placeholder="Search notes..." />
      <PanelScroll>
        <PanelGroup label="Folders" />
        <PanelItem active label="All Notes" icon={<Folder className="h-3.5 w-3.5" />} count="—" />
      </PanelScroll>
    </SectionPanel>
  );
}

function TrackerPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Tracker">
        <PanelAction primary title="Create endpoint"><Plus className="h-3.5 w-3.5" /></PanelAction>
      </PanelHeader>
      <PanelScroll>
        <PanelGroup label="Endpoints" />
        <PanelItem active label="All Endpoints" icon={<BarChart3 className="h-3.5 w-3.5" />} count="—" />
      </PanelScroll>
    </SectionPanel>
  );
}

function AuditPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Audit Log" />
      <PanelScroll>
        <PanelGroup label="Services" />
        <PanelItem active label="All Events" icon={<ScrollText className="h-3.5 w-3.5" />} />
      </PanelScroll>
    </SectionPanel>
  );
}

function SettingsPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Settings" />
      <PanelScroll>
        <PanelGroup label="General" />
        <PanelItem active label="Profile" icon={<User className="h-3.5 w-3.5" />} />
        <PanelItem label="Appearance" />
        <PanelGroup label="System" />
        <PanelItem label="Resources" />
        <PanelItem label="Services Health" />
      </PanelScroll>
    </SectionPanel>
  );
}

const panelMap: Record<string, () => JSX.Element> = {
  '/dashboard': DashboardPanel,
  '/files': FilesPanel,
  '/scheduler': SchedulerPanel,
  '/notifications': NotificationsPanel,
  '/notes': NotesPanel,
  '/tracker': TrackerPanel,
  '/audit': AuditPanel,
  '/settings': SettingsPanel,
};

export function ActivePanel() {
  const pathname = usePathname();

  for (const [prefix, Panel] of Object.entries(panelMap)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return <Panel />;
    }
  }

  return <DashboardPanel />;
}
```

- [ ] **Step 2:** Commit

```bash
git add apps/atlas-gui/src/components/layout/panels/index.tsx
git commit -m "feat(gui): add placeholder section panels for all routes"
```

---

### Task 8: Rewrite AppShell and remove Header

**Files:**
- Modify: `apps/atlas-gui/src/components/layout/app-shell.tsx`

- [ ] **Step 1:** Rewrite AppShell to use the new three-zone layout

Replace the entire file with:

```tsx
'use client';

import { ServiceRail } from './service-rail';
import { ActivePanel } from './panels';
import { NotificationProvider } from '@/contexts/notification-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <div className="flex h-dvh overflow-hidden">
        <ServiceRail />
        <ActivePanel />
        <main className="flex flex-1 flex-col overflow-hidden min-w-0">
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}
```

Note: The old `Header` component and `Sidebar` component are no longer imported. We keep the files around for now (they may still be imported elsewhere), but they are dead code. The `<main>` no longer has padding — each section page controls its own padding via `PageHeader` + scrollable body.

- [ ] **Step 2:** Run typecheck and build

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npm -w @atlas/gui run build 2>&1 | tail -20`
Expected: Build succeeds. The old sidebar.tsx and header.tsx still exist as files but are unused.

- [ ] **Step 3:** Verify the app runs

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npm run dev:gui &`
Open: `http://localhost:3000/dashboard`
Expected: Three-zone layout visible — rail on left, panel, content area with existing page.

- [ ] **Step 4:** Commit

```bash
git add apps/atlas-gui/src/components/layout/app-shell.tsx
git commit -m "feat(gui): rewrite AppShell with rail+panel+content layout"
```

---

### Task 9: Update globals.css for new layout patterns

**Files:**
- Modify: `apps/atlas-gui/src/app/globals.css`

- [ ] **Step 1:** Remove the old `aside` and `header` frosted glass rules (they applied globally and may interfere with the new layout). Update both light and dark blocks.

Remove these rules from `@layer base`:
```css
/* Sidebar — frosted glass effect */
aside {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Header — frosted glass */
header {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  background: oklch(from #fbfbfd l c h / 0.88);
}
```

Remove from `.dark`:
```css
& header {
  background: oklch(from #1e1e2e l c h / 0.85);
}
```

These were blanket rules targeting all `aside`/`header` elements. The new components apply their own styles via Tailwind classes.

- [ ] **Step 2:** Verify build

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npm -w @atlas/gui run build`

- [ ] **Step 3:** Commit

```bash
git add apps/atlas-gui/src/app/globals.css
git commit -m "refactor(gui): remove old global aside/header frosted glass CSS"
```

---

### Task 10: Remove old Header and Sidebar files

**Files:**
- Delete: `apps/atlas-gui/src/components/layout/header.tsx`
- Delete: `apps/atlas-gui/src/components/layout/sidebar.tsx`

- [ ] **Step 1:** Verify no remaining imports

Run: `cd /Users/jilek/Documents/personal/atlas-lab && grep -r "from.*['\"].*layout/header" apps/atlas-gui/src/ && grep -r "from.*['\"].*layout/sidebar" apps/atlas-gui/src/`
Expected: No matches (AppShell no longer imports them).

- [ ] **Step 2:** Delete the files

```bash
rm apps/atlas-gui/src/components/layout/header.tsx apps/atlas-gui/src/components/layout/sidebar.tsx
```

- [ ] **Step 3:** Verify build still passes

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npm -w @atlas/gui run build`

- [ ] **Step 4:** Commit

```bash
git add -A apps/atlas-gui/src/components/layout/
git commit -m "chore(gui): remove old Header and Sidebar components"
```

---

### Task 11: Update section pages to remove outer padding reliance

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/layout.tsx` (if needed)

The old layout applied `p-4 md:p-6` on `<main>`. The new AppShell has no padding on `<main>` — each page controls its own layout. Most section pages already have their own wrappers, but verify they render correctly.

- [ ] **Step 1:** Check the protected layout doesn't add extra wrappers

Read `apps/atlas-gui/src/app/(protected)/layout.tsx` and ensure it just passes children to AppShell without adding padding.

- [ ] **Step 2:** Quick visual check of each section

Navigate to each route in the browser and verify content appears in the main area:
- `/dashboard`, `/files`, `/scheduler`, `/notifications`, `/notes`, `/tracker`, `/audit`, `/settings`

Some pages may need minor padding adjustments — note any issues but don't fix them now. Phase 2 will redesign each section's content.

- [ ] **Step 3:** Final build + lint + typecheck

Run: `cd /Users/jilek/Documents/personal/atlas-lab && npm run lint && npm run typecheck && npm run test`
Expected: All pass

- [ ] **Step 4:** Commit any fixes

```bash
git add -A
git commit -m "fix(gui): adjust section pages for new layout without outer padding"
```
