import { query } from '../../db.js';

const COLUMNS = `r.id, r.title, r.description, r.url, r.file_path, r.mime_type, r.file_size,
                 r.is_hidden, r.created_at, r.author_id, u.name AS author_name, r.subject_id`;

export async function createResource({ authorId, subjectId, title, description, url, filePath, mimeType, fileSize }) {
  const { rows } = await query(
    `INSERT INTO resources (author_id, subject_id, title, description, url, file_path, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [authorId, subjectId, title, description ?? null, url ?? null, filePath ?? null, mimeType ?? null, fileSize ?? null],
  );
  return rows[0].id;
}

export async function listBySubject(subjectId) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM resources r JOIN users u ON u.id = r.author_id
      WHERE r.subject_id = $1 AND NOT r.is_hidden
      ORDER BY r.created_at DESC LIMIT 100`,
    [subjectId],
  );
  return rows;
}

export async function findResource(id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM resources r JOIN users u ON u.id = r.author_id WHERE r.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteResource(id) {
  await query('DELETE FROM resources WHERE id = $1', [id]);
}
