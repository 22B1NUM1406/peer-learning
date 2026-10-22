import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, createSubject, askQuestion, answer, reputationOf, loginCookie } from './helpers.js';

// Moderation: FR-15, FR-16, FR-18, NFR-03

let bat, saraa, dorj, admin, subject;
const REASON = 'Буруу, төөрөгдүүлсэн мэдээлэл';

before(resetDb);
beforeEach(async () => {
  await resetDb();
  bat = await login('bat@example.com', { name: 'Бат' });
  saraa = await login('saraa@example.com', { name: 'Сараа' });
  dorj = await login('dorj@example.com', { name: 'Дорж' });
  admin = await login('admin@example.com', { name: 'Админ', role: 'admin' });
  subject = await createSubject();
});
after(() => pool.end());

test('контентыг шалтгаантай мэдээлнэ; давхар болон өөрийнхөө контентыг мэдээлэхгүй (FR-15)', async () => {
  const q = await askQuestion(bat, subject);
  const res = await as(saraa).post('/api/reports', { targetType: 'question', targetId: q, reason: REASON });
  assert.equal(res.status, 201);
  assert.equal((await as(saraa).post('/api/reports', { targetType: 'question', targetId: q, reason: REASON })).status, 409);
  assert.equal((await as(bat).post('/api/reports', { targetType: 'question', targetId: q, reason: REASON })).status, 400);
  assert.equal((await as(saraa).post('/api/reports', { targetType: 'question', targetId: q, reason: 'Дурын текст' })).status, 400);
  const reasons = await as(saraa).get('/api/reports/reasons');
  assert.ok(reasons.body.reasons.includes('Шалгалтын материал'));
});

test('оюутан админы хэсэгт хандах эрхгүй (NFR-03)', async () => {
  assert.equal((await as(saraa).get('/api/admin/reports')).status, 403);
  assert.equal((await as(saraa).patch(`/api/admin/users/${bat.id}/status`, { status: 'suspended' })).status, 403);
});

test('админ мэдээлсэн асуултыг нууж, нэг контентын бүх мэдээлэл хамт хаагдана (FR-16)', async () => {
  const q = await askQuestion(bat, subject);
  await as(saraa).post('/api/reports', { targetType: 'question', targetId: q, reason: REASON });
  await as(dorj).post('/api/reports', { targetType: 'question', targetId: q, reason: 'Спам, сурталчилгаа' });

  const list = await as(admin).get('/api/admin/reports');
  assert.equal(list.body.reports.length, 2);
  assert.equal(list.body.reports[0].openCount, 2);
  assert.equal(list.body.reports[0].ownerName, 'Бат');
  assert.equal(list.body.reports[0].questionId, q);

  assert.equal((await as(admin).patch(`/api/admin/reports/${list.body.reports[0].id}`, { action: 'hide' })).status, 204);
  assert.equal((await as(saraa).get(`/api/questions/${q}`)).status, 404);
  assert.equal((await as(admin).get('/api/admin/reports')).body.reports.length, 0);
  assert.equal((await as(admin).get('/api/admin/reports?status=resolved')).body.reports.length, 2);
});

test('админ хариулт устгахад оноо буцаагдана; мэдээллийг хаах (dismiss) боломжтой', async () => {
  const q = await askQuestion(bat, subject);
  const a = await answer(saraa, q);
  await as(dorj).post(`/api/answers/${a}/vote`);
  assert.equal(await reputationOf(saraa.id), 2);
  const r = await as(dorj).post('/api/reports', { targetType: 'answer', targetId: a, reason: REASON });
  await as(admin).patch(`/api/admin/reports/${r.body.id}`, { action: 'delete' });
  assert.equal(await reputationOf(saraa.id), 0);

  const q2 = await askQuestion(bat, subject, { title: 'Өөр асуулт энд байна' });
  const r2 = await as(saraa).post('/api/reports', { targetType: 'question', targetId: q2, reason: REASON });
  await as(admin).patch(`/api/admin/reports/${r2.body.id}`, { action: 'dismiss' });
  assert.equal((await as(saraa).get(`/api/questions/${q2}`)).status, 200);
  assert.equal((await as(admin).patch(`/api/admin/reports/${r2.body.id}`, { action: 'hide' })).status, 409);
});

test('сэтгэгдлийг нуух боломжгүй, устгана', async () => {
  const q = await askQuestion(bat, subject);
  const c = await as(saraa).post(`/api/questions/${q}/comments`, { body: 'Зохисгүй сэтгэгдэл' });
  const r = await as(bat).post('/api/reports', { targetType: 'comment', targetId: c.body.id, reason: 'Зохисгүй агуулга' });
  assert.equal((await as(admin).patch(`/api/admin/reports/${r.body.id}`, { action: 'hide' })).status, 400);
  assert.equal((await as(admin).patch(`/api/admin/reports/${r.body.id}`, { action: 'delete' })).status, 204);
  const d = await as(bat).get(`/api/questions/${q}`);
  assert.equal(d.body.question.comments.length, 0);
});

test('мессежийг зөвхөн хүлээн авагч нь мэдээлнэ', async () => {
  const m = await as(bat).post(`/api/conversations/${saraa.id}/messages`, { body: 'Сайн уу' });
  assert.equal((await as(dorj).post('/api/reports', { targetType: 'message', targetId: m.body.message.id, reason: REASON })).status, 403);
  assert.equal((await as(saraa).post('/api/reports', { targetType: 'message', targetId: m.body.message.id, reason: REASON })).status, 201);
});

test('түдгэлзүүлэхэд session хүчингүй болж, сэргээхэд дахин нэвтэрнэ (FR-18)', async () => {
  const res = await as(admin).patch(`/api/admin/users/${bat.id}/status`, { status: 'suspended' });
  assert.equal(res.status, 200);
  assert.equal((await as(bat).get('/api/auth/me')).status, 401);
  const suspended = await as(admin).get('/api/admin/users?status=suspended');
  assert.deepEqual(suspended.body.users.map((u) => u.id), [bat.id]);

  await as(admin).patch(`/api/admin/users/${bat.id}/status`, { status: 'active' });
  assert.ok(await loginCookie('bat@example.com'));
  assert.equal((await as(admin).patch(`/api/admin/users/${admin.id}/status`, { status: 'suspended' })).status, 400);
});
