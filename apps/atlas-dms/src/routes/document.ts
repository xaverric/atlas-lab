import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { validate } from '@atlas/server-common';
import { paginationSchema, objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as documentController from '../controllers/documentController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const router = Router();

const listQuerySchema = paginationSchema.extend({
  folderId: z.string().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  mimeType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['name', 'size', 'createdAt', 'mimeType']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const idParamSchema = z.object({ id: objectIdSchema });

const updateBodySchema = z.object({
  name: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const bulkDeleteSchema = z.object({
  ids: z.array(objectIdSchema).min(1).max(100),
});

const bulkMoveSchema = z.object({
  ids: z.array(objectIdSchema).min(1).max(100),
  folderId: z.string().nullable(),
});

router.use(auth);

router.post('/', upload.single('file'), documentController.upload);
router.get('/', validate(listQuerySchema, 'query'), documentController.list);
router.get('/tags', documentController.tags);
router.post('/bulk-delete', validate(bulkDeleteSchema), documentController.bulkDelete);
router.post('/bulk-move', validate(bulkMoveSchema), documentController.bulkMove);
router.get('/:id', validate(idParamSchema, 'params'), documentController.getById);
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateBodySchema), documentController.update);
router.delete('/:id', validate(idParamSchema, 'params'), documentController.remove);
router.get('/:id/download', validate(idParamSchema, 'params'), documentController.download);
router.get('/:id/preview', validate(idParamSchema, 'params'), documentController.preview);

export default router;
