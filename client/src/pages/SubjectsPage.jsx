import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronRight, FolderOpen, Library, Plus, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useDebounced, useSchools } from '../lib/hooks.js';
import { Empty, ErrorText, Loading, PageHeader, SchoolOptions } from '../components/ui.jsx';
import { adoptCatalog, courseMeta } from '../components/SubjectPicker.jsx';

// Хичээлүүдийн жагсаалт (дээд цэсний "Хичээлүүд", "Материал").
// FR-26: бүрэлдэхүүн сургуулиар бүлэглэж, сургууль ба тэнхимээр шүүнэ.
// Материал хичээл бүрт хадгалагддаг тул ?tab=resources үед карт нь хичээлийн материалын таб руу хөтөлнө.
export default function SubjectsPage() {
  const [params, setParams] = useSearchParams();
  const resources = params.get('tab') === 'resources';
  const school = params.get('school') ?? '';
  const department = params.get('department') ?? '';
  const schools = useSchools();
  const { data, error, loading } = useApi('/subjects', { school, department });

  const setFilter = (changes) => {
    // Функцээр шинэчилнэ: хайлтын саатсан (debounce) шинэчлэлт сүүлд сонгосон шүүлтүүрийг дарж бичихгүй
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });
  };
  const departments = schools.find((s) => String(s.id) === school)?.departments ?? [];

  // Сургуулийн дарааллаар бүлэглэнэ; сургууль оноогоогүй хичээл төгсгөлд
  const groups = [];
  const subjects = data?.subjects ?? [];
  for (const s of schools) {
    const items = subjects.filter((x) => x.schoolId === s.id);
    if (items.length) groups.push({ key: s.id, title: s.shortName, full: s.name, items });
  }
  const other = subjects.filter((x) => !x.schoolId);
  if (other.length) groups.push({ key: 'other', title: 'Бусад', full: 'Сургууль заагаагүй хичээл', items: other });

  return (
    <>
      <PageHeader
        title={resources ? 'Материал' : 'Хичээлүүд'}
        sub={resources
          ? 'Материалыг хичээлээр нь хадгалдаг. Хичээлээ сонгож лекц, бие даалтын материалыг үзээрэй.'
          : 'Хичээлээ сонгож асуулт, материал, туслах боломжтой оюутнуудыг үзээрэй.'}
        actions={resources
          ? <Link to="/resources/new" className="btn btn-primary"><Plus size={16} />Материал хуваалцах</Link>
          : <Link to="/questions/new" className="btn btn-primary"><Plus size={16} />Асуулт асуух</Link>}
      />

      <div className="filter-row">
        <select aria-label="Бүрэлдэхүүн сургууль" value={school} onChange={(e) => setFilter({ school: e.target.value, department: '' })}>
          <option value="">Бүх бүрэлдэхүүн сургууль</option>
          <SchoolOptions schools={schools} full />
        </select>
        {departments.length > 0 && (
          <select aria-label="Тэнхим" value={department} onChange={(e) => setFilter({ department: e.target.value })}>
            <option value="">Бүх тэнхим</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      {loading && !data && <Loading rows={4} />}
      <ErrorText error={error} />
      {data && subjects.length === 0 && (
        <p className="muted small subjects-empty">
          {school ? 'Энэ сургууль, тэнхимийн хичээлээр одоохондоо асуулт, материал алга.' : 'Одоохондоо идэвхтэй хичээл алга.'}{' '}
          Доорх МУИС-ийн хичээлийн жагсаалтаас хичээлээ олоорой.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key} className="school-group">
          <h2>{g.title}<span className="school-full">{g.full}</span><span className="school-count">{g.items.length}</span></h2>
          <ul className="subject-grid">
            {g.items.map((s) => (
              <li key={s.id}>
                <Link to={resources ? `/subjects/${s.id}?tab=resources` : `/subjects/${s.id}`} className="subject-card">
                  <span className="subject-icon">{resources ? <FolderOpen size={17} /> : <BookOpen size={17} />}</span>
                  <span className="grow subject-card-text">
                    <span className="subject-name">{s.code && <span className="subject-code">{s.code}</span>}{s.name}</span>
                    {s.departmentName && <span className="subject-dept">{s.departmentName}</span>}
                  </span>
                  <span className={`subject-qcount ${s.questionCount ? '' : 'zero'}`} title="Асуултын тоо">{s.questionCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <CatalogBrowser school={school} department={department} resources={resources} />
    </>
  );
}

// МУИС-ийн хичээлийн жагсаалт (db/num-courses.csv): системд хараахан идэвхжээгүй хичээлүүд.
// Хичээл дээр дарахад хичээл үүсч (FR-26), хичээлийн хуудас нээгдэнэ.
function CatalogBrowser({ school, department, resources }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);
  const [state, setState] = useState({ courses: [], total: 0, page: 1, loading: false, error: null });
  const [busy, setBusy] = useState(false);
  const active = Boolean(school || department || q.length >= 2);

  const load = async (page) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const d = await api('/subjects/catalog', { params: { school, department, q: q.length >= 2 ? q : '', page } });
      setState((s) => ({ courses: page === 1 ? d.courses : [...s.courses, ...d.courses], total: d.total, page, loading: false, error: null }));
    } catch (err) { setState((s) => ({ ...s, loading: false, error: err })); }
  };
  useEffect(() => {
    if (active) load(1); else setState({ courses: [], total: 0, page: 1, loading: false, error: null });
  }, [school, department, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (course) => {
    setBusy(true);
    try {
      const subject = await adoptCatalog(course.id);
      navigate(resources ? `/subjects/${subject.id}?tab=resources` : `/subjects/${subject.id}`);
    } catch (err) { setState((s) => ({ ...s, error: err })); setBusy(false); }
  };

  return (
    <section className="catalog-browser">
      <div className="catalog-head">
        <h2><Library size={18} />МУИС-ийн хичээлийн жагсаалт</h2>
        <label className="search-box catalog-search">
          <Search size={16} />
          <input type="search" placeholder="Хичээлийн нэр эсвэл код" aria-label="МУИС-ийн хичээл хайх" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      {!active ? (
        <p className="muted small">Дээрээс сургуулиа сонгох эсвэл хичээлийн нэр, кодоо бичиж МУИС-ийн бүх хичээлээс хайгаарай.</p>
      ) : (
        <>
          <ErrorText error={state.error} />
          {state.loading && state.courses.length === 0 ? <Loading rows={3} /> : state.courses.length === 0 ? (
            <p className="muted small">Тохирох хичээл олдсонгүй.</p>
          ) : (
            <>
              <p className="muted small catalog-total">{state.total} хичээл</p>
              <ul className="catalog-list">
                {state.courses.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="catalog-row" onClick={() => open(c)} disabled={busy}>
                      {c.code && <span className="subject-code">{c.code}</span>}
                      <span className="grow">
                        <span className="catalog-name">{c.name}</span>
                        <span className="muted small block">{courseMeta(c)}</span>
                      </span>
                      <ChevronRight size={16} className="muted" />
                    </button>
                  </li>
                ))}
              </ul>
              {state.courses.length < state.total && (
                <button type="button" className="btn btn-secondary full load-more" onClick={() => load(state.page + 1)} disabled={state.loading}>
                  {state.loading ? 'Ачаалж байна…' : `Цааш үзэх (${state.total - state.courses.length})`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
