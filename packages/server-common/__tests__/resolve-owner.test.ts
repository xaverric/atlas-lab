import { describe, it, expect } from 'vitest';
import { resolveOwner } from '../src/middleware/resolve-owner.js';

const mockReq = (sub: string, roles: string[] = [], queryUserId?: string) => ({
  auth: { sub, realm_access: { roles } },
  query: { userId: queryUserId },
}) as any;

describe('resolveOwner', () => {
  it('returns auth sub for regular user', () => {
    const { ownerId, isAdmin } = resolveOwner(mockReq('user-1', ['user']));
    expect(ownerId).toBe('user-1');
    expect(isAdmin).toBe(false);
  });

  it('throws 403 if non-admin passes userId', () => {
    expect(() => resolveOwner(mockReq('user-1', ['user'], 'other'))).toThrow();
  });

  it('allows admin to browse other user data', () => {
    const { ownerId, isAdmin } = resolveOwner(mockReq('admin-1', ['admin'], 'other'));
    expect(ownerId).toBe('other');
    expect(isAdmin).toBe(true);
  });

  it('admin without userId returns own sub', () => {
    const { ownerId } = resolveOwner(mockReq('admin-1', ['admin']));
    expect(ownerId).toBe('admin-1');
  });

  it('returns isAdmin false when realm_access is missing entirely', () => {
    const req = { auth: { sub: 'user-1' }, query: {} } as any;
    const { ownerId, isAdmin } = resolveOwner(req);
    expect(isAdmin).toBe(false);
    expect(ownerId).toBe('user-1');
  });

  it('returns isAdmin false when roles array is missing', () => {
    const req = { auth: { sub: 'user-1', realm_access: {} }, query: {} } as any;
    const { isAdmin } = resolveOwner(req);
    expect(isAdmin).toBe(false);
  });

  it('does not throw when non-admin passes empty string userId', () => {
    const req = { auth: { sub: 'user-1', realm_access: { roles: ['user'] } }, query: { userId: '' } } as any;
    const { ownerId } = resolveOwner(req);
    expect(ownerId).toBe('user-1');
  });

  it('throws with exact 403 message when non-admin passes userId', () => {
    expect(() => resolveOwner(mockReq('user-1', ['user'], 'other')))
      .toThrow('Only admins can browse other users data');
  });
});
