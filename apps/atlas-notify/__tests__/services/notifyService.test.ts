import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueueAdd } = vi.hoisted(() => {
  const mockQueueAdd = vi.fn();
  return { mockQueueAdd };
});

vi.mock('bullmq', () => ({
  Queue: class {
    add = mockQueueAdd;
    close = vi.fn();
  },
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: undefined },
  },
}));

vi.mock('../../src/daos/notificationDao.js', () => ({
  create: vi.fn(),
  list: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  countUnread: vi.fn(),
  prune: vi.fn(),
}));

vi.mock('../../src/daos/channelDao.js', () => ({
  findByUser: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../src/daos/preferenceDao.js', () => ({
  findRulesForUser: vi.fn(),
  findMatchingRules: vi.fn(),
  createRule: vi.fn(),
}));

vi.mock('../../src/services/templateResolver.js', () => ({
  resolve: vi.fn(),
}));

vi.mock('../../src/services/sseManager.js', () => ({
  pushToUser: vi.fn(),
}));

import * as notifyService from '../../src/services/notifyService.js';
import * as notificationDao from '../../src/daos/notificationDao.js';
import * as channelDao from '../../src/daos/channelDao.js';
import * as preferenceDao from '../../src/daos/preferenceDao.js';
import { resolve } from '../../src/services/templateResolver.js';
import * as sseManager from '../../src/services/sseManager.js';

beforeEach(() => vi.clearAllMocks());

describe('notifyService', () => {
  describe('send', () => {
    it('resolves template, creates notification, and pushes SSE', async () => {
      vi.mocked(resolve).mockResolvedValue({ title: 'Hello', body: 'World' });
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app', enabled: true, verified: true },
      ] as any);

      const mockNotification = {
        id: 'n1',
        toJSON: () => ({ id: 'n1', title: 'Hello' }),
      };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(5);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.send('user1', 'welcome', { name: 'Alice' });

      expect(resolve).toHaveBeenCalledWith('welcome', 'welcome', { name: 'Alice' });
      expect(notificationDao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          title: 'Hello',
          body: 'World',
          read: false,
        }),
      );
      expect(sseManager.pushToUser).toHaveBeenCalledWith('user1', 'notification', { id: 'n1', title: 'Hello' });
      expect(sseManager.pushToUser).toHaveBeenCalledWith('user1', 'unread-count', { count: 5 });
      expect(notificationDao.prune).toHaveBeenCalledWith('user1');
    });

    it('queues delivery for non-in_app channels', async () => {
      vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app', enabled: true, verified: true },
        { _id: 'ch2', type: 'email', enabled: true, verified: true, config: { address: 'a@b.c' } },
      ] as any);

      const mockNotification = { id: 'n1', toJSON: () => ({}) };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.send('user1', 'tpl');

      expect(mockQueueAdd).toHaveBeenCalledWith('deliver', {
        notificationId: 'n1',
        deliveryIndex: 1,
        channelType: 'email',
        channelConfig: { address: 'a@b.c' },
      });
    });

    it('skips disabled and unverified channels', async () => {
      vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'email', enabled: false, verified: true },
        { _id: 'ch2', type: 'telegram', enabled: true, verified: false },
      ] as any);

      const mockNotification = { id: 'n1', toJSON: () => ({}) };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.send('user1', 'tpl');

      expect(notificationDao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveries: [expect.objectContaining({ channelType: 'in_app', status: 'sent' })],
        }),
      );
    });

    it('creates fallback in_app delivery when no channels', async () => {
      vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });
      vi.mocked(channelDao.findByUser).mockResolvedValue([]);

      const mockNotification = { id: 'n1', toJSON: () => ({}) };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.send('user1', 'tpl');

      expect(notificationDao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveries: [expect.objectContaining({ channelType: 'in_app' })],
        }),
      );
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('delegates to notificationDao.list', async () => {
      vi.mocked(notificationDao.list).mockResolvedValue({ data: [], total: 0 } as any);

      await notifyService.history('user1', 1, 20);

      expect(notificationDao.list).toHaveBeenCalledWith('user1', 1, 20, undefined, false);
    });

    it('passes isAdmin flag', async () => {
      vi.mocked(notificationDao.list).mockResolvedValue({ data: [], total: 0 } as any);

      await notifyService.history('user1', 1, 20, true);

      expect(notificationDao.list).toHaveBeenCalledWith('user1', 1, 20, undefined, true);
    });
  });

  describe('markRead', () => {
    it('delegates to notificationDao.markRead', async () => {
      vi.mocked(notificationDao.markRead).mockResolvedValue({} as any);

      await notifyService.markRead('n1', 'user1');

      expect(notificationDao.markRead).toHaveBeenCalledWith('n1', 'user1');
    });
  });

  describe('markAllRead', () => {
    it('delegates to notificationDao.markAllRead', async () => {
      vi.mocked(notificationDao.markAllRead).mockResolvedValue({} as any);

      await notifyService.markAllRead('user1');

      expect(notificationDao.markAllRead).toHaveBeenCalledWith('user1');
    });
  });

  describe('unreadCount', () => {
    it('delegates to notificationDao.countUnread', async () => {
      vi.mocked(notificationDao.countUnread).mockResolvedValue(3);

      const count = await notifyService.unreadCount('user1');

      expect(count).toBe(3);
    });
  });

  describe('ensureUserSetup', () => {
    it('creates in_app channel and wildcard rule when none exist', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([]);
      vi.mocked(channelDao.create).mockResolvedValue({ _id: 'ch1', type: 'in_app' } as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([]);
      vi.mocked(preferenceDao.createRule).mockResolvedValue({} as any);

      const result = await notifyService.ensureUserSetup('user1');

      expect(channelDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', type: 'in_app', verified: true }),
      );
      expect(preferenceDao.createRule).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', eventPattern: '*', channelIds: ['ch1'] }),
      );
      expect(result).toEqual({ _id: 'ch1', type: 'in_app' });
    });

    it('skips channel creation if in_app exists', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      const result = await notifyService.ensureUserSetup('user1');

      expect(channelDao.create).not.toHaveBeenCalled();
      expect(preferenceDao.createRule).not.toHaveBeenCalled();
      expect(result).toEqual({ _id: 'ch1', type: 'in_app' });
    });

    it('skips rule creation if rules exist', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([]);
      vi.mocked(channelDao.create).mockResolvedValue({ _id: 'ch1', type: 'in_app' } as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      await notifyService.ensureUserSetup('user1');

      expect(channelDao.create).toHaveBeenCalled();
      expect(preferenceDao.createRule).not.toHaveBeenCalled();
    });
  });

  describe('createDirect', () => {
    it('creates notification via matching preference rules', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);
      vi.mocked(channelDao.create).mockResolvedValue({ _id: 'ch1', type: 'in_app' } as any);

      vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
        {
          channelIds: [
            { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
          ],
        },
      ] as any);

      const mockNotification = {
        id: 'n1',
        toJSON: () => ({ id: 'n1', title: 'Test' }),
      };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(1);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      const result = await notifyService.createDirect('user1', {
        title: 'Test',
        body: 'Body',
        event: 'test.event',
        priority: 'high',
        url: '/test',
      });

      expect(result).toEqual(mockNotification);
      expect(notificationDao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          title: 'Test',
          body: 'Body',
          event: 'test.event',
          priority: 'high',
          data: { url: '/test' },
        }),
      );
    });

    it('returns null when no matching rules', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([]);

      const result = await notifyService.createDirect('user1', {
        title: 'Test',
        body: 'Body',
        event: 'test.event',
      });

      expect(result).toBeNull();
    });

    it('returns null when matching rules have no enabled/verified channels', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
        {
          channelIds: [
            { _id: { toString: () => 'ch1' }, type: 'email', enabled: false, verified: true },
          ],
        },
      ] as any);

      const result = await notifyService.createDirect('user1', {
        title: 'Test',
        body: 'Body',
        event: 'test.event',
      });

      expect(result).toBeNull();
    });

    it('deduplicates channels across rules', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
        {
          channelIds: [
            { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
          ],
        },
        {
          channelIds: [
            { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
          ],
        },
      ] as any);

      const mockNotification = { id: 'n1', toJSON: () => ({}) };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.createDirect('user1', {
        title: 'T',
        body: 'B',
        event: 'ev',
      });

      const deliveries = vi.mocked(notificationDao.create).mock.calls[0][0].deliveries as any[];
      expect(deliveries).toHaveLength(1);
    });

    it('queues delivery jobs for non-in_app channels', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
        {
          channelIds: [
            { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
            { _id: { toString: () => 'ch2' }, type: 'email', enabled: true, verified: true, config: { address: 'x@y.z' } },
          ],
        },
      ] as any);

      const mockNotification = { id: 'n1', toJSON: () => ({}) };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.createDirect('user1', {
        title: 'T',
        body: 'B',
        event: 'ev',
      });

      expect(mockQueueAdd).toHaveBeenCalledWith('deliver', expect.objectContaining({
        channelType: 'email',
        notificationId: 'n1',
      }));
    });

    it('uses default priority "normal" when not specified', async () => {
      vi.mocked(channelDao.findByUser).mockResolvedValue([
        { _id: 'ch1', type: 'in_app' },
      ] as any);
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([{ id: 'r1' }] as any);

      vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
        {
          channelIds: [
            { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
          ],
        },
      ] as any);

      const mockNotification = { id: 'n1', toJSON: () => ({}) };
      vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
      vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
      vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

      await notifyService.createDirect('user1', {
        title: 'T',
        body: 'B',
        event: 'ev',
      });

      expect(notificationDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'normal', data: undefined }),
      );
    });
  });
});
