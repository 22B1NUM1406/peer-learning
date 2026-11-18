import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Library, Plus, Search, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { subjectLabel, useDebounced } from '../lib/hooks.js';
import { ErrorText } from './ui.jsx';

// МУИС-ийн хичээлийн каталогоос хайх (SiSi-ээс импортолсон). Системд хараахан байхгүй хичээлүүдийг буцаана;
// сонгоход adoptCatalog() хичээлийг үүсгэнэ (байвал тэрийг нь буцаана).
export function useCatalogSearch(text, school = '') {
  const q = useDebounced(text.trim(), 250);
  const key = `${q}|${school}`;
  const [state, setState] = useState({ key: '', catalog: [] });
  useEffect(() => {
    if (q.length < 2) { setState({ key, catalog: [] }); return undefined; }
    let cancelled = false;
    api('/subjects/search', { params: { q, school } })
      .then((d) => { if (!cancelled) setState({ key, catalog: d.catalog }); })
      .catch(() => { if (!cancelled) setState({ key, catalog: [] }); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { catalog: state.catalog, loading: text.trim().length >= 2 && state.key !== `${text.trim()}|${school}` };
}

export const adoptCatalog = (id) => api(`/subjects/catalog/${id}`, { method: 'POST' }).then((d) => d.subject);

const courseMeta = (c) => [c.schoolShortName, c.departmentName, c.credit != null && `${c.credit} кредит`].filter(Boolean).join(' · ');

// Каталогийн нэг мөр: код, нэр, сургууль, тэнхим, кредит
export function CatalogItem({ course, onPick, busy, icon = <Plus size={16} className="picker-check" /> }) {
  return (
    <button type="button" onClick={() => onPick(course)} disabled={busy}>
      <span className="grow">
        <span className="strong">{course.code ? `${course.code} · ` : ''}{course.name}</span>
        <span className="muted small block">{courseMeta(course)}</span>
      </span>
      {icon}
    </button>
  );
}

// FR-26: асуулт асуухад хичээл сонгох. Гурван шаттай цэсний оронд нэг хайлттай талбар:
// нэр эсвэл кодоор хайна, хүсвэл бүрэлдэхүүн сургуулиар шүүнэ (заавал биш).
// FR-27: жагсаалтад байхгүй бол оюутан өөрөө нэмнэ; нэмэхийн өмнө ижил төстэй хичээлийг санал болгоно.
export default function SubjectPicker({ subjects, schools, value, onChange, onCreated, required, loading }) {
  const [text, setText] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [adding, setAdding] = useState(false);
  const [adoptError, setAdoptError] = useState(null);
  const [busy, setBusy] = useState(false);
  const selected = subjects.find((s) => String(s.id) === String(value));
  const { catalog: catalogShown, loading: catalogLoading } = useCatalogSearch(selected ? '' : text, schoolId);

  const pickCatalog = async (course) => {
    setBusy(true);
    setAdoptError(null);
    try {
      const subject = await adoptCatalog(course.id);
      setText('');
      onCreated?.(subject);
      onChange(String(subject.id));
    } catch (err) { setAdoptError(err); } finally { setBusy(false); }
  };

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    return subjects.filter((s) => (!schoolId || String(s.schoolId) === schoolId)
      && (!t || s.name.toLowerCase().includes(t) || (s.code ?? '').toLowerCase().includes(t)));
  }, [subjects, text, schoolId]);

  if (selected) {
    return (
      <div className="picker-selected">
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
        {!loading && matches.length === 0 && !catalogShown.length && (
          <li className="muted small pad">{catalogLoading ? 'Хайж байна…' : 'Тохирох хичээл олдсонгүй.'}</li>
        )}
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
        {/* МУИС-ийн каталогоос: системд хараахан байхгүй, албан ёсны код, тэнхимтэй хичээлүүд */}
        {catalogShown.length > 0 && (
          <>
            <li className="picker-group" role="presentation"><Library size={14} />МУИС-ийн хичээлийн каталогоос</li>
            {catalogShown.map((c) => (
              <li key={`c${c.id}`}><CatalogItem course={c} onPick={pickCatalog} busy={busy} /></li>
            ))}
          </>
        )}
      </ul>
      <ErrorText error={adoptError} />
      <button type="button" className="link-btn picker-add" onClick={() => setAdding(true)}>
        <Plus size={15} />{text.trim() ? `“${text.trim()}” хичээлийг гараар нэмэх` : 'Каталогт байхгүй бол шинэ хичээл нэмэх'}
      </button>
      {/* Маягтын заавал бөглөх шалгалт: хичээл сонгоогүй бол илгээхгүй */}
      {required && <input className="picker-required" tabIndex={-1} aria-hidden="true" required value="" onChange={() => {}} onInvalid={(e) => e.target.setCustomValidity('Хичээл сонгоно уу')} />}
    </div>
  );
}

// Шинэ хичээл нэмэх хэсэг. Асуулт, профайлын маягт дотор байрладаг тул тусдаа <form> биш (HTML-д давхар form хориотой).
export function NewSubject({ schools, initial, onCancel, onPick, onCreated }) {
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
    <div className="new-subject" role="group" aria-label="Шинэ хичээл нэмэх">
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
