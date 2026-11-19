import { badRequest } from '../../lib/errors.js';
import { optionalBoolean, optionalId, requireId, requireString } from '../../lib/validate.js';
import * as service from './subjects.service.js';

// Дундах олон хоосон зайг нэг болгоно: "QA  тест" ба "QA тест" давхардсан гэж танигдана (QA тестээр илэрсэн)
const squash = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ') : v);
const name = (v) => requireString(squash(v), 'Хичээлийн нэр', { min: 2, max: 150 });

// Код: заавал биш; хоосон бол null. Том үсгээр хадгална (icsi405 → ICSI405).
function optionalCode(v) {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === 'string' && v.trim() === '')) return null;
  if (typeof v !== 'string' || !/^[\p{L}\p{N}-]{2,20}$/u.test(v.trim())) {
    throw badRequest('Хичээлийн код 2–20 тэмдэгт (үсэг, тоо) байна');
  }
  return v.trim().toUpperCase();
}

// Сургууль, тэнхим: undefined = өөрчлөхгүй, null/'' = арилгах, тоо = онооно
const placementId = (v, field) => (v === undefined ? undefined : v === null || v === '' ? null : optionalId(v, field));

// GET /api/subjects?school=&department=
export async function list(req, res) {
  res.json({
    subjects: await service.listActive({
      schoolId: optionalId(req.query.school, 'Сургууль') ?? null,
      departmentId: optionalId(req.query.department, 'Тэнхим') ?? null,
    }),
  });
}

export async function get(req, res) {
  res.json({ subject: await service.get(requireId(req.params.id)) });
}

// GET /api/subjects/similar?name=&code= — нэмэхийн өмнө ижил хичээл байгаа эсэх (FR-27)
export async function similar(req, res) {
  res.json({
    subjects: await service.similar(
      name(req.query.name),
      optionalCode(req.query.code) ?? null,
    ),
  });
}

// POST /api/subjects — оюутан шинэ хичээл нэмнэ (FR-27)
export async function createByStudent(req, res) {
  res.status(201).json({
    subject: await service.createByStudent({
      name: name(req.body?.name),
      code: optionalCode(req.body?.code) ?? null,
      schoolId: placementId(req.body?.schoolId, 'Сургууль') ?? null,
      departmentId: placementId(req.body?.departmentId, 'Тэнхим') ?? null,
    }, req.user),
  });
}

// GET /api/schools — бүрэлдэхүүн сургууль, тэнхимүүд
export async function listSchools(req, res) {
  res.json({ schools: await service.listSchools() });
}

export async function adminList(req, res) {
  res.json({ subjects: await service.listAll() });
}

export async function create(req, res) {
  res.status(201).json({
    subject: await service.create({
      name: name(req.body?.name),
      code: optionalCode(req.body?.code) ?? null,
      schoolId: placementId(req.body?.schoolId, 'Сургууль') ?? null,
      departmentId: placementId(req.body?.departmentId, 'Тэнхим') ?? null,
    }),
  });
}

export async function update(req, res) {
  const id = requireId(req.params.id);
  const changes = {
    name: req.body?.name === undefined ? undefined : name(req.body.name),
    code: optionalCode(req.body?.code),
    schoolId: placementId(req.body?.schoolId, 'Сургууль'),
    departmentId: placementId(req.body?.departmentId, 'Тэнхим'),
    isActive: optionalBoolean(req.body?.isActive, 'isActive'),
  };
  if (Object.values(changes).every((v) => v === undefined)) throw badRequest('Өөрчлөх талбар алга');
  res.json({ subject: await service.update(id, changes) });
}

const schoolName = (v) => requireString(squash(v), 'Сургуулийн нэр', { min: 2, max: 150 });
const shortName = (v) => requireString(v, 'Товчлол', { min: 2, max: 20 });

export async function createSchool(req, res) {
  res.status(201).json({ school: await service.createSchool({ name: schoolName(req.body?.name), shortName: shortName(req.body?.shortName) }) });
}

export async function updateSchool(req, res) {
  const data = {
    name: req.body?.name === undefined ? undefined : schoolName(req.body.name),
    shortName: req.body?.shortName === undefined ? undefined : shortName(req.body.shortName),
  };
  if (data.name === undefined && data.shortName === undefined) throw badRequest('Өөрчлөх талбар алга');
  res.json({ school: await service.updateSchool(requireId(req.params.id), data) });
}

const deptName = (v) => requireString(squash(v), 'Тэнхимийн нэр', { min: 2, max: 150 });

export async function createDepartment(req, res) {
  res.status(201).json({ department: await service.createDepartment(requireId(req.params.id), deptName(req.body?.name)) });
}

export async function renameDepartment(req, res) {
  res.json({ department: await service.renameDepartment(requireId(req.params.id), deptName(req.body?.name)) });
}
