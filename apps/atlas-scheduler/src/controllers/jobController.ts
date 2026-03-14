import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as jobService from '../services/jobService.js';
import * as runService from '../services/runService.js';
import { triggerManual } from '../workers/scheduler.js';

const resolveOwner = (req: Request) => {
  const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw new ApiError(403, 'Only admins can browse other users data');
  const ownerId = (isAdmin && queryUserId) ? queryUserId : req.auth.sub;
  return { ownerId, isAdmin };
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const job = await jobService.create({ ...req.body, ownerId: req.auth.sub });
    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const result = await jobService.list(ownerId, req.query as Record<string, unknown>, isAdmin);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const job = await jobService.getById(req.params.id as string, ownerId, isAdmin);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const job = await jobService.update(req.params.id as string, ownerId, req.body, isAdmin);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await jobService.remove(req.params.id as string, ownerId, isAdmin);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const run: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await jobService.getById(req.params.id as string, ownerId, isAdmin);
    await triggerManual(req.params.id as string);
    res.json({ data: { message: 'Job triggered' } });
  } catch (err) {
    next(err);
  }
};

export const enable: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const job = await jobService.setEnabled(req.params.id as string, ownerId, true, isAdmin);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const disable: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const job = await jobService.setEnabled(req.params.id as string, ownerId, false, isAdmin);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const listRuns: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await jobService.getById(req.params.id as string, ownerId, isAdmin);
    const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
    const result = await runService.listByJobId(req.params.id as string, Number(page), Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const addNotification: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const job = await jobService.addNotification(req.params.id as string, ownerId, req.body, isAdmin);
    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const removeNotification: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const job = await jobService.removeNotification(req.params.id as string, ownerId, req.params.nid as string, isAdmin);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};
