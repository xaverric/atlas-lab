export const createPublishNotification = (notifyUrl: string, internalKey: string) =>
  async (userId: string, title: string, body: string, event: string, url?: string) => {
    try {
      await fetch(`${notifyUrl}/api/v1/notifications/send-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': internalKey,
        },
        body: JSON.stringify({ userId, title, body, event, priority: 'normal', url }),
      });
    } catch { /* fire and forget */ }
  };
