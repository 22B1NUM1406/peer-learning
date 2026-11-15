// Өгөгдлийн сангийн схемийг үүсгэж, шинэчилнэ: npm run db:migrate
//  1) Хүснэгтүүд байхгүй бол db/schema.sql-ээр анхны схемийг үүсгэнэ.
//  2) db/migrations/*.sql-ийг нэрийн дарааллаар ажиллуулна. Файл бүр IF NOT EXISTS
//     ашигладаг тул дахин ажиллуулахад аюулгүй; ажиллаж буй өгөгдлийн санг устгахгүй.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { rows } = await pool.query("SELECT to_regclass('public.users') AS t");
if (rows[0].t) {
  console.log('Анхны схем аль хэдийн үүссэн байна.');
} else {
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  console.log('Анхны схем үүслээ: 12 хүснэгт.');
}

const dir = path.join(__dirname, '../db/migrations');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  console.log(`Шинэчлэл: ${file}`);
}
await pool.end();
