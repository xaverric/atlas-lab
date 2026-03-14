import type { RequestHandler } from 'express';
import * as folderService from '../services/folderService.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.create(req.body.name, req.auth.sub, req.body.parentId);
    res.status(201).json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const parentId = (req.query.parentId as string) || null;
    const folders = await folderService.listByParent(req.auth.sub, parentId);
    res.json({ data: folders });
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.getById(req.params.id as string, req.auth.sub);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.update(req.params.id as string, req.auth.sub, req.body);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await folderService.remove(req.params.id as string, req.auth.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
