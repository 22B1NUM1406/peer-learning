// Эхний өгөгдөл оруулна: npm run db:seed
//  1) Админ хэрэглэгч: ADMIN_EMAIL, ADMIN_PASSWORD орчны хувьсагчаас
//  2) МУИС-ийн сургууль, салбар, тэнхим ба хичээлийн каталог: db/num-courses.csv
//     (МУИС-ийн хичээлийн жагсаалт; бүх түвшин). Хичээл нь каталогоос сонгогдоход л subjects-д үүснэ.
// Дахин ажиллуулахад давхардуулахгүй (ON CONFLICT).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Энгийн CSV уншигч: хашилттай талбар, доторх таслал, давхар хашилтыг ("") дэмжинэ
function readCsv(file) {
  const text = fs.readFileSync(path.join(__dirname, '../db', file), 'utf8').replace(/^\uFEFF/, '');
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

// ----- МУИС-ийн бүтэц ба хичээлийн каталог: db/num-courses.csv -----
// Багана: kind (Бүрэлдэхүүн/Салбар сургууль), school, branch (салбар), department, level, code, name, credit.
// Товч нэр: сургуулийн сонгох жагсаалт, хичээлийн мөрөнд харагдана (админ засаж болно).
const SHORT = {
  'Бизнесийн сургууль': 'БС',
  'Инженер, технологийн сургууль': 'ИТС',
  'Мэдээллийн технологи, электроникийн сургууль': 'МТЭС',
  'Улс төр судлал, олон улсын харилцаа, нийтийн удирдлагын сургууль': 'УТОУХНУС',
  'Хууль зүйн сургууль': 'ХЗС',
  'Шинжлэх ухааны сургууль': 'ШУС',
  'Шинжлэх ухаан технологийн Улаанбаатар парк': 'ШУТУП',
  'Баруун бүсийн сургууль': 'ББС',
  'Завхан аймаг дахь Бизнес, мэдээллийн технологийн сургууль': 'ЗБМТС',
  'Зүүн бүсийн сургууль': 'ЗБС',
  'Эрдэнэт цогцолбор дээд сургууль': 'ЭЦДС',
};
const courses = readCsv('num-courses.csv');

// Сургууль: бүрэлдэхүүн сургуулиуд эхэнд, дараа нь салбар сургуулиуд (цагаан толгойн дарааллаар)
const schools = [...new Map(courses.map((c) => [c.school, c.kind])).entries()]
  .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0], 'mn') : a[1] === 'Бүрэлдэхүүн сургууль' ? -1 : 1));
const schoolIds = {};
let schoolCount = 0;
for (const [i, [name, kind]] of schools.entries()) {
  const short = SHORT[name];
  if (!short) throw new Error(`num-courses.csv: "${name}" сургуулийн товч нэр seed.js-ийн SHORT-д алга`);
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
for (const c of courses) if (c.department) depts.set(`${c.school}|${c.department}`, c);
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

// Каталог: мөр бүрийн түлхүүр нь бүх талбарын хослол, тиймээс файлыг сольж дахин ажиллуулахад давхардахгүй
const cols = { key: [], code: [], name: [], credit: [], level: [], branch: [], school: [], dept: [] };
for (const c of courses) {
  cols.key.push([c.school, c.branch, c.department, c.level, c.code, c.name.toLowerCase()].join('|'));
  cols.code.push(c.code || null);
  cols.name.push(c.name);
  cols.credit.push(c.credit === '' ? null : Number(c.credit));
  cols.level.push(c.level || null);
  cols.branch.push(c.branch || null);
  cols.school.push(schoolIds[c.school]);
  cols.dept.push(c.department ? deptIds[`${c.school}|${c.department}`] : null);
}
const cat = await pool.query(
  `INSERT INTO catalog_courses (source_key, code, name, credit, level, branch, school_id, department_id)
   SELECT * FROM unnest($1::text[], $2::varchar[], $3::varchar[], $4::numeric[], $5::varchar[], $6::varchar[], $7::int[], $8::int[])
   ON CONFLICT (source_key) DO UPDATE
     SET code = EXCLUDED.code, name = EXCLUDED.name, credit = EXCLUDED.credit, level = EXCLUDED.level,
         branch = EXCLUDED.branch, school_id = EXCLUDED.school_id, department_id = EXCLUDED.department_id`,
  [cols.key, cols.code, cols.name, cols.credit, cols.level, cols.branch, cols.school, cols.dept],
);
// Файлаас хасагдсан, хичээл болж сонгогдоогүй мөрийг устгана
const stale = await pool.query(
  `DELETE FROM catalog_courses c WHERE NOT (c.source_key = ANY($1::text[]))
     AND NOT EXISTS (SELECT 1 FROM subjects s WHERE s.catalog_id = c.id)`,
  [cols.key],
);
console.log(`Каталог: ${cat.rowCount} хичээл нэмэв эсвэл шинэчлэв, ${stale.rowCount} хуучин мөр устгав.`);

await pool.end();
