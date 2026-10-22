import { SESSION_COOKIE, findUserBySessionToken } from '../modules/auth/auth.service.js';
import { unauthorized, forbidden } from '../lib/errors.js';

// Хүсэлт бүрт cookie-оос session-ийг уншаад req.user-д хэрэглэгчийг тавина.
// Нэвтрээгүй бол req.user = null хэвээр үлдэнэ; хамгаалах эсэхийг доорх хоёр шийднэ.
export async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) req.user = await findUserBySessionToken(token);
  next();
}

// Нэвтэрсэн хэрэглэгч шаардлагатай маршрутад (NFR-03)
export function requireAuth(req, res, next) {
  if (!req.user) throw unauthorized();
  next();
}

// Зөвхөн админд (FR-16–FR-18)
export function requireAdmin(req, res, next) {
  if (!req.user) throw unauthorized();
  if (req.user.role !== 'admin') throw forbidden();
  next();
}
