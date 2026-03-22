import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../src/middleware/require-role.js';

const mockReq = (roles: string[]) => ({
  auth: { realm_access: { roles } },
}) as any;

describe('requireRole', () => {
  it('calls next() when user has role', () => {
    const next = vi.fn();
    requireRole('admin')(mockReq(['admin', 'user']), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with error when user lacks role', () => {
    const next = vi.fn();
    requireRole('admin')(mockReq(['user']), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('accepts any of multiple roles', () => {
    const next = vi.fn();
    requireRole('admin', 'editor')(mockReq(['editor']), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });
});
