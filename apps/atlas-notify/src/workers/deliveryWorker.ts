import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getDeliverer } from '../channels/registry.js';
import * as notificationDao from '../daos/notificationDao.js';

const connection = { host: config.redis.host, port: config.redis.port, password: config.redis.password };

export const worker = new Worker('atlas-notify', async (job) => {
  const { notificationId, deliveryIndex, channelType, channelConfig } = job.data;

  const deliverer = getDeliverer(channelType);
  if (!deliverer) {
    await notificationDao.updateDeliveryStatus(notificationId, deliveryIndex, 'failed', `No deliverer for ${channelType}`);
    return;
  }

  const notification = await notificationDao.findById(notificationId);
  if (!notification) return;

  const result = await deliverer.deliver(channelConfig, {
    title: notification.title || undefined,
    subject: notification.subject || undefined,
    body: notification.body || undefined,
  });

  if (result.success) {
    await notificationDao.updateDeliveryStatus(notificationId, deliveryIndex, 'sent');
  } else {
    await notificationDao.updateDeliveryStatus(notificationId, deliveryIndex, 'failed', result.error);
    throw new Error(result.error);
  }
}, { connection, concurrency: 3 });
