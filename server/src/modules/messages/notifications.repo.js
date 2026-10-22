import { query } from '../../db.js';

// db: транзакц дотроос дуудвал тухайн client-ийг дамжуулна, эс бөгөөс pool ашиглана
export async function createNotification({ userId, type, questionId }, db = { query }) {
  await db.query(
    'INSERT INTO notifications (user_id, type, question_id) VALUES ($1, $2, $3)',
    [userId, type, questionId],
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
