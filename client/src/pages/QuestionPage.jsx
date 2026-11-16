import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, BookOpen, Bookmark, BookmarkCheck, Check, CircleCheck, MessageSquareText, Pencil, Sparkles, ThumbsUp, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useFeedback } from '../lib/feedback.jsx';
import { AuthorLine, Body, ErrorText, Loading } from '../components/ui.jsx';
import ReportButton from '../components/ReportButton.jsx';
import SuggestedHelpers from '../components/SuggestedHelpers.jsx';

// P4: Асуултын дэлгэрэнгүй (FR-08–FR-12, FR-14, FR-15)
export default function QuestionPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/questions/${id}`);
  const { refresh } = useAuth();
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();

  if (loading && !data) return <div className="narrow"><Loading rows={4} /></div>;
  if (error) return <div className="narrow"><ErrorText error={error} onRetry={reload} /></div>;
  const q = data.question;

  // Үйлдэл бүрийн дараа серверээс дахин уншина: оноо, эрэмбэ үргэлж зөв харагдана.
  // Амжилттай бол богино мэдэгдэл, алдаа бол шалтгааныг нь харуулна.
  const run = async (fn, done) => {
    try {
      await fn();
      await reload();
      refresh(); // хажуугийн цэсний оноо
      if (done) toast(done);
      return true;
    } catch (err) {
      toast(err.message, { tone: 'error' });
      return false;
    }
  };

  const deleteQuestion = async () => {
    const ok = await confirm({ title: 'Асуултыг устгах уу?', body: 'Устгасан асуултыг сэргээх боломжгүй.', confirmLabel: 'Устгах', danger: true });
    if (!ok) return;
    try {
      await api(`/questions/${q.id}`, { method: 'DELETE' });
      toast('Асуулт устгагдлаа');
      navigate('/');
    } catch (err) { toast(err.message, { tone: 'error' }); }
  };

  return (
    <div className="with-rail question-layout">
    <article className="question-page main-pane">
      <nav className="crumbs" aria-label="Байршил">
        <Link to="/" className="back-link"><ArrowLeft size={15} />Асуултууд</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/subjects/${q.subject.id}`}>{q.subject.name}</Link>
      </nav>
      <section className="question-card">
        <h1>{q.title}</h1>
        <div className="q-meta"><AuthorLine author={q.author} createdAt={q.createdAt} anonymous={q.isAnonymous} /></div>
        {q.isHidden && <p className="warn">Энэ асуулт нуугдсан. Зөвхөн админд харагдаж байна.</p>}
        <Body text={q.body} />

        <div className="actions">
          {/* FR-34: хадгалах — дараа унших, шинэ хариулт ирэхэд мэдэгдэл авах */}
          <button
            className={`link-btn ${q.bookmarkedByMe ? '' : 'muted'}`} aria-pressed={q.bookmarkedByMe}
            onClick={() => run(() => api(`/questions/${q.id}/bookmark`, { method: q.bookmarkedByMe ? 'DELETE' : 'PUT' }),
              q.bookmarkedByMe ? 'Хадгалснаас хаслаа' : 'Хадгаллаа. Шинэ хариулт ирэхэд мэдэгдэнэ')}
            title="Хадгалсан асуултад шинэ хариулт ирэхэд мэдэгдэл авна"
          >
            {q.bookmarkedByMe ? <><BookmarkCheck size={14} />Хадгалсан</> : <><Bookmark size={14} />Хадгалах</>}
          </button>
          {q.isMine && <Link to={`/questions/${q.id}/edit`} className="link-btn"><Pencil size={14} />Засах</Link>}
          {q.canDelete && <button className="link-btn danger" onClick={deleteQuestion}><Trash2 size={14} />Устгах</button>}
          {!q.isMine && <ReportButton targetType="question" targetId={q.id} />}
        </div>

        <Comments
          comments={q.comments}
          postUrl={`/questions/${q.id}/comments`}
          onChange={(msg) => run(async () => {}, msg)}
        />
      </section>

      <h2 className="answers-title"><MessageSquareText size={17} />{q.answers.length} хариулт</h2>
      {q.answers.length === 0 && (
        <p className="answers-empty">{q.isMine ? 'Хариулт хараахан ирээгүй байна.' : 'Хариулт алга. Анхны хариултыг та бичээрэй.'}</p>
      )}
      {q.isMine && q.answers.length === 0 && (
        <SuggestedHelpers
          subjectId={q.subject.id}
          title="Хариулт хүлээж байна уу? Эдгээр оюутнуудад шууд бичээрэй"
          note="Тэдэнд таны асуултын тухай мэдэгдэл очсон."
        />
      )}
      <ul className="answers">
        {q.answers.map((a) => (
          <Answer key={a.id} a={a} question={q} run={run} confirm={confirm} />
        ))}
      </ul>

      <AnswerForm questionId={q.id} onDone={() => run(async () => {}, 'Хариулт нийтлэгдлээ')} />
    </article>

    <div className="rail">
      <section className="rail-card subject-mini">
        <span className="subject-icon sm"><BookOpen size={15} /></span>
        <div className="grow">
          <Link to={`/subjects/${q.subject.id}`} className="strong">{q.subject.name}</Link>
          <div className="muted small">Энэ хичээлийн асуулт, материал, туслагчид</div>
        </div>
      </section>
      <RelatedQuestions questionId={q.id} />
    </div>
    </div>
  );
}

function Answer({ a, question, run, confirm }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(a.body);

  const toggleVote = () => run(() => api(`/answers/${a.id}/vote`, { method: a.votedByMe ? 'DELETE' : 'POST' }));
  const toggleAccept = () => run(() => api(`/questions/${question.id}/accepted`, {
    method: 'PUT', body: { answerId: a.isAccepted ? null : a.id },
  }), a.isAccepted ? '“Тусалсан” тэмдэглэгээг болиулав' : '“Тусалсан” гэж тэмдэглэлээ');
  const save = () => run(async () => {
    await api(`/answers/${a.id}`, { method: 'PATCH', body: { body } });
    setEditing(false);
  }, 'Хариулт хадгалагдлаа');
  const remove = async () => {
    const ok = await confirm({ title: 'Хариултыг устгах уу?', body: 'Энэ хариултаар авсан оноо хасагдана.', confirmLabel: 'Устгах', danger: true });
    if (ok) run(() => api(`/answers/${a.id}`, { method: 'DELETE' }), 'Хариулт устгагдлаа');
  };

  return (
    <li className={`answer ${a.isAccepted ? 'is-accepted' : ''}`}>
      <div className="vote-col">
        <button
          className={`vote-btn ${a.votedByMe ? 'on' : ''}`}
          onClick={toggleVote}
          disabled={a.isMine}
          title={a.isMine ? 'Өөрийн хариултыг үнэлэх боломжгүй' : 'Тустай'}
          aria-pressed={a.votedByMe}
        >
          <ThumbsUp size={15} /><span className="vote-count">{a.voteCount}</span><span className="vote-label">Тустай</span>
        </button>
        {question.isMine && (
          <button className={`accept-btn ${a.isAccepted ? 'on' : ''}`} onClick={toggleAccept}
            title={a.isAccepted ? '“Тусалсан”-ыг болиулах' : '“Тусалсан” гэж тэмдэглэх'} aria-pressed={a.isAccepted}>
            <Check size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div className="answer-main">
        {a.isAccepted && <div className="accepted-label"><CircleCheck size={15} />Асуугчид тусалсан хариулт</div>}
        {a.isHidden && <p className="warn">Нуугдсан хариулт</p>}
        {editing ? (
          <div className="form">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} minLength={10} maxLength={10000} />
            <div className="row-end">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setBody(a.body); }}>Болих</button>
              <button className="btn btn-primary btn-sm" onClick={save}>Хадгалах</button>
            </div>
          </div>
        ) : (
          <Body text={a.body} />
        )}
        <div className="answer-foot">
          <span className="author-line">
            <AuthorLine author={a.author} createdAt={a.createdAt} />
            {/* FR-32: хариулагчийн түвшин ба энэ хичээлд тусалсан туршлага */}
            {a.author?.level && a.author.level.key !== 'newcomer' && <span className="tag tag-level"><Award size={12} />{a.author.level.name}</span>}
            {a.authorAcceptedInSubject > 0 && <span className="tag tag-ok">Энэ хичээлд {a.authorAcceptedInSubject} удаа тусалсан</span>}
          </span>
          <span className="actions">
            {a.isMine && !editing && <button className="link-btn" onClick={() => setEditing(true)}><Pencil size={14} />Засах</button>}
            {a.isMine && <button className="link-btn danger" onClick={remove}><Trash2 size={14} />Устгах</button>}
            {!a.isMine && <ReportButton targetType="answer" targetId={a.id} />}
          </span>
        </div>
        <Comments comments={a.comments} postUrl={`/answers/${a.id}/comments`} onChange={(msg) => run(async () => {}, msg)} />
      </div>
    </li>
  );
}

// FR-14: богино сэтгэгдэл
function Comments({ comments, postUrl, onChange }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api(postUrl, { method: 'POST', body: { body: text } });
      setText(''); setOpen(false); setError(null);
      onChange('Сэтгэгдэл нэмэгдлээ');
    } catch (err) { setError(err); }
  };

  const remove = async (id) => {
    await api(`/comments/${id}`, { method: 'DELETE' });
    onChange('Сэтгэгдэл устгагдлаа');
  };

  return (
    <div className="comments">
      {comments.length > 0 && (
        <ul>
          {comments.map((c) => (
            <li key={c.id}>
              <span className="comment-body">{c.body}</span>
              <Link to={`/users/${c.author.id}`} className="comment-author">{c.author.name}</Link>
              {c.canDelete
                ? <button className="link-btn small danger" onClick={() => remove(c.id)}>устгах</button>
                : <ReportButton targetType="comment" targetId={c.id} label="мэдээлэх" />}
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={submit} className="comment-form">
          <input value={text} onChange={(e) => setText(e.target.value)} minLength={2} maxLength={500}
            placeholder="Тодруулах асуулт, богино сэтгэгдэл" required autoFocus />
          <button className="btn btn-sm btn-primary">Нэмэх</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setOpen(false); setText(''); }}>Болих</button>
          <ErrorText error={error} />
        </form>
      ) : (
        <button className="link-btn small" onClick={() => setOpen(true)}>Сэтгэгдэл нэмэх</button>
      )}
    </div>
  );
}

// FR-09: тайлбартай хариулт бичихийг сануулах заавар (Ү2: тайлбарлаж суралцах)
function AnswerForm({ questionId, onDone }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/questions/${questionId}/answers`, { method: 'POST', body: { body } });
      setBody(''); setError(null);
      onDone();
    } catch (err) { setError(err); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="form answer-form">
      <h2 className="answers-title">Таны хариулт</h2>
      <div className="hint">
        <strong>Зөвхөн хариуг биш, яагаад ингэдгийг тайлбарлаарай.</strong> Алхам бүрийг товч тайлбарлавал асуусан
        оюутан өөрөө дараа нь бодож чадна. Эх сурвалж мэдвэл холбоосыг нь хавсаргаарай.
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} minLength={10} maxLength={10000} required
        placeholder="Тайлбартай хариулт бичих…" />
      <ErrorText error={error} />
      <div className="row-end">
        <span className="muted small grow">{body.trim().length > 0 && body.trim().length < 10 ? 'Хамгийн багадаа 10 тэмдэгт' : ''}</span>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Нийтэлж байна…' : 'Хариулт нийтлэх'}</button>
      </div>
    </form>
  );
}

// FR-33: төстэй асуултууд — ижил хичээлийнхийг эхэнд (GET /questions/:id/related)
function RelatedQuestions({ questionId }) {
  const { data } = useApi(`/questions/${questionId}/related`);
  if (!data?.questions.length) return null;
  return (
    <section className="related rail-card">
      <h3><Sparkles size={16} />Төстэй асуултууд</h3>
      <ul>
        {data.questions.map((r) => (
          <li key={r.id}>
            <Link to={`/questions/${r.id}`}>{r.title}</Link>
            <span className="related-meta">
              <span className={`mini-count ${r.hasAccepted ? 'accepted' : ''}`}>{r.answerCount} хариулт</span>
              <span className="muted">{r.subjectName}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
