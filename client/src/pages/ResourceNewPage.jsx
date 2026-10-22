import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useSubjects } from '../lib/hooks.js';
import { ErrorText, Tabs } from '../components/ui.jsx';

const MAX = 10 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

// P6: Материал нэмэх — холбоос (FR-21) эсвэл файл (FR-23)
export default function ResourceNewPage() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const subjects = useSubjects();
  const [kind, setKind] = useState('link');
  const [form, setForm] = useState({ subjectId: search.get('subject') ?? '', title: '', description: '', url: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  // Хэрэглэгчид шууд мэдэгдэхийн тулд клиентэд урьдчилан шалгана; жинхэнэ шалгалт серверт
  const pickFile = (e) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX) { setError(new Error('Файл 10 MB-аас их байна')); e.target.value = ''; return; }
    if (f && !TYPES.includes(f.type)) { setError(new Error('Зөвхөн PDF, PNG, JPG файл')); e.target.value = ''; return; }
    setFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set('subjectId', form.subjectId);
    fd.set('title', form.title);
    if (form.description) fd.set('description', form.description);
    if (kind === 'link') fd.set('url', form.url);
    else if (file) fd.set('file', file);
    try {
      await api('/resources', { method: 'POST', body: fd });
      navigate(`/subjects/${form.subjectId}?tab=resources`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <h1>Материал нэмэх</h1>
      <form onSubmit={onSubmit} className="form card pad-lg">
        <Tabs tabs={[['link', 'Холбоос'], ['file', 'Файл (PDF, зураг)']]} value={kind} onChange={setKind} />
        <label>Хичээл
          <select value={form.subjectId} onChange={set('subjectId')} required>
            <option value="" disabled>Хичээл сонгоно уу</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Гарчиг
          <input value={form.title} onChange={set('title')} required minLength={3} maxLength={200} placeholder="Жишээ нь: 5-р лекцийн слайд" />
        </label>
        {kind === 'link' ? (
          <label>Холбоос
            <input type="url" value={form.url} onChange={set('url')} required placeholder="https://…" />
          </label>
        ) : (
          <label>Файл
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={pickFile} required />
            <small className="muted">PDF, PNG, JPG · 10 MB хүртэл</small>
          </label>
        )}
        <label>Тайлбар (заавал биш)
          <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} />
        </label>
        <p className="muted small">Шалгалтын материал болон зохиогчийн эрхтэй контент хуваалцахгүй байна уу.</p>
        <ErrorText error={error} />
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Болих</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Илгээж байна…' : 'Нийтлэх'}</button>
        </div>
      </form>
    </div>
  );
}
