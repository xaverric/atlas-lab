import Redis from 'ioredis';
import { matchPattern } from './match.js';
import type { EventBus, EventBusConfig, EventEnvelope, EventHandler } from './types.js';

const CHANNEL = 'atlas:events';

interface Subscription {
  pattern: string;
  handler: EventHandler;
}

export const createEventBus = (config: EventBusConfig): EventBus => {
  const connectionOpts = { host: config.host, port: config.port, password: config.password, lazyConnect: true, maxRetriesPerRequest: null };

  const pub = new Redis({ ...connectionOpts, enableReadyCheck: false });
  const sub = new Redis({ ...connectionOpts, enableReadyCheck: false });

  let connected = false;
  const subscriptions: Subscription[] = [];

  const connect = async () => {
    try {
      await Promise.all([pub.connect(), sub.connect()]);
      connected = true;

      await sub.subscribe(CHANNEL);
      sub.on('message', (_ch: string, raw: string) => {
        try {
          const envelope = JSON.parse(raw) as EventEnvelope;
          for (const s of subscriptions) {
            if (matchPattern(s.pattern, envelope.event)) {
              Promise.resolve(s.handler(envelope)).catch((err) => {
                console.error('[event-bus] Handler error for ' + s.pattern + ':', err);
              });
            }
          }
        } catch (err) {
          console.error('[event-bus] Failed to parse event:', err);
        }
      });
    } catch (err) {
      console.error('[event-bus] Connection failed:', err);
      connected = false;
    }
  };

  pub.on('error', (err) => { console.error('[event-bus] Publisher error:', err); connected = false; });
  sub.on('error', (err) => { console.error('[event-bus] Subscriber error:', err); connected = false; });
  pub.on('ready', () => { connected = true; });

  connect();

  return {
    async publish(event, payload, source) {
      if (!connected) return;
      const envelope: EventEnvelope = {
        event,
        payload,
        source,
        timestamp: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
      };
      try {
        await pub.publish(CHANNEL, JSON.stringify(envelope));
      } catch (err) {
        console.error('[event-bus] Publish failed:', err);
      }
    },

    subscribe(pattern, handler) {
      subscriptions.push({ pattern, handler });
    },

    async close() {
      connected = false;
      await sub.unsubscribe(CHANNEL).catch(() => {});
      await Promise.all([pub.quit().catch(() => {}), sub.quit().catch(() => {})]);
    },

    isConnected: () => connected,
  };
};
