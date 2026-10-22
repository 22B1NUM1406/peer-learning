import { conflict, notFound } from '../../lib/errors.js';
import * as repo from './subjects.repo.js';

// FR-17: хичээлийг устгахгүй, идэвхгүй болгоно. Ингэснээр тухайн хичээлийн
// өмнөх асуултууд мэдлэгийн санд хэвээр үлдэнэ.

export const listActive = () => repo.listSubjects();
export const listAll = () => repo.listSubjects({ includeInactive: true });

export async function get(id) {
  const subject = await repo.findSubjectById(id);
  if (!subject) throw notFound('Хичээл олдсонгүй');
  return subject;
}

export async function create(name) {
  try {
    return await repo.createSubject(name);
  } catch (err) {
    if (err.code === '23505') throw conflict('Ийм нэртэй хичээл бүртгэлтэй байна');
    throw err;
  }
}

export async function update(id, changes) {
  try {
    const subject = await repo.updateSubject(id, changes);
    if (!subject) throw notFound('Хичээл олдсонгүй');
    return subject;
  } catch (err) {
    if (err.code === '23505') throw conflict('Ийм нэртэй хичээл бүртгэлтэй байна');
    throw err;
  }
}
