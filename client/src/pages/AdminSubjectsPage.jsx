import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { ErrorText, Loading, PageHeader, Tabs, SchoolOptions } from '../components/ui.jsx';
import { useFeedback } from '../lib/feedback.jsx';

// P11: Админ — хичээл (FR-17) ба бүрэлдэхүүн сургууль, тэнхим (FR-26).
// Оюутны нэмсэн хичээлийг (FR-27) хэн нэмснээр нь тэмдэглэж, засах эсвэл идэвхгүй болгоно.
// Хичээлийг устгахгүй, идэвхгүй болгоно.
export default function AdminSubjectsPage() {
  const [tab, setTab] = useState('subjects');
  const schools = useApi('/schools');
  return (
    <>
      <PageHeader title="Хичээл удирдах" sub="Хичээл, бүрэлдэхүүн сургууль, тэнхимийг нэмж засна. Оюутны нэмсэн хичээлийг энд шалгана." />
      <Tabs tabs={[['subjects', 'Хичээлүүд'], ['schools', 'Сургууль, тэнхим']]} value={tab} onChange={setTab} />
      {tab === 'subjects'
        ? <SubjectsAdmin schools={schools.data?.schools ?? []} />
        : <SchoolsAdmin data={schools.data} reload={schools.reload} />}
    </>
  );
}

const empty = { name: '', code: '', schoolId: '', departmentId: '' };

// Сургууль → тэнхимийн хоёр сонголт (тэнхим нь заавал биш)
function Placement({ schools, value, onChange }) {
  const depts = schools.find((s) => String(s.id) === String(value.schoolId))?.departments ?? [];
  return (
    <>
      <select aria-label="Сургууль" value={value.schoolId ?? ''} onChange={(e) => onChange({ schoolId: e.target.value, departmentId: '' })}>
        <option value="">Сургууль —</option>
        <SchoolOptions schools={schools} />
      </select>
      <select aria-label="Тэнхим" value={value.departmentId ?? ''} onChange={(e) => onChange({ departmentId: e.target.value })} disabled={!depts.length}>
        <option value="">Тэнхим —</option>
        {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </>
  );
}

const toBody = (f) => ({ name: f.name, code: f.code || null, schoolId: f.schoolId || null, departmentId: f.departmentId || null });

function SubjectsAdmin({ schools }) {
  const { data, loading, reload } = useApi('/admin/subjects');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const { toast } = useFeedback();
  const run = async (fn) => {
    setError(null);
    try { await fn(); await reload(); toast('Хадгалагдлаа'); } catch (err) { setError(err); }
  };
  const add = (e) => {
    e.preventDefault();
    run(async () => { await api('/admin/subjects', { method: 'POST', body: toBody(form) }); setForm(empty); });
  };
  const save = (e) => {
    e.preventDefault();
    run(async () => { await api(`/admin/subjects/${editing.id}`, { method: 'PATCH', body: toBody(editing) }); setEditing(null); });
  };
  const toggle = (s) => run(() => api(`/admin/subjects/${s.id}`, { method: 'PATCH', body: { isActive: !s.isActive } }));
  const startEdit = (s) => setEditing({ id: s.id, name: s.name, code: s.code ?? '', schoolId: s.schoolId ?? '', departmentId: s.departmentId ?? '' });

  return (
    <>
      <form onSubmit={add} className="panel admin-subject-form">
        <input aria-label="Хичээлийн нэр" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Шинэ хичээлийн нэр" required minLength={2} maxLength={150} />
        <input aria-label="Код" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Код (заавал биш)" maxLength={20} />
        <Placement schools={schools} value={form} onChange={(c) => setForm({ ...form, ...c })} />
        <button className="btn btn-primary"><Plus size={16} />Нэмэх</button>
      </form>
      <ErrorText error={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap panel flush">
          <table className="table">
            <thead><tr><th>Код</th><th>Хичээл</th><th>Сургууль · тэнхим</th><th aria-label="Үйлдэл" /></tr></thead>
            <tbody>
              {data?.subjects.map((s) => (editing?.id === s.id ? (
                <tr key={s.id}>
                  <td colSpan={4}>
                    <form onSubmit={save} className="admin-subject-form">
                      <input aria-label="Хичээлийн нэр" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required minLength={2} autoFocus />
                      <input aria-label="Код" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="Код" maxLength={20} />
                      <Placement schools={schools} value={editing} onChange={(c) => setEditing({ ...editing, ...c })} />
                      <span className="actions">
                        <button className="btn btn-primary btn-sm">Хадгалах</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Болих</button>
                      </span>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className={s.isActive ? '' : 'muted'}>
                  <td className="nowrap">{s.code ?? '—'}</td>
                  <td>
                    <span className={s.isActive ? '' : 'strike'}>{s.name}</span>
                    {s.createdByName && <span className="muted small block">Оюутан нэмсэн: {s.createdByName}</span>}
                  </td>
                  <td className="small">{[s.schoolShortName, s.departmentName].filter(Boolean).join(' · ') || <span className="muted">Оноогоогүй</span>}</td>
                  <td className="nowrap">
                    <span className="actions">
                      <button className="link-btn" onClick={() => startEdit(s)}>Засах</button>
                      <button className="link-btn" onClick={() => toggle(s)}>{s.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}</button>
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SchoolsAdmin({ data, reload }) {
  const [school, setSchool] = useState({ name: '', shortName: '' });
  const [dept, setDept] = useState({});          // schoolId → шинэ тэнхимийн нэр
  const [rename, setRename] = useState(null);    // { kind, id, name, shortName? }
  const [error, setError] = useState(null);

  const { toast } = useFeedback();
  const run = async (fn) => {
    setError(null);
    try { await fn(); await reload(); toast('Хадгалагдлаа'); } catch (err) { setError(err); }
  };
  const addSchool = (e) => {
    e.preventDefault();
    run(async () => { await api('/admin/schools', { method: 'POST', body: school }); setSchool({ name: '', shortName: '' }); });
  };
  const addDept = (e, sid) => {
    e.preventDefault();
    run(async () => { await api(`/admin/schools/${sid}/departments`, { method: 'POST', body: { name: dept[sid] } }); setDept({ ...dept, [sid]: '' }); });
  };
  const saveRename = (e) => {
    e.preventDefault();
    run(async () => {
      if (rename.kind === 'school') await api(`/admin/schools/${rename.id}`, { method: 'PATCH', body: { name: rename.name, shortName: rename.shortName } });
      else await api(`/admin/departments/${rename.id}`, { method: 'PATCH', body: { name: rename.name } });
      setRename(null);
    });
  };

  if (!data) return <Loading />;
  return (
    <>
      <form onSubmit={addSchool} className="panel admin-subject-form">
        <input aria-label="Сургуулийн нэр" value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} placeholder="Бүрэлдэхүүн сургуулийн нэр" required minLength={2} maxLength={150} />
        <input aria-label="Товчлол" value={school.shortName} onChange={(e) => setSchool({ ...school, shortName: e.target.value })} placeholder="Товчлол (МТЭС)" required minLength={2} maxLength={20} />
        <button className="btn btn-primary"><Plus size={16} />Сургууль нэмэх</button>
      </form>
      <ErrorText error={error} />
      <div className="school-admin-list">
        {data.schools.map((s) => (
          <section key={s.id} className="panel">
            {rename?.kind === 'school' && rename.id === s.id ? (
              <form onSubmit={saveRename} className="admin-subject-form">
                <input aria-label="Сургуулийн нэр" value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} required minLength={2} />
                <input aria-label="Товчлол" value={rename.shortName} onChange={(e) => setRename({ ...rename, shortName: e.target.value })} required minLength={2} maxLength={20} />
                <button className="btn btn-primary btn-sm">Хадгалах</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRename(null)}>Болих</button>
              </form>
            ) : (
              <div className="row-between">
                <h3 className="no-top" style={{ margin: 0 }}>{s.shortName} <span className="muted small">{s.name} · {s.subjectCount} хичээл</span></h3>
                <button className="link-btn" onClick={() => setRename({ kind: 'school', id: s.id, name: s.name, shortName: s.shortName })}>Засах</button>
              </div>
            )}
            <ul className="dept-list">
              {s.departments.map((d) => (
                <li key={d.id}>
                  {rename?.kind === 'dept' && rename.id === d.id ? (
                    <form onSubmit={saveRename} className="admin-subject-form">
                      <input aria-label="Тэнхимийн нэр" value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} required minLength={2} autoFocus />
                      <button className="btn btn-primary btn-sm">Хадгалах</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRename(null)}>Болих</button>
                    </form>
                  ) : (
                    <span className="row-between">
                      <span>{d.name}</span>
                      <button className="link-btn small" onClick={() => setRename({ kind: 'dept', id: d.id, name: d.name })}>Засах</button>
                    </span>
                  )}
                </li>
              ))}
              {s.departments.length === 0 && <li className="muted small">Тэнхим оруулаагүй</li>}
            </ul>
            <form onSubmit={(e) => addDept(e, s.id)} className="admin-subject-form">
              <input aria-label="Шинэ тэнхим" value={dept[s.id] ?? ''} onChange={(e) => setDept({ ...dept, [s.id]: e.target.value })} placeholder="Шинэ тэнхимийн нэр" required minLength={2} maxLength={150} />
              <button className="btn btn-ghost btn-sm"><Plus size={15} />Тэнхим нэмэх</button>
            </form>
          </section>
        ))}
      </div>
    </>
  );
}
