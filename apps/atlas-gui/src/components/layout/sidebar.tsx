'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, FileText, Clock, Bell, StickyNote, BarChart3, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'General',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Services',
    items: [
      { href: '/files', label: 'File Storage', icon: FileText },
      { href: '/scheduler', label: 'Scheduler', icon: Clock },
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/notes', label: 'Notes', icon: StickyNote },
      { href: '/tracker', label: 'Data Tracker', icon: BarChart3 },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col border-r bg-sidebar-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold">Atlas</span>
      </div>
      <nav className="flex-1 overflow-auto p-3">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      pathname.startsWith(href)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
