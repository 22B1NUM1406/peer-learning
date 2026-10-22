import http from 'node:http';
import { config } from './config.js';
import { createApp } from './app.js';
import { attachSocket } from './socket.js';
import { pool } from './db.js';

const app = createApp();
// Express ба Socket.IO нэг HTTP сервер, нэг порт дээр ажиллана
const server = http.createServer(app);
attachSocket(server);

server.listen(config.port, () => {
  console.log(`Сервер ажиллаж байна: http://localhost:${config.port}`);
});

// Railway шинэ хувилбар байршуулахад SIGTERM илгээдэг: холболтуудаа цэвэрхэн хаана
process.on('SIGTERM', () => {
  server.close(() => pool.end().then(() => process.exit(0)));
});
