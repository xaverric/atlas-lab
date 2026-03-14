import type { RequestHandler } from 'express';
import * as dataService from '../services/dataService.js';
import * as endpointService from '../services/endpointService.js';

export const submit: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getByName(req.auth.sub, req.params.name as string);
    const metadata = {
      source: 'api',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    const entry = await dataService.insert(
      endpoint.userId,
      endpoint.name,
      endpoint.schema,
      req.body,
      metadata,
    );
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
};

export const query: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getByName(req.auth.sub, req.params.name as string);
    const filters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      sort: req.query.sort as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      filter: req.query.filter as Record<string, unknown> | undefined,
    };
    const result = await dataService.query(endpoint.userId, endpoint.name, filters);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const deleteEntry: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getByName(req.auth.sub, req.params.name as string);
    await dataService.deleteEntry(endpoint.userId, endpoint.name, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const submitPublic: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getPublicByName(req.params.name as string);
    const metadata = {
      source: 'api',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    const entry = await dataService.insert(
      endpoint.userId,
      endpoint.name,
      endpoint.schema,
      req.body,
      metadata,
    );
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
};

export const queryPublic: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getPublicByName(req.params.name as string);
    const filters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      sort: req.query.sort as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      filter: req.query.filter as Record<string, unknown> | undefined,
    };
    const result = await dataService.query(endpoint.userId, endpoint.name, filters);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getPublicEndpoint: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = await endpointService.getPublicByName(req.params.name as string);
    res.json({ data: endpoint });
  } catch (err) {
    next(err);
  }
};
