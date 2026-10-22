import { badRequest, notFound } from '../../lib/errors.js';
import { getIo } from '../../realtime.js';
import * as repo from './messages.repo.js';
import * as notifRepo from './notifications.repo.js';

// ------------------------------------------------------------ Мессеж (FR-22)

// REST болон Socket.IO хоёулаа энэ функцийг дуудна: дүрэм нэг газар
export async function sendMessage(sender, receiverId, body) {
  if (sender.id === receiverId) throw badRequest('Өөртөө мессеж илгээх боломжгүй');
  const receiver = await repo.findActiveUser(receiverId);
  if (!receiver) throw notFound('Хүлээн авагч олдсонгүй');
  const message = await repo.createMessage({ senderId: sender.id, receiverId, body });
  // Хүлээн авагч болон илгээгчийн бүх нээлттэй цонх руу бодит хугацаанд хүргэнэ
  const payload = { ...message, senderName: sender.name };
  getIo()?.to(`user:${receiverId}`).to(`user:${sender.id}`).emit('message:new', payload);
  return payload;
}

export const listConversations = (userId) => repo.listConversations(userId);

export async function listMessages(userId, otherId, beforeId) {
  const other = await repo.findActiveUser(otherId);
  if (!other) throw notFound('Хэрэглэгч олдсонгүй');
  return { user: other, messages: await repo.listMessages(userId, otherId, beforeId) };
}

// ------------------------------------------------------- Мэдэгдэл (FR-19)

export const notify = notifRepo.createNotification;

export async function listNotifications(userId) {
  const [items, unread] = await Promise.all([notifRepo.listForUser(userId), notifRepo.countUnread(userId)]);
  return { notifications: items, unread };
}

export async function markRead(userId, id) {
  if (!(await notifRepo.markRead(userId, id))) throw notFound('Мэдэгдэл олдсонгүй');
}

export const markAllRead = (userId) => notifRepo.markAllRead(userId);
export const markReadForQuestion = notifRepo.markReadForQuestion;
