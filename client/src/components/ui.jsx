import { Link } from 'react-router-dom';
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
        <span className="muted">Нэрээ нуусан оюутан</span>
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
export function Body({ text }) {
  return <div className="body-text">{text}</div>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs-inline" role="tablist">
      {tabs.map(([key, label]) => (
        <button
          key={key} role="tab" aria-selected={value === key}
          className={value === key ? 'tab active' : 'tab'}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
