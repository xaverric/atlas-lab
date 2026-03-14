import type { RequestHandler } from 'express';
import * as auditService from '../services/auditService.js';

export const getEvents: RequestHandler = async (req, res, next) => {
  try {
    const result = await auditService.queryEvents({
      service: req.query.service as string,
      action: req.query.action as string,
      category: req.query.category as string,
      userId: req.query.userId as string,
      from: req.query.from as string,
      to: req.query.to as string,
      status: req.query.status as string,
      sort: (req.query.sort as string) || 'timestamp:desc',
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json({ data: result.data, total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    next(err);
  }
};
