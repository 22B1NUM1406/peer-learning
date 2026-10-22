import { optionalId, optionalString, pageParams, requireEnum, requireString } from '../../lib/validate.js';
import * as service from './search.service.js';

// GET /api/questions?subject=&sort=new|unanswered&q=&page=
export async function list(req, res) {
  const { page, limit, offset } = pageParams(req.query, service.PAGE_SIZE);
  const result = await service.listQuestions({
    q: optionalString(req.query.q, 'Хайлт', { max: 200 }),
    subjectId: optionalId(req.query.subject, 'Хичээл'),
    sort: requireEnum(req.query.sort ?? 'new', 'sort', ['new', 'unanswered']),
    page, limit, offset,
  }, req.user);
  res.json(result);
}

// GET /api/questions/similar?title=
export async function similar(req, res) {
  const title = requireString(req.query.title, 'Гарчиг', { max: 200 });
  res.json({ questions: await service.similar(title) });
}
