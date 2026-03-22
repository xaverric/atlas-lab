import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/userDao.js', () => ({
  findByKeycloakId: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
}));

import * as userService from '../../src/services/userService.js';
import * as userDao from '../../src/daos/userDao.js';

describe('userService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('findOrCreateFromToken', () => {
    it('returns existing user', async () => {
      const existing = { id: '1', email: 'test@test.com' };
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(existing as any);
      const result = await userService.findOrCreateFromToken({ sub: 'kc-1', email: 'test@test.com' } as any);
      expect(result).toBe(existing);
      expect(userDao.create).not.toHaveBeenCalled();
    });

    it('creates new user if not found', async () => {
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(null as any);
      vi.mocked(userDao.create).mockResolvedValue({ id: '2' } as any);
      await userService.findOrCreateFromToken({ sub: 'kc-2', email: 'new@test.com', name: 'New' } as any);
      expect(userDao.create).toHaveBeenCalledWith({ keycloakId: 'kc-2', email: 'new@test.com', name: 'New' });
    });
  });
});
