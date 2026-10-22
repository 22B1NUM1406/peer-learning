import { badRequest } from './errors.js';

// Оролт шалгах жижиг туслах функцууд (NFR-04: оролтыг серверт шалгана).
// Клиентийн шалгалтад найдаж болохгүй: хэн ч API-г шууд дуудаж чадна.

export function requireString(value, field, { min = 1, max = 1000 } = {}) {
  if (typeof value !== 'string') throw badRequest(`${field} заавал бөглөнө`);
  const v = value.trim();
  if (v.length < min) throw badRequest(`${field} хамгийн багадаа ${min} тэмдэгт байна`);
  if (v.length > max) throw badRequest(`${field} хамгийн ихдээ ${max} тэмдэгт байна`);
  return v;
}

// Дамжуулаагүй бол undefined, дамжуулсан бол requireString-ийн дүрмээр шалгана
export function optionalString(value, field, opts) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, opts);
}

export function requireEmail(value) {
  const v = requireString(value, 'Имэйл', { max: 255 }).toLowerCase();
  // Энгийн хэлбэрийн шалгалт; имэйл үнэхээр байгаа эсэхийг шалгахгүй
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest('Имэйлийн хэлбэр буруу байна');
  return v;
}

export function requireId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${field} буруу байна`);
  return n;
}

export function optionalId(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireId(value, field);
}

export function optionalBoolean(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`${field} true/false байна`);
  return value;
}

export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} буруу байна`);
  return value;
}

// Зөвхөн http(s) холбоос зөвшөөрнө: javascript: гэх мэт аюултай холбоосоос хамгаална (NFR-04)
export function requireUrl(value, field = 'Холбоос') {
  const v = requireString(value, field, { max: 2000 });
  let url;
  try { url = new URL(v); } catch { throw badRequest(`${field} буруу байна`); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw badRequest(`${field} http эсвэл https байх ёстой`);
  return url.toString();
}

// ?page=2 гэх мэт хуудаслалт
export function pageParams(query, pageSize = 20) {
  const page = Math.max(1, Math.min(1000, Number.parseInt(query.page, 10) || 1));
  return { limit: pageSize, offset: (page - 1) * pageSize, page };
}
