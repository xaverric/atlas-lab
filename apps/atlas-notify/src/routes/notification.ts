import { Router } from 'express';
import { auth, internalAuth } from '../middleware/auth.js';
import { requireRole } from '@atlas/server-common';
import * as notifyController from '../controllers/notifyController.js';
import * as preferenceController from '../controllers/preferenceController.js';
import * as templateController from '../controllers/templateController.js';
import * as channelController from '../controllers/channelController.js';

const router = Router();

// internal
router.post('/send', internalAuth, notifyController.send);
router.post('/send-direct', internalAuth, notifyController.sendDirect);

// notifications
router.post('/test', auth, notifyController.sendTest);
router.get('/', auth, notifyController.history);
router.patch('/:id/read', auth, notifyController.markRead);
router.post('/mark-all-read', auth, notifyController.markAllRead);
router.get('/unread-count', auth, notifyController.unreadCount);

// channels
router.get('/channels', auth, channelController.list);
router.post('/channels', auth, channelController.create);
router.patch('/channels/:id', auth, channelController.update);
router.delete('/channels/:id', auth, channelController.remove);
router.post('/channels/:id/verify', auth, channelController.verify);
router.post('/channels/:id/resend', auth, channelController.resend);
router.post('/channels/:id/telegram-verify', auth, channelController.initiateTelegramVerify);
router.post('/push-subscription', auth, channelController.registerPushSubscription);
router.delete('/push-subscription', auth, channelController.removePushSubscription);

// preference rules
router.get('/preferences/rules', auth, preferenceController.listRules);
router.post('/preferences/rules', auth, preferenceController.createRule);
router.patch('/preferences/rules/:id', auth, preferenceController.updateRule);
router.delete('/preferences/rules/:id', auth, preferenceController.deleteRule);

// templates
router.get('/templates', auth, templateController.list);
router.post('/templates', auth, requireRole('admin'), templateController.create);
router.patch('/templates/:id', auth, requireRole('admin'), templateController.update);
router.delete('/templates/:id', auth, requireRole('admin'), templateController.remove);

export default router;
