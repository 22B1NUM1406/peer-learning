import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetDb, pool, login, as, api, createSubject } from './helpers.js';
import { config } from '../src/config.js';

// Resource: FR-21, FR-23, NFR-04

let bat, saraa, subject;
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 0x20)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

before(resetDb);
beforeEach(async () => {
  await resetDb();
  bat = await login('bat@example.com', { name: 'Бат' });
  saraa = await login('saraa@example.com', { name: 'Сараа' });
  subject = await createSubject();
});
after(async () => {
  await pool.end();
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
});

const upload = (user, fields, file) => {
  let req = api().post('/api/resources').set('Cookie', user.cookie);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v));
  if (file) req = req.attach('file', file.buffer, { filename: file.name, contentType: file.type });
  return req;
};

test('гадаад холбоос хуваалцаж, хичээлийн жагсаалтад харагдана (FR-21)', async () => {
  const res = await upload(bat, { subjectId: subject, title: 'Лекцийн слайд', url: 'https://example.com/slides' });
  assert.equal(res.status, 201);
  const list = await as(saraa).get(`/api/subjects/${subject}/resources`);
  assert.equal(list.body.resources[0].kind, 'link');
  assert.equal(list.body.resources[0].url, 'https://example.com/slides');
});

test('javascript: зэрэг аюултай холбоосыг хүлээж авахгүй (NFR-04)', async () => {
  const res = await upload(bat, { subjectId: subject, title: 'Хортой', url: 'javascript:alert(1)' });
  assert.equal(res.status, 400);
});

test('PDF файл байршуулж, татаж авна (FR-23)', async () => {
  const res = await upload(bat, { subjectId: subject, title: 'Бие даалт 1' }, { buffer: PDF, name: 'bd1.pdf', type: 'application/pdf' });
  assert.equal(res.status, 201);
  const list = await as(saraa).get(`/api/subjects/${subject}/resources`);
  const r = list.body.resources[0];
  assert.equal(r.kind, 'file');
  assert.equal(r.mimeType, 'application/pdf');
  assert.equal(r.fileSize, PDF.length);

  const dl = await as(saraa).get(r.fileUrl).buffer(true);
  assert.equal(dl.status, 200);
  assert.equal(dl.headers['content-type'], 'application/pdf');
  assert.match(dl.headers['content-disposition'], /filename\*=UTF-8''/);
  assert.equal(Buffer.compare(dl.body, PDF), 0);
});

test('PNG зураг байршуулна', async () => {
  const res = await upload(bat, { subjectId: subject, title: 'Диаграм' }, { buffer: PNG, name: 'd.png', type: 'image/png' });
  assert.equal(res.status, 201);
});

test('нэрийг нь .pdf болгосон өөр төрлийн файлыг хүлээж авахгүй (magic bytes, NFR-04)', async () => {
  const fake = Buffer.from('<script>alert(1)</script>');
  const res = await upload(bat, { subjectId: subject, title: 'Хуурамч' }, { buffer: fake, name: 'x.pdf', type: 'application/pdf' });
  assert.equal(res.status, 400);
  const list = await as(saraa).get(`/api/subjects/${subject}/resources`);
  assert.equal(list.body.resources.length, 0);
});

test('10 MB-аас их файлыг хүлээж авахгүй (FR-23)', async () => {
  const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
  const res = await upload(bat, { subjectId: subject, title: 'Том файл' }, { buffer: big, name: 'big.pdf', type: 'application/pdf' });
  assert.equal(res.status, 413);
});

test('холбоос ба файлыг хоёуланг нь, эсвэл аль нь ч биш илгээвэл татгалзана', async () => {
  const both = await upload(bat, { subjectId: subject, title: 'Хоёулаа', url: 'https://example.com' }, { buffer: PDF, name: 'a.pdf', type: 'application/pdf' });
  assert.equal(both.status, 400);
  const none = await upload(bat, { subjectId: subject, title: 'Юу ч үгүй' });
  assert.equal(none.status, 400);
});

test('зөвхөн эзэн нь материалаа устгана, файл дискнээс устгагдана', async () => {
  const res = await upload(bat, { subjectId: subject, title: 'Бие даалт' }, { buffer: PDF, name: 'a.pdf', type: 'application/pdf' });
  const { rows } = await pool.query('SELECT file_path FROM resources WHERE id = $1', [res.body.id]);
  const file = `${config.uploadDir}/${rows[0].file_path}`;
  assert.ok(fs.existsSync(file));
  assert.equal((await as(saraa).delete(`/api/resources/${res.body.id}`)).status, 403);
  assert.equal((await as(bat).delete(`/api/resources/${res.body.id}`)).status, 204);
  assert.ok(!fs.existsSync(file));
});
