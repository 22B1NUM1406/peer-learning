import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, createUser, loginCookie, pool } from './helpers.js';

// UC-01, FR-01, FR-02, NFR-01, NFR-02-ын хүлээн авах шалгуурууд

before(resetDb);
beforeEach(resetDb);
after(() => pool.end());

test('бүртгүүлэхэд нэвтэрсэн төлөвт орж, HttpOnly cookie авна', async () => {
  const res = await api().post('/api/auth/register')
    .send({ name: 'Бат', email: 'Bat@Example.com', password: 'password123' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.name, 'Бат');
  assert.equal(res.body.user.role, 'student');
  assert.equal(res.body.user.email, undefined, 'имэйл, hash хариунд байх ёсгүй');

  const cookie = res.headers['set-cookie'][0];
  assert.match(cookie, /^sid=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const me = await api().get('/api/auth/me').set('Cookie', res.headers['set-cookie']);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Бат');
});

test('нууц үг Argon2id hash-аар хадгалагдана (NFR-01)', async () => {
  await api().post('/api/auth/register').send({ name: 'Бат', email: 'bat@example.com', password: 'password123' });
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['bat@example.com']);
  assert.match(rows[0].password_hash, /^\$argon2id\$/);
  assert.ok(!rows[0].password_hash.includes('password123'));
});

test('session token өгөгдлийн санд нээлттэй хадгалагдахгүй', async () => {
  const res = await api().post('/api/auth/register').send({ name: 'Бат', email: 'bat@example.com', password: 'password123' });
  const token = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  const { rows } = await pool.query('SELECT id FROM sessions');
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].id, token);
});

test('бүртгэлтэй имэйлээр (том жижиг үсэг ялгахгүй) дахин бүртгүүлэхгүй (UC-01 2а)', async () => {
  await createUser({ email: 'bat@example.com' });
  const res = await api().post('/api/auth/register').send({ name: 'Бат', email: 'BAT@example.com', password: 'password123' });
  assert.equal(res.status, 409);
});

test('оролтыг серверт шалгана (NFR-04)', async () => {
  const short = await api().post('/api/auth/register').send({ name: 'Бат', email: 'bat@example.com', password: '123' });
  assert.equal(short.status, 400);
  const badEmail = await api().post('/api/auth/register').send({ name: 'Бат', email: 'bat', password: 'password123' });
  assert.equal(badEmail.status, 400);
  const noBody = await api().post('/api/auth/register');
  assert.equal(noBody.status, 400);
});

test('буруу нууц үг, бүртгэлгүй, түдгэлзсэн бүгд ижил ерөнхий алдаа авна (UC-01 1а-а)', async () => {
  await createUser({ email: 'bat@example.com' });
  await createUser({ email: 'blocked@example.com', status: 'suspended' });

  const wrong = await api().post('/api/auth/login').send({ email: 'bat@example.com', password: 'wrongpass' });
  const missing = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
  const blocked = await api().post('/api/auth/login').send({ email: 'blocked@example.com', password: 'password123' });

  for (const r of [wrong, missing, blocked]) assert.equal(r.status, 401);
  assert.equal(wrong.body.error.message, missing.body.error.message);
  assert.equal(wrong.body.error.message, blocked.body.error.message);
});

test('гарсны дараа session хүчингүй болно', async () => {
  await createUser({ email: 'bat@example.com' });
  const cookie = await loginCookie('bat@example.com');
  const out = await api().post('/api/auth/logout').set('Cookie', cookie);
  assert.equal(out.status, 204);
  const me = await api().get('/api/auth/me').set('Cookie', cookie);
  assert.equal(me.status, 401);
});

test('нэвтэрсний дараа түдгэлзүүлбэл session шууд ажиллахаа болино (FR-18)', async () => {
  const id = await createUser({ email: 'bat@example.com' });
  const cookie = await loginCookie('bat@example.com');
  await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [id]);
  const me = await api().get('/api/auth/me').set('Cookie', cookie);
  assert.equal(me.status, 401);
});

test('өөр сайтаас ирсэн POST хүсэлтийг хүлээж авахгүй (CSRF, NFR-02)', async () => {
  await createUser({ email: 'bat@example.com' });
  const res = await api().post('/api/auth/login')
    .set('Origin', 'https://evil.example')
    .send({ email: 'bat@example.com', password: 'password123' });
  assert.equal(res.status, 403);
});

test('нэвтрээгүй хүсэлт 401, байхгүй API зам JSON 404 буцаана', async () => {
  assert.equal((await api().get('/api/questions')).status, 401);
  await createUser({ email: 'bat@example.com' });
  const cookie = await loginCookie('bat@example.com');
  const res = await api().get('/api/nope').set('Cookie', cookie);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});
