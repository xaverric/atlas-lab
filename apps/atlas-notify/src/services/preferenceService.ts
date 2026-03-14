import { ApiError } from '@atlas/core';
import * as preferenceDao from '../daos/preferenceDao.js';

export const listRules = (userId: string, isAdmin = false) =>
  preferenceDao.findRulesForUser(userId, isAdmin);

export const createRule = (userId: string, data: { eventPattern: string; channelIds: string[]; enabled?: boolean }) =>
  preferenceDao.createRule({
    userId,
    eventPattern: data.eventPattern,
    channelIds: data.channelIds,
    enabled: data.enabled ?? true,
  });

export const updateRule = async (id: string, userId: string, data: Record<string, unknown>) => {
  const existing = await preferenceDao.findRulesForUser(userId);
  if (!existing.some((r) => r.id === id)) throw new ApiError(404, 'Rule not found');
  return preferenceDao.updateRule(id, data);
};

export const deleteRule = async (id: string, userId: string) => {
  const deleted = await preferenceDao.deleteRule(id, userId);
  if (!deleted) throw new ApiError(404, 'Rule not found');
};
