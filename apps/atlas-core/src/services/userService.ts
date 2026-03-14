import { ApiError } from '@atlas/core';
import * as userDao from '../daos/userDao.js';
import type { AuthPayload } from '../middleware/auth.js';

export const findOrCreateFromToken = async (auth: AuthPayload) => {
  const existing = await userDao.findByKeycloakId(auth.sub);
  if (existing) return existing;

  return userDao.create({
    keycloakId: auth.sub,
    email: auth.email || '',
    name: auth.name || auth.preferred_username || '',
  });
};

export const updatePreferences = async (keycloakId: string, preferences: Record<string, unknown>) => {
  const user = await userDao.findByKeycloakId(keycloakId);
  if (!user) throw new ApiError(404, 'User not found');

  return userDao.updateById(user.id, { preferences });
};
