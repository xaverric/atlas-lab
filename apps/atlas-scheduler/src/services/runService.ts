import { ApiError } from '@atlas/core';
import * as jobRunDao from '../daos/jobRunDao.js';
import * as jobDao from '../daos/jobDao.js';

export const listByJobId = (jobId: string, page: number, limit: number) =>
  jobRunDao.listByJobId(jobId, page, limit);

export const getById = async (id: string, ownerId?: string, isAdmin = false) => {
  const run = await jobRunDao.findById(id);
  if (!run) throw new ApiError(404, 'Run not found');

  if (ownerId && !isAdmin) {
    const job = await jobDao.findById(run.jobId.toString(), ownerId, false);
    if (!job) throw new ApiError(403, 'Access denied');
  }

  return run;
};
