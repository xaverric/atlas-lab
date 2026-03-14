import type { RequestHandler } from 'express';
import * as templateService from '../services/templateService.js';

export const list: RequestHandler = async (_req, res, next) => {
  try {
    const templates = await templateService.list();
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const template = await templateService.create(req.body);
    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const template = await templateService.update(req.params.id as string, req.body);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await templateService.remove(req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
