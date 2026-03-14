import { ApiError } from '@atlas/core';
import { CronExpressionParser } from 'cron-parser';
import * as jobDao from '../daos/jobDao.js';
import { scheduleJob, removeJob } from '../workers/scheduler.js';

const computeNextRun = (schedule: { type: string; expression?: string; timezone?: string; runAt?: string | Date }): Date | null => {
  if (schedule.type === 'cron' && schedule.expression) {
    const expr = CronExpressionParser.parse(schedule.expression, { tz: schedule.timezone || 'UTC' });
    return expr.next().toDate();
  }
  if (schedule.type === 'once' && schedule.runAt) {
    return new Date(schedule.runAt);
  }
  return null;
};

export const create = async (data: Record<string, unknown>) => {
  const schedule = data.schedule as { type: string; expression?: string; timezone?: string; runAt?: string };
  const nextRunAt = computeNextRun(schedule);

  const job = await jobDao.create({ ...data, nextRunAt });
  if (job.enabled) await scheduleJob(job.toObject());
  return job;
};

export const list = (ownerId: string, filters: Record<string, unknown>, isAdmin = false) =>
  jobDao.list({
    ownerId,
    isAdmin,
    executionType: filters.executionType as string | undefined,
    enabled: filters.enabled as boolean | undefined,
    group: filters.group as string | undefined,
    tags: filters.tags as string[] | undefined,
    search: filters.search as string | undefined,
    page: (filters.page as number) || 1,
    limit: (filters.limit as number) || 20,
  });

export const getById = async (id: string, ownerId: string, isAdmin = false) => {
  const job = await jobDao.findById(id, ownerId, isAdmin);
  if (!job) throw new ApiError(404, 'Job not found');
  return job;
};

export const update = async (id: string, ownerId: string, data: Record<string, unknown>, isAdmin = false) => {
  await getById(id, ownerId, isAdmin);

  if (data.schedule) {
    const schedule = data.schedule as { type: string; expression?: string; timezone?: string; runAt?: string };
    data.nextRunAt = computeNextRun(schedule);
  }

  const updated = await jobDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Job not found');

  await removeJob(id);
  if (updated.enabled) await scheduleJob(updated.toObject());

  return updated;
};

export const remove = async (id: string, ownerId: string, isAdmin = false) => {
  await getById(id, ownerId, isAdmin);
  await removeJob(id);
  await jobDao.deleteById(id);
};

export const setEnabled = async (id: string, ownerId: string, enabled: boolean, isAdmin = false) => {
  await getById(id, ownerId, isAdmin);
  const updated = await jobDao.updateById(id, { enabled });
  if (!updated) throw new ApiError(404, 'Job not found');

  if (enabled) {
    await scheduleJob(updated.toObject());
  } else {
    await removeJob(id);
  }

  return updated;
};

export const addNotification = async (id: string, ownerId: string, notification: Record<string, unknown>, isAdmin = false) => {
  await getById(id, ownerId, isAdmin);
  const updated = await jobDao.addNotification(id, notification);
  if (!updated) throw new ApiError(404, 'Job not found');
  return updated;
};

export const removeNotification = async (id: string, ownerId: string, notificationId: string, isAdmin = false) => {
  await getById(id, ownerId, isAdmin);
  const updated = await jobDao.removeNotification(id, notificationId);
  if (!updated) throw new ApiError(404, 'Job not found');
  return updated;
};

export { computeNextRun };
