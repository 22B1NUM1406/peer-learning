import { query } from '../../db.js';

// Хичээлийн каталог: хичээл, түүнийг заадаг бүрэлдэхүүн сургууль ба тэнхим.
const SUBJECT_COLS = `s.id, s.name, s.code, s.is_active AS "isActive",
       s.school_id AS "schoolId", sc.short_name AS "schoolShortName", sc.name AS "schoolName",
       s.department_id AS "departmentId", d.name AS "departmentName",
       s.created_by AS "createdBy", cu.name AS "createdByName"`;
const SUBJECT_FROM = `subjects s
  LEFT JOIN schools sc ON sc.id = s.school_id
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN users cu ON cu.id = s.created_by`;

export async function listSubjects({ includeInactive = false, schoolId = null, departmentId = null } = {}) {
  const { rows } = await query(
    `SELECT ${SUBJECT_COLS},
            (SELECT COUNT(*)::int FROM questions q WHERE q.subject_id = s.id AND NOT q.is_hidden) AS "questionCount"
       FROM ${SUBJECT_FROM}
      WHERE ($1 OR s.is_active)
        AND ($2::int IS NULL OR s.school_id = $2)
        AND ($3::int IS NULL OR s.department_id = $3)
      ORDER BY s.name`,
    [includeInactive, schoolId, departmentId],
  );
  return rows;
}

export async function findSubjectById(id) {
  const { rows } = await query(`SELECT ${SUBJECT_COLS} FROM ${SUBJECT_FROM} WHERE s.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createSubject({ name, code, schoolId, departmentId, createdBy }) {
  const { rows } = await query(
    'INSERT INTO subjects (name, code, school_id, department_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name, code ?? null, schoolId ?? null, departmentId ?? null, createdBy ?? null],
  );
  return findSubjectById(rows[0].id);
}

// undefined талбарыг өөрчлөхгүй; null нь утгыг арилгана (жишээ нь кодыг хасах)
export async function updateSubject(id, changes) {
  const map = { name: 'name', code: 'code', schoolId: 'school_id', departmentId: 'department_id', isActive: 'is_active' };
  const sets = [];
  const params = [id];
  for (const [key, col] of Object.entries(map)) {
    if (changes[key] !== undefined) {
      params.push(changes[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length) {
    const r = await query(`UPDATE subjects SET ${sets.join(', ')} WHERE id = $1`, params);
    if (!r.rowCount) return null;
  }
  return findSubjectById(id);
}

// ----- Бүрэлдэхүүн сургууль, тэнхим -----

export async function listSchools() {
  const { rows } = await query(
    `SELECT sc.id, sc.name, sc.short_name AS "shortName",
            (SELECT COUNT(*)::int FROM subjects s WHERE s.school_id = sc.id AND s.is_active) AS "subjectCount",
            COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name) ORDER BY d.name)
                     FILTER (WHERE d.id IS NOT NULL), '[]') AS departments
       FROM schools sc LEFT JOIN departments d ON d.school_id = sc.id
      GROUP BY sc.id
      ORDER BY sc.sort_order, sc.name`,
  );
  return rows;
}

export async function findDepartment(id) {
  const { rows } = await query('SELECT id, school_id AS "schoolId", name FROM departments WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function schoolExists(id) {
  const { rowCount } = await query('SELECT 1 FROM schools WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function createSchool({ name, shortName }) {
  const { rows } = await query(
    `INSERT INTO schools (name, short_name, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM schools))
     RETURNING id, name, short_name AS "shortName"`,
    [name, shortName],
  );
  return rows[0];
}

export async function updateSchool(id, { name, shortName }) {
  const { rows } = await query(
    `UPDATE schools SET name = COALESCE($2, name), short_name = COALESCE($3, short_name)
      WHERE id = $1 RETURNING id, name, short_name AS "shortName"`,
    [id, name ?? null, shortName ?? null],
  );
  return rows[0] ?? null;
}

export async function createDepartment(schoolId, name) {
  const { rows } = await query(
    'INSERT INTO departments (school_id, name) VALUES ($1, $2) RETURNING id, school_id AS "schoolId", name',
    [schoolId, name],
  );
  return rows[0];
}

export async function renameDepartment(id, name) {
  const { rows } = await query(
    'UPDATE departments SET name = $2 WHERE id = $1 RETURNING id, school_id AS "schoolId", name',
    [id, name],
  );
  return rows[0] ?? null;
}

// FR-27: шинэ хичээл нэмэхийн өмнө ижил төстэй идэвхтэй хичээлийг санал болгоно.
// Нэр (trigram төстэй байдал, жишээ нь "бутэц" ↔ "бүтэц") эсвэл кодоор (яг тэнцүү) таарсныг буцаана.
export async function similarSubjects(name, code, limit = 5) {
  const { rows } = await query(
    `SELECT ${SUBJECT_COLS}, round(similarity(s.name, $1)::numeric, 2)::float AS score
       FROM ${SUBJECT_FROM}
      WHERE s.is_active AND (similarity(s.name, $1) >= 0.3 OR lower(s.name) = lower($1)
                             OR ($2::text IS NOT NULL AND s.code = $2))
      ORDER BY (s.code = $2) DESC NULLS LAST, score DESC
      LIMIT $3`,
    [name, code ?? null, limit],
  );
  return rows;
}

export async function findSubjectByName(name) {
  const { rows } = await query(`SELECT ${SUBJECT_COLS} FROM ${SUBJECT_FROM} WHERE lower(s.name) = lower($1)`, [name]);
  return rows[0] ?? null;
}

// Сүүлийн 24 цагт тухайн хэрэглэгчийн нэмсэн хичээлийн тоо (хэт олон нэмэхээс сэргийлнэ)
export async function countRecentByUser(userId) {
  const { rows } = await query(
    "SELECT COUNT(*)::int AS n FROM subjects WHERE created_by = $1 AND created_at > now() - interval '24 hours'",
    [userId],
  );
  return rows[0].n;
}
