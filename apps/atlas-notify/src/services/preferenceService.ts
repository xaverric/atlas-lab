import * as preferenceDao from '../daos/preferenceDao.js';

export const get = (userId: string) => preferenceDao.findByUserId(userId);

export const update = (userId: string, data: Record<string, unknown>) =>
  preferenceDao.upsert(userId, data);
