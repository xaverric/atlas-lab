import type { RequestHandler } from 'express';
import { resolveOwner } from '@atlas/server-common';
import * as folderService from '../services/folderService.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.create(req.body.name, req.auth.sub, req.body.parentId);
    res.status(201).json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const parentId = (req.query.parentId as string) || null;
    const folders = await folderService.listByParent(ownerId, parentId, isAdmin);

    const parentPublic = parentId
      ? await folderService.isPublicFolder(parentId)
      : false;

    const enriched = folders.map((f: any) => {
      const json = f.toJSON ? f.toJSON() : f;
      const effectivePublic = json.isPublic || parentPublic;
      return {
        ...json,
        effectivePublic,
        ...(effectivePublic && !json.isPublic ? { publicInherited: true } : {}),
      };
    });

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const folder = await folderService.getById(req.params.id as string, ownerId, isAdmin);
    const effectivePublic = await folderService.isPublicFolder(req.params.id as string);
    const data = {
      ...folder,
      effectivePublic,
      ...(effectivePublic && !folder.isPublic ? { publicInherited: true } : {}),
    };
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const folder = await folderService.update(req.params.id as string, ownerId, req.body, isAdmin);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await folderService.remove(req.params.id as string, ownerId, isAdmin);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const getMetadata: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const metadata = await folderService.getMetadata(req.params.id as string, ownerId, isAdmin);
    res.json({ data: metadata });
  } catch (err) {
    next(err);
  }
};

export const setPublic: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const folder = await folderService.setPublic(req.params.id as string, req.body.isPublic, ownerId, isAdmin, req.body.publicPermission);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};
