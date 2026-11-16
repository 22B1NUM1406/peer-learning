import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HandHelping } from 'lucide-react';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

// Нүүрний баруун самбар: хэрэглэгчийн туслах хичээлүүдэд (FR-04) хариулт хүлээж буй асуултууд.
// Одоо байгаа GET /questions?subject=&sort=unanswered-ийг хичээл бүрээр дуудна (гурав хүртэл хичээл).
export default function HelpQueue({ subjects, userId }) {
  const [items, setItems] = useState(null);
  const ids = subjects.slice(0, 3).map((s) => s.id).join(',');

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    Promise.all(ids.split(',').map((id) => api('/questions', { params: { subject: id, sort: 'unanswered' } }).catch(() => ({ questions: [] }))))
      .then((lists) => {
        if (cancelled) return;
        const all = lists.flatMap((d) => d.questions)
          .filter((q) => q.author?.id !== userId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setItems(all.slice(0, 4));
      });
    return () => { cancelled = true; };
  }, [ids, userId]);

  if (!ids || !items) return null;
  return (
    <section className="rail-card help-queue">
      <h3><HandHelping size={15} />Таны туслах боломжтой асуултууд</h3>
      <p className="side-sub">Таны мэддэг хичээлд хариулт хүлээж байна</p>
      {items.length === 0 ? (
        <p className="side-empty">Одоогоор хариулт хүлээж буй асуулт алга.</p>
      ) : (
        <ul>
          {items.map((q) => (
            <li key={q.id}>
              <Link to={`/questions/${q.id}`}>{q.title}</Link>
              <span className="related-meta"><span className="muted">{q.subject.name}</span><span className="muted">{timeAgo(q.createdAt)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
