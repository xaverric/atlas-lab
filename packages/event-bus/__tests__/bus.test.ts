import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const createMockRedis = () => {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    emit(event: string, ...args: unknown[]) {
      for (const cb of listeners[event] ?? []) cb(...args);
    },
  };
};

type MockRedisInstance = ReturnType<typeof createMockRedis>;

let pubClient: MockRedisInstance;
let subClient: MockRedisInstance;
let clientIndex: number;

vi.mock('ioredis', () => {
  class MockRedis {
    constructor() {
      const instance = clientIndex === 0 ? pubClient : subClient;
      clientIndex++;
      return instance as unknown as MockRedis;
    }
  }
  return { default: MockRedis };
});

import { createEventBus } from '../src/bus.js';

describe('createEventBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientIndex = 0;
    pubClient = createMockRedis();
    subClient = createMockRedis();
  });

  const makeConfig = () => ({ host: 'localhost', port: 6379 });

  const waitForConnect = () => new Promise(resolve => setTimeout(resolve, 0));

  it('returns object with publish, subscribe, close, isConnected', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    expect(typeof bus.publish).toBe('function');
    expect(typeof bus.subscribe).toBe('function');
    expect(typeof bus.close).toBe('function');
    expect(typeof bus.isConnected).toBe('function');
  });

  it('connects both clients and subscribes to atlas:events channel', async () => {
    createEventBus(makeConfig());
    await waitForConnect();

    expect(pubClient.connect).toHaveBeenCalled();
    expect(subClient.connect).toHaveBeenCalled();
    expect(subClient.subscribe).toHaveBeenCalledWith('atlas:events');
  });

  it('isConnected returns true after successful connect', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    expect(bus.isConnected()).toBe(true);
  });

  it('publish sends JSON envelope with event, payload, timestamp, correlationId', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    await bus.publish('user.created', { id: '123' }, 'core');

    expect(pubClient.publish).toHaveBeenCalledTimes(1);
    const [channel, raw] = (pubClient.publish as Mock).mock.calls[0];
    expect(channel).toBe('atlas:events');

    const envelope = JSON.parse(raw);
    expect(envelope.event).toBe('user.created');
    expect(envelope.payload).toEqual({ id: '123' });
    expect(envelope.source).toBe('core');
    expect(typeof envelope.timestamp).toBe('string');
    expect(typeof envelope.correlationId).toBe('string');
  });

  it('publish does nothing when not connected', async () => {
    pubClient.connect.mockRejectedValueOnce(new Error('fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    await bus.publish('test.event', {}, 'src');
    expect(pubClient.publish).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('subscribe + message delivery invokes matching handler', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    const handler = vi.fn();
    bus.subscribe('user.*', handler);

    const envelope = {
      event: 'user.created',
      payload: { id: '1' },
      source: 'core',
      timestamp: new Date().toISOString(),
      correlationId: 'abc',
    };

    subClient.emit('message', 'atlas:events', JSON.stringify(envelope));
    await waitForConnect();

    expect(handler).toHaveBeenCalledWith(envelope);
  });

  it('non-matching pattern does not invoke handler', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    const handler = vi.fn();
    bus.subscribe('doc.*', handler);

    const envelope = {
      event: 'user.created',
      payload: {},
      source: 'core',
      timestamp: new Date().toISOString(),
    };

    subClient.emit('message', 'atlas:events', JSON.stringify(envelope));
    await waitForConnect();

    expect(handler).not.toHaveBeenCalled();
  });

  it('close calls quit on both Redis clients', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    await bus.close();

    expect(subClient.unsubscribe).toHaveBeenCalledWith('atlas:events');
    expect(pubClient.quit).toHaveBeenCalled();
    expect(subClient.quit).toHaveBeenCalled();
    expect(bus.isConnected()).toBe(false);
  });

  it('error in handler does not crash the bus', async () => {
    const bus = createEventBus(makeConfig());
    await waitForConnect();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const failHandler = vi.fn().mockRejectedValue(new Error('handler boom'));
    const goodHandler = vi.fn();

    bus.subscribe('test.*', failHandler);
    bus.subscribe('test.*', goodHandler);

    const envelope = {
      event: 'test.event',
      payload: {},
      source: 'src',
      timestamp: new Date().toISOString(),
    };

    subClient.emit('message', 'atlas:events', JSON.stringify(envelope));
    await waitForConnect();

    expect(goodHandler).toHaveBeenCalledWith(envelope);
    expect(bus.isConnected()).toBe(true);

    errorSpy.mockRestore();
  });
});
