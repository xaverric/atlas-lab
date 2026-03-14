import { Queue } from 'bullmq';
import type { EventBus, EventEnvelope } from '@atlas/event-bus';
import { config } from '../config/index.js';
import * as preferenceDao from '../daos/preferenceDao.js';
import * as notificationDao from '../daos/notificationDao.js';
import { getDeliverer } from '../channels/registry.js';
import { resolve } from './templateResolver.js';
import * as sseManager from './sseManager.js';

const connection = { host: config.redis.host, port: config.redis.port };
const queue = new Queue('atlas-notify', { connection });

const processEvent = async (envelope: EventEnvelope) => {
  const userId = envelope.payload.userId as string | undefined;
  if (!userId) return;

  const rules = await preferenceDao.findMatchingRules(userId, envelope.event);
  if (rules.length === 0) return;

  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(envelope.payload)) {
    if (typeof v === 'string' || typeof v === 'number') variables[k] = String(v);
  }

  const { title, body } = await resolve(envelope.event, undefined, variables);

  const channelSet = new Map<string, { channelId: string; type: string; config: Record<string, unknown> }>();
  for (const rule of rules) {
    const populated = rule.channelIds as unknown as Array<{ _id: { toString(): string }; type: string; config: Record<string, unknown>; enabled: boolean; verified: boolean }>;
    for (const ch of populated) {
      if (ch.enabled && ch.verified && !channelSet.has(ch._id.toString())) {
        channelSet.set(ch._id.toString(), { channelId: ch._id.toString(), type: ch.type, config: ch.config as Record<string, unknown> });
      }
    }
  }

  const deliveries = Array.from(channelSet.values()).map((ch) => ({
    channelType: ch.type,
    channelId: ch.channelId,
    status: ch.type === 'in_app' ? 'sent' : 'pending',
    sentAt: ch.type === 'in_app' ? new Date() : undefined,
  }));

  const notification = await notificationDao.create({
    userId,
    event: envelope.event,
    title,
    subject: title,
    body,
    read: false,
    priority: (envelope.payload.priority as string) || 'normal',
    data: envelope.payload,
    deliveries,
  });

  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    if (d.channelType === 'in_app') continue;

    const ch = channelSet.get(d.channelId!);
    if (!ch) continue;

    await queue.add('deliver', {
      notificationId: notification.id,
      deliveryIndex: i,
      channelType: d.channelType,
      channelConfig: ch.config,
    });
  }

  // push SSE
  sseManager.pushToUser(userId, 'notification', notification.toJSON());
  const unread = await notificationDao.countUnread(userId);
  sseManager.pushToUser(userId, 'unread-count', { count: unread });

  await notificationDao.prune(userId);
};

export const start = (eventBus: EventBus) => {
  eventBus.subscribe('*', async (envelope) => {
    try {
      await processEvent(envelope);
    } catch {}
  });
};
