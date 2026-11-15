// Rating-ийн бүх үйлдэл транзакц дотор явагдана: db нь транзакцын client.

export async function insertVote(db, userId, answerId, awarded) {
  // PRIMARY KEY (user_id, answer_id) давхар үнэлгээг өгөгдлийн сангийн түвшинд хориглоно (NFR-10)
  const r = await db.query(
    'INSERT INTO votes (user_id, answer_id, awarded) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [userId, answerId, awarded],
  );
  return r.rowCount > 0;
}

// Устгасан үнэлгээ оноо өгсөн эсэхийг буцаана (null = үнэлгээ байгаагүй)
export async function deleteVote(db, userId, answerId) {
  const { rows } = await db.query('DELETE FROM votes WHERE user_id = $1 AND answer_id = $2 RETURNING awarded', [userId, answerId]);
  return rows[0] ? rows[0].awarded : null;
}

export async function countVotes(db, answerId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM votes WHERE answer_id = $1', [answerId]);
  return rows[0].n;
}

export async function countAwardedVotes(db, answerId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM votes WHERE answer_id = $1 AND awarded', [answerId]);
  return rows[0].n;
}

// Нэг үнэлэгчээс нэг хариулагчид сүүлийн 24 цагт оноо өгсөн үнэлгээний тоо.
// pg_advisory_xact_lock: нэг хосын зэрэг хүсэлтүүд дараалж ажиллана, хязгаар зөрчигдөхгүй.
export async function countAwardedToAuthor(db, voterId, authorId) {
  await db.query('SELECT pg_advisory_xact_lock($1, $2)', [voterId, authorId]);
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM votes v JOIN answers a ON a.id = v.answer_id
      WHERE v.user_id = $1 AND a.author_id = $2 AND v.awarded AND v.created_at > now() - interval '24 hours'`,
    [voterId, authorId],
  );
  return rows[0].n;
}

export async function addReputation(db, userId, delta) {
  if (delta === 0) return;
  // Оноо 0-ээс доош орохгүй
  await db.query('UPDATE users SET reputation = GREATEST(0, reputation + $2) WHERE id = $1', [userId, delta]);
}

// FOR UPDATE: хоёр хүсэлт зэрэг "тусалсан" тэмдэглэхэд мөрийг түгжиж, оноо буруу тооцогдохоос хамгаална
export async function lockQuestion(db, questionId) {
  const { rows } = await db.query(
    `SELECT q.id, q.author_id, q.is_hidden, q.accepted_answer_id, a.author_id AS accepted_author_id
       FROM questions q LEFT JOIN answers a ON a.id = q.accepted_answer_id
      WHERE q.id = $1 FOR UPDATE OF q`,
    [questionId],
  );
  return rows[0] ?? null;
}

export async function setAccepted(db, questionId, answerId) {
  await db.query('UPDATE questions SET accepted_answer_id = $2 WHERE id = $1', [questionId, answerId]);
}
