import { query } from '../../db.js';

export async function createMessage({ senderId, receiverId, body }) {
  const { rows } = await query(
    `INSERT INTO messages (sender_id, receiver_id, body) VALUES ($1, $2, $3)
     RETURNING id, sender_id AS "senderId", receiver_id AS "receiverId", body, created_at AS "createdAt"`,
    [senderId, receiverId, body],
  );
  return rows[0];
}

// Ярианы жагсаалт: нөгөө хүн бүрээр сүүлийн мессеж (DISTINCT ON)
export async function listConversations(userId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (other_id)
            other_id AS "userId", u.name, m.body AS "lastBody", m.created_at AS "lastAt",
            m.sender_id = $1 AS "lastFromMe"
       FROM (SELECT *, CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_id
               FROM messages WHERE sender_id = $1 OR receiver_id = $1) m
       JOIN users u ON u.id = m.other_id
      ORDER BY other_id, m.created_at DESC`,
    [userId],
  );
  return rows.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

// Хоёр хүний мессеж; before өгвөл түүнээс өмнөх 50-ыг (хуудаслалт)
export async function listMessages(userId, otherId, beforeId) {
  const { rows } = await query(
    `SELECT id, sender_id AS "senderId", receiver_id AS "receiverId", body, created_at AS "createdAt"
       FROM messages
      WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
        AND ($3::int IS NULL OR id < $3)
      ORDER BY id DESC LIMIT 50`,
    [userId, otherId, beforeId ?? null],
  );
  return rows.reverse();
}

export async function findMessage(id) {
  const { rows } = await query('SELECT id, sender_id, receiver_id FROM messages WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findActiveUser(id) {
  const { rows } = await query("SELECT id, name FROM users WHERE id = $1 AND status = 'active'", [id]);
  return rows[0] ?? null;
}
