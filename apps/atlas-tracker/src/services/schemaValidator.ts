import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ApiError } from '@atlas/core';

const MAX_SCHEMA_DEPTH = 10;

const checkDepth = (obj: unknown, depth = 0): boolean => {
  if (depth > MAX_SCHEMA_DEPTH) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  return Object.values(obj).every(v => checkDepth(v, depth + 1));
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validators = new Map<string, ValidateFunction>();

export const compile = (key: string, schema: object) => {
  if (!checkDepth(schema)) throw new ApiError(400, `Schema exceeds maximum nesting depth of ${MAX_SCHEMA_DEPTH}`);
  const existing = validators.get(key);
  if (existing) ajv.removeSchema(existing.schema);
  validators.set(key, ajv.compile(schema));
};

export const remove = (key: string) => {
  const existing = validators.get(key);
  if (existing) ajv.removeSchema(existing.schema);
  validators.delete(key);
};

const MAX_DATA_DEPTH = 20;

const checkDataDepth = (obj: unknown, depth = 0): boolean => {
  if (depth > MAX_DATA_DEPTH) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  if (Array.isArray(obj)) return obj.every(v => checkDataDepth(v, depth + 1));
  return Object.values(obj).every(v => checkDataDepth(v, depth + 1));
};

export const validate = (key: string, data: unknown): { valid: boolean; errors?: string[] } => {
  const validateFn = validators.get(key);
  if (!validateFn) throw new ApiError(500, 'Schema not compiled');

  if (!checkDataDepth(data)) {
    return { valid: false, errors: [`Data exceeds maximum nesting depth of ${MAX_DATA_DEPTH}`] };
  }

  const valid = validateFn(data);
  return {
    valid: !!valid,
    errors: validateFn.errors?.map(e => `${e.instancePath} ${e.message}`.trim()),
  };
};
