// Эхний өгөгдөл оруулна: npm run db:seed
//  1) Админ хэрэглэгч: ADMIN_EMAIL, ADMIN_PASSWORD орчны хувьсагчаас
//  2) МУИС-ийн бүрэлдэхүүн ба салбар сургууль, салбар, тэнхим: db/schools.csv
//     Хичээлийг оюутнууд өөрсдөө нэмнэ (FR-27); seed хичээл оруулахгүй.
// Дахин ажиллуулахад давхардуулахгүй (ON CONFLICT).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Энгийн CSV уншигч: хашилттай талбар, доторх таслал, давхар хашилтыг ("") дэмжинэ
function readCsv(file) {
  const text = fs.readFileSync(path.join(__dirname, '../db', file), 'utf8').replace(/^\uFEFF/, '')
    .split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, k) => [h, r[k].trim()])));
}

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

// ----- МУИС-ийн бүтэц: db/schools.csv -----
// Багана: kind (Бүрэлдэхүүн/Салбар сургууль), school, short_name, branch (салбар), department.
// Хичээлийг оюутнууд өөрсдөө нэмнэ (FR-27); seed хичээл оруулахгүй.
const units = readCsv('schools.csv');

// Сургууль: бүрэлдэхүүн сургуулиуд эхэнд, дараа нь салбар сургуулиуд (цагаан толгойн дарааллаар)
const schools = [...new Map(units.map((c) => [c.school, c.kind])).entries()]
  .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0], 'mn') : a[1] === 'Бүрэлдэхүүн сургууль' ? -1 : 1));
const schoolIds = {};
let schoolCount = 0;
for (const [i, [name, kind]] of schools.entries()) {
  const short = units.find((c) => c.school === name).short_name;
  const r = await pool.query(
    `INSERT INTO schools (name, short_name, kind, sort_order) VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET kind = EXCLUDED.kind RETURNING id, (xmax = 0) AS inserted`,
    [name, short, kind, i + 1],
  );
  schoolIds[name] = r.rows[0].id;
  schoolCount += r.rows[0].inserted ? 1 : 0;
}

// Тэнхим / нэгж (салбартай нь)
const deptIds = {};
let deptCount = 0;
const depts = new Map();
for (const c of units) if (c.department) depts.set(`${c.school}|${c.department}`, c);
for (const [key, c] of depts) {
  const r = await pool.query(
    `INSERT INTO departments (school_id, name, branch) VALUES ($1, $2, $3)
     ON CONFLICT (school_id, name) DO UPDATE SET branch = EXCLUDED.branch RETURNING id, (xmax = 0) AS inserted`,
    [schoolIds[c.school], c.department, c.branch || null],
  );
  deptIds[key] = r.rows[0].id;
  deptCount += r.rows[0].inserted ? 1 : 0;
}
console.log(`Сургууль: ${schools.length} (${schoolCount} шинэ), тэнхим, нэгж: ${depts.size} (${deptCount} шинэ).`);

await pool.end();
