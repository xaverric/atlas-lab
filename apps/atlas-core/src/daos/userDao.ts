import { User } from '../models/User.js';

export const findByKeycloakId = (keycloakId: string) =>
  User.findOne({ keycloakId });

export const create = (data: { keycloakId: string; email: string; name: string }) =>
  User.create(data);

export const updateById = (id: string, data: Record<string, unknown>) =>
  User.findByIdAndUpdate(id, data, { new: true });
