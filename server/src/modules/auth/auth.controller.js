import { config } from '../../config.js';
import { requireEmail, requireString } from '../../lib/validate.js';
import { tooMany } from '../../lib/errors.js';
import { loginBlockedFor, recordLoginFailure, recordLoginSuccess } from '../../lib/rateLimit.js';
import * as service from './auth.service.js';

// Controller давхарга: HTTP хүсэлтийн оролтыг шалгаж, service-ийг дуудаж, хариу буцаана.

function setSessionCookie(res, { token, expiresAt }) {
  res.cookie(service.SESSION_COOKIE, token, {
    httpOnly: true,          // JavaScript уншиж чадахгүй: XSS-ээр хулгайлагдахгүй (NFR-02)
    secure: config.isProd,   // Production-д зөвхөн HTTPS-ээр
    sameSite: 'lax',         // Өөр сайтаас илгээсэн POST хүсэлтэд cookie явахгүй (CSRF)
    expires: expiresAt,
    path: '/',
  });
}

// Хэрэглэгчийн мэдээллээс клиентэд хэрэгтэйг нь л буцаана
const me = (u) => ({ id: u.id, name: u.name, role: u.role, reputation: u.reputation });

export async function register(req, res) {
  const name = requireString(req.body?.name, 'Нэр', { min: 2, max: 100 });
  const email = requireEmail(req.body?.email);
  const password = requireString(req.body?.password, 'Нууц үг', { min: 8, max: 128 });
  const { user, session } = await service.register({ name, email, password });
  setSessionCookie(res, session);
  res.status(201).json({ user: me(user) });
}

export async function login(req, res) {
  const email = requireEmail(req.body?.email);
  const password = requireString(req.body?.password, 'Нууц үг', { max: 128 });
  const key = { email, ip: req.ip };
  const wait = loginBlockedFor(key);
  if (wait) {
    res.set('Retry-After', String(wait));
    throw tooMany(`Буруу оролдлого хэт олон боллоо. ${Math.ceil(wait / 60)} минутын дараа дахин оролдоно уу`);
  }
  let result;
  try {
    result = await service.login({ email, password });
  } catch (err) {
    if (err.status === 401) recordLoginFailure(key);
    throw err;
  }
  recordLoginSuccess(key);
  const { user, session } = result;
  setSessionCookie(res, session);
  res.json({ user: me(user) });
}

export async function logout(req, res) {
  await service.logout(req.cookies?.[service.SESSION_COOKIE]);
  res.clearCookie(service.SESSION_COOKIE, { path: '/' });
  res.status(204).end();
}

export function getMe(req, res) {
  res.json({ user: me(req.user) });
}
