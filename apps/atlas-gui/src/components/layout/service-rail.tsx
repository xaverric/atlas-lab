'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Clock,
  Bell,
  StickyNote,
  BarChart3,
  ScrollText,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationContext } from '@/contexts/notification-context';
import { UserMenu } from './user-menu';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

const mainItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/files', label: 'Files', icon: FileText },
  { href: '/scheduler', label: 'Scheduler', icon: Clock },
  { href: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/tracker', label: 'Tracker', icon: BarChart3 },
];

const systemItems: NavItem[] = [
  { href: '/audit', label: 'Audit', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function RailButton({ item, isActive, showBadge, onNavigate }: {
  item: NavItem;
  isActive: boolean;
  showBadge: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        isActive
          ? 'bg-white/15 text-white'
          : 'text-white/60 hover:text-white hover:bg-white/10',
      )}
      aria-label={item.label}
    >
      <Icon className="h-[18px] w-[18px]" />
      {showBadge && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#ff3b30]" />
      )}
      <span className="pointer-events-none absolute left-full ml-2 z-[100] hidden rounded-md bg-[#1d1d1f] px-2 py-1 text-xs text-white shadow-md group-hover:block">
        {item.label}
      </span>
    </Link>
  );
}

function HorizontalNavButton({ item, isActive, showBadge, onNavigate }: {
  item: NavItem;
  isActive: boolean;
  showBadge: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-[#0071e3] text-white'
          : 'text-[#1d1d1f] hover:bg-black/[0.04]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
      {showBadge && (
        <span className="h-2 w-2 rounded-full bg-[#ff3b30]" />
      )}
    </Link>
  );
}

interface ServiceRailProps {
  horizontal?: boolean;
  onNavigate?: () => void;
}

export function ServiceRail({ horizontal, onNavigate }: ServiceRailProps = {}) {
  const pathname = usePathname();
  const { unreadCount } = useNotificationContext();

  if (horizontal) {
    const allItems = [...mainItems, ...systemItems];
    return (
      <nav className="flex flex-row flex-wrap gap-1 border-b border-border p-3">
        {allItems.map((item) => (
          <HorizontalNavButton
            key={item.href}
            item={item}
            isActive={pathname.startsWith(item.href)}
            showBadge={!!item.badge && unreadCount > 0}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  return (
    <aside
      className="relative z-10 flex h-full w-[52px] flex-col items-center py-3"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }}
    >
      <Link href="/dashboard" className="mb-4 flex h-9 w-9 items-center justify-center" aria-label="Home">
        <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg">
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="26" r="3.5" />
            <circle cx="24" cy="18" r="3" />
            <circle cx="16" cy="6" r="2.5" />
            <circle cx="30" cy="8" r="2.5" />
            <line x1="12.5" y1="24" x2="21.5" y2="19.5" />
            <line x1="17.5" y1="8" x2="22" y2="16" />
            <line x1="26.5" y1="16.5" x2="28" y2="10" />
          </g>
        </svg>
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {mainItems.map((item) => (
          <RailButton
            key={item.href}
            item={item}
            isActive={pathname.startsWith(item.href)}
            showBadge={!!item.badge && unreadCount > 0}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="my-2 h-px w-6 bg-white/10" />

      <div className="flex flex-col items-center gap-1">
        {systemItems.map((item) => (
          <RailButton
            key={item.href}
            item={item}
            isActive={pathname.startsWith(item.href)}
            showBadge={false}
          />
        ))}
      </div>

      <div className="mt-3">
        <UserMenu />
      </div>
    </aside>
  );
}
