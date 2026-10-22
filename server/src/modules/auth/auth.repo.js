import { query } from '../../db.js';

// Data access давхарга: зөвхөн SQL. Бизнесийн дүрэм энд байхгүй (NFR-11).

// Хэрэглэгчийн "нийтэд харагдах" талбарууд. password_hash-ийг хэзээ ч энэ жагсаалтад оруулахгүй.
const PUBLIC_USER = 'u.id, u.name, u.email, u.role, u.faculty, u.year, u.status, u.reputation';

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_USER}, u.password_hash FROM users u WHERE u.email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createUser({ name, email, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users AS u (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_USER}`,
    [name, email, passwordHash],
  );
  return rows[0];
}

export async function createSession({ id, userId, expiresAt }) {
  await query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [id, userId, expiresAt]);
}

// Session хүчинтэй, хэрэглэгч идэвхтэй үед л хэрэглэгчийг буцаана
export async function findUserBySessionId(sessionId) {
  const { rows } = await query(
    `SELECT ${PUBLIC_USER}
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function deleteSession(sessionId) {
  await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

// Хугацаа дууссан session-уудыг цэвэрлэнэ (нэвтрэх бүрт дуудна)
export async function deleteExpiredSessions() {
  await query('DELETE FROM sessions WHERE expires_at <= now()');
}
