import { query } from '../../db.js';

// FR-07, FR-13: асуултын жагсаалт, хичээлээр шүүх, хайх, эрэмбэлэх.
// tsQuery: service-д бэлтгэсэн 'үг1:* & үг2:*' хэлбэрийн мөр эсвэл null.
export async function listQuestions({ subjectId, sort, tsQuery, authorId, limit, offset }) {
  const params = [subjectId ?? null, tsQuery, limit, offset];
  const where = [
    'NOT q.is_hidden',
    '($1::int IS NULL OR q.subject_id = $1)',
    '($2::text IS NULL OR q.search_vector @@ to_tsquery(\'simple\', $2))',
  ];
  if (sort === 'unanswered') {
    where.push('NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id AND NOT a.is_hidden)');
  }
  if (authorId) {
    params.push(authorId);
    where.push(`q.author_id = $${params.length}`);
  }
  // Хайлттай үед хамаарлаар (ts_rank), эс бөгөөс шинэ нь эхэнд
  const order = tsQuery
    ? "ts_rank(q.search_vector, to_tsquery('simple', $2)) DESC, q.created_at DESC"
    : 'q.created_at DESC';

  const { rows } = await query(
    `SELECT q.id, q.title, LEFT(q.body, 220) AS excerpt, q.created_at, q.is_anonymous,
            q.author_id, u.name AS author_name, u.reputation AS author_reputation,
            s.id AS subject_id, s.name AS subject_name,
            q.accepted_answer_id IS NOT NULL AS has_accepted,
            (SELECT COUNT(*)::int FROM answers a WHERE a.question_id = q.id AND NOT a.is_hidden) AS answer_count,
            COUNT(*) OVER()::int AS total
       FROM questions q
       JOIN users u ON u.id = q.author_id
       JOIN subjects s ON s.id = q.subject_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT $3 OFFSET $4`,
    params,
  );
  return rows;
}

// FR-25: pg_trgm-ийн similarity()-ээр гарчгийн төстэй байдлыг 0–1 хооронд тооцно
export async function similarQuestions(title, threshold, limit = 5) {
  const { rows } = await query(
    `SELECT q.id, q.title, s.name AS "subjectName",
            q.accepted_answer_id IS NOT NULL AS "hasAccepted",
            round(similarity(q.title, $1)::numeric, 2)::float AS score
       FROM questions q JOIN subjects s ON s.id = q.subject_id
      WHERE NOT q.is_hidden AND similarity(q.title, $1) >= $2
      ORDER BY score DESC, q.created_at DESC
      LIMIT $3`,
    [title, threshold, limit],
  );
  return rows;
}
