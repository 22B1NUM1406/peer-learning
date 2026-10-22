import { Link } from 'react-router-dom';
import { AuthorLine } from './ui.jsx';

// P2, P5-ийн асуултын карт
export default function QuestionCard({ q, showSubject = true }) {
  return (
    <li className="card q-card">
      <div className={`q-stats ${q.hasAccepted ? 'accepted' : q.answerCount ? 'answered' : ''}`}>
        <strong>{q.answerCount}</strong>
        <span>хариулт</span>
        {q.hasAccepted && <span className="check" title="Тусалсан хариулттай">✓</span>}
      </div>
      <div className="q-main">
        <Link to={`/questions/${q.id}`} className="q-title">{q.title}</Link>
        {q.excerpt && <p className="q-excerpt">{q.excerpt}</p>}
        <div className="q-meta">
          {showSubject && <Link to={`/subjects/${q.subject.id}`} className="tag">{q.subject.name}</Link>}
          <AuthorLine author={q.author} createdAt={q.createdAt} />
        </div>
      </div>
    </li>
  );
}
