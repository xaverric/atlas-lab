import type { RequestHandler } from 'express';
import * as preferenceService from '../services/preferenceService.js';

export const get: RequestHandler = async (req, res, next) => {
  try {
    const prefs = await preferenceService.get(req.auth.sub);
    res.json({ data: prefs });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const prefs = await preferenceService.update(req.auth.sub, req.body);
    res.json({ data: prefs });
  } catch (err) {
    next(err);
  }
};
