import { ApiError } from '@atlas/core';
import * as executionDao from '../daos/executionDao.js';

export const list = (jobId: string, page: number, limit: number) =>
  executionDao.list(jobId, page, limit);

export const getById = async (id: string) => {
  const execution = await executionDao.findById(id);
  if (!execution) throw new ApiError(404, 'Execution not found');
  return execution;
};
