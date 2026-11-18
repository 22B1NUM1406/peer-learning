import { badRequest, conflict, notFound, tooMany } from '../../lib/errors.js';
import * as repo from './subjects.repo.js';

// FR-17: хичээлийг устгахгүй, идэвхгүй болгоно. Ингэснээр тухайн хичээлийн
// өмнөх асуултууд мэдлэгийн санд хэвээр үлдэнэ.
// FR-26: хичээлийг бүрэлдэхүүн сургууль, тэнхимд хамааруулж, кодоор нь ялгана.
// FR-27: оюутан асуух хичээлээ жагсаалтаас олохгүй бол өөрөө нэмнэ. Шууд нэмэгдэх бөгөөд
// давхардлыг нэр, кодоор шалгаж, админ дараа нь засах эсвэл идэвхгүй болгоно.

export const STUDENT_DAILY_LIMIT = 5;

export const listActive = (filters) => repo.listSubjects(filters);
export const listAll = () => repo.listSubjects({ includeInactive: true });
export const listSchools = () => repo.listSchools();

export async function get(id) {
  const subject = await repo.findSubjectById(id);
  if (!subject) throw notFound('Хичээл олдсонгүй');
  return subject;
}

// Тэнхим сонгосон бол сургууль нь тэр тэнхимийнх байх ёстой. Сургуулийг өгөөгүй бол тэнхимээс авна.
async function resolvePlacement({ schoolId, departmentId }) {
  if (departmentId) {
    const dept = await repo.findDepartment(departmentId);
    if (!dept) throw badRequest('Тэнхим олдсонгүй');
    if (schoolId && schoolId !== dept.schoolId) throw badRequest('Тэнхим сонгосон сургуульд харьяалагдахгүй байна');
    return { schoolId: dept.schoolId, departmentId };
  }
  if (schoolId && !(await repo.schoolExists(schoolId))) throw badRequest('Сургууль олдсонгүй');
  return { schoolId, departmentId };
}

function uniqueError(err) {
  if (err.code !== '23505') return err;
  if (err.constraint === 'subjects_name_lower_key') return conflict('Ийм нэртэй хичээл бүртгэлтэй байна');
  if (err.constraint?.includes('code')) return conflict('Ийм кодтой хичээл бүртгэлтэй байна');
  if (err.constraint?.includes('short_name')) return conflict('Ийм товчлолтой сургууль бүртгэлтэй байна');
  if (err.constraint?.startsWith('schools')) return conflict('Ийм нэртэй сургууль бүртгэлтэй байна');
  if (err.constraint?.startsWith('departments')) return conflict('Энэ сургуульд ийм нэртэй тэнхим бүртгэлтэй байна');
  return conflict('Ийм нэртэй хичээл бүртгэлтэй байна');
}

export async function create({ name, code, schoolId, departmentId }) {
  const placement = await resolvePlacement({ schoolId, departmentId });
  try {
    return await repo.createSubject({ name, code, ...placement });
  } catch (err) {
    throw uniqueError(err);
  }
}

export async function update(id, changes) {
  const next = { ...changes };
  if (changes.departmentId !== undefined || changes.schoolId !== undefined) {
    const current = await repo.findSubjectById(id);
    if (!current) throw notFound('Хичээл олдсонгүй');
    // Сургуулийг солиход хуучин тэнхимийг хадгалахгүй (өөр сургуулийнх болох тул)
    const schoolId = changes.schoolId !== undefined ? changes.schoolId : current.schoolId;
    let departmentId = changes.departmentId !== undefined ? changes.departmentId : current.departmentId;
    if (changes.departmentId === undefined && changes.schoolId !== undefined && changes.schoolId !== current.schoolId) departmentId = null;
    Object.assign(next, await resolvePlacement({ schoolId, departmentId }));
  }
  try {
    const subject = await repo.updateSubject(id, next);
    if (!subject) throw notFound('Хичээл олдсонгүй');
    return subject;
  } catch (err) {
    throw uniqueError(err);
  }
}

export async function createSchool(data) {
  try {
    return await repo.createSchool(data);
  } catch (err) {
    throw uniqueError(err);
  }
}

export async function updateSchool(id, data) {
  try {
    const school = await repo.updateSchool(id, data);
    if (!school) throw notFound('Сургууль олдсонгүй');
    return school;
  } catch (err) {
    throw uniqueError(err);
  }
}

export async function createDepartment(schoolId, name) {
  if (!(await repo.schoolExists(schoolId))) throw notFound('Сургууль олдсонгүй');
  try {
    return await repo.createDepartment(schoolId, name);
  } catch (err) {
    throw uniqueError(err);
  }
}

export async function renameDepartment(id, name) {
  try {
    const dept = await repo.renameDepartment(id, name);
    if (!dept) throw notFound('Тэнхим олдсонгүй');
    return dept;
  } catch (err) {
    throw uniqueError(err);
  }
}

export const similar = (name, code) => repo.similarSubjects(name, code);

// Оюутан хичээл нэмэх: сургууль заавал (хаана заадгийг мэдэхгүй бол бусад нь олохгүй),
// тэнхим, код заавал биш. Ижил нэртэй хичээл байвал түүнийг нэрлэж татгалзана.
export async function createByStudent({ name, code, schoolId, departmentId }, user) {
  if (!schoolId && !departmentId) throw badRequest('Хичээлийг заадаг бүрэлдэхүүн сургуулийг сонгоно уу');
  const existing = await repo.findSubjectByName(name);
  if (existing) throw conflict(`“${existing.name}” хичээл бүртгэлтэй байна. Жагсаалтаас сонгоно уу`);
  if ((await repo.countRecentByUser(user.id)) >= STUDENT_DAILY_LIMIT) {
    throw tooMany(`Нэг өдөрт ${STUDENT_DAILY_LIMIT} хүртэл хичээл нэмнэ`);
  }
  const placement = await resolvePlacement({ schoolId, departmentId });
  try {
    return await repo.createSubject({ name, code, ...placement, createdBy: user.id });
  } catch (err) {
    throw uniqueError(err);
  }
}

// ----- МУИС-ийн каталог -----

// Хайлт: системд байгаа хичээл ба каталогийн хичээлийг хамт буцаана.
// Кодын хэлбэр: зай хасаж том үсгээр (icsi 405 → ICSI405), каталогийн кодыг ч ингэж хадгалсан.
export async function search(q, schoolId = null) {
  const code = q.replace(/\s+/g, '').toUpperCase();
  const words = q.toLowerCase().split(/[\s,.;:()]+/).filter(Boolean).slice(0, 6);
  const [subjects, catalog] = await Promise.all([repo.searchSubjects(q, code, words, schoolId), repo.searchCatalog(q, code, words, schoolId)]);
  return { subjects, catalog };
}

// Каталогоос хичээл сонгоход системд хичээл үүсгэнэ (эсвэл ижил нэртэйг нь буцаана).
// Хичээл, тэнхим, код нь албан ёсны тул ижил хичээлийг шалгах, өдрийн хязгаар шаардлагагүй.
export async function adoptCatalog(catalogId, user) {
  const course = await repo.findCatalogCourse(catalogId);
  if (!course) throw notFound('Каталогт ийм хичээл алга');
  const existing = await repo.findSubjectByName(course.name);
  if (existing) {
    if (!existing.isActive) throw conflict(`“${existing.name}” хичээлийг админ идэвхгүй болгосон байна`);
    return { subject: existing, created: false };
  }
  const code = course.code && !(await repo.codeTaken(course.code)) ? course.code : null;
  try {
    const subject = await repo.createSubject({
      name: course.name, code, schoolId: course.schoolId, departmentId: course.departmentId,
      createdBy: user.id, catalogId: course.id,
    });
    return { subject, created: true };
  } catch (err) {
    // Хоёр оюутан зэрэг сонговол нэг нь үүсгэнэ, нөгөө нь түүнийг авна
    if (err.code === '23505') {
      const again = await repo.findSubjectByName(course.name);
      if (again) return { subject: again, created: false };
    }
    throw uniqueError(err);
  }
}
