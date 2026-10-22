import { query, withTransaction } from '../../db.js';

export async function findProfile(id) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.faculty, u.year, u.reputation, u.role, u.status, u.created_at AS "createdAt",
            (SELECT COUNT(*)::int FROM questions q WHERE q.author_id = u.id AND NOT q.is_hidden) AS "questionCount",
            (SELECT COUNT(*)::int FROM answers a WHERE a.author_id = u.id AND NOT a.is_hidden) AS "answerCount",
            (SELECT COUNT(*)::int FROM questions q JOIN answers a ON a.id = q.accepted_answer_id
              WHERE a.author_id = u.id) AS "acceptedCount"
       FROM users u WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listHelpSubjects(userId) {
  const { rows } = await query(
    `SELECT s.id, s.name FROM user_subjects us JOIN subjects s ON s.id = us.subject_id
      WHERE us.user_id = $1 AND s.is_active ORDER BY s.name`,
    [userId],
  );
  return rows;
}

// includeAnonymous: өөрийн профайл эсвэл админ үзэж байгаа үед л нууцалсан асуултыг харуулна
export async function listQuestionsByUser(userId, { includeAnonymous }) {
  const { rows } = await query(
    `SELECT q.id, q.title, q.is_anonymous AS "isAnonymous", q.created_at AS "createdAt",
            s.id AS subject_id, s.name AS subject_name,
            (SELECT COUNT(*)::int FROM answers a WHERE a.question_id = q.id AND NOT a.is_hidden) AS "answerCount",
            q.accepted_answer_id IS NOT NULL AS "hasAccepted"
       FROM questions q JOIN subjects s ON s.id = q.subject_id
      WHERE q.author_id = $1 AND NOT q.is_hidden AND ($2 OR NOT q.is_anonymous)
      ORDER BY q.created_at DESC LIMIT 50`,
    [userId, includeAnonymous],
  );
  return rows;
}

export async function listAnswersByUser(userId) {
  const { rows } = await query(
    `SELECT a.id, a.created_at AS "createdAt", LEFT(a.body, 200) AS excerpt,
            q.id AS "questionId", q.title AS "questionTitle",
            q.accepted_answer_id = a.id AS "isAccepted",
            (SELECT COUNT(*)::int FROM votes v WHERE v.answer_id = a.id) AS "voteCount"
       FROM answers a JOIN questions q ON q.id = a.question_id
      WHERE a.author_id = $1 AND NOT a.is_hidden AND NOT q.is_hidden
      ORDER BY a.created_at DESC LIMIT 50`,
    [userId],
  );
  return rows;
}

export async function updateProfile(id, { name, faculty, year }) {
  const { rows } = await query(
    `UPDATE users SET name = $2, faculty = $3, year = $4 WHERE id = $1
     RETURNING id, name, faculty, year, reputation, role`,
    [id, name, faculty ?? null, year ?? null],
  );
  return rows[0];
}

// Туслах хичээлүүдийг бүхэлд нь солино: хуучныг устгаад шинийг оруулна (нэг транзакцаар)
export async function replaceHelpSubjects(userId, subjectIds) {
  await withTransaction(async (db) => {
    await db.query('DELETE FROM user_subjects WHERE user_id = $1', [userId]);
    if (subjectIds.length) {
      await db.query(
        `INSERT INTO user_subjects (user_id, subject_id)
         SELECT $1, s.id FROM subjects s WHERE s.id = ANY($2::int[]) AND s.is_active`,
        [userId, subjectIds],
      );
    }
  });
}

// FR-04: тухайн хичээлд туслах боломжтой оюутнууд, тэр хичээлд авсан
// "тусалсан" хариултын тоогоор эрэмбэлэгдсэн
export async function listHelpers(subjectId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.faculty, u.year, u.reputation,
            COUNT(q.id)::int AS "acceptedInSubject"
       FROM user_subjects us
       JOIN users u ON u.id = us.user_id AND u.status = 'active'
       LEFT JOIN answers a ON a.author_id = u.id AND NOT a.is_hidden
       LEFT JOIN questions q ON q.accepted_answer_id = a.id AND q.subject_id = us.subject_id
      WHERE us.subject_id = $1
      GROUP BY u.id
      ORDER BY "acceptedInSubject" DESC, u.reputation DESC, u.name
      LIMIT 50`,
    [subjectId],
  );
  return rows;
}
