import type { RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as folderService from '../services/folderService.js';
import * as documentDao from '../daos/documentDao.js';
import * as folderDao from '../daos/folderDao.js';
import type { PublicPermission } from '../services/folderService.js';

const PERMISSION_RANK: Record<PublicPermission, number> = {
  view: 0,
  edit: 1,
  full: 2,
};

const resolveFolderId = (req: any): string | null =>
  req.params.folderId || req.body?.folderId || req.body?.parentId || req.query?.folderId || null;

export const checkPublicPermission = (required: PublicPermission): RequestHandler =>
  async (req, _res, next) => {
    try {
      let folderId = resolveFolderId(req);

      if (!folderId && req.params.id) {
        const id = req.params.id as string;
        const doc = await documentDao.findById(id);
        if (doc?.folderId) {
          folderId = doc.folderId.toString();
        } else {
          const folder = await folderDao.findById(id);
          if (folder) {
            folderId = folder.parentId?.toString() || folder._id.toString();
          }
        }
      }

      if (!folderId) throw new ApiError(400, 'Cannot determine folder context');

      const permission = await folderService.resolvePublicPermission(folderId);
      if (!permission) throw new ApiError(403, 'Folder is not public');

      if (PERMISSION_RANK[permission] < PERMISSION_RANK[required]) {
        throw new ApiError(403, `Public permission '${permission}' is insufficient, '${required}' required`);
      }

      (req as any).publicPermission = permission;
      (req as any).publicFolderId = folderId;
      next();
    } catch (err) {
      next(err);
    }
  };
