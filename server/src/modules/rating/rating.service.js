import { withTransaction } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { findAnswer } from '../qa/qa.repo.js';
import { notify, notifyOnce } from '../messages/messages.service.js';
import * as repo from './rating.repo.js';

// Оноо (FR-24). Нэг "тустай" үнэлгээ 2 оноо, "тусалсан" тэмдэглэгээ 10 оноо.
// "Тусалсан" нь асуугч асуудлаа шийдсэнийг илэрхийлэх тул илүү өндөр жинтэй.
export const POINTS = { vote: 2, accepted: 10 };

// FR-29, оноог хуурахаас хамгаалах: нэг оюутан нэг хүний хариултуудад 24 цагт хамгийн ихдээ 3 удаа
// оноо өгнө. Үүнээс хойших үнэлгээ хариултын "тустай" тоонд орох ч оноо өгөхгүй
// (хоёр оюутан бие биедээ олон удаа үнэлгээ өгч оноо цуглуулахаас сэргийлнэ).
export const DAILY_POINTS_PER_PAIR = 3;

// FR-11: "тустай" үнэлгээ
export async function vote(user, answerId) {
  return withTransaction(async (db) => {
    const answer = await findAnswer(answerId, db);
    if (!answer || answer.is_hidden || answer.question_hidden) throw notFound('Хариулт олдсонгүй');
    if (answer.author_id === user.id) throw forbidden('Өөрийн хариултыг үнэлэх боломжгүй');
    const awarded = (await repo.countAwardedToAuthor(db, user.id, answer.author_id)) < DAILY_POINTS_PER_PAIR;
    if (!(await repo.insertVote(db, user.id, answerId, awarded))) throw conflict('Та энэ хариултыг аль хэдийн үнэлсэн');
    if (awarded) await repo.addReputation(db, answer.author_id, POINTS.vote);
    // FR-35: хариулагчид мэдэгдэнэ (уншаагүй ижил мэдэгдэл байвал давхардуулахгүй)
    await notifyOnce({ userId: answer.author_id, type: 'vote', questionId: answer.question_id }, db);
    return repo.countVotes(db, answerId);
  });
}

export async function unvote(user, answerId) {
  return withTransaction(async (db) => {
    const answer = await findAnswer(answerId, db);
    if (!answer) throw notFound('Хариулт олдсонгүй');
    const awarded = await repo.deleteVote(db, user.id, answerId);
    if (awarded === null) throw notFound('Үнэлгээ олдсонгүй');
    if (awarded) await repo.addReputation(db, answer.author_id, -POINTS.vote);
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
  // Админ нуухад оноо аль хэдийн буцаагдсан: дахин хасахгүй
  const { rows } = await db.query(
    'SELECT a.is_hidden OR q.is_hidden AS hidden FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = $1',
    [answer.id],
  );
  if (!rows[0] || rows[0].hidden) return;
  const votes = await repo.countAwardedVotes(db, answer.id);
  let delta = -votes * POINTS.vote;
  if (answer.is_accepted && answer.author_id !== answer.question_author_id) delta -= POINTS.accepted;
  await repo.addReputation(db, answer.author_id, delta);
}
