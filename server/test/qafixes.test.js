import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, api, login, as, createSubject, askQuestion, answer, reputationOf } from './helpers.js';
import { LIMITS } from '../src/lib/rateLimit.js';

// 2026.11.16-ны production дээрх QA тестээр илэрсэн алдаануудын регрессийн тест.

const REASON = 'Буруу, төөрөгдүүлсэн мэдээлэл';
let asker, helper, voter, admin, ds;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  asker = await login('asker@example.com', { name: 'Асуугч' });
  helper = await login('helper@example.com', { name: 'Туслагч' });
  voter = await login('voter@example.com', { name: 'Үнэлэгч' });
  admin = await login('admin@example.com', { name: 'Админ', role: 'admin' });
  ds = await createSubject('Өгөгдлийн бүтэц');
});
after(() => pool.end());

const loginAs = (email, password) => api().post('/api/auth/login').send({ email, password });

test('нэг имэйл рүү олон буруу оролдлого хийвэл түр хаагдана; амжилттай нэвтэрвэл тоолуур тэглэгдэнэ', async () => {
  for (let i = 0; i < LIMITS.email - 1; i++) assert.equal((await loginAs('asker@example.com', 'wrongpass')).status, 401);
  assert.equal((await loginAs('asker@example.com', 'password123')).status, 200);   // тэглэгдэнэ
  for (let i = 0; i < LIMITS.email; i++) assert.equal((await loginAs('asker@example.com', 'wrongpass')).status, 401);
  const blocked = await loginAs('asker@example.com', 'password123');                // зөв нууц үгтэй ч түр хаалттай
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers['retry-after']) > 0);
  assert.equal((await loginAs('helper@example.com', 'password123')).status, 200);  // өөр бүртгэлд нөлөөлөхгүй
});

test('100KB-аас том хүсэлт 500 биш 413 буцаана', async () => {
  const res = await as(asker).post('/api/questions', { title: 'Урт асуулт', body: 'а'.repeat(200000), subjectId: ds });
  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'TOO_LARGE');
});

test('isAnonymous нь true/false биш бол 400', async () => {
  const res = await as(asker).post('/api/questions', { title: 'Буруу төрөл', body: 'тайлбар тайлбар тайлбар', subjectId: ds, isAnonymous: 'yes' });
  assert.equal(res.status, 400);
});

test('хичээлийн нэрийн дундах олон зай давхардлыг тойрохгүй', async () => {
  const school = (await pool.query("INSERT INTO schools (name, short_name, sort_order) VALUES ('Сургууль', 'МТЭС', 1) RETURNING id")).rows[0].id;
  assert.equal((await as(asker).post('/api/subjects', { name: 'QA тест хичээл', schoolId: school })).status, 201);
  const dup = await as(asker).post('/api/subjects', { name: '  QA   тест\tхичээл ', schoolId: school });
  assert.equal(dup.status, 409);
  const created = await as(asker).post('/api/subjects', { name: 'Компьютерын   сүлжээ', schoolId: school });
  assert.equal(created.body.subject.name, 'Компьютерын сүлжээ');
});

test('профайл: нэрээ нуусан асуулт бусдад тоонд орохгүй', async () => {
  await askQuestion(asker, ds, { title: 'Нээлттэй асуулт' });
  await askQuestion(asker, ds, { title: 'Нэрээ нуусан асуулт', isAnonymous: true });
  assert.equal((await as(voter).get(`/api/users/${asker.id}`)).body.user.questionCount, 1);
  assert.equal((await as(asker).get(`/api/users/${asker.id}`)).body.user.questionCount, 2);
  assert.equal((await as(admin).get(`/api/users/${asker.id}`)).body.user.questionCount, 2);
  assert.equal((await as(voter).get(`/api/users/${asker.id}`)).body.user.anonQuestionCount, undefined);
});

test('профайлын зөвхөн илгээсэн талбар өөрчлөгдөнө', async () => {
  await as(asker).patch('/api/users/me', { name: 'Асуугч', faculty: 'МТЭС', year: 3 });
  const res = await as(asker).patch('/api/users/me', { name: 'Шинэ нэр' });
  assert.deepEqual([res.body.user.name, res.body.user.faculty, res.body.user.year], ['Шинэ нэр', 'МТЭС', 3]);
  const cleared = await as(asker).patch('/api/users/me', { year: null });
  assert.deepEqual([cleared.body.user.faculty, cleared.body.user.year], ['МТЭС', null]);
  assert.equal((await as(asker).patch('/api/users/me', {})).status, 400);
});

test('админ хариултыг нуухад түүгээр авсан оноо буцаагдаж, "тусалсан" тэмдэглэгээ арилна; давхар хасагдахгүй', async () => {
  const q = await askQuestion(asker, ds);
  const a1 = await answer(helper, q);
  const a2 = await answer(helper, q, 'Өөр нэгэн тайлбартай хариулт энд байна');
  await as(voter).post(`/api/answers/${a1}/vote`);
  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a1 });
  assert.equal(await reputationOf(helper.id), 12);

  await as(voter).post('/api/reports', { targetType: 'answer', targetId: a1, reason: REASON });
  const report = (await as(admin).get('/api/admin/reports?status=open')).body.reports[0];
  assert.equal((await as(admin).patch(`/api/admin/reports/${report.id}`, { action: 'hide' })).status, 204);
  assert.equal(await reputationOf(helper.id), 0);
  assert.equal((await as(asker).get(`/api/questions/${q}`)).body.question.acceptedAnswerId, null);

  // Дараа нь өөр хариултыг сонгоход, эсвэл эзэн нуусан хариултаа устгахад оноо дахин хасагдахгүй
  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a2 });
  assert.equal(await reputationOf(helper.id), 10);
  await as(helper).delete(`/api/answers/${a1}`);
  assert.equal(await reputationOf(helper.id), 10);
});

test('админ асуултыг нуухад түүний хариултуудаар авсан оноо буцаагдана', async () => {
  const q = await askQuestion(asker, ds);
  const a = await answer(helper, q);
  await as(voter).post(`/api/answers/${a}/vote`);
  await as(voter).post('/api/reports', { targetType: 'question', targetId: q, reason: REASON });
  const report = (await as(admin).get('/api/admin/reports?status=open')).body.reports[0];
  await as(admin).patch(`/api/admin/reports/${report.id}`, { action: 'hide' });
  assert.equal(await reputationOf(helper.id), 0);
});
