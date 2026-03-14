import { ApiError } from '@atlas/core';
import * as jobDao from '../daos/jobDao.js';
import { scheduleJob, removeJob } from '../workers/scheduler.js';

export const create = async (data: Record<string, unknown>) => {
  const job = await jobDao.create(data);
  if (job.enabled) await scheduleJob(job.toObject());
  return job;
};

export const list = (ownerId: string, page: number, limit: number) =>
  jobDao.list(ownerId, page, limit);

export const getById = async (id: string, ownerId: string) => {
  const job = await jobDao.findById(id);
  if (!job) throw new ApiError(404, 'Job not found');
  if (job.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  return job;
};

export const update = async (id: string, ownerId: string, data: Record<string, unknown>) => {
  await getById(id, ownerId);
  const updated = await jobDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Job not found');

  await removeJob(id);
  if (updated.enabled) await scheduleJob(updated.toObject());

  return updated;
};

export const remove = async (id: string, ownerId: string) => {
  await getById(id, ownerId);
  await removeJob(id);
  await jobDao.deleteById(id);
};

export const toggle = async (id: string, ownerId: string) => {
  const job = await getById(id, ownerId);
  const updated = await jobDao.updateById(id, { enabled: !job.enabled });
  if (!updated) throw new ApiError(404, 'Job not found');

  if (updated.enabled) {
    await scheduleJob(updated.toObject());
  } else {
    await removeJob(id);
  }

  return updated;
};
