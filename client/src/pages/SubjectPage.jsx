import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, FileText, FolderOpen, ImageIcon, Link2, MessagesSquare, Plus, Trash2, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useFeedback } from '../lib/feedback.jsx';
import { notifyProfileChanged } from '../components/Layout.jsx';
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
  const sj = data.subject;

  return (
    <>
      <header className="page-head subject-head">
        <span className="subject-icon lg"><BookOpen size={20} /></span>
        <div className="page-head-text">
          <h1>{sj.code && <span className="subject-code">{sj.code}</span>}{sj.name}</h1>
          {sj.schoolId && (
            <p className="page-sub">
              <Link to={`/subjects?school=${sj.schoolId}`}>{sj.schoolShortName}</Link>
              {sj.departmentName && <span>{sj.departmentName}</span>}
            </p>
          )}
        </div>
        <div className="page-actions">
          <Link to={`/questions/new?subject=${id}`} className="btn btn-primary"><Plus size={16} />Энэ хичээлээр асуух</Link>
        </div>
      </header>
      <Tabs
        tabs={[['questions', 'Асуултууд', MessagesSquare, sj.questionCount], ['resources', 'Материал', FolderOpen], ['helpers', 'Туслах боломжтой оюутнууд', Users]]}
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
  if (!data.questions.length) {
    return (
      <Empty title="Энэ хичээлээр асуулт алга"
        action={<Link to={`/questions/new?subject=${subjectId}`} className="btn btn-primary btn-sm"><Plus size={15} />Анхны асуултыг асуух</Link>}>
        Ойлгохгүй байгаа зүйлээ асуувал энэ хичээлийн туслагчдад мэдэгдэл очно.
      </Empty>
    );
  }
  return (
    <ul className="q-list">
      {data.questions.map((q) => <QuestionCard key={q.id} q={q} showSubject={false} />)}
    </ul>
  );
}

function Resources({ subjectId }) {
  const { data, error, loading, reload } = useApi(`/subjects/${subjectId}/resources`);
  const { toast, confirm } = useFeedback();

  const remove = async (r) => {
    const ok = await confirm({ title: 'Материалыг устгах уу?', body: `“${r.title}” бүрмөсөн устгагдана.`, confirmLabel: 'Устгах', danger: true });
    if (!ok) return;
    try {
      await api(`/resources/${r.id}`, { method: 'DELETE' });
      toast('Материал устгагдлаа');
      reload();
    } catch (err) { toast(err.message, { tone: 'error' }); }
  };

  return (
    <>
      <div className="tab-toolbar">
        <span className="muted small">{data ? `${data.resources.length} материал` : ''}</span>
        <Link to={`/resources/new?subject=${subjectId}`} className="btn btn-secondary btn-sm"><Plus size={15} />Материал нэмэх</Link>
      </div>
      {loading && <Loading />}
      <ErrorText error={error} onRetry={reload} />
      {data?.resources.length === 0 && (
        <Empty icon={FolderOpen} title="Материал алга">Лекцийн слайд, бие даалтын жишээ, хэрэгтэй холбоосоо хуваалцаарай.</Empty>
      )}
      <ul className="res-list">
        {data?.resources.map((r) => (
          <li key={r.id} className="res">
            <span className={`res-icon ${r.kind}`} aria-hidden="true">{r.kind === 'link' ? <Link2 size={17} /> : r.mimeType === 'application/pdf' ? <FileText size={17} /> : <ImageIcon size={17} />}</span>
            <div className="res-main">
              <a href={r.kind === 'link' ? r.url : r.fileUrl} target="_blank" rel="noopener noreferrer nofollow" className="res-title">{r.title}</a>
              {r.description && <p className="res-desc">{r.description}</p>}
              <div className="res-meta">
                <Link to={`/users/${r.author.id}`}>{r.author.name}</Link>
                <span>{timeAgo(r.createdAt)}</span>
                {r.kind === 'file' && <span>{fileSize(r.fileSize)}</span>}
                {r.kind === 'link' && <span>{new URL(r.url).hostname}</span>}
              </div>
            </div>
            <span className="actions">
              {r.canDelete
                ? <button className="link-btn danger" onClick={() => remove(r)}><Trash2 size={13} />Устгах</button>
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
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const iAmHelper = data?.helpers.some((h) => h.id === user.id);

  // Энэ хичээлийг өөрийн туслах хичээлүүдэд нэмэх, хасах (FR-04)
  const toggle = async () => {
    setBusy(true);
    try {
      const { user: me } = await api(`/users/${user.id}`);
      const ids = me.helpSubjects.map((s) => s.id).filter((x) => x !== Number(subjectId));
      if (!iAmHelper) ids.push(Number(subjectId));
      await api('/users/me/subjects', { method: 'PUT', body: { subjectIds: ids } });
      await reload();
      notifyProfileChanged();
      toast(iAmHelper ? 'Туслагчаас хасагдлаа' : 'Туслагчаар нэмэгдлээ. Шинэ асуулт танд мэдэгдэнэ');
    } catch (err) { toast(err.message, { tone: 'error' }); }
    setBusy(false);
  };

  return (
    <>
      <div className="tab-toolbar">
        <span className="muted small">“Тусалсан” хариултын тоогоор эрэмбэлсэн</span>
        <button className={`btn btn-sm ${iAmHelper ? 'btn-secondary' : 'btn-primary'}`} onClick={toggle} disabled={busy || loading}>
          {iAmHelper ? 'Туслагчаас хасагдах' : 'Би энэ хичээлд туслах боломжтой'}
        </button>
      </div>
      {loading && <Loading />}
      <ErrorText error={error} />
      {data?.helpers.length === 0 && <Empty icon={Users} title="Туслагч алга">Энэ хичээлийг мэддэг бол туслагчаар нэмэгдээрэй. Шинэ асуулт танд мэдэгдлээр ирнэ.</Empty>}
      <ul className="helper-list">
        {data?.helpers.map((h, i) => (
          <li key={h.id} className="helper">
            <span className={`rank ${i < 3 && h.acceptedInSubject > 0 ? 'top' : ''}`}>{i + 1}</span>
            <Avatar name={h.name} size={34} />
            <div className="grow">
              <Link to={`/users/${h.id}`} className="strong">{h.name}</Link>
              <div className="muted small">{[h.faculty, h.year && `${h.year}-р курс`].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="helper-stats">
              <span><strong>{h.acceptedInSubject}</strong> тусалсан</span>
              <span className="muted small">{h.reputation} оноо</span>
            </div>
            {h.id !== user.id && <Link to={`/messages/${h.id}`} className="btn btn-secondary btn-sm">Мессеж</Link>}
          </li>
        ))}
      </ul>
    </>
  );
}
