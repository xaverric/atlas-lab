import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '@atlas/server-common';
import { config } from '../config/index.js';
import * as dataController from '../controllers/dataController.js';

const dataQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.string().regex(/^[\w.]+:(asc|desc)$/).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  filter: z.string().optional(),
}).strict();

const router = Router();

const publicLimiter = rateLimit({
  windowMs: config.publicRateLimit.windowMs,
  max: config.publicRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

router.use(publicLimiter);
router.get('/:name', dataController.getPublicEndpoint);
router.post('/:name/data', dataController.submitPublic);
router.get('/:name/data', validate(dataQuerySchema, 'query'), dataController.queryPublic);

export default router;
