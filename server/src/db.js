import pg from 'pg';
import { config } from './config.js';

// Холболтын сан (pool): хүсэлт бүрт шинэ холболт нээхгүй, бэлэн холболтыг дахин ашиглана.
// Neon-ий холболтын мөрөнд ?sslmode=require байгаа тул SSL автоматаар идэвхжинэ.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

// Сул (idle) холболтыг өгөгдлийн сан өөрөө тасалж болно: Neon-ий үнэгүй төлөвлөгөө идэвхгүй үед
// унтдаг, мөн дахин эхлүүлэх үед холболтууд тасарна. Энэ үйл явдлыг сонсохгүй бол Node.js
// процесс бүхэлдээ унана. Тасарсан холболтыг pool өөрөө хаяж, дараагийн хүсэлтэд шинийг нээнэ.
pool.on('error', (err) => {
  console.error('Өгөгдлийн сангийн сул холболт тасарлаа (дараагийн хүсэлтэд шинээр холбогдоно):', err.message);
});

// Энгийн асуулга: db.query('SELECT ... WHERE id = $1', [id])
// $1, $2 параметрээр дамжуулснаар SQL injection-оос хамгаална. Хэзээ ч текстэд залгаж болохгүй.
export const query = (text, params) => pool.query(text, params);

// Транзакц: олон асуулгыг "бүгд эсвэл юу ч биш" байдлаар гүйцэтгэнэ.
// Жишээ нь оноо (FR-24) шинэчлэхэд үнэлгээ ба USERS.reputation хамт өөрчлөгдөх ёстой.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
