import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, createSubject, askQuestion, answer } from './helpers.js';

// User/Profile: FR-03, FR-04, NFR-12

let bat, saraa, dorj, subject;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  bat = await login('bat@example.com', { name: 'Бат' });
  saraa = await login('saraa@example.com', { name: 'Сараа' });
  dorj = await login('dorj@example.com', { name: 'Дорж' });
  subject = await createSubject();
});
after(() => pool.end());

test('профайлаа засаж, бусдын профайлыг харна; имэйл харагдахгүй (FR-03, NFR-12)', async () => {
  const upd = await as(bat).patch('/api/users/me', { name: 'Бат-Эрдэнэ', faculty: 'МТЭС', year: 3 });
  assert.equal(upd.status, 200);
  const res = await as(saraa).get(`/api/users/${bat.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.name, 'Бат-Эрдэнэ');
  assert.equal(res.body.user.year, 3);
  assert.equal(res.body.user.email, undefined);
  assert.equal(res.body.user.isMe, false);
  assert.equal((await as(bat).patch('/api/users/me', { name: 'Бат', year: 9 })).status, 400);
});

test('туслах хичээлээ сонгож, хичээлийн хуудсанд "тусалсан" тоогоор эрэмбэлэгдэнэ (FR-04)', async () => {
  for (const u of [saraa, dorj]) {
    assert.equal((await as(u).put('/api/users/me/subjects', { subjectIds: [subject] })).status, 204);
  }
  const profile = await as(bat).get(`/api/users/${dorj.id}`);
  assert.deepEqual(profile.body.user.helpSubjects.map((s) => s.id), [subject]);

  // Дорж нэг "тусалсан" хариулттай болбол Сараагаас дээр гарна
  const q = await askQuestion(bat, subject);
  const a = await answer(dorj, q);
  await as(bat).put(`/api/questions/${q}/accepted`, { answerId: a });

  const helpers = await as(bat).get(`/api/subjects/${subject}/helpers`);
  assert.deepEqual(helpers.body.helpers.map((h) => h.name), ['Дорж', 'Сараа']);
  assert.equal(helpers.body.helpers[0].acceptedInSubject, 1);
});

test('өөр хичээлд авсан "тусалсан" нь энэ хичээлийн эрэмбэд нөлөөлөхгүй', async () => {
  const other = await createSubject('Өгөгдлийн сан');
  await as(saraa).put('/api/users/me/subjects', { subjectIds: [subject, other] });
  const q = await askQuestion(bat, other);
  const a = await answer(saraa, q);
  await as(bat).put(`/api/questions/${q}/accepted`, { answerId: a });
  const helpers = await as(bat).get(`/api/subjects/${subject}/helpers`);
  assert.equal(helpers.body.helpers[0].acceptedInSubject, 0);
});

test('профайлд хэрэглэгчийн асуулт, хариулт харагдана', async () => {
  const q = await askQuestion(bat, subject);
  await answer(saraa, q);
  const qs = await as(dorj).get(`/api/users/${bat.id}/questions`);
  assert.equal(qs.body.questions.length, 1);
  const ans = await as(dorj).get(`/api/users/${saraa.id}/answers`);
  assert.equal(ans.body.answers.length, 1);
  assert.equal(ans.body.answers[0].questionId, q);
});

test('түдгэлзсэн хэрэглэгчийн профайл оюутанд олдохгүй', async () => {
  await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [dorj.id]);
  assert.equal((await as(bat).get(`/api/users/${dorj.id}`)).status, 404);
});
