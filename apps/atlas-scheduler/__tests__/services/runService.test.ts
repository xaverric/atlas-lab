import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    add = vi.fn();
    remove = vi.fn();
    close = vi.fn();
    upsertJobScheduler = vi.fn();
    getJob = vi.fn();
    removeJobScheduler = vi.fn();
  },
  Worker: class MockWorker {
    on = vi.fn();
    close = vi.fn();
    constructor() {}
  },
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: undefined },
    maxRunsPerJob: 100,
    allowShellExec: false,
  },
}));

vi.mock('../../src/daos/jobRunDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listByJobId: vi.fn(),
  updateById: vi.fn(),
  appendLog: vi.fn(),
  getLastRun: vi.fn(),
  pruneOldRuns: vi.fn(),
}));

vi.mock('../../src/daos/jobDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  addNotification: vi.fn(),
  removeNotification: vi.fn(),
  findEnabled: vi.fn(),
  updateLastRun: vi.fn(),
  updateNextRun: vi.fn(),
}));

vi.mock('../../src/daos/jobStorageDao.js', () => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

import * as runService from '../../src/services/runService.js';
import * as jobRunDao from '../../src/daos/jobRunDao.js';
import * as jobDao from '../../src/daos/jobDao.js';

const mockJobRunDao = vi.mocked(jobRunDao);
const mockJobDao = vi.mocked(jobDao);

beforeEach(() => vi.clearAllMocks());

describe('runService', () => {
  describe('listByJobId', () => {
    it('delegates to jobRunDao.listByJobId', async () => {
      const expected = { data: [], total: 0, page: 1, limit: 20 };
      mockJobRunDao.listByJobId.mockResolvedValue(expected as never);

      const result = await runService.listByJobId('job-1', 1, 20);
      expect(result).toEqual(expected);
      expect(mockJobRunDao.listByJobId).toHaveBeenCalledWith('job-1', 1, 20);
    });

    it('passes custom page and limit', async () => {
      mockJobRunDao.listByJobId.mockResolvedValue({ data: [], total: 0, page: 3, limit: 5 } as never);

      await runService.listByJobId('job-1', 3, 5);
      expect(mockJobRunDao.listByJobId).toHaveBeenCalledWith('job-1', 3, 5);
    });
  });

  describe('getById', () => {
    it('returns run when found', async () => {
      const run = { _id: 'run-1', jobId: 'job-1', status: 'completed' };
      mockJobRunDao.findById.mockResolvedValue(run as never);

      const result = await runService.getById('run-1');
      expect(result).toBe(run);
    });

    it('throws 404 when run not found', async () => {
      mockJobRunDao.findById.mockResolvedValue(null as never);
      await expect(runService.getById('missing')).rejects.toThrow('Run not found');
    });

    it('checks ownership via jobDao when ownerId provided', async () => {
      const run = { _id: 'run-1', jobId: { toString: () => 'job-1' }, status: 'completed' };
      mockJobRunDao.findById.mockResolvedValue(run as never);
      mockJobDao.findById.mockResolvedValue({ _id: 'job-1', ownerId: 'user-1' } as never);

      const result = await runService.getById('run-1', 'user-1');
      expect(result).toBe(run);
      expect(mockJobDao.findById).toHaveBeenCalledWith('job-1', 'user-1', false);
    });

    it('throws 403 when owner does not match', async () => {
      const run = { _id: 'run-1', jobId: { toString: () => 'job-1' }, status: 'completed' };
      mockJobRunDao.findById.mockResolvedValue(run as never);
      mockJobDao.findById.mockResolvedValue(null as never);

      await expect(runService.getById('run-1', 'wrong-user')).rejects.toThrow('Access denied');
    });

    it('skips ownership check when isAdmin is true', async () => {
      const run = { _id: 'run-1', jobId: { toString: () => 'job-1' }, status: 'completed' };
      mockJobRunDao.findById.mockResolvedValue(run as never);

      const result = await runService.getById('run-1', 'user-1', true);
      expect(result).toBe(run);
      expect(mockJobDao.findById).not.toHaveBeenCalled();
    });
  });
});
