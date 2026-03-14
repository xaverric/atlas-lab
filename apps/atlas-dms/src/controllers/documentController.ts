import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as documentService from '../services/documentService.js';

const resolveOwner = (req: Request) => {
  const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw new ApiError(403, 'Only admins can browse other users data');
  const ownerId = (isAdmin && queryUserId) ? queryUserId : req.auth.sub;
  return { ownerId, isAdmin };
};

export const upload: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'File is required');

    const name = req.body.name || req.file.originalname;
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const folderId = req.body.folderId || null;

    const doc = await documentService.upload({
      file: req.file,
      name,
      tags,
      ownerId: req.auth.sub,
      folderId,
    });

    res.status(201).json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const result = await documentService.list({
      ownerId,
      isAdmin,
      folderId: req.query.folderId as string | undefined,
      tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
      search: req.query.search as string | undefined,
      mimeType: req.query.mimeType as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      page: Number(req.query.page) || 1,
      limit: Math.min(Number(req.query.limit) || 20, 100),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const doc = await documentService.getById(req.params.id as string, ownerId, isAdmin);
    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const download: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const url = await documentService.getDownloadUrl(req.params.id as string, ownerId, isAdmin);
    res.json({ data: { url } });
  } catch (err) {
    next(err);
  }
};

export const preview: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const url = await documentService.getPreviewUrl(req.params.id as string, ownerId, isAdmin);
    res.json({ data: { url } });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const doc = await documentService.update(req.params.id as string, ownerId, req.body, isAdmin);
    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await documentService.remove(req.params.id as string, ownerId, isAdmin);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const bulkDelete: RequestHandler = async (req, res, next) => {
  try {
    const result = await documentService.bulkDelete(req.body.ids, req.auth.sub);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const bulkMove: RequestHandler = async (req, res, next) => {
  try {
    const result = await documentService.bulkMove(req.body.ids, req.auth.sub, req.body.folderId ?? null);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const tags: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const data = await documentService.getTags(ownerId, isAdmin);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
