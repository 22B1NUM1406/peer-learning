import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Bookmark, BookmarkCheck, Check, CircleCheck, MessageSquareText, Pencil, Sparkles, ThumbsUp, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { AuthorLine, Body, ErrorText, Loading } from '../components/ui.jsx';
import ReportButton from '../components/ReportButton.jsx';
import SuggestedHelpers from '../components/SuggestedHelpers.jsx';

// P4: Асуултын дэлгэрэнгүй (FR-08–FR-12, FR-14, FR-15)
export default function QuestionPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/questions/${id}`);
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorText error={error} />;
  const q = data.question;

  // Үйлдэл бүрийн дараа серверээс дахин уншина: оноо, эрэмбэ үргэлж зөв харагдана
  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
      await reload();
      refresh(); // толгой хэсгийн оноо
    } catch (err) {
      setActionError(err);
    }
  };

  const deleteQuestion = async () => {
    if (!confirm('Асуултыг устгах уу?')) return;
    try {
      await api(`/questions/${q.id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) { setActionError(err); }
  };

  return (
    <article className="question-page narrow">
      <Link to="/" className="back-link small"><ArrowLeft size={15} />Асуултууд</Link>
      <section className="card question-card">
        <div className="crumbs"><Link to={`/subjects/${q.subject.id}`} className="tag">{q.subject.name}</Link></div>
        <h1>{q.title}</h1>
        {q.isHidden && <p className="warn">Энэ асуулт нуугдсан. Зөвхөн админд харагдаж байна.</p>}
        <div className="q-meta"><AuthorLine author={q.author} createdAt={q.createdAt} anonymous={q.isAnonymous} /></div>
        <Body text={q.body} />

        <div className="actions">
          {/* Санал 7: хадгалах — дараа унших, шинэ хариулт ирэхэд мэдэгдэл авах */}
          <button
            className={`link-btn ${q.bookmarkedByMe ? '' : 'muted'}`} aria-pressed={q.bookmarkedByMe}
            onClick={() => run(() => api(`/questions/${q.id}/bookmark`, { method: q.bookmarkedByMe ? 'DELETE' : 'PUT' }))}
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
          onChange={() => run(async () => {})}
        />
      </section>

      <ErrorText error={actionError} />

      <h2 className="section-title icon-title"><MessageSquareText size={18} />{q.answers.length} хариулт</h2>
      {q.answers.length === 0 && <p className="muted">Хариулт алга. Анхны хариултыг та бичээрэй.</p>}
      {q.isMine && q.answers.length === 0 && (
        <SuggestedHelpers
          subjectId={q.subject.id}
          title="Хариулт хүлээж байна уу? Эдгээр оюутнуудад шууд бичээрэй"
          note="Тэдэнд таны асуултын тухай мэдэгдэл очсон."
        />
      )}
      <ul className="answers">
        {q.answers.map((a) => (
          <Answer key={a.id} a={a} question={q} run={run} />
        ))}
      </ul>

      <AnswerForm questionId={q.id} onDone={() => run(async () => {})} />
      <RelatedQuestions questionId={q.id} />
    </article>
  );
}

function Answer({ a, question, run }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(a.body);

  const toggleVote = () => run(() => api(`/answers/${a.id}/vote`, { method: a.votedByMe ? 'DELETE' : 'POST' }));
  const toggleAccept = () => run(() => api(`/questions/${question.id}/accepted`, {
    method: 'PUT', body: { answerId: a.isAccepted ? null : a.id },
  }));
  const save = () => run(async () => {
    await api(`/answers/${a.id}`, { method: 'PATCH', body: { body } });
    setEditing(false);
  });
  const remove = () => {
    if (confirm('Хариултыг устгах уу? Үүгээр авсан оноо хасагдана.')) run(() => api(`/answers/${a.id}`, { method: 'DELETE' }));
  };

  return (
    <li className={`card answer ${a.isAccepted ? 'is-accepted' : ''}`}>
      <div className="vote-col">
        <button
          className={`vote-btn ${a.votedByMe ? 'on' : ''}`}
          onClick={toggleVote}
          disabled={a.isMine}
          title={a.isMine ? 'Өөрийн хариултыг үнэлэх боломжгүй' : 'Тустай'}
          aria-pressed={a.votedByMe}
        >
          <ThumbsUp size={16} /><span className="vote-count">{a.voteCount}</span><span className="vote-label">Тустай</span>
        </button>
        {question.isMine && (
          <button className={`accept-btn ${a.isAccepted ? 'on' : ''}`} onClick={toggleAccept}
            title={a.isAccepted ? '“Тусалсан”-ыг болиулах' : '“Тусалсан” гэж тэмдэглэх'} aria-pressed={a.isAccepted}>
            <Check size={20} />
          </button>
        )}
      </div>
      <div className="answer-main">
        {a.isAccepted && <div className="accepted-label"><CircleCheck size={16} />Асуугчид тусалсан хариулт</div>}
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
            {/* Санал 6: хариулагчийн түвшин ба энэ хичээлд тусалсан туршлага */}
            {a.author?.level && a.author.level.key !== 'newcomer' && <span className="tag tag-level"><Award size={12} />{a.author.level.name}</span>}
            {a.authorAcceptedInSubject > 0 && <span className="tag tag-ok">Энэ хичээлд {a.authorAcceptedInSubject} удаа тусалсан</span>}
          </span>
          <span className="actions">
            {a.isMine && !editing && <button className="link-btn" onClick={() => setEditing(true)}><Pencil size={14} />Засах</button>}
            {a.isMine && <button className="link-btn danger" onClick={remove}><Trash2 size={14} />Устгах</button>}
            {!a.isMine && <ReportButton targetType="answer" targetId={a.id} />}
          </span>
        </div>
        <Comments comments={a.comments} postUrl={`/answers/${a.id}/comments`} onChange={() => run(async () => {})} />
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
      onChange();
    } catch (err) { setError(err); }
  };

  const remove = async (id) => {
    await api(`/comments/${id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div className="comments">
      {comments.length > 0 && (
        <ul>
          {comments.map((c) => (
            <li key={c.id}>
              <span className="comment-body">{c.body}</span>
              <span className="muted small"> — <Link to={`/users/${c.author.id}`}>{c.author.name}</Link></span>
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
    <form onSubmit={submit} className="card form pad-lg answer-form">
      <h2 className="section-title no-top">Таны хариулт</h2>
      <div className="hint">
        <strong>Зөвхөн хариуг биш, яагаад ингэдгийг тайлбарлаарай.</strong> Алхам бүрийг товч тайлбарлавал асуусан
        оюутан өөрөө дараа нь бодож чадна. Эх сурвалж мэдвэл холбоосыг нь хавсаргаарай.
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} minLength={10} maxLength={10000} required
        placeholder="Тайлбартай хариулт бичих…" />
      <ErrorText error={error} />
      <div className="row-end"><button className="btn btn-primary" disabled={busy}>Хариулт нийтлэх</button></div>
    </form>
  );
}

// Санал 5: төстэй асуултууд — ижил хичээлийнхийг эхэнд (GET /questions/:id/related)
function RelatedQuestions({ questionId }) {
  const { data } = useApi(`/questions/${questionId}/related`);
  if (!data?.questions.length) return null;
  return (
    <section className="related card pad">
      <h2 className="icon-title"><Sparkles size={17} />Төстэй асуултууд</h2>
      <ul>
        {data.questions.map((r) => (
          <li key={r.id}>
            <Link to={`/questions/${r.id}`}>{r.title}</Link>
            <span className="muted small"> · {r.subjectName} · {r.answerCount} хариулт{r.hasAccepted ? ' · тусалсан хариулттай' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
