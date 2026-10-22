import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, createSubject, askQuestion, answer } from './helpers.js';

// Q&A ба Search: FR-05–FR-10, FR-13, FR-14, FR-19, FR-20, FR-25, NFR-03

let bat, saraa, admin, subject;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  bat = await login('bat@example.com', { name: 'Бат' });
  saraa = await login('saraa@example.com', { name: 'Сараа' });
  admin = await login('admin@example.com', { name: 'Админ', role: 'admin' });
  subject = await createSubject();
});
after(() => pool.end());

test('асуулт үүсгэж, дэлгэрэнгүйг харна (FR-05, FR-08)', async () => {
  const id = await askQuestion(bat, subject);
  const res = await as(saraa).get(`/api/questions/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.question.author.name, 'Бат');
  assert.equal(res.body.question.subject.id, subject);
  assert.equal(res.body.question.isMine, false);
});

test('асуултын оролтыг шалгана, идэвхгүй хичээлд асуулт үүсгэхгүй', async () => {
  const short = await as(bat).post('/api/questions', { title: 'Юу', body: 'Богино', subjectId: subject });
  assert.equal(short.status, 400);
  const inactive = await createSubject('Хуучин хичээл', false);
  const res = await as(bat).post('/api/questions', { title: 'Энэ хичээлийн асуулт', body: 'Дэлгэрэнгүй тайлбар энд', subjectId: inactive });
  assert.equal(res.status, 400);
});

test('нэр нууцалсан асуултад бусад оюутан нэрийг харахгүй, асуугч ба админ харна (FR-20)', async () => {
  const id = await askQuestion(bat, subject, { isAnonymous: true });
  const other = await as(saraa).get(`/api/questions/${id}`);
  assert.equal(other.body.question.author, null);
  assert.equal(other.body.question.isAnonymous, true);

  const mine = await as(bat).get(`/api/questions/${id}`);
  assert.equal(mine.body.question.author.name, 'Бат');
  const forAdmin = await as(admin).get(`/api/questions/${id}`);
  assert.equal(forAdmin.body.question.author.name, 'Бат');

  const list = await as(saraa).get('/api/questions');
  assert.equal(list.body.questions[0].author, null);
  // Бусдын профайлд нууцалсан асуулт харагдахгүй
  const profile = await as(saraa).get(`/api/users/${bat.id}/questions`);
  assert.equal(profile.body.questions.length, 0);
});

test('бусдын асуултыг засах, устгах эрхгүй (NFR-03)', async () => {
  const id = await askQuestion(bat, subject);
  assert.equal((await as(saraa).patch(`/api/questions/${id}`, { title: 'Өөрчилсөн гарчиг' })).status, 403);
  assert.equal((await as(saraa).delete(`/api/questions/${id}`)).status, 403);
  assert.equal((await as(bat).patch(`/api/questions/${id}`, { title: 'Өөрчилсөн гарчиг' })).status, 204);
});

test('хариулттай асуултыг устгахгүй, хариултгүйг устгана (FR-06)', async () => {
  const id = await askQuestion(bat, subject);
  await answer(saraa, id);
  assert.equal((await as(bat).delete(`/api/questions/${id}`)).status, 409);
  const id2 = await askQuestion(bat, subject);
  assert.equal((await as(bat).delete(`/api/questions/${id2}`)).status, 204);
  assert.equal((await as(bat).get(`/api/questions/${id2}`)).status, 404);
});

test('хариулт бичихэд асуугчид мэдэгдэл очно, өөрөө хариулбал очихгүй (FR-09, FR-19)', async () => {
  const id = await askQuestion(bat, subject);
  await answer(bat, id);
  let n = await as(bat).get('/api/notifications');
  assert.equal(n.body.unread, 0);
  await answer(saraa, id);
  n = await as(bat).get('/api/notifications');
  assert.equal(n.body.unread, 1);
  assert.equal(n.body.notifications[0].type, 'new_answer');
  assert.equal(n.body.notifications[0].questionId, id);
});

test('хариултаа засаж устгана, бусдынхыг болохгүй (FR-10)', async () => {
  const q = await askQuestion(bat, subject);
  const a = await answer(saraa, q);
  assert.equal((await as(bat).patch(`/api/answers/${a}`, { body: 'Өөр хүний хариултыг засах гэж оролдов' })).status, 403);
  assert.equal((await as(saraa).patch(`/api/answers/${a}`, { body: 'Шинэчилсэн хариулт, тайлбартай' })).status, 204);
  assert.equal((await as(saraa).delete(`/api/answers/${a}`)).status, 204);
  const res = await as(bat).get(`/api/questions/${q}`);
  assert.equal(res.body.question.answers.length, 0);
});

test('асуулт, хариултад сэтгэгдэл бичиж, зөвхөн өөрийнхөө сэтгэгдлийг устгана (FR-14)', async () => {
  const q = await askQuestion(bat, subject);
  const a = await answer(saraa, q);
  const c1 = await as(saraa).post(`/api/questions/${q}/comments`, { body: 'Ямар хэл дээр вэ?' });
  const c2 = await as(bat).post(`/api/answers/${a}/comments`, { body: 'Баярлалаа, ойлголоо' });
  assert.equal(c1.status, 201);
  assert.equal(c2.status, 201);
  const res = await as(bat).get(`/api/questions/${q}`);
  assert.equal(res.body.question.comments.length, 1);
  assert.equal(res.body.question.answers[0].comments.length, 1);
  assert.equal((await as(bat).delete(`/api/comments/${c1.body.id}`)).status, 403);
  assert.equal((await as(saraa).delete(`/api/comments/${c1.body.id}`)).status, 204);
});

test('жагсаалтыг хичээлээр шүүж, хариултгүйг ялгана (FR-07)', async () => {
  const other = await createSubject('Өгөгдлийн сан');
  const q1 = await askQuestion(bat, subject);
  await askQuestion(bat, other, { title: 'SQL JOIN-ийн ялгаа юу вэ' });
  await answer(saraa, q1);

  const bySubject = await as(saraa).get(`/api/questions?subject=${other}`);
  assert.equal(bySubject.body.total, 1);
  const unanswered = await as(saraa).get('/api/questions?sort=unanswered');
  assert.deepEqual(unanswered.body.questions.map((q) => q.title), ['SQL JOIN-ийн ялгаа юу вэ']);
  assert.equal((await as(saraa).get('/api/questions?sort=bad')).status, 400);
});

test('Монгол кирилл текстийг үгийн эхээр хайна (FR-13)', async () => {
  await askQuestion(bat, subject, { title: 'Жагсаалтыг эргүүлэхийг тайлбарлана уу', body: 'Холбоост жагсаалтын тухай асуулт байна' });
  await askQuestion(bat, subject, { title: 'Модны гүнийг олох', body: 'Рекурсээр бичих үү, давталтаар уу' });

  const stem = await as(saraa).get(`/api/questions?q=${encodeURIComponent('эргүүл')}`);
  assert.equal(stem.body.total, 1);
  const upper = await as(saraa).get(`/api/questions?q=${encodeURIComponent('МОДНЫ гүн')}`);
  assert.equal(upper.body.total, 1);
  const body = await as(saraa).get(`/api/questions?q=${encodeURIComponent('рекурс')}`);
  assert.equal(body.body.total, 1);
  const symbols = await as(saraa).get(`/api/questions?q=${encodeURIComponent("&|!:*'()")}`);
  assert.equal(symbols.status, 200, 'тусгай тэмдэгт tsquery-г эвдэхгүй');
});

test('гарчиг бичих үед ижил асуулт санал болгоно (FR-25)', async () => {
  await askQuestion(bat, subject, { title: 'Холбоост жагсаалтыг хэрхэн эргүүлэх вэ' });
  await askQuestion(bat, subject, { title: 'Модны гүнийг олох' });
  const res = await as(saraa).get(`/api/questions/similar?title=${encodeURIComponent('холбоост жагсаалт эргүүлэх')}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.questions.length, 1);
  assert.match(res.body.questions[0].title, /Холбоост/);
  assert.ok(res.body.questions[0].score >= 0.3);
});

test('нуугдсан асуулт оюутанд олдохгүй, админд харагдана', async () => {
  const id = await askQuestion(bat, subject);
  await pool.query('UPDATE questions SET is_hidden = TRUE WHERE id = $1', [id]);
  assert.equal((await as(saraa).get(`/api/questions/${id}`)).status, 404);
  assert.equal((await as(saraa).get('/api/questions')).body.total, 0);
  assert.equal((await as(admin).get(`/api/questions/${id}`)).status, 200);
});
