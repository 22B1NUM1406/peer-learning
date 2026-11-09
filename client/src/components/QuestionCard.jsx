import { Link } from 'react-router-dom';
import { CircleCheck, MessageSquareText, ThumbsUp } from 'lucide-react';
import { AuthorLine } from './ui.jsx';

// P2, P5-ийн асуултын карт.
// Зүүн талд: хариултуудын авсан "тустай" үнэлгээ ба хариултын тоо (тусалсан бол ногоон).
// Картын аль ч хэсэгт дарахад асуулт нээгдэнэ; хичээл, зохиогчийн холбоос тусдаа ажиллана.
export default function QuestionCard({ q, showSubject = true }) {
  const answerState = q.hasAccepted ? 'accepted' : q.answerCount ? 'answered' : '';
  return (
    <li className="card q-card">
      <div className="q-side">
        <span className={`q-stat q-stat-votes ${q.voteCount ? 'has' : ''}`} title="Хариултуудын авсан “тустай” үнэлгээ">
          <ThumbsUp size={14} /><strong>{q.voteCount ?? 0}</strong>
        </span>
        <span className={`q-stat q-stat-answers ${answerState}`} title={q.hasAccepted ? 'Тусалсан хариулттай' : 'Хариултын тоо'}>
          {q.hasAccepted ? <CircleCheck size={14} /> : <MessageSquareText size={14} />}
          <strong>{q.answerCount}</strong> хариулт
        </span>
      </div>
      <div className="q-main">
        {showSubject && (
          <div className="q-top">
            <Link to={`/subjects/${q.subject.id}`} className="tag">{q.subject.name}</Link>
          </div>
        )}
        <Link to={`/questions/${q.id}`} className="q-title">{q.title}</Link>
        {q.excerpt && <p className="q-excerpt">{q.excerpt}</p>}
        <div className="q-meta">
          <AuthorLine author={q.author} createdAt={q.createdAt} />
        </div>
      </div>
    </li>
  );
}
