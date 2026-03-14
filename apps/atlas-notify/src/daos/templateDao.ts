import { NotificationTemplate } from '../models/NotificationTemplate.js';

export const findByKey = (key: string) => NotificationTemplate.findOne({ key });

export const list = () => NotificationTemplate.find().sort({ key: 1 });

export const create = (data: Record<string, unknown>) => NotificationTemplate.create(data);

export const updateById = (id: string, data: Record<string, unknown>) =>
  NotificationTemplate.findByIdAndUpdate(id, data, { new: true });

export const deleteById = (id: string) => NotificationTemplate.findByIdAndDelete(id);
