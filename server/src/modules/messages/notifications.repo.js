import { query } from '../../db.js';

// db: транзакц дотроос дуудвал тухайн client-ийг дамжуулна, эс бөгөөс pool ашиглана
export async function createNotification({ userId, type, questionId }, db = { query }) {
  await db.query(
    'INSERT INTO notifications (user_id, type, question_id) VALUES ($1, $2, $3)',
    [userId, type, questionId],
  );
}

// Ижил төрлийн, ижил асуултын уншаагүй мэдэгдэл байвал шинээр үүсгэхгүй (жишээ нь олон үнэлгээ)
export async function createNotificationOnce({ userId, type, questionId }, db = { query }) {
  await db.query(
    `INSERT INTO notifications (user_id, type, question_id)
     SELECT $1::int, $2::varchar, $3::int
      WHERE NOT EXISTS (SELECT 1 FROM notifications
                         WHERE user_id = $1::int AND type = $2::varchar AND question_id = $3::int AND NOT is_read)`,
    [userId, type, questionId],
  );
}

// FR-30: шинэ асуултыг тухайн хичээлд туслах боломжтой гэж бүртгүүлсэн, мэдэгдэл авахыг
// зөвшөөрсөн идэвхтэй оюутнуудад мэдэгдэнэ (асуугчаас бусад). Нэг асуулгаар бүгдэд нь.
export async function notifySubjectHelpers({ subjectId, questionId, exceptUserId }, db = { query }) {
  const r = await db.query(
    `INSERT INTO notifications (user_id, type, question_id)
     SELECT us.user_id, 'new_question', $2
       FROM user_subjects us JOIN users u ON u.id = us.user_id
      WHERE us.subject_id = $1 AND us.user_id <> $3
        AND u.status = 'active' AND u.notify_new_questions`,
    [subjectId, questionId, exceptUserId],
  );
  return r.rowCount;
}

// FR-30: хадгалсан (дагаж буй) асуултад шинэ хариулт ирэхэд мэдэгдэнэ.
// Хариулагч болон асуугч (тэр аль хэдийн new_answer авна) хасагдана.
export async function notifyFollowers({ questionId, exceptUserIds }, db = { query }) {
  await db.query(
    `INSERT INTO notifications (user_id, type, question_id)
     SELECT b.user_id, 'followed_answer', $1
       FROM bookmarks b
      WHERE b.question_id = $1 AND NOT (b.user_id = ANY($2::int[]))
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.user_id = b.user_id AND n.type = 'followed_answer'
                           AND n.question_id = $1 AND NOT n.is_read)`,
    [questionId, exceptUserIds],
  );
}

export async function listForUser(userId) {
  const { rows } = await query(
    `SELECT n.id, n.type, n.is_read AS "isRead", n.created_at AS "createdAt",
            q.id AS "questionId", q.title AS "questionTitle"
       FROM notifications n JOIN questions q ON q.id = n.question_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC LIMIT 20`,
    [userId],
  );
  return rows;
}

export async function countUnread(userId) {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [userId]);
  return rows[0].n;
}

// user_id-г шалгаснаар өөр хүний мэдэгдлийг уншсан болгох боломжгүй (NFR-03)
export async function markRead(userId, id) {
  const r = await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
  return r.rowCount > 0;
}

export async function markAllRead(userId) {
  await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read', [userId]);
}

// Асуултыг нээхэд түүнтэй холбоотой мэдэгдэл уншсан болно
export async function markReadForQuestion(userId, questionId) {
  await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND question_id = $2 AND NOT is_read', [userId, questionId]);
}
