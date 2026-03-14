import type { RequestHandler } from 'express';
import * as runService from '../services/runService.js';

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
    const run = await runService.getById(req.params.id as string, req.auth.sub, isAdmin);
    res.json({ data: run });
  } catch (err) {
    next(err);
  }
};
