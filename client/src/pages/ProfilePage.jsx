import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { subjectLabel, useApi, useSchools, useSubjects } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import { Avatar, Empty, ErrorText, Loading, Tabs } from '../components/ui.jsx';
import { Award, Lock } from 'lucide-react';

// P7: Профайл (FR-03, FR-04, FR-22, FR-24) + түвшин, тэмдэг (санал 4), хувийн статистик ба хадгалсан (санал 7)
export default function ProfilePage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/users/${id}`);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('questions');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorText error={error} />;
  const u = data.user;

  return (
    <>
      <section className="card profile-head">
        <Avatar name={u.name} size={64} />
        <div className="grow">
          <h1>{u.name}</h1>
          <div className="muted">{[u.faculty, u.year && `${u.year}-р курс`].filter(Boolean).join(' · ') || 'Мэдээлэл оруулаагүй'}</div>
          <div className="chips">
            {u.helpSubjects.map((s) => <Link key={s.id} to={`/subjects/${s.id}?tab=helpers`} className="tag">{s.name}</Link>)}
            {u.helpSubjects.length === 0 && <span className="muted small">Туслах хичээл сонгоогүй</span>}
          </div>
        </div>
        <div className="profile-stats">
          <div><strong>{u.reputation}</strong><span>оноо</span></div>
          <div><strong>{u.acceptedCount}</strong><span>тусалсан</span></div>
          <div><strong>{u.answerCount}</strong><span>хариулт</span></div>
          <div><strong>{u.questionCount}</strong><span>асуулт</span></div>
        </div>
        <LevelBar level={u.level} reputation={u.reputation} />
        <div className="profile-actions">
          {u.isMe
            ? <button className="btn btn-ghost" onClick={() => setEditing(!editing)}>{editing ? 'Хаах' : 'Профайл засах'}</button>
            : <Link to={`/messages/${u.id}`} className="btn btn-primary">Мессеж бичих</Link>}
        </div>
      </section>

      {u.isMe && <p className="muted small pad-x">Оноо: “тустай” үнэлгээ бүрд 2, “тусалсан” хариулт бүрд 10 оноо. Нэг оюутнаас өдөрт 3 удаагаас илүү оноо авахгүй.</p>}
      {editing && <EditProfile user={u} onSaved={() => { setEditing(false); reload(); }} />}

      <div className="profile-grid">
        <section className="card pad">
          <h2 className="section-title no-top">Суралцах идэвх</h2>
          <div className="mini-stats">
            <div><strong>{u.helpedStudents}</strong><span>оюутанд тусалсан</span></div>
            <div><strong>{u.votesReceived}</strong><span>“тустай” үнэлгээ авсан</span></div>
            <div><strong>{u.resourceCount}</strong><span>материал хуваалцсан</span></div>
          </div>
          {u.subjectActivity.length > 0 ? (
            <table className="table activity-table">
              <thead><tr><th>Хичээл</th><th>Асуусан</th><th>Хариулсан</th><th>Тусалсан</th></tr></thead>
              <tbody>
                {u.subjectActivity.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/subjects/${s.id}`}>{s.name}</Link></td>
                    <td>{s.questions}</td><td>{s.answers}</td><td>{s.accepted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted small">Одоогоор идэвх алга.</p>}
        </section>
        <section className="card pad">
          <h2 className="section-title no-top">Тэмдэг</h2>
          <ul className="badge-list">
            {u.badges.map((b) => (
              <li key={b.key} className={b.earned ? 'earned' : ''} title={b.description}>
                {b.earned ? <Award size={18} /> : <Lock size={16} />}
                <span><strong>{b.name}</strong><small className="muted block">{b.description}</small></span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Tabs
        tabs={[['questions', 'Асуултууд'], ['answers', 'Хариултууд'], ...(u.isMe ? [['saved', 'Хадгалсан']] : [])]}
        value={tab} onChange={setTab}
      />
      {tab === 'questions' && <UserQuestions userId={id} />}
      {tab === 'answers' && <UserAnswers userId={id} />}
      {tab === 'saved' && u.isMe && <SavedQuestions />}
    </>
  );
}

function EditProfile({ user, onSaved }) {
  const subjects = useSubjects();
  const schools = useSchools();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name, faculty: user.faculty ?? '', year: user.year ?? '', notifyNewQuestions: user.notifyNewQuestions ?? true });
  const [helpIds, setHelpIds] = useState(user.helpSubjects.map((s) => s.id));
  const [error, setError] = useState(null);

  const toggle = (sid) => setHelpIds((ids) => (ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid]));

  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/users/me', { method: 'PATCH', body: { ...form, year: form.year === '' ? null : Number(form.year) } });
      await api('/users/me/subjects', { method: 'PUT', body: { subjectIds: helpIds } });
      refresh();
      onSaved();
    } catch (err) { setError(err); }
  };

  return (
    <form onSubmit={save} className="card form pad-lg">
      <div className="grid-2">
        <label>Нэр<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={100} /></label>
        <label>Бүрэлдэхүүн сургууль
          {/* FR-26: жагсаалтаас сонгоно. Өмнө нь гараар бичсэн утга жагсаалтад байхгүй бол хэвээр харагдана. */}
          <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })}>
            <option value="">—</option>
            {form.faculty && !schools.some((s) => s.shortName === form.faculty) && <option value={form.faculty}>{form.faculty}</option>}
            {schools.map((s) => <option key={s.id} value={s.shortName}>{s.shortName} — {s.name}</option>)}
          </select>
        </label>
        <label>Курс
          <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}-р курс</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Туслах боломжтой хичээлүүд</legend>
        <div className="check-grid">
          {subjects.map((s) => (
            <label key={s.id} className="check">
              <input type="checkbox" checked={helpIds.includes(s.id)} onChange={() => toggle(s.id)} /> {subjectLabel(s)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={form.notifyNewQuestions} onChange={(e) => setForm({ ...form, notifyNewQuestions: e.target.checked })} />
        <span>
          <strong>Туслах хичээлд минь шинэ асуулт ирэхэд мэдэгдэх</strong>
          <small className="muted block">Зөвхөн дээр сонгосон хичээлүүдийн асуулт. Унтраавал шинэ асуултын мэдэгдэл ирэхгүй.</small>
        </span>
      </label>
      <ErrorText error={error} />
      <div className="row-end"><button className="btn btn-primary">Хадгалах</button></div>
    </form>
  );
}

function UserQuestions({ userId }) {
  const { data, loading } = useApi(`/users/${userId}/questions`);
  if (loading) return <Loading />;
  if (!data?.questions.length) return <Empty>Асуулт алга.</Empty>;
  return (
    <ul className="simple-list card">
      {data.questions.map((q) => (
        <li key={q.id}>
          <Link to={`/questions/${q.id}`}>{q.title}</Link>
          {q.isAnonymous && <span className="tag tag-muted">нэрээ нуусан</span>}
          <span className="muted small"> · {q.subject.name} · {q.answerCount} хариулт{q.hasAccepted ? ' ✓' : ''} · {timeAgo(q.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function UserAnswers({ userId }) {
  const { data, loading } = useApi(`/users/${userId}/answers`);
  if (loading) return <Loading />;
  if (!data?.answers.length) return <Empty>Хариулт алга.</Empty>;
  return (
    <ul className="simple-list card">
      {data.answers.map((a) => (
        <li key={a.id}>
          {a.isAccepted && <span className="tag tag-ok">✓ тусалсан</span>}
          <Link to={`/questions/${a.questionId}`}>{a.questionTitle}</Link>
          <span className="muted small"> · ▲{a.voteCount} · {timeAgo(a.createdAt)}</span>
          <p className="muted small clamp">{a.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

// FR-30: дараагийн түвшин хүртэлх явц
function LevelBar({ level, reputation }) {
  const prev = { newcomer: 0, helper: 10, active: 50, expert: 200 }[level.key] ?? 0;
  const pct = level.nextAt ? Math.min(100, Math.round(((reputation - prev) / (level.nextAt - prev)) * 100)) : 100;
  return (
    <div className="level-bar">
      <div className="row-between small">
        <span className="tag tag-level"><Award size={12} />{level.name}</span>
        <span className="muted">{level.nextAt ? `“${level.nextName}” хүртэл ${level.nextAt - reputation} оноо` : 'Хамгийн дээд түвшин'}</span>
      </div>
      <div className="level-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Дараагийн түвшин хүртэлх явц">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// FR-34: хадгалсан асуултууд (зөвхөн өөрт)
function SavedQuestions() {
  const { data, loading } = useApi('/users/me/bookmarks');
  if (loading) return <Loading />;
  if (!data?.questions.length) return <Empty>Хадгалсан асуулт алга. Асуултын хуудсанд “Хадгалах”-ыг дарж хадгална.</Empty>;
  return (
    <ul className="simple-list card">
      {data.questions.map((q) => (
        <li key={q.id}>
          <Link to={`/questions/${q.id}`}>{q.title}</Link>
          <span className="muted small"> · {q.subject.name} · {q.answerCount} хариулт{q.hasAccepted ? ' · тусалсан хариулттай' : ''} · {timeAgo(q.savedAt)} хадгалсан</span>
        </li>
      ))}
    </ul>
  );
}
