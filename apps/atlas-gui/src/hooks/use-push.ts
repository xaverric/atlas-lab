'use client';

import { useState, useEffect, useCallback } from 'react';
import { isSupported, getPermission, requestPushPermission, subscribeToPush, sendSubscriptionToServer } from '@/lib/push';

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function usePush() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setSupported(isSupported());
    setPermission(getPermission());
  }, []);

  const enablePush = useCallback(async () => {
    if (!VAPID_KEY) return;

    const perm = await requestPushPermission();
    setPermission(perm);
    if (perm !== 'granted') return;

    try {
      const subscription = await subscribeToPush(VAPID_KEY);
      await sendSubscriptionToServer(subscription);
      setEnabled(true);
    } catch {}
  }, []);

  const disablePush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setEnabled(false);
    } catch {}
  }, []);

  return { isSupported: supported, isEnabled: enabled, permission, enablePush, disablePush };
}
