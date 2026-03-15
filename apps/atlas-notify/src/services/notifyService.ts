import { Queue } from 'bullmq';
import { config } from '../config/index.js';
import * as notificationDao from '../daos/notificationDao.js';
import * as channelDao from '../daos/channelDao.js';
import * as preferenceDao from '../daos/preferenceDao.js';
import { resolve } from './templateResolver.js';
import * as sseManager from './sseManager.js';

const connection = { host: config.redis.host, port: config.redis.port };
const queue = new Queue('atlas-notify', { connection });

export const send = async (userId: string, templateKey: string, variables: Record<string, string> = {}) => {
  const { title, body } = await resolve(templateKey, templateKey, variables);

  const channels = await channelDao.findByUser(userId);
  const deliveries = channels
    .filter((ch) => ch.enabled && ch.verified)
    .map((ch) => ({
      channelType: ch.type as string,
      channelId: ch._id,
      status: ch.type === 'in_app' ? 'sent' : 'pending',
      sentAt: ch.type === 'in_app' ? new Date() : undefined,
    }));

  if (deliveries.length === 0) {
    deliveries.push({ channelType: 'in_app', channelId: undefined as unknown as typeof channels[0]['_id'], status: 'sent', sentAt: new Date() });
  }

  const notification = await notificationDao.create({
    userId,
    event: templateKey,
    title,
    subject: title,
    body,
    read: false,
    deliveries,
  });

  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    if (d.channelType === 'in_app') continue;

    const ch = channels.find((c) => c._id.toString() === d.channelId?.toString());
    if (!ch) continue;

    await queue.add('deliver', {
      notificationId: notification.id,
      deliveryIndex: i,
      channelType: d.channelType,
      channelConfig: ch.config,
    });
  }

  sseManager.pushToUser(userId, 'notification', notification.toJSON());
  const unread = await notificationDao.countUnread(userId);
  sseManager.pushToUser(userId, 'unread-count', { count: unread });

  await notificationDao.prune(userId);
};

export const history = (userId: string, page: number, limit: number, isAdmin = false) =>
  notificationDao.list(userId, page, limit, undefined, isAdmin);

export const markRead = (id: string, userId: string) =>
  notificationDao.markRead(id, userId);

export const markAllRead = (userId: string) =>
  notificationDao.markAllRead(userId);

export const unreadCount = (userId: string) =>
  notificationDao.countUnread(userId);

export const ensureUserSetup = async (userId: string) => {
  const channels = await channelDao.findByUser(userId);

  let inAppChannel = channels.find((ch) => ch.type === 'in_app');
  if (!inAppChannel) {
    inAppChannel = await channelDao.create({
      userId,
      type: 'in_app',
      label: 'In-App Notifications',
      config: {},
      verified: true,
      enabled: true,
    });
  }

  const rules = await preferenceDao.findRulesForUser(userId);
  if (rules.length === 0) {
    await preferenceDao.createRule({
      userId,
      eventPattern: '*',
      channelIds: [inAppChannel._id],
      enabled: true,
    });
  }

  return inAppChannel;
};

export const createDirect = async (
  userId: string,
  opts: { title: string; body: string; event: string; priority?: string; url?: string },
) => {
  await ensureUserSetup(userId);

  const rules = await preferenceDao.findMatchingRules(userId, opts.event);
  if (rules.length === 0) return null;

  const channelMap = new Map<string, any>();
  for (const rule of rules) {
    for (const ch of rule.channelIds as any[]) {
      if (ch.enabled && ch.verified && !channelMap.has(ch._id.toString())) {
        channelMap.set(ch._id.toString(), ch);
      }
    }
  }

  if (channelMap.size === 0) return null;

  const channelList = Array.from(channelMap.values());
  const deliveries = channelList.map((ch: any) => ({
    channelType: ch.type as string,
    channelId: ch._id,
    status: ch.type === 'in_app' ? 'sent' : 'pending',
    sentAt: ch.type === 'in_app' ? new Date() : undefined,
  }));

  const notification = await notificationDao.create({
    userId,
    event: opts.event,
    title: opts.title,
    subject: opts.title,
    body: opts.body,
    read: false,
    priority: opts.priority || 'normal',
    data: opts.url ? { url: opts.url } : undefined,
    deliveries,
  });

  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    if (d.channelType === 'in_app') continue;

    await queue.add('deliver', {
      notificationId: notification.id,
      deliveryIndex: i,
      channelType: d.channelType,
      channelConfig: channelList[i].config,
    });
  }

  sseManager.pushToUser(userId, 'notification', notification.toJSON());
  const unread = await notificationDao.countUnread(userId);
  sseManager.pushToUser(userId, 'unread-count', { count: unread });

  await notificationDao.prune(userId);
  return notification;
};
