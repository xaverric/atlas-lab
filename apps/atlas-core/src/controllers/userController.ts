import type { RequestHandler } from 'express';
import * as userService from '../services/userService.js';

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.findOrCreateFromToken(req.auth);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};

export const updatePreferences: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.updatePreferences(req.auth.sub, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};
