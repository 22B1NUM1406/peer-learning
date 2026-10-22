// Өгөгдлийн сангийн схемийг үүсгэнэ: npm run db:migrate
// Хүснэгтүүд аль хэдийн байвал юу ч хийхгүй (дахин ажиллуулахад аюулгүй).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { rows } = await pool.query("SELECT to_regclass('public.users') AS t");
if (rows[0].t) {
  console.log('Схем аль хэдийн үүссэн байна. Алгасав.');
} else {
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Схем үүслээ: 12 хүснэгт.');
}
await pool.end();
