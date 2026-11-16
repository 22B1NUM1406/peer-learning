import { Link } from 'react-router-dom';
import { Check, Hourglass, MessageSquareText, ThumbsUp } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { plainText } from './RichText.jsx';
import { timeAgo } from '../lib/format.js';

// P2, P5-ийн асуултын мөр.
// Зүүн багана: хариултуудын авсан "тустай" үнэлгээ ба хариултын төлөв —
// тусалсан хариулттай бол ногоон дүүргэлттэй, хариулттай бол ногоон хүрээтэй, хариултгүй бол саарал.
// Хариултгүй асуултад "Хариулт хүлээж байна" шошго гарч, туслах боломжтой асуултыг ялгана.
export default function QuestionCard({ q, showSubject = true }) {
  const state = q.hasAccepted ? 'accepted' : q.answerCount ? 'answered' : 'none';
  const stateLabel = { accepted: 'тусалсан хариулттай', answered: 'хариулттай', none: 'хариултгүй' }[state];
  return (
    <li className={`q-card state-${state}`}>
      <div className="q-side" aria-hidden="true">
        <span className={`q-stat q-stat-votes ${q.voteCount ? 'has' : ''}`} title="Хариултуудын авсан “тустай” үнэлгээ">
          <strong>{q.voteCount ?? 0}</strong><span>тустай</span>
        </span>
        <span className={`q-stat q-stat-answers ${state}`} title={q.hasAccepted ? 'Тусалсан хариулттай' : 'Хариултын тоо'}>
          {q.hasAccepted && <Check size={12} strokeWidth={3} />}
          <strong>{q.answerCount}</strong><span>хариулт</span>
        </span>
      </div>
      <div className="q-main">
        <Link to={`/questions/${q.id}`} className="q-title">{q.title}</Link>
        {q.excerpt && <p className="q-excerpt">{plainText(q.excerpt)}</p>}
        <div className="q-foot">
          <div className="q-tags">
            {showSubject && <Link to={`/subjects/${q.subject.id}`} className="tag">{q.subject.name}</Link>}
            {state === 'none' && <span className="q-waiting"><Hourglass size={12} />Хариулт хүлээж байна</span>}
            {/* Утсанд зүүн багана нуугдах тул тоог энд харуулна */}
            <span className="q-inline-stats">
              <span className={`q-chip ${state}`}>{q.hasAccepted ? <Check size={11} strokeWidth={3} /> : <MessageSquareText size={11} />}{q.answerCount}</span>
              <span className="q-chip"><ThumbsUp size={11} />{q.voteCount ?? 0}</span>
            </span>
            <span className="sr-only">{q.voteCount ?? 0} тустай үнэлгээ, {q.answerCount} хариулт, {stateLabel}</span>
          </div>
          <span className="q-asker">
            {q.author ? (
              <Link to={`/users/${q.author.id}`} className="author-link">
                <Avatar name={q.author.name} size={18} />
                <span className="author-name">{q.author.name}</span>
                {q.author.reputation != null && <span className="rep" title="Оноо">{q.author.reputation}</span>}
              </Link>
            ) : <span className="anon">Нэрээ нуусан оюутан</span>}
            <time dateTime={q.createdAt}>{timeAgo(q.createdAt)}</time>
          </span>
        </div>
      </div>
    </li>
  );
}
