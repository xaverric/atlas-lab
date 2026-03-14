import type { RequestHandler } from 'express';
import * as shareService from '../services/shareService.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { documentId, folderId, type = 'document', expiresInHours = 24, maxDownloads = 0, password } = req.body;

    const share = await shareService.create({
      documentId,
      folderId,
      type,
      ownerId: req.auth.sub,
      expiresInHours,
      maxDownloads,
      password,
    });

    res.status(201).json({ data: share });
  } catch (err) {
    next(err);
  }
};

export const resolve: RequestHandler = async (req, res, next) => {
  try {
    const result = await shareService.resolve(req.params.token as string);
    if (result.type === 'document') {
      res.redirect(result.url as string);
    } else {
      res.json({ data: result });
    }
  } catch (err) {
    next(err);
  }
};

export const verify: RequestHandler = async (req, res, next) => {
  try {
    const result = await shareService.verifyPassword(req.params.token as string, req.body.password);
    if (result.type === 'document') {
      res.json({ data: result });
    } else {
      res.json({ data: result });
    }
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
