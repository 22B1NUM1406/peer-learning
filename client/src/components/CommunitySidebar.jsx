import { Link } from 'react-router-dom';
import { Award, TrendingUp, Users } from 'lucide-react';
import { Avatar } from './ui.jsx';

// Нүүр хуудасны баруун самбар (FR-31). Бүх тоо /api/stats/community-ээс ирдэг бодит өгөгдөл;
// өгөгдөл байхгүй бол хоосон гэж шударгаар харуулна.
export default function CommunitySidebar({ stats }) {
  if (!stats) return null;
  const { days, totals, trendingSubjects, activeStudents, topContributors } = stats;

  return (
    <aside className="community" aria-label="Нийгэмлэгийн идэвх">
      {totals && (
        <dl className="totals" aria-label="Системийн нийт тоо">
          <div><dt>асуулт</dt><dd>{totals.questions}</dd></div>
          <div><dt>хариулт</dt><dd>{totals.answers}</dd></div>
          <div><dt>шийдэгдсэн</dt><dd>{totals.acceptedQuestions}</dd></div>
          <div><dt>оюутан</dt><dd>{totals.students}</dd></div>
        </dl>
      )}

      <section className="rail-card side-card">
        <h3><TrendingUp size={16} />Идэвхтэй хичээлүүд</h3>
        <p className="side-sub">Сүүлийн {days} хоногт хамгийн их асуулт асуугдсан</p>
        {trendingSubjects.length === 0
          ? <p className="side-empty">Энэ долоо хоногт асуулт алга.</p>
          : (
            <ul className="side-list">
              {trendingSubjects.map((s) => (
                <li key={s.id}>
                  <Link to={`/subjects/${s.id}`}>
                    <span className="subj-dot" aria-hidden="true" />
                    <span className="side-name">{s.name}</span>
                    <span className="side-num">{s.questionCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="rail-card side-card">
        <h3><Award size={16} />Хамгийн их тусалсан</h3>
        <p className="side-sub">Нийт оноогоор: “тустай” +2, “тусалсан” +10</p>
        {topContributors.length === 0
          ? <p className="side-empty">Одоогоор оноо авсан оюутан алга.</p>
          : (
            <ol className="side-list ranked">
              {topContributors.map((u, i) => (
                <li key={u.id}>
                  <Link to={`/users/${u.id}`}>
                    <span className={`side-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                    <Avatar name={u.name} size={24} />
                    <span className="side-name">{u.name}</span>
                    <span className="side-num">{u.reputation}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
      </section>

      <section className="rail-card side-card">
        <h3><Users size={16} />Идэвхтэй оюутнууд</h3>
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
