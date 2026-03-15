import { config } from '../config/index.js';

export const publishNotification = async (
  userId: string,
  title: string,
  body: string,
  event: string,
  url?: string,
) => {
  try {
    await fetch(`${config.notifyUrl}/api/v1/notifications/send-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': config.internalKey,
      },
      body: JSON.stringify({ userId, title, body, event, priority: 'normal', url }),
    });
  } catch { /* fire and forget */ }
};
