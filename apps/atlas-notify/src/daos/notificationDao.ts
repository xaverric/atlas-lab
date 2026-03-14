import { Notification } from '../models/Notification.js';

export const create = (data: Record<string, unknown>) => Notification.create(data);

export const updateById = (id: string, data: Record<string, unknown>) =>
  Notification.findByIdAndUpdate(id, data, { new: true });

export const list = async (userId: string, page: number, limit: number) => {
  const [data, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments({ userId }),
  ]);
  return { data, total, page, limit };
};
