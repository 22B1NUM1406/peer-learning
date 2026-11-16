import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { timeAgo } from '../lib/format.js';
import { Empty, ErrorText, Loading, PageHeader, Tabs } from '../components/ui.jsx';
import { useFeedback } from '../lib/feedback.jsx';
import { ShieldCheck, UserX } from 'lucide-react';

// P10: Админ — мэдээллүүд (FR-16) ба түдгэлзүүлэх (FR-18)
const TYPE = { question: 'Асуулт', answer: 'Хариулт', comment: 'Сэтгэгдэл', resource: 'Материал', message: 'Мессеж' };
const HIDEABLE = ['question', 'answer', 'resource'];

export default function AdminReportsPage() {
  const [tab, setTab] = useState('open');
  return (
    <>
      <PageHeader title="Мэдээллүүд" sub="Оюутнуудын мэдээлсэн контентыг хянаж нуух, устгах эсвэл зөрчилгүй гэж хаана." />
      <Tabs tabs={[['open', 'Нээлттэй'], ['resolved', 'Шийдвэрлэсэн'], ['dismissed', 'Хаасан'], ['users', 'Түдгэлзсэн хэрэглэгчид']]} value={tab} onChange={setTab} />
      {tab === 'users' ? <SuspendedUsers /> : <Reports status={tab} />}
    </>
  );
}

function Reports({ status }) {
  const { data, error, loading, reload } = useApi('/admin/reports', { status });
  const [actionError, setActionError] = useState(null);
  const { toast, confirm } = useFeedback();
  const DONE = { hide: 'Контент нуугдлаа', delete: 'Контент устгагдлаа', dismiss: 'Мэдээллийг хаалаа' };

  const act = async (fn, question, done) => {
    if (question && !(await confirm(question))) return;
    setActionError(null);
    try { await fn(); await reload(); toast(done); } catch (err) { setActionError(err); }
  };
  const resolve = (r, action) => act(
    () => api(`/admin/reports/${r.id}`, { method: 'PATCH', body: { action } }),
    action === 'delete' ? { title: `${TYPE[r.targetType]}-ыг бүрмөсөн устгах уу?`, body: 'Устгасныг сэргээх боломжгүй. Түүгээр авсан оноо хасагдана.', confirmLabel: 'Устгах', danger: true } : null,
    DONE[action],
  );
  const suspend = (r) => act(
    () => api(`/admin/users/${r.ownerId}/status`, { method: 'PATCH', body: { status: 'suspended' } }),
    { title: `${r.ownerName}-г түдгэлзүүлэх үү?`, body: 'Тэр шууд системээс гарч, дахин нэвтэрч чадахгүй. “Түдгэлзсэн хэрэглэгчид” табаас сэргээнэ.', confirmLabel: 'Түдгэлзүүлэх', danger: true },
    `${r.ownerName} түдгэлзлээ`,
  );

  if (loading && !data) return <Loading />;
  if (error) return <ErrorText error={error} />;
  if (!data.reports.length) return <Empty icon={ShieldCheck} title={status === 'open' ? 'Шийдвэрлэх мэдээлэл алга' : 'Мэдээлэл алга'} />;

  return (
    <>
      <ErrorText error={actionError} />
      <div className="table-wrap panel flush">
        <table className="table">
          <thead>
            <tr><th>Контент</th><th>Шалтгаан</th><th>Мэдээлсэн</th><th>Эзэн</th>{status === 'open' && <th>Үйлдэл</th>}</tr>
          </thead>
          <tbody>
            {data.reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="tag">{TYPE[r.targetType]}</span>
                  {r.openCount > 1 && <span className="tag tag-warn">{r.openCount} мэдээлэл</span>}
                  <div className="clamp">{r.preview ?? <em className="muted">устгагдсан</em>}</div>
                  {r.questionId && <Link to={`/questions/${r.questionId}`} className="small">Асуулт руу очих</Link>}
                  {r.subjectId && <Link to={`/subjects/${r.subjectId}?tab=resources`} className="small">Материал руу очих</Link>}
                </td>
                <td>{r.reason}</td>
                <td>{r.reporterName}<div className="muted small">{timeAgo(r.createdAt)}</div></td>
                <td>
                  {r.ownerName && <Link to={`/users/${r.ownerId}`}>{r.ownerName}</Link>}
                  {r.ownerStatus === 'suspended' && <div className="tag tag-warn">түдгэлзсэн</div>}
                </td>
                {status === 'open' && (
                  <td className="nowrap">
                    <div className="btn-col">
                      {HIDEABLE.includes(r.targetType) && !r.isHidden && <button className="btn btn-ghost btn-sm" onClick={() => resolve(r, 'hide')}>Нуух</button>}
                      <button className="btn btn-ghost btn-sm danger" onClick={() => resolve(r, 'delete')}>Устгах</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => resolve(r, 'dismiss')}>Зөрчилгүй</button>
                      {r.ownerId && r.ownerStatus === 'active' && <button className="btn btn-ghost btn-sm danger" onClick={() => suspend(r)}>Түдгэлзүүлэх</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SuspendedUsers() {
  const { data, loading, reload } = useApi('/admin/users', { status: 'suspended' });
  const { toast } = useFeedback();
  const restore = async (u) => {
    try {
      await api(`/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: 'active' } });
      toast(`${u.name} сэргээгдлээ`);
      reload();
    } catch (err) { toast(err.message, { tone: 'error' }); }
  };
  if (loading) return <Loading />;
  if (!data?.users.length) return <Empty icon={UserX} title="Түдгэлзсэн хэрэглэгч алга" />;
  return (
    <ul className="simple-list">
      {data.users.map((u) => (
        <li key={u.id} className="row-between">
          <span><strong>{u.name}</strong> <span className="muted small">{u.email}</span></span>
          <button className="btn btn-ghost btn-sm" onClick={() => restore(u)}>Сэргээх</button>
        </li>
      ))}
    </ul>
  );
}
