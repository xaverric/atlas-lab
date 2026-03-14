import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as searchController from '../controllers/searchController.js';
import * as aiSearchController from '../controllers/aiSearchController.js';

const router = Router();

const searchSchema = z.object({
  query: z.string().min(1),
  folderId: objectIdSchema.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const aiSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

router.post('/', auth, validate(searchSchema), searchController.search);
router.post('/ai', auth, validate(aiSearchSchema), aiSearchController.aiSearch);

export default router;
