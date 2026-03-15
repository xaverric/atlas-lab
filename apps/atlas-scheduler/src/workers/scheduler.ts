import { Queue, Worker } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import type { EventBus } from '@atlas/event-bus';
import { config } from '../config/index.js';
import { getExecutor } from '../executors/index.js';
import type { RunLogger, StorageAccess, ExecutionContext } from '../executors/types.js';
import * as jobRunDao from '../daos/jobRunDao.js';
import * as jobDao from '../daos/jobDao.js';
import * as jobStorageDao from '../daos/jobStorageDao.js';
import { evaluateNotifications } from './notifications.js';

let eventBus: EventBus | null = null;

export const setEventBus = (bus: EventBus | null) => { eventBus = bus; };

const connection = { host: config.redis.host, port: config.redis.port };
const queue = new Queue('atlas-scheduler', { connection });

const createRunLogger = (runId: string): RunLogger => ({
  debug: (message, meta) => jobRunDao.appendLog(runId, { level: 'debug', message, meta }),
  info: (message, meta) => jobRunDao.appendLog(runId, { level: 'info', message, meta }),
  warn: (message, meta) => jobRunDao.appendLog(runId, { level: 'warn', message, meta }),
  error: (message, meta) => jobRunDao.appendLog(runId, { level: 'error', message, meta }),
});

const createStorageAccess = (jobId: string): StorageAccess => ({
  get: (key) => jobStorageDao.get(jobId, key),
  set: async (key, value) => { await jobStorageDao.set(jobId, key, value); },
  remove: async (key) => { await jobStorageDao.remove(jobId, key); },
});

const worker = new Worker('atlas-scheduler', async (bullJob) => {
  const { jobId, triggeredBy = 'schedule' } = bullJob.data;

  const job = await jobDao.findById(jobId);
  if (!job) return;

  const run = await jobRunDao.create({
    jobId,
    status: 'running',
    startedAt: new Date(),
    triggeredBy,
    attempt: (bullJob.attemptsMade || 0) + 1,
  });

  const logger = createRunLogger(run.id);
  const storage = createStorageAccess(jobId);
  const ctx: ExecutionContext = {
    jobId,
    runId: run.id,
    logger,
    storage,
    env: (job.config as Record<string, unknown>)?.env as Record<string, string> || {},
  };

  const executor = getExecutor(job.executionType);
  const start = Date.now();

  const previousRun = await jobRunDao.getLastRun(jobId);
  const previousRunStatus = previousRun && previousRun.id !== run.id
    ? (previousRun.status as string)
    : null;

  try {
    const result = await executor.execute(
      job.config as Record<string, unknown>,
      job.timeoutMs || 30000,
      ctx,
    );

    const isTimeout = result.error?.includes('aborted') || result.error?.includes('Script execution timed out');
    const isFailed = !isTimeout && (result.error || (result.exitCode != null && result.exitCode !== 0));
    const status = isTimeout ? 'timeout' : isFailed ? 'failed' : 'completed';

    await jobRunDao.updateById(run.id, {
      status,
      finishedAt: new Date(),
      duration: Date.now() - start,
      result,
    });

    await jobDao.updateLastRun(jobId, status);

    const hasEvaluationFailures = (result.evaluationResults || []).some((r) => !r.passed);

    // Always publish event bus events for job lifecycle
    if (eventBus) {
      const eventName = status === 'completed' ? 'scheduler.job.completed'
        : status === 'timeout' ? 'scheduler.job.timeout'
        : 'scheduler.job.failed';
      await eventBus.publish(eventName, {
        userId: job.ownerId as string,
        jobId,
        jobName: job.name,
        runId: run.id,
        duration: Date.now() - start,
        status,
        error: result.error,
      }, 'atlas-scheduler').catch(() => {});
    }

    const notifications = (job.notifications || []) as Array<{ trigger: string; channel: string; config: Record<string, unknown> }>;
    if (notifications.length > 0) {
      await evaluateNotifications({
        notifications,
        runStatus: status,
        previousRunStatus,
        hasEvaluationFailures,
        jobName: job.name,
        jobId,
        runId: run.id,
        ownerId: job.ownerId as string,
        duration: Date.now() - start,
        error: result.error as string | undefined,
        failures: (result.evaluationResults || []).filter((r) => !r.passed),
        logger,
        eventBus,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('timed out') ? 'timeout' : 'failed';

    await jobRunDao.updateById(run.id, {
      status,
      finishedAt: new Date(),
      duration: Date.now() - start,
      result: { error: message },
    });

    await jobDao.updateLastRun(jobId, status);

    if (eventBus) {
      const eventName = status === 'timeout' ? 'scheduler.job.timeout' : 'scheduler.job.failed';
      await eventBus.publish(eventName, {
        userId: job.ownerId as string,
        jobId,
        jobName: job.name,
        runId: run.id,
        duration: Date.now() - start,
        status,
        error: message,
      }, 'atlas-scheduler').catch(() => {});
    }
  }

  // Compute next run
  const schedule = (job.schedule as { type: string; expression?: string; timezone?: string }) || {};
  if (schedule.type === 'cron' && schedule.expression) {
    try {
      const expr = CronExpressionParser.parse(schedule.expression, { tz: schedule.timezone || 'UTC' });
      await jobDao.updateNextRun(jobId, expr.next().toDate());
    } catch { /* invalid cron */ }
  } else if (schedule.type === 'once') {
    await jobDao.updateNextRun(jobId, null);
  }

  // Prune old runs
  await jobRunDao.pruneOldRuns(jobId, config.maxRunsPerJob);
}, {
  connection,
  concurrency: 5,
});

export const scheduleJob = async (job: Record<string, unknown>) => {
  const id = String(job._id || job.id);
  const schedule = job.schedule as { type?: string; expression?: string; runAt?: string } | undefined;

  if (!schedule) return;

  const retryPolicy = job.retryPolicy as { maxRetries?: number; delayMs?: number; backoffMultiplier?: number } | undefined;
  const attempts = (retryPolicy?.maxRetries || 0) + 1;
  const backoff = retryPolicy?.maxRetries
    ? { type: 'exponential' as const, delay: retryPolicy.delayMs || 1000 }
    : undefined;

  if (schedule.type === 'cron' && schedule.expression) {
    await queue.upsertJobScheduler(`job-${id}`, { pattern: schedule.expression }, {
      name: `job-${id}`,
      data: { jobId: id, triggeredBy: 'schedule' },
      opts: { attempts, backoff },
    });
    return;
  }

  if (schedule.type === 'once' && schedule.runAt) {
    const delay = Math.max(0, new Date(schedule.runAt).getTime() - Date.now());
    await queue.add(`job-${id}`, { jobId: id, triggeredBy: 'schedule' }, {
      delay,
      jobId: `job-${id}`,
      attempts,
      backoff,
    });
  }
};

export const removeJob = async (id: string) => {
  try {
    await queue.removeJobScheduler(`job-${id}`);
  } catch { /* scheduler may not exist */ }

  const existing = await queue.getJob(`job-${id}`);
  if (existing) await existing.remove();
};

export const triggerManual = async (jobId: string) => {
  await queue.add(`manual-${jobId}`, { jobId, triggeredBy: 'manual' });
};

export const syncJobs = async () => {
  const jobs = await jobDao.findEnabled();
  for (const job of jobs) {
    await scheduleJob(job.toObject());
  }
  console.log(`Synced ${jobs.length} enabled jobs`);
};

export { worker };
