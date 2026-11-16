import { notFound } from '../../lib/errors.js';
import * as repo from './users.repo.js';
import { findSubjectById } from '../subjects/subjects.repo.js';
import { levelFor } from '../../lib/levels.js';

// Профайл (FR-03, FR-04, FR-24). Имэйлийг хэзээ ч буцаахгүй (NFR-12).
export async function getProfile(id, viewer) {
  const profile = await repo.findProfile(id);
  if (!profile) throw notFound('Хэрэглэгч олдсонгүй');
  // Түдгэлзсэн хэрэглэгчийн профайлыг зөвхөн админ харна
  if (profile.status !== 'active' && viewer.role !== 'admin') throw notFound('Хэрэглэгч олдсонгүй');
  const isMe = viewer.id === id;
  const includeAnonymous = isMe || viewer.role === 'admin';
  const [helpSubjects, activity, topSubjects] = await Promise.all([
    repo.listHelpSubjects(id),
    repo.subjectActivity(id, { includeAnonymous }),
    repo.topHelperSubjects(id),
  ]);
  const { notifyNewQuestions, anonQuestionCount, ...pub } = profile;
  // Нэрээ нуусан асуултыг бусдад тоолж харуулбал хэн асуусныг таах боломжтой (QA тестээр илэрсэн)
  if (!includeAnonymous) pub.questionCount -= anonQuestionCount;
  return {
    ...pub,
    // Мэдэгдлийн тохиргоо хувийн мэдээлэл тул зөвхөн өөрт нь
    ...(isMe ? { notifyNewQuestions } : {}),
    level: levelFor(profile.reputation),
    badges: badgesFor(profile, topSubjects),
    subjectActivity: activity,
    helpSubjects,
    isMe,
  };
}

// FR-30: тэмдэг. Тусдаа хүснэгтэд хадгалахгүй, бодит өгөгдлөөс тооцно (нуусан контент тооцогдохгүй).
export function badgesFor(p, topSubjects = []) {
  const list = [
    { key: 'first_answer', name: 'Анхны хариулт', description: 'Анхны хариултаа бичсэн', earned: p.answerCount >= 1 },
    { key: 'first_accepted', name: 'Анх тусалсан', description: 'Хариулт нь анх удаа “тусалсан” гэж тэмдэглэгдсэн', earned: p.acceptedCount >= 1 },
    { key: 'helper_10', name: '10 удаа тусалсан', description: '10 хариулт нь “тусалсан” гэж тэмдэглэгдсэн', earned: p.acceptedCount >= 10 },
    { key: 'useful_25', name: 'Тустай хариулагч', description: 'Хариултууд нь нийт 25 “тустай” үнэлгээ авсан', earned: p.votesReceived >= 25 },
    { key: 'sharer', name: 'Материал хуваалцагч', description: '3 материал хуваалцсан', earned: p.resourceCount >= 3 },
  ];
  for (const s of topSubjects) {
    list.push({ key: `top_${s.id}`, name: `${s.name}: шилдэг туслагч`, description: 'Энэ хичээлд хамгийн олон “тусалсан” хариулттай (3-аас доошгүй)', earned: true });
  }
  return list;
}

export const listBookmarks = async (userId) => (await repo.listBookmarks(userId))
  .map(({ subject_id, subject_name, ...q }) => ({ ...q, subject: { id: subject_id, name: subject_name } }));

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
