import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as revisionService from '../services/revisionService.js';

const resolveOwner = (req: Request) => {
  const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw new ApiError(403, 'Only admins can browse other users data');
  const ownerId = (isAdmin && queryUserId) ? queryUserId : req.auth.sub;
  return { ownerId, isAdmin };
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await revisionService.listRevisions(req.params.id as string, ownerId, isAdmin, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const revision = await revisionService.getRevision(req.params.id as string, req.params.revId as string, ownerId, isAdmin);
    res.json({ data: revision });
  } catch (err) {
    next(err);
  }
};

export const restore: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const editorId = req.auth.sub;
    const editorName = (req.auth as any).name || 'Unknown';
    const note = await revisionService.restore(req.params.id as string, req.params.revId as string, ownerId, editorId, editorName, isAdmin);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
};
