import { authorFor } from '../../lib/authors.js';
import * as repo from './search.repo.js';

// Хайлтын текстийг PostgreSQL-ийн tsquery болгоно.
// Монгол хэлэнд тусгай толь (stemmer) байхгүй тул 'simple' тохиргоо ашиглаж, үг бүрийг
// угтвараар (prefix, ':*') хайна. Ингэснээр "эргүүл" гэж хайхад "эргүүлэх", "эргүүлэхийг" олдоно.
// Зөвхөн үсэг, тоог үлдээх тул хэрэглэгчийн оруулсан тэмдэгт tsquery-ийн синтаксийг эвдэхгүй.
export function toTsQuery(text) {
  if (!text) return null;
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

export const PAGE_SIZE = 20;

export async function listQuestions({ q, subjectId, schoolId, sort, page, limit, offset }, viewer) {
  const rows = await repo.listQuestions({ subjectId, schoolId, sort, tsQuery: toTsQuery(q), limit, offset });
  return {
    page,
    total: rows[0]?.total ?? 0,
    pageSize: limit,
    questions: rows.map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      createdAt: r.created_at,
      subject: { id: r.subject_id, name: r.subject_name, code: r.subject_code, schoolShortName: r.school_short_name },
      author: authorFor(r, viewer, { anonymous: r.is_anonymous }),
      isAnonymous: r.is_anonymous,
      answerCount: r.answer_count,
      voteCount: r.vote_count,
      hasAccepted: r.has_accepted,
    })),
  };
}

// FR-25. Босго 0.3 нь pg_trgm-ийн анхдагч утга бөгөөд туршилтаар тохируулж болно.
export const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD) || 0.3;

export async function similar(title) {
  if (title.length < 5) return [];
  return repo.similarQuestions(title, SIMILARITY_THRESHOLD);
}

// Хажуугийн самбарын статистик: сүүлийн 7 хоногийн идэвх ба бүх хугацааны оноо
export const STATS_DAYS = 7;
export function communityStats() {
  return repo.communityStats(STATS_DAYS);
}
