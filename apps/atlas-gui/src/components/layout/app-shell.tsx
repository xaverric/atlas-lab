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
