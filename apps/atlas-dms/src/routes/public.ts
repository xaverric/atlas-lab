import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { checkPublicPermission } from '../middleware/checkPublicPermission.js';
import * as publicController from '../controllers/publicController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const router = Router();

const idParamSchema = z.object({ id: objectIdSchema });

const updateDocumentSchema = z.object({
  name: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const renameFolderSchema = z.object({
  name: z.string().min(1).max(255),
});

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: objectIdSchema,
});

const mountRoutes = (prefix: string) => {
  // View-level routes (default for any public folder)
  router.get(`/${prefix}/folders/:id`, validate(idParamSchema, 'params'), publicController.getFolder);
  router.get(`/${prefix}/folders/:id/tree`, validate(idParamSchema, 'params'), publicController.getFolderTree);
  router.get(`/${prefix}/documents/:id/download`, validate(idParamSchema, 'params'), publicController.downloadDocument);
  router.get(`/${prefix}/documents/:id/preview`, validate(idParamSchema, 'params'), publicController.previewDocument);

  // Edit-level routes
  router.patch(
    `/${prefix}/documents/:id`,
    validate(idParamSchema, 'params'),
    checkPublicPermission('edit'),
    validate(updateDocumentSchema),
    publicController.updateDocument,
  );
  router.patch(
    `/${prefix}/folders/:id`,
    validate(idParamSchema, 'params'),
    checkPublicPermission('edit'),
    validate(renameFolderSchema),
    publicController.renameFolder,
  );

  // Full-level routes
  router.post(
    `/${prefix}/documents`,
    upload.single('file'),
    checkPublicPermission('full'),
    publicController.uploadDocument,
  );
  router.delete(
    `/${prefix}/documents/:id`,
    validate(idParamSchema, 'params'),
    checkPublicPermission('full'),
    publicController.deleteDocument,
  );
  router.post(
    `/${prefix}/folders`,
    checkPublicPermission('full'),
    validate(createFolderSchema),
    publicController.createFolder,
  );
  router.delete(
    `/${prefix}/folders/:id`,
    validate(idParamSchema, 'params'),
    checkPublicPermission('full'),
    publicController.deleteFolder,
  );
};

// Mount under both /files/* (new prefix) and /dms/* (backward compat)
mountRoutes('files');
mountRoutes('dms');

// Path resolution under both prefixes
router.get('/files/path/*', publicController.resolveByPath);
router.get('/dms/path/*', publicController.resolveByPath);

export default router;
