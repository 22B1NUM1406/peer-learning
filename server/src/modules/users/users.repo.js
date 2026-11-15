import { query, withTransaction } from '../../db.js';

export async function findProfile(id) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.faculty, u.year, u.reputation, u.role, u.status, u.created_at AS "createdAt",
            u.notify_new_questions AS "notifyNewQuestions",
            (SELECT COUNT(*)::int FROM votes v JOIN answers a ON a.id = v.answer_id
              WHERE a.author_id = u.id AND NOT a.is_hidden) AS "votesReceived",
            (SELECT COUNT(DISTINCT q.author_id)::int FROM questions q JOIN answers a ON a.id = q.accepted_answer_id
              WHERE a.author_id = u.id AND q.author_id <> u.id AND NOT q.is_hidden AND NOT a.is_hidden) AS "helpedStudents",
            (SELECT COUNT(*)::int FROM resources r WHERE r.author_id = u.id AND NOT r.is_hidden) AS "resourceCount",
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

export async function updateProfile(id, { name, faculty, year, notifyNewQuestions }) {
  const { rows } = await query(
    `UPDATE users SET name = $2, faculty = $3, year = $4,
            notify_new_questions = COALESCE($5, notify_new_questions)
      WHERE id = $1
     RETURNING id, name, faculty, year, reputation, role, notify_new_questions AS "notifyNewQuestions"`,
    [id, name, faculty ?? null, year ?? null, notifyNewQuestions ?? null],
  );
  return rows[0];
}

// Санал 7: хичээл тус бүрээр асуусан, хариулсан, тусалсан тоо (идэвхтэйгээс нь эхлэн, 8 хүртэл).
// Нэрээ нуусан асуултыг зөвхөн өөрт нь харуулахын тулд includeAnonymous-аар шүүнэ.
export async function subjectActivity(userId, { includeAnonymous }) {
  const { rows } = await query(
    `WITH qs AS (
       SELECT subject_id, COUNT(*)::int AS n FROM questions
        WHERE author_id = $1 AND NOT is_hidden AND ($2 OR NOT is_anonymous) GROUP BY subject_id),
     ans AS (
       SELECT q.subject_id, COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE q.accepted_answer_id = a.id)::int AS accepted
         FROM answers a JOIN questions q ON q.id = a.question_id
        WHERE a.author_id = $1 AND NOT a.is_hidden AND NOT q.is_hidden GROUP BY q.subject_id)
     SELECT s.id, s.name, COALESCE(qs.n, 0) AS questions, COALESCE(ans.n, 0) AS answers,
            COALESCE(ans.accepted, 0) AS accepted
       FROM subjects s LEFT JOIN qs ON qs.subject_id = s.id LEFT JOIN ans ON ans.subject_id = s.id
      WHERE qs.n IS NOT NULL OR ans.n IS NOT NULL
      ORDER BY COALESCE(ans.accepted, 0) DESC, COALESCE(ans.n, 0) + COALESCE(qs.n, 0) DESC, s.name
      LIMIT 8`,
    [userId, includeAnonymous],
  );
  return rows;
}

// Хичээл бүрд "тусалсан" тоогоор 1-рт бичигдэж буй хичээлүүд (тэмдэгт), 3-аас доошгүй тусалсан байх
export async function topHelperSubjects(userId) {
  const { rows } = await query(
    `WITH counts AS (
       SELECT q.subject_id, a.author_id, COUNT(*) AS n
         FROM questions q JOIN answers a ON a.id = q.accepted_answer_id
        WHERE NOT q.is_hidden AND NOT a.is_hidden AND a.author_id <> q.author_id
        GROUP BY q.subject_id, a.author_id),
     ranked AS (SELECT *, RANK() OVER (PARTITION BY subject_id ORDER BY n DESC) AS r FROM counts)
     SELECT s.id, s.name FROM ranked JOIN subjects s ON s.id = ranked.subject_id
      WHERE ranked.author_id = $1 AND ranked.r = 1 AND ranked.n >= 3 AND s.is_active
      ORDER BY s.name`,
    [userId],
  );
  return rows;
}

export async function listBookmarks(userId) {
  const { rows } = await query(
    `SELECT q.id, q.title, q.created_at AS "createdAt", b.created_at AS "savedAt",
            s.id AS subject_id, s.name AS subject_name,
            (SELECT COUNT(*)::int FROM answers a WHERE a.question_id = q.id AND NOT a.is_hidden) AS "answerCount",
            q.accepted_answer_id IS NOT NULL AS "hasAccepted"
       FROM bookmarks b JOIN questions q ON q.id = b.question_id JOIN subjects s ON s.id = q.subject_id
      WHERE b.user_id = $1 AND NOT q.is_hidden
      ORDER BY b.created_at DESC LIMIT 100`,
    [userId],
  );
  return rows;
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
