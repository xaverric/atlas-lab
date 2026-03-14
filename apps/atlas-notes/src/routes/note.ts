import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { paginationSchema, objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as noteController from '../controllers/noteController.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  folderId: objectIdSchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  folderId: objectIdSchema.nullable().optional(),
  isPublic: z.boolean().optional(),
  dmsFolderId: z.string().min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const listQuerySchema = paginationSchema.extend({
  folderId: z.string().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const idParamSchema = z.object({ id: objectIdSchema });

const attachmentSchema = z.object({
  documentId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

const attachmentParamSchema = z.object({
  id: objectIdSchema,
  docId: z.string().min(1),
});

router.use(auth);

router.post('/', validate(createSchema), noteController.create);
router.get('/', validate(listQuerySchema, 'query'), noteController.list);
router.get('/tags', noteController.tags);
router.get('/:id', validate(idParamSchema, 'params'), noteController.getById);
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateSchema), noteController.update);
router.delete('/:id', validate(idParamSchema, 'params'), noteController.remove);

router.get('/:id/attachments', validate(idParamSchema, 'params'), noteController.listAttachments);
router.post('/:id/attachments', validate(idParamSchema, 'params'), validate(attachmentSchema), noteController.addAttachment);
router.delete('/:id/attachments/:docId', validate(attachmentParamSchema, 'params'), noteController.removeAttachment);

export default router;
