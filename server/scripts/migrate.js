// Өгөгдлийн сангийн схемийг үүсгэж, шинэчилнэ: npm run db:migrate (сервер асах бүрд ажиллана)
//  1) Хүснэгтүүд байхгүй бол db/schema.sql-ээр анхны схемийг үүсгэнэ.
//  2) db/migrations/*.sql-ийг нэрийн дарааллаар, тус бүрийг НЭГ Л УДАА ажиллуулна: ажилласан файлыг
//     schema_migrations хүснэгтэд тэмдэглэнэ. Файл бүр өөрийн transaction-д ажиллах тул алдаа гарвал
//     тэр файлын өөрчлөлт бүхэлдээ буцна.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../db/migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// Өмнөх хувилбар migration-ийг сервер асах бүрд бүгдийг нь дахин ажиллуулдаг байв. Тиймээс бүртгэлгүй
// хуучин өгөгдлийн санд 006 хүртэлх файлууд аль хэдийн ажилласан гэж тэмдэглэнэ (дахин ажиллуулахгүй).
const BASELINE = ['001', '002', '003', '004', '005', '006'];

const fresh = !(await pool.query("SELECT to_regclass('public.users') AS t")).rows[0].t;
const tracked = (await pool.query("SELECT to_regclass('public.schema_migrations') AS t")).rows[0].t;
if (fresh) {
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  console.log('Анхны схем үүслээ.');
}
await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);
if (!fresh && !tracked) {
  const base = files.filter((f) => BASELINE.includes(f.slice(0, 3)));
  for (const f of base) await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
  console.log(`Migration бүртгэл эхлэв: ${base.length} файлыг ажилласан гэж тэмдэглэв.`);
}

const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
for (const file of files) {
  if (done.has(file)) continue;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Шинэчлэл: ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
await pool.end();
