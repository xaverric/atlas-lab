import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ApiError } from '@atlas/core';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validators = new Map<string, ValidateFunction>();

export const compile = (key: string, schema: object) => {
  const existing = validators.get(key);
  if (existing) ajv.removeSchema(existing.schema);
  validators.set(key, ajv.compile(schema));
};

export const remove = (key: string) => {
  const existing = validators.get(key);
  if (existing) ajv.removeSchema(existing.schema);
  validators.delete(key);
};

export const validate = (key: string, data: unknown): { valid: boolean; errors?: string[] } => {
  const validateFn = validators.get(key);
  if (!validateFn) throw new ApiError(500, 'Schema not compiled');

  const valid = validateFn(data);
  return {
    valid: !!valid,
    errors: validateFn.errors?.map(e => `${e.instancePath} ${e.message}`.trim()),
  };
};
