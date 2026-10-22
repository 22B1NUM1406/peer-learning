import { withTransaction } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { findAnswer } from '../qa/qa.repo.js';
import { notify } from '../messages/messages.service.js';
import * as repo from './rating.repo.js';

// Оноо (FR-24). Нэг "тустай" үнэлгээ 2 оноо, "тусалсан" тэмдэглэгээ 10 оноо.
// "Тусалсан" нь асуугч асуудлаа шийдсэнийг илэрхийлэх тул илүү өндөр жинтэй.
export const POINTS = { vote: 2, accepted: 10 };

// FR-11: "тустай" үнэлгээ
export async function vote(user, answerId) {
  return withTransaction(async (db) => {
    const answer = await findAnswer(answerId, db);
    if (!answer || answer.is_hidden || answer.question_hidden) throw notFound('Хариулт олдсонгүй');
    if (answer.author_id === user.id) throw forbidden('Өөрийн хариултыг үнэлэх боломжгүй');
    if (!(await repo.insertVote(db, user.id, answerId))) throw conflict('Та энэ хариултыг аль хэдийн үнэлсэн');
    await repo.addReputation(db, answer.author_id, POINTS.vote);
    return repo.countVotes(db, answerId);
  });
}

export async function unvote(user, answerId) {
  return withTransaction(async (db) => {
    const answer = await findAnswer(answerId, db);
    if (!answer) throw notFound('Хариулт олдсонгүй');
    if (!(await repo.deleteVote(db, user.id, answerId))) throw notFound('Үнэлгээ олдсонгүй');
    await repo.addReputation(db, answer.author_id, -POINTS.vote);
    return repo.countVotes(db, answerId);
  });
}

// FR-12: асуугч нэг хариултыг "тусалсан" гэж тэмдэглэнэ, солино эсвэл болиулна (answerId = null).
// Нэг асуултад нэг л "тусалсан" хариулт байх нь accepted_answer_id нэг багана тул баталгаатай (NFR-10).
// Асуугч өөрийн хариултыг тэмдэглэж болох ч оноо авахгүй.
export async function accept(user, questionId, answerId) {
  return withTransaction(async (db) => {
    const q = await repo.lockQuestion(db, questionId);
    if (!q || q.is_hidden) throw notFound('Асуулт олдсонгүй');
    if (q.author_id !== user.id) throw forbidden('Зөвхөн асуугч “тусалсан” гэж тэмдэглэнэ');

    let newAuthorId = null;
    if (answerId !== null) {
      const a = await findAnswer(answerId, db);
      if (!a || a.question_id !== questionId || a.is_hidden) throw badRequest('Энэ асуултын хариулт биш байна');
      newAuthorId = a.author_id;
    }
    if (q.accepted_answer_id === answerId) return { acceptedAnswerId: answerId };

    if (q.accepted_author_id && q.accepted_author_id !== q.author_id) {
      await repo.addReputation(db, q.accepted_author_id, -POINTS.accepted);
    }
    await repo.setAccepted(db, questionId, answerId);
    if (newAuthorId && newAuthorId !== q.author_id) {
      await repo.addReputation(db, newAuthorId, POINTS.accepted);
      await notify({ userId: newAuthorId, type: 'accepted', questionId }, db);
    }
    return { acceptedAnswerId: answerId };
  });
}

// Хариулт устгагдахад (эзэн эсвэл админ) түүгээр олсон оноог буцаана.
// Ингэснээр USERS.reputation нь бодит үнэлгээтэй үргэлж тохирно.
export async function revokeAnswerPoints(db, answer) {
  const votes = await repo.countVotes(db, answer.id);
  let delta = -votes * POINTS.vote;
  if (answer.is_accepted && answer.author_id !== answer.question_author_id) delta -= POINTS.accepted;
  await repo.addReputation(db, answer.author_id, delta);
}
