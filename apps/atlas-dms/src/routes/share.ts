import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as shareController from '../controllers/shareController.js';

const router = Router();

const createSchema = z.object({
  documentId: objectIdSchema.optional(),
  folderId: objectIdSchema.optional(),
  type: z.enum(['document', 'folder']).default('document'),
  expiresInHours: z.number().min(1).max(8760).default(24),
  maxDownloads: z.number().min(0).default(0),
  password: z.string().min(1).optional(),
}).refine(
  (d) => (d.type === 'document' && d.documentId) || (d.type === 'folder' && d.folderId),
  { message: 'documentId required for document shares, folderId required for folder shares' },
);

const verifySchema = z.object({
  password: z.string().min(1),
});

router.post('/', auth, validate(createSchema), shareController.create);
router.get('/:token', shareController.resolve);
router.post('/:token/verify', validate(verifySchema), shareController.verify);
router.delete('/:id', auth, shareController.revoke);

export default router;
