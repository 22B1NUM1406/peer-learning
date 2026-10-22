import { badRequest } from '../../lib/errors.js';
import { optionalString, requireId, requireString } from '../../lib/validate.js';
import * as service from './users.service.js';

export async function getProfile(req, res) {
  res.json({ user: await service.getProfile(requireId(req.params.id), req.user) });
}

export async function getQuestions(req, res) {
  res.json({ questions: await service.getQuestions(requireId(req.params.id), req.user) });
}

export async function getAnswers(req, res) {
  res.json({ answers: await service.getAnswers(requireId(req.params.id)) });
}

export async function updateMe(req, res) {
  const name = requireString(req.body?.name, 'Нэр', { min: 2, max: 100 });
  const faculty = optionalString(req.body?.faculty, 'Бүрэлдэхүүн сургууль', { max: 150 });
  let year;
  if (req.body?.year !== undefined && req.body.year !== null && req.body.year !== '') {
    year = Number(req.body.year);
    if (!Number.isInteger(year) || year < 1 || year > 6) throw badRequest('Курс 1–6 байна');
  }
  res.json({ user: await service.updateProfile(req.user.id, { name, faculty, year }) });
}

export async function setMySubjects(req, res) {
  const ids = req.body?.subjectIds;
  if (!Array.isArray(ids) || ids.length > 30) throw badRequest('subjectIds жагсаалт байна (30 хүртэл)');
  await service.setHelpSubjects(req.user.id, ids.map((x) => requireId(x, 'subjectId')));
  res.status(204).end();
}

export async function listHelpers(req, res) {
  res.json({ helpers: await service.listHelpers(requireId(req.params.id)) });
}
