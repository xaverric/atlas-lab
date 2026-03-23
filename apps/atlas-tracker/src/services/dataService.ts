import { ApiError } from '@atlas/core';
import * as dynamicDao from '../daos/dynamicDao.js';
import * as schemaValidator from './schemaValidator.js';
import { publishNotification } from './publishNotification.js';

const getCollectionName = (userId: string, endpointName: string) =>
  `tracker_${userId}_${endpointName}`;

interface QueryFilters {
  from?: string;
  to?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  filter?: string;
}

const ALLOWED_OPS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex']);

const sanitizeValue = (val: unknown): unknown => {
  if (typeof val === 'string') return isNaN(Number(val)) ? val : Number(val);
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.map(sanitizeValue);
  return String(val);
};

const buildMongoQuery = (filters: QueryFilters): Record<string, unknown> => {
  const query: Record<string, unknown> = {};

  if (filters.from || filters.to) {
    const createdAt: Record<string, unknown> = {};
    if (filters.from) createdAt['$gte'] = new Date(filters.from);
    if (filters.to) createdAt['$lte'] = new Date(filters.to);
    query.createdAt = createdAt;
  }

  if (filters.filter) {
    let parsed: Record<string, unknown>;
    try {
      parsed = typeof filters.filter === 'string' ? JSON.parse(filters.filter) : {};
    } catch {
      return query;
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('$')) continue;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const mongoOps: Record<string, unknown> = {};
        for (const [op, val] of Object.entries(value as Record<string, unknown>)) {
          if (!ALLOWED_OPS.has(op)) continue;
          mongoOps[op] = sanitizeValue(val);
        }
        if (Object.keys(mongoOps).length) query[`data.${key}`] = mongoOps;
      } else {
        query[`data.${key}`] = sanitizeValue(value);
      }
    }
  }

  return query;
};

const buildSort = (sort?: string): Record<string, 1 | -1> => {
  if (!sort) return { createdAt: -1 };
  const [field, order] = sort.split(':');
  return { [field]: order === 'asc' ? 1 : -1 };
};

const transformEntry = (doc: Record<string, unknown>) => {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};

export const insert = async (
  userId: string,
  endpointName: string,
  schema: object,
  data: unknown,
  metadata: { source: string; ip?: string; userAgent?: string },
) => {
  const validatorKey = `${userId}:${endpointName}`;

  try {
    schemaValidator.validate(validatorKey, data);
  } catch {
    schemaValidator.compile(validatorKey, schema);
  }

  const result = schemaValidator.validate(validatorKey, data);
  if (!result.valid) {
    throw new ApiError(400, 'Data validation failed', { validation: result.errors || [] });
  }

  const collName = getCollectionName(userId, endpointName);
  const doc = { data, metadata, createdAt: new Date() };
  const inserted = await dynamicDao.insertOne(collName, doc);

  publishNotification(
    userId,
    'Data Submitted',
    `New data submitted to "${endpointName}" tracker endpoint.`,
    'tracker.data.submitted',
  );

  return { ...doc, id: inserted.insertedId };
};

export const query = async (userId: string, endpointName: string, filters: QueryFilters) => {
  const collName = getCollectionName(userId, endpointName);
  const mongoQuery = buildMongoQuery(filters);
  const sort = buildSort(filters.sort);
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const [items, total] = await Promise.all([
    dynamicDao.find(collName, mongoQuery, sort, offset, limit),
    dynamicDao.count(collName, mongoQuery),
  ]);

  return {
    items: items.map(transformEntry),
    total,
    limit,
    offset,
  };
};

export const deleteEntry = async (userId: string, endpointName: string, entryId: string) => {
  const collName = getCollectionName(userId, endpointName);
  const result = await dynamicDao.deleteById(collName, entryId);
  if (result.deletedCount === 0) throw new ApiError(404, 'Entry not found');
};
