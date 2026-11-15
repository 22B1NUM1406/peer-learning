import { pool, query } from '../../db.js';

// FR-07, FR-13: асуултын жагсаалт, хичээлээр шүүх, хайх, эрэмбэлэх.
// tsQuery: service-д бэлтгэсэн 'үг1:* & үг2:*' хэлбэрийн мөр эсвэл null.
export async function listQuestions({ subjectId, schoolId, sort, tsQuery, authorId, limit, offset }) {
  const params = [subjectId ?? null, tsQuery, limit, offset];
  const where = [
    'NOT q.is_hidden',
    '($1::int IS NULL OR q.subject_id = $1)',
    '($2::text IS NULL OR q.search_vector @@ to_tsquery(\'simple\', $2))',
  ];
  if (sort === 'unanswered') {
    where.push('NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id AND NOT a.is_hidden)');
  }
  if (schoolId) {
    params.push(schoolId);
    where.push(`s.school_id = $${params.length}`);
  }
  if (authorId) {
    params.push(authorId);
    where.push(`q.author_id = $${params.length}`);
  }
  // Хайлттай үед хамаарлаар (ts_rank); "Түгээмэл" бол хариултуудын авсан "тустай" үнэлгээгээр;
  // эс бөгөөс шинэ нь эхэнд
  const order = tsQuery
    ? "ts_rank(q.search_vector, to_tsquery('simple', $2)) DESC, q.created_at DESC"
    : sort === 'popular'
      ? 'vote_count DESC, answer_count DESC, q.created_at DESC'
      : 'q.created_at DESC';

  const { rows } = await query(
    `SELECT q.id, q.title, LEFT(q.body, 220) AS excerpt, q.created_at, q.is_anonymous,
            q.author_id, u.name AS author_name, u.reputation AS author_reputation,
            s.id AS subject_id, s.name AS subject_name, s.code AS subject_code, sc.short_name AS school_short_name,
            q.accepted_answer_id IS NOT NULL AS has_accepted,
            (SELECT COUNT(*)::int FROM answers a WHERE a.question_id = q.id AND NOT a.is_hidden) AS answer_count,
            (SELECT COUNT(*)::int FROM votes v JOIN answers a ON a.id = v.answer_id
              WHERE a.question_id = q.id AND NOT a.is_hidden) AS vote_count,
            COUNT(*) OVER()::int AS total
       FROM questions q
       JOIN users u ON u.id = q.author_id
       JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN schools sc ON sc.id = s.school_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT $3 OFFSET $4`,
    params,
  );
  return rows;
}

// FR-25: pg_trgm-ийн similarity()-ээр гарчгийн төстэй байдлыг 0–1 хооронд тооцно.
// `%` оператор нь гарчгийн GIN trigram индексийг (questions_title_trgm) ашигладаг бөгөөд
// босгыг set_limit()-ээр тогтооно. Хоёр асуулга нэг холболт дээр ажиллах ёстой тул client авна.
export async function similarQuestions(title, threshold, limit = 5) {
  const client = await pool.connect();
  try {
    await client.query('SELECT set_limit($1)', [threshold]);
    const { rows } = await client.query(
      `SELECT q.id, q.title, s.name AS "subjectName",
              q.accepted_answer_id IS NOT NULL AS "hasAccepted",
              round(similarity(q.title, $1)::numeric, 2)::float AS score
         FROM questions q JOIN subjects s ON s.id = q.subject_id
        WHERE q.title % $1 AND NOT q.is_hidden
        ORDER BY score DESC, q.created_at DESC
        LIMIT $2`,
      [title, limit],
    );
    return rows;
  } finally {
    client.release();
  }
}

// Нүүр хуудасны хажуугийн самбар: бодит өгөгдлөөс тооцсон гурван жагсаалт ба нийт тоо.
// Зөвхөн уншина; нуусан контент, түдгэлзүүлсэн хэрэглэгч, админыг тооцохгүй.
export async function communityStats(days, limit = 5) {
  const [trending, active, top, totals] = await Promise.all([
    query(
      `SELECT s.id, s.name, COUNT(q.id)::int AS "questionCount"
         FROM subjects s JOIN questions q ON q.subject_id = s.id
        WHERE s.is_active AND NOT q.is_hidden AND q.created_at > now() - make_interval(days => $1)
        GROUP BY s.id
        ORDER BY "questionCount" DESC, s.name
        LIMIT $2`, [days, limit]),
    query(
      `SELECT u.id, u.name, COUNT(a.id)::int AS "answerCount"
         FROM users u JOIN answers a ON a.author_id = u.id
        WHERE u.role = 'student' AND u.status = 'active'
          AND NOT a.is_hidden AND a.created_at > now() - make_interval(days => $1)
        GROUP BY u.id
        ORDER BY "answerCount" DESC, u.name
        LIMIT $2`, [days, limit]),
    query(
      `SELECT u.id, u.name, u.reputation,
              (SELECT COUNT(*)::int FROM questions q JOIN answers a ON a.id = q.accepted_answer_id
                WHERE a.author_id = u.id AND NOT a.is_hidden AND NOT q.is_hidden) AS "acceptedCount"
         FROM users u
        WHERE u.role = 'student' AND u.status = 'active' AND u.reputation > 0
        ORDER BY u.reputation DESC, u.name
        LIMIT $1`, [limit]),
    query(
      `SELECT (SELECT COUNT(*)::int FROM questions WHERE NOT is_hidden) AS questions,
              (SELECT COUNT(*)::int FROM questions WHERE NOT is_hidden AND accepted_answer_id IS NOT NULL) AS "acceptedQuestions",
              (SELECT COUNT(*)::int FROM answers WHERE NOT is_hidden) AS answers,
              (SELECT COUNT(*)::int FROM users WHERE role = 'student' AND status = 'active') AS students`),
  ]);
  return {
    days,
    totals: totals.rows[0],
    trendingSubjects: trending.rows,
    activeStudents: active.rows,
    topContributors: top.rows,
  };
}
