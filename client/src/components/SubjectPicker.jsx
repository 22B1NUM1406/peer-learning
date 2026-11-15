import { useMemo, useState } from 'react';
import { BookOpen, Check, Search, X } from 'lucide-react';
import { subjectLabel } from '../lib/hooks.js';

// FR-26: асуулт асуухад хичээл сонгох. Гурван шаттай цэсний оронд нэг хайлттай талбар:
// нэр эсвэл кодоор хайна, хүсвэл бүрэлдэхүүн сургуулиар шүүнэ (заавал биш).
export default function SubjectPicker({ subjects, schools, value, onChange, required }) {
  const [text, setText] = useState('');
  const [schoolId, setSchoolId] = useState('');
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
        <button type="button" className="link-btn" onClick={() => onChange('')} aria-label="Хичээл солих"><X size={15} />Солих</button>
      </div>
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
        {matches.length === 0 && <li className="muted small pad">Тохирох хичээл олдсонгүй.</li>}
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
      {/* Маягтын заавал бөглөх шалгалт: хичээл сонгоогүй бол илгээхгүй */}
      {required && <input className="picker-required" tabIndex={-1} aria-hidden="true" required value="" onChange={() => {}} onInvalid={(e) => e.target.setCustomValidity('Хичээл сонгоно уу')} />}
    </div>
  );
}
