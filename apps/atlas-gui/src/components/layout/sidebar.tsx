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
    <aside className="flex h-full flex-col border-r bg-sidebar-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <svg viewBox="0 0 140 40" fill="none" className="h-7 text-foreground" xmlns="http://www.w3.org/2000/svg">
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="28" r="3.5" />
            <circle cx="26" cy="20" r="3" />
            <circle cx="18" cy="8" r="2.5" />
            <circle cx="32" cy="10" r="2.5" />
            <line x1="14.5" y1="26" x2="23.5" y2="21.5" />
            <line x1="19.5" y1="10" x2="24" y2="18" />
            <line x1="28.5" y1="18.5" x2="30" y2="12" />
          </g>
          <text x="40" y="31" fontFamily="system-ui, sans-serif" fontSize="28" fontWeight="600" letterSpacing="-0.5" fill="currentColor">atlas</text>
        </svg>
      </div>
      <nav className="flex-1 overflow-auto p-3 pt-4">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      pathname.startsWith(href)
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
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
