import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import { resolveOwner } from '@atlas/server-common';
import * as noteFolderService from '../services/noteFolderService.js';


export const create: RequestHandler = async (req, res, next) => {
  try {
    const folder = await noteFolderService.create(req.body.name, req.auth.sub, req.body.parentId);
    res.status(201).json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const parentId = (req.query.parentId as string) || null;
    const folders = await noteFolderService.listWithCounts(ownerId, parentId, isAdmin);
    res.json({ data: folders });
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const folder = await noteFolderService.getById(req.params.id as string, ownerId, isAdmin);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const getMetadata: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const meta = await noteFolderService.getMetadata(req.params.id as string, ownerId, isAdmin);
    res.json({ data: meta });
  } catch (err) { next(err); }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const folder = await noteFolderService.update(req.params.id as string, ownerId, req.body, isAdmin);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await noteFolderService.remove(req.params.id as string, ownerId, isAdmin);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
