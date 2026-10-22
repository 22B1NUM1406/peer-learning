import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { fileSize, timeAgo } from '../lib/format.js';
import QuestionCard from '../components/QuestionCard.jsx';
import ReportButton from '../components/ReportButton.jsx';
import { Avatar, Empty, ErrorText, Loading, Tabs } from '../components/ui.jsx';

// P5: Хичээлийн хуудас — Асуултууд · Материал · Туслах боломжтой оюутнууд (FR-04, FR-07, FR-21, FR-23)
export default function SubjectPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'questions';
  const { data, error } = useApi(`/subjects/${id}`);

  if (error) return <ErrorText error={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="page-head">
        <h1>{data.subject.name}</h1>
        <Link to={`/questions/new?subject=${id}`} className="btn btn-primary">Энэ хичээлээр асуух</Link>
      </div>
      <Tabs
        tabs={[['questions', 'Асуултууд'], ['resources', 'Материал'], ['helpers', 'Туслах боломжтой оюутнууд']]}
        value={tab}
        onChange={(t) => setParams(t === 'questions' ? {} : { tab: t }, { replace: true })}
      />
      {tab === 'questions' && <SubjectQuestions subjectId={id} />}
      {tab === 'resources' && <Resources subjectId={id} />}
      {tab === 'helpers' && <Helpers subjectId={id} />}
    </>
  );
}

function SubjectQuestions({ subjectId }) {
  const { data, error, loading } = useApi('/questions', { subject: subjectId });
  if (loading) return <Loading />;
  if (error) return <ErrorText error={error} />;
  if (!data.questions.length) return <Empty>Энэ хичээлээр асуулт алга.</Empty>;
  return (
    <ul className="q-list">
      {data.questions.map((q) => <QuestionCard key={q.id} q={q} showSubject={false} />)}
    </ul>
  );
}

function Resources({ subjectId }) {
  const { data, error, loading, reload } = useApi(`/subjects/${subjectId}/resources`);

  const remove = async (r) => {
    if (!confirm(`“${r.title}”-ийг устгах уу?`)) return;
    await api(`/resources/${r.id}`, { method: 'DELETE' });
    reload();
  };

  return (
    <>
      <div className="row-end"><Link to={`/resources/new?subject=${subjectId}`} className="btn btn-ghost">+ Материал нэмэх</Link></div>
      {loading && <Loading />}
      <ErrorText error={error} />
      {data?.resources.length === 0 && <Empty>Материал алга. Лекц, бие даалтын материалаа хуваалцаарай.</Empty>}
      <ul className="res-list">
        {data?.resources.map((r) => (
          <li key={r.id} className="card res">
            <span className={`res-icon ${r.kind}`} aria-hidden="true">{r.kind === 'link' ? '🔗' : r.mimeType === 'application/pdf' ? 'PDF' : 'IMG'}</span>
            <div className="res-main">
              <a href={r.kind === 'link' ? r.url : r.fileUrl} target="_blank" rel="noopener noreferrer nofollow" className="res-title">{r.title}</a>
              {r.description && <p className="muted small">{r.description}</p>}
              <div className="muted small">
                <Link to={`/users/${r.author.id}`}>{r.author.name}</Link> · {timeAgo(r.createdAt)}
                {r.kind === 'file' && <> · {fileSize(r.fileSize)}</>}
                {r.kind === 'link' && <> · {new URL(r.url).hostname}</>}
              </div>
            </div>
            <span className="actions">
              {r.canDelete
                ? <button className="link-btn danger small" onClick={() => remove(r)}>Устгах</button>
                : <ReportButton targetType="resource" targetId={r.id} />}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Helpers({ subjectId }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(`/subjects/${subjectId}/helpers`);
  const [busy, setBusy] = useState(false);
  const iAmHelper = data?.helpers.some((h) => h.id === user.id);

  // Энэ хичээлийг өөрийн туслах хичээлүүдэд нэмэх, хасах (FR-04)
  const toggle = async () => {
    setBusy(true);
    const { user: me } = await api(`/users/${user.id}`);
    const ids = me.helpSubjects.map((s) => s.id).filter((x) => x !== Number(subjectId));
    if (!iAmHelper) ids.push(Number(subjectId));
    await api('/users/me/subjects', { method: 'PUT', body: { subjectIds: ids } });
    await reload();
    setBusy(false);
  };

  return (
    <>
      <div className="row-between">
        <p className="muted small">“Тусалсан” хариултын тоогоор эрэмбэлсэн</p>
        <button className="btn btn-ghost btn-sm" onClick={toggle} disabled={busy || loading}>
          {iAmHelper ? 'Туслагчаас хасагдах' : 'Би энэ хичээлд туслах боломжтой'}
        </button>
      </div>
      {loading && <Loading />}
      <ErrorText error={error} />
      {data?.helpers.length === 0 && <Empty>Одоогоор туслах оюутан бүртгүүлээгүй байна.</Empty>}
      <ul className="helper-list">
        {data?.helpers.map((h, i) => (
          <li key={h.id} className="card helper">
            <span className="rank">{i + 1}</span>
            <Avatar name={h.name} size={40} />
            <div className="grow">
              <Link to={`/users/${h.id}`} className="strong">{h.name}</Link>
              <div className="muted small">{[h.faculty, h.year && `${h.year}-р курс`].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="helper-stats">
              <span><strong>{h.acceptedInSubject}</strong> тусалсан</span>
              <span className="muted small">{h.reputation} оноо</span>
            </div>
            {h.id !== user.id && <Link to={`/messages/${h.id}`} className="btn btn-ghost btn-sm">Мессеж</Link>}
          </li>
        ))}
      </ul>
    </>
  );
}
