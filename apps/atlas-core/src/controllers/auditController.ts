import type { RequestHandler } from 'express';
import * as auditService from '../services/auditService.js';

export const getEvents: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query as Record<string, unknown>;
    const result = await auditService.queryEvents({
      service: q.service as string | undefined,
      action: q.action as string | undefined,
      category: q.category as string | undefined,
      userId: q.userId as string | undefined,
      from: q.from as string | undefined,
      to: q.to as string | undefined,
      status: q.status as string | undefined,
      sort: (q.sort as string) || 'timestamp:desc',
      limit: (q.limit as number) || 50,
      offset: (q.offset as number) || 0,
    });
    res.json({ data: result.data, total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    next(err);
  }
};
