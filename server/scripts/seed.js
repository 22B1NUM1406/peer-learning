// Эхний өгөгдөл оруулна: npm run db:seed
//  1) Админ хэрэглэгч: ADMIN_EMAIL, ADMIN_PASSWORD орчны хувьсагчаас
//  2) Хичээлүүд: db/subjects.txt файлаас (мөр бүрт нэг хичээл)
// Дахин ажиллуулахад давхардуулахгүй (ON CONFLICT DO NOTHING).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Админ' } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const hash = await hashPassword(ADMIN_PASSWORD);
  const r = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, lower($2), $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_NAME, ADMIN_EMAIL, hash],
  );
  console.log(r.rowCount ? `Админ үүслээ: ${ADMIN_EMAIL}` : 'Админ аль хэдийн байна.');
} else {
  console.log('ADMIN_EMAIL, ADMIN_PASSWORD өгөөгүй тул админ үүсгэсэнгүй.');
}

const subjects = fs.readFileSync(path.join(__dirname, '../db/subjects.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
let added = 0;
for (const name of subjects) {
  const r = await pool.query('INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  added += r.rowCount;
}
console.log(`Хичээл: ${added} шинээр нэмэгдэв (нийт файлд ${subjects.length}).`);

await pool.end();
