import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/preferenceDao.js', () => ({
  findRulesForUser: vi.fn(),
  findMatchingRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}));

import * as preferenceService from '../../src/services/preferenceService.js';
import * as preferenceDao from '../../src/daos/preferenceDao.js';

beforeEach(() => vi.clearAllMocks());

describe('preferenceService', () => {
  describe('listRules', () => {
    it('fetches rules for user', async () => {
      const rules = [{ id: 'r1', eventPattern: '*' }];
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue(rules as any);

      const result = await preferenceService.listRules('user1');

      expect(preferenceDao.findRulesForUser).toHaveBeenCalledWith('user1', false);
      expect(result).toEqual(rules);
    });

    it('passes isAdmin flag', async () => {
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([]);

      await preferenceService.listRules('user1', true);

      expect(preferenceDao.findRulesForUser).toHaveBeenCalledWith('user1', true);
    });
  });

  describe('createRule', () => {
    it('creates rule with defaults', async () => {
      vi.mocked(preferenceDao.createRule).mockResolvedValue({ id: 'r1' } as any);

      await preferenceService.createRule('user1', {
        eventPattern: 'job.*',
        channelIds: ['ch1'],
      });

      expect(preferenceDao.createRule).toHaveBeenCalledWith({
        userId: 'user1',
        eventPattern: 'job.*',
        channelIds: ['ch1'],
        enabled: true,
      });
    });

    it('respects explicit enabled=false', async () => {
      vi.mocked(preferenceDao.createRule).mockResolvedValue({} as any);

      await preferenceService.createRule('user1', {
        eventPattern: '*',
        channelIds: ['ch1'],
        enabled: false,
      });

      expect(preferenceDao.createRule).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });
  });

  describe('updateRule', () => {
    it('updates an existing rule', async () => {
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([
        { id: 'r1' },
      ] as any);
      vi.mocked(preferenceDao.updateRule).mockResolvedValue({ id: 'r1' } as any);

      await preferenceService.updateRule('r1', 'user1', { enabled: false });

      expect(preferenceDao.updateRule).toHaveBeenCalledWith('r1', { enabled: false });
    });

    it('throws 404 when rule not found for user', async () => {
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([
        { id: 'other' },
      ] as any);

      await expect(
        preferenceService.updateRule('r1', 'user1', {}),
      ).rejects.toThrow('Rule not found');
    });

    it('throws 404 when user has no rules', async () => {
      vi.mocked(preferenceDao.findRulesForUser).mockResolvedValue([]);

      await expect(
        preferenceService.updateRule('r1', 'user1', {}),
      ).rejects.toThrow('Rule not found');
    });
  });

  describe('deleteRule', () => {
    it('deletes a rule', async () => {
      vi.mocked(preferenceDao.deleteRule).mockResolvedValue({} as any);

      await preferenceService.deleteRule('r1', 'user1');

      expect(preferenceDao.deleteRule).toHaveBeenCalledWith('r1', 'user1');
    });

    it('throws 404 when rule not found', async () => {
      vi.mocked(preferenceDao.deleteRule).mockResolvedValue(null);

      await expect(
        preferenceService.deleteRule('r1', 'user1'),
      ).rejects.toThrow('Rule not found');
    });
  });
});
