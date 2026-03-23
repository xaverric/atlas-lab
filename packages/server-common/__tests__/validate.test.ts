import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';

const mockRes = () => ({}) as any;

describe('validate', () => {
  it('passes valid body and calls next()', () => {
    const schema = z.object({ name: z.string() });
    const req = { body: { name: 'Alice' } } as any;
    const next = vi.fn();

    validate(schema)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice' });
  });

  it('strips unknown keys from body', () => {
    const schema = z.object({ name: z.string() }).strict();
    const req = { body: { name: 'Alice', extra: true } } as any;
    const next = vi.fn();

    validate(schema)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: 'Validation failed' }),
    );
  });

  it('calls next with ApiError(400) on invalid body', () => {
    const schema = z.object({ name: z.string().min(1) });
    const req = { body: { name: '' } } as any;
    const next = vi.fn();

    validate(schema)(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toBe('Validation failed');
    expect(err.details).toHaveProperty('name');
  });

  it('validates query source', () => {
    const schema = z.object({ page: z.coerce.number() });
    const req = { query: { page: '3' } } as any;
    const next = vi.fn();

    validate(schema, 'query')(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 3 });
  });

  it('validates params source', () => {
    const schema = z.object({ id: z.string().length(24) });
    const req = { params: { id: 'a'.repeat(24) } } as any;
    const next = vi.fn();

    validate(schema, 'params')(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('forwards non-ZodError to next', () => {
    const schema = {
      parse: () => { throw new TypeError('boom'); },
    } as any;
    const req = { body: {} } as any;
    const next = vi.fn();

    validate(schema)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(TypeError));
  });

  it('collects multiple field errors into details', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });
    const req = { body: { name: '', age: -1 } } as any;
    const next = vi.fn();

    validate(schema)(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.details).toHaveProperty('name');
    expect(err.details).toHaveProperty('age');
  });
});
