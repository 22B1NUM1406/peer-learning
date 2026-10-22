import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, createUser, loginCookie, pool } from './helpers.js';

// FR-17, NFR-03-ын хүлээн авах шалгуурууд

let student;
let admin;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  await createUser({ email: 'student@example.com' });
  await createUser({ email: 'admin@example.com', role: 'admin' });
  student = await loginCookie('student@example.com');
  admin = await loginCookie('admin@example.com');
});
after(() => pool.end());

test('нэвтрээгүй хэрэглэгч хичээлийн жагсаалт харахгүй', async () => {
  const res = await api().get('/api/subjects');
  assert.equal(res.status, 401);
});

test('админ хичээл нэмж, оюутан жагсаалтад харна', async () => {
  const created = await api().post('/api/admin/subjects').set('Cookie', admin).send({ name: 'Өгөгдлийн сан' });
  assert.equal(created.status, 201);
  const list = await api().get('/api/subjects').set('Cookie', student);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.subjects.map((s) => s.name), ['Өгөгдлийн сан']);
});

test('оюутан хичээл нэмэх, засах эрхгүй (NFR-03)', async () => {
  const res = await api().post('/api/admin/subjects').set('Cookie', student).send({ name: 'X хичээл' });
  assert.equal(res.status, 403);
});

test('давхардсан нэртэй хичээл нэмэхгүй', async () => {
  await api().post('/api/admin/subjects').set('Cookie', admin).send({ name: 'Өгөгдлийн сан' });
  const dup = await api().post('/api/admin/subjects').set('Cookie', admin).send({ name: 'Өгөгдлийн сан' });
  assert.equal(dup.status, 409);
});

test('идэвхгүй болгосон хичээл оюутанд харагдахгүй, админд харагдана', async () => {
  const { body } = await api().post('/api/admin/subjects').set('Cookie', admin).send({ name: 'Хуучин хичээл' });
  const upd = await api().patch(`/api/admin/subjects/${body.subject.id}`).set('Cookie', admin).send({ isActive: false });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.subject.isActive, false);

  const forStudent = await api().get('/api/subjects').set('Cookie', student);
  assert.equal(forStudent.body.subjects.length, 0);
  const forAdmin = await api().get('/api/admin/subjects').set('Cookie', admin);
  assert.equal(forAdmin.body.subjects.length, 1);
});

test('байхгүй хичээлийг засахад 404', async () => {
  const res = await api().patch('/api/admin/subjects/999').set('Cookie', admin).send({ name: 'Шинэ нэр' });
  assert.equal(res.status, 404);
});
