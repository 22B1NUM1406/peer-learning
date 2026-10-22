import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useSubjects } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import { Avatar, Empty, ErrorText, Loading, Tabs } from '../components/ui.jsx';

// P7: Профайл (FR-03, FR-04, FR-22, FR-24)
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
        <div className="profile-actions">
          {u.isMe
            ? <button className="btn btn-ghost" onClick={() => setEditing(!editing)}>{editing ? 'Хаах' : 'Профайл засах'}</button>
            : <Link to={`/messages/${u.id}`} className="btn btn-primary">Мессеж бичих</Link>}
        </div>
      </section>

      {u.isMe && <p className="muted small pad-x">Оноо: “тустай” үнэлгээ бүрд 2, “тусалсан” хариулт бүрд 10 оноо.</p>}
      {editing && <EditProfile user={u} onSaved={() => { setEditing(false); reload(); }} />}

      <Tabs tabs={[['questions', 'Асуултууд'], ['answers', 'Хариултууд']]} value={tab} onChange={setTab} />
      {tab === 'questions' ? <UserQuestions userId={id} /> : <UserAnswers userId={id} />}
    </>
  );
}

function EditProfile({ user, onSaved }) {
  const subjects = useSubjects();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name, faculty: user.faculty ?? '', year: user.year ?? '' });
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
        <label>Бүрэлдэхүүн сургууль<input value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} maxLength={150} /></label>
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
              <input type="checkbox" checked={helpIds.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name}
            </label>
          ))}
        </div>
      </fieldset>
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
