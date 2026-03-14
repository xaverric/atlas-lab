import { Router } from 'express';
import { createAuth } from '@atlas/server-common';
import { config } from '../config/index.js';
import * as sseManager from '../services/sseManager.js';
import * as notificationDao from '../daos/notificationDao.js';

const router = Router();

const verifyToken = createAuth({
  issuer: config.keycloak.issuer,
  publicIssuer: config.keycloak.publicIssuer,
});

router.get('/stream', verifyToken, async (req, res) => {
  const userId = req.auth.sub;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write('\n');

  const unread = await notificationDao.countUnread(userId);
  res.write(`event: unread-count\ndata: ${JSON.stringify({ count: unread })}\n\n`);

  sseManager.addClient(userId, res);

  req.on('close', () => {
    sseManager.removeClient(userId, res);
  });
});

export default router;
