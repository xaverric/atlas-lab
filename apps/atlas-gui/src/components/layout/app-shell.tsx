'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ServiceRail } from './service-rail';
import { ActivePanel } from './panels';
import { NotificationProvider } from '@/contexts/notification-context';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ShortcutsHelp } from '@/components/shared/shortcuts-help';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useKeyboardShortcuts();

  return (
    <NotificationProvider>
      <ShortcutsHelp />
      <div className="flex h-dvh overflow-hidden">
        {/* Desktop: always visible */}
        <div className="hidden md:contents">
          <ServiceRail />
          <ActivePanel />
        </div>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <div className={`
          fixed inset-y-0 left-0 z-50 flex w-72 transform transition-transform duration-200 ease-out md:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex h-full w-full flex-col border-r bg-sidebar-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ServiceRail horizontal onNavigate={() => setMobileOpen(false)} />
            <div className="flex-1 overflow-hidden [&>aside]:w-full">
              <ActivePanel />
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-3 border-b px-4 py-2.5 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 hover:bg-muted"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}
