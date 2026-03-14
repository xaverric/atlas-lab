import { ApiError } from '@atlas/core';
import * as templateDao from '../daos/templateDao.js';

export const list = () => templateDao.list();

export const create = (data: Record<string, unknown>) => templateDao.create(data);

export const update = async (id: string, data: Record<string, unknown>) => {
  const updated = await templateDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Template not found');
  return updated;
};

export const remove = async (id: string) => {
  const deleted = await templateDao.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Template not found');
};
