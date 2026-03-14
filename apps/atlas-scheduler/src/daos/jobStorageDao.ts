import { JobStorage } from '../models/JobStorage.js';

export const get = async (jobId: string, key: string) => {
  const doc = await JobStorage.findOne({ jobId, key });
  return doc?.value;
};

export const set = (jobId: string, key: string, value: unknown) =>
  JobStorage.findOneAndUpdate(
    { jobId, key },
    { jobId, key, value },
    { upsert: true, new: true },
  );

export const remove = (jobId: string, key: string) =>
  JobStorage.findOneAndDelete({ jobId, key });

export const listByJobId = (jobId: string) =>
  JobStorage.find({ jobId });
