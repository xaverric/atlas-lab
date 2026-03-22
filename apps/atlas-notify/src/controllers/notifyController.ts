import type { Request, RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import { resolveOwner } from '@atlas/server-common';
import * as notifyService from '../services/notifyService.js';


export const send: RequestHandler = async (req, res, next) => {
  try {
    const { userId, templateKey, variables } = req.body;
    await notifyService.send(userId, templateKey, variables);
    res.json({ data: { message: 'Notification queued' } });
  } catch (err) { next(err); }
};

export const history: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId: userId, isAdmin } = resolveOwner(req);
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await notifyService.history(userId, page, limit, isAdmin);
    res.json(result);
  } catch (err) { next(err); }
};

export const markRead: RequestHandler = async (req, res, next) => {
  try {
    const notification = await notifyService.markRead(req.params.id as string, req.auth.sub);
    res.json({ data: notification });
  } catch (err) { next(err); }
};

export const markAllRead: RequestHandler = async (req, res, next) => {
  try {
    await notifyService.markAllRead(req.auth.sub);
    res.json({ data: { message: 'All marked as read' } });
  } catch (err) { next(err); }
};

export const unreadCount: RequestHandler = async (req, res, next) => {
  try {
    const count = await notifyService.unreadCount(req.auth.sub);
    res.json({ data: { count } });
  } catch (err) { next(err); }
};

export const sendTest: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const notification = await notifyService.createDirect(userId, {
      title: 'Test Notification',
      body: 'This is a test notification from Atlas. If you see this, notifications are working.',
      event: 'system.test',
      priority: 'normal',
    });
    res.json({ data: notification });
  } catch (err) { next(err); }
};

const ALLOWED_URL_PROTOCOLS = ['http:', 'https:'];
const validateNotificationUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) return undefined;
    if (parsed.hostname === 'localhost' || /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(parsed.hostname)) return undefined;
    return url;
  } catch {
    return undefined;
  }
};

export const sendDirect: RequestHandler = async (req, res, next) => {
  try {
    const { userId, title, body, event, priority, url } = req.body;
    if (!userId || !title || !body || !event) {
      throw new ApiError(400, 'Missing required fields: userId, title, body, event');
    }
    const safeUrl = validateNotificationUrl(url);
    const notification = await notifyService.createDirect(userId, { title, body, event, priority, url: safeUrl });
    res.json({ data: notification });
  } catch (err) { next(err); }
};
