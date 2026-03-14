import { ApiError } from '@atlas/core';
import * as channelDao from '../daos/channelDao.js';
import { config } from '../config/index.js';

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

export const create = async (userId: string, data: { type: string; label?: string; config?: Record<string, unknown> }) => {
  const channel = await channelDao.create({
    userId,
    type: data.type,
    label: data.label || data.type,
    config: data.config || {},
    verified: data.type === 'in_app' || data.type === 'web_push',
    enabled: true,
  });
  return channel;
};

export const list = (userId: string) => channelDao.findByUser(userId);

export const verify = async (channelId: string, userId: string, code: string) => {
  const channel = await channelDao.findById(channelId);
  if (!channel || channel.userId !== userId) throw new ApiError(404, 'Channel not found');
  if (channel.verified) throw new ApiError(400, 'Already verified');
  if (channel.verificationCode !== code) throw new ApiError(400, 'Invalid code');
  if (channel.verificationExpiresAt && channel.verificationExpiresAt < new Date()) {
    throw new ApiError(400, 'Code expired');
  }

  return channelDao.updateById(channelId, {
    verified: true,
    verificationCode: undefined,
    verificationExpiresAt: undefined,
  });
};

export const sendVerification = async (channelId: string, userId: string) => {
  const channel = await channelDao.findById(channelId);
  if (!channel || channel.userId !== userId) throw new ApiError(404, 'Channel not found');

  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await channelDao.updateById(channelId, {
    verificationCode: code,
    verificationExpiresAt: expires,
  });

  return { code, expires };
};

export const enable = (channelId: string, userId: string, enabled: boolean) =>
  channelDao.findById(channelId).then((ch) => {
    if (!ch || ch.userId !== userId) throw new ApiError(404, 'Channel not found');
    return channelDao.updateById(channelId, { enabled });
  });

export const remove = async (channelId: string, userId: string) => {
  const ch = await channelDao.findById(channelId);
  if (!ch || ch.userId !== userId) throw new ApiError(404, 'Channel not found');
  return channelDao.deleteById(channelId);
};

export const initiateTelegramVerification = async (channelId: string, userId: string) => {
  const channel = await channelDao.findById(channelId);
  if (!channel || channel.userId !== userId) throw new ApiError(404, 'Channel not found');
  if (channel.type !== 'telegram') throw new ApiError(400, 'Not a telegram channel');

  const { code, expires } = await sendVerification(channelId, userId);
  const botUsername = config.telegram.botUsername || 'AtlasNotifyBot';
  const deepLink = `https://t.me/${botUsername}?start=${code}`;

  return { deepLink, expiresAt: expires };
};

export const removePushSubscription = async (userId: string, endpoint: string) => {
  await channelDao.deleteByQuery({
    userId,
    type: 'web_push',
    'config.subscription.endpoint': endpoint,
  });
};

export const update = async (channelId: string, userId: string, data: Record<string, unknown>) => {
  const ch = await channelDao.findById(channelId);
  if (!ch || ch.userId !== userId) throw new ApiError(404, 'Channel not found');
  const allowed: Record<string, unknown> = {};
  if (data.label !== undefined) allowed.label = data.label;
  if (data.config !== undefined) allowed.config = data.config;
  if (data.enabled !== undefined) allowed.enabled = data.enabled;
  return channelDao.updateById(channelId, allowed);
};
