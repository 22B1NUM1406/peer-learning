import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, pool, login, as, createSubject, askQuestion, answer } from './helpers.js';

// Санал болгосон 7 боломж: оноог хуурахаас хамгаалах, түвшин, тэмдэг (4), мэдэгдэл (8),
// хадгалах ба хувийн статистик (7), төстэй асуулт (5), хариулагчийн туршлага (6).

let asker, helper, voter, other, ds, db;

const rep = async (u) => (await pool.query('SELECT reputation FROM users WHERE id = $1', [u.id])).rows[0].reputation;
const notifs = async (u) => (await as(u).get('/api/notifications')).body.notifications;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  asker = await login('asker@example.com', { name: 'Асуугч' });
  helper = await login('helper@example.com', { name: 'Туслагч' });
  voter = await login('voter@example.com', { name: 'Үнэлэгч' });
  other = await login('other@example.com', { name: 'Бусад' });
  ds = await createSubject('Өгөгдлийн бүтэц');
  db = await createSubject('Өгөгдлийн сан');
});
after(() => pool.end());

// ---------------------------------------------------------------- (4) Оноо, түвшин, тэмдэг

test('нэг оюутан нэг хүнд 24 цагт 3 удаагаас илүү оноо өгөхгүй; үнэлгээ тоонд орсоор', async () => {
  const answers = [];
  for (let i = 0; i < 4; i++) {
    const q = await askQuestion(asker, ds, { title: `Асуултын гарчиг дугаар ${i + 1}` });
    answers.push(await answer(helper, q));
  }
  for (const a of answers) assert.ok([200, 201].includes((await as(voter).post(`/api/answers/${a}/vote`)).status));
  assert.equal(await rep(helper), 6);                      // 3 × 2, дөрөв дэх нь оноо өгөөгүй
  const fourth = await pool.query('SELECT COUNT(*)::int AS n FROM votes WHERE answer_id = $1', [answers[3]]);
  assert.equal(fourth.rows[0].n, 1);                       // үнэлгээ өөрөө хадгалагдсан

  await as(voter).delete(`/api/answers/${answers[3]}/vote`);
  assert.equal(await rep(helper), 6);                      // оноо өгөөгүй үнэлгээг буцаахад хасахгүй
  await as(voter).delete(`/api/answers/${answers[0]}/vote`);
  assert.equal(await rep(helper), 4);

  // Өөр үнэлэгчийн хязгаар тусдаа
  await as(other).post(`/api/answers/${answers[3]}/vote`);
  assert.equal(await rep(helper), 6);
});

test('хариулт устгахад зөвхөн бодитоор өгсөн оноо буцаагдана', async () => {
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const q = await askQuestion(asker, ds, { title: `Устгах туршилтын асуулт ${i + 1}` });
    ids.push(await answer(helper, q));
  }
  for (const a of ids) await as(voter).post(`/api/answers/${a}/vote`);
  assert.equal(await rep(helper), 6);
  await as(helper).delete(`/api/answers/${ids[3]}`);     // оноо өгөөгүй үнэлгээтэй
  assert.equal(await rep(helper), 6);
  await as(helper).delete(`/api/answers/${ids[0]}`);
  assert.equal(await rep(helper), 4);
});

test('хариулагчийн түвшин ба тухайн хичээлд тусалсан тоо асуултын хуудсанд харагдана', async () => {
  const q1 = await askQuestion(asker, ds);
  const a1 = await answer(helper, q1);
  await as(asker).put(`/api/questions/${q1}/accepted`, { answerId: a1 });
  const q2 = await askQuestion(asker, ds, { title: 'Хоёр дахь асуултын гарчиг' });
  await answer(helper, q2);
  const q3 = await askQuestion(asker, db, { title: 'Өөр хичээлийн асуулт' });
  await answer(helper, q3);

  const page = await as(other).get(`/api/questions/${q2}`);
  const a = page.body.question.answers[0];
  assert.equal(a.authorAcceptedInSubject, 1);
  assert.deepEqual(a.author.level, { key: 'helper', name: 'Туслагч' });   // 10 оноо
  const page3 = await as(other).get(`/api/questions/${q3}`);
  assert.equal(page3.body.question.answers[0].authorAcceptedInSubject, 0);     // өөр хичээлд тооцохгүй
});

test('профайл: түвшин, тэмдэг, хичээлээр идэвх; мэдэгдлийн тохиргоо зөвхөн өөрт', async () => {
  for (let i = 0; i < 3; i++) {
    const q = await askQuestion(asker, ds, { title: `Тэмдгийн туршилтын асуулт ${i + 1}` });
    const a = await answer(helper, q);
    await as(asker).put(`/api/questions/${q}/accepted`, { answerId: a });
  }
  await askQuestion(helper, db, { title: 'Нэрээ нуусан асуулт', isAnonymous: true });

  const p = (await as(other).get(`/api/users/${helper.id}`)).body.user;
  assert.equal(p.level.name, 'Туслагч');
  assert.equal(p.level.nextName, 'Идэвхтэй туслагч');
  assert.equal(p.level.nextAt, 50);
  assert.equal(p.helpedStudents, 1);
  const earned = p.badges.filter((b) => b.earned).map((b) => b.name);
  assert.deepEqual(earned, ['Анхны хариулт', 'Анх тусалсан', 'Өгөгдлийн бүтэц: шилдэг туслагч']);
  // Бусдад нэрээ нуусан асуултын хичээл харагдахгүй
  assert.deepEqual(p.subjectActivity.map((s) => [s.name, s.questions, s.answers, s.accepted]), [['Өгөгдлийн бүтэц', 0, 3, 3]]);
  assert.equal(p.notifyNewQuestions, undefined);

  const mine = (await as(helper).get(`/api/users/${helper.id}`)).body.user;
  assert.equal(mine.notifyNewQuestions, true);
  assert.equal(mine.subjectActivity.length, 2);
});

// ---------------------------------------------------------------- (8) Ухаалаг мэдэгдэл

test('шинэ асуулт тухайн хичээлийн туслагчдад очно; асуугч, тохиргоо унтраасан, түдгэлзсэн хүнд очихгүй', async () => {
  await as(helper).put('/api/users/me/subjects', { subjectIds: [ds] });
  await as(voter).put('/api/users/me/subjects', { subjectIds: [ds] });
  await as(other).put('/api/users/me/subjects', { subjectIds: [db] });
  await as(asker).put('/api/users/me/subjects', { subjectIds: [ds] });
  await as(voter).patch('/api/users/me', { name: 'Үнэлэгч', notifyNewQuestions: false });

  const q = await askQuestion(asker, ds);
  const h = await notifs(helper);
  assert.deepEqual(h.map((n) => [n.type, n.questionId]), [['new_question', q]]);
  assert.equal((await notifs(voter)).length, 0);   // тохиргоо унтраасан
  assert.equal((await notifs(other)).length, 0);   // өөр хичээл
  assert.equal((await notifs(asker)).length, 0);   // өөрийн асуулт

  await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [helper.id]);
  await askQuestion(asker, ds, { title: 'Дараагийн асуултын гарчиг' });
  const rows = await pool.query("SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1", [helper.id]);
  assert.equal(rows.rows[0].n, 1);
});

test('үнэлгээний мэдэгдэл давхардахгүй; хадгалсан асуултад шинэ хариулт ирэхэд мэдэгдэнэ', async () => {
  const q = await askQuestion(asker, ds);
  const a = await answer(helper, q);
  await as(voter).post(`/api/answers/${a}/vote`);
  await as(other).post(`/api/answers/${a}/vote`);
  assert.deepEqual((await notifs(helper)).map((n) => n.type), ['vote']);

  assert.equal((await as(voter).put(`/api/questions/${q}/bookmark`)).status, 200);
  await answer(other, q, 'Өөр нэгэн тайлбартай хариулт');
  assert.deepEqual((await notifs(voter)).map((n) => n.type), ['followed_answer']);
  // Хариулагч өөрөө хадгалсан ч өөрийн хариултад мэдэгдэл авахгүй
  await as(other).put(`/api/questions/${q}/bookmark`);
  await answer(other, q, 'Гурав дахь тайлбартай хариулт энд');
  assert.equal((await notifs(other)).filter((n) => n.type === 'followed_answer').length, 0);
  // Асуугч new_answer авна, followed_answer давхар авахгүй
  await as(asker).put(`/api/questions/${q}/bookmark`);
  await answer(helper, q, 'Дөрөв дэх тайлбартай хариулт энд');
  assert.equal((await notifs(asker)).filter((n) => n.type === 'followed_answer').length, 0);
});

// ---------------------------------------------------------------- (7) Хадгалах

test('асуулт хадгалах, болиулах, хадгалсан жагсаалт', async () => {
  const q = await askQuestion(asker, ds);
  assert.equal((await as(voter).get(`/api/questions/${q}`)).body.question.bookmarkedByMe, false);
  await as(voter).put(`/api/questions/${q}/bookmark`);
  await as(voter).put(`/api/questions/${q}/bookmark`);   // давхар хадгалахгүй
  assert.equal((await as(voter).get(`/api/questions/${q}`)).body.question.bookmarkedByMe, true);
  const list = await as(voter).get('/api/users/me/bookmarks');
  assert.deepEqual(list.body.questions.map((x) => [x.id, x.subject.name]), [[q, 'Өгөгдлийн бүтэц']]);
  assert.equal((await as(other).get('/api/users/me/bookmarks')).body.questions.length, 0);
  await as(voter).delete(`/api/questions/${q}/bookmark`);
  assert.equal((await as(voter).get('/api/users/me/bookmarks')).body.questions.length, 0);
  assert.equal((await as(voter).put('/api/questions/9999/bookmark')).status, 404);
});

// ---------------------------------------------------------------- (5) Төстэй асуулт

test('төстэй асуултууд: гарчгийн төстэй байдал, ижил хичээлийнх эхэнд, нуусан нь орохгүй', async () => {
  const base = await askQuestion(asker, ds, { title: 'Холбоост жагсаалтыг хэрхэн эргүүлэх вэ' });
  const same = await askQuestion(other, ds, { title: 'Холбоост жагсаалт эргүүлэх рекурс' });
  const otherSubj = await askQuestion(other, db, { title: 'Холбоост жагсаалтыг эргүүлэх SQL' });
  const hidden = await askQuestion(other, ds, { title: 'Холбоост жагсаалтыг хэрхэн эргүүлэх' });
  await pool.query('UPDATE questions SET is_hidden = TRUE WHERE id = $1', [hidden]);
  await askQuestion(other, ds, { title: 'Матрицын үржвэр олох' });

  const res = await as(voter).get(`/api/questions/${base}/related`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.questions.map((q) => q.id), [same, otherSubj]);
});
