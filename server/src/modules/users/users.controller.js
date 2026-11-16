import { badRequest } from '../../lib/errors.js';
import { optionalBoolean, optionalString, requireId, requireString } from '../../lib/validate.js';
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

// Илгээсэн талбарыг л өөрчилнө. Илгээгээгүй талбар хэвээр үлдэнэ,
// null эсвэл хоосон утга нь тухайн талбарыг арилгана (QA тест: зөвхөн нэр илгээхэд сургууль, курс хоосордог байсан).
export async function updateMe(req, res) {
  const b = req.body ?? {};
  const has = (k) => Object.hasOwn(b, k);
  const changes = {};
  if (has('name')) changes.name = requireString(b.name, 'Нэр', { min: 2, max: 100 });
  if (has('faculty')) changes.faculty = optionalString(b.faculty, 'Бүрэлдэхүүн сургууль', { max: 150 }) ?? null;
  if (has('year')) {
    if (b.year === null || b.year === '') changes.year = null;
    else {
      const year = Number(b.year);
      if (!Number.isInteger(year) || year < 1 || year > 6) throw badRequest('Курс 1–6 байна');
      changes.year = year;
    }
  }
  if (has('notifyNewQuestions')) changes.notifyNewQuestions = optionalBoolean(b.notifyNewQuestions, 'notifyNewQuestions');
  if (!Object.keys(changes).length) throw badRequest('Өөрчлөх талбар алга');
  res.json({ user: await service.updateProfile(req.user.id, changes) });
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

// GET /api/users/me/bookmarks — хадгалсан асуултууд (зөвхөн өөрийнх)
export async function myBookmarks(req, res) {
  res.json({ questions: await service.listBookmarks(req.user.id) });
}
