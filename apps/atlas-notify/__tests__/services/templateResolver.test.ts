import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/templateDao.js', () => ({
  findByKey: vi.fn(),
  findByEvent: vi.fn(),
}));

import { resolve } from '../../src/services/templateResolver.js';
import * as templateDao from '../../src/daos/templateDao.js';

beforeEach(() => vi.clearAllMocks());

describe('templateResolver', () => {
  describe('resolve', () => {
    it('resolves by key when templateKey is provided', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue({
        subject: 'Hello {{name}}',
        body: 'Welcome {{name}} to {{place}}',
      } as any);

      const result = await resolve('user.created', 'welcome', { name: 'Alice', place: 'Atlas' });

      expect(templateDao.findByKey).toHaveBeenCalledWith('welcome');
      expect(result).toEqual({
        title: 'Hello Alice',
        body: 'Welcome Alice to Atlas',
      });
    });

    it('resolves by event when templateKey is undefined', async () => {
      vi.mocked(templateDao.findByEvent).mockResolvedValue({
        subject: 'Event fired',
        body: 'Details: {{info}}',
      } as any);

      const result = await resolve('job.completed', undefined, { info: 'done' });

      expect(templateDao.findByEvent).toHaveBeenCalledWith('job.completed');
      expect(result).toEqual({
        title: 'Event fired',
        body: 'Details: done',
      });
    });

    it('returns humanized fallback when no template found', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue(null);

      const result = await resolve('user.password_reset', 'user.password_reset', { token: 'abc' });

      expect(result).toEqual({
        title: 'User Password Reset',
        body: 'token: abc',
      });
    });

    it('returns event as body when no template and no variables', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue(null);

      const result = await resolve('system.ping', 'system.ping');

      expect(result).toEqual({
        title: 'System Ping',
        body: 'system.ping',
      });
    });

    it('interpolates multiple variables in placeholders', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue({
        subject: '{{action}} by {{user}}',
        body: '{{user}} performed {{action}} on {{target}}',
      } as any);

      const result = await resolve('ev', 'tpl', {
        action: 'deploy',
        user: 'Bob',
        target: 'prod',
      });

      expect(result).toEqual({
        title: 'deploy by Bob',
        body: 'Bob performed deploy on prod',
      });
    });

    it('leaves missing variable placeholders as empty strings', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue({
        subject: 'Hi {{name}}',
        body: 'Your code is {{code}}',
      } as any);

      const result = await resolve('ev', 'tpl', { name: 'Alice' });

      expect(result.title).toBe('Hi Alice');
      expect(result.body).toBe('Your code is ');
    });

    it('humanizes dot-separated event names', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue(null);

      const result = await resolve('scheduler.job.failed', 'scheduler.job.failed');

      expect(result.title).toBe('Scheduler Job Failed');
    });

    it('humanizes underscore-separated event names', async () => {
      vi.mocked(templateDao.findByKey).mockResolvedValue(null);

      const result = await resolve('user_account_locked', 'user_account_locked');

      expect(result.title).toBe('User Account Locked');
    });
  });
});
