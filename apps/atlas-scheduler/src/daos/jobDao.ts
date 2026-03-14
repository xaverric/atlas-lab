import { Job } from '../models/Job.js';

interface ListFilters {
  ownerId: string;
  isAdmin?: boolean;
  executionType?: string;
  enabled?: boolean;
  group?: string;
  tags?: string[];
  search?: string;
  page: number;
  limit: number;
}

export const create = (data: Record<string, unknown>) => Job.create(data);

export const findById = (id: string, ownerId?: string, isAdmin = false) => {
  if (!isAdmin && ownerId) return Job.findOne({ _id: id, ownerId });
  return Job.findById(id);
};

export const list = async (filters: ListFilters) => {
  const query: Record<string, unknown> = {};
  if (!filters.isAdmin) query.ownerId = filters.ownerId;

  if (filters.executionType) query.executionType = filters.executionType;
  if (filters.enabled !== undefined) query.enabled = filters.enabled;
  if (filters.group !== undefined) query.group = filters.group;
  if (filters.tags?.length) query.tags = { $all: filters.tags };
  if (filters.search) query.name = { $regex: filters.search, $options: 'i' };

  const [data, total] = await Promise.all([
    Job.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit),
    Job.countDocuments(query),
  ]);

  return { data, total, page: filters.page, limit: filters.limit };
};

export const updateById = (id: string, data: Record<string, unknown>) =>
  Job.findByIdAndUpdate(id, data, { new: true });

export const deleteById = (id: string) => Job.findByIdAndDelete(id);

export const findEnabled = () => Job.find({ enabled: true });

export const updateLastRun = (id: string, status: string) =>
  Job.findByIdAndUpdate(id, { lastRunAt: new Date(), lastRunStatus: status }, { new: true });

export const updateNextRun = (id: string, nextRunAt: Date | null) =>
  Job.findByIdAndUpdate(id, { nextRunAt }, { new: true });

export const addNotification = (jobId: string, notification: Record<string, unknown>) =>
  Job.findByIdAndUpdate(jobId, { $push: { notifications: notification } }, { new: true });

export const removeNotification = (jobId: string, notificationId: string) =>
  Job.findByIdAndUpdate(jobId, { $pull: { notifications: { _id: notificationId } } }, { new: true });
