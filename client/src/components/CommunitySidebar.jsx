import { Link } from 'react-router-dom';
import { Award, TrendingUp, Users } from 'lucide-react';
import { Avatar } from './ui.jsx';

// Нүүр хуудасны баруун самбар (FR-31). Бүх тоо /api/stats/community-ээс ирдэг бодит өгөгдөл;
// өгөгдөл байхгүй бол хоосон гэж шударгаар харуулна.
export default function CommunitySidebar({ stats }) {
  if (!stats) return null;
  const { days, totals, trendingSubjects, activeStudents, topContributors } = stats;
  const maxQ = Math.max(1, ...trendingSubjects.map((s) => s.questionCount));
  const solvedPct = totals?.questions ? Math.round((totals.acceptedQuestions / totals.questions) * 100) : 0;

  return (
    <aside className="community" aria-label="Нийгэмлэгийн идэвх">
      {totals && (
        <section className="rail-card totals-card" aria-label="Системийн нийт тоо">
          <dl className="totals">
            <div><dt>асуулт</dt><dd>{totals.questions}</dd></div>
            <div><dt>хариулт</dt><dd>{totals.answers}</dd></div>
            <div><dt>оюутан</dt><dd>{totals.students}</dd></div>
          </dl>
          <div className="solved">
            <div className="solved-row">
              <span>Тусалсан хариулттай асуулт</span>
              <strong>{totals.acceptedQuestions}<span className="muted">/{totals.questions}</span></strong>
            </div>
            <div className="meter" role="img" aria-label={`Асуултын ${solvedPct}% нь тусалсан хариулттай`}><span style={{ width: `${solvedPct}%` }} /></div>
          </div>
        </section>
      )}

      <section className="rail-card side-card">
        <h3><TrendingUp size={15} />Идэвхтэй хичээлүүд</h3>
        <p className="side-sub">Сүүлийн {days} хоногт асуусан асуултын тоо</p>
        {trendingSubjects.length === 0
          ? <p className="side-empty">Энэ долоо хоногт асуулт алга.</p>
          : (
            <ul className="trend-list">
              {trendingSubjects.map((s) => (
                <li key={s.id}>
                  <Link to={`/subjects/${s.id}`}>
                    <span className="trend-name">{s.name}</span>
                    <span className="trend-num">{s.questionCount}</span>
                    <span className="trend-bar" aria-hidden="true"><span style={{ width: `${(s.questionCount / maxQ) * 100}%` }} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="rail-card side-card">
        <h3><Award size={15} />Хамгийн их тусалсан</h3>
        <p className="side-sub">Нийт оноогоор: “тустай” +2, “тусалсан” +10</p>
        {topContributors.length === 0
          ? <p className="side-empty">Одоогоор оноо авсан оюутан алга.</p>
          : (
            <ol className="side-list ranked">
              {topContributors.map((u, i) => (
                <li key={u.id}>
                  <Link to={`/users/${u.id}`}>
                    <span className={`side-rank r${i + 1}`}>{i + 1}</span>
                    <Avatar name={u.name} size={24} />
                    <span className="side-name">{u.name}</span>
                    <span className="side-num pts">{u.reputation}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
      </section>

      <section className="rail-card side-card">
        <h3><Users size={15} />Идэвхтэй оюутнууд</h3>
        <p className="side-sub">Сүүлийн {days} хоногт хамгийн их хариулсан</p>
        {activeStudents.length === 0
          ? <p className="side-empty">Энэ долоо хоногт хариулт алга.</p>
          : (
            <ul className="side-list">
              {activeStudents.map((u) => (
                <li key={u.id}>
                  <Link to={`/users/${u.id}`}>
                    <Avatar name={u.name} size={24} />
                    <span className="side-name">{u.name}</span>
                    <span className="side-num">{u.answerCount} хариулт</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </aside>
  );
}
