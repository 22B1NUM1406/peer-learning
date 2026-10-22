import { withTransaction } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { authorFor } from '../../lib/authors.js';
import { findSubjectById } from '../subjects/subjects.repo.js';
import { notify, markReadForQuestion } from '../messages/messages.service.js';
import { revokeAnswerPoints } from '../rating/rating.service.js';
import * as repo from './qa.repo.js';

// Q&A модуль: асуулт, хариулт, сэтгэгдэл, нэр нууцлах (FR-05–FR-10, FR-14, FR-20)

const isAdmin = (u) => u.role === 'admin';

async function requireActiveSubject(subjectId) {
  const s = await findSubjectById(subjectId);
  if (!s || !s.isActive) throw badRequest('Хичээл олдсонгүй эсвэл идэвхгүй');
}

// Нуугдсан асуултыг зөвхөн админ харна
async function requireVisibleQuestion(id, viewer) {
  const q = await repo.findQuestion(id);
  if (!q || (q.is_hidden && !isAdmin(viewer))) throw notFound('Асуулт олдсонгүй');
  return q;
}

// --------------------------------------------------------------- Асуулт

export async function createQuestion(user, data) {
  await requireActiveSubject(data.subjectId);
  return repo.createQuestion({ authorId: user.id, ...data });
}

// P4: асуулт, хариултууд, сэтгэгдлүүдийг нэг хариунд нэгтгэнэ
export async function getQuestion(id, viewer) {
  const q = await repo.getQuestion(id);
  if (!q || (q.is_hidden && !isAdmin(viewer))) throw notFound('Асуулт олдсонгүй');

  const [answers, comments] = await Promise.all([
    repo.getAnswers(id, viewer.id, { includeHidden: isAdmin(viewer) }),
    repo.getComments(id),
    markReadForQuestion(viewer.id, id),
  ]);

  const toComment = (c) => ({
    id: c.id, body: c.body, createdAt: c.created_at,
    author: { id: c.author_id, name: c.author_name },
    canDelete: c.author_id === viewer.id,
  });

  return {
    id: q.id,
    title: q.title,
    body: q.body,
    createdAt: q.created_at,
    subject: { id: q.subject_id, name: q.subject_name },
    isAnonymous: q.is_anonymous,
    isHidden: q.is_hidden,
    author: authorFor(q, viewer, { anonymous: q.is_anonymous }),
    isMine: q.author_id === viewer.id,
    acceptedAnswerId: q.accepted_answer_id,
    // FR-06: хариулттай асуултыг мэдлэгийн санд үлдээхийн тулд устгахыг хориглоно
    canDelete: q.author_id === viewer.id && answers.length === 0,
    comments: comments.filter((c) => c.question_id === q.id).map(toComment),
    answers: answers.map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.created_at,
      isHidden: a.is_hidden,
      author: authorFor(a, viewer),
      isMine: a.author_id === viewer.id,
      isAccepted: a.is_accepted,
      voteCount: a.vote_count,
      votedByMe: a.voted_by_me,
      comments: comments.filter((c) => c.answer_id === a.id).map(toComment),
    })),
  };
}

export async function updateQuestion(user, id, changes) {
  const q = await requireVisibleQuestion(id, user);
  if (q.author_id !== user.id) throw forbidden();
  if (changes.subjectId) await requireActiveSubject(changes.subjectId);
  await repo.updateQuestion(id, changes);
}

export async function deleteQuestion(user, id) {
  const q = await requireVisibleQuestion(id, user);
  if (q.author_id !== user.id) throw forbidden();
  if (q.answer_count > 0) throw conflict('Хариулттай асуултыг устгах боломжгүй: мэдлэгийн санд хадгалагдана');
  await repo.deleteQuestion(id);
}

// --------------------------------------------------------------- Хариулт

export async function createAnswer(user, questionId, body) {
  const q = await requireVisibleQuestion(questionId, user);
  const id = await repo.createAnswer({ questionId, authorId: user.id, body });
  // FR-19: асуугчид мэдэгдэнэ (өөрийн асуултад хариулбал мэдэгдэхгүй)
  if (q.author_id !== user.id) await notify({ userId: q.author_id, type: 'new_answer', questionId });
  return id;
}

async function requireOwnAnswer(user, id) {
  const a = await repo.findAnswer(id);
  if (!a || a.is_hidden || a.question_hidden) throw notFound('Хариулт олдсонгүй');
  if (a.author_id !== user.id) throw forbidden();
  return a;
}

export async function updateAnswer(user, id, body) {
  await requireOwnAnswer(user, id);
  await repo.updateAnswer(id, body);
}

export async function deleteAnswer(user, id) {
  const a = await requireOwnAnswer(user, id);
  await removeAnswer(a);
}

// Эзэн болон админ (Moderation) хоёулаа ашиглана: оноог буцааж, хариултыг устгана
export async function removeAnswer(answer) {
  await withTransaction(async (db) => {
    await revokeAnswerPoints(db, answer);
    await repo.deleteAnswer(answer.id, db); // accepted_answer_id нь ON DELETE SET NULL-ээр цэвэрлэгдэнэ
  });
}

// ------------------------------------------------------------- Сэтгэгдэл

export async function commentOnQuestion(user, questionId, body) {
  await requireVisibleQuestion(questionId, user);
  return repo.createComment({ authorId: user.id, questionId, body });
}

export async function commentOnAnswer(user, answerId, body) {
  const a = await repo.findAnswer(answerId);
  if (!a || a.is_hidden || a.question_hidden) throw notFound('Хариулт олдсонгүй');
  return repo.createComment({ authorId: user.id, answerId, body });
}

export async function deleteComment(user, id) {
  const c = await repo.findComment(id);
  if (!c) throw notFound('Сэтгэгдэл олдсонгүй');
  if (c.author_id !== user.id) throw forbidden();
  await repo.deleteComment(id);
}
