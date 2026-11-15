import { query } from '../../db.js';

// ------------------------------------------------------------------ Асуулт

export async function createQuestion({ authorId, subjectId, title, body, isAnonymous }) {
  const { rows } = await query(
    `INSERT INTO questions (author_id, subject_id, title, body, is_anonymous)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [authorId, subjectId, title, body, isAnonymous],
  );
  return rows[0].id;
}

// Эрх шалгахад хэрэгтэй түүхий мөр
export async function findQuestion(id, db = { query }) {
  const { rows } = await db.query(
    `SELECT id, author_id, subject_id, is_hidden, is_anonymous, accepted_answer_id,
            (SELECT COUNT(*)::int FROM answers a WHERE a.question_id = q.id) AS answer_count
       FROM questions q WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getQuestion(id) {
  const { rows } = await query(
    `SELECT q.id, q.title, q.body, q.is_anonymous, q.is_hidden, q.accepted_answer_id, q.created_at,
            q.author_id, u.name AS author_name, u.reputation AS author_reputation,
            s.id AS subject_id, s.name AS subject_name
       FROM questions q
       JOIN users u ON u.id = q.author_id
       JOIN subjects s ON s.id = q.subject_id
      WHERE q.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Хариултууд: "тусалсан" нь эхэнд, дараа нь "тустай" үнэлгээгээр, дараа нь цаг хугацаагаар (P4)
export async function getAnswers(questionId, viewerId, { includeHidden }) {
  const { rows } = await query(
    `SELECT a.id, a.body, a.is_hidden, a.created_at,
            a.author_id, u.name AS author_name, u.reputation AS author_reputation,
            COUNT(v.user_id)::int AS vote_count,
            BOOL_OR(v.user_id = $2) IS TRUE AS voted_by_me,
            q.accepted_answer_id = a.id AS is_accepted,
            (SELECT COUNT(*)::int FROM questions q2 JOIN answers a2 ON a2.id = q2.accepted_answer_id
              WHERE a2.author_id = a.author_id AND q2.subject_id = q.subject_id
                AND NOT q2.is_hidden AND NOT a2.is_hidden) AS author_accepted_in_subject
       FROM answers a
       JOIN users u ON u.id = a.author_id
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN votes v ON v.answer_id = a.id
      WHERE a.question_id = $1 AND ($3 OR NOT a.is_hidden)
      GROUP BY a.id, u.id, q.accepted_answer_id, q.subject_id
      ORDER BY is_accepted DESC, vote_count DESC, a.created_at ASC`,
    [questionId, viewerId, includeHidden],
  );
  return rows;
}

export async function getComments(questionId) {
  const { rows } = await query(
    `SELECT c.id, c.body, c.created_at, c.question_id, c.answer_id,
            c.author_id, u.name AS author_name
       FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.question_id = $1
         OR c.answer_id IN (SELECT id FROM answers WHERE question_id = $1)
      ORDER BY c.created_at ASC`,
    [questionId],
  );
  return rows;
}

export async function updateQuestion(id, { title, body, subjectId }) {
  await query(
    `UPDATE questions SET title = COALESCE($2, title), body = COALESCE($3, body),
            subject_id = COALESCE($4, subject_id) WHERE id = $1`,
    [id, title ?? null, body ?? null, subjectId ?? null],
  );
}

export async function deleteQuestion(id) {
  await query('DELETE FROM questions WHERE id = $1', [id]);
}

// ---------------------------------------------------------------- Хариулт

export async function createAnswer({ questionId, authorId, body }) {
  const { rows } = await query(
    'INSERT INTO answers (question_id, author_id, body) VALUES ($1, $2, $3) RETURNING id',
    [questionId, authorId, body],
  );
  return rows[0].id;
}

export async function findAnswer(id, db = { query }) {
  const { rows } = await db.query(
    `SELECT a.id, a.question_id, a.author_id, a.is_hidden, q.is_hidden AS question_hidden,
            q.author_id AS question_author_id, q.accepted_answer_id = a.id AS is_accepted
       FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateAnswer(id, body) {
  await query('UPDATE answers SET body = $2 WHERE id = $1', [id, body]);
}

export async function deleteAnswer(id, db = { query }) {
  await db.query('DELETE FROM answers WHERE id = $1', [id]);
}

// ------------------------------------------------------------- Сэтгэгдэл

export async function createComment({ authorId, questionId, answerId, body }) {
  const { rows } = await query(
    `INSERT INTO comments (author_id, question_id, answer_id, body) VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [authorId, questionId ?? null, answerId ?? null, body],
  );
  return rows[0].id;
}

export async function findComment(id) {
  const { rows } = await query('SELECT id, author_id FROM comments WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function deleteComment(id) {
  await query('DELETE FROM comments WHERE id = $1', [id]);
}

// ------------------------------------------------------------- Хадгалах (санал 7)

export async function addBookmark(userId, questionId) {
  await query('INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, questionId]);
}

export async function removeBookmark(userId, questionId) {
  await query('DELETE FROM bookmarks WHERE user_id = $1 AND question_id = $2', [userId, questionId]);
}

export async function isBookmarked(userId, questionId) {
  const { rowCount } = await query('SELECT 1 FROM bookmarks WHERE user_id = $1 AND question_id = $2', [userId, questionId]);
  return rowCount > 0;
}

// --------------------------------------------------- Төстэй асуултууд (санал 5)
// Гарчгийн trigram төстэй байдлаар; ижил хичээлийнхийг дээр гаргана. Нуусан асуулт орохгүй.
export async function relatedQuestions(id, limit = 5) {
  const { rows } = await query(
    `SELECT r.id, r.title, s.name AS "subjectName",
            r.accepted_answer_id IS NOT NULL AS "hasAccepted",
            (SELECT COUNT(*)::int FROM answers a WHERE a.question_id = r.id AND NOT a.is_hidden) AS "answerCount",
            round(similarity(r.title, q.title)::numeric, 2)::float AS score
       FROM questions q
       JOIN questions r ON r.id <> q.id AND NOT r.is_hidden
       JOIN subjects s ON s.id = r.subject_id
      WHERE q.id = $1
        AND (similarity(r.title, q.title) >= 0.2 OR (r.subject_id = q.subject_id AND similarity(r.title, q.title) >= 0.1))
      ORDER BY (r.subject_id = q.subject_id) DESC, score DESC, r.created_at DESC
      LIMIT $2`,
    [id, limit],
  );
  return rows;
}
