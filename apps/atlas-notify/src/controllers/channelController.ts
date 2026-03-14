import type { RequestHandler } from 'express';
import * as channelService from '../services/channelService.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const channels = await channelService.list(req.auth.sub);
    res.json({ data: channels });
  } catch (err) { next(err); }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const channel = await channelService.create(req.auth.sub, req.body);
    res.status(201).json({ data: channel });
  } catch (err) { next(err); }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const channel = await channelService.update(req.params.id as string, req.auth.sub, req.body);
    res.json({ data: channel });
  } catch (err) { next(err); }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await channelService.remove(req.params.id as string, req.auth.sub);
    res.status(204).end();
  } catch (err) { next(err); }
};

export const verify: RequestHandler = async (req, res, next) => {
  try {
    const channel = await channelService.verify(req.params.id as string, req.auth.sub, req.body.code);
    res.json({ data: channel });
  } catch (err) { next(err); }
};

export const resend: RequestHandler = async (req, res, next) => {
  try {
    await channelService.sendVerification(req.params.id as string, req.auth.sub);
    res.json({ data: { message: 'Verification code sent' } });
  } catch (err) { next(err); }
};

export const initiateTelegramVerify: RequestHandler = async (req, res, next) => {
  try {
    const result = await channelService.initiateTelegramVerification(req.params.id as string, req.auth.sub);
    res.json({ data: result });
  } catch (err) { next(err); }
};

export const registerPushSubscription: RequestHandler = async (req, res, next) => {
  try {
    const channel = await channelService.create(req.auth.sub, {
      type: 'web_push',
      label: 'Browser Push',
      config: { subscription: req.body.subscription },
    });
    res.status(201).json({ data: channel });
  } catch (err) { next(err); }
};

export const removePushSubscription: RequestHandler = async (req, res, next) => {
  try {
    const endpoint = req.body.endpoint as string;
    await channelService.removePushSubscription(req.auth.sub, endpoint);
    res.status(204).end();
  } catch (err) { next(err); }
};
