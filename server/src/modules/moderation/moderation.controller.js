import { optionalString, requireEnum, requireId, requireString } from '../../lib/validate.js';
import * as service from './moderation.service.js';

export async function report(req, res) {
  const b = req.body ?? {};
  const targetType = requireEnum(b.targetType, 'targetType', service.TARGET_TYPES);
  const reasonType = requireEnum(b.reason, 'Шалтгаан', service.REASONS);
  const details = optionalString(b.details, 'Дэлгэрэнгүй', { max: 200 });
  const id = await service.report(req.user, {
    targetType,
    targetId: requireId(b.targetId, 'targetId'),
    reason: details ? `${reasonType}: ${details}` : reasonType,
  });
  res.status(201).json({ id });
}

export function reasons(req, res) {
  res.json({ reasons: service.REASONS });
}

export async function listReports(req, res) {
  const status = requireEnum(req.query.status ?? 'open', 'status', ['open', 'resolved', 'dismissed']);
  res.json({ reports: await service.listReports(status) });
}

export async function resolve(req, res) {
  const action = requireEnum(req.body?.action, 'action', ['hide', 'delete', 'dismiss']);
  await service.resolve(req.user, requireId(req.params.id), action);
  res.status(204).end();
}

export async function setUserStatus(req, res) {
  const status = requireEnum(req.body?.status, 'status', ['active', 'suspended']);
  res.json({ user: await service.setUserStatus(req.user, requireId(req.params.id), status) });
}

export async function listUsers(req, res) {
  const status = req.query.status ? requireEnum(req.query.status, 'status', ['active', 'suspended']) : undefined;
  const q = req.query.q ? requireString(req.query.q, 'Хайлт', { max: 100 }) : undefined;
  res.json({ users: await service.listUsers({ status, q }) });
}
