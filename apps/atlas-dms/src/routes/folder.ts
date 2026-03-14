import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as folderController from '../controllers/folderController.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: objectIdSchema.nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: objectIdSchema.nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const idParamSchema = z.object({ id: objectIdSchema });

const listQuerySchema = z.object({
  parentId: objectIdSchema.optional(),
});

router.use(auth);

router.post('/', validate(createSchema), folderController.create);
router.get('/', validate(listQuerySchema, 'query'), folderController.list);
router.get('/:id', validate(idParamSchema, 'params'), folderController.getById);
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateSchema), folderController.update);
router.delete('/:id', validate(idParamSchema, 'params'), folderController.remove);

export default router;
