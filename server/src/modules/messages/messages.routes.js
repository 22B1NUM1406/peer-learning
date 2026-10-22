import { Router } from 'express';
import * as c from './messages.controller.js';

export const messageRoutes = Router();

messageRoutes.get('/conversations', c.listConversations);
messageRoutes.get('/conversations/:userId/messages', c.listMessages);
messageRoutes.post('/conversations/:userId/messages', c.send);

messageRoutes.get('/notifications', c.listNotifications);
messageRoutes.post('/notifications/read-all', c.markAllRead);
messageRoutes.patch('/notifications/:id/read', c.markRead);
