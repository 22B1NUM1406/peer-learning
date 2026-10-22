import { query } from '../../db.js';

export async function listSubjects({ includeInactive = false } = {}) {
  const { rows } = await query(
    `SELECT id, name, is_active AS "isActive"
       FROM subjects
      WHERE $1 OR is_active
      ORDER BY name`,
    [includeInactive],
  );
  return rows;
}

export async function findSubjectById(id) {
  const { rows } = await query('SELECT id, name, is_active AS "isActive" FROM subjects WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createSubject(name) {
  const { rows } = await query(
    'INSERT INTO subjects (name) VALUES ($1) RETURNING id, name, is_active AS "isActive"',
    [name],
  );
  return rows[0];
}

// COALESCE: дамжуулаагүй (null) талбарыг өөрчлөхгүй үлдээнэ
export async function updateSubject(id, { name, isActive }) {
  const { rows } = await query(
    `UPDATE subjects
        SET name = COALESCE($2, name),
            is_active = COALESCE($3, is_active)
      WHERE id = $1
      RETURNING id, name, is_active AS "isActive"`,
    [id, name ?? null, isActive ?? null],
  );
  return rows[0] ?? null;
}
