import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { checkPublicPermission } from '../middleware/checkPublicPermission.js';
import * as publicController from '../controllers/publicController.js';

const router = Router();

const idParamSchema = z.object({ id: objectIdSchema });

const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

router.use(optionalAuth);

// View-level routes
router.get('/notes/:id', validate(idParamSchema, 'params'), publicController.getNote);
router.get('/folders/:id', validate(idParamSchema, 'params'), publicController.getFolder);
router.get('/folders/:id/contents', validate(idParamSchema, 'params'), publicController.listFolderContents);

// Edit-level routes
router.patch(
  '/notes/:id',
  validate(idParamSchema, 'params'),
  checkPublicPermission('edit'),
  validate(updateNoteSchema),
  publicController.updateNote,
);

export default router;
