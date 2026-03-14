import type { RequestHandler } from 'express';
import * as jobService from '../services/jobService.js';
import { triggerManual } from '../workers/scheduler.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const job = await jobService.create({ ...req.body, ownerId: req.auth.sub });
    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await jobService.list(req.auth.sub, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const job = await jobService.getById(req.params.id as string, req.auth.sub);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const job = await jobService.update(req.params.id as string, req.auth.sub, req.body);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await jobService.remove(req.params.id as string, req.auth.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const run: RequestHandler = async (req, res, next) => {
  try {
    await jobService.getById(req.params.id as string, req.auth.sub);
    await triggerManual(req.params.id as string);
    res.json({ data: { message: 'Job triggered' } });
  } catch (err) {
    next(err);
  }
};

export const toggle: RequestHandler = async (req, res, next) => {
  try {
    const job = await jobService.toggle(req.params.id as string, req.auth.sub);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
};
