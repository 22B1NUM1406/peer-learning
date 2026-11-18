import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { subjectLabel, useApi, useSchools, useSubjects } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import { Avatar, Empty, ErrorText, Loading, Tabs, SchoolOptions } from '../components/ui.jsx';
import { Award, Bookmark, Lock, MessageCircle, MessageSquareText, MessagesSquare, Library, Pencil, Plus, X } from 'lucide-react';
import { useFeedback } from '../lib/feedback.jsx';
import { notifyProfileChanged } from '../components/Layout.jsx';
import { CatalogItem, NewSubject, adoptCatalog, useCatalogSearch } from '../components/SubjectPicker.jsx';

// P7: Профайл (FR-03, FR-04, FR-22, FR-24) + түвшин, тэмдэг (санал 4), хувийн статистик ба хадгалсан (санал 7)
export default function ProfilePage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/users/${id}`);
  const [params, setParams] = useSearchParams();
  const editing = params.get('edit') === '1';
  const setEditing = (on) => setParams(on ? { edit: '1' } : {}, { replace: true });
  const [tab, setTab] = useState('questions');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorText error={error} onRetry={reload} />;
  const u = data.user;

  return (
    <>
      <section className="profile-head">
        <Avatar name={u.name} size={64} />
        <div className="grow profile-id">
          <h1>{u.name}</h1>
          <div className="profile-sub">{[u.faculty, u.year && `${u.year}-р курс`].filter(Boolean).join(', ') || 'Сургууль, курс оруулаагүй'}</div>
          <div className="chips">
            {u.helpSubjects.length > 0 && <span className="chips-label">Тусалдаг:</span>}
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
            ? <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>{editing ? <><X size={15} />Хаах</> : <><Pencil size={15} />Профайл засах</>}</button>
            : <Link to={`/messages/${u.id}`} className="btn btn-primary"><MessageCircle size={15} />Мессеж бичих</Link>}
        </div>
      </section>

      {u.isMe && editing && <EditProfile user={u} onSaved={() => { setEditing(false); reload(); }} />}
      {u.isMe && !editing && <p className="points-note">Оноо: “тустай” үнэлгээ бүрд 2, “тусалсан” хариулт бүрд 10. Нэг оюутнаас өдөрт 3 удаагаас илүү оноо авахгүй.</p>}

      <div className="profile-grid">
        <section className="panel">
          <h2 className="panel-title">Суралцах идэвх</h2>
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
          ) : <p className="muted small">Одоогоор идэвх алга. Асуулт асуух, хариулах бүрд хичээлээр энд тоологдоно.</p>}
        </section>
        <section className="panel">
          <h2 className="panel-title">Тэмдэг <span className="muted small">{u.badges.filter((b) => b.earned).length}/{u.badges.length}</span></h2>
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
        tabs={[['questions', 'Асуултууд', MessagesSquare, u.questionCount], ['answers', 'Хариултууд', MessageSquareText, u.answerCount], ...(u.isMe ? [['saved', 'Хадгалсан', Bookmark]] : [])]}
        value={tab} onChange={setTab}
      />
      {tab === 'questions' && <UserQuestions userId={id} />}
      {tab === 'answers' && <UserAnswers userId={id} />}
      {tab === 'saved' && u.isMe && <SavedQuestions />}
    </>
  );
}

function EditProfile({ user, onSaved }) {
  const loadedSubjects = useSubjects();
  const [added, setAdded] = useState([]);   // энд шинээр нэмсэн хичээл (FR-27)
  const subjects = [...loadedSubjects, ...added.filter((a) => !loadedSubjects.some((s) => s.id === a.id))];
  const schools = useSchools();
  const [adding, setAdding] = useState(false);
  const { refresh } = useAuth();
  const { toast } = useFeedback();
  const [form, setForm] = useState({ name: user.name, faculty: user.faculty ?? '', year: user.year ?? '', notifyNewQuestions: user.notifyNewQuestions ?? true });
  const [helpIds, setHelpIds] = useState(user.helpSubjects.map((s) => s.id));
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('');
  const [initialIds] = useState(() => user.helpSubjects.map((s) => s.id));   // дарах бүрд мөр үсрэхгүйн тулд
  // Сонгосон хичээлүүд эхэнд; хайлтаар шүүнэ (хичээл олон болоход жагсаалт урт болдог)
  const f = filter.trim().toLowerCase();
  const shown = subjects
    .filter((s) => !f || s.name.toLowerCase().includes(f) || (s.code ?? '').toLowerCase().includes(f))
    .sort((a, b) => Number(initialIds.includes(b.id)) - Number(initialIds.includes(a.id)));
  const { catalog, loading: catalogLoading } = useCatalogSearch(filter);
  const [adoptError, setAdoptError] = useState(null);
  const pickCatalog = async (course) => {
    setAdoptError(null);
    try {
      const subject = await adoptCatalog(course.id);
      setAdded((list) => [...list, subject]);
      choose(subject);
    } catch (err) { setAdoptError(err); }
  };
  const toggle = (sid) => setHelpIds((ids) => (ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid]));
  // Нэмсэн эсвэл ижил төстэйгээс сонгосон хичээлийг шууд туслах хичээлд оруулж, жагсаалтад харуулна
  const choose = (subject) => {
    setHelpIds((ids) => (ids.includes(subject.id) ? ids : [...ids, subject.id]));
    setFilter(subject.name);
    setAdding(false);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/users/me', { method: 'PATCH', body: { ...form, year: form.year === '' ? null : Number(form.year) } });
      await api('/users/me/subjects', { method: 'PUT', body: { subjectIds: helpIds } });
      refresh();
      notifyProfileChanged();
      toast('Профайл хадгалагдлаа');
      onSaved();
    } catch (err) { setError(err); }
  };

  return (
    <form onSubmit={save} className="form panel edit-profile">
      <h2 className="panel-title">Профайл засах</h2>
      <div className="grid-2">
        <label>Нэр<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={100} /></label>
        <label>Бүрэлдэхүүн сургууль
          {/* FR-26: жагсаалтаас сонгоно. Өмнө нь гараар бичсэн утга жагсаалтад байхгүй бол хэвээр харагдана. */}
          <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })}>
            <option value="">—</option>
            {form.faculty && !schools.some((s) => s.shortName === form.faculty) && <option value={form.faculty}>{form.faculty}</option>}
            <SchoolOptions schools={schools} valueKey="shortName" full />
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
        <legend>Туслах боломжтой хичээлүүд <span className="optional">{helpIds.length} сонгосон</span></legend>
        <input type="search" className="check-filter" placeholder="Хичээл хайх" aria-label="Туслах хичээл хайх"
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="check-grid">
          {shown.map((s) => (
            <label key={s.id} className={`check ${helpIds.includes(s.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={helpIds.includes(s.id)} onChange={() => toggle(s.id)} /> {subjectLabel(s)}
            </label>
          ))}
          {shown.length === 0 && !catalog.length && (
            <span className="muted small">{catalogLoading ? 'Хайж байна…' : 'Тохирох хичээл алга'}</span>
          )}
        </div>
        {catalog.length > 0 && (
          <div className="catalog-suggest">
            <span className="picker-group"><Library size={14} />МУИС-ийн хичээлийн каталогоос нэмэх</span>
            <ul className="picker-list">
              {catalog.map((c) => <li key={c.id}><CatalogItem course={c} onPick={pickCatalog} /></li>)}
            </ul>
          </div>
        )}
        <ErrorText error={adoptError} />
        {adding ? (
          <NewSubject
            schools={schools}
            initial={{ name: filter.trim(), schoolId: '' }}
            onCancel={() => setAdding(false)}
            onPick={choose}
            onCreated={(s) => { setAdded((list) => [...list, s]); choose(s); toast(`“${s.name}” хичээл нэмэгдэж, туслах хичээлд сонгогдлоо`); }}
          />
        ) : (
          <button type="button" className="link-btn picker-add" onClick={() => setAdding(true)}>
            <Plus size={15} />{filter.trim() && shown.length === 0 && !catalog.length ? `“${filter.trim()}” хичээлийг гараар нэмэх` : 'Каталогт байхгүй бол шинэ хичээл нэмэх'}
          </button>
        )}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={form.notifyNewQuestions} onChange={(e) => setForm({ ...form, notifyNewQuestions: e.target.checked })} />
        <span>
          <strong>Туслах хичээлд минь шинэ асуулт ирэхэд мэдэгдэх</strong>
          <small className="muted block">Зөвхөн дээр сонгосон хичээлүүдийн асуулт. Унтраавал шинэ асуултын мэдэгдэл ирэхгүй.</small>
        </span>
      </label>
      <ErrorText error={error} />
      <div className="row-end form-foot">
        <button type="button" className="btn btn-secondary" onClick={onSaved}>Болих</button>
        <button className="btn btn-primary">Хадгалах</button>
      </div>
    </form>
  );
}

function UserQuestions({ userId }) {
  const { data, loading } = useApi(`/users/${userId}/questions`);
  if (loading) return <Loading />;
  if (!data?.questions.length) return <Empty title="Асуулт алга" />;
  return (
    <ul className="simple-list">
      {data.questions.map((q) => (
        <li key={q.id}>
          <Link to={`/questions/${q.id}`}>{q.title}</Link>
          {q.isAnonymous && <span className="tag tag-muted">нэрээ нуусан</span>}
          <span className="list-meta"><span>{q.subject.name}</span><span className={`mini-count ${q.hasAccepted ? 'accepted' : ''}`}>{q.answerCount} хариулт</span><span>{timeAgo(q.createdAt)}</span></span>
        </li>
      ))}
    </ul>
  );
}

function UserAnswers({ userId }) {
  const { data, loading } = useApi(`/users/${userId}/answers`);
  if (loading) return <Loading />;
  if (!data?.answers.length) return <Empty title="Хариулт алга" />;
  return (
    <ul className="simple-list">
      {data.answers.map((a) => (
        <li key={a.id}>
          <Link to={`/questions/${a.questionId}`}>{a.questionTitle}</Link>
          <span className="list-meta">
            {a.isAccepted && <span className="mini-count accepted">тусалсан</span>}
            <span>{a.voteCount} тустай</span><span>{timeAgo(a.createdAt)}</span>
          </span>
          <p className="list-excerpt">{a.excerpt}</p>
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
  if (!data?.questions.length) return <Empty icon={Bookmark} title="Хадгалсан асуулт алга">Асуултын хуудсанд “Хадгалах”-ыг дарвал энд гарч, шинэ хариулт ирэхэд мэдэгдэнэ.</Empty>;
  return (
    <ul className="simple-list">
      {data.questions.map((q) => (
        <li key={q.id}>
          <Link to={`/questions/${q.id}`}>{q.title}</Link>
          <span className="list-meta"><span>{q.subject.name}</span><span className={`mini-count ${q.hasAccepted ? 'accepted' : ''}`}>{q.answerCount} хариулт</span><span>{timeAgo(q.savedAt)} хадгалсан</span></span>
        </li>
      ))}
    </ul>
  );
}
