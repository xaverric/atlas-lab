import { NotificationPreference } from '../models/NotificationPreference.js';

export const findByUserId = (userId: string) =>
  NotificationPreference.findOne({ userId });

export const upsert = (userId: string, data: Record<string, unknown>) =>
  NotificationPreference.findOneAndUpdate(
    { userId },
    { userId, ...data },
    { new: true, upsert: true },
  );
