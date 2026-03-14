import { api } from './api';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const isSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

export const getPermission = () =>
  typeof Notification !== 'undefined' ? Notification.permission : 'denied';

export const requestPushPermission = async () => {
  if (!isSupported()) return 'denied';
  return Notification.requestPermission();
};

export const subscribeToPush = async (vapidPublicKey: string) => {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return subscription;
};

export const sendSubscriptionToServer = async (subscription: PushSubscription) => {
  await api('/api/v1/notifications/push-subscription', {
    method: 'POST',
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
};
