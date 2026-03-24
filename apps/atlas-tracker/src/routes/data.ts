import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate, apiRateLimiter } from '@atlas/server-common';
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

router.use(auth);
router.use(apiRateLimiter);
router.post('/:name/data', dataController.submit);
router.get('/:name/data', validate(dataQuerySchema, 'query'), dataController.query);
router.delete('/:name/data/:id', dataController.deleteEntry);

export default router;
