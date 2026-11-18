import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, api, createSubject } from './helpers.js';

// МУИС-ийн хичээлийн каталог (SiSi-ээс импортолсон): хайх, сонгоход хичээл үүсэх.

let student, other, site, mcs;
const q = (s) => `/api/subjects/search?q=${encodeURIComponent(s)}`;

async function addCourse(key, code, name, { deptId = mcs, school = site, level = 'Бакалавр' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO catalog_courses (source_key, code, name, credit, level, school_id, department_id)
     VALUES ($1, $2, $3, 3, $4, $5, $6) RETURNING id`, [String(key), code, name, level, school, deptId]);
  return rows[0].id;
}

before(resetDb);
beforeEach(async () => {
  await resetDb();
  student = await login('student@example.com', { name: 'Оюутан' });
  other = await login('other@example.com', { name: 'Нөгөө' });
  site = (await pool.query("INSERT INTO schools (name, short_name) VALUES ('МТЭС', 'МТЭС') RETURNING id")).rows[0].id;
  mcs = (await pool.query('INSERT INTO departments (school_id, name) VALUES ($1, $2) RETURNING id', [site, 'Мэдээлэл, компьютерийн ухааны тэнхим'])).rows[0].id;
  await addCourse(1, 'ICSI202', 'Өгөгдлийн бүтэц');
  await addCourse(2, 'ICSI311', 'Өгөгдлийн сангийн систем');
  await addCourse(3, 'CSSW333', 'Өгөгдлийн сан ба вэб программчлал');
  await addCourse(4, 'ICSI405', 'Програм хангамжийн төслийн удирдлага');
});
after(() => pool.end());

test('нэр, кодоор (зай, жижиг үсэгтэй ч) хайна; яг таарсан код эхэнд', async () => {
  const byName = await as(student).get(q('өгөгдлийн сан'));
  assert.equal(byName.status, 200);
  assert.deepEqual(byName.body.catalog.map((c) => c.code).sort(), ['CSSW333', 'ICSI311']);
  const byCode = await as(student).get(q('icsi 405'));
  assert.equal(byCode.body.catalog[0].code, 'ICSI405');
  assert.equal(byCode.body.catalog[0].departmentName, 'Мэдээлэл, компьютерийн ухааны тэнхим');
  // Сургуулиар шүүнэ
  assert.equal((await as(student).get(q('icsi') + `&school=${site}`)).body.catalog.length, 3);
  assert.equal((await as(student).get(q('icsi') + `&school=${site + 1}`)).body.catalog.length, 0);
});

test('бичлэгийн зөрүүтэй ("програмчлал" ↔ "программчлал") хайлтаар олно', async () => {
  const res = await as(student).get(q('вэб програмчлал'));
  assert.ok(res.body.catalog.some((c) => c.code === 'CSSW333'));
});

test('сонгогдсон каталогийн хичээл subjects-д гарч, каталогоос давхардаж гарахгүй; түвшин, кредит харагдана', async () => {
  const { rows } = await pool.query("SELECT id FROM catalog_courses WHERE code = 'ICSI202'");
  await as(student).post(`/api/subjects/catalog/${rows[0].id}`);
  const res = await as(student).get(q('өгөгдлийн бүтэц'));
  assert.deepEqual(res.body.subjects.map((s) => [s.code, s.name, s.level, s.credit]), [['ICSI202', 'Өгөгдлийн бүтэц', 'Бакалавр', 3]]);
  assert.equal(res.body.catalog.length, 0);
});

test('ижил нэр, кодтой ч өөр сургуулийн хичээл тусдаа хичээл болно', async () => {
  const other = (await pool.query("INSERT INTO schools (name, short_name) VALUES ('Баруун бүсийн сургууль', 'ББС') RETURNING id")).rows[0].id;
  const a = (await pool.query("SELECT id FROM catalog_courses WHERE code = 'ICSI202'")).rows[0].id;
  const b = await addCourse(9, 'ICSI202', 'Өгөгдлийн бүтэц', { deptId: null, school: other });
  const sa = await as(student).post(`/api/subjects/catalog/${a}`);
  const sb = await as(student).post(`/api/subjects/catalog/${b}`);
  assert.equal(sb.status, 201);
  assert.notEqual(sa.body.subject.id, sb.body.subject.id);
  assert.equal(sb.body.subject.schoolShortName, 'ББС');
});

test('каталогоос сонгоход код, сургууль, тэнхимтэй хичээл үүсч, дахин сонгоход тэрийг нь буцаана', async () => {
  const { rows } = await pool.query("SELECT id FROM catalog_courses WHERE code = 'ICSI405'");
  const first = await as(student).post(`/api/subjects/catalog/${rows[0].id}`);
  assert.equal(first.status, 201);
  assert.equal(first.body.subject.code, 'ICSI405');
  assert.equal(first.body.subject.departmentName, 'Мэдээлэл, компьютерийн ухааны тэнхим');
  assert.equal(first.body.subject.catalogId, rows[0].id);
  const again = await as(other).post(`/api/subjects/catalog/${rows[0].id}`);
  assert.equal(again.status, 200);
  assert.equal(again.body.subject.id, first.body.subject.id);
  // Сонгосон хичээл одоо хичээлийн жагсаалтад байна
  const list = await as(student).get('/api/subjects');
  assert.deepEqual(list.body.subjects.map((s) => s.code), ['ICSI405']);
});

test('каталогоос сонгосон хичээл оюутны өдрийн хязгаарт (5) тооцогдохгүй', async () => {
  for (const code of ['ICSI202', 'ICSI311', 'CSSW333', 'ICSI405']) {
    const { rows } = await pool.query('SELECT id FROM catalog_courses WHERE code = $1', [code]);
    assert.equal((await as(student).post(`/api/subjects/catalog/${rows[0].id}`)).status, 201);
  }
  for (let i = 0; i < 5; i++) {
    assert.equal((await as(student).post('/api/subjects', { name: `Гараар нэмсэн ${i}`, schoolId: site })).status, 201);
  }
  assert.equal((await as(student).post('/api/subjects', { name: 'Зургаа дахь', schoolId: site })).status, 429);
});

test('гараар нэмсэн хичээлтэй ижил нэр, код байсан ч каталогоос сонгож болно; идэвхгүй болгосныг сэргээхгүй', async () => {
  await pool.query("INSERT INTO subjects (name, code) VALUES ('Өгөгдлийн сангийн систем', 'ICSI311')");
  const { rows } = await pool.query("SELECT id FROM catalog_courses WHERE code = 'ICSI311'");
  const res = await as(student).post(`/api/subjects/catalog/${rows[0].id}`);
  assert.equal(res.status, 201);
  assert.equal(res.body.subject.code, 'ICSI311');
  const ds = (await pool.query("SELECT id FROM catalog_courses WHERE code = 'ICSI202'")).rows[0].id;
  const created = await as(student).post(`/api/subjects/catalog/${ds}`);
  await pool.query('UPDATE subjects SET is_active = FALSE WHERE id = $1', [created.body.subject.id]);
  assert.equal((await as(other).post(`/api/subjects/catalog/${ds}`)).status, 409);
});

test('хайлт нэвтрэлт ба 2-оос доошгүй тэмдэгт шаардана; байхгүй каталог 404', async () => {
  assert.equal((await api().get(q('өгөгдөл'))).status, 401);
  assert.equal((await as(student).get(q('ө'))).status, 400);
  assert.equal((await as(student).post('/api/subjects/catalog/99999')).status, 404);
});

test('каталогийг сургууль, тэнхимээр хуудаслан үзнэ; сонгогдсон хичээл хасагдана', async () => {
  const all = await as(student).get(`/api/subjects/catalog?school=${site}`);
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 4);
  assert.equal(all.body.courses[0].level, 'Бакалавр');
  const ds = all.body.courses.find((c) => c.code === 'ICSI202');
  await as(student).post(`/api/subjects/catalog/${ds.id}`);
  assert.equal((await as(student).get(`/api/subjects/catalog?department=${mcs}`)).body.total, 3);
  assert.equal((await as(student).get(`/api/subjects/catalog?school=${site}&q=icsi311`)).body.courses[0].code, 'ICSI311');
  assert.equal((await as(student).get('/api/subjects/catalog')).status, 400);
});
