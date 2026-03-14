'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useNotifications } from '@/hooks/use-notifications';

interface NotificationContextValue {
  unreadCount: number;
  recent: Array<{
    id: string;
    event?: string;
    title?: string;
    subject?: string;
    body?: string;
    read: boolean;
    createdAt: string;
  }>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  recent: [],
  markRead: async () => {},
  markAllRead: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications();
  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotificationContext = () => useContext(NotificationContext);
