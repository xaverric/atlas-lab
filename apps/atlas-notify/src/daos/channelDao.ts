import { NotificationChannel } from '../models/NotificationChannel.js';

export const create = (data: Record<string, unknown>) =>
  NotificationChannel.create(data);

export const findById = (id: string) =>
  NotificationChannel.findById(id);

export const findByUser = (userId: string) =>
  NotificationChannel.find({ userId }).sort({ type: 1 });

export const findByUserAndType = (userId: string, type: string) =>
  NotificationChannel.find({ userId, type });

export const updateById = (id: string, data: Record<string, unknown>) =>
  NotificationChannel.findByIdAndUpdate(id, data, { new: true });

export const deleteById = (id: string) =>
  NotificationChannel.findByIdAndDelete(id);

export const deleteByQuery = (query: Record<string, unknown>) =>
  NotificationChannel.deleteOne(query);
