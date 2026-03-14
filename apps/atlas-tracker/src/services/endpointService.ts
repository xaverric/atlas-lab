import { ApiError } from '@atlas/core';
import * as endpointDao from '../daos/endpointDao.js';
import * as dynamicDao from '../daos/dynamicDao.js';
import * as schemaValidator from './schemaValidator.js';

const getCollectionName = (userId: string, endpointName: string) =>
  `tracker_${userId}_${endpointName}`;

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export const create = async (userId: string, data: {
  name: string;
  displayName: string;
  description?: string;
  visibility?: string;
  schema: object;
  indexes?: Array<{ fields: Record<string, unknown>; options?: Record<string, unknown> }>;
  retentionDays?: number;
}) => {
  if (!SLUG_RE.test(data.name)) {
    throw new ApiError(400, 'Name must be a URL-friendly slug (lowercase alphanumeric and hyphens)');
  }

  const existing = await endpointDao.findByUserIdAndName(userId, data.name);
  if (existing) throw new ApiError(409, 'Endpoint with this name already exists');

  const endpoint = await endpointDao.create({ ...data, userId });

  const collName = getCollectionName(userId, data.name);
  await dynamicDao.createCollection(collName, data.indexes || []);

  const validatorKey = `${userId}:${data.name}`;
  schemaValidator.compile(validatorKey, data.schema);

  return endpoint;
};

export const list = (userId: string) =>
  endpointDao.findAllByUserId(userId);

export const getByName = async (userId: string, name: string) => {
  const endpoint = await endpointDao.findByUserIdAndName(userId, name);
  if (!endpoint) throw new ApiError(404, 'Endpoint not found');
  return endpoint;
};

export const getPublicByName = async (name: string) => {
  const endpoint = await endpointDao.findPublicByName(name);
  if (!endpoint) throw new ApiError(404, 'Endpoint not found');
  return endpoint;
};

export const update = async (userId: string, name: string, data: Record<string, unknown>) => {
  const endpoint = await endpointDao.findByUserIdAndName(userId, name);
  if (!endpoint) throw new ApiError(404, 'Endpoint not found');

  if (data.schema) {
    const validatorKey = `${userId}:${name}`;
    schemaValidator.compile(validatorKey, data.schema as object);
  }

  return endpointDao.updateByUserIdAndName(userId, name, data);
};

export const remove = async (userId: string, name: string) => {
  const endpoint = await endpointDao.findByUserIdAndName(userId, name);
  if (!endpoint) throw new ApiError(404, 'Endpoint not found');

  const collName = getCollectionName(userId, name);
  await dynamicDao.dropCollection(collName);

  schemaValidator.remove(`${userId}:${name}`);

  return endpointDao.deleteByUserIdAndName(userId, name);
};
