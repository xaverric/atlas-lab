import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as noteFolderController from '../controllers/noteFolderController.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: objectIdSchema.nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: objectIdSchema.nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
  aiAccessible: z.boolean().optional(),
  publicPermission: z.enum(['view', 'edit', 'full']).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const idParamSchema = z.object({ id: objectIdSchema });

const listQuerySchema = z.object({
  parentId: objectIdSchema.optional(),
});

router.use(auth);

router.post('/', validate(createSchema), noteFolderController.create);
router.get('/', validate(listQuerySchema, 'query'), noteFolderController.list);
router.get('/:id', validate(idParamSchema, 'params'), noteFolderController.getById);
router.get('/:id/metadata', validate(idParamSchema, 'params'), noteFolderController.getMetadata);
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateSchema), noteFolderController.update);
router.delete('/:id', validate(idParamSchema, 'params'), noteFolderController.remove);

export default router;
