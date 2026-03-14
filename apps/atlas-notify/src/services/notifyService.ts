import { Queue } from 'bullmq';
import { config } from '../config/index.js';
import * as preferenceDao from '../daos/preferenceDao.js';
import * as templateDao from '../daos/templateDao.js';
import * as notificationDao from '../daos/notificationDao.js';

const connection = { host: config.redis.host, port: config.redis.port };
const queue = new Queue('atlas-notify', { connection });

const interpolate = (template: string, vars: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');

export const send = async (userId: string, templateKey: string, variables: Record<string, string> = {}) => {
  const template = await templateDao.findByKey(templateKey);
  if (!template) throw new Error(`Template "${templateKey}" not found`);

  const prefs = await preferenceDao.findByUserId(userId);
  const channels = prefs?.channels || {};

  const subject = interpolate(template.subject, variables);
  const body = interpolate(template.body, variables);

  const tasks: Promise<unknown>[] = [];

  if ((channels as any).email?.enabled && (channels as any).email?.address) {
    const notification = await notificationDao.create({
      userId,
      templateKey,
      channel: 'email',
      subject,
      body,
    });
    tasks.push(queue.add('deliver', {
      notificationId: notification.id,
      channel: 'email',
      to: (channels as any).email.address,
      subject,
      body,
    }));
  }

  if ((channels as any).telegram?.enabled && (channels as any).telegram?.chatId) {
    const notification = await notificationDao.create({
      userId,
      templateKey,
      channel: 'telegram',
      subject,
      body,
    });
    tasks.push(queue.add('deliver', {
      notificationId: notification.id,
      channel: 'telegram',
      to: (channels as any).telegram.chatId,
      subject,
      body,
    }));
  }

  await Promise.all(tasks);
};

export const history = (userId: string, page: number, limit: number) =>
  notificationDao.list(userId, page, limit);
