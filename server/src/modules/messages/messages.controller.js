import { optionalId, requireId, requireString } from '../../lib/validate.js';
import * as service from './messages.service.js';

export async function listConversations(req, res) {
  res.json({ conversations: await service.listConversations(req.user.id) });
}

export async function listMessages(req, res) {
  const otherId = requireId(req.params.userId, 'userId');
  const before = optionalId(req.query.before, 'before');
  res.json(await service.listMessages(req.user.id, otherId, before));
}

// Socket.IO-гүй орчинд (тест, сүлжээ муу) ажиллах нөөц зам
export async function send(req, res) {
  const receiverId = requireId(req.params.userId, 'userId');
  const body = requireString(req.body?.body, 'Мессеж', { max: 2000 });
  res.status(201).json({ message: await service.sendMessage(req.user, receiverId, body) });
}

export async function listNotifications(req, res) {
  res.json(await service.listNotifications(req.user.id));
}

export async function markRead(req, res) {
  await service.markRead(req.user.id, requireId(req.params.id));
  res.status(204).end();
}

export async function markAllRead(req, res) {
  await service.markAllRead(req.user.id);
  res.status(204).end();
}
