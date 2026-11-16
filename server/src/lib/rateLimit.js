// Нэвтрэх оролдлогын хязгаар (QA тестээр илэрсэн: нууц үгийг тасралтгүй таах боломжтой байсан).
// Нэмэлт сан ашиглахгүй, санах ойд тоолно. Сервер нэг процесст ажилладаг тул хангалттай;
// сервер дахин асахад тоолуур тэглэгдэнэ.
//
// Зөвхөн БУРУУ оролдлогыг тоолно, амжилттай нэвтэрвэл тухайн имэйлийн тоолуур арилна.
// - Нэг имэйл рүү 15 минутад 10 буруу оролдлого: тухайн бүртгэлийг таахаас хамгаална.
// - Нэг IP хаягаас 15 минутад 50 буруу оролдлого: олон бүртгэл дээр таахаас хамгаална.
//   МУИС-ийн сүлжээнд олон оюутан нэг IP-ээр гарч болох тул IP-ийн хязгаар өндөр.

export const WINDOW_MS = 15 * 60 * 1000;
export const LIMITS = { email: 10, ip: 50 };

const buckets = new Map(); // key -> { count, resetAt }

function bucket(key, now) {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  return b;
}

// Хязгаарт хүрсэн бол дахин оролдох хүртэлх секундыг, үгүй бол 0-ийг буцаана
export function loginBlockedFor({ email, ip }, now = Date.now()) {
  const checks = [[`e:${email}`, LIMITS.email], [`i:${ip}`, LIMITS.ip]];
  for (const [key, limit] of checks) {
    const b = buckets.get(key);
    if (b && b.resetAt > now && b.count >= limit) return Math.ceil((b.resetAt - now) / 1000);
  }
  return 0;
}

export function recordLoginFailure({ email, ip }, now = Date.now()) {
  bucket(`e:${email}`, now).count += 1;
  bucket(`i:${ip}`, now).count += 1;
  // Санах ой хязгааргүй өсөхөөс сэргийлж хугацаа нь дууссан бичлэгийг үе үе цэвэрлэнэ
  if (buckets.size > 10000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function recordLoginSuccess({ email }) {
  buckets.delete(`e:${email}`);
}

// Тестэд ашиглана
export function resetLoginLimits() {
  buckets.clear();
}
