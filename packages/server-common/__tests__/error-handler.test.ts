import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '@atlas/core';
import { errorHandler } from '../src/middleware/error-handler.js';

const mockRes = () => {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = () => ({}) as any;
const noop = vi.fn();

describe('errorHandler', () => {
  it('returns correct status and message for ApiError', () => {
    const res = mockRes();
    errorHandler(new ApiError(404, 'Not found'), mockReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('includes details when ApiError has them', () => {
    const res = mockRes();
    const details = { name: ['Required'] };
    errorHandler(new ApiError(400, 'Validation failed', details), mockReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: { name: ['Required'] },
    });
  });

  it('returns 500 for generic Error', () => {
    const res = mockRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(new Error('unexpected'), mockReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    spy.mockRestore();
  });

  it('returns 500 for non-Error object', () => {
    const res = mockRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler('string error', mockReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    spy.mockRestore();
  });

  it('omits details key when ApiError has no details', () => {
    const res = mockRes();
    errorHandler(new ApiError(409, 'Conflict'), mockReq(), res, noop);

    const payload = res.json.mock.calls[0][0];
    expect(payload).not.toHaveProperty('details');
  });
});
