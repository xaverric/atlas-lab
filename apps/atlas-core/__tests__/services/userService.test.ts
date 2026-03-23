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

    it('falls back to preferred_username when name is missing', async () => {
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(null as any);
      vi.mocked(userDao.create).mockResolvedValue({ id: '3' } as any);
      await userService.findOrCreateFromToken({ sub: 'kc-3', email: 'u@test.com', preferred_username: 'uname' } as any);
      expect(userDao.create).toHaveBeenCalledWith({ keycloakId: 'kc-3', email: 'u@test.com', name: 'uname' });
    });

    it('uses empty strings when email and name are missing', async () => {
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(null as any);
      vi.mocked(userDao.create).mockResolvedValue({ id: '4' } as any);
      await userService.findOrCreateFromToken({ sub: 'kc-4' } as any);
      expect(userDao.create).toHaveBeenCalledWith({ keycloakId: 'kc-4', email: '', name: '' });
    });
  });

  describe('updatePreferences', () => {
    it('returns updated user on valid update', async () => {
      const user = { id: 'u1', keycloakId: 'kc-1', preferences: {} };
      const updated = { ...user, preferences: { theme: 'dark' } };
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(user as any);
      vi.mocked(userDao.updateById).mockResolvedValue(updated as any);

      const result = await userService.updatePreferences('kc-1', { theme: 'dark' });

      expect(userDao.findByKeycloakId).toHaveBeenCalledWith('kc-1');
      expect(userDao.updateById).toHaveBeenCalledWith('u1', { preferences: { theme: 'dark' } });
      expect(result).toEqual(updated);
    });

    it('throws 404 when user not found', async () => {
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(null as any);

      await expect(userService.updatePreferences('nonexistent', { theme: 'light' }))
        .rejects.toThrow('User not found');
      expect(userDao.updateById).not.toHaveBeenCalled();
    });
  });
});
