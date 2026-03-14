import type { RequestHandler } from 'express';
import * as shareService from '../services/shareService.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { documentId, expiresInHours = 24, maxDownloads = 0 } = req.body;

    const share = await shareService.create({
      documentId,
      ownerId: req.auth.sub,
      expiresInHours,
      maxDownloads,
    });

    res.status(201).json({ data: share });
  } catch (err) {
    next(err);
  }
};

export const resolve: RequestHandler = async (req, res, next) => {
  try {
    const result = await shareService.resolve(req.params.token as string);
    res.redirect(result.url);
  } catch (err) {
    next(err);
  }
};

export const revoke: RequestHandler = async (req, res, next) => {
  try {
    await shareService.revoke(req.params.id as string, req.auth.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
