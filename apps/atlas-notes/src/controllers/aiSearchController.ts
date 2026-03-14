import type { RequestHandler } from 'express';
import * as searchService from '../services/searchService.js';

export const aiSearch: RequestHandler = async (req, res, next) => {
  try {
    const results = await searchService.aiSearch({
      query: req.body.query,
      limit: req.body.limit,
    });
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
};
