import { describe, it, expect, beforeEach } from 'vitest';
import * as schemaValidator from '../../src/services/schemaValidator.js';

describe('schemaValidator', () => {
  beforeEach(() => {
    schemaValidator.remove('test-key');
  });

  describe('compile', () => {
    it('compiles a valid JSON schema', () => {
      expect(() =>
        schemaValidator.compile('test-key', {
          type: 'object',
          properties: { name: { type: 'string' } },
        }),
      ).not.toThrow();
    });

    it('throws when schema exceeds maximum nesting depth', () => {
      let deep: Record<string, unknown> = { type: 'string' };
      for (let i = 0; i < 12; i++) {
        deep = { type: 'object', properties: { nested: deep } };
      }

      expect(() => schemaValidator.compile('test-key', deep)).toThrow(
        'Schema exceeds maximum nesting depth of 10',
      );
    });

    it('replaces an existing schema on recompile', () => {
      schemaValidator.compile('test-key', {
        type: 'object',
        properties: { a: { type: 'string' } },
        required: ['a'],
      });

      schemaValidator.compile('test-key', {
        type: 'object',
        properties: { b: { type: 'number' } },
        required: ['b'],
      });

      const result = schemaValidator.validate('test-key', { b: 42 });
      expect(result.valid).toBe(true);
    });
  });

  describe('validate', () => {
    it('returns valid true for matching data', () => {
      schemaValidator.compile('test-key', {
        type: 'object',
        properties: { count: { type: 'number' } },
        required: ['count'],
      });

      const result = schemaValidator.validate('test-key', { count: 5 });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('returns valid false with errors for invalid data', () => {
      schemaValidator.compile('test-key', {
        type: 'object',
        properties: { count: { type: 'number' } },
        required: ['count'],
      });

      const result = schemaValidator.validate('test-key', { count: 'not-a-number' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('returns errors when required field is missing', () => {
      schemaValidator.compile('test-key', {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      });

      const result = schemaValidator.validate('test-key', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.includes('required'))).toBe(true);
    });

    it('throws when schema is not compiled', () => {
      expect(() => schemaValidator.validate('unknown-key', {})).toThrow(
        'Schema not compiled',
      );
    });
  });

  describe('remove', () => {
    it('removes a compiled validator so it cannot be used', () => {
      schemaValidator.compile('test-key', { type: 'object' });
      schemaValidator.remove('test-key');

      expect(() => schemaValidator.validate('test-key', {})).toThrow(
        'Schema not compiled',
      );
    });

    it('does not throw when removing a non-existent key', () => {
      expect(() => schemaValidator.remove('non-existent')).not.toThrow();
    });
  });
});
