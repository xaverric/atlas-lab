import { Router } from 'express';
import { z } from 'zod';
import { validate, requireRole, stripHtml } from '@atlas/server-common';
import { paginationSchema, objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as jobController from '../controllers/jobController.js';

const DANGEROUS_EXECUTORS = ['javascript'];
const safeText = z.string().transform(stripHtml);

const router = Router();

const webhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  auth: z.object({
    type: z.enum(['bearer', 'basic', 'header']),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headerName: z.string().optional(),
    headerValue: z.string().optional(),
  }).optional(),
  timeout: z.number().int().positive().optional(),
  evaluationRules: z.array(z.object({
    type: z.enum(['statusEquals', 'bodyContains', 'jsonPathEquals', 'jsonSchema']),
    value: z.unknown(),
    path: z.string().optional(),
  })).optional(),
});

const javascriptConfigSchema = z.object({
  code: z.string().min(1),
  env: z.record(z.string()).optional(),
});

const shellConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

const gitConfigSchema = z.object({
  operation: z.enum(['clone', 'pull', 'push', 'sync']),
  repoUrl: z.string().min(1),
  branch: z.string().default('main'),
  sshPrivateKey: z.string().optional(),
  workDir: z.string().optional(),
  commitMessage: z.string().optional(),
  remote: z.string().default('origin'),
});

const n8nConfigSchema = z.object({
  webhookUrl: z.string().url(),
  payload: z.record(z.unknown()).optional(),
  waitForCompletion: z.boolean().default(true),
});

const scheduleSchema = z.object({
  type: z.enum(['cron', 'once']),
  expression: z.string().optional(),
  timezone: z.string().default('UTC'),
  runAt: z.string().datetime().optional(),
}).refine(
  (s) => (s.type === 'cron' ? !!s.expression : true),
  { message: 'Cron schedule requires expression', path: ['expression'] },
).refine(
  (s) => (s.type === 'once' ? !!s.runAt : true),
  { message: 'Once schedule requires runAt', path: ['runAt'] },
);

const notificationSchema = z.object({
  trigger: z.enum(['onSuccess', 'onFailure', 'onEvaluationFailure', 'onTimeout', 'onRecovery']),
  channel: z.enum(['webhook', 'email', 'telegram']),
  config: z.record(z.unknown()),
});

const retryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(0),
  delayMs: z.number().int().min(100).default(1000),
  backoffMultiplier: z.number().min(1).max(10).default(2),
}).optional();

const createJobSchema = z.object({
  name: safeText.pipe(z.string().min(1).max(200)),
  description: safeText.pipe(z.string().max(2000)).default(''),
  executionType: z.enum(['webhook', 'javascript']),
  enabled: z.boolean().default(true),
  group: z.string().max(50).default(''),
  schedule: scheduleSchema,
  config: z.record(z.unknown()),
  timeoutMs: z.number().int().min(1000).max(600000).default(30000),
  tags: z.array(z.string().max(50)).max(20).default([]),
  retryPolicy: retryPolicySchema,
  notifications: z.array(notificationSchema).default([]),
}).superRefine((data, ctx) => {
  const configSchemas: Record<string, z.ZodType> = {
    webhook: webhookConfigSchema,
    javascript: javascriptConfigSchema,
  };

  const schema = configSchemas[data.executionType];
  const parsed = schema.safeParse(data.config);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({ ...issue, path: ['config', ...issue.path] });
    }
  }
});

const updateJobSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  group: z.string().max(50).optional(),
  schedule: scheduleSchema.optional(),
  config: z.record(z.unknown()).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  retryPolicy: retryPolicySchema,
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const listQuerySchema = paginationSchema.extend({
  executionType: z.enum(['webhook', 'javascript']).optional(),
  group: z.string().optional(),
  enabled: z.preprocess((v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }, z.boolean().optional()),
  tags: z.string().optional(),
  search: z.string().optional(),
});

const idParamSchema = z.object({ id: objectIdSchema });
const idWithNidParamSchema = z.object({ id: objectIdSchema, nid: objectIdSchema });

router.use(auth);

const requireAdminForDangerousExecutors: import('express').RequestHandler = (req, _res, next) => {
  const execType = req.body?.executionType;
  if (execType && DANGEROUS_EXECUTORS.includes(execType)) {
    const roles = req.auth?.realm_access?.roles || [];
    if (!roles.includes('admin')) {
      return next(Object.assign(new Error('Only admins can create javascript/shell/git jobs'), { status: 403 }));
    }
  }
  next();
};

router.post('/', validate(createJobSchema), requireAdminForDangerousExecutors, jobController.create);
router.get('/', validate(listQuerySchema, 'query'), jobController.list);
router.get('/:id', validate(idParamSchema, 'params'), jobController.getById);
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateJobSchema), jobController.update);
router.delete('/:id', validate(idParamSchema, 'params'), jobController.remove);
router.post('/:id/run', validate(idParamSchema, 'params'), jobController.run);
router.post('/:id/enable', validate(idParamSchema, 'params'), jobController.enable);
router.post('/:id/disable', validate(idParamSchema, 'params'), jobController.disable);
router.get('/:id/runs', validate(idParamSchema, 'params'), validate(paginationSchema, 'query'), jobController.listRuns);
router.post('/:id/notifications', validate(idParamSchema, 'params'), validate(notificationSchema), jobController.addNotification);
router.delete('/:id/notifications/:nid', validate(idWithNidParamSchema, 'params'), jobController.removeNotification);

export default router;
