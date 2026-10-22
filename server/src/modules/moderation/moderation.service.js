import { withTransaction, query } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getIo } from '../../realtime.js';
import { findAnswer } from '../qa/qa.repo.js';
import { removeAnswer } from '../qa/qa.service.js';
import { revokeAnswerPoints } from '../rating/rating.service.js';
import { findResource } from '../resources/resources.repo.js';
import { removeResource } from '../resources/resources.service.js';
import * as repo from './moderation.repo.js';

// Moderation модуль: мэдээлэх (FR-15), хянах (FR-16), түдгэлзүүлэх (FR-18)

export const TARGET_TYPES = ['question', 'answer', 'comment', 'resource', 'message'];

// FR-15-ын нэмэлт (2.1.7): "Шалгалтын материал" шалтгааныг асуулгын нээлттэй хариултаас нэмсэн
export const REASONS = ['Буруу, төөрөгдүүлсэн мэдээлэл', 'Зохисгүй агуулга', 'Спам, сурталчилгаа', 'Шалгалтын материал', 'Бусад'];

export async function report(user, { targetType, targetId, reason }) {
  const t = await repo.findTarget(targetType, targetId);
  if (!t || t.is_hidden) throw notFound('Мэдээлэх контент олдсонгүй');
  if (t.owner_id === user.id) throw badRequest('Өөрийн контентыг мэдээлэх боломжгүй');
  // Мессежийг зөвхөн хүлээн авагч нь мэдээлнэ: бусдын хувийн яриаг харах боломжгүй
  if (targetType === 'message' && t.other_id !== user.id) throw forbidden();
  const id = await repo.createReport({ reporterId: user.id, targetType, targetId, reason });
  if (!id) throw conflict('Та энэ контентыг аль хэдийн мэдээлсэн');
  return id;
}

export const listReports = (status) => repo.listReports(status);

// Асуултыг устгахад түүний хариултуудаар олсон оноог мөн буцаана
async function deleteQuestionWithPoints(questionId) {
  await withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT a.id, a.author_id, q.author_id AS question_author_id, q.accepted_answer_id = a.id AS is_accepted
         FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.question_id = $1`,
      [questionId],
    );
    for (const a of rows) await revokeAnswerPoints(db, a);
    await db.query('DELETE FROM questions WHERE id = $1', [questionId]);
  });
}

async function deleteTarget(type, id) {
  switch (type) {
    case 'question': return deleteQuestionWithPoints(id);
    case 'answer': {
      const a = await findAnswer(id);
      if (a) await removeAnswer(a);
      return;
    }
    case 'resource': {
      const r = await findResource(id);
      if (r) await removeResource(r);
      return;
    }
    case 'comment': return query('DELETE FROM comments WHERE id = $1', [id]);
    case 'message': return query('DELETE FROM messages WHERE id = $1', [id]);
  }
}

// action: hide | delete | dismiss
export async function resolve(admin, reportId, action) {
  const r = await repo.findReport(reportId);
  if (!r) throw notFound('Мэдээлэл олдсонгүй');
  if (r.status !== 'open') throw conflict('Энэ мэдээлэл аль хэдийн шийдвэрлэгдсэн');

  if (action === 'hide') {
    if (!repo.canHide(r.target_type)) throw badRequest('Энэ төрлийн контентыг нуух боломжгүй, устгана уу');
    await repo.hideTarget(r.target_type, r.target_id);
  } else if (action === 'delete') {
    await deleteTarget(r.target_type, r.target_id);
  }
  await repo.resolveReports(r.target_type, r.target_id, action === 'dismiss' ? 'dismissed' : 'resolved', admin.id);
}

// FR-18: түдгэлзүүлэхэд бүх session-ийг устгаж, нээлттэй socket холболтыг тасална
export async function setUserStatus(admin, userId, status) {
  if (admin.id === userId) throw badRequest('Өөрийгөө түдгэлзүүлэх боломжгүй');
  const u = await repo.setUserStatus(userId, status);
  if (!u) throw notFound('Хэрэглэгч олдсонгүй');
  if (status === 'suspended') {
    await repo.deleteSessionsOf(userId);
    getIo()?.in(`user:${userId}`).disconnectSockets(true);
  }
  return u;
}

export const listUsers = (filter) => repo.listUsers(filter);
