import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.js';

// Сул холболтыг өгөгдлийн сан тасалсан ч сервер унахгүй, дараагийн асуулга ажиллана.
after(() => pool.end());

test('сул холболт тасрахад процесс унахгүй, pool шинээр холбогдоно', async () => {
  const client = await pool.connect();
  const { rows } = await client.query('SELECT pg_backend_pid() AS pid');
  client.release();                          // сул болгоно
  const killer = new (await import('pg')).default.Client({ connectionString: process.env.DATABASE_URL });
  await killer.connect();
  await killer.query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
  await killer.end();
  await new Promise((r) => setTimeout(r, 200)); // pool-д 'error' үйл явдал ирэх хугацаа
  const res = await pool.query('SELECT 1 AS ok');
  assert.equal(res.rows[0].ok, 1);
});
