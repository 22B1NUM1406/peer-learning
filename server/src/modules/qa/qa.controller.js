import { badRequest } from '../../lib/errors.js';
import { optionalId, optionalString, requireId, requireString } from '../../lib/validate.js';
import * as service from './qa.service.js';

const TITLE = { min: 5, max: 200 };
const BODY = { min: 10, max: 10000 };

export async function createQuestion(req, res) {
  const b = req.body ?? {};
  const id = await service.createQuestion(req.user, {
    title: requireString(b.title, 'Гарчиг', TITLE),
    body: requireString(b.body, 'Агуулга', BODY),
    subjectId: requireId(b.subjectId, 'Хичээл'),
    isAnonymous: b.isAnonymous === true,
  });
  res.status(201).json({ id });
}

export async function getQuestion(req, res) {
  res.json({ question: await service.getQuestion(requireId(req.params.id), req.user) });
}

export async function updateQuestion(req, res) {
  const b = req.body ?? {};
  const changes = {
    title: optionalString(b.title, 'Гарчиг', TITLE),
    body: optionalString(b.body, 'Агуулга', BODY),
    subjectId: optionalId(b.subjectId, 'Хичээл'),
  };
  if (Object.values(changes).every((v) => v === undefined)) throw badRequest('Өөрчлөх талбар алга');
  await service.updateQuestion(req.user, requireId(req.params.id), changes);
  res.status(204).end();
}

export async function deleteQuestion(req, res) {
  await service.deleteQuestion(req.user, requireId(req.params.id));
  res.status(204).end();
}

export async function createAnswer(req, res) {
  const body = requireString(req.body?.body, 'Хариулт', BODY);
  res.status(201).json({ id: await service.createAnswer(req.user, requireId(req.params.id), body) });
}

export async function updateAnswer(req, res) {
  await service.updateAnswer(req.user, requireId(req.params.id), requireString(req.body?.body, 'Хариулт', BODY));
  res.status(204).end();
}

export async function deleteAnswer(req, res) {
  await service.deleteAnswer(req.user, requireId(req.params.id));
  res.status(204).end();
}

const COMMENT = { min: 2, max: 500 };

export async function commentOnQuestion(req, res) {
  const body = requireString(req.body?.body, 'Сэтгэгдэл', COMMENT);
  res.status(201).json({ id: await service.commentOnQuestion(req.user, requireId(req.params.id), body) });
}

export async function commentOnAnswer(req, res) {
  const body = requireString(req.body?.body, 'Сэтгэгдэл', COMMENT);
  res.status(201).json({ id: await service.commentOnAnswer(req.user, requireId(req.params.id), body) });
}

export async function deleteComment(req, res) {
  await service.deleteComment(req.user, requireId(req.params.id));
  res.status(204).end();
}
