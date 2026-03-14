import { JobRun } from '../models/JobRun.js';

export const create = (data: Record<string, unknown>) => JobRun.create(data);

export const findById = (id: string) => JobRun.findById(id);

export const listByJobId = async (jobId: string, page: number, limit: number) => {
  const filter = { jobId };
  const [data, total] = await Promise.all([
    JobRun.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    JobRun.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};

export const updateById = (id: string, data: Record<string, unknown>) =>
  JobRun.findByIdAndUpdate(id, data, { new: true });

export const appendLog = (id: string, logEntry: { level: string; message: string; meta?: unknown }) =>
  JobRun.findByIdAndUpdate(id, {
    $push: { logs: { ...logEntry, timestamp: new Date() } },
  });

export const getLastRun = (jobId: string) =>
  JobRun.findOne({ jobId }).sort({ createdAt: -1 });

export const pruneOldRuns = async (jobId: string, keepLast: number) => {
  const runs = await JobRun.find({ jobId })
    .sort({ createdAt: -1 })
    .skip(keepLast)
    .select('_id');

  if (runs.length > 0) {
    await JobRun.deleteMany({ _id: { $in: runs.map((r) => r._id) } });
  }

  return runs.length;
};
