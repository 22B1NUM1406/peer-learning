import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { query } from './db.js';
import { loadUser, requireAuth } from './middleware/auth.js';
import { sameOrigin } from './middleware/sameOrigin.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './lib/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { subjectRoutes, adminSubjectRoutes } from './modules/subjects/subjects.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { qaRoutes } from './modules/qa/qa.routes.js';
import { ratingRoutes } from './modules/rating/rating.routes.js';
import { resourceRoutes } from './modules/resources/resources.routes.js';
import { reportRoutes, adminModerationRoutes } from './modules/moderation/moderation.routes.js';
import { messageRoutes } from './modules/messages/messages.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  // Railway хүсэлтийг өөрийн proxy-гоор дамжуулдаг. Үүнийг итгэхгүй бол Express
  // хүсэлтийг HTTP гэж үзэж, Secure cookie болон req.protocol буруу ажиллана.
  if (config.isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Хөтчийн аюулгүй байдлын үндсэн толгойнууд
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');                 // өөр сайт iframe-д оруулахгүй (clickjacking)
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // ---------------------------------------------------------------- API
  const api = express.Router();
  api.use(sameOrigin);
  api.use(loadUser);

  // Railway-ийн healthcheck: сервер ба өгөгдлийн сан ажиллаж байгааг шалгана
  api.get('/health', async (req, res) => {
    await query('SELECT 1');
    res.json({ ok: true });
  });

  // Нэвтрэхгүйгээр ашиглах цорын ганц модуль
  api.use('/auth', authRoutes);

  // Үүнээс доош бүх API нэвтрэлт шаардана (NFR-03)
  api.use(requireAuth);
  api.use('/admin/subjects', adminSubjectRoutes);
  api.use('/admin', adminModerationRoutes);
  api.use('/subjects', subjectRoutes);
  api.use(userRoutes);
  api.use(searchRoutes);      // '/questions/similar' нь '/questions/:id'-ээс өмнө байх ёстой
  api.use(qaRoutes);
  api.use(ratingRoutes);
  api.use(resourceRoutes);
  api.use(reportRoutes);
  api.use(messageRoutes);

  // Олдоогүй API зам нь React-ийн index.html биш, JSON 404 буцаах ёстой
  api.use(() => { throw notFound('API зам олдсонгүй'); });
  app.use('/api', api);

  // ------------------------------------------------------ React (монолит)
  // Production-д client/dist-ийг Express өөрөө үйлчилнэ: frontend, API нэг домэйнд.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    // React Router-ийн бүх хуудсанд (/questions/5 гэх мэт) index.html өгнө
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
