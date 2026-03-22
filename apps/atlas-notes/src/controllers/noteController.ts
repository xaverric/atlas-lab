import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import { resolveOwner } from '@atlas/server-common';
import * as noteService from '../services/noteService.js';


export const create: RequestHandler = async (req, res, next) => {
  try {
    const note = await noteService.create({ ...req.body, ownerId: req.auth.sub });
    res.status(201).json({ data: note });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const ownerName = (req as any).auth?.name || (req as any).auth?.preferred_username || 'Unknown';
    const result = await noteService.list({
      ownerId,
      isAdmin,
      ownerName,
      folderId: req.query.folderId as string | undefined,
      tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
      search: req.query.search as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      page: Number(req.query.page) || 1,
      limit: Math.min(Number(req.query.limit) || 20, 100),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const note = await noteService.getById(req.params.id as string, ownerId, isAdmin);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const editorId = req.auth.sub;
    const editorName = (req.auth as any).name || 'Unknown';
    const note = await noteService.update(req.params.id as string, ownerId, req.body, isAdmin, editorId, editorName);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    await noteService.remove(req.params.id as string, ownerId, isAdmin);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const tags: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const data = await noteService.getTags(ownerId, isAdmin);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const addAttachment: RequestHandler = async (req, res, next) => {
  try {
    const note = await noteService.addAttachment(req.params.id as string, req.auth.sub, req.body);
    res.status(201).json({ data: note });
  } catch (err) {
    next(err);
  }
};

export const removeAttachment: RequestHandler = async (req, res, next) => {
  try {
    const note = await noteService.removeAttachment(req.params.id as string, req.auth.sub, req.params.docId as string);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
};

export const listAttachments: RequestHandler = async (req, res, next) => {
  try {
    const data = await noteService.listAttachments(req.params.id as string, req.auth.sub);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
