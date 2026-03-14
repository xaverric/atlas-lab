import type { RequestHandler } from 'express';
import * as endpointService from '../services/endpointService.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.create(req.auth.sub, req.body);
    res.status(201).json({ data: endpoint });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const endpoints = await endpointService.list(req.auth.sub);
    res.json({ data: endpoints });
  } catch (err) {
    next(err);
  }
};

export const getByName: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getByName(req.auth.sub, req.params.name as string);
    res.json({ data: endpoint });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.update(req.auth.sub, req.params.name as string, req.body);
    res.json({ data: endpoint });
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await endpointService.remove(req.auth.sub, req.params.name as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
