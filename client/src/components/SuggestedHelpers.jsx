import { Link } from 'react-router-dom';
import { MessageCircle, Users } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from './ui.jsx';

// Санал 1 (Ask → Match): тухайн хичээлд туслах боломжтой оюутнуудыг тэр хичээлд авсан
// "тусалсан" хариултын тоогоор эрэмбэлж санал болгоно. Өгөгдөл: GET /subjects/:id/helpers (FR-04).
export default function SuggestedHelpers({ subjectId, limit = 3, title = 'Энэ хичээлд туслах боломжтой оюутнууд', note }) {
  const { user } = useAuth();
  const { data } = useApi(subjectId ? `/subjects/${subjectId}/helpers` : null);
  const helpers = (data?.helpers ?? []).filter((h) => h.id !== user.id).slice(0, limit);
  if (!subjectId || !data) return null;

  return (
    <section className="helpers-suggest" aria-label={title}>
      <h3><Users size={16} />{title}</h3>
      {note && <p className="muted small no-top">{note}</p>}
      {helpers.length === 0 ? (
        <p className="muted small no-top">Энэ хичээлд туслахаар бүртгүүлсэн оюутан одоогоор алга. Асуулт тань нийтлэгдэхэд бүх оюутанд харагдана.</p>
      ) : (
        <ul>
          {helpers.map((h) => (
            <li key={h.id}>
              <Link to={`/users/${h.id}`} className="author-link"><Avatar name={h.name} size={28} />{h.name}</Link>
              <span className="muted small grow">
                {h.acceptedInSubject > 0 ? `${h.acceptedInSubject} удаа тусалсан` : 'Туслахад бэлэн'} · {h.reputation} оноо
              </span>
              <Link to={`/messages/${h.id}`} className="btn btn-ghost btn-sm"><MessageCircle size={14} />Бичих</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
