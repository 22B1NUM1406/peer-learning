import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, api, createSubject, askQuestion, answer } from './helpers.js';

// Нүүр хуудасны "Түгээмэл" эрэмбэ, үнэлгээний тоо ба хажуугийн самбарын статистик.
// Бүгд зөвхөн уншдаг бөгөөд бодит өгөгдлөөс тооцогдоно.

let asker, helper, voter, admin, ds, db;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  asker = await login('asker@example.com', { name: 'Асуугч' });
  helper = await login('helper@example.com', { name: 'Туслагч' });
  voter = await login('voter@example.com', { name: 'Үнэлэгч' });
  admin = await login('admin@example.com', { name: 'Админ', role: 'admin' });
  ds = await createSubject('Өгөгдлийн бүтэц');
  db = await createSubject('Өгөгдлийн сан');
});
after(() => pool.end());

test('жагсаалт хариултуудын "тустай" үнэлгээний нийлбэрийг буцааж, "Түгээмэл"-ээр эрэмбэлнэ', async () => {
  const q1 = await askQuestion(asker, ds, { title: 'Эхний асуултын гарчиг энд' });
  const q2 = await askQuestion(asker, ds, { title: 'Хоёр дахь асуултын гарчиг' });
  const a2 = await answer(helper, q2);
  await as(voter).post(`/api/answers/${a2}/vote`);
  await as(asker).post(`/api/answers/${a2}/vote`);

  const fresh = await as(voter).get('/api/questions');
  assert.equal(fresh.status, 200);
  const byId = Object.fromEntries(fresh.body.questions.map((q) => [q.id, q]));
  assert.equal(byId[q2].voteCount, 2);
  assert.equal(byId[q1].voteCount, 0);

  const popular = await as(voter).get('/api/questions?sort=popular');
  assert.deepEqual(popular.body.questions.map((q) => q.id), [q2, q1]);

  assert.equal((await as(voter).get('/api/questions?sort=bogus')).status, 400);
});

test('нуусан хариултын үнэлгээ тоонд орохгүй', async () => {
  const q = await askQuestion(asker, ds);
  const a = await answer(helper, q);
  await as(voter).post(`/api/answers/${a}/vote`);
  await pool.query('UPDATE answers SET is_hidden = TRUE WHERE id = $1', [a]);
  const list = await as(voter).get('/api/questions');
  assert.equal(list.body.questions[0].voteCount, 0);
  assert.equal(list.body.questions[0].answerCount, 0);
});

test('хажуугийн самбар: идэвхтэй хичээл, идэвхтэй оюутан, хамгийн их оноотой оюутан', async () => {
  const q1 = await askQuestion(asker, ds);
  await askQuestion(asker, ds, { title: 'Өөр нэг асуултын гарчиг' });
  const q3 = await askQuestion(asker, db, { title: 'Өгөгдлийн сангийн асуулт' });
  const a1 = await answer(helper, q1);
  await answer(voter, q3);
  await answer(helper, q3, 'Өөр нэг тайлбартай хариулт энд байна');
  await as(asker).put(`/api/questions/${q1}/accepted`, { answerId: a1 });
  await answer(admin, q1, 'Админы бичсэн хариулт ба тайлбар');
  // 8 хоногийн өмнөх асуулт сүүлийн 7 хоногийн тоонд орохгүй
  await pool.query("UPDATE questions SET created_at = now() - interval '8 days' WHERE id = $1", [q3]);

  const res = await as(voter).get('/api/stats/community');
  assert.equal(res.status, 200);
  assert.equal(res.body.days, 7);
  assert.deepEqual(res.body.trendingSubjects.map((s) => [s.name, s.questionCount]), [['Өгөгдлийн бүтэц', 2]]);
  assert.deepEqual(res.body.activeStudents.map((u) => [u.name, u.answerCount]), [['Туслагч', 2], ['Үнэлэгч', 1]]);
  assert.deepEqual(res.body.topContributors.map((u) => [u.name, u.reputation, u.acceptedCount]), [['Туслагч', 10, 1]]);
  assert.deepEqual(res.body.totals, { questions: 3, acceptedQuestions: 1, answers: 4, students: 3 });
  // Имэйл зэрэг хувийн мэдээлэл буцаахгүй (NFR-12)
  assert.ok(!JSON.stringify(res.body).includes('@example.com'));
});

test('түдгэлзүүлсэн хэрэглэгч самбарт гарахгүй; нэвтрээгүй бол 401', async () => {
  const q = await askQuestion(asker, ds);
  await answer(helper, q);
  await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [helper.id]);
  const res = await as(voter).get('/api/stats/community');
  assert.equal(res.body.activeStudents.length, 0);
  assert.equal((await api().get('/api/stats/community')).status, 401);
});

test('хичээлийн жагсаалт асуултын тоог буцаана', async () => {
  await askQuestion(asker, ds);
  const res = await as(voter).get('/api/subjects');
  const counts = Object.fromEntries(res.body.subjects.map((s) => [s.name, s.questionCount]));
  assert.deepEqual(counts, { 'Өгөгдлийн бүтэц': 1, 'Өгөгдлийн сан': 0 });
});
