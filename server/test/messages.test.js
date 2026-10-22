import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as ioClient } from 'socket.io-client';
import { resetDb, pool, login, as, app } from './helpers.js';
import { attachSocket } from '../src/socket.js';

// Message & Notification: FR-19, FR-22

let bat, saraa, dorj;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  bat = await login('bat@example.com', { name: 'Бат' });
  saraa = await login('saraa@example.com', { name: 'Сараа' });
  dorj = await login('dorj@example.com', { name: 'Дорж' });
});
after(() => pool.end());

test('мессеж илгээж, ярианы жагсаалт ба мессежүүдийг харна (FR-22)', async () => {
  await as(bat).post(`/api/conversations/${saraa.id}/messages`, { body: 'Сайн уу, асуулт байна' });
  await as(saraa).post(`/api/conversations/${bat.id}/messages`, { body: 'Асуугаарай' });
  await as(dorj).post(`/api/conversations/${bat.id}/messages`, { body: 'Сайн уу' });

  const conv = await as(bat).get('/api/conversations');
  assert.deepEqual(conv.body.conversations.map((c) => c.name), ['Дорж', 'Сараа']);
  const msgs = await as(bat).get(`/api/conversations/${saraa.id}/messages`);
  assert.deepEqual(msgs.body.messages.map((m) => m.body), ['Сайн уу, асуулт байна', 'Асуугаарай']);
  // Гуравдагч хүн бусдын яриаг харахгүй: өөрийнх нь хоосон
  const other = await as(dorj).get(`/api/conversations/${saraa.id}/messages`);
  assert.equal(other.body.messages.length, 0);
});

test('өөртөө, байхгүй хэрэглэгчид мессеж илгээхгүй', async () => {
  assert.equal((await as(bat).post(`/api/conversations/${bat.id}/messages`, { body: 'x' })).status, 400);
  assert.equal((await as(bat).post('/api/conversations/9999/messages', { body: 'x' })).status, 404);
});

test('мэдэгдлийг уншсан болгоно; бусдын мэдэгдэлд хүрэхгүй (FR-19, NFR-03)', async () => {
  const { rows } = await pool.query("INSERT INTO subjects (name) VALUES ('Х') RETURNING id");
  const q = await as(bat).post('/api/questions', { title: 'Асуултын гарчиг', body: 'Асуултын дэлгэрэнгүй агуулга', subjectId: rows[0].id });
  await as(saraa).post(`/api/questions/${q.body.id}/answers`, { body: 'Хариулт ба тайлбар энд байна' });
  await as(dorj).post(`/api/questions/${q.body.id}/answers`, { body: 'Өөр хариулт ба тайлбар' });

  let n = await as(bat).get('/api/notifications');
  assert.equal(n.body.unread, 2);
  const id = n.body.notifications[0].id;
  assert.equal((await as(saraa).patch(`/api/notifications/${id}/read`)).status, 404);
  assert.equal((await as(bat).patch(`/api/notifications/${id}/read`)).status, 204);
  n = await as(bat).get('/api/notifications');
  assert.equal(n.body.unread, 1);
  await as(bat).post('/api/notifications/read-all');
  n = await as(bat).get('/api/notifications');
  assert.equal(n.body.unread, 0);
});

test('Socket.IO-оор мессеж бодит хугацаанд хүрнэ; cookie-гүй холболтыг татгалзана (FR-22)', async () => {
  const server = http.createServer(app);
  attachSocket(server);
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const connect = (cookie) => ioClient(url, { transports: ['websocket'], extraHeaders: cookie ? { Cookie: cookie.join('; ') } : {}, reconnection: false });

  try {
    const anon = connect(null);
    const err = await new Promise((r) => anon.on('connect_error', r));
    assert.equal(err.message, 'UNAUTHORIZED');
    anon.close();

    const a = connect(bat.cookie);
    const b = connect(saraa.cookie);
    await Promise.all([a, b].map((s) => new Promise((r) => s.on('connect', r))));

    const received = new Promise((r) => b.on('message:new', r));
    const ack = await a.emitWithAck('message:send', { to: saraa.id, body: 'Бодит хугацаанд' });
    assert.equal(ack.ok, true);
    const msg = await received;
    assert.equal(msg.body, 'Бодит хугацаанд');
    assert.equal(msg.senderName, 'Бат');

    const bad = await a.emitWithAck('message:send', { to: bat.id, body: 'өөртөө' });
    assert.equal(bad.ok, false);
    a.close(); b.close();
  } finally {
    await new Promise((r) => server.close(r));
  }
});
