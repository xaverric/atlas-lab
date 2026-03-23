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

vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: vi.fn(() => ({
      next: () => ({ toDate: () => new Date('2099-01-01T00:00:00Z') }),
    })),
  },
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

vi.mock('../../src/daos/jobRunDao.js', () => ({
  create: vi.fn(),
  listByJobId: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
  appendLog: vi.fn(),
  getLastRun: vi.fn(),
  pruneOldRuns: vi.fn(),
}));

vi.mock('../../src/daos/jobStorageDao.js', () => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

import * as jobService from '../../src/services/jobService.js';
import * as jobDao from '../../src/daos/jobDao.js';

const mockJobDao = vi.mocked(jobDao);

beforeEach(() => vi.clearAllMocks());

describe('jobService', () => {
  const ownerId = 'user-1';

  describe('create', () => {
    it('computes nextRunAt from cron expression', async () => {
      const jobData = {
        name: 'My Job',
        ownerId,
        schedule: { type: 'cron', expression: '0 * * * *', timezone: 'UTC' },
        executionType: 'webhook',
        config: {},
        enabled: false,
      };

      const saved = { ...jobData, _id: 'j1', toObject: () => ({ ...jobData, _id: 'j1' }) };
      mockJobDao.create.mockResolvedValue(saved as never);

      const result = await jobService.create(jobData);
      expect(result).toBe(saved);
      expect(mockJobDao.create).toHaveBeenCalledTimes(1);
      const createArg = mockJobDao.create.mock.calls[0][0];
      expect(createArg.nextRunAt).toBeInstanceOf(Date);
    });

    it('computes nextRunAt from once schedule', async () => {
      const runAt = '2099-01-01T00:00:00Z';
      const jobData = {
        name: 'Once Job',
        ownerId,
        schedule: { type: 'once', runAt },
        executionType: 'webhook',
        config: {},
        enabled: false,
      };

      const saved = { ...jobData, _id: 'j2', toObject: () => ({ ...jobData, _id: 'j2' }) };
      mockJobDao.create.mockResolvedValue(saved as never);

      await jobService.create(jobData);
      const createArg = mockJobDao.create.mock.calls[0][0];
      expect(createArg.nextRunAt).toEqual(new Date(runAt));
    });

    it('sets nextRunAt to null for unknown schedule type', async () => {
      const jobData = {
        name: 'Unknown',
        ownerId,
        schedule: { type: 'interval' },
        executionType: 'webhook',
        config: {},
        enabled: false,
      };

      const saved = { ...jobData, _id: 'j3', toObject: () => ({ ...jobData, _id: 'j3' }) };
      mockJobDao.create.mockResolvedValue(saved as never);

      await jobService.create(jobData);
      expect(mockJobDao.create.mock.calls[0][0].nextRunAt).toBeNull();
    });

    it('schedules the job in BullMQ when enabled', async () => {
      const jobData = {
        name: 'Enabled Job',
        ownerId,
        schedule: { type: 'cron', expression: '0 * * * *' },
        executionType: 'webhook',
        config: {},
        enabled: true,
      };

      const saved = { ...jobData, _id: 'j4', enabled: true, toObject: () => ({ ...jobData, _id: 'j4' }) };
      mockJobDao.create.mockResolvedValue(saved as never);

      await jobService.create(jobData);
      expect(mockJobDao.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('passes filters to dao', async () => {
      const expected = { data: [], total: 0, page: 1, limit: 20 };
      mockJobDao.list.mockResolvedValue(expected as never);

      const result = await jobService.list(ownerId, { executionType: 'webhook', enabled: true });
      expect(result).toEqual(expected);
      expect(mockJobDao.list).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId, executionType: 'webhook', enabled: true, page: 1, limit: 20 }),
      );
    });

    it('defaults page=1 limit=20', async () => {
      mockJobDao.list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 } as never);
      await jobService.list(ownerId, {});
      expect(mockJobDao.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('passes isAdmin flag', async () => {
      mockJobDao.list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 } as never);
      await jobService.list(ownerId, {}, true);
      expect(mockJobDao.list).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true }),
      );
    });
  });

  describe('getById', () => {
    it('returns job when found', async () => {
      const job = { _id: 'j1', name: 'Test', ownerId };
      mockJobDao.findById.mockResolvedValue(job as never);

      const result = await jobService.getById('j1', ownerId);
      expect(result).toBe(job);
    });

    it('throws 404 when not found', async () => {
      mockJobDao.findById.mockResolvedValue(null as never);
      await expect(jobService.getById('missing', ownerId)).rejects.toThrow('Job not found');
    });

    it('passes isAdmin to dao', async () => {
      mockJobDao.findById.mockResolvedValue(null as never);
      await expect(jobService.getById('j1', ownerId, true)).rejects.toThrow();
      expect(mockJobDao.findById).toHaveBeenCalledWith('j1', ownerId, true);
    });
  });

  describe('update', () => {
    it('recomputes nextRunAt when schedule changes', async () => {
      const existingJob = { _id: 'j1', name: 'Existing', ownerId, enabled: false };
      mockJobDao.findById.mockResolvedValue(existingJob as never);

      const updatedJob = { ...existingJob, enabled: false, toObject: () => existingJob };
      mockJobDao.updateById.mockResolvedValue(updatedJob as never);

      await jobService.update('j1', ownerId, {
        schedule: { type: 'cron', expression: '*/5 * * * *' },
      });

      const updateArg = mockJobDao.updateById.mock.calls[0][1];
      expect(updateArg.nextRunAt).toBeInstanceOf(Date);
    });

    it('throws 404 if update returns null', async () => {
      mockJobDao.findById.mockResolvedValue({ _id: 'j1', ownerId } as never);
      mockJobDao.updateById.mockResolvedValue(null as never);

      await expect(jobService.update('j1', ownerId, { name: 'New' })).rejects.toThrow('Job not found');
    });
  });

  describe('remove', () => {
    it('deletes job and removes from queue', async () => {
      mockJobDao.findById.mockResolvedValue({ _id: 'j1', ownerId } as never);
      mockJobDao.deleteById.mockResolvedValue(null as never);

      await jobService.remove('j1', ownerId);
      expect(mockJobDao.deleteById).toHaveBeenCalledWith('j1');
    });

    it('throws 404 if job not found', async () => {
      mockJobDao.findById.mockResolvedValue(null as never);
      await expect(jobService.remove('missing', ownerId)).rejects.toThrow('Job not found');
    });
  });

  describe('setEnabled', () => {
    it('enables a job and schedules it', async () => {
      const job = { _id: 'j1', ownerId, enabled: true, toObject: () => ({ _id: 'j1' }) };
      mockJobDao.findById.mockResolvedValue(job as never);
      mockJobDao.updateById.mockResolvedValue(job as never);

      const result = await jobService.setEnabled('j1', ownerId, true);
      expect(result).toBe(job);
      expect(mockJobDao.updateById).toHaveBeenCalledWith('j1', { enabled: true });
    });

    it('disables a job and removes from queue', async () => {
      const job = { _id: 'j1', ownerId, enabled: false, toObject: () => ({ _id: 'j1' }) };
      mockJobDao.findById.mockResolvedValue(job as never);
      mockJobDao.updateById.mockResolvedValue(job as never);

      await jobService.setEnabled('j1', ownerId, false);
      expect(mockJobDao.updateById).toHaveBeenCalledWith('j1', { enabled: false });
    });

    it('throws 404 if update returns null', async () => {
      mockJobDao.findById.mockResolvedValue({ _id: 'j1', ownerId } as never);
      mockJobDao.updateById.mockResolvedValue(null as never);

      await expect(jobService.setEnabled('j1', ownerId, true)).rejects.toThrow('Job not found');
    });
  });

  describe('addNotification', () => {
    it('adds notification to job', async () => {
      const job = { _id: 'j1', ownerId };
      mockJobDao.findById.mockResolvedValue(job as never);
      const updated = { ...job, notifications: [{ channel: 'email' }] };
      mockJobDao.addNotification.mockResolvedValue(updated as never);

      const result = await jobService.addNotification('j1', ownerId, { channel: 'email' });
      expect(result).toBe(updated);
    });

    it('throws 404 if addNotification returns null', async () => {
      mockJobDao.findById.mockResolvedValue({ _id: 'j1', ownerId } as never);
      mockJobDao.addNotification.mockResolvedValue(null as never);

      await expect(jobService.addNotification('j1', ownerId, {})).rejects.toThrow('Job not found');
    });
  });

  describe('removeNotification', () => {
    it('removes notification from job', async () => {
      const job = { _id: 'j1', ownerId, notifications: [] };
      mockJobDao.findById.mockResolvedValue(job as never);
      mockJobDao.removeNotification.mockResolvedValue(job as never);

      const result = await jobService.removeNotification('j1', ownerId, 'notif-1');
      expect(result).toBe(job);
    });

    it('throws 404 if removeNotification returns null', async () => {
      mockJobDao.findById.mockResolvedValue({ _id: 'j1', ownerId } as never);
      mockJobDao.removeNotification.mockResolvedValue(null as never);

      await expect(jobService.removeNotification('j1', ownerId, 'notif-1')).rejects.toThrow('Job not found');
    });
  });

  describe('computeNextRun', () => {
    it('returns null for unsupported schedule type', () => {
      const result = jobService.computeNextRun({ type: 'interval' });
      expect(result).toBeNull();
    });

    it('returns Date for cron', () => {
      const result = jobService.computeNextRun({ type: 'cron', expression: '0 0 * * *' });
      expect(result).toBeInstanceOf(Date);
    });

    it('returns Date for once with runAt', () => {
      const result = jobService.computeNextRun({ type: 'once', runAt: '2099-06-01T00:00:00Z' });
      expect(result).toEqual(new Date('2099-06-01T00:00:00Z'));
    });
  });
});
