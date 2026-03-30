import { describe, it, expect, vi } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn(), remove: vi.fn(), close: vi.fn(),
    upsertJobScheduler: vi.fn(), getJob: vi.fn(), removeJobScheduler: vi.fn(),
  })),
  Worker: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
}));

import { getExecutor } from '../../src/executors/index.js';

describe('executor registry', () => {
  it('returns webhook executor', () => {
    const executor = getExecutor('webhook');
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
  });

  it('returns javascript executor', () => {
    const executor = getExecutor('javascript');
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
  });

  it('returns shell executor', () => {
    const executor = getExecutor('shell');
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
  });

  it('returns git executor', () => {
    const executor = getExecutor('git');
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
  });

  it('returns n8n executor', () => {
    const executor = getExecutor('n8n');
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
  });

  it('throws for unknown executor type', () => {
    expect(() => getExecutor('unknown')).toThrow('Unknown executor type: unknown');
  });

  it('error message lists allowed types', () => {
    expect(() => getExecutor('unknown')).toThrow('Allowed: webhook, javascript, shell, git, n8n');
  });
});
