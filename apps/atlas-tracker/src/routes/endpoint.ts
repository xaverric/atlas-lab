import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '@atlas/server-common';
import * as endpointController from '../controllers/endpointController.js';

const router = Router();

const createEndpointSchema = z.object({
  name: z.string().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Must be a URL-friendly slug'),
  displayName: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.unknown()),
    required: z.array(z.string()).optional(),
  }).passthrough(),
  indexes: z.array(z.object({
    fields: z.record(z.unknown()),
    options: z.record(z.unknown()).optional(),
  })).optional(),
  retentionDays: z.number().int().positive().optional(),
});

const updateEndpointSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  schema: z.object({
    type: z.literal('object'),
    properties: z.record(z.unknown()),
    required: z.array(z.string()).optional(),
  }).passthrough().optional(),
  retentionDays: z.number().int().positive().nullable().optional(),
});

router.use(auth);
router.post('/', validate(createEndpointSchema), endpointController.create);
router.get('/', endpointController.list);
router.get('/:name', endpointController.getByName);
router.put('/:name', validate(updateEndpointSchema), endpointController.update);
router.delete('/:name', endpointController.remove);

export default router;
