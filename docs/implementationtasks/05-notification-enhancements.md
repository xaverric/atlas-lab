# 05 — Notification Enhancements

## Current State

- Multi-channel notification system with BullMQ delivery worker
- Existing channels: `email` (SMTP), `telegram`, `inapp`, `webpush`
- Channel stubs exist: `signal.ts`, `whatsapp.ts`, `sms.ts` (in `apps/atlas-notify/src/channels/`)
- Channel registry pattern for dynamic channel management
- Models: `Notification`, `NotificationTemplate`, `NotificationPreference`, `NotificationChannel`
- Templates with variable interpolation
- User preferences per channel
- SSE for real-time in-app notifications

## Goals

### 1. SMS Channel

**Requirements:**
- Send SMS notifications via provider API
- Provider options: Twilio (most common), Vonage, or self-hosted (gammu/smstools with USB modem)

**Recommended: Twilio**

`apps/atlas-notify/src/channels/sms.ts`:
```
import twilio from 'twilio';

class SmsChannel implements Channel {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  }

  async send(notification: Notification, recipient: ChannelRecipient): Promise<void> {
    await this.client.messages.create({
      body: notification.body,
      from: config.TWILIO_FROM_NUMBER,
      to: recipient.phone
    });
  }
}
```

**Config additions:**

`apps/atlas-notify/src/config/index.ts`:
```
TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || ''
```

**Package:** `npm install twilio -w @atlas/notify`

**User preferences:** User stores phone number in notification preferences for SMS channel.

### 2. Signal Channel

**Requirements:**
- Send notifications via Signal messenger
- Options: signal-cli REST API (self-hosted), or signal-cli daemon

**Recommended: signal-cli REST API** (Docker container)

**Infrastructure:**

`deployment/docker-compose.yml`:
```yaml
signal-cli:
  image: bbernhard/signal-cli-rest-api:latest
  environment:
    - MODE=native
  volumes:
    - signal_data:/home/.local/share/signal-cli
  ports:
    - "8085:8080"
```

**First-time setup:** Register Signal number via signal-cli (QR code linking or phone number registration). This is a manual one-time step.

`apps/atlas-notify/src/channels/signal.ts`:
```
class SignalChannel implements Channel {
  async send(notification: Notification, recipient: ChannelRecipient): Promise<void> {
    await fetch(`${config.SIGNAL_CLI_URL}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: notification.body,
        number: config.SIGNAL_FROM_NUMBER,
        recipients: [recipient.signalNumber]
      })
    });
  }
}
```

**Config:**
```
SIGNAL_CLI_URL: process.env.SIGNAL_CLI_URL || 'http://signal-cli:8080',
SIGNAL_FROM_NUMBER: process.env.SIGNAL_FROM_NUMBER || ''
```

### 3. WhatsApp Channel

**Requirements:**
- Send notifications via WhatsApp
- Options: WhatsApp Business API (official, paid), or third-party (Baileys — unofficial)

**Recommended: WhatsApp Business API via Twilio** (if already using Twilio for SMS)

`apps/atlas-notify/src/channels/whatsapp.ts`:
```
class WhatsAppChannel implements Channel {
  async send(notification: Notification, recipient: ChannelRecipient): Promise<void> {
    await twilioClient.messages.create({
      body: notification.body,
      from: `whatsapp:${config.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${recipient.phone}`
    });
  }
}
```

**Alternative: Self-hosted with Baileys** (unofficial WhatsApp Web API)
- More complex, risk of being blocked by WhatsApp
- No cost, but less reliable
- Would run as separate service or integrated into notify

**Config:**
```
TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || ''
```

### 4. Push Notifications (Mobile/Browser)

**Current:** `webpush.ts` exists — verify implementation status.

**Requirements:**
- Browser push notifications (Web Push API)
- Mobile push via PWA (same Web Push API)
- VAPID key pair for push subscription
- Service worker in atlas-gui for receiving push events

**Backend:**

`apps/atlas-notify/src/channels/webpush.ts`:
```
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@xaverric.cz',
  config.VAPID_PUBLIC_KEY,
  config.VAPID_PRIVATE_KEY
);

class WebPushChannel implements Channel {
  async send(notification: Notification, recipient: ChannelRecipient): Promise<void> {
    await webpush.sendNotification(
      recipient.pushSubscription,  // PushSubscription object stored in preferences
      JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: '/icon-192.png',
        data: { url: notification.actionUrl }
      })
    );
  }
}
```

**Frontend — Service Worker:**

`apps/atlas-gui/public/sw.js`:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      data: data.data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**Frontend — Subscription:**

`apps/atlas-gui/src/lib/push.ts`:
- Register service worker
- Request notification permission
- Subscribe to push notifications
- Send subscription object to atlas-notify API

`apps/atlas-gui/src/hooks/use-push.ts`:
- Hook for managing push subscription state
- Enable/disable push notifications

**API for push subscription:**
```
POST   /api/v1/notify/push/subscribe     — store push subscription
DELETE /api/v1/notify/push/unsubscribe   — remove push subscription
```

**Config:**
```
VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || ''
```

Generate VAPID keys: `npx web-push generate-vapid-keys`

### Channel Registration Pattern

All new channels follow the existing registry pattern:

`apps/atlas-notify/src/channels/registry.ts`:
```
registry.register('sms', new SmsChannel());
registry.register('signal', new SignalChannel());
registry.register('whatsapp', new WhatsAppChannel());
registry.register('webpush', new WebPushChannel());
```

**User preferences schema update:**

Each user's `NotificationPreference` should support storing channel-specific config:
```
channels: {
  email: { enabled: true, address: 'user@example.com' },
  telegram: { enabled: true, chatId: '123456' },
  sms: { enabled: false, phone: '+420...' },
  signal: { enabled: false, signalNumber: '+420...' },
  whatsapp: { enabled: false, phone: '+420...' },
  webpush: { enabled: false, subscription: { endpoint, keys } }
}
```

### GUI — Notification Preferences

`apps/atlas-gui/src/app/(protected)/notifications/preferences/page.tsx`:
- Per-channel enable/disable toggles
- Channel-specific config fields (phone number, etc.)
- Test notification button per channel
- Push notification permission request button

## Implementation Order

1. **Web Push** — most useful, infrastructure already partly there
2. **SMS via Twilio** — simple API integration
3. **Telegram improvements** — verify existing implementation, add bot setup guide
4. **Signal** — needs signal-cli Docker deployment
5. **WhatsApp** — via Twilio (if SMS already set up) or Baileys

## Dependencies

- SMS + WhatsApp: Twilio account and credentials
- Signal: signal-cli Docker container + registered phone number
- Web Push: VAPID keys + service worker in GUI
- All channels: channel registry must support dynamic enable/disable based on config availability
