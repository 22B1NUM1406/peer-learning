import { notFound } from '../../lib/errors.js';
import * as repo from './users.repo.js';
import { findSubjectById } from '../subjects/subjects.repo.js';

// Профайл (FR-03, FR-04, FR-24). Имэйлийг хэзээ ч буцаахгүй (NFR-12).
export async function getProfile(id, viewer) {
  const profile = await repo.findProfile(id);
  if (!profile) throw notFound('Хэрэглэгч олдсонгүй');
  // Түдгэлзсэн хэрэглэгчийн профайлыг зөвхөн админ харна
  if (profile.status !== 'active' && viewer.role !== 'admin') throw notFound('Хэрэглэгч олдсонгүй');
  const helpSubjects = await repo.listHelpSubjects(id);
  return { ...profile, helpSubjects, isMe: viewer.id === id };
}

export async function getQuestions(userId, viewer) {
  const includeAnonymous = viewer.id === userId || viewer.role === 'admin';
  const rows = await repo.listQuestionsByUser(userId, { includeAnonymous });
  return rows.map(({ subject_id, subject_name, ...q }) => ({ ...q, subject: { id: subject_id, name: subject_name } }));
}

export const getAnswers = (userId) => repo.listAnswersByUser(userId);
export const updateProfile = (id, data) => repo.updateProfile(id, data);
export const setHelpSubjects = (userId, ids) => repo.replaceHelpSubjects(userId, [...new Set(ids)]);

export async function listHelpers(subjectId) {
  if (!(await findSubjectById(subjectId))) throw notFound('Хичээл олдсонгүй');
  return repo.listHelpers(subjectId);
}
