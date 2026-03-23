import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { requireRole, validate } from '@atlas/server-common';
import * as auditController from '../controllers/auditController.js';

const auditQuerySchema = z.object({
  service: z.string().max(64).optional(),
  action: z.string().max(64).optional(),
  category: z.string().max(64).optional(),
  userId: z.string().max(128).optional(),
  status: z.string().max(32).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.string().regex(/^\w+:(asc|desc)$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();

const router = Router();

router.use(auth);
router.use(requireRole('admin'));
router.get('/events', validate(auditQuerySchema, 'query'), auditController.getEvents);

export default router;
