import type { RequestHandler } from 'express';
import * as searchService from '../services/searchService.js';

export const search: RequestHandler = async (req, res, next) => {
  try {
    const results = await searchService.search({
      query: req.body.query,
      ownerId: req.auth.sub,
      folderId: req.body.folderId,
      limit: req.body.limit,
    });
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
};
