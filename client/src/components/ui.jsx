import { Link } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { initials, timeAgo } from '../lib/format.js';

// Олон хуудсанд давтагддаг жижиг бүрэлдэхүүнүүд

export function Avatar({ name, size = 32 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// Нэр нууцалсан бол author = null ирнэ (FR-20)
export function AuthorLine({ author, createdAt, anonymous }) {
  return (
    <span className="author-line">
      {author ? (
        <Link to={`/users/${author.id}`} className="author-link">
          <Avatar name={author.name} size={22} />
          {author.name}
          {author.reputation != null && <span className="rep" title="Оноо">{author.reputation}</span>}
        </Link>
      ) : (
        <span className="anon"><span className="anon-avatar" aria-hidden="true"><EyeOff size={12} /></span>Нэрээ нуусан оюутан</span>
      )}
      {anonymous && author && <span className="tag tag-muted">нэрээ нуусан</span>}
      {createdAt && <span className="muted"> · {timeAgo(createdAt)}</span>}
    </span>
  );
}

export function Loading() {
  return <p className="muted">Ачаалж байна…</p>;
}

export function ErrorText({ error }) {
  if (!error) return null;
  return <p className="error" role="alert">{error.message ?? String(error)}</p>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

// Хэрэглэгчийн бичсэн текстийг React автоматаар escape хийдэг (NFR-04);
// pre-wrap нь мөр шилжилт, код зэргийг хадгална
// Санал 6: хариулт, асуултад бичсэн материалын холбоосыг (http/https) дарж нээдэг болгоно.
// HTML хэлбэрээр биш, React-ийн текст ба <a> элементээр үүсгэх тул XSS-ийн эрсдэлгүй.
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
export function Body({ text }) {
  const parts = String(text ?? '').split(URL_RE);
  return (
    <div className="body-text">
      {parts.map((p, i) => (i % 2 === 1
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>
        : p))}
    </div>
  );
}

// variant="segmented" нь нүүр хуудасны товч хэлбэрийн таб; tabs: [[key, label, Icon?]]
export function Tabs({ tabs, value, onChange, variant }) {
  return (
    <div className={variant === 'segmented' ? 'segmented' : 'tabs-inline'} role="tablist">
      {tabs.map(([key, label, Icon]) => (
        <button
          key={key} role="tab" aria-selected={value === key}
          className={value === key ? 'tab active' : 'tab'}
          onClick={() => onChange(key)}
        >
          {Icon && <Icon size={15} />}{label}
        </button>
      ))}
    </div>
  );
}
