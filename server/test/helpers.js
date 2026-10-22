import request from 'supertest';
import { pool } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

// Тестийг тусдаа өгөгдлийн сан дээр ажиллуулна (.env.test-ийн DATABASE_URL).
// Хөгжүүлэлтийн эсвэл Neon дээрх өгөгдлийг хэзээ ч устгахгүйн тулд нэрийг шалгана.
if (!/test/i.test(process.env.DATABASE_URL)) {
  throw new Error('Тестийн DATABASE_URL-ийн нэрэнд "test" гэж орсон байх ёстой');
}

export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  await pool.query(`TRUNCATE users, subjects, sessions, questions, answers, votes, comments,
    resources, reports, messages, notifications, user_subjects RESTART IDENTITY CASCADE`);
}

export async function createUser({ email, password = 'password123', role = 'student', status = 'active', name = 'Тест' }) {
  const hash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, email, hash, role, status],
  );
  return rows[0].id;
}

// Нэвтэрч, дараагийн хүсэлтэд дамжуулах cookie-г буцаана
export async function loginCookie(email, password = 'password123') {
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return res.headers['set-cookie'];
}

export { pool };

export async function createSubject(name = 'Өгөгдлийн бүтэц', isActive = true) {
  const { rows } = await pool.query('INSERT INTO subjects (name, is_active) VALUES ($1, $2) RETURNING id', [name, isActive]);
  return rows[0].id;
}

// Нэвтэрсэн хэрэглэгч үүсгэж {id, cookie} буцаана
export async function login(email, opts = {}) {
  const id = await createUser({ email, ...opts });
  return { id, cookie: await loginCookie(email) };
}

export async function reputationOf(userId) {
  const { rows } = await pool.query('SELECT reputation FROM users WHERE id = $1', [userId]);
  return rows[0].reputation;
}

// Хүсэлтийг тухайн хэрэглэгчээр илгээх товчлол: as(user).get('/api/...')
export const as = (user) => ({
  get: (url) => api().get(url).set('Cookie', user.cookie),
  post: (url, body) => api().post(url).set('Cookie', user.cookie).send(body),
  patch: (url, body) => api().patch(url).set('Cookie', user.cookie).send(body),
  put: (url, body) => api().put(url).set('Cookie', user.cookie).send(body),
  delete: (url) => api().delete(url).set('Cookie', user.cookie),
});

export async function askQuestion(user, subjectId, extra = {}) {
  const res = await as(user).post('/api/questions', {
    title: 'Холбоост жагсаалтыг хэрхэн эргүүлэх вэ',
    body: 'Pointer ашиглан жагсаалтыг эргүүлэх кодоо ойлгохгүй байна',
    subjectId,
    ...extra,
  });
  if (res.status !== 201) throw new Error(`askQuestion: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

export async function answer(user, questionId, body = 'Гурван заагч ашиглана: prev, cur, next. Учир нь холбоосыг алдахгүйн тулд.') {
  const res = await as(user).post(`/api/questions/${questionId}/answers`, { body });
  if (res.status !== 201) throw new Error(`answer: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}
