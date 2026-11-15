// Эхний өгөгдөл оруулна: npm run db:seed
//  1) Админ хэрэглэгч: ADMIN_EMAIL, ADMIN_PASSWORD орчны хувьсагчаас
//  2) Бүрэлдэхүүн сургууль, тэнхим: db/schools.txt
//  3) Хичээлүүд: db/subjects.txt файлаас (мөр бүрт нэг хичээл, сургууль, тэнхим)
// Дахин ажиллуулахад давхардуулахгүй (ON CONFLICT DO NOTHING).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(__dirname, '../db', file), 'utf8')
  .split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));

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

// Бүрэлдэхүүн сургууль, тэнхим: db/schools.txt
const schoolIds = {};
const deptIds = {};
let school = null, order = 0, schoolCount = 0, deptCount = 0;
for (const line of read('schools.txt')) {
  if (line.startsWith('=')) {
    const [name, short] = line.slice(1).split('|').map((x) => x.trim());
    const r = await pool.query(
      `INSERT INTO schools (name, short_name, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (short_name) DO UPDATE SET short_name = EXCLUDED.short_name RETURNING id, (xmax = 0) AS inserted`,
      [name, short, ++order],
    );
    school = short;
    schoolIds[short] = r.rows[0].id;
    schoolCount += r.rows[0].inserted ? 1 : 0;
  } else if (line.startsWith('-') && school) {
    const name = line.slice(1).trim();
    const r = await pool.query(
      `INSERT INTO departments (school_id, name) VALUES ($1, $2)
       ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id, (xmax = 0) AS inserted`,
      [schoolIds[school], name],
    );
    deptIds[`${school}|${name}`] = r.rows[0].id;
    deptCount += r.rows[0].inserted ? 1 : 0;
  }
}
console.log(`Сургууль: ${schoolCount}, тэнхим: ${deptCount} шинээр нэмэгдэв.`);

// Хичээлүүд: db/subjects.txt ("Нэр | Сургууль | Тэнхим"). Байгаа хичээлд сургууль оноогоогүй бол л
// файлын утгыг онооно; админы хийсэн хуваарилалтыг дарж бичихгүй.
let added = 0;
const subjects = read('subjects.txt');
for (const line of subjects) {
  const [name, short, dept] = line.split('|').map((x) => x.trim());
  if (short && !schoolIds[short]) throw new Error(`subjects.txt: "${short}" сургууль schools.txt-д алга`);
  if (dept && !deptIds[`${short}|${dept}`]) throw new Error(`subjects.txt: "${dept}" тэнхим ${short}-д алга`);
  const r = await pool.query(
    `INSERT INTO subjects (name, school_id, department_id) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE
       SET school_id = COALESCE(subjects.school_id, EXCLUDED.school_id),
           department_id = COALESCE(subjects.department_id, EXCLUDED.department_id)
     WHERE subjects.school_id IS NULL`,
    [name, schoolIds[short] ?? null, deptIds[`${short}|${dept}`] ?? null],
  );
  added += r.rowCount;
}
console.log(`Хичээл: ${added} нэмэгдэж эсвэл сургуульд хуваарилагдав (нийт файлд ${subjects.length}).`);

await pool.end();
