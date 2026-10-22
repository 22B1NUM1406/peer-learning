import { query } from '../../db.js';

export async function createReport({ reporterId, targetType, targetId, reason }) {
  const { rows } = await query(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)
     ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING RETURNING id`,
    [reporterId, targetType, targetId, reason],
  );
  return rows[0]?.id ?? null;
}

// Мэдээлсэн контентын эзэн ба харагдах байдлыг төрлөөс нь хамааруулж олно
const TARGET_SQL = {
  question: `SELECT author_id AS owner_id, is_hidden, NULL::int AS other_id FROM questions WHERE id = $1`,
  answer: `SELECT a.author_id AS owner_id, (a.is_hidden OR q.is_hidden) AS is_hidden, NULL::int AS other_id
             FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = $1`,
  comment: `SELECT author_id AS owner_id, FALSE AS is_hidden, NULL::int AS other_id FROM comments WHERE id = $1`,
  resource: `SELECT author_id AS owner_id, is_hidden, NULL::int AS other_id FROM resources WHERE id = $1`,
  message: `SELECT sender_id AS owner_id, FALSE AS is_hidden, receiver_id AS other_id FROM messages WHERE id = $1`,
};

export async function findTarget(type, id) {
  const { rows } = await query(TARGET_SQL[type], [id]);
  return rows[0] ?? null;
}

// P10: мэдээлэл бүрийн контентын товч агуулга, эзэн, асуулт руу очих холбоос
export async function listReports(status) {
  const { rows } = await query(
    `SELECT r.id, r.target_type AS "targetType", r.target_id AS "targetId", r.reason, r.status,
            r.created_at AS "createdAt", rep.id AS "reporterId", rep.name AS "reporterName",
            COALESCE(q.title, LEFT(a.body, 200), LEFT(c.body, 200), rs.title, LEFT(m.body, 200)) AS preview,
            COALESCE(q.author_id, a.author_id, c.author_id, rs.author_id, m.sender_id) AS "ownerId",
            ow.name AS "ownerName", ow.status AS "ownerStatus",
            COALESCE(q.is_hidden, a.is_hidden, rs.is_hidden, FALSE) AS "isHidden",
            COALESCE(q.id, a.question_id, c.question_id, ca.question_id) AS "questionId",
            rs.subject_id AS "subjectId",
            (SELECT COUNT(*)::int FROM reports r2
              WHERE r2.target_type = r.target_type AND r2.target_id = r.target_id AND r2.status = 'open') AS "openCount"
       FROM reports r
       JOIN users rep ON rep.id = r.reporter_id
       LEFT JOIN questions q ON r.target_type = 'question' AND q.id = r.target_id
       LEFT JOIN answers a   ON r.target_type = 'answer'   AND a.id = r.target_id
       LEFT JOIN comments c  ON r.target_type = 'comment'  AND c.id = r.target_id
       LEFT JOIN answers ca  ON ca.id = c.answer_id
       LEFT JOIN resources rs ON r.target_type = 'resource' AND rs.id = r.target_id
       LEFT JOIN messages m  ON r.target_type = 'message'  AND m.id = r.target_id
       LEFT JOIN users ow ON ow.id = COALESCE(q.author_id, a.author_id, c.author_id, rs.author_id, m.sender_id)
      WHERE r.status = $1
      ORDER BY r.created_at ${status === 'open' ? 'ASC' : 'DESC'}
      LIMIT 200`,
    [status],
  );
  return rows;
}

export async function findReport(id) {
  const { rows } = await query('SELECT id, target_type, target_id, status FROM reports WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Нэг контентын бүх нээлттэй мэдээллийг хамт хаана
export async function resolveReports(targetType, targetId, status, adminId) {
  await query(
    `UPDATE reports SET status = $3, resolved_by = $4
      WHERE target_type = $1 AND target_id = $2 AND status = 'open'`,
    [targetType, targetId, status, adminId],
  );
}

const HIDEABLE = { question: 'questions', answer: 'answers', resource: 'resources' };

export async function hideTarget(type, id) {
  await query(`UPDATE ${HIDEABLE[type]} SET is_hidden = TRUE WHERE id = $1`, [id]);
}
export const canHide = (type) => type in HIDEABLE;

export async function setUserStatus(id, status) {
  const { rows } = await query(
    'UPDATE users SET status = $2 WHERE id = $1 RETURNING id, name, status',
    [id, status],
  );
  return rows[0] ?? null;
}

export async function deleteSessionsOf(userId) {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

export async function listUsers({ status, q }) {
  const { rows } = await query(
    `SELECT id, name, email, role, status, reputation, created_at AS "createdAt"
       FROM users
      WHERE ($1::text IS NULL OR status = $1)
        AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%')
      ORDER BY created_at DESC LIMIT 100`,
    [status ?? null, q ?? null],
  );
  return rows;
}
