import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useDebounced, useSchools, useSubjectsState } from '../lib/hooks.js';
import SubjectPicker from '../components/SubjectPicker.jsx';
import SuggestedHelpers from '../components/SuggestedHelpers.jsx';
import { EyeOff, User } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { ErrorText, Loading } from '../components/ui.jsx';

// P3: Асуулт асуух ба засах (FR-05, FR-06, FR-20, FR-25)
export default function AskPage() {
  const { id } = useParams();           // байвал засах горим
  const editing = !!id;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subjects: loadedSubjects, loaded: subjectsLoaded } = useSubjectsState();
  const [added, setAdded] = useState([]);   // энэ хуудсанд оюутны шинээр нэмсэн хичээл (FR-27)
  const subjects = [...loadedSubjects, ...added.filter((a) => !loadedSubjects.some((s) => s.id === a.id))];
  const schools = useSchools();

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

        <div className="field">
          <span className="field-label">Хичээл</span>
          <SubjectPicker
            subjects={subjects} schools={schools} value={form.subjectId} required loading={!subjectsLoaded}
            onChange={(subjectId) => setForm((f) => ({ ...f, subjectId }))}
            onCreated={(s) => setAdded((list) => [...list, s])}
          />
          {!editing && form.subjectId && (
            <SuggestedHelpers
              subjectId={form.subjectId}
              note="Асуултаа нийтлэхэд эдгээр оюутнуудад мэдэгдэл очно. Яаралтай бол шууд бичиж болно."
            />
          )}
        </div>

        <label>Дэлгэрэнгүй
          <textarea value={form.body} onChange={set('body')} required minLength={10} maxLength={10000} rows={9}
            placeholder="Юуг ойлгохгүй байгаа, юу оролдсоноо бичвэл илүү сайн хариулт авна." />
        </label>

        {!editing && (
          // Санал 2: нэрээ нуух сонголтыг ойлгомжтой болгох — бусдад яаж харагдахыг шууд харуулна (FR-20)
          <fieldset className="anon-choice">
            <legend>Бусад оюутанд хэрхэн харагдах вэ?</legend>
            <label className={`anon-option ${!form.isAnonymous ? 'on' : ''}`}>
              <input type="radio" name="anon" checked={!form.isAnonymous} onChange={() => setForm((f) => ({ ...f, isAnonymous: false }))} />
              <User size={18} />
              <span><strong>Өөрийн нэрээр</strong><small className="muted block">“{user.name}” гэж харагдана</small></span>
            </label>
            <label className={`anon-option ${form.isAnonymous ? 'on' : ''}`}>
              <input type="radio" name="anon" checked={form.isAnonymous} onChange={() => setForm((f) => ({ ...f, isAnonymous: true }))} />
              <EyeOff size={18} />
              <span><strong>Нэрээ нууцлан</strong><small className="muted block">“Нэрээ нуусан оюутан” гэж харагдана</small></span>
            </label>
            <small className="muted">Нэрээ нуусан ч таны асуулт өөрт тань болон дүрэм зөрчсөн эсэхийг шалгах админд л таны нэртэй харагдана. Хариулт, сэтгэгдэл таны нэрээр гарна.</small>
          </fieldset>
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
