import type { RequestHandler } from 'express';
import * as executionService from '../services/executionService.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const jobId = req.query.jobId as string;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await executionService.list(jobId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const execution = await executionService.getById(req.params.id as string);
    res.json({ data: execution });
  } catch (err) {
    next(err);
  }
};
