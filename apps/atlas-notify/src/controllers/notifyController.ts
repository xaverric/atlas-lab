import type { RequestHandler } from 'express';
import * as notifyService from '../services/notifyService.js';

export const send: RequestHandler = async (req, res, next) => {
  try {
    const { userId, templateKey, variables } = req.body;
    await notifyService.send(userId, templateKey, variables);
    res.json({ data: { message: 'Notification queued' } });
  } catch (err) {
    next(err);
  }
};

export const history: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await notifyService.history(req.auth.sub, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
