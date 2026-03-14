import webpush from 'web-push';
import { config } from '../config/index.js';
import type { ChannelDeliverer } from './types.js';

if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );
}

export const webPushDeliverer: ChannelDeliverer = {
  type: 'web_push',
  async deliver(channelConfig, notification) {
    if (!config.vapid.publicKey) {
      return { success: false, error: 'VAPID keys not configured' };
    }

    const subscription = channelConfig.subscription as webpush.PushSubscription | undefined;
    if (!subscription) {
      return { success: false, error: 'No push subscription' };
    }

    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: notification.title || notification.subject || 'Atlas',
        body: notification.body || '',
        url: '/notifications',
      }));
      return { success: true };
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410) {
        return { success: false, error: 'Subscription expired' };
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
