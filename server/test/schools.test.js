import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, api, askQuestion } from './helpers.js';

// FR-26: бүрэлдэхүүн сургууль, тэнхим ба хичээлийг тэдгээрт хамааруулах, шүүх.

let student, admin, site, sas, mcs, math;

async function insertSchool(name, short, order) {
  const { rows } = await pool.query('INSERT INTO schools (name, short_name, sort_order) VALUES ($1, $2, $3) RETURNING id', [name, short, order]);
  return rows[0].id;
}
async function insertDept(schoolId, name) {
  const { rows } = await pool.query('INSERT INTO departments (school_id, name) VALUES ($1, $2) RETURNING id', [schoolId, name]);
  return rows[0].id;
}

before(resetDb);
beforeEach(async () => {
  await resetDb();
  student = await login('student@example.com', { name: 'Оюутан' });
  admin = await login('admin@example.com', { name: 'Админ', role: 'admin' });
  site = await insertSchool('Мэдээллийн технологи, электроникийн сургууль', 'МТЭС', 1);
  sas = await insertSchool('Шинжлэх ухааны сургууль — Байгалийн ухааны салбар', 'БУС', 2);
  mcs = await insertDept(site, 'Мэдээлэл, компьютерын ухааны тэнхим');
  math = await insertDept(sas, 'Математикийн тэнхим');
});
after(() => pool.end());

const addSubject = async (body) => as(admin).post('/api/admin/subjects', body);

test('сургуулиуд тэнхимийн хамт дарааллаараа, идэвхтэй хичээлийн тоотой ирнэ', async () => {
  await addSubject({ name: 'Өгөгдлийн бүтэц', departmentId: mcs });
  const res = await as(student).get('/api/schools');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.schools.map((s) => [s.shortName, s.subjectCount, s.departments.map((d) => d.name)]), [
    ['МТЭС', 1, ['Мэдээлэл, компьютерын ухааны тэнхим']],
    ['БУС', 0, ['Математикийн тэнхим']],
  ]);
  assert.equal((await api().get('/api/schools')).status, 401);
});

test('админ хичээлд код, тэнхим онооно; тэнхимээс сургууль нь тодорхойлогдоно', async () => {
  const res = await addSubject({ name: 'Өгөгдлийн бүтэц', code: ' icsi202 ', departmentId: mcs });
  assert.equal(res.status, 201);
  assert.equal(res.body.subject.code, 'ICSI202');
  assert.equal(res.body.subject.schoolId, site);
  assert.equal(res.body.subject.schoolShortName, 'МТЭС');
  assert.equal(res.body.subject.departmentName, 'Мэдээлэл, компьютерын ухааны тэнхим');

  // Код давхардахгүй
  assert.equal((await addSubject({ name: 'Өөр хичээл', code: 'ICSI202' })).status, 409);
  // Тэнхим нь сонгосон сургуульд харьяалагдахгүй бол татгалзана
  assert.equal((await addSubject({ name: 'Шугаман алгебр', schoolId: site, departmentId: math })).status, 400);
  // Тэнхимгүйгээр зөвхөн сургуульд хамааруулж болно
  const onlySchool = await addSubject({ name: 'Шугаман алгебр', schoolId: sas });
  assert.equal(onlySchool.body.subject.departmentId, null);
  // Буруу код
  assert.equal((await addSubject({ name: 'Гуравдахь', code: 'a b!' })).status, 400);
});

test('сургуулийг солиход өөр сургуулийн тэнхим хадгалагдахгүй; кодыг арилгаж болно', async () => {
  const { body } = await addSubject({ name: 'Математик анализ', code: 'MATH101', departmentId: mcs });
  const res = await as(admin).patch(`/api/admin/subjects/${body.subject.id}`, { schoolId: sas, code: '' });
  assert.equal(res.status, 200);
  assert.equal(res.body.subject.schoolId, sas);
  assert.equal(res.body.subject.departmentId, null);
  assert.equal(res.body.subject.code, null);
  const moved = await as(admin).patch(`/api/admin/subjects/${body.subject.id}`, { departmentId: math });
  assert.equal(moved.body.subject.departmentName, 'Математикийн тэнхим');
});

test('хичээл ба асуултыг сургууль, тэнхимээр шүүнэ', async () => {
  const ds = (await addSubject({ name: 'Өгөгдлийн бүтэц', departmentId: mcs })).body.subject.id;
  const la = (await addSubject({ name: 'Шугаман алгебр', departmentId: math })).body.subject.id;
  await addSubject({ name: 'Ерөнхий хичээл' });

  const bySchool = await as(student).get(`/api/subjects?school=${sas}`);
  assert.deepEqual(bySchool.body.subjects.map((s) => s.name), ['Шугаман алгебр']);
  const byDept = await as(student).get(`/api/subjects?department=${mcs}`);
  assert.deepEqual(byDept.body.subjects.map((s) => s.name), ['Өгөгдлийн бүтэц']);
  assert.equal((await as(student).get('/api/subjects')).body.subjects.length, 3);

  await askQuestion(student, ds, { title: 'Өгөгдлийн бүтцийн асуулт' });
  await askQuestion(student, la, { title: 'Шугаман алгебрын асуулт' });
  const qs = await as(student).get(`/api/questions?school=${site}`);
  assert.deepEqual(qs.body.questions.map((q) => q.title), ['Өгөгдлийн бүтцийн асуулт']);
  assert.equal(qs.body.questions[0].subject.schoolShortName, 'МТЭС');
});

test('админ сургууль, тэнхим нэмж засна; оюутан чадахгүй', async () => {
  const s = await as(admin).post('/api/admin/schools', { name: 'Инженер технологийн сургууль', shortName: 'ИТС' });
  assert.equal(s.status, 201);
  assert.equal((await as(admin).post('/api/admin/schools', { name: 'Өөр нэр', shortName: 'ИТС' })).status, 409);
  const d = await as(admin).post(`/api/admin/schools/${s.body.school.id}/departments`, { name: 'Шинэ тэнхим' });
  assert.equal(d.status, 201);
  assert.equal((await as(admin).post(`/api/admin/schools/${s.body.school.id}/departments`, { name: 'Шинэ тэнхим' })).status, 409);
  const renamed = await as(admin).patch(`/api/admin/departments/${d.body.department.id}`, { name: 'Засварласан тэнхим' });
  assert.equal(renamed.body.department.name, 'Засварласан тэнхим');
  assert.equal((await as(admin).post('/api/admin/schools/9999/departments', { name: 'Тэнхим' })).status, 404);

  assert.equal((await as(student).post('/api/admin/schools', { name: 'Хуурамч', shortName: 'ХХ' })).status, 403);
  assert.equal((await as(student).patch(`/api/admin/departments/${mcs}`, { name: 'Хуурамч' })).status, 403);
});
