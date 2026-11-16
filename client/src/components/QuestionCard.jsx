import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AuthorLine } from './ui.jsx';

// P2, P5-ийн асуултын мөр.
// Зүүн талд: хариултуудын авсан "тустай" үнэлгээ ба хариултын тоо. Тусалсан хариулттай бол
// хариултын тоо ногоон дүүргэлттэй: жагсаалтаас шийдэгдсэн асуултыг шууд ялгана.
export default function QuestionCard({ q, showSubject = true }) {
  const answerState = q.hasAccepted ? 'accepted' : q.answerCount ? 'answered' : 'none';
  return (
    <li className="q-card">
      <div className="q-side" aria-hidden="true">
        <span className={`q-stat q-stat-votes ${q.voteCount ? 'has' : ''}`} title="Хариултуудын авсан “тустай” үнэлгээ">
          <strong>{q.voteCount ?? 0}</strong><span>тустай</span>
        </span>
        <span className={`q-stat q-stat-answers ${answerState}`} title={q.hasAccepted ? 'Тусалсан хариулттай' : 'Хариултын тоо'}>
          {q.hasAccepted && <Check size={12} strokeWidth={3} />}
          <strong>{q.answerCount}</strong><span>хариулт</span>
        </span>
      </div>
      <div className="q-main">
        <Link to={`/questions/${q.id}`} className="q-title">{q.title}</Link>
        {q.excerpt && <p className="q-excerpt">{q.excerpt}</p>}
        <div className="q-meta">
          {showSubject && <Link to={`/subjects/${q.subject.id}`} className="tag">{q.subject.name}</Link>}
          <span className="sr-only">{q.voteCount ?? 0} тустай үнэлгээ, {q.answerCount} хариулт{q.hasAccepted ? ', тусалсан хариулттай' : ''}</span>
          <AuthorLine author={q.author} createdAt={q.createdAt} compact />
        </div>
      </div>
    </li>
  );
}
