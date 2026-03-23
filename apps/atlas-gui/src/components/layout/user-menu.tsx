'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

const themeOptions = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
] as const;

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
  const displayName = profile?.name || profile?.given_name || 'User';
  const email = profile?.email ?? '';
  const initials = getInitials(profile?.name as string | undefined, email);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-80"
        aria-label="User menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute bottom-0 left-[calc(100%+8px)] w-52 rounded-xl border bg-card shadow-lg z-[200]">
          <div className="border-b px-3 py-2.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>

          <div className="border-b px-3 py-2.5">
            <p className="mb-1.5 text-xs text-muted-foreground">Theme</p>
            <div className="flex gap-1">
              {themeOptions.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                    theme === value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                  aria-label={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 py-2">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
