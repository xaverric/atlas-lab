import { TrackerEndpoint } from '../models/TrackerEndpoint.js';

export const create = (data: Record<string, unknown>) =>
  TrackerEndpoint.create(data);

export const findByUserIdAndName = (userId: string, name: string) =>
  TrackerEndpoint.findOne({ userId, name });

export const findByName = (name: string) =>
  TrackerEndpoint.findOne({ name });

export const findPublicByName = (name: string) =>
  TrackerEndpoint.findOne({ name, visibility: 'public' });

export const findAllByUserId = (userId: string) =>
  TrackerEndpoint.find({ userId }).sort({ createdAt: -1 });

export const updateByUserIdAndName = (userId: string, name: string, data: Record<string, unknown>) =>
  TrackerEndpoint.findOneAndUpdate({ userId, name }, data, { new: true });

export const deleteByUserIdAndName = (userId: string, name: string) =>
  TrackerEndpoint.findOneAndDelete({ userId, name });
