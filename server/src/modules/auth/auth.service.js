import crypto from 'node:crypto';
import argon2 from 'argon2';
import { config } from '../../config.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import * as repo from './auth.repo.js';

// Service давхарга: бизнесийн дүрэм (UC-01). HTTP-ийн тухай юу ч мэдэхгүй.

export const SESSION_COOKIE = 'sid';

// OWASP Password Storage Cheat Sheet-ийн Argon2id-ийн хамгийн бага тохиргоо:
// 19 MiB санах ой, 2 давталт, 1 урсгал (NFR-01)
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Байхгүй имэйлээр нэвтрэх үед ч hash шалгах хугацаа ижил байлгахад ашиглана.
// Ингэхгүй бол хариу ирэх хурдаар "энэ имэйл бүртгэлтэй эсэх"-ийг таах боломжтой.
const DUMMY_HASH = await argon2.hash('dummy-password-for-timing', ARGON2_OPTIONS);

// Cookie-д санамсаргүй token хадгалж, өгөгдлийн санд түүний SHA-256 hash-ийг хадгална.
// Өгөгдлийн сан алдагдсан ч хэн нэгэн session-ийг шууд ашиглаж чадахгүй.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function startSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  await repo.createSession({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

const toPublic = ({ password_hash, ...user }) => user; // hash-ийг хариунаас хасна

// Seed скрипт админ үүсгэхэд мөн энэ функцийг ашиглана: hash-ийн тохиргоо нэг газар
export const hashPassword = (password) => argon2.hash(password, ARGON2_OPTIONS);

export async function register({ name, email, password }) {
  if (await repo.findUserByEmail(email)) throw conflict('Энэ имэйлээр бүртгэл үүссэн байна');
  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await repo.createUser({ name, email, passwordHash });
  } catch (err) {
    // Хоёр хүсэлт зэрэг ирвэл UNIQUE хязгаарлалт (23505) хамгаална
    if (err.code === '23505') throw conflict('Энэ имэйлээр бүртгэл үүссэн байна');
    throw err;
  }
  const session = await startSession(user.id);
  return { user, session };
}

export async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);
  const ok = await argon2.verify(user?.password_hash ?? DUMMY_HASH, password);
  // UC-01 1а-а: нууц үг буруу, бүртгэлгүй, түдгэлзсэн бүх тохиолдолд ижил ерөнхий мэдэгдэл
  if (!user || !ok || user.status !== 'active') {
    throw unauthorized('Имэйл эсвэл нууц үг буруу, эсвэл бүртгэл идэвхгүй байна');
  }
  await repo.deleteExpiredSessions();
  const session = await startSession(user.id);
  return { user: toPublic(user), session };
}

export async function logout(token) {
  if (token) await repo.deleteSession(hashToken(token));
}

export async function findUserBySessionToken(token) {
  return repo.findUserBySessionId(hashToken(token));
}
