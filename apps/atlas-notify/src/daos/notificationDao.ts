import { Notification } from '../models/Notification.js';

export const create = (data: Record<string, unknown>) => Notification.create(data);

export const updateById = (id: string, data: Record<string, unknown>) =>
  Notification.findByIdAndUpdate(id, data, { new: true });

export const findById = (id: string) => Notification.findById(id);

export const list = async (userId: string, page: number, limit: number, filter?: { read?: boolean }, isAdmin = false) => {
  const query: Record<string, unknown> = {};
  if (!isAdmin) query.userId = userId;
  if (filter?.read !== undefined) query.read = filter.read;

  const [data, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(query),
  ]);
  return { data, total, page, limit };
};

export const markRead = (id: string, userId: string) =>
  Notification.findOneAndUpdate(
    { _id: id, userId },
    { read: true, readAt: new Date() },
    { new: true },
  );

export const markAllRead = (userId: string) =>
  Notification.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() },
  );

export const countUnread = (userId: string) =>
  Notification.countDocuments({ userId, read: false });

export const prune = async (userId: string, max: number = 1000) => {
  const count = await Notification.countDocuments({ userId });
  if (count <= max) return;

  const cutoff = await Notification.findOne({ userId })
    .sort({ createdAt: -1 })
    .skip(max - 1)
    .select('createdAt');

  if (cutoff?.createdAt) {
    await Notification.deleteMany({ userId, createdAt: { $lt: cutoff.createdAt } });
  }
};

export const updateDeliveryStatus = async (
  notificationId: string,
  deliveryIndex: number,
  status: string,
  error?: string,
) => {
  const update: Record<string, unknown> = {
    [`deliveries.${deliveryIndex}.status`]: status,
  };
  if (status === 'sent') update[`deliveries.${deliveryIndex}.sentAt`] = new Date();
  if (error) update[`deliveries.${deliveryIndex}.error`] = error;

  return Notification.findByIdAndUpdate(notificationId, { $set: update }, { new: true });
};
