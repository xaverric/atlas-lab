import { Queue, Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getExecutor } from '../executors/index.js';
import * as executionDao from '../daos/executionDao.js';
import * as jobDao from '../daos/jobDao.js';

const connection = { host: config.redis.host, port: config.redis.port };

const queue = new Queue('atlas-scheduler', { connection });

const worker = new Worker('atlas-scheduler', async (bullJob) => {
  const { jobId, triggeredBy = 'schedule' } = bullJob.data;

  const job = await jobDao.findById(jobId);
  if (!job) return;

  const execution = await executionDao.create({
    jobId,
    status: 'running',
    startedAt: new Date(),
    triggeredBy,
  });

  const executor = getExecutor(job.type);
  const start = Date.now();

  try {
    const result = await executor.execute(
      job.config as Record<string, unknown>,
      job.timeoutMs || 30000,
    );

    const failed = result.error || (result.exitCode && result.exitCode !== 0);

    await executionDao.updateById(execution.id, {
      status: failed ? 'failed' : 'completed',
      completedAt: new Date(),
      duration: Date.now() - start,
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await executionDao.updateById(execution.id, {
      status: 'failed',
      completedAt: new Date(),
      duration: Date.now() - start,
      result: { error: message },
    });
  }
}, { connection, concurrency: 5 });

export const scheduleJob = async (job: Record<string, unknown>) => {
  const id = String(job._id || job.id);
  const opts: Record<string, unknown> = {
    jobId: `job-${id}`,
  };

  if (job.scheduleType === 'cron' && job.cron) {
    opts.repeat = { pattern: job.cron as string };
    await queue.upsertJobScheduler(`job-${id}`, { pattern: job.cron as string }, {
      name: `job-${id}`,
      data: { jobId: id, triggeredBy: 'schedule' },
    });
    return;
  }

  if (job.scheduleType === 'interval' && job.intervalMs) {
    await queue.upsertJobScheduler(`job-${id}`, { every: job.intervalMs as number }, {
      name: `job-${id}`,
      data: { jobId: id, triggeredBy: 'schedule' },
    });
    return;
  }

  if (job.scheduleType === 'once' && job.runAt) {
    const delay = Math.max(0, new Date(job.runAt as string).getTime() - Date.now());
    await queue.add(`job-${id}`, { jobId: id, triggeredBy: 'schedule' }, { delay, jobId: `job-${id}` });
  }
};

export const removeJob = async (id: string) => {
  try {
    await queue.removeJobScheduler(`job-${id}`);
  } catch {
    // scheduler may not exist
  }
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
