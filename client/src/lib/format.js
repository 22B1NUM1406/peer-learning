// Хугацааг "5 минутын өмнө" хэлбэрээр
export function timeAgo(value) {
  const sec = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (sec < 60) return 'саяхан';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} минутын өмнө`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} цагийн өмнө`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} өдрийн өмнө`;
  return new Date(value).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function fileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const initials = (name = '?') => name.trim().charAt(0).toUpperCase();
