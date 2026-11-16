import { useMemo, useState } from 'react';
import { BookOpen, Check, Plus, Search, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { subjectLabel } from '../lib/hooks.js';
import { ErrorText } from './ui.jsx';

// FR-26: асуулт асуухад хичээл сонгох. Гурван шаттай цэсний оронд нэг хайлттай талбар:
// нэр эсвэл кодоор хайна, хүсвэл бүрэлдэхүүн сургуулиар шүүнэ (заавал биш).
// FR-27: жагсаалтад байхгүй бол оюутан өөрөө нэмнэ; нэмэхийн өмнө ижил төстэй хичээлийг санал болгоно.
export default function SubjectPicker({ subjects, schools, value, onChange, onCreated, required, loading }) {
  const [text, setText] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [adding, setAdding] = useState(false);
  const selected = subjects.find((s) => String(s.id) === String(value));

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    return subjects.filter((s) => (!schoolId || String(s.schoolId) === schoolId)
      && (!t || s.name.toLowerCase().includes(t) || (s.code ?? '').toLowerCase().includes(t)));
  }, [subjects, text, schoolId]);

  if (selected) {
    return (
      <div className="picker-selected card">
        <span className="subject-icon sm"><BookOpen size={15} /></span>
        <span className="grow">
          <span className="strong block">{subjectLabel(selected)}</span>
          <span className="muted small">{[selected.schoolShortName, selected.departmentName].filter(Boolean).join(' · ') || 'Сургууль заагаагүй'}</span>
        </span>
        <button type="button" className="link-btn" onClick={() => { setText(''); onChange(''); }} aria-label="Хичээл солих"><X size={15} />Солих</button>
      </div>
    );
  }

  if (adding) {
    return (
      <NewSubject
        schools={schools}
        initial={{ name: text.trim(), schoolId }}
        onCancel={() => setAdding(false)}
        onPick={(s) => { setAdding(false); setText(''); onChange(String(s.id)); }}
        onCreated={(s) => { setAdding(false); setText(''); onCreated?.(s); onChange(String(s.id)); }}
      />
    );
  }

  return (
    <div className="picker">
      <div className="picker-bar">
        <label className="search-box grow">
          <Search size={17} />
          <input
            type="search" aria-label="Хичээл хайх" placeholder="Хичээлийн нэр эсвэл код (жишээ нь: өгөгдөл, ICSI)…"
            value={text} onChange={(e) => setText(e.target.value)}
          />
        </label>
        <select aria-label="Бүрэлдэхүүн сургууль" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">Бүх сургууль</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
        </select>
      </div>
      <ul className="picker-list" role="listbox" aria-label="Хичээл">
        {loading && <li className="muted small pad">Ачаалж байна…</li>}
        {!loading && matches.length === 0 && <li className="muted small pad">Тохирох хичээл олдсонгүй.</li>}
        {matches.map((s) => (
          <li key={s.id}>
            <button type="button" role="option" aria-selected="false" onClick={() => onChange(String(s.id))}>
              <span className="grow">
                <span className="strong">{subjectLabel(s)}</span>
                <span className="muted small block">{[s.schoolShortName, s.departmentName].filter(Boolean).join(' · ')}</span>
              </span>
              <Check size={16} className="picker-check" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-btn picker-add" onClick={() => setAdding(true)}>
        <Plus size={15} />{text.trim() ? `“${text.trim()}” хичээлийг нэмэх` : 'Жагсаалтад байхгүй бол шинэ хичээл нэмэх'}
      </button>
      {/* Маягтын заавал бөглөх шалгалт: хичээл сонгоогүй бол илгээхгүй */}
      {required && <input className="picker-required" tabIndex={-1} aria-hidden="true" required value="" onChange={() => {}} onInvalid={(e) => e.target.setCustomValidity('Хичээл сонгоно уу')} />}
    </div>
  );
}

// Шинэ хичээл нэмэх хэсэг. Асуултын маягт дотор байрладаг тул тусдаа <form> биш (HTML-д давхар form хориотой).
function NewSubject({ schools, initial, onCancel, onPick, onCreated }) {
  const [f, setF] = useState({ name: initial.name, code: '', schoolId: initial.schoolId, departmentId: '' });
  const [similar, setSimilar] = useState(null);   // null = шалгаагүй, [] = ижил хичээл алга
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const depts = schools.find((s) => String(s.id) === String(f.schoolId))?.departments ?? [];
  const set = (changes) => { setF({ ...f, ...changes }); setSimilar(null); };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await api('/subjects', { method: 'POST', body: { name: f.name.trim(), code: f.code || null, schoolId: f.schoolId || null, departmentId: f.departmentId || null } });
      onCreated(d.subject);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const submit = async () => {
    setError(null);
    if (f.name.trim().length < 2) return setError({ message: 'Хичээлийн нэрийг бичнэ үү' });
    if (!f.schoolId) return setError({ message: 'Хичээлийг заадаг бүрэлдэхүүн сургуулийг сонгоно уу' });
    // Эхний удаа ижил төстэй хичээлийг шалгана; олдвол сонгох эсвэл "шинээр нэмэх"-ийг баталгаажуулна
    if (similar === null) {
      setBusy(true);
      try {
        const d = await api('/subjects/similar', { params: { name: f.name.trim(), code: f.code || undefined } });
        setSimilar(d.subjects);
        if (d.subjects.length) return;
      } catch (err) { return setError(err); } finally { setBusy(false); }
    }
    create();
  };

  return (
    <div className="card pad new-subject" role="group" aria-label="Шинэ хичээл нэмэх">
      <div className="row-between">
        <strong>Шинэ хичээл нэмэх</strong>
        <button type="button" className="link-btn muted" onClick={onCancel}><X size={15} />Болих</button>
      </div>
      <p className="muted small no-top">Нэмсэн хичээл бүх оюутанд харагдана. Админ шаардлагатай бол засна.</p>
      <div className="new-subject-grid">
        <label>Хичээлийн нэр<input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={150} placeholder="Жишээ нь: Компьютерын сүлжээ" /></label>
        <label><span>Код <span className="muted small">(заавал биш)</span></span><input value={f.code} onChange={(e) => set({ code: e.target.value })} maxLength={20} placeholder="ICSI301" /></label>
        <label>Бүрэлдэхүүн сургууль
          <select value={f.schoolId} onChange={(e) => set({ schoolId: e.target.value, departmentId: '' })}>
            <option value="">Сонгоно уу</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.shortName} — {s.name}</option>)}
          </select>
        </label>
        <label><span>Тэнхим <span className="muted small">(заавал биш)</span></span>
          <select value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value })} disabled={!depts.length}>
            <option value="">{depts.length ? 'Сонгоно уу' : 'Тэнхим оруулаагүй'}</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </div>

      {similar?.length > 0 && (
        <div className="similar" aria-live="polite">
          <strong>Ижил төстэй хичээл бүртгэлтэй байна. Аль нэг нь мөн үү?</strong>
          <ul className="similar-subjects">
            {similar.map((s) => (
              <li key={s.id}>
                <span className="grow">{subjectLabel(s)} <span className="muted small">{[s.schoolShortName, s.departmentName].filter(Boolean).join(' · ')}</span></span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(s)}>Энийг сонгох</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ErrorText error={error} />
      <div className="row-end">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>
          <Plus size={15} />{similar?.length ? 'Үгүй, шинээр нэмэх' : 'Хичээл нэмэх'}
        </button>
      </div>
    </div>
  );
}
