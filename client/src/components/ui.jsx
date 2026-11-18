import { Link } from 'react-router-dom';
import { CircleAlert, EyeOff, Inbox, RotateCw } from 'lucide-react';
import { initials, timeAgo } from '../lib/format.js';

// Олон хуудсанд давтагддаг жижиг бүрэлдэхүүнүүд

// Нэрээс тогтмол өнгө сонгоно: нэг хүн хаана ч ижил өнгөтэй харагдана
const AVATAR_TONES = 6;
const tone = (name = '') => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES;

export function Avatar({ name, size = 32 }) {
  return (
    <span className={`avatar tone-${tone(name)}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// Нэр нууцалсан бол author = null ирнэ (FR-20)
export function AuthorLine({ author, createdAt, anonymous, compact }) {
  return (
    <span className="author-line">
      {author ? (
        <Link to={`/users/${author.id}`} className="author-link">
          <Avatar name={author.name} size={compact ? 18 : 22} />
          <span className="author-name">{author.name}</span>
          {author.reputation != null && <span className="rep" title="Оноо">{author.reputation}</span>}
        </Link>
      ) : (
        <span className="anon"><span className="anon-avatar" aria-hidden="true"><EyeOff size={11} /></span>Нэрээ нуусан оюутан</span>
      )}
      {anonymous && author && <span className="tag tag-muted">нэрээ нуусан</span>}
      {createdAt && <time className="muted" dateTime={createdAt}>{timeAgo(createdAt)}</time>}
    </span>
  );
}

// Ачаалж буй үед бодит агуулгын хэлбэртэй саарал мөрүүд
export function Loading({ rows = 3, label = 'Ачаалж байна…' }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <span className="sk sk-a" /><span className="sk sk-b" /><span className="sk sk-c" />
        </div>
      ))}
    </div>
  );
}

// Алдааг юу болсон, яах ёстойг хамт хэлж харуулна; onRetry өгвөл дахин оролдох товчтой
export function ErrorText({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <CircleAlert size={16} />
      <span className="grow">{error.message ?? String(error)}</span>
      {onRetry && <button type="button" className="link-btn" onClick={onRetry}><RotateCw size={14} />Дахин оролдох</button>}
    </div>
  );
}

// Хоосон төлөв: юу байхгүйг ба дараа нь юу хийхийг хэлнэ
export function Empty({ children, icon: Icon = Inbox, title, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={20} /></span>
      {title && <strong className="empty-title">{title}</strong>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// Хуудасны толгой: гарчиг, тайлбар, баруун талд үндсэн үйлдэл
export function PageHeader({ title, sub, actions, children }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {children}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

// Хэрэглэгчийн бичсэн текстийг React автоматаар escape хийдэг (NFR-04);
// pre-wrap нь мөр шилжилт, код зэргийг хадгална
// FR-32: хариулт, асуултад бичсэн материалын холбоосыг (http/https) дарж нээдэг болгоно.
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

// variant="segmented" нь товч хэлбэрийн таб; tabs: [[key, label, Icon?, count?]]
export function Tabs({ tabs, value, onChange, variant }) {
  return (
    <div className={variant === 'segmented' ? 'segmented' : 'tabs-inline'} role="tablist">
      {tabs.map(([key, label, Icon, count]) => (
        <button
          key={key} type="button" role="tab" aria-selected={value === key}
          className={value === key ? 'tab active' : 'tab'}
          onClick={() => onChange(key)}
        >
          {Icon && <Icon size={15} />}{label}
          {count != null && <span className="tab-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}

// Сургуулийн сонголтууд: бүрэлдэхүүн ба салбар сургуулийг бүлэглэнэ (<select> дотор)
export function SchoolOptions({ schools, valueKey = 'id', full = false }) {
  const groups = [];
  for (const s of schools) {
    const kind = s.kind || 'Сургууль';
    if (!groups.length || groups.at(-1).kind !== kind) groups.push({ kind, items: [] });
    groups.at(-1).items.push(s);
  }
  const option = (s) => <option key={s.id} value={s[valueKey]}>{full ? `${s.shortName} — ${s.name}` : s.shortName}</option>;
  if (groups.length < 2) return schools.map(option);
  return groups.map((g) => <optgroup key={g.kind} label={g.kind}>{g.items.map(option)}</optgroup>);
}
