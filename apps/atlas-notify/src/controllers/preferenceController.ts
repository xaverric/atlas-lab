import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import { resolveOwner } from '@atlas/server-common';
import * as preferenceService from '../services/preferenceService.js';


export const listRules: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId: userId, isAdmin } = resolveOwner(req);
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
