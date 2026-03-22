'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getUserManager } from '@/lib/auth';
import { api } from '@/lib/api';

const NOTIFY_URL = process.env.NEXT_PUBLIC_NOTIFY_URL || 'http://localhost:4003';

interface Notification {
  id: string;
  event?: string;
  title?: string;
  subject?: string;
  body?: string;
  read: boolean;
  createdAt: string;
  priority?: string;
  data?: { url?: string; [key: string]: unknown };
}

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<Notification[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);

  const connect = useCallback(async () => {
    try {
      const um = getUserManager();
      const user = await um.getUser();
      if (!user?.access_token || !mountedRef.current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const url = `${NOTIFY_URL}/api/v1/notifications/stream`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${user.access_token}` },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          try {
            await um.signinSilent();
            scheduleReconnect();
          } catch { /* session expired */ }
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      reconnectDelay.current = 1000;

      const read = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done || !mountedRef.current) {
          if (mountedRef.current) scheduleReconnect();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              if (currentEvent === 'unread-count') {
                setUnreadCount(parsed.count);
              } else if (currentEvent === 'notification') {
                setRecent((prev) => [parsed, ...prev].slice(0, 10));
                setUnreadCount((c) => c + 1);
              }
            } catch {}
            currentEvent = '';
            currentData = '';
          }
        }

        return read();
      };

      read().catch(() => {
        if (mountedRef.current) scheduleReconnect();
      });
    } catch {
      if (mountedRef.current) scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    reconnectTimer.current = setTimeout(() => {
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      connect();
    }, reconnectDelay.current);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      setRecent((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api('/api/v1/notifications/mark-all-read', { method: 'POST' });
      setRecent((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  return { unreadCount, recent, markRead, markAllRead };
}
