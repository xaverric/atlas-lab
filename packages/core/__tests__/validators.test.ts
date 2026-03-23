import { describe, it, expect } from 'vitest';
import { paginationSchema, objectIdSchema } from '../src/validators/common.js';

describe('paginationSchema', () => {
  describe('defaults', () => {
    it('applies default page=1 and limit=20 when empty', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('applies default page=1 when only limit is provided', () => {
      const result = paginationSchema.parse({ limit: 50 });
      expect(result).toEqual({ page: 1, limit: 50 });
    });

    it('applies default limit=20 when only page is provided', () => {
      const result = paginationSchema.parse({ page: 3 });
      expect(result).toEqual({ page: 3, limit: 20 });
    });
  });

  describe('valid values', () => {
    it('accepts custom page and limit', () => {
      const result = paginationSchema.parse({ page: 5, limit: 50 });
      expect(result).toEqual({ page: 5, limit: 50 });
    });

    it('accepts page=1 and limit=1 (minimum bounds)', () => {
      const result = paginationSchema.parse({ page: 1, limit: 1 });
      expect(result).toEqual({ page: 1, limit: 1 });
    });

    it('accepts limit=100 (maximum bound)', () => {
      const result = paginationSchema.parse({ limit: 100 });
      expect(result).toEqual({ page: 1, limit: 100 });
    });

    it('accepts large page numbers', () => {
      const result = paginationSchema.parse({ page: 999999 });
      expect(result).toEqual({ page: 999999, limit: 20 });
    });
  });

  describe('coercion from strings', () => {
    it('coerces string page and limit to numbers', () => {
      const result = paginationSchema.parse({ page: '3', limit: '25' });
      expect(result).toEqual({ page: 3, limit: 25 });
    });

    it('coerces string page only', () => {
      const result = paginationSchema.parse({ page: '10' });
      expect(result).toEqual({ page: 10, limit: 20 });
    });
  });

  describe('invalid page values', () => {
    it('rejects page=0', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    });

    it('rejects negative page', () => {
      expect(() => paginationSchema.parse({ page: -1 })).toThrow();
    });

    it('rejects non-integer page', () => {
      expect(() => paginationSchema.parse({ page: 1.5 })).toThrow();
    });

    it('rejects non-numeric page string', () => {
      expect(() => paginationSchema.parse({ page: 'abc' })).toThrow();
    });
  });

  describe('invalid limit values', () => {
    it('rejects limit=0', () => {
      expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
    });

    it('rejects negative limit', () => {
      expect(() => paginationSchema.parse({ limit: -5 })).toThrow();
    });

    it('rejects limit exceeding max (101)', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });

    it('rejects limit far exceeding max', () => {
      expect(() => paginationSchema.parse({ limit: 1000 })).toThrow();
    });

    it('rejects non-integer limit', () => {
      expect(() => paginationSchema.parse({ limit: 2.7 })).toThrow();
    });

    it('rejects non-numeric limit string', () => {
      expect(() => paginationSchema.parse({ limit: 'xyz' })).toThrow();
    });
  });

  describe('safeParse for error details', () => {
    it('returns error with issues for invalid input', () => {
      const result = paginationSchema.safeParse({ page: -1, limit: 200 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});

describe('objectIdSchema', () => {
  describe('valid ObjectIds', () => {
    it('accepts a valid 24-char lowercase hex string', () => {
      const result = objectIdSchema.parse('507f1f77bcf86cd799439011');
      expect(result).toBe('507f1f77bcf86cd799439011');
    });

    it('accepts a valid 24-char uppercase hex string', () => {
      const result = objectIdSchema.parse('507F1F77BCF86CD799439011');
      expect(result).toBe('507F1F77BCF86CD799439011');
    });

    it('accepts a mixed-case 24-char hex string', () => {
      const result = objectIdSchema.parse('507f1F77bcF86cD799439011');
      expect(result).toBe('507f1F77bcF86cD799439011');
    });

    it('accepts all zeros', () => {
      const result = objectIdSchema.parse('000000000000000000000000');
      expect(result).toBe('000000000000000000000000');
    });

    it('accepts all f characters', () => {
      const result = objectIdSchema.parse('ffffffffffffffffffffffff');
      expect(result).toBe('ffffffffffffffffffffffff');
    });
  });

  describe('invalid ObjectIds', () => {
    it('rejects empty string', () => {
      expect(() => objectIdSchema.parse('')).toThrow(/Invalid ObjectId/);
    });

    it('rejects string shorter than 24 chars', () => {
      expect(() => objectIdSchema.parse('507f1f77bcf86cd79943901')).toThrow(/Invalid ObjectId/);
    });

    it('rejects string longer than 24 chars', () => {
      expect(() => objectIdSchema.parse('507f1f77bcf86cd7994390111')).toThrow(/Invalid ObjectId/);
    });

    it('rejects non-hex characters (g)', () => {
      expect(() => objectIdSchema.parse('507f1f77bcf86cd79943901g')).toThrow(/Invalid ObjectId/);
    });

    it('rejects non-hex characters (z)', () => {
      expect(() => objectIdSchema.parse('zzzzzzzzzzzzzzzzzzzzzzzz')).toThrow(/Invalid ObjectId/);
    });

    it('rejects string with spaces', () => {
      expect(() => objectIdSchema.parse('507f1f77bcf86cd7 9439011')).toThrow(/Invalid ObjectId/);
    });

    it('rejects string with special characters', () => {
      expect(() => objectIdSchema.parse('507f1f77bcf86cd79943901!')).toThrow(/Invalid ObjectId/);
    });

    it('rejects a number input', () => {
      expect(() => objectIdSchema.parse(12345)).toThrow();
    });

    it('rejects null', () => {
      expect(() => objectIdSchema.parse(null)).toThrow();
    });

    it('rejects undefined', () => {
      expect(() => objectIdSchema.parse(undefined)).toThrow();
    });

    it('rejects an object', () => {
      expect(() => objectIdSchema.parse({})).toThrow();
    });
  });
});
