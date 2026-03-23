import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let sseManager: typeof import('../../src/services/sseManager.js');

beforeEach(async () => {
  vi.useFakeTimers();
  // Fresh module for each test to reset internal state
  vi.resetModules();
  sseManager = await import('../../src/services/sseManager.js');
});

afterEach(() => {
  vi.useRealTimers();
});

const createMockRes = () => ({
  write: vi.fn(),
  on: vi.fn(),
});

describe('sseManager', () => {
  describe('addClient / removeClient', () => {
    it('adds a client and increments connected count', () => {
      const res = createMockRes() as any;
      sseManager.addClient('user1', res);
      expect(sseManager.getConnectedCount()).toBe(1);
    });

    it('supports multiple clients per user', () => {
      const res1 = createMockRes() as any;
      const res2 = createMockRes() as any;
      sseManager.addClient('user1', res1);
      sseManager.addClient('user1', res2);
      expect(sseManager.getConnectedCount()).toBe(2);
    });

    it('supports multiple users', () => {
      sseManager.addClient('user1', createMockRes() as any);
      sseManager.addClient('user2', createMockRes() as any);
      expect(sseManager.getConnectedCount()).toBe(2);
    });

    it('removes a specific client', () => {
      const res1 = createMockRes() as any;
      const res2 = createMockRes() as any;
      sseManager.addClient('user1', res1);
      sseManager.addClient('user1', res2);

      sseManager.removeClient('user1', res1);
      expect(sseManager.getConnectedCount()).toBe(1);
    });

    it('cleans up user entry when last client removed', () => {
      const res = createMockRes() as any;
      sseManager.addClient('user1', res);
      sseManager.removeClient('user1', res);
      expect(sseManager.getConnectedCount()).toBe(0);
    });

    it('no-ops when removing from unknown user', () => {
      sseManager.removeClient('unknown', createMockRes() as any);
      expect(sseManager.getConnectedCount()).toBe(0);
    });
  });

  describe('pushToUser', () => {
    it('writes SSE-formatted payload to all user clients', () => {
      const res1 = createMockRes() as any;
      const res2 = createMockRes() as any;
      sseManager.addClient('user1', res1);
      sseManager.addClient('user1', res2);

      sseManager.pushToUser('user1', 'notification', { id: 1 });

      const expected = `event: notification\ndata: ${JSON.stringify({ id: 1 })}\n\n`;
      expect(res1.write).toHaveBeenCalledWith(expected);
      expect(res2.write).toHaveBeenCalledWith(expected);
    });

    it('does not write to other users', () => {
      const res1 = createMockRes() as any;
      const res2 = createMockRes() as any;
      sseManager.addClient('user1', res1);
      sseManager.addClient('user2', res2);

      sseManager.pushToUser('user1', 'test', {});

      expect(res1.write).toHaveBeenCalled();
      expect(res2.write).not.toHaveBeenCalled();
    });

    it('no-ops when user has no connections', () => {
      // Should not throw
      sseManager.pushToUser('nobody', 'test', { data: true });
    });
  });

  describe('heartbeat', () => {
    it('sends keepalive on interval when clients connected', () => {
      const res = createMockRes() as any;
      sseManager.addClient('user1', res);

      vi.advanceTimersByTime(30000);

      expect(res.write).toHaveBeenCalledWith(': keepalive\n\n');
    });

    it('stops heartbeat when all clients removed', () => {
      const res = createMockRes() as any;
      sseManager.addClient('user1', res);
      sseManager.removeClient('user1', res);

      vi.advanceTimersByTime(30000);

      // write should not have been called (no pushToUser, no keepalive)
      expect(res.write).not.toHaveBeenCalled();
    });
  });

  describe('getConnectedCount', () => {
    it('returns 0 when no clients', () => {
      expect(sseManager.getConnectedCount()).toBe(0);
    });
  });
});
