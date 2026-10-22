import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useDebounced, useSubjects } from '../lib/hooks.js';
import { ErrorText, Loading } from '../components/ui.jsx';

// P3: Асуулт асуух ба засах (FR-05, FR-06, FR-20, FR-25)
export default function AskPage() {
  const { id } = useParams();           // байвал засах горим
  const editing = !!id;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const subjects = useSubjects();

  const [form, setForm] = useState({ title: '', body: '', subjectId: search.get('subject') ?? '', isAnonymous: false });
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState([]);
  const title = useDebounced(form.title.trim(), 300);

  useEffect(() => {
    if (!editing) return;
    api(`/questions/${id}`).then(({ question: q }) => {
      setForm({ title: q.title, body: q.body, subjectId: String(q.subject.id), isAnonymous: q.isAnonymous });
      setLoaded(true);
    }).catch(setError);
  }, [id, editing]);

  // FR-25: гарчиг бичих үед ижил асуултуудыг санал болгоно
  useEffect(() => {
    if (editing || title.length < 5) { setSimilar([]); return; }
    let cancelled = false;
    api('/questions/similar', { params: { title } })
      .then((d) => { if (!cancelled) setSimilar(d.questions); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [title, editing]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api(`/questions/${id}`, { method: 'PATCH', body: { title: form.title, body: form.body, subjectId: Number(form.subjectId) } });
        navigate(`/questions/${id}`);
      } else {
        const d = await api('/questions', { method: 'POST', body: { ...form, subjectId: Number(form.subjectId) } });
        navigate(`/questions/${d.id}`);
      }
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (!loaded) return error ? <ErrorText error={error} /> : <Loading />;

  return (
    <div className="narrow">
      <h1>{editing ? 'Асуулт засах' : 'Асуулт асуух'}</h1>
      <form onSubmit={onSubmit} className="form card pad-lg">
        <label>Гарчиг
          <input value={form.title} onChange={set('title')} required minLength={5} maxLength={200}
            placeholder="Жишээ нь: Холбоост жагсаалтыг хэрхэн эргүүлэх вэ?" />
        </label>

        {similar.length > 0 && (
          <div className="similar" aria-live="polite">
            <strong>Ижил төстэй асуулт байна. Эхлээд эдгээрийг шалгаарай:</strong>
            <ul>
              {similar.map((s) => (
                <li key={s.id}>
                  <Link to={`/questions/${s.id}`} target="_blank">{s.title}</Link>
                  <span className="muted small"> · {s.subjectName}{s.hasAccepted ? ' · ✓ тусалсан хариулттай' : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label>Хичээл
          <select value={form.subjectId} onChange={set('subjectId')} required>
            <option value="" disabled>Хичээл сонгоно уу</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <label>Дэлгэрэнгүй
          <textarea value={form.body} onChange={set('body')} required minLength={10} maxLength={10000} rows={9}
            placeholder="Юуг ойлгохгүй байгаа, юу оролдсоноо бичвэл илүү сайн хариулт авна." />
        </label>

        {!editing && (
          <label className="check">
            <input type="checkbox" checked={form.isAnonymous} onChange={set('isAnonymous')} />
            <span>
              <strong>Нэрээ нуух</strong>
              <small className="muted block">Бусад оюутанд таны нэр харагдахгүй. Админ дүрэм зөрчсөн эсэхийг шалгахад л харна.</small>
            </span>
          </label>
        )}

        <ErrorText error={error} />
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Болих</button>
          <button className="btn btn-primary" disabled={busy}>{editing ? 'Хадгалах' : 'Нийтлэх'}</button>
        </div>
      </form>
    </div>
  );
}
