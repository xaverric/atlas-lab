import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/auditDao.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/daos/auditDao.js')>('../../src/daos/auditDao.js');
  return {
    ...actual,
    find: vi.fn(),
  };
});

import * as auditService from '../../src/services/auditService.js';
import * as auditDao from '../../src/daos/auditDao.js';

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryEvents', () => {
    it('returns paginated results', async () => {
      const mockResult = {
        data: [
          { id: '1', action: 'user.login', userId: 'u1', timestamp: new Date() },
          { id: '2', action: 'user.logout', userId: 'u1', timestamp: new Date() },
        ],
        total: 10,
        limit: 50,
        offset: 0,
      };
      vi.mocked(auditDao.find).mockResolvedValue(mockResult);

      const result = await auditService.queryEvents({ limit: 50, offset: 0 });

      expect(auditDao.find).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('passes action filter to dao', async () => {
      const mockResult = { data: [{ id: '1', action: 'user.login' }], total: 1, limit: 50, offset: 0 };
      vi.mocked(auditDao.find).mockResolvedValue(mockResult);

      const result = await auditService.queryEvents({ action: 'user.login' });

      expect(auditDao.find).toHaveBeenCalledWith({ action: 'user.login' });
      expect(result.data).toHaveLength(1);
    });

    it('passes date range filters to dao', async () => {
      const mockResult = { data: [], total: 0, limit: 50, offset: 0 };
      vi.mocked(auditDao.find).mockResolvedValue(mockResult);

      const query = { from: '2026-01-01', to: '2026-01-31' };
      await auditService.queryEvents(query);

      expect(auditDao.find).toHaveBeenCalledWith(query);
    });

    it('passes userId filter to dao', async () => {
      const mockResult = {
        data: [{ id: '1', action: 'file.upload', userId: 'user-42' }],
        total: 1,
        limit: 50,
        offset: 0,
      };
      vi.mocked(auditDao.find).mockResolvedValue(mockResult);

      const result = await auditService.queryEvents({ userId: 'user-42' });

      expect(auditDao.find).toHaveBeenCalledWith({ userId: 'user-42' });
      expect(result.data[0].userId).toBe('user-42');
    });

    it('returns empty results when no events match', async () => {
      const mockResult = { data: [], total: 0, limit: 50, offset: 0 };
      vi.mocked(auditDao.find).mockResolvedValue(mockResult);

      const result = await auditService.queryEvents({ action: 'nonexistent.action' });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('passes combined filters to dao', async () => {
      const mockResult = { data: [], total: 0, limit: 20, offset: 10 };
      vi.mocked(auditDao.find).mockResolvedValue(mockResult);

      const query = {
        action: 'file.upload',
        userId: 'user-1',
        from: '2026-03-01',
        to: '2026-03-23',
        limit: 20,
        offset: 10,
      };
      const result = await auditService.queryEvents(query);

      expect(auditDao.find).toHaveBeenCalledWith(query);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(10);
    });
  });
});
