'use client';

import { type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SectionPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="flex h-full w-[220px] flex-col overflow-hidden border-r bg-sidebar-background">
      {children}
    </aside>
  );
}

interface PanelHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PanelHeader({ title, children }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b px-3.5 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children && <div className="flex items-center gap-1">{children}</div>}
    </div>
  );
}

interface PanelSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function PanelSearch({ placeholder = 'Search...', value, onChange }: PanelSearchProps) {
  return (
    <div className="mx-3 mt-2.5 mb-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 focus-within:border-ring">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

export function PanelScroll({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto pb-2">
      {children}
    </div>
  );
}

export function PanelGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      {children}
    </div>
  );
}

type BadgeColor = 'green' | 'red' | 'blue' | 'yellow' | 'info' | 'muted';

const badgeColorMap: Record<BadgeColor, string> = {
  green: 'bg-success/10 text-success',
  red: 'bg-destructive/10 text-destructive',
  blue: 'bg-primary/10 text-primary',
  yellow: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted text-muted-foreground',
};

interface PanelItemProps {
  active?: boolean;
  icon?: ReactNode;
  label: string;
  count?: number | string;
  badge?: { text: string; color: BadgeColor };
  onClick?: () => void;
}

export function PanelItem({ active, icon, label, count, badge, onClick }: PanelItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mx-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-primary/8 font-medium text-primary'
          : 'text-foreground/80 hover:bg-accent hover:text-foreground',
      )}
    >
      {icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="truncate">{label}</span>
      {count != null && (
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{count}</span>
      )}
      {badge && (
        <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', badgeColorMap[badge.color])}>
          {badge.text}
        </span>
      )}
    </button>
  );
}

interface PanelActionProps {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
  title?: string;
}

export function PanelAction({ children, primary, onClick, title }: PanelActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors [&>svg]:h-4 [&>svg]:w-4',
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
