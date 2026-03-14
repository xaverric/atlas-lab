import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as preferenceService from '../services/preferenceService.js';

const resolveOwner = (req: Request) => {
  const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw new ApiError(403, 'Only admins can browse other users data');
  const userId = (isAdmin && queryUserId) ? queryUserId : req.auth.sub;
  return { userId, isAdmin };
};

export const listRules: RequestHandler = async (req, res, next) => {
  try {
    const { userId, isAdmin } = resolveOwner(req);
    const rules = await preferenceService.listRules(userId, isAdmin);
    res.json({ data: rules });
  } catch (err) { next(err); }
};

export const createRule: RequestHandler = async (req, res, next) => {
  try {
    const rule = await preferenceService.createRule(req.auth.sub, req.body);
    res.status(201).json({ data: rule });
  } catch (err) { next(err); }
};

export const updateRule: RequestHandler = async (req, res, next) => {
  try {
    const rule = await preferenceService.updateRule(req.params.id as string, req.auth.sub, req.body);
    res.json({ data: rule });
  } catch (err) { next(err); }
};

export const deleteRule: RequestHandler = async (req, res, next) => {
  try {
    await preferenceService.deleteRule(req.params.id as string, req.auth.sub);
    res.status(204).end();
  } catch (err) { next(err); }
};
