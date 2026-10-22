import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { ErrorText, Loading } from '../components/ui.jsx';

// P11: Админ — хичээлийн жагсаалт (FR-17). Хичээлийг устгахгүй, идэвхгүй болгоно.
export default function AdminSubjectsPage() {
  const { data, loading, reload } = useApi('/admin/subjects');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setError(null);
    try { await fn(); await reload(); } catch (err) { setError(err); }
  };

  const add = (e) => {
    e.preventDefault();
    run(async () => { await api('/admin/subjects', { method: 'POST', body: { name } }); setName(''); });
  };
  const rename = (e) => {
    e.preventDefault();
    run(async () => { await api(`/admin/subjects/${editing.id}`, { method: 'PATCH', body: { name: editing.name } }); setEditing(null); });
  };
  const toggle = (s) => run(() => api(`/admin/subjects/${s.id}`, { method: 'PATCH', body: { isActive: !s.isActive } }));

  return (
    <div className="narrow">
      <h1>Хичээлүүд</h1>
      <form onSubmit={add} className="inline-form card">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Шинэ хичээлийн нэр" required minLength={2} maxLength={150} />
        <button className="btn btn-primary">Нэмэх</button>
      </form>
      <ErrorText error={error} />
      {loading && !data ? <Loading /> : (
        <ul className="simple-list card">
          {data?.subjects.map((s) => (
            <li key={s.id} className="row-between">
              {editing?.id === s.id ? (
                <form onSubmit={rename} className="inline-form grow">
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required minLength={2} autoFocus />
                  <button className="btn btn-primary btn-sm">Хадгалах</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Болих</button>
                </form>
              ) : (
                <>
                  <span className={s.isActive ? '' : 'muted strike'}>{s.name}</span>
                  <span className="actions">
                    <button className="link-btn" onClick={() => setEditing({ id: s.id, name: s.name })}>Засах</button>
                    <button className="link-btn" onClick={() => toggle(s)}>{s.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
