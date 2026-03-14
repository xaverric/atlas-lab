import type { EventBus } from '@atlas/event-bus';
import type { RunLogger } from '../executors/types.js';

interface NotificationRule {
  trigger: string;
  channel: string;
  config: Record<string, unknown>;
}

interface NotifyParams {
  notifications: NotificationRule[];
  runStatus: string;
  previousRunStatus?: string | null;
  hasEvaluationFailures: boolean;
  jobName: string;
  jobId: string;
  runId: string;
  ownerId: string;
  duration?: number;
  error?: string;
  failures?: unknown[];
  logger: RunLogger;
  eventBus: EventBus | null;
}

const EVENT_MAP: Record<string, string> = {
  onSuccess: 'scheduler.job.completed',
  onFailure: 'scheduler.job.failed',
  onTimeout: 'scheduler.job.timeout',
  onRecovery: 'scheduler.job.recovered',
  onEvaluationFailure: 'scheduler.job.evaluation_failed',
};

const shouldTrigger = (
  trigger: string,
  runStatus: string,
  previousRunStatus: string | null | undefined,
  hasEvaluationFailures: boolean,
): boolean => {
  switch (trigger) {
    case 'onSuccess': return runStatus === 'completed';
    case 'onFailure': return runStatus === 'failed';
    case 'onTimeout': return runStatus === 'timeout';
    case 'onEvaluationFailure': return hasEvaluationFailures;
    case 'onRecovery': return runStatus === 'completed' && (previousRunStatus === 'failed' || previousRunStatus === 'timeout');
    default: return false;
  }
};

const sendWebhookNotification = async (notifConfig: Record<string, unknown>, payload: Record<string, unknown>) => {
  const url = notifConfig.url as string;
  if (!url) return;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

export const evaluateNotifications = async (params: NotifyParams) => {
  const {
    notifications, runStatus, previousRunStatus, hasEvaluationFailures,
    jobName, jobId, runId, ownerId, duration, error, failures,
    logger, eventBus,
  } = params;

  const triggeredEvents = new Set<string>();

  for (const notification of notifications) {
    if (!shouldTrigger(notification.trigger, runStatus, previousRunStatus, hasEvaluationFailures)) {
      continue;
    }

    try {
      if (notification.channel === 'webhook') {
        const payload = {
          event: notification.trigger,
          job: { id: jobId, name: jobName },
          run: { id: runId, status: runStatus },
          timestamp: new Date().toISOString(),
        };
        await sendWebhookNotification(notification.config, payload);
      } else {
        const eventName = EVENT_MAP[notification.trigger] || `scheduler.${notification.trigger}`;
        if (!triggeredEvents.has(eventName) && eventBus) {
          triggeredEvents.add(eventName);
          await eventBus.publish(eventName, {
            userId: ownerId,
            jobId,
            jobName,
            runId,
            duration,
            error,
            failures,
          }, 'atlas-scheduler');
        }
      }
      logger.info(`Notification sent: ${notification.trigger} via ${notification.channel}`);
    } catch (err) {
      logger.error(`Notification failed: ${notification.trigger} via ${notification.channel} - ${err}`);
    }
  }
};
