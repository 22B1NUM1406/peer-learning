// Нэр нууцлалт (FR-20, NFR-12).
// author_id өгөгдлийн санд үргэлж хадгалагдана; нэрийг нуух нь зөвхөн API-ийн хариунд хийгдэнэ.
// Асуулт нууцлагдсан бол бусад оюутанд author = null. Харин асуугч өөрөө болон админ харна.
import { levelFor } from './levels.js';

export function authorFor(row, viewer, { anonymous = false } = {}) {
  const canSee = !anonymous || viewer?.role === 'admin' || viewer?.id === row.author_id;
  if (!canSee) return null;
  const level = levelFor(row.author_reputation);
  return { id: row.author_id, name: row.author_name, reputation: row.author_reputation, level: { key: level.key, name: level.name } };
}

export const isOwner = (row, viewer) => viewer && row.author_id === viewer.id;
