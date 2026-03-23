import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/channelDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByUser: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  deleteByQuery: vi.fn(),
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    telegram: { botUsername: 'TestBot' },
  },
}));

import * as channelService from '../../src/services/channelService.js';
import * as channelDao from '../../src/daos/channelDao.js';

beforeEach(() => vi.clearAllMocks());

describe('channelService', () => {
  describe('create', () => {
    it('creates a channel with given data', async () => {
      vi.mocked(channelDao.create).mockResolvedValue({ _id: 'ch1', type: 'email' } as any);

      const result = await channelService.create('user1', { type: 'email', label: 'Work Email', config: { address: 'a@b.c' } });

      expect(channelDao.create).toHaveBeenCalledWith({
        userId: 'user1',
        type: 'email',
        label: 'Work Email',
        config: { address: 'a@b.c' },
        verified: false,
        enabled: true,
      });
      expect(result).toEqual({ _id: 'ch1', type: 'email' });
    });

    it('auto-verifies in_app channels', async () => {
      vi.mocked(channelDao.create).mockResolvedValue({} as any);

      await channelService.create('user1', { type: 'in_app' });

      expect(channelDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ verified: true }),
      );
    });

    it('auto-verifies web_push channels', async () => {
      vi.mocked(channelDao.create).mockResolvedValue({} as any);

      await channelService.create('user1', { type: 'web_push' });

      expect(channelDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ verified: true }),
      );
    });

    it('uses type as default label', async () => {
      vi.mocked(channelDao.create).mockResolvedValue({} as any);

      await channelService.create('user1', { type: 'telegram' });

      expect(channelDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'telegram' }),
      );
    });
  });

  describe('list', () => {
    it('delegates to channelDao.findByUser', async () => {
      const channels = [{ type: 'in_app' }];
      vi.mocked(channelDao.findByUser).mockResolvedValue(channels as any);

      const result = await channelService.list('user1');

      expect(channelDao.findByUser).toHaveBeenCalledWith('user1');
      expect(result).toEqual(channels);
    });
  });

  describe('verify', () => {
    it('verifies channel with correct code', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({
        userId: 'user1',
        verified: false,
        verificationCode: '123456',
        verificationExpiresAt: new Date(Date.now() + 60000),
      } as any);
      vi.mocked(channelDao.updateById).mockResolvedValue({ verified: true } as any);

      await channelService.verify('ch1', 'user1', '123456');

      expect(channelDao.updateById).toHaveBeenCalledWith('ch1', {
        verified: true,
        verificationCode: undefined,
        verificationExpiresAt: undefined,
      });
    });

    it('throws 404 when channel not found', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue(null);

      await expect(channelService.verify('ch1', 'user1', '123')).rejects.toThrow('Channel not found');
    });

    it('throws 404 when userId mismatch', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({ userId: 'other' } as any);

      await expect(channelService.verify('ch1', 'user1', '123')).rejects.toThrow('Channel not found');
    });

    it('throws 400 when already verified', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({
        userId: 'user1',
        verified: true,
      } as any);

      await expect(channelService.verify('ch1', 'user1', '123')).rejects.toThrow('Already verified');
    });

    it('throws 400 when code is invalid', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({
        userId: 'user1',
        verified: false,
        verificationCode: '999999',
      } as any);

      await expect(channelService.verify('ch1', 'user1', '000000')).rejects.toThrow('Invalid code');
    });

    it('throws 400 when code is expired', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({
        userId: 'user1',
        verified: false,
        verificationCode: '123456',
        verificationExpiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(channelService.verify('ch1', 'user1', '123456')).rejects.toThrow('Code expired');
    });
  });

  describe('enable', () => {
    it('enables a channel', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({ userId: 'user1' } as any);
      vi.mocked(channelDao.updateById).mockResolvedValue({} as any);

      await channelService.enable('ch1', 'user1', true);

      expect(channelDao.updateById).toHaveBeenCalledWith('ch1', { enabled: true });
    });

    it('throws 404 for wrong user', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({ userId: 'other' } as any);

      await expect(channelService.enable('ch1', 'user1', true)).rejects.toThrow('Channel not found');
    });
  });

  describe('remove', () => {
    it('deletes channel for correct user', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({ userId: 'user1' } as any);
      vi.mocked(channelDao.deleteById).mockResolvedValue({} as any);

      await channelService.remove('ch1', 'user1');

      expect(channelDao.deleteById).toHaveBeenCalledWith('ch1');
    });

    it('throws 404 when not found', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue(null);

      await expect(channelService.remove('ch1', 'user1')).rejects.toThrow('Channel not found');
    });
  });

  describe('update', () => {
    it('updates allowed fields only', async () => {
      vi.mocked(channelDao.findById).mockResolvedValue({ userId: 'user1' } as any);
      vi.mocked(channelDao.updateById).mockResolvedValue({} as any);

      await channelService.update('ch1', 'user1', { label: 'New', config: { x: 1 }, enabled: false, userId: 'hacker' });

      expect(channelDao.updateById).toHaveBeenCalledWith('ch1', {
        label: 'New',
        config: { x: 1 },
        enabled: false,
      });
    });
  });

  describe('removePushSubscription', () => {
    it('delegates to channelDao.deleteByQuery', async () => {
      vi.mocked(channelDao.deleteByQuery).mockResolvedValue({} as any);

      await channelService.removePushSubscription('user1', 'https://endpoint');

      expect(channelDao.deleteByQuery).toHaveBeenCalledWith({
        userId: 'user1',
        type: 'web_push',
        'config.subscription.endpoint': 'https://endpoint',
      });
    });
  });
});
