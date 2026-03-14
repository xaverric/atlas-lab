import type { RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as noteFolderService from '../services/noteFolderService.js';

export type PublicPermission = 'view' | 'edit' | 'full';

const PERMISSION_RANK: Record<PublicPermission, number> = {
  view: 0,
  edit: 1,
  full: 2,
};

export const resolveNotePublicPermission = async (folderId: string): Promise<PublicPermission | null> => {
  const { NoteFolder } = await import('../models/NoteFolder.js');
  let current = await NoteFolder.findById(folderId);
  while (current) {
    if (current.visibility === 'public') return (current as any).publicPermission || 'view';
    if (!current.parentId) return null;
    current = await NoteFolder.findById(current.parentId.toString());
  }
  return null;
};

export const checkPublicPermission = (required: PublicPermission): RequestHandler =>
  async (req, _res, next) => {
    try {
      const { Note } = await import('../models/Note.js');

      let folderId: string | null = null;

      // Try to resolve folder from a note
      if (req.params.id) {
        const note = await Note.findById(req.params.id);
        if (note?.folderId) {
          folderId = note.folderId.toString();
        }
      }

      if (!folderId) {
        folderId = req.body?.folderId || req.params?.folderId || null;
      }

      if (!folderId) throw new ApiError(400, 'Cannot determine folder context');

      const isPublic = await noteFolderService.isFolderPublic(folderId);
      if (!isPublic) throw new ApiError(403, 'Folder is not public');

      const permission = await resolveNotePublicPermission(folderId);
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
