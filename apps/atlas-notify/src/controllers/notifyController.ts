import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import * as notifyService from '../services/notifyService.js';

const resolveOwner = (req: Request) => {
  const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw new ApiError(403, 'Only admins can browse other users data');
  const userId = (isAdmin && queryUserId) ? queryUserId : req.auth.sub;
  return { userId, isAdmin };
};

export const send: RequestHandler = async (req, res, next) => {
  try {
    const { userId, templateKey, variables } = req.body;
    await notifyService.send(userId, templateKey, variables);
    res.json({ data: { message: 'Notification queued' } });
  } catch (err) { next(err); }
};

export const history: RequestHandler = async (req, res, next) => {
  try {
    const { userId, isAdmin } = resolveOwner(req);
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await notifyService.history(userId, page, limit, isAdmin);
    res.json(result);
  } catch (err) { next(err); }
};

export const markRead: RequestHandler = async (req, res, next) => {
  try {
    const notification = await notifyService.markRead(req.params.id as string, req.auth.sub);
    res.json({ data: notification });
  } catch (err) { next(err); }
};

export const markAllRead: RequestHandler = async (req, res, next) => {
  try {
    await notifyService.markAllRead(req.auth.sub);
    res.json({ data: { message: 'All marked as read' } });
  } catch (err) { next(err); }
};

export const unreadCount: RequestHandler = async (req, res, next) => {
  try {
    const count = await notifyService.unreadCount(req.auth.sub);
    res.json({ data: { count } });
  } catch (err) { next(err); }
};
