import { forbidden } from '../lib/errors.js';

// CSRF-ээс хамгаалах нэмэлт давхарга (NFR-02).
// Үндсэн хамгаалалт нь cookie-ийн SameSite=Lax. Үүн дээр өгөгдөл өөрчлөх хүсэлтийн
// Origin толгой нь манай домэйн эсэхийг шалгана. Монолит тул зөвхөн нэг домэйн зөвшөөрнө.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  // Хөтөч бус клиент (curl, тест) Origin илгээдэггүй; тэд cookie-г автоматаар дамжуулахгүй тул CSRF-ийн эрсдэлгүй
  if (!origin) return next();
  const expected = `${req.protocol}://${req.get('host')}`;
  if (origin !== expected) throw forbidden('Өөр сайтаас ирсэн хүсэлтийг хүлээж авахгүй');
  next();
}
