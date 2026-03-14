import { Execution } from '../models/Execution.js';

export const create = (data: Record<string, unknown>) => Execution.create(data);

export const findById = (id: string) => Execution.findById(id);

export const list = async (jobId: string, page: number, limit: number) => {
  const filter = { jobId };
  const [data, total] = await Promise.all([
    Execution.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Execution.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};

export const updateById = (id: string, data: Record<string, unknown>) =>
  Execution.findByIdAndUpdate(id, data, { new: true });
