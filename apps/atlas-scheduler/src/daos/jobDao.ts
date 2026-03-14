import { Job } from '../models/Job.js';

export const create = (data: Record<string, unknown>) => Job.create(data);

export const findById = (id: string) => Job.findById(id);

export const list = async (ownerId: string, page: number, limit: number) => {
  const [data, total] = await Promise.all([
    Job.find({ ownerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Job.countDocuments({ ownerId }),
  ]);
  return { data, total, page, limit };
};

export const updateById = (id: string, data: Record<string, unknown>) =>
  Job.findByIdAndUpdate(id, data, { new: true });

export const deleteById = (id: string) => Job.findByIdAndDelete(id);

export const findEnabled = () => Job.find({ enabled: true });
