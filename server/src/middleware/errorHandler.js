import { AppError } from '../lib/errors.js';

// Express 5 нь async функцээс шидсэн алдааг өөрөө энд дамжуулдаг тул try/catch бичих шаардлагагүй.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // express.json() буруу JSON авбал
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'JSON буруу байна' } });
  }
  // Хүсэлтийн бие 100KB-аас их (QA тестээр 500 буцааж байсныг засав)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Илгээсэн өгөгдөл хэт том байна' } });
  }
  // Хүлээгдээгүй алдаа: дэлгэрэнгүйг зөвхөн серверийн логт бичиж, хэрэглэгчид ерөнхий мэдэгдэл өгнө
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Серверийн алдаа гарлаа' } });
}
