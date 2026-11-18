// Эхний өгөгдөл оруулна: npm run db:seed
//  1) Админ хэрэглэгч: ADMIN_EMAIL, ADMIN_PASSWORD орчны хувьсагчаас
//  2) Бүрэлдэхүүн сургууль, тэнхим: db/schools.txt
//  3) Хичээлүүд: db/subjects.txt файлаас (мөр бүрт нэг хичээл, сургууль, тэнхим)
//  4) МУИС-ийн хичээлийн каталог: db/num-courses.tsv (SiSi-ээс, хайлтад)
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
// Эхлээд файлыг уншиж, сургуулиудыг нэмнэ; дараа нь хуучин нэрийг шилжүүлээд тэнхимүүдийг нэмнэ.
const parsed = [];
for (const line of read('schools.txt')) {
  if (line.startsWith('=')) {
    const [name, short] = line.slice(1).split('|').map((x) => x.trim());
    parsed.push({ name, short, depts: [] });
  } else if (line.startsWith('-') && parsed.length) {
    parsed.at(-1).depts.push(line.slice(1).trim());
  }
}
const schoolIds = {};
const deptIds = {};
let order = 0, schoolCount = 0, deptCount = 0;
for (const sc of parsed) {
  const r = await pool.query(
    `INSERT INTO schools (name, short_name, sort_order) VALUES ($1, $2, $3)
     ON CONFLICT (short_name) DO UPDATE SET short_name = EXCLUDED.short_name RETURNING id, (xmax = 0) AS inserted`,
    [sc.name, sc.short, ++order],
  );
  schoolIds[sc.short] = r.rows[0].id;
  schoolCount += r.rows[0].inserted ? 1 : 0;
}

// 2026-11-18: нэрийг SiSi-ийн албан ёсны бичлэгээр шинэчлэв. Хуучин нэр байгаа бол нэг удаа солино;
// шинэ нэр аль хэдийн байвал хуучин тэнхимийн хичээлүүдийг шинэ рүү шилжүүлж, хуучныг устгана.
const SCHOOL_RENAMES = [
  ['ИТС', 'Инженер технологийн сургууль', 'Инженер, технологийн сургууль'],
  ['УТОУХНУС', 'Улс төр судлал, Олон улсын харилцаа, нийтийн удирдлагын сургууль', 'Улс төр судлал, олон улсын харилцаа, нийтийн удирдлагын сургууль'],
];
for (const [short, from, to] of SCHOOL_RENAMES) {
  await pool.query('UPDATE schools SET name = $3 WHERE short_name = $1 AND name = $2', [short, from, to]);
}
// [хуучин сургууль, хуучин нэр, шинэ сургууль, шинэ нэр]
const DEPT_MOVES = [
  ['МТЭС', 'Мэдээлэл, компьютерын ухааны тэнхим', 'МТЭС', 'Мэдээлэл, компьютерийн ухааны тэнхим'],
  ['НУС', 'Антропологи, археологийн тэнхим', 'НУС', 'Археологи, антропологи, хүн ам зүйн тэнхим'],
  ['БС', 'Маркетинг, худалдааны тэнхим', 'БС', 'Маркетинг худалдааны тэнхим'],
  ['НУС', 'Улс төр судлалын тэнхим', 'УТОУХНУС', 'Улс төр судлалын тэнхим'],   // SiSi-д УТОУХНУС-д харьяалагдана
];
for (const [fromSc, fromName, toSc, toName] of DEPT_MOVES) {
  const old = await pool.query('SELECT id FROM departments WHERE school_id = $1 AND name = $2', [schoolIds[fromSc], fromName]);
  if (!old.rowCount) continue;
  const oldId = old.rows[0].id;
  const target = await pool.query('SELECT id FROM departments WHERE school_id = $1 AND name = $2', [schoolIds[toSc], toName]);
  if (!target.rowCount) {
    await pool.query('UPDATE departments SET school_id = $2, name = $3 WHERE id = $1', [oldId, schoolIds[toSc], toName]);
    if (fromSc !== toSc) await pool.query('UPDATE subjects SET school_id = $2 WHERE department_id = $1', [oldId, schoolIds[toSc]]);
  } else {
    const newId = target.rows[0].id;
    await pool.query('UPDATE subjects SET department_id = $2, school_id = $3 WHERE department_id = $1', [oldId, newId, schoolIds[toSc]]);
    await pool.query('UPDATE catalog_courses SET department_id = $2 WHERE department_id = $1', [oldId, newId]);
    await pool.query('DELETE FROM departments WHERE id = $1', [oldId]);
  }
  console.log(`Тэнхим шилжүүлэв: ${fromSc} “${fromName}” → ${toSc} “${toName}”`);
}

for (const sc of parsed) {
  for (const name of sc.depts) {
    const r = await pool.query(
      `INSERT INTO departments (school_id, name) VALUES ($1, $2)
       ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id, (xmax = 0) AS inserted`,
      [schoolIds[sc.short], name],
    );
    deptIds[`${sc.short}|${name}`] = r.rows[0].id;
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

// МУИС-ийн хичээлийн каталог: db/num-courses.tsv (SiSi-ийн "Хичээл" цэснээс, бакалаврын түвшин).
// Мөр бүр: сургуулийн түлхүүр, тэнхим (нэгж), код, нэр, кредит, SiSi-ийн courseid.
// Нэгж нь сургууль/салбар өөрөө бол тэнхимгүй гэж үзнэ. sisi_id-аар шинэчлэх тул дахин ажиллуулахад давхардахгүй.
const SISI_SCHOOLS = { IT: 'МТЭС', NAT: 'БУС', SOC: 'НУС', HUM: 'ХУС', ENG: 'ИТС', BS: 'БС', LAW: 'ХЗС', POL: 'УТОУХНУС' };
const SCHOOL_UNITS = new Set([
  'Мэдээллийн технологи, электроникийн сургууль', 'Байгалийн ухааны салбар', 'Нийгмийн ухааны салбар',
  'Хүмүүнлэгийн ухааны салбар', 'Инженер, технологийн сургууль', 'Бизнесийн сургууль', 'Хууль зүйн сургууль',
  'Улс төр судлал, олон улсын харилцаа, нийтийн удирдлагын сургууль',
]);
const cols = { sisi: [], code: [], name: [], credit: [], school: [], dept: [] };
for (const line of read('num-courses.tsv')) {
  const [key, unit, code, name, credit, sisiId] = line.split('\t').map((x) => x.trim());
  const short = SISI_SCHOOLS[key];
  if (!short) throw new Error(`num-courses.tsv: "${key}" сургууль танигдсангүй`);
  const dept = SCHOOL_UNITS.has(unit) ? null : deptIds[`${short}|${unit}`];
  if (dept === undefined) throw new Error(`num-courses.tsv: "${unit}" тэнхим ${short}-д schools.txt-д алга`);
  cols.sisi.push(Number(sisiId));
  cols.code.push(code.replace(/\s+/g, '').toUpperCase() || null);
  cols.name.push(name.replace(/\s+/g, ' '));
  cols.credit.push(credit === '' ? null : Number(credit));
  cols.school.push(schoolIds[short]);
  cols.dept.push(dept);
}
const cat = await pool.query(
  `INSERT INTO catalog_courses (sisi_id, code, name, credit, school_id, department_id)
   SELECT * FROM unnest($1::int[], $2::varchar[], $3::varchar[], $4::numeric[], $5::int[], $6::int[])
   ON CONFLICT (sisi_id) DO UPDATE
     SET code = EXCLUDED.code, name = EXCLUDED.name, credit = EXCLUDED.credit,
         school_id = EXCLUDED.school_id, department_id = EXCLUDED.department_id, imported_at = now()`,
  [cols.sisi, cols.code, cols.name, cols.credit, cols.school, cols.dept],
);
console.log(`Каталог: ${cat.rowCount} хичээл импортлов эсвэл шинэчлэв.`);

await pool.end();
