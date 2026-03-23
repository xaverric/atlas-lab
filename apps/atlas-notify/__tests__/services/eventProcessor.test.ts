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

vi.mock('../../src/daos/preferenceDao.js', () => ({
  findMatchingRules: vi.fn(),
}));

vi.mock('../../src/daos/notificationDao.js', () => ({
  create: vi.fn(),
  countUnread: vi.fn(),
  prune: vi.fn(),
}));

vi.mock('../../src/channels/registry.js', () => ({
  getDeliverer: vi.fn(),
}));

vi.mock('../../src/services/templateResolver.js', () => ({
  resolve: vi.fn(),
}));

vi.mock('../../src/services/sseManager.js', () => ({
  pushToUser: vi.fn(),
}));

import { start } from '../../src/services/eventProcessor.js';
import * as preferenceDao from '../../src/daos/preferenceDao.js';
import * as notificationDao from '../../src/daos/notificationDao.js';
import { resolve } from '../../src/services/templateResolver.js';
import * as sseManager from '../../src/services/sseManager.js';

beforeEach(() => vi.clearAllMocks());

describe('eventProcessor', () => {
  const createBus = () => {
    const handlers: Array<(envelope: any) => Promise<void>> = [];
    return {
      subscribe: vi.fn((_pattern: string, handler: any) => {
        handlers.push(handler);
      }),
      publish: vi.fn(),
      unsubscribe: vi.fn(),
      _handlers: handlers,
      async emit(envelope: any) {
        for (const h of handlers) await h(envelope);
      },
    };
  };

  it('subscribes to wildcard events on start', () => {
    const bus = createBus();
    start(bus as any);
    expect(bus.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
  });

  it('processes event: finds rules, resolves template, creates notification', async () => {
    const bus = createBus();
    start(bus as any);

    vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
      {
        channelIds: [
          { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
        ],
      },
    ] as any);
    vi.mocked(resolve).mockResolvedValue({ title: 'Job Done', body: 'Details' });

    const mockNotification = { id: 'n1', toJSON: () => ({ id: 'n1' }) };
    vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
    vi.mocked(notificationDao.countUnread).mockResolvedValue(2);
    vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

    await bus.emit({
      event: 'job.completed',
      payload: { userId: 'user1', jobName: 'backup' },
      source: 'scheduler',
      timestamp: Date.now(),
    });

    expect(preferenceDao.findMatchingRules).toHaveBeenCalledWith('user1', 'job.completed');
    expect(resolve).toHaveBeenCalledWith('job.completed', undefined, expect.objectContaining({ userId: 'user1', jobName: 'backup' }));
    expect(notificationDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        event: 'job.completed',
        title: 'Job Done',
        body: 'Details',
      }),
    );
    expect(sseManager.pushToUser).toHaveBeenCalledWith('user1', 'notification', { id: 'n1' });
    expect(sseManager.pushToUser).toHaveBeenCalledWith('user1', 'unread-count', { count: 2 });
  });

  it('skips event when no userId in payload', async () => {
    const bus = createBus();
    start(bus as any);

    await bus.emit({
      event: 'system.ping',
      payload: {},
      source: 'system',
      timestamp: Date.now(),
    });

    expect(preferenceDao.findMatchingRules).not.toHaveBeenCalled();
    expect(notificationDao.create).not.toHaveBeenCalled();
  });

  it('skips when no matching rules', async () => {
    const bus = createBus();
    start(bus as any);

    vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([]);

    await bus.emit({
      event: 'some.event',
      payload: { userId: 'user1' },
      source: 'test',
      timestamp: Date.now(),
    });

    expect(notificationDao.create).not.toHaveBeenCalled();
  });

  it('queues delivery for non-in_app channels', async () => {
    const bus = createBus();
    start(bus as any);

    vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
      {
        channelIds: [
          { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
          { _id: { toString: () => 'ch2' }, type: 'email', enabled: true, verified: true, config: { address: 'a@b.c' } },
        ],
      },
    ] as any);
    vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });

    const mockNotification = { id: 'n1', toJSON: () => ({}) };
    vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
    vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
    vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

    await bus.emit({
      event: 'ev',
      payload: { userId: 'user1' },
      source: 'test',
      timestamp: Date.now(),
    });

    expect(mockQueueAdd).toHaveBeenCalledWith('deliver', expect.objectContaining({
      channelType: 'email',
      channelConfig: { address: 'a@b.c' },
    }));
  });

  it('skips disabled channels', async () => {
    const bus = createBus();
    start(bus as any);

    vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
      {
        channelIds: [
          { _id: { toString: () => 'ch1' }, type: 'email', enabled: false, verified: true, config: {} },
        ],
      },
    ] as any);
    vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });

    const mockNotification = { id: 'n1', toJSON: () => ({}) };
    vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
    vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
    vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

    await bus.emit({
      event: 'ev',
      payload: { userId: 'user1' },
      source: 'test',
      timestamp: Date.now(),
    });

    expect(notificationDao.create).toHaveBeenCalledWith(
      expect.objectContaining({ deliveries: [] }),
    );
  });

  it('deduplicates channels across rules', async () => {
    const bus = createBus();
    start(bus as any);

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
    vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });

    const mockNotification = { id: 'n1', toJSON: () => ({}) };
    vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
    vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
    vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

    await bus.emit({
      event: 'ev',
      payload: { userId: 'user1' },
      source: 'test',
      timestamp: Date.now(),
    });

    const deliveries = vi.mocked(notificationDao.create).mock.calls[0][0].deliveries as any[];
    expect(deliveries).toHaveLength(1);
  });

  it('extracts only string/number payload values as variables', async () => {
    const bus = createBus();
    start(bus as any);

    vi.mocked(preferenceDao.findMatchingRules).mockResolvedValue([
      {
        channelIds: [
          { _id: { toString: () => 'ch1' }, type: 'in_app', enabled: true, verified: true, config: {} },
        ],
      },
    ] as any);
    vi.mocked(resolve).mockResolvedValue({ title: 'T', body: 'B' });

    const mockNotification = { id: 'n1', toJSON: () => ({}) };
    vi.mocked(notificationDao.create).mockResolvedValue(mockNotification as any);
    vi.mocked(notificationDao.countUnread).mockResolvedValue(0);
    vi.mocked(notificationDao.prune).mockResolvedValue(undefined as any);

    await bus.emit({
      event: 'ev',
      payload: { userId: 'user1', count: 42, nested: { x: 1 }, flag: true },
      source: 'test',
      timestamp: Date.now(),
    });

    expect(resolve).toHaveBeenCalledWith('ev', undefined, {
      userId: 'user1',
      count: '42',
    });
  });

  it('swallows errors silently', async () => {
    const bus = createBus();
    start(bus as any);

    vi.mocked(preferenceDao.findMatchingRules).mockRejectedValue(new Error('DB down'));

    await bus.emit({
      event: 'ev',
      payload: { userId: 'user1' },
      source: 'test',
      timestamp: Date.now(),
    });
  });
});
