import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, createSubject, askQuestion, answer, reputationOf } from './helpers.js';

// Rating ба оноо: FR-11, FR-12, FR-24, NFR-10

let asker, helper, helper2, voter, subject;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  asker = await login('asker@example.com', { name: 'Асуугч' });
  helper = await login('helper@example.com', { name: 'Туслагч' });
  helper2 = await login('helper2@example.com', { name: 'Туслагч 2' });
  voter = await login('voter@example.com', { name: 'Үнэлэгч' });
  subject = await createSubject();
});
after(() => pool.end());

test('"тустай" үнэлгээ өгөхөд хариулагчид 2 оноо нэмэгдэж, буцаахад хасагдана (FR-11, FR-24)', async () => {
  const q = await askQuestion(asker, subject);
  const a = await answer(helper, q);
  const res = await as(voter).post(`/api/answers/${a}/vote`);
  assert.equal(res.status, 201);
  assert.equal(res.body.voteCount, 1);
  assert.equal(await reputationOf(helper.id), 2);

  const detail = await as(voter).get(`/api/questions/${q}`);
  assert.equal(detail.body.question.answers[0].votedByMe, true);

  const un = await as(voter).delete(`/api/answers/${a}/vote`);
  assert.equal(un.body.voteCount, 0);
  assert.equal(await reputationOf(helper.id), 0);
});

test('нэг хариултыг хоёр удаа үнэлэхгүй, өөрийн хариултыг үнэлэхгүй (FR-11, NFR-10)', async () => {
  const q = await askQuestion(asker, subject);
  const a = await answer(helper, q);
  await as(voter).post(`/api/answers/${a}/vote`);
  assert.equal((await as(voter).post(`/api/answers/${a}/vote`)).status, 409);
  assert.equal((await as(helper).post(`/api/answers/${a}/vote`)).status, 403);
  assert.equal(await reputationOf(helper.id), 2);
});

test('зөвхөн асуугч "тусалсан" гэж тэмдэглэж, хариулагч 10 оноо ба мэдэгдэл авна (FR-12, FR-24)', async () => {
  const q = await askQuestion(asker, subject);
  const a = await answer(helper, q);
  assert.equal((await as(voter).put(`/api/questions/${q}/accepted`, { answerId: a })).status, 403);

  const res = await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a });
  assert.equal(res.status, 200);
  assert.equal(await reputationOf(helper.id), 10);
  const n = await as(helper).get('/api/notifications');
  assert.equal(n.body.notifications[0].type, 'accepted');
});

test('"тусалсан"-ыг өөр хариулт руу шилжүүлэхэд оноо шилжинэ, нэг асуултад нэг л байна (NFR-10)', async () => {
  const q = await askQuestion(asker, subject);
  const a1 = await answer(helper, q);
  const a2 = await answer(helper2, q);
  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a1 });
  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a2 });
  assert.equal(await reputationOf(helper.id), 0);
  assert.equal(await reputationOf(helper2.id), 10);

  const detail = await as(voter).get(`/api/questions/${q}`);
  const accepted = detail.body.question.answers.filter((x) => x.isAccepted);
  assert.equal(accepted.length, 1);
  assert.equal(detail.body.question.answers[0].id, a2, '"тусалсан" хариулт хамгийн дээр');

  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: null });
  assert.equal(await reputationOf(helper2.id), 0);
});

test('өөр асуултын хариултыг "тусалсан" гэж тэмдэглэхгүй', async () => {
  const q1 = await askQuestion(asker, subject);
  const q2 = await askQuestion(asker, subject, { title: 'Өөр нэг асуулт байна' });
  const a2 = await answer(helper, q2);
  assert.equal((await as(asker).put(`/api/questions/${q1}/accepted`, { answerId: a2 })).status, 400);
});

test('асуугч өөрийн хариултыг тэмдэглэж болох ч оноо авахгүй', async () => {
  const q = await askQuestion(asker, subject);
  const own = await answer(asker, q);
  assert.equal((await as(asker).put(`/api/questions/${q}/accepted`, { answerId: own })).status, 200);
  assert.equal(await reputationOf(asker.id), 0);
});

test('хариулт устгахад түүгээр олсон оноо буцаагдана', async () => {
  const q = await askQuestion(asker, subject);
  const a = await answer(helper, q);
  await as(voter).post(`/api/answers/${a}/vote`);
  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a });
  assert.equal(await reputationOf(helper.id), 12);
  await as(helper).delete(`/api/answers/${a}`);
  assert.equal(await reputationOf(helper.id), 0);
  const detail = await as(asker).get(`/api/questions/${q}`);
  assert.equal(detail.body.question.acceptedAnswerId, null);
});

test('эрэмбэ: "тусалсан", дараа нь үнэлгээгээр (P4)', async () => {
  const q = await askQuestion(asker, subject);
  const a1 = await answer(helper, q);
  const a2 = await answer(helper2, q);
  await as(voter).post(`/api/answers/${a2}/vote`);
  let d = await as(asker).get(`/api/questions/${q}`);
  assert.deepEqual(d.body.question.answers.map((x) => x.id), [a2, a1]);
  await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a1 });
  d = await as(asker).get(`/api/questions/${q}`);
  assert.deepEqual(d.body.question.answers.map((x) => x.id), [a1, a2]);
});
