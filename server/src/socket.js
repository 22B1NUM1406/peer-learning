import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import { SESSION_COOKIE, findUserBySessionToken } from './modules/auth/auth.service.js';
import { sendMessage } from './modules/messages/messages.service.js';
import { AppError } from './lib/errors.js';
import { setIo } from './realtime.js';

// Бодит хугацааны мессеж (FR-22).
// Клиент → сервер: 'message:send' {to, body}  →  ack({ok, message} | {ok:false, error})
// Сервер → клиент: 'message:new' {id, senderId, receiverId, senderName, body, createdAt}
export function attachSocket(httpServer) {
  // Монолит тул клиент ижил домэйнээс холбогдоно; CORS тохиргоо хэрэггүй
  const io = new Server(httpServer);
  setIo(io);

  // Холбогдох үед HTTP-тэй ижил session cookie-оор хэрэглэгчийг танина
  const parseCookies = cookieParser();
  io.use((socket, next) => {
    const req = socket.request;
    parseCookies(req, {}, async () => {
      try {
        const token = req.cookies?.[SESSION_COOKIE];
        const user = token ? await findUserBySessionToken(token) : null;
        if (!user) return next(new Error('UNAUTHORIZED'));
        socket.data.user = user;
        next();
      } catch (err) {
        next(err);
      }
    });
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    // Хэрэглэгч бүр өөрийн өрөөнд орно. Нэг хүн олон цонх нээсэн ч бүгдэд нь хүргэнэ.
    socket.join(`user:${user.id}`);

    socket.on('message:send', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const to = Number(data?.to);
        const body = typeof data?.body === 'string' ? data.body.trim() : '';
        if (!Number.isInteger(to) || to <= 0) throw new AppError(400, 'VALIDATION', 'Хүлээн авагч буруу');
        if (!body || body.length > 2000) throw new AppError(400, 'VALIDATION', 'Мессеж 1–2000 тэмдэгт байна');
        const message = await sendMessage(user, to, body);
        reply({ ok: true, message });
      } catch (err) {
        if (!(err instanceof AppError)) console.error(err);
        reply({ ok: false, error: err instanceof AppError ? err.message : 'Серверийн алдаа' });
      }
    });
  });

  return io;
}
